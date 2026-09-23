import { markIcon } from '@/features/og/mark'

/** The home-screen icon iPhones ask for. */
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return markIcon(180)
}
