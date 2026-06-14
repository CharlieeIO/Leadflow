import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/twilio/sender'
import { logger } from '@/lib/logger'
import type { BusinessSettings } from '@/types'

// Returns TwiML that says nothing and hangs up — SMS is sent via API separately
const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response/>'

function twimlResponse() {
  return new NextResponse(EMPTY_TWIML, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

// POST /api/webhooks/twilio/voice
// Fires when someone calls the Twilio number.
// Sends an automatic SMS text-back and creates a lead if one doesn't exist.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const text = await request.text()
  const params: Record<string, string> = {}
  for (const pair of text.split('&')) {
    const [k, v] = pair.split('=')
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? '').replace(/\+/g, ' ')
  }

  const from = params['From']  // caller's phone number
  const to   = params['To']    // business Twilio number

  if (!from || !to) return twimlResponse()

  const supabase = getSupabaseServiceClient()

  // Find the business by Twilio number
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, twilio_number, settings')
    .eq('twilio_number', to)
    .eq('active', true)
    .maybeSingle()

  if (!business) {
    logger.warn('voice_webhook_unknown_number', { to })
    return twimlResponse()
  }

  const settings = business.settings as BusinessSettings | undefined
  const persona  = settings?.ai_persona_name ?? 'our team'
  const bookingLink = settings?.booking_link

  // Find or create lead
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id, phone, ai_paused')
    .eq('phone', from)
    .eq('business_id', business.id)
    .maybeSingle()

  let leadId: string

  if (existingLead) {
    leadId = existingLead.id
    // Don't interrupt if human is handling
    if (existingLead.ai_paused) return twimlResponse()
  } else {
    const { data: newLead, error } = await supabase
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
      .select('id')
      .single()

    if (error || !newLead) {
      logger.error('voice_webhook_lead_create_failed', { business_id: business.id, phone: from, error: error?.message })
      return twimlResponse()
    }

    leadId = newLead.id
  }

  // Build the text-back message
  const message = bookingLink
    ? `Hi! This is ${persona} from ${business.name}. Sorry we missed your call! We'd love to help — reply here and let us know what you need, or book a free estimate directly: ${bookingLink}`
    : `Hi! This is ${persona} from ${business.name}. Sorry we missed your call! Reply here and let us know what you need — we'll get right back to you.`

  // Send the SMS
  try {
    await sendSMS({
      to: from,
      from: to,
      body: message,
      business_id: business.id,
      lead_id: leadId,
    })

    // Log the outbound message
    await supabase.from('conversations').insert({
      lead_id: leadId,
      business_id: business.id,
      direction: 'outbound',
      body: message,
      channel: 'sms',
      ai_generated: false,
    })

    logger.info('missed_call_textback_sent', { business_id: business.id, lead_id: leadId, from })
  } catch (err) {
    logger.error('missed_call_textback_failed', { business_id: business.id, lead_id: leadId, error: String(err) })
  }

  return twimlResponse()
}
