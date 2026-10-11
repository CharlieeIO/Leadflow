import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Public paths that don't require authentication
const PUBLIC_PREFIXES = [
  '/(auth)',
  '/login',
  '/auth',
  '/api/webhooks',
  '/api/chat',
  '/api/leads',
  '/api/keepwarm',
]

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Build a Supabase client that reads/writes cookies through the middleware.
  // This is required to refresh expired auth tokens automatically.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: Do not add any logic between createServerClient and getUser().
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  // Next.js route groups like (auth) don't appear in the URL — check the actual URL paths
  const isPublic =
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/auth') ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Pass the refreshed session cookies to the response
  return supabaseResponse
}

export const config = {
  // Run on all routes except Next.js internals and static assets
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
