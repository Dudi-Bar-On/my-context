---
id: KNOWN-the-queries-on-the-ask-screen-are-not-correct
type: known_issue
title: the queries on the Ask screen are not correct
status: active
severity: hard
always: false
summary: The questions the search screen asks of the data give wrong answers, and which ones are wrong, and in what way, has not been written down.
summary_of: d839c7cbd6988245
scope: []
tags:
  - v2
  - ui
  - ask
  - query
  - owner-blocking
  - must-fix
origin: human
source_file: null
source_anchor: null
source_checksum: 508394eeb4a206fe
valid_from: 2026-08-27
valid_until: null
checksum: a4672ced639e488c
---

# the queries on the Ask screen are not correct

> Owner-reported 2026-08-27: the queries on the Ask screen are not correct.
>
> `src/ui/public/screens/ask.js`. The specific queries and the respect in which
> each is wrong were not enumerated at report time — capture them before fixing,
> because "not correct" covers at least three different defects here (a query
> that names the wrong field, one whose filter is right but whose bound or order
> silently drops rows, and one that is correct about what it measures and silent
> about what it misses).
>
> That last shape is the one this project keeps paying for — the injection
> reading `cwd`, the board reading fields, 8 of 24 tasks, the vacuous contrast
> gate, the unscoped anti-vacuity guard. A wrong Ask query is the same shape
> pointed at the user instead of at a test: it answers confidently and does not
> say what it left out.
>
> Fix by checking each query against the corpus it claims to describe, and where
> a bound or a projection can hide rows, make the screen say so.
