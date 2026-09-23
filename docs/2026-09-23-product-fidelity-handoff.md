# Shijima product fidelity contract

**23 September 2026 · implementation handoff · source snapshot `b529ef7`**

This document records the product the owner described, the journeys the current app actually supports, and the work needed for full fidelity. It is a specification for the next builder, **not a claim that copy trading, 20 strategies, creator payouts, or a mainnet credit already work**. The companion [review](2026-09-23-agent-product-review.md) is a short diagnosis; this is the implementation and acceptance contract.

## 1. Authority and evidence

| Authority | Snapshot and role | Important limit |
| --- | --- | --- |
| Owner's latest spoken feedback, attached in this task | Highest authority: agents, real copy trading, funding, creator fees, mainnet, OpenServ, 20 strategies, home, navigation, 404, decision-first detail, responsive design | Spoken “20 UJG” and the precise free-credit amount conflict or are ambiguous. Preserve this as an open decision. |
| Shijima, this repository | `main` at `b529ef7`; implementation truth | The running local `/desk/showcase` was inspected on 23 September. It is a practice showcase, not proof of live trading or copy. |
| Masayume | `/Users/abu/dev/hackathon/sommina-events`, `main` at `f96d44e`; working tree has unrelated changes | Source reference for implemented creator, copy budget/consent, funding, recovery, activity and visual language. Its Somnia prediction market primitives do **not** carry over verbatim. |
| Agari | `/Users/abu/dev/hackathon/agari-wt/w1`, `integration/w1` at `3dec101`; clean | Source reference for agent entry, cockpit, decisions, activity and responsive patterns. Stocklana's dated parity ledger records an Agari **devnet** copy subscription, creator fee and runner receipts; that is useful implementation evidence, not Shijima mainnet proof. |
| Stocklana (“Stock Planner”) | `/Users/abu/dev/hackathon/stocklana`, `main` at `7c370df`; clean | Broad Masayume parity inventory and planned funding/copy scope. Its `docs/plan/parity.md` still marks copy and deposit/withdraw items pending; do not describe it as a working copy implementation. |
| OpenServ documentation and local transcript | `docs/research/2026-09-19-openserv-platform-basics-transcript.md`, `docs/research/2026-09-23-openserv-publishing.md`; current [Connect](https://docs.openserv.ai/docs/no-code/connect) and [full-stack guidance](https://docs.openserv.ai/vibecode/openclaw/fullstack-app) | Platform docs establish integrations, MCP and workflow concepts. They do not prove consumer OAuth or one-click Shijima account linking. |
| 21st.dev skill and CLI | `21st review apps/web --json` run in this task; 0 errors, 11 warnings | Tool suggestions do not establish product hierarchy or responsive acceptance. Inspect actual candidate component code and license before adapting. |

**Authority order:** latest owner feedback → observed Shijima code/screen for current status → reference source for desired fidelity → older Shijima docs for historical intent. The earlier `docs/FIDELITY.md` L-11 and L-53, `docs/PRODUCT-SCOPE.md` copy exclusion, and `docs/DESIGN-BRIEF.md` “Never planned: copying other traders” are **superseded** by the latest request. They cannot be used to remove copy trading or the signed-in landing page. Existing risk rules and owner custody remain relevant until a new implementation explicitly changes them.

**Task boundary:** this handoff changes documentation only. No deployment, wallet signature, faucet send, contract deployment, OpenServ marketplace publication or live-copy claim occurred. Reuse of source in the user's related repositories is possible, but check each source file's provenance and dependencies before porting; 21st.dev components need license and behavior review.

### Confidence vocabulary

- **Confirmed current:** directly observed in this repository or reference source at the pins above.
- **Required:** explicit owner feedback, even if not implemented.
- **Proposed:** an implementation decision that preserves the request but still needs validation.
- **Unresolved:** ambiguity or external capability that cannot honestly be fixed from the evidence.

### Owner feedback trace

| What the owner asked for | Where this contract carries it |
| --- | --- |
| Copy **trades** from a live agent, with creator revenue; not merely reuse a basket | §2 leader/follower model, §4 A/C, P11–P14, §7 execution/fee contract |
| Twenty distinct strategies and “free trading” | §3 Strategies, P15, §7 fee ambiguity and catalog gate |
| No empty or badly ordered “DEX” page; call it an Agent | §3 route/language, §5 desktop/phone composition and empty states, P04–P09 |
| Decisions first, keep tx hash and share; fold holdings into Portfolio | §4 A/D, §5, P06–P09 |
| Home available after sign-in, logo back to Home, Markets first | §3 IA, P01–P02, acceptance walkthrough |
| Custom 404 and obvious Settings/Telegram | §3 IA, P03/P23, §8 states |
| Real mainnet agent account, deposit/withdraw, wallet and operator gas | §2 model, §4 B, P16–P21, §7 money contract |
| One-time small USDG trial credit, with UI entry | §4 B, P22, §7 credit, §8 claim states |
| Visible OpenServ connection, sessions/other agents, branding and real capabilities | §4 E, P24–P27, §8 connection states |
| 21st.dev skills/CLI and responsive fidelity | §5 component source map, P30, §9 viewport walkthrough |
| Recover previously omitted features | Preservation/omission audit after §6 and explicit older-doc supersession notes |

## 2. Product model that every screen must teach

| Term shown to user | Concrete object | Owner and permissions | Money and gas |
| --- | --- | --- | --- |
| **Agent** | The visible trading assistant plus its dedicated `Desk` smart-contract account and decision record | The connected wallet owns its account; the service operator can trade only within the contract's bounds. `Desk.sol` protects owner withdrawal. | The **agent account** holds USDG and Stock Tokens. It is not an ETH gas wallet. |
| **Your wallet** | The browser-connected owner address | Signs creation, funding, limit changes, live activation, withdrawal and copy consent. | Needs ETH for its own Robinhood Chain transactions unless a proven sponsor pays. |
| **Operator** | Shijima's separate server signer | Executes authorized agent trades, cannot withdraw principal | Service funds this wallet's ETH. Low gas can stop execution; show health truthfully. |
| **Strategy** | A named basket/rule configuration available to start an agent | May be curated or creator-published; needs a version, asset eligibility and clear limits | A preset is not a live agent and has no performance track record by itself. |
| **Leader agent** | A published live agent whose eligible decisions can be copied | Creator controls their own agent, **not** follower accounts | Their transactions never spend a follower's funds directly. |
| **Follower agent** | A separate account owned by the copying user | Follower can pause, cap, revoke and withdraw without the creator | Follower funds its own USDG account; each executed copy has its own transaction, costs and gas payer. |
| **OpenServ workspace** | External context where Shijima can be added and linked | Link code binds a workspace to one Shijima account; no private owner/operator key is shared | Chat/task access is not authority to withdraw or bypass website confirmation. |

Robinhood Chain **mainnet is chain 4663 and gas is ETH** per [network docs](https://docs.robinhood.com/chain/connecting/). A Shijima agent in **practice** can exist on mainnet yet make simulated decisions with no trades. “Mainnet” and “live execution” must be separate, visible statuses. USDG credit does not pay ETH gas. `contracts/src/Desk.sol`, `contracts/src/DeskFactory.sol`, `packages/chain/src/send.ts`, and `apps/worker/src/review.ts` are the current on-chain/operator authority; neither an LLM nor an OpenServ workspace is a wallet signer.

## 3. Information architecture and route contract

The public wording is **Agents**, never “DEX” for this object. `Desk` may remain an internal contract and code identifier during migration. “DEX” is appropriate only for the actual swap venue/cost explanation.

| Destination | Current route and behavior | Required route/entry and outcome |
| --- | --- | --- |
| Home | `/` redirects signed-in owner to `/desk/...`, new signed-in wallet to `/strategies`; signed-out sees `HomePage` (`apps/web/app/page.tsx`). | `/` always renders a home page with relevant signed-in state. Logo goes to `/`. Primary actions: Explore Agents, Create Agent, Markets. Existing owner can open their agent without losing Home. |
| Markets | `/markets` exists; nav comes after Desk. | First discovery item in desktop and mobile navigation. Preserve market charts, eligibility and cost detail rather than collapsing it into agent marketing. |
| Agents | `/desks` is owner list or a bare empty state; a single owner is redirected. | `/agents` is public discovery plus Your agents. A signed-out visitor can inspect shareable published agents. 0, 1 and many states are designed. `/desks` can redirect for old links. |
| Agent detail | `/desk/[slug]` works; visitor read-only; owner gets chat, controls and nested sections. | `/agents/[slug]` or a deliberate alias to current route, with decision first, Copy action, one portfolio module, activity, clear funding/withdraw and owner Settings. Keep existing share/decision links working. |
| Agent decision | `/desk/[slug]/decision/[seq]` exists with transaction link/share. | Preserve a durable direct link and proof on the reworked agent detail; distinguish proposed, waited, simulated, submitted, reverted and confirmed action. |
| Strategies | `/strategies` contains five presets and builder. | 20 **distinct, validated** entries as requested; clearly separate curated presets, creator-published agents, and Copy live agent. Catalog truth is more important than a visual count. |
| Start/create | `/start` and `/strategies` lead to creation. | One transparent create → fund → practice → live journey, with separate balances, required signatures and receipt/recovery. |
| Settings | `/desk/[slug]/settings` exists for owners only. | Visible from owner agent header and global account menu, with Connections, Telegram, OpenServ, wallet, share, appearance, close. Visitors see no owner controls. |
| 404 | `apps/web/app/not-found.tsx` is absent. | Branded 404 with Home, Markets, Agents and a recovery path. Show for unknown agent/decision and unknown route without leaking private account details. |
| Secondary | `/reels`, `/compare`, `/docs`, `/how-it-works`, `/status`, `/stock/[symbol]`, `/desk/[slug]/report`, `/record` exist. | Keep navigation and deep links; adapt “desk” labels, stale/empty/loading states and agent references. Do not silently drop these while rebuilding the primary loop. |

Navigation order: **Markets → Agents → Strategies → Reels → How it works**, with Home on the logo and a clear owner profile/Settings entry. Mobile may use fewer persistent slots, but Markets and Agents stay first and Settings remains reachable in one obvious action. `/start`, `/desks` and old `/desk/...` links need intentional redirects or aliases; do not break existing shared decision URLs.

## 4. End-to-end journeys and recovery

### A. Visitor: discover, inspect, copy

1. Open `/` signed out. See what an agent does, a truthful mainnet/practice label, live-agent carousel and actions. The carousel is a preview of the `/agents` directory, with manual controls and no forced autoplay.
2. Open Markets or Agents. Agent card shows creator, current mode, strategy, latest decision/time, verified value/track record or “not enough history,” copy availability, and a link to the full agent. Do not call a practice agent “live.”
3. Agent detail places the **latest decision and reason before the fold**, with tx hash if there was an on-chain action, share card and “Copy agent.” Portfolio follows as one combined chart/allocation/holdings block; full activity and controls follow.
4. Copy requires sign-in and a separate follower-owned account. Show creator fee, budget, max trade/day, token allowlist, expected deposit and gas, loss risks, status of leader and follower, and the precise wallet prompts before activation.
5. If the leader is stale, paused, closed, hidden, unfunded or not eligible, disable new copies with a reason while preserving a read-only page and existing follower controls.

**Recovery:** wallet rejection leaves a saved draft; interrupted funding shows the confirmed on-chain state; uncertain transaction checks its hash/account before another send; partially completed copy consent resumes only the missing step. Masayume `web/src/features/strategies/CopyDrawer.tsx`, `useDeskWrites.ts` and `copy-progress.ts` are the concrete reference for this recovery language and lifecycle, but their Somnia vault design must be adapted to Robinhood Chain.

### B. New owner: create and fund an agent

1. Pick a verified strategy or custom basket; see real tradeability, markets, limits and whether it can run on mainnet. The current five presets in `packages/shared/src/presets.ts` do not meet the requested twenty.
2. Connect wallet and show **owner wallet USDG + owner ETH** separately from **future agent-account USDG**. Put the one-time starter-credit entry here with its real eligibility/claimed/unavailable state; it must not be buried in a later Settings card. Offer direct USDG transfer or supported bridge. Show destination address, source chain, quote/fees and expected final balance before signing.
3. Current code has `createDesk` and a **separate** USDG transfer (`apps/web/features/strategies/CreateStep.tsx`). Its low-ETH path can bridge to the predicted account first and top up owner ETH. The UI must reflect actual signatures and the possibility that bridging, creation and funding settle in different orders. Never label an unconfirmed receipt “funded.”
4. Show agent created, funding pending/confirmed, practice-ready, practice-running, live-eligible, live-running, paused, needs-attention, closed. Practice creates decisions without real swaps; starting live is a separate explicit wallet action after eligibility/risk review.
5. After creation, the agent page exposes **Add USDG**, **Withdraw**, balances and receipts. Account ownership is visible with explorer links.

**Recovery:** wrong network, no wallet ETH, insufficient USDG, bridge quote expiry, partial bridge, predicted-address pre-funding before create, create success/fund failure, duplicate transaction ambiguity, paused/closed account and withdrawal failure all have distinct UI. Reconcile on-chain balances and receipts before retrying. The current `$5` minimum in `MoneyStep.tsx`, `$20` default and spoken $1/$20 free-credit language must be brought under one explicit rule before public promises.

### C. Creator: publish, earn, manage

1. Creator starts an owned agent, completes a minimum verified live history threshold **to be defined**, then chooses whether to publish it for followers. A practice-only agent cannot be advertised as live.
2. Creator publishes name, versioned strategy/rules, allowed assets, risk envelope, fee schedule, availability and a stable public link. Fee changes apply according to disclosed consent terms; follower budgets remain follower-owned.
3. Public card shows the creator, fee and independently verifiable decision/transaction history. It cannot imply guaranteed gains, shares in the underlying company or “free” if a creator fee will be charged.
4. Creator dashboard shows followers, active subscriptions, fee receipts, failed/stale executions and clear pause/unpublish actions. Pausing a leader stops future copy candidates; it does not seize follower funds.

Masayume `CreatorStudio.tsx`, `StrategiesScreen.tsx`, `AgentsScreen.tsx` and `CopyDrawer.tsx` provide source reference for publish, fee preview, consent and follower management. Shijima does **not** have creator-fee accounting/payout contracts today. The `fee` field in `Desk.sol` is a Uniswap pool tier, not creator revenue; the displayed 0.5% annual platform fee is currently waived (`packages/db/src/schema/money.ts`).

### D. Existing owner: operate, inspect, connect

1. Open Home from the logo, then Your agents or a direct agent link. The page shows status, latest decision, next check only where useful, portfolio, full activity and agent chat. Counts should not repeat the same decision history in multiple cards.
2. Follow a decision into its durable record: reasoning, data freshness, guard result, actual/simulated status, transaction hash, fee/cost, timestamp and share action. Keep the working tx-link/share behavior in `apps/web/app/desk/[slug]/decision/[seq]`.
3. Settings is plainly visible. Telegram connection shows linked/off, code/QR, expiry, notification/approval behavior and disconnect. OpenServ connection shows linked/off, workspace identity, capability and revoke.
4. When money moves, the website presents owner confirmation. Telegram/OpenServ may request or describe an action; neither silently signs an owner transaction.

### E. OpenServ workspace: concrete current and desired path

**Current implementation:** owner opens `/desk/[slug]/settings` → Connections → generic Bot card → “Make a link code” → copies `link CODE` → manually adds Shijima in their OpenServ workspace → sends the code there. `openservCodeAction` makes a 30-minute one-time code, `claimOpenservLink` consumes it, and linked chat/tasks route through the agent's ask path (`apps/worker/src/openserv/talk.ts`). Owner can unlink every workspace. This is **technically in the UI**, but its route and card are so buried that the owner did not see it. The component only shows a linked **count**, not which workspace is linked; it does not show a durable expiry timestamp, successful claim refresh, or a guided OpenServ deep link. This is a fidelity failure, not proof the owner missed something obvious.

**Required visible path:** Agent header or onboarding → **Connections** → **OpenServ** branded card → what linking permits → OpenServ agent/workspace link → generate code → copy/send instruction → pending with actual expiry → linked workspace identity and verified test action → revoke. Include error states for expired/used code, workspace linked elsewhere, OpenServ unavailable and revoked. On returning from OpenServ, refresh server state. Show “Decisions use SERV Reasoning”/approved attribution in appropriate product surfaces. Do not imply a logo means the workspace is connected.

**Architecture boundary:** current SDK registration and worker handlers are the starting point. OpenServ [Connect docs](https://docs.openserv.ai/docs/no-code/connect) describe platform integrations and MCPs; [full-stack guidance](https://docs.openserv.ai/vibecode/openclaw/fullstack-app) describes external app/workflow patterns. Evaluate a signed webhook for observable workflow triggers and a separately authorized **read-only** MCP surface for agent/decision queries. Neither replaces the account link or on-chain owner confirmation. Consumer OAuth and a true one-click external account bind are **unverified**; implement them only after finding a supported provider flow. Record exact linked workspace identity, scoped permissions, revocation, audit log and run/result receipts. The OpenServ identity is not the Robinhood Chain trading account.

**The two-door journey the owner recalled:** one agent runs its guarded trading engine in Shijima, and the same external agent participates in an OpenServ workspace. The local transcript at 7:01–8:33 describes self-hosted SDK/REST agents exposed to other workspace agents through declared capabilities; at 16:26 it describes a new session per task trigger; at 19:31–21:02 it describes manual, cron and webhook triggers. A user should be able to see an OpenServ run/session ID beside the related Shijima request/decision when one exists, inspect what was asked, the tool/result boundary and whether a website confirmation was required. **Current code links a workspace and answers chat/tasks, but it does not visibly correlate OpenServ session IDs with on-chain decisions, expose reusable tools to other agents as a published capability, or prove a public marketplace listing.** Design these as separate milestones: (1) visible link and read/ask; (2) correlated session/run receipt; (3) scoped callable tools for other workspace agents; (4) marketplace approval/template only if requested and verified. A workspace template or Base ERC-8004 identity is not an account copy or a Robinhood Chain trading wallet (`docs/research/2026-09-23-openserv-publishing.md`).

## 5. Agent detail composition: explicit design contract

Current composition (`apps/web/app/desk/[slug]/page.tsx`) feeds `AgentCard` and chat to the left of `Plate`, `ValueChart` and nested `DeskSections`. `DeskSections` places Portfolio/Activity/Settings **under the value column**, matching the owner's grid complaint. `AgentCard` adds last/next check and decision/action counters while the latest decision and Activity repeat related information. `Plate` (“What it holds”), value, allocation and holdings split a single portfolio story across blocks. `DeskTabs.tsx` makes phone navigation even deeper.

Proposed structural contract (use Masayume/Agari tokens and 21st components only after source inspection):

```text
Desktop:  [identity / mode / creator / Copy or owner actions]
          [latest decision + reason + proof/share] [portfolio value + chart]
          [decision timeline + chat/asks]          [allocation + expandable holdings]
          [activity ledger]                        [funding + limits / settings entry]

Phone:    identity / mode / action
          latest decision / reason / tx / share
          portfolio chart + allocation + expandable holdings
          activity timeline
          chat/owner controls and funding
          persistent obvious Connections/Settings entry for owner
```

The latest decision must be immediately visible at common phone and desktop heights. “What it holds” becomes an expandable **part of Portfolio**, not a competing top-level section. A single Activity ledger owns the chronological record; a one-card latest decision preview links into it. Counts may live in an optional compact statistics row, never displace the decision. Portfolio labels specify **agent-account USDG**, mark/pricing time, change basis, cash, token holdings and uncertainty. Settings belongs to the agent-level navigation, not beneath “Value.” Do not invent P&L for a practice agent or treat deposits as gains.

**Empty states:** no owned agent → explain Create vs Copy, funding and practice; no published agents → say live copying unavailable with Create/Practice path; no decisions → explain next check and mode; no holdings → show USDG cash and Add USDG; no chart history → show current balance without fabricated trend; data stale → last verified time and disabled copy/live actions as appropriate. The public carousel handles 0/1/many agents, long names, keyboard/screen-reader controls, reduced motion and manual scroll; do not autoplay away the primary CTA.

### 21st.dev component source map

The repository already has 21st-derived primitives: `components/ui/desk-kit/*` (tabs, timeline, status, empty state, charts), `features/desk/PortfolioChart.tsx` (#29532), `DeskPanels.tsx`' activity timeline (#28340), `features/settings/Connections.tsx` (#28170), `components/ui/stepper.tsx` (#29518), `features/strategies/StrategyCard.tsx` (logo stack/donut), and `components/ui/segmented.tsx` (#23552). **Reuse and recombine these first.** The user's grid objection is caused by nesting/order in `page.tsx` and `DeskTabs.tsx`, not by the absence of a new card component. The current CSS switches to one visible panel below 1024px (`styles/shijima.css`), so the latest decision can be hidden behind the first phone tab; set the phone content order directly instead of adding another nested tab.

The 21st CLI search in the companion review found candidate [Interfaces Carousel](https://21st.dev/@jshguo/components/interfaces-carousel) and [Empty State](https://21st.dev/@serafimcloud/components/empty-state). Before adoption, run `21st get` to inspect code/dependencies/keyboard/focus/reduced-motion/license, then restyle in existing Masayume/Agari tokens. Use the CLI's review after composition, but judge the actual hierarchy in a browser at 390, 768, 1024 and 1440px, both themes. The already-run `21st review apps/web --json` reported 0 errors and 11 warnings; it did **not** validate this page's information order.

## 6. Parity ledger

Classification: **Exact** = preserve a working promise; **Adapted** = same user promise on Robinhood Chain; **Additive** = newly required by owner; **Blocked** = dependent on an explicit unresolved rule/external capability. Each row states the current source, target owner, data authority and a test that can reject a shallow implementation. References are relative to the pinned roots in §1.

| ID / class | Reference and current evidence | Target implementation and data authority | Failure/responsive acceptance |
| --- | --- | --- | --- |
| P01 **Additive** Home for all | Current `apps/web/app/page.tsx` redirects signed-in; `HomePage.tsx` exists | Route `/` renders signed-in and signed-out variants from session + real public data | Logo returns home at 390/768/desktop, regardless of wallet/agent count. |
| P02 **Adapted** nav order/name | `components/shell/nav-items.ts` Desk before Markets; owner says Markets first and Agent name | Nav registry/copy, old-link aliases; route truth | Markets first, Agents second on desktop and mobile; no visible “DEX” for an agent. |
| P03 **Additive** 404 | No `app/not-found.tsx`; Agari/Masayume redirect and are not a custom-404 precedent | Branded Next not-found route, product design tokens | Bad route/agent/decision offers Home, Markets, Agents; no owner data leak. |
| P04 **Adapted** discovery | Masayume `AgentsScreen.tsx`; current `/desks` empty/single redirect | Public `/agents`, Your agents and eligibility filters; DB + verified chain status | 0/1/many, signed-out and stale feed states at phone/tablet/desktop. |
| P05 **Additive** live carousel | Home `LiveAgent` shows one showcase only | Curated published-agent query + manual accessible carousel | 0 state truthful, 1 card not awkward, many scroll with keyboard; no fake live metrics. |
| P06 **Adapted** agent detail | Agari `cockpit/*`, `decision/*`, `activity/*`; current `DeskTabs`, `DeskSections`, `Plate` | Decision-first agent page from decision DB + chain balances | Decision and primary action above fold; agent-level navigation not nested under value. |
| P07 **Exact** tx/share proof | Current decision page and `AgentCard` links | Preserve hash/share/deep links; chain receipt + DB status | Confirmed, pending, reverted and practice records label differently; old share links resolve. |
| P08 **Adapted** portfolio | Current `Plate`, `ValueChart`, `Allocation`, `Holdings` repeat | One portfolio module; chain balances + timestamped valuation | Cash-only, token positions, stale quote and no history; deposits excluded from profit. |
| P09 **Exact** activity | Current `Record`, `/record`; Agari `ActivityTimeline` | Chronological decisions and receipts, not a second summary card | 0/20+/paginated records, pending receipts and filters still navigable on phone. |
| P10 **Adapted** agent chat | Current `DeskChat`, owner only | Keep chat/approval relationship while raising decisions | Long thread and keyboard do not hide decision/portfolio entry. |
| P11 **Additive** actual copy | Masayume `CopyDrawer`, `useDeskWrites`; old Shijima L-53 only copied basket | New follower account + leader signal service + copy consent; own account and receipt DB | Two followers with different caps: independent size/receipts; one safe refusal; no leader access to funds. |
| P12 **Additive** copy controls | Masayume pause/fund/withdraw/recovery | Follower budget, per-trade/day caps, allowed tokens, pause/revoke/withdraw | Pause before next signal stops future copies; creator outage never blocks withdrawal. |
| P13 **Additive** creator studio | Masayume `CreatorStudio`, `StrategiesScreen` | Publish/version agent with history/rules/status | Draft/published/paused/removed states; practice cannot impersonate live. |
| P14 **Blocked** creator fee | Masayume subscription fee; current `Desk.sol` pool tier only | Separate fee terms, collection/ledger/payout/refund mechanism | Fee shown before signing and in receipt; no double charge on retry; amount/model awaiting owner. |
| P15 **Additive** 20 strategies | Current `presets.ts` has five | Catalog schema, verification job, 20 genuinely distinct eligible entries | Each entry has rule, assets, weights, limits, version and tradeability; no placeholder cards. |
| P16 **Adapted** create | Current `MoneyStep`, `CreateStep`, `DeskFactory` | Guided create/fund/practice/live state machine; wallet + chain receipts | Distinct signature count; reject/partial/unknown receipt resumes without duplicate transfer. |
| P17 **Adapted** direct funding | Current `CreateStep` ERC-20 transfer | Add USDG to agent address and show both wallet/account balances | Confirm balance/tx; wrong network, low ETH/USDG and closed account explained. |
| P18 **Adapted** bridging | Current `apps/web/features/desk/BridgeIn.tsx`; Robinhood [bridging](https://docs.robinhood.com/chain/bridging/) | Source/destination/quote/gas/status/recovery; bridge provider + chain | Expired quote, pending source, partial destination, delayed settlement and retry reconciliation. |
| P19 **Adapted** withdraw | Current `Desk.sol` owner withdrawal and settings/controls | Owner-only Withdraw with amount, destination, gas, receipt | Paused/closed/partial balance and wallet rejection; creator cannot intervene. |
| P20 **Exact** trade guards | `Desk.sol`, `packages/chain/src/send.ts`, worker | Keep allowlist, oracle, caps, slippage/loss guard for leader and each follower | Stale feed, illiquid pool, cap breach and low operator gas refuse safely and record why. |
| P21 **Additive** gas transparency | Chain 4663 ETH; worker operator monitor | Funding/confirmation cost breakdown + ops/status gas health | Owner vs operator vs swap/bridge cost named correctly; $1 USDG never promises gas coverage. |
| P22 **Blocked** one-time mainnet credit | No faucet/eligibility ledger; owner said ~$1 once then ambiguous “20 UJG” | Visible onboarding funding entry plus treasury-funded claim service with per-person rule, caps, receipts and abuse controls | One eligible claimant succeeds once; second account/attempt, exhausted treasury, failed/ambiguous transfer handled. Amount/rule unresolved. |
| P23 **Exact + Adapted** Telegram | Current `TelegramConnect`, bot and settings | Keep code/QR, approval, disconnect; visible Connections entry | New owner finds it from agent page; expired/linked/disconnected states refresh correctly. |
| P24 **Adapted** OpenServ code | Current `OpenservLink`, `owner-actions`, DB claim and worker; hidden under generic Bot card | Visible branded Connect OpenServ path with workspace ID, expiry, retry and revoke | Owner can find it without docs; two workspaces link/revoke; used/expired/elsewhere errors visible. |
| P25 **Blocked** one-click/OpenServ OAuth | Current code is manual one-time code; docs show Connect/MCP but no verified consumer OAuth | Research supported provider flow; else make code journey polished and honest | No “one click” claim until completed identity and return/callback flow is demonstrated. |
| P26 **Additive** OpenServ sessions/tools | Current linked talk/tasks use ask path; local platform transcript | Scope-linked read/ask/check-now, correlated session/run ID and decision receipt; callable declared tools for other workspace agents after scoped authorization; website confirms money actions | A workspace asks/reviews one agent and sees matching run/decision IDs; cross-workspace attempts denied; no key leakage. |
| P27 **Additive** OpenServ attribution | Current home text link/generic Bot mark | Approved OpenServ mark and SERV Reasoning attribution in relevant flows | Brand use verified; link distinct from trading-account connection. |
| P28 **Exact** market detail | Current `/markets`, `/stock/[symbol]` | Preserve chart/reference, eligibility, tradability and swap costs | Stale/halted/ineligible token disables live use; market remains first nav. |
| P29 **Exact** secondary surfaces | `/reels`, `/compare`, `/docs`, `/how-it-works`, `/status`, report/record | Update links, names and money/copy explanation; retain existing functions | Direct old links, social/share, status and docs remain usable after route migration. |
| P30 **Additive** responsive/accessibility | Agari entry/cockpit CSS; 21st candidate carousel/empty state | Use project tokens, inspect component source, adapt without new visual grammar | 390/768/desktop, touch, keyboard, focus, reduced motion, long content, empty/error states. |

No **newly requested** surface is marked Excluded. This does **not** make Masayume's prediction tickets, games or X trading into Shijima requirements: the older `FIDELITY.md` recorded an owner decision to leave those out. Its previous exclusion of copy trading is specifically superseded here.

### Preservation and omission audit beyond the spoken feedback

This register checks the older parity commitments against **current source**, so an agent-page redesign cannot make another feature disappear. “Present” means source is mounted, not that a production user journey was re-proven today.

| Earlier commitment | Current source check | Handoff disposition |
| --- | --- | --- |
| First-run tutorial | `features/onboarding/Tutorial.tsx` is mounted from `app/markets/page.tsx` | **Present.** Rework its last step to explain Create **or Copy**, agent-account funding, mainnet/practice and where Connections lives. Keep its one-time/revisit behavior observable. |
| Stock Token rooms and takes | `app/stock/[symbol]/page.tsx` mounts `RoomButton`; `features/reels/ReelsScreen.tsx` mounts `TakeComposer` and `TakeReelCard`; APIs exist | **Present.** Preserve direct stock and reel routes, gates and empty/error states. Do not make them the primary path ahead of agent decisions. |
| Price alerts | `app/stock/[symbol]/page.tsx` mounts `PriceAlerts` and `app/alert-actions.ts` exists | **Present.** Preserve creation, trigger basis and notification truth while refactoring Markets. The older promise of Telegram/inbox delivery needs a separate current-service check before claiming it. |
| Reels, comparison, report, share | Routes/components exist | **Present.** Recheck their agent terminology, decision deep links, sharing permissions and phone layout after route migration. |
| PWA and social cards | `app/manifest.ts` and site/stock/agent Open Graph routes exist | **Present.** The older `WHAT-IS-MISSING.md` entry saying there was no manifest is stale; check install affordance and metadata after navigation changes. |
| Status and proofs | `/status` plus `/api/status`, decision record, `CheckIt` JSON download | **Present.** Add copy-worker and operator-gas health, retain read-only chain proof and distinguish on-chain truth from worker/database projections. |
| Public stats, judge demo and install guide | Older `FIDELITY.md` §4.6 calls for stats/demo and PWA install; current `app` has no `/stats`, `/demo`, `/download` route | **Unfulfilled older handoff items.** Ask the implementing agent to reconcile these with the current release scope; do not silently declare them complete or replace real demo proof with a showcase. |
| Error boundaries/custom 404 | `components/states/BoundaryScreen.tsx` exists; no `app/error.tsx`, `app/global-error.tsx` or `app/not-found.tsx` | **Partial.** Add usable route and crash recovery states; the custom 404 is an explicit new owner request. |
| Old excluded reference mechanics | `FIDELITY.md` §4.7 excluded Masayume betting tickets, games and X trade flow by prior owner decision | **Historical exclusion stands unless owner changes it.** It must not be confused with the now-required agent trade-copy flow. |

Agari's dated `Stocklana/docs/plan/parity.md` L-53–L-55 reports a devnet follower subscription with two signatures, a creator fee, real agent-board counts and separate runner orders. Reuse its **permission/fee/receipt test cases** as well as Masayume's UI, while redesigning the underlying flow for owner-controlled Robinhood Chain agent accounts. Stocklana's own planned copy/deposit rows are not proof of an implemented Shijima path.

## 7. Copy execution, money and fee contract

The product needs an actual **trade-following** path. “Start from this basket” remains a separate optional action; it cannot satisfy the Copy agent CTA. A leader's eligible decision is a **candidate** for each follower. For each follower: verify active consent and fresh leader signal; read its own balance, positions, limits, allowlist and prices; scale the order; run existing guard logic; send at most one idempotent order; record its own reason/hash/receipt. If the follower cannot execute, record a refused or missed copy, not a fabricated trade. No duplicate send after timeout until nonce and chain state are reconciled. When the leader edits a strategy, version the rule and disclose what followers agreed to.

**Required new data:** published leader identity/version; creator fee terms; follower subscription with explicit authorization and expiry; follower account address; budget and limits; signal ID; per-follower job keyed by signal+follower; transaction nonce/hash/receipt; pause/revoke and fee settlement history. DB rows alone cannot authorize trades: contract permissions and current chain state must still be checked. The existing Desk clone may need a follower-specific operator/consent contract or service; do not assume the current owner-only contract already supports subscriptions/fee collection. Architecture review must settle this before UI says “Copy live.”

**Fee language:** “Free trading” is unresolved beside the explicit request that creators take fees. Show a line-item quote: Shijima platform fee, creator fee, pool fee/spread/price impact, bridge fee and network gas, with payer and timing. The previous short review suggested a zero platform fee beta and fixed join fee; those are **proposals, not approved policy**. Do not silently waive creator revenue or market the service as zero-cost. Fee upgrades and subscription renewal need fresh consent if terms change.

**Mainnet credit:** the owner clearly requested a small **one-time** USDG credit for a real mainnet trial, and also said “start with 20 UJG.” The latter could refer to amount or catalog count; the actual credit value is unresolved. Its entry must be on the funding/onboarding screen, with **Claim once**, eligibility, claim receipt, already-claimed and exhausted states. After confirmation, show where the credit landed: owner wallet or agent account; moving it onward must be explicit if another signature is needed. A viable faucet needs one-per-person eligibility (wallet alone is vulnerable to repeated claims), treasury and total cap, per-claim limit, rate control, durable claim/tx journal, idempotent reconciliation, exhausted state, customer-facing funded balance and operator alerts. First prove a $1-scale trade is possible under minimum size, pool cost and operator gas; current `MoneyStep` rejects below $5. If not possible, the UI must not promise that $1 enables live trades. A credit transfer is a real mainnet action requiring its own release authorization and budget.

## 8. State matrix to implement, design and verify

| Surface | Ready state | Non-ready and recovery states that must be visible |
| --- | --- | --- |
| Home/Agents | Real published live cards, or honest practice showcase | No agents; one agent; feed stale; service offline; signed out; signed in/new; signed in/owner. |
| Agent status | Practice running or live running, last check and current decision | Never checked, scheduled, paused by owner, loss-stop, needs approval, worker unavailable, operator low gas, closed. |
| Decision | Reason, data timestamp, guard outcome, hash/receipt if on-chain | Pending, simulated/would-have, waited, rejected, stale quote, tx submitted, reverted, receipt unknown. |
| Portfolio | Cash + positions + timestamped valuation | No holdings, no history, oracle/quote stale, deposit pending, valuation unavailable, asset halted. |
| Create/fund | Wallet connected, correct chain, enough USDG/ETH, confirmed agent balance | Wallet absent/wrong chain, low owner ETH, low USDG, invalid amount, quote expired, bridge pending/partial, create succeeded/fund failed, tx uncertain. |
| Copy | Eligible live leader, valid subscription, funded follower, matching caps | Not published, practice leader, leader stale/paused, insufficient budget/gas, follower paused, one signal missed, permission pending, fee changed, creator unpublished. |
| Creator fee | Disclosed amount and receipt | Fee unreadable, wallet rejection, settlement unknown, refund/duplicate charge, schedule changed. |
| Credit | Eligible first claim with receipt | Already claimed, identity pending, budget exhausted, transfer failed/ambiguous, insufficient treasury, amount below viable trade threshold. |
| Connections | Telegram/OpenServ linked with identity and revoke | Unlinked, code ready and expiring, expired, used, wrong workspace, platform offline, revoked, owner not authenticated. |
| Navigation/404 | Home/Markets/Agents reachable everywhere | Unknown route, private agent, removed share, old slug, bad decision sequence. |

## 9. Build sequence with no scope deletion

1. **Freeze the product contract:** resolve the credit amount/minimum, creator fee semantics and trade-vs-basket copy language with the owner; record answers here. Keep all requested features in the backlog. Make source/route inventory executable as issues for builders.
2. **Repair visible fidelity first:** home for signed-in, Markets/Agents order, Agent wording, 404, discovery/empty/carousel, decision-first agent layout, unified portfolio and accessible owner Settings/Connections. Existing tx/share and secondary routes must survive.
3. **Make account money legible:** wallet/agent/operator balances, direct deposit/bridge/create/withdraw receipts, gas explanation, mainnet/practice/live labels and interruption recovery. Fork-rehearse every write; then attend a small-value mainnet acceptance only when authorized.
4. **Deliver actual creator and follower system:** publish/version, budget consent, independent follower account execution, caps/idempotency/recovery, fees/payouts and pause/withdraw. Adapt Masayume's source and Agari's UI without carrying over prediction-market semantics. A basket copy does not close this milestone.
5. **Complete 20 verified strategies and one-time credit:** validate each strategy's assets, liquidity, data and distinct rule. Implement and budget the faucet only after viable order/minimum and abuse design. Then polish OpenServ deep link/capabilities/identity and verify public listing separately.
6. **Release proof:** observe the complete journeys below at phone/tablet/desktop with real accounts and receipts. Test/CI passing or paper-mode activity alone does not establish mainnet copy fidelity.

### Acceptance walk-through for the implementing agent

- Signed out: Home → Markets first → Agents → live agent → latest decision → transaction explorer/share → Copy → sign in. The same logo returns Home after signing in.
- New owner: choose one of a **verified** catalog, see wallet/account/operator model, bridge or add USDG, create, view receipts, observe practice decision, activate live, observe an actual trade/fee/gas payer, withdraw.
- Follower: inspect creator rules and current fee, set budget and caps, fund own account, approve subscription, see a leader trade become a separately guarded follower trade with its own hash, then pause/revoke/withdraw while leader is unavailable.
- Creator: publish a qualified agent, change/pause its availability, inspect followers and fee receipts; existing follower terms stay understandable.
- Connections: from the agent page find Settings → Telegram and OpenServ; generate OpenServ code, link one workspace, test a read/ask, request an action that returns to website confirmation, inspect identity, revoke and confirm access ends.
- State/recovery: empty directory, no decisions, cash-only portfolio, stale market, wrong network, no ETH, bridge partial arrival, rejected signature, uncertain tx, low operator gas, creator fee changed, duplicate credit claim, unknown route. Check 390px, 768px and desktop plus keyboard and reduced motion.

For each accepted claim, attach evidence: route/viewport capture, account/chain ID, contract address, tx hash where applicable, service job ID, which wallet paid ETH, fee breakdown, and the database/chain reconciliation result. Public copy should remain unavailable for an agent until these proofs exist for that agent's configuration.

## 10. Open decisions and external checks

> **Resolved 23 Sep** by `docs/DECISIONS.md` (Round 3, D1–D10) and built per `docs/PLAN-ROUND-3.md`: the credit is $1 USDG plus about 30¢ of ETH for the first 20 wallets; creator revenue is a one-time $0–$5 copy fee split 80/20; copying follows the leader's individual trades; OpenServ has no consumer OAuth, so the code link is the connection, made visible and polished. Item 5 (jurisdiction) stands as written.

1. **Free credit/minimum:** exact one-time USDG amount, eligibility rule, treasury cap and whether “20 UJG” meant $20 to start or the 20-strategy target. The current `$5` minimum cannot coexist with a claim that $1 alone starts a live agent without change.
2. **Creator revenue:** fixed join/resume fee, recurring fee, trade-based fee or another model; fee change/renewal consent and beta policy. This must be distinct from pool/network costs.
3. **Copy semantics:** default should follow eligible individual leader trades because the owner explicitly said “copy trade/copy an agent”; whether a separate “use this basket” action remains should be named separately.
4. **OpenServ one click:** verify any official consumer account-authorization API and approved logo asset before promising OAuth/one-click. Current code-link flow is the demonstrated baseline.
5. **Jurisdiction and asset eligibility:** Robinhood's current [Stock Token documentation](https://docs.robinhood.com/chain/stock-tokens/) and [terms](https://docs.robinhood.com/chain/terms-of-service/) govern live asset descriptions and availability. Revalidate at release, not just at design time.

None of these decisions prevents the visible home/nav/agent/settings/404 fixes. They do prevent claiming the mainnet credit, paid copy or 20 live strategies are shipped.
