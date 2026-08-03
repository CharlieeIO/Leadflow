import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { cn, timeAgo } from '@/lib/utils'
import { Shield, Users, Calendar, DollarSign, AlertTriangle, CheckCircle, XCircle, Clock, Zap } from 'lucide-react'
import { DeleteBusinessButton } from '@/components/admin/delete-business-button'

const NICHE_LABELS: Record<string, string> = {
  roofing: 'Roofing', hvac: 'HVAC', medspa: 'Med Spa',
  autodetail: 'Auto Detail', realtor: 'Realtor',
}

const PLAN_MRR: Record<string, number> = { starter: 297, growth: 497, pro: 797 }

type Health = 'green' | 'yellow' | 'red'

function HealthDot({ health }: { health: Health }) {
  return (
    <span className={cn(
      'inline-block w-2 h-2 rounded-full shrink-0',
      health === 'green' ? 'bg-green-500' : health === 'yellow' ? 'bg-amber-400' : 'bg-red-500',
    )} />
  )
}

function StatCard({ label, value, sub, icon: Icon, color = 'blue' }: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color?: 'blue' | 'green' | 'violet' | 'amber'
}) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    violet: 'bg-violet-50 text-violet-600',
    amber:  'bg-amber-50 text-amber-600',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', colors[color])}>
          <Icon size={15} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

export default async function AdminPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect('/dashboard')

  const service = getSupabaseServiceClient()

  const [
    { data: businesses },
    { data: allLeads },
    { data: allAppts },
    { data: subscriptions },
    { data: recentEscalations },
    { data: recentErrors },
  ] = await Promise.all([
    service.from('businesses')
      .select('id, name, niche, twilio_number, active, created_at, settings')
      .order('created_at', { ascending: false }),
    service.from('leads').select('business_id, created_at'),
    service.from('appointments').select('business_id, status'),
    service.from('subscriptions').select('business_id, plan, status'),
    service.from('leads')
      .select('id, name, phone, business_id, escalation_reason, updated_at')
      .eq('status', 'escalated')
      .order('updated_at', { ascending: false })
      .limit(5),
    service.from('analytics_events')
      .select('id, business_id, event_type, properties, created_at')
      .eq('event_type', 'ai_error')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // Build lookup maps
  const leadMap = new Map<string, number>()
  const apptMap = new Map<string, number>()
  const subMap = new Map<string, { plan: string; status: string }>()

  for (const r of allLeads ?? []) leadMap.set(r.business_id, (leadMap.get(r.business_id) ?? 0) + 1)
  for (const r of allAppts ?? []) apptMap.set(r.business_id, (apptMap.get(r.business_id) ?? 0) + 1)
  for (const r of subscriptions ?? []) subMap.set(r.business_id, { plan: r.plan, status: r.status })

  // Business names for escalation display
  const bizNameMap = new Map((businesses ?? []).map((b) => [b.id, b.name]))

  // MRR calculation
  const totalMrr = (subscriptions ?? [])
    .filter((s) => s.status === 'active' || s.status === 'trialing')
    .reduce((sum, s) => sum + (PLAN_MRR[s.plan] ?? 0), 0)

  // Active count
  const activeCount = (businesses ?? []).filter((b) => b.active).length

  // Env var health checks
  const envChecks = [
    { label: 'Supabase',    ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL },
    { label: 'Twilio',      ok: !!process.env.TWILIO_ACCOUNT_SID },
    { label: 'Anthropic',   ok: !!process.env.ANTHROPIC_API_KEY },
    { label: 'Stripe',      ok: !!process.env.STRIPE_SECRET_KEY },
    { label: 'Resend',      ok: !!process.env.RESEND_API_KEY },
    { label: 'Admin secret',ok: !!process.env.ADMIN_SECRET },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-7">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Admin Panel</h1>
              <p className="text-xs text-slate-500">Logged in as {user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/agency" className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Agency View
            </Link>
            <Link href="/admin/businesses/new" className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              + New Business
            </Link>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Businesses" value={businesses?.length ?? 0} sub={`${activeCount} active`} icon={Users} color="blue" />
          <StatCard label="Monthly Revenue" value={`$${totalMrr.toLocaleString()}`} sub="active + trialing" icon={DollarSign} color="green" />
          <StatCard label="Total Leads" value={allLeads?.length ?? 0} icon={Zap} color="violet" />
          <StatCard label="Appointments" value={allAppts?.length ?? 0} sub={`${(allAppts ?? []).filter(a => a.status === 'confirmed').length} confirmed`} icon={Calendar} color="amber" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Business table — takes up 2/3 */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">All Businesses</h2>
                <span className="text-xs text-slate-400">{businesses?.length ?? 0} total</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Business</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Leads</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(businesses ?? []).map((b) => {
                      const sub = subMap.get(b.id)
                      const leads7d = (allLeads ?? []).filter(l =>
                        l.business_id === b.id &&
                        new Date(l.created_at) > new Date(Date.now() - 7 * 86400000)
                      ).length
                      const hasTwilio = !!b.twilio_number
                      const health: Health = b.active && hasTwilio && leads7d > 0 ? 'green'
                        : b.active && !hasTwilio ? 'yellow'
                        : !b.active ? 'red' : 'yellow'

                      return (
                        <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <HealthDot health={health} />
                              <div>
                                <p className="font-medium text-slate-900">{b.name}</p>
                                <p className="text-xs text-slate-400 capitalize">{NICHE_LABELS[b.niche] ?? b.niche}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            {sub ? (
                              <div>
                                <p className="text-sm font-medium text-slate-700 capitalize">{sub.plan}</p>
                                <p className={cn('text-xs', sub.status === 'active' ? 'text-green-600' : sub.status === 'trialing' ? 'text-blue-600' : 'text-amber-600')}>
                                  {sub.status}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No plan</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <p className="font-medium text-slate-700">{leadMap.get(b.id) ?? 0}</p>
                            <p className="text-xs text-slate-400">{leads7d} this week</p>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={cn(
                              'text-xs font-medium px-2 py-0.5 rounded-full',
                              b.active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400',
                            )}>
                              {b.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <Link href={`/admin/businesses/${b.id}`} className="text-xs text-blue-600 hover:underline font-medium">
                                Manage
                              </Link>
                              <span className="text-slate-300">·</span>
                              <Link href={`/admin/businesses/${b.id}`} className="text-xs text-slate-500 hover:underline">
                                Settings
                              </Link>
                              <span className="text-slate-300">·</span>
                              <DeleteBusinessButton id={b.id} name={b.name} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {!businesses?.length && (
                      <tr>
                        <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">
                          No businesses yet. <Link href="/admin/businesses/new" className="text-blue-600 hover:underline">Create the first one →</Link>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Escalations */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                <AlertTriangle size={15} className="text-amber-500" />
                <h2 className="text-sm font-semibold text-slate-900">Recent Escalations</h2>
              </div>
              {recentEscalations?.length ? (
                <div className="divide-y divide-slate-50">
                  {recentEscalations.map((e) => (
                    <div key={e.id} className="flex items-start gap-3 px-5 py-3.5">
                      <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle size={13} className="text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{e.name ?? e.phone}</p>
                        <p className="text-xs text-slate-500 truncate">{e.escalation_reason ?? 'No reason provided'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{bizNameMap.get(e.business_id) ?? 'Unknown'} · {timeAgo(e.updated_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-8 text-center">
                  <CheckCircle size={20} className="text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No escalations — all good</p>
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">

            {/* System health */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <h2 className="text-sm font-semibold text-slate-900">System Health</h2>
              </div>
              <div className="p-4 space-y-2">
                {envChecks.map(({ label, ok }) => (
                  <div key={label} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-slate-600">{label}</span>
                    {ok
                      ? <CheckCircle size={15} className="text-green-500" />
                      : <XCircle size={15} className="text-red-400" />
                    }
                  </div>
                ))}
              </div>
            </div>

            {/* Cron status */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                <Clock size={14} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-900">Cron Jobs</h2>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { name: 'Lead Sequences', schedule: 'Every 30 min', path: '/api/cron/sequences' },
                  { name: 'Reminders', schedule: 'Every 15 min', path: '/api/cron/reminders' },
                  { name: 'Weekly Report', schedule: 'Mon 8am UTC', path: '/api/cron/weekly-report' },
                ].map((job) => (
                  <div key={job.name} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{job.name}</p>
                      <p className="text-xs text-slate-400">{job.schedule}</p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                  </div>
                ))}
                <p className="text-xs text-slate-400 pt-1 border-t border-slate-100">
                  Running via cron-job.org
                </p>
              </div>
            </div>

            {/* Quick links */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Quick Links</h2>
              </div>
              <div className="p-2">
                {[
                  { label: 'Agency Dashboard', href: '/agency' },
                  { label: 'Create New Business', href: '/admin/businesses/new' },
                  { label: 'My Dashboard', href: '/dashboard' },
                  { label: 'Settings', href: '/dashboard/settings' },
                ].map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    {label}
                    <span className="text-slate-300">→</span>
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
