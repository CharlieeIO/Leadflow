import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/twilio/sender'
import { generateQualificationResponse } from '@/lib/claude/orchestrator'
import { logger } from '@/lib/logger'
import type { Business, Lead, Conversation, AutomationTrigger } from '@/types'

// ── Sequence stages ───────────────────────────────────────────────────────────
// sequence_step tracks which follow-ups have been sent for a lead.
// Step 0 = no follow-ups sent yet.  Step 3 = all three sent (AI stops).

interface SequenceStage {
  step: number
  trigger: AutomationTrigger
  minHours: number   // hours since last_contact to qualify
  maxHours: number   // cap — don't send if the window has passed
}

const STAGES: SequenceStage[] = [
  { step: 0, trigger: 'no_response_4h',  minHours: 4,  maxHours: 8  },
  { step: 1, trigger: 'no_response_24h', minHours: 24, maxHours: 30 },
  { step: 2, trigger: 'no_response_72h', minHours: 72, maxHours: 80 },
]

const SKIP_STATUSES = ['booked', 'opted_out', 'escalated', 'completed', 'lost']

// ── GET /api/cron/sequences ───────────────────────────────────────────────────
// Runs hourly via Vercel Cron. The proxy.ts middleware validates
// Authorization: Bearer ADMIN_SECRET before this handler executes.
export async function GET(_request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now()
  const supabase = getSupabaseServiceClient()
  let totalSent = 0
  let totalSkipped = 0

  for (const stage of STAGES) {
    const minAgo = new Date(Date.now() - stage.minHours * 60 * 60 * 1000).toISOString()
    const maxAgo = new Date(Date.now() - stage.maxHours * 60 * 60 * 1000).toISOString()

    // Leads whose last_contact falls inside this stage's time window
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*, businesses!inner(id, name, niche, twilio_number, cal_event_type_id, settings, active, owner_user_id, retell_agent_id, created_at, updated_at)')
      .gte('last_contact', maxAgo)
      .lte('last_contact', minAgo)
      .eq('ai_paused', false)
      .not('status', 'in', `(${SKIP_STATUSES.join(',')})`)

    if (error) {
      logger.error('sequence_cron_query_failed', { stage: stage.trigger, error: error.message })
      continue
    }

    for (const row of leads ?? []) {
      const lead = row as Lead & { businesses: Business }
      const business = lead.businesses
      const meta = (lead.metadata ?? {}) as Record<string, unknown>
      const currentStep = (meta.sequence_step as number | undefined) ?? 0

      if (currentStep !== stage.step || !business?.twilio_number || !business.active) {
        totalSkipped++
        continue
      }

      // If the most recent conversation is inbound, the lead replied —
      // the SMS webhook already responded. Advance step and skip.
      const { data: lastMsg } = await supabase
        .from('conversations')
        .select('direction')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastMsg?.direction === 'inbound') {
        void supabase
          .from('leads')
          .update({ metadata: { ...meta, sequence_step: stage.step + 1 } })
          .eq('id', lead.id)
        totalSkipped++
        continue
      }

      // Prefer owner-written automation message; fall back to AI
      const { data: automation } = await supabase
        .from('automations')
        .select('message_en, message_es')
        .eq('business_id', business.id)
        .eq('trigger_type', stage.trigger)
        .eq('active', true)
        .maybeSingle()

      let outboundBody: string

      if (automation?.message_en) {
        outboundBody =
          lead.language === 'es' && automation.message_es
            ? automation.message_es
            : automation.message_en
      } else {
        const { data: historyRows } = await supabase
          .from('conversations')
          .select('id, lead_id, business_id, direction, body, channel, ai_generated, twilio_sid, created_at')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: false })
          .limit(10)

        const history = ((historyRows ?? []) as Conversation[]).reverse()

        const followUpPrompt =
          lead.language === 'es'
            ? `El cliente no ha respondido en ${stage.minHours} horas. Envía un seguimiento breve para ver si aún están interesados.`
            : `The lead hasn't replied in ${stage.minHours} hours. Send a brief, friendly follow-up to see if they're still interested.`

        const result = await generateQualificationResponse({
          business,
          lead,
          inboundMessage: followUpPrompt,
          conversationHistory: history,
        })

        if (result.type === 'escalate') {
          void supabase
            .from('leads')
            .update({ status: 'escalated', escalation_reason: result.reason, ai_paused: true })
            .eq('id', lead.id)
          totalSkipped++
          continue
        }

        outboundBody = result.message
      }

      // Save outbound message
      const { data: outboundMsg } = await supabase
        .from('conversations')
        .insert({
          lead_id: lead.id,
          business_id: business.id,
          direction: 'outbound',
          body: outboundBody,
          channel: 'sms',
          ai_generated: !automation?.message_en,
          twilio_sid: null,
        })
        .select('id')
        .single()

      try {
        const sent = await sendSMS({
          to: lead.phone,
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

        void supabase
          .from('leads')
          .update({
            last_contact: new Date().toISOString(),
            metadata: {
              ...meta,
              sequence_step: stage.step + 1,
              last_sequence_sent_at: new Date().toISOString(),
            },
          })
          .eq('id', lead.id)

        void supabase.from('analytics_events').insert({
          business_id: business.id,
          lead_id: lead.id,
          event_type: 'sms_sent',
          properties: { trigger: stage.trigger, sequence_step: stage.step },
        })

        totalSent++
        logger.info('sequence_sent', {
          business_id: business.id,
          lead_id: lead.id,
          trigger: stage.trigger,
          step: stage.step,
        })
      } catch (err) {
        logger.error('sequence_sms_failed', {
          business_id: business.id,
          lead_id: lead.id,
          error: String(err),
        })
      }
    }
  }

  const durationMs = Date.now() - startedAt
  logger.info('sequence_cron_complete', { total_sent: totalSent, total_skipped: totalSkipped, duration_ms: durationMs })

  return NextResponse.json({ ok: true, sent: totalSent, skipped: totalSkipped, duration_ms: durationMs })
}
