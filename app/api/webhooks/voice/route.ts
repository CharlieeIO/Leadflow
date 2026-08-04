import { NextRequest, NextResponse, after } from 'next/server'
import twilio from 'twilio'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/twilio/sender'
import { registerRetellCall } from '@/lib/retell/client'
import { notifyOwner } from '@/lib/notifications/owner'
import { logger } from '@/lib/logger'
import type { Business, Lead } from '@/types'

// ── TwiML helpers ─────────────────────────────────────────────────────────────

function twimlResponse(xml: string, status = 200) {
  return new NextResponse(xml, {
    status,
    headers: { 'Content-Type': 'text/xml' },
  })
}

// Connects Twilio to Retell's audio WebSocket so the AI agent answers live.
function retellStreamTwiml(accessToken: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.retellai.com/audio-websocket/${accessToken}" />
  </Connect>
</Response>`
}

// Plays a brief message when no AI agent is configured.
// The lead gets an SMS follow-up instead.
function missedCallTwiml(businessName: string): string {
  const escaped = businessName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Thanks for calling ${escaped}. We missed you but we'll text you right away to help.</Say>
  <Hangup/>
</Response>`
}

// ── Twilio signature validation ───────────────────────────────────────────────
async function parseFormBody(request: NextRequest): Promise<Record<string, string>> {
  const text = await request.text()
  const params: Record<string, string> = {}
  for (const pair of text.split('&')) {
    const [k, v] = pair.split('=')
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? '').replace(/\+/g, ' ')
  }
  return params
}

function validateTwilioSignature(request: NextRequest, params: Record<string, string>): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) return false
  const signature = request.headers.get('x-twilio-signature') ?? ''
  const proto = request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host
  const url = `${proto}://${host}/api/webhooks/voice`
  return twilio.validateRequest(authToken, signature, url, params)
}

// ── SMS follow-up after a missed call ─────────────────────────────────────────
// Saved to conversations so the AI has context when the lead texts back.
async function sendMissedCallSMS(params: {
  business: Business
  lead: Lead
  twilioNumber: string
}) {
  const { business, lead, twilioNumber } = params
  const supabase = getSupabaseServiceClient()

  const message =
    lead.language === 'es'
      ? `Hola${lead.name ? ` ${lead.name}` : ''}, vimos que llamaste a ${business.name}. Estamos en un trabajo ahora mismo — ¿en qué te podemos ayudar? ¡Responde aquí y te atendemos de inmediato!`
      : `Hey${lead.name ? ` ${lead.name}` : ''}! Sorry we missed your call — we're out on a job right now. What did you need? Reply here and we'll take care of you. — ${business.name} team`

  // Save to history first so AI sees it when lead replies
  const { data: outboundMsg } = await supabase
    .from('conversations')
    .insert({
      lead_id: lead.id,
      business_id: business.id,
      direction: 'outbound',
      body: message,
      channel: 'sms',
      ai_generated: false,
      twilio_sid: null,
    })
    .select('id')
    .single()

  try {
    const sent = await sendSMS({
      to: lead.phone!,
      from: twilioNumber,
      body: message,
      business_id: business.id,
      lead_id: lead.id,
    })

    if (outboundMsg?.id) {
      void supabase.from('conversations').update({ twilio_sid: sent.sid }).eq('id', outboundMsg.id)
    }
  } catch (err) {
    logger.error('missed_call_sms_failed', {
      business_id: business.id,
      lead_id: lead.id,
      error: String(err),
    })
  }
}

// ── POST /api/webhooks/voice ──────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  const params = await parseFormBody(request)

  const from = params['From']       // caller's phone (E.164)
  const to = params['To']           // business Twilio number (E.164)
  const callSid = params['CallSid']
  const callStatus = params['CallStatus'] // 'ringing' | 'in-progress' | 'completed' | etc.

  if (!from || !to) {
    return twimlResponse('<Response><Hangup/></Response>', 400)
  }

  // Validate Twilio signature (skip in local dev)
  if (process.env.TWILIO_AUTH_TOKEN && process.env.NODE_ENV !== 'development') {
    if (!validateTwilioSignature(request, params)) {
      logger.warn('voice_webhook_invalid_signature', { to, from })
      return twimlResponse('<Response><Hangup/></Response>', 403)
    }
  }

  const supabase = getSupabaseServiceClient()

  // Look up the business by its Twilio number
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id, name, niche, twilio_number, cal_event_type_id, settings, active, owner_user_id, retell_agent_id, created_at, updated_at')
    .eq('twilio_number', to)
    .eq('active', true)
    .maybeSingle()

  if (bizError || !business) {
    logger.warn('voice_webhook_unknown_number', { to })
    return twimlResponse('<Response><Hangup/></Response>')
  }

  // Find or create the lead from caller's number
  const { data: existingLead } = await supabase
    .from('leads')
    .select('*')
    .eq('phone', from)
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let lead: Lead

  if (existingLead) {
    lead = existingLead as Lead
  } else {
    const { data: newLead, error: insertError } = await supabase
      .from('leads')
      .insert({
        business_id: business.id,
        phone: from,
        source: 'missed_call',
        status: 'new',
        language: 'en',
        last_contact: new Date().toISOString(),
        metadata: { sequence_step: 0 },
      })
      .select('*')
      .single()

    if (insertError || !newLead) {
      logger.error('voice_webhook_lead_create_failed', {
        business_id: business.id,
        phone: from,
        error: insertError?.message,
      })
      return twimlResponse(missedCallTwiml(business.name))
    }

    lead = newLead as Lead
  }

  // Log the inbound call as a conversation event
  void supabase.from('conversations').insert({
    lead_id: lead.id,
    business_id: business.id,
    direction: 'inbound',
    body: `Inbound voice call (SID: ${callSid ?? 'unknown'})`,
    channel: 'voice',
    ai_generated: false,
    twilio_sid: callSid ?? null,
  })

  void supabase.from('analytics_events').insert({
    business_id: business.id,
    lead_id: lead.id,
    event_type: 'voice_call',
    properties: { call_sid: callSid, call_status: callStatus, has_retell: !!business.retell_agent_id },
  })

  logger.info('voice_webhook_inbound', {
    business_id: business.id,
    lead_id: lead.id,
    has_retell: !!business.retell_agent_id,
    call_sid: callSid,
  })

  // ── Route: Retell AI agent or missed-call SMS ─────────────────────────────────
  if (business.retell_agent_id) {
    try {
      const { accessToken } = await registerRetellCall({
        agentId: business.retell_agent_id,
        fromNumber: from,
        toNumber: to,
        metadata: {
          business_id: business.id,
          lead_id: lead.id,
          business_name: business.name,
          lead_name: lead.name ?? '',
        },
      })

      return twimlResponse(retellStreamTwiml(accessToken))
    } catch (err) {
      // If Retell registration fails, fall through to missed-call SMS
      logger.error('retell_register_failed', {
        business_id: business.id,
        lead_id: lead.id,
        error: String(err),
      })
    }
  }

  // No Retell (or Retell failed) — play message, then fire SMS + notify owner after TwiML is returned
  after(async () => {
    await sendMissedCallSMS({
      business: business as Business,
      lead,
      twilioNumber: to,
    })

    void notifyOwner({
      business: business as Business,
      lead,
      message: `${lead.name ?? lead.phone} called ${business.name} — no agent answered. AI sent a follow-up SMS.`,
      type: 'missed_call',
    })
  })

  return twimlResponse(missedCallTwiml(business.name))
}
