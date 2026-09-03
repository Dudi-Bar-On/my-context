---
id: NOTE-the-reconciliation-plan-walk-seq-23-what-it-found-and-what
type: note
title: "the reconciliation, plan:walk seq:23: what it found and what it changed"
status: active
severity: soft
always: false
summary: "\"A full review of every piece of open work: what is really finished, what was held up by something long since done, and what was filed twice.\""
summary_of: a2ae2f8edb06bdcc
summary_was:
  - "2026-09-03 A full review of every piece of open work: what is really finished, what was held up by something long since done, and what was filed twice."
acknowledged:
  - body_disagrees_with_meta@8d62e836157e016b
scope: []
tags:
  - v2
  - reconciliation
  - "plan:walk"
  - measurement
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: bbafb9f147146f26
---

# the reconciliation, plan:walk seq:23: what it found and what it changed

RUN 2026-08-25, in the order `STD-the-precedence-order-when-four-sources-of-truth-disagree` sets: the corpus and the app screens first, then the plans, then the specs, then the first v2.0 documents, with later decisions and facts overriding earlier ones.

THE COUNT. 106 open tasks across 16 plans, every one read and given ONE verdict.

    12   DONE          something closed it, and the evidence is named
     6   SUPERSEDED    a later task carries everything it had left
     3   REFINES       real content, but dispatched with its parent
    85   STANDS

Tasks 344 -> 346, done 238 -> 250, open 106 -> 96. Nothing was deleted; every superseded statement stays where it was, because it is how the next reader understands the winner.

=== THE BIGGEST FINDING: THE CORPUS COULD NOT REACH THE SPECIFICATION ===

110 task items say, in their own words, "this item tracks state only" and hand the specification to a plan document. 109 point at it BY LINE NUMBER. Resolved every one against its own `## Task N` heading:

    exact      5
    STALE    104
    unparsed   1

Drift up to `+1426` lines. A reader following the pointer lands in the middle of a different task and reads the wrong specification with no signal that anything is wrong. ALL 104 ARE CORRECTED; re-measured at 109 exact, 0 stale.

The `#task-N` anchor was intact in all 104, which is how the true lines were found and why the fix was safe. `verify:citations` exists, states the principle in its own docblock -- "the fragment is the identity; the line is a convenience" -- and does not scan `.my_context/items/`. That is its THIRD known blind spot, after both READMEs and `.html` files.

=== SEVEN STALE BLOCKERS, EACH HOLDING REAL WORK ===

Every one is a task that recorded what would unblock it, where the thing then happened and nobody came back:

  `port/94`    the fixture that mirrors the mockup s scene -- blocked on `port/95`, done. RAISED TO PRIORITY 1: it is the fix for a failure hit FOUR times in three days.
  `review/5`   the functional UX review -- blocked on `ui1 task 15`, done. THE ONLY ITEM IN THE CORPUS THAT MEASURES WHETHER A SCREEN WORKS.
  `config/2`   the config composer -- blocked on `ctx.api` having no POST. `ctx.post` is at `app.js` · `ctx.post` · ~28, exported at 947, ZERO CALLERS.
  `port/6`     the status strip s context group -- blocked on `ui3/4` and `ui3/5`, both done, and `/api/watch/context` serves the answer.
  `hooks/22`   an OWNER INSTRUCTION -- blocked until the hooks programme completes. 32 done, one README sentence outstanding.
  `ui2/5r`     blocked by the mockup freeze, which ended when the owner walked the inventory.
  `repaint/7b` blocked until repaint task 9 -- done; `status.js` · `card pane` · ~76 builds `card pane`.

=== A CLASS WORTH NAMING: THE PRODUCT STATES THINGS IT HAS NOT CHECKED ===

Three findings, three plans, all green under every gate:
  the status strip announces the status-line bridge is NOT INSTALLED without ever asking, while `/api/watch/context` serves the answer -- filed as `plan:walk seq:29`
  `ui.enabled` is accepted and strictly validated and READ BY NOTHING, verified live (`plan:rulings seq:42`)
  the Tutorials screen asserts twelve hard-coded checkmarks about content nobody checks, one of them true of NO FILE ON DISK (`plan:port seq:5d`)

=== WHAT THE FIXTURE HID, FOR THE FOURTH TIME ===

`plan:walk seq:26` filed preview s four carried-line disclosures and its carried item block as a code gap. `preview.js` · `ctx.t('index.carriedFetch')` · ~1486 BUILDS ALL FIVE, guarded on `IndexSummary.carried`, which `read-model.ts` · `IndexSummary.carried` · ~342 resolves only on a `session-start` event with a root. Not a code gap. That is the fourth time in three days -- after decay s heatstrip, watch s empty pulse, and three screens drawing nothing because the fixture held no drafts, procedures or packs. `plan:port seq:94` is the fix for the whole class.

=== WORK THAT IS ONE PIECE AND WAS FILED AS SEVERAL ===

  THE CITATION GATE   6 tasks: `rulings 33c, 33d, 38, 47, 48` + `walk/30`
  TYPED SQL           3 tasks in 3 plans, order now fixed: `rulings/46` -> `api/6` -> `ui3/15`. `rulings/46` is a BLOCKER, not a curiosity: the feature s safety argument is "reuse that guard", and a wrong guard shipped to a browser is worse than one in a terminal.
  THE STAIRCASE       `walk/7` + `ui1/17c` + `screens/3s`, dispatched beside `ui1/17b` and `screens/1s-a`
  THE BUILDER         `walk/20` is `builder/5` s mockup half
  THE CONFIG COMPOSER `walk/13` is `config/1` s mockup half
  DOCUMENTATION       `walk/24` + `port/5c` + `port/5d` + `review/6b`, sharing a source with `builder/8`
  THE BARE CHIP       `repaint/3e` holds the question, `screens/1s-c` the photographed consequence

In every case neither side named the other, and no query would have joined them.

=== THE MOCKUP SESSION IS SIXTEEN ITEMS, NOT SIX ===

Reported to the owner as six. Verified at SIXTEEN edits to `docs/design/web-ui-mockup.html`, across five plans: `walk` 3, 6, 13, 14, 16, 17, 20, 1h; `screens` 1s-b, 1s-c, 10s; `ui2` 5r, 12k; `ui3` four-watch-strings; `port/14` ruling 2; `rulings/49` work.diffn. Ten were sitting in other plans as ordinary open work and cannot be done by anyone but the owner either.

=== ONE COUNT THAT GREW ===

`categories/19` measured 13 tasks whose state TAG and state FIELD disagree, on 2026-08-23. Re-measured today: TWENTY-EIGHT of 265. Direction uniform -- all 28 are tag=done with a stale field -- so NO REPORTED COUNT WAS EVER WRONG, since every count reads the tag. But it is growing, so a closing path still moves the tag and leaves the field. Find that path before the sweep.

=== NO COARSE CONTRADICTIONS ===

The owner asked for a stable base "without many coarse contradictions" and set the bar at stopping for two sources describing different products. NONE WAS FOUND. Every conflict was fine -- a stale fact, a satisfied dependency, a premise the code had moved past -- and each is recorded above with which source won and why. The corpus and the screens won every time, which is what the precedence order predicts and is worth stating because it was not guaranteed.
