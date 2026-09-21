# Add-ons shipped by live on-chain money agents

Research pass 2026-09-19. Olas Pearl, Giza, Mamo, Almanak, Bankr, HeyAnon, Wayfinder.
Their own sites, docs, help centers and official blogs only.
Caveat: arma.xyz refused connections; Giza's Feb 2026 post says the Giza Agent replaced ARMA, so Giza
is covered from docs.gizatech.xyz.

## CORRECTION TO EARLIER CLAIMS IN THIS PROJECT

Two earlier passes concluded that no live product explains *why* it acted. **That is wrong, and this
pass disproves it.** Three of these seven ship reasoning:

- **Giza "Giza Thoughts"** shows "the agent's reasoning -- which protocols it looked at, what it decided,
  and why it moved funds", and invites you to "inspect what changed, when it happened, and why the
  decision was made". (docs.gizatech.xyz/app-guide/dashboard , gizatech.xyz)
- **Wayfinder** puts reasoning inline in replies, e.g. "Short 0.4 BTC on HL Perps (funding +0.008%/h)
  against your spot. Net exposure flat, ~$19/day". (wayfinder.ai)
- **Almanak** streams execution logs showing "what the agent is doing at each interval", filterable by
  severity with keyword search. (platform.docs.almanak.co/deploy.html)
- **Mamo** claims "Every action is explained in human terms" and its chat covers "understanding why
  something changed". (docs.mamo.bot/mamo/the-mamo-difference , help.mamo.bot)

So "the agent explains itself" is table stakes among serious on-chain agents, not a differentiator.
What remains genuinely rare is a *structured, kept* record: the alternatives considered and rejected,
a confidence level, and the rationale tied to the specific transaction so it can be checked later.
Giza comes closest. Nobody commits it anywhere durable.

## COMPETITIVE FACTS THAT MATTER

1. **Olas Pearl shipped Robinhood Chain support on 17 September 2026, two days ago.**
   "Download Pearl, add a Connect agent, pick Robinhood Chain, and fund the wallet", under five
   minutes, stock tokens traded via a Uniswap skill, memecoins too.
   (olas.network/blog/connect-robin-hood) This is a funded team live on our exact chain, right now.
2. **Wayfinder ships a "Robinhood Chain Launch Sniper" path** that alerts in console, email and
   terminal. (wayfinder.ai/paths)
3. Pearl's Connect model is notable: a coding agent prepares the transaction, Pearl signs it, keys stay
   encrypted on the user's machine, and "You set which protocols your agent can reach".

## THE BEST PATTERNS IN THIS SET

**Bankr has the most complete safety model of any product we surveyed** (docs.bankr.bot/security/bankr-terminal):
- Daily spending limit, default $500 per 24 hours
- Per-transaction limit, default $500
- Permitted-recipients allowlist with a cooldown before a new address is usable
- "Pause all transactions"
- Price-impact protection
- A toggle for arbitrary contract calls
- Per-device session logout
- Optional 10-minute to 24-hour timers that **revert settings to safer defaults automatically**
- Screening for malicious contracts, phishing and prompt injection
- Keys are non-exportable

**Mamo has the best reporting cadence idea**: an earnings report telling you "exactly how much your
money earned and how many times it compounded over a given period", with the cadence set by the user to
daily, weekly, monthly, or off. Delivered in-app, as push on phone and desktop, and synced to Telegram.
Its Notifications tab offers "deposit or dismiss" directly on a rate change or a new asset.

**Wayfinder has the best proactive-contact design**: the agent texts you when a market moves, with
check-in frequency from 15 minutes to 24 hours, a choice of "Observe" or "Observe + Act", **quiet
hours**, and topic filters. Scheduled jobs email Markdown with explorer links, capped at 12 per day.

**HeyAnon's "Plan Flow"** shows a step-by-step preview of every planned action before it runs.

**Giza's simulator** lets you set constraints (protocol exclusions, concentration limits,
diversification preferences) and shows exactly how the optimizer would allocate your capital, before
depositing.

**Pearl's one-click "close all open positions"** is the emergency exit done right.

**Giza's fee model is the cleanest in the set**: 10% of yield earned, deducted at withdrawal, with
deposits, withdrawals and rebalances free and the agent covering gas. The dashboard shows "Net earned
-- Your profit after the 10% fee" and a Net APR after fees.

## Per-product notes

**Olas Pearl.** No notifications found at all. Per-agent trade and performance history; history entries
"labeled in plain language and show the amount that moved". Turn agents on and off anytime; Co-Pilot
Mode takes goals in plain English while Autonomous Mode executes. Self-custodial Safe running on your
own device, recovery via Google or Apple backup, a backup wallet, or a phrase. Onboarding is four steps
with card funding and Google/Apple sign-in. Risk presets are "risky" or "balanced", switchable by
telling the agent in plain language. Public proof is unusually honest: blog posts report weekly ROI
around 0.33% and that "3 out of 10 Polystrat agents were profitable this month". No subscription; you
stake OLAS to run an agent and can be evicted for missing activity targets. Connect services are
per-request on-chain micropayments with "no monthly fees".

**Giza.** No notifications found. Dashboard with a performance chart, Yield Projection (Native APR,
Giza APR, Annual Projection), current value, net earned after fee, and a markets allocation table with
live APR. Withdraw button does partial or full deactivation and "the agent exits all positions and
sends your funds back". Onboarding is connect, pick chain, Auto or Custom, deposit from about $1,
review projected annual earnings, confirm. Chat happens through Claude Desktop, Claude Code or
Openclaw. Institutional tier adds session keys with value limits, allowed functions, expiry and a
pre-signed emergency exit. No pause found.

**Mamo.** Everything above, plus: add, pause or withdraw at any time; "withdraw anytime, instantly,
even if Mamo is offline"; every deposit, withdrawal or strategy change requires the user's signature;
upgrades need explicit approval; conversions pause on price deviation. Certora and Halborn audits with
a $250K Sherlock bounty. Activity tab lists deposits, compounding events and withdrawals with icon,
timestamp and exact amount. "Mamo does not charge hidden platform fees. There are no surprise charges,
subscriptions, or extra costs" -- revenue comes from Aerodrome trading fees shared with depositors.
A Telegram bot exists at @MamoAIbot.

**Almanak.** Deployments dashboard with status and 24h PnL per agent, value charts, total return since
deployment. Streaming execution logs. Signals carry an alpha score, confidence and risk context. Safe
smart account plus Zodiac Roles whitelisting specific functions and parameters, with "approved
contracts, actions, and spending limits... Revoke access at any time". Paused and Stopped states.
"Backtest and paper-trade against live mainnet forks before a single dollar moves." Strategy Library
with community strategies and version history. A conversational coding agent builds strategies.
Referral gives a free Pro month to both sides. Plans are Basic, Pro and Max by credits and deployment
count; dollar prices not published.

**Bankr.** Safety model above. Browser notifications plus a chime when the agent finishes. Webhooks can
trigger the agent from external events, for example scheduled portfolio summaries into Slack. Holdings
across chains with percentage composition and per-position P&L. Sign in with email, X, Farcaster or
Telegram and a wallet is created automatically. **Memory stores preferences and trading rules such as
"never confirm trades under $50" as editable files.** Reachable from a web terminal, X, Telegram,
Farcaster, mobile mini apps and a CLI with threads. Public Agent Profiles show live charts, weekly fee
revenue and an activity feed. Apps are shareable and forkable. Export of transaction history is
supported, which almost nobody else does. Free tier is 5 messages a day; Bankr Club is $20/month or
$198/year for 1,000 messages a day and 20 concurrent automations.

**HeyAnon.** Plan Flow preview. Triggers on time, price, PnL, DCA, gas, all-time high or low, funding
rate, trailing stop, liquidation price, or custom. Transfer allowlist. Revoke risky approvals. Login
with Telegram, passkey or a Web3 wallet across EVM, Solana and TON. Customisable widgets and saved
prompts. A HUD overlay sits on top of Binance, Hyperliquid and Axiom turning analysis into one-click
orders. Two agents: Anon executes, Gemma researches. Token holders get free or discounted access. No
history view or export found. A 10 bps fee on realised HUD profit appears only in a DAO forum RFC, not
in the docs.

**Wayfinder.** Proactive texting above. Trading PnL page with realised, unrealised and total PnL,
winrate, volume, trade count, ROI distribution, a daily calendar and per-venue filters across on-chain,
Polymarket and Hyperliquid. Confirmation required for fund-moving tools with a "human-readable preview
(recipient, chain, amounts)". Wallet-level permissions set at provisioning, time-limited signing
sessions, strategy wallets with capped risk, and Policy paths that "constrain or guide agent behavior".
Virtual testnet dry-runs and backtesting. 74 one-click community Paths. Chat supports /undo and /redo
plus history search. PnL share card as a PNG with ROI, winrate and trade count. Weekly USDC
leaderboard. Referral pays 20% to 50% revenue share weekly in USDC, and path creators earn tokens.
Free tier is limited to one model; Pro is needed for a persistent shell and jobs that run between
sessions.

## Merged add-on list (30 groups)

Notifications: push, browser, email, SMS and iMessage for transactions and events (Mamo, Bankr,
Wayfinder, Almanak); periodic earnings report with user-chosen cadence including off (Mamo);
agent-initiated check-ins on market moves with quiet hours and topic filters (Wayfinder); a chime when
the agent finishes (Bankr); actionable notifications with deposit-or-dismiss inline (Mamo).

Explanation: agent reasoning log (Giza, Wayfinder, Almanak); plain-language label on every history
entry (Pearl, Mamo); pre-execution plan preview and confirm (HeyAnon, Wayfinder, Mamo).

Safety: daily and per-transaction spending limits (Bankr, Almanak, Giza institutional); recipient
allowlist with cooldown (Bankr, HeyAnon); pause all (Bankr, Almanak, Mamo, Pearl); withdraw or
deactivate anytime with the agent exiting all positions (all seven); one-click close all positions
(Pearl); timers that revert to safer defaults (Bankr); function-level permissioning via Zodiac or
session keys (Almanak, Giza); price-impact protection (Bankr); prompt-injection screening (Bankr);
non-exportable keys (Bankr) versus exportable (HeyAnon).

Simulation: backtest, dry-run on mainnet forks, or an allocation simulator before depositing (Almanak,
Wayfinder, Giza).

Onboarding: risk presets (Pearl, Giza); goals and rules in plain English that persist (Pearl, Bankr,
Wayfinder); strategy or skill marketplace with one-click install (Wayfinder 74 paths, Almanak, Bankr);
card and fiat funding with social login (Pearl, Bankr, Mamo, Wayfinder); sponsored gas (Wayfinder);
minimum deposit about $1 (Giza).

Chat: messaging-channel access via Telegram, X, Farcaster, iMessage or SMS (Mamo, Bankr, Wayfinder);
in-app chat answering "why did this change" (Mamo, Wayfinder, Bankr); /undo and /redo (Wayfinder);
agent memory of user preferences as editable files (Bankr).

Social: share card or share to X (Pearl, Wayfinder PNG, Bankr); public aggregate track record (Olas
Explorer and blog, Giza Metrics, Bankr Agent Profiles); leaderboard with rewards (Wayfinder weekly
USDC, Bankr); referral programs (Wayfinder revenue share, Almanak free Pro month, HeyAnon code).

Records: plain-language activity history (six of seven); export of transaction history (Bankr only);
net-of-fee APR and earnings projection (Giza, Almanak, Wayfinder, Mamo); help center plus human support
chat (Mamo, Pearl, Bankr).

Rewards for running the agent: OLAS staking (Pearl), a 15% APR floor top-up on Base (Giza), weekly USDC
(Wayfinder), Mamo Drop (Mamo).

Pricing: performance fee only, 10% of yield at withdrawal (Giza); no fees, revenue from protocol
trading fees (Mamo); subscription tiers (Bankr $20/mo or $198/yr, Almanak, Wayfinder Pro); token stake
or holder access (Pearl, HeyAnon); pay-per-use (Bankr Max Mode, Pearl Connect micropayments).
