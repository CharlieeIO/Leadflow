import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/twilio/sender'
import { logger } from '@/lib/logger'
import type { BusinessSettings } from '@/types'

const Schema = z.object({ message: z.string().min(1).max(1600) })

// POST /api/leads/[id]/reply — send a manual SMS reply as the business owner
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Message required' }, { status: 422 })

  const service = getSupabaseServiceClient()

  // Load business via server client (RLS-checked user) then service client for lead
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, twilio_number, settings')
    .eq('owner_user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (!business?.twilio_number) {
    return NextResponse.json({ error: 'No Twilio number configured' }, { status: 400 })
  }

  const { data: lead } = await service
    .from('leads')
    .select('id, phone, business_id, ai_paused')
    .eq('id', id)
    .eq('business_id', business.id)
    .maybeSingle()

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const { message } = parsed.data

  // Send SMS
  try {
    await sendSMS({
      to: lead.phone,
      from: business.twilio_number,
      body: message,
      business_id: business.id,
      lead_id: lead.id,
    })
  } catch (err) {
    logger.error('manual_reply_sms_failed', { business_id: business.id, lead_id: id, error: String(err) })
    return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 })
  }

  // Save to conversations
  const { data: convo } = await service
    .from('conversations')
    .insert({
      lead_id: id,
      business_id: business.id,
      direction: 'outbound',
      body: message,
      channel: 'sms',
      ai_generated: false,
    })
    .select('id, direction, body, channel, ai_generated, created_at')
    .single()

  // Update last_contact
  void service
    .from('leads')
    .update({ last_contact: new Date().toISOString() })
    .eq('id', id)

  const settings = business.settings as BusinessSettings
  logger.info('manual_reply_sent', { business_id: business.id, lead_id: id })

  return NextResponse.json({ ok: true, message: convo, persona: settings.ai_persona_name ?? 'You' })
}
