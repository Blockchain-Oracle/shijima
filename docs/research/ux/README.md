> **Superseded 21 Sep 2026.** Abu chose Glider as the only design reference. See `docs/research/glider/`.
> Kept as history.

# What this looks like elsewhere

Research, 21 Sep 2026. Every product below was opened and captured; the screenshots are in
`shots/`. Links go to the exact page that was captured.

The purpose is narrow: **we are not inventing a category, so we should not be inventing an
interface.** Three industries have already solved every screen we have. This lists who solved
which one, and what to take.

---

## 1. The category we are actually in

Not "AI trading". The category is **automated rebalancing**: you choose the mix, something else
keeps you at it. It exists in three places at once.

| Where | Who | What they call it |
|---|---|---|
| US brokerage | M1 Finance, Betterment, Composer (SoFi) | a Pie, a portfolio, a symphony |
| Crypto, human-curated | Reserve, Index Coop, Morpho, Yearn | a DTF, an index, a vault |
| Crypto, agent-run | **Giza**, Glider | an agent, a strategy |

Our twist is one sentence long and nobody else has it: **the mix is yours and fixed, the only
judgment is *when*, and every decision including the boring ones is written down and checkable.**

---

## 2. Read this one first: Giza

[gizatech.xyz](https://www.gizatech.xyz/) · `shots/giza.png` · `shots/giza-agent-app.png`

The closest thing to us that exists. Their own words:

> "Your agent continuously thinks about your capital, evaluating markets, making decisions, and
> executing strategies on your behalf."
> "**Verifiable by Design.** All autonomous actions are provable, auditable, and explainable."
> "**Watch Giza in Action.** Track every decision as Giza dynamically manages risks, rebalances,
> and adapts in real time."

They claim $4.1B agentic volume and 822,951 autonomous transactions. So the pitch is proven —
and it also means "an agent manages your money" is no longer differentiating on its own.

**What they do that we should copy**
- Three numbers on the home page and nothing else: volume, assets under agent, APR. Big, live.
- A page called *Giza World* ([world.gizatech.xyz](https://world.gizatech.xyz/)) that is a live
  map of every agent action happening right now. It is pure theatre and it is the best thing on
  their site. Our version writes itself: a live wall of desks and decisions.

**What they do that we should not**
- "Autonomous financial intelligence for onchain capital" means nothing. We say dollars.
- You cannot tell, from their site, what the agent actually decided last Tuesday and why. That
  gap is our entire product.

---

## 3. Screen by screen

### 3.1 Writing the mandate → **M1 Finance "Pie"**

[m1.com/invest/what-is-a-pie](https://m1.com/invest/what-is-a-pie/) · `shots/m1-pies.png`

Twenty years of retail investors have been taught this vocabulary. We should not invent our own.

- The portfolio is a **Pie**; each holding is a **Slice**; each Slice has a **target percentage**.
- "When you deposit, M1 intelligently queues up your next buys. **Underweight Slices are bought
  first** to keep your portfolio more balanced over time." ← this is exactly our needs engine,
  said in one sentence a normal person understands.
- "Click **Rebalance** if you want to sell from overweight Slices and use the proceeds to buy
  underweight Slices."
- The whole feature is explained as a 7-card carousel: View → Build → Auto-Invest → Monitor →
  Diversify → Rebalance → Adjust. That is our `how-it-works` page, already storyboarded.

**Steal:** the pie-with-target-percentages control, the words *target*, *overweight*,
*underweight*, *drift*, and the seven-step carousel.

### 3.2 The decision page → **Composer, by SoFi**

[composer.trade](https://www.composer.trade/) · `shots/composer-home.png`

$37B traded, 18M orders, **2M account rebalances**. On their home page is the single most useful
image I found — a before/after card:

```
Current Holdings              New Holdings
NVDA  10%                     NVDA  50%
AAPL  50%       ───▶          AAPL  50%
META  40%                     META  (removed)
```

That is our decision page's hero. Today our decision page is a wall of prose and hashes. It
should open with this diff, and then the reasons, and then the proof.

Also note their AI is scoped the same way ours is — it helps you *write* the strategy, then
plain rules execute it. They put a disclosure link next to every AI claim. So should we.

**Steal:** the current→new holdings diff card, and the discipline of separating "AI wrote it"
from "rules run it".

### 3.3 Desk home and holdings → **Reserve**

[app.reserve.org](https://app.reserve.org/base/index-dtf/0x23418de10d422ad71c9d5713a2b8991a9c586443/overview) · `shots/app-reserve-dtf.png`

The best layout match to our desk page that exists, and (see §5) the code is MIT.

Left column: name, price, % change since, chart with `24H 7D 1M 3M YTD 1Y ALL` and a Line/Candles
toggle. Beneath it a table with tabs **Exposure | Collateral**, columns *Weight ↓ · Price change ·
Market cap*, one row per asset with its icon. Right column: a sticky action panel (amount, token
picker, balance, Max, slippage, one green button) and an **About this DTF** card in plain English.

**Steal:** this entire two-column layout for `desk/[slug]`. Exposure table = our holdings with
target vs actual weight. Sticky right panel = add money / withdraw. "About this DTF" = "what this
desk is for", in the owner's own words.

### 3.4 Lists and density → **Morpho**

[app.morpho.org/ethereum/earn](https://app.morpho.org/ethereum/earn) · `shots/app-morpho-earn.png`

The cleanest financial table in crypto. Columns: Network · Vault · Deposits · Liquidity ·
Exposure · Curator · APY. Every number has a token amount **and** the dollar value underneath it
in grey. Exposure is a row of overlapping token icons with a `+5`. Filters are pill buttons.

Two useful facts: it renders fine with no wallet connected, and **Steakhouse USDG shows 4.03%** —
our idle-cash vault, running at more than the 3.6% in `PRODUCT-SCOPE.md`.

**Steal:** amount-over-dollars number stacking, overlapping icon clusters, pill filters. Use it
for `/desks`.

### 3.5 The record → **a status page**

[githubstatus.com/uptime](https://www.githubstatus.com/uptime) · `shots/statuspage-history.png`,
`shots/statuspage-uptime.png`

This is the answer to our hardest problem and it is not a finance product.

An hourly desk makes ~160 decisions a week and most of them are "nothing to do". A list of 160
identical rows is unreadable, and hiding them destroys the point. Status pages solved this
exactly: **a grid of small squares, one per day, mostly calm green, and the calm is the message.**
GitHub shows 90 days as three month-grids with an uptime % per month, and the whole story reads
in one second.

Ours, per desk:

- one square per day since the desk opened, in month grids
- colour = the loudest thing that happened that day — grey *watched, nothing to do* · blue
  *acted* · amber *asked you* · red *refused*
- a number per month: "watched 720 hours, acted 4 times"
- click a day → that day's decisions, each openable, each with **Check it**

That is a hero nobody in this category has, it is honest, and it makes our 150 boring records an
asset instead of a liability. If one thing comes out of this research, it is this.

### 3.6 The live feed → **Toros**

[toros.finance](https://toros.finance/) · `shots/toros.png`

Their home page runs a ticker of real deposits: `0x2b60…d3c5 deposited $256.80 into HYPE1X ·
8m ago`. Cheap to build, instantly makes a site feel alive and real.

**Steal:** on our public home page, the same ticker of actual decisions —
`Shadow desk · held NVDA, spread too wide · 14m ago`.

### 3.7 The words → **Glider**

[glider.fi](https://glider.fi/) · `shots/glider.png`

100,000+ investors, and covered by Fortune, Forbes, Reuters, Schwab Network — so this register of
language passes with normal people:

> "Every traditional investing app makes you do the work. You still do the rebalancing. You still
> chase the better return across five tabs. You still watch your gains sit in cash because you
> forgot to reinvest them."
> "**Your strategy never sleeps.**"

**Steal:** the "you still…" construction for our home page, pointed at the weekend. *The US market
shuts on Friday. Your Stock Tokens keep trading. You still have to watch them yourself.*

### 3.8 Two more, for reference

- **Betterment** — [betterment.com/investing](https://www.betterment.com/investing) ·
  `shots/betterment.png`. "Build your wealth with automated investing." Their new *Custom
  portfolios* pitch — "let you pick your own stocks and ETFs **while we handle the rest**" — is
  our split of labour in eight words.
- **Dinari / xStocks** — `shots/app-dinari.png`, `shots/xstocks.png`. Tokenised-stock UI. Useful
  only for how they show a stock token row and their disclosure wording.
- **Robinhood** — `shots/robinhood.png`. Our tokens carry their name; matching their visual
  register costs nothing and buys familiarity.

---

## 4. Screen map

| Our page | Copy from | File |
|---|---|---|
| `/` home | Glider (words), Toros (ticker), Giza (three live numbers) | `glider.png`, `toros.png`, `giza.png` |
| `/how-it-works` | M1's 7-card carousel | `m1-pies.png` |
| Write the mandate | M1 Pie, target % per Slice | `m1-pies.png` |
| `desk/[slug]` | Reserve DTF overview, two columns | `app-reserve-dtf.png` |
| Holding detail | Reserve exposure table + Morpho number stacking | `app-reserve-dtf.png`, `app-morpho-earn.png` |
| `/record` | **status-page day grid** | `statuspage-history.png` |
| `decision/[seq]` | Composer current→new diff, then reasons, then proof | `composer-home.png` |
| `/desks` | Morpho vault table | `app-morpho-earn.png` |
| Weekend report | Composer strategy stats | `composer-home.png` |

---

## 5. Code we can lift

| Repo | Licence | Stack | Why |
|---|---|---|---|
| [reserve-protocol/register](https://github.com/reserve-protocol/register) | **MIT**, active (18 Sep 2026) | Vite + React 19, **shadcn/ui** (Radix + Tailwind 3.4 + cva + tailwind-merge), recharts, wagmi, viem, **Reown AppKit**, TanStack Query + Table | It is the app in §3.3. shadcn components are copy-paste by design, so they port straight across; only the bundler differs. Basket weights, charts, sticky trade panel, connect flow — all readable. |
| [beefyfinance/beefy-app](https://github.com/beefyfinance/beefy-app) | MIT | JS | Old (2022). Vault-card patterns only. |
| [morpho-org/earn-basic-app](https://github.com/morpho-org/earn-basic-app) | none stated | TS | Minimal vault interface, worth 20 minutes. |
| [IndexCoop/index-app](https://github.com/IndexCoop/index-app) | none stated | TS | Index basket UI. No licence — read, do not copy. |

Register is the one. MIT, maintained this month, same wallet library, and shadcn underneath.

### The actual reason our UI looks like nothing

`apps/web/package.json` has Next 16, React 19, Tailwind 4, wagmi and TanStack Query — and that is
all. **No component library, no `components.json`, no chart library, nine hand-written
components.** Every product in this document is built on a design system and draws charts with a
real library. We are drawing an investment product with bare Tailwind and no charts.

The cheapest fix by far, and the one that changes how the whole thing looks in an afternoon:
`shadcn` (it supports Tailwind 4) plus `recharts`, then rebuild the pages against the layouts in
§3 rather than inventing them.

---

## 6. What this says about our plan

- The add-ons at the end of the schedule — holding detail, settings, weekend report — are not
  invented. Reserve, M1 and Morpho all ship them, because a portfolio product without a holding
  page feels broken. Keep them; build them from these references instead of from scratch.
- The record page is the one screen with no competitor. It deserves the most design attention,
  and §3.5 is how it gets it.
- Nothing here needs new engine work. Every item is a layout or a word.
