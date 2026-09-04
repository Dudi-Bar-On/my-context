/**
 * `mycontext config <name> --delete|--disable [--yes]` — `rulings/20` widened.
 *
 * The end-to-end layer over `core/config.ts`'s `deleteCustomCategory`/
 * `disableCategory`, which `test/core/config-category-write.test.ts` already
 * covers at the fs level. This file is the human boundary: the refusals a
 * reader actually sees, the item-count warning printed before the gate, and
 * that `--yes` is a REAL refusal — off a TTY, `mycontext config` behaves like
 * every other write in this CLI and refuses without it, which is what makes
 * it a genuine member of the derived approval boundary
 * (`test/helpers/approval-boundary.ts`) rather than a flag that is merely
 * accepted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

interface Box { cwd: string; run: (argv: string[]) => { code: number; text: string }; dispose(): void }

function workspace(): Box {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-config-cli-'));
  const run = (argv: string[]): { code: number; text: string } => {
    const lines: string[] = [];
    let code: number;
    try {
      code = runCli(argv, cwd, (s) => lines.push(s));
    } catch (err) {
      lines.push(`THREW: ${(err as Error).message}`);
      code = 1;
    }
    return { code, text: lines.join('\n') };
  };
  assert.equal(run(['init']).code, 0, 'the probe workspace did not initialize');
  return { cwd, run, dispose: () => removeTree(cwd) };
}

/** `.my_context/config.json` under a workspace, parsed. */
function configOf(box: Box): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(box.cwd, '.my_context', 'config.json'), 'utf8'));
}

/** Declares a custom category named `widget` directly in `config.json` — the
 * one thing no command in this CLI can do today, so the fixture is the same
 * hand-edit a real project's owner would make. */
function declareCustomCategory(box: Box): void {
  const file = path.join(box.cwd, '.my_context', 'config.json');
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  raw.categories = {
    ...raw.categories,
    widget: { tier: 'rationale', description: 'A team-invented category.' },
  };
  writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
}

test('config --delete on a custom category removes it and backs up first', () => {
  const box = workspace();
  try {
    declareCustomCategory(box);
    const before = readFileSync(path.join(box.cwd, '.my_context', 'config.json'), 'utf8');

    const result = box.run(['config', 'widget', '--delete', '--yes']);
    assert.equal(result.code, 0, result.text);
    assert.match(result.text, /deleted category "widget"/);
    assert.match(result.text, /copied to/);

    const cfg = configOf(box);
    assert.equal(Object.hasOwn(cfg.categories as object, 'widget'), false);

    // The backup path printed actually holds the prior bytes.
    const backupMatch = result.text.replace(/\s+/g, ' ').match(/copied to (\S+) before writing/);
    assert.ok(backupMatch, 'no backup path was printed');
    assert.equal(readFileSync(backupMatch![1], 'utf8'), before);
  } finally {
    box.dispose();
  }
});

test('config --delete on a shipped category is refused and names --disable', () => {
  const box = workspace();
  try {
    const result = box.run(['config', 'rule', '--delete', '--yes']);
    assert.equal(result.code, 1, result.text);
    assert.match(result.text, /can never be deleted/);
    assert.match(result.text, /--disable/);

    // Nothing changed.
    const cfg = configOf(box);
    assert.equal(Object.hasOwn(cfg.categories as object, 'rule'), false);
  } finally {
    box.dispose();
  }
});

test('config --disable on a shipped category writes enabled:false and backs up first', () => {
  const box = workspace();
  try {
    const before = readFileSync(path.join(box.cwd, '.my_context', 'config.json'), 'utf8');
    const result = box.run(['config', 'rule', '--disable', '--yes']);
    assert.equal(result.code, 0, result.text);
    assert.match(result.text, /disabled category "rule"/);

    const cfg = configOf(box);
    assert.equal((cfg.categories as Record<string, { enabled: boolean }>).rule.enabled, false);

    const backupMatch = result.text.replace(/\s+/g, ' ').match(/copied to (\S+) before writing/);
    assert.ok(backupMatch, 'no backup path was printed');
    assert.equal(readFileSync(backupMatch![1], 'utf8'), before);

    // The category still exists — it is shipped, not deleted — and a
    // subsequent status still recognises it.
    const status = box.run(['status']);
    assert.equal(status.code, 0, status.text);
  } finally {
    box.dispose();
  }
});

test('--yes is genuinely required: refused off a TTY, and nothing is written', () => {
  const box = workspace();
  try {
    const before = readFileSync(path.join(box.cwd, '.my_context', 'config.json'), 'utf8');
    const result = box.run(['config', 'rule', '--disable']);
    assert.equal(result.code, 1, result.text);
    assert.match(result.text, /refusing without confirmation/);
    assert.equal(
      readFileSync(path.join(box.cwd, '.my_context', 'config.json'), 'utf8'), before,
      'config.json changed despite no --yes',
    );
  } finally {
    box.dispose();
  }
});

test('the item-count warning names a real number, before the gate', () => {
  const box = workspace();
  try {
    assert.equal(
      box.run([
        'add', 'rule', 'Never log secrets', '--body', 'Secrets in logs outlive the incident.',
        '--summary', 'Never write a secret into a log line.', '--yes',
      ]).code,
      0,
    );
    assert.equal(
      box.run([
        'add', 'rule', 'Rotate tokens', '--body', 'Rotate tokens on a schedule.',
        '--summary', 'Rotate credentials before they can be reused if leaked.', '--yes',
      ]).code,
      0,
    );
    // No --yes: the command refuses at the gate, but the warning — printed
    // BEFORE the gate — must already show the real count.
    const result = box.run(['config', 'rule', '--disable']);
    assert.equal(result.code, 1);
    assert.match(result.text, /2 item\(s\) in this corpus already carry it/);
  } finally {
    box.dispose();
  }
});

test('the item-count warning says so when nothing carries the category yet', () => {
  const box = workspace();
  try {
    const result = box.run(['config', 'lesson', '--disable']);
    assert.match(result.text, /No item in this corpus carries it yet/);
  } finally {
    box.dispose();
  }
});

test('config --disable on an already-disabled category is a no-op and writes nothing', () => {
  const box = workspace();
  try {
    assert.equal(box.run(['config', 'rule', '--disable', '--yes']).code, 0);
    const afterFirst = readFileSync(path.join(box.cwd, '.my_context', 'config.json'), 'utf8');

    const result = box.run(['config', 'rule', '--disable', '--yes']);
    assert.equal(result.code, 0, result.text);
    assert.match(result.text, /already disabled/);
    assert.equal(
      readFileSync(path.join(box.cwd, '.my_context', 'config.json'), 'utf8'), afterFirst,
      'a no-op still touched the file',
    );
  } finally {
    box.dispose();
  }
});

test('config refuses an unknown category by name', () => {
  const box = workspace();
  try {
    const result = box.run(['config', 'not-a-real-category', '--disable', '--yes']);
    assert.equal(result.code, 1);
    assert.match(result.text, /must be one of/);
  } finally {
    box.dispose();
  }
});

test('config refuses --delete and --disable together', () => {
  const box = workspace();
  try {
    const result = box.run(['config', 'rule', '--delete', '--disable', '--yes']);
    assert.equal(result.code, 1);
    assert.match(result.text, /four different acts/);
  } finally {
    box.dispose();
  }
});

test('config appears on the derived approval boundary via the real --yes probe', async () => {
  const { gatedCommands } = await import('../helpers/approval-boundary.ts');
  const gated = gatedCommands();
  assert.ok(gated.has('config'), '"config" does not take --yes according to the real parser');
});
