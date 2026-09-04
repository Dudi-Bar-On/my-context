---
id: TASK-the-provenance-bar-never-renders-its-projection-group-and
type: task
title: the provenance bar never renders its projection group, and one of its three keyed states cannot happen here
status: active
severity: soft
always: false
summary: That same strip is missing the part saying whether the numbers are current, and one of its three planned messages can never happen.
summary_of: fbd27f8fb36cdabe
scope: []
tags:
  - "plan:ui3"
  - "seq:11x"
  - "state:todo"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: 35bb0ff7a3ee2a12
valid_from: 2026-08-22
valid_until: null
checksum: e3b06841c7858c91
plan: ui3
seq: 11x
state: todo
---

# the provenance bar never renders its projection group, and one of its three keyed states cannot happen here

> The mockup's provenance bar ends with a projection qualification — `<span class="provproj" id="provproj">` carrying `prov.projFresh` ("already current"), `prov.projCaughtUp` and `prov.projFailed`. All three keys are in both string tables. `app.js`'s `renderChrome()` builds `#prov` and an empty `#provparts` for screens to fill, and builds no `#provproj` at all, so the qualification never appears.
>
> It belongs to the Audit stream more than to anything else: `/api/watch/volume`, `/api/watch/spills`, `/api/watch/ratio` and `/api/ask/audit` all report `projectionState`, and whether the numbers on screen came from a current projection is exactly the kind of qualification that bar exists to hold. `screens/watch.js` does not build it, because it is SHELL chrome with a lifetime longer than one screen, and a screen module creating chrome that outlives it is a decision for the shell's owner rather than for this task.
>
> **`prov.projCaughtUp` — "{mv:state} and caught up before answering" — cannot happen in this product and probably never could.** Catching a projection up is `syncProjection`, which writes, and every read route goes through `openProjectionReadOnlyChecked`; a stale projection is REPORTED, never repaired (owner ruling C1). So that state is either dead vocabulary to be retired from the mockup and both tables, or evidence that the mockup predates ruling C1. Either way it should not sit there looking implemented.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and the reconciliation makes one of its two halves MORE certain, not less.

THE HALF THAT HARDENED. This task says prov.projCaughtUp -- "{mv:state} and caught up before answering" -- cannot happen in this product, because catching a projection up is a write and every read route goes through the read-only door under owner ruling C1. The owner s ruling of 2026-08-25 (plan:walk seq:28, the WRITER keeps the projection current) settles it permanently: the sync moves further from the read path, not closer. prov.projCaughtUp is DEAD VOCABULARY and should be retired from the mockup and both tables. It is not a maybe any more.

THE HALF THAT STANDS unchanged: renderChrome() builds #prov and an empty #provparts and no #provproj at all, so the qualification never appears on any screen. That is shell work, correctly refused by a screen module, and it still has no owner.

IT BELONGS TO plan:walk seq:12, the refusal enumeration. This is a refusal in the exact sense that matters -- a keyed, translated, both-tables sentence that no code path can ever produce -- and it is invisible to every gate, because strings-parity compares key SETS and a key that is never rendered is still a key.
