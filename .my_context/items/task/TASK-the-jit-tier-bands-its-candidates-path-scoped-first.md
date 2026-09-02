---
id: TASK-the-jit-tier-bands-its-candidates-path-scoped-first
type: task
title: the jit tier bands its candidates, path-scoped first
status: active
severity: soft
always: false
summary: When choosing what to offer for the file you are working in, prefer things written about that file over general ones.
summary_of: 839763335e197058
scope: []
tags:
  - v2
  - selection
  - budget
  - "plan:budget"
  - "seq:7"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 951ea98401957715
plan: budget
seq: "7"
state: done
priority: "1"
source: DEC-the-jit-tier-offers-path-scoped-items-first-in-two-bands, ruled by the owner 2026-08-28
---

# the jit tier bands its candidates, path-scoped first

> Implements `DEC-the-jit-tier-offers-path-scoped-items-first-in-two-bands`, which carries the ruling, the measurement and the arguments that were answered rather than dismissed. Read it first. It supersedes `OPENQ-should-the-jit-tier-rank-a-path-scoped-item-above-one-that`, which remains searchable and holds the case against.
>
> ## The change, in one paragraph
>
> `select.ts` · `fresh.filter((i) => matchesScope(i, target, config))` · ~1229 filters JIT candidates with `fresh.filter((i) => matchesScope(i, target, config))` and first-fits the result. That filter flattens two different facts into one boolean. Split the candidates into two bands — items whose own globs match the path, and items that match only because `item.scope.length === 0` — and run first-fit over band 1 before band 2.
>
> ## The property the implementation must preserve, and the test that proves it
>
> **With no scoped items in the corpus, the delivered set must be BYTE-IDENTICAL to today.** That is the property the ruling turns on: the change cannot regress a corpus that does not use scope.
>
> So there are two tests, and the first is the important one:
>
> 1. A corpus where every item is unscoped delivers exactly what it delivers today, in the same order. Capture the current answer first, then change the code, then assert against the captured answer.
> 2. A corpus with one item scoped to the event path delivers THAT item ahead of unscoped ones competing for the same budget — the assertion that fails today. Model it on the real measurement: an item scoped `reports/**`, a path `reports/V2-HANDOVER.md`, a budget too small for everything.
>
> ## Bounds
>
> * **`matchesScope` keeps its signature and its meaning.** It answers "does this item apply to this path" and that answer is still correct. The banding is a property of the CALLER — do not push ordering into a predicate whose job is a yes/no, and do not add a third return value.
> * **The pinned tier never consults `matchesScope`** (`select.ts`'s own comment, spec §4b). `always` items are unaffected in either direction and no test should imply otherwise.
> * **`scopePolicy` is not touched.** `inert` stays a separate lever. Note that under `inert` an unscoped item matches NO path, so band 2 is empty by construction — check that the banding degenerates correctly rather than assuming it.
> * **Within a band, the existing candidate order is preserved exactly.** The selector's candidate order is load-bearing — `preview.js`'s own header records that `[4,9,4]` at a budget of 10 spills a different item than `[9,1,5]` does. Banding is a stable partition, not a sort.
> * **First-fit is not re-implemented.** `fitToBudget` is called once per band, or once over a re-ordered list — whichever keeps a single implementation. `preview.js`'s header is explicit that no second implementation of `fitToBudget` may exist.
>
> ## What must be visible afterwards
>
> The ruling states the cost plainly: a corpus that starts scoping will see its delivered set change on tool events, and displaced items are the intended consequence. **That displacement must be observable.** `plan:walk seq:56` builds the preview's spilled-items list; band membership belongs beside each row there, so a reader can see WHY an item lost rather than only that it did.
>
> If `seq:56` has not landed when this does, say so in the report — this task does not build that list, and shipping the reordering with no way to see it is the silent-behaviour-change shape this project keeps finding.
>
> ## Done when
>
> The JIT tier bands its candidates; a corpus with no scoped items delivers byte-identically to the captured pre-change answer; a scoped item on its own path is delivered ahead of unscoped competitors; the `inert` degeneration is covered; `fitToBudget` still has exactly one implementation; and the report says whether the displacement is visible anywhere yet.
