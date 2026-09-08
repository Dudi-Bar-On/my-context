---
id: TASK-the-parity-ledgers-are-re-derived-over-the-real-corpus-and
type: task
title: the parity ledgers are re-derived over the real corpus, and say which corpus and which day they record
status: active
severity: soft
always: false
summary: The screen comparison lists are rebuilt against the project real data, and record when and against what they were measured.
summary_of: d035d0b97fc67325
scope:
  - e2e/**
tags:
  - v2
  - testing
  - ui
  - "plan:port"
  - "seq:101"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 33f3710cfdbbf27f
plan: port
seq: "101"
state: todo
priority: "2"
---

# the parity ledgers are re-derived over the real corpus, and say which corpus and which day they record

Owner ruling 2026-09-08. The last two of the 54 specs that depended on the retired fixture.

THE STATE. screen-parity and tree-parity hold a SHRINK-ONLY ledger. Over the real corpus eight
screens report gaps that are not in the baseline - nineteen of them on `work` alone, and all
nineteen are ONE FACT: the Review queue is empty, so no card draws. The ledger is recording the day
rather than the code, which is exactly what the fixture existed to avoid.

THE RULING: RE-DERIVE THE BASELINE over the real corpus, ONCE, deliberately - and write into it WHEN
it was measured, against WHICH corpus, and at what size. A shrink-only ledger with no provenance is
a number nobody can argue with later.

AND IT IS ALREADY STALE AGAINST ITS OWN FIXTURE: screen-parity fails against .demo-corpus too, so
there is no clean baseline to preserve. Nothing is being thrown away by re-deriving.

THE COST, STATED RATHER THAN DISCOVERED: the baseline now drifts whenever the corpus changes shape.
That is the flaw the fixture was protecting against, accepted knowingly. If it proves unworkable the
answer is not to go back to a stand-in - it is to change WHAT THE LEDGER MEASURES, from kinds the
app drew today to kinds the code can draw at all. That is a separate design job and it is the real
fix; this ruling buys the time to do it properly.

plan:port seq:100 kept scripts/demo-corpus.ts with a RETIRED banner rather than deleting it, on the
reasoning that it is the only instrument that can produce the control half of a both-ways reading.
That reasoning now has a decision behind it.
