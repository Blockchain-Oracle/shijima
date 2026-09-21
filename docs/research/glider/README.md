> **Superseded 21 Sep 2026, evening.** Abu moved the design reference to Masayume, his own app. See
> `docs/FIDELITY.md`. Kept for the content ideas it produced (section 9 there).

# Glider, the reference

**Abu's decision, 21 Sep 2026: Shijima's interface is Glider's.** No other reference. The earlier
multi-product survey (`docs/research/ux/`) is superseded and kept only as history.

Everything below comes from Glider's live site on 21 Sep 2026: public pages with Firecrawl, signed-in pages in
Chrome with Abu's account. Raw pages are in `.firecrawl/glider/` (not committed), screenshots in `shots/`
(`in-*` are signed in), exact colour variables in `tokens.json`.

---

## 1. Authority record

| Field | |
|---|---|
| Target | Shijima web app, `apps/web` |
| Reference | [glider.fi](https://glider.fi) live site, 21 Sep 2026. Docs at [docs.glider.fi](https://docs.glider.fi). No public repository exists. |
| Authority order | 1. Abu's explicit decisions. 2. Glider live behaviour. 3. Glider docs. 4. Our older design brief, where it does not conflict. |
| Baseline strength | **Minimum baseline.** Abu: "I'm going with the glider and nothing else." |
| Allowed deviations | Abu, 21 Sep: remove what does not apply to us. Referrals, points, rewards and the trading side (Trade, the Investing Account, buying single stocks) are out, because "we are not a trading place". Withdraw must always be there. Brand is Shijima. The assets are our Stock Tokens on Robinhood Chain, bought with USDG. |
| Additions | An AI you can chat with (Abu, 21 Sep). The desk's timing decisions, the record, **Check it**, approvals, Telegram. |
| Missing evidence | Everything captured signed in on 21 Sep, including the full onboarding, the dashboard, deposit and withdraw, after Abu approved **Initialize** (an empty Mag7 portfolio now exists in his Glider account, no money in it). Not seen: a *funded* dashboard and portfolio. Money moving is Abu's to do, so those states are inferred from the public portfolio pages, which show real history. Feedback opened nothing visible. |
| Provenance | Closed source. We reproduce layout, flows and behaviour. We do not copy their logo, illustrations, portraits, or the Selecta typeface, which is licensed. |
| Task boundary | Research and ledger. No code changed yet. |

---

## 2. What Glider is, in one paragraph

You pick a **strategy** (a named basket with target weights, such as *The Mag Seven*), press **Buy**, and it
becomes your **portfolio**. A schedule rebalances it back to target on its own. You can browse strategies
others made, build your own in a visual editor, and watch every rebalance in a history list. It holds
crypto, tokenised US stocks (xStocks, Ondo) and gold. Sign-in is by email or social account through Privy,
which gives you a wallet without you knowing it. There is no AI.

We are the same thing for Stock Tokens on Robinhood Chain, with one difference that is the whole product:
Glider rebalances **on a clock**. We rebalance **when it is sensible**, and the market being shut is most
of the time.

**Glider already supports Robinhood Chain.** Its *Manage permissions* dialog lists it beside ten other chains
(`in-portfolio-permissions.png`). So a clock-driven portfolio of Robinhood Stock Tokens is something Glider could
offer tomorrow. What it cannot offer is what we are: the judgment of *when*, the written record of every
decision, and an assistant that can explain them.

Their own FAQ has a *Stocks* section asking "Why is my stock portfolio taking so long to rebalance?",
"Why did my portfolio only rebalance into some of the stocks?" and "Do onchain stocks trade 24/7?". Those
are the exact problems our desk exists to handle.

---

## 3. Design tokens

**Glider is built on shadcn/ui and Tailwind.** Its CSS variables are shadcn's own names (`--card`,
`--primary`, `--muted-foreground`, `--border`, `--radius`, the `--sidebar-*` set) plus Sonner toasts. That is
the stack we are moving to, so their palette becomes our shadcn theme directly. All 108 values, light and
dark, are in `tokens.json`. The ones that define the look:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--fg` | `0 0% 0%` | `0 0% 100%` | text |
| `--fg-muted` | fg at 56% | fg at 56% | secondary text |
| `--surface` | `0 0% 100%` | `0 0% 17.25%` | panels |
| `--accent` | `240 11% 96.5%` | `0 0% 15.3%` | grey card fill, chart panel |
| `--card` | `45 18% 96%` | `0 3% 6%` | cards |
| `--border` | `45 5% 85%` | `30 3% 15%` | hairlines |
| `--mint-green` | `148.5 88% 67.6%` | same | **the button** (Buy, Create your account, Initialize) |
| `--green-accent-1000` | `101 72% 44%` | same | positive numbers |
| `--red-accent-1000` | `0 100% 58.8%` | same | negative numbers |
| `--glider-bg-gradient` | `#191919 → #070707`, 135° | | onboarding background |
| `--radius` | `0.5rem` | | inputs; cards run larger, buttons are full pills |
| Builder blocks | weight mint `149 67% 76%`, asset yellow `44 81% 83%`, if/else cyan `188 87% 75%`, filter blue `217 79% 83%` | | the template tree |

- **Type:** Selecta, licensed. Substitute a close open grotesk.
- **Theme:** Light, Dark or Auto, set in settings. Auto follows the device. Signed-out pages render light, and
  Abu's signed-in session was dark.
- **Surfaces:** rounded grey panels on a flat page, no borders, no shadows.
- **Onboarding:** its own dark, full-screen treatment with a gradient, tinted cards and 3D art.

---

## 4. Parity ledger

**Exact** same thing. **Adapted** same promise, our data. **Additive** ours, drawn in Glider's style.
**Blocked** cannot be done honestly yet. **Excluded** only on Abu's word.

### 4.1 Shell

| Surface | Glider | Shijima | Class |
|---|---|---|---|
| Left sidebar | Dashboard, Explore, Stocks, Rewards, Create, Refer and Earn · Settings, Help, Feedback. Logo top-left, green **Sign in** pill top-right. `explore.png` | Same, minus Refer and Earn. Adds **Ask** (the chat). | Exact |
| Mobile | Logo, Sign in, hamburger. Everything stacks into full-width rounded cards. `mobile-*.png` | Same | Exact |
| Price ticker | Scrolling strip of asset, price, 24h %, arrow | Our 10 Stock Tokens. When the US market is shut the strip says so rather than implying a live price. | Adapted |
| Refer and Earn | Nav item, `/r/:code` links | Removed | **Excluded** (Abu, 21 Sep) |
| Rewards, points | Nav item, `/rewards`, points pill in the top bar | Removed | **Excluded** (Abu, 21 Sep) |

### 4.2 Explore `/explore` · `explore.png`, `mobile-explore.png`

| Surface | Glider | Shijima | Class |
|---|---|---|---|
| Hero carousel | Paged banners with a dot pager: "US politician trades are now global +55.06%", "Mag7 + SpaceX", "Stocks + ETFs" | Same carousel, true banners: the market is shut and your desk is on duty; *The Mag Seven*; *Ask your desk* | Adapted |
| Strategy grid | 17 themed tiles, each a name and a 1-year return: THE MAG SEVEN, AI FULLSTACK, PURE SILICON, HARD MONEY… | Tiles built only from our 10 tokens. Honest set: **The Mag Seven**, **Broad Market**, **Big Tech**, **AI Builders**, **Mostly Cash**. Return is the underlying stocks' 1-year return, labelled so, exactly as Glider's asset page labels "Underlying stock price". | Adapted |
| Invest like the greats | Pelosi, Buffett, Aschenbrenner, Wood trackers, halftone portraits | Needs a filings data source, and their holdings are mostly stocks we do not have. Faking it is not allowed. | **Blocked** until a 13F or congressional-filings source and more tokens |
| Invest with the pros | Bitwise-managed strategies | No partner | **Blocked** |
| Tokenised bonds, currencies | Two small sections | Not on Robinhood Chain. We do have SGOV (Treasury bills) and idle USDG earning in the Steakhouse vault (4.03% on Morpho today), which becomes a **Cash** section. | Adapted |

### 4.3 Stocks `/stocks` · `stocks.png`

| Surface | Glider | Shijima | Class |
|---|---|---|---|
| Page | Ticker, two banners, filter pills (Type, Sector, Style, Market Cap, Region), **Featured Stocks** cards: name, ticker, price, 24h, tags, market cap, volume, **View asset** | Same, with our 10. Region is always US so it goes. Type (Stock / Fund) and Sector stay. | Exact, one filter fewer |

### 4.4 Asset `/asset/:chain/:address` · `asset.png`

| Surface | Glider | Shijima | Class |
|---|---|---|---|
| Header | Name, token-on-chain ("VTIon on Ethereum"), price, 24h, availability warning | Same, "NVDA on Robinhood Chain". Our warning: a Stock Token is not a share. | Exact |
| Chart | "Underlying stock price", 1D 1W 1M 1Y | Same, plus the token's pool price, so the weekend gap is visible. That gap is our story. | Adapted |
| Details | Classification, company metrics, More Stocks, Contract, Explorer | Same. Explorer is Blockscout. | Exact |

### 4.5 Strategy `/strategy/:id` · `strategy-a.png`, `strategy-b.png`, `mobile-strategy.png`

| Surface | Glider | Shijima | Class |
|---|---|---|---|
| Header | Title, overlapping token icons with **+4**, **All Time Return** pill, **Share** | Same | Exact |
| Chart | Rounded grey panel, return %, 1D 1W 1M 1Y All, green above zero, red below | Same | Exact |
| Side card | Total invested, **Buy**, Users, Fees, Creator | Same. Users and total invested are real counts of desks on that strategy. Fees is our fee. Buy starts a desk with this mandate. | Exact |
| Description | Plain-English paragraph | Our preset description | Exact |
| Composition table | Token, Weight, Price, Market cap, 1h, 24h, sortable | Same, plus the cash line | Exact |
| Template | Tree of pills: "Weight specified percentage" → 50% → ETH | Our mandate as the same tree: cash %, then each stock % | Exact |

### 4.6 Portfolio `/portfolio/:id` → our desk · `portfolio-b.png`, `mobile-portfolio.png`

This is the page that matters most. Glider already has almost every piece we need.

| Surface | Glider | Shijima | Class |
|---|---|---|---|
| Header | Title, owner, **Share**, **⋯** menu | Same. ⋯ holds Pause, Withdraw, Close. | Exact |
| Value | Big "$0.00", all-time return, chart | Same | Exact |
| **Next rebalance** | Circular countdown ring, "00:00" | **Next check**, the same ring, counting to the next hourly look. When shut: "Market shut · on duty". | Adapted |
| **Fees saved** | "+$26.95", with an info icon | **Timing saved**: what waiting earned or cost against acting at once, from our Monday grading. It can be negative, and shows that honestly. | Adapted |
| Composition | Current / Past tabs | Current shows target against actual, so drift is visible. Past is the same. | Adapted |
| **Portfolio History** | Grouped rows that open: "15 Rebalances performed · 10 months ago", "2 Token withdrawals", paged "1 of 2" | **This is our record.** "38 checks, nothing to do" folds into one row, exactly like theirs. Acted, asked and refused rows stand alone. Each opens to the decision, with **Check it**. | Adapted |
| Template tree | As 4.5 | Our mandate | Exact |

### 4.7 Settings `/settings` · `settings.png`

| Surface | Glider | Shijima | Class |
|---|---|---|---|
| Appearance | Light, Dark, Auto | Same | Exact |
| Onboarding | "Replay onboarding" | Same | Exact |
| Swap preferences | Rebalance threshold (USD), Slippage (bps), Price impact (bps), Reset, Save, each with a one-line explanation | **Limits**: drift tolerance, largest single trade, daily cap, loss stop. Same row design, same one-line explanations. | Adapted |
| Notifications | "Soon" | **Telegram**, which we have built | Adapted |
| Display name, linked accounts, advanced | Rows | Same | Exact |
| Special codes | Referral family | Removed | **Excluded** (referrals, Abu 21 Sep) |
| Tax, API access | Rows, API "Soon" | Unseen behind sign-in | Pending sign-in |

### 4.8 Other public pages

| Surface | Glider | Shijima | Class |
|---|---|---|---|
| Home `/` | "Investing that works for you." · "Trusted by 100,000+" · "Your strategy never sleeps." · As seen on · the "you still do the rebalancing" paragraph · "The portfolio that runs itself" · "Built to watch the market for you" · "Invest in anything. Own everything." | Same sections, our words. The "trusted by" number is our real count. We have no press, so "As seen on" becomes live proof: the contract and real trades on Blockscout. | Adapted |
| FAQ | General · Stocks · Points and Referrals | General · Stocks · **The desk** (timing, the record, Check it). Points and Referrals removed. | Adapted |
| Rewards `/rewards` | Campaign cards, Active and Ended ("Earn 10% APR with the Mag7") | Removed. The interest on idle cash shows on the desk page instead. | **Excluded** (Abu, 21 Sep) |

### 4.9 Signed in · `in-*.png`

| Surface | Glider | Shijima | Class |
|---|---|---|---|
| **Onboarding, welcome** `/onboarding/0` | Full-screen dark gradient. Top stepper: **1 Choose portfolio · 2 Deposit · 3 Glide**. "Welcome to Glider", "Portfolios that are built to last.", three ticked promises, mint **Create your account →**, a large 3D render. Pressing it shows "Creating your account" for a few seconds while the wallet is made. `in-onboarding-0-welcome.png` | Same screen, same stepper: **Choose a strategy · Add money · Go on duty**. Our three promises: you choose what to own; it decides only when; every decision is written down. The wait is our desk being created from the factory. | Adapted |
| **Onboarding, choose** `/onboarding/1` | "Choose your portfolio". Three tall tinted cards side by side: hero art, title, one sentence, then a stock list with 24h and allocation. Back and close. "I want to **explore more** or **create my own**". On a phone the cards stack and the stepper hides. `in-onboarding-1-choose.png`, `in-mobile-onboarding-1.png` | Three cards: **The Mag Seven**, **Broad Market**, **Mostly Cash**. Same explore-more and create-my-own links. | Exact |
| **Onboarding, start** `/onboarding/2?templateId=` | Left: title, a chip "**Rebalances every 1h**", description, performance chart, statistics (TVL, users, live for), token table. Right: "Start using *name*" with three rows: **1 Create your portfolio [Initialize]**, 2 Deposit, 3 Start Gliding, each unlocking in turn. `in-onboarding-2-deposit.png` | Chip: "**Checks every hour · trades only when sensible**". Rows: **1 Create your desk** (the factory clone), **2 Add USDG**, **3 Choose how it acts** (Shadow, Ask first, On its own). One to one with our real flow. | Adapted |
| **Top bar** | Search "Search tokens, stocks, portfolios…", points pill, notification bell, account pill (gradient avatar, short address, ⋯) | Search, bell and account. No points pill. | Exact, points excluded |
| **Sidebar** | Collapses to icons on narrow screens. Expanded, Dashboard shows the balance under its label ("$0.00"). `in-settings-wide.png` | Same | Exact |
| **Account menu** | Copy address, My Profile, Hide Balances, Settings, API Keys, Sign out. `in-account-menu.png` | Copy, Hide Balances, Settings, Sign out. We have no profile or API keys to show. | Adapted |
| **Notifications** | Panel with Inbox and Archived. Empty: "Currently, nothing to report! This area will light up with new notifications once there's activity." `in-notifications.png` | The same inbox, filled with the desk's own news: acted, asking you, refused. It mirrors Telegram. | Adapted |
| **Strategy builder** `/editor/new` | Name, DRAFT badge, **Create portfolio**, reset, undo, redo. A dotted canvas holding a tree of pills: **Weight equal ▾** → **Select block ▾** → **+**. Right panel: **Portfolio simulation (Beta)** backtest, and **Your assets**: Cash, unallocated, 100%. `in-editor-new.png` | **Write your mandate** as the same tree. Cash is always a line in Your assets. | Adapted |
| Builder: weighting | Equal · Specified percentage · Market cap. `in-editor-weighting.png` | Equal and specified work today. Market cap is computed once when you save, and labelled with that date. | Adapted |
| Builder: blocks | Asset · Weight · If/Else · Filter · DexScreener · Kaito AI (off) · Yield (off) · Custom (off). `in-editor-blocks.png` | **Asset** (our 10 stocks) and **Weight** work. **Yield** is real for us: spare USDG earns in the Steakhouse vault. **If/Else** and **Filter** need the engine to support rules it does not have. **DexScreener**, **Kaito** and **Custom** feed crypto token lists and do not apply to Stock Tokens. | Asset, Weight, Yield Adapted. If/Else, Filter **Blocked** (engine). The other three **Blocked** (no equivalent). Not shown as fake options. |
| Builder: simulation | Backtest of the tree as you build it | Backtest on the underlying stocks' daily prices from Finnhub, labelled as the stocks, not the tokens | Adapted |
| **Settings, signed in** | As 4.7, plus Display Name (ENS, Basename, address, custom), Linked accounts (email, a Drip rewards account), Tax (a CoinTracker partner link), Advanced (**export the embedded wallet's private key**). `in-settings.png` | Display name and linked accounts stay. The private-key export stays if we adopt email sign-in, because that is what makes an embedded wallet truly the user's. Tax has no partner. | Adapted; Tax **Blocked** |
| **Support** `/support` (from Help) | "How can we help?", six topic tiles, popular questions, "Still need help? **Chat with us**", Discord, Blog, YouTube | Same page. **Chat with us** opens **Ask**. | Adapted |
| Feedback | Nothing visible opened | Unknown | Pending |

### 4.10 After Initialize: the flow Abu cares about most

Captured with his approval. In order, exactly as a new user meets it.

| Step | Glider | Shijima | Class |
|---|---|---|---|
| **Initialize** | Row 1 turns to a tick. Nothing else to confirm. | Row 1 turns to a tick when the factory has made the desk | Adapted |
| **Deposit** | Row 2 opens inline with **Skip for now** and two tabs. **Use Crypto** lists Crypto Transfer (instant), Binance, Coinbase (1–2 minutes), **Robinhood Transfer**, Glider Balance. **Use Cash** lists debit card, credit card, Apple Pay, Google Pay, with payment options for the visitor's country ("Auto — Nigeria"). `in-onboarding-3-deposit-options.png`, `in-onboarding-3-deposit-cash.png` | **Use Crypto:** USDG already on Robinhood Chain, or bring it from another network in one step, which the design brief already plans through Relay. **Robinhood Transfer** is the natural headline for us. **Use Cash** needs a card on-ramp that sells USDG on Robinhood Chain. | Crypto Adapted. Cash **Blocked** until an on-ramp supports USDG on 4663 |
| Deposit: crypto transfer | Network picker, the **portfolio's own deposit address**, Copy address, Done. `in-onboarding-3-deposit-address.png` | The desk's own contract address, Robinhood Chain only. Same screen. | Exact |
| **Start** | Row 3 "Start Gliding" with **Confirm** | Row 3 **Choose how it acts**: Shadow, Ask first, On its own, then Confirm | Adapted |
| **All set** | "You're all set. Just sit back and we'll do the heavy lifting." **Go to portfolio**. `in-onboarding-5-all-set.png` | "You're all set. The desk is on duty." | Exact |
| **You're live** | "Your portfolio is gliding. It will rebalance automatically on its schedule." A **Portfolio Live** badge, a **NEXT REBALANCE** countdown, the target weights, **Rebalance Now**, **View Portfolio**. `in-onboarding-6-live.png` | "Your desk is on duty." **NEXT CHECK** countdown, the targets, **Check now**, **View desk**. When New York is shut it says so here. | Adapted |
| **Portfolio, owner** `/portfolio/:id` | As 4.6, plus: a campaign strip on top, **Owner … (You)**, **Buy** and **Sell** under the stat cards, "Portfolio in draft mode" until funded, and an **Addresses** button. `in-portfolio-owner.png`, `in-portfolio-owner-full.png` | As 4.6, with **Add money** and **Withdraw** in the same place. There is no campaign strip. | Adapted |
| Buy | A dialog with the same deposit options, plus the tokens in your wallet you could send ("No tokens to deposit available") | Same dialog: Add USDG | Adapted |
| **Sell** | Amount in **dollars**, **Max**, "Available ~$0.00", an empty state, and a button that shows the amount: **Sell $0.00**. `in-portfolio-sell.png` | **Withdraw**: amount in dollars, Max, available, and the button shows the amount. It always goes to the owner, because the contract allows nothing else. | Adapted |
| Portfolio ⋯ | View strategy · Tokenize portfolio (coming soon) · **Manage permissions** | View strategy · **Who can act on this desk** · Pause · Close | Adapted |
| **Manage permissions** | "Permissions allow Glider to act on your behalf", one row per chain with a date and **Update**. The chains include **Robinhood Chain**. `in-portfolio-permissions.png` | One row: the desk's operator key, what it may do (its caps), and **Remove**, which only the owner can press | Adapted |
| **Dashboard** `/dashboard` | Title with **Trade**, **Deposit** and ⋯. **Total value** chart, 1D 1W 1M 1Y All. Stat cards: Points, **24h change**, **Fees saved**. Cards: Email connected, Invite friends. **Investing Account** (single assets). **My Portfolios**: Active and Archived tabs, **Create new portfolio**, then a table of Portfolio, Current tokens, **Next rebalance**, Current value, Total return, 24h return, View. `in-dashboard.png`, `in-dashboard-lower.png`, `in-dashboard-portfolios.png` | **Dashboard:** Add money and ⋯ (Withdraw). Total value chart. Stat cards: **24h change**, **Timing saved**, **Cash earning** (the vault rate). **My desks**: Active and Closed, **New desk**, and the same table with **Next check**. | Adapted |
| Dashboard: Trade, Investing Account | Buy single stocks and tokens from a search dialog | Removed: we are not a trading place | **Excluded** (Abu, 21 Sep) |
| Dashboard: Points, Invite friends | Cards | Removed | **Excluded** (Abu, 21 Sep) |
| Dashboard: Email connected | Card confirming the email | Kept if email sign-in is adopted | Adapted |
| **Dashboard ⋯ → Withdraw** | "Withdraw your assets. How would you like to withdraw?" **Withdraw as USDC** or **as your assets**, total value, destination wallet address, **Withdraw fee $1**, then **Preview Withdraw**. `in-dashboard-withdraw.png` | **Withdraw as USDG** (sell everything to cash) or **as your stocks**. No address field, because it can only go to the owner. The cost is shown, then **Preview withdraw**. The design brief already asks for the cost first. | Adapted |

### 4.11 Ours, drawn in Glider's style

| Surface | What it is | Class |
|---|---|---|
| **Ask** | A chat with your desk. It answers from the record: why it waited, what it would do now, what the numbers mean. It can explain, never trade. Uses SERV, the same model that makes the timing call. | Additive |
| Decision page | One decision: current → new holdings, the reasons, then the proof and **Check it** | Additive |
| Approvals | "Your desk wants to sell $600 of NVDA. Approve?" in the app and on Telegram | Additive |
| Market shut state | Everything that shows a price or a countdown knows when New York is shut | Additive |

---

## 5. What changes underneath

Nothing in the engine. The contract, the hourly worker, SERV, the record and Telegram all stay. This is a new
face on the same machine.

| Need | Where it comes from |
|---|---|
| Strategies | `packages/shared/src/presets.ts`. Add **The Mag Seven** (Big Tech plus TSLA) and **AI Builders**. |
| Users and total invested per strategy | Count of desks by `mandates.preset`, already stored |
| 1-year return per strategy | Daily history of the underlying stocks from Finnhub, which we already use |
| Ticker and asset prices | `packages/chain` quotes, which we already have |
| Timing saved | Monday grading, already in the engine |
| History rows | The record, grouped by run of the same outcome |
| Email sign-in | New. Glider uses Privy. We sign in with a wallet only today. |
| Components | shadcn on our Tailwind 4, plus recharts for the charts |
