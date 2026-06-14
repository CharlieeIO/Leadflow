// Retell AI API client
// Docs: https://docs.retellai.com
// Used for: registering inbound Twilio calls so Retell's AI agent answers them.

const RETELL_BASE_URL = 'https://api.retellai.com'

function getApiKey(): string {
  const key = process.env.RETELL_API_KEY
  if (!key) throw new Error('RETELL_API_KEY is not set')
  return key
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RegisterCallParams {
  agentId: string
  fromNumber: string   // caller's E.164 number
  toNumber: string     // business Twilio number (E.164)
  metadata?: Record<string, unknown>
}

export interface RegisterCallResult {
  callId: string
  accessToken: string  // used as path param in the Twilio <Stream> WebSocket URL
}

// ── Register an inbound Twilio call with Retell ───────────────────────────────
// Must be called within the Twilio voice webhook before returning TwiML.
// Returns the access_token needed to build the <Stream> WebSocket URL.
export async function registerRetellCall(params: RegisterCallParams): Promise<RegisterCallResult> {
  const { agentId, fromNumber, toNumber, metadata } = params

  const res = await fetch(`${RETELL_BASE_URL}/register-call`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_id: agentId,
      audio_websocket_protocol: 'twilio',
      audio_encoding: 'mulaw',
      sample_rate: 8000,
      from_number: fromNumber,
      to_number: toNumber,
      retell_llm_dynamic_variables: metadata ?? {},
    }),
    signal: AbortSignal.timeout(5_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)')
    throw new Error(`Retell register-call failed ${res.status}: ${text}`)
  }

  const data = await res.json() as { call_id: string; access_token: string }
  return { callId: data.call_id, accessToken: data.access_token }
}

// ── Validate Retell webhook signature ─────────────────────────────────────────
// Retell signs the raw request body with HMAC-SHA256 using your API key.
// The signature is sent as the x-retell-signature header (base64-encoded).
export async function validateRetellSignature(
  rawBody: string,
  signatureHeader: string,
): Promise<boolean> {
  try {
    const key = getApiKey()
    const encoder = new TextEncoder()
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(key),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(rawBody))
    const computed = btoa(String.fromCharCode(...new Uint8Array(sig)))
    return computed === signatureHeader
  } catch {
    return false
  }
}
