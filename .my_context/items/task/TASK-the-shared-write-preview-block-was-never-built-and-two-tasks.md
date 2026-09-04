---
id: TASK-the-shared-write-preview-block-was-never-built-and-two-tasks
type: task
title: the shared write-preview block was never built, and two tasks were planned against it
status: active
severity: soft
always: false
summary: A before-and-after preview two finished jobs assumed existed and did not, since lifted out of one screen so every caller shares it.
summary_of: e78f819313f19aac
summary_was:
  - 2026-09-03 A shared before-and-after preview was never actually built, and two jobs marked finished were planned on top of it.
acknowledged:
  - citation_form@7f1ce3987645213c
scope: []
tags:
  - v2
  - ui
  - design
  - "plan:walk"
  - "seq:46"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-26
valid_until: null
checksum: edcbd9212ff90415
plan: walk
seq: "46"
state: done
priority: "1"
source: drift verification 2026-08-26
---

# the shared write-preview block was never built, and two tasks were planned against it

FOUND 2026-08-26 by the verification pass over `tag_projection_drift`, not by anything that was looking for it.

THE FACT. `plan:ui2 seq:11` is the declared PRODUCER of `writeBlock`. `plan:ui2 seq:12` and `plan:ui2 seq:13` both name it in their Interfaces as something they CONSUME. It exists nowhere: a repo-wide search for `writeBlock` in `src/` returns only substring matches on the unrelated `overwriteBlocked` in the pack importer. Neither does `diffBlock`, `renderConfigJson` or `buildCandidate`, which the same plans name.

SO TWO TASKS WERE PLANNED AGAINST A THING THAT WAS NEVER MADE, and both were marked done. seq:13 is the plainer casualty: `src/ui/public/lib/config-edit.js` does not exist, `config.js` · `config = await ctx.api('/api/config');` · ~1179 reads `GET /api/config` and nothing else, and `POST /api/config/check` and `/api/config/preview` are registered server-side (`read-model-config.ts` · `GET /api/config` · ~111, `365`) and never called. The screen s own test asserts the state of affairs rather than the intent: `config-screen.test.ts` · `POST /api/config/check` · ~128, "reads one endpoint and binds nothing that writes".

THE CAPABILITY IS NOT MISSING -- IT IS TRAPPED. `fieldView` at `lib/viewmodel.js` · `export function fieldView(field) {` · ~1589 already computes exactly the per-field before/after the write preview needs, and the Review queue already renders it. What was never done is LIFTING it out of one screen into something two other screens can call. That is a much smaller job than the absence suggests, and it is why this is filed as one task rather than as three unbuilt features.

AND IT IS NOW ON THE CRITICAL PATH. `DEC-the-web-ui-executes-a-composed-command-and-the-residual-is` rules that every command in the catalogue runs, and that a boundary-crossing one gets a STRONGER CONFIRM naming every field that changes, before and after -- the design names `fieldView` as the way it is rendered. So Execute needs the same lift. Building it twice, once for Configure and once for the confirm, is the outcome to avoid: this task exists to make it one.

WHAT TO DECIDE WHILE BUILDING IT: whether the shared unit keeps the name `writeBlock` the plans use, or whether `fieldView` is simply promoted and the plans corrected. The second is more honest -- the thing already exists and has a tested name -- and it costs two plan edits rather than a new vocabulary.
