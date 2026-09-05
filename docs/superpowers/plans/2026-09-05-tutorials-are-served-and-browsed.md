# Tutorials are served and browsed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A reader opens the Tutorials screen, sees a list of job-titled tutorials grouped Basic
and Advanced, and reads one in place — each tutorial teaching one feature of my_context: what it
is for, how it works, how to use it from the CLI, and how to use it from the UI, with the two
surfaces named as what each can and cannot do. The list is drawn from a manifest the program
derives from its own command, screen and category surfaces rather than from hand-typed rows, and
a small set of literal facts a tutorial states (version, hook roster, profile names, tier numbers)
are checked against the code that would make them wrong.

**Architecture:** A generated manifest (`docs/tutorials/manifest.json`) is the single source of
truth for the tutorial roster, produced by clustering four already-globbable surfaces (CLI
commands, UI screens, slash commands, item categories) and checked into the corpus. The server
globs the manifest's own files at start and answers two read-only, bounded endpoints —
`GET /api/tutorials` (the list, widened from six hard-coded rows) and `GET /api/doc/:id` (one
tutorial's markdown, the tutorial-scoped instance of the manifest-and-stable-id mechanism
`DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer` already rules for every markdown
route). The screen reuses `markdownNodes` exactly as `app.js` already reuses it across modules —
no second renderer. Content migration and the literal-fact drift gates land after the mechanism is
provable, not before.

**Tech Stack:** Node >= 24 built-ins only — `node:fs`, `node:path`. No build step, no runtime
dependency, erasable TypeScript syntax only. `node:test` with `node:assert/strict`. Browser-side
JS is plain ES modules under `src/ui/public/`, matching every existing screen.

**Spec:** `docs/superpowers/specs/2026-09-05-tutorials-are-served-and-browsed-design.md`

## Global Constraints

- Node >= 24, native TypeScript type-stripping, `erasableSyntaxOnly`.
- Zero runtime dependencies. `node:` built-ins only.
- **No client-supplied path ever reaches the filesystem.** `GET /api/doc/:id` resolves `id`
  against the manifest's own map; a path is never built from request input. This is
  `DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer`'s own rule, applied here rather
  than re-derived.
- **One markdown renderer.** `markdownNodes` (`src/ui/public/screens/docs.js`) is imported, never
  duplicated. If a task in this plan finds itself writing a second markdown-to-DOM function, that
  is a stop-and-reconsider signal, not a thing to finish.
- **The web UI is read-only.** Nothing in this plan adds a write route or a control that mutates
  the corpus or the filesystem from the browser.
- **Existence gates say what they check.** A test or an on-screen label that means "the section is
  present" must not be worded as though it means "the content is correct." Carried from the spec's
  *How they are kept TRUE* section into every task that touches `apiTutorials`.
- **The generated-block promise survives the split.** Every worked command-and-output block in
  every migrated tutorial file is run against a fresh workspace, not written by hand.
- Run the whole suite with `npm test`. Never run `npm test` or `test:e2e` from a subagent.

---

### Task 1: The surface globs and the feature manifest

**Files:**
- Create: `src/core/tutorial-manifest.ts`
- Create: `docs/tutorials/manifest.json` (generated output, checked in)
- Create: `scripts/build-tutorial-manifest.ts` (or a `mycontext`-internal build step — the exact
  entry point is an implementation choice; the manifest must be regenerable by running one command)
- Test: `test/core/tutorial-manifest.test.ts`

**Interfaces:**
- Consumes: `src/cli/commands/*.ts` (globbed, minus `index.ts`/`registry.ts`/`format.ts`),
  `src/ui/public/screens/*.js` (globbed, minus `parts.js`, `tut.js`, `docs.js`, `learn.js`),
  `commands/*.md` (globbed), `src/core/categories.ts`'s `CATEGORIES`.
- Produces:
  ```ts
  export interface TutorialManifestEntry {
    id: string;            // stable, e.g. "narrowing-a-session"
    title: string;         // a job, not a feature name — R2
    tier: 'basic' | 'advanced';
    cli: string[];         // e.g. ["focus.ts"]
    slash: string[];       // e.g. ["focus.md"]
    screens: string[];     // e.g. ["palette.js"]
    categories: string[];  // usually []; non-empty only for the categories tutorial
    enFile: string;        // "docs/tutorials/<id>.md"
    heFile: string;        // "docs/tutorials/<id>.he.md"
  }
  export function loadTutorialManifest(repoRoot: string): TutorialManifestEntry[];
  ```

- [ ] **Step 1: Write the failing coverage test**

The test globs the four surfaces itself (not by reading the manifest — independently, so the test
cannot be fooled by a stale manifest) and asserts every entry in every surface, except the carved-out
meta screens (`parts.js`, `tut.js`, `docs.js`, `learn.js`) and the plumbing CLI files
(`index.ts`, `registry.ts`, `format.ts`), is claimed by exactly one manifest entry's `cli`,
`slash`, `screens` or `categories` array. A file claimed twice, or not at all, fails with the
file's own name in the message — the same "name what is unclaimed" discipline every refusal on
this server already follows.

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { loadTutorialManifest } from '../../src/core/tutorial-manifest.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const META_SCREENS = new Set(['parts.js', 'tut.js', 'docs.js', 'learn.js']);
const PLUMBING_CLI = new Set(['index.ts', 'registry.ts', 'format.ts']);

test('every CLI command file is claimed by exactly one tutorial', () => {
  const manifest = loadTutorialManifest(REPO_ROOT);
  const claimed = new Map<string, string[]>();
  for (const entry of manifest) {
    for (const f of entry.cli) claimed.set(f, [...(claimed.get(f) ?? []), entry.id]);
  }
  const files = readdirSync(path.join(REPO_ROOT, 'src/cli/commands'))
    .filter((f) => f.endsWith('.ts') && !PLUMBING_CLI.has(f));
  for (const f of files) {
    const owners = claimed.get(f) ?? [];
    assert.equal(owners.length, 1, `${f}: claimed by ${owners.length} tutorials (${owners.join(', ')})`);
  }
});

test('every UI screen file is claimed by exactly one tutorial', () => {
  const manifest = loadTutorialManifest(REPO_ROOT);
  const claimed = new Map<string, string[]>();
  for (const entry of manifest) {
    for (const f of entry.screens) claimed.set(f, [...(claimed.get(f) ?? []), entry.id]);
  }
  const files = readdirSync(path.join(REPO_ROOT, 'src/ui/public/screens'))
    .filter((f) => f.endsWith('.js') && !META_SCREENS.has(f));
  for (const f of files) {
    const owners = claimed.get(f) ?? [];
    assert.equal(owners.length, 1, `${f}: claimed by ${owners.length} tutorials (${owners.join(', ')})`);
  }
});

test('every tutorial has a unique id and a valid tier', () => {
  const manifest = loadTutorialManifest(REPO_ROOT);
  const ids = manifest.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate tutorial id');
  for (const e of manifest) assert.ok(e.tier === 'basic' || e.tier === 'advanced', e.id);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/core/tutorial-manifest.test.ts`
Expected: FAIL — module not found (nothing built yet).

- [ ] **Step 3: Write the clustering and the manifest**

Write `src/core/tutorial-manifest.ts` to glob the four surfaces and cluster them, following the
worked example in the spec's *The full set* section as the starting clusters (capture-and-categories,
injection tiers, narrowing a session, revisions and the review queue, packs, checking on the
corpus, and so on) and extending it until every file from every surface is claimed. Run the build
script, inspect the output by hand against the spec's clustering rule (a feature is one job reached
from two or more places, not two jobs that happen to share a screen), and commit
`docs/tutorials/manifest.json` as the frozen first roster. This is the step where the actual count
— the spec's estimate was twenty-five to thirty — becomes a measured number rather than a guess.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/core/tutorial-manifest.test.ts`
Expected: PASS, 3 tests, and the manifest file exists on disk.

---

### Task 2: `GET /api/tutorials`, widened to read the manifest

**Files:**
- Modify: `src/ui/read-model.ts` (`apiTutorials`, `TUTORIAL_TARGETS`, `TutorialsBody`)
- Test: existing tutorials tests in `test/ui/read-model.test.ts` (or wherever `apiTutorials` is
  covered today), extended

**Interfaces:**
- Produces (widened):
  ```ts
  export interface TutorialListRow {
    id: string; title: string; tier: 'basic' | 'advanced';
    en: TutorialCellState; he: TutorialCellState;
  }
  export interface TutorialsBody {
    tutorials: TutorialListRow[];
    heRollup: { done: number; total: number }; // the measured-zero rollup
  }
  ```

- [ ] **Step 1: Write the failing test**

Extend the existing `apiTutorials` test file with cases for: a manifest with N entries produces N
rows (not six); `heRollup.done` counts only rows whose `he` is `'done'`; `heRollup.total` counts
every row whose `en` is not `'unmeasured'` (a row cannot need a Hebrew translation of a tutorial
that does not exist yet); the response shape is `{ tutorials, heRollup }`.

- [ ] **Step 2: Run it to make sure it fails**

Expected: FAIL — old six-row shape, no `heRollup` key.

- [ ] **Step 3: Rewrite `apiTutorials` against the manifest**

Replace `TUTORIAL_TARGETS` (the hard-coded six) with `loadTutorialManifest(repoRoot)`. For each
entry, compute `en` and `he` exactly as `tutorialRowState` does today — a real heading present in
`enFile`/`heFile` is `done`, the file exists without the heading is `todo`, the file itself does
not exist is `unmeasured` — reusing the existing heading-presence function rather than rewriting it.
Compute `heRollup` from the same per-row states.

- [ ] **Step 4: Run the tests and make sure they pass**

Expected: PASS.

---

### Task 3: `GET /api/doc/:id` for tutorial files

**Files:**
- Modify: `src/ui/server.ts` (route registration)
- Modify: `src/ui/read-model.ts` (`apiTutorialDoc` or similarly named handler)
- Test: `test/ui/read-model.test.ts` (or a new `test/ui/tutorial-doc.test.ts`)

**Interfaces:**
- Produces:
  ```ts
  export interface TutorialDocBody { markdown: string; title: string; tier: 'basic' | 'advanced' }
  export function apiTutorialDoc(ws: Workspace, url: URL, params: { id: string; lang?: 'en' | 'he' }): JsonResult;
  ```

- [ ] **Step 1: Write the failing tests**

Cases: a known id in the manifest, `lang` omitted or `en`, returns the English file's markdown; a
known id with `lang=he` and an existing `.he.md` file returns the Hebrew markdown; a known id with
`lang=he` and no Hebrew file returns the same shape of refusal every other route gives, naming the
id and that no Hebrew file exists (never a silent fallback to English — the spec's "no toggle that
falls back" carried into the route, not only the screen); an unknown id returns a 404-shaped
refusal naming that the id is not in the manifest — never an attempt to resolve it as a path.
Add a `../` and an absolute-path `id` value as explicit test cases, asserting both are refused as
unknown ids (never resolved), the same discipline `walk/25`'s own task text requires of any route
that takes an identifier from a client.

- [ ] **Step 2: Run it to make sure it fails**

Expected: FAIL — route not registered.

- [ ] **Step 3: Implement the route**

`registerRoute('GET', '/api/doc/:id', json(apiTutorialDoc))` in `src/ui/server.ts`, following the
existing route registration pattern used for `/api/item/:id` immediately above it. The handler
looks `params.id` up in the manifest (an object/Map keyed by id, built once from
`loadTutorialManifest`), never touches `path.join` with request input, and reads the resolved
`enFile`/`heFile` exactly as `apiTutorials` already does.

- [ ] **Step 4: Run the tests and make sure they pass**

Expected: PASS, including the traversal-refusal cases.

---

### Task 4: The screen — list view driven by the manifest, and the reader view

**Files:**
- Modify: `src/ui/public/screens/tut.js`
- Test: any existing DOM-level test for `tut.js` (extend), plus a new test for the reader view

**Interfaces:**
- The list view replaces `TUTORIAL_ROWS`/`cellSpec` iteration over six fixed rows with iteration
  over `body.tutorials` from the widened `/api/tutorials` response, grouped by `tier` (a Basic
  section, an Advanced section, matching the spec's two-tier split), each row still drawing the
  same three cell states (`done`/`todo`/`unmeasured`) through the existing `cellSpec` function —
  unchanged, because the cell vocabulary does not change, only what feeds it.
- A Hebrew rollup line renders near the list header from `body.heRollup`, e.g. `he: 0/28 written`
  — the measured-zero disclosure the spec requires, using the same `.chip.unmeas`/`strip.unmeasured`
  primitive the rest of the app already uses for a zero that was measured rather than omitted.
- Clicking a row opens the reader view: `GET /api/doc/:id?lang=en|he`, rendered through
  `markdownNodes` imported from `/screens/docs.js` — the same cross-module import `app.js` already
  performs, not a new renderer.
- A short, on-screen sentence near the list states what `done` means and does not mean — "section
  present; the code-checked facts below agree with what ships" — per the spec's requirement that
  this distinction not live only in a code comment.

- [ ] **Step 1: Write the failing tests** for: the list renders N rows grouped by tier; the rollup
  line renders the measured count; a row click requests `/api/doc/:id` and renders the response
  through `markdownNodes` (assert `markdownNodes` is called, not that HTML matches exactly, per
  this project's existing DOM-test conventions for other screens).

- [ ] **Step 2: Run it to make sure it fails**

- [ ] **Step 3: Implement the two views in `tut.js`**, following `docs.js`'s existing pattern for
  fetching and rendering one document (the same fetch-then-`markdownNodes` shape `docs.js` already
  uses for its one served topic), and `learn.js`'s pattern for a list that groups by a category.

- [ ] **Step 4: Run the tests and make sure they pass**

---

### Task 5: Migrate the existing chapters into per-feature files

**Files:**
- Create: `docs/tutorials/<id>.md` for every manifest entry whose `id` corresponds to an existing
  chapter of `docs/TUTORIAL.md` or `docs/TUTORIAL-ADVANCED.md`
- Modify: `docs/TUTORIAL.md`, `docs/TUTORIAL-ADVANCED.md` — a short pointer left in place saying
  the content moved to `docs/tutorials/`, so a reader following an old link or a repository search
  is not met with a dead end (these two files stay as the historical basic/advanced entry points
  the README already links; whether they are fully retired is a call for whoever executes this
  task against how many external links point at them, not pre-decided here)
- Test: the manifest coverage test from Task 1 continues to pass; a new test asserts every manifest
  entry with `tier` matching an existing chapter has a non-empty `enFile` on disk with all four
  required headings present

This task is content work, not mechanism work, and is the largest single task in this plan by
volume. It is listed here for sequencing (it depends on Tasks 1–4 existing so the migrated content
is immediately checkable) but its actual authoring is expected to be split across several
sessions or lanes rather than done in one sitting — see the task items below, which file it as
several smaller, real items rather than one unbounded one.

- [ ] For each existing chapter, write the per-feature file with the four required headings (What
  it is for / How it works / From the CLI / From the UI), carrying the existing CLI-facing prose
  forward and adding the UI section every current chapter is missing — checked against the actual
  screen, not asserted.
- [ ] Re-run every worked command-and-output block against a fresh workspace before checking it in,
  per the global constraint above — no illustrative block.
- [ ] Confirm the manifest coverage test and the new heading-presence test both pass.

---

### Task 6: The literal-fact drift gates

**Files:**
- Create: `test/core/tutorial-facts.test.ts`
- Modify: whichever migrated tutorial files currently state the four checked facts, to state them
  in a form the test can extract (a labelled line, not prose the fact is buried inside)

**Interfaces:**
- Each check is independent and named for the fact it guards:
  ```ts
  test('the tutorial version matches package.json', () => { /* ... */ });
  test('the tutorial hook roster matches the registered hooks', () => { /* ... */ });
  test('the tutorial profile names match the accepted profiles', () => { /* ... */ });
  test('the tutorial tier budget numbers match the configured budgets', () => { /* ... */ });
  ```

- [ ] **Step 1: Write the failing tests**, each reading the relevant migrated tutorial file with a
  simple, documented extraction pattern (e.g. a line matching `` **Tested on:** my_context v(\S+) ``)
  and comparing the extracted value against the live source (`package.json`'s `version`, the hook
  names registered under `src/hooks/`, the profile names accepted by `src/core/config.ts`, the
  budget tier numbers in `src/core/config.ts`).

- [ ] **Step 2: Run it to make sure it fails** if the migrated content still carries the five
  DOCS-REVIEW findings (F4, F7, F8, F11, F14) — this step doubles as confirmation that Task 5's
  migration did not carry the stale facts forward unexamined.

- [ ] **Step 3: Fix the migrated tutorial text** so every extracted fact agrees with the live
  value, and land the tests.

- [ ] **Step 4: Run the full suite** and confirm the five DOCS-REVIEW findings this plan set out to
  make checkable are now guarded by a red test rather than sitting unaddressed under a screen that
  ticks them.

---

## What this plan does not schedule

- Writing Hebrew content for the full roster, and writing the remaining English tutorials the
  manifest names with no existing chapter to migrate. Both are real, ongoing content work, tracked
  as their own task items below rather than folded into Task 5's scope, because their size is not
  yet known until Task 1's manifest freezes the actual count.
- Widening the document manifest mechanism to the rest of `docs/` and `reports/` — `walk/25`'s
  scope, not this plan's.
