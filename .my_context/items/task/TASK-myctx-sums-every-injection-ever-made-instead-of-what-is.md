---
id: TASK-myctx-sums-every-injection-ever-made-instead-of-what-is
type: task
title: myctx sums every injection ever made instead of what is resident, so it reports three hundred percent of the window
status: active
severity: soft
always: false
summary: The status line adds up all delivered tokens rather than those still in the window, so the figure only grows and passes one hundred percent.
summary_of: d15e1338d148a236
scope:
  - src/core/context-share.ts
  - src/cli/commands/statusline.ts
  - src/cli/commands/statusline-powerline.ts
tags:
  - v2
  - statusline
  - budget
  - "plan:rulings"
  - "seq:61"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: d35ca489b8c7fc10
plan: rulings
seq: "61"
state: doing
priority: "1"
verified_on: 2026-09-04
---

# myctx sums every injection ever made instead of what is resident, so it reports three hundred percent of the window

Reported by the owner 2026-09-04 looking at his own status bar: the figure climbs far faster
than the context window itself and is illogical. Measured on his live session the same day and
it is worse than a drift, it is the wrong quantity.

260 injection records this session summing to 3,200,920 tokens, of which jit alone is 3,100,234,
against a context window of 1,000,000. The status line is therefore reporting about three
hundred and twenty percent of the window as belonging to my_context, which no display rounding
explains.

The cause is in shareOf and shareSql in core/context-share.ts, which add the tokens of every
injection record in the session. That is a running total of everything my_context has EVER
emitted, not what is currently resident. The same rule delivered ten times counts ten times, and
anything long since evicted is still counted. jit fires on every file touch and re-delivers
overlapping items, which is why it dominates. The number can only ever grow while the real
window evicts and compacts.

This is not only cosmetic. The same share feeds the handover threshold, so a percentage that
passes one hundred can trigger a handover that was never warranted, and it is the figure the
budget simulator was asked to anchor on.

What to establish first, because it decides whether this is fixable exactly or only honestly.
The ledger holds one row per session, item and tier, so the DISTINCT items delivered to a
session are knowable and summing each item once is a far better estimate than summing every
delivery. What is not knowable from the log alone is eviction: an item delivered an hour ago and
since pushed out of the window still counts. Say plainly which part can be measured and which
can only be bounded.

Then decide what the status line should show, and say what it means in words a reader can act
on. A figure that cannot be exact must not be drawn as though it were; this project already
distinguishes a measured value from an unmeasured one and the same honesty applies to an
approximate one. There is already a convention for approximation here, the qualifier that rides
the name when some deliveries are unrecorded.

A ceiling at one hundred percent is not the fix and must not be mistaken for it. Clamping hides
the defect at exactly the moment it matters most.
