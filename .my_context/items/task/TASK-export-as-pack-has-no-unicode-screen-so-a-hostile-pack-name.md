---
id: TASK-export-as-pack-has-no-unicode-screen-so-a-hostile-pack-name
type: task
title: export --as-pack has no Unicode screen, so a hostile pack NAME can be written
status: active
severity: soft
always: false
summary: A shared bundle can be given a name full of deceptive invisible characters, because the check that catches them runs only when reading, not writing.
summary_of: 9268d6d65f18528d
scope: []
tags:
  - "plan:export"
  - "seq:19"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 37d75a5892e41983
state: done
plan: export
seq: "19"
---

# export --as-pack has no Unicode screen, so a hostile pack NAME can be written

Found 2026-08-23 while closing plan:export seq:15s at the IMPORT door, and it is the same defect at the EXPORT door.

MEASURED, with real commands: `mycontext export --as-pack --pack-name` and `--pack-version` carrying U+202E (right-to-left override), U+E0041 (Tags block) or U+200B (zero-width space) all EXIT 0, print to the terminal, and are written into `manifest.json`. A newline IS refused, so the guard is not absent - it is `refusePackName` without the Unicode screen beside it. `src/pack/bundle.ts` explicitly declines to call `screenPackMeta`.

This is exactly what seq 8w named - "a screen that is written and never called" - one door along, and seq 15s closed only the import side.

WHAT IT COSTS TODAY, stated honestly rather than inflated: the artefact is UN-IMPORTABLE. `pack import` and `init --pack` both refuse it, because the import side is now screened. So the cost is a pack you cannot give away, not a pack that lands somewhere hostile. That is why this is filed rather than hot-fixed - but it is still a name this product writes into a file it signs, and the terminal it prints to is the author's own.

DO: call the screen on the export path, the same way `pack.ts` now does on import - screen first, then refuse, because `refusePackName` interpolates the value it refuses and JSON.stringify escapes a newline while leaving U+202E raw.
