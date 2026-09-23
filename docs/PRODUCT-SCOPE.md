# Product scope

> **Updated scope, 23 Sep 2026:** [the product fidelity handoff](2026-09-23-product-fidelity-handoff.md) records the owner's later requirement for live-agent trade copying, creator fees, twenty strategies, mainnet funding/credit and visible OpenServ linking. Any copy-trading exclusion below is historical, not the current requirement.

Draft 2026-09-19, for Abu to cut down. Built from five research passes saved under `docs/research/`.
This document is about WHAT the product is and WHICH features are in. Not how it is built.

---

## 1. The product in plain words

One agent that looks after a person's money on Robinhood Chain.

It holds USDG and Stock Tokens. It follows rules its owner sets. It is on duty while the US stock
market is closed, which is most of the week. Every time it acts, it says why in plain language, and
every time it decides not to act, it says that too.

It lives in two places at once. It is registered on OpenServ as an agent, which is where its schedule
and its Telegram voice come from. It also has its own web application, where the owner sets the rules
and watches the work. Same agent, two doors.

Its decisions are made by SERV Reasoning.

## 2. Why this and not something else

The core idea is not unique. Three things make it worth building:

1. **Timing.** Robinhood Chain mainnet is eleven weeks old. Only about six agent projects have won on
   it, and the funded ones were all about agents managing capital.
2. **The wedge nobody uses.** Stock Tokens trade around the clock on-chain while the underlying market
   closes. The Chainlink price feed runs 24/5 and holds Friday's close all weekend, verified. Acting on
   Sunday-night information is only possible here.
3. **The gap that is still open.** Serious on-chain agents do explain themselves now (Giza, Wayfinder,
   Almanak, Mamo). What none of them keeps is a structured, durable record of the decision: the options
   rejected, the confidence, tied to the transaction so it can be checked later.

**Competition, named.** Olas Pearl shipped Robinhood Chain support on 17 September, two days ago.
Wayfinder ships a Robinhood Chain launch sniper. Inside this hackathon, Alloc, Pond Agent, ThoughtProof
and IntentLease are all live. Alloc is closest: it decides hold, stablecoin, or Stock Token, with
reasons shown in a web UI. **We are not competing on "an agent that trades Stock Tokens". We are
competing on being the one you would actually trust with money overnight.**

## 3. What the user experiences

1. **Arrive.** Connect a wallet. Read one screen explaining what Stock Tokens legally are and who may
   not hold them.
2. **Fund the desk.** Move an amount deliberately into the desk. One Relay step from Base costs 0.17%
   and takes about a second. Floor of about $20 because fixed fees dominate below that.
3. **Set the rules.** In plain language and with explicit numbers: what to hold, how much of the desk any
   one position may take, a daily spend cap, a per-action cap, a drawdown that stops everything, and
   which tokens are allowed at all.
4. **Watch in shadow mode.** The desk runs for real but does not spend. It posts the decisions it would
   have made. The rule for going live is visible from the start.
5. **Go live.** The desk wakes on a schedule while markets are closed. It reads the on-chain price
   against the last official close, the pool depth, the halt flag, pending corporate actions, and the
   news. It decides: act, wait, or decline.
6. **Get told.** A Telegram message with the decision, the reason, what it rejected, its confidence, and
   the itemised cost. Either it asks for approval or it reports what it did, depending on the rules.
7. **Idle cash earns.** USDG not in a position sits in the Steakhouse USDG vault at about 3.6%.
8. **Check the record.** The web app shows every decision, including the ones where it did nothing, each
   linked to its transaction.
9. **Stop whenever.** Pause, revoke, or withdraw in one action, at any time.

## 4. Features that are IN

Each is justified by a live product that ships it, or by a fact we verified.

### Safety, because this is money
1. **A dedicated desk wallet holding only what was deliberately moved in.** Robinhood's own agentic
   account model, and the single best safety idea found.
2. **Daily and per-action spend caps.** Bankr defaults to $500 per 24 hours and $500 per transaction.
   **Robinhood ships no caps at all**, so this is where we exceed the incumbent.
3. **An allowlist of tokens the desk may touch**, and no permission to transfer funds out to a third
   party at all.
4. **Drawdown stop.** Breach it and the desk stops acting and says so. eToro's Copy Stop Loss, set
   5-95%.
5. **Pause, and one-action revoke.** Universal across all seven on-chain agents.
6. **Withdraw at any time**, with the desk exiting positions. Universal.
7. **Confirmation triggered by size, not by default.** Trojan forces a confirmation when selling over
   75% of a position regardless of settings. Smarter than asking every time.
8. **Shadow mode with a visible promotion rule.** Maestro's track-only mode; Composer and eToro both
   ship paper trading. Robinhood ships none, which is a known complaint.

### Transparency, which is the product
9. **A decision record for every action**: what it did, the alternatives it rejected, its confidence,
   the evidence it used, and the cost, tied to the transaction hash.
10. **Non-actions are recorded too.** Public logs conditions checked that did not trigger. An agent that
    explains why it did nothing reads as more trustworthy than one that only speaks when it trades.
11. **A preview before any action**, itemised: price, spread, network cost, expected result. HeyAnon's
    Plan Flow and Betterment's Tax Impact Preview.
12. **Failure messages that name the cause.** Banana Gun writes "the target transaction was mined, but
    your buy was not included in the block". Cheap, and it reads as competence.
13. **Receipts with explorer links** for everything.

### The things specific to Stock Tokens
14. **Show which market session it is** and when that changes, from the live `tradingCapabilities` data
    plus a US market clock.
15. **Label a stale price honestly as "last close"**, with its age. The feed is 24/5 by design and holds
    Friday's price all weekend.
16. **Premium or discount against the reference price**, computed correctly. The price API is *not*
    multiplier-adjusted while the Chainlink feed *is*; mixing them silently produces a wrong number.
17. **Corporate action awareness.** Watch the on-chain `UIMultiplierUpdated` event, since the
    corporate-actions API provably misses entries. Explain value jumps caused by a dividend or split.
    Warn before one lands. **Robinhood notifies on-chain users of none of this.**
18. **Refuse to trade a halted or oracle-paused token**, and say why.
19. **Eligibility and legal disclosure up front**: what the token legally is, who may not hold it.
    **Terms require the name "Stock Tokens", never "tokenized stocks".**

### Earning and funding
20. **Idle USDG into the Steakhouse USDG vault.** Verified permissionless ERC-4626. Quote 3.6%, not the
    7% the press repeats. Size withdrawals against available liquidity, not total assets.
21. **One-step funding via Relay** from Base, Arbitrum, Ethereum or BNB Chain.
22. **Gasless where it helps**, via Alchemy on EntryPoint v0.7.

### The rules, in the user's words
23. **Plain-language rules that persist**, alongside the hard numbers. Bankr stores rules like "never
    confirm trades under $50" as editable text. Pearl switches risk presets by being told in chat.
24. **Presets to start from**, so nobody faces an empty form. Pearl and Giza both do this.

### Where the agent lives
25. **Scheduled wake-ups from OpenServ cron**, which is the after-hours duty cycle itself.
26. **Telegram as the voice**, using the OpenServ integration. Notify, and accept approval or rejection
    by reply.
27. **One self-updating position message in Telegram**, refreshing in place with value, profit and loss,
    and the nearest trigger. Maestro's Trade Monitor, the strongest Telegram pattern found.
28. **The web app** for rules, the decision history, and the evidence behind any single decision.

## 5. Features that come LATER

Good ideas, deliberately not in the first version.

- Choosable report cadence: daily, weekly, monthly, off. Mamo's pattern.
- Quiet hours, and an observe-only versus observe-and-act switch. Wayfinder.
- A shareable decision or performance card.
- A public track record page. Olas publishes that only 3 of 10 agents were profitable, which is the
  honest version.
- CSV or tax export. Only Bankr ships it.
- Asking the desk questions about its own history in chat.
- A paid endpoint so other agents can ask the desk a question. Revenue, but not before the desk works.
- Publishing the desk as an OpenServ template others can clone.
- Multiple desks per user.

## 6. Features that are OUT, and why

- **MCP, in every direction.** Abu's decision. The agent talks to the chain in its own code.
- **The Robinhood brokerage MCP.** US brokerage accounts only, localhost-only OAuth, no paper mode.
  Unavailable from Nigeria and a bad bet regardless.
- **Feature parity on testnet.** Not possible. No USDG, no Uniswap, no vault, no price feeds there, and
  a clone pool pricing TSLA at 0.067 USDC. Testnet stays a plumbing test only.
- **Memecoins and a degen mode.** Alloc already does this. It contradicts a desk you would trust
  overnight.
- **Snipers, DCA ladders, and a limit-order engine.** That is a trading bot. Six products already do it
  better, and none of them can explain a decision.
- **Copy trading, leaderboards, referrals.** A social layer on a product with no track record yet.
- **Prediction markets.** No API exists on Robinhood.
- **Voice.** Robinhood Cortex has it. It buys us nothing here.
- **Card or fiat onboarding.** KYC burden for no gain.
- **A token.** The revenue story is a fee, not a token.
- **Margin, lending out, staking, transfers to third parties.** Robinhood's agent forbids all of these
  and is right to.

## 7. What the verified facts force on us

| Fact | What it forces |
|---|---|
| No USDG, Uniswap, vault or feeds on testnet | Mainnet product, small amounts. No feature toggle. |
| Vault APY is 3.65%, TVL $484M, 7% liquid | Say 3.6%, never 7%. Check liquidity before withdrawing. |
| `maxDeposit`/`maxWithdraw` return 0 by design | Never use them for capacity. |
| Price API is not multiplier-adjusted, feed is | Adjust before comparing, or the premium is wrong. |
| Corporate-actions API misses real events | Trust the on-chain event log. |
| Dividends pay no cash, they raise a multiplier | Never wait for USDG that will not arrive. |
| Feed is 24/5, no weekend heartbeat | Staleness measured on a 24/5 calendar, not in hours. |
| Uniswap V4 holds $194M vs V3's $70M | The deeper venue has the awkward router. A real tradeoff. |
| Sub-$5 funding loses 13% | Minimum around $20. |
| Stock Tokens barred to US, UK, Canada, Switzerland | Disclosure up front. Abu in Nigeria is unaffected. |
| Terms forbid "tokenized stocks" | Product copy says "Stock Tokens". |

## 8. Open decisions for Abu

> **All six are answered in `DECISIONS.md` (2026-09-19).** That file also corrects item 15, adds the
> Monday scorecard, and cuts the first version to eight features. Where the two files differ,
> `DECISIONS.md` wins.

1. **Who is this for?** A crypto holder who wants equity exposure without a broker, or someone who
   already holds Stock Tokens and wants them managed? It changes the first screen entirely.
2. **Does the desk manage one user's money, or accept deposits from several?** Everything above assumes
   one owner, one desk. Pooled deposits make it a fund and add real weight.
3. **Approval by default, or autonomy by default?** Every product surveyed makes this a toggle. Which
   way does it point on day one?
4. **Uniswap V3 for the simpler router, or V4 for the deeper liquidity?**
5. **What does the desk actually decide?** Rebalance toward a stated thesis, react to weekend news, or
   act on premium and discount against the last close? The reasoning prompt depends on this answer.
6. **The fee.** Giza's model is the cleanest found: 10% of yield, taken at withdrawal, everything else
   free. Do we copy it, charge on executed value, or skip a fee for the hackathon and just show it?
