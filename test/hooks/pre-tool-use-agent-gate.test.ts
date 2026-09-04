/**
 * The `Agent` dispatch gate — TASK-nothing-stops-a-subagent-being-dispatched-
 * for-work-that-has. `test/hooks/pre-tool-use-jit.test.ts`'s sandbox/index
 * pattern is reused rather than re-invented, because the gate reads the same
 * SQLite index the JIT tier does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  agentDenyMessage, candidateItemIds, runPreToolUse,
} from '../../src/hooks/pre-tool-use.ts';
import { runCli } from '../../src/cli/index.ts';
import { readAudit } from '../../src/core/audit.ts';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-agent-gate-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

/** Merges `patch` into the workspace's own config.json — never a wholesale
 * replacement, so init's own defaults for every other key survive. */
function configure(cwd: string, patch: Record<string, unknown>): void {
  const file = path.join(cwd, '.my_context', 'config.json');
  const existing = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  writeFileSync(file, JSON.stringify({ ...existing, ...patch }, null, 2));
}

function addItem(cwd: string, id: string, type: string, body: string): void {
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: ${type}
title: ${id} title
status: active
severity: soft
always: false
scope: []
---

# ${id} title

${body}
`);
}

/** Index the workspace the way SessionStart would, so the gate can read it. */
function index(cwd: string): void {
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  rebuild(store, { project: ws.projectRoot ?? undefined }, ws.config);
  store.close();
}

function agentInput(cwd: string, sessionId: string, prompt: string, description = 'Do the work'): string {
  return JSON.stringify({
    session_id: sessionId,
    hook_event_name: 'PreToolUse',
    cwd,
    tool_name: 'Agent',
    tool_input: { prompt, description, subagent_type: 'general-purpose' },
  });
}

function decision(raw: string): { permissionDecision?: string; permissionDecisionReason?: string } {
  if (raw === '') return {};
  const parsed = JSON.parse(raw) as { hookSpecificOutput: Record<string, unknown> };
  return parsed.hookSpecificOutput;
}

/** `readAudit` takes the `.my_context` directory, not the repo root a
 * sandbox's `cwd` names — `resolveWorkspace` is the one place that knows
 * the difference, the same call `recordAudit`'s own caller makes. */
function auditRows(cwd: string): ReturnType<typeof readAudit> {
  return readAudit(resolveWorkspace(cwd).projectRoot!);
}

test('candidateItemIds finds an ALL-CAPS-prefix id and ignores ordinary prose', () => {
  const text = 'Read TASK-nothing-stops-a-subagent-being-dispatched-for-work-that-has first, ' +
    'then check the well-designed, read-only module and the subagent-driven plan.';
  assert.deepEqual(
    candidateItemIds(text),
    ['TASK-nothing-stops-a-subagent-being-dispatched-for-work-that-has'],
  );
});

test('candidateItemIds finds nothing in a prompt with no id-shaped token', () => {
  assert.deepEqual(candidateItemIds('Grep the repo for the well-known pattern and report back.'), []);
});

test('agentDenyMessage names what to do, whether or not a candidate was tried', () => {
  const empty = agentDenyMessage([]);
  assert.match(empty, /^my_context:/);
  assert.match(empty, /no-item: <reason>/);
  assert.match(empty, /Name the item/);

  const typo = agentDenyMessage(['TASK-mispelled-item']);
  assert.match(typo, /TASK-mispelled-item, which is not an id this corpus has/);
  assert.match(typo, /mycontext show <id>/);
});

test('the gate is off by default — an item-less dispatch is allowed, and nothing is recorded', () => {
  const cwd = sandbox();
  try {
    const out = runPreToolUse(agentInput(cwd, 's1', 'Go fix the thing, no ticket for it.'), cwd);
    assert.equal(out, '');
    assert.deepEqual(auditRows(cwd).filter((r) => r.op === 'deny' || r.op === 'agent-item-waived'), []);
  } finally { removeTree(cwd); }
});

test('enabled: a dispatch naming a real item is allowed', () => {
  const cwd = sandbox();
  try {
    configure(cwd, { dispatchGate: { enabled: true } });
    addItem(cwd, 'TASK-fix-the-thing', 'task', 'Fix the thing.');
    index(cwd);

    const out = runPreToolUse(
      agentInput(cwd, 's1', 'Work on TASK-fix-the-thing: fix the thing described there.'), cwd,
    );
    assert.equal(out, '');
    assert.deepEqual(auditRows(cwd).filter((r) => r.op === 'deny' || r.op === 'agent-item-waived'), []);
  } finally { removeTree(cwd); }
});

test('enabled: a dispatch naming no item is refused, with a useful message and an audit row', () => {
  const cwd = sandbox();
  try {
    configure(cwd, { dispatchGate: { enabled: true } });
    index(cwd);

    const out = runPreToolUse(agentInput(cwd, 's1', 'Go clean up the noisy logging in the CLI.'), cwd);
    const d = decision(out);
    assert.equal(d.permissionDecision, 'deny');
    assert.match(String(d.permissionDecisionReason), /^my_context:/);
    assert.match(String(d.permissionDecisionReason), /no-item: <reason>/);

    const denies = auditRows(cwd).filter((r) => r.op === 'deny' && r.hook === 'PreToolUse');
    assert.equal(denies.length, 1);
    assert.equal(denies[0].sessionId, 's1');
  } finally { removeTree(cwd); }
});

test('enabled: a real id that does not exist in the corpus is refused and named', () => {
  const cwd = sandbox();
  try {
    configure(cwd, { dispatchGate: { enabled: true } });
    index(cwd);

    const out = runPreToolUse(
      agentInput(cwd, 's1', 'Work on TASK-this-does-not-exist-anywhere-in-the-corpus.'), cwd,
    );
    const d = decision(out);
    assert.equal(d.permissionDecision, 'deny');
    assert.match(
      String(d.permissionDecisionReason), /TASK-this-does-not-exist-anywhere-in-the-corpus/,
    );
  } finally { removeTree(cwd); }
});

test('enabled: the escape hatch allows the dispatch and records the reason in the audit row', () => {
  const cwd = sandbox();
  try {
    configure(cwd, { dispatchGate: { enabled: true } });
    index(cwd);

    const out = runPreToolUse(
      agentInput(
        cwd, 's1',
        'Capture the payload from a live hook firing so we can see its real shape. ' +
        'no-item: measuring a hook payload for design work; no task governs this.',
      ),
      cwd,
    );
    assert.equal(out, '');

    const waived = auditRows(cwd).filter((r) => r.op === 'agent-item-waived');
    assert.equal(waived.length, 1);
    assert.equal(waived[0].hook, 'PreToolUse');
    assert.equal(waived[0].sessionId, 's1');
    assert.match(
      String(waived[0].note), /measuring a hook payload for design work; no task governs this\./,
    );
    // And nothing was ALSO recorded as a deny — the dispatch was allowed.
    assert.deepEqual(auditRows(cwd).filter((r) => r.op === 'deny'), []);
  } finally { removeTree(cwd); }
});

test('enabled: the escape hatch with no reason text is still refused', () => {
  const cwd = sandbox();
  try {
    configure(cwd, { dispatchGate: { enabled: true } });
    index(cwd);

    // `no-item:` with nothing after it is not a stated reason — the whole
    // point of the hatch is that the reason travels into the audit row, and
    // an empty one has nothing to travel.
    const out = runPreToolUse(agentInput(cwd, 's1', 'Do some work. no-item:'), cwd);
    assert.equal(decision(out).permissionDecision, 'deny');
    assert.deepEqual(auditRows(cwd).filter((r) => r.op === 'agent-item-waived'), []);
  } finally { removeTree(cwd); }
});

/**
 * `tool_input` present but empty is NOT a shape the gate fails to recognise
 * — a prompt-less dispatch really does name no item, and denying it is the
 * feature working, not a bug. The genuinely malformed case is the top-level
 * payload: not JSON at all, which never even reaches `input.tool_name`.
 */
test('enabled: a payload that is not JSON at all is allowed — it never reaches the gate', () => {
  const cwd = sandbox();
  try {
    configure(cwd, { dispatchGate: { enabled: true } });
    index(cwd);

    assert.equal(runPreToolUse('not json at all {{{', cwd), '');
    // Confirmed NOT a false allow: the same corpus, with `tool_input.prompt`
    // actually present and empty, IS refused — so the line above is really
    // exercising the fail-open path and not merely an empty prompt.
    const stillGated = runPreToolUse(agentInput(cwd, 's1', 'no id here'), cwd);
    assert.equal(decision(stillGated).permissionDecision, 'deny');
  } finally { removeTree(cwd); }
});

test('enabled: a config.json this build cannot parse fails the whole hook open', () => {
  const cwd = sandbox();
  try {
    configure(cwd, { dispatchGate: { enabled: true } });
    index(cwd);
    // `resolveWorkspace` throws on config.json that does not parse — the
    // same failure `buildJitOutput` already fails open on. The gate must
    // never turn a broken config into a refusal (INV-hooks-fail-open),
    // even though this very prompt would otherwise be denied.
    writeFileSync(path.join(cwd, '.my_context', 'config.json'), '{ not valid json');

    const out = runPreToolUse(agentInput(cwd, 's1', 'No item named here at all.'), cwd);
    assert.equal(out, '');
  } finally { removeTree(cwd); }
});

/**
 * A prompt with NO id-shaped candidate at all is deliberately NOT what these
 * two tests use: `corpusHasAny` short-circuits to `false` without opening
 * the index when there is nothing to check (`candidateItemIds` above
 * returns `[]`), so "no candidate" denies on the prompt text alone and
 * never touches the corpus either way — an unreadable index changes
 * nothing about that verdict, so it would prove nothing about fail-open.
 * The case that actually exercises `Store.openReadOnlyChecked` is a prompt
 * that DOES name a candidate, which is what forces the gate to ask the
 * index whether it is real.
 */
test('enabled: an index that was never built fails the whole hook open', () => {
  const cwd = sandbox();
  try {
    configure(cwd, { dispatchGate: { enabled: true } });
    // Deliberately no `index(cwd)`: `.index.db` does not exist, so
    // `Store.openReadOnlyChecked` throws rather than the gate reading a
    // corpus that isn't there.
    const out = runPreToolUse(
      agentInput(cwd, 's1', 'Work on TASK-plausible-but-unindexed-right-now.'), cwd,
    );
    assert.equal(out, '');
  } finally { removeTree(cwd); }
});

test('enabled: a corrupt index fails open rather than refusing the dispatch', () => {
  const cwd = sandbox();
  try {
    configure(cwd, { dispatchGate: { enabled: true } });
    index(cwd);
    // Corrupt the index the gate reads, in place — the same failure mode
    // `Store.openReadOnlyChecked` throws fast on. The gate must never turn
    // an unreadable corpus into a refusal (INV-hooks-fail-open).
    const dbPath = resolveWorkspace(cwd).dbPath;
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
    writeFileSync(dbPath, 'not a sqlite database');

    const out = runPreToolUse(
      agentInput(cwd, 's1', 'Work on TASK-plausible-but-the-index-is-corrupt.'), cwd,
    );
    assert.equal(out, '');
  } finally { removeTree(cwd); }
});

test('hooks.json widened the PreToolUse matcher to include Agent, and nothing else', () => {
  const config = JSON.parse(
    readFileSync(path.join(import.meta.dirname, '../../hooks/hooks.json'), 'utf8'),
  ) as { hooks: { PreToolUse: { matcher: string }[] } };
  const matcher = config.hooks.PreToolUse[0].matcher;
  const re = new RegExp(`^(?:${matcher})$`);
  for (const tool of ['Read', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'Agent']) {
    assert.ok(re.test(tool), `matcher lost ${tool}`);
  }
  assert.equal(re.test('Bash'), false, 'the owner reverted a Bash widening once; it must stay out');
  assert.equal(matcher.split('|').length, 6, `matcher gained an unexpected member: ${matcher}`);
});
