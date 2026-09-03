---
id: KNOWN-a-raw-sqlite-database-is-locked-refusal-reaches-a-rendered
type: known_issue
title: a raw SQLite "database is locked" refusal reaches a rendered screen
status: active
severity: soft
always: false
summary: When two sessions touch one workspace at once, a person can be shown a raw database-locked error on screen instead of a handled message.
summary_of: abf069d04299fc09
acknowledged:
  - citation_form@c7b79ea65f9668f9
scope: []
tags:
  - e2e
  - gates
  - port
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-test-mycontext-plugin/9e5b6b17-c186-4c93-a0a5-775b4eccd9e7/scratchpad/known-issue-db-locked.md"
source_anchor: null
source_checksum: null
valid_from: 2026-09-02
valid_until: null
checksum: be70feb58338de4a
---

# a raw SQLite "database is locked" refusal reaches a rendered screen

> # the raw SQLite refusal reaches a rendered screen, not just a log
>
> Measured 2026-09-02 while baselining the e2e suite (four full `npm run test:e2e` runs, default workers, headed, quiet machine): the string **`database is locked`** reached a RENDERED SCREEN, not just a log, on at least one occasion. Two distinct observations, both real:
>
> - `page.evaluate: Error: database is locked` at `e2e/preview-gate-counts.spec.ts` · `test('every rung carries the count of items that fail there` · ~166
> - the UI drew `Refused. …: database is locked` into a card, at `e2e/injected-empty.spec.ts` · `test('the screen lands on a session that has lines, and says nothing about emptiness'` · ~140
>
> Three occurrences total across the four runs. The mechanism is two concurrent hook sessions touching one workspace: SQLite refuses the second session's write, and that refusal is surfaced to the reader verbatim — as the raw driver error text — instead of being handled or named in the product's own voice.
>
> This is not merely a test artefact. It is a real user-visible defect independent of any test-gating decision: a person running two sessions against the same workspace can be shown a raw SQLite error string on screen.
>
> Mitigations already in place do not prevent it: a `busy_timeout` of 3000ms is already set on the read-only door (`my-context/src/core/audit-db.ts`, around line 1014) and a `globalSetup` sync-once is in place. The observations above are what survives both.
>
> This item states the defect and where it was observed. It does not propose a fix.
