/**
 * `TOP_LEVEL_KEYS` is the loader's ONE list of the keys a `config.json` may
 * carry, and it has to be readable without the loader.
 *
 * **The defect this ends.** It was module-private in `core/config.ts`, so the
 * Template packs read model (`ui/packs-model.ts`) — which draws the `pk.what`
 * table over exactly that domain — could not have it. It pinned a hand-typed
 * `CONFIG_KEYS` to `keyof Config` minus `skippedKeys` instead, and said so:
 * that is a PROXY for the loader's list and not the list itself. The proxy
 * catches one direction only. A `Config` field missing from the copy fails
 * `tsc`; a key added to `TOP_LEVEL_KEYS` that `Config` does not carry slips
 * past it silently, and the screen would then draw a table over four of the
 * loader's five keys — the silent drop arriving through a screen instead of
 * through a file.
 *
 * The list is exported now and the screen reads it. What is asserted here is
 * that it STAYS one list: the values, and that the screen has not grown a
 * second spelling back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TOP_LEVEL_KEYS } from '../../src/core/config.ts';

const SRC = path.resolve(import.meta.dirname, '../../src');

test('TOP_LEVEL_KEYS is exported, and is the six keys a config file may carry', () => {
  assert.deepEqual(
    [...TOP_LEVEL_KEYS], ['profile', 'categories', 'budgets', 'watchedDocs', 'ui', 'handover'],
    'the ONE list moved. Every surface that draws the config domain reads this.',
  );
});

test('the packs read model reads the loader list rather than a copy of it', () => {
  const text = readFileSync(path.join(SRC, 'ui', 'packs-model.ts'), 'utf8');
  assert.match(
    text, /import \{[^}]*\bTOP_LEVEL_KEYS\b[^}]*\} from '\.\.\/core\/config\.ts';/,
    'packs-model.ts does not import TOP_LEVEL_KEYS — the list was exported so that the ' +
    '`pk.what` table is drawn over the loader\'s own domain and not a proxy for it.',
  );
  assert.doesNotMatch(
    text, /^const CONFIG_KEYS\b/m,
    'packs-model.ts declared CONFIG_KEYS again. A key added to TOP_LEVEL_KEYS that `Config` ' +
    'does not carry slips past a `keyof Config` pin, which is why the copy was removed.',
  );
});
