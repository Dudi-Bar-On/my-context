---
id: KNOWN-repo-containment-guard-is-defeated-across-windows-drive
type: known_issue
title: Repo-containment guard is defeated across Windows drive letters
status: active
severity: soft
always: false
summary: The check that keeps source files inside the project lets anything on another drive through, so an entry can point at a file no copy will ever have.
summary_of: b45f743532533bff
scope: []
tags:
  - windows
  - paths
  - validation
  - security
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-19
valid_until: null
checksum: 09d65d2a5d391a5f
---

# Repo-containment guard is defeated across Windows drive letters

`readSnapshot` refuses a source document outside the repository, and on Windows
that guard is defeated whenever the source is on a **different drive letter**
from the repository.

**The mechanism.** The check computes `path.relative(repoRoot, sourcePath)` and
rejects the result when it is `''`, `'..'`, or starts with `'../'`. Across
drives, `path.relative('D:\\repo', 'C:\\Users\\...\\Temp\\x.md')` cannot express
a relative walk, so Node returns the **absolute** path `C:/Users/.../Temp/x.md`.
That string is neither `'..'` nor `'../'`-prefixed, so it passes.

**Where it is.** `my-context/src/core/reference.ts` · `that climbs out of the repository names something` · ~193, and two copies of the
same containment test in `my-context/src/doctor/checks.ts` (around lines 213-215
and 262-268). Because doctor carries its own copy, doctor also reads the
out-of-repo file rather than reporting it as out of bounds.

**How it was found.** Not by reading the code. `mycontext add rule --file` was
pointed at a scratchpad path under `C:\Users\...\Temp\` from a repository on
`D:\`, and it was accepted and snapshotted — by a command whose own error
message says an out-of-repo source is refused. Confirmed afterwards by executing
`path.relative` across the two drives.

**Why it matters beyond tidiness.** The guard exists so a snapshot cannot record
provenance the repository cannot verify or carry. Defeated, an item can be
created whose `source_file` names a path that no clone will ever have — and on a
temp path, one that will not survive the week. `doctor` then reports
`source_missing` at **error** level, so `mycontext doctor` exits 1 for a
condition the product's own validation was supposed to prevent.

**The fix is not to add `..` cases.** The correct test is whether the resolved
source path is contained by the repository root, which requires comparing
resolved absolute paths (and on Windows, comparing the root/drive) rather than
inspecting the shape of a relative string. Three call sites share this logic and
should share one function; the duplication is why the same defect exists three
times.
