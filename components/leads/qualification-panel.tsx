'use client'

import { useState } from 'react'
import {
  Sparkles,
  CheckCircle2,
  Clock,
  MapPin,
  Wrench,
  Save,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Brain,
} from 'lucide-react'

interface QualificationPanelProps {
  leadId: string
  serviceType: string | null
  metadata: {
    notes?: string
    key_takeaways?: string[]
    urgency?: string
    address?: string
    issue_description?: string
    grade?: 'A' | 'B' | 'C' | 'D'
    ai_summary?: string
    [key: string]: unknown
  }
}

const URGENCY_STYLES: Record<string, string> = {
  urgent: 'bg-red-50 text-red-700 border-red-200',
  routine: 'bg-blue-50 text-blue-700 border-blue-200',
  maintenance: 'bg-green-50 text-green-700 border-green-200',
  unknown: 'bg-slate-50 text-slate-500 border-slate-200',
}

export function QualificationPanel({ leadId, serviceType, metadata }: QualificationPanelProps) {
  const [notes, setNotes] = useState(metadata.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const takeaways = metadata.key_takeaways ?? []
  const urgency = metadata.urgency
  const address = metadata.address
  const issueDescription = metadata.issue_description
  const grade = metadata.grade
  const aiSummary = metadata.ai_summary

  const GRADE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    A: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Hot' },
    B: { bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'Good' },
    C: { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Warm' },
    D: { bg: 'bg-slate-100',   text: 'text-slate-500',   label: 'Cold' },
  }

  const hasAiData = !!(serviceType || urgency || address || issueDescription || takeaways.length || grade || aiSummary)

  async function saveNotes() {
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      // silent fail
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <Sparkles size={14} className="text-blue-500 shrink-0" />
        <h3 className="text-sm font-semibold text-slate-900 flex-1 text-left">Qualification</h3>
        {expanded ? (
          <ChevronUp size={14} className="text-slate-400" />
        ) : (
          <ChevronDown size={14} className="text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-100">
          {/* Grade badge + AI summary */}
          {(grade || aiSummary) && (
            <div className="mt-4 space-y-3">
              {grade && (
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-black w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${GRADE_STYLES[grade].bg} ${GRADE_STYLES[grade].text}`}>
                    {grade}
                  </span>
                  <span className={`text-xs font-semibold ${GRADE_STYLES[grade].text}`}>
                    {GRADE_STYLES[grade].label} Lead
                  </span>
                </div>
              )}
              {aiSummary && (
                <div className="bg-blue-50 rounded-lg p-3 flex gap-2">
                  <Brain size={13} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800 leading-relaxed">{aiSummary}</p>
                </div>
              )}
            </div>
          )}

          {/* AI-extracted fields */}
          {hasAiData && (
            <div className="mt-4 space-y-2.5">
              {/* Service type */}
              {serviceType && (
                <div className="flex items-center gap-2">
                  <Wrench size={12} className="text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-500 shrink-0">Service:</span>
                  <span className="text-xs font-medium text-slate-700 capitalize">
                    {serviceType.replace(/_/g, ' ')}
                  </span>
                </div>
              )}

              {/* Urgency badge */}
              {urgency && (
                <div className="flex items-center gap-2">
                  {urgency === 'urgent' ? (
                    <AlertTriangle size={12} className="text-red-500 shrink-0" />
                  ) : (
                    <Clock size={12} className="text-slate-400 shrink-0" />
                  )}
                  <span className="text-xs text-slate-500 shrink-0">Urgency:</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${
                      URGENCY_STYLES[urgency] ?? URGENCY_STYLES.unknown
                    }`}
                  >
                    {urgency}
                  </span>
                </div>
              )}

              {/* Address */}
              {address && (
                <div className="flex items-start gap-2">
                  <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-500 shrink-0">Address:</span>
                  <span className="text-xs text-slate-700">{address}</span>
                </div>
              )}

              {/* Issue description */}
              {issueDescription && (
                <div className="pt-0.5">
                  <p className="text-xs text-slate-500 mb-1">Issue</p>
                  <p className="text-xs text-slate-700 bg-slate-50 rounded-lg p-2.5 leading-relaxed">
                    {issueDescription}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Key takeaways */}
          {takeaways.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">AI Takeaways</p>
              <ul className="space-y-1.5">
                {takeaways.map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 size={12} className="text-green-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-700 leading-relaxed">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasAiData && (
            <p className="text-xs text-slate-400 mt-3 italic">
              AI will extract key info as the conversation progresses.
            </p>
          )}

          {/* Manual notes */}
          <div className={hasAiData || takeaways.length ? 'pt-1 border-t border-slate-100' : 'mt-3'}>
            <p className="text-xs font-medium text-slate-500 mb-1.5 mt-3">Your Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this lead..."
              rows={3}
              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 resize-none placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
            />
            <button
              onClick={saveNotes}
              disabled={saving}
              className="mt-1.5 w-full flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saved ? (
                <>
                  <CheckCircle2 size={12} />
                  Saved!
                </>
              ) : (
                <>
                  <Save size={12} />
                  {saving ? 'Saving…' : 'Save Notes'}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
