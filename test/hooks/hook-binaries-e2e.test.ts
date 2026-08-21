/**
 * The six hook binaries, run as real OS processes over real stdio.
 *
 * Every other test in `test/hooks/` imports a function and calls it. That
 * leaves the part Claude Code actually uses — `node <file>` with a JSON payload
 * on stdin, an exit code, and whatever landed on stdout — with no test that
 * could fail if the entry guard, the stdin read or the write to stdout were
 * removed. `test/mcp/server-e2e.test.ts` is the model: it exists because a unit
 * test and the real surface disagreed once, which is the same risk here.
 *
 * **Two contracts per hook.** Garbage on stdin must exit 0 and say nothing —
 * `INV-hooks-fail-open`, and the reason the hooks parse defensively. A real
 * payload must produce the envelope Claude Code reads.
 *
 * **`post-tool-use-failure`'s envelope is empty stdout, and that IS the
 * contract** (plan Task 7). It injects nothing, so a byte on stdout would be a
 * byte the model was handed by a hook that has nothing to say to it; what a
 * real payload produces instead is one row in the audit log, and the test below
 * reads that row back off disk rather than settling for the silence.
 *
 * **The stdin-held-open case covers TWO of the six, and it was one until Task
 * 10.** `post-tool-use.ts` and `subagent-start.ts` are the binaries that read
 * stdin asynchronously, and each sets its own unref'd 2s timer that preempts a
 * pipe the caller never closes. The other four read stdin with a synchronous
 * `readFileSync(0)`, which blocks the thread outright — no timer can fire, and
 * a test that opened their stdin and never closed it would hang the suite
 * rather than fail it. That asymmetry is a real property of these binaries, so
 * it is asserted where it holds and not elsewhere. It is also why
 * `post-tool-use-failure` reads synchronously despite sharing this event
 * family: nothing waits on its output, so a stalled read costs the process and
 * nothing else, and `hooks.json`'s 5s kill is the bound.
 *
 * **On `subagent-start` that held-open case is the ONLY bound it has**, which
 * is why extending it here was not optional. The timer bounds a pipe that
 * never closes and nothing else: once the payload is in hand the selection is
 * synchronous, no timer can preempt it, and the only thing that can end the
 * process is Claude Code killing it at the `timeout` in `hooks.json`. What
 * that kill leaves behind is the last test in this file.
 *
 * **Task 5 moved the async reader into `io.ts` and did NOT move the asymmetry
 * with it.** `readStdinAsync` is now one shared implementation, and the timer
 * that makes it survivable stayed in its callers — `post-tool-use.ts`, and
 * `subagent-start.ts` after Task 10 — because the timer is the caller's
 * decision: a hook whose output the model waits on needs one, a hook that only
 * writes a file does not. The reader is therefore exercised
 * directly here as well — over a real pipe, in a real process — including the
 * case that proves it bounds nothing by itself. It is never called in-process:
 * a `node --test` file that awaits it does not finish, because the pending
 * 'data'/'end' listeners are themselves a ref on the event loop and the
 * runner's stdin does not end.
 *
 * Bounds here are generous on purpose. A cold `node` start that has to
 * type-strip the whole injection import graph is not a fast operation on a
 * loaded machine, and a bound tight enough to be interesting is a bound that
 * turns a slow machine into a red suite — see `test/helpers/stdio.ts` for the
 * same failure this project has already paid for once.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { readAudit } from '../../src/core/audit.ts';
import { removeTree } from '../helpers/tmp.ts';

const HOOK = (name: string): string =>
  fileURLToPath(new URL(`../../src/hooks/${name}.ts`, import.meta.url));

/** Cold start plus the whole injection graph, with room to spare on a loaded box. */
const EXIT_BUDGET_MS = 60_000;

interface Run {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  elapsedMs: number;
}

/**
 * Runs a hook binary to completion.
 *
 * `holdStdin` writes the payload and then leaves the pipe OPEN — the shape a
 * hook sees when the caller has not closed its end. Only pass it for the two
 * async readers, `post-tool-use` and `subagent-start`; on the other four it
 * hangs the suite instead of failing it. See the note at the top of this file.
 */
function runHook(
  file: string, payload: string, cwd: string, options: { holdStdin?: boolean } = {},
): Promise<Run> {
  return runNode([file], payload, cwd, options);
}

/**
 * The same spawn, with the argv left open so `io.ts` itself can be driven over
 * real stdio — see `INLINE` below. Nothing else differs: same encoding, same
 * harness budget, same "write the payload, then close unless told not to".
 */
function runNode(
  args: string[], payload: string, cwd: string, options: { holdStdin?: boolean } = {},
): Promise<Run> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', ...args], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c: string) => { stdout += c; });
    child.stderr.on('data', (c: string) => { stderr += c; });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(
        `${path.basename(args[args.length - 1])} did not exit within ${EXIT_BUDGET_MS}ms. ` +
        `stdout so far: ${JSON.stringify(stdout)}; stderr: ${JSON.stringify(stderr)}`,
      ));
    }, EXIT_BUDGET_MS);

    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, elapsedMs: Date.now() - started });
    });

    child.stdin.write(payload);
    if (!options.holdStdin) child.stdin.end();
  });
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-hookbin-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

// ---------------------------------------------------------------------------
// The manifest that makes Claude Code run any of this.
//
// Everything below spawns a binary by path. In production nothing does: Claude
// Code reads `hooks/hooks.json` and runs the command string it finds there, so
// a binary that works perfectly and is registered wrongly is a binary that
// never runs. Two properties are asserted because both have already gone
// wrong in this project's documents.
// ---------------------------------------------------------------------------

interface HooksManifest {
  hooks: Record<string, { matcher?: string; hooks: { command: string; timeout?: number }[] }[]>;
}

const MANIFEST = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '../../hooks/hooks.json'), 'utf8'),
) as HooksManifest;

const COMMANDS = Object.entries(MANIFEST.hooks).flatMap(([event, entries]) =>
  entries.flatMap((entry) => entry.hooks.map((hook) => ({ event, ...hook, ...entry }))));

/**
 * **Every command carries `--disable-warning=ExperimentalWarning`.**
 *
 * Not style: a bare `node "<path>"` writes `ExperimentalWarning: SQLite is an
 * experimental feature` onto stderr before a line of hook code runs, on every
 * invocation of that hook. The plan's §0 records exactly how that gets into
 * the tree — a new block copied from a *document quoting* `hooks.json` rather
 * than from `hooks.json` — so the guard is over ALL entries, not the one this
 * task added.
 */
test('every registered hook command disables the experimental warning', () => {
  assert.ok(COMMANDS.length >= 6, `only ${COMMANDS.length} hook command(s) registered`);
  for (const command of COMMANDS) {
    assert.match(
      command.command, /--disable-warning=ExperimentalWarning/,
      `${command.event} would write an ExperimentalWarning on every invocation`,
    );
    // A command naming a file that is not there is a hook that silently never
    // runs — the same failure as not registering it, with a manifest that
    // claims otherwise.
    const file = command.command.replace(/^.*\$\{CLAUDE_PLUGIN_ROOT\}\/([^"]+)".*$/s, '$1');
    assert.ok(
      existsSync(path.join(import.meta.dirname, '../..', file)),
      `${command.event} points at ${file}, which does not exist`,
    );
  }
});

/**
 * **`PostToolUseFailure` is registered, and registered UNMATCHED** (plan Task
 * 7). `PostToolUse` carries `Write|Edit|MultiEdit` because `watchedDocs` is
 * about documents; a degradation counter is tool-agnostic, and a matcher here
 * would silently count only some of the failures while the log read as though
 * it held them all. `PreCompact` is the precedent for an unmatched event.
 */
test('PostToolUseFailure is registered for every tool, with the 5s bound', () => {
  const entries = MANIFEST.hooks.PostToolUseFailure;
  assert.ok(entries, 'the hook binary exists but nothing runs it');
  assert.equal(entries.length, 1);
  assert.equal(
    Object.hasOwn(entries[0], 'matcher'), false,
    'a matcher would make the degradation counter tool-specific',
  );
  assert.equal(entries[0].hooks.length, 1);
  assert.match(entries[0].hooks[0].command, /src\/hooks\/post-tool-use-failure\.ts/);
  // The only bound on a hook that reads stdin synchronously is Claude Code
  // killing it: `readFileSync(0)` blocks the thread and no in-process timer
  // can preempt it. 5s, matching PostToolUse.
  assert.equal(entries[0].hooks[0].timeout, 5);
});

/**
 * **`SubagentStart` is registered UNMATCHED, at 5 seconds** (plan Task 11).
 *
 * Unmatched because the event names no tool to match on — `PreCompact` is the
 * precedent — and 5 because that is the whole bound this hook has. Nothing
 * in-process can cut it short: the stdin timer bounds a pipe that never
 * closes, and `buildInjection` is synchronous once it starts, so the number in
 * this manifest is the only thing standing between a slow selection and a
 * subagent dispatch that never begins. The timeout and the write-first
 * ordering the binary uses are ONE decision (spec §6n.3): registering at 5
 * means a killed hook is possible, and the ordering is what makes the kill
 * leave evidence instead of nothing. The last test in this file executes that
 * pair; this one pins the number it depends on.
 *
 * The measured cost of the work being bounded is
 * `test/perf/subagent-start-latency.perf.ts` · `const CEILING_MS = perfCeiling(500);` · ~122,
 * which is the in-process selection only — a cold `node` start is inside this
 * 5s and outside that measurement.
 */
test('SubagentStart is registered for every dispatch, with the 5s bound', () => {
  const entries = MANIFEST.hooks.SubagentStart;
  assert.ok(entries, 'the hook binary exists but nothing runs it');
  assert.equal(entries.length, 1);
  assert.equal(
    Object.hasOwn(entries[0], 'matcher'), false,
    'a matcher would silently exclude some dispatches from the only knowledge they get',
  );
  assert.equal(entries[0].hooks.length, 1);
  assert.match(entries[0].hooks[0].command, /src\/hooks\/subagent-start\.ts/);
  assert.equal(entries[0].hooks[0].timeout, 5);
});

function pinned(cwd: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-pool.md');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: CONST-pool
type: constraint
title: Pool capped at 20
status: active
severity: hard
always: true
---

# Pool capped at 20

The connection pool is capped at 20.
`, 'utf8');
}

// The NUL is written as an ESCAPE, never as a raw byte. A literal NUL in
// the source makes git treat this whole file as binary — no diff, no
// review, and a merge conflict here would be unresolvable. The string the
// test sends is byte-identical either way.
const GARBAGE = 'not json at all {{{ \u0000 ]]';

// ---------------------------------------------------------------------------
// Fail-open: garbage in, exit 0, nothing blocked — but NOT silent.
//
// The five hooks below share `parseHookInput`, and a payload it cannot read
// costs `source` and `session_id`. On `subagent-start` it costs the whole
// delivery and the record of it too — the attempt record needs the `agent_id`
// that was in the payload nobody could read — so that binary writes a second
// line naming its own loss. Asserted in `test/hooks/subagent-start.test.ts`;
// what is asserted here is the shared line, over every hook that shares it.
// That loss used to be invisible:
// SessionStart falls back to `process.cwd()`, so the workspace resolves and
// the pinned tier injects as if nothing were wrong, while a compaction
// silently restores nothing, the JIT tier silently delivers nothing, and
// PreCompact silently writes no snapshot. The assertion that used to stand
// here — "and must not report the parse failure to the user" — was that
// defect written down as a contract, and it cost a full diagnostic pass that
// wrongly concluded the selection logic was broken.
//
// What is unchanged is INV-hooks-fail-open: exit 0, no signal, no blocked
// tool call. This adds disclosure, not enforcement.
// ---------------------------------------------------------------------------

for (const name of [
  'session-start', 'pre-tool-use', 'pre-compact', 'post-tool-use-failure', 'subagent-start',
]) {
  test(`${name} exits 0 and discloses the parse failure when stdin is garbage`, async () => {
    const cwd = project();
    try {
      const result = await runHook(HOOK(name), GARBAGE, cwd);
      assert.equal(result.code, 0, `stderr: ${result.stderr}`);
      assert.equal(result.signal, null);
      // Matched by CONTENT, never by equality, and deliberately so. A stock
      // Node 24 already writes an ExperimentalWarning for `node:sqlite` onto
      // this stream before any hook code runs — a separate, recorded defect
      // whose fix is `--disable-warning=ExperimentalWarning` on the hook
      // entry points, not a widened assertion here. Asserting what the HOOK
      // said, and nothing about what else is on the stream, is what lets this
      // test be true both before and after that fix lands.
      assert.match(
        result.stderr, /my_context: hook payload unreadable/,
        `${name} disclosed nothing about the unreadable payload`,
      );
      assert.match(result.stderr, /session_id/);
    } finally { removeTree(cwd); }
  });
}

/**
 * SessionStart discloses on the second channel too — the injected block is
 * the one hook output the model actually reads, and it is exactly where a
 * complete-looking injection that has quietly lost its session needs to say
 * so.
 */
test('session-start puts the parse failure in the injected block as well', async () => {
  const cwd = project();
  try {
    pinned(cwd);
    const result = await runHook(HOOK('session-start'), GARBAGE, cwd);
    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    // The injection still happened — the cwd fallback found the workspace.
    assert.match(result.stdout, /CONST-pool/);
    // And the block says why it has no source and no session.
    assert.match(result.stdout, /the SessionStart hook payload could not be read/);
    assert.match(result.stdout, /compaction restore cannot fire/);
  } finally { removeTree(cwd); }
});

/**
 * PreToolUse, PreCompact, PostToolUseFailure and SubagentStart have no channel
 * to the model on this path — a payload with no `file_path` gives PreToolUse
 * nothing to attach context to, two of the others talk to the filesystem and
 * never to the model, and SubagentStart's channel is an envelope it cannot
 * build: an unreadable payload names no `agent_id`, and without one this hook
 * injects nothing at all rather than write the parent's dedupe key. stderr is
 * their whole disclosure, and stdout stays exactly as empty as it always was.
 */
for (const name of ['pre-tool-use', 'pre-compact', 'post-tool-use-failure', 'subagent-start']) {
  test(`${name} still writes nothing to stdout when stdin is garbage`, async () => {
    const cwd = project();
    try {
      const result = await runHook(HOOK(name), GARBAGE, cwd);
      assert.equal(result.stdout, '', 'a hook with no opinion must write nothing at all');
    } finally { removeTree(cwd); }
  });
}

/**
 * The shared parse-failure line names what an unreadable payload costs the
 * OTHER hooks — the compaction restore, the JIT tier, the snapshot — because
 * those are the features a user later finds missing. None of them is what was
 * lost here, and this hook has no injected block to put a second note in. So it
 * adds one line naming its own loss, and the assertion is that the loss is
 * REAL: no row was written, and the count built from the log is low by one.
 */
test('post-tool-use-failure names the row it could not write, and writes none', async () => {
  const cwd = project();
  try {
    const result = await runHook(HOOK('post-tool-use-failure'), GARBAGE, cwd);
    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    assert.match(result.stderr, /this failed tool call was NOT recorded/);
    assert.match(result.stderr, /mycontext audit --op post-tool-use-failure/);
    assert.equal(
      existsSync(path.join(cwd, '.my_context', '.audit', 'audit.jsonl')), false,
      'a payload nobody could read still produced a row — an invented event',
    );
  } finally { removeTree(cwd); }
});

/**
 * PostToolUse keeps the original contract, assertions included: it does not
 * use `parseHookInput` at all (its own async `readStdin` plus a local
 * `JSON.parse`), and an unreadable payload costs it nothing that hides — no
 * session key, no dedupe, no restore, only a nudge it would not have emitted
 * anyway.
 */
test('post-tool-use exits 0 and says nothing when stdin is garbage', async () => {
  const cwd = project();
  try {
    const result = await runHook(HOOK('post-tool-use'), GARBAGE, cwd);
    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    assert.equal(result.signal, null);
    assert.equal(result.stdout, '', 'a hook with no opinion must write nothing at all');
    assert.equal(result.stderr, '', 'and must not report the parse failure to the user');
  } finally { removeTree(cwd); }
});

/**
 * THE REGRESSION GUARD, at the binary level, and deliberately UNCHANGED.
 *
 * `readStdin` returns '' for an interactive run with no stdin at all, and its
 * doc comment says so. Empty is not malformed and nothing was lost, so all
 * six hooks must stay completely silent on every channel — a disclosure that
 * fired here would print a warning on every interactive run, a worse defect
 * than the silence it was added to fix. `subagent-start` is the one with the
 * sharpest version of that trap: it discloses a payload that names no
 * `agent_id`, and an empty payload names none either, so the guard it carries
 * is "a payload that actually arrived" rather than "an agent is missing".
 *
 * The `stderr === ''` assertion below is left exactly as it was on purpose.
 * It currently fails for three of the four hooks, for the unrelated
 * ExperimentalWarning noted above; that is a pre-existing failure with its
 * own fix, and loosening this assertion to go green would discard the only
 * thing watching this channel.
 */
for (const name of [
  'session-start', 'pre-tool-use', 'pre-compact', 'post-tool-use', 'post-tool-use-failure',
  'subagent-start',
]) {
  test(`${name} exits 0 and says nothing when stdin is empty`, async () => {
    const cwd = project();
    try {
      const result = await runHook(HOOK(name), '', cwd);
      assert.equal(result.code, 0, `stderr: ${result.stderr}`);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, '');
    } finally { removeTree(cwd); }
  });
}

// ---------------------------------------------------------------------------
// A real payload through each one.
// ---------------------------------------------------------------------------

test('session-start writes the injected context on stdout for a real payload', async () => {
  const cwd = project();
  try {
    pinned(cwd);
    const result = await runHook(HOOK('session-start'), JSON.stringify({
      hook_event_name: 'SessionStart', source: 'startup', session_id: 'sess-e2e-1', cwd,
    }), cwd);

    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    assert.equal(result.stderr, '');
    // SessionStart's contract is plain text on stdout, not a JSON envelope —
    // Claude Code appends it verbatim.
    assert.match(result.stdout, /CONST-pool/);
    assert.match(result.stdout, /Pool capped at 20/);
  } finally { removeTree(cwd); }
});

/**
 * SubagentStart's envelope, which is a JSON one where SessionStart's is plain
 * text — the same knowledge, delivered through a different door, and the
 * asymmetry is Claude Code's rather than this project's. What the block
 * CONTAINS on this event, frame included, is
 * `test/hooks/subagent-start.test.ts`'s subject and is not repeated here; this
 * asserts the door.
 */
test('subagent-start writes the SubagentStart envelope on stdout for a real payload', async () => {
  const cwd = project();
  try {
    pinned(cwd);
    const result = await runHook(HOOK('subagent-start'), JSON.stringify({
      hook_event_name: 'SubagentStart', session_id: 'sess-e2e-6', agent_id: 'agent-e2e-6', cwd,
    }), cwd);

    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    assert.equal(result.stderr, '');
    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    assert.equal(parsed.hookSpecificOutput.hookEventName, 'SubagentStart');
    assert.match(parsed.hookSpecificOutput.additionalContext, /CONST-pool/);
    assert.match(parsed.hookSpecificOutput.additionalContext, /Pool capped at 20/);
  } finally { removeTree(cwd); }
});

test('pre-tool-use emits the deny envelope for a write into the managed directory', async () => {
  const cwd = project();
  try {
    const result = await runHook(HOOK('pre-tool-use'), JSON.stringify({
      hook_event_name: 'PreToolUse',
      session_id: 'sess-e2e-2',
      cwd,
      tool_name: 'Write',
      tool_input: { file_path: path.join(cwd, '.my_context', 'items', 'rule', 'RULE-x.md') },
    }), cwd);

    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    assert.equal(result.stderr, '');
    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput: { hookEventName: string; permissionDecision: string; permissionDecisionReason: string };
    };
    assert.equal(parsed.hookSpecificOutput.hookEventName, 'PreToolUse');
    assert.equal(parsed.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(parsed.hookSpecificOutput.permissionDecisionReason, /create_item/);
  } finally { removeTree(cwd); }
});

test('pre-tool-use says nothing about a file it has no opinion on', async () => {
  const cwd = project();
  try {
    const result = await runHook(HOOK('pre-tool-use'), JSON.stringify({
      hook_event_name: 'PreToolUse',
      session_id: 'sess-e2e-3',
      cwd,
      tool_name: 'Read',
      tool_input: { file_path: path.join(cwd, 'src', 'nothing.ts') },
    }), cwd);
    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    assert.equal(result.stdout, '');
  } finally { removeTree(cwd); }
});

test('pre-compact writes a restore snapshot and keeps stdout clean', async () => {
  const cwd = project();
  try {
    const result = await runHook(HOOK('pre-compact'), JSON.stringify({
      hook_event_name: 'PreCompact', session_id: 'sess-e2e-4', cwd,
    }), cwd);

    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    assert.equal(result.stdout, '', 'PreCompact talks to the filesystem, not to the model');
    assert.equal(result.stderr, '');

    const stateDir = path.join(cwd, '.my_context', 'state');
    assert.ok(existsSync(stateDir), 'the snapshot directory must exist after the hook ran');
    const written = readdirSync(stateDir, { recursive: true, encoding: 'utf8' })
      .filter((entry) => entry.includes('sess-e2e-4'));
    assert.ok(written.length > 0, `no snapshot naming the session: ${readdirSync(stateDir).join(', ')}`);
  } finally { removeTree(cwd); }
});

test('post-tool-use emits the nudge envelope for a watched document', async () => {
  const cwd = project();
  try {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify({ profile: 'standard', watchedDocs: ['docs/prd/**'] }, null, 2) + '\n',
      'utf8',
    );
    const result = await runHook(HOOK('post-tool-use'), JSON.stringify({
      hook_event_name: 'PostToolUse',
      cwd,
      tool_name: 'Write',
      tool_input: { file_path: path.join(cwd, 'docs', 'prd', 'auth.md') },
    }), cwd);

    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    assert.equal(result.stderr, '');
    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    assert.equal(parsed.hookSpecificOutput.hookEventName, 'PostToolUse');
    assert.match(parsed.hookSpecificOutput.additionalContext, /docs\/prd\/auth\.md/);
    assert.match(parsed.hookSpecificOutput.additionalContext, /create_item/);
  } finally { removeTree(cwd); }
});

/**
 * The one binary whose product is a file rather than a stream. Empty stdout is
 * asserted as the envelope, and then the row is read back off disk through the
 * same reader `mycontext audit` uses — because "the hook said nothing" is also
 * what a hook that did nothing looks like, and only one of those is the
 * contract.
 */
test('post-tool-use-failure records the failure and writes nothing to stdout', async () => {
  const cwd = project();
  try {
    const result = await runHook(HOOK('post-tool-use-failure'), JSON.stringify({
      hook_event_name: 'PostToolUseFailure',
      session_id: 'sess-e2e-5',
      cwd,
      tool_name: 'Write',
      tool_input: { file_path: path.join(cwd, 'src', 'thing.ts'), content: 'SECRET-BODY-TEXT' },
      error: 'EACCES: permission denied',
    }), cwd);

    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    assert.equal(result.stdout, '', 'this hook has nothing to say to the model');
    assert.equal(result.stderr, '');

    const records = readAudit(path.join(cwd, '.my_context'));
    assert.equal(records.length, 1, 'exactly one row per failed tool call');
    assert.equal(records[0].op, 'post-tool-use-failure');
    assert.equal(records[0].hook, 'PostToolUseFailure');
    assert.equal(records[0].sessionId, 'sess-e2e-5');
    assert.equal(records[0].note, 'Write failed: EACCES: permission denied');
    assert.equal(
      JSON.stringify(records[0]).includes('SECRET-BODY-TEXT'), false,
      'the tool input reached the audit log',
    );
  } finally { removeTree(cwd); }
});

test('post-tool-use stays quiet about a document nobody asked to watch', async () => {
  const cwd = project();
  try {
    const result = await runHook(HOOK('post-tool-use'), JSON.stringify({
      hook_event_name: 'PostToolUse',
      cwd,
      tool_name: 'Write',
      tool_input: { file_path: path.join(cwd, 'src', 'thing.ts') },
    }), cwd);
    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    assert.equal(result.stdout, '');
  } finally { removeTree(cwd); }
});

// ---------------------------------------------------------------------------
// The stdin-held-open case. The two ASYNC readers only — see the note at the
// top. It was PostToolUse alone until Task 10 gave `subagent-start` the same
// reader and the same unref'd 2s timer.
// ---------------------------------------------------------------------------

/**
 * The two hooks whose caller can leave the pipe open without wedging them.
 * Each sets its own unref'd 2s timer; the assertion is that the process ends
 * by itself, not that it ends at any particular moment — `elapsedMs` is
 * checked only against a bound wide enough that a cold start on a loaded
 * machine cannot reach it, because the alternative is a clock assertion that
 * reddens the suite for reasons that have nothing to do with these hooks.
 *
 * **On `subagent-start` this is the only bound the binary has at all**, and it
 * bounds exactly this one failure. A pipe that never closes would otherwise
 * hold open a process that Claude Code is waiting on before it will let the
 * subagent take its first turn — the timer is what turns that into a dispatch
 * that proceeds with no knowledge instead of a dispatch that never starts.
 * Nothing in either binary bounds the work that follows the read.
 */
const HELD_OPEN: { name: string; payload: (cwd: string) => string }[] = [
  {
    name: 'post-tool-use',
    payload: (cwd) => JSON.stringify({
      hook_event_name: 'PostToolUse',
      cwd,
      tool_name: 'Write',
      tool_input: { file_path: path.join(cwd, 'src', 'thing.ts') },
    }),
  },
  {
    name: 'subagent-start',
    payload: (cwd) => JSON.stringify({
      hook_event_name: 'SubagentStart', session_id: 'sess-e2e-held', agent_id: 'agent-held', cwd,
    }),
  },
];

for (const hook of HELD_OPEN) {
  test(`${hook.name} exits on its own when stdin is never closed`, async () => {
    const cwd = project();
    try {
      const result = await runHook(HOOK(hook.name), hook.payload(cwd), cwd, { holdStdin: true });

      assert.equal(result.code, 0, `stderr: ${result.stderr}`);
      assert.equal(
        result.signal, null, 'it exited by itself rather than being killed by the harness',
      );
      // The read never resolved, so nothing downstream of it ran: no envelope,
      // and — on `subagent-start` — no attempt record either, because the
      // payload that names the agent never arrived.
      assert.equal(result.stdout, '');
      assert.ok(
        result.elapsedMs < EXIT_BUDGET_MS,
        `held-open stdin took ${result.elapsedMs}ms, which is the harness budget, not the hook's`,
      );
    } finally { removeTree(cwd); }
  });

  test(`${hook.name} exits on its own when stdin is held open and empty`, async () => {
    const cwd = project();
    try {
      const result = await runHook(HOOK(hook.name), '', cwd, { holdStdin: true });
      assert.equal(result.code, 0, `stderr: ${result.stderr}`);
      assert.equal(result.signal, null);
      assert.equal(result.stdout, '');
    } finally { removeTree(cwd); }
  });
}

// ---------------------------------------------------------------------------
// `readStdinAsync`, over real stdio (plan Task 5).
//
// The reader `post-tool-use.ts` used to own privately now lives in `io.ts`,
// because Task 10's `SubagentStart` needs the same one. Two copies of a reader
// is how the first one got written; two copies of a reader whose failure mode
// is "the process never ends" is how one of them ships without a timer.
//
// It is driven here rather than imported, for the reason the header gives: a
// `node --test` file that awaits it never finishes. `--input-type=module -e`
// with an absolute `file://` import is the smallest thing that puts the real
// function on the far end of a real pipe.
// ---------------------------------------------------------------------------

const IO_URL = new URL('../../src/hooks/io.ts', import.meta.url).href;

/** An inline module that reads stdin through `io.ts` and prints what it got. */
const INLINE_ECHO =
  `import { readStdinAsync } from ${JSON.stringify(IO_URL)};\n` +
  `process.stdout.write(JSON.stringify(await readStdinAsync()));\n`;

test('readStdinAsync resolves to exactly the bytes on stdin', async () => {
  const cwd = project();
  try {
    const payload = '{"hook_event_name":"PostToolUse","tool_name":"Write"}';
    const result = await runNode(['--input-type=module', '-e', INLINE_ECHO], payload, cwd);
    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    assert.equal(JSON.parse(result.stdout), payload);
  } finally { removeTree(cwd); }
});

/**
 * '' for a closed-and-empty pipe, which is the same answer `readStdin` gives
 * and the reason `parseHookInput` treats '' as "an interactive run" rather
 * than as a failure. A reader that resolved to anything else here would make
 * every hook's empty-stdin path report a malformed payload.
 */
test('readStdinAsync resolves to the empty string when stdin closes with nothing', async () => {
  const cwd = project();
  try {
    const result = await runNode(['--input-type=module', '-e', INLINE_ECHO], '', cwd);
    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    assert.equal(JSON.parse(result.stdout), '');
  } finally { removeTree(cwd); }
});

/**
 * **The reader bounds nothing by itself, and this is the test that says so.**
 *
 * `readStdinAsync`'s doc comment tells a caller to set its own unref'd timer
 * before awaiting, and `post-tool-use.ts` is the only caller that does. That
 * instruction is worth nothing unless the hazard it describes is real, so the
 * hazard is executed: a process that awaits the reader with the pipe held open
 * is still sitting there afterwards, having resolved nothing, and only the
 * harness's SIGKILL ends it.
 *
 * Sequenced on the child's own output rather than on a clock — it announces
 * that the read is under way, and only then does the hold window start — so a
 * cold `node` start on a loaded machine cannot make this pass by arriving late
 * at the point it is supposed to be stuck at.
 */
test('readStdinAsync does not bound itself: a pipe that never closes never resolves', async () => {
  const cwd = project();
  const script =
    `import { readStdinAsync } from ${JSON.stringify(IO_URL)};\n` +
    `process.stdout.write('STARTED');\n` +
    `void readStdinAsync().then(() => process.stdout.write('RESOLVED'));\n`;
  const child = spawn(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', '--input-type=module', '-e', script],
    { cwd, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (c: string) => { stdout += c; });
  child.stderr.on('data', (c: string) => { stderr += c; });
  const closed = new Promise<void>((resolve) => { child.on('close', () => { resolve(); }); });
  try {
    // Written, and the pipe deliberately LEFT OPEN.
    child.stdin.write('{"hook_event_name":"PostToolUse"}');

    const startedBy = Date.now() + EXIT_BUDGET_MS;
    while (!stdout.includes('STARTED')) {
      assert.ok(Date.now() < startedBy, `the inline reader never started. stderr: ${stderr}`);
      await new Promise((r) => { setTimeout(r, 25); });
    }
    await new Promise((r) => { setTimeout(r, 1000); });

    assert.equal(stdout, 'STARTED', 'the reader resolved while the pipe was still open');
    assert.equal(child.exitCode, null, 'the process ended on its own, so nothing was held open');
  } finally {
    child.kill('SIGKILL');
    await closed;
    removeTree(cwd);
  }
});

// ---------------------------------------------------------------------------
// INV-hooks-fail-open, one failure mode at a time, over all six binaries.
//
// The invariant is stated absolutely — every binary sets `process.exitCode = 0`
// unconditionally and wraps its work in try/catch — and the two modes above
// (garbage on stdin, empty stdin) were the only two anything executed. Those
// are the modes where the hooks do the LEAST work; the ones below are where
// they do the most and then hit a wall, which is where a fail-open policy
// actually gets tested.
//
// Every mode is portable, and none of them relies on file permissions: `chmod`
// is close to a no-op on Windows, and a test that quietly does nothing on the
// platform this project is developed on is worse than no test. A directory
// replaced by a regular FILE is refused by `mkdirSync` everywhere.
// ---------------------------------------------------------------------------

/** A payload every one of the six reads something out of. */
function anyPayload(cwd: string): string {
  return JSON.stringify({
    hook_event_name: 'PostToolUse',
    source: 'startup',
    session_id: 'sess-failopen',
    prompt_id: 'p-failopen',
    // `subagent-start` gates on this and injects nothing without it, so a
    // payload that omitted it would run that binary's decline path through
    // every mode below and assert nothing about failing open under load.
    agent_id: 'agent-failopen',
    cwd,
    tool_name: 'Write',
    tool_input: { file_path: path.join(cwd, 'docs', 'prd', 'auth.md') },
    error: 'EACCES: permission denied',
  });
}

const FAILURE_MODES: { name: string; prepare: () => string }[] = [
  {
    // No `.my_context` anywhere above the cwd: `resolveWorkspace` returns a
    // null `projectRoot` and every write target the hooks have is gone.
    name: 'no workspace at all',
    prepare: () => mkdtempSync(path.join(tmpdir(), 'myctx-nows-')),
  },
  {
    // The one call in these binaries that THROWS rather than returning a falsy
    // answer — `resolveWorkspace` on unparseable JSON. Named in
    // `post-tool-use-failure.ts`'s own doc comment as the case its outer catch
    // exists for; asserted here for all five.
    name: 'config.json that makes resolveWorkspace throw',
    prepare: () => {
      const cwd = project();
      pinned(cwd);
      writeFileSync(path.join(cwd, '.my_context', 'config.json'), '{ "watchedDocs": ', 'utf8');
      return cwd;
    },
  },
  {
    // Every directory a hook writes into replaced by a regular file, so the
    // seen file, the snapshot and the audit append all fail at `mkdirSync`.
    // `watchedDocs` is widened first so PostToolUse actually reaches its
    // append instead of declining before it.
    name: 'a corpus nothing can be written into',
    prepare: () => {
      const cwd = project();
      pinned(cwd);
      writeFileSync(
        path.join(cwd, '.my_context', 'config.json'),
        JSON.stringify({ profile: 'standard', watchedDocs: ['docs/**'] }, null, 2) + '\n',
        'utf8',
      );
      for (const blocked of ['state', '.audit']) {
        const target = path.join(cwd, '.my_context', blocked);
        removeTree(target);
        writeFileSync(target, 'not a directory\n', 'utf8');
      }
      return cwd;
    },
  },
];

for (const mode of FAILURE_MODES) {
  for (const name of [
    'session-start', 'pre-tool-use', 'pre-compact', 'post-tool-use', 'post-tool-use-failure',
    'subagent-start',
  ]) {
    test(`${name} fails open with ${mode.name}`, async () => {
      const cwd = mode.prepare();
      try {
        const result = await runHook(HOOK(name), anyPayload(cwd), cwd);
        assert.equal(result.code, 0, `exit ${result.code}; stderr: ${result.stderr}`);
        assert.equal(result.signal, null, 'the hook died rather than failing open');
        // Whatever it decided to say, it must still be something Claude Code
        // can read — a half-written JSON object is a hook that broke the tool
        // call by a different route than a non-zero exit.
        if (result.stdout.trimStart().startsWith('{')) JSON.parse(result.stdout);
      } finally { removeTree(cwd); }
    });
  }
}

/**
 * The two prepared modes above are only worth their runtime if they actually
 * BITE, and "the hook exited 0" is also what a hook that declined early looks
 * like. Both are therefore pinned against the same setup with the fault
 * removed: the injection that arrives without the fault must be missing with
 * it, and the write that succeeds without it must fail with it.
 *
 * These two assertions also record, by execution, an asymmetry this task did
 * not introduce and does not fix: an unwritable corpus is disclosed on stderr
 * by `pre-compact`, while an unparseable `config.json` is disclosed by nobody.
 * A user with a typo in `config.json` gets a session with no knowledge in it
 * and not one byte saying why.
 */
test('the unwritable-corpus mode really does break a write', async () => {
  const healthy = project();
  const broken = FAILURE_MODES[2].prepare();
  try {
    const ok = await runHook(HOOK('pre-compact'), anyPayload(healthy), healthy);
    assert.equal(ok.code, 0);
    assert.equal(ok.stderr, '', 'premise: with a writable corpus PreCompact says nothing');

    const bad = await runHook(HOOK('pre-compact'), anyPayload(broken), broken);
    assert.equal(bad.code, 0, 'a failed snapshot must not become a failed hook');
    assert.match(bad.stderr, /the PreCompact restore snapshot could not be written/);
  } finally { removeTree(healthy); removeTree(broken); }
});

test('the config.json mode really does reach the throw, and nothing says so', async () => {
  const healthy = project();
  pinned(healthy);
  const broken = FAILURE_MODES[1].prepare();
  try {
    const ok = await runHook(HOOK('session-start'), anyPayload(healthy), healthy);
    assert.equal(ok.code, 0);
    assert.match(ok.stdout, /CONST-pool/, 'premise: the same corpus injects when config.json parses');

    const bad = await runHook(HOOK('session-start'), anyPayload(broken), broken);
    assert.equal(bad.code, 0, 'an unparseable config.json must not become a failed hook');
    // The whole injection is gone. Asserted as it IS, not as it should be:
    // `resolveWorkspace` throws a perfectly good message and every path from
    // here swallows it, so this is the shape of the product today.
    assert.equal(bad.stdout, '', 'the corpus injected despite an unreadable config.json');
    assert.equal(bad.stderr, '');
  } finally { removeTree(healthy); removeTree(broken); }
});

// ---------------------------------------------------------------------------
// §6n.3, executed: what a KILLED SubagentStart leaves behind.
// ---------------------------------------------------------------------------

/**
 * **The one place in this suite where §6n.3's ruling is actually observed end
 * to end.** `subagent-start.ts` writes `delivery=attempted` BEFORE it does any
 * work, because the only bound on this hook is Claude Code killing the process
 * at the `timeout` in `hooks.json` and a killed process writes nothing after
 * it dies. That ordering is worth exactly nothing unless a kill really does
 * leave the attempt behind with no completion beside it — so a kill is
 * performed, on the real binary, against a real workspace, and the log is read
 * back off disk afterwards.
 *
 * **The mechanism, named because the plan asked which one was used — and it is
 * NOT the one the plan named.** Task 11's step said to make the work slow
 * deterministically by holding the index write lock from the test process.
 * That cannot slow this hook by a millisecond: Task 10's design decision 3
 * made the subagent event skip the best-effort index refresh entirely
 * (`core/inject.ts` · `**THE SUBAGENT EVENT SKIPS THIS ENTIRELY**` · ~533), so
 * nothing between the two records opens a database and a held lock is
 * invisible to it. The contended-open worst case the plan cites in its case
 * for `timeout: 5` (`core/store.ts` · `Worst case ~1.06s: two attempts` · ~122)
 * is not on this path either.
 *
 * So the block is installed in the child, by `--import`, and triggered by a
 * sentinel this test plants in `config.json`: the preload replaces
 * `JSON.parse` with one that blocks the thread forever the first time it is
 * handed text containing that sentinel. The parse it stops at is
 * `resolveWorkspace`'s (`core/workspace.ts` · `raw = JSON.parse(readFileSync(configPath, 'utf8'));` · ~34),
 * which is the first thing `buildInjection` does — so when the child stops it
 * is provably past the attempt record and provably short of the selection.
 * The child then says so in a file, and only then does the test kill it.
 * **Nothing here is sequenced on a clock**: no sleep decides the outcome, and
 * a machine slow enough to change the timing changes nothing but how long the
 * poll below waits.
 *
 * The binary, the workspace, the corpus and both audit writes are real. The
 * only thing the preload changes is how long one call the path already makes
 * takes to return.
 *
 * **The premise is pinned by a second dispatch in the SAME workspace**, with a
 * different agent and no preload, which leaves both rows. That is what makes
 * the missing completion evidence of the kill rather than of the fixture — and
 * the resulting log is exactly what §6n.3 asks a reader of
 * `mycontext audit --session <parent>` to be able to see: two agents under one
 * parent session, one paired and one not.
 */
test('a killed subagent-start leaves delivery=attempted with no delivery=complete', async () => {
  const cwd = project();
  pinned(cwd);

  const sentinel = 'MYCTX-BLOCK-AT-CONFIG-PARSE';
  const marker = path.join(cwd, 'child-reached-the-block');
  writeFileSync(
    path.join(cwd, '.my_context', 'config.json'),
    JSON.stringify({ profile: 'standard', watchedDocs: [`docs/${sentinel}/**`] }, null, 2) + '\n',
    'utf8',
  );

  // Written rather than inlined as a `data:` URL only for legibility; it runs
  // before the binary's first line, in the binary's own process.
  const preload = path.join(cwd, 'block-at-config-parse.mjs');
  writeFileSync(preload, `import { writeFileSync } from 'node:fs';
const real = JSON.parse;
JSON.parse = function (text, ...rest) {
  if (typeof text === 'string' && text.includes(${JSON.stringify(sentinel)})) {
    writeFileSync(${JSON.stringify(marker)}, 'blocked');
    // Blocks this thread outright and forever: no spin, no pending timer,
    // nothing that could let the process end on its own. Only the SIGKILL
    // from the test ends it — which is the whole point of the exercise.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  }
  return real.call(JSON, text, ...rest);
};
`, 'utf8');

  const child = spawn(process.execPath, [
    '--disable-warning=ExperimentalWarning',
    '--import', pathToFileURL(preload).href,
    HOOK('subagent-start'),
  ], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (c: string) => { stderr += c; });
  const ended = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.on('close', (code, signal) => { resolve({ code, signal }); });
  });

  try {
    child.stdin.end(JSON.stringify({
      hook_event_name: 'SubagentStart',
      session_id: 'sess-e2e-kill',
      agent_id: 'agent-killed',
      cwd,
    }));

    const blockedBy = Date.now() + EXIT_BUDGET_MS;
    while (!existsSync(marker)) {
      assert.ok(Date.now() < blockedBy, `the child never reached the block. stderr: ${stderr}`);
      await new Promise((r) => { setTimeout(r, 25); });
    }
    assert.equal(
      child.exitCode, null,
      'the child ran to completion instead of stopping where the preload put it',
    );

    child.kill('SIGKILL');
    const exit = await ended;
    assert.ok(
      !(exit.code === 0 && exit.signal === null),
      `the child exited normally (code ${exit.code}), so nothing was killed and this proves nothing`,
    );

    // The premise, in the same workspace: the same binary, unblocked, pairs
    // its own attempt with a completion.
    const ok = await runHook(HOOK('subagent-start'), JSON.stringify({
      hook_event_name: 'SubagentStart',
      session_id: 'sess-e2e-kill',
      agent_id: 'agent-ok',
      cwd,
    }), cwd);
    assert.equal(ok.code, 0, `stderr: ${ok.stderr}`);

    const notes = readAudit(path.join(cwd, '.my_context'))
      .filter((record) => record.op === 'subagent-start')
      .map((record) => record.note ?? '');
    assert.deepEqual(
      notes.filter((note) => note.includes('agent=agent-killed')),
      ['delivery=attempted agent=agent-killed'],
      'a killed dispatch left something other than one lone attempt',
    );
    assert.deepEqual(
      notes.filter((note) => note.includes('agent=agent-ok')),
      ['delivery=attempted agent=agent-ok', 'delivery=complete agent=agent-ok'],
      'premise: an unkilled dispatch against this same workspace records BOTH rows',
    );
  } finally {
    child.kill('SIGKILL');
    await ended;
    removeTree(cwd);
  }
});
