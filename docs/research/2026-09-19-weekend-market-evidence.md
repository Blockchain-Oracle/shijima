# Weekend market evidence: does the after-hours wedge exist?

Measured 2026-09-19 (a Saturday, 17:47 UTC). Sources: direct RPC calls to
`https://rpc.mainnet.chain.robinhood.com` with `cast`, the RHJ price API, the Chainlink reference
directory, and GeckoTerminal hourly candles (`/networks/robinhood/pools/{pool}/ohlcv/hour`, 1000 hours).

The question this answers: PRODUCT-SCOPE open decision 5, "what does the desk actually decide?". The
whole product rests on the claim that something worth deciding happens while the US market is closed.
Nobody had checked.

---

## 1. The weekend market is real

Weekend = Saturday 00:00 UTC to Monday 00:00 UTC, which is Friday 20:00 ET to Sunday 20:00 ET. This is
the only window in the week when Authorised Participants cannot mint or burn, so nothing anchors the
on-chain price to the underlying.

NVDA / USDG, Uniswap v3 0.05% pool `0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3`:

| Weekend | Hours with trades | Volume | Low vs Friday | High vs Friday | Sunday last | Monday 10:00 ET |
|---|---|---|---|---|---|---|
| 15 Aug | 48 of 48 | $4.9M | -0.53% | +0.79% | +0.33% | +0.58% |
| 22 Aug | 48 of 48 | $13.7M | -0.57% | +2.53% | +1.49% | -2.34% |
| 29 Aug | 48 of 48 | $30.2M | -0.44% | +1.62% | -0.22% | +0.30% |
| 5 Sep | 48 of 48 | $35.2M | -0.36% | +0.83% | +0.61% | +1.08% |
| 12 Sep | 48 of 48 | $27.6M | -2.11% | +0.42% | -1.77% | -3.57% |

Average hourly volume: $1.02M on weekdays, $437K on weekends. The weekend market runs at about 43% of
weekday activity. It is not a ghost town.

**What this proves.** Prices move by whole percents with no reference market open, and the pool is
deep enough to trade against the entire time.

**What this does not prove.** That the weekend price predicts Monday. Sunday's price pointed the same
way as Monday's open on three of five weekends. On 22 August a buyer paying Sunday's +1.49% premium was
down 3.8% by Monday 10:00 ET. On the 12 September weekend a holder who waited for Monday instead of selling Sunday
lost a further 1.8%. Five samples prove no edge in either direction, and the product must never claim
one.

**What it means for the product.** "Trade now or wait for the reopen" is a decision with stakes of
several percent, under real uncertainty, with no rule that is always right. That is a job for judgment
with a record, which is what we are building. It is not a job for a signal-following bot.

## 2. Liquidity differs wildly by token

| Token | Deep pool | USDG side | Typical weekend volume |
|---|---|---|---|
| NVDA | 0.05% `0xd4EB…14a3` | $3.87M | $5M to $35M |
| QQQ | 0.05% `0xD60A…597d` | $917K | not measured |
| TSLA | **0.3%** `0xf4AC…89E3` | $439K | $33K to $6M |
| AAPL | 0.05% `0xAae0…2d6D` | $355K | not measured |
| MSFT | **0.3%** `0xeb60…1510` | $291K | not measured |
| SPY | 0.05% `0xa7Bb…9167` | $245K | $84K to $2M |

Round trip cost for $1,000 on the NVDA 0.05% pool is 10.1 bps, which is the two fees and almost no
price impact. The same $1,000 on the thin TSLA 0.05% pool costs 49 bps.

**TRAP: the deep pool is not always the 0.05% tier.** TSLA and MSFT liquidity sits in the 0.3% tier.
The MSFT 0.05% pool holds $0.000225 and the quoter reverts on it. The desk must pick the pool per token
by depth, never assume a fee tier.

## 3. The reference price is fuzzy, and the docs mislabel it

Feed state on Saturday 17:47 UTC:

| Token | Feed last updated (UTC) | Feed | Pool mid | Pool vs feed |
|---|---|---|---|---|
| NVDA | Fri 19:55 | 222.447 | 222.52 | +3 bps |
| AAPL | Fri 15:11 | 335.385 | 335.54 | +5 bps |
| QQQ | Fri 19:50 | 720.365 | 721.38 | +14 bps |
| TSLA | Fri 19:48 | 363.800 | 365.08 (thin pool) | +35 bps |
| SPY | **Fri 12:22** | 761.551 | 764.68 | +41 bps |
| MSFT | Fri 20:41 | 495.823 | not quoted | |

- **The feed is not "Friday's close".** It updates on a 0.5% move or a 24 hour heartbeat. The SPY feed
  last updated at Friday 12:22 UTC, which is before the US market opened. PRODUCT-SCOPE item 15 says to
  label the stale price "last close". That label would be false. The honest label is "last oracle
  update" with its timestamp.
- **Noise floor of about 50 bps.** Any premium or discount smaller than the feed's own 0.5% deviation
  band is not a signal. The desk should treat anything under roughly 50 bps as "in line".
- The RHJ price API keeps quoting on Saturday but with a wide book: SPY 757.85 bid, 763.59 ask, a 75 bps
  spread. NVDA showed 222.48 / 223.00, unchanged since Friday. Multiply by `uiMultiplier` before
  comparing with anything on-chain.
- **Best reference for the premium: our own snapshot of the pool price at 16:00 ET Friday**, cross
  checked against the feed. We control it, it is on the same basis as what we trade, and it has no
  deviation band.

## 4. Only 37 Stock Tokens have a Chainlink feed

The reference directory lists 57 feeds on chain 4663, of which 37 are Stock Tokens. There are 194 Stock
Tokens. The desk's tradable universe is the set with a feed and a deep pool, which is a few dozen names
at most. The allowlist should be built from that intersection, and the first version can ship with
about ten.

## 5. Calendar consequence

Submissions close Monday 28 September 00:00 UTC, which is the exact moment a weekend window ends.
**There is one complete weekend before the deadline: 26 to 27 September.** Real weekend transactions in
the submission require a desk that can trade by Friday 25 September 20:00 ET. A read-only logger started
earlier can still collect shadow decisions on weeknights. The Arbitrum Open House deadline of 4 October
gives one more weekend.

## 6. The Robinhood price API is frozen on weekends but stamps itself as fresh

Read twice on Saturday, at 17:51 UTC and 18:12 UTC, and compared with a reading from earlier the same
day:

| Token | Bid | Ask | Changed between readings | `generatedAt` |
|---|---|---|---|---|
| NVDA | 222.48 | 223.00 | no, identical all day | refreshed to the second each time |
| SPY | 757.85 | 763.59 | no | refreshed each time |
| TSLA | 364.15 | 368.50 | not compared | refreshed |

**TRAP: `generatedAt` is the time the response was built, not the time the quote was made.** On a
weekend the bid and ask are Friday's, with a timestamp from this second. Code that trusts
`generatedAt` as the quote's age will treat a two-day-old price as live. The desk must work out the
quote's real age from the market calendar, never from this field.

This also means the API cannot serve as a moving weekend reference. On weekends the only live price is
the pool. `isTradingHalt` from the same endpoint is still the only halt signal anywhere, since no
on-chain halt flag exists.

## 7. The drift, caught live inside a unit test

| When (UTC) | NVDA pool versus the frozen feed |
|---|---|
| Sat 19 Sep 17:47 | +3 bps |
| Sun 20 Sep 06:50 | -65 bps |

Same feed value both times: 222.447, last updated Friday 19:55 UTC. The pool moved 68 bps in 13 hours
with no reference market open. A contract test that had passed on Saturday failed on Sunday for this
reason alone, which is as direct a demonstration of the product's premise as we are likely to get.
