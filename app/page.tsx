import { redirect } from 'next/navigation'

// Root "/" redirects to dashboard. Middleware handles unauthenticated users
// by sending them to /login before they ever reach this Server Component.
export default function RootPage() {
  redirect('/dashboard')
}
