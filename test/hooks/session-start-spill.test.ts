/**
 * **SessionStart says out loud when `always: true` was not honoured.**
 *
 * The measurement this file exists for, taken on this repository's own corpus
 * (`REQ-a-pinned-item-is-delivered-or-the-user-is-told-it-was-not`): 23 pinned
 * items costing ~17,237 estimated tokens against a `pinned` budget of 16,000;
 * the newest SessionStart injection delivered 16; SEVEN never arrived, and
 * nothing on any surface said so. Among the seven were the instruction to use
 * my_context for everything the assistant needs to remember, the instruction to
 * display the task item before and after work, and the instruction that the
 * mockup is the UI specification. **The corpus spilled the rules that would have
 * told the assistant it was not following the rules, and reported success.**
 *
 * **Stderr, and stderr alone.** The disclosure's reader is the USER — they are
 * the only one who can raise the budget — and Claude Code surfaces a hook's
 * stderr to them. It is deliberately NOT in the injected block: telling the
 * model "you are missing seven rules" spends the very budget that is short, and
 * a model cannot act on it. `noWorkspaceLine` is the precedent and the tone.
 *
 * **The IDS, never a count.** "7 spilled" is not actionable; "these seven" is.
 *
 * The binary is spawned rather than the function called, because the channel is
 * half the requirement: a line composed correctly and written nowhere is the
 * same silence this closes.
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

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-spill-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  return cwd;
}

function pin(cwd: string, id: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: constraint
title: ${id}
status: active
severity: hard
always: true
---

# ${id}

Body text for ${id}, long enough to cost a measurable number of tokens.
`);
}

function setPinnedBudget(cwd: string, value: number): void {
  const file = path.join(cwd, '.my_context', 'config.json');
  const config = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  config.budgets = { ...(config.budgets as Record<string, number> ?? {}), pinned: value };
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}

function run(cwd: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', HOOK],
    { input: JSON.stringify({ session_id: 's-spill', source: 'startup', cwd }), encoding: 'utf8' },
  );
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** The stderr lines this hook wrote, dropping the trailing empty split. */
function lines(stderr: string): string[] {
  return stderr.split('\n').filter((l) => l !== '');
}

test('a partial pinned delivery is disclosed on stderr, by id, on ONE line', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  pin(cwd, 'CONST-alpha');
  pin(cwd, 'CONST-beta');
  pin(cwd, 'CONST-gamma');
  // Partial, not total: some arrive, some do not. This is the case that reads
  // as a kept promise while being a broken one, and the case the disclosure
  // must not be allowed to skip — see the mutation note at the foot of this file.
  // Each fixture item costs ~32 estimated tokens, so 70 admits two and spills one.
  setPinnedBudget(cwd, 70);

  const result = run(cwd);

  assert.equal(result.status, 0, 'INV-hooks-fail-open: a disclosure never fails a session start');
  assert.ok(result.stdout.length > 0, 'the fixture must still deliver something');

  const spillLines = lines(result.stderr).filter((l) => /pinned/.test(l));
  assert.equal(spillLines.length, 1, `ONE line, got ${JSON.stringify(lines(result.stderr))}`);
  const line = spillLines[0];

  // The ids, because a count is not actionable.
  const named = ['CONST-alpha', 'CONST-beta', 'CONST-gamma'].filter((id) => line.includes(id));
  const delivered = ['CONST-alpha', 'CONST-beta', 'CONST-gamma']
    .filter((id) => result.stdout.includes(`### ${id}`));
  assert.ok(delivered.length > 0 && delivered.length < 3,
    `fixture must be partial; delivered ${JSON.stringify(delivered)}`);
  assert.deepEqual(named.sort(), ['CONST-alpha', 'CONST-beta', 'CONST-gamma']
    .filter((id) => !delivered.includes(id)).sort());

  // The numbers, because the next question a reader has is "by how much".
  assert.match(line, /budget of 70/, 'the line must state the budget it was measured against');
  const cost = Number(/(\d+) estimated tokens/.exec(line)?.[1] ?? '0');
  assert.ok(cost > 70,
    `the tier cost must be stated and must exceed the budget; line was ${JSON.stringify(line)}`);

  // Stderr only. Telling the model it is short spends the budget that is short.
  assert.equal(/CONST-alpha, CONST-beta/.test(result.stdout), false);
});

test('a pinned tier that fits says nothing — a routine line is a line nobody reads', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  pin(cwd, 'CONST-alpha');
  const result = run(cwd);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /CONST-alpha/);
  assert.deepEqual(lines(result.stderr).filter((l) => /pinned/.test(l)), []);
});

/**
 * **The mutation this case catches.** Make the disclosure fire only when the
 * WHOLE pinned tier spills — `ids.length === candidates` rather than
 * `ids.length > 0` — and the test above goes red while this one stays green. It
 * is here so the pair reads as deliberate: a total spill is disclosed by the
 * SAME rule as a partial one, and neither is the special case.
 */
test('a total pinned spill is disclosed too, and by the same rule', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  pin(cwd, 'CONST-alpha');
  pin(cwd, 'CONST-beta');
  setPinnedBudget(cwd, 1);

  const result = run(cwd);
  assert.equal(result.status, 0);
  const spillLines = lines(result.stderr).filter((l) => /pinned/.test(l));
  assert.equal(spillLines.length, 1);
  assert.match(spillLines[0], /CONST-alpha/);
  assert.match(spillLines[0], /CONST-beta/);
});
