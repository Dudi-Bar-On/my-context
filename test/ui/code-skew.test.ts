/**
 * **The measurement, performed** — `plan:live seq:12`.
 *
 * A server is started against one set of assets, the assets are changed UNDER
 * IT, and the server is asked again:
 *
 *     endpoint      before the edit    after the edit
 *     /api/ping     staleCode false    staleCode true
 *     /api/meta     staleCode false    staleCode true
 *
 * That is the whole task. `serveStatic` reads `src/ui/public/` from disk on
 * every request; the TypeScript modules behind `/api/` loaded once, at process
 * start. Measured on 2026-08-28, the gap was four hours — a browser drawing a
 * five-track ribbon against a server that knew four tiers — and NOTHING said
 * so. The read-through is not the defect and is asserted UNCHANGED below; the
 * silence is.
 *
 * **`code` points the measurement at a temporary tree, deliberately.** The
 * fact under test is "the source on disk is not the source this process
 * loaded", and the honest way to produce it is to change a source file while a
 * server runs. Doing that to the repository's own `src/` would edit, mid-run,
 * the tree every other test in this suite is reading — the shared-mutable-
 * resource defect this project has already recorded — and would leave the
 * working tree dirty if the process died between the edit and the restore. A
 * temporary tree is the same measurement with nothing else in the blast
 * radius; `test/ui/code-skew.test.ts` is the only caller that supplies the
 * option and `server.ts` says so where it declares it.
 *
 * The unit half below covers what the endpoint half cannot reach cheaply: that
 * CONTENT decides and mtime does not, which is what stops a `git checkout` of
 * identical bytes from raising a banner nobody can act on.
 *
 * ── AND SINCE 2026-09-01, WHAT IS OUT OF SCOPE ─────────────────────────────
 *
 * The disclosure fired on work it had nothing to do with. The scope was the
 * whole `src/` tree, so a lane editing `src/cli/commands/statusline-powerline
 * .ts` — a file no request this server answers has ever loaded — told every
 * open page to restart a server that was current. Two tests below are the other
 * half of every assertion above: an unimported sibling raises NOTHING, and the
 * scope derived over this repository's real source contains the modules the
 * server loads and not the ones it does not. A disclosure this file only ever
 * asserted the firing of is one nothing stops from firing always.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { codeScope, stampCodeIdentity, type CodeScope } from '../../src/ui/code-identity.ts';
import { TOKEN_HEADER } from '../../src/ui/security.ts';
import { CODE_FREEZE_NOTICE, startUiServer, type RunningUiServer } from '../../src/ui/server.ts';
// Pins the session store out of the real `~/.my-context`; see the module.
import '../helpers/pin-sessions-dir.ts';

/* -------------------------------------------------------------------------- *
 * A stand-in for the server's scope: an entry module, a module it IMPORTS, a
 * module beside it that it does not, and one browser asset.
 *
 * **The import edge is the fixture now, and that is the point.** The scope used
 * to be a directory and the shape of this tree did not matter; since 2026-09-01
 * it is the import closure of the entry module, so `core-select.ts` is in scope
 * BECAUSE `ui/server.ts` names it, and `statusline-powerline.ts` is out of it
 * because nothing does. Those are the two halves of the defect this file
 * measures, standing in for the real files by the same relationship rather than
 * by the same path.
 * -------------------------------------------------------------------------- */

function codeTree(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-code-'));
  mkdirSync(path.join(root, 'ui', 'public', 'screens'), { recursive: true });
  writeFileSync(path.join(root, 'core-select.ts'), 'export const TIERS = 4;\n', 'utf8');
  writeFileSync(
    path.join(root, 'ui', 'server.ts'),
    "import { TIERS } from '../core-select.ts';\nexport const X = TIERS;\n", 'utf8');
  // The sibling nobody imports — this tree's `statusline-powerline.ts`. Editing
  // it must raise NOTHING, which is the whole of the 2026-09-01 report.
  writeFileSync(path.join(root, 'statusline-powerline.ts'), 'export const BAR = 1;\n', 'utf8');
  writeFileSync(
    path.join(root, 'ui', 'public', 'screens', 'preview.js'),
    'export const TRACKS = 4;\n', 'utf8');
  return root;
}

/** What `stampCodeIdentity` and `startUiServer` are pointed at for this tree. */
const scopeOf = (root: string): CodeScope => ({
  entry: path.join(root, 'ui', 'server.ts'),
  assets: path.join(root, 'ui', 'public'),
});

const screen = (root: string): string =>
  path.join(root, 'ui', 'public', 'screens', 'preview.js');

/**
 * Change a file, and leave its mtime observably later than it was.
 *
 * **The bump is not decoration and it does not weaken anything.** `isStale()`
 * gates its exact comparison on a cheap size-and-mtime stamp, and every edit in
 * this file replaces a line with one of the SAME LENGTH — so the whole of the
 * evidence that anything happened is the mtime. Measured on this machine,
 * 2026-09-01: 1 rewrite in 200 with nothing between the two writes came back on
 * the identical NTFS timestamp, and the assertion below then failed for the
 * clock rather than for the code. A person editing a file never lands inside
 * that window; a test loop does, ~0.5% of the time, which is exactly the flake
 * that is worst to own.
 *
 * CONTENT still decides the answer — `utimesSync` cannot make identical bytes
 * read as stale, and the test that proves that deliberately does NOT use this.
 */
function edit(file: string, text: string): void {
  writeFileSync(file, text, 'utf8');
  const later = new Date(Date.now() + 1_000);
  utimesSync(file, later, later);
}

/* -------------------------------------------------------------------------- *
 * The unit: what the identity is, and what moves it.
 * -------------------------------------------------------------------------- */

test('a tree nobody touched is not stale', () => {
  const root = codeTree();
  try {
    const code = stampCodeIdentity(scopeOf(root));
    assert.equal(code.isStale(), false);
    assert.equal(code.isStale(), false, 'asking twice must not change the answer');
    assert.deepEqual(code.scope, scopeOf(root));
    // entry + the module it imports + the one asset. NOT the sibling beside
    // them: four files exist under this root and the scope is three.
    assert.equal(code.files, 3, 'the scope is the import closure plus the assets, and no more');
    assert.match(code.startedAt, /^\d{4}-\d{2}-\d{2}T/, 'startedAt is ISO-8601');
  } finally { removeTree(root); }
});

test('a module NOTHING imports is not this server’s code, and raises nothing', () => {
  // The 2026-09-01 report, reduced to its one moving part: a lane edits a file
  // beside the server's own, the server never loaded it, and the page must not
  // be told to restart. Asserted beside the four positives above rather than
  // instead of them — the disclosure has to keep firing for what it is for.
  const root = codeTree();
  try {
    const code = stampCodeIdentity(scopeOf(root));
    assert.equal(code.isStale(), false);
    edit(path.join(root, 'statusline-powerline.ts'), 'export const BAR = 2;\n');
    assert.equal(code.isStale(), false,
      'a sibling module the entry does not import is not code this server answers from');
    // ...and the scope has not merely gone deaf: the module the entry DOES
    // import still moves it. Without this the assertion above passes for a
    // stamp that stopped measuring anything at all.
    edit(path.join(root, 'core-select.ts'), 'export const TIERS = 5;\n');
    assert.equal(code.isStale(), true);
  } finally { removeTree(root); }
});

test('a module that BECOMES imported joins the scope', () => {
  // The set is re-derived, not frozen at boot: an entry that grows an import
  // grows the scope with it. Without this a file could be added to the server's
  // graph after start and then change unnoticed for the life of the process.
  const root = codeTree();
  try {
    const code = stampCodeIdentity(scopeOf(root));
    writeFileSync(path.join(root, 'ui', 'server.ts'),
      "import { TIERS } from '../core-select.ts';\n"
      + "import { BAR } from '../statusline-powerline.ts';\n"
      + 'export const X = TIERS + BAR;\n', 'utf8');
    assert.equal(code.isStale(), true, 'the entry itself changed');

    const after = stampCodeIdentity(scopeOf(root));
    assert.equal(after.files, 4, 'the newly imported sibling is in scope now');
    edit(path.join(root, 'statusline-powerline.ts'), 'export const BAR = 2;\n');
    assert.equal(after.isStale(), true);
  } finally { removeTree(root); }
});

test('a browser asset edited under a running stamp is stale — the reported case', () => {
  const root = codeTree();
  try {
    const code = stampCodeIdentity(scopeOf(root));
    assert.equal(code.isStale(), false);
    edit(screen(root), 'export const TRACKS = 5;\n');
    assert.equal(code.isStale(), true);
  } finally { removeTree(root); }
});

test('a SERVER module edited under a running stamp is stale too', () => {
  // The half the browser can never see: `core/select.ts` changed, the assets
  // did not, and the page is now asking a server that cannot answer.
  const root = codeTree();
  try {
    const code = stampCodeIdentity(scopeOf(root));
    edit(path.join(root, 'core-select.ts'), 'export const TIERS = 5;\n');
    assert.equal(code.isStale(), true);
  } finally { removeTree(root); }
});

test('a file that appears, and a file that vanishes, are both stale', () => {
  const root = codeTree();
  try {
    const added = stampCodeIdentity(scopeOf(root));
    edit(path.join(root, 'ui', 'public', 'screens', 'docs.js'), 'export const A = 1;\n');
    assert.equal(added.isStale(), true, 'a new module is code this process never loaded');

    const removed = stampCodeIdentity(scopeOf(root));
    rmSync(path.join(root, 'ui', 'public', 'screens', 'docs.js'));
    assert.equal(removed.isStale(), true, 'a deleted module is code this process still holds');
  } finally { removeTree(root); }
});

test('CONTENT decides, not mtime — a checkout of identical bytes raises nothing', () => {
  // The false positive that would teach a reader to ignore the banner: `git
  // checkout`, a formatter, a backup tool. Every one of them moves an mtime
  // and changes nothing this process loaded.
  const root = codeTree();
  try {
    const code = stampCodeIdentity(scopeOf(root));
    const file = screen(root);
    const bytes = readFileSync(file);
    const later = new Date(Date.now() + 60_000);
    writeFileSync(file, bytes);
    utimesSync(file, later, later);
    assert.equal(code.isStale(), false, 'same bytes, newer mtime: nothing to disclose');

    // ...and the exactness survives a real edit arriving after the touch.
    writeFileSync(file, 'export const TRACKS = 5;\n', 'utf8');
    assert.equal(code.isStale(), true);
  } finally { removeTree(root); }
});

test('an unreadable root discloses nothing rather than inventing a skew', () => {
  const root = path.join(tmpdir(), 'myctx-code-does-not-exist-58f0');
  const code = stampCodeIdentity(scopeOf(root));
  assert.equal(code.isStale(), false);
});

/**
 * **The scope, derived over THIS repository, named file by file.**
 *
 * The temporary tree above proves the rule; only the real source proves the
 * rule was pointed at the right thing. Everything named below is named for a
 * reason the 2026-09-01 report gives:
 *
 *   `core/select.ts`                    the module whose four-hour skew is the
 *                                       reason this file exists. IN.
 *   `cli/commands/injection.ts`         `read-model.ts` imports it, so it is
 *                                       really loaded. IN — and it is why the
 *                                       scope may not be "exclude src/cli/".
 *   `cli/commands/statusline-powerline` the file the lane was editing when the
 *                                       modal fired. OUT.
 *   `mcp/protocol.ts` is deliberately NOT asserted either way: it is in scope
 *   today through `mcp/tools.ts`, and if an import moves it out that is a fact
 *   about the code and not a regression in this file.
 */
test('the scope over the real source is what the server loads, and not its siblings', () => {
  const src = path.join(import.meta.dirname, '..', '..', 'src');
  const files = new Set(codeScope({
    entry: path.join(src, 'ui', 'server.ts'),
    assets: path.join(src, 'ui', 'public'),
  }));
  const at = (...parts: string[]): string => path.join(src, ...parts);

  // A derivation that answered the empty set would pass every "not in scope"
  // assertion below for the wrong reason.
  assert.ok(files.size > 100, `the real scope came to ${files.size} files`);
  assert.ok(files.has(at('ui', 'server.ts')), 'the entry is in its own closure');
  assert.ok(files.has(at('ui', 'public', 'app.js')), 'and so is what the browser is served');

  assert.ok(files.has(at('core', 'select.ts')),
    'core/select.ts is imported by read-model.ts and is the skew this file was written for');
  assert.ok(files.has(at('cli', 'commands', 'injection.ts')),
    'the server really does import three files under src/cli/commands/, which is why the '
    + 'scope may not be a list of directories to exclude');

  assert.ok(!files.has(at('cli', 'commands', 'statusline-powerline.ts')),
    'the terminal status line is not code this server answers from — the 2026-09-01 report');
  assert.ok(!files.has(at('cli', 'commands', 'statusline.ts')),
    'nor is the command that prints it');
  assert.ok(!files.has(at('cli', 'index.ts')),
    'the CLI entry loads this server; this server does not load the CLI entry');

  // The scope is narrower than the tree it used to be, and by how much is the
  // measurement the fix is worth. Bounded on both sides: a scope that quietly
  // grew back to the whole of `src/` would pass a one-sided assertion.
  const all = new Set<string>();
  const walkSrc = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) walkSrc(child);
      else if (entry.isFile()) all.add(child);
    }
  };
  walkSrc(src);
  assert.ok(files.size < all.size * 0.8,
    `the scope is ${files.size} of ${all.size} files under src/ — it was all of them`);
  for (const file of files) {
    assert.ok(all.has(file), `${file} is in the scope and not under src/`);
  }
});

/* -------------------------------------------------------------------------- *
 * The endpoints: the disclosure the shell actually reads.
 * -------------------------------------------------------------------------- */

interface Harness { server: RunningUiServer; token: string; codeRoot: string }

function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-skew-'));
  assert.equal(runCli(['init'], dir, () => {}), 0);
  return dir;
}

async function tokenFor(server: RunningUiServer): Promise<string> {
  const nonce = new URL(server.urlWithNonce(10_000)).hash.slice(1);
  const response = await fetch(`http://127.0.0.1:${server.port}/api/handoff`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nonce }),
  });
  assert.equal(response.status, 200);
  return ((await response.json()) as { token: string }).token;
}

async function withServer(body: (h: Harness) => Promise<void>): Promise<void> {
  const cwd = project();
  const codeRoot = codeTree();
  const server = await startUiServer({ cwd, idleMs: 60_000, code: scopeOf(codeRoot) });
  try {
    await body({ server, codeRoot, token: await tokenFor(server) });
  } finally {
    await server.close();
    removeTree(cwd);
    removeTree(codeRoot);
  }
}

const get = async (h: Harness, target: string): Promise<Record<string, unknown>> => {
  const res = await fetch(`http://127.0.0.1:${h.server.port}${target}`,
    { headers: { [TOKEN_HEADER]: h.token } });
  assert.equal(res.status, 200, `${target} answered ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
};

test('the assets change under a running server, and BOTH endpoints say so', async () => {
  await withServer(async (h) => {
    const pingBefore = await get(h, '/api/ping');
    const metaBefore = await get(h, '/api/meta');
    assert.equal(pingBefore['ok'], true, 'the heartbeat still answers what it always did');
    assert.equal(pingBefore['staleCode'], false);
    assert.equal(metaBefore['staleCode'], false);
    assert.equal(typeof metaBefore['startedAt'], 'string');
    assert.equal(typeof metaBefore['version'], 'string', 'the pre-existing fields are untouched');
    assert.ok('git' in metaBefore, 'the pre-existing fields are untouched');

    // 17:42: the feature lands while the process from 13:58 keeps running.
    writeFileSync(screen(h.codeRoot), 'export const TRACKS = 5;\n', 'utf8');

    const pingAfter = await get(h, '/api/ping');
    const metaAfter = await get(h, '/api/meta');
    assert.equal(pingAfter['staleCode'], true,
      'the heartbeat is the only channel a morning tab polls');
    assert.equal(metaAfter['staleCode'], true);
    assert.equal(metaAfter['startedAt'], metaBefore['startedAt'],
      "the stamp is the process's load moment and does not move under it");
  });
});

test('the two endpoints cannot disagree — one identity, two readers', async () => {
  await withServer(async (h) => {
    // A server-only change: the browser's assets are byte-identical, and the
    // disclosure still fires — because the question is what the PROCESS loaded,
    // not what the page was served.
    writeFileSync(path.join(h.codeRoot, 'core-select.ts'), 'export const TIERS = 5;\n', 'utf8');
    assert.equal((await get(h, '/api/ping'))['staleCode'], true);
    assert.equal((await get(h, '/api/meta'))['staleCode'], true);
  });
});

/* -------------------------------------------------------------------------- *
 * The rulings, held as assertions rather than as comments.
 * -------------------------------------------------------------------------- */

/**
 * A source file, with line endings normalised: this repository is checked out
 * CRLF on Windows, and an `\n` in a pattern below would otherwise fail for the
 * checkout rather than for the code.
 */
const source = (...parts: string[]): string =>
  readFileSync(path.join(import.meta.dirname, '..', '..', 'src', ...parts), 'utf8')
    .replaceAll('\r\n', '\n');

/**
 * `assert.ok(re.test(…))` rather than `assert.match`: these files are tens of
 * kilobytes and a failed `assert.match` prints the whole haystack, which buries
 * the one sentence that says what went wrong.
 */
function assertMatches(text: string, pattern: RegExp, message: string): void {
  assert.ok(pattern.test(text), `${message}\n  pattern: ${String(pattern)}`);
}

test('the live static read-through is UNCHANGED — the ruling, not a comment', () => {
  // "Do not solve it by disabling the static read-through. Live assets are what
  // makes UI iteration fast here." A fix that bought disclosure with a cache
  // would pass every other assertion in this file.
  const staticTs = source('ui', 'static.ts');
  assertMatches(staticTs, /return \{ status: 200, contentType, body: readFileSync\(resolved\) \};/,
    'serveStatic must still read the file on every request');
  assert.equal(/\bCache-Control\b|\bcache\b/i.test(staticTs.replace(/^\s*\*.*$/gm, '')), false,
    'no cache was introduced into the static path');
});

test('the shell reads staleCode from BOTH channels it has', () => {
  const app = source('ui', 'public', 'app.js');
  // **Loosened from the point-free `.then(noteCodeSkew)` to "the heartbeat's
  // answer reaches it", on 2026-08-31, when `plan:walk seq:4`'s corpus-drift
  // disclosure joined this request.** Both facts ride the heartbeat for the
  // identical reason, so the handler is no longer a bare function reference —
  // and pinning the exact old spelling would have made a SECOND disclosure
  // arriving on the same channel read as the first one leaving. What this file
  // is about is that the disclosure reaches a tab open since the morning, and
  // that is what is asserted.
  // **Loosened a second time, on 2026-08-31, when `plan:walk seq:124`'s
  // occupancy reading joined this request and made the target a session-scoped
  // one.** The heartbeat now sends `?session=…`, so the literal `'/api/ping'`
  // is a prefix rather than the whole argument. Pinning the closing paren would
  // make a THIRD disclosure arriving on the same channel read as the first one
  // leaving, which is the mistake this test's own header warns about. What is
  // asserted is unchanged: it is `/api/ping`, and the answer reaches
  // `noteCodeSkew`.
  assertMatches(app, /api\('\/api\/ping'[^;]{0,40}?\)\.then\(\(answer\) => \{[\s\S]{0,200}?noteCodeSkew\(answer\);/,
    'the heartbeat must carry the disclosure: it is the only poll a morning tab makes');
  assertMatches(app, /startHeartbeat\(\s*\n?\s*document, \(\) => api\('\/api\/ping'[^;]{0,40}?\)/,
    'and it must still BE the heartbeat that carries it, not a poll of its own');
  assertMatches(app, /const meta = await api\('\/api\/meta'\);\n(?:\s*\/\/.*\n)*\s*noteCodeSkew\(meta\);/,
    'first paint must disclose too, without waiting up to a minute');
  assertMatches(app, /const CODE_SKEW_KEY = 'ex\.codeSkew';/,
    'the pending string key is named in the shell, not left to memory');
});

/**
 * **The corpus-drift disclosure rides the SAME two channels, and that is not a
 * coincidence for the next reader to re-derive.**
 *
 * `plan:walk seq:4` shipped `measureCorpusDrift` and put its answer on
 * `/api/ping` and `/api/meta` — the two requests `staleCode` already used, for
 * the argument `server.ts` writes out in full: the heartbeat is the only
 * channel that reaches a tab open since the morning, and `/api/meta` is the
 * only one that reaches a tab in its first minute. It then drew NOTHING, and
 * that is the failure this asserts against — a field served on two channels
 * and read on neither is indistinguishable from a field nobody added.
 */
test('the shell reads the corpus drift from BOTH channels it has', () => {
  const app = source('ui', 'public', 'app.js');
  assertMatches(app, /noteCorpusDrift\(answer\);/,
    'the heartbeat must carry the drift too: a corpus moves while a tab sits open in a way a '
    + "server's own code cannot");
  assertMatches(app, /noteCorpusDrift\(meta\);/,
    'first paint must disclose too, without waiting up to a minute for the first ping');
});

test('mycontext ui says at start that its code is frozen', () => {
  assert.match(CODE_FREEZE_NOTICE, /^mycontext ui: /);
  assert.match(CODE_FREEZE_NOTICE, /restart/);
  assert.match(CODE_FREEZE_NOTICE, /src\/ui\/public\//);
  assertMatches(source('cli', 'commands', 'ui.ts'), /out\(CODE_FREEZE_NOTICE\);/,
    'and it is actually printed');
});
