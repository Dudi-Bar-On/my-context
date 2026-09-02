---
id: NOTE-a-session-with-ledger-history-and-no-seen-file-is-a-real
type: note
title: a session with ledger history and no seen file is a real product state, and Injected now's two endpoints answer three different questions
status: active
severity: soft
always: false
summary: Two counts that look like they ought to agree are answering different questions, and a session that keeps its history but loses its delivery record is normal.
summary_of: 7415cb7771f3f42d
scope: []
tags:
  - v2
  - ui
  - api
  - fixture
  - "screen:injected"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: 50eff83fa1c57245
---

# a session with ledger history and no seen file is a real product state, and Injected now's two endpoints answer three different questions

MEASURED 2026-08-29 against the live corpus (680 items, 19 ledger sessions) and .demo-corpus, for plan:walk seq:35. Pinned by test/ui/injected-endpoints.test.ts and e2e/injected-empty.spec.ts. CONFIRMED: /api/sessions itemCount and /api/session/:s/injected lines are not in competition. itemCount is COUNT(DISTINCT item_id) over the LEDGER; lines is every line of the per-session SEEN FILE. Three axes, neither endpoint wrong on any. UNIT, items against deliveries: rep-check reads 10 against 48 lines over 10 distinct ids. VOCABULARY: SeenTier is LedgerTier plus continuity, so a carried reference is a line the ledger has no tier to hold, and every healthy .demo-corpus session reads 4 against 6 for that alone. STORE: a destroyed window keeps its ledger rows and loses its seen file. WRONG, AND PREVIOUSLY WRITTEN DOWN AS SETTLED: scripts/demo-corpus.ts justified keeping every seen file with the claim that a session with audit history and no seen file is a shape the product never produces. Seven of nineteen live sessions are in that shape, error null throughout, and the product makes it on purpose - /clear fires SessionEnd, session-end.ts calls clearWindowState then clearSeen, and the ledger is deliberately untouched because the injection happened.
