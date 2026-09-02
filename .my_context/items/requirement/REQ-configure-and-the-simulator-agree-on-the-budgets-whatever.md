---
id: REQ-configure-and-the-simulator-agree-on-the-budgets-whatever
type: requirement
title: Configure and the simulator agree on the budgets, whatever moved them
status: active
severity: hard
always: false
summary: The screen holding the limits and the screen for trying limits out always show the same numbers, whatever changed them and wherever it happened.
summary_of: 88d682b7c5f01aa2
scope: []
tags:
  - v2
  - ui
  - budget
  - live
origin: human
source_file: null
source_anchor: null
source_checksum: 3ab71442effafdf4
valid_from: 2026-08-28
valid_until: null
checksum: 672f1b6257ac018f
---

# Configure and the simulator agree on the budgets, whatever moved them

> Owner requirement, 2026-08-28: *"make sure that the config screen with budget
> settings and the simulator are always stay synchronized, doesn't matter from
> where the change has been made."*
>
> ## What it demands
>
> The Configure screen and the Budget simulator show the same budgets, always,
> whatever moved them:
>
> * a budget written from Configure (`plan:budget seq:5`, landed 2026-08-28);
> * a budget carried out of a simulation (`plan:walk seq:14`);
> * a change made outside the UI entirely — a hand edit to `config.json`, another
>   session, another machine (`plan:live seq:4`).
>
> ## Why this is a requirement and not a nicety
>
> These two screens are the two halves of ONE decision. The simulator answers
> "what fits at this budget"; Configure holds the budget in force. A reader who
> sees them disagree cannot tell which is true, and the failure is silent — both
> screens look correct in isolation, and neither says it is stale.
>
> That is worse than either being wrong on its own. A wrong number invites a
> question; two numbers that disagree invite a guess.
>
> ## The instance that proved it, the same day
>
> `plan:live seq:2` declared what invalidates each screen. It gave
> `simulate: ['mutation', 'injection', 'focus']` and `config: ['hook']`, and that
> was CORRECT when written — nothing could change a budget, so no mutation could
> make Configure stale.
>
> `plan:budget seq:5` landed hours later and audits a budget write as
> `kind: 'mutation'`. From that moment the screen that PERFORMS the write was the
> one screen that would not notice it: change a budget on Configure, and the
> simulator invalidates while Configure does not.
>
> Neither task was wrong. The requirement fell in the gap between them, which is
> where this kind of requirement always falls — it is a property of two features
> together, and each was reviewed alone.
>
> ## What satisfies it
>
> * Both screens declare the same invalidating kinds for the state they share.
>   Fixed 2026-08-28: `config` gained `mutation`.
> * A screen acts on invalidation rather than merely declaring it —
>   `plan:live seq:3`, which is what makes the declaration do anything at all.
>   Until seq:3 lands, this requirement is DECLARED and not yet MET.
> * An edit made outside the UI reaches the page or is disclosed —
>   `plan:live seq:4`.
>
> ## What must not be built instead
>
> Not a shared cache between the two screens, and not one screen reading the
> other's state. They agree because they both read the corpus and both learn when
> it moved — the same reason the shell owns ONE stream rather than each screen
> opening its own (`plan:live seq:1`). A second path by which two screens agree is
> a second thing that can go out of step.
