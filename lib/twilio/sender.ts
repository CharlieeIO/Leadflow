import { getTwilioClient } from './client'
import { logger } from '@/lib/logger'

export interface SendSMSOptions {
  to: string          // E.164 recipient number
  from: string        // E.164 Twilio number
  body: string        // Message text (max 1600 chars, 160 per segment)
  business_id?: string
  lead_id?: string
}

export interface SendSMSResult {
  success: true
  sid: string
}

// Sends an SMS with up to 3 attempts using exponential backoff.
// Retries on: 429 (rate limit), 5xx (Twilio server errors).
// Hard fails on: 4xx validation errors (bad number, unsubscribed, etc.) —
// retrying those would just waste money.
export async function sendSMS(options: SendSMSOptions): Promise<SendSMSResult> {
  const { to, from, body, business_id, lead_id } = options
  const maxAttempts = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const client = getTwilioClient()

      const message = await client.messages.create({
        to,
        from,
        body,
      })

      logger.info('sms_sent', {
        business_id,
        lead_id,
        event_type: 'sms_sent',
        sid: message.sid,
        to,
        attempt,
      })

      return { success: true, sid: message.sid }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err))

      // Twilio SDK errors have a `status` property with the HTTP status code.
      const status = (err as { status?: number }).status ?? 0

      const isRetryable = status === 429 || status >= 500

      if (!isRetryable || attempt === maxAttempts) {
        logger.error('sms_send_failed', {
          business_id,
          lead_id,
          event_type: 'sms_send_failed',
          to,
          attempt,
          status,
          error: lastError.message,
        })
        throw lastError
      }

      // Exponential backoff: 500ms, 1000ms, 2000ms
      const delayMs = 500 * Math.pow(2, attempt - 1)
      logger.warn('sms_retry', {
        business_id,
        lead_id,
        attempt,
        status,
        delay_ms: delayMs,
      })
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }

  // TypeScript requires this even though the loop above always throws or returns.
  throw lastError ?? new Error('sendSMS: unexpected exit')
}
