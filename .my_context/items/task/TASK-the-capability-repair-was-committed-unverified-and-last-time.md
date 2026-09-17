---
id: TASK-the-capability-repair-was-committed-unverified-and-last-time
type: task
title: the capability repair was committed unverified, and last time that produced twenty-one more
status: active
severity: soft
always: false
summary: Re-verify the eleven repaired capability chapters whole — parse every diagram for real, check directions rather than values, and settle whether the ch.7 fence now parses.
summary_of: ef851fb5ba2e73c3
scope:
  - docs/capabilities/**
  - reports/**
tags:
  - v2
  - docs
  - "plan:rulings"
  - "seq:105"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: 3dbbc963d695fe99
plan: rulings
seq: "105"
state: todo
priority: "1"
---

# the capability repair was committed unverified, and last time that produced twenty-one more

COMMIT `471b13b3` REPAIRED ELEVEN CAPABILITY CHAPTERS AGAINST A VERIFIER’S LIST OF 28 FALSE DIAGRAM
CLAIMS, AND ITS OWN MESSAGE SAYS THE REPAIR IS NOT VERIFIED. This item is that verification. The
owner approved the sequence on 2026-09-17: repair `docs/system/`, re-verify capabilities, then
Hebrew.

── WHY THIS IS NOT A FORMALITY, AND THE EVIDENCE IS THIS PROJECT’S OWN ────

THE LAST TIME THIS REPOSITORY REPAIRED EXACTLY WHAT A VERIFIER HANDED IT, THE REPAIR WAS CLEAN AND
THE NEXT PASS FOUND TWENTY-ONE MORE. The commit that recorded it says why in its own title: *"the 38
are genuinely repaired, and fixing exactly what a verifier hands you is what produced the next 21"*.

The mechanism has a name here — **a verified claim makes its neighbours look verified**. A list of
28 line numbers gets 28 lines fixed; the sentence that INTERPRETS a corrected number, the paragraph
that reasons from it, and the summary three chapters away that repeats it are all untouched and now
read as checked. SO DO NOT VERIFY THE 28 REPAIRS. VERIFY THE CHAPTERS.

── THE METHOD THAT WORKED, USE IT ────────────────────────────

The `docs/system/` verification on 2026-09-17 is the template and its report is
`reports/2026-09-17-system-docs-verified.md`. Two things it did that earlier passes did not:

  1. **IT PARSED THE DIAGRAMS FOR REAL.** Extracted every fence with the product’s own
     `mermaidBlocks` (`src/ui/public/lib/markdown.js:509`) and parsed each in REAL Mermaid 11.17.2
     under headless Chromium, the way `gen-diagrams.ts` must. Do the same here.
  2. **IT CHECKED DIRECTIONS, NOT ONLY VALUES.** All four of its worst findings were RELATIONSHIPS
     READ BACKWARDS — a false edge direction, an "avoids" the code calls "sets", an "every" that is
     an "any". A line citation cannot catch those and every pass before it was shaped around line
     citations. **For every arrow and every causal sentence, check the DIRECTION against the code.**

── THE ONE CLAIM TO SETTLE FIRST ───────────────────────────

`docs/capabilities/07-restore-and-handover.md:78` SHIPPED AS A MERMAID ERROR BOX for as long as it
existed, because it carried `&lt;key&gt;` whose `&` breaks mermaid’s lexer. The repair changed it to
`--approve <key>`. THE ENTITY IS GONE — that much is verified by grep. **NOBODY HAS PARSED THE
REPAIRED FENCE.** A bare `<key>` inside a sequence-diagram message is not obviously safe either.
Parse it first and report that single result before anything else, because it is the one defect we
know reached a reader.

AND THE ROOT CAUSE IS STILL OPEN: that fence could ship broken because `DIAGRAM_SOURCES` lists ONLY
the two READMEs, so nothing under `docs/` is generated, committed or gated. **RECOMMEND, DO NOT
IMPLEMENT.** Say what it would cost to bring `docs/capabilities/**` and `docs/system/**` under the
generator, and what breaks if they are. The owner decides.

── WHAT ELSE TO SWEEP WHILE YOU ARE IN THERE ────────────────────

  — **PASTED "REAL OUTPUT" BLOCKS.** In `docs/system/`, FIVE OF SIX were silently abridged — one
    dropped the five-line disclosure the same chapter quoted in its own §1; another welded two
    non-adjacent lines and retyped exact integers as approximations. The sixth marked its cuts and
    reproduced verbatim: that is the shape all of them must have. Check every pasted block in
    `docs/capabilities/` the same way — RUN THE COMMAND, diff the whole output.
  — **EVERY CITED ITEM ID, AGAINST `.my_context/items/`.** `docs/system/06` cited
    `INV-a-validator-that-gates-writes-must-be-a-complete-precondition-for-the-write`; the real id
    is `INV-a-validator-that-gates-writes-must-be-a-complete`. An invented suffix in a project whose
    law is `RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number` is not untidy, it is
    uncitable.
  — **VOLATILE FIGURES WITH NO DATE.** A count is a DATE, not a fact. Any figure that moves — corpus
    totals, record counts, file counts, byte sizes — must carry when it was taken or be removed. **A
    distillate freezes counts that keep moving** is the most expensive lesson of this campaign.
  — **CONTRAST RATIOS AND HEX VALUES.** `docs/system/03` paired the SHIPPED hexes with the RETIRED
    colours’ ratios — four rows, one error, invisible to anyone checking the hexes alone. If
    capabilities carries any palette table, recompute every ratio rather than reading it.

── HOW TO REPORT ──────────────────────────────────────

`reports/2026-09-17-capabilities-verified-after-repair.md`. One row per false claim with the TRUE
value and how you established it. State the number of claims CHECKED, not only the number found
false — a denominator is what makes the numerator mean anything, and
`nothing-to-do-and-could-not-look-are-different-answers`: say plainly which chapters you swept, which
you did not, and anything you could not establish either way.

**SAY WHETHER THE 28 ARE ACTUALLY FIXED, INCLUDING ANY THAT WERE "FIXED" INTO A NEW WRONG VALUE.**
That is a distinct outcome from both "repaired" and "still wrong" and it needs its own name in the
table.

── CONSTRAINTS ────────────────────────────────────────

  — **READ-ONLY. CHANGE NO DOCUMENT.** You are the verifier; repair is a separate item. The one
    exception is your own report.
  — **RUN NO GIT COMMAND THAT CHANGES REPOSITORY STATE.**
  — **ANOTHER LANE IS DRIVING PLAYWRIGHT RIGHT NOW.** Keep Chromium to the one short parse run you
    need; do not start a browser suite. Three parallel browser lanes once held 13.8 GB on this
    machine and the owner noticed.
  — **THE SERVER ON 58888 IS THE OWNER’S.** Do not kill, restart or rebind it.
