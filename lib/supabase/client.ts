'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

// Singleton pattern — Next.js may call this module multiple times in the same
// browser context. Reuse the same client instance to avoid WebSocket duplication
// (important for Realtime subscriptions on the lead list page).
let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function getSupabaseBrowserClient() {
  if (client) return client

  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  return client
}
