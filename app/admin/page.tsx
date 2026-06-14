import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

const NICHE_LABELS: Record<string, string> = {
  roofing: 'Roofing', hvac: 'HVAC', medspa: 'Med Spa',
  autodetail: 'Auto Detail', realtor: 'Realtor',
}

export default async function AdminPage() {
  // Auth check — middleware handles redirect, but double-check here
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect('/dashboard')

  const service = getSupabaseServiceClient()

  const { data: businesses } = await service
    .from('businesses')
    .select('id, name, niche, twilio_number, active, created_at, owner_user_id')
    .order('created_at', { ascending: false })

  const ids = (businesses ?? []).map((b) => b.id)

  const [{ data: leadRows }, { data: apptRows }] = await Promise.all([
    service.from('leads').select('business_id').in('business_id', ids),
    service.from('appointments').select('business_id').in('business_id', ids),
  ])

  const leadMap = new Map<string, number>()
  const apptMap = new Map<string, number>()
  for (const r of leadRows  ?? []) leadMap.set(r.business_id, (leadMap.get(r.business_id) ?? 0) + 1)
  for (const r of apptRows  ?? []) apptMap.set(r.business_id, (apptMap.get(r.business_id) ?? 0) + 1)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
            <p className="text-sm text-slate-500 mt-0.5">{businesses?.length ?? 0} businesses</p>
          </div>
          <Link
            href="/admin/businesses/new"
            className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New business
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total businesses', value: businesses?.length ?? 0 },
            { label: 'Active',           value: businesses?.filter((b) => b.active).length ?? 0 },
            { label: 'Total leads',      value: leadRows?.length ?? 0 },
            { label: 'Total appts',      value: apptRows?.length ?? 0 },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900">{s.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Business table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Business</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Niche</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Leads</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Appts</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(businesses ?? []).map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/admin/businesses/${b.id}`}
                      className="font-medium text-slate-900 hover:text-blue-600 transition-colors"
                    >
                      {b.name}
                    </Link>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{b.id.slice(0, 8)}…</p>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {NICHE_LABELS[b.niche] ?? b.niche}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-slate-600 text-xs">
                    {b.twilio_number ?? <span className="text-slate-400 italic font-sans">None</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium text-slate-700">
                    {leadMap.get(b.id) ?? 0}
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium text-slate-700">
                    {apptMap.get(b.id) ?? 0}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      b.active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400',
                    )}>
                      {b.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs">
                    {new Date(b.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {!businesses?.length && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">
                    No businesses yet. Create the first one.
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
