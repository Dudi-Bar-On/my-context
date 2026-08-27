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
import './pin-sessions-dir.ts';
import { installRealHomeGuard } from './real-home-guard.ts';

process.env.MYCONTEXT_ASCII = '1';
delete process.env.MYCONTEXT_UNICODE;
delete process.env.MYCONTEXT_WIDTH;

/**
 * **And pins the UI session store out of the developer's real home directory.**
 *
 * Done by importing `./pin-sessions-dir.ts`, which carries the full argument
 * and the measurement. It lives in its own module because this preload covers
 * `npm test` and nothing else: a bare `node --test <file>` loads no preload,
 * and three UI test files were reaching the real store that way.
 *
 * The import is at the top of this file. ESM evaluates it before any statement
 * here runs, so the store is pinned before `installRealHomeGuard` below
 * snapshots the real home.
 */

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
