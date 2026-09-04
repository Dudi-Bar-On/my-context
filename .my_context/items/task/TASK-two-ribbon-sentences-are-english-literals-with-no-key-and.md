---
id: TASK-two-ribbon-sentences-are-english-literals-with-no-key-and
type: task
title: two ribbon sentences are English literals with no key, and nothing counts the rest
status: active
severity: soft
always: false
summary: Two sentences on screen were never set up for translation and stay English, and nothing counts how many more are like them.
summary_of: 8655cb67293f493f
scope: []
tags:
  - v2
  - ui
  - walk
  - i18n
  - "plan:walk"
  - "seq:60"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 34d0eba1ada00ea6
plan: walk
seq: "60"
state: done
priority: "1"
source: owner asked why a lane said absent, 2026-08-28
---

# two ribbon sentences are English literals with no key, and nothing counts the rest

> Found 2026-08-28 while explaining a ribbon message to the owner.
>
> `screens/preview.js`'s not-run branch builds two pieces of user-facing text as ENGLISH LITERALS, with no string key and no `ctx.t`:
>
>     label.append(el('span', null, 'does not run on this event'));
>     ...
>     el('div', 'hint', 'Absent, not empty — this event never reaches the tier at all.')
>
> In Hebrew both stay English. The screen switches language around them and they do not move.
>
> ## Why no gate caught it
>
> `strings-parity` compares KEY SETS between `en.js` and `he.js`. A string with no key is invisible to it — there is nothing to be missing from the other table. `bidi.spec` counts `.m`/`.v` runs per `data-t`; text under no `data-t` is not censused either.
>
> **So the gates are sound and the defect is outside what they measure.** That is the same blind spot that made `plan:walk seq:7` refuse to build `#readout`: its words are literals under no `data-t`, and the agent correctly declined rather than inventing keys. Here the literals already shipped.
>
> ## The wider question this raises, which is the point of filing it
>
> **How many more are there?** Nobody knows, because nothing counts them. A check that finds user-facing string literals in `src/ui/public/screens/*.js` — text passed to `el()` as a third argument, or appended as a bare string, that is not a `ctx.t`/`ctx.tFlat` result — would turn "we think the UI is translated" into a measured claim. Today it is an assumption resting on nobody having added a literal, which is exactly the assumption this item disproves.
>
> That check is worth more than this fix. Write it first, then fix everything it names.
>
> ## Bounds
>
> * The two strings above go in BOTH tables with `{m:…}` markers where a run needs them, and the mockup — the design of record — carries the element first. The mockup already draws both sentences (`renderRibbons`, its own `if(!runs)` branch, with a Hebrew form beside the English), so the copy exists and need not be invented; it needs a key.
> * Do not fix this by deleting the sentences. They are the disclosure that makes an absent tier different from an empty one, which `preview.ribbonn` argues for explicitly.
>
> ## Done when
>
> A check enumerates user-facing literals under `screens/`; these two carry keys in both tables; the mockup carries the keyed elements; and whatever else the check names is either fixed or listed with a reason.
