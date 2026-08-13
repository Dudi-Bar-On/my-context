---
id: RULE-erasable-syntax-only
type: rule
title: Do not use non-erasable TypeScript syntax
status: active
severity: hard
always: true
scope: []
tags:
  - typescript
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 9238fc219d29328e
directive: dont
---

# Do not use non-erasable TypeScript syntax

No `enum`, no `namespace`, no constructor parameter properties. Node strips types
rather than compiling them, so non-erasable syntax fails at runtime while looking
perfectly valid to a reader. A category list is exactly where `enum` is tempting.

## Observations
- [rule] Use string-literal union types and plain objects instead of enum
- [enforcement] tsconfig sets erasableSyntaxOnly, which requires TypeScript 5.8.2 or newer
