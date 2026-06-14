import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import type { BusinessSettings } from '@/types'

// ── Health badge logic ────────────────────────────────────────────────────────
// Green: active lead in last 7 days AND twilio number configured
// Yellow: lead in last 30 days OR missing some setup
// Red: no recent leads OR missing Twilio number
type Health = 'green' | 'yellow' | 'red'

function healthBadge(health: Health) {
  const styles: Record<Health, string> = {
    green: 'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    red: 'bg-red-50 text-red-700',
  }
  const labels: Record<Health, string> = {
    green: 'Active',
    yellow: 'Attention',
    red: 'Inactive',
  }
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', styles[health])}>
      {labels[health]}
    </span>
  )
}

interface ClientRow {
  id: string
  name: string
  niche: string
  twilio_number: string | null
  settings: BusinessSettings
  created_at: string
  lastLeadAt: string | null
  leadsLast7d: number
  leadsLast30d: number
  bookingsLast30d: number
  setupPct: number
  mrr: number
  health: Health
}

async function fetchClients(): Promise<ClientRow[]> {
  const supabase = getSupabaseServiceClient()

  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, niche, twilio_number, settings, created_at')
    .order('created_at', { ascending: false })

  if (!businesses?.length) return []

  const now = new Date()
  const day7 = new Date(now.getTime() - 7 * 86400000).toISOString()
  const day30 = new Date(now.getTime() - 30 * 86400000).toISOString()

  const rows: ClientRow[] = await Promise.all(
    businesses.map(async (biz) => {
      const settings = biz.settings as BusinessSettings | undefined ?? {}

      const [
        { count: leads7d },
        { count: leads30d },
        { count: bookings30d },
        { data: lastLead },
        { data: sub },
      ] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true })
          .eq('business_id', biz.id).gte('created_at', day7),
        supabase.from('leads').select('*', { count: 'exact', head: true })
          .eq('business_id', biz.id).gte('created_at', day30),
        supabase.from('appointments').select('*', { count: 'exact', head: true })
          .eq('business_id', biz.id).gte('created_at', day30),
        supabase.from('leads').select('created_at')
          .eq('business_id', biz.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('subscriptions').select('plan, status')
          .eq('business_id', biz.id).maybeSingle(),
      ])

      // Setup completion: twilio, booking_link, notification_phone, ai_persona_name, niche
      const setupItems = [
        !!biz.twilio_number,
        !!settings.booking_link,
        !!settings.notification_phone,
        !!settings.ai_persona_name,
        !!biz.niche,
      ]
      const setupPct = Math.round((setupItems.filter(Boolean).length / setupItems.length) * 100)

      const planMrr: Record<string, number> = { starter: 297, growth: 497, pro: 797 }
      const mrr = sub?.status === 'active' || sub?.status === 'trialing'
        ? planMrr[sub.plan ?? ''] ?? 0
        : 0

      const hasRecentLead = !!lastLead && new Date(lastLead.created_at) > new Date(day7)
      const hasTwilio = !!biz.twilio_number

      let health: Health
      if (hasTwilio && hasRecentLead) {
        health = 'green'
      } else if ((leads30d ?? 0) > 0 || !hasTwilio) {
        health = 'yellow'
      } else {
        health = 'red'
      }

      return {
        id: biz.id,
        name: biz.name,
        niche: biz.niche,
        twilio_number: biz.twilio_number,
        settings,
        created_at: biz.created_at,
        lastLeadAt: lastLead?.created_at ?? null,
        leadsLast7d: leads7d ?? 0,
        leadsLast30d: leads30d ?? 0,
        bookingsLast30d: bookings30d ?? 0,
        setupPct,
        mrr,
        health,
      }
    }),
  )

  return rows
}

export default async function AgencyPage() {
  // Double-check admin (proxy also guards, but be safe)
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL
  if (!user || user.email !== adminEmail) redirect('/dashboard')

  const clients = await fetchClients()

  const totalMrr = clients.reduce((s, c) => s + c.mrr, 0)
  const greenCount = clients.filter((c) => c.health === 'green').length
  const yellowCount = clients.filter((c) => c.health === 'yellow').length
  const redCount = clients.filter((c) => c.health === 'red').length

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Agency Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">{clients.length} clients · all-business view</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 mb-1">Total Clients</p>
          <p className="text-2xl font-bold text-slate-900">{clients.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 mb-1">Monthly Recurring</p>
          <p className="text-2xl font-bold text-slate-900">${totalMrr.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <p className="text-xs text-slate-500">Active</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{greenCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <p className="text-xs text-slate-500">Needs Attention</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{yellowCount + redCount}</p>
        </div>
      </div>

      {/* Client table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Niche</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">MRR</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Leads 7d</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Bookings 30d</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Setup</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Health</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="font-medium text-slate-900">{client.name}</p>
                      <p className="text-xs text-slate-400">{client.twilio_number ?? 'No Twilio number'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 capitalize text-slate-600">{client.niche}</td>
                  <td className="px-4 py-3.5 text-right font-medium text-slate-900">
                    {client.mrr > 0 ? `$${client.mrr}` : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-700">{client.leadsLast7d}</td>
                  <td className="px-4 py-3.5 text-right text-slate-700">{client.bookingsLast30d}</td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${client.setupPct}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-8 text-right">{client.setupPct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center">{healthBadge(client.health)}</td>
                  <td className="px-4 py-3.5">
                    <a
                      href={`/admin/businesses/${client.id}`}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      Manage →
                    </a>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">
                    No clients yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
