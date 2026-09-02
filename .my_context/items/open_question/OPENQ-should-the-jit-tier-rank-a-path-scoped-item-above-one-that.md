---
id: OPENQ-should-the-jit-tier-rank-a-path-scoped-item-above-one-that
type: open_question
title: should the jit tier rank a path-scoped item above one that matches every path
status: superseded
severity: soft
always: false
summary: An unsettled question about whether knowledge scoped to the file being worked on should outrank knowledge that applies to every file.
summary_of: 86aa55e6a1ad9a5f
scope: []
tags:
  - v2
  - selection
  - found-2026-08-28
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: 2026-08-28
checksum: 0c58147db7f9b72d
---

# should the jit tier rank a path-scoped item above one that matches every path

> Found measuring the owner's report that the preview's path picker does nothing (2026-08-28). The UI half is `plan:walk seq:58`. This is the half that is not the screen's to decide.
>
> ## The measurement
>
> `event=tool`, `path=reports/V2-HANDOVER.md`, against the real corpus:
>
> * `REF-v2-handover-read-before-discussing-the-web-ui` is scoped **`reports/**`**. The path matches it.
> * It was **NOT delivered**. It **spilled**.
> * 27 items were delivered in its place. The jit tier had 102 candidates and a 16,000 budget.
> * Of those 102, **two carry a scope at all**. The other 100 match every path in the repository equally.
>
> So on a path the item is specifically about, the item about that path lost to items about nothing in particular.
>
> ## Why, and it is one line
>
>     matchesScope(item, target, config)
>       -> item.scope.length === 0 ? policy !== 'inert' : matchesAnyGlob(target, item.scope)
>
> It returns a BOOLEAN. `true` because this item's glob matches the path and `true` because that item has no glob at all are the same value, and `fitToBudget` first-fits over the mixed set with no notion of which kind of `true` it is holding. The JIT tier's whole purpose is path relevance, and relevance is not part of its ordering.
>
> ## The question
>
> **Should the jit tier prefer items whose scope actually matches the path over items that match it only by having no scope?**
>
> Neither answer is obviously right, which is why this is an open question and not a task:
>
> * **Yes.** The tier exists to deliver what is relevant to the file being touched. An item scoped to `reports/**` is the strongest possible signal of relevance to a `reports/` path, and today that signal is worth exactly nothing. A corpus where scope is used sparingly — this one, and probably most — gets no benefit at all from having used it.
> * **No.** Ordering by specificity makes the delivered set depend on a ranking rule nobody can see, and the current rule has one virtue that is easy to undervalue: it is explainable in a sentence. It also silently demotes unscoped items the day someone adds one glob to one item, which is a large behaviour change from a small edit.
> * **A third option**: leave the ordering alone and make `scopePolicy: required` (or a lint) push the corpus toward scoping items, so the mixed set stops arising. This moves the problem to capture time, where the person has the context to answer it.
>
> ## What is NOT in question
>
> * `scopePolicy` stays as the owner set it. `inert` would make 619 items un-injectable on this tier and is not a fix to reach for accidentally.
> * The pinned tier never consults `matchesScope` (`select.ts`'s own comment, spec §4b) and is unaffected either way.
> * This is not a UI question. Whatever is decided, `plan:walk seq:58` still has to disclose the behaviour in force, because a control that cannot filter must say so regardless of which rule it cannot filter under.
>
> ## Why this is worth deciding rather than leaving
>
> It affects what every agent session receives on every tool event, silently, and it is invisible from any screen — the owner found it only because a picker appeared not to work. A defect that can only be found by a control looking broken is one that stays found only if it is written down.

## Relations
- superseded_by [[DEC-the-jit-tier-offers-path-scoped-items-first-in-two-bands]]
