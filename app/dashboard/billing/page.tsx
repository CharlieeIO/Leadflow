'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Check, Zap, TrendingUp, Shield, Star, ChevronRight } from 'lucide-react'
import { PLANS } from '@/lib/stripe/client'
import type { PlanKey } from '@/lib/stripe/client'
import { cn } from '@/lib/utils'

interface SubData {
  plan: string
  status: string
  trial_ends_at: string | null
  current_period_end: string | null
}

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  trialing:  { label: 'Trial Active',  class: 'bg-blue-50 text-blue-700 border border-blue-200' },
  active:    { label: 'Active',        class: 'bg-green-50 text-green-700 border border-green-200' },
  past_due:  { label: 'Past Due',      class: 'bg-amber-50 text-amber-700 border border-amber-200' },
  canceled:  { label: 'Canceled',      class: 'bg-slate-100 text-slate-400 border border-slate-200' },
}

const PLAN_ICONS: Record<string, React.ElementType> = {
  starter: Zap,
  growth:  TrendingUp,
  pro:     Shield,
}

const PLAN_COLORS: Record<string, { bg: string; icon: string; button: string; border: string }> = {
  starter: {
    bg: 'bg-slate-50',
    icon: 'text-slate-600 bg-slate-100',
    button: 'bg-slate-900 hover:bg-slate-800 text-white',
    border: 'border-slate-200',
  },
  growth: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600 bg-blue-100',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
    border: 'border-blue-300',
  },
  pro: {
    bg: 'bg-violet-50',
    icon: 'text-violet-600 bg-violet-100',
    button: 'bg-violet-600 hover:bg-violet-700 text-white',
    border: 'border-violet-300',
  },
}

const PLAN_TAGLINES: Record<string, string> = {
  starter: 'Get your first leads converting on autopilot.',
  growth:  'Scale your pipeline with voice AI and advanced automation.',
  pro:     'Full-power AI with no limits and white-glove onboarding.',
}

// What each plan adds over the previous
const PLAN_HIGHLIGHTS: Record<string, string[]> = {
  starter: [
    'AI qualifies leads via SMS 24/7',
    'Instant response — under 5 seconds',
    'Auto-sends booking links when hot',
    'Up to 200 leads/month',
    'Email & SMS owner alerts',
  ],
  growth: [
    'Everything in Starter',
    'Up to 1,000 leads/month',
    'Voice AI via Retell (inbound calls)',
    'Bilingual AI — English & Spanish',
    'Slack notifications',
    'CRM webhook (Zapier / GoHighLevel)',
    'Priority support',
  ],
  pro: [
    'Everything in Growth',
    'Unlimited leads',
    'Custom AI persona & instructions',
    'Weekly revenue reports via email',
    'Multi-business management',
    'Dedicated onboarding call',
    'Early access to new features',
  ],
}

function BillingContent() {
  const searchParams = useSearchParams()
  const [sub, setSub] = useState<SubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  const successMsg = searchParams.get('success')   === '1'
  const cancelMsg  = searchParams.get('cancelled') === '1'

  useEffect(() => {
    fetch('/api/stripe/subscription')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setSub(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function startCheckout(plan: PlanKey) {
    setCheckoutLoading(plan)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setCheckoutLoading(null)
  }

  async function openPortal() {
    setPortalLoading(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setPortalLoading(false)
  }

  const currentPlan = sub?.plan as PlanKey | undefined
  const isActive = sub?.status === 'active' || sub?.status === 'trialing'

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Alerts */}
      {successMsg && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-5 py-4">
          <Star size={16} className="shrink-0" />
          <span><strong>You&apos;re all set!</strong> Your subscription is active. Let&apos;s get your first lead converting.</span>
          <a href="/dashboard/leads" className="ml-auto flex items-center gap-1 text-green-700 font-medium hover:underline shrink-0">
            Go to Leads <ChevronRight size={14} />
          </a>
        </div>
      )}
      {cancelMsg && (
        <div className="bg-slate-50 border border-slate-200 text-slate-600 text-sm rounded-xl px-5 py-4">
          No worries — you can start a plan whenever you&apos;re ready. Your data is safe.
        </div>
      )}

      {/* Current plan banner */}
      {!loading && sub && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Zap size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Current plan</p>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-900 capitalize">{sub.plan}</span>
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_LABELS[sub.status]?.class ?? 'bg-slate-100 text-slate-500')}>
                    {STATUS_LABELS[sub.status]?.label ?? sub.status}
                  </span>
                </div>
                {sub.trial_ends_at && sub.status === 'trialing' && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Trial ends {new Date(sub.trial_ends_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
                {sub.current_period_end && sub.status === 'active' && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Renews {new Date(sub.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              {portalLoading ? 'Loading…' : 'Manage billing & invoices'}
            </button>
          </div>
        </div>
      )}

      {/* Heading */}
      <div>
        <h2 className="text-lg font-bold text-slate-900">
          {isActive ? 'Change your plan' : 'Choose your plan'}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          All plans include a 14-day free trial. No credit card required to start.
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {(Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][]).map(([key, plan]) => {
          const isCurrent = currentPlan === key && isActive
          const isPopular = key === 'growth'
          const Icon = PLAN_ICONS[key] ?? Zap
          const colors = PLAN_COLORS[key]
          const highlights = PLAN_HIGHLIGHTS[key]

          return (
            <div
              key={key}
              className={cn(
                'relative rounded-2xl border-2 flex flex-col transition-all',
                isCurrent ? 'border-blue-500 shadow-lg shadow-blue-100' : colors.border,
                isPopular && !isCurrent ? 'shadow-lg' : '',
              )}
            >
              {/* Popular badge */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-sm">
                    MOST POPULAR
                  </span>
                </div>
              )}

              {/* Current badge */}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="bg-blue-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-sm">
                    YOUR PLAN
                  </span>
                </div>
              )}

              {/* Card header */}
              <div className={cn('rounded-t-xl px-6 pt-7 pb-5', colors.bg)}>
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', colors.icon)}>
                  <Icon size={18} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{PLAN_TAGLINES[key]}</p>
                <div className="mt-4 flex items-end gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">${plan.price}</span>
                  <span className="text-sm text-slate-400 mb-1">/month</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Billed monthly · cancel anytime</p>
              </div>

              {/* Features */}
              <div className="px-6 py-5 flex-1 bg-white rounded-b-xl">
                <ul className="space-y-3">
                  {highlights.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <Check size={15} className="text-green-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {isCurrent ? (
                    <div className="w-full py-2.5 text-center text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-xl">
                      ✓ Current plan
                    </div>
                  ) : (
                    <button
                      onClick={() => startCheckout(key)}
                      disabled={!!checkoutLoading}
                      className={cn(
                        'w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                        colors.button,
                      )}
                    >
                      {checkoutLoading === key
                        ? 'Redirecting…'
                        : isActive
                          ? `Switch to ${plan.name}`
                          : `Start free trial`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ROI callout */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg">What does LeadFlow actually make you?</p>
            <p className="text-blue-100 text-sm mt-1">
              If your average job is worth $1,500 and LeadFlow books just 1 extra appointment per week —
              that&apos;s <strong className="text-white">$6,000/month in recovered revenue</strong> from leads
              that would have gone cold. The software pays for itself on day one.
            </p>
          </div>
          <a
            href="/dashboard/settings"
            className="shrink-0 px-4 py-2.5 bg-white text-blue-700 text-sm font-semibold rounded-xl hover:bg-blue-50 transition-colors"
          >
            Set your job value →
          </a>
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Common questions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {[
            { q: 'Can I change plans later?', a: 'Yes — upgrade or downgrade anytime. Changes take effect immediately and billing is prorated.' },
            { q: 'What happens after the trial?', a: "You'll be billed on the day your trial ends. We'll email you a reminder 3 days before." },
            { q: 'Is there a setup fee?', a: 'None. You can be live and receiving leads within 15 minutes of signing up.' },
            { q: 'Can I cancel anytime?', a: 'Yes. Cancel from your billing portal and you keep access until the end of the period.' },
          ].map(({ q, a }) => (
            <div key={q}>
              <p className="text-sm font-medium text-slate-900">{q}</p>
              <p className="text-sm text-slate-500 mt-1">{a}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingContent />
    </Suspense>
  )
}
