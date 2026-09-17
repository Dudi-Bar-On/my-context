---
id: TASK-the-repair-of-twenty-eight-false-claims-wrote-fifteen-new
type: task
title: the repair of twenty-eight false claims wrote fifteen new ones, and the worst has already shipped to three files
status: active
severity: soft
always: false
summary: Repair the 15 false claims the capability repair introduced, the 1 fixed into a new wrong value and the 2 untouched, plus the abridged and doctored output blocks.
summary_of: 2f6acd1cace8edb3
scope:
  - docs/capabilities/**
  - README.md
  - docs/README.he.md
  - reports/**
tags:
  - v2
  - docs
  - "plan:rulings"
  - "seq:106"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: a8c568373ff4bdf1
plan: rulings
seq: "106"
state: todo
priority: "1"
---

# the repair of twenty-eight false claims wrote fifteen new ones, and the worst has already shipped to three files

A RE-VERIFICATION OF THE ELEVEN CHAPTERS REPAIRED BY `471b13b3` RAN 574 CHECKS ON 2026-09-17. Full
report: `reports/2026-09-17-capabilities-verified-after-repair.md`. The verdict on the original 28:
**25 repaired at the cited point, 1 fixed into a NEW WRONG VALUE, 2 untouched.**

**AND THE REPAIR WROTE 15 NEW FALSE CLAIMS INTO THE TEXT IT ADDED AROUND THEM.** Every one sits in
NEW prose or a NEW diagram node. None is surviving old error.

── THE LESSON, AND IT IS BIGGER THAN THE COUNT ───────────────────

**A REPAIR PASS IS A WRITING PASS, AND WRITING INTRODUCES CLAIMS.** This project has now measured it
twice: repairing 38 produced 21 new findings; repairing 28 produced 15. The rate is not falling. The
earlier framing — *a verified claim makes its neighbours look verified* — was only half of it. The
other half is that THE FIX ITSELF IS UNVERIFIED TEXT, written by someone holding a list of what was
wrong rather than a reading of what is true.

So this item is a REPAIR, and it will need its own verification. Do not let that recurse forever —
but do not pretend this pass is self-verifying either. Say in your report which of your OWN new
sentences you checked against code and which you wrote from the verifier’s list.

── THE WORST ONE, AND IT HAS ALREADY SHIPPED TO THREE FILES ──────────

`docs/capabilities/00-index.md:32` now labels `.index.db` as read *"never by injection"*. **THAT IS
FALSE AND THE MAIN SESSION CONFIRMED IT IN THE CODE.** `src/hooks/pre-tool-use.ts` does
`store = Store.openReadOnlyChecked(ws.dbPath)` then `store.activeInjectable(…)`, and reaches
`activeInjectableFromItems(loadCorpusItems(…))` only from the `catch`. **THE DATABASE IS THE PRIMARY
JUST-IN-TIME PATH AND MARKDOWN IS THE FALLBACK** — the new label states the exact inverse.

IT IS ALSO IN `README.md:468` AND `docs/README.he.md:500`, both already committed and pushed. That
propagation is not a second mistake: the shared-source discipline worked exactly as designed and
carried a false sentence to every place that shares it. **FIX ALL THREE IN ONE CHANGE**, and
remember it is the reference’s spine — a reader who believes injection never touches the index will
misread the whole staleness story, including the known defect that a JIT injection trusts a stale
index.

── THE OTHER NAMED ONES ─────────────────────────────────

  — `03`’s `--supersedes` branch now draws *"the gate is answered — write lands"*. The code normally
    **REFUSES**. A diagram that shows a gate passing where it fails is worse than no diagram.
  — `04`’s redraw routes `machinery` into *"not indexed, at any scope"* when the source says that
    record is PRECISELY the one `'ran'` rescued.
  — `02`’s just-in-time label says *"offered later"* where `scopePolicy: 'inert'` means **NOT
    OFFERED**.
  — `07:285` — **THE DIAGRAM THE PREVIOUS VERIFIER SCORED 6 OF 6 CLEAN HAS A REVERSED EDGE.**
    `resolveHandover`/`readHandover` are in `post-compact.ts:144`; PreCompact only checks the ask
    latch. A clean score is not a guarantee, and this is the third time in two days a "verified"
    diagram carried an error on an edge rather than in a node.
  — The anchors chapter is still headed **"The three creation paths"** after Path 4 was drawn — in
    the chapter AND in the index. A heading is a claim.

── THE SWEEPS ────────────────────────────────────────

  — **10 pasted blocks silently abridged, and 5 DOCTORED** — a boxed table retyped as prose, and
    `GMT+3` stripped from seven rows. Abridging without saying so is a disclosure defect;
    RETYPING output as something it never printed is a different and worse thing. **RE-CAPTURE BY
    RUNNING THE COMMAND.** Mark every cut, in the one shape that already does it correctly.
  — **13 volatile figures wrong AND undated.** A count is a DATE, not a fact. Date it or drop it.
  — **3 uncitable item ids**, proven by running `show`.

── ONE CORRECTION TO THE RECORD, MINE ───────────────────────

`471b13b3`’s message says the broken fence *"had been drawing an error box on the page"*. **ON
GITHUB, YES. IN THIS PRODUCT’S OWN DOCUMENT SCREEN IT WAS A `<pre>` OF RAW MERMAID SOURCE** —
`diagramNode` falls back whenever a fence has no committed drawing (`markdown.js:290–292`), and at
that commit only 2 of 16 capability fences had one. Do not repeat my sentence; the fallback is the
accurate description and it is also the more interesting fact.

THE FENCE ITSELF IS GENUINELY FIXED, verified properly: mermaid 11.17.2 from `node_modules`, headless
Chromium, `gen-diagrams.ts`’s own `securityLevel: 'strict'`, fence extracted by the product’s
`mermaidBlocks`. The PRE-repair fence fails with the error pointing at the `&`; the repaired one
parses, renders and re-serialises to well-formed XML, and the bare `<key>` and `<reason>` draw
verbatim rather than being stripped. All 16 capability fences parse.

── WHAT MUST NOT HAPPEN ────────────────────────────────

  — **DO NOT FIX A LINE AND MOVE ON.** That is the habit that produced these 15. For every claim you
    correct, READ THE CODE THE SENTENCE IS ABOUT, then read the paragraph around it.
  — **DO NOT WRITE A NEW SENTENCE YOU HAVE NOT CHECKED.** If the true value is not knowable from the
    code in front of you, say so in the text rather than composing something plausible.
  — Every diagram you touch is PARSED for real before you report. Bracket balance is not parsing.
  — RUN NO GIT COMMAND THAT CHANGES REPOSITORY STATE. The main session commits.
  — THE SERVER ON 58888 IS THE OWNER’S. Another lane is driving Playwright; keep Chromium to short
    parse runs.
