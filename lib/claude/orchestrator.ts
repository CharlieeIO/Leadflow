import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages'
import { checkEscalation } from './escalation'
import { buildSystemPrompt } from './prompts'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { Business, Lead, Conversation, OrchestratorResult, Language, BusinessSettings } from '@/types'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 300
const TIMEOUT_MS = 10_000

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

// Gets the booking link for a business. Embeds lead_id + business_id as Cal.com
// metadata query params so the booking webhook can match the appointment back to
// this lead without relying on phone/email guessing.
function getBookingLink(business: Business, lead: Lead): string | null {
  const settings = business.settings as BusinessSettings
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
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: TIMEOUT_MS,
    })

    const response = await client.messages.create({
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

  return { type: 'response', message: finalMessage, tokensUsed: promptTokens + completionTokens }
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
