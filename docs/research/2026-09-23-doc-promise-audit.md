# Shijima doc-vs-code audit, 23 Sep 2026 (snapshot b529ef7 + working tree)

Intended output path was `scratchpad/doc-audit.md`; plan mode allowed only this file, so the audit is here.
Read-only. Docs read in full: DECISIONS, PRODUCT-SCOPE, DESIGN-BRIEF, FIDELITY, UX-PLAN, WHAT-IS-MISSING, V1-FREEZE,
BUILD-PLAN (log + plan), 2026-09-23 fidelity handoff, 2026-09-23 agent review, ABU-CHECKLIST, plans
typed-enchanting-simon and calm-painting-tower (§1.5-1.7, §5).
Research files: 2026-09-19 {hackathon-research, openserv-integration-decision, openserv-platform-basics-transcript,
project-links, weekend-market-evidence, winners-report}, 2026-09-21 {chat-actions, coinbase-agent-wallet,
masayume-port-map, tracks}, 2026-09-23-openserv-publishing, chain-facts-verified, dirs addons/ architecture/ glider/
masayume/ ux/.

Paths below are relative to repo root; `web/` = `apps/web/`.

## 1. Route inventory (every `apps/web/app/**/page.tsx`)

| Route | Renders | Who sees it |
|---|---|---|
| `/` | Signed-out: HomePage (hero, live showcase agent, 5 steps, $ split, weekend hours, strategies w/ 30-day return, promises, proof, "on your phone"). Signed-in: **redirects** to first owned desk, or `/strategies` if none | Everyone; signed-in never sees it |
| `/markets` | Strategy hero chart vs reference, 10 Stock Token cards, shared-desk decisions, desks to watch; first-run Tutorial overlay | Public |
| `/stock/[symbol]` | Price/reference/gap, cost, report date, multiplier + history, chart w/ desk markers, price alerts, Room button, desk decisions, "Ask about this" | Public; alerts/Room need sign-in + desk |
| `/strategies` | Studio (Pick strategy · Add USDG · Limits · Meet your agent + test read + create), Start from a strategy (shared mixes), Your desks | Public to browse; create needs wallet |
| `/start` | Redirect to `/strategies` (keeps `?preset`) | Anyone |
| `/desks` | Owner list w/ approvals, pause; 0 desks = one sentence + link; 1 desk = redirect | Signed-in owner (signed-out gets "sign in" text) |
| `/desk/[slug]` | Agent card + chat (owner), plate, quick actions, value chart, Portfolio/Activity/Settings sections, controls, session panel | Owner by session; visitor only via enabled share slug (read-only, no chat) |
| `/desk/[slug]/decision/[seq]` | One decision in full: hero, drift, what it saw, options, limits, cost, outcome, answer, proof + Check it, grade, share card | Owner / share-link visitor |
| `/desk/[slug]/record` | Full record timeline with chips (outcome, token, practice/live, dates), quiet runs folded | Owner / share-link visitor |
| `/desk/[slug]/report` | Weekend report: summary sentence, graded decisions, past stretches; owner read marks go-live condition | Owner / share-link visitor |
| `/desk/[slug]/settings` | Connections (Telegram, Wallet, OpenServ link code), share toggle, disclosure, appearance, close desk | Owner only (404 otherwise) |
| `/reels` | Snap feed of stock cards, shared decisions, takes; take composer | Public; posting needs desk |
| `/compare` | With vs without reasoning, 3 saved situations from `web/data/compare.json` | Public |
| `/how-it-works` | Published rules, market clock, modes, steps, withdraw-without-website, fee, FAQ | Public |
| `/status` | Worker heartbeat+lock, trigger source, SERV, RPC, prices, feeds, halts, Telegram, chat queue, counts, per-desk last check; refresh 30 s | Public |
| `/docs` | Manual: what, start, agent, modes, safety, connect, architecture, contract, record, OpenServ, run it | Public |
| `/dev/states` | All 8.16 states + outcomes from fixtures | Dev only (404 in prod unless DEV_PAGES=1) |
| `/dev/share` | Share cards from real records | Dev only |

Non-page: `manifest.ts`, icons, OG/Twitter images (site, desk, stock), APIs `ask`, `auth/*`, `prices/[symbol]`,
`room/[symbol]`, `status`, `takes`, `ticker`. **Absent:** `not-found.tsx`, `error.tsx`, `global-error.tsx`,
`/agents`, `/demo`, `/stats`, `/download`, `/onboarding/*`.

## 2. Promise-by-promise status

Legend: BUILT / PARTIAL / MISSING. "Current authority" = 23 Sep handoff unless noted.

### A. Home, navigation, IA (handoff §3, P01-P03)
| Promise | Status | Evidence |
|---|---|---|
| `/` renders for signed-in users too, logo -> Home | MISSING | `web/app/page.tsx:783-787` redirects signed-in |
| Nav order Markets -> Agents -> Strategies -> Reels -> How it works | MISSING | `web/components/shell/nav-items.ts` DESKTOP_NAV = desk, markets, reels, strategies, how |
| User-facing "Agent/Agents" not "desk" | PARTIAL | agent card/copy says agent; routes, nav (`webCopy.nav.desk`), `/desks`, "Your desks", settings title still "desk" |
| Branded 404 + error boundaries | MISSING | no `app/not-found.tsx`, `error.tsx`, `global-error.tsx`; `components/states/BoundaryScreen.tsx` unused at route level |
| Public `/agents` discovery (0/1/many, signed-out) | MISSING | no route; `/desks` owner-only, bare empty state `web/app/desks/page.tsx:473` |
| Live-agent carousel on home | MISSING | `HomePage.tsx:26 LiveAgent` shows one showcase desk only |
| Settings obvious from agent header / account menu | PARTIAL | header menu Settings link (BUILD-PLAN 23 Sep 03:00); on desk page only inside DeskSections/DeskControls "Settings →" |
| Brief 8.1 public home page | BUILT (visitors) | `features/home/HomePage.tsx` sections; "who may not use it" line present |
| Old links `/start`, `/desks` redirect | BUILT | `app/start/page.tsx`, `/desks` single redirect |

### B. Onboarding / studio (brief 6, 8.2-8.8; WHAT-IS-MISSING §6.3; handoff B)
| Promise | Status | Evidence |
|---|---|---|
| Wallet connect + SIWE, wrong-network banner | BUILT | `components/shell/SignInButton.tsx`, `WrongNetworkBanner.tsx`, `app/api/auth/*` |
| Disclosure w/ region declaration before money | BUILT | `features/settings/Disclosure.tsx`, `disclosureAccepted` in `strategies/page.tsx` |
| First-run tutorial (5 steps ending Connect) | BUILT | `features/onboarding/Tutorial.tsx`, mounted only on `/markets`, signed-out first visit |
| Tutorial last step explains Create or Copy / funding / Connections | MISSING | steps are what/weekend/promises/region/connect (`Tutorial.tsx:44-58`) |
| Money-first flow: Strategy -> Add USDG -> Limits -> Meet agent | BUILT | `packages/shared/src/copy/studio.ts:14`, `Studio.tsx` |
| Presets start (brief 8.6), build-your-own sliders | BUILT | `packages/shared/src/presets.ts` (5), `StudioFields.tsx` |
| 20 distinct validated strategies | MISSING | 5 presets |
| Test read "Here is how I understood you" | PARTIAL | `ReadStep.tsx` offered, not required (DECISIONS 22 Sep #3), brief says will not start until answered |
| Create desk, one confirmation, fee shown, states | BUILT | `CreateStep.tsx`, `studio-actions.ts`, row-before-chain + resume (DECISIONS 22 Sep #1) |
| "One signature creates and funds" | PARTIAL | create + separate USDG transfer (two signatures); proven on fork in b529ef7 |
| Owner with no ETH: bridge first to predicted address + ~$1 ETH | BUILT (fork only) | `CreateStep.tsx:208 BridgeIn` |
| Minimum $20 with reason (brief 8.5) vs $5 | PARTIAL / conflicting | `MoneyStep.tsx:16 MIN_USDG = 5`; docs say $20; handoff says unresolved |
| Separate owner-wallet USDG/ETH vs agent-account balances, recovery states (handoff B.2-B.5, §8) | PARTIAL | MoneyStep shows wallet USDG; no unified state machine for partial bridge / create-ok-fund-fail / uncertain tx |
| Meet your agent step | BUILT | `MeetAgent.tsx` |
| Telegram connect after create, skippable w/ warning | BUILT | `FirstSteps.tsx:127-132` |
| One-time mainnet USDG starter credit | MISSING (blocked on amount rule) | no faucet/claim code anywhere |
| Visitor practice with pretend $1,000, no wallet (WHAT-IS-MISSING §8) | MISSING | practice desks still need a contract/wallet |
| "You're all set" / "on duty" end state | PARTIAL | FirstSteps after create; no distinct go-on-duty screen |

### C. Funding, withdraw, bridging, session key (brief 8.5, 8.14, 8.15; FIDELITY L-26/L-27)
| Promise | Status | Evidence |
|---|---|---|
| Add USDG on Robinhood Chain (wallet transfer) | BUILT | `ControlForms.tsx:106 addMoney`, proposal `add_money` |
| Bring USDC from Base/Arbitrum/Ethereum/BNB via Relay, quote first | BUILT, never run with real money | `features/desk/BridgeIn.tsx:24-27`; BUILD-PLAN 21 Sep night "not yet sent with real money" |
| Money-on-its-way progress / partial arrival reconciliation | PARTIAL | receipt wait in BridgeIn; no partial/expired quote recovery UI |
| Withdraw some/all, USDG or stocks, owner address fixed, costs first, vault-short partial offer | BUILT | `ControlForms.tsx:115`, proposal `withdraw` w/ `withdrawAs`, DECISIONS vault #8 |
| Sell everything, remove assistant, restart, close desk | BUILT | `DeskControls.tsx:251-261`, `CloseDeskButton.tsx` |
| On-chain limits (lower via key, raise via wallet), unpause | BUILT | `set_chain_limits`, `unpause` kinds |
| Session key grant (<=7 d), one-click in-scope actions, revoke | BUILT | `features/session/*`, `Desk.sol` v1 live |
| Withdraw without our website (Blockscout Write proxy) | BUILT | how-it-works section; implementation verified on Blockscout 23 Sep; factory verify still 429 (cosmetic) |
| Gasless/sponsored | Not promised (DECISIONS moved to LATER) | - |
| Gas transparency: owner vs operator vs swap/bridge cost; operator gas health on status | PARTIAL | `review.ts:312 watchOperatorGas` logs + status; no "who pays" line in funding UI; alerts not to a chat |

### D. The agent / chat (FIDELITY 4.5; plan step 5)
| Promise | Status | Evidence |
|---|---|---|
| Chat in worker via Postgres, proposal cards, confirm paths (sign-in / session / wallet) | BUILT | `packages/core/src/ask/*`, `web/app/api/ask/*`, `ProposalCard.tsx`, `ChainConfirm.tsx` |
| What chat can do | BUILT | `core/src/ask/proposal.ts:28` kinds: switch_strategy, set_weights, set_notes, set_limits, pause, resume, set_mode, answer_approval, check_now, do_it_anyway, withdraw, sell_everything, remove_assistant, unpause, add_money, set_chain_limits, close_desk, price_alert, set_rules; read answers w/ citations + small chart (`ChatChart.tsx`) |
| Buttons make the same card, no model call | BUILT | `core/src/ask/direct.ts BUTTON_KINDS`, `DeskControls`/`QuickActions` |
| Chat in a dock on every page | MISSING | chat only on owner desk page (`desk/[slug]/page.tsx` DeskChat) |
| Visitor can try the chat | MISSING | owner-only by design; signed-out shows nothing |
| Plain words (no `pool_twap_30m`) | BUILT (fixed d05a44f) | WHAT-IS-MISSING §9 |
| Agent presence card (doing now, last/next look, latest) | BUILT | `features/desk/AgentCard.tsx` |
| Notes reach model, structured protective rule `price_move_sell` | BUILT | DECISIONS 22 Sep #4, `RulesEditor.tsx` |

### E. Mode ladder, approvals, grading (brief 7, 8.9-8.12)
| Promise | Status | Evidence |
|---|---|---|
| Practice -> Ask first -> On its own; mode always visible | BUILT | desk badge `desk/[slug]/page.tsx`, pinned Telegram status |
| Go-live rule (24 checks + report opened) visible + enforced, locked control | BUILT | `packages/db/src/queries/engine.ts:235-264`, `ControlForms.tsx:154-166`, `DeskPanels.tsx:291` progress |
| Large-action size trigger still asks in On its own | BUILT | `large_action_request` notification kind |
| Approvals on web (Needs you, countdown) + Telegram buttons, expiry, re-check 0.5% | BUILT | `NeedsYou`, `/desks` Answer, `bot.ts`, `core/wake/approved.ts` |
| Check now / do it anyway (not in practice) | BUILT | `check_now`, `do_it_anyway` kinds |
| Grading at reopen, weekend report, past reports, Monday Telegram report | BUILT | `core/jobs/grade*.ts`, `report.ts`, `app/desk/[slug]/report`, `monday_report` kind |
| Timing sum on plate | BUILT | `timingSummary` in `lib/desk.server.ts:116` |
| Replay of past weekends labelled | PARTIAL | grading exists; no visible replay surface found (`desk:replay` in plan, not in `apps/worker/src/cli`) |
| Record: every outcome, quiet runs folded, filters, download | BUILT | `desk/[slug]/record/page.tsx`, `components/check-it.tsx` download |
| Check it (browser recomputes vs chain / prevHash walk) | BUILT | `components/check-it.tsx` |
| Decision page pictures-first w/ all 10 brief sections | BUILT | `desk/[slug]/decision/[seq]/page.tsx`, `features/record/*` |
| Decision states: proposed/simulated/submitted/reverted/confirmed distinguished (handoff P07) | PARTIAL | outcomes labelled; no explicit submitted/receipt-unknown public state |
| Decision-first agent page layout, single portfolio module (handoff §5, P06/P08) | MISSING | `desk/[slug]/page.tsx:109-140`: AgentCard beside Plate+ValueChart, DeskSections nested under value column; Plate/Allocation/Holdings split |
| Vault sweeps (idle cash earns) | BUILT | `core/wake/vault.ts`; DECISIONS vault; $5 desk never sweeps (below ~$140 bar) |
| Interest earned so far | MISSING (decided not built) | DECISIONS vault #9 |
| Yield story visible | PARTIAL | vault rate beside parked cash; home DollarSplit; no earnings number |
| Fee line "Fee so far $x, waived" | BUILT (display only) | `packages/shared/src/copy/web.ts:655`; `fee_accruals` unused |
| Event wakes ("wakes when something moves") | BUILT | `apps/worker/src/review.ts:197-207` watch trigger, commit 680763d |

### F. Telegram (brief §9, UX-PLAN §1, §6)
| Promise | Status | Evidence |
|---|---|---|
| Own bot, pinned status edited in place, refresh | BUILT | `apps/worker/src/telegram/status.ts`, `bot.ts` |
| Approve/Reject buttons, message updates on web answer | BUILT | `approval_answered` kind, migration 0006 |
| Acted / would-have / not-acted / alerts / Monday report / first contact | BUILT | `notificationKind` enum `packages/db/src/schema/enums.ts:124` |
| Commands /start /portfolio /record /ask /help /status /pause /resume, menu, profile, photo | BUILT | `bot.ts:39-229`, `profile.ts` |
| Free-text chat with Confirm buttons; wallet actions return a site link | BUILT | `bot.ts` ask path |
| One-click web connect (deep link, QR), "Connected as @name", disconnect | BUILT | `features/settings/TelegramConnect.tsx`, Connections, header menu |
| Log in with Telegram, Mini App | MISSING (needs public domain) | UX-PLAN §6, BUILD-PLAN |
| Operator-gas alerts to Abu via chat | MISSING | BUILD-PLAN 22 Sep "go to the log and status page" |

### G. OpenServ (PRODUCT-SCOPE 25-26; WHAT-IS-MISSING §4; handoff E, P24-P27)
| Promise | Status | Evidence |
|---|---|---|
| Registered agent 4513, hourly cron workflow drives review | BUILT | `apps/worker/src/openserv/{provision,agent}.ts` |
| Listing filled, ERC-8004 identity 95396 | BUILT | `openserv/listing.ts`, `identity.ts` |
| Submit for review / public Browse listing | MISSING (waits public URL) | ABU-CHECKLIST |
| Data collection on in console (eligibility) | MISSING (Abu) | ABU-CHECKLIST |
| Workspace link by one-time code; chat + tasks reach same ask path; money actions return confirm link | BUILT | `openserv/talk.ts`, `features/settings/OpenservLink.tsx` |
| Visible branded OpenServ connection: workspace identity, expiry timestamp, revoke per workspace, deep link, refresh | PARTIAL | `OpenservLink.tsx` shows linked **count** only, buried in Settings > Connections |
| Real declared capabilities (portfolio, decisions, why wait, gap, report, check now) | PARTIAL | chat/tasks answer these via ask; declared capability is only `desk_status` ("N desks running") `agent.ts:134` |
| Session/run ID correlated with decision | MISSING | handoff E |
| Webhook trigger (every wake a platform run) | MISSING | no webhook code |
| Files/RAG, x402 paid question, clonable template, weekly X post | MISSING (LATER) | integration-decision §4 |
| OpenServ one-click/OAuth | MISSING (blocked, unverified) | P25 |
| SERV Reasoning attribution / approved mark | PARTIAL | text link + generic icon (review) |

### H. Markets, stock page, strategies (FIDELITY 4.2-4.3, plan step 9)
| Promise | Status | Evidence |
|---|---|---|
| Strategy hero chart vs stepped reference, caption from facts, markers, cost of $500, Start with this | BUILT | `features/markets/StrategyHero.tsx` |
| 10 Stock Token cards w/ spark, gap, cost, age | BUILT | `StockCard.tsx` |
| Stale price labelled, never "last close" | BUILT | `markets/page.tsx:725` stale line; banned words |
| Stock page: price/ref/gap, session, multiplier + history sentence, report dates, cost, desk decisions, legal reminder | BUILT | `stock/[symbol]/page.tsx` (rebuilt 22e5399) |
| Company-event banner incl. dividends/splits before they land | PARTIAL | earnings dates + multiplier history; no pending-dividend warning (no source) |
| Holding detail 8.13 "your size" cost + desk's own decisions | PARTIAL | stock page shows $100/$1,000 cost, all shared desks' decisions, not the owner's size |
| Ask about this -> owner chat prefill | BUILT | `AskAbout` |
| Strategy cards: logos, donut, 30-day return | BUILT | `StrategyCard.tsx` |
| Start from a strategy (mix only) | BUILT | `sharedMixes` in `strategies/page.tsx` |
| Your desks rows w/ sparkline, mode | BUILT | `strategies/page.tsx:1054-1070` |
| Creator studio / publish agent / versioned strategies | MISSING | handoff P13 |
| Copy a live agent (follower accounts, per-follower execution, caps, receipts) | MISSING | no follower/subscription code; `leader` hits are the worker lock (`apps/worker/src/leader.ts`) |
| Creator fees, payout | MISSING (blocked) | `Desk.sol` fee = pool tier |
| TradingView logo removed from charts | PARTIAL | desk chart own SVG; markets/stock keep lightweight-charts (DECISIONS 23 Sep) |

### I. Social add-ons (FIDELITY 4.7, DECISIONS step 12)
| Promise | Status | Evidence |
|---|---|---|
| Rooms per Stock Token (desk-owner gate, holds-it badge, rate limits) | BUILT | `features/room/*`, `api/room/[symbol]` |
| Takes (240 chars, tags) | BUILT | `features/takes/*`, `api/takes` |
| Reels | BUILT | `app/reels`, `features/reels/*` |
| Share card for a decision (canvas, QR) | BUILT | `features/share/*`, decision page button |
| Price alerts (stock page + chat, fire once, Telegram + bell) | BUILT | `PriceAlerts.tsx`, `app/alert-actions.ts`, `core/src/alerts.ts`, `price_alert` in INBOX_KINDS |
| Notifications inbox (bell, mark read, links to decision/stock) | BUILT | `components/shell/HeaderInbox.tsx`, `ownerInbox` `packages/db/src/queries/owner.ts:217` |

### J. Public pages, ops, docs, PWA, demo
| Promise | Status | Evidence |
|---|---|---|
| How it works (8.21, 8.22) | BUILT (still long text per WHAT-IS-MISSING) | `features/how-it-works/*` |
| Status (heartbeat, lock, trigger, SERV, RPC, feeds, "has not checked in") | BUILT | `features/status/StatusScreen.tsx`, `lib/status.server.ts` |
| Stats (counts) | BUILT as part of Status (decided) | DECISIONS step 11 |
| Compare with/without reasoning | PARTIAL | page built; SERV side depends on `pnpm compare:run` having run after top-up (check `web/data/compare.json`) |
| /docs manual | BUILT | `features/docs/DocsPage.tsx`, 11 sections |
| `/demo` judge page (video slot, proofs) | MISSING | no route (WHAT-IS-MISSING §9 "still to do") |
| PWA manifest + icons | BUILT | `app/manifest.ts`, `app/icon.tsx` |
| Install page / install prompt, service worker | MISSING | no `beforeinstallprompt`, no SW; home only has "add to home screen" copy |
| OG images (site, desk, stock) | BUILT | `app/**/opengraph-image.tsx` |
| States gallery `/dev/states` | BUILT (dev only) | `app/dev/layout.tsx` |
| Hosting / public URL | MISSING (Abu's go) | local only |
| Showcase desk live (not practice) | MISSING (needs Abu's wallet) | WHAT-IS-MISSING §9 |
| Public track record page, CSV/tax export, multiple desks UI | LATER per scope; multi-desk list exists (`/desks`) | - |

## 3. PARTIAL / MISSING ranked by user impact

1. Copy a live agent (follower accounts, execution, caps, pause/withdraw) - MISSING; owner's top new requirement.
2. `/` redirects signed-in users; no Home after sign-in; logo can't return home - MISSING.
3. Agent page composition: latest decision not first, portfolio split across Plate/ValueChart/Allocation/Holdings, sections nested under value column - MISSING.
4. Public `/agents` discovery + carousel; `/desks` empty state is one sentence - MISSING.
5. Funding journey: two signatures (create, then transfer), $5 vs $20 minimum conflict, no recovery states for partial bridge / fund failure / uncertain tx, no owner-vs-agent-vs-operator balance model - PARTIAL.
6. Relay bridge never run with real money - PARTIAL.
7. Nav order (Markets first) and "desk" wording across nav/routes - MISSING/PARTIAL.
8. 20 validated strategies (have 5) - MISSING.
9. One-time mainnet USDG credit - MISSING (amount unresolved).
10. Creator studio + creator fees - MISSING (fee model unresolved).
11. OpenServ visibility: count-only link card buried in Settings, no workspace identity/expiry/revoke-one, declared capability only `desk_status`, no session/run correlation, no webhook, listing not submitted, data collection not on - PARTIAL/MISSING.
12. Custom 404 and error boundaries - MISSING.
13. Settings/Connections not reachable from agent header - PARTIAL.
14. Showcase desk still in practice; not hosted (no public URL) - MISSING (Abu).
15. `/demo` judge page - MISSING.
16. Chat dock on every page; visitors can't try chat or a paper practice agent - MISSING.
17. Tutorial doesn't cover Create/Copy/funding/Connections - MISSING.
18. Test read optional (brief says required) - PARTIAL (deliberate).
19. Gas "who pays" line in UI; operator-gas alerts only to log/status - PARTIAL.
20. Interest earned so far - MISSING (deliberate).
21. PWA install prompt / install page / service worker - MISSING.
22. Telegram Login + Mini App - MISSING (needs domain).
23. Company-event (dividend/split) warning before it lands; holding cost at owner's size - PARTIAL.
24. Compare page SERV column (verify saved runs) - PARTIAL.
25. Replay of earlier weekends as a labelled surface - PARTIAL.
26. How it works / markets still text-heavy (21st pass incomplete per WHAT-IS-MISSING §9) - PARTIAL.
