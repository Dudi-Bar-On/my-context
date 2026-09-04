---
id: TASK-a-governing-item-degraded-to-an-index-line-looks-delivered
type: task
title: a governing item degraded to an index line looks delivered and governs nothing
status: active
severity: soft
always: false
summary: A normative or pinned item must arrive with its body or be named as undelivered, never reduced to a title that cannot be obeyed.
summary_of: 2c40f5c5578b34aa
scope:
  - src/core/render.ts
  - src/core/select.ts
  - src/core/inject.ts
tags:
  - v2
  - injection
  - budget
  - enforcement
  - "plan:budget"
  - "seq:14"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 66864a9843175ede
plan: budget
seq: "14"
state: done
priority: "1"
verified_on: 2026-09-04
---

# a governing item degraded to an index line looks delivered and governs nothing

Owner ruling 2026-09-04, given after the alternative was measured and found not to exist. He
asked whether anything could make an agent that receives only an item NAME go and read its
body, and ruled that if there is no such way the body must be injected too, at least for
pinned and normative items.

What was measured before the ruling. A forcing mechanism does exist: preToolUseDeny in
hooks/io.ts returns permissionDecision deny, and it is not theoretical because it is what
enforces the dispatch gate today. But it blocks an ACTION and cannot compel reading. It could
block every tool call until show was run for each carried id, and an agent would call show
and not read the output, because the gate observes the call and not the comprehension. It
also turns each item into a blocking round trip.

Whether index lines are ever followed up is not merely unknown, it is unmeasurable today.
ACCESS_OPS carries ui-refused and nonce-minted only, so an item fetch is not audited and
leaves no record. By this project’s own standard that is an unmeasured thing rather than a
measured zero, and it must not be reported as one.

What IS measured is the failure. On 2026-09-04 the rule about not accepting a test that
passes in isolation had spilled 290 times, and a test of exactly that kind was accepted that
day by an assistant that had only ever seen the rule as a name, if that. A title tells a
reader a rule exists. It does not tell them what it requires.

The rule to implement: a normative or pinned item is delivered with its body, or it is NAMED
as not delivered. It is never silently degraded to an index line. Silent degradation is worse
than a drop because it counts as delivery in every tally while governing nothing, which is
how 46,316 injections coexisted with rules being broken.

This is not a new requirement so much as an unmet one. A pinned item is delivered or the user
is told it was not is already a requirement in this corpus, and it spilled 276 times.

Budget is the real constraint and must be faced rather than assumed away. Bodies cost more
than titles, so state what happens when the normative set does not fit: which tier pays,
whether a budget rises, and what the reader is told. An honest refusal naming the undelivered
items satisfies this rule; a quiet truncation does not.
