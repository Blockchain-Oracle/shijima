'use client'

import { decisionCopy, type PriceView } from '@desk/shared'
import { motion, useReducedMotion } from 'motion/react'

const S = decisionCopy.strip
/** Under half a percent from the reference is noise, the same line the engine draws (`comparedTo`). */
const IN_LINE_BPS = 50

interface Marker {
  id: 'pool' | 'reference' | 'official'
  label: string
  value: number
  text: string
}

const dollars = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * What it saw, on one line (after Agari's S22 `PriceStrip`): the pool's price, the reference it was measured
 * against, and the last official update the contract's 8% band hangs from. The zone the desk calls "in line" is
 * shaded around the reference, so a reader sees at once whether the gap was noise. The record's decimal strings
 * become numbers only to place the dots.
 */
export function PriceStrip({ price }: { price: PriceView }) {
  const reduce = useReducedMotion()
  const markers: Marker[] = [
    ...(price.poolPrice
      ? [{ id: 'pool' as const, label: S.pool, value: Number(price.poolPrice), text: '' }]
      : []),
    { id: 'reference' as const, label: S.reference, value: Number(price.referencePrice), text: '' },
    ...(price.referenceLabel === 'this pool at the last close'
      ? [{ id: 'official' as const, label: S.official, value: Number(price.lastOfficialUpdate), text: '' }]
      : []),
  ]
    .filter((m) => Number.isFinite(m.value) && m.value > 0)
    .map((m) => ({ ...m, text: dollars(m.value) }))
  const ref = Number(price.referencePrice)
  if (markers.length < 2 || !(ref > 0)) return null
  const zoneLo = ref * (1 - IN_LINE_BPS / 10_000)
  const zoneHi = ref * (1 + IN_LINE_BPS / 10_000)
  const values = [...markers.map((m) => m.value), zoneLo, zoneHi]
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = (hi - lo) * 0.15
  const min = lo - pad
  const max = hi + pad
  const at = (v: number) => ((v - min) / (max - min)) * 100
  return (
    <figure className="dc-strip" aria-label={S.aria}>
      <div className="dc-strip-track">
        <div
          className="dc-strip-zone"
          style={{ left: `${at(zoneLo)}%`, width: `${at(zoneHi) - at(zoneLo)}%` }}
        >
          <span className="dc-strip-zone-label">{S.inLine}</span>
        </div>
        {markers.map((m, i) => (
          <motion.span
            key={m.id}
            className="dc-strip-dot"
            data-id={m.id}
            style={{ left: `${at(m.value)}%` }}
            initial={reduce ? false : { opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: reduce ? 0 : 0.1 + i * 0.08 }}
            title={`${m.label} ${m.text}`}
          />
        ))}
      </div>
      <figcaption className="dc-strip-legend">
        {markers.map((m) => (
          <span key={m.id} className="dc-strip-key" data-id={m.id}>
            <span className="dc-strip-swatch" aria-hidden />
            <span>{m.label}</span>
            <b>{m.text}</b>
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
