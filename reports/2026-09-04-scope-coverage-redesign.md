# Scope coverage — merge + redesign, and the “?” convention

Companion to `reports/2026-09-04-scope-coverage-redesign-mockup.html` (open it in a browser — this
document is the reading behind it, not a substitute for looking at it). Research/design only,
per the owner's ruling to merge Coverage gaps into Scope coverage and to fix the two problems he
named, plus `STD-a-screen-explains-itself-in-plain-words-and-depth-hides`, filed the same day.
**No production code changed** — `src/ui/**` was read, never written. The real screen was loaded on
a private server (`mycontext ui --port 0`, never `:58888`), driven with Playwright, and measured —
not designed from the source alone.

## What I actually saw on the real screen

Loaded against this project's own corpus (866 items, 1,142 repository files) at 1568×900:

- **The Repository tree renders 6,236 rows, fully expanded, with no collapse control at all.**
  `treeClientHeight === treeScrollHeight === 184,246px` — the pane does not even scroll internally;
  the whole page grows to that height. At the loaded viewport, that is roughly **205 screens** of
  scrolling before a reader reaches anything below the tree.
- **The pinned card is 36 ids in one unbroken paragraph**, alphabetically sorted, mixing seven
  different categories (`CONST`, `INSTR`, `INV`, `NOGOAL`, `REQ`, `RULE`, `STD`) with no grouping —
  `RULE` alone is 19 of the 36. Wraps across seven lines of monospace text with no way to tell, at a
  glance, what kind of thing is pinned or how many of each.
- **The “what governs” detail pane is not small either.** Clicking `.claude-plugin/` — a folder with
  two files — opened **86 rows**, because in this corpus almost every governing item is unscoped and
  therefore matches every folder identically (this is the same fact `reports/2026-09-04-coverage-gaps-intent.md`
  measured: 85 active, unscoped, normative items govern everywhere under this project's `global`
  scope policy). Every folder's detail pane will look close to identical and close to this long.
- **Coverage gaps' rail badge reads `0` live**, confirming the earlier finding: the directory-gap
  row has never drawn. The empty-category list, by contrast, is firing right now with **14 rows**
  (`pattern`, `glossary`, `runbook`, `procedure`, `environment`, `exception`, `contract`, `tradeoff`,
  `assumption`, `edge_case`, `risk`, `measurement`, `plan`, `todo`) — read directly off the live
  page, matching the manual count in the prior report exactly.

So both of the owner's complaints are real and measured, not stylistic: the tree is not merely long,
it is functionally unbounded, and the pinned card is not merely dense, it is an undifferentiated
wall of 36 ids a reader cannot scan for “is X pinned” or “what kinds of thing are pinned.”

## The readability principle

**Summarize first, detail on demand — one shape, used everywhere on the screen.** Any list past
roughly eight rows gets: a short counted summary that is always visible (e.g. “36 items, always on,
everywhere” / “86 items, in 8 categories”), grouped by the dimension that actually varies (category,
for both the pinned card and the detail pane), with the full member list behind one click. The
disclosure used for that click is **not a new control** — it is the “?” circle the screen already
has (`details.help` / `.helpbox`), which is also the vehicle the redesign uses for
`STD-a-screen-explains-itself-in-plain-words-and-depth-hides` (below). Applied to:

1. **The Repository tree** — closed to top-level folders by default (6 rows instead of 6,236), each
   still carrying its magnitude bar and dot, opened one folder at a time; plus a path-filter input,
   which is not new plumbing — `/api/coverage?path=<substring>` already exists and is simply unused
   by this screen today.
2. **The Pinned card** — category chips with counts (`RULE · 19`, `INSTR · 6`, …) instead of a flat
   run; clicking a chip's own disclosure reveals that category's ids.
3. **The “what governs X” detail pane** — the same grouped-chip treatment, so opening a folder
   answers “what kinds of rule cover this” before answering “which 86, exactly.”

This also **directly answers "36 items competing in one tier is itself a fact worth showing"**: the
category breakdown *is* that fact, visible without opening anything, where the flat list buried it.

## The “?” convention — one shape, prototyped here for every future screen

Per `STD-a-screen-explains-itself-in-plain-words-and-depth-hides`. Shown in the mockup both closed
and open.

- **Icon and interaction:** the circled “?” the screen already draws
  (`details.help>summary::before{content:"?"}`) — no new asset, no new component. Clicking/tapping it
  opens a `<details>` block in place; there is exactly one shape for this across the whole product
  from here on.
- **What moves behind it vs. what stays on the page:** the short, plain sentence always stays on the
  page (e.g. *“Pinned items always apply, everywhere — so they're listed once here instead of on
  every folder below.”*). Behind the “?” is *more*, never *denser* — mechanics, edge cases, and one
  concrete example (e.g. *“CONST-zero-runtime-dependencies is pinned, so it already covers a file
  that doesn't exist yet.”*). Nothing a reader needs in order to understand what they're looking at
  is ever the thing hidden behind it.
- **String keys, one small family, not one per screen:** a summary key (short trigger label) and a
  body key (the plain-words explanation), following the existing `help.*` naming already used by
  `help.whyTree` / `help.whyBudget` / `help.more` — this redesign adds to that same family rather
  than inventing a new one.
- **The measured-zero rule still applies inside it.** The example in the mockup: if every category
  someday holds at least one item, the empty-categories card does not disappear — it draws
  `◌ none — measured, every category holds at least one item`, reusing the same `◌` glyph
  `doctor.js`/`app.js`/the watch screen's hooks panel already use for “checked, and there was
  nothing.”

## What moved, what was dropped, and why

| Content | Disposition | Reason |
|---|---|---|
| Empty-category list (14 rows today) | **Moved** — new card on Scope coverage, “Categories with nothing in them” | The one fact Coverage gaps was for that nothing else shows; belongs beside the map it complements |
| Ungoverned-directory row | **Dropped** | Arithmetically unreachable under this project's scope policy (prior report); redundant even in principle with the tree's own `w`/gap dot |
| “Not examined — past the file limit” notice | **Dropped** | Unreachable at this repo's size (1,142 files vs. the 20,000-file truncation limit) and, when it would fire, a byte-for-byte duplicate of the sentence Scope coverage already carries |
| Dense technical prose (`cov.pinhelp`, `cov.magn`, the header subtitle) | **Rewritten** in plain words, moved behind “?” where it is mechanics rather than a fact the reader needs up front | `STD-a-screen-explains-itself-in-plain-words-and-depth-hides` |
| Pinned ids, detail-pane rows | **Grouped and collapsed**, not removed — every id is still reachable, one click further in | Readability principle above |

## Where the rail button goes

`Coverage gaps` is removed from the rail. A reader who goes looking for it lands, one click away,
on **Scope coverage** — the screen directly above it in the same rail group (“Injection — what
arrives”) — where its one live fact now lives as the “Categories with nothing in them” card. This
is not a hunt: same group, adjacent position, no new section to learn.

## String keys the change needs

**Dropped entirely** (screen retired) — 9 keys × 2 languages = **18 strings removed**:
`s.gaps`, `gaps.h`, `gaps.v`, `gaps.sub`, `gaps.r1`, `gaps.r2`, `gaps.cat`, `gaps.r3`, `gaps.note`,
plus the two table-header keys exclusive to that screen, `th.where` and `th.act`
(`th.what` and `btn.compose` are **not** dropped — both are shared with `ask.js`/`coverage.js` and
`palette.js` respectively, and stay in use there).

**New**, following the existing `cov.*` / `help.*` naming already on this screen — roughly 7 keys ×
2 languages = **14 strings added**:

- `cov.tree.summary` — the top status line (“{governed} of {total} paths governed, {gaps} gaps”)
- `cov.tree.filter` (+ an `aria.*` label for it) — the new path-filter input
- `cov.pin.summary` — “{n} pinned, across {c} categories”
- `cov.gov.summary` — “{n} items govern this path, across {c} categories”
- `cov.emptycat.h` — “Categories with nothing in them”
- `cov.emptycat.none` — the measured-zero line
- `help.whyMagnitude` (+ body) — the rewritten, plain-words version of `cov.magn`, now behind “?”

Category names themselves (`pattern`, `runbook`, …) and item ids need no new keys — both are already
this product's convention for **unkeyed literal vocabulary** (the same treatment `AUDIT_KINDS` and
pinned ids already get), reused rather than invented.

Net effect: **18 strings retired, 14 added — smaller, not larger**, while adding both the merge and
the plain-words rewrite.
