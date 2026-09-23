import { studioCopy } from '@desk/shared'
import Strategies from '@/app/strategies/page'

export const dynamic = 'force-dynamic'
export const metadata = { title: studioCopy.tabs.create }

/** "New agent" in the sidebar: the studio, opened on its create view. `/start` lands here too. */
export default async function NewAgent({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; view?: string }>
}) {
  const params = await searchParams
  return Strategies({ searchParams: Promise.resolve({ ...params, view: 'create' }) })
}
