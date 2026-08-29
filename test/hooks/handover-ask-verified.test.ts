/**
 * **The ask is verified, not assumed** — plan `handover` seq:9, and the ruling
 * behind it, `DEC-the-ask-and-the-writing-are-two-turns-apart-so-a-flag-is`.
 *
 * `Stop` asks the model to bring the handover up to date when the context
 * window fills, and it records that it asked. Until this task, nothing recorded
 * whether anything happened — so an audit row saying an ask went out read
 * exactly like a mechanism that worked. This project has measured what that
 * costs once already, in a neighbouring mechanism: the item held to be the
 * continuity guarantee was delivered on no event at all, for weeks, and nothing
 * said so.
 *
 * So the two facts are separated here and held apart by measurement: *we asked
 * for a handover* and *a handover happened* are different facts, and only one of
 * them had ever been checked.
 *
 * **What this file pins, on the two events that DESTROY a context window:**
 *
 *  - `PreCompact` and `SessionEnd(reason: 'clear')` both record a verdict, as a
 *    FIELD, so an ask that was acted on and an ask that was ignored are
 *    distinguishable in the log without reading the handover.
 *  - An IGNORED ask discloses on stderr, once, at the last moment where knowing
 *    still helps.
 *  - `off`, `not-asked` and `unverifiable` are three separate answers and never
 *    collapse into `ignored`. An accusation nothing supports is the same defect
 *    as a guarantee nothing supports.
 *
 * `PostCompact` is deliberately absent: it runs after the window is gone and
 * can only report, which the ruling says outright.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { readAudit, type AuditRecord } from '../../src/core/audit.ts';
import {
  checkHandoverAsk, readLatch, writeLatch, type HandoverAskVerdict,
} from '../../src/core/handover-ask.ts';
import { writeTee } from '../../src/core/statusline-tee.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { observeAndRecord } from '../../src/hooks/observe.ts';
import { buildRestoreSnapshot } from '../../src/hooks/pre-compact.ts';
import { buildSessionEndOutcome } from '../../src/hooks/session-end.ts';
import { STOP } from '../../src/hooks/stop.ts';
import { removeTree } from '../helpers/tmp.ts';

const roots: string[] = [];
after(() => { for (const root of roots) removeTree(root); });

interface Sandbox {
  /** The repository directory a hook payload carries as `cwd`. */
  cwd: string;
  /** The `.my_context` directory — where the latch lives. */
  root: string;
  session: string;
}

let sessionCounter = 0;

/** A `context_window` block in the shape Claude Code actually sends. */
function sampleAt(percent: number, window = 200_000): Record<string, unknown> {
  return {
    context_window: {
      context_window_size: window,
      current_usage: {
        input_tokens: (window * percent) / 100,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: 1_234,
      },
    },
  };
}

/**
 * A workspace with (or deliberately without) a `handover` key. The config is
 * MERGED into whatever `init` wrote, for `stop-handover-ask.test.ts`'s reason: a
 * test that silently drops the rest of a real `config.json` is testing a shape
 * no user has.
 */
function sandbox(options: { handoverPath?: string | null } = {}): Sandbox {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-ask-verified-'));
  roots.push(cwd);
  runCli(['init'], cwd, () => {});
  const root = resolveWorkspace(cwd).projectRoot;
  assert.ok(root, 'the sandbox has no workspace');

  const handoverPath = options.handoverPath === undefined ? 'reports/H.md' : options.handoverPath;
  if (handoverPath !== null) {
    const file = path.join(root, 'config.json');
    const raw = existsSync(file)
      ? JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
      : {};
    writeFileSync(
      file,
      JSON.stringify({ ...raw, handover: { path: handoverPath, thresholdPercent: 98 } }, null, 2),
      'utf8',
    );
  }

  sessionCounter += 1;
  return { cwd, root, session: `ask-verified-${sessionCounter}` };
}

/** Runs one `Stop` at an occupancy over the threshold, so an ask goes out. */
function ask(sb: Sandbox): void {
  const written = writeTee(sb.root, { session_id: sb.session, ...sampleAt(99) });
  assert.deepEqual(written, { written: true }, 'the status-line fixture was not written');
  const outcome = observeAndRecord(
    STOP,
    { session_id: sb.session, cwd: sb.cwd, hook_event_name: 'Stop', stop_hook_active: false },
    sb.cwd,
  );
  assert.notEqual(outcome.stdout, '', 'the sandbox did not produce an ask to verify');
}

/**
 * The model writing the handover, placed on either side of the ask. The mtime is
 * SET rather than left to the clock — see the same helper in
 * `stop-handover-ask.test.ts`: a file written in the same millisecond as the ask
 * is a coin flip against a comparison that is deliberately strict.
 */
function writeHandover(sb: Sandbox, when: 'before' | 'after'): void {
  const askedAt = readLatch(sb.root, sb.session).askedAt;
  assert.ok(askedAt !== null, 'nothing has been asked yet');
  const file = path.join(sb.cwd, 'reports', 'H.md');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, '# Handover\nwhat was decided, and why.\n', 'utf8');
  const at = new Date(Date.parse(askedAt) + (when === 'after' ? 2_000 : -2_000));
  utimesSync(file, at, at);
}

interface Run {
  row: AuditRecord;
  stderr: string;
}

/** Captures everything a hook body writes to stderr while it runs. */
function capturing<T>(body: () => T): { value: T; stderr: string } {
  let stderr = '';
  const real = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stderr.write;
  try {
    return { value: body(), stderr };
  } finally {
    process.stderr.write = real;
  }
}

function lastRow(sb: Sandbox, op: string): AuditRecord {
  const row = readAudit(sb.root).filter((r) => r.op === op && r.sessionId === sb.session).at(-1);
  assert.ok(row, `no ${op} row was recorded`);
  return row;
}

/** One `PreCompact`, and the row and disclosure it produced. */
function preCompact(sb: Sandbox): Run {
  const { stderr } = capturing(() => buildRestoreSnapshot(
    { session_id: sb.session, cwd: sb.cwd, hook_event_name: 'PreCompact', trigger: 'auto' },
    sb.cwd,
  ));
  return { row: lastRow(sb, 'pre-compact'), stderr };
}

/** One `SessionEnd` with `reason: 'clear'`, and the row and disclosure it produced. */
function sessionEndClear(sb: Sandbox): Run {
  const { stderr } = capturing(() => buildSessionEndOutcome(
    { session_id: sb.session, cwd: sb.cwd, hook_event_name: 'SessionEnd', reason: 'clear' },
    sb.cwd,
  ));
  return { row: lastRow(sb, 'session-end'), stderr };
}

/* ---------------------------------------------------------------------------
 * The comparison itself.
 * ------------------------------------------------------------------------- */

test('an ask that was acted on and one that was ignored are told apart by the file', () => {
  const acted = sandbox();
  ask(acted);
  writeHandover(acted, 'after');
  assert.equal(preCompact(acted).row.handoverAsk, 'acted-on');

  const ignored = sandbox();
  ask(ignored);
  assert.equal(preCompact(ignored).row.handoverAsk, 'ignored');
});

/**
 * Strictly `>`. Without it, any project that keeps a handover file at all would
 * be read as having answered every ask it ever ignored — the reassuring wrong
 * answer, which is the one this whole task exists to stop the log giving.
 */
test('a handover last written BEFORE the ask is not an answer to it', () => {
  const sb = sandbox();
  ask(sb);
  writeHandover(sb, 'before');
  assert.equal(preCompact(sb).row.handoverAsk, 'ignored');
});

/**
 * Three ways of not having an answer, and none of them is `ignored`. `off` is
 * "nobody configured a handover"; `not-asked` is "somebody did and this session
 * never crossed the threshold"; `unverifiable` is "the comparison could not be
 * made". Collapsing any of them into `ignored` would put an accusation in the
 * log that nothing supports, which is the same defect as the guarantee nothing
 * supported.
 */
test('off, not-asked and unverifiable are three answers and never ignored', () => {
  const off = sandbox({ handoverPath: null });
  assert.equal(preCompact(off).row.handoverAsk, 'off');

  const quiet = sandbox();
  assert.equal(preCompact(quiet).row.handoverAsk, 'not-asked');

  const broken = sandbox();
  ask(broken);
  const latch = readLatch(broken.root, broken.session);
  assert.ok(writeLatch(broken.root, broken.session, { ...latch, askedAt: 'not a timestamp' }));
  assert.equal(preCompact(broken).row.handoverAsk, 'unverifiable');
});

/**
 * `off` and `not-asked` describe a mechanism nobody engaged, so they add no
 * prose to a row that lands on every compaction in every workspace — the field
 * carries them for whoever wants the count. The two that matter say WHICH ask
 * and WHEN, because a verdict with no timestamps behind it is a verdict nobody
 * can check.
 */
test('the note names the ask and its timestamps, and stays quiet when nothing was asked', () => {
  const quiet = sandbox();
  assert.doesNotMatch(preCompact(quiet).row.note ?? '', /handover ask/u);

  const sb = sandbox();
  ask(sb);
  const askedAt = readLatch(sb.root, sb.session).askedAt;
  assert.ok(askedAt !== null);
  const note = preCompact(sb).row.note ?? '';
  assert.match(note, /handover ask ignored/u);
  assert.match(note, /reports\/H\.md/u);
  assert.ok(note.includes(askedAt), 'the note does not say WHICH ask it judged');
});

/* ---------------------------------------------------------------------------
 * The disclosure.
 * ------------------------------------------------------------------------- */

/**
 * A stale handover about to be destroyed by a compaction is precisely the
 * silence this feature exists to answer, so it is the ONE thing `PreCompact`
 * says out loud — the hook that deliberately swallows the occupancy stand-down
 * line rather than compete with Claude Code's own compaction notice. The
 * difference is argued on `ignoredAskLine`: one asks the user to go and install
 * something, the other reports that a promise was not kept.
 */
test('an ignored ask discloses on stderr; every other verdict is silent', () => {
  const ignored = sandbox();
  ask(ignored);
  const run = preCompact(ignored);
  assert.match(run.stderr, /reports\/H\.md/u);
  assert.match(run.stderr, /compaction/u);
  assert.equal(run.stderr.trimEnd().split('\n').length, 1, 'the disclosure is more than one line');

  const acted = sandbox();
  ask(acted);
  writeHandover(acted, 'after');
  assert.equal(preCompact(acted).stderr, '', 'the mechanism working announced itself');

  const quiet = sandbox();
  assert.equal(preCompact(quiet).stderr, '',
    'a session that was never asked was told its handover was ignored');
});

/**
 * ONCE per session, across both boundaries. A session can be compacted more
 * than once and each compaction is a real, separate loss — so there is a
 * genuine argument for saying it again, and the latch wins anyway: this
 * product's standing choice is silence wherever it has one, and a paragraph
 * the user has already read and already declined to act on teaches nothing the
 * second time. The ROW still carries every occurrence, which is the channel
 * that is supposed to be exhaustive.
 */
test('the disclosure is made once per session; the row records every time', () => {
  const sb = sandbox();
  ask(sb);
  assert.notEqual(preCompact(sb).stderr, '', 'the first compaction said nothing');

  const second = preCompact(sb);
  assert.equal(second.stderr, '',
    'the disclosure repeated on a second compaction in one session');
  assert.equal(second.row.handoverAsk, 'ignored',
    'the row went quiet with the line — the log is the channel that must be exhaustive');

  assert.equal(sessionEndClear(sb).stderr, '',
    'the other boundary repeated the line the compaction had already made');
});

/* ---------------------------------------------------------------------------
 * The other boundary that destroys a window.
 * ------------------------------------------------------------------------- */

test('SessionEnd with reason=clear runs the same check and records the same verdict', () => {
  const ignored = sandbox();
  ask(ignored);
  const run = sessionEndClear(ignored);
  assert.equal(run.row.handoverAsk, 'ignored');
  assert.match(run.row.note ?? '', /handover ask ignored/u);
  assert.match(run.stderr, /\/clear/u);

  const acted = sandbox();
  ask(acted);
  writeHandover(acted, 'after');
  const good = sessionEndClear(acted);
  assert.equal(good.row.handoverAsk, 'acted-on');
  assert.equal(good.stderr, '');
});

/**
 * Everything this hook already did, unchanged. The clear is the whole point of
 * the event — a `/clear` mints a new session id, so this firing is the only one
 * that can reach the destroyed window's state — and a handover check must not
 * have cost a word of it.
 */
test('the clear itself, and the sentence that describes it, are untouched', () => {
  const sb = sandbox();
  ask(sb);
  const { value } = capturing(() => buildSessionEndOutcome(
    { session_id: sb.session, cwd: sb.cwd, hook_event_name: 'SessionEnd', reason: 'clear' },
    sb.cwd,
  ));
  assert.equal(value.action, 'cleared');
  assert.match(value.note, /seen file/u);
  assert.match(lastRow(sb, 'session-end').note ?? '', /^reason=clear; /u);
});

/**
 * A `reason` that does not destroy a window gets no check and no row, exactly as
 * before: its id and transcript survive, so its handover is not about to become
 * the only record of anything.
 */
test('a retained session end asks nothing about the handover', () => {
  const sb = sandbox();
  ask(sb);
  const { value, stderr } = capturing(() => buildSessionEndOutcome(
    { session_id: sb.session, cwd: sb.cwd, hook_event_name: 'SessionEnd', reason: 'resume' },
    sb.cwd,
  ));
  assert.equal(value.action, 'retained');
  assert.equal(stderr, '');
  assert.equal(
    readAudit(sb.root).filter((r) => r.op === 'session-end' && r.sessionId === sb.session).length,
    0,
  );
});

/* ---------------------------------------------------------------------------
 * The comparison as a function — the cases the hooks cannot easily stage.
 * ------------------------------------------------------------------------- */

/**
 * `checkHandoverAsk` never throws, for any filesystem outcome. Every caller is a
 * hook, `INV-hooks-fail-open` governs all three of them, and a verification that
 * threw would take a compaction's restore snapshot down with it.
 */
test('the check never throws, whatever it is pointed at', () => {
  const sb = sandbox();
  const cases: { handover: { path: string; marker: string; budgetTokens: number } | null }[] = [
    { handover: null },
    { handover: { path: 'reports/H.md', marker: '⏭', budgetTokens: 1200 } },
    // A DIRECTORY where a file was configured: there is no handover there
    // either way, and its mtime answers a question nobody asked.
    { handover: { path: 'reports', marker: '⏭', budgetTokens: 1200 } },
  ];
  mkdirSync(path.join(sb.cwd, 'reports'), { recursive: true });
  for (const { handover } of cases) {
    assert.doesNotThrow(() => checkHandoverAsk(sb.root, handover, sb.session));
  }
  assert.doesNotThrow(() => checkHandoverAsk(sb.root, null, ''));
});

/**
 * The handover is resolved against the REPOSITORY, not against `.my_context/`.
 * `core/handover.ts` names this trap at length: a repo-relative path resolved
 * inside `.my_context/` never exists, so every configured handover in the world
 * reports as missing. Here the same mistake would report every ask as IGNORED —
 * a loud, plausible, permanent lie — so the root is taken once, inside the
 * function, and this test is what holds it there.
 */
test('the handover is resolved against the repository root, not the corpus directory', () => {
  const sb = sandbox();
  ask(sb);
  writeHandover(sb, 'after');
  const handover = { path: 'reports/H.md', marker: '⏭', budgetTokens: 1200 };
  const check = checkHandoverAsk(sb.root, handover, sb.session);
  assert.equal(check.verdict, 'acted-on' satisfies HandoverAskVerdict);
  assert.ok(existsSync(path.join(sb.cwd, 'reports', 'H.md')));
});
