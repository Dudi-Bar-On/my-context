import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sourceChecksum } from '../../src/ingest/chunk.ts';
import {
  openIngestSession, saveSession, loadSession, listSessions,
  pendingAnchors, makeSessionId, ingestDir, SESSION_PROTOCOL,
  hasApplied, appliedRecordsFor, setApplied,
} from '../../src/ingest/session.ts';
import { removeTree } from '../helpers/tmp.ts';

const DOC = `# Auth\n\nMust support SSO.\n\n# Storage\n\nPostgres only.\n`;

function root(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-ing-'));
}

test('a session id is derived from the source path and content', () => {
  const a = makeSessionId('docs/prd/auth.md', 'abcdef0123456789');
  assert.equal(a, 'ING-docs-prd-auth-md-1b5487eb-abcdef01');
  assert.equal(a, makeSessionId('docs/prd/auth.md', 'abcdef0123456789'));
  assert.notEqual(a, makeSessionId('docs/prd/auth.md', 'ffffffff00000000'));
});

test('two different source files whose paths slugify identically do not collide', () => {
  // "docs/prd/auth.md" and "docs/prd-auth.md" both slugify to "docs-prd-auth-md" —
  // slugify collapses '/' and '-' identically. With identical content, a
  // slug-only id would make the second file silently resume (and overwrite)
  // the first file's session.
  const r = root();
  const a = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, a);
  const b = openIngestSession(r, 'docs/prd-auth.md', DOC);
  assert.notEqual(a.id, b.id);
  assert.equal(b.sourceFile, 'docs/prd-auth.md');
  assert.deepEqual(b.applied, {});
  removeTree(r);
});

test('a source path must be POSIX-relative — backslashes are refused, not silently accepted', () => {
  assert.throws(() => makeSessionId('docs\\prd\\auth.md', 'abcdef0123456789'), /POSIX/);
  const r = root();
  assert.throws(() => openIngestSession(r, 'docs\\prd\\auth.md', DOC), /POSIX/);
  removeTree(r);
});

test('loadSession refuses a session id that looks like a path — no traversal outside .ingest/', () => {
  const r = root();
  assert.throws(() => loadSession(r, '../secret'), /invalid ingest session id/);
  assert.throws(() => loadSession(r, '..\\secret'), /invalid ingest session id/);
  removeTree(r);
});

test('saveSession refuses a session whose id looks like a path — no traversal outside .ingest/', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.throws(() => saveSession(r, { ...s, id: '../pwned' }), /invalid ingest session id/);
  // Nothing must have been written outside .ingest/ before the throw.
  assert.equal(existsSync(path.join(r, 'pwned.json')), false);
  removeTree(r);
});

test('opening a session chunks the document and records provenance', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.equal(s.sourceFile, 'docs/prd/auth.md');
  assert.deepEqual(s.chunks.map((c) => c.anchor), ['auth', 'storage']);
  assert.equal(s.applied.auth, undefined);
  removeTree(r);
});

test('opening the same unchanged source resumes the existing session', () => {
  const r = root();
  const first = openIngestSession(r, 'docs/prd/auth.md', DOC);
  first.applied.auth = [{ candidateHash: 'h1', itemId: 'REQ-sso', action: 'created', at: '2026-08-15T00:00:00.000Z' }];
  saveSession(r, first);

  const second = openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.equal(second.id, first.id);
  assert.deepEqual(second.applied.auth, first.applied.auth);
  removeTree(r);
});

test('resuming a saved session preserves the original createdAt, not a new timestamp', async () => {
  const r = root();
  const first = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, first);
  await new Promise((res) => setTimeout(res, 5));
  const second = openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.equal(second.createdAt, first.createdAt);
  removeTree(r);
});

test('a resumed session must match protocol AND checksum AND source file — a header whose checksum disagrees is rebuilt, not trusted', () => {
  // I-8: the HEADER is rebuilt (its bad checksum must not survive), but the
  // applied log is a separate, filename-keyed artifact and is RECOVERED — see
  // the sibling test below and openIngestSession's doc comment. This test
  // isolates the header half: a mutant that drops the `sourceChecksum` clause
  // resumes the corrupt header and returns its bogus checksum.
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s);
  // Hand-corrupt the header at the exact same path/id: wrong checksum, as if
  // written by a different protocol version or damaged on disk.
  writeFileSync(
    path.join(ingestDir(r), `${s.id}.json`),
    JSON.stringify({ ...s, sourceChecksum: 'deadbeef00000000' }),
    'utf8',
  );

  const reopened = openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.equal(reopened.sourceChecksum, sourceChecksum(DOC));
  assert.equal(reopened.protocol, SESSION_PROTOCOL);
  assert.deepEqual(reopened.chunks.map((c) => c.anchor), ['auth', 'storage']);
  removeTree(r);
});

test('a resumed session also requires sourceFile to match — a header whose sourceFile field alone was corrupted is rebuilt, not resumed', () => {
  // Isolates the sourceFile clause specifically: protocol and sourceChecksum
  // are both left correct here, so only a mutant that drops the sourceFile
  // check (not the checksum check) can make this resume — and it would then
  // hand back the OTHER document's path.
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s);

  writeFileSync(
    path.join(ingestDir(r), `${s.id}.json`),
    JSON.stringify({ ...s, sourceFile: 'docs/prd/other.md' }),
    'utf8',
  );

  const reopened = openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.equal(reopened.sourceFile, 'docs/prd/auth.md');
  removeTree(r);
});

test('listSessions on a workspace where .ingest/ was never created returns [] rather than throwing', () => {
  // ingest-status can legitimately be the very first command run against a
  // fresh workspace — no `mycontext ingest` has ever executed, so
  // `ingestDir(root)` does not exist yet. `readdirSync` on a missing
  // directory throws ENOENT; without the try/catch this would crash instead
  // of reporting "no sessions".
  const r = root(); // exists, but nothing under it has ever created .ingest/
  assert.deepEqual(listSessions(r), []);
  removeTree(r);
});

test('a resumed session with an unparseable existing header (not merely a wrong checksum) is rebuilt fresh', () => {
  // The existing "stale/corrupt header" test writes VALID JSON with a wrong
  // checksum: `JSON.parse` succeeds there, and it's the sourceChecksum
  // comparison that fails — so that test never reaches the `catch` at all.
  // This test corrupts the bytes themselves, so `JSON.parse` inside
  // openIngestSession's try/catch actually throws and the catch's "fall
  // through and rebuild it" branch is what has to run.
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s);
  writeFileSync(path.join(ingestDir(r), `${s.id}.json`), '{not valid json', 'utf8');

  const reopened = openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.equal(reopened.id, s.id);
  assert.deepEqual(reopened.chunks.map((c) => c.anchor), s.chunks.map((c) => c.anchor));
  assert.deepEqual(reopened.applied, {});
  removeTree(r);
});

test('an edited source opens a new session and leaves the old one intact', () => {
  const r = root();
  const first = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, first);
  const second = openIngestSession(r, 'docs/prd/auth.md', DOC + '\n# Extra\n\nMore.\n');
  saveSession(r, second);

  assert.notEqual(second.id, first.id);
  assert.deepEqual(listSessions(r).map((s) => s.id).sort(), [first.id, second.id].sort());
  removeTree(r);
});

test('leading whitespace before the first heading does not desync chunking from the checksum (regression)', () => {
  // sourceChecksum trims; chunkDocument alone does not. If openIngestSession
  // chunked the raw text instead of the same trimmed text it checksums, this
  // would silently produce a "_preamble" chunk instead of "auth" while the
  // id (and any resumed session) stayed identical — an anchor that persists
  // while naming different content.
  const r = root();
  assert.equal(sourceChecksum(` ${DOC}`), sourceChecksum(DOC));
  const s = openIngestSession(r, 'docs/prd/auth.md', ` ${DOC}`);
  assert.deepEqual(s.chunks.map((c) => c.anchor), ['auth', 'storage']);
  removeTree(r);
});

test('save then load round-trips the whole session', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  s.applied.storage = [{ candidateHash: 'h2', itemId: 'CONST-pg', action: 'created', at: '2026-08-15T00:00:00.000Z' }];
  const returned = saveSession(r, s);
  assert.equal(returned, path.join(ingestDir(r), `${s.id}.json`));
  assert.deepEqual(loadSession(r, s.id), s);
  removeTree(r);
});

test('saving the same applied record twice does not duplicate it in the log', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  s.applied.auth = [{ candidateHash: 'h1', itemId: 'REQ-sso', action: 'created', at: '2026-08-15T00:00:00.000Z' }];
  saveSession(r, s);
  saveSession(r, s);
  const reloaded = loadSession(r, s.id);
  assert.deepEqual(reloaded.applied.auth, [
    { candidateHash: 'h1', itemId: 'REQ-sso', action: 'created', at: '2026-08-15T00:00:00.000Z' },
  ]);
  removeTree(r);
});

test('an applied chunk recorded with zero extractions persists across save and load', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  s.applied.auth = [];
  saveSession(r, s);
  const reloaded = loadSession(r, s.id);
  assert.deepEqual(reloaded.applied.auth, []);
  assert.deepEqual(pendingAnchors(reloaded), ['storage']);
  removeTree(r);
});

test('a "constructor" anchor round-trips through save and load, not just pendingAnchors', () => {
  // The presence-check fix in pendingAnchors doesn't help if a DIFFERENT
  // accessor elsewhere in the write path still does unsafe bracket access
  // against the same inherited-property hazard. `appendAppliedDiff` used to
  // do `(already[anchor] ?? []).map(...)`, which for anchor "constructor"
  // resolves to the inherited Object constructor function (not undefined),
  // so `.map` throws TypeError on the very first save after applying this
  // chunk — never reachable through pendingAnchors alone.
  const r = root();
  const doc = '# Constructor\n\nBody.\n\n# Storage\n\nBody.\n';
  const s = openIngestSession(r, 'docs/prd/ctor.md', doc);
  s.applied['constructor'] = [
    { candidateHash: 'h1', itemId: 'REQ-ctor', action: 'created', at: '2026-08-15T00:00:00.000Z' },
  ];
  saveSession(r, s); // must not throw
  const reloaded = loadSession(r, s.id);
  assert.deepEqual(reloaded.applied.constructor, [
    { candidateHash: 'h1', itemId: 'REQ-ctor', action: 'created', at: '2026-08-15T00:00:00.000Z' },
  ]);
  removeTree(r);
});

test('a truncated final line from a crash does not swallow the next appended record on recovery', () => {
  // The ruling's "truncated final line must be skipped, not fatal" is a read
  // guarantee; this is the matching write guarantee. Without healing the
  // trailing newline before appending, the recovery save's own line gets
  // concatenated onto the truncated fragment into one longer unparseable
  // line, and the record the recovery save was trying to write is lost —
  // permanently, if that save was the last one of the run.
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s);
  const appliedPath = path.join(ingestDir(r), `${s.id}.applied.jsonl`);
  writeFileSync(appliedPath, '{"anchor":"broke', 'utf8'); // crash mid-append, no trailing newline

  const recovery = {
    ...s,
    applied: {
      storage: [
        { candidateHash: 'h2', itemId: 'CONST-pg', action: 'created' as const, at: '2026-08-15T00:00:00.000Z' },
      ],
    },
  };
  saveSession(r, recovery);

  const reloaded = loadSession(r, s.id);
  assert.deepEqual(reloaded.applied.storage, [
    { candidateHash: 'h2', itemId: 'CONST-pg', action: 'created', at: '2026-08-15T00:00:00.000Z' },
  ]);
  removeTree(r);
});

test('an applied-log read error other than "missing" is surfaced, not silently treated as empty', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s); // applied is empty here, so no .applied.jsonl file is created yet
  const appliedPath = path.join(ingestDir(r), `${s.id}.applied.jsonl`);
  mkdirSync(appliedPath); // a directory where a file is expected -> EISDIR, not ENOENT
  assert.throws(() => loadSession(r, s.id), /could not read the applied-log/);
  removeTree(r);
});

test('a truncated final line in the applied log is skipped, not fatal', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s);
  const validLine = JSON.stringify({
    anchor: 'auth',
    record: { candidateHash: 'h1', itemId: 'REQ-sso', action: 'created', at: '2026-08-15T00:00:00.000Z' },
  });
  const appliedPath = path.join(ingestDir(r), `${s.id}.applied.jsonl`);
  // Second line is a crash-mid-append: valid JSON syntax cut off, no trailing newline.
  writeFileSync(appliedPath, `${validLine}\n{"anchor":"storage","record":{"candidateHash":"h2"`, 'utf8');

  const reloaded = loadSession(r, s.id);
  assert.deepEqual(reloaded.applied.auth, [
    { candidateHash: 'h1', itemId: 'REQ-sso', action: 'created', at: '2026-08-15T00:00:00.000Z' },
  ]);
  assert.equal(reloaded.applied.storage, undefined);
  removeTree(r);
});

test('the ingest directory is gitignored — sessions are working state, not knowledge', () => {
  const r = root();
  openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.equal(readFileSync(path.join(ingestDir(r), '.gitignore'), 'utf8').trim(), '*');
  removeTree(r);
});

test('an emptied .gitignore in .ingest/ is restored on the next open, not left broken', () => {
  const r = root();
  openIngestSession(r, 'docs/prd/auth.md', DOC);
  writeFileSync(path.join(ingestDir(r), '.gitignore'), '', 'utf8');
  openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.equal(readFileSync(path.join(ingestDir(r), '.gitignore'), 'utf8').trim(), '*');
  removeTree(r);
});

test('pendingAnchors lists chunks not yet applied, in document order', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.deepEqual(pendingAnchors(s), ['auth', 'storage']);
  s.applied.auth = [];
  assert.deepEqual(pendingAnchors(s), ['storage']);
  removeTree(r);
});

test('an applied chunk with zero extractions still counts as done', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  s.applied.auth = [];
  s.applied.storage = [];
  assert.deepEqual(pendingAnchors(s), []);
  removeTree(r);
});

test('pendingAnchors is not fooled by prototype-shaped anchors like "constructor"', () => {
  // `{}.constructor` is inherited from Object.prototype, not undefined — a
  // presence check using `applied[anchor] === undefined` instead of
  // `hasOwnProperty` would treat "constructor" as already applied even on a
  // brand-new session and silently drop that section from every ingest.
  const r = root();
  const doc = '# Constructor\n\nBody.\n\n# Storage\n\nBody.\n';
  const s = openIngestSession(r, 'docs/prd/ctor.md', doc);
  assert.deepEqual(pendingAnchors(s), ['constructor', 'storage']);
  removeTree(r);
});

test('setApplied creates an own data property readable back by hasApplied/appliedRecordsFor, even for "__proto__"', () => {
  // Plain bracket assignment (`applied['__proto__'] = records`) does NOT
  // create an own '__proto__' property on a normal object — it invokes the
  // inherited setter and reassigns the object's actual prototype instead,
  // corrupting every future lookup (including hasApplied's own
  // hasOwnProperty.call, which lives on the prototype this would replace).
  // `setApplied` must use `Object.defineProperty` to sidestep that setter
  // entirely, for every key including this one.
  const applied: Record<string, { candidateHash: string; itemId: string; action: 'created'; at: string }[]> = {};
  const records = [{ candidateHash: 'h', itemId: 'REQ-x', action: 'created' as const, at: '2026-01-01T00:00:00.000Z' }];

  setApplied(applied, '__proto__', records);

  assert.equal(hasApplied(applied, '__proto__'), true);
  assert.deepEqual(appliedRecordsFor(applied, '__proto__'), records);
  // The object's actual prototype must be untouched — still plain Object.prototype.
  assert.equal(Object.getPrototypeOf(applied), Object.prototype);
  // And an unrelated key must still report "not applied" normally — proof
  // the write didn't corrupt hasOwnProperty's own behavior for this object.
  assert.equal(hasApplied(applied, 'some-other-anchor'), false);
});

test('setApplied overwrites a previous value for the same anchor rather than merging', () => {
  const applied: Record<string, { candidateHash: string; itemId: string; action: 'created'; at: string }[]> = {};
  setApplied(applied, 'auth', [{ candidateHash: 'h1', itemId: 'REQ-a', action: 'created', at: '2026-01-01T00:00:00.000Z' }]);
  setApplied(applied, 'auth', [{ candidateHash: 'h2', itemId: 'REQ-b', action: 'created', at: '2026-01-02T00:00:00.000Z' }]);
  assert.deepEqual(appliedRecordsFor(applied, 'auth').map((r) => r.itemId), ['REQ-b']);
});

test('a hand-appended "__proto__" line in .applied.jsonl does not corrupt loadSession\'s returned object', () => {
  // The applied-log is explicitly documented as tolerant of corrupt and
  // foreign lines (see readAppliedLines above), so this anchor need not have
  // come from `slugify` — a hand-edited file, or a foreign writer, can put
  // literally anything JSON-parseable in the "anchor" field. `foldApplied`
  // must route every write through `setApplied`, not bracket assignment, or
  // this line reassigns the returned `applied` object's own prototype.
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s);
  const appliedPath = path.join(ingestDir(r), `${s.id}.applied.jsonl`);
  writeFileSync(appliedPath, '{"anchor":"__proto__","record":null}\n', 'utf8');

  const reloaded = loadSession(r, s.id);

  // The object's actual prototype must be untouched — still plain Object.prototype.
  assert.equal(Object.getPrototypeOf(reloaded.applied), Object.prototype);
  assert.equal(hasApplied(reloaded.applied, '__proto__'), true);
  assert.deepEqual(appliedRecordsFor(reloaded.applied, '__proto__'), []);
  // And normal anchors must still behave normally afterwards — proof the
  // corruption, if it happened, wouldn't just be invisible here.
  assert.equal(hasApplied(reloaded.applied, 'auth'), false);
  assert.deepEqual(pendingAnchors(reloaded), ['auth', 'storage']);
  removeTree(r);
});

test('loading an unknown session fails with a branded, actionable message', () => {
  const r = root();
  assert.throws(
    () => loadSession(r, 'ING-nope-00000000'),
    /my_context: no ingest session "ING-nope-00000000" under/,
  );
  removeTree(r);
});

test('loading a session whose file is corrupt JSON fails with a branded message, not a raw SyntaxError', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s);
  writeFileSync(path.join(ingestDir(r), `${s.id}.json`), '{ not valid json', 'utf8');
  assert.throws(() => loadSession(r, s.id), /my_context: ingest session ".*" at .* is corrupt/);
  removeTree(r);
});

test('listSessions ignores unrelated files rather than throwing', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s);
  writeFileSync(path.join(ingestDir(r), 'notes.txt'), 'not json at all', 'utf8');
  assert.equal(listSessions(r).length, 1);
  removeTree(r);
});

test('listSessions only reads .json files, not merely anything containing valid session-shaped JSON', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s);
  // Valid JSON, right protocol, wrong extension — would be picked up if the
  // extension filter were ever dropped, since the corrupt-JSON catch alone
  // can't distinguish this from a real session file.
  writeFileSync(
    path.join(ingestDir(r), 'notes.txt'),
    JSON.stringify({ protocol: SESSION_PROTOCOL, id: 'ING-fake-00000000-00000000' }),
    'utf8',
  );
  assert.equal(listSessions(r).length, 1);
  removeTree(r);
});

test('listSessions ignores a well-formed JSON file with the wrong protocol', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s);
  writeFileSync(path.join(ingestDir(r), 'other.json'), JSON.stringify({ protocol: 'something-else' }), 'utf8');
  assert.equal(listSessions(r).length, 1);
  removeTree(r);
});

test('listSessions returns sessions in id-sorted order, not creation order', () => {
  const r = root();
  const b = openIngestSession(r, 'zzz/last.md', 'z\n');
  saveSession(r, b);
  const a = openIngestSession(r, 'aaa/first.md', 'a\n');
  saveSession(r, a);
  const ids = listSessions(r).map((s) => s.id);
  // Compared with the same comparator the implementation actually uses
  // (`localeCompare`), not the plain default `.sort()`, which can disagree
  // with it for some inputs even though both happen to agree for this one.
  assert.deepEqual(ids, [...ids].sort((x, y) => x.localeCompare(y)));
  assert.notEqual(ids[0], b.id);
  removeTree(r);
});

test('listSessions sorts by the id field, not by filename or readdir order', () => {
  // A readdir-order counter-example is not reliably constructible (most
  // filesystems already return directory entries alphabetically), but
  // listSessions sorts on each file's OWN `id` field, not its filename — so
  // deliberately mismatching the two proves the sort is real regardless of
  // what order the filesystem enumerates files in.
  const r = root();
  mkdirSync(ingestDir(r), { recursive: true });
  const base = {
    protocol: SESSION_PROTOCOL, sourceFile: 'x.md', sourceChecksum: 'deadbeefdeadbeef',
    createdAt: '2026-08-15T00:00:00.000Z', chunks: [],
  };
  writeFileSync(
    path.join(ingestDir(r), 'aaa.json'),
    JSON.stringify({ ...base, id: 'ING-zzz-00000000-00000000' }),
    'utf8',
  );
  writeFileSync(
    path.join(ingestDir(r), 'zzz.json'),
    JSON.stringify({ ...base, id: 'ING-aaa-00000000-00000000' }),
    'utf8',
  );
  const ids = listSessions(r).map((s) => s.id);
  assert.deepEqual(ids, ['ING-aaa-00000000-00000000', 'ING-zzz-00000000-00000000']);
  removeTree(r);
});

test('retryOnTransientFsError recovers a Windows rename-over-a-locked-file hazard', { skip: process.platform !== 'win32' ? 'Windows-only: EPERM-on-rename-over-open-file is a Windows-specific failure mode' : false }, async () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s); // create the header once so there is something to rename over
  const target = path.join(ingestDir(r), `${s.id}.json`);

  // A separate process opens the destination for read and holds it for
  // ~70ms, reproducing the transient lock (a virus scanner, the search
  // indexer) retryOnTransientFsError exists for: a plain renameSync over
  // this fails EPERM immediately, and only the wrapped, retried version
  // survives past the hold.
  const holder = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', '-e', `
    const fs = require('node:fs');
    const fd = fs.openSync(process.argv[1], 'r');
    setTimeout(() => { fs.closeSync(fd); }, 70);
  `, target], { stdio: 'ignore' });

  await new Promise((res) => setTimeout(res, 20)); // let the holder actually open its handle

  assert.doesNotThrow(() => saveSession(r, s));

  await new Promise((res) => holder.on('exit', res));
  removeTree(r);
});

test('a saved session leaves no temp file behind', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s);
  const stray = readFileSync(path.join(ingestDir(r), `${s.id}.json`), 'utf8');
  assert.ok(stray.startsWith('{'));
  assert.equal(existsSync(path.join(ingestDir(r), `${s.id}.json.tmp-${process.pid}`)), false);
  removeTree(r);
});

test('a stale/garbage temp file from a previous crash does not survive or corrupt the next save', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  const target = path.join(ingestDir(r), `${s.id}.json`);
  mkdirSync(ingestDir(r), { recursive: true });
  writeFileSync(`${target}.tmp-${process.pid}`, 'GARBAGE, not json, left by a crash', 'utf8');

  saveSession(r, s);

  assert.equal(existsSync(`${target}.tmp-${process.pid}`), false);
  assert.deepEqual(loadSession(r, s.id).chunks, s.chunks);
  removeTree(r);
});
