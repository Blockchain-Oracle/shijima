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
   make bad trades, costing at most 8% of your daily limit in each 24-hour spending window, so at most twice
   that across a window boundary, until you remove it." *(Reworded 22 Sep: `_spend` is a fixed window.)* This goes on
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

## Decisions made while building the owner controls

Made 2026-09-21 by Claude, in step 8 of the chat-first plan. Abu can overrule any of these.

1. **A button makes the same card the chat makes.** Each control runs the chat's own plain-code checks and saves the
   same proposal, with no model call, so the buttons keep working when SERV cannot answer. The press is written
   into the chat thread as an exchange ("Withdraw $20", then the card), so the thread stays the one history.
2. **`withdraw(token, type(uint256).max)` means the whole balance** (Desk v1, still undeployed). Without it, "sell
   everything and send it to me" and "close the desk" cannot fit one signature, because a sale's exact proceeds
   are unknown when the transaction is signed. A v0 desk gets the exact amount instead. Fork test added: 42 pass.
3. **Costs first, from a simulation.** Before any chain card is signed, the server builds its transaction from the
   chain as it is, simulates it, and shows what the owner gets, what each sale fetches against the price feed, and
   the network fee in dollars from the chain's own ETH / USD Chainlink feed. A simulation that fails is refused in
   words before anything is signed.
4. **The live chain is the check for amounts, not the hourly valuation.** Withdrawing more than the desk holds is
   refused when the transaction is built, with the real numbers. The valuation can be an hour old and money may
   have arrived since.
5. **Removing the assistant stops the checks quietly.** The desk waits in "needs attention" with the owner's own
   reason, and the hourly check skips it rather than recording a failure every hour. Restarting the desk with the
   wallet brings the assistant back and restarts it in one signature.
6. **Money from another network goes straight into the desk through Relay**, USDC on Base, Arbitrum, Ethereum or BNB
   Chain. A quote shows what is sent, what arrives, the cost and the time before anything is signed. The desk never
   receives ETH, so the optional gas top-up goes to the owner's own wallet as a separate transfer.
7. **Closing lives in settings**, away from the everyday buttons, and can still be asked for in the chat.
8. **The chat prompt is now `ask.v2`**: v1 with add money, the limits on the chain, and closing the desk. It is
   derived from the frozen v1 text so both stay byte-stable.
9. **The disclosure is `disclosure.v1`**, the brief's 8.3 text, accepted with a separate region declaration.

---

## Decisions made while building the markets and the stock pages

Made 2026-09-21 by Claude, in step 9 of the chat-first plan. Abu can overrule any of these.

1. **A strategy's chart is $1,000 put in at the start of the period.** Each stock's share grows with its pool price,
   the cash share stays cash. The reference line is the same basket valued at each stock's reference at that
   moment, so it STEPS at every close instead of pretending one flat line covers a month. The gap between the two
   lines is the basket's own gap. Computed from `price_points` on each request; nothing new is stored.
2. **A chart marks where a choice began, not every hour of it.** A waiting desk writes "waited" every hour; a run of
   the same outcome on the same desk and stock gets one marker, where it started. Acted is an orange arrow, waited a
   grey dot, declined and practice grey squares. Clicking a marker opens that decision's reasons, and the same
   decisions are listed in words under the chart.
3. **The caption is built from facts, not written by the model.** The basket's gap and what its reference is, the
   stock that moved most, "inside half a percent, I treat it as noise", halts, and how many times shared desks
   acted or waited. It costs no SERV and cannot forecast.
4. **The hero's right panel is the strategy's contents,** each stock with its weight and gap and a link to its page,
   then the cost of putting $500 in now (from the logged quotes), halts, the next report and **Start a desk with
   this** (`/start?preset=`). FIDELITY's "See it on Explore" had nothing behind it; the member links replace it.
5. **"Ask about this" types the question into the owner's desk chat and does not send it.** A chart is not a
   reason to spend the owner's chat budget unasked. Signed out, it says to sign in.
6. **A price alert fires once, through the owner's desk.** It is checked on every price slot the logger writes;
   firing and its message are one transaction, so it can never send twice. It needs a desk because Telegram and the
   bell are per desk. At least 0.25% (under half a percent is noise), at most 50%, ten waiting at once.
7. **Alerts come from the stock page and from the chat, through one set of checks** (`setPriceAlert`). The chat
   prompt is now `ask.v3`: v2 with `price_alert`, derived from the frozen v2 text.
8. **The multiplier history and report dates are synced by the worker**: multiplier changes from the chain's
   `UIMultiplierUpdated` events hourly (nine real dividend changes so far), report dates from Finnhub's earnings
   calendar twice a day, keeping only the date, the hour and the quarter, never Finnhub's text.
9. **The stock marks are Agari's vendored glyphs** (CC0 from simple-icons; Microsoft drawn as four squares; funds
   get a monogram). Credited in `THIRD_PARTY_NOTICES.md`.

---

## Decisions made while building the strategies studio

Made 2026-09-22 by Claude, in step 10 of the chat-first plan. Abu can overrule any of these.

1. **A desk exists as a row before it exists on the chain.** At the last step the server picks a random salt, asks
   the factory for the address that salt will give, and writes the desk's row with no deploy date. Money can be sent
   to that address first (brief 8.4, "owner has no ETH"). An owner has at most one such unfinished desk per factory,
   and the studio resumes it rather than making another, so money already sent there is never stranded. Checked on
   the fork: a page closed before signing came back to the same address.
2. **The limits the owner sets in the studio are written into the contract at creation.** Before, every desk got
   $5 per action and $15 a day whatever the owner said. Now the studio's per-action and daily figures go into
   `createDesk`. Defaults are $10 and $50.
3. **The test read is offered, not required.** Brief 8.7 says the desk will not start until the read-back is
   answered. It starts in practice anyway, where it spends nothing, and SERV credit is empty today, so a required
   read-back would block every new desk. The read is kept as the mandate's `read_back` only when the model answered
   and the read was of exactly the draft being created. Otherwise the side card says "Not yet" and the chat can read
   it back later.
4. **The disclosure is accepted before the desk's row is written**, because that is the moment an address money
   can be sent to first exists. It carries the "I am not in a restricted place" declaration. Once accepted, it is
   not asked again.
5. **The draft lives in the owner's browser**, as Masayume keeps an unfinished setup. The server sees it only when it
   is checked, read back or created, and checks it again each time. A preset in the address (Start a desk with this)
   wins over a saved draft.
6. **Whether the wallet can pay is judged against the real estimated fee**, with half again as margin. Creating a
   desk cost about $0.30 on mainnet; the fork's gas price is ten times that, so costs are never read off the fork.
7. **Start from a strategy copies the mix only**: a preset, or what a shared desk holds now. Never its trades, notes
   or limits.
8. **The first-run tutorial shows only to a signed-out first visit on /markets.** Its weekend number is the largest
   distance any Stock Token's pool moved from its Friday reference on the latest weekend in the price log (live:
   Meta, 0.9% above, 19–20 Sep). The region declaration itself is made at the disclosure, where it is recorded.
9. **`/start` now redirects to `/strategies`**, keeping a chosen preset. The old one-page start and its form are
   removed.

---

## Decisions made while building the savings-vault sweeps

Made 2026-09-22 by Claude, finishing what step 3 of the chat-first plan owed. Abu can overrule any of these.

1. **Only the idle part of the cash target is swept.** Cash above the target is on its way into Stock Tokens;
   parking it would mean a redeem, and a fee, every time the desk buys. So the vault holds at most the cash target
   minus what the desk keeps loose. In a $10,000 desk with 30% cash and a $50 per-action limit, the desk keeps $150
   loose and up to $2,850 goes to the vault.
2. **The desk keeps three per-action limits loose**, the most one check can buy. Its own buys never wait on the
   vault in an ordinary check.
3. **A sweep must earn, over 30 days at the live rate, three times what a deposit and its later withdrawal cost in
   network fees, and at least $10.** Rate and liquidity come from Morpho's API; the fee is measured gas units times
   the block's base fee (this chain ignores tips) times the Chainlink ETH price. Today that bar is about $0.11, so a
   sweep starts at roughly $140 of idle cash. The $5 demo desk will not sweep, and it should not.
4. **No model is asked.** A vault move is not a timing call and its value never leaves the desk. It is its own
   record (version 2, widened for `sweep`, `redeem` and a `vault` evidence item), with its own hash on-chain, and
   counts nothing against the owner's limits, as the contract counts nothing.
5. **Only a desk acting on its own sweeps.** Practice spends nothing. A desk that asks first is not made to approve
   housekeeping. Any desk not in practice may redeem, because its buys need the cash.
6. **v1 desks only.** v0's vault calls have no deadline, so a lost one could never be declared dead.
7. **Reconcile compares vault shares, not dollars** (new `vault_shares` on value snapshots, migration 0004), so the
   vault's own interest is never read as money arriving, and a remembered wait counts cash in and out of the vault
   together, so moving the desk's own cash is never "new cash arrived".
8. **A withdrawal the vault cannot pay now is said plainly, with what can be taken now** (brief 8.15): "The savings
   vault can pay out only $120 right now ... You can withdraw $170 now, and the rest once the vault has the cash."
   Withdrawing everything as it is always works: the vault shares go to the owner's wallet.
9. **Not built: interest earned so far** (brief 8.9). The owner can move shares with their own wallet, which a
   running total from our actions would miscount. The cash panel shows the amount and the live rate instead.

---

## Decisions made while building share cards, Rooms, Takes and Reels

Made 2026-09-22 by Claude, in step 12 of the chat-first plan. Abu can overrule any of these.

1. **The share card is for one decision on a shared desk**, from its decision page (a private desk has no public
   page for the QR to open). It is Agari's 1600×900 ticket: the outcome in words is the focal line, then the size,
   the gap to the reference and how sure the model was, then the grade after the reopen. Vermilion appears only
   when that grade came out better than acting at once; a worse one is ash, never red. No headline text, ever.
   The QR and the post open the decision's own page on whatever site the reader is on.
2. **The Room's gate is our sign-in plus owning a desk.** Agari asks for a join signature because its session
   cannot prove a wallet; ours already does. A desk counts once it has left `onboarding` (its contract exists).
   A desk in practice counts: the Room says "start a desk, even in practice, and it opens."
3. **Reading a Room is for members too**, as in Agari. Takes are public, like a shared desk.
4. **"Holds it" is opt-in and checked by the server** against the author's desks' latest valuation at the moment
   of posting, so no client can claim it. The Room remembers the choice in the browser.
5. **A take has no call.** Agari's takes are UP or DOWN on a Window. Ours are 240 characters about one Stock Token,
   filed under it and every approved `$TICKER` the words name (at most four). No sides, no "take the other side".
6. **Reels are the markets page's own reads**: the ten Stock Tokens (furthest from their reference first), what
   shared desks decided (the latest twelve, first of each run), and takes, woven stock, take, decision. The call
   row opens the stock, the decision's reasons, or the take composer. Nothing to bet on.
7. **Rate limits are counted in the tables themselves**: a Room line every 3 seconds and 20 in 10 minutes, 3 takes
   a minute and 30 a day (Agari's numbers), so they hold across restarts.
8. **The words are shown as the author's short wallet address**, as in Masayume and Agari. Posting says so, and
   says the desk's assistant never reads the Room or takes. The chat's context never loads either table.
9. **Reels sits after Markets in the nav**, where Agari puts it, on the desktop bar and the phone's pill.

---

## Decisions made in the 22 Sep review pass

Made 2026-09-22 by Claude, reviewing everything built against the plan at Abu's request. Abu can overrule any of these.

1. **"Check it" asks the public network from the browser.** The official RPC allows browser requests, so the page
   ships no fingerprint of its own to compare against: the browser fetches the transaction, decodes the desk's event
   and compares. A record with no transaction is proven by walking the `prevHash` links to the record that sealed it,
   and the page says which case it is. If the network cannot be reached, the page says only that the bytes match the
   stored fingerprint and points at the transaction; it never claims more than it checked.
2. **The disclosure's worst case is stated per 24-hour spending window**, twice that across a window boundary,
   because that is what the contract enforces. A rolling window in the contract was the alternative; wording that is
   exactly true was chosen over a contract change the day before v1's deploy. Recorded in `docs/V1-FREEZE.md`.
3. **`MAX_FEED_AGE` is 6 days in v1.** The price log shows real feed gaps of 96 hours over a holiday weekend; a limit
   equal to the longest observed gap would refuse the protective sell exactly when the mandate wanted out.
4. **The protective rule is structured, never parsed from prose.** One template, `price_move_sell` (a token the
   mandate holds, a fall of 1% to 20% below the reference on the pool's half-hour average, a cut of 10% to all of it).
   Arithmetic raises the candidate, the gate's protective relaxations apply, and the model is told it is the owner's
   standing instruction, so waiting needs a reason. Free-text notes stay context for timing only.
5. **The mandate can be edited from a button with no model call**, one part at a time (strategy, targets, settings,
   notes, rules), through the same checks and the same card as the chat. SERV credit being empty must never lock an
   owner out of their own instructions.
6. **Every desk page resolves the viewer the same way**: the owner by session, by id or share slug, whether sharing
   is on or not; anyone else only through the share link while sharing is on. A visitor's page never carries the
   owner's notes, and its wording never addresses the reader as the owner.
7. **Boundary times are written in the reader's own zone with New York beside them**, as Agari does ("Mon 14:30
   (09:30 ET)"). History rows rendered on the server stay in New York time, labelled.
8. **An approval that was answered but never carried out expires at its stated time**, and the record says so; a
   worker that comes back a day later does not trade on a day-old yes.
9. **A second consecutive loss-limit breach pauses the desk on-chain**, as decision 5 after the research promised and
   the code never did, through the ordinary sender with its own record.
10. **The header drops the market session chip** (Agari b4faecc): five items crowded the bar at 1024 wide, and the
    session already shows on Markets, the stock page, the marquee and the desk's next-check panel.

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

## The design reference

**Settled 2026-09-21, evening: the interface follows Masayume**, Abu's own app from the Somnia hackathon
(`/Users/abu/dev/hackathon/sommina-events`, masayume.app). It is ported from **Agari**
(`agari-wt/w1`), which had already moved Masayume onto US stocks.

How it got here, the same day:
- Abu rejected a survey of eight products (`research/ux/`).
- He chose Glider, which was fully researched (`research/glider/`).
- He then preferred Masayume: he has used it, enjoys its feel, and it is his code.

Claude agreed. Masayume's strategy studio already reads like the desk: *"set the limits before it can trade.
Hard limits still decide what it may trade."* Its charts draw a reference line, which is what our price gap
needs. It is on our exact stack, and the dark design suits a product named for deep night.

**What does not come across: anything that is a bet.** Abu: "not a betting place, not a trading place." That
removes calls, tickets, odds, leverage, games, leaderboards and trading from X. Referrals, points and rewards
are also out. Withdraw always exists. An AI you can chat with is in, built from Masayume's Sensei dock.

**Fonts are Masayume's:** Sora, Inter, JetBrains Mono, and Noto Serif JP for しじま. This replaces the Inter
Tight pick from the Glider pass.

`docs/FIDELITY.md` holds the full contract.

**Settled at plan approval, 21 Sep** (`/Users/abu/.claude/plans/typed-enchanting-simon.md`):
- **Chat-first:** the owner lands on their desk, chat first.
- **The chat's model calls run in the worker through Postgres**, so the web stays keyless.
- **Masayume's session key goes into Desk v1**, scoped to withdraw (to the owner only), pause, remove the
  assistant, lower limits, capped sells, and a batch of those.
- **Check now and do it anyway:** do it anyway runs on a second confirmation and is recorded as the owner's call.
- **Price history:** a logger writes `price_points` for the talking charts.
- **Vault sweeps** make idle cash actually earn.
- **Extras kept:** share cards, price alerts, Rooms, Reels, Takes. **Dropped:** AgentKit, the pitch folio.
- **Commits** are allowed as slices land. The weekend worker runs from a tagged commit.

**Step 11, 22 Sep. Calls Claude made building How it works and Status (Abu may overrule):**
- **The worker gets a heartbeat row, and Status also looks for its lock.** The lock alone says a process is alive, not
  that its loop turns; the row alone cannot tell a crash from a long check. Together they can. One additive table.
- **Stats (L-15) are four counts on Status, not a page of their own.** Desks running, checks, records, fingerprints on
  the chain. A separate page would repeat them.
- **With and without reasoning is asked ahead of time and saved with the site.** The website holds no key, a visitor
  should see the same answers as a judge, and a model call per visit costs money. "A plain model" is the same model
  through SERV with SERV's reasoning layer switched off (`x-openserv-disable-braid`), so the only difference is SERV.
  A call that gets no answer never replaces a saved one; the page says "Not run yet" instead.
- **A holding's status is shown only from a price-log row under an hour old.** An older row would be a guess.
- **Resuming after a loss stop restarts the limit from the latest valuation.** Otherwise the desk stops again at the
  next check, which is what the code did before this fix.
- **The escape hatch page names Blockscout's "Write proxy".** That tab needs the implementation verified on Blockscout,
  which Sourcify did not give us. Verifying v1 there is part of its deploy.

---

## Still open

| Question | Status |
|---|---|
| How the owner's account is built | **Settled.** Custom contract, decision 1 above. |
| Whether OpenServ cron survives our process being down | Tested Sunday. It no longer matters much: our own timer catches any missed check. |
| Whether Telegram messages can be edited | **Settled.** Our own bot, so yes. |
| SERV tool calls with `reasoning_effort` | Tested Sunday with one call. |
| Where the news comes from | **Settled.** Finnhub, with Tavily as fallback. Weekend coverage tested Sunday. |
| How much real money goes in | **Settled 2026-09-22 by Abu: about $5.** The dev desk's funds (5.21 USDG and a little NVDA) cover all development, the v1 move and the demo. No $50 demo desk; the rules and caps are sized to $5. Abu's go also covers the v1 deploy's gas. |
| Does a build with no MCP qualify for the "Mainnet & MCP" track | **Settled 2026-09-21: yes.** The track is for agents that act on Robinhood Chain *or* use Robinhood MCP. We also fit the Open track. `research/2026-09-21-tracks.md`. |
| The product's name | **Settled 2026-09-21: Shijima (しじま).** Abu chose it. Reasoning below. |

## 2026-09-23 · UX overhaul decisions

- **Motion is in.** `motion` 12.43.0, the version Agari runs. FIDELITY §3 skipped it; Abu asked for animation. Used
  for meaning only (steps, counters, stagger, the chart drawing in) and every use honours reduced motion.
- **Basket names are plain words.** Labels changed, ids kept, so stored mandates are untouched.
- **Token looks live in `packages/shared`, not in the chain's token list.** Presentation is not chain data.
- **Telegram stays linked per desk.** An account-level link would break approvals and the outbox for no gain with
  one owner and one desk (reviewed against `bot.ts:112`, `outbox.ts`).
- **The desk chart is our own SVG after 21st's Portfolio Chart**, not lightweight-charts, whose logo it carried.
  The markets page keeps lightweight-charts.
- **A moved desk shows its past.** The chart prepends the earlier contract's value history and the record folds its
  decisions, linking to that contract's page on the explorer. Decision pages stay per contract.

## 2026-09-23 · After the walkthrough: the agent, the home page, the decision page

Made by Claude after the whole-product audit (`WHAT-IS-MISSING.md`) and the code walkthrough (`CODEBASE-WALKTHROUGH.md`).
Abu can overrule any of these.

- **Agari's own port of Shijima is the reference for desk screens.** Abu said the Agari agent "did better". Its
  desk kit, decision page and landing (`agari-wt/w1`, S21 and S22) are ported, not redesigned.
- **The user meets an AI agent, not a "desk".** The desk page leads with Shijima's card (what it is doing now, last
  and next look, decisions, the latest one, Telegram), the chat speaks as it, and the phone tabs are Agent and
  Portfolio. "Desk" stays the account's name and the code's.
- **`/` has a home page again for visitors,** reversing FIDELITY L-11. It shows a live agent at work (the shared
  showcase desk), the five steps with the money first, "$100 on duty" in dollars, the week in hours, the
  strategies, the five promises with the worst case, and proof you can open. Owners still land on their desk.
- **The decision page is pictures first:** a verdict card with a "how sure" ring, the drift against its band, the
  price line with the in-line zone, the options as cards, the limits as a checklist, the cost as a flow, proof as
  three steps. Every sentence it had before is still there.
- **The site installs as an app** (manifest and icons). No native build; the Telegram Mini App waits for a domain.

## 2026-09-23 · The token rescan and the 20 strategies

Made by Claude while building step 7 of `PLAN-ROUND-3.md`. Abu can overrule any of these.

- **The rescan of 23 Sep passed 15 tokens, not 18.** In: SPY, QQQ, NVDA, AAPL, MSFT, GOOGL, AMZN, TSLA, SGOV, MU,
  SPCX, CRCL, USO, SLV and GME (new, $319k pool, 0.11% round trip). Out: INTC (0.84% round trip), BABA ($56k pool),
  PLTR ($89k pool) and META ($95k pool). Evidence: `packages/chain/tokens.scan.json`.
- **A listed token is never dropped, and a pin never moves while its pool passes.** META stays on the list with a
  `watch` note, because desks read balances only for listed tokens and would lose sight of a real holding. SGOV
  keeps its 0.3% pool, though the 0.05% one now passes too: the gate refuses a trade whose on-chain pin differs
  (POOL_MISMATCH), so moving it would stop every desk trading SGOV. The list is 16 tokens, Desk.sol's limit.
- **No strategy uses a token on watch.** So Meta leaves Big tech, The companies building AI and the 7 giants, which
  becomes "The giants". The ids stay. China tech had only Alibaba, so "Crowd favourites" (GameStop, Tesla) takes its
  place. Chips is Nvidia and Micron, Space and frontier is SpaceX and Tesla, AI software is Microsoft and Alphabet,
  Consumer giants is Amazon and Apple.
- **"Momentum names" is "Where the trading is":** the three single companies with over $1M of USDG in their pools on
  23 Sep (Nvidia, SpaceX, Circle). A rule anyone can check, and no claim about past returns.
- **A one-fund strategy holds 90%,** so choosing it raises the largest holding allowed to fit (never lowers it).
- **`pnpm strategies:verify` is the gate.** It fails on a feed past its 24h heartbeat in market time, a pinned pool
  under $100k or 30 observations, or a round trip at $1,000 over 0.75%.

## 2026-09-23 · Round 3: agents you can copy, a free $1, and a sidebar app

Made by Claude on Abu's delegation (`docs/PLAN-ROUND-3.md`, approved 23 Sep). They close every question the Codex
handoff (`docs/2026-09-23-product-fidelity-handoff.md` §10) left open. Abu can overrule any of these.

- **D1. It is an Agent, everywhere a person reads.** Routes are `/agents` and `/agents/[slug]`; `/desk/*`, `/desks`
  and `/start` redirect, so every link ever shared still lands. `Desk` stays the contract's and the code's name.
  "DEX" only ever means the Uniswap pool. About 420 lines of copy were rewritten; the timing prompts and the
  OpenServ workflow's name keep "desk" because they are hashed into records or used to find the workflow.
- **D2. Two shells.** The website (`/`, `/how-it-works`, `/docs`) keeps its top header and is always reachable,
  signed in or not ("Open app →"). Everything else is the app, with a sidebar (21st Animated Sidebar 29334): the
  wallet and its gas, Overview, Needs you, Activity, the owner's agents like channels, Discover (Markets first),
  Settings, the free $1, and the live-network badge. Ask Shijima opens from any page (⌘J).
- **D3. The free $1: "start with 20 USDG".** 20 people each get $1 USDG and 0.00008 ETH (about 30¢ of gas: enough
  to create, fund and later withdraw), once per wallet, once per connection a day, from a gift wallet the worker
  holds (`GIFT_ADDRESS` 0x5eD6613607AB34762fdEEFfdd2E86c297D00dE60). The web only queues; a write-ahead journal
  means a retry never pays twice. The funding minimum is $1 and the engine's smallest trade $0.20: the 5¢ of gas on
  a 20¢ trade is Shijima's cost, not the owner's.
- **D4. Copying means copying trades.** The follower gets their own agent (their own contract, their own money).
  When the leader acts, the follower makes the same move as a share of its own value, through its own limits, gate
  and mode, with its own record ("Copied from …") and its own transaction. A move it cannot make is recorded as a
  missed copy. No contract change: one operator already runs every agent inside its own caps. A pause stops future
  copies, and moves made during a pause are never copied late.
- **D5. Free trading, a fee for creators.** Shijima charges nothing on trading or on money held. A creator may set
  a one-time copy fee of $0 to $5, shown before signing, paid from the follower's wallet when they start. The
  server links the copy only after it finds the transfers on chain.
- **D6. Twenty strategies** from the tokens that pass the liquidity rule (see the rescan entry above), checked by
  `pnpm strategies:verify`. `/strategies` is the catalog; the studio lives at `/agents/new`.
- **D7. Mainnet, plainly.** It is the only network. Practice is an explicit mode, never dressed as live.
- **D8. OpenServ, honestly.** There is no "Sign in with OpenServ" for other apps (checked in the SDK, the docs, the
  platform bundle and GitHub). So: add Shijima on OpenServ, link a workspace with a one-time code (the card turns
  into the workspace's name), optionally send every decision to a workspace webhook, and let a linked workspace's
  agents ask for a look now, inside the limits. Decisions record the workspace, task and execution that asked.
  Trades are signed through Coinbase AgentKit's wallet provider, for the AgentKit track.
- **D9. "Live on mainnet," with proof.** A LIVE badge with the block read in the reader's browser, linking to
  `/live`: counts from the record, the latest transactions on Blockscout, revenue and the contracts.
- **D10. Revenue with no token.** Shijima keeps 20% of each copy fee; the creator gets 80%. `/live` shows both.
- **The look (Abu, mid-build):** Robinhood's Robin Neon (#CCFF00) on black replaces the vermilion, with near-black
  text on it; the light theme uses a deep Robinhood green. A new mark: a crescent moon for the night, a still line,
  and one neon point, the agent awake while the market sleeps.

## 2026-09-23 · Abu's feedback of 23 Sep, decided

Made by Claude after Abu said "run what I raised" (agenda: `docs/ABU-FEEDBACK-2026-09-23.md`). Abu can overrule any.

- **F1. What is live on chain is a product fact.** The landing page says it near the top and the Overview says it
  too: the agent factory (Robinhood Chain, deployed 20 Sep, upgraded 22 Sep), the agent account (one contract per
  person, the live showcase as the example), the OpenServ agent and its ERC-8004 identity on Base. Each links out.
- **F2. No "dev" and no practice on show.** The showcase agent runs live, on its own, with real money. The landing
  hero loses its "try it in practice" line. Practice stays as a mode an owner can choose, never the showcase.
  With the ~$5 we have: $2 USDG and gas go to the gift wallet (so the free $1 runs for 2 people, `GIFT_CAP=2`, and
  the card says how many are left, not "20"); the rest stays in the showcase agent. The operator's ~0.00047 ETH
  pays for dozens of trades, so it needs nothing now.
- **F3. The agent's wallet moves up.** Where to send money is the first thing an owner looks for, so the address
  and a QR (on demand, not always open) sit at the top of the agent page, not at the bottom of the side column.
- **F4. Settings holds settings.** No theme toggle (the header has it) and no explanatory paragraphs. Sections:
  Connections (Telegram, OpenServ), Wallet and gas, Agents and who can act for them, the disclosure.
- **F5. No Safe per agent.** Each agent is already its own contract account where only the owner can withdraw; a
  Safe per agent would add a second account and a signing ceremony the agent cannot do alone. Checked 23 Sep: Safe
  1.4.1 (SafeL2 `0x29fc…C762`, factory `0x4e1D…ec67`) is deployed on Robinhood Chain and Safe{Wallet} lists chain
  4663, so the useful link is a **Safe as the owner**. Desk.sol has no ownership transfer, so that only works when
  an agent is created from a Safe, and sign-in would need EIP-1271. Not in this round.
- **F6. Telegram before an agent.** You connect Telegram to your wallet, not to one agent. You can do it before
  creating one; every agent you have, and every agent you create later, reports to the same chat.
- **F7. One idea on the landing page:** your own AI agent keeps your stock basket on plan while New York is
  closed, and it can trade but can never take your money out.
- **F8. `/` for an owner opens their agent.** *(Superseded by W1, round 4.)* Signed in with an open agent, `/` goes to the newest one; everyone
  else gets the landing page, which stays reachable at `/home` from the app.
- **F9. The proof section** is rebuilt around the on-chain facts in F1 and the OpenServ agent, not a list of IDs.

## 2026-09-23 · Round 4: the wallet, taken from Abu's own wallet app

Abu asked for Shijima to feel like his wallet project ZK Freighter (`Blockchain-Oracle/zk-freighter` @ `859d95f`):
copy its code, keep only Shijima's light and dark colours. Plan: `docs/PLAN-ROUND-4.md`. Ledger:
`docs/FIDELITY-REFERENCE.md`. Code never carries the reference's name.

- **W1. The wallet is home.** Signed in, `/` opens `/wallet`; `/overview` redirects there. Supersedes F8: Abu asked
  to see his wallet and everything in it first. Signed out, `/` is the landing page.
- **W2. The reference's nav order:** Wallet · Activity (with the Needs-you count) · Send · Receive · Fund · Withdraw
  · Bridge · Evidence, then Your agents, Discover (Agents, Markets, Strategies, Reels, Live) and Settings.
- **W3. The balance card** has three parts: all your agents' money, a strip with Fund, Withdraw and Bridge, and your
  own wallet with every token priced and a total. On a phone it is a swipe rail with two dots.
- **W4. Fund takes any token.** USDG goes straight in; ETH and Stock Tokens the agent does not trade are swapped to
  USDG on Uniswap on the way in; a Stock Token it trades goes in as it is; other chains arrive through Relay; any
  wallet can pay the agent's address from its QR. $1 minimum.
- **W5. Withdraw is a screen:** cash (some or all), one stock (as it is or sold), or everything (as cash or as it
  is). It always pays the owner's wallet, because the contract pays nobody else.
- **W6. Send, Receive, Scan, Bridge.** Send moves USDG, ETH or a Stock Token from your wallet, refuses token
  contracts, and points your own agents to Fund. Scan reads an address QR on the device. Bridge takes USDG out to
  your same wallet on Base, Arbitrum, Ethereum or BNB, and Get gas swaps $1 of USDG to ETH or brings ETH over Relay.
- **W7. Evidence is a page:** every on-chain decision and money move with its fingerprint, and a checker.
- **W8. Colours stay ours; everything else follows the reference:** Hanken Grotesk and IBM Plex Mono, its radii,
  shadows, sheen, hatch and route animation. The canvas glows are green.
- **W9. One app on phones.** No "use the phone app" wall; below 768px the reference's phone chrome: header, four
  tabs (Wallet, Agents, Fund, More), sheets that drag closed, pull to refresh.
- **W10. Settings are the reference's groups** in two columns, with Verify it yourself, Real money on mainnet and
  Disconnect on the right. No theme row.
- **W11. Our extras stay:** Ask Shijima (⌘J), the bell, the market clock, the LIVE block line, Runs on OpenServ. The
  grain and custom cursor go; the reference has neither.
- **W12. The landing follows the reference's order,** with our copy: "Give your stocks an AI agent. It trades. You
  own it." Motto: "Shijima · AI agents for Robinhood Chain stocks".
- **W13. Creating an agent keeps its own bridge step.** Its money step runs before the agent is recorded, and the
  Fund screen needs a recorded agent, so the studio's Relay step stays. Every other money path uses the new screens.

## 2026-09-23 · Round 5: Abu's feedback on the money screens

- **R1. Money screens use the whole width.** Send, Fund, Withdraw and Bridge are two panels: the ticket on the left
  (what you pay, an arrow, what arrives, after 21st's Multi-chain Swap 16251), the live summary and Review on the
  right. Never a narrow centred column. Stacks on phones.
- **R2. A live quote as you type.** The same planner Review uses prices the move half a second after typing stops,
  and every 30 seconds after; nothing is saved until Review.
- **R3. Real logos.** USDG, ETH, USDC, USDT, BNB, WETH and DAI, and the five chains, wear their published logos,
  vendored from Relay into `public/logos`. Pickers offer only tokens we have a logo for.
- **R4. Receive is a sheet, not a page.** It opens from Receive or the wallet card's QR; `/receive` redirects to
  `/wallet?receive=…`. Get gas is a Bridge tab.
- **R5. First run.** Five steps with the reference's intro and chime for anyone with no agent: welcome, how it
  works, connect, the free $1, create. Reopened from Settings.

- **R6. `/` is the landing page for everyone.** Signed in or not. The app's home stays `/wallet`, and the landing's
  buttons open it. This replaces the redirect half of W1 (Abu: "I should be able to go to my landing page").
- **R7. The motto.** Hero: "Wall Street closes. Your agent doesn't." Motto: "Shijima · AI agents that trade Stock
  Tokens 24/7 on Robinhood Chain". Why:
  - Robinhood's own Agentic Trading already means "connect your AI model", so "an AI agent on Robinhood" alone is
    not ours.
  - Glider owns "on autopilot"; xStocks owns "no broker, no KYC, no borders".
  - What only Shijima says: Stock Tokens trade around the clock while New York is shut, and an agent keeps your
    basket on plan in those hours. The limits are held by a contract only you can withdraw from, and every
    decision is on chain. The name fits it too: しじま is the stillness of night.
  - No "first" claim, because none can be proven.
  Sources: Robinhood newsroom (Robinhood Chain mainnet, Stock Tokens, Agentic Trading, 1 July 2026); Glider
  (glider.fi, "Crypto assets, on autopilot"); xStocks (xstocks.fi).

## R8 · 25 Sep · Going live is the owner's call, at any time

New agents start **live (on its own)** unless the owner picks Practice when creating one, and any mode can be
chosen at any time. The earlier rule (24 practice checks and the practice report opened before going live) is
removed from `setDeskMode` and from the proposal checks. Why: Abu created an agent with $1 and it only ever said
"Would have acted", with no way to switch. The limits that protect money (per trade, per day, loss stop, only the
owner withdraws) are enforced by the account on chain in every mode, so the wait added friction, not safety.
