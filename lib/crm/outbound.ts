import { logger } from '@/lib/logger'
import type { Business, Lead, BusinessSettings } from '@/types'

export type CrmEvent =
  | 'lead.created'
  | 'lead.booked'
  | 'lead.escalated'
  | 'lead.opted_out'
  | 'lead.qualified'

export interface CrmPayload {
  event: CrmEvent
  occurred_at: string
  business: {
    id: string
    name: string
  }
  lead: {
    id: string
    name: string | null
    phone: string
    email: string | null
    status: string
    source: string
    service_type: string | null
    language: string
    score: number
  }
  data?: Record<string, unknown>
}

// Fires a webhook to the business's configured CRM URL.
// Never throws — a CRM failure must never break the lead flow.
export async function fireCrmWebhook(params: {
  business: Business
  lead: Lead
  event: CrmEvent
  data?: Record<string, unknown>
}): Promise<void> {
  const { business, lead, event, data } = params
  const settings = business.settings as BusinessSettings
  const url = settings.crm_webhook_url

  if (!url) return

  const payload: CrmPayload = {
    event,
    occurred_at: new Date().toISOString(),
    business: {
      id: business.id,
      name: business.name,
    },
    lead: {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      status: lead.status,
      source: lead.source,
      service_type: lead.service_type,
      language: lead.language,
      score: lead.score,
    },
    ...(data ? { data } : {}),
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      logger.warn('crm_webhook_non_ok', {
        business_id: business.id,
        event,
        status: res.status,
        url,
      })
    } else {
      logger.info('crm_webhook_fired', { business_id: business.id, event })
    }
  } catch (err) {
    logger.warn('crm_webhook_failed', {
      business_id: business.id,
      event,
      error: String(err),
    })
  }
}
