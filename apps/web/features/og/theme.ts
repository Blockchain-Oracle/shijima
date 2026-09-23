/**
 * The link-preview canvas (FIDELITY L-23), from Agari (`features/landing/og/theme.ts`). Satori reads no stylesheet
 * and no CSS variables, so Masayume's dark tokens are restated here as rgb strings. Previews always render dark:
 * a link card has no theme toggle.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const
export const OG_CONTENT_TYPE = 'image/png'

export const OG = {
  /** `--bg` */
  ground: 'rgb(5, 5, 5)',
  /** `--white` */
  ink: 'rgb(255, 255, 255)',
  /** `--gray-400` */
  soft: 'rgb(163, 163, 163)',
  /** `--gray-500` */
  dim: 'rgb(115, 115, 115)',
  /** `.crop` corner marks (part-04). */
  crop: 'rgba(255, 255, 255, 0.18)',
  /** `--vermilion` */
  vermilion: 'rgb(204,255,0)',
  /** `--color-profit` and `--color-loss` (dark), for a gap's side only: never a verdict. */
  up: 'rgb(52, 211, 153)',
  down: 'rgb(251, 113, 133)',
} as const

/** The canvas inset every image shares. */
export const OG_PAD = 72
