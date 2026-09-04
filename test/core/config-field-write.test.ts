/**
 * `setConfigField` / `unsetConfigListEntries` (core/config.ts) — `rulings/57`,
 * the field-level writer beside `deleteCustomCategory`/`disableCategory`
 * (`test/core/config-category-write.test.ts`, `rulings/20`). Same level: pure
 * fs functions against a throwaway `corpusDir` holding nothing but
 * `config.json`. The CLI wrapper — `mycontext config <path> --set|--unset
 * [--yes]`, its blast-radius line and its `--yes` refusal — is tested
 * separately in `test/cli/config-field.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  CategoryWriteRefusal, resolveConfig, setConfigField, unsetConfigListEntries,
} from '../../src/core/config.ts';
import { removeTree } from '../helpers/tmp.ts';

/** A throwaway directory holding only `config.json`, written with `initial`. */
function corpus(initial: unknown): { dir: string; file: string; dispose(): void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-config-field-'));
  const file = path.join(dir, 'config.json');
  writeFileSync(file, `${JSON.stringify(initial, null, 2)}\n`, 'utf8');
  return { dir, file, dispose: () => removeTree(dir) };
}

// ─── setConfigField ──────────────────────────────────────────────────────

test('setConfigField writes a top-level scalar under an object key and backs up first', () => {
  const box = corpus({ profile: 'standard', categories: {} });
  try {
    const before = readFileSync(box.file, 'utf8');
    const result = setConfigField(box.dir, 'dispatchGate.enabled', true);
    assert.equal(result.action, 'set');
    assert.equal(result.before, undefined);
    assert.equal(result.after, true);
    assert.equal(result.wrote, true);
    assert.ok(result.backupPath, 'no backup path was returned');
    assert.equal(readFileSync(result.backupPath!, 'utf8'), before);

    const after = JSON.parse(readFileSync(box.file, 'utf8'));
    assert.equal(after.dispatchGate.enabled, true);
    assert.equal(resolveConfig(after).dispatchGate.enabled, true);
  } finally {
    box.dispose();
  }
});

test('setConfigField creates the intermediate object when the section is absent', () => {
  const box = corpus({ profile: 'standard', categories: {} });
  try {
    setConfigField(box.dir, 'dispatchGate.enabled', true);
    const after = JSON.parse(readFileSync(box.file, 'utf8'));
    assert.deepEqual(after.dispatchGate, { enabled: true });
    // Everything else survives untouched.
    assert.equal(after.profile, 'standard');
    assert.deepEqual(after.categories, {});
  } finally {
    box.dispose();
  }
});

test('setConfigField on a category field merges into the existing entry', () => {
  const box = corpus({
    profile: 'standard',
    categories: { rule: { description: 'Overridden here.' } },
  });
  try {
    const result = setConfigField(box.dir, 'categories.rule.tier', 'normative');
    assert.equal(result.wrote, true);
    const after = JSON.parse(readFileSync(box.file, 'utf8'));
    assert.equal(after.categories.rule.tier, 'normative');
    assert.equal(after.categories.rule.description, 'Overridden here.', 'sibling key was dropped');
    assert.equal(resolveConfig(after).categories.rule.tier, 'normative');
  } finally {
    box.dispose();
  }
});

test('setConfigField refuses an unknown top-level key by name', () => {
  const box = corpus({ profile: 'standard', categories: {} });
  try {
    assert.throws(
      () => setConfigField(box.dir, 'bogus.setting', true),
      (err: unknown) => {
        assert.ok(err instanceof CategoryWriteRefusal);
        assert.match(err.message, /"bogus" is not a key this build's config\.json understands/);
        return true;
      },
    );
    const after = JSON.parse(readFileSync(box.file, 'utf8'));
    assert.equal(Object.hasOwn(after, 'bogus'), false, 'the unknown key was written anyway');
  } finally {
    box.dispose();
  }
});

test('setConfigField refuses a value of the wrong type, via resolveConfig, and writes nothing', () => {
  const box = corpus({ profile: 'standard', categories: {} });
  try {
    assert.throws(
      () => setConfigField(box.dir, 'dispatchGate.enabled', 1),
      (err: unknown) => {
        assert.ok(err instanceof CategoryWriteRefusal);
        assert.match(err.message, /dispatchGate\.enabled is 1/);
        assert.match(err.message, /Expected true or false/);
        return true;
      },
    );
    const after = JSON.parse(readFileSync(box.file, 'utf8'));
    assert.equal(Object.hasOwn(after, 'dispatchGate'), false);
  } finally {
    box.dispose();
  }
});

test('setConfigField refuses an unrecognised nested category key, via resolveConfig', () => {
  const box = corpus({ profile: 'standard', categories: {} });
  try {
    assert.throws(
      () => setConfigField(box.dir, 'categories.rule.bogus', 'x'),
      (err: unknown) => {
        assert.ok(err instanceof CategoryWriteRefusal);
        assert.match(err.message, /"bogus"/);
        return true;
      },
    );
  } finally {
    box.dispose();
  }
});

test('setConfigField refuses extraFields — it EXTENDS and --set cannot replace it', () => {
  const box = corpus({ profile: 'standard', categories: {} });
  try {
    assert.throws(
      () => setConfigField(box.dir, 'categories.task.extraFields', ['owner']),
      (err: unknown) => {
        assert.ok(err instanceof CategoryWriteRefusal);
        assert.match(err.message, /EXTENDS the catalogue/);
        assert.match(err.message, /--unset/);
        return true;
      },
    );
  } finally {
    box.dispose();
  }
});

test('setConfigField refuses updates — no command-line writer for it today', () => {
  const box = corpus({ profile: 'standard', categories: {} });
  try {
    assert.throws(
      () => setConfigField(box.dir, 'categories.task.updates', {}),
      (err: unknown) => {
        assert.ok(err instanceof CategoryWriteRefusal);
        assert.match(err.message, /nested object/);
        return true;
      },
    );
  } finally {
    box.dispose();
  }
});

test('setConfigField refuses a dangerous path segment outright', () => {
  const box = corpus({ profile: 'standard', categories: {} });
  try {
    for (const bad of ['__proto__.polluted', 'categories.__proto__.tier', 'constructor.name']) {
      assert.throws(() => setConfigField(box.dir, bad, 'x'), CategoryWriteRefusal);
    }
    // The prototype itself was never reached.
    assert.equal((Object.prototype as unknown as { polluted?: unknown }).polluted, undefined);
  } finally {
    box.dispose();
  }
});

test('setConfigField is a no-op, reported rather than written, when the value already matches', () => {
  const box = corpus({ profile: 'standard', categories: {}, dispatchGate: { enabled: true } });
  try {
    const before = readFileSync(box.file, 'utf8');
    const result = setConfigField(box.dir, 'dispatchGate.enabled', true);
    assert.equal(result.wrote, false);
    assert.equal(result.backupPath, null);
    assert.equal(readFileSync(box.file, 'utf8'), before, 'a no-op still touched the file');
  } finally {
    box.dispose();
  }
});

test('setConfigField with dryRun validates and reports but never touches disk', () => {
  const box = corpus({ profile: 'standard', categories: {} });
  try {
    const before = readFileSync(box.file, 'utf8');
    const result = setConfigField(box.dir, 'dispatchGate.enabled', true, { dryRun: true });
    assert.equal(result.wrote, true);
    assert.equal(result.backupPath, null);
    assert.equal(readFileSync(box.file, 'utf8'), before, 'a dry run wrote to disk');
  } finally {
    box.dispose();
  }
});

// ─── unsetConfigListEntries ──────────────────────────────────────────────

const TASK_WITH_RETIRED_FIELDS = {
  profile: 'standard',
  categories: {
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work.',
      extraFields: [
        'plan', 'seq', 'state', 'progress', 'source', 'last_change', 'priority', 'needs',
      ],
    },
  },
};

test('unsetConfigListEntries removes named entries and backs up first', () => {
  const box = corpus(TASK_WITH_RETIRED_FIELDS);
  try {
    const before = readFileSync(box.file, 'utf8');
    const result = unsetConfigListEntries(
      box.dir, 'categories.task.extraFields', ['progress', 'last_change'],
    );
    assert.equal(result.action, 'unset');
    assert.equal(result.wrote, true);
    assert.ok(result.backupPath);
    assert.equal(readFileSync(result.backupPath!, 'utf8'), before);

    const after = JSON.parse(readFileSync(box.file, 'utf8'));
    assert.deepEqual(
      after.categories.task.extraFields,
      ['plan', 'seq', 'state', 'source', 'priority', 'needs'],
    );
    // Every sibling key on the category entry survives.
    assert.equal(after.categories.task.tier, 'rationale');
    assert.equal(after.categories.task.prefix, 'TASK');
  } finally {
    box.dispose();
  }
});

test('unsetConfigListEntries removing the last entry leaves an explicit [], not an absent key', () => {
  const box = corpus({
    profile: 'standard',
    categories: {},
    watchedDocs: ['docs/only-one/**'],
  });
  try {
    const result = unsetConfigListEntries(box.dir, 'watchedDocs', ['docs/only-one/**']);
    assert.equal(result.wrote, true);
    assert.deepEqual(result.after, []);
    const after = JSON.parse(readFileSync(box.file, 'utf8'));
    assert.equal(Object.hasOwn(after, 'watchedDocs'), true, 'the key was deleted instead of emptied');
    assert.deepEqual(after.watchedDocs, []);
    // The ruling matters observably here: absent resolves to the three
    // shipped defaults, [] resolves to "watch nothing" — different facts.
    assert.deepEqual(resolveConfig(after).watchedDocs, []);
    assert.notDeepEqual(resolveConfig({ profile: 'standard' }).watchedDocs, []);
  } finally {
    box.dispose();
  }
});

test('unsetConfigListEntries refuses a value that is not currently in the list', () => {
  const box = corpus(TASK_WITH_RETIRED_FIELDS);
  try {
    assert.throws(
      () => unsetConfigListEntries(box.dir, 'categories.task.extraFields', ['nonesuch']),
      (err: unknown) => {
        assert.ok(err instanceof CategoryWriteRefusal);
        assert.match(err.message, /does not carry "nonesuch"/);
        return true;
      },
    );
    // Nothing was written, not even the values that WERE present.
    const after = JSON.parse(readFileSync(box.file, 'utf8'));
    assert.deepEqual(after.categories.task.extraFields, TASK_WITH_RETIRED_FIELDS.categories.task.extraFields);
  } finally {
    box.dispose();
  }
});

test('unsetConfigListEntries refuses when the path is not declared at all', () => {
  const box = corpus({ profile: 'standard', categories: {} });
  try {
    assert.throws(
      () => unsetConfigListEntries(box.dir, 'categories.task.extraFields', ['progress']),
      (err: unknown) => {
        assert.ok(err instanceof CategoryWriteRefusal);
        assert.match(err.message, /does not declare "categories\.task\.extraFields"/);
        return true;
      },
    );
  } finally {
    box.dispose();
  }
});

test('unsetConfigListEntries refuses a path that is not a list', () => {
  const box = corpus({ profile: 'standard', categories: { rule: { description: 'x' } } });
  try {
    assert.throws(
      () => unsetConfigListEntries(box.dir, 'categories.rule.description', ['x']),
      (err: unknown) => {
        assert.ok(err instanceof CategoryWriteRefusal);
        assert.match(err.message, /not a list of strings/);
        return true;
      },
    );
  } finally {
    box.dispose();
  }
});

test('unsetConfigListEntries with dryRun validates and reports but never touches disk', () => {
  const box = corpus(TASK_WITH_RETIRED_FIELDS);
  try {
    const before = readFileSync(box.file, 'utf8');
    const result = unsetConfigListEntries(
      box.dir, 'categories.task.extraFields', ['progress'], { dryRun: true },
    );
    assert.equal(result.wrote, true);
    assert.equal(result.backupPath, null);
    assert.deepEqual(
      result.after,
      ['plan', 'seq', 'state', 'source', 'last_change', 'priority', 'needs'],
    );
    assert.equal(readFileSync(box.file, 'utf8'), before, 'a dry run wrote to disk');
  } finally {
    box.dispose();
  }
});

test('a config.json that no longer parses is refused rather than overwritten by either writer', () => {
  const box = corpus({ profile: 'standard', categories: {} });
  try {
    writeFileSync(box.file, '{ not valid json', 'utf8');
    assert.throws(() => setConfigField(box.dir, 'dispatchGate.enabled', true), CategoryWriteRefusal);
    assert.throws(
      () => unsetConfigListEntries(box.dir, 'categories.task.extraFields', ['progress']),
      CategoryWriteRefusal,
    );
    assert.equal(readFileSync(box.file, 'utf8'), '{ not valid json');
  } finally {
    box.dispose();
  }
});
