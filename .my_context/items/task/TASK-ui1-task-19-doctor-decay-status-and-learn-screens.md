---
id: TASK-ui1-task-19-doctor-decay-status-and-learn-screens
type: task
title: "ui1 task 19: Doctor, Decay, Status and Learn screens"
status: active
severity: soft
always: false
summary: "Four screens: what is wrong, what has gone unused, where things stand overall, and how to learn the tool."
summary_of: 61a1618eab7a2d7d
scope: []
tags:
  - "plan:ui1"
  - "seq:19"
  - "state:done"
  - v2
  - ui
  - "reconcile:rewritten"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 624ca264260458e6
plan: ui1
seq: "19"
state: done
progress: "0"
source: "my-context/docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md#task-19"
last_change: "2026-08-20T00:00:00Z"
priority: "3"
verified_on: 2026-09-05
---

# ui1 task 19: Doctor, Decay, Status and Learn screens

Doctor, Decay, Status and Learn screens

Task 19 of the ui1 plan. The full specification is the task section itself: my-context/docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md at line 6390 — that file is the authority, and this item tracks state only.

**Reconciliation against the visual repaint, 2026-08-21 (repaint plan Task 13) — REWRITTEN.** Status's verdict chip was specified as an emoji pair (warning/check); repaint Task 5 keeps no category or verdict glyphs at all, only six Tabler action glyphs and the tier mark, so a real verdict chip is the `.chip` primitive with a meaning hue, not an emoji. Doctor's three finding levels (error/warn/notice) were mapped through two utility classes that Task 16's reconciliation both retarget to `--crit`, which would collapse error and warn into one colour; they are remapped to `.chip.crit` / `.chip.gold` / plain `--dim` so the three levels stay distinct. The decay heatstrip's bar fill was a hardcoded hex on a retired placeholder token; it is now a class, `--ink` at reduced opacity, since a plain count is not one of the chip's four meanings. See docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md Task 19 for the corrected text.

VERIFIED PARTIAL 2026-08-26. Met: all four screens exist and the decay heatstrip is class-driven. NOT MET, and it is both of the reconciliation clauses: Status still ships the EMOJI - `status.js` · `screenHead(ctx, root, 'st.h', 'st.v', 'st.sub', '⚠️');` · ~74 passes the glyph directly, and `status.js` · `still an emoji and not a` · ~13 admits "this is still an emoji and not a .chip" - where the rewrite required a chip carrying a meaning hue. And doctor s three levels are NOT .chip.crit / .chip.gold / --dim: `doctor.js` · `tr.append(el('td', 'm', row.code));` · ~460 renders plain td.m and td.small rows under per-card headings, with no chip at all.
