import type { Route } from 'next'
import { redirect } from 'next/navigation'

/** Receive is a sheet on the wallet now. Old links land there with it open, on the agent they named. */
export default async function ReceivePage({ searchParams }: { searchParams: Promise<{ agent?: string }> }) {
  const { agent } = await searchParams
  redirect(`/wallet?receive=${encodeURIComponent(agent ?? 'wallet')}` as Route)
}
