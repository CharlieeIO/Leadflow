import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { CalendarView } from '@/components/appointments/calendar-view'
import type { AppointmentStatus } from '@/types'

export interface CalAppointment {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: AppointmentStatus
  notes: string | null
  lead_name: string | null
  lead_phone: string
  lead_id: string
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

  const { data: raw } = await supabase
    .from('appointments')
    .select(`id, scheduled_at, duration_minutes, status, notes, leads ( id, name, phone )`)
    .eq('business_id', business.id)
    .order('scheduled_at', { ascending: true })
    .limit(200)

  const appointments: CalAppointment[] = (raw ?? []).map((a) => {
    const lead = a.leads as { id: string; name: string | null; phone: string } | null
    return {
      id: a.id,
      scheduled_at: a.scheduled_at,
      duration_minutes: a.duration_minutes,
      status: a.status as AppointmentStatus,
      notes: a.notes,
      lead_name: lead?.name ?? null,
      lead_phone: lead?.phone ?? '',
      lead_id: lead?.id ?? '',
    }
  })

  return <CalendarView appointments={appointments} />
}
