-- Add per-business Twilio credentials support
-- Used when customers own their own Twilio account instead of using the platform's

alter table businesses
  add column if not exists twilio_account_sid text,
  add column if not exists twilio_auth_token  text;
