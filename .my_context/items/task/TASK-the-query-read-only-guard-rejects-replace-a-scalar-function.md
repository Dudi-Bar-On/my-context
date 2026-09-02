---
id: TASK-the-query-read-only-guard-rejects-replace-a-scalar-function
type: task
title: the query read-only guard rejects replace(), a scalar function, as the REPLACE statement
status: active
severity: soft
always: false
summary: The safety check on typed queries mistakes a harmless text function for a command that writes, and refuses a perfectly valid query.
summary_of: bae2094c4d6b16d5
scope: []
tags:
  - "plan:rulings"
  - "seq:45"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 3b055c563a3aaae7
plan: rulings
seq: "45"
state: done
---

# the query read-only guard rejects replace(), a scalar function, as the REPLACE statement

> The read-only guard on `mycontext query` refuses a legitimate read.
>
> Measured 2026-08-23, composing a task progress query:
>
>   mycontext query "SELECT replace(tag,'plan:','') ..."
>   my_context: query is read-only — "REPLACE" is not allowed.
>
> `replace()` is a SCALAR STRING FUNCTION. The statement the guard means to
> refuse is `REPLACE INTO`, SQLite's upsert. The guard matches the keyword
> without its statement context, so it rejects a query that writes nothing.
>
> The workaround is `substr()`, which is why this was survivable rather than
> blocking — but a guard that refuses correct input teaches the reader that the
> tool is unreliable, and the next person will not know the workaround.
>
> Whether other scalar functions collide the same way is unmeasured and should be
> checked in the same pass. The obvious candidates are any name that is also a
> statement keyword.
>
> The fix is to recognise the statement rather than the word — the guard already
> has the parsed statement available if it looks at the leading token, which is
> where `REPLACE INTO` can appear and where `replace(` cannot.
