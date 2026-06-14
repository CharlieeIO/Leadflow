'use client'

import { useState, useRef } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  leadId: string
  personaName: string
  onSent?: (msg: { id: string; body: string; created_at: string }) => void
}

export function ManualReply({ leadId, personaName, onSent }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setError('')

    try {
      const res = await fetch(`/api/leads/${leadId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })

      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to send')
        return
      }

      const { message } = await res.json()
      setText('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      onSent?.(message)
    } catch {
      setError('Network error')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    // auto-grow
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={`Reply as ${personaName}…`}
          className={cn(
            'flex-1 resize-none rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm',
            'placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
            'outline-none transition-colors leading-relaxed',
          )}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className={cn(
            'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
            'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed',
          )}
          title={`Send as ${personaName}`}
        >
          <Send size={15} />
        </button>
      </div>
      <p className="mt-1.5 text-xs text-slate-400">
        Sending as <span className="font-medium">{personaName}</span> · Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  )
}
