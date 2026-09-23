// @basis TASK-nine-sites-report-a-measured-zero-for-something-they-could, INV-nothing-is-dropped-silently
/**
 * **`status_report` and `decay_report` may not report a measured zero over a
 * ledger they could not read.**
 *
 * `readLedgerView` (`src/mcp/tools.ts`) is the third copy of a shape whose
 * other two copies — `cli/commands/status.ts` and `cli/commands/decay.ts` —
 * were repaired first. It has two catches and both were bare:
 *
 *   - the INNER one, around `topUpLedger`, where the ledger opened and could
 *     not be caught up from the audit log, so every count below is a FLOOR.
 *     `TASK-one-unreadable-directory-makes-the-audit-projection-look` ended the
 *     `auditSegments` swallow that used to mask this, and closed the same catch
 *     in both CLI commands; this copy was missed, so the MCP surface kept
 *     under-counting in silence after the human-facing ones had stopped.
 *   - the OUTER one, where the ledger did not answer at all and
 *     `sessionsRecorded: 0` was returned — site M9 of
 *     `TASK-nine-sites-report-a-measured-zero-for-something-they-could`. `0` is
 *     the number that drives *"no sessions recorded yet"* and, in
 *     `decay_report`, *"nothing here has been measured; 'cold' currently means
 *     only 'never injected'"*. A brand-new corpus and a damaged `.index.db`
 *     produced the same sentence, on the surface an AGENT reads and acts on.
 *
 * **The two plants, and why each is the honest representative of its catch.**
 *
 * The unreadable LOG is a plain file where the `.audit` directory belongs
 * (`ENOTDIR`) — `test/core/audit-segments-unreadable.test.ts` sets out at
 * length why an `EACCES` deny is not observable from a test process on this
 * machine, and every errno but `ENOENT` reaches `auditSegments`'s one `catch`
 * by the same path.
 *
 * The unreadable LEDGER is a table named `ledger` with the wrong columns,
 * written directly into `.index.db`. `Ledger.open` runs `LEDGER_SCHEMA` on
 * every open, whose `CREATE TABLE IF NOT EXISTS` is then a no-op and whose
 * `CREATE INDEX ... ON ledger(session_id)` is not — so the open throws
 * `no such column: session_id`, which is one representative of the whole class
 * the outer `catch` covers (a corrupt file, half a ledger, a shape this build
 * does not read, or any of the four reads below the open throwing). It is a
 * deliberate choice over corrupting the file itself: `Store.open`'s corruption
 * self-heal runs first in both tools and would repair that plant before
 * `Ledger.open` ever saw it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { runCli } from '../../src/cli/index.ts';
import { auditDir, recordAudit } from '../../src/core/audit.ts';
import { closeProjectionUpkeep } from '../../src/core/audit-db.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

/** A workspace with one active normative item, so `decay_report` takes its
 * long path as well as its "nothing to report" one. */
function project(): { cwd: string; root: string; dbPath: string; done: () => void } {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-mcp-ledger-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0, 'fixture command failed: init');
  const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-x.md');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    '---\nid: CONST-x\ntype: constraint\ntitle: a constraint\nstatus: active\nscope:\n  - "src/**"\n---\n\n# a constraint\n\nBody.\n',
    'utf8',
  );
  const ws = resolveWorkspace(cwd);
  assert.ok(ws.projectRoot !== null);
  return {
    cwd, root: ws.projectRoot, dbPath: ws.dbPath,
    done: () => { closeProjectionUpkeep(); removeTree(cwd); },
  };
}

/** A file where the audit log directory belongs: the log cannot be listed. */
function breakAuditLog(root: string): void {
  recordAudit(root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'CONST-x' });
  closeProjectionUpkeep();
  removeTree(auditDir(root));
  writeFileSync(auditDir(root), 'a file where the audit log directory belongs\n');
}

/** A `ledger` table of the wrong shape: `Ledger.open` cannot build its index. */
function breakLedger(dbPath: string): void {
  const db = new DatabaseSync(dbPath);
  try { db.exec('CREATE TABLE ledger (nonsense TEXT);'); } finally { db.close(); }
}

function call(cwd: string, tool: string): string {
  const answer = createRegistry(cwd).call(tool, {});
  return String(answer).replace(/\s+/g, ' ');
}

test('status_report discloses an audit log it could not read, instead of under-counting in silence', () => {
  const p = project();
  try {
    breakAuditLog(p.root);
    const out = call(p.cwd, 'status_report');
    assert.match(
      out, /the audit log could not be read/,
      'the refusal must reach the agent, not die in the catch around the ledger top-up',
    );
    assert.match(out, /FLOOR/, 'and the agent must be told what the counts below it are');
    assert.match(
      out, /could not be listed/,
      'carried verbatim from auditReadFailureNote, not re-worded on this surface',
    );
    // A hole in one measurement is never a reason to withhold the report.
    assert.match(out, /item\(s\), profile/);
  } finally { p.done(); }
});

test('decay_report discloses it too — the two tools may not disagree about one log', () => {
  const p = project();
  try {
    breakAuditLog(p.root);
    const out = call(p.cwd, 'decay_report');
    assert.match(out, /the audit log could not be read/);
    assert.match(out, /FLOOR/);
  } finally { p.done(); }
});

test('status_report reports a ledger it could not open as UNMEASURED, never as 0 sessions', () => {
  const p = project();
  try {
    breakLedger(p.dbPath);
    const out = call(p.cwd, 'status_report');
    assert.doesNotMatch(
      out, /usage: no sessions recorded yet/,
      'that is the sentence a brand-new corpus correctly gets — M9 is that a damaged ledger ' +
      'borrows it, so the agent reads a measurement where none was taken',
    );
    assert.match(
      out, /the usage ledger could not be read/,
      'INV-nothing-is-dropped-silently: the reason must reach the agent',
    );
    assert.match(out, /NOT MEASURED/, 'and the usage line must name itself as unmeasured');
    assert.match(out, /item\(s\), profile/, 'the rest of the report still renders');
  } finally { p.done(); }
});

test('decay_report does not tell an agent "nothing here has been measured" over an unreadable ledger', () => {
  const p = project();
  try {
    breakLedger(p.dbPath);
    const out = call(p.cwd, 'decay_report');
    assert.doesNotMatch(
      out, /no sessions recorded yet — nothing here has been measured/,
      'the report 3 sentence M9 names: an agent handed governing constraints marked cold with ' +
      'no hint that the measurement failed',
    );
    assert.match(out, /the usage ledger could not be read/);
    assert.match(
      out, /UNMEASURED, not zero/,
      'the three-state vocabulary, said in the report and not only in a field',
    );
  } finally { p.done(); }
});

test('a workspace whose ledger and log are both fine says none of this at all', () => {
  const p = project();
  try {
    const status = call(p.cwd, 'status_report');
    const decay = call(p.cwd, 'decay_report');
    // The disclosure is a fact, not decoration: a healthy corpus prints the
    // real measured zero ("no sessions recorded yet"), which must survive.
    for (const out of [status, decay]) {
      assert.doesNotMatch(out, /could not be read/);
      assert.doesNotMatch(out, /NOT MEASURED/);
    }
    assert.match(status, /usage: no sessions recorded yet/);
  } finally { p.done(); }
});
