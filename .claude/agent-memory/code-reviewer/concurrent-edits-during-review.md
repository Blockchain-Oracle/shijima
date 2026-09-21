---
name: concurrent-edits-during-review
description: Builders edit the engine while reviewers read, so line numbers and even schemas move mid-review
metadata:
  type: project
---

Other agents keep editing the engine while a review is running. On 2026-09-20, during one review, gate.ts, market.ts, evidence.ts, pregate.ts, consider.ts and wake.ts changed, reference.ts and chain/logs.ts appeared, and the record schema went from version 1 to version 2.

**Why:** Hackathon pace with a deadline of 2026-09-28. Several agents work in the same tree with no branches.

**How to apply:** Before finalizing, grep for a symbol you did not see earlier and re-read the files you cite. The Read tool answers "file unchanged" when nothing moved, which makes this cheap. Cite line numbers from the last read only. See [[review-report-format]].
