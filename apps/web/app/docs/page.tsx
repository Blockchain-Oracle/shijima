import { docsCopy } from '@desk/shared'
import { DocsPage } from '@/features/docs/DocsPage'

export const metadata = { title: docsCopy.title, description: docsCopy.lead }

/** `/docs`: the manual, for users first and builders after. Static: every word is in shared/copy/docs.ts. */
export default function Docs() {
  return <DocsPage />
}
