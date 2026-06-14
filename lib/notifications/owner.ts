import { sendSMS } from '@/lib/twilio/sender'
import { logger } from '@/lib/logger'
import type { NotifyOwnerOptions, BusinessSettings } from '@/types'

// ── Message builders ──────────────────────────────────────────────────────────

function buildMessage(options: NotifyOwnerOptions): string {
  const { type, lead, business, message, context } = options
  const phone = lead.phone ?? 'unknown'
  const name = lead.name ? `${lead.name} (${phone})` : phone

  switch (type) {
    case 'escalation':
      return `⚠️ ESCALATION — ${name}\nReason: ${message}\nReply to lead directly: ${phone}`

    case 'booking':
      return `✅ BOOKING — ${name} just booked with ${business.name}${context?.time ? `\nTime: ${context.time}` : ''}`

    case 'new_lead':
      return `🔔 NEW LEAD — ${name}${lead.source ? ` via ${lead.source.replace('_', ' ')}` : ''}\n${message || 'Ready for AI qualification.'}`

    case 'missed_call':
      return `📞 MISSED CALL — ${phone} called ${business.name} and no one answered.\nAI sent a follow-up SMS.`

    case 'ai_error':
      return `🤖 AI ERROR — ${business.name}\n${message}`

    case 'no_show':
      return `❌ NO SHOW — ${name} missed their appointment with ${business.name}.`

    default:
      return `[${type.toUpperCase()}] ${message}`
  }
}

function buildSlackPayload(options: NotifyOwnerOptions, smsMessage: string): Record<string, unknown> {
  return {
    text: smsMessage,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: smsMessage.replace(/\n/g, '\n'),
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*Business:* ${options.business.name} | *Lead ID:* ${options.lead.id}`,
          },
        ],
      },
    ],
  }
}

// ── Main notifier ─────────────────────────────────────────────────────────────
// Fires SMS and/or Slack depending on what the business has configured.
// Never throws — notification failure must not break the calling webhook.
export async function notifyOwner(options: NotifyOwnerOptions): Promise<void> {
  const { business, lead } = options
  const settings = business.settings as BusinessSettings

  const message = buildMessage(options)

  const promises: Promise<void>[] = []

  // ── SMS to owner ────────────────────────────────────────────────────────────
  if (settings.notification_phone && business.twilio_number) {
    promises.push(
      sendSMS({
        to: settings.notification_phone,
        from: business.twilio_number,
        body: message,
        business_id: business.id,
        lead_id: lead.id,
      })
        .then(() => {
          logger.info('owner_notified_sms', {
            business_id: business.id,
            lead_id: lead.id,
            type: options.type,
          })
        })
        .catch((err: unknown) => {
          logger.error('owner_notify_sms_failed', {
            business_id: business.id,
            lead_id: lead.id,
            error: String(err),
          })
        }),
    )
  }

  // ── Slack webhook ───────────────────────────────────────────────────────────
  if (settings.slack_webhook) {
    promises.push(
      fetch(settings.slack_webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSlackPayload(options, message)),
        signal: AbortSignal.timeout(5_000),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`Slack returned ${res.status}`)
          logger.info('owner_notified_slack', {
            business_id: business.id,
            lead_id: lead.id,
            type: options.type,
          })
        })
        .catch((err: unknown) => {
          logger.error('owner_notify_slack_failed', {
            business_id: business.id,
            lead_id: lead.id,
            error: String(err),
          })
        }),
    )
  }

  await Promise.all(promises)
}
