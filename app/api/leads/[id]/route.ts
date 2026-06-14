import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(lead)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as Record<string, unknown>

  // Build allowed update fields
  const update: Record<string, unknown> = {}

  if (typeof body.ai_paused === 'boolean') update.ai_paused = body.ai_paused
  if (typeof body.status === 'string') update.status = body.status
  if (typeof body.name === 'string') update.name = body.name

  // Notes live inside the metadata JSONB — merge rather than replace
  if (typeof body.notes === 'string') {
    // We need to merge with existing metadata; fetch current metadata first
    const { data: existing } = await supabase
      .from('leads')
      .select('metadata')
      .eq('id', id)
      .maybeSingle()

    const existingMeta = (existing?.metadata ?? {}) as Record<string, unknown>
    update.metadata = { ...existingMeta, notes: body.notes }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  // RLS ensures the user can only update leads belonging to their business
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase
    .from('leads')
    .update(update as any)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
