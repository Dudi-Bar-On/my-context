---
id: TASK-forty-six-browser-failures-are-recorded-as-unknown-so-the
type: task
title: forty-six browser failures are recorded as unknown, so the next real regression hides in a familiar number
status: active
severity: soft
always: false
summary: Baseline the full chromium project against a clean tree once, and record which failures are pre-existing.
summary_of: 1b521988cf3f8267
scope:
  - e2e/**
  - reports/**
tags:
  - v2
  - "plan:rulings"
  - "seq:114"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: eab5c9e6fd4333bc
plan: rulings
seq: "114"
state: doing
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
