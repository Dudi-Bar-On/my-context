import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { recordAudit } from '../../src/core/audit.ts';
import { auditDbPath } from '../../src/core/audit-db.ts';
import { appendSeen, seenFilePath } from '../../src/core/seen-file.ts';
import { sessionNamesPath, setSessionName } from '../../src/core/session-names.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { logicalRows } from '../helpers/table.ts';
import { removeTree } from '../helpers/tmp.ts';

const NAMED = 'sess-abcdef1234567890';
const UNNAMED = 'sess-99990000aaaabbbb';

interface Project { cwd: string; root: string; dispose(): void }

function project(): Project {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-session-cli-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  const root = resolveWorkspace(cwd).projectRoot as string;
  return { cwd, root, dispose: () => removeTree(cwd) };
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += `${s}\n`; });
  return { code, out };
}

/** Two sessions in the audit log; the first has twice the activity. */
function seed(root: string): void {
  recordAudit(root, {
    kind: 'injection', op: 'session-start', sessionId: NAMED, hook: 'SessionStart',
    at: '2026-08-18T09:00:00.000Z', injected: [{ id: 'RULE-a', tier: 'pinned' }],
  });
  recordAudit(root, {
    kind: 'injection', op: 'jit', sessionId: NAMED, hook: 'PreToolUse',
    path: 'src/db/writer.ts', at: '2026-08-18T09:30:00.000Z',
    injected: [{ id: 'RULE-b', tier: 'jit' }],
  });
  recordAudit(root, {
    kind: 'injection', op: 'session-start', sessionId: UNNAMED, hook: 'SessionStart',
    at: '2026-08-19T09:00:00.000Z', injected: [{ id: 'RULE-a', tier: 'pinned' }],
  });
}

/** The row of the rendered table whose first cell is `id`. */
function rowFor(out: string, id: string): string[] {
  const found = logicalRows(out).find((cells) => cells[0] === id);
  assert.ok(found, `no table row for ${id} in:\n${out}`);
  return found;
}

interface JsonSession {
  session: string; short: string; name: string | null;
  activity: number; last: string | null; carryable: boolean;
}

function json(out: string): { count: number; sessions: JsonSession[] } {
  return JSON.parse(out) as { count: number; sessions: JsonSession[] };
}

test('the table lists every session the log knows', () => {
  const p = project();
  try {
    seed(p.root);
    const { code, out } = run(['session', 'list'], p.cwd);
    assert.equal(code, 0, out);
    const headers = logicalRows(out)[0];
    assert.deepEqual(headers, ['session', 'short', 'name', 'activity', 'last', 'carryable']);
    assert.equal(rowFor(out, NAMED)[3], '2');
    assert.equal(rowFor(out, UNNAMED)[3], '1');
  } finally { p.dispose(); }
});

test('`session` with no subcommand is `session list`', () => {
  const p = project();
  try {
    seed(p.root);
    const bare = run(['session'], p.cwd);
    const explicit = run(['session', 'list'], p.cwd);
    assert.equal(bare.code, 0, bare.out);
    assert.equal(bare.out, explicit.out);
  } finally { p.dispose(); }
});

test('the short column is the first eight characters, and nothing is invented from it', () => {
  const p = project();
  try {
    seed(p.root);
    const { out } = run(['session', 'list'], p.cwd);
    assert.equal(rowFor(out, NAMED)[1], NAMED.slice(0, 8));
    assert.equal(rowFor(out, UNNAMED)[1], UNNAMED.slice(0, 8));
  } finally { p.dispose(); }
});

test('a named session shows its name; an unnamed one shows an EMPTY cell', () => {
  const p = project();
  try {
    seed(p.root);
    assert.equal(setSessionName(p.root, NAMED, 'release notes').written, true);
    const { out } = run(['session', 'list'], p.cwd);
    assert.equal(rowFor(out, NAMED)[2], 'release notes');
    // Empty, not `-`, not `(unnamed)`, not the short prefix: nothing is
    // derived on the user's behalf, because a derived name can be wrong and
    // naming is the moment you know what a session was for.
    assert.equal(rowFor(out, UNNAMED)[2], '');
  } finally { p.dispose(); }
});

test('carryable is true only while the session still has a seen file', () => {
  const p = project();
  try {
    seed(p.root);
    appendSeen(p.root, NAMED, [{ id: 'RULE-a', tier: 'pinned', at: '2026-08-18T09:00:00.000Z' }]);
    const { out } = run(['session', 'list'], p.cwd);
    assert.equal(rowFor(out, NAMED)[5], 'yes');
    // `state/` is swept at 30 days, so a session the audit log still names can
    // have nothing left to carry. A selector that offered it would fail
    // silently at the next session start.
    assert.equal(rowFor(out, UNNAMED)[5], 'no');
  } finally { p.dispose(); }
});

test('a seen file with no ids left in it is not carryable', () => {
  const p = project();
  try {
    seed(p.root);
    mkdirSync(path.dirname(seenFilePath(p.root, NAMED)), { recursive: true });
    writeFileSync(seenFilePath(p.root, NAMED), '', 'utf8');
    const { out } = run(['session', 'list'], p.cwd);
    assert.equal(rowFor(out, NAMED)[5], 'no');
  } finally { p.dispose(); }
});

test('--json carries the same rows, with an unnamed session named null', () => {
  const p = project();
  try {
    seed(p.root);
    setSessionName(p.root, NAMED, 'release notes');
    appendSeen(p.root, NAMED, [{ id: 'RULE-a', tier: 'pinned', at: '2026-08-18T09:00:00.000Z' }]);
    const { code, out } = run(['session', 'list', '--json'], p.cwd);
    assert.equal(code, 0, out);
    const parsed = json(out);
    assert.equal(parsed.count, 2);
    const named = parsed.sessions.find((s) => s.session === NAMED);
    const unnamed = parsed.sessions.find((s) => s.session === UNNAMED);
    assert.deepEqual(named, {
      session: NAMED,
      short: NAMED.slice(0, 8),
      name: 'release notes',
      activity: 2,
      last: '2026-08-18T09:30:00.000Z',
      carryable: true,
    });
    assert.equal(unnamed?.name, null, 'an unnamed session must be null, never a placeholder');
    assert.equal(unnamed?.carryable, false);
  } finally { p.dispose(); }
});

test('it answers with no projection database present', () => {
  const p = project();
  try {
    seed(p.root);
    rmSync(auditDbPath(p.root), { force: true, maxRetries: 20, retryDelay: 25 });
    assert.equal(run(['session', 'list'], p.cwd).code, 0);
    const { out } = run(['session', 'list', '--json'], p.cwd);
    assert.equal(json(out).count, 2);
  } finally { p.dispose(); }
});

test('an unopenable projection falls back to the log and says so', () => {
  const p = project();
  try {
    seed(p.root);
    // A DIRECTORY where the database file must be — the same shape
    // `test/cli/audit.test.ts` uses to force the fallback.
    for (const suffix of ['', '-wal', '-shm']) {
      rmSync(`${auditDbPath(p.root)}${suffix}`, { force: true, maxRetries: 20, retryDelay: 25 });
    }
    mkdirSync(auditDbPath(p.root), { recursive: true });

    const { code, out } = run(['session', 'list'], p.cwd);
    assert.equal(code, 0, 'the log is authoritative — the read must still succeed');
    assert.equal(rowFor(out, NAMED)[3], '2');
    assert.equal(rowFor(out, UNNAMED)[3], '1');
    assert.match(out, /could not be brought up to date/);
  } finally { p.dispose(); }
});

test('an empty log says so rather than printing an empty table', () => {
  const p = project();
  try {
    const { code, out } = run(['session', 'list'], p.cwd);
    assert.equal(code, 0);
    assert.match(out, /no sessions/i);
    assert.doesNotMatch(out, /[│|]/, 'an empty result must not render a table');
  } finally { p.dispose(); }
});

test('an unreadable name store costs labels and is disclosed, never the listing', () => {
  const p = project();
  try {
    seed(p.root);
    mkdirSync(path.dirname(sessionNamesPath(p.root)), { recursive: true });
    writeFileSync(sessionNamesPath(p.root), '{"protocol": "mycontext-sess', 'utf8');
    const { code, out } = run(['session', 'list'], p.cwd);
    assert.equal(code, 0);
    assert.equal(rowFor(out, NAMED)[3], '2');
    assert.match(out, /session-names\.json/);
  } finally { p.dispose(); }
});

test('an unknown subcommand is refused with the usage', () => {
  const p = project();
  try {
    const { code, out } = run(['session', 'lst'], p.cwd);
    assert.equal(code, 1);
    assert.match(out, /unknown session subcommand "lst"/);
    assert.match(out, /usage: mycontext session/);
  } finally { p.dispose(); }
});

test('an unknown flag is refused rather than ignored', () => {
  const p = project();
  try {
    const { code, out } = run(['session', 'list', '--nope'], p.cwd);
    assert.equal(code, 1);
    assert.match(out, /--nope/);
  } finally { p.dispose(); }
});

test('outside a workspace it says how to make one', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-session-bare-'));
  try {
    const { code, out } = run(['session', 'list'], dir);
    assert.equal(code, 1);
    assert.match(out, /mycontext init/);
  } finally { removeTree(dir); }
});
