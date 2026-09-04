/**
 * The hook half of the audit log: that the four hook events are recorded, that
 * an injection records SCOPE and never content, and that a failure to record
 * never costs the hook's real job.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { auditLogPath, readAudit, type AuditRecord } from '../../src/core/audit.ts';
import { runCli } from '../../src/cli/index.ts';
import { buildInjection } from '../../src/core/inject.ts';
import { buildRestoreSnapshot } from '../../src/hooks/pre-compact.ts';
import { nudgeFor } from '../../src/hooks/post-tool-use.ts';
import { runPreToolUse } from '../../src/hooks/pre-tool-use.ts';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const SECRET = 'The pool must never exceed twenty connections under any circumstances.';

interface Project { cwd: string; root: string; dispose(): void }

function project(): Project {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-audit-hook-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  runCli([
    'add', '--summary-omitted', 'constraint', 'Postgres pool capped at twenty',
    '--body', SECRET, '--scope', 'src/db/**', '--yes',
  ], cwd, () => {});
  runCli([
    'add', '--summary-omitted', 'rule', 'Always pinned rule',
    '--body', 'Do the thing everywhere.', '--yes',
  ], cwd, () => {});
  const root = resolveWorkspace(cwd).projectRoot!;
  return { cwd, root, dispose: () => removeTree(cwd) };
}

function ops(root: string, kind: AuditRecord['kind']): AuditRecord[] {
  return readAudit(root).filter((r) => r.kind === kind);
}

test('SessionStart records what it delivered, by id and tier, and no injected text', () => {
  const p = project();
  try {
    const text = buildSessionStartOutput(p.cwd, { source: 'startup', sessionId: 'sess-1' });
    assert.notEqual(text, '', 'nothing was injected, so this case proves nothing');

    const record = ops(p.root, 'injection').find((r) => r.op === 'session-start');
    assert.ok(record, 'SessionStart recorded no injection');
    assert.equal(record.sessionId, 'sess-1');
    assert.equal(record.hook, 'SessionStart');
    // Both fixture items are governing categories (`constraint`, `rule`) and
    // neither is `always`, so both reach this session as a title only —
    // `TASK-a-governing-item-degraded-to-an-index-line-looks-delivered`'s
    // count follows `source=` in the same note.
    assert.equal(record.note, 'source=startup; 2 governing item(s) not delivered in full, 2 title-only');
    assert.ok((record.injected ?? []).length > 0);
    for (const entry of record.injected ?? []) {
      assert.ok(entry.id, 'an injected entry with no id');
      assert.ok(entry.tier, 'an injected entry with no tier');
    }
    // The estimate the budget was charged, frozen at injection time — see
    // AuditRecord.tokens. Something was delivered, so it must be positive.
    assert.ok(
      Number.isInteger(record.tokens) && record.tokens! > 0,
      `the injection record carries tokens=${String(record.tokens)}; it must record the ` +
      `positive integer estimate the selection charged its budgets`,
    );

    // The whole point of "scope, not content".
    const raw = readFileSync(path.join(p.root, '.audit', 'audit.jsonl'), 'utf8');
    assert.equal(
      raw.includes(SECRET), false,
      'the injected body reached the audit log — it records scope, never content',
    );
  } finally { p.dispose(); }
});

test('a just-in-time injection records the path, the ids and the tier', () => {
  const p = project();
  try {
    const target = path.join(p.cwd, 'src', 'db', 'writer.ts');
    const out = runPreToolUse(JSON.stringify({
      session_id: 'sess-2', cwd: p.cwd, tool_name: 'Read', tool_input: { file_path: target },
    }), p.cwd);
    assert.match(out, /additionalContext/, 'nothing was injected, so this case proves nothing');

    const record = ops(p.root, 'injection').find((r) => r.op === 'jit');
    assert.ok(record, 'the JIT hook recorded no injection');
    assert.equal(record.sessionId, 'sess-2');
    assert.equal(record.hook, 'PreToolUse');
    assert.equal(record.path, 'src/db/writer.ts');
    assert.ok((record.injected ?? []).some((e) => e.tier === 'jit'));
    assert.ok(
      Number.isInteger(record.tokens) && record.tokens! > 0,
      `the JIT record carries tokens=${String(record.tokens)}; it must record the positive ` +
      `integer estimate the selection charged its budgets`,
    );
    assert.equal(readFileSync(path.join(p.root, '.audit', 'audit.jsonl'), 'utf8').includes(SECRET), false);
  } finally { p.dispose(); }
});

test('a write into .my_context is denied AND recorded — the hook action that changes a call', () => {
  const p = project();
  try {
    const target = path.join(p.cwd, '.my_context', 'items', 'rule', 'RULE-forged.md');
    const out = runPreToolUse(JSON.stringify({
      session_id: 'sess-3', cwd: p.cwd, tool_name: 'Write', tool_input: { file_path: target },
    }), p.cwd);
    assert.match(out, /"permissionDecision":"deny"/, 'the deny was lost');

    const record = ops(p.root, 'hook').find((r) => r.op === 'deny');
    assert.ok(record, 'the deny was not recorded');
    assert.equal(record.sessionId, 'sess-3');
    assert.equal(record.path, 'items/rule/RULE-forged.md');
    assert.match(record.note ?? '', /Write/);
  } finally { p.dispose(); }
});

test('a PreCompact snapshot records what it captured, and says where it came from', () => {
  const p = project();
  try {
    // A JIT injection first, so the seen-file arm has something to contribute.
    runPreToolUse(JSON.stringify({
      session_id: 'sess-4', cwd: p.cwd, tool_name: 'Read',
      tool_input: { file_path: path.join(p.cwd, 'src', 'db', 'writer.ts') },
    }), p.cwd);

    const snapshot = buildRestoreSnapshot({ session_id: 'sess-4', cwd: p.cwd }, p.cwd);
    assert.ok(snapshot, 'no snapshot was written');

    const record = ops(p.root, 'hook').find((r) => r.op === 'pre-compact');
    assert.ok(record, 'PreCompact recorded nothing');
    assert.equal(record.sessionId, 'sess-4');
    assert.deepEqual(
      (record.injected ?? []).map((e) => e.id).sort(), [...snapshot.itemIds].sort(),
    );
    // `snapshot`, not a delivery tier: nothing was put in front of the model
    // here, and `ledgerRows` must not replay it as if something had been.
    for (const entry of record.injected ?? []) assert.equal(entry.tier, 'snapshot');
    assert.match(record.note ?? '', /from the seen file/);
  } finally { p.dispose(); }
});

test('a PostToolUse nudge is recorded only when it actually fires', () => {
  const p = project();
  try {
    // A path the DEFAULT `watchedDocs` globs name — `docs/prd/**`. Using a
    // path the defaults do not cover would make the second half of this case
    // pass for the wrong reason: the nudge would not fire, and "no record"
    // would prove nothing about whether firing records.
    const watched = path.join(p.cwd, 'docs', 'prd');
    mkdirSync(watched, { recursive: true });
    writeFileSync(path.join(watched, 'spec.md'), '# A watched document\n', 'utf8');

    // An edit to a file `watchedDocs` does not name: the hook declines, and
    // declining is its normal state — recording it would be most of the log.
    assert.equal(
      nudgeFor({
        tool_name: 'Write', cwd: p.cwd, session_id: 'sess-5',
        tool_input: { file_path: path.join(p.cwd, 'src', 'app.ts') },
      }, p.cwd),
      '',
    );
    assert.equal(ops(p.root, 'hook').filter((r) => r.op === 'post-tool-use').length, 0);

    const nudge = nudgeFor({
      tool_name: 'Write', cwd: p.cwd, session_id: 'sess-5',
      tool_input: { file_path: path.join(watched, 'spec.md') },
    }, p.cwd);
    assert.match(nudge, /capture it now/, 'the nudge did not fire, so this case proves nothing');

    const record = ops(p.root, 'hook').find((r) => r.op === 'post-tool-use');
    assert.ok(record, 'the nudge was not recorded');
    assert.equal(record.sessionId, 'sess-5');
    assert.equal(record.path, 'docs/prd/spec.md');
  } finally { p.dispose(); }
});

test('a manual load_context is recorded without a session id, and says so by omission', () => {
  const p = project();
  try {
    const text = buildInjection(p.cwd, { event: 'manual' });
    assert.notEqual(text, '');

    const record = ops(p.root, 'injection').find((r) => r.op === 'manual');
    assert.ok(record, 'the manual injection was not recorded');
    // The MCP server has no trustworthy session id — see `buildInjection`.
    // Recording a made-up one would put rows in the log that no restore or
    // replay could ever match.
    assert.equal(record.sessionId, undefined);
    assert.equal(record.hook, undefined);
  } finally { p.dispose(); }
});

/**
 * **Fail open, and prove it rather than asserting it.**
 *
 * `INV-hooks-fail-open`: a hook that breaks a session is worse than one that
 * says nothing. `recordAudit` never throws, but "never throws" is a property of
 * code that can regress, so the hook is run against a workspace where the audit
 * log cannot be written at all.
 */
test('a hook still does its job when the audit log cannot be written', () => {
  const p = project();
  try {
    // A DIRECTORY where `audit.jsonl` must be, so every `appendFileSync` for
    // it fails with EISDIR. `.audit/` itself already exists by now — the setup
    // captured two items through it — so breaking the directory is not
    // available and would not be the interesting failure anyway.
    // The setup already captured two items, so the real log file exists and is
    // removed first. `.audit/` itself is left intact, so the failure under
    // test is the WRITE and not a missing workspace.
    rmSync(auditLogPath(p.root), { force: true });
    mkdirSync(auditLogPath(p.root), { recursive: true });

    const target = path.join(p.cwd, 'src', 'db', 'writer.ts');
    const out = runPreToolUse(JSON.stringify({
      session_id: 'sess-6', cwd: p.cwd, tool_name: 'Read', tool_input: { file_path: target },
    }), p.cwd);
    assert.match(out, /additionalContext/, 'the injection was lost to a failed audit write');

    assert.match(
      buildSessionStartOutput(p.cwd, { source: 'startup', sessionId: 'sess-6' }),
      /my_context/,
      'the session-start injection was lost to a failed audit write',
    );

    const denied = runPreToolUse(JSON.stringify({
      session_id: 'sess-6', cwd: p.cwd, tool_name: 'Write',
      tool_input: { file_path: path.join(p.cwd, '.my_context', 'items', 'x.md') },
    }), p.cwd);
    assert.match(denied, /"permissionDecision":"deny"/, 'the deny was lost to a failed audit write');
  } finally { p.dispose(); }
});

/**
 * The other half of that trade, stated where it can be checked: a MUTATION
 * whose audit record fails DOES tell the caller, because there is someone to
 * tell. A hook's stdout is the model's context and a warning about log I/O
 * does not belong there; a mutation's return value is read by a human or an
 * agent that just asked for the write.
 */
test('a mutation whose audit record fails says so in the message it returns', () => {
  const p = project();
  try {
    // The setup already captured two items, so the real log file exists and is
    // removed first. `.audit/` itself is left intact, so the failure under
    // test is the WRITE and not a missing workspace.
    rmSync(auditLogPath(p.root), { force: true });
    mkdirSync(auditLogPath(p.root), { recursive: true });

    let out = '';
    const code = runCli(
      ['add', '--summary-omitted', 'lesson', 'A lesson captured with a broken audit log', '--yes'],
      p.cwd, (s) => { out += `${s}\n`; },
    );
    assert.equal(code, 0, 'the capture itself must still succeed');
    assert.match(out, /LESSON-/, 'the item was not created');
    assert.match(
      out, /audit record could NOT be written/,
      'the mutation succeeded with no audit record and said nothing about it',
    );
  } finally { p.dispose(); }
});
