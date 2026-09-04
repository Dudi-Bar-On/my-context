---
id: TASK-build-the-typed-sql-surface-on-the-ask-screen-per-the-owner
type: task
title: build the typed-SQL surface on the Ask screen, per the owner ruling
status: active
severity: soft
always: false
summary: Let people type their own queries on the question screen, reversing an earlier decision, because the ready-made filters cannot ask what they need.
summary_of: 7e7f111985c7a461
scope: []
tags:
  - "plan:ui3"
  - "seq:15"
  - "state:todo"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 1c44248b72514380
plan: ui3
seq: "15"
state: todo
needs: api/6
---

# build the typed-SQL surface on the Ask screen, per the owner ruling

> OWNER RULING, 2026-08-23: the Ask screen will accept typed SQL, in addition to
> the canned reports and the filter row. This reverses a stated design point and
> the reversal is deliberate.
>
> WHAT IT REVERSES. `ask.sqln` says, in bold, "Shown, never typed." The screen
> was designed to compose SQL from filter fields and DISPLAY the statement it ran,
> so that a reader learns the query language by seeing it rather than by writing
> it, and so that no arbitrary statement reaches the database from a browser.
>
> WHY IT IS BEING REVERSED. The filter row cannot express the questions the owner
> actually asks. Measured on the day of this ruling: a progress view over the task
> category — name, plan, progress, status, last change — is not expressible,
> because progress lives in a tag and `corpusSelect` has no tag filter, and
> because the only time column the index carries is the rebuild timestamp. Three
> of the four canned reports are aggregates the filter row also cannot express.
> Every real question so far has needed something the composer cannot say.
>
> WHAT MAKES IT SAFE, AND WHAT DOES NOT. `mycontext query` already accepts
> arbitrary SQL from a human and defends it: read-only enforcement, and a cap of
> 1000 rows. That guard is the one to reuse — the UI must not grow a second
> implementation of it. But note two things it does NOT give for free:
>
> - the guard is keyword-based and has at least one false positive, filed as
>   TASK-the-query-read-only-guard-rejects-replace-a-scalar-function. A UI that
>   surfaces refusals to a reader will surface that one too.
> - `ctx.api` has no POST, filed as
>   TASK-ctx-api-has-no-post-so-three-registered-endpoints-are. A typed statement
>   does not belong in a query string; this needs the POST extension first.
>
> WHAT MUST BE DECIDED WHILE BUILDING IT, not after: whether a typed statement may
> reach the AUDIT projection as well as the index — they are separate stores with
> separate doors, and the interesting questions cross both; and what the screen
> does with a statement the guard refuses, since a refusal a reader cannot read is
> the failure this project keeps rediscovering.
>
> The canned `report=tasks` is filed separately and is NOT superseded by this.
> It stays: a named report is the right answer for a question asked repeatedly, and
> typed SQL is the right answer for a question asked once.
