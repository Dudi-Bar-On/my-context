---
id: TASK-nobody-has-checked-the-text-the-system-docs-repair-wrote-and
type: task
title: nobody has checked the text the system-docs repair wrote, and the same pass on capabilities wrote fifteen new false claims
status: active
severity: soft
always: false
summary: Verify and repair docs/system/ in one pass, checking every sentence against code as it is written, so this is the last pass on these eight chapters.
summary_of: ed4ceb54cb5f4879
scope:
  - docs/system/**
  - reports/**
tags:
  - v2
  - docs
  - "plan:rulings"
  - "seq:108"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: dcf3d3fe151afa7e
plan: rulings
seq: "108"
state: done
priority: "1"
---

# nobody has checked the text the system-docs repair wrote, and the same pass on capabilities wrote fifteen new false claims

`rulings/103` REPAIRED THE 21 FALSE CLAIMS IN `docs/system/` AND FOUND 15 MORE WHILE DOING IT
(commit `5ffc5e6a`, report `reports/2026-09-17-system-docs-repaired.md`). **NOBODY HAS CHECKED THE
TEXT THAT REPAIR WROTE.**

On the capability chapters the identical sequence was run and the answer was measured: the repair of
28 false claims **wrote 15 new ones**, every one in prose or a diagram node the repair itself added.
There is no reason to believe `docs/system/` behaved differently, and one reason to believe it did
not — it was the same kind of pass under the same pressure.

── THIS LANE IS BOTH HALVES, AND THAT IS DELIBERATE ────────────────

VERIFY, THEN REPAIR WHAT YOU FIND, IN ONE PASS. Splitting them is what created this item: a verifier
hands a repairer a list, the repairer writes unverified prose around each entry, and a third pass
finds it. **You are both, so there is no list to write prose around.**

THE DISCIPLINE THAT ENDS THE LOOP, AND IT IS THE POINT OF THIS ITEM:

  > **Before you write any sentence, read the code that sentence is about. Every sentence, including
  > one you are only rephrasing. If the true value is not knowable from the code in front of you,
  > WRITE THAT IT IS NOT KNOWABLE — do not compose something plausible.**

The owner, 2026-09-17: *"work sequentially until you close all the documentation actions... i do not
want to continue mess with this."* This pass is meant to be the last one on these eight chapters.
In your report, mark EVERY sentence you wrote as **checked against code** or **carried from a prior
report**. That distinction is as much the deliverable as the repair.

── WHAT THE LAST TWO PASSES FOUND, SO YOU KNOW WHERE TO LOOK ────────

  — **RELATIONSHIPS READ BACKWARDS ARE THE WORST CLASS AND A LINE CITATION CANNOT SEE THEM.** Five
    of `103`’s findings were directions, not values: a guard claimed to short-circuit before the
    line that actually runs first, an "avoids" the code calls "sets", an "every" that is an "any",
    a diagram edge drawn the wrong way, and — the sharpest — **an edge LABEL carrying the same
    inverted quantifier as the prose, inside the diagram a verifier had just scored clean.** For
    every arrow and every causal sentence, check the DIRECTION in the code.
  — **PASTED "REAL OUTPUT" BLOCKS.** Five of six were silently abridged before `103`; it re-captured
    them. **Re-check that the re-captures are faithful**, and that any block touched since still
    marks its cuts. On the capability side the same sweep found blocks that were DOCTORED — a boxed
    table retyped as prose, `GMT+3` stripped from seven rows — which is worse than abridging.
  — **EVERY CITED ITEM ID AGAINST `.my_context/items/`.** `103` repaired one invented suffix and
    deliberately left two visibly truncated with `…`, for a stated reason. Re-check all of them;
    `RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number` is why this matters.
  — **VOLATILE FIGURES.** A count is a DATE, not a fact. `103` deliberately LEFT `02`’s
    `conversations.js`/`styles.css` line counts at their HEAD values because a lane was rewriting
    those files. **THAT LANE HAS NOW LANDED (`ef52818f`) AND THE FILES CHANGED SUBSTANTIALLY** —
    `conversations.js`, `styles.css` and both `strings/` files. Re-measure them and date them.
  — **THE CONTRAST TABLE IN `03`.** Its four rows were repaired to 7.84 / 9.31 / 6.37 / 4.75 on
    `--panel`. The main session recomputed all four independently from `styles.css:188` and they
    match. Do not re-litigate them; DO check the prose around them still agrees, because `#ef4444`
    at 4.75 clears AA by a quarter point and the chapter now has to say so.

── ONE CLAIM THAT HAS ALREADY ROTTED TWICE ─────────────────────

`07`’s diagram claim about README. It said "byte-identical", which was true at one HEAD and false at
the next; `103` replaced it with a PROVENANCE claim, spliced programmatically rather than retyped.
README has moved again since (`f8f48dd2`, `471b13b3`, `78578cd1`). **Re-check it, and keep the claim
in the form that does not rot.**

── THE GATE THAT NOW EXISTS ─────────────────────────────

`npm run check:diagrams` parses every fence in the documents in real Mermaid 11.17.2, runs its own
RED proof first, and takes about two seconds. All 38 fences pass today. **Run it after any diagram
edit** — if you break one you will know immediately, which is new.

── CONSTRAINTS ────────────────────────────────────────

  — **WRITE ONLY INSIDE `docs/system/**` AND YOUR OWN REPORT.** Another lane is repairing
    `docs/capabilities/**`, `README.md` and `docs/README.he.md` AT THIS MOMENT. You may READ those
    freely — you will need README for `07` — but a write there collides with live work. Nine hunks
    were silently overwritten this morning exactly that way.
  — **RUN NO GIT COMMAND THAT CHANGES REPOSITORY STATE.** Leave the tree dirty; the main session
    commits.
  — **DO NOT DISPATCH SUBAGENTS.** A fork on these documents was told twice to touch nothing, rewrote
    two files anyway, and left a test red its reviewer missed by reading the diff instead of running
    the gate.
  — **THE SERVER ON 58888 IS THE OWNER’S.** Do not kill, restart or rebind it.

DELIVERABLE: the repairs, plus `reports/2026-09-17-system-docs-final.md`. State the number of claims
CHECKED, not only those found false — a denominator is what makes the numerator mean anything. Mark
each sentence checked-vs-carried. Name what you could not establish either way. If a prior report is
wrong, say so: four lanes have corrected their briefs today and all four were right.
