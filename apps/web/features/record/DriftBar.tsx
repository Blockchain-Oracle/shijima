import { decisionCopy, percent } from '@desk/shared'

const D = decisionCopy.drift

/**
 * Why it looked, drawn: this holding's share of the desk now, its target, and the band it may wander inside
 * before the desk considers acting. A fill that ends outside the band is the reason the desk looked.
 */
export function DriftBar({
  weightBps,
  targetBps,
  thresholdBps,
}: {
  weightBps: number
  targetBps: number
  thresholdBps: number
}) {
  const top = Math.max(weightBps, targetBps + thresholdBps, 1) * 1.15
  const at = (bps: number) => `${Math.max(0, Math.min(100, (bps / top) * 100))}%`
  const lo = Math.max(0, targetBps - thresholdBps)
  const hi = targetBps + thresholdBps
  const outside = weightBps < lo || weightBps > hi
  return (
    <figure className="dc-drift" aria-label={D.aria}>
      <div className="dc-drift-track">
        <span className="dc-drift-band" style={{ left: at(lo), width: `calc(${at(hi)} - ${at(lo)})` }} />
        <span
          className="dc-drift-fill"
          data-outside={outside ? '' : undefined}
          style={{ width: at(weightBps) }}
        />
        <span className="dc-drift-target" style={{ left: at(targetBps) }} />
      </div>
      <figcaption className="dc-drift-legend">
        <span data-id="now">{D.now(percent(weightBps))}</span>
        <span data-id="target">{D.target(percent(targetBps))}</span>
        <span data-id="band">{D.wander(percent(thresholdBps))}</span>
      </figcaption>
    </figure>
  )
}
