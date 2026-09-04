/**
 * `mycontext config <path> --set <value>` / `--unset <value>[,...] [--yes]` —
 * `rulings/57`, the FIELD-level writer beside `mycontext config <name>
 * --delete|--disable` (`test/cli/config.test.ts`, `rulings/20`). Same shape:
 * this file is the end-to-end / human-boundary layer over `core/config.ts`'s
 * `setConfigField`/`unsetConfigListEntries`, which `test/core/config-field-
 * write.test.ts` already covers at the fs level.
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
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-config-field-cli-'));
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

function configOf(box: Box): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(box.cwd, '.my_context', 'config.json'), 'utf8'));
}

/** Declares `task`, in full, carrying the two retired extra fields — the same
 * fixture the "closing" task (`rulings/57`) describes every real corpus as
 * holding. */
function declareTaskWithRetiredFields(box: Box): void {
  const file = path.join(box.cwd, '.my_context', 'config.json');
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  raw.categories = {
    ...raw.categories,
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work.',
      extraFields: ['plan', 'seq', 'state', 'progress', 'last_change', 'priority', 'needs'],
    },
  };
  writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
}

test('config --set writes a boolean and backs up first', () => {
  const box = workspace();
  try {
    const before = readFileSync(path.join(box.cwd, '.my_context', 'config.json'), 'utf8');
    const result = box.run(['config', 'dispatchGate.enabled', '--set', 'true', '--yes']);
    assert.equal(result.code, 0, result.text);
    assert.match(result.text, /set "dispatchGate\.enabled" in config\.json/);
    assert.match(result.text, /copied to/);

    const cfg = configOf(box);
    assert.equal((cfg.dispatchGate as { enabled: boolean }).enabled, true);

    const backupMatch = result.text.replace(/\s+/g, ' ').match(/copied to (\S+) before writing/);
    assert.ok(backupMatch, 'no backup path was printed');
    assert.equal(readFileSync(backupMatch![1], 'utf8'), before);
  } finally {
    box.dispose();
  }
});

test('config --unset removes several entries from a list in one write', () => {
  const box = workspace();
  try {
    declareTaskWithRetiredFields(box);
    const before = readFileSync(path.join(box.cwd, '.my_context', 'config.json'), 'utf8');
    const result = box.run([
      'config', 'categories.task.extraFields', '--unset', 'progress,last_change', '--yes',
    ]);
    assert.equal(result.code, 0, result.text);
    assert.match(result.text, /updated "categories\.task\.extraFields" in config\.json/);
    assert.match(result.text, /copied to/);

    const cfg = configOf(box);
    const fields = (cfg.categories as Record<string, { extraFields: string[] }>).task.extraFields;
    assert.deepEqual(fields, ['plan', 'seq', 'state', 'priority', 'needs']);

    const backupMatch = result.text.replace(/\s+/g, ' ').match(/copied to (\S+) before writing/);
    assert.ok(backupMatch, 'no backup path was printed');
    assert.equal(readFileSync(backupMatch![1], 'utf8'), before);
  } finally {
    box.dispose();
  }
});

test('config --set is refused off a TTY without --yes, and nothing is written', () => {
  const box = workspace();
  try {
    const before = readFileSync(path.join(box.cwd, '.my_context', 'config.json'), 'utf8');
    const result = box.run(['config', 'dispatchGate.enabled', '--set', 'true']);
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

test('config --set refuses an unrecognised path before the gate, printing the field values', () => {
  const box = workspace();
  try {
    const result = box.run(['config', 'bogus.setting', '--set', 'true']);
    assert.equal(result.code, 1);
    assert.match(result.text, /"bogus" is not a key this build's config\.json understands/);
    // No confirmation was even asked for — nothing else in the output.
    assert.doesNotMatch(result.text, /refusing without confirmation/);
  } finally {
    box.dispose();
  }
});

test('config --set refuses a value of the wrong type before the gate', () => {
  const box = workspace();
  try {
    const result = box.run(['config', 'dispatchGate.enabled', '--set', '1']);
    assert.equal(result.code, 1);
    assert.match(result.text, /dispatchGate\.enabled is 1/);
    assert.match(result.text, /Expected true or false/);
  } finally {
    box.dispose();
  }
});

test('config --unset refuses a value not currently in the list', () => {
  const box = workspace();
  try {
    declareTaskWithRetiredFields(box);
    const result = box.run(['config', 'categories.task.extraFields', '--unset', 'nonesuch', '--yes']);
    assert.equal(result.code, 1, result.text);
    assert.match(result.text, /does not carry "nonesuch"/);
  } finally {
    box.dispose();
  }
});

test('config --set on extraFields is refused and points at --unset', () => {
  const box = workspace();
  try {
    const result = box.run(['config', 'categories.task.extraFields', '--set', '["owner"]', '--yes']);
    assert.equal(result.code, 1);
    assert.match(result.text, /EXTENDS the catalogue/);
    assert.match(result.text, /--unset/);
  } finally {
    box.dispose();
  }
});

test('the item-count warning is printed for a categories.<name>.* path, before the gate', () => {
  const box = workspace();
  try {
    assert.equal(
      box.run([
        'add', 'rule', 'Never log secrets', '--body', 'Secrets in logs outlive the incident.',
        '--summary', 'Never write a secret into a log line.', '--yes',
      ]).code,
      0,
    );
    const result = box.run(['config', 'categories.rule.tier', '--set', 'normative']);
    assert.equal(result.code, 1, result.text);
    assert.match(
      result.text.replace(/\s+/g, ' '), /1 item\(s\) in this corpus already carry this category/,
    );
  } finally {
    box.dispose();
  }
});

test('a non-category path prints no item count and names that it touches no item on disk', () => {
  const box = workspace();
  try {
    const result = box.run(['config', 'dispatchGate.enabled', '--set', 'true']);
    assert.equal(result.code, 1, result.text);
    assert.match(
      result.text.replace(/\s+/g, ' '), /does not touch any item already on disk/,
    );
  } finally {
    box.dispose();
  }
});

test('config --set is a no-op, reported rather than written, when the value already matches', () => {
  const box = workspace();
  try {
    assert.equal(box.run(['config', 'dispatchGate.enabled', '--set', 'true', '--yes']).code, 0);
    const afterFirst = readFileSync(path.join(box.cwd, '.my_context', 'config.json'), 'utf8');

    const result = box.run(['config', 'dispatchGate.enabled', '--set', 'true', '--yes']);
    assert.equal(result.code, 0, result.text);
    assert.match(result.text, /already is true/);
    assert.equal(
      readFileSync(path.join(box.cwd, '.my_context', 'config.json'), 'utf8'), afterFirst,
      'a no-op still touched the file',
    );
  } finally {
    box.dispose();
  }
});

test('config refuses --set and --disable together', () => {
  const box = workspace();
  try {
    const result = box.run(['config', 'rule', '--disable', '--set', 'true', '--yes']);
    assert.equal(result.code, 1);
    assert.match(result.text, /four different acts/);
  } finally {
    box.dispose();
  }
});

test('config --unset with no values is refused rather than a no-op', () => {
  const box = workspace();
  try {
    const result = box.run(['config', 'categories.task.extraFields', '--unset', '', '--yes']);
    assert.equal(result.code, 1);
    assert.match(result.text, /needs at least one value/);
  } finally {
    box.dispose();
  }
});

test('config needs one of the four acts', () => {
  const box = workspace();
  try {
    const result = box.run(['config', 'rule']);
    assert.equal(result.code, 1);
    assert.match(result.text, /needs --delete, --disable, --set or --unset/);
  } finally {
    box.dispose();
  }
});
