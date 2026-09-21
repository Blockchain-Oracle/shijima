'use client'

import { deskAbi } from '@desk/chain'
import { sessionCopy, until } from '@desk/shared'
import { useState } from 'react'
import { type Address, encodeFunctionData, parseEther } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { useAccount, useSendTransaction, useWriteContract } from 'wagmi'
import { Button } from '@/components/ui/button'
import { forgetSessionKey, saveSessionKey } from './store'
import { browserClient, type DeskSession, sendWithSessionKey } from './useDeskSession'

/** What the key gets for its own fees. A few cents on this network, enough for many actions. */
const GAS_TOP_UP = '0.0001'
const DAY_CHOICES = [1, 3, 7] as const

/**
 * The desk's session key, as Masayume's `SessionModal` and `SessionManager` give it: what the signature grants
 * and can never do, then one grant from the owner's wallet. The key is made in this browser and never leaves it.
 */
export function SessionPanel({
  owner,
  desk,
  session,
}: {
  owner: string
  desk: Address
  session: DeskSession
}) {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const { sendTransactionAsync } = useSendTransaction()
  const [days, setDays] = useState<(typeof DAY_CHOICES)[number]>(7)
  const [busy, setBusy] = useState<'give' | 'revoke' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const rightWallet = address?.toLowerCase() === owner.toLowerCase()

  if (session.status === 'loading') return null
  if (session.status === 'unsupported') {
    return (
      <section className="desk-panel">
        <h2 className="type-label-micro text-ink-muted">{sessionCopy.title}</h2>
        <p className="type-caption text-ink-secondary">{sessionCopy.unsupported}</p>
      </section>
    )
  }

  const give = async () => {
    setBusy('give')
    setProblem(null)
    try {
      const privateKey = generatePrivateKey()
      const key = {
        address: privateKeyToAccount(privateKey).address,
        privateKey,
        desk,
        createdAtMs: Date.now(),
      }
      // Kept before the grant, so a closed tab after signing never leaves a granted key nobody holds.
      if (!(await saveSessionKey(owner, key))) throw new Error('This browser cannot keep a key.')
      const block = await browserClient.getBlock()
      const expiresAt = Number(block.timestamp) + days * 86_400 - 60
      const grant = await writeContractAsync({
        address: desk,
        abi: deskAbi,
        functionName: 'grantSession',
        args: [key.address, expiresAt],
      })
      await browserClient.waitForTransactionReceipt({ hash: grant })
      const fund = await sendTransactionAsync({ to: key.address, value: parseEther(GAS_TOP_UP) })
      await browserClient.waitForTransactionReceipt({ hash: fund })
      await session.refresh()
    } catch (e) {
      setProblem(
        e instanceof Error && /reject|denied/i.test(e.message) ? sessionCopy.cancelled : sessionCopy.failed,
      )
    } finally {
      setBusy(null)
    }
  }

  const revoke = async () => {
    setBusy('revoke')
    setProblem(null)
    try {
      if (session.key && session.status === 'live') {
        // The key may end its own powers, paying from its own fees, so no wallet pop-up is needed.
        await sendWithSessionKey(
          session.key,
          desk,
          encodeFunctionData({ abi: deskAbi, functionName: 'revokeSession', args: [] }),
        )
      } else {
        const hash = await writeContractAsync({
          address: desk,
          abi: deskAbi,
          functionName: 'revokeSession',
          args: [],
        })
        await browserClient.waitForTransactionReceipt({ hash })
      }
      await forgetSessionKey(owner, desk)
      await session.refresh()
    } catch {
      setProblem(sessionCopy.failed)
    } finally {
      setBusy(null)
    }
  }

  const r = sessionCopy.receipt
  return (
    <section className="desk-panel">
      <h2 className="type-label-micro text-ink-muted">{sessionCopy.title}</h2>
      {session.status === 'live' && session.expiresAt ? (
        <>
          <p className="type-body text-ink">{sessionCopy.live(until(new Date(session.expiresAt * 1000)))}</p>
          <Button size="sm" variant="secondary" onClick={revoke} disabled={busy !== null}>
            {busy === 'revoke' ? sessionCopy.revoking : sessionCopy.revoke}
          </Button>
        </>
      ) : (
        <>
          <p className="type-caption text-ink-secondary">
            {session.status === 'expired'
              ? sessionCopy.expired
              : session.status === 'elsewhere'
                ? sessionCopy.elsewhere
                : sessionCopy.none}
          </p>
          <dl className="desk-receipt">
            <dt>{r.can}</dt>
            <dd>{r.canValue}</dd>
            <dt>{r.cannot}</dt>
            <dd>{r.cannotValue}</dd>
            <dt>{sessionCopy.lasts}</dt>
            <dd className="flex gap-2">
              {DAY_CHOICES.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`desk-chip ${days === n ? 'active' : ''}`}
                  onClick={() => setDays(n)}
                >
                  {sessionCopy.days(n)}
                </button>
              ))}
            </dd>
            <dt>{r.gas}</dt>
            <dd>{r.gasValue(GAS_TOP_UP)}</dd>
            <dt>{r.signatures}</dt>
            <dd>{r.signaturesValue}</dd>
          </dl>
          {rightWallet ? (
            <Button size="sm" onClick={give} disabled={busy !== null}>
              {busy === 'give' ? sessionCopy.giving : sessionCopy.give}
            </Button>
          ) : (
            <p className="type-caption text-warning">{sessionCopy.wrongWallet}</p>
          )}
        </>
      )}
      {problem && <p className="text-loss type-caption">{problem}</p>}
    </section>
  )
}
