import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { DashboardStats, BusinessSettings } from '@/types'

// GET /api/dashboard/stats
// Returns stat card data for the dashboard home page.
// Compares current 7 days vs previous 7 days for change indicators.
export async function GET(): Promise<NextResponse> {
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: business } = await supabase
    .from('businesses')
    .select('id, settings')
    .eq('owner_user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const settings = business.settings as BusinessSettings | undefined
  const avgJobValue = settings?.avg_job_value ?? 0

  const now = new Date()
  const day7 = new Date(now.getTime() - 7 * 86400000).toISOString()
  const day14 = new Date(now.getTime() - 14 * 86400000).toISOString()

  // Leads: current & previous 7 days
  const [{ count: leadsNow }, { count: leadsPrev }] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).gte('created_at', day7),
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).gte('created_at', day14).lt('created_at', day7),
  ])

  // Appointments booked: current & previous 7 days
  const [{ count: apptNow }, { count: apptPrev }] = await Promise.all([
    supabase.from('appointments').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).gte('created_at', day7),
    supabase.from('appointments').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).gte('created_at', day14).lt('created_at', day7),
  ])

  // Avg AI response time (latency_ms) last 7 days
  const { data: interactions } = await supabase
    .from('ai_interactions')
    .select('latency_ms')
    .eq('business_id', business.id)
    .gte('created_at', day7)
    .not('latency_ms', 'is', null)

  const avgMs = interactions?.length
    ? interactions.reduce((s, r) => s + (r.latency_ms ?? 0), 0) / interactions.length
    : 0

  // Conversion rate = booked / total leads (all time for this business)
  const [{ count: totalLeads }, { count: totalBooked }] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).eq('status', 'booked'),
  ])

  function pct(a: number | null, b: number | null) {
    const prev = b ?? 0
    const curr = a ?? 0
    if (prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 100)
  }

  const bookedThisMonth = apptNow ?? 0
  const revenueThisMonth = bookedThisMonth * avgJobValue

  const stats: DashboardStats = {
    totalLeads: leadsNow ?? 0,
    totalLeadsChange: pct(leadsNow, leadsPrev),
    appointmentsBooked: apptNow ?? 0,
    appointmentsChange: pct(apptNow, apptPrev),
    avgResponseTimeMinutes: Math.round(avgMs / 60000 * 10) / 10,
    avgResponseTimeChange: 0,
    conversionRate: totalLeads ? Math.round(((totalBooked ?? 0) / totalLeads) * 1000) / 10 : 0,
    conversionRateChange: 0,
    revenueThisMonth,
    avgJobValue,
  }

  return NextResponse.json(stats)
}
