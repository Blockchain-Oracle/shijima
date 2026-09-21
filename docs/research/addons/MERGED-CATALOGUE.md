# Merged add-on catalogue

Every distinct add-on found across all four research passes, deduplicated into one list.
198 items in 12 groups. Supersedes the four separate files for decision-making; those keep the sources.

**Legend.** `Ships` names products that actually ship it (not marketing claims).
`Rare` marks something only one or two products do. `Ours` is the current scope call from
`docs/PRODUCT-SCOPE.md`: **IN** first version, **LATER**, **OUT**, or **n/a** if it does not apply to us.

Product keys: RH Robinhood Agentic/Cortex · WF Wealthfront · BT Betterment · CO Composer · PU Public ·
ET eToro · PE Olas Pearl · GZ Giza · MA Mamo · AL Almanak · BK Bankr · HA HeyAnon · WA Wayfinder ·
BB BasedBot · BG Banana Gun · MS Maestro · TJ Trojan · 3C 3Commas · PX Pionex · XS xStocks ·
ON Ondo · DN Dinari · R24 Robinhood 24 Hour Market

---

## A. Notifications and alerts

| # | Add-on | Ships | Ours |
|---|---|---|---|
| 1 | Push or browser notification per executed action | RH, CO, MA, BK, BT (email), ET | IN |
| 2 | Periodic earnings report, cadence chosen by user including "off" | MA only · **rare** | LATER |
| 3 | Agent-initiated check-in when a market moves, interval 15 min to 24 h | WA only · **rare** | LATER |
| 4 | Quiet hours | WA only · **rare** | LATER |
| 5 | "Observe" versus "Observe + Act" switch | WA · **rare** | IN (shadow mode) |
| 6 | Topic filters on what it contacts you about | WA · **rare** | LATER |
| 7 | Price or threshold alerts on holdings, custom thresholds on premium | PU, RH, BB, MS | LATER |
| 8 | "Alert me instead of acting" mode | PU, MS, WA | IN |
| 9 | Actionable notification with inline deposit or dismiss | MA · **rare** | IN (approve/reject) |
| 10 | Circuit-breaker or delay notice | CO · **rare** | IN (halt notice) |
| 11 | Alert when activity happens outside the product | 3C · **rare** | IN |
| 12 | Notice when someone copies you | ET | OUT |
| 13 | Wallet-tracker alerts with a Trade Now button, nickname and emoji per wallet | BB | OUT |
| 14 | New-launch or migration feed channels | TJ, BB | OUT |
| 15 | Email digest in Markdown with explorer links, capped per day | WA | LATER |
| 16 | SMS or iMessage channel | WA | OUT |
| 17 | Sound when the agent finishes | BK | OUT |
| 18 | Usage or credit warnings at 50% and 80% | AL | LATER |
| 19 | Failure messages naming the cause and the next step | BG, MS | **IN** |

## B. Reports and summaries

| # | Add-on | Ships | Ours |
|---|---|---|---|
| 20 | Real-time activity feed | RH, BK, PU | IN |
| 21 | Realized profit and loss over a custom window, plus per-trade | RH | IN |
| 22 | Performance metrics: time- and money-weighted return, CAGR, Sharpe, max drawdown | CO, BT, ET, WA | LATER |
| 23 | Winrate, volume, trade count, ROI distribution | WA | LATER |
| 24 | Daily profit-and-loss calendar | WA · **rare** | LATER |
| 25 | Filter performance by venue | WA | OUT |
| 26 | Net-of-fee APR and annual earnings projection | GZ, AL, WA, MA | IN |
| 27 | Allocation table with live rate per market | GZ | IN |
| 28 | Monthly PDF statements | BT, WF, CO | OUT |
| 29 | On-demand statement, any date range, PDF or Excel | ET · **rare** | LATER |
| 30 | Portfolio composition by percentage | BK | IN |
| 31 | Lifetime rewards and live performance chart | MA | LATER |
| 32 | Historical allocation graph over time | CO · **rare** | LATER |
| 33 | Goal projection with on-track status and concrete remedies | BT, WF | OUT |
| 34 | Tax-loss harvest tally | WF, BT | OUT |
| 35 | AI digest of why the portfolio moved plus upcoming events | RH, PU | LATER |
| 36 | Per-asset "why is it moving" | RH, PU | LATER |
| 37 | Earnings-call summaries | PU · **rare** | OUT |
| 38 | Audio version of the portfolio update | RH · **rare** | OUT |
| 39 | Public performance reporting that admits losses | PE · **rare** | LATER |
| 40 | Fee earnings dashboard | BK | LATER |

## C. Explaining what it did

| # | Add-on | Ships | Ours |
|---|---|---|---|
| 41 | Reasoning log: what it looked at, what it decided, why it moved funds | GZ, WA, AL | IN |
| 42 | Plain-language label on every history entry | PE, MA | IN |
| 43 | Every change explained in human terms | MA | IN |
| 44 | Step-by-step plan preview before it runs | HA, WA, RH, PU | IN |
| 45 | Pre-action consequence preview (cost or tax impact) | BT, WF | IN (itemised cost) |
| 46 | **Logging non-actions: conditions checked that did not fire** | PU only · **rare** | **IN** |
| 47 | AI explains a strategy's logic in plain language | CO | IN |
| 48 | Automated actions labelled distinctly in the log | BT | IN |
| 49 | Published rules for how and when it rebalances | BT | IN |
| 50 | Deterministic execution promise, "it doesn't improvise" | PU · **rare** | IN |
| 51 | Support can audit "what you asked" against "what it did" | RH · **rare** | IN |
| 52 | Signals carry an alpha score, confidence and risk context | AL | IN (confidence) |
| 53 | Safety verdict inside the trade panel | BG, MS, BB | IN (halt/stale) |
| 54 | Strategy logic visible as a tree or diagram | CO · **rare** | LATER |
| 55 | **Rejected alternatives kept with the decision** | nobody · **gap** | **IN** |
| 56 | **Rationale tied durably to the transaction so it can be checked later** | nobody · **gap** | **IN** |

## D. Safety and control

| # | Add-on | Ships | Ours |
|---|---|---|---|
| 57 | Dedicated account or wallet holding only deliberately-moved funds | RH · **rare** | **IN** |
| 58 | Daily spending limit | BK ($500/24h) · **rare** | **IN** |
| 59 | Per-action spending limit | BK, PU | **IN** |
| 60 | Recipient allowlist with a cooldown on new addresses | BK, HA | IN |
| 61 | Token or protocol allowlist, "you set what it can reach" | PE, AL, GZ | IN |
| 62 | Function-level permissions or session keys with value limits and expiry | AL, GZ, WA | IN |
| 63 | Timers that auto-revert settings to safer defaults | BK only · **rare** | LATER |
| 64 | Pause everything | BK, AL, MA, PE, CO, ET, TJ, BB | IN |
| 65 | One-tap disconnect or revoke | RH, PU, BK | IN |
| 66 | Withdraw or deactivate anytime, agent exits all positions | all seven on-chain agents | IN |
| 67 | One-click close all open positions | PE · **rare** | IN |
| 68 | Sell-all versus keep-all when stopping | ET · **rare** | IN |
| 69 | Skip the next scheduled action | CO · **rare** | IN |
| 70 | Drawdown or strategy-level stop loss | ET (5-95%), PU, WA | IN |
| 71 | Confirmation mode as a toggle, not a fixed policy | RH, MS, TJ, PU | IN |
| 72 | **Confirmation triggered by size, not by default** | TJ (>75% sell) · **rare** | **IN** |
| 73 | Clarifying questions before activation for missing parameters | PU · **rare** | IN |
| 74 | Hard scope limits: no transfer out, no stake, no lend, no margin | RH | IN |
| 75 | Read-only scope for data access | RH | IN |
| 76 | Price-impact guard with a threshold and an explicit opt-out mode | BB, MS, BG, BK | IN |
| 77 | Malicious contract, phishing and prompt-injection screening | BK · **rare** | IN (prompt guard) |
| 78 | Pre-trade simulation that blocks on honeypot, thin liquidity or high tax | MS, BG | IN (depth check) |
| 79 | Separate password for withdrawal or key export | TJ · **rare** | LATER |
| 80 | Session PIN with a timeout | BG · **rare** | OUT |
| 81 | Non-exportable keys | BK | IN |
| 82 | Key shown once with a cannot-be-recovered warning | BB, BG, MS | n/a |
| 83 | CAPTCHA on first use | MS | OUT |
| 84 | Per-device session logout | BK | LATER |
| 85 | Pause conversions on abnormal price deviation | MA · **rare** | IN |
| 86 | Every fund movement requires the user's signature | MA | IN |
| 87 | Upgrades require explicit approval | MA | LATER |
| 88 | Published audits and a bug bounty | MA | OUT |
| 89 | Account recovery via social login, backup wallet or phrase | PE, HA | LATER |
| 90 | Self-custodial, running on the user's own device | PE · **rare** | LATER |
| 91 | Risk-score ceiling on what may be followed | ET | OUT |
| 92 | Warning labels on risky instruments | ET | IN (disclosures) |
| 93 | Duplicate-action block | MS | IN |
| 94 | Gas price ceiling that blocks action | MS · **rare** | IN |
| 95 | Backup instances for congestion | BG, TJ | OUT |
| 96 | Jurisdiction gating | RH, DN | IN (disclosure) |

## E. Simulation and testing

| # | Add-on | Ships | Ours |
|---|---|---|---|
| 97 | Paper trading with simulated capital | CO ($1,000), ET ($100k) | **IN** (shadow mode) |
| 98 | Backtest against a benchmark with slippage and fees | CO, PU | OUT |
| 99 | Dry run against a live mainnet fork | AL, WA | LATER |
| 100 | Allocation simulator with constraints, before depositing | GZ · **rare** | LATER |
| 101 | What-if goal planning | BT, WF | OUT |

## F. Onboarding and presets

| # | Add-on | Ships | Ours |
|---|---|---|---|
| 102 | Risk questionnaire producing a score and a recommended preset | WF, BT | LATER |
| 103 | Named risk presets | PE, GZ, CO | IN |
| 104 | Goal-type onboarding | BT | OUT |
| 105 | Marketplace of ready-made agents or strategies, one-click install | PU, CO (2000+), WA (74), AL, BK, ET | LATER |
| 106 | Prompt templates plus a prompting guide | PU | LATER |
| 107 | Plain-language rules and goals that persist | PE, BK, WA | **IN** |
| 108 | Agent memory of preferences as editable text | BK · **rare** | IN |
| 109 | Social login | PE, BK, WA | OUT |
| 110 | Card or fiat funding | PE · **rare** | OUT |
| 111 | Sponsored gas at onboarding | WA · **rare** | IN |
| 112 | Very low minimum to start | GZ (~$1), CO ($50), ET ($200) | IN (~$20 floor) |
| 113 | Suggested first prompts | BK | IN |
| 114 | Simple versus Advanced interface mode | TJ · **rare** | LATER |
| 115 | Setup in a handful of steps, minutes not hours | RH (3), PE (4), MA (<2 min) | IN |
| 116 | Bring-your-own-agent with a supported list | RH | OUT |
| 117 | A helper that fixes the agent when it breaks | PE · **rare** | OUT |
| 118 | Run several agents in sequence | PE | OUT |

## G. Conversation

| # | Add-on | Ships | Ours |
|---|---|---|---|
| 119 | In-app chat answering "why did this change" | MA, WA, BK | LATER |
| 120 | Assistant that reads the portfolio and pre-fills an order | RH · **rare** | LATER |
| 121 | Research-only question answering on any asset | PU, HA | OUT |
| 122 | Build or edit the strategy by chatting | CO, AL, PU | LATER |
| 123 | Telegram as a channel | MA, BK, HA, BB, BG, MS, TJ | **IN** |
| 124 | X or Farcaster as a channel | BK | OUT |
| 125 | Inside coding agents (Claude Code, Codex) | GZ, PE, BK | OUT |
| 126 | Voice input | RH · **rare** | OUT |
| 127 | Undo and redo, plus conversation history search | WA · **rare** | OUT |
| 128 | AI-built custom scans or indicators from plain English | RH · **rare** | OUT |
| 129 | Saved prompts and customisable widgets | HA | OUT |

## H. Social proof and sharing

| # | Add-on | Ships | Ours |
|---|---|---|---|
| 130 | Shareable performance card, image or video, referral or QR embedded | BB, BG, MS, TJ, WA | LATER |
| 131 | Card posted automatically after every exit | MS · **rare** | LATER |
| 132 | Share by link so others can see the logic and import it | CO, PU, PX | LATER |
| 133 | Share achievements to X | PE | LATER |
| 134 | Public agent profile with live stats and activity | BK, ET | LATER |
| 135 | Public aggregate track record page | PE, GZ, AL | LATER |
| 136 | Leaderboard with rewards | WA, BK | OUT |
| 137 | Numeric risk score shown on everything | ET · **rare** | LATER |
| 138 | Creator update posts to followers, with a minimum cadence | ET · **rare** | OUT |
| 139 | Public versus private profile toggle | ET | OUT |
| 140 | Paid for being copied | ET, WA, PX | OUT |
| 141 | Referral program | BB, BG, MS, TJ, WA, AL, HA, 3C, PX | OUT |
| 142 | Deep link opening straight into an action with referral attached | TJ, BB, MS | OUT |

## I. Records and export

| # | Add-on | Ships | Ours |
|---|---|---|---|
| 143 | Chronological activity list with explorer links | AL, BK, WA, GZ, PE, MA | **IN** |
| 144 | Per-item ledger expandable to full order details | PU, RH | IN |
| 145 | Export transaction history | BK only · **rare** | LATER |
| 146 | Export to Quicken, TurboTax, CSV or Excel | WF, BT, ET | LATER |
| 147 | Version history of the rules or strategy | AL · **rare** | LATER |
| 148 | Realized profit-and-loss calendar since a date | WA | LATER |
| 149 | Positions view with sort, hide, and hide-below-threshold | BG, TJ, MS | LATER |
| 150 | Watchlist | TJ, RH | OUT |

## J. What a Stock Token product must tell its user

All of these come from live products. Numbers 151 to 170 are effectively a compliance and honesty
checklist for our screens.

| # | Must tell the user | Ships | Ours |
|---|---|---|---|
| 151 | Which market session it is now, and when that changes | R24, ON, DN, XS | **IN** |
| 152 | Where the displayed price comes from when the market is closed | all five | **IN** |
| 153 | The price is not pinned to the last close and may differ from the next open | XS, ON, R24 | **IN** |
| 154 | Off-hours spreads are wider, liquidity thinner, fills may be partial | XS, ON, DN, R24 | **IN** |
| 155 | Off-hours needs limit orders; market orders get refused or converted | R24, DN | IN (depth check) |
| 156 | Off-hours size and holding limits | ON, XS (300k cap) | IN (caps) |
| 157 | A staleness or halt signal: feed age, oracle paused, status | RH-chain, ON, XS | **IN** |
| 158 | Which assets trade 24/7 versus 24/5 | XS (10), ON (6+27), DN (9) | IN |
| 159 | Trading can pause between sessions, around earnings, or without notice | ON, R24 | IN |
| 160 | How dividends arrive: multiplier, or cash with a snapshot time and minimum | RH, XS, ON vs DN | **IN** |
| 161 | Dividends are net of withholding, with the rate | XS, ON (30%) | LATER |
| 162 | Current multiplier, and its history with event type and date | XS (Bybit) · **rare** | IN |
| 163 | Splits adjust automatically; trading halts and orders cancel near the date | DN, XS, ON | IN |
| 164 | A banner and a notification while a corporate action is in progress | RH Classic only · **gap on-chain** | **IN** |
| 165 | Delisting or merger outcome: sell-only, cash, or the position vanishes | RH Classic, DN | LATER |
| 166 | Ticker changes: show unavailable, and track by asset ID not symbol | DN · **rare** | IN |
| 167 | Itemised cost before confirming: price, spread, fees, buffer | RH Classic, XS, ON, DN | **IN** |
| 168 | Eligibility: not for US persons and listed countries | all five | **IN** |
| 169 | What the token legally is: debt instrument, no voting rights, total loss possible | all five | **IN** |
| 170 | Backing, how it is proven, and the redemption path with its hours | all five | IN |
| 171 | One token is no longer one share once the multiplier moves | RH, XS, ON | **IN** |

## K. Telegram interface patterns

| # | Pattern | Ships | Ours |
|---|---|---|---|
| 172 | Paste an address anywhere and a live panel opens | BB, BG, MS, TJ | LATER |
| 173 | Emoji menu grid plus slash-command aliases | BB, BG, MS, TJ | IN |
| 174 | Editable preset amount buttons | BB, BG, MS, TJ | LATER |
| 175 | One-tap action that skips confirmation | BB, MS, TJ | IN (per rules) |
| 176 | **Self-updating position message with timer, refresh and display modes** | MS only · **rare** | **IN** |
| 177 | The new position pinned above the chat | BG · **rare** | LATER |
| 178 | "Holdings changed outside the bot" warning | MS · **rare** | **IN** |
| 179 | Multi-wallet picker inside the panel | MS, TJ, BG | OUT |
| 180 | Active orders view with per-item edit and close-all | MS, TJ, BG | IN |
| 181 | Plain-text expiry syntax like "30d, 2h" | TJ · **rare** | LATER |
| 182 | Named speed presets | TJ, BG, BB | OUT |
| 183 | Per-chain settings profiles | BB, BG, MS | n/a |
| 184 | Slash commands to start and stop everything | 3C | IN |
| 185 | Premium tier bought inside the bot that raises limits | MS · **rare** | LATER |
| 186 | In-bot referral and cashback menu with a claim button | MS, BB, TJ | OUT |

## L. How they make money

| # | Model | Who | Ours |
|---|---|---|---|
| 187 | Performance fee only: percent of yield, taken at withdrawal | GZ (10%) | **candidate** |
| 188 | Annual percentage of assets | WF (0.25), BT (0.25), PU (0.49) | candidate |
| 189 | Flat monthly for small balances | BT ($5) | no |
| 190 | Subscription tiers by capability or count | CO ($0/10/32), BK ($20/mo), AL, WA, 3C | candidate |
| 191 | Premium subscription gating the AI features | RH Gold ($5), PU ($8-10) | no |
| 192 | Percent per trade | BB, MS, TJ (1%), BG (0.5-1%), PX (0.05%) | candidate |
| 193 | Free, with a spread in the price | ET, XS (1% conversion) | no |
| 194 | Pay per use or per request | BK Max Mode, PE Connect | LATER (x402) |
| 195 | Token stake or holder access | PE, HA | **no** |
| 196 | No fee at all, revenue from protocol fees shared back | MA · **rare** | no |
| 197 | Rewards paid for running the agent | PE, GZ (15% floor), WA, MA | no |
| 198 | API access as a paid perk | CO, PU | LATER |

---

## The five things almost nobody does

Ranked by how much they would differentiate us, given everything above.

1. **Keep the rejected alternatives and the confidence with the decision, tied to the transaction**
   (#55, #56). Nobody does this. Giza shows reasoning but keeps no durable record.
2. **Log the non-actions** (#46). Only Public. On a desk that is mostly idle overnight, this is most of
   the story.
3. **Warn about a corporate action before it lands** (#164). Robinhood does it in their EU app and not
   at all on-chain.
4. **Show the multiplier and its history** (#162). Only Bybit, and it is the reason a balance's value
   moves without a trade.
5. **Daily and per-action spend caps on an agent** (#58, #59). Only Bankr. Robinhood's own agent has
   neither.

## Counts

| Group | Items | IN | LATER | OUT |
|---|---|---|---|---|
| A Notifications | 19 | 8 | 6 | 5 |
| B Reports | 21 | 6 | 10 | 5 |
| C Explaining | 16 | 14 | 2 | 0 |
| D Safety | 40 | 28 | 7 | 5 |
| E Simulation | 5 | 1 | 2 | 2 |
| F Onboarding | 17 | 7 | 5 | 5 |
| G Conversation | 11 | 1 | 4 | 6 |
| H Social | 13 | 0 | 7 | 6 |
| I Records | 8 | 2 | 6 | 0 |
| J Stock Tokens | 21 | 19 | 2 | 0 |
| K Telegram | 15 | 6 | 6 | 3 |
| L Money | 12 | 0 | 2 | — |

Roughly 92 in, 59 later, 42 out. **That is too many for the first version.** Groups C, D and J are the
product and should survive intact. Groups A, F and K should be cut hardest.
