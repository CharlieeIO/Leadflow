'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Check } from 'lucide-react'
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
  trialing:  { label: 'Trial',    class: 'bg-blue-50 text-blue-700' },
  active:    { label: 'Active',   class: 'bg-green-50 text-green-700' },
  past_due:  { label: 'Past due', class: 'bg-amber-50 text-amber-700' },
  canceled:  { label: 'Canceled', class: 'bg-slate-100 text-slate-400' },
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
    <div className="space-y-6 max-w-4xl">
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          You&apos;re all set! Your subscription is now active. Welcome aboard.
        </div>
      )}
      {cancelMsg && (
        <div className="bg-slate-50 border border-slate-200 text-slate-600 text-sm rounded-lg px-4 py-3">
          No worries — you can start a plan whenever you&apos;re ready.
        </div>
      )}

      {/* Current plan */}
      {!loading && sub && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Current plan</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold text-slate-900 capitalize">{sub.plan}</span>
                <span className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-full',
                  STATUS_LABELS[sub.status]?.class ?? 'bg-slate-100 text-slate-500',
                )}>
                  {STATUS_LABELS[sub.status]?.label ?? sub.status}
                </span>
              </div>
              {sub.trial_ends_at && sub.status === 'trialing' && (
                <p className="text-xs text-slate-400 mt-1">
                  Trial ends {new Date(sub.trial_ends_at).toLocaleDateString()}
                </p>
              )}
              {sub.current_period_end && sub.status === 'active' && (
                <p className="text-xs text-slate-400 mt-1">
                  Renews {new Date(sub.current_period_end).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              {portalLoading ? 'Loading…' : 'Manage billing'}
            </button>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-4">
          {isActive ? 'Change plan' : 'Choose a plan'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][]).map(([key, plan]) => {
            const isCurrent = currentPlan === key && isActive
            const isPopular = key === 'growth'

            return (
              <div
                key={key}
                className={cn(
                  'bg-white rounded-xl border p-5 flex flex-col relative',
                  isPopular ? 'border-blue-400 shadow-sm' : 'border-slate-200',
                  isCurrent ? 'ring-2 ring-blue-500' : '',
                )}
              >
                {isPopular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-0.5 rounded-full">
                      Most popular
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{plan.description}</p>
                  <div className="mt-3">
                    <span className="text-3xl font-bold text-slate-900">${plan.price}</span>
                    <span className="text-sm text-slate-400">/mo</span>
                  </div>
                </div>

                <ul className="space-y-2 flex-1 mb-5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check size={14} className="text-green-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full py-2.5 text-center text-sm font-medium text-blue-600 bg-blue-50 rounded-lg">
                    Current plan
                  </div>
                ) : (
                  <button
                    onClick={() => startCheckout(key)}
                    disabled={!!checkoutLoading}
                    className={cn(
                      'w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
                      isPopular
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-slate-900 text-white hover:bg-slate-800',
                    )}
                  >
                    {checkoutLoading === key ? 'Redirecting…' : isActive ? 'Switch to this plan' : 'Start 14-day trial'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-slate-400 mt-3 text-center">
          All plans include a 14-day free trial. Cancel anytime.
        </p>
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
