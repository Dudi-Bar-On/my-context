/**
 * `deleteCustomCategory` / `disableCategory` (core/config.ts) — the writer
 * behind `rulings/20` widened: "a config writer with DELETE (custom
 * categories only — shipped ones are never deletable), DISABLE for shipped
 * ones, --yes for Execute, backup-before-write, and an item-count warning
 * before a change touching many items."
 *
 * This file tests the two pure-fs functions directly, against a throwaway
 * `corpusDir` holding nothing but a `config.json` — the shape
 * `budgets-write.ts`'s own tests use, and the right level for what these two
 * functions actually do: read `config.json` fresh, transform it, verify the
 * result still resolves, and write a byte-for-byte backup before the real
 * write. The CLI wrapper (`mycontext config <name> --delete|--disable`) and
 * its confirmation gate, its item-count warning and its `--yes` refusal are
 * tested separately in `test/cli/config.test.ts` — this file is the layer
 * under it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  CategoryWriteRefusal, deleteCustomCategory, disableCategory, resolveConfig,
} from '../../src/core/config.ts';
import { CATEGORIES } from '../../src/core/categories.ts';
import { removeTree } from '../helpers/tmp.ts';

/** A throwaway directory holding only `config.json`, written with `initial`. */
function corpus(initial: unknown): { dir: string; file: string; dispose(): void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-config-write-'));
  const file = path.join(dir, 'config.json');
  writeFileSync(file, `${JSON.stringify(initial, null, 2)}\n`, 'utf8');
  return { dir, file, dispose: () => removeTree(dir) };
}

const CUSTOM = {
  profile: 'standard',
  categories: {
    widget: { tier: 'rationale', description: 'A team-invented category.' },
  },
};

test('deleting a custom category removes its declaration and resolves clean', () => {
  const box = corpus(CUSTOM);
  try {
    const before = readFileSync(box.file, 'utf8');
    const result = deleteCustomCategory(box.dir, 'widget');
    assert.equal(result.action, 'delete');
    assert.equal(result.category, 'widget');
    assert.equal(result.wrote, true);
    assert.ok(result.backupPath, 'no backup path was returned');

    const after = JSON.parse(readFileSync(box.file, 'utf8'));
    assert.equal(Object.hasOwn(after.categories, 'widget'), false, 'the category is still declared');
    // Everything else survives untouched.
    assert.equal(after.profile, 'standard');

    const resolved = resolveConfig(after);
    assert.equal(Object.hasOwn(resolved.categories, 'widget'), false);

    // The backup holds the PRIOR bytes, verbatim.
    assert.equal(readFileSync(result.backupPath!, 'utf8'), before);
  } finally {
    box.dispose();
  }
});

test('deleting a shipped category is refused and names --disable', () => {
  const box = corpus({ profile: 'standard', categories: {} });
  try {
    assert.throws(
      () => deleteCustomCategory(box.dir, 'rule'),
      (err: unknown) => {
        assert.ok(err instanceof CategoryWriteRefusal);
        assert.match(err.message, /never.*deleted|can never be deleted/i);
        assert.match(err.message, /--disable/);
        return true;
      },
    );
    // Nothing was written.
    const after = JSON.parse(readFileSync(box.file, 'utf8'));
    assert.deepEqual(after.categories, {});
  } finally {
    box.dispose();
  }
});

test('deleting a shipped category is refused even when config overrides it', () => {
  const box = corpus({
    profile: 'standard',
    categories: { rule: { description: 'Overridden here.' } },
  });
  try {
    assert.throws(() => deleteCustomCategory(box.dir, 'rule'), CategoryWriteRefusal);
    const after = JSON.parse(readFileSync(box.file, 'utf8'));
    assert.equal(after.categories.rule.description, 'Overridden here.', 'the override was touched');
  } finally {
    box.dispose();
  }
});

test('deleting a category config does not declare is refused — nothing to delete', () => {
  const box = corpus({ profile: 'standard', categories: {} });
  try {
    assert.throws(
      () => deleteCustomCategory(box.dir, 'widget'),
      (err: unknown) => {
        assert.ok(err instanceof CategoryWriteRefusal);
        assert.match(err.message, /nothing to delete/i);
        return true;
      },
    );
  } finally {
    box.dispose();
  }
});

test('disabling a shipped category writes a fresh override and backs up first', () => {
  const box = corpus({ profile: 'standard', categories: {} });
  try {
    const before = readFileSync(box.file, 'utf8');
    const result = disableCategory(box.dir, 'rule');
    assert.equal(result.action, 'disable');
    assert.equal(result.wrote, true);
    assert.ok(result.backupPath);
    assert.equal(readFileSync(result.backupPath!, 'utf8'), before);

    const after = JSON.parse(readFileSync(box.file, 'utf8'));
    assert.equal(after.categories.rule.enabled, false);

    const resolved = resolveConfig(after);
    assert.equal(resolved.categories.rule.enabled, false);
    // The category still exists — it is SHIPPED, not deleted.
    assert.ok(Object.hasOwn(CATEGORIES, 'rule'));
  } finally {
    box.dispose();
  }
});

test('disabling a custom category merges enabled:false into its existing entry', () => {
  const box = corpus(CUSTOM);
  try {
    const result = disableCategory(box.dir, 'widget');
    assert.equal(result.wrote, true);
    const after = JSON.parse(readFileSync(box.file, 'utf8'));
    assert.equal(after.categories.widget.enabled, false);
    // The rest of the declaration this category needs to exist at all is kept.
    assert.equal(after.categories.widget.tier, 'rationale');
    assert.equal(after.categories.widget.description, 'A team-invented category.');
  } finally {
    box.dispose();
  }
});

test('disabling an already-disabled category is a no-op and writes nothing', () => {
  const box = corpus({
    profile: 'standard',
    categories: { rule: { enabled: false } },
  });
  try {
    const before = readFileSync(box.file, 'utf8');
    const result = disableCategory(box.dir, 'rule');
    assert.equal(result.wrote, false);
    assert.equal(result.backupPath, null);
    assert.equal(readFileSync(box.file, 'utf8'), before, 'the file changed on a no-op');
  } finally {
    box.dispose();
  }
});

test('disabling an unknown category — not shipped, not declared — is refused', () => {
  const box = corpus({ profile: 'standard', categories: {} });
  try {
    assert.throws(() => disableCategory(box.dir, 'nonesuch'), CategoryWriteRefusal);
    const after = JSON.parse(readFileSync(box.file, 'utf8'));
    assert.deepEqual(after.categories, {});
  } finally {
    box.dispose();
  }
});

/**
 * **A malformed result is refused rather than written.** Both writers read
 * `config.json` FRESH off disk rather than trusting a caller's already-loaded
 * `Config` — so a file that stopped parsing between the moment a workspace
 * loaded it and the moment this runs (hand-edited, or corrupted by another
 * process) is caught here, before anything is written, rather than producing
 * a `config.json` this build can no longer load.
 */
test('a config.json that no longer parses is refused rather than overwritten', () => {
  const box = corpus({ profile: 'standard', categories: {} });
  try {
    writeFileSync(box.file, '{ not valid json', 'utf8');
    assert.throws(
      () => deleteCustomCategory(box.dir, 'widget'),
      (err: unknown) => {
        assert.ok(err instanceof CategoryWriteRefusal);
        assert.match(err.message, /not valid JSON/);
        return true;
      },
    );
    assert.throws(() => disableCategory(box.dir, 'rule'), CategoryWriteRefusal);
    // Untouched — still the garbage that was there.
    assert.equal(readFileSync(box.file, 'utf8'), '{ not valid json');
  } finally {
    box.dispose();
  }
});

test('a "categories" key that is not an object is refused rather than silently replaced', () => {
  const box = corpus({ profile: 'standard', categories: [] });
  try {
    assert.throws(() => disableCategory(box.dir, 'rule'), CategoryWriteRefusal);
    const after = JSON.parse(readFileSync(box.file, 'utf8'));
    assert.deepEqual(after.categories, [], 'the malformed value was overwritten instead of refused');
  } finally {
    box.dispose();
  }
});
