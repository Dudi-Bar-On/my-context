---
id: TASK-the-composer-has-two-run-buttons-and-they-disagree-about
type: task
title: Run is removed from the composer, and Execute is the only verb
status: active
severity: soft
always: false
summary: The command builder loses the older of its two run buttons, so the two can never disagree again.
summary_of: e61eaf0b1a62f604
summary_was:
  - 2026-09-06 Two ways of running the same composed command on one screen return different answers.
scope:
  - src/ui/public/lib/palette-defs.js
  - src/ui/read-model.ts
tags:
  - v2
  - ui
  - composer
  - "plan:builder"
  - "seq:15"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: a243799c6498a568
plan: builder
seq: "15"
state: todo
priority: "2"
---

# Run is removed from the composer, and Execute is the only verb

RE-CUT 2026-09-06 by owner ruling. The task was "reconcile two run buttons that disagree"; it is
now "remove the older one". See `DEC-run-is-removed-execute-is-the-only-way-to-run-what-the`.

HE ASKED THE QUESTION NOBODY HAD: "why do we need run? because after execute we get run it so maybe
the run actually not required?" Measured, and he was right. `readTarget` arrived in `e5696b9` when
the console was read-only and could not run anything; Execute arrived later in `3702b1a`. Run
covers ~6 read entries, Execute covers 29, and every entry with Run also has Execute. Run is the
older mechanism kept past the arrival of its replacement.

WHAT TO REMOVE, and the shape is the point: `readTarget`, the `endpoint` and `screen` fields on the
catalogue entries that carry them, the Run control, `pal.run` and its Hebrew twin, and whatever
result-rendering exists ONLY for the fetch path. `resultRows` is shared with Execute’s own
rendering - check before deleting rather than after.

WHAT MUST SURVIVE: clicking an id in a result opens the item pane. `builder/13` made that work for
BOTH the structured cell and the text output, and the text path is the one that remains. If the
structured path was the only one tested anywhere, the test moves rather than dies.

THE THREE DEFECTS THIS CLOSES BY CONSTRUCTION, none of which needs its own fix afterwards:
  - `mycontext list rule` answered 966 rows of every type where the CLI answers 52.
  - `mycontext help slash` navigated to a screen drawing 4 of the 7 topics its own picker offers.
  - `pal.run` and `exec.btn` were BOTH `הרצה` - two adjacent buttons, identical Hebrew label. The
    owner chose `הצגה` for Run before this ruling; that choice is MOOT and must not be applied.

AND THE GLOB HEADER, carried from the original item and still true: its comment claims a 200-file
cap, which IS real - 200 rows drawn of 1,298 counted. A previous lane misread the count line and
called the comment stale. The genuinely stale figure beside it (a walk measured at 690, now ~1,298)
was already corrected. Nothing further is owed here; this paragraph exists so it is not re-found.

BOTH LANGUAGES, and the removal is where a string table goes stale silently: a key deleted from one
and left in the other passes every visual check.
