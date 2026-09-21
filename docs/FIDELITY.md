# Fidelity: Shijima on Masayume's design

Rewritten 21 Sep 2026, evening, with the `reference-product-fidelity` method. **Masayume replaces Glider** as
the reference, at Abu's request. This file reconciles five things into one contract: Masayume, Agari (Masayume
already ported to US stocks), our current web app, `DESIGN-BRIEF.md`, and the build work still pending. It is
the input for the next plan-mode session. No code has changed.

Everything here comes from source and from documents that already exist. No site was re-captured, because
Stocklana's inventory already did that work (Abu, 21 Sep: "work wisely").

---

## 1. Authority

| | |
|---|---|
| Reference | **Masayume**, `/Users/abu/dev/hackathon/sommina-events`, `main` @ `a255ae9` (live at masayume.app). |
| Starting code | **Agari**, `/Users/abu/dev/hackathon/agari-wt/w1`, branch `integration/w1` @ `695e7ca`. The same design, already given US-stock semantics: market sessions, halts, corporate actions, the gap between the live token price and the last official price, a region gate, a stock page and a proof page. |
| Existing inventory | `stocklana/context/05-masayume-baseline-parity-inventory.md` (pinned to Masayume `68f7a09`): 74 surfaces, their flows, the state contract and a copy-or-rewrite analysis. `stocklana/docs/plan/parity.md` is its ledger. Used as-is rather than redone. |
| Order when sources disagree | 1. Abu's latest decisions. 2. Legal and safety rules: the brief's section 4 wording, section 10, the five promises. 3. Masayume and Agari source. 4. The rest of the brief. 5. Our current app. |
| Baseline strength | Masayume is the minimum for look, shell, flows and states. The brief is the minimum for content. |
| Abu's decisions, 21 Sep | Masayume, not Glider. It is **not a betting place and not a trading place**. Referrals, points and rewards are out. Withdraw always exists. Charts stay, because people want to see what prices are doing, but they inform rather than invite a bet. Onboarding and the dashboard come first. Make it feel like a product, not a demo. |
| Abu's decisions, 21 Sep, evening | **Chat-first.** "Talk to your AI, your AI gets stuff done": it rebalances and it runs strategies. **A strategy is a basket of stocks with target weights**, as on Glider ("The Mag Seven"), never Masayume's meaning of an AI agent or momentum rule. The chain is Robinhood Chain. Enter more than one track. Research Coinbase's agent kit, and adopt it only without compromising what works. |
| Research behind this file | `research/2026-09-21-masayume-port-map.md` (the code, what to strip, the chat design), `research/2026-09-21-chat-actions.md` (each request mapped onto existing code), `research/2026-09-21-tracks.md`, `research/2026-09-21-coinbase-agent-wallet.md`. |
| Provenance | Masayume and Agari are Abu's own. Masayume's interface is a source-led port of **Yosuku** (`Cybire1/yosuku` @ `3c56ef5`, repo now gone). Its README shows an MIT badge, but its tree has no licence file. Abu approved that reuse for Masayume on 1 Sep and for Stocklana on 13 Sep. Our repo is public and MIT, so this is the third time the question comes up (section 7). Fonts are all OFL. |
| Superseded | Glider (`research/glider/`). Kept only for its content ideas, listed in section 9. |

## 2. What changes, in one paragraph

The engine, contracts, worker, record, grading and Telegram stay exactly as they are. The web app takes
Masayume's shell, design system, charts, states, first-run tutorial, AI dock and strategy studio, mostly
copied from Agari, which already made them speak about stocks. Masayume's betting grammar does not come across:
no calls, tickets, odds, leverage, games or leaderboards. In its place goes what the desk actually does: a
strategy, hourly checks, a record, and an AI you talk to that gets things done inside hard limits. Every screen keeps the brief's content rules:
prices carry their source and age, nothing implies profit, and "Stock Tokens" is the only name.

---

## 3. Design system

Copied from source, not redrawn.

| Part | Source | Class |
|---|---|---|
| Tokens, base styles, the Yosuku port (5,871 lines) and about 40 feature stylesheets | `web/src/styles/` in Agari (Masayume's, already adjusted for stocks) | Exact |
| Component-tier tokens (ticket, plate, receipt, badge, countdown, input, buttons) | `web/src/styles/tokens.css` | Exact. The betting components' tokens are left unused. |
| Fonts: **Sora** for display, **Inter** for text, **JetBrains Mono** for small labels and numbers, **Noto Serif JP** for Japanese | `web/src/lib/fonts.ts`, all through `next/font/google`, all OFL | Exact. Noto Serif JP carries the しじま in our wordmark. **This replaces the earlier Inter Tight decision.** |
| Components | shadcn `base-nova` style on Base UI, `components.json` | Exact |
| Charts | `lightweight-charts` 5, `features/markets/hero/PriceChart.client.tsx`, `useChartSeries.ts` | Exact library, adapted series (5.3) |
| Motion | `motion` 12 | **Skipped.** Only one kept file uses it; the rest of Masayume's motion is CSS. |
| Theme | Dark by default with a light theme and a toggle, pre-paint so there is no flash | Exact |
| States | `components/states/` (`EmptyState`, `LoadingState`, `ErrorState`, `StaleTick`, `BlockedButton`, `BoundaryScreen`, `ReadingBoundary`) and the `Reading<T>` contract | Exact |
| Shell chrome | `components/chrome/` (`AppShell`, `TopHeader`, `LiveTicker`, `PillNav`, `WrongNetworkBanner`) and `components/shell/header/` | Exact, with our nav items |

**The accent stays Masayume's orange (`#e04d26`)** for the brand and primary actions. Masayume also uses it for
urgency, like a countdown about to settle. The desk has no such moments, so that use falls away. The countdown
token's "urgent" colour is never triggered, because a check is calm.

**Stack gap.** Masayume connects wallets through RainbowKit on wagmi 2, and Agari through Solana's kit. We use
wagmi 3 with an injected wallet and Sign-In With Ethereum. Stocklana measured that about 75% of Masayume's web
files import no chain library at all. Those copy nearly verbatim. The few that do are rewritten against our
`lib/wagmi.ts` and `lib/session.ts`.

---

## 4. Parity ledger

Masayume's surfaces, by their ids in Stocklana's inventory (L-xx), plus what Agari added. **Excluded** needs
Abu's word. Every row is now ruled on: the open rows were settled at plan approval on 21 Sep. Nothing was
dropped silently.

### 4.1 Shell, first run, money

| Id | Masayume | Shijima | Class |
|---|---|---|---|
| L-01 | Root layout, providers, pre-paint theme, fonts, PWA manifest | Same | Exact |
| L-02 | Desktop header, grouped nav, balance pill, account menu | Same. Nav: **Your desk** (it is the chat), **Markets**, **Strategies**, **How it works**. There is no separate Ask item. The balance pill shows your desks' total. | Adapted |
| L-03 | Mobile floating pill nav and "Everything" drawer | Same | Exact |
| L-04 | Marquee ticker, footer, grain, cursor, theme toggle | Same. The ticker carries our ten Stock Tokens, each price with the market session beside it. | Adapted |
| L-05 | Yosuku design system | Section 3 | Exact |
| L-06, L-07 | Toasts, error boundaries | Same | Exact |
| L-08 | Write-journal recovery on session start | The worker already has a write-ahead for trades. In the browser it covers the owner's own transactions: create, add money, withdraw. | Adapted |
| L-09 | First-run Tutorial, five steps, on `/markets` | Five steps that carry the home page's job [8.1]: what this is, the weekend fact, the five promises, who may not hold Stock Tokens, connect | Adapted |
| L-10 | Wrong-network banner | Robinhood Chain, with "add this network" [8.2] | Exact |
| L-24 | Wallet connect, disconnect, switch | Our wagmi 3 sign-in (section 7) | Adapted |
| L-25 | Get test funds | Not applicable on mainnet. Replaced by L-26. | Adapted |
| L-26 | Add-money modal and first-credit welcome | **Add USDG**: already on Robinhood Chain, or brought from another network through Relay, with the $20 minimum and why [8.5]. The first-credit welcome becomes "Your desk has money. Its first check is at 14:00." | Adapted |
| L-27 | Tap-trading session key: grant, caps, revoke | **Kept, in Desk v1.** The owner grants a browser key once: one key, at most 7 days, revocable. Chat actions in its scope run on one click: withdraw (to the owner only), pause, remove the assistant, lower limits, and sells under the operator's caps and oracle floor. Everything else uses the wallet. The AI operator was already this model: an actor with on-chain caps and a revoke [8.14]. | Adapted |
| L-28 | Trading Balance vault and portfolio plate | The desk's balance plate: cash, holdings, and cash earning in the vault. Masayume's rule "never add up money you cannot spend" becomes the brief's vault-liquidity line. | Adapted |
| Agari | Region gate | The disclosure's "who may not hold Stock Tokens" confirmation [8.3] | Adapted |

### 4.2 Markets, the first page

Masayume opens on `/markets`, with no home page. Abu wants the same. People first see prices moving, with a
chart for each, but the page informs rather than asks for a bet.

| Id | Masayume | Shijima | Class |
|---|---|---|---|
| L-11 | `/` redirects to `/markets` (Agari later built a landing) | `/` routes by who you are: an owner goes to their desk with the chat first, a signed-in wallet with no desk goes to `/strategies`, everyone else goes to `/markets`. The home page's content lives in the tutorial (L-09) and How it works (L-12). | Adapted |
| L-29 | Hero chart with the "opening print" line; a ticket on the right | **Strategies lead**: one chart per strategy, the basket's value against the basket at each stock's reference, with a one-line caption in the desk's voice and markers where desks with sharing on acted or waited. Below it, each Stock Token has its own chart. **The horizontal line is the reference (last official update)**, labelled with its age, never called "last close", and the gap is written as "0.6% above reference" or "in line". The right panel is not a ticket. It shows the facts: market session and when it changes, the price's source and age, cost to trade $500 now, any halt or company event, and two actions: **Start a desk with this** and **See it on Explore**. | Adapted |
| L-30 | Live rail of market cards | The ten Stock Tokens as cards, each with a small chart, the gap to reference and the session | Adapted |
| L-31 | "Just ask" yes/no board | Removed. It is a bet. | **Excluded** (Abu: not betting) |
| L-32 to L-35 | Call ticket, verdict, claims, cash-out | Removed. There are no bets to place, settle or claim. | **Excluded** (Abu: not betting) |
| L-36 to L-40 | Range, Boost (leverage), Parlay, Private, Market Surface | Removed | **Excluded** (Abu: not betting) |
| Agari | Ticker hub, `/tickers/[symbol]` | **One Stock Token** [8.13]: price and reference with age, the gap, the multiplier and its history, company events, cost to trade, and the desk's own decisions about it | Adapted |
| Agari | SessionLanes on How it works | The market clock: open, after hours, overnight, weekend, holiday, early close. The layout is kept; the content, which is all about Windows, is rewritten. | Adapted |

### 4.3 Strategies

**What a strategy is here:** a named basket of Stock Tokens with target weights and some cash, for example The
Mag Seven with about 12% each and 16% cash. It is what the desk keeps you at. It is **not** an AI agent and not a
trading rule. The AI is the desk itself, and there is one per owner. A strategy is what the desk holds. Masayume's
studio is repurposed around this meaning: its AI-versus-momentum choice, runner, registry and publishing are
dropped (`research/2026-09-21-masayume-port-map.md` section 3).

Masayume's strategy studio already says what our desk is: *"Build an AI agent… test its thinking, and set the
limits before it can trade. Hard limits still decide what it may trade."*

| Id | Masayume | Shijima | Class |
|---|---|---|---|
| L-51 | Strategies desk: Create, Copy a strategy, Your strategies | **Strategies**: New desk, Start from a strategy, Your desks | Adapted |
| L-52 | Four-step studio: **Identity & approach → Behavior & limits → Test read → Publish**, with a live agent card at the side (most per trade, most per day, scope, test read) | **Identity & approach**: name the desk, pick a mix (The Mag Seven, Broad Market, Big Tech, AI Builders, Mostly Cash) or set weights yourself [8.6]. **Behavior & limits**: drift tolerance, most per action, most per day, largest holding, loss stop, the size that always asks, and notes in your own words [8.6]. **Test read**: the desk restates everything in its own words and asks what is unclear [8.7]. **Publish**: create the desk, one wallet confirmation with the fee shown [8.4], then add money [8.5]. The side card is the desk card: mix, limits, mode, test read done or not. | Adapted |
| L-53 | Copy a strategy (grant, then subscribe) | **Start from a strategy**: take a public desk's mix as your starting point. Only the mix is copied, never someone's trades. | Adapted |
| L-54 | Agents board | **Desks**: public read-only desks, each with mode, value and last decision [8.19] | Adapted |
| L-55 | Strategy runner and self-host | Our worker, which already exists | Adapted |
| L-56, L-57 | Paid memory market, Reversion preset | Not applicable: both belong to Masayume's agent meaning of a strategy | **Excluded** (Abu, 21 Sep: a strategy is a basket) |
| Strategy AI vs momentum choice | "AI agent" or "Momentum, no AI model" | One approach: the desk's own. AI judges only timing; arithmetic decides everything else. Said plainly on the card. | Adapted |

### 4.4 Your desks, the dashboard

| Id | Masayume | Shijima | Class |
|---|---|---|---|
| L-46 | Portfolio: connect card, balance plate, bets panel, history rows, plate disclosure | **Your desks** [8.9]. For each desk, the plate: total value, change since start and since the last reopen, cash and what it earns, limits in use. Pending approvals sit at the top with a countdown and Approve and Reject. The bets panel becomes **Holdings**: each Stock Token's share against its target, price with source and age, and above, below or in line. History rows become **the record**. | Adapted |
| L-47 | Trader Edge, a report on how your calls did | **The weekend report** [8.12]: each decision graded against the alternative it had, with an honest summary line | Adapted |
| L-49 | Reputation, badges, CSV | CSV becomes **Download the record**. Badges are out, because the brief bans streaks. | Adapted, badges **Excluded** by brief section 10 |
| L-48 | Leaderboard | Removed | **Excluded** by the brief (never planned) |
| L-50 | Earn, the maker vault | **Cash**: USDG earning in the Steakhouse vault at its live rate, interest so far, and how much can be taken out now [8.9]. There is no supplying capital to anyone. | Adapted |
| Agari | Proof, `/proof/[market]` | **One decision, in full** [8.11], ending in the proof and **Check it** | Adapted |
| Agari | Activity | **The record** [8.10]: quiet runs folded into one openable row | Adapted |

### 4.5 The assistant: the chat is the product

Abu, 21 Sep evening: you talk to your AI and it gets things done. Masayume's Sensei gives the look: the dock, the
drawer, the thread, the typewriter wait. But **Sensei cannot act.** It has no tool calls, no streaming, no
confirmations and no grants, only one `generateText` call per question (port map 2.1). The acting chat is new
code. It is designed in port map 2.3 and `research/2026-09-21-chat-actions.md`, and it follows one rule:

**The model proposes. Plain code checks the proposal and saves it with an expiry. The owner confirms on a card.
Only the saved copy runs, through the same guarded path the website and Telegram already use.**

| Path | What | Who confirms | Existing code |
|---|---|---|---|
| Read | "Why did you wait on Saturday?", "How am I doing?" Answers from the owner's own records, each one cited. | nobody | record and value queries, `servJson` |
| A. Sign-in | Switch strategy, change weights or notes, off-chain limits, pause, resume, change mode, approve or reject | the card's Confirm, with ownership re-checked on the server | `applyMandate`, `pauseDesk`, `resumeDesk`, `setDeskMode`, `answerApproval` |
| B. Owner's wallet | Withdraw, on-chain limits, unpause, remove the assistant, sell everything | the owner's wallet signature on a transaction the server prepared | `Desk.sol` owner-only calls |
| C. Trades | Always made by the worker through `gate()` and the contract's caps | the desk, under its limits | the engine |

The card, built from Masayume's `CapabilityReceipt`, shows what changes (before and after), what it cannot do
("never sends money anywhere but your wallet"), who signs, the cost, when it takes effect, and when it expires.

The model is SERV, through `servJson`'s strict schema, which is the output SERV is proven for. The chat core lives
in `packages/core`, so Telegram's free-text messages can use the same brain. The chat is a full-height panel on
the desk page as well as the dock on every page, because it is the main way in, not a side feature.

| Id | Masayume | Shijima | Class |
|---|---|---|---|
| L-41 | Sensei dock (`features/sensei`, `app/api/sensei`, `packages/brain`) | **The chat**: dock and full panel, with the look copied, the brain rewritten on SERV, proposal cards and three confirm paths | Adapted: look copied, acting core Additive (Abu) |

### 4.6 Public pages and operations

| Id | Masayume | Shijima | Class |
|---|---|---|---|
| L-12 | How it works | How the desk decides [8.21] and Withdraw without our website [8.22] | Adapted |
| L-16 | Status | Is the desk awake: last check per desk, the worker's heartbeat, the OpenServ trigger, data sources. "Has not checked in" [8.16]. | Adapted |
| L-15 | Stats | Honest counts: desks, decisions recorded, checks run, fingerprints on-chain | Adapted |
| L-13 | Demo | Judge-facing: a real desk walked through, plus **With and without reasoning** [8.20] | Adapted |
| L-72 | `/dev/*` fixtures | `/dev/states`: every row of 8.16 and every record outcome | Exact |
| L-73, L-74 | Ops health, API surface | Our worker health; `record.json` and the quote route | Adapted |
| L-20, L-21, L-23 | Docs site, legacy redirects, OG images | README and How it works; `/desks` and `/start` redirect to their new homes; OG images | Adapted |
| L-22 | Share cards | Share a decision as a card, drawn in the browser (Agari's canvas renderer). No headline text, because of the news licence. | Adapted (Abu kept it) |
| L-14 | Pitch folio | Not kept | **Excluded** (Abu, 21 Sep) |
| L-17 | News wire | Blocked: Finnhub's licence forbids passing headline text on | **Blocked** |
| L-18, L-19 | Download and PWA install; native app | The PWA manifest comes with L-01. There is no native source. | L-18 Adapted, L-19 **Blocked** |

### 4.7 Not coming across

| Ids | Masayume | Why |
|---|---|---|
| L-31 to L-40 | Every betting ticket and its settlement | **Excluded**, Abu: not betting |
| L-58 to L-60 | Trade from X, X claim, X relay | **Excluded**, Abu: not a trading place |
| L-61 to L-71 | Games, duels, rank, lucky draw, moonshot, arcade | **Excluded**, Abu: not betting. The brief's section 10 also bans casino energy. |
| L-48 | Leaderboard | **Excluded** by the brief |
| L-42 to L-45 | The Room, price alerts, Reels, Takes | **Kept (Abu, 21 Sep), rebuilt without betting.** Rooms: one per Stock Token for desk owners, signed-in wallets, plain text, and an opt-in "holds it" badge. Price alerts: delivered by Telegram and the inbox. Takes: posts tagged with a stock. Reels: stock cards and decisions from desks with sharing on. The chat never reads Room or Take text. |
| Y-01 to Y-18 | Yosuku-only features Masayume already removed | Stay removed, as Abu decided for Masayume |

---

## 5. Screen by screen

Where each brief screen lives now. Masayume's layout carries the brief's content.

### 5.1 First run [8.1, 8.2, 8.3]

Masayume's five-step tutorial over the markets page, ending on Connect.
1. What this is, in two sentences.
2. The weekend fact, with a real number from our own records.
3. The five promises.
4. Who may not hold Stock Tokens, with Agari's region confirmation.
5. Connect and sign. It costs nothing.

The full disclosure is one acceptance before any money moves, and it stays readable from How it works and
settings.

### 5.2 New desk: the studio [8.4 to 8.8]

Section 4.3's four steps. Two brief orders are both covered.
- **Owner has ETH:** create, then add money.
- **Owner has none:** add money first, which also sends about $1 of ETH, then create. The desk's address is
  known before it exists.

After Publish:
1. **Connect Telegram**: a button and a QR code, skippable with the plain warning [8.8].
2. The desk starts in **practice**, with the go-live rule visible from day one: "It can go live after 24 checks
   and once you have read its report" [7].

### 5.3 Markets [8.13 public, 8.19 entry]

Section 4.2. Every chart is one Stock Token's pool price over time, with the reference line and its age. On a
weekend the line is old, and the chart says how old in words. Masayume's `StaleTick` and the `Reading<T>`
states (loading, live, stale, empty, unavailable) already refuse to show an old price as current, which is the
brief's section 10 rule enforced by a component.

### 5.4 Your desks and one desk [8.9, 8.10, 8.11, 8.12, 8.14, 8.15, 8.17, 8.18]

Section 4.4, top to bottom:
1. **Needs you**: approvals with a countdown, and warnings.
2. **The plate**: value, change since start and since the reopen, and **Timing**, what waiting earned or cost
   against acting at once, from the Monday grading. It can be negative, and says so. It needs one new sum:
   trade size times each decision's difference.
3. **Next check and the session**: "US market closed. Reopens Monday 9:30 New York, in 1 day 4 hours."
4. **Holdings.** 5. **Cash.** 6. **Limits in use.** 7. **The record.** 8. **The mandate.**
9. **Practice progress** while it applies, and the fee line: "Fee so far: $0.03, waived."

**Controls**, each one action with one confirmation:
- Add money.
- **Withdraw**: some or all, as USDG or as the stocks themselves, the owner's own address shown and fixed, costs
  first, and a partial offer if the vault is short.
- Pause.
- Sell everything to cash.
- Remove the assistant.
- Change mode.
- Edit the mandate, which goes back through Test read.
- Close the desk.

**Settings** holds Telegram, the share link, the disclosure and appearance.

### 5.5 Ask

Section 4.5. It opens from the dock on any page and from How it works.

### 5.6 States [8.16]

Masayume's state contract (identity, money, reads, market, trade) plus Agari's stock states (pre-market,
regular, after hours, closed, weekend, holiday, early close, halted, company event pending) already cover most
of the brief's table. Where each row shows:

| 8.16 state | Where it shows |
|---|---|
| Paused by you; stopped by your loss limit; has not checked in on time | Next check card and the Needs you strip. Status for the last one. |
| Trading paused in a token; price beyond 8%; price feed unavailable; company event coming | Flags on the holding row and the stock page, using Agari's halt and company-event states. The Needs you strip carries the owner's own sell control where the assistant cannot act. |
| Value jumped with no trade (multiplier); holdings changed outside the desk | A record row that explains it |
| Approval waiting; approval expired | Needs you strip; record row |
| An action failed | Record row with the named cause and the next step, never "Something went wrong" |
| Not enough ETH; wrong network; money on its way | Add money modal; `WrongNetworkBanner` |
| Telegram not connected | A line on Your desks |
| Vault short of cash | Withdraw |
| Network or data trouble | Status, and the `Reading<T>` unavailable state wherever the data is missing |
| Empty desk; brand-new desk with no decisions | `EmptyState` with the next step and when the first check happens |

All of them are reachable on `/dev/states`.

---

## 6. Where Masayume and the brief disagree, and what wins

| # | Conflict | Decision |
|---|---|---|
| C1 | Masayume's words are "call", "bet", "Window", "ticket", "Trading Balance", "winnings". | Ours: desk, mandate, check, decision, record. "Strategy" is kept for a ready-made mix. "Stock Tokens" always, never "tokenized stocks" (legal). |
| C2 | Masayume shows odds, win and loss stamps, and returns. | No odds and no stamps. The Monday grading reads neutrally both ways: "Waiting was better by 1.4%", "Acting on Sunday would have been better by 0.6%". |
| C3 | Masayume uses its orange and countdowns for urgency. | Orange for the brand and primary actions only. The countdown to the next check is calm. |
| C4 | Masayume has no home page. The brief 8.1 has one. | Abu: follow Masayume. 8.1's content moves into the tutorial and How it works. |
| C5 | Masayume has no disclosure. | Ours is required before money, with Agari's region confirmation. |
| C6 | Masayume's strategy can be AI or momentum. | One approach: AI judges timing only, arithmetic does the rest, and the card says so. |
| C7 | Masayume's copy-a-strategy follows another person's trades. The brief never plans copying traders. | Only the mix is copied, as a starting point. |
| C8 | The brief lists chat as "not in the first version". | In. Abu, 21 Sep. |
| C9 | Masayume wallets go through RainbowKit on wagmi 2. | Our wagmi 3 sign-in. Section 7. |
| C10 | Can the owner make the desk act now? | **Settled at plan approval:** chat can start a check now, and the desk still decides. **Do it anyway** runs on a second confirmation, is recorded as the owner's call, is graded as the owner's, and is refused in practice mode. |

---

## 7. Decisions settled at plan approval (21 Sep)

The plan is `/Users/abu/.claude/plans/typed-enchanting-simon.md`.

- **Do it now:** check now, plus do it anyway on a second confirmation (C10).
- **The chat's model calls run in the worker**, through Postgres. The web writes a request row and polls, and it
  still holds no keys.
- **Owner signing:** Masayume's session key, in Desk v1 (L-27).
- **Sign-in:** our wagmi 3 wallet and SIWE, with Agari's wallet-modal look.
- **Left out:** Privy, Coinbase and AgentKit. Abu: the AgentKit track's $1K is not worth it.
- **Yosuku provenance** is accepted, with its notice carried into `THIRD_PARTY_NOTICES.md`.
- **The Timing sum** is built.
- **Extras kept:** share cards, price alerts, Rooms, Reels and Takes. The pitch folio is dropped.
- **Hosting** is not scheduled. It happens when Abu says.

## 8. Blocked

| Item | Why |
|---|---|
| News wire | Finnhub's free licence forbids passing headline text on |
| Native app | No native source exists in the lineage |
| Card payments | No on-ramp sells USDG on Robinhood Chain. The brief also never plans it. |

---

## 9. What carries over from the Glider pass

The Glider work (`research/glider/`) is superseded as a design, but four content decisions made there still hold,
now drawn in Masayume's style:
- **The strategies:** The Mag Seven (Big Tech plus Tesla), Broad Market, Big Tech, AI Builders, Mostly Cash, all
  from our ten tokens.
- **Withdraw:** as cash or as the stocks, the amount on the button, owner-only.
- **Timing in place of Glider's "Fees saved".**
- **The record's quiet runs folded into one row.**

Abu's exclusions from that session carry over too.

---

## 10. Pending work this touches

From `BUILD-PLAN.md` and the brief, still to do. The redesign gives it a home.

**Screens never built:**
- Withdraw [8.15].
- Mandate and safety: edit, mode switch, sell everything, remove the assistant [8.14].
- Settings [8.18].
- Holding detail [8.13].
- Telegram connect on the web; today it is a command line step [8.8].
- Test read [8.7].
- Add money in the page, through Relay [8.5].
- Go-live control and progress [7].
- States page [8.16].
- Comparison page [8.20].

**Engine and data:**
- **Mandate notes never reach the model.** They are stored but nothing in `packages/core` reads them (chat
  actions note). For a chat-first product this is the first fix.
- **The chat core** (`packages/core/src/ask/`): context loaded from Postgres, never from the browser; one
  `servJson` call; the checks; an `ask_proposals` table (desk, kind, args, expiry, status, tx hash); mandate
  drafts using the existing `draft` status; a `chat` channel on the actor type; rate limits by owner and IP.
- The Mag Seven and AI Builders presets, which do not exist yet.
- `insideBand` is computed and unused. Buys ignore the cash target. The Timing sum.

**Port prerequisites (port map risk 1):**
- A small `lib/kit` and a Postgres-backed `Reading<T>` data layer. Masayume's shell, ticker and states import its
  markets runtime, so "copy" only works once these stand in for it.
- Masayume's 35-line wagmi wallet seam, not Agari's Solana one.
- Our `globals.css` token names collide with Yosuku's and must be renamed.
- TypeScript 6 against their 5.9.
- RainbowKit is not added: its peer dependency is wagmi 2.
- A `THIRD_PARTY_NOTICES.md` for the Yosuku CSS.

**Contract.** v1 is written and needs its security review before deployment.

**Launch.** Hosting stays local until Abu says. The desk must be live for the weekend of 26 to 27 Sep. The
submission is due Sun 27 Sep 20:00 UTC: video, X post, Typeform.

**New with this redesign:**
- Port the shell, design system, fonts, states and charts from Agari.
- Rewrite the chain-touching files against wagmi 3.
- Build Markets, the stock page, the Strategies studio, Your desks, the desk page, Ask, Status and the
  tutorial.
- Two new presets: The Mag Seven and AI Builders.

---

## 11. How fidelity will be checked

For each screen as it is built:
1. Run Masayume's and Agari's matching screen from source beside ours, at 390, 768, 1024 and 1440 wide, in both
   themes. That is the same browser pass Agari's stages used.
2. Check every row of section 4 and every state in 5.6.
3. Check the section 6 rules.

The brief's section 10 never-do list and the banned-word check run on every word. No test suite, per Abu: each
screen is proven by running it.
