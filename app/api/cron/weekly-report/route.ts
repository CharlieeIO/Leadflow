import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend/client'
import { weeklyReportHtml } from '@/lib/resend/templates'
import { logger } from '@/lib/logger'
import type { BusinessSettings } from '@/types'

// GET /api/cron/weekly-report — Monday 8am UTC, emails performance report to each owner
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const resend = getResend()

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86400000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000)

  const weekAgoIso = weekAgo.toISOString()
  const twoWeeksAgoIso = twoWeeksAgo.toISOString()

  // Load all active businesses with notification email set
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, owner_user_id, settings')
    .eq('active', true)

  if (!businesses?.length) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  const weekStart = weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const weekEnd = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const weekLabel = `${weekStart} – ${weekEnd}`

  let sent = 0
  let errors = 0

  for (const business of businesses) {
    const settings = business.settings as BusinessSettings | undefined
    const email = settings?.notification_email
    if (!email) continue

    try {
      // Fetch this week and last week stats in parallel
      const [
        { count: leadsNow },
        { count: leadsPrev },
        { count: bookingsNow },
        { count: bookingsPrev },
        { count: aiResponses },
      ] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true })
          .eq('business_id', business.id).gte('created_at', weekAgoIso),
        supabase.from('leads').select('*', { count: 'exact', head: true })
          .eq('business_id', business.id).gte('created_at', twoWeeksAgoIso).lt('created_at', weekAgoIso),
        supabase.from('appointments').select('*', { count: 'exact', head: true })
          .eq('business_id', business.id).gte('created_at', weekAgoIso),
        supabase.from('appointments').select('*', { count: 'exact', head: true })
          .eq('business_id', business.id).gte('created_at', twoWeeksAgoIso).lt('created_at', weekAgoIso),
        supabase.from('conversations').select('*', { count: 'exact', head: true })
          .eq('business_id', business.id).eq('direction', 'outbound').eq('ai_generated', true)
          .gte('created_at', weekAgoIso),
      ])

      const avgJobValue = settings?.avg_job_value ?? 0
      const bookingsThisWeek = bookingsNow ?? 0
      const revenueThisWeek = bookingsThisWeek * avgJobValue

      const html = weeklyReportHtml({
        businessName: business.name,
        weekLabel,
        leadsThisWeek: leadsNow ?? 0,
        leadsPrevWeek: leadsPrev ?? 0,
        responsesThisWeek: aiResponses ?? 0,
        bookingsThisWeek,
        bookingsPrevWeek: bookingsPrev ?? 0,
        revenueThisWeek,
        avgJobValue,
      })

      await resend.emails.send({
        from: `LeadFlow <reports@${process.env.RESEND_FROM_DOMAIN ?? 'mail.leadflow.ai'}>`,
        to: email,
        subject: `Your weekly report — ${business.name}`,
        html,
      })

      sent++
      logger.info('weekly_report_sent', { business_id: business.id, email })
    } catch (err) {
      errors++
      logger.error('weekly_report_failed', { business_id: business.id, error: String(err) })
    }
  }

  return NextResponse.json({ ok: true, sent, errors })
}
