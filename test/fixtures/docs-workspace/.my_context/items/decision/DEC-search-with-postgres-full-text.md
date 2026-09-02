---
id: DEC-search-with-postgres-full-text
type: decision
title: Search with Postgres full text
status: active
severity: soft
always: false
summary: Search is built on the database the project already runs, rather than on a separate search product.
summary_of: f76c155af603f5f8
scope: []
tags:
  - search
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-14
valid_until: null
checksum: e601eccf9a2f7682
---

# Search with Postgres full text

Postgres full-text search answers catalogue queries in under 40 ms at our present
40,000 titles, and it adds no service to operate or pay for. Elasticsearch is the
answer if faceting or typo tolerance becomes a requirement; neither is one today.

## Observations
- [supersession] Replaces OPENQ-which-search-engine: Answered: Postgres full-text search is fast enough at our catalogue size.

## Relations
- supersedes [[OPENQ-which-search-engine]]
