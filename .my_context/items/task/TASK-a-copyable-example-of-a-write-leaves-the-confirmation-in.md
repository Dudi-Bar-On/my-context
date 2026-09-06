---
id: TASK-a-copyable-example-of-a-write-leaves-the-confirmation-in
type: task
title: a copyable example of a write leaves the confirmation in place
status: active
severity: soft
always: false
summary: An example someone copies from the help does not skip the step that shows them what it is about to do.
summary_of: e316a43f42a00470
scope:
  - src/ui/read-model-cli-help.ts
tags:
  - v2
  - ui
  - help
  - safety
  - "plan:library"
  - "seq:7"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 94f8084a348b862a
plan: library
seq: "7"
state: todo
priority: "2"
---

# a copyable example of a write leaves the confirmation in place

Owner ruling 2026-09-07. The help card generates a worked line for every command, and for a WRITE
that line carried --yes. The lane followed the README generated examples, which do the same, and
flagged it rather than inheriting the decision. It was right to ask.

RULED: DROP --yes FROM THE HELP-CARD EXAMPLES.

THE DISTINCTION IS THE SURFACE, not the flag. The README is a place a reader READS. The help card
sits beside a Copy button and is a place a reader COPIES FROM - and a line copied from it runs
against their real corpus. With --yes on it, the first thing a new reader ever runs is a write that
skipped the preview they had not yet learned exists.

WITHOUT IT THE EXAMPLE LOSES NOTHING. It still demonstrates every switch, which is what it is for.
And the reader meets the confirmation, which is the product working as designed rather than an
obstacle to route around.

SCOPE: the generated example on the help card only. The README examples are gen-doc-examples.ts
output that runs against a committed fixture and pastes true stdout - they are not copied from and
they must keep whatever flags make them reproducible. Do not change them, and do not change
gen-doc-examples.ts.

AND CHECK WHETHER DROPPING IT CHANGES THE PARSE. The line is put through the same checker the CLI
refuses with, and it must still be accepted afterwards. If any command REQUIRES --yes to parse,
that is a finding rather than a reason to keep it - say so.
