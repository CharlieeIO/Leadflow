'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'All',       value: '' },
  { label: 'New',       value: 'new' },
  { label: 'Hot',       value: 'hot' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Booked',    value: 'booked' },
  { label: 'Escalated', value: 'escalated' },
]

export function StatusFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get('status') ?? ''

  function setStatus(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set('status', value)
    } else {
      params.delete('status')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => setStatus(tab.value)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            current === tab.value
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-900',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
