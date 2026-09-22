import { ogCopy } from '@desk/shared'
import { siteImage } from '@/features/og/images'
import { OG_CONTENT_TYPE, OG_SIZE } from '@/features/og/theme'

/** The X card: the same image as the Open Graph preview, at the same 1200 × 630. */
export const runtime = 'nodejs'
export const alt = ogCopy.site.alt
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function Image() {
  return siteImage()
}
