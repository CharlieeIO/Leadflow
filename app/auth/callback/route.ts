import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

// Handles the redirect from a Supabase magic link email.
// Supabase sends the user to: /auth/callback?code=<pkce_code>
// This route exchanges the code for a session, then redirects to the dashboard.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await getSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // If something went wrong, send back to login with an error hint.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
