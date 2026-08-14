---
id: STD-documentation-is-regenerated-not-edited-to-match
type: standard
title: Documentation is regenerated, not edited to match
status: active
severity: soft
always: false
scope:
  - README.md
  - docs/README.he.md
  - scripts/gen-doc-examples.ts
tags:
  - docs
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-14
valid_until: null
checksum: e51bc9a5e907c311
---

# Documentation is regenerated, not edited to match

Example output in README.md and docs/README.he.md is produced by scripts/gen-doc-examples.ts, which runs the real command against the committed fixture in test/fixtures/docs-workspace. When a block goes stale the fix is running npm run gen:docs, never editing the pasted text so it agrees with the prose. Four tests hold the line: test/docs/inventory.test.ts (every CLI command, slash command and MCP tool is documented, and nothing documented is missing), test/docs/examples.test.ts (every marked block is re-executed against the fixture and diffed), test/docs/injection.test.ts (the four injected-context blocks, which gen:docs cannot fill because no CLI command renders a selection, are quoted verbatim in both documents), and test/docs/parity.test.ts (both documents carry the same heading-depth sequence and the same example markers, in the same order). What none of them check: whether the prose is TRUE, and whether the Hebrew is current. They compare names, structure and output; a sentence that describes behaviour wrongly, or a Hebrew paragraph left behind by an English edit, passes all four. Both remain review obligations.
