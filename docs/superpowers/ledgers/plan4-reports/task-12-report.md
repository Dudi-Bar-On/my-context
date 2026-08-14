# Task 12 report: `mycontext doctor`

## What was implemented

- `src/cli/commands/doctor.ts` — the `doctor` command, registered via `registerCommand`.
  Exports `summarize(findings)` (per-level counts) and `exitCode(counts, loadErrorCount)`
  (the pinned exit-code mapping, factored out as its own pure function — see below).
- `src/cli/commands/index.ts` — added `import './doctor.ts';`.
- `test/cli/doctor.test.ts` — 20 tests at the CLI level.
- A sixth check, added deliberately in this task (see "Sixth check" below):
  - `src/doctor/checks.ts` — added `checkSessionIdMismatch(root)`, wired into `runChecks`
    as a sixth entry in its checks array. New `session_id_mismatch` finding code, `error` level.
  - `test/doctor/checks.test.ts` — 5 new unit tests for it, plus updated the existing
    "runChecks aggregates every check" scaffolding was left alone (already asserts other codes;
    a dedicated `runChecks includes checkSessionIdMismatch` test was added instead).

**Signature note**: `runChecks` takes `{ root, repoRoot, dbPath, items }` — I verified this
against `src/doctor/checks.ts` and `test/doctor/checks.test.ts` directly. There is no `config`
or `loadErrors` parameter on it (the task description's claim to the contrary does not match
source; I followed source, per the task's own instruction to do so). `checkPermissions` does
have the documented optional `access`/`repoRoot` parameters, and `runChecks` already calls it
with `(opts.root, accessSync, opts.repoRoot)`.

## TDD evidence

1. Wrote `test/cli/doctor.test.ts` against the brief (adapted to wrap each test body in a
   `withProject`/try-finally helper, matching `test/cli/review.test.ts`'s pattern, per the
   "clean up with try/finally" instruction).
2. Ran `node --test test/cli/doctor.test.ts` before creating `doctor.ts`: every test failed
   with `my_context: unknown command "doctor".` plus the usage banner — the expected failure.
3. Implemented `src/cli/commands/doctor.ts` per the brief (with the exit-code mapping factored
   into an exported `exitCode` function — see below) and added the `index.ts` import.
4. Re-ran: all 20 tests passed (I added 4 beyond the brief's 8 for exit-code-per-level and
   quiet-mode branch coverage — see below).
5. `npx tsc --noEmit`: clean.
6. Added the sixth check (`checkSessionIdMismatch`) to `src/doctor/checks.ts` following the
   same TDD loop: wrote the 5 unit tests first (import failed to compile since the export
   didn't exist), then implemented the function and the `runChecks` wiring, then reran green.
7. `npm test`: 1028 passed (1003 baseline + 20 doctor CLI tests + 5 checks unit tests), 0
   failed.

## The exit-code mapping — how it's pinned

Rather than leave `counts.errors > 0 || errors.length > 0` inline (computed once, then reused
across two `return failed ? 1 : 0` sites — the quiet branch and the verbose branch), I factored
it into an exported, pure function:

```ts
export function exitCode(counts: { errors: number; warnings: number; infos: number }, loadErrorCount: number): number {
  return counts.errors > 0 || loadErrorCount > 0 ? 1 : 0;
}
```

This is tested directly per level in `test/cli/doctor.test.ts`:
- `exitCode mapping: info-only findings exit 0`
- `exitCode mapping: warn-only findings exit 0`
- `exitCode mapping: an error-level finding exits 1`
- `exitCode mapping: mixed info+warn+error exits 1 (error dominates)`
- `exitCode mapping: no findings but an unrelated load error still exits 1`

I went this route instead of only testing exit codes end-to-end through the CLI because
`index_missing` (the one concrete `info`-level finding `checkIndexFreshness` can produce)
can *never* actually reach the doctor CLI path: `openMutateContext` always opens/creates the
SQLite index before `runChecks` runs, so by the time `checkIndexFreshness` looks for the file
it's warning about missing, it already exists. Fishing for a CLI scenario that produces a
pure-info result would have been artificial; testing the mapping directly is what actually
pins each level to its exit code, independent of which finding happens to produce it.

I also added CLI-level tests for the two *branches* that both apply the mapping (`--quiet` has
its own `return failed ? 1 : 0`, separate from the verbose branch's) — `doctor --quiet` on a
warn-only workspace exits 0, on an error-level workspace exits 1, and still surfaces (and
fails on) an unrelated load error under `--quiet`. Mutation-testing confirmed both return
sites are independently guarded (see below).

## Which items feed `runChecks`, and why

`ctx.store.all()` — the full, merged cross-layer item set (project + global), not
`ws.projectRoot`'s own items filtered out separately. `openMutateContext` always rebuilds
against both `ws.projectRoot` and `ws.globalRoot` (if it exists) before returning, and
`Store.all()` returns everything the rebuild indexed, both layers merged. Feeding `runChecks`
anything narrower — e.g. filtering to `layer === 'project'` — would make
`checkOrphanRelations` false-fire on every relation that legitimately points at a real
global-layer item, exactly per `checkOrphanRelations`'s own doc comment in `checks.ts`
("If `items` is only the project layer, a relation pointing at a real global-layer item will
be reported as an orphan — a false positive... Pass the full, merged cross-layer item set").

I did not add a CLI-level regression test for this specific cross-layer case: `resolveWorkspace`
hardcodes `globalRoot` to `path.join(homedir(), '.my-context')` with no override hook (no env
var, no injectable path), so the only way to exercise a real global-layer item through the CLI
in a test is to write into the *actual* user's home directory — which I was not willing to do
in a test (it would pollute or depend on real machine state, and isn't cleaned up safely on
Windows CI). Instead, the design guarantee is covered structurally: `store.all()` merging both
layers is already asserted directly in `test/core/store.test.ts` (`globalItem` test), and
`doctor.ts`'s only decision here — "feed it `store.all()`, not a filtered subset" — is a
single line with no branch to mutate; there's nothing to hide a regression behind, unlike the
exit-code logic or the grouping logic, which do have branches and got mutation-tested.

## The sixth check: added, in scope, cheap

Task 11's own doc comments recorded a real, unclosed gap: `listSessions`
(`src/ingest/session.ts`) keys an ingest session's applied-log lookup off the `id` field
*inside* the JSON header, not off the file's own name on disk. A session file whose header id
disagrees with its filename (e.g. hand-edited, or corrupted by a partial write outside the
normal `writeHeader` temp-file+rename path) silently loses every applied record logged under
that filename — nothing else in the codebase reads the filename and the header id side by
side, so nothing else can ever notice.

I judged this cheap and in scope for this task:
- **Cheap**: a bounded `readdirSync` of `.ingest/` plus one `JSON.parse` per file — the same
  shape `listSessions` itself already does, no new I/O patterns, no chunking, no drift
  computation.
- **In scope**: `doctor`'s whole job is corpus/workspace health, and this task is the one that
  assembles what `runChecks` sees and decides what exits non-zero. The check itself belongs
  next to the other five in `checks.ts` (same `Finding` shape, same `runChecks` composition),
  and Task 11 explicitly deferred this exact gap to "Task 12" in its own source comments.

`checkSessionIdMismatch(root)`:
- Lists `<root>/.ingest/*.json`.
- For each, parses the header and compares `` `${header.id}.json` `` against the actual
  filename.
- A mismatch is reported as `session_id_mismatch`, level `error` (it is silent, ongoing data
  loss — the same severity class as `source_missing`, not a cosmetic warning).
- A corrupt/unparseable session file is skipped, not reported — same rule `listSessions`
  itself already applies ("a corrupt session file is working state, not knowledge").
- No `.ingest/` directory at all is clean (nothing to check), not an error.

Wired into `runChecks`'s checks array as the sixth entry, keyed off `opts.root` only (it needs
no `repoRoot` or `items`).

I did **not** also add a CLI-level (`test/cli/doctor.test.ts`) test for this — it's exercised
end-to-end via `test/doctor/checks.test.ts`'s `runChecks includes checkSessionIdMismatch`,
which is the same level of coverage the other five checks get from `runChecks`'s own
aggregation test; adding a second CLI-level copy would duplicate coverage without adding
confidence, per "test where the risk actually lives."

## Mutation testing

Every guard below was hand-mutated in the actual source, rerun against the real test suite,
confirmed to fail (not silently pass), then reverted and reverified green + typecheck clean.

**`doctor.ts`:**
| Mutant | Result |
|---|---|
| `exitCode`: `\|\|` → `&&` | killed |
| `exitCode`: `counts.errors > 0` → `>= 0` | killed |
| `exitCode`: `? 1 : 0` → `? 0 : 1` | killed |
| quiet branch: `return failed ? 1 : 0` → `return 0` | killed (by the dedicated quiet+error test) |
| verbose branch: `return failed ? 1 : 0` → `return 0` | killed |
| `ORDER` map: swap `error`/`warn` values | killed (by the error-before-warn ordering test) |
| grouped output: `${bucket.length}` → hardcoded `1` | killed (by the `dead_scope (3)` count test) |
| `finding.item ? ... : ''` → always `''` | killed (by the explicit `^  CONST-a: scope glob` prefix test) |
| quiet branch: drop `emitLoadErrors(errors, out)` | killed (by the quiet+load-error test) |
| `hasFlag(args, 'quiet')` → `!hasFlag(args, 'quiet')` | killed |

**`checks.ts` (`checkSessionIdMismatch`):**
| Mutant | Result |
|---|---|
| `if (expected !== name)` → `if (expected === name)` | killed |
| `if (typeof id !== 'string') continue;` → inverted | killed |
| drop `checkSessionIdMismatch` from `runChecks`'s array | killed (this is exactly the "whole check deleted, suite stays green" regression class the plan history flagged for Task 11 — confirmed it does NOT reproduce here) |

Every mutant died. No survivors.

## Real-corpus run

```
$ node src/cli/index.ts doctor
my_context doctor: 0 error(s), 0 warning(s), 0 note(s) across 0 finding(s).
$ echo $?
0
```

39 items (`node src/cli/index.ts list | wc -l` → 39). Clean run, exit 0, as expected — this
includes the new sixth check (`session_id_mismatch`), which also reported nothing (no ingest
sessions with a mismatched header/filename in this repo's `.my_context/.ingest/`).

## Concerns

- `checkIndexFreshness`'s `info`-level `index_missing` finding can never actually surface
  through the `doctor` CLI, because `openMutateContext` always creates the index before
  `runChecks` runs. This isn't a bug I introduced or need to fix — it's a structural
  consequence of `doctor` reusing the same "always rebuild first" context every other mutating
  command uses — but it does mean that specific finding code is effectively dead from
  `doctor`'s point of view (it can still appear from a direct `checkIndexFreshness` call, e.g.
  in a future `status` report per Task 15, which may open the store differently). Flagging for
  awareness, not fixing, since it's out of this task's scope.
- I did not touch `src/cli/index.ts`'s `usage()` function's hardcoded banner text — `doctor` is
  registered via `registerCommand`, so it already appears in the generated `${registered}` list
  automatically; no separate hardcoded line needed (unlike `status`, which is
  `SHADOWED_BY_SWITCH`).

## Commit

Committed as specified.

---

# Review round 2: fixes

## CRITICAL — the finding's message described a mechanism that does not exist, and its remediation caused the damage it warned about

Verified the real mechanism with a throwaway repro script (`openIngestSession` → hand-edit
header `id` → `openIngestSession` resume → `saveSession` → `listSessions`), not just re-reading
the source:

```
created id: ING-docs-prd-md-dd2990c9-9558c770
hand-edited header id to: ...-BOGUS
resumed session.id: ...-BOGUS (expect bogus, from spread)
resumed session.applied keys: [] (expect correct reads)
files after resumed save: [ .gitignore, ...-BOGUS.json, ...-dd2990c9-9558c770.json ]
listSessions count: 2 [ '...-BOGUS', '...-BOGUS' ]
```

Confirmed exactly what the reviewer described:
- `openIngestSession`'s applied-log read is keyed off the **filename-derived, computed** id
  (`makeSessionId(sourceFile, checksum)`), so a resume's applied-log lookup is correct —
  nothing is silently skipped on resume.
- The bug is on the **next save**: `openIngestSession` returns `{ ...existing, applied }`,
  which keeps `existing.id` (the bogus header value) on the returned session. `saveSession` /
  `writeHeader` then trust `session.id` for where to write, producing a **second** header file
  (and a second applied log) under the bogus id, alongside the original. `listSessions` then
  lists both files, and because both resolve to the same id, the same session is listed twice.
- Rewrote both the `session_id_mismatch` message and `checkSessionIdMismatch`'s doc comment to
  describe this real mechanism, dropped the false "silently skipped on every resume" claim, and
  replaced the remediation. The new remediation is "edit the header's `id` field back to match
  the filename" — explicitly **not** "rename the file", with an explicit "Do NOT rename the
  file" warning and the reason (renaming would make the file stop matching what
  `openIngestSession` computes from `sourceFile`+`sourceChecksum` on the next `ingest`, so the
  existing session would not be found at all — the whole document would be re-chunked and
  re-extracted from scratch, and the applied log under the old filename would be orphaned).
- Added an assertion in `test/doctor/checks.test.ts` that the message never contains
  `/silently (skipped|lost)/`, plus assertions that it names "duplicate", "next save", and
  "Do NOT rename the file" — so a future edit can't silently reintroduce the wrong claim.

## IMPORTANT — error-level false positive on any stray `.json` in `.ingest/`

Added a protocol gate: `checkSessionIdMismatch` now skips any file whose parsed `protocol`
field is not exactly `SESSION_PROTOCOL`, matching what `listSessions` itself already requires
(the doc comment's claim of "the same shape as `listSessions`" is now actually true — it
wasn't before). Added two tests: a stray `.json` with no `protocol` field at all, and one with
a different/older protocol string — both now produce zero findings. Mutation-tested by deleting
the gate: the suite failed exactly on the "different/older protocol" test, confirming the gate
is load-bearing, not redundant with the corrupt-JSON catch.

## IMPORTANT — cross-layer conclusion was wrong; the gap was testable

Reviewer was right and I was wrong to treat "can't safely test via the real CLI/homedir path"
as "therefore untestable." `CommandDef.run(ws, args, out, cwd)` takes a `Workspace` object
directly, so a test can call `COMMANDS.get('doctor')!.run({ ...resolveWorkspace(cwd), globalRoot: tempdir }, ...)`
and never touch `homedir()`. Added exactly that:

- `runWithWorkspace(cwd, globalRoot, args)` helper in `test/cli/doctor.test.ts`.
- **Present control**: a project-layer item relating to a real global-layer item (written into
  a tempdir passed as `globalRoot`) → 0 findings, exit 0, no `orphan_relation`.
- **Absent control**: the identical relation, but `globalRoot` pointed at a directory that does
  not exist / does not contain the target → `orphan_relation [warn]`, exit 0 (so the "present"
  test isn't passing merely because doctor reports nothing regardless of input).

**Mutation-tested and confirmed the kill**: changed `items: ctx.store.all()` to
`items: ctx.store.all().filter((i) => i.layer === 'project')` in `doctor.ts` — the "present"
control test failed immediately (`orphan_relation` appeared where the test asserts it must
not), exactly the regression `checkOrphanRelations`'s own doc comment warns about. Reverted and
reconfirmed 25/25 green.

## MINOR items addressed

- `registerCommand`'s `summary` string updated from five checks to six: `'self-check: index
  freshness, orphans, drift, dead globs, permissions, session ids'`. No test asserted the old
  string verbatim, so nothing else needed updating.
- Added `summarize counts infos, not just errors and warnings` — asserts `{ errors, warnings,
  infos }` on a synthetic finding list with two infos and one warn, closing the gap where
  `infos` was never independently asserted anywhere.
- Added `within the same level, grouped codes are ordered alphabetically` (dead_scope vs
  source_drift, both warn). Mutation-tested: flipping the tie-break to `b[0].localeCompare(a[0])`
  failed this test immediately. Reverted.
- Added `the summary total matches the number of individually printed findings` (asserts
  `across 3 finding(s)` on a 3-dead-scope fixture). Mutation-tested: hardcoding the summary's
  total to `counts.errors` instead of `findings.length` failed this test immediately (produced
  `across 0 finding(s)` while three `dead_scope` findings were printed above it). Reverted.
- Added `session id mismatch: non-.json files in .ingest/ (applied logs, stale .tmp-) are never
  inspected` covering the `.endsWith('.json')` filter directly (an applied-log `.jsonl` file and
  a stale `.tmp-1234` crash-leftover, both ignored).
- Fixed the pre-existing stale doc comment on `checkIndexFreshness` (a Task 11 leftover, in a
  file this task already touches): it claimed the check "does NOT see edits to `root/config.json`"
  while the code two lines below folds `config.json`'s mtime into `newest`. Corrected to say it
  DOES see config.json edits, and narrowed the caveat to what's actually still true (no
  visibility into a neighboring global layer).

## Re-verification

- `npx tsc --noEmit`: clean.
- `npm test` (full suite), run twice: **1036/1036 passing** both times (1028 prior + 8 net new:
  2 protocol-gate tests, 1 non-.json-files test, 2 cross-layer control tests, 1 infos test, 1
  alphabetical-tie-break test, 1 summary-total test).
- Every new/changed guard hand-mutated and confirmed to fail its test, then reverted:
  protocol-gate deletion, cross-layer `items` filter, summary total hardcode, alphabetical
  tie-break reversal.
- `mycontext doctor` against this repo's own `.my_context/` (39 items): still clean —
  `my_context doctor: 0 error(s), 0 warning(s), 0 note(s) across 0 finding(s).`, exit 0.

## Commit (round 2)

Committed as a follow-up fix addressing the review.
