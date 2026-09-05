# The Tutorials screen — definition, requirements, and the gap list

**Method.** `INSTR-a-screen-is-defined-from-every-document-that-mentions-it`, applied for
the first time, to the screen it was written about. Read: `docs/superpowers/specs/2026-08-16-web-ui-design.md`
(design of record + its 2026-08-20 correction), `docs/design/web-ui-mockup.html` §`data-p="tut"`,
`docs/superpowers/plans/*` (all four hits), `docs/TUTORIAL.md`, `docs/TUTORIAL-ADVANCED.md`,
`reports/2026-08-22-DOCS-REVIEW.md`, `reports/V2-HANDOVER.md`, `reports/2026-09-05-walk-sweep.md`,
`reports/2026-09-04-v2-0-in-out-cut.md`, the corpus (`search "tutorial"`, every hit shown),
`src/ui/public/screens/tut.js`, `apiTutorials` + `TUTORIAL_TARGETS` in `src/ui/read-model.ts`,
the route table in `src/ui/server.ts`, `HELP_TOPICS` in `src/core/teach.ts`, and
`git log -S tutorial -- docs/ src/`. No production code changed; no item state changed. The
only write is this file.

---

## 1. The definition

**The record does not contain one.** No spec, plan, or brainstorm document ever states what
the Tutorials screen is *for* — what question a reader brings to it, what decision it lets
them make, or why it exists as a screen rather than as two files in `docs/`. Every document
that touches it describes its *shape* (six rows, two language columns, titled by job) and its
*grading* (pass/fail against the mockup), never its *purpose*. `TASK-screens-tut-js-has-no-plan-behind-it`
says this in as many words: *"tut is covered by nothing. Owner call whether it is scope or an
omission"* (`.my_context/items/`, plan:port seq:5, filed 2026-08-22) — and that task is marked
`state: done` without the owner call ever having been recorded. A screen can be described
without being defined, and that is exactly what happened here.

The closest thing to a definition is inferred, not sourced, and is labelled as such: *this
screen exists to tell a reader, at a glance, which of six job-oriented walkthroughs has
already been written, in which language, before they go looking for one in the repository.*
That is a description of the six rows, not a reason the product needs a screen for it — the
same information is fully available from two files' tables of contents. Nothing in the record
argues the screen adds something a person opening `docs/TUTORIAL.md` directly could not get.

## 2. Requirements, each traced to its source

| # | Requirement (quoted) | Source |
|---|---|---|
| R1 | *"Tutorials … Six replacing two, listed as Tutorial / the job it answers / EN / HE"* | `docs/superpowers/specs/2026-08-16-web-ui-design.md:1341-1342` |
| R2 | *"each one titled with a job, not a feature"* (`tu.v`) | `docs/design/web-ui-mockup.html:3716`, echoed verbatim at spec:1341 |
| R3 | *"every transcript is a generated block, so a tutorial cannot teach a flag that no longer exists without a test going red"* | `docs/design/web-ui-mockup.html:3717-3718` and spec:1342-1343 — **a claim about how the tutorial content itself must be produced (generated, test-gated), not about the screen** |
| R4 | *"Do not ship a toggle that falls back"* — the HE column must read as a status, never as a control that silently serves English when Hebrew is absent | `docs/superpowers/specs/2026-08-16-web-ui-design.md:1350` (quoted directly from the mockup) |
| R5 | *"Hebrew is shown as **to write** rather than as a language toggle that would silently fall back to English. The changelog already records that the tutorials have no parity test; this is that gap, drawn."* | `docs/design/web-ui-mockup.html:3728-3730` (`tu.gap`) |
| R6 | The six rows and two language columns must be *"drawn from something a gate can check rather than from twelve literals — which needs either a route that serves tutorial files or a ruling that this screen is a static index"* | `TASK-tutorials-what-the-screen-is-and-what-implemented-means-for` (plan:walk seq:131) |
| R7 | *"the owner's answer to whether tutorials are in scope at all, which is the prior question"* — named by the same task as the **second, unmet condition of "implemented"** | `TASK-tutorials-what-the-screen-is-and-what-implemented-means-for` (plan:walk seq:131) |
| R8 | The screen sits in `nav.read`, grouped with Documentation and Learn, as one third of what an earlier document called one screen (*"Learn"*) before the rail split it in three | `docs/superpowers/specs/2026-08-16-web-ui-design.md:113,730-731,743` |
| R9 (inferred) | The tutorial *content itself* should stay accurate against the shipped product — not a screen requirement, but a standing expectation the screen's own EN/HE checkmarks now make visible on-screen for the first time | Inferred from `reports/2026-08-22-DOCS-REVIEW.md` F4/F7/F8/F11/F14 (see §7) — **labelled as inference**: no document says the screen must catch this, but its existence now surfaces it |

Nothing in any plan (`docs/superpowers/plans/*.md`) assigns a task to build this screen. The
four plan hits that mention "tutorial" (`2026-08-17-my-context-test-campaign.md`,
`2026-08-20-v2-categories-and-runbooks.md`, `2026-08-21-web-ui-visual-repaint.md`,
`2026-08-17-my-context-plugin-test-campaign-design.md`) are all about the *content* of
`docs/TUTORIAL.md`/`TUTORIAL-ADVANCED.md` (writing them, keeping their category counts
correct) or about the Read-group rail label in the repaint checklist — none plans the screen's
behaviour. This corroborates R7/§1: the design is the only specification, and the design never
says what the screen is for, only what it draws.

## 3. What is built today, measured against those requirements

Verified live in `src/ui/public/screens/tut.js` and `apiTutorials`/`TUTORIAL_TARGETS` in
`src/ui/read-model.ts:3167-3276`, and against the route table (`/api/tutorials` is registered
in `src/ui/server.ts`; no route serves `docs/TUTORIAL.md` or `docs/TUTORIAL-ADVANCED.md` as a
file — confirmed by grep against the route table, matching the already-measured fact).

- **R1/R2/R8 — met.** Six rows, job-titled, in the mockup's exact order (`TUTORIAL_ROWS`),
  under `nav.read` beside `docs` and `learn`.
- **R6 — met, as of today.** `GET /api/tutorials` checks, per request, whether a real heading
  exists in `docs/TUTORIAL.md` or `docs/TUTORIAL-ADVANCED.md` for five of the six rows;
  `screens/tut.js` renders from that response instead of twelve literals. Row 2 ("when it did
  not fire") matches no heading in either file and correctly renders `unmeasured` (`◌`) rather
  than a guessed `done`/`todo` — reusing `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`'s
  existing chip primitive rather than inventing a fourth state.
- **R4/R5 — met.** The HE column never falls back to English; `todo`/`unmeasured` render as
  chips, `done` as a bare glyph, exactly as `tu.gap` specifies.
- **R3 — not built, not measured, and not owned by this screen.** No mechanism ties the
  tutorial *transcripts* to a test that goes red when a flag disappears; this requirement is
  about how `docs/TUTORIAL*.md` content is produced, and nothing in `screens/tut.js` or
  `read-model.ts` touches it. It is the one requirement most clearly aimed at the *documents*,
  not the screen — flagged, not claimed as a screen gap.
- **R7 — NOT MET, and this is the finding the whole dispatch is about.** The screen was
  measured today only against R1–R6, which is the shape the mockup can be graded against. The
  question the task itself names as prior — *is a tutorials screen in scope at all* — has never
  been put to the owner. `reports/V2-HANDOVER.md` lists it, unresolved, in the same section
  as five other owner-only questions (*"walk/131/port/5d — are tutorials in scope at all?"*,
  §"STILL OPEN — ALL NEED THE OWNER", item 6), on the same day the endpoint work landed.
- **R9 (inferred) — not met**, and orthogonal to the screen: `reports/2026-08-22-DOCS-REVIEW.md`
  documents `docs/TUTORIAL.md` and `docs/TUTORIAL-ADVANCED.md` themselves carrying stale facts —
  wrong hook count, wrong version number, wrong budget tier and number, a refused config value
  still taught as valid (F4, F7, F8, F11, F14). `TASK-docs-tutorial-md-and-docs-tutorial-advanced-md-add-examples`
  (state: done, 2026-09-04) fixed one dimension of this (the `--summary` gate breaking the
  walkthrough's own example commands) but the DOCS-REVIEW findings above are a different,
  broader set and nothing in the corpus shows them closed. The screen's `done`/`todo` checkmark
  only tests **heading presence**, never content correctness — so `apiTutorials` can now say
  ✅ for a heading whose own prose is stale by the review's own findings. This is real but is
  a documents problem the screen was never asked to solve — worth naming, not blaming on the
  screen.

## 4. The gap list

1. **The scope ruling itself.** Nothing else on this list can close until the owner answers
   R7: is Tutorials a screen the product should have at all? (See §6.)
2. **`TASK-screens-tut-js-has-no-plan-behind-it` is marked `done` with its own question
   unanswered.** The task ends *"Owner call whether it is scope or an omission,"* and its
   frontmatter reads `state: done`. Whatever closed it did not close the question it asked —
   this is the exact "item closes without the second condition being met" pattern the
   dispatching instruction was written about, found a second time inside its own evidence
   trail.
3. **R3 — no test gates the tutorial transcripts against drift.** *"a tutorial cannot teach a
   flag that no longer exists without a test going red"* is asserted on the mockup and unbuilt
   anywhere in the record. Whether this is a screen requirement or a documents-pipeline
   requirement is itself unresolved — it reads as the latter but was written directly beside
   the six screen rows.
4. **The heading-presence check does not test content correctness.** Five DOCS-REVIEW findings
   (F4, F7, F8, F11, F14) show the two tutorial files carrying stale facts under headings that
   `apiTutorials` will happily mark `done`. If the owner rules the screen in-scope, its
   ✅/▲/◌ semantics should be named explicitly as "section exists" rather than "content is
   correct" somewhere a reader can see it (the module header says this; no screen-visible text
   does).
5. **No Hebrew tutorial content exists at all** (`docs/TUTORIAL.md` and
   `docs/TUTORIAL-ADVANCED.md` have no `.he.md` counterpart — DOCS-REVIEW, both languages
   sections of F4/F7/F11), so five of six HE cells and one EN cell are structurally `to write`
   until someone writes Hebrew tutorials, independent of anything the screen does.
6. **Row 2 ("when it did not fire") names no heading to check for, in either file.** Either a
   heading needs to be written and named in `TUTORIAL_TARGETS`, or the row itself needs an
   owner decision — right now it is permanently `unmeasured` by construction, which is honest
   but also permanent until someone acts.

None of the six items above requires new code to *state* — items 1, 2 and 6 are pure decisions;
3, 4, 5 are documentation work with no screen code implicated.

## 5. Contradictions between documents

Applying `STD-the-precedence-order-when-four-sources-of-truth-disagree` (corpus/screens →
plans → specs → first documents, later overrides earlier) —

- **The 2026-08-16 spec's original body gave the whole `nav.read` group (then called "Learn")
  a conditional pass tied to corpus cross-linking**, then its own **2026-08-20 correction**
  split it into three screens and graded `tut` a clean ✅ on different grounds entirely (job
  titles, generated transcripts) — the correction is later and inside the same document, so it
  wins outright; not a contradiction requiring adjudication, just noted because a reader of the
  uncorrected body alone would misread `tut`'s grade.
- **`TASK-screens-tut-js-has-no-plan-behind-it` (port/5, 2026-08-22, `state: done`) versus
  `reports/V2-HANDOVER.md` (2026-09-05) and `TASK-tutorials-what-the-screen-is-and-what-implemented-means-for`
  (walk/131, `state: active`/`todo`).** The older task is marked done; the newer corpus items
  and the newer handover both still list the same question as open. Under the precedence
  order, **the corpus and the screens are authority on fact, and later decisions override
  earlier ones** — so the newer, still-open items win: the question is open, and port/5's
  `done` state is the stale artefact. This is the same class of finding `RULE-a-...` documents
  elsewhere have flagged: a task closed without its own condition being satisfied.
- **`reports/2026-09-05-walk-sweep.md` marked `TASK-tutorials-what-the-screen-is-and-what-implemented-means-for`
  "ALREADY DONE"** on the strength of the endpoint work (R1–R6 above), the same day
  `reports/V2-HANDOVER.md` — written the same day — listed the scope question as one of only
  seven items needing the owner. Both are 2026-09-05 sources, so precedence-by-recency does not
  separate them; they are simultaneously true only if "done" is read against R1–R6 alone. Read
  against the task's own full text (which explicitly names R7 as a second, prior condition),
  the walk-sweep's "ALREADY DONE" verdict is incomplete rather than wrong about what it
  measured — it measured the built half and reported it as the whole. Named here rather than
  silently corrected, per the method.
- **The mockup is not in the precedence list** (`STD-...`: *"THE MOCKUP IS NOT IN THIS LIST,
  deliberately … governs BEHAVIOUR"* is what the order settles; the mockup is visual authority
  under a separate rule). Where this report cites the mockup for R1–R5, that is presentation
  authority, not a claim it settles the scope question — nothing in the mockup could, since the
  mockup only ever draws screens that already exist in it.

No coarse contradiction (two documents describing different products) was found. All
disagreements above are fine — different documents, or a document and its own frontmatter,
disagreeing about a task's completion state — and are reconciled by the recency rule rather
than escalated.

## 6. The open question for the owner

**Is a tutorial a thing the UI serves, or a file you read in the repository?**

Concretely: should `docs/TUTORIAL.md` and `docs/TUTORIAL-ADVANCED.md` become browsable *inside*
the product (a route that serves their content, the way `docs` serves the README), or is the
Tutorials screen correctly scoped as a static index that only ever tells you *whether* a
walkthrough exists and in which language — never *reads* it to you? Today it is the second, by
default rather than by decision: nothing in the record says the second is right, only that
nothing built the first.

## 7. What the record answers that nobody acted on

- **The scope question itself.** Raised 2026-08-22 (port/5), reiterated 2026-08-25 (walk/131's
  own text), still listed as needing the owner in `reports/V2-HANDOVER.md` on 2026-09-05 —
  three separate moments recorded it, and the fix that landed today (the endpoint) answered a
  different, later-filed question (port/5d, the hard-coded cells) instead.
- **The tutorial files' own factual drift** (DOCS-REVIEW F4/F7/F8/F11/F14, 2026-08-22) sits
  unresolved in the corpus while a screen that now puts a checkmark next to those same files
  went live today. The review predates the screen's endpoint by two weeks; nobody connected
  the two records before this pass.
- **`TASK-screens-tut-js-has-no-plan-behind-it` closed without answering the question it
  asked** — recorded above as a contradiction (§5) but restated here because it is exactly the
  "stale premise found by re-reading, not by building" pattern `INSTR-a-screen-is-defined-from-every-document-that-mentions-it`
  was written to catch, found on its very first run.
