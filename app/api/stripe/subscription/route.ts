import { NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

// GET /api/stripe/subscription — return current subscription for the logged-in business
export async function GET(): Promise<NextResponse> {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = getSupabaseServiceClient()

  const { data: business } = await service
    .from('businesses')
    .select('id')
    .eq('owner_user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const { data: sub } = await service
    .from('subscriptions')
    .select('plan, status, trial_ends_at, current_period_end, stripe_customer_id')
    .eq('business_id', business.id)
    .maybeSingle()

  // No subscription yet — return null (billing page shows plan picker)
  if (!sub) return NextResponse.json(null)

  return NextResponse.json(sub)
}
