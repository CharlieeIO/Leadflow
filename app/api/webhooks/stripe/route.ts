import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type Stripe from 'stripe'

// POST /api/webhooks/stripe — subscription lifecycle events
export async function POST(request: NextRequest): Promise<NextResponse> {
  const sig = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const stripe = getStripe()

  let event: Stripe.Event
  try {
    const body = await request.text()
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    logger.warn('stripe_webhook_signature_failed', { error: String(err) })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const businessId = session.metadata?.business_id
      const plan = session.metadata?.plan
      const customerId = session.customer as string
      const subscriptionId = session.subscription as string

      if (!businessId || !plan) break

      // Retrieve subscription to get trial/period dates
      const sub = await stripe.subscriptions.retrieve(subscriptionId)

      await supabase
        .from('subscriptions')
        .upsert({
          business_id: businessId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan,
          status: sub.status === 'trialing' ? 'trialing' : 'active',
          trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          current_period_end: new Date(sub.billing_cycle_anchor * 1000).toISOString(),
        }, { onConflict: 'business_id' })

      logger.info('stripe_subscription_created', { business_id: businessId, plan })
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const businessId = sub.metadata?.business_id
      if (!businessId) break

      const plan = (sub.metadata?.plan ?? sub.items.data[0]?.price.metadata?.plan ?? 'starter') as string

      await supabase
        .from('subscriptions')
        .update({
          plan,
          status: sub.status as 'trialing' | 'active' | 'past_due' | 'canceled',
          trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          current_period_end: new Date(sub.billing_cycle_anchor * 1000).toISOString(),
        })
        .eq('business_id', businessId)

      logger.info('stripe_subscription_updated', { business_id: businessId, status: sub.status })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const businessId = sub.metadata?.business_id
      if (!businessId) break

      await supabase
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('business_id', businessId)

      logger.info('stripe_subscription_canceled', { business_id: businessId })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('business_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle()

      if (sub) {
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('business_id', sub.business_id)

        logger.warn('stripe_payment_failed', { business_id: sub.business_id })
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
