# Robinhood Chain: verified facts the product depends on

Verified 2026-09-19 (a Saturday, which matters for the oracle findings). Facts labelled VERIFIED were
read on an authoritative page or confirmed by direct RPC call against
`https://rpc.mainnet.chain.robinhood.com`.

---

## 1. Idle cash yield: FEASIBLE on mainnet, at 3.6% not 7%

**The vault: "Steakhouse USDG" (steakUSDG), Morpho Vault V2, `0xBeEff033F34C046626B8D0A041844C5d1A5409dd`
on chain 4663.**

VERIFIED on-chain:
| Call | Result |
|---|---|
| `asset()` | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (USDG) |
| `totalAssets()` | 483,828,839.96 USDG |
| `convertToAssets(1e18)` | 1.007424 USDG |
| `performanceFee()` / `managementFee()` | 0 / 0 |
| `receiveSharesGate()` etc (all four gates) | `0x0` — **NO ALLOWLIST** |

- **Anyone can deposit.** All four gate functions return the zero address, and Blockscout shows plain
  EOAs calling `deposit()` and `redeem()` directly with status ok, including one the same morning.
- **It is the Robinhood Earn vault.** Robinhood's own support page says Earn deposits into "a Morpho
  lending vault curated by Steakhouse Financial", and Steakhouse's docs list this exact address under
  Partnership Vaults with blockchain "Robinhood". Robinhood never publishes the address itself.
- **APY is 3.65%**, per the Morpho GraphQL API today, with a 30-day average also 3.65% and no extra
  reward incentives. The widely repeated "7%" was Robinhood's launch-time estimate and news reported
  1.9% on 20 July. **The "$900M" figure is wrong too: it is $484M.**
- **Withdrawal liquidity is the real constraint.** Only $34.6M is instantly withdrawable against $484M
  of assets, roughly 7%. No lockup and no queue, but a withdrawal larger than available liquidity simply
  reverts. `forceDeallocate` exists with a penalty of up to 2%. Robinhood's Earn page says the same:
  "processing depends on available liquidity in the lending vault."
- **TRAP: `maxDeposit()` and `maxWithdraw()` return 0 on-chain.** Morpho docs say all `max*` functions
  return 0 by design in Vault V2. Never use them for a capacity check.

Other USDG venues on the chain: "Ethena x Steakhouse USDG" `0xbEeFF0fb1Dc19344A87b8479dAb60A2e16160737`
at $23.6M and 3.57% net (unlisted). syrupUSDG `0x40858070814a57FdF33a613ae84fE0a8b4a874f7` is NOT a
depositable vault here: `asset()` and `convertToAssets()` revert, and it has a CCIP admin, so it is a
bridged token you acquire by bridging or swapping. Its role is collateral inside the Steakhouse vault.
The "Steakhouse Turbo USDG" cited in news is not found in the API for 4663.

**Consequence: yield is real and permissionless, quote it as ~3.6%, and size withdrawals against
available liquidity rather than total assets.**

---

## 2. Gasless use: WORKS on mainnet AND testnet

- Robinhood docs claim "first-class support for ERC-4337" and "also supports EIP-7702", naming Alchemy
  (primary), ZeroDev, Privy and Dynamic.
- VERIFIED on-chain: EntryPoint v0.6, v0.7 and v0.8 all have identical code on **both** 4663 and 46630.
  Permit2 and Multicall3 present on both. Safe 4337 Module v0.3.0 deployed.
- **Alchemy VERIFIED** on its own supported-chains page: both Robinhood Mainnet and Testnet ticked for
  Bundler, Gas Sponsorship and ERC-20 gas payments, with "Gas sponsorship on Robinhood Mainnet and
  Testnet is now live!"
- **Pimlico VERIFIED**: both chains, EntryPoint v0.6/v0.7/v0.8 bundler and paymaster, EIP-7702 ticked.
- ZeroDev works per Robinhood's own example code but is absent from ZeroDev's own list. Privy powers the
  Robinhood Earn wallet but chain-specific sponsorship is unverified. Biconomy: no evidence. thirdweb
  had only testnet in its chainlist as of 14 September.

**Consequence: target EntryPoint v0.7 with Alchemy, Pimlico as fallback. Gasless onboarding is
available on both networks.**

---

## 3. Testnet parity: THE TOGGLE IS NOT VIABLE

VERIFIED by `eth_getCode` returning `0x`: on testnet 46630 there is **no** Uniswap v3 factory, router or
quoter at the mainnet addresses, **no** USDG, **no** NVDA, **no** steakUSDG, and **no** Chainlink feed.
The Chainlink reference directory has no testnet file at all (404).

What does exist on testnet is a third-party UniswapV3Factory clone at
`0x911b4000D3422F482F4062a913885f7b035382Df` with real pools for the five faucet tokens against the
faucet USDC, each holding meaningful liquidity. But:
- **The prices are nonsense.** The TSLA pool implies 1 TSLA = 0.067 USDC.
- Testnet USDC has 18 decimals; mainnet USDG has 6.
- Testnet TSLA and AMZN expose `uiMultiplier()` but `oraclePaused()` reverts, so they are not the same
  contract as mainnet.
- No verified QuoterV2 on the explorer points at that factory, so we would have to deploy our own
  quoter or quote by simulating the router.

Side note for mainnet routing: DefiLlama shows **Uniswap V4 at $194M TVL on 4663 versus V3 at $70M**, so
V4 is the deeper venue despite its modified router.

**Consequence: a mainnet/testnet toggle cannot offer the same product. Testnet gives a swap demo with
fake prices and nothing else: no yield, no oracles, no USDG, no multiplier events. Build for mainnet
with small amounts, and use testnet only for account-abstraction plumbing tests.**

---

## 4. Dividends and splits: no cash, and the API is not the source of truth

- **Cash dividends pay no cash.** The dividend is reinvested by raising `uiMultiplier`, so "a stock
  token tracks the total return of the underlying" and "one token comes to represent more than one
  share". Splits scale the same multiplier. `balanceOf` and `totalSupply` never change. Views
  `balanceOfUI()` and `totalSupplyUI()` exist.
- **The event, VERIFIED on-chain with real examples:**
  `UIMultiplierUpdated(uint256 oldMultiplier, uint256 newMultiplier, uint256 effectiveAtTimestamp)`,
  topic0 `0x2205df4534432b2f60654a3fdb48737ffdaf3e9edb1a498bd985bc026b15b055`.
  Observed: NVDA moved 1e18 to 1.000775159e18 effective 2026-09-10, and CRWD currently sits at 4.0e18
  from a 4:1 split. Transfers emit
  `TransferWithScaledUI(address indexed from, address indexed to, uint256 value, uint256 uiValue)`.
  Note the ERC-8056 draft names these differently; **trust Robinhood's ABI, not the EIP draft.**
- Pending changes are visible on-chain via `newUIMultiplier()` and `effectiveAt()`. The API's
  `pendingMultiplier` is empty for all 194 assets right now.
- **`/corporate-actions` is incomplete.** Live today it returns 49 rows, ALL of type
  `CASH_DIVIDEND`, split 24 COMPLETED and 25 IN_PROGRESS. Fourteen types are documented but only four
  are active. **NVDA's 10 September multiplier change has no COMPLETED row, and CRWD's 4:1 split has no
  row at all.** Also the row `id` equals the asset id, so it is not unique per action.
- `oraclePaused()` is advisory only; the feed may still return a value. Treat it as "price temporarily
  unavailable" but keep staleness as the primary guard.

**Consequence: never expect USDG to arrive from a dividend. Value holdings as Chainlink price (already
multiplier-adjusted) times raw balance. Subscribe to the on-chain event, not the API, to explain why a
position's value jumped. Pause a token when the oracle is paused or the feed is stale.**

---

## 5. Market sessions: the weekend staleness premise is confirmed

- Live `/assets` returns `tradingCapabilities` = {market, extended, overnight} x {whole, fractional},
  on all 194 assets. The published docs describe an older shape; the live API wins.
- Hours: regular 9:30 to 16:00 ET; extended 7:00 to 9:30 and 16:00 to 20:00 ET; overnight Sunday 20:00
  through Friday 20:00 ET, whole-share limit orders only, no market orders in extended or overnight.
- Authorised Participant mint and burn window is Monday 02:00 to Saturday 02:00 CET, and BBVI is the
  only AP. But "End users may still buy and sell Stock Tokens on-chain outside the tokenization window."
- **Chainlink feed metadata VERIFIED: `marketHours: "us_equities_24/5"`, heartbeat 86400 s, deviation
  0.5%.** Empirically the NVDA feed last updated Friday 2026-09-18 at 19:55 UTC and had not updated on
  Saturday when read.
- Robinhood publishes nothing about weekend token price behaviour. Claims that spreads widen on
  weekends come from news, not Robinhood.

**Consequence: gate orders by session using `tradingCapabilities` plus a US market clock. On weekends
the oracle is stale by design, so use a 24/5 calendar for the staleness check and label the price "last
close". Swaps still execute at market-maker prices.**

---

## 6. Funding from Nigeria: works, one step, cheap above $20

Relay VERIFIED: chain 4663 has `depositEnabled: true`, USDG has `supportsBridging: true`, and live
quotes today were one-step routes:

| From | To | Out | Cost | Time |
|---|---|---|---|---|
| 100 USDC on Base | USDG on 4663 | 99.829 | -0.17% | ~1 s |
| 100 USDC on Ethereum | USDG on 4663 | 99.830 | -0.17% | |
| 20 USDT on Arbitrum | USDG on 4663 | 19.907 | -0.45% | |
| 20 USDT on BNB Chain | USDG on 4663 | 19.889 | -0.54% | |
| 2 USDC on Base | USDG on 4663 | 1.932 | -3.4% | |
| 0.5 USDC on Base | USDG on 4663 | 0.433 | -13.3% | |
| 100 USDG on 4663 | USDC on Base | 99.836 | -0.16% | ~2 s |

No hard minimum, but fixed fees of roughly $0.06 to $0.17 make sub-$5 transfers pointless. Relay can
also deliver ETH for gas. USDG is issued natively on the chain by Paxos.

Practical Nigeria path: buy USDT or USDC locally or P2P, withdraw to Base or BNB Chain, then one Relay
step into USDG on 4663. No direct exchange withdrawal to Robinhood Chain was found. Robinhood Wallet
supports the chain natively and is in 120+ countries; MetaMask works by adding the network manually.

**Consequence: onboarding is a single Relay quote-and-execute. Set a sensible floor around $20.**

---

## 7. Robinhood's own agent safety UX (the bar to match)

VERIFIED from Robinhood's support and newsroom pages:

1. Dedicated Agentic account: "your agent only has access to the funds you deposit into that account".
2. Funding cap by construction: "Fund your account with an amount reserved for your agent's trades."
3. Per-trade push: "You'll get push notifications any time your agent makes a trade."
4. Real-time activity feed and P&L; all orders appear in Activity and in history.
5. Preview before action, with an explicit warning that auto-execute mode skips confirmation.
6. "Disconnect the agent at any time with the tap of a button" (executed trades cannot be undone).
7. Capability limits: long equities, options and crypto only; "it can't transfer, stake, or lend" crypto;
   margin borrowing not enabled.
8. Read-only scope for data: accounts, positions, balances, history, watchlists.
9. Desktop-only setup with agentic disclosures to accept.
10. Dispute trail: support can "review exactly what you asked the agent to do, see what it actually did".
11. State-level jurisdiction gating with a 45-day restore.

**Notably ABSENT from Robinhood's own product: per-trade or daily dollar caps, stop-losses, and circuit
breakers.** Robinhood also states it "does not control, supervise, monitor, recommend, or audit these
AI agents."

**Consequence: the on-chain mirror is a separate smart account funded with a capped amount, permissions
allowlisted to the vault, the router and a token set, with no transfer-out permission, a
simulate-and-preview step before every send, per-transaction notification plus an activity log built
from receipts, and a one-transaction revoke. The caps Robinhood lacks are ours to add.**
