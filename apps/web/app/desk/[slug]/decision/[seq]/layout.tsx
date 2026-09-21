import type { ReactNode } from 'react'
import { LegacyFrame } from '@/components/legacy-frame'

export default function Layout({ children }: { children: ReactNode }) {
  return <LegacyFrame>{children}</LegacyFrame>
}
