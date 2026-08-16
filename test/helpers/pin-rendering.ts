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
process.env.MYCONTEXT_ASCII = '1';
delete process.env.MYCONTEXT_UNICODE;
delete process.env.MYCONTEXT_WIDTH;
