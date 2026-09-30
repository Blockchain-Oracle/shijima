'use client'

import { webCopy } from '@desk/shared'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from '@/components/ui/toast'
import { sessionChanged } from '@/lib/session-events'
import { ConnectWalletModal } from './wallet/ConnectWalletModal'

/**
 * Opens email OTP or the wallet picker. Success is reported only after the app session is saved.
 * `onSignedIn` lets a caller re-read what depends on that session.
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
          sessionChanged()
          toast.add({ title: 'You’re signed in', type: 'success' })
          setOpen(false)
          router.refresh()
          onSignedIn?.()
        }}
      />
    </>
  )
}
