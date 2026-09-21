'use client'

import { APPROVED_TOKENS, deskFactoryAbi } from '@desk/chain'
import { short } from '@desk/shared'
import { useState, useTransition } from 'react'
import { type Address, zeroHash } from 'viem'
import { robinhood } from 'viem/chains'
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { type ActionResult, registerDeskAction } from '@/app/actions'

/**
 * One wallet confirmation makes the desk. The owner is always whoever sends it, set by the contract itself,
 * so a desk can never be created belonging to someone else.
 *
 * The approved token list and the assistant's address are put in at creation. Conservative limits come with
 * it and the owner can change them later, from their own wallet.
 */
export function CreateDesk({ factory, operator }: { factory: Address; operator: Address }) {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const pub = usePublicClient()
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ActionResult>()

  const wrongNetwork = isConnected && chainId !== robinhood.id

  const create = async () => {
    if (!address || !pub) return
    setBusy(true)
    setResult(undefined)
    try {
      const predicted = await pub.readContract({
        address: factory,
        abi: deskFactoryAbi,
        functionName: 'predictDesk',
        args: [address, zeroHash],
      })
      const hash = await writeContractAsync({
        address: factory,
        abi: deskFactoryAbi,
        functionName: 'createDesk',
        args: [
          {
            operator,
            // Conservative to start with. Changing these later is the owner's own transaction.
            perActionCapUsdg: 5_000_000n,
            dailyCapUsdg: 15_000_000n,
            tokens: APPROVED_TOKENS.map((t) => t.address),
            fees: APPROVED_TOKENS.map((t) => t.pinnedFee),
            feeds: APPROVED_TOKENS.map((t) => t.feed),
          },
          zeroHash,
        ],
      })
      const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 })
      if (receipt.status !== 'success') throw new Error('The transaction did not go through.')
      const data = new FormData()
      data.set('address', predicted)
      start(async () => setResult(await registerDeskAction(data)))
    } catch (e) {
      const message = e instanceof Error ? (e.message.split('\n')[0] ?? '') : 'Something went wrong.'
      setResult({ ok: false, message: message.includes('User rejected') ? 'You cancelled it.' : message })
    } finally {
      setBusy(false)
    }
  }

  if (result?.ok) {
    return (
      <div className="space-y-2 rounded-lg border border-acted p-4">
        <p className="text-acted">{result.message}</p>
        <p className="text-ink-soft text-sm">Reload this page to set what you want held.</p>
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="font-medium">Make the account</h2>
      <p className="text-ink-soft text-sm leading-relaxed">
        One confirmation in your wallet, and a network fee of a fraction of a cent. It creates an account that
        belongs to you, with the assistant ({short(operator)}) allowed to trade inside it and never to
        withdraw.
      </p>
      {wrongNetwork ? (
        <button
          type="button"
          onClick={() => switchChain({ chainId: robinhood.id })}
          className="rounded-md border border-blocked px-3 py-1.5 font-medium text-blocked text-sm"
        >
          Switch your wallet to Robinhood Chain
        </button>
      ) : (
        <button
          type="button"
          disabled={!isConnected || busy || pending}
          onClick={create}
          className="rounded-md border border-accent px-3 py-1.5 font-medium text-accent text-sm hover:bg-accent hover:text-surface disabled:opacity-50"
        >
          {busy ? 'Check your wallet…' : pending ? 'Recording it…' : 'Create my desk'}
        </button>
      )}
      {result && !result.ok ? <p className="text-blocked text-sm">{result.message}</p> : null}
    </section>
  )
}
