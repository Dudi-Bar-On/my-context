/**
 * The delivery half of the handover mechanism: `SessionStart` is the one hook
 * whose stdout Claude Code appends to the model's context VERBATIM, so it is
 * the only place a handover read off disk can actually reach a session.
 *
 * **Every test here spawns the hook as a process rather than calling
 * `buildSessionStartOutput`.** The whole task is which of the two streams a
 * given outcome lands on — the block goes to stdout, a configured-but-missing
 * handover goes to stderr and must never reach the model, and an unconfigured
 * one goes nowhere — and an in-process call collapses that distinction to a
 * single return value. `test/hooks/session-start.test.ts`'s no-workspace test
 * already spawns the hook for exactly this reason; the harness below is that
 * one, generalised.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

const HOOK = fileURLToPath(new URL('../../src/hooks/session-start.ts', import.meta.url));

/** Where every fixture's handover lives, relative to the project root. */
const HANDOVER_REL = 'reports/H.md';

/**
 * A marked section, spelled with the default marker (U+23ED, the "next" glyph)
 * so the fixtures exercise the path a real project takes rather than a
 * configured-marker path no handover in this repository uses.
 */
const MARKED = '### ⏭ NOW\ndo the thing';

interface Fixture {
  /** Write `.my_context/config.json` with this `handover.path`. Omit for no key at all. */
  configure?: string;
  /** Write a handover file at `HANDOVER_REL` with this body. Omit to leave it absent. */
  handover?: string;
  /** Skip `mycontext init` entirely — a directory with no workspace above it. */
  noWorkspace?: boolean;
}

function sandbox(t: { after(fn: () => void): void }, fixture: Fixture): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-ho-'));
  t.after(() => removeTree(cwd));
  if (fixture.noWorkspace === true) {
    if (fixture.handover !== undefined) writeHandover(cwd, fixture.handover);
    return cwd;
  }

  runCli(['init'], cwd, () => {});
  // A pinned item, so the corpus block is non-empty and the ORDER assertion
  // has two things to order. Without one, `buildInjection` returns '' and the
  // handover would be the only text on stdout — which would pass an ordering
  // test that proves nothing.
  const item = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-pool.md');
  mkdirSync(path.dirname(item), { recursive: true });
  writeFileSync(item, `---
id: CONST-pool
type: constraint
title: Pool capped at 20
status: active
severity: hard
always: true
---

# Pool capped at 20

Body text.
`);

  if (fixture.configure !== undefined) {
    const configPath = path.join(cwd, '.my_context', 'config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    config.handover = { path: fixture.configure };
    writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
  if (fixture.handover !== undefined) writeHandover(cwd, fixture.handover);
  return cwd;
}

function writeHandover(cwd: string, body: string): void {
  const file = path.join(cwd, ...HANDOVER_REL.split('/'));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, body, 'utf8');
}

interface Run {
  stdout: string;
  stderr: string;
  status: number | null;
}

function runHook(cwd: string, source: string): Run {
  const run = spawnSync(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', HOOK],
    {
      input: JSON.stringify({ session_id: 's1', source, cwd, hook_event_name: 'SessionStart' }),
      encoding: 'utf8',
    },
  );
  // INV-hooks-fail-open, asserted on every single run rather than once: this
  // branch reads a file off disk on the session-start path, and a handover
  // that can fail a session start is worse than one that is never delivered.
  assert.equal(run.status, 0, `the hook exited ${run.status}\n${run.stderr}`);
  return { stdout: run.stdout, stderr: run.stderr, status: run.status };
}

test('a compacted session receives the handover, AFTER the corpus block', (t) => {
  const cwd = sandbox(t, { configure: HANDOVER_REL, handover: MARKED });
  const run = runHook(cwd, 'compact');

  assert.match(run.stdout, /## my_context/, 'the corpus block stopped being injected');
  assert.match(run.stdout, /do the thing/, 'the handover never reached the model');
  assert.ok(
    run.stdout.indexOf('## my_context') < run.stdout.indexOf('do the thing'),
    'the corpus governs and comes first; the handover is what one session left another',
  );
  // Raw text, never an envelope. `hooks/io.ts` excludes SessionStart from
  // `HookEventName` precisely because wrapping this stream would deliver the
  // JSON itself into context instead of the knowledge inside it.
  assert.doesNotMatch(run.stdout, /hookSpecificOutput/);
});

test('the block names its file and what it left behind, in the model-facing text', (t) => {
  // Comfortably past the default 1,200-token budget (4,800 characters at the
  // four-to-a-token estimate `core/handover.ts` charges with), so the block
  // being asserted is one that ACTUALLY left something behind.
  const lines = [MARKED];
  for (let i = 0; i < 200; i += 1) lines.push(`filler ${'x'.repeat(50)} ${i}`);
  const cwd = sandbox(t, { configure: HANDOVER_REL, handover: lines.join('\n') });
  const run = runHook(cwd, 'compact');

  assert.match(run.stdout, /reports\/H\.md/, 'a bounded block that does not name its file is unreadable');
  assert.match(run.stdout, /\d+ of \d+ lines/, 'the block must say how much of the file it is');
  assert.match(run.stdout, /lines are NOT here/,
    'REQ-every-list-and-table-declares-what-leaves-it: a truncated document is a truncated list');
});

test('every source that arrives with an empty window gets it', (t) => {
  for (const source of ['startup', 'clear', 'compact', 'fork']) {
    const cwd = sandbox(t, { configure: HANDOVER_REL, handover: MARKED });
    const run = runHook(cwd, source);
    assert.match(run.stdout, /do the thing/, `source=${source} received no handover`);
  }
});

test('resume does NOT get it — it is the only source that kept its window', (t) => {
  const cwd = sandbox(t, { configure: HANDOVER_REL, handover: MARKED });
  const run = runHook(cwd, 'resume');

  assert.doesNotMatch(run.stdout, /do the thing/,
    'a resumed session still has the context it was told about; re-delivering the handover '
    + 'spends the window the handover exists to protect');
  assert.doesNotMatch(run.stderr, /handover/i, 'and it is not a defect either, so nothing is said');
  assert.match(run.stdout, /## my_context/, 'the ordinary injection is unaffected');
});

test('a configured handover that is not there DISCLOSES on stderr and never in context', (t) => {
  const cwd = sandbox(t, { configure: 'reports/gone.md' });
  const run = runHook(cwd, 'compact');

  assert.match(run.stderr, /reports\/gone\.md/,
    'a broken agreement that says nothing is the exact defect this feature exists to answer');
  assert.doesNotMatch(run.stdout, /reports\/gone\.md/,
    'stderr reaches the USER, who can fix it; the model gets no text about a file that is not there');
  assert.doesNotMatch(run.stdout, /handover/i);
  assert.match(run.stdout, /## my_context/, 'and the corpus is still delivered');
});

test('an unconfigured handover is silent in BOTH streams', (t) => {
  const cwd = sandbox(t, { handover: MARKED });
  const run = runHook(cwd, 'compact');

  // The file is even THERE. Nothing was promised, so nothing is read and
  // nothing is said: a plugin does not read files in somebody's repository
  // because they installed it.
  assert.doesNotMatch(run.stdout, /handover/i);
  assert.doesNotMatch(run.stdout, /do the thing/);
  assert.doesNotMatch(run.stderr, /handover/i);
  assert.match(run.stdout, /## my_context/);
});

test('a session with no workspace is unchanged — no handover, on either stream', (t) => {
  const cwd = sandbox(t, { noWorkspace: true, handover: MARKED });
  const run = runHook(cwd, 'compact');

  // There is no project root, so there is no config, so there is no handover
  // to be missing — and the hook must stay as quiet here as it is today
  // beyond the no-corpus line it already writes.
  assert.equal(run.stdout, '', 'the plugin does not announce itself inside unrelated projects');
  assert.doesNotMatch(run.stderr, /handover/i);
});
