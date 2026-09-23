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

**Mon 21 Sep, night. STEP 8 BUILT: THE OWNER'S CONTROLS, SETTINGS AND THE INBOX.** Proven on the anvil fork, in
code and in headless Chrome. Nothing is deployed to mainnet.
- **Controls beside the chat:** add money, withdraw, sell everything, pause or resume, mode, the limits on the chain,
  check now, and remove the assistant or restart the desk. Each opens one small form and makes the same card the chat
  would, with no model call. The press lands in the chat thread too.
- **Costs first:** every chain card shows what the owner gets, what each sale fetches against the price feed, and the
  network fee in dollars, from a simulation, before anything is signed.
- **Desk v1 change:** `withdraw` with the maximum means the whole balance, so closing the desk is one signature. 42
  fork tests pass. Redeployed on the fork only.
- **Proven on the fork, server path:** add $2, lower and raise the limits, withdraw $1, a $500 withdraw refused with
  the real numbers, sell everything, remove the assistant (the desk waits quietly), restart it (the assistant comes
  back), and close the desk: $4 of Nvidia sold, $10.95 sent home, assistant removed, desk marked closed.
- **Proven in the browser:** the $1 withdraw and the lower limits signed by the session key with no pop-up; pause and
  resume; wallet-only cards asking for the owner's wallet; a live Relay quote ($25 USDC on Base, $24.91 into the
  desk, 0.37%). Every page fits at 390, 768, 1024 and 1440 in both themes, with no console errors.
- **Add money from another network** goes through Relay straight into the desk, with an optional $1 of ETH to the
  owner's own wallet for fees. Not yet sent with real money.
- **Settings** (`/desk/[slug]/settings`): Telegram with a QR code and a one-time code, watched until the bot claims
  it, and disconnect; the share link on or off; the disclosure with its acceptance; appearance; close the desk.
- **The bell:** the owner's messages across their desks, linked to each decision, with mark-all-read.
- **The chat prompt is `ask.v2`**, which knows add money, the limits on the chain and closing. Not yet run: SERV
  credit is still $0.02.
- **Still owed:** vault sweeps (step 3), and a Relay deposit with real money.
- **Next:** step 9, the markets page and one stock, with charts that talk.

**Mon 21 Sep, late night. STEP 9 BUILT: THE MARKETS PAGE AND ONE STOCK, WITH CHARTS THAT TALK, AND PRICE ALERTS.**
Read-only against mainnet; nothing was sent to the chain.
- **`/markets` is Masayume's hero with a strategy in it.** $1,000 put into The Mag Seven (or any preset) at the start
  of 1D, 1W or 1M, against the same basket at each stock's reference, drawn as a stepped dashed line. The head says
  what it is worth now and how far it is from its reference; the clock counts to the US market's next change. The
  caption is built from facts: "The Mag Seven is 0.6% above its reference, the pools at the last regular close, Fri
  16:00 New York. Meta has moved most, 1.8% above." Markers show where shared desks acted or waited; **clicking one
  opened `/desk/showcase/decision/1` in headless Chrome.** The right panel lists the strategy's stocks with weight and
  gap, the cost of putting $500 in now, halts, the next report, and Start a desk with this (`/start?preset=`).
- **Below it:** the ten Stock Tokens as Masayume rail cards (spark line since the reference was set, the reference
  rule, the gap, the cost of $1,000, the price's age), what shared desks did in words, and the desks to watch.
- **`/stock/[symbol]`** on Agari's ticker hub: pool price and reference with their ages, the gap, the cost of $100
  and $1,000, the next report, the chart with the desks' markers, price alerts, the multiplier and its history, what
  desks decided, and report dates. `/stock/nvda` redirects to `/stock/NVDA`; an unknown symbol is a 404.
- **New facts, synced by the worker:** multiplier changes from the chain's `UIMultiplierUpdated` events (9 real
  dividends found, from Nvidia's 1.0 to 1.000775 to SGOV's three), and report dates from Finnhub's calendar (7
  companies). `pnpm prices:facts` runs both once.
- **Price alerts:** "Tell me when Nvidia is 2% from its reference", from the stock page or the chat (`ask.v3`), one set
  of checks. The price logger fires them once, with the message queued in the same transaction, to Telegram and the
  bell; a bell item opens the stock. **Proven on the rehearsal database** (`pnpm dev:prove-alerts`): a chat card
  saved an alert and a second tap was refused; 0.1% and a made-up symbol were refused; a slot with Nvidia 0.8% above
  fired the 0.5% alert exactly once with its message, and left a 10% alert waiting.
- "Ask about this" types the question into the owner's desk chat without sending it. The ticker strip's cells open
  their stock.
- **Checked** at 390, 768, 1024 and 1440 in both themes, on four views: no sideways scroll, no console errors. Lint
  clean, typecheck clean, 93 checks pass.
- **Observed, not fixed:** SGOV's reference line spikes about 0.2% during regular hours, when the reference is the
  feed rather than the pool at the close. It is the engine's own reference choice, logged as the engine saw it.
- **The worker is not running**, so the markets page says its newest price is hours old. `pnpm prices:log` writes
  one slot on demand.
- **Next:** step 10, the strategies studio and the first run. Vault sweeps are still owed from step 3.

**Tue 22 Sep, early. STEP 10 BUILT: THE STRATEGIES STUDIO, FIRST STEPS AND THE FIRST-RUN TUTORIAL.** Proven on the
anvil fork in headless Chrome, with a fresh wallet. Nothing was sent to mainnet.
- **`/strategies` is Agari's studio around a basket**: New desk, Start from a strategy, Your desks. Four steps with the
  desk card at the side: the basket (a preset or your own weights, with the total as you type), behaviour and limits
  (the two the contract holds are set apart), the test read, and create. `/start` redirects here.
- **Create is one wallet confirmation.** The server writes the desk's row first, with its own salt and the address the
  factory will give it, and builds the transaction with the owner's limits in it. After the receipt it checks the
  chain itself (our clone, this owner, our operator) before applying the basket and starting the desk in practice.
- **Owner with no ETH:** the page offers Relay straight to the desk's address, with about $1 of ETH to the wallet,
  then create. Judged against the real fee estimate.
- **After create, the first steps:** add money (the desk page's own card), give this browser a key, and Telegram
  with a skip.
- **Proven on the fork**, checked with `cast` and the database, not our own reads:
  - a fresh wallet with 0 ETH saw the no-ETH path; with ETH, one signature created the desk. Owner, our operator,
    $10 and $50 were in the contract, and the Mag Seven mandate v1 was applied, running, in practice;
  - a second desk from "Start from a strategy" (AI Builders). The page was reloaded before signing; it resumed the
    same address, with no duplicate;
  - $2 added through the wallet card, which the desk then held, and a 7-day key granted;
  - Your desks listed both; the disclosure was not asked a second time.
- **The test read** goes through the worker like the chat. SERV credit is still $0.02, so it answered "I could not
  read that back just now", and the studio showed that and let the owner continue. A React double-mount bug that
  hid every answer was found and fixed on the way.
- **The first-run tutorial** on /markets: five steps, ending on Connect. The weekend number is real, from the price
  log: "On the weekend of 19–20 Sep, Meta's token moved as far as 0.9% above its Friday reference."
- **Checked** at 390, 768, 1024 and 1440 in both themes, signed in and out: no sideways scroll, no console errors.
  Lint clean, typecheck clean, 93 checks pass, production build passes.
- **Next:** step 11, How it works and the status page. Vault sweeps are still owed from step 3.

**Tue 22 Sep, morning. STEP 11 BUILT: HOW IT WORKS, STATUS, WITH AND WITHOUT REASONING, THE STATES GALLERY, PREVIEWS.**
Proven on the anvil fork and against the live database in headless Chrome. Nothing was sent to mainnet. Five commits.
- **`/how-it-works`** is Agari's page, section for section, with the brief's content [8.21, 8.22]: getting started, a
  $10,000 worked example, the market clock (open, before and after hours, weekends; five session words), what you
  decide and what it decides, the three modes, the eight steps in order with each one marked arithmetic, fixed rule
  or AI judgment, where AI is used, when the desk will not act, what the network enforces, **withdraw without our
  website** (four steps, every token address, a signed-in owner's own desk linked), the fee, and eight questions.
  Numbers come from the code (limits from the studio, 24 checks, the cost multiple, $1 minimum). Linked from the
  footer, the disclosure and settings.
- **`/status`** is Agari's screen: a banner, nine parts with the dot ladder, the desks and honest counts (L-15 folded
  in). It reads, live: the worker's **heartbeat** (new `worker_beats` table, migration 0003, written at start and after
  every pass) together with the **leader lock in `pg_locks`**, so a dead worker and a stuck one read differently; what
  started the last hourly check (OpenServ or the timer); SERV's last answer; one chain read with its latency; the
  price log; feeds (a closed session reads "expected"); halt flags; Telegram; the chat queue. Each shared desk, and
  the viewer's own, shows its last check or **"has not checked in"** [8.16]. On the fork it showed SERV's real error:
  "402 Insufficient credits ... your balance is $0.02".
- **`/compare`, with and without reasoning [8.20].** Three saved situations built with the live check's own
  `buildEvidence`: a report coming (the brief's example), a weekend drop with no news, headlines that explain
  nothing. `pnpm compare:run` asks the same model twice, raw (`x-openserv-disable-braid`, tools off) and through SERV,
  applies the desk's own checks to both, logs each call, and saves the answers to `apps/web/data/compare.json`. The
  page never calls a model. **First raw answer, real:** on a 2.6% Saturday drop with no news, the model on its own
  said "Do it now" at 89%. The SERV side waits on credit.
- **`/dev/states`** draws all twenty 8.16 rows and every record outcome with the real components from typed fixtures.
  Building it exposed states the desk page never showed, now built: a holding's **flags** (trading paused, status
  unreadable, beyond 8% of the last official update, no feed, a report within a week), **"has not checked in"**
  after two hours, and record **notes** for money moved outside the desk, the owner's own calls and multiplier
  changes. The vault row says honestly it is not reachable until sweeps exist.
- **Fixed, a real bug:** resuming after a loss stop never reset the baseline (no caller passed the current value), so
  the next check would stop the desk again. `resumeDesk` now restarts the limit from the latest valuation. Proven on
  the rehearsal database: a stale $999 baseline became the latest snapshot.
- **Link previews:** the site, a shared desk (a private desk gets the site card), one Stock Token (gap and price age).
  Sora SemiBold vendored with its licence, as Agari does.
- **Found, not fixed: the escape hatch needs one more step.** Blockscout shows a desk as an EIP-1167 proxy, but
  offers only "Custom ABI": the implementation is verified on Sourcify, and Blockscout did not import it (checked in
  a real browser, 22 Sep). "Write proxy" appears once the implementation is verified on Blockscout itself. Do it for
  v1 at deploy; publishing source is outward-facing, so it waits for Abu's OK.
- **Checked** at 390, 768, 1024 and 1440 in both themes, signed in and out: no sideways scroll, no console errors (one
  hydration mismatch on Status's clock line was found and fixed). Lint clean, typecheck clean, 93 checks pass,
  production build passes.
- **Next:** step 12 (share cards, Rooms, Takes, Reels). Vault sweeps are still owed from step 3. Waiting on Abu: SERV
  top-up (then `pnpm compare:run`), the go for v1 (about $1) with Blockscout verification.

**Tue 22 Sep, midday. VAULT SWEEPS AND STEP 12 BUILT: IDLE CASH EARNS; SHARE CARDS, ROOMS, TAKES, REELS.** Proven on
the anvil fork and the rehearsal database in headless Chrome. Nothing was sent to mainnet.
- **Savings-vault sweeps (owed since step 3).** After the trades, a desk acting on its own parks the idle part of
  its cash target in Steakhouse USDG (Morpho), keeping three per-action limits loose, when 30 days of interest at
  Morpho's live rate beat three times the round trip's network fee (base fee × measured gas × Chainlink ETH).
  Before the trades, any desk not in practice redeems when its buys need the cash. No model call; each move is its
  own record (v2 widened: `sweep`, `redeem`, a `vault` evidence item) with its hash on-chain. Reconcile compares
  vault shares (migration 0004), so a sweep is never read as a withdrawal. v1 desks only.
- **Proven on the fork, checked with `cast` and an independent Python re-hash:** a $5,000 desk swept **$792.12**
  (its idle cash target) at 4.00%, fee bar $0.11; the `Swept` event's hash equalled record 8's. The next check saw
  no outside change. The owner withdrew $4,211.88; the next check read that as money leaving, scaled the baseline to
  $795.12, and **redeemed $8** because the buys wanted $9 with $1 loose; `Redeemed` matched record 12. The check
  after saw no outside change. `findOutcome` reads both receipts, so crash recovery settles vault moves.
- **Found by the first run:** my first rule swept cash the mandate was about to spend on stocks, which would have
  meant a redeem and a fee every hour while the desk bought. Only the cash target is swept now. And anvil's
  `eth_gasPrice` includes a 1 gwei tip this chain ignores, so the fee uses the block's base fee.
- **The desk page** shows the vault's live rate beside the parked amount, with the brief's small print. A withdrawal
  the vault cannot pay now says so and offers what can be taken now (brief 8.15). Not built: interest earned so far.
- **Share cards** (`features/share/`): Agari's canvas kit verbatim, a decision card built on the server from the
  record alone and drawn in the browser, on every shared decision page; `/dev/share` draws the latest of each kind.
- **Rooms** (one per Stock Token, on its page) and **Takes** (`room_posts`, `takes`, migration 0005; routes under
  `/api/room/[symbol]` and `/api/takes`). The gate is our sign-in plus owning a desk. Proven on the rehearsal
  database: signed out, "The Room is for people with a desk" with Connect; no desk, "You need a desk to join" with
  a link to the studio; owner, a line posted with **holds it** (the desk holds Nvidia); a second line at once was
  refused by the rate limit and never stored; a take about Apple naming `$NVDA` was filed under `{AAPL, NVDA}` with
  no badge (no Apple held).
- **Reels** (`/reels`, in the nav after Markets): the ten Stock Tokens, the latest shared decisions with their marker
  on the stock's line, and takes, snap-scrolled; the Take pill opens the composer on the card's stock.
- **Fixed on the way:** script-registered desks (the live dev desk included) have no `deployed_at`, so the first gate
  locked their owner out; it now keys on lifecycle. A fired price alert's time rendered differently on the server
  and in the browser (a hydration error on the stock page since step 9); it now uses New York time. `next-env.d.ts`,
  rewritten by every build, is left out of the formatter.
- **Checked** at 390, 768, 1024 and 1440 in both themes, signed in and out: no sideways scroll, every sheet on
  screen, no console errors. Lint clean, typecheck clean, 93 checks pass, production build passes.
- **Next:** the live weekend. Waiting on Abu: SERV top-up (then `pnpm compare:run`), the go for v1 (about $1) with
  Blockscout verification, then the demo desk with $50.

**Tue 22 Sep, evening. REVIEW OF EVERYTHING BUILT AGAINST THE PLAN, at Abu's request, and the fixes.** Seven
independent reviewers read the contracts, the engine, the chat and worker, the owner pages, the public pages, the
database layer and Agari's changes since our port pin against `ARCHITECTURE.md`, `DESIGN-BRIEF.md`, `FIDELITY.md`,
`DECISIONS.md`, `RECORD-SCHEMA.md` and this log. Every finding was verified in the code before it was fixed. What
mattered most, in order:
- **18 of the 44 real records on the live desk could not be read** (the decision page rendered half blank, the share
  card drew nothing): the `approvalOf` widening was not optional, and version 0's evidence was held to version 1's
  strict shape. Both are widenings now; all 44 live and 89 rehearsal records parse and view.
- **"Check it" compared the record with its own stored hash**, not with the chain, and for a sealed non-action claimed
  the fingerprint was on the network when only the sealing record's was. Rebuilt: the browser rebuilds the bytes,
  asks the public RPC for the transaction itself and decodes the desk's event; for a record with no transaction it
  walks every `prevHash` link to the sealing record; an unsealed record says so and names the next seal. Proven in
  headless Chrome on mainnet records 1 and 3: "It matches", with the event's hash read from the network.
- **A new wallet could not accept the disclosure** (no owner row until a desk existed), so a stranger could never make
  a desk; sign-in now creates the row. **An owner of a private desk got 404 on their own record, report and decision
  pages**, so the go-live rule could never be met; every desk page resolves the owner by session now.
- **The loss stop could fire on the owner's own withdrawal of a dropped token** (an unpriced change counted as $0 in
  the baseline). It is priced from the last snapshot, or the baseline waits for the next full valuation.
- **The protective rule the decisions doc calls the demo could not fire**: notes only shaped timing. A structured
  rule (`price_move_sell`: token, fall, cut) now lives in the mandate; `needs` raises a protective sale by arithmetic,
  the model is told it is the owner's standing instruction, and the studio and the desk's new **Edit what you told
  it** control (no model call, before-and-after card) set it. Proven on the rehearsal database in the browser.
- Engine: the mandate's daily limit could be exceeded within one check; one candidate's read error failed the whole
  check; company events never reached the engine (an `event` evidence item and an `EVENT_WINDOW` blocker now);
  approved-but-unexecuted requests never expired; a second loss-limit breach never paused on-chain (it does now,
  through the sender); grading and prices paused while a transaction was held; buys ignored the cash target.
- Worker: the OpenServ trigger and the timer could run a pass at once with no mutex; a Telegram send that failed
  once was dropped for good; an approval answered on the website never updated its Telegram message; `/pause`
  waited behind a model call and left the pinned status stale; a second desk on one Telegram user acted on an
  arbitrary desk; the Monday report was never sent. All fixed; migration 0006 adds `approval_answered`.
- Contract (v1, undeployed): `MAX_FEED_AGE` 4 days equalled the longest gap the price log has seen, now 6; the
  disclosure's "8% of your daily limit per day" overstated a fixed 24-hour window and is reworded everywhere;
  owner-side deadlines came from a possibly stale block clock. `docs/V1-FREEZE.md` is the checklist the plan owed.
- Web: holdings now show price with source and age, the reference and the gap; limits in use show spent today and
  the room before the loss stop; the plate shows since the reopen; every boundary time is in the reader's zone with
  New York beside it (Agari's rule; the desk's next check was a bare New York clock); the record has its filters;
  the report lists past stretches; the decision page shows how a request was answered and the network fee; the
  record, decision, report and Your desks pages left the pre-port frame; visitors are no longer addressed as the
  owner; API routes check origin under a content security policy; SIWE pins the site and chain; social routes give
  out short addresses; the header's session chip is gone as in Agari.
- Docs corrected to what the code does: no invariant fuzz or sandwich tests, no invite code, no `record.json` route,
  no desk-home polling, `fee_accruals` unused, deploy flags as scripted, record version 2 documented.
- **Proven:** lint, typecheck, 98 checks, 42 fork tests, the production build; 136 page loads in headless Chrome at
  four widths in both themes, signed in and out, with no console error, no sideways scroll and no 404; two live
  "Check it" matches; two checks on a fresh anvil fork after the refactors (both candidates ended `FAILED_NO_DECISION`
  on SERV's 402, as they should with $0.02 of credit); the Edit control's rule card confirmed and applied.
- **Still owed, none blocking the weekend:** `wake.ts` is over the size rule; the second reading of `Desk.sol`;
  operator gas alerts to Abu go to the log and the status page, not to a chat; the worker has been off since Monday
  09:00 UTC, so the weekend of 19 to 20 Sep is ungraded and 40 records are unsealed until it runs.
- **Next:** the live weekend. Waiting on Abu: SERV top-up, the go for v1 (`docs/V1-FREEZE.md`), the demo desk's $50,
  and starting the worker.

**Tue 22 Sep, 19:05 UTC. SERV FUNDED, THE WORKER RUNS AGAIN.** A live SERV call answers. The worker started at 19:03,
graded the weekend backlog, sealed the day on chain (`0x59715485…`), sent one Telegram message and saved prices,
multipliers and earnings. Its first boot showed `openserv_trigger_failed`: OpenServ answers 400 "already set to the
desired state" when the workflow is already running, and that stopped the trigger from being switched on. Now treated
as success; on restart the log shows `openserv_trigger_active`. The dev wallet is empty on every chain: the $10 from
20 Sep is on the dev desk (5.21 USDG and 0.0025 NVDA). **Next:** the demo desk's $50 needs a new deposit on Base, and
the go for v1.

**Tue 22 Sep, 19:20 UTC. CONTRACT v1 IS LIVE AND THE DESK MOVED ONTO IT. Abu: $5 is enough for all development.**
No $50 demo desk: the dev desk is the demo desk. Every v1 freeze box ticked first: 42 fork tests at block 69893208;
on a fresh fork, v1 deployed, a desk created and funded from v0, and all 11 limit cases held (the session withdraw case
had first read BROKEN only because the fork desk was empty); a second reader found nothing fund-affecting in
`Desk.sol`; the header's worst-case wording now matches the README and the disclosure. The whole move was rehearsed on
the fork and the rehearsal database, ending in a real shadow check on v1. Then on mainnet: factory
`0xB0Df8d1c…89f1`, desk `0xC61DDE99…18B1` holding 5.21 USDG and 0.0025 NVDA, v0's operator revoked, and
`scripts/move-desk.sql` carried the mandate, Shadow mode and its 21 checks, the `showcase` link, the linked Telegram and
price alerts across; v0 is closed and its 44 records stay in the database. Worker restarted from tag `v1`.
**Owed:** Blockscout verification by hand (Sourcify is done), so the "Write proxy" steps work.

**Wed 23 Sep, early. UX OVERHAUL, per `docs/UX-PLAN.md`, with 21st.dev, at Abu's request.** He found the app mediocre:
text-only cards, jargon basket names, a flat studio, no portfolio chart, a buried Telegram link and a bare bot. About
40 21st searches, 78 previews viewed on contact sheets, 14 components read with `21st get` and adapted into our tokens
(21st AI generation is not enabled on the account). What changed, each proven in headless Chrome at 390 and 1440, dark
and light, with no console errors and no sideways scroll:
- **Bot:** named Shijima (it was "Omamori"), 7 commands, descriptions, its picture, a welcome photo, and a menu
  (Portfolio, Record, Pause/Resume, Ask) that edits one message in place; a refresh button on the pinned status.
  Run live into Abu's own chat. Approvals untouched.
- **Logos** for all 10 Stock Tokens (`public/tokens`, `TokenLogo`, `TokenStack`) and one colour per token
  (`packages/shared/src/token-look.ts`).
- **Plain basket names** (The whole US market, The 7 giants, The companies building AI, Play it safe; ids unchanged).
  Strategy cards show logos, a donut and each basket's real 30-day return from `price_points` (`presetPerformance`,
  the same arithmetic as the markets chart).
- **Studio:** a stepper with slides, basket radio cards with returns, build-your-own as logo tiles and sliders with
  cash as the remainder, a live preview with the limits in one sentence.
- **Desk:** value first, a portfolio chart (value against where it started, dips, range tabs, decision dots,
  keyboard slider) that carries the earlier v0 contract's history, now-against-plan, holdings with logos and 24h
  sparklines, limit gauges, and the record as a day-by-day timeline; visitors get the record beside the portfolio.
- **Record page:** chips with logos instead of dropdowns. **Telegram connect:** one real link, code made ahead.
- **Found and fixed on the way: sign-in was broken since the 22 Sep review.** The server pinned the SIWE scheme and
  the button never sent one, so every sign-in answered "That signature does not match". Proven fixed with a real
  signature from the owner key through `/api/auth`.
- `motion` 12.43.0 added (reverses FIDELITY §3; see DECISIONS). Lint, typecheck, 98 checks and the build pass.
- **Not done, on the cut list:** trade and portfolio images rendered by a web route; Settings "Connections" cards;
  Telegram connect in the header menu. Log in with Telegram and a Mini App wait for a public domain.

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

- **Contracts.** 42 fork tests against live mainnet state at a pinned block (`BLOCK=<n> ./contracts/fork-test.sh`),
  covering the guards, the session key's scope and the whale push. *(Corrected 22 Sep: no invariant fuzz and no
  sandwich test exist; the whale push is the one adversarial-pool test.)* Blockscout shows the clone's source
  and Write proxy tab once v1's implementation is verified there.
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
