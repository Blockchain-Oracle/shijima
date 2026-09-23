import { deskByShareSlug, lastCheckOf } from '@desk/db'
import { ago, deskCopy, ogCopy } from '@desk/shared'
import { factImage, siteImage } from '@/features/og/images'
import { OG_CONTENT_TYPE, OG_SIZE } from '@/features/og/theme'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const alt = ogCopy.desk.alt
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

/**
 * A shared desk's preview: its name, its mode and when it last checked. Only a desk whose owner turned sharing on
 * gets its own card; any other address under /desk gets the site's, so a preview can never reveal a private desk.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const desk = await deskByShareSlug(db(), slug).catch(() => undefined)
  if (!desk) return siteImage()
  const last = await lastCheckOf(db(), desk.id).catch(() => undefined)
  return factImage({
    eyebrow: ogCopy.desk.eyebrow,
    title: desk.name ?? deskCopy.modes[desk.mode],
    subtitle: `${deskCopy.modes[desk.mode]}: ${deskCopy.modeNote[desk.mode]}`,
    note: last ? ogCopy.desk.lastCheck(ago(last.at)) : ogCopy.desk.noCheck,
  })
}
