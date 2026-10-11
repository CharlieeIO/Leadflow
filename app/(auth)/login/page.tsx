'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

function LoginForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const callbackError = searchParams.get('error')

  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'reset_sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (callbackError) {
      setStatus('error')
      setErrorMessage('That link has expired or is invalid. Please try again.')
    }
  }, [callbackError])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setStatus('error')
      setErrorMessage(
        error.message.toLowerCase().includes('invalid')
          ? 'Incorrect email or password.'
          : error.message,
      )
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    const supabase = getSupabaseBrowserClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=/auth/reset-password`

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
    } else {
      setStatus('reset_sent')
    }
  }

  if (status === 'reset_sent') {
    return (
      <div className="w-full max-w-md">
        <Logo />
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Check your email</h2>
          <p className="text-slate-500 text-sm mb-6">
            We sent a password reset link to <strong className="text-slate-700">{email}</strong>.
          </p>
          <button
            onClick={() => { setMode('login'); setStatus('idle') }}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Back to sign in
          </button>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <Logo />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        {mode === 'login' ? (
          <>
            <h1 className="text-xl font-semibold text-slate-900 mb-1">Sign in to LeadFlow</h1>
            <p className="text-slate-500 text-sm mb-6">Enter your email and password.</p>

            {status === 'error' && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setStatus('idle') }}
                  placeholder="you@company.com"
                  required
                  autoFocus
                  autoComplete="email"
                  className={inputClass}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setStatus('idle'); setErrorMessage('') }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setStatus('idle') }}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={status === 'loading' || !email || !password}
                className={buttonClass}
              >
                {status === 'loading' ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-slate-900 mb-1">Reset your password</h1>
            <p className="text-slate-500 text-sm mb-6">
              Enter your email and we&apos;ll send a reset link.
            </p>

            {status === 'error' && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setStatus('idle') }}
                  placeholder="you@company.com"
                  required
                  autoFocus
                  autoComplete="email"
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={status === 'loading' || !email}
                className={buttonClass}
              >
                {status === 'loading' ? 'Sending…' : 'Send reset link'}
              </button>

              <button
                type="button"
                onClick={() => { setMode('login'); setStatus('idle'); setErrorMessage('') }}
                className="w-full text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
              >
                Back to sign in
              </button>
            </form>
          </>
        )}
      </div>

      <Footer />
    </div>
  )
}

function Logo() {
  return (
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
  )
}

function Footer() {
  return (
    <p className="text-center text-xs text-slate-400 mt-6">
      LeadFlow &copy; {new Date().getFullYear()} —{' '}
      <a href="mailto:support@leadflow.ai" className="hover:text-slate-600">
        support@leadflow.ai
      </a>
    </p>
  )
}

const inputClass = cn(
  'w-full px-3.5 py-2.5 rounded-lg border text-sm',
  'text-slate-900 placeholder:text-slate-400',
  'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
  'outline-none transition-colors',
)

const buttonClass = cn(
  'w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors',
  'bg-blue-600 text-white hover:bg-blue-700',
  'disabled:opacity-50 disabled:cursor-not-allowed',
)

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
