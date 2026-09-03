---
id: INV-posix-normalized-paths
type: invariant
title: Every stored path is POSIX-normalized
status: active
severity: hard
always: true
summary: File paths are stored one way only, with forward slashes, because a path written the other way matches nothing and the rule attached to it just stops firing.
summary_of: d752c638136dee47
scope: []
tags:
  - portability
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 1b64ec3f787bce5f
---

# Every stored path is POSIX-normalized

No backslash may reach the database or a glob comparison. A scope glob `src/db/**`
silently matches nothing against a stored `src\db\writer.ts`, and a constraint that
quietly stops activating is indistinguishable from one that was never written.

## Observations
- [rule] Paths cross the boundary through relPosix/normalizePosix in core/paths.ts
- [rule] Slugs use one deterministic case: uppercase prefix, lowercase body — Windows is case-insensitive, Linux is not
