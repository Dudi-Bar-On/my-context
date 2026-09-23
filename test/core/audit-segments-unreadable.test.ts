// @basis TASK-one-unreadable-directory-makes-the-audit-projection-look
//
// The item was filed INFERRED, NOT REPRODUCED, and says the first step of the
// work is to reproduce it. This file is that reproduction, and then the guard.
//
// THE CHAIN AS THE ITEM READ IT. One `readdir` failure inside `auditSegments`
// returns `[]`. `projectionState` reads that empty list as `diverged` — every
// file it knows about has apparently vanished. `syncProjection` acts on
// divergence by DELETING the whole projection and re-projecting from the empty
// list. A workspace holding 45,440 records reports none, with no disclosure
// anywhere.
//
// HOW THE REFUSAL IS PLANTED, and why it is not a permission bit. The item
// describes an unreadable directory (EACCES). That cannot be planted on the
// machine this suite runs on: `icacls /deny` against both the user's SID and
// `Everyone` was applied successfully and `readdirSync` still answered the
// listing, because the test process's token bypasses the DACL. So the refusal
// used here is the one `readTranscriptDir` (core/conversation-index.ts) also
// reproduced with — a FILE where the directory belongs, which answers
// `ENOTDIR` — and it enters `auditSegments` through the identical `catch`.
// What is under test is what that `catch` does with a throw, and every code
// but `ENOENT` reaches it by the same path.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { auditDir, auditSegments, auditSize, readAudit, recordAudit } from '../../src/core/audit.ts';
import {
  auditDbPath, closeProjectionUpkeep, openProjection, syncProjection,
} from '../../src/core/audit-db.ts';
import { removeTree } from '../helpers/tmp.ts';

function box(): { root: string; dispose(): void } {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-audit-unreadable-'));
  return {
    root,
    dispose: () => {
      closeProjectionUpkeep();
      removeTree(root);
    },
  };
}

/** Replaces the audit directory with a plain file: `readdirSync` then throws ENOTDIR. */
function makeUnlistable(root: string): void {
  closeProjectionUpkeep();
  removeTree(auditDir(root));
  writeFileSync(auditDir(root), 'a file where the audit log directory belongs\n');
}

function countProjected(db: DatabaseSync): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM audit').get() as { n: number | bigint };
  return Number(row.n);
}

test('a log directory that will not list is disclosed, not read as an empty history', () => {
  const b = box();
  recordAudit(b.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-x' });
  makeUnlistable(b.root);

  assert.throws(
    () => auditSegments(b.root),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      // A complete sentence a reader can act on: it names the directory, says
      // what failed, and says what is and is not known about the records.
      assert.match(err.message, /my_context:/);
      assert.match(err.message, new RegExp(auditDir(b.root).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')));
      assert.match(err.message, /ENOTDIR/);
      assert.match(err.message, /could not be listed/);
      return true;
    },
  );
  b.dispose();
});

test('an ABSENT log directory is still an empty history, not a refusal', () => {
  const b = box();
  // Nothing has ever been written here, so `.audit` does not exist. ENOENT is
  // the only code that means "there is nothing here", and it must keep meaning
  // it — a fresh workspace reporting a read failure would be the same defect
  // pointed the other way.
  assert.deepEqual(auditSegments(b.root), []);
  assert.deepEqual(readAudit(b.root), []);
  assert.deepEqual(auditSize(b.root), { files: [], bytes: 0 });
  b.dispose();
});

test('the read surfaces propagate the refusal rather than answering from nothing', () => {
  const b = box();
  recordAudit(b.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-x' });
  makeUnlistable(b.root);

  assert.throws(() => readAudit(b.root), /could not be listed/);
  assert.throws(() => auditSize(b.root), /could not be listed/);
  b.dispose();
});

test('a projection is NOT deleted because the log directory would not list', () => {
  const b = box();
  const written = 5;
  for (let i = 0; i < written; i += 1) {
    recordAudit(b.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: `RULE-${i}` });
  }

  // A projection that is genuinely current over a genuinely intact log.
  const built = openProjection(b.root);
  assert.equal(syncProjection(b.root, built), 'behind');
  assert.equal(countProjected(built), written);
  built.close();
  closeProjectionUpkeep();

  // The projection database lives INSIDE `.audit`, so it is moved aside before
  // the directory is made unlistable — otherwise the plant would destroy the
  // very rows whose survival is the question. `syncProjection(root, db)` takes
  // the root and the handle separately and never derives one from the other,
  // so this is the same projection, of the same log, read through the same
  // code path; only the file's location changed.
  const saved = path.join(b.root, 'saved');
  mkdirSync(saved);
  const savedDb = path.join(saved, 'audit.db');
  for (const [from, to] of [
    [auditDbPath(b.root), savedDb],
    [`${auditDbPath(b.root)}-wal`, `${savedDb}-wal`],
    [`${auditDbPath(b.root)}-shm`, `${savedDb}-shm`],
  ]) if (existsSync(from)) copyFileSync(from, to);

  makeUnlistable(b.root);

  const db = new DatabaseSync(savedDb);
  db.exec('PRAGMA busy_timeout = 3000;');
  // Before the fix this returned 'diverged' and emptied the table: the empty
  // list from `auditSegments` made every known segment look vanished.
  assert.throws(() => syncProjection(b.root, db), /could not be listed/);
  assert.equal(countProjected(db), written);
  db.close();
  b.dispose();
});
