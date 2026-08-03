import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages'
import { checkEscalation } from './escalation'
import { buildSystemPrompt } from './prompts'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend/client'
import { leadBriefHtml } from '@/lib/resend/templates'
import { fireCrmWebhook } from '@/lib/crm/outbound'
import { logger } from '@/lib/logger'
import type { Business, Lead, Conversation, OrchestratorResult, Language, BusinessSettings, LeadMetadata } from '@/types'

const MODEL = 'claude-sonnet-4-6'
const EXTRACTION_MODEL = 'claude-haiku-4-5'
const MAX_TOKENS = 300
const TIMEOUT_MS = 10_000

// Module-level singletons — reused across warm Lambda invocations
const anthropicMain = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: TIMEOUT_MS })
const anthropicExtract = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 8_000 })

// Spanish detection — simple heuristic run on the inbound message.
const SPANISH_PATTERN =
  /\b(hola|gracias|ayuda|necesito|tengo|quiero|casa|techo|aire|calor|frio|buenas|buenos|por favor|cómo|como|qué|que|cuánto|cuanto|dónde|donde|cuándo|cuando)\b|[¿¡ñÑáéíóúüÁÉÍÓÚÜ]/i

function detectLanguage(message: string, leadLanguage: Language): Language {
  return SPANISH_PATTERN.test(message) ? 'es' : leadLanguage
}

// Converts conversation history to Claude's alternating message format.
// Handles edge cases: merges consecutive same-role messages (Claude requires strict alternation).
function buildMessageHistory(
  history: Conversation[],
  inboundMessage: string,
): MessageParam[] {
  const messages: MessageParam[] = []

  for (const msg of history) {
    const role = msg.direction === 'inbound' ? 'user' : 'assistant'
    const last = messages[messages.length - 1]

    if (last && last.role === role) {
      // Merge consecutive same-role messages
      last.content = `${last.content}\n${msg.body}`
    } else {
      messages.push({ role, content: msg.body })
    }
  }

  // Append the current inbound message
  const last = messages[messages.length - 1]
  if (last?.role === 'user') {
    last.content = `${last.content}\n${inboundMessage}`
  } else {
    messages.push({ role: 'user', content: inboundMessage })
  }

  return messages
}

// Strips markdown formatting that Claude occasionally adds despite instructions.
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')   // bold
    .replace(/\*(.*?)\*/g, '$1')        // italic
    .replace(/^#{1,6}\s+/gm, '')        // headers
    .replace(/^[-*+]\s+/gm, '')         // bullet points
    .replace(/^\d+\.\s+/gm, '')         // numbered lists
    .replace(/`([^`]+)`/g, '$1')        // inline code
    .trim()
}

// Trims response to 320 chars max, breaking at a sentence boundary if possible.
function trimToSMSLength(text: string, maxChars = 320): string {
  if (text.length <= maxChars) return text

  const truncated = text.slice(0, maxChars)
  const lastSentence = truncated.search(/[.!?][^.!?]*$/)

  return lastSentence > 100
    ? truncated.slice(0, lastSentence + 1).trim()
    : truncated.slice(0, truncated.lastIndexOf(' ')).trim() + '…'
}

// Gets the booking link for a business. Tries service-type–specific links first
// (so the AI sends the right Cal.com event for AC repair vs heating install, etc.),
// then falls back to the single booking_link, then the cal_event_type_id link.
function getBookingLink(business: Business, lead: Lead): string | null {
  const settings = business.settings as BusinessSettings

  // Match by service type — fuzzy case-insensitive substring match
  if (settings.booking_links_by_service && lead.service_type) {
    const needle = lead.service_type.toLowerCase()
    const match = Object.entries(settings.booking_links_by_service).find(([key]) => {
      const k = key.toLowerCase()
      return k === needle || k.includes(needle) || needle.includes(k)
    })
    if (match) return match[1]
  }

  if (settings.booking_link) return settings.booking_link
  if (business.cal_event_type_id) {
    const params = new URLSearchParams({
      'metadata[lead_id]': lead.id,
      'metadata[business_id]': business.id,
    })
    return `https://cal.com/d/${business.cal_event_type_id}?${params.toString()}`
  }
  return null
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export interface OrchestratorInput {
  business: Business
  lead: Lead
  inboundMessage: string
  conversationHistory: Conversation[]  // last 10 messages, ASC order
  conversationId?: string              // inbound message ID — passed from SMS webhook
}

export async function generateQualificationResponse(
  input: OrchestratorInput,
): Promise<OrchestratorResult> {
  const { business, lead, inboundMessage, conversationHistory, conversationId } = input
  const startedAt = Date.now()

  // ── Step 1: Escalation check (before any API call) ──────────────────────────
  const escalation = checkEscalation(inboundMessage, conversationHistory)

  if (escalation.escalate) {
    logger.info('escalation_triggered', {
      business_id: business.id,
      lead_id: lead.id,
      event_type: 'escalation',
      escalation_type: escalation.type,
      reason: escalation.reason,
    })
    return { type: 'escalate', reason: escalation.reason }
  }

  // ── Step 2: Language detection ───────────────────────────────────────────────
  const language = detectLanguage(inboundMessage, lead.language as Language)

  // ── Step 3: Build context + system prompt ────────────────────────────────────
  const bookingLink = getBookingLink(business, lead)
  const systemPrompt = buildSystemPrompt({
    business,
    lead,
    language,
    isExistingCustomer: lead.is_existing_customer,
    bookingLink,
  })

  const messages = buildMessageHistory(conversationHistory, inboundMessage)

  // ── Step 4: Call Claude API ──────────────────────────────────────────────────
  let rawResponse: string
  let promptTokens = 0
  let completionTokens = 0

  try {
    const response = await anthropicMain.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude returned no text content')
    }

    rawResponse = textBlock.text
    promptTokens = response.usage.input_tokens
    completionTokens = response.usage.output_tokens
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)

    logger.error('claude_api_error', {
      business_id: business.id,
      lead_id: lead.id,
      error,
      latency_ms: Date.now() - startedAt,
    })

    // Fallback message — lead never hears silence
    const fallback =
      language === 'es'
        ? `¡Gracias por contactarnos! Recibimos tu mensaje y alguien de ${business.name} se pondrá en contacto contigo muy pronto.`
        : `Thanks for reaching out to ${business.name}! We received your message and someone from our team will be in touch very shortly.`

    return { type: 'error', message: fallback }
  }

  // ── Step 5: Post-process the response ────────────────────────────────────────
  const cleaned = stripMarkdown(rawResponse)
  const finalMessage = trimToSMSLength(cleaned)

  const latencyMs = Date.now() - startedAt

  logger.info('ai_response_generated', {
    business_id: business.id,
    lead_id: lead.id,
    event_type: 'ai_response',
    model: MODEL,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    latency_ms: latencyMs,
    language,
  })

  // ── Step 6: Log AI interaction to DB (async, never blocks response) ──────────
  void logAiInteraction({
    businessId: business.id,
    leadId: lead.id,
    model: MODEL,
    promptTokens,
    completionTokens,
    latencyMs,
    escalated: false,
    conversationId,
  })

  // ── Step 7: Update lead language if it changed ───────────────────────────────
  if (language !== lead.language) {
    const supabase = getSupabaseServiceClient()
    void supabase
      .from('leads')
      .update({ language })
      .eq('id', lead.id)
  }

  // ── Step 8: Fire async extraction of key qualification data ─────────────────
  // Non-blocking — runs in the background and updates lead metadata.
  // SMS response is already returned above; this never adds latency.
  void extractAndSaveLeadQualification({
    business,
    lead,
    conversationHistory,
    inboundMessage,
  })

  return { type: 'response', message: finalMessage, tokensUsed: promptTokens + completionTokens }
}

// ── Lead qualification extraction + grading ───────────────────────────────────
// Runs async after the main AI response. Extracts structured data, assigns a
// letter grade, generates an AI summary, saves to the DB, fires the lead brief
// email to the owner, and updates the CRM webhook.

async function extractAndSaveLeadQualification(params: {
  business: Business
  lead: Lead
  conversationHistory: Conversation[]
  inboundMessage: string
}): Promise<void> {
  const { business, lead, conversationHistory, inboundMessage } = params
  const businessId = business.id
  const leadId = lead.id
  const niche = business.niche

  // Build a compact conversation transcript for extraction
  const transcript = [
    ...conversationHistory.map((m) =>
      `${m.direction === 'inbound' ? 'Customer' : 'AI'}: ${m.body}`,
    ),
    `Customer: ${inboundMessage}`,
  ].join('\n')

  const settings = business.settings as BusinessSettings
  const serviceArea = settings.service_area ?? 'the local area'

  // Niche-aware service types
  const serviceTypeOptions =
    niche === 'hvac'
      ? '"AC repair", "heating repair", "AC installation", "heating installation", "maintenance", "other", or "unknown"'
      : niche === 'roofing'
      ? '"repair", "replacement", "inspection", "storm damage", "other", or "unknown"'
      : niche === 'medspa'
      ? '"botox", "filler", "laser", "facial", "body contouring", "other", or "unknown"'
      : '"repair", "installation", "maintenance", "consultation", "other", or "unknown"'

  const prompt = `You are analyzing a service business lead conversation to qualify and grade the lead.

BUSINESS: ${business.name} (${niche}) — services ${serviceArea}

CONVERSATION:
${transcript}

Return ONLY valid JSON — no explanation, no markdown:
{
  "service_type": ${serviceTypeOptions},
  "urgency": "urgent" | "routine" | "maintenance" | "unknown",
  "address": "street address or city if mentioned, or null",
  "issue_description": "one sentence describing what the customer needs, or null",
  "key_takeaways": ["confirmed fact 1", "confirmed fact 2", "confirmed fact 3"],
  "grade": "A" | "B" | "C" | "D",
  "ai_summary": "2-3 sentences analyzing lead quality, what they need, and recommended next step"
}

GRADING CRITERIA:
A — Urgent or clear need + address confirmed + service type identified = book immediately
B — Good intent, mostly qualified, one detail missing (e.g. no address yet)
C — Exploring options, low urgency, or not enough info to fully qualify yet
D — Outside service area, very vague, price-shopping only, or low intent signals

Rules:
- Only include CONFIRMED facts in key_takeaways (max 3, each under 80 chars)
- Set unknown/null for anything not mentioned in the conversation
- Grade conservatively — only give A if clearly hot
- Return only the JSON object, nothing else`

  try {
    const response = await anthropicExtract.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return

    // Strip any accidental markdown fences
    const raw = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const extracted = JSON.parse(raw) as {
      service_type?: string
      urgency?: string
      address?: string | null
      issue_description?: string | null
      key_takeaways?: string[]
      grade?: 'A' | 'B' | 'C' | 'D'
      ai_summary?: string | null
    }

    const supabase = getSupabaseServiceClient()

    // Merge with existing metadata (preserve user-written notes)
    const { data: currentLead } = await supabase
      .from('leads')
      .select('metadata, service_type, name')
      .eq('id', leadId)
      .maybeSingle()

    const existingMeta = (currentLead?.metadata ?? {}) as LeadMetadata
    const newMeta: LeadMetadata = { ...existingMeta }

    if (extracted.urgency && extracted.urgency !== 'unknown') newMeta.urgency = extracted.urgency as LeadMetadata['urgency']
    if (extracted.address) newMeta.address = extracted.address
    if (extracted.issue_description) newMeta.issue_description = extracted.issue_description
    if (extracted.key_takeaways?.length) newMeta.key_takeaways = extracted.key_takeaways
    if (extracted.grade) newMeta.grade = extracted.grade
    if (extracted.ai_summary) newMeta.ai_summary = extracted.ai_summary

    if (extracted.service_type && extracted.service_type !== 'unknown') {
      await supabase
        .from('leads')
        .update({ metadata: newMeta as never, service_type: extracted.service_type })
        .eq('id', leadId)
    } else {
      await supabase
        .from('leads')
        .update({ metadata: newMeta as never })
        .eq('id', leadId)
    }

    logger.info('lead_qualification_extracted', {
      business_id: businessId,
      lead_id: leadId,
      grade: extracted.grade,
      service_type: extracted.service_type,
      urgency: extracted.urgency,
    })

    // Build a current-state lead object for downstream use
    const updatedLead: Lead = {
      ...lead,
      metadata: newMeta,
      service_type: (extracted.service_type && extracted.service_type !== 'unknown')
        ? extracted.service_type
        : lead.service_type,
    }

    // ── Fire lead brief email to owner (non-blocking) ─────────────────────────
    // Only send when we have enough to say something meaningful (grade set)
    if (extracted.grade && settings.notification_email) {
      void sendLeadBriefEmail({
        business,
        lead: updatedLead,
        meta: newMeta,
      })
    }

    // ── Fire CRM webhook: lead.qualified ─────────────────────────────────────
    void fireCrmWebhook({
      business,
      lead: updatedLead,
      event: 'lead.qualified',
      data: {
        grade: extracted.grade,
        urgency: extracted.urgency,
        service_type: extracted.service_type,
        issue_description: extracted.issue_description,
        ai_summary: extracted.ai_summary,
        key_takeaways: extracted.key_takeaways,
      },
    })
  } catch (err) {
    logger.error('lead_extraction_failed', {
      business_id: businessId,
      lead_id: leadId,
      error: String(err),
    })
  }
}

// ── Lead brief email ──────────────────────────────────────────────────────────
// Sent to the business owner after qualification data is extracted.
// Gives the owner an instant brief: who the lead is, what they need, quality grade.

async function sendLeadBriefEmail(params: {
  business: Business
  lead: Lead
  meta: LeadMetadata
}): Promise<void> {
  const { business, lead, meta } = params
  const settings = business.settings as BusinessSettings
  const notifyEmail = settings.notification_email
  if (!notifyEmail) return

  try {
    const resend = getResend()
    const dashboardUrl = `${process.env.NEXT_PUBLIC_URL ?? 'https://www.theleadflowautomation.com'}/dashboard/leads/${lead.id}`

    await resend.emails.send({
      from: `LeadFlow AI <notifications@${process.env.RESEND_FROM_DOMAIN ?? 'theleadflowautomation.com'}>`,
      to: notifyEmail,
      subject: `${meta.grade ? `[${meta.grade}] ` : ''}New Lead — ${lead.name ?? lead.phone} — ${business.name}`,
      html: leadBriefHtml({
        businessName: business.name,
        leadName: lead.name,
        leadPhone: lead.phone,
        serviceType: lead.service_type ?? null,
        urgency: meta.urgency ?? null,
        address: meta.address ?? null,
        issueDescription: meta.issue_description ?? null,
        keyTakeaways: meta.key_takeaways ?? [],
        grade: meta.grade ?? null,
        aiSummary: meta.ai_summary ?? null,
        dashboardUrl,
      }),
    })

    logger.info('lead_brief_email_sent', {
      business_id: business.id,
      lead_id: lead.id,
      to: notifyEmail,
      grade: meta.grade,
    })
  } catch (err) {
    logger.error('lead_brief_email_failed', {
      business_id: business.id,
      lead_id: lead.id,
      error: String(err),
    })
  }
}

async function logAiInteraction(params: {
  businessId: string
  leadId: string
  model: string
  promptTokens: number
  completionTokens: number
  latencyMs: number
  escalated: boolean
  conversationId?: string
}) {
  try {
    // conversation_id is required by the DB schema — we use a placeholder here
    // and the inbound SMS webhook (Session 6) will pass the real ID.
    if (!params.conversationId) return

    const supabase = getSupabaseServiceClient()
    await supabase.from('ai_interactions').insert({
      conversation_id: params.conversationId,
      business_id: params.businessId,
      lead_id: params.leadId,
      model: params.model,
      prompt_tokens: params.promptTokens,
      completion_tokens: params.completionTokens,
      latency_ms: params.latencyMs,
      escalated: params.escalated,
    })
  } catch (err) {
    logger.error('ai_interaction_log_failed', {
      business_id: params.businessId,
      lead_id: params.leadId,
      error: String(err),
    })
  }
}
