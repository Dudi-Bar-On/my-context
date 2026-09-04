# Does Coverage gaps justify its existence? — purpose audit

Companion to `2026-09-04-coverage-gaps-intent.md`, which showed the disputed directory row is
arithmetically unreachable. This report answers the bigger question the owner asked next: is the
screen worth keeping at all.

## The purpose, in one paragraph

Scope coverage is a map: every folder in the repo, colour-coded by which rules govern it, meant to
be **scanned**. Coverage gaps was designed as that map's opposite — not a picture to scan but a
short, actionable **list** of exactly two things a map cannot say well: folders nothing governs,
and whole *categories* of rule (e.g. "open question") that currently have **zero** items anywhere
in the project. The design record's own words for it: *"The inverse of the map: it names what is
missing, which no listing can."* That sentence is a real, on-the-record justification — not
something invented after the fact. But one of the two things it lists turns out to be
mathematically impossible to trigger (report 1), and a second is currently silent too. Only the
third is doing real work.

## 1. Everything the screen shows, row by row

| Row kind | Reachable on this corpus today? | Shown anywhere else? |
|---|---|---|
| **Ungoverned-directory row** ("`src/workers/` — 3 files, no item scopes here") | **No — structurally unreachable**, per report 1: any one of this corpus's 85 active, unscoped, normative items governs every path under the default `global` scope policy. | Would duplicate Scope coverage's own tree, which already marks a gap directory with a `w` (gap) dot and a governed/ungoverned magnitude bar — same underlying computation (`buildTree`/`coverageGapRows`), two renderings. |
| **"Not examined — past the file limit"** disclosure | **No, not today** — the walk truncates only past `COVERAGE_FILE_LIMIT = 20,000` files; this repository walks roughly 1,100–1,400. | **Yes, verbatim.** The code's own comment says the two keys (`cov.k4` + `gaps.r2`) are "`screens/coverage.js`'s verbatim rather than a second spelling invented here" — Scope coverage already carries the identical sentence. Full duplicate when it does fire. |
| **Empty-category row** ("category `open_question` — empty") | **Yes — firing right now.** Measured against the live index: 14 of this project's 29 shipped categories hold zero items today (`pattern`, `glossary`, `runbook`, `procedure`, `environment`, `exception`, `contract`, `tradeoff`, `assumption`, `edge_case`, `risk`, `measurement`, `plan`, `todo`). | **No — nowhere else.** `/api/status` computes `items.byCategory` but `status.js`'s own docblock says it is deliberately **not drawn**: *"appear\[s\] nowhere in `<section data-p="status">`."* Coverage gaps is the only place in the shipped product this fact is visible. |

**So: two of the screen's three row-kinds are dead weight** — one impossible under the shipped
config, one silent on any repo this size and a byte-for-byte duplicate when it isn't. **One is
alive, unique, and doing exactly what the design record says the screen is for.**

## 2. Where the intent was specified — found, not missing

`docs/superpowers/specs/2026-08-16-web-ui-design.md`, grading every mockup screen against a
build-worth test, on **Coverage gaps**:

> *"Which directories have no items, which categories are empty. **The inverse of the map: it names
> what is missing, which no listing can.**"*

The mockup carries the same sentence as the screen's own verdict badge (`gaps.v`): *"names what is
missing, which no listing can."* This is a real, on-the-record intention, not an unspecified
screen — the spec even flags it `✅ [W1]`, approved for the first build wave. There is no missing
citation here; the screen was deliberately designed.

## 3. Was it split from Scope coverage?

**Yes, and the moment is on the record.** `docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md`
(line 144) is a corrections table entry:

> *Was assumed:* "Coverage gaps is a panel inside the coverage screen (`coverage.js`,
> `coverageGaps()`)" → *Corrected to:* **"`Coverage gaps` is its own screen** — `<section
> data-p="gaps">`, with its own rail button `s.gaps` carrying a count badge, its own three-column
> table... and its own third state, `not examined`" — because *"a screen list is enumerated from
> the design's own section elements, not inferred from what a module could render."*

So an early plan draft *did* fold gaps into coverage.js (two trailing paragraphs — this survives
today only as a dead reference in `coverage.js`'s own docblock, `coverage.gapDirs` /
`coverage.emptyCategories`, keys no string table has ever declared). That draft was **corrected
back apart** to match what the mockup itself draws: two separate `<section>`s, two rail entries,
two verdict badges, two subtitles. The stated reason for the correction is mockup fidelity, not an
argument about the reader's question — but the spec supplies that argument independently (§1
above): the map is for scanning, the list is for the one thing the map cannot show at all
(categories). **The split was deliberate and is still reflected in the mockup as drawn.** Whether
that reason still holds is exactly what a merge proposal would need to re-argue to the owner (see
§5, Option 2).

## 4. Who is the reader, and is this the same question as Scope coverage?

For the directory content: **yes, the same question, restated as a filtered list rather than a
scan** — "where do I need to write a scope?" A reader could answer it today by scrolling Scope
coverage's tree looking for a `w` dot. Coverage gaps was meant to save that scroll by handing back
just the short list — but the list is currently always empty, so today it saves nothing.

For the category content: **no, a different question, and Scope coverage cannot answer it at all**
— "which whole *kinds* of rule does this project have none of?" Scope coverage's tree is organized
by file path; a category like `pattern` or `runbook` has no path, so no tree row could ever
represent it. This is the one piece of the screen answering a question nothing else in the product
answers.

## 5. Cost of keeping it

- **1** rail entry with a count badge (`s.gaps`).
- **8** string keys unique to this screen (`gaps.h/.v/.sub/.r1/.r2/.cat/.r3/.note`) × 2 languages =
  **16** translated strings to maintain (plus 3 keys it reuses from elsewhere at no extra cost:
  `th.where/.what/.act`, `cov.k4`, `btn.compose`).
- **1** dedicated module, `src/ui/public/screens/gaps.js` (~215 lines, most of it the docblock
  recording exactly this history).
- Shared viewmodel functions `coverageGaps`/`coverageGapRows` — **not** exclusive cost, since Scope
  coverage's own tree dots need the same computation.
- **1** dedicated test (`test/ui/gaps-screen.test.ts`) plus references from `pane-route.test.ts`,
  `read-model.test.ts`, `viewmodel.test.ts`, `e2e/screen-parity.spec.ts` and `e2e/mockup.ts`.
- **2** open tasks currently pointing at this screen: `TASK-the-coverage-gaps-screen-is-missing-its-table`
  (the one under review) and `TASK-ui1-task-18-scope-coverage-with-detail-pane-and-print-mode`
  (a bundled build task, still marked `state:todo` though the work described is done).

This is a small, contained cost — not a screen dragging its weight across the codebase. The
question is not affordability; it is whether two-thirds of what it draws will ever be true.

## Options

1. **Keep it as it is**, with the "unreachable" finding recorded (already accepted). Cost: the
   above, unchanged, plus one open task that can now be closed as a documented non-defect. Buys:
   the only home for the empty-category fact, and a directory-gap path that would still work,
   unmodified, if this project's scope policy or repository size ever changed.
2. **Merge it into Scope coverage** as a section or filter — e.g. an "Empty categories" card beside
   the existing "Pinned" card, and drop the directory table (redundant with the tree's own dots) and
   the duplicate "not examined" line. Cost: this is **not a code cleanup** — `RULE-everything-in-the-mockup-gets-built-and-a-proposal-to-change`
   requires a screenshot of the proposed before/after shown to the owner before the mockup itself
   can be changed, because the mockup currently draws two separate sections, two rail entries and
   two verdict badges, and it is the standing specification for appearance. Practically: retire
   `s.gaps` from the rail, fold `gaps.cat`/`gaps.r3` (renamed or not) into `coverage.js`, drop
   `gaps.h/.v/.sub/.r1/.r2/.note` (6 of 8 keys, 12 translated strings), merge
   `gaps-screen.test.ts` into `coverage-screen.test.ts`, and remove the `gaps` entry from
   `screen-parity.spec.ts`'s `KNOWN_GAPS`. Buys: one fewer screen to scan, and the one live fact
   moved next to the map it complements, at the cost of losing the row layout the directory content
   would use if it ever became real.
3. **Retire the screen entirely**, relocating only the empty-category list (option 2's card) and
   deleting the rest outright — no dormant directory-row scaffolding kept "just in case." Same
   mockup-approval requirement and same string/test moves as Option 2, described honestly as a
   deletion rather than a merge. Genuinely lost: the directory-gap code path and its test coverage,
   which would need to be rebuilt from scratch (not resurrected) if scope policy or repository scale
   ever made it reachable.

## Recommendation

The screen's justification is **real but partial**: one of its three row-kinds does exactly what
the design record says it exists for, and does it nowhere else. The other two are either
structurally impossible under this project's own configuration or a silent duplicate. That is not
"no reason to exist" and it is not "fully justified" either — it is a screen carrying one clause of
useful, unique payload wrapped in two clauses of dead weight.

I recommend **Option 2 (merge, folding the live content into Scope coverage)** over keeping it
as-is or a bare retirement: it keeps the one fact that has no other home, removes two months of
duplicate/impossible scaffolding from the maintenance surface, and — because it is explicitly a
*proposal*, not an action I can take — puts the actual before/after screenshot in front of the
owner, which `RULE-everything-in-the-mockup-gets-built-and-a-proposal-to-change` requires anyway
before anything here changes.

I would be wrong about this if either holds: (a) this project's `scope_policy` is expected to
change to `inert` for some category for reasons unrelated to this screen, which would make the
directory-gap row real and valuable on short notice — nothing in the design record suggests this is
planned; or (b) the repository is expected to grow past 20,000 tracked files soon, which would make
the "not examined" disclosure real — at roughly 1,400 files today, that is not a near-term
concern. Absent either, the case for two of the three row-kinds does not hold, and the case for the
third is better served living beside the map it was built to complement.
