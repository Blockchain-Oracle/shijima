import { homeCopy } from '@desk/shared'
import { Landing } from '@/features/home/Landing'

export const dynamic = 'force-dynamic'
export const metadata = { title: { absolute: homeCopy.meta.title }, description: homeCopy.meta.description }

/** The landing page for everyone, signed in or not: the app's way back to the website (DECISIONS F8). */
export default function HomeAlways() {
  return <Landing />
}
