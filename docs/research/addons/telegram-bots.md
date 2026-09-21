# Telegram trading UX: what the best bots actually ship

Research pass 2026-09-19. BasedBot, Banana Gun, Maestro, Trojan, 3Commas, Pionex.
Each product's own docs only. BasedBot and Pionex docs sit behind Cloudflare, so those two were read
via search snippets of their official pages.

## THE PATTERNS WORTH STEALING FOR OUR DESK

1. **The self-updating position message (Maestro "Trade Monitor").** Every buy spawns one persistent
   message that refreshes in place: token, timer, per-wallet P/L after tax and price impact, Initial /
   Payout / Worth, % of supply, nearest limit trigger, price and market cap. It has Refresh, arrows to
   cycle between positions, and three display modes (Brief, Detailed, Extended). It even shows
   "⚠️ Initial Outdated ⚠️" when holdings changed outside the bot. This is the single best Telegram
   pattern in the set and maps directly onto a desk position.
2. **"Track only" mode (Maestro).** Watch a wallet or signal and get the full report message, but do
   not auto-buy. That is exactly the shape of a shadow mode a user can trust before going live.
3. **Confirmation as a toggle, not a policy.** Maestro has "Confirm Manual Buy" / "Confirm Manual Sell"
   (default off). Trojan has "Confirm Trades", plus **"Sell Protection" that forces a confirmation when
   selling more than 75% of a balance** regardless of the toggle. A size-triggered confirmation is
   smarter than a blanket one.
4. **Shareable PnL cards with the referral baked in.** All four bots ship them. Maestro's can be an
   image *or a video*, has a toggle for showing trade duration and invested amount, and an "Auto PnL
   Card" setting that posts one after every sell. BasedBot's embeds a QR code that onboards the viewer
   under your referral.
5. **Human-readable failure messages (Banana Gun).** Real strings from their docs: "The target
   transaction was mined, but your buy was not included in the block", "Owner called a function,
   preventing the token from being purchased at this time", "Insufficient funds. Wallet 0xA..Dead
   requires more ETH", "MEV Launch Detected". Each names the cause and implies the next step.
6. **Hard spend caps on any automation.** Copy trading everywhere has "Max Buy" or "Spending Limit"
   per wallet, plus filters that skip rather than cap. "Pause All" is one tap.
7. **A separate password for dangerous actions.** Trojan's Secure Action Password is required to export
   keys or withdraw, and is non-recoverable. Banana Gun has a session PIN with a configurable timeout.
8. **Safety verdict inside the trade panel.** Banana Gun shows a red/green "Safe to buy" indicator plus
   buy/sell/transfer tax. Maestro blocks on honeypot, blacklist, thin liquidity and high tax, and puts
   a confirmation gate on suspected siphons. Both offer an opt-out "Degen Mode", which is the honest way
   to let an adult override a guard.
9. **Price-impact guard with a threshold.** Maestro's "Price Impact Alert" fires above 20% by default.
   BasedBot blocks the buy above a set impact unless Pro Mode is on.
10. **Simple versus Advanced mode (Trojan).** One switch that hides the complexity for new users.

## What these bots do NOT do

None of them explains *why*. They are mechanical: triggers, presets, caps and fills. The only
"reasoning" is a safety verdict on a contract. No bot in this set tells the user why it chose one
action over another. Same gap the investing-products pass found.

## Per-product summary

**BasedBot** (1% per trade, 25% referral, volume-tiered cashback claimable at $10 per chain).
Token Monitor panel on any pasted address with Slip, Gas, Impact, Audit, Chart and "Shill" buttons.
Wallet Tracker pushes buys, sells and new-token creations with a "Trade Now" button, nickname and
emoji per wallet, and the list exports as JSON. TP/SL/trailing with defaults auto-applied to new
trades. Limit orders by market cap. DCA at fixed intervals. Copy trading with a Max Buy USD cap,
"Trade Once Per Token", and Dev Sell (auto-sell 100% when the dev sells). Snipers for pool creation,
name/symbol patterns and migrations. Social copytrading off X, Zora and Warpcast posts. Per-chain
settings across nine chains. No trade-confirmation step documented.

**Banana Gun** (0.5% manual, 1% snipes; 10% referral; token holders share 40% of revenue).
"Paste & Trade" from any screen, and the bot picks the buy menu or the snipe menu based on launch
status. Buy/Sell Success messages; the bought token is pinned above the menu. Token panel shows a
"Safe to buy" indicator, market cap, liquidity, price, three taxes, contract balance and recommended
tip. Sell panel shows PNL across all wallets and per wallet. Positions supports sort, hide, "Sell
100%", "Add Position" and "Hide All Positions Below" a threshold. PnL card in simple or detailed form.
Security PIN locking the bot per session. Anti-Rug frontrunning, "Transfer on Blacklist", tax limits,
liquidity limits, price-impact limit, honeypot detection, Anti-MEV, reorg protection. Limit orders
cannot be edited once live, only cancelled. Backup bot instances with identical wallets for congestion.

**Maestro** ($200/month Premium; 1% per trade; 25% lifetime referral; 15-30% cashback by volume).
The Trade Monitor described above, 36 hours on free and 96 on Premium. Positions view with Initial,
Payout, Worth, P/L, price, market cap and price impact, plus per-position Reset P/L and Track. Sell
limits trigger on price, market cap, or percent from entry, where entry re-averages on further buys,
with per-order balance percentage and duration up to 168 hours. "Auto Sell on Manual Buy" applies your
preset ladder after every buy. Copytrade up to 5 wallets per chain, 12 on Premium, with Max Buy,
frontrun, auto-buy checks and copy-sell mirroring the same percentage. Max Gas Price blocks copytrades
above a ceiling. Duplicate-buy block on by default. CAPTCHA on first start. Keys AES-encrypted with a
"pen and paper" warning.

**Trojan** (1% per trade, 20% cashback in SOL, five-layer referral paid daily).
Menu covers Buy, Sell, Positions, Limit Orders, DCA Orders, Copy Trading, Sniper, Trenches, Rewards,
Watchlist, Withdraw, Settings. Limit orders trigger on price, market cap, plus or minus percent, an
event (Migration, Dev Sell) or a schedule, with plain-text expiry like "30d, 2h, 5m, 10s". DCA takes
amount, interval, duration and a min/max price band, and warns that a blank duration "runs until
wallet empty". Auto Sell builds a take-profit ladder summing to 100% plus a stop loss on every buy.
Copy trade has tag, buy percentage or fixed, max buy, copy sells, blacklist and retries. Sniper filters
on mint and freeze authority, socials, liquidity, pool supply and dev holding. New Pairs Scanner pushes
channel messages. A warning tag marks tokens not bought through the bot, as an airdrop-scam guard.
Deep links open the bot straight into a buy with the referrer attached.

**3Commas** ($15/$38/$105 per month, no per-trade fee; 25/15/10% three-level referral).
Telegram here is a notification and command channel for an exchange account, not a trading UI. No
inline buttons. Slash commands only: /stop_all_long_bots, /start_bot [id], /my_bots, /my_stats.
Per-event opt-in matrix across website, email, push and Telegram: trade opened, trade closed, stop
loss hit, errors, API key expiry. Notable: a **Telegram-only security alert when trading happens
outside 3Commas on the connected account**. Their own docs warn that Telegram commands "can start,
stop, or reveal sensitive information", so link only a personal account.

**Pionex** (0.05% per trade; 20% spot referral).
No Telegram trading product at all. Trade data "cannot yet be accessed through Telegram". Grid-bot
notifications are "not available yet" because of the "crazy amount of transactions". Price alerts are
not supported and they point users at an external Telegram price bot. Sharing happens as a
"copy my bot" web link with an invite code rather than an in-chat card. Useful mainly as a
counter-example.

## Merged pattern list (39 items)

Paste-a-CA-anywhere opens a live panel. Emoji main-menu grid plus slash aliases. Editable preset amount
buttons. One-tap quick buy that skips confirmation. Confirmation step as a toggle. Large-sell guard
above 75%. Self-updating persistent position message with timer and refresh. Bought token pinned above
chat. Positions with pagination, sort, hide, sell-100%, hide-below-threshold. Per-wallet PnL with
Initial/Payout/Worth and an "outdated" warning. Shareable PnL card as image or video with referral or
QR embedded. Auto PnL card after every sell. Safety verdict in the panel (honeypot, blacklist, tax,
siphon gate, audit button). Price-impact alert or blocker with a Degen/Pro opt-out. Wallet-tracker
alerts with a Trade Now button and per-wallet nickname and emoji. Track-only mode. New-launch and
migration feed channels. TP/SL/trailing ladders auto-created on every buy. Limit orders with price,
market-cap, percent-from-entry, event and scheduled triggers plus plain-text expiry. Immutable-once-live
orders. Active Orders view with per-order config and Close All. DCA with interval, duration, price band
and a runs-until-empty warning. Copy trading with hard spend caps, filters, copy-sells, Pause All and
track-only. Dev-sell auto-exit. Multi-wallet bundle picker in the trade panel. Security PIN with session
timeout, or a separate password for withdraw and key export. Private key shown once with a
cannot-be-recovered warning. CAPTCHA on first start. Backup bot instances. Deep links that open on a
token with referral attached. In-bot referral and cashback menus with per-chain accrual and a claim
button. Premium tier bought inside the bot that raises limits. Simple versus Advanced UI mode.
Per-chain settings profiles and chain-switch commands. Named gas presets (Fast, Turbo, Medium).
Human-readable failure messages naming cause and next step. Telegram as notification-plus-command
channel for an exchange account with per-event opt-in. Telegram-only alert for activity outside the
product. Shareable copy-my-bot web link with invite code.
