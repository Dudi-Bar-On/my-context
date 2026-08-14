import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { applyCandidates } from '../../src/ingest/apply.ts';
import {
  ingestDir, listSessions, loadSession, openIngestSession, pendingAnchors,
  readRejections, rejectionsForAnchor, saveSession, SESSION_PROTOCOL,
} from '../../src/ingest/session.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { Store } from '../../src/core/store.ts';
import type { MutationContext } from '../../src/core/mutate.ts';
import { removeTree } from '../helpers/tmp.ts';

const DOC = `# Auth\n\nMust support SSO.\n\n# Storage\n\nPostgres only.\n`;

/** A workspace root shaped like a real `.my_context`, plus a mutation context
 * for the tests that drive `applyCandidates`. */
function fixture(): { ctx: MutationContext; root: string; cleanup: () => void } {
  const base = mkdtempSync(path.join(tmpdir(), 'myctx-recov-'));
  const root = path.join(base, '.my_context');
  mkdirSync(path.join(root, 'items'), { recursive: true });
  const store = Store.open(':memory:');
  const ctx: MutationContext = { root, store, config: resolveConfig({}) };
  return { ctx, root, cleanup: () => { store.close(); removeTree(base); } };
}

function headerPath(root: string, id: string): string {
  return path.join(ingestDir(root), `${id}.json`);
}

/** Opens a session, marks `auth` applied with one record, and saves — the
 * state every I-8 test below then corrupts the HEADER of. */
function sessionWithAuthApplied(root: string): string {
  const s = openIngestSession(root, 'docs/prd/auth.md', DOC);
  s.applied.auth = [{
    candidateHash: 'h1', itemId: 'REQ-sso', action: 'created', at: '2026-08-15T00:00:00.000Z',
  }];
  saveSession(root, s);
  return s.id;
}

// --- I-8: a header that cannot be trusted must not discard the applied log --

test('an unparseable header does not discard the applied log — the applied anchor stays applied', () => {
  // Before this fix, an unreadable header made openIngestSession return
  // `applied: {}`, so `mycontext ingest` re-emitted an extraction request for
  // a chunk that had already been applied. Re-extraction is not merely a
  // wasted call: a reworded re-extraction of an unchanged document takes
  // applyCandidates' supersede branch and retires the live draft.
  const { root, cleanup } = fixture();
  const id = sessionWithAuthApplied(root);
  writeFileSync(headerPath(root, id), '{not valid json', 'utf8');

  const reopened = openIngestSession(root, 'docs/prd/auth.md', DOC);
  assert.equal(reopened.id, id);
  assert.deepEqual(Object.keys(reopened.applied), ['auth']);
  assert.equal(reopened.applied.auth[0].itemId, 'REQ-sso');
  assert.deepEqual(pendingAnchors(reopened), ['storage']);
  cleanup();
});

test('a header written by a different SESSION_PROTOCOL is migrated, not silently re-extracted', () => {
  // The corrupt-header route is reachable by accident; this one is reachable
  // by a routine version bump — every existing session's header stops
  // matching the moment SESSION_PROTOCOL changes.
  const { root, cleanup } = fixture();
  const id = sessionWithAuthApplied(root);
  const header = JSON.parse(readFileSync(headerPath(root, id), 'utf8'));
  writeFileSync(
    headerPath(root, id),
    JSON.stringify({ ...header, protocol: 'my_context/ingest-session@0' }),
    'utf8',
  );

  const reopened = openIngestSession(root, 'docs/prd/auth.md', DOC);
  assert.deepEqual(pendingAnchors(reopened), ['storage']);
  // The migration completes on save: the header is rewritten at the current
  // protocol, which is what puts the session back in `listSessions`' view.
  saveSession(root, reopened);
  assert.equal(JSON.parse(readFileSync(headerPath(root, id), 'utf8')).protocol, SESSION_PROTOCOL);
  cleanup();
});

test('after a corrupt header, the resume decision and ingest-status agree on the same file', () => {
  // The contradiction I-8 names, asserted directly: `mycontext ingest` decides
  // what to re-emit from `pendingAnchors(openIngestSession(...))`, while
  // `mycontext ingest-status` reads `listSessions`. Both are driven here from
  // one workspace, and they must not disagree about which anchors are done.
  const { root, cleanup } = fixture();
  const id = sessionWithAuthApplied(root);
  writeFileSync(headerPath(root, id), '{not valid json', 'utf8');

  const opened = openIngestSession(root, 'docs/prd/auth.md', DOC);
  saveSession(root, opened); // what `mycontext ingest` does immediately after opening

  const listed = listSessions(root);
  assert.equal(listed.length, 1);
  assert.deepEqual(pendingAnchors(listed[0]), pendingAnchors(opened));
  assert.deepEqual(pendingAnchors(listed[0]), ['storage']);
  cleanup();
});

test('an applied log naming an anchor this document does not have is refused, not silently re-extracted', () => {
  // The one case recovery must NOT guess at: the log and the document
  // genuinely disagree about what this session is. Re-extracting would
  // re-apply chunks already applied; trusting the log would attribute another
  // document's work to this one. Refuse and name the anchors.
  const { root, cleanup } = fixture();
  const id = sessionWithAuthApplied(root);
  writeFileSync(headerPath(root, id), '{not valid json', 'utf8');
  writeFileSync(
    path.join(ingestDir(root), `${id}.applied.jsonl`),
    `${JSON.stringify({ anchor: 'not-a-chunk-of-this-doc', record: null })}\n`,
    'utf8',
  );

  assert.throws(
    () => openIngestSession(root, 'docs/prd/auth.md', DOC),
    /not-a-chunk-of-this-doc.*do not exist in docs\/prd\/auth\.md/s,
  );
  cleanup();
});

test('the orphan refusal names the applied log by path and its non-destructive recovery works', () => {
  // Two claims the refusal makes, both previously unpinned:
  //
  // 1. It names the applied log's real path. Nothing checked that, so the one
  //    file a human has to open was free to drift to a wrong name.
  // 2. Its remediation. The message used to offer only "move it aside", which
  //    discards EVERY applied record and re-extracts the whole document — the
  //    exact re-application the refusal exists to prevent. Deleting just the
  //    orphan line recovers fully, and was never mentioned.
  //
  // Both are asserted by DOING them, not by matching prose: the surgical
  // route is followed literally and the surviving applied record checked.
  const { root, cleanup } = fixture();
  const id = sessionWithAuthApplied(root);
  writeFileSync(headerPath(root, id), '{not valid json', 'utf8');
  const log = path.join(ingestDir(root), `${id}.applied.jsonl`);
  writeFileSync(
    log,
    `${readFileSync(log, 'utf8').trimEnd()}\n` +
    `${JSON.stringify({ anchor: 'not-a-chunk-of-this-doc', record: null })}\n`,
    'utf8',
  );

  let message = '';
  try {
    openIngestSession(root, 'docs/prd/auth.md', DOC);
    assert.fail('an orphaned anchor must be refused');
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  assert.ok(
    message.includes(log),
    `the refusal must name the applied log a human has to open. It said:\n${message}`,
  );
  assert.match(
    message, /deleting only the line\(s\)/,
    'the non-destructive route must be named, and named first',
  );
  assert.ok(
    message.indexOf('deleting only the line(s)') < message.indexOf('aside'),
    'the destructive route must not be the first one offered',
  );

  // Follow the surgical route literally: drop only the orphan line.
  writeFileSync(
    log,
    readFileSync(log, 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '' && JSON.parse(line).anchor !== 'not-a-chunk-of-this-doc')
      .join('\n') + '\n',
    'utf8',
  );

  const recovered = openIngestSession(root, 'docs/prd/auth.md', DOC);
  assert.deepEqual(
    Object.keys(recovered.applied), ['auth'],
    'the applied record that was never in question must survive the repair',
  );
  assert.equal(recovered.applied.auth[0].itemId, 'REQ-sso');
  assert.deepEqual(
    pendingAnchors(recovered), ['storage'],
    'only the genuinely unapplied chunk is pending — no re-extraction of `auth`',
  );

  // And the route the message calls a last resort really does cost what it
  // says: moving the whole log aside makes every chunk pending again.
  rmSync(log);
  assert.deepEqual(
    pendingAnchors(openIngestSession(root, 'docs/prd/auth.md', DOC)), ['auth', 'storage'],
  );
  cleanup();
});

test('a first-ever open of a document with no applied log is unaffected by the recovery path', () => {
  const { root, cleanup } = fixture();
  const fresh = openIngestSession(root, 'docs/prd/auth.md', DOC);
  assert.deepEqual(fresh.applied, {});
  assert.deepEqual(fresh.rejected, []);
  assert.deepEqual(pendingAnchors(fresh), ['auth', 'storage']);
  cleanup();
});

// --- I-10: rejections are durable ------------------------------------------

/** A candidate the validator accepts. */
function good(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'requirement',
    title: 'Single sign-on is supported',
    body: 'Every user-facing surface authenticates through the SSO provider.',
    quote: 'Must support SSO.',
    ...over,
  };
}

/** A candidate the validator rejects: `quote` is not in the chunk. */
function bad(over: Record<string, unknown> = {}): Record<string, unknown> {
  return good({ title: 'Rejected candidate', quote: 'This sentence is nowhere in the chunk.', ...over });
}

test('a MIXED batch keeps the anchor applied AND leaves a durable record of what was rejected', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  const result = applyCandidates(ctx, session, 'auth', [good(), bad()]);
  assert.equal(result.created.length, 1);
  assert.equal(result.issues.length, 1);
  saveSession(root, session);

  // "Survives a process restart": nothing in memory is consulted below.
  const reloaded = loadSession(root, session.id);
  assert.equal(pendingAnchors(reloaded).includes('auth'), false, 'the successes must stay applied');
  const rejected = rejectionsForAnchor(reloaded, 'auth');
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].title, 'Rejected candidate');
  assert.match(rejected[0].message, /quote/i);
  cleanup();
});

test('an ALL-rejected batch still leaves the anchor pending, and now also records why', () => {
  // The Task 4 ruling ("leave it pending") is unchanged; the rejection record
  // is added alongside it, so the pending anchor is no longer the only trace.
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  const result = applyCandidates(ctx, session, 'auth', [bad(), bad({ title: 'Also rejected' })]);
  assert.equal(result.created.length, 0);
  saveSession(root, session);

  const reloaded = loadSession(root, session.id);
  assert.equal(pendingAnchors(reloaded).includes('auth'), true, 'nothing was written, so the chunk must resurface');
  assert.equal(rejectionsForAnchor(reloaded, 'auth').length, 2);
  cleanup();
});

test('a rejection log never marks its anchor applied', () => {
  // The structural reason rejections live in their own file: `foldApplied`
  // treats the mere presence of a line for an anchor as "applied", so a
  // rejection recorded in the applied log would mark a chunk done BECAUSE it
  // failed.
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  applyCandidates(ctx, session, 'auth', [bad()]);
  saveSession(root, session);

  const reloaded = loadSession(root, session.id);
  assert.deepEqual(pendingAnchors(reloaded), ['auth', 'storage']);
  assert.equal(readRejections(root, session.id).length, 1);
  cleanup();
});

test('saving twice does not duplicate a rejection line', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  applyCandidates(ctx, session, 'auth', [good(), bad()]);
  saveSession(root, session);
  saveSession(root, session);

  assert.equal(readRejections(root, session.id).length, 1);
  cleanup();
});

test('a rejection built with its fields in a different order is still recognised as already recorded', () => {
  // The dedupe compares serialized records, and `JSON.stringify` follows
  // INSERTION order — so without a canonical serializer, the same rejection
  // written by a caller that happened to build the object field-by-field in
  // another order appends a second, identical-looking line on every save.
  // `applyCandidates`' own key order matches the read path's today, which is
  // exactly why this needs pinning rather than assuming.
  const { root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  session.rejected.push({
    message: 'quote not found in chunk', title: 'Rejected candidate',
    index: 1, at: '2026-08-15T00:00:00.000Z', anchor: 'auth',
  });
  saveSession(root, session);
  // The second save diffs the caller-ordered record still in memory against
  // the record just read back off disk, which the read path rebuilds in ITS
  // key order. Without a canonical serializer those two strings differ and
  // this appends a duplicate.
  saveSession(root, session);

  assert.equal(readRejections(root, session.id).length, 1);
  assert.equal(loadSession(root, session.id).rejected.length, 1);
  cleanup();
});

test('rejections from two different anchors accumulate independently', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  applyCandidates(ctx, session, 'auth', [good(), bad()]);
  saveSession(root, session);
  applyCandidates(ctx, session, 'storage', [bad({ title: 'Storage reject' })]);
  saveSession(root, session);

  const reloaded = loadSession(root, session.id);
  assert.equal(reloaded.rejected.length, 2);
  assert.deepEqual(rejectionsForAnchor(reloaded, 'storage').map((r) => r.title), ['Storage reject']);
  assert.deepEqual(rejectionsForAnchor(reloaded, 'auth').map((r) => r.title), ['Rejected candidate']);
  cleanup();
});

test('listSessions carries the rejection trail, so a status surface can show it', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  applyCandidates(ctx, session, 'auth', [good(), bad()]);
  saveSession(root, session);

  const [listed] = listSessions(root);
  assert.equal(listed.rejected.length, 1);
  cleanup();
});
