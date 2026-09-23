# Codebase walkthrough: how Shijima fits together

Written 23 Sep by reading the code itself, layer by layer: contract, shared, chain, db, engine, chat, worker,
web. About 46,000 lines, not counting styles. This page is the map. `WHAT-IS-MISSING.md` is the to-do.

## The shape in one picture

```
 Owner's wallet ──signs──▶ Desk.sol (one clone per owner, Robinhood Chain 4663) ◀──operator key── Worker
       │                        │ caps, 8% oracle band, pinned pool, decision hash per action          │
       ▼                        ▼                                                                      ▼
 Web (Next 16, :3007) ──reads/writes rows──▶ Postgres (desk_dev) ◀──only writer of decisions── Worker (Node)
  server components read      ask_requests, approvals,             hourly review · chat loop · Telegram bot
  server actions write        check_requests are the               price logger · grading · daily seal
  NEVER holds a key           web → worker mailbox                 OpenServ agent 4513 (cron trigger)
                                                                    SERV Reasoning (timing + chat)
```

The web app never trades and holds no keys. It writes request rows. The worker, the only process with the
operator key and the SERV key, picks them up.

## Layer by layer

### 1. `contracts/`: the money rules (621 lines)
- **`Desk.sol`.** One owner's account.
  - The **operator** (our worker) may `buy`, `sell`, `sweepToVault`, `redeemFromVault` and `checkpoint`.
    Every operator action is capped per action and per day (`_spend`, a fixed 24-hour window), must land
    inside 8% of the Chainlink price, uses only the pool the owner pinned, and needs a live feed.
  - Each action carries a `decisionHash`. The contract keeps `seq` and a hash chain, `head`.
  - **Only the owner** can `withdraw`, and only to themselves.
  - **A session key** (up to 7 days) can withdraw to the owner, pause, fire the agent, lower the caps, and
    sell under the operator's own guards.
  - `batch` gives one-signature exits.
- **`DeskFactory.sol`.** EIP-1167 clones. `predictDesk(owner, salt)` gives a desk's address **before it
  exists**, so money can be sent there first.
- Deployed: v0 (old dev desk, now closed) and v1 (the live dev desk, `showcase`). v1 is verified on
  Blockscout.

### 2. `packages/shared`: rules everyone agrees on (4,405 lines)
- `schemas/mandate.ts`: what the owner wants (targets in bps, caps, drift tolerance, loss stop, notes, and
  structured `price_move_sell` rules). `checkMandate` gives the problems in plain sentences.
- `presets.ts`: the 20 baskets, each with a "who it's for" line and filter tags. The first five ids (The whole
  US market, Big tech, The giants, The companies building AI, Play it safe) are stored in mandates and never
  change. `pnpm strategies:verify` re-checks every token they use on mainnet.
- `schemas/timing.ts`: the one AI question. SERV answers `ACT_NOW | ACT_PART | WAIT_REOPEN | DECLINE`, with
  confidence, reasons citing evidence ids, rejected options, and warnings. Checked by `checkTimingDecision`.
- `schemas/record.ts`: the record, versions 0/1/2, append-only. It holds the valuation, the need, the
  candidate, the evidence (session, price, cost, status, news hashes, limits, position, vault, event), the
  SERV answer, the gate and the outcome.
- `hashing.ts`: RFC 8785 JSON plus keccak. This is the fingerprint sent on-chain. `chain-head.ts` mirrors
  the contract's `head`.
- `calendar.ts`: the New York clock.
  - `anchored` is true from **Sun 20:00 to Fri 20:00 ET**, while market makers can mint and burn and the
    pool tracks the real market.
  - Outside that window nothing anchors the price. That window is the product's reason to exist.
- `copy/*`: every user-facing word (`web.ts` is 1,172 lines).

### 3. `packages/chain`: reading and writing the chain (3,709 lines)
- `desk.ts`: `readDeskState`, `quotePinned` and `readFeed`.
- `twap.ts`: the pool's 30-minute average, the valuation price, never the feed.
- `vault.ts`: the Morpho rate and liquidity, and the round-trip fee.
- `send.ts`: sign, save, broadcast, find outcome. This is the write-ahead sender; it tells v0 and v1 apart.
- `owner-events.ts`: reads calls the owner or session key made, so the engine can absorb them.
- `tokens.ts` plus `tokens.json`: the ten approved tokens, keyed by address. `rhj.ts`: the halt flag.

### 4. `packages/db`: Postgres and Drizzle (5,783 lines, 7 additive migrations)
- **Money path:**
  - `desks`: mode, state, lifecycle, `chain_seq`, loss-stop baseline, practice counter;
  - `mandates`, versioned; `wakes`, unique per desk per slot;
  - `decisions`, the hash-chained record, sealed by the next action or the daily checkpoint;
  - `actions`, write-ahead; `deferrals`, "wait" remembered; `approvals`; `grades`.
- **Money over time:** `desk_value_snapshots`, `cash_flows`.
- **Market:** `price_points` (5-minute rows), references, multiplier events, company events.
- **Chat:** `ask_requests`, `ask_proposals`, `check_requests`, `price_alerts`.
- **Social:** rooms, takes.
- **Plumbing:** `telegram_links`, `notifications` (the outbox), `serv_calls`, `worker_beats`.
- Queries: `engine.ts` (938 lines) is the worker's side, `public.ts` the web's reads, `chat.ts` the mailbox.

### 5. `packages/core`: the engine (6,896 lines)
**The life of one check, `wake/wake.ts`, `wakeDesk`:**
1. **Reconcile.** Is this our clone with our operator? Does the chain's `seq` match? Owner calls in between
   are absorbed (`absorbOwnerCalls`).
2. **Valuation** on the 30-minute average. Money that arrived or left moves the loss baseline, not the loss.
   One breach is a soft stop; a second pauses on-chain (`loss-stop.ts`).
3. **Approved requests** run first (`approved.ts`): a fresh quote within 50 bps of what the owner saw.
4. Redeem from the vault if the buys need cash (`vault.ts`).
5. **Needs** (`needs.ts`), arithmetic only: drift past tolerance (at least 5× the trading cost), tokens
   dropped from the mandate, and the owner's `price_move_sell` rules. At most 3 candidates.
   - **No needs means a `NOTHING_TO_DO` record, written every hour** (lines 498 to 530).
6. For each candidate, `consider.ts`:
   - market read and evidence (`market.ts`, `evidence.ts`);
   - the gate and the pre-gate, which are hard blockers with no AI;
   - a standing wait (`deferral.ts`) or a pending approval, which means no AI;
   - otherwise **SERV asks WHEN** (`decide.ts`, prompt `serv/prompts/timing.ts`, byte-stable, now v2+);
   - size, then gate again;
   - the mode turns it into act, ask, or "would have" (`plan.ts`).
7. **Commit** (`commit.ts`): append the record under an advisory lock, then send through the injected
   sender, or create an approval.
8. Sweep idle cash into the vault. Queue the status message.

**Jobs:**
- `jobs/prices.ts`: the **price logger**, every token every 5 minutes, no AI.
- `grade-at-reopen.ts`: grades against the same pool 30 minutes after the open.
- `market-facts.ts`: multipliers and report dates.
- `report.ts`; `alerts.ts` for price alerts.

**Chat, `ask/`:**
- `context.ts` loads the desk's facts **from Postgres only**. One `servJson` call (`answer.ts`, prompt
  `ask.v3`) returns `{reply, cites, chart, proposal}`.
- `proposal.ts` checks it: **18 kinds**, from switch_strategy, weights, notes, rules, limits, pause, resume,
  mode and answer_approval to check_now, do_it_anyway, withdraw, sell_everything, remove_assistant, unpause,
  add_money, chain limits, price_alert and close_desk.
- `confirm.ts` carries out a confirmed card.
- `direct.ts` makes the same card from a button, with no model.

### 6. `apps/worker`: the process that acts (3,396 lines)
- **Boot** (`index.ts`): take the Postgres leader lock, settle any unsettled transactions, then start the
  OpenServ agent, the chat loop, Telegram, and the heartbeat.
- **Every 15 s** (`review.ts`, `reviewAllDesksExclusive`): one pass at a time. It covers:
  - the hourly check, held back 7 minutes so OpenServ's cron gets the first go;
  - `check_requests` ("check now");
  - grading, the price logger, alerts, multipliers, earnings;
  - the daily seal, and the low-gas warning.
  - Then the Telegram outbox drains.
- **`ask.ts`**: `LISTEN` plus a sweep. It claims `ask_requests` and answers them through `core/ask`.
- **`telegram/`** (grammY, our own bot): /start, the menu, the pinned status message, Approve/Reject,
  free-text chat through the same `core/ask`, and link codes.
- **`openserv/`:**
  - `agent.ts`: `doTask` overridden, so a platform task runs `reviewAllDesksExclusive`. It has **one
    capability, `desk_status`**, which answers "N desks running".
  - `provision.ts`: an hourly cron workflow.
  - `serve.ts`: connects through OpenServ's proxy.
  - `listing.ts`, `identity.ts`: the listing and ERC-8004 identity 95396 on Base.
- **`sender.ts`**: the one mutex around the operator key.

### 7. `apps/web`: what people see (about 19,500 lines plus 12,000 of CSS)
- **Server data:** `lib/desk.server.ts` (`deskForViewer`, `loadDesk`), `lib/markets.server.ts`,
  `lib/status.server.ts` and `lib/chain-build.server.ts`, which builds and simulates owner transactions and
  shows costs first.
- **Server actions:**
  - `actions.ts`: approvals, pause, confirm a card, chain cards;
  - `owner-actions.ts`: propose, Telegram, share, disclosure, inbox;
  - `studio-actions.ts`: `prepareDeskAction` writes the desk row and the predicted address **before** the
    contract exists; `finishDeskAction` checks the chain.
- **Chat:** the browser posts to `/api/ask` and polls `/api/ask/[id]`.
- **Routes:**
  - `/` is a redirect only;
  - `/markets`, `/stock/[symbol]`, `/strategies` (the studio, 4 steps), `/desk/[slug]` (with `record`,
    `decision/[seq]`, `report`, `settings`);
  - `/reels`, `/how-it-works`, `/status`, `/compare`, `/dev/states`, `/dev/share`.
- **Look:** Agari/Yosuku sheets in `styles/agari`, `styles/yosuku` and `shijima.css`. The shell is in
  `components/shell` (Header, MobileBottomNav, Marquee).

## Four journeys, end to end
1. **A check.** The OpenServ cron fires `doTask`, or the worker timer steps in 7 minutes late. Then
   `reviewAllDesks`, `wakeDesk`, records in Postgres, and maybe a transaction with its hash. The outbox then
   sends Telegram, and the web reads it all.
2. **A chat message.** Web `/api/ask` or Telegram text writes an `ask_requests` row with a NOTIFY. The
   worker's `ask.ts` answers through SERV and `checkProposal`, and saves a card. The owner confirms on the
   web (sign-in, session key or wallet) or in Telegram, and `confirm.ts` or a chain card carries it out.
3. **Check now.** A card writes `check_requests`. The worker runs `wakeDesk` with trigger `manual` at once.
4. **Creating a desk.** The studio picks basket and limits and does a test read. `prepareDeskAction` gives
   the predicted address. One signature, then `finishDeskAction` checks the chain and starts the desk in
   practice. `FirstSteps` then offers money, a session key and Telegram.

## What the walkthrough found

**Bugs, with their cause:**
1. `/` opens the old closed desk. `desksOfOwner` (`db/queries/public.ts:305`) orders oldest first and
   includes closed desks. `app/page.tsx` takes the first.
2. The chat says "pool_twap_30m" and "record 18". `ask/context.ts:206` hands the raw `priceSource` label to
   the model. The reply prompt says ids stay in `cites`, but the context text leaks the label.
3. On a phone the chat's input sits under `MobileBottomNav`. The input is sticky (`styles/shijima.css:140`,
   `:159`) with no offset for the bottom nav.
4. There is no PWA: no `public/` folder and no manifest.

**Things already built that the plan should reuse, not rebuild:**
- **Fund first is already possible.** `prepareDeskAction` plus `predictDesk` give the address before the
  contract exists (brief 8.4). So Glider's order (choose, add USDG, go live) needs a flow change, not new
  plumbing.
- **The change detectors already exist.** `deferral.ts` `whyDeferralEnds` already notices cash arriving, the
  gap moving 1%, drift growing and a new headline. The price logger already reads every token every 5
  minutes with no AI. A watcher can put those together, so a check runs only when something changed and the
  hourly "nothing to do" rows stop. The daily seal still closes the chain.
- **The chat is the OpenServ bridge.** `core/ask` already answers from Postgres, with 18 checked proposal
  kinds. An OpenServ capability that calls the same `answer` path for a linked desk would give platform users
  the whole agent. Money-moving cards come back as a confirm link.
- **Session key and `batch`** already make one-click exits safe. The desk page just needs them in the new
  layout.

**Where each part of the plan will land:**

| Plan item | Files |
|---|---|
| Home page | new `app/page.tsx` content (from Agari `features/landing`), a live read of the showcase via `lib/desk.server.ts` |
| Fund-first onboarding | `features/strategies/Studio.tsx`, `CreateStep.tsx`, `FirstSteps.tsx`, `app/studio-actions.ts` |
| Desk as cockpit, agent presence | `app/desk/[slug]/page.tsx`, `features/desk/*`, the desk-kit from Agari |
| Decision page | `app/desk/[slug]/decision/[seq]/page.tsx`, `features/record/*`, from Agari `features/desk/decision` |
| Event wakes | `apps/worker/src/review.ts`, `core/wake/wake.ts` (no record when nothing changed), `core/jobs/prices.ts` |
| OpenServ | `apps/worker/src/openserv/agent.ts` (capabilities), plus a link table like `telegram_links` |
| Plain chat words | `core/ask/context.ts`, and a new `ask.v4` prompt |
