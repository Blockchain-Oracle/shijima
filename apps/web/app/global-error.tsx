'use client'

/**
 * The last resort, when the root layout itself failed: no shell, no fonts, no shared copy module to lean on, so
 * the words are here and the styling is inline.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{ margin: 0, background: '#0b0a09', color: '#f4eee3', fontFamily: 'system-ui, sans-serif' }}
      >
        <main style={{ maxWidth: 560, margin: '18vh auto', padding: '0 24px' }}>
          <p style={{ color: '#e04d26', letterSpacing: '0.14em', fontSize: 12 }}>500</p>
          <h1 style={{ fontSize: 28, margin: '8px 0' }}>Shijima could not load</h1>
          <p style={{ color: '#a8a29a', lineHeight: 1.6 }}>
            Your money is not affected: it sits in your agent’s account on the chain, and only you can
            withdraw it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              padding: '10px 18px',
              background: '#e04d26',
              color: '#fff',
              border: 0,
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
