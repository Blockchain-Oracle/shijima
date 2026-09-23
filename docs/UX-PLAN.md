# Shijima UX overhaul: web app and Telegram bot

## Context

Abu opened the app on 22 Sep and found the experience mediocre.

**Strategies and new desk**
- The strategy cards have no logos.
- "Broad market" and "AI Builders" mean nothing to a normal person.
- The new-desk flow isn't creative: no tabs, no logos, and choosing a basket is dull.

**Desk page**
- The desk and its history ("memories") read as plain text.
- There's no portfolio chart worth the name.

**Telegram**
- Connecting Telegram isn't one click.
- The bot looks shabby: no brand, no images, and it doesn't feel like a real bot.

He asked for 21st.dev (skill and CLI) to be used to the maximum. The deadline is 28 Sep, five days away.

### What I saw, 23 Sep
Headless Chrome screenshots of the running app are in the scratchpad `now/`.

**/strategies (the studio)**
- Six text-only basket boxes.
- "Set weights yourself" opens ten rows of `0 %` inputs.
- The preview card reads "Unnamed desk" with an empty bar.
- No logo anywhere.

**/desk/showcase**
- One narrow column, with the right half of the screen empty for visitors.
- Holdings rows are walls of jargon ("$228.6255 now (pool, just now) · reference $229.1195 (the pool at the last close)").
- The chart is 180px high, still shows the TradingView logo, and has two odd green arrows.
- Limits are an eight-row table, and the record is plain boxes.
- **At 390px wide, cards overflow off the right edge** and the Record tab is cut off. That's a real bug.

**/record**
- Browser `<select>` and date inputs.
- The page is mostly empty.

**The bot, from the live Bot API**
- `getMe` shows the display name is **"Omamori"**. The username is ShijimaBot.
- `getMyCommands` is empty, and so are both descriptions.
- The menu button is the default.
- There is a /start and there are Approve/Reject buttons (`bot.ts:66`, `:296`), but no photo, no main menu and no profile.

**Data**
- Basket performance: `basketSeries()` in `apps/web/lib/markets.server.ts:119` already computes a basket's value from `price_points.pool_mid_e8`. There are 7,726 rows for all 10 tokens since 22 Aug, so the 30-day return is real.
- Desk value: `valueHistory()` in `packages/db/src/queries/public.ts:219`.
- `cash_flows` has 0 rows, so a "money in" line would be flat. The chart shows value against the **loss-stop baseline** (`desks.drawdown_baseline_usdg`) instead, which is the line that actually matters.
- The demo desk moved to v1 last night:
  - Its own history is hours long.
  - v0 holds 46 decisions and 21 snapshots (20–22 Sep).
  - `seq` restarts on v1.
  - v0 has no share slug and is hidden from visitors (`desk.server.ts:73`).

### The design system stays
- Masayume/Agari: Sora, Inter and JetBrains Mono, vermilion `#e04d26`, the `styles/agari/*` sheets, dark first (memory: one reference, not a menu).
- 21st components are restyled into those tokens.
- `.21st/design.json` exists (from `21st init`). Step 0 records the constraints there.

## 21st.dev: what I searched and what I'm taking

- The account is logged in and paid, with unlimited search and code. **AI generation is not enabled on this account**, so the workflow is search → view → `21st get` → adapt, which is the skill's own path.
- I ran about 40 searches, downloaded 78 previews and looked at every one on contact sheets (scratchpad `21st/sheets/`).
- The picks, with the imports read from `21st get`:

| Surface | 21st component (id) | Why this one | Deps |
|---|---|---|---|
| Portfolio chart | **Portfolio Chart** (29532) | Value vs a baseline line, a drawdown pane (our loss stop), a range picker and a crosshair readout. Pure SVG, which removes the TradingView logo. | none |
| Allocation | **Sectors Donut** (20086) | Literally "SPY of 503 holdings" with a legend. Becomes "what it holds vs target". | framer-motion → motion |
| Record ("memories") | **Activity Timeline** (28340) | Grouped by TODAY / YESTERDAY, with an icon and time per row | none |
| Basket choice | **Radio Group with Plan Cards** (10156) | Icon tile, name, line, value, radio. The icon becomes a logo stack and the value becomes the 30-day return. | lucide |
| Studio stepper | **Multi-Step Setup Wizard** (29518) | Progress bar, "Step 1 of 4", labels, Back/Continue. Works on a phone. | lucide; sonner → our toast |
| Logo pill | **Avatar Stack** (28355) | "Loved by 30K+" becomes "Nvidia, Microsoft +3" | none |
| Money numbers | **Number Flow** (28181) | Rolling digits | motion |
| Tabs and ranges | **Segmented Control** (23552) | A sliding pill | motion |
| Weights and limits | **Segmented progress bar and slider** (9659) | Weight sliders; "spent today $3 of $15" | none |
| Holdings rows | **Market Watchlist** (20110) + **Stock Card** (8034) | Logo, name, sparkline, value, change | lucide |
| Desk hero | **Wallet Card 2** (5214) | A balance with action buttons | lucide |
| Connections | **Connect Integration Cards** (28170) | Telegram, wallet and OpenServ agent cards | lucide |

- The catalogue has **no basket or ETF card**. It's composed from the logo pill, the donut, a sparkline and Number Flow.

## The plan, in build order

### 1. The bot looks like a real bot (day 1, about 2 h)
This comes first because it's quick, it's visible in any demo, and it answers three complaints.

**Profile, set by the worker at boot** (`apps/worker/src/telegram/start.ts`)
- Read each value first and write only when it differs. `setMyName` is tightly rate-limited.
- `setMyName("Shijima")`, replacing "Omamori".
- `setMyDescription` and `setMyShortDescription`, in plain words ("Keeps your Stock Token basket on track while Wall Street sleeps").
- `setMyCommands`: start, portfolio, record, pause, resume, ask, help. Add the new ones to `KNOWN_COMMANDS` (`bot.ts:35`).
- `setMyProfilePhoto` with the Shijima mark. It's in the installed Telegram types.

**Images, always optional**
- A static welcome PNG committed to the worker's assets and sent from disk, so it depends on no web route.
- If an image fails, the text still goes. Images are never sent inside the approval path in `outbox.ts`, so a failed image can't postpone or lose an approval.

**/start, not linked:** the welcome photo, then a text message with three lines and buttons [Connect my desk ↗ (opens the site)] [How it works ↗].

**/start, linked:** a portfolio text card, then a main menu:
- [📈 Portfolio] [🧾 Record]
- [⏸ Pause / ▶ Resume] [💬 Ask]
- [🌐 Open Shijima]

Menu presses `editMessageText` the same **text** message, with a ‹ Back button. No photo sits in the edited message, so edits keep working. "Record" shows the last five decisions as lines, each with a "See it" URL button.

**The rest**
- The pinned status message gets a ↻ Refresh button.
- The Approve/Reject flow isn't touched.
- Copy stays in `packages/shared/src/copy/telegram.ts`.

### 2. Foundations
- **Fix the 390px overflow** on the desk page and tabs (`DeskTabs.tsx`, and the card widths in the agari sheets).
- **Add `motion` 12**, as Agari has, and rewrite the 21st `framer-motion` imports to `motion/react`. Record the reversal of FIDELITY §3 in `DECISIONS.md`. Respect `useReducedMotion` everywhere.
- **Logos:**
  - Saved as files in `apps/web/public/tokens/`: svgl `nvidia-icon-light`/`-dark`, `apple`, `microsoft`, `google` and `meta`; Simple Icons `tesla`; Amazon's official mark.
  - SPY, QQQ and SGOV get designed monogram tiles ("S&P", "NDX", "T-BILL"), because neither source has the fund issuers.
  - `logo` is added to `tokens.json` through `scripts/build-tokens.ts`.
  - New `components/ui/TokenLogo.tsx` (with a monogram fallback) and `TokenStack.tsx` (from 28355).
- **Colours:** one colour per symbol in `packages/shared/src/token-colors.ts`, contrast-checked in both themes.

### 3. Plain-English baskets and strategy cards
- **Rename the labels** in `packages/shared/src/presets.ts`. Mandates store only the id (`desk.server.ts:270`), so this is safe.
  - Broad market → **"The whole US market"**
  - AI Builders → **"The companies building AI"**
  - The Mag Seven → **"The 7 giants"**
  - Big tech stays
  - Mostly cash → **"Play it safe"**
  
  Each gets a one-line "who it's for". Update the other places that name them: `copy/how.ts:31`, `markets.server.ts:348`, and the chat prompt's list at `core/src/ask/context.ts:112`.
- **Move `basketSeries()`** out of `markets.server.ts` into a shared server helper, so markets and strategies can never disagree.
- **`StrategyCard`:**
  - a logo stack
  - name and line
  - a mini donut in token colours
  - the **30-day return** with a sparkline
  - "Start with this"
  - a hover lift and a stagger on entry
- The three `aria-pressed` buttons in `StrategiesScreen.tsx` become the Segmented Control.
- "Your desks" rows get a mini chart, the value and a mode badge. Visitors get the existing sign-in prompt.

### 4. The desk page
- **Layout.** Two columns for visitors as well: the portfolio on the left; allocation and a condensed record on the right. The owner keeps chat on the left, as now. Phones keep the tabs, fixed in §2.
- **Hero (5214):**
  - the value in Number Flow
  - change since start in $ and %
  - a Practice/Live badge
  - owner actions: Add money · Withdraw · Pause, shown only when they apply
  - a countdown chip to the next check
- **Portfolio Chart (29532):**
  - value against the loss-stop baseline, with the drawdown pane
  - **range tabs appear only when there's data for them**, so the short history doesn't show empty ranges
  - check markers become small dots coloured by outcome
  - it replaces `DeskValueChart` on the desk only. `LineChart` stays, because `ChatChart.tsx` uses it. `PriceChart` stays on markets.
- **Allocation (20086):** a donut of now vs target, drift as bars, and one sentence ("Nvidia is 30% under target").
- **Holdings:** logo · name · value · 24h sparkline · weight vs target. The pool and reference detail moves into a tap popover.
- **Limits** become three gauges (spent today, room before the loss stop, largest share). The rest sits behind "All limits".
- **The record ("memories") on Activity Timeline (28340):**
  - grouped by day
  - an icon per outcome (acted, would have, waited, turned down, owner action)
  - token logos
  - an entry expands into its reasons, confidence and "Check it on chain"
  - quiet runs fold into one line
  - stagger on scroll
- **The earlier contract.** One folded group at the end: "46 checks on the earlier contract (20–22 Sep)", listing summaries with each one's transaction link on the explorer.
  - The chart prepends v0's 21 value snapshots, found by address through `desk_events.detail.movedTo`.
  - No seq routing changes. That avoids the `/decision/[seq]` collision and the v0 visibility block.
- **States:** empty, loading (skeleton) and error on every card; needs attention and assistant removed (`desk.server.ts:237`); paused; closed opened by URL; a new desk with no snapshots; Practice vs Live.
- **`/record`:** chips replace the selects (outcome, token, practice/live). The dates move into a popover. The timeline is shared with the desk page.

### 5. The studio
`Studio.tsx` and `StudioFields.tsx`. `CreateStep.tsx`, which deploys and asks for the wallet signature, gets a restyle only.
- A stepper built on 29518: a progress bar, "Step 1 of 4", slide transitions, and a sticky Back/Continue bar on phones.
- **Basket step:** radio cards (10156) with logo stack, donut and 30-day return.
- **Build your own:** a grid of logo tiles to tap and add. Each picked token gets a coloured slider (9659), the donut updates live, cash is the remainder (so the total always reads 100%), and there's an "even split" shortcut.
- **Limits step:** dollar sliders, and the sentence "at most $5 per trade, $15 a day" written live.
- **Preview card:** name, logo stack, donut, the caps in dollars and the mode, animating as fields change.
- **Telegram** stays after Create in `FirstSteps.tsx:14`, because a link code needs a desk id (`owner-actions.ts:99`). It gets the new one-click button (§6).

### 6. Telegram connect on the web: truly one click
- The code is made **when the owner's page loads**, if the desk isn't linked. The button is then a plain `<a href="https://t.me/ShijimaBot?start=<code>">`, which is one click and never popup-blocked. That fixes the extra click and Safari's `window.open` block (`TelegramConnect.tsx:91-121`).
- A QR code in a popover for desktop. The page watches the link (`telegramStateAction`) and turns green, "Connected as @name".
- Placements: the header account menu, the desk "Needs you" strip while unlinked, `FirstSteps`, and Settings as a "Connections" group (28170: Telegram, Wallet, OpenServ agent).
- **Kept per desk.** An account-level link would break approvals (`bot.ts:112`), the outbox (`outbox.ts:46,175,221`) and the unique index (`schema/desks.ts:194`), and it gains nothing with one owner and one desk. For Abu, "connected to your account" already holds, because the link carries his wallet's desk.
- **At deploy:** "Log in with Telegram" (Login Widget) and a Mini App menu button. Both need a public https domain registered with BotFather. Noted in BUILD-PLAN.

### 7. Motion pass
Page and tab transitions, the stepper slide, the card lift, Number Flow on the hero and cards, the timeline stagger, and toasts. No decorative loops.

## If time runs short, cut in this order
1. Portfolio or trade images rendered by a web route. Text cards stay.
2. `/record` chips and the date popover.
3. The build-your-own sliders (keep the inputs, restyled).
4. The Settings "Connections" cards.
5. Number Flow beyond the hero.

## Verification
- `pnpm lint`, typecheck, the 98 checks and the build. `21st review <changed paths>` per step, applying only its safe fixes.
- Headless Chrome on `localhost:3007`:
  - /strategies (three views), each studio step, /desk/showcase as visitor and owner, /record, /desks, settings
  - at 390, 768 and 1440, light and dark
  - `scrollWidth <= innerWidth` asserted in the page, and no console errors
  - I read every screenshot and fix what looks off before showing Abu
- The 30-day return for "The whole US market" is hand-checked against `price_points` for SPY and QQQ.
- **The bot:**
  - `getMe` returns "Shijima", `getMyCommands` returns 7, and the descriptions are set
  - /start (linked and not linked) and every menu button, live, sending only to Abu's own linked chat; each press edits the message
  - one approval still goes end to end on the rehearsal fork after the bot changes
- **The link:** from a fresh page load, one click opens Telegram and the web turns green.

## Not in this plan
The OpenServ architecture conversation (the agent's own wallet on SERV, trading through OpenServ agents, signing in to our app). Facts for it are in `docs/research/2026-09-23-openserv-publishing.md`.
