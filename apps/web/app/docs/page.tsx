import { redirect } from 'next/navigation'
import { DOCS_SITE_URL } from '@/lib/docs-site'

/** `/docs`: the manual lives on its own site now (`docs-site/`), so the old address goes there. */
export default function Docs() {
  redirect(DOCS_SITE_URL)
}
