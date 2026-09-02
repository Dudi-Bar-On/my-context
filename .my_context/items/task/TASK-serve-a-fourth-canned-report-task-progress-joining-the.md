---
id: TASK-serve-a-fourth-canned-report-task-progress-joining-the
type: task
title: "serve a fourth canned report: task progress, joining the corpus to the audit projection"
status: active
severity: soft
always: false
summary: A ready-made report on how far every task has got, joining two separate stores that the question-asking screen cannot join for itself.
summary_of: f2355fdeaefd1ccf
scope: []
tags:
  - "plan:ui3"
  - "seq:14"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: d489447d5303a9b7
plan: ui3
seq: "14"
state: done
---

# serve a fourth canned report: task progress, joining the corpus to the audit projection

> The Ask screen can nearly answer "what is the state of every task" and cannot
> quite, and the gap is precise rather than vague.
>
> MEASURED 2026-08-23. `corpusSelect` (src/ui/ask-model.ts ~96) filters on type,
> status, layer, always, scoped and titleContains, and returns
> `id, type, title, status, always, has_scope, layer, file_path, updated_at`.
>
> So it can list tasks with their status. It cannot show PROGRESS, because progress
> lives in a tag (`state:done`) and there is no tag filter and no tags column.
> And it cannot show LAST CHANGE, because `items.updated_at` is not a per-item
> change time: all 344 items carry one identical timestamp, since the index is
> rebuilt whole from Markdown on every write path. The real change time is the
> newest `mutation` record in the audit log — a different store the index cannot
> join to.
>
> THE SMALLEST HONEST ADDITION is a fourth canned report.
> `/api/ask/summary?report=` already validates three values — ops, items,
> sessions — and dispatches to a function per report. A `tasks` report would do
> the join server-side and return the columns a progress view actually needs:
> name, plan, seq, progress, status, change count, last op, last change.
>
> It fits the screen's existing shape rather than fighting it: the Ask screen shows
> the SQL it ran, and a canned report has SQL to show. It needs no new control, no
> tag filter, and no change to the corpus query.
>
> Two details that must not be lost in the building:
> - the join crosses two stores, so the report reads the audit projection as well
>   as the index. Both already have read-only doors on this surface; use them.
> - a report is capped and the cap must be disclosed, the way corpusSelect's own
>   `limit + 1` truncation probe is. A progress view that silently shows 200 of
>   273 tasks is worse than one that refuses.
