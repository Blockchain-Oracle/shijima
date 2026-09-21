# SERV Hackathon Edition 01 + Robinhood Chain: research and direction (2026-09-19)

Three parallel research passes (OpenServ platform, Robinhood surface, recent hackathon winners),
consolidated. Facts marked "verified" were checked live against RPCs/APIs on 2026-09-19.

## 1. The hackathon itself

- Edition 01, online, 14–28 Sep 2026. Submissions close **2026-09-28 00:00 UTC**.
- Prizes: $1,000 in SERV token per track (4 tracks) + $1,000 USDC best overall. $5,000 total.
- Judged on **creativity, user-readiness, revenue potential**. No published weighting.
- Requirement: "an agent, a workflow, or a product that leverages SERV Reasoning". New, working, demoable.
- Eligibility: enable data collection at https://console.openserv.ai/settings/organization
- Submission: public X post tagging @openservai (name, concept, images, GitHub/demo links), then
  https://form.typeform.com/to/GyPxGqRn . Pre-register: https://form.typeform.com/to/A475N331
- Telegram: https://t.me/openservai . Finalists demo in a live-streamed event in early October.
- 2025 OpenServ hackathon rubric (HackerEarth): Integration 5, Functionality 20, Impact 25,
  Creativity 25, Documentation 10, Presentation/video 15. They rewarded on-chain execution and
  polished external web apps. Video demo was scored.

## 2. What SERV Reasoning actually is

An OpenAI/Anthropic wire-compatible **inference API**. Not an agent framework.

- Base URL `https://inference-api.openserv.ai`, key from `https://console.openserv.ai`, env `SERV_API_KEY`.
- `POST /v1/chat/completions` (OpenAI shape, all models), `/v1/responses` (OpenAI only), `/v1/messages` (Anthropic).
- Mechanism (BRAID, arXiv:2512.15959): on cache miss, a generator turns your **system prompt** into a
  Mermaid reasoning graph; that graph is prepended to the solver model. Cached 30 days per org, keyed
  on the exact system prompt string. Keep the system prompt stable; put variable data in user messages.
- System prompt is required (400 otherwise). OpenAI SDK baseURL includes `/v1`; Anthropic SDK baseURL
  must NOT include `/v1` and uses `authToken`. `reasoning_effort`: none|low|medium|high.
- SERV extras toggled via specially named tools: `serv_prompt_guard` (injection judge),
  `serv_shadow_agent` (validate-and-revise loop, params `hint`, `max_iterations` 1–10; non-streaming only),
  `serv_disable_content_filter`. Model suffixes `-serv-kronos`, `-serv-multipath`, `-serv-kronos-multipath`.
- Header `x-openserv-disable-braid: true` = Raw mode. **Demo lever: same model, same prompt, Raw vs SERV.**
- Structured outputs: standard `response_format: { type: "json_schema", strict: true }`.
- Pricing per 1M in/out: gpt-5.4-nano $0.25/$1.60; gpt-5.4-mini $1/$6; claude-haiku-4.5 $1.25/$6.50;
  claude-sonnet-5 $2.60/$13; gpt-5.4 $3.25/$20. Catalog churns; gpt-5.4-mini/nano stable since June.
- **Gotcha (from Pond Agent source, unverified):** function tools on gpt-5.4-mini may require
  `reasoning_effort: "none"`. Test on day 1 before designing a tool loop.
- Minimal call:
  ```ts
  import OpenAI from "openai";
  const client = new OpenAI({ baseURL: "https://inference-api.openserv.ai/v1", apiKey: process.env.SERV_API_KEY });
  const r = await client.chat.completions.create({
    model: "gpt-5.4-mini", reasoning_effort: "low",
    messages: [{ role: "system", content: "..." }, { role: "user", content: "..." }],
    response_format: { type: "json_schema", json_schema: { name: "decision", strict: true, schema: {...} } },
    tools: [{ type: "function", function: { name: "serv_prompt_guard" } }],
  });
  ```
- Docs: https://docs.openserv.ai/llms-full.txt (366 KB, everything). Raw copies saved in the session
  scratchpad by the research agent.

### The OpenServ agent platform is a separate product (optional)

`platform.openserv.ai`, `@openserv-labs/sdk` v2.4.1 + `@openserv-labs/client` v2.5.3, separate keys
(`OPENSERV_API_KEY`, `OPENSERV_USER_API_KEY`/`WALLET_PRIVATE_KEY`). Agents run locally via a tunnel
(`run(agent)`), register with `provision()`, get triggered by webhook/cron/x402/Telegram. Custom UI
talks to it only via webhook triggers. **Not required for the hackathon.** Every visible submission
calls `inference-api.openserv.ai` directly from its own app. Optional revenue story: register a thin
platform agent with an x402 trigger (USDC on Base). Repos: github.com/openserv-labs/{sdk,client,mcp-proxy,skills}.
No Robinhood / Coinbase / IXS tooling anywhere in OpenServ's docs or repos.

## 3. Robinhood surface (as of 2026-09-19)

### Robinhood Chain: LIVE mainnet (2026-07-01), LIVE testnet (2026-02-10). Permissionless.

Arbitrum Orbit/Nitro L2, settles to Ethereum, ETH gas (~0.065 gwei, verified), ~100 ms blocks,
FCFS sequencing, sequencer-level sanctions screening.

| | Mainnet | Testnet |
|---|---|---|
| Chain ID | 4663 (0x1237, verified) | 46630 (0xb626, verified) |
| RPC | https://rpc.mainnet.chain.robinhood.com (rate-limited) | https://rpc.testnet.chain.robinhood.com |
| Alchemy | https://robinhood-mainnet.g.alchemy.com/v2/{KEY} | https://robinhood-testnet.g.alchemy.com/v2/{KEY} |
| Explorer | https://robinhoodchain.blockscout.com (API behind Cloudflare for curl) | https://explorer.testnet.chain.robinhood.com |
| Faucet | none | https://faucet.testnet.chain.robinhood.com : 0.01 ETH + 5 each TSLA/AMZN/PLTR/NFLX/AMD per 24h |

viem ships `robinhoodMainnet`. Bridge in seconds via Relay: https://relay.link/bridge/robinhood .
Canonical bridge: https://portal.arbitrum.io/bridge?destinationChain=robinhood-chain (7-day withdraw).
Deploy with Foundry/Hardhat; verify `--verifier blockscout --verifier-url https://robinhoodchain.blockscout.com/api/`.
ERC-4337 EntryPoints v0.6/0.7/0.8, EIP-7702, Alchemy Gas Manager / ZeroDev sponsorship, Privy/Dynamic embedded wallets.
Docs: https://docs.robinhood.com/chain/{connecting,contracts,stock-tokens,stock-token-apis,oracles-and-price-feeds,bridging,account-abstraction,deploy-smart-contracts}
Dev contact: chain-developers-group@robinhood.com

**Assets (mainnet):**
- 194 Stock Tokens / ETFs (verified via API). Plain ERC-20, 18 decimals, plus ERC-8056 `uiMultiplier()`
  for splits/dividends (balances never change; multiplier does). `oraclePaused()` during corporate actions.
  - NVDA 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC (verified symbol)
  - AAPL 0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9
  - TSLA 0x322F0929c4625eD5bAd873c95208D54E1c003b2d
  - MSFT 0xe93237C50D904957Cf27E7B1133b510C669c2e74
  - SPY  0x117cc2133c37B721F49dE2A7a74833232B3B4C0C
  - QQQ  0xD5f3879160bc7c32ebb4dC785F8a4F505888de68
  - SPCX (SpaceX Class A, private co.) 0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa ; also CBRS (Cerebras), XNDU (Xanadu)
- USDG (Paxos, **6 decimals**, verified) 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 ; WETH 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73 ; Permit2 canonical.
- Legal: Stock Tokens are debt securities from Robinhood Assets (Jersey) Ltd. **Not offered to US persons; restricted UK, Canada, Switzerland.** Restriction is front-end/legal, not on-chain (tokens freely transferable). Mint/burn only by Authorised Participants (BBVI), Mon 02:00 CET to Sat 02:00 CET. Sequencer drops sanctioned addresses.
- Testnet tokens: TSLA 0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E, AMZN 0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02, NFLX 0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93, PLTR 0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0, AMD 0x71178BAc73cBeb415514eB542a8995b82669778d, WETH 0x7943e237c7F95DA44E0301572D358911207852Fa, USDC 0xbf4479C07Dc6fdc6dAa764A0ccA06969e894275F.

**Free REST API (no key, 60 req/s):**
- GET https://api.robinhood.com/rhj/assets (registry, addresses, currentMultiplier, tradingCapabilities, status)
- GET https://api.robinhood.com/rhj/prices/{symbol} (bid/ask, halt flag; verified NVDA 222.48/223.00)
- GET https://api.robinhood.com/rhj/corporate-actions

**Oracles:** Chainlink AggregatorV3 per token, multiplier-adjusted, **24/5 with no heartbeat off-hours**
(stale by design over weekends; use multi-day staleness window). Sequencer uptime feed. Data Streams
verifier 0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7. Feed list:
https://docs.chain.link/data-feeds/price-feeds/addresses?network=robinhood ; JSON mirror
https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json ; USDG/USD 0x61B7e5650328764B076A108EFF5fa7282a1B9aD2.

**DeFi live:**
- Uniswap v3: SwapRouter02 0xcaf681a66d020601342297493863e78c959e5cb2, QuoterV2 0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7, Factory 0x1f7d7550b1b028f7571e69a784071f0205fd2efa. NVDA/USDG 0.05% pool confirmed.
- Uniswap v4: PoolManager 0x8366a39cc670b4001a1121b8f6a443a643e40951, V4Quoter 0x8dc178efb8111bb0973dd9d722ebeff267c98f94, StateView 0xf3334192d15450cdd385c8b70e03f9a6bd9e673b, UniversalRouter 0x8876789976decbfcbbbe364623c63652db8c0904.
  **GOTCHA:** UniversalRouter is a modified fork; v4 swap input carries an extra `uint256[] minHopPriceX36` between `path` and `amountIn`. Stock Uniswap SDK calldata reverts `SliceOutOfBounds()`. Reference: https://github.com/valory-xyz/connect/pull/68 . **Use v3 SwapRouter02 or 0x Swap API.**
- 0x Swap API with RFQ for stock tokens vs USDG (free key): https://0x.org/post/robinhood-chain
- Morpho: Robinhood Earn USDG vault (~$932M, ~7%, Steakhouse-curated; permissionless on chain). Vault address: TODO find. https://morpho.org/blog/robinhood-chooses-morpho-to-power-new-earn-product
- Lighter perps "Robinhood Chain Domain" https://api.rh.lighter.xyz/ ; Rialto propAMM; 1inch; Arcus; Bags.
- Market data: DexScreener slug `robinhood` (https://api.dexscreener.com/tokens/v1/robinhood/<addrs>), GeckoTerminal.

**Useful repos (ignore the star-farmed bot/sniper repos flooding GitHub search):**
- hummusonrails/robinhood-chain-dapp-example (Arbitrum Foundation tutorial: Foundry + OZ5 + Chainlink + Next.js/wagmi/viem; BasketFactory live at 0xC1940D5fd58ce735A44a53f910852B12250F6a14)
- valory-xyz/connect PR #68 (most complete documented swap path)
- ExpertVagabond/robinhood-chain-mcp = npm `@purplesquirrel/robinhood-chain-mcp` (105 read/build tools, never signs)
- arambarnett/robinhood-chain-mcp (tracking error vs Chainlink in bps, heat score)
- nirholas/robinhood-chain-mcp "hood-mcp" (9 reads + 4 spend-capped v3 trades)
- kinexbtdev/rh-stock-token-kit, mkrz-x/robinhood-chain-kit, adrydevel/awesome-robinhood-chain
- veznidav/alloc (competitor, see below)

### Robinhood MCP (brokerage): LIVE, official, **US-only**

`https://agent.robinhood.com/mcp/trading` (Streamable HTTP, OAuth 2.1 + dynamic client registration + PKCE).
Equities May 27 2026; options + crypto Jul 20 2026. ~80 tools (portfolio, quotes, fundamentals, SEC facts,
politician trades, equity/options/crypto order preview/place/cancel, watchlists, alerts, scans, OCO, PnL).
No transfers, no staking, no event contracts (roadmap). Needs a US individual brokerage account, a dedicated
funded "Agentic" account, desktop setup, push per trade. **No paper mode. OAuth callback only completes on
localhost** (nexustrade review, Jul 2026). Tool snapshot:
https://github.com/masterledgerlive/robinhood-agent-plugin/blob/main/docs/examples/LIVE_TOOLS_SNAPSHOT.md
Mock for demos if non-US: naga-k/mock-rh-mcp (mirrors equity tool names on yfinance).

### Robinhood Crypto Trading API: LIVE, **US-only**
https://docs.robinhood.com/crypto/trading/ . Ed25519-signed REST at https://trading.robinhood.com .
No sandbox. Crypto only. Community: nirholas/robinhood-mcp (73 tools), dain-protocol/robinhood-crypto-api.

### Prediction markets: **no API.** Routed to Kalshi/ForecastEx/Rothera/OG.com. Kalshi's own API + demo env
(https://docs.kalshi.com) is the substitute, KYC + country list applies.

### Bitstamp by Robinhood: full API + sandbox, ~100 countries. Viable non-US CEX path if ever needed.

## 4. What wins agent hackathons (Mar–Sep 2026)

Full winner tables are in the winners agent report; the distilled patterns:

**Keeps winning:** guardrails as the product (LLM proposes, deterministic policy gates, chain executes);
verifiable track record (commit strategy/reasoning hash, journal, attest); agents competing for capital
(AlphaGrid $10K+$5K, Tilt $15K+$100K, Bond.Credit $50K on Robinhood Chain rounds); agent-to-agent money a
human can watch; prediction markets as structured products or oracles, not bets; boring TradFi workflow
with invisible chain; privacy for trading agents; discipline over intelligence with public evidence; real
tx hashes or nothing.

**Judges are tired of:** generic LLM+RSI trading bot (317 at BNB Hack); chat-with-your-wallet /
natural-language swap; x402 pay-per-call wrappers; cross-chain swap clones; ERC-8004 explorer number N;
"agents hire agents" marketplace number six; multi-LLM bull/bear councils; pure autonomy with no kill
switch; deck-only agentic economies with no tx hash.

**Gaps on Robinhood Chain nobody has used:**
1. Reasoning trail (thesis, evidence, rejected alternatives, confidence, risk budget) hashed on-chain next to the fill. Alloc shows reasons in a UI only.
2. Compliance-aware execution: eligibility, disclosures, trading windows, corporate-action math (Coinfello showed agents route around the geo-block; Robinhood cannot ignore this).
3. Tracking error / premium-discount vs Chainlink feed (AP-only mint/burn means it persists).
4. **24/7 on-chain trading vs closed equity markets.** Chainlink goes stale by design over weekends; on-chain price vs Friday close is a live, unique signal. Untouched.
5. Corporate actions via `uiMultiplier()`: most agents will silently misprice a split.
6. Shadow mode and an evidence gate before live (earn the right to trade).
7. Portfolio-level reasoning + idle USDG in Morpho at ~7%.
8. A fee line that is not a token (bps on execution, carry, AUM fee, subscription).

**Robinhood Chain winners so far:** AlphaGrid (prop-firm for agents), Tilt (asset-management layer, 2/20),
Bond.Credit (credit score for agents), Agama (stock tokens as collateral), EqualIndex (stock baskets),
ReineiraOS (agents post capital against limits). Only ~6 agent projects have won on the chain. Window is open.

## 5. Competitors already visible in this SERV track (as of 2026-09-18)

- veznidav/alloc: hold / USDC / Robinhood stock token allocator; SERV strict JSON + prompt guard + shadow; Relay + Uniswap v4; Next.js 16 + wagmi.
- daveaire/pond-agent: read-only cross-chain arb evidence; SERV picks among tools + the 105-tool MCP.
- ThoughtProof "RH X-cut": gated 0.5 USDG to NVDA swap, tx 0x784721337a6b56fafd28757fc663e74ea32348ae901a8020c6e5f8bcc6053c34.
- IntentLease: single-writer collision firewall, SERV output as untrusted proposal.
- AgentKit track: aspekt19/AllowLatch (policy drafted by SERV, deterministic judge, AgentKit signs USDC).

All four Robinhood entries are the same shape: propose, gate, execute a swap. A fifth one will not place.

## 6. Overlapping opportunity: Arbitrum Open House Singapore

Online Buildathon **Sep 14 – Oct 4, 2026, $115K**, "Promising Products" $15K for AI agents, one podium
spot reserved for Robinhood Chain builders. Robinhood Chain committed $1M to Open House 2026. Prior
Founder House rounds paid $30K–$100K to Robinhood Chain builders. Register: https://openhouse.arbitrum.io
and https://luma.com/openhouse-singapore . One build, two submissions.

## 7. Recommended direction

**After-hours desk for tokenized stocks on Robinhood Chain**, with SERV as the decision layer.

- User states an intent, a thesis, and a risk budget ("hold $500 NVDA exposure; add on weakness; never >30% of desk; stop at 8% drawdown").
- Agent is on duty when equity markets are closed (evenings, weekends). It reads: on-chain price vs last Chainlink close (premium/discount in bps), pool depth via QuoterV2, RHJ halt flag and trading capabilities, pending corporate actions and `uiMultiplier`, eligibility, and a news feed.
- SERV decides: act now, wait for Monday, or decline, with a structured rationale (thesis, evidence, rejected alternatives, confidence, risk budget consumed). `serv_prompt_guard` on inputs, `serv_shadow_agent` to validate, strict JSON schema.
- Deterministic policy engine gates every action (caps, drawdown, allowlist, kill switch). Reuse Arc Copilot / KeeperHub Copilot patterns.
- Execution: Uniswap v3 SwapRouter02 for USDG <-> stock token. Idle USDG deposited into the Morpho USDG vault.
- A tiny `ReasoningJournal` contract on 4663 emits `(intentId, reasoningHash, txRef)` so every fill has an attested rationale next to it. Outcome attested later against the rationale.
- Shadow mode first: first N decisions are paper; the promotion rule is visible in the UI.
- Demo lever: Raw vs SERV toggle on the same scenario (stale feed + corporate action) showing Raw making the wrong call.
- Revenue: bps on executed notional, plus a subscription tier. No token.
- Framing: execution discipline and transparency, not alpha prediction. The edge is that this is the only venue where you can act on Sunday-night information at all, and the product makes every such action explainable and bounded.

**Why this one:** uses the single property unique to this track (24/7 tokenized stocks with stale feeds),
gives SERV real work (choose between alternatives, reconcile constraints, apply policy, which is what its
docs say it is for), reuses prior repos (KeeperHub Copilot UI, Arc Copilot policy, memecoin paper pipeline,
Agari oracle/market-hours research), has a fee line, and is not the fifth propose-gate-execute swap.

**Open questions to settle on day 1:**
1. Builder residency vs Stock Token restriction (US/UK/CA/CH).
2. Mainnet with a hard cap (recommended, tx hashes matter) vs testnet (faucet has stock tokens but Uniswap/Morpho presence unconfirmed).
3. SERV tools + `reasoning_effort` behaviour (one test call).
4. Morpho USDG vault address on 4663.
5. Whether "Robinhood MCP" in the track must mean the US brokerage MCP (X copy says "Robinhood Chain & MCP"; all entries use the chain). Ask in Telegram.

## 7b. Full-ceiling version (chosen; deadline is not a scope input)

The after-hours desk is the wedge. The product is **a non-custodial USDG vault on Robinhood Chain run by a
reasoning agent whose every action is attested.** Depositors allocate USDG; the agent trades tokenized
stocks 24/7 under on-chain-enforced limits; every fill carries a hashed SERV rationale; outcomes are
attested against rationales; idle USDG earns in Morpho; operator earns carry. This merges the two
Robinhood Chain winner shapes (AlphaGrid/Tilt: agents managing capital; Gridora/Bond.Credit: verifiable
record) with the one wedge nobody has used (after-hours execution).

Layers, in build order (order is for de-risking the demo, not for cutting scope):
1. Read layer: RHJ API, Chainlink feeds + staleness, QuoterV2 depth, DexScreener on-chain price, premium/discount in bps, corporate-action state.
2. Reasoning layer: SERV strict-JSON decision (act / wait / decline + rationale), prompt guard, shadow agent, Raw-vs-SERV switch.
3. Policy engine: caps, drawdown, allowlist, per-asset window, kill switch. Deterministic, unit-tested.
4. Execution: Uniswap v3 SwapRouter02 swaps; Morpho USDG vault deposit/withdraw for idle cash.
5. `ReasoningJournal` contract: `(intentId, reasoningHash, txRef)` events + later outcome attestation.
6. Desk vault: ERC-4626 on USDG with operator role limited to allowlisted router/vault calls and on-chain caps; performance fee / carry; deposit, withdraw, share price.
7. Web app: depositor view (share price, open positions, every decision with rationale + tx link, shadow vs live record, promotion rule), operator view (intents, limits, kill switch), Raw-vs-SERV demo scene.
8. Shadow → live promotion with a visible rule; evidence page.
9. Video, X post, Typeform, Arbitrum Open House registration and submission.
