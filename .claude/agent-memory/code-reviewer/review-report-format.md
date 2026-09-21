---
name: review-report-format
description: How the team lead wants review findings shaped in this repo (ranked, concrete, no test or style advice)
metadata:
  type: feedback
---

Reviews in this repo: at most 12 findings, ranked by real-world impact, correctness bugs first. Each finding needs file:line, a concrete failing scenario with example numbers or an exact event sequence, what goes wrong, and the smallest fix. End with a one-line verdict. If a suspected issue turns out to be handled, do not report it.

**Why:** Team lead's brief on 2026-09-20. The owner said tests are not a deliverable, so style, naming and "add tests" advice is unwanted noise.

**How to apply:** Use this shape for any review task here unless the brief says otherwise. It overrides the default top-5 JSON format. Also list briefly what was checked and found sound, so the lead can see coverage. See [[concurrent-edits-during-review]].
