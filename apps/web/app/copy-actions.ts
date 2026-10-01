'use server'

import { USDG } from '@desk/chain'
import {
  CopyLinkError,
  currentMandate,
  deskById,
  deskIdBySlug,
  followersOf,
  leaderOf,
  MAX_COPY_FEE_USDG,
  mandateFromRow,
  ownsDesk,
  pauseCopying,
  resumeCopying,
  setCopyable,
  startCopying,
  stopCopying,
} from '@desk/db'
import { appCopy, errorText } from '@desk/shared'
import { revalidatePath } from 'next/cache'
import { type Address, createPublicClient, decodeEventLog, erc20Abi, type Hex, http } from 'viem'
import { rpcUrl } from '@/lib/chain'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

/**
 * Copy trading from the website (PLAN-ROUND-3 D4, D5, D10). The website signs nothing: the follower's own wallet
 * creates their agent, funds it and pays the fee. These actions only read, check what the chain says happened,
 * and record the link. A fee is counted only when its transfer is on chain, from the follower's wallet, to the
 * right address, for the right amount.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const c = appCopy.copy

const pub = () => createPublicClient({ transport: http(rpcUrl()) })

/** Shijima's share of a copy fee: 20%. What is left goes to the agent's creator. */
const PLATFORM_BPS = 2_000n

const treasury = (): Address | null => {
  const a = process.env.TREASURY_ADDRESS
  return a && /^0x[0-9a-fA-F]{40}$/.test(a) ? (a as Address) : null
}

async function resolveId(ref: string): Promise<string | undefined> {
  return UUID.test(ref) ? ref : deskIdBySlug(db(), ref)
}

export interface CopyQuote {
  ok: true
  leaderId: string
  leaderSlug: string
  name: string
  /** The leader's owner: where the creator's share of the fee goes. */
  creator: Address
  treasury: Address | null
  /** Raw USDG (6 decimals), as strings: the whole fee and its two parts. */
  feeUsdg: string
  creatorUsdg: string
  platformUsdg: string
  presetId: string | null
  /** The leader's mix, by token address, for the studio to start from. */
  targets: { token: string; weightBps: number }[]
  cashBps: number
  mine: boolean
}

export type CopyQuoteResult = CopyQuote | { ok: false; why: string }

/** What copying this agent costs and starts from. A refusal says why, so the button never just goes grey. */
export async function copyQuoteAction(leaderRef: string): Promise<CopyQuoteResult> {
  const id = await resolveId(leaderRef)
  const leader = id ? await deskById(db(), id) : undefined
  if (!leader) return { ok: false, why: c.refused.missing }
  if (leader.lifecycle === 'closed') return { ok: false, why: c.refused.closed }
  if (!leader.copyable) return { ok: false, why: c.refused.notCopyable }
  const mandateRow = await currentMandate(db(), leader.id)
  if (!mandateRow) return { ok: false, why: c.refused.noStrategy }
  const mandate = mandateFromRow(mandateRow)
  const viewer = await signedInAddress().catch(() => undefined)
  const fee = leader.copyFeeUsdg
  const t = treasury()
  const platform = t ? (fee * PLATFORM_BPS) / 10_000n : 0n
  return {
    ok: true,
    leaderId: leader.id,
    leaderSlug: leader.shareSlug ?? leader.id,
    name: leader.name ?? 'Agent',
    creator: leader.ownerAddress as Address,
    treasury: t,
    feeUsdg: fee.toString(),
    creatorUsdg: (fee - platform).toString(),
    platformUsdg: platform.toString(),
    presetId: mandate.preset ?? null,
    targets: mandate.targets.tokens.map((x) => ({ token: x.token, weightBps: x.weightBps })),
    cashBps: mandate.targets.cashBps,
    mine: viewer !== undefined && viewer.toLowerCase() === leader.ownerAddress.toLowerCase(),
  }
}

/** True when this transaction moved exactly `amount` USDG from `from` to `to`, and the chain says it succeeded. */
async function paid(hash: string | undefined, from: string, to: string, amount: bigint): Promise<boolean> {
  if (amount === 0n) return true
  if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) return false
  const receipt = await pub()
    .getTransactionReceipt({ hash: hash as Hex })
    .catch(() => null)
  if (!receipt || receipt.status !== 'success') return false
  return receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== USDG.toLowerCase()) return false
    try {
      const e = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics })
      return (
        e.eventName === 'Transfer' &&
        e.args.from.toLowerCase() === from.toLowerCase() &&
        e.args.to.toLowerCase() === to.toLowerCase() &&
        e.args.value === amount
      )
    } catch {
      return false
    }
  })
}

/**
 * Links the owner's new agent to the leader, after checking the fee on chain. The follower's own agent must
 * already exist and be the signed-in owner's. Starting twice is refused by the link itself.
 */
export async function startCopyAction(input: {
  followerDeskId: string
  leaderRef: string
  creatorFeeTx?: string
  platformFeeTx?: string
}): Promise<{ ok: true; slug: string } | { ok: false; why: string }> {
  try {
    const owner = await signedInAddress()
    if (!owner) return { ok: false, why: c.refused.signIn }
    if (!(await ownsDesk(db(), input.followerDeskId, owner))) return { ok: false, why: c.refused.notYours }
    const quote = await copyQuoteAction(input.leaderRef)
    if (!quote.ok) return quote
    if (quote.mine) return { ok: false, why: c.refused.own }
    const [creatorOk, platformOk] = await Promise.all([
      paid(input.creatorFeeTx, owner, quote.creator, BigInt(quote.creatorUsdg)),
      quote.treasury ? paid(input.platformFeeTx, owner, quote.treasury, BigInt(quote.platformUsdg)) : true,
    ])
    if (!creatorOk || !platformOk) return { ok: false, why: c.refused.feeNotSeen }
    await startCopying(db(), {
      followerDeskId: input.followerDeskId,
      leaderDeskId: quote.leaderId,
      ...(input.creatorFeeTx ? { creatorFeeTx: input.creatorFeeTx } : {}),
      ...(input.platformFeeTx ? { platformFeeTx: input.platformFeeTx } : {}),
      by: { actor: 'owner', via: 'web' },
    })
    const follower = await deskById(db(), input.followerDeskId)
    revalidatePath('/agents')
    return { ok: true, slug: follower?.shareSlug ?? input.followerDeskId }
  } catch (e) {
    if (e instanceof CopyLinkError) return { ok: false, why: e.message }
    console.error(`[copy] start: ${errorText(e)}`)
    return { ok: false, why: c.refused.failed }
  }
}

/** Pause, resume or stop copying, for the follower's own owner. Stopping keeps what the agent holds. */
export async function copyControlAction(
  followerDeskId: string,
  what: 'pause' | 'resume' | 'stop',
): Promise<{ ok: boolean; why?: string }> {
  const owner = await signedInAddress()
  if (!owner || !(await ownsDesk(db(), followerDeskId, owner))) return { ok: false, why: c.refused.notYours }
  if (what === 'pause') await pauseCopying(db(), followerDeskId)
  else if (what === 'resume') await resumeCopying(db(), followerDeskId)
  else await stopCopying(db(), followerDeskId, { actor: 'owner', via: 'web' })
  revalidatePath(`/agents/${followerDeskId}`)
  return { ok: true }
}

/** The creator's switch: let others copy this agent, for a one-time fee of $0 to $5. */
export async function setCopyableAction(
  deskId: string,
  copyable: boolean,
  feeDollars: number,
): Promise<{ ok: boolean; why?: string }> {
  const owner = await signedInAddress()
  if (!owner || !(await ownsDesk(db(), deskId, owner))) return { ok: false, why: c.refused.notYours }
  if (!Number.isFinite(feeDollars) || feeDollars < 0) return { ok: false, why: c.refused.feeRange }
  const fee = BigInt(Math.round(feeDollars * 1_000_000))
  if (fee > MAX_COPY_FEE_USDG) return { ok: false, why: c.refused.feeRange }
  try {
    await setCopyable(db(), deskId, { copyable, feeUsdg: fee })
    return { ok: true }
  } catch (e) {
    return { ok: false, why: e instanceof CopyLinkError ? e.message : c.refused.failed }
  }
}

/** Who copies this agent, for its owner's settings: each follower's agent name and since when. */
export async function followersAction(deskId: string) {
  const owner = await signedInAddress()
  if (!owner || !(await ownsDesk(db(), deskId, owner))) return []
  return (await followersOf(db(), deskId)).map((f) => ({
    name: f.name ?? 'Agent',
    status: f.link.status,
    feeUsdg: f.link.feeUsdg.toString(),
    since: f.link.createdAt.toISOString(),
  }))
}

/** Which agent this one copies, if any, for its header. */
export async function leaderOfAction(followerDeskId: string) {
  const row = await leaderOf(db(), followerDeskId)
  if (!row) return null
  return { name: row.name ?? 'Agent', slug: row.shareSlug ?? row.link.leaderDeskId, status: row.link.status }
}
