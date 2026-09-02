---
id: TASK-the-paste-hand-off-says-exactly-where-exactly-what-and-what
type: task
title: the paste hand-off says exactly where, exactly what, and what to do next
status: active
severity: soft
always: false
summary: Tell the reader step by step where a change goes in a file that already has entries, and how to check afterwards that it took effect.
summary_of: e1d26358e0e9d6cc
summary_was:
  - 2026-09-01 Tell the reader step by step where to paste a change, exactly where in the file it goes, and how to confirm it took effect.
scope: []
tags:
  - "plan:config"
  - "seq:4"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: afce13147f041c11
plan: config
seq: "4"
state: done
---

# the paste hand-off says exactly where, exactly what, and what to do next

OWNER INSTRUCTION 2026-08-23, added when approving the composer: "you should add very simple and cleare instructions to the user for how and exactly where to paste the file and what to do after that maybe a step by step wizard too".

THE GAP: composing the right bytes and leaving a person holding them is only half a hand-off. The screen already knows the absolute path of the file - `configPath` (read-model-config.ts) resolves it - and it knows whether the file exists, whether it parses, and what the candidate would change. None of that reaches the reader as instructions.

DO, as numbered steps rather than prose: the absolute path, spelled out and copyable; WHERE in the file the block goes, given what the file already contains - a first category and an added one are different edits and the screen knows which this is; the block itself, copyable in one gesture; and what to run afterwards to confirm it took. The confirmation step is the one that turns a paste into a settled change, and the screen can then re-read and show the new resolved config as the receipt.

HANDLE the case the reader will actually hit: the file already has a `categories` object, so the block is an entry inside it and not a top-level key. Getting that wrong produces invalid JSON and a refusal that reads like the wizard was wrong.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and it is the smallest of the four with the largest effect on whether the composer is usable at all.

Its argument is right and nothing has changed it: composing the right bytes and leaving a person holding them is half a hand-off. The screen already knows the absolute path (configPath in read-model-config.ts), whether the file exists, whether it parses, and what the candidate would change -- and none of it reaches the reader as instructions.

ONE THING THE RECONCILIATION ADDS. Its last paragraph -- the file already has a categories object, so the block is an entry INSIDE it and not a top-level key, and getting that wrong produces invalid JSON and a refusal that reads like the wizard was wrong -- is the acceptance test. Not a caveat: the test. A hand-off that is right for an empty config and wrong for a populated one will be wrong for every real user, because every real user has a populated one.

AND THE CONFIRMATION STEP IS THE PART THAT MAKES IT A COMPOSER RATHER THAN A CLIPBOARD: the screen re-reads and shows the new resolved config as the receipt. That is the same shape plan:walk seq:14 asks for when a simulated budget is carried to config, and the two should agree on one receipt rather than invent two.
