// ─────────────────────────────────────────────────────────────────────────────
// LeadFlow — Shared TypeScript Types
// These mirror the database schema exactly. Keep in sync with migrations.
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums / Union Types ───────────────────────────────────────────────────────

export type Niche = 'roofing' | 'hvac' | 'medspa' | 'autodetail' | 'realtor'

export type LeadSource =
  | 'web_form'
  | 'sms_inbound'
  | 'missed_call'
  | 'chat_widget'
  | 'manual'

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualifying'
  | 'hot'
  | 'warm'
  | 'cold'
  | 'booked'
  | 'completed'
  | 'lost'
  | 'escalated'
  | 'opted_out'

export type Language = 'en' | 'es'

export type ConversationDirection = 'inbound' | 'outbound'

export type ConversationChannel = 'sms' | 'voice' | 'chat' | 'email'

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'no_show'
  | 'cancelled'

export type SubscriptionPlan = 'starter' | 'growth' | 'pro'

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'

export type AutomationTrigger =
  | 'lead_created'
  | 'no_response_4h'
  | 'no_response_24h'
  | 'no_response_72h'
  | 'appointment_booked'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'no_show'

export type AnalyticsEventType =
  | 'lead_created'
  | 'sms_sent'
  | 'sms_received'
  | 'ai_response'
  | 'voice_call'
  | 'escalation'
  | 'booking_link_sent'
  | 'appointment_booked'
  | 'appointment_no_show'
  | 'lead_won'
  | 'lead_lost'
  | 'opted_out'

export type NotificationType =
  | 'new_lead'
  | 'booking'
  | 'escalation'
  | 'missed_call'
  | 'ai_error'
  | 'no_show'
  | 'weekly_report'

// ── Business Settings (stored in businesses.settings jsonb) ──────────────────

export interface BusinessSettings {
  owner_name?: string
  ai_persona_name?: string
  ai_tone?: 'friendly' | 'professional' | 'urgent'
  notification_email?: string
  notification_phone?: string
  custom_instructions?: string
  service_area?: string
  address?: string
  hours_of_operation?: string
  booking_link?: string
  /** Optional per-service-type Cal.com links (HVAC: AC repair, heating repair, etc.) */
  booking_links_by_service?: Record<string, string>
  slack_webhook?: string
  language?: Language
  bilingual?: boolean
  timezone?: string
  crm_webhook_url?: string
  avg_job_value?: number
}

// ── Database Table Types ──────────────────────────────────────────────────────

export interface Business {
  id: string
  owner_user_id: string
  name: string
  niche: Niche
  twilio_number: string | null
  retell_agent_id: string | null
  cal_event_type_id: string | null
  settings: BusinessSettings
  active: boolean
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  business_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: SubscriptionPlan
  status: SubscriptionStatus
  trial_ends_at: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

export interface LeadMetadata {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  ip?: string
  sequence_step?: number
  notes?: string
  last_sequence_sent_at?: string
  // AI-extracted qualification data
  urgency?: 'urgent' | 'routine' | 'maintenance' | 'unknown'
  address?: string
  issue_description?: string
  key_takeaways?: string[]
  /** Letter grade: A (hot), B (good), C (lukewarm), D (low intent / out of area) */
  grade?: 'A' | 'B' | 'C' | 'D'
  /** 2-3 sentence AI analysis of this lead's quality and situation */
  ai_summary?: string
  [key: string]: unknown
}

export interface Lead {
  id: string
  business_id: string
  name: string | null
  phone: string
  email: string | null
  service_type: string | null
  message: string | null
  source: LeadSource
  status: LeadStatus
  score: number
  language: Language
  ai_paused: boolean
  is_existing_customer: boolean
  escalation_reason: string | null
  last_contact: string | null
  metadata: LeadMetadata
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  lead_id: string
  business_id: string
  direction: ConversationDirection
  body: string
  channel: ConversationChannel
  ai_generated: boolean
  twilio_sid: string | null
  created_at: string
}

export interface Appointment {
  id: string
  lead_id: string
  business_id: string
  scheduled_at: string
  duration_minutes: number
  status: AppointmentStatus
  cal_booking_id: string | null
  cal_booking_uid: string | null
  reminder_24h_sent: boolean
  reminder_2h_sent: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AiInteraction {
  id: string
  conversation_id: string
  business_id: string
  lead_id: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  latency_ms: number | null
  escalated: boolean
  metadata: Record<string, unknown>
  created_at: string
}

export interface Automation {
  id: string
  business_id: string
  name: string
  trigger_type: AutomationTrigger
  message_en: string | null
  message_es: string | null
  delay_hours: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface AnalyticsEvent {
  id: string
  business_id: string
  lead_id: string | null
  event_type: AnalyticsEventType
  properties: Record<string, unknown>
  created_at: string
}

// ── API Request / Response Types ──────────────────────────────────────────────

export interface LeadIntakeRequest {
  business_id: string
  name?: string
  phone: string
  email?: string
  service_type?: string
  message?: string
  source?: LeadSource
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

export interface LeadIntakeResponse {
  success: true
  lead_id: string
}

export interface ApiError {
  error: string
  code?: string
}

// ── Retell Webhook Types ──────────────────────────────────────────────────────

export interface RetellCallAnalysis {
  call_summary?: string
  in_voicemail?: boolean
  user_sentiment?: string
  call_successful?: boolean
  custom_analysis_data?: Record<string, unknown>
}

export interface RetellCall {
  call_id: string
  agent_id: string
  call_status: string
  from_number: string
  to_number: string
  start_timestamp?: number
  end_timestamp?: number
  transcript?: string
  call_analysis?: RetellCallAnalysis
  metadata?: Record<string, unknown>
}

export interface RetellWebhookEvent {
  event: 'call_started' | 'call_ended' | 'call_analyzed'
  call: RetellCall
}

// ── AI Orchestrator Types ─────────────────────────────────────────────────────

export type OrchestratorResult =
  | { type: 'response'; message: string; tokensUsed: number }
  | { type: 'escalate'; reason: string }
  | { type: 'error'; message: string }

export interface OrchestratorInput {
  business: Business
  lead: Lead
  inboundMessage: string
  conversationHistory: Conversation[]
}

// ── Notification Types ────────────────────────────────────────────────────────

export interface NotifyOwnerOptions {
  business: Business
  lead: Lead
  message: string
  type: NotificationType
  context?: Record<string, unknown>
}

// ── Dashboard / Analytics Types ───────────────────────────────────────────────

export interface DashboardStats {
  totalLeads: number
  totalLeadsChange: number
  appointmentsBooked: number
  appointmentsChange: number
  avgResponseTimeMinutes: number
  avgResponseTimeChange: number
  conversionRate: number
  conversionRateChange: number
  revenueThisMonth: number
  avgJobValue: number
}

export interface LeadsByDay {
  date: string
  web_form: number
  sms_inbound: number
  missed_call: number
  chat_widget: number
  manual: number
  total: number
}

// ── Widget Types ──────────────────────────────────────────────────────────────

export interface ChatWidgetMessage {
  business_id: string
  phone: string
  message: string
  conversation_id?: string
}

export interface ChatWidgetResponse {
  message: string
  conversation_id: string
}
