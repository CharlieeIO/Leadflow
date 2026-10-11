'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { Business, BusinessSettings } from '@/types'

type BookingLinkRow = { service: string; url: string }

const inputClass = cn(
  'w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900',
  'placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
  'outline-none transition-colors',
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

export default function SettingsPage() {
  const [personaName, setPersonaName]         = useState('')
  const [notifyPhone, setNotifyPhone]         = useState('')
  const [notifyEmail, setNotifyEmail]         = useState('')
  const [avgJobValue, setAvgJobValue]         = useState('')
  const [slackWebhook, setSlackWebhook]       = useState('')
  const [crmWebhook, setCrmWebhook]           = useState('')
  const [bookingLink, setBookingLink]         = useState('')
  const [bookingLinks, setBookingLinks]       = useState<BookingLinkRow[]>([])
  const [niche, setNiche]                     = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: (Business & { settings: BusinessSettings }) | null) => {
        if (!d) return
        const s = d.settings ?? {}
        setPersonaName(s.ai_persona_name ?? '')
        setNotifyPhone(s.notification_phone ?? '')
        setNotifyEmail(s.notification_email ?? '')
        setAvgJobValue(s.avg_job_value ? String(s.avg_job_value) : '')
        setSlackWebhook(s.slack_webhook ?? '')
        setCrmWebhook(s.crm_webhook_url ?? '')
        setBookingLink(s.booking_link ?? '')
        setNiche(d.niche ?? '')
        const existing = s.booking_links_by_service ?? {}
        if (Object.keys(existing).length > 0) {
          setBookingLinks(Object.entries(existing).map(([service, url]) => ({ service, url })))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

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
        settings: {
          ai_persona_name: personaName,
          notification_phone: notifyPhone,
          notification_email: notifyEmail,
          avg_job_value: avgJobValue ? Number(avgJobValue) : undefined,
          slack_webhook: slackWebhook || undefined,
          crm_webhook_url: crmWebhook || undefined,
          booking_link: bookingLink,
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

  // Niche service type suggestions
  const NICHE_TYPES: Record<string, string[]> = {
    hvac:       ['AC repair', 'Heating repair', 'AC installation', 'Heating installation', 'Maintenance'],
    roofing:    ['Repair', 'Replacement', 'Inspection', 'Storm damage'],
    medspa:     ['Botox', 'Filler', 'Laser', 'Facial', 'Body contouring'],
    autodetail: ['Basic wash', 'Full detail', 'Paint correction', 'Ceramic coating'],
    realtor:    ['Buyer consultation', 'Seller consultation'],
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="h-5 w-32 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 w-full bg-slate-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">

      {/* AI Identity */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">AI identity</h2>
          <p className="text-xs text-slate-400 mt-0.5">How your AI introduces itself in conversations.</p>
        </div>

        <Field label="AI persona name" hint="The first name the AI uses — e.g. Alex, Sam, Jordan">
          <input
            className={inputClass}
            value={personaName}
            onChange={(e) => { setPersonaName(e.target.value); setSaved(false) }}
            placeholder="Alex"
          />
        </Field>
      </section>

      {/* Booking */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Booking links</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            The AI sends these links when it's time to schedule. Add one per service type so it sends the right Cal.com event automatically.
          </p>
        </div>

        <Field label="Default booking link" hint="Fallback when no service-specific link matches">
          <input
            className={inputClass}
            type="url"
            value={bookingLink}
            onChange={(e) => { setBookingLink(e.target.value); setSaved(false) }}
            placeholder="https://cal.com/your-link"
          />
        </Field>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Per-service booking links
          </label>
          <div className="space-y-2">
            {bookingLinks.map((row, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={cn(inputClass, 'flex-1')}
                  placeholder="Service type"
                  value={row.service}
                  onChange={(e) => {
                    const u = [...bookingLinks]
                    u[i] = { ...u[i], service: e.target.value }
                    setBookingLinks(u)
                    setSaved(false)
                  }}
                />
                <input
                  className={cn(inputClass, 'flex-[2]')}
                  type="url"
                  placeholder="https://cal.com/..."
                  value={row.url}
                  onChange={(e) => {
                    const u = [...bookingLinks]
                    u[i] = { ...u[i], url: e.target.value }
                    setBookingLinks(u)
                    setSaved(false)
                  }}
                />
                <button
                  type="button"
                  onClick={() => setBookingLinks(bookingLinks.filter((_, j) => j !== i))}
                  className="px-2 text-slate-300 hover:text-red-400 transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setBookingLinks([...bookingLinks, { service: '', url: '' }])}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                + Add service type
              </button>
              {niche && NICHE_TYPES[niche] && bookingLinks.length === 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setBookingLinks(NICHE_TYPES[niche].map((s) => ({ service: s, url: '' })))
                  }
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Pre-fill {niche} services
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
          <p className="text-xs text-slate-400 mt-0.5">Where to send lead alerts and booking confirmations.</p>
        </div>

        <Field label="Notification phone" hint="SMS when a new qualified lead comes in">
          <input
            className={inputClass}
            type="tel"
            value={notifyPhone}
            onChange={(e) => { setNotifyPhone(e.target.value); setSaved(false) }}
            placeholder="+12145550100"
          />
        </Field>

        <Field label="Notification email" hint="Full lead brief with grade, service type, and conversation">
          <input
            className={inputClass}
            type="email"
            value={notifyEmail}
            onChange={(e) => { setNotifyEmail(e.target.value); setSaved(false) }}
            placeholder="you@company.com"
          />
        </Field>

        <Field label="Avg job value ($)" hint="Used to calculate revenue recovered on your dashboard">
          <input
            className={inputClass}
            type="number"
            min="0"
            value={avgJobValue}
            onChange={(e) => { setAvgJobValue(e.target.value); setSaved(false) }}
            placeholder="1500"
          />
        </Field>
      </section>

      {/* Integrations */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Integrations</h2>
          <p className="text-xs text-slate-400 mt-0.5">Connect to your other tools. All optional.</p>
        </div>

        <Field label="Slack webhook" hint="Post lead alerts to a Slack channel">
          <input
            className={inputClass}
            type="url"
            value={slackWebhook}
            onChange={(e) => { setSlackWebhook(e.target.value); setSaved(false) }}
            placeholder="https://hooks.slack.com/services/..."
          />
        </Field>

        <Field label="CRM webhook" hint="Fires on new lead, booking, and escalation — works with Zapier, GoHighLevel, HubSpot">
          <input
            className={inputClass}
            type="url"
            value={crmWebhook}
            onChange={(e) => { setCrmWebhook(e.target.value); setSaved(false) }}
            placeholder="https://hooks.zapier.com/hooks/catch/..."
          />
        </Field>
      </section>

      <div className="flex items-center gap-3 pb-8">
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
        {saved && <p className="text-sm text-green-600 font-medium">Saved</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </form>
  )
}
