import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/twilio/sender'
import { validateCalSignature, type CalWebhookPayload, type CalAttendee } from '@/lib/cal/client'
import { notifyOwner } from '@/lib/notifications/owner'
import { fireCrmWebhook } from '@/lib/crm/outbound'
import { logger } from '@/lib/logger'
import type { Business, Lead } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok() {
  return NextResponse.json({ ok: true })
}

// Format a UTC ISO date into a readable local string for SMS.
// Cal.com gives us UTC; we show it as-is and let the lead's timezone handle display.
function formatBookingTime(isoString: string, timeZone?: string): string {
  try {
    return new Date(isoString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timeZone ?? 'UTC',
      timeZoneName: 'short',
    })
  } catch {
    return isoString
  }
}

// ── Find lead from Cal.com booking ────────────────────────────────────────────
// Primary: metadata embedded in the booking link (lead_id + business_id).
// Fallback: match attendee phone or email against leads table.
async function findLead(params: {
  metadata: Record<string, string> | undefined
  attendees: CalAttendee[]
  businessId: string
}): Promise<{ lead: Lead | null; businessId: string }> {
  const supabase = getSupabaseServiceClient()
  const { metadata, attendees, businessId } = params

  // Primary path: we embedded lead_id in the booking URL
  if (metadata?.lead_id) {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('id', metadata.lead_id)
      .maybeSingle()
    if (data) return { lead: data as Lead, businessId }
  }

  // Fallback: match by phone then email
  const attendee = attendees[0]
  if (!attendee) return { lead: null, businessId }

  if (attendee.phone) {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', attendee.phone)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) return { lead: data as Lead, businessId }
  }

  if (attendee.email) {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('email', attendee.email)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) return { lead: data as Lead, businessId }
  }

  return { lead: null, businessId }
}

// ── POST /api/webhooks/cal ────────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text()

  // Validate Cal.com signature (skip in local dev)
  if (process.env.CAL_WEBHOOK_SECRET && process.env.NODE_ENV !== 'development') {
    const sig = request.headers.get('x-cal-signature-256') ?? ''
    const valid = await validateCalSignature(rawBody, sig)
    if (!valid) {
      logger.warn('cal_webhook_invalid_signature')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let event: CalWebhookPayload
  try {
    event = JSON.parse(rawBody) as CalWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { triggerEvent, payload } = event

  if (!['BOOKING_CREATED', 'BOOKING_CANCELLED', 'BOOKING_RESCHEDULED'].includes(triggerEvent)) {
    return ok() // ignore MEETING_ENDED, BOOKING_REQUESTED, etc.
  }

  const supabase = getSupabaseServiceClient()

  // Resolve the business — prefer metadata, fall back to organizer email
  const metaBusinessId = payload.metadata?.business_id
  let businessId = metaBusinessId ?? ''

  if (!businessId) {
    // Best-effort: find business by organizer email
    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('active', true)
      .limit(1)
      .maybeSingle()
    businessId = biz?.id ?? ''
  }

  if (!businessId) {
    logger.warn('cal_webhook_no_business', { uid: payload.uid })
    return ok()
  }

  // Load the full business record
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, twilio_number, settings')
    .eq('id', businessId)
    .maybeSingle()

  if (!business) {
    logger.warn('cal_webhook_business_not_found', { business_id: businessId })
    return ok()
  }

  // ── BOOKING_CREATED ──────────────────────────────────────────────────────────
  if (triggerEvent === 'BOOKING_CREATED') {
    const { lead } = await findLead({
      metadata: payload.metadata,
      attendees: payload.attendees,
      businessId,
    })

    const attendee = payload.attendees[0]
    const attendeeTimeZone = attendee?.timeZone

    // If no matching lead was found, create one from the attendee info.
    // Phone is required — if Cal.com didn't capture it we can't send SMS.
    let resolvedLead = lead
    if (!resolvedLead && attendee?.phone) {
      const { data: newLead } = await supabase
        .from('leads')
        .insert({
          business_id: businessId,
          name: attendee.name ?? null,
          phone: attendee.phone,
          email: attendee.email ?? null,
          source: 'web_form',
          status: 'booked',
          language: 'en',
          last_contact: new Date().toISOString(),
          metadata: { sequence_step: 0 },
        })
        .select('*')
        .single()
      resolvedLead = newLead as Lead | null
    }

    if (!resolvedLead) {
      logger.warn('cal_booking_no_lead_resolved', { cal_uid: payload.uid, business_id: businessId })
      return ok()
    }

    // Create the appointment record
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .insert({
        business_id: businessId,
        lead_id: resolvedLead.id,
        scheduled_at: payload.startTime,
        duration_minutes: payload.duration,
        status: 'confirmed',
        cal_booking_id: String(payload.id),
        cal_booking_uid: payload.uid,
        notes: payload.title,
      })
      .select('id')
      .single()

    if (apptError) {
      logger.error('cal_webhook_appointment_insert_failed', {
        business_id: businessId,
        cal_uid: payload.uid,
        error: apptError.message,
      })
    }

    // Update the lead status to 'booked'
    void supabase
      .from('leads')
      .update({ status: 'booked', last_contact: new Date().toISOString() })
      .eq('id', resolvedLead.id)

    void supabase.from('analytics_events').insert({
      business_id: businessId,
      lead_id: resolvedLead.id,
      event_type: 'appointment_booked',
      properties: { cal_uid: payload.uid, appointment_id: appointment?.id },
    })

    logger.info('cal_booking_created', {
      business_id: businessId,
      lead_id: resolvedLead.id,
      cal_uid: payload.uid,
      scheduled_at: payload.startTime,
    })

    // Notify owner of new booking
    const { data: fullBusiness } = await supabase
      .from('businesses')
      .select('id, name, niche, twilio_number, cal_event_type_id, settings, active, owner_user_id, retell_agent_id, created_at, updated_at')
      .eq('id', businessId)
      .maybeSingle()

    if (fullBusiness) {
      const bookedTime = formatBookingTime(payload.startTime, payload.attendees[0]?.timeZone)
      void notifyOwner({
        business: fullBusiness as Business,
        lead: resolvedLead,
        message: `${resolvedLead.name ?? resolvedLead.phone} booked for ${bookedTime}`,
        type: 'booking',
        context: { time: bookedTime },
      })
      void fireCrmWebhook({
        business: fullBusiness as Business,
        lead: resolvedLead,
        event: 'lead.booked',
        data: { scheduled_at: payload.startTime, booking_time_formatted: bookedTime },
      })
    }

    // Send confirmation SMS to the lead
    if (resolvedLead.phone && business.twilio_number) {
      const formattedTime = formatBookingTime(payload.startTime, attendeeTimeZone)
      const message =
        resolvedLead.language === 'es'
          ? `¡Tu cita con ${business.name} está confirmada para el ${formattedTime}! Te veremos pronto. Responde STOP para cancelar mensajes.`
          : `You're booked with ${business.name} for ${formattedTime}. See you then! Reply STOP to opt out.`

      void sendSMS({
        to: resolvedLead.phone,
        from: business.twilio_number,
        body: message,
        business_id: businessId,
        lead_id: resolvedLead.id,
      }).catch((err: unknown) => {
        logger.error('cal_confirmation_sms_failed', {
          business_id: businessId,
          lead_id: resolvedLead!.id,
          error: String(err),
        })
      })

      void supabase.from('conversations').insert({
        lead_id: resolvedLead.id,
        business_id: businessId,
        direction: 'outbound',
        body: message,
        channel: 'sms',
        ai_generated: false,
        twilio_sid: null,
      })
    }

    return ok()
  }

  // ── BOOKING_CANCELLED ────────────────────────────────────────────────────────
  if (triggerEvent === 'BOOKING_CANCELLED') {
    // Find the appointment by Cal.com UID
    const { data: appointment } = await supabase
      .from('appointments')
      .select('id, lead_id')
      .eq('cal_booking_uid', payload.uid)
      .maybeSingle()

    if (appointment) {
      void supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointment.id)

      // Move lead back to 'contacted' so AI can re-engage
      if (appointment.lead_id) {
        void supabase
          .from('leads')
          .update({ status: 'contacted', last_contact: new Date().toISOString() })
          .eq('id', appointment.lead_id)

        // Notify the lead
        if (business.twilio_number) {
          const { data: lead } = await supabase
            .from('leads')
            .select('phone, language, name')
            .eq('id', appointment.lead_id)
            .maybeSingle()

          if (lead?.phone) {
            const message =
              lead.language === 'es'
                ? `Tu cita con ${business.name} ha sido cancelada. ¿Te gustaría reagendar?`
                : `Your appointment with ${business.name} has been cancelled. Would you like to reschedule?`

            void sendSMS({
              to: lead.phone,
              from: business.twilio_number,
              body: message,
              business_id: businessId,
              lead_id: appointment.lead_id,
            }).catch(() => {})
          }
        }
      }
    }

    logger.info('cal_booking_cancelled', {
      business_id: businessId,
      cal_uid: payload.uid,
      appointment_id: appointment?.id,
    })

    return ok()
  }

  // ── BOOKING_RESCHEDULED ──────────────────────────────────────────────────────
  if (triggerEvent === 'BOOKING_RESCHEDULED') {
    const { data: appointment } = await supabase
      .from('appointments')
      .select('id, lead_id')
      .eq('cal_booking_uid', payload.uid)
      .maybeSingle()

    if (appointment) {
      void supabase
        .from('appointments')
        .update({
          scheduled_at: payload.startTime,
          status: 'confirmed',
          cal_booking_uid: payload.uid, // uid may change on reschedule
        })
        .eq('id', appointment.id)

      // Notify the lead of the new time
      if (appointment.lead_id && business.twilio_number) {
        const { data: lead } = await supabase
          .from('leads')
          .select('phone, language, name')
          .eq('id', appointment.lead_id)
          .maybeSingle()

        if (lead?.phone) {
          const attendee = payload.attendees[0]
          const formattedTime = formatBookingTime(payload.startTime, attendee?.timeZone)
          const message =
            lead.language === 'es'
              ? `Tu cita con ${business.name} ha sido reagendada para el ${formattedTime}. ¡Hasta entonces!`
              : `Your appointment with ${business.name} has been rescheduled to ${formattedTime}. See you then!`

          void sendSMS({
            to: lead.phone,
            from: business.twilio_number,
            body: message,
            business_id: businessId,
            lead_id: appointment.lead_id,
          }).catch(() => {})
        }
      }
    }

    logger.info('cal_booking_rescheduled', {
      business_id: businessId,
      cal_uid: payload.uid,
      new_time: payload.startTime,
    })

    return ok()
  }

  return ok()
}
