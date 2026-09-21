# What live tokenized-stock products show and tell users

Research pass 2026-09-19. Products' own docs, help centers and official pages only.
Robinhood Stock Tokens, xStocks (Kraken/Bybit), Ondo Global Markets, Dinari dShares,
Robinhood 24 Hour Market.

## FACTS THIS SETTLES FOR OUR BUILD

1. **Dividends: the multiplier rises, no cash is paid.** "When an underlying company pays a dividend,
   the dividend is automatically reinvested to purchase more shares of that stock. Instead of receiving
   a cash payout, your token's multiplier increases." (https://robinhood.com/rhj/stocktokens/)
   Raw `balanceOf` never changes. This was an open question; it is now closed.
2. **There IS an event to watch: `UIMultiplierUpdated`.** Emitted when the multiplier changes.
   (https://docs.robinhood.com/chain/building-with-stock-tokens/)
3. **The Chainlink feed price ALREADY includes the multiplier.** Feed price = underlying share price x
   multiplier. Same source.
4. **GOTCHA: the REST `/prices` endpoint returns the raw underlying bid/ask and is explicitly "not
   multiplier-adjusted".** (https://docs.robinhood.com/chain/stock-token-apis/) So the Chainlink price
   and the RHJ API price are on DIFFERENT bases. Any premium calculation that mixes them is wrong.
   Our own on-chain probe earlier compared a pool price to both without adjusting; redo that properly.
5. **Chainlink feeds update 24/5 and have no heartbeat off-hours.** "When underlying equity markets are
   closed (weekends, holidays, thin overnight windows), the feed may hold the last published price";
   "These feeds do not have heartbeats during off-hours."
   (https://docs.chain.link/data-feeds/tokenized-equity-feeds/robinhood) Confirms the weekend-staleness
   premise our whole after-hours idea rests on.
6. **`oraclePaused()` during corporate actions**, and the feed "holds the last known good value".
7. **`/prices` also returns `isTradingHalt` and `generatedAt`, but no market-status field.** We derive
   session state ourselves.
8. **NAMING CONSTRAINT: the Terms of Service forbid calling them "tokenized stocks". The approved term
   is "Stock Tokens".** (https://docs.robinhood.com/chain/terms-of-service) Our product copy must use
   "Stock Tokens" throughout.
9. **Mint and redeem is market-makers only, Mon 02:00 to Sat 02:00 CET.** Secondary trading on-chain is
   24/7 via Uniswap, Rialto, Lighter, Arcus, 1inch.
10. **`/corporate-actions` gives type (splits, cash and stock dividends, mergers), status
    IN_PROGRESS or COMPLETED, processDate and details.** Confirmed shape.
11. **GAP: on-chain Robinhood ships NO user-facing corporate-action notification.** Only the event and
    the REST endpoints. The EU "Classic" product does show a banner on the asset page plus in-app
    notifications. So a desk that warns its user about an incoming dividend, split or halt is doing
    something Robinhood itself does not do on-chain.

## THE 21-ITEM CHECKLIST (our UX requirements spec)

Everything a credible Stock Token product tells its user, with who does it:

1. Which session the underlying market is in right now, and when it changes. (Robinhood 24H, Ondo,
   Dinari, Kraken)
2. Where the displayed price comes from when the market is closed: last trade, market-maker fair value,
   or an oracle holding its last price. (all five)
3. That the price is NOT pinned to the last close and can differ from the next open. (Kraken, Ondo,
   Bybit, Robinhood 24H)
4. Off-hours spreads are wider, liquidity is lower, fills may be partial or none. (Kraken, Ondo,
   Dinari, Robinhood 24H, Bybit)
5. Use limit orders off hours; market orders get refused, queued or converted. (Robinhood 24H, Dinari)
6. Off-hours size and holding limits. (Ondo per-asset limits, Bybit 300k USDT cap)
7. A staleness or halt signal: feed age, oracle paused, halt flag, status page. (Robinhood Chain, Ondo,
   Bybit)
8. Which assets are 24/7 versus 24/5. (Kraken 10, Ondo 6 plus 27 off-hours, Dinari 9)
9. Trading can pause between sessions, around earnings, or be suspended without notice. (Ondo,
   Robinhood 24H)
10. How dividends arrive: reinvested via multiplier with token count unchanged (Robinhood Chain,
    xStocks, Ondo) or cash stablecoin to the wallet with a snapshot time and minimum (Dinari).
11. Dividends are net of withholding tax, with the rate stated. (xStocks, Ondo 30%)
12. Show the current multiplier AND its history with event type and effective date. (Bybit, xStocks)
13. Splits adjust balance or multiplier automatically; trading halts and open orders cancel around the
    effective date. (Dinari, xStocks activates 00:30 UTC after ex-date, Ondo, Robinhood Classic)
14. A banner on the asset page plus a notification while a corporate action is in progress. (Robinhood
    Classic only)
15. Delisting or merger outcome: sell-only mode, cash distribution, position may vanish. (Robinhood
    Classic, Dinari)
16. Ticker changes: show "temporarily unavailable" and track by asset ID, never symbol. (Dinari)
17. Itemised cost before confirming: token price, FX fee, spread, network fee, volatility buffer.
    (Robinhood Classic, Kraken, Ondo, Dinari)
18. Not for US persons and a listed set of countries; KYC where applicable. (all five)
19. What the token legally is: debt security, tracker certificate or structured note, no voting rights,
    issuer insolvency risk, possible total loss. (all five)
20. 1:1 backing, how it is proven, the redemption path and its hours. (Robinhood, xStocks, Dinari, Ondo)
21. Once the multiplier moves, one token is no longer one share's price. (Robinhood Chain, xStocks, Ondo)

## Per-product notes worth keeping

**Robinhood Stock Tokens.** Not available to residents of the US, Canada, UK, Switzerland, UAE and
sanctioned jurisdictions; live in 120+ countries. Legally "tokenised debt securities issued by
Robinhood Assets (Jersey) Limited" that "do not grant investors any legal or beneficial rights"; on
issuer insolvency "an independent security agent will sell the underlying shares". Prospectus at
docs.robinhood.com/rhj. On-chain fees are gas only (L2 execution plus L1 data). The EU Classic product
charges 0.1% FX and shows an order estimate with the fee and "a small buffer to account for
volatility", and fills bounded to 0.5% either side of last traded price.

**xStocks (Kraken).** 10 tickers trade 24/7 on Kraken Pro, the rest 24/5 with no weekend. In hours the
price is "anchored to the official exchange price of the underlying equity"; outside hours "market
makers use alternative data sources including ATS platforms, index futures, and internal models to
approximate fair value" and "spreads are wider outside market hours". Overnight uses Blue Ocean ATS.
No trading fee buying with USDG or USD, 1% on conversion, and "a spread may be included in the asset
price". Not available to US, Canada, UK, Australia, EEA.

**xStocks (Bybit).** Off US hours an xStock "may fluctuate slightly, acting as a prediction market
based on pre-market or after-hours news and sentiment". Lists depeg risks including the underlying
being halted, meaning "absence of a reliable reference price". Shows "Current Multiplier" above the
chart and a "Multiplier History" table under the Data tab. 300,000 USDT holding cap per token. Says
the tokens are "intended for speculative trading purposes only and may not always reflect real-time
stock prices".

**Ondo Global Markets.** Explicit session table with 1-5 minute pauses between sessions, a status page
at status.ondo.finance, and an Off-Hours session for 27 assets with a conservative separate size limit
per asset. Around earnings an asset enters a "limited" state with reduced max trade size. States
plainly that off hours "the price of a token may diverge more significantly from the value the
underlying security will have when its primary market next reopens". No mint or burn fees; the quote
may differ from Ondo's own execution price and it keeps the difference. 30% US dividend withholding.
"One token does not necessarily represent the value of one share."

**Dinari dShares.** The only one paying dividends as CASH: "you receive the equivalent value in
stablecoins on the same schedule, paid directly to your wallet", in USD+, snapshot at 4AM ET on
ex-date, nothing under $0.10. Session table restricts off-hours to limit orders only; off-hours market
buys are "priced at the latest ASK price" and "may fill fully, partially, or not at all". "Fair Market
Value" is "a computed number blending the last trade, recent trade price points/volume and resting
order book". Splits halt trading immediately and cancel active orders. Mergers have "no merger event
endpoint, so a position disappearing from the portfolio is your programmatic signal". Hard-coded
jurisdictional logic blocks transfers to restricted regions. $0.20 network fee per order.

**Robinhood 24 Hour Market (brokerage, for comparison).** Sun 8pm to Fri 8pm ET, whole-share LIMIT
orders only, because "our venues don't support market orders during extended or overnight trading".
Three labelled sessions in the order flow. Risk list shown to the user: "lower liquidity, higher
volatility, changing prices, unlinked markets, news announcements, and wider spreads". The disclosure
adds that the overnight venues "are not required to display prices publicly and may have very limited
liquidity", orders "may not be price protected", and trading "may be suspended at any time without
notice". No weekend trading; orders queue.
