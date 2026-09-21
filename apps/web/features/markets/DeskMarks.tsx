import { ago, marketsCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import type { DeskMark } from '@/lib/markets.server'
import { AssetDisc } from './marks'

/** The record's summaries cite their evidence as "[e1]"; in a list with no evidence beside it, the ids are noise. */
const plain = (summary: string) => summary.replace(/\s*\[[a-z]\d+(?:,\s*[a-z]\d+)*\]/g, '').trim()

/**
 * What shared desks did, in words: the same decisions the charts mark, each opening its reasons. Agari's activity
 * rows (`history.css`): a mark, the line, the desk's own summary under it, and when.
 */
export function DeskMarks({ marks, empty }: { marks: DeskMark[]; empty: string }) {
  if (marks.length === 0) return <p className="type-body text-ink-secondary">{empty}</p>
  return (
    <ol className="sj-marks">
      {marks.map((m) => (
        <li key={m.id}>
          <Link href={m.href as Route} className="sj-mark" data-kind={m.kind} data-cursor="hover">
            <AssetDisc symbol={m.symbol} className="glyph" />
            <span className="sj-mark-body">
              <span className="sj-mark-line">
                {m.line}
                {m.kind === 'practice' && <span className="sj-mark-tag">{marketsCopy.practice}</span>}
              </span>
              <span className="sj-mark-summary">{plain(m.summary)}</span>
            </span>
            <span className="sj-mark-when">{ago(new Date(m.at))}</span>
          </Link>
        </li>
      ))}
    </ol>
  )
}
