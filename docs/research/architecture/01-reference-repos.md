# Reference repos: what the code actually does

Date: 2026-09-19. Author: research agent. Scope: seven references read at source level, plus live read-only checks against chain 4663.

Every claim is labelled VERIFIED (read in code, path and line given, or observed live) or UNVERIFIED (inferred, or claimed by the repo but not proven).

Clones live in the session scratchpad under `refs/`. Paths below are relative to each repo root.

| # | Repo | Status | What it really is |
|---|------|--------|-------------------|
| 1 | veznidav/alloc | cloned, commit eef5bbc | Single Next.js app. One SERV call per decision. No agent loop, no database, no tests. |
| 2 | daveaire/pond-agent | cloned, commit 6f3b2cc | 260-line Node CLI. SERV tool loop over local tools plus an MCP server. Read-only. |
| 3 | hummusonrails/robinhood-chain-dapp-example | cloned, commit 25335a8 | pnpm monorepo: Foundry contracts plus a Next.js walkthrough. Index baskets, no swaps. |
| 4 | nirholas/robinhood-chain-mcp | cloned, commit 6a17f72 | Thin wrapper. The swap logic is in the `hoodchain` npm SDK (repo nirholas/robinhood-chain-sdk), which I also cloned and read. |
| 5 | Hkshoonya/agentic-trader | cloned, commit 0b50913 | Python bot for the Robinhood brokerage, not the chain. Useful only for the promotion gate and journal. |
| 6 | aspekt19/AllowLatch | cloned, commit 16f2467 | TypeScript. SERV drafts a spending policy, deterministic engine judges each spend. Base chain, not 4663. |
| 7 | valory-xyz/connect PR #68 | MERGED, 5,431-line diff | Python skill. The most careful stock token swap path found. Uses Universal Router, not SwapRouter02. |

None were gone or private.

---

## 0. Live chain checks I ran (Saturday 2026-09-19, about 18:06 UTC, market closed)

These are read-only calls. All VERIFIED by direct observation.

| Check | Result |
|-------|--------|
| `eth_chainId` on `https://rpc.mainnet.chain.robinhood.com` | `0x1237` = 4663 |
| Code at SwapRouter02 `0xcaf6...5cb2` | 24,497 bytes. `factory()` returns `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA`, `WETH9()` returns `0x0Bd7...AD73` |
| `multicall(uint256 deadline, bytes[] data)` on SwapRouter02 | Exists. Future deadline with empty array returns `[]`. Deadline `1` reverts with `Transaction too old` |
| Code at QuoterV2 `0x33e8...a9e7` | 8,273 bytes |
| Two different Universal Routers | `0x8876789976DECBFcbBBe364623C63652dB8c0904` (alloc, valory) has code. `0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77` (hoodchain SDK) also has code. They are different deployments |
| QuoterV2, 1,000 USDG to NVDA | fee 100: `5004029845` wei (dust, the pool is nearly empty). fee 500: 4.4919 NVDA. fee 3000: 4.4819 NVDA. fee 10000: reverts with `Unexpected error` |
| NVDA `uiMultiplier()` | `1000775159164630595` (1.000775). `newUIMultiplier()` equal, `effectiveAt()` in the past |
| CRWD `uiMultiplier()` | `4000000000000000000` (4.0). CRWD has no Chainlink feed in the directory and no USDG v3 pool at 500 or 3000 |
| NVDA Chainlink feed `0x379E...9F15` | 8 decimals, description `RHNVDA / USD`, answer 222.447, `updatedAt` 22.2 hours old (Friday 19:55 UTC) |
| SGOV Chainlink feed | answer 101.108, `updatedAt` Saturday 00:01 UTC (Friday 8:01pm ET) |
| Chainlink directory entry for NVDA | heartbeat 86,400 s, deviation threshold 0.5%, market hours `us_equities_24/5`. 57 feeds total on the chain, 35 match a listed stock token |
| `GET https://api.robinhood.com/rhj/prices/NVDA` | Keyless. Returns `bid`, `ask`, `isTradingHalt`, `generatedAt` (current timestamp even on Saturday), `dailyTradingVolume` |
| `GET https://api.robinhood.com/rhj/assets` | 194 assets, all `ASSET_STATUS_ACTIVE`. Each has `currentMultiplier`, `pendingMultiplier`, and `tradingCapabilities` for `market`, `extended`, `overnight` sessions |

### The unit question, settled

SGOV has a multiplier of 1.0051, so it separates the two hypotheses cleanly.

- REST mid: 100.59
- REST mid times multiplier: 101.103
- Chainlink answer: 101.108

VERIFIED: the Chainlink feed prices ONE TOKEN, with the multiplier already applied. The Robinhood REST price is per SHARE of the underlying equity. To compare them you multiply the REST price by `uiMultiplier / 1e18`. Two repos say the same thing in comments (`contracts/src/BasketToken.sol:134` in the tutorial, `src/stocks.ts:35-38` and `:195-202` in the hoodchain SDK).

### What this means for an after-hours desk

- The Chainlink reference has a 0.5% dead band. Any "pool versus Chainlink" gap under 50 bps is noise by construction. VERIFIED from the directory entry.
- On a weekend the feed is frozen at the Friday 8pm ET value. Pools keep trading. A weekend premium is measured against a stale anchor. VERIFIED for this one Saturday.
- Whether the REST bid and ask move on weekends is UNVERIFIED. `generatedAt` is fresh but that may only be the response time.
- A fee-100 NVDA pool exists with almost no liquidity. Any "first pool that returns a quote" logic would route into it. Always pick by highest `amountOut` for the real size.

---

## A. SERV Reasoning call shape

Three repos call SERV. agentic-trader does not (its client defaults to `https://api.openai.com/v1`, `src/agentic_trading/llm/client.py:12`).

| | alloc | pond-agent | AllowLatch |
|---|---|---|---|
| File | `src/lib/serv.ts` | `src/index.js` | `src/llm/serv-reasoning.ts` |
| Base URL | `https://inference-api.openserv.ai/v1` (L8) | `.../v1/chat/completions` (L23) | same base (L17) |
| Client | `openai` ^7.19.0 with `baseURL` swap (L15) | raw `fetch` (L189) | `openai` ^7.15.0 (L108) |
| Model | `gpt-5.4-mini`, env override (L9) | `gpt-5.4-mini` (L24) | `gpt-5.4-mini` (L20). Drafting appends `-serv-multipath` (`src/llm/compile-mandate.ts:26-31`) |
| `reasoning_effort` | not sent | `'none'` (L197) | `'low'` default (L54), `'medium'` for drafting (`compile-mandate.ts:110`) |
| Structured output | `response_format: json_schema`, `strict: true` (L42-44, L89) | none, free text | `zodResponseFormat(schema, name)` (L206) |
| Temperature | 0.2 (L90) | not sent | not sent |
| Streaming | no | no | no |
| Timeout | none set, SDK default | `AbortSignal.timeout(120_000)` (L198) | none set, SDK default |
| Retries | none set, SDK default | none | none set, SDK default |
| Custom headers | none | none | none |
| Validation | `JSON.parse` then a TypeScript cast. No runtime check (L94-96). `zod` is installed and unused | none | `JSON.parse` then `schema.parse` (L230-237). Checks `finish_reason` for `length` and `content_filter`, and `refusal` (L213-221) |
| On failure | throws. Route returns HTTP 400 (`src/app/api/evaluate/route.ts:22-25`) or an SSE `error` event (`.../stream/route.ts:29-31`) | throws with status and first 1,200 chars of body (L200-203) | throws. UI has an offline regex compiler (`src/policy/local-compile.ts`) |

All rows VERIFIED in code. The SDK default timeout and retry values are UNVERIFIED (I did not read the SDK source).

### Exact tool objects

alloc, `src/lib/serv.ts:22`:

```ts
{ type: "function", function: { name: "serv_prompt_guard", parameters: { type: "object", properties: {} } } }
```

alloc shadow agent, `src/lib/serv.ts:25-37`. Parameters are passed as JSON Schema `default` values, not as call arguments:

```ts
{ type: "function", function: { name: "serv_shadow_agent", parameters: { type: "object", properties: {
  hint: { type: "string", default: "Check every number quoted in the explanation matches the supplied data, ..." },
  max_iterations: { type: "integer", default: 2 } } } } }
```

pond-agent (`src/index.js:141`) and AllowLatch (`serv-reasoning.ts:66-69`) send the guard with no `parameters` key at all: `{ type: 'function', function: { name: 'serv_prompt_guard' } }`. Both shapes appear in shipped code. Which one SERV prefers is UNVERIFIED.

AllowLatch uses `max_iterations` 3 for drafting and 2 for explaining (`compile-mandate.ts:114`, `explain-decision.ts:66`).

### alloc's shadow agent is off

VERIFIED: it only turns on when `SERV_SHADOW_AGENT === "1"` (`src/lib/serv.ts:24`). `.env.example` ships it as `0`. `SUBMISSION.md:56` lists it under "What we would turn on next". The competitor does not run it in production.

### The "tools need reasoning_effort none" gotcha: refined, not confirmed as stated

- VERIFIED as a code comment. pond-agent `src/index.js:195-197`: "Chat Completions accepts function tools with this model only when reasoning effort is disabled; SERV still applies its guard and shadow tools." pond-agent forwards real function tools (4 local plus about 105 from an MCP server, L212).
- VERIFIED counter-evidence in code. AllowLatch sends `serv_*` tools together with `reasoning_effort: 'low'` or `'medium'` and a `response_format` (`serv-reasoning.ts:199-208`). Its comment at L61 says SERV tools are intercepted and "never reach the model". alloc sends `serv_*` tools with no effort parameter at all.
- Conclusion: the limit applies to real function tools that reach the model. It does not apply to `serv_prompt_guard` and `serv_shadow_agent`. Our design is one structured call with no real tools, so the gotcha does not bind us. UNVERIFIED at runtime: I had no SERV key and did not send a request.
- Second gotcha, VERIFIED as a comment: "SERV rejects OpenAI's minimal; map to low" (`serv-reasoning.ts:55-56`). Valid values in that code are `none`, `low`, `medium`, `high`.

### BRAID cache and `x-openserv-disable-braid`

VERIFIED absent: a grep across all seven references finds no mention of `braid` or `x-openserv`. Nobody sets the header and nobody comments on cache stability.

Two repos are byte-stable by accident of good structure:

- alloc's system prompt is a template literal with zero interpolations (`src/lib/evaluate.ts:189-206`). The timestamp, preferences and all market data go in the user message (L208-226).
- AllowLatch keeps prompts as module constants with explicit version strings (`compile-mandate.ts:19-20`, `explain-decision.ts:19`) and logs the version with latency and token counts on every call (`serv-reasoning.ts:124-137`).

Copy both habits. Put the mandate in the user message, never in the system prompt.

---

## B. Decision schema and prompt design

### Best schema found: alloc `DECISION_SCHEMA` (`src/lib/serv.ts:42-66`)

```ts
{ name: "alloc_decision", strict: true, schema: { type: "object", additionalProperties: false,
  properties: {
    action: { type: "string", enum: ["HOLD", "MOVE_TO_STABLECOIN", "MOVE_TO_ROBINHOOD"] },
    target_symbol: { type: ["string", "null"] },
    allocation_pct: { type: "number" },
    expected_opportunity_pct: { type: ["number", "null"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    headline: { type: "string" },
    summary: { type: "string" },
    reasoning: { type: "array", items: { type: "string" } },
    why_not: { type: "array", items: { type: "object", additionalProperties: false,
      properties: { option: { type: "string" }, reason: { type: "string" } }, required: ["option", "reason"] } },
    warnings: { type: "array", items: { type: "string" } } },
  required: [ /* all ten */ ] } }
```

It captures rejected alternatives (`why_not`), confidence, and warnings. Nullable fields use type arrays, which strict mode requires.

### What is weak about it (all VERIFIED in code)

1. **No evidence field.** `reasoning` is free text told to "cite the supplied numbers". Nothing checks a cited number against the input.
2. **`why_not.option` is free text and drifts.** alloc needs a regex cleanup pass to turn "MOVE_TO_ROBINHOOD AI" back into "AI" (`src/lib/evaluate.ts:263-269`). An enum of candidate ids would remove the problem.
3. **`target_symbol` is a free string.** When it does not match a candidate, code silently converts the decision to HOLD (`evaluate.ts:273-275`). A model error becomes an invisible "wait".
4. **Confidence is decorative.** Three labels, no calibration, and no code path reads it except the UI (`evaluate.ts:297`).
5. **`expected_opportunity_pct` is an echo.** Prompt rule 2 tells the model to return the code's own score plus move cost (`evaluate.ts:195`). It carries no independent information.
6. **No partial-act or decline action.** Partial is implied by `allocation_pct`. There is no way to say "I refuse this mandate".
7. **The prompt forces trades.** For aggressive and degen profiles "HOLD is not an allowed outcome" (`evaluate.ts:197`). If the model still holds, code retries with a stronger instruction, then fabricates a deterministic proposal labelled `model + alloc-model` (`evaluate.ts:231-260`). This is the opposite of a desk where waiting is a valid answer.
8. **No input snapshot id or hash.** The decision id is `Date.now()` plus random characters (`evaluate.ts:281`). Nothing binds a decision to the data it saw.
9. **Rule list is misnumbered** 9, 11, 10 (`evaluate.ts:204-206`). Minor, but it is inside a prompt that is sent on every call.

### Prompt structure worth copying

- alloc: role, a "doing nothing is valid" paragraph, numbered hard rules, then a user message in labelled blocks (USER PREFERENCES, CURRENT POSITION, GENERAL MARKET CONDITIONS, ALTERNATIVES) (`evaluate.ts:189-226`).
- alloc computes a deterministic score per alternative first and hands it to the model as an anchor (`evaluate.ts:35-46`). The model adjusts, code clamps afterwards (`evaluate.ts:271-276`).
- AllowLatch states decision priorities in order: safety, fidelity, conservatism, clarity (`compile-mandate.ts:57`, `:65-69`).

### Best pattern for mandate intake: AllowLatch `PolicyDraftSchema` (`src/policy/schema.ts:111-122`)

`policy`, `conflicts[]`, `assumptions[]`, `questions[]`, `readyToApply`, `summary`. Code overrides the model: if any question remains, `readyToApply` is forced to false (`compile-mandate.ts:81-90`). This fits our "plain-language notes" field directly.

Its explain step is also clean: the verdict comes from code, and the prompt forbids the model from contradicting it (`src/llm/explain-decision.ts:29-39`).

---

## C. Swap execution on 4663

### Side by side

| | alloc v3 path | hoodchain SDK | valory PR #68 |
|---|---|---|---|
| File | `src/lib/execute.ts:40-49` | `src/swap.ts:237-387` | `connect/assets/skills/connect-stocktokens/scripts/swap.py`, `connect/assets/lib/uniswap.py` |
| Router | SwapRouter02 `0xcaf6...5cb2` | SwapRouter02, same address (`src/addresses.ts:28`) | Universal Router `0x8876...0904` only (`uniswap.py:64`) |
| Function | `exactInputSingle` called directly | `multicall(deadline, [exactInputSingle])` (`swap.ts:286-320`) | `execute(commands, inputs, deadline)`, command `0x00` for v3 |
| Approval | ERC-20 `approve` of the exact amount to the router, only if allowance is short (L41-44) | same (`swap.ts:331-353`) | ERC-20 approve to Permit2 for the exact amount, then a signed Permit2 permit folded into the swap |
| minOut | `quote * (10000 - 75) / 10000`, default 75 bps (L30, L38) | 50 bps default (`swap.ts:248-249`) | `quote * (1 - slippage)`, default 0.5%, hard cap 5% (`swap.py:49`, `:164`) |
| Deadline | **none on the v3 path** | now + 600 s via multicall (`swap.ts:250`) | now + 600 s + 300 s per preceding call (`swap.py:48-51`, `:170`) |
| Quoter | QuoterV2 `quoteExactInputSingle` via `simulateContract`, all four tiers | same, plus two-hop routes through WETH and USDG (`swap.ts:135-152`) | same, plus v2 and hook-less v4 |
| Fee tier choice | highest `amountOut`, then cached for one hour (`src/lib/robinhood.ts:113`, `:134-145`) | highest `amountOut` every time (`swap.ts:187-189`) | highest `amountOut`, discovery cached one hour, quote always fresh |
| Reference check | none before execution | none | refuses if pool is more than 150 bps from Robinhood REST price in either direction, warns above 50 (`stocktokens.py:53-54`, `:257-276`) |
| Halt flag | not checked (grep finds no "halt" in `src/`) | not checked | REST `isTradingHalt`, refuses if true, missing, or not a boolean (`stocktokens.py:214-219`) |
| uiMultiplier | read from the registry into a type and never used again (`robinhood.ts:75` is the only use) | used for share-equivalent display only (`src/stocks.ts:283`) | read on chain at trade time, refuses if zero, multiplies the REST price (`stocktokens.py:93-103`, `:203-228`) |
| Chainlink staleness | ignored. Reads `round[1]` only (`robinhood.ts:93-95`) | 72 h default window, throws `StaleFeedError` (`src/stocks.ts:8-16`, `:95-100`) | Chainlink not used |

All VERIFIED in code.

### Findings that change our design

1. **Wrap SwapRouter02 calls in `multicall(uint256,bytes[])` for a deadline.** VERIFIED live that the function exists on 4663 and enforces `Transaction too old`. alloc skips it and has no deadline on its v3 path. With 100 ms blocks this matters less for MEV and more for a stuck agent transaction landing hours later.
2. **Almost everything trades on v3.** alloc's universe scan, dated today, found 98 routable tokens: 46 at fee 3000, 39 at fee 10000, 11 at fee 500, 2 on v4 (`src/data/robinhood-universe.json`). The deep names (NVDA, SPY, QQQ, GOOGL, SGOV) are fee 500. SwapRouter02 is the right router. UNVERIFIED: I did not re-run their scan.
3. **Liquidity is thin outside the top names.** Same file: 47 of 98 pools have under 100k USD of DexScreener liquidity. Only 30 of 98 matched a Chainlink feed by alloc's regex. A desk that needs both a feed and depth has a universe of roughly 20 to 30 tickers. UNVERIFIED beyond that file.
4. **The floor must come from the quote, the gap check from the reference.** valory `SKILL.md`: taking minOut from the reference "would hand back the difference whenever the pool prices better". A pool far better than the reference is "a broken reading, not a bargain" and is refused (`stocktokens.py:271-275`).
5. **The halt flag is off chain.** It is `isTradingHalt` on the keyless REST endpoint. No repo found an on-chain halt signal. Treat the REST API as a required dependency with fail-closed handling.
6. **Corporate actions show up in three places.** On chain: `uiMultiplier()`, `newUIMultiplier()`, `effectiveAt()` (`contracts/src/interfaces/IScaledUIAmount.sol:8-20` in the tutorial, verified selector by selector against mainnet TSLA per `apps/frontend/src/app/learn/page.tsx:135-145`). Off chain: `currentMultiplier` and `pendingMultiplier` in the registry. valory surfaces `pending_multiplier` on every plan. Multipliers are not cosmetic: CRWD is 4.0.
7. **Chain traps named in the PR.** Universal Router inputs carry an undocumented `uint256[] minHopPriceX36`; omit it and the call reverts with `SliceOutOfBounds()` (`uniswap.py:22-23`, `:110`). alloc hit the same thing on v4 (`src/lib/execute.ts:11-15`). This does not affect SwapRouter02. The sequencer can reject a destination with "Transaction rejected by chain policy", no hash, nonce untouched. The public RPC rate-limits hard. alloc disables JSON-RPC batching for this RPC only (`src/lib/chains.ts:59`), reason UNVERIFIED.
8. **Send one call, wait for the receipt, check `status`, then send the next.** valory `send_calls` does this and reports exactly which calls landed (`swap.py:287`). A reverted swap has a hash like any other.
9. **Decode and re-check calldata before signing.** valory decodes its own `execute()` calldata and compares token, recipient, amount, floor, deadline and pool to the plan (`uniswap.py:639`, `verify_execute`). AllowLatch binds the policy verdict to a `calldataHash` (`src/policy/engine.ts:195-200`). Same idea, and it fits our on-chain decision hash.
10. **Testnet is a different router.** Testnet 46630 has no official Uniswap. The community deployment uses the classic SwapRouter with the deadline inside the struct (`hoodchain src/addresses.ts:37-60`). Chainlink feeds do not exist on testnet (tutorial `contracts/script/Deploy.s.sol:69-76`). Test against a mainnet fork, not testnet. The hoodchain live swap test runs on testnet only (`tests/trading-swap.live.test.ts` in the MCP repo), so its mainnet multicall path was never exercised by that repo.
11. **Decimals.** USDG is 6 everywhere (hardcoded in alloc `execute.ts:32`, constant in hoodchain `addresses.ts:97`). Stock tokens are 18 (tutorial fork test asserts it, `contracts/test/fork/BasketMainnetFork.t.sol:47`). alloc parses amounts through `Number(x).toFixed(6)` (`execute.ts:32`), which is float math on money. Use `parseUnits` on strings.
12. **Eligibility.** Stock tokens are not offered to US, UK, Canadian or Swiss persons, enforced in Robinhood's app and not in the contract. hoodchain throws unless an explicit flag is set (`swap.ts:241-243`). valory asks the operator once and records the answer. Worth one line in our onboarding.

### Spend cap design in the MCP repo (`src/shared/trading-env.ts`, `src/register-trading.ts`)

- Per-call and per-session USD caps. Assert before signing (L72-91), record only after settlement (L94-96, `register-trading.ts:296`).
- An input that cannot be valued in USDG is refused on mainnet rather than counted as zero (`register-trading.ts:243-255`).
- Two-step confirm: first call returns a simulation, second call with `confirm: true` broadcasts (`register-trading.ts:279-289`).
- Weakness: the ledger is a number in process memory. A restart resets it, and the error text says so (L88). Ours must live in Postgres and, for the hard limit, on chain.

---

## D. viem and wagmi chain config for 4663

- VERIFIED: `viem/chains` exports `robinhood` (id 4663) and `robinhoodTestnet` (id 46630). Present in published viem 2.56.8 (`chains/index.ts:534-535`). Added 2026-07-08 in viem PR #4818. The definition includes `blockTime: 100`, Blockscout with `apiUrl`, and `multicall3` at `0xca11bde05977b3631167028862be2a173976ca11` (code confirmed live).
- VERIFIED: since 2026-09-16 the viem definition lists a third-party RPC, `https://rpc.ordofi.network`, as the second HTTP URL and the only WebSocket URL. Pass the official RPC URL explicitly to `http()`.
- VERIFIED: no reference repo uses the viem export. alloc defines the chain by hand with `defineChain` (`src/lib/chains.ts:5-11`) and so does the tutorial (`apps/frontend/src/config/chains.ts:4-17`). Both hand definitions omit `multicall3`, so `multicall` batching is off for them.
- Wallet kit: none. Both use bare wagmi with `connectors: [injected()]` (alloc `src/lib/wagmi.ts:8`, tutorial `apps/frontend/src/config/wagmi.ts:17`). No RainbowKit, ConnectKit, or Reown. alloc is on wagmi 2, the tutorial on wagmi ^3.6.21.
- alloc uses `fallback` over three RPCs with `retryCount: 1` and a 12 s timeout (`src/lib/chains.ts:25`, `:59`): the official one, `robinhood-rpc.publicnode.com`, and `robinhood.rpc.blxrbdn.com`.
- The tutorial's `NetworkGuard` blocks writes until the wallet chain matches (`apps/frontend/src/components/network-guard.tsx:7-16`). Small and worth copying.

Recommendation: `import { robinhood } from "viem/chains"` and override the transport URL.

---

## E. Project structure

### alloc

```
src/app/            pages: /, /market, /playground, /real, /history, /settings
src/app/api/        12 route handlers (evaluate, evaluate/stream, execute/plan, execute/leg2, ...)
src/components/     React, includes ExecutionPanel.tsx and WatchToggle.tsx
src/lib/            serv.ts, evaluate.ts, robinhood.ts, execute.ts, relay.ts, chains.ts, cache.ts, quota.ts
src/store/          useAlloc.ts (zustand + persist)
src/data/           robinhood-universe.json (scan output, committed)
scripts/            scan-universe.ts
```

- Single package, not a monorepo. 82 tracked files, about 1,900 lines in `lib` and `api`.
- **No agent loop.** "Watching" is a `setInterval` in the browser, every 15 minutes while the tab is open (`src/components/WatchToggle.tsx:4-20`). Nothing runs server side on a schedule.
- **No database.** History is zustand `persist` in localStorage, capped at 200 decisions (`src/store/useAlloc.ts:29`, `:47`). Server cache is an in-process `Map` (`src/lib/cache.ts:2`).
- **No tests.** No test files, no test script in `package.json`.
- **No autonomous execution.** The server builds unsigned transactions and the browser wallet signs each one (`src/components/ExecutionPanel.tsx:71-104`). `SUBMISSION.md` calls autonomous mode a next step.
- **Nothing on chain.** No contracts, no decision hashing.
- Web and "agent" share code trivially because the agent is just `src/lib` called from route handlers.
- Good details: SSE progress stream with a 10 s keepalive (`src/app/api/evaluate/stream/route.ts:18-36`), signed-cookie quota with no database (`src/lib/quota.ts`), preflight that checks gas on 4663 and quotes a top-up (`src/app/api/execute/plan/route.ts:23-43`).

Our scheduled agent, Postgres log, policy gate, vault and on-chain hash are all things alloc does not have.

### hummusonrails tutorial

```
apps/frontend/      Next.js 16, wagmi 3, viem 2.54; src/abi, src/config, src/hooks, src/components
contracts/          Foundry: src, test, test/fork, script; OZ and forge-std as git submodules
scripts/            deploy.sh, smoke.sh, extract-snippets.mjs
pnpm-workspace.yaml packages: apps/*
```

- pnpm workspace with one package. `contracts/` is outside the workspace and driven by root scripts (`package.json`, `build:contracts`, `test:contracts`, `test:fork`).
- Contracts and frontend share nothing through packages. ABIs are hand-written TypeScript in `apps/frontend/src/abi/`. `scripts/deploy.sh` parses addresses out of forge output and writes `apps/frontend/.env.local`.
- Foundry: solc 0.8.28, `evm_version = "cancun"`, fuzz runs 256 (`contracts/foundry.toml:11-20`). OZ 5 via remapping.
- Deploy uses `--slow` and `--gas-estimate-multiplier 300` because the L1 data fee moves between estimate and execution (`scripts/deploy.sh:80-89`). Verification is Blockscout (`--verifier blockscout`, URL `https://robinhoodchain.blockscout.com/api/`).
- One deploy script switches on `block.chainid` for mainnet, testnet and anvil (`contracts/script/Deploy.s.sol`).
- Tests: Foundry unit tests plus a mainnet fork suite that runs on a weekly cron and manual dispatch only, because "public rpc calls are too flaky to gate prs on" (`.github/workflows/ci.yml:6-10`, `:42-45`). Foundry pinned to v1.0.0 in CI. No frontend tests. No database. No agent.
- Oracle handling to copy: constructor rejects feeds that are not 8 decimals (`contracts/src/BasketToken.sol:70-73`), `_readPrice` rejects non-positive answers and stale rounds (`:164-169`), and staleness is 4 days to survive a long weekend (`contracts/script/Deploy.s.sol:37-38`).

For a TypeScript agent plus web app, neither repo shows a shared package. We will need our own `packages/` for chain reads, schema and policy.

---

## F. Shadow mode and evidence gate in agentic-trader

This is a brokerage bot, so only the gate design transfers. All in `src/agentic_trading/`.

**Stages** (`promotion.py:28`): `shadow` (simulated, default), `probation` (live with a 1% per-order cap, `:60`), `live`.

**Promotion rule** (`promotion.py:51-65`, `:443-485`). An assessment is eligible only when every check passes:

| Check | Default |
|-------|---------|
| Out-of-sample trades | at least 30 |
| Expectancy after costs | at least 1 bp |
| Profitable folds | at least 60% |
| Max drawdown | at most 15% |
| Bootstrap p-value | at most 0.05, divided by the number of strategies tried (Bonferroni, `:347-366`) |
| Evidence age | at most 30 days (`:137`, `:175-181`) |
| Live size | must not exceed the size the evidence supports (`:227-246`) |

Three consecutive eligible assessments move up one stage, then the streak resets to zero (`:462-479`). One failed assessment resets the streak and journals the reasons (`:452-461`).

**Details worth stealing**

- Re-running the same evidence cannot advance the streak. Each assessment carries a `report_key` built from its numbers, and the runtime skips an unchanged key (`promotion.py:276-289`, `runtime.py:3046`).
- Every failure is a human sentence in `reasons[]`. An operator override becomes a `note` that is shown on every assessment and never a silent pass (`promotion.py:234-246`).
- Demotion is immediate and goes straight to shadow: kill switch, a broker error streak, or a 5% drawdown since entering the stage (`promotion.py:496-540`).
- Promotion alone does not flip live trading. Without `autonomy = "auto"` and an environment switch, the runtime only journals `promotion_requires_consent` (`runtime.py:2887-2895`). Arming needs a typed `ARM` confirmation from loopback, a non-shadow stage, an eligible last assessment and fresh evidence (`arming.py:1-20`, `:57-80`).
- Confidence is a 0 to 1 score with six weighted, separately reported parts, so any change in risk traces to the number that moved it (`promotion.py:41-48`, `:102-134`).

**Storage**

- `promotion.json`: stage, streak, `stage_since`, `stage_equity`, `last_assessment`, last 50 assessments. Written atomically because the daemon reads while a worker writes (`promotion.py:543-573`).
- Decision journal: one JSONL file per day, append only, file mode 0600, UTC timestamp on every record, idempotency through `has_decision(decision_id)` (`journal.py:17-45`). Advisor records store what the model was shown, "so its verdict is auditable rather than only quotable" (`runtime.py:1604-1614`).

**Display**: a local dashboard reads the same files and shows stage, streak against required cycles, the last assessment and shadow profit and loss (`dashboard.py:50-52`, `:825`, `:940-945`).

**Fit for us.** Their statistics need dozens of trades and will not pass inside a hackathon window. Keep the shape and drop the statistics: three stages, an all-checks-must-pass rule with readable reasons, a streak that only advances on new evidence, instant demotion, and a human arm step. A sensible shadow rule for the desk is a count of decisions where the policy gate agreed, the quote was fillable, and the realised shadow fill stayed inside the floor.

---

## G. Verdict

### Copy this idea

| Idea | Source |
|------|--------|
| Static system prompt, all variable data in the user message | alloc `src/lib/evaluate.ts:189-226` |
| Prompt version constants, logged with latency, tokens and finish reason on every call | AllowLatch `src/llm/serv-reasoning.ts:124-137`, `src/llm/compile-mandate.ts:19-20` |
| Validate the response with Zod and check `finish_reason` and `refusal` before parsing | AllowLatch `src/llm/serv-reasoning.ts:210-237` |
| `why_not[]` for rejected alternatives, but make `option` an enum of candidate ids | alloc `src/lib/serv.ts:57-61` |
| Mandate intake as policy plus conflicts, assumptions, questions and a code-forced `readyToApply` | AllowLatch `src/policy/schema.ts:111-122`, `src/llm/compile-mandate.ts:81-90` |
| Model explains a verdict that code produced, and is forbidden from changing it | AllowLatch `src/llm/explain-decision.ts:29-39` |
| Deterministic gate returning allow, deny or escalate with a reasons array, rolling day and hour ledger, emergency stop first | AllowLatch `src/policy/engine.ts:51-77`, `:207-237` |
| Bind the approved decision to a hash of the exact calldata | AllowLatch `src/policy/engine.ts:195-200`, valory `uniswap.py:639` |
| SwapRouter02 through `multicall(deadline, [exactInputSingle])` | hoodchain `src/swap.ts:286-320`, confirmed live |
| Quote every fee tier for the real size and take the highest `amountOut` | hoodchain `src/swap.ts:135-189` |
| Floor from the quote, two-sided gap refusal from the reference, fail closed on a missing halt flag or multiplier | valory `stocktokens.py:203-276`, `swap.py:163-164` |
| Send, wait for receipt, check status, then send the next call | valory `swap.py:287` |
| Assert the cap before signing, record the spend only after settlement, refuse inputs that cannot be valued | MCP repo `src/shared/trading-env.ts:72-96`, `src/register-trading.ts:243-255` |
| Oracle guards: 8 decimals enforced, positive answer, staleness sized for weekends | tutorial `contracts/src/BasketToken.sol:70-73`, `:164-169` |
| Fork tests on a schedule, not on every pull request. `--slow` and gas multiplier 300 on deploy | tutorial `.github/workflows/ci.yml:42-45`, `scripts/deploy.sh:80-89` |
| Three stages, streak on new evidence only, instant demotion, human arm step | agentic-trader `promotion.py:443-540`, `runtime.py:3046`, `arming.py:1-20` |
| Append-only journal that stores what the model was shown | agentic-trader `journal.py:17-31`, `runtime.py:1604-1614` |
| SSE progress events with a keepalive while the decision runs | alloc `src/app/api/evaluate/stream/route.ts:18-36` |
| `import { robinhood } from "viem/chains"` with an explicit official RPC URL | viem 2.56.8 `chains/index.ts:534` |

### Avoid this mistake

| Mistake | Source |
|---------|--------|
| Casting the model output to a TypeScript type with no runtime validation | alloc `src/lib/serv.ts:94-96` |
| A prompt that bans "hold", then a code path that fabricates a trade when the model still holds | alloc `src/lib/evaluate.ts:197`, `:231-260` |
| Silently turning an unknown target into HOLD, which hides model errors | alloc `src/lib/evaluate.ts:273-275` |
| No deadline on the v3 swap | alloc `src/lib/execute.ts:45-48` |
| Reading a Chainlink answer without checking `updatedAt` | alloc `src/lib/robinhood.ts:93-95` |
| Fetching the multiplier and never using it, and never checking the halt flag | alloc `src/lib/robinhood.ts:75` |
| Caching the winning pool for an hour and skipping the comparison while it still quotes | alloc `src/lib/robinhood.ts:134-137` |
| Float math on token amounts | alloc `src/lib/execute.ts:32` |
| Unlimited `approve` to Permit2 | alloc `src/lib/execute.ts:53` |
| Browser-tab `setInterval` presented as monitoring | alloc `src/components/WatchToggle.tsx:13-20` |
| Spend ledger held in process memory | MCP repo `src/shared/trading-env.ts:51-52`, `:88` |
| Policy checks that pass when the agent omits the field, such as `slippageBps` | AllowLatch `src/policy/engine.ts:183-188` |
| Trusting a self-reported `amountUsd` from the agent being judged | AllowLatch `src/policy/schema.ts:61` |
| Hand-defining the chain and losing `multicall3` | alloc `src/lib/chains.ts:5-11` |
| Treating a Chainlink gap under 50 bps as signal, or a weekend gap as live | directory entry for NVDA: deviation 0.5%, hours 24/5 |
| Planning to test swaps on testnet | hoodchain `src/addresses.ts:37-60`: different router, no official Uniswap, no feeds |
| Advertising a feature that is off by default | alloc `src/lib/serv.ts:24`, `SUBMISSION.md:56` |

### Open items I could not verify

- Any SERV runtime behaviour: strict schema plus `serv_*` tools plus a non-`none` effort in one request, the preferred guard tool shape, SDK default timeout and retries, BRAID cache rules. One authenticated test call settles all of these.
- Whether the Robinhood REST bid and ask move on weekends and overnight.
- A real mainnet `exactInputSingle` through SwapRouter02 for a stock token. Every piece checks out separately, but no reference repo shows a mainnet transaction hash, and I did not send one.
- Why alloc disables JSON-RPC batching for the 4663 RPC.
