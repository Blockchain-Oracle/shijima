import type { NextConfig } from 'next'

const config: NextConfig = {
  // The shared packages are source-only, so Next compiles them itself.
  transpilePackages: ['@desk/shared', '@desk/chain', '@desk/core', '@desk/db'],
  // The app is live and authenticated. Nothing here may be served from a build-time cache.
  cacheComponents: false,
  typedRoutes: true,
}

export default config
