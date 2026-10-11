'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Users, Calendar, Zap, Target, DollarSign } from 'lucide-react'
import { StatusPanel } from '@/components/dashboard/status-panel'
import type { DashboardStats } from '@/types'
import { cn } from '@/lib/utils'
import Link from 'next/link'

type ChartDay = { date: string; count: number }

function LeadsChart({ days }: { days: ChartDay[] }) {
  const max = Math.max(...days.map((d) => d.count), 1)
  const today = new Date().toISOString().slice(0, 10)
  const BAR = 28
  const GAP = 12
  const CHART_H = 96
  const LABEL_H = 18
  const W = days.length * (BAR + GAP) - GAP
  const H = CHART_H + LABEL_H + 18

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }}>
      {days.map((day, i) => {
        const barH = Math.max((day.count / max) * CHART_H, day.count > 0 ? 5 : 1.5)
        const x = i * (BAR + GAP)
        const y = 18 + CHART_H - barH
        const isToday = day.date === today
        const label = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)

        return (
          <g key={day.date}>
            <rect x={x} y={y} width={BAR} height={barH} rx={4} fill={isToday ? '#2563EB' : '#BFDBFE'} />
            {day.count > 0 && (
              <text x={x + BAR / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="#6B7280">
                {day.count}
              </text>
            )}
            <text
              x={x + BAR / 2} y={18 + CHART_H + LABEL_H - 1}
              textAnchor="middle" fontSize={9}
              fill={isToday ? '#2563EB' : '#9CA3AF'}
              fontWeight={isToday ? '700' : '400'}
            >
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function ChartSkeleton() {
  const heights = [35, 55, 45, 70, 50, 30, 80, 60, 40, 90, 65, 45, 75, 55]
  return (
    <div className="flex items-end gap-1.5 px-1" style={{ height: 180, alignItems: 'flex-end' }}>
      {heights.map((h, i) => (
        <div key={i} className="flex-1 bg-slate-100 rounded animate-pulse" style={{ height: `${h}%` }} />
      ))}
    </div>
  )
}

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
  const [chartDays, setChartDays] = useState<ChartDay[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/stats').then((r) => r.ok ? r.json() : null),
      fetch('/api/dashboard/chart').then((r) => r.ok ? r.json() : null),
    ]).then(([statsData, chartData]) => {
      setStats(statsData)
      setChartDays(chartData?.days ?? null)
      setLoading(false)
    }).catch(() => setLoading(false))
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
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-900">Leads — last 14 days</p>
            {chartDays && (
              <p className="text-xs text-slate-400">
                {chartDays.reduce((s, d) => s + d.count, 0)} total
              </p>
            )}
          </div>
          {loading ? (
            <ChartSkeleton />
          ) : chartDays?.length ? (
            <LeadsChart days={chartDays} />
          ) : (
            <div className="flex items-center justify-center" style={{ height: 180 }}>
              <p className="text-sm text-slate-400">No leads yet — share your number to get started.</p>
            </div>
          )}
        </div>
        <StatusPanel />
      </div>
    </div>
  )
}
