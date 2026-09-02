---
id: CONST-zero-runtime-dependencies
type: constraint
title: The shipped plugin has zero runtime dependencies
status: active
severity: hard
always: true
summary: Nothing the plugin needs at run time is downloaded, which is what lets it start in milliseconds and drop into any repository.
summary_of: 6554562cff685fe1
scope: []
tags:
  - packaging
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: a9060210a8e33609
---

# The shipped plugin has zero runtime dependencies

`dependencies` is empty and stays empty — package.json declares no runtime
dependency at all. A plugin that installs cleanly without a package fetch is
what makes hooks start in tens of milliseconds and what lets the plugin be
dropped into any repo.

devDependencies are permitted and enumerated. Today they are three:
`typescript`, `@types/node` and `@playwright/test`. The browser suite was
admitted deliberately and on the record — a test tool violates neither the
runtime rule nor the no-build-step rule, and it was the first test dependency
this project took, everything before it running on `node:test` alone. A
fourth is a ruling to record, never a commit to make.

NOTHING CHECKS THIS AUTOMATICALLY. No `check:*` script and no CI step reads a
dependency list, so a runtime dependency added in a pull request goes green.
The guarantee is held by review.

## Observations
- [limit] No runtime dependency may be added to package.json #packaging
- [consequence] The MCP server in Plan 3 must speak JSON-RPC by hand rather than using the SDK
- [consequence] The frontmatter parser is hand-written rather than using a YAML library
