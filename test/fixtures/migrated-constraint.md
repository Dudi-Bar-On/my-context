---
id: CONST-connection-pools-are-capped-at-twenty
type: constraint
title: Connection pools are capped at twenty
status: active
severity: hard
always: false
summary: Every worker shares one small fixed budget of database connections.
summary_of: 8d261201df15331f
scope:
  - src/db/**
  - migrations/**
tags:
  - database
  - ops
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 6d2d43ddad26f955
---

# Connection pools are capped at twenty

The database allows a hundred connections and four services share it, so no service may take more than a quarter of them.

## Observations
- [limit] Pool size must never exceed 20 across all workers
- [note] Recovered from the 2026-08-13 incident review.
- [exception] The migration runner may open a second pool while a migration runs
- [invariant] `max_connections` is 100 and the four services share it, so a worker's own retry loop counts against the cap [admin sessions included]
