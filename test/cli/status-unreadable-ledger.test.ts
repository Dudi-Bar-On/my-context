// @basis TASK-nine-sites-report-a-measured-zero-for-something-they-could, INV-nothing-is-dropped-silently
/**
 * **`mycontext status` may not answer "no sessions recorded yet" over a ledger
 * it could not open.**
 *
 * Site M9 of `TASK-nine-sites-report-a-measured-zero-for-something-they-could`
 * names two files, `src/mcp/tools.ts` and this command, and one line in each:
 * an outer `catch` around the whole open-and-read that returned
 * `sessionsRecorded: 0`. `0` is what drives the sentence *"usage: no sessions
 * recorded yet — decay reporting starts once items begin to be injected"*,
 * which is exactly right for a brand-new workspace and exactly wrong for a
 * damaged `.index.db`. The two states were indistinguishable in the report,
 * and the reader was handed the reassuring one.
 *
 * `TASK-one-unreadable-directory-makes-the-audit-projection-look` closed the
 * INNER catch of the same function (the ledger opened, the audit-log top-up
 * failed, the counts are a floor) and `test/cli/report-unreadable-audit-log
 * .test.ts` pins it. This file pins the outer one, which that round left open.
 *
 * **The plant** is a `ledger` table of the wrong shape written straight into
 * `.index.db`: `Ledger.open` runs `LEDGER_SCHEMA` on every open, its
 * `CREATE TABLE IF NOT EXISTS` is then a no-op, and its
 * `CREATE INDEX ... ON ledger(session_id)` throws `no such column:
 * session_id`. It stands for the whole class the outer catch covers — a
 * corrupt file, half a ledger, a shape this build does not read, or any of the
 * four reads below the open throwing — and it is chosen over corrupting the
 * file because `Store.open`'s corruption self-heal runs first in this command
 * and would repair that plant before `Ledger.open` ever saw it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { runCli } from '../../src/cli/index.ts';
import { closeProjectionUpkeep } from '../../src/core/audit-db.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += `${s}\n`; });
  return { code, out };
}

/** A workspace with one active normative item and a ledger that will not open. */
function project(): { cwd: string; done: () => void } {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-broken-ledger-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0, 'fixture command failed: init');
  const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-x.md');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    '---\nid: CONST-x\ntype: constraint\ntitle: a constraint\nstatus: active\nscope:\n  - "src/**"\n---\n\n# a constraint\n\nBody.\n',
    'utf8',
  );
  const ws = resolveWorkspace(cwd);
  const db = new DatabaseSync(ws.dbPath);
  try { db.exec('CREATE TABLE ledger (nonsense TEXT);'); } finally { db.close(); }
  return { cwd, done: () => { closeProjectionUpkeep(); removeTree(cwd); } };
}

/** The one shape every detail level has to keep. */
function discloses(out: string, what: string): void {
  const flat = out.replace(/\s+/g, ' ');
  assert.doesNotMatch(
    flat, /usage: no sessions recorded yet/,
    `${what}: that sentence is a brand-new workspace's true answer, and a damaged ledger may ` +
    'not borrow it — STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is',
  );
  assert.match(
    flat, /the usage ledger could not be read/,
    `${what}: INV-nothing-is-dropped-silently — the reason must reach the reader`,
  );
  assert.match(
    flat, /no such column: session_id/,
    `${what}: the engine's own complaint is carried verbatim, not summarised away`,
  );
  assert.match(flat, /NOT MEASURED/, `${what}: and the usage line must name itself as unmeasured`);
}

test('status discloses a ledger it could not open, rather than reporting zero sessions', () => {
  const p = project();
  try {
    const { out } = run(['status'], p.cwd);
    discloses(out, 'status');
    // A hole in one measurement is never a reason to withhold the health
    // report — the same boundary `report-unreadable-audit-log.test.ts` keeps.
    assert.match(out, /item\(s\), profile/);
  } finally { p.done(); }
});

test('status --full discloses it too, and prints no cold table over a ledger it never read', () => {
  const p = project();
  try {
    const { out } = run(['status', '--full'], p.cwd);
    discloses(out, 'status --full');
    assert.doesNotMatch(
      out, /cold — not auto-injected in the last/,
      'with no injection history at all every item is "cold", and that table reads as a ' +
      'recommendation the data cannot support',
    );
  } finally { p.done(); }
});

test('status --summary discloses it too — a shorter report may drop rows, never this', () => {
  const p = project();
  try {
    discloses(run(['status', '--summary'], p.cwd).out, 'status --summary');
  } finally { p.done(); }
});

test('status --json carries sessionsRecorded: null, never 0, plus the reason', () => {
  const p = project();
  try {
    const { out } = run(['status', '--json'], p.cwd);
    const doc = JSON.parse(out) as {
      usage: { sessionsRecorded: number | null; logUnreadable: string | null };
    };
    assert.equal(
      doc.usage.sessionsRecorded, null,
      'a piped reader ranking items by "cold" over a 0 it cannot tell from an unmeasured ledger ' +
      'is the consumer M9 is about',
    );
    assert.ok(
      typeof doc.usage.logUnreadable === 'string',
      'the reason is a FIELD of the document — a piped reader sees nothing else',
    );
    assert.match(doc.usage.logUnreadable, /no such column: session_id/);
  } finally { p.done(); }
});

test('a healthy new workspace still says "no sessions recorded yet" and nothing more', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-fresh-ledger-'));
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0);
    const { out } = run(['status'], cwd);
    // The measured zero survives the fix. If this ever goes red, the repair
    // above has started reporting a real empty ledger as a fault.
    assert.match(out.replace(/\s+/g, ' '), /usage: no sessions recorded yet/);
    assert.doesNotMatch(out, /could not be read/);
    const doc = JSON.parse(run(['status', '--json'], cwd).out) as {
      usage: { sessionsRecorded: number | null; logUnreadable: string | null };
    };
    assert.equal(doc.usage.sessionsRecorded, 0);
    assert.equal(doc.usage.logUnreadable, null);
  } finally { closeProjectionUpkeep(); removeTree(cwd); }
});
