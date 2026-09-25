'use client'

import { webCopy } from '@desk/shared'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ConnectWalletModal } from './wallet/ConnectWalletModal'

/**
 * "Connect wallet": the header's button, also used wherever a page needs a signed-in wallet (the Room, the take
 * composer, creating an agent). It opens the wallet picker, which connects, moves the wallet to Robinhood Chain
 * and signs in with one message. `onSignedIn` lets a caller re-read what depends on the session.
 */
export function SignInButton({
  onSignedIn,
  signedInAs,
  className = 'btn btn-primary',
  label = webCopy.account.connect,
}: {
  onSignedIn?: () => void
  signedInAs?: string | undefined
  className?: string
  label?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={className}
        data-cursor="hover"
        title={webCopy.account.signInNote}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      <ConnectWalletModal
        open={open}
        onClose={() => setOpen(false)}
        signedInAs={signedInAs}
        onSignedIn={() => {
          setOpen(false)
          router.refresh()
          onSignedIn?.()
        }}
      />
    </>
  )
}
