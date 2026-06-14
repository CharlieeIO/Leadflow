import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { getStripe, getOrCreateCustomer, PLANS } from '@/lib/stripe/client'
import type { PlanKey } from '@/lib/stripe/client'

const Schema = z.object({
  plan: z.enum(['starter', 'growth', 'pro']),
})

// POST /api/stripe/checkout — create a Checkout session and return the URL
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid plan' }, { status: 422 })

  const plan = parsed.data.plan as PlanKey
  const service = getSupabaseServiceClient()

  const { data: business } = await service
    .from('businesses')
    .select('id, name')
    .eq('owner_user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (!business) return NextResponse.json({ error: 'No business found' }, { status: 404 })

  const customerId = await getOrCreateCustomer({
    businessId: business.id,
    email: user.email!,
    name: business.name,
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const stripe = getStripe()

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: PLANS[plan].priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/billing?success=1`,
    cancel_url:  `${appUrl}/dashboard/billing?cancelled=1`,
    subscription_data: {
      trial_period_days: 14,
      metadata: { business_id: business.id, plan },
    },
    metadata: { business_id: business.id, plan },
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
