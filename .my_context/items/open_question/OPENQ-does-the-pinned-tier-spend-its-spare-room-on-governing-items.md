---
id: OPENQ-does-the-pinned-tier-spend-its-spare-room-on-governing-items
type: open_question
title: does the pinned tier spend its spare room on governing items, at the price of forty-nine fixtures
status: active
severity: soft
always: false
summary: Using leftover room for items that would otherwise arrive as titles is built and measured, and costs a large rewrite of existing tests.
summary_of: 1c6a1d2bafd50f48
scope:
  - src/core/select.ts
  - test/core/**
tags:
  - v2
  - budget
  - injection
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 7eb811a1a989b4d4
---

# does the pinned tier spend its spare room on governing items, at the price of forty-nine fixtures

Built, measured and DELIBERATELY NOT COMMITTED on 2026-09-07. The change is saved as a patch
rather than landed, because it is a ruling rather than a fix and it arrived overnight while two
other lanes were live.

WHAT IT DOES. The pinned tier offers fitToBudget two bands: the always candidates first, then the
governing items that are not always. Six functional lines in src/core/select.ts. On this corpus
pinned admits 50 instead of 37 - 30,000 of 30,000 - and governingSpill.titled falls from 79 to 66.

THE PRICE, and it is why this is a question: 49 tests across 14 files go red. NONE is a logic
failure. Every one is a fixture written when a non-always governing item could never reach a
full-text tier at session start, so they assert an absence that is no longer true. I confirmed 27
of them myself in two suites before reverting.

AND ONE OF THEM CANNOT BE CLOSED IN A TEST AT ALL. test/docs/injection.test.ts holds the
SessionStart example block in README.md against what the product actually injects, so the README
has to be rewritten for the suite to go green. That is D28 territory and it is held behind D12 and
D27.

THE PREMISE OF THE ORIGINAL ITEM WAS WRONG, MEASURED. budget/16 says the tier held "about 7,400 of
16,000 estimated tokens" - half empty. It does not reconcile: 35 always items at 7,400 is 211
tokens each, while 37 cost 22,582 today, and select.ts’s own comment from that day says the
workspace was set to 22,000. At its own budget the tier was 580 tokens OVER, not 8,600 under. So
the spare capacity the ruling asks to be spent DID NOT EXIST when the ruling was given - the raise
to 30,000 on 2026-09-06 created it, and this change spends it.

A NARROWER FORM EXISTS AND THE OWNER SHOULD SEE IT: gate the spare band on there being at least
one always candidate. A workspace that pins nothing then keeps exactly today’s behaviour, the
fixture damage falls from 49 to 23, and the result on THIS corpus is identical - 13 admitted,
titled 79 to 66. The lane implemented it, measured it, and reverted it rather than narrowing a
ruling to quiet tests, which is the right instinct and leaves the choice here.

THE CONSEQUENCE THE OWNER SHOULD WEIGH, beyond the tests: the rendered session-start block grows
from 28,504 to 35,501 estimated tokens, +24.5%. That is real against the handover threshold - a
window that starts fuller reaches 85% sooner.

AND ONE THING THAT NEEDS ITS OWN DECISION IF THIS LANDS. A spare-band delivery is recorded as
tier: pinned and is then indistinguishable in the log from a real pin. Every historical
tier: pinned row meant "a pin". A distinct tier name needs no type change - InjectedRef.tier is a
string, which is how carried was added - but it must be admitted to LEDGER_TIERS in audit.ts and
TIERS in seen-file.ts, and those are closed sets whose widening is a recorded decision. Getting it
wrong means an item re-offered on every tool call, or lost after a compaction.

THE PATCH is in the session scratchpad as budget-16-spare-band.patch, 441 lines, and the tree was
restored: the two suites I checked are back to 44 of 44.
