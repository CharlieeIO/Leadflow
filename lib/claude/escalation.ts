import type { Conversation } from '@/types'

export type EscalationType =
  | 'complaint'        // negative language — needs owner immediately
  | 'human_requested'  // lead asked for a real person
  | 'opt_out'          // STOP / unsubscribe — must halt all AI messages
  | 'repeated_message' // same message sent 3+ times
  | 'message_limit'    // 10+ messages exchanged, no booking yet

export type EscalationResult =
  | { escalate: false }
  | { escalate: true; type: EscalationType; reason: string }

// ── Keyword lists ─────────────────────────────────────────────────────────────

const COMPLAINT_KEYWORDS = [
  'complaint', 'complain', 'unhappy', 'not happy', 'dissatisfied',
  'refund', 'money back',
  'lawsuit', 'lawyer', 'attorney', 'sue', 'suing', 'legal',
  'bbb', 'better business',
  'scam', 'fraud', 'fraudulent', 'rip off', 'ripoff', 'ripped off',
  'terrible', 'horrible', 'awful', 'disgusting', 'outrageous',
  'angry', 'furious', 'livid', 'pissed',
  'not coming back', 'never again', 'worst',
  'news', 'reporter', 'channel', 'media',
  'review', 'yelp', 'google review', 'leave a review', 'bad review',
  // Spanish equivalents
  'queja', 'estafa', 'fraude', 'abogado', 'demanda', 'enojado', 'furioso',
]

const HUMAN_REQUEST_KEYWORDS = [
  'human', 'real person', 'real human', 'actual person',
  'speak to someone', 'talk to someone', 'talk to a person',
  'speak with someone', 'speak with a person',
  'call me', 'call me back', 'give me a call',
  'manager', 'supervisor', 'owner',
  // Spanish equivalents
  'persona real', 'hablar con alguien', 'gerente', 'dueño', 'llámame',
]

const OPT_OUT_KEYWORDS = [
  'stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit',
  'opt out', 'opt-out', 'optout',
  'remove me', 'remove my number',
  // Spanish equivalents
  'parar', 'detener', 'cancelar', 'salir',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function containsAny(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase()
  return keywords.find((kw) => lower.includes(kw)) ?? null
}

// ── Main escalation check ─────────────────────────────────────────────────────
// Called BEFORE any Claude API call — saves tokens and reduces latency.
// Returns immediately on first match; checks in priority order.
export function checkEscalation(
  inboundMessage: string,
  history: Conversation[],
): EscalationResult {
  // 1. Opt-out — highest priority, halts everything
  const optOutMatch = containsAny(inboundMessage, OPT_OUT_KEYWORDS)
  if (optOutMatch) {
    return {
      escalate: true,
      type: 'opt_out',
      reason: `Lead sent opt-out keyword: "${optOutMatch}"`,
    }
  }

  // 2. Complaint language
  const complaintMatch = containsAny(inboundMessage, COMPLAINT_KEYWORDS)
  if (complaintMatch) {
    return {
      escalate: true,
      type: 'complaint',
      reason: `Complaint language detected: "${complaintMatch}"`,
    }
  }

  // 3. Human explicitly requested
  const humanMatch = containsAny(inboundMessage, HUMAN_REQUEST_KEYWORDS)
  if (humanMatch) {
    return {
      escalate: true,
      type: 'human_requested',
      reason: `Lead requested a human: "${humanMatch}"`,
    }
  }

  // 4. Repeated message — same content sent 3+ times in history
  if (history.length > 0) {
    const inboundLower = inboundMessage.trim().toLowerCase()
    const inboundHistory = history.filter((m) => m.direction === 'inbound')
    const matchCount = inboundHistory.filter(
      (m) => m.body.trim().toLowerCase() === inboundLower,
    ).length

    // +1 for the current message
    if (matchCount + 1 >= 3) {
      return {
        escalate: true,
        type: 'repeated_message',
        reason: `Lead sent the same message ${matchCount + 1} times`,
      }
    }
  }

  // 5. Message limit — 10+ exchanges with no booking yet
  if (history.length >= 10) {
    return {
      escalate: true,
      type: 'message_limit',
      reason: `${history.length} messages exchanged with no booking — warm lead needs human touch`,
    }
  }

  return { escalate: false }
}
