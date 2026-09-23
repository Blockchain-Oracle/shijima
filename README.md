# Shijima しじま

**An AI agent that keeps your Stock Tokens on plan, around the clock, on Robinhood Chain.** Put in USDG, pick a
strategy (a basket of US stocks such as The 7 giants), and your agent keeps it on those weights through the nights
and weekends when New York is shut. It decides only *when* to move, inside limits your own account enforces on the
chain. You see your portfolio and every decision with its reasons, and Telegram tells you when it acts or needs you.
Every decision is fingerprinted on-chain so nobody can rewrite it later.

*Shijima* is the stillness of deep night: the hours when nothing moves and no one is watching. Those are the
hours this works.

Built for the SERV Hackathon Edition 01 (Mainnet & MCP track, and Open). It runs on Robinhood Chain mainnet, its
decisions and chat run on SERV Reasoning, and it lives on OpenServ as agent 4513 with an ERC-8004 identity.
The full manual is at `/docs` on the site.

**In dollars.** You put in $100 and pick The 7 giants. Your agent buys about $12 of each of the seven and keeps
$16 as cash, which earns interest in the Steakhouse USDG savings vault while it waits. If Nvidia jumps and its 12%
becomes 16%, the agent notices, decides when to sell some back to plan, and tells you why.

---

## What problem this solves

You hold Stock Tokens. The US market is shut for 65 of every 168 hours, and all weekend the price is not
anchored by anyone: market makers cannot create or redeem, so the pool drifts. Real money trades in those
hours. Nobody is watching yours.

A desk watches. It is not a trading bot and it does not predict prices. It keeps what you already chose to own
in the proportions you chose, and the only judgment it makes is whether *now* is an acceptable moment or
whether to wait for the market to reopen.

## How it works

You set a **mandate**: what to hold, in what proportions, and your limits. Say you put in $10,000 and choose
40% Nvidia, 30% an S&P 500 fund and 30% cash. The desk works toward $4,000, $3,000 and $3,000.

Every five minutes it looks; it wakes the model only when something moved:

| Step | Who does it |
|---|---|
| Read your account and value it on the pool's 30-minute average | code |
| Work out what has drifted past your tolerance, and whether the drift is worth the trading cost | **plain arithmetic, no AI** |
| Refuse outright: trading paused, price feed unavailable, price beyond the band, a token you did not allow | **code, before any model call** |
| Decide *when*: act now, act in part, wait for the reopen, or decline | SERV Reasoning, one question only |
| Check your limits again, repeating the exact sums the contract will do | **plain arithmetic. The model cannot get past it** |
| Refuse anything over your limits, and refuse to send your money anywhere but to you | **the contract, on-chain** |
| Write the decision down and fingerprint it on-chain | code |

The assistant never picks an asset, never sets a size, and never sends anything. It answers one question about
timing and gives its reasons. Everything else is arithmetic and a contract.

## What makes it different

- **Quiet is recorded honestly, not noisily.** The agent looks every five minutes but writes only what changed, and
  on a quiet day one line that it looked and found nothing to do, hashed into the same chain and sealed on-chain.
- **The record is checkable by a stranger.** Open any decision and press **Check it**: your own browser
  rebuilds the canonical bytes, hashes them with keccak256, asks the public RPC for the transaction and
  compares the two fingerprints. A record that did nothing has no transaction, so the browser walks the chain
  of records to the one that sealed it. Not our word, your machine.
- **It marks its own homework.** When the market reopens, each decision is graded against the one alternative
  it really had, at the price each would have got. Under 25 basis points it says "no real difference", because
  that is inside the cost of trading. It grades the timing call, not whether the market happened to go up.
- **The honest promise, exactly true:** the assistant cannot send your funds to anyone. A stolen operator key
  can only make bad trades, costing at most 8% of your daily limit in each 24-hour spending window, so at
  most twice that across a window boundary, until you remove it.

## It is running

| | |
|---|---|
| Chain | Robinhood Chain mainnet (4663) |
| Desk factory (v1) | [`0xB0Df8d1ca6eDA2700a2D145bab2675109A2e89f1`](https://robinhoodchain.blockscout.com/address/0xB0Df8d1ca6eDA2700a2D145bab2675109A2e89f1) |
| Desk implementation (v1, verified) | [`0x90ff69C78014d06e3f09DC0985E83Cd8338aFe0F`](https://robinhoodchain.blockscout.com/address/0x90ff69C78014d06e3f09DC0985E83Cd8338aFe0F) |
| The live desk | [`0xC61DDE99B72add803E47B1bcA17B4bf8819618B1`](https://robinhoodchain.blockscout.com/address/0xC61DDE99B72add803E47B1bcA17B4bf8819618B1) |
| OpenServ agent | `shijima` (4513), workflow "Hourly desk review" (13895) |
| ERC-8004 identity | Base, token [95396](https://www.8004scan.io/agents/base/95396) |

**Reach it from OpenServ.** Add Shijima to your own OpenServ workspace, make a link code in your desk's Settings
under Connections, and send `link CODE` to it there. From then on its chat and tasks answer for your desk, from
the same brain as the website and the Telegram bot. Anything that moves money comes back as a link to confirm.

The v0 contracts (factory `0x35A4…0958`, first desk `0x51ce…461D`) made the first real trades below and stay on
the chain as history.

Real transactions, all on mainnet:

- **First trade**, decided by SERV and sealed with its own decision fingerprint:
  [`0xba777e73…`](https://robinhoodchain.blockscout.com/tx/0xba777e7301184adb276376a27981e8afc7009d732679299f250bb21172765cdf)
- **A sale**, sized by the larger of the quote and the oracle value, exactly as the contract counts it:
  [`0x3211bdc1…`](https://robinhoodchain.blockscout.com/tx/0x3211bdc1617fa2e4835a936a2dc9b273b4c19fe48fa1d11b19456e6c7bf2bf21)
- **A limit holding, on purpose.** With the operator key, an over-cap buy was sent for real and
  [reverted](https://robinhoodchain.blockscout.com/tx/0x58bb2963585a850ca8f96c19ec44f5de7ce4209becc8d6d57f8948136b8d956f),
  and an operator withdrawal was sent for real and
  [reverted](https://robinhoodchain.blockscout.com/tx/0x96cad9fe012236fcf12e81d3695b310a40b9424b1705594e5adb75e68dd2ad59).

## The shape of it

```
contracts/        Desk.sol and DeskFactory.sol. One EIP-1167 clone per owner, no upgrade path, no admin.
packages/shared/  Canonical hashing, the frozen record schema, the market calendar, every user-facing word.
packages/chain/   Reads and operator writes. Quotes, feeds, the pool's 30-minute average, the close reference.
packages/db/      31 tables on Postgres. Records hash-chained under an advisory lock.
packages/core/    The engine: reconcile, value, find needs, refuse, decide, gate, act, record, grade.
apps/worker/      The clock, the operator key, and the OpenServ agent. The only thing that sends a transaction.
apps/web/         Next 16. Reads. It holds no key, so it cannot move money even if it is compromised.
docs/             Architecture, decisions, the design brief, the record format, and a full build log.
```

**Two rules the code is built around.** Money is a bigint in code and an exact decimal string in a record;
a float would not hash reproducibly, and a record that cannot be rehashed proves nothing. And the off-chain
limits check repeats the contract's own integer arithmetic, rounding included, so the desk never sends
something the chain will refuse.

## Running it

```bash
pnpm install && ./contracts/setup.sh
createdb desk_dev && createdb desk_test
cp .env.example .env            # Alchemy, Finnhub and SERV keys, and two dev wallets
pnpm db:migrate
pnpm desk:mandate --preset broad-market
pnpm worker:start               # the agent: watches every five minutes, seals daily
pnpm web:dev                    # the site, on port 3007
```

Anything that spends money can be rehearsed first on a local fork of mainnet, at no cost:

```bash
anvil --fork-url <your alchemy url> --silent
pnpm rehearsal:reset            # a throwaway database that matches the fork
RPC_URL=http://127.0.0.1:8545 pnpm desk:wake
```

`pnpm dev:prove-limits --send` asks the contract, with the real operator key, to break each of your limits.
It must refuse every time.

## Honest limits

- The contract is small, has no upgrade path and no admin, and it is **not audited**. Amounts are small.
- If a weekend price moves more than 8% from the last official update, the assistant's trades are refused by
  your desk contract by design. Only you can sell then. The record says so.
- One operator key serves every desk today. The contract already supports one key per desk.
- Stock Tokens are not shares. Holding one gives you no ownership and no shareholder rights.
- The desk claims no edge and predicts nothing. Weekend prices are a poor guide to Monday in either direction,
  and the product says so in its own words rather than hiding it.

MIT licensed.
