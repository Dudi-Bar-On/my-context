---
id: DEC-the-jit-tier-offers-path-scoped-items-first-in-two-bands
type: decision
title: the jit tier offers path-scoped items first, in two bands
status: active
severity: soft
always: false
summary: Notes that say which files they apply to get first claim on the space when you touch those files; everything else fills whatever room is left.
summary_of: 750142f7d48ce687
scope: []
tags:
  - v2
  - selection
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 73d6f2f8089bd36f
---

# the jit tier offers path-scoped items first, in two bands

> Ruled 2026-08-28 by the owner, on the assistant's recommendation, closing `OPENQ-should-the-jit-tier-rank-a-path-scoped-item-above-one-that`. That item carries the measurement and the arguments against; this one carries the answer.
>
> ## The ruling
>
> **The JIT tier offers candidates in two bands.**
>
> * **Band 1** — items whose own globs match the event path.
> * **Band 2** — items that match only by having no scope at all.
>
> First-fit runs within each band, band 1 first. Not a specificity score, not a weighting: two bands.
>
> ## The property that decided it
>
> **Where nothing is scoped, band 1 is empty and the behaviour is byte-identical to today.**
>
> The change cannot regress a corpus that does not use scope, and does the obviously-right thing for one that does. An ordering change that is a strict no-op on the common case and a strict improvement on the intentional one is rare enough to settle the question on its own.
>
> ## The defect it fixes, measured
>
> `matchesScope` returns a BOOLEAN:
>
>     if (item.scope.length === 0) return scopePolicyFor(config, item.type) !== 'inert';
>     return matchesAnyGlob(target, item.scope);
>
> So *"this item declares it applies to `reports/**`, and the path is `reports/V2-HANDOVER.md`"* and *"this item declares nothing"* arrive at `fitToBudget` as the same `true`. The corpus asks people to record scope and then discards that record at the one place it could matter.
>
> Driven against the real corpus on 2026-08-28: on the path `reports/V2-HANDOVER.md`, the item scoped to `reports/**` **spilled**, while 27 items about nothing in particular were delivered. 619 of 621 items carry `scope: []`.
>
> ## Bands, not a score, and why the objection was answered rather than dismissed
>
> The argument against ranking was that it makes delivery depend on a rule nobody can see, where the current rule is at least explainable in one sentence. A score is exactly that invisible rule. Two bands is also one sentence — *"items scoped to this path are offered first; everything else fills what is left"* — and band membership is a fact a screen can display beside each spilled item.
>
> The status quo does not hold "explainable" exclusively: it is equally invisible AND counterintuitive, since a scoped item losing on its own path is not something any reader would predict.
>
> **On "one added glob demotes everything else":** it demotes nothing. Unscoped items still compete for the remaining budget on the same first-fit terms. Band 1 gets first refusal, which is what the person who wrote the glob was asking for.
>
> ## What was considered and not taken
>
> **`scopePolicy: required`, or a capture-time lint.** Worth having on its own merits and NOT a substitute: it changes what future items look like while leaving the ordering defect intact for every mixed corpus — which is every real corpus during a migration — and it forces a scope decision at capture time when the person may not have one.
>
> ## What this does not touch
>
> * **The pinned tier never consults `matchesScope`** (`select.ts`'s own comment, spec §4b), so `always` items are unaffected in either direction.
> * **`scopePolicy` stays as the owner set it.** `inert` remains a separate lever this ruling does not pull.
> * **`DEC-continuity-gets-its-own-budget-and-the-item-it-holds-must-be` is unrelated.** A continuity tier removes the handover from this competition entirely; this ruling governs everything else.
>
> ## The cost, stated rather than discovered later
>
> A corpus that begins scoping items will see its delivered set CHANGE on tool events — items that used to arrive will be displaced by scoped ones. That is the intent, and it is still a real behaviour change. It should land with the preview's spilled-items list (`plan:walk seq:56`) so the displacement is observable rather than mysterious.

## Observations
- [supersession] Replaces OPENQ-should-the-jit-tier-rank-a-path-scoped-item-above-one-that: Answered by the owner 2026-08-28: two bands, band 1 the items whose globs match the path, band 2 those matching only by having no scope. Decided on the property that where nothing is scoped band 1 is empty and behaviour is unchanged, so the ruling cannot regress a corpus that does not use scope.

## Relations
- supersedes [[OPENQ-should-the-jit-tier-rank-a-path-scoped-item-above-one-that]]
