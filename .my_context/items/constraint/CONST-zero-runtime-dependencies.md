---
id: CONST-zero-runtime-dependencies
type: constraint
title: The shipped plugin has zero runtime dependencies
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
checksum: dbc28c8eeedbcf2c
---

# The shipped plugin has zero runtime dependencies

Only `typescript` and `@types/node` are permitted, and only as devDependencies.
A plugin that installs cleanly without a package fetch is what makes hooks start
in tens of milliseconds and what lets the plugin be dropped into any repo.

## Observations
- [limit] No runtime dependency may be added to package.json #packaging
- [consequence] The MCP server in Plan 3 must speak JSON-RPC by hand rather than using the SDK
- [consequence] The frontmatter parser is hand-written rather than using a YAML library
