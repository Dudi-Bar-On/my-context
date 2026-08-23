/**
 * Pins the ambient rendering environment for the whole test suite, so a local
 * run and a CI run lay out every table and paragraph identically.
 *
 * Loaded via `--import` in the `test` script; the test runner spawns each test
 * file with the same command-line options, so every test process gets this
 * before any test code runs.
 *
 * Why it exists: `supportsUnicode()` (src/cli/commands/format.ts) reads the
 * terminal's advertisements — `WT_SESSION`, `TERM_PROGRAM`, `TERM` — which a
 * developer's shell exports and CI's bare runner does not, so on Windows the
 * SAME suite rendered box-drawing borders locally and ASCII `|` on CI. A test
 * that matched a phrase across those bytes was green on every machine that
 * could run it locally and red on the one machine nobody watches
 * interactively (run 31964855211, the second instance of this class after
 * 1af456a). Pinning the ambient answer removes the variable: a test that
 * accidentally depends on the rendering now fails everywhere, not only on CI.
 *
 * ASCII rather than Unicode because ASCII is what CI's Windows runner already
 * answered, so the pin changes nothing where the suite must be green anyway —
 * and because it is the fallback rendering, the one a wrong assumption should
 * be tested against.
 *
 * Tests that are ABOUT the rendering are untouched: they pass
 * `{ unicode: ... }` explicitly or set/delete these variables themselves
 * (format-table.test.ts, output.test.ts's `withRendering`), and the doc
 * example harness builds its own child environment (gen-doc-examples.ts).
 * `MYCONTEXT_WIDTH` is deleted for the same reason it is deleted there: a
 * layout budget exported for a maintainer's own terminal must not reshape the
 * suite's expected output.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { installRealHomeGuard } from './real-home-guard.ts';

process.env.MYCONTEXT_ASCII = '1';
delete process.env.MYCONTEXT_UNICODE;
delete process.env.MYCONTEXT_WIDTH;

/**
 * **And pins the UI session store out of the developer's real home directory.**
 *
 * `core/ui-sessions.ts` defaults to `GLOBAL_DIR` — `~/.my-context` — which is
 * correct for a person and wrong for a suite: every `startUiServer` call, in
 * process or in a spawned child, records the digest of the token it just
 * minted. Left unpinned, a full run would append to the file a real session
 * uses, and `test/ui/session-continuity.test.ts` would be asserting against
 * state some earlier run left behind rather than against what it set up.
 *
 * This is the same class of defect as the rendering pin above, and it has
 * already happened once in a worse form: on 2026-08-22 a fixture wrote items
 * into the real `~/.my-context/` and turned 134 unrelated tests red with a
 * message pointing nowhere near the cause. A child process inherits this
 * environment, so pinning it here covers `spawnUiChild` too.
 *
 * The path is per-process, so parallel test files cannot fight over one file.
 * It is left behind on purpose — a few hundred bytes of digests in the OS
 * temporary directory, which the OS reclaims, and deleting it from a preload
 * would race with the very processes that are still writing to it.
 */
process.env.MYCONTEXT_UI_SESSIONS_DIR = mkdtempSync(path.join(tmpdir(), 'myctx-test-sessions-'));

/**
 * **And fails the run if anything writes into the real `~/.my-context` anyway.**
 *
 * The two pins above are conventions — a person has to know to write them. That
 * is what failed on 2026-08-22 (134 tests red from two stray fixture files) and
 * what nearly failed again the next day with the session store.
 * `installRealHomeGuard` turns the property into a check: it snapshots the real
 * global directory here, BEFORE any test file's top-level code can redirect
 * `HOME`, and fails the test that changed it. Because it compares the DIRECTORY
 * rather than intercepting `fs`, a write by one of this suite's many spawned
 * children is caught too.
 * See `test/helpers/real-home-guard.ts` for the whole argument, and
 * `test/core/real-home-guard.test.ts` for the proof it fires.
 */
installRealHomeGuard();
