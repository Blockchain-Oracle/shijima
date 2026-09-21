# Architecture: the Desk

Approved 2026-09-19. This is the design half of the approved plan. The schedule, tests and risks are in
`BUILD-PLAN.md`. Product decisions are in `DECISIONS.md`. Every screen and message is in `DESIGN-BRIEF.md`.
The research behind each choice is in `research/architecture/01..05`.

---

## Context

**What we are building.** An after-hours desk for Stock Tokens on Robinhood Chain (chain 4663). One
owner per desk, in the owner's own on-chain account. The owner sets a mandate. An agent wakes hourly
and decides only timing: act, act in part, wait for the reopen, or decline. Every decision, including
"nothing to do", is recorded with rejected options and confidence, hashed on-chain with the trade, and
graded when the market reopens. Product decisions: `docs/DECISIONS.md`. Every screen and message:
`docs/DESIGN-BRIEF.md`.

**Why this plan exists.** The repo holds only docs. Abu asked for the whole build planned first:
architecture, libraries, folder structure, order of work, how the interface gets built, and fidelity
to the researched features. Five research passes are saved in `docs/research/architecture/01..05`.

**How this plan was checked.** Two independent reviewers attacked the draft, one on feasibility and one
on feature coverage. Then a line-by-line audit against: the brief's 20 screens, its 19 awkward states
and 10 message types, the decisions doc, the scope doc's forced facts, all 91 catalogue items marked IN
(checked by script, all accounted for), every "unverified" list in the five research reports, the
hackathon's own rules, and Abu's instructions. About sixty findings are built in.

**Deadlines.** SERV Hackathon closes Mon 28 Sep 00:00 UTC. Arbitrum Open House closes Sun 4 Oct.
Finalists demo live in early October, so the desk stays running until then. Only one full weekend falls
before the first deadline: 26 to 27 Sep. **The desk must trade live by Fri 25 Sep.**

**What research and review changed from the older docs.**
- Telegram is our own bot. The OpenServ integration cannot send, edit, or receive button presses.
- The agent is self hosted. The SDK tunnel goes deaf after ~2.5 minutes. We override `doTask` so our
  code runs directly with no platform model in between.
- The desk account is a small custom contract per owner, proven on a fork. Smart-account kits cannot
  cap sells in dollars, bound price, or force the decision hash into the trade.
- No wallet kit. wagmi 3 broke all of them. *(21 Sep: Privy's current release now compiles against our wagmi
  3.7.7 and shares its context. That was checked at compile time only, and whether to adopt it is open. See
  `FIDELITY.md` section 7.)*
- The halt flag exists only in Robinhood's REST API. Its weekend quotes are frozen while its timestamp
  refreshes. The Chainlink feed is "last 0.5% move", not "Friday's close", and is frozen all weekend,
  so **holdings are valued on the pool's 30-minute average, never on the feed.**
- Gas is cents, not fractions of a cent. Vault sweeps need a minimum size.
- The money path gets proven end to end on Monday, not Thursday.

---

## 1. Architecture

```
Owner's wallet ──signs──▶ Desk contract (one per owner, on 4663) ◀──operator key── Worker
      │                                                                             │
      ▼                                                                             ▼
  Web app (Next.js, Vercel) ◀──────────── Postgres (Neon) ──────────▶ Worker (Node, Railway)
   owner UI, sign-in, reads,                                          OpenServ agent + hourly cron
   approvals, mandate intake                                          our Telegram bot (grammY)
   NEVER executes a trade                                             tick loop, engine, ONLY writer
                                                                      of decisions and transactions
                     SERV Reasoning · Finnhub/Tavily · Robinhood REST · Chainlink · Uniswap v3 · Morpho
```

### 1.1 Contracts (`contracts/`, Foundry, solc 0.8.28, cancun, OpenZeppelin v5)
Build the interface in `docs/research/architecture/03-desk-account.md` section 7, with these changes.
- `DeskFactory.createDesk(cfg, salt)`: EIP-1167 clone, `owner = msg.sender` always. `predictDesk` lets
  the web app bridge money to the address before it exists. One owner may hold several desks.
- `Desk`: operator may `buy`, `sell`, `sweepToVault`, `redeemFromVault`, `checkpoint`, `pause`. Output
  always returns to the desk. Owner alone may `withdraw` (to owner only), `unpause`, `setLimits`,
  `allowToken`, `disallowToken`, `setOperator`, `revokeOperator`. Owner never changes. No upgrade, no
  admin. The desk cannot receive ETH. **The operator pays gas for every agent action.** Owners pay only
  for their own rare transactions.
- **Added: owner-only `batch(bytes[])`** (self-delegatecall), so "sell everything", "withdraw all" and
  "close the desk" are each one wallet confirmation, as promise 5 requires. It replaces `exit()`.
- Guards that hold even if the operator key is stolen: per-action and daily caps, **fee tier pinned per
  token by the owner** (an empty pool can be seeded, so it is never an operator argument), **price
  floor computed in the contract from the feed** (`bandBps = 800`, `maxFeedAge = 4 days`, both fixed
  and hidden from the UI), deadline, exact approvals reset to zero. Sells count at the larger of USDG
  received and oracle value.
- **Known limit, stated honestly.** If a weekend move exceeds 8% from the frozen feed, the agent's
  trades revert by design. The record says "Blocked: price is more than 8% from the last official
  update. Only you can sell right now", and an alert goes out. The owner's own sell still works.
- Every desk is created with conservative default caps and the full approved token list. Going live
  calls `setLimits` only if the mandate's caps differ. The gate uses the smaller of mandate and chain.
- Each action carries a `decisionHash`. The contract keeps `seq` and a hash-chain `head`.
- **Two deployments.** v0 on Sunday: happy-path fork tests, a $20 canary desk, a dev operator key.
  v1 on Tuesday, after the Monday skeleton has run against v0: the full 23-item test list from report
  03 section 8 plus batch tests, invariant fuzz on mocks, `/security-review` and a second model pass,
  and a written interface-freeze checklist. Deploy with `--slow --gas-estimate-multiplier 300 --verify
  --verifier blockscout`. Read the verified Stock Token source in a browser once.
- **Escape hatch.** A short page and README section: "If our website disappears, here is how to
  withdraw on Blockscout." If Blockscout does not show a Write tab for clones, the page gives the raw
  `cast send` commands. Mamo's "withdraw even if we are offline", made real.

### 1.2 Token list (`scripts/build-tokens.ts`, runs Sunday, output `packages/chain/tokens.json`)
For each candidate: liquidity on all four fee tiers at $100 and $1,000, the pinned tier, feed address,
decimals and description, pool observation cardinality, display name, a tradability note. About ten
names with both a feed and a deep pool. Confirms SPY and QQQ qualify for the "Broad market" preset.
**Tokens are keyed by contract address everywhere, never by symbol.** Each wake quotes the pinned tier
only. A weekly rescan flags `better_tier_available` and prompts the owner to re-pin.

### 1.3 Worker (`apps/worker`, one Node 24 process on Railway)
- **Leader lock.** A Postgres advisory lock at boot. Only the leader polls Telegram, runs the tick
  loop and sends transactions. Railway deploy overlap would otherwise give two senders on one nonce
  and a Telegram 409.
- **OpenServ agent.** `Agent` subclass with `doTask` overridden. One workflow, `hourly-review`, from
  `provision()` with `triggers.cron({ schedule: '0 * * * *' })`. `provision()` runs on every boot,
  because it re-activates triggers the platform may have switched off. `DISABLE_TUNNEL=true`, Railway
  URL as `endpointUrl`, `.openserv.json` on a Railway volume and gitignored, `WALLET_PRIVATE_KEY` set
  explicitly. Alert if no platform task arrives for two hours. SDK and client pinned, never upgraded.
- **Telegram bot.** grammY long polling. Private chats only, `from.id` must match the linked owner,
  link codes single-use with a 10-minute expiry. Welcome message, then a silently pinned status
  message edited in place. Approve, reject, see details (a signed, expiring, read-only link, since
  Telegram's browser has no wallet session). `/status /pause /resume /help`. Display names, not
  tickers. An approval answered on the web edits the Telegram message too.
- **Tick loop, every 15 s.** Run any hourly wake more than 7 minutes overdue. Pick up answered
  approvals. Expire approvals. Calendar-driven close and open snapshots. Grading. Daily checkpoint.
  Fee accrual. Multiplier event sync. Earnings calendar sync. Pending bridge polling. Operator ETH
  balance monitor. Notification outbox. A unique key on `(desk_id, scheduled_for)` makes double fires
  harmless, so OpenServ cron is the primary clock and this loop is the safety net. Desks are read in
  small parallel batches and sent serially.
- **Sending.** One in-process mutex around the operator key. The signed tx hash and nonce are written
  to the database **before** broadcast. On boot and every reconcile, each `prepared` or `sent` action
  is resolved: receipt found means finalise, contract deadline passed with no receipt means
  `never_landed`. The on-chain deadline makes that deterministic. Chain `seq` is cross-checked against
  the database each wake. RPC is Alchemy first with the public RPC as a viem fallback transport.
- **Alerts to Abu.** pino logs to stdout. Crashes, failed wakes, reverted transactions, low operator
  ETH and SERV errors go to a private Telegram chat, rate limited per error key.

### 1.4 Engine (`packages/core`, framework-free)
`wakeDesk(deskId, scheduledFor, trigger)`. Only the worker calls it. One file per step.
1. **reconcile.** On-chain balances, vault shares, caps, spent, paused, operator. Classify every
   change: USDG in is a deposit (Relay delivers from a solver, not the owner), a `Withdrawn` event is a
   withdrawal, a Stock Token arriving updates the picture, an unexplained decrease means Needs
   attention. Registered desks only: created through sign-in, `owner == session`, code is our clone,
   `operator == ours`.
2. **market.** Session from the calendar. Per token: pinned-tier quote at the real size, pool 30-minute
   average via `observe`, feed and its age **in market time**, reference (last swap at or before the
   16:00 ET boundary, recomputable from logs, rescaled if a multiplier lands mid-weekend), gap versus
   reference with "in line" under 50 bps, REST halt flag, `oraclePaused`, token and registry pause,
   `isBlocked(desk)`, pending multiplier, earnings within N days. REST prices are multiplied by
   `uiMultiplier` before any compare, and their age comes from the calendar, never from `generatedAt`.
3. **valuation.** Holdings at the pool 30-minute average, with a sanity band against the feed.
   Drawdown baseline is start value plus net cash flows. First breach is a soft pause and an alert.
   A second consecutive breach is the on-chain pause. Restart needs the owner and resets the baseline.
4. **needs** (arithmetic, no AI). Drift beyond tolerance, idle cash above the minimum sweep, cash for
   a buy, compiled note-rules that fired. No candidates means "nothing to do" with no model call.
   A standing **deferral** means "still waiting (decided 02:00)" with no model call.
5. **pre-gate.** Hard blockers decided by code, each naming its rule: halted, oracle paused, feed dead,
   company event window, paused, blocked, not allowlisted, beyond the 8% band, news unavailable for a
   non-protective act.
6. **decide** (SERV Reasoning, one call per candidate). Output is `ACT_NOW | ACT_PART | WAIT_REOPEN |
   DECLINE`, part size from the enum 25, 50, 75, confidence, reasons citing evidence ids, rejected
   options as an enum with reasons, whether news explains the gap, warnings, rule ids. Validated with
   zod. Cited ids must exist. `finish_reason` and refusal checked first. Model prose passes a
   banned-word check. The prompt states that dividends never arrive as cash. Headlines are stripped of
   HTML, capped in length and quoted as data. Any failure means no action, recorded as failed. On 429
   or 5xx: retry with backoff, then skip the hour and say so in the status message.
7. **gate** (arithmetic). `allow | deny | escalate` with reasons. No optional inputs: a null denies.
   Values come from quotes, never from the model. Bigint only. Caps, max position, price impact,
   two-sided gap refusal tighter than the on-chain band and relaxed for protective sells, minimum
   trade and sweep size, duplicate block, large-action trigger, mode. A trade larger than the
   per-action cap is split, and the record says "acted in part, limited by your per-action limit".
   **Sells are sized by the larger of the quote and the oracle value**, exactly as `Desk.sol` counts
   them. On a weekend when the pool has fallen below the frozen feed, the oracle value is the bigger
   number. A sell sized by the quote alone would be refused on-chain at the moment it matters most. This
   was found live on 20 Sep, when NVDA sat 65 bps under the feed.
8. **act.** Shadow records "would have". Ask-first creates an approval that **expires at the next
   scheduled check**. On its own executes. A `WAIT_REOPEN` writes a deferral with `revisit_at` = next
   open + 30 min, broken only by arithmetic: gap moves 100 bps, a note-rule fires, a new on-topic
   headline, drift grows by half the tolerance, cash arrives. A decision can have several legs (redeem
   then buy), all carrying the same hash, and a failed leg stops the rest with a named cause. Soft
   pause and approval state are re-read immediately before sending. **A mandate change, a mode change
   or a pause cancels pending approvals and deferrals.**
9. **approved actions.** The worker reruns reconcile, market, pre-gate and gate with a fresh quote and
   no model call. It executes only if the fresh output is within 50 bps of the preview. Otherwise it
   records "approved, conditions changed, not executed". The on-chain hash is of a new execution
   record holding `approvalOf`, the fresh snapshot, and who answered, when and where.
10. **record.** Taken under `pg_advisory_xact_lock(deskId)` with a unique `(desk_id, seq)`. Records
    carry a schema version. The hashed part is fixed before sending. The result is appended after.
    Non-actions join the same chain and are sealed by the next action or the daily checkpoint, which
    also covers Shadow desks.
11. **notify.** Outbox. New message for actions, approvals, would-be actions, alerts, and notable
    non-actions (WAIT with drift at least twice the tolerance, or DECLINE on a held token with a
    pending need, once per token per cause per session), and the reopen report summary with a link
    to the full page. Silent status edit for everything else.

Jobs: `snapshots` (calendar-driven, correct on early-close days), `gradeAtReopen` (one grade per
deferral or decision, against the main alternative, "no real difference" under 25 bps),
`shadowReport` and `weekendReport` (one generator over any window), `promotion` (24 checks plus the
report opened, the owner arms it, instant demotion on repeated failures), `dailyCheckpoint`,
`accrueFee`, `syncMultiplierEvents` (split or dividend by ratio, raises "value jumped"),
`syncEarningsCalendar`, `pollCashFlows`, `operatorBalanceMonitor`.

**Replay mode.** `market` reads through a price-source interface. A clearly labelled replay runs the
engine over past weekends (22 Aug, 12 Sep from GeckoTerminal candles, 19 to 20 Sep from our logger) and
grades against the real Mondays. Weeknight grades will mostly read "no real difference", because the
market is anchored on weeknights, so replay is what shows grading before the first deadline.

**SERV Reasoning is used in three places:** the decision, the mandate read-back, and the comparison
page. Rules for every call: `openai` SDK 5.23.2 with `baseURL`, one byte-stable system prompt per
purpose shared by all owners (it is the cache key), all owner data in the user message, strict schema
from `z.toJSONSchema` with nullable not optional and `$schema` stripped, `serv_prompt_guard` and
`serv_shadow_agent` tools, non-streaming, versioned prompts, every call logged with latency, tokens and
finish reason. The model is a config value, chosen in the Sunday spike. Rules are cited by id so the
content filter does not trip, with `serv_disable_content_filter` as the fallback. Both SERV safety
tools can fail silently, so our zod check and gate are the real protection, and the README claims only
what the logs show.

**Mandate read-back.** The model returns policy, conflicts, assumptions and questions. Notes compile
into a closed set of rule templates: `PRICE_MOVE_SELL`, `EVENT_BLOCK_BUY`, `PREFER_WAIT`, and
`FREEFORM_CONTEXT`, which is never enforced and the read-back says so. Code, not the model, checks
that rules and caps fit together ("this rule could need a $200 sale but your per-action limit is $50").
Code forces `readyToApply` to false while any question or conflict remains.

**Comparison page.** Three saved scenarios built from real logged data: an old reference with a
company event coming, an unexplained weekend premium, a halted token. Runs are pre-recorded. A live
rerun is rate limited. Raw mode uses `x-openserv-disable-braid: true`.

### 1.5 Web app (`apps/web`, Next.js 16 App Router on Vercel)
- wagmi 3.7.7, viem 2.56.8 (`robinhood` from `viem/chains`, official RPC passed explicitly),
  `injected()` and `walletConnect()`, no kit. Wrong network prompts `useSwitchChain`, which also adds
  the network. Sign-in is iron-session plus `viem/siwe`, with `domain`, `uri` and `chainId` pinned per
  environment and `Origin` checked on mutating routes.
- **The web app never executes a trade.** It flips approval rows with a guarded `update ... where
  status='pending' and expires_at>now() returning`. The worker picks them up within seconds.
- Owner transactions: `createDesk`, fund, `setLimits`, `allowToken`, `unpause`, `revokeOperator`,
  `withdraw`, `batch`. A `useOwnerGas()` guard sits on every one. An owner with no ETH funds first:
  Relay SDK 8.0.1 bridges USDG to the `predictDesk` address, and a second quote sends about $1 of ETH to
  the owner's wallet. Origin token decimals are read, never assumed. Minimum funding $20, with the
  reason shown.
- Every read is scoped by owner or by share slug. The public view is a whitelisted projection with no
  Telegram identity, and shows headline source, time and link only, because Finnhub's free licence
  forbids passing its text on. Desk creation sits behind a beta invite code. Quote and comparison
  routes are rate limited.
- Pause from web or Telegram is a soft pause: instant, free, reversible. The on-chain pause is for the
  loss stop and revoke. The UI shows the brief's states, never these mechanics.
- Live vault rate and available liquidity come from the Morpho API and on-chain reads, never a
  hardcoded 3.6 and never `maxWithdraw`.
- Times are stored in UTC and shown in the owner's local time, with New York time for market hours.

### 1.6 How the interface gets built
- **Route map follows the brief's numbering.** `(public)`: home 8.1, how-it-works (the published rules
  for how the desk decides, plus the escape hatch), desk/[slug] 8.19, compare 8.20. `onboarding/`:
  8.2 to 8.8 as one resumable flow driven by `desks.lifecycle`. `(desk)`: home 8.9, record 8.10,
  decision/[id] 8.11, reports 8.12, holding/[token] 8.13, mandate 8.14, withdraw 8.15, settings 8.18.
- **Mobile first.** The owner is on a phone. Every screen is laid out for a narrow screen first.
- Server components read from Postgres. Client components handle the wallet. TanStack Query polls the
  desk home every 30 s. Forms are react-hook-form with the same zod schemas the engine uses.
- A `<Price>` component refuses to render without a source and an as-of time. The Telegram step shows a
  button and a QR code, and settings can disconnect it. Slow calls (mandate read-back, comparison) stream
  progress so the screen is never frozen.
- "Has not checked in" is derived in the web query, independent of the worker. `GET /api/quote` serves
  "cost to trade your size". `GET /api/decisions/[id]/record.json` serves Download. "Check it"
  recomputes the hash in the browser against the event log, and for non-actions walks `prev_hash` to the
  sealing record or shows "not yet sealed, next seal HH:MM". The go-live lock is enforced server-side.
- **A states gallery at `/dev/states`** renders every row of brief table 8.16 and every record outcome
  from fixtures. It makes the awkward states reviewable in one place, for us and for the designer.
- **21 Sep: the design is Masayume's** (Abu's own app, `sommina-events`), ported from **Agari**
  (`agari-wt/w1`), which already gave it US-stock semantics. `docs/FIDELITY.md` is the contract for the
  re-skin: what is copied, what is adapted, what is excluded (every betting surface), the conflicts with the
  brief, and the open decisions.
- **Built functional-first with shadcn defaults and semantic tokens only.** Components are grouped by
  brief screen and every user-facing word comes from `shared/copy`. When Abu's design arrives, the
  design pass is a re-skin run with the `reference-product-fidelity` approach against that design. If no
  design has arrived by Sat 26, a restrained default pass is done with the installed design skills, and
  the real design is applied for the Arbitrum deadline.

### 1.7 Data (`packages/db`, Drizzle 0.45.2 + `pg` on Neon)
Decisions: `owners`, `disclosure_acceptances` (versioned, with the not-restricted declaration), `desks`
(owner not unique, mode, state, lifecycle, share, drawdown baseline, promotion fields), `mandates`
(versioned, compiled rules and read-back), `wakes` (unique per desk per hour, trigger including manual,
source health), `decisions` (gap-free `seq`, the brief's nine outcomes, token, amount, summary,
confidence, shadow flag, record json, `record_hash`, `prev_hash`, `sealed_by_tx`), `deferrals`,
`actions` (leg, nonce, tx hash, calldata hash, expected, actual, failure code), `approvals` (reason,
expiry, answered by, when, via, telegram message id), `grades`.
Money over time: `desk_value_snapshots`, `cash_flows` (deposit, withdrawal, bridge in flight),
`fee_accruals` (0.5% a year, waived, zero in Shadow). Vault interest is derived from `actions`.
Market: `reference_snapshots` (close or open, multiplier), `price_points` (pool mid, feed, feed time,
gap, cost at $100 and $1,000, halt), `multiplier_events`, `company_events`, `desk_token_flags`
(alerts fire on change, not hourly), `news_cache` (per ticker, deduplicated by URL hash).
Plumbing: `desk_events` (who paused, resumed, changed mode, from where), `telegram_links` (with status
message id), `notifications` (outbox, kind enum), `serv_calls`, `invite_codes`.
Chat (added 21 Sep, migration 0001):
- `ask_requests`: one message; the web writes it, and the worker claims and answers it.
- `ask_proposals`: what the model proposed after plain code checked it, with an expiry, a confirm path
  (sign-in, session key or wallet) and the view the owner was shown.
- `check_requests`: "check now", run at the request's own time so it never takes the hourly slot.
- `price_alerts`.

`notifications` gained `read_at` for the web inbox.

How the chat runs (`packages/core/src/ask/`, `apps/worker/src/ask.ts`):
1. The web writes an `ask_requests` row and sends `pg_notify('ask_requests', id)`.
2. The worker LISTENs on one held connection and sweeps every second. It claims rows with `FOR UPDATE SKIP LOCKED`,
   answering at most 3 at once, beside the hourly clock and never inside it.
3. Context comes from Postgres only. Every fact gets an id (d41, a1, w1, r1, p-NVDA), and a cite outside that
   set is dropped.
4. One `servJson` call on the frozen `ask.v1` prompt, with a strict `AskReply` schema: 1,200 tokens, no shadow
   agent, and the prompt guard on.
5. `checkProposal` checks the one proposal against the desk as it is now. It then gets a path: `signin`,
   `session` or `wallet`.
6. A proposal that passes is saved with a 10-minute expiry. For "do it anyway", the fresh quote is saved too.
7. `confirmSigninProposal` takes the proposal with a guarded update, then runs the existing guarded query for its
   kind. A mandate change refuses if the settings changed since the proposal was made (`baseVersion`).
8. "Do it anyway" is an approval with reason `owner_override`, already answered via `chat`. The wait ends as
   broken. The engine carries it out like any approval, recorded as `ACTED_BY_OVERRIDE`. It counts against the
   daily limit and is left out of the desk's Timing.
9. The chat's calls are logged under the purposes `ask` and `readback`, with a daily allowance of 200. The
   engine's calls never count against it. Each owner may send 6 messages a minute and 150 a day.
Web uses the pooled URL with `attachDatabasePool`. The worker uses the direct URL. Migrations are
additive and run as the worker's pre-deploy step. The worker deploys before the web.

---

## 2. Folder structure

```
open-serv/
├─ apps/
│  ├─ web/          app/(public)/ · app/onboarding/ · app/(desk)/ · app/dev/states · app/api/*
│  │                components/<brief screen>/ · lib/
│  └─ worker/       src/index.ts, leader.ts · openserv/ · telegram/ (bot, messages, status,
│                   approvals, links) · tick/ · sender.ts · alerts.ts · env.ts · cli/ (desk:skeleton,
│                   desk:create, desk:wake, desk:link-telegram, desk:set-mode, desk:replay)
├─ packages/
│  ├─ core/         wake/ (reconcile, market, valuation, needs, pregate, decide, gate, act, approved,
│  │                record, notify) · jobs/ · serv/ (client, prompts, schemas) · news/ · failures.ts
│  ├─ chain/        clients, abis/, addresses, tokens.json, quotes, twap, feeds, multiplier, vault,
│  │                desk (reads, writes), rhj, gas, logs (reference from swap logs), price-source
│  ├─ db/           schema/, queries/, migrate.ts
│  └─ shared/       schemas (mandate, record, evidence, rules), calendar (NYSE table + Intl), hashing
│                   (own canonical JSON + keccak, amounts as strings), copy, presets, format, banned words
├─ contracts/       src/Desk.sol, DeskFactory.sol · test/ · script/
├─ scripts/         build-tokens.ts
├─ .github/workflows/ci.yml   Biome, vitest, forge unit tests. Fork tests on a schedule, not per push.
└─ docs/            existing, plus ARCHITECTURE.md and BUILD-PLAN.md written from this plan
```
Plain pnpm workspaces with a version `catalog:`. No Turborepo. Shared packages are source-only
(`transpilePackages` in web, `tsx` in the worker). `shared` and `chain` stay browser-safe. Three
separate keys: deployer, operator, OpenServ identity. The production operator key never touches the
laptop. `.env.example` in each app. `git init` on day one. MIT licence. gitleaks before going public.

## 3. Libraries (all versions checked on npm on 19 Sep)

| Job | Pick |
|---|---|
| Web | next 16.3.5, react 19.3.0, tailwindcss 4.3.3, shadcn CLI 4.21.0, recharts 3.10.1 via shadcn chart |
| Forms and validation | react-hook-form 7.88.0, @hookform/resolvers 5.9.1, zod 4.6.5 |
| Chain | wagmi 3.7.7, viem 2.56.8, @tanstack/react-query 5.103.1, @walletconnect/ethereum-provider 2.25.0 |
| Sign-in | iron-session 9.0.1 (8.0.4 as fallback, `await cookies()` on Next 16) + `viem/siwe` |
| Database | drizzle-orm 0.45.2, drizzle-kit 0.31.10, pg 8.23.0, @vercel/functions for pooling, Neon |
| Bridge | @relayprotocol/relay-sdk 8.0.1, SDK only. The widget breaks on wagmi 3 |
| Agent platform | @openserv-labs/sdk 2.4.1, @openserv-labs/client 2.5.3, pinned |
| Inference | openai 5.23.2, pinned because the OpenServ SDK requires v5 |
| Telegram | grammy 1.46.0 |
| Hashing | **no dependency.** Our own RFC 8785 subset (about 60 lines) + viem keccak256. See note below |
| Market calendar | no library. Hardcoded NYSE table plus built-in `Intl` |
| News | Finnhub `company-news` and `calendar/earnings`, Tavily as fallback |
| QR code | qrcode.react |
| Worker runtime | Node 24, tsx 4.23.13, pino 10.3.1 |
| Tooling | TypeScript 6.0.3 pinned, Biome 2.5.14, vitest 5.0.1, @t3-oss/env-nextjs in web, plain zod in worker |
| Contracts | Foundry, OpenZeppelin v5 (Clones, Initializable, ReentrancyGuard, SafeERC20) |
| Hosting | Vercel (web), Railway Hobby (worker), Neon (Postgres), Alchemy (RPC) |

**Why hashing has no dependency (changed 19 Sep during the build).** The pick was `canonicalize` 5.1.0.
pnpm 11 flagged it: that release was one day old, and the package had shipped three major versions in five
months after years of silence. It sits on the path that guards money, so it was dropped. With floats
banned from records, RFC 8785 reduces to sorted keys plus `JSON.stringify` escaping, both of which
JavaScript already does as the RFC requires. The result was cross-checked: Python `json.dumps(sort_keys=
True)` hashed by Foundry `cast keccak` gives the identical fingerprint, and that value is frozen as a
test vector. pnpm's release-age protection stays on for every other package.

**The approved token list (built 19 Sep from live chain data).** SPY, QQQ, NVDA, AAPL, MSFT, GOOGL, AMZN,
META, TSLA, SGOV. 18 of 35 feed-backed tokens qualified on depth, cost and TWAP capacity. The list is
curated by a preference order, because ranking by depth alone picked a private company and an oil fund
over Microsoft and Tesla. Two rules came out of building it:
- **Depth filters, then cost chooses.** Cost alone pinned Tesla's $19K pool over its $439K pool.
- **Rebalancing must be cost-aware.** SPY, QQQ, NVDA, AAPL, GOOGL and SGOV cost about 10 bps per round
  trip. MSFT, AMZN, META and TSLA cost about 60, because their liquidity sits in the 0.3% tier. The
  `needs` step must only propose a trade when the drift it corrects is worth several times its cost.

## 4. Build rules

- **Context7 before any unfamiliar library call.** The plugin is down, so use its HTTP API:
  `curl "https://context7.com/api/v1/search?query=<lib>"` then `.../api/v1<id>?type=txt&topic=<topic>`.
  Training data is stale for wagmi 3, zod 4, Next 16, Drizzle and grammY.
- **Tests are not a deliverable (Abu, 20 Sep).** Prove a critical path by running it: a fork rehearsal, then a few
  live cents. At most one small check for money-path logic. The tests that exist stay. Do not add suites.
- No floats on amounts. Bigint in code, strings in records. Floats only in `shared/format`.
- Every user-facing word lives in `shared/copy`. "Stock Tokens" always. "Last official update" never
  "last close". A banned-word test runs in CI.
- No price is shown without its source and age.
- Files under about 400 lines. No MCP. No testnet work: it has no USDG, Uniswap, vault or feeds.
- **Secrets live in `.env` (gitignored, mode 600). Never print, echo or log a key or a private key.** Strip keys
  from command output. `.env.example` lists the names.
- Never hand-type a checksummed address. Use `cast to-check-sum-address`. A test guards this.
- The npm package `forge-std` is NOT from Foundry. Never install it. Use `contracts/setup.sh`.
- Pinned versions in `pnpm-workspace.yaml` are deliberate. Do not bump them. `openai` stays on 5.x.
- This network drops connections. Every outbound fetch retries with backoff.
- Local first. Postgres and the worker run locally. No hosted services until Abu says it is time to deploy.
- Rehearse anything that spends money on a local fork first: start `anvil --fork-url <alchemy url>`, then prefix
  the command with `RPC_URL=http://127.0.0.1:8545`. Scripts print LIVE or REHEARSAL.

## Commands

- `pnpm install` then `./contracts/setup.sh` : first-time setup
- `pnpm lint` · `pnpm typecheck` · `pnpm test` : TypeScript checks, all must stay green
- `pnpm --filter @desk/contracts test:fork` : contract tests on a mainnet fork. Reuse a block to run in
  seconds: `BLOCK=<n> ./contracts/fork-test.sh`
- `pnpm tokens:build` : rebuild the approved token list from live chain data
- `pnpm abis:build` : regenerate TypeScript ABIs after a contract change
- `pnpm desk:skeleton [--usdg 1] [--side sell] [--force]` : the whole money path once, live. Costs a few cents.
  `--kill-after-send` and `--kill-before-send` are the crash drills. `pnpm desk:resolve` settles what a crash left.
- `pnpm db:migrate` · `pnpm db:generate` : apply and create migrations. Additive only: `desk_dev` holds real records.
- `pnpm desk:mandate --preset <id> | --targets SYM=bps,... --cash bps | --show` · `pnpm desk:mode <mode>`
- `pnpm desk:wake [--dry]` : one real check of the dev desk. `pnpm worker:start` : the hourly clock, with the daily seal.
- `pnpm dev:prove-limits [--send]` : asks the contract, with the operator key, to break each limit. It must refuse.
- **Rehearse on a fork:** start `anvil --fork-url <alchemy url> --silent`, run `pnpm rehearsal:reset`, then prefix any
  command with `RPC_URL=http://127.0.0.1:8545`. A rehearsal uses the `desk_rehearsal` database, never `desk_dev`.
  Top the operator up with `cast rpc anvil_setBalance`: anvil's gas price is about ten times the real one.
- `pnpm dev:desk status|create|fund` · `pnpm dev:funds status|watch|bridge|split` : dev desk and dev wallets
- `./contracts/deploy.sh <label>` · `./contracts/verify.sh <label>` : deploy and publish source

---

## 5. Feature fidelity map

| Feature | Pattern copied from | Lives in |
|---|---|---|
| Own account, agent cannot send funds away | Robinhood Agentic account, done on-chain | `Desk.sol` |
| Caps enforced by the chain | Bankr | `Desk.sol`, `gate` |
| One-action pause, sell all, remove, withdraw, close | Pearl close-all, eToro sell-all | `Desk.batch`, web 8.14, 8.15, 8.18 |
| Withdraw even if we are offline | Mamo | escape-hatch page |
| Large-action confirmation | Trojan sell protection | `gate` escalate, Telegram 9.4 |
| Shadow, ask-first, on its own, instant demotion, owner arms | agentic-trader, Maestro track-only | `jobs/promotion`, `shadowReport` |
| Mandate read back with open questions, presets | AllowLatch PolicyDraft, Pearl presets | `core/serv`, `shared/presets`, web 8.6, 8.7 |
| Published rules for how it decides | Betterment, Public "it doesn't improvise" | how-it-works page |
| Decision with rejected options and evidence ids | alloc `why_not`, fixed with enums | `wake/decide` |
| Non-actions recorded, quiet runs grouped | Public activity feed | `wake/record`, web record query |
| Record fixed to the transaction, checkable, downloadable | nobody ships this | `Desk.sol` chain, web "Check it" |
| Graded at reopen, replay of past weekends | nobody ships this | `jobs/gradeAtReopen`, `desk:replay` |
| Swap safety: floor, gap refusal, pinned tier, deadline | valory PR 68, hoodchain SDK | `Desk.sol`, `gate`, `chain/quotes` |
| Itemised preview, named failure causes | Betterment, Banana Gun | `act`, `core/failures`, `chain/gas` |
| Session, price source and age, gap, halt, multiplier history, company event warning | xStocks, Ondo, Bybit, Robinhood Classic | `wake/market`, `jobs/syncMultiplierEvents`, web 8.13 |
| Value since start and since reopen, interest earned, limits in use, fee so far | Giza, Mamo | `desk_value_snapshots`, `cash_flows`, `fee_accruals` |
| One status message edited in place, welcome, alerts on change | Maestro Trade Monitor, 3Commas | `worker/telegram`, `desk_token_flags` |
| Idle cash in the vault, liquidity-aware, minimum sweep, never `max*` | Robinhood Earn, Giza | `needs`, `chain/vault` |
| One-step funding with gas top-up, $20 floor | Relay | web 8.5 |
| Versioned disclosure, "Stock Tokens" wording, banned words | all five token products | `disclosure_acceptances`, `shared/copy` |
| Read-only live desk, reasoning comparison | for judges | web 8.19, 8.20 |

---
