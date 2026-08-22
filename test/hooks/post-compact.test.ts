/**
 * **The event, where `SessionStart(source: 'compact')` was only ever the
 * proxy.**
 *
 * The restore tier infers a compaction from a `source` string. That inference
 * is right about the fact and blind about everything else: it cannot say
 * whether the user typed `/compact` or the window filled up, it cannot say
 * whether the compaction it fired inside then finished, and it has no access
 * at all to the summary that replaced the conversation — at the moment
 * `SessionStart` fires, the transcript on disk still holds the pre-compaction
 * messages. `PostCompact` carries all three.
 *
 * So the tests below are organised around what the payload adds rather than
 * around the handler's branches. `trigger` is recorded because it is the
 * distinction the proxy erases. `compact_summary` is scanned because it is the
 * only way to ask a question this project could never ask: **of the ids
 * `PreCompact` captured and the restore tier re-delivered, how many were
 * already in the summary?** An id the summary still names was re-injected into
 * a window that already had it.
 *
 * ── THE TRIGGER VALUES ─────────────────────────────────────────────────────
 *
 * Read on build 2.1.239 at
 * `C:/Users/UserC/.local/share/claude/versions/2.1.239`, by
 * `grep -a -b -o 'hook_event_name:kt("PostCompact")'`:
 *
 *     hook_event_name:kt("PostCompact"),trigger:Or(["manual","auto"]),
 *     compact_summary:L().describe("The conversation summary produced by compaction")
 *
 * Two, the same two `PreCompact` declares. Neither changes what this handler
 * does — it records the value and branches on nothing — which is why the
 * registration is unmatched and why this file pins the manifest rather than a
 * decision table.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { readAudit, type AuditRecord } from '../../src/core/audit.ts';
import { readSnapshotMeta, writeSnapshot } from '../../src/core/ledger.ts';
import { appendSeen } from '../../src/core/seen-file.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { buildRestoreSnapshot } from '../../src/hooks/pre-compact.ts';
import { recordPostCompact } from '../../src/hooks/post-compact.ts';
import { removeTree } from '../helpers/tmp.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SESSION = 'sess-post-compact';

function sandbox(t: { after(fn: () => void): void }): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-post-compact-'));
  runCli(['init'], cwd, () => {});
  t.after(() => removeTree(cwd));
  return cwd;
}

function root(cwd: string): string {
  return resolveWorkspace(cwd).projectRoot!;
}

function rows(cwd: string, op: AuditRecord['op']): AuditRecord[] {
  return readAudit(root(cwd)).filter((r) => r.op === op);
}

function payload(cwd: string, over: Record<string, unknown> = {}) {
  return {
    hook_event_name: 'PostCompact', session_id: SESSION, cwd,
    trigger: 'auto', compact_summary: 'The user was working on CONST-a and CONST-b.',
    ...over,
  };
}

test('PostCompact is registered once, unmatched, with the 5s bound', () => {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8')) as
    { hooks: Record<string, { matcher?: string; hooks: { command: string; timeout?: number }[] }[]> };
  const entries = manifest.hooks['PostCompact'];
  assert.ok(entries !== undefined, 'the hook binary exists but nothing runs it');
  assert.equal(entries.length, 1, 'two entries would run the hook twice per compaction');
  assert.equal(
    Object.hasOwn(entries[0], 'matcher'), false,
    'the matcher on this event is exact list membership over `trigger`, and this handler ' +
    'branches on no trigger value — a matcher could only ever make it miss one. `PreCompact` ' +
    'is the precedent, and it is unmatched for the same reason.',
  );
  assert.equal(entries[0].hooks.length, 1);
  assert.match(entries[0].hooks[0].command, /src\/hooks\/post-compact\.ts/);
  // 5, not PreCompact's 10: this event opens no database, walks no transcript
  // and writes no snapshot — it reads one small JSON file, scans one string
  // and appends one row.
  assert.equal(entries[0].hooks[0].timeout, 5);
});

/**
 * The pair. `PreCompact` writes the snapshot and then the compaction can still
 * throw; a `pre-compact` row with no `post-compact` row beside it is a
 * compaction that never finished, which is the one thing the snapshot alone
 * could never tell anybody.
 */
test('a completed compaction leaves a post-compact row beside the pre-compact one', (t) => {
  const cwd = sandbox(t);
  buildRestoreSnapshot({ session_id: SESSION, cwd }, cwd);
  recordPostCompact(payload(cwd), cwd);

  const pre = rows(cwd, 'pre-compact');
  const post = rows(cwd, 'post-compact');
  assert.equal(pre.length, 1, 'the fixture wrote no PreCompact row');
  assert.equal(post.length, 1);
  assert.equal(post[0].kind, 'hook');
  assert.equal(post[0].hook, 'PostCompact');
  assert.equal(post[0].sessionId, SESSION);
  assert.equal(post[0].sessionId, pre[0].sessionId, 'the two rows must join on the session');
});

/**
 * `trigger` is the distinction `source: 'compact'` erases: one value stands
 * for both a user typing `/compact` and a window that filled up, and only one
 * of those is the product telling you something about your budget.
 */
for (const trigger of ['manual', 'auto']) {
  test(`the record carries trigger=${trigger}, which the proxy could not`, (t) => {
    const cwd = sandbox(t);
    const outcome = recordPostCompact(payload(cwd, { trigger }), cwd);
    assert.equal(outcome?.trigger, trigger);
    assert.match(rows(cwd, 'post-compact')[0].note ?? '', new RegExp(`^trigger=${trigger};`));
  });
}

test('a payload with no trigger says <absent> rather than inventing one', (t) => {
  const cwd = sandbox(t);
  const outcome = recordPostCompact(payload(cwd, { trigger: undefined }), cwd);
  assert.equal(outcome?.trigger, '<absent>');
  assert.match(rows(cwd, 'post-compact')[0].note ?? '', /^trigger=<absent>;/);
});

/**
 * THE MEASUREMENT THE PROXY COULD NOT TAKE.
 *
 * Three ids are captured; the summary names one of them. `survived` must be
 * that one and only that one — the count is over the SNAPSHOT's ids, so an id
 * the summary mentions that was never captured is not a survivor of anything
 * and must not inflate it.
 */
test('survived counts the captured ids the summary still names, and only those', (t) => {
  const cwd = sandbox(t);
  writeSnapshot(root(cwd), SESSION, ['CONST-a', 'CONST-b', 'CONST-c']);

  const outcome = recordPostCompact(payload(cwd, {
    compact_summary:
      'The user hit the CONST-a limit, then moved on. RULE-unrelated came up too.',
  }), cwd);

  assert.equal(outcome?.captured, 3);
  assert.equal(
    outcome?.survived, 1,
    'either the scan missed CONST-a, or RULE-unrelated inflated a count of captured ids',
  );
  assert.match(rows(cwd, 'post-compact')[0].note ?? '', /snapshot 3 id\(s\)/);
  assert.match(rows(cwd, 'post-compact')[0].note ?? '', /1 still named in the summary/);
});

/**
 * `restored` is what the restore tier re-delivered for THIS compaction, read
 * back out of the seen file the SessionStart before us has already written.
 * The marker is the snapshot's own `capturedAt`, so a `restored` line left by
 * an EARLIER compaction of the same session must not be counted — that is the
 * whole reason `restoredFor` compares for equality rather than recency.
 */
test('restored counts this compaction\'s re-delivery, not the previous one\'s', (t) => {
  const cwd = sandbox(t);
  const r = root(cwd);
  writeSnapshot(r, SESSION, ['CONST-a', 'CONST-b']);
  // Read back through the product's own reader, not by rebuilding the path:
  // `capturedAt` is the marker `restoredFor` compares for equality, and a
  // fixture that guessed at it would be testing the guess.
  const capturedAt = readSnapshotMeta(r, SESSION)!.capturedAt;

  // One id restored by an older compaction, one by this one.
  appendSeen(r, SESSION, [{ id: 'CONST-a', tier: 'restored', at: '2020-01-01T00:00:00.000Z' }]);
  appendSeen(r, SESSION, [{ id: 'CONST-b', tier: 'restored', at: capturedAt }]);

  const outcome = recordPostCompact(payload(cwd), cwd);
  assert.equal(outcome?.captured, 2);
  assert.equal(outcome?.restored, 1, 'an older compaction\'s marker was counted as this one\'s');
  assert.match(rows(cwd, 'post-compact')[0].note ?? '', /2 id\(s\), 1 re-delivered/);
});

/**
 * The two absences that must not read as zeros, because zero is a different
 * claim in both directions. "No snapshot" means the window's contents are not
 * coming back at all — the loudest thing this row can say. "No summary" means
 * nobody looked, which is not the same as "nothing survived".
 */
test('no snapshot is disclosed as a loss, not recorded as zero captured', (t) => {
  const cwd = sandbox(t);
  const outcome = recordPostCompact(payload(cwd), cwd);
  assert.equal(outcome?.captured, null);
  assert.equal(outcome?.survived, null, 'survived cannot be counted against a snapshot that is not there');
  assert.match(
    rows(cwd, 'post-compact')[0].note ?? '',
    /NO PreCompact snapshot for this session/,
  );
});

test('no compact_summary is disclosed as unchecked, not recorded as zero survivors', (t) => {
  const cwd = sandbox(t);
  writeSnapshot(root(cwd), SESSION, ['CONST-a']);
  const outcome = recordPostCompact(payload(cwd, { compact_summary: undefined }), cwd);
  assert.equal(outcome?.captured, 1);
  assert.equal(outcome?.survived, null);
  const note = rows(cwd, 'post-compact')[0].note ?? '';
  assert.match(note, /no compact_summary on the payload/);
  assert.equal(/still named in the summary/.test(note), false, 'a count was reported anyway');
});

/**
 * The summary is the most content-bearing field any payload in this project
 * carries, and an audit note is scope and never content. A row that quoted it
 * would put the conversation itself into a log the user shares when they file
 * a bug.
 */
test('the record carries counts and never a byte of the summary', (t) => {
  const cwd = sandbox(t);
  writeSnapshot(root(cwd), SESSION, ['CONST-a']);
  recordPostCompact(payload(cwd, {
    compact_summary: 'CONST-a came up while the user was pasting SECRET-BODY-TEXT around.',
  }), cwd);
  assert.equal(
    JSON.stringify(rows(cwd, 'post-compact')[0]).includes('SECRET-BODY-TEXT'), false,
    'the compaction summary reached the audit log',
  );
});

test('no session_id and no workspace each record nothing rather than throwing', (t) => {
  const cwd = sandbox(t);
  assert.equal(recordPostCompact(payload(cwd, { session_id: undefined }), cwd), null);

  const elsewhere = mkdtempSync(path.join(tmpdir(), 'myctx-post-compact-nowhere-'));
  t.after(() => removeTree(elsewhere));
  assert.equal(recordPostCompact(payload(elsewhere), elsewhere), null);

  assert.equal(rows(cwd, 'post-compact').length, 0);
});
