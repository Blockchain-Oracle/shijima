/** One of the owner's agents as the sidebar lists it. Plain values only: it crosses to the client. */
export interface SidebarAgent {
  id: string
  /** The share slug when there is one, else the id: the owner reaches their agent by either. */
  slug: string
  name: string
  mode: string
  state: string
  lifecycle: string
  /** Raw USDG (6 decimals) as a string; null until the agent's first valuation. */
  valueUsdg: string | null
  /** Change over the last day, in basis points; null without a snapshot a day old. */
  changeBps: number | null
  /** What it holds, heaviest first, for its logo stack. */
  symbols: string[]
  /** Requests waiting for the owner's answer. */
  needsYou: number
}
