import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { BusinessSettings, Niche } from '@/types'

// GET /api/settings — return current business settings
export async function GET(): Promise<NextResponse> {
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, niche, settings')
    .eq('owner_user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (!business) return NextResponse.json({ error: 'No business found' }, { status: 404 })

  return NextResponse.json(business)
}

// PATCH /api/settings — update business settings and top-level columns
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: business } = await supabase
    .from('businesses')
    .select('id, settings')
    .eq('owner_user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (!business) return NextResponse.json({ error: 'No business found' }, { status: 404 })

  const body = await request.json() as {
    name?: string
    niche?: string
    settings?: Partial<BusinessSettings>
  }

  // Merge settings rather than overwrite — preserves fields not in the form
  const currentSettings = (business.settings ?? {}) as BusinessSettings
  const mergedSettings: BusinessSettings = {
    ...currentSettings,
    ...(body.settings ?? {}),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settingsJson = mergedSettings as any

  const { error } = await supabase
    .from('businesses')
    .update({
      settings: settingsJson,
      ...(body.name  ? { name: body.name }              : {}),
      ...(body.niche ? { niche: body.niche as Niche }   : {}),
    })
    .eq('id', business.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
