/**
 * The mark: a still ring with one point of vermilion, for しじま, the silence the desk works in while the market
 * is shut. It fills Yosuku's `.logo-mark` slot, whose `.dot` rule paints the point.
 */
export function ShijimaMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="2.4" opacity="0.9" />
      <circle className="dot" cx="16" cy="16" r="4.2" />
    </svg>
  )
}
