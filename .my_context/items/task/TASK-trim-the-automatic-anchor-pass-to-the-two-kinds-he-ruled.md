---
id: TASK-trim-the-automatic-anchor-pass-to-the-two-kinds-he-ruled
type: task
title: trim the automatic anchor pass to the two kinds he ruled worth having
status: active
severity: soft
always: false
summary: Stopped bookmarking every turn that merely mentions a write-up, gave each bookmarked table a name a person can read, and took back the bookmarks the retired rule left behind — 613 became 565, and the one he made by hand is untouched.
summary_of: bc0b25c322b9175f
summary_was:
  - 2026-09-11 Stop bookmarking every turn that mentions a write-up, and give a bookmarked table a name a person can read instead of a stray border character — and take back the bookmarks a retired rule left behind, without touching the ones he made himself.
acknowledged:
  - task_unverified@c5a823d088e77c0a
scope:
  - src/cli/commands/conversation.ts
  - test/cli/**
  - test/core/**
tags:
  - v2
  - recall
  - "plan:recall"
  - "seq:5"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/item-body.md"
source_anchor: null
source_checksum: null
valid_from: 2026-09-11
valid_until: null
checksum: 03e790051e90c161
plan: recall
seq: "5"
state: done
priority: "1"
---

# trim the automatic anchor pass to the two kinds he ruled worth having

D42 Phase 1 landed automatic anchoring with three grammars — a table, a report, a ruling — and the
pass wrote 613 anchors into the live index overnight. He read the list on 2026-09-11, was shown
three options (trim it, keep all 613, drop automatic marking entirely) and RULED TO TRIM. Two
changes, and nothing else about anchoring moves:

1. THE REPORT DETECTOR GOES. It contributed 101 of the 613 and it marks a turn that MENTIONS a
   report, not a report. He judged those not worth having. Gone, not disabled behind a flag: the
   regex, the two probes that fed it, and the sentences that promised it.

2. THE TABLE LABEL IS FIXED. 25 anchors were labelled literally `|` and five more `|  |`: the
   label was the whole header row joined, and a header of empty cells joins to nothing but
   borders. A label is now the table's FIRST READABLE HEADER CELL — one carrying a letter or a
   digit in ANY script, because this archive is half Hebrew — and a label that is only punctuation
   or empty is never written. Where no header cell is readable the label is a stated fallback
   naming the column count instead.

THE RULING DETECTOR STAYS. He judged those the useful ones and nothing about what it matches
changed.

AN AUTOMATIC PASS THAT ONLY ADDS CANNOT CARRY OUT A TRIM. `markAutomaticAnchors` was idempotent by
construction and purely additive, so removing a detector would have left its anchors standing in
his index for ever, and the probes stop at 200 candidates each against 297 tables, so re-labelling
could not reach them either. The pass now SWEEPS the anchors it owns: every anchor whose origin is
`automatic` is read back at its own byte offset and put to the current grammar — a finding
re-labels it in place, no finding takes it back. It never touches an anchor whose origin is
`owner`, which is the defect that would be far worse than the one being fixed, and that is
asserted directly. A transcript that is gone, or an offset that reads as nothing, leaves its
anchor exactly where it is: silence is not evidence.

THE DROP IS SAID OUT LOUD — `INV-nothing-is-dropped-silently` in the direction that matters here.
The rebuild reports what it took back and what it re-labelled beside what it marked. The
re-labelled count watches BOTH paths: watching only the sweep reported 56 on a run that moved 345
labels, which reads as a total and is not one.

── WHAT IT DID TO HIS INDEX, 2026-09-11 ───────────────────────────────────────────────────────

                         before   after
  automatic / report        101       0
  automatic / ruling        214     264
  automatic / table         297     300
  owner     / note            1       1
  TOTAL                     613     565

THE 101 REPORTS DID NOT ALL VANISH, AND THE DIFFERENCE IS THE INTERESTING NUMBER. 53 were dropped
outright. The other 48 were RE-KINDED to `ruling`: they are turns HE typed that named both a dated
report path and a normative corpus id, and the old precedence tried report before ruling, so the
retired grammar had been hiding 48 rulings. They now carry the id as their label. The ruling
grammar was not touched — it simply gets to see them.

345 labels moved: the 297 tables re-derived from their own first header cell, plus the 48
re-kinds. Every one of the 30 unreadable table labels is gone, the 25 reading `|` among them, and
0 anchors now carry a label with no letter or digit in it. 30 anchors carry the stated fallback.
5 anchors were newly marked from transcript tails appended since the last run (3 tables, 2
rulings), which is why table went up rather than staying at 297.

HIS OWN ANCHOR SURVIVED BYTE FOR BYTE — `…:agent-a440b508f45e05e95:904023`, kind `note`, origin
`owner`, label "byte offset", stamped 2026-09-11T06:35:21.837Z before and after. A second rebuild
immediately after reported 0 new, 0 taken back and 0 re-labelled, so the pass is idempotent in
both directions now rather than only in the adding one.

NOT DONE HERE: `e2e/anchors.spec.ts` still expects three kinds and three rows. It belongs to the
browser lane that holds `e2e/**` and was left untouched on purpose.
