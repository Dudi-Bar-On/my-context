---
id: TASK-code-and-tests-that-speak-with-a-retired-item-s-authority
type: task
title: code and tests that speak with a retired item’s authority are named
status: active
severity: soft
always: false
summary: A comment or a test that rests on a decision the project has since reversed says so, instead of sounding current.
summary_of: 2deea0492a78f4d1
scope:
  - scripts/**
  - src/**
  - test/**
  - e2e/**
tags:
  - v2
  - governance
  - testing
  - "plan:governance"
  - "seq:6"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: b66f2706582e3ac4
plan: governance
seq: "6"
state: done
priority: "2"
verified_on: 2026-09-07
---

# code and tests that speak with a retired item’s authority are named

Owner ruling 2026-09-07, from a defect that cost a morning and from a question he asked after it.

WHAT HAPPENED. I read a comment in e2e/app.ts citing
DEC-the-ui-is-developed-against-a-simulated-corpus-until-the as a live ruling, and reasoned from
it for hours. That decision had ALREADY been superseded - by his own
INSTR-testing-happens-against-the-current-corpus-and-an-exception - and the product refused my
attempt to supersede it a second time, which is how the truth surfaced.

HE SUSPECTED SUPERSESSION WAS TOO WEAK AND THAT RETIRED ITEMS SHOULD LEAVE THE CORPUS. Measured,
the mechanism is the opposite and that fix would have made it worse:
  - the item was NEVER INJECTED - zero mentions in that session’s SessionStart output;
  - injection ALREADY filters retired items, through RETIRED_STATUSES in src/core/select.ts
    (superseded, deprecated, validated);
  - the carrier was a LIVE COMMENT in a source file.
Deleting the item would leave that comment citing something that no longer exists - less
recoverable than a comment citing something retired, not more. The corpus behaved correctly.

THE GAP, MEASURED: 2,427 item citations across src, e2e, test and scripts. 54 retired items.
31 CITATIONS NAME A RETIRED ITEM - among them src/core/handover-ask.ts, src/core/focus.ts,
src/core/render.ts, src/doctor/checks.ts and src/cli/index.ts. verify-citations already proves a
citation points at REAL CODE; nothing checks the inverse, that a cited ITEM is still in force.
The measuring script is in the session scratchpad as cite.mjs.

REPORTED, NEVER GATED, and this is the load-bearing decision. 31 findings would be a wall, and a
comment citing a retired decision is OFTEN CORRECT AS HISTORY - "this was ruled X, then
superseded by Y" is exactly the reasoning this codebase keeps in its comments on purpose. What
the check must do is make the reader SEE the retirement without looking it up, which is precisely
what I failed to do. A gate that forced 31 edits would delete history to go green.

THE SECOND HALF, WHICH HE ASKED FOR AND IS HARDER: A TEST CAN REST ON A RETIRED RULING WITHOUT
CITING IT. A comment names its authority; a fixture just encodes it. The live case is budget/16 -
its change reds 49 tests across 14 files, and NONE is a logic failure: every one is a fixture
written when a non-always governing item could not reach a full-text tier. Those tests assert an
absence a ruling has since made false, and no citation anywhere connects them to it.

So the honest scope is two mechanisms, not one, and the second may not be fully solvable:
  1. CITED: walk item ids in source and name the retired ones. Mechanical, 31 known today.
  2. UNCITED: a test whose premise a ruling reversed. Not findable by scanning. What CAN be done
     is make it findable at RULING TIME rather than at breakage time - when an item is
     superseded, the decision that replaces it names the tests whose premise it changes, the way
     an item already names its scope. That is a habit plus a field, not a scanner.
Design both, and say plainly if the second reduces to discipline rather than a check - that is a
finding, not a failure.

HALF ONE LANDED 2026-09-07, commit 7d10c14, and was verified in this session rather than taken on
the lane’s word: scripts/check-cited-items.ts exits 0, its 23 tests pass, typecheck is clean.

IT IMPORTS RATHER THAN RESTATES: RETIRED_STATUSES from core/select.ts - the same constant injection
filters on - and its id resolution from check-handover.ts, which is load-bearing: 9 of the sites use
shortened or hyphen-broken ids that an exact-match scan misses.

MY MEASUREMENT WAS WRONG IN BOTH DIRECTIONS AND THE LANE CORRECTED IT. The "2,427 citations" were
id-shaped STRINGS, most of them test fixtures inventing ids; 1,441 resolve to real items. The "31"
is 68 sites naming 16 retired items - 29 comments that read as a live ruling, 13 that say the ruling
moved, 26 in code.

TWO FINDINGS I DID NOT HAVE. Five of the 16 retired items record NO SUCCESSOR AT ALL, which
retirementEdgeRefusal says in as many words this system does not offer. And one successor is itself
superseded, with 11 sites citing the first hop - so a one-hop report would have sent every one of
those readers to a second retired item. The check follows the chain to the end.

HALF TWO IS NOT CLOSED BY THIS AND WAS NEVER GOING TO BE. A test can rest on a retired ruling
WITHOUT CITING IT, and no scanner can see that - budget/16 proved it the same day, reddening 26
fixtures of which ZERO named the rule they rested on. That half is plan:contra seq:2 (ask at
supersede time) and plan:basis seq:1-2 (a test declares what it rests on). Both are filed.
