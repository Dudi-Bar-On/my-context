---
id: TASK-the-product-overwrote-the-repository-s-root-gitignore-with-a
type: task
title: the product overwrote the repository's root .gitignore with a lone star
status: active
severity: soft
always: false
summary: A private-state directory is supposed to get a one-line ignore file when it is created; one code path wrote that line into the project's own top-level ignore file instead, hiding every file in the repository from git.
summary_of: a3c4ee9189263577
scope: []
tags:
  - "plan:release"
  - "seq:25"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-23
valid_until: null
checksum: 419e731c381e37c6
plan: release
seq: "25"
state: done
---

# the product overwrote the repository's root .gitignore with a lone star

Found by lane 3.9 round 3 on 2026-09-23: the root .gitignore of this repository had been truncated to a single line, *, before the lane's session began; the lane restored it from HEAD. Earlier that day git add refused reports/V2-HANDOVER.md with paths are ignored: reports, which is this defect showing. The product writes a * .gitignore into .my_context/.audit, .my_context/state and siblings on first use (ensureLogDir in src/core/audit.ts:58, src/core/ledger.ts:764 and :1124, src/core/continuity.ts:349, and the lane counted seven candidate call sites); one of them resolved its directory to the repository root - the e2e frozen-corpus junction, MYCONTEXT_UI_SESSIONS_DIR pointing at the root, or a relative path resolved from the wrong cwd are the suspects. Closing condition: the call site is found with evidence (which path, which invocation), the write refuses any target that is not a directory the product itself created under .my_context (or the sessions dir it was given) and never a file that already has other content, a test plants each suspect condition and asserts the root .gitignore is untouched, and git diff shows .gitignore equal to its committed version after a full npm test and one e2e gate. Files: the seven call sites and their tests. Release phase 3 - a product bug that damages a user's repository is fixed before the phase closes.

Call site found with evidence, 2026-09-23 by the dispatching session. The invocation: a bare node --test (pid 137428, started 02:30:14Z, cwd the repository root, spawned by a lane's shell wrapper, pid 244168) with no file argument, which Node's default pattern expands to every .ts under test/** — fixtures and helpers included, run as top-level scripts with no argv. test/fixtures/force-stat-failure.ts line 42 reads appendJsonlLine(process.argv[4] ?? '.', ...); with no argv the directory is '.', ensureLogDir('.') joined '.gitignore' onto it, and the working directory was this repository. The write landed at 02:31Z (file mtime); the run then hung on the argument-less fixtures (jsonl-append-racer spins on an existsSync of undefined) and was still alive at 09:59Z, when it was stopped. Reproduced under the fix: the same fixture with no argv in a scratch directory holding .git and a two-line .gitignore prints 'my_context: refused to write a `*` .gitignore into . — a relative target resolves against the working directory rather than a corpus' and leaves the file untouched. npm test (the preload plus test/**/*.test.ts) never runs a fixture bare, which is why the interceptor over it was clean. The fix is commits 23270571 and 6b350370; the fixture's '.' default is removed in the same phase so the fixture refuses to run without its directory.

Closed 2026-09-23 by the dispatching session. The fixture's '.' default is gone (876285e3: run bare it exits 2 and names its three arguments). The closing condition's runs: npm test by the lane on 6b350370 (9045 tests, 0 failed) and one full browser gate on 016483a4 (1401 passed, 5 phase-1 failures all cleared serially, 8 skipped, exit 0, 51.9 min), after which git diff -- .gitignore was empty and the tree clean. Fix commits 23270571, 6b350370, 876285e3; reviews clean.
