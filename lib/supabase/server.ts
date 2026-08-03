import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// ── Session-aware client (for Server Components and Route Handlers) ───────────
// Reads/writes session cookies so the user's auth state is preserved across
// requests. Uses the anon key + RLS to enforce data isolation.
// Call this in Server Components, Route Handlers, and Server Actions.
export async function getSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // setAll is called from Server Components where cookies cannot be
            // set. Safe to ignore — middleware keeps the session refreshed.
          }
        },
      },
    },
  )
}

// ── Service role client (for webhook handlers and cron jobs) ──────────────────
// Bypasses RLS entirely. ONLY use in server-side code that has already
// validated the request (Twilio signature, Stripe webhook secret, etc.).
// Never import this in a Client Component or expose it to the browser.
// Cached at module level — reused across warm invocations on the same Lambda container.
let _serviceClient: ReturnType<typeof createClient<Database>> | null = null

export function getSupabaseServiceClient() {
  if (!_serviceClient) {
    _serviceClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )
  }
  return _serviceClient
}
