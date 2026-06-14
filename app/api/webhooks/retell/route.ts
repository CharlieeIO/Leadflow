import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/twilio/sender'
import { validateRetellSignature } from '@/lib/retell/client'
import { generateQualificationResponse } from '@/lib/claude/orchestrator'
import { logger } from '@/lib/logger'
import type { Business, Lead, RetellWebhookEvent } from '@/types'

// ── POST /api/webhooks/retell ─────────────────────────────────────────────────
// Retell calls this after every call event (call_started, call_ended, call_analyzed).
// We act on call_ended — that's when we have the full transcript.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text()

  // Validate Retell HMAC signature (skip in local dev)
  if (process.env.RETELL_API_KEY && process.env.NODE_ENV !== 'development') {
    const signature = request.headers.get('x-retell-signature') ?? ''
    const valid = await validateRetellSignature(rawBody, signature)
    if (!valid) {
      logger.warn('retell_webhook_invalid_signature')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let event: RetellWebhookEvent
  try {
    event = JSON.parse(rawBody) as RetellWebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only act on call_ended — we have full transcript + analysis at this point
  if (event.event !== 'call_ended') {
    return NextResponse.json({ ok: true })
  }

  const { call } = event
  const { from_number: fromNumber, to_number: toNumber, call_id: callId } = call

  if (!fromNumber || !toNumber) {
    logger.warn('retell_webhook_missing_numbers', { call_id: callId })
    return NextResponse.json({ ok: true })
  }

  const supabase = getSupabaseServiceClient()

  // Look up business by its Twilio number (the number the caller dialed)
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id, name, niche, twilio_number, cal_event_type_id, settings, active, owner_user_id, retell_agent_id, created_at, updated_at')
    .eq('twilio_number', toNumber)
    .eq('active', true)
    .maybeSingle()

  if (bizError || !business) {
    logger.warn('retell_webhook_unknown_number', { to: toNumber })
    return NextResponse.json({ ok: true })
  }

  // Find the lead — they were created when the call came in (voice webhook)
  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('phone', fromNumber)
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lead) {
    logger.warn('retell_webhook_lead_not_found', {
      business_id: business.id,
      phone: fromNumber,
    })
    return NextResponse.json({ ok: true })
  }

  const transcript = call.transcript ?? ''
  const analysis = call.call_analysis
  const inVoicemail = analysis?.in_voicemail ?? false
  const callSuccessful = analysis?.call_successful ?? false
  const callSummary = analysis?.call_summary ?? ''

  logger.info('retell_call_ended', {
    business_id: business.id,
    lead_id: lead.id,
    call_id: callId,
    in_voicemail: inVoicemail,
    call_successful: callSuccessful,
  })

  // ── Save the call transcript as a conversation entry ──────────────────────────
  const transcriptBody = [
    callSummary ? `Summary: ${callSummary}` : null,
    transcript ? `\nTranscript:\n${transcript}` : null,
  ]
    .filter(Boolean)
    .join('') || `Voice call completed (ID: ${callId})`

  const { data: callConversation } = await supabase
    .from('conversations')
    .insert({
      lead_id: lead.id,
      business_id: business.id,
      direction: 'inbound',
      body: transcriptBody,
      channel: 'voice',
      ai_generated: false,
      twilio_sid: null,
    })
    .select('id')
    .single()

  void supabase
    .from('leads')
    .update({ last_contact: new Date().toISOString() })
    .eq('id', lead.id)

  void supabase.from('analytics_events').insert({
    business_id: business.id,
    lead_id: lead.id,
    event_type: 'voice_call',
    properties: {
      call_id: callId,
      in_voicemail: inVoicemail,
      call_successful: callSuccessful,
      has_transcript: !!transcript,
    },
  })

  // ── If voicemail — the lead never spoke to the agent, send SMS follow-up ──────
  if (inVoicemail) {
    if (business.twilio_number) {
      const message =
        lead.language === 'es'
          ? `Hola${lead.name ? ` ${lead.name}` : ''}, llamaste a ${business.name} pero terminaste en el buzón de voz. ¿En qué podemos ayudarte hoy?`
          : `Hey${lead.name ? ` ${lead.name}` : ''}, we saw you called ${business.name} — you reached voicemail. What can we help you with?`

      void sendSMS({
        to: lead.phone!,
        from: business.twilio_number,
        body: message,
        business_id: business.id,
        lead_id: lead.id,
      }).catch((err: unknown) => {
        logger.error('retell_voicemail_sms_failed', {
          business_id: business.id,
          lead_id: lead.id,
          error: String(err),
        })
      })
    }
    return NextResponse.json({ ok: true })
  }

  // ── Successful call — send a post-call SMS using the orchestrator ──────────────
  // The call summary becomes the "inbound message" so the AI can reference what was discussed.
  if (!business.twilio_number || !callSuccessful) {
    return NextResponse.json({ ok: true })
  }

  const { data: historyRows } = await supabase
    .from('conversations')
    .select('id, lead_id, business_id, direction, body, channel, ai_generated, twilio_sid, created_at')
    .eq('lead_id', lead.id)
    .eq('business_id', business.id)
    .neq('id', callConversation?.id ?? '')
    .order('created_at', { ascending: false })
    .limit(10)

  const history = ((historyRows ?? []) as import('@/types').Conversation[]).reverse()

  const inboundSummary = callSummary
    ? `I just had a phone call with your team. Here's what we discussed: ${callSummary}`
    : `I just had a phone call with your team.`

  try {
    const result = await generateQualificationResponse({
      business: business as Business,
      lead: lead as Lead,
      inboundMessage: inboundSummary,
      conversationHistory: history,
      conversationId: callConversation?.id,
    })

    if (result.type === 'escalate') {
      void supabase
        .from('leads')
        .update({ status: 'escalated', escalation_reason: result.reason, ai_paused: true })
        .eq('id', lead.id)
      return NextResponse.json({ ok: true })
    }

    const outboundBody = result.message

    const { data: outboundMsg } = await supabase
      .from('conversations')
      .insert({
        lead_id: lead.id,
        business_id: business.id,
        direction: 'outbound',
        body: outboundBody,
        channel: 'sms',
        ai_generated: result.type === 'response',
        twilio_sid: null,
      })
      .select('id')
      .single()

    const sent = await sendSMS({
      to: lead.phone!,
      from: business.twilio_number,
      body: outboundBody,
      business_id: business.id,
      lead_id: lead.id,
    })

    if (outboundMsg?.id) {
      void supabase
        .from('conversations')
        .update({ twilio_sid: sent.sid })
        .eq('id', outboundMsg.id)
    }
  } catch (err) {
    logger.error('retell_followup_failed', {
      business_id: business.id,
      lead_id: lead.id,
      error: String(err),
    })
  }

  return NextResponse.json({ ok: true })
}
