import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { auditLogPath, recordAudit } from '../../src/core/audit.ts';
import { Ledger } from '../../src/core/ledger.ts';
import {
  auditDbPath, closeProjectionUpkeep, openProjection, syncProjection,
} from '../../src/core/audit-db.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';
import { logicalRows } from '../helpers/table.ts';

interface Project { cwd: string; root: string; dispose(): void }

function project(): Project {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-audit-cli-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  const root = resolveWorkspace(cwd).projectRoot!;
  return { cwd, root, dispose: () => removeTree(cwd) };
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += `${s}\n`; });
  return { code, out };
}

function seed(root: string): void {
  recordAudit(root, {
    kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-a',
    at: '2026-08-14T10:00:00.000Z',
  });
  recordAudit(root, {
    kind: 'mutation', op: 'update', origin: 'agent', itemId: 'RULE-b', fields: ['body'],
    at: '2026-08-15T10:00:00.000Z',
  });
  recordAudit(root, {
    kind: 'injection', op: 'jit', sessionId: 'sess-abcdef123', hook: 'PreToolUse',
    path: 'src/db/writer.ts', at: '2026-08-16T10:00:00.000Z',
    injected: [{ id: 'RULE-a', tier: 'jit' }],
    spilled: [{ id: 'RULE-big', tier: 'jit', reason: 'budget exceeded (900 > 800)' }],
  });
}

test('an empty log says so, and does not read as a broken one', () => {
  const p = project();
  try {
    const { code, out } = run(['audit'], p.cwd);
    assert.equal(code, 0);
    assert.match(out, /no audit records match/);
    // The wording has to say what the log DOES record, or "nothing" is
    // indistinguishable from "this feature does not work".
    assert.match(out, /never their text/);
  } finally { p.dispose(); }
});

test('the default listing is oldest-first and names every record', () => {
  const p = project();
  try {
    seed(p.root);
    const { code, out } = run(['audit'], p.cwd);
    assert.equal(code, 0);
    assert.match(out, /3 audit record\(s\)/);
    assert.ok(out.indexOf('RULE-a') < out.indexOf('RULE-b'), 'records are not oldest-first');
    assert.match(out, /create/);
    assert.match(out, /src\/db\/writer\.ts/);
  } finally { p.dispose(); }
});

test('the table holds the layout budget at ordinary id length, and says where it cannot', () => {
  const p = project();
  try {
    // 38 characters — the length this repository's own ids actually run to.
    recordAudit(p.root, {
      kind: 'injection', op: 'session-start', sessionId: 'sess-abcdef123',
      injected: [{ id: 'REQ-changes-are-timestamped-and-audited', tier: 'index' }],
    });
    // …and one carrying a `note`, since a marked row is what `NOTE_MARK` adds
    // to this column and the marker is only defensible if it costs the budget
    // nothing. `table` abandons narrowing entirely once a column's longest
    // token puts the floor over the budget, so this is where that is caught.
    recordAudit(p.root, {
      kind: 'injection', op: 'jit', sessionId: 'sess-abcdef123', hook: 'PreToolUse',
      path: 'src/db/reader.ts', tokens: 54,
      injected: [{ id: 'REQ-changes-are-timestamped-and-audited', tier: 'jit' }],
      note: 'served from markdown fallback: file is not a database',
    });
    const ordinary = Math.max(
      ...run(['audit'], p.cwd).out.split('\n').map((l) => [...l].length),
    );
    assert.ok(ordinary <= 100, `the audit table is ${ordinary} columns wide, over the 100 budget`);

    // …and at the project's HOSTILE id length of 67 it cannot, because the
    // `subject` column IS an id. `table` leaves an unreachable budget at
    // natural width by design rather than squeezing it into five-line rows
    // that still overflow — `mycontext list` has the same property for the
    // same reason. Pinned so the doc comment on HEADERS stays true rather than
    // aspirational: if this ever starts fitting, the comment is wrong.
    const hostile = `RULE-${'x'.repeat(62)}`;
    assert.equal(hostile.length, 67);
    recordAudit(p.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: hostile });
    const stretched = Math.max(
      ...run(['audit'], p.cwd).out.split('\n').map((l) => [...l].length),
    );
    assert.ok(
      stretched > 100,
      'the audit table now fits 100 columns at a 67-character id — if that is real, the ' +
      'HEADERS doc comment no longer describes it and must be corrected',
    );
  } finally { p.dispose(); }
});

/**
 * The old-record problem, on the surface a human reads. Records written before
 * `tokens` existed have no such field, and "not recorded" and "0 tokens" are
 * different answers — zero is a measurement, absent is not. The listing must
 * say which one it is looking at.
 */
test('an injection shows its token estimate, and an older record says "not recorded"', () => {
  const p = project();
  try {
    // `seed`'s injection predates the field — no `tokens`.
    seed(p.root);
    recordAudit(p.root, {
      kind: 'injection', op: 'session-start', sessionId: 'sess-abcdef123',
      at: '2026-08-17T10:00:00.000Z',
      injected: [{ id: 'RULE-a', tier: 'pinned' }], tokens: 321,
    });

    const { out } = run(['audit', '--kind', 'injection'], p.cwd);
    // The table wraps long cells and draws its borders in whichever charset
    // the ambient terminal advertises, so the prose is asserted against the
    // reconstructed CELLS, not the rendered bytes — `logicalRows` rejoins each
    // wrapped cell into the text the renderer was given, in either charset.
    // (Its predecessor collapsed the Unicode box glyphs out of the raw output
    // and passed or failed with the machine: CI's bare shell renders `|`.)
    const details = logicalRows(out).map((cells) => cells.at(-1) ?? '');
    assert.ok(
      details.some((cell) => /~321 tokens$/.test(cell)),
      `the recorded estimate is not shown; the detail cells were:\n${details.join('\n')}`,
    );
    assert.ok(
      details.some((cell) => /tokens not recorded$/.test(cell)),
      'a record from before the field must read as "not recorded" — never as zero, and ' +
      `never as silently nothing; the detail cells were:\n${details.join('\n')}`,
    );
    for (const cell of details) assert.doesNotMatch(cell, /~0 tokens/);
  } finally { p.dispose(); }
});

/**
 * The degradation that was recorded and never shown.
 *
 * Two of these three runs were served from a broken index and both wrote a
 * `note` saying so — the Markdown fallback (hooks/pre-tool-use.ts:266) and a
 * dropped index refresh (core/inject.ts:253). `detailCell` returned from its
 * injection branch before the line that renders `note`, so every row printed
 * as `2 jit, ~54 tokens`, identical to the character, and
 * `INV-nothing-is-dropped-silently` was defeated at the view layer: the record
 * was complete and the screen was not.
 *
 * The marker is asserted rather than the note text, because printing the text
 * here is what the fix cannot do — see `NOTE_MARK`. The budget that forbids it
 * is pinned by the width test above, which now carries a noted record too.
 */
test('a degraded injection reads as degraded, and points at the note it cannot print', () => {
  const p = project();
  try {
    const healthy = {
      kind: 'injection' as const, op: 'jit' as const, sessionId: 'sess-abcdef123',
      hook: 'PreToolUse' as const, tokens: 54,
      injected: [{ id: 'RULE-a', tier: 'jit' }, { id: 'RULE-b', tier: 'jit' }],
    };
    recordAudit(p.root, { ...healthy, at: '2026-08-16T09:14:02.000Z', path: 'src/db/writer.ts' });
    recordAudit(p.root, {
      ...healthy, at: '2026-08-16T09:14:07.000Z', path: 'src/db/reader.ts',
      note: 'served from markdown fallback: file is not a database',
    });
    recordAudit(p.root, {
      ...healthy, op: 'session-start', at: '2026-08-16T09:16:40.000Z',
      note: 'source=startup; index refresh dropped: database locked',
    });

    const { out } = run(['audit', '--kind', 'injection'], p.cwd);
    // Cells, not rendered bytes, for the reason `logicalRows` documents: the
    // marker wraps onto its own physical line in this column.
    const details = logicalRows(out).slice(1).map((cells) => cells.at(-1) ?? '');
    assert.equal(
      details.filter((cell) => / — note$/.test(cell)).length, 2,
      'a run served from a broken index is indistinguishable from a healthy one; the detail ' +
      `cells were:\n${details.join('\n')}`,
    );
    // And the healthy run is NOT marked, or the marker distinguishes nothing.
    assert.equal(details.filter((cell) => cell === '2 jit, ~54 tokens').length, 1);

    // The marker is explained where it is shown, so it is not a rune to guess at.
    const flat = out.replace(/\s+/g, ' ');
    assert.match(flat, /carries a note this column has no room for/);
    assert.match(flat, /mycontext audit --json/);

    // …and the text itself is one command away, whole.
    const parsed = JSON.parse(run(['audit', '--kind', 'injection', '--json'], p.cwd).out) as {
      records: { note?: string }[];
    };
    assert.deepEqual(parsed.records.map((r) => r.note), [
      undefined,
      'served from markdown fallback: file is not a database',
      'source=startup; index refresh dropped: database locked',
    ]);
  } finally { p.dispose(); }
});

/**
 * The legend is a disclosure, not decoration: a listing with nothing to
 * disclose must not carry it, or it becomes furniture a reader stops seeing.
 */
test('the note legend appears only when a row actually carries a note', () => {
  const p = project();
  try {
    seed(p.root); // one injection, no note on any record
    assert.doesNotMatch(run(['audit'], p.cwd).out, /no room for/);
  } finally { p.dispose(); }
});

test('every filter narrows, and an unknown value is refused by name', () => {
  const p = project();
  try {
    seed(p.root);

    assert.match(run(['audit', '--op', 'create'], p.cwd).out, /1 audit record/);
    assert.match(run(['audit', '--kind', 'injection'], p.cwd).out, /1 audit record/);
    assert.match(run(['audit', '--origin', 'agent'], p.cwd).out, /1 audit record/);
    assert.match(run(['audit', '--session', 'sess-abcdef123'], p.cwd).out, /1 audit record/);
    assert.match(run(['audit', '--limit', '2'], p.cwd).out, /2 audit record/);
    assert.match(run(['audit', '--since', '2026-08-16'], p.cwd).out, /1 audit record/);
    assert.match(run(['audit', '--until', '2026-08-15'], p.cwd).out, /1 audit record/);

    // An item filter matches the injection that DELIVERED it and the one that
    // SPILLED it, not only the mutation that names it.
    assert.match(run(['audit', '--item', 'RULE-a'], p.cwd).out, /2 audit record/);
    assert.match(run(['audit', '--item', 'RULE-big'], p.cwd).out, /1 audit record/);

    const bad = run(['audit', '--op', 'teleport'], p.cwd);
    assert.equal(bad.code, 1);
    assert.match(bad.out, /teleport/);
    // Named alternatives, not a bare refusal.
    assert.match(bad.out, /supersede/);
  } finally { p.dispose(); }
});

test('--since accepts a span, a bare date and an instant, and refuses anything else', () => {
  const p = project();
  try {
    seed(p.root);
    // A span back from now covers everything seeded in the past.
    assert.match(run(['audit', '--since', '36500d'], p.cwd).out, /3 audit record/);
    assert.match(run(['audit', '--since', '2026-08-16T00:00:00Z'], p.cwd).out, /1 audit record/);

    const bad = run(['audit', '--since', 'last tuesday'], p.cwd);
    assert.equal(bad.code, 1);
    assert.match(bad.out, /ISO-8601/);
    assert.match(bad.out, /UTC midnight/);
  } finally { p.dispose(); }
});

test('an unknown option is refused rather than absorbed', () => {
  const p = project();
  try {
    const { code, out } = run(['audit', '--wat'], p.cwd);
    assert.equal(code, 1);
    assert.match(out, /unknown option "--wat"/);
    assert.match(out, /usage: mycontext audit/);
  } finally { p.dispose(); }
});

test('--summary counts everything in range, and is not silently limited', () => {
  const p = project();
  try {
    // More records than the listing's default limit of 50, so a summary that
    // inherited that limit would report a smaller, wrong total.
    for (let i = 0; i < 60; i++) {
      recordAudit(p.root, {
        kind: 'mutation', op: 'create', origin: 'human', itemId: `RULE-${i}`,
      });
    }
    const { out } = run(['audit', '--summary'], p.cwd);
    assert.match(out, /60 audit record\(s\) in range/);
    assert.match(out, /create/);

    // …while the plain listing DOES default to the most recent 50.
    assert.match(run(['audit'], p.cwd).out, /50 audit record\(s\).*most recent 50/s);
  } finally { p.dispose(); }
});

test('--items separates the roles, so a spill is visible as a spill', () => {
  const p = project();
  try {
    seed(p.root);
    assert.match(run(['audit', '--items'], p.cwd).out, /RULE-a/);
    const spilled = run(['audit', '--items', '--role', 'spilled'], p.cwd);
    assert.match(spilled.out, /RULE-big/);
    assert.doesNotMatch(spilled.out, /RULE-b\b/);
  } finally { p.dispose(); }
});

test('--sessions lists sessions in full, unlike the truncated listing column', () => {
  const p = project();
  try {
    seed(p.root);
    assert.match(run(['audit', '--sessions'], p.cwd).out, /sess-abcdef123/);
  } finally { p.dispose(); }
});

test('--files names the record, the derived index, and what deleting each costs', () => {
  const p = project();
  try {
    seed(p.root);
    const { code, out } = run(['audit', '--files'], p.cwd);
    assert.equal(code, 0);
    assert.match(out, /audit\.jsonl/);
    // `paragraph()` wraps to the layout budget, so the prose is matched against
    // the unwrapped text — a phrase can otherwise straddle a line break and
    // make a true assertion fail for a reason that has nothing to do with it.
    const flat = out.replace(/\s+/g, ' ');
    assert.match(flat, /derived query index/);
    assert.match(flat, /safe to delete/);
    // The consequence of removing a rotated segment, stated where a user is
    // being shown the files.
    assert.match(flat, /removes that stretch of history for good/);
  } finally { p.dispose(); }
});

test('--json carries the records themselves, not a rendered table', () => {
  const p = project();
  try {
    seed(p.root);
    const { out } = run(['audit', '--kind', 'injection', '--json'], p.cwd);
    const parsed = JSON.parse(out) as {
      count: number;
      records: { op: string; injected: { id: string; tier: string }[] }[];
    };
    assert.equal(parsed.count, 1);
    assert.equal(parsed.records[0].op, 'jit');
    assert.deepEqual(parsed.records[0].injected, [{ id: 'RULE-a', tier: 'jit' }]);
  } finally { p.dispose(); }
});

/**
 * **Never a stale answer, and never a silent one.**
 *
 * The projection is derived; the JSONL is the truth. When the projection
 * cannot be brought up to date, the command must still answer completely —
 * from the log — and must say that it did. Answering from a projection known
 * to be behind, without saying so, is the silent-wrong-answer class this
 * project keeps fixing.
 */
test('a projection that cannot be synced falls back to the log AND says so', () => {
  const p = project();
  try {
    seed(p.root);
    // Sync once, so there is a projection to be behind.
    const db = openProjection(p.root);
    syncProjection(p.root, db);
    db.close();

    // Now add a record and make the projection unopenable: a DIRECTORY where
    // the database file must be.
    recordAudit(p.root, {
      kind: 'mutation', op: 'discard', origin: 'human', itemId: 'RULE-c',
    });
    // This process is holding the write connection `recordAudit` keeps for the
    // life of a process (`core/audit-db.ts` · `interface UpkeepHandle`), and on
    // Windows an open handle pins the file — `rmSync` raises `EPERM` and the
    // directory below is never created. Released rather than retried around,
    // because what is being staged here is a corpus a person walked up to and
    // broke, with nothing of ours running.
    closeProjectionUpkeep();
    rmSync(auditDbPath(p.root), { force: true, maxRetries: 20, retryDelay: 25 });
    rmSync(`${auditDbPath(p.root)}-wal`, { force: true, maxRetries: 20, retryDelay: 25 });
    rmSync(`${auditDbPath(p.root)}-shm`, { force: true, maxRetries: 20, retryDelay: 25 });
    mkdirSync(auditDbPath(p.root), { recursive: true });

    const { code, out } = run(['audit'], p.cwd);
    assert.equal(code, 0, 'the read must still succeed — the log is authoritative');
    // Complete: all four records, the newest included.
    assert.match(out, /4 audit record\(s\)/);
    assert.match(out, /RULE-c/);
    // And disclosed.
    assert.match(out, /could not be brought up to date/);
    assert.match(out, /authoritative record/);
  } finally { p.dispose(); }
});

test('a damaged log is reported, not worked around', () => {
  const p = project();
  try {
    seed(p.root);
    const file = auditLogPath(p.root);
    writeFileSync(file, '{not json\n{also not json\n', 'utf8');

    const { code, out } = run(['audit'], p.cwd);
    assert.equal(code, 1, 'a damaged audit log must fail loudly, not answer partially');
    assert.match(out, /cannot be trusted/);
    assert.match(out, /silently omits entries/);
  } finally { p.dispose(); }
});

test('audit replay-ledger projects the log into the ledger table and says how much', () => {
  const p = project();
  try {
    seed(p.root); // one jit injection for sess-abcdef123, plus non-injection records
    const first = run(['audit', 'replay-ledger'], p.cwd);
    assert.equal(first.code, 0);
    assert.match(first.out, /replayed 1 row\(s\)\./);
    const ledger = Ledger.open(resolveWorkspace(p.cwd).dbPath);
    try {
      assert.deepEqual(ledger.seen('sess-abcdef123'), ['RULE-a']);
    } finally { ledger.close(); }
    // Position-tracked: running it again consumes nothing new.
    const second = run(['audit', 'replay-ledger'], p.cwd);
    assert.equal(second.code, 0);
    assert.match(second.out, /replayed 0 row\(s\)\./);
  } finally { p.dispose(); }
});
