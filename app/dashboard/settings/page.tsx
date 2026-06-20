'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { Business, BusinessSettings } from '@/types'

// Booking links keyed by service type (e.g. { "AC repair": "https://cal.com/..." })
type BookingLinkRow = { service: string; url: string }

type SettingsForm = {
  name: string
  niche: string
  owner_name: string
  ai_persona_name: string
  notification_phone: string
  notification_email: string
  slack_webhook: string
  booking_link: string
  service_area: string
  custom_instructions: string
  timezone: string
  crm_webhook_url: string
  avg_job_value: string
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

const inputClass = cn(
  'w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900',
  'placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
  'outline-none transition-colors',
)

// Suggested service types by niche for the booking links section
const NICHE_SERVICE_TYPES: Record<string, string[]> = {
  hvac:       ['AC repair', 'Heating repair', 'AC installation', 'Heating installation', 'Maintenance'],
  roofing:    ['Repair', 'Replacement', 'Inspection', 'Storm damage'],
  medspa:     ['Botox', 'Filler', 'Laser', 'Facial', 'Body contouring'],
  autodetail: ['Basic wash', 'Full detail', 'Paint correction', 'Ceramic coating'],
  realtor:    ['Buyer consultation', 'Seller consultation'],
}

export default function SettingsPage() {
  const [form, setForm] = useState<SettingsForm>({
    name: '', niche: '', owner_name: '', ai_persona_name: '',
    notification_phone: '', notification_email: '', slack_webhook: '',
    booking_link: '', service_area: '', custom_instructions: '', timezone: '',
    crm_webhook_url: '', avg_job_value: '',
  })
  const [bookingLinks, setBookingLinks] = useState<BookingLinkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: (Business & { settings: BusinessSettings }) | null) => {
        if (!d) return
        setForm({
          name: d.name ?? '',
          niche: d.niche ?? '',
          owner_name: d.settings?.owner_name ?? '',
          ai_persona_name: d.settings?.ai_persona_name ?? '',
          notification_phone: d.settings?.notification_phone ?? '',
          notification_email: d.settings?.notification_email ?? '',
          slack_webhook: d.settings?.slack_webhook ?? '',
          booking_link: d.settings?.booking_link ?? '',
          service_area: d.settings?.service_area ?? '',
          custom_instructions: d.settings?.custom_instructions ?? '',
          timezone: d.settings?.timezone ?? '',
          crm_webhook_url: d.settings?.crm_webhook_url ?? '',
          avg_job_value: d.settings?.avg_job_value ? String(d.settings.avg_job_value) : '',
        })
        // Load existing per-service booking links
        const existing = d.settings?.booking_links_by_service ?? {}
        if (Object.keys(existing).length > 0) {
          setBookingLinks(Object.entries(existing).map(([service, url]) => ({ service, url })))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  function set(key: keyof SettingsForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    // Convert booking link rows to Record<string, string>, ignoring blank rows
    const bookingLinksByService = bookingLinks
      .filter((r) => r.service.trim() && r.url.trim())
      .reduce<Record<string, string>>((acc, r) => {
        acc[r.service.trim()] = r.url.trim()
        return acc
      }, {})

    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        niche: form.niche,
        settings: {
          owner_name: form.owner_name,
          ai_persona_name: form.ai_persona_name,
          notification_phone: form.notification_phone,
          notification_email: form.notification_email,
          slack_webhook: form.slack_webhook,
          booking_link: form.booking_link,
          service_area: form.service_area,
          custom_instructions: form.custom_instructions,
          timezone: form.timezone,
          crm_webhook_url: form.crm_webhook_url || undefined,
          avg_job_value: form.avg_job_value ? Number(form.avg_job_value) : undefined,
          booking_links_by_service: Object.keys(bookingLinksByService).length > 0
            ? bookingLinksByService
            : undefined,
        },
      }),
    })

    if (res.ok) {
      setSaved(true)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Save failed')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="h-5 w-32 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 w-full bg-slate-100 rounded animate-pulse" />
            <div className="h-10 w-full bg-slate-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      {/* Business */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Business</h2>

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

        <Field label="Owner name" hint="Used in AI messages when signing off">
          <input className={inputClass} value={form.owner_name} onChange={(e) => set('owner_name', e.target.value)} placeholder="John Smith" />
        </Field>

        <Field label="Service area" hint="e.g. Dallas, TX and surrounding areas">
          <input className={inputClass} value={form.service_area} onChange={(e) => set('service_area', e.target.value)} placeholder="Dallas, TX" />
        </Field>

        <Field label="Timezone" hint="Used for appointment reminders">
          <input className={inputClass} value={form.timezone} onChange={(e) => set('timezone', e.target.value)} placeholder="America/Chicago" />
        </Field>

        <Field label="Avg job value ($)" hint="Used to calculate revenue recovered on your dashboard">
          <input className={inputClass} type="number" min="0" value={form.avg_job_value} onChange={(e) => set('avg_job_value', e.target.value)} placeholder="1500" />
        </Field>
      </section>

      {/* AI */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">AI Behavior</h2>

        <Field label="AI persona name" hint="The name the AI uses to introduce itself">
          <input className={inputClass} value={form.ai_persona_name} onChange={(e) => set('ai_persona_name', e.target.value)} placeholder="Alex" />
        </Field>

        <Field label="Default booking link" hint="Fallback link sent when no service-specific link matches">
          <input className={inputClass} type="url" value={form.booking_link} onChange={(e) => set('booking_link', e.target.value)} placeholder="https://cal.com/your-link" />
        </Field>

        {/* Per-service booking links */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Booking links by service type
          </label>
          <p className="text-xs text-slate-400 mb-3">
            AI will send the matching link based on what type of service the lead needs.
            {form.niche && NICHE_SERVICE_TYPES[form.niche] && (
              <> Suggested for {form.niche}: {NICHE_SERVICE_TYPES[form.niche].join(', ')}.</>
            )}
          </p>
          <div className="space-y-2">
            {bookingLinks.map((row, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={cn(inputClass, 'flex-1')}
                  placeholder="Service type (e.g. AC repair)"
                  value={row.service}
                  onChange={(e) => {
                    const updated = [...bookingLinks]
                    updated[i] = { ...updated[i], service: e.target.value }
                    setBookingLinks(updated)
                    setSaved(false)
                  }}
                />
                <input
                  className={cn(inputClass, 'flex-[2]')}
                  type="url"
                  placeholder="https://cal.com/..."
                  value={row.url}
                  onChange={(e) => {
                    const updated = [...bookingLinks]
                    updated[i] = { ...updated[i], url: e.target.value }
                    setBookingLinks(updated)
                    setSaved(false)
                  }}
                />
                <button
                  type="button"
                  onClick={() => setBookingLinks(bookingLinks.filter((_, j) => j !== i))}
                  className="px-2 text-slate-400 hover:text-red-500 transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setBookingLinks([...bookingLinks, { service: '', url: '' }])}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              + Add service type
            </button>
            {form.niche && NICHE_SERVICE_TYPES[form.niche] && bookingLinks.length === 0 && (
              <button
                type="button"
                onClick={() =>
                  setBookingLinks(
                    NICHE_SERVICE_TYPES[form.niche].map((s) => ({ service: s, url: '' })),
                  )
                }
                className="ml-3 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                Pre-fill {form.niche} services
              </button>
            )}
          </div>
        </div>

        <Field label="Custom AI instructions" hint="Additional context or rules for the AI (max 500 chars)">
          <textarea
            className={cn(inputClass, 'resize-none')}
            rows={4}
            maxLength={500}
            value={form.custom_instructions}
            onChange={(e) => set('custom_instructions', e.target.value)}
            placeholder="Always mention our 5-star Google rating. Never discuss competitor pricing."
          />
          <p className="mt-1 text-right text-xs text-slate-400">{form.custom_instructions.length}/500</p>
        </Field>
      </section>

      {/* Notifications */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>

        <Field label="Notification phone" hint="SMS alerts for new leads, escalations, and bookings">
          <input className={inputClass} type="tel" value={form.notification_phone} onChange={(e) => set('notification_phone', e.target.value)} placeholder="+12145550100" />
        </Field>

        <Field label="Notification email" hint="Email alerts (future)">
          <input className={inputClass} type="email" value={form.notification_email} onChange={(e) => set('notification_email', e.target.value)} placeholder="you@company.com" />
        </Field>

        <Field label="Slack webhook URL" hint="Post alerts to a Slack channel">
          <input className={inputClass} type="url" value={form.slack_webhook} onChange={(e) => set('slack_webhook', e.target.value)} placeholder="https://hooks.slack.com/services/..." />
        </Field>

        <Field label="CRM webhook URL" hint="Fires on new lead, booking, and escalation — works with Zapier, GoHighLevel, HubSpot, and any tool that accepts a POST">
          <input className={inputClass} type="url" value={form.crm_webhook_url} onChange={(e) => set('crm_webhook_url', e.target.value)} placeholder="https://hooks.zapier.com/hooks/catch/..." />
        </Field>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className={cn(
            'px-5 py-2.5 rounded-lg text-sm font-medium transition-colors',
            'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50',
          )}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <p className="text-sm text-green-600 font-medium">Saved!</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </form>
  )
}
