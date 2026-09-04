---
id: TASK-fix-the-mv-monospace-regression-the-grammar-mandates-losing
type: task
title: "fix the {mv:} monospace regression - the grammar mandates losing it in transcription"
status: active
severity: soft
always: false
summary: The design marks paths and ids for special treatment and then discards it when copied across, so they display wrongly inside right-to-left text.
summary_of: d378a9a490eb7a09
scope: []
tags:
  - "plan:rulings"
  - "seq:12"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: acad3dcb2a87640f
plan: rulings
seq: "12"
state: done
progress: "100"
priority: "1"
source: "docs/design/web-ui-mockup.html#i18n-grammar"
last_change: "2026-08-20T13:11:01Z"
---

# fix the {mv:} monospace regression - the grammar mandates losing it in transcription

The mockup distinguishes {v:name=sample} from {mv:name=sample} (monospace, for ids, branches, paths, scopes) — and then its own grammar comment mandates that BOTH transcribe to plain {name}. So the distinction is declared and immediately discarded.

Nine slots across seven keys are affected. Two regressed visibly: cap.already shipped as 'Already governing {m:src/billing/**}' and pr.item as '{m:PROC-...}'; they now ship as '{scope}' and '{item}'. These are branch names, commit sha-1s, globs and item ids inside RTL prose — exactly what {m:...} exists to isolate.

The mockup changes FIRST, per the pinned rule: the grammar comment must say a monospace slot transcribes as {mv:name}. Then the tables are regenerated. Then plan 3's strip.* declarations follow — it currently declares plain {branch}/{commit}.

Nothing consumes the grammar yet: there is no t() in src/ui until Task 16, so this is spec and tables only. The doc must state what t() will have to do with {mv:name} when it is built.
