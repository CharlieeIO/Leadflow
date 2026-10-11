import twilio from 'twilio'

// Singleton for the platform's own Twilio account.
let _platformClient: ReturnType<typeof twilio> | null = null

export function getTwilioClient(): ReturnType<typeof twilio> {
  if (_platformClient) return _platformClient

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set')
  }

  _platformClient = twilio(accountSid, authToken)
  return _platformClient
}

// Returns a Twilio client for a specific business's own account when they've
// provided their own credentials (skeptical customers who want to own their number).
// Falls back to the platform client when no per-business credentials are set.
export function getTwilioClientForBusiness(opts?: {
  accountSid?: string | null
  authToken?: string | null
}): ReturnType<typeof twilio> {
  if (opts?.accountSid && opts?.authToken) {
    return twilio(opts.accountSid, opts.authToken)
  }
  return getTwilioClient()
}

// Returns the auth token to use for validating Twilio webhook signatures for a
// given business — their own token if they have one, else the platform token.
export function getTwilioAuthTokenForBusiness(opts?: {
  authToken?: string | null
}): string {
  if (opts?.authToken) return opts.authToken
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!token) throw new Error('TWILIO_AUTH_TOKEN must be set')
  return token
}
