---
id: TASK-two-more-parse-boundaries-assert-a-domain-type-with-no-check
type: task
title: two more parse boundaries assert a domain type with no check, and the ruling that closed the first one never reached them
status: active
severity: soft
always: false
summary: The same unchecked read that was repaired in one place is still there in two others, including the one every item is read back through.
summary_of: 704ac5e905e08bc6
scope:
  - src/core/**
  - src/ingest/**
  - src/pack/**
tags:
  - v2
  - types
  - gates
  - "plan:rulings"
  - "seq:91"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: a9060a8353776c11
plan: rulings
seq: "91"
state: todo
priority: "2"
---

# two more parse boundaries assert a domain type with no check, and the ruling that closed the first one never reached them

CLOSED NARROWER THAN THE FINDING, AND THIS ITEM IS THE REMAINDER. Report 4 (`reports/2026-09-13-type-design-reviewed.md`, section 4.4) graded SEVEN parse boundaries and named THREE cast families as not defensible. Row 12 of `reports/2026-09-13-the-consolidated-findings.md` carried ONE of them - frontmatter - which became `rulings/69` and is DONE. The other two were never carried into any row and are still in the source. Found 2026-09-15 by the audit at `rulings/90` and re-verified against HEAD that day.

WHAT REPORT 4 SAID, quoted: "SQLite rows (`store.ts`, `audit-db.ts`) - Scattered casts. ~14 row-shape assertions, zero row validation... Not defensible: `as Item` (`store.ts:507,513,538`) launders section 1s unvalidated enums a second time with no chance to catch them, and two `as Origin` from row data (`verdict-store.ts:121`, `pack/history.ts:555`)."

And: "Twenty-one `JSON.parse(...) as <DomainType>` sites in `src/` assert a domain type with no check. The sharpest is `SessionHeader` x 4 in `ingest/session.ts`... the `catch` handles invalid JSON, never valid JSON of the wrong shape, so a `session.json` holding `[]` passes through as a fully-typed `SessionHeader`."

RE-MEASURED 2026-09-15, because a number from 2026-09-13 is a claim about a tree that has moved: `store.ts` still has all three `as Item` at 507, 513 and 538; `verdict-store.ts:121` and `pack/history.ts:555` still cast `as Origin`; `grep -rn "JSON\.parse([^)]*) as " src --include=*.ts` returns FIFTEEN sites, not twenty-one, and five of them are in `ingest/session.ts`. No `readEnum` call exists in `store.ts`, `verdict-store.ts`, `pack/history.ts` or `ingest/session.ts` - the seven files that got one are `item.ts`, `mutate.ts`, `trust.ts`, `validate.ts`, `vocabulary.ts`, `doctor/body-integrity.ts` and `pack/reader.ts`.

ONE THING TO ESTABLISH BEFORE WRITING CODE, and it is the part report 4 could not know. `Store.upsert` writes `JSON.stringify(item)` from an `Item` that `parseItem` already validated, so on the healthy path the projection cannot hold a value `readEnum` would have refused. The question the item exists to answer is whether that path is the only one: a `.index.db` written before `readEnum` landed, or edited, or corrupted, is read back through these three casts with no check at all. Answer that first and say what you found - if the projection is proved re-derived on every version change, the `store.ts` half is closed by argument and only the `as Origin` pair and the fifteen `JSON.parse` sites remain.

THIS IS D64 - the class, not the case. `rulings/69` is the frontmatter member and it is done.
