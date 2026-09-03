---
id: TASK-export-wire-screenpackmeta-which-is-written-but-never-called
type: task
title: "export: wire screenPackMeta, which is written but never called"
status: active
severity: soft
always: false
summary: A safety check was thought to be unused and is not; the real gap turned out to be at a different door, so re-measure before changing anything.
summary_of: fb66ee914ea0048a
acknowledged:
  - body_disagrees_with_meta@316c83a0174520ce
  - citation_form@316c83a0174520ce
scope: []
tags:
  - "plan:export"
  - "seq:8w"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 85cceb5e4fc93108
plan: export
seq: 8w
state: done
priority: "1"
---

# export: wire screenPackMeta, which is written but never called

Found by the agent that wrote it, in the same breath as writing it. src/pack/screen.ts exports screenPackMeta and nothing calls it, so a stranger's pack name carrying U+202E reaches every surface that prints it - the CLI listing, the UI, the audit line - with the screen sitting unused beside it.

test/pack/bundle.test.ts already records the gap and names the seam: refuseMeta in manifest.ts, which guards the triple in both directions. Task 8 did not ask for the wiring and the agent correctly did not improvise it.

A screen that is not called is worse than no screen, because the next reader sees the export and assumes the door is guarded.

CORRECTION, 2026-08-23 - THE PREMISE ABOVE IS STALE, and building against it as written would be wrong.

Measured independently by two agents in the same wave: screenPackMeta DOES have a call site. `src/pack/import.ts` · `screenPackMeta(manifest.name ?? '', manifest.version ?? '')` · ~333 calls it in planImport's step 3, alongside screenItem. The "nothing calls it" claim survives only at `test/pack/bundle.test.ts` · `are "screened by the Unicode screen", and` · ~38, where it is scoped to the export plan rather than stated generally.

RE-MEASURE BEFORE IMPLEMENTING. Wiring a second call to a function that is already called, on a path that already screens, is the failure this correction exists to prevent.

The real hole this task was pointing at is elsewhere and is now filed as TASK-pack-import-name-bypasses-refusepackname-and-screenpackmeta: `pack import --name` overrides the manifest name AFTER planImport has screened it (`src/cli/commands/pack.ts` · `const override = flag(args, 'name');` · ~514), and nothing re-checks the override. Measured, both exit 0 and both written verbatim into import.json: a name carrying U+202E RIGHT-TO-LEFT OVERRIDE, which the CLI then printed into its own outcome line, and a name carrying an embedded newline, which is the exact forgery refusePackName refuses on the manifest path.

So "a screen that is not called is worse than no screen" still stands, and is still true of this codebase - at a different door than this task names.
