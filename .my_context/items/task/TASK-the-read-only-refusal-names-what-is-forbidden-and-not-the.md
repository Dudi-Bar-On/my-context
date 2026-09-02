---
id: TASK-the-read-only-refusal-names-what-is-forbidden-and-not-the
type: task
title: the read-only refusal names what is forbidden and not the double-quote that unblocks it
status: active
severity: soft
always: false
summary: A refusal says what you may not write and never mentions the small change that would let the same query through.
summary_of: fec110c91fe3cbce
scope: []
tags:
  - v2
  - cli
  - ask
  - rulings
  - "plan:rulings"
  - "seq:52"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/refuse.md"
source_anchor: null
source_checksum: 701a75d20453c4e9
valid_from: 2026-08-31
valid_until: null
checksum: 4d574da6dd8e8650
plan: rulings
seq: "52"
state: todo
priority: "2"
source: "named by plan:rulings seq:46, 2026-08-31"
---

# the read-only refusal names what is forbidden and not the double-quote that unblocks it

> > Named by `plan:rulings seq:46` on 2026-08-31, which fixed the false refusals and stopped at the wording because it does not hold the strings.
>
> **What a refused user is told now**
>
> > `my_context: query is read-only — "VACUUM" is not allowed. Use the CLI commands to change items; the index is rebuilt from Markdown anyway.`
>
> That is correct advice for an actual write, and after `seq:46` almost every remaining refusal **is** one. But for the four absolute keywords — `VACUUM`, `PRAGMA`, `ATTACH`, `DETACH` — used as an ordinary name, it is a wall: the user is told what they cannot do and not what they can.
>
> **The unblocking condition exists and works**
>
> Double-quoting. `strip` blanks `"…"` before the scan runs, so `SELECT 1 AS "vacuum"` and `WITH "vacuum" AS (…)` both pass — and both are pinned green in the guard's test file today. The user simply has no way to learn that from the refusal.
>
> **The sentence that is owed**
>
> > `my_context: query is read-only — "VACUUM" is not allowed. Use the CLI commands to change items; the index is rebuilt from Markdown anyway. If you meant it as a name, double-quote it: "vacuum".`
>
> **Why it was not written by the lane that found it**
>
> There is no string-table key for this refusal — it is a bare `throw new Error` in `assertSelectOnly`, not a `strings/en.js` entry. So it is a source change in a file that lane did own; it stopped because adding user-facing wording was outside the constraint it was given, and because the same sentence will be needed twice if the Ask screen ever surfaces this refusal in a browser.
>
> **Done when**
>
> The CLI refusal names the double-quote escape; if `plan:ui3 seq:15` lands the typed-SQL box, the same sentence exists as an `ask.*` key in **both** tables with a natural Hebrew form rather than a transliteration; and the two spellings cannot drift — one source, quoted by the other.
>
> **It is an instance of a standing item.** `TASK-a-refusal-must-state-its-unblocking-condition-where-a-gate` is open in this corpus and this is a measured example of it: a gate that says no without saying how.
