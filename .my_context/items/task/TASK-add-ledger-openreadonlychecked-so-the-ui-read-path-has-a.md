---
id: TASK-add-ledger-openreadonlychecked-so-the-ui-read-path-has-a
type: task
title: add Ledger.openReadOnlyChecked so the UI read path has a read-only door
status: active
severity: soft
always: false
summary: Give the read-only viewer a genuinely read-only way into the second database, so that simply looking at data cannot alter or create it.
summary_of: cf4488416504ea4a
scope: []
tags:
  - "plan:rulings"
  - "seq:13"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: bb0d24534787578a
plan: rulings
seq: "13"
state: done
progress: "100"
priority: "1"
source: "docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md#task-8"
last_change: "2026-08-20T14:07:51Z"
---

# add Ledger.openReadOnlyChecked so the UI read path has a read-only door

OWNER RULING, 2026-08-20. Section 0 says the UI's entry point is Store.openReadOnlyChecked, but withStores hands out a Store AND a Ledger, and Ledger has exactly ONE open — writable. So the correction was unsatisfiable in the plan: swapping the Store call alone would leave a writable Ledger connection against a database nothing prepared, which is worse than today.

Ledger.open's docblock is explicit: no corruption self-heal, does not set journal_mode = WAL, and it relies on Store.open having run first against the same dbPath in this process. A Ledger-only caller against a corrupt file throws; against an absent one it creates the database in ROLLBACK-JOURNAL mode rather than WAL. Two tests pin that.

That prerequisite exists only to make a WRITABLE ledger safe. A read-only Ledger needs neither half: it cannot write pages, and throwing on a corrupt file is correct for a read path rather than something to heal.

Mirror Store's existing pair exactly: open read-only, verify schema_version against SCHEMA_VERSION, throw naming the version on absent/stale/corrupt, and CLOSE the handle before the throw escapes — Store.openReadOnlyChecked and audit-db.ts both already do that. Then withStores opens both read-only and section 0 becomes satisfiable.

This is also what makes Task 13's new runtime no-write assertion pass: a writable connection can checkpoint or migrate.
