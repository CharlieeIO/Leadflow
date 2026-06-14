// Auto-generated Supabase database types.
// To regenerate after schema changes:
//   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/supabase/types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string
          owner_user_id: string
          name: string
          niche: string
          twilio_number: string | null
          retell_agent_id: string | null
          cal_event_type_id: string | null
          settings: Json
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          name: string
          niche: string
          twilio_number?: string | null
          retell_agent_id?: string | null
          cal_event_type_id?: string | null
          settings?: Json
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_user_id?: string
          name?: string
          niche?: string
          twilio_number?: string | null
          retell_agent_id?: string | null
          cal_event_type_id?: string | null
          settings?: Json
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "businesses_owner_user_id_fkey"
            columns: ["owner_user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      subscriptions: {
        Row: {
          id: string
          business_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          plan: string
          status: string
          trial_ends_at: string | null
          current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          plan?: string
          status?: string
          trial_ends_at?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          plan?: string
          status?: string
          trial_ends_at?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      leads: {
        Row: {
          id: string
          business_id: string
          name: string | null
          phone: string
          email: string | null
          service_type: string | null
          message: string | null
          source: string
          status: string
          score: number
          language: string
          ai_paused: boolean
          is_existing_customer: boolean
          escalation_reason: string | null
          last_contact: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name?: string | null
          phone: string
          email?: string | null
          service_type?: string | null
          message?: string | null
          source?: string
          status?: string
          score?: number
          language?: string
          ai_paused?: boolean
          is_existing_customer?: boolean
          escalation_reason?: string | null
          last_contact?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string | null
          phone?: string
          email?: string | null
          service_type?: string | null
          message?: string | null
          source?: string
          status?: string
          score?: number
          language?: string
          ai_paused?: boolean
          is_existing_customer?: boolean
          escalation_reason?: string | null
          last_contact?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      conversations: {
        Row: {
          id: string
          lead_id: string
          business_id: string
          direction: string
          body: string
          channel: string
          ai_generated: boolean
          twilio_sid: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          business_id: string
          direction: string
          body: string
          channel?: string
          ai_generated?: boolean
          twilio_sid?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          business_id?: string
          direction?: string
          body?: string
          channel?: string
          ai_generated?: boolean
          twilio_sid?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      appointments: {
        Row: {
          id: string
          lead_id: string
          business_id: string
          scheduled_at: string
          duration_minutes: number
          status: string
          cal_booking_id: string | null
          cal_booking_uid: string | null
          reminder_24h_sent: boolean
          reminder_2h_sent: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          business_id: string
          scheduled_at: string
          duration_minutes?: number
          status?: string
          cal_booking_id?: string | null
          cal_booking_uid?: string | null
          reminder_24h_sent?: boolean
          reminder_2h_sent?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          business_id?: string
          scheduled_at?: string
          duration_minutes?: number
          status?: string
          cal_booking_id?: string | null
          cal_booking_uid?: string | null
          reminder_24h_sent?: boolean
          reminder_2h_sent?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      ai_interactions: {
        Row: {
          id: string
          conversation_id: string
          business_id: string
          lead_id: string
          model: string
          prompt_tokens: number
          completion_tokens: number
          latency_ms: number | null
          escalated: boolean
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          business_id: string
          lead_id: string
          model: string
          prompt_tokens?: number
          completion_tokens?: number
          latency_ms?: number | null
          escalated?: boolean
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          business_id?: string
          lead_id?: string
          model?: string
          prompt_tokens?: number
          completion_tokens?: number
          latency_ms?: number | null
          escalated?: boolean
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_interactions_conversation_id_fkey"
            columns: ["conversation_id"]
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interactions_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interactions_lead_id_fkey"
            columns: ["lead_id"]
            referencedRelation: "leads"
            referencedColumns: ["id"]
          }
        ]
      }
      automations: {
        Row: {
          id: string
          business_id: string
          name: string
          trigger_type: string
          message_en: string | null
          message_es: string | null
          delay_hours: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          trigger_type: string
          message_en?: string | null
          message_es?: string | null
          delay_hours?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          trigger_type?: string
          message_en?: string | null
          message_es?: string | null
          delay_hours?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      analytics_events: {
        Row: {
          id: string
          business_id: string
          lead_id: string | null
          event_type: string
          properties: Json
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          lead_id?: string | null
          event_type: string
          properties?: Json
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          lead_id?: string | null
          event_type?: string
          properties?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_lead_id_fkey"
            columns: ["lead_id"]
            referencedRelation: "leads"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ── Convenience type aliases ───────────────────────────────────────────────────
// Use these throughout the app instead of Database["public"]["Tables"]["x"]["Row"].

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]

export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]

export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
