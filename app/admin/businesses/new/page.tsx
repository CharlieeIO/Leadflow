'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const inputClass = cn(
  'w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900',
  'placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
  'outline-none transition-colors',
)

export default function NewBusinessPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    name: '',
    niche: 'roofing',
    owner_email: '',
    area_code: '',
    provision_twilio: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch('/api/admin/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:             form.name,
        niche:            form.niche,
        owner_email:      form.owner_email,
        area_code:        form.area_code || undefined,
        provision_twilio: form.provision_twilio,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      setSaving(false)
      return
    }

    router.push(`/admin/onboard/${data.business_id}`)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-xl mx-auto px-6 py-8">
        <div className="mb-6">
          <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
            ← Back to admin
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-3">New Business</h1>
          <p className="text-sm text-slate-500 mt-1">
            Creates the business row and owner account. You can configure Twilio, Retell,
            and Cal.com from the settings page after creation.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Business details */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Business details</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Business name</label>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Acme Roofing"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Niche</label>
              <select
                className={inputClass}
                value={form.niche}
                onChange={(e) => set('niche', e.target.value)}
              >
                <option value="roofing">Roofing</option>
                <option value="hvac">HVAC</option>
                <option value="medspa">Med Spa</option>
                <option value="autodetail">Auto Detail</option>
                <option value="realtor">Realtor</option>
              </select>
            </div>
          </div>

          {/* Owner */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Owner account</h2>
            <p className="text-xs text-slate-400">
              If this email already has an account it will be linked. Otherwise a new account is created
              and a magic-link invitation will be sent when they first try to log in.
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Owner email</label>
              <input
                className={inputClass}
                type="email"
                value={form.owner_email}
                onChange={(e) => set('owner_email', e.target.value)}
                placeholder="owner@theirbusiness.com"
                required
              />
            </div>
          </div>

          {/* Twilio */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Twilio phone number</h2>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.provision_twilio}
                onChange={(e) => set('provision_twilio', e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-slate-700">Provision a Twilio number now</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Searches for and purchases a local US number, then configures the SMS and voice webhooks
                  automatically. Requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to be set.
                </p>
              </div>
            </label>

            {form.provision_twilio && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Area code <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  className={cn(inputClass, 'w-28')}
                  value={form.area_code}
                  onChange={(e) => set('area_code', e.target.value.replace(/\D/g, '').slice(0, 3))}
                  placeholder="214"
                  maxLength={3}
                />
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Creating…' : 'Create business'}
            </button>
            <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
