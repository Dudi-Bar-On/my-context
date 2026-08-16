/**
 * `focus_context` — the tool that lets the model narrow its own context.
 *
 * That is a real hazard and the tool exists anyway, so the tests that matter
 * are the three things that answer the hazard: a `severity: hard` item cannot
 * be hidden by it, the change is audited as an AGENT's, and calling it with no
 * arguments reports rather than changing anything.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readAudit } from '../../src/core/audit.ts';
import { focusPath, readFocus } from '../../src/core/focus.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

interface Project { cwd: string; root: string; dispose(): void }

function project(): Project {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-focus-tool-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  const add = (args: string[]): void => { runCli(args, cwd, () => {}); };
  add(['add', 'rule', 'Charge in integer cents', '--tags', 'billing', '--yes']);
  add(['add', 'rule', 'Rotate the session token hourly', '--tags', 'auth', '--yes']);
  add(['add', 'invariant', 'Hooks fail open', '--tags', 'hooks', '--severity', 'hard', '--yes']);
  return { cwd, root: resolveWorkspace(cwd).projectRoot!, dispose: () => removeTree(cwd) };
}

test('no arguments reports the focus in effect and changes nothing', () => {
  const p = project();
  try {
    const text = createRegistry(p.cwd).call('focus_context', {});
    assert.match(text, /no focus is set — every eligible item is injectable/);
    assert.equal(existsSync(focusPath(p.root)), false);
    assert.deepEqual(readAudit(p.root).filter((r) => r.kind === 'focus'), []);
  } finally { p.dispose(); }
});

test('setting a focus from the tool records it as the AGENT narrowing, not the user', () => {
  const p = project();
  try {
    const text = createRegistry(p.cwd).call('focus_context', { tags: ['billing'] });
    assert.match(text, /focus set\./);
    assert.match(text, /severity:hard items stay visible regardless/);
    assert.equal(readFocus(p.root).focus?.setBy, 'agent');
    assert.deepEqual(
      readAudit(p.root).filter((r) => r.kind === 'focus').map((r) => [r.op, r.origin]),
      [['focus-set', 'agent']],
      'without the origin, a model narrowing its own context is indistinguishable in the ' +
      'log from the user doing it',
    );
  } finally { p.dispose(); }
});

/**
 * The guarantee that makes the tool safe to offer: the predicate is in
 * `select`, not in this handler, so no argument reaches it that could turn the
 * exemption off. The negative half beside it — the soft rule IS hidden —
 * because a build where the tool did nothing would satisfy the first half.
 */
test('the tool cannot hide a severity:hard item, whatever it is asked for', () => {
  const p = project();
  try {
    const text = createRegistry(p.cwd).call('focus_context', { tags: ['billing'] });
    assert.match(text, /^ {2}RULE-rotate-the-session-token-hourly$/m);
    assert.match(text, /severity:hard item\(s\) do not match this focus and are injected anyway/);
    assert.match(text, /^ {2}INV-hooks-fail-open$/m);
  } finally { p.dispose(); }
});

test('preview reports the cost and writes nothing', () => {
  const p = project();
  try {
    const text = createRegistry(p.cwd).call('focus_context', { tags: ['billing'], preview: true });
    assert.match(text, /preview only — nothing was changed\./);
    assert.equal(existsSync(focusPath(p.root)), false);
  } finally { p.dispose(); }
});

test('clear removes the focus; clear alongside axes is refused and changes nothing', () => {
  const p = project();
  try {
    const registry = createRegistry(p.cwd);
    registry.call('focus_context', { tags: ['billing'] });
    assert.throws(
      () => registry.call('focus_context', { tags: ['auth'], clear: true }),
      /takes either "clear" or the axes, never both/,
    );
    assert.equal(readFocus(p.root).focus?.tags[0], 'billing');
    assert.match(registry.call('focus_context', { clear: true }), /focus cleared/);
    assert.equal(existsSync(focusPath(p.root)), false);
  } finally { p.dispose(); }
});

test('an argument the tool cannot act on is refused rather than accepted and dropped', () => {
  const p = project();
  try {
    assert.throws(
      () => createRegistry(p.cwd).call('focus_context', { domains: ['billing'] }),
      /focus_context does not take "domains"/,
    );
    assert.equal(existsSync(focusPath(p.root)), false);
  } finally { p.dispose(); }
});

test('a bare string where a list belongs is corrected, not coerced', () => {
  const p = project();
  try {
    assert.throws(
      () => createRegistry(p.cwd).call('focus_context', { tags: 'billing' }),
      /"tags" must be an array of strings/,
    );
  } finally { p.dispose(); }
});
