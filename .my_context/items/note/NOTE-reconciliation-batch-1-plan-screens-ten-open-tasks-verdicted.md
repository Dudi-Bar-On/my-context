---
id: NOTE-reconciliation-batch-1-plan-screens-ten-open-tasks-verdicted
type: note
title: "reconciliation batch 1: plan:screens, ten open tasks verdicted"
status: active
severity: soft
always: false
summary: A first batch of open work read against the code, settling what is finished and what stands, and one place where two records disagreed.
summary_of: 47d04e63103b8f83
scope: []
tags:
  - v2
  - ui
  - reconciliation
  - "plan:walk"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 83108b8e4527985a
---

# reconciliation batch 1: plan:screens, ten open tasks verdicted

plan:walk seq:23, 2026-08-25. Ten open tasks in plan:screens, read against the corpus, the code and the KNOWN_GAPS ledger, in the order STD-the-precedence-order-when-four-sources-of-truth-disagree sets.

  seq:9s   DONE            status s one missing kind was `b`; 61d0090 closed it
  seq:4s   STANDS REDUCED  the table landed; 6 of 13 kinds left, and the title is wrong
  seq:3s   REFINES walk/7  one graphic seen from three angles; walk/7 is the build
  seq:1s-f SUPERSEDED      by walk/16, which is later and wider
  seq:1s-a STANDS          the only open API gap here; no walk task covers it
  seq:1s-b STANDS          mockup session
  seq:1s-c STANDS          mockup session; a defect no gate can ever report
  seq:1s-d STANDS          contradiction with walk/26 SETTLED -- see below
  seq:1s-e STANDS          owner ruling; the fixture hides it, a real session shows it
  seq:10s  STANDS          mockup session; nine facts the engine knows and cannot say

THE ONE CONTRADICTION FOUND, and it was a real one: seq:1s-d says the carried item block IS BUILT; plan:walk seq:26 says preview does not draw it or its four disclosures; and KNOWN_GAPS lists `div.carrieditem.small` as missing, contradicting seq:1s-d s own closing sentence. Settled by reading the code, which is the top of the precedence order: `preview.js` · `ctx.t('index.carriedFetch')` · ~1486 builds all five things, each guarded on `IndexSummary.carried`, and `read-model.ts` · `IndexSummary.carried` · ~342 resolves that only on a `session-start` event with a root. Both tasks were right about different things. NOT A CODE GAP -- which is the second time in three days that a screen looked unbuilt because the fixture gave it nothing to draw, after decay s heatstrip.

AND ONE COUNT CORRECTED: the "one mockup session" was reported to the owner as SIX items. It is TWELVE. seq:1s-b, seq:1s-c and seq:10s were sitting in plan:screens as ordinary open work and cannot be done by anyone but him either.
