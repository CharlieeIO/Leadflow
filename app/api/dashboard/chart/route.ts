import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

// GET /api/dashboard/chart
// Returns daily lead counts for the last 14 days.
export async function GET(): Promise<NextResponse> {
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (!business) return NextResponse.json({ days: [] })

  const start = new Date()
  start.setDate(start.getDate() - 13)
  start.setHours(0, 0, 0, 0)

  const { data: leads } = await supabase
    .from('leads')
    .select('created_at')
    .eq('business_id', business.id)
    .gte('created_at', start.toISOString())

  const counts = new Map<string, number>()
  for (const lead of leads ?? []) {
    const date = new Date(lead.created_at).toISOString().slice(0, 10)
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(start.getTime() + i * 86400000)
    const date = d.toISOString().slice(0, 10)
    return { date, count: counts.get(date) ?? 0 }
  })

  return NextResponse.json({ days })
}
