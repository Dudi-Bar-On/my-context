---
id: TASK-procedures-the-five-disclosures-and-the-zero-state-have-no
type: task
title: "Procedures: the five disclosures and the zero state have no pr. key, so the screen's only honest sentences are English"
status: active
severity: soft
always: false
summary: The screen's most useful footnotes exist only in English, and having nothing to list shows a blank space with no explanation.
summary_of: 232c98d2fadd4d0b
scope: []
tags:
  - v2
  - ui
  - i18n
  - walk
  - "screen:proc"
  - "plan:walk"
  - "seq:97"
  - "state:done"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: 1298ac2cb5021b90
plan: walk
seq: "97"
state: done
priority: "2"
progress: "0"
needs: walk/92
source: "plan:walk seq:27, measured against src/ui/public/screens/proc.js on 2026-08-29"
---

# Procedures: the five disclosures and the zero state have no pr. key, so the screen's only honest sentences are English

FOUND 2026-08-29 under plan:walk seq:27, from `screens/proc.js`'s header. Two gaps, one cause.

**1. THE DISCLOSURES ARE RENDERED IN THE SERVER'S ENGLISH AND `pr.` HAS A KEY FOR NONE OF THEM.** Both procedure routes carry a `disclosures` array -- five codes, each a fact true whether or not a response mentions it -- and `src/ui/proc-model.ts` says plainly that "A screen that renders the rows and drops the disclosures has re-created the silent drop they exist to end." So the screen renders them the way it renders an endpoint's `error` text: as they arrived, through `parts.js`' `errorNote` treatment, with nothing worded here.

The cost is that they stay English under `א`. And these are not incidental sentences: `ready-is-not-injected` is what explains the table/chip contradiction a reader is looking straight at, and `file-ticks-are-not-progress` is the one that contradicts the paragraph printed above it -- a hand-edited `- [x]` in the Markdown is a tick the audit log knows nothing about, the endpoint serves the LOG's replay in `step.checked`, and the disclosure is the only thing on screen that says the two can differ. A Hebrew reader gets the rows and not the reason.

**2. ZERO PROCEDURES DRAWS NOTHING AND SAYS NOTHING.** There is no `pr.empty` in either table, so there is no sentence to write -- the same call `gaps.js` and `work.js` both already make on their own screens. On a corpus with no procedures the `.two` grid holds the static `pr.write` card alone and nothing tells the reader whether that is an empty corpus or a screen that failed. `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` is the standard this fails, and the fix is one key.

WHAT MUST NOT HAPPEN, and the header is emphatic about it: zero procedures must NOT fall back to the mockup's own sample. `pr.item` is `{mv:item}`, a slot, so drawing it would invent `PROC-migrate-money-columns-to-integer-cents` and then offer `mycontext procedure done` on it from a Copy button. An invented id inside a `<code>` a copy button offers is the one thing this UI must never produce.

THE REASON THE FILE GIVES FOR KEYING NEITHER HAS EXPIRED -- `screens/proc.js` cites `strings-parity` "in the direction that names it", and that direction was dropped on 2026-08-26. See plan:walk seq:92, which this task waits on.

THE FIVE DISCLOSURE CODES ARE A CLOSED SET SERVED BY `src/ui/proc-model.ts`, so the keys are enumerable rather than open-ended -- one per code, in both tables, with the server's own sentence as the English value. Note the interaction with plan:walk seq:2, which scatters the disclosures back beside the cards they qualify: that task inherits the constraint that the foot card carries no `<h3>` because `pr.` declares no heading for one, and that constraint is also a consequence of the expired premise. Read the two together.
