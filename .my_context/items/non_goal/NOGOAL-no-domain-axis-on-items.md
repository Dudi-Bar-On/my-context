---
id: NOGOAL-no-domain-axis-on-items
type: non_goal
title: No domain axis on items
status: active
severity: hard
always: false
summary: Entries will not gain another grouping label on top of the ones they have, because nobody asked twice and every part of the tool would have to learn it.
summary_of: df2457d491c78b1f
scope:
  - src/core/types.ts
  - src/core/config.ts
  - src/core/store.ts
  - src/cli/**
tags:
  - schema
  - roadmap
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-16
valid_until: null
checksum: 042c1db460687225
---

# No domain axis on items

Items are not given a `domain` field — a declared grouping above category, drawn from a
closed set in `config.json`, that would disable a whole group's items from injection.

The corpus is already sliced four ways, and every one of them is built and in use: `scope`
globs decide activation by path, `tags` group freely and are queryable, the twenty
`categories` decide tier and id prefix, and `mycontext query` runs read-only SQL over the
whole index. A fifth axis is surface nobody asked for twice, and it is not free — it would
add a dimension to config, to the store, to every reporting command, to the injection
filter and to a migration for every item written before it.

This retires REQ-items-carry-a-domain, which asserted the opposite as a `hard` requirement.

## Observations
- [supersession] Replaces REQ-items-carry-a-domain: Decision Q1 of the production-grade plan (2026-08-16): domains are dropped. Scope globs, tags, categories and SQL already slice the corpus four ways, and a fifth axis is surface nobody asked for twice.

## Relations
- supersedes [[REQ-items-carry-a-domain]]
