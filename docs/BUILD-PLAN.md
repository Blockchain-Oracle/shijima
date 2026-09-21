# Build plan: the Desk

Approved 2026-09-19. This is the schedule half of the approved plan. The design is in `ARCHITECTURE.md`.
Section numbers are kept from the original plan so cross references still work.

---

## Progress log

**Sat 19 Sep, evening.** Done: plan saved, decisions and brief updated, Abu's checklist written, `git init`,
pnpm monorepo scaffold (Biome, vitest, strict TypeScript), `shared/calendar` (17 tests: sessions, DST,
holiday, early close, market-time feed age), `shared/hashing` (frozen vector, cross-checked in Python and
Foundry), `chain` basics (addresses with a checksum guard test, ABIs, client), and the token list builder,
run against mainnet. 36 tests green, lint clean. Pulled forward from Sunday: the token list.
Not done because they need Abu's accounts: Railway and Neon hello-world, the five Sunday spikes.
Lessons: never hand-type a checksummed address (one bad address failed a whole multicall batch). This
network drops connections, so every outbound fetch retries with backoff.

**Sat 19 Sep, late.** Pulled forward from Sunday: `Desk.sol` and `DeskFactory.sol` written to the research
interface, plus 28 fork tests against live mainnet state (real router, pools, feeds and vault). Guards
covered: owner-only powers, per-action and daily caps, window reset, pinned pool (the empty NVDA 1% pool is
refused), oracle price floor under a whale push, dead and stale feeds, the weekend-stale feed still
trading, `oraclePaused` including a removed function, pause and revoke, withdraw in every state, vault
round trip, `batch` for one-confirmation exits, no ETH. Dependencies: OpenZeppelin 5.7.0 from its official
npm package, forge-std 1.16.2 as a pinned tarball with a verified checksum.
Lessons: the `forge-std` package on npm is a third-party upload from 2022, never install it. `forge init`
creates a nested git repo, remove it. Full git clones stall on this network, tarballs do not. Fork tests
time out on the public RPC here, so pin a fresh block to let Foundry cache storage across retries. An
Alchemy key will fix this properly.

**Sun 20 Sep, early.** All 28 fork tests pass against live mainnet state. The four that had timed out were
network failures, not contract defects: pinning a fresh block let Foundry cache storage across retries.
The whale test pushed the NVDA pool with as much USDG as it holds, the operator's buy was refused by the
oracle floor, and the owner's buy still went through. Abu supplied an Alchemy key, stored in a gitignored
`.env`. Robinhood Chain Mainnet still has to be enabled for that Alchemy app before it can be used.

**Sun 20 Sep, morning.** Alchemy key working. **Spike 4 is settled:** Alchemy is a full archive node on
4663. State reads work 60 million blocks back, near the chain's launch, and one `getLogs` call can span
the whole chain. Consequences: fork tests are pinned and cached (29 tests in 2.5 seconds, was 10 minutes),
the 16:00 ET reference can be recomputed from swap logs at any time, multiplier events backfill in one
call, and replay can read real on-chain state for past weekends. Run fork tests with
`pnpm --filter @desk/contracts test:fork`.
**A real finding from a failed test.** NVDA drifted from 3 bps above the frozen feed on Saturday afternoon
to 65 bps below it by Sunday 06:50 UTC. 100 USDG then bought tokens the feed valued at 100.66, and selling
them was refused against a 100 cap. The contract is right: sells count at the larger of USDG received and
oracle value. The test was wrong to assume a premium. It is fixed, and a deterministic discount-weekend
test was added. 29 fork tests pass.

**Sun 20 Sep, 07:00 UTC. Working mode changed by Abu: LOCAL FIRST.** We are not deploying yet. No Neon,
Railway or Vercel until Abu says so. Postgres is local (`desk_dev` and `desk_test` on the Homebrew
Postgres 16 already running). The worker will run locally. Wherever the schedule below says Railway or
Neon, read "local" until deploy time. Claude does everything it can itself and asks Abu only for identity
or money.
Set up in `.env` (gitignored, mode 600): Alchemy, Finnhub and SERV keys, both database URLs, and two dev
wallets generated with `cast wallet new`. Deployer and dev desk owner:
`0xB5D47f376c59c975F931000FAdD787abaEB91cf6`. Agent operator: `0x3d5d92b3661A5AD1808B68B2991318d0256059f6`.
Neither is funded yet. That is the one thing blocking a live contract deploy.
**Spike 3 settled: Finnhub weekend coverage is good.** Since the weekend began: NVDA 107 items, SPY 18,
QQQ 14, AAPL 12, all with timestamps and sources. One catch: the NVDA feed is full of loosely related
articles (a Tesla forecast, an AMD piece). The news module must keep only headlines that name the company
or ticker. **SERV key verified** with one call to `gpt-5.4-nano`. The rest of spike 1 is still to do:
strict schema plus `serv_*` tools plus `reasoning_effort`, shadow agent latency, content filter, raw mode.

**NEXT, in order, all local:** (1) `packages/db` schema and migrations on local Postgres. (2) Finish SERV
spike 1. (3) `packages/chain` reads: quotes on the pinned tier, feeds, 30 minute average, multiplier, vault,
desk state. (4) The walking skeleton `pnpm desk:skeleton`, first as a dry run on a mainnet fork (anvil via
Alchemy) so it needs no funding, then for real once the dev wallet is funded. (5) Engine breadth.

**Sun 20 Sep, 08:30 UTC. Full rehearsal passed on a local mainnet fork (anvil via Alchemy), at zero cost.**
Deploy, then `createDesk` with the real ten-token list (all ten passed the on-chain checks, 1.05M gas), fund
with 20 USDG by plain transfer, then the agent wallet bought $3 of NVDA with a decision hash, signed by the
real agent key. The agent's `withdraw` was refused (`NotOwner`). A $6 buy against the $5 cap was refused
(`OverPerActionCap`). The on-chain `head` equals `chainHead()` from `packages/shared`, so the contract and
the TypeScript agree on the record chain.
New tooling, all local: `pnpm dev:funds status|watch|bridge|split` (finds a deposit on Base, Arbitrum or BNB
Chain and bridges it with Relay: the first $3.50 as ETH for gas, the rest as USDG), `contracts/deploy.sh <label>`
(records addresses in `packages/chain/deployments.json`), `pnpm dev:desk create|fund|status`, and
`pnpm abis:build`. Set `RPC_URL` and `DEPLOYMENTS_FILE` to rehearse any of them on a fork. The desk script
prints LIVE or REHEARSAL so it is never ambiguous which chain a run touches.
Real costs at today's gas price: deploy about $0.40 to $1, `createDesk` about $0.30, a trade about $0.04. The
node wants about $2 of ETH up front for the deploy, so the ask to Abu is $10 of ETH on Base.
Lessons: a find-and-replace edit matched nothing after the formatter reflowed a line, and failed silently, so
edits must assert that they matched. Anvil's default gas price is about ten times the real chain's, so never
read costs off a fork.
**Waiting on:** Abu's deposit on Base to `0xB5D47f376c59c975F931000FAdD787abaEB91cf6`. The watcher bridges it
automatically. Then: `./contracts/deploy.sh v0`, `pnpm dev:desk create`, `pnpm dev:desk fund`.

**Sun 20 Sep, 14:40 UTC. MONDAY'S GATE REACHED A DAY EARLY: a real trade on mainnet with a verified hash.**
Abu sent about $10 of ETH on Base. `pnpm dev:funds bridge` moved it with Relay: $3.80 as ETH, 5.77 USDG.
- **Deployed v0** (`./contracts/deploy.sh v0`): factory `0x35A40883BAD8874F8fB5592c72c4385226070958`,
  Desk implementation `0x99a3f0DD497d60308F138f420902BbB2b6406565`. Both verified on Sourcify (`./contracts/verify.sh`).
  Blockscout's own API is behind a Cloudflare bot check, so scripts cannot use it. Addresses live in
  `packages/chain/deployments.json`.
- **Dev desk** `0x51ce92E1319918Fe3d46Ee0dF09af1a9FB14461D`, owner = dev wallet, operator = agent wallet, all ten
  tokens allowed, caps $5 per action and $15 per day, funded with 5.77 USDG. Deploy + create + fund cost $0.60.
- **`pnpm desk:skeleton`** (`apps/worker/src/cli/skeleton.ts`) runs the whole money path: read desk, evidence
  (session, gap, cost, halt flag from the REST API, oracle pause, Finnhub headlines filtered to ones naming the
  company, limits), SERV timing decision, our own checks on the answer, arithmetic gate, canonical record,
  write-ahead to `var/records`, on-chain action, then four verification checks. `--force` trades against SERV's
  answer as a RECORDED developer override. With no action it seals the non-action with `checkpoint`.
- **First real trade:** tx `0xba777e7301184adb276376a27981e8afc7009d732679299f250bb21172765cdf`. SERV said
  ACT_NOW at 74%, the desk bought $1 of NVDA. The event's `decisionHash` equals the record's hash. It was also
  rebuilt independently with Python `json.dumps(sort_keys=True)` plus `cast keccak` and read back from the
  receipt with `cast`: identical. The on-chain `head` equals `chainHead()`.
- **SERV spike 1, mostly settled** on `gpt-5.4-mini`: strict JSON schema + `serv_prompt_guard` +
  `serv_shadow_agent` + `reasoning_effort: low` work in ONE request, so the "tools need effort none" worry does
  not apply to SERV's own tools. Nullable enums work. Raw mode header works. Latency 6 to 10 s warm, **22 to
  33 s on the first calls with a new system prompt** (cache miss), about 3 s raw. Keep the timeout at 60 s.
  Still open: whether a shadow `exhausted` outcome is visible, the content filter against rule ids, where 429
  begins.
- New code: `shared/schemas/timing` (decision schema, wire conversion that strips bounds, checks that cited
  ids exist), `core/serv/client` (`servJson`), `core/serv/prompts/timing` (`timing.v1`, frozen by a hash test),
  `core/news/finnhub`, `chain/desk` (state, pinned quote, gap, buy, sell, checkpoint), `chain/rhj` (halt flag).
  58 TypeScript tests and 29 fork tests green. Lint and typecheck clean.
- **For `timing.v2`:** SERV called five generic headlines an explanation for a 73 bps gap. "Explains" must mean
  a material event, not the company merely being mentioned. NVDA drift today: -65 bps at 06:50, -73 bps at 15:00.
- Lessons: a regex escape written as backslash-u in a shell command becomes a literal control character, so use
  a Unicode class like `\p{Cc}`. Narrowing a union with `in` gave `unknown`, so use explicit variables.

~~**NEXT, all local:** (1) `packages/db` and the write-ahead. (2) Crash recovery.~~ Both done, see the next entry.

**Sun 20 Sep, 15:20 UTC. The database exists, the write-ahead lives in it, and crash recovery is PROVEN ON MAINNET.**
- **`packages/db`**: all 24 tables of `ARCHITECTURE.md` 1.7 in one migration (`packages/db/drizzle/0000_init.sql`),
  Drizzle 0.45.2 on local Postgres 16. Amounts are `numeric(78,0)` mapped to `bigint`, with `>= 0` checks because a
  JavaScript bigint goes negative silently. Addresses and hashes are stored lowercase with format checks. No foreign
  key cascades: nothing on the money path is ever deleted. **From now on migrations are additive only**, because
  `desk_dev` holds the real record of real trades. Never regenerate `0000`.
- **The record chain** (`db/queries/records.ts`): `seq` is gap free per desk and `prevHash` is INSIDE the hashed body,
  both given out under `pg_advisory_xact_lock(desk)`. So an on-chain hash commits to every earlier record, which is
  how non-actions get sealed. The row is read back and re-hashed in the same transaction before anything is signed.
  This `seq` is NOT the contract's `seq`: the contract counts on-chain actions only, and `desks.chain_seq` tracks it.
- **A rule found by a failing check:** a record body must name its `desk` and `chainId`, like an EIP-712 domain.
  Without that, two desks produced the same fingerprint. `appendRecord` now refuses a body that names another desk.
- **Send in steps** (`chain/send.ts`, `worker/sender.ts`): sign, SAVE hash and nonce, broadcast, save "sent", wait,
  settle. The signed bytes are never stored. Action states: planned, prepared, sent, then confirmed, reverted or
  never_landed. `planned` is new: it covers a crash between saving the record and signing.
- **The resolver** runs at the start of every command and before every send. A receipt settles an action. With no
  receipt, `worker/landing.ts` decides: past the contract deadline plus a 60 s margin for lagging RPC nodes means
  `never_landed`. While anything is still "waiting", nothing new is sent. `pnpm desk:resolve` runs it on its own.
- **Drills, first on a fork, then LIVE.** Kill after broadcast: the database held `sent`, the restart found the
  receipt and sealed the record. Kill before broadcast: "may still land", new sends refused, then `never_landed`
  once the chain clock passed the deadline, and the next run reused the nonce and landed.
  **Live on mainnet:** SERV said WAIT_REOPEN at 74%, so the desk did not trade and sealed the non-action. The process
  was killed right after broadcast. On restart the resolver found it in block 68039547 and sealed record 2. Checked
  with `cast`, not our code: the event's decision hash equals the stored fingerprint. Chain seq 2, database 2, nonce 2:
  one transaction, no duplicate. tx `0xa96b98f44bf41ca55af3cca476a77029e66fbc2ce7796b1b1e0dcab21f071ec8`.
- **Rehearsals have their own database.** A run with `RPC_URL` set uses `desk_rehearsal`, enforced by name. A
  resolver pointed at a fork while reading real records would find no receipt for a real hash and call it dead.
  New fork, then `pnpm rehearsal:reset`. Record 1 was imported from `var/records` with `pnpm records:import`, which
  re-checks each fingerprint against the mainnet event before it stores anything.
- **Two real findings from the drills.** (a) A broadcast the node rejects leaves the action `prepared` until its
  deadline. The common cause, an operator wallet short of gas money, is now checked BEFORE signing and refused at
  once as `refused:operator_low_gas`. On a fork, top the operator up with `anvil_setBalance`: anvil's gas price is
  about ten times the real one. (b) "OWNER RULES: none" made SERV cite a rule id of "none", which our check rejected.
  The line now says there are none and `ruleIds` must be empty.
- **FOR CONTRACT v1 (Tuesday):** `checkpoint`, `sweepToVault` and `redeemFromVault` have NO deadline, so for them
  `never_landed` rests on a five minute rule, not on a fact. Give every operator call a deadline.
- **Working rule from Abu, 20 Sep: tests are not a deliverable.** Prove a critical path by running it (fork, then a
  few live cents). At most one small check for money-path logic. The tests that exist stay. Do not add suites.
- New commands: `pnpm db:generate`, `pnpm db:migrate`, `pnpm desk:resolve`, `pnpm records:import [--rehearsal]`,
  `pnpm rehearsal:reset`, and `pnpm desk:skeleton --kill-after-send | --kill-before-send`.

~~**NEXT:** (3) Sell back, and prove the limits on mainnet.~~ Done, see the next entry.

**Sun 20 Sep, 15:35 UTC. MONDAY'S WHOLE LIST IS DONE ON MAINNET: sell, crash recovery, and the limits held by the chain.**
- **The skeleton's steps now live in `packages/core/wake`**, one file each: `market` (reads), `evidence` (the record's
  evidence and the model's message, built together), `decide` (SERV plus our own checks), `gate`, `plan`, `record`.
  `apps/worker/src/cli/skeleton.ts` only orders them. It takes `--side sell [--tokens n]`.
- **The gate repeats Desk.sol's integer maths**, rounding included: a sell counts the LARGER of USDG received and
  oracle value, and the operator's floor is 8% inside the feed. Checked against the contract itself, live: the gate
  said 0.444894 USDG would count, the `Sold` event's `countedUsdg` says 0.444894, and the daily limit fell by exactly
  that. The pool is below the frozen feed this weekend, so oracle value was the bigger number, as ARCHITECTURE warned.
- **"Blocked by a limit" now means the desk WANTED to act and a limit stopped it.** If the model says wait or
  decline, that is the outcome. The old skeleton could record "failed" and still trade under `--force`. Fixed.
- **Live, record 3: SERV DECLINED a full sale at 95%**, because the fixture mandate says to hold some Nvidia. Mandate
  fidelity, unprompted. Sealed: tx `0x1af88c26dd1f4c3990100b936a99b9e3af8886e0567c64f4c60bb30d939a775d`.
- **Live, record 4: sold 0.002 NVDA for 0.441676 USDG** as a recorded developer override (SERV said wait, 82%).
  tx `0x3211bdc1617fa2e4835a936a2dc9b273b4c19fe48fa1d11b19456e6c7bf2bf21`. All four checks pass. Gas about 4 cents.
- **The limits are held by the chain. `pnpm dev:prove-limits --send`, with the operator key, on mainnet:**
  over the per-action limit: REVERTED `OverPerActionCap`, tx `0x58bb2963585a850ca8f96c19ec44f5de7ce4209becc8d6d57f8948136b8d956f`.
  operator withdraw: REVERTED `NotOwner`, tx `0x96cad9fe012236fcf12e81d3695b310a40b9424b1705594e5adb75e68dd2ad59`.
  A token never allowed: `TokenNotConfigured`. Raising the limits: `NotOwner`. Afterwards the desk's cash, record
  and limits were unchanged. The daily limit is covered by the fork tests, not live: reaching it needs $15 of trades.
- **Two fixes from a failed rehearsal.** (a) A deadline taken from the latest block was already in the past on a
  quiet fork. `deadlineIn` now uses the LATER of the chain clock and the local clock. (b) A revert found during
  gas estimation arrives as raw bytes, so the log said "custom error 0x70f65caa". `revertName` now decodes it
  against the desk ABI: it was `DeadlinePassed`. A rehearsal also mines one block first, so the fork's clock is current.
- The dev desk now holds 5.209559 USDG and 0.002528 NVDA. The operator's nonce is 6. Records 1 to 4 are real
  weekend decisions, ready for Monday's grading: a buy that acted, a buy that waited, a sale declined, a part sold.

~~**NEXT:** (4) Engine breadth.~~ Done, see the next entry.

**Sun 20 Sep, 15:55 UTC. THE ENGINE RUNS. The dev desk has a real mandate and a worker checks it every hour, live.**
- **`wakeDesk`** (`core/wake/wake.ts`, `consider.ts`, `commit.ts`): reconcile, valuation, the loss limit, needs,
  then for each candidate: pre-gate, "already asked", a remembered decision, SERV, gate, and the mode. The first
  four end it with NO model call. `--dry` runs the same code and commits nothing. Record bodies are now version 1.
- **Valuation is on the pool's 30 minute average** (`chain/twap.ts`). The TickMath port was checked against all ten
  live pools: each computed ratio brackets the pool's own `slot0`, in both pool orientations, and MIN and MAX match.
- **`needs` is arithmetic.** A holding past its tolerance becomes a candidate sized to return it to target, cut to
  the per-action limit, never below $1. Sales first, because they free cash. A token the mandate dropped is sold.
- **Reconcile** explains balance changes the desk did not make (last snapshot plus our own confirmed trades), and
  moves the loss-limit baseline by them. Otherwise an owner withdrawing half would look like a 50% loss.
- **A record and its companions commit together.** `appendRecord` takes an `alongside` hook that runs in the same
  transaction: the remembered wait, the approval request, the outbox message. An "acted" message is only queued
  after the transaction really confirmed.
- **All three modes proven on a fork.** Shadow: two would-have records, then "nothing new" with no model call.
  Ask first: an approval with the exact amounts shown, expiring in an hour, then "still waiting for your answer".
  On its own: a real fork buy that sealed 19 of 21 records behind it, then Nvidia sat exactly on its 40% target.
  A mode change cancelled the pending approval and the remembered decisions, as the architecture requires.
- **LIVE: the dev desk has mandate v1** (Nvidia 40%, S&P 500 fund 30%, cash 30%, $5 per action, $15 a day), in
  SHADOW mode. Live record 5: would have bought Nvidia (SERV ACT_NOW 86%). Record 6: waited on the S&P fund
  (WAIT_REOPEN 84%). Both are remembered until Monday 14:00 UTC, half an hour after the open.
- **The worker is running** (`pnpm worker:start`, `apps/worker/src/index.ts`): a Postgres advisory leader lock, the
  boot resolver, a 15 s tick that runs the hour's check once per desk, and the daily seal (one checkpoint carries
  the newest record's hash, which commits to all before it). A second worker exits as `not_leader`. SIGTERM
  finishes the check in progress and releases the lock. **It is running against mainnet now, in shadow, spending nothing.**
- **Shadow remembers its would-haves.** A live desk would trade once and then have nothing to do. A shadow desk
  changes nothing, so without memory it would repeat the same would-have, model call and message every hour.
- **A finding for `timing.v2`:** with identical facts SERV answered ACT_NOW (88%) and then WAIT_REOPEN (87%) on the
  S&P fund, whose price was in line. Remembered waits stop that from flapping hourly, but the prompt needs a rule
  for "in line, on a weekend". It also needs a one-sentence headline field: `reasons[0]` is often not the main reason.
- New commands: `pnpm desk:mandate --preset|--targets|--show`, `pnpm desk:wake [--dry]`, `pnpm desk:mode <mode>`,
  `pnpm worker:start`. Not built yet: the on-chain pause on a second loss-limit breach (needs `pause` in
  `chain/send.ts`), vault sweeps and redeems, note rules, company-event windows, and approved-action execution.

~~**NEXT:** (5) `timing.v2` and the frozen record.~~ Done, see the next entry.

**Sun 20 Sep, 16:45 UTC. `timing.v2`, record version 1 FROZEN, contract v1 source ready. THEN ABU QUESTIONED THE CONCEPT.**
- **`timing.v2`** (`core/serv/prompts/timing.ts`, v1 kept byte for byte beside it): a rule for "in line on an
  unanchored weekend" (wait for the reopen), what "news explains a gap" means (a material event, not a mention), an
  empty `ruleIds` when the owner has no rules, and a `headline` sentence used as the record's summary. Three runs
  with identical facts now give the same answer (88 to 96%). Under v1 they flipped. The model still leaks the code
  name WAIT_REOPEN into the headline, so `plainHeadline` turns it into plain words in the DISPLAY copy only.
- **Record version 1 is frozen**: `shared/schemas/record.ts` (strict zod) and `docs/RECORD-SCHEMA.md`. `appendRecord`
  refuses a version 1 body that does not match, before it is hashed. All 19 stored version 1 records conform.
- **Contract v1 is SOURCE ONLY, NOT DEPLOYED.** `checkpoint`, `sweepToVault` and `redeemFromVault` now take a
  `uint40 deadline`. 30 fork tests pass. The exact v0 source that is on-chain is kept in `contracts/deployed/v0/`.
  **Do NOT run `pnpm abis:build` yet:** the live worker drives the v0 desk, whose `checkpoint` has no deadline, and
  the TypeScript ABI must match it. When v1 deploys: rebuild ABIs, add the deadline in `chain/send.ts`, create a v1
  dev desk, move the funds, and mark the v0 desk row `closed`. Still owed before deploying v1: a security review
  pass on `Desk.sol` and the interface-freeze checklist. The operator's `pause()` has no deadline on purpose: the
  owner must be able to call it from the explorer with no arguments.
- **OpenServ agent: blocked on Abu, on purpose.** Registering it is free, but it creates an identity on their
  platform and judges will look for it under Abu's organisation, so which account owns it is his call. It also
  needs a public HTTPS address, which is deploy time. Ask him once for an OpenServ user API key.
- **The live worker may still be running** in shadow mode (it was started from a Claude session and may have died
  with it). Start it with `pnpm worker:start`. Only one can run: a second exits as `not_leader`.

**RESOLVED, 16:55 UTC: Abu confirmed the concept.** At 16:40 he read a plain summary and did not recognise "you
decide what to own" or "target". A $10,000 example settled it: put in $10,000, say 40% Nvidia, 30% S&P fund, 30%
dollars, and the goal is $4,000, $3,000 and $3,000. The desk closes the gap in steps and the AI only picks the
moment. His reply: "if that's the plan, then it makes sense to me", then "continue doing your thing". He also asked
for a review of the work so far against the plan documents in this repo, the pivot in `DECISIONS.md` included.
Lesson: a call recorded in a doc is not a picture in his head. Explain with dollars, and say "digital dollars"
before "USDG".

**Sun 20 Sep, 17:30 UTC. REVIEW against the plan documents, at Abu's request. What it found, and what was fixed.**
- **Built: 24 of the 47 modules in ARCHITECTURE section 2.** The whole money path and the engine core. Not built:
  approved-action execution, the jobs (grading, reports, promotion, fee, syncs), note rules, company events, vault
  sweeps, `shared/copy` and banned words, Telegram, the OpenServ agent, the web app, README and licence.
- **THE FINDING THAT MATTERED: the gap was measured against the wrong price.** DECISIONS ("four things", item 3)
  says the reference is OUR snapshot of the pool at the 16:00 New York close. The engine used the Chainlink feed.
  Measured across all ten tokens: the feed sat between -25 and +22 bps from where the pools really closed, and the
  S&P fund's feed was last set before Friday's open. The old gap also came from the execution quote, so the fee was
  counted as discount. Nvidia's "63 bps below" was really 40 bps below its close: IN LINE. With the honest number
  SERV says wait for the reopen, not act now. Records 1 and 5 were made on the stale picture.
  Fixed: `chain/logs.ts` finds the last swap at or before the close (binary search for the block, then swap logs),
  cached in `reference_snapshots` through `wake/reference.ts`. `wake/market.ts` now keeps three prices apart: pool
  (spot and 30 minute average), reference (last regular close, or the feed while the market is open), and the feed,
  which stays what the CONTRACT enforces. Cost is measured for the exact trade (5 bps for $2 of Nvidia).
- **Record version 2**, beside version 1, because the `price` and `cost` evidence changed shape. Versions are append
  only: `checkRecord` validates a body against the version it claims. Lesson: I froze version 1 before reviewing.
- **`timing.v2` reworded before any live use**: the reference is the pool's price at the last close, the last
  official update is only the contract's safety band and "never a bargain or a warning on its own".
- **New refusals, tighter than the chain:** more than 3% from the reference in either direction ("a broken reading,
  not a bargain"), a trade costing more than 1% against the pool price, a price more than 1% from its own half hour
  average (`PRICE_MOVING_FAST`), the owner's largest-holding limit, a token not allowed on-chain, a desk pinned to
  a different pool than ours (`POOL_MISMATCH`), and the same trade repeated within ten minutes.
- **Safety gaps closed:** the desk's state is read AGAIN after the model call and before acting, because the owner
  may have paused in those twenty seconds. `pauseDesk` and `resumeDesk` exist, and a pause cancels pending approvals
  and remembered decisions. A desk must be an EIP-1167 clone of its own version's implementation or the engine
  refuses it. Live reads fall back to the official RPC. A correction cut to the per-action limit is "acted in part".
- **SERV CREDIT IS NEARLY GONE: about $0.23 left.** Calls were refused with 402 because SERV reserves the maximum a
  call could cost, and with no reply cap that was $0.25. `max_completion_tokens: 2000` fixed the reserve. A call
  really costs about a cent. **Abu needs to top up SERV credits.** Be sparing with `--dry` runs: each asks the model.
- `pnpm rehearsal:reset` now makes the rehearsal database a COPY of the live one (pg_dump), because a fresh fork
  already contains every real trade. New: `pnpm desk:pause`, `pnpm desk:resume`.
- Two independent reviewers (security of the contract and money path, correctness of the engine) were started. Their
  findings and the fixes go in the next entry.

**Sun 20 Sep, 18:00 UTC. Review fixes, the approval path, and one real secret leak closed.**
- **A SECRET LEAK, found and proven.** viem puts the whole failing request into its error message, and our RPC
  URL carries the Alchemy key in its path. Those messages are printed by every command, logged by the worker, and
  STORED in `wakes.error` and `actions.failure_detail`. Forced a real failure: the raw message contained the key.
  Fixed in `shared/redact.ts`: registered secrets are blanked by exact match, plus patterns for a key in a URL
  path, a password in a connection string, and a key in a query parameter. Every print, log and stored error now
  goes through `errorText`. Proven after the fix: key gone, database password gone, **and a record fingerprint
  still prints**, which matters because a private key and a fingerprint are the same shape. 32-byte hex is never
  blanked by pattern for exactly that reason.
- **A crash used to skip an hour for ever.** A check is keyed on its hour, so a wake left `running` by a killed
  process blocked that hour permanently. There was already one in the live database. The worker now sweeps
  interrupted checks on boot and the record says the check did not finish.
- **One unreadable price no longer fails the whole check.** A pool that cannot answer takes that one token out:
  it is not valued, not traded, and named in the log. Two consequences that mattered more than the fix: the
  LOSS LIMIT is not evaluated while anything is unpriced (a missing price would look like a loss and stop the
  desk), and an unpriced token is never a candidate.
- **Every sentence the engine writes now lives in `shared/copy/engine.ts`**, with `shared/banned-words.ts`. All 56
  of them pass the banned-word rule. The rule is now in two halves, after it threw away a sound decision over the
  word "signal": HARD words (a promise of gain, "tokenized stocks", "last close") make an answer unusable, and
  STYLE words are recorded in `styleWordsUsed` and cost nothing. Losing a judgment over a word costs the owner more.
- **The approval path is complete.** `wake/approved.ts` carries out what the owner approved: a fresh quote, the
  whole rule set again, and NO model call. It acts only if the price is still within 50 bps of what was shown,
  otherwise the record says "approved, conditions changed, not executed". Record version 2 widened for
  `kind: 'execution'` and `approvalOf`. Widening is always allowed, because every old record still parses.
  `answerApproval` is the one guarded update the website and Telegram will both use. New: `pnpm desk:approvals`,
  `pnpm desk:approve`, `pnpm desk:reject`, and `pnpm desk:wake --force` (a recorded developer override).
- **Proven on the fork, end to end:** the desk asked, the owner approved, and the next check re-read the price and
  went ahead. The execution record names the request, why it asked, who answered, when, where, and that the price
  had not moved. Two bugs fell out of it. A forced override used to fire when the model gave NO answer, so the desk
  "asked" with an error message as its reason; an override may only overrule an answer. And the record's row and
  body could disagree about what kind it was, which the database now refuses outright.
- **The frozen record shape caught my own mistake**: a new outcome existed in the engine but not the schema, and
  the write was refused before anything was hashed. That is the check doing exactly its job.
- SERV credits ran out mid-session and Abu topped them up. Confirmed working. One thing learned: SERV REQUIRES a
  system message, and it reserves the maximum a call could cost, so `max_completion_tokens` must always be set.

**Mon 21 Sep, 02:20 UTC. The judge-facing website exists and shows the real desk.**
- The worker ran unattended all night: 15 checks, 28 records, and the only "failed" one is the interrupted
  check its own boot sweep marked. Hour after hour it correctly made NO model call, because the remembered
  decisions from Sunday still stood, and recorded that honestly.
- **`apps/web`** on Next 16.3.5, React 19.3, Tailwind 4.3, reading Postgres directly through server components.
  It NEVER signs, sends or calls a provider, and it is given only `DATABASE_URL` in its own `.env.local`, so a
  compromised website cannot move money because it holds no key. Pages: the home page, the read-only desk
  (8.19), every decision with quiet runs folded into one openable line (8.10), one decision in full (8.11) and
  the published rules with the escape hatch (8.21, 8.22). Port 3007, because 3000 is taken on this machine.
- **`packages/db/queries/public.ts`** is the whitelisted projection. It names every column, so `decisions.private`,
  which holds headline text our news licence forbids us to pass on, cannot reach a public page by accident.
- **"Check it" works in the reader's own browser**: it rebuilds the canonical bytes, hashes them with keccak256
  and compares against the record and the on-chain fingerprint. It also downloads the exact bytes and can show
  them. Nothing is sent anywhere.
- **A real design problem, solved:** 22 consecutive quiet checks now fold into "22 checks, nothing new, Sun 16:51
  to Mon 02:08", openable. They are never hidden, because they are the proof the desk was awake.
- **`shared/schemas/record-view.ts` reads a record of ANY version.** The first attempt rendered version 1 records
  half blank, saying "no model was asked" when one was. Version 0, the skeleton's never-frozen shape, is now
  described rather than prescribed, so the two real mainnet trades recorded in it stay readable for ever. Where an
  old version recorded less, the page SAYS so: version 1's cost reads "measured at a standard size, not this trade".
- A developer override now shows on the decision page in plain words, so a forced trade can never read as the
  assistant's own judgment.
- New: `pnpm web:dev`, `pnpm desk:share <slug>`. `@desk/db` no longer exports the migrator from its index: a
  bundled web app cannot resolve the filesystem path it needs. Use `@desk/db/migrate` and `@desk/db/admin`.

**Mon 21 Sep, 01:40 UTC. Grading, wallet sign-in, and the OpenServ agent, written and waiting on one key.**
- **Grading exists** (`core/jobs/grade.ts`, `grade-at-reopen.ts`). It grades the TIMING CALL, never profit: each
  decision against the one alternative it really had, at the price each would have got, using the SAME pool the
  desk trades in, half an hour after the bell. Under 25 bps is "no real difference", because that is inside the
  cost of trading. Checked against eight hand-worked cases, both sides, both directions. It correctly reports
  that the last settled reopen is Friday's, so today's weekend decisions grade automatically after 13:30 UTC.
  The worker runs it every tick. `pnpm desk:grade` runs it by hand.
- **Wallet sign-in** on the web: wagmi 3.7.7 with the injected connector only, no wallet kit and no third-party
  modal, plus Sign-In With Ethereum verified through a chain client so a smart-account wallet works too. The
  nonce is issued by us, spent once, and the message is pinned to this host and this chain. iron-session holds
  the cookie, so there is no session table to steal.
- **The OpenServ agent is written** (`worker/openserv/`). `doTask` is overridden, so the platform's own model
  never picks what this desk does: it runs `reviewAllDesks`, the very same function the worker's timer calls.
  The tick loop was refactored into `worker/review.ts` for exactly that reason, so the platform is the clock and
  the timer is the safety net, and whichever reaches an hour first does the work because a check is keyed on its
  hour. If the platform is unreachable the desk carries on regardless, and says so.
  **Two things the research had wrong or open, settled by reading the packages:** the SDK now accepts zod 4
  (`^3.22.4 || ^4.0.0`), so that spike is closed; and `endpointUrl` is OPTIONAL, because the SDK routes through
  OpenServ's own proxy, so registering does NOT require a public URL or a deploy.
- **REGISTERED AND CONNECTED, 01:43 UTC.** Abu supplied his OpenServ user API key. `pnpm openserv:provision`
  created **agent 4513 `after-hours-desk`** and **workflow 13895 "Hourly desk review"** with an hourly UTC cron
  trigger, under his account. The worker now starts the agent on boot and the log reads "Tunnel connected".
  **No public URL and no deploy were needed**, because the SDK routes through OpenServ's own proxy.
  Two things to know: the SDK PRINTS the new agent's API key and auth token to the terminal when it registers,
  so they are in the scrollback as well as in the gitignored `apps/worker/.openserv.json`, which is now mode 600;
  and the worker reads those credentials back from that file at boot and registers them as secrets first, so a
  platform error can never carry them into a log or the database. Still needed from Abu: a Telegram bot token.
- **THE REPO HAS NO COMMITS AT ALL.** Everything is uncommitted after three days. Nothing may be committed
  without Abu asking, so this is flagged rather than done.

**Mon 21 Sep, 01:50 UTC. README, the weekend report, and the owner's own page.**
- **`README.md` and `LICENSE`** (MIT), with the real mainnet addresses, the first trade, the sale, and the two
  transactions that were sent ON PURPOSE to be reverted by the contract's own limits. It was run through the
  product's own banned-word check, which caught "profit" in the sentence "it grades the timing call, never the
  profit" and got reworded. The rule is blunt on purpose, so the copy bends rather than the rule.
- **The weekend report** (`core/jobs/report.ts`, `/desk/[slug]/report`). One report per stretch of the market
  being shut, from a close to the next open. The summary counts what it counts: today it reads "17 decisions.
  17 cannot be graded yet. 11 other checks found nothing to do." A decision that cannot be graded says so
  rather than being left out, because leaving it out would flatter the desk.
- **The owner's own page** (`/desks`): every desk this wallet owns, what is waiting for an answer, Approve and
  Reject, and Pause. Every server action re-checks ownership against the SIGNED-IN session before touching a
  row, and checks that the request really belongs to that desk, so an id in a form field proves nothing.
  Answering still moves nothing: the worker re-reads the price on its next check and acts only if it is close.

**Mon 21 Sep, 01:55 UTC. A stranger can now open a desk from the browser.**
- **`/start`**: the disclosure, one wallet confirmation to create the account, then the split. `createDesk`
  sets `owner = msg.sender` in the contract itself, so a desk can never be created belonging to someone else.
  The form starts from a preset, shows the total as it is typed, and refuses to submit until it adds to 100%.
  The desk starts in PRACTICE mode whatever is chosen, so the first thing anyone sees it do costs nothing.
- **The server trusts nothing from the browser.** `registerDeskAction` reads the address back from the chain
  and refuses it unless it is a real EIP-1167 clone of OUR implementation, owned by the signed-in wallet, with
  OUR operator set. The site is given the operator's public address for that, and still no key of any kind.
- **An honest gap, stated on the page:** bringing money in from another network inside the page is not built.
  Until it is, the page says plainly to send USDG to the desk's address, or to use Relay's own bridge, and
  says that this step is not built yet rather than pretending.
- Everything green: lint, typecheck and the 92 existing checks.

**Mon 21 Sep, 02:06 UTC. THE OPENSERV LOOP IS CLOSED AND WORKING END TO END.**
- Trigger, proxy, our agent, our engine, and back. Verified twice with `pnpm openserv:fire`, which asks the
  platform to run the workflow now instead of waiting for the hour. Zero failures after the fix below.
- **The timer now holds back for 7 minutes**, as `ARCHITECTURE` 1.3 always said it should. It was running every
  15 seconds and winning every race by a few seconds, which quietly made the platform trigger redundant AND
  untested. OpenServ's cron is the primary clock; the timer only steps in when a check is overdue.
- **A REAL SDK BUG, found by running it.** `completeTask` in SDK 2.4.1 sends `output` as a string. The platform
  now answers `400 VALIDATION_ERROR: outputOptionId: Required, output: Expected object, received string`. So
  the desk does not use `completeTask`: it adds the summary with `addLogToTask` and sets the status to `done`,
  both of which work today, and the task carries the same record either way.
  It was only findable because the agent now unwraps the platform's response body: "Request failed with status
  code 400" on its own says nothing at all.
- The research's claim that a public `endpointUrl` is required was also wrong. It is optional, the SDK routes
  through OpenServ's proxy, and **no deploy was needed to get the agent running**.
- New: `pnpm openserv:fire`. The worker starts the agent on boot and carries on regardless if the platform is
  unreachable, which is what the timer is for.

**Mon 21 Sep, 02:30 UTC. The correctness review's findings were recovered, and ten of twelve are fixed.**
The reviewer that hit its usage limit had saved its findings to its own memory before dying. They were found
while committing. Ten were real and are now fixed:
- **Two senders on one key.** `desk:wake`, `desk:skeleton` and `desk:resolve` could trade while the worker was
  running. They now take the same Postgres lock the worker holds and refuse with an explanation. Proven: a
  command run against the live worker is turned away.
- **A stuck transaction could be queued behind rather than replaced.** The nonce is now pinned to the MINED
  count, not the pending one, so the next send reuses a stuck nonce. That is also what makes "it never landed"
  safe to act on, which the landing rule already claimed.
- **The loss limit could fire on the owner's own withdrawal.** The baseline was additive: taking money out
  while down made the remaining loss look bigger, and taking it out after gains could clamp the baseline to
  zero and switch the limit off. It now SCALES, so a deposit or withdrawal leaves the loss exactly where it
  was. Checked across five cases. An emptied desk gets a baseline of nothing, which is right, and a later
  deposit sets a fresh one.
- **A withdrawal we could not price read as a loss.** Changes now carry whether they were priced, and the loss
  limit is not judged at all while anything is unpriced.
- **A cap-sized sell could be impossible.** Sells were sized on the pool's average, but the contract counts
  them at the larger of USDG received and oracle value, so whenever the oracle sat above the average a sell
  sized to the cap was refused on-chain. Sells now carry 200 bps of headroom against the higher of the two.
  Checked with the oracle above, level and below: $4.90 against a $5.00 cap in all three.
- Also: a refused daily seal no longer makes a new row every 15 seconds; the baseline, the event and the
  snapshot now commit in one transaction, so a crash cannot count one deposit twice; one candidate's read
  error no longer drops the others; the mandate's own caps now bind off-chain over a rolling 24 hours; and
  the fallback reference no longer claims the market is open when it is not.
- **Still open, both small:** `insideBand` is computed and unused, and buys ignore the cash target, which is
  mostly redundant since cash and the token weights sum to 100%.
- `.claude/` is now gitignored: it is Claude Code's own working state, not part of the product.

**Mon 21 Sep, 03:35 UTC. The product has a name, and a voice. Both are live.**
- **Named Shijima (しじま)**, the stillness of deep night. Abu chose it by registering @ShijimaBot. The README,
  the site, the brief and the decisions doc all carry it, and the OpenServ agent was RENAMED IN PLACE, so it is
  still agent 4513 and no duplicate appeared. Proven twice now, since it was briefly Bantō in between.
  Three earlier candidates and why each was set aside are kept in `DECISIONS.md` so the ground is not covered
  twice. One was dropped for a reason worth remembering: *Maai* was perfect in meaning, but MAI is a well-known
  stablecoin and the two would be confused constantly.
- **The Telegram bot is running**: @ShijimaBot, connected, long polling, inside the worker. It has the whole of
  brief section 9. Every word it says lives in `shared/copy/telegram.ts` and passes the banned-word rule.
  - **One pinned message, edited in place, that never notifies.** This is the point of the design: an hourly
    desk would otherwise send about 160 messages a week, and a muted desk is a useless one. A new message is
    sent only when something needs the owner or has really happened.
  - **Approve and Reject are buttons.** Pressing one flips the same guarded row the website flips, and moves
    nothing: the worker re-reads the price on its next check. A press is checked against the Telegram user id
    and the desk it is linked to, so a forwarded message or a guessed approval id gets nothing.
  - Answering on the website edits the Telegram message too, so the owner is never left looking at live
    buttons for something already decided.
  - Private chats only. A desk in a group would announce one person's money to a room.
  - Linking is a one-time code that dies in ten minutes: `pnpm desk:link`.
  - **Without a token the desk runs exactly as before, with no voice.** Telegram is how the owner hears about
    it, never how anything is decided, so it can never stop the desk working.
- **VERIFIED in a real chat.** Abu linked it, got the first contact, ran /help and /status. Three things the
  live run showed, all fixed:
  - The copy had hard line breaks mid-sentence, because the source was wrapped for reading and Telegram
    renders those literally. Sentences now break where sentences end.
  - `/status` said "it has not checked yet" to a desk that had checked thirty times. The cause was real: the
    status messages queued before the chat existed were correctly marked skipped, so the pinned message would
    not have appeared for another hour. Linking now pins it immediately.
  - The pinned message was being written at DECIDE time and sent later, so it could carry a sentence that was
    true an hour earlier. It is now built from the desk's current state at SEND time, by one builder shared by
    the check, the link and /status, so the three can never disagree.
  The pinned message now reads: "Practice · active / Last check 08:03. Still waiting for the market to reopen
  (decided 15:49 UTC). / Nvidia in line. / Value $5.78. Cash $5.21. / Spent today $1.44 of $15.00. / Next check
  09:00. The US market reopens Mon 09:30 New York." Snapshots taken before the price gap was recorded fall back
  to showing the value instead, which is the honest thing to do rather than inventing a comparison.

**Mon 21 Sep, afternoon. THE DESIGN IS DECIDED: GLIDER. Research only, no code changed.**
- Abu rejected a survey of eight products and chose **Glider (glider.fi)** as the only reference, to be followed
  with the `reference-product-fidelity` method. It is automated portfolios with themed strategies, and it already
  holds tokenised US stocks. Firecrawl captured its public pages, and Chrome captured everything signed in with
  Abu's account, including the full onboarding, dashboard, deposit and withdraw. Abu approved pressing
  Initialize, so an empty Mag7 portfolio now exists in his Glider account. No money was moved.
- **Glider is shadcn + Tailwind**, so its exact palette, light and dark, is saved in `research/glider/tokens.json`
  and becomes our theme. **Font: Inter Tight**, chosen against a real Glider screen.
- **Glider lists Robinhood Chain as a supported chain.** What it lacks is the timing judgment, the record and an
  assistant that explains.
- Abu's exclusions: referrals, points, rewards, and the trading side. Withdraw must always exist. Add a chat.
- **Privy compiles with our wagmi 3.7.7** and shares its context (a throwaway spike). The sign-in choice is left
  open for plan mode.
- **Everything is in `docs/FIDELITY.md`**: routes, every screen, the brief conflicts and how each is settled,
  what is excluded or blocked, and the pending work. It was audited by script against all 22 brief screens, all
  20 awkward states and every Glider surface. **NEXT: plan mode with Abu, covering this and the pending work together.**

**Mon 21 Sep, evening. DESIGN MOVED TO MASAYUME; THE PRODUCT IS CHAT-FIRST. Research only, no code changed.**
- Abu preferred **Masayume**, his own Somnia app, over Glider. The port starts from **Agari** (`agari-wt/w1`),
  which already moved Masayume onto US stocks. Work came from code and existing docs, not screenshots.
  `docs/FIDELITY.md` is rewritten: every Masayume surface is classified, all betting is excluded, and the brief
  and all 20 awkward states are covered (audited by script).
- **Direction:** you talk to your AI and it gets things done. A **strategy is a basket of stocks**. The chat
  proposes; the owner confirms on a card; the saved proposal runs through existing guarded paths, or through the
  owner's wallet for anything touching their money. Trades still come only from the worker through `gate()`.
- **Found:** mandate **notes never reach the model**. Masayume's Sensei **cannot call tools**, so the acting chat
  is new code. The Mag Seven preset does not exist yet.
- **Tracks:** we qualify for Mainnet & MCP (no MCP needed) and Open. **The Typeforms were swapped in our docs:
  submit on A475N331.** Arbitrum buildathon: register on HackQuest by 2 Oct.
- **Coinbase:** not now for keys, sign-in or x402. The AgentKit track is an open trade-off.
- Research: `research/2026-09-21-{masayume-port-map,chat-actions,tracks,coinbase-agent-wallet}.md`.
- **Plan approved the same night** (`~/.claude/plans/typed-enchanting-simon.md`): 12 steps in dependency order,
  with the money path first on the anvil fork. Two reviews against the code shaped it. They found:
  - an owner's sell halts the next check;
  - checks are keyed by the hour;
  - the override path is new code;
  - vault sweeps were never built.

  Building now.

**Mon 21 Sep, 14:45 UTC. STEPS 2 TO 5 BUILT: THE SESSION KEY, THE ENGINE FIXES, THE PRICE LOG AND THE CHAT.**
All proven on the anvil fork. Nothing is deployed to mainnet yet.
- **Desk v1 with the session grant.** It passes 41 fork tests. `prove-limits` holds all 6 session cases,
  `batch` included. v0 stays live on mainnet until Abu says go.
- **Engine fixes:**
  - owner and session sells are absorbed as `owner_action` events, instead of halting the next check;
  - check now runs at the request's own time and does not count as a practice check;
  - going live needs 24 checks **and** the report opened, enforced in code;
  - notes reach the model as r1, r2 and so on, and are kept out of the public record;
  - The Mag Seven and AI Builders presets;
  - the Timing sum.
- **Price log:** one row per Stock Token every 5 minutes, using the engine's own reference. A 30-day backfill is
  running.
- **The chat core** (`packages/core/src/ask/`). The worker answers from a Postgres row: LISTEN plus a 1-second
  sweep, with SKIP LOCKED claims. It makes one SERV call on a strict schema. Plain code checks the proposal, and
  it is saved with a 10-minute expiry. Confirming runs only the saved arguments. Proven on the fork:
  - "Move me into AI Builders" gave a before-and-after card; confirming applied mandate v3 with the desk's
    read-back, and a second tap was refused;
  - "buy Alphabet now anyway" gave a card with a fresh quote. Confirming ended the wait, and the worker bought on
    the fork within the 0.5% rule, recorded as `ACTED_BY_OVERRIDE` with `override: by owner`;
  - pause, resume and check now work. A $5,000 withdraw, a 90% weight, an override in practice, and going live at
    3 checks are each refused in words.
- **Telegram:** free text now uses the same chat, with Confirm buttons. `pnpm desk:ask` talks to the dev desk.
- **Web:** `POST /api/ask` and `GET /api/ask/[id]` (401 when signed out, 403 for someone else's desk), plus
  `confirmProposalAction`.
- **Decided:** a strategy change is drafted as the saved proposal, not as a `draft` mandate row. One call does
  both jobs: the chat's reply is the read-back, and it is saved on confirm.
- **Blocker: SERV credit is $0.02.** Every hourly check fails with FAILED_NO_DECISION, and the chat can no longer
  answer. Abu tops it up. Calls were already made cheaper: the chat reserves $0.03 a call, not $0.07.
- **Next:** step 6, Masayume's look (foundation). Vault sweeps are still owed from step 3.

**Mon 21 Sep, evening. STEPS 6 AND 7 BUILT: MASAYUME'S LOOK, AND THE DESK PAGE WITH THE CHAT FIRST.**
- **The look:** Yosuku's styles copied verbatim, plus Agari's sheets for the surfaces we keep. The shell is Agari's:
  - the ticker, fed by our price log and showing the US session;
  - the header with four destinations, the session chip, the theme, the money pill and the account menu;
  - the phone's pill nav and drawer;
  - the wrong-network banner.

  Also: the Base UI primitives, the `Reading<T>` states, and every word in `shared/copy/web.ts`. A real
  `/markets` page reads the price log. Checked at 390, 768, 1024 and 1440 in both themes: no sideways scroll and
  no console errors.
- **The desk page:** `/` sends each person where they belong. An owner lands on the desk with the chat first: the
  thread, the typewriter, cited records, a price chart when an answer is about one stock, and the proposal card.
  Beside it:
  - needs you;
  - what it holds;
  - next check and practice progress;
  - holdings against targets;
  - the value chart with decisions marked;
  - limits, the mandate and the fee line;
  - the record, with quiet runs folded.

  On a phone these are tabs. A visitor with the share link sees the desk read-only.
- **The session key:** made in the browser, granted by the owner's wallet for up to seven days, and funded for its
  own fees. It confirms withdraw and remove-the-assistant in one click. The server builds the one transaction and
  marks the card done only after reading the receipt from the chain. **Proven on the fork in Chrome:** a $2
  withdraw sent by the key moved the owner from $10.00 to $12.00.
- `next dev` writes a CLAUDE.md when it detects an agent. The dev server is started without those environment
  variables, so it no longer does.
- **Next:** step 8, the owner controls and settings.

## 6. Schedule

| Day | Work | Must be true by end of day |
|---|---|---|
| **Sat 19** | Pre-register (Typeform A475N331). Register for Arbitrum Open House. **Ask in the OpenServ Telegram whether a Robinhood Chain build with no MCP qualifies for the "Mainnet & MCP" track.** Accounts and keys. `git init`, scaffold, Railway and Neon hello-world on a public URL. Doc updates from section 9. | Worker URL answers |
| **Sun 20** | Spikes, listed below. Token builder. Price logger. Desk v0 deployed, canary desk funded $20. | `tokens.json` exists. Logger is writing |
| **Mon 21** | **Walking skeleton `pnpm desk:skeleton` on mainnet:** fixture mandate, read desk, quote, real SERV call, cap-only gate, hash, write-ahead, real $5 `Desk.buy`, assert event hash equals recomputed hash, sell back, rerun with `--kill-after-send`, prove over-cap and operator withdraw revert. Freeze record schema v1 and rule templates. Harden the contract in parallel. | **A real trade with a verified hash** |
| **Tue 22** | Interface freeze, reviews, deploy v1, showcase desk by script. Engine breadth: needs, gate, deferrals, valuation, calendar, news. Worker live with leader lock and cron. | **Showcase desk in Shadow tonight** |
| **Wed 23** | Telegram, approvals, grading, shadow report. First Ask-first live trade on the canary. **Judge-facing pages first:** read-only desk, record, decision page, "Check it". States gallery. | Public desk URL shows real records |
| **Thu 24** | Sign-in, disclosure, onboarding, mandate and read-back. Showcase desk to Ask-first. Replay weekends. Video script. **Product name decided.** | A stranger can create a Shadow desk |
| **Fri 25** | Safety, withdraw, close, warnings. Relay bridging. Drills on v1: kill and restart, caps hold. **On its own by 16:00 ET** with one tight real rule on a $50 demo desk. Deploy freeze from 20:00 ET. | **Desk is live for the weekend** |
| **Sat 26** | Comparison page, home page, how-it-works, weekend report, holding detail, settings. Capture footage. Design pass. | |
| **Sun 27** | README, `docs/ARCHITECTURE.md`, video cut by 14:00 UTC, X post and Typeform **A475N331** by 20:00 UTC (corrected 21 Sep: GyPxGqRn was pre-registration and is closed). | **Submitted** |
| **28 Sep to 4 Oct** | Full weekend report with Monday grades, on-chain TWAP guard, per-desk operator keys, remaining design pass. Arbitrum submission. Keep the desk running for the early-October finalist demo. | |

**Sunday spikes, an hour each, to close every unverified item before building on it.**
1. SERV: strict schema plus `serv_*` tools plus `reasoning_effort: low` in one call. Numeric bounds.
   Latency of `serv_shadow_agent`. Whether an `exhausted` shadow outcome is visible. Content filter
   against our real prompt. Where 429 begins. Raw-mode header. Pick the model.
2. OpenServ: `provision()`, cron fire, `doTask` override, log the whole `action`, stop the process
   across a fire, check whether a task costs credits with no model call, the SDK under zod 4, the path
   of `.openserv.json` on the volume, whether an outsider can open the agent page.
3. ~~Finnhub weekend coverage for NVDA and SPY.~~ **Settled 20 Sep: good volume, needs a relevance filter.**
4. ~~Alchemy archive depth and `getLogs` history depth on 4663.~~ **Settled 20 Sep: full archive, whole-chain logs.**
5. Blockscout: does a clone of a verified implementation show source and a Write tab.

**If a gate slips,** work moves past the first deadline in this order: holding detail page, BNB and
Ethereum bridge origins, settings extras, weekend report page. The contract, the engine, the record,
Telegram, the judge-facing pages, the comparison page and the live weekend never move.

**Submission pack.** Public GitHub repo with README and architecture doc. Live URL with the read-only
showcase desk. A 3 to 4 minute video made with the `direct-demo-video` skill. X post with name, concept,
screenshots and links. Proof of the OpenServ side: agent id, screenshots of the agent page and task
runs. A short revenue paragraph: the yearly fee per desk now, a paid question endpoint and a clonable
template later. Real transaction hashes throughout.

---

## 7. Verification

- **Contracts.** `forge test` and `forge test --fork-url $ALCHEMY` unpinned. Invariant fuzz green.
  Poisoned-pool and sandwich tests pass. Blockscout shows the clone's source and Write tab.
- **Skeleton, Monday.** Event `decisionHash` equals the hash recomputed from the stored record. Change
  one byte and the check fails. Kill after send, restart, and the action resolves with no duplicate.
- **Limits hold on-chain.** With the operator key: over per-action cap, over daily cap, a token not on
  the list, a withdraw. Each reverts.
- **Engine.** `vitest` on gate, needs, deferrals, valuation, calendar (clock change, holiday, early
  close), hashing vector, failure mapping, banned words. `desk:wake --dry` on a weekday and a weekend.
- **Scheduling.** Stop Railway for two hours. The web shows "has not checked in". On restart the tick
  loop catches up once. Deploy twice in a row and confirm one leader, one Telegram poller.
- **Approvals.** Approve, reject, expire, approve after a forced price move (must not execute), approve
  the same request twice (second does nothing), change the mandate with one pending (it cancels).
- **Security.** Another owner's session cannot read or change a desk. A Telegram callback from a group
  or another user is ignored. A desk not created through sign-in is never served.
- **Awkward states.** Every row of brief table 8.16 renders in the states gallery, and each is also
  triggered once for real or by mock, with the right record, banner and message.
- **Escape hatch.** Withdraw from the canary desk using only Blockscout, with our site ignored.
- **End to end.** A fresh wallet with no ETH goes from the home page to a funded Shadow desk in under
  five minutes, on a phone.

## 8. Risks

- **Track eligibility. SETTLED 21 Sep:** the official page defines the track as agents that act on Robinhood
  Chain *or* use Robinhood MCP, so we qualify without MCP. We also qualify for the Open track. See
  `research/2026-09-21-tracks.md`. *(Original note:)* The track is named "Mainnet & MCP" and we use no MCP. Asked on day one. Every
  visible entry in the track uses the chain, not MCP, and "best overall" is open regardless.
- **Unaudited contract with real money.** Small amounts, two deployments, invariant tests, two review
  passes, no upgrade path, and the honest sentence on the disclosure screen.
- **One operator key for all desks.** Railway secrets, alert on every trade, per-desk keys after the
  first deadline. The contract already supports it.
- **OpenServ cron is undocumented under failure, and its SDK is seven months stale.** The tick loop
  makes cron a nice-to-have. Versions are pinned.
- **SERV latency, rate limits, silent safety failures.** Timeouts, fail closed, our own validation.
  If `serv_shadow_agent` p95 exceeds 20 s it is used for the mandate read-back only.
- **Finnhub weekend coverage untested.** Checked Sunday. Tavily is the tested fallback, with about 550
  credits left this month, so it fires only on a real drift.
- **The issuer can pause, block or burn Stock Tokens.** Disclosed. No design changes that.
- **Design arrives late.** The functional UI ships regardless and is built for a re-skin.
- **Running cost.** Railway about $5 a month. Neon, Vercel, Alchemy and Finnhub free tiers. SERV about
  one cent per decision. Operator gas about 2 cents per checkpoint and 3 to 9 cents per action.

## 9. First actions on approval

1. Save this plan as `docs/ARCHITECTURE.md` and `docs/BUILD-PLAN.md`. Done.
2. Update `docs/DECISIONS.md`: own Telegram bot, custom desk contract, valuation on the pool average,
   gas in cents, deferrals, approval re-check, replay grading, the 8% band limit.
3. Update `docs/DESIGN-BRIEF.md`: the honest stolen-key sentence in 8.3, fund-before-create when the
   owner has no ETH, the headline rule on the public view, "close the desk" as one action, the
   how-it-works and escape-hatch pages, the "only you can sell right now" state in 8.16.
4. Give Abu the account checklist: pre-registration form, the track question in Telegram, Arbitrum
   registration, SERV key with data collection on, OpenServ account, Alchemy, Finnhub, Reown project
   id, BotFather token, Neon, Railway, Vercel, deployer and operator wallets with a little ETH on 4663,
   and about $100 of USDG.
