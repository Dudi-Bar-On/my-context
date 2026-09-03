---
id: RULE-erasable-syntax-only
type: rule
title: Do not use non-erasable TypeScript syntax
status: active
severity: hard
always: true
summary: A few pieces of TypeScript must never be used here, because this project strips types instead of compiling them, so those pieces read fine and break when run.
summary_of: c214af383ae776d0
scope: []
tags:
  - typescript
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 7b0809d20f8b07fa
directive: dont
---

# Do not use non-erasable TypeScript syntax

No `enum`, no `namespace`, no constructor parameter properties. Node strips types
rather than compiling them, so non-erasable syntax fails at runtime while looking
perfectly valid to a reader. A category list is exactly where `enum` is tempting.

## Observations
- [rule] Use string-literal union types and plain objects instead of enum
- [enforcement] tsconfig sets erasableSyntaxOnly, which requires TypeScript 5.8.2 or newer
