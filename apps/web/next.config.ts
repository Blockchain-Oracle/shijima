import type { NextConfig } from 'next'

const dev = process.env.NODE_ENV !== 'production'

/**
 * A content security policy for a page that shows a model's words and other people's posts. Scripts run only
 * from this site (Next's own inline bootstrap needs `unsafe-inline`; the dev server needs `eval`), no other site
 * may frame it (the landing frames our own showcase agent, features/home/landing/MockScreen), forms post only
 * here, and the browser may reach only this site, the public RPC and the services the page really calls. Model
 * text is rendered as text; this is the lock behind that.
 */
/** The fork's origin when NEXT_PUBLIC_RPC_URL is a local http address, else nothing. */
const localRpc = (() => {
  const url = process.env.NEXT_PUBLIC_RPC_URL
  if (!url?.startsWith('http://127.0.0.1') && !url?.startsWith('http://localhost')) return null
  return new URL(url).origin
})()

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  // A rehearsal points the browser at a local fork over plain http; production reads only over https.
  `connect-src 'self' https: wss:${localRpc ? ` ${localRpc}` : ''}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

const config: NextConfig = {
  // The shared packages are source-only, so Next compiles them itself.
  transpilePackages: ['@desk/shared', '@desk/chain', '@desk/core', '@desk/db'],
  // The app is live and authenticated. Nothing here may be served from a build-time cache.
  cacheComponents: false,
  typedRoutes: true,
  // A desk is called an agent now. Every link ever shared, to a desk, a decision, a report or a record, keeps
  // working: it lands on the same thing at its new address.
  async redirects() {
    return [
      { source: '/desk/:path*', destination: '/agents/:path*', permanent: true },
      { source: '/desks', destination: '/agents', permanent: true },
      { source: '/start', destination: '/agents/new', permanent: false },
      { source: '/overview', destination: '/wallet', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ]
  },
}

export default config
