import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Phone, Globe, Calendar, Tag } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { AiPauseToggle } from '@/components/leads/ai-pause-toggle'
import { ConversationThread } from '@/components/leads/conversation-thread'
import { QualificationPanel } from '@/components/leads/qualification-panel'
import { StatusSelect } from '@/components/leads/status-select'
import { formatPhone, timeAgo, cn } from '@/lib/utils'
import type { BusinessSettings, LeadMetadata } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  new:        'bg-blue-50 text-blue-700',
  contacted:  'bg-indigo-50 text-indigo-700',
  qualifying: 'bg-purple-50 text-purple-700',
  hot:        'bg-orange-50 text-orange-700',
  warm:       'bg-yellow-50 text-yellow-700',
  cold:       'bg-slate-100 text-slate-500',
  booked:     'bg-green-50 text-green-700',
  completed:  'bg-emerald-50 text-emerald-700',
  lost:       'bg-slate-100 text-slate-400',
  escalated:  'bg-red-50 text-red-700',
  opted_out:  'bg-slate-100 text-slate-400',
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load lead — RLS ensures it belongs to this user's business
  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!lead) notFound()

  // Load business settings (for persona name)
  const { data: business } = await supabase
    .from('businesses')
    .select('settings')
    .eq('owner_user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  const settings = business?.settings as BusinessSettings | undefined
  const personaName = settings?.ai_persona_name ?? 'You'

  // Load conversation history (chronological)
  const { data: messages } = await supabase
    .from('conversations')
    .select('id, direction, body, channel, ai_generated, created_at')
    .eq('lead_id', id)
    .order('created_at', { ascending: true })

  const displayName = lead.name ?? formatPhone(lead.phone)
  const meta = (lead.metadata ?? {}) as LeadMetadata

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-full min-h-0">

      {/* ── Conversation thread ───────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 bg-white rounded-xl border border-slate-200 overflow-hidden">

        {/* Thread header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <Link
            href="/dashboard/leads"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-blue-700 font-semibold text-xs">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-slate-900 text-sm">{displayName}</p>
            <p className="text-xs text-slate-500">{formatPhone(lead.phone)}</p>
          </div>
          <div className="ml-auto">
            <StatusSelect leadId={lead.id} currentStatus={lead.status} />
          </div>
        </div>

        {/* AI paused banner */}
        {lead.ai_paused && (
          <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-5 py-2 flex items-center gap-2">
            <span className="text-xs font-medium text-amber-700">
              AI is paused — you are handling this conversation manually.
            </span>
          </div>
        )}

        {/* Escalation banner */}
        {lead.status === 'escalated' && lead.escalation_reason && (
          <div className="shrink-0 bg-red-50 border-b border-red-200 px-5 py-2">
            <span className="text-xs font-medium text-red-700">
              Escalated: {lead.escalation_reason}
            </span>
          </div>
        )}

        {/* Messages + reply input (client component) */}
        <ConversationThread
          leadId={id}
          aiPaused={lead.ai_paused}
          personaName={personaName}
          initialMessages={(messages ?? []) as {
            id: string
            direction: 'inbound' | 'outbound'
            body: string
            channel: string
            ai_generated: boolean
            created_at: string
          }[]}
        />
      </div>

      {/* ── Lead info sidebar ─────────────────────────────────────────────────── */}
      <div className="lg:w-72 xl:w-80 shrink-0 space-y-4">

        {/* Contact info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Contact Info</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-sm">
              <Phone size={14} className="text-slate-400 shrink-0" />
              <span className="text-slate-700">{formatPhone(lead.phone)}</span>
            </div>
            {lead.email && (
              <div className="flex items-center gap-2.5 text-sm">
                <Globe size={14} className="text-slate-400 shrink-0" />
                <span className="text-slate-700 truncate">{lead.email}</span>
              </div>
            )}
            <div className="flex items-center gap-2.5 text-sm">
              <Calendar size={14} className="text-slate-400 shrink-0" />
              <span className="text-slate-700">
                Added {timeAgo(lead.created_at)}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <Tag size={14} className="text-slate-400 shrink-0" />
              <span className="text-slate-700 capitalize">
                {lead.source?.replace('_', ' ') ?? 'Unknown source'}
              </span>
            </div>
          </div>
        </div>

        {/* Lead details */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Language</span>
              <span className="text-slate-700 uppercase">{lead.language}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Score</span>
              <span className="text-slate-700">{lead.score ?? 0}</span>
            </div>
            {lead.last_contact && (
              <div className="flex justify-between">
                <span className="text-slate-500">Last contact</span>
                <span className="text-slate-700">{timeAgo(lead.last_contact)}</span>
              </div>
            )}
          </div>

          {lead.message && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-500 mb-1">Initial message</p>
              <p className="text-xs text-slate-600">{lead.message}</p>
            </div>
          )}
        </div>

        {/* Qualification notes + AI takeaways */}
        <QualificationPanel
          leadId={lead.id}
          serviceType={lead.service_type ?? null}
          metadata={meta}
        />

        {/* AI control */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <AiPauseToggle leadId={lead.id} initialPaused={lead.ai_paused} />
        </div>
      </div>
    </div>
  )
}
