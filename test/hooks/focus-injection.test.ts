/**
 * Focus where it actually reaches a session: the two injection paths, the
 * audit record beside each, and the one deny message focus made false.
 *
 * `test/core/select-focus.test.ts` proves the filter; this proves the wiring —
 * that the hooks read the focus at all, that the JIT path speaks when a focus
 * hid something even though nothing survived to inject, and that a broken focus
 * file costs the narrowing rather than the session.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readAudit } from '../../src/core/audit.ts';
import { focusPath } from '../../src/core/focus.ts';
import { buildInjection } from '../../src/core/inject.ts';
import { denyReason, runPreToolUse } from '../../src/hooks/pre-tool-use.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

interface Project { cwd: string; root: string; dispose(): void }

function project(): Project {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-focus-hook-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  const add = (args: string[]): void => { runCli(args, cwd, () => {}); };
  add(['add', '--summary-omitted', 'rule', 'Charge in integer cents', '--tags', 'billing', '--scope', 'src/api/**', '--yes']);
  add(['add', '--summary-omitted', 'rule', 'Rotate the session token hourly', '--tags', 'auth', '--scope', 'src/api/**', '--yes']);
  add(['add', '--summary-omitted', 'rule', 'Never log the customer email', '--tags', 'auth', '--scope', 'src/db/**', '--yes']);
  return { cwd, root: resolveWorkspace(cwd).projectRoot!, dispose: () => removeTree(cwd) };
}

function jit(cwd: string, file: string): string {
  return runPreToolUse(JSON.stringify({
    session_id: 'sess-focus', cwd, tool_name: 'Read', tool_input: { file_path: file },
  }), cwd);
}

test('a session start under a focus injects the narrowed set and discloses the rest', () => {
  const p = project();
  try {
    runCli(['focus', 'billing', '--yes'], p.cwd, () => {});
    const text = buildInjection(p.cwd, { event: 'session-start', sessionId: 'sess-a' });
    assert.match(text, /RULE-charge-in-integer-cents/);
    assert.doesNotMatch(text, /RULE-rotate-the-session-token-hourly/);
    assert.match(
      text,
      /_Focus is active \(tags: billing\)\. 2 item\(s\) hidden by focus, 0 load-bearing relations now dangling\./,
    );
  } finally { p.dispose(); }
});

test('the session-start audit record says the focus hid something, by count', () => {
  const p = project();
  try {
    runCli(['focus', 'billing', '--yes'], p.cwd, () => {});
    buildInjection(p.cwd, { event: 'session-start', source: 'startup', sessionId: 'sess-a' });
    const record = readAudit(p.root).find((r) => r.op === 'session-start');
    assert.equal(
      record?.note,
      'source=startup; focus hid 2, 0 load-bearing relation(s) dangling',
      'an injection record listing four items and nothing about the two a focus removed ' +
      'answers "what did this session see" with a true list and a false impression',
    );
  } finally { p.dispose(); }
});

test('a just-in-time injection under a focus counts only the items that apply to the file', () => {
  const p = project();
  try {
    runCli(['focus', 'billing', '--yes'], p.cwd, () => {});
    const out = jit(p.cwd, path.join(p.cwd, 'src', 'api', 'orders.ts'));
    assert.match(out, /RULE-charge-in-integer-cents/);
    assert.doesNotMatch(out, /RULE-rotate-the-session-token-hourly/);
    assert.match(out, /1 item\(s\) that apply to this file hidden by focus/);
    assert.doesNotMatch(
      out, /2 item\(s\)/,
      'the third rule is hidden by this focus too, but it is scoped to src/db and was never ' +
      'a candidate for this file — counting it would report a cost this event never paid',
    );
  } finally { p.dispose(); }
});

/**
 * The silence that would be a lie. With everything on this path hidden, an
 * empty hook output reads as "no rules apply to this file" — which is exactly
 * the false impression focus must never create.
 */
test('a tool call whose every matching item is hidden still says so', () => {
  const p = project();
  try {
    runCli(['focus', 'nothing-matches-this', '--yes'], p.cwd, () => {});
    const out = jit(p.cwd, path.join(p.cwd, 'src', 'api', 'orders.ts'));
    assert.notEqual(out, '', 'silence here reads as "no rules apply to this file"');
    assert.match(out, /2 item\(s\) that apply to this file hidden by focus/);
  } finally { p.dispose(); }
});

test('with no focus, neither path says anything about focus', () => {
  const p = project();
  try {
    const start = buildInjection(p.cwd, { event: 'session-start', sessionId: 'sess-a' });
    assert.notEqual(start, '');
    assert.equal(start.includes('Focus'), false);
    assert.equal(jit(p.cwd, path.join(p.cwd, 'src', 'api', 'orders.ts')).includes('Focus'), false);
  } finally { p.dispose(); }
});

/**
 * Fail open, and say so. Both halves: the injection is complete (the corrupt
 * focus hid nothing), and the note is there (so a wide injection is not read as
 * a focus that was simply wrong).
 */
test('a damaged focus file costs the narrowing, never the injection, and is disclosed', () => {
  const p = project();
  try {
    mkdirSync(path.join(p.root, 'state'), { recursive: true });
    writeFileSync(focusPath(p.root), '{{{', 'utf8');
    const text = buildInjection(p.cwd, { event: 'session-start', sessionId: 'sess-a' });
    assert.match(text, /RULE-charge-in-integer-cents/);
    assert.match(text, /RULE-rotate-the-session-token-hourly/);
    assert.match(text, /`\.my_context\/state\/focus\.json` is not valid JSON/);
    assert.match(text, /so NO focus is in effect and nothing is hidden/);
  } finally { p.dispose(); }
});

/**
 * The deny message that focus made false. Everything else under `state/` is
 * derived from the Markdown and a rebuild regenerates it; `focus.json` is
 * authored state that no rebuild reproduces, so the general arm's advice would
 * have told a reader to run a command that silently discards their focus.
 */
test('the write-deny for focus.json names the commands that do the job, not `rebuild`', () => {
  const p = project();
  try {
    const reason = denyReason(path.join(p.root, 'state', 'focus.json'))!;
    assert.match(reason, /is the session focus, and it decides what my_context injects/);
    assert.match(reason, /mycontext focus --show/);
    assert.equal(
      reason.includes('mycontext rebuild'), false,
      'no rebuild regenerates the focus, so advising one here would be false',
    );
    assert.match(
      denyReason(path.join(p.root, 'state', 'sess-1.restore.json'))!,
      /run `mycontext rebuild` to/,
      'the general state/ arm must keep its own, still-true advice',
    );
  } finally { p.dispose(); }
});
