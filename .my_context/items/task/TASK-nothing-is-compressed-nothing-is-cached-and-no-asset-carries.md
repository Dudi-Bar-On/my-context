---
id: TASK-nothing-is-compressed-nothing-is-cached-and-no-asset-carries
type: task
title: nothing is compressed, nothing is cached and no asset carries an ETag, re-priced to tens of milliseconds
status: active
severity: soft
always: false
summary: Files the browser could reuse are sent again on every load with nothing telling it they have not changed, though on a local machine the cost is small.
summary_of: bc4697eb6bb01560
scope:
  - src/ui/server.ts
  - src/ui/static.ts
tags:
  - v2
  - ui
  - caching
  - performance
  - "plan:readmodel"
  - "seq:3"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 35ab612cefc77f85
plan: readmodel
seq: "3"
state: todo
priority: "3"
---

# nothing is compressed, nothing is cached and no asset carries an ETag, re-priced to tens of milliseconds

FOUND BY BOTH UI REVIEWS. Report 1 ranked it SECOND of everything it found; report 2 confirmed the measurement and RE-PRICED IT, and the re-pricing is the useful part. Row 91 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. Nothing is compressed: transfer 2,653,070 B against decoded 2,642,570 B, a ratio of 1.004. Nothing is cached: `no-store` on `/`, `app.js`, `styles.css`, `strings/*` and `fonts/*`. And there is NO `ETag` ON ANYTHING, so the immutable font files are re-fetched on every single load.

WHAT REPORT 2 CORRECTED. On loopback this is worth TENS OF MILLISECONDS, not seconds. It is second-order behind row 18, where two endpoints block the server for about four seconds per call. Report 1 ranked it second because it had attributed the seven-second load to the assets; report 2 measured those assets at 21 ms and 7 ms.

SO THE VALUE HERE IS NOT SPEED. It is that an immutable asset with no `ETag` and `no-store` is a cache policy nobody chose, on a server whose own screens argue about disclosure elsewhere.
