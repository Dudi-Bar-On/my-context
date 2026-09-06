---
id: CONST-zero-runtime-dependencies
type: constraint
title: The shipped plugin has zero runtime dependencies
status: active
severity: hard
always: true
summary: Nothing the plugin needs at run time is downloaded, and an automated check now enforces that rather than a reviewer noticing.
summary_of: 977f51b5e884cb9b
summary_was:
  - 2026-09-06 Nothing the plugin needs at run time is downloaded, which is what lets it start in milliseconds and drop into any repository.
scope: []
tags:
  - packaging
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 7733ad6e72cb624d
---

# The shipped plugin has zero runtime dependencies

`dependencies` is empty and stays empty — package.json declares no runtime
dependency at all, and neither `optionalDependencies` nor `peerDependencies`
nor `bundledDependencies` (or its `bundleDependencies` spelling) carries one
either; every one of those is a fetch a consumer would pay for. A plugin that
installs cleanly without a package fetch is what makes hooks start in tens of
milliseconds and what lets the plugin be dropped into any repo.

devDependencies are permitted and enumerated. Today they are four:
`typescript`, `@types/node`, `@playwright/test`, `mermaid`.

The browser suite was admitted deliberately and on the record — a test tool
violates neither the runtime rule nor the no-build-step rule, and it was the
first test dependency this project took, everything before it running on
`node:test` alone. `mermaid` is admitted on 2026-09-07 on exactly that footing
and no wider one: `scripts/gen-diagrams.ts` renders the README diagrams with it
at authoring time, the SVG it produces is what is committed, and nothing the
plugin ships imports it — a build-time tool violating neither the runtime rule
nor the no-build-step rule. THE RULING IS LATE: it entered in `52f74e4` with
nothing recorded and went unnoticed for weeks, which is the evidence for the
paragraph below. A fifth is a ruling to record, never a commit to make.

THIS IS CHECKED, since 2026-09-07. `npm run check:dependencies`
(`scripts/check-dependency-budget.ts`) reads package.json and fails on any
runtime dependency at all — the case that actually matters — and on any
devDependency this item does not enumerate. It PARSES the sentence above
instead of keeping a second copy of the list, because a script holding its own
list is this same drift wearing a different hat. The anchor is the words
"Today they are", a spelled-out count, a colon, and the names in backticks up
to the full stop; the count is checked against the length of the list, so a
half-finished edit fails rather than quietly widening the budget. **Edit that
sentence and you edit the budget. Break its shape and the check goes RED, never
quiet.** `test/scripts/dependency-budget.test.ts` runs the same audit against
the real package.json, so the gate also rides `npm test` in CI.

What that replaces: until 2026-09-07 nothing checked this automatically. No
`check:*` script and no CI step read a dependency list, a runtime dependency
added in a pull request went green, and the guarantee was held by review —
which missed `mermaid` for weeks and then found it only by hand.

## Observations
- [limit] No runtime dependency may be added to package.json #packaging
- [consequence] The MCP server in Plan 3 must speak JSON-RPC by hand rather than using the SDK
- [consequence] The frontmatter parser is hand-written rather than using a YAML library
