import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { provisionTwilioNumber } from '@/lib/twilio/provisioning'
import { logger } from '@/lib/logger'

async function requireAdmin(request: NextRequest) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL
  if (!user || !adminEmail || user.email !== adminEmail) return null
  return user
}

// GET /api/admin/businesses — list all businesses with lead/appt counts
export async function GET(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = getSupabaseServiceClient()

  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('id, name, niche, twilio_number, active, created_at, owner_user_id, settings')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Count leads and appointments per business in one query each
  const ids = (businesses ?? []).map((b) => b.id)

  const [{ data: leadCounts }, { data: apptCounts }] = await Promise.all([
    supabase
      .from('leads')
      .select('business_id')
      .in('business_id', ids),
    supabase
      .from('appointments')
      .select('business_id')
      .in('business_id', ids),
  ])

  const leadMap = new Map<string, number>()
  const apptMap = new Map<string, number>()
  for (const r of leadCounts ?? []) leadMap.set(r.business_id, (leadMap.get(r.business_id) ?? 0) + 1)
  for (const r of apptCounts ?? []) apptMap.set(r.business_id, (apptMap.get(r.business_id) ?? 0) + 1)

  const result = (businesses ?? []).map((b) => ({
    ...b,
    leadCount: leadMap.get(b.id) ?? 0,
    apptCount: apptMap.get(b.id) ?? 0,
  }))

  return NextResponse.json(result)
}

const CreateBusinessSchema = z.object({
  name:             z.string().min(2).max(120),
  niche:            z.enum(['roofing', 'hvac', 'medspa', 'autodetail', 'realtor']),
  owner_email:      z.string().email(),
  area_code:        z.string().length(3).optional(),
  provision_twilio: z.boolean().default(false),
})

// POST /api/admin/businesses — create a new business (and optionally provision a Twilio number)
export async function POST(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = CreateBusinessSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })

  const data = parsed.data
  const supabase = getSupabaseServiceClient()

  // Find or create the owner user
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const existingUser = users.find((u) => u.email === data.owner_email)

  let ownerId: string

  if (existingUser) {
    ownerId = existingUser.id
  } else {
    const { data: newUser, error: userErr } = await supabase.auth.admin.createUser({
      email: data.owner_email,
      email_confirm: true,
    })
    if (userErr || !newUser.user) {
      return NextResponse.json({ error: userErr?.message ?? 'Failed to create user' }, { status: 500 })
    }
    ownerId = newUser.user.id
  }

  // Provision Twilio number if requested
  let twilioNumber: string | null = null
  if (data.provision_twilio) {
    try {
      const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.leadflow.ai'
      twilioNumber = await provisionTwilioNumber({
        businessId: 'pending', // will update after insert
        areaCode: data.area_code,
        appBaseUrl,
      })
    } catch (err) {
      logger.warn('twilio_provision_failed_on_create', { error: String(err) })
      // Non-fatal — business is created without a number, can be set later
    }
  }

  // Create the business row
  const { data: business, error: bizErr } = await supabase
    .from('businesses')
    .insert({
      owner_user_id: ownerId,
      name: data.name,
      niche: data.niche,
      twilio_number: twilioNumber,
      active: true,
      settings: {},
    })
    .select('id, name, niche, twilio_number')
    .single()

  if (bizErr || !business) {
    return NextResponse.json({ error: bizErr?.message ?? 'Failed to create business' }, { status: 500 })
  }

  logger.info('admin_business_created', {
    business_id: business.id,
    owner_email: data.owner_email,
    twilio_number: twilioNumber,
  })

  return NextResponse.json({ ok: true, business })
}
