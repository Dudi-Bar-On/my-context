---
id: TASK-hebrew-emphasis-the-owner-places-it-because-nothing-else-can
type: task
title: "Hebrew emphasis: the owner places it, because nothing else can"
status: active
severity: soft
always: false
summary: The Hebrew wording carries no emphasis and only the owner can say where it belongs, since guessing would be inventing rather than translating.
summary_of: 6ebf8f3fc78282fa
acknowledged:
  - state_unaudited@4ea302f2eaf3ae0a
scope: []
tags:
  - v2
  - ui
  - strings
  - i18n
  - owner-input
  - "plan:walk"
  - "seq:1h"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: fdd28b6f8530ef0d
plan: walk
seq: 1h
state: done
priority: "2"
source: DEC-hebrew-gets-the-same-emphasis-english-does
---

# Hebrew emphasis: the owner places it, because nothing else can

The second half of plan:walk seq:1, split out on the owner s ruling that Hebrew gets the same emphasis English does.

ENGLISH IS DONE. 57 keys carry {m:b:} or {m:i:}, transformed from the mockup s own markup, each checked to flatten to the string en.js already held. Measured effect: 197 divergences to 164, b/i findings 41 to 11, and status and tut are the first two clean screens of the twenty-one.

HEBREW HAS NO SOURCE. The mockup s {m:const HE} table is plain strings with no markup in any of them -- switching the design of record to Hebrew drops every piece of emphasis on every screen. So there is nothing to transform, and an agent placing stress in Hebrew would be pattern-matching a language rather than reading a specification.

WHAT IS NEEDED: for each of the 57 keys, where the emphasis falls in the Hebrew sentence. That is the owner s to say. The English value beside it shows what is being emphasised and why, so the question is where the same emphasis lands, not what to emphasise.

THE DEBT IS HELD BY A TEST, deliberately, so it cannot quietly become permanent: {m:learn-screen.test.ts} asserts that English draws the italic and Hebrew does not, and says that the day he.js gains the marker BOTH branches should expect the mockup s full list. strings-parity compares key SETS and not marker content, so the asymmetry is structurally legal while it lasts -- legal, and unfinished.

## Relations
- supersedes [[TASK-the-string-grammar-has-no-bold-run-so-three-of-the-mockup]]
