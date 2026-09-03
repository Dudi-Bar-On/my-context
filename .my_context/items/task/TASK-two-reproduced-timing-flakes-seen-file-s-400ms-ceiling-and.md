---
id: TASK-two-reproduced-timing-flakes-seen-file-s-400ms-ceiling-and
type: task
title: "two reproduced timing flakes: seen-file's 400ms ceiling and server.test's 100ms margin"
status: active
severity: soft
always: false
summary: Two tests that failed now and again purely because the machine was slow, told apart from real drift by measurement.
summary_of: d85081d204571e46
summary_was:
  - 2026-09-03 Two tests fail now and again purely because the machine was slow; widen their margins rather than delete them.
acknowledged:
  - citation_form@4462a8c75485454d
scope: []
tags:
  - "plan:port"
  - "seq:10b"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: dafb2f9ff08487ae
valid_from: 2026-08-23
valid_until: null
checksum: 5cc53fd5214bab63
plan: port
seq: 10b
state: done
---

# two reproduced timing flakes: seen-file's 400ms ceiling and server.test's 100ms margin

> Two timing assertions were reproduced as genuine flakes on 2026-08-23, over 15
> full-suite runs with file fingerprinting before and after each, so "flaky" was
> separated from "another agent was mid-edit" by measurement rather than by belief.
>
> `test/core/seen-file.test.ts` · `assert.ok(elapsed < perLineWorstMs * 2)` (gone 2026-09-03), a
> 400ms ceiling over a BEST-OF-3 wall-clock sample. Failed twice in fifteen runs, at
> 419ms and 676ms, in a file that fingerprinting proved untouched. Fix: take
> min-of-5 at :219 rather than min-of-3, or raise the ceiling — a factor of 4 still
> catches the 7-attempt drift at 420ms the comment cites. Do not delete it.
>
> `test/ui/server.test.ts` · `const IDLE = 1_000;` (gone 2026-09-03) — sets IDLE to 1000ms and sleeps 900, a 100ms
> margin. When the box stalls, the IdleMonitor fires and `closeAllConnections()`
> tears the socket down mid-request, so the fetch fails with ECONNRESET rather than
> the assertion failing. Not the `stream < IDLE + 500` band that was flagged as the
> risk. Fix: raise IDLE to ~5000 and sleep 4500 — same ratio, same control, twenty
> times the absolute margin.
>
> Also named and NOT reproduced, worth recording: `test/docs/examples.test.ts`
> uses the only SHARED FIXED temp paths in the suite, so two concurrent runs delete
> each other's. Structurally real; six concurrent pairs did not trigger it.
