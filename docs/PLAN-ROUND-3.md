# Shijima, round 3: an app with a sidebar, agents you can copy, a free $1 on mainnet, and everything you asked for

## Context

On 23 Sep Abu used the app end to end and found that it doesn't hold together. Features he asked for were dropped: copy trading, creator fees, a real OpenServ connection, a free $1 to try, 20 strategies and a 404 page. The agent page repeats itself, and settings and connections are hidden. He then asked for a **design revamp: a signed-in app with a sidebar**, and said to be creative, take time, use 21st, and look at everything as a whole.

I rushed two drafts. This one rests on seven pieces of work:
1. **Every message Abu sent** in 16 sessions, 64 of his own, read in full. The ledger is at `plans/snappy-jingling-harp-agent-a0f9b4b3e34ba2fb5.md`: 25 dropped or partial items.
2. **Every promise in the docs** checked against the code. The audit is at `plans/snappy-jingling-harp-agent-ab66bdfd8f1538ca0.md`: 110 promises and 18 routes.
3. **Every screen** looked at in the browser, as a visitor and as the owner, at 1440px and 390px.
4. **The reference code** in Masayume, Agari and Stocklana, which are one repo, plus Agari's plan from last night (S23), which fixed its own copy drawer.
5. **OpenServ.** The SDK, the docs, the platform bundle, GitHub and the transcript.
6. **Chain data.** Real gas costs from our `actions` table, and liquidity for all 35 tokens from `packages/chain/tokens.scan.json`.
7. **21st.** About 25 surface searches, around 120 candidates, and 16 live previews viewed in dark mode. The AI generator isn't enabled on this account, so the path is search → view → `21st get` → adapt, the same path the last plan used.

**About Codex's handoff** (`docs/2026-09-23-product-fidelity-handoff.md`). Its diagnosis is right, and I keep its state lists and acceptance walkthrough. But it leaves every product question "unresolved" and hands them back to Abu. The answers below close them, and step 10 writes them (D1–D10) into DECISIONS.md and the handoff's §10.

## Straight answers to Abu's questions

**How does the agent trade without money?**
- Each agent is its own account on Robinhood Chain, a Desk contract. The USDG sits inside it, and the agent spends only that.
- The showcase has $5.79 in it and is in **Practice**: it decides for real but sends nothing. That's why you've never seen it trade.
- Live mode trades that USDG for real, inside the account's own limits.

**Who pays gas?** Measured from our own trades:
- A trade costs **about 5¢** of ETH (0.000015 ETH). Shijima's operator wallet pays it, never you.
- You pay only for what you sign yourself: creating the agent, adding money, withdrawing. Each is a few cents.
- The worker already warns us when the operator's ETH runs low (`watchOperatorGas`).

**How does a new user get money in?** Your agent has its own address, like a bank account number. There are three ways to fund it:
1. Send USDG from your wallet on Robinhood Chain, with one signature.
2. Bridge USDC from Base, Arbitrum, Ethereum or BNB through Relay. This is built (`BridgeIn.tsx`), and it can also get you gas.
3. **Send to the agent's address from anywhere**: another wallet or an exchange. It gets a Receive screen with the address and a QR code.

Plus the free $1 below.

**Can the server make the agent for the user?** No. `DeskFactory.createDesk` always makes whoever signs the owner (DeskFactory.sol:9-10). That's why the free gift must include a pinch of ETH.

## Decisions (I'm making them; recorded in DECISIONS.md)

**D1. It's called Agent everywhere.**
- Routes become `/agents` and `/agents/[slug]`.
- `/desk/*`, `/desks` and `/record` redirect permanently, so old shared links keep working.
- `Desk` stays only as a code and contract name.

**D2. The app has two shells.**
- The website (`/`, `/how-it-works`, `/docs`) keeps its top header.
- Everything else is the app, with a sidebar. The landing page is always reachable.

**D3. Free $1 to try: "start with 20 USDG".**
- Abu funds a gift wallet with 20 USDG and 0.002 ETH, so the first **20 people** each get **$1 USDG plus 0.00008 ETH** (about 30¢ of gas, enough to create, fund and later withdraw).
- Each wallet claims once, only after signing in. Each IP claims once a day. The total is capped at 20.
- There's a write-ahead journal, so a retry never pays twice. When the 20 are gone, the card says so.
- Minimums drop so $1 can really trade:
  - wallet funding goes from $5 to $1 (`MoneyStep.tsx:15`);
  - the engine's smallest trade goes from $1 to $0.20 (`core/src/wake/needs.ts:16`).
- Our 5¢ of gas on a 20¢ trade is our cost, not the user's.

**D4. Copy trading means copying an agent's trades.**
- The follower gets **their own agent**: their own contract and their own money. The leader can never touch it, because withdrawals only ever go to the owner.
- When the leader acts, every follower makes **the same move as a share of its own value**. Example: the leader puts 12% of its $500 into NVDA, so a follower with $50 buys $6 of NVDA.
- Each copy goes through the follower's own limits, gate and mode. It gets its own record: "Copied from Tech Momentum #41", with its own transaction hash. If the follower can't make the move, a "missed copy" is recorded with the reason.
- **No contract change.** One operator already runs every agent inside its own caps. This is the same runner-replays-per-follower model as Masayume's `placeFor` and Agari's runner.

**D5. Free trading, plus fees for creators.**
- Shijima charges **0% on trading and on the money you hold**, stated everywhere. That is the "free trading".
- A creator can set a **one-time copy fee of $0–$5**, paid when someone starts copying, shown before signing and on the receipt. This is exactly Masayume's `subscribe` fee.
- The fee is split: 80% to the creator, 20% to Shijima (D10).
- Creators see how many people copy them and what they've earned.

**D6. 20 strategies.**
- 18 Stock Tokens pass our liquidity rule today: pool at least $100k, round trip at most 0.75%.
  - The app knows 10 of them: SPY, QQQ, NVDA, AAPL, MSFT, GOOGL, AMZN, META, TSLA, SGOV.
  - It will also add SPCX, CRCL, USO, MU, SLV, INTC, BABA, PLTR.
- That's enough for 20 distinct baskets (listed in step 7). `pnpm strategies:verify` re-checks feeds and pools on mainnet before any of them ship.

**D7. Mainnet, plainly.**
- It's the only network. Every money screen says "Robinhood Chain · real money".
- Practice remains an explicit choice. Agents started with the free $1 default to **On its own** with $1 limits, so people see a real trade.

**D8. OpenServ: the honest, strongest version.**
- There is **no OAuth or "Sign in with OpenServ"** anywhere. I checked the SDK, the docs, the platform bundle and GitHub.
- So we build what really exists, and make it one of the product's headline features: step 6.

**D9. "Live on mainnet" is shown everywhere, with proof** (this is what Abu meant by "live for a minute").
- A pulsing **● LIVE ON ROBINHOOD CHAIN MAINNET** strip, backed by numbers that can't be faked:
  - the current block, read from the chain in the browser every few seconds;
  - "N real trades · $X moved · last trade 12 min ago", each linking to Blockscout;
  - the factory and contract addresses.
- It appears in the landing hero, the sidebar footer, the agent header and the `/live` page.
- A practice agent never wears the LIVE badge. The page says "live network, practice mode" instead.

**D10. Revenue is visible, with no token.** Judges score revenue potential.
- Trading on Shijima is free.
- **Shijima keeps 20% of each creator's copy fee.** The copy drawer shows it as two transfers: 80% to the creator, 20% to the Shijima treasury.
- A **Revenue** section on `/live` and in `/docs` shows fees earned by creators and by Shijima so far.
- This is the "managers compete for capital" model that both Robinhood Chain award rounds funded: AlphaGrid and Tilt (see `docs/research/2026-09-19-winners-report.md`).

## The 21st components chosen (viewed live, not just searched)

| Surface | Component (id) | Why this one |
|---|---|---|
| App sidebar | **Animated Sidebar** (29334) | It collapses to an icon rail (⌘B), and on phones it's a focus-managed sheet with Esc. It uses `motion/react`, which we already have, and respects reduced motion. Calm, and fits our dark look. |
| Sidebar gift and footer | the promo card and profile footer from **Sidebar with Search and Profile** (28489) | The card slot becomes "🎁 Free $1 to try". The footer becomes the wallet. |
| Live-agents carousel (landing) | **Apple Card Carousel** (28160) | Tall cards with a label and a big headline. The headline becomes the agent's latest decision, in its own words, with a sparkline, value and Copy underneath. It has arrows, no autoplay, and scrolls by touch. |
| Live agents directory | **Leaderboard Rankings** (13063) | Ranked rows: rank, avatar (strategy logos), name, value and change, followers, Copy. |
| Overview holdings | **Stocks Dashboard** (29424) | Three stat cards (total value, today, positions) and a holdings table across all your agents. |
| Activity and Needs you | **Notification Panel** (27135) | Tabs All · Needs you · Copies, with Approve/Deny inline, a transaction chip where the file chip was, and "mark all read". |
| 404 | **404 Did You Mean** (29419) | The struck-through path and a "did you mean" suggestion, which is ideal for the Desk→Agent rename (`/desk/showcase` becomes "did you mean `/agents/showcase`"). In our monospace style. |
| Settings | **Settings Sidebar Layout** (28366) | Left sections: Connections · Notifications · Wallet & gas · Appearance · Agents. |
| Connections | **Connect Integration Cards** (28170, already in the repo) and **Integrations 02** (22082) | Big cards on Settings, compact rows for the Overview nudges. |
| Add money / Withdraw sheet | **Withdrawal Card** (7633) | A big amount, then "choose where from/to" rows: your wallet · bridge from Base/Arbitrum · receive from anywhere (QR). |
| Free $1 claim | **Reward Card** (5247) | A gift tile with "Slide to claim your $1". The confetti dependency is dropped. |
| No agents yet | **Empty State with Marquee** (19377) | A moving strip of real live agents behind two actions: Create an agent · Copy an agent. |
| Kept from the last round | Portfolio Chart 29532, Activity Timeline 28340, Stepper 29518, Segmented 23552, Avatar Stack 28355, Number Flow 28181 | Already restyled in our tokens. |

Every component is pulled with `21st get`, restyled in our Masayume/Agari tokens (Sora/Inter/JetBrains Mono, vermilion `#e04d26`, dark first), and uses `framer-motion`→`motion/react`. `21st review` runs after each step.

## Build steps (in order; each committed, then checked in the browser)

### 1. The app shell with a sidebar
- **Route groups.** `app/(site)/` holds the landing page, how-it-works and docs, with today's `ShellChrome`, a top header and the marquee. When signed in, its button reads **Open app →**. `app/(app)/` holds everything else with the new `components/shell/app/AppShell.tsx`.
- **The sidebar**, from 29334 plus 28489:

```
 ◉ SHIJIMA しじま                         → Overview
 [ 0xb5d4…1cf6 · $12.40 USDG · gas ▓▓▓░ ~40 signatures ]
 YOU        ▣ Overview   ⚡ Needs you (2)   ≡ Activity
 YOUR AGENTS  (live, like channels)
            ● Tech Momentum  $52.10 +1.2%   (green running · amber needs you
            ● dev desk        $5.79 +0.4%    · grey paused · ring = practice)
              ↳ copying Tech Momentum
            + New agent
 DISCOVER   ◷ Markets   ◎ Live agents   ▦ Strategies (20)   ▶ Reels
 ⚙ Settings
 [ 🎁 Free $1 to try → ]   or, once claimed:  [OpenServ logo] Runs on OpenServ
 NY closed · Stock Tokens trading          (the existing MarketSessionChip)
 Shijima home ↗
```

- **Signed-out app.** "Your agents" becomes a Connect wallet card plus the gift card. Discover stays open to everyone.
- **Phone.** A bottom bar with Overview · Agents · Markets · Activity · ☰. It **reserves its own height** (today's floating bar covers the stats). ☰ opens the sidebar sheet.
- **Ask Shijima is everywhere** (doc audit #16). A right-side chat drawer, opened with ⌘J or the ✦ in the top bar, uses the agent you're viewing (or your first) as context. It reuses `DeskChat` and the existing ask path. On phones it's a full sheet.
- **New pages the sidebar needs:**
  - `/overview`: combined value and chart (29424 stat cards plus PortfolioChart), Needs you, the latest decision from each agent, and connection nudges ("Telegram ✓ · OpenServ — connect"). With no agents: the 19377 empty state and the gift.
  - `/activity`: every decision across agents on the 27135 panel: tabs All · Needs you · Copies, agent filter, approve inline.
  - `/settings`: account settings (28366): Connections first, Notifications, Wallet & gas, Appearance. Per-agent settings stay at `/agents/[slug]/settings`.
- **Data.** `lib/sidebar.server.ts` returns each agent's value, 24h change, status and copy link, reusing `desksOfOwner` and the `loadDesk` valuation. `lib/nav.ts` replaces `nav-items.ts`.
- **404 and errors.** `app/not-found.tsx` (29419) suggests a route: the desk→agent map, or the nearest agent slug or ticker. It also has `error.tsx` and `global-error.tsx`. All of them render in the shell. `loadDesk` misses call `notFound()`.
- **The rename.** Rewrite about 351 "desk" lines in `packages/shared/src/copy/*.ts` plus the hardcoded TSX strings. Move the routes. Add redirects in `next.config`.

### 2. The agent page, rebuilt decision-first
This replaces `DeskTabs`/`DeskSections`/`AgentCard`/`Plate` in `app/desk/[slug]/page.tsx`, following Agari's cockpit (Latest decision beside Allocation).

**Header.** Logo stack · name · mode badge · creator · "next look 10:25" chip.
- Visitor: **[Copy this agent]**.
- Owner: **[Add money] [Withdraw] [⚙]**.
- Follower: "Copying Tech Momentum · Stop".

**Desktop at 1024px and wider**, two columns, nothing empty:

| Where | Left | Right |
| --- | --- | --- |
| Row 1 | **Latest decision** | **Portfolio** |
| Row 2 | **Activity** | **Limits**, then the money story |

- **Latest decision** is visual, not a wall of text:
  - action chip · token logo · amount · a confidence meter;
  - the one-line reason;
  - the rejected options as chips;
  - tx hash · Share · Open record.
- **Portfolio** is one module:
  - Number Flow value · PortfolioChart;
  - allocation bars, with each holding expanding in place (logo, sparkline, target).
  - "What it holds" is gone.
- **Activity** is the timeline (28340), paginated, with an Ask tab for owners.
- **Limits** is three gauges.
- **The money story:** "Your agent's address 0xc61d… [copy][QR] · Trades: Shijima pays gas, about 5¢ each". For creators: followers and fees earned.

- **Deleted** because it repeated other things:
  - AgentCard's four stat tiles;
  - the second decisions count;
  - QuickActions duplicated inside Settings;
  - NextCheck's repeat of the mode.
- **Phone** is one column in the order header → decision → portfolio → activity. The tab rule in `styles/shijima.css:106-148` goes.
- **Empty states:**
  - no decisions: "First look at 10:25 — here's what it checks";
  - cash only: "$1.00 USDG, ready to buy", with Add money;
  - no history: the balance alone, with no made-up line;
  - stale: "last verified 10:05", with Copy disabled *and the reason shown* (Agari's lesson: never disable silently).

### 3. Live agents: directory, landing carousel, strategies
- **`/agents`:**
  - "Your agents" at the top, with an empty state built on 19377;
  - "Live agents" as a leaderboard (13063), with a sort for top performers, most copied and newest;
  - each row shows the latest decision time and a Copy button.
- **Landing carousel** (28160):
  - each card is an agent: the label is name · mode, the headline is its latest decision sentence, and the foot has a sparkline, value, followers and Copy;
  - one card renders on its own, with no empty scroll track;
  - practice agents are labelled Practice, never Live.
- **Query:** running agents with sharing on, plus the showcase.

### 4. Money: add, receive, withdraw, the free $1, gas shown
- **An Add money sheet** (7633) with three sources:
  - your wallet (a USDG transfer);
  - bridge (the existing `BridgeIn`);
  - **Receive** (address, QR code, and "send only USDG on Robinhood Chain").
- **Withdraw** uses the same sheet, with cash or stocks and some or all. It reuses `ControlDialog`/`ControlForms`/`chain-build.server.ts`.
- **Onboarding MoneyStep** shows two balances side by side: **your wallet** (USDG · ETH) and **your agent** (USDG). The minimum is $1, and "Claim your free $1" sits right there.
- **The gift:**
  - `app/gift-actions.ts` and migration 0009 `gift_claims` (wallet unique, IP hash, status, usdg_tx, eth_tx);
  - the worker sends with `GIFT_PRIVATE_KEY` through the existing write-ahead sender in `packages/chain/src/send.ts`, so the web stays keyless;
  - UI states: eligible · sending · sent (tx link) · already claimed · all 20 gone · failed with retry.
- **The gas meter** in the sidebar wallet chip: owner ETH ÷ the cost of a typical signature ≈ "~40 signatures left", with a "Get gas" link to the BridgeIn gas top-up.

### 5. Copy trading and creator fees
- **Data (migration 0010):**
  - `copy_links` (follower_desk, leader_desk, fee_usdg, fee_tx, status active/paused/stopped, created_at);
  - `desks.copyable` and `desks.copy_fee_usdg`;
  - `decisions.copied_from_decision_id`.
- **Engine:**
  - Mandate gets an optional `follow: {leaderDeskId}` (`shared/src/schemas/mandate.ts`).
  - When it's set, `findNeeds` stops rebalancing by itself. The follower's targets mirror the leader's, and are shown for reference only.
  - A new wake trigger, `copy` (`core/src/wake`): after a leader's action confirms (or after a practice "would have", for practice followers), the worker runs a copy wake per active follower.
  - Size = the leader's move as a share of its value × the follower's value.
  - It then goes through the follower's pregate, gate, mode and the same sender, idempotent on (leader decision, follower).
  - Missed copies are recorded.
- **Copy drawer**, ported from Masayume's `CopyDrawer.tsx` + `copy-progress.ts` (resume after interruption):
  1. How much, with Max and your wallet balance shown.
  2. Limits, prefilled.
  3. The fee.
  4. Signatures: create the agent (with the leader's tokens) → transfer USDG → pay the fee, if it's above $0: 80% to the creator, 20% to Shijima.
  - Every disabled state shows its reason in red.
  - Money can be added inside the drawer.
  - The free $1 is offered if it hasn't been claimed.
  - After copying, the state says "Copying" within one poll.
  - It reuses the create-then-fund code in `CreateStep.tsx`.
- **Creator:** in agent settings, a switch for "Let others copy this agent", a fee from $0 to $5, and a list of followers with fees earned.

### 6. OpenServ as a headline feature
- **Visible everywhere:**
  - the official logos from `openserv.ai/media-kit` (saved to `public/brand/`);
  - "Runs on OpenServ · decisions by SERV Reasoning" on the landing proof section, the sidebar footer, the agent page and the decision page.
- **Connect, in three honest steps** (Settings → Connections, the Overview nudge and the last onboarding step):
  1. **Add Shijima to OpenServ.** A button to `platform.openserv.ai/agents/4513` ("Add to Workflow"). It reads "pending review" until the listing is approved (submit happens at deploy).
  2. **Link your workspace.** A code with a copy button, a QR code and a real expiry countdown. The card polls and turns into "Linked to *Ask Shijima (test)*" with Unlink per workspace (today only a count shows).
  3. **Send decisions to my workspace** (optional). Paste an OpenServ webhook-trigger URL. It's validated by GET, stored encrypted, and the worker POSTs each decision.
- **Other OpenServ agents can run your agent.** New capabilities in `apps/worker/src/openserv/agent.ts`, callable only by linked workspaces:
  - `agent_status` and `latest_decisions` (read);
  - `check_now`, which wakes the engine: safe, because the gate and on-chain caps still decide;
  - `propose_change`, which returns a confirm-on-website link.
  - With the owner's switch "Let my workspace trigger checks", a workspace agent can make your agent look and act **inside your limits**. It can never withdraw or raise limits.
- **Sessions are logged.** Every OpenServ-triggered decision stores the workspace, task id and `workspaceExecutionId`. The agent page and the decision page show "Asked by OpenServ workspace *X* · task #…".

### 7. 20 strategies and 18 tokens
- `scripts/build-tokens.ts` adds the 8 qualifying tokens, with logos in `public/tokens/`, colours in `token-colors.ts`, and feeds.
- `presets.ts` grows to 20 baskets, each with a plain name, a "who it's for" line, weights and cash:
  1. The whole US market
  2. Big tech
  3. The 7 giants
  4. The companies building AI
  5. Play it safe
  6. Chips (NVDA, MU, INTC)
  7. Space and frontier (SPCX, TSLA, PLTR)
  8. Oil and silver (USO, SLV)
  9. Crypto rails (CRCL)
  10. China tech (BABA)
  11. Cash-like, T-bills (SGOV)
  12. Nasdaq only
  13. S&P only
  14. AI software (PLTR, MSFT, GOOGL)
  15. Consumer giants (AMZN, AAPL, META)
  16. Hard assets and cash
  17. Momentum names
  18. Defensive half-cash
  19. Equal-weight all 18
  20. Barbell (SGOV + NVDA/TSLA)
- `pnpm strategies:verify` re-reads feeds and pools on mainnet and fails on any unusable token.
- `/strategies` is a grid with filter chips (broad, tech, AI, commodities, safe, bold). Each card has a 30-day return and "N agents run this". **New agent** opens the studio at `/agents/new`.

### 8. Telegram pictures
- After a trade, and in the daily summary, the bot sends the **share card as a photo**, rendered by the existing OG image route. Portfolio sends a portfolio card image.
- Images stay optional and never delay an approval (the last plan's rule).

### 9. Extras that raise our chances with the judges
I re-read the live hackathon page on 23 Sep. It still has four tracks and scores creativity, user-readiness and revenue potential. The winners research says judges reward real transaction hashes, a track record you can check, a visible fee line, a UI a non-developer can use, and managers competing for capital. They are tired of "propose, gate, execute" demos.

1. **`/live`, the public proof page** (it also fulfils FIDELITY §4.6 "public stats"):
   - the live block;
   - counters for agents, followers, real trades, USDG moved, SERV Reasoning calls (`serv_calls`) and OpenServ runs;
   - the latest 10 on-chain actions with hashes;
   - the revenue section (D10).
   - The landing hero's LIVE strip links here.
2. **A track record on every agent:**
   - The grading at the reopen already exists (`grades`). It becomes a badge like "timing calls graded: 7 of 10 better than waiting", shown on the leaderboard, the carousel cards and the agent header.
   - Only graded, on-chain facts, never a PnL screenshot.
   - The leaderboard sorts by it.
3. **SERV made visible:**
   - Every decision shows "Reasoned with SERV (BRAID)".
   - The landing page gets a small "Same model, with and without SERV" section from the existing `/compare` answers.
   - This proves we **leverage SERV Reasoning**, which is the eligibility rule.
4. **The AgentKit track, a third track entry.**
   - The operator's existing viem wallet is wrapped in Coinbase AgentKit's `ViemWalletProvider`. The agent's actions (buy, sell, sweep, checkpoint) become an AgentKit `ActionProvider` with `supportsNetwork` set to chain 4663.
   - It's the same key, the same contract caps and the same sender. Only the call path changes.
   - We already confirmed this is possible (`docs/research/2026-09-21-tracks.md` §Coinbase). It gets checked with Context7 `/coinbase/agentkit` first.
   - We then tick Mainnet & MCP, Open Track and AgentKit.
5. **Submission readiness**, on the ABU-CHECKLIST:
   - data collection is on, and one full run is done;
   - the X post and the form A475N331;
   - a 3-minute demo video using the `direct-demo-video` skill, after the build.

### 10. Docs and records
- DECISIONS.md gets D1–D10.
- The handoff's §10 is marked resolved.
- FIDELITY.md and PRODUCT-SCOPE.md drop their "no copy trading" lines.
- `/docs` and How it works get the copy, gift, gas and OpenServ sections in dollars.
- BUILD-PLAN's progress log is updated.

## Coverage: every dropped item from the ledger, and where it lands

| Ledger item | Step |
|---|---|
| C1 copy trading · C2 creator fees | 5 |
| OS3/OS4 OpenServ connect, other agents run it · OS6 logos · OS7 sessions shown | 6 |
| M5 faucet · M3/M4 funding story · M6 gas explained | 4 |
| N1 rename · N2/N3 landing reachable, logo · N4/N9 nav · N5 404 · N6 settings in nav | 1 |
| A3/A4 agent page · A7 decision too wordy | 2 |
| A8/C3 empty state with copy · N8/A9 carousel | 1, 3 |
| C4 20 strategies | 7 |
| T4 Telegram pictures | 8 |
| Chat only on the owner page (doc audit #16) | 1 |
| Public stats page (FIDELITY §4.6) · "live on mainnet" marketing | 9, D9 |
| Revenue potential (judging criterion) | D10, 9 |
| N7 landing explains the product | 3 (carousel) and 9 (sections) |
| D5/D6 21st everywhere | every step |
| M11 live proven on mainnet · OS2 submit for review · DP6 submission | Abu's go (below) |

Not in this plan, on purpose:
- `/demo`: Abu said build for users, not judges.
- A native mobile app: the PWA stays.
- Log in with Telegram and the Mini App: these need the deploy domain.

## What Abu does (money and go-lives only)
- Send 20 USDG and 0.002 ETH to the gift wallet. I create it and give him the address.
- Switch the showcase to live with his wallet, so "live agents" are really live.

## Verification
- `pnpm lint`, typecheck, the checks and `pnpm build`. Context7 before any new library call (`motion`, Next 16 route groups, grammY `sendPhoto`).
- **Fork rehearsal** (anvil, `desk_rehearsal`, port 3017, mock-wallet harness):
  1. A fresh wallet claims the gift. A second claim is refused.
  2. It creates an agent with the $1 and gets a real trade.
  3. A second wallet copies it and pays a $1 fee to the creator.
  4. The leader trades, and the follower's trade appears with its own hash and "Copied from…".
  5. Pause stops the next copy.
  6. The follower withdraws.
  7. A linked OpenServ test workspace calls `check_now` and the decision shows the workspace and task id.
- **Browser pass at 390, 768 and 1440px, dark and light**, with `scrollWidth <= innerWidth` asserted and no console errors. I read every screenshot before showing Abu. Checks:
  - the sidebar collapses to a rail, the phone sheet traps focus and closes on Esc, status dots are live, and the gift card leaves after a claim;
  - the landing page is reachable while signed in;
  - Markets comes first in Discover;
  - `/nope`, `/desk/showcase` and `/agents/nope/decision/999` go to the 404 with suggestions or a redirect;
  - the latest decision is above the fold on phone and desktop;
  - Settings, Telegram and OpenServ are one click from anywhere;
  - the Ask drawer opens on every app page.
- `21st review` on the changed paths after each step.
- **Mainnet, after Abu funds:** one real claim, then create, then trade. The tx hashes go into BUILD-PLAN's log.
