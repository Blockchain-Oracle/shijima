# What is missing: the whole product, checked on 23 Sep

## What this is built from

**Abu's own words.** Every message he wrote in the 14 sessions on this repo, 19 to 23 Sep, extracted in order
and read in full.

**The plans:**
- the three plans for this repo: `calm-painting-tower` (19 Sep), `typed-enchanting-simon` (21 Sep) and
  `lexical-drifting-token` (22 Sep);
- `DECISIONS`, `PRODUCT-SCOPE`, `DESIGN-BRIEF`, `FIDELITY` and `UX-PLAN`;
- the OpenServ video transcript and `research/2026-09-19-openserv-integration-decision.md`;
- the Glider ledger.

**The running app.** Opened in a browser as a visitor and as the owner, on a desktop and a phone, with one
real chat question asked.

---

## 1. What Shijima is, in Abu's words

- 19 Sep: "The agent manages a huge project and does more yield… USDG… on Robinhood Chain."
- 19 Sep: "It has its own separate app, our web application where the user can see an agent… Telegram, so it
  can notify you." Also: "We could add it as an agent on SERV… their cron jobs."
- 21 Sep: "AI agent is the one running our trades… a portfolio rebalancer." Also: "We have to have an AI that
  you can chat with."
- 21 Sep, on Glider: "It has an onboarding flow. Create your account… different strategies, the Magnificent
  portfolio." Also: "You should be able to withdraw too… you can make your deposit."
- 22 Sep: "It should be able to have its wallet in there in their SERV… they should be able to trade too with
  their agents and log in to our application."
- 23 Sep: "Deposit USDG, and select strategies. You have your AI agent, and the AI agent will be the one
  trading over time. You see the portfolio, all the decisions it made, and you get notified on Telegram.
  Everything around it is an add-on." Also: "It's an automation thing for AI… a way AI can yield… it has to
  feel that way."

**The core loop, in dollars.** You bring $100 of USDG and pick "The 7 giants". Your AI agent buys about $12
of each and keeps $16 as cash. That cash earns about 4% a year in the savings vault while it waits. When
prices move away from your plan, the agent decides whether to rebalance now, do part now, or wait for New
York to reopen. Every decision is written down, fingerprinted on-chain, and graded after the reopen. You see
all of it on your portfolio page, and Telegram tells you when it acts or needs you.

**Add-ons:** Markets, Reels, Rooms, Takes, Compare, price alerts and share cards.

## 2. Everything asked for, and where it stands

| Asked | When | Where it stands |
|---|---|---|
| Deposit USDG first, then strategy, then the agent runs it | 21 and 23 Sep | **Missing.** The studio asks for a basket, limits, a test read, then Create. Money only comes after the desk exists, in "First steps". |
| An onboarding flow like Glider's: choose, deposit, go live, "You're all set" | 21 Sep | **Lost.** It was mapped fully in `research/glider/README.md` (rows `/onboarding/0` to `6`), then dropped when Masayume became the design, because Masayume has no onboarding. |
| A home page that says what this is | 23 Sep (brief 8.1, 19 Sep) | **Missing.** `/` sends visitors to `/markets`. Brief 8.1 was specified and never built (FIDELITY L-11). |
| An AI agent you have, that trades for you | 19, 21 and 23 Sep | **Half.** The engine and chat exist, but every screen says "desk". The agent has no face, no presence, and no "what I'm doing now". |
| Chat with your AI | 21 Sep | **Built**, owner only, inside the desk page. It answers in engineer words ("valued from the 23:02 pool_twap_30m record", "Relies on: record 18"). A visitor can never try it. |
| Yield | 19 and 23 Sep | **Built but invisible.** Vault sweeps work; no screen tells the story. |
| 21st used everywhere | 22 and 23 Sep | **Partly.** Used on the desk page, the studio, strategy cards and settings. The decision page, stock page, markets, How it works, record details, the tutorial and Reels are still plain text blocks. |
| Portfolio chart, logos, strategy cards, bot brand, one-click Telegram | 22 Sep | **Built** (UX plan, commits 3480f6e to 03fddf9). |
| OpenServ: the agent on SERV, published, and usable from there | 19, 22 and 23 Sep | **Thin.** The cron, the listing and the ERC-8004 identity exist. The agent's one capability answers "1 desk running". See §4. |
| Users trade through their agents on SERV, and log in to our app | 22 Sep | **Missing.** See §4. |
| Don't run when there is nothing to do | 23 Sep | **Missing.** It wakes hourly regardless. See §5. |
| Documentation | 23 Sep | **Missing.** README only. The OpenServ 2025 hackathon rubric gave Documentation 10% (research, 19 Sep). |
| Mobile | 23 Sep | Never asked before. Brief §5 says no separate app. FIDELITY L-01 claims a PWA manifest, but **none exists** (`/manifest.webmanifest` is 404). |

## 3. What the running app shows, screen by screen

- **Visitor at `/`:** lands on Markets and a text tutorial. It shows stocks and a basket chart, but no "put in
  USDG, get an agent".
- **Decision page:** eight grey boxes of text. "Why it looked", "What it saw" and "The options it weighed" are
  paragraphs. There is no visual verdict, no chart of the price against its reference, and no picture of the
  proof.
- **Stock page:** a narrow column of numbers and paragraphs. The chart still shows the TradingView logo.
- **How it works:** a very long page of text.
- **Owner desk:** the chat is a blank panel titled "TALK TO IT". Value, chart and holdings are good since the
  UX pass.
- **Studio:** the basket cards are good. There is no money step and no agent.

**Bugs found:**
1. Signed in as Abu, `/` opens the **old, closed desk** (`8426b260…`, paused, closed), not the live one.
   `desksOfOwner` returns it first.
2. On a phone, the bottom pill nav **covers the chat's text box** on the desk page, so you cannot type.
3. The theme button sometimes renders as an empty circle in the header.
4. The stock page chart still carries the TradingView logo.
5. The chat's answers leak internal words (`pool_twap_30m`, "record 18").

## 4. OpenServ: how people reach Shijima through the platform

**The transcript** (video 4:32 to 9:34, 19:31 to 22:13): on OpenServ you add agents to a workspace, and the
Project Manager hands them tasks. Workspaces start from a manual, cron, **webhook** or **Telegram** trigger.
Approved community agents appear under Browse agents, for anyone to add.

**Planned on 19 Sep** (`openserv-integration-decision.md` §4) and not built:
- the webhook trigger, so our app starts a run on the platform;
- files and RAG, so decision records are asked about in plain words;
- x402, so other agents pay to ask the desk a question;
- a template others can clone;
- a weekly track record posted to X.

Built: the cron, the listing and the identity.

**Today** someone who adds Shijima to their workspace gets one capability, and it answers "1 desk running".
That is the gap Abu meant.

**What to build:**
- **Link a workspace to your agent**, with a one-time code, the same as Telegram. That is "log in to our app"
  from the platform side.
- **Real capabilities**, reading only the linked portfolio:
  - how is my portfolio doing;
  - the latest decisions and why;
  - why did you wait;
  - how far a stock is from its reference;
  - the weekly report.
- **"Trade with their agents":**
  - **check now** runs through the same gate and caps as the web chat's Check now;
  - **change my strategy / withdraw** returns a confirm link to our app, because only the owner's wallet or
    session key may do those.

  So a platform user can make their agent act, and nothing can move money outside the owner's limits.
- **The webhook trigger** replaces the hourly cron as the platform's way in (see §5). Every real wake becomes
  a run on OpenServ.

**The agent's wallet on SERV.** Not needed, as Abu said today: the agent already acts through the owner's own
desk contract.

## 5. When the agent runs

Stock Tokens trade on Robinhood Chain all 168 hours, even while New York is shut. That gap is why Shijima
exists.

Abu is still right that a fixed hourly wake is waste. Of the 64 decisions recorded so far:
- 35 are "nothing to do";
- most of the 21 "waited" rows are the same wait repeated with no model asked.

**Change:**
- The 5-minute price logger already runs and costs no AI. It becomes **the watcher**.
- The agent wakes only when something moves:
  - a holding drifts past its tolerance;
  - a price gap moves by 1%;
  - money arrives;
  - a rule fires;
  - a new headline appears;
  - an approval is answered.
- One daily seal keeps the record chain closed.
- Each wake fires the OpenServ workflow by its webhook trigger.

**On screen:** "Watching your portfolio. Wakes when something moves", with the last thing it noticed. This
replaces "next check 00:00". The record keeps only real decisions, plus one line per day: "watched all day,
nothing moved".

## 6. Decisions taken here

1. **The user's word is "your agent", and the page is "your portfolio".** "Desk" stays in code and in the
   contract name. Abu says "AI agent" every time, and "desk" confused the story.
2. **A real home page**, reversing FIDELITY L-11. Agari later built a landing too.
3. **Onboarding follows Glider's three steps:** Choose a strategy · Add USDG · Go on duty. Then "You're all
   set", then "Your agent is on duty". Masayume's look is kept; the flow comes from Glider, as its ledger
   already mapped.
4. **Mobile:** an installable web app (PWA) now, and the Telegram Mini App once there is a public domain. No
   native app: nothing in the rules asks for one.
5. **Docs** at `/docs`, written for users first: start, strategies, the agent, safety, withdraw without us,
   Telegram, OpenServ. Then for developers: the contract and the record format.

## 7. Build order

1. **Fix the five bugs in §3.**
2. **Home page.** The promise, the loop drawn as five steps, live proof, and "Start with $20 of USDG".
3. **Onboarding:**
   - choose a strategy;
   - add USDG (wallet balance shown, Relay for other networks, $20 minimum);
   - meet your agent;
   - one signature creates and funds;
   - Telegram.
4. **The agent gets a presence:** its face and live status on the portfolio page, the chat restyled as
   talking to it, and plain words in its answers.
5. **The watcher replaces the hourly clock**, with the OpenServ webhook trigger.
6. **21st on every remaining screen:** the decision page first, then the stock page, markets, How it works,
   the record details and the tutorial.
7. **OpenServ:** the link code, the real capabilities, and check now through the platform.
8. `/docs` and the PWA.
9. **The add-ons polished last.** The showcase goes live, and the live weekend of 26 to 27 Sep.

---

## 8. The reference: Agari already built this product, better (added 23 Sep, after Abu pointed at it)

Between 22 and 23 Sep another agent ported Shijima's idea into Agari (`agari-wt/w1`, Solana, PreStocks), then
redesigned it:
- **S21, the desk:** plan `~/.claude/plans/quizzical-booping-ocean.md` §5.
- **S22, the desk UX:** `docs/plan/stage-22-desk-ux.md`, merged at `f09c9a3`.

It sits on the same design system as ours (Masayume tokens) and has the same concept, so it is the
reference for every desk screen. Abu's verdict: it "did better". It is his own product, so it is read from
source.

**What it has that we lack:**

| Agari (source under `web/src/`) | What it does | Our gap |
|---|---|---|
| `components/ui/desk-kit/` | One kit of 21st-derived parts: tabs, number ticker, slider, radio cards, status dot, donut, partition bar, radial gauge, sparkline, logo stack, timeline, step progress, empty state, area chart | We built one-off components per screen |
| `features/desk/decision/` (`DecisionHero`, `PriceStrip`) and `DecisionSaw`, `DecisionSections` | A verdict hero with icon and tone, a logo, "Buy $50 of Anthropic", a confidence gauge; what it saw drawn on one price axis with the ceiling shaded; options as chosen/turned-down cards; checks as passed/refused | Our decision page is eight text boxes |
| `features/desk/cockpit/` (`CockpitHeader`, `ValueHero`, `CheckStrip`, `LimitGauges`, `OverviewTab`) | The desk as a cockpit: value hero, next-check strip, tabs Overview · Holdings · Activity · Rules | One long column of cards |
| `features/desk/activity/ActivityTimeline` | The shared timeline with filters and day groups | Ours is similar; theirs is shared by desk, record and decision |
| `features/desk/entry/` (`DeskEntry`, `SharedDeskPreview`) | `/desk` for a visitor with no desk: a hero plus the judges' desk preview | Visitors land on Markets |
| `features/desk/studio/` (`BasketChoice`, `WeightEditor`, `Receipt`) plus `MoneySheet`, `GoLive`, `DeskWatcher` | Studio, money sheet, go-live, and an in-app watcher that toasts when the desk acts | Close to ours; no watcher |
| `features/landing/` | A real home page: hero, three steps, sections, **"Let a desk hold it" with the five promises and the worst case**, proof with explorer links, install | None |
| `features/install/` (`DownloadPage`, `InstallCta`, `useInstallPrompt`) | Install as a phone app from the browser (PWA) | None; no manifest |
| `features/demo/` | `/demo`: a walkthrough video slot, a feature breakdown, and on-chain proofs you can open | None |
| `features/onboarding/` | First-run walkthrough, five steps, ending on Connect | Ours is text only |

**Two engine ideas from S21 match Abu's points exactly:**
- **Event wakes.** The desk wakes on a deposit, on a held company moving 3% or more within an hour, and on
  check now, as well as on its schedule. That is §5.
- **Practice desks are paper ledgers with no transaction.** Anyone, judges included, can try one with pretend
  money and no wallet funds. For us that means: try your agent with a practice $1,000, then add USDG to go
  live.

**Revised build order.** Port, don't patch. Each surface is taken from Agari's source, rewired to our data
(Robinhood Chain, USDG, our record schema), and checked at 390, 768 and 1440 in both themes. 21st is the
component source; the design thinking is ours.

1. The five bugs.
2. Port `desk-kit` into `apps/web/components/ui/desk-kit`.
3. The decision page on `DecisionHero`, `PriceStrip` and `DecisionSections` (our reference and the 8% band
   take the place of their mark and ceiling).
4. The desk as a cockpit (header, value hero, check strip, tabs), with the agent's presence and the chat
   inside it.
5. The home page from `features/landing`, rewritten for "put in USDG, your agent runs it", with the live
   showcase desk as proof.
6. Onboarding: Glider's three steps (choose, add USDG or try in practice, go on duty) on Agari's studio and
   `MoneySheet`.
7. Event wakes replace the hourly clock; the OpenServ webhook trigger.
8. OpenServ capabilities and the link code.
9. `/docs`, the install page and the PWA, and `/demo` for judges.
10. The stock page, markets, How it works and the add-ons, last.

---

## 9. Progress, 23 Sep (same day)

Built, checked in the browser at desktop and phone widths, committed:

| Item | Commit | How it was proven |
|---|---|---|
| The five bugs | `d05a44f` | `/` opens the live desk; the chat answered in plain words; the phone chat box clears the menu; the manifest and icons serve |
| Desk kit ported from Agari, decision page rebuilt | `b2fff91` | decision #2 at 1280 and 390, light and dark, no sideways scroll |
| The AI agent on the desk page, portfolio in tabs | `73c3b8f` | owner view at 1440 and 390 |
| Home page | `8d450e1` | visitor at 1440 and 390, light and dark |
| Onboarding starts from money (Strategy · Add USDG · Limits · Meet your agent) | `2f88251` | walked to the last step as the owner; the header pill fixed ($11.58 was $5.79 counted twice) |
| Watch every five minutes, wake when something moves | `680763d` | anvil fork: quiet looks wrote 0 records, USDG sent in was noticed and the model asked, a quiet day wrote its line; live since 06:00 |
| OpenServ: link a workspace, chat and tasks answered for the desk | `ecdba7f` | through the platform: workspace 13903 linked and got the desk's answer in 4.8 s; the hourly workflow still runs the review |
| `/docs`, README | `0e0d4b7`, `eb14ae4` | page loads; every address checked against `deployments.json` |
| Stock page | `22e5399` | NVDA at 1280 |

**Still to do:**
- Prove create-then-fund with a wallet on the fork (the transfer is a plain USDG `transfer` to the desk; the
  harness from step 10 is gone and needs rebuilding).
- The markets page, How it works (still a long text page), the record page and the first-run tutorial on the kit.
- `/demo` for judges.
- The Telegram Mini App and "Log in with Telegram" wait for a public domain.
- The showcase desk going live needs Abu's wallet (24 practice hours are done).
