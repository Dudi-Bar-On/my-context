import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { serveStatic } from '../../src/ui/static.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * **A traversal test proves nothing unless the file it reaches for is one the
 * server would otherwise serve.**
 *
 * The plan's own list — `/../server.ts`, `/strings/../../security.ts` — is
 * refused by the EXTENSION allow-list, because `.ts` is not one of the four
 * kinds `static.ts` serves, and two of its five entries name a file that does
 * not exist yet at all. Every one of those assertions therefore passes with
 * the containment check deleted: they are green against a server with no
 * traversal defence whatsoever. They are kept below, because they are cheap
 * and they pin the plan's own cases, but each guard also gets an input that
 * ONLY it refuses:
 *
 *   - containment  → an `.html` and a `.js` outside the public directory
 *                    (`docs/design/web-ui-mockup.html` in the real tree, and
 *                    `outside/secret.js` in the fixture)
 *   - `root + sep` → a SIBLING directory whose name starts with the root's
 *   - the link check → a symlink/junction under the root pointing out of it
 *   - the extension list → a `.txt` that really is there
 *   - the backslash refusal → `/sub\mod.js`, which never leaves the root
 *
 * Each of those is paired with a positive control asserting the same bytes ARE
 * served when they legitimately can be, so a test that goes green because the
 * fixture broke is distinguishable from one that goes green because the guard
 * held.
 */

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');

interface Fixture {
  root: string;
  publicDir: string;
  done(): void;
}

/**
 * A public directory with something worth stealing on every side of it:
 *
 *   <root>/public/          the directory under test
 *   <root>/public/sub/mod.js
 *   <root>/public/notes.txt an allowed NAME with a refused EXTENSION
 *   <root>/outside/secret.js  a servable extension, outside the root
 *   <root>/publicked/leak.js  a sibling whose name starts with "public"
 *
 * The root is realpath-ed on the way out: on macOS `os.tmpdir()` is a symlink
 * to `/private/var/...`, and a test that compared unresolved paths would be
 * asserting the platform rather than the guard.
 */
function fixture(): Fixture {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'mycontext-static-')));
  const publicDir = path.join(root, 'public');
  mkdirSync(path.join(publicDir, 'sub'), { recursive: true });
  writeFileSync(path.join(publicDir, 'index.html'), '<!doctype html><title>fixture</title>');
  writeFileSync(path.join(publicDir, 'styles.css'), '/* fixture */');
  writeFileSync(path.join(publicDir, 'sub', 'mod.js'), 'export const inside = true;\n');
  writeFileSync(path.join(publicDir, 'notes.txt'), 'not a kind this directory serves');
  mkdirSync(path.join(root, 'outside'));
  writeFileSync(path.join(root, 'outside', 'secret.js'), 'export const SECRET = 1;\n');
  mkdirSync(path.join(root, 'publicked'));
  writeFileSync(path.join(root, 'publicked', 'leak.js'), 'export const LEAK = 1;\n');
  return { root, publicDir, done: () => removeTree(root) };
}

/**
 * Assert that a request serves nothing.
 *
 * **The comparison is on a BOOLEAN, and the size goes in the MESSAGE.** That
 * is not a style preference. `assert.equal(serveStatic(evil, PUBLIC), null)`
 * hands node:test an object holding the whole served file whenever the guard
 * under test is broken, and the runner then serializes it to report the
 * failure: with the containment check mutated away, the 267KB of
 * `web-ui-mockup.html` this file reaches for took **4m35s** and died with
 * `FATAL ERROR: … JavaScript heap out of memory` before printing which path
 * had leaked. A test whose failure path cannot report itself is a test nobody
 * can read on the one day it matters — and, run under `scripts/mutate.ts`,
 * `INCONCLUSIVE` and `KILLED` become hard to tell apart.
 */
function refused(pathname: string, publicDir: string, why = ''): void {
  const result = serveStatic(pathname, publicDir);
  assert.equal(
    result === null, true,
    `${JSON.stringify(pathname)} must serve nothing${why === '' ? '' : ` — ${why}`}; `
    + `it served ${result?.body.length ?? 0} bytes as ${result?.contentType ?? '(none)'}`,
  );
}

test('/ serves index.html as text/html', () => {
  const result = serveStatic('/', PUBLIC);
  assert.ok(result, '/ must resolve to the shell');
  assert.equal(result.status, 200);
  assert.equal(result.contentType, 'text/html; charset=utf-8');
  assert.deepEqual(
    result.body,
    readFileSync(path.join(PUBLIC, 'index.html')),
    '/ must serve index.html byte for byte, not a rendering of it',
  );
});

test('/index.html and / are the same bytes', () => {
  const slash = serveStatic('/', PUBLIC);
  const named = serveStatic('/index.html', PUBLIC);
  assert.ok(slash && named);
  assert.deepEqual(named.body, slash.body);
});

test('a JS module and the stylesheet serve with correct types', () => {
  assert.equal(serveStatic('/strings/en.js', PUBLIC)?.contentType, 'text/javascript; charset=utf-8');
  assert.equal(serveStatic('/styles.css', PUBLIC)?.contentType, 'text/css; charset=utf-8');
});

test('a nested asset serves its own bytes, so subdirectories are reachable at all', () => {
  const result = serveStatic('/strings/he.js', PUBLIC);
  assert.ok(result, 'strings/he.js must be reachable — the app loads it by that path');
  assert.deepEqual(result.body, readFileSync(path.join(PUBLIC, 'strings', 'he.js')));
});

test('a percent-encoded character in a legitimate name still names that file', () => {
  // `%2E` is `.` (RFC 3986 §2.1), so this is `strings/en.js` spelled the long
  // way. Nothing sends it — but it is the only assertion in this file that
  // fails if the decode step is deleted, and the decode step is what makes
  // `%2e%2e` mean `..` and therefore what the containment check is FOR.
  const encoded = serveStatic('/strings/en%2Ejs', PUBLIC);
  const plain = serveStatic('/strings/en.js', PUBLIC);
  assert.ok(encoded && plain);
  assert.deepEqual(encoded.body, plain.body, 'a decoded name resolves to the same file');
});

test('path traversal cannot escape the public directory', () => {
  // The plan's five. Every one of them is ALSO refused by the extension
  // allow-list, so none of them can fail a broken containment check on its
  // own — see the test below, which can.
  for (const evil of [
    '/../server.ts', '/..%2Fserver.ts', '/%2e%2e/server.ts',
    '/strings/../../security.ts', '/..\\server.ts',
  ]) {
    refused(evil, PUBLIC);
  }
});

test('traversal to a file the server WOULD serve is refused — the containment check itself', () => {
  // `docs/design/web-ui-mockup.html` is three levels up from `src/ui/public`,
  // it exists, and `.html` is the first entry in the content-type table. With
  // the containment check removed this request returns 200 and 260KB of the
  // design of record; it is the only case in this file that says so.
  const mockup = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');
  assert.ok(readFileSync(mockup).length > 0, 'control: the target really is a servable, existing file');
  for (const evil of [
    '/../../../docs/design/web-ui-mockup.html',
    '/..%2F..%2F..%2Fdocs/design/web-ui-mockup.html',
    '/%2e%2e/%2e%2e/%2e%2e/docs/design/web-ui-mockup.html',
    '/strings/../../../../docs/design/web-ui-mockup.html',
  ]) {
    refused(evil, PUBLIC);
  }
});

test('a fixture asset outside the root is refused, and the same bytes serve when the root contains them', () => {
  const fx = fixture();
  try {
    refused('/../outside/secret.js', fx.publicDir, 'a .js one level outside the public directory');
    refused('/..%2Foutside%2Fsecret.js', fx.publicDir, 'encoded separators do not help');
    refused('/sub/../../outside/secret.js', fx.publicDir, 'a walk back out through a real subdirectory does not help');

    // The control: the refusal above is the guard, not a missing file.
    const served = serveStatic('/secret.js', path.join(fx.root, 'outside'));
    assert.ok(served, 'control: secret.js is a real, servable file');
    assert.equal(served.contentType, 'text/javascript; charset=utf-8');
  } finally {
    fx.done();
  }
});

test('a sibling directory whose name merely starts with the root name is outside it', () => {
  const fx = fixture();
  try {
    // `<root>/publicked` shares a string prefix with `<root>/public`. A
    // containment check written `startsWith(root)` rather than
    // `startsWith(root + path.sep)` serves this.
    refused('/../publicked/leak.js', fx.publicDir, 'the separator in the containment check is load-bearing');
    const served = serveStatic('/leak.js', path.join(fx.root, 'publicked'));
    assert.ok(served, 'control: leak.js is a real, servable file');
  } finally {
    fx.done();
  }
});

test('a link out of the public directory is refused even though its path resolves inside', (t) => {
  const fx = fixture();
  try {
    const link = path.join(fx.publicDir, 'escape');
    try {
      symlinkSync(path.join(fx.root, 'outside'), link, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (err) {
      // Windows needs either developer mode or SeCreateSymbolicLinkPrivilege
      // for a symbolic link; a junction needs neither, which is why one is
      // asked for by name. If even that is refused the guard is untested
      // here rather than silently assumed.
      fx.done();
      t.skip(`cannot create a directory link on this host: ${(err as NodeJS.ErrnoException).code}`);
      return;
    }
    const through = path.join(link, 'secret.js');
    assert.notEqual(
      realpathSync(through), through,
      'control: the link really does leave the directory, so the lexical check cannot see it',
    );
    refused('/escape/secret.js', fx.publicDir, 'a resolved path inside the root is not enough — the real path must be inside it too');
  } finally {
    fx.done();
  }
});

test('an extension the table does not carry is refused even when the file is there', () => {
  const fx = fixture();
  try {
    assert.ok(
      readFileSync(path.join(fx.publicDir, 'notes.txt')).length > 0,
      'control: notes.txt exists inside the public directory',
    );
    refused('/notes.txt', fx.publicDir, 'an unknown kind is a mistake to surface, not an octet-stream to ship');
  } finally {
    fx.done();
  }
});

test('a backslash is refused even when it never leaves the directory', () => {
  const fx = fixture();
  try {
    const forward = serveStatic('/sub/mod.js', fx.publicDir);
    assert.ok(forward, 'control: the same asset serves with a forward slash');
    // On win32 `path.resolve` treats this as `sub/mod.js` and would serve it;
    // on Linux it is a filename containing a backslash and 404s. Refusing it
    // outright is what makes the answer the same on both.
    refused('/sub\\mod.js', fx.publicDir, 'a win32 separator in a URL path must not serve on any platform');
    refused('/sub%5Cmod.js', fx.publicDir, 'the same separator, percent-encoded — the check is after the decode');
  } finally {
    fx.done();
  }
});

test('a missing file is null, not a throw', () => {
  refused('/nope.js', PUBLIC);
});

test('a malformed percent escape is null, not a throw', () => {
  // `decodeURIComponent('/%')` throws URIError. Without the catch this call
  // does not return at all.
  refused('/%', PUBLIC);
  refused('/%zz.js', PUBLIC);
});

test('a name the filesystem will not open is null, not a throw', () => {
  // A NUL survives the extension check — `path.extname` sees `.js` — and
  // reaches `realpathSync`, which throws ERR_INVALID_ARG_VALUE. Written as an
  // escape because a literal NUL would make this file a binary blob to git
  // (`scripts/check-text-files.ts`).
  refused('/strings/en\u0000.js', PUBLIC, 'a raw NUL');
  refused('/strings/en%00.js', PUBLIC, 'the same NUL, percent-encoded');
});

test('a directory is not an asset', () => {
  refused('/strings', PUBLIC);
  refused('/strings/', PUBLIC);
  refused('', PUBLIC, 'an empty pathname resolves to the root itself');
});

test('a public directory that is not there serves nothing rather than throwing', () => {
  const fx = fixture();
  try {
    refused('/index.html', path.join(fx.root, 'no-such-directory'));
  } finally {
    fx.done();
  }
});
