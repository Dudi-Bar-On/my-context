---
id: TASK-the-preview-s-path-picker-cannot-filter-and-the-screen-never
type: task
title: the preview's path picker cannot filter, and the screen never says so
status: active
severity: soft
always: false
summary: Choosing a file changes nothing, because almost nothing in this project is tied to a particular file in the first place.
summary_of: be6176570a4cc7cf
scope: []
tags:
  - v2
  - ui
  - walk
  - "plan:walk"
  - "seq:58"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 073d3fcc2b7a7486
plan: walk
seq: "58"
state: done
priority: "1"
source: owner, 2026-08-28
---

# the preview's path picker cannot filter, and the screen never says so

> Owner, 2026-08-28: *"event - when selecting tool, the path should be used as filter but it does nothing"*.
>
> ## Measured: the control is wired correctly end to end, and it cannot filter
>
> Traced and driven against the real corpus, not the demo one:
>
> * `screens/preview.js` sets `chosenPath` on change and refetches (`picker.onchange`).
> * `read-model.ts` · `ctx.path = target` · ~286 sets `ctx.path = target` for `event=tool`.
> * `select.ts` · `function jitTarget(ctx: SelectContext): string {` · ~972 normalises it; `select.ts` · `if (jitTarget(ctx) !== '') tiers.push('jit');` · ~1080 pushes the `jit` tier; `select.ts` · `const candidates = fresh.filter((i) => matchesScope(i, target, config));` · ~1241 filters candidates by scope.
>
> Every link holds. Then:
>
>     path                        delivered
>     .gitignore                  27   (all tier `jit`)
>     harness/anything.ts         27   identical ids
>     reports/V2-HANDOVER.md      27   identical ids
>
> **The owner is right and the UI is not at fault.** `matchesScope` is:
>
>     if (item.scope.length === 0) return scopePolicyFor(config, item.type) !== 'inert';
>     return matchesAnyGlob(target, item.scope);
>
> `scopePolicy` defaults to `global`, under which an unscoped item is unrestricted — it matches EVERY path. **619 of this corpus's 621 items carry `scope: []`.** So the jit candidate set is the same 102 items whatever path is chosen, `fitToBudget` admits the same 27, and the path is arithmetically incapable of changing the answer.
>
> ## The screen presents an inert control as a filter, and that is this task
>
> A `<select>` labelled `path`, offering 1,051 files, that cannot alter the result. The owner reasonably read that as broken. It is not broken; it is a control whose effect is contingent on corpus state the screen never mentions.
>
> The same shape this project keeps finding: correct about what it does, silent about what it cannot do. `cap.warn` and the bare-URL 401 both moved this way — the fix is disclosure at the point of use, not a rewrite.
>
> What the screen has to say, from facts it can already fetch: how many items carry a scope at all, and that unscoped items match every path under the policy in force. `/api/items` carries `scope` per item and `/api/config` carries the policy, so nothing new is needed server-side. When the count is 2 of 621, the honest sentence is that changing the path will not change much and why.
>
> ## Bounds
>
> * **Do not "fix" this by changing `scopePolicy`.** That is the owner's config and a corpus-wide behaviour change; `inert` would make 619 items un-injectable on the JIT tier. It is named here only so the next reader knows the lever exists and that it is not this task's to pull.
> * **Do not hide the control when nothing is scoped.** A missing control is the same silence one step further on. It is disclosed, not removed.
> * The ranking question the same measurement raised — a genuinely path-scoped item SPILLING on its own path — is deliberately not in this task. See the open question filed beside it; it changes what every session receives and is not the screen's to decide.
>
> ## Done when
>
> The preview discloses, when `event=tool` is selected, how many items are scoped and what the policy in force means for the rest; a browser test asserts the disclosure appears and carries the real count; both string tables carry the new keys, with `{m:...}` markers in the mockup's Hebrew copy so `bidi.spec.ts` does not fail on a run-count mismatch; and the mockup gains the element first.
