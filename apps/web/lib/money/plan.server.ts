/**
 * Planning a money move: the exact transactions, what lands, the minimum, and the cost, read from the chain as it
 * is now. Nothing here signs or sends: the web app holds no key. The browser signs each step in the owner's own
 * wallet, and `finish.server.ts` reads the chain before calling anything done.
 *
 * The rules every plan keeps:
 *   - approvals are for the exact amount, never unlimited;
 *   - 1% under a fresh quote is the least that may land, or the swap reverts and nothing moves;
 *   - a plan lives 60 seconds, then the browser asks again;
 *   - an agent never receives ETH (it has no way to take it): everything reaches it as USDG or a Stock Token;
 *   - decimals come from the token list or from Relay, never a guess;
 *   - money into an agent is at least $1 of USDG out.
 */
import {
  APPROVED_TOKENS,
  CHAIN_ID,
  deadlineIn,
  ETH_USD_FEED,
  erc20Abi,
  erc20ApproveAbi,
  NATIVE,
  quotePinned,
  quoterV2Abi,
  ROUTER_ADDRESS_THIS,
  readFeed,
  readTokenConfig,
  swapRouter02Abi,
  tokenByAddress,
  UNISWAP_V3,
  USDG,
  USDG_DECIMALS,
  VAULT,
  WETH_USDG_FEE,
  WETH9,
} from '@desk/chain'
import { createMoneyMove, deskById, desksOfOwner, moneyMoveForOwner, settleMoneyMove } from '@desk/db'
import { moneyCopy, usd } from '@desk/shared'
import { type Address, encodeFunctionData, formatUnits, getAddress, type Hex, isAddress } from 'viem'
import { pub } from '../chain-build.server'
import { db } from '../db'
import { relayQuote, relayToken } from './relay.server'
import type { MoveInput, MoveKind, MovePlan, MoveStep, PlanResult } from './types'

const c = moneyCopy
/** Money into an agent, or out across a bridge: at least $1 of USDG. */
export const MIN_USDG = 1_000_000n
const SLIPPAGE_BPS = 100n
const PLAN_TTL_MS = 60_000
const DEADLINE_S = 600
/** Gas for a step that cannot be simulated yet, because it needs the approval before it to have landed. */
const UNSIMULATED_GAS = 250_000n

const minusSlippage = (amount: bigint) => (amount * (10_000n - SLIPPAGE_BPS)) / 10_000n
const amountText = (raw: bigint, decimals: number, symbol: string) => {
  const n = Number(formatUnits(raw, decimals))
  const shown =
    n === 0 ? '0' : n < 0.0001 ? n.toPrecision(2) : n.toLocaleString('en-US', { maximumFractionDigits: 6 })
  return `${shown} ${symbol}`
}
const isNative = (token: string) => token.toLowerCase() === NATIVE.toLowerCase()
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** A plan before it is saved: what the move row records and what the browser is handed. */
interface Draft {
  kind: MoveKind
  deskId: string | null
  fromChainId: number
  toChainId: number
  tokenIn: Address
  amountIn: bigint
  tokenOut: Address
  recipient: Address
  steps: MoveStep[]
  lines: string[]
  send: MovePlan['send']
  receive: { symbol: string; amountRaw: bigint; decimals: number; minimumRaw: bigint }
  usdgValue: bigint
  feeUsdg: bigint
  relayRequestId: string | null
  timeEstimate: number | null
}

type Built = Draft | { why: string; hint?: Extract<PlanResult, { ok: false }>['hint'] }

// ---------------------------------------------------------------- reading the chain

async function ethUsdE8(): Promise<bigint> {
  return (await readFeed(pub(), ETH_USD_FEED)).price
}

const ethToUsdg = (wei: bigint, priceE8: bigint) => (wei * priceE8) / 10n ** 20n

async function balanceOf(token: Address, owner: Address): Promise<bigint> {
  if (isNative(token)) return pub().getBalance({ address: owner })
  return pub().readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [owner] })
}

/** An exact-input quote on one pool, or null when the pool refuses it. */
async function quote(tokenIn: Address, tokenOut: Address, fee: number, amountIn: bigint) {
  try {
    const [out] = await pub().readContract({
      address: UNISWAP_V3.quoterV2,
      abi: quoterV2Abi,
      functionName: 'quoteExactInputSingle',
      args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
    })
    return out
  } catch {
    return null
  }
}

/**
 * The network fee for the Robinhood Chain steps, in USDG, from a simulation of each. The first step must simulate:
 * if the chain would refuse it now, the owner is told before signing. A step after an approval cannot be
 * simulated until that approval lands, so it is priced at a fixed allowance instead.
 */
async function feeOf(owner: Address, steps: MoveStep[]): Promise<{ usdg: bigint } | { why: string }> {
  const [price, eth] = await Promise.all([pub().getGasPrice(), ethUsdE8()])
  let gas = 0n
  for (const [i, s] of steps.entries()) {
    const afterApproval = steps.slice(0, i).some((p) => p.kind === 'approve')
    try {
      gas += await pub().estimateGas({ account: owner, to: s.to, data: s.data, value: BigInt(s.value) })
    } catch {
      if (!afterApproval) return { why: c.refusals.refusedByChain }
      gas += UNSIMULATED_GAS
    }
  }
  return { usdg: ethToUsdg(gas * price, eth) }
}

const approveStep = (
  token: Address,
  spender: Address,
  amount: bigint,
  symbol: string,
  decimals: number,
): MoveStep => ({
  chainId: CHAIN_ID,
  to: token,
  data: encodeFunctionData({ abi: erc20ApproveAbi, functionName: 'approve', args: [spender, amount] }),
  value: '0',
  kind: 'approve',
  label: c.steps.approve(symbol, amountText(amount, decimals, symbol)),
  approve: { token, spender, amountRaw: amount.toString() },
})

/** One swap on SwapRouter02, wrapped in a multicall with a deadline, plus any calls that must follow it. */
async function routerCall(swap: {
  tokenIn: Address
  tokenOut: Address
  fee: number
  recipient: Address
  amountIn: bigint
  minOut: bigint
  after?: Hex[]
}): Promise<Hex> {
  const deadline = BigInt(await deadlineIn(pub(), DEADLINE_S))
  const exact = encodeFunctionData({
    abi: swapRouter02Abi,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: swap.tokenIn,
        tokenOut: swap.tokenOut,
        fee: swap.fee,
        recipient: swap.recipient,
        amountIn: swap.amountIn,
        amountOutMinimum: swap.minOut,
        sqrtPriceLimitX96: 0n,
      },
    ],
  })
  return encodeFunctionData({
    abi: swapRouter02Abi,
    functionName: 'multicall',
    args: [deadline, [exact, ...(swap.after ?? [])]],
  })
}

/** Checks the owner can pay for the Robinhood Chain side at all: without ETH no transaction there can be sent. */
async function needsGas(owner: Address): Promise<string | null> {
  return (await pub().getBalance({ address: owner })) === 0n ? c.refusals.noGas : null
}

// ---------------------------------------------------------------- the moves

/** Into an agent, from USDG, ETH or a Stock Token on Robinhood Chain, or any Relay token on another chain. */
async function planFund(owner: Address, input: Extract<MoveInput, { kind: 'fund' }>): Promise<Built> {
  const desk = await deskById(db(), input.deskId)
  if (!desk || !same(desk.ownerAddress, owner) || desk.lifecycle === 'closed')
    return { why: c.refusals.notYourAgent }
  const agent = getAddress(desk.address)
  const amount = BigInt(input.source.amountRaw)
  if (amount <= 0n) return { why: c.refusals.amount }
  const token = input.source.token

  if (input.source.chainId !== CHAIN_ID) return planBridgeIn(owner, desk.id, agent, input.source)

  const base = {
    kind: 'fund' as const,
    deskId: desk.id,
    fromChainId: CHAIN_ID,
    toChainId: CHAIN_ID,
    recipient: agent,
  }
  const gasProblem = await needsGas(owner)
  if (gasProblem) return { why: gasProblem }

  // USDG: a plain transfer.
  if (same(token, USDG)) {
    if (amount < MIN_USDG) return { why: c.refusals.minimum }
    const held = await balanceOf(USDG, owner)
    if (held < amount) return { why: c.refusals.notEnough(usd(held)) }
    const steps: MoveStep[] = [
      {
        chainId: CHAIN_ID,
        to: USDG,
        data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [agent, amount] }),
        value: '0',
        kind: 'transfer',
        label: c.steps.transferIn(usd(amount)),
      },
    ]
    return {
      ...base,
      tokenIn: USDG,
      amountIn: amount,
      tokenOut: USDG,
      steps,
      lines: [c.lines.youSend(usd(amount)), c.lines.agentGets(usd(amount))],
      send: { symbol: 'USDG', amountRaw: amount.toString(), decimals: USDG_DECIMALS },
      receive: { symbol: 'USDG', amountRaw: amount, decimals: USDG_DECIMALS, minimumRaw: amount },
      usdgValue: amount,
      feeUsdg: 0n,
      relayRequestId: null,
      timeEstimate: null,
    }
  }

  // ETH: one router multicall wraps it, swaps it on the deep 0.01% WETH/USDG pool straight into the agent, and
  // hands back whatever the swap did not use. The agent only ever receives USDG.
  if (isNative(token)) {
    const held = await balanceOf(NATIVE, owner)
    if (held < amount) return { why: c.refusals.notEnough(amountText(held, 18, 'ETH')) }
    const out = await quote(WETH9, USDG, WETH_USDG_FEE, amount)
    if (out === null) return { why: c.refusals.quote('the WETH/USDG pool gave no price') }
    if (out < MIN_USDG) return { why: c.refusals.minimum }
    const minOut = minusSlippage(out)
    const data = await routerCall({
      tokenIn: WETH9,
      tokenOut: USDG,
      fee: WETH_USDG_FEE,
      recipient: agent,
      amountIn: amount,
      minOut,
      after: [encodeFunctionData({ abi: swapRouter02Abi, functionName: 'refundETH' })],
    })
    const steps: MoveStep[] = [
      {
        chainId: CHAIN_ID,
        to: getAddress(UNISWAP_V3.swapRouter02),
        data,
        value: amount.toString(),
        kind: 'swap',
        label: c.steps.swapIn(amountText(amount, 18, 'ETH'), 'USDG'),
      },
    ]
    return {
      ...base,
      tokenIn: NATIVE,
      amountIn: amount,
      tokenOut: USDG,
      steps,
      lines: [
        c.lines.youSend(amountText(amount, 18, 'ETH')),
        c.lines.agentGets(usd(out)),
        c.lines.atLeast(usd(minOut)),
        c.lines.quoteFresh,
      ],
      send: { symbol: 'ETH', amountRaw: amount.toString(), decimals: 18 },
      receive: { symbol: 'USDG', amountRaw: out, decimals: USDG_DECIMALS, minimumRaw: minOut },
      usdgValue: out,
      feeUsdg: 0n,
      relayRequestId: null,
      timeEstimate: null,
    }
  }

  // A Stock Token: as it is when this agent trades it, otherwise sold to USDG on its own pool on the way in. A
  // token outside the agent's list would sit there unpriced, which the agent's checks cannot value.
  const stock = tokenByAddress(token)
  if (!stock) return { why: c.refusals.unknownToken }
  const held = await balanceOf(stock.address, owner)
  if (held < amount) return { why: c.refusals.notEnough(amountText(held, stock.decimals, stock.symbol)) }
  const [worth, cfg] = await Promise.all([
    quotePinned(pub(), stock, 'sell', amount).catch(() => null),
    readTokenConfig(pub(), agent, stock.address),
  ])
  if (worth === null) return { why: c.refusals.quote(`the ${stock.symbol} pool gave no price`) }
  if (worth < MIN_USDG) return { why: c.refusals.minimum }
  const sent = amountText(amount, stock.decimals, stock.symbol)
  if (cfg.enabled) {
    return {
      ...base,
      tokenIn: stock.address,
      amountIn: amount,
      tokenOut: stock.address,
      steps: [
        {
          chainId: CHAIN_ID,
          to: stock.address,
          data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [agent, amount] }),
          value: '0',
          kind: 'transfer',
          label: c.steps.transferIn(sent),
        },
      ],
      lines: [c.lines.youSend(sent), c.lines.agentGetsAsIs(usd(worth))],
      send: { symbol: stock.symbol, amountRaw: amount.toString(), decimals: stock.decimals },
      receive: { symbol: stock.symbol, amountRaw: amount, decimals: stock.decimals, minimumRaw: amount },
      usdgValue: worth,
      feeUsdg: 0n,
      relayRequestId: null,
      timeEstimate: null,
    }
  }
  const minOut = minusSlippage(worth)
  const router = getAddress(UNISWAP_V3.swapRouter02)
  return {
    ...base,
    tokenIn: stock.address,
    amountIn: amount,
    tokenOut: USDG,
    steps: [
      approveStep(stock.address, router, amount, stock.symbol, stock.decimals),
      {
        chainId: CHAIN_ID,
        to: router,
        data: await routerCall({
          tokenIn: stock.address,
          tokenOut: USDG,
          fee: stock.pinnedFee,
          recipient: agent,
          amountIn: amount,
          minOut,
        }),
        value: '0',
        kind: 'swap',
        label: c.steps.swapIn(sent, 'USDG'),
      },
    ],
    lines: [
      c.lines.youSend(sent),
      c.lines.agentGets(usd(worth)),
      c.lines.atLeast(usd(minOut)),
      c.lines.quoteFresh,
    ],
    send: { symbol: stock.symbol, amountRaw: amount.toString(), decimals: stock.decimals },
    receive: { symbol: 'USDG', amountRaw: worth, decimals: USDG_DECIMALS, minimumRaw: minOut },
    usdgValue: worth,
    feeUsdg: 0n,
    relayRequestId: null,
    timeEstimate: null,
  }
}

/** Into an agent from another chain, through Relay, arriving as USDG. Never ETH: the agent could not take it. */
async function planBridgeIn(
  owner: Address,
  deskId: string,
  agent: Address,
  source: { chainId: number; token: Address; amountRaw: string },
): Promise<Built> {
  const origin = await relayToken(source.chainId, source.token)
  if (!origin) return { why: c.refusals.unknownChain }
  let q: Awaited<ReturnType<typeof relayQuote>>
  try {
    q = await relayQuote({
      user: owner,
      recipient: agent,
      originChainId: source.chainId,
      destinationChainId: CHAIN_ID,
      originCurrency: origin.address,
      destinationCurrency: USDG,
      amountRaw: BigInt(source.amountRaw),
    })
  } catch (e) {
    return { why: c.refusals.quote(e instanceof Error ? e.message : 'Relay did not answer') }
  }
  if (q.amountOut < MIN_USDG) return { why: c.refusals.minimum }
  const sent = amountText(q.amountIn, origin.decimals, origin.symbol)
  const fee = BigInt(Math.round(q.feeUsd * 1e6))
  return {
    kind: 'bridge_in',
    deskId,
    fromChainId: source.chainId,
    toChainId: CHAIN_ID,
    tokenIn: origin.address,
    amountIn: q.amountIn,
    tokenOut: USDG,
    recipient: agent,
    steps: q.steps.map((s) => ({ ...s, label: c.steps.relay(s.label) })),
    lines: [
      c.lines.youSend(sent),
      c.lines.agentGets(usd(q.amountOut)),
      c.lines.atLeast(usd(q.minimumOut)),
      c.lines.cost(usd(fee)),
      c.lines.takes(q.timeEstimate ?? 30),
    ],
    send: { symbol: origin.symbol, amountRaw: q.amountIn.toString(), decimals: origin.decimals },
    receive: { symbol: 'USDG', amountRaw: q.amountOut, decimals: USDG_DECIMALS, minimumRaw: q.minimumOut },
    usdgValue: q.amountOut,
    feeUsdg: fee,
    relayRequestId: q.requestId,
    timeEstimate: q.timeEstimate,
  }
}

/** Every contract whose address is a token, not a wallet. Money sent to one of these is gone. */
const TOKEN_CONTRACTS = new Set(
  [USDG, WETH9, VAULT, UNISWAP_V3.swapRouter02, ...APPROVED_TOKENS.map((t) => t.address)].map((a) =>
    a.toLowerCase(),
  ),
)

/** Is this address a token contract? The known list first, then: it has code and answers `decimals()`. */
async function isTokenContract(address: Address): Promise<boolean> {
  if (TOKEN_CONTRACTS.has(address.toLowerCase())) return true
  const code = await pub().getCode({ address })
  if (!code || code === '0x') return false
  return pub()
    .readContract({ address, abi: erc20Abi, functionName: 'decimals' })
    .then(() => true)
    .catch(() => false)
}

/** From the owner's wallet on Robinhood Chain to any wallet: USDG, ETH or a Stock Token. */
async function planSend(owner: Address, input: Extract<MoveInput, { kind: 'send' }>): Promise<Built> {
  if (input.source.chainId !== CHAIN_ID) return { why: c.refusals.unknownChain }
  if (!isAddress(input.recipient, { strict: false }) || /^0x0{40}$/i.test(input.recipient))
    return { why: c.refusals.badAddress }
  const to = getAddress(input.recipient)
  const agents = await desksOfOwner(db(), owner)
  const agent = agents.find((d) => same(d.address, to))
  if (agent)
    return {
      why: c.refusals.toYourAgent,
      hint: { kind: 'use_fund', deskId: agent.id, deskSlug: agent.shareSlug },
    }
  if (await isTokenContract(to)) return { why: c.refusals.tokenContract }
  const amount = BigInt(input.source.amountRaw)
  if (amount <= 0n) return { why: c.refusals.amount }
  const gasProblem = await needsGas(owner)
  if (gasProblem) return { why: gasProblem }
  const token = input.source.token
  const base = {
    kind: 'send' as const,
    deskId: null,
    fromChainId: CHAIN_ID,
    toChainId: CHAIN_ID,
    recipient: to,
  }

  if (isNative(token)) {
    const held = await balanceOf(NATIVE, owner)
    if (held < amount) return { why: c.refusals.notEnough(amountText(held, 18, 'ETH')) }
    const worth = ethToUsdg(amount, await ethUsdE8())
    const sent = amountText(amount, 18, 'ETH')
    return {
      ...base,
      tokenIn: NATIVE,
      amountIn: amount,
      tokenOut: NATIVE,
      steps: [
        {
          chainId: CHAIN_ID,
          to,
          data: '0x',
          value: amount.toString(),
          kind: 'transfer',
          label: c.steps.send(sent),
        },
      ],
      lines: [c.lines.youSend(`${sent}, about ${usd(worth)}`)],
      send: { symbol: 'ETH', amountRaw: amount.toString(), decimals: 18 },
      receive: { symbol: 'ETH', amountRaw: amount, decimals: 18, minimumRaw: amount },
      usdgValue: worth,
      feeUsdg: 0n,
      relayRequestId: null,
      timeEstimate: null,
    }
  }
  const stock = same(token, USDG) ? null : tokenByAddress(token)
  if (!same(token, USDG) && !stock) return { why: c.refusals.unknownToken }
  const address = stock?.address ?? USDG
  const symbol = stock?.symbol ?? 'USDG'
  const decimals = stock?.decimals ?? USDG_DECIMALS
  const held = await balanceOf(address, owner)
  if (held < amount) return { why: c.refusals.notEnough(amountText(held, decimals, symbol)) }
  const worth = stock ? ((await quotePinned(pub(), stock, 'sell', amount).catch(() => null)) ?? 0n) : amount
  const sent = stock ? amountText(amount, decimals, symbol) : usd(amount)
  return {
    ...base,
    tokenIn: address,
    amountIn: amount,
    tokenOut: address,
    steps: [
      {
        chainId: CHAIN_ID,
        to: address,
        data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, amount] }),
        value: '0',
        kind: 'transfer',
        label: c.steps.send(sent),
      },
    ],
    lines: [c.lines.youSend(stock ? `${sent}, about ${usd(worth)}` : sent)],
    send: { symbol, amountRaw: amount.toString(), decimals },
    receive: { symbol, amountRaw: amount, decimals, minimumRaw: amount },
    usdgValue: worth,
    feeUsdg: 0n,
    relayRequestId: null,
    timeEstimate: null,
  }
}

/** USDG on Robinhood Chain out to the owner's own wallet on another chain, as that chain's USDC or native coin. */
async function planBridgeOut(
  owner: Address,
  input: Extract<MoveInput, { kind: 'bridge_out' }>,
): Promise<Built> {
  if (input.to.chainId === CHAIN_ID) return { why: c.refusals.unknownChain }
  const dest = await relayToken(input.to.chainId, input.to.token)
  if (!dest) return { why: c.refusals.unknownChain }
  const amount = BigInt(input.amountRaw)
  if (amount < MIN_USDG) return { why: c.refusals.minimum }
  const gasProblem = await needsGas(owner)
  if (gasProblem) return { why: gasProblem }
  const held = await balanceOf(USDG, owner)
  if (held < amount) return { why: c.refusals.notEnough(usd(held)) }
  let q: Awaited<ReturnType<typeof relayQuote>>
  try {
    q = await relayQuote({
      user: owner,
      recipient: owner,
      originChainId: CHAIN_ID,
      destinationChainId: input.to.chainId,
      originCurrency: USDG,
      destinationCurrency: dest.address,
      amountRaw: amount,
    })
  } catch (e) {
    return { why: c.refusals.quote(e instanceof Error ? e.message : 'Relay did not answer') }
  }
  const fee = BigInt(Math.round(q.feeUsd * 1e6))
  const gets = amountText(q.amountOut, dest.decimals, dest.symbol)
  return {
    kind: 'bridge_out',
    deskId: null,
    fromChainId: CHAIN_ID,
    toChainId: input.to.chainId,
    tokenIn: USDG,
    amountIn: amount,
    tokenOut: dest.address,
    recipient: owner,
    steps: q.steps.map((s) => ({ ...s, label: c.steps.relay(s.label) })),
    lines: [
      c.lines.youSend(usd(amount)),
      c.lines.youGet(q.amountOutUsd !== null ? `${gets}, about $${q.amountOutUsd.toFixed(2)}` : gets),
      c.lines.atLeast(amountText(q.minimumOut, dest.decimals, dest.symbol)),
      c.lines.cost(usd(fee)),
      c.lines.takes(q.timeEstimate ?? 30),
    ],
    send: { symbol: 'USDG', amountRaw: amount.toString(), decimals: USDG_DECIMALS },
    receive: {
      symbol: dest.symbol,
      amountRaw: q.amountOut,
      decimals: dest.decimals,
      minimumRaw: q.minimumOut,
    },
    usdgValue: amount,
    feeUsdg: fee,
    relayRequestId: q.requestId,
    timeEstimate: q.timeEstimate,
  }
}

/**
 * A dollar of USDG to ETH in the owner's wallet: the router swaps it to WETH it keeps (ADDRESS_THIS), then unwraps
 * that to ETH for the owner, in one multicall after an exact approval. With no ETH at all nothing on Robinhood
 * Chain can be paid for, so gas comes from another chain through Relay instead.
 */
async function planGetGas(owner: Address, input: Extract<MoveInput, { kind: 'get_gas' }>): Promise<Built> {
  const eth = await pub().getBalance({ address: owner })
  if (eth === 0n) {
    if (!input.origin) return { why: c.refusals.needOrigin, hint: { kind: 'need_origin' } }
    const origin = await relayToken(input.origin.chainId, input.origin.token)
    if (!origin || input.origin.chainId === CHAIN_ID) return { why: c.refusals.unknownChain }
    let q: Awaited<ReturnType<typeof relayQuote>>
    try {
      q = await relayQuote({
        user: owner,
        recipient: owner,
        originChainId: input.origin.chainId,
        destinationChainId: CHAIN_ID,
        originCurrency: origin.address,
        destinationCurrency: NATIVE,
        amountRaw: BigInt(input.origin.amountRaw),
      })
    } catch (e) {
      return { why: c.refusals.quote(e instanceof Error ? e.message : 'Relay did not answer') }
    }
    const fee = BigInt(Math.round(q.feeUsd * 1e6))
    const worth = q.amountOutUsd !== null ? BigInt(Math.round(q.amountOutUsd * 1e6)) : 0n
    return {
      kind: 'get_gas',
      deskId: null,
      fromChainId: input.origin.chainId,
      toChainId: CHAIN_ID,
      tokenIn: origin.address,
      amountIn: q.amountIn,
      tokenOut: NATIVE,
      recipient: owner,
      steps: q.steps.map((s) => ({ ...s, label: c.steps.relay(s.label) })),
      lines: [
        c.lines.youSend(amountText(q.amountIn, origin.decimals, origin.symbol)),
        c.lines.youGet(`${amountText(q.amountOut, 18, 'ETH')} on Robinhood Chain, about ${usd(worth)}`),
        c.lines.cost(usd(fee)),
        c.lines.takes(q.timeEstimate ?? 30),
      ],
      send: { symbol: origin.symbol, amountRaw: q.amountIn.toString(), decimals: origin.decimals },
      receive: { symbol: 'ETH', amountRaw: q.amountOut, decimals: 18, minimumRaw: q.minimumOut },
      usdgValue: worth,
      feeUsdg: fee,
      relayRequestId: q.requestId,
      timeEstimate: q.timeEstimate,
    }
  }
  const amount = input.amountUsdg ? BigInt(input.amountUsdg) : MIN_USDG
  if (amount <= 0n) return { why: c.refusals.amount }
  const held = await balanceOf(USDG, owner)
  if (held < amount) return { why: c.refusals.notEnough(usd(held)) }
  const out = await quote(USDG, WETH9, WETH_USDG_FEE, amount)
  if (out === null) return { why: c.refusals.quote('the WETH/USDG pool gave no price') }
  const minOut = minusSlippage(out)
  const router = getAddress(UNISWAP_V3.swapRouter02)
  const gets = amountText(out, 18, 'ETH')
  return {
    kind: 'get_gas',
    deskId: null,
    fromChainId: CHAIN_ID,
    toChainId: CHAIN_ID,
    tokenIn: USDG,
    amountIn: amount,
    tokenOut: NATIVE,
    recipient: owner,
    steps: [
      approveStep(USDG, router, amount, 'USDG', USDG_DECIMALS),
      {
        chainId: CHAIN_ID,
        to: router,
        data: await routerCall({
          tokenIn: USDG,
          tokenOut: WETH9,
          fee: WETH_USDG_FEE,
          recipient: ROUTER_ADDRESS_THIS,
          amountIn: amount,
          minOut,
          after: [
            encodeFunctionData({ abi: swapRouter02Abi, functionName: 'unwrapWETH9', args: [minOut, owner] }),
          ],
        }),
        value: '0',
        kind: 'swap',
        label: c.steps.gas(usd(amount)),
      },
    ],
    lines: [
      c.lines.youSend(usd(amount)),
      c.lines.youGet(gets),
      c.lines.atLeast(amountText(minOut, 18, 'ETH')),
    ],
    send: { symbol: 'USDG', amountRaw: amount.toString(), decimals: USDG_DECIMALS },
    receive: { symbol: 'ETH', amountRaw: out, decimals: 18, minimumRaw: minOut },
    usdgValue: amount,
    feeUsdg: 0n,
    relayRequestId: null,
    timeEstimate: null,
  }
}

// ---------------------------------------------------------------- the one entry point

/**
 * Plans one move for a signed-in owner and saves it as `signing`. `replaces` is the plan it refreshes after the
 * 60 seconds ran out: that one is closed as nothing sent, if nothing was.
 */
export async function planMove(
  owner: { address: string; ownerId: string },
  input: MoveInput,
  replaces?: string,
): Promise<PlanResult> {
  const address = getAddress(owner.address)
  if (replaces) {
    const old = await moneyMoveForOwner(db(), replaces, owner.address)
    if (old && old.status === 'signing' && old.txHashes.length === 0)
      await settleMoneyMove(db(), old.id, { status: 'nothing_sent', error: 'replaced by a fresh price' })
  }
  const built =
    input.kind === 'fund'
      ? await planFund(address, input)
      : input.kind === 'send'
        ? await planSend(address, input)
        : input.kind === 'bridge_out'
          ? await planBridgeOut(address, input)
          : await planGetGas(address, input)
  if ('why' in built) return { ok: false, why: built.why, ...(built.hint ? { hint: built.hint } : {}) }

  // The Robinhood Chain side is simulated for its fee; Relay's quote already counts the origin chain's.
  if (built.fromChainId === CHAIN_ID) {
    const fee = await feeOf(address, built.steps)
    if ('why' in fee) return { ok: false, why: fee.why }
    built.feeUsdg += fee.usdg
    if (built.relayRequestId === null && fee.usdg > 0n) built.lines.push(c.lines.cost(usd(fee.usdg)))
  }

  const row = await createMoneyMove(db(), {
    ownerId: owner.ownerId,
    deskId: built.deskId,
    kind: built.kind,
    fromChainId: built.fromChainId,
    toChainId: built.toChainId,
    tokenIn: built.tokenIn,
    amountIn: built.amountIn,
    tokenOut: built.tokenOut,
    amountOutQuoted: built.receive.amountRaw,
    usdgValue: built.usdgValue,
    feeUsdg: built.feeUsdg,
    recipient: built.recipient,
    steps: built.steps.map((s) => ({
      chainId: s.chainId,
      to: s.to.toLowerCase(),
      kind: s.kind,
      label: s.label,
    })),
    relayRequestId: built.relayRequestId,
  })
  return {
    ok: true,
    plan: {
      moveId: row.id,
      kind: built.kind,
      fromChainId: built.fromChainId,
      toChainId: built.toChainId,
      recipient: built.recipient,
      steps: built.steps,
      lines: built.lines,
      send: built.send,
      receive: {
        symbol: built.receive.symbol,
        amountRaw: built.receive.amountRaw.toString(),
        decimals: built.receive.decimals,
        minimumRaw: built.receive.minimumRaw.toString(),
      },
      usdgValue: built.usdgValue.toString(),
      feeUsdg: built.feeUsdg.toString(),
      expiresAt: new Date(Date.now() + PLAN_TTL_MS).toISOString(),
      relayRequestId: built.relayRequestId,
      timeEstimate: built.timeEstimate,
    },
  }
}
