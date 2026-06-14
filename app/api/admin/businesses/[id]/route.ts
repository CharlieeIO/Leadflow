import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

// GET /api/admin/businesses/[id] — fetch a single business (admin-only)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || user.email !== adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = getSupabaseServiceClient()
  const { data } = await service
    .from('businesses')
    .select('id, name, niche, twilio_number, settings, active, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(data)
}

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  niche: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
})

// PATCH /api/admin/businesses/[id] — admin-only: update any business's settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || user.email !== adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 422 })

  const service = getSupabaseServiceClient()

  // Fetch existing business first to merge settings
  const { data: existing } = await service
    .from('businesses')
    .select('settings')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const mergedSettings = parsed.data.settings
    ? { ...(existing.settings as Record<string, unknown>), ...parsed.data.settings }
    : undefined

  const updatePayload: Record<string, unknown> = {}
  if (parsed.data.name) updatePayload.name = parsed.data.name
  if (parsed.data.niche) updatePayload.niche = parsed.data.niche
  if (mergedSettings) updatePayload.settings = mergedSettings

  const { data: updated, error } = await service
    .from('businesses')
    .update(updatePayload as never)
    .eq('id', id)
    .select('id, name, niche, settings')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(updated)
}
