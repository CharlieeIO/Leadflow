import Stripe from 'stripe'

// Lazy singleton — avoids initializing during Next.js build when env vars aren't set
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-04-22.dahlia',
    })
  }
  return _stripe
}

export const PLANS = {
  starter: {
    name: 'Starter',
    price: 297,
    priceId: process.env.STRIPE_PRICE_STARTER ?? '',
    description: 'Perfect for getting started',
    features: [
      'Up to 200 leads/month',
      'AI SMS qualification',
      'Cal.com booking integration',
      'Email notifications',
    ],
  },
  growth: {
    name: 'Growth',
    price: 497,
    priceId: process.env.STRIPE_PRICE_GROWTH ?? '',
    description: 'For businesses scaling fast',
    features: [
      'Up to 1,000 leads/month',
      'Everything in Starter',
      'Voice AI (Retell)',
      'Slack notifications',
      'Priority support',
    ],
  },
  pro: {
    name: 'Pro',
    price: 797,
    priceId: process.env.STRIPE_PRICE_PRO ?? '',
    description: 'Full power, no limits',
    features: [
      'Unlimited leads',
      'Everything in Growth',
      'Multi-language AI (EN + ES)',
      'Custom AI instructions',
      'Dedicated onboarding',
    ],
  },
} as const

export type PlanKey = keyof typeof PLANS

// Looks up or creates a Stripe customer for the given business.
export async function getOrCreateCustomer(params: {
  businessId: string
  email: string
  name: string
}): Promise<string> {
  const s = getStripe()

  const existing = await s.customers.search({
    query: `metadata['business_id']:'${params.businessId}'`,
    limit: 1,
  })

  if (existing.data.length) return existing.data[0].id

  const customer = await s.customers.create({
    email: params.email,
    name: params.name,
    metadata: { business_id: params.businessId },
  })

  return customer.id
}
