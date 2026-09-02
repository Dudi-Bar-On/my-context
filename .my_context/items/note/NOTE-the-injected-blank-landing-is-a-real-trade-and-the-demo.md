---
id: NOTE-the-injected-blank-landing-is-a-real-trade-and-the-demo
type: note
title: the injected blank landing is a real trade, and the demo corpus is too small to have both
status: active
severity: soft
always: false
summary: Two screens compete for the same small pool of sample data, so making one look right empties the other, and only a larger pool fixes both.
summary_of: e3d40173af42a405
scope: []
tags:
  - v2
  - ui
  - testing
  - fixture
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-26
valid_until: null
checksum: 3986c10d9c9b4a78
---

# the injected blank landing is a real trade, and the demo corpus is too small to have both

MEASURED 2026-08-26 by A/B, against `plan:walk seq:35` and `plan:walk seq:44`.

`scripts/demo-corpus.ts` DELETES the newest numbered session s seen file, deliberately, so the preview has a full delivery to compute. The consequence is the defect seq:35 reports: Injected now defaults to that same session and lands on an EMPTY TABLE, on a screen whose own subtitle promises "what this context window actually received".

THE OBVIOUS FIX WAS TESTED AND IT IS A TRADE, NOT A FIX:

    seen file DELETED (today)   Injected now  0 rows      Delivered  4 rows
    seen file KEPT              Injected now  5 rows      Delivered  2 rows

Keeping it cures the blank table and CLOSES five or six of injected s ledger entries -- `button.linkid.m`, `span.chip.gov`, `span.chip.ok`, `td`, `td.m.small` -- and it halves the delivered pane, which is the scene the mockup draws with four blocks. Neither setting is right.

THE ROOT CAUSE IS THE POOL, AND IT IS ARITHMETIC. The fixture creates SIX pinned candidates and THREE scoped ones -- nine normative items in total -- and one session s delivery consumes about six of them. So a session that has already been injected into has almost nothing left to be injected again, and the two screens are competing for the same nine items. The seen file was deleted to hide that, and the comment saying so is accurate: "the newest one had nothing left and the scene had nothing to show".

WHAT WOULD ACTUALLY FIX IT: a normative pool several times larger, so a session can carry a real seen file AND still have a full delivery ahead of it. That is a content decision rather than a code one -- the bodies must be real short prose, because `TASK-the-demo-corpus-still-does-not-mirror-the-mockup-scene-and` records that filler bodies were the previous defect and the owner rejected them by name.

AND IT IS WHY THE NEW DISPLAY BOUNDS NEVER BITE HERE. With nine normative items against a cap of 20, every list on this corpus reads "Showing all N" -- correct, and no demonstration of the mechanism. The same arithmetic explains both symptoms, which is the argument for fixing the pool once rather than either symptom twice.
