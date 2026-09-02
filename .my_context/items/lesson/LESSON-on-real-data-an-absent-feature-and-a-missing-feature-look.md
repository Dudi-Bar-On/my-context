---
id: LESSON-on-real-data-an-absent-feature-and-a-missing-feature-look
type: lesson
title: On real data, an absent feature and a missing feature look identical
status: active
severity: soft
always: false
summary: A screen with nothing to show looks identical to a broken one, so every empty area costs an investigation before it can be called correct.
summary_of: 687b836f3a67148a
scope: []
tags:
  - v2
  - ui
  - method
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 54bd6e4f3a8a86c6
---

# On real data, an absent feature and a missing feature look identical

The Audit stream drew no token bars, no hatched voids and no gold regime rule. The tier ribbon drew no ghosts. The activity pulse drew nothing at all. Each looked exactly like a screen someone had failed to finish, and each cost a round of investigation to prove it was not.

None of them was missing code.

The token bars need an INJECTION record in the recent window, and this corpus's newest fifty audit records were all mutations, because the CLI writes mutations and nothing else was happening. The ghosts need the corpus to SPILL, and it holds 3,581 of a 16,000-token pinned budget, so it never does. The pulse buckets by ten seconds across twenty minutes, and nothing had happened in twenty minutes. The regime rule needs a focus change, and nobody had changed focus in days.

Every one of those is the product behaving correctly over the data it happens to have.

WHY IT COST SO MUCH

An absence and a defect are indistinguishable from the outside. The screen shows nothing either way. So every one had to be investigated as though it were a bug, and the investigation is the expensive part - not the fix, because there was no fix.

It also corrupted the instrument. screen-parity's ledger for the watch screen measured 15 gaps, then 8 an hour later as the corpus changed, then grew again when the pulse window emptied - an exact ledger over live data fails for reasons that are not regressions, which is the most expensive kind of red.

WHAT SETTLED IT

Creating the data. Two refused requests and one focus change, made deliberately against a live server, lit up the regime rule and the access rows within seconds. Firing the SessionStart hook by hand wrote a real injection record - 42 items, 13,080 tokens - and the gold token bar appeared immediately. The code had been right the whole time.

That is now the standing arrangement: [[DEC-the-ui-is-developed-against-a-simulated-corpus-until-the]], with the return to real data filed as the last UI task rather than left to memory.
