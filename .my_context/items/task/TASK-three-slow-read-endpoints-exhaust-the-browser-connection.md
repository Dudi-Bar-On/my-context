---
id: TASK-three-slow-read-endpoints-exhaust-the-browser-connection
type: task
title: three slow read endpoints exhaust the browser connection pool, so a font waited 5.7 seconds to be requested
status: active
severity: soft
always: false
summary: Three slow pages used to tie up the browser's connections; the slowness itself is fixed and what is left lives in files that piece of work could not reach.
summary_of: 632f74af1c09fdd1
summary_was:
  - 2026-09-16 A handful of slow requests use up every connection the browser will open, so everything else the page needs waits in line behind them.
scope:
  - src/ui/read-model.ts
  - src/ui/public/app.js
tags:
  - v2
  - ui
  - performance
  - read-model
  - "plan:readmodel"
  - "seq:2"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 7440227aefbf32e0
plan: readmodel
seq: "2"
state: todo
priority: "2"
---

# three slow read endpoints exhaust the browser connection pool, so a font waited 5.7 seconds to be requested

FOUND BY TWO REVIEWS INDEPENDENTLY -- report 1 found the symptom and called it puzzling, report 2 found the cause. Row 20 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `/api/status`, `/api/doctor` and `/api/sessions` together exhaust the browser's six-connection HTTP/1.1 pool. `geist-mono-400.woff2` therefore sat 5,748 ms BEFORE ITS REQUEST WAS EVEN SENT -- which is report 1's "4.6 s font", explained.

WHY IT IS ITS OWN ROW AND NOT PART OF ROW 18. Row 18 is the duration of those three calls; this is the effect of that duration on everything else the page needs. Even if the calls got faster, three long-lived connections against a pool of six is a shape the page can be fixed against independently.

THE SUBJECT. The read model is a single-threaded synchronous server and the whole product is behind it.

── STILL OPEN 2026-09-16, AND THIS IS WHAT REMAINS ─────────────────────

NAMED-BUT-OPEN aebc76f0 — measured and deliberately not changed — both fixes live in `src/ui/public/**` and `watch-model.ts`, out of that lane's scope

WHAT LANDED: the two endpoints this item names are no longer slow — `readmodel/1` took the cold call from 2,494 ms to 892 — so the pool exhaustion this describes is far cheaper than when it was measured. WHAT REMAINS is the client half and nothing else: the request pattern is composed in `src/ui/public/**` and in `watch-model.ts`, and the lane that had the server did not own either.

AND ONE NEW NUMBER THE NEXT LANE NEEDS, measured by that lane rather than by this item: `/api/coverage` is now 10.5 MB, the largest single body on the boot path. Recorded here so it is not re-derived.

The `NAMED-BUT-OPEN` line above is read by `npm run check:board`. It names ONE commit on purpose: the next commit that names this item reports again, so this record cannot silence the item forever.

NAMED-BUT-OPEN 16125ddc — the same verdict one commit earlier, in the same words — this item's own argument is about the page's connection shape in `app.js`, out of reach; the measured harm is gone as a consequence, which is NOT the same as the item being done. That commit also found a third slow endpoint, `/api/injection-history`, which is in neither readmodel item and is filed nowhere.
