import type { Route } from 'next'
import { redirect } from 'next/navigation'

/** The old way in. Starting a desk now happens in the strategies studio; a chosen basket comes along. */
export default async function Start({ searchParams }: { searchParams: Promise<{ preset?: string }> }) {
  const { preset } = await searchParams
  redirect((preset ? `/strategies?preset=${encodeURIComponent(preset)}` : '/strategies') as Route)
}
