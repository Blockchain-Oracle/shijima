/**
 * Dev wallet funding helper. LOCAL DEVELOPMENT ONLY. Small amounts. Never use these wallets in production.
 *
 * Abu withdraws a few dollars of a network's own coin from an exchange to the dev wallet, on Base, Arbitrum or
 * BNB Smart Chain. No exchange withdraws straight to Robinhood Chain, so this script bridges it with Relay:
 * part arrives as ETH (gas for deploys and for the agent), the rest as USDG (cash for the test desk).
 *
 *   pnpm dev:funds status   balances on every network
 *   pnpm dev:funds watch    wait for a deposit, then bridge and split it. Exits when done.
 *   pnpm dev:funds bridge   bridge whatever is there now
 *   pnpm dev:funds split    give the agent wallet its share of ETH on Robinhood Chain
 *
 * The private keys are read from .env and are never printed.
 */
import { erc20Abi, makePublicClient, OFFICIAL_RPC, USDG } from '@desk/chain'
import { errorText, registerSecretsFromEnv } from '@desk/shared'
import {
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  fallback,
  formatEther,
  formatUnits,
  type Hex,
  http,
  parseEther,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrum, base, bsc, robinhood } from 'viem/chains'

registerSecretsFromEnv(process.env)

const NATIVE: Address = '0x0000000000000000000000000000000000000000'
const RELAY = 'https://api.relay.link'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Origin {
  chain: Chain
  rpcs: string[]
  coin: string
  minDeposit: bigint
  gasReserve: bigint
}
const ORIGINS: Origin[] = [
  {
    chain: base,
    rpcs: ['https://mainnet.base.org', 'https://base-rpc.publicnode.com'],
    coin: 'ETH',
    minDeposit: parseEther('0.0003'),
    gasReserve: parseEther('0.00004'),
  },
  {
    chain: arbitrum,
    rpcs: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one-rpc.publicnode.com'],
    coin: 'ETH',
    minDeposit: parseEther('0.0003'),
    gasReserve: parseEther('0.00004'),
  },
  {
    chain: bsc,
    rpcs: ['https://bsc-dataseed.bnbchain.org', 'https://bsc-rpc.publicnode.com'],
    coin: 'BNB',
    minDeposit: parseEther('0.0015'),
    gasReserve: parseEther('0.0003'),
  },
]

function need(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is missing from .env`)
  return v
}
const deployer = privateKeyToAccount(need('DEPLOYER_PRIVATE_KEY') as Hex)
const operatorAddress = need('OPERATOR_ADDRESS') as Address
const alchemy = process.env.ALCHEMY_KEY
  ? `https://robinhood-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
  : undefined
const rh = makePublicClient([alchemy, OFFICIAL_RPC].filter((u): u is string => Boolean(u)))
const transportFor = (rpcs: string[]) =>
  fallback(rpcs.map((u) => http(u, { retryCount: 4, retryDelay: 800, timeout: 25_000 })))
const originClient = (o: Origin) => createPublicClient({ chain: o.chain, transport: transportFor(o.rpcs) })

/** This network drops connections. Never fail on the first timeout. */
async function relay<T>(path: string, body?: unknown, attempts = 6): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${RELAY}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'content-type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(40_000),
      })
      const json = (await res.json()) as T & { message?: string }
      if (!res.ok) throw new Error(`Relay ${res.status}: ${json.message ?? 'no message'}`)
      return json
    } catch (e) {
      last = e
      await sleep(1500 * (i + 1))
    }
  }
  throw last
}

interface Quote {
  steps: Array<{
    id: string
    requestId: string
    items: Array<{ data: { to: Address; data: Hex; value: string } }>
  }>
  details: {
    currencyIn: { amountUsd: string }
    currencyOut: { amountFormatted: string; amountUsd: string; currency: { symbol: string } }
  }
}
const quote = (o: Origin, amount: bigint, destinationCurrency: Address) =>
  relay<Quote>('/quote', {
    user: deployer.address,
    recipient: deployer.address,
    originChainId: o.chain.id,
    destinationChainId: 4663,
    originCurrency: NATIVE,
    destinationCurrency,
    amount: amount.toString(),
    tradeType: 'EXACT_INPUT',
  })

async function bridgeOne(o: Origin, amount: bigint, destinationCurrency: Address, label: string) {
  const q = await quote(o, amount, destinationCurrency)
  const step = q.steps[0]
  const item = step?.items[0]
  if (!step || !item) throw new Error('Relay returned a quote with no step')
  const out = q.details.currencyOut
  console.log(
    `  ${label}: sending ${formatEther(amount)} ${o.coin}, expecting ${out.amountFormatted} ${out.currency.symbol}`,
  )

  const wallet = createWalletClient({ account: deployer, chain: o.chain, transport: transportFor(o.rpcs) })
  const hash = await wallet.sendTransaction({
    to: item.data.to,
    data: item.data.data,
    value: BigInt(item.data.value),
  })
  console.log(`  ${label}: sent on ${o.chain.name}, tx ${hash}`)
  await originClient(o).waitForTransactionReceipt({ hash, timeout: 180_000 })

  for (let i = 0; i < 60; i++) {
    const s = await relay<{ status: string }>(`/intents/status/v3?requestId=${step.requestId}`)
    if (s.status === 'success') return console.log(`  ${label}: arrived on Robinhood Chain`)
    if (s.status === 'failure' || s.status === 'refund')
      throw new Error(`${label}: Relay reported ${s.status}`)
    await sleep(3000)
  }
  throw new Error(`${label}: no confirmation from Relay after 3 minutes. Check request ${step.requestId}`)
}

/**
 * Gas comes first, cash second. A simulated deploy on 2026-09-20 showed the contracts cost about $1 of gas but
 * need $2 to $3 of ETH in the wallet up front, because the node checks gas limit times max fee before it runs
 * anything. So the first $3.50 always arrives as ETH. Whatever is left arrives as USDG for the test desk, unless
 * it is under $1, in which case bridging it separately is not worth the fee and everything arrives as ETH.
 */
const GAS_FIRST_USD = 3.5
async function bridgeAll(): Promise<boolean> {
  let moved = false
  for (const o of ORIGINS) {
    const balance = await originClient(o).getBalance({ address: deployer.address })
    if (balance < o.minDeposit) continue
    const spendable = balance - o.gasReserve * 2n // up to two bridge transactions will be sent
    const usdTotal = Number((await quote(o, spendable, NATIVE)).details.currencyIn.amountUsd)
    console.log(`${o.chain.name}: found ${formatEther(balance)} ${o.coin}, about $${usdTotal.toFixed(2)}`)

    const cashUsd = usdTotal - Math.max(GAS_FIRST_USD, usdTotal * 0.4)
    if (cashUsd < 1) {
      await bridgeOne(o, balance - o.gasReserve, NATIVE, 'gas (all of it, the deposit is small)')
    } else {
      const ethPart = (spendable * BigInt(Math.round(((usdTotal - cashUsd) / usdTotal) * 10_000))) / 10_000n
      await bridgeOne(o, ethPart, NATIVE, 'gas')
      const left = (await originClient(o).getBalance({ address: deployer.address })) - o.gasReserve
      if (left > 0n) await bridgeOne(o, left, USDG, 'cash')
    }
    moved = true
  }
  return moved
}

/** The agent wallet pays gas for every trade it makes. Give it about a third of the ETH. */
async function split() {
  const [mine, theirs] = await Promise.all([
    rh.getBalance({ address: deployer.address }),
    rh.getBalance({ address: operatorAddress }),
  ])
  if (theirs > parseEther('0.0001') || mine < parseEther('0.0002')) return
  const wallet = createWalletClient({
    account: deployer,
    chain: robinhood,
    transport: http(alchemy ?? OFFICIAL_RPC),
  })
  const value = (mine * 35n) / 100n
  const hash = await wallet.sendTransaction({ to: operatorAddress, value })
  await rh.waitForTransactionReceipt({ hash, timeout: 120_000 })
  console.log(`agent wallet funded with ${formatEther(value)} ETH, tx ${hash}`)
}

async function status() {
  for (const o of ORIGINS) {
    const b = await originClient(o)
      .getBalance({ address: deployer.address })
      .catch(() => undefined)
    console.log(
      `${o.chain.name.padEnd(16)} dev wallet  ${b === undefined ? 'rpc unreachable' : `${formatEther(b)} ${o.coin}`}`,
    )
  }
  for (const [name, address] of [
    ['dev wallet', deployer.address],
    ['agent wallet', operatorAddress],
  ] as const) {
    const [eth, usdg] = await Promise.all([
      rh.getBalance({ address }),
      rh.readContract({ address: USDG, abi: erc20Abi, functionName: 'balanceOf', args: [address] }),
    ])
    console.log(
      `Robinhood Chain   ${name.padEnd(12)} ${formatEther(eth)} ETH, ${formatUnits(usdg, 6)} USDG  (${address})`,
    )
  }
}

async function watch(minutes: number) {
  console.log(`watching ${deployer.address} on Base, Arbitrum and BNB Chain for up to ${minutes} minutes`)
  const until = Date.now() + minutes * 60_000
  while (Date.now() < until) {
    for (const o of ORIGINS) {
      const b = await originClient(o)
        .getBalance({ address: deployer.address })
        .catch(() => 0n)
      if (b >= o.minDeposit) {
        console.log(`DEPOSIT SEEN on ${o.chain.name}`)
        await sleep(8000) // let the exchange's transaction settle
        await bridgeAll()
        await split()
        await status()
        return
      }
    }
    await sleep(25_000)
  }
  console.log('NO DEPOSIT SEEN before the timeout')
  process.exitCode = 2
}

const command = process.argv[2] ?? 'status'
const run = {
  status,
  split,
  bridge: async () => void (await bridgeAll()),
  watch: () => watch(Number(process.argv[3] ?? 55)),
}[command]
if (!run) throw new Error(`unknown command "${command}". Use status, watch, bridge or split.`)
run().catch((e) => {
  console.error(errorText(e))
  process.exit(1)
})
