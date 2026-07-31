'use client'

import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { BusinessSettings, QuickReply } from '@/types'

const inputClass = cn(
  'w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900',
  'placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors',
)

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-2">
      <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
      {message}
    </div>
  )
}

export default function AIConsolePage() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [toneLevel, setToneLevel] = useState(50)
  const [delaySeconds, setDelaySeconds] = useState<0 | 15 | 30 | 60>(0)
  const [quietEnabled, setQuietEnabled] = useState(false)
  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd, setQuietEnd] = useState('07:00')
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [customInstructions, setCustomInstructions] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  // Test panel
  const [testMessage, setTestMessage] = useState('')
  const [testResponse, setTestResponse] = useState('')
  const [testing, setTesting] = useState(false)
  const testRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        const s: BusinessSettings = d.settings ?? {}
        setSettings(s)
        setToneLevel(s.ai_tone_level ?? 50)
        setDelaySeconds((s.response_delay_seconds ?? 0) as 0 | 15 | 30 | 60)
        setQuietEnabled(s.quiet_hours_enabled ?? false)
        setQuietStart(s.quiet_hours_start ?? '22:00')
        setQuietEnd(s.quiet_hours_end ?? '07:00')
        setQuickReplies(s.quick_replies ?? [])
        setCustomInstructions(s.custom_instructions ?? '')
      })
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          ...settings,
          ai_tone_level: toneLevel,
          response_delay_seconds: delaySeconds,
          quiet_hours_enabled: quietEnabled,
          quiet_hours_start: quietStart,
          quiet_hours_end: quietEnd,
          quick_replies: quickReplies.filter((r) => r.label.trim() && r.body.trim()),
          custom_instructions: customInstructions,
        },
      }),
    })
    setSaving(false)
    if (res.ok) setToast('AI settings saved successfully')
  }

  async function runTest() {
    if (!testMessage.trim()) return
    setTesting(true)
    setTestResponse('')
    const res = await fetch('/api/ai-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: testMessage, tone_level: toneLevel }),
    })
    const d = await res.json()
    setTestResponse(d.response ?? d.error ?? 'No response')
    setTesting(false)
  }

  const toneLabel = toneLevel <= 25 ? 'Professional' : toneLevel <= 60 ? 'Friendly' : 'Casual'
  const toneColor = toneLevel <= 25 ? 'text-slate-600' : toneLevel <= 60 ? 'text-blue-600' : 'text-violet-600'

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 h-32 animate-pulse bg-slate-50" />
        ))}
      </div>
    )
  }

  return (
    <>
      {toast && <Toast message={toast} onDone={() => setToast('')} />}

      <div className="max-w-2xl space-y-5">
        <div>
          <h1 className="text-lg font-bold text-slate-900">AI Console</h1>
          <p className="text-sm text-slate-500 mt-0.5">Control exactly how your AI behaves in every conversation.</p>
        </div>

        {/* Tone */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-slate-900">Conversation tone</h2>
            <span className={cn('text-sm font-semibold', toneColor)}>{toneLabel}</span>
          </div>
          <p className="text-xs text-slate-400 mb-5">
            Slide left for crisp and professional, right for warm and conversational.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 w-24 shrink-0">Professional</span>
            <input
              type="range"
              min={0}
              max={100}
              value={toneLevel}
              onChange={(e) => setToneLevel(Number(e.target.value))}
              className="flex-1 accent-blue-600 h-2 cursor-pointer"
            />
            <span className="text-xs text-slate-400 w-12 text-right shrink-0">Casual</span>
          </div>

          <div className="mt-5 bg-slate-50 rounded-lg p-3 border border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-2">Sample tone at this level</p>
            <p className="text-sm text-slate-700 italic">
              {toneLevel <= 25
                ? '"We would be happy to schedule a complimentary estimate at your earliest convenience."'
                : toneLevel <= 60
                ? '"Sounds good — want me to grab you a time that works?"'
                : '"Yeah totally, let\'s get you on the schedule. When works for you?"'}
            </p>
          </div>
        </section>

        {/* Response delay */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Response delay</h2>
          <p className="text-xs text-slate-400 mb-4">
            Add a pause before the AI replies — makes it feel like a real person typing.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {([0, 15, 30, 60] as const).map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setDelaySeconds(sec)}
                className={cn(
                  'py-2.5 rounded-lg text-sm font-medium border transition-colors',
                  delaySeconds === sec
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300',
                )}
              >
                {sec === 0 ? 'Instant' : `${sec}s`}
              </button>
            ))}
          </div>
        </section>

        {/* Quiet hours */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-slate-900">Quiet hours</h2>
            <button
              type="button"
              onClick={() => setQuietEnabled((v) => !v)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                quietEnabled ? 'bg-blue-600' : 'bg-slate-200',
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                  quietEnabled ? 'translate-x-6' : 'translate-x-1',
                )}
              />
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-4">AI goes silent during these hours. Messages are saved but not replied to.</p>

          {quietEnabled && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Stop responding at</label>
                <input
                  type="time"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Start responding again at</label>
                <input
                  type="time"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          )}
        </section>

        {/* Quick replies */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Quick reply templates</h2>
          <p className="text-xs text-slate-400 mb-4">
            Save canned messages you send often — available from the lead conversation view.
          </p>
          <div className="space-y-3">
            {quickReplies.map((r, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1.5">
                  <input
                    className={inputClass}
                    placeholder="Label (e.g. Send booking link)"
                    value={r.label}
                    onChange={(e) => {
                      const u = [...quickReplies]
                      u[i] = { ...u[i], label: e.target.value }
                      setQuickReplies(u)
                    }}
                  />
                  <textarea
                    className={cn(inputClass, 'resize-none h-16')}
                    placeholder="Message text…"
                    value={r.body}
                    onChange={(e) => {
                      const u = [...quickReplies]
                      u[i] = { ...u[i], body: e.target.value }
                      setQuickReplies(u)
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setQuickReplies(quickReplies.filter((_, j) => j !== i))}
                  className="mt-1 text-slate-300 hover:text-red-400 transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setQuickReplies([...quickReplies, { label: '', body: '' }])}
            className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            + Add template
          </button>
        </section>

        {/* Custom instructions */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Custom instructions</h2>
          <p className="text-xs text-slate-400 mb-3">
            Anything extra the AI should always know or do. This overrides everything else.
          </p>
          <textarea
            className={cn(inputClass, 'resize-none')}
            rows={5}
            maxLength={600}
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="Always mention our 5-star Google rating. Never discuss competitor pricing. If they ask about financing, say we offer 0% for 12 months."
          />
          <p className="mt-1 text-right text-xs text-slate-400">{customInstructions.length}/600</p>
        </section>

        {/* Test panel */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Live AI test</h2>
          <p className="text-xs text-slate-400 mb-4">
            Send a test message and see exactly how the AI would respond with your current settings.
          </p>
          <textarea
            ref={testRef}
            rows={3}
            className={cn(inputClass, 'resize-none mb-3')}
            placeholder="Hey, my AC stopped working and it's 95 degrees out…"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runTest()
            }}
          />
          <button
            type="button"
            onClick={runTest}
            disabled={testing || !testMessage.trim()}
            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            {testing ? 'Thinking…' : 'Test response ⌘↵'}
          </button>

          {testResponse && (
            <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-xs font-medium text-blue-600 mb-2">AI would respond:</p>
              <p className="text-sm text-slate-800">{testResponse}</p>
            </div>
          )}
        </section>

        {/* Save */}
        <div className="flex items-center gap-3 pb-8">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  )
}
