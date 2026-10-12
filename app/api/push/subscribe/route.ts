import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
})

// POST /api/push/subscribe — save a browser push subscription for the owner
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = SubscribeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid subscription' }, { status: 422 })

  const svc = getSupabaseServiceClient()

  const { data: business } = await svc
    .from('businesses')
    .select('id, settings')
    .eq('owner_user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const settings = (business.settings ?? {}) as Record<string, unknown>

  // Store subscriptions as an array (owner may have multiple devices)
  const existing = (settings.push_subscriptions ?? []) as unknown[]
  const alreadyExists = existing.some(
    (s) => (s as { endpoint: string }).endpoint === parsed.data.endpoint
  )

  if (!alreadyExists) {
    await svc
      .from('businesses')
      .update({
        settings: {
          ...settings,
          push_subscriptions: [...existing, parsed.data],
        },
      })
      .eq('id', business.id)
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/push/subscribe — remove a subscription
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const endpoint = (body as { endpoint?: string }).endpoint
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })

  const svc = getSupabaseServiceClient()

  const { data: business } = await svc
    .from('businesses')
    .select('id, settings')
    .eq('owner_user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const settings = (business.settings ?? {}) as Record<string, unknown>
  const existing = (settings.push_subscriptions ?? []) as unknown[]

  await svc
    .from('businesses')
    .update({
      settings: {
        ...settings,
        push_subscriptions: existing.filter(
          (s) => (s as { endpoint: string }).endpoint !== endpoint
        ),
      },
    })
    .eq('id', business.id)

  return NextResponse.json({ ok: true })
}
