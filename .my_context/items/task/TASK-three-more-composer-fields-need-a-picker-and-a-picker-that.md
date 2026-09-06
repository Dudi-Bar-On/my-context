---
id: TASK-three-more-composer-fields-need-a-picker-and-a-picker-that
type: task
title: three more composer fields need a picker, and a picker that can hold nine hundred entries
status: active
severity: soft
always: false
summary: The remaining list-backed inputs depend on a decision about how a long list is presented at all.
summary_of: 261768844838c2d9
scope:
  - src/ui/public/lib/palette-defs.js
  - src/ui/public/screens/palette.js
tags:
  - v2
  - ui
  - composer
  - "plan:builder"
  - "seq:10"
  - "state:todo"
  - "priority:3"
  - "needs:builder/9"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 4451204c7d0d94a6
plan: builder
seq: "10"
state: todo
priority: "3"
needs: builder/9
---

# three more composer fields need a picker, and a picker that can hold nine hundred entries

Owner ruling 2026-09-06 (plan D11). Dispatched AFTER D10 (`plan:builder seq:9`).

THE THREE FIELDS, each with a real domain the product can serve:

  finding   ack               doctor’s live findings. /api/doctor returns them; today a reader
                              retypes a code they just read off the screen beside it.
  key       lesson-accept,    the staged lesson’s own keys - already fetched for the `id` picker
            lesson-discard    sitting next to it, so the data is on the page already.
  pack      init              the packs on disk. /api/packs exists and Template packs lists them.

WHY THEY ARE NOT IN D10. The `id` picker builds 938 <option> elements today - measured live - and
rebuilds them on every command switch; nine commands take an `id`. Adding more list-backed fields
makes the screen richer AND heavier. `finding` in particular is a list a reader scans rather than
one they already know the answer in, which is the case a <select> serves worst.

SO THE RULING COMES FIRST: does the builder keep a plain <select> for a long domain, or gain a
searchable combobox? The architecture review
(docs/superpowers/specs/2026-09-06-composer-architecture-review.md §7) established that this is a
drop-in rather than a redesign - `pickerOptions()` already returns a plain array, so the <select>
branch in `controlFor` can be replaced without touching the builder’s contract. That is the whole
reason it is safe to defer: nothing built in D10 has to be undone.

CONSTRAINTS ON ANY ANSWER: no dependency and no build step, so a combobox is hand-written; it must
be correct under dir=rtl; and it must stay keyboard-reachable, which a <select> is for free and a
div-based widget is not.
