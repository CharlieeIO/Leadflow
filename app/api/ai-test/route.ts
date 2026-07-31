import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { buildSystemPrompt } from '@/lib/claude/prompts'
import type { Business, BusinessSettings, Lead } from '@/types'

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, tone_level } = await request.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (!business) return NextResponse.json({ error: 'No business found' }, { status: 404 })

  // Inject the current tone level being tested
  const businessWithTone: Business = {
    ...business as Business,
    settings: {
      ...(business.settings as BusinessSettings),
      ai_tone_level: tone_level ?? 50,
    },
  }

  const fakeLead: Lead = {
    id: 'test',
    business_id: business.id,
    name: 'Test Lead',
    phone: '+10000000000',
    email: null,
    service_type: null,
    message: null,
    source: 'sms_inbound',
    status: 'new',
    score: 0,
    language: 'en',
    ai_paused: false,
    is_existing_customer: false,
    escalation_reason: null,
    last_contact: null,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const systemPrompt = buildSystemPrompt({
    business: businessWithTone,
    lead: fakeLead,
    language: 'en',
    isExistingCustomer: false,
    bookingLink: (business.settings as BusinessSettings).booking_link ?? null,
  })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 200,
    system: systemPrompt,
    messages: [{ role: 'user', content: message.trim() }],
  })

  const text = response.content.find((b) => b.type === 'text')?.text ?? ''
  return NextResponse.json({ response: text })
}
