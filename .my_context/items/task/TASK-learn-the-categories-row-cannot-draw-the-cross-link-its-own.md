---
id: TASK-learn-the-categories-row-cannot-draw-the-cross-link-its-own
type: task
title: "Learn: the categories row cannot draw the cross-link its own verdict is conditional on"
status: active
severity: soft
always: false
summary: One row of a four-row screen cannot show the link that justifies the screen existing, because nothing in the answer names an example to point at.
summary_of: c2e0dd4b3ad4c25a
scope: []
tags:
  - v2
  - ui
  - mockup
  - tree-parity
  - "plan:walk"
  - "seq:88"
  - "state:todo"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: e92e4d052eb7cb09
plan: walk
seq: "88"
state: todo
priority: "2"
progress: "0"
source: "plan:walk seq:27, measured against src/ui/public/screens/learn.js on 2026-08-29"
last_change: "2026-08-29T00:00:00Z"
---

# Learn: the categories row cannot draw the cross-link its own verdict is conditional on

WHAT THE SCREEN IS, so it can be built without opening the mockup. `nav.read` - **Learn**, `<section data-p="learn">`. ONE card holding a four-row table, one row per help topic: the topic name in monospace, a small cell carrying that topic's one-line description (`ln.c`, `ln.s`, `ln.p`, `ln.w`), and after a `·` a monospace item id FROM THIS CORPUS. The title is `Learn` (`ln.h`), never "Help".

WHAT IT IS NOT, and both were live proposals that the design of record refused. It is NOT the plan's Step 3 sketch - a `<select>`, an `<article>` of rendered markdown and an `<aside>` of corpus links - which cannot be built as written on four counts: it names four keys no table declares (`t()` throws on a missing key, so the screen would render nothing at all); it assigns `doc.innerHTML`, destroying the `.m` spans that carry `unicode-bidi:isolate`; the markdown surface in the design of record is `<section data-p="docs">`, not this one; and `dv.mdnote` rules the string form out where markdown IS drawn. And it is NOT a documentation viewer: `markdown` is the largest field in each `/api/help/:topic` response and is fetched and deliberately not drawn.

ITS VERDICT IS CONDITIONAL, AND THE CONDITION IS THE JOIN. `ln.v` is the warning glyph, and the condition is in its own words - "the corpus cross-links earn it". Without the join this screen is a documentation viewer and should be CUT. So the cross-link is not decoration here; it is the entire argument for the screen existing.

WHAT IT OWES, AND IT IS EXACTLY ONE ROW OF FOUR. `/api/help/:topic` answers `{ topic, markdown, corpus }` with a different `corpus` shape per topic, and only two of the four carry an item id:
  - `scope` -> `corpus.scoped[].id`, an item that declares one. SERVED, drawn.
  - `capture` -> `corpus.recent[].id`. SERVED, drawn - and it gains a cross-link the mockup does not draw, taking no recency label with it, because `recent` is ordered by FILE MODIFICATION TIME (the only recency signal that exists, since `Item` has no creation timestamp) and no key can state that condition.
  - `workflow` -> `{ drafts, pendingRevisions }`. Two counts, no id - AND THE MOCKUP DRAWS NO CROSS-LINK ON THIS ROW EITHER, so the two agree and this half is already closed.
  - `categories` -> `{ counts, empty }`. A tally and a list of category NAMES. **No item id.** THE MOCKUP DRAWS ONE HERE - `CONST-zero-runtime-dependencies` - and this screen cannot. An id invented from a tally would be a claim about which item demonstrates "which categories are normative" that nothing in the response makes, so the row is drawn with its description and no cross-link.

SO THE OWING IS IN THE ENDPOINT, NOT IN THE SCREEN. `/api/help/categories`' `corpus` shape gains an exemplar item id, in the same shape `scope` and `capture` already serve, AND THE RULE FOR CHOOSING IT IS WRITTEN DOWN - because "which item demonstrates normativity" is a judgement, and an undocumented judgement is precisely the invented claim this screen refused to make. The markup for the cell already exists; the row then draws it with no further work.

THE ALTERNATIVE IS EQUALLY CONCRETE AND IS THE OWNER'S TO TAKE: rule that `categories` carries no cross-link, correct the design of record so it stops drawing one, and accept that `ln.v`'s condition is met by two rows of four rather than three.

DO NOT CLOSE THIS BY PUTTING A CATEGORY NAME IN THE ID CELL. That cell is `span.m` holding an item id. A category name there is a different kind of thing wearing the id's clothes, and it would make the join look satisfied on a row where it is not.

ONE ID PER ROW, whichever way it is settled - `scoped` and `recent` are lists and the design of record shows a single id after a `·`. A "+N more" affordance would need a key that does not exist.

Filed under plan:walk seq:27 - Learn's only claiming task is `ui1/19`, which tracks that four screens were built from a plan section and says nothing about what this screen is or what it still owes.
