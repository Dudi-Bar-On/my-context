import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { readAudit, recordAudit } from '../../src/core/audit.ts';
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

/* ---------------------------------------------------------------------------
 * `mycontext session name <id> <name>`
 *
 * The id is always explicit. Nothing here guesses which session the CLI is in,
 * because it is handed none — see `src/core/session-names.ts`'s own header for
 * the concession that fact forced on the store.
 * ------------------------------------------------------------------------- */

/** A name one character past `SESSION_NAME_MAX`. */
const TOO_LONG = 'x'.repeat(65);

test('name attaches a name to a full session id, and the listing reads it back', () => {
  const p = project();
  try {
    seed(p.root);
    const named = run(['session', 'name', NAMED, 'release notes'], p.cwd);
    assert.equal(named.code, 0, named.out);
    assert.match(named.out, /release notes/);
    // The full id is echoed, not the string the user typed: a prefix that
    // resolved has to show what it resolved TO, or the confirmation is about
    // something the user cannot check.
    assert.match(named.out, new RegExp(NAMED));

    const listed = run(['session', 'list'], p.cwd);
    assert.equal(rowFor(listed.out, NAMED)[2], 'release notes');
  } finally { p.dispose(); }
});

test('an unambiguous prefix resolves to the one session it matches', () => {
  const p = project();
  try {
    seed(p.root);
    // `sess-a` is a prefix of NAMED and of nothing else in this log.
    const named = run(['session', 'name', 'sess-a', 'release notes'], p.cwd);
    assert.equal(named.code, 0, named.out);
    assert.match(named.out, new RegExp(NAMED), 'the confirmation must name the full id');

    const parsed = json(run(['session', 'list', '--json'], p.cwd).out);
    assert.equal(parsed.sessions.find((s) => s.session === NAMED)?.name, 'release notes');
    assert.equal(parsed.sessions.find((s) => s.session === UNNAMED)?.name, null);
  } finally { p.dispose(); }
});

test('a prefix that matches two sessions is refused, naming both candidates', () => {
  const p = project();
  try {
    seed(p.root);
    // `sess-` is a prefix of both seeded sessions.
    const { code, out } = run(['session', 'name', 'sess-', 'release notes'], p.cwd);
    assert.equal(code, 1, out);
    // Both, never one picked for the user: an ambiguous prefix resolved by
    // guessing would name the wrong session and report success.
    assert.match(out, new RegExp(NAMED));
    assert.match(out, new RegExp(UNNAMED));

    const parsed = json(run(['session', 'list', '--json'], p.cwd).out);
    assert.deepEqual(parsed.sessions.map((s) => s.name), [null, null],
      'a refused prefix must write no name at all');
  } finally { p.dispose(); }
});

test('an id the log has never seen is refused, pointing at `session list`', () => {
  const p = project();
  try {
    seed(p.root);
    const { code, out } = run(['session', 'name', 'sess-nobody', 'release notes'], p.cwd);
    assert.equal(code, 1, out);
    assert.match(out, /sess-nobody/);
    assert.match(out, /mycontext session list/,
      'the refusal must say where the known ids are listed');
    // Naming a session that does not exist is a typo, and accepting it would
    // put an entry in the store that nothing can ever reach.
    assert.equal(json(run(['session', 'list', '--json'], p.cwd).out)
      .sessions.filter((s) => s.name !== null).length, 0);
  } finally { p.dispose(); }
});

test('a name another session already holds is refused, naming the holder', () => {
  const p = project();
  try {
    seed(p.root);
    assert.equal(run(['session', 'name', NAMED, 'release notes'], p.cwd).code, 0);
    const { code, out } = run(['session', 'name', UNNAMED, 'release notes'], p.cwd);
    assert.equal(code, 1, out);
    assert.match(out, new RegExp(NAMED), 'the refusal must name the session holding it');
    assert.equal(json(run(['session', 'list', '--json'], p.cwd).out)
      .sessions.find((s) => s.session === UNNAMED)?.name, null);
  } finally { p.dispose(); }
});

test('an over-long name is refused, and the refusal says how long it was', () => {
  const p = project();
  try {
    seed(p.root);
    const { code, out } = run(['session', 'name', NAMED, TOO_LONG], p.cwd);
    assert.equal(code, 1, out);
    assert.match(out, /65 characters/);
    assert.match(out, /64/, 'the limit belongs beside the length');
    assert.equal(
      json(run(['session', 'list', '--json'], p.cwd).out)
        .sessions.find((s) => s.session === NAMED)?.name,
      null,
      'nothing is truncated to fit — the write is refused',
    );
  } finally { p.dispose(); }
});

test('a name containing a newline is refused rather than stripped', () => {
  const p = project();
  try {
    seed(p.root);
    const { code, out } = run(['session', 'name', NAMED, 'release\nnotes'], p.cwd);
    assert.equal(code, 1, out);
    assert.match(out, /newline|control character/);
    assert.equal(json(run(['session', 'list', '--json'], p.cwd).out)
      .sessions.find((s) => s.session === NAMED)?.name, null);
  } finally { p.dispose(); }
});

test('renaming a session discloses the name it replaced', () => {
  const p = project();
  try {
    seed(p.root);
    assert.equal(run(['session', 'name', NAMED, 'release notes'], p.cwd).code, 0);
    const { code, out } = run(['session', 'name', NAMED, 'the retry work'], p.cwd);
    assert.equal(code, 0, out);
    assert.match(out, /release notes/, 'an overwritten name must be said, not dropped');
    assert.match(out, /the retry work/);
    assert.equal(json(run(['session', 'list', '--json'], p.cwd).out)
      .sessions.find((s) => s.session === NAMED)?.name, 'the retry work');
  } finally { p.dispose(); }
});

test('naming a session writes no audit record', () => {
  const p = project();
  try {
    seed(p.root);
    const before = readAudit(p.root).length;
    assert.equal(run(['session', 'name', NAMED, 'release notes'], p.cwd).code, 0);
    // `AuditKind` is a closed union and none of its members is this: naming is
    // a user action on session metadata, it puts no text in front of a model,
    // and a further kind for it is a larger decision than the feature. The
    // command's docstring says so, so the absence reads as a decision.
    assert.equal(readAudit(p.root).length, before);
  } finally { p.dispose(); }
});

test('name refuses a third positional rather than silently keeping the first word', () => {
  const p = project();
  try {
    seed(p.root);
    const { code, out } = run(['session', 'name', NAMED, 'release', 'notes'], p.cwd);
    assert.equal(code, 1, out);
    assert.match(out, /quote/i, 'the refusal must say how to pass a name with a space in it');
    assert.equal(json(run(['session', 'list', '--json'], p.cwd).out)
      .sessions.find((s) => s.session === NAMED)?.name, null);
  } finally { p.dispose(); }
});

test('name with no arguments prints the usage rather than guessing', () => {
  const p = project();
  try {
    seed(p.root);
    const { code, out } = run(['session', 'name'], p.cwd);
    assert.equal(code, 1, out);
    assert.match(out, /usage: mycontext session/);
    assert.match(out, /session name/);
  } finally { p.dispose(); }
});

test('name refuses --json rather than swallowing it on a subcommand that writes', () => {
  const p = project();
  try {
    seed(p.root);
    const { code, out } = run(['session', 'name', NAMED, 'release notes', '--json'], p.cwd);
    assert.equal(code, 1, out);
    // The refusal itself, not the `[--json]` that the usage line under it
    // carries anyway: matching the usage would pass against a command that
    // swallowed the flag and printed its usage for some other reason.
    assert.match(out, /unknown option "--json"/);
    assert.equal(json(run(['session', 'list', '--json'], p.cwd).out)
      .sessions.find((s) => s.session === NAMED)?.name, null);
  } finally { p.dispose(); }
});

test('name is refused in a log with no sessions at all', () => {
  const p = project();
  try {
    const { code, out } = run(['session', 'name', 'sess-anything', 'release notes'], p.cwd);
    assert.equal(code, 1, out);
    assert.match(out, /no sessions/i);
  } finally { p.dispose(); }
});

/**
 * `mycontext session carry` — the three forms, and the two refusals that stop a
 * choice being stored that can never do anything.
 *
 * The disclosure this feeds is Task 19's; what is asserted here is the
 * SELECTOR: which id gets stored, which ids are refused, and that `--show`
 * distinguishes a choice from the default. That last one is the whole reason
 * `--show` exists — the two states behave identically until a newer session
 * appears, at which point one silently moves and the other does not.
 */

/**
 * The output with its line wrapping collapsed.
 *
 * `say` word-wraps every sentence here, and where the break lands depends on
 * the length of the session id in front of it — so a phrase assertion made
 * against the raw text passes or fails on the fixture's id length rather than
 * on what the command said.
 */
function flat(out: string): string {
  return out.replace(/\s+/g, ' ');
}
test('carry --show reports the default, and says it IS the default', () => {
  const p = project();
  try {
    seed(p.root);
    appendSeen(p.root, UNNAMED, [{ id: 'RULE-a', tier: 'jit', at: '2026-08-19T09:00:00.000Z' }]);

    const { code, out } = run(['session', 'carry', '--show'], p.cwd);
    assert.equal(code, 0, out);
    assert.match(out, new RegExp(UNNAMED));
    assert.match(flat(out), /by default/,
      'a default that reads like a choice is a setting nobody can predict');
  } finally { p.dispose(); }
});

test('carry <id> stores the full id, and --show then reports it as chosen', () => {
  const p = project();
  try {
    seed(p.root);
    appendSeen(p.root, NAMED, [{ id: 'RULE-a', tier: 'jit', at: '2026-08-18T09:00:00.000Z' }]);
    appendSeen(p.root, UNNAMED, [{ id: 'RULE-b', tier: 'jit', at: '2026-08-19T09:00:00.000Z' }]);
    setSessionName(p.root, NAMED, 'auth-refactor');

    // A prefix that picks out one session resolves, and the confirmation shows
    // what it resolved TO.
    const set = run(['session', 'carry', NAMED.slice(0, 12)], p.cwd);
    assert.equal(set.code, 0, set.out);
    assert.match(set.out, new RegExp(NAMED));

    const show = run(['session', 'carry', '--show'], p.cwd);
    assert.equal(show.code, 0, show.out);
    assert.match(flat(show.out), /auth-refactor/,
      'the label is the name, since this session has one');
    assert.match(flat(show.out), /chosen with/);
    assert.doesNotMatch(flat(show.out), /by default/);
  } finally { p.dispose(); }
});

test('carry --none is honoured rather than falling back to the default', () => {
  const p = project();
  try {
    seed(p.root);
    appendSeen(p.root, UNNAMED, [{ id: 'RULE-a', tier: 'jit', at: '2026-08-19T09:00:00.000Z' }]);

    assert.equal(run(['session', 'carry', '--none'], p.cwd).code, 0);
    const show = run(['session', 'carry', '--show'], p.cwd);
    assert.equal(show.code, 0, show.out);
    assert.match(flat(show.out), /nothing is carried forward/);
    assert.doesNotMatch(show.out, new RegExp(UNNAMED));
  } finally { p.dispose(); }
});

test('carry refuses a session with nothing left to carry, rather than storing a dead source', () => {
  const p = project();
  try {
    seed(p.root);
    // NAMED is in the audit log and has no seen file: the 30-day sweep case.
    const { code, out } = run(['session', 'carry', NAMED], p.cwd);
    assert.equal(code, 1, out);
    assert.match(flat(out), /nothing left to carry/);
    assert.doesNotMatch(run(['session', 'carry', '--show'], p.cwd).out, new RegExp(NAMED));
  } finally { p.dispose(); }
});

test('carry refuses an id the log has never seen, pointing at `session list`', () => {
  const p = project();
  try {
    seed(p.root);
    const { code, out } = run(['session', 'carry', 'sess-nothing-like-this'], p.cwd);
    assert.equal(code, 1, out);
    assert.match(flat(out), /mycontext session list/);
  } finally { p.dispose(); }
});

test('carry refuses an id and a flag together rather than acting on one of them', () => {
  const p = project();
  try {
    seed(p.root);
    const both = run(['session', 'carry', NAMED, '--none'], p.cwd);
    assert.equal(both.code, 1, both.out);
    assert.match(flat(both.out), /three separate forms/);

    const flags = run(['session', 'carry', '--none', '--show'], p.cwd);
    assert.equal(flags.code, 1, flags.out);
    assert.match(flat(flags.out), /Run them separately/);
  } finally { p.dispose(); }
});

test('carry refuses --json rather than swallowing it on a subcommand that writes', () => {
  const p = project();
  try {
    seed(p.root);
    const { code, out } = run(['session', 'carry', '--show', '--json'], p.cwd);
    assert.equal(code, 1, out);
    assert.match(out, /unknown option "--json"/);
  } finally { p.dispose(); }
});
