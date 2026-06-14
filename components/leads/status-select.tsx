'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { LeadStatus } from '@/types'

const STATUSES: LeadStatus[] = [
  'new', 'contacted', 'qualifying', 'hot', 'warm',
  'cold', 'booked', 'completed', 'lost', 'escalated',
]

const STATUS_COLORS: Record<string, string> = {
  new:        'bg-blue-50 text-blue-700 border-blue-200',
  contacted:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  qualifying: 'bg-purple-50 text-purple-700 border-purple-200',
  hot:        'bg-orange-50 text-orange-700 border-orange-200',
  warm:       'bg-yellow-50 text-yellow-700 border-yellow-200',
  cold:       'bg-slate-100 text-slate-500 border-slate-200',
  booked:     'bg-green-50 text-green-700 border-green-200',
  completed:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  lost:       'bg-slate-100 text-slate-400 border-slate-200',
  escalated:  'bg-red-50 text-red-700 border-red-200',
  opted_out:  'bg-slate-100 text-slate-400 border-slate-200',
}

interface StatusSelectProps {
  leadId: string
  currentStatus: string
}

export function StatusSelect({ leadId, currentStatus }: StatusSelectProps) {
  const [status, setStatus] = useState(currentStatus)
  const [saving, setSaving] = useState(false)

  async function handleChange(newStatus: string) {
    if (newStatus === status) return
    setSaving(true)
    setStatus(newStatus)
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
    } catch {
      setStatus(status) // revert on failure
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative">
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className={cn(
          'text-xs font-medium px-2.5 py-1 rounded-full border capitalize cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          'disabled:opacity-60',
          STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-500 border-slate-200',
        )}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s} className="bg-white text-slate-800">
            {s.replace('_', ' ')}
          </option>
        ))}
      </select>
    </div>
  )
}
