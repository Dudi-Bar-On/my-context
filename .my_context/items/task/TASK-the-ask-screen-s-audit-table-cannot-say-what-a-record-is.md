---
id: TASK-the-ask-screen-s-audit-table-cannot-say-what-a-record-is
type: task
title: the ask screen's audit table cannot say what a record is, only what item it named
status: active
severity: soft
always: false
summary: The activity table shows a time and two dashes for most rows, because it never shows the one thing that says what the record was.
summary_of: 64089b55f9f0a10c
scope: []
tags:
  - v2
  - ui
  - walk
  - "plan:walk"
  - "seq:73"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: 87865b4c0ce20cb0
plan: walk
seq: "73"
state: done
priority: "1"
source: owner, 2026-08-29
---

# the ask screen's audit table cannot say what a record is, only what item it named

> Owner, 2026-08-29: *"ask screen, audit history, many item records in the results are blanked wit no item - bug"*.
>
> **Measured before answering, and the join is not broken.**
>
> Driving the running app and reading its own table:
>
>     headers   At | Item | Role
>     rows      498
>     sample    06:22:59 | — | —
>               06:22:32 | — | —
>               06:22:16 | — | —
>
> And the payload behind it, 60 most recent records from `/api/ask/audit`:
>
>     by kind        hook 59, access 1
>     with item id   0        without   60
>
> **Those records genuinely have no item.** A `hook` row is a session-lifecycle event and an `access` row is a credential refusal; neither is about an item, and `screens/ask.js` · `if (!said) what.append('—');` · ~994 correctly draws `—` rather than inventing one. Nothing is broken and nothing is lying.
>
> **The defect is that the table cannot show what a record IS.**
>
> Its three columns are `At`, `Item`, `Role`. `kind` and `op` — the two fields that would say `hook` / `subagent-stop` — are in `AUDIT_FIELDS` and are FILTERABLE, and are never DISPLAYED. So a reader looking at the audit history sees a timestamp and two dashes, 498 times, with no way to tell a subagent stopping from a credential being refused from anything else.
>
> An honest dash is still useless if nothing beside it says what the row is.
>
> **This is not a parity gap — the app matches the design of record.** The mockup's `ask` section declares exactly `th.at`, `th.item`, `th.role`. So this is a DESIGN CHANGE and the mockup is edited first. Note `th.kind` and `th.what` already exist in the mockup's string vocabulary, in other tables, so the words need no inventing.
>
> **It is the fixture pattern again, and worth counting.** The mockup's audit table was drawn against sample rows that HAVE items. The real log is dominated by rows that do not. That is the same shape as the staircase drawn against six rungs, the ribbon against a corpus with no continuity item, and the renderer against bodies that used only bullets — a design validated on data that flatters it.
>
> **What the table should carry**
>
> At minimum `kind` and `op`, which are what a record IS. Consider also that `Role` is empty for the same rows for the same reason — a column that is blank whenever `Item` is blank is not earning its width, and the two might merge into one "what happened" column that says something for every kind.
>
> **Bounds**
>
> * The filter vocabulary already knows every kind and op (`AUDIT_FIELDS`), so the columns and the filters should be derived from one list, not two.
> * This screen's subject IS the log, which is why it declares `kinds: '*'` in the live-invalidation table — an enumerated column set that has to be edited when an eighth kind ships would be the same staleness one layer up.
> * Both string tables, `{m:…}` markers in the Hebrew, mockup first.
>
> **Done when**
>
> The audit table says what each record is for every kind, not only for the kinds that name an item; the columns and the filter vocabulary come from one source; the mockup carries it first; and a browser test drives a log dominated by `hook` rows — the ordinary case on any machine that has run agents — and asserts a reader can tell the rows apart.
