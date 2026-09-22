import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * The fixture pages (`/dev/states`, `/dev/share`) are for us and the designer. They ship only on a development
 * server, or on a deploy that asks for them with `DEV_PAGES=1`.
 */
export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production' && process.env.DEV_PAGES !== '1') notFound()
  return children
}
