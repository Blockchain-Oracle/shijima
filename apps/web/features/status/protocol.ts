/**
 * What `/api/status` answers with, shared by the route, the page and the screen so the three cannot drift.
 * Words and tones are decided on the server, where the readings are; the screen only lays them out.
 */
export type Tone = 'good' | 'warn' | 'bad' | 'off'

export interface StatusRow {
  id: string
  label: string
  tone: Tone
  /** How old the reading is, or how long the source took to answer. */
  lag: string | null
  detail: string
  /** "not set up", or a closed session read as expected. */
  chip: string | null
}

export interface StatusDesk {
  id: string
  name: string
  href: string | null
  tone: Tone
  lag: string | null
  detail: string
  chip: string | null
}

export interface StatusPayload {
  checkedAtMs: number
  healthy: boolean
  /** The label of the worst row, when anything is less than good. */
  worst: string | null
  block: string | null
  rows: StatusRow[]
  desks: StatusDesk[]
  counts: { label: string; value: string; note: string }[]
}
