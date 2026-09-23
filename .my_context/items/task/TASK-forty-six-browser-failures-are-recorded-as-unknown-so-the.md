---
id: TASK-forty-six-browser-failures-are-recorded-as-unknown-so-the
type: task
title: forty-six browser failures are recorded as unknown, so the next real regression hides in a familiar number
status: active
severity: soft
always: false
summary: Baseline the full chromium project against a clean tree once, and record which failures are pre-existing.
summary_of: b3e982f3f5f74969
scope:
  - e2e/**
  - reports/**
tags:
  - v2
  - "plan:rulings"
  - "seq:114"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: 225d9ecc602ac883
plan: rulings
seq: "114"
state: done
priority: "2"
---

# forty-six browser failures are recorded as unknown, so the next real regression hides in a familiar number

OWNER RULING, 2026-09-17: **"Baseline them once, now."**

Lane AV reported 643 of 702 passing on the full chromium project and **refused to characterise the
other 46**, because baselining them needed HEAD versions of 21 files held for forty minutes while
other lanes were actively writing the tree. It recorded them as UNKNOWN rather than implying
green. That was the right call and it is why this item can be written precisely.

**DO IT WHEN THE TREE IS QUIET.** Check `mycontext ready` and confirm no lane is writing
`src/ui/public/` or `e2e/` before you start. The whole value of this pass is that its numbers are
attributable, and a lane writing underneath destroys exactly that.

RECORD, PER FAILING TEST: the file, the test name, whether it fails at a clean HEAD, and the
one-line reason if it is obvious. **A count is not a baseline.** "46 failures" tells the next
person nothing; "these 46, by name, fail at HEAD for these reasons" lets them see a 47th.

── THREE ARE ALREADY DIAGNOSED — START FROM THEM ───────────────

  — **`e2e/strip-fields.spec.ts` is red on PRISTINE sources**, verified against HEAD bytes:
    `page.reload()` respends the one-shot nonce and the page returns tokenless, so it measures 2
    fields against a floor of 10. Three `app-layout.spec.ts` tests fail the same way.
  — **A BACKGROUNDED TAB NEVER FITS THE BAR.** `fitStrip` rides `requestAnimationFrame`, which the
    browser throttles when the tab is hidden. This cost a lane an hour and it is a PRODUCT
    question as much as a test one — should the bar refit on `visibilitychange`? Recommend; the
    owner decides.
  — **`mintNonce` has no retry** and Node’s `fetch` returns `ECONNRESET` on a reused keep-alive
    connection here. That belongs in `e2e/helpers.ts`, not in each spec.

REPORT the baseline as a committed file so the number has a date and an owner. Do NOT repair the
46 here — naming them is the deliverable, and a baseline that quietly fixes what it counts cannot
be compared to anything.

Baseline, recorded 2026-09-23 by the dispatching session after task 3.9 fix round 3 (commit 5664e55c): Playwright 1.62.1; Chromium 151.0.7922.34 (project chromium) and Chrome 153.0.8010.36 (project chrome); 98 spec files, 1406 tests; npm run test:e2e on the owner's Windows machine: phase 1 (4 workers) 1394 passed, 4 failed, 8 skipped; phase 2 (serial) all 4 passed (composer-staging, conversations, execute, live-refresh - contention, named by the gate); exit 0 in 51m25s. The three mockup-parity specs are retired (DEC-the-three-mockup-parity-browser-specs-are-retired-screen); the suite runs headless (DEC-the-browser-suite-runs-headless-by-default-a-person-who). The Ubuntu job's verdict on the same commit is recorded here when it lands; the item closes on both.

Ubuntu, recorded 2026-09-23 by the dispatching session: CI run 35825639257 on commit fc4817b2 (ubuntu-latest, GitHub-hosted, 1 worker): 1406 tests, 1394 passed, 12 skipped, 0 failed, phase 1 green outright in 1.6 h; the Windows job on the same commit green through npm test. Both machines agree on the same head, so this item closes. The four extra skips on Ubuntu against this machine's eight are the gate's unreported skips that release/26 (TASK-the-browser-gate-reports-green-while-eight-tests-are-skipped) makes it name.
