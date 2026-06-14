import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/lib/supabase/types'

export async function proxy(request: NextRequest) {
  // Start with a passthrough response. The cookie helper below may replace it
  // if Supabase needs to set refreshed session cookies.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Propagate updated cookies to both the forwarded request and the
          // response so that the browser receives the refreshed session.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: use getUser() — getSession() is unverified and must not be
  // used for authorization decisions (the @supabase/ssr README explains why).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Protected routes: dashboard + admin + agency ─────────────────────────────
  const isDashboard = pathname.startsWith('/dashboard') || pathname === '/'
  const isAdmin = pathname.startsWith('/admin')
  const isAgency = pathname.startsWith('/agency')

  if ((isDashboard || isAdmin || isAgency) && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── Admin + agency routes: require ADMIN_EMAIL match ─────────────────────
  if ((isAdmin || isAgency) && user) {
    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail || user.email !== adminEmail) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // ── Bounce authenticated users away from the login page ───────────────────
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // ── Cron routes: require Authorization: Bearer ADMIN_SECRET ──────────────
  if (pathname.startsWith('/api/cron/')) {
    const authHeader = request.headers.get('authorization')
    const expected = `Bearer ${process.env.ADMIN_SECRET}`
    if (!process.env.ADMIN_SECRET || authHeader !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static assets)
     * - _next/image   (image optimization)
     * - favicon.ico
     * - public files (SVGs, widget.js, etc.)
     * - api/webhooks  (Twilio/Retell/Cal/Stripe — verified by their own secrets)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.svg|.*\\.js$|api/webhooks).*)',
  ],
}
