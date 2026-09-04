---
id: TASK-the-audit-stream-shows-almost-nothing-of-what-the-log-holds
type: task
title: the audit stream shows almost nothing of what the log holds, so a reader watching it sees a fraction of the record
status: active
severity: soft
always: false
summary: The screen displayed seven rows while ninety-two step records from the last hour sat in the log unshown.
summary_of: adce8acebb0f11c5
scope:
  - src/ui/public/screens/watch.js
  - src/ui/server.ts
  - e2e/watch-feed.spec.ts
tags:
  - v2
  - ui
  - watch
  - audit
  - "plan:live"
  - "seq:16"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: fc900a6696a77d1b
plan: live
seq: "16"
state: done
priority: "1"
verified_on: 2026-09-04
---

# the audit stream shows almost nothing of what the log holds, so a reader watching it sees a fraction of the record

Measured on the live screen 2026-09-04, immediately after the owner said the details were not there. The audit stream drew 7 rows, of which one was a step, while the log held 92 step records written in the previous hour. A page left open longer had shown 50 to 60. So what a reader sees appears to depend on how long the page has been open rather than on what the log contains, and a freshly opened page shows almost nothing.

The likely mechanism, stated as a hypothesis to test rather than a conclusion: the watch tests describe the stream as replaying a bounded backlog ON REQUEST. If the page connects and renders only records arriving after that moment, everything written before it opened is invisible however much exists. That would explain both observations without either being a fault in the grouping or in the hooks, which were measured working.

What to establish first, before changing anything: whether the backlog is requested at all on a normal page load, what bound it uses, and whether the records shown are filtered by session as well as by count. Only then decide what a reader should see when they open the screen.

The owner watches this screen in real time and has now reported three times that he cannot see what the log records. Twice the explanation was elsewhere and wrong. This is the surface between the two, and it was never measured until he insisted.
