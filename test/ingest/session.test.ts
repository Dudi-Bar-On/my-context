import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sourceChecksum } from '../../src/ingest/chunk.ts';
import {
  openIngestSession, saveSession, loadSession, listSessions,
  pendingAnchors, makeSessionId, ingestDir, SESSION_PROTOCOL,
} from '../../src/ingest/session.ts';

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
  rmSync(r, { recursive: true, force: true });
});

test('a source path must be POSIX-relative — backslashes are refused, not silently accepted', () => {
  assert.throws(() => makeSessionId('docs\\prd\\auth.md', 'abcdef0123456789'), /POSIX/);
  const r = root();
  assert.throws(() => openIngestSession(r, 'docs\\prd\\auth.md', DOC), /POSIX/);
  rmSync(r, { recursive: true, force: true });
});

test('loadSession refuses a session id that looks like a path — no traversal outside .ingest/', () => {
  const r = root();
  assert.throws(() => loadSession(r, '../secret'), /invalid ingest session id/);
  assert.throws(() => loadSession(r, '..\\secret'), /invalid ingest session id/);
  rmSync(r, { recursive: true, force: true });
});

test('saveSession refuses a session whose id looks like a path — no traversal outside .ingest/', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.throws(() => saveSession(r, { ...s, id: '../pwned' }), /invalid ingest session id/);
  // Nothing must have been written outside .ingest/ before the throw.
  assert.equal(existsSync(path.join(r, 'pwned.json')), false);
  rmSync(r, { recursive: true, force: true });
});

test('opening a session chunks the document and records provenance', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.equal(s.sourceFile, 'docs/prd/auth.md');
  assert.deepEqual(s.chunks.map((c) => c.anchor), ['auth', 'storage']);
  assert.equal(s.applied.auth, undefined);
  rmSync(r, { recursive: true, force: true });
});

test('opening the same unchanged source resumes the existing session', () => {
  const r = root();
  const first = openIngestSession(r, 'docs/prd/auth.md', DOC);
  first.applied.auth = [{ candidateHash: 'h1', itemId: 'REQ-sso', action: 'created', at: '2026-08-15T00:00:00.000Z' }];
  saveSession(r, first);

  const second = openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.equal(second.id, first.id);
  assert.deepEqual(second.applied.auth, first.applied.auth);
  rmSync(r, { recursive: true, force: true });
});

test('resuming a saved session preserves the original createdAt, not a new timestamp', async () => {
  const r = root();
  const first = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, first);
  await new Promise((res) => setTimeout(res, 5));
  const second = openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.equal(second.createdAt, first.createdAt);
  rmSync(r, { recursive: true, force: true });
});

test('a resumed session must match protocol AND checksum AND source file — a stale/corrupt header is rebuilt fresh, not trusted', () => {
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
  // And a stale applied-log entry that must NOT survive into the rebuilt session.
  writeFileSync(
    path.join(ingestDir(r), `${s.id}.applied.jsonl`),
    `${JSON.stringify({ anchor: 'stale', record: null })}\n`,
    'utf8',
  );

  const reopened = openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.deepEqual(reopened.applied, {});
  rmSync(r, { recursive: true, force: true });
});

test('an edited source opens a new session and leaves the old one intact', () => {
  const r = root();
  const first = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, first);
  const second = openIngestSession(r, 'docs/prd/auth.md', DOC + '\n# Extra\n\nMore.\n');
  saveSession(r, second);

  assert.notEqual(second.id, first.id);
  assert.deepEqual(listSessions(r).map((s) => s.id).sort(), [first.id, second.id].sort());
  rmSync(r, { recursive: true, force: true });
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
  rmSync(r, { recursive: true, force: true });
});

test('save then load round-trips the whole session', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  s.applied.storage = [{ candidateHash: 'h2', itemId: 'CONST-pg', action: 'created', at: '2026-08-15T00:00:00.000Z' }];
  const returned = saveSession(r, s);
  assert.equal(returned, path.join(ingestDir(r), `${s.id}.json`));
  assert.deepEqual(loadSession(r, s.id), s);
  rmSync(r, { recursive: true, force: true });
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
  rmSync(r, { recursive: true, force: true });
});

test('an applied chunk recorded with zero extractions persists across save and load', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  s.applied.auth = [];
  saveSession(r, s);
  const reloaded = loadSession(r, s.id);
  assert.deepEqual(reloaded.applied.auth, []);
  assert.deepEqual(pendingAnchors(reloaded), ['storage']);
  rmSync(r, { recursive: true, force: true });
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
  rmSync(r, { recursive: true, force: true });
});

test('the ingest directory is gitignored — sessions are working state, not knowledge', () => {
  const r = root();
  openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.equal(readFileSync(path.join(ingestDir(r), '.gitignore'), 'utf8').trim(), '*');
  rmSync(r, { recursive: true, force: true });
});

test('an emptied .gitignore in .ingest/ is restored on the next open, not left broken', () => {
  const r = root();
  openIngestSession(r, 'docs/prd/auth.md', DOC);
  writeFileSync(path.join(ingestDir(r), '.gitignore'), '', 'utf8');
  openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.equal(readFileSync(path.join(ingestDir(r), '.gitignore'), 'utf8').trim(), '*');
  rmSync(r, { recursive: true, force: true });
});

test('pendingAnchors lists chunks not yet applied, in document order', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.deepEqual(pendingAnchors(s), ['auth', 'storage']);
  s.applied.auth = [];
  assert.deepEqual(pendingAnchors(s), ['storage']);
  rmSync(r, { recursive: true, force: true });
});

test('an applied chunk with zero extractions still counts as done', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  s.applied.auth = [];
  s.applied.storage = [];
  assert.deepEqual(pendingAnchors(s), []);
  rmSync(r, { recursive: true, force: true });
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
  rmSync(r, { recursive: true, force: true });
});

test('loading an unknown session fails with a branded, actionable message', () => {
  const r = root();
  assert.throws(
    () => loadSession(r, 'ING-nope-00000000'),
    /my_context: no ingest session "ING-nope-00000000" under/,
  );
  rmSync(r, { recursive: true, force: true });
});

test('loading a session whose file is corrupt JSON fails with a branded message, not a raw SyntaxError', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s);
  writeFileSync(path.join(ingestDir(r), `${s.id}.json`), '{ not valid json', 'utf8');
  assert.throws(() => loadSession(r, s.id), /my_context: ingest session ".*" at .* is corrupt/);
  rmSync(r, { recursive: true, force: true });
});

test('listSessions ignores unrelated files rather than throwing', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s);
  writeFileSync(path.join(ingestDir(r), 'notes.txt'), 'not json at all', 'utf8');
  assert.equal(listSessions(r).length, 1);
  rmSync(r, { recursive: true, force: true });
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
  rmSync(r, { recursive: true, force: true });
});

test('listSessions ignores a well-formed JSON file with the wrong protocol', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s);
  writeFileSync(path.join(ingestDir(r), 'other.json'), JSON.stringify({ protocol: 'something-else' }), 'utf8');
  assert.equal(listSessions(r).length, 1);
  rmSync(r, { recursive: true, force: true });
});

test('listSessions returns sessions in id-sorted order, not creation order', () => {
  const r = root();
  const b = openIngestSession(r, 'zzz/last.md', 'z\n');
  saveSession(r, b);
  const a = openIngestSession(r, 'aaa/first.md', 'a\n');
  saveSession(r, a);
  const ids = listSessions(r).map((s) => s.id);
  assert.deepEqual(ids, [...ids].sort());
  assert.notEqual(ids[0], b.id);
  rmSync(r, { recursive: true, force: true });
});

test('a saved session leaves no temp file behind', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s);
  const stray = readFileSync(path.join(ingestDir(r), `${s.id}.json`), 'utf8');
  assert.ok(stray.startsWith('{'));
  assert.equal(existsSync(path.join(ingestDir(r), `${s.id}.json.tmp-${process.pid}`)), false);
  rmSync(r, { recursive: true, force: true });
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
  rmSync(r, { recursive: true, force: true });
});
