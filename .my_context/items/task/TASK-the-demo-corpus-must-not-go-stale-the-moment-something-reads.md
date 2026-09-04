---
id: TASK-the-demo-corpus-must-not-go-stale-the-moment-something-reads
type: task
title: the demo corpus must not go stale the moment something reads it
status: active
severity: soft
always: false
summary: Refresh the sample project's records before the tests run, so that merely reading it once does not make almost every screen refuse.
summary_of: 1906ba1e70db8516
scope: []
tags:
  - v2
  - ui
  - fixture
  - e2e
  - tree-parity
  - "plan:walk"
  - "seq:0"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 02122e263a309605
plan: walk
seq: "0"
state: done
priority: "1"
source: "plan:port seq:98, decay"
---

# the demo corpus must not go stale the moment something reads it

Closes the known issue of the same date: reading the demo corpus makes it stale, and eighteen of twenty-one screens then refuse.

THE MECHANISM: `scripts/demo-corpus.ts` builds the audit projection as its last act, and it is right to. Every subsequent READ appends an `access` record to the log, and nothing re-syncs. One suite run is enough to put the projection behind, and it stays behind for every run after it.

THE FIX IS NOT to make the read surface sync. That refusal is correct and is the behaviour under test -- weakening it to make a fixture convenient would delete a real guarantee to hide a fixture bug.

THE FIX BELONGS IN THE HARNESS, which may write because it is not a read surface. The e2e `app` fixture starts a server over the corpus; the projection should be synced immediately before it serves, so every run begins from a corpus that can answer. `cli(["audit", "--limit", "1"])` is what the builder already uses.

CHECK THE SECOND PROJECTION TOO. The builder ends with `cli(["decay"])` for the LEDGER projection, which is a different store and was once missed entirely -- `/api/decay` answered `ledger: "not-projected"`, `series: []` on a build where the recency comb was written and correct. If the audit projection goes stale on read, establish whether the ledger one does as well rather than assuming it does not.

THE ACCEPTANCE TEST IS A MEASUREMENT, not a green tick: after the fix, re-run tree-parity and record the new totals against 182 / 97 STRUCTURAL / 14 DATA / 71 AMBIGUOUS and against the node deficits (decay 461, watch 180, simulate 116). How much of the inventory was this one defect is the number this task exists to produce.
