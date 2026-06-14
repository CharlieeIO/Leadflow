// ── Booking summary email sent to the business owner when a lead books ────────

interface ConversationMessage {
  direction: 'inbound' | 'outbound'
  body: string
  created_at: string
  ai_generated?: boolean
}

interface BookingSummaryData {
  businessName: string
  leadName: string | null
  leadPhone: string
  serviceType: string | null
  urgency: string | null
  address: string | null
  issueDescription: string | null
  keyTakeaways: string[]
  bookedTime: string
  messages: ConversationMessage[]
  dashboardUrl: string
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function bookingSummaryHtml(data: BookingSummaryData): string {
  const {
    businessName, leadName, leadPhone, serviceType, urgency,
    address, issueDescription, keyTakeaways, bookedTime, messages, dashboardUrl,
  } = data

  const displayName = leadName ?? leadPhone

  // Build conversation thread HTML
  const threadHtml = messages.map((m) => {
    const isInbound = m.direction === 'inbound'
    const bg = isInbound ? '#f1f5f9' : '#eff6ff'
    const label = isInbound ? displayName : (m.ai_generated ? 'AI' : 'You')
    const labelColor = isInbound ? '#475569' : '#1d4ed8'
    return `<div style="margin-bottom:12px;">
      <p style="margin:0 0 3px;font-size:11px;font-weight:600;color:${labelColor};text-transform:uppercase;letter-spacing:.04em;">${label}</p>
      <div style="background:${bg};border-radius:8px;padding:10px 14px;font-size:14px;color:#1e293b;line-height:1.5;">
        ${m.body.replace(/\n/g, '<br>')}
      </div>
      <p style="margin:3px 0 0;font-size:11px;color:#94a3b8;">${formatTime(m.created_at)}</p>
    </div>`
  }).join('')

  // Qualification badges
  const badges: string[] = []
  if (serviceType) badges.push(`<span style="background:#dbeafe;color:#1d4ed8;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;margin-right:6px;">${serviceType.replace(/_/g, ' ')}</span>`)
  if (urgency && urgency !== 'unknown') {
    const urgBg = urgency === 'urgent' ? '#fee2e2' : '#d1fae5'
    const urgFg = urgency === 'urgent' ? '#dc2626' : '#059669'
    badges.push(`<span style="background:${urgBg};color:${urgFg};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;margin-right:6px;">${urgency}</span>`)
  }

  const takeawaysHtml = keyTakeaways.length
    ? `<ul style="margin:8px 0 0;padding-left:18px;">
        ${keyTakeaways.map((t) => `<li style="font-size:13px;color:#374151;margin-bottom:4px;">${t}</li>`).join('')}
      </ul>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#15803d;border-radius:12px 12px 0 0;padding:28px 32px;">
            <p style="margin:0;font-size:12px;color:#86efac;font-weight:600;letter-spacing:.05em;text-transform:uppercase;">New Booking</p>
            <h1 style="margin:6px 0 4px;font-size:22px;color:#fff;font-weight:700;">✅ ${displayName} just booked!</h1>
            <p style="margin:0;font-size:14px;color:#bbf7d0;">${businessName} · ${bookedTime}</p>
          </td>
        </tr>

        <!-- Lead summary -->
        <tr>
          <td style="background:#fff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:24px 32px 20px;">
            <h2 style="margin:0 0 14px;font-size:15px;font-weight:600;color:#0f172a;">Lead Summary</h2>
            ${badges.length ? `<div style="margin-bottom:12px;">${badges.join('')}</div>` : ''}
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:13px;color:#64748b;padding:4px 0;width:120px;">Phone</td>
                <td style="font-size:13px;color:#1e293b;font-weight:500;padding:4px 0;">${leadPhone}</td>
              </tr>
              ${address ? `<tr><td style="font-size:13px;color:#64748b;padding:4px 0;">Address</td><td style="font-size:13px;color:#1e293b;font-weight:500;padding:4px 0;">${address}</td></tr>` : ''}
              ${serviceType ? `<tr><td style="font-size:13px;color:#64748b;padding:4px 0;">Service</td><td style="font-size:13px;color:#1e293b;font-weight:500;padding:4px 0;text-transform:capitalize;">${serviceType.replace(/_/g, ' ')}</td></tr>` : ''}
            </table>
            ${issueDescription ? `<div style="margin-top:12px;background:#f8fafc;border-radius:8px;padding:12px 14px;"><p style="margin:0;font-size:12px;color:#64748b;font-weight:600;margin-bottom:4px;">ISSUE</p><p style="margin:0;font-size:13px;color:#1e293b;">${issueDescription}</p></div>` : ''}
            ${takeawaysHtml ? `<div style="margin-top:12px;"><p style="margin:0;font-size:12px;color:#64748b;font-weight:600;">KEY TAKEAWAYS</p>${takeawaysHtml}</div>` : ''}
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="background:#fff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:0 32px;">
            <hr style="border:none;border-top:1px solid #f1f5f9;margin:0;">
          </td>
        </tr>

        <!-- Conversation thread -->
        <tr>
          <td style="background:#fff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:20px 32px 24px;">
            <h2 style="margin:0 0 16px;font-size:15px;font-weight:600;color:#0f172a;">Full Conversation</h2>
            ${threadHtml || '<p style="font-size:13px;color:#94a3b8;">No messages recorded.</p>'}
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
            <a href="${dashboardUrl}"
               style="display:inline-block;background:#2563eb;color:#fff;font-size:14px;font-weight:600;padding:11px 28px;border-radius:8px;text-decoration:none;">
              View Lead in Dashboard →
            </a>
            <p style="margin:14px 0 0;font-size:12px;color:#94a3b8;">Sent by LeadFlow AI · ${businessName}</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Weekly report email ───────────────────────────────────────────────────────

interface WeeklyReportData {
  businessName: string
  weekLabel: string       // e.g. "May 12 – May 18"
  leadsThisWeek: number
  leadsPrevWeek: number
  responsesThisWeek: number
  bookingsThisWeek: number
  bookingsPrevWeek: number
  revenueThisWeek: number  // bookings × avg_job_value
  avgJobValue: number
}

function trend(curr: number, prev: number): string {
  if (prev === 0) return curr > 0 ? `+${curr} (new)` : '—'
  const delta = curr - prev
  return delta === 0 ? 'same as last week' : `${delta > 0 ? '+' : ''}${delta} vs last week`
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function weeklyReportHtml(data: WeeklyReportData): string {
  const {
    businessName, weekLabel, leadsThisWeek, leadsPrevWeek,
    responsesThisWeek, bookingsThisWeek, bookingsPrevWeek,
    revenueThisWeek, avgJobValue,
  } = data

  const revenueRow = avgJobValue > 0
    ? `<tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#475569;">Revenue Recovered</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:600;color:#0f172a;text-align:right;">${formatCurrency(revenueThisWeek)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#94a3b8;text-align:right;">${bookingsThisWeek} × ${formatCurrency(avgJobValue)}</td>
      </tr>`
    : `<tr>
        <td colspan="3" style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#94a3b8;">
          Set your avg job value in <a href="${process.env.NEXT_PUBLIC_URL ?? ''}/dashboard/settings" style="color:#3b82f6;">Settings</a> to see revenue estimates.
        </td>
      </tr>`

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#1e40af;border-radius:12px 12px 0 0;padding:28px 32px;">
            <p style="margin:0;font-size:13px;color:#93c5fd;font-weight:500;letter-spacing:.05em;text-transform:uppercase;">Weekly Report</p>
            <h1 style="margin:6px 0 0;font-size:22px;color:#fff;font-weight:700;">${businessName}</h1>
            <p style="margin:4px 0 0;font-size:13px;color:#bfdbfe;">${weekLabel}</p>
          </td>
        </tr>

        <!-- Stats table -->
        <tr>
          <td style="background:#fff;border:1px solid #e2e8f0;border-top:none;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:10px 16px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Metric</th>
                  <th style="padding:10px 16px;font-size:11px;color:#94a3b8;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">This Week</th>
                  <th style="padding:10px 16px;font-size:11px;color:#94a3b8;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">vs Last Week</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#475569;">New Leads</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:600;color:#0f172a;text-align:right;">${leadsThisWeek}</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#94a3b8;text-align:right;">${trend(leadsThisWeek, leadsPrevWeek)}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#475569;">AI Responses Sent</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:600;color:#0f172a;text-align:right;">${responsesThisWeek}</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#94a3b8;text-align:right;">—</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#475569;">Appointments Booked</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:600;color:#0f172a;text-align:right;">${bookingsThisWeek}</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#94a3b8;text-align:right;">${trend(bookingsThisWeek, bookingsPrevWeek)}</td>
                </tr>
                ${revenueRow}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 32px;text-align:center;">
            <a href="${process.env.NEXT_PUBLIC_URL ?? ''}/dashboard"
               style="display:inline-block;background:#2563eb;color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
              View Dashboard →
            </a>
            <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
              You're receiving this because you're a LeadFlow client.<br>
              To change notification preferences, visit Settings.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
