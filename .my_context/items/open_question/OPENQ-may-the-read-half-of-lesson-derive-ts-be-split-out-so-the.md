---
id: OPENQ-may-the-read-half-of-lesson-derive-ts-be-split-out-so-the
type: open_question
title: may the read half of lesson/derive.ts be split out so the composer can offer a staged lesson's keys
status: deprecated
severity: soft
always: false
summary: "The one D11 field that could not be built: nothing serves a staged lesson, because listStaging sits behind core/mutate.ts."
summary_of: 1295f7466cd5d6f7
scope:
  - src/lesson/derive.ts
  - src/ui/read-model.ts
  - src/ui/public/lib/palette-defs.js
  - src/ui/public/screens/palette.js
tags:
  - v2
  - ui
  - composer
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: 2026-09-06
checksum: 412767d62ace0682
---

# may the read half of lesson/derive.ts be split out so the composer can offer a staged lesson's keys

Split out of builder/10 (D11) on 2026-09-06, which built two of the three fields it names and
could not build this one. The ruling's own words were that `key` is *"the staged lesson's own
keys - already fetched for the `id` picker sitting next to it, so the data is on the page
already"*. Measured 2026-09-06: neither half is true, and the reason the second half is false
is a boundary this project has already refused to cross once.

WHAT IS ACTUALLY THERE. `lesson-accept <id> <key>` and `lesson-discard <id> <key>` both take a
LESSON id and a candidate key. Five staging files exist on this corpus right now
(`.my_context/.staging/*.json`), each `{ protocol, lessonId, createdAt, candidates: [{ key,
candidate }] }` with `key` an eight-hex digest. `listStaging` (`src/lesson/derive.ts`) is the
function that reads them, and `mycontext status --json` already composes `stagedRules` from it.

WHAT IS NOT THERE. No endpoint serves any of it, and `id` on both entries is `input: 'text'` —
a blank box, not a picker — so nothing about staged lessons is on the Composer at all.

WHY IT IS NOT AN OVERSIGHT. `src/lesson/derive.ts` line 6 imports `createItem` from
`core/mutate.ts` as a VALUE, so it is a runtime edge. `src/ui/read-model.ts` has already
refused exactly this read for exactly this reason, about `st.staged` on the status screen, in
its own words: *"serving `st.staged` would put the mutation surface into this server's runtime
import graph for the first time. That is a decision about the boundary §0.5 is the owner's
ruling on, not a field to add on the way past."* `test/ui/no-writes.test.ts` is the gate that
means it, and it fails on the SYMBOL rather than the file, deliberately, so an allow-list is
not the route round it.

THE THREE ANSWERS.

  SPLIT THE MODULE. Move `stagingDir`, `STAGING_PROTOCOL`, `LessonStaging`, `StagedRule`,
  `loadStaging` and `listStaging` into a read-only `src/lesson/staging-io.ts`; `derive.ts`
  imports them from there. Nothing changes behaviourally and there is no second spelling of the
  rule — the same function, in a module with no writer in its graph. `no-writes.test.ts`
  derives its WRITERS membership automatically, so the new module is judged on what it actually
  calls. Then `/api/lessons` (or a field on an existing body) serves `[{ lessonId, keys: [{ key,
  title, directive }] }]`, and BOTH fields improve at once: `id` gets a picker over the lessons
  that actually have candidates — five here, against a 950-item box — and `key` gets
  `input: 'suggest', source: 'lessonKeys', dependsOn: 'id'`, which is exactly the mechanism
  `ack --code` already runs on. This is the recommended answer.

  SERVE IT ANYWAY. Import `listStaging` from `derive.ts` and accept `core/mutate.ts` in the UI
  server's import graph. Cheapest to write, and it is the thing `read-model.ts` refused; it
  would also be the first time the read surface's own gate had to be widened rather than
  satisfied.

  LEAVE IT. `key` stays a box a person types an eight-hex digest into, read off a terminal.
  That is the state today and it is the one D11 shipped, so nothing is broken by choosing it —
  but it is the one field of the three the ruling asked for that its reader still has to
  retype, which is the defect the ruling was written about.

WHAT IS NOT AT STAKE. Nothing in D11 has to be undone whichever way this goes. The catalogue
entries carry the reason beside them and the change, if it is taken, is two field literals.
