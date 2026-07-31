'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Users,
  Calendar,
  Settings,
  Shield,
  Zap,
  X,
  Menu,
  CreditCard,
  Bot,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard',              label: 'Dashboard',    icon: LayoutDashboard, exact: true },
  { href: '/dashboard/leads',        label: 'Leads',        icon: Users,           exact: false },
  { href: '/dashboard/appointments', label: 'Calendar',     icon: Calendar,        exact: false },
  { href: '/dashboard/ai-console',   label: 'AI Console',   icon: Bot,             exact: false },
  { href: '/dashboard/billing',      label: 'Billing',      icon: CreditCard,      exact: false },
  { href: '/dashboard/settings',     label: 'Settings',     icon: Settings,        exact: false },
]

interface SidebarProps {
  businessName: string
  userEmail: string
  isAdmin?: boolean
}

function NavLink({
  href,
  label,
  icon: Icon,
  exact,
  onClick,
}: {
  href: string
  label: string
  icon: React.ElementType
  exact: boolean
  onClick?: () => void
}) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname.startsWith(href)

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-white/10 text-white'
          : 'text-slate-400 hover:text-white hover:bg-white/5',
      )}
    >
      <Icon className="w-4.5 h-4.5 shrink-0" size={18} />
      {label}
    </Link>
  )
}

function SidebarContent({
  businessName,
  userEmail,
  isAdmin,
  onClose,
}: SidebarProps & { onClose?: () => void }) {
  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-500 rounded-md flex items-center justify-center shrink-0">
            <Zap size={15} className="text-white" fill="white" />
          </div>
          <span className="font-semibold text-white text-sm">LeadFlow</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Business name */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-0.5">Business</p>
        <p className="text-sm text-white font-medium truncate">{businessName}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} onClick={onClose} />
        ))}

        {isAdmin && (
          <>
            <div className="my-3 border-t border-white/10" />
            <NavLink
              href="/admin"
              label="Admin Panel"
              icon={Shield}
              exact={false}
              onClick={onClose}
            />
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">
              {userEmail.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white font-medium truncate">{userEmail}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Bottom tab items for mobile (compact subset)
const BOTTOM_TABS = [
  { href: '/dashboard',              label: 'Home',      icon: LayoutDashboard, exact: true },
  { href: '/dashboard/leads',        label: 'Leads',     icon: Users,           exact: false },
  { href: '/dashboard/appointments', label: 'Calendar',  icon: Calendar,        exact: false },
  { href: '/dashboard/ai-console',   label: 'AI',        icon: Bot,             exact: false },
  { href: '/dashboard/settings',     label: 'Settings',  icon: Settings,        exact: false },
]

function BottomTab({ href, label, icon: Icon, exact }: { href: string; label: string; icon: React.ElementType; exact: boolean }) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-center gap-1 flex-1 py-2 text-xs font-medium transition-colors',
        isActive ? 'text-blue-600' : 'text-slate-500',
      )}
    >
      <Icon size={20} />
      <span>{label}</span>
    </Link>
  )
}

export function Sidebar({ businessName, userEmail, isAdmin }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile hamburger — only shown when NOT using bottom tab bar (for admin link access) */}
      {isAdmin && (
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-slate-900 text-white rounded-lg shadow-lg"
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>
      )}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile slide-in drawer (for admin or legacy access) */}
      <div
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarContent
          businessName={businessName}
          userEmail={userEmail}
          isAdmin={isAdmin}
          onClose={() => setMobileOpen(false)}
        />
      </div>

      {/* Mobile bottom tab bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex safe-area-inset-bottom">
        {BOTTOM_TABS.map((tab) => (
          <BottomTab key={tab.href} {...tab} />
        ))}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0">
        <SidebarContent
          businessName={businessName}
          userEmail={userEmail}
          isAdmin={isAdmin}
        />
      </div>
    </>
  )
}
