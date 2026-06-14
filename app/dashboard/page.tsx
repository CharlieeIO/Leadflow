'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Users, Calendar, Zap, Target, DollarSign } from 'lucide-react'
import { StatusPanel } from '@/components/dashboard/status-panel'
import type { DashboardStats } from '@/types'
import { cn } from '@/lib/utils'
import Link from 'next/link'

function StatCard({
  label,
  value,
  change,
  icon: Icon,
  format = 'number',
  prompt,
}: {
  label: string
  value: number
  change: number
  icon: React.ElementType
  format?: 'number' | 'minutes' | 'percent' | 'currency'
  prompt?: React.ReactNode
}) {
  const formatted =
    format === 'percent' ? `${value}%`
    : format === 'minutes' ? `${value}m`
    : format === 'currency' ? `$${value.toLocaleString()}`
    : value.toLocaleString()

  const positive = change >= 0

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500">{label}</p>
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
          <Icon size={15} className="text-blue-600" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 mb-1">{formatted}</p>
      {prompt ? (
        prompt
      ) : change !== 0 ? (
        <div className={cn('flex items-center gap-1 text-xs font-medium', positive ? 'text-green-600' : 'text-red-500')}>
          {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {positive ? '+' : ''}{change}% vs last 7 days
        </div>
      ) : (
        <p className="text-xs text-slate-400">vs last 7 days</p>
      )}
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
            <div className="w-8 h-8 bg-slate-100 rounded-lg animate-pulse" />
          </div>
          <div className="h-8 w-20 bg-slate-100 rounded animate-pulse mb-1" />
          <div className="h-3.5 w-28 bg-slate-50 rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      {loading ? (
        <StatsSkeleton />
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <StatCard label="New Leads (7d)" value={stats.totalLeads} change={stats.totalLeadsChange} icon={Users} />
          <StatCard label="Appointments (7d)" value={stats.appointmentsBooked} change={stats.appointmentsChange} icon={Calendar} />
          <StatCard label="Avg Response Time" value={stats.avgResponseTimeMinutes} change={stats.avgResponseTimeChange} icon={Zap} format="minutes" />
          <StatCard label="Conversion Rate" value={stats.conversionRate} change={stats.conversionRateChange} icon={Target} format="percent" />
          <StatCard
            label="Revenue Recovered"
            value={stats.revenueThisMonth}
            change={0}
            icon={DollarSign}
            format="currency"
            prompt={
              stats.avgJobValue === 0 ? (
                <Link href="/dashboard/settings" className="text-xs text-blue-600 hover:underline">
                  Set avg job value to calculate →
                </Link>
              ) : (
                <p className="text-xs text-slate-400">this period · {stats.appointmentsBooked} bookings</p>
              )
            }
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-400">Could not load stats.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-900 mb-4">Leads — last 14 days</p>
          <div className="h-48 bg-slate-50 rounded-lg flex items-center justify-center">
            <p className="text-sm text-slate-400">Chart coming in a future session</p>
          </div>
        </div>
        <StatusPanel />
      </div>
    </div>
  )
}
