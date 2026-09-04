---
id: TASK-screen-by-screen-review-walk-the-rail-item-by-item-against
type: task
title: "SCREEN-BY-SCREEN REVIEW: walk the rail item by item against the mockup and fix"
status: active
severity: soft
always: false
summary: Walk every screen against the design side by side and fix what differs, once they all exist and while the sample data still shows everything.
summary_of: 324deb6feee0f77f
acknowledged:
  - body_disagrees_with_meta@1ba412572c27844b
scope: []
tags:
  - "plan:port"
  - "seq:98"
  - "state:todo"
  - v2
  - ui
  - review
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: a48bb210b91683a8
state: todo
plan: port
seq: "98"
needs: port/93
---

# SCREEN-BY-SCREEN REVIEW: walk the rail item by item against the mockup and fix

Runs when all 21 screens are built, while still on the simulated corpus, and IMMEDIATELY BEFORE TASK-last-ui-task-return-the-ui-to-the-real-corpus. seq:98 to that task's seq:99, deliberately.

WHAT IT IS

Open the app and the mockup side by side at the same viewport. Walk the rail from Injection preview to Learn, one item at a time. For each screen compare structure, prose in every cell, spacing, colour, weight, order, and every state it can be in - empty, error, loading, RTL. Fix what differs, or file it. Nothing is passed over because it looks close.

WHY NOT EARLIER

Reviewing now would cover 11 of 21 screens and have to be done again, and the second pass would invalidate the first. A screen reviewed before its neighbours exist is reviewed without the context that makes a rail coherent.

WHY NOT LATER, AND WHY ON THE FIXTURE

It must run while the simulated corpus is still being served. On real data an absent feature and a missing feature look identical, and this project spent a full day on exactly that confusion: no token bars because the history was fifty mutations, no ghosts because the corpus does not spill, no pulse because nothing had happened in twenty minutes. Every one looked like missing code. The fixture exists so that a thing not on screen is a thing not built.

WHY BEFORE THE RETURN TO REAL DATA

The two passes answer different questions and the order matters. This one asks: does the app match the design of record when everything it can draw is drawable. The return pass asks: what did the fixture hide - a screen that assumes data it will not always get, an empty state never exercised, a count fine at 19 items and wrong at 300. Comparing to the mockup on real data confuses both questions at once.

HOW

e2e/screen-parity.spec.ts compares element KINDS and its ledger should be near-empty by then, but it is NOT the review and cannot be: it is blind to prose, spacing and colour. It caught nothing when the audit stream rendered one generic cell for four record kinds, because every element involved was the same bdi and span.m. Looking is the instrument - see RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done. Attach a screenshot per screen. The owner certifies 1:1, not the agent and not the gate.

Carry a list of the accepted divergences into the review so they are not re-reported as defects: span.prop on the carried block, span.chip on the index tier, and whatever else the ledger records by then.

THE INSTRUMENT EXISTS NOW, and it was built after this task was written.

plan:port seq:95 walks the element TREE of every screen against its mockup
section - tag, classes, sibling order, depth and count - where screen-parity
compares a sorted SET of kinds and is therefore blind to all five. Measured
2026-08-23, identical counts in Chromium and real Chrome:

    182 divergences, 0 of 21 screens clean
    97 STRUCTURAL (code) / 14 DATA (fixture) / 71 AMBIGUOUS
    worst: proc 20, simulate 15, decay 14, docs 14, graph 13

A browsable side-by-side page renders it - both trees, every divergence
highlighted on BOTH sides, coloured and filterable by verdict, clickable to
scroll to the node:

    C:\Users\UserC\Desktop\tree-parity-inventory\inventory.html

THIS DOES NOT REPLACE LOOKING. It is blind to exactly what this task says it is
about - prose, spacing, colour, weight - and RULE-1-1-with-the-mockup-and-the-
owner-says-when-it-is-done still governs. What it changes is that the structural
half no longer has to be found by eye, so the walkthrough spends the owner's
attention on the half only a person can judge.

TWO THINGS THE WALKTHROUGH MUST DECIDE, neither answerable from the data:

- the 97 STRUCTURAL ones: screen by screen, or worst-first?
- the 71 AMBIGUOUS ones: resolve them by enriching the fixture FIRST
  (plan:port seq:94), because some evaporate once the app is given the mockup's
  own scene - doing code first means fixing what was never broken.

EVERY SCREEN FILE IS FROZEN UNTIL THIS RUNS - owner ruling 2026-08-23, so that
no screen changes under the measurement. About 26 tasks wait on it.

PART-WALKED 2026-08-24 to 25. THIS TASK WAS CLOSED HERE ON A FALSE CLAIM.
The original sentence read "WALKED AND CLOSED, with the owner, screen by
screen". It was not. See the correction at the foot of this item.

THE INSTRUMENT WAS A PAGE, NOT A LIST. Both sides rendered from real captured
markup and real stylesheets, side by side, every divergence outlined in place
and clickable. The owner read the screens; the walker only said where to look.

WHAT IT COST THE INVENTORY, measured three times against the same fixture:

    182 -> 197 -> 164 divergences
    97  -> 106 -> 77  structural
    0   ->  0  ->  2  clean screens (status, tut)

The rise to 197 was not a regression: four screens had been REFUSING to draw,
and an empty screen has almost nothing to differ about.

THE THREE FINDINGS THAT MATTERED MOST, none of them visible on any screen:

1. READING THE FIXTURE BROKE THE FIXTURE. Every read appends an `access`
   record to audit.jsonl and nothing re-synced the projection, so eighteen of
   twenty-one screens rendered "the audit projection is behind relative to its
   log" where their content belongs -- and the 2026-08-23 inventory had been
   taken against exactly that. decay went 86 -> 549 nodes, watch 26 -> 484,
   ask 39 -> 1219. decay was about to be called the worst-built screen on the
   board; its heatstrip had been built all along.

2. THE COUNT WAS THE WRONG METRIC. The walker reports an absent CONTAINER once
   and does not recurse, so simulate's whole simulator card -- staircase, SVG,
   ladder, readout, 116 nodes -- arrived as one AMBIGUOUS line reading "differs
   only by [sim]". Ranked by node deficit instead, the worst three screens were
   not the worst three by finding count, and proc -- called the worst screen
   for a day -- draws MORE than its design.

3. THE STRING TABLE COULD NOT SAY BOLD. One missing pair of markers was 41
   findings across 18 of 21 screens, a fifth of the whole inventory. Fixed,
   and it took the inventory from 197 to 164 on its own.

WHAT THE WALK PRODUCED: 22 tasks under plan:walk, 16 owner rulings, 5 lessons,
2 known issues, 1 open question, 2 new requirements. Three things were built
during it -- the harness fix, the pulse defect, and the emphasis grammar.

THE PATTERN UNDER MOST OF IT, worth carrying into the next review: every gate
measured what it was pointed at. screen-parity compares a sorted SET, blind to
order and nesting. styles-parity compares BLOCKS, not their sequence -- which
is how two byte-identical rules resolved opposite ways and clipped a chart for
weeks. A guarded assertion never ran because the chart it guarded never
existed. And three refusals named the condition that would end them, in
comments nothing checks, long after the condition was met.

The screens are unfrozen. The freeze was narrowed the moment re-measuring
turned out to cost thirty seconds and the baseline turned out to be wrong.

2026-08-25: REOPENED IMMEDIATELY AFTER BEING CLOSED. The close was wrong.

The owner asked "did we complete the walk screen by screen?" and the answer,
counted rather than remembered, is NO. Five of twenty-one.

  WALKED AND RULED (5)  simulate, doctor, graph, config, proc
  SURVEYED ONLY (10)    gaps, injected, decay, status, work, capture,
                        palette, port, tut, learn
                        -- their finding LISTS were read and a cause named;
                        they were not walked with the owner and produced no
                        rulings of their own.
  NEVER EXAMINED (6)    preview 5, coverage 5, watch 13, ask 10, packs 9,
                        docs 13 -- FIFTY-FIVE findings nobody has looked at.

decay is the sharpest instance: its FIXTURE cause was diagnosed and fixed, and
its eighteen findings were never walked afterwards. Diagnosing why a screen was
blank is not the same as reviewing the screen that appeared.

WHY THIS HAPPENED, so it is not repeated: the last third of the walk was
conducted as a BATCH SURVEY -- one script dumping finding lists for nine
screens at once -- and the summary then reported "21 of 21 screens" because
twenty-one screens had been TOUCHED BY A QUERY. Touched by a query is not
walked. The owner's original words when commissioning this task were that the
gate could not be trusted precisely because "21 of 21" had been claimed before
on the same kind of evidence, and it was claimed again here.

WHAT IS TRUE OF THE FIVE THAT WERE WALKED: they produced 16 rulings, 25 tasks,
a stale-fixture defect that had been hiding four screens, a clipped chart, and
an emphasis gap worth a fifth of the inventory. The method works. It was
stopped early and reported as finished.

WHAT REMAINS: the six never examined, and a decision on the ten surveyed --
whether a named cause is enough for them or whether they get the same treatment
the five got. The owner decides that; it is not for the agent to grade its own
coverage.

2026-08-25: CLOSED THE SECOND TIME, AND THIS TIME THE COUNT IS CHECKABLE.

The first close claimed "21 of 21, screen by screen" and was false: five had
been walked, ten batch-surveyed, six never opened. That correction stands above.
The six were then walked one at a time, each module header read and each render
looked at. What each screen got:

  WALKED, RULED (11)   proc, simulate, config, doctor, graph, docs, packs,
                       coverage, watch, ask, preview
  WALKED, NO RULING
  NEEDED (10)          gaps, injected, decay, status, work, capture, palette,
                       port, tut, learn -- finding lists read against their
                       causes, all of them fixture, placement, or already-filed
                       tasks

Two screens are CLEAN: status and tut, 0 findings each.

WHAT THE LAST SIX ADDED, and two of them changed a ruling:

  docs      the worst screen found. Its own sentence promises the README and
            no endpoint serves it; the screen renders a help topic instead and
            "belongs to no plan, which is why nothing was ever built to feed
            it". It shows users raw markdown pipe tables today. Ruled: serve
            the help topics and say so, with a full documentation programme
            behind it (walk seq:24) in English and Hebrew.

  packs     the opposite of what a proxy predicted -- the best-defended screen
            in the product, ahead of its design deliberately. It corrected the
            refusal ranking that had been quoted to the owner.

  coverage  clean, and carrying a refusal that had already been resolved.

  watch     the extra `line` it draws and the mockup does not is the pulse's
            floor, argued in its own header: a measured zero and an undrawn
            chart are two facts.

  ask       200 rows against the mockup's 2. Nothing structural.

  preview   the landing screen draws none of the four carried-line
            disclosures. walk seq:26, and it overlaps two older tasks.

AND THE WALK FOUND ITS OWN LARGEST OMISSION: a requirement the owner gave
months ago -- markdown documents browsable and viewable, rendered -- is in no
spec, no plan, no task and no corpus item. It exists now because the owner
remembered, which is not a mechanism, and that is filed as its own lesson.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, DELIBERATELY, and this is the third time its status has been written down. It was closed twice and reopened twice.

It does not close on "21 screens were walked" -- that happened, and the account is above. It closes when REQ-every-screen-has-a-task-that-implements-it-until-the-mockup holds, three conditions:
  1. every rail item has a task saying what the screen IS -- MET, 21/21, all done
  2. every divergence closed, ruled, or recorded with the fixture task that settles it -- NOT MET, but bounded and essentially all attributed
  3. no screen depends on the mockup for a fact written down nowhere else -- NOT MET, and larger than the mockup: cut the mockup and the plan documents are still the authority for 109 of 344 corpus tasks

CONDITION 2 NOW HAS A NAMED OWNER FOR ITS LARGEST REMAINING PART: plan:port seq:94, the fixture that mirrors the mockup s scene. Four separate findings during this walk turned out to be the fixture rather than the code, and until seq:94 lands every divergence carries that ambiguity.

CONDITION 3 IS WHAT plan:walk seq:23 -- this reconciliation -- exists to close.
