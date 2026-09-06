---
id: RULE-progress-is-reported-as-two-tables-with-stable-d-numbers
type: rule
title: progress is reported as two tables with stable D numbers, rebuilt from the corpus every time
status: active
severity: soft
always: true
summary: Progress is shown as two small tables whose numbering never changes, so the same subject can be named across sessions and what moved is visible at a glance.
summary_of: b7649c3eed4eebe2
scope:
  - **
tags:
  - v2
  - reporting
  - workflow
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 99e0b62af533d20d
---

# progress is reported as two tables with stable D numbers, rebuilt from the corpus every time

Owner instruction 2026-09-06, after he was shown this shape and asked for it as a standard.

TWO TABLES, in this order. First the subject area under discussion (e.g. "The Composer"),
keyed by item ref. Then THE D TABLE, keyed by D number. Three columns each: the key, the
status chip, and a short phrase - never a paragraph.

THE CHIPS, and they are not decorative - each says something different about WHO IS HOLDING IT:
  done       shipped and verified
  lane run   a lane is working it right now
  released   a ruling unblocked it; ready to dispatch, nobody dispatched it
  ready      unblocked, no lane, no ruling needed - or, in the D table, "needs you"
  held       blocked by a dependency, or deferred by the owner
The emoji spellings are, in that order: check / arrows / green circle / white square / pause.
"ready" carries two senses: in an item table it means dispatchable; in the D table it usually
means the OWNER must rule. Say which.

D NUMBERS ARE STABLE FOREVER. D6 is D6 in every future table. Never renumber, never reuse a
retired number, and append new subjects at the end. The whole value of the table is that he can
say "do D11" across sessions and compactions and mean one thing.

BOLD EVERY ROW THAT MOVED since the last time he was shown the table. He reads the diff, not
the table - an unbolded table of fourteen rows tells him nothing he did not already have.

REBUILD IT FROM THE CORPUS EVERY TIME. Read the item states off disk; never copy the previous
table forward and never render it from memory. This is the rule that gives the format its
point: on 2026-09-06 the rebuilt table caught that D6 said "21 BARE faults, deferred" when the
ruling had landed and the gate was red on 8 moved citations instead - a correction in his
favour that a copied-forward table would have carried wrong indefinitely.

AND SAY WHERE THE PREVIOUS TABLE WAS WRONG, in which direction, under the table. A row that
silently changes meaning is worse than one that never moved.
