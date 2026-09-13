// @basis TASK-a-malformed-config-returns-an-empty-injection-from-six, KNOWN-an-unparseable-hook-payload-injects-plausibly-and-discloses, INV-nothing-is-dropped-silently, INV-hooks-fail-open
/**
 * **One trailing comma in `config.json` used to remove this product from a
 * session and say nothing, on any channel, anywhere.**
 *
 * ── THE FIXTURE IS THE FINDING, SO IT IS MALFORMED AND NOT ABSENT ─────────
 *
 * `loadConfig` treats an ABSENT `config.json` as pure defaults and an
 * UNPARSEABLE one as a throw, and those two states are exactly what this defect
 * confused. A fixture with no config file therefore proves nothing here — it
 * exercises the healthy path and passes whether or not anything was fixed. So
 * every sandbox below writes a real `.my_context/config.json` and then puts a
 * trailing comma in it, and `CONTROL` runs the identical sandbox with the comma
 * removed. Both are asserted, because a disclosure that fires on a healthy
 * config is a worse defect than the silence it replaces.
 *
 * ── WHAT WAS BROKEN, AND WHY IT WAS INVISIBLE ────────────────────────────
 *
 * `resolveWorkspace` throws on a config that does not parse. Six delivery paths
 * caught that throw and returned an empty value — the injection, the SessionStart
 * store and handover appendices, the per-tool-call JIT tier, the compaction
 * snapshot, and the watched-doc nudge — and `Injection` had no field that could
 * carry a reason, so an empty delivery was byte-identical to a quiet corpus.
 *
 * **And the evidence exonerated it.** The RECORDING paths resolve their roots
 * with `findProjectRoot`, which reads no config and cannot throw; each says so
 * in a comment and each is right to. So the audit log kept filling with healthy
 * rows for the whole of a session that received nothing. The one disclosure
 * that could have spoken — `noWorkspaceLine` — is gated on
 * `findProjectRoot(cwd) === null`, and `findProjectRoot` SUCCEEDS on a broken
 * config: the directory is there. That gate is asserted below, because a fix
 * that merely added a line beside a check that still passes would be no fix.
 *
 * ── FAIL OPEN, AND DISCLOSE ──────────────────────────────────────────────
 *
 * `INV-hooks-fail-open` and `INV-nothing-is-dropped-silently` are both
 * `severity: hard`, and
 * `KNOWN-an-unparseable-hook-payload-injects-plausibly-and-discloses` settled
 * the tension for the hook payload: *keep failing open — but disclose.* It was
 * applied at that one site and never propagated. This file is the propagation,
 * so every hook below is asserted to still EXIT 0 with the disclosure — a hook
 * that refused to start because of a comma would be a worse product.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { buildInjectionResult } from '../../src/core/inject.ts';
import { configLoadFailure, findProjectRoot } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const hook = (name: string): string =>
  fileURLToPath(new URL(`../../src/hooks/${name}.ts`, import.meta.url));

/** A corpus with something to lose: an always-on item that a healthy run delivers. */
function seed(cwd: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-visible.md');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: CONST-visible
type: constraint
title: a constraint a healthy session receives
status: active
severity: hard
always: true
---

# a constraint a healthy session receives

Long enough to be unmistakable in an injected block.
`);
}

/**
 * A sandbox whose `config.json` is real and, when `broken`, unparseable.
 *
 * The comma is appended to the file `init` actually wrote, rather than a config
 * invented here: the point is a file a person edited by hand and left one
 * character wrong in, not a synthetic document with no relation to the one this
 * product writes.
 */
function sandbox(broken: boolean): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-cfg-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  seed(cwd);
  const config = path.join(cwd, '.my_context', 'config.json');
  const text = readFileSync(config, 'utf8');
  if (broken) {
    const comma = text.replace(/\}\s*$/u, ',\n}\n');
    assert.notEqual(comma, text, 'the fixture must actually have been changed');
    writeFileSync(config, comma, 'utf8');
    assert.throws(() => JSON.parse(readFileSync(config, 'utf8')) as unknown,
      'the fixture must be UNPARSEABLE — an absent or merely odd config proves nothing here');
  }
  return cwd;
}

interface Run { status: number | null; stdout: string; stderr: string }

function run(binary: string, payload: Record<string, unknown>): Run {
  const r = spawnSync(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', hook(binary)],
    { input: JSON.stringify(payload), encoding: 'utf8' },
  );
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** The shared half of every disclosure, so a path that half-discloses fails. */
const DISCLOSED = /my_context: this project's config could not be read — .+ is not valid JSON/;

/* ══════════════════════════════════════════════════════════════════════ *
 * THE PRECONDITION — the gate that was supposed to catch this, and did   *
 * not.                                                                   *
 * ══════════════════════════════════════════════════════════════════════ */

test('a broken config leaves `findProjectRoot` succeeding — which is why nothing spoke', (t) => {
  const cwd = sandbox(true);
  t.after(() => removeTree(cwd));

  // Asserted rather than described. `noWorkspaceLine` is gated on this being
  // `null`; it is not, so the only disclosure that existed could never fire.
  assert.notEqual(findProjectRoot(cwd), null);
  assert.match(configLoadFailure(cwd) ?? '', /is not valid JSON/);
});

test('an ABSENT config is not a failure — the two states this defect confused', (t) => {
  const cwd = sandbox(false);
  t.after(() => removeTree(cwd));
  const config = path.join(cwd, '.my_context', 'config.json');
  rmSync(config, { force: true });

  assert.equal(configLoadFailure(cwd), null,
    'no config at all is pure defaults, and must stay silent');
});
/* ══════════════════════════════════════════════════════════════════════ *
 * PATH 1 — core/inject.ts: the `Injection` itself.                        *
 * ══════════════════════════════════════════════════════════════════════ */

test('PATH 1 · the injection carries a reason instead of an indistinguishable empty string', (t) => {
  const broken = sandbox(true);
  const healthy = sandbox(false);
  t.after(() => { removeTree(broken); removeTree(healthy); });

  const bad = buildInjectionResult(broken, { event: 'session-start', sessionId: 's-1' });
  assert.match(bad.failure ?? '', /is not valid JSON/,
    'the field that did not exist, and without which no caller could tell the two apart');
  assert.match(bad.text, /knowledge base could not be read/);
  assert.match(bad.text, /not as "this project has no rules"/,
    'the model is told what the absence does and does not mean');

  const good = buildInjectionResult(healthy, { event: 'session-start', sessionId: 's-2' });
  assert.equal(good.failure, null, 'a healthy corpus claims no failure');
  assert.match(good.text, /CONST-visible/, 'and actually delivered — otherwise this proves nothing');
});

/* ══════════════════════════════════════════════════════════════════════ *
 * PATHS 2-6 — the hooks, through their real binaries.                    *
 *                                                                        *
 * The binary and not the function, for `session-start-spill.test.ts`'s    *
 * reason: the CHANNEL is half the requirement, and a line composed        *
 * correctly and written nowhere is the same silence.                     *
 * ══════════════════════════════════════════════════════════════════════ */

test('PATH 2 · SessionStart says the session starts with no project knowledge', (t) => {
  const cwd = sandbox(true);
  t.after(() => removeTree(cwd));

  const r = run('session-start', { session_id: 's-ss', source: 'startup', cwd });

  assert.equal(r.status, 0, 'INV-hooks-fail-open: a comma must not stop a session starting');
  assert.match(r.stderr, DISCLOSED);
  assert.match(r.stderr, /no rules or other items, no product rule store, and no handover/,
    'all three losses named, because one cause does not mean one consequence');
  assert.doesNotMatch(r.stderr, /no corpus found/,
    'and NOT through `noWorkspaceLine`, whose gate this failure walks straight past');
  assert.match(r.stdout, /knowledge base could not be read/,
    "the model's copy, in the block it reads");
});

test('PATH 3 · SubagentStart says the subagent was dispatched with nothing', (t) => {
  const cwd = sandbox(true);
  t.after(() => removeTree(cwd));

  const r = run('subagent-start', { session_id: 's-sa', agent_id: 'agent-1', cwd });

  assert.equal(r.status, 0);
  assert.match(r.stderr, DISCLOSED);
  assert.match(r.stderr, /this subagent was dispatched with NO project knowledge/);
  assert.match(r.stdout, /knowledge base could not be read/,
    'and the agent itself is told, inside the envelope it receives');
});

test('PATH 4 · PreToolUse says the JIT tier injected nothing for this tool call', (t) => {
  const cwd = sandbox(true);
  t.after(() => removeTree(cwd));
  const target = path.join(cwd, 'src', 'thing.ts');
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, 'export const x = 1;\n');

  const r = run('pre-tool-use', {
    session_id: 's-jit', cwd, tool_name: 'Read', tool_input: { file_path: target },
  });

  assert.equal(r.status, 0, 'a tool call is never blocked by a broken config');
  assert.match(r.stderr, DISCLOSED);
  assert.match(r.stderr, /nothing was injected for this tool call/);
  assert.equal(r.stdout, '', 'and the block itself stays empty — the model is not charged per call');
});

test('PATH 5 · PreCompact says the next session will restore nothing', (t) => {
  const cwd = sandbox(true);
  t.after(() => removeTree(cwd));

  const r = run('pre-compact', { session_id: 's-pc', cwd, trigger: 'manual' });

  assert.equal(r.status, 0);
  assert.match(r.stderr, DISCLOSED);
  assert.match(r.stderr, /no snapshot was captured for this compaction/,
    'said now, because the cost lands after the window that would explain it is gone');
});

test('PATH 6 · PostToolUse says no capture nudge can be raised', (t) => {
  const cwd = sandbox(true);
  t.after(() => removeTree(cwd));
  const doc = path.join(cwd, 'docs', 'design.md');
  mkdirSync(path.dirname(doc), { recursive: true });
  writeFileSync(doc, '# design\n');

  const r = run('post-tool-use', {
    session_id: 's-ptu', cwd, tool_name: 'Write', tool_input: { file_path: doc },
  });

  assert.equal(r.status, 0);
  assert.match(r.stderr, DISCLOSED);
  assert.match(r.stderr, /`watchedDocs` is in that file/,
    'the promise that was withdrawn is named, not just the mechanism that withdrew it');
});

/* ══════════════════════════════════════════════════════════════════════ *
 * CONTROL — the same five binaries, the same sandbox, a valid config.    *
 *                                                                        *
 * Without this the whole file would pass on a hook that printed the line  *
 * unconditionally, which is the failure mode every disclosure in this     *
 * directory is warned about: a line that appears always is a line nobody  *
 * reads.                                                                  *
 * ══════════════════════════════════════════════════════════════════════ */

test('CONTROL · a healthy config says nothing about itself on any of the five hooks', (t) => {
  const cwd = sandbox(false);
  t.after(() => removeTree(cwd));
  const target = path.join(cwd, 'src', 'thing.ts');
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, 'export const x = 1;\n');

  const runs: [string, Run][] = [
    ['session-start', run('session-start', { session_id: 'c-1', source: 'startup', cwd })],
    ['subagent-start', run('subagent-start', { session_id: 'c-2', agent_id: 'agent-c', cwd })],
    ['pre-tool-use', run('pre-tool-use', {
      session_id: 'c-3', cwd, tool_name: 'Read', tool_input: { file_path: target },
    })],
    ['pre-compact', run('pre-compact', { session_id: 'c-4', cwd, trigger: 'manual' })],
    ['post-tool-use', run('post-tool-use', {
      session_id: 'c-5', cwd, tool_name: 'Write', tool_input: { file_path: target },
    })],
  ];

  for (const [name, r] of runs) {
    assert.doesNotMatch(r.stderr, /config could not be read/, `${name} must stay silent`);
    assert.equal(r.status, 0, `${name} exits 0`);
  }
  // And the fixture is genuinely capable of delivering, so "silent" here means
  // "nothing was wrong" rather than "nothing happened".
  assert.match(runs[0]![1].stdout, /CONST-visible/);
});
