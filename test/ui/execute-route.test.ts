/**
 * The two execute routes, over real HTTP (plan Task 5; spec §3.1, §3.3, §3.4,
 * §6.1, §6.2, §6.3).
 *
 * **What this file is actually about is an ORDER.** `POST /api/execute` does
 * six things and the security story is entirely in the sequence: shape, then
 * resolve, then redeem against the argv the SERVER built, then the `execute`
 * row, then run, then the `execute-done` row beside it. Every step has an
 * assertion here that fails if the step moves,
 * because each of the two plausible re-orderings is silent in production and
 * loud only against a test that was written to notice:
 *
 *   - redeem BEFORE resolve → the nonce is checked against something the
 *     client described. `an unknown id is 400, and it is 400 BEFORE the nonce
 *     is even looked at` is the one that goes red.
 *   - audit AFTER the run → a run that could not be recorded happened anyway.
 *     `a run that CANNOT be recorded does not happen` is the one that goes red.
 *
 * The harness spelling — `project()`, `tokenFor`, a `fetch` carrying
 * `TOKEN_HEADER` — is `test/ui/server.test.ts`'s, reused rather than reinvented
 * so there is one answer in this suite to "how do you get a token".
 *
 * Routes registered here land in the table `routes.ts` owns, which is
 * process-global; `node --test` runs each FILE in its own process, which is the
 * fact `server.test.ts` states and this file depends on for the same reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { auditLogPath, readAudit, recordAudit, type AuditRecord } from '../../src/core/audit.ts';
import { TOKEN_HEADER } from '../../src/ui/security.ts';
import { startUiServer, type RunningUiServer } from '../../src/ui/server.ts';
import { ExecutionNonceStore } from '../../src/ui/execute-nonce.ts';
// Pins the session store out of the real `~/.my-context`; see the module.
import '../helpers/pin-sessions-dir.ts';
import {
  CLI_ENTRY, EXECUTION_RESIDUAL, RUN_TIMEOUT_MS, execFileRunner, registerExecuteRoutes,
  type CommandRunner, type RunOutcome,
} from '../../src/ui/execute.ts';

/* -------------------------------------------------------------------------- *
 * Harness.
 * -------------------------------------------------------------------------- */

/**
 * The id the confirm tests pin against, and it must NAME A REAL ITEM.
 *
 * Before seq:5b the confirm derived nothing, so `pin ${FIXTURE_ITEM}` against an empty
 * workspace answered 200 with a nonce: the route never asked whether the
 * command could succeed. The confirm now DERIVES the effect by running the
 * command against a throwaway copy, so a command that cannot succeed has no
 * effect to show and §3.2 refuses it a confirm. An id naming nothing is
 * therefore a 400 — the new contract, not a regression.
 */
const FIXTURE_ITEM = 'RULE-a-fixture-rule';

function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-exec-'));
  assert.equal(runCli(['init'], dir, () => {}), 0);
  assert.equal(
    runCli(['add', 'rule', 'a fixture rule', '--body', 'a body', '--yes'], dir, () => {}),
    0,
  );
  return dir;
}

/** The token, taken the way the page takes it: mint a nonce, redeem it once. */
async function tokenFor(server: RunningUiServer): Promise<string> {
  const nonce = new URL(server.urlWithNonce(10_000)).hash.slice(1);
  const response = await fetch(`http://127.0.0.1:${server.port}/api/handoff`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nonce }),
  });
  assert.equal(response.status, 200);
  return ((await response.json()) as { token: string }).token;
}

interface Harness {
  cwd: string;
  server: RunningUiServer;
  token: string;
}

/**
 * One initialised workspace, one server, one token — torn down whatever the
 * body does. Every test takes its own: the audit assertions count rows, and a
 * shared log would make each count depend on which tests ran before it.
 */
async function withServer(body: (h: Harness) => Promise<void>): Promise<void> {
  const cwd = project();
  const server = await startUiServer({ cwd, idleMs: 60_000 });
  try {
    await body({ cwd, server, token: await tokenFor(server) });
  } finally {
    await server.close();
    removeTree(cwd);
  }
}

const base = (h: Harness): string => `http://127.0.0.1:${h.server.port}`;

const getRaw = (h: Harness, target: string): Promise<Response> =>
  fetch(`${base(h)}${target}`, { headers: { [TOKEN_HEADER]: h.token } });

const postRaw = (h: Harness, body: unknown): Promise<Response> =>
  fetch(`${base(h)}/api/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', [TOKEN_HEADER]: h.token },
    body: JSON.stringify(body),
  });

interface ConfirmBody {
  id: string;
  argv: string[];
  boundary: boolean;
  nonce: string;
  residual: string;
}

interface RunBody {
  id: string;
  argv: string[];
  exitCode: number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  error?: string;
  auditNote?: string;
}

interface ErrorBody { error: string }

async function confirm(h: Harness, target: string): Promise<ConfirmBody> {
  const res = await getRaw(h, target);
  assert.equal(res.status, 200, `confirm ${target} answered ${res.status}`);
  return (await res.json()) as ConfirmBody;
}

async function post(h: Harness, body: unknown): Promise<RunBody> {
  const res = await postRaw(h, body);
  assert.equal(res.status, 200, `POST /api/execute answered ${res.status}`);
  return (await res.json()) as RunBody;
}

const workspace = (cwd: string): string => path.join(cwd, '.my_context');

/**
 * Both halves of the pair, in log order.
 *
 * Filtered by `kind` rather than by `op === 'execute'`, deliberately: a run is
 * TWO rows now, and a helper that matched only the first would let a test count
 * "one row per run" and be right for the wrong reason. Every caller that wants
 * one half asks for it by name below.
 */
const executionRows = (cwd: string): AuditRecord[] =>
  readAudit(workspace(cwd)).filter((r) => r.kind === 'execution');

/** The row written BEFORE the run. Always `exitCode: null` — nothing had exited. */
const startRow = (cwd: string): AuditRecord | undefined =>
  executionRows(cwd).find((r) => r.op === 'execute');

/** The row appended AFTER it, carrying how the run really ended. */
const doneRow = (cwd: string): AuditRecord | undefined =>
  executionRows(cwd).find((r) => r.op === 'execute-done');

/** A runner that runs nothing, records what it was handed, and answers `outcome`. */
function stubRunner(outcome: RunOutcome): {
  run: CommandRunner;
  calls: { file: string; args: string[]; cwd: string; timeout: number }[];
} {
  const calls: { file: string; args: string[]; cwd: string; timeout: number }[] = [];
  const run: CommandRunner = (file, args, options) => {
    calls.push({ file, args, cwd: options.cwd, timeout: options.timeout });
    return Promise.resolve(outcome);
  };
  return { run, calls };
}

/**
 * Rebind the endpoint to a store and a runner this test owns.
 *
 * The route table is process-global (see the header), so `registerExecuteRoutes`
 * registers once and REBINDS on every later call — which is exactly the seam a
 * test needs to substitute a runner without a real child process. It must be
 * called AFTER `startUiServer`, which binds the real one.
 */
function rebind(run: CommandRunner): ExecutionNonceStore {
  const nonces = new ExecutionNonceStore();
  registerExecuteRoutes(nonces, CLI_ENTRY, run);
  return nonces;
}

/* -------------------------------------------------------------------------- *
 * The confirm.
 * -------------------------------------------------------------------------- */

test('the confirm GET returns the resolved argv, the boundary and a nonce', async () => {
  await withServer(async (h) => {
    const body = await confirm(h, `/api/execute/confirm?id=pin&id_arg=${FIXTURE_ITEM}&yes=true`);
    assert.deepEqual(body.argv, ['pin', FIXTURE_ITEM, '--yes']);
    assert.equal(body.boundary, true);
    assert.match(body.nonce, /^[0-9a-f]{32}$/);
  });
});

/**
 * The four residual tests below MOVED from a single
 * `'the confirm carries the residual sentence VERBATIM — §6.3 spells it, not
 * this route'`, pinned to `EXECUTION_RESIDUAL` back when that was one string.
 * Task 8b made it one sentence per language (`Record<ExecutionLanguage,
 * string>`, both in `src/ui/execute.ts`), because the sentence has to reach a
 * Hebrew reader in Hebrew and duplicating it into `strings/he.js` would give a
 * security sentence two spellings that go stale independently. The single old
 * test could not survive that change AS ONE TEST — it pinned "the confirm
 * answers with THE sentence", and there is no longer one sentence, there is
 * one per language — so it splits into: the un-asked-for default (still
 * pinned verbatim, so English callers see no behavioural change), an explicit
 * `lang=he` (pinned verbatim in Hebrew, so the new path is not merely "some
 * text came back"), an unknown language degrading to English rather than
 * failing (the requirement that a security surface never degrades to NO
 * sentence), and the equality check that keeps the two spellings in lockstep
 * (`EXECUTION_RESIDUAL declares exactly the languages …` below). Nothing here
 * is loosened: every one of these is still a byte-for-byte match against the
 * server's own constant.
 */
test('the confirm with no lang carries the ENGLISH residual VERBATIM — §6.3 spells it, not this route', async () => {
  await withServer(async (h) => {
    const body = await confirm(h, '/api/execute/confirm?id=doctor');
    assert.equal(body.residual, EXECUTION_RESIDUAL.en);
    // Asserted as literal text as well as against the constant: a constant
    // compared only to itself would let the sentence be reworded silently, and
    // §6.3 is the one place in this design where the WORDS are the deliverable.
    assert.equal(
      body.residual,
      'This runs on your machine, now. The UI can tell it came from your browser — '
      + 'not that you asked. Only run what you recognise here.',
    );
    assert.equal(body.boundary, false, 'doctor is a read; spec §3.2 puts it below the line');
  });
});

test('?lang=he carries the HEBREW residual VERBATIM', async () => {
  await withServer(async (h) => {
    const body = await confirm(h, '/api/execute/confirm?id=doctor&lang=he');
    assert.equal(body.residual, EXECUTION_RESIDUAL.he);
    assert.equal(
      body.residual,
      'זה רץ על המחשב שלכם, עכשיו. הממשק יכול לדעת שהבקשה הגיעה מהדפדפן שלכם — '
      + 'לא שביקשתם את זה. הריצו רק את מה שאתם מזהים כאן.',
    );
  });
});

test('an unknown language answers with English rather than failing — a security surface degrades to a sentence, never to none', async () => {
  await withServer(async (h) => {
    const body = await confirm(h, '/api/execute/confirm?id=doctor&lang=fr');
    assert.equal(body.residual, EXECUTION_RESIDUAL.en);
  });
});

test('?lang is excluded from the resolved command\'s values — doctor takes no argument named lang', async () => {
  await withServer(async (h) => {
    // Before Task 8b's exclusion in valuesFromQuery, `lang` would have arrived
    // as an undeclared value for every command and refused the confirm for a
    // parameter that names no argument of the command at all — a regression
    // this test exists to catch by name.
    const body = await confirm(h, '/api/execute/confirm?id=doctor&lang=he');
    assert.deepEqual(body.argv, ['doctor']);
  });
});

test(
  'EXECUTION_RESIDUAL declares exactly the languages the UI ships strings for, '
  + 'and every one states the same three claims',
  () => {
    // What the UI ships strings for is read from the filesystem rather than
    // hard-coded here a second time: a THIRD language folder appearing under
    // `strings/` with no matching key in EXECUTION_RESIDUAL is precisely the
    // failure this test exists to catch, and hard-coding the expected set
    // would make the test agree with the bug instead of catching it.
    const stringsDir = path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public', 'strings');
    const shipped = readdirSync(stringsDir)
      .filter((name) => name.endsWith('.js'))
      .map((name) => name.slice(0, -'.js'.length))
      .sort();
    assert.deepEqual(
      Object.keys(EXECUTION_RESIDUAL).sort(),
      shipped,
      'a language the UI ships strings for but EXECUTION_RESIDUAL does not cover would silently '
      + 'degrade every reader of that language to English (by design — see residualFor — but that '
      + 'degrade is meant to be an unknown READER, not a known and unaudited GAP); a language '
      + 'EXECUTION_RESIDUAL declares but strings/ does not ship would be dead weight nothing can '
      + 'ever select. Either direction of drift fails here.',
    );

    // Equality between the two sentences cannot be BYTE equality — they are
    // translations of the same three claims, not two copies of the same
    // bytes, and demanding identical bytes would just be a longer way to
    // demand one language. What has to hold instead is the SHAPE: the
    // residual states three independent claims (it runs on this machine, now;
    // the gate proves origin and never intent; only run what you recognise),
    // one sentence each, and a translation that quietly drops or merges a
    // claim is the drift that matters — a reader in that language would be
    // handed a WEAKER warning with no way to notice. Counting sentence
    // boundaries catches exactly that drift without requiring any English or
    // Hebrew fluency this test.ts file cannot assert it has.
    const sentenceCount = (text: string): number => (text.match(/[.!?]+(?=\s|$)/gu) ?? []).length;
    for (const [lang, text] of Object.entries(EXECUTION_RESIDUAL)) {
      assert.equal(
        sentenceCount(text),
        3,
        `${lang}'s residual states ${sentenceCount(text)} sentence(s), not the three claims every `
        + 'other language states (runs now / proves origin, not intent / only run what you '
        + 'recognise) — edit it back to three, or edit every OTHER language to match on purpose',
      );
    }
  },
);

test('a confirm for an id the catalogue does not have is 400 and mints nothing', async () => {
  await withServer(async (h) => {
    const res = await getRaw(h, '/api/execute/confirm?id=rm');
    assert.equal(res.status, 400);
    assert.match(((await res.json()) as ErrorBody).error, /rm/);
  });
});

test('a query value repeated twice is refused rather than silently last-wins', async () => {
  await withServer(async (h) => {
    // INV-nothing-is-dropped-silently: two spellings of one argument is a
    // caller that disagrees with itself, and picking one is picking for them.
    const res = await getRaw(h, '/api/execute/confirm?id=show&id_arg=A&id_arg=B');
    assert.equal(res.status, 400);
  });
});

/* -------------------------------------------------------------------------- *
 * The run, and the order inside it.
 * -------------------------------------------------------------------------- */

test('POST with a good nonce runs, and answers with the exit code', async () => {
  await withServer(async (h) => {
    const shown = await confirm(h, '/api/execute/confirm?id=doctor');
    const body = await post(h, { id: 'doctor', values: {}, nonce: shown.nonce });
    assert.equal(body.exitCode, 0);
    assert.deepEqual(body.argv, ['doctor']);
    assert.ok(body.durationMs >= 0);
    assert.match(body.stdout, /doctor/);
  });
});

test('the string a person read and the argv that runs are the same thing', async () => {
  await withServer(async (h) => {
    // The whole feature is a lie if these two can differ. Both sides go through
    // `resolveCommand`; this asserts the POST composes nothing of its own.
    const stub = stubRunner({ exitCode: 0, stdout: '', stderr: '' });
    const nonces = rebind(stub.run);
    assert.ok(nonces instanceof ExecutionNonceStore);

    const shown = await confirm(h, `/api/execute/confirm?id=edit&id_arg=${FIXTURE_ITEM}&always=false&yes=true`);
    const body = await post(h, {
      id: 'edit', values: { id: FIXTURE_ITEM, always: 'false', yes: true }, nonce: shown.nonce,
    });
    assert.deepEqual(body.argv, shown.argv);
    assert.equal(stub.calls.length, 1);
    // `[cliEntry, ...argv]` — the program name comes from the server, never
    // from the catalogue and never from the client.
    assert.equal(stub.calls[0]!.file, process.execPath);
    assert.equal(stub.calls[0]!.args[0], CLI_ENTRY);
    assert.deepEqual(stub.calls[0]!.args.slice(1), shown.argv);
    // A joined switch stays joined all the way to the child process.
    assert.ok(shown.argv.includes('--always=false'));
  });
});

test('POST with NO nonce is 403 and nothing runs', async () => {
  await withServer(async (h) => {
    const stub = stubRunner({ exitCode: 0, stdout: '', stderr: '' });
    rebind(stub.run);
    // 403, not 400: a missing nonce is an unauthorised request, not a
    // malformed one, and the two answers send a reader to different places.
    const res = await postRaw(h, { id: 'doctor', values: {} });
    assert.equal(res.status, 403);
    // …while a nonce of the wrong TYPE is a shape error and stays a 400.
    assert.equal((await postRaw(h, { id: 'doctor', values: {}, nonce: 7 })).status, 400);
    assert.equal(stub.calls.length, 0);
    assert.equal(executionRows(h.cwd).length, 0, 'a refused run must leave no audit row');
  });
});

test('a nonce minted for another command does not authorise this one', async () => {
  await withServer(async (h) => {
    const stub = stubRunner({ exitCode: 0, stdout: '', stderr: '' });
    rebind(stub.run);
    const shown = await confirm(h, '/api/execute/confirm?id=doctor');
    const res = await postRaw(h, { id: 'rebuild', values: {}, nonce: shown.nonce });
    assert.equal(res.status, 403);
    assert.equal(stub.calls.length, 0);
  });
});

test('a nonce minted for one ARGV does not authorise a different one', async () => {
  await withServer(async (h) => {
    const stub = stubRunner({ exitCode: 0, stdout: '', stderr: '' });
    rebind(stub.run);
    // Same id, different argument: the binding is over the argv the SERVER
    // built, so `pin A` cannot spend a nonce minted for `pin B`.
    const shown = await confirm(h, `/api/execute/confirm?id=pin&id_arg=${FIXTURE_ITEM}&yes=true`);
    const res = await postRaw(h, {
      id: 'pin', values: { id: 'RULE-b', yes: true }, nonce: shown.nonce,
    });
    assert.equal(res.status, 403);
    assert.equal(stub.calls.length, 0);
  });
});

test('the same nonce cannot run twice', async () => {
  await withServer(async (h) => {
    const stub = stubRunner({ exitCode: 0, stdout: '', stderr: '' });
    rebind(stub.run);
    const shown = await confirm(h, '/api/execute/confirm?id=doctor');
    await post(h, { id: 'doctor', values: {}, nonce: shown.nonce });
    const res = await postRaw(h, { id: 'doctor', values: {}, nonce: shown.nonce });
    assert.equal(res.status, 403);
    assert.equal(stub.calls.length, 1, 'the second attempt reached the runner');
  });
});

test('an unknown id is 400, and it is 400 BEFORE the nonce is even looked at', async () => {
  await withServer(async (h) => {
    const stub = stubRunner({ exitCode: 0, stdout: '', stderr: '' });
    rebind(stub.run);
    // THE ORDER ASSERTION. `nonce: 'x'` was never minted, so a handler that
    // redeemed first would answer 403. 400 is the answer only if the id was
    // resolved first — which is the whole reason redeem comes after: the nonce
    // must be checked against the argv the server built, and there is no such
    // argv until `resolveCommand` has returned one.
    const res = await postRaw(h, { id: 'rm', values: {}, nonce: 'x' });
    assert.equal(res.status, 400, 'redeem appears to run before resolveCommand');
    assert.match(((await res.json()) as ErrorBody).error, /rm/);
    assert.equal(stub.calls.length, 0);
  });
});

test('a refusal from the catalogue is a 400 carrying its own reason', async () => {
  await withServer(async (h) => {
    for (const [body, pattern] of [
      [{ id: 'pin', values: {}, nonce: 'x' }, /required/],
      [{ id: 'doctor', values: { sneaky: 'x' }, nonce: 'x' }, /sneaky/],
      [{ id: 'pin', values: { id: 'a\nb' }, nonce: 'x' }, /display/],
    ] as const) {
      const res = await postRaw(h, body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.match(((await res.json()) as ErrorBody).error, pattern);
    }
  });
});

test('the client cannot send argv — a body carrying one is REFUSED, never ignored', async () => {
  await withServer(async (h) => {
    const stub = stubRunner({ exitCode: 0, stdout: '', stderr: '' });
    rebind(stub.run);
    const shown = await confirm(h, '/api/execute/confirm?id=doctor');
    const res = await postRaw(h, {
      id: 'doctor', values: {}, argv: ['rm', '-rf'], nonce: shown.nonce,
    });
    assert.equal(res.status, 400);
    // Named, so the answer teaches. A server that dropped it in silence is a
    // server somebody eventually relies on to apply it.
    assert.match(((await res.json()) as ErrorBody).error, /argv/);
    assert.equal(stub.calls.length, 0);
  });
});

test('any key that is not id, values or nonce is refused', async () => {
  await withServer(async (h) => {
    for (const body of [
      { id: 'doctor', values: {}, nonce: 'x', cwd: '/' },
      { id: 'doctor', values: {}, nonce: 'x', shell: true },
      ['doctor'],
      'doctor',
      null,
    ]) {
      const res = await postRaw(h, body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });
});

/* -------------------------------------------------------------------------- *
 * The audit row.
 * -------------------------------------------------------------------------- */

test('TWO audit rows per run — execute then execute-done, joined by at and command.id', async () => {
  await withServer(async (h) => {
    const shown = await confirm(h, '/api/execute/confirm?id=doctor');
    const body = await post(h, { id: 'doctor', values: {}, nonce: shown.nonce });

    const rows = executionRows(h.cwd);
    assert.equal(rows.length, 2, 'a run is an attempt and a completion, not one amended row');
    assert.deepEqual(rows.map((r) => r.op), ['execute', 'execute-done'],
      'the attempt is recorded before the completion, never after it');
    for (const row of rows) {
      assert.equal(row.kind, 'execution', 'an execution row is not a mutation');
      assert.deepEqual(row.command?.argv, ['doctor']);
      assert.equal(row.command?.id, 'doctor');
    }

    // The join. `at` plus `command.id`, equal across the pair — no run id was
    // invented for a question two existing fields already answer.
    assert.equal(rows[0]!.at, rows[1]!.at);
    assert.equal(rows[0]!.command?.id, rows[1]!.command?.id);

    // THE ROW THAT PROVES THE RECORD PRECEDED THE RUN. It cannot carry an exit
    // code: at the instant it was written, nothing had exited. Asserted
    // directly, and asserted as `null` rather than as falsy — `0` is the
    // reassuring wrong answer here and it is a positive claim of success.
    assert.equal(rows[0]!.command?.exitCode, null);
    assert.notEqual(rows[0]!.command?.exitCode, 0);
    assert.ok('exitCode' in (rows[0]!.command ?? {}),
      'null is RECORDED, not omitted — an absent key would mean "never written"');
    assert.equal(rows[0]!.command?.durationMs, 0, 'nothing had been measured yet');

    // …and the second carries what actually happened.
    assert.equal(rows[1]!.command?.exitCode, 0);
    assert.equal(rows[1]!.command?.durationMs, body.durationMs);
    assert.equal(body.auditNote, undefined);
  });
});

/**
 * THE REGRESSION TEST FOR THE DEFECT THIS PAIR REPLACED.
 *
 * `finaliseExecutionRow` used to give the row its exit code by reading the WHOLE
 * audit log, mutating one line in memory and writing the whole file back. The
 * log is append-only and unlocked — `core/jsonl-log.ts` · `appendJsonlLine` is a
 * bare `appendFileSync` — and every hook appends to it from its own process,
 * with `PreToolUse` firing on every file operation. A row appended between that
 * read and that write was destroyed: the rewrite truncated the file to content
 * that predates it.
 *
 * **The property asserted here is the one that makes the race unlosable rather
 * than merely unlikely: the log is only ever EXTENDED.** Whatever bytes were in
 * it at any instant are still a prefix of it afterwards. That is deterministic,
 * and it is strictly stronger than trying to win the race — a test that appended
 * concurrently and checked the row survived would pass against the OLD code too,
 * because the old read happened after the run and so swept the row up. What it
 * could not survive was an append landing in the few milliseconds between the
 * read and the write, which no single-process test can schedule: measured with a
 * second process appending across the rewrite, between 1 and 21 rows per run
 * were destroyed. A prefix assertion needs no scheduling at all.
 *
 * The injected runner is where a test gets to BE the other writer — it runs in
 * the window when the command is running, which is exactly where a hook fires.
 */
test('a concurrent append during the run SURVIVES — the log is only ever extended', async () => {
  await withServer(async (h) => {
    const root = workspace(h.cwd);
    const log = auditLogPath(root);
    let duringRun = '';

    const run: CommandRunner = () => {
      // Another writer, mid-run: an ordinary PreToolUse record, the busiest
      // appender this log has. Nothing about it belongs to this run.
      recordAudit(root, {
        kind: 'hook',
        op: 'post-tool-use',
        hook: 'PreToolUse',
        sessionId: 'another-writer',
        path: 'src/core/item.ts',
      });
      duringRun = readFileSync(log, 'utf8');
      return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
    };
    rebind(run);

    const shown = await confirm(h, '/api/execute/confirm?id=doctor');
    await post(h, { id: 'doctor', values: {}, nonce: shown.nonce });

    assert.notEqual(duringRun, '', 'the runner never observed the log');
    const after = readFileSync(log, 'utf8');
    assert.ok(
      after.startsWith(duringRun),
      'the audit log was REWRITTEN, not appended to: bytes that were on disk while the '
      + 'command was running are no longer a prefix of the file. Every row any other '
      + 'process appended in that window is destroyed by such a rewrite.',
    );

    // And the unrelated row itself, named rather than merely implied.
    const others = readAudit(root).filter((r) => r.sessionId === 'another-writer');
    assert.equal(others.length, 1, "another writer's audit row vanished during the run");
    assert.equal(others[0]!.op, 'post-tool-use');

    // The run's own pair is intact around it, and the foreign row sits BETWEEN
    // the two halves — which is the interleaving the pair has to tolerate.
    assert.deepEqual(executionRows(h.cwd).map((r) => r.op), ['execute', 'execute-done']);
    const ops = readAudit(root).map((r) => r.op);
    assert.ok(
      ops.indexOf('execute') < ops.indexOf('post-tool-use')
      && ops.indexOf('post-tool-use') < ops.indexOf('execute-done'),
      'the foreign row did not land inside the pair, so this proved nothing',
    );
  });
});

/**
 * The same property, enforced by construction and read back off the source —
 * the idiom this file already uses for "no shell, ever", and for the same
 * reason: a reintroduced rewrite behaves identically for every run a test
 * performs alone, and differently only when another process is writing.
 */
test('this module APPENDS to the audit log and never rewrites it', () => {
  const source = readFileSync(
    path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'execute.ts'), 'utf8',
  );
  for (const banned of ['writeFileSync', 'readFileSync', 'auditLogPath', 'appendFileSync']) {
    assert.equal(
      source.includes(`${banned}(`), false,
      `src/ui/execute.ts calls ${banned} — the audit log is append-only and unlocked, and a `
      + `read-modify-write of it destroys rows appended by other processes in the window. `
      + `The exit code goes in a second \`execute-done\` row.`,
    );
  }
  assert.ok(source.includes("op: 'execute-done'"), 'the completion row is how a run ends');
});

/**
 * A failure to write the SECOND row does not fail the run — the command has
 * already run, and reporting that as a failure would be a lie about something
 * that happened. It is DISCLOSED instead, and the disclosure matters more than
 * it used to: a lone `execute` row now MEANS "a run that never returned", so a
 * silently missing completion row would make the log state something false.
 */
test('a failed completion write still returns 200, discloses it, and leaves the execute row', async () => {
  await withServer(async (h) => {
    const root = workspace(h.cwd);
    const run: CommandRunner = () => {
      // Break the NEXT append without touching the row already on disk:
      // `ensureLogDir` rewrites `.audit/.gitignore` on every append, so a
      // DIRECTORY at that path fails the write while `audit.jsonl` — and the
      // `execute` row inside it — stays exactly as it was. A mode bit would not
      // do: win32 does not honour it, and this suite runs there.
      const gitignore = path.join(root, '.audit', '.gitignore');
      rmSync(gitignore, { force: true });
      mkdirSync(gitignore, { recursive: true });
      return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
    };
    rebind(run);

    const shown = await confirm(h, '/api/execute/confirm?id=doctor');
    const res = await postRaw(h, { id: 'doctor', values: {}, nonce: shown.nonce });
    assert.equal(res.status, 200, 'the command RAN; a 500 would deny something that happened');
    const body = (await res.json()) as RunBody;
    assert.equal(body.exitCode, 0, 'the page is still told how the run ended');
    assert.match(body.auditNote ?? '', /execute-done/,
      'a completion row that could not be written was not disclosed to the caller');

    // The first row still stands, unamended and readable.
    const start = startRow(h.cwd);
    assert.ok(start !== undefined, 'the execute row was lost with the completion row');
    assert.equal(start.command?.exitCode, null);
    assert.equal(doneRow(h.cwd), undefined);
  });
});

test('a run that CANNOT be recorded does not happen', async () => {
  await withServer(async (h) => {
    const stub = stubRunner({ exitCode: 0, stdout: '', stderr: '' });
    rebind(stub.run);
    const shown = await confirm(h, '/api/execute/confirm?id=rebuild');

    // `.audit` is created on the first append. A plain FILE at that path makes
    // the directory unmakeable, so `recordAudit` returns `written: false` — the
    // only cross-platform way to say "unwritable" (a mode bit is not honoured
    // on win32, and this suite runs there).
    const auditDirPath = path.join(h.cwd, '.my_context', '.audit');
    // `removeTree`, not a bare `rmSync`: it carries the retry budget Windows
    // needs when a handle is still closing, and `test/no-bare-rmsync.test.ts`
    // holds it as the one owner of tree removal in this suite.
    removeTree(auditDirPath);
    writeFileSync(auditDirPath, 'not a directory\n', 'utf8');

    const res = await postRaw(h, { id: 'rebuild', values: {}, nonce: shown.nonce });
    assert.equal(res.status, 500);
    assert.equal(stub.calls.length, 0,
      'the run happened even though its record could not be written — the audit write '
      + 'has moved after the execution');
    assert.match(((await res.json()) as ErrorBody).error, /audit/i);
  });
});

/* -------------------------------------------------------------------------- *
 * How a run ends.
 * -------------------------------------------------------------------------- */

test('a non-zero exit is REPORTED, not swallowed — a refusal is a state to leave', async () => {
  await withServer(async (h) => {
    // **A command OFF the boundary, and that is now the only way to reach this.**
    // This test used to run `supersede NOPE --by ALSO-NOPE`, chosen because it
    // was certain to fail. Since seq:5b the confirm DERIVES the effect of a
    // boundary command by running it against a copy, so a command certain to
    // fail is refused a confirm and never reaches the run at all — a real
    // narrowing, and the right one under §3.2.
    //
    // The property here is about the RUN, not about the confirm: a non-zero
    // exit must be reported rather than swallowed. `show` is `boundary: false`,
    // so it skips derivation entirely, and `show NOPE` exits 1. Measured.
    const target = '/api/execute/confirm?id=show&id_arg=NOPE';
    const shown = await confirm(h, target);
    const body = await post(h, {
      id: 'show',
      values: { id: 'NOPE' },
      nonce: shown.nonce,
    });
    assert.notEqual(body.exitCode, 0);
    assert.equal(typeof body.exitCode, 'number');
    assert.match(body.stderr, /./);
    // The COMPLETION row is where a real exit code lives; the `execute` row beside
    // it still reads null, because it was written before the process existed.
    assert.equal(doneRow(h.cwd)?.command?.exitCode, body.exitCode);
    assert.equal(startRow(h.cwd)?.command?.exitCode, null);
  });
});

test('the run is bounded, and the bound is the constant that carries its reasoning', async () => {
  assert.equal(RUN_TIMEOUT_MS, 60_000);
  await withServer(async (h) => {
    const stub = stubRunner({ exitCode: 0, stdout: '', stderr: '' });
    rebind(stub.run);
    const shown = await confirm(h, '/api/execute/confirm?id=doctor');
    await post(h, { id: 'doctor', values: {}, nonce: shown.nonce });
    assert.equal(stub.calls[0]!.timeout, RUN_TIMEOUT_MS,
      'the runner was handed no bound, so a wedged command wedges the tab');
    // The workspace, and nothing above it: spec §5 excludes anything outside it.
    assert.equal(stub.calls[0]!.cwd, h.cwd);
  });
});

test('a command that outlives the bound is recorded as KILLED — exitCode null, never 0', async () => {
  await withServer(async (h) => {
    // Through the injected seam rather than a real hanging process: what is
    // under test is how a killed run is RECORDED, and a 60s wait proves nothing
    // extra about that. The default runner's own mapping is measured below.
    const stub = stubRunner({
      exitCode: null, stdout: '', stderr: '', error: `timed out after ${RUN_TIMEOUT_MS} ms and was killed`,
    });
    rebind(stub.run);
    const shown = await confirm(h, '/api/execute/confirm?id=doctor');
    const body = await post(h, { id: 'doctor', values: {}, nonce: shown.nonce });

    assert.equal(body.exitCode, null);
    assert.match(body.error ?? '', /timed out/);
    const row = doneRow(h.cwd)!;
    assert.equal(row.command?.exitCode, null,
      '"we stopped watching" was recorded as "it succeeded"');
    // Written explicitly, not omitted: `JSON.stringify` drops `undefined`, and
    // an absent key is indistinguishable from a row that predates the field.
    assert.ok('exitCode' in (row.command ?? {}));
  });
});

test('the default runner really does kill on the timeout, and maps it to null', async () => {
  // The half the seam cannot prove: that `execFile`'s own timeout arrives as
  // `exitCode: null` rather than as a throw or as a zero. Cheap because the
  // bound under test is 50ms, not RUN_TIMEOUT_MS.
  const outcome = await execFileRunner(
    process.execPath,
    ['-e', 'setTimeout(() => {}, 30_000)'],
    { cwd: process.cwd(), timeout: 50 },
  );
  assert.equal(outcome.exitCode, null);
  assert.match(outcome.error ?? '', /timed out/);
});

/* -------------------------------------------------------------------------- *
 * Per-server, and no shell.
 * -------------------------------------------------------------------------- */

test('a nonce is only ever redeemable against the store that minted it', async () => {
  const cwd = project();
  const first = await startUiServer({ cwd, idleMs: 60_000 });
  try {
    const h: Harness = { cwd, server: first, token: await tokenFor(first) };
    const shown = await confirm(h, '/api/execute/confirm?id=doctor');

    // A second server in the same process, with its own store. The store is
    // created in `startUiServer` and closed over — it is not module-global —
    // so the nonce the first server minted is in a store nothing consults now.
    const second = await startUiServer({ cwd, idleMs: 60_000 });
    try {
      const res = await postRaw(h, { id: 'doctor', values: {}, nonce: shown.nonce });
      assert.equal(res.status, 403,
        'one server authorised a run from another server`s nonce store');
      assert.equal(executionRows(cwd).length, 0);
    } finally { await second.close(); }
  } finally { await first.close(); removeTree(cwd); }
});

test('no shell, ever — enforced by construction and read back off the source', async () => {
  // Global constraint, and the one that cannot be tested from the wire: a
  // `shell: true` would behave identically for every command in the catalogue
  // and differently for the one that mattered. So the source is read.
  const source = readFileSync(
    path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'execute.ts'), 'utf8',
  );
  for (const banned of ['shell:', 'spawn(', 'execSync', 'exec(']) {
    assert.equal(source.includes(banned), false, `src/ui/execute.ts mentions ${banned}`);
  }
  assert.ok(source.includes('execFile'), 'execFile is how the boundary is enforced');
});
