---
id: TASK-a-second-file-counts-the-no-writes-guarantee-in-prose-after
type: task
title: a second file counts the no-writes guarantee in prose after the first stopped hand-keeping it
status: active
severity: soft
always: false
summary: A test still states a hand-counted number for a set that is now worked out automatically, so it will quietly disagree the moment the set grows.
summary_of: 136b91c5dc1b51e0
acknowledged:
  - citation_form@152ffae06a866632
scope: []
tags:
  - v2
  - gates
  - tests
  - rulings
  - "plan:rulings"
  - "seq:53"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/vocab.md"
source_anchor: null
source_checksum: null
valid_from: 2026-08-31
valid_until: null
checksum: c97e32cbf552732b
plan: rulings
seq: "53"
state: todo
priority: "2"
source: "found by plan:rulings seq:50, 2026-08-31"
---

# a second file counts the no-writes guarantee in prose after the first stopped hand-keeping it

> > Found 2026-08-31 by `plan:rulings seq:50`, in a file it did not own, while deriving the no-writes membership. **It passes today** — this is filed because of its shape, not a failure.
>
> **The observation**
>
> `test/core/vocabulary-graph.test.ts` · `The eight functions the web UI's no-writes guarantee names.` · ~33 describes *"the eight functions the web UI's no-writes guarantee names"*.
>
> That is a **hand-kept count of a set that has just stopped being hand-kept.** `test/ui/no-writes.test.ts` now derives its membership from a property — a module is a writer when it calls, by an imported `node:fs` name, an API that mutates the filesystem — and that derivation moved the answer from **12 named modules to 27**.
>
> A second file asserting "eight" about the same guarantee is now either describing something narrower, or describing the old answer.
>
> **Why it is worth an item even though it is green**
>
> This is the **seventh** instance of the same shape measured in this project in a week, and every previous one passed until the moment it did not:
>
> * the approval-boundary probe expanded four subcommanded commands and there were five — two real gated flags classified as ungated on a security boundary;
> * `verify:citations` walked a hand-listed set of roots and missed both READMEs, where eleven false claims had accumulated;
> * the wave map covered 51 of 126 open tasks;
> * the READMEs' audit-kind table said six where the code had seven;
> * `command-flags.ts` said 38 where the CLI dispatches 39;
> * the no-writes table said twelve where the property finds twenty-seven.
>
> **Every one of them was green the day before it was wrong.** A count in prose beside a set that is now derived is exactly where the eighth will come from.
>
> **What to establish**
>
> * Is "eight" the same set at all? It may be a deliberately narrower one — the functions the *vocabulary graph* cares about rather than every writer — in which case the fix is that it says so, not that it changes.
> * If it is the same set, derive it from the same property rather than restating the number.
> * If it is genuinely a different question, **say which question in the sentence**, so the next reader cannot mistake it for a second opinion on the first.
>
> **Done when**
>
> That assertion either derives its set, or names the narrower question it is asking and why that is not the no-writes membership; and no test states a count of that guarantee in prose.
