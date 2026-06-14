'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface AiPauseToggleProps {
  leadId: string
  initialPaused: boolean
}

export function AiPauseToggle({ leadId, initialPaused }: AiPauseToggleProps) {
  const [paused, setPaused] = useState(initialPaused)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const next = !paused
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_paused: next }),
      })
      if (res.ok) setPaused(next)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-700">AI Responses</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {paused ? 'Paused — you are handling this lead' : 'Active — AI is responding'}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={loading}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent',
          'transition-colors duration-200 focus:outline-none disabled:opacity-60',
          paused ? 'bg-slate-300' : 'bg-blue-600',
        )}
        role="switch"
        aria-checked={!paused}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow',
            'transform transition-transform duration-200',
            paused ? 'translate-x-0' : 'translate-x-5',
          )}
        />
      </button>
    </div>
  )
}
