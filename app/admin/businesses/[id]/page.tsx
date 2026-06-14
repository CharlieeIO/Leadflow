import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { cn, formatPhone, timeAgo } from '@/lib/utils'

export default async function AdminBusinessPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect('/dashboard')

  const service = getSupabaseServiceClient()

  const { data: business } = await service
    .from('businesses')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!business) notFound()

  const [{ data: leads }, { data: appts }, { data: interactions }] = await Promise.all([
    service
      .from('leads')
      .select('id, name, phone, status, source, created_at')
      .eq('business_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    service
      .from('appointments')
      .select('id, scheduled_at, status')
      .eq('business_id', id)
      .order('scheduled_at', { ascending: false })
      .limit(5),
    service
      .from('ai_interactions')
      .select('latency_ms, created_at')
      .eq('business_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const avgLatency = interactions?.length
    ? Math.round(interactions.reduce((s, r) => s + (r.latency_ms ?? 0), 0) / interactions.length / 1000 * 10) / 10
    : null

  const settings = business.settings as Record<string, string> ?? {}

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">← Admin</Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-xl font-bold text-slate-900">{business.name}</h1>
          <span className={cn(
            'ml-auto text-xs font-medium px-2 py-0.5 rounded-full',
            business.active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400',
          )}>
            {business.active ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total leads',  value: leads?.length ?? 0 },
                { label: 'Appointments', value: appts?.length ?? 0 },
                { label: 'Avg AI (s)',   value: avgLatency ?? '—' },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                  <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Recent leads */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Recent leads</h2>
              </div>
              {leads?.length ? (
                <div className="divide-y divide-slate-100">
                  {leads.map((l) => (
                    <div key={l.id} className="flex items-center gap-4 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {l.name ?? formatPhone(l.phone)}
                        </p>
                        <p className="text-xs text-slate-400">{l.source} · {timeAgo(l.created_at)}</p>
                      </div>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">
                        {l.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-5 py-8 text-sm text-slate-400 text-center">No leads yet.</p>
              )}
            </div>
          </div>

          {/* Right column — business info */}
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">Details</h2>
              {[
                { label: 'ID',      value: <span className="font-mono text-xs">{business.id}</span> },
                { label: 'Niche',   value: business.niche },
                { label: 'Phone',   value: business.twilio_number ?? 'Not set' },
                { label: 'Retell',  value: business.retell_agent_id ?? 'Not set' },
                { label: 'Cal ID',  value: business.cal_event_type_id ?? 'Not set' },
                { label: 'Created', value: new Date(business.created_at).toLocaleDateString() },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-start gap-2 text-sm">
                  <span className="text-slate-500 shrink-0">{row.label}</span>
                  <span className="text-slate-800 text-right truncate">{row.value}</span>
                </div>
              ))}
            </div>

            {/* Settings snapshot */}
            {Object.keys(settings).length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">Settings</h2>
                {Object.entries(settings).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-start gap-2 text-sm">
                    <span className="text-slate-500 shrink-0">{k}</span>
                    <span className="text-slate-800 text-right truncate max-w-[140px]">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
