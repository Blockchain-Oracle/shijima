import { homeCopy } from '@desk/shared'
import { Landing } from '@/features/home/Landing'

export const dynamic = 'force-dynamic'
export const metadata = { title: { absolute: homeCopy.meta.title }, description: homeCopy.meta.description }

/**
 * `/` is the landing page for everyone, signed in or not (DECISIONS R6, Abu 23 Sep: "I should be able to go to my
 * landing page"). Signed in, its buttons open the app at `/wallet`; the app's own home is `/wallet`.
 */
export default function Home() {
  return <Landing />
}
