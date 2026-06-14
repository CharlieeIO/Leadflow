'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

function LoginForm() {
  const searchParams = useSearchParams()
  const callbackError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Show error from auth callback redirect (e.g. expired magic link)
  useEffect(() => {
    if (callbackError) setStatus('error')
  }, [callbackError])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    const supabase = getSupabaseBrowserClient()
    const redirectTo = `${window.location.origin}/auth/callback`

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })

    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-slate-900">LeadFlow</span>
        </div>
        <p className="text-slate-500 text-sm">AI-powered lead conversion for local businesses</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        {status === 'sent' ? (
          <div className="text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Check your email</h2>
            <p className="text-slate-500 text-sm mb-6">
              We sent a magic link to <strong className="text-slate-700">{email}</strong>.
              Click the link to sign in — no password needed.
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-slate-900 mb-1">Sign in to your account</h1>
            <p className="text-slate-500 text-sm mb-6">
              Enter your email and we&apos;ll send you a magic link.
            </p>

            {status === 'error' && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                {errorMessage || 'That link has expired. Request a new one below.'}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoFocus
                  className={cn(
                    'w-full px-3.5 py-2.5 rounded-lg border text-sm',
                    'text-slate-900 placeholder:text-slate-400',
                    'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
                    'outline-none transition-colors',
                  )}
                />
              </div>

              <button
                type="submit"
                disabled={status === 'loading' || !email}
                className={cn(
                  'w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors',
                  'bg-blue-600 text-white hover:bg-blue-700',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {status === 'loading' ? 'Sending...' : 'Send magic link'}
              </button>
            </form>
          </>
        )}
      </div>

      <p className="text-center text-xs text-slate-400 mt-6">
        LeadFlow &copy; {new Date().getFullYear()} —
        <a href="mailto:support@leadflow.ai" className="hover:text-slate-600 ml-1">support@leadflow.ai</a>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
