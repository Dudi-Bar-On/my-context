# Documentation screen Implementation Plan

Carries out `docs/superpowers/specs/2026-09-05-documentation-screen-design.md`, itself cut from
`reports/2026-09-05-documentation-screen-definition.md`. Eight tasks, filed in the corpus as
`docsys/1`–`docsys/8`, `state: todo`. This plan sequences them; it does not restate their bodies —
`mycontext show docsys/<n>` is the source of record for each.

## Global constraints

- **No production code changes as part of filing this plan.** The plan describes the order a lane
  should execute in; nothing here has been built.
- **`CONST-zero-runtime-dependencies` and `CONST-node-24-no-build-step` bind every task below.**
  `docsys/5` through `docsys/8` are written on the assumption `docsys/3` rules "build without a
  generator" (report §6's recommendation); if the owner rules otherwise, this plan's steps 4–7
  need re-scoping around whatever tool is adopted, and that re-scoping is itself the first
  consequence of that ruling, not a silent extension of it.
- **`docsys/2` and `docsys/3` are owner rulings, not lane work.** A lane cannot pick up `docsys/4`
  or later until a person has answered them; `mycontext ready` will correctly withhold them via
  `needs`.
- **`RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done`** still governs any visual change
  — `docsys/5` and `docsys/6` touch the Documentation screen's drawn surface and need a mockup
  session (`DEC-claude-drafts-the-mockup-and-the-owner-approves`) before or alongside the code,
  the same discipline every other screen task in this corpus already follows.
- **`INV-nothing-is-dropped-silently`** (quoted by `dv.mdnote`) binds the manifest and route work
  the same way it already binds the renderer: an unreachable document, a missing Hebrew mirror, or
  a document the manifest's globs miss must be disclosed, never silently absent.

## Task 1 — `docsys/1`: correct `dv.sub` and `dv.v`

**No dependency. Lands first, same day as this plan if approved.**

The mockup (`docs/design/web-ui-mockup.html:3690`) and both live string tables
(`src/ui/public/strings/en.js:1205`, `src/ui/public/strings/he.js:830`) still assert *"The README
in this repository, rendered here … addressed by heading ordinal"* and *"cross-linked to your own
corpus, which a docs site cannot do"* — both found false by `DEC-the-documentation-screen-serves-the-help-topics-and-says-so`
on 2026-08-25, and never corrected in the artifact.

**What changes:** `dv.sub` restated to describe what the screen actually renders today (a
`mycontext help` topic — see the task body for suggested wording, not prescribed here since mockup
wording is the owner's per `DEC-claude-drafts-the-mockup-and-the-owner-approves`); `dv.v` restated
to drop the "cross-linked to your own corpus" claim, which belongs to `learn.js`. Both edits land
in the mockup, `en.js` and `he.js` together, held by the existing string-key parity test.

**Verification:** the existing `test/ui/*` string-parity tests continue to pass (no key added or
removed, only values changed); a human reads the corrected sentence against what `docs.js` actually
fetches.

## Task 2 — `docsys/2`: owner ruling — which screen hosts the viewer

**No dependency; blocks Tasks 4–7.**

Put the report's §5 finding to the owner directly: `DEC-the-markdown-viewer-lives-in-coverage-and-renders-by-id`
(2026-08-26) names Coverage; `DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer`
(2026-08-28) treats Documentation's Contents card as the obvious candidate without reversing the
earlier ruling. This plan's Tasks 4–7 are written against "Documentation hosts it" per the spec's
stated assumption; if the owner rules Coverage instead, those tasks move screens but keep their
manifest/route/index substance — the work is not wasted, only relocated.

**Output:** a recorded decision (the owner's own mechanism — a corpus item captured the way every
other ruling in this project is, by the person ruling it, not by this delegated pass).

## Task 3 — `docsys/3`: owner ruling — tooling

**No dependency; blocks Tasks 5–8's exact shape (though not their existence).**

Put report §6 to the owner: build without a generator (recommended, costed) or adopt one (costed,
named, evaluated against `CONST-zero-runtime-dependencies` and `CONST-node-24-no-build-step`
together). Tasks 5–8 below assume "build without one"; if overruled, they get re-planned against
the named tool rather than silently reinterpreted.

## Task 4 — `docsys/4`: bring the documents into the corpus

**Needs: `docsys/2`** (confirms the boundary is `watchedDocs`-scoped rather than a wider glob,
which changes what "bring in" means).

`README.md`, `docs/README.he.md`, and the tutorial files (`docs/TUTORIAL.md`,
`docs/TUTORIAL-ADVANCED.md`) are added to `watchedDocs`, with the refresh mechanism the
requirement's own text leaves open — pick one of the three candidates it names (a hook on write, a
`doctor` check, or a step in `init`/`refresh`) and make staleness **visible**, not merely unlikely,
per R6. This also feeds the capture nudge in `src/hooks/post-tool-use.ts`, since `watchedDocs`
drives both jobs — state that consequence in the task's own commit rather than discovering it
later, exactly as the requirement warns.

**Verification:** `doctor` (or whichever mechanism is chosen) surfaces a stale copy; a test edits
the source file and asserts the corpus copy is flagged, not silently served old.

## Task 5 — `docsys/5`: the manifest, the route, the derived index, the deep link

**Needs: `docsys/2`, `docsys/3`, `docsys/4`, and `walk/25`** (the route ruling and boundary tests
this plan does not duplicate — `plan:walk seq:25` remains the task of record for `GET /api/doc/:id`
itself; this task is the Documentation screen's consumer of it).

Replace `docs.js`'s five-literal `CONTENTS` with the manifest response; add the document picker;
parse headings into the index (spec §1); wire `#/docs/:id/:anchor` into the shell's `route()`
(spec §2). This is the task that most needs a mockup session first, per
`RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done`.

**Verification:** the new manifest/heading-index tests (spec §5); a browser test opens a deep link
directly and asserts the right document and heading are shown.

## Task 6 — `docsys/6`: per-document Hebrew tracking

**Needs: `docsys/5`.**

`hasHebrewMirror` per manifest entry (spec §4); the `to write` chip reused from Tutorials' own
pattern rather than a new component. Explicitly document-level, not heading-level (spec §6).

**Verification:** a document with no `.he.md` counterpart renders the chip, never a blank cell and
never English prose silently substituted under a Hebrew heading — the same assertion shape
`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` already has precedent for on this
screen's neighbours.

## Task 7 — `docsys/7`: CLI-versus-UI coverage disclosure

**Needs: `docsys/5`** (needs somewhere to render); **does not need `docsys/6`** (independent
axis).

A generation script in the shape of `scripts/gen-commands.ts`, walking `COMMANDS` and
`registerReadRoutes` (spec §3), producing the coverage table; wired into `npm run gen:docs`'s
family rather than invented as a fourth generator with its own invocation.

**Verification:** the coverage-derivation test (spec §5); a manually-added CLI command with no UI
equivalent is asserted to render as explicitly uncovered, not silently absent from the table.

## Task 8 — `docsys/8`: the gates

**Needs: `docsys/5`, `docsys/7`.**

The three new tests spec §5 names (manifest reachability, heading-index accuracy,
coverage-derivation), written in the same file family as `test/docs/inventory.test.ts` and
`test/docs/counts.test.ts` — extending that suite, never a parallel one.

**Verification:** each new test fails when its corresponding fact is hand-edited instead of
regenerated (the same "committed red on purpose" discipline `inventory.test.ts`'s own header
documents), then passes once regenerated correctly.

## What this plan does not schedule

- `walk/25`'s own boundary tests (`../`, absolute path, symlink refusal) — that task's to close,
  referenced here as a dependency, not restated.
- `walk/95`'s two mockup answers (table alignment class, image-refusal sentence) — orthogonal to
  this plan's scope, already filed, already `state: todo`.
- Anything named explicitly out of scope in the spec (§6): full-text search, a generated
  independent site, per-heading Hebrew parity, item-to-document citation, a wider-than-`watchedDocs`
  manifest, or a third-party generator.
