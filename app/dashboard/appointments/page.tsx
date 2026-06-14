import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import type { AppointmentStatus } from '@/types'

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending:   'bg-blue-50 text-blue-700',
  confirmed: 'bg-green-50 text-green-700',
  completed: 'bg-emerald-50 text-emerald-700',
  no_show:   'bg-red-50 text-red-600',
  cancelled: 'bg-slate-100 text-slate-400',
}

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  }
}

export default async function AppointmentsPage() {
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (!business) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500 text-sm">No business found. Contact support.</p>
      </div>
    )
  }

  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      id, scheduled_at, duration_minutes, status, notes,
      leads ( id, name, phone )
    `)
    .eq('business_id', business.id)
    .order('scheduled_at', { ascending: false })
    .limit(100)

  const upcoming = (appointments ?? []).filter(
    (a) => a.status === 'pending' || a.status === 'confirmed',
  )
  const past = (appointments ?? []).filter(
    (a) => a.status !== 'pending' && a.status !== 'confirmed',
  )

  function AppointmentRow({ appt }: { appt: NonNullable<typeof appointments>[number] }) {
    const lead = appt.leads as { id: string; name: string | null; phone: string } | null
    const { date, time } = formatDateTime(appt.scheduled_at)
    const displayName = lead?.name ?? lead?.phone ?? 'Unknown'

    return (
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="text-center w-14 shrink-0">
          <p className="text-lg font-bold text-slate-900 leading-none">
            {new Date(appt.scheduled_at).getDate()}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {new Date(appt.scheduled_at).toLocaleDateString('en-US', { month: 'short' })}
          </p>
        </div>

        <div className="w-px h-10 bg-slate-100 shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{displayName}</p>
          <p className="text-xs text-slate-400">{date} at {time} · {appt.duration_minutes} min</p>
          {appt.notes && <p className="text-xs text-slate-500 truncate mt-0.5">{appt.notes}</p>}
        </div>

        <span className={cn(
          'text-xs font-medium px-2 py-0.5 rounded-full capitalize shrink-0',
          STATUS_COLORS[appt.status as AppointmentStatus] ?? 'bg-slate-100 text-slate-500',
        )}>
          {appt.status.replace('_', ' ')}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">
          Upcoming ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <p className="text-slate-400 text-sm">No upcoming appointments.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {upcoming.map((a) => <AppointmentRow key={a.id} appt={a} />)}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 mb-3">Past ({past.length})</h2>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden opacity-75">
            {past.map((a) => <AppointmentRow key={a.id} appt={a} />)}
          </div>
        </div>
      )}
    </div>
  )
}
