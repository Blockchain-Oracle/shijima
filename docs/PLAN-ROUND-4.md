# Shijima, round 4: the ZK Freighter wallet, in Shijima's colours

## Context

On 23 Sep Abu said Shijima still isn't a product:
- money can only go in as USDG;
- you can't see your own wallet, your agent's money, or its evidence;
- there is no proper way to take money out.

He gave a reference, **ZK Freighter** (`/Users/abu/dev/hackathon/stellar-zk-wallet`, GitHub `Blockchain-Oracle/zk-freighter`, commit `859d95f`). His rule:
- copy its code;
- keep only our light and dark colours;
- change everything else: landing, hero, sidebar, wallet screens, settings, and "the app on paper" (the framed app over a gradient);
- keep wallet connection (ZK Freighter uses seed phrases);
- find a motto;
- go past what he named.

**What this plan rests on**
1. **The reference, read as code.** Its live site is down (521), so the repo is the authority.
   - I read its shell, screens, UI package, landing and phone app.
   - I opened its three designer mocks (web, extension, phone) in the browser.
   - Three explorers sent line-by-line reports on every screen, state and token.
2. **Our app, in the browser.** Visitor and owner, desktop and phone, dark and light, including the Add money and Withdraw dialogs.
3. **Abu's messages** since the last plan, the round-3 plan, F1–F9, and his standing rules:
   - the web app holds no keys;
   - I never move real money in a browser;
   - "not a trading place";
   - withdraw must always exist.
4. **Chain and API checks, run today:**
   - Relay: $8.15 of ETH on Base became $8.06 USDG inside an agent.
   - Relay: $2.72 of ETH on Robinhood Chain became $2.71 USDG inside an agent.
   - Relay: $5 USDG out became $4.92 USDC on Base.
   - Relay refuses Stock Tokens.
   - Uniswap: the WETH/USDG pool on Robinhood Chain holds $11.3M.
5. **Two independent design reviews**, one of the money design and one of the interface port, plus an audit of the draft plan. Their findings are merged below.
6. **Motto research:** Robinhood's chain page and launch news, TechCrunch, Glider, eToro, and the SERV hackathon page (judged on creativity, user-readiness and revenue).

No 21st this round: Abu named one reference and said to copy its code.

## Straight answers, in dollars

**Can people put in any token?** Yes.
- **USDG** moves straight in.
- **ETH on Robinhood Chain:** you have $30 of ETH, you see "≈ $29.94 USDG lands in your agent", and you sign once. The same Uniswap router the agent trades on does the swap and pays the agent directly. About 5¢ of gas.
- **Stock Tokens you hold:** if the agent already trades that stock, it goes in as it is. If not, it is swapped to USDG on the way in.
- **Other chains:** ETH, USDC, USDT and more on Base, Arbitrum, Ethereum or BNB arrive as USDG through Relay. About 1% all in, in about a minute.
- **From anywhere:** send to the agent's address using its QR code.
- The minimum stays $1.

**Can people take money out?** Yes, always to their own wallet; the contract enforces that.
- The Withdraw screen offers cash (some or all), selling one stock or all of them first, or taking the stocks as they are.
- Afterwards it offers Send on, or Bridge out to another chain. Test: $5 left as $4.92 on Base.

**Can people see everything?** Yes, on one Wallet page:
- every agent's money: cash, savings, stocks;
- your own wallet's USDG, ETH and every Stock Token, each in dollars, with a total;
- all read from the chain at the moment you look.

**Is there yield?** Only on idle cash, and only in agents that act on their own.
- Example: $100 with a 30% cash target keeps $30 idle, and at a 3–4% vault rate that earns about $1 a year.
- So yield is a line on the wallet ("Savings · $30.00 · the live rate"), not the headline.

**A bug found while touring.**
- The Overview chart calls the $2 that left for the gift wallet a 34.6% loss.
- The cause: a table for money moves exists, but nothing has ever written to it (0 rows).
- Step 4 fixes it: money in and out is recorded, and charts show performance net of it.

**What is "the app on paper"?**
- A dark canvas with two soft glows, padded 32px on every side.
- The app sits on it as one framed panel: 1260px wide, 24px corners, a thin border, a deep shadow, at most 880px tall.
- The sidebar is 236px and only the main area scrolls.
- Below 980px it goes edge to edge.
- We copy it exactly, with green glows.

## The motto (decided)

- **Motto** (sidebar, footer, share image): **Shijima · AI agents for Robinhood Chain stocks**
- **Hero:** **Give your stocks an AI agent.** Second line, in the gradient face: **It trades. You own it.**
- **Hero line:** "Put in any token from Base, Arbitrum, Ethereum, BNB or Robinhood Chain. Pick a basket of Stock Tokens. Your agent trades it around the clock inside limits you set, and idle cash can earn. Only you can take money out."
- **Buttons:** Open the app · Watch a live agent (dark glass pills, as in the reference hero).
- **Why this one:** it uses Robinhood's own words (Robinhood Chain, Stock Tokens, AI agents), says what you get in six words, and makes one safety promise.
- "Stock yield" is not the headline, because the dollars above can't carry it.

## Decisions W1–W12 (go into DECISIONS.md)

- **W1. The wallet is home.** Signed in, `/` opens `/wallet`.
  - This supersedes F8, where `/` opened the newest agent; Abu asked to see his wallet and everything in it.
  - `/overview` redirects to `/wallet`. Signed out, `/` is the landing page.
- **W2. The reference's nav order:** Wallet · Activity (with the Needs-you count) · Send · Receive · Fund · Withdraw · Bridge · Evidence · Settings.
  - "Your agents" keeps its live rows and "+ New agent".
  - Discover holds Agents · Markets · Strategies · Reels · Live.
- **W3. The balance card.** ZK Freighter's "shielded | cross the boundary | public" card becomes "Your agents | move money | Your wallet":
  - left: all agents' money in a green wash with a hatch and a sheen; tap it to flip to one row per agent;
  - middle: a dashed strip with Fund, Withdraw and Bridge;
  - right: your wallet, one priced row per token and a total.
- **W4. Fund takes any token** (the five paths above).
  - Quick amounts $5 · $20 · $100, from the reference extension.
  - The same sources replace the USDG-only money step in `/agents/new` and in the copy flow.
- **W5. Withdraw is a screen** (above). It always pays your wallet.
- **W6. Send, Receive, Scan.**
  - Send moves USDG, ETH or a Stock Token from your wallet.
  - Receive has tabs for your wallet and for each agent.
  - On phones, Send gets a Scan button that reads an address QR, from the reference's Scan to pay.
- **W7. Evidence is a page:** every on-chain decision and money move, its fingerprint, a checker, and the F1 on-chain facts.
- **W8. Colours stay ours; everything else follows the reference.**
  - Fonts: Hanken Grotesk and IBM Plex Mono, decided.
  - Also copied: the radii (24 frame, 18 cards, 11 buttons and nav), shadows, sheen, hatch, scroll reveal, route animation and reduced-motion rule.
  - Text on the neon accent is dark. Glows run at about half the reference's strength, because neon is twice as bright.
- **W9. One app for phones.** No separate app and no "use the mobile app" wall. Below 768px we copy the reference phone chrome:
  - a header, and four bottom tabs: Wallet, Agents, Fund, More;
  - flows open as bottom sheets you drag down to close;
  - pull-to-refresh, and the route animation;
  - More holds everything else in three groups: Move, Discover, Account.
- **W10. Settings are the reference's groups, in two columns:**
  - ACCOUNT: address, gas meter, Get gas;
  - CONNECTIONS: Telegram, OpenServ;
  - AGENTS & ACCESS: including the browser key, in the reference's SECURITY slot;
  - WHAT YOU AGREED TO;
  - on the right: "Verify it yourself" (links to Evidence), "Real money, on mainnet", and Disconnect.
  - No theme row.
- **W11. Our extras stay:** Ask Shijima (⌘J), the bell, the market clock, the LIVE block line, "Runs on OpenServ".
  - They move into a slim row at the top of the scroll area and into the sidebar. The reference has no top bar.
  - The grain overlay and the custom cursor go; the reference has neither.
- **W12. The landing follows the reference's order:**
  1. nav pill
  2. hero band with the rising disc
  3. Built-on strip, which carries the live prices
  4. three flip cards: Web, Phone, Telegram
  5. "Money in. Agent trades. Only you take it out."
  6. our On chain now, live agents, strategies and Check it yourself, in the same section style
  7. Get Shijima
  8. footer CTA
  9. footer

## Every reference screen, and where it lands

| Reference | Source | Shijima | Class |
|---|---|---|---|
| Canvas and framed panel | `apps/web/src/App.tsx:161-162`, `packages/ui/src/theme.tsx:60-72` | new `AppFrame.tsx` | Exact |
| Sidebar | `WalletShell.tsx:104-137` | `AppSidebar.tsx` rebuilt, rail below 1100px | Exact, labels adapted |
| Home title row, SYNCED, Sync | `HomeScreen.tsx:186-199` | `/wallet` | Exact |
| Shielded card with flip | `HomeScreen.tsx:48-97`, `cards.tsx` | Your agents card | Adapted |
| Crossing strip | `HomeScreen.tsx:99-111` | Fund · Withdraw · Bridge | Adapted |
| Public card | `HomeScreen.tsx:117-144` | Your wallet card | Adapted |
| Actions, 3 activity rows | `HomeScreen.tsx:216-232` | same | Exact |
| Phone home: swipe rail, dots, 4 actions | `apps/mobile/src/MobileHome.tsx:84-116` | `/wallet` on phones | Exact |
| Receive | `ReceiveScreen.tsx`, `qr.tsx` | `/receive` (our existing QR maker) | Exact |
| Scan to pay | `MobileScan.tsx` | Scan on Send | Adapted |
| Shield / Unshield flow | `ShieldScreen.tsx:187-292`, `ProofRun.tsx` | `/fund`, `/withdraw` | Adapted |
| Send | `SendScreen.tsx` | `/send` (public only; nothing is private on this chain) | Adapted |
| Bridge | `BridgeScreen.tsx:190-269` | `/bridge`, in and out | Adapted |
| Test faucet | `EvmFundButton.tsx` | the free $1 | Adapted |
| Activity | `ActivityScreen.tsx:58-135` | `/activity` | Exact |
| Disclosure, Verify tools | `DisclosureScreen.tsx`, `DemoEvidencePanel.tsx` | `/evidence` | Adapted |
| Discover (find a code) | `DiscoverScreen.tsx` | Agents directory | Adapted |
| Settings groups | `SettingsScreen.tsx` | W10 | Exact structure |
| Network and appearance rows | `SettingsScreen.tsx:92-96` | none | Excluded: mainnet only; theme stays in the shell (Abu) |
| Private engine reset | `SettingsScreen.tsx:111-121` | none | Excluded: no local prover |
| "Hackathon software" warning | `SettingsScreen.tsx:138-140` | "Real money, on mainnet" | Adapted |
| Confidential tokens | `ConfidentialScreen.tsx` | none | Excluded: a Stellar-only system |
| Onboarding slides | `packages/ui/src/onboarding.tsx` | our first-run tutorial | Adapted |
| Create, import, password, passkey, unlock | `OnboardingFlow.tsx`, `AccessPanels.tsx` | 380px access card with Connect wallet | Adapted (Abu: wallet connection) |
| Intro sound | `intro.tsx` | none | Excluded |
| Auto-shield banner | `AutoShieldBanner.tsx` | Needs-you banner | Adapted |
| PhoneGate | `PhoneGate.tsx` | none | Excluded (Abu: one app) |
| Phone chrome, sheets, drag, pull-to-refresh, haptics | `MobileChrome.tsx`, `MobileSheetOverlay.tsx`, `mobile-gestures.ts` | below 768px; haptics via the browser's vibrate call | Adapted |
| Landing sections and reveal | `apps/landing/src/*` | W12 | Exact structure, our copy |
| Docs site order | `apps/docs/content/docs/meta.json` | `/docs` adds Glossary, Troubleshooting, Evidence | Adapted |
| Extension, native builds | `apps/extension`, native mobile | none | Excluded |

**Kept and restyled, never removed:**
- agents, copy trading and creator fees, 20 strategies;
- markets, reels, `/live`, the free $1;
- OpenServ, Telegram, Ask Shijima;
- the decision-first agent page, the 404, the on-chain facts, the Overview's combined chart (now under the agents on `/wallet`).

## Routes

| Today | After |
|---|---|
| `/` signed in → newest agent | `/` → `/wallet` |
| `/overview` | redirects to `/wallet` (`apps/web/next.config.ts:41-47`) |
| none | `/wallet`, `/fund`, `/withdraw`, `/send`, `/receive`, `/bridge`, `/evidence` (money pages take `?agent=slug`) |
| `/home` | the landing, moved into the website shell (today it sits in the app shell by mistake) |
| all others | kept, inside the frame |

## The look

The reference's variable names get our values in a new `styles/zk/tokens.css`. The themes switch on `[data-theme]` as today.

| Reference | Dark | Light |
|---|---|---|
| canvas | #050505 | #F4EEE3 |
| panel | #0A0A0A | #FBF7EE |
| cards | #171717, #262626 | #F6F0E4, #ECE3D2 |
| sidebar | #070707 | #F6F0E4 |
| accent | #CCFF00 | #4F7A00 |
| profit / warning / loss | #34D399 / #F2994A / #FB7185 | #2E6B4F / #F2994A / #C2381F |
| agents wash (was shielded) | accent 22% → 4%, white hatch | accent 16% → 4%, accent hatch |
| wallet wash (was public) | warning 10%, dashed | warning 16%, dashed |

- The canvas glows are the reference's two radial gradients in green: 10% in dark, 6% in light. The reference had none in light.
- The landing's rising disc is the reference's, in green.
- Profit green and the accent stay different colours.

## Build steps (each one committed and checked in the browser; the app works after every step)

### 1. Tokens and fonts
- Add `styles/zk/tokens.css` and the reference keyframes, imported after `agari/bridge.css`.
- Swap the fonts in `lib/fonts.ts` without renaming the variables: Hanken Grotesk fills the Sora and Inter slots, IBM Plex Mono the JetBrains slot. Every page picks this up with no CSS changes.
- Then an overflow pass, because the new fonts are narrower and the new numbers wider (wallet chip, tickers, stat numbers).

### 2. The reference components
- Port `packages/ui/src` into `components/zk/`, keeping its inline styles:
  - badges, callouts, pills, chips;
  - button, amount input, segmented control;
  - review card, progress ring, step list, step tracker;
  - AgentsCard, WalletCard, QR card, toggle;
  - access card, settings group and row;
  - the phone sheet and gestures.
- Recolour all 64 periwinkle values to the accent. Done means a search finds none left.
- Reuse our QR maker (`components/ui/qr.tsx`), `ShijimaMark`, and the existing theme toggle.

### 3. The frame and the sidebar
- New `components/shell/app/AppFrame.tsx`: the canvas and the framed panel. `main` scrolls inside the frame above 980px; below that the page scrolls normally.
- Rebuild `AppSidebar.tsx` on `WalletShell.tsx:106-137`:
  - logo block with "AGENTS · ROBINHOOD CHAIN";
  - MAINNET pill and market clock;
  - nav (W2) with the accent bar;
  - Your agents, and the gift card;
  - wallet chip with Get gas, account, theme toggle, LIVE block line, "Runs on OpenServ".
- It becomes an icon rail below 1100px.
- A slim row at the top of the scroll area holds Ask Shijima and the bell.
- Scroll fixes the review found:
  - `StrategiesScreen.tsx:114,177` scroll the window;
  - reels and islands use `100vh`;
  - a few `position:fixed` rules;
  - scroll resets on navigation.
- Signed out: the reference's 380px access card with Connect wallet.
  - The connector stays the browser wallet (MetaMask, Rabby, Robinhood Wallet).
  - WalletConnect for phone wallets needs its project id, already on the deploy list.

### 4. Money: the shared parts
- **Migration `0014_money_moves`**, additive only:
  - a `money_moves` table, one row per move started in the app: kind, status, chains, tokens, amounts, dollars, fee, transaction hashes, Relay id;
  - `cash_flows` links to it;
  - value snapshots gain a running total of money in minus money out, backfilled from past "changed outside the agent" events.
- **Chain additions:**
  - the Uniswap router's interface and the WETH address;
  - `readWallet(owner)`: one chain read for USDG, ETH and all 16 Stock Tokens, each priced at what a sale would give now.
- **One pattern for every move**, like our existing confirm card:
  - the server plans the steps (`lib/money/plan.server.ts`, `lib/money/relay.server.ts`, `app/money-actions.ts`);
  - the browser signs each one (`features/money/MoveRunner.tsx`);
  - the server checks the result on the chain or with Relay.
- **Safety rules:**
  - approvals for the exact amount only;
  - 1% slippage;
  - quotes expire after 60 seconds and are fetched again;
  - never send ETH to an agent (it can't take ETH);
  - decimals always read from the token, never assumed.
- **Five honest endings, in dollars,** copied from the reference: done · nothing sent · approval given, nothing moved · on its way · may have been sent (with the explorer link).
- **The chart fix:**
  - the engine writes a money row whenever it finds money came in or went out, matched to the move that caused it;
  - every chart and the Overview total subtract money in and out, so the $2 reads as $0 change;
  - the chart marks the moment: "You took out $2".
- **Who signs:**
  - the browser key signs only cash or as-is withdrawals, as today;
  - your wallet signs everything else.

### 5. Money: the screens
- **Every screen follows `ShieldScreen.tsx`:** a 560px column, and a card that steps amount → review → running → result.
- **Fund** (`/fund`): the five paths from the answers above. The Relay path generalises `BridgeIn.tsx`, which is then retired.
- **Withdraw** (`/withdraw`): reuses the existing withdraw builder in `lib/chain-build.server.ts`. Adds "sell one stock" and "take one stock as it is".
- **Send** (`/send`):
  - it checks the address;
  - it refuses token contracts as recipients;
  - it points agent addresses to Fund.
- **Receive** (`/receive`): wallet and agent tabs, a QR card, copy, and "Robinhood Chain only".
- **Bridge** (`/bridge`), the reference's two panels:
  - left: chain chips, token, amount with the live quote, destination, Resume;
  - right: the progress tracker.
- **Get gas:**
  - with a little ETH: $1 of USDG swapped to ETH in your wallet;
  - with none: Relay from another chain, or the free $1 gift, which includes ETH.
- **The studio and copy flow:** their money step becomes the same Fund picker.

### 6. Wallet, Activity, Evidence
- **`/wallet` (`app/wallet/page.tsx`, `lib/wallet.server.ts`)**, top to bottom:
  - title row with SYNCED;
  - the three-part card;
  - actions;
  - three activity rows;
  - Needs you;
  - Your agents cards with "checked just now";
  - the combined chart;
  - the gift and the On chain facts card.
- **On phones:** the swipe rail with two dots, four action tiles, and two activity rows.
- **Empty states:**
  - no agents: Create or Copy;
  - $0: Fund, or claim the free $1;
  - a failed read: Retry.
- **`/activity`:** the reference rows (icon, title, hash, amount, "View tx ↗", status) over decisions and money moves, with chips All · Needs you · Trades · Money · Failed.
- **`/evidence`:** the facts list, Copy all hashes, one table per agent (step, fingerprint, Blockscout), money moves, and the fingerprint checker from `components/check-it.tsx`.

### 7. Phone chrome
- Port `MobileChrome` into `components/shell/app/PhoneChrome.tsx`, and the phone rules into `styles/zk/phone.css`, scoped so they never touch the page.
- Tabs, the More sheet, drag-to-close sheets, pull-to-refresh, the route animation.
- It replaces today's bottom bar, `MobileBottomNav.tsx`, and the sidebar's phone sheet.

### 8. Settings, agent page, the rest
- `/settings` per W10.
- The agent page keeps round 3's layout, restyled:
  - its money strip reads Cash · Savings · Stocks · address, with the QR code linking to Receive;
  - Fund and Withdraw open the new screens.
- Every other page gets one class, `.zk-page`: 1040px wide, the reference's padding, and its title style.
  - Full-width pages opt out: reels, `/live`, rooms.
- Two contradictions fixed:
  - "0.5% a year" becomes "free", per D5;
  - "Start with $20" becomes "from $1".

### 9. Landing and motto
- Port `apps/landing` into `features/home/landing/`, in W12's order, with light-mode versions of its colours. The reference landing is dark only.
- The website shell (/, /home, /how-it-works, /docs) becomes nav pill + page + footer. The old header, ticker, grain and cursor go.
- The flip cards show our own live pages in frames, mounted only when visible:
  - Web: the showcase agent;
  - Phone: the same page at phone width;
  - Telegram: a chat card with the bot link and QR code.
- Allow our own pages in frames in `next.config.ts`.
- The motto goes into the share image, the manifest and the meta tags.
- `HomePage.tsx` and the carousel retire once each of their facts has a place.

### 10. Clean-up and records
- Delete the animated sidebar, `MobileBottomNav`, `Header`, `CustomCursor`, `GrainOverlay`, and dead `app-shell.css` rules.
- DECISIONS.md gets W1–W12, noting that W1 supersedes F8.
- New `docs/FIDELITY-ZKF.md` holds the table above.
- `THIRD_PARTY_NOTICES.md` credits ZK Freighter (MIT).
- Add the build log entry.
- Never commit the `apps/web/CLAUDE.md` that `next dev` generates.

## What Abu asked, and where it lands

| Abu, 23 Sep | Where |
|---|---|
| Deposit any amount, any token, converted or bridged to USDG | Steps 4–5, W4 |
| A way to withdraw, a wallet flow | Step 5, W5, W6 |
| See your wallet, everything you have, your agent's balance | Step 6, W3 |
| See your agent's evidence | Step 6, W7 |
| QR code and balances the way ZK Freighter does them | Steps 5–6 |
| Sidebar, sections, settings like the reference | Steps 3, 8, W10 |
| The app on paper, gradient background | Step 3 |
| Keep our light and dark colours | Step 1 |
| Landing and hero like the reference, and a motto | Step 9 |
| New routes | Routes table |
| "And beyond that I did not mention" | Scan, pull-to-refresh, route animation, sheets, quick amounts, docs order, Get gas, the chart fix |

## Checks
- `pnpm typecheck`, `pnpm lint` and `pnpm build` after every step.
- Read the Next 16 docs bundled in `apps/web/node_modules/next/dist/docs` before new page and caching code.
- **Fork rehearsal** (anvil on 8546, rehearsal database, the app on 3017), with fork money only:
  - fund with ETH, with a Stock Token the agent trades, and with one it doesn't;
  - withdraw some cash, sell one stock, sell everything;
  - send USDG;
  - Get gas;
  - the wallet card equals the chain, and a $2 withdrawal shows as $0 change.
- **Relay paths** can't run on a fork. I check their quotes live and read-only.
- **Browser pass** on every route at 390, 768, 1024 and 1440px, dark and light, visitor and owner:
  - no sideways scroll and no console errors;
  - the frame shows at 1440;
  - the phone chrome shows at 390;
  - Ask opens with ⌘J;
  - every money screen's empty, running, failed and done states.

## What only Abu does
- Nothing until the build is done.
- Then, if he wants mainnet proof, he runs one $1 fund from Base and one $1 withdraw himself; I never move real money in a browser.
- I record the hashes in the log.
