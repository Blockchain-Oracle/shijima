import type { Route } from 'next'

/** The page every live screen on the landing shows: the showcase agent. Never `/`, which would frame itself. */
export const SHOWCASE_ROUTE = '/agents/showcase' as Route

/** Where "Open the app" goes: your wallet when signed in (W1), else the agents anyone can watch. */
export const appHrefFor = (signedIn: boolean) => (signedIn ? '/wallet' : '/agents') as Route
