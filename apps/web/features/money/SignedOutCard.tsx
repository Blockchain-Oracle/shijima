'use client'

import { moneyCopy } from '@desk/shared'
import { AccessCard, CardBody, CardTop, NetworkPill } from '@/components/kit'
import { ShijimaMark } from '@/components/shell/ShijimaMark'
import { SignInButton } from '@/components/shell/SignInButton'

/**
 * The reference wallet's access card (AccessPanels.tsx:8-124), with Connect wallet in place of the vault password:
 * shown wherever a page needs your wallet and you have not signed in yet.
 */
export function SignedOutCard() {
  const c = moneyCopy.signedOut
  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: '48px 16px' }}>
      <AccessCard>
        <CardTop
          left={
            <span className="kit-brand-tile logo-mark" style={{ width: 24, height: 24, borderRadius: 7 }}>
              <ShijimaMark />
            </span>
          }
          title={c.title}
          right={<NetworkPill />}
        />
        <CardBody>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14,
              textAlign: 'center',
            }}
          >
            <span className="kit-brand-tile logo-mark" style={{ width: 56, height: 56, borderRadius: 16 }}>
              <ShijimaMark />
            </span>
            <div>
              <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.02em' }}>{c.welcome}</div>
              <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 7, lineHeight: 1.5 }}>{c.body}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <SignInButton />
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', lineHeight: 1.5, textAlign: 'center' }}>
            {c.note}
          </div>
        </CardBody>
      </AccessCard>
    </div>
  )
}
