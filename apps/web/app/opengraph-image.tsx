import { ogCopy } from '@desk/shared'
import { siteImage } from '@/features/og/images'
import { OG_CONTENT_TYPE, OG_SIZE } from '@/features/og/theme'

/** The site's link preview (FIDELITY L-23): the promise in two lines, rendered from the vendored face. */
export const runtime = 'nodejs'
export const alt = ogCopy.site.alt
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function Image() {
  return siteImage()
}
