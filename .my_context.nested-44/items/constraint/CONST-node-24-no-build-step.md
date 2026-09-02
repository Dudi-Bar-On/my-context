---
id: CONST-node-24-no-build-step
type: constraint
title: Node 24 or newer, and no build step
status: active
severity: hard
always: true
scope: []
tags:
  - packaging
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 8556f3d922e552fe
---

# Node 24 or newer, and no build step

Source is `.ts`, executed directly by Node 24’s native type stripping. There is no
compile step and no `dist/`. Hooks and the CLI run the TypeScript sources as shipped.

## Observations
- [limit] Node >= 24.0.0 — required for stable node:sqlite and native type stripping
- [rule] Only erasable TypeScript syntax: no enum, no namespace, no parameter properties
- [rule] Every relative import carries an explicit .ts extension

## Relations
- enforced_by [[RULE-erasable-syntax-only]]
