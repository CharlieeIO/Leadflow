'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

type ServiceStatus = 'ok' | 'warn' | 'error' | 'unknown'

interface ServiceCheck {
  name: string
  status: ServiceStatus
  detail: string
}

interface StatusData {
  services: ServiceCheck[]
  lastLead: string | null
  lastAiMessage: string | null
  checkedAt: string
}

function StatusDot({ status }: { status: ServiceStatus }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 text-xs font-medium',
      status === 'ok'      && 'text-green-600',
      status === 'warn'    && 'text-amber-600',
      status === 'error'   && 'text-red-600',
      status === 'unknown' && 'text-slate-400',
    )}>
      {status === 'ok'      && <CheckCircle size={13} />}
      {status === 'warn'    && <AlertCircle size={13} />}
      {status === 'error'   && <XCircle size={13} />}
      {status === 'unknown' && <AlertCircle size={13} />}
      {status === 'ok' ? 'Online' : status === 'warn' ? 'Warning' : status === 'error' ? 'Error' : 'Not configured'}
    </span>
  )
}

export function StatusPanel() {
  const [data, setData] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/status')
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">System Status</h3>
        <button
          onClick={load}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !data ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex justify-between items-center">
              <div className="h-3.5 w-20 bg-slate-100 rounded animate-pulse" />
              <div className="h-3.5 w-14 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : data ? (
        <div className="space-y-3">
          {data.services.map((svc) => (
            <div key={svc.name} className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-700">{svc.name}</p>
                {svc.detail && (
                  <p className="text-xs text-slate-400">{svc.detail}</p>
                )}
              </div>
              <StatusDot status={svc.status} />
            </div>
          ))}

          <div className="pt-3 mt-3 border-t border-slate-100 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Last lead</span>
              <span className="text-slate-700">{data.lastLead ?? 'None yet'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Last AI message</span>
              <span className="text-slate-700">{data.lastAiMessage ?? 'None yet'}</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">Could not load status.</p>
      )}
    </div>
  )
}
