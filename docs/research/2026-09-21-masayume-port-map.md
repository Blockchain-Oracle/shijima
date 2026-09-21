# Masayume port map for Shijima

21 Sep 2026. Source reading only: no site was opened, no code or doc changed except this file.

**Sources and pins.**
- `M:` is Masayume, `/Users/abu/dev/hackathon/sommina-events` @ `a255ae9`.
- `A:` is Agari, `/Users/abu/dev/hackathon/agari-wt/w1`, branch `integration/w1` @ `eee1d6c`. FIDELITY pins `695e7ca`; the branch has moved one commit since.
- `S:` is Shijima, this repo.

**How lines were counted.** Non-test `.ts`, `.tsx` and `.css` only (`*.test.*` excluded), with `wc -l`. A file counts as importing a chain library when it has `from "wagmi" | "viem" | "@rainbow-me/rainbowkit" | "@solana/…" | "@somnia-chain/…"`. "Port" means it imports `@masayume/markets` or `@agari/markets`, the chain adapter. "Seam" means it imports `lib/wallet-session`, `providers/wallet` or `features/markets/wallet`, the wallet shell.

## The short version

- **The size of the port.** In the areas Abu wants, about 13.4k lines copy almost as they are, and 9.4k of those are CSS. About 10.2k lines are adapted. About 4.6k source lines have to be written again against our stack. About 17.4k lines are dropped. Games (13.8k) and the other excluded features are not counted. Our whole web app today is 1,696 lines.
- **Agari's feature code imports no chain library at all** (0 direct-import files in every feature). It reaches the chain through two seams: `@agari/markets` and `lib/wallet-session.ts`. Replace those two seams and most of the UI comes across.
- **Sensei cannot act.** It has no tool calls, no streaming, no confirmation step and no grants. The action-taking chat is new work. Section 2 shows how to build it from pieces that already exist.
- **Three corrections to `FIDELITY.md`.**
  - L-41 says Ask "can never trade, change a limit or approve anything". Abu has now reversed that.
  - Motion is listed as "Exact", but only one kept file uses the `motion` package.
  - SessionLanes is listed as "Exact", but its content is entirely about Windows.

---

## 1. Prediction-market pieces inside the parts we port

Verdicts:
- **Strip** means delete.
- **Rewrite** means keep the job, but write new code or copy.
- **Keep, new words** means keep the markup and logic, and change only strings, props or names.

### 1.1 Shell and chrome

| Where | What assumes betting | Verdict |
|---|---|---|
| `A:web/src/components/shell/header/nav-items.ts` (341 lines) | Markets "Trade live price windows." (L39); Games, Practice "without stakes", Duel, Lucky (L45–80); Reels, Parlay; Sensei at `/markets?sensei=1` (L147–153) | **Rewrite**: our five items (Markets, Strategies, Your desks, Ask, How it works) |
| `A:…/header/HeaderMoneyPill.tsx` L17–18, L27 | The sum is "what a bet can actually be paid from" (wallet + Trading Balance); uses the `TUsdcMark` coin | **Keep, new words**: total value of your desks, USDG mark |
| `A:…/header/HeaderAccount.tsx` L67–72 | Menu rows "Trading account" / "Wallet", link to `/portfolio` | **Keep, new words**: "Your desks", wallet USDG |
| `A:…/header/Header.tsx` L6, L25 | Opens `AddFunds`/`CreditWelcome` from "a ticket's top-up gate" | **Keep, new words**: Add USDG |
| `A:web/src/components/shell/Marquee.tsx` L56–62, L112 | "CROWD 62% UP" sentiment cell; "NEXT CLOSE" countdown to the soonest Window | **Strip** both cells. **Keep** the price cells and the session cell (L45–54) |
| `A:web/src/components/chrome/useTickerPrices.ts` L20 | Shows "the series the Window settles on" (`PRICE_BASIS`) | **Rewrite** the data: pool price plus reference, from Postgres |
| `A:web/src/components/data/Odds.tsx` (16 lines) | Cents odds | **Strip** |
| `A:web/src/components/data/Countdown.tsx` L10–37 | Window countdown with an "urgent" state and a "settling" announcement, from `core/lifecycle` | **Rewrite** as a calm next-check countdown (FIDELITY C3) |
| `A:web/src/components/states/LoadingState.tsx` L5, L20–24 | A `ticket` skeleton shape | **Keep**, drop the `ticket` shape |
| `A:web/src/components/receipt/Receipt.tsx` | Props `settledAtMs` and `stamp` (the verdict stamp) | **Keep, new words**: `atMs`; no stamp (C2) |
| `A:web/src/lib/copy.ts` (302 lines) | `WORD_BOARD`, `FAUCET`, `MARKETS`, `HERO`, `HERO_HEAD`, `REELS`, `PORTFOLIO`, `BALANCE`, `SETTLING` | **Rewrite** as our own copy table |
| `A:web/src/lib/copy-{ticket,verdict,lanes,preopen}.ts` (337 lines) | Ticket, verdict, lanes, calls before the bell | **Strip** |
| `A:web/src/lib/theme.ts` L5 | Storage key `agari_theme` | **Keep, new words**: `shijima_theme` |

### 1.2 Design system and tokens

| Where | What assumes betting | Verdict |
|---|---|---|
| `A:web/src/styles/tokens.css` L3–8, L27–31, L47–52, L62–68, L77–86, L93–97, L103 | `--ticket-*`, `--claim-plate-*`, `--verdict-stamp-win/loss/void-*`, `--button-up/down-*`, `--badge-backed-*` (resting orders), `--banzuke-row-*` (leaderboard), `--claim-pill-offset`, `--market-card-odds-font` (L14) | **Keep** the file. The unused tokens are harmless. `--countdown-urgent-ink` (L91) is never triggered (C3) |
| `A:web/src/styles/yosuku/part-01…18.css` (5,871 lines) | Byte-identical split of Yosuku's globals. It includes `.hero-bet`, `.st-side`/`.st-place` (Sensei trade cards), `.banzuke-row`, `.settled-payout`, `.mc-side`, `.podium-spot` (selector count by part) | **Keep verbatim**. `index.css` says "Regenerate the split rather than hand-editing a part file, so fidelity stays checkable." Dead rules cost nothing |
| 22 top-level sheets, 4,660 lines: `ticket*.css`, `reel*.css`, `word-board`, `room*`, `take*`, `leaderboard-theme`, `trader-edge-link`, `news*`, `alerts`, `share-card`, `download`, `pitch*`, `edge*` | Betting and social surfaces | **Strip**, and remove their `@import` lines from `styles/index.css`. Optional keeps: `edge*.css` (346 lines) for the weekend report (L-47) and `pitch*.css` (469 lines) if the pitch folio stays (L-14) |

### 1.3 Markets hero and rail

| Where | What assumes betting | Verdict |
|---|---|---|
| `A:…/markets/MarketsScreen.tsx` L27–41, L59–99 | "The market you are betting on is the page"; `renderTicket`, `renderVerdict`, `LiveHedgeCard`, `WordMarketBoard`, `MarketRoom` "place a bet" | **Rewrite** |
| `A:…/markets/hero/HeroAssetChart.tsx` | The no-Window hero: "the asset is the page", with a prev-close reference line. This is the right base for us. It carries the `ScheduleCallButton` seam (L96) and a `window` prop | **Keep, new words**. Strip the schedule seam and the `window` prop. The line becomes "last official price, N old" |
| `A:…/hero/PriceChart.client.tsx` | Prop `openingRaw`, "the oracle's print"; the line label defaults to "opening print" | **Keep, new words**: `referenceRaw` |
| `A:…/hero/DistanceReadout.tsx` | "UP needs +$x / DOWN needs −$x" (L14–30) | **Rewrite** as "0.6% above reference" or "in line" |
| `A:…/hero/{ScheduleCallButton,HeroQuestion,HeroYesNo,HeroMarket,HeroCadenceTabs,DepthStrip,useTopOfBook,HeroSettlesIn,CountdownBlock,HeroHeader}` (495 lines) | Calls, yes/no, Window cadences, order-book depth, "settles in" | **Strip** |
| `A:…/lanes/MarketCardView.tsx` L20–21, L76–78, L117–163 | UP/DOWN cents, Window countdown, "Holds above $x?", Gap-lane lock and settle | **Keep** the anatomy (head, price, change against the line, `CardSpark`). **Strip** the sides, odds and countdown |
| `A:…/lanes/{CadenceLanes,LaneTabs,LaneRows,TickerLane,NextWindow*,BetweenRounds,ListedCard,MarketCard,lane-view,useLanes}` (812 lines) | The whole Window-lane machine | **Strip** |
| `A:…/markets/session/useMarketSession.ts` | Agari's states: `pre`, `regular`, `early-close`, `halted`, `post`, `closed`, `holiday` (`A:packages/core/src/market/session.ts` L15) | **Rewrite** on `S:packages/shared/src/calendar.ts` (`regular`, `extended`, `overnight`, `weekend`, `holiday`, L17). Keep `MarketSessionChip`'s view |

### 1.4 Portfolio and balance plate

| Where | What assumes betting | Verdict |
|---|---|---|
| `A:…/portfolio/plate/copy.ts` L3–31 | "Ready to bet", "Trading Balance", X-replies and Private pools, "Get test funds", "New to Solana?" | **Rewrite** the copy |
| `A:…/portfolio/plate/useMoney.ts` L30, L100 | `readyToBetBase`; reads the vault, X grant and private desk | **Rewrite**: cash, holdings, cash in the vault |
| `A:…/portfolio/plate/{LedgerPlate,PoolRows,PlateDisclosure}` | Nothing in the markup; it takes a `Money` object | **Keep**. The rule "never add up money you cannot spend" becomes the vault-liquidity line |
| `A:…/portfolio/{BetsPanel,BetRow,RestingRows,useCashOut,useTiers}`, `markets/claims/*` | Open bets, resting orders, cash-out, claims | **Strip**. `BetRow`'s layout is the pattern for the Holdings row |

### 1.5 Strategies studio: section 3. Sensei: section 2

### 1.6 States

| Where | What assumes betting | Verdict |
|---|---|---|
| `A:web/src/components/states/*` (348 lines) | Only the `ticket` loading shape. `ErrorState` imports `openFunds` from funding | **Keep** |
| `StaleTick` and `UtcTime` | Times shown in UTC (`formatUtc`) | **Keep, new words**: New York time, as our copy uses |
| Masayume's state families (`stocklana/context/05…` §2.3) | "Market (Window)" and "Trade" families: upcoming, live, near expiry, settled, voided, claimable, redeemed | **Strip** those two families. Keep identity, money and reads. Agari's stock states map onto ours: FIDELITY §5.6 |

### 1.7 Onboarding tutorial

| Where | What assumes betting | Verdict |
|---|---|---|
| `A:…/onboarding/steps.ts` L29–54 | "A prediction market on stock prices, on Solana", "How a Window works", "Tap UP or DOWN", "what you can bet right now", tUSDC | **Rewrite**: the five FIDELITY §5.1 steps |
| `A:…/onboarding/TutorialChoice.tsx` | "How should markets read?", the Plain-words toggle for the betting board | **Rewrite** as "Connect and sign. It costs nothing." |
| `A:…/onboarding/Tutorial.tsx`, `useFirstRun.ts`, `styles/tutorial.css` | Nothing | **Keep** |

### 1.8 Status, how it works, earn

| Where | What assumes betting | Verdict |
|---|---|---|
| `A:…/status/run.server.ts` L6–8 and the probe files (874 lines) | Probes for faucet, Pyth trial, Switchboard, sponsor, lanes, indexer relay, Window prints | **Rewrite** the probes: worker heartbeat, OpenServ trigger, SERV, RPC, feeds |
| `A:…/status/{StatusScreen,StatusRows,protocol,pipeline,useStatus}` | Nothing. `protocol.ts` already has `expected` for "closed (expected)" rows | **Keep** |
| `A:…/how-it-works/content.ts` L38–178 | Steps "Pick a Window", "Trade UP or DOWN", "Collect Payout"; "Order-Book Pricing", "Fast Rounds"; "Settlement Fee"; settlement steps | **Rewrite** as how the desk decides [8.21] and Withdraw without our website [8.22] |
| `A:…/how-it-works/sessions.ts` L23–45, L57–67, L77–82, L91–106 | Lanes "Regular 5m·15m·60m", "Gap", "Token"; "Calls before the bell"; Pyth/RedStone/Switchboard basis rows; "Voids… both sides pay 0.5"; "tUSDC… tap" | **Rewrite** all the content. The `SessionLanes.tsx` component (104 lines) keeps its layout. **So FIDELITY's "Exact" for SessionLanes is wrong: the content is 100% Window** |
| `A:…/earn/*` | "Earn the spread", maker vault, and range/parlay/boost reserves where "a wallet can be the house" (`EarnScreen.tsx` L13–18, `copy.ts` L8–12) | **Strip**, except `Hero.tsx` and `earn-page.css`, which become the **Cash** panel. An ERC-4626 share price for the Steakhouse vault fits the existing "/ share" display (`copy.ts` L19) |

### 1.9 Agari's additions

| Where | What assumes betting | Verdict |
|---|---|---|
| `A:…/ticker-hub/TickerHubScreen.tsx` L7–19 | `ActivityList` of trades, news rows, `TickerRoomButton`, pre-IPO facts, profile CSS | **Keep** the head, price and session chip. **Rewrite** the feed as "the desk's own decisions about it". **Strip** the room, news (Finnhub licence, L-17) and pre-IPO facts |
| `A:…/proof/*` | Proof of a Window's opening and closing print: Pyth replay, cross-check bps | **Keep** `ProofScreen`/`ProofTable`/`PrintProofReceipt`/`ReverifyButton` as a pattern for "one decision, in full". **Strip** `PythReplayRows`, `replay.server`, `useMarketProof`. `ReverifyButton` becomes our Check it (`S:apps/web/components/check-it.tsx`) |
| `A:…/region/RegionNote.tsx` L12–15, `A:web/src/proxy.ts` L20–21, `lib/region-mark.ts` | "Funded actions are closed in your region"; the geofence reads Vercel's `x-vercel-ip-country` header or `AGARI_REGION_OVERRIDE` | **Keep, new words** as the "who may not hold Stock Tokens" confirmation. Locally the header never arrives, so only the override works until deploy |
| `A:…/activity/*` | Feed items for fills, claims, takes, news | **Keep** the list and CSS. **Rewrite** `items.ts`/`describe.ts` for record rows, with quiet runs folded |
| `A:…/markets/session/*` (Agari's SessionLanes source) | See 1.3 | See 1.3 |

---

## 2. Sensei, end to end, and how to make it act

### 2.1 What exists

| Part | Masayume | Agari | Evidence |
|---|---|---|---|
| Dock and drawer UI | `SenseiDock` 179 lines, `SenseiDrawer` 190 lines, `Typewriter` 52 lines | Same, plus `useSenseiContext` (session, positions, record, holdings) | `features/sensei/` |
| Size | 918 non-test lines | 1,337 non-test lines | line counts |
| Where it mounts | Only on `/markets` | Only on `/markets` | `M:…/MarketsScreen.tsx:82`, `A:…/MarketsScreen.tsx:85`. The nav opens it with `/markets?sensei=1`, and a `sensei:open` window event is handled at `SenseiDock.tsx` L31, L93–114 |
| Dock ring | Drains to the nearest **Window close**, "urgent" under the wire | Same | `A:SenseiDock.tsx` L116–122 |
| Meter and cards | Price, drift, time left, tape. **Trade cards** are UP/DOWN deep links into the ticket | Same | `SenseiDrawer.tsx` L30–63, L160–162; `SenseiTradeCards.tsx` L26–43 explains why the reference's own signing path was removed |
| API route | `app/api/sensei/route.ts`, 99 lines | 110 lines | Node runtime, `maxDuration` 60 |
| Model call | `generateText` from `ai` 7, **not streamed**, `reasoning: "low"`, 4,096 max tokens | Same | `A:route.ts` L1, L33–39, L86–97; comment L25–27: "stays Masayume's non-streaming `generateText`" |
| Streaming | None. The client types the finished reply out (`Typewriter.tsx`) | None | grep for `streamText` or `useChat` finds 0 in both repos |
| Providers | `packages/brain/src/model.ts`: the `AI_MODEL` string, default `anthropic/claude-opus-5`. Uses a direct key if set, then `AI_GATEWAY_API_KEY`, or `AI_BASE_URL` + `AI_API_KEY` for any OpenAI-compatible endpoint | Same file, with the package renamed to `@agari/brain` | `diff -r` of the two `brain/src` folders shows only import renames |
| What the brain holds | `readAgentVerdict` (a `generateObject` read of UP/DOWN) and `decideAgentWindow` (read, then gate), for the strategy runner. Sensei uses only `resolveModel` | Same | `brain/src/index.ts` L1–5: "Nothing here can sign or send." |
| Prompt | "trading companion inside Masayume, a prediction market on DreamDEX (Somnia Shannon testnet)", 82 lines | "…Agari, a stock-price prediction market on Solana", 131 lines. Adds the session line, a positions/record/holdings block, an earnings line, and the advice tripwire | `A:prompt.ts` L29–51, L57–63, L72–111 |
| Rate limit | **None** of its own. It only maps an upstream 429 | `rate.server.ts`: 1 ask per IP per 3 s, 30 per IP per 10 min, 600 an hour house-wide, in memory | `A:rate.server.ts` L7–11 |
| Context source | The browser sends the snapshot | The browser sends snapshot, session, positions, record and holdings, validated with zod | `A:protocol.ts` L74–94 |
| **Tool calls** | **None** | **None** | grep for `tools:`, `tool({`, `toolChoice`, `stepCountIs` finds 0 in `web/src`, `packages`, `services` of both repos |
| **Confirmation or grants** | None in Sensei | None in Sensei | `route.ts` L23: "No trade is placed here. Sensei reads and recommends; the user places the trade." |
| Unused dependency | `@anthropic-ai/sdk ^0.122.0` in `web/package.json` | Same | 0 imports in either repo |

**Answer: Sensei cannot take actions.** It is a one-shot, non-streaming text reply with a typewriter effect. The only "action" it has is a link into the betting ticket.

### 2.2 The permission UI worth reusing

Masayume's tap-trading grant is the closest thing it has to "bounded permission, confirm, revoke". Agari's copy of it:

| Piece | Lines | What it gives us |
|---|---|---|
| `A:…/session/SessionModal.tsx` → `SessionModalShell` (L35–99) | 183 | Centred panel over a scrim, focus trap, Escape to close, body scrolls, **footer CTA always visible on a phone**. This is the shell for every confirmation dialog |
| `A:…/session/CapabilityReceipt.tsx` | 41 | A `<dl>` of **Scope / Never / Key / Expires / Fees / Signatures** (`copy.ts` L46–60). This is exactly the anatomy of a chat confirmation card |
| `A:…/session/CapsEditor.tsx` | 103 | Per-tap and per-day money fields, a positions field and expiry chips. Becomes the limits editor for `setLimits` |
| `A:…/session/SessionManager.tsx` | 167 | Current grant, spent today, when caps reset, **Revoke**, expired and missing-key states. Becomes "Who can act on this desk" and **Remove the assistant** |
| `A:…/vault/VaultGrants.tsx` | 41 | List of live grants |
| `A:…/strategies/useDeskWrites.ts` L58 | (pattern) | "Persist before requesting a signature. If storage is blocked, never start a flow we cannot recover." This is the write-journal rule for multi-step owner transactions |
| `A:…/strategies/CopyDrawer.tsx` L105 | (pattern) | "The deposit will not be repeated": an interrupted two-step flow resumes and never re-sends |

**Drop** the session-key machinery itself (`SessionKeyProvider`, `useKeySession`, `store`, `sponsor.server`, `RouteControl`, `SessionChip`: 916 lines, 8 import the port). Our operator key lives in the worker, and the browser never holds a key.

### 2.3 Design for our action-taking chat

**Principle.** The model only **proposes**. The server checks every proposal with plain code and saves it. The owner confirms on a card. The server acts only on its own saved copy. This is the same rule the Telegram approvals already follow: "A button press proves nothing on its own" (`S:apps/worker/src/telegram/bot.ts:96`, the `approve|reject` handler).

**Flow.**
1. **Dock** (the Sensei dock, now mounted in `ShellChrome` on every page). The owner writes "rebalance me into The Mag Seven".
2. **`POST /api/ask`**. The server reads the signed-in owner (`S:apps/web/lib/session.ts`). It loads the desk context **from Postgres itself**: desk, mandate, holdings, value, next check, pending approvals and recent decisions. Agari lets the browser send positions (`protocol.ts` L90–93). We should not.
3. **One `servJson` call** (`S:packages/core/src/serv/client.ts` L65, the "only door to SERV"). It uses a strict schema: `{ reply, cites: decisionSeq[], proposal: null | { kind, args } }`.
   - This is structured output, not tool calls. SERV strips its own `serv_*` tools, and whether it passes our function tools through is still unproven (`DECISIONS.md` L296 says it was "Tested Sunday with one call").
   - Structured output is what SERV is verified for (client.ts L1–6).
4. **Checks, all plain code.**
   - `presetById` (`S:packages/shared/src/presets.ts:38`) and `checkMandate` (`S:…/schemas/mandate.ts:42`).
   - Amounts against the desk's balances and what the vault can pay out now.
   - Desk state, and ownership through the same `asOwner` as `S:apps/web/app/actions.ts:33`.
   - A failed check becomes a plain reply, never a card.
5. **Save the proposal with an expiry.**
   - A mandate change saves as a `mandates` row with status `draft`, which already exists in the enum (`S:packages/db/src/schema/enums.ts:16`).
   - Chain actions need a small `ask_proposals` table: id, desk, kind, args, expiry, status, tx hash.
6. **Show the card in the thread.** It takes the slot where `SenseiTradeCards` renders (`SenseiDrawer.tsx` L160–162). Its anatomy comes from `CapabilityReceipt`:
   - **What changes**: before and after, such as the targets table or limits old → new.
   - **What it cannot do**: "never sends money anywhere but your wallet".
   - **Who signs**: "your sign-in" or "your wallet".
   - **Cost**: gas, or none.
   - **When it takes effect**: "at the next check, 14:00 New York".
   - **Expires**.
7. **Confirm.** There are three paths.

| Path | Actions | Who confirms | Code that already exists |
|---|---|---|---|
| **A. Sign-in session, database only** | Pause, resume, switch strategy, change weights, drift or notes, change mode (`shadow` / `ask_first` / `on_its_own`, `enums.ts:8`), approve or reject a waiting request | The card's Confirm button runs a server action. The server checks ownership again and re-reads the saved proposal | `pauseDesk`/`resumeDesk` (`S:packages/db/src/queries/engine.ts:369,395`), `applyMandate` (`queries/mandates.ts:23`), `answerApproval`. Per FIDELITY §5.4, a mandate edit goes back through **Test read** first |
| **B. Owner's wallet signature** | Withdraw, set on-chain limits, unpause, **Remove the assistant**, sell everything, withdraw all | The card's button calls `writeContractAsync` with the server's saved args, as `S:apps/web/components/create-desk.tsx:40` does today. The server then checks the receipt | `Desk.sol` owner-only calls: `withdraw` L315, `unpause` L320, `revokeOperator` L331, `setLimits` L338, `batch` L355 ("sell everything", "withdraw all" in one confirmation) |
| **C. Trades** | Never placed from chat | Nobody | The worker makes every trade on its next check, through `gate()` (`S:packages/core/src/wake/gate.ts:77`) and the contract's own caps. FIDELITY C10: "No owner-triggered check." |

**The four example asks.**

| Owner says | Proposal | Path | Reply says |
|---|---|---|---|
| "Rebalance me into The Mag Seven" | Mandate draft with the preset's targets. The Mag Seven preset does not exist yet: `presets.ts` has only `broad-market`, `big-tech`, `mostly-cash` | A, then Test read | "Your targets change now. The desk trades toward them at its next check, 14:00, inside your limits." |
| "Pause the desk" | `pause` | A | "Paused. Waiting requests are cancelled." `pauseDesk` cancels them (engine.ts L378–381) |
| "Why did you wait on Saturday?" | None | Read only | Answer from the `wakes`, `decisions`, `deferrals` and `grades` rows for that day, each cited as a link to `/desk/[slug]/decision/[seq]` |
| "Withdraw $200" | `withdraw(USDG, 200e6)`, plus a vault redemption if cash is short | B | Costs first, the owner's own address shown and fixed, and a partial offer if the vault is short (FIDELITY §5.4) |

**What to reuse and what to change.**
- **Rate limit.** Copy `A:rate.server.ts` as it is. Key it by owner address as well as IP, because every ask costs SERV money.
- **Waiting.** SERV takes 6–10 s (client.ts L5). The existing dots and Typewriter cover it, so no streaming is needed.
- **Voice rules.** Keep the style lines of `A:prompt.ts` L40–49: no emoji, no dashes, no "as an AI", ground truth only.
- **Drop THE BRAKE** (L50). It is about chasing bets.
- **Rewrite the advice tripwire** (`prompt.ts` L57–63). Its regex refuses any "sell … stocks". Our owner may legitimately say "sell everything". The rule becomes: act on the owner's own instruction, and never recommend buying or selling.
- **The dock ring and meter** drain toward the next hourly check, calm, with no urgent colour. The meter shows value, session and next check.
- **Where the chat core lives.** Put it in `packages/core` (for example `src/ask/`), not in `apps/web`. The Telegram bot's free-text handler (`bot.ts:123`) currently only replies with help, and could then call the same core.
- **Split the drawer** into `ChatThread` and `ChatInput`, so the same thread can also be a full-height panel on the desk page. Abu calls chat "the core", and a side drawer alone undersells it.

**Two rules this breaks, which Abu should confirm in `FIDELITY.md`.**
1. §4.5 L-41 and §10 say "It can never trade, change a limit or approve anything" and "no power to act". The new direction replaces that with "proposes; you confirm; the engine and the chain still decide".
2. C10 stays in force. Chat changes the mandate, and the engine picks the timing. A manual wake exists in the worker CLI (`S:apps/worker/src/cli/wake.ts:100`, trigger `manual`). **Recommendation: do not expose it to chat.** Letting the owner force a check undoes the product's point, which is that the AI judges timing.

---

## 3. Strategies studio: strategy = a basket of stocks with target weights

### 3.1 What exists (Agari, `web/src/features/strategies/`, 45 files, 3,672 non-test lines)

The studio is `CreatorStudio.tsx` (113 lines). Its four steps are `["Identity & approach", "Behavior & limits", "Test read", "Publish"]` (L20), with a live side card (L109).

| Step | Component | What it asks today |
|---|---|---|
| 01 Identity & approach | `StudioForm.tsx` L40–57 | Agent name; approach buttons **agent / momentum / reversion / mirror** (L46–52, text L12–17); "Choose another portrait" |
| 02 Behavior & limits | `StudioForm.tsx` L58–76, `StudioAgentFields.tsx` (100 lines), `StudioMirrorFields.tsx` (52 lines) | Agent: persona textarea with counter, gate posture, **Window cadences**. Rule: minimum move from the opening price. Mirror: trader wallet. All presets: **Hard spending limits** per trade and per day |
| 03 Test read | `CreatorStudio.tsx` L99–100, `DryReadPanel.tsx` (73 lines), `useDryRead.ts`, `dry-read-session.ts`, `preview.server.ts` (88 lines) | One real model read on a **live Window**: print, EMA, book cents, the call, the gate's ruling, the model name. Rate-gated to 10 s per IP and 60 an hour (`preview.server.ts` L13–16) |
| 04 Publish | `CreatorStudio.tsx` L70–78; `StudioForm.tsx` L77–91 | Who runs it (house or self-host runner wallet), subscription fee, public playbook; publish to `StrategyRegistry` |
| Published | `CreatorStudio.tsx` L80–90 | Portrait, "Published on Solana", tx link, next-steps list |
| Page | `StrategiesScreen.tsx` (84 lines) | Tabs **Create / Copy a strategy / Your strategies** (L43), `StrategyGrid`, `LiveDesk`, `RecentCopyTrades`, `MemoryMarket`, `CopyDrawer` |

### 3.2 Repurposed

Our `Mandate` (`S:packages/shared/src/schemas/mandate.ts` L19–35) maps field for field onto the studio's steps. Our current `mandate-form.tsx` (177 lines) and `create-desk.tsx` (108 lines) already hold the logic. The studio re-dresses them.

| Step | New content | Built from |
|---|---|---|
| **01 Identity and basket** | Desk name. **Pick a basket**: The Mag Seven, Broad Market, Big Tech, AI Builders, Mostly Cash. Each card shows its weights and cash share. Or **set weights yourself** | Approach buttons (`strat-choice`, `StudioForm` L45–51) become basket cards fed by `PRESETS` (`@desk/shared`). A new weights editor uses `strat-input` rows and `AmountRow` from `DeskInputs.tsx` L10–34, with a live "adds up to 100%" line from `checkMandate` |
| **02 Behavior and limits** | Drift tolerance, most per action, most per day, largest holding, loss stop, "ask me first above", mode, notes in your own words | Drift chips from the threshold chip row (`StudioForm` L62–63). Money limits from the "Hard spending limits" block (L67–73). Mode radio from the posture radio (`StudioAgentFields` L61–72, `desk-modes`). Notes textarea with counter from the persona field (L36–56) |
| **03 Test read** | The desk restates the mandate in its own words and asks what is unclear [8.7]. It writes to `mandates.read_back` (the column exists: `S:packages/db/src/schema/desks.ts:132`) | `DryReadPanel`'s grid and "said" layout; `useDryRead` and `dry-read-session` as they are (cancel on edit, one in flight); `preview.server.ts`'s rate gate, with the body rewritten on `servJson` |
| **04 Create the desk** | One wallet confirmation with the fee shown, then Add USDG. Two orders: has ETH → create, then fund; no ETH → fund first, then create (FIDELITY §5.2) | Publish button and busy states (`CreatorStudio` L105–107) wrapped around our `create-desk.tsx` `writeContractAsync` (L40). The published panel (L80–90) becomes "Connect Telegram", then "Practice: live after 24 checks" |
| **Side card** | Basket, limits, mode, whether the test read is done | `agent-builder-preview` aside (L109). The facts `dl` swaps its rows |
| **Page tabs** | **New desk / Start from a strategy / Your desks** | `StrategiesScreen` L42–44. "Start from a strategy" copies a public desk's **mix only** (C7), through the grid and card, never a grant |

### 3.3 Drop

| Drop | Lines | Why |
|---|---|---|
| Approach choice agent/momentum/reversion/mirror; `StudioMirrorFields`; the posture and cadence halves of `StudioAgentFields` | ≈150 | Strategy means a basket. AI judges timing only (C6) |
| Runner hosting (house or self), runner wallet field (`StudioForm` L80–84) | — | Our worker is the runner (L-55) |
| Subscription fee, public playbook (L86–89) | — | No copy market |
| `useDeskWrites.publish` → `StrategyRegistry`; `registry.server.ts`; `app/api/strategies/*` | 390 + 173 | No registry |
| `CopyDrawer` (STRATEGY grant, subscribe, **fade**), `copy-setup/-release/-progress`, `useSubscriptionFee`, `RecentCopyTrades`, `StrategyXBar` | ≈560 | Copying trades is excluded (C7) |
| `MemoryMarket`, `AgentMemory`, `useSealedMemory`, `memory-protocol` | ≈280 | L-56 recommended excluded |
| `RecordCard` win rate, won and lost (L16–40) | 43 | Banned framing (C2). Replace with the Timing line |
| `AgentPortrait` (DiceBear) | 45 | Optional. Keep it only if desks get portraits. Otherwise drop two dependencies |
| **Name clash.** `A:packages/core/src/strategies` exports `PRESETS` = agent, momentum, reversion, mirror. Ours exports `PRESETS` = baskets | — | Never import Agari's `core/strategies`. Its `describeSpec`, `agentPrompt` and `gateAgentVerdict` are Window logic |

---

## 4. Port map

**Source, prefer Agari.** One exception: the wallet seam. Masayume's `lib/wallet-session.ts` is wagmi-based and much closer to ours than Agari's Solana shell.

**Target.** `apps/web` has no `src/`. Its alias is `@/* → ./*` (`S:apps/web/tsconfig.json`), so Agari's `src/x` maps to `apps/web/x` and every `@/` import still resolves.

**Chain column.** It says which chain coupling a row has: none, **port** (`@agari/markets`), **seam** (`lib/wallet-session.ts`), a direct chain library, or **core** (`@agari/core`, a plain TypeScript library, mentioned only where it is the main coupling).

| # | Source | Lines | Chain | Verdict | Target |
|---|---|---|---|---|---|
| **Shell and chrome** | | | | | |
| 1 | `A:web/src/app/layout.tsx` | 60 | none | adapt | `app/layout.tsx` |
| 2 | `A:components/shell/{ShellChrome,Footer,GrainOverlay,CustomCursor,ThemeToggle,SectionHead,AppStrip,CapabilityPending,AgariMark,index}` | 459 | none (`ShellChrome` imports `BootNotice` from `providers/MarketsBoot`) | copy | `components/shell/` (`AgariMark` → a Shijima mark) |
| 3 | `A:components/shell/header/*` except `nav-items.ts` | 410 | seam (`HeaderAccount`) | adapt | `components/shell/header/` |
| 4 | `A:components/shell/header/nav-items.ts` | 341 | none | rewrite | same |
| 5 | `A:components/shell/Marquee.tsx` | 137 | port (`useLanes`) | rewrite (keep the cell markup) | same |
| 6 | `A:components/chrome/*` | 330 | port (`useTickerPrices`) | copy; rewrite `useTickerPrices` | `components/chrome/` |
| 7 | `M:web/src/lib/wallet-session.ts` | 35 | **wagmi 2** + `@masayume/markets/chain` | rewrite on wagmi 3 + SIWE | `lib/wallet-session.ts` |
| 8 | `A:providers/wallet/*` (RainbowKit look-alike modals) | 1,158 | **@solana/kit** (3 files) | drop. Our injected connect only needs one button. Option: adapt `WalletPicker`/`AccountModal` later | — |
| 9 | `A:providers/{AppProviders,query-client,persist,MarketsBoot,UserSessionProvider}` | 253 | port (4) | rewrite: our `components/providers.tsx` (16 lines) plus wagmi 3 and react-query | `components/providers.tsx` |
| 10 | `A:lib/{fonts,theme,motion,utils,persisted,toast,visibility,use-pager}.ts` | 264 | none | copy (rename the theme key) | `lib/` |
| 11 | `A:lib/copy.ts`, `lib/copy-session.ts` | 368 | none | rewrite | `lib/copy.ts` |
| 12 | `A:packages/core/src/{schemas,units,copy}` (the part the UI imports: `Reading<T>`, formatters, `diagnosisCopy`, session words) | ≈756 (take a part) | core | adapt. Take the types from Masayume's core (`0x` shapes), not Agari's (base58) | `lib/kit/` |
| **Styles and fonts** | | | | | |
| 13 | `A:styles/yosuku/*` | 5,871 | none | copy verbatim | `styles/yosuku/` (keep the depth: the `@source "../../app"` globs rely on it) |
| 14 | `A:styles/{tokens,base,bridge,shell,navigation,modal,toast,tutorial,icons,error,index}.css` | 1,482 | none | copy; trim the `@import` list | `styles/` |
| 15 | `A:styles/{markets-hero,market-card,history,status,how-it-works,stats,demo,demo-sections}.css` | 1,903 | none | copy | `styles/` |
| 16 | 22 betting and social sheets (§1.2) | 4,660 | none | drop | — |
| 17 | `A:web/components.json` (shadcn `base-nova`) | — | none | copy | `apps/web/components.json` |
| **States** | | | | | |
| 18 | `A:components/states/*` | 348 | core | copy | `components/states/` |
| 19 | `A:components/data/*` except `Odds.tsx` | 231 | core | copy; rewrite `Countdown` | `components/data/` |
| 20 | `A:components/data/Odds.tsx` | 16 | none | drop | — |
| 21 | `A:components/receipt/*` | 130 | none | copy (props renamed) | `components/receipt/` |
| 22 | `A:components/ui/*` (Base UI primitives) | 735 | none | copy | `components/ui/` |
| 23 | `A:components/icons/*` (asset marks) | 162 | none | copy; add an SGOV monogram | `components/icons/` |
| 24 | `A:app/dev/states/*` | 858 | none | adapt, with every 8.16 row | `app/dev/states/` |
| **Charts** | | | | | |
| 25 | `A:…/hero/{PriceChart.client,PriceChart,ChartLegend,HistoryRangeTabs,asset-mark}` + `asset-hero.css` | 329 | none | copy | `features/markets/hero/` |
| 26 | `A:…/hero/{HeroAssetChart,HeroAssetHead,HeroChart,HeroChartHead,HeroChartFoot,PriceSourceNote,OraclePrice,DistanceReadout}` | 462 | port (2) | adapt (§1.3) | `features/markets/hero/` |
| 27 | `A:…/hero/{useChartSeries,units}.ts` + `markets/asset-history/*` | 360 | port | rewrite on Postgres `price_points` and `reference_snapshots` (`S:packages/db/src/schema/market.ts` L28, L52) | `features/markets/data/` |
| 28 | `A:…/hero/` Window pieces (§1.3) | 495 | port (4) | drop | — |
| 29 | `A:…/markets/{MarketsHero,MarketsScreen,MarketsPage}.tsx` | 257 | port | rewrite | `features/markets/` |
| 30 | `A:…/lanes/{CardSpark,TickerPicker,ticker-picker.css,useTickerPin,MarketCardView,PausedCard}` | 472 | none | adapt (the rail of ten cards) | `features/markets/rail/` |
| 31 | `A:…/lanes/` Window machine (§1.3) | 812 | port (3) | drop | — |
| 32 | `A:…/markets/session/*` | 317 | port (2) | adapt: keep the chip view, rewrite the hook on `@desk/shared` calendar | `features/markets/session/` |
| **Portfolio plate and Your desks** | | | | | |
| 33 | `A:…/portfolio/plate/{LedgerPlate,PoolRows,ledger-plate.css,PlateDisclosure,Chevron,copy,index}` | 323 | none | copy; rewrite `copy.ts` | `features/desks/plate/` |
| 34 | `A:…/portfolio/plate/useMoney.ts` | 107 | port + seam | rewrite | same |
| 35 | `A:…/portfolio/{PortfolioScreen,ConnectCard,BetsPanel,BetRow}` | 404 | port (2) + seam (2) | rewrite as Your desks and Holdings | `features/desks/` |
| 36 | `A:…/markets/balance/*` | 221 | port | rewrite (the header pill total) | `features/desks/balance/` |
| 37 | `A:…/markets/history/*` | 656 | port (3) | adapt → record rows; `EquitySparkline` | `features/record/` |
| 38 | `A:…/portfolio/{useCashOut,RestingRows,useTiers}` | 268 | port (3) | drop | — |
| 39 | `A:…/vault/VaultGrants.tsx` | 41 | none | adapt → "Who can act on this desk" | `features/desks/` |
| 40 | `A:…/vault/*` rest | 1,134 | port (6) | drop | — |
| 41 | `A:features/activity/*` UI | 770 | seam (1) | adapt → the record | `features/record/` |
| 42 | `A:features/funding/*` UI | 444 | port (2) | adapt → Add USDG, first-credit welcome | `features/funding/` |
| **Strategies** | | | | | |
| 43 | `A:…/strategies/{CreatorStudio,StudioForm,studio-draft,DryReadPanel,useDryRead,dry-read-session,DeskInputs}` + `builder/strategies/desk.css` | 818 | seam (1) | adapt (§3.2) | `features/strategies/` |
| 44 | `A:…/strategies/StudioAgentFields.tsx` | 100 | none | adapt (the notes and mode parts only) | same |
| 45 | `A:…/strategies/preview.server.ts` | 88 | port | rewrite → Test read on `servJson` | same |
| 46 | `A:…/strategies/{StrategiesScreen,StrategyGrid,StrategyCard,LiveDesk,DeskStates,RecordCard,format,copy,AgentPortrait,identity,names,AgentsScreen}` | 1,097 | seam (1) | adapt → Strategies page and public Desks board (L-54) | same |
| 47 | `A:…/strategies/` copy, registry and memory (§3.3) | 1,561 | port (4) + seam (4) | drop | — |
| 48 | `A:app/api/strategies/*` | 173 | port (3) | drop | — |
| **Sensei → Ask** | | | | | |
| 49 | `A:…/sensei/{SenseiDock,SenseiDrawer,Typewriter,copy,index}` | 491 | none (`SenseiDrawer` imports `CardSpark` and `usdLine`) | adapt | `features/ask/` |
| 50 | `A:…/sensei/{useSenseiChat,protocol}` | 196 | none | adapt: add proposal messages | same |
| 51 | `A:…/sensei/{prompt,turn-lines,earnings.server,units}` | 290 | port (1) | rewrite | `packages/core/src/ask/` |
| 52 | `A:…/sensei/{useSenseiSnapshot,useSenseiContext,SenseiTradeCards}` | 312 | port + seam | rewrite (the context moves to the server; `TradeCards` → `ActionCard`) | `features/ask/` |
| 53 | `A:…/sensei/rate.server.ts` | 43 | none | copy | `features/ask/` |
| 54 | `A:app/api/sensei/route.ts` + `sensei/model.server.ts` | 115 | none | rewrite on `servJson` | `app/api/ask/route.ts` |
| 55 | `A:packages/brain/src/*` | 252 | none (AI SDK) | drop | — |
| 56 | `A:…/session/{SessionModal,CapsEditor,CapabilityReceipt,SessionManager,SessionDetail,SessionDetails.module.css,caps,copy}` | 850 | port (1) | adapt → confirmation shell, card, limits editor, revoke | `features/ask/confirm/` |
| 57 | `A:…/session/` key and sponsor machinery | 916 | port (8) | drop | — |
| **Tutorial** | | | | | |
| 58 | `A:…/onboarding/{Tutorial,useFirstRun}` | 144 | seam (1) | copy | `features/onboarding/` |
| 59 | `A:…/onboarding/steps.ts` | 66 | none | rewrite | same |
| 60 | `A:…/onboarding/TutorialChoice.tsx` | 30 | seam | adapt | same |
| **Status** | | | | | |
| 61 | `A:…/status/{StatusScreen,StatusRows,protocol,pipeline,useStatus,copy}` | 343 | port (1, via `copy`) | copy (new words) | `features/status/` |
| 62 | `A:…/status/` probes, grade, run | 874 | port (2) | rewrite | same |
| **How it works** | | | | | |
| 63 | `A:…/how-it-works/{HowItWorksPage,Steps,Faq,rise,SessionLanes,index}` | 311 | none | copy | `features/how-it-works/` |
| 64 | `A:…/how-it-works/{content,copy,sessions}` | 370 | none | rewrite | same |
| 65 | `A:…/how-it-works/{Mechanics,Settlement}` | 152 | none | adapt | same |
| **Cash (from earn)** | | | | | |
| 66 | `A:…/earn/{Hero,earn-page.css,format}` | 247 | none | adapt → Cash panel | `features/desks/cash/` |
| 67 | `A:…/earn/` rest | 1,097 | port (4) + seam (3) | drop | — |
| **Agari's additions** | | | | | |
| 68 | `A:features/ticker-hub/*` | 371 | port (3) | adapt → One Stock Token [8.13] | `features/stock/` |
| 69 | `A:…/proof/{ProofScreen,ProofTable,PrintProofReceipt,ReverifyButton,proof-page.css,copy,format,index}` | 410 | port (6) | adapt → one decision, in full | `features/decision/` |
| 70 | `A:…/proof/{PythReplayRows,replay.server,useMarketProof}` | 117 | port (2) | drop | — |
| 71 | `A:features/region` + `lib/region*.ts` + `src/proxy.ts` | 162 | none | adapt → the disclosure's region confirmation | `features/region/`, `apps/web/proxy.ts` |
| 72 | `A:…/markets/{ticket,verdict,claims,reels,word-board,faucet}` + `bet-against.ts` | 4,746 | port (25) + seam (13) | drop | — |

**Totals from this table.**

| Verdict | Lines | Notes |
|---|---|---|
| Copy | ≈13,400 | Of which ≈9,400 are CSS. The TypeScript part is about 4,000 lines |
| Adapt | ≈10,200 | About 1,000 of it CSS |
| Rewrite | ≈4,600 | Source lines replaced by new code on our stack |
| Drop | ≈17,400 | Within these areas. Games, parlay, range, leverage, private, surface, X, room, takes, alerts, leaderboard, hedge and landing are not counted |

**Before most "copy" rows compile**, two things have to exist:
- the small `lib/kit` (row 12);
- a data layer that yields `Reading<T>` from Postgres.

Without them, the shell pulls in the whole Agari markets runtime (see §6).

---

## 5. Dependencies

Versions: Masayume's and Agari's `pnpm-workspace.yaml` catalogs (identical), plus `web/package.json` in each; ours from `S:apps/web/package.json` and `S:pnpm-workspace.yaml`. Resolved versions come from each `pnpm-lock.yaml`, and from Agari's installed `node_modules`.

| Package | Masayume | Agari | Shijima | Conflict or advice |
|---|---|---|---|---|
| next | 16.3.4 | 16.3.4 | 16.3.5 | None |
| react, react-dom | 19.2.8 | 19.2.8 | 19.3.0 | None |
| typescript | ^5.9.0 (5.9.3) | same | 6.0.3 | **Expect type errors on copy.** Their code was never checked under TS 6 |
| zod | ^4.1.0 (4.5.4) | same | 4.6.5 | None |
| viem | ^2.38.0 (2.56.0) | not in web | 2.56.8 | None |
| wagmi | ^2.19.0 (2.19.5) | none | **3.7.7** | Masayume's wallet code is wagmi 2. Rewrite `wallet-session.ts`, which is 35 lines |
| @rainbow-me/rainbowkit | ^2.2.11 | none; its modals are replicated without the package (`A:THIRD_PARTY_NOTICES.md` "Wallet modals") | none | **Conflict.** Its peers are `wagmi: ^2.9.0` and `viem: 2.x` (`M:pnpm-lock.yaml`). **Do not add.** Our `lib/wagmi.ts` notes kits were broken on wagmi 3 |
| @solana/kit, kit-plugin-wallet, @solana/react | — | ^8.3.0, 0.20.0, ^8.3.0 | none | Drop, with `providers/wallet` |
| @tanstack/react-query | ^5.90.0 (5.102.8) | same | 5.103.1 | None |
| tailwindcss, @tailwindcss/postcss | ^4.1.0 (4.3.3) | same | 4.3.3 | None. Yosuku uses `@import "tailwindcss" source(none)` plus `@source` globs |
| lightweight-charts | ^5.2.0 (5.2.1) | same | none | **Add 5.2.1.** No peers, so no conflict. Used by `PriceChart.client.tsx` and `useChartSeries.ts` |
| @base-ui/react | ^1.7.0 (1.7.0) | same | none | **Add.** Peers `react ^17–19`; date-fns peers are optional. Used by 17 files, all `components/ui/*`, `DesktopNavMenu` and the `Tutorial` dialog |
| motion | ^12.43.0 | same | none | **Skip.** Only `features/funding/CreditWelcome.tsx` uses it outside games. The rest of the motion is CSS. FIDELITY §3's "motion 12, Exact" overstates it |
| lucide-react | ^1.38.0 | same | none | Add (60 files use it) |
| class-variance-authority, clsx, tailwind-merge, tw-animate-css | 0.7.1, 2.1.1, 3.6.0, 1.4.0 | same | none | Add. The UI primitives need them, and `styles/index.css` imports `tw-animate-css` |
| shadcn | ^4.19.0 (listed as a runtime dependency) | same | none | It is a command-line tool, not a runtime library. Dev-only at most |
| idb-keyval | ^6.3.0 | same | none | Skip. Only the persisted read cache and the session-key store use it, both dropped |
| @dicebear/core, @dicebear/notionists | 9.4.3, 9.4.2 | same | none | Only if desks get portraits |
| qrcode-generator | 2.0.4 | same | none | Worth adding for the Telegram connect QR (FIDELITY §5.2) |
| **ai, @ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/google** | ^7.0.87, ^4.0.46, ^4.0.53, ^4.0.59 (web and `packages/brain`) | same | none; we use `openai` 5.23.2 through `servJson` | **No version conflict**: their peers accept zod ^4.1.8. **Policy conflict**: `S:packages/core/src/serv/client.ts` L1 says "The only door to SERV Reasoning." A second model client would bypass SERV's guard and its logging to `serv_calls`. **Do not add** |
| @anthropic-ai/sdk | ^0.122.0 | same | none | Declared but never imported in either repo. Skip |
| iron-session | — | — | 9.0.1 | Ours; keep |

---

## 6. Other things Abu should know

**Provenance.**
- Our repo has `LICENSE` (MIT) and **no `THIRD_PARTY_NOTICES.md`** (`git ls-files`).
- Copying `styles/yosuku/*` brings in Yosuku's CSS. Yosuku's tree has an MIT badge but no licence file, and no known copyright holder (`A:THIRD_PARTY_NOTICES.md` "Yosuku product and presentation").
- Abu approved this reuse for Masayume and Stocklana. FIDELITY §7 recommends accepting it again.
- The notice to carry is Agari's 82-line file, cut down to what we ship:
  - the Yosuku section;
  - fonts (Sora, Inter, JetBrains Mono, Noto Serif JP, all OFL);
  - asset marks (simple-icons CC0, with the trademark caveats);
  - the RainbowKit MIT notice, only if we take Agari's wallet modals;
  - DiceBear, only if portraits stay.

**Asset marks.**
- Agari's marks cover 9 of our 10 tokens. Tesla, NVIDIA, Apple, Meta, Amazon, Google and Microsoft have marks. SPY and QQQ are monograms, which already exist.
- **SGOV needs a monogram.**
- Amazon's mark comes from simple-icons 14.15.0. It was later removed "pending permission" (notices file). This is a trademark caution, not a blocker.

**Hidden coupling.**
- **The shell is not self-contained.** `Marquee.tsx` imports `useLanes` from `@agari/markets/react`. `useTickerPrices.ts` imports `useAssetPrice`. `HeaderMoneyPill` and `HeaderAccount` use `useBalancePlate` (the markets balance sheet). `ShellChrome` needs `BootNotice` from `providers/MarketsBoot`. `ErrorState` imports `openFunds` from funding. Porting "the shell" means cutting these five first.
- **The UI leans on `@agari/core`.** The kept files import `@agari/core/types` 30 times, `/units` 27, `/market` 27, `/schemas` 10, `/copy` 7 and `/lifecycle` 6. `/market` is Agari's Alpaca-fed session calendar. Replace it with `@desk/shared` `marketClock`, whose state names differ.
- **Token names collide.** Our `app/globals.css` defines `--color-ink`, `--color-accent`, `--color-ink-soft`, `--color-line`, `--color-acted/waited/blocked`. Yosuku defines `--color-ink` and `--color-accent` with other values. Every current page (`text-ink-soft`, `border-line`) must be re-skinned, or bridged in `styles/bridge.css`.
- **Sensei's data is all Windows.** `useSenseiSnapshot` builds from a `LaneSet`, and its meter and ring count down to a Window close. None of that data layer survives. Only the UI does.
- **The advice tripwire would refuse our own commands.** `ADVICE_TRIPWIRE` (`A:prompt.ts` L57) matches "sell … stocks".

**Surprises.**
- **`FIDELITY.md` and Abu's new direction disagree on Ask.** L-41 says "It can never trade, change a limit or approve anything". §10 says "no power to act". Both need updating before plan mode.
- **SessionLanes is not "Exact".** Its component is reusable, but `sessions.ts` is entirely Windows, lanes, voids and tUSDC.
- **Our presets lack two strategies.** `S:packages/shared/src/presets.ts` has only Broad Market, Big Tech and Mostly Cash. **The Mag Seven and AI Builders do not exist yet**, and chat's flagship example depends on the first.
- **Two things called `PRESETS`.** Agari's `core/strategies` `PRESETS` means agent, momentum, reversion, mirror. Ours means baskets. Keep Agari's core out of the web app.
- **A precedent for chat actions.** Masayume and Agari already have one: the X relay. `A:packages/core/src/x/parse.ts` (166 lines) parses a message into one command, refuses unknowns, executes once inside an EXECUTOR grant, and replies with a receipt. The pattern is sound. It is deterministic, not an LLM, which is why §2.3 has plain code decide and the model only propose.
- **The region gate only works on Vercel.** It reads `x-vercel-ip-country` (`A:web/src/proxy.ts` L20). Local-first means only the override variable exercises it until deploy.
- **Branch drift.** Agari `integration/w1` is at `eee1d6c`, one commit past FIDELITY's pin `695e7ca`: "a private bet that lost its reply can be resumed again". That commit touches only the private desk, which is dropped.
