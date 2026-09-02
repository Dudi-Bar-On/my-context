---
id: TASK-the-string-table-can-say-mono-and-nothing-else-no-bold-no
type: task
title: "the string table can say mono and nothing else: no bold, no italic"
status: active
severity: soft
always: false
summary: Text held for translation can mark code and nothing else, so bold and italic the design relies on are lost on every screen.
summary_of: fc115868b1070329
scope: []
tags:
  - v2
  - ui
  - tree-parity
  - strings
  - "plan:walk"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: f7e0f48d4231cdca
plan: walk
seq: "1"
state: done
priority: "1"
source: "plan:port seq:98, proc"
---

# the string table can say mono and nothing else: no bold, no italic

THE FINDING, from the proc walkthrough of plan:port seq:98.

Six of proc s twenty tree-parity divergences are ONE cause. {m:en.js} carries exactly one inline marker, {m:m:} for mono. The design of record uses {m:<b>} six times in this section and {m:<i>} twice, and the app can render neither.

The mockup: {m:<b>What is not relaxed:</b> the state ... it lets the agent <i>ask</i>}.
The app s pr.w3: the same sentence, flat.

That single gap produces findings #02, #07, #08, #17, #18 and #19 -- three ABSENT {m:b}, one ABSENT {m:i}, and two EXTRA spans which are the spans the mockup nests INSIDE the bold and the app therefore hangs one level too high.

WHY THIS IS NOT A PROC TASK. The vocabulary is shared by every screen that renders prose from the table, so the same gap is waiting on the other twenty. Fix it once, centrally, then re-measure: a real part of the remaining inventory is expected to fall out with it, and any screen that does NOT improve is telling us something different is wrong there.

WHAT THE WORK IS: give the table markers for bold and italic beside {m:m:}, teach the renderer to build the elements, and carry the emphasis into the en and he string values from the mockup. strings-parity compares both tables against the mockup s key set in both directions, so the he table is not optional.

DO NOT hand-write the emphasis by guessing which words look important. The mockup is the source: every {m:<b>} and {m:<i>} in the section is where the emphasis goes, and nowhere else is.

THE HEBREW IS RULED, 2026-08-25, and it changes what "carry the emphasis into
the en and he string values from the mockup" can mean.

There is nothing to carry it FROM. The mockup's 65 <b> and 10 <i> are all in
its ENGLISH markup; its Hebrew table is plain strings with no markup in any of
them, so the design of record silently drops every piece of emphasis when it
switches language. The owner ruled that the app does not copy that: both
languages get emphasis.

SO THIS TASK SPLITS, and the split is deliberate rather than a shortcut:

  ENGLISH  is derivable and exact. Every <b> and <i> in the mockup section is
           where the emphasis goes, and nowhere else is. An agent can do this.

  HEBREW   has NO source. Placing emphasis in a language by pattern-matching it
           is guessing, and guessing where a sentence puts its stress is not a
           thing to do quietly in a string table. The values are marked as
           needing the owner.

strings-parity compares KEY SETS in both directions and not marker content, so
a key that carries emphasis in en and not yet in he is structurally legal while
that lasts. Do not let that become permanent by forgetting it -- the ruling is
that Hebrew gets it, and a key still waiting is unfinished work rather than a
settled asymmetry.

Re-measured 2026-08-25 against a healthy fixture: 41 findings across 18 of the
21 screens.
