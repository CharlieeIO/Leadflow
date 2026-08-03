import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) return null
  return user
}

// GET /api/admin/businesses/[id] — load a single business for the onboarding wizard
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = getSupabaseServiceClient()
  const { data, error } = await service
    .from('businesses')
    .select('id, name, niche, twilio_number, active, settings, owner_user_id')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

// PATCH /api/admin/businesses/[id] — update name/niche and merge settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const service = getSupabaseServiceClient()

  // Load existing settings so we can merge rather than overwrite
  const { data: existing } = await service
    .from('businesses')
    .select('settings')
    .eq('id', id)
    .single()

  const existingSettings = (existing?.settings ?? {}) as Record<string, unknown>
  const incomingSettings = (body.settings ?? {}) as Record<string, unknown>
  const mergedSettings = { ...existingSettings, ...incomingSettings }

  const update: Record<string, unknown> = { settings: mergedSettings }
  if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim()
  if (typeof body.niche === 'string' && body.niche.trim()) update.niche = body.niche.trim()
  if (typeof body.active === 'boolean') update.active = body.active

  const { error } = await service.from('businesses').update(update as never).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/businesses/[id] — cascade-delete a business and all its data
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = getSupabaseServiceClient()

  // Cascade delete in dependency order
  await service.from('ai_interactions').delete().eq('business_id', id)
  await service.from('analytics_events').delete().eq('business_id', id)
  await service.from('automations').delete().eq('business_id', id)
  await service.from('conversations').delete().eq('business_id', id)
  await service.from('appointments').delete().eq('business_id', id)
  await service.from('leads').delete().eq('business_id', id)
  await service.from('subscriptions').delete().eq('business_id', id)
  await service.from('businesses').delete().eq('id', id)

  return NextResponse.json({ success: true })
}
