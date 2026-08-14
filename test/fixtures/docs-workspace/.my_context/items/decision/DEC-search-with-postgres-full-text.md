---
id: DEC-search-with-postgres-full-text
type: decision
title: Search with Postgres full text
status: active
severity: soft
always: false
scope: []
tags:
  - search
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-14
valid_until: null
checksum: b59f9fb6a7962b4e
---

# Search with Postgres full text

Postgres full-text search answers catalogue queries in under 40 ms at our present
40,000 titles, and it adds no service to operate or pay for. Elasticsearch is the
answer if faceting or typo tolerance becomes a requirement; neither is one today.

## Observations
- [supersession] Replaces OPENQ-which-search-engine: Answered: Postgres full-text search is fast enough at our catalogue size.

## Relations
- supersedes [[OPENQ-which-search-engine]]
