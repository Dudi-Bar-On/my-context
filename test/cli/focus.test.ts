/**
 * `mycontext focus`, over a real workspace.
 *
 * The cases that matter most are the ones where a plausible implementation
 * would be silently wrong: a preview that writes, a `--clear` that also sets, a
 * report that disagrees with what the next injection would actually do, and a
 * `severity: hard` item that a narrowing removes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readAudit } from '../../src/core/audit.ts';
import { focusPath, readFocus } from '../../src/core/focus.ts';
import { buildInjection } from '../../src/core/inject.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

interface Project { cwd: string; root: string; dispose(): void }

function project(): Project {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-focus-cli-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  return { cwd, root: resolveWorkspace(cwd).projectRoot!, dispose: () => removeTree(cwd) };
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += `${s}\n`; });
  return { code, out };
}

/** Two soft rules on different tags, plus one hard invariant on neither. */
function seed(cwd: string): void {
  run(['add', 'rule', 'Charge in integer cents', '--tags', 'billing', '--yes'], cwd);
  run(['add', 'rule', 'Rotate the session token hourly', '--tags', 'auth', '--yes'], cwd);
  run(['add', 'invariant', 'Hooks fail open', '--tags', 'hooks', '--severity', 'hard', '--yes'], cwd);
}

test('with no focus set, the command says so rather than printing an empty report', () => {
  const p = project();
  try {
    const { code, out } = run(['focus'], p.cwd);
    assert.equal(code, 0);
    assert.match(out, /^my_context: no focus is set — every eligible item is injectable\.$/m);
  } finally {
    p.dispose();
  }
});

test('setting a focus writes it, reports what it hides, and audits the change', () => {
  const p = project();
  try {
    seed(p.cwd);
    const { code, out } = run(['focus', 'billing'], p.cwd);
    assert.equal(code, 0);
    assert.match(out, /^focus: tags: billing$/m);
    assert.match(out, /hidden by focus/);
    assert.match(out, /RULE-rotate-the-session-token-hourly/);
    assert.equal(readFocus(p.root).focus?.tags[0], 'billing');

    const records = readAudit(p.root).filter((r) => r.kind === 'focus');
    assert.deepEqual(records.map((r) => [r.op, r.origin, r.note]), [
      ['focus-set', 'human', 'tags: billing'],
    ]);
  } finally {
    p.dispose();
  }
});

/**
 * The hard exemption, through the command a user actually runs — and the
 * negative half beside it, because a build in which focus hid nothing at all
 * would satisfy "the invariant is still visible" perfectly.
 */
test('a severity:hard item survives a focus that excludes it, and the soft one does not', () => {
  const p = project();
  try {
    seed(p.cwd);
    const { out } = run(['focus', 'billing'], p.cwd);
    assert.match(out, /severity:hard item\(s\) do not match this focus and are injected anyway/);
    assert.match(out, /^ {2}INV-hooks-fail-open$/m);
    const hiddenSection = out.slice(out.indexOf('hidden by focus'), out.indexOf('0 load-bearing'));
    assert.match(hiddenSection, /RULE-rotate-the-session-token-hourly/);
    assert.doesNotMatch(hiddenSection, /INV-hooks-fail-open/);
  } finally {
    p.dispose();
  }
});

/**
 * **The preview and the injection are the same computation.** This is the
 * assertion that would fail the moment a second predicate appeared: it takes
 * the ids the preview called hidden and checks that a real injection, built by
 * `buildInjection` through the hook path, contains none of them.
 */
test('what the preview says is hidden is what the next injection actually omits', () => {
  const p = project();
  try {
    seed(p.cwd);
    run(['focus', 'billing'], p.cwd);
    const injected = buildInjection(p.cwd, { event: 'session-start', sessionId: 'sess-focus' });
    assert.match(injected, /RULE-charge-in-integer-cents/);
    assert.doesNotMatch(injected, /RULE-rotate-the-session-token-hourly/);
    assert.match(injected, /_Focus is active \(tags: billing\)\. 1 item\(s\) hidden by focus/);
  } finally {
    p.dispose();
  }
});

test('--preview reports and writes nothing at all', () => {
  const p = project();
  try {
    seed(p.cwd);
    const { code, out } = run(['focus', 'billing', '--preview'], p.cwd);
    assert.equal(code, 0);
    assert.match(out, /^my_context: preview only — nothing was changed\.$/m);
    assert.match(out, /^Apply it by running the same command without --preview\.$/m);
    assert.equal(existsSync(focusPath(p.root)), false);
    assert.deepEqual(readAudit(p.root).filter((r) => r.kind === 'focus'), []);
  } finally {
    p.dispose();
  }
});

test('--clear removes the focus and records it; clearing nothing says so and records nothing', () => {
  const p = project();
  try {
    seed(p.cwd);
    assert.match(run(['focus', '--clear'], p.cwd).out, /there was no focus to clear/);
    assert.deepEqual(readAudit(p.root).filter((r) => r.kind === 'focus'), []);

    run(['focus', 'billing'], p.cwd);
    const { code, out } = run(['focus', '--clear'], p.cwd);
    assert.equal(code, 0);
    assert.match(out, /focus cleared\. Every eligible item is injectable again\./);
    assert.equal(existsSync(focusPath(p.root)), false);
    assert.deepEqual(
      readAudit(p.root).filter((r) => r.kind === 'focus').map((r) => r.op),
      ['focus-set', 'focus-clear'],
    );
  } finally {
    p.dispose();
  }
});

/**
 * Refused, not resolved. "Clear then set" and "clear, ignoring the tag" are
 * both readings of `--clear --tag x`, and honouring either drops an instruction
 * the caller typed — the failure this project keeps finding.
 */
test('--clear alongside axes is refused, and changes nothing', () => {
  const p = project();
  try {
    seed(p.cwd);
    run(['focus', 'billing'], p.cwd);
    const { code, out } = run(['focus', 'auth', '--clear'], p.cwd);
    assert.equal(code, 1);
    assert.match(out, /--clear takes no axes/);
    assert.equal(readFocus(p.root).focus?.tags[0], 'billing', 'the existing focus must survive a refusal');
  } finally {
    p.dispose();
  }
});

test('a damaged focus file is reported by the command and exits 1', () => {
  const p = project();
  try {
    mkdirSync(path.join(p.root, 'state'), { recursive: true });
    writeFileSync(focusPath(p.root), 'not json at all', 'utf8');
    const { code, out } = run(['focus'], p.cwd);
    assert.equal(code, 1);
    assert.match(out, /so NO focus is in effect and nothing is hidden/);
  } finally {
    p.dispose();
  }
});

test('--relations prints the classification, both classes and the default', () => {
  const p = project();
  try {
    const { code, out } = run(['focus', '--relations'], p.cwd);
    assert.equal(code, 0);
    assert.match(out, /^ {2}blocks {2,}load-bearing$/m);
    assert.match(out, /^ {2}derived_from {2,}referential$/m);
    assert.match(out, /An unlisted relation type counts as load-bearing\./);
  } finally {
    p.dispose();
  }
});

test('--json returns the report as data, including every hidden id', () => {
  const p = project();
  try {
    seed(p.cwd);
    const { out } = run(['focus', 'billing', '--json'], p.cwd);
    const report = JSON.parse(out) as { hidden: string[]; exemptHard: string[]; universe: string };
    assert.deepEqual(report.hidden, ['RULE-rotate-the-session-token-hourly']);
    assert.deepEqual(report.exemptHard, ['INV-hooks-fail-open']);
    assert.equal(report.universe, 'corpus');
  } finally {
    p.dispose();
  }
});

test('an unknown flag is refused with the usage, not accepted and ignored', () => {
  const p = project();
  try {
    const { code, out } = run(['focus', '--domain', 'billing'], p.cwd);
    assert.equal(code, 1);
    assert.match(out, /unknown option "--domain"/);
  } finally {
    p.dispose();
  }
});

/**
 * Focus changes injection and nothing else. A "narrowing" that also narrowed
 * `list` would be a corpus filter wearing a focus's name, and the item a user
 * hid from a session would become one they could no longer find.
 */
test('a hidden item is still listed, shown and searchable', () => {
  const p = project();
  try {
    seed(p.cwd);
    run(['focus', 'billing'], p.cwd);
    assert.match(run(['list'], p.cwd).out, /RULE-rotate-the-session-token-hourly/);
    assert.match(run(['show', 'RULE-rotate-the-session-token-hourly'], p.cwd).out, /Rotate the session token/);
    assert.match(run(['search', '--tag', 'auth'], p.cwd).out, /RULE-rotate-the-session-token-hourly/);
  } finally {
    p.dispose();
  }
});
