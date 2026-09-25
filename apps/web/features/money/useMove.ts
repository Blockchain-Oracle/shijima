'use client'

import { moneyCopy } from '@desk/shared'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'
import { type Address, erc20Abi } from 'viem'
import { robinhood } from 'viem/chains'
import { useAccount, useSendTransaction, useSwitchChain } from 'wagmi'
import { readContract, waitForTransactionReceipt } from 'wagmi/actions'
import { finishMoveAction, planMoveAction, stepSentAction } from '@/app/money-actions'
import type { MoveInput, MoveOutcome, MovePlan, PlanResult } from '@/lib/money/types'
import { config } from '@/lib/wagmi'

/**
 * Runs one money move in the browser. No styling: a screen calls `plan`, shows `state.plan.lines`, then `run`.
 *
 *   plan(input)  asks the server for the exact steps, what lands, the minimum and the cost
 *   run()        signs each step in the owner's wallet, in order:
 *                  - switches network only when a step is on another chain, and back to Robinhood Chain after
 *                  - reads the allowance before an approval and skips it when it already covers the amount
 *                  - reports each hash to the server the moment it exists, then waits for its receipt
 *                  - a plan older than 60 seconds is priced again first, and the owner reviews the fresh one
 *   The server reads the chain (and Relay) and returns one of five endings: done, nothing sent, approval given
 *   and nothing moved, on its way, may have been sent. On its way is checked again every few seconds.
 */
export type MovePhase = 'idle' | 'planning' | 'ready' | 'running' | 'finished'

export interface MoveState {
  phase: MovePhase
  plan: MovePlan | null
  /** Why there is no plan, or why the last attempt stopped before signing. */
  problem: string | null
  /** A pointer the server gave with a refusal: "use Add money for your own agent", "pick where gas comes from". */
  hint: Extract<PlanResult, { ok: false }>['hint'] | null
  /** While running: which step, of how many, and what it does. */
  step: { index: number; of: number; label: string } | null
  outcome: MoveOutcome | null
}

const IDLE: MoveState = { phase: 'idle', plan: null, problem: null, hint: null, step: null, outcome: null }
const RECEIPT_TIMEOUT_MS = 180_000
/** How long to wait before the one retry of a step the wallet would not send. */
const RETRY_AFTER_MS = 3_000
const POLL_MS = 3_000
const POLL_FOR_MS = 180_000

const rejected = (e: unknown) => e instanceof Error && /reject|denied|cancel/i.test(e.message)

export function useMove(options: { owner?: string } = {}) {
  const router = useRouter()
  const { address, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { sendTransactionAsync } = useSendTransaction()
  const [state, setState] = useState<MoveState>(IDLE)
  const input = useRef<MoveInput | null>(null)

  /** True when a wallet is connected and it is the signed-in owner's. */
  const walletReady = !!address && (!options.owner || address.toLowerCase() === options.owner.toLowerCase())

  const plan = useCallback(async (next: MoveInput, replaces?: string) => {
    input.current = next
    setState({ ...IDLE, phase: 'planning' })
    // A failed request is not the chain refusing: say what happened. The usual cause is a page loaded before the
    // site was updated, whose request the new server no longer recognises; a reload fixes it.
    const result = await planMoveAction(next, replaces).catch(
      (e: unknown): PlanResult => ({
        ok: false,
        why: moneyCopy.refusals.unreachable(e instanceof Error ? (e.message.split('\n')[0] ?? '') : ''),
      }),
    )
    if (result.ok) setState({ ...IDLE, phase: 'ready', plan: result.plan })
    else setState({ ...IDLE, phase: 'idle', problem: result.why, hint: result.hint ?? null })
    return result
  }, [])

  const reset = useCallback(() => {
    input.current = null
    setState(IDLE)
  }, [])

  /** Keeps asking while Relay has not delivered, up to three minutes. The move stays traceable after that. */
  const follow = useCallback(async (first: MoveOutcome) => {
    let outcome = first
    const until = Date.now() + POLL_FOR_MS
    while (outcome.open && outcome.ending === 'on_its_way' && Date.now() < until) {
      await new Promise((r) => setTimeout(r, POLL_MS))
      const again = await finishMoveAction(outcome.moveId).catch(() => null)
      if (!again) break
      outcome = again
      setState((s) => ({ ...s, outcome }))
    }
    return outcome
  }, [])

  const run = useCallback(async (): Promise<MoveOutcome | null> => {
    const current = state.plan
    if (!current || !input.current) return null
    // A price older than 60 seconds is not signed: a fresh one is fetched and the owner reads it first.
    if (Date.now() > new Date(current.expiresAt).getTime()) {
      const fresh = await plan(input.current, current.moveId)
      if (fresh.ok) setState((s) => ({ ...s, problem: moneyCopy.refusals.expired }))
      return null
    }
    setState((s) => ({ ...s, phase: 'running', problem: null }))
    const home = robinhood.id
    let switched = false
    let note: string | undefined
    try {
      for (const [index, step] of current.steps.entries()) {
        // Every step of a plan is on the chain the money starts on. Anything else is refused, not signed.
        if (step.chainId !== current.fromChainId) {
          note = 'a step was on an unplanned chain'
          break
        }
        setState((s) => ({ ...s, step: { index, of: current.steps.length, label: step.label } }))
        if (chainId !== step.chainId && !switched) {
          await switchChainAsync({ chainId: step.chainId as never })
          switched = step.chainId !== home
        }
        if (step.approve && address) {
          const allowance = await readContract(config, {
            address: step.approve.token,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [address, step.approve.spender as Address],
            chainId: step.chainId as never,
          }).catch(() => 0n)
          if (allowance >= BigInt(step.approve.amountRaw)) continue
        }
        const tx = {
          to: step.to,
          data: step.data,
          value: BigInt(step.value),
          chainId: step.chainId as never,
          ...(step.gas ? { gas: BigInt(step.gas) } : {}),
        }
        // Right after an approval the wallet's node can be a block behind and refuse the next step. Once, after a
        // pause, is enough; a person saying no is never retried.
        const hash = await sendTransactionAsync(tx).catch(async (e: unknown) => {
          if (rejected(e) || index === 0) throw e
          await new Promise((r) => setTimeout(r, RETRY_AFTER_MS))
          return sendTransactionAsync(tx)
        })
        // Kept before waiting, so a closed tab or a slow chain never loses where the money went.
        await stepSentAction(current.moveId, hash).catch(() => undefined)
        const receipt = await waitForTransactionReceipt(config, {
          hash,
          chainId: step.chainId as never,
          timeout: RECEIPT_TIMEOUT_MS,
        }).catch(() => null)
        if (!receipt) break
        if (receipt.status !== 'success') break
      }
    } catch (e) {
      note = rejected(e)
        ? 'the owner said no in the wallet'
        : `the wallet could not send it: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`
    } finally {
      if (switched) await switchChainAsync({ chainId: home }).catch(() => undefined)
    }
    const outcome = await finishMoveAction(current.moveId, note).catch(() => null)
    const final: MoveOutcome = outcome ?? {
      moveId: current.moveId,
      ending: 'may_have_been_sent',
      text: moneyCopy.endings.may_have_been_sent,
      links: [],
      relayUrl: null,
      open: true,
    }
    setState((s) => ({ ...s, phase: 'finished', step: null, outcome: final }))
    const settled = await follow(final)
    router.refresh()
    return settled
  }, [state.plan, plan, chainId, address, switchChainAsync, sendTransactionAsync, follow, router])

  return { state, plan, run, reset, walletReady }
}
