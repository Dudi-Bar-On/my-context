---
id: TASK-mycontext-ready-caps-at-50-and-does-not-say-so
type: task
title: the ready, todo and decay caps were untested at the default limit
status: active
severity: soft
always: false
summary: The report was thought to hide how much it left out and does not; the real gap was that no test covered what happens at the default limit.
summary_of: 4803893b720fecc6
acknowledged:
  - body_disagrees_with_meta@36c8cca0110873b5
  - state_unaudited@36c8cca0110873b5
scope: []
tags:
  - v2
  - corpus
  - planning
  - "plan:categories"
  - "seq:23"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: a00e227be53677b0
plan: categories
seq: "23"
state: done
priority: "1"
source: found planning against it, 2026-08-28
---

# the ready, todo and decay caps were untested at the default limit

**Measured 2026-08-29, and it is the first thing to read here.** `mycontext ready` discloses its cap and always did. Verified by reading the output:

    119 ready; 50 shown. Raise the cap with --limit 119, or narrow it with --plan.

`--json` already carries `readyTotal`, `truncated` and `limit`. `todo` discloses the same way with `matched`. `decay` has no `--limit` and no slice at all, so it never had the defect either.

**What WAS real, and is now fixed**

The gap was in the tests, not the commands. Both suites only covered `--limit 1` — where the cap is the reader's own doing — and **nothing covered the DEFAULT cap**, which is the case that actually misled two waves of planning. `test/cli/report-caps.test.ts` now covers all three commands at the default, including that the truncation line and the held line are SEPARATE disclosures printed in that order. That ordering matters: the held line is the one the filing below mistook for the whole disclosure.

**How the filing got it wrong, and the error is mine.** I grepped the output for `more|not listed|truncat|showing`. The line says *"shown"* and *"cap"* — neither matches. I then reported the absence of my pattern as the absence of a disclosure, and wrote a task asserting it.

**That is the exact failure this week has been cataloguing in other people's gates** — `screen-parity`'s settle loop reading "count stopped changing" as "finished loading", the vacuous `toHaveCount(0)`, the empty-band check measuring a box. Each measured a PROXY instead of the property. Mine was: *does the output contain these words* instead of *does it disclose*. Filed against a tool for a defect I had introduced into my own measurement.

**The lesson worth keeping is not about `ready`.** It is that a controller checking a tool with a pattern it invented is running an unreviewed test, and an absence of matches is the weakest evidence there is. Read the output.

**What was believed when this was filed**, kept verbatim below because the reasoning inside it outlived the premise it rested on — the disclosure argument is one this project already holds, and it is worth reading whatever prompted it.

> Found 2026-08-28, the day `mycontext ready` shipped, while using it to plan the work.
>
> ## Measured
>
>     mycontext ready --summary        says  124 ready
>     mycontext ready                  prints 50 rows
>     mycontext ready --json           returns 50 rows
>     mycontext ready --limit 200      returns 124 rows
>
> The default output stops at 50 and **says nothing about the 74 it dropped.** The one "not listed above" sentence it does print refers to the 12 HELD tasks, which makes the omission harder to notice rather than easier: a reader sees a disclosure, reads it as the disclosure, and takes the list as complete.
>
> The controller and the owner planned two waves of work against that truncated list before the cap was noticed.
>
> ## Why this one matters more than an ordinary default
>
> `ready` exists to answer *"what can I start next"*. That is a question whose answer is only useful if it is complete — a default that silently answers "here are 50 of the things you could start" is answering a different question, and the reader cannot tell which they got.
>
> It also contradicts a principle this project already holds and states in its own workflow guidance: **if a report bounds coverage — top-N, sampling, no-retry — it says what it dropped, because silent truncation reads as "covered everything" when it did not.** `ready`'s own footer is otherwise a model of disclosure: it explains that readiness is derived per run, that nothing stores it, and that a prose-only dependency is invisible to it. All true, all useful, and it omits the one fact that changes what the reader does next.
>
> ## The fix, and the thing not to do
>
> Print what was dropped, in the register the held line already uses — *"74 more ready and not listed; `--limit` to see them"*. Same for `--json`, which should carry the total beside the rows so a caller can tell.
>
> **Do not fix it by removing the cap.** A 124-row table is not more usable than a 50-row one, and the cap is a reasonable default. The defect is the silence, not the number.
>
> ## Worth checking at the same time
>
> `todo` and `decay` are the reports `ready` was modelled on. If either caps the same way, it has the same defect and this task should close all of them at once rather than leave two-thirds of a fix.
>
> ## Done when
>
> `ready` names what it dropped whenever it drops anything; `--json` carries the total; `todo` and `decay` are checked for the same shape and fixed if they share it; and a test asserts the disclosure appears when the ready set exceeds the default.
