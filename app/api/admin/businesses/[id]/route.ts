import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
