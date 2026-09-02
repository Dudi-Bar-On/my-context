---
id: DEC-continuity-gets-its-own-budget-and-the-item-it-holds-must-be
type: decision
title: continuity gets its own budget, and the item it holds must be bounded
status: active
severity: soft
always: false
summary: The note that carries a session's work forward gets room of its own that nothing else competes for, and must stay short enough to always fit inside it.
summary_of: d6f26d0147974d3c
scope: []
tags:
  - v2
  - selection
  - continuity
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 1ff85183d7258b13
---

# continuity gets its own budget, and the item it holds must be bounded

> Owner, 2026-08-28, on being shown that the handover spills: *"if it is about the handover injection - it is first priority and must be injected because it is the project continuity in it's content, if required it should get a special jit hardcoded in the app"*, then: *"it also could have it's special budget because it is an important core infrastructure of the app that promise context never get lost."*
>
> ## The measurement that prompted it, and it is worse than "it spills"
>
> `REF-v2-handover-read-before-discussing-the-web-ui` costs **37,831 tokens** — 2.4x the largest budget in force (`pinned` 16,000, `jit` 16,000, `restored` 24,000, `index` 6,000).
>
> Driven against the real corpus on every event:
>
>     session-start   delivered=NO   spilled=no   index-line=true
>     compact         delivered=NO   spilled=no   index-line=true
>     manual          delivered=NO   spilled=no   index-line=true
>
> **It has never been delivered.** Not spilled — not even a candidate, because `always: false` keeps it off the pinned tier and the pinned tier is the only one those events run besides the index. It has existed as a single index line for its whole life. The document held to be the app's continuity guarantee has never once been injected, and continuity has in fact been carried by the compaction summary and the other corpus items.
>
> That is the strongest possible argument for the owner's position: the guarantee was believed to be in force and was not, and nothing said so.
>
> ## Decided: continuity gets its own budget
>
> Not a hardcoded id in `select`. The owner's second formulation is the better one and is adopted: a dedicated budget, because the objection to the first is that a hardcoded branch is a rule invisible from every screen, and this project has ruled repeatedly that an invisible rule is a defect waiting to happen. A tier is inspectable — it appears on the ribbon, in the simulator, in `/api/config`, and a person can see what it holds and what it cost.
>
> Its purpose distinguishes it from the four: `pinned`, `jit`, `restored` and `index` all answer "what governs this work". Continuity answers "what does the next session need in order to not start over". Those compete for nothing and should not share a budget.
>
> ## The condition, and it is not optional
>
> **A dedicated budget for an unbounded document only relocates the spill.** The handover grew by roughly 4,000 tokens on 2026-08-28 alone. At 37,831 today, any figure chosen now is a figure that expires; the tier would deliver for some weeks and then silently stop, which is precisely the failure it is being created to prevent, arriving later and harder to notice.
>
> So the tier carries a POINTER PLUS A BOUNDED DIGEST, not the document:
>
> * the item names `reports/V2-HANDOVER.md` and says to read it before changing the web UI;
> * it carries the current state in a form that fits the budget — what landed, what is open, what is ruled;
> * the full document stays on disk and is read on demand, which is what already happens.
>
> The guarantee then holds structurally (its own budget, competing with nothing) and permanently (bounded content). A tier that cannot outgrow its budget is the only kind that can promise anything.
>
> ## What implementing this touches, stated so it is not underestimated
>
> `Budgets` declares exactly four keys and `requireBudgets` REFUSES an unknown one by name — measured: adding `ambient`/`reference` to a config throws *"which are not budgets this config understands"*. So a fifth budget is not a config edit. It reaches: `core/config.ts` (`Budgets`, `DEFAULT_BUDGETS`, `requireBudgets`), `core/select.ts` (the tier union at `:57`, the run order at `:907`, the tier list at `:917`), `core/budgets-write.ts`'s field list, the preview ribbon's four tracks, the simulator's tier picker and sweep, `docs/design/web-ui-mockup.html` as the design of record, and both string tables with `{m:...}` markers so `bidi.spec.ts` does not fail on a run-count mismatch.
>
> ## Both halves are the owner's ruling, not a recommendation

Asked directly, the owner confirmed the same day: *"sayed yes pointer but also should have a special budget."*

So neither half is open. The tier is decided AND the item it holds is a bounded pointer plus digest. The alternative — injecting the whole document behind a budget above 38,000 and raising it whenever the document grows — was put to the owner and not taken, and is recorded here only so nobody re-derives it as a fresh idea.
