import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// GET /api/leads/export — returns all leads as a CSV download
export async function GET(_request: NextRequest): Promise<NextResponse> {
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (!business) {
    return NextResponse.json({ error: 'No business found' }, { status: 404 })
  }

  const { data: leads, error } = await supabase
    .from('leads')
    .select('name, phone, email, service_type, status, source, language, score, last_contact, created_at, metadata')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const headers = ['Name', 'Phone', 'Email', 'Service', 'Status', 'Source', 'Language', 'Score', 'Grade', 'Last Contact', 'Created At']

  const escape = (val: unknown): string => {
    const s = val == null ? '' : String(val)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const rows = (leads ?? []).map((l) => {
    const meta = (l.metadata ?? {}) as Record<string, unknown>
    return [
      l.name,
      l.phone,
      l.email,
      l.service_type,
      l.status,
      l.source,
      l.language,
      l.score,
      meta.grade ?? '',
      l.last_contact ? new Date(l.last_contact).toLocaleDateString() : '',
      new Date(l.created_at).toLocaleDateString(),
    ].map(escape).join(',')
  })

  const csv = [headers.join(','), ...rows].join('\n')
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="leads-${date}.csv"`,
    },
  })
}
