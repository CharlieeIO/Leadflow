// Cal.com webhook signature validation.
// Cal.com signs webhook payloads with HMAC-SHA256 using the webhook secret
// configured in Settings → Developer → Webhooks.
// The signature is sent as the X-Cal-Signature-256 header (hex-encoded digest).

export async function validateCalSignature(
  rawBody: string,
  signatureHeader: string,
): Promise<boolean> {
  const secret = process.env.CAL_WEBHOOK_SECRET
  if (!secret) return false

  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
    const computed = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // Cal.com may send the value with or without a "sha256=" prefix
    const received = signatureHeader.replace(/^sha256=/, '')
    return computed === received
  } catch {
    return false
  }
}

// ── Cal.com webhook payload types ─────────────────────────────────────────────

export type CalTriggerEvent =
  | 'BOOKING_CREATED'
  | 'BOOKING_RESCHEDULED'
  | 'BOOKING_CANCELLED'
  | 'MEETING_ENDED'
  | 'BOOKING_REQUESTED'

export interface CalAttendee {
  name: string
  email: string
  phone?: string
  timeZone?: string
}

export interface CalBookingPayload {
  uid: string           // Cal.com booking UID — use for updates/cancellations
  id: number            // Cal.com booking integer ID
  title: string
  startTime: string     // ISO 8601
  endTime: string       // ISO 8601
  duration: number      // minutes
  status: string        // 'ACCEPTED' | 'PENDING' | 'CANCELLED'
  attendees: CalAttendee[]
  organizer: { name: string; email: string }
  location?: string
  cancellationReason?: string
  rescheduled?: boolean
  metadata?: Record<string, string>  // our embedded lead_id + business_id live here
}

export interface CalWebhookPayload {
  triggerEvent: CalTriggerEvent
  createdAt: string
  payload: CalBookingPayload
}
