import twilio from 'twilio'
import { logger } from '@/lib/logger'

// Searches for an available local number in the given area code (or any US number),
// purchases it, and configures the SMS + voice webhooks to point at this app.
export async function provisionTwilioNumber(params: {
  businessId: string
  areaCode?: string
  appBaseUrl: string
}): Promise<string> {
  const { businessId, areaCode, appBaseUrl } = params

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!,
  )

  // Search for available local numbers
  const searchParams: { smsEnabled: boolean; voiceEnabled: boolean; limit: number; areaCode?: number } = {
    smsEnabled: true,
    voiceEnabled: true,
    limit: 5,
  }
  if (areaCode) searchParams.areaCode = parseInt(areaCode)

  const available = await client.availablePhoneNumbers('US').local.list(searchParams)

  if (!available.length) {
    throw new Error(`No available numbers${areaCode ? ` in area code ${areaCode}` : ''}`)
  }

  const chosen = available[0].phoneNumber

  // Purchase the number and wire webhooks immediately
  const purchased = await client.incomingPhoneNumbers.create({
    phoneNumber: chosen,
    smsUrl: `${appBaseUrl}/api/webhooks/sms`,
    smsMethod: 'POST',
    voiceUrl: `${appBaseUrl}/api/webhooks/voice`,
    voiceMethod: 'POST',
    statusCallback: `${appBaseUrl}/api/webhooks/twilio`,
    statusCallbackMethod: 'POST',
  })

  logger.info('twilio_number_provisioned', {
    business_id: businessId,
    phone_number: purchased.phoneNumber,
    sid: purchased.sid,
  })

  return purchased.phoneNumber
}
