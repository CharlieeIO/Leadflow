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
