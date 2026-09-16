---
id: TASK-nothing-is-compressed-nothing-is-cached-and-no-asset-carries
type: task
title: nothing is compressed, nothing is cached and no asset carries an ETag, re-priced to tens of milliseconds
status: active
severity: soft
always: false
summary: Files the tool sends to the browser now carry a tag that lets the browser skip downloading them again, so returning to a page costs almost nothing.
summary_of: da97e2d509f3f597
summary_was:
  - 2026-09-16 Files the browser could reuse are sent again on every load with nothing telling it they have not changed, though on a local machine the cost is small.
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
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 20f8269dd2f0cf16
plan: readmodel
seq: "3"
state: done
priority: "3"
verified_on: 2026-09-16
---

# nothing is compressed, nothing is cached and no asset carries an ETag, re-priced to tens of milliseconds

FOUND BY BOTH UI REVIEWS. Report 1 ranked it SECOND of everything it found; report 2 confirmed the measurement and RE-PRICED IT, and the re-pricing is the useful part. Row 91 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. Nothing is compressed: transfer 2,653,070 B against decoded 2,642,570 B, a ratio of 1.004. Nothing is cached: `no-store` on `/`, `app.js`, `styles.css`, `strings/*` and `fonts/*`. And there is NO `ETag` ON ANYTHING, so the immutable font files are re-fetched on every single load.

WHAT REPORT 2 CORRECTED. On loopback this is worth TENS OF MILLISECONDS, not seconds. It is second-order behind row 18, where two endpoints block the server for about four seconds per call. Report 1 ranked it second because it had attributed the seven-second load to the assets; report 2 measured those assets at 21 ms and 7 ms.

SO THE VALUE HERE IS NOT SPEED. It is that an immutable asset with no `ETag` and `no-store` is a cache policy nobody chose, on a server whose own screens argue about disclosure elsewhere.

── CLOSED 2026-09-16 BY THE RECONCILIATION, NOT BY THE LANE ────────────

DONE IN `aebc76f0`. An ETag from size and mtime rather than a content hash, deliberately, because the point of a validator is to answer WITHOUT reading the file. A revisit of nine assets went 1,091,480 bytes / 55 ms to 0 bytes / 6 ms, 9 of 9 answered 304. Every `/api` response keeps `no-store` unchanged.

COMPRESSION WAS MEASURED AND DECLINED WITH NUMBERS, which is the half of this item that is answered rather than built: gzip takes the three text assets 817,100 to 280,270 bytes and costs 19 ms of CPU on the single thread `/api/status` also runs on, buying back about 31 ms of transfer. Roughly break-even, paid in the scarcest resource the server has. The ETag removes the bytes instead of shrinking them every time. Closed by the reconciliation in `rulings/93`.
