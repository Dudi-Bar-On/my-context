---
id: TASK-five-browser-assertions-pin-a-number-that-only-holds-while
type: task
title: five browser assertions pin a number that only holds while nobody is using the product
status: active
severity: soft
always: false
summary: Five tests fail because the conversation files grew while the tests were reading them, which is what dogfooding means.
summary_of: 5e4f228b05f02f6c
scope:
  - e2e/conversations.spec.ts
tags:
  - v2
  - archive
  - test
  - "plan:archive"
  - "seq:54"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 190cb747f2c477e4
plan: archive
seq: "54"
state: todo
priority: "1"
---

# five browser assertions pin a number that only holds while nobody is using the product

MEASURED 2026-09-09 in the main session, twice, on either side of a revert.

e2e/conversations.spec.ts fails 5 of 66. The failures are content deltas, not rendering: one expects
record ids up to 315 and receives up to 312; the others are a fold, a step glyph, and an envelope
row. THEY ARE NOT CAUSED BY ANY CURRENT CHANGE - the same five fail with styles.css and
screens/conversations.js reverted to HEAD, which is how they were told apart from the seq:47 work.

THE CAUSE IS THE THING THIS PROJECT DECIDED TO DO ON PURPOSE. Tests run against the CURRENT corpus
and the CURRENT conversation files, and this session is being written into those files WHILE the
suite reads them - every lane dispatched adds a subagent file, every turn adds records. An assertion
that pins a record id or a count is therefore pinned to a corpus that moved.

AND THE OWNER RULING ON DOGFOODING IS NOT IN QUESTION HERE - "all your tests would be on the current
corpus because we are doing dog fooding" stands, and an exception has to be asked for. What is in
question is a DIFFERENT thing: whether an assertion is allowed to pin a value that only holds while
nobody is working. A test that fails because the product was used is not testing the product.

THE SHAPES THAT SURVIVE A GROWING CORPUS, and this is the work: assert RELATIONS rather than values
- that the last record on screen is the last record in the file, that the ids are contiguous and
ascending, that sum(span) === records - instead of that the last id is 315. Some of these tests
already do exactly that and pass; the five that fail are the ones that wrote a number down.

DO NOT reach for a frozen fixture corpus without asking. It is the obvious answer, it contradicts a
standing owner ruling, and the whole reason these tests find real defects is that they read what he
is actually looking at.
