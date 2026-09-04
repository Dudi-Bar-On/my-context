---
id: TASK-the-ask-screen-never-sets-the-limit-its-endpoint-accepts-and
type: task
title: the ask screen never sets the limit its endpoint accepts, and cannot page
status: active
severity: soft
always: false
summary: The results list stops at a hundred rows with no way to see the rest and no way to ask for more.
summary_of: 917e044075a1ec44
scope: []
tags:
  - v2
  - ui
  - walk
  - "plan:walk"
  - "seq:75"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: f88f89af65ac11e0
plan: walk
seq: "75"
state: done
priority: "1"
source: owner, 2026-08-29
---

# the ask screen never sets the limit its endpoint accepts, and cannot page

> Owner, 2026-08-29: *"ask corpus has a limit parameter but it could not be changed, either add capability to set the limit or paging buttons."*
>
> **Measured, and correct in every part**
>
> * `/api/ask/corpus` accepts `limit` — an integer 1..1000 defaulting to 100 — and its `unknownParams` allow-list already includes it (`ui/ask-model.ts` · `const limit = intParam(url, 'limit', 1, 1000, 100);` · ~192).
> * **`screens/ask.js` never sets it.** The only occurrence of the word in that file is a comment about the truncation probe.
> * The query binds `limit + 1` deliberately as that probe (`ask-model.ts` · `params.push(f.limit + 1);` · ~140), so **the screen already holds the signal that more rows exist and does nothing with it.**
> * The Audit tab renders very large row counts as well — 986 observed in the running app — so this is probably not corpus-only.
>
> **Two different questions, and the report names both**
>
> * **Paging** answers *"show me the rest of what you fetched."*
> * **Raising the limit** answers *"go and get more."*
>
> A reader who reaches the end of 100 rows needs the second, not the first. They are not alternatives despite the report offering them as such.
>
> **The house mechanism already exists and must be used rather than reinvented**
>
> `screens/parts.js` exports `boundedList` with `BOUND_CAP_LIST = 20` and `BOUND_CAP_TABLE = 50`. It bounds, discloses what it dropped, and offers Previous / Next / Show all. The preview's spilled-items card uses it, and it is where `reports/uiux/sketches/05-dataviz.html`'s rule — *bound it, disclose what you dropped, give a way through* — lands in this codebase. A second paging mechanism beside it would be the two-spellings defect this codebase keeps meeting.
>
> **Where a limit control belongs is a real question**
>
> The filter machinery was reworked hours earlier: `AUDIT_FIELDS` and `CORPUS_FIELDS` are now declarations of `{ name, filter, column, label }`, and `filterFields(mode)` derives the controls from them. `limit` is in the endpoint's allow-list, so it could join that machinery directly — but a CAP is not a FILTER, and putting it in a list of filters may teach the wrong thing about what it does.
>
> **Why this went unnoticed**
>
> The same reason as the audit table beside it: on a fixture with fewer rows than the cap, a missing pager and a working one look identical. Any test written over `.demo-corpus` would have passed while measuring nothing — the failure mode this project has now hit four times in three days.
>
> **Done when**
>
> A reader can reach every row the endpoint will serve; the count of what was not shown is STATED rather than implied; the Audit tab is checked for the same gap; `boundedList` is reused or the argument against it recorded; and a browser test drives a corpus with more rows than the cap, because one with fewer proves nothing.
