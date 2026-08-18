# Web UI Plan 2 of 3 — the command palette, Work, and Configure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the three screens where the UI meets writes without ever executing one — the command palette (read commands execute, write commands are composed and copied), Work (the pending-revision queue as per-field diffs, the draft queue, overlap detection at capture), and Configure (a validating `config.json` editor whose previews are computed by the real selector against the real corpus).

**Architecture:** Two new server modules (`src/ui/read-model-work.ts`, `src/ui/read-model-config.ts`) register routes through plan 1's `registerRoute` and therefore live inside the no-writes import graph; two core extractions (`revision-log.ts` grows the staleness decoration, `revision-diff.ts` takes the line diff out of the CLI view) exist so those modules never import `revision.ts` or `mutate.ts`. In the browser, one module (`lib/command.js`) owns command-string composition and quoting, one (`lib/palette-defs.js`) owns the command catalogue, and three screens render against `window.myctx`. Every write anywhere in these screens is composed, shown with the on-screen note, and copied — never executed.

**Tech Stack:** Node ≥ 24 built-ins only. No framework, no build step, no runtime dependency. Browser code is plain `.js` ES modules.

**Spec:** `docs/superpowers/specs/2026-08-16-web-ui-design.md` — the binding authority. This plan argues from it; executors read both.

**Mockup:** `docs/design/web-ui-mockup.html` — a static, owner-reviewed visual reference for every screen (open it in a browser). Good for layout, palette, and the intended rendering of the compose-don't-write treatment; its data is fabricated and several visible affordances are deliberately unimplemented. **The spec outranks it** — read `docs/design/web-ui-mockup.md` for what it is, what it is not, and the full divergence list before copying anything from it.

**Depends on (binding):** Plan 1, `docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md`, executed first. This plan consumes plan 1's **Produces** blocks exactly as published there: `registerRoute` / `ApiContext` / `JsonResult` / `RouteHandler` (`src/ui/routes.ts`), the security gate that fronts every route, `src/core/revision-log.ts` (`readLog`, `foldLog`, `pendingRevisionSummaries`, `pendingRevisionCounts`), the string tables (`src/ui/public/strings/{en,he}.js`, key parity enforced), `window.myctx = { api, t, session, onSessionChange, navigate }`, and the existing endpoints `/api/status`, `/api/doctor`, `/api/items`, `/api/item/:id`, `/api/help/:topic`, `/api/select|render|simulate`, `/api/sessions`, `/api/coverage`. No name from that surface is re-invented here.

**Scope split (binding):** This is plan 2 of 3.
- **Plan 1 (done before this):** server, security, `/api/select` with `seen`, Core / Navigate / Report / Learn, the static import-graph test.
- **Plan 2 (this document):** the command palette, Work (review queue + staged-revision diffs, draft queue, overlap detection at capture), Configure.
- **Plan 3 (not here):** Watch (audit live stream, status strip), Ask, the status line bridge (§4b).

---

## Global Constraints

- **Zero runtime dependencies.** Node 24 native TypeScript type-stripping, no build step, `erasableSyntaxOnly`, explicit `.ts` import extensions. No framework, no bundler, no CDN.
- **The UI executes no writes, anywhere.** No `/api` route may reach a mutating function. Enforced by a static import-graph test, not by discipline.
- **Never write a comment, message, doc or corpus item asserting a property the code does not have.** This project has 30+ recorded instances; several were introduced by tasks fixing other instances.
- **Nothing is ever dropped silently.** A field accepted and ignored is the one unacceptable failure.
- **Guarantee claims carry their condition in the same sentence** (`STD-guarantee-claims-carry-their-condition-in-the-same-sentence`).
- **Every change needs a test that fails without it.** `npm run mutate` refuses a dirty tree — commit first.
- `npm test`, `npx tsc --noEmit`, `npm run test:perf` clean; `git status --porcelain` clean.
- **Both documents, always** for any README change: `README.md` and `docs/README.he.md`.
- RTL is not retrofitted: logical CSS properties from the first stylesheet, one string table per language with a key-parity test.

---

## Verified facts this plan builds on

Every claim below was read in the working tree on branch `plan/web-ui-work` (based on `origin/plan/web-ui-server`, commit `20ed4f4`) before this plan was written. Where a fact could not be verified, the task says "establish by executing" instead of asserting it.

| Fact | Where verified |
|---|---|
| `promoteRevision` applies through `updateItem` with `origin: 'human'` hardcoded | `src/core/revision.ts:1119-1126` |
| `RevisionRecord { revisionId; itemId; changes; base; origin; stagedAt; state; settledAt; reason }` | `src/core/revision.ts:141-160` |
| `PendingRevision extends RevisionRecord` adds `current`, `changedSince: RevisionField[]`, `stale`, `itemMissing` | `src/core/revision.ts:162-176` |
| `REVISION_FIELDS = ['title','body','tags','extra']`; `RevisionField`; `RevisionValue = string \| string[] \| Record<string,string>` | `src/core/revision.ts:119-126` |
| `canonicalValue` (`:327`), `sameValue` (`:347`), `valuesOf` (`:362`), `fieldsOf` (`:377`) — all **private** to `revision.ts` | read |
| `decorate(ctx, record)` computes `current`/`changedSince`/`stale`/`itemMissing`; the only store call is `ctx.store.get(record.itemId)` | `src/core/revision.ts:650-668` |
| `foldLog` is terminal-state folding; a settled revision can never come back pending | `src/core/revision.ts:571-597` |
| Staleness is per field: `changedSince = fields.filter((f) => !sameValue(base[f], current[f]))` | `src/core/revision.ts:659` |
| `staleRefusal` names the moved fields and both values; `missingItemRefusal` names the gone item | `src/core/revision.ts:1052-1064`, `:1041-1050` |
| `mycontext review` subcommands and flags: `promote <id> [--scope][--always][--severity][--yes]`, `discard <id> [--yes]`, `promote-revision <id> [--revision REV-…][--force][--yes]`, `discard-revision <id> [--revision REV-…][--reason "…"][--yes]` | `src/cli/commands/review.ts:37-38`, `:78-88` |
| A promote/discard without `--revision` defaults to the **oldest** pending revision on the item | `src/cli/commands/review.ts:193` usage note, `src/core/revision.ts:998` (`pickPendingRevision`) |
| `lineDiff` (LCS, `MAX_CELLS` bound), `fieldDiff`, private `linesOf`, `DiffLine { mark: '-'\|'+'\|' '; text }` | `src/cli/commands/revision-view.ts:52-107`, `:66` |
| `revision-view.ts` value-imports `REVISION_FIELDS` from `revision.ts` (so importing it pulls `revision.ts` → `mutate.ts` into a runtime graph) | `src/cli/commands/revision-view.ts:1-6` |
| `resolveConfig` **throws** on: unknown profile (`Object.hasOwn(PROFILES, …)`), unknown category key, invalid prefix, invalid enum (`enumError` wording via `requireEnum`), invalid custom-category shape, invalid `enabled`/`tier`/`description` | `src/core/config.ts:308-445`, `:312`, `:214-228`, `:245-254`, `:273-281` |
| `resolveConfig` **silently ignores**: invalid `budgets` values (non-number/negative/NaN keep the default), non-string `watchedDocs` entries, and every unknown **top-level** key (only `profile`, `categories`, `budgets`, `watchedDocs` are read) | `src/core/config.ts:447-452`, `:454-456`, `:308-458` |
| `AGENT_EDITS = ['allow','review']`, `SCOPE_POLICIES = ['global','required','inert']` — exported, declaration order is user-facing | `src/core/config.ts:91-94` |
| `DEFAULT_BUDGETS = { pinned: 6000, jit: 6000, restored: 8000, index: 1200 }` | `src/core/config.ts:51` |
| `agentEditsFor(config,type)` / `scopePolicyFor(config,type)`, `Object.hasOwn`-guarded | `src/core/config.ts:138-142`, `:160-164` |
| `PROFILES` imported from `src/core/categories.ts`; `resolveConfig` builds `categories` with a null prototype | `src/core/config.ts:1`, `:334` |
| Config file is `<projectRoot>/config.json`; `resolveWorkspace` **throws** if it is not valid JSON | `src/core/workspace.ts:27-40` |
| The deny hook's config wording: "Configuration changes to `.my_context/config.json` are the user's to make — ask, do not edit" | `src/hooks/pre-tool-use.ts:96-97` |
| The fourteen deny rules, verbatim | `README.md:3967-3980` |
| `filterItems(items, filters, config)` — the ONE corpus filter behind `query_items` and `mycontext search`; `path` goes through `matchesScope`; `anyFilterSet` | `src/core/search.ts:25-59` |
| `core/search.ts` imports only `config.ts`, `paths.ts`, `select.ts`, `types.ts` — no `mutate.ts` | `src/core/search.ts:1-4` |
| `STATUSES` (`:385`) and `RELATION_TYPES` (`:1269`) live in **`src/core/mutate.ts`** — banned from the server graph | grepped |
| `Status = 'active'\|'draft'\|'superseded'\|'deprecated'\|'validated'`; `Tier = 'normative'\|'rationale'` | `src/core/types.ts:1-2` |
| `matchesAnyGlob(subject, patterns)` exported from `src/core/paths.ts:44` | grepped |
| `mycontext search` CLI validates `status`/`relation` against `STATUSES`/`RELATION_TYPES` and delegates the predicate to `filterItems`; default limit 50, truncation reported | `src/cli/commands/search.ts:1-14`, `:42-61`, `:99-117` |
| `mycontext add <category> <title> [--body <text>\|--file <path>] [--note <text>] [--scope "a/**,b/**"] [--tags "a,b"] [--severity hard\|soft] [--yes]` | `src/cli/index.ts:188-193` |
| `edit <id> [--title\|--body\|--scope\|--tags\|--severity\|--always\|--status\|--extra]`; `pin`/`unpin`/`harden`/`soften <id> [--yes]` | `src/cli/commands/edit.ts:751-755`, `:801-819`, `:894-899` |
| `supersede <id> --by <id>` (`supersede.ts:157-162`); `refresh <id>` (`refresh.ts:146-151`); `repair [--yes]` (`repair.ts:189-194`); `lesson-accept <id> <key>` / `lesson-discard <id> <key>` (`lesson.ts:342-354`) | read |
| Built-in (non-registry) commands: `init`, `add`, `list [category]`, `show <id>`, `rebuild`, `help [topic]`, `examples` | `src/cli/index.ts:62-75`, `:741-747` |
| Read/report commands registered: `status`, `doctor`, `decay`, `search`, `query`, `ingest-status` | `status.ts:492-497`, `doctor.ts:210-215`, `decay.ts:285-290`, `search.ts:233-238`, `query.ts:369-374`, `ingest.ts:356-361` |
| No overlap/similarity function exists anywhere in `src/` | `grep -rin "overlap\|similarity\|jaccard" src/` — only unrelated comments |
| `injection(item, config)` composes eligibility + tier + scope in `select`'s order | `src/cli/commands/injection.ts:42-44` (per plan 1's verified table) |
| `reviewQueue(items, type?)` — project-layer drafts | `src/core/select.ts:247` |

**Facts consumed from plan 1 as published interfaces** (they do not exist on this branch until plan 1 executes; their names are binding): `registerRoute` / `matchRoute` / `ApiContext` / `JsonResult` / `RouteHandler` (`src/ui/routes.ts`); `withStores`, `badRequest`, `unknownParams`, `parseSelectQuery` (private — Task 8 exports it) in `src/ui/read-model.ts`; `src/core/revision-log.ts` with `readLog`, `foldLog`, `pendingRevisionSummaries`, `pendingRevisionCounts` and the moved closure (`REVISION_PROTOCOL`, `LogLine`, `revisionDir`, `revisionLogPath`, `lastRowIndex`); `test/ui/no-writes.test.ts`; `test/ui/helpers.ts` (`startUiChild`, `redeemNonce`); the string tables and `window.myctx`.

---

## Design decisions this plan fixes (so no implementer has to guess)

1. **Plan-2 server code lives in two modules, both inside the no-writes graph.** `src/ui/read-model-work.ts` and `src/ui/read-model-config.ts` are imported by `server.ts` (each exports a `register…Routes()` function), so `test/ui/no-writes.test.ts` covers them automatically. Neither may import `revision.ts`, `mutate.ts`, or `cli/commands/*` (the CLI command modules import `mutate.ts` and each other freely — e.g. `search.ts:3`).
2. **One staleness implementation.** The per-field staleness decoration (`decorate`, `revision.ts:650`) moves to `revision-log.ts` as `decoratePending(record, item)` — its only store dependency is `ctx.store.get(id)` (`revision.ts:651`), which becomes a parameter. `revision.ts` calls the moved function; behaviour changes are none. Plan 1's Task 6 explicitly reserved this boundary for plan 2: "anything it needs beyond counts — decorated revisions, staleness — is plan 2's problem to solve on this same boundary."
3. **One diff implementation.** `lineDiff`, `DiffLine` and the private `linesOf` move from `cli/commands/revision-view.ts` to a new `src/core/revision-diff.ts` (with `linesOf` exported as `valueLines`); `revision-view.ts` imports them back. The server serves structured `DiffLine[]`s from the same LCS the terminal renders — not a browser re-implementation, which would be this project's most-repeated defect in a new medium. `revision-view.ts`'s value-import of `REVISION_FIELDS` also retargets to `revision-log.ts`, so nothing the server imports reaches `revision.ts`.
4. **Command strings are composed in exactly one place: the browser (`lib/command.js`).** The server returns data — ids, fields, diffs, verdicts — and never a command string, so quoting rules and the write-note treatment live once. (Plan 1's `repairCommandFor` already composes client-side; this is the same division.)
5. **The composed settlement command always carries `--revision`.** Without it, `promote-revision`/`discard-revision` settle the *oldest* pending revision (`pickPendingRevision`, `revision.ts:998`) — which may not be the one the human just read. The pasted line must settle exactly what was on screen.
6. **A stale revision composes the discard first; `--force` is a second, explicitly-labelled control.** The UI never adds `--force` by default. The force control's warning uses `staleRefusal`'s own vocabulary — the fields that moved, staged-against vs now — so the on-screen sentence and the CLI's refusal can never disagree about what force overwrites.
7. **POST is used where a body is a document** — `/api/overlap` (a draft capture) and `/api/config/check` / `/api/config/preview` (a candidate config). None touches disk; §2's "no POST that changes state on disk" and the import-graph test both hold; all three sit behind the full token gate (only `/api/handoff` is exempt, and that stays true).
8. **`/api/config` reads `config.json` fresh from disk on every call.** The file is the user's to edit while the server runs (`pre-tool-use.ts:96-97` declares it so); an editor seeded from the server's boot-time `ws.config` would compose a diff against text no longer in the file. Unparseable JSON is reported as a field (`parseError`), not a 500 — `resolveWorkspace` throws on it (`workspace.ts:32-40`), so this endpoint reads the file itself.
9. **The editor's strictness beyond `resolveConfig` is labelled as the editor's.** `resolveConfig` refuses enums, profiles, category keys and prefixes with exact wording — the editor surfaces those refusals verbatim. But it *silently* ignores invalid `budgets` values (`config.ts:449-452`), drops non-string `watchedDocs` entries (`:454-456`), and reads only four top-level keys (`:308-458`). `/api/config/check` reports each of those as a `dropped` finding of its own, worded as "the loader would silently ignore this" — never claimed to be a `resolveConfig` refusal, because it is not one.
10. **Enum lists the server cannot import are mirrored and test-pinned.** `STATUSES` and `RELATION_TYPES` live in `mutate.ts` (`:385`, `:1269`), which is banned from the server graph. `read-model-work.ts` declares local copies; a test imports `mutate.ts` (tests are outside the server graph) and asserts deep equality, so drift fails a test instead of shipping. `TIERS` in `read-model-config.ts` is pinned to the `Tier` union by a compile-time exhaustiveness check instead, since no runtime list exists anywhere.
11. **The glob tester composes `matchesAnyGlob` (`paths.ts:44`), deliberately.** Its question is "which files match this pattern" — a question about a *pattern*, which is exactly what `matchesAnyGlob` answers. The defect `select.ts:127-129` documents is using it to answer "which items govern this file"; that question stays with `matchesScope`/`injection()` everywhere in this plan too.
12. **Read commands in the palette execute by reaching the surface that already renders the answer** — navigation to an existing screen, or a fetch of an existing/new read endpoint. A read the UI cannot execute is not listed as a read. **`rebuild` is classified with the composed commands**: it rewrites `.index.db` on disk, and "no POST changes state on disk" includes the index — the same treatment plan 1's doctor screen gives `mycontext rebuild`.
13. **Overlap detection is a new pure function, labelled a heuristic.** No similarity rule exists to compose (verified by grep), so `overlapCandidates` is written fresh in `read-model-work.ts`, exported for direct testing, deterministic, and described in its comment as a capture-time hint — never as a dedup rule the corpus enforces.
14. **The Configure preview's selection half reuses plan 1's query grammar.** `parseSelectQuery` (private in `read-model.ts`) is exported and `/api/config/preview` takes the select context as query parameters with the candidate in the body — one grammar, one implementation, no second spelling of "session vs cold".

---

## File Structure

New files (created by this plan):

```
src/core/revision-diff.ts          # DiffLine, valueLines(field, value), lineDiff — moved from
                                   #   cli/commands/revision-view.ts; the ONE diff implementation
src/ui/read-model-work.ts          # apiRevisions, apiReviewQueue, apiSearch, apiGlob, apiOverlap
                                   #   + registerWorkRoutes(); mirrored STATUSES/RELATION_TYPES
src/ui/read-model-config.ts        # apiConfigGet, apiConfigCheck, apiConfigPreview
                                   #   + registerConfigRoutes()
src/ui/public/lib/command.js       # quoteArg, composeCommand — command-string composition, once
src/ui/public/lib/palette-defs.js  # the command catalogue + commandFor(def, values)
src/ui/public/lib/config-edit.js   # buildCandidate, renderConfigJson, changedPaths (pure)
src/ui/public/screens/work.js      # Work: revision diffs + draft queue + composed settlements
src/ui/public/screens/palette.js   # the command palette, incl. capture overlap + glob tester
src/ui/public/screens/configure.js # the validating config editor with real previews
test/core/revision-log-decorate.test.ts
test/core/revision-diff.test.ts
test/ui/read-model-work.test.ts
test/ui/read-model-config.test.ts
test/ui/palette-lib.test.ts        # command.js + palette-defs.js + config-edit.js (pure)
test/ui/plan2-e2e.test.ts          # every new route is behind the gate (spawned process)
```

Modified files:

```
src/core/revision-log.ts           # + moved value helpers + decoratePending + pendingRevisionViews (Task 1)
src/core/revision.ts               # imports the moved helpers; decorate() delegates (Task 1)
src/cli/commands/revision-view.ts  # imports lineDiff/valueLines from core/revision-diff.ts;
                                   #   REVISION_FIELDS from revision-log.ts (Task 2)
src/ui/read-model.ts               # export parseSelectQuery — one word (Task 6)
src/ui/server.ts                   # + import + call registerWorkRoutes()/registerConfigRoutes()
src/ui/public/app.js               # + SCREENS/NAV entries for work, palette, configure
src/ui/public/strings/en.js        # + every new key (each screen task adds its own)
src/ui/public/strings/he.js        # + the same keys, Hebrew (parity test enforces)
README.md, docs/README.he.md       # document the three screens (Task 12, both documents)
```

---

## Task 1: Move the staleness decoration to `revision-log.ts`

**Why:** the Work screen must show `current` vs `changes` per field, mark stale fields, and mark missing items — exactly what `decorate` (`revision.ts:650-668`) computes. But `revision.ts` imports `updateItem` at runtime, so the server may not import it. `decorate`'s only store dependency is one `ctx.store.get(record.itemId)` call (`revision.ts:651`); everything else is pure over the record and the item. The decoration moves to `revision-log.ts` with the item as a parameter; `revision.ts` delegates, so every existing caller and behaviour is untouched.

**Files:**
- Modify: `src/core/revision-log.ts` (add the moved helpers and two new functions)
- Modify: `src/core/revision.ts` (delete the moved code; import it back; `decorate` becomes a delegation)
- Test: `test/core/revision-log-decorate.test.ts`

**Interfaces:**
- Consumes: plan 1's `revision-log.ts` (`readLog`, `foldLog`, `LogLine`, `RevisionRecord` — plan 1's Task 6 moved `foldLog`'s closure, which includes the `RevisionRecord` shape it returns; establish in Step 1 exactly which of the following are already there and move only the remainder).
- Produces (the server and the Work read model import from `revision-log.ts` only):
  - Moved, verbatim, if not already moved by plan 1: `REVISION_FIELDS`, `RevisionField`, `RevisionValue`, `RevisionChanges`, `PendingRevision`, `canonicalValue` (`revision.ts:327`), `sameValue` (`:347`), `valuesOf` (`:362`), `fieldsOf` (`:377`). All exported from `revision-log.ts`; `revision.ts` re-imports and re-exports every previously-exported name so no existing caller changes.
  - New: `decoratePending(record: RevisionRecord, item: Item | null): PendingRevision` — the moved body of `decorate` with `ctx.store.get(...)` replaced by the `item` parameter.
  - New: `pendingRevisionViews(root: string, items: Item[]): PendingRevision[]` — `foldLog(readLog(root))` filtered to `state === 'pending'`, each decorated against `items` (a `Map` by id; an id not in `items` decorates as `itemMissing`).

- [ ] **Step 1: Establish what plan 1's Task 6 already moved, then write the failing test**

Open `src/core/revision-log.ts` as plan 1 left it and list which of the symbols above are already present (plan 1's move closure was established by executing, so the exact set is on disk, not in prose). Move only the remainder. Then write:

```ts
// test/core/revision-log-decorate.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decoratePending } from '../../src/core/revision-log.ts';
import type { Item } from '../../src/core/types.ts';

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 'RULE-x', type: 'rule', title: 'Old title', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'c', extra: {},
    body: 'Old body.', observations: [], relations: [],
    layer: 'project', filePath: 'items/RULE-x.md',
    ...overrides,
  };
}

const record = {
  revisionId: 'REV-abc', itemId: 'RULE-x',
  changes: { title: 'New title' }, base: { title: 'Old title' },
  origin: 'agent' as const, stagedAt: '2026-08-01T00:00:00.000Z',
  state: 'pending' as const, settledAt: null, reason: null,
};

test('a proposal whose base still matches the item is fresh', () => {
  const decorated = decoratePending(record, item());
  assert.deepEqual(decorated.current, { title: 'Old title' });
  assert.deepEqual(decorated.changedSince, []);
  assert.equal(decorated.stale, false);
  assert.equal(decorated.itemMissing, false);
});

test('a human edit to the very field the proposal rewrites makes it stale, per field', () => {
  const decorated = decoratePending(record, item({ title: 'Humanly changed' }));
  assert.deepEqual(decorated.changedSince, ['title']);
  assert.equal(decorated.stale, true);
});

test('an edit to a field the proposal does NOT touch leaves it fresh — staleness is per field', () => {
  const decorated = decoratePending(record, item({ body: 'A different body.' }));
  assert.deepEqual(decorated.changedSince, []);
  assert.equal(decorated.stale, false);
});

test('a missing item decorates as itemMissing with every field changed', () => {
  const decorated = decoratePending(record, null);
  assert.equal(decorated.itemMissing, true);
  assert.equal(decorated.stale, true);
  assert.deepEqual(decorated.changedSince, ['title']);
  assert.deepEqual(decorated.current, {});
});

test('tags compare as an unordered set — a reordering is not a change', () => {
  const tagRecord = {
    ...record, revisionId: 'REV-tags',
    changes: { tags: ['x', 'y', 'z'] }, base: { tags: ['b', 'a'] },
  };
  const decorated = decoratePending(tagRecord, item({ tags: ['a', 'b'] }));
  assert.deepEqual(decorated.changedSince, []); // ['b','a'] vs ['a','b'] — same set
});

test('pendingRevisionViews agrees with revision.ts pendingRevisions on a real staged log', () => {
  // Behaviour-parity proof for the move: stage through the REAL stageRevision,
  // then decorate through both paths and compare. Establish by executing: how
  // a MutationContext is built in existing revision tests (grep
  // test/core/revision*.test.ts for `stageRevision(`) and build the fixture
  // the same way — a real workspace with one item, one staged revision, one
  // human edit to make it stale. The assertion that must end up committed:
  //   assert.deepEqual(
  //     pendingRevisionViews(root, store.all()),
  //     pendingRevisions(ctx),
  //   );
  // fired once with a fresh and once with a stale revision. The test is not
  // done until both fire against a log stageRevision itself wrote. (Tests may
  // import revision.ts; only the SERVER graph may not.)
});
```

(The last test's commented assertion is the establish-by-executing point, exactly as plan 1's Task 6 handled the log-line shape: the fixture mechanics come from the existing revision tests; the parity assertion is the contract and must be committed firing.)

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/core/revision-log-decorate.test.ts`
Expected: FAIL — `decoratePending` is not exported.

- [ ] **Step 3: Move the code**

In `src/core/revision-log.ts`, append (moving each body verbatim from `revision.ts`; the doc comments travel with them):

```ts
// Appended to src/core/revision-log.ts (web-ui plan 2, Task 1). Everything
// here is moved verbatim from revision.ts except decoratePending, whose one
// store call became a parameter; revision.ts re-imports these symbols so its
// callers are untouched. The reason is the one this module exists for: the UI
// server's no-writes test bans revision.ts from its import graph, and the
// Work screen needs the staleness decoration.

export const REVISION_FIELDS = ['title', 'body', 'tags', 'extra'] as const;
export type RevisionField = (typeof REVISION_FIELDS)[number];
export type RevisionValue = string | string[] | Record<string, string>;
// RevisionChanges and RevisionRecord: already here if plan 1's closure moved
// them (foldLog returns RevisionRecord); otherwise moved now, verbatim.

export function fieldsOf(changes: RevisionChanges): RevisionField[] {
  return REVISION_FIELDS.filter((f) => changes[f] !== undefined);
}

export function canonicalValue(value: RevisionValue): unknown {
  if (Array.isArray(value)) return [...value].sort();
  if (typeof value === 'object') {
    return Object.keys(value).sort().map((key) => [key, value[key]]);
  }
  return value;
}

export function sameValue(a: RevisionValue | undefined, b: RevisionValue | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return JSON.stringify(canonicalValue(a)) === JSON.stringify(canonicalValue(b));
}

export function valuesOf(item: Item, changes: RevisionChanges): RevisionChanges {
  const out: RevisionChanges = {};
  if (changes.title !== undefined) out.title = item.title;
  if (changes.body !== undefined) out.body = item.body;
  if (changes.tags !== undefined) out.tags = [...item.tags];
  if (changes.extra !== undefined) {
    const base: Record<string, string> = {};
    for (const key of Object.keys(changes.extra)) {
      if (Object.hasOwn(item.extra, key)) base[key] = item.extra[key];
    }
    out.extra = base;
  }
  return out;
}

export interface PendingRevision extends RevisionRecord {
  state: 'pending';
  current: RevisionChanges;
  changedSince: RevisionField[];
  stale: boolean;
  itemMissing: boolean;
}

/** The moved body of revision.ts's decorate(): the item as it is NOW is a
 * parameter instead of a store lookup, which is the whole difference. */
export function decoratePending(record: RevisionRecord, item: Item | null): PendingRevision {
  const fields = fieldsOf(record.changes);
  if (!item) {
    return {
      ...record, state: 'pending', current: {}, changedSince: fields, stale: true, itemMissing: true,
    };
  }
  const current = valuesOf(item, record.changes);
  const changedSince = fields.filter((f) => !sameValue(record.base[f], current[f]));
  return {
    ...record,
    state: 'pending',
    current,
    changedSince,
    stale: changedSince.length > 0,
    itemMissing: false,
  };
}

/** The pending queue, decorated against a plain Item[] — the store-free shape
 * the UI server consumes. An itemId absent from `items` decorates as missing. */
export function pendingRevisionViews(root: string, items: Item[]): PendingRevision[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return foldLog(readLog(root))
    .filter((r) => r.state === 'pending')
    .map((r) => decoratePending(r, byId.get(r.itemId) ?? null));
}
```

(`Item` is imported as a type from `./types.ts`. If `RevisionChanges`/`RevisionRecord` are already in this file from plan 1, do not redeclare them — the Step 1 inventory decides.)

In `src/core/revision.ts`: delete the moved definitions (`REVISION_FIELDS`, `RevisionField`, `RevisionValue`, `PendingRevision`, `canonicalValue`, `sameValue`, `valuesOf`, `fieldsOf`, `decorate`), extend the existing plan-1 import from `./revision-log.ts` with the new names, keep re-exporting every previously-exported name (`REVISION_FIELDS`, `RevisionField`, `RevisionValue`, `PendingRevision` were exported; hold every caller harmless — `git grep -n "from './revision.ts'" src test` enumerates them), and replace `decorate`'s body:

```ts
function decorate(ctx: MutationContext, record: RevisionRecord): PendingRevision {
  return decoratePending(record, ctx.store.get(record.itemId) ?? null);
}
```

(If `ctx.store.get` already returns `Item | null`, drop the `?? null` — establish its exact return type by reading `store.get` when implementing.)

- [ ] **Step 4: Run the new test and the whole suite**

Run: `node --test test/core/revision-log-decorate.test.ts && npm test && npx tsc --noEmit`
Expected: all green. The full suite is the proof the move changed nothing — every revision test still passes through the delegating `decorate`.

- [ ] **Step 5: Commit**

```bash
git add src/core/revision-log.ts src/core/revision.ts test/core/revision-log-decorate.test.ts
git commit -m "refactor(revision): move the per-field staleness decoration to revision-log so a no-writes surface can render the queue"
```

---

## Task 2: Extract the line diff to `src/core/revision-diff.ts`

**Why:** the review queue's whole justification is the diff (spec §2: "the diff is the capability; the approval is a paste"). The LCS diff exists (`lineDiff`, `revision-view.ts:79-107`) and must not be written a second time in the browser — but `revision-view.ts` value-imports `REVISION_FIELDS` from `revision.ts` (`revision-view.ts:1-5`), so the server cannot import it. The diff and the value-to-lines rendering move to core; the CLI view imports them back.

**Files:**
- Create: `src/core/revision-diff.ts`
- Modify: `src/cli/commands/revision-view.ts` (delete the moved code; import it; retarget `REVISION_FIELDS` and the revision types to `revision-log.ts`)
- Test: `test/core/revision-diff.test.ts`

**Interfaces:**
- Consumes: `RevisionField`, `RevisionValue` from `revision-log.ts` (Task 1).
- Produces (the Work read model imports from here):
  - `interface DiffLine { mark: '-' | '+' | ' '; text: string }` — exported (it was private, `revision-view.ts:66`).
  - `lineDiff(from: string[], to: string[]): DiffLine[]` — moved verbatim, `MAX_CELLS` bound included.
  - `valueLines(field: RevisionField, value: RevisionValue | undefined): string[] | null` — the moved `linesOf`, renamed at export (tags one sorted comma-joined line; extra one line per sorted key; strings split on `\n`; `undefined` → `null`).

- [ ] **Step 1: Write the failing test**

```ts
// test/core/revision-diff.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineDiff, valueLines } from '../../src/core/revision-diff.ts';

test('lineDiff keeps an unchanged line as context between changes', () => {
  assert.deepEqual(lineDiff(['a', 'same', 'b'], ['x', 'same', 'y']), [
    { mark: '-', text: 'a' },
    { mark: '+', text: 'x' },
    { mark: ' ', text: 'same' },
    { mark: '-', text: 'b' },
    { mark: '+', text: 'y' },
  ]);
});

test('lineDiff of equal inputs is all context; of disjoint inputs, all -/+', () => {
  assert.deepEqual(lineDiff(['a'], ['a']), [{ mark: ' ', text: 'a' }]);
  assert.deepEqual(lineDiff(['a'], ['b']), [
    { mark: '-', text: 'a' }, { mark: '+', text: 'b' },
  ]);
});

test('valueLines renders tags sorted on one line and extra one line per sorted key', () => {
  assert.deepEqual(valueLines('tags', ['b', 'a']), ['a, b']);
  assert.deepEqual(valueLines('tags', []), ['(no tags)']);
  assert.deepEqual(valueLines('extra', { z: '1', a: '2' }), ['a: 2', 'z: 1']);
  assert.deepEqual(valueLines('body', 'one\ntwo'), ['one', 'two']);
  assert.equal(valueLines('title', undefined), null);
});

test('past the cell bound the diff degrades to whole-block replacement, never truncation', () => {
  const big = Array.from({ length: 600 }, (_, i) => `line ${i}`);
  const out = lineDiff(big, [...big]); // 600*600 = 360k cells > MAX_CELLS (250k)
  assert.equal(out.length, 1200); // every line of both sides is still present
  assert.ok(out.every((l) => l.mark !== ' '));
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/core/revision-diff.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Move the code**

Create `src/core/revision-diff.ts`: the module docstring says it was extracted from `cli/commands/revision-view.ts` (web-ui plan 2, Task 2) so the UI server can serve the same LCS diff the terminal prints without importing the CLI view. Then paste, verbatim from `revision-view.ts`: the `DiffLine` interface (now `export`ed), `MAX_CELLS`, `lineDiff`, and `linesOf` renamed to `export function valueLines` — body unchanged, doc comments travelling with them. Imports: `import type { RevisionField, RevisionValue } from './revision-log.ts';`.

In `src/cli/commands/revision-view.ts`: delete the moved definitions; add `import { lineDiff, valueLines, type DiffLine } from '../../core/revision-diff.ts';`; replace the internal `linesOf(` call sites with `valueLines(`; change the first import so `REVISION_FIELDS` and the revision types come from `'../../core/revision-log.ts'` (they live there since Task 1). Keep `fieldDiff`, `markedLines`, `renderRevision`, `renderSettled` exactly as they are — the CLI rendering is untouched.

- [ ] **Step 4: Run the new test and the whole suite**

Run: `node --test test/core/revision-diff.test.ts && npm test && npx tsc --noEmit`
Expected: green — the review CLI's own tests are the proof the move changed nothing.

- [ ] **Step 5: Commit**

```bash
git add src/core/revision-diff.ts src/cli/commands/revision-view.ts test/core/revision-diff.test.ts
git commit -m "refactor(review): extract the LCS diff to core so the UI serves the same diff the terminal prints"
```

---

## Task 3: Work read model — `/api/revisions` and `/api/review-queue`

**Files:**
- Create: `src/ui/read-model-work.ts`
- Modify: `src/ui/server.ts` (import + call `registerWorkRoutes()` beside `registerReadRoutes()`)
- Test: `test/ui/read-model-work.test.ts`

**Interfaces:**
- Consumes: `pendingRevisionViews`, `pendingRevisionCounts`, `PendingRevision`, `RevisionField` (revision-log.ts, Task 1), `lineDiff`, `valueLines`, `DiffLine` (revision-diff.ts, Task 2), `reviewQueue` (`select.ts:247`), `injection` (`cli/commands/injection.ts:42`), plan 1's `withStores`, `badRequest`, `unknownParams` (`read-model.ts`), `registerRoute` / `ApiContext` / `JsonResult` (`routes.ts`).
- Produces:
  - `registerWorkRoutes(): void` — registers every route this module owns; called once from `server.ts`. All routes sit behind the plan-1 security gate by construction; none is `kind: 'stream'`.
  - `apiRevisions(ws: Workspace, url: URL): JsonResult` — `GET /api/revisions` →

    ```ts
    {
      counts: { revisions: number; items: number };   // pendingRevisionCounts — the ONE spelling
      revisions: {
        revisionId: string; itemId: string; itemTitle: string | null;
        origin: string; stagedAt: string;
        stale: boolean; itemMissing: boolean; changedSince: RevisionField[];
        fields: {
          field: RevisionField;
          changed: boolean;          // this field is in changedSince — staleness is per field (spec §4)
          noCurrent: boolean;        // no current text to diff against (item missing / extra key absent)
          diff: DiffLine[];          // lineDiff(current lines, proposed lines) — the SAME LCS the CLI prints
        }[];
      }[];
    }
    ```

    Per field, `diff = lineDiff(valueLines(field, current[field]) ?? [], valueLines(field, changes[field]) ?? [])`; when `current[field]` is `undefined`, `noCurrent` is true and the client renders its own labelled placeholder — the server never invents a "(not set)" line the CLI would not print.
  - `apiReviewQueue(ws: Workspace, url: URL): JsonResult` — `GET /api/review-queue` → `{ drafts: { id; type; title; severity; always; scope; origin; injected; phrase }[] }` — `reviewQueue(items)` (the ONE project-layer-drafts definition), each with its `injection()` verdict so the screen can say what promotion would put in force. No parameters accepted on either endpoint.

- [ ] **Step 1: Write the failing tests**

```ts
// test/ui/read-model-work.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { apiRevisions, apiReviewQueue } from '../../src/ui/read-model-work.ts';

/** A real workspace built through the real CLI (plan 1's fixture pattern). */
function workspace(): { dir: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-work-'));
  runCli(['init'], dir, () => {});
  runCli(['add', 'rule', 'Always use POSIX paths', '--scope', 'src/**', '--body', 'Use POSIX.'], dir, () => {});
  runCli(['add', 'rule', 'Pin me', '--always', '--body', 'Pinned body.'], dir, () => {});
  return { dir, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('/api/revisions: empty log answers zero counts and an empty list', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiRevisions(ws, new URL('http://x/api/revisions'));
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { counts: { revisions: 0, items: 0 }, revisions: [] });
  } finally { done(); }
});

test('/api/revisions: a staged revision arrives as a per-field diff; a human edit marks it stale', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    // Stage through the REAL staging path. Establish by executing (as Task 1
    // did): build the MutationContext the way test/core/revision*.test.ts
    // builds one, and stage a body change against the POSIX rule through the
    // real stageRevision (read its input shape at revision.ts:906 when
    // implementing) — so this test reads a log the product wrote, not one the
    // test invented. Proposed body: 'Use POSIX paths everywhere.'
    const fresh = apiRevisions(ws, new URL('http://x/api/revisions'));
    const body = fresh.body as {
      counts: { revisions: number; items: number };
      revisions: {
        itemId: string; stale: boolean; itemTitle: string | null;
        fields: { field: string; changed: boolean; diff: { mark: string; text: string }[] }[];
      }[];
    };
    assert.equal(body.counts.revisions, 1);
    const rev = body.revisions[0];
    assert.equal(rev.stale, false);
    assert.equal(rev.itemTitle, 'Always use POSIX paths');
    const bodyField = rev.fields.find((f) => f.field === 'body');
    assert.ok(bodyField);
    assert.ok(bodyField!.diff.some((l) => l.mark === '-' && l.text === 'Use POSIX.'));
    assert.ok(bodyField!.diff.some((l) => l.mark === '+' && l.text === 'Use POSIX paths everywhere.'));

    // A human edit to the same field, via the real CLI:
    runCli(['edit', rev.itemId, '--body', 'Humanly rewritten.', '--yes'], dir, () => {});
    const after = apiRevisions(ws, new URL('http://x/api/revisions'));
    const staleRev = (after.body as typeof body).revisions[0];
    assert.equal(staleRev.stale, true);
    assert.equal(staleRev.fields.find((f) => f.field === 'body')?.changed, true);
  } finally { done(); }
});

test('/api/review-queue lists project-layer drafts with their injection verdicts', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const empty = apiReviewQueue(ws, new URL('http://x/api/review-queue'));
    assert.deepEqual(empty.body, { drafts: [] }); // CLI adds stamp origin human → active

    // A draft arrives the way real drafts arrive: a non-human origin captured
    // through the trustedStatus gate. Establish by executing how existing
    // tests create an agent-origin draft (grep test/ for "origin: 'agent'"
    // beside createItem) and create one; then the committed assertions:
    //   const result = apiReviewQueue(ws, new URL('http://x/api/review-queue'));
    //   const drafts = (result.body as { drafts: { id: string; injected: boolean }[] }).drafts;
    //   assert.equal(drafts.length, 1);
    //   assert.equal(drafts[0].injected, false); // a draft is in no injection tier
  } finally { done(); }
});

test('both endpoints refuse unknown parameters', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    assert.equal(apiRevisions(ws, new URL('http://x/api/revisions?full=1')).status, 400);
    assert.equal(apiReviewQueue(ws, new URL('http://x/api/review-queue?type=rule')).status, 400);
  } finally { done(); }
});
```

(Both establish-by-executing notes are real instructions, not placeholders: the fixture mechanics are read out of the existing revision and mutate tests, and the commented assertions must be committed firing.)

- [ ] **Step 2: Run and see them fail**

Run: `node --test test/ui/read-model-work.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/ui/read-model-work.ts
import { injection } from '../cli/commands/injection.ts';
import {
  pendingRevisionCounts, pendingRevisionViews, REVISION_FIELDS,
  type PendingRevision, type RevisionField,
} from '../core/revision-log.ts';
import { lineDiff, valueLines, type DiffLine } from '../core/revision-diff.ts';
import { reviewQueue } from '../core/select.ts';
import type { Item } from '../core/types.ts';
import type { Workspace } from '../core/workspace.ts';
import { badRequest, unknownParams, withStores } from './read-model.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';

/**
 * The Work read model (web-ui plan 2): the pending-revision queue as
 * structured per-field diffs, and the draft queue. Everything here is a READ.
 * The settlements a human makes from this data — promote-revision, discard-
 * revision, review promote/discard — are composed in the browser
 * (lib/command.js) and pasted into the user's own shell; no function in this
 * module, or reachable from it, mutates anything, and test/ui/no-writes.test.ts
 * enforces that over the whole import graph.
 *
 * This module imports revision-LOG and revision-DIFF, never revision.ts:
 * revision.ts imports updateItem at runtime, and one import here would put a
 * mutating function inside the server's graph.
 */

interface FieldDiff {
  field: RevisionField;
  changed: boolean;
  noCurrent: boolean;
  diff: DiffLine[];
}

function fieldDiffs(rev: PendingRevision): FieldDiff[] {
  const out: FieldDiff[] = [];
  for (const field of REVISION_FIELDS) {
    if (rev.changes[field] === undefined) continue;
    const before = valueLines(field, rev.current[field]);
    const after = valueLines(field, rev.changes[field]) ?? [];
    out.push({
      field,
      changed: rev.changedSince.includes(field),
      // No current text to diff against (item missing, or an extra key the
      // item never had). The CLIENT labels it; the server invents no line.
      noCurrent: before === null,
      diff: lineDiff(before ?? [], after),
    });
  }
  return out;
}

export function apiRevisions(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  if (!ws.projectRoot) return { status: 404, body: { error: 'no workspace here' } };
  const projectRoot = ws.projectRoot;
  return withStores(ws, (store) => {
    const items = store.all();
    const titles = new Map(items.map((i) => [i.id, i.title]));
    const pending = pendingRevisionViews(projectRoot, items);
    return {
      status: 200,
      body: {
        counts: pendingRevisionCounts(pending),
        revisions: pending.map((rev) => ({
          revisionId: rev.revisionId,
          itemId: rev.itemId,
          itemTitle: titles.get(rev.itemId) ?? null,
          origin: rev.origin,
          stagedAt: rev.stagedAt,
          stale: rev.stale,
          itemMissing: rev.itemMissing,
          changedSince: rev.changedSince,
          fields: fieldDiffs(rev),
        })),
      },
    };
  });
}

export function apiReviewQueue(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  return withStores(ws, (store) => {
    const drafts = reviewQueue(store.all());
    return {
      status: 200,
      body: {
        drafts: drafts.map((i: Item) => {
          const verdict = injection(i, ws.config);
          return {
            id: i.id, type: i.type, title: i.title, severity: i.severity,
            always: i.always, scope: i.scope, origin: i.origin,
            injected: verdict.injected, phrase: verdict.phrase,
          };
        }),
      },
    };
  });
}

export function registerWorkRoutes(): void {
  const json = (fn: (ws: Workspace, url: URL) => JsonResult) =>
    ({ kind: 'json' as const, handle: (ctx: ApiContext) => fn(ctx.ws, ctx.url) });
  registerRoute('GET', '/api/revisions', json(apiRevisions));
  registerRoute('GET', '/api/review-queue', json(apiReviewQueue));
  // Tasks 4 and 5 add their registrations here.
}
```

In `src/ui/server.ts`: add `import { registerWorkRoutes } from './read-model-work.ts';` and, in the once-only block that calls `registerReadRoutes()`, call `registerWorkRoutes();` beside it.

- [ ] **Step 4: Run the tests, the suite, and — decisively — the no-writes test**

Run: `node --test test/ui/read-model-work.test.ts && node --test test/ui/no-writes.test.ts && npm test && npx tsc --noEmit`
Expected: all green. The no-writes test now walks `read-model-work.ts` and everything it imports (`revision-log.ts`, `revision-diff.ts`, `injection.ts`); its passing is the proof this task's imports stayed on the right side of the boundary.

- [ ] **Step 5: Commit**

```bash
git add src/ui/read-model-work.ts src/ui/server.ts test/ui/read-model-work.test.ts
git commit -m "feat(ui): revisions and review-queue read model — the diff is served, the approval is composed"
```

---

## Task 4: Work read model — `/api/search` and `/api/glob`

The palette's read execution of `mycontext search`, and its live glob tester.

**Files:**
- Modify: `src/ui/read-model-work.ts`
- Test: extend `test/ui/read-model-work.test.ts`

**Interfaces:**
- Consumes: `filterItems`, `anyFilterSet` (`core/search.ts:38`, `:57`), `matchesAnyGlob` (`core/paths.ts:44`), `listRepoFiles` (`doctor/checks.ts:72`), `injection`.
- Produces:
  - `apiSearch(ws, url): JsonResult` — `GET /api/search?text=&type=&tag=&path=&status=&relation=&limit=` → `{ items: { id; type; title; status; always; scope; injected; phrase }[]; total: number; truncated: boolean }`. The predicate is `filterItems` — the ONE filter behind `query_items` and `mycontext search` (`core/search.ts:7-24`); this endpoint is its third caller, not a fourth spelling. At least one filter required (`anyFilterSet`, mirroring `search.ts:56`); default limit 50 (`search.ts:61`), truncation reported, never silent; `status`/`relation` validated against the mirrored enum lists below; `type` validated against `Object.keys(ws.config.categories)` (`Object.hasOwn`-safe: the map is null-prototype, `config.ts:334`).
  - `apiGlob(ws, url): JsonResult` — `GET /api/glob?pattern=a/**,b/**` → `{ patterns: string[]; total: number; sample: string[]; fileWalkTruncated: boolean }`. `pattern` is comma-separated exactly as `--scope` takes it (`index.ts:190`); matching is `matchesAnyGlob(file, patterns)` over `listRepoFiles(repoRoot)`; `sample` is the first 200 matches with `total` the real count. **This is the one legitimate `matchesAnyGlob` call in the UI**: the question is "which files match this pattern" — a question about a pattern the user is composing, not about which items govern a file. The govern question stays with `matchesScope`/`injection()` (the defect `select.ts:127-129` documents by name), and the module comment says so at the call site.
  - `SEARCH_STATUSES`, `SEARCH_RELATION_TYPES` — exported local mirrors of `STATUSES` (`mutate.ts:385`) and `RELATION_TYPES` (`mutate.ts:1269`), which the server cannot import (mutate.ts is banned from its graph). A test below pins each mirror to the original, so drift fails a test instead of shipping.

- [ ] **Step 1: Write the failing tests** (append to `test/ui/read-model-work.test.ts`)

```ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { apiSearch, apiGlob, SEARCH_STATUSES, SEARCH_RELATION_TYPES } from '../../src/ui/read-model-work.ts';
import { STATUSES, RELATION_TYPES } from '../../src/core/mutate.ts'; // the TEST may import mutate.ts; the server may not

test('the mirrored enum lists equal the originals in mutate.ts — drift fails here, not in production', () => {
  assert.deepEqual([...SEARCH_STATUSES].sort(), [...STATUSES].sort());
  assert.deepEqual([...SEARCH_RELATION_TYPES].sort(), [...RELATION_TYPES].sort());
});

test('/api/search filters through filterItems and reports truncation', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const byText = apiSearch(ws, new URL('http://x/api/search?text=POSIX'));
    assert.equal(byText.status, 200);
    const body = byText.body as { items: { id: string; phrase: string }[]; total: number; truncated: boolean };
    assert.equal(body.total, 1);
    assert.equal(body.truncated, false);
    assert.equal(typeof body.items[0].phrase, 'string');

    // path goes through matchesScope, so the UNSCOPED pinned rule matches too:
    const byPath = apiSearch(ws, new URL('http://x/api/search?path=src/a.ts'));
    assert.equal((byPath.body as { total: number }).total, 2);

    const limited = apiSearch(ws, new URL('http://x/api/search?path=src/a.ts&limit=1'));
    const lim = limited.body as { items: unknown[]; total: number; truncated: boolean };
    assert.equal(lim.items.length, 1);
    assert.equal(lim.total, 2);
    assert.equal(lim.truncated, true);
  } finally { done(); }
});

test('/api/search refuses: no filter, bad enums, unknown category, unknown params, bad limit', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    for (const bad of [
      '',                       // no filter at all — "everything" is `list`, refused as the CLI refuses it
      'status=nope&text=x',     // invalid status
      'relation=nope&text=x',   // invalid relation
      'type=nope',              // unknown category under this config
      'text=x&sesion=1',        // unknown parameter
      'text=x&limit=0',         // limit must be a positive integer
      'text=x&limit=abc',
    ]) {
      const result = apiSearch(ws, new URL(`http://x/api/search?${bad}`));
      assert.equal(result.status, 400, bad);
    }
  } finally { done(); }
});

test('/api/glob matches files with matchesAnyGlob and reports the real total', () => {
  const { dir, done } = workspace();
  try {
    mkdirSync(path.join(dir, 'src'), { recursive: true });
    writeFileSync(path.join(dir, 'src', 'a.ts'), '');
    writeFileSync(path.join(dir, 'src', 'b.ts'), '');
    writeFileSync(path.join(dir, 'top.md'), '');
    const ws = resolveWorkspace(dir);
    const result = apiGlob(ws, new URL('http://x/api/glob?pattern=src/**'));
    assert.equal(result.status, 200);
    const body = result.body as { patterns: string[]; total: number; sample: string[] };
    assert.deepEqual(body.patterns, ['src/**']);
    assert.equal(body.total, 2);
    assert.ok(body.sample.includes('src/a.ts') && body.sample.includes('src/b.ts'));
    assert.ok(!body.sample.includes('top.md'));

    assert.equal(apiGlob(ws, new URL('http://x/api/glob')).status, 400);           // pattern required
    assert.equal(apiGlob(ws, new URL('http://x/api/glob?pattern=')).status, 400);  // empty refused
    assert.equal(apiGlob(ws, new URL('http://x/api/glob?pattern=src/**&x=1')).status, 400);
  } finally { done(); }
});
```

- [ ] **Step 2: Run and see the new tests fail**

Run: `node --test test/ui/read-model-work.test.ts`
Expected: the new tests FAIL (not exported); the Task 3 tests still pass.

- [ ] **Step 3: Implement** (append to `src/ui/read-model-work.ts`; add imports: `anyFilterSet, filterItems, type ItemFilters` from `../core/search.ts`, `matchesAnyGlob` from `../core/paths.ts`, `listRepoFiles` from `../doctor/checks.ts`, `path` from `node:path`, `type Status` from `../core/types.ts`)

```ts
/**
 * Mirrors of STATUSES (mutate.ts:385) and RELATION_TYPES (mutate.ts:1269).
 * The server's import graph bans mutate.ts (test/ui/no-writes.test.ts), so
 * these are declared here and PINNED by a test that imports the originals —
 * tests are outside the banned graph — and asserts equality. A new status or
 * relation type added there fails that test here rather than silently
 * refusing valid searches.
 */
export const SEARCH_STATUSES: Status[] = ['active', 'draft', 'superseded', 'deprecated', 'validated'];
export const SEARCH_RELATION_TYPES: string[] = [
  'derived_from', 'constrains', 'supersedes', 'blocks',
  'mitigates', 'refines', 'relates_to', 'links_to',
];
// (Copy the exact RELATION_TYPES entries from mutate.ts:1269-1272 when
// implementing — the list above was read from that file, and the pinning test
// is what guarantees the copy is faithful on the day it is committed.)

const SEARCH_PARAMS = ['text', 'type', 'tag', 'path', 'status', 'relation', 'limit'];
const SEARCH_DEFAULT_LIMIT = 50; // the CLI's own cap (cli/commands/search.ts:61)

export function apiSearch(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, SEARCH_PARAMS);
  if (bad) return badRequest(bad);

  const status = url.searchParams.get('status');
  if (status !== null && !SEARCH_STATUSES.includes(status as Status)) {
    return badRequest(`status must be one of ${SEARCH_STATUSES.join(', ')} (got ${JSON.stringify(status)})`);
  }
  const relation = url.searchParams.get('relation');
  if (relation !== null && !SEARCH_RELATION_TYPES.includes(relation)) {
    return badRequest(`relation must be one of ${SEARCH_RELATION_TYPES.join(', ')} (got ${JSON.stringify(relation)})`);
  }
  const type = url.searchParams.get('type');
  if (type !== null && !Object.hasOwn(ws.config.categories, type)) {
    return badRequest(
      `unknown category ${JSON.stringify(type)} — this config declares: ` +
      `${Object.keys(ws.config.categories).join(', ')}`);
  }
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? SEARCH_DEFAULT_LIMIT : Number(rawLimit);
  if (!Number.isInteger(limit) || limit <= 0) {
    return badRequest(`limit must be a positive integer (got ${JSON.stringify(rawLimit)})`);
  }

  const filters: ItemFilters = {
    text: url.searchParams.get('text'),
    type,
    tag: url.searchParams.get('tag'),
    path: url.searchParams.get('path'),
    status: status as Status | null,
    relation,
  };
  if (!anyFilterSet(filters)) {
    return badRequest(
      'at least one filter is required — an all-absent filter matches the whole corpus, ' +
      'which is /api/items, not a search (the CLI refuses the same way)');
  }

  return withStores(ws, (store) => {
    const matched = filterItems(store.all(), filters, ws.config);
    return {
      status: 200,
      body: {
        items: matched.slice(0, limit).map((i) => {
          const verdict = injection(i, ws.config);
          return {
            id: i.id, type: i.type, title: i.title, status: i.status,
            always: i.always, scope: i.scope,
            injected: verdict.injected, phrase: verdict.phrase,
          };
        }),
        total: matched.length,
        truncated: matched.length > limit,
      },
    };
  });
}

const GLOB_SAMPLE_CAP = 200;

export function apiGlob(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['pattern']);
  if (bad) return badRequest(bad);
  const raw = url.searchParams.get('pattern');
  const patterns = (raw ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '');
  if (patterns.length === 0) {
    return badRequest('pattern=<glob>[,<glob>…] is required — the same comma form --scope takes');
  }
  if (!ws.projectRoot) return { status: 404, body: { error: 'no workspace here' } };
  const repoRoot = path.dirname(ws.projectRoot);
  const files = listRepoFiles(repoRoot);
  // matchesAnyGlob is CORRECT here and would be the documented defect one
  // question over: this asks "which files match this pattern" — a question
  // about the pattern being composed. "Which items govern this file" stays
  // with matchesScope/injection() (select.ts:127-129 names the difference).
  const matches = files.filter((f) => matchesAnyGlob(f, patterns));
  return {
    status: 200,
    body: {
      patterns,
      total: matches.length,
      sample: matches.slice(0, GLOB_SAMPLE_CAP),
      fileWalkTruncated: files.length >= 20_000, // listRepoFiles' own bound (doctor/checks.ts:43)
    },
  };
}
```

And in `registerWorkRoutes()` add:

```ts
  registerRoute('GET', '/api/search', json(apiSearch));
  registerRoute('GET', '/api/glob', json(apiGlob));
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test test/ui/read-model-work.test.ts && node --test test/ui/no-writes.test.ts && npx tsc --noEmit`
Expected: PASS — including the enum-pinning test, which is the faithfulness proof for the mirrors.

- [ ] **Step 5: Commit**

```bash
git add src/ui/read-model-work.ts test/ui/read-model-work.test.ts
git commit -m "feat(ui): search and glob-tester read model with test-pinned enum mirrors"
```

---

## Task 5: Overlap detection at capture — `POST /api/overlap`

Spec §4 (Work): surface two items saying nearly the same thing **before** the second is filed; `type` is fixed at creation, so a duplicate under the wrong category cannot be cleanly undone. No similarity function exists anywhere in `src/` (verified by grep), so this is a new pure function — written once, exported for direct testing, and documented as a capture-time heuristic rather than a corpus rule.

**Files:**
- Modify: `src/ui/read-model-work.ts`
- Test: extend `test/ui/read-model-work.test.ts`

**Interfaces:**
- Consumes: `withStores`, `injection`.
- Produces:
  - `overlapScore(draft: { title: string; body: string }, item: Item): number` — pure, deterministic, 0..1. Word-set comparison: tokens are lowercased alphanumeric runs of length ≥ 3 over title+body; score is `max(jaccard, 0.8 × containment)` so a short draft that is a subset of a long item still surfaces.
  - `apiOverlap(ws, url, body): JsonResult` — `POST /api/overlap` with JSON body `{ title: string; body?: string }` → `{ candidates: { id; type; title; score; injected; phrase }[] }` — every non-superseded item scoring ≥ 0.2, highest first, capped at 5. A malformed body is 400 naming the field. (POST because a draft body exceeds URL limits; it reads the store and writes nothing — §2's "no POST changes state on disk" holds, and the import-graph test watches this module.)

- [ ] **Step 1: Write the failing tests** (append to `test/ui/read-model-work.test.ts`)

```ts
import { overlapScore, apiOverlap } from '../../src/ui/read-model-work.ts';

test('overlapScore is high for near-duplicates, low for unrelated text, and deterministic', () => {
  const posix = {
    id: 'RULE-p', type: 'rule', title: 'Always use POSIX paths', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'c', extra: {},
    body: 'Use POSIX paths in every module.', observations: [], relations: [],
    layer: 'project', filePath: 'items/RULE-p.md',
  } as const;
  const near = overlapScore({ title: 'Use POSIX paths always', body: 'POSIX paths in every module.' }, posix);
  const far = overlapScore({ title: 'Rotate the signing key quarterly', body: 'Key rotation cadence.' }, posix);
  assert.ok(near > 0.5, `near-duplicate scored ${near}`);
  assert.ok(far < 0.2, `unrelated scored ${far}`);
  assert.equal(near, overlapScore({ title: 'Use POSIX paths always', body: 'POSIX paths in every module.' }, posix));
});

test('/api/overlap returns scored candidates and refuses a malformed body', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const url = new URL('http://x/api/overlap');
    const result = apiOverlap(ws, url, { title: 'Always use POSIX paths', body: 'Use POSIX.' });
    assert.equal(result.status, 200);
    const candidates = (result.body as { candidates: { id: string; score: number }[] }).candidates;
    assert.ok(candidates.length >= 1);
    assert.equal(typeof candidates[0].score, 'number');
    // Highest first:
    for (let i = 1; i < candidates.length; i++) {
      assert.ok(candidates[i - 1].score >= candidates[i].score);
    }

    assert.equal(apiOverlap(ws, url, { body: 'no title' }).status, 400);
    assert.equal(apiOverlap(ws, url, 'not an object').status, 400);
    assert.equal(apiOverlap(ws, url, undefined).status, 400);
  } finally { done(); }
});
```

- [ ] **Step 2: Run and see them fail**

Run: `node --test test/ui/read-model-work.test.ts`
Expected: new tests FAIL.

- [ ] **Step 3: Implement** (append to `src/ui/read-model-work.ts`)

```ts
/**
 * Capture-time overlap detection (spec §4, Work): a HEURISTIC hint that two
 * texts say nearly the same thing, shown before the second is filed — never a
 * dedup rule the corpus enforces, and the screen's wording says "may already
 * say this", not "duplicate". No similarity function existed anywhere in src/
 * when this was written (grepped); this is the one, kept deliberately simple
 * and deterministic: lowercase word sets (runs of [a-z0-9], length >= 3),
 * jaccard for symmetric similarity, containment (scaled 0.8) so a short
 * draft that is a subset of a long item still surfaces.
 */
function overlapTokens(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length >= 3));
}

export function overlapScore(draft: { title: string; body: string }, item: Item): number {
  const a = overlapTokens(`${draft.title}\n${draft.body}`);
  const b = overlapTokens(`${item.title}\n${item.body}`);
  if (a.size === 0 || b.size === 0) return 0;
  let common = 0;
  for (const w of a) if (b.has(w)) common++;
  const jaccard = common / (a.size + b.size - common);
  const containment = common / Math.min(a.size, b.size);
  return Math.max(jaccard, containment * 0.8);
}

const OVERLAP_THRESHOLD = 0.2;
const OVERLAP_CAP = 5;

export function apiOverlap(ws: Workspace, url: URL, body: unknown): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return badRequest('POST /api/overlap takes a JSON object body: { title: string; body?: string }');
  }
  const draft = body as { title?: unknown; body?: unknown };
  if (typeof draft.title !== 'string' || draft.title.trim() === '') {
    return badRequest('title (non-empty string) is required — overlap is judged on what would be filed');
  }
  if (draft.body !== undefined && typeof draft.body !== 'string') {
    return badRequest('body must be a string when present');
  }
  const input = { title: draft.title, body: (draft.body as string | undefined) ?? '' };
  return withStores(ws, (store) => {
    const candidates = store.all()
      .filter((i) => i.status !== 'superseded')
      .map((i) => ({ item: i, score: overlapScore(input, i) }))
      .filter((c) => c.score >= OVERLAP_THRESHOLD)
      .sort((a, b) => b.score - a.score || (a.item.id < b.item.id ? -1 : 1))
      .slice(0, OVERLAP_CAP)
      .map(({ item: i, score }) => {
        const verdict = injection(i, ws.config);
        return {
          id: i.id, type: i.type, title: i.title,
          score: Math.round(score * 100) / 100,
          injected: verdict.injected, phrase: verdict.phrase,
        };
      });
    return { status: 200, body: { candidates } };
  });
}
```

And in `registerWorkRoutes()` add:

```ts
  registerRoute('POST', '/api/overlap', {
    kind: 'json',
    handle: (ctx: ApiContext) => apiOverlap(ctx.ws, ctx.url, ctx.body),
  });
```

- [ ] **Step 4: Run the tests and the suite**

Run: `node --test test/ui/read-model-work.test.ts && npm test && npx tsc --noEmit`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/read-model-work.ts test/ui/read-model-work.test.ts
git commit -m "feat(ui): overlap detection at capture — a scored hint, computed before the second item is filed"
```

---

## Task 6: Configure read model — `GET /api/config` and `POST /api/config/check`

**Files:**
- Create: `src/ui/read-model-config.ts`
- Modify: `src/ui/read-model.ts` (one word: `export` on `parseSelectQuery` — consumed by Task 7)
- Modify: `src/ui/server.ts` (import + call `registerConfigRoutes()`)
- Test: `test/ui/read-model-config.test.ts`

**Interfaces:**
- Consumes: `resolveConfig`, `DEFAULT_BUDGETS`, `AGENT_EDITS`, `SCOPE_POLICIES` (`config.ts:308`, `:51`, `:93-94`), `PROFILES` (`core/categories.ts`), `node:fs` `readFileSync`/`existsSync`.
- Produces:
  - `registerConfigRoutes(): void` — called once from `server.ts`.
  - `apiConfigGet(ws, url): JsonResult` — `GET /api/config` →

    ```ts
    {
      path: string;                  // <projectRoot>/config.json — the file the deny hook names
      exists: boolean;
      raw: unknown | null;           // the file's parsed JSON, read FRESH from disk on every call
      parseError: string | null;     // invalid JSON reported as a field, never a 500
      resolved: {                    // resolveConfig(raw), serializable (the null-prototype
        profile: string;             //   categories map re-shaped as a sorted array)
        categories: { name; prefix; tier; enabled; agentEdits; scopePolicy; description }[];
        budgets: Budgets; watchedDocs: string[];
      } | null;
      resolveError: string | null;   // resolveConfig's thrown message, VERBATIM
      meta: {                        // what the editor's controls are built from
        profiles: string[];          // Object.keys(PROFILES)
        tiers: ['normative', 'rationale'];
        agentEdits: string[];        // AGENT_EDITS — declaration order is user-facing (config.ts:91-93)
        scopePolicies: string[];     // SCOPE_POLICIES
        defaultBudgets: Budgets;
      };
    }
    ```

  - `apiConfigCheck(ws, url, body): JsonResult` — `POST /api/config/check` with body `{ candidate: unknown }` →
    - candidate resolves: `200 { ok: true, resolved: <same shape as above>, dropped: { where: string; message: string }[] }`.
    - candidate refused by `resolveConfig`: `200 { ok: false, error: string }` — **the thrown message verbatim**, which is what makes the editor's refusal wording identical to the CLI's by construction (spec §4: "with the same wording").
    - `dropped` is the editor's own strictness, labelled as such (Design decision 9): `resolveConfig` *silently* keeps the default for an invalid `budgets` value (`config.ts:449-452`), drops non-string `watchedDocs` entries (`:454-456`), and never reads an unknown top-level key (`:308-458` reads exactly `profile`, `categories`, `budgets`, `watchedDocs`). Each such case yields one finding — e.g. `{ where: 'budgets.jit', message: '"lots" is not a non-negative number — the loader would silently keep the default (6000)' }` — because a config editor that let the loader's silences through would be INV-nothing-is-dropped-silently violated in the one screen built to prevent it.

- [ ] **Step 1: Write the failing tests**

```ts
// test/ui/read-model-config.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { apiConfigGet, apiConfigCheck } from '../../src/ui/read-model-config.ts';

function workspace(): { dir: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-config-'));
  runCli(['init'], dir, () => {});
  runCli(['add', 'rule', 'Unscoped rule', '--body', 'Applies everywhere.'], dir, () => {});
  return { dir, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('/api/config reads the file fresh and reports resolved config and meta', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiConfigGet(ws, new URL('http://x/api/config'));
    assert.equal(result.status, 200);
    const body = result.body as {
      path: string; exists: boolean; parseError: string | null;
      resolved: { profile: string; categories: { name: string }[] } | null;
      meta: { profiles: string[]; agentEdits: string[]; scopePolicies: string[] };
    };
    assert.equal(body.parseError, null);
    assert.equal(body.resolved?.profile, ws.config.profile);
    assert.deepEqual(body.meta.agentEdits, ['allow', 'review']);
    assert.deepEqual(body.meta.scopePolicies, ['global', 'required', 'inert']);

    // FRESH from disk: edit the file after the workspace was resolved, ask again.
    writeFileSync(path.join(dir, '.my_context', 'config.json'),
      JSON.stringify({ budgets: { jit: 123 } }));
    const again = apiConfigGet(ws, new URL('http://x/api/config'));
    assert.equal((again.body as { resolved: { budgets: { jit: number } } }).resolved.budgets.jit, 123);
  } finally { done(); }
});

test('/api/config reports unparseable JSON as a field, not a 500', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    writeFileSync(path.join(dir, '.my_context', 'config.json'), '{ not json');
    const result = apiConfigGet(ws, new URL('http://x/api/config'));
    assert.equal(result.status, 200);
    const body = result.body as { parseError: string | null; resolved: unknown };
    assert.ok(typeof body.parseError === 'string' && body.parseError.length > 0);
    assert.equal(body.resolved, null);
  } finally { done(); }
});

test('/api/config/check surfaces resolveConfig refusals VERBATIM', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const url = new URL('http://x/api/config/check');

    const badProfile = apiConfigCheck(ws, url, { candidate: { profile: 'nope' } });
    assert.equal(badProfile.status, 200);
    const refusal = badProfile.body as { ok: boolean; error: string };
    assert.equal(refusal.ok, false);
    // The same wording, by construction: compare against the real throw.
    let expected = '';
    try { resolveConfig({ profile: 'nope' }); } catch (err) { expected = (err as Error).message; }
    assert.equal(refusal.error, expected);

    const badEnum = apiConfigCheck(ws, url, {
      candidate: { categories: { rule: { scopePolicy: 'everywhere' } } },
    });
    assert.equal((badEnum.body as { ok: boolean }).ok, false);

    const good = apiConfigCheck(ws, url, { candidate: { budgets: { jit: 100 } } });
    const okBody = good.body as { ok: boolean; dropped: unknown[] };
    assert.equal(okBody.ok, true);
    assert.deepEqual(okBody.dropped, []);
  } finally { done(); }
});

test('/api/config/check names what resolveConfig would silently ignore', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const url = new URL('http://x/api/config/check');
    const result = apiConfigCheck(ws, url, {
      candidate: {
        budgest: {},                       // top-level typo resolveConfig never reads
        budgets: { jit: 'lots', pinned: -5 },  // silently kept at default by the loader
        watchedDocs: ['docs/**', 42],      // the 42 is silently dropped by the loader
      },
    });
    const body = result.body as { ok: boolean; dropped: { where: string }[] };
    assert.equal(body.ok, true); // resolveConfig accepts all of this — that is the point
    const wheres = body.dropped.map((d) => d.where).sort();
    assert.deepEqual(wheres, ['budgest', 'budgets.jit', 'budgets.pinned', 'watchedDocs[1]']);
  } finally { done(); }
});

test('a malformed check body is refused', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const url = new URL('http://x/api/config/check');
    assert.equal(apiConfigCheck(ws, url, undefined).status, 400);
    assert.equal(apiConfigCheck(ws, url, { nocandidate: 1 }).status, 400);
  } finally { done(); }
});
```

- [ ] **Step 2: Run and see them fail**

Run: `node --test test/ui/read-model-config.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/ui/read-model-config.ts
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PROFILES } from '../core/categories.ts';
import {
  AGENT_EDITS, DEFAULT_BUDGETS, SCOPE_POLICIES, resolveConfig,
  type Budgets, type Config,
} from '../core/config.ts';
import type { Tier } from '../core/types.ts';
import type { Workspace } from '../core/workspace.ts';
import { badRequest, unknownParams } from './read-model.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';

/**
 * The Configure read model (web-ui plan 2). Everything here VALIDATES and
 * PREVIEWS; nothing writes. The deny hook's own words are the reason
 * (pre-tool-use.ts:96-97): configuration changes to .my_context/config.json
 * are the user's to make — so the editor produces the file for the user to
 * paste, and a UI that wrote it would be arguing with a rule this product
 * enforces against its own agent (spec §4, Configure).
 */

/** Compile-time-pinned runtime list for the Tier union (types.ts:1) — no
 * runtime list exists anywhere; the Exclude check fails tsc if the union grows. */
const TIERS = ['normative', 'rationale'] as const;
type _TiersExhaustive = Exclude<Tier, (typeof TIERS)[number]> extends never ? true : never;
const _tiersExhaustive: _TiersExhaustive = true;
void _tiersExhaustive;

function configPath(ws: Workspace): string | null {
  return ws.projectRoot ? path.join(ws.projectRoot, 'config.json') : null;
}

/** resolveConfig's Config, reshaped for JSON: the null-prototype categories
 * map (config.ts:334) becomes a sorted array. */
function serializable(config: Config): unknown {
  return {
    profile: config.profile,
    categories: Object.values(config.categories)
      .sort((a, b) => (a.name < b.name ? -1 : 1))
      .map((c) => ({
        name: c.name, prefix: c.prefix, tier: c.tier, enabled: c.enabled,
        agentEdits: c.agentEdits, scopePolicy: c.scopePolicy, description: c.description,
      })),
    budgets: config.budgets,
    watchedDocs: config.watchedDocs,
  };
}

const META = {
  profiles: Object.keys(PROFILES),
  tiers: TIERS,
  agentEdits: AGENT_EDITS,
  scopePolicies: SCOPE_POLICIES,
  defaultBudgets: DEFAULT_BUDGETS,
};

export function apiConfigGet(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  const file = configPath(ws);
  if (file === null) return { status: 404, body: { error: 'no workspace here' } };

  // Fresh from disk on every call: the file is the user's to edit while the
  // server runs, and an editor seeded from the server's boot-time snapshot
  // would compose a diff against text no longer in the file.
  const exists = existsSync(file);
  let raw: unknown = null;
  let parseError: string | null = null;
  if (exists) {
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
    }
  }
  let resolved: unknown = null;
  let resolveError: string | null = null;
  if (parseError === null) {
    try {
      resolved = serializable(resolveConfig(raw ?? {}));
    } catch (err) {
      resolveError = err instanceof Error ? err.message : String(err);
    }
  }
  return {
    status: 200,
    body: { path: file, exists, raw, parseError, resolved, resolveError, meta: META },
  };
}

const TOP_LEVEL_KEYS = ['profile', 'categories', 'budgets', 'watchedDocs'];
const BUDGET_KEYS = Object.keys(DEFAULT_BUDGETS) as (keyof Budgets)[];

/**
 * What resolveConfig would accept and silently NOT act on (verified against
 * config.ts:447-456 and the four keys :308-458 reads). These findings are the
 * EDITOR'S checks, not resolveConfig refusals, and the wording says which
 * silence each one names — the loader's leniency is shipped behaviour this
 * module must not misdescribe as validation.
 */
export function silentlyDropped(candidate: unknown): { where: string; message: string }[] {
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return [];
  const input = candidate as Record<string, unknown>;
  const out: { where: string; message: string }[] = [];
  for (const key of Object.keys(input)) {
    if (!TOP_LEVEL_KEYS.includes(key)) {
      out.push({
        where: key,
        message: `"${key}" is not a key the loader reads (it reads: ${TOP_LEVEL_KEYS.join(', ')}) — ` +
          'it would be accepted and ignored in silence',
      });
    }
  }
  const budgets = input.budgets;
  if (typeof budgets === 'object' && budgets !== null && !Array.isArray(budgets)) {
    for (const key of Object.keys(budgets)) {
      if (!(BUDGET_KEYS as string[]).includes(key)) {
        out.push({
          where: `budgets.${key}`,
          message: `"${key}" is not a budget tier (${BUDGET_KEYS.join(', ')}) — ignored in silence`,
        });
        continue;
      }
      const value = (budgets as Record<string, unknown>)[key];
      if (!(typeof value === 'number' && Number.isFinite(value) && value >= 0)) {
        out.push({
          where: `budgets.${key}`,
          message: `${JSON.stringify(value)} is not a non-negative number — the loader would ` +
            `silently keep the default (${DEFAULT_BUDGETS[key as keyof Budgets]})`,
        });
      }
    }
  }
  if (Array.isArray(input.watchedDocs)) {
    input.watchedDocs.forEach((entry, i) => {
      if (typeof entry !== 'string') {
        out.push({
          where: `watchedDocs[${i}]`,
          message: `${JSON.stringify(entry)} is not a string — the loader would silently drop it`,
        });
      }
    });
  }
  return out;
}

export function apiConfigCheck(ws: Workspace, url: URL, body: unknown): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  if (typeof body !== 'object' || body === null || !('candidate' in body)) {
    return badRequest('POST /api/config/check takes a JSON body: { candidate: <the config.json content> }');
  }
  const candidate = (body as { candidate: unknown }).candidate;
  try {
    const resolved = resolveConfig(candidate);
    return {
      status: 200,
      body: { ok: true, resolved: serializable(resolved), dropped: silentlyDropped(candidate) },
    };
  } catch (err) {
    // The refusal, VERBATIM — same enums, same wording, because it IS the same
    // code path the CLI hits (spec §4: Configure, Validation).
    return { status: 200, body: { ok: false, error: err instanceof Error ? err.message : String(err) } };
  }
}

export function registerConfigRoutes(): void {
  registerRoute('GET', '/api/config', {
    kind: 'json', handle: (ctx: ApiContext) => apiConfigGet(ctx.ws, ctx.url),
  });
  registerRoute('POST', '/api/config/check', {
    kind: 'json', handle: (ctx: ApiContext) => apiConfigCheck(ctx.ws, ctx.url, ctx.body),
  });
  // Task 7 adds /api/config/preview here.
}
```

In `src/ui/read-model.ts`: change `function parseSelectQuery(` to `export function parseSelectQuery(` and add one sentence to its comment: `Exported for /api/config/preview (plan 2, Task 7), which takes the same grammar as query parameters beside a candidate config body — one grammar, one implementation.`

In `src/ui/server.ts`: add `import { registerConfigRoutes } from './read-model-config.ts';` and call `registerConfigRoutes();` beside the other two registrations.

- [ ] **Step 4: Run the tests, the no-writes test, the suite**

Run: `node --test test/ui/read-model-config.test.ts && node --test test/ui/no-writes.test.ts && npm test && npx tsc --noEmit`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/read-model-config.ts src/ui/read-model.ts src/ui/server.ts test/ui/read-model-config.test.ts
git commit -m "feat(ui): config read model — fresh reads, verbatim refusals, and the loader's silences named"
```

---

## Task 7: Configure preview — `POST /api/config/preview`

The screen's whole justification (spec §4: "shows what a change would do to the current corpus, before it is made… the preview is exact rather than estimated, and needs no writes to compute"). Every input is a pure function of items and config: `injection` for the governing set, `agentEditsFor`/`scopePolicyFor` for the policy diffs, `select` for the budget half.

**Files:**
- Modify: `src/ui/read-model-config.ts`
- Test: extend `test/ui/read-model-config.test.ts`

**Interfaces:**
- Consumes: `injection`, `agentEditsFor`, `scopePolicyFor`, `select`, `parseSelectQuery` (exported in Task 6), `withStores`.
- Produces: `apiConfigPreview(ws, url, body): JsonResult` — `POST /api/config/preview?event=…&cold=1|session=…[&path=…][&restore=…]` with body `{ candidate: unknown }` →

  ```ts
  {
    governing: {                       // injection() under current vs candidate config, per item
      becomesInjected:   { id; title; type; phraseAfter: string }[];
      stopsBeingInjected:{ id; title; type; phraseBefore: string; phraseAfter: string }[];
      unchanged: number;
    };
    agentEdits: {                      // categories whose agentEditsFor verdict changes
      category: string; before: string; after: string;
      items: { id; title; status }[];  // counted and named (spec §4)
    }[];
    scopePolicy: {                     // categories whose scopePolicy changes
      category: string; before: string; after: string;
      unscopedItems: { id; title }[];  // "7 items become injectable nowhere" — the named list
    }[];
    selection: {                       // the same simulation the budget simulator runs, under BOTH configs
      before: Selection; after: Selection;
    };
  }
  ```

  An invalid candidate is `400` carrying `resolveConfig`'s message verbatim (a preview of an unloadable config would be a preview of nothing). The select context comes from the query string through `parseSelectQuery` — the exact grammar `/api/select` speaks, cold labelled by the same rule, `seen` passed the same way — so "what starts spilling" is answered by the selector that will actually run, for the session the user has selected.

- [ ] **Step 1: Write the failing tests** (append to `test/ui/read-model-config.test.ts`)

```ts
import { apiConfigPreview } from '../../src/ui/read-model-config.ts';

const PREVIEW = (qs: string) => new URL(`http://x/api/config/preview?${qs}`);

test('scopePolicy inert names the unscoped items that become injectable nowhere', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiConfigPreview(ws, PREVIEW('event=session-start&cold=1'), {
      candidate: { categories: { rule: { scopePolicy: 'inert' } } },
    });
    assert.equal(result.status, 200);
    const body = result.body as {
      scopePolicy: { category: string; before: string; after: string; unscopedItems: { id: string }[] }[];
      governing: { stopsBeingInjected: { id: string }[] };
    };
    const rulePolicy = body.scopePolicy.find((p) => p.category === 'rule');
    assert.ok(rulePolicy);
    assert.deepEqual([rulePolicy!.before, rulePolicy!.after], ['global', 'inert']);
    assert.equal(rulePolicy!.unscopedItems.length, 1); // the 'Unscoped rule' fixture item
    // And the governing diff agrees: injection() under inert refuses the unscoped rule.
    assert.ok(body.governing.stopsBeingInjected.some(
      (i) => i.id === rulePolicy!.unscopedItems[0].id));
  } finally { done(); }
});

test('disabling a category shows the governing-set diff, not a warning', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiConfigPreview(ws, PREVIEW('event=session-start&cold=1'), {
      candidate: { categories: { rule: { enabled: false } } },
    });
    const body = result.body as { governing: { stopsBeingInjected: unknown[]; becomesInjected: unknown[] } };
    assert.ok(body.governing.stopsBeingInjected.length >= 1);
    assert.equal(body.governing.becomesInjected.length, 0);
  } finally { done(); }
});

test('agentEdits allow names the items an agent could rewrite from tomorrow', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiConfigPreview(ws, PREVIEW('event=session-start&cold=1'), {
      candidate: { categories: { rule: { agentEdits: 'allow' } } },
    });
    const body = result.body as {
      agentEdits: { category: string; before: string; after: string; items: { id: string }[] }[];
    };
    const change = body.agentEdits.find((c) => c.category === 'rule');
    assert.ok(change);
    assert.deepEqual([change!.before, change!.after], ['review', 'allow']);
    assert.ok(change!.items.length >= 1);
  } finally { done(); }
});

test('a budgets change runs the real selector under both configs', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    runCli(['add', 'rule', 'Pinned', '--always', '--body', 'A pinned body long enough to cost tokens.'], dir, () => {});
    const result = apiConfigPreview(ws, PREVIEW('event=session-start&cold=1'), {
      candidate: { budgets: { pinned: 1 } },
    });
    const body = result.body as {
      selection: { before: { full: unknown[]; spilled: unknown[] }; after: { full: unknown[]; spilled: unknown[] } };
    };
    assert.ok(body.selection.before.full.length >= 1);
    assert.equal(body.selection.after.full.length, 0);    // nothing fits a 1-token pinned budget
    assert.ok(body.selection.after.spilled.length >= 1);  // what starts spilling, named
  } finally { done(); }
});

test('an unloadable candidate is 400 with resolveConfig wording; bad query grammar is 400', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const bad = apiConfigPreview(ws, PREVIEW('event=session-start&cold=1'), {
      candidate: { profile: 'nope' },
    });
    assert.equal(bad.status, 400);
    assert.match((bad.body as { error: string }).error, /unknown profile/);

    assert.equal(apiConfigPreview(ws, PREVIEW('event=tool&cold=1'), { candidate: {} }).status, 400); // tool without path
    assert.equal(apiConfigPreview(ws, PREVIEW(''), { candidate: {} }).status, 400);                  // no event
  } finally { done(); }
});
```

- [ ] **Step 2: Run and see them fail**

Run: `node --test test/ui/read-model-config.test.ts`
Expected: new tests FAIL.

- [ ] **Step 3: Implement** (append to `src/ui/read-model-config.ts`; add imports: `injection` from `../cli/commands/injection.ts`, `agentEditsFor`, `scopePolicyFor` from `../core/config.ts`, `select` from `../core/select.ts`, `parseSelectQuery`, `withStores` from `./read-model.ts`, `type Item` from `../core/types.ts`)

```ts
export function apiConfigPreview(ws: Workspace, url: URL, body: unknown): JsonResult {
  // The select grammar comes from the QUERY STRING through the one parser
  // /api/select uses (read-model.ts, exported in Task 6) — cold labelled by
  // the same rule, seen fetched the same way. The candidate rides in the body.
  const parsed = parseSelectQuery(ws, url);
  if ('error' in parsed) return badRequest(parsed.error);
  if (typeof body !== 'object' || body === null || !('candidate' in body)) {
    return badRequest('POST /api/config/preview takes a JSON body: { candidate: <the config.json content> }');
  }
  let candidate: Config;
  try {
    candidate = resolveConfig((body as { candidate: unknown }).candidate);
  } catch (err) {
    // A preview of an unloadable config would be a preview of nothing; the
    // refusal is resolveConfig's, verbatim.
    return badRequest(err instanceof Error ? err.message : String(err));
  }
  const current = ws.config;

  return withStores(ws, (store) => {
    const items = store.all();

    // 1. The governing-set diff: injection() — eligibility + tier + empty-scope
    //    policy in select's own order — under each config, per item. This one
    //    composition covers enabled, tier and scopePolicy changes uniformly
    //    (spec §4: "shown as a diff of the governing set, not as a warning").
    const becomesInjected: { id: string; title: string; type: string; phraseAfter: string }[] = [];
    const stopsBeingInjected: { id: string; title: string; type: string; phraseBefore: string; phraseAfter: string }[] = [];
    let unchanged = 0;
    for (const item of items) {
      const before = injection(item, current);
      const after = injection(item, candidate);
      if (before.injected === after.injected) { unchanged++; continue; }
      if (after.injected) {
        becomesInjected.push({ id: item.id, title: item.title, type: item.type, phraseAfter: after.phrase });
      } else {
        stopsBeingInjected.push({
          id: item.id, title: item.title, type: item.type,
          phraseBefore: before.phrase, phraseAfter: after.phrase,
        });
      }
    }

    // 2 + 3. Policy diffs per category, through the ONE lookups (config.ts:138, :160).
    const categoryNames = [...new Set([
      ...Object.keys(current.categories), ...Object.keys(candidate.categories),
    ])].sort();
    const agentEdits = categoryNames.flatMap((name) => {
      const before = agentEditsFor(current, name);
      const after = agentEditsFor(candidate, name);
      if (before === after) return [];
      const affected = items.filter((i: Item) => i.type === name)
        .map((i) => ({ id: i.id, title: i.title, status: i.status }));
      return [{ category: name, before, after, items: affected }];
    });
    const scopePolicy = categoryNames.flatMap((name) => {
      const before = scopePolicyFor(current, name);
      const after = scopePolicyFor(candidate, name);
      if (before === after) return [];
      const unscopedItems = items
        .filter((i: Item) => i.type === name && i.scope.length === 0)
        .map((i) => ({ id: i.id, title: i.title }));
      return [{ category: name, before, after, unscopedItems }];
    });

    // 4. The budget half: the REAL selector under both configs, same context.
    const selection = {
      before: select(items, parsed.ctx, current),
      after: select(items, parsed.ctx, candidate),
    };

    return {
      status: 200,
      body: {
        governing: { becomesInjected, stopsBeingInjected, unchanged },
        agentEdits,
        scopePolicy,
        selection,
      },
    };
  });
}
```

And in `registerConfigRoutes()` add:

```ts
  registerRoute('POST', '/api/config/preview', {
    kind: 'json', handle: (ctx: ApiContext) => apiConfigPreview(ctx.ws, ctx.url, ctx.body),
  });
```

- [ ] **Step 4: Run the tests, the no-writes test, the suite**

Run: `node --test test/ui/read-model-config.test.ts && node --test test/ui/no-writes.test.ts && npm test && npx tsc --noEmit`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/read-model-config.ts test/ui/read-model-config.test.ts
git commit -m "feat(ui): config preview — the real selector and the real injection verdicts under a candidate config"
```

---

## Task 8: E2E — every plan-2 route is behind the gate

**Files:**
- Test: `test/ui/plan2-e2e.test.ts`

**Interfaces:**
- Consumes: plan 1's spawn harness (`test/ui/helpers.ts`: `startUiChild`, `redeemNonce`), `TOKEN_HEADER` (`security.ts`).
- Produces: the proof that registering routes from new modules kept them inside the security gate — the property plan 1's routes.ts comment promises ("registering a route can never bypass it"), now asserted for the routes this plan registered.

- [ ] **Step 1: Write the test — it fails until Tasks 3-7 are merged (route 404s read as gate failures), passes after**

```ts
// test/ui/plan2-e2e.test.ts
/**
 * Spawned-process assertions for every route plan 2 registered: no token →
 * 401; the real token → not 401/403. The dispatch order (server.ts) puts the
 * gate before matchRoute, so these must hold without any per-route code —
 * this test is what notices if that ordering ever changes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { TOKEN_HEADER } from '../../src/ui/security.ts';
import { startUiChild, redeemNonce } from './helpers.ts';

const GETS = [
  '/api/revisions',
  '/api/review-queue',
  '/api/search?text=x',
  '/api/glob?pattern=src/**',
  '/api/config',
];
const POSTS: [string, unknown][] = [
  ['/api/overlap', { title: 'x' }],
  ['/api/config/check', { candidate: {} }],
  ['/api/config/preview?event=session-start&cold=1', { candidate: {} }],
];

test('every plan-2 route refuses a tokenless request and answers a tokened one', async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-p2e2e-'));
  runCli(['init'], cwd, () => {});
  runCli(['add', 'rule', 'Pin me', '--always', '--body', 'Pinned.'], cwd, () => {});
  const h = await startUiChild(cwd);
  try {
    const token = await redeemNonce(h.port, h.nonce);
    const base = `http://127.0.0.1:${h.port}`;

    for (const p of GETS) {
      const bare = await fetch(`${base}${p}`);
      assert.equal(bare.status, 401, `${p} without a token`);
      const gated = await fetch(`${base}${p}`, { headers: { [TOKEN_HEADER]: token } });
      assert.ok(gated.status === 200, `${p} with the token → ${gated.status}`);
    }
    for (const [p, body] of POSTS) {
      const bare = await fetch(`${base}${p}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(bare.status, 401, `${p} without a token`);
      const gated = await fetch(`${base}${p}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [TOKEN_HEADER]: token },
        body: JSON.stringify(body),
      });
      assert.ok(gated.status === 200, `${p} with the token → ${gated.status}`);
    }
  } finally {
    await h.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run it and see it pass — then verify it is alive**

Run: `node --test test/ui/plan2-e2e.test.ts` → PASS.
Aliveness check (every test needs a failure mode it actually detects): temporarily comment out the `registerWorkRoutes();` call in `server.ts`, run again, and watch the `/api/revisions` assertions fail with 404 in place of 200. Restore. Run once more: PASS. Record having done this in the commit message body.

- [ ] **Step 3: Run the whole suite**

Run: `npm test && npx tsc --noEmit`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add test/ui/plan2-e2e.test.ts
git commit -m "test(ui): every plan-2 route sits behind the token gate — spawned-process proof

Aliveness check performed: unregistering the work routes turns the 200
assertions into 404 failures; restored before commit."
```

---

## Task 9: `lib/command.js` — command composition, once

**Files:**
- Create: `src/ui/public/lib/command.js`
- Test: `test/ui/palette-lib.test.ts`

**Interfaces:**
- Consumes: nothing (pure browser module; `node --test` imports it directly, as plan 1's viewmodel tests do).
- Produces (the Work, palette and Configure screens use these — no screen concatenates a command string by hand):
  - `quoteArg(value: string): string` — bare when the value matches `/^[A-Za-z0-9@%_+=:,.\/\-]+$/`; otherwise wrapped in double quotes with `\` and `"` backslash-escaped. Double quotes because they mean the same thing in POSIX shells and PowerShell for these characters — the docstring states the limit honestly: values mixing both quote kinds plus backslashes are edge cases a user should eyeball before running, and the UI shows the composed string precisely so they can.
  - `composeCommand(argv: string[]): string` — `argv.map(quoteArg).join(' ')`; throws on an empty argv or a non-string element (a screen that composed `undefined` into a command must fail loudly in development, not paste garbage into a shell).

- [ ] **Step 1: Write the failing tests**

```ts
// test/ui/palette-lib.test.ts
/**
 * Pure browser-module logic for the palette, tested in Node. The DOM half of
 * the palette/work/configure screens has no test — the plan-1 limit (spec §6:
 * rendering is untestable without a browser dependency) applies unchanged.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('quoteArg leaves safe values bare and quotes the rest', async () => {
  const { quoteArg } = await import('../../src/ui/public/lib/command.js');
  assert.equal(quoteArg('RULE-x'), 'RULE-x');
  assert.equal(quoteArg('src/**,docs/**'), '"src/**,docs/**"'); // * is not in the safe set — the shell must not expand it
  assert.equal(quoteArg('two words'), '"two words"');
  assert.equal(quoteArg('say "hi"'), '"say \\"hi\\""');
  assert.equal(quoteArg('back\\slash'), '"back\\\\slash"');
});

test('a glob with * is quoted — the shell must not expand it', async () => {
  const { quoteArg } = await import('../../src/ui/public/lib/command.js');
  assert.equal(quoteArg('src/**'), '"src/**"');
});

test('composeCommand joins quoted argv and refuses garbage', async () => {
  const { composeCommand } = await import('../../src/ui/public/lib/command.js');
  assert.equal(
    composeCommand(['mycontext', 'review', 'promote-revision', 'RULE-x', '--revision', 'REV-abc', '--yes']),
    'mycontext review promote-revision RULE-x --revision REV-abc --yes',
  );
  assert.equal(
    composeCommand(['mycontext', 'add', 'rule', 'Two words', '--scope', 'src/**']),
    'mycontext add rule "Two words" --scope "src/**"',
  );
  assert.throws(() => composeCommand([]));
  assert.throws(() => composeCommand(['mycontext', undefined]));
});
```

- [ ] **Step 2: Run and see them fail**

Run: `node --test test/ui/palette-lib.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// src/ui/public/lib/command.js
// Command-string composition for every composed write in the UI — the ONE
// place quoting lives, used by the palette, Work and Configure screens alike.
// The composed string is always SHOWN before it is copied: quoting here aims
// at POSIX shells and PowerShell for the characters mycontext values actually
// carry, and anything exotic is visible to the user before they run it.

const SAFE = /^[A-Za-z0-9@%_+=:,.\/\-]+$/;

export function quoteArg(value) {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`quoteArg: not a composable value: ${String(value)}`);
  }
  if (SAFE.test(value)) return value;
  // Globs (*, ?) fall through to quoting on purpose: an unquoted src/** would
  // be expanded by the user's shell before mycontext ever saw it.
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function composeCommand(argv) {
  if (!Array.isArray(argv) || argv.length === 0) {
    throw new Error('composeCommand: empty argv');
  }
  return argv.map(quoteArg).join(' ');
}
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test test/ui/palette-lib.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/public/lib/command.js test/ui/palette-lib.test.ts
git commit -m "feat(ui): command composition and quoting in one module"
```

---

## Task 10: `lib/palette-defs.js` — the command catalogue

**Files:**
- Create: `src/ui/public/lib/palette-defs.js`
- Test: extend `test/ui/palette-lib.test.ts`

**Interfaces:**
- Consumes: `composeCommand` (Task 9) in tests only — the defs module itself is pure data plus one builder.
- Produces (the palette screen renders this catalogue; nothing else defines a command):
  - `PALETTE: CommandDef[]` where

    ```js
    // kind: 'write' → composed and copied, with the note. 'read' → executed by
    //   the UI: `screen` navigates to the screen that renders the answer, or
    //   `endpoint(values)` returns the API path whose JSON the palette shows.
    // args: ordered positionals; flags: named. Each input names its `source`
    //   (what the screen offers as a picker) or `input` kind:
    //   source: 'items' (/api/items) | 'categories' (/api/config meta)
    //         | 'files' (/api/coverage) | 'revisions' (/api/revisions)
    //         | 'drafts' (/api/review-queue) | 'topics' (fixed help list)
    //   input: 'text' | 'textarea' | 'glob' (text + live /api/glob tester)
    //   options: [...] for fixed enums
    // { name, kind, base: string[], args: [...], flags: [...] }
    ```

  - `commandFor(def, values): string[]` — the argv for a write def: `base`, then each arg value in order (missing required arg throws), then each set flag as `--name value` (or bare `--name` for boolean flags). The palette calls `composeCommand(commandFor(def, values))`.
  - The catalogue itself, one entry per verified command — the source citations are in this plan's Verified Facts table and each def carries the flag set exactly as the CLI declares it:
    - **write**: `add` (args category+title; flags body/file/note/scope/tags/severity/yes — `index.ts:188-193`), `edit` (arg id; flags title/body/scope/tags/severity/always/status/extra/yes — `edit.ts:752`), `pin`/`unpin`/`harden`/`soften` (arg id; flag yes — `edit.ts:894-899`), `supersede` (args id + `--by` id — `supersede.ts:159`), `refresh` (arg id — `refresh.ts:148`), `repair` (flag yes — `repair.ts:191`), `lesson-accept` / `lesson-discard` (args id+key — `lesson.ts:344,351`), `review promote` (arg id; flags scope/always/severity/yes — `review.ts:84`), `review discard` (arg id; flag yes — `:85`), `review promote-revision` (arg id; flags revision/force/yes — `:87`), `review discard-revision` (arg id; flags revision/reason/yes — `:88`), and `rebuild` (no args — `index.ts:72`; classified write because it rewrites `.index.db` on disk, Design decision 12).
    - **read**: `status` → screen `#/status`; `doctor` → `#/doctor`; `decay` → `#/decay`; `review revisions` → `#/work`; `help <topic>` → `#/learn`; `list [category]` → endpoint `/api/items` (client filters by the chosen category); `show <id>` → endpoint `/api/item/<id>`; `search …` → endpoint `/api/search?…` (Task 4).

- [ ] **Step 1: Write the failing tests** (append to `test/ui/palette-lib.test.ts`)

```ts
test('commandFor builds the exact argv for representative commands', async () => {
  const { PALETTE, commandFor } = await import('../../src/ui/public/lib/palette-defs.js');
  const { composeCommand } = await import('../../src/ui/public/lib/command.js');
  const byName = new Map(PALETTE.map((d) => [d.name, d]));

  assert.equal(
    composeCommand(commandFor(byName.get('review promote-revision'),
      { id: 'RULE-x', revision: 'REV-abc', yes: true })),
    'mycontext review promote-revision RULE-x --revision REV-abc --yes',
  );
  assert.equal(
    composeCommand(commandFor(byName.get('add'),
      { category: 'rule', title: 'Two words', scope: 'src/**', body: 'Body.', yes: true })),
    'mycontext add rule "Two words" --body Body. --scope "src/**" --yes',
  );
  assert.equal(
    composeCommand(commandFor(byName.get('supersede'), { id: 'RULE-a', by: 'RULE-b' })),
    'mycontext supersede RULE-a --by RULE-b',
  );
  assert.throws(() => commandFor(byName.get('supersede'), { id: 'RULE-a' })); // --by is required
});

test('every composed write command is matched by one of the fourteen deny rules (or is rebuild)', async () => {
  const { PALETTE } = await import('../../src/ui/public/lib/palette-defs.js');
  // README.md:3967-3980, verbatim — the protection the composed-not-executed
  // design exists to preserve. A write command the palette composes that NO
  // deny rule can match would be a gap in the user's recipe, surfaced here.
  const denyPrefixes = [
    'mycontext lesson-accept ', 'mycontext review promote ', 'mycontext review discard ',
    'mycontext review promote-revision ', 'mycontext review discard-revision ',
    'mycontext add ', 'mycontext supersede ', 'mycontext refresh ', 'mycontext edit ',
    'mycontext pin ', 'mycontext unpin ', 'mycontext harden ', 'mycontext soften ',
    'mycontext repair ',
  ];
  for (const def of PALETTE.filter((d) => d.kind === 'write')) {
    if (def.name === 'rebuild' || def.name === 'lesson-discard') continue; // named exceptions, see test comment below
    const head = `${def.base.join(' ')} `;
    assert.ok(
      denyPrefixes.some((p) => head.startsWith(p) || p.startsWith(head)),
      `${def.name}: "${head}" matches no deny rule`,
    );
  }
  // rebuild rewrites only the derived index (README documents delete-and-rebuild
  // as recovery); lesson-discard rejects a staged candidate and is absent from
  // the shipped recipe. Both are still COMPOSED, never executed — the exception
  // is to the deny-list assertion, not to the no-writes rule.
});

test('every read def names a screen or an endpoint — a read the UI cannot execute is not listed', async () => {
  const { PALETTE } = await import('../../src/ui/public/lib/palette-defs.js');
  for (const def of PALETTE.filter((d) => d.kind === 'read')) {
    assert.ok(
      typeof def.screen === 'string' || typeof def.endpoint === 'function',
      `${def.name} is a read with no execution path`,
    );
  }
});
```

- [ ] **Step 2: Run and see them fail, then implement**

Run: `node --test test/ui/palette-lib.test.ts` → new tests FAIL.

```js
// src/ui/public/lib/palette-defs.js
// The command catalogue (spec §4, Work: "build a command from selections and
// inputs, with real pickers and a live glob tester"). Write commands are
// COMPOSED AND COPIED with the on-screen note — per spec §2 the only
// treatment of a write anywhere in this UI. Read commands EXECUTE: they
// navigate to the screen that renders the answer, or fetch the endpoint that
// serves it. Every flag set below was read out of the CLI's own usage
// declarations (citations in the plan's Verified Facts table); a def must
// never advertise a flag its command refuses.

const yes = { name: 'yes', boolean: true };

export const PALETTE = [
  // --- writes: composed, copied, never executed --------------------------
  {
    name: 'add', kind: 'write', base: ['mycontext', 'add'], overlap: true,
    args: [
      { name: 'category', source: 'categories', required: true },
      { name: 'title', input: 'text', required: true },
    ],
    flags: [
      { name: 'body', input: 'textarea' }, { name: 'file', input: 'text' },
      { name: 'note', input: 'text' }, { name: 'scope', input: 'glob' },
      { name: 'tags', input: 'text' }, { name: 'severity', options: ['hard', 'soft'] },
      yes,
    ],
  },
  {
    name: 'edit', kind: 'write', base: ['mycontext', 'edit'],
    args: [{ name: 'id', source: 'items', required: true }],
    flags: [
      { name: 'title', input: 'text' }, { name: 'body', input: 'textarea' },
      { name: 'scope', input: 'glob' }, { name: 'tags', input: 'text' },
      { name: 'severity', options: ['hard', 'soft'] }, { name: 'always', options: ['true', 'false'] },
      { name: 'status', input: 'text' }, { name: 'extra', input: 'text' },
      yes,
    ],
  },
  { name: 'pin', kind: 'write', base: ['mycontext', 'pin'], args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  { name: 'unpin', kind: 'write', base: ['mycontext', 'unpin'], args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  { name: 'harden', kind: 'write', base: ['mycontext', 'harden'], args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  { name: 'soften', kind: 'write', base: ['mycontext', 'soften'], args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  {
    name: 'supersede', kind: 'write', base: ['mycontext', 'supersede'],
    args: [{ name: 'id', source: 'items', required: true }],
    flags: [{ name: 'by', source: 'items', required: true }],
  },
  { name: 'refresh', kind: 'write', base: ['mycontext', 'refresh'], args: [{ name: 'id', source: 'items', required: true }], flags: [] },
  { name: 'repair', kind: 'write', base: ['mycontext', 'repair'], args: [], flags: [yes] },
  {
    name: 'lesson-accept', kind: 'write', base: ['mycontext', 'lesson-accept'],
    args: [{ name: 'id', input: 'text', required: true }, { name: 'key', input: 'text', required: true }],
    flags: [],
  },
  {
    name: 'lesson-discard', kind: 'write', base: ['mycontext', 'lesson-discard'],
    args: [{ name: 'id', input: 'text', required: true }, { name: 'key', input: 'text', required: true }],
    flags: [],
  },
  {
    name: 'review promote', kind: 'write', base: ['mycontext', 'review', 'promote'],
    args: [{ name: 'id', source: 'drafts', required: true }],
    flags: [
      { name: 'scope', input: 'glob' }, { name: 'always', boolean: true },
      { name: 'severity', options: ['hard', 'soft'] }, yes,
    ],
  },
  {
    name: 'review discard', kind: 'write', base: ['mycontext', 'review', 'discard'],
    args: [{ name: 'id', source: 'drafts', required: true }], flags: [yes],
  },
  {
    name: 'review promote-revision', kind: 'write', base: ['mycontext', 'review', 'promote-revision'],
    args: [{ name: 'id', source: 'revisions', required: true }],
    flags: [{ name: 'revision', input: 'text' }, { name: 'force', boolean: true }, yes],
  },
  {
    name: 'review discard-revision', kind: 'write', base: ['mycontext', 'review', 'discard-revision'],
    args: [{ name: 'id', source: 'revisions', required: true }],
    flags: [{ name: 'revision', input: 'text' }, { name: 'reason', input: 'text' }, yes],
  },
  // rebuild rewrites .index.db on disk — a write for composition purposes
  // even though it is not in the deny recipe (it rebuilds a derived file the
  // README tells users they may delete freely).
  { name: 'rebuild', kind: 'write', base: ['mycontext', 'rebuild'], args: [], flags: [] },

  // --- reads: executed by the UI -----------------------------------------
  { name: 'status', kind: 'read', base: ['mycontext', 'status'], args: [], flags: [], screen: '#/status' },
  { name: 'doctor', kind: 'read', base: ['mycontext', 'doctor'], args: [], flags: [], screen: '#/doctor' },
  { name: 'decay', kind: 'read', base: ['mycontext', 'decay'], args: [], flags: [], screen: '#/decay' },
  { name: 'review revisions', kind: 'read', base: ['mycontext', 'review', 'revisions'], args: [], flags: [], screen: '#/work' },
  {
    name: 'help', kind: 'read', base: ['mycontext', 'help'],
    args: [{ name: 'topic', source: 'topics' }], flags: [], screen: '#/learn',
  },
  {
    name: 'list', kind: 'read', base: ['mycontext', 'list'],
    args: [{ name: 'category', source: 'categories' }], flags: [],
    endpoint: () => '/api/items',
  },
  {
    name: 'show', kind: 'read', base: ['mycontext', 'show'],
    args: [{ name: 'id', source: 'items', required: true }], flags: [],
    endpoint: (values) => `/api/item/${encodeURIComponent(values.id)}`,
  },
  {
    name: 'search', kind: 'read', base: ['mycontext', 'search'],
    args: [],
    flags: [
      { name: 'text', input: 'text' }, { name: 'type', source: 'categories' },
      { name: 'tag', input: 'text' }, { name: 'path', input: 'text' },
      { name: 'status', input: 'text' }, { name: 'relation', input: 'text' },
      { name: 'limit', input: 'text' },
    ],
    endpoint: (values) => {
      const qs = new URLSearchParams();
      for (const key of ['text', 'type', 'tag', 'path', 'status', 'relation', 'limit']) {
        if (values[key]) qs.set(key, values[key]);
      }
      return `/api/search?${qs.toString()}`;
    },
  },
];

/** The argv for a def and its collected values. Missing required input throws
 * — a half-built command must not be composable, let alone copyable. */
export function commandFor(def, values) {
  const argv = [...def.base];
  for (const arg of def.args) {
    const value = values[arg.name];
    if (value === undefined || value === '') {
      if (arg.required) throw new Error(`${def.name}: ${arg.name} is required`);
      continue;
    }
    argv.push(value);
  }
  for (const flag of def.flags) {
    const value = values[flag.name];
    if (flag.boolean) {
      if (value === true) argv.push(`--${flag.name}`);
      continue;
    }
    if (value === undefined || value === '') {
      if (flag.required) throw new Error(`${def.name}: --${flag.name} is required`);
      continue;
    }
    argv.push(`--${flag.name}`, value);
  }
  return argv;
}
```

- [ ] **Step 3: Run the tests and see them pass**

Run: `node --test test/ui/palette-lib.test.ts`
Expected: PASS — including the deny-rule coverage test, which is the §8 risk row ("a UI write silently voids the user's Bash deny rules") operationalized against the catalogue.

- [ ] **Step 4: Commit**

```bash
git add src/ui/public/lib/palette-defs.js test/ui/palette-lib.test.ts
git commit -m "feat(ui): the palette command catalogue, deny-rule coverage tested"
```

---

## Task 11: The Work screen

> **Mockup:** the "Review queue" and "Capture" sections of `docs/design/web-ui-mockup.html` show the intended rendering — the per-field diff with a per-field stale warning, the compose blocks for promote/discard, the "revisions, not items" count spelling, and the overlap warning at capture. Its "Compose an edit"/"Capture anyway"/"View" buttons have no behaviour and its data is fabricated. Spec outranks it (`docs/design/web-ui-mockup.md`).

**Files:**
- Create: `src/ui/public/screens/work.js`
- Modify: `src/ui/public/app.js` (add `work` to `SCREENS`; add a `nav.work` group to `NAV`)
- Modify: `src/ui/public/strings/en.js` and `src/ui/public/strings/he.js` (the keys below — **both files, same commit**; the parity test enforces it)

**Interfaces:**
- Consumes: `window.myctx` (`api`, `t`, `navigate`), `GET /api/revisions` (Task 3), `GET /api/review-queue` (Task 3), `composeCommand`/`commandFor` (`lib/command.js`, `lib/palette-defs.js`).
- Produces: `render(root, ctx): Promise<void>` — the screen-module contract plan 1's router calls.

String keys added to **both** tables (English values shown; the Hebrew file carries real translations of every key — the register to match is `docs/README.he.md`):

```js
  'nav.work': 'Work',
  'work.title': 'Review',
  'work.revisions': 'Pending revisions',
  'work.revisionsCount': '{revisions} pending revision(s) on {items} item(s)',
  'work.empty': 'Nothing is waiting for a human here.',
  'work.stagedBy': 'proposed by {origin}, {when}',
  'work.stale': 'STALE — a human has changed the very text this proposes to rewrite: {fields}',
  'work.staleField': 'this field changed since the proposal was staged',
  'work.itemMissing': 'the item this revision names is no longer in the index',
  'work.noCurrent': 'no current value — there is nothing to diff against',
  'work.promote': 'Promote',
  'work.discard': 'Discard',
  'work.discardReason': 'Discard reason (recorded in the log)',
  'work.forcePromote': 'Promote anyway (--force)',
  'work.forceWarning':
    'This revision is stale: {fields} changed after it was staged. --force overwrites the newer, human-written text with text written against a version that no longer exists. Discarding is the default for a reason.',
  'work.drafts': 'Draft queue',
  'work.draftsEmpty': 'No project-layer drafts are waiting for review.',
  'work.draftMeta': '{type}, severity {severity} — {phrase}',
  'work.promoteDraft': 'Promote draft',
  'work.discardDraft': 'Discard draft',
  'common.writeWhy':
    'Run in your console, this stays a command your permission rules can see; run from a page, it would bypass them. So the UI composes the command — correct and copy-ready — and you run it.',
```

(`common.write` and `common.copy` exist from plan 1 and are reused, not redefined.)

- [ ] **Step 1: Implement the screen**

```js
// src/ui/public/screens/work.js
// Work (spec §4, §2): the clearest instance of the composed-not-executed
// rule. The two-column-diff-with-terms is what a terminal cannot do; the
// approval is ONE LINE pasted into a shell. Every command this screen shows
// goes through commandFor + composeCommand and is copied, never run — and
// the composed settlement always carries --revision, so the pasted line
// settles exactly the revision the human read, not "the oldest".
import { composeCommand } from '/lib/command.js';
import { PALETTE, commandFor } from '/lib/palette-defs.js';

const DEFS = new Map(PALETTE.map((d) => [d.name, d]));

/** The write-command block every composed write shares: the command, a Copy
 * button, and the two-sentence note (spec §2: "the note the owner asked for,
 * saying plainly that this is a write and must be run in your own shell"). */
export function writeBlock(ctx, command) {
  const box = document.createElement('div');
  const code = document.createElement('code');
  code.className = 'path'; // LTR inside an RTL page: a command is not prose
  code.textContent = command;
  const copy = document.createElement('button');
  copy.textContent = ctx.t('common.copy');
  copy.onclick = () => navigator.clipboard.writeText(command);
  const note = document.createElement('p');
  note.className = 'dim';
  note.textContent = `${ctx.t('common.write')} ${ctx.t('common.writeWhy')}`;
  box.append(code, ' ', copy, note);
  return box;
}

/** The same treatment for a composed FILE (Configure's resulting config.json):
 * same copy button, same two-sentence note — the rule being explained is the
 * same rule — but the payload is file text and the heading names the path. */
export function writeFileBlock(ctx, text, filePath) {
  const box = document.createElement('div');
  const where = document.createElement('p');
  where.className = 'path';
  where.textContent = filePath;
  const pre = document.createElement('pre');
  pre.className = 'path';
  pre.textContent = text;
  const copy = document.createElement('button');
  copy.textContent = ctx.t('common.copy');
  copy.onclick = () => navigator.clipboard.writeText(text);
  const note = document.createElement('p');
  note.className = 'dim';
  note.textContent = `${ctx.t('common.write')} ${ctx.t('common.writeWhy')}`;
  box.append(where, pre, copy, note);
  return box;
}

function diffBlock(ctx, field) {
  const wrap = document.createElement('div');
  const name = document.createElement('h4');
  name.textContent = field.field;
  if (field.changed) {
    const mark = document.createElement('span');
    mark.className = 'spill';
    mark.textContent = ` — ${ctx.t('work.staleField')}`;
    name.append(mark);
  }
  wrap.append(name);
  if (field.noCurrent) {
    const p = document.createElement('p');
    p.className = 'dim';
    p.textContent = ctx.t('work.noCurrent');
    wrap.append(p);
  }
  const pre = document.createElement('pre');
  for (const line of field.diff) {
    const span = document.createElement('span');
    span.textContent = `${line.mark} ${line.text}\n`;
    if (line.mark === '-') span.className = 'gap';
    if (line.mark === '+') span.className = 'spill';
    pre.append(span);
  }
  wrap.append(pre);
  return wrap;
}

function revisionCard(ctx, rev) {
  const card = document.createElement('section');
  const head = document.createElement('h3');
  head.textContent = `${rev.itemId}${rev.itemTitle ? ` — ${rev.itemTitle}` : ''}`;
  const meta = document.createElement('p');
  meta.className = 'dim';
  meta.textContent = ctx.t('work.stagedBy', { origin: rev.origin, when: rev.stagedAt });
  card.append(head, meta);

  if (rev.itemMissing) {
    const warn = document.createElement('p');
    warn.className = 'gap';
    warn.textContent = ctx.t('work.itemMissing');
    card.append(warn);
  } else if (rev.stale) {
    const warn = document.createElement('p');
    warn.className = 'gap';
    warn.textContent = ctx.t('work.stale', { fields: rev.changedSince.join(', ') });
    card.append(warn);
  }

  for (const field of rev.fields) card.append(diffBlock(ctx, field));

  const promoteDef = DEFS.get('review promote-revision');
  const discardDef = DEFS.get('review discard-revision');

  const discard = composeCommand(commandFor(discardDef,
    { id: rev.itemId, revision: rev.revisionId, yes: true }));
  const promote = composeCommand(commandFor(promoteDef,
    { id: rev.itemId, revision: rev.revisionId, yes: true }));

  if (rev.stale || rev.itemMissing) {
    // Discard first: the stale path's default. --force is a second, explicit
    // control that names what it overwrites — never composed silently.
    const dh = document.createElement('h4');
    dh.textContent = ctx.t('work.discard');
    card.append(dh, writeBlock(ctx, discard));
    if (!rev.itemMissing) {
      const fh = document.createElement('h4');
      fh.textContent = ctx.t('work.forcePromote');
      const warning = document.createElement('p');
      warning.className = 'gap';
      warning.textContent = ctx.t('work.forceWarning', { fields: rev.changedSince.join(', ') });
      const forced = composeCommand(commandFor(promoteDef,
        { id: rev.itemId, revision: rev.revisionId, force: true, yes: true }));
      card.append(fh, warning, writeBlock(ctx, forced));
    }
  } else {
    const ph = document.createElement('h4');
    ph.textContent = ctx.t('work.promote');
    const dh = document.createElement('h4');
    dh.textContent = ctx.t('work.discard');
    card.append(ph, writeBlock(ctx, promote), dh, writeBlock(ctx, discard));
  }
  return card;
}

export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.textContent = ctx.t('work.title');
  root.append(h);

  const [revs, queue] = await Promise.all([
    ctx.api('/api/revisions'),
    ctx.api('/api/review-queue'),
  ]);

  const rh = document.createElement('h2');
  rh.textContent = ctx.t('work.revisions');
  const counts = document.createElement('p');
  counts.textContent = ctx.t('work.revisionsCount', revs.counts);
  root.append(rh, counts);
  if (revs.revisions.length === 0) {
    const p = document.createElement('p');
    p.className = 'dim';
    p.textContent = ctx.t('work.empty');
    root.append(p);
  }
  for (const rev of revs.revisions) root.append(revisionCard(ctx, rev));

  const dh = document.createElement('h2');
  dh.textContent = ctx.t('work.drafts');
  root.append(dh);
  if (queue.drafts.length === 0) {
    const p = document.createElement('p');
    p.className = 'dim';
    p.textContent = ctx.t('work.draftsEmpty');
    root.append(p);
  }
  const promoteDraft = DEFS.get('review promote');
  const discardDraft = DEFS.get('review discard');
  for (const draft of queue.drafts) {
    const card = document.createElement('section');
    const head = document.createElement('h3');
    head.textContent = `${draft.id} — ${draft.title}`;
    const meta = document.createElement('p');
    meta.className = 'dim';
    meta.textContent = ctx.t('work.draftMeta', {
      type: draft.type, severity: draft.severity, phrase: draft.phrase,
    });
    const ph = document.createElement('h4');
    ph.textContent = ctx.t('work.promoteDraft');
    const dh2 = document.createElement('h4');
    dh2.textContent = ctx.t('work.discardDraft');
    card.append(head, meta,
      ph, writeBlock(ctx, composeCommand(commandFor(promoteDraft, { id: draft.id, yes: true }))),
      dh2, writeBlock(ctx, composeCommand(commandFor(discardDraft, { id: draft.id, yes: true }))));
    root.append(card);
  }
}
```

- [ ] **Step 2: Wire the screen and the strings**

In `src/ui/public/app.js`: add `work: () => import('/screens/work.js'),` to `SCREENS` and a new NAV group `['nav.work', ['work', 'palette']]` after `nav.navigate` (the `palette` entry lands in Task 12 — add it here so the group is complete in one edit; until Task 12 lands, clicking it falls back to the status screen, which is the router's existing unknown-name behaviour). Add every string key above to `strings/en.js` and, translated, to `strings/he.js`.

- [ ] **Step 3: Run the parity test, the suite, and smoke it**

Run: `node --test test/ui/strings-parity.test.ts && npm test`
Then `node src/cli/index.ts ui --no-open` in a workspace with a staged revision (create one via the Task 3 fixture recipe), open the printed URL, and confirm: the diff renders per field with `-`/`+`/context colouring, the stale card leads with discard and the force warning names the moved fields, Copy puts the exact composed line on the clipboard, and the note is present under every command. (Manual because rendering is untestable — the plan-1 limit.)

- [ ] **Step 4: Commit**

```bash
git add src/ui/public/screens/work.js src/ui/public/app.js src/ui/public/strings
git commit -m "feat(ui): Work screen — the diff is the capability, the approval is a paste"
```

---

## Task 12: The command palette screen

> **Mockup:** the "Command palette" section of `docs/design/web-ui-mockup.html` shows the intended split — a write composed and copied with the on-screen note beside a read that runs in place. It is only a sketch of this task: it has no pickers, no glob tester, and its "Run" search prints one canned result. Spec outranks it (`docs/design/web-ui-mockup.md`).

**Files:**
- Create: `src/ui/public/screens/palette.js`
- Modify: `src/ui/public/app.js` (add `palette` to `SCREENS`; the NAV entry exists since Task 11)
- Modify: both string tables

**Interfaces:**
- Consumes: `PALETTE`/`commandFor` (Task 10), `composeCommand` (Task 9), `writeBlock` (Task 11 — imported from `/screens/work.js`), `window.myctx`, `GET /api/items`, `/api/config` (categories + enums for pickers), `/api/review-queue`, `/api/revisions`, `/api/glob`, `/api/search`, `POST /api/overlap`.
- Produces: `render(root, ctx)`.

String keys added to **both** tables:

```js
  'palette.title': 'Command palette',
  'palette.pick': 'Command',
  'palette.compose': 'The command, as you build it',
  'palette.run': 'Run',
  'palette.result': 'Result',
  'palette.incomplete': 'Required inputs are missing: {fields}',
  'palette.globMatches': '{total} file(s) match — showing {shown}',
  'palette.globNone': 'No file matches this pattern. An item scoped to it would govern nothing.',
  'palette.overlapTitle': 'Before you file this — these items may already say it',
  'palette.overlapItem': '{id} ({score}) — {title}',
  'palette.overlapNote':
    'Checked before the second item exists, because type is fixed at creation and a duplicate filed under the wrong category cannot be cleanly undone — only superseded.',
  'palette.readNote': 'This is a read — the UI runs it for you.',
```

- [ ] **Step 1: Implement the screen**

```js
// src/ui/public/screens/palette.js
// The command palette (spec §4, Work): the UI builds the command from real
// selections against real data. READ commands execute here — by fetching the
// endpoint that already serves the answer, or by navigating to the screen
// that already renders it. WRITE commands are composed and copied with the
// note; per spec §2 that is the ONLY treatment of a write anywhere in this
// product's UI. The pickers are real: item ids from /api/items, categories
// from the resolved config, drafts and revisions from the Work endpoints, and
// a --scope input gets the live glob tester (/api/glob). Composing `add` also
// runs overlap detection (/api/overlap) before the second item is filed.
import { composeCommand } from '/lib/command.js';
import { PALETTE, commandFor } from '/lib/palette-defs.js';
import { writeBlock } from '/screens/work.js';

const HELP_TOPICS = ['categories', 'scope', 'capture', 'workflow'];

async function sources(ctx) {
  const [items, config, queue, revs] = await Promise.all([
    ctx.api('/api/items'),
    ctx.api('/api/config'),
    ctx.api('/api/review-queue'),
    ctx.api('/api/revisions'),
  ]);
  return {
    items: items.items.map((i) => ({ value: i.id, label: `${i.id} — ${i.title}` })),
    categories: (config.resolved ? config.resolved.categories : [])
      .filter((c) => c.enabled)
      .map((c) => ({ value: c.name, label: c.name })),
    drafts: queue.drafts.map((d) => ({ value: d.id, label: `${d.id} — ${d.title}` })),
    revisions: revs.revisions.map((r) => ({ value: r.itemId, label: `${r.itemId} (${r.revisionId})` })),
    topics: HELP_TOPICS.map((t) => ({ value: t, label: t })),
  };
}

function inputFor(spec, src, onChange) {
  if (spec.source) {
    const select = document.createElement('select');
    const blank = document.createElement('option');
    blank.value = ''; blank.textContent = '—';
    select.append(blank);
    for (const opt of src[spec.source] ?? []) {
      const o = document.createElement('option');
      o.value = opt.value; o.textContent = opt.label;
      select.append(o);
    }
    select.onchange = onChange;
    return select;
  }
  if (spec.options) {
    const select = document.createElement('select');
    const blank = document.createElement('option');
    blank.value = ''; blank.textContent = '—';
    select.append(blank);
    for (const v of spec.options) {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      select.append(o);
    }
    select.onchange = onChange;
    return select;
  }
  if (spec.boolean) {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.onchange = onChange;
    return box;
  }
  const input = spec.input === 'textarea'
    ? document.createElement('textarea')
    : document.createElement('input');
  input.oninput = onChange;
  return input;
}

function valueOf(el, spec) {
  if (spec.boolean) return el.checked === true ? true : undefined;
  return el.value === '' ? undefined : el.value;
}

export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.textContent = ctx.t('palette.title');
  root.append(h);

  const src = await sources(ctx);

  const picker = document.createElement('select');
  for (const def of PALETTE) {
    const o = document.createElement('option');
    o.value = def.name;
    o.textContent = `${def.name} (${def.kind})`;
    picker.append(o);
  }
  const pickLabel = document.createElement('label');
  pickLabel.append(`${ctx.t('palette.pick')}: `, picker);
  root.append(pickLabel);

  const form = document.createElement('div');
  const composed = document.createElement('div');
  const aux = document.createElement('div'); // glob tester + overlap live here
  const output = document.createElement('div');
  root.append(form, aux, composed, output);

  let debounce = null;

  function build() {
    const def = PALETTE.find((d) => d.name === picker.value);
    form.innerHTML = ''; aux.innerHTML = ''; composed.innerHTML = ''; output.innerHTML = '';
    const controls = new Map();

    const refresh = () => {
      composed.innerHTML = '';
      const values = {};
      for (const [name, { el, spec }] of controls) {
        const v = valueOf(el, spec);
        if (v !== undefined) values[name] = v;
      }
      const title = document.createElement('h2');
      title.textContent = ctx.t('palette.compose');
      composed.append(title);
      let command;
      try {
        command = composeCommand(commandFor(def, values));
      } catch {
        const missing = [...def.args, ...def.flags]
          .filter((s) => s.required && values[s.name] === undefined)
          .map((s) => s.name);
        const p = document.createElement('p');
        p.className = 'dim';
        p.textContent = ctx.t('palette.incomplete', { fields: missing.join(', ') });
        composed.append(p);
        return;
      }
      if (def.kind === 'write') {
        composed.append(writeBlock(ctx, command));
      } else {
        const code = document.createElement('code');
        code.className = 'path';
        code.textContent = command;
        const note = document.createElement('p');
        note.className = 'dim';
        note.textContent = ctx.t('palette.readNote');
        const run = document.createElement('button');
        run.textContent = ctx.t('palette.run');
        run.onclick = async () => {
          if (def.screen && !def.endpoint) { ctx.navigate(def.screen); return; }
          output.innerHTML = '';
          const oh = document.createElement('h2');
          oh.textContent = ctx.t('palette.result');
          const pre = document.createElement('pre');
          try {
            pre.textContent = JSON.stringify(await ctx.api(def.endpoint(values)), null, 2);
          } catch (err) {
            pre.textContent = ctx.t('common.error', { message: String(err && err.message || err) });
          }
          output.append(oh, pre);
        };
        composed.append(code, ' ', run, note);
      }

      // Live glob tester for any 'glob' input with a value (spec §4: "a live
      // glob tester"; the endpoint composes matchesAnyGlob — the pattern
      // question, not the govern question).
      const globSpec = [...def.args, ...def.flags].find((s) => s.input === 'glob');
      const globValue = globSpec && values[globSpec.name];
      // Overlap detection while composing `add` (spec §4: caught BEFORE the
      // second item is filed; it composes the command, it does not run it).
      clearTimeout(debounce);
      debounce = setTimeout(async () => {
        aux.innerHTML = '';
        if (globValue) {
          try {
            const g = await ctx.api(`/api/glob?pattern=${encodeURIComponent(globValue)}`);
            const p = document.createElement('p');
            p.className = g.total === 0 ? 'gap' : 'dim';
            p.textContent = g.total === 0
              ? ctx.t('palette.globNone')
              : ctx.t('palette.globMatches', { total: g.total, shown: g.sample.length });
            const list = document.createElement('pre');
            list.className = 'path';
            list.textContent = g.sample.slice(0, 12).join('\n');
            aux.append(p, list);
          } catch { /* a bad pattern mid-typing is not an error state */ }
        }
        if (def.overlap && values.title) {
          const body = { title: values.title };
          if (values.body) body.body = values.body;
          // ctx.api, never a raw fetch: a raw fetch would carry no token and
          // 401 — which would be the gate doing its job. The POST-capable
          // api(path, init) is the Step 1 note's app.js extension.
          const data = await ctx.api('/api/overlap', { method: 'POST', body });
          if (data.candidates.length > 0) {
            const t = document.createElement('h3');
            t.textContent = ctx.t('palette.overlapTitle');
            const note = document.createElement('p');
            note.className = 'dim';
            note.textContent = ctx.t('palette.overlapNote');
            const ul = document.createElement('ul');
            for (const c of data.candidates) {
              const li = document.createElement('li');
              li.textContent = ctx.t('palette.overlapItem', c);
              ul.append(li);
            }
            aux.append(t, note, ul);
          }
        }
      }, 250);
    };

    for (const spec of [...def.args, ...def.flags]) {
      const label = document.createElement('label');
      label.style.display = 'block';
      const el = inputFor(spec, src, refresh);
      label.append(`${spec.name}${spec.required ? ' *' : ''}: `, el);
      controls.set(spec.name, { el, spec });
      form.append(label);
    }
    refresh();
  }

  picker.onchange = build;
  build();
}
```

**The one shell change this screen needs:** plan 1's `window.myctx.api(path)` is GET-only (`app.js`, plan 1 Task 16), and this screen makes one authenticated POST. Extend `api` in `app.js` to `api(path, init?)` where `init` may carry `{ method, body }` (body JSON-stringified, `content-type: application/json` set) — the token header and the exit-banner behaviour stay in the one place they already live, and every existing caller (all pass one argument) is untouched:

```js
async function api(path, init = {}) {
  let response;
  try {
    response = await fetch(path, {
      method: init.method ?? 'GET',
      headers: {
        'X-Mycontext-Token': token,
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
  } catch {
    banner(translate(table.strings, 'app.serverExited'));
    stopHeartbeat();
    throw new Error('server exited');
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || String(response.status));
  return body;
}
```

- [ ] **Step 2: Wire the screen and the strings**

In `src/ui/public/app.js`: add `palette: () => import('/screens/palette.js'),` to `SCREENS`; extend `api` as above. Add the string keys to both tables.

- [ ] **Step 3: Run the parity test and the suite; smoke by hand**

Run: `node --test test/ui/strings-parity.test.ts && npm test`
Smoke: compose `review promote-revision` from the revisions picker and confirm the composed line carries `--revision` and `--yes`; compose `add` with a title near an existing item's and watch the overlap panel appear; type `src/**` into `--scope` and watch the glob tester count; run `show` on an item and see the JSON result; run `status` and land on the status screen. Confirm every write shows the note and no write has a Run button.

- [ ] **Step 4: Commit**

```bash
git add src/ui/public/screens/palette.js src/ui/public/app.js src/ui/public/strings
git commit -m "feat(ui): command palette — reads execute, writes are composed and copied with the note"
```

---

## Task 13: The Configure screen

> **Mockup:** the "Configuration" section of `docs/design/web-ui-mockup.html` shows the intended rendering — policy toggles with named-consequence previews ("7 items become injectable nowhere", the agentEdits protected/rewritable lists) and the compose-diff block. It covers `scopePolicy` and `agentEdits` only; budgets, `enabled`/`tier` and validation are spec requirements the mockup does not show. Spec outranks it (`docs/design/web-ui-mockup.md`).

**Files:**
- Create: `src/ui/public/lib/config-edit.js`
- Create: `src/ui/public/screens/configure.js`
- Modify: `src/ui/public/app.js` (add `configure` to `SCREENS`; add NAV group `['nav.configure', ['configure']]`)
- Modify: both string tables
- Test: extend `test/ui/palette-lib.test.ts` (the pure `config-edit.js` half)

**Interfaces:**
- Consumes: `GET /api/config`, `POST /api/config/check`, `POST /api/config/preview` (Tasks 6-7), `window.myctx.api` with POST support (Task 12), `writeBlock` (Task 11).
- Produces (pure, in `lib/config-edit.js`):
  - `buildCandidate(raw, edits): object` — a deep-cloned candidate from the file's current raw JSON (or `{}`), with each edit applied at its dotted path (`profile`, `categories.rule.tier`, `budgets.jit`, …). Editing never starts from the *resolved* config: the file the user pastes must stay minimal, carrying only what the file already said plus what they changed — a resolved dump would freeze every default into the file.
  - `changedPaths(raw, candidate): string[]` — dotted paths whose JSON differs, sorted; the "minimal diff" half of spec §4's "the resulting `config.json` — or the minimal diff".
  - `renderConfigJson(candidate): string` — `JSON.stringify(candidate, null, 2) + '\n'` — the exact text to paste.

String keys added to **both** tables:

```js
  'nav.configure': 'Configure',
  'configure.title': 'Configure',
  'configure.file': 'This edits a proposal for {path}. The file itself is yours to change — the UI never writes it.',
  'configure.parseError': 'config.json is not valid JSON: {message}',
  'configure.resolveError': 'config.json does not load: {message}',
  'configure.profile': 'Profile',
  'configure.categories': 'Categories',
  'configure.budgets': 'Budgets',
  'configure.enabled': 'enabled',
  'configure.tier': 'tier',
  'configure.agentEdits': 'agentEdits',
  'configure.scopePolicy': 'scopePolicy',
  'configure.refused': 'Refused: {message}',
  'configure.dropped': 'The loader would silently ignore: {where} — {message}',
  'configure.previewTitle': 'What this change would do, computed against this corpus',
  'configure.becomesInjected': '{n} item(s) start being injected',
  'configure.stopsInjected': '{n} item(s) stop being injected',
  'configure.injectableNowhere': '{n} unscoped {category} item(s) become injectable nowhere',
  'configure.agentEditsChange': 'agents could rewrite {n} {category} item(s) in place from now on ({before} → {after})',
  'configure.selectionBefore': 'Selected today: {full} item(s), {spilled} spill(s)',
  'configure.selectionAfter': 'Selected under this change: {full} item(s), {spilled} spill(s)',
  'configure.noChanges': 'No changes yet — the previews appear as you edit.',
  'configure.result': 'The resulting config.json',
  'configure.changedKeys': 'Changed: {paths}',
```

- [ ] **Step 1: Failing tests for the pure half** (append to `test/ui/palette-lib.test.ts`)

```ts
test('buildCandidate applies dotted edits over a clone and never mutates the input', async () => {
  const { buildCandidate } = await import('../../src/ui/public/lib/config-edit.js');
  const raw = { budgets: { jit: 100 } };
  const candidate = buildCandidate(raw, { 'categories.rule.tier': 'rationale', 'budgets.jit': 200 });
  assert.deepEqual(candidate, { budgets: { jit: 200 }, categories: { rule: { tier: 'rationale' } } });
  assert.deepEqual(raw, { budgets: { jit: 100 } }); // untouched
  assert.deepEqual(buildCandidate(null, { profile: 'standard' }), { profile: 'standard' });
});

test('changedPaths names exactly what differs, sorted', async () => {
  const { buildCandidate, changedPaths } = await import('../../src/ui/public/lib/config-edit.js');
  const raw = { budgets: { jit: 100 } };
  const candidate = buildCandidate(raw, { 'budgets.jit': 200, profile: 'standard' });
  assert.deepEqual(changedPaths(raw, candidate), ['budgets.jit', 'profile']);
  assert.deepEqual(changedPaths(raw, buildCandidate(raw, {})), []);
});

test('renderConfigJson is the exact paste text', async () => {
  const { renderConfigJson } = await import('../../src/ui/public/lib/config-edit.js');
  assert.equal(renderConfigJson({ a: 1 }), '{\n  "a": 1\n}\n');
});
```

- [ ] **Step 2: See them fail, implement the pure module**

```js
// src/ui/public/lib/config-edit.js
// Candidate-building for the Configure screen. Edits apply over the FILE'S
// OWN raw JSON, never over the resolved config: the text the user pastes must
// stay minimal — what the file already said, plus what they changed. A
// resolved dump would freeze every default into the file and turn a future
// default change into a silent divergence.

export function buildCandidate(raw, edits) {
  const base = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  const candidate = JSON.parse(JSON.stringify(base));
  for (const [dotted, value] of Object.entries(edits)) {
    const parts = dotted.split('.');
    let node = candidate;
    for (const part of parts.slice(0, -1)) {
      if (typeof node[part] !== 'object' || node[part] === null) node[part] = {};
      node = node[part];
    }
    node[parts[parts.length - 1]] = value;
  }
  return candidate;
}

export function changedPaths(raw, candidate) {
  const paths = new Set();
  const walk = (a, b, prefix) => {
    const keys = new Set([
      ...Object.keys(a && typeof a === 'object' ? a : {}),
      ...Object.keys(b && typeof b === 'object' ? b : {}),
    ]);
    for (const key of keys) {
      const av = a && typeof a === 'object' ? a[key] : undefined;
      const bv = b && typeof b === 'object' ? b[key] : undefined;
      const here = prefix ? `${prefix}.${key}` : key;
      const bothObjects = av && bv && typeof av === 'object' && typeof bv === 'object'
        && !Array.isArray(av) && !Array.isArray(bv);
      if (bothObjects) { walk(av, bv, here); continue; }
      if (JSON.stringify(av) !== JSON.stringify(bv)) paths.add(here);
    }
  };
  walk(raw ?? {}, candidate ?? {}, '');
  return [...paths].sort();
}

export function renderConfigJson(candidate) {
  return `${JSON.stringify(candidate, null, 2)}\n`;
}
```

Run: `node --test test/ui/palette-lib.test.ts` → PASS.

- [ ] **Step 3: Implement the screen**

```js
// src/ui/public/screens/configure.js
// Configure (spec §4): a validating editor whose previews are EXACT — the
// real resolveConfig refusals verbatim (/api/config/check), the real
// injection verdicts and the real selector under the candidate config
// (/api/config/preview) — and which COMPOSES the resulting config.json for
// the user to paste. It never writes: the deny hook's own words declare this
// file the user's to change, and a UI that wrote it would be arguing with a
// rule this product enforces against its own agent.
import { buildCandidate, changedPaths, renderConfigJson } from '/lib/config-edit.js';
import { writeFileBlock } from '/screens/work.js';

export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.textContent = ctx.t('configure.title');
  root.append(h);

  const config = await ctx.api('/api/config');
  const fileNote = document.createElement('p');
  fileNote.className = 'dim';
  fileNote.textContent = ctx.t('configure.file', { path: config.path });
  root.append(fileNote);

  if (config.parseError !== null) {
    const p = document.createElement('p');
    p.className = 'gap';
    p.textContent = ctx.t('configure.parseError', { message: config.parseError });
    root.append(p);
    return; // an unparseable file has no base to edit over; fixing it is the user's move
  }
  if (config.resolveError !== null) {
    const p = document.createElement('p');
    p.className = 'gap';
    p.textContent = ctx.t('configure.resolveError', { message: config.resolveError });
    root.append(p);
  }

  const edits = {};
  const verdicts = document.createElement('div');
  const previews = document.createElement('div');
  const result = document.createElement('div');

  const profileLabel = document.createElement('label');
  const profileSelect = document.createElement('select');
  for (const p of config.meta.profiles) {
    const o = document.createElement('option');
    o.value = p; o.textContent = p;
    profileSelect.append(o);
  }
  if (config.resolved) profileSelect.value = config.resolved.profile;
  profileLabel.append(`${ctx.t('configure.profile')}: `, profileSelect);
  profileSelect.onchange = () => { edits.profile = profileSelect.value; refresh(); };
  root.append(profileLabel);

  const catHead = document.createElement('h2');
  catHead.textContent = ctx.t('configure.categories');
  root.append(catHead);
  const table = document.createElement('table');
  const headRow = document.createElement('tr');
  for (const label of ['', 'configure.enabled', 'configure.tier', 'configure.agentEdits', 'configure.scopePolicy']) {
    const th = document.createElement('th');
    th.textContent = label === '' ? '' : ctx.t(label);
    headRow.append(th);
  }
  table.append(headRow);
  for (const cat of (config.resolved ? config.resolved.categories : [])) {
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    name.textContent = cat.name;
    tr.append(name);

    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.checked = cat.enabled;
    enabled.onchange = () => { edits[`categories.${cat.name}.enabled`] = enabled.checked; refresh(); };
    const tdE = document.createElement('td'); tdE.append(enabled); tr.append(tdE);

    for (const [key, options, current] of [
      ['tier', config.meta.tiers, cat.tier],
      ['agentEdits', config.meta.agentEdits, cat.agentEdits],
      ['scopePolicy', config.meta.scopePolicies, cat.scopePolicy],
    ]) {
      const select = document.createElement('select');
      for (const v of options) {
        const o = document.createElement('option');
        o.value = v; o.textContent = v;
        select.append(o);
      }
      select.value = current;
      select.onchange = () => { edits[`categories.${cat.name}.${key}`] = select.value; refresh(); };
      const td = document.createElement('td');
      td.append(select);
      tr.append(td);
    }
    table.append(tr);
  }
  root.append(table);

  const budHead = document.createElement('h2');
  budHead.textContent = ctx.t('configure.budgets');
  root.append(budHead);
  for (const tier of ['pinned', 'jit', 'restored', 'index']) {
    const label = document.createElement('label');
    label.style.display = 'block';
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.value = String(config.resolved ? config.resolved.budgets[tier] : config.meta.defaultBudgets[tier]);
    input.oninput = () => { edits[`budgets.${tier}`] = Number(input.value); refresh(); };
    label.append(`${tier}: `, input);
    root.append(label);
  }

  root.append(verdicts, previews, result);

  let pending = null;
  function refresh() {
    clearTimeout(pending);
    pending = setTimeout(run, 250);
  }

  async function run() {
    verdicts.innerHTML = ''; previews.innerHTML = ''; result.innerHTML = '';
    const candidate = buildCandidate(config.raw, edits);
    const changed = changedPaths(config.raw ?? {}, candidate);
    if (changed.length === 0) {
      const p = document.createElement('p');
      p.className = 'dim';
      p.textContent = ctx.t('configure.noChanges');
      previews.append(p);
      return;
    }

    const check = await ctx.api('/api/config/check', { method: 'POST', body: { candidate } });
    if (!check.ok) {
      // The refusal, verbatim — the same enums and wording resolveConfig uses,
      // because it IS resolveConfig speaking. Nothing else renders; an
      // unloadable candidate has no preview and no paste text.
      const p = document.createElement('p');
      p.className = 'gap';
      p.textContent = ctx.t('configure.refused', { message: check.error });
      verdicts.append(p);
      return;
    }
    for (const finding of check.dropped) {
      const p = document.createElement('p');
      p.className = 'spill';
      p.textContent = ctx.t('configure.dropped', finding);
      verdicts.append(p);
    }

    const preview = await ctx.api('/api/config/preview?event=session-start&cold=1',
      { method: 'POST', body: { candidate } });
    const ph = document.createElement('h2');
    ph.textContent = ctx.t('configure.previewTitle');
    previews.append(ph);
    const lines = [];
    if (preview.governing.becomesInjected.length > 0) {
      lines.push([ctx.t('configure.becomesInjected', { n: preview.governing.becomesInjected.length }),
        preview.governing.becomesInjected]);
    }
    if (preview.governing.stopsBeingInjected.length > 0) {
      lines.push([ctx.t('configure.stopsInjected', { n: preview.governing.stopsBeingInjected.length }),
        preview.governing.stopsBeingInjected]);
    }
    for (const [text, items] of lines) {
      const p = document.createElement('p');
      p.textContent = text;
      const ul = document.createElement('ul');
      for (const i of items) {
        const li = document.createElement('li');
        li.textContent = `${i.id} — ${i.title} (${i.phraseAfter})`;
        ul.append(li);
      }
      previews.append(p, ul);
    }
    for (const change of preview.scopePolicy) {
      if (change.after !== 'inert' || change.unscopedItems.length === 0) continue;
      const p = document.createElement('p');
      p.className = 'spill';
      p.textContent = ctx.t('configure.injectableNowhere',
        { n: change.unscopedItems.length, category: change.category });
      const ul = document.createElement('ul');
      for (const i of change.unscopedItems) {
        const li = document.createElement('li');
        li.textContent = `${i.id} — ${i.title}`;
        ul.append(li);
      }
      previews.append(p, ul);
    }
    for (const change of preview.agentEdits) {
      if (change.after !== 'allow') continue;
      const p = document.createElement('p');
      p.className = 'spill';
      p.textContent = ctx.t('configure.agentEditsChange', {
        n: change.items.length, category: change.category,
        before: change.before, after: change.after,
      });
      previews.append(p);
    }
    const selBefore = document.createElement('p');
    selBefore.textContent = ctx.t('configure.selectionBefore', {
      full: preview.selection.before.full.length, spilled: preview.selection.before.spilled.length,
    });
    const selAfter = document.createElement('p');
    selAfter.textContent = ctx.t('configure.selectionAfter', {
      full: preview.selection.after.full.length, spilled: preview.selection.after.spilled.length,
    });
    previews.append(selBefore, selAfter);

    // The paste text: the whole resulting file plus the changed-path list —
    // a JSON file is pasted whole, so the "minimal diff" is shown as the list
    // of changed keys beside the full text, not as a patch nobody can apply.
    const rh = document.createElement('h2');
    rh.textContent = ctx.t('configure.result');
    const changedLine = document.createElement('p');
    changedLine.className = 'dim';
    changedLine.textContent = ctx.t('configure.changedKeys', { paths: changed.join(', ') });
    result.append(rh, changedLine,
      writeFileBlock(ctx, renderConfigJson(candidate), config.path));
  }
}
```

(`writeFileBlock` comes from `/screens/work.js` — Task 11 defines it beside `writeBlock`; adjust the import line at the top of this file to `import { writeFileBlock } from '/screens/work.js';`.)

- [ ] **Step 4: Wire, run, smoke**

In `app.js`: add `configure: () => import('/screens/configure.js'),` and NAV group `['nav.configure', ['configure']]`. Add all string keys to both tables.
Run: `node --test test/ui/strings-parity.test.ts && node --test test/ui/palette-lib.test.ts && npm test`
Smoke: set `rule`'s scopePolicy to `inert` and watch the named unscoped items appear; drop `pinned` to 1 and watch the selection-after line show the spills; pick an invalid state via a hand-edited candidate (e.g. temporarily type a bad profile into the file and reload) and see the verbatim refusal; copy the resulting file text and confirm it is minimal (only the changed keys beyond what the file already had).

- [ ] **Step 5: Commit**

```bash
git add src/ui/public/lib/config-edit.js src/ui/public/screens/configure.js src/ui/public/screens/work.js src/ui/public/app.js src/ui/public/strings test/ui/palette-lib.test.ts
git commit -m "feat(ui): Configure — verbatim refusals, real previews, and a composed config.json"
```

---

## Task 14: Documentation — both documents, always

**Files:**
- Modify: `README.md` (extend the `mycontext ui` section plan 1 added)
- Modify: `docs/README.he.md` (same subsection, same position, Hebrew, inside `<div dir="rtl">`)

**Interfaces:**
- Consumes: everything shipped above.
- Produces: user documentation; `test/docs/parity.test.ts` holds the two structures equal.

- [ ] **Step 1: Establish the insertion point by executing**

Plan 1's Task 20 added the `mycontext ui` section; find it (`git grep -n "mycontext ui" README.md`) and extend it in place — no new top-level heading, so the parity structure stays aligned by construction until the Hebrew half lands.

- [ ] **Step 2: Write the English additions**

Content requirements (prose in the README's register, not a spec dump):
- **Work:** the pending-revision queue as per-field diffs against the text in force; staleness marked per field; the approval is one composed line — `mycontext review promote-revision <id> --revision <rev> --yes` — copied and pasted, with the discard beside it. The UI does not promote.
- **The palette:** builds commands from real pickers; read commands run in the UI; write commands are copied to the console with a note. State the mechanism in the same sentence as the claim: your Bash permission rules match command strings, and a pasted command stays one.
- **Configure:** edits a proposal for `.my_context/config.json`; refusals are `resolveConfig`'s own words; previews are computed by the real selector and the real injection rules against your corpus; the UI never writes the file — the same rule the deny hook states to agents applies to the UI itself.
- Condition-carrying claims only: e.g. "the budget preview equals what the hooks would select **under the candidate budgets, for the event and session you chose**".

- [ ] **Step 3: Run the parity test and see it fail, then write the Hebrew section and see it pass**

Run: `npm test` — the docs parity test fails with one document updated, passes with both.

- [ ] **Step 4: Full gate**

Run: `npm test && npx tsc --noEmit && npm run test:perf && git status --porcelain`
Expected: all green, tree clean after commit. (`test:perf` guards the hook budget; nothing in this plan touches the hook path — Tasks 1-2 moved code `revision.ts` still calls, and the perf run is the proof the moves cost nothing on the hot path.)

- [ ] **Step 5: Commit**

```bash
git add README.md docs/README.he.md
git commit -m "docs: document Work, the command palette and Configure in both READMEs"
```

---

## Self-Review

Performed against the spec with fresh eyes after writing, per the writing-plans skill.

**1. Spec coverage (plan-2 scope only):**

| Spec requirement | Task |
|---|---|
| §2 every write composed and copied, on-screen note, "only treatment of a write anywhere in the UI" | 9 (composition), 11/12/13 (every surface), the note text in Task 11's strings |
| §2 review queue: diff is the capability, approval is a paste; deny rules stay matchable | 3 (served diff), 11 (composed `review promote-revision <id> --revision … --yes`), 10 (deny-rule coverage test) |
| §2/§6 no route reaches a mutating function | Tasks 1-2 exist for this; every server task re-runs `no-writes.test.ts`; Task 8 adds the gate proof |
| §4 Work: command palette with real pickers and a live glob tester | 10 (catalogue), 12 (pickers from /api/items, /api/config, /api/review-queue, /api/revisions; glob tester via /api/glob) |
| §4 Work: review queue per field, stale fields marked, "a title proposal beside a stale body proposal is still promotable" | 3 (`changed` per field), 11 (per-field stale marks; staleness never blocks rendering the fresh fields) |
| §4 Work: overlap detection at capture, before the second item is filed; composes `add`, does not run it | 5 (endpoint + pure score), 12 (live panel inside the `add` composition) |
| §4 Configure: scopePolicy preview names the items ("7 items become injectable nowhere, with the list") | 7 (`scopePolicy[].unscopedItems` + governing diff), 13 (rendered with the list) |
| §4 Configure: agentEdits — items an agent could rewrite, counted and named | 7 (`agentEdits[].items`), 13 |
| §4 Configure: budgets — the same simulation the budget simulator runs, what starts spilling | 7 (`selection.before/after` via the real `select`), 13 |
| §4 Configure: enabled/tier shown as a diff of the governing set, not a warning | 7 (`governing` via `injection()` under both configs), 13 |
| §4 Configure: validation with resolveConfig's enums and wording | 6 (verbatim thrown message; test compares against the real throw), 13 |
| §4 Configure: composes the file, never writes it; deny-hook consistency | 13 (`writeFileBlock`, `configure.file` string), Design decision 8 |
| §3 compose-don't-reimplement | staleness moved not copied (1); diff moved not copied (2); `filterItems` third caller (4); `matchesAnyGlob` for the pattern question only (4); `injection`/`select`/`agentEditsFor`/`scopePolicyFor` compose the preview (7) |
| §3 strings in both tables, key parity; logical CSS only; paths/commands LTR in RTL | every screen task adds keys to both files; screens reuse plan 1's stylesheet classes; composed commands get `class="path"` (LTR) |
| §6 endpoints tested by real process spawn; security first-class | 8 (all plan-2 routes, 401 without token, spawned process) |
| §6 rendering-untested limit stated in the test file | `test/ui/palette-lib.test.ts` header docstring (Task 9) |
| §9 decision 2 (review queue does not promote over HTTP) | 3/11 — no settlement endpoint exists to call |

**2. Placeholder scan:** the plan contains four explicit establish-by-executing points, each naming what to execute and what the committed artefact must contain: Task 1 (plan-1 closure inventory; the `pendingRevisionViews` parity fixture via real `stageRevision`, with the commented parity assertion required to be committed firing), Task 3 (staging fixture and agent-origin draft fixture, both read out of existing tests, with their commented assertions required to be committed firing), Task 4 (the `RELATION_TYPES` copy pinned faithful by the mutate.ts-importing test), Task 14 (the README insertion point). Each is a procedure plus a committed assertion, not a TBD. No "add error handling", no "similar to Task N", no test named without its code.

**3. Type consistency:** `PendingRevision` is defined once (revision-log.ts, Task 1) and consumed in Tasks 3; `DiffLine` defined once (revision-diff.ts, Task 2) and serialized as `{ mark, text }` in Task 3's response, matching what Task 11 renders; `registerWorkRoutes`/`registerConfigRoutes` spelling is identical in Tasks 3/6 and the server wiring; `commandFor(def, values)` (Task 10) is called with the same value-map shape in Tasks 11 and 12; `writeBlock(ctx, command)` exported in Task 11 and imported in 12 and 13; `parseSelectQuery`'s export (Task 6) matches its plan-1 private signature `(ws, url, extraAllowed?)` — Task 7 calls it with two arguments.

**Known deviations and judgement calls, named rather than silent:**
- The composed settlement always carries `--revision`, though the spec's canonical line (`mycontext review promote-revision <id> --yes`) omits it — because without it the CLI settles the *oldest* revision (`pickPendingRevision`, `revision.ts:998`), which may not be the one on screen. The longer line is the correct one; the deny rule `Bash(mycontext review promote-revision *)` matches both.
- `rebuild` and `lesson-discard` are composed writes not covered by the fourteen deny rules; the deny-coverage test names them as exceptions with the reason in a comment rather than silently skipping them.
- `/api/config/check` returns `200 { ok: false }` rather than a 4xx for a refused candidate: the validation *question* was answered successfully; 400 is reserved for a malformed request. `/api/config/preview` differs deliberately — there a refused candidate makes the requested preview impossible, so it is 400 carrying the same verbatim message.
- The Configure preview runs `event=session-start&cold=1` from the screen; other events and sessions are reachable through the endpoint's full grammar but the screen does not yet expose them — the corpus-level question ("what governs, what fits at session start") is the one the spec's examples all ask. Stated here so nobody reads the narrower screen as the endpoint's limit.

---

## Produces summary — what plan 3 and the finished app consume from this plan

```ts
// src/core/revision-log.ts (additions)
decoratePending(record: RevisionRecord, item: Item | null): PendingRevision
pendingRevisionViews(root: string, items: Item[]): PendingRevision[]
REVISION_FIELDS; RevisionField; RevisionValue; PendingRevision; sameValue; valuesOf; fieldsOf; canonicalValue

// src/core/revision-diff.ts (new)
interface DiffLine { mark: '-' | '+' | ' '; text: string }
lineDiff(from: string[], to: string[]): DiffLine[]
valueLines(field: RevisionField, value: RevisionValue | undefined): string[] | null

// src/ui/read-model.ts (change)
export parseSelectQuery(ws, url, extraAllowed?)   // was private; grammar unchanged

// HTTP surface (token header required on all; unknown params → 400)
GET  /api/revisions      → { counts, revisions[] with per-field DiffLine[] }
GET  /api/review-queue   → { drafts[] with injection verdicts }
GET  /api/search?text|type|tag|path|status|relation|limit → { items, total, truncated }
GET  /api/glob?pattern=  → { patterns, total, sample, fileWalkTruncated }
POST /api/overlap        { title, body? } → { candidates[] }
GET  /api/config         → { path, exists, raw, parseError, resolved, resolveError, meta }
POST /api/config/check   { candidate } → { ok, resolved?, dropped[] } | { ok: false, error }
POST /api/config/preview?<select grammar> { candidate } → { governing, agentEdits, scopePolicy, selection }

// browser modules
lib/command.js:      quoteArg(value), composeCommand(argv)
lib/palette-defs.js: PALETTE, commandFor(def, values)
lib/config-edit.js:  buildCandidate(raw, edits), changedPaths(raw, candidate), renderConfigJson(candidate)
screens/work.js:     render(root, ctx); writeBlock(ctx, command); writeFileBlock(ctx, text, path)
window.myctx.api(path, init?)  // extended: init { method, body } for authenticated POSTs
strings: every new key in BOTH strings/en.js and strings/he.js — parity test enforces
```

Execution: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`, task by task, in order — 1→2→3 are strictly sequential (each moves code the next imports); 4, 5 extend Task 3's module; 6→7 are sequential; 8 needs 3-7; 9→10 are sequential and independent of the server tasks; 11 needs 3+10; 12 needs 4, 5, 10, 11; 13 needs 6, 7, 11, 12 (the `api` POST extension); 14 last.
