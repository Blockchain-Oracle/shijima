'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { WagmiProvider } from 'wagmi'
import { config } from '@/lib/wagmi'

const EmailAuthProvider = dynamic(() =>
  import('./shell/wallet/EmailAuthProvider').then((m) => m.EmailAuthProvider),
)

export function Providers({
  children,
  emailEnabled = false,
  signedInAs,
}: {
  children: ReactNode
  emailEnabled?: boolean
  signedInAs?: string | undefined
}) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {emailEnabled ? (
          <EmailAuthProvider enabled signedInAs={signedInAs}>
            {children}
          </EmailAuthProvider>
        ) : (
          children
        )}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
