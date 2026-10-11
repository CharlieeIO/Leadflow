import { NextResponse } from 'next/server'

// Keep-warm endpoint — hit this every 5 minutes via UptimeRobot or similar
// to prevent Vercel serverless cold starts.
// Configure UptimeRobot to GET https://www.theleadflowautomation.com/api/keepwarm
export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() })
}
