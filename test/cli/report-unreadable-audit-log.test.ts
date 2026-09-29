// @basis TASK-one-unreadable-directory-makes-the-audit-projection-look, INV-nothing-is-dropped-silently
//
// The second half of that item's closing condition. Round one stopped
// `auditSegments` turning a refused `readdir` into `[]`; it did not stop the
// refusal being caught and dropped one layer out. `status` and `decay` both
// top the usage ledger up from the audit log before counting
// (`topUpLedger`), and both did it inside a bare `catch {}` — so with the
// refusal now raised rather than swallowed, both commands would print a
// smaller number than the truth and say nothing at all about why.
//
// The refusal is planted as a FILE where `.audit` belongs (`ENOTDIR`), for the
// reason `test/core/audit-segments-unreadable.test.ts` sets out at length: an
// `EACCES` deny is not observable from this test process, and every errno but
// `ENOENT` reaches the same `catch` in `auditSegments` anyway.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { auditDir, recordAudit } from '../../src/core/audit.ts';
import { closeProjectionUpkeep } from '../../src/core/audit-db.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += `${s}\n`; });
  return { code, out };
}

/**
 * A workspace with one real audit record and one normative item, then an audit
 * directory that will not list.
 *
 * The item matters: `decay`'s text report returns early with "nothing to
 * report" when the corpus holds no active normative item, and a disclosure
 * that only prints on the long path would miss the shortest report the command
 * has.
 */
function project(): { cwd: string; done: () => void } {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-unreadable-log-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0, 'fixture command failed: init');
  const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-x.md');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    '---\nid: CONST-x\ntype: constraint\ntitle: a constraint\nstatus: active\nscope:\n  - "src/**"\n---\n\n# a constraint\n\nBody.\n',
    'utf8',
  );
  const root = resolveWorkspace(cwd).projectRoot;
  assert.ok(root !== null);
  recordAudit(root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'CONST-x' });
  closeProjectionUpkeep();
  removeTree(auditDir(root));
  writeFileSync(auditDir(root), 'a file where the audit log directory belongs\n');
  return { cwd, done: () => { closeProjectionUpkeep(); removeTree(cwd); } };
}

/** The one sentence, owned by `auditReadFailureNote`, wrapped by `paragraph` in both reports. */
function discloses(out: string, what: string): void {
  const flat = out.replace(/\s+/g, ' ');
  assert.match(
    flat,
    /the audit log could not be read/,
    `${what}: the refusal must be disclosed, not dropped by the catch around the ledger top-up`,
  );
  assert.match(flat, /FLOOR/, `${what}: the reader must be told what the counts below are`);
  assert.match(
    flat,
    /could not be listed/,
    `${what}: the underlying sentence must be carried verbatim, not re-worded`,
  );
}

test('status discloses an audit log it could not read, rather than under-counting in silence', () => {
  const p = project();
  const { out } = run(['status'], p.cwd);
  discloses(out, 'status');
  // The report still renders — a refusal here is a hole in one measurement,
  // never a reason to withhold the whole health report.
  assert.match(out, /item\(s\), profile/);
  p.done();
});

test('status --full discloses it too — a longer report may not lose a shorter one\'s facts', () => {
  const p = project();
  discloses(run(['status', '--full'], p.cwd).out, 'status --full');
  p.done();
});

test('status --json carries it as a field of the document, not as a trailing line', () => {
  const p = project();
  const { out } = run(['status', '--json'], p.cwd);
  const doc = JSON.parse(out) as { usage: { logUnreadable: string | null } };
  assert.ok(
    typeof doc.usage.logUnreadable === 'string',
    'status --json must carry the refusal inside the document — a piped reader sees nothing else',
  );
  assert.match(doc.usage.logUnreadable, /could not be listed/);
  p.done();
});

test('decay discloses an audit log it could not read', () => {
  const p = project();
  discloses(run(['decay'], p.cwd).out, 'decay');
  p.done();
});

test('decay --json carries it as a field of the document', () => {
  const p = project();
  const { out } = run(['decay', '--json'], p.cwd);
  const doc = JSON.parse(out) as { logUnreadable: string | null };
  assert.ok(typeof doc.logUnreadable === 'string', 'decay --json must carry the refusal');
  assert.match(doc.logUnreadable, /could not be listed/);
  p.done();
});

test('a readable log says nothing at all — the disclosure is a fact, not decoration', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-readable-log-'));
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0, 'fixture command failed: init');
    for (const args of [['status'], ['decay']]) {
      const { out } = run(args, cwd);
      assert.doesNotMatch(
        out.replace(/\s+/g, ' '),
        /the audit log could not be read/,
        `${args[0]}: a healthy workspace must not be told its log is unreadable`,
      );
    }
    const status = JSON.parse(run(['status', '--json'], cwd).out) as {
      usage: { logUnreadable: string | null };
    };
    // Present and `null`, never absent: a consumer must be able to tell
    // "checked, nothing wrong" from a build that does not report this at all.
    assert.equal(status.usage.logUnreadable, null);
    const decay = JSON.parse(run(['decay', '--json'], cwd).out) as { logUnreadable: string | null };
    assert.equal(decay.logUnreadable, null);
  } finally {
    closeProjectionUpkeep();
    removeTree(cwd);
  }
});
