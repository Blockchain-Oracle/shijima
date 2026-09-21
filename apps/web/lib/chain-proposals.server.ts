/**
 * Chat cards that touch the chain: withdraw, remove the assistant, sell everything, and restart the desk.
 *
 * The website still holds no key. It reads the chain, builds the one transaction the saved proposal describes,
 * and hands it to the browser, where the owner's session key or wallet signs it. Afterwards it reads the
 * receipt from the chain itself before calling the card done: a transaction hash from the browser proves
 * nothing until the chain agrees that it went to this desk, from its owner or its session key, and succeeded.
 */
import { APPROVED_TOKENS, deskAbi, erc20Abi, makePublicClient, quotePinned, USDG } from '@desk/chain'
import { type AskProposalRow, deskById, finishProposal, proposalForOwner, takeProposal } from '@desk/db'
import {
  type Address,
  encodeFunctionData,
  type Hex,
  isHash,
  keccak256,
  type PublicClient,
  toBytes,
} from 'viem'
import { rpcUrl } from './chain'
import { db } from './db'

/** What the owner accepts losing to price movement on a sell they asked for, beyond the quote they saw. */
const OWNER_SELL_SLIPPAGE_BPS = 100n
const DEADLINE_S = 600

export interface PreparedCall {
  deskAddress: Address
  to: Address
  data: Hex
  /** True when every call in it is one the session key may make: the browser may sign with the key. */
  sessionMay: boolean
  /** One line for the owner: what signing this does. */
  summary: string
  contractVersion: string
}

export type Prepared = { ok: true; call: PreparedCall } | { ok: false; why: string }

let client: PublicClient | undefined
const pub = () => {
  client ??= makePublicClient([rpcUrl()])
  return client
}

const encode = (functionName: string, args: readonly unknown[]) =>
  encodeFunctionData({ abi: deskAbi, functionName: functionName as never, args: args as never })

/** Each holding the desk has now, read from the chain. */
async function balances(desk: Address) {
  const reads = await Promise.all(
    [USDG, ...APPROVED_TOKENS.map((t) => t.address)].map(async (token) => ({
      token,
      amount: (await pub().readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [desk],
      })) as bigint,
    })),
  )
  return reads.filter((r) => r.amount > 0n)
}

/** Several calls become one `batch`, so the owner signs once. One call goes as itself. */
function oneTransaction(desk: Address, calls: Hex[]): Hex {
  const [only] = calls
  if (only && calls.length === 1) return only
  return encode('batch', [calls])
}

async function build(proposal: AskProposalRow, desk: Address): Promise<PreparedCall | string> {
  const args = proposal.args
  const version = (await deskById(db(), proposal.deskId ?? ''))?.contractVersion ?? 'v0'
  const base = { deskAddress: desk, to: desk, contractVersion: version }
  switch (proposal.kind) {
    case 'withdraw': {
      if (args.as === 'stocks') {
        const held = await balances(desk)
        if (held.length === 0) return 'The desk holds nothing to withdraw.'
        return {
          ...base,
          data: oneTransaction(
            desk,
            held.map((h) => encode('withdraw', [h.token, h.amount])),
          ),
          sessionMay: true,
          summary: 'Withdraw every holding as it is, to your own wallet.',
        }
      }
      const cash = (await pub().readContract({
        address: USDG,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [desk],
      })) as bigint
      const wanted = typeof args.amountUsdg === 'string' ? BigInt(args.amountUsdg) : cash
      if (wanted === 0n) return 'The desk has no cash to withdraw right now.'
      if (wanted > cash) return `Only $${(Number(cash) / 1e6).toFixed(2)} is in cash right now.`
      return {
        ...base,
        data: encode('withdraw', [USDG, wanted]),
        sessionMay: true,
        summary: `Withdraw $${(Number(wanted) / 1e6).toFixed(2)} of USDG to your own wallet.`,
      }
    }
    case 'remove_assistant':
      return {
        ...base,
        data: encode('revokeOperator', []),
        sessionMay: true,
        summary: 'Remove the assistant. It loses all access at once.',
      }
    case 'unpause':
      return {
        ...base,
        data: encode('unpause', []),
        sessionMay: false,
        summary: 'Restart the desk on-chain.',
      }
    case 'sell_everything': {
      const held = (await balances(desk)).filter((h) => h.token.toLowerCase() !== USDG.toLowerCase())
      if (held.length === 0) return 'The desk holds no Stock Tokens to sell.'
      const block = await pub().getBlock()
      const deadline = Number(block.timestamp) + DEADLINE_S
      const reason = keccak256(toBytes(`shijima:proposal:${proposal.id}`))
      const calls = await Promise.all(
        held.map(async (h) => {
          const token = APPROVED_TOKENS.find((t) => t.address.toLowerCase() === h.token.toLowerCase())
          if (!token) throw new Error(`unknown token ${h.token}`)
          const out = await quotePinned(pub(), token, 'sell', h.amount)
          const minOut = (out * (10_000n - OWNER_SELL_SLIPPAGE_BPS)) / 10_000n
          return encode('sell', [token.address, h.amount, minOut, deadline, reason])
        }),
      )
      return {
        ...base,
        data: oneTransaction(desk, calls),
        sessionMay: false,
        summary: 'Sell every holding to USDG inside the desk, at no worse than 1% under the quote.',
      }
    }
    default:
      return 'That card is not one signed on the chain.'
  }
}

/** Takes the card and builds its transaction. The card cannot be used twice from here on. */
export async function prepareChainProposal(proposalId: string, owner: string): Promise<Prepared> {
  const proposal = await proposalForOwner(db(), proposalId, owner)
  if (!proposal || proposal.path === 'signin' || !proposal.deskId) return { ok: false, why: 'No such card.' }
  const desk = await deskById(db(), proposal.deskId)
  if (!desk || desk.ownerAddress.toLowerCase() !== owner.toLowerCase())
    return { ok: false, why: 'That desk is not yours.' }
  const taken = await takeProposal(db(), { id: proposalId, ownerAddress: owner, path: proposal.path })
  if (!taken) return { ok: false, why: 'This card has expired or was already used. Ask again.' }
  try {
    const built = await build(taken, desk.address as Address)
    if (typeof built === 'string') {
      await finishProposal(db(), taken.id, { status: 'refused', result: { text: built } })
      return { ok: false, why: built }
    }
    return { ok: true, call: built }
  } catch (e) {
    await finishProposal(db(), taken.id, {
      status: 'failed',
      result: { text: 'The transaction could not be built.' },
    })
    return { ok: false, why: e instanceof Error ? e.message : 'The transaction could not be built.' }
  }
}

/**
 * The browser says the transaction landed. The chain decides: it must be to this desk, from its owner or its live
 * session key, and it must have succeeded.
 */
export async function finishChainProposal(proposalId: string, owner: string, txHash: string) {
  if (!isHash(txHash)) return { ok: false as const, text: 'That is not a transaction.' }
  const proposal = await proposalForOwner(db(), proposalId, owner)
  if (!proposal?.deskId || proposal.status !== 'confirmed')
    return { ok: false as const, text: 'No such card.' }
  const desk = await deskById(db(), proposal.deskId)
  if (!desk) return { ok: false as const, text: 'No such desk.' }
  const [receipt, tx] = await Promise.all([
    pub().waitForTransactionReceipt({ hash: txHash, timeout: 60_000 }),
    pub().getTransaction({ hash: txHash }),
  ])
  const from = tx.from.toLowerCase()
  let signer = from === desk.ownerAddress.toLowerCase() ? 'owner' : null
  if (!signer && desk.contractVersion !== 'v0') {
    const session = (await pub().readContract({
      address: desk.address as Address,
      abi: deskAbi,
      functionName: 'session',
      blockNumber: receipt.blockNumber,
    })) as Address
    if (session.toLowerCase() === from) signer = 'session'
  }
  const toDesk = receipt.to?.toLowerCase() === desk.address.toLowerCase()
  if (!signer || !toDesk)
    return { ok: false as const, text: 'That transaction was not this desk’s owner acting on it.' }
  if (receipt.status !== 'success') {
    await finishProposal(db(), proposal.id, {
      status: 'failed',
      result: { text: 'The transaction was refused by the chain. Nothing moved.' },
      txHash,
    })
    return { ok: false as const, text: 'The transaction was refused by the chain. Nothing moved.' }
  }
  const text = 'Done. It is on the chain, and the desk’s record picks it up at its next check.'
  await finishProposal(db(), proposal.id, { status: 'done', result: { text, signer }, txHash })
  return { ok: true as const, text }
}

/** The owner closed their wallet without signing, or the key could not send. The card ends, honestly. */
export async function abandonChainProposal(proposalId: string, owner: string, why: string) {
  const proposal = await proposalForOwner(db(), proposalId, owner)
  if (!proposal || proposal.status !== 'confirmed') return
  await finishProposal(db(), proposal.id, { status: 'refused', result: { text: why.slice(0, 300) } })
}
