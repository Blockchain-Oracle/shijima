import { markIcon } from '@/features/og/mark'

/** The favicon and the installed app's icons, drawn from the mark. `/icon/32`, `/icon/192`, `/icon/512`. */
export const contentType = 'image/png'
const SIZES = [32, 192, 512] as const

export function generateImageMetadata() {
  return SIZES.map((s) => ({ id: String(s), size: { width: s, height: s }, contentType }))
}

export default async function Icon({ id }: { id: Promise<string> }) {
  return markIcon(Number(await id))
}
