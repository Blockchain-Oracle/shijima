/**
 * The one transaction each chain card describes, built from the chain as it is now.
 *
 * The saved proposal says what the owner asked for ("withdraw $20", "close the desk, selling to cash"). This file
 * reads the desk's balances, limits and assistant from the chain and turns that into exact calls, with the lines
 * the owner reads before signing: what they get, and what it costs. Nothing here signs or sends.
 */
import {
  APPROVED_TOKENS,
  deskAbi,
  ETH_USD_FEED,
  erc20Abi,
  fetchVaultRate,
  makePublicClient,
  quotePinned,
  readDeskState,
  readFeed,
  gapBps as tokenGapBps,
  USDG,
  VAULT,
  vaultAbi,
} from '@desk/chain'
import type { AskProposalRow } from '@desk/db'
import { type Address, encodeFunctionData, formatUnits, type Hex, keccak256, maxUint256, toBytes } from 'viem'
import { rpcUrl } from './chain'

/** What the owner accepts losing to price movement on a sale they asked for, beyond the quote they saw. */
const OWNER_SELL_SLIPPAGE_BPS = 100n
const DEADLINE_S = 600

export interface Built {
  to: Address
  data: Hex
  /** True when every call in it is one the desk's session key may make. */
  sessionMay: boolean
  /** One line: what signing this does. */
  summary: string
  /** What the owner gets and what it costs, read before signing. */
  lines: string[]
}

export interface DeskForBuild {
  address: Address
  owner: Address
  /** The assistant this desk expects, restored when the owner brings it back. */
  operator: Address
  contractVersion: string
}

let client: ReturnType<typeof makePublicClient> | undefined
export const pub = () => {
  client ??= makePublicClient([rpcUrl()])
  return client
}

const encode = (functionName: string, args: readonly unknown[]) =>
  encodeFunctionData({ abi: deskAbi, functionName: functionName as never, args: args as never })
const dollars = (raw: bigint) =>
  `$${Number(formatUnits(raw, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const tokenOf = (address: string) =>
  APPROVED_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())

/** Several calls become one `batch`, so the owner signs once. One call goes as itself. */
function oneTransaction(calls: Hex[]): Hex {
  const [only] = calls
  return only && calls.length === 1 ? only : encode('batch', [calls])
}

/**
 * "All of it". A v1 desk takes the maximum as "the whole balance at that moment", which is what makes sell-then-
 * withdraw fit one signature. A v0 desk needs the exact amount, so the amount known now is sent instead.
 */
const all = (desk: DeskForBuild, known: bigint) => (desk.contractVersion === 'v0' ? known : maxUint256)

/** Every Stock Token the desk holds, sold to USDG inside the desk at no worse than 1% under a fresh quote. */
async function sellEverything(holdings: Record<string, bigint>, reason: Hex) {
  const block = await pub().getBlock()
  const deadline = Number(block.timestamp) + DEADLINE_S
  const sales = await Promise.all(
    Object.entries(holdings).map(async ([address, amount]) => {
      const token = tokenOf(address)
      if (!token) throw new Error(`the desk holds a token that is not on the list: ${address}`)
      const [out, feed] = await Promise.all([
        quotePinned(pub(), token, 'sell', amount),
        readFeed(pub(), token.feed).catch(() => null),
      ])
      const minOut = (out * (10_000n - OWNER_SELL_SLIPPAGE_BPS)) / 10_000n
      const gap = feed && feed.price > 0n && out > 0n ? tokenGapBps(out, amount, feed.price) : null
      const versus =
        gap === null
          ? ''
          : Math.abs(gap) < 5
            ? ', in line with the price feed'
            : `, ${(Math.abs(gap) / 100).toFixed(1)}% ${gap < 0 ? 'below' : 'above'} the price feed`
      return {
        call: encode('sell', [token.address, amount, minOut, deadline, reason]),
        minOut,
        line: `${token.displayName} sells for about ${dollars(out)}${versus}`,
      }
    }),
  )
  return {
    calls: sales.map((s) => s.call),
    lines: sales.map((s) => s.line),
    minOut: sales.reduce((sum, s) => sum + s.minOut, 0n),
  }
}

/**
 * What the savings vault can pay out right now, from Morpho's API. Most of it is lent out, so a redeem beyond this
 * reverts. undefined when the API cannot be read: the fee simulation then says whether the chain would refuse.
 */
async function vaultPayable(): Promise<bigint | undefined> {
  return (await fetchVaultRate(1))?.liquidityUsdg
}

/** The desk's savings-vault shares back to USDG inside the desk. Only the owner's wallet may redeem. */
async function redeemAll(shares: bigint, reason: Hex) {
  const [block, assets] = await Promise.all([
    pub().getBlock(),
    pub().readContract({ address: VAULT, abi: vaultAbi, functionName: 'convertToAssets', args: [shares] }),
  ])
  return {
    call: encode('redeemFromVault', [shares, Number(block.timestamp) + DEADLINE_S, reason]),
    assets,
    line: `${dollars(assets)} comes back from the savings vault`,
  }
}

export async function build(proposal: AskProposalRow, desk: DeskForBuild): Promise<Built | string> {
  const args = proposal.args
  const state = await readDeskState(pub(), desk.address)
  // Recorded with each sale and vault move, so the desk's record can tie them to this card.
  const reason = keccak256(toBytes(`shijima:proposal:${proposal.id}`))
  const toOwner = `to your own wallet, ${short(desk.owner)}. It cannot go anywhere else.`
  const base = { to: desk.address }

  switch (proposal.kind) {
    case 'withdraw': {
      if (args.as === 'stocks') {
        const calls: Hex[] = []
        const lines: string[] = []
        if (state.usdg > 0n) {
          calls.push(encode('withdraw', [USDG, all(desk, state.usdg)]))
          lines.push(`${dollars(state.usdg)} of USDG`)
        }
        for (const [address, amount] of Object.entries(state.holdings)) {
          calls.push(encode('withdraw', [address, all(desk, amount)]))
          lines.push(`${tokenOf(address)?.displayName ?? address}, as it is`)
        }
        if (state.vaultShares > 0n) {
          calls.push(encode('withdraw', [VAULT, all(desk, state.vaultShares)]))
          lines.push('Your savings-vault shares, which you can redeem yourself at any time')
        }
        if (calls.length === 0) return 'The desk holds nothing to withdraw.'
        return {
          ...base,
          data: oneTransaction(calls),
          sessionMay: true,
          summary: `Withdraw everything as it is, ${toOwner}`,
          lines,
        }
      }
      const wanted = typeof args.amountUsdg === 'string' ? BigInt(args.amountUsdg) : null
      if (wanted === null) {
        // Everything, as cash: sell the holdings and empty the vault inside the desk, then send it all home.
        const sold =
          Object.keys(state.holdings).length > 0
            ? await sellEverything(state.holdings, reason)
            : { calls: [], lines: [], minOut: 0n }
        const redeemed = state.vaultShares > 0n ? await redeemAll(state.vaultShares, reason) : null
        const payable = redeemed ? await vaultPayable() : undefined
        if (redeemed && payable !== undefined && payable < redeemed.assets)
          return `The savings vault can pay out only ${dollars(payable)} right now, less than the ${dollars(redeemed.assets)} the desk has in it. Withdraw everything as it is instead: the vault shares come to your wallet and you can redeem them yourself later.`
        const cashAfter = state.usdg + sold.minOut + (redeemed?.assets ?? 0n)
        if (cashAfter === 0n) return 'The desk holds nothing to withdraw.'
        const calls = [
          ...sold.calls,
          ...(redeemed ? [redeemed.call] : []),
          encode('withdraw', [USDG, all(desk, cashAfter)]),
        ]
        return {
          ...base,
          data: oneTransaction(calls),
          sessionMay: sold.calls.length === 0 && !redeemed,
          summary: `Withdraw everything as USDG, ${toOwner}`,
          lines: [
            ...(state.usdg > 0n ? [`${dollars(state.usdg)} in cash`] : []),
            ...sold.lines,
            ...(redeemed ? [redeemed.line] : []),
            `You receive at least ${dollars(cashAfter)}`,
          ],
        }
      }
      if (wanted <= state.usdg) {
        return {
          ...base,
          data: encode('withdraw', [USDG, wanted]),
          sessionMay: true,
          summary: `Withdraw ${dollars(wanted)} of USDG, ${toOwner}`,
          lines: [`${dollars(wanted)} of USDG, from ${dollars(state.usdg)} in cash`],
        }
      }
      // More than the loose cash: the rest comes out of the savings vault first.
      const short_ = wanted - state.usdg
      if (state.vaultShares === 0n)
        return `The desk has ${dollars(state.usdg)} in cash. Withdraw that, or withdraw everything to sell the holdings first.`
      const shares = await pub().readContract({
        address: VAULT,
        abi: vaultAbi,
        functionName: 'previewWithdraw',
        args: [short_],
      })
      if (shares > state.vaultShares)
        return `The desk has ${dollars(state.usdg)} in cash and less than that in the savings vault. Withdraw everything to sell the holdings first.`
      const payable = await vaultPayable()
      if (payable !== undefined && payable < short_)
        return `The savings vault can pay out only ${dollars(payable)} right now, less than the ${dollars(short_)} this needs from it. You can withdraw ${dollars(state.usdg + payable)} now, and the rest once the vault has the cash.`
      const block = await pub().getBlock()
      return {
        ...base,
        data: oneTransaction([
          encode('redeemFromVault', [shares, Number(block.timestamp) + DEADLINE_S, reason]),
          encode('withdraw', [USDG, wanted]),
        ]),
        sessionMay: false,
        summary: `Withdraw ${dollars(wanted)} of USDG, ${toOwner}`,
        lines: [`${dollars(state.usdg)} in cash`, `${dollars(short_)} from the savings vault`],
      }
    }

    case 'sell_everything': {
      if (Object.keys(state.holdings).length === 0) return 'The desk holds no Stock Tokens to sell.'
      const sold = await sellEverything(state.holdings, reason)
      return {
        ...base,
        data: oneTransaction(sold.calls),
        sessionMay: false,
        summary: 'Sell every holding to USDG inside the desk, at no worse than 1% under the quote.',
        lines: [...sold.lines, `At least ${dollars(state.usdg + sold.minOut)} in cash afterwards`],
      }
    }

    case 'remove_assistant':
      if (state.operator === '0x0000000000000000000000000000000000000000')
        return 'The assistant is already removed.'
      return {
        ...base,
        data: encode('revokeOperator', []),
        sessionMay: true,
        summary: 'Remove the assistant. It loses all access at once.',
        lines: ['The desk stops on-chain. Your money stays in your account.'],
      }

    case 'unpause': {
      const removed = state.operator === '0x0000000000000000000000000000000000000000'
      if (!removed && !state.paused) return 'The desk is already running on-chain.'
      const calls = [...(removed ? [encode('setOperator', [desk.operator])] : []), encode('unpause', [])]
      return {
        ...base,
        data: oneTransaction(calls),
        sessionMay: false,
        summary: removed ? 'Bring the assistant back and restart the desk.' : 'Restart the desk on-chain.',
        lines: removed
          ? [`The assistant, ${short(desk.operator)}, can act again inside your limits`]
          : ['The assistant can act again inside your limits'],
      }
    }

    case 'set_chain_limits': {
      const perAction =
        typeof args.perActionCapUsdg === 'string' ? BigInt(args.perActionCapUsdg) : state.perActionCapUsdg
      const daily = typeof args.dailyCapUsdg === 'string' ? BigInt(args.dailyCapUsdg) : state.dailyCapUsdg
      if (perAction > daily) return 'The most per action cannot be more than the most per day.'
      if (perAction === state.perActionCapUsdg && daily === state.dailyCapUsdg)
        return 'Those are already the limits on the chain.'
      const lowering = perAction <= state.perActionCapUsdg && daily <= state.dailyCapUsdg
      return {
        ...base,
        data: encode('setLimits', [perAction, daily]),
        sessionMay: lowering,
        summary: lowering
          ? 'Lower the limits your account holds the assistant to.'
          : 'Change the limits on the chain.',
        lines: [
          `Most per action: ${dollars(state.perActionCapUsdg)} → ${dollars(perAction)}`,
          `Most per day: ${dollars(state.dailyCapUsdg)} → ${dollars(daily)}`,
        ],
      }
    }

    case 'add_money': {
      const amount = BigInt(String(args.amountUsdg))
      const [balance, eth] = await Promise.all([
        pub().readContract({ address: USDG, abi: erc20Abi, functionName: 'balanceOf', args: [desk.owner] }),
        pub().getBalance({ address: desk.owner }),
      ])
      if (balance < amount)
        return `Your wallet holds ${dollars(balance)} of USDG on Robinhood Chain, less than that. Bring more from another network first.`
      if (eth === 0n)
        return 'Your wallet has no ETH on Robinhood Chain for the network fee. Bring money from another network: it sends a little ETH with it.'
      return {
        to: USDG,
        data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [desk.address, amount] }),
        sessionMay: false,
        summary: `Move ${dollars(amount)} of USDG from your wallet into the desk.`,
        lines: [
          `${dollars(amount)} from ${dollars(balance)} in your wallet`,
          `Into the desk, ${short(desk.address)}`,
        ],
      }
    }

    case 'close_desk': {
      const asCash = args.as !== 'stocks'
      const calls: Hex[] = []
      const lines: string[] = []
      let sessionMay = true
      if (asCash) {
        let cashAfter = state.usdg
        if (Object.keys(state.holdings).length > 0) {
          const sold = await sellEverything(state.holdings, reason)
          calls.push(...sold.calls)
          lines.push(...sold.lines)
          cashAfter += sold.minOut
          sessionMay = false
        }
        if (state.vaultShares > 0n) {
          const redeemed = await redeemAll(state.vaultShares, reason)
          calls.push(redeemed.call)
          lines.push(redeemed.line)
          cashAfter += redeemed.assets
          sessionMay = false
        }
        if (cashAfter > 0n) {
          calls.push(encode('withdraw', [USDG, all(desk, cashAfter)]))
          lines.push(`At least ${dollars(cashAfter)} goes to your own wallet as USDG`)
        }
      } else {
        if (state.usdg > 0n) calls.push(encode('withdraw', [USDG, all(desk, state.usdg)]))
        for (const [address, amount] of Object.entries(state.holdings)) {
          calls.push(encode('withdraw', [address, all(desk, amount)]))
          lines.push(`${tokenOf(address)?.displayName ?? address} goes to your wallet as it is`)
        }
        if (state.vaultShares > 0n) calls.push(encode('withdraw', [VAULT, all(desk, state.vaultShares)]))
        lines.push('Your cash goes to your wallet as USDG')
      }
      if (state.operator !== '0x0000000000000000000000000000000000000000') {
        calls.push(encode('revokeOperator', []))
        lines.push('The assistant is removed, and checks stop')
      }
      return {
        ...base,
        data: oneTransaction(calls),
        sessionMay,
        summary: `Close the desk: everything goes ${toOwner}`,
        lines,
      }
    }

    default:
      return 'That card is not one signed on the chain.'
  }
}

/** Where the transaction goes: the desk itself, except adding money, which is a USDG transfer from the owner. */
export const targetOf = (kind: string, desk: Address): Address => (kind === 'add_money' ? USDG : desk)

/**
 * The network fee in dollars, from a simulation on the chain. A simulation that fails means the chain would
 * refuse the transaction now, and the owner is told before they sign rather than after.
 */
export async function estimateFee(
  from: Address,
  built: Built,
): Promise<{ ok: true; usd: number; wei: bigint } | { ok: false; why: string }> {
  try {
    const [gas, price, ethUsd] = await Promise.all([
      pub().estimateGas({ account: from, to: built.to, data: built.data }),
      pub().getGasPrice(),
      readFeed(pub(), ETH_USD_FEED),
    ])
    const wei = gas * price
    return { ok: true, usd: (Number(wei) / 1e18) * (Number(ethUsd.price) / 1e8), wei }
  } catch (e) {
    const name = (e as { cause?: { data?: { errorName?: string } } }).cause?.data?.errorName
    return {
      ok: false,
      why: `The chain would refuse this right now${name ? ` (${name})` : ''}. Nothing was sent.`,
    }
  }
}
