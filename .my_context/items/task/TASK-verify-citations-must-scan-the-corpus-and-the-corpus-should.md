---
id: TASK-verify-citations-must-scan-the-corpus-and-the-corpus-should
type: task
title: "verify:citations must scan the corpus, and the corpus should cite by anchor not by line"
status: active
severity: soft
always: false
summary: The citation checker now reads the corpus on every run and reports what it finds there, and the pointers that could be given a stable anchor have been.
summary_of: 8c7736915008763e
summary_was:
  - 2026-09-11 References in the knowledge base point at a place that keeps its name, rather than a line number that moves.
  - 2026-09-07 The reference checker has three known blind spots; settle by rule what it covers, and stop pointing at line numbers that rot.
acknowledged:
  - body_disagrees_with_meta@92681859fd245dd8
scope: []
tags:
  - v2
  - process
  - reconciliation
  - citations
  - "plan:walk"
  - "seq:30"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: e3287ede2d2024b5
plan: walk
seq: "30"
state: done
priority: "1"
source: "plan:walk seq:23, the reconciliation"
---

# verify:citations must scan the corpus, and the corpus should cite by anchor not by line

THE DURABLE FIX for the 104 broken plan pointers corrected on 2026-08-25. Correcting them was necessary and is not the answer: line numbers rot on the next plan edit, and these rotted without anybody doing anything wrong.

TWO PARTS, and the first is worth more than the second.

ONE. `verify:citations` MUST SCAN `.my_context/items/`. The gate exists, it is one of the seven, it already knows this failure mode -- its docblock records 186 file:line citations drifting -- and it has now been found blind to a THIRD location. `plan:rulings seq:48` found it blind to both READMEs (six false claims). This found it blind to the corpus (104 broken pointers). A gate with three known blind spots has a scope problem, not three bugs: settle what it scans BY RULE -- every checked text file in the repository, with exclusions named and justified -- rather than by adding one directory at a time.

THE CORPUS CITATION FORM IS NOT THE GATE S CURRENT FORM. The gate checks `path` + backtick fragment. The corpus writes `path#task-N at line L`. Either teach the gate that form or normalise the corpus to the gate s -- and normalising is better, because one form in one checker is the whole point.

TWO. DECIDE WHETHER THE LINE NUMBER SHOULD BE THERE AT ALL. `verify-citations` states the principle in its own words: THE FRAGMENT IS THE IDENTITY; THE LINE IS A CONVENIENCE. A convenience that was wrong 95% of the time is a trap, because a plausible wrong number sends a reader somewhere real. The `#task-N` anchor resolved 104 times out of 104 -- it is strictly better. Options: drop the line and keep the anchor; keep both and let the gate repair the line mechanically, which it can, since the anchor resolves; or keep both and let the gate merely FAIL. Recommend the second -- a self-repairing citation is the only version that survives a 6,800-line plan being edited.

THE MEASUREMENT SCRIPT IS TRIVIAL and is the acceptance test: for each item saying "this item tracks state only", read its cited plan, find `^##+ Task N`, compare to the cited line. It found 104 in under a second.

AND IT OVERLAPS FOUR OPEN TASKS IN plan:rulings -- `33c` (about thirty bare citations inside fenced code blocks, nearly all stale), `38` (a plan that changes a command breaks the citations in its own survey table), `47` (the citation form has no answer for .html, and six source citations are stale) and `48`. FIVE OPEN TASKS ABOUT ONE GATE. They should be read as one piece of work, not five.

**MEASURED 2026-08-28 — the gate cannot see two whole surfaces**

`verify:citations`'s `SOURCE_ROOTS` are `src`, `test` and `scripts`, and it accepts `.ts` only. So **`src/ui/public/**/*.js` and `e2e/*.spec.ts` are entirely unscanned.** That is the browser modules — every screen, `app.js`, `live-invalidation.js` — and the whole browser suite.

Found by `plan:live seq:7`, whose two edited files were both invisible to the gate; it resolved its citations by hand instead. The irony is worth recording: `live-invalidation.js` exists because a hand-kept list drifts, and its own citations are held to no gate.

Whatever this task settles about scanning the corpus should settle this too, or say why not — a citation gate whose blind spot includes every file a UI change touches is a gate that passes most confidently where it checks least.

RE-CUT 2026-09-07 by owner ruling (plan:walk seq:140, option A). What follows narrows this
item; everything above it is the record of why.

HALF CLOSED — the gate half, against the standard and the rule that now cover it.

SURVIVES: the corpus residue - normalise the 31 pointers that still cite by line, and stop the writer
emitting file:line in the first place.

AND IT HAS A NEW ALLY FILED THE SAME DAY:
RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number, taken after two citations in
src/doctor/checks.ts were found pointing at lines that had held something else for days. The handover
is PREPENDED to, so every line number into it rots on the next write. This item is the cleanup that
rule implies.
WORDING CORRECTED 2026-09-08. This body opened a line with a verdict word - CLOSED, BLOCKED - to
mean that ONE HALF of the item was settled, on an item that remains open. `body_disagrees_with_meta`
read it as the item’s own verdict and was right to: a reader skimming sees the word before the
qualifier. The half is still settled; only the wording moved.

WHAT LANDED 2026-09-11, and what is left.

THE WALK IS NO LONGER A FLAG. It shipped that morning behind --corpus, off by default, because a
lane does not reopen an owner ruling by shipping code. The number went in front of him the same
day and he ruled the walk ON for every run, REPORTED and NOT GATED, on the reasoning that the only
way those 57 broken corpus citations ever reached 57 is that nobody could see them. --no-corpus is
the way back out for a caller who wants only the gated set. The exit code did not move: it is the
documentation failures and nothing else, and citations-in-corpus.test.ts pins that in a probe that
breaks BOTH trees at once.

THE RESIDUE, MEASURED AND THEN WORKED. 12 bare pointers stood in 8 items, beside 16 excused as
quotations in 3 items and 6 naming files this repository does not have. Of the 12:

- SIX became anchors and every one resolves exactly, against e2e/conversations.spec.ts,
  src/core/needs.ts, docs/design/web-ui-mockup.html, src/ui/public/strings/en.js,
  src/ui/public/strings/he.js and src/doctor/checks.ts. The two string tables are anchored on the
  KEY and not on the copy, which is what lets them survive the correction this item asks for.
- FOUR were never addresses. They are this corpus quoting the rotted pointers it filed AGAINST —
  the rule’s own evidence, and two 2026-09-08 re-anchoring notes recording what they replaced. An
  anchor there contradicts the sentence, so the line number stopped being SPELLED as an address
  and is described in prose instead. The record is word for word what it was.
- TWO ARE LEFT BARE ON PURPOSE, and are the only residue. One names docs/TUTORIAL-ADVANCED.md at
  line 216, in a document since rewritten end to end that carries no reference capture at all now;
  the other names src/ui/read-model.ts at 3054-3057, which held a usage expression on the day it
  was written and holds nothing like the quoted sentence today. Deriving a fragment from what
  stands there now is the trap this item named in its own words. They stay COUNTABLE under
  citation_form rather than reworded into an unchecked assertion, which is the same argument the
  walk was turned on for.

ONE FAULT REPAIRED IN PASSING: the 2026-09-08 re-anchor in
TASK-a-pruned-session-is-a-row-that-says-so-not-a-row-that wrapped its citation across two lines,
so the gate read it as UNREAD rather than as a citation, and its hint named a line 2,600 short of
the call. It is one line now and it resolves.

THE WRITER HALF WAS ALREADY IN FORCE, and the search says so rather than assuming it. Nothing in
this product writes a bare line pointer into an item body: provenance is captured as a SECTION
ANCHOR (`src/ingest/apply.ts` · `sourceAnchor: anchor,` · ~274), and the only emitter of that
shape in the tree is renderCitation
(`src/core/retrieval/result.ts` · `function renderCitation(citation: Citation): string {` · ~137),
a parsed bracket form for retrieval results under a gitignored directory that neither gate reads,
and whose own validateResult already refuses a line citation into reports/. The writer this item
means is the agent and the owner, and what changes them shipped before this lane:
STD-a-citation-names-a-file-a-verbatim-fragment-and-an-optional is always:true with an empty
scope, so it is delivered every session, and checkCitationForm counts what gets written anyway.

CLOSED 2026-09-11 BY OWNER RULING, with the two pointers that cannot be anchored moved out to
`plan:walk seq:142` rather than held here. His words when shown three ways to finish it: close
this and file those two separately.

WHAT THIS ITEM ASKED AND WHAT IT GOT. Both halves are answered. The checker walks
`.my_context/items/` ON EVERY RUN, reported and never gated, with `--no-corpus` as the
off-switch — shaped as a subtraction so the default is the full walk. And the corpus cites by
ANCHOR: bare pointers went 12 → 2, and doctor’s `citation_form` went 8 findings → 2.

THE NUMBER THAT JUSTIFIED TURNING THE WALK ON. The script had refused the corpus on 2026-08-29
with a measurement — 658 item files, ONE citation in the checked form. Re-measured 2026-09-11
over 1,093 items: 223 citations, of which 57 BROKEN and checked by nobody. One became 223 in a
fortnight because the corpus did what this item asked and normalised toward the form.
NORMALISING A TREE INTO A GATE’S FORM WITHOUT THE GATE DOES NOT END THE SILENCE, IT RE-DRESSES
IT. The repository’s real broken count was never 47; it was 104.

THE EXIT CODE STILL MEANS THE DOCUMENTATION FAILURES AND NOTHING ELSE, proved four ways, each
red at its own line. The 57 are untouched — repairing them is a separate, later act.

AND WHY FIVE LANES REPORTED FIVE DIFFERENT NUMBERS, which is worth keeping: ONE RUN PRINTS SIX
FAILURE COUNTS AND ONLY ONE SETS THE EXIT CODE. 14 documentation (the gate), 33 source, 47 total
broken lines, 19 faults, 52 combined, 2 under `e2e/`. Every figure the lanes quoted was a field
of the same output. Nobody was wrong.

FOUR OF THE TWELVE POINTERS WERE NEVER ADDRESSES. They are this corpus QUOTING THE ROTTED
POINTERS IT FILED AGAINST — the pinned rule’s own evidence, and two re-anchoring notes recording
what they replaced. An anchor there contradicts the sentence, whose whole claim is that these
WERE line numbers. They describe the refused form now instead of spelling it.

THE WRITER HALF WAS ALREADY IN FORCE, searched rather than assumed: nothing in the product writes
a bare line pointer into an item body — provenance is captured as a section anchor.
