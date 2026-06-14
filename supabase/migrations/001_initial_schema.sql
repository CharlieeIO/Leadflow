-- ─────────────────────────────────────────────────────────────────────────────
-- LeadFlow — Initial Schema Migration
-- Run via: supabase db push  (or paste into Supabase SQL editor)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Updated-at trigger helper ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: businesses
-- One row per client. owner_user_id links to Supabase Auth.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE businesses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                text NOT NULL,
  -- 'roofing' | 'hvac' | 'medspa' | 'autodetail' | 'realtor'
  niche               text NOT NULL,
  -- Twilio number in E.164 format e.g. +12145551234
  twilio_number       text UNIQUE,
  -- Retell AI agent ID for voice calls
  retell_agent_id     text,
  -- Cal.com event type ID for booking link generation
  cal_event_type_id   text,
  -- JSON blob: owner_name, ai_persona_name, notification_email,
  -- notification_phone, custom_instructions, service_area,
  -- booking_link, slack_webhook, language, timezone
  settings            jsonb NOT NULL DEFAULT '{}',
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT NOW(),
  updated_at          timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: subscriptions
-- Stripe billing state per business (one-to-one).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE subscriptions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id               uuid NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  stripe_customer_id        text UNIQUE,
  stripe_subscription_id    text,
  -- 'starter' | 'growth' | 'pro'
  plan                      text NOT NULL DEFAULT 'starter',
  -- 'trialing' | 'active' | 'past_due' | 'canceled'
  status                    text NOT NULL DEFAULT 'trialing',
  trial_ends_at             timestamptz,
  current_period_end        timestamptz,
  created_at                timestamptz NOT NULL DEFAULT NOW(),
  updated_at                timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: leads
-- Core entity — one row per unique (phone, business_id) pair.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE leads (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name                  text,
  phone                 text NOT NULL,
  email                 text,
  service_type          text,
  -- Original message from web form or first SMS
  message               text,
  -- 'web_form' | 'sms_inbound' | 'missed_call' | 'chat_widget' | 'manual'
  source                text NOT NULL DEFAULT 'web_form',
  -- Full status lifecycle — see types/index.ts for all values
  status                text NOT NULL DEFAULT 'new',
  -- 0-100 engagement score
  score                 integer NOT NULL DEFAULT 0,
  -- 'en' | 'es'
  language              text NOT NULL DEFAULT 'en',
  -- When true: AI stops responding, owner takes over
  ai_paused             boolean NOT NULL DEFAULT false,
  is_existing_customer  boolean NOT NULL DEFAULT false,
  escalation_reason     text,
  last_contact          timestamptz,
  -- utm params, ip, sequence_step, notes, last_sequence_sent_at
  metadata              jsonb NOT NULL DEFAULT '{}',
  -- Phone is unique per business — same person can be a lead for multiple businesses
  UNIQUE (phone, business_id),
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: conversations
-- Append-only message log. No updated_at — messages are never edited.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE conversations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  -- 'inbound' | 'outbound'
  direction     text NOT NULL,
  body          text NOT NULL,
  -- 'sms' | 'voice' | 'chat' | 'email'
  channel       text NOT NULL DEFAULT 'sms',
  ai_generated  boolean NOT NULL DEFAULT false,
  -- Twilio message SID for delivery status tracking
  twilio_sid    text,
  created_at    timestamptz NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: appointments
-- Cal.com booking records synced via webhook.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE appointments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  business_id           uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  scheduled_at          timestamptz NOT NULL,
  duration_minutes      integer NOT NULL DEFAULT 30,
  -- 'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled'
  status                text NOT NULL DEFAULT 'pending',
  cal_booking_id        text,
  cal_booking_uid       text,
  reminder_24h_sent     boolean NOT NULL DEFAULT false,
  reminder_2h_sent      boolean NOT NULL DEFAULT false,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: ai_interactions
-- Token usage and latency log per AI call. Append-only.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE ai_interactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  business_id       uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lead_id           uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  model             text NOT NULL,
  prompt_tokens     integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  latency_ms        integer,
  escalated         boolean NOT NULL DEFAULT false,
  metadata          jsonb NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: automations
-- Configurable message sequences per business.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE automations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          text NOT NULL,
  -- 'lead_created' | 'no_response_4h' | 'no_response_24h' | 'no_response_72h'
  -- | 'appointment_booked' | 'reminder_24h' | 'reminder_2h' | 'no_show'
  trigger_type  text NOT NULL,
  message_en    text,
  message_es    text,
  delay_hours   integer NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER automations_updated_at
  BEFORE UPDATE ON automations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: analytics_events
-- Immutable event stream for dashboard stats and reporting. Append-only.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE analytics_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  -- Nullable — some events (e.g. weekly_report) are not lead-specific
  lead_id       uuid REFERENCES leads(id) ON DELETE SET NULL,
  -- Full event type list — see types/index.ts AnalyticsEventType
  event_type    text NOT NULL,
  properties    jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- All performance-critical query patterns are covered.
-- ─────────────────────────────────────────────────────────────────────────────

-- leads: dashboard list (most recent first, per business)
CREATE INDEX idx_leads_business_created     ON leads(business_id, created_at DESC);
-- leads: inbound SMS lookup (phone dedup + existing customer check)
CREATE INDEX idx_leads_phone_business       ON leads(phone, business_id);
-- leads: filter tabs (All / New / Hot / Booked etc.)
CREATE INDEX idx_leads_business_status      ON leads(business_id, status);

-- conversations: load thread in chronological order
CREATE INDEX idx_conversations_lead         ON conversations(lead_id, created_at ASC);
-- conversations: dashboard recent activity feed
CREATE INDEX idx_conversations_business     ON conversations(business_id, created_at DESC);

-- appointments: upcoming appointments calendar view
CREATE INDEX idx_appointments_business_time ON appointments(business_id, scheduled_at);
-- appointments: reminder cron — partial index only scans confirmed rows
CREATE INDEX idx_appointments_confirmed     ON appointments(status, scheduled_at)
  WHERE status = 'confirmed';

-- analytics_events: dashboard stats aggregation
CREATE INDEX idx_analytics_business_type    ON analytics_events(business_id, event_type, created_at DESC);

-- ai_interactions: token usage reporting per business
CREATE INDEX idx_ai_interactions_business   ON ai_interactions(business_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Every table is locked down. Users can only see rows belonging to businesses
-- they own. The service role key (used in webhook handlers) bypasses RLS.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE businesses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events  ENABLE ROW LEVEL SECURITY;

-- ── businesses ───────────────────────────────────────────────────────────────
-- Direct ownership check — the FK to auth.users lives on this table.
CREATE POLICY "owner_all" ON businesses
  FOR ALL
  USING     (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- ── Reusable subquery for all other tables ────────────────────────────────────
-- Every other table has business_id → businesses(id). The policy checks that
-- business_id is owned by the current user. WITH CHECK prevents inserts into
-- businesses the user doesn't own.

CREATE POLICY "owner_all" ON subscriptions
  FOR ALL
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "owner_all" ON leads
  FOR ALL
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "owner_all" ON conversations
  FOR ALL
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "owner_all" ON appointments
  FOR ALL
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "owner_all" ON ai_interactions
  FOR ALL
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "owner_all" ON automations
  FOR ALL
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "owner_all" ON analytics_events
  FOR ALL
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid())
  );
