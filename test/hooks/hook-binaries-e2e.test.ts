/**
 * The five hook binaries, run as real OS processes over real stdio.
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
 * **The stdin-held-open case is PostToolUse only, deliberately.** Only
 * `post-tool-use.ts` reads stdin asynchronously and carries an unref'd 2s
 * timer that preempts a pipe that never closes. The other four read stdin
 * with a synchronous `readFileSync(0)`, which blocks the thread outright — no
 * timer can fire, and a test that opened their stdin and never closed it would
 * hang the suite rather than fail it. That asymmetry is a real property of
 * these binaries, so it is asserted where it holds and not elsewhere. It is
 * also why `post-tool-use-failure` reads synchronously despite sharing this
 * event family: nothing waits on its output, so a stalled read costs the
 * process and nothing else, and `hooks.json`'s 5s kill is the bound.
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
import { fileURLToPath } from 'node:url';
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
 * hook sees when the caller has not closed its end. Only pass it for
 * PostToolUse; see the note at the top of this file.
 */
function runHook(
  file: string, payload: string, cwd: string, options: { holdStdin?: boolean } = {},
): Promise<Run> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', file], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c: string) => { stdout += c; });
    child.stderr.on('data', (c: string) => { stderr += c; });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(
        `${path.basename(file)} did not exit within ${EXIT_BUDGET_MS}ms. ` +
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
  assert.ok(COMMANDS.length >= 5, `only ${COMMANDS.length} hook command(s) registered`);
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
// The four hooks below share `parseHookInput`, and a payload it cannot read
// costs `source` and `session_id`. That loss used to be invisible:
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

for (const name of ['session-start', 'pre-tool-use', 'pre-compact', 'post-tool-use-failure']) {
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
 * PreToolUse, PreCompact and PostToolUseFailure have no channel to the model on
 * this path — a payload with no `file_path` gives PreToolUse nothing to attach
 * context to, and the other two talk to the filesystem, never to the model.
 * stderr is their whole disclosure, and stdout stays exactly as empty as it
 * always was.
 */
for (const name of ['pre-tool-use', 'pre-compact', 'post-tool-use-failure']) {
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
 * five hooks must stay completely silent on every channel — a disclosure that
 * fired here would print a warning on every interactive run, a worse defect
 * than the silence it was added to fix.
 *
 * The `stderr === ''` assertion below is left exactly as it was on purpose.
 * It currently fails for three of the four hooks, for the unrelated
 * ExperimentalWarning noted above; that is a pre-existing failure with its
 * own fix, and loosening this assertion to go green would discard the only
 * thing watching this channel.
 */
for (const name of [
  'session-start', 'pre-tool-use', 'pre-compact', 'post-tool-use', 'post-tool-use-failure',
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
// The stdin-held-open case. PostToolUse ONLY — see the note at the top.
// ---------------------------------------------------------------------------

/**
 * The one hook whose caller can leave the pipe open without wedging it. The
 * timer in `post-tool-use.ts` is unref'd and set for 2s; the assertion is that
 * the process ends by itself, not that it ends at any particular moment —
 * `elapsedMs` is checked only against a bound wide enough that a cold start on
 * a loaded machine cannot reach it, because the alternative is a clock
 * assertion that reddens the suite for reasons that have nothing to do with
 * this hook.
 */
test('post-tool-use exits on its own when stdin is never closed', async () => {
  const cwd = project();
  try {
    const result = await runHook(HOOK('post-tool-use'), JSON.stringify({
      hook_event_name: 'PostToolUse',
      cwd,
      tool_name: 'Write',
      tool_input: { file_path: path.join(cwd, 'src', 'thing.ts') },
    }), cwd, { holdStdin: true });

    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    assert.equal(result.signal, null, 'it exited by itself rather than being killed by the harness');
    assert.equal(result.stdout, '');
    assert.ok(
      result.elapsedMs < EXIT_BUDGET_MS,
      `held-open stdin took ${result.elapsedMs}ms, which is the harness budget, not the hook's`,
    );
  } finally { removeTree(cwd); }
});

test('post-tool-use exits on its own when stdin is held open and empty', async () => {
  const cwd = project();
  try {
    const result = await runHook(HOOK('post-tool-use'), '', cwd, { holdStdin: true });
    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    assert.equal(result.signal, null);
    assert.equal(result.stdout, '');
  } finally { removeTree(cwd); }
});
