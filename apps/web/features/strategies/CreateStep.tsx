'use client'

import { type Mandate, short, studioCopy } from '@desk/shared'
import { useCallback, useEffect, useState } from 'react'
import { type Address, type Hex, parseEther } from 'viem'
import { robinhood } from 'viem/chains'
import { useAccount, useConnect, useSendTransaction, useSwitchChain } from 'wagmi'
import { finishDeskAction, type PreparedDesk, prepareDeskAction } from '@/app/studio-actions'
import { HeaderAccount } from '@/components/shell/HeaderAccount'
import { BridgeIn } from '@/features/desk/BridgeIn'
import { browserClient } from '@/features/session/useDeskSession'
import { Disclosure } from '@/features/settings/Disclosure'
import { cn } from '@/lib/utils'
import { mandateJson } from './draft'

const C = studioCopy.create
/**
 * When the wallet holds less than the estimated fee with room to spare, the order flips: money in first, then
 * create. Without an estimate, about a dollar of ETH is taken as enough; creating a desk cost about $0.30 on
 * mainnet on 20 Sep.
 */
const FALLBACK_NEED = parseEther('0.0003')

export interface Created {
  deskId: string
  slug: string
  address: Address
  txHash: Hex | null
}

type Phase = 'idle' | 'wallet' | 'network' | 'recording'

/**
 * Step 4 (design brief 8.4): read the disclosure once, then one wallet confirmation creates the desk. The desk's
 * row and address exist before the contract does, so an owner with no ETH brings money in first, straight to that
 * address, with about $1 of ETH to their own wallet, and then creates it. Both orders are this one screen.
 */
export function CreateStep({
  name,
  mandate,
  signedIn,
  disclosureOn,
  readRequestId,
  onCreated,
}: {
  name: string
  mandate: Mandate
  signedIn: string | null
  disclosureOn: string | null
  readRequestId: string | null
  onCreated: (c: Created) => void
}) {
  const { address, chainId } = useAccount()
  const { connect, connectors } = useConnect()
  const { switchChainAsync } = useSwitchChain()
  const { sendTransactionAsync } = useSendTransaction()
  const [accepted, setAccepted] = useState(Boolean(disclosureOn))
  const [prepared, setPrepared] = useState<PreparedDesk | null>(null)
  const [eth, setEth] = useState<bigint | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [problem, setProblem] = useState<string | null>(null)
  const rightWallet = Boolean(signedIn && address?.toLowerCase() === signedIn.toLowerCase())

  const finish = useCallback(
    async (deskId: string, desk: Address, txHash: Hex | null) => {
      setPhase('recording')
      const done = await finishDeskAction({ deskId, txHash, mandate: mandateJson(mandate), readRequestId })
      if (done.ok) onCreated({ deskId, slug: done.slug, address: desk, txHash })
      else {
        setProblem(done.why)
        setPhase('idle')
      }
    },
    [mandate, readRequestId, onCreated],
  )

  // Once signed in and the disclosure is read, the server writes the desk's row and builds its one transaction.
  useEffect(() => {
    if (!signedIn || !accepted) return
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
      <div className="space-y-4">
        <p className="strat-choice-body">{C.connect}</p>
        <HeaderAccount signedInAs={undefined} />
      </div>
    )
  }

  if (!accepted) {
    return (
      <div className="space-y-4">
        <p className="strat-choice-body">{C.disclosureFirst}</p>
        <Disclosure acceptedOn={null} onAccepted={() => setAccepted(true)} />
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

  const need = prepared?.ok && prepared.feeWei ? (BigInt(prepared.feeWei) * 3n) / 2n : FALLBACK_NEED
  const noEth = eth !== null && eth < need
  const fee =
    prepared?.ok && prepared.feeUsd !== null
      ? C.feeValue(prepared.feeUsd < 0.01 ? 'under a cent' : `$${prepared.feeUsd.toFixed(2)}`)
      : C.feeUnknown

  return (
    <div className="space-y-5">
      <p className="strat-choice-body">{C.body}</p>
      <dl className="agent-preview-facts">
        <div>
          <dt>{C.address}</dt>
          <dd title={prepared?.ok ? prepared.address : undefined}>
            {prepared?.ok ? short(prepared.address, 6, 4) : '…'}
          </dd>
        </div>
        <div>
          <dt>{C.fee}</dt>
          <dd>{fee}</dd>
        </div>
        <div>
          <dt>{C.confirmations}</dt>
          <dd>{C.confirmationsValue}</dd>
        </div>
      </dl>
      <p className="studio-hint">{C.addressNote}</p>
      <p className="strat-choice-body">{C.starts}</p>

      {noEth && prepared?.ok && (
        <div className="studio-chain-box space-y-3">
          <h4 className="strat-choice-title text-ink">{C.noEth.title}</h4>
          <p className="strat-choice-body">{C.noEth.body}</p>
          <BridgeIn desk={prepared.address} owner={signedIn as Address} />
          <p className="strat-choice-body">{C.noEth.after}</p>
          <button type="button" className="strat-sensei" onClick={checkEth} data-cursor="hover">
            {C.noEth.check}
          </button>
        </div>
      )}

      {!address ? (
        <button
          type="button"
          className="strat-confirm strat-confirm--live"
          onClick={() => connectors[0] && connect({ connector: connectors[0] })}
          data-cursor="hover"
        >
          {C.connectWallet}
        </button>
      ) : !rightWallet ? (
        <p className="type-caption text-warning">{C.wrongWallet}</p>
      ) : (
        <button
          type="button"
          onClick={create}
          disabled={!prepared?.ok || phase !== 'idle' || noEth}
          className={cn(
            'strat-confirm',
            prepared?.ok && phase === 'idle' && !noEth ? 'strat-confirm--live' : 'strat-confirm--dead',
          )}
          data-cursor="hover"
        >
          {phase === 'wallet'
            ? C.wallet
            : phase === 'network'
              ? C.network
              : phase === 'recording'
                ? C.recording
                : chainId !== robinhood.id
                  ? C.wrongNetwork
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
