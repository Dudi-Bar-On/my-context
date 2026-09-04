---
id: TASK-seen-is-treated-as-delivered-current-and-whole-and-an-item
type: task
title: seen is treated as delivered, current and whole, and an item can be none of those
status: active
severity: soft
always: false
summary: Skipping an item because it was seen assumes three things the record never checked, so a stale or title-only item is never sent again.
summary_of: 750952413c32a59a
scope:
  - src/core/select.ts
  - src/core/inject.ts
  - src/core/ledger.ts
tags:
  - v2
  - injection
  - budget
  - enforcement
  - "plan:budget"
  - "seq:17"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: cbfdab6aa9d12ea0
plan: budget
seq: "17"
state: doing
priority: "1"
---

# seen is treated as delivered, current and whole, and an item can be none of those

Owner ruling 2026-09-04. In his words: protect against dedupe of injections. If an item is
supposed to be in context, the injection should look for it and verify that it is the latest
version and that it carries its whole body, and only then decide not to inject. He notes this
also makes the myctx figure reliable, and it does, because a share computed over deliveries that
may not still be true is a number about the past rather than about the window.

What the seen gate does today is skip an item because a record says it was delivered once. That
single fact is being read as three:

ONE, that it is still there. A compaction rebuilds the window and an eviction removes an item
without recording anything, so a delivery from an hour ago proves nothing about now.

TWO, that it is the same item. An item can be edited or superseded after it was delivered. The
agent then holds an older text and the corpus believes it is covered, which is worse than not
having delivered it, because nothing will correct it.

THREE, that the whole of it arrived. This one is not hypothetical and it is already measured: 69
governing items reach a session as a TITLE ONLY, named by the disclosure that shipped the same
day. Under the seen gate every one of them is marked delivered. So the corpus records that a
rule was sent, the agent received its name and never its text, and it will never be sent again.
That is the exact shape of the failure this project has been chasing: a rule that cannot be
obeyed while every count says it arrived.

What is knowable and what is not, which must be settled before building rather than discovered:
the version IS knowable, because a checksum is recorded and can be compared against the item as
it now stands. The completeness IS knowable, because the tier an item was admitted to is
recorded and an index line is not a body. Presence is NOT knowable from the log; nothing
observes an eviction. So two of the three can be verified and the third can only be bounded, and
the answer must say which it is rather than implying it checked all three.

The rule to implement: an item is skipped only when what was delivered is still current and was
whole. Otherwise it is offered again. A title-only delivery does not satisfy a later need for
the body, and a superseded version does not satisfy a need for the item.

Watch the cost. Re-offering everything unverifiable would defeat the gate and refill the window,
so the change must be measured on a real session and reported as tokens, not asserted as
correct.
