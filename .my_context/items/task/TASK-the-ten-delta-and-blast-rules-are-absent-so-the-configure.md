---
id: TASK-the-ten-delta-and-blast-rules-are-absent-so-the-configure
type: task
title: the ten delta and blast rules are absent so the Configure panes render unstyled
status: active
severity: soft
always: false
summary: The settings screen draws panels with no styling at all, so a warning that sixty-six things stop reads like an ordinary paragraph.
summary_of: 1a4607d67700762f
scope: []
tags:
  - v2
  - ui
  - config
  - walk
  - "plan:walk"
  - "seq:112"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/blast.md"
source_anchor: null
source_checksum: f00a2b8830cb212e
valid_from: 2026-08-30
valid_until: null
checksum: dc33ad934428ce44
plan: walk
seq: "112"
state: done
priority: "1"
source: "split from plan:walk seq:10, 2026-08-30"
---

# the ten delta and blast rules are absent so the Configure panes render unstyled

> > Split out of `plan:walk seq:10` on 2026-08-30, when the blocker it was waiting on disappeared.
>
> **The state**
>
> Configure now draws four composer panes, each with a delta plate and a blast panel. **The ten `.delta` / `.blast` rules are absent from `styles.css`**, so all of that markup renders unstyled — no flex gap, no strike-through on what stops being injected, no coloured border separating a face that says "66 items stop" from one that says "no change".
>
> **Why it was declined, and why that reason is gone**
>
> The stylesheet's own note declined the carry *"for markup nothing renders"*. That was true when it was written. Something renders it now — `config.js` draws `div.blast` and `div.delta` on every pane, and `screen-parity`'s config ledger shrank by one because `div.blast` is built.
>
> So this is a plain carry with no blocker left, and it is the difference between a screen that composes a change and a screen a reader can act on.
>
> **The measured stakes, from the lane that built it**
>
> The blast faces carry real numbers: profile `standard → minimal` stops injecting **66** items; `pinned 16000 → 4000` spills **16**; `agentEdits review → allow` moves **39**. Undifferentiated, those read as ordinary paragraphs — and the whole point of the panel is that a change which governs 66 items should not look like one that governs none.
>
> **Done when**
>
> The ten rules are carried into `styles.css` byte-identically from the design of record, `styles-parity` is green, and a browser test asserts the **computed** difference between a face that reports a change and one that reports none — not the presence of a class.
