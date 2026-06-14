'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const STEPS = ['Business Info', 'AI Persona', 'Notifications', 'Booking'] as const
type Step = 0 | 1 | 2 | 3

interface FormState {
  name: string
  niche: string
  owner_name: string
  service_area: string
  timezone: string
  ai_persona_name: string
  ai_tone: string
  custom_instructions: string
  notification_phone: string
  notification_email: string
  slack_webhook: string
  booking_link: string
  avg_job_value: string
}

const inputClass = cn(
  'w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900',
  'placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors',
)

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export default function OnboardPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = use(params)
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)
  const [form, setForm] = useState<FormState>({
    name: '', niche: '', owner_name: '', service_area: '', timezone: '',
    ai_persona_name: '', ai_tone: 'friendly', custom_instructions: '',
    notification_phone: '', notification_email: '', slack_webhook: '',
    booking_link: '', avg_job_value: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Load existing business data
  useEffect(() => {
    fetch(`/api/admin/businesses/${businessId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return
        const s = d.settings ?? {}
        setForm({
          name: d.name ?? '',
          niche: d.niche ?? '',
          owner_name: s.owner_name ?? '',
          service_area: s.service_area ?? '',
          timezone: s.timezone ?? '',
          ai_persona_name: s.ai_persona_name ?? '',
          ai_tone: s.ai_tone ?? 'friendly',
          custom_instructions: s.custom_instructions ?? '',
          notification_phone: s.notification_phone ?? '',
          notification_email: s.notification_email ?? '',
          slack_webhook: s.slack_webhook ?? '',
          booking_link: s.booking_link ?? '',
          avg_job_value: s.avg_job_value ? String(s.avg_job_value) : '',
        })
      })
      .catch(() => {})
  }, [businessId])

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function saveStep() {
    setSaving(true)
    setError('')

    const payload: Record<string, unknown> = { settings: {} }
    const settings = payload.settings as Record<string, unknown>

    if (step === 0) {
      payload.name = form.name
      payload.niche = form.niche
      settings.owner_name = form.owner_name
      settings.service_area = form.service_area
      settings.timezone = form.timezone
    } else if (step === 1) {
      settings.ai_persona_name = form.ai_persona_name
      settings.ai_tone = form.ai_tone
      settings.custom_instructions = form.custom_instructions || undefined
    } else if (step === 2) {
      settings.notification_phone = form.notification_phone
      settings.notification_email = form.notification_email || undefined
      settings.slack_webhook = form.slack_webhook || undefined
    } else {
      settings.booking_link = form.booking_link
      settings.avg_job_value = form.avg_job_value ? Number(form.avg_job_value) : undefined
    }

    const res = await fetch(`/api/admin/businesses/${businessId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSaving(false)

    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Save failed')
      return
    }

    if (step < 3) {
      setStep((s) => (s + 1) as Step)
    } else {
      router.push(`/admin/businesses/${businessId}`)
    }
  }

  const progressPct = ((step + 1) / STEPS.length) * 100

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">Client Onboarding</h1>
          <p className="text-sm text-slate-500 mt-1">
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex gap-2 mb-3">
            {STEPS.map((label, i) => (
              <div key={label} className="flex-1">
                <div
                  className={cn(
                    'h-1.5 rounded-full transition-colors',
                    i <= step ? 'bg-blue-600' : 'bg-slate-200',
                  )}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            {STEPS.map((label, i) => (
              <span
                key={label}
                className={cn(
                  'text-xs hidden sm:block',
                  i === step ? 'text-blue-600 font-medium' : 'text-slate-400',
                )}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">

          {/* Step 0: Business Info */}
          {step === 0 && (
            <>
              <Field label="Business name">
                <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Acme Roofing" />
              </Field>
              <Field label="Niche">
                <select className={inputClass} value={form.niche} onChange={(e) => set('niche', e.target.value)}>
                  <option value="">Select a niche</option>
                  <option value="roofing">Roofing</option>
                  <option value="hvac">HVAC</option>
                  <option value="medspa">Med Spa</option>
                  <option value="autodetail">Auto Detail</option>
                  <option value="realtor">Realtor</option>
                </select>
              </Field>
              <Field label="Owner name" hint="Appears in AI sign-offs">
                <input className={inputClass} value={form.owner_name} onChange={(e) => set('owner_name', e.target.value)} placeholder="John Smith" />
              </Field>
              <Field label="Service area">
                <input className={inputClass} value={form.service_area} onChange={(e) => set('service_area', e.target.value)} placeholder="Dallas, TX and surrounding areas" />
              </Field>
              <Field label="Timezone" hint="e.g. America/Chicago">
                <input className={inputClass} value={form.timezone} onChange={(e) => set('timezone', e.target.value)} placeholder="America/Chicago" />
              </Field>
            </>
          )}

          {/* Step 1: AI Persona */}
          {step === 1 && (
            <>
              <Field label="AI persona name" hint="The name the AI introduces itself as">
                <input className={inputClass} value={form.ai_persona_name} onChange={(e) => set('ai_persona_name', e.target.value)} placeholder="Alex" />
              </Field>
              <Field label="AI tone">
                <select className={inputClass} value={form.ai_tone} onChange={(e) => set('ai_tone', e.target.value)}>
                  <option value="friendly">Friendly</option>
                  <option value="professional">Professional</option>
                  <option value="urgent">Urgent</option>
                </select>
              </Field>
              <Field label="Custom AI instructions" hint="Additional context, rules, or brand voice (max 500 chars)">
                <textarea
                  className={cn(inputClass, 'resize-none')}
                  rows={4}
                  maxLength={500}
                  value={form.custom_instructions}
                  onChange={(e) => set('custom_instructions', e.target.value)}
                  placeholder="Always mention our 5-star Google rating."
                />
                <p className="mt-1 text-right text-xs text-slate-400">{form.custom_instructions.length}/500</p>
              </Field>
            </>
          )}

          {/* Step 2: Notifications */}
          {step === 2 && (
            <>
              <Field label="Notification phone" hint="SMS alerts for new leads, escalations, bookings">
                <input className={inputClass} type="tel" value={form.notification_phone} onChange={(e) => set('notification_phone', e.target.value)} placeholder="+12145550100" />
              </Field>
              <Field label="Notification email" hint="Weekly reports and email alerts">
                <input className={inputClass} type="email" value={form.notification_email} onChange={(e) => set('notification_email', e.target.value)} placeholder="owner@business.com" />
              </Field>
              <Field label="Slack webhook URL" hint="Post alerts to a Slack channel">
                <input className={inputClass} type="url" value={form.slack_webhook} onChange={(e) => set('slack_webhook', e.target.value)} placeholder="https://hooks.slack.com/services/..." />
              </Field>
            </>
          )}

          {/* Step 3: Booking */}
          {step === 3 && (
            <>
              <Field label="Booking link" hint="Cal.com or Calendly link sent to qualified leads">
                <input className={inputClass} type="url" value={form.booking_link} onChange={(e) => set('booking_link', e.target.value)} placeholder="https://cal.com/your-link" />
              </Field>
              <Field label="Avg job value ($)" hint="Used to calculate revenue recovered on the dashboard">
                <input className={inputClass} type="number" min="0" value={form.avg_job_value} onChange={(e) => set('avg_job_value', e.target.value)} placeholder="1500" />
              </Field>
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as Step)}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={saveStep}
              disabled={saving}
              className="ml-auto px-5 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : step === 3 ? 'Finish Setup' : 'Save & Continue'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
