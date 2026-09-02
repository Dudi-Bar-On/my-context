---
id: DEC-the-mockup-governs-presentation-never-behaviour-and-a
type: decision
title: the mockup governs presentation, never behaviour, and a contradiction goes to the owner
status: active
severity: soft
always: false
summary: The design drawing decides how things look, never how they behave; consult it only when appearance is the question, and take any conflict to the owner.
summary_of: e1df4d0c7d8558be
scope: []
tags:
  - v2
  - ui
  - design
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: bc848eb7f20ca0b9
---

# the mockup governs presentation, never behaviour, and a contradiction goes to the owner

> Ruled by the owner 2026-08-28: *"stop to look at the mockup as behaviour, it is only for how it should be presented on the screen and only when required not all the time - stop do it and if there is a contradiction bring it to me and let me decide."*
>
> **Three rules, and the assistant was breaking all three**
>
> **1. The mockup governs PRESENTATION. It does not govern BEHAVIOUR.**
>
> Layout, what appears on a screen, visual treatment, copy — the mockup's. Interaction semantics, degradation under load, refresh rules, what an endpoint returns, how a control responds to a drag — **not the mockup's**, and not to be argued from it.
>
> This is not new; `docs/design/web-ui-mockup.md` was corrected on 2026-08-20 to say *"Appearance is the mockup's; behaviour is the spec's."* The assistant read the first half and applied it to everything.
>
> **2. Consult it when a presentation question is at hand — not as a routine step.**
>
> It had become a reconciliation performed on every task whether or not the task was about appearance. That is what "not all the time" refuses.
>
> **3. A contradiction goes to the owner. It is not resolved silently, in either direction.**
>
> Not by following the mockup, and not by overriding it.
>
> **The instance that produced this ruling, recorded because the error is instructive**
>
> The owner asked for a finer slider step: *"the slide resolution is coarse and actually unusable."* The assistant weighed that against `sim.snap`'s prose — *"Every value between two rungs behaves identically, so the slider snaps to rungs — dragging lands on meaning rather than on 6,050"* — and presented three compromise shapes for the owner to choose between.
>
> **Snapping is BEHAVIOUR.** The mockup has no standing over it, so there was no contradiction to weigh and no compromise to design. There was an owner instruction and an assistant treating a picture as a counter-party.
>
> The reasoning in `sim.snap` is not thereby worthless — *"between two rungs the selection does not change"* is a true statement about the selector, and it belongs in the argument. But it belongs as an ENGINEERING observation to be weighed by the owner, not as an authority that has to be reconciled with.
>
> **What this changes in practice**
>
> * Task briefs stop instructing "the mockup is the design of record, edit it first" as a blanket line. It stays correct for a change to what a screen SHOWS. It must not be attached to a change in what a control DOES.
> * The parity gates keep their meaning: `screen-parity`, `tree-parity`, `styles-parity` and `strings-parity` all compare presentation, which is exactly the mockup's remit. **None of them is affected by this ruling.**
> * Where a behavioural change makes the mockup's PROSE untrue — `sim.snap` describing a snap that no longer happens — the prose is corrected to match, because a design document asserting a false behaviour is worse than silent. That is a follow-on edit, not a negotiation.
> * An agent that finds the mockup and a requirement in genuine conflict **stops and reports it**. It does not pick.
>
> **What is still open**
>
> `OPENQ-how-far-does-the-mockup-s-demotion-to-a-demo-go` asked how far "the mockup is just a demo" reached. This answers the behaviour/appearance half. It does not answer whether the mockup remains the design of record for APPEARANCE, and the answer to that is yes — unchanged, gates included.

## Observations
- [supersession] Replaces OPENQ-how-far-does-the-mockup-s-demotion-to-a-demo-go: The owner answered the behaviour/appearance half on 2026-08-28: the mockup is for presentation only, consulted when required rather than routinely, and a contradiction is brought to the owner rather than resolved. Appearance remains the mockup's, gates unchanged.

## Relations
- supersedes [[OPENQ-how-far-does-the-mockup-s-demotion-to-a-demo-go]]
