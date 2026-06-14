import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { generateQualificationResponse } from '@/lib/claude/orchestrator'
import { logger } from '@/lib/logger'
import type { Conversation } from '@/types'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// OPTIONS /api/chat — preflight for cross-origin widget requests
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

const ChatSchema = z.object({
  business_id: z.string().uuid(),
  lead_id: z.string().uuid(),
  message: z.string().min(1).max(2000),
})

// POST /api/chat — receive a chat widget message, return AI response
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS_HEADERS })
  }

  const parsed = ChatSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 422, headers: CORS_HEADERS },
    )
  }

  const { business_id, lead_id, message } = parsed.data
  const supabase = getSupabaseServiceClient()

  // Load business + lead together, verify they match
  const [{ data: business }, { data: lead }] = await Promise.all([
    supabase
      .from('businesses')
      .select('id, name, niche, twilio_number, retell_agent_id, cal_event_type_id, settings, active, owner_user_id, created_at, updated_at')
      .eq('id', business_id)
      .eq('active', true)
      .maybeSingle(),
    supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .eq('business_id', business_id)
      .maybeSingle(),
  ])

  if (!business || !lead) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: CORS_HEADERS })
  }

  if (lead.ai_paused) {
    const msg =
      lead.language === 'es'
        ? `Gracias por tu mensaje. Alguien de ${business.name} se pondrá en contacto contigo pronto.`
        : `Thanks for your message. Someone from ${business.name} will follow up with you shortly.`
    return NextResponse.json({ message: msg }, { headers: CORS_HEADERS })
  }

  // Fetch recent conversation history (last 10 messages, ASC)
  const { data: historyRows } = await supabase
    .from('conversations')
    .select('*')
    .eq('lead_id', lead_id)
    .eq('business_id', business_id)
    .order('created_at', { ascending: false })
    .limit(10)

  const history = ((historyRows ?? []).reverse()) as Conversation[]

  // Save the inbound message
  const { data: inboundRow } = await supabase
    .from('conversations')
    .insert({
      lead_id,
      business_id,
      direction: 'inbound',
      body: message,
      channel: 'chat',
      ai_generated: false,
    })
    .select('id')
    .single()

  // Update lead last_contact
  void supabase
    .from('leads')
    .update({ last_contact: new Date().toISOString(), status: lead.status === 'new' ? 'contacted' : lead.status })
    .eq('id', lead_id)

  // Run orchestrator
  const result = await generateQualificationResponse({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    business: business as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lead: lead as any,
    inboundMessage: message,
    conversationHistory: history,
    conversationId: inboundRow?.id,
  })

  let replyText: string

  if (result.type === 'response') {
    replyText = result.message
  } else if (result.type === 'escalate') {
    // Mark lead escalated
    void supabase
      .from('leads')
      .update({ status: 'escalated', escalation_reason: result.reason })
      .eq('id', lead_id)

    replyText =
      lead.language === 'es'
        ? `Gracias por tu mensaje. Alguien de ${business.name} se pondrá en contacto contigo muy pronto para ayudarte.`
        : `Thanks for reaching out! Someone from ${business.name} will be in touch with you very soon to help.`
  } else {
    replyText = result.message
  }

  // Save the outbound reply
  const { data: outboundRow } = await supabase
    .from('conversations')
    .insert({
      lead_id,
      business_id,
      direction: 'outbound',
      body: replyText,
      channel: 'chat',
      ai_generated: true,
    })
    .select('id')
    .single()

  logger.info('chat_widget_response', {
    business_id,
    lead_id,
    result_type: result.type,
  })

  return NextResponse.json(
    { message: replyText, conversation_id: outboundRow?.id ?? null },
    { headers: CORS_HEADERS },
  )
}
