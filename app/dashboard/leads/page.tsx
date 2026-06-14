import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { StatusFilter } from '@/components/leads/status-filter'
import { formatPhone, timeAgo, cn } from '@/lib/utils'
import type { LeadStatus } from '@/types'

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

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load the user's business
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (!business) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500 text-sm">No business found. Contact support.</p>
      </div>
    )
  }

  // Build query — filter by status if provided
  let query = supabase
    .from('leads')
    .select('id, name, phone, status, language, source, last_contact, created_at, ai_paused')
    .eq('business_id', business.id)
    .order('last_contact', { ascending: false, nullsFirst: false })
    .limit(100)

  if (status) {
    query = query.eq('status', status)
  }

  const { data: leads } = await query

  // Fetch the last message for each lead in one query
  const leadIds = (leads ?? []).map((l) => l.id)
  const { data: lastMessages } = leadIds.length
    ? await supabase
        .from('conversations')
        .select('lead_id, body, direction, created_at')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  // Group last message per lead
  const lastMsgByLead = new Map<string, { body: string; direction: string }>()
  for (const msg of lastMessages ?? []) {
    if (!lastMsgByLead.has(msg.lead_id)) {
      lastMsgByLead.set(msg.lead_id, { body: msg.body, direction: msg.direction })
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Suspense fallback={<div className="h-9 w-64 bg-slate-100 rounded-lg animate-pulse" />}>
          <StatusFilter />
        </Suspense>
        <p className="text-sm text-slate-500">
          {leads?.length ?? 0} lead{leads?.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Lead list */}
      {!leads?.length ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500 text-sm">
            {status ? `No ${status} leads yet.` : 'No leads yet. They\'ll appear here as they come in.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {leads.map((lead) => {
            const lastMsg = lastMsgByLead.get(lead.id)
            const displayName = lead.name ?? formatPhone(lead.phone)

            return (
              <Link
                key={lead.id}
                href={`/dashboard/leads/${lead.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-blue-700 font-semibold text-sm">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-slate-900 text-sm truncate">{displayName}</span>
                    {lead.ai_paused && (
                      <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="hidden sm:block text-sm text-slate-500 truncate">
                    {lastMsg
                      ? `${lastMsg.direction === 'outbound' ? 'You: ' : ''}${lastMsg.body}`
                      : formatPhone(lead.phone)}
                  </p>
                </div>

                {/* Right side: status + time */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full capitalize',
                      STATUS_COLORS[lead.status as LeadStatus] ?? 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {lead.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-400">
                    {lead.last_contact ? timeAgo(lead.last_contact) : timeAgo(lead.created_at)}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
