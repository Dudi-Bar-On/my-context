# Task 11 report: the doctor checks

## Addendum — review round 2 (corrections and fixes)

The coordinator's review confirmed the spec compliance and the headline claim (none of the four defects caught), but found two errors in my defect *explanations*, one critical false-positive in a shipped check, one always-green deletion gap, and seven surviving mutants. All are addressed below; this addendum is appended, not a rewrite, so the sections above stand as the round-1 record.

### Two corrections to the defect analysis

1. **Duplicate ids ARE caught — I was wrong that they weren't.** `loadLayer` (`src/core/rebuild.ts`) reports `duplicate id "…" declared in both …; keeping …, skipping …` as a `LoadError`, and `rebuild()` adds a cross-layer check on top. A user sees this. More importantly, **the sixth check I proposed ("a cheap `checkDuplicateIds`") cannot fire in practice**: `loadLayer` already resolves/removes the duplicate *before* the `Item[]` that `runChecks` receives is ever constructed — by the time doctor sees the array, there is at most one item per id left to look at. Not proposing that sixth check was still the right call, but for a different reason than I gave: not "out of scope by the brief," but "structurally cannot observe the condition it would exist to detect." Corrected.

2. **The real, unflagged gap is the session-file id/filename mismatch (defect #3).** I called this "structurally out of scope" and left it at that; the reviewer is right that this deserved to be called a *gap*, not filed away. Traced it precisely: `listSessions` (`src/ingest/session.ts`) reads the applied-log keyed off the *parsed* session id from the header, so a header whose internal `id` disagrees with its filename silently loses its applied records the moment it's looked up that way, and the surrounding `catch` comment reads "a corrupt session file is working state, not knowledge. Skip it." Doctor never opens `.my_context/ingest/` at all — none of the five checks reads session state. **This is the one place a real defect from this plan is undetected by any check anywhere in the system**, not just out of doctor's stated scope. Recorded here explicitly for Task 12/15: doctor's checks should probably grow a sixth check that validates ingest session headers (id matches filename, applied log is readable) before this plan is considered to have closed the loop on all four defects.

### Critical fixes

**1. `checkDeadScopes` false-positived on this repo's own corpus.** `listRepoFiles`'s `SKIP_DIRS` (used for its general "fast bounded scan" purpose) excludes `.my_context`, `dist`, `build`, `out`, `coverage`, `.next`, `venv`, `__pycache__` — and `checkDeadScopes` was reusing that same list, so a scope glob genuinely matching files inside any of those directories (e.g. `.my_context/**`, which this repo's own `STD-answered-questions-are-superseded` uses) read as "matches nothing" and fired a false `dead_scope`. Fixed by giving `checkDeadScopes` its own file listing (`listFilesForScopeCheck`, new `SCOPE_SKIP_DIRS = {'.git', 'node_modules'}`) that only excludes directories no first-party scope could plausibly target — `.git` internals (huge, never a scope target) and `node_modules` (vendor code). Everything else, including `.my_context/` and build output, is now walked for dead-scope purposes. Pinned with a new test (`dead scopes: a scope into a directory listRepoFiles skips (.my_context, dist, ...) is still live`) exercising both `.my_context/**` and `dist/**`. Verified against the real corpus (below): the false positive is gone.

**2. `checkPermissions` deletion from `runChecks` previously left the suite green.** No existing assertion checked that a permissions-derived code actually appears in `runChecks`' output — only that `checkPermissions` in isolation produces one. Added an assertion (`codes.has('index_not_ignored')`) to the existing aggregation test; mutation-verified by literally deleting the `checkPermissions` line from `runChecks`' check list (see mutation table below) — now fails.

### Mutation fixes — all seven survivors killed

| # | Survivor | Fix | Re-verified killed |
|---|---|---|---|
| 3a–3d | `level` unasserted for `orphan_relation`, `source_anchor_missing`, `dead_scope`, `index_not_ignored` (warn→info mutants survive) | Added `assert.equal(findings[0].level, 'warn')` to each check's test | Yes — all four `warn`→`info` mutations now fail their respective test |
| 4 | Per-document chunk cache untested with >1 source document; keying by a constant passes the whole suite | Added `source drift: two items from two different source documents are each checked against their own`, using two distinct `.md` files with distinct chunks/anchors | Yes — mutating the cache key to a literal constant now fails with a false `source_anchor_missing` on the second item |
| 5 | `not_writable` "untestable" claim was wrong; `R_OK\|W_OK → F_OK` mutant survived | Added an injectable `access` parameter: `checkPermissions(root, access = accessSync, repoRoot?)`. Added a mode-recording spy test (`probes each target with R_OK\|W_OK, never a weaker mode like F_OK`) and a true-positive injected-throw test (`an access failure is reported as a not_writable error`) | Yes — both the `F_OK` mutation and a mutation that swallows the `not_writable` push now fail |
| 6 | `index_not_ignored` used literal `line.trim() === '.index.db'`; false-positives on `.index.db*`, `/.index.db`, `**/.index.db`, `*`, and a repo-root `.gitignore` rule | Replaced with `gitignoreLineCoversName`/`gitignoreLineCoversDir`, a small (not general-purpose) glob-ish matcher; `checkPermissions` gained an optional `repoRoot` third parameter so it can also check the top-level `.gitignore`, including whole-directory rules (`.my_context/`). Added one parameterized test per pattern shape plus two repo-root-gitignore tests (covering and non-covering) | Yes — reverting the matcher to literal equality now fails 4 of the new tests simultaneously |
| 7 | `listRepoFiles`'s `limit`/`FILE_LIMIT` had no test; `>=`→`>` survives | Added `listRepoFiles honors an explicit limit exactly, not off-by-one` (6 candidate files, `limit: 3`, asserts exactly 3) | Yes |

One additional guard I added while fixing the minor items (below) had no test and I closed it too, unprompted but in the same "mutation-test every guard" spirit: the new source-path-traversal guard in `checkSourceDrift` (a `sourceFile` like `../../etc/passwd` is now refused regardless of what exists there). Added `source drift: a source_file that escapes repoRoot is never followed, even if it genuinely matches`, which plants a real, genuinely-matching document just outside `repoRoot` and asserts doctor still reports `source_missing` rather than trusting it. Mutation-verified.

One mutant I deliberately did **not** chase: flipping `matchDir` to always-true in `checkPermissions`'s call for the workspace-local `.gitignore` (which always passes `dirName: ''`) survives, because `gitignoreLineCoversDir(line, '')` cannot match any real gitignore line (guarded by `if (!pattern) return false`). This is an equivalent mutant given the current call sites, not a live gap — noted rather than papered over with an artificial test.

### Minor items folded in

- `source_missing`'s message no longer claims the document "is gone" for every `readFileSync`/`chunkDocument` failure (permission errors, encoding errors, etc. are not "gone") — reworded to "could not be read (missing, unreadable, or outside the repository)."
- `source_anchor_missing` now caps the anchor list at 10 (`MAX_LISTED_ANCHORS`) with an "`, and N more`" suffix, so a large PRD's finding stays readable.
- `checkIndexFreshness` now also factors in `root/config.json`'s mtime, not only `.md` files under `root/items`. This is a partial fix, documented in a code comment: the check's signature doesn't carry a global-layer root, so an edit to the *global* layer still can't mark the project index stale — a real, still-open gap, explicitly flagged for Task 12/15 rather than silently left implicit.
- `checkSourceDrift` now refuses any `source_file` that resolves outside `repoRoot` (a `relPosix` escape check before the read), rather than silently following it. Mutation-tested (see above).
- Recorded, not code-changed (per the reviewer's framing as a risk for Task 12, not a bug in this task): `checkOrphanRelations` will false-fire on any cross-layer relation if the doctor command passes only project-layer items — the JSDoc above the function now says so explicitly, addressed to Task 12.

### Full verification

- `npx tsc --noEmit`: clean.
- `node --test test/doctor/checks.test.ts`: **33/33 passing** (up from 20; 13 new tests added in this round: 4 level assertions folded into existing tests, plus 9 new test cases).
- `npm test`, run twice in full: **1003/1003 passing** both times (970 baseline + 33 in this file).
- No leaked temp directories after either run (`myctx-doc-*` count in the OS temp dir: 0).
- All seven originally-surviving mutants re-verified killed after the fix, plus the two additional guards added during this round (source-path-traversal, `.gitignore` literal-match) also mutation-verified killed. One equivalent mutant (`matchDir` always-true) documented rather than force-tested.
- **Ran `runChecks` against this repository's own real `.my_context/`** via a throwaway script (`loadLayer` + `resolveWorkspace` + `runChecks`, deleted after use — not committed): **39 items, 0 load errors, 0 doctor findings.** The previously-reported false `dead_scope` on `STD-answered-questions-are-superseded` (scope `.my_context/**`) is gone; everything else was already clean (`.index.db` exists and is fresh, `.my_context/.gitignore` already covers `.index.db` and `.index.db-*`, no orphan relations, no source drift, no dead scopes).

### Where the brief disagreed with the built code (updated)

`checkPermissions`' signature grew two optional parameters beyond the brief's `checkPermissions(root: string): Finding[]` — `access` (injectable seam, defaults to `accessSync`) and `repoRoot?` (to also check the top-level `.gitignore`). Both are additive and backward compatible (every brief-shaped call site, `checkPermissions(root)`, is unaffected); `runChecks` now calls `checkPermissions(opts.root, accessSync, opts.repoRoot)`. This is a deliberate, reviewer-directed deviation from the brief's exact signature, done to close real, demonstrated defects (an untestable not-writable branch, and false-positive `.gitignore` matching) rather than to gold-plate.



## What was implemented

`src/doctor/checks.ts`, exporting exactly the interface the brief specified:

- `Finding { level; code; message; item? }`
- `listRepoFiles(repoRoot, limit?)`
- `checkIndexFreshness(root, dbPath)`
- `checkOrphanRelations(items)`
- `checkSourceDrift(repoRoot, items)`
- `checkDeadScopes(repoRoot, items)`
- `checkPermissions(root)`
- `runChecks(opts)`

Verified every consumed interface against the current source before writing code (`relPosix`/`matchesAnyGlob` in `src/core/paths.ts`, `chunkDocument` in `src/ingest/chunk.ts` returning `{anchor, checksum, text, heading, index}`, and `Item` in `src/core/types.ts`) — all matched the brief exactly, unlike Tasks 9/10. The implementation is essentially the brief's Step 3 verbatim, with one small addition: `SKIP_DIRS` also skips the `.my-context` (global-root) spelling alongside `.my_context`, matching `managedSplit`'s documented pair of spellings in `core/paths.ts`.

`test/doctor/checks.test.ts` follows the brief's Step 1 test, restructured to wrap every test body in `try { ... } finally { cleanup(); }` per the `withProject` pattern called out in the task (the brief's own listing used a bare end-of-body `cleanup()`, which leaks the temp dir on any assertion failure). I also added two tests beyond the brief's 18 (see mutation testing below), for 20 total.

## TDD evidence

1. Wrote `test/doctor/checks.test.ts` before any implementation existed.
2. `node --test test/doctor/checks.test.ts` → failed for the right reason: `ERR_MODULE_NOT_FOUND` on `src/doctor/checks.ts`.
3. Implemented `src/doctor/checks.ts`.
4. `node --test test/doctor/checks.test.ts` → 18/18 pass (brief's set), then 20/20 after the two additions below.
5. `npx tsc --noEmit` → clean.
6. `npm test` → **990 passing** (970 baseline + 20 new), 0 failures. No stray temp directories left under the OS temp dir afterward.

## Mutation testing — every guard

I hand-mutated each conditional/comparison in the module (flipping `!`, `===`/`!==`, `<`/`>`, deleting a filter clause, or forcing an always-throw) one at a time, ran `test/doctor/checks.test.ts`, and confirmed the mutant died, then reverted:

| # | Guard mutated | Result |
|---|---|---|
| 1 | `checkIndexFreshness`: `!existsSync(dbPath)` inverted | killed |
| 2 | `checkIndexFreshness`: `newest > indexMtime` → `<` | killed |
| 3 | `checkOrphanRelations`: `known.has(target)` inverted | killed |
| 4 | `checkSourceDrift`: provenance guard (`!sourceFile\|\|...`) inverted | killed |
| 5 | `checkSourceDrift`: `chunks === null \|\| undefined` inverted | killed |
| 6 | `checkSourceDrift`: `!chunk` (anchor-missing) inverted | killed |
| 7 | `checkSourceDrift`: `chunk.checksum !== sourceChecksum` inverted | killed |
| 8 | `checkDeadScopes`: glob-match `continue` guard inverted | killed |
| 9 | `checkDeadScopes`: `status === 'active' && scope.length > 0` filter dropped | killed |
| 10 | `checkPermissions`: `!ignored` inverted | killed |
| 11 | `checkPermissions`: `.index.db` exact-match `===` → `!==` | **survived initially** — closed, see below |
| 12 | `checkPermissions`: force `accessSync` to always throw | killed (breaks the "writable workspace is clean" empty-error assertion) |
| 13 | `runChecks`: removed the `try/catch` around each check call | **survived initially** — closed, see below |

Two guards were genuinely undertested by the brief's own 18 assertions, and I added a test for each rather than just noting the gap:

- **#11**: the brief's gitignore tests only cover "no `.gitignore` at all" and "`.gitignore` contains exactly the right two lines." Neither exercises a `.gitignore` that *exists* but doesn't cover `.index.db` (e.g. `node_modules\n*.log\n`) — with the comparison inverted, that case coincidentally still passed because the mutant's `!==` matched on the *other* wrong reason (any line not literally `.index.db` looks "ignored"). Added `permissions: an existing gitignore that does not cover the index still warns`, which kills it.
- **#13**: the brief's `runChecks` aggregation test only combines findings from checks that all run normally — none of the five checks throws under those fixtures, so the outer `try/catch` (the exact mechanism the code comment calls "must never suppress the others") was never actually exercised on its catch path. Added `runChecks: a check that actually throws is caught and does not suppress the others`, using an `Item` with `relations: null as unknown as []` to force `checkOrphanRelations`'s `for...of` to throw a real `TypeError`, and asserting `check_failed` appears alongside findings from checks both before and after it in the list. Kills the mutant.

One guard I could **not** get a true-positive mutation kill for, and want to flag rather than paper over: `checkPermissions`'s `accessSync` failure branch (`not_writable`). The only test exercising it is the happy path (`checkPermissions(root).filter(level==='error')` is `[]`), which does catch a mutant that forces the branch to *always* fire, but nothing in this suite (or, I believe, reasonably in CI on `windows-latest`/`ubuntu-latest`, which often run as Administrator/root) can reliably produce a genuine `EACCES`/`EPERM` from `accessSync` to prove the branch fires *correctly* when it should. This is an environment limitation rather than a code defect — the finding-construction code itself is simple and directly mirrors the other branches — but it means `not_writable` is the one code path in this module that is exercised by inversion-of-negative-space only, not by a direct true-positive test.

## Would these checks have caught the four real defects?

I traced each of the four against the actual commits that fixed them (`d7f75a1`, `816c1da`, `a6e4ae0`) rather than guessing from the summary. **None of the five doctor checks as specified would have caught any of the four.** Concretely:

1. **Observation text truncated at parse (trailing parenthetical), item checksum stale** (`d7f75a1`, `OPENQ-how-do-filters-respect-dependencies`). This is exactly the case the brief's own note calls out: it's the item's *own* content checksum (`computeItemChecksum`, covering id/title/body/observations) disagreeing with what's on disk, which `loadLayer` already verifies on every `rebuild`/`openStore` — independent of doctor. None of the five checks here look at an item's own checksum at all; `checkSourceDrift` only compares the *source document's* chunk checksum (`source_checksum`), a different field entirely, and only when `sourceFile`/`sourceAnchor`/`sourceChecksum` are all populated (which this hand-authored item likely didn't have). **Not caught**, and per the brief's own §10 scoping, not supposed to be — but worth stating plainly since the task explicitly asked.

2. **Item IDs colliding after 60-character `slugify` truncation** (`src/ingest/apply.ts`, comment around line 65/120). This was fixed at ingest/apply time — deduplication keys off un-truncated text, not the truncated id. If two on-disk item files nonetheless ended up with the same id (e.g. via hand-editing or a future regression), the doctor layer never sees it: `runChecks` is handed an already-loaded `Item[]`, and nothing upstream of doctor guarantees uniqueness is preserved once the array exists — a duplicate id would silently collapse to one entry (or one clobbers the other) before `checkOrphanRelations`/`checkDeadScopes` ever iterate it. None of the five checks scans for duplicate ids across `items`. **Not caught — and this is a real gap in the five-check spec**, not just an out-of-scope concern: a `checkDuplicateIds` check would be cheap (one more `Map<string, Item[]>` pass) and is exactly the kind of rot doctor exists to surface, but it is not one of the five named in spec §10, so it is out of scope for this task by the brief's own instruction ("These are exactly the five checks named in spec §10").

3. **Ingest session file whose internal `id` disagreed with its filename** (`816c1da`, `src/ingest/session.ts`). This is ingest-session-header integrity, a completely different persistence layer from `Item[]`/`.my_context/items/*.md`. None of the five checks reads `.ingest/*.json` or session headers at all. **Not caught, structurally out of scope** for a checker whose only inputs are `root`, `repoRoot`, `dbPath`, and `Item[]`.

4. **Corpus item committed to this repo with a stale checksum.** Per `d7f75a1`'s commit message, this is the *same* incident as #1 (the OPENQ item) — "only the stale recorded checksum disagreeing with the content is evidence anything was altered" refers to the item's own `checksum` field, not `source_checksum`. Same analysis as #1: **not caught** by any of the five checks; caught instead by `loadLayer`.

**Net assessment**: the five checks as specified are real and each is individually testable and non-trivial (verified above by mutation), but as a set they do not overlap at all with the failure modes that actually bit this plan. Three of the four (#1/#4 item-checksum, #3 session-id) are explicitly out of scope by the brief's own architecture (item-checksum is `loadLayer`'s job; session integrity is a different subsystem entirely). The second (#2, id collisions surviving into the loaded `Item[]`) is the one place I'd push back: a `checkDuplicateIds` check is well within doctor's stated purpose ("tells a user their corpus has rotted") and cheap to add, but the brief scopes this task to "exactly the five checks named in spec §10," so I implemented exactly those five and did not add a sixth beyond the two extra *tests* (not checks) described above. I'm flagging this rather than silently expanding scope — Task 12/15 or a spec revision may want to reconsider.

## Where the brief disagreed with the built code

None. Unlike Tasks 9 and 10, every interface (`relPosix`, `matchesAnyGlob`, `chunkDocument`, `Item`) matched the brief's Step 3 code exactly on first read, and the Step 1 test ran (after the try/finally restructuring) without needing any assertion changes.

## Concerns

- The duplicate-item-id gap described above (real defect #2) is not covered by any of the five checks, by design of the brief's scope. Worth a decision before Task 15 folds doctor's summary into `status`.
- `checkPermissions`'s `not_writable` branch has no true-positive test in this suite (see mutation table, guard #12) — not a code defect, but a coverage gap that's hard to close portably across `windows-latest`/`ubuntu-latest` without a platform-specific guard the task's global constraints discourage.
- `checkSourceDrift` resolves `sourceFile` via `path.resolve(repoRoot, ...sourceFile.split('/'))`, trusting it's POSIX-relative. `ingest/session.ts` (per `816c1da`) already enforces the POSIX-relative `sourceFile` contract at ingest time, so this should hold for anything doctor will see in practice, but nothing in `checkSourceDrift` itself defends against a `sourceFile` containing `..` — it would resolve outside `repoRoot` silently rather than being flagged. Not exercised by any test; low risk given the upstream contract, but noting it since the task called for skepticism about guards.

## Commit

```
git add src/doctor/checks.ts test/doctor/checks.test.ts
git commit -m "feat: add the five doctor checks from spec section 10"
```
