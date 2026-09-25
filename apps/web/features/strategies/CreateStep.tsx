'use client'

import { USDG } from '@desk/chain'
import { type Mandate, money, short, studioCopy } from '@desk/shared'
import { ArrowRight, Loader2 } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { type Address, encodeFunctionData, erc20Abi, type Hex, parseEther } from 'viem'
import { robinhood } from 'viem/chains'
import { useAccount, useSendTransaction, useSwitchChain } from 'wagmi'
import { finishDeskAction, type PreparedDesk, prepareDeskAction } from '@/app/studio-actions'
import { SignInButton } from '@/components/shell/SignInButton'
import { browserClient } from '@/features/session/useDeskSession'
import { Disclosure } from '@/features/settings/Disclosure'
import { dollarsToUnits, mandateJson } from './draft'

const C = studioCopy.create
const F = studioCopy.flow
/**
 * ETH the wallet must hold to create: the chain's own estimate with a fifth on top, because the gas price moves a
 * little between the estimate and the signature. Without an estimate, 0.00007 ETH: creating cost 1.56M gas at
 * 0.036 gwei (0.000056 ETH) on 25 Sep. A 1.5x margin here once told a wallet holding 0.00008 ETH it had too little.
 */
const FALLBACK_NEED = parseEther('0.00007')

export interface Created {
  deskId: string
  slug: string
  address: Address
  txHash: Hex | null
  /** The USDG put in straight after creation, in dollars, or null when none was sent. */
  fundedUsdg: string | null
}

type Phase = 'idle' | 'wallet' | 'network' | 'recording' | 'funding' | 'arriving'

/**
 * Step 4 (design brief 8.4): read the disclosure once, then one wallet confirmation creates the desk. The desk's
 * row and address exist before the contract does, so an owner with no ETH brings money in first, straight to that
 * address, with about $1 of ETH to their own wallet, and then creates it. Both orders are this one screen.
 */
export function CreateStep({
  amount,
  name,
  mandate,
  signedIn,
  disclosureOn,
  readRequestId,
  onCreated,
}: {
  /** Dollars to put in right after creating, as typed in the money step. '0' creates a practice desk with no money. */
  amount: string
  name: string
  mandate: Mandate
  signedIn: string | null
  disclosureOn: string | null
  readRequestId: string | null
  onCreated: (c: Created) => void
}) {
  const { address, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { sendTransactionAsync } = useSendTransaction()
  const [accepted, setAccepted] = useState(Boolean(disclosureOn))
  const [prepared, setPrepared] = useState<PreparedDesk | null>(null)
  const [eth, setEth] = useState<bigint | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [problem, setProblem] = useState<string | null>(null)
  const rightWallet = Boolean(signedIn && address?.toLowerCase() === signedIn.toLowerCase())

  const units = amount === '0' ? null : dollarsToUnits(amount)

  /**
   * The second confirmation: the chosen USDG from the owner's wallet straight into the new desk. A plain transfer,
   * so it lands in the owner's own account and nowhere else. Refused or failed, the desk still exists and the
   * next screen offers Add money; nothing is lost.
   */
  const fund = useCallback(
    async (desk: Address): Promise<string | null> => {
      if (units === null) return null
      try {
        setPhase('funding')
        const hash = await sendTransactionAsync({
          to: USDG,
          data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [desk, units] }),
          chainId: robinhood.id,
        })
        setPhase('arriving')
        const receipt = await browserClient.waitForTransactionReceipt({ hash, timeout: 180_000 })
        return receipt.status === 'success' ? amount : null
      } catch {
        return null
      }
    },
    [units, amount, sendTransactionAsync],
  )

  // Once this agent exists, the studio clears its draft; that must not prepare a second, orphan agent.
  const created = useRef(false)

  const finish = useCallback(
    async (deskId: string, desk: Address, txHash: Hex | null) => {
      setPhase('recording')
      const done = await finishDeskAction({ deskId, txHash, mandate: mandateJson(mandate), readRequestId })
      if (done.ok) {
        created.current = true
        const fundedUsdg = await fund(desk)
        onCreated({ deskId, slug: done.slug, address: desk, txHash, fundedUsdg })
      } else {
        setProblem(done.why)
        setPhase('idle')
      }
    },
    [mandate, readRequestId, onCreated, fund],
  )

  // Once signed in and the disclosure is read, the server writes the desk's row and builds its one transaction.
  useEffect(() => {
    if (!signedIn || !accepted || created.current) return
    let live = true
    prepareDeskAction({ name, mandate: mandateJson(mandate) }).then((p) => {
      if (!live) return
      setPrepared(p)
      // Signed before, and the tab was closed before it was recorded: record it now, with no second signature.
      if (p.ok && p.exists) void finish(p.deskId, p.address, null)
    })
    return () => {
      live = false
    }
  }, [signedIn, accepted, name, mandate, finish])

  const checkEth = useCallback(async () => {
    if (!signedIn) return
    setEth(await browserClient.getBalance({ address: signedIn as Address }).catch(() => null))
  }, [signedIn])
  useEffect(() => {
    void checkEth()
  }, [checkEth])

  if (!signedIn) {
    return (
      <div className="na-stack">
        <p className="na-note">{C.connect}</p>
        <SignInButton className="na-cta" label={C.connectWallet} />
      </div>
    )
  }

  if (!accepted) {
    return (
      <div className="na-stack">
        <p className="na-note">{C.disclosureFirst}</p>
        <div className="studio-disclosure">
          <Disclosure acceptedOn={null} onAccepted={() => setAccepted(true)} />
        </div>
      </div>
    )
  }

  if (prepared && !prepared.ok) return <p className="agent-form-error">{prepared.why}</p>

  const create = async () => {
    if (!prepared?.ok) return
    setProblem(null)
    try {
      if (chainId !== robinhood.id) await switchChainAsync({ chainId: robinhood.id })
      setPhase('wallet')
      const hash = await sendTransactionAsync({ to: prepared.to, data: prepared.data, chainId: robinhood.id })
      setPhase('network')
      const receipt = await browserClient.waitForTransactionReceipt({ hash, timeout: 180_000 })
      if (receipt.status !== 'success') throw new Error(C.failed)
      await finish(prepared.deskId, prepared.address, hash)
    } catch (e) {
      const message = e instanceof Error ? e.message : ''
      setProblem(/reject|denied|cancel/i.test(message) ? C.cancelled : C.failed)
      setPhase('idle')
    }
  }

  const need = prepared?.ok && prepared.feeWei ? (BigInt(prepared.feeWei) * 6n) / 5n : FALLBACK_NEED
  const noEth = eth !== null && eth < need
  // Dollars per ETH, from the server's own fee estimate, so the wallet's ETH can be shown in dollars too.
  const ethUsd =
    prepared?.ok && prepared.feeUsd !== null && prepared.feeWei && BigInt(prepared.feeWei) > 0n
      ? prepared.feeUsd / (Number(prepared.feeWei) / 1e18)
      : null
  const inUsd = (wei: bigint) =>
    ethUsd === null
      ? `${(Number(wei) / 1e18).toFixed(5)} ETH`
      : `$${((Number(wei) / 1e18) * ethUsd).toFixed(2)}`
  const feeText =
    prepared?.ok && prepared.feeUsd !== null
      ? F.feeValue(prepared.feeUsd < 0.01 ? 'under a cent' : `$${prepared.feeUsd.toFixed(2)}`)
      : C.feeUnknown
  const busy = phase !== 'idle'

  return (
    <div className="na-stack">
      <div className="na-route">
        <div className="na-route-end">
          <span className="na-label">{F.from}</span>
          <b>{short(signedIn, 6, 4)}</b>
        </div>
        <div className="na-route-arrow" aria-hidden="true">
          <span>{units !== null ? money(amount) : F.practiceOn}</span>
          <ArrowRight className="size-4" />
        </div>
        <div className="na-route-end">
          <span className="na-label">{F.to}</span>
          <b title={prepared?.ok ? prepared.address : undefined}>
            {prepared?.ok ? short(prepared.address, 6, 4) : '…'}
          </b>
        </div>
      </div>
      <p className="na-note">{F.toNote}</p>

      <div className="na-fee">
        <div>
          <span className="na-label">{F.fee}</span>
          <span>{feeText}</span>
        </div>
        {eth !== null && (
          <span className={noEth ? 'na-fee-short' : 'na-fee-ok'}>{noEth ? null : F.feeOk(inUsd(eth))}</span>
        )}
      </div>

      {noEth && prepared?.ok && (
        <div className="na-warn na-warn--box">
          <p>{F.feeShort(inUsd(need), inUsd(eth ?? 0n))}</p>
          <div className="na-warn-actions">
            <Link className="st-btn st-btn--sm st-btn--primary" href={'/bridge?dir=gas' as Route}>
              {F.getEth}
            </Link>
            <button type="button" className="st-btn st-btn--sm" onClick={checkEth}>
              {C.noEth.check}
            </button>
          </div>
        </div>
      )}

      <div className="na-signs">
        <span className="na-label">{F.signs}</span>
        <ol>
          <li data-done={phase === 'funding' || phase === 'arriving' ? '' : undefined}>
            <span>1</span>
            {F.signCreate}
          </li>
          {units !== null && (
            <li>
              <span>2</span>
              {F.signFund(money(amount))}
            </li>
          )}
        </ol>
      </div>

      {!address ? (
        <SignInButton className="na-cta" label={C.connectWallet} signedInAs={signedIn ?? undefined} />
      ) : !rightWallet ? (
        <p className="na-warn">{C.wrongWallet}</p>
      ) : (
        <button
          type="button"
          onClick={create}
          disabled={!prepared?.ok || busy || noEth}
          className="na-cta"
          data-cursor="hover"
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {phase === 'wallet'
            ? C.wallet
            : phase === 'network'
              ? C.network
              : phase === 'recording'
                ? C.recording
                : phase === 'funding'
                  ? C.funding(money(amount))
                  : phase === 'arriving'
                    ? C.fundingNetwork
                    : chainId !== robinhood.id
                      ? C.wrongNetwork
                      : units !== null
                        ? C.buttonFunded(money(amount))
                        : C.button}
        </button>
      )}
      {problem && (
        <p className="agent-form-error" role="alert">
          {problem}
        </p>
      )}
    </div>
  )
}
