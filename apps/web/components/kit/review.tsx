import type { ReactNode } from 'react'
import { Card, fontMono } from './primitives'

/** The reference wallet's review summary (packages/ui/src/review.tsx): label / value rows in one bordered card. */

export interface ReviewRowData {
  readonly label: string
  readonly value: ReactNode
  readonly mono?: boolean
}

export function ReviewRow({ label, value, mono }: ReviewRowData) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '13px 0',
      }}
    >
      <span style={{ fontSize: 12.5, color: 'var(--tx2)' }}>{label}</span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--tx)',
          fontFamily: mono ? fontMono : 'inherit',
          textAlign: 'right',
          minWidth: 0,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </span>
    </div>
  )
}

export function ReviewCard({ rows }: { rows: readonly ReviewRowData[] }) {
  return (
    <Card style={{ padding: '2px 16px' }}>
      {rows.map((row, index) => (
        <div key={row.label} style={{ borderTop: index === 0 ? 'none' : '1px solid var(--bd)' }}>
          <ReviewRow {...row} />
        </div>
      ))}
    </Card>
  )
}
