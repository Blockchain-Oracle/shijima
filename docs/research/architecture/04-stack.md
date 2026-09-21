# 04. Library stack

Written 2026-09-19. Every version below came from `npm view <pkg> version` today. Claims are labelled
VERIFIED (npm output, an unpacked tarball, a live API call, or a Context7 doc fetched today) or
UNVERIFIED (memory or inference). MCP is out of scope and nothing here needs one.

Context7 was used over its HTTP API. The Context7 MCP server failed to connect in this session, which
did not matter.

## Pick table

| # | Area | Pick | Version | Why, in a few words |
|---|---|---|---|---|
| 1 | Framework | Next.js App Router + React | next 16.3.5, react 19.3.0 | `latest` tag, stable since 16.0, Turbopack default |
| 1 | CSS | Tailwind v4 | tailwindcss 4.3.3, @tailwindcss/postcss 4.3.3 | CSS-first config, what shadcn scaffolds |
| 1 | Components | shadcn/ui CLI | shadcn 4.21.0 | `init`, then `add field chart ...` |
| 1 | Forms | react-hook-form + zod resolver | rhf 7.88.0, @hookform/resolvers 5.9.1, zod 4.6.5 | shadcn documents it first, resolver peers zod 4 |
| 1 | Charts | shadcn `chart` on Recharts | recharts 3.10.1 | one line chart, one bar chart, themed for free |
| 2 | Chain libs | wagmi 3 + viem 2 | wagmi 3.7.7, viem 2.56.8, @tanstack/react-query 5.103.1 | current majors, viem ships `robinhood` |
| 3 | Wallet connection | NO kit. wagmi `injected()` + `walletConnect()` | @walletconnect/ethereum-provider 2.25.0 | every kit is stuck on wagmi 2. Works on a phone |
| 4 | Sign-in | iron-session + `viem/siwe` | iron-session 9.0.1 | about 70 lines, no tables, smart-wallet safe |
| 5 | Database | Drizzle + node-postgres on Neon | drizzle-orm 0.45.2, drizzle-kit 0.31.10, pg 8.23.0 | one driver for both apps, real transactions |
| 6 | Bridging | Relay SDK only, no widget | @relayprotocol/relay-sdk 8.0.1 | widget breaks on wagmi 3. 4663 + USDG live |
| 7 | Inference client | `openai` SDK with `baseURL` | openai 5.23.2 (pinned for OpenServ peer) | passes odd tools through untouched |
| 8 | Canonical JSON | `canonicalize` | 5.1.0 | RFC 8785 author's lib, 2.5M downloads a week |
| 9 | Market calendar | No library. 40 line table + `Intl` | none | npm options are dead. NYSE page is the source |
| 10 | Telegram | grammY | grammy 1.46.0 | telegraf has not shipped since Feb 2024 |
| 11 | Monorepo | plain pnpm workspaces, no Turborepo | pnpm 11.24.0 | two apps, two packages. `pnpm --filter` is enough |
| 11 | Sharing TS | source-only packages, `transpilePackages`, `tsx` | tsx 4.23.13 | no build step anywhere |
| 11 | TypeScript | PIN to 6.x | typescript 6.0.3 | `latest` is 7.0.2 native, tooling not all ready |
| 11 | Lint and format | Biome | @biomejs/biome 2.5.14 | one tool, no TypeScript dependency |
| 11 | Tests | vitest | 5.0.1 | standard |
| 11 | Env validation | t3-env in web, plain zod in worker | @t3-oss/env-nextjs 0.13.11 | client and server split matters only in Next |
| 12 | Worker hosting | Railway Hobby | 5 USD a month minimum | public HTTPS URL, no Dockerfile, no sleep |
| 13 | Logging | pino to stdout | pino 10.3.1 | JSON logs, host captures them |
| 13 | Alerts | raw `fetch` to Telegram `sendMessage` | none | 10 lines, reuse the bot token |

Node: use 24 LTS (24.21.0 is the current LTS, VERIFIED from nodejs.org). Next 16 needs node >= 20.9.

## 14. Conflicts and surprises first, because they drove the picks

1. **wagmi 3 stranded every wallet kit.** VERIFIED with `npm view <pkg> peerDependencies` and each
   repo's `main` branch today.
   - RainbowKit 2.2.11 peers `wagmi ^2.9.0`. Four "wagmi v3 compatibility" PRs were closed unmerged
     (#2591, #2622, #2626, #2627).
   - ConnectKit 1.9.2 peers `react 17.x || 18.x` and `wagmi 2.x`. Dead for React 19.
   - Reown AppKit adapter 1.8.24 peers `wagmi >=2.19.5`, which admits v3 on paper. But its own App
     Router example pins `wagmi 2.19.5`, and issue #5793 "feat(adapter-wagmi): migrate to wagmi v3" was
     opened today and is still open. Issue #5464 was a real v3 bug (infinite balance spinner). Treat
     it as not migrated.
   - wagmi 2.19.5 was the last 2.x, published 2025-11-19, the same day 3.0.0 shipped. It is frozen.
2. **Relay Kit UI hard-breaks on wagmi 3.** VERIFIED by unpacking both tarballs.
   `@relayprotocol/relay-kit-ui` 12.0.2 peers `wagmi ^2.15.6` and imports `useCapabilities` from
   `wagmi/experimental`. wagmi 3.7.7 has no `./experimental` export. That is a build failure, not a
   warning. The SDK alone peers only `viem >=2.26.0`, so it is safe.
3. **OpenServ SDK peers an old openai major.** VERIFIED. `@openserv-labs/sdk` 2.4.1 peers
   `openai ^5.0.1` and does `require("openai")` at the top of `dist/agent.js`. openai `latest` is 7.19.0.
   The SDK only calls `chat.completions.create`. Pin openai 5.23.2 in the worker and the peer is clean.
4. **openai 5.x `zodResponseFormat` is zod 3 only.** VERIFIED in `helpers/zod.js`: it uses a vendored
   `zod-to-json-schema`. Do not use it with zod 4. Use `z.toJSONSchema` directly (see area 7).
5. **TypeScript `latest` is 7.0.2, the native compiler.** VERIFIED by unpacking. Its `.` export is only
   `lib/version.cjs`, so the classic JS compiler API is gone. `typescript-eslint` peers
   `>=4.8.4 <6.1.0`. Next 16.3.5 copes through `experimental.useTypeScriptCli` and otherwise errors
   with "install TypeScript 6 instead". Pin 6.0.3. `create-next-app` may install 7, so check.
6. **Drizzle docs now default to the release candidate.** VERIFIED. Context7 and the Neon guide show
   `drizzle-orm@rc` (1.0.0-rc.4, 2026-06-27). npm `latest` is 0.45.2 (2026-03-27). Stay on `latest`.
   Relational query examples in current docs may use the v2 syntax that 0.45 does not have.
7. **iron-session 9 is three weeks old.** VERIFIED. 9.0.0 and 9.0.1 both shipped 2026-08-30, and
   `cookie` and `iron-webcrypto` are now peers. pnpm installs peers automatically. If anything feels
   off, 8.0.4 is the long-stable fallback with the same API for our use.
8. **Docs that still show `webpack` config.** Reown and WalletConnect docs push
   `config.externals.push('pino-pretty','lokijs','encoding')`. Next 16 builds with Turbopack by
   default, where a bare `webpack` key is a problem. If a build warns about those modules, use
   `serverExternalPackages` instead. Whether 2.25.0 still needs it is UNVERIFIED.
9. **Explorer mismatch.** viem's `robinhood` lists Blockscout (`robinhoodchain.blockscout.com`). Relay's
   chain record lists `robin.etherscan.io`. Both VERIFIED. Pick one for links and keep it in one helper.
10. No conflict, for the record: better-auth 1.7.5 peers `next ^16` and `drizzle-orm ^0.45.2`. zod 4 is
    accepted by @hookform/resolvers, t3-env, openai, and the OpenServ SDK peer range.

## 1. Next.js, Tailwind, shadcn, forms, charts

Next 16.3.5 is `latest` and stable. VERIFIED caveats from the version 16 upgrade guide:
- `middleware.ts` is now `proxy.ts` with an exported `proxy` function. It runs on the Node runtime only.
- `params`, `searchParams`, `cookies()` and `headers()` are async. Always `await` them. Several
  library docs, iron-session included, still show the old sync call.
- Turbopack is the default bundler for dev and build.
- `next lint` is gone in 16 (UNVERIFIED, from memory). Irrelevant with Biome.

shadcn CLI flow, VERIFIED from the shadcn docs: `init` now asks for a component base (`--base base|radix|aria`)
and a preset, and the default style is `base-nova`. `init --monorepo` scaffolds Turborepo plus a
`packages/ui`. Do not use that flag. Keep components inside `apps/web`.

```bash
pnpm create next-app@latest apps/web --ts --tailwind --app --use-pnpm
cd apps/web && pnpm dlx shadcn@latest init        # pick radix or base, neutral
pnpm dlx shadcn@latest add button card dialog field input select slider switch textarea tabs badge sonner chart
```

Forms: react-hook-form. shadcn ships a first-class RHF guide built on the new `Field` component with
`Controller`, and a TanStack Form guide second. RHF plus `zodResolver` lets the mandate form reuse the
exact zod schema from `packages/shared`. TanStack Form 1.33.5 is fine but buys nothing here.

Charts: `shadcn add chart` wraps Recharts in `ChartContainer` with CSS variable colors. Recharts 3.10.1
peers React 19. One `LineChart` for value over time, one horizontal `BarChart` for allocation against
target. Format money on the server as strings and parse to numbers only at the chart edge.

## 2. wagmi and viem

wagmi 3.7.7, viem 2.56.8. VERIFIED from the v2 to v3 migration guide:
- Connector SDKs are now optional peers you install yourself. For WalletConnect that is
  `@walletconnect/ethereum-provider`.
- `useAccount` is renamed `useConnection`. The old name still exports as a deprecated alias.
- Mutation hooks return `mutate` and `mutateAsync` (`const write = useWriteContract(); write.mutate(...)`).
- `useConnect().connectors` is removed. Use `useConnectors()`.
- wagmi peers `typescript >=5.9.3`.

viem exports `robinhood` (id 4663) and `robinhoodTestnet` (id 46630) from `viem/chains`, both with
multicall3. No `defineChain` needed. The mainnet definition lists a third-party RPC second, so pass the
official URL explicitly.

```ts
// packages/shared/src/chains.ts
import { http } from 'viem'
import { robinhood, base, arbitrum, mainnet, bsc } from 'viem/chains'
export const RH_RPC = 'https://rpc.mainnet.chain.robinhood.com'
export const chains = [robinhood, base, arbitrum, mainnet, bsc] as const
export const transports = {
  [robinhood.id]: http(RH_RPC), [base.id]: http(), [arbitrum.id]: http(), [mainnet.id]: http(), [bsc.id]: http(),
}
```

## 3. Wallet connection: no kit

Pick: plain wagmi connectors. This matches every reference repo and is the simplest thing that works
on a phone.
- `injected()` covers MetaMask, Rabby and the Robinhood Wallet extension through EIP-6963 discovery,
  and covers any wallet's in-app mobile browser.
- `walletConnect({ projectId })` covers a phone browser talking to a wallet app. VERIFIED:
  `showQrModal` defaults to `true`, and `@walletconnect/ethereum-provider` 2.25.0 bundles
  `@reown/appkit` 1.8.19 as a dependency, so you get the Reown QR and deep-link modal without adopting
  AppKit or its wagmi adapter.
- You still need a free project id from the Reown dashboard. VERIFIED on the pricing page: the free
  plan is 0 USD. The 500 monthly user cap applies only to their hosted sign-in and embedded wallets,
  which we do not use.
- The connect UI is one shadcn `Dialog` that maps `useConnectors()` to buttons. About 50 lines.

```ts
// apps/web/lib/wagmi.ts
import { createConfig, createStorage, cookieStorage } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { chains, transports } from '@desk/shared/chains'
export const config = createConfig({
  chains, transports, ssr: true,
  storage: createStorage({ storage: cookieStorage }),
  connectors: [
    injected(),
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!, metadata: { name: 'After-hours desk', description: '', url: 'https://YOUR_DOMAIN', icons: [] } }),
  ],
})
```

In the root layout, read `(await headers()).get('cookie')` and pass `cookieToInitialState(config, cookie)`
to `WagmiProvider`. `metadata.url` must match the deployed origin or mobile wallets show a warning.
Chain 4663 is unknown to most wallets, so call `switchChain` and let wagmi fall back to
`wallet_addEthereumChain` using the viem definition.

Rejected: RainbowKit and ConnectKit (conflict 1), Reown AppKit adapter (not migrated to wagmi 3),
Privy 3.44.0 and Dynamic 5.9.0 (hosted accounts, dashboards, plan limits, and our owners already have
wallets). The fallback if plain connectors disappoint is wagmi 2.19.5 plus RainbowKit 2.2.11, which
also unlocks the Relay widget. That is a frozen stack, so only go there under time pressure.

## 4. Sign-in with Ethereum

Pick: iron-session 9.0.1 plus `viem/siwe`. VERIFIED: viem exports `generateSiweNonce`,
`createSiweMessage`, `parseSiweMessage`, `validateSiweMessage` and the `verifySiweMessage` action from
`viem/siwe`. The separate `siwe` npm package (3.0.0, Jan 2025) peers ethers, so skip it.

```ts
// apps/web/lib/session.ts
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
export type Session = { nonce?: string; address?: `0x${string}` }
export const getSession = async () =>
  getIronSession<Session>(await cookies(), {
    password: process.env.SESSION_SECRET!, cookieName: 'desk_session',
    cookieOptions: { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 },
  })

// app/api/siwe/nonce/route.ts   -> s.nonce = generateSiweNonce(); await s.save(); return { nonce }
// app/api/siwe/verify/route.ts
const s = await getSession()
const { message, signature } = await req.json()
const ok = await publicClient.verifySiweMessage({ message, signature, nonce: s.nonce, domain: APP_DOMAIN })
if (!ok) return new Response(null, { status: 401 })
s.address = parseSiweMessage(message).address; s.nonce = undefined; await s.save()
```

Safety checklist: nonce issued by the server and cleared on success, `domain` pinned to your host,
`expirationTime` set in the message, and verify through a public client action rather than the bare
`verifyMessage` util. The client action handles smart contract wallets (ERC-1271 and ERC-6492). The
better-auth docs example uses the bare util, which only works for plain key wallets. Every mutating
route handler calls `getSession()` and checks the desk's `owner` equals `session.address`.

Rejected: better-auth 1.7.5 SIWE plugin. It works and its peers are clean, but it adds five tables, a
schema generator, a Drizzle adapter and synthetic email addresses, and you still write the verify
callback yourself. It is the upgrade path if email or social login is ever wanted. next-auth is still
4.24.15 on `latest` and its credentials flow for SIWE is more code than this.

## 5. Database

Pick: drizzle-orm 0.45.2, drizzle-kit 0.31.10, `pg` 8.23.0, Neon Postgres. One driver in both apps.
- Web on Vercel: VERIFIED in Neon's connection pooling guide. Use a `pg` Pool against the pooled
  (`-pooler`) URL and call `attachDatabasePool(pool)` from `@vercel/functions` 3.9.8, with `max: 2`
  and a short idle timeout. Vercel functions reuse instances, so TCP pooling works.
- Worker: same code, direct (non-pooled) URL, `max: 5`.
- Why not `neon-http` for the web app: it has no interactive transactions, and then the two apps run
  different drivers with different behavior. Approve and reject must be a guarded state transition
  (`update ... where status = 'pending' returning`), and a real transaction is nice to have.

```ts
// packages/db/src/index.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
export const createDb = (url: string, max = 2) => {
  const pool = new Pool({ connectionString: url, max, idleTimeoutMillis: 5000 })
  return { db: drizzle(pool, { schema }), pool }
}
```

Migrations: `drizzle-kit generate` writes SQL into `packages/db/drizzle`, commit it, and
`drizzle-kit migrate` runs against the direct URL. Use `push` only on day one. Run `migrate` by hand or
as the worker's pre-start command. Never from the Vercel build. Store token amounts as `numeric` or
`text` and map to `bigint` in code. Drizzle returns `numeric` as a string, which is what you want.

## 6. Relay bridging

Package: `@relayprotocol/relay-sdk` 8.0.1 (published 2026-09-09). `@reservoir0x/relay-sdk` stopped at
2.4.0 in Oct 2025 and is the old name. The React widget is `@relayprotocol/relay-kit-ui` 12.0.2 and is
unusable on wagmi 3 (conflict 2). `@relayprotocol/relay-kit-hooks` 5.0.1 peers only React, viem and
TanStack Query, so it is an option if you want `useQuote`, but the SDK alone is enough.

VERIFIED against `https://api.relay.link/chains` today: chain 4663 "Robinhood Chain" is enabled,
deposits enabled, and USDG `0x5fc5360d0400a0fd4f2af552add042d716f1d168` (6 decimals) is a solver
currency with `supportsBridging: true`. A live quote for 25 USDC on Base to USDG on 4663 returned two
steps (approve, deposit), 24.905718 USDG out, about 0.04 USD relayer fee, and a one second estimate.

Origin tokens, VERIFIED: USDC on Base `0x8335...2913`, Arbitrum `0xaf88...5831`, Ethereum
`0xa0b8...eb48` (all 6 decimals), and BNB `0x8ac7...580d` with **18 decimals**. Ethereum also has
native USDG `0xe343...491d`. Never hardcode 6 decimals for the origin side.

The SDK's built-in chain list does not include 4663 (VERIFIED by grep), so configure chains.

```ts
import { createClient, getClient, convertViemChainToRelayChain, MAINNET_RELAY_API } from '@relayprotocol/relay-sdk'
createClient({ baseApiUrl: MAINNET_RELAY_API, source: 'YOUR_DOMAIN', chains: chains.map(convertViemChainToRelayChain) })

const quote = await getClient().actions.getQuote({
  chainId: 8453, currency: BASE_USDC, toChainId: 4663, toCurrency: USDG_4663,
  amount: '25000000', tradeType: 'EXACT_INPUT', wallet: walletClient, recipient: deskAddress,
})
await getClient().actions.execute({ quote, wallet: walletClient, onProgress: ({ currentStep, txHashes }) => setProgress(...) })
```

`wallet` accepts a viem `WalletClient` directly (from wagmi's `useWalletClient`). Setting `recipient` to
the desk contract makes "bridge and fund" one user flow. Check first that the desk accepts a plain
ERC-20 transfer as a deposit, otherwise bridge to the owner and deposit in a second tx. Show
`details.currencyOut.amountFormatted` and total fees before the user signs.

## 7. Inference client

Pick: the `openai` SDK with `baseURL: 'https://inference-api.openserv.ai/v1'`, version 5.23.2 to satisfy
the OpenServ SDK peer. VERIFIED in the 5.23.2 types: `FunctionDefinition.parameters` is optional, so a
function tool with only a name is type-valid, and `response_format` of type `json_schema` with
`strict` is supported. The SDK sends `tools` through untouched, which is exactly what SERV's specially
named toggles need. The exact shape of `serv_prompt_guard` and `serv_shadow_agent` comes from the
OpenServ research, not from here.

Vercel AI SDK (ai 7.0.107, @ai-sdk/openai-compatible 3.0.53) is the wrong tool. Its tool model
requires an input schema and an execute contract, and raw vendor tools only fit through
`transformRequestBody` or a custom `fetch`. Those hooks exist (VERIFIED) but that is a workaround for
something the openai SDK does natively.

zod 4 `z.toJSONSchema`, VERIFIED by running zod 4.6.5:
- `z.object` emits `additionalProperties: false` by default. Good.
- `.optional()` fields drop out of `required`. OpenAI strict mode rejects that. Use `.nullable()`, which
  emits `type: ["string","null"]` and stays required.
- `.default()` stays required in output mode but emits a `default` keyword. Avoid defaults in the wire schema.
- It emits `$schema` and numeric bounds (`minimum`, `maximum`). Strip `$schema`. Whether SERV's backend
  accepts bounds, `pattern` or `format` under strict is UNVERIFIED. Keep the wire schema to strings,
  integers, booleans, enums, arrays and objects, and enforce the rest with zod after parsing.
- No `z.record`, no unions of objects without a discriminator, no recursion, in the wire schema.

```ts
const { $schema, ...schema } = z.toJSONSchema(Decision)
const res = await client.chat.completions.create({
  model, messages,
  response_format: { type: 'json_schema', json_schema: { name: 'decision', strict: true, schema } },
  tools: servTools as any,   // pass SERV toggles as plain objects
})
const decision = Decision.parse(JSON.parse(res.choices[0].message.content ?? ''))
```

Always `Decision.parse` the reply. Treat a parse failure as "hold", never as a retry loop that trades.

## 8. Canonical JSON hashing

Pick: `canonicalize` 5.1.0 (ESM, typed, by the RFC 8785 co-author, 2.5M weekly downloads, published
2026-09-18). `json-canonicalize` 3.0.1 produced byte-identical output in my test and is a fine second.

VERIFIED by running both:
- Keys sort, `undefined` properties drop, `-0` becomes `0`, `1.0` becomes `1`.
- `0.1 + 0.2` serializes as `0.30000000000000004`, and `1e21` as `1e+21`. Any float in a hashed record
  is a trap.
- `BigInt` throws. `NaN` and `Infinity` throw.

Rules: every amount, price, weight and timestamp in a hashed record is a decimal **string** or an
integer in basis points. Convert `bigint` with `.toString()` before canonicalizing. Hash with
`keccak256(toBytes(canonicalize(record)))` from viem. Put a `schemaVersion` field inside the record. Do
the canonicalize and hash in one shared function in `packages/shared` and test it with a fixed vector.

## 9. US market calendar

Pick: no library. npm has nothing credible. `nyse-holidays` 1.2.0 last shipped in May 2022 with about
1,300 downloads a week, and `us-equity-market-calendar` 1.0.0 has about 100.

Source of truth, VERIFIED from nyse.com/markets/hours-calendars today:
- 2026 remaining: closed Thu Nov 26 and Fri Dec 25. Early close 1:00 pm ET on Fri Nov 27 and Thu Dec 24.
- 2027: closed Jan 1, Jan 18, Feb 15, Mar 26, May 31, Jun 18, Jul 5, Sep 6, Nov 25, Dec 24. Early close Nov 26.
- Core session 9:30 am to 4:00 pm ET. No holiday falls inside the hackathon window.

Timezone handling uses built-in `Intl` with `timeZone: 'America/New_York'`, which is DST safe with no
dependency. I ran this across the Nov 1 DST change, a holiday and an early close and it was correct.
`Temporal` is still undefined on Node 25.9 and 24 LTS (VERIFIED locally), so no Temporal, and no need
for luxon or `@date-fns/tz`.

```ts
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' })
export function nySession(now = new Date()) {
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]))
  const date = `${p.year}-${p.month}-${p.day}`, mins = +p.hour * 60 + +p.minute
  if (p.weekday === 'Sat' || p.weekday === 'Sun') return { date, session: 'closed', reason: 'weekend' }
  if (CLOSED.has(date)) return { date, session: 'closed', reason: 'holiday' }
  const close = EARLY.has(date) ? 780 : 960
  if (mins >= 570 && mins < close) return { date, session: 'regular' }
  if (mins >= 240 && mins < 570) return { date, session: 'pre' }
  if (mins >= close && mins < (EARLY.has(date) ? 1020 : 1200)) return { date, session: 'after' }
  return { date, session: 'closed', reason: 'overnight' }
}
```

For "next open at", step forward in five minute increments until `session === 'regular'`. It is cheap
and avoids converting New York wall time back to UTC. Note that Stock Tokens may trade on their own
hours. This calendar describes the underlying market, which is what "after hours" means for the desk.

## 10. Telegram

Pick: grammY 1.46.0 (2026-08-26, 4.7M downloads a week, tracks the Bot API closely). telegraf 4.16.3
was last released 2024-02-29. Both VERIFIED. Run grammY inside the worker with long polling to start.
One token means one update consumer, so never run a second poller on the same token.

## 11. Monorepo, TypeScript, tooling

Layout: `apps/web`, `apps/worker`, `packages/db`, `packages/shared` (zod schemas, ABIs, chains,
calendar, hashing). Plain pnpm workspaces. Turborepo 2.11.2 adds caching that four packages do not need.

No build step for shared packages:

```jsonc
// packages/shared/package.json
{ "name": "@desk/shared", "type": "module", "exports": { ".": "./src/index.ts", "./*": "./src/*.ts" } }
```

```ts
// apps/web/next.config.ts
export default { transpilePackages: ['@desk/shared', '@desk/db'] }
```

The worker runs with `tsx` in dev (`tsx watch src/index.ts`) and in production (`tsx src/index.ts`).
That is fine for a two week run. Skip tsup: its type bundling leans on the classic compiler API.
Use `"moduleResolution": "bundler"` and extensionless imports in one root `tsconfig.base.json`. Keep
`pg` out of any file that a client component imports. `packages/shared` must stay free of Node-only
imports so the browser bundle is clean. Put the pinned versions in a pnpm `catalog:` so both apps
resolve the same viem and zod.

TypeScript: pin `6.0.3`. Reasons are in conflict 5. TS 7 mostly works with this stack (Biome, tsx and
vitest do not use the compiler API, and Next 16.3.5 has a CLI path), but it buys only speed that a repo
this size does not need, and the Next editor plugin will not load.

Biome 2.5.14 over ESLint 10 plus Prettier: one binary, one config, and no TypeScript coupling.
vitest 5.0.1 for the policy engine, hashing vector and calendar. Env: `@t3-oss/env-nextjs` 0.13.11 in
the web app for the server and client split. A plain `z.object({...}).parse(process.env)` in the worker.

## 12. Worker hosting

Pick: Railway, Hobby plan. VERIFIED on the pricing page: Hobby is 5 USD a month minimum and includes
5 USD of usage. A free trial gives 5 USD of credit for 30 days with no card, but it caps at 0.5 GB RAM
and I would not bet a judged demo on trial limits. Railway gives a public HTTPS domain per service,
builds a pnpm monorepo from a root directory setting without a Dockerfile, restarts on crash, and does
not sleep services. Bind the OpenServ agent's HTTP server to `process.env.PORT`. Set the start command
to `pnpm --filter worker start` and the pre-deploy command to the Drizzle migrate script.

Alternatives: Fly.io is cheaper (shared-cpu-1x 256 MB is 2.02 USD a month, 512 MB is 3.32, VERIFIED)
but needs a Dockerfile, a `fly.toml`, and auto-stop turned off. Render's free web service spins down
when idle (UNVERIFIED detail, the page only says "limitations apply"), and always-on starts at 7 USD.
A VPS means TLS, a reverse proxy and a process manager, which is setup time you do not have.

## 13. Logging and alerts

pino 10.3.1, JSON to stdout, one child logger per desk with `deskId` and `runId` bound. The OpenServ
SDK carries its own pino 9 as a regular dependency, so there is no clash. Use `pino-pretty` 13.1.3 in
dev only. No Sentry.

Alerts are a raw call, no library. Rate limit by error key so a crash loop cannot spam the chat.

```ts
const last = new Map<string, number>()
export async function alert(key: string, text: string) {
  if (Date.now() - (last.get(key) ?? 0) < 600_000) return
  last.set(key, Date.now())
  await fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TG_ALERT_CHAT, text: text.slice(0, 3500) }),
  }).catch(() => {})
}
```

Wire it to `process.on('unhandledRejection')`, `uncaughtException`, a failed hourly run, a reverted
operator tx, and a low operator ETH balance on 4663.

## Install lines

```bash
# apps/web
pnpm add next@16.3.5 react@19.3.0 react-dom@19.3.0 wagmi@3.7.7 viem@2.56.8 @tanstack/react-query@5.103.1 \
  @walletconnect/ethereum-provider@2.25.0 @relayprotocol/relay-sdk@8.0.1 iron-session@9.0.1 \
  react-hook-form@7.88.0 @hookform/resolvers@5.9.1 zod@4.6.5 recharts@3.10.1 @t3-oss/env-nextjs@0.13.11 @vercel/functions@3.9.8
# apps/worker
pnpm add @openserv-labs/sdk@2.4.1 openai@5.23.2 viem@2.56.8 zod@4.6.5 canonicalize@5.1.0 grammy@1.46.0 pino@10.3.1
pnpm add -D tsx@4.23.13 pino-pretty@13.1.3
# packages/db
pnpm add drizzle-orm@0.45.2 pg@8.23.0 && pnpm add -D drizzle-kit@0.31.10 @types/pg@8.23.1
# root
pnpm add -Dw typescript@6.0.3 @biomejs/biome@2.5.14 vitest@5.0.1
```
