import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { cn, formatPhone, timeAgo } from '@/lib/utils'
import { AlertTriangle, CheckCircle, Phone, Mail, Globe, Calendar, MessageSquare, Zap, Settings, ExternalLink } from 'lucide-react'
import type { BusinessSettings } from '@/types'

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

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-400 shrink-0 pt-0.5">{label}</span>
      <span className={cn('text-sm text-slate-800 text-right break-all', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  )
}

export default async function AdminBusinessPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect('/dashboard')

  const service = getSupabaseServiceClient()

  const [
    { data: business },
    { data: leads },
    { data: appts },
    { data: interactions },
    { data: recentConvos },
    { data: escalatedLeads },
    { data: subscription },
    { data: analyticsEvents },
  ] = await Promise.all([
    service.from('businesses').select('*').eq('id', id).maybeSingle(),
    service.from('leads')
      .select('id, name, phone, status, source, created_at, ai_paused, escalation_reason')
      .eq('business_id', id)
      .order('created_at', { ascending: false })
      .limit(15),
    service.from('appointments')
      .select('id, scheduled_at, status, notes')
      .eq('business_id', id)
      .order('scheduled_at', { ascending: false })
      .limit(5),
    service.from('ai_interactions')
      .select('latency_ms, created_at, escalated, prompt_tokens, completion_tokens')
      .eq('business_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    service.from('conversations')
      .select('id, direction, body, ai_generated, channel, created_at')
      .eq('business_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    service.from('leads')
      .select('id, name, phone, escalation_reason, updated_at')
      .eq('business_id', id)
      .eq('status', 'escalated')
      .order('updated_at', { ascending: false })
      .limit(5),
    service.from('subscriptions')
      .select('plan, status, trial_ends_at, current_period_end')
      .eq('business_id', id)
      .maybeSingle(),
    service.from('analytics_events')
      .select('event_type, created_at, properties')
      .eq('business_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (!business) notFound()

  const settings = business.settings as BusinessSettings | undefined ?? {}

  const avgLatencyMs = interactions?.length
    ? Math.round(interactions.reduce((s, r) => s + (r.latency_ms ?? 0), 0) / interactions.length)
    : null

  const totalTokens = interactions?.reduce((s, r) => s + (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0), 0) ?? 0
  const escalationRate = interactions?.length
    ? Math.round((interactions.filter(i => i.escalated).length / interactions.length) * 100)
    : 0

  // Setup completeness
  const setupItems = [
    { label: 'Twilio number', ok: !!business.twilio_number },
    { label: 'AI persona name', ok: !!settings.ai_persona_name },
    { label: 'Booking link', ok: !!settings.booking_link },
    { label: 'Notification phone', ok: !!settings.notification_phone },
    { label: 'Notification email', ok: !!settings.notification_email },
    { label: 'Service area', ok: !!settings.service_area },
  ]
  const setupPct = Math.round((setupItems.filter(s => s.ok).length / setupItems.length) * 100)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/admin" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
            ← Admin
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-xl font-bold text-slate-900">{business.name}</h1>
          <span className={cn(
            'text-xs font-medium px-2.5 py-0.5 rounded-full ml-1',
            business.active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-400',
          )}>
            {business.active ? 'Active' : 'Inactive'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`/admin/onboard/${id}`}
              className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Run Wizard
            </Link>
            <Link
              href={`/dashboard/leads`}
              className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
            >
              <ExternalLink size={13} />
              View Leads
            </Link>
          </div>
        </div>

        {/* Top stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Leads',     value: leads?.length ?? 0,          icon: MessageSquare, color: 'blue' },
            { label: 'Appointments',    value: appts?.length ?? 0,          icon: Calendar,      color: 'green' },
            { label: 'Avg AI Response', value: avgLatencyMs ? `${(avgLatencyMs/1000).toFixed(1)}s` : '—', icon: Zap, color: 'violet' },
            { label: 'Escalation Rate', value: `${escalationRate}%`,        icon: AlertTriangle, color: escalationRate > 20 ? 'red' : 'amber' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500">{label}</p>
                <Icon size={14} className={cn(
                  color === 'blue' ? 'text-blue-500' :
                  color === 'green' ? 'text-green-500' :
                  color === 'violet' ? 'text-violet-500' :
                  color === 'red' ? 'text-red-500' : 'text-amber-500'
                )} />
              </div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: leads + conversations */}
          <div className="lg:col-span-2 space-y-5">

            {/* Escalations alert */}
            {escalatedLeads?.length ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="text-red-500" />
                  <p className="text-sm font-semibold text-red-700">{escalatedLeads.length} Escalated Lead{escalatedLeads.length > 1 ? 's' : ''} Needs Attention</p>
                </div>
                {escalatedLeads.map((l) => (
                  <div key={l.id} className="bg-white rounded-lg px-4 py-3 border border-red-100">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800">{l.name ?? formatPhone(l.phone)}</p>
                      <span className="text-xs text-slate-400">{timeAgo(l.updated_at)}</span>
                    </div>
                    {l.escalation_reason && (
                      <p className="text-xs text-slate-500 mt-1">{l.escalation_reason}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {/* Recent leads */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Recent Leads</h2>
                <span className="text-xs text-slate-400">{leads?.length ?? 0} shown</span>
              </div>
              {leads?.length ? (
                <div className="divide-y divide-slate-50">
                  {leads.map((l) => (
                    <div key={l.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                        <span className="text-blue-600 font-semibold text-xs">
                          {(l.name ?? l.phone).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{l.name ?? formatPhone(l.phone)}</p>
                        <p className="text-xs text-slate-400">{l.source?.replace('_', ' ')} · {timeAgo(l.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {l.ai_paused && (
                          <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                            Paused
                          </span>
                        )}
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize', STATUS_COLORS[l.status] ?? 'bg-slate-100 text-slate-500')}>
                          {l.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-5 py-10 text-sm text-slate-400 text-center">No leads yet.</p>
              )}
            </div>

            {/* Recent conversations */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Recent Messages</h2>
              </div>
              {recentConvos?.length ? (
                <div className="divide-y divide-slate-50">
                  {recentConvos.map((c) => (
                    <div key={c.id} className="flex items-start gap-3 px-5 py-3">
                      <span className={cn(
                        'text-xs font-medium px-1.5 py-0.5 rounded shrink-0 mt-0.5',
                        c.direction === 'inbound' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-600',
                      )}>
                        {c.direction === 'inbound' ? 'IN' : 'OUT'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate">{c.body}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {c.channel} · {c.ai_generated ? 'AI' : 'Manual'} · {timeAgo(c.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-slate-400">No messages yet.</p>
              )}
            </div>

            {/* Recent analytics events */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Activity Log</h2>
              </div>
              {analyticsEvents?.length ? (
                <div className="divide-y divide-slate-50">
                  {analyticsEvents.map((e, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                        <span className="text-sm text-slate-600">{e.event_type.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="text-xs text-slate-400">{timeAgo(e.created_at)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-slate-400">No events yet.</p>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">

            {/* Business details */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Business Details</h2>
              <InfoRow label="ID" value={business.id} mono />
              <InfoRow label="Niche" value={<span className="capitalize">{business.niche}</span>} />
              <InfoRow label="Created" value={new Date(business.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
              <InfoRow label="Twilio #" value={
                business.twilio_number
                  ? <span className="font-mono text-xs flex items-center gap-1"><Phone size={11} />{business.twilio_number}</span>
                  : <span className="text-red-400 text-xs">Not configured</span>
              } />
              <InfoRow label="Retell" value={business.retell_agent_id ?? <span className="text-slate-400 text-xs">Not set</span>} />
              <InfoRow label="Cal.com" value={business.cal_event_type_id ?? <span className="text-slate-400 text-xs">Not set</span>} />
            </div>

            {/* Subscription */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Subscription</h2>
              {subscription ? (
                <>
                  <InfoRow label="Plan" value={<span className="capitalize font-medium">{subscription.plan}</span>} />
                  <InfoRow label="Status" value={
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize',
                      subscription.status === 'active' ? 'bg-green-50 text-green-700' :
                      subscription.status === 'trialing' ? 'bg-blue-50 text-blue-700' :
                      'bg-amber-50 text-amber-700'
                    )}>
                      {subscription.status}
                    </span>
                  } />
                  {subscription.trial_ends_at && (
                    <InfoRow label="Trial ends" value={new Date(subscription.trial_ends_at).toLocaleDateString()} />
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400 text-center py-2">No subscription</p>
              )}
            </div>

            {/* Setup checklist */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900">Setup</h2>
                <span className={cn(
                  'text-xs font-bold px-2 py-0.5 rounded-full',
                  setupPct === 100 ? 'bg-green-50 text-green-700' : setupPct >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
                )}>
                  {setupPct}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3">
                <div
                  className={cn('h-1.5 rounded-full transition-all', setupPct === 100 ? 'bg-green-500' : 'bg-blue-500')}
                  style={{ width: `${setupPct}%` }}
                />
              </div>
              <div className="space-y-2">
                {setupItems.map(({ label, ok }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">{label}</span>
                    {ok
                      ? <CheckCircle size={13} className="text-green-500" />
                      : <span className="text-xs text-red-400 font-medium">Missing</span>
                    }
                  </div>
                ))}
              </div>
              {setupPct < 100 && (
                <Link
                  href={`/admin/onboard/${id}`}
                  className="mt-3 block w-full text-center py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  Complete setup →
                </Link>
              )}
            </div>

            {/* Settings snapshot */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900">AI Settings</h2>
                <Settings size={13} className="text-slate-400" />
              </div>
              <div className="space-y-0">
                <InfoRow label="Persona" value={settings.ai_persona_name ?? <span className="text-slate-400 text-xs">Not set</span>} />
                <InfoRow label="Tone" value={settings.ai_tone ?? 'friendly'} />
                <InfoRow label="Language" value={settings.language ?? 'en'} />
                <InfoRow label="Bilingual" value={settings.bilingual ? 'Yes' : 'No'} />
                <InfoRow label="Booking link" value={
                  settings.booking_link
                    ? <a href={settings.booking_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 text-xs"><ExternalLink size={10} />Open</a>
                    : <span className="text-slate-400 text-xs">Not set</span>
                } />
                {settings.notification_phone && (
                  <InfoRow label="Alert phone" value={<span className="flex items-center gap-1 text-xs"><Phone size={10} />{settings.notification_phone}</span>} />
                )}
                {settings.notification_email && (
                  <InfoRow label="Alert email" value={<span className="flex items-center gap-1 text-xs"><Mail size={10} />{settings.notification_email}</span>} />
                )}
              </div>
            </div>

            {/* AI performance */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">AI Performance</h2>
              <div className="space-y-0">
                <InfoRow label="Interactions" value={(interactions?.length ?? 0).toLocaleString()} />
                <InfoRow label="Avg latency" value={avgLatencyMs ? `${(avgLatencyMs / 1000).toFixed(1)}s` : '—'} />
                <InfoRow label="Total tokens" value={totalTokens.toLocaleString()} />
                <InfoRow label="Escalation rate" value={
                  <span className={escalationRate > 20 ? 'text-red-500 font-medium' : 'text-slate-800'}>
                    {escalationRate}%
                  </span>
                } />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
