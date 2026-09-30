'use client'

import { Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { SignInButton } from '@/components/shell/SignInButton'
import { EmailSignIn } from '@/components/shell/wallet/EmailSignIn'
import { useEmailAuth } from '@/components/shell/wallet/email-auth-context'
import { Modal } from '@/components/ui/modal'

export function EmailAccount({ address }: { address: string }) {
  const auth = useEmailAuth()
  const router = useRouter()
  const connected = useAccount().address?.toLowerCase() === address.toLowerCase()
  const [open, setOpen] = useState(false)
  const email = auth.accounts.some((a) => a.address.toLowerCase() === address.toLowerCase())
    ? auth.email
    : undefined
  return (
    <section className="st-section">
      <div className="st-section-head">
        <Mail aria-hidden="true" className="size-4" />
        <span>Email sign-in</span>
      </div>
      <div className="st-row st-row--block">
        <span className="st-row-title">{email ?? 'Add email to this wallet'}</span>
        <span className="st-row-sub">
          {email
            ? 'Use a code from your inbox to open this account. Your existing wallet still signs transactions.'
            : 'Sign in with email and keep the same agents and wallet.'}
        </span>
        {!email &&
          (connected ? (
            <button type="button" className="st-btn" disabled={!auth.enabled} onClick={() => setOpen(true)}>
              {auth.enabled ? 'Link email' : 'Email sign-in is being set up'}
            </button>
          ) : (
            <SignInButton
              signedInAs={address}
              label="Reconnect your wallet to link email"
              className="st-btn"
            />
          ))}
      </div>
      {open && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          eyebrow="Your account"
          title="Link your email"
          description="One account, two ways to sign in."
          closeLabel="Close email linking"
        >
          <EmailSignIn
            linkAddress={address}
            onBack={() => setOpen(false)}
            onDone={() => {
              setOpen(false)
              router.refresh()
            }}
          />
        </Modal>
      )}
    </section>
  )
}
