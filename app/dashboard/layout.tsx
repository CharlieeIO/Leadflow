import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await getSupabaseServerClient()

  // getUser() contacts the Auth server — safe for authorization decisions.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Middleware should catch unauthenticated requests first, but this is a
  // defence-in-depth fallback in case middleware is bypassed.
  if (!user) {
    redirect('/login')
  }

  // Load the first active business owned by this user.
  // In Session 14 (admin panel) we'll add business switching for multi-business owners.
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('owner_user_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const businessName = business?.name ?? 'My Business'
  const isAdmin = !!(process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL)

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar
        businessName={businessName}
        userEmail={user.email ?? ''}
        isAdmin={isAdmin}
      />

      {/* Main content — offset by sidebar width on desktop */}
      <div className="flex flex-col flex-1 min-w-0 lg:pl-64">
        <Header userEmail={user.email ?? ''} />

        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>
    </div>
  )
}
