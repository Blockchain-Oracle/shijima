/**
 * Chat cards that touch the chain: add money, withdraw, sell everything, the limits on the chain, remove the
 * assistant, restart the desk, and close it.
 *
 * The website still holds no key. It reads the chain, builds the one transaction the saved proposal describes,
 * and hands it to the browser, where the owner's session key or wallet signs it. Before that it shows what the
 * owner gets and what it costs, from a simulation on the chain. Afterwards it reads the receipt from the chain
 * itself before calling the card done: a transaction hash from the browser proves nothing until the chain agrees
 * that it went where the card said, from its owner or its session key, and succeeded.
 */
import { CHAIN_ID, deskAbi, erc20Abi, priceStocksNow, USDG, VAULT, vaultAssetsOf } from '@desk/chain'
import {
  type AskProposalRow,
  closeDesk,
  createMoneyMove,
  deskById,
  finishProposal,
  markAssistantBack,
  markAssistantRemoved,
  ownerIdOf,
  proposalForOwner,
  takeProposal,
} from '@desk/db'
import { type Address, type Hex, isHash, parseEventLogs, type TransactionReceipt } from 'viem'
import { type Built, build, type DeskForBuild, estimateFee, pub, targetOf } from './chain-build.server'
import { db } from './db'

export interface PreparedCall {
  to: Address
  data: Hex
  /** True when every call in it is one the session key may make: the browser may sign with the key. */
  sessionMay: boolean
  summary: string
}

export type Prepared = { ok: true; call: PreparedCall } | { ok: false; why: string }

export interface Preview {
  summary: string
  lines: string[]
  sessionMay: boolean
  /** The network fee in dollars, from a simulation. */
  feeUsd: number
}

async function ownersCard(proposalId: string, owner: string) {
  const proposal = await proposalForOwner(db(), proposalId, owner)
  if (!proposal || proposal.path === 'signin' || !proposal.deskId) return undefined
  const desk = await deskById(db(), proposal.deskId)
  if (!desk || desk.ownerAddress.toLowerCase() !== owner.toLowerCase()) return undefined
  const forBuild: DeskForBuild = {
    address: desk.address as Address,
    owner: desk.ownerAddress as Address,
    operator: desk.operator as Address,
    contractVersion: desk.contractVersion,
  }
  return { proposal, desk, forBuild }
}

/**
 * What confirming would do, and what it costs, before anything is signed. Reads only: the card stays open, so
 * an owner who looks and walks away has used nothing.
 */
export async function previewChainProposal(
  proposalId: string,
  owner: string,
): Promise<{ ok: true; preview: Preview } | { ok: false; why: string }> {
  const found = await ownersCard(proposalId, owner)
  if (!found) return { ok: false, why: 'No such card.' }
  if (found.proposal.status !== 'open' || found.proposal.expiresAt < new Date())
    return { ok: false, why: 'This card has expired or was already used. Ask again.' }
  const built = await build(found.proposal, found.forBuild)
  if (typeof built === 'string') return { ok: false, why: built }
  const fee = await estimateFee(owner as Address, built)
  if (!fee.ok) return { ok: false, why: fee.why }
  return {
    ok: true,
    preview: { summary: built.summary, lines: built.lines, sessionMay: built.sessionMay, feeUsd: fee.usd },
  }
}

/** Takes the card and builds its transaction afresh. The card cannot be used twice from here on. */
export async function prepareChainProposal(proposalId: string, owner: string): Promise<Prepared> {
  const found = await ownersCard(proposalId, owner)
  if (!found) return { ok: false, why: 'No such card.' }
  const taken = await takeProposal(db(), { id: proposalId, ownerAddress: owner, path: found.proposal.path })
  if (!taken) return { ok: false, why: 'This card has expired or was already used. Ask again.' }
  let built: Built | string
  try {
    built = await build(taken, found.forBuild)
  } catch (e) {
    await finishProposal(db(), taken.id, {
      status: 'failed',
      result: { text: 'The transaction could not be built.' },
    })
    return { ok: false, why: e instanceof Error ? e.message : 'The transaction could not be built.' }
  }
  if (typeof built === 'string') {
    await finishProposal(db(), taken.id, { status: 'refused', result: { text: built } })
    return { ok: false, why: built }
  }
  return {
    ok: true,
    call: { to: built.to, data: built.data, sessionMay: built.sessionMay, summary: built.summary },
  }
}

/** Who confirmed it, for the desk's own event log: a button on the page, or a card from the chat. */
const byOf = (proposal: AskProposalRow) =>
  ({ actor: 'owner', via: proposal.deskView.source === 'button' ? 'web' : 'chat' }) as const

/**
 * The browser says the transaction landed. The chain decides: it must be to where the card said, from the owner
 * or the desk's live session key, and it must have succeeded. Then the desk's own state follows the chain.
 */
export async function finishChainProposal(proposalId: string, owner: string, txHash: string) {
  if (!isHash(txHash)) return { ok: false as const, text: 'That is not a transaction.' }
  const proposal = await proposalForOwner(db(), proposalId, owner)
  if (!proposal?.deskId || proposal.status !== 'confirmed')
    return { ok: false as const, text: 'No such card.' }
  const desk = await deskById(db(), proposal.deskId)
  if (!desk) return { ok: false as const, text: 'No such agent.' }
  const [receipt, tx] = await Promise.all([
    pub().waitForTransactionReceipt({ hash: txHash, timeout: 60_000 }),
    pub().getTransaction({ hash: txHash }),
  ])
  const deskAddress = desk.address as Address
  const from = tx.from.toLowerCase()
  let signer = from === desk.ownerAddress.toLowerCase() ? 'owner' : null
  if (!signer && desk.contractVersion !== 'v0' && proposal.kind !== 'add_money') {
    const session = (await pub().readContract({
      address: deskAddress,
      abi: deskAbi,
      functionName: 'session',
      blockNumber: receipt.blockNumber,
    })) as Address
    if (session.toLowerCase() === from) signer = 'session'
  }
  const target = targetOf(proposal.kind, deskAddress).toLowerCase()
  if (!signer || receipt.to?.toLowerCase() !== target)
    return { ok: false as const, text: 'That transaction was not this agent’s owner acting on it.' }
  if (receipt.status !== 'success') {
    const text = 'The transaction was refused by the chain. Nothing moved.'
    await finishProposal(db(), proposal.id, { status: 'failed', result: { text }, txHash })
    return { ok: false as const, text }
  }
  if (proposal.kind === 'add_money') {
    // The transfer itself must be from the owner to this desk, for the amount on the card.
    const moved = parseEventLogs({ abi: erc20Abi, logs: receipt.logs, eventName: 'Transfer' }).some(
      (l) =>
        l.address.toLowerCase() === USDG.toLowerCase() &&
        l.args.from.toLowerCase() === desk.ownerAddress.toLowerCase() &&
        l.args.to.toLowerCase() === deskAddress.toLowerCase() &&
        l.args.value === BigInt(String(proposal.args.amountUsdg)),
    )
    if (!moved)
      return {
        ok: false as const,
        text: 'That transaction did not move this money into the agent’s account.',
      }
  }

  // Money in or out, and a sale, are money moves too: Activity lists them, and reconcile ties the change it finds
  // at the next check to this row, so the charts net it out and the record says who moved it.
  if (proposal.kind === 'withdraw' || proposal.kind === 'sell_some' || proposal.kind === 'add_money') {
    await recordChainMove(proposal, desk, receipt, txHash).catch((e) =>
      console.error('money move not recorded', proposal.id, e instanceof Error ? e.message : e),
    )
  }

  const by = byOf(proposal)
  let text = 'Done. It is on the chain, and the agent’s record picks it up at its next check.'
  if (proposal.kind === 'remove_assistant') {
    await markAssistantRemoved(db(), desk.id, by, txHash)
    text = 'Done. The assistant has no access now, and your money stays in your account.'
  } else if (proposal.kind === 'unpause') {
    const [operator, paused] = await Promise.all([
      pub().readContract({ address: deskAddress, abi: deskAbi, functionName: 'operator' }),
      pub().readContract({ address: deskAddress, abi: deskAbi, functionName: 'paused' }),
    ])
    if (!paused && (operator as string).toLowerCase() === desk.operator.toLowerCase()) {
      await markAssistantBack(db(), desk.id, by, txHash)
      text = 'Done. The agent is running again, and carries on from its next check.'
    }
  } else if (proposal.kind === 'close_desk') {
    await closeDesk(db(), desk.id, by, txHash)
    text =
      'Done. Everything went to your wallet, the assistant is removed and the checks have stopped. The record stays readable.'
  } else if (proposal.kind === 'add_money') {
    text = 'Done. The money is in the agent’s account. It is valued and put to work at the next check.'
  }
  await finishProposal(db(), proposal.id, { status: 'done', result: { text, signer }, txHash })
  return { ok: true as const, text }
}

/**
 * A confirmed withdraw, sale or deposit card, as a done money move. Its dollars come from the receipt itself:
 * USDG counts as it is, a Stock Token at what selling it now would give, vault shares at what they redeem for.
 */
async function recordChainMove(
  proposal: AskProposalRow,
  desk: NonNullable<Awaited<ReturnType<typeof deskById>>>,
  receipt: TransactionReceipt,
  txHash: string,
) {
  const deskAddress = desk.address.toLowerCase()
  const owner = desk.ownerAddress.toLowerCase()
  const transfers = parseEventLogs({ abi: erc20Abi, logs: receipt.logs, eventName: 'Transfer' })
  const kind =
    proposal.kind === 'add_money' ? 'fund' : proposal.kind === 'sell_some' ? 'sell_some' : 'withdraw'
  // Out of the agent to the owner, into it from the owner, or (a sale) USDG arriving from the pool.
  const moved = transfers.filter((l) =>
    kind === 'withdraw'
      ? l.args.from.toLowerCase() === deskAddress && l.args.to.toLowerCase() === owner
      : kind === 'fund'
        ? l.args.from.toLowerCase() === owner && l.args.to.toLowerCase() === deskAddress
        : l.args.to.toLowerCase() === deskAddress && l.address.toLowerCase() === USDG.toLowerCase(),
  )
  if (moved.length === 0) return
  const amounts: Record<string, bigint> = {}
  for (const l of moved)
    amounts[l.address.toLowerCase()] = (amounts[l.address.toLowerCase()] ?? 0n) + l.args.value
  const usdg = amounts[USDG.toLowerCase()] ?? 0n
  const shares = amounts[VAULT.toLowerCase()] ?? 0n
  const stocks = Object.fromEntries(
    Object.entries(amounts).filter(([a]) => a !== USDG.toLowerCase() && a !== VAULT.toLowerCase()),
  )
  const [prices, savings] = await Promise.all([
    priceStocksNow(pub(), stocks),
    shares > 0n ? vaultAssetsOf(pub(), shares) : Promise.resolve(0n),
  ])
  const worth = usdg + savings + Object.values(prices).reduce<bigint>((s, v) => s + (v ?? 0n), 0n)
  const [main = USDG.toLowerCase(), mainAmount = 0n] =
    usdg > 0n ? [USDG.toLowerCase(), usdg] : (Object.entries(amounts)[0] ?? [])
  const ownerId = await ownerIdOf(db(), owner)
  if (!ownerId) return
  await createMoneyMove(db(), {
    ownerId,
    deskId: desk.id,
    kind,
    status: 'done',
    fromChainId: CHAIN_ID,
    toChainId: CHAIN_ID,
    tokenIn: main,
    amountIn: mainAmount,
    tokenOut: main,
    amountOutQuoted: mainAmount,
    usdgValue: worth,
    feeUsdg: null,
    recipient: kind === 'withdraw' ? owner : deskAddress,
    steps: [
      {
        chainId: CHAIN_ID,
        to: receipt.to?.toLowerCase() ?? deskAddress,
        kind: 'transfer',
        label: proposal.kind,
      },
    ],
    txHashes: [txHash.toLowerCase()],
  })
}

/** The owner closed their wallet without signing, or the key could not send. The card ends, honestly. */
export async function abandonChainProposal(proposalId: string, owner: string, why: string) {
  const proposal = await proposalForOwner(db(), proposalId, owner)
  if (proposal?.status !== 'confirmed') return
  await finishProposal(db(), proposal.id, { status: 'refused', result: { text: why.slice(0, 300) } })
}
