import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/twilio/sender'
import { logger } from '@/lib/logger'

// ── GET /api/cron/reminders ───────────────────────────────────────────────────
// Runs every hour via Vercel Cron. Sends 24h and 2h appointment reminders.
// The proxy.ts middleware validates Authorization: Bearer ADMIN_SECRET.
export async function GET(_request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now()
  const supabase = getSupabaseServiceClient()
  let sent24h = 0
  let sent2h = 0

  const now = Date.now()

  // ── 24-hour reminders ─────────────────────────────────────────────────────
  // Window: appointments scheduled 22–26 hours from now (gives a 4h catch window
  // so hourly crons don't miss the slot due to timing drift).
  const window24hStart = new Date(now + 22 * 60 * 60 * 1000).toISOString()
  const window24hEnd   = new Date(now + 26 * 60 * 60 * 1000).toISOString()

  const { data: upcoming24h, error: err24 } = await supabase
    .from('appointments')
    .select('id, lead_id, business_id, scheduled_at, businesses!inner(name, twilio_number), leads!inner(phone, language, name)')
    .eq('status', 'confirmed')
    .eq('reminder_24h_sent', false)
    .gte('scheduled_at', window24hStart)
    .lte('scheduled_at', window24hEnd)

  if (err24) {
    logger.error('reminders_24h_query_failed', { error: err24.message })
  }

  for (const appt of upcoming24h ?? []) {
    const business = appt.businesses as unknown as { name: string; twilio_number: string | null }
    const lead = appt.leads as unknown as { phone: string; language: string; name: string | null }

    if (!business.twilio_number || !lead.phone) continue

    const scheduledAt = new Date(appt.scheduled_at)
    const formattedTime = scheduledAt.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })

    const message =
      lead.language === 'es'
        ? `Recordatorio: tienes una cita con ${business.name} mañana a las ${formattedTime}. ¡Te esperamos!`
        : `Reminder: you have an appointment with ${business.name} tomorrow at ${formattedTime}. See you then!`

    try {
      await sendSMS({
        to: lead.phone,
        from: business.twilio_number,
        body: message,
        business_id: appt.business_id,
        lead_id: appt.lead_id,
      })

      void supabase
        .from('appointments')
        .update({ reminder_24h_sent: true })
        .eq('id', appt.id)

      void supabase.from('conversations').insert({
        lead_id: appt.lead_id,
        business_id: appt.business_id,
        direction: 'outbound',
        body: message,
        channel: 'sms',
        ai_generated: false,
        twilio_sid: null,
      })

      sent24h++
      logger.info('reminder_24h_sent', { appointment_id: appt.id, lead_id: appt.lead_id })
    } catch (err) {
      logger.error('reminder_24h_failed', {
        appointment_id: appt.id,
        lead_id: appt.lead_id,
        error: String(err),
      })
    }
  }

  // ── 2-hour reminders ──────────────────────────────────────────────────────
  // Window: appointments scheduled 1–3 hours from now.
  const window2hStart = new Date(now + 1 * 60 * 60 * 1000).toISOString()
  const window2hEnd   = new Date(now + 3 * 60 * 60 * 1000).toISOString()

  const { data: upcoming2h, error: err2 } = await supabase
    .from('appointments')
    .select('id, lead_id, business_id, scheduled_at, businesses!inner(name, twilio_number), leads!inner(phone, language, name)')
    .eq('status', 'confirmed')
    .eq('reminder_2h_sent', false)
    .gte('scheduled_at', window2hStart)
    .lte('scheduled_at', window2hEnd)

  if (err2) {
    logger.error('reminders_2h_query_failed', { error: err2.message })
  }

  for (const appt of upcoming2h ?? []) {
    const business = appt.businesses as unknown as { name: string; twilio_number: string | null }
    const lead = appt.leads as unknown as { phone: string; language: string; name: string | null }

    if (!business.twilio_number || !lead.phone) continue

    const message =
      lead.language === 'es'
        ? `Recordatorio: tu cita con ${business.name} es en aproximadamente 2 horas. ¡Hasta pronto!`
        : `Just a heads-up — your appointment with ${business.name} is in about 2 hours. See you soon!`

    try {
      await sendSMS({
        to: lead.phone,
        from: business.twilio_number,
        body: message,
        business_id: appt.business_id,
        lead_id: appt.lead_id,
      })

      void supabase
        .from('appointments')
        .update({ reminder_2h_sent: true })
        .eq('id', appt.id)

      void supabase.from('conversations').insert({
        lead_id: appt.lead_id,
        business_id: appt.business_id,
        direction: 'outbound',
        body: message,
        channel: 'sms',
        ai_generated: false,
        twilio_sid: null,
      })

      sent2h++
      logger.info('reminder_2h_sent', { appointment_id: appt.id, lead_id: appt.lead_id })
    } catch (err) {
      logger.error('reminder_2h_failed', {
        appointment_id: appt.id,
        lead_id: appt.lead_id,
        error: String(err),
      })
    }
  }

  const durationMs = Date.now() - startedAt
  logger.info('reminders_cron_complete', { sent_24h: sent24h, sent_2h: sent2h, duration_ms: durationMs })

  return NextResponse.json({ ok: true, sent_24h: sent24h, sent_2h: sent2h, duration_ms: durationMs })
}
