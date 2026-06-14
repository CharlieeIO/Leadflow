import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as Record<string, unknown>

  if (typeof body.ai_paused !== 'boolean') {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  // RLS ensures the user can only update leads belonging to their business
  const { error } = await supabase
    .from('leads')
    .update({ ai_paused: body.ai_paused })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
