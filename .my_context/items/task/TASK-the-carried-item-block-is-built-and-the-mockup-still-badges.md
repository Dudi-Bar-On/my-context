---
id: TASK-the-carried-item-block-is-built-and-the-mockup-still-badges
type: task
title: the carried item block is built and the mockup still badges it PROPOSED
status: active
severity: soft
always: false
summary: A finished feature still wears a label saying it does not exist yet; either the label goes or it needs a new meaning here.
summary_of: 6fa09a879eefdc7c
scope: []
tags:
  - "plan:screens"
  - "seq:1s-d"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 3ffed495c88cadf8
plan: screens
seq: 1s-d
state: done
---

# the carried item block is built and the mockup still badges it PROPOSED

Found 2026-08-23 while building the carried block (screens plan, seq 1s). The mockup draws the carrieditem as an id, a carried chip and a span class prop reading PROPOSED. Everywhere else in the design of record that badge means a feature that is not built - three rail buttons and three whole screens' verdicts wear it - and the app computes it from whether a screen has a module, with e2e/app-layout.spec.ts asserting that the rail stops saying PROPOSED once watch exists. The block is now built. Under the 1 to 1 ruling of 2026-08-23 screens/preview.js draws the badge exactly as the mockup does, once per screen rather than once per carried id, and span.prop is out of the KNOWN_GAPS ledger because of it. But the screen is now telling a reader that a feature it is looking at does not exist. Two possible settlements and both are the owner's: delete the badge from the mockup, after which the app drops it and span.prop returns to the ledger; or rule that the badge stays and say what it means here. Not resolved in the app.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS -- the badge question is unanswered and is the owner s. But this task CONTRADICTED plan:walk seq:26, and the contradiction is now settled.

THE CONTRADICTION: this task (2026-08-23, written while building it) says the carried item block IS BUILT and that span.prop left the KNOWN_GAPS ledger because of it. plan:walk seq:26 (2026-08-25, from tree-parity) says preview does not draw the carried item block or its four disclosures. And the ledger today lists BOTH div.carrieditem.small AND span.prop as missing on preview -- which contradicts this task s closing sentence outright.

THE FACT, established by reading the code rather than either task:
  `src/ui/public/screens/preview.js` · `ctx.t('index.carriedFetch')` · ~1486 builds the carried paragraph, the .carrieditem blocks, index.carriedDropped, index.carriedDisplaced and index.carriedFetch -- ALL FOUR of the disclosures walk seq:26 lists, and the block itself.
  Every one is guarded on IndexSummary.carried being non-null, and on the dropped and displaced arrays being non-empty.
  `src/ui/read-model.ts` · `if (event === 'session-start' && root !== null) ctx.carried = resolveCarry(root, session)` · ~364 resolves it only for one event: `if (event === 'session-start' && root !== null) ctx.carried = resolveCarry(root, session)`.

SO BOTH TASKS ARE RIGHT ABOUT DIFFERENT THINGS. The block is built (this task). It does not render on the fixture (walk seq:26). It is absent because the fixture session is not a session-start with a resolved root, and a session that carried nothing correctly discloses nothing. THIS IS NOT A CODE GAP.

WHAT REMAINS HERE, unchanged and still the owner s: the mockup badges the block PROPOSED, the badge means "not built" everywhere else in the design of record, and the block is built. Delete the badge, or rule what it means here.
