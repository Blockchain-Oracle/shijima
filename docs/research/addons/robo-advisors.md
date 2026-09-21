# Add-ons shipped by investing products (Robinhood Agentic/Cortex, Wealthfront, Betterment, Composer, Public, eToro)

Research pass 2026-09-19. Official sites, help centers and App Store listings only.

## THE KEY FINDING

**No product ships a per-trade explanation written by the AI.** The closest anyone gets:
- Public's activity feed adds context lines when a condition was checked and did NOT trigger.
- Robinhood lets the agent preview what it is about to do before executing.
- Composer's AI explains a strategy's logic, but not individual trades.
- eToro explicitly states the opposite: "no pre-approval request or notice is sent to you before those
  trades are executed."

So "every action carries a plain-language reason, the alternatives it rejected, and its confidence"
is genuinely unclaimed territory in live products, not just in hackathon projects.

## Second-order findings worth stealing

1. **Robinhood's dedicated agentic account** is the cleanest safety idea in the whole set: the agent
   "only has access to the funds you deposit into that account". One-tap disconnect. Scope limits
   (long only, no margin, no transfers, no staking, no lending).
2. **Public logs non-actions.** The activity feed is "a running log of everything your Agent evaluates
   and acts on", including conditions checked that did not fire. A desk that shows why it did nothing
   is more trustworthy than one that only speaks when it trades.
3. **Public requires explicit sign-off before an agent runs at all**, and the AI asks clarifying
   questions for missing parameters (account, size, timing) before activation.
4. **Betterment's Tax Impact Preview** "pre-plays" an action and shows the estimated cost before you
   confirm. The generalisable pattern: show the consequence before the confirmation.
5. **Paper mode is standard.** Composer gives a strategy a simulated $1,000 via "Watch"; eToro gives a
   $100k virtual portfolio that CopyTrader works inside. Robinhood Agentic has NO paper mode, which is
   a known complaint.
6. **eToro's Copy Stop Loss** is a strategy-level drawdown stop the user sets at 5-95%, and stopping
   offers "Sell All" vs "Keep All".
7. **Composer's "skip next rebalance"** is a tiny, humane control.
8. **Sharing is a link, not a feed.** Composer's share link lets anyone see the strategy logic and
   import it. Public's Generated Assets hub lets others invest alongside you.

## Per-product detail

### Robinhood Agentic Trading + Cortex
- Push notification on every agent trade. Real-time activity feed and P&L in-app. Realized P&L over a
  custom window, trade-by-trade history.
- Cortex Digests (Gold, $5/mo): market backdrop, return drivers, top movers, upcoming events. Asset
  Digests explain why something is moving. Robinhood Strategies delivers insights in writing AND as an
  audio recording.
- Cortex Assistant: text or voice, reads holdings, creates watchlists and alerts, initiates ACH,
  pre-fills order tickets. "No transaction will be executed without your explicit confirmation."
  One order per conversation. Gold + iOS at launch.
- Cortex Custom Scans and Custom Indicators built from plain English.
- Dedicated Agentic account, funded deliberately. Disconnect any time with one tap. Approval mode is
  the user's choice. Long equities/options/crypto only, no margin, no transfers/staking/lending.
- Support can audit "what you asked the agent to do" vs "what it actually did".
- Bring-your-own-agent list: Claude Code, Claude Desktop, ChatGPT, Codex, Cursor, Grok. Desktop-only
  setup. No backtest, no paper mode.
- Sources: robinhood.com/us/en/newsroom/robinhood-is-now-open-to-agents/ ,
  /support/articles/agentic-trading-overview/ , /support/articles/trading-with-your-agent/ ,
  /support/articles/cortex-digests/ , cortex_assistant_disclosure.pdf

### Wealthfront (0.25%/yr, $500 min)
- No trade or rebalance notifications found at all.
- Harvested tax-loss tally across accounts; estimated TLH benefit; Path retirement projections;
  monthly statements; Quicken QFX and TurboTax export.
- Allocation-change confirmation explains the tax-optimized transition; "Transition sooner" warns you
  may incur more taxes.
- Controls: TLH toggle, risk score slider, swap/reweight ETFs, tax level. Path what-if simulation.
- Risk questionnaire produces a score 0.5-10 and a recommended portfolio; retake any time.
- No conversational assistant despite marketing an "AI advice engine".

### Betterment (0.25%/yr or $5/mo under $24k; Premium 0.65%)
- Email when the account is rebalanced. Push notifications exist.
- Monthly PDF statements. Time-weighted AND money-weighted (IRR) returns. Goal forecaster with
  On-Track / Off-Track status and three concrete remedies when off track.
- Tax Impact Preview pre-plays withdrawals and allocation changes with estimated tax.
- Automatic changes labelled in Activity as "Automatic Allocation Change". Rebalancing rules published
  (cash-flow rebalancing; drift over 3% triggers sells).
- Goal-type onboarding with horizon-based allocation. Recurring deposits can be skipped up to 4 months
  ahead. No minimum balance. No AI chat for investing.

### Composer ($0 / $10 / $32 per month by number of strategies)
- Alerts when trades execute. Notifies you if a circuit breaker delays trades.
- TWR, CAGR, Sharpe, max drawdown, std dev per strategy (added 2026-06-22). Historical allocation
  graph. Backtest vs benchmark with adjustable slippage.
- Strategy logic is a visible no-code tree; Discover AI explains what logic each strategy follows.
- Pause, edit or liquidate any time. Threshold trading (only rebalance past a drift threshold) framed
  as risk control. Skip next rebalance. Manual overrides and priority timing on Pro.
- Paper trading via "Watch" with a simulated $1,000. Create strategies from plain English.
- Share link exposes the logic and lets others import it. 2000+ community strategies. Start with $50.
- Trades are "not held" orders; the user gets no per-trade price or time control.

### Public (Alpha, AI Agents, Generated Assets)
- Price alerts at >4.5% stocks / >5% crypto, custom thresholds on Premium. Agents can be told to alert
  you to step in manually instead of acting.
- **Activity Feed logs everything the agent evaluates, including conditions that did not trigger.**
  Per-agent transaction ledger, expandable to full order details.
- AI earnings-call summaries the moment calls end, 12 quarters of history. "Why is it moving" on the
  chart. Alpha answers questions about any stock and about your portfolio.
- Every agent requires explicit sign-off before running. The AI asks for missing parameters first.
  Full workflow review screen pre-activation: "every condition, every action, every parameter".
- Pause, edit, or shut down entirely. Boundaries written in the prompt ("Invest exactly $5,000",
  "Stop out if AAPL drops more than 10%", "up to 1% of portfolio").
- **Deterministic by design: "runs that plan the same way every time. It doesn't improvise."**
- Marketplace of ready-made agents in five categories plus prompt templates and a prompting guide.
- Generated Assets: 0.49%/yr, $1,000 min, backtest vs S&P 500, shareable so others invest alongside.
- Web only, waitlist rollout.

### eToro CopyTrader + Smart Portfolios (no fee to copy)
- In-app notification when a reallocation completes; prompt to add funds when the copied trader
  deposits; notification when someone starts copying you.
- Stats per investor: return, 7-day and 12-month risk score, max drawdown daily/weekly/all-time,
  dividend estimate, copier count and AUC over 12 months. On-demand statement PDF or Excel for any
  date range.
- **No per-trade notice by design**: "no pre-approval request or notice is sent to you before those
  trades are executed."
- Copy Stop Loss 5-95% on the whole copy. Pause Copy stops new positions only. Stop copying with
  "Sell All" or "Keep All". "Copy Open Trades" checkbox. $200 min per copy, 100 traders max.
- Copyable investors are capped by risk score, drawdown and a 50% single-position rule.
- $100k virtual portfolio at signup; CopyTrader works inside it.
- Popular Investors are paid 1.5% of assets under copy and must post a monthly update of at least 100
  words to copiers. Public/private profile toggle.

## Merged add-on list (46 distinct items)

Notifications: per-trade push/email; rebalance email; price threshold alerts with custom thresholds;
"alert me instead of acting" mode; circuit-breaker delay notice; notice when someone copies you.

Safety: dedicated sandboxed account; capital cap in the rule; approval mode toggle; clarifying
questions before activation; full workflow review pre-launch; one-tap disconnect/pause; sell-all vs
keep-all on exit; skip next rebalance; strategy-level stop loss; scope limits (no margin/transfers);
risk-score caps on what can be copied; warning labels on risky instruments.

Transparency: activity feed that logs non-actions; per-agent ledger with expandable orders; realized
P&L over custom windows; TWR/IRR/CAGR/Sharpe/max drawdown; pre-trade tax impact preview; automated
actions labelled in the log; published rebalancing rules; human-auditable "asked vs did"; deterministic
execution promise.

Intelligence: AI digest of why the portfolio moved plus upcoming events; per-asset "why is it moving";
earnings-call summaries; AI explains strategy logic; AI-built scans and indicators; audio portfolio
updates.

Simulation: backtest vs benchmark; paper trading with simulated capital; virtual portfolio; what-if
goal planning; on-track/off-track with remedies.

Onboarding: risk questionnaire to preset; goal-type onboarding; marketplace of ready-made
agents/strategies; prompt templates plus prompting guide; low minimums ($50 Composer, $200 eToro copy).

Conversation: assistant that reads the portfolio and pre-fills orders; research-only Q&A; build and
edit strategies by chat; voice input.

Social: share-by-link exposing logic for import; public profile with stats and copier count; payment
for being copied; creator update posts; public/private toggle; numeric risk score on everything.

Records: monthly PDF statements; on-demand statement any date range as PDF/Excel; Quicken/TurboTax/
TaxAct/CSV export; tax-loss harvest tally; API access as a paid perk.

Pricing patterns: tiers by number of automated strategies (Composer $0/$10/$32); premium subscription
gating AI features (Robinhood Gold $5/mo, Public Premium $8-10/mo); AUM fee (0.25% Wealthfront and
Betterment, 0.49% Public Generated Assets); flat monthly for small balances (Betterment $5); free with
spreads (eToro).

## Gaps in this pass
Betterment's communication-settings page and several eToro help pages did not render (JavaScript), so
their per-event notification menus are unverified.
