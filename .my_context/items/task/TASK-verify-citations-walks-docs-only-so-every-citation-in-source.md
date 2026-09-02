---
id: TASK-verify-citations-walks-docs-only-so-every-citation-in-source
type: task
title: "verify:citations walks docs only, so every citation in source is ungated"
status: active
severity: soft
always: false
summary: The reference checker never looks at the code itself, which is where these references are written most densely of all.
summary_of: 379fc9366b428440
scope: []
tags:
  - "plan:rulings"
  - "seq:44"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: 2bd8edb43ff8724e
valid_from: 2026-08-23
valid_until: null
checksum: 7291dbe81b2750b0
plan: rulings
seq: "44"
state: done
---

# verify:citations walks docs only, so every citation in source is ungated

> `verify:citations` walks `docs/` only. Every citation written inside
> `src/**/*.ts` and `test/**/*.ts` is therefore unchecked by CI — and this
> project writes them densely in source, in the form
> `file - verbatim fragment - ~line`.
>
> Found 2026-08-23 independently by three agents, each of which had to hand-build a
> resolver to check its own work. One of them found and repaired three citations in
> a file it was editing that had been SPLIT ACROSS TWO LINES — the "invisible
> citation" fault `scripts/verify-citations.ts` documents in its own source and
> cannot currently detect anywhere but Markdown.
>
> The gate already knows how to resolve a citation. What it needs is the source
> tree in its walk, plus a decision about the failure it will surface on the first
> run: a fragment that has drifted in a comment is a stale claim about the code,
> and there will be some.
