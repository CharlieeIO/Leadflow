'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CalAppointment } from '@/app/dashboard/appointments/page'
import type { AppointmentStatus } from '@/types'
import Link from 'next/link'

const STATUS_PILL: Record<AppointmentStatus, string> = {
  pending:   'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-emerald-100 text-emerald-700',
  no_show:   'bg-red-100 text-red-600',
  cancelled: 'bg-slate-100 text-slate-400',
}

const STATUS_DOT: Record<AppointmentStatus, string> = {
  pending:   'bg-blue-500',
  confirmed: 'bg-green-500',
  completed: 'bg-emerald-400',
  no_show:   'bg-red-400',
  cancelled: 'bg-slate-300',
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export function CalendarView({ appointments }: { appointments: CalAppointment[] }) {
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState<CalAppointment | null>(null)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Map appointment date → list of appointments
  const byDate = new Map<string, CalAppointment[]>()
  for (const appt of appointments) {
    const d = new Date(appt.scheduled_at)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = String(d.getDate())
      const arr = byDate.get(key) ?? []
      arr.push(appt)
      byDate.set(key, arr)
    }
  }

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  // Upcoming (next 7 days)
  const upcoming = appointments.filter((a) => {
    const d = new Date(a.scheduled_at)
    const diff = (d.getTime() - today.getTime()) / 86400000
    return diff >= 0 && diff <= 7 && (a.status === 'pending' || a.status === 'confirmed')
  })

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'This month', value: appointments.filter(a => { const d = new Date(a.scheduled_at); return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear() }).length },
          { label: 'Upcoming (7d)', value: upcoming.length },
          { label: 'Completed', value: appointments.filter(a => a.status === 'completed').length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Calendar grid */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <ChevronLeft size={16} className="text-slate-500" />
            </button>
            <h2 className="text-sm font-semibold text-slate-900">
              {MONTHS[month]} {year}
            </h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <ChevronRight size={16} className="text-slate-500" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {DAYS.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-slate-400">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Empty cells before month starts */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e${i}`} className="min-h-[80px] border-b border-r border-slate-50" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const appts = byDate.get(String(day)) ?? []
              const isT = isToday(day)

              return (
                <div
                  key={day}
                  className={cn(
                    'min-h-[80px] p-1.5 border-b border-r border-slate-50 transition-colors',
                    appts.length > 0 ? 'hover:bg-blue-50/30 cursor-pointer' : '',
                  )}
                  onClick={() => appts.length > 0 && setSelected(appts[0])}
                >
                  <div className={cn(
                    'w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1',
                    isT ? 'bg-blue-600 text-white' : 'text-slate-600',
                  )}>
                    {day}
                  </div>

                  <div className="space-y-0.5">
                    {appts.slice(0, 2).map((a) => (
                      <div
                        key={a.id}
                        onClick={(e) => { e.stopPropagation(); setSelected(a) }}
                        className={cn(
                          'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium truncate cursor-pointer',
                          STATUS_PILL[a.status],
                        )}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT[a.status])} />
                        <span className="truncate">{a.lead_name ?? a.lead_phone}</span>
                      </div>
                    ))}
                    {appts.length > 2 && (
                      <p className="text-xs text-slate-400 px-1">+{appts.length - 2} more</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Detail panel */}
          {selected ? (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{selected.lead_name ?? selected.lead_phone}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(selected.scheduled_at)}</p>
                </div>
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize', STATUS_PILL[selected.status])}>
                  {selected.status.replace('_', ' ')}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock size={14} className="text-slate-400 shrink-0" />
                  {formatTime(selected.scheduled_at)} · {selected.duration_minutes} min
                </div>
                {selected.lead_phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <User size={14} className="text-slate-400 shrink-0" />
                    {selected.lead_phone}
                  </div>
                )}
                {selected.notes && (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-100">
                    {selected.notes}
                  </p>
                )}
              </div>

              {selected.lead_id && (
                <Link
                  href={`/dashboard/leads/${selected.lead_id}`}
                  className="mt-4 block w-full text-center py-2 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 rounded-lg transition-colors"
                >
                  View conversation →
                </Link>
              )}

              <button
                onClick={() => setSelected(null)}
                className="mt-2 block w-full text-center py-2 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
              >
                Dismiss
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
              <p className="text-xs text-slate-400">Click any appointment to see details</p>
            </div>
          )}

          {/* Upcoming list */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Next 7 days</h3>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Nothing scheduled</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {upcoming.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT[a.status])} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{a.lead_name ?? a.lead_phone}</p>
                      <p className="text-xs text-slate-400">{formatTime(a.scheduled_at)} · {new Date(a.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
