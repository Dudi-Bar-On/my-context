---
id: REQ-a-bounded-list-gives-the-reader-a-way-to-reach-what-it-held
type: requirement
title: a bounded list gives the reader a way to reach what it held back
status: active
severity: hard
always: false
summary: A list that shows only part of what it holds must give the reader a way to reach the rest, and say where in the whole they currently are.
summary_of: c10239ca11651009
scope: []
tags:
  - v2
  - owner-requirement
  - ui
  - lists
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: f6572936cd4792c2
kind: functional
---

# a bounded list gives the reader a way to reach what it held back

OWNER REQUIREMENT, 2026-08-27: "we defined that we are listing a limited number of records, that works but i could not find a button or a different control that let the user get the next or the previous batch of records".

HE IS NAMING A HOLE IN A RULING HE ALREADY MADE. REQ-every-list-and-table-declares-what-leaves-it-and-when is hard, and `boundedList` satisfies it: every list says how many it holds and how many it held back. **Declaring is necessary and it is not sufficient.** A list that says "20 of 2,076" and offers no way to reach the other 2,056 has told the truth and left the reader stuck.

AND IT IS THE SAME GAP AS THE AUDIT STREAM, which he reported in the same breath. There the bound is time rather than count -- the feed starts at the end of the log -- and there is likewise no way back. One requirement covers both: **a bound the reader cannot cross is a bound that hides the corpus.**

WHAT THIS DOES NOT MEAN. It is NOT "raise the cap" and it is NOT "add paging to everything". The bound stays; the ruling that records bound by TIME and computations by ADMISSION ORDER stays. What is added is a way THROUGH it, and the shape may differ per surface: next/previous for an ordered table, "show N more" for a feed, a jump to the far end for a log.

WHAT MUST BE TRUE, and these are the conditions:

1. Every bounded list and table offers a way to reach the batch it held back -- forward AND back, because a reader who steps past what they wanted must be able to return.
2. The control says WHERE YOU ARE, not merely that more exists. "20 of 2,076" is a fact; "rows 21-40 of 2,076" is a position.
3. The bound and the control agree. A list that holds back nothing draws no control -- an inert control is the same lie as a blank screen.
4. It works from the keyboard, and it announces the move. A reader who cannot see the table changing is the one who most needs telling it did.
5. **No surface silently re-reads the whole corpus to answer "next".** The bound exists because unbounded reads are the defect; paging that loads everything and slices it has kept the display bound and thrown away the reason for it.

WHERE IT APPLIES: every screen using `boundedList` / `BOUND_CAP_LIST` / `BOUND_CAP_TABLE`, and the audit stream's backlog. Enumerate them before building -- `plan:walk seq:45` bound them and its list is the starting inventory.
