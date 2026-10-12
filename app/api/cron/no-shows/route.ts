import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/twilio/sender'
import { notifyOwner } from '@/lib/notifications/owner'
import { logger } from '@/lib/logger'
import type { Business, BusinessSettings } from '@/types'

// GET /api/cron/no-shows
// Runs every 30 minutes. Detects appointments that passed without being marked complete.
// Marks them no_show, notifies owner, and re-engages the lead via SMS.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const now = new Date()

  // Find confirmed appointments that ended more than 30 minutes ago
  const cutoff = new Date(now.getTime() - 30 * 60 * 1000).toISOString()
  // Don't look back more than 48 hours (avoids processing old records repeatedly)
  const lookback = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select(`
      id, lead_id, business_id, scheduled_at, duration_minutes,
      businesses!inner(id, name, niche, twilio_number, cal_event_type_id, settings, active, owner_user_id, retell_agent_id, created_at, updated_at),
      leads!inner(id, phone, language, name, status, ai_paused)
    `)
    .eq('status', 'confirmed')
    .lte('scheduled_at', cutoff)
    .gte('scheduled_at', lookback)

  if (error) {
    logger.error('no_show_query_failed', { error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let marked = 0

  for (const appt of appointments ?? []) {
    const business = appt.businesses as unknown as Business
    const lead = appt.leads as unknown as { id: string; phone: string; language: string; name: string | null; status: string; ai_paused: boolean }

    // Mark appointment as no_show
    void supabase
      .from('appointments')
      .update({ status: 'no_show' })
      .eq('id', appt.id)

    // Mark lead as no_show status, re-enable AI for re-engagement
    void supabase
      .from('leads')
      .update({ status: 'no_show', ai_paused: false })
      .eq('id', lead.id)

    // Notify owner
    void notifyOwner({
      business,
      lead: lead as never,
      message: `No-show for appointment at ${new Date(appt.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
      type: 'no_show',
    })

    // Re-engage lead via SMS
    if (business.twilio_number && lead.phone) {
      const settings = business.settings as BusinessSettings
      const personaName = settings.ai_persona_name ?? 'the team'
      const message =
        lead.language === 'es'
          ? `Hola${lead.name ? ` ${lead.name}` : ''}, notamos que no pudiste llegar a tu cita con ${business.name}. ¿Te gustaría reagendar?`
          : `Hey${lead.name ? ` ${lead.name}` : ''}, we noticed you weren't able to make your appointment with ${business.name}. Want to find another time that works?`

      try {
        await sendSMS({
          to: lead.phone,
          from: business.twilio_number,
          body: message,
          business_id: business.id,
          lead_id: lead.id,
        })

        void supabase.from('conversations').insert({
          lead_id: lead.id,
          business_id: business.id,
          direction: 'outbound',
          body: message,
          channel: 'sms',
          ai_generated: false,
          twilio_sid: null,
        })

        logger.info('no_show_reengaged', { appointment_id: appt.id, lead_id: lead.id })
      } catch (err) {
        logger.error('no_show_sms_failed', { appointment_id: appt.id, lead_id: lead.id, error: String(err) })
      }
    }

    marked++
  }

  logger.info('no_show_cron_complete', { marked })
  return NextResponse.json({ ok: true, marked })
}
