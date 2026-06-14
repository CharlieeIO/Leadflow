'use client'

import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Bell } from 'lucide-react'
import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// Maps route prefixes to page titles shown in the header.
const PAGE_TITLES: Record<string, string> = {
  '/dashboard/leads': 'Leads',
  '/dashboard/appointments': 'Appointments',
  '/dashboard/settings': 'Settings',
  '/admin': 'Admin',
  '/dashboard': 'Dashboard',
}

function getPageTitle(pathname: string): string {
  for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(prefix)) return title
  }
  return 'Dashboard'
}

interface HeaderProps {
  userEmail: string
}

export function Header({ userEmail }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const pageTitle = getPageTitle(pathname)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      {/* Page title — visible on desktop, hidden on mobile (hamburger is there instead) */}
      <h1 className="text-lg font-semibold text-slate-900 hidden lg:block">{pageTitle}</h1>
      <div className="lg:hidden" /> {/* spacer for mobile */}

      <div className="flex items-center gap-2">
        {/* Notification bell — placeholder, will be wired in Session 10 */}
        <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <Bell size={18} />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {userEmail.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-slate-700 font-medium hidden sm:block max-w-[140px] truncate">
              {userEmail}
            </span>
          </button>

          {userMenuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs text-slate-500 truncate">{userEmail}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700',
                    'hover:bg-slate-50 transition-colors text-left',
                    'disabled:opacity-50',
                  )}
                >
                  <LogOut size={15} className="text-slate-400" />
                  {signingOut ? 'Signing out...' : 'Sign out'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
