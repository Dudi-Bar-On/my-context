---
id: TASK-export-wire-screenpackmeta-which-is-written-but-never-called
type: task
title: "export: wire screenPackMeta, which is written but never called"
status: active
severity: soft
always: false
summary: A safety check was thought to be unused and is not; the real gap turned out to be at a different door, so re-measure before changing anything.
summary_of: 6602324a5553d613
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
checksum: f2b47050f6cef64f
plan: export
seq: 8w
state: done
priority: "1"
---

# export: wire screenPackMeta, which is written but never called

MEASURED 2026-08-23, independently by two agents in the same wave, and it is the first thing to read here because the title says the opposite: screenPackMeta HAS a call site. `src/pack/import.ts` · `screenPackMeta(manifest.name ?? '', manifest.version ?? '')` · ~333 calls it in planImport's step 3, alongside screenItem. The "nothing calls it" claim survives only at `test/pack/bundle.test.ts` · `are "screened by the Unicode screen", and` · ~38, where it is scoped to the export plan rather than stated generally.

RE-MEASURE BEFORE IMPLEMENTING. Wiring a second call to a function that is already called, on a path that already screens, is the failure this correction exists to prevent, and building against the title as written would be wrong.

The real hole this task was pointing at was elsewhere, and it was filed as TASK-pack-import-name-bypasses-refusepackname-and-screenpackmeta. As measured on 2026-08-23: `pack import --name` overrode the manifest name AFTER planImport had screened it (`src/cli/commands/pack.ts` · `const override = flag(args, 'name');` · ~514), and nothing re-checked the override. Both exited 0 and both were written verbatim into import.json - a name carrying U+202E RIGHT-TO-LEFT OVERRIDE, which the CLI then printed into its own outcome line, and a name carrying an embedded newline, which is the exact forgery refusePackName refuses on the manifest path.

RE-MEASURED 2026-09-03, and that second door is shut: the same line now hands the override to `src/cli/commands/pack.ts` · `function refuseOverrideName(value: string, version: string): NameRefusal | null {` · ~432, which screens it through screenPackMeta and refuses the whole import rather than normalising anything.

So the sentence this task turned on is the part worth keeping, and it is the reason the second door was found at all: a screen that is not called is worse than no screen, because the next reader sees the export and assumes the door is guarded.

WHAT WAS BELIEVED WHEN THIS WAS FILED, kept whole because the reasoning outlived the reading that produced it. Found by the agent that wrote it, in the same breath as writing it: src/pack/screen.ts exports screenPackMeta and nothing calls it, so a stranger's pack name carrying U+202E reaches every surface that prints it - the CLI listing, the UI, the audit line - with the screen sitting unused beside it. test/pack/bundle.test.ts already records the gap and names the seam: refuseMeta in manifest.ts, which guards the triple in both directions. Task 8 did not ask for the wiring and the agent correctly did not improvise it.
