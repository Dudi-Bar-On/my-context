---
id: DEC-a-full-export-is-an-archive-to-copy-back-never-an-artefact
type: decision
title: a full export is an archive to copy back, never an artefact to import; --as-pack at export time makes the importable pack
status: active
severity: soft
always: false
summary: A whole-workspace export is meant to be restored by copying it back, not fed to the import command; the import command now refuses it in one sentence and points at the export option that produces a real pack.
summary_of: 384b0c79fc4acec4
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: 76313a5810220405
---

# a full export is an archive to copy back, never an artefact to import; --as-pack at export time makes the importable pack

Owner ruling, 2026-09-21 (release prompt, OWNER ANSWERS), recorded in release phase 3 on 2026-09-22. Ruling C. pack import of an artefact whose meta.kind is export exits 1 with one sentence: a full export is an archive to copy back, not to import; use --as-pack at export time. The dead export branch in src/pack/import.ts is deleted; the changelog line that claimed pack import reads a full export is corrected; README section 5, chapter 12 and their Hebrew editions say the same. Answers, on the command side, OPENQ-does-export-import-ever-import-or-is-a-third-of-that-screen; the screen side is walk/89 in phase 6. Landed as task 3.5 (B10) of release/3.

## Relations
- answers [[OPENQ-does-export-import-ever-import-or-is-a-third-of-that-screen]]
