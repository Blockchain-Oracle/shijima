# Shijima feature ledger — everything Abu asked for, Sep 19–23 2026

Source: every message Abu sent across all 16 sessions in `abu-messages.md` (127 messages, 64 unique; 58 were teammate reports or task notifications, which are left out). Code checked in `/Users/abu/dev/hackathon/open-serv` on 23 Sep.
Status: **BUILT** / **PARTIAL** / **MISSING**. "SUPERSEDED" means Abu later reversed the item himself. Where a status only matters for process, the column says n/a.
(This was written here because plan mode was on and blocked writing to the scratchpad `feature-ledger.md`.)

## Money / funding

| # | Item | Abu's words (short) | Date | Status | Evidence |
|---|---|---|---|---|---|
| M1 | Users deposit USDG into their agent | "user is have to deposit USG… You just forget about that" | 23 Sep 03:36 | BUILT (flow), PARTIAL (not explained up front) | `apps/web/features/desk/DeskControls.tsx`, `features/strategies/FirstSteps.tsx` |
| M2 | Withdraw must always exist | "we are not a trading place. You should be able to withdraw too" | 21 Sep 10:51 | BUILT | `DeskControls.tsx`, session withdraw `features/session/*`, `Desk.sol` |
| M3 | "Your agent is the wallet": deposit goes to the agent, as in Stocklana | "It's your agent that is the wallet… go look at Stockplaner… You could deposit" | 23 Sep 09:06 | PARTIAL: the desk contract holds funds, but the empty state and home don't say so | `apps/web/app/desks/page.tsx` (plain empty state) |
| M4 | How a user funds their wallet in the first place | "how will user fund their wallet? … must have had 20 USD from my wallet" | 23 Sep 09:06 | PARTIAL: bridge in from Base/Arb/ETH/BNB through Relay; no fiat or CEX on-ramp | `features/desk/BridgeIn.tsx` |
| M5 | One-time $1 USDG mainnet faucet, plus gas, for new users | "giving user faucet, mainnet faucet, like maybe 1 USG… one-time thing… give them… for gas" | 23 Sep 09:06 | MISSING | no faucet/grant code (grep `faucet|starter` found nothing) |
| M6 | Gas for the agent's trades explained | "how is the gas fee working? … chances are you might not have thought about it" | 23 Sep 09:06 | PARTIAL: the operator pays and the worker warns on low gas; not shown to users | `apps/worker/src/review.ts:61` (`LOW_GAS_ACTIONS`), `copy/how.ts` "Network fees" |
| M7 | Idle yield: agent manages money and "does more yield" | "the agent manages a huge project and, like, does more yield… USG" | 19 Sep 10:14 | BUILT (Morpho vault sweeps) | commit 62b87774 session; vault code in `packages/core` |
| M8 | Everything happens on mainnet | "Everything here has to happen on mainnet" | 23 Sep 09:06 | BUILT: v1 is deployed on mainnet | commits `292e9ab`, `03fddf9` |
| M9 | Mainnet/testnet toggle | "Users can be able to toggle between mainnet and testnet" | 19 Sep 10:14 | SUPERSEDED by M8 (MISSING in code, no `testnet` anywhere) | — |
| M10 | Costs shown before signing | "the cost is shown and more… I really like it" (praise) | 23 Sep 09:06 | BUILT | `ProposalCard.tsx`, the stock page cost tile |
| M11 | Real mode, not only paper | "we're still running this on paper mode. I've never run this on real mode" | 23 Sep 09:06 | PARTIAL: practice mode first, go-live after 24 checks | `packages/db/src/queries/engine.ts` `GO_LIVE_CHECKS` |

## Copy trading / creator economics

| # | Item | Abu's words | Date | Status | Evidence |
|---|---|---|---|---|---|
| C1 | Copy trading: copy a running agent | "they should be able to copy trade, man… you should be able to copy an agent" | 23 Sep 09:06 (he says he asked earlier) | PARTIAL: "Start from a strategy" copies a shared desk's *mix* once; there is no live follow or mirroring | `features/strategies/StrategiesScreen.tsx:43-45` |
| C2 | Creators take fees on agents others copy | "as a creator, you should be able to take fees… I remember telling you" | 23 Sep 09:06 | MISSING | no creator or performance fee code; `Desk.sol` has none |
| C3 | Copy-trade options on the empty "your desks" page | "maybe… you will now be bringing copy trading options on your DEX, because the DEX is empty" | 23 Sep 09:06 | MISSING | `apps/web/app/desks/page.tsx` none-state is one line and a link |
| C4 | Many strategies ("20 different strategies") like Masayume/Agari/Stocklana | "We should have free trading and 20 different strategies" | 23 Sep 09:06 | PARTIAL: 5 presets plus custom weights | `packages/shared/src/presets.ts` |

## Strategies

| # | Item | Abu's words | Date | Status | Evidence |
|---|---|---|---|---|---|
| S1 | Strategy = basket of stocks (Glider's "Magnificent" portfolio, AI stack) | "they have the Magnificent something portfolio… like for AI stack" | 21 Sep 10:30 | BUILT | `presets.ts` (`mag-seven`, `ai-builders`) |
| S2 | Plain basket names, no jargon | "Who the hell want to understand what… broad market is" | 22 Sep 19:52 | BUILT (renamed: "The whole US market", "The 7 giants") | `presets.ts:19-52` |
| S3 | Strategy cards with token logos, tabs, not a flat dump | "None of the tokens… logos… You didn't do it like a tab" | 22 Sep 19:52 | BUILT | `StrategyCard.tsx` (TokenStack), Strategies tabs |
| S4 | The AI rebalances and runs strategies (portfolio rebalancer) | "AI agent is the one running our trades… portfolio rebalancer" | 21 Sep 10:03 | BUILT | `packages/core/src/wake/gate.ts`, `pregate.ts` |
| S5 | Strategies studio / create-agent flow | Glider onboarding "Create your account" | 21 Sep 10:30 | BUILT | `features/strategies/Studio.tsx`, `CreateStep.tsx` |

## Agent page (the "desk")

| # | Item | Abu's words | Date | Status | Evidence |
|---|---|---|---|---|---|
| A1 | AI you chat with ("talk to your AI, it gets things done") | "we have to have an AI that you can chat with" | 21 Sep 10:30; again 23 Sep 03:36 | BUILT | `features/desk/DeskChat.tsx`, `apps/web/app/api/ask` |
| A2 | Portfolio chart / history on the agent | "your portfolio, there's no charts… How… it has gone, nothing" | 22 Sep 19:52 | BUILT | `PortfolioChart.tsx`, `DeskValueChart.tsx` |
| A3 | Decisions near the top | "decisions is one of the important stuff. So why is it not coming up early?" | 23 Sep 09:06 | MISSING: Record sits in the second tab ("activity") under chat, value and portfolio | `app/desk/[slug]/page.tsx:119-132` |
| A4 | Remove the redundant "what it holds", fold into portfolio; holdings below | "Why… a separate section that says what he holds? … redundant" | 23 Sep 09:06 | MISSING: `Allocation` and `Holdings` are still separate panels | `app/desk/[slug]/page.tsx:127-128` |
| A5 | Fix the desk grid: settings belong under the agent, not under value | "You did not design the grid well… supposed to be under… the agents own, not under the value" | 23 Sep 09:06 | PARTIAL/unclear: tabs portfolio/activity/settings | `features/desk/DeskSections.tsx` |
| A6 | Tx hash per decision and a shareable card | "you can view the transaction hash… you can share this card" (praise) | 23 Sep 09:06 | BUILT | `features/share/*`, `components/check-it.tsx` |
| A7 | Decision/reasoning UI not a wall of text | "the reasoning. Everything is just plain, like too much text… bad UX" | 23 Sep 03:36 | PARTIAL: DecisionHero/confidence gauge added | `features/record/DecisionHero.tsx` |
| A8 | A better empty state for "this wallet does not own a desk" | "I don't like this design… when it's empty" | 23 Sep 08:48/09:06 | MISSING | `apps/web/app/desks/page.tsx:40-50` |
| A9 | Showcase/live-agent section done better | "this showcase… needs to be better. This is bad" | 23 Sep 09:06 | PARTIAL: one showcase desk card on home | `features/home/HomePage.tsx:25,175` |
| A10 | Get notified when things happen | "do you get notifications when some stuff happen" | 19 Sep 10:57 | BUILT | Telegram outbox and bell `HeaderInbox.tsx` |
| A11 | Safety add-ons: caps, pause, kill switch (from research) | (accepted research) | 19 Sep | BUILT | `Desk.sol`, `DeskControls.tsx` |

## Navigation / shell

| # | Item | Abu's words | Date | Status | Evidence |
|---|---|---|---|---|---|
| N1 | Call it "agent", not "desk" | "why are you calling it DEX? It should be an agent… DEX is confusing" | 23 Sep 09:06 | MISSING: nav says "Your desk", copy says desk ~129 times vs agent 17 | `packages/shared/src/copy/web.ts:22` |
| N2 | Landing page reachable when signed in | "if I'm signed in, I cannot go to my landing page" | 23 Sep 09:06 | MISSING: `/` redirects signed-in users | `apps/web/app/page.tsx:22-27` |
| N3 | The logo should not send you to Strategies | "I keep clicking on the Shijima and it takes me to strategies" | 23 Sep 09:06 | MISSING: logo → `/` → `redirect('/strategies')` when there is no desk | `Header.tsx:35`, `page.tsx:26` |
| N4 | Markets before Your desk in the nav | "Market was supposed to be first" | 23 Sep 09:06 | MISSING: order is desk, markets, reels, strategies | `components/shell/nav-items.ts:84-90` |
| N5 | Custom 404 page | "we need our own custom 404 page" (said 3 times) | 23 Sep 09:06 | MISSING: no `app/not-found.tsx` | `apps/web/app/` |
| N6 | Settings visible in navigation | "I'm not seeing the settings… on the navigation" | 23 Sep 09:06 | PARTIAL: only in the account menu | `HeaderAccount.tsx` |
| N7 | Hero, marketing and landing page that explains the product | "from the hero page to the marketing page… they will not understand what we're about" | 23 Sep 03:36 | PARTIAL: HomePage exists; the core flow (deposit USDG → strategy → agent trades → Telegram) may be unclear | `features/home/HomePage.tsx` |
| N8 | Carousel of live agents | "do that… as a carousel, the live agent. The more we have more agents" | 23 Sep 09:06 | MISSING: one showcase desk, no carousel | `HomePage.tsx` |
| N9 | Add-ons stay secondary to the core | "The market, the reels… they are just add-ons… don't get lost with the add-ons" | 23 Sep 03:36 | PARTIAL: Reels and Markets are top-level nav items beside the agent | `nav-items.ts` |

## Onboarding

| # | Item | Abu's words | Date | Status | Evidence |
|---|---|---|---|---|---|
| O1 | Glider-like onboarding that feels like a product, not a demo | "design ramp and onboarding flow, so everything feels like a product, not a demo" | 21 Sep 11:05 | BUILT | `features/onboarding/Tutorial.tsx`, `FirstSteps.tsx` |
| O2 | Onboarding starts with "come with USDG" | "a space user should come here with USG, the onboarding flow" | 23 Sep 03:36 | PARTIAL | `MoneyStep.tsx`, `BridgeIn.tsx` |
| O3 | Onboarding connects funding, then the agent (see M3–M5) | "you must have to… deposit first into your agent" | 23 Sep 09:06 | PARTIAL | as above |

## OpenServ

| # | Item | Abu's words | Date | Status | Evidence |
|---|---|---|---|---|---|
| OS1 | Two things: our own web app and an agent on OpenServ | "add it as an agent… and… a separate application" | 19 Sep 14:53 / 14:58 | BUILT | `apps/worker/src/openserv/agent.ts` (agent 4513) |
| OS2 | Publish or list the agent on OpenServ | "they have a way to publish your agent… check the plans so we dont forget" | 22 Sep 19:52 | PARTIAL: listing filled, "submit for review" held until deploy | `apps/worker/src/openserv/listing.ts` |
| OS3 | A button that connects your OpenServ account (OAuth or MCP) so you can run your agent there | "a button that you should be able to connect to OpenSave… Oauth that links to your account" | 23 Sep 09:06 (says repeated) | PARTIAL: a one-time "link <code>" buried in Settings | `features/settings/OpenservLink.tsx`, `Connections.tsx` |
| OS4 | Log the session on OpenServ so other agents can run it; users trade through their OpenServ agents | "log the session on OpenServe and other agents can be able to… run it"; "they should able to trade too with their agents" | 22 Sep 19:52; 23 Sep 09:06 | MISSING: the OpenServ path is ask-only ("Nothing here trades or signs"); one capability, `desk_status` | `apps/worker/src/openserv/talk.ts:7`, `agent.ts:134` |
| OS5 | The agent's wallet inside SERV | "it should be able to have it wallet in there in their serv" (later: "I dont think this needs to be talked about") | 22 Sep → 23 Sep 03:36 | SUPERSEDED/softened | ERC-8004 identity only, `openserv/identity.ts` |
| OS6 | Credit OpenServ visibly: logos, "powered by SERV" | "You not do shout out. You not put their logos, nothing" | 23 Sep 09:06 | PARTIAL: text links to agent #4513 and identity; no logo | `HomePage.tsx:348-357`, `copy/home.ts:118-124` |
| OS7 | Bring OpenServ platform features in (e.g. jobs) | "have some of their platform into our agent, like current jobs" | 19 Sep 14:53 | PARTIAL: an hourly OpenServ workflow triggers checks; nothing surfaced to users | `openserv/fire.ts`, `/status` |
| OS8 | Read the OpenServ YouTube transcript and use it | "check the YouTube transcript… OpenSea, an integration we say we wanted" (repeated 22 Sep, 23 Sep ×2) | 22–23 Sep | n/a (process); transcript at `docs/research/2026-09-19-openserv-platform-basics-transcript.md` | — |
| OS9 | Use SERV Reasoning | FAQ requirement | 19 Sep | BUILT | `packages/core/src/serv/client.ts` |

## Telegram

| # | Item | Abu's words | Date | Status | Evidence |
|---|---|---|---|---|---|
| T1 | One-click Telegram connect in the web UI | "connect your account, like, sign in on Telegram… like a click" | 22 Sep 19:52 | BUILT (the one-click path is untested live) | `features/settings/TelegramConnect.tsx` |
| T2 | Bot has buttons, /start, logo, brand images | "No buttons, no start, no logo, nothing… doesn't feel like a bot" | 22 Sep 19:52 | BUILT | `apps/worker/src/telegram/bot.ts:85-118`, `profile.ts` |
| T3 | Bot linked to your account, able to do things | "this bot should be connected to your account… able to do stuff" | 22 Sep 19:52 | BUILT (/portfolio, /record, /ask, approve buttons) | `bot.ts:169-215` |
| T4 | Trade and portfolio pictures in Telegram | (part of the same complaint; an item on the cut list) | 22 Sep | MISSING | only `welcome.png`/`avatar.jpg` are sent |
| T5 | Price alerts through Telegram | (Sep 21 kept extras) | 21 Sep | BUILT | `features/markets/PriceAlerts.tsx`, `review.ts` |
| T6 | Telegram entry in the header menu | (cut list) | 23 Sep | BUILT | `HeaderAccount.tsx` |

## Social (reels / rooms / takes)

| # | Item | Abu's words | Date | Status | Evidence |
|---|---|---|---|---|---|
| SO1 | Share cards | kept extra | 21 Sep | BUILT | `features/share/*` |
| SO2 | Rooms | kept extra | 21 Sep | BUILT | `features/room/*`, `api/room` |
| SO3 | Reels | kept extra | 21 Sep | BUILT | `app/reels`, `features/reels` |
| SO4 | Takes | kept extra | 21 Sep | BUILT | `features/takes`, `api/takes` |
| SO5 | Referrals, points and rewards out | "some stuff that we don't need there, like the referrals" | 21 Sep 10:30 | SUPERSEDED (dropped by his decision) | — |
| SO6 | Pitch folio | not kept | 21 Sep | SUPERSEDED | — |

## Markets / charts

| # | Item | Abu's words | Date | Status | Evidence |
|---|---|---|---|---|---|
| MK1 | Masayume-style markets page with charts (prices, not betting) | "you can see a chart, but for AI to build those strategies… not like a betting" | 21 Sep 11:15 | BUILT | `app/markets/page.tsx`, `StrategyHero.tsx` |
| MK2 | Charts that "talk like Sensei" | (Sep 21 direction) | 21 Sep | BUILT | markets talk line; `features/desk/Typewriter.tsx` |
| MK3 | A better stock page | "I don't like how you design… the stock aspect… proper UX can be done" | 23 Sep 03:36 | BUILT (rebuilt in commit `22e5399`) | `app/stock/[symbol]/page.tsx` |
| MK4 | Split/dividend multiplier, reports, holdings page (research add-ons he defended) | "why do you want to drop… the promotions, the split dividends, buy holdings page, settings" | 21 Sep 10:03 | BUILT | stock page multiplier tile `:118` |
| MK5 | Markets as the landing page (floated) | "I think market was supposed to be our landing page… Or maybe not" | 23 Sep 09:06 | Open/undecided | — |
| MK6 | Prediction markets | "they even have a prediction market too" | 19 Sep | SUPERSEDED ("not a prediction market") | — |

## Trust / proof

| # | Item | Abu's words | Date | Status | Evidence |
|---|---|---|---|---|---|
| TP1 | Agent decisions visible, tx hash checkable | praise, 23 Sep | 23 Sep | BUILT | `components/check-it.tsx`, `lib/proof.server.ts` |
| TP2 | Your money stays yours; take it out without our site | (bot text he pasted, 21 Sep) | 21 Sep | BUILT (Blockscout verified) | commit `03fddf9` |

## Naming

| # | Item | Abu's words | Date | Status | Evidence |
|---|---|---|---|---|---|
| NM1 | Japanese name | "I usually pick like a Japanese name" | 21 Sep 03:17 | BUILT: Shijima (he said "Bantō works", then the bot was made as ShijimaBot) | `copy/web.ts` brand |
| NM2 | "Agent" not "desk" | see N1 | 23 Sep | MISSING | — |

## Design references & tools

| # | Item | Abu's words | Date | Status | Evidence |
|---|---|---|---|---|---|
| D1 | Copy a real product for UX | "We just have to copy… beautiful UIs and user experience flow" | 21 Sep 10:03 | n/a | — |
| D2 | Glider as the design | "I'm going with the glider and nothing else" | 21 Sep 10:30 | SUPERSEDED by D3 (21 Sep 11:15) | — |
| D3 | Masayume/Somnia Events approach, via Agari and Stocklana | "I would prefer the Messarium approach" | 21 Sep 11:15 | BUILT (Agari CSS port) | `docs/FIDELITY.md` |
| D4 | Read code, not Chrome screenshots, for his own products | "you're wasting tokens. It's a redundant job" | 21 Sep 11:18 | n/a (process) | — |
| D5 | Use 21st.dev (skill and CLI) everywhere | "use the 24s Dev… Everywhere. And I mean everywhere" (22 Sep, 23 Sep ×3) | 22–23 Sep | PARTIAL: a few 21st-derived components; he still calls the UI mediocre | `components/ui/*`, `StrategyCard.tsx` |
| D6 | Cards, animations, next-level UX | "take this to the next level… cards, of animations" | 22 Sep 19:52 | PARTIAL | count-up, typewriter |
| D7 | Stocklana's own walkthrough and design as a bar to beat | "even this agent did better than you… Inside Stocklana" | 23 Sep 03:56 | PARTIAL | — |
| D8 | Designer brief in plain words, all features | "give me full details… so I can go give it to a designer… layman terms" | 19 Sep 17:56 | BUILT | `docs/DESIGN-BRIEF.md` |
| D9 | Use Context7 for libraries | "I will keep mentioning this… use Contexto" | 19 Sep, 21 Sep | n/a | — |
| D10 | Firecrawl, not "Figma core" | "WHERE FIGMACORE IS FIRECRAWL" | 21 Sep | n/a | — |

## Deployment

| # | Item | Abu's words | Date | Status | Evidence |
|---|---|---|---|---|---|
| DP1 | Local first; no deploy yet | "We are not yet deploying… set up database locally" | 20 Sep 07:05; again 23 Sep 03:36 | Followed | — |
| DP2 | Make wallets and databases yourself | "just give me a wallet address… you can save the key" | 20 Sep 07:11 | Followed | — |
| DP3 | $5 is enough, don't ask for $50 | "the $5 is enough for everything" | 22 Sep 19:07 | Followed | — |
| DP4 | Mobile application | "did we mention mobile application, documentation" | 23 Sep 03:36 | PARTIAL: an installable PWA manifest, no native app | `apps/web/app/manifest.ts` |
| DP5 | Documentation | same | 23 Sep 03:36 | BUILT | `app/docs/page.tsx`, README |
| DP6 | Hackathon submission (X post, form, data collection) | FAQ | 19 Sep | MISSING (deliberately after deploy) | `docs/ABU-CHECKLIST.md` |

## Process: how he wants me to work (repeated items marked ×n)

- Define the product fully before building, and don't hallucinate (19 Sep ×2).
- Don't bring in things he didn't ask for: Robinhood MCP (19 Sep, angry), Arc Copilot (19 Sep).
- No day-by-day schedules (21 Sep).
- Don't ask him about decided features; decide yourself (21 Sep).
- Short plain replies; he gets overwhelmed (20 Sep).
- No CLAUDE.md (20 Sep, 21 Sep).
- Use at most a few subagents; he noticed 7 running (19 Sep).
- Read the plans in `~/.claude/plans` before acting ×4 (21 Sep 09:13, 21 Sep 14:42, 23 Sep 03:36 "last three plans", 23 Sep 09:06).
- Go to plan mode and take your time; don't rush or say "done" early ×3 (19 Sep 17:56, 23 Sep 01:59, 23 Sep 03:40).
- Think beyond what he says: "you always expect me to tell you everything" ×2 (23 Sep 03:36, 09:06).
- Build for users, not only for judges (23 Sep 03:36).
- Keep the core loop (deposit USDG → strategy → agent trades → portfolio → decisions → Telegram) first; add-ons second (23 Sep 03:36).
- Use 21st.dev everywhere ×4. Use Context7 ×3. Check the OpenServ YouTube transcript ×3.
- A "walkthrough" means reading the whole codebase, not a video (23 Sep 04:04).
- Codex may review, but don't follow it blindly (23 Sep 09:06).
- Commit as you go and never push (21 Sep).

## Dropped or missing (most important first)

1. **C1 Copy trading** of a live agent (only a one-time copy of the mix exists): PARTIAL.
2. **C2 Creator fees** for agents others copy: MISSING.
3. **OS3/OS4 Real OpenServ connection**: OAuth/MCP-style connect, running your agent from OpenServ, other agents trading. There is only an ask-only one-time code buried in Settings: PARTIAL/MISSING.
4. **M5 One-time $1 USDG mainnet faucet plus gas** for new users: MISSING.
5. **N1/NM2 Rename "desk" to "agent"** everywhere: MISSING.
6. **N2/N3 Landing page reachable when signed in; the logo must not land on Strategies**: MISSING.
7. **A3/A4 Agent page layout**: decisions first, fold "what it holds" into the portfolio, fix the grid: MISSING.
8. **M3/M4/O2/O3 Funding story**: "your agent is the wallet", how a user gets USDG, deposit-first onboarding: PARTIAL.
9. **M6 Gas explained** to users (who pays for the agent's trades): PARTIAL.
10. **N5 Custom 404 page**: MISSING.
11. **A8/C3 Empty "your desks" state**: redesign it and offer copy trading there: MISSING.
12. **N8/A9 Live-agents carousel and a better showcase**: MISSING/PARTIAL.
13. **N4 Markets first in the nav; N9 add-ons secondary**: MISSING/PARTIAL.
14. **OS6 OpenServ logos and "powered by SERV"**: PARTIAL.
15. **C4 About 20 strategies** (5 today): PARTIAL.
16. **N6 Settings in the navigation**: PARTIAL.
17. **N7 Landing and marketing page that explains the product**: PARTIAL.
18. **A7 Decision reasoning** still too text-heavy: PARTIAL.
19. **T4 Trade and portfolio pictures in Telegram**: MISSING.
20. **OS2 OpenServ listing "submit for review"**: PARTIAL (waiting on deploy).
21. **D5/D6 21st.dev components and animation everywhere**: PARTIAL.
22. **M11 Real (live) mode proven on mainnet**: PARTIAL.
23. **DP4 Mobile app**: PARTIAL (PWA only).
24. **OS7 OpenServ platform features (jobs) shown to users**: PARTIAL.
25. **DP6 Hackathon submission**: MISSING (deliberately after deploy).

Superseded (not owed): mainnet/testnet toggle (M9), Glider (D2), Robinhood MCP, Coinbase AgentKit, prediction markets, referrals and points, pitch folio, Telegram via OpenServ (replaced by our own bot), the agent's wallet inside SERV (OS5, softened by Abu).
