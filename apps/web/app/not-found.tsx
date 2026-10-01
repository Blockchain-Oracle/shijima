import { appCopy } from '@desk/shared'
import { NotFoundScreen } from '@/features/errors/NotFoundScreen'

export const metadata = { title: appCopy.notFound.meta }

/** Every address that leads nowhere: a mistyped route, a decision that does not exist. */
export default function NotFound() {
  return <NotFoundScreen />
}
