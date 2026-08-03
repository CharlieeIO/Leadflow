import { NextRequest, NextResponse, after } from 'next/server'
import twilio from 'twilio'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/twilio/sender'
import { generateQualificationResponse } from '@/lib/claude/orchestrator'
import { notifyOwner } from '@/lib/notifications/owner'
import { fireCrmWebhook } from '@/lib/crm/outbound'
import { getResend } from '@/lib/resend/client'
import { escalationAlertHtml } from '@/lib/resend/templates'
import { logger } from '@/lib/logger'
import type { Business, BusinessSettings, Lead, Conversation } from '@/types'

// Twilio sends form-encoded bodies, not JSON.
// We respond with empty TwiML — messages are sent via API (not TwiML verbs)
// so we retain retry logic and sender control.
const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response/>'

function twimlResponse(status = 200) {
  return new NextResponse(EMPTY_TWIML, {
    status,
    headers: { 'Content-Type': 'text/xml' },
  })
}

// ── Twilio signature validation ───────────────────────────────────────────────
// Prevents spoofed requests. Twilio signs every webhook with HMAC-SHA1.
// The URL used for signing must exactly match what Twilio has on file.
function validateTwilioSignature(request: NextRequest, params: Record<string, string>): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) return false

  const signature = request.headers.get('x-twilio-signature') ?? ''

  // Reconstruct the URL Twilio signed. In production behind a proxy, trust
  // x-forwarded-proto / x-forwarded-host so the URL matches what Twilio stored.
  const proto = request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host
  const url = `${proto}://${host}/api/webhooks/sms`

  return twilio.validateRequest(authToken, signature, url, params)
}

// ── Parse x-www-form-urlencoded body ─────────────────────────────────────────
async function parseFormBody(request: NextRequest): Promise<Record<string, string>> {
  const text = await request.text()
  const params: Record<string, string> = {}
  for (const pair of text.split('&')) {
    const [k, v] = pair.split('=')
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? '').replace(/\+/g, ' ')
  }
  return params
}

// ── POST /api/webhooks/sms ────────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Parse body first — validateRequest needs the raw params
  const params = await parseFormBody(request)

  // Normalize phone numbers — strip spaces, ensure + prefix
  const normalize = (n: string) => '+' + n.replace(/\s+/g, '').replace(/^\+/, '')

  const from = normalize(params['From'] ?? '')  // lead's phone (E.164)
  const to   = normalize(params['To']   ?? '')  // business's Twilio number (E.164)
  const body = params['Body']                   // message text
  const messageSid = params['MessageSid']

  if (!from || from === '+' || !to || to === '+' || body === undefined) {
    logger.warn('sms_webhook_missing_fields', { from, to, hasSid: !!messageSid })
    return twimlResponse(400)
  }

  // Validate Twilio signature — skip in local dev or when DISABLE_TWILIO_SIG_CHECK is set
  if (process.env.TWILIO_AUTH_TOKEN && process.env.NODE_ENV !== 'development' && !process.env.DISABLE_TWILIO_SIG_CHECK) {
    if (!validateTwilioSignature(request, params)) {
      logger.warn('sms_webhook_invalid_signature', { to, from })
      return twimlResponse(403)
    }
  }

  const supabase = getSupabaseServiceClient()

  // ── Look up business by its Twilio number ────────────────────────────────────
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id, name, niche, twilio_number, cal_event_type_id, settings, active, owner_user_id, retell_agent_id, created_at, updated_at')
    .eq('twilio_number', to)
    .eq('active', true)
    .maybeSingle()

  if (bizError || !business) {
    logger.warn('sms_webhook_unknown_number', { to })
    return twimlResponse() // ack Twilio, ignore unknown number
  }

  // ── Find or create the lead ───────────────────────────────────────────────────
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
        source: 'sms_inbound',
        status: 'new',
        language: 'en',
        last_contact: new Date().toISOString(),
        metadata: { sequence_step: 0 },
      })
      .select('*')
      .single()

    if (insertError || !newLead) {
      logger.error('sms_webhook_lead_create_failed', {
        business_id: business.id,
        phone: from,
        error: insertError?.message,
      })
      return twimlResponse()
    }

    lead = newLead as Lead
  }

  // ── Return TwiML to Twilio immediately ───────────────────────────────────────
  // Twilio's webhook timeout is 15 seconds. All heavy work (delay, AI call,
  // SMS send) runs inside after() so Twilio always gets its 200 fast.
  after(async () => {
    await processInbound({ business: business as Business, lead, from, to, body, messageSid, supabase })
  })

  return twimlResponse()
}

// ── Inbound processing (runs after TwiML is returned to Twilio) ───────────────
async function processInbound({
  business, lead, from, to, body, messageSid, supabase,
}: {
  business: Business
  lead: Lead
  from: string
  to: string
  body: string
  messageSid: string | undefined
  supabase: ReturnType<typeof getSupabaseServiceClient>
}): Promise<void> {
  const bSettings = business.settings as BusinessSettings

  // ── Quiet hours check ────────────────────────────────────────────────────────
  if (bSettings.quiet_hours_enabled) {
    const tz = bSettings.timezone ?? 'America/New_York'
    const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: tz })
    const start = bSettings.quiet_hours_start ?? '22:00'
    const end   = bSettings.quiet_hours_end   ?? '07:00'
    const inQuiet = start > end
      ? now >= start || now < end
      : now >= start && now < end
    if (inQuiet) {
      logger.info('sms_webhook_quiet_hours', { business_id: business.id, lead_id: lead.id })
      return
    }
  }

  // ── Response delay (humanizing pause) ────────────────────────────────────────
  const delaySec = (bSettings.response_delay_seconds ?? 0) as number
  if (delaySec > 0) {
    await new Promise((resolve) => setTimeout(resolve, delaySec * 1000))
  }

  // ── Skip AI if paused (human is handling) ────────────────────────────────────
  if (lead.ai_paused) {
    await supabase.from('conversations').insert({
      lead_id: lead.id,
      business_id: business.id,
      direction: 'inbound',
      body: body.trim(),
      channel: 'sms',
      ai_generated: false,
      twilio_sid: messageSid ?? null,
    })
    logger.info('sms_webhook_ai_paused', { business_id: business.id, lead_id: lead.id })
    return
  }

  // ── Save inbound message ──────────────────────────────────────────────────────
  const { data: inboundMsg, error: msgError } = await supabase
    .from('conversations')
    .insert({
      lead_id: lead.id,
      business_id: business.id,
      direction: 'inbound',
      body: body.trim(),
      channel: 'sms',
      ai_generated: false,
      twilio_sid: messageSid ?? null,
    })
    .select('id')
    .single()

  if (msgError || !inboundMsg) {
    logger.error('sms_webhook_save_inbound_failed', {
      business_id: business.id,
      lead_id: lead.id,
      error: msgError?.message,
    })
    return
  }

  // ── Load conversation history (last 10, oldest-first) ────────────────────────
  const { data: historyRows } = await supabase
    .from('conversations')
    .select('id, lead_id, business_id, direction, body, channel, ai_generated, twilio_sid, created_at')
    .eq('lead_id', lead.id)
    .eq('business_id', business.id)
    .neq('id', inboundMsg.id) // exclude the message we just saved
    .order('created_at', { ascending: false })
    .limit(10)

  // Reverse so history is chronological (oldest → newest)
  const history = ((historyRows ?? []) as Conversation[]).reverse()

  // ── Run the AI orchestrator ───────────────────────────────────────────────────
  const result = await generateQualificationResponse({
    business,
    lead,
    inboundMessage: body.trim(),
    conversationHistory: history,
    conversationId: inboundMsg.id,
  })

  // ── Update lead: last_contact, status, language ───────────────────────────────
  if (result.type === 'escalate') {
    void supabase
      .from('leads')
      .update({
        last_contact: new Date().toISOString(),
        status: 'escalated',
        escalation_reason: result.reason,
        ai_paused: true,
      })
      .eq('id', lead.id)
  } else if (lead.status === 'new') {
    void supabase
      .from('leads')
      .update({ last_contact: new Date().toISOString(), status: 'contacted' })
      .eq('id', lead.id)
  } else {
    void supabase
      .from('leads')
      .update({ last_contact: new Date().toISOString() })
      .eq('id', lead.id)
  }

  // ── Log analytics event ────────────────────────────────────────────────────────
  void supabase.from('analytics_events').insert({
    business_id: business.id,
    lead_id: lead.id,
    event_type: 'sms_received',
    properties: {
      escalated: result.type === 'escalate',
      ai_responded: result.type === 'response',
    },
  })

  // ── Send AI reply (or skip on escalation) ─────────────────────────────────────
  if (result.type === 'escalate') {
    logger.info('sms_webhook_escalated', {
      business_id: business.id,
      lead_id: lead.id,
      reason: result.reason,
    })

    void notifyOwner({ business, lead, message: result.reason, type: 'escalation' })
    void fireCrmWebhook({ business, lead, event: 'lead.escalated', data: { reason: result.reason } })
    void sendEscalationEmail({ business, lead, reason: result.reason, recentHistory: history, latestMessage: body.trim() })
    return
  }

  // For both 'response' and 'error', we have a message to send.
  const outboundBody = result.message

  // Save outbound message before sending (so it appears in history even if send fails)
  const { data: outboundMsg } = await supabase
    .from('conversations')
    .insert({
      lead_id: lead.id,
      business_id: business.id,
      direction: 'outbound',
      body: outboundBody,
      channel: 'sms',
      ai_generated: result.type === 'response',
      twilio_sid: null, // updated after send below
    })
    .select('id')
    .single()

  // Send SMS
  try {
    const sent = await sendSMS({
      to: from,
      from: to,
      body: outboundBody,
      business_id: business.id,
      lead_id: lead.id,
    })

    // Patch the twilio_sid onto the saved outbound message
    if (outboundMsg?.id) {
      void supabase
        .from('conversations')
        .update({ twilio_sid: sent.sid })
        .eq('id', outboundMsg.id)
    }
  } catch (err) {
    logger.error('sms_webhook_send_failed', {
      business_id: business.id,
      lead_id: lead.id,
      error: String(err),
    })
  }

  // ── Owner SMS notification on first lead contact ──────────────────────────────
  // Only fires when this is a brand-new lead and the owner has a notification number.
  if (lead.status === 'new' && bSettings.notification_phone) {
    const preview = body.trim().slice(0, 120)
    const notifyBody = `LeadFlow: New lead from ${from}\n"${preview}"\nAI replied ✓`
    void sendSMS({
      to: bSettings.notification_phone,
      from: to,
      body: notifyBody,
      business_id: business.id,
    }).catch(() => {})
  }
}

// ── Escalation email with full conversation transcript ────────────────────────
async function sendEscalationEmail(params: {
  business: Business
  lead: Lead
  reason: string
  recentHistory: Conversation[]
  latestMessage: string
}): Promise<void> {
  const { business, lead, reason, recentHistory, latestMessage } = params
  const settings = business.settings as BusinessSettings
  if (!settings.notification_email) return

  try {
    const supabase = getSupabaseServiceClient()

    // Load full conversation (not just the last 10 passed to the orchestrator)
    const { data: allMessages } = await supabase
      .from('conversations')
      .select('direction, body, created_at, ai_generated')
      .eq('lead_id', lead.id)
      .eq('business_id', business.id)
      .order('created_at', { ascending: true })

    type MsgRow = { direction: 'inbound' | 'outbound'; body: string; created_at: string; ai_generated: boolean }
    const messages: MsgRow[] = [
      ...((allMessages ?? []) as MsgRow[]),
      {
        direction: 'inbound' as const,
        body: latestMessage,
        created_at: new Date().toISOString(),
        ai_generated: false,
      },
    ]

    const dashboardUrl = `${process.env.NEXT_PUBLIC_URL ?? 'https://www.theleadflowautomation.com'}/dashboard/leads/${lead.id}`

    const resend = getResend()
    await resend.emails.send({
      from: `LeadFlow AI <notifications@${process.env.RESEND_FROM_DOMAIN ?? 'theleadflowautomation.com'}>`,
      to: settings.notification_email,
      subject: `⚠️ Escalation — ${lead.name ?? lead.phone} needs you — ${business.name}`,
      html: escalationAlertHtml({
        businessName: business.name,
        leadName: lead.name,
        leadPhone: lead.phone,
        reason,
        messages,
        dashboardUrl,
      }),
    })

    logger.info('escalation_email_sent', {
      business_id: business.id,
      lead_id: lead.id,
      to: settings.notification_email,
    })
  } catch (err) {
    logger.error('escalation_email_failed', {
      business_id: business.id,
      lead_id: lead.id,
      error: String(err),
    })
  }
}
