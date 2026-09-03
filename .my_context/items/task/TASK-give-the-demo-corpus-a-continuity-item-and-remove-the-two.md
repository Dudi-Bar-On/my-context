---
id: TASK-give-the-demo-corpus-a-continuity-item-and-remove-the-two
type: task
title: give the demo corpus a continuity item, and remove the two guards that stand in for it
status: superseded
severity: soft
always: false
summary: The sample data set is missing one kind of item, so two tests quietly skip a check; add it and remove the workarounds at the same time.
summary_of: 58868e64a7d61109
scope: []
tags:
  - v2
  - ui
  - live
  - e2e
  - "plan:live"
  - "seq:10"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: 2026-09-03
checksum: ce28bd8ed8a12c74
plan: live
seq: "10"
state: done
priority: "4"
source: "plan:live seq:9's fixture gap, 2026-08-28"
---

# give the demo corpus a continuity item, and remove the two guards that stand in for it

> Two gate artefacts cite this task by number, so it exists to make those references resolve — and it is deliberately LOW priority, because of a ruling the owner made the day it was filed.
>
> **Owner, 2026-08-28:** *"the demo corpus should be used only as ref and for tests but only the actual dogfooding corpus is the one we based on now."*
>
> So this is fixture polish, not product work. Do not let it displace anything.
>
> ## What is open
>
> `.demo-corpus` carries no item with `continuity: true`. `scripts/demo-corpus.ts` marks continuity on nothing, and its two `reference` items measure roughly 4,100 and 17,900 estimated tokens against demo budgets of 90-240 — so nothing in it could fit the tier even if marked.
>
> The continuity tier therefore RUNS over that fixture, admits nothing, and draws its head with no segment and no ghost lane. Correct behaviour; indistinguishable, to an element census, from a feature nobody built.
>
> Two artefacts record that ambiguity and both name this task:
>
> * `e2e/screen-parity.spec.ts` — `KNOWN_GAPS.preview` carries `div.continuity.seg`.
> * `e2e/app-layout.spec.ts` — the five-tier ribbon test guards its ghost-lane assertion with `if (track.segs === 0) continue;`.
>
> **Both must be removed together when this lands.** A guard left in place after the fixture can exercise the path is a gate that has quietly stopped checking.
>
> ## What it would take
>
> `scripts/demo-corpus.ts` builds the corpus by running real CLI commands (`cli(['edit', id, '--always=true', '--yes'])`), so the shape already exists: add a small item and one `--continuity=true` call, and give the demo config a proportionate `budgets.continuity` beside its existing `{ pinned: 240, jit: 180, restored: 240, index: 90 }` — the 2,000 default is wildly out of scale for that fixture and would make the tier admit everything.
>
> The item should be a bounded POINTER, which is what `DEC-continuity-gets-its-own-budget-and-the-item-it-holds-must-be` rules a continuity item must be. Done that way the fixture demonstrates the ruling rather than merely satisfying a gate — which is the only reason this is worth doing at all.
>
> ## The risk that makes it non-trivial
>
> `.demo-corpus` is deterministic and git-ignored, and a great many assertions elsewhere depend on its exact contents — item counts, per-screen row counts, which tiers run. Adding an item or moving one onto a new tier can shift those. That is why `seq:9` ledgered the gap instead of changing the fixture under a deadline: the change is small and its blast radius is not.
>
> ## Done when
>
> The demo corpus contains one bounded `continuity: true` item and a proportionate `budgets.continuity`; the preview ribbon draws a continuity segment over it; `div.continuity.seg` is removed from `KNOWN_GAPS.preview`; the `track.segs === 0` guard is removed from `e2e/app-layout.spec.ts`; and the full browser suite is green.

## Relations
- superseded_by [[INSTR-testing-happens-against-the-current-corpus-and-an-exception]]
