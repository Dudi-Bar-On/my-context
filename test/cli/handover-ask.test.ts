/**
 * **`mycontext handover ask`, and the core every surface of it shares.**
 *
 * `plan:handover seq:14`, owner ruling 2026-09-06: the handover can be asked
 * for on demand, from a CLI command, a slash command and an MCP tool. The
 * slash command runs the CLI and the MCP tool calls the same function, so what
 * is tested here is the function and the one surface that renders it — a third
 * copy of these assertions against `ask_handover` would test the renderer
 * twice and the decision once.
 *
 * ── THE HAZARD THIS FILE IS WRITTEN AGAINST ────────────────────────────────
 *
 * The ask latch of a LIVE session is a real file under `.my_context/state/`,
 * and a test that stamped it would put a false ask on the owner's status line
 * and could provoke a spurious handover ask in the session he is working in.
 * This project's standing rule is that tests run against the current corpus;
 * this is the one case where that must not be read as "write to the current
 * corpus".
 *
 * Three things keep that true, and the third is the only one that does not
 * depend on this file staying careful:
 *
 *  1. Every root here is an `mkdtempSync` sandbox and every session id is
 *     fabricated (`sess-N`), never a real one.
 *  2. `env` is passed EXPLICITLY wherever identity is under test. The suite
 *     runs inside a Claude Code session, so the real `CLAUDE_CODE_SESSION_ID`
 *     is in `process.env` — a test that let the default through would be
 *     testing the machine it happens to run on.
 *  3. **`askHandoverNow` cannot reach outside the root it is given.** The
 *     latch it writes is `latchPath(root, …)`, and `root` is an argument. The
 *     last test in this file pins that, because it is the property that makes
 *     the other two belt-and-braces rather than the whole guarantee.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { recordAudit } from '../../src/core/audit.ts';
import { CONTEXT_SAMPLE_FRESH_MS } from '../../src/core/context-occupancy.ts';
import {
  askHandoverNow, checkHandoverAsk, handoverConfigAt, latchPath, readLatch,
  runningLanes, sessionFromEnvironment, writeLatch, NO_LATCH,
} from '../../src/core/handover-ask.ts';
import { writeTee } from '../../src/core/statusline-tee.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const roots: string[] = [];
after(() => { for (const root of roots) removeTree(root); });

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

interface Sandbox {
  cwd: string;
  root: string;
  session: string;
}

let counter = 0;

/**
 * A workspace with (or deliberately without) a `handover` key.
 *
 * MERGED into whatever `init` wrote, for `stop-handover-ask.test.ts`'s reason:
 * a fixture that drops the rest of a real `config.json` is testing a shape no
 * user has.
 */
function sandbox(options: { handoverPath?: string | null } = {}): Sandbox {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-ondemand-'));
  roots.push(cwd);
  runCli(['init'], cwd, () => {});
  const root = resolveWorkspace(cwd).projectRoot;
  assert.ok(root, 'the sandbox has no workspace');

  const handoverPath = options.handoverPath === undefined ? 'reports/H.md' : options.handoverPath;
  if (handoverPath !== null) {
    const file = path.join(root, 'config.json');
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    writeFileSync(
      file, JSON.stringify({ ...raw, handover: { path: handoverPath } }, null, 2), 'utf8');
  }

  counter += 1;
  return { cwd, root, session: `sess-${counter}` };
}

/**
 * Puts a context sample for `session` in the sandbox's bridge.
 *
 * Through `writeTee`, the real writer, so the file name and the
 * `{ receivedAt, payload }` envelope stay `statusline-tee.ts`'s to decide — the
 * same care `stop-handover-ask.test.ts` takes, for the same reason.
 */
function tee(sb: Sandbox, session: string, percent: number, stale = false): void {
  const receivedAt = stale
    ? new Date(Date.now() - CONTEXT_SAMPLE_FRESH_MS - 60_000).toISOString()
    : new Date().toISOString();
  const written = writeTee(sb.root, { session_id: session, ...sampleAt(percent) }, receivedAt);
  assert.deepEqual(written, { written: true }, 'the status-line fixture was not written');
}

/** One `agent-dispatched` row, exactly as `hooks/post-tool-use.ts` writes it. */
function dispatch(sb: Sandbox, session: string, agentId: string, what: string): void {
  const written = recordAudit(sb.root, {
    kind: 'hook',
    op: 'agent-dispatched',
    hook: 'PostToolUse',
    sessionId: session,
    note: `dispatched type=general-purpose agent=${agentId}: ${what}`,
  });
  assert.equal(written.written, true, 'the dispatch fixture was not written');
}

/** The `subagent-stop` row that closes one, in `hooks/subagent-stop.ts`'s shape. */
function stop(sb: Sandbox, session: string, agentId: string): void {
  const written = recordAudit(sb.root, {
    kind: 'hook',
    op: 'subagent-stop',
    hook: 'SubagentStop',
    sessionId: session,
    note: `delivery=finished agent=${agentId} type=general-purpose; its seen file was left in place`,
  });
  assert.equal(written.written, true, 'the stop fixture was not written');
}

/**
 * `mycontext handover …` in a sandbox, with its output joined.
 *
 * **The environment is swapped for the duration and put back**, because
 * `runCli` takes no environment and the command reads `process.env` — which,
 * in this suite, carries the REAL `CLAUDE_CODE_SESSION_ID` of whatever session
 * is running the tests. `session: null` is the outside-Claude-Code case and
 * deletes the variable rather than blanking it, since those are two different
 * shapes a shell can produce and only one of them is what a plain terminal
 * looks like.
 *
 * Swapping it cannot reach the live latch: what a fabricated id selects is
 * `latchPath(sb.root, id)`, and `sb.root` is a temporary directory.
 */
function cli(
  sb: Sandbox, args: string[], session: string | null = sb.session,
): { code: number; out: string } {
  const had = Object.hasOwn(process.env, 'CLAUDE_CODE_SESSION_ID');
  const previous = process.env.CLAUDE_CODE_SESSION_ID;
  if (session === null) delete process.env.CLAUDE_CODE_SESSION_ID;
  else process.env.CLAUDE_CODE_SESSION_ID = session;
  let out = '';
  try {
    const code = runCli(['handover', ...args], sb.cwd, (s) => { out += `${s}\n`; });
    return { code, out };
  } finally {
    if (had) process.env.CLAUDE_CODE_SESSION_ID = previous;
    else delete process.env.CLAUDE_CODE_SESSION_ID;
  }
}

// ─── the refusals, and that not one of them invents a number ────────────────

test('a workspace with no handover configured is `off`, and nothing is asked for', () => {
  const sb = sandbox({ handoverPath: null });
  const result = askHandoverNow(sb.root, { env: { CLAUDE_CODE_SESSION_ID: sb.session } });
  assert.equal(result.verdict, 'off');
  assert.equal(result.percent, null);
  assert.equal(result.askedAt, null);
  assert.equal(result.ask, '');
  assert.equal(existsSync(latchPath(sb.root, sb.session)), false);
});

/**
 * **The ruling, and the whole of it**: outside a Claude Code session there is
 * nothing to ask, so the answer is a refusal and not a search for a session to
 * mean instead.
 */
test('outside a Claude Code session the ask is REFUSED, and nothing is written', () => {
  const sb = sandbox();
  const result = askHandoverNow(sb.root, { env: {} });
  assert.equal(result.verdict, 'outside-session');
  assert.equal(result.sessionId, null);
  assert.equal(result.percent, null, 'a refused ask reports no occupancy at all, not zero');
  assert.match(result.note, /no Claude Code session/);
  assert.match(result.note, /Nothing was written/);
});

test('a warm session in the corpus does NOT stand in for the one you are not in', () => {
  const sb = sandbox();
  // Two sessions the bridge can measure perfectly well, and one of them is even
  // unambiguous on its own. An earlier shape resolved "the live session" from
  // exactly this; the ruling of 2026-09-06 removed it, because a command run
  // from a plain terminal must refuse whether or not a session happens to be
  // warm — being able to name one is not being in one.
  tee(sb, 'sess-a', 40);
  const result = askHandoverNow(sb.root, { env: {} });
  assert.equal(result.verdict, 'outside-session');
  assert.equal(existsSync(latchPath(sb.root, 'sess-a')), false);

  tee(sb, 'sess-b', 41);
  assert.equal(askHandoverNow(sb.root, { env: {} }).verdict, 'outside-session');
  assert.equal(existsSync(latchPath(sb.root, 'sess-b')), false);
});

test('the session is the one the environment names, and an empty variable names none', () => {
  assert.equal(
    sessionFromEnvironment({ CLAUDE_CODE_SESSION_ID: 'sess-env' }), 'sess-env',
    'CLAUDE_CODE_SESSION_ID is a statement by the only party that knows which session this is',
  );
  assert.equal(sessionFromEnvironment({ CLAUDE_CODE_SESSION_ID: '' }), null);
  assert.equal(sessionFromEnvironment({}), null);
});

/**
 * The second half of the signal, and the reason the first half being an
 * environment variable is not the whole story: a forged id has no current
 * sample in this corpus, so it is refused for want of an occupancy. That is
 * not authentication and this test does not claim it is — it is the difference
 * between exporting a variable and fabricating a live status-line sample.
 */
test('an id the bridge has never measured is refused, however it got into the environment', () => {
  const sb = sandbox();
  tee(sb, sb.session, 41.5);
  const result = askHandoverNow(sb.root, { env: { CLAUDE_CODE_SESSION_ID: 'sess-forged' } });
  assert.equal(result.verdict, 'no-occupancy');
  assert.equal(existsSync(latchPath(sb.root, 'sess-forged')), false);
});

test('an unreadable occupancy is refused, and no percentage is invented for it', () => {
  const sb = sandbox();
  // Identity is not in doubt — the environment names the session — and there
  // is still no reading for it. This is the branch that would default to the
  // threshold, to zero, or to the last value seen if anything here were
  // allowed to guess.
  const result = askHandoverNow(sb.root, { env: { CLAUDE_CODE_SESSION_ID: sb.session } });
  assert.equal(result.verdict, 'no-occupancy');
  assert.equal(result.why, 'no-bridge');
  assert.equal(result.percent, null);
  assert.equal(result.step, null);
  assert.equal(existsSync(latchPath(sb.root, sb.session)), false);
});

test('a STALE sample is an unreadable occupancy, not a reading', () => {
  const sb = sandbox();
  tee(sb, sb.session, 61, true);
  const result = askHandoverNow(sb.root, { env: { CLAUDE_CODE_SESSION_ID: sb.session } });
  assert.equal(result.verdict, 'no-occupancy');
  assert.equal(result.why, 'stale');
  assert.equal(result.percent, null);
});

// ─── the third refusal: work in flight ──────────────────────────────────────

test('a lane with no stop row behind it is RUNNING, and one with a stop row is not', () => {
  const sb = sandbox();
  dispatch(sb, sb.session, 'aopen', 'library/1 CLI help browser');
  dispatch(sb, sb.session, 'aclosed', 'a lane that finished');
  stop(sb, sb.session, 'aclosed');
  // Another session's lane, still open. It is not this session's business and
  // is the shape every fossil in a long-lived log has.
  dispatch(sb, 'sess-other', 'aforeign', 'somebody else’s lane');

  const lanes = runningLanes(sb.root, sb.session);
  assert.ok(lanes !== null, 'the audit log read back as unmeasured');
  assert.deepEqual(lanes.map((l) => l.agentId), ['aopen']);
  assert.equal(lanes[0].what, 'library/1 CLI help browser');
  assert.equal(lanes[0].type, 'general-purpose');
  assert.equal(lanes[0].lastStepAt, null, 'no step was recorded, so none is claimed');
});

test('running work is DISCLOSED BY NAME and nothing is asked for', () => {
  const sb = sandbox();
  tee(sb, sb.session, 41);
  dispatch(sb, sb.session, 'alane', 'builder/10 composer pickers');

  const result = askHandoverNow(sb.root, { env: { CLAUDE_CODE_SESSION_ID: sb.session } });
  assert.equal(result.verdict, 'work-in-flight');
  assert.deepEqual(result.running.map((l) => l.what), ['builder/10 composer pickers']);
  assert.equal(existsSync(latchPath(sb.root, sb.session)), false);
  // The occupancy IS reported on this branch, because it was measured. A
  // refusal that could measure and did not report would make the person choose
  // without the one number the choice turns on.
  assert.equal(result.percent, 41);
});

test('`anyway` proceeds past running work, and past it ALONE', () => {
  const sb = sandbox();
  tee(sb, sb.session, 41);
  dispatch(sb, sb.session, 'alane', 'builder/10 composer pickers');

  const asked = askHandoverNow(sb.root, { env: { CLAUDE_CODE_SESSION_ID: sb.session }, anyway: true });
  assert.equal(asked.verdict, 'asked');

  // The other two refusals are not "warnings the person may wave through":
  // one of them stamps the wrong session and the other stamps a number nobody
  // measured, and `--anyway` reaches neither.
  const noOccupancy = sandbox();
  dispatch(noOccupancy, noOccupancy.session, 'alane', 'x');
  assert.equal(
    askHandoverNow(noOccupancy.root, {
      env: { CLAUDE_CODE_SESSION_ID: noOccupancy.session }, anyway: true,
    }).verdict,
    'no-occupancy',
  );
  const outside = sandbox();
  assert.equal(
    askHandoverNow(outside.root, { env: {}, anyway: true }).verdict, 'outside-session');
});

// ─── the ask itself ─────────────────────────────────────────────────────────

test('the ask stamps the measured percent, counts itself, and claims no threshold', () => {
  const sb = sandbox();
  tee(sb, sb.session, 41.5);
  // A previous ask by `Stop`, at a threshold. The on-demand ask must not
  // rewrite what threshold the last threshold-driven ask went out at — that
  // field is what `Stop`'s lowered-threshold re-arming reads.
  writeLatch(sb.root, sb.session, {
    ...NO_LATCH, askedAtThreshold: 85, askedAtPercent: 85, askedAt: '2026-09-06T10:00:00.000Z',
    asks: 1, satisfied: true,
  });

  const now = new Date('2026-09-06T12:00:00.000Z');
  const result = askHandoverNow(sb.root, { env: { CLAUDE_CODE_SESSION_ID: sb.session }, now });

  assert.equal(result.verdict, 'asked');
  assert.equal(result.percent, 41.5);
  assert.equal(result.step, 41, 'the whole percent is `askStep`\'s, floored, never rounded');
  assert.equal(result.askedAt, '2026-09-06T12:00:00.000Z');
  assert.match(result.ask, /41.5% full/);
  assert.match(result.ask, /on demand, by the person working with you/);
  assert.match(result.ask, /reports\/H\.md/);

  const latch = readLatch(sb.root, sb.session);
  assert.equal(latch.askedAtPercent, 41);
  assert.equal(latch.askedAt, '2026-09-06T12:00:00.000Z');
  assert.equal(latch.asks, 2, 'an ask counts itself, exactly as `Stop`\'s does');
  assert.equal(latch.satisfied, false, 'a new ask is a new thing to satisfy');
  assert.equal(
    latch.askedAtThreshold, 85,
    'an on-demand ask was delivered at no threshold, so it carries the last one forward ' +
    'rather than claiming one',
  );
});

test('the ask does NOT consult the threshold — that is the whole of the on-demand case', () => {
  const sb = sandbox();
  // 12% is far below the default threshold and below any configured one. The
  // Stop hook would say nothing here; the point of the command is that a person
  // may.
  tee(sb, sb.session, 12.4);
  const result = askHandoverNow(sb.root, { env: { CLAUDE_CODE_SESSION_ID: sb.session } });
  assert.equal(result.verdict, 'asked');
  assert.equal(result.step, 12);
});

test('asking twice in one whole percent is allowed — the progress gate is `Stop`\'s, not a person\'s', () => {
  const sb = sandbox();
  tee(sb, sb.session, 41.5);
  const first = askHandoverNow(sb.root, {
    env: { CLAUDE_CODE_SESSION_ID: sb.session }, now: new Date('2026-09-06T12:00:00.000Z'),
  });
  const second = askHandoverNow(sb.root, {
    env: { CLAUDE_CODE_SESSION_ID: sb.session }, now: new Date('2026-09-06T12:05:00.000Z'),
  });
  assert.equal(first.verdict, 'asked');
  assert.equal(second.verdict, 'asked');
  assert.equal(readLatch(sb.root, sb.session).askedAt, '2026-09-06T12:05:00.000Z');
  assert.equal(readLatch(sb.root, sb.session).asks, 2);
});

// ─── the defect this closes, end to end ─────────────────────────────────────

/**
 * **The measured defect, and the proof that shape (a) closes it.**
 *
 * `checkHandoverAsk` reads the latch and returns on a null `askedAt` before it
 * ever stats the file, so a handover written by hand at 40% — current,
 * complete, correct — reports `not-asked`, and both surfaces say "no handover
 * ask yet". The chosen fix does not widen that verdict: it makes the missing
 * half exist, and everything downstream then works because the mechanism only
 * ever knew about asks.
 */
test('a handover written before any ask reports `not-asked`, and asking is what closes it', () => {
  const sb = sandbox();
  tee(sb, sb.session, 40.5);
  const handover = path.join(sb.cwd, 'reports', 'H.md');
  mkdirSync(path.dirname(handover), { recursive: true });
  writeFileSync(handover, '# handover\n\nwritten early, by hand.\n', 'utf8');
  const config = handoverConfigAt(sb.root);
  assert.ok(config, 'the sandbox has no handover configured');

  // Both timestamps are pinned rather than raced. `checkHandoverAsk` compares
  // an mtime against the ask, strictly, and a fixture that let the real clock
  // decide either half would be a test whose colour depended on how fast the
  // machine got from one line to the next.
  const before = new Date('2026-09-06T11:00:00.000Z');
  const after = new Date('2026-09-06T12:05:00.000Z');
  utimesSync(handover, before, before);

  // The defect, reproduced: a current, complete file and a verdict that says
  // nothing is prepared.
  assert.equal(checkHandoverAsk(sb.root, config, sb.session).verdict, 'not-asked');

  askHandoverNow(sb.root, {
    env: { CLAUDE_CODE_SESSION_ID: sb.session }, now: new Date('2026-09-06T12:00:00.000Z'),
  });

  // Now there IS an ask, and the file predates it — which is `ignored`, and is
  // correct rather than a regression: an ask has just gone out and the file has
  // not been written since. The model writes it, and the ordinary comparison
  // reports `acted-on`. No new verdict was needed for any of it.
  assert.equal(checkHandoverAsk(sb.root, config, sb.session).verdict, 'ignored');
  writeFileSync(handover, '# handover\n\nrewritten in answer to the ask.\n', 'utf8');
  utimesSync(handover, after, after);
  assert.equal(checkHandoverAsk(sb.root, config, sb.session).verdict, 'acted-on');
});

// ─── the CLI surface ────────────────────────────────────────────────────────

test('the CLI refuses a verb it does not have, and an operand it does not take', () => {
  const sb = sandbox();
  assert.match(cli(sb, []).out, /needs a verb/);
  assert.equal(cli(sb, []).code, 1);
  assert.match(cli(sb, ['mute']).out, /is not something handover does/);
  assert.match(cli(sb, ['ask', 'CONST-x']).out, /takes no operand/);
});

test('the CLI refuses an unknown flag BEFORE it looks for the verb', () => {
  const sb = sandbox();
  const { out } = cli(sb, ['--zzz-not-a-flag']);
  assert.match(
    out, /unknown option "--zzz-not-a-flag"/,
    'the approval-boundary probe reaches a command\'s flag surface by handing it a sentinel ' +
    'flag with no positional; a command that answers about the positional first is one that ' +
    'probe cannot measure, and five commands sat in exactly that gap',
  );
});

test('the CLI names the running lanes and offers the choice, without taking it', () => {
  const sb = sandbox();
  tee(sb, sb.session, 41);
  dispatch(sb, sb.session, 'alane', 'library/1 CLI help browser');
  const { code, out } = cli(sb, ['ask']);
  assert.equal(code, 1);
  assert.match(out, /library\/1 CLI help browser/, 'the lane is NAMED, not counted');
  assert.match(out, /wait for them to finish/);
  assert.match(out, /--anyway/);
  assert.match(
    out, /no control that ends a lane/,
    'stopping a lane has no implementation behind it in this product, and the disclosure says ' +
    'so rather than offering a verb that does nothing',
  );
});

test('the CLI prints the ask, and `--json` is the same answer for a machine', () => {
  const sb = sandbox();
  tee(sb, sb.session, 41.5);
  const human = cli(sb, ['ask']);
  assert.equal(human.code, 0);
  assert.match(human.out, /41.5% full/);

  const sb2 = sandbox();
  tee(sb2, sb2.session, 41.5);
  const json = cli(sb2, ['ask', '--json']);
  assert.equal(json.code, 0);
  const parsed = JSON.parse(json.out) as Record<string, unknown>;
  assert.equal(parsed.verdict, 'asked');
  assert.equal(parsed.percent, 41.5);
  assert.equal(parsed.sessionId, sb2.session);
});

test('a refusal exits non-zero on both renderings, so a script cannot read one as an ask', () => {
  const sb = sandbox({ handoverPath: null });
  assert.equal(cli(sb, ['ask']).code, 1);
  assert.equal(cli(sb, ['ask', '--json']).code, 1);
});

test('the CLI run OUTSIDE Claude Code prints the owner\'s refusal and writes nothing', () => {
  const sb = sandbox();
  tee(sb, sb.session, 41.5);
  const { code, out } = cli(sb, ['ask'], null);
  assert.equal(code, 1);
  assert.match(out, /no Claude Code session/);
  assert.match(out, /Nothing was written/);
  assert.match(
    out, /only be run from inside Claude Code/,
    'the refusal has to SAY why, not merely decline — a person in a terminal has no other ' +
    'way to learn that this command is not for them',
  );
  assert.equal(
    existsSync(latchPath(sb.root, sb.session)), false,
    'a session the bridge can measure is standing right there, and it is still not asked',
  );
});

test('the successful line names the percent, the path and what happens next', () => {
  const sb = sandbox();
  tee(sb, sb.session, 41.5);
  const { out } = cli(sb, ['ask']);
  // The owner's own shape for this line, kept as three properties rather than
  // as literal text: the percent it was asked at, the file, and the fact that
  // the assistant is being asked rather than the file being written here.
  assert.match(out, /asked at 41%/);
  assert.match(out, /reports\/H\.md/);
  assert.match(out, /askedAtPercent=41/);
});

// ─── the containment that does not depend on this file staying careful ──────

test('the latch a request writes is under the ROOT it was given, and nowhere else', () => {
  const sb = sandbox();
  tee(sb, 'sess-elsewhere', 41);
  const result = askHandoverNow(sb.root, { env: { CLAUDE_CODE_SESSION_ID: 'sess-elsewhere' } });
  assert.equal(result.verdict, 'asked');

  const written = latchPath(sb.root, 'sess-elsewhere');
  assert.equal(existsSync(written), true);
  assert.equal(
    path.relative(sb.root, written).startsWith('..'), false,
    'the ask wrote outside the root it was handed. `root` is an argument and the latch path ' +
    'is derived from it, so no session id — however real — can reach another corpus.',
  );
});
