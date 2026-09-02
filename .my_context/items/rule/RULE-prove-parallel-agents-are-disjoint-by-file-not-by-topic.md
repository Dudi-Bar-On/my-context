---
id: RULE-prove-parallel-agents-are-disjoint-by-file-not-by-topic
type: rule
title: prove parallel agents are disjoint by file, not by topic
status: active
severity: hard
always: true
summary: Before running helpers at the same time, prove they touch different files; jobs that sound unrelated often edit the same one, and topics are no evidence.
summary_of: 069d778de3d1b97b
scope: []
tags:
  - v2
  - agents
  - pinned-2026-08-23
origin: human
source_file: null
source_anchor: null
source_checksum: fa895dfc1654ef6b
valid_from: 2026-08-23
valid_until: null
checksum: 7baa1a6f723dbe2d
---

# prove parallel agents are disjoint by file, not by topic

> Before dispatching agents in parallel, prove their work is disjoint BY FILE, not
> by topic. Two tasks that sound unrelated routinely edit the same file.
>
> Measured on 2026-08-23, dispatching fourteen agents at once. Ten were proved
> disjoint by measurement — the screens' string keys already existed, so no agent
> touched a string table; each owned exactly one new module. Those ten never
> collided. The other four were briefed BY TASK, because their file sets were not
> known in advance, and two of them edited the same two files: a temp-file leak
> and a recorded version number both landed in `statusline-tee.ts` and its test.
> It happened to be benign. That was luck, not design.
>
> The same dispatch also proved the cheap part is worth doing. Shared files that
> WOULD have collided — a screen registry, a route table, a stylesheet, a ledger —
> were written by the orchestrator before and after the wave, so no agent needed
> to touch them at all.
>
> DO
> - List, per agent, the exact files it may create or modify, and check the lists
>   intersect nowhere. Put that list in the agent's brief.
> - Where a shared file is unavoidable (a registry, a route table, a ledger),
>   take it out of the wave: the orchestrator edits it before dispatch or at the
>   merge, and agents report what they need rather than writing it.
> - If an agent's file set cannot be known in advance, say so, dispatch it alone
>   or last, and require it to report every file it touched.
> - Give every agent one owner for git. Concurrent commits race on the index lock.
>
> DO NOT
> - Infer disjointness from task titles or plan names.
> - Let several agents each add "just one line" to the same registry.
> - Let agents run a port-binding or browser suite concurrently.
