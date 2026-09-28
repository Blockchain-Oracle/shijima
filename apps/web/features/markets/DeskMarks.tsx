import { ago, marketsCopy } from '@desk/shared'
import { ChevronRight } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { TokenLogo } from '@/components/ui/token-logo'
import type { DeskMark } from '@/lib/markets.server'
import { EmptyTiles } from './EmptyTiles'

/** The record's summaries cite their evidence as "[e1]"; in a list with no evidence beside it, the ids are noise. */
const plain = (summary: string) => summary.replace(/\s*\[[a-z]\d+(?:,\s*[a-z]\d+)*\]/g, '').trim()

/**
 * What shared desks did, in words: the same decisions the charts mark, each opening its reasons. 21st's Audit Log
 * With Icon Tiles (28483) in a bordered panel: the stock's real logo with a dot for what was decided, the line, the
 * desk's own summary under it, and when.
 */
export function DeskMarks({ marks, empty }: { marks: DeskMark[]; empty: string }) {
  if (marks.length === 0) {
    return (
      <EmptyTiles
        tiles={[
          <TokenLogo key="a" symbol="SPY" size={26} />,
          <TokenLogo key="b" symbol="NVDA" size={26} />,
          <TokenLogo key="c" symbol="AAPL" size={26} />,
        ]}
        title={empty}
      />
    )
  }
  return (
    <div className="dc-panel">
      <ol className="dc-feed">
        {marks.map((m) => (
          <li key={m.id}>
            <Link
              href={m.href as Route}
              className="dc-row dc-row--top"
              data-kind={m.kind}
              data-cursor="hover"
            >
              <span className="dc-mark-tile" data-kind={m.kind}>
                <TokenLogo symbol={m.symbol} size={34} />
              </span>
              <span className="dc-row-body">
                <span className="dc-row-title">
                  {m.line}
                  {m.kind === 'practice' && <span className="dc-tag">{marketsCopy.practice}</span>}
                </span>
                <span className="dc-row-sub dc-clamp">{plain(m.summary)}</span>
              </span>
              <span className="dc-row-end">
                <span className="dc-time">{ago(new Date(m.at))}</span>
                <ChevronRight className="dc-chev" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
