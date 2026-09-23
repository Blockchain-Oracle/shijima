/**
 * The mark, for しじま, the stillness of deep night: a crescent moon for the night, a flat line under it for the
 * stillness (a market that is not moving), and one point of Robin Neon, the agent awake while everything is shut.
 * The moon and the line take the text colour; `.logo-mark .dot` paints the point in the accent.
 */
export const MARK_MOON = 'M14.17 4.53A10.5 10.5 0 1 0 25.12 17.79A8.6 8.6 0 0 1 14.17 4.53Z'

export function ShijimaMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d={MARK_MOON} fill="currentColor" />
      <rect x="4.5" y="27" width="23" height="2.2" rx="1.1" fill="currentColor" opacity="0.9" />
      <circle className="dot" cx="23.2" cy="9.2" r="2.6" />
    </svg>
  )
}
