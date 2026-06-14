import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type ServiceStatus = 'ok' | 'warn' | 'error' | 'unknown'

interface ServiceCheck {
  name: string
  status: ServiceStatus
  detail: string
}

// GET /api/dashboard/status
// Returns service health and recent activity for the status panel.
export async function GET(): Promise<NextResponse> {
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: business } = await supabase
    .from('businesses')
    .select('id, twilio_number, retell_agent_id, cal_event_type_id, settings')
    .eq('owner_user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const services: ServiceCheck[] = []

  // Twilio
  const twilioOk = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && business.twilio_number)
  services.push({
    name: 'Twilio SMS',
    status: twilioOk ? 'ok' : (process.env.TWILIO_ACCOUNT_SID ? 'warn' : 'unknown'),
    detail: twilioOk ? (business.twilio_number ?? '') : (!process.env.TWILIO_ACCOUNT_SID ? 'API keys not set' : 'No phone number assigned'),
  })

  // Anthropic AI
  const anthropicOk = !!process.env.ANTHROPIC_API_KEY
  services.push({
    name: 'AI (Anthropic)',
    status: anthropicOk ? 'ok' : 'unknown',
    detail: anthropicOk ? 'API key configured' : 'ANTHROPIC_API_KEY not set',
  })

  // Cal.com
  const calOk = !!(process.env.CAL_WEBHOOK_SECRET && business.cal_event_type_id)
  services.push({
    name: 'Cal.com',
    status: calOk ? 'ok' : (process.env.CAL_WEBHOOK_SECRET ? 'warn' : 'unknown'),
    detail: calOk ? `Event type ${business.cal_event_type_id}` : (!process.env.CAL_WEBHOOK_SECRET ? 'Webhook secret not set' : 'No event type ID'),
  })

  // Retell Voice
  const retellOk = !!(process.env.RETELL_API_KEY && business.retell_agent_id)
  services.push({
    name: 'Retell Voice',
    status: retellOk ? 'ok' : (process.env.RETELL_API_KEY ? 'warn' : 'unknown'),
    detail: retellOk ? `Agent ${business.retell_agent_id}` : (!process.env.RETELL_API_KEY ? 'API key not set' : 'No agent ID assigned'),
  })

  // Recent activity
  const [{ data: lastLeadRow }, { data: lastAiRow }] = await Promise.all([
    supabase
      .from('leads')
      .select('created_at')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('ai_interactions')
      .select('created_at')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  function relativeTime(iso: string | null): string | null {
    if (!iso) return null
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return NextResponse.json({
    services,
    lastLead: relativeTime(lastLeadRow?.created_at ?? null),
    lastAiMessage: relativeTime(lastAiRow?.created_at ?? null),
    checkedAt: new Date().toISOString(),
  })
}
