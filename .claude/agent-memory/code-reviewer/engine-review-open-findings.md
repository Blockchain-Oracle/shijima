---
name: engine-review-open-findings
description: What the 2026-09-20 correctness review of the trading engine flagged, to verify as fixed before re-reporting
metadata:
  type: project
---

Flagged on 2026-09-20, in rank order. Check the code before repeating any of them.

1. needs.ts sizes sells at TWAP with no headroom, so the gate refuses cap-sized sells when feed or spot is above TWAP.
2. Loss-limit baseline is additive. Withdrawal in drawdown gives a false stop. Withdrawal after gains clamps it to 0 and disables the limit.
3. A fully withdrawn non-mandate token has no price in reconcile, so the baseline does not move and the desk stops.
4. CLI desk:wake and desk:skeleton do not take the leader lock, so they can trade the same need as the worker. Lock holder never checks it still holds the lock.
5. A refused daily seal is retried every 15 s tick with a new action row each time.
6. Baseline move, desk event and snapshot are separate commits, so a crash double counts a flow.
7. A failed or crashed wake is never retried in its hour. One candidate's read error drops the others.
8. Valuation rejects on any feed read failure and divides by a zero feed price. insideBand is unused.
9. Mandate dailyCapUsdg and maxPositionBps are never enforced off-chain.
10. Buys ignore the cash target. 11. Fallback reference wording says the market is open. 12. not_seen verdict assumes nonce reuse that send.ts does not force.

Verified sound then: gate parity with Desk.sol, TickMath port, reconcile of own trades via resolvedAt, deferral end-then-create order, record and companion atomicity, shadow and ask_first never send.

**Why:** A follow-up review should confirm fixes instead of rediscovering these.

**How to apply:** Start a re-review by checking each item against current code. Delete this file once all are resolved. See [[review-report-format]].
