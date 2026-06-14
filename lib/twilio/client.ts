import twilio from 'twilio'

// Singleton Twilio client. Twilio's SDK is safe to reuse across requests.
// Throws at startup if credentials are missing — fail fast rather than at send time.
let _client: ReturnType<typeof twilio> | null = null

export function getTwilioClient(): ReturnType<typeof twilio> {
  if (_client) return _client

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set')
  }

  _client = twilio(accountSid, authToken)
  return _client
}
