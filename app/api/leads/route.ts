import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/twilio/sender'
import { generateQualificationResponse } from '@/lib/claude/orchestrator'
import { notifyOwner } from '@/lib/notifications/owner'
import { fireCrmWebhook } from '@/lib/crm/outbound'
import { logger } from '@/lib/logger'
import type { LeadIntakeResponse, ApiError } from '@/types'

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Simple in-memory store: Map<ip, { count, resetAt }>
// Good enough for single-instance dev/staging. On Vercel, each edge invocation
// is isolated, so this degrades gracefully to "per-process" limiting in prod.
// Replace with Upstash Redis in a future session if needed.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5      // max requests
const RATE_WINDOW = 60_000 // per 60 seconds

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// ── Validation schema ─────────────────────────────────────────────────────────
const LeadIntakeSchema = z.object({
  business_id: z.string().uuid(),
  name: z.string().max(120).optional(),
  phone: z.string().min(7).max(20),
  email: z.string().email().optional().or(z.literal('')),
  service_type: z.string().max(80).optional(),
  message: z.string().max(2000).optional(),
  source: z
    .enum(['web_form', 'sms_inbound', 'missed_call', 'chat_widget', 'manual'])
    .default('web_form'),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
})

// ── Phone normalization ───────────────────────────────────────────────────────
// Attempts to parse as-is first, then with US country hint.
// Returns null if the number can't be made valid.
function normalizePhone(raw: string): string | null {
  let parsed = parsePhoneNumberFromString(raw)
  if (!parsed?.isValid()) {
    parsed = parsePhoneNumberFromString(raw, 'US')
  }
  return parsed?.isValid() ? parsed.format('E.164') : null
}

// ── Initial response SMS via AI orchestrator ──────────────────────────────────
// Runs after the lead record is created. The orchestrator generates the first
// AI message; falls back to a template if Claude is unavailable.
async function fireInitialResponse(params: {
  business: Parameters<typeof generateQualificationResponse>[0]['business']
  lead: Parameters<typeof generateQualificationResponse>[0]['lead']
  twilioNumber: string
  inboundMessage: string
}) {
  const { business, lead, twilioNumber, inboundMessage } = params

  let body: string

  try {
    const result = await generateQualificationResponse({
      business,
      lead,
      inboundMessage,
      conversationHistory: [],
    })

    if (result.type === 'response') {
      body = result.message
    } else if (result.type === 'escalate') {
      // Escalation on first message is rare but possible (e.g. opt-out in initial form)
      // Send a neutral handoff message; the owner notification happens in Session 10.
      body =
        lead.language === 'es'
          ? `Recibimos tu mensaje. Alguien de ${business.name} se pondrá en contacto contigo muy pronto.`
          : `Got your message. Someone from ${business.name} will be in touch with you shortly.`
    } else {
      // type === 'error' — result.message is already the fallback string
      body = result.message
    }
  } catch (err) {
    logger.error('orchestrator_failed_on_intake', {
      business_id: business.id,
      lead_id: lead.id,
      error: String(err),
    })
    body =
      lead.language === 'es'
        ? `¡Hola! Gracias por contactar a ${business.name}. ¿En qué podemos ayudarte hoy?`
        : `Hey! Thanks for reaching out to ${business.name} — what can we help you with today?`
  }

  try {
    await sendSMS({
      to: lead.phone!,
      from: twilioNumber,
      body,
      business_id: business.id,
      lead_id: lead.id,
    })
  } catch (err) {
    logger.error('initial_sms_failed', {
      business_id: business.id,
      lead_id: lead.id,
      error: String(err),
    })
  }
}

// ── POST /api/leads ───────────────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse<LeadIntakeResponse | ApiError>> {
  const startedAt = Date.now()

  // Rate limit by IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429 },
    )
  }

  // Parse + validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = LeadIntakeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: parsed.error.issues[0]?.message },
      { status: 422 },
    )
  }

  const data = parsed.data

  // Normalize phone to E.164
  const phone = normalizePhone(data.phone)
  if (!phone) {
    return NextResponse.json(
      { error: 'Invalid phone number. Please provide a valid US or international number.' },
      { status: 422 },
    )
  }

  const supabase = getSupabaseServiceClient()

  // Verify the business exists and is active (prevents submitting to fake business_ids)
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id, name, niche, twilio_number, cal_event_type_id, settings, active')
    .eq('id', data.business_id)
    .eq('active', true)
    .maybeSingle()

  if (bizError || !business) {
    logger.warn('lead_intake_invalid_business', { business_id: data.business_id })
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  // Duplicate check: same phone + business in last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: existing } = await supabase
    .from('leads')
    .select('id, status, ai_paused')
    .eq('phone', phone)
    .eq('business_id', data.business_id)
    .gte('created_at', since)
    .maybeSingle()

  if (existing) {
    // Return success but don't create a duplicate — idempotent response.
    logger.info('lead_intake_duplicate', {
      business_id: data.business_id,
      lead_id: existing.id,
      event_type: 'lead_created',
    })
    return NextResponse.json({ success: true, lead_id: existing.id })
  }

  // Detect language from the message
  const spanishSignals = /hola|gracias|ayuda|necesito|tengo|quiero|casa|techo|aire|calor|frio|ñ|¿|¡/i
  const language = data.message && spanishSignals.test(data.message) ? 'es' : 'en'

  // Create the lead record
  const { data: lead, error: insertError } = await supabase
    .from('leads')
    .insert({
      business_id: data.business_id,
      name: data.name ?? null,
      phone,
      email: data.email || null,
      service_type: data.service_type ?? null,
      message: data.message ?? null,
      source: data.source,
      status: 'new',
      language,
      last_contact: new Date().toISOString(),
      metadata: {
        utm_source: data.utm_source,
        utm_medium: data.utm_medium,
        utm_campaign: data.utm_campaign,
        sequence_step: 0,
      },
    })
    .select('id')
    .single()

  if (insertError || !lead) {
    logger.error('lead_intake_db_error', {
      business_id: data.business_id,
      error: insertError?.message,
    })
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }

  // Log analytics event (async, non-blocking)
  void supabase
    .from('analytics_events')
    .insert({
      business_id: data.business_id,
      lead_id: lead.id,
      event_type: 'lead_created',
      properties: { source: data.source, language },
    })

  logger.info('lead_created', {
    business_id: data.business_id,
    lead_id: lead.id,
    event_type: 'lead_created',
    source: data.source,
    language,
    latency_ms: Date.now() - startedAt,
  })

  // Fire CRM webhook (async, non-blocking)
  void fireCrmWebhook({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    business: business as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lead: { id: lead.id, name: data.name ?? null, phone, email: data.email || null, status: 'new', source: data.source, service_type: data.service_type ?? null, language, score: 0 } as any,
    event: 'lead.created',
  })

  // Notify owner of new lead (async, non-blocking)
  if (business.twilio_number) {
    void notifyOwner({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      business: business as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lead: { id: lead.id, name: data.name ?? null, phone, language, source: data.source } as any,
      message: data.message ?? '',
      type: 'new_lead',
    })
  }

  // Fire initial AI response asynchronously — do NOT await, keeps response under 200ms.
  // Only fires if the business has a Twilio number configured.
  if (business.twilio_number) {
    // Construct a minimal lead object for the orchestrator from data we already have.
    const leadForOrchestrator = {
      id: lead.id,
      business_id: data.business_id,
      name: data.name ?? null,
      phone,
      language,
      is_existing_customer: false,
      status: 'new',
      ai_paused: false,
      source: data.source,
      service_type: data.service_type ?? null,
      message: data.message ?? null,
      email: data.email || null,
      metadata: null,
      last_contact: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    fireInitialResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      business: business as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lead: leadForOrchestrator as any,
      twilioNumber: business.twilio_number,
      inboundMessage: data.message ?? '',
    }).catch(() => {}) // errors already logged inside fireInitialResponse
  }

  return NextResponse.json({ success: true, lead_id: lead.id })
}
