---
id: CONST-no-http-route-accepts-sql-the-ask-screen-sends-a-structured
type: constraint
title: No HTTP route accepts SQL; the Ask screen sends a structured request
status: active
severity: soft
always: false
summary: No request may carry raw database language; a question travels as separate fields and the query is assembled safely at the other end.
summary_of: 20e03945a5e8609a
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-18
valid_until: null
checksum: 63456f35c220d91a
---

# No HTTP route accepts SQL; the Ask screen sends a structured request

readOnly: true is not a blanket guarantee. store.ts records the measurement: VACUUM INTO '<any path>' runs successfully on a { readOnly: true } connection and writes a full copy of the database to a filesystem path of the caller's choosing. assertSelectOnly in query.ts is the barrier, not the connection.

assertSelectOnly is also documented as incomplete — it does not see keywords inside backtick or [bracket] identifiers, both legal SQLite. For writes to dbPath itself the read-only connection covers that gap; for VACUUM INTO, which targets a different file, nothing does.

So the query is composed server-side from fields, operators and bound values. No attacker-controlled token reaches the SQL grammar. Where SQL text is assembled server-side at all, assertSelectOnly runs first.

None of the three web-UI plans mentions assertSelectOnly; plan 3 builds the Ask screen's server half on Store.raw.
