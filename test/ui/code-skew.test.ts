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
 * **`codeRoot` points the measurement at a temporary tree, deliberately.** The
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
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { stampCodeIdentity } from '../../src/ui/code-identity.ts';
import { TOKEN_HEADER } from '../../src/ui/security.ts';
import { CODE_FREEZE_NOTICE, startUiServer, type RunningUiServer } from '../../src/ui/server.ts';
// Pins the session store out of the real `~/.my-context`; see the module.
import '../helpers/pin-sessions-dir.ts';

/* -------------------------------------------------------------------------- *
 * A stand-in for `src/`: two "server modules" and one "browser asset".
 * -------------------------------------------------------------------------- */

function codeTree(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-code-'));
  mkdirSync(path.join(root, 'ui', 'public', 'screens'), { recursive: true });
  writeFileSync(path.join(root, 'core-select.ts'), 'export const TIERS = 4;\n', 'utf8');
  writeFileSync(path.join(root, 'ui', 'server.ts'), 'export const X = 1;\n', 'utf8');
  writeFileSync(
    path.join(root, 'ui', 'public', 'screens', 'preview.js'),
    'export const TRACKS = 4;\n', 'utf8');
  return root;
}

const screen = (root: string): string =>
  path.join(root, 'ui', 'public', 'screens', 'preview.js');

/* -------------------------------------------------------------------------- *
 * The unit: what the identity is, and what moves it.
 * -------------------------------------------------------------------------- */

test('a tree nobody touched is not stale', () => {
  const root = codeTree();
  try {
    const code = stampCodeIdentity(root);
    assert.equal(code.isStale(), false);
    assert.equal(code.isStale(), false, 'asking twice must not change the answer');
    assert.equal(code.root, root);
    assert.match(code.startedAt, /^\d{4}-\d{2}-\d{2}T/, 'startedAt is ISO-8601');
  } finally { removeTree(root); }
});

test('a browser asset edited under a running stamp is stale — the reported case', () => {
  const root = codeTree();
  try {
    const code = stampCodeIdentity(root);
    assert.equal(code.isStale(), false);
    writeFileSync(screen(root), 'export const TRACKS = 5;\n', 'utf8');
    assert.equal(code.isStale(), true);
  } finally { removeTree(root); }
});

test('a SERVER module edited under a running stamp is stale too', () => {
  // The half the browser can never see: `core/select.ts` changed, the assets
  // did not, and the page is now asking a server that cannot answer.
  const root = codeTree();
  try {
    const code = stampCodeIdentity(root);
    writeFileSync(path.join(root, 'core-select.ts'), 'export const TIERS = 5;\n', 'utf8');
    assert.equal(code.isStale(), true);
  } finally { removeTree(root); }
});

test('a file that appears, and a file that vanishes, are both stale', () => {
  const root = codeTree();
  try {
    const added = stampCodeIdentity(root);
    writeFileSync(path.join(root, 'ui', 'public', 'screens', 'docs.js'), 'export const A = 1;\n', 'utf8');
    assert.equal(added.isStale(), true, 'a new module is code this process never loaded');

    const removed = stampCodeIdentity(root);
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
    const code = stampCodeIdentity(root);
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
  const code = stampCodeIdentity(root);
  assert.equal(code.isStale(), false);
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
  const server = await startUiServer({ cwd, idleMs: 60_000, codeRoot });
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
