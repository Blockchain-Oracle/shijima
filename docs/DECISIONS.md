# Decisions

Made 2026-09-19 by Claude, on Abu's instruction to answer the open questions rather than ask them.
Abu can overrule any of these. Each one says what was decided, why, and what it rules out.
This closes section 8 of `PRODUCT-SCOPE.md`. Evidence for decision 1 is in
`research/2026-09-19-weekend-market-evidence.md`.

---

## The product in one paragraph

A desk that keeps your Stock Token portfolio the way you told it to, during the hours when nothing else
is watching. You give it a mandate: what to hold, in what proportions, and your limits. It wakes on a
schedule. Most of the time it finds nothing to do and says so. When something does need doing, it
decides whether to do it now, do part of it, wait for the market to reopen, or refuse. It writes down
why, including what it chose not to do, and that record is fixed to the transaction so nobody can
rewrite it later. On Monday it marks its own homework.

---

## 1. What the desk decides

**The owner decides what to own. The desk decides when, how much at a time, and whether at all.**

The three options in the scope doc were not alternatives. They are three parts of one decision:

- The **mandate** is the what. Target weights, a tolerance, limits, and plain-language notes. It comes
  from the owner. The desk never invents a position.
- The **premium or discount** against the reference price is the main evidence for when.
- The **news** is what tells the desk whether a premium is a mispricing or simply the new price.

So at each wake-up the desk asks one question: *given the mandate and what has changed, is there
something to do, and is now an acceptable time to do it?* The answers are act, act in part, wait for
the reopen, or decline.

**Why.** Measured on five weekends, NVDA moved up to 2.5% from Friday's level with the pool trading
every hour, and Sunday's price was a poor guide to Monday's open. Paying the weekend premium on 22
August cost 3.8% by Monday. Waiting instead of selling on the 12 September weekend cost a further 1.8%. No rule is
always right, so it takes judgment, and judgment is only trustworthy with a record. That is our product.

**What it rules out.** The desk does not predict prices, does not pick stocks, does not fade or chase
the weekend premium as a strategy, and never claims an edge. An LLM that reads weekend news and takes
positions is the most crowded category in every hackathon surveyed, and it is not something anyone
should trust with money overnight.

**Where the drama still comes from.** Protective rules firing when the broker is shut. "Cut NVDA by
half if it falls 3% on-chain" is a rule that can only be honoured here, on a Sunday. That is the demo.

## 2. One person's money, not a pool

**Each desk manages one owner's money in that owner's own account. The product serves many owners, each
with their own desk. Nothing is pooled.**

**Why.**
- A pooled vault must price its shares. On weekends the only honest price source is stale by design, so
  anyone depositing or withdrawing on a weekend trades against the other depositors at Friday's price.
  The flaw sits in exactly the hours the product exists for. Fixing it means closing deposits at
  weekends, which is a fund with opening hours.
- The whole experience is "your rules, your approvals, your record". In a pool there is no "your".
- "An agent that cannot send your money to anyone but you" is a stronger promise than "deposit into our
  vault". It is the promise the scope doc already makes.
- A pool of debt securities run for a fee is a collective investment scheme. That is a legal weight we
  do not need.

**What it rules out.** The ERC-4626 desk vault and operator carry from the earlier "full-ceiling"
write-up. That version becomes a later product, earned by a public track record. Many owners still
gives a revenue story, one fee per desk.

## 3. Approval first, autonomy earned

**Day one points at approval. The ladder is shadow, then approve, then autonomous within caps.**

- **Shadow.** Runs for real, spends nothing, records what it would have done. Every desk starts here.
- **Approve.** Asks in Telegram before each action. A request expires at a stated time, and an expired
  request is recorded as a non-action with its reason.
- **Autonomous.** One switch, turned on by the owner. Acts alone inside the caps. Still asks when an
  action is large, using the size trigger from the scope doc.

**Why.** The value is acting while the owner sleeps, so autonomy has to exist. The trust is that the
owner chose it after watching the desk work. Shadow mode with a visible promotion rule is that path.

## 4. Uniswap v3

**v3 SwapRouter02, with the pool chosen per token by depth.**

**Why.** 96 of the 98 routable Stock Token pools are on v3. $1,000 of NVDA costs 10 bps round trip,
which is just the fees. The pool trades about $1M an hour. Desk sizes are tens to thousands of dollars,
so v4's extra depth buys nothing, and its router is a modified fork that breaks the standard SDK.

**One trap found while checking.** The deep pool is not always the 0.05% tier. TSLA and MSFT liquidity
sits in the 0.3% tier, and the MSFT 0.05% pool is empty. Choose by depth every time.

## 5. Who it is for

**A crypto holder outside the US who wants to own US stocks without a broker, and does not want to
babysit them.** Abu is the first user: in Nigeria, holding stablecoins, with no easy path to a US
brokerage account.

**Why.** Stock Tokens are eleven weeks old, so existing holders are few. The people Robinhood built
Stock Tokens for are the 120+ countries where a US brokerage account is hard to get. The funding step
from Base or BNB Chain is already in scope, and it only makes sense for this person.

**What it means for the first screen.** "Own US stocks from your stablecoins. A desk watches them while
the market sleeps." Someone who already holds Stock Tokens can still move them in, but the page is not
written for them.

## 6. The fee

**A small yearly percentage of what the desk holds, shown accruing on every statement, waived during
the beta. Shadow mode is always free.**

**Why.** A desk that mostly does nothing must not be paid per trade, because that pays it to churn. A
share of profit would pay it for the stock market going up, which is not its doing. Every product that
"looks after your money" charges on assets: Wealthfront and Betterment at 0.25%, Public at 0.49%.
We show 0.5% and collect nothing yet. Showing "you would have paid $0.03 this week" is honest and needs
no contract work. The paid endpoint and the clonable template stay as later revenue.

---

## Four things the scope doc should gain or fix

1. **The Monday scorecard. Add to IN.** When the market reopens, the desk grades each weekend decision
   against what happened: "waited on Sunday, the premium closed, waiting saved 1.4%". It grades
   decisions, not profit. It is cheap, nobody ships it, and it is what makes the kept record worth
   keeping. It was in the early research and fell out of the scope doc.
2. **The decision hash goes on-chain, in the same transaction as the trade.** The scope doc says the
   record is "tied to the transaction". A record that lives only in our database can be edited by us,
   so the claim would be untrue. Gas on this chain is a fraction of a cent. Non-actions can be committed
   in a daily batch.
3. **Item 15 is wrong as written.** The stale feed is not "last close". The SPY feed last updated before
   Friday's open. Label it "last oracle update" with its time, and take our own snapshot of the pool
   price at 16:00 ET as the reference for the premium.
4. **A premium under about 50 bps is noise.** The feed itself only moves on a 0.5% change. The desk says
   "in line with the reference" below that and does not reason about it.

Also for the record: only 37 Stock Tokens have a Chainlink feed. The first allowlist is about ten names
with a feed and a deep pool.

---

## The cut

The catalogue marked 92 things IN. Most of them are the same few features described many ways. Counted
as things to build, the first version is eight features and one screen of disclosures.

| # | Feature | What it absorbs from the catalogue |
|---|---|---|
| 1 | **The desk account.** Owner's own account, fund in, withdraw out, agent can never send funds elsewhere | 57, 61, 62, 65, 66, 67, 68, 74, 81, 86, 112 |
| 2 | **The mandate.** Target weights, hard limits, plain-language notes, two or three presets | 103, 107, 108, 73, 49 |
| 3 | **The read.** Balances reconciled, session, reference price and its age, premium, depth, halt, pending corporate action, multiplier history | 151, 152, 157, 162, 164, 166, 171, 178, 11, 85 |
| 4 | **The decision.** SERV picks among concrete alternatives with confidence and evidence | 41, 47, 52, 55, 77 |
| 5 | **The gate.** Deterministic limits that can veto and never originate: caps, drawdown stop, allowlist, size trigger, price-impact guard, duplicate block | 58, 59, 70, 71, 72, 76, 78, 93, 50, 155, 156 |
| 6 | **The execution.** Itemised preview, v3 swap, idle USDG swept into the vault, failure messages that name the cause | 44, 45, 167, 19, 26 |
| 7 | **The record.** Every decision including non-actions, hashed on-chain, browsable on the web, graded on Monday | 20, 30, 42, 43, 46, 48, 51, 53, 56, 143, 144 |
| 8 | **The voice.** Telegram message to ask or report, approve or reject by reply, pause and resume, and one status message edited in place | 1, 8, 9, 10, 123, 176, 184 |
| | **Shadow mode** runs through all eight | 5, 97 |
| | **One disclosures screen**, mostly copy | 153, 154, 158, 159, 160, 163, 168, 169, 170, 92, 96 |

**Why the edited status message stays in.** It solves a real problem. A desk that checks every hour and
reports every non-action would send 160 messages a week. So an action or a question is a new message
that notifies, and a non-action is a silent edit of one pinned status line: "Last check 03:00. Nothing
to do. NVDA in line with reference. Next check 04:00."

**Moved from IN to LATER:** realized profit over a custom window (21), allocation table per market
(27), skip the next scheduled action (69), the emoji menu grid (173), active orders view (180),
suggested first prompts (113), sponsored gas as a promise to the user (111, scope item 22).

**Moved from IN to not applicable:** gas price ceiling (94), because gas here is a fraction of a cent.
Recipient allowlist with cooldown (60), because the desk can pay out only to its owner. Read-only data
scope (75). One-tap action that skips confirmation (175), because that is simply autonomous mode.

Whether transactions are gasless is an architecture choice for later, not a feature to promise.

---

## Decisions made after the architecture research

Made 2026-09-19 from the five research reports in `research/architecture/` and two independent reviews
of the plan. Full design in `ARCHITECTURE.md`.

1. **The desk account is a small custom contract, one per owner.** Not a smart-account kit. Kits cannot
   cap sells in dollars, bound the price, or force the decision fingerprint into the trade. The
   contract was proven on a fork: a plain contract bought NVDA, sold it, used the vault and got
   everything back. It has no upgrade path, no admin, and the owner never changes.
2. **The honest promise.** "The agent cannot send your funds to anyone. A stolen agent key can only
   make bad trades, costing at most 8% of your daily limit per day, until you remove it." This goes on
   the disclosure screen. It is stronger than "cannot steal" because it is exactly true.
3. **A known limit, stated openly.** If a weekend price moves more than 8% from the last official
   update, the agent's trades are refused by the contract. The owner can still sell. The record and
   an alert say so.
4. **Telegram is our own bot.** OpenServ's Telegram integration cannot send, edit or receive button
   presses. This corrects scope item 26. OpenServ still gives us the registered agent and the hourly
   cron trigger, which is the mental model Abu described.
5. **Holdings are valued on the pool's 30-minute average, never on the price feed.** The feed is frozen
   all weekend, so a loss stop measured on it could never fire when it matters. The first breach is a
   soft pause and an alert. The second in a row stops the desk on-chain.
6. **Gas is cents, not fractions of a cent.** About 3 cents a trade and 9 cents a vault deposit. Idle
   cash is only parked when the amount makes that worth it. The operator pays gas for every agent
   action. Owners pay only for their own rare transactions.
7. **"Wait" is remembered.** A decision to wait for the reopen is stored. The desk does not ask the
   model the same question every hour. It reopens the question only when something measurable changes.
8. **An approval is re-checked before it runs.** Prices are refreshed when the owner approves. If the
   result has moved more than half a percent from what was shown, nothing is executed and that is
   recorded.
9. **Grading happens at every reopen, and past weekends are replayed.** The live weekend's Monday grade
   falls after the first deadline, and weeknight grades mostly read "no real difference". A clearly
   labelled replay of earlier weekends shows grading working in time.
10. **Pause is soft by default.** Pausing from the website or Telegram is instant, free and reversible.
    The on-chain stop is kept for the loss limit and for removing the agent.
11. **The owner pins the pool for each token.** An empty pool can be seeded by an attacker, so the
    agent is never allowed to choose the pool.
12. **Added pages.** A read-only live desk and a reasoning comparison, for judges. A plain "how the
    desk decides" page. A "withdraw without our website" page.

---

## Decisions made while building the engine

Made 2026-09-20 by Claude. Abu can overrule any of these. Each is a constant in one place.

1. **A holding may wander 3% of the desk before the desk considers acting** (`DEFAULT_LIMITS.driftToleranceBps`,
   300). Betterment rebalances at about the same drift. The owner can change it.
2. **A trade must correct a drift worth five times what it costs one way** (`COST_MULTIPLE` in `wake/needs.ts`).
   Six approved tokens cost about 10 bps a round trip and four cost about 60. At the 3% default this never binds.
   It exists so a tight tolerance on an expensive token cannot trade the owner's money away in fees.
3. **No action under $1** (`MIN_TRADE_USDG`). A trade costs the operator about 4 cents of gas. It also means a $20
   desk only acts on a 5% drift, which is right for a desk that small.
4. **Three presets**, from brief 8.6: Broad market (S&P 500 fund 50, Nasdaq fund 30, cash 20), Big tech (six names
   at 14 each, cash 16), Mostly cash (cash 60, S&P 25, Nasdaq 15). Default largest holding 50%, loss limit 15%.
5. **"Blocked by a limit" means the desk wanted to act and a limit stopped it.** If the model said wait or decline,
   that is the outcome, even when a limit would also have blocked it.
6. **Shadow mode remembers what it would have done.** After "would have bought", later hours read "nothing new, the
   desk would already have bought at 02:00" with no model call, until the market reopens or new cash arrives. That
   is how a live desk would have read, which is the point of shadow.
7. **At most three candidates per check** (`MAX_CANDIDATES_PER_WAKE`). Sales first, then the largest drift.
8. **A record names its desk and chain inside the hash**, like an EIP-712 domain. Without it two desks produced
   the same fingerprint. The database refuses a body that names another desk.
9. **Tests are not a deliverable** (Abu, 20 Sep). A critical path is proven by running it: a fork, then a few live
   cents. This replaces the older build rule that five engine parts get tests before callers.

---

## The name

Abu names his projects in Japanese, as he did with Baku (獏). **Shijima (しじま)**, chosen by him on
2026-09-21 and registered as the Telegram bot @ShijimaBot.

Shijima is the stillness of deep night: the hours when nothing moves and no one is watching. Those are the
hours this product works, and stillness is most of what it does. Page after page of its record says "nothing
to do", and that is the point, because those entries are the proof it was awake and honest. The word is rare
enough in English to be ownable, and nothing in crypto uses it.

**Set aside along the way, kept so the ground is not covered twice.** *Bantō* (番頭), the Edo-period senior
clerk who ran a merchant's shop within limits the master set: an exact fit for the role, but a common job
title anyone could take. *Maai* (間合い), the interval a kendoka reads before striking: perfect for a product
whose only judgment is timing, but MAI is a well-known stablecoin and the two would be confused constantly.
*Hikae* (控え), which means standing by, holding back AND the written record all at once: the richest fit,
but English speakers say "hi-kay" and lose it. *Koroai* (頃合い), the right moment. And *Omamori*, the
protective shrine charm, rejected on purpose: it promises protection, which this product must never imply.

---

## Still open

| Question | Status |
|---|---|
| How the owner's account is built | **Settled.** Custom contract, decision 1 above. |
| Whether OpenServ cron survives our process being down | Tested Sunday. It no longer matters much: our own timer catches any missed check. |
| Whether Telegram messages can be edited | **Settled.** Our own bot, so yes. |
| SERV tool calls with `reasoning_effort` | Tested Sunday with one call. |
| Where the news comes from | **Settled.** Finnhub, with Tavily as fallback. Weekend coverage tested Sunday. |
| How much real money goes in | About $100 of USDG: a $20 test desk, a $50 demo desk, and the main desk. Abu decides. |
| Does a build with no MCP qualify for the "Mainnet & MCP" track | **Abu asks in the OpenServ Telegram on day one.** |
| The product's name | **Settled 2026-09-21: Shijima (しじま).** Abu chose it. Reasoning below. |
