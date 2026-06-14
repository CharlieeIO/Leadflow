'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', textAlign: 'center', padding: '24px', background: '#f8fafc' }}>
          <div>
            <p style={{ fontSize: '48px', margin: '0 0 16px', color: '#cbd5e1' }}>⚠</p>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#0f172a', margin: '0 0 8px' }}>Something went wrong</h1>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px' }}>
              {error.digest ? `Error ID: ${error.digest}` : 'An unexpected error occurred.'}
            </p>
            <button
              onClick={reset}
              style={{ padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
