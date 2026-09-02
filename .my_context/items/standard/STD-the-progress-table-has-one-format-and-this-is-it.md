---
id: STD-the-progress-table-has-one-format-and-this-is-it
type: standard
title: the progress table has one format, and this is it
status: active
severity: hard
always: true
summary: The one layout for showing how much work is left and where it is, with every number worked out afresh rather than remembered.
summary_of: 2c39e3f7bd0d8ee4
scope: []
tags:
  - v2
  - process
  - reporting
origin: human
source_file: null
source_anchor: null
source_checksum: 3de45e5c9eab31b8
valid_from: 2026-08-28
valid_until: null
checksum: 72b25473cc4fdec0
---

# the progress table has one format, and this is it

> Owner instruction, 2026-08-28: when progress is asked for, this is the format.

**NOT the same artefact as `STD-v2-0-progress-report-and-the-format-progress-reports-use`,
and the two must not be confused.** That one is the v2.0 REQUIREMENTS report — R1
to R13, rows carrying `SHIPPED` / `PLANNED` / `DECIDED` / `BLOCKED` / `OPEN`,
each citing a plan task or a commit. It answers "what did we promise, and where
does each promise stand".

This one is the per-plan TASK rollup. It answers "how much work is left, and
where is it". They share two rules and it is worth saying which: counts are
computed and never remembered, and the table is SHOWN rather than filed. Ask
which question is being asked; if it is "progress" with no other word attached,
it is this table.
> Not a similar table — this one.
>
> ## The shape
>
> A heading, one totals line, then one row per plan:
>
> ```
> ## Progress across every plan
>
> 413 tasks tracked · **286 done (69%)** · 121 open · 6 blocked · 33 open at priority 1
>
> | plan | done | open | blocked | p1 open | progress |
> |---|---|---|---|---|---|
> | **execute** | 12 | 0 | 0 | 0 | ██████████ 100% |
> | categories | 19 | 1 | 0 | 0 | █████████░ 95% |
> | walk | 16 | 32 | 4 | 16 | ███░░░░░░░ 31% |
> ```
>
> The rules, each of which was a decision:
>
> * **The totals line leads with the count and bolds the done figure**, because
>   "how much is left" is the question and the percentage is the answer. The
>   separator is a middle dot with spaces, not a comma or a pipe.
> * **Six columns, in this order**: plan, done, open, blocked, p1 open, progress.
> * **`open` folds `todo` and `doing` together.** They are the same answer to "is
>   this finished" and splitting them makes the reader do arithmetic to get it.
> * **`blocked` stays its own column** and is never folded into open. A blocked
>   task is not work waiting to be picked up; it is work that cannot be, and a
>   column that hides the difference reports a plan as healthier than it is.
> * **`p1 open` counts only priority-1 tasks that are NOT done.** It is the column
>   that says where to look next, and it is why the table is worth reading rather
>   than skimming.
> * **The bar is ten cells, `█` filled and `░` empty**, followed by the integer
>   percentage. Ten because a bar you have to measure is a bar nobody reads, and
>   both characters are drawn so an empty stretch is a shape rather than a gap.
> * **Sorted by completion, descending.** Finished plans first, least-finished
>   last. The eye lands on `100%` and travels to the trouble.
> * **`(none)` sorts LAST, whatever its percentage, and is never bolded.** It
>   is not a plan — it is whatever tasks belong to none — so a table that
>   leads with it presents "two ad-hoc jobs, both finished" as the
>   best-performing plan in the project. Found by rendering this table an
>   hour after the standard was written: `(none)` came out top, at 100%, in
>   bold. The sort rule was right for plans and wrong for the one row that is
>   not one.
> * **Bold the plan name only where it is at 100%**, and only for a real
>   plan. Bold everywhere is bold nowhere.
> * **Percentage is `done / (done + open + blocked)`**, rounded. A blocked task
>   counts against completion, because it is not done.
>
> ## After the table
>
> Two or three sentences naming what the table shows and does not: the plan with
> the most open priority-1 work, any plan at 0%, and anything whose number is
> misleading on its own. The table is the measurement; those sentences are what a
> person would say about it.
>
> ## Before displaying it: the states must be current
>
> **Bring every finished task to `state: done` BEFORE counting.** A table
> drawn over stale states is precise about the wrong corpus, and it is precise
> in the flattering direction: finished work reads as outstanding, so the
> report understates progress and points at the wrong plan.
>
> Not hypothetical. The first table drawn under this standard showed
> `plan:live` at 0% with three open priority-1 tasks. Its `seq:1` was
> implemented, committed, and green through 192 browser tests — nobody had
> moved the state. The plan was 20%; the table said 0%.
>
> So the order is: reconcile, then count, then draw. Reconciling means asking
> of every non-`done` task whether the work actually landed —
> `RULE-a-task-is-not-done-until-its-state-says-done` is what keeps that
> question short, by requiring the state to move when the work does rather
> than at reporting time.
>
> ## Where the numbers come from
>
> Read `.my_context/items/task/`, skip `status: superseded`, and group by the
> `plan` field. Never by the `plan:` TAG — that is projected from the field and a
> task with no plan carries no tag, so a tag-based grouping silently drops them
> into nothing. Tasks with no plan are their own row, named `(none)`.
>
> ```js
> const rows = [];
> for (const f of fs.readdirSync('.my_context/items/task')) {
>   const t = fs.readFileSync('.my_context/items/task/' + f, 'utf8');
>   const g = (k) => {
>     const m = new RegExp('^' + k + ': (.*)$', 'm').exec(t);
>     return m ? m[1].replace(/^"|"$/g, '') : '';
>   };
>   if (g('status') === 'superseded') continue;
>   rows.push({ plan: g('plan') || '(none)', state: g('state') || '-', pri: g('priority') || '-' });
> }
> // per plan: done, open = todo + doing, blocked, p1 = (state !== 'done' && pri === '1')
> // pct = round(done / (done + open + blocked) * 100)
> // bar = '#'.repeat(round(pct / 10)).padEnd(10, '.')  -> rendered as █ / ░
> ```
>
> **Counted from the items, never from memory or from an earlier answer in the
> same session.** The corpus moves while it is being worked on: three of these
> numbers changed inside one afternoon on 2026-08-28. A progress report quoting a
> figure from earlier in the conversation is a report about the past wearing the
> present tense.
