---
id: TASK-the-citation-form-has-no-answer-for-html-and-six-source
type: task
title: the citation form has no answer for .html, and six source citations are stale
status: active
severity: soft
always: false
summary: References into the design file are not checked at all, and six references into code are known broken; fix them and turn the check on.
summary_of: 71a4a4f055521a19
scope: []
tags:
  - "plan:rulings"
  - "seq:47"
  - "state:todo"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 8002d0e0474f467e
plan: rulings
seq: "47"
state: todo
---

# the citation form has no answer for .html, and six source citations are stale

Two findings from plan:rulings seq:44, filed rather than fixed because both touch files that were owned by other agents at the time.

ONE - `.html` CITATIONS ARE NOT CITATIONS. The gate now walks source, and measured that adding `html` to the scanned extensions is doc-neutral and would check six more citations, dropping faults from 3 to 1. It was NOT done: the citation form is specified in `docs/superpowers/specs/2026-08-18-v2-decisions.md` section 2, and widening which files may be cited changes the FORM, which is a documents decision rather than a script one. The affected citations all point into `docs/design/web-ui-mockup.html` - the design of record, and the single most-cited artefact in the project.

TWO - SIX SOURCE CITATIONS ARE BROKEN and are reported but not gated. The gate ships report-only for source with a `--strict-source` flag that gates them; the flip is one expression. This task is the repair that earns the flip: fix the six, then make `--strict-source` the default and delete the flag.

NOT CAUGHT BY EITHER, written down so it is not rediscovered: `e2e/` is not walked; only `.ts` files are scanned as CITERS, so citations in `app.js` and the string tables stay ungated; an unbackticked file name is invisible and raises no fault; and a fragment with UNESCAPED backticks reads truncated and can silently pass.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and part ONE is a DOCUMENTS DECISION that has been waiting for somebody to notice it is the same question as the others. The citation form is specified in docs/superpowers/specs/2026-08-18-v2-decisions.md section 2, and widening which files may be cited changes the FORM. The affected citations all point into docs/design/web-ui-mockup.html -- THE DESIGN OF RECORD, AND THE SINGLE MOST-CITED ARTEFACT IN THE PROJECT, which is exactly why it should be checkable. Part TWO is a repair that earns a flip: fix the six broken source citations, make --strict-source the default, delete the flag.

IT IS ONE OF SIX TASKS ABOUT ONE GATE, and they have never been read together: plan:rulings seq:33c (thirty bare citations inside fenced code blocks, nearly all stale), seq:33d (two plan sentences), seq:38 (a plan that changes a command breaks the citations in its own survey table), seq:47 (no answer for .html, and six stale source citations), seq:48 (verify:citations does not scan either README), and plan:walk seq:30 (it does not scan the corpus either -- 104 of 109 plan pointers were wrong, corrected 2026-08-25). SIX OPEN TASKS, ONE GATE, THREE KNOWN BLIND SPOTS. That is a scope problem rather than three bugs: settle what the gate scans BY RULE -- every checked text file in the repository, exclusions named and justified -- instead of adding one directory at a time. DISPATCH THE SIX AS ONE PIECE OF WORK.

--- STILL OPEN 2026-08-31. MEASURED AND RECOMMENDED, NOT DECIDED. ---

THIS TASK IS NOT DONE AND MUST NOT BE CLOSED ON WHAT FOLLOWS. Part ONE is a documents decision, exactly as the verdict above says, and nothing below has been taken by anybody who can take it. What is recorded here is a measurement and a recommendation, so that whoever takes the decision does not have to re-measure.

WHAT MOVED WITHOUT THE DECISION BEING TAKEN, which is the thing to know first. On 2026-08-29 `.html` and `.css` were added to CITED_EXT in scripts/verify-citations.ts as part of widening the walk to src/ui/public/** and e2e/ -- not to settle the form, but because CITATION and CITED_FILE_AT_END disagreed about them and 45 citations were being read as NOTHING: never counted, never resolved, never reported. So the extension is admitted at the SCRIPT level today while the FORM question is still untaken, and that gap is what this entry closes only on the measurement side.

RE-COUNTED AT THE MOMENT OF ACTING. "Six" no longer denotes six of anything, under either reading:
  Part ONE's six (citations the .html gap hid) is TWENTY-NINE today. All 29 point into docs/design/web-ui-mockup.html. They are read; 2 are broken.
  Part TWO's six (broken source citations) is TWENTY today, reported and still ungated.

THE TWO BROKEN MOCKUP CITATIONS, and they are the evidence:
  1. In `e2e/chip-hue-authority.spec.ts`, anchored on a SENTENCE from an HTML comment ("an unmeasured fact is not a warning and may not borrow --warn's voice"). The comment was rewritten under plan:repaint seq:3e on 2026-08-31 and the sentence is gone; the design decision it described did not change. (That file is owned by another lane, which has since removed the citation entirely rather than repoint it, on the stated ground that seq:47 is open. That handling is correct while this is open.)
  2. In `src/ui/public/lib/viewmodel.js`, in `fieldView`'s docblock, anchored on a RUN OF MARKUP spanning sibling elements: a `<td class="m">` holding a `<del>advisory</del><ins>hard</ins>` pair. The mockup's table was re-exampled from advisory/hard to tags/pii; the claim the citation supports (word-level ins/del inside one cell) is still true and still in the file. That file is owned by another lane and was NOT edited. If the decision below is taken, the durable anchor is `data-t="work.diffn"` at ~2459, which is the paragraph stating that design.
  Both broke without one design decision having changed. Neither is drift of the kind this form exists to surface.

RECOMMENDED, FOR THE DECISION TO ACCEPT OR REFUSE: that a fragment in an .html file be a DECLARATION rather than a rendering --
  a `data-*` key (`data-t="work.diffn"`, `data-p="capture"`, `data-g`), or
  a CSS selector with its rule body (`.chip.index{color:var(--dim);...}`), or
  a structural element's opening tag (`<section data-p="capture" hidden>`)
and never visible copy, never prose inside an HTML or CSS comment, never a run of markup crossing sibling tags.
The argument: strings-parity and styles-parity already hold the first two shapes byte-identical between the mockup and the app, so a citation of that shape breaks when a design decision changes and at no other time. And the corpus's own advice for .ts -- anchor on a key or an identifier, never on user-facing copy -- is the same rule, which this file needs MORE than src/ does because its copy is translated and repainted.

AND THE STATUS CHANGE THE DECISION SHOULD WEIGH, which post-dates this task: DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap (2026-08-26) retired the app-to-mockup direction. The mockup is HISTORY and a gap list rather than a specification the app must equal. So one available answer -- possibly the right one -- is that a citation into it is a quotation of the past and takes a `historical-citation` marker, which the gate already honours and prints HIST for on every run, rather than a pointer to be re-anchored at all.

The same text is recorded beside CITED_EXT in scripts/verify-citations.ts, marked there as not in force.

NOTHING WAS CHANGED IN ANOTHER LANE'S FILES FOR THIS. Part TWO's flip is not earned: 20 source citations are still broken and --strict-source stays a flag.
