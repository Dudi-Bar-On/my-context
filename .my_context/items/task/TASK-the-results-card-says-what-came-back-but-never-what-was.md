---
id: TASK-the-results-card-says-what-came-back-but-never-what-was
type: task
title: the results card says what came back but never what was asked
status: active
severity: soft
always: false
summary: A person reading an answer on the command builder cannot see which command produced it.
summary_of: c4a869e2ce1b7137
scope:
  - src/ui/public/screens/palette.js
tags:
  - v2
  - ui
  - composer
  - "plan:builder"
  - "seq:14"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 25c3b1dc085b37f6
plan: builder
seq: "14"
state: todo
priority: "2"
---

# the results card says what came back but never what was asked

Owner request 2026-09-06 (plan D21), made while driving the Composer for real.

WHAT HE SEES TODAY, above the output: `exec.exit` ("exit {code}") and `exec.said` ("What the
command said"). Both describe the ANSWER. Neither names the QUESTION. He asked for the command
that was run to be shown alongside its results.

WHY THIS IS SMALL: the argv array is already in hand at execute time - `palette.js` around line
1296 carries `{ argv, id, values, ctx, copyBlocked }` into the execution path. Nothing needs to be
recomputed, re-derived or stored; the exact array that was executed is already beside the result.
Verify that rather than trusting it.

AND IT MUST BE THE ARGV THAT RAN, NOT THE LINE CURRENTLY COMPOSED. Those two drift the moment a
reader edits a field after executing - which is the ordinary way this screen is used. A card that
showed the live composed line beside a stale result would be worse than showing nothing, because it
would look like provenance while being a guess. If the two can differ, the card shows what ran.

THREE CONSTRAINTS THIS FILE ALREADY KNOWS: an argv element is text this app did not author, so it
is rendered as nodes and never as markup; it needs `<bdi>` isolation for the reason `argvChip`
already states in a comment, since this page is `dir="rtl"` in Hebrew; and any new sentence needs a
key in BOTH string tables.

ONE QUESTION FOR WHOEVER BUILDS IT: the screen already draws the composed line as argv chips
(`argvChip`, with a safe/unsafe distinction). Whether the executed command should reuse that
vocabulary or be plainer is a design choice - the chips carry a safety judgement that is about
composing, and a command that has already run is past that question.
