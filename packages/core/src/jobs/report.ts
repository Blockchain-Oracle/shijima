/**
 * The weekend report: what the desk did while the market was shut, and how each call looks now.
 *
 * The honest summary counts what it counts. A decision that could not be graded is said to be ungraded rather
 * than left out, and the quiet checks are counted rather than hidden, because "41 checks found nothing to do"
 * is the most truthful line on the page.
 */
import { lastRegularClose, nextRegularOpen } from '@desk/shared'

export interface ReportWindow {
  /** When the market last shut before this window. */
  from: Date
  /** When it reopened, or will. */
  to: Date
  /** True once the reopen has happened, so the grades in this window are final. */
  settled: boolean
}

/**
 * The closed-market window that `at` falls in, or the one that just ended. A report always covers exactly one
 * stretch of the market being shut: from a close to the next open.
 */
export function reportWindow(at: Date): ReportWindow {
  const close = lastRegularClose(at)
  const open = nextRegularOpen(close)
  return { from: close, to: open, settled: open <= at }
}

/** The window before a given one, so a reader can walk back through past reports. */
export function previousWindow(window: ReportWindow): ReportWindow {
  const before = new Date(window.from.getTime() - 60_000)
  return reportWindow(before)
}

export interface Graded {
  outcome: string
  verdict: string | null
  differenceBps: number | null
}

export interface ReportSummary {
  decisions: number
  quiet: number
  better: number
  worse: number
  noRealDifference: number
  ungraded: number
  /** One plain sentence. It never claims more than the numbers say. */
  sentence: string
}

const QUIET = new Set(['nothing_to_do'])

export function summarise(rows: Graded[]): ReportSummary {
  const quiet = rows.filter((r) => QUIET.has(r.outcome)).length
  const judged = rows.filter((r) => !QUIET.has(r.outcome))
  const count = (v: string) => judged.filter((r) => r.verdict === v).length
  const better = count('better')
  const worse = count('worse')
  const noRealDifference = count('no_real_difference')
  const ungraded = judged.length - better - worse - noRealDifference

  const parts: string[] = []
  if (better > 0) parts.push(`${better} turned out better than the alternative`)
  if (worse > 0) parts.push(`${worse} worse`)
  if (noRealDifference > 0) parts.push(`${noRealDifference} made no real difference`)
  if (ungraded > 0) parts.push(`${ungraded} cannot be graded yet`)

  const sentence =
    judged.length === 0
      ? quiet === 0
        ? 'The agent made no decisions in this window.'
        : `${quiet} checks found nothing to do. The agent made no other decisions.`
      : `${judged.length} decision${judged.length === 1 ? '' : 's'}. ${parts.join(', ')}.${
          quiet > 0 ? ` ${quiet} other checks found nothing to do.` : ''
        }`

  return { decisions: judged.length, quiet, better, worse, noRealDifference, ungraded, sentence }
}
