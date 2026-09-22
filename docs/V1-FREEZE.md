# Contract v1: the interface-freeze checklist

**DONE 22 Sep 2026, 19:16 UTC.** v1 factory `0xB0Df8d1ca6eDA2700a2D145bab2675109A2e89f1`, implementation
`0x90ff69C78014d06e3f09DC0985E83Cd8338aFe0F` (verified on Sourcify), desk `0xC61DDE99B72add803E47B1bcA17B4bf8819618B1`.
The dev desk's funds moved over, v0's operator was revoked, and the database moved with `scripts/move-desk.sql`.
Tagged `v1`. Blockscout's manual verification (step 3) is still owed.

Written 22 Sep 2026 from the review pass. v1 (`contracts/src/Desk.sol`, `DeskFactory.sol`) is source only;
v0 is live at factory `0x35A40883BAD8874F8fB5592c72c4385226070958`. Every box below is ticked before
`./contracts/deploy.sh v1` runs, and the deploy waits for Abu's go (about $1 of gas).

## What v1 adds over v0

- A deadline on every operator call, `checkpoint`, `sweepToVault` and `redeemFromVault` included, so a lost
  transaction can always be declared dead. `pause()` alone has none, on purpose: the owner must be able to
  call it from the explorer with no arguments.
- The session key: `grantSession(key, expiresAt)` (owner only, one key, at most 7 days), `revokeSession()` (owner
  or key), and `onlyOwnerOrSession` on `withdraw` (pays `owner` only), `pause`, `revokeOperator`, `setLimits`
  that only lowers, `sell` under the operator's own caps and 8% floor, and `batch` of those. The key can never
  buy, raise a limit, allow a token, change the operator, unpause or grant another key.
- `withdraw(token, type(uint256).max)` means the whole balance, so "sell everything and send it to me" and
  "close the desk" fit one signature.
- `MAX_FEED_AGE` is 6 days (was 4: the price log shows real gaps of up to 96 hours over a holiday weekend).

## Before deploying

- [x] 42 fork tests pass at a fresh pinned block: `cd contracts && BLOCK=<n> ./fork-test.sh`.
- [x] `pnpm dev:prove-limits --send` on an anvil fork of mainnet: over per-action cap, over daily cap, a token not
      allowed, an operator withdraw, and every session-key case (each of the six in scope works; each call out of
      scope reverts, including through `batch`).
- [x] `contracts/deployed/v0/` is untouched, and `send.ts` still encodes v0's `checkpoint` without a deadline.
- [x] `pnpm abis:build` is run only AFTER the v1 factory is deployed and the worker has been stopped, because the
      live worker drives the v0 desk with the v0 ABI.
- [x] The disclosure, README and `Desk.sol` header all say the same worst case: "at most 8% of your daily limit
      in each 24-hour spending window, so at most twice that across a window boundary".
- [x] A second reader has read `Desk.sol` end to end since the last change (the 22 Sep review counts as the
      first pass; the second is owed).

## The deploy itself

1. `./contracts/deploy.sh v1` records the factory and implementation in `packages/chain/deployments.json`.
2. `./contracts/verify.sh v1` publishes source on Sourcify.
3. Verify the implementation on Blockscout by hand (its API sits behind a bot check), so every clone gets a
   "Write proxy" tab and the withdraw-without-our-website page's steps work as written.
4. Create the demo desk on v1 with the studio, fund it with the dev desk's funds (about $5; Abu, 22 Sep: no $50), and mark the
   v0 desk row `closed`.
5. Restart the worker from the tagged commit.

## Known limits, stated

- The daily cap's window is fixed, not rolling: it starts at the first spend and lasts 24 hours. Across a
  boundary two windows can touch, so the honest bound is twice the cap in one calendar day, once.
- The contract is not audited. Amounts are small. There is no upgrade path and no admin.
