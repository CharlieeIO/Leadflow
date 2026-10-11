import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import type { DashboardStats, BusinessSettings } from '@/types'

// GET /api/dashboard/stats
// Returns stat card data for the dashboard home page.
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

  const avgJobValue = (business.settings as BusinessSettings | null)?.avg_job_value ?? 0
  const stats = await getCachedStats(business.id, avgJobValue)
  return NextResponse.json(stats)
}

// Cached 30 seconds per business to cut cold-start DB round-trips.
const getCachedStats = unstable_cache(
  async (businessId: string, avgJobValue: number): Promise<DashboardStats> => {
    const supabase = getSupabaseServiceClient()

    const now = new Date()
    const day7  = new Date(now.getTime() -  7 * 86400000).toISOString()
    const day14 = new Date(now.getTime() - 14 * 86400000).toISOString()

    const [
      { count: leadsNow },
      { count: leadsPrev },
      { count: apptNow },
      { count: apptPrev },
      { data: interactions },
      { count: totalLeads },
      { count: totalBooked },
    ] = await Promise.all([
      supabase.from('leads').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).gte('created_at', day7),
      supabase.from('leads').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).gte('created_at', day14).lt('created_at', day7),
      supabase.from('appointments').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).gte('created_at', day7),
      supabase.from('appointments').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).gte('created_at', day14).lt('created_at', day7),
      supabase.from('ai_interactions').select('latency_ms')
        .eq('business_id', businessId).gte('created_at', day7).not('latency_ms', 'is', null),
      supabase.from('leads').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId),
      supabase.from('leads').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).eq('status', 'booked'),
    ])

    const avgMs = interactions?.length
      ? interactions.reduce((s, r) => s + (r.latency_ms ?? 0), 0) / interactions.length
      : 0

    function pct(a: number | null, b: number | null) {
      const prev = b ?? 0
      const curr = a ?? 0
      if (prev === 0) return curr > 0 ? 100 : 0
      return Math.round(((curr - prev) / prev) * 100)
    }

    return {
      totalLeads: leadsNow ?? 0,
      totalLeadsChange: pct(leadsNow, leadsPrev),
      appointmentsBooked: apptNow ?? 0,
      appointmentsChange: pct(apptNow, apptPrev),
      avgResponseTimeMinutes: Math.round(avgMs / 60000 * 10) / 10,
      avgResponseTimeChange: 0,
      conversionRate: totalLeads ? Math.round(((totalBooked ?? 0) / totalLeads) * 1000) / 10 : 0,
      conversionRateChange: 0,
      revenueThisMonth: (apptNow ?? 0) * avgJobValue,
      avgJobValue,
    }
  },
  ['dashboard-stats'],
  { revalidate: 30 },
)
