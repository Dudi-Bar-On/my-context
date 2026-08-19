/**
 * The four hook binaries, run as real OS processes over real stdio.
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
 * **The stdin-held-open case is PostToolUse only, deliberately.** Only
 * `post-tool-use.ts` reads stdin asynchronously and carries an unref'd 2s
 * timer that preempts a pipe that never closes. The other three read stdin
 * with a synchronous `readFileSync(0)`, which blocks the thread outright — no
 * timer can fire, and a test that opened their stdin and never closed it would
 * hang the suite rather than fail it. That asymmetry is a real property of
 * these binaries, so it is asserted where it holds and not elsewhere.
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
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
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
// The three hooks below share `parseHookInput`, and a payload it cannot read
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

for (const name of ['session-start', 'pre-tool-use', 'pre-compact']) {
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
 * PreToolUse and PreCompact have no channel to the model on this path — a
 * payload with no `file_path` gives PreToolUse nothing to attach context to,
 * and PreCompact talks to the filesystem, never to the model. stderr is their
 * whole disclosure, and stdout stays exactly as empty as it always was.
 */
for (const name of ['pre-tool-use', 'pre-compact']) {
  test(`${name} still writes nothing to stdout when stdin is garbage`, async () => {
    const cwd = project();
    try {
      const result = await runHook(HOOK(name), GARBAGE, cwd);
      assert.equal(result.stdout, '', 'a hook with no opinion must write nothing at all');
    } finally { removeTree(cwd); }
  });
}

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
 * four hooks must stay completely silent on every channel — a disclosure that
 * fired here would print a warning on every interactive run, a worse defect
 * than the silence it was added to fix.
 *
 * The `stderr === ''` assertion below is left exactly as it was on purpose.
 * It currently fails for three of the four hooks, for the unrelated
 * ExperimentalWarning noted above; that is a pre-existing failure with its
 * own fix, and loosening this assertion to go green would discard the only
 * thing watching this channel.
 */
for (const name of ['session-start', 'pre-tool-use', 'pre-compact', 'post-tool-use']) {
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
