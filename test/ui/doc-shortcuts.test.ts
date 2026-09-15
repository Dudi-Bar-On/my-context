// @basis TASK-a-reader-deep-in-a-document-cannot-reach-any-control-so,
// CONST-node-24-no-build-step,
// RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **THE KEYBOARD ROUTE'S TABLE, CHECKED WHERE A BROWSER CANNOT HELP.**
 *
 * `TASK-a-reader-deep-in-a-document-cannot-reach-any-control-so` adds a second
 * and a third way to every action on a conversation document. `DOC_SHORTCUTS`
 * is the whole of what the keyboard route means, and three of its properties
 * are facts about the TABLE rather than about a rendered page — which is why
 * they are asserted here and not in `e2e/doc-actions.spec.ts`, where the
 * behaviour they produce is driven.
 *
 *   1. **NO TWO ACTIONS SHARE A BINDING.** This is the one that cannot be
 *      caught in a browser without knowing to look: a collision does not throw
 *      and does not draw anything — one of the two actions simply never fires,
 *      because `find` returns the first match, and nothing on the screen says
 *      which one lost. A reader would report "Next mark sometimes does the
 *      wrong thing", which is the least debuggable shape a defect can take.
 *   2. **EVERY BINDING IS BY `code`, NOT BY `key`.** Half this archive is
 *      Hebrew. On a Hebrew layout the key printed `M` reports `key: 'צ'`, so a
 *      table that fell back to `key` for even one entry would bind that action
 *      for a Latin keyboard and silently unbind it for the reader the product
 *      is actually for. The property is structural, so it is asserted
 *      structurally.
 *   3. **ESCAPE IS NOT TAKEN.** The item is explicit — `confirm/5` bound it on
 *      the rename box and `app.js` binds it on the item pane, and *"a third
 *      Escape meaning is not available. Do not take it."* A gate is what makes
 *      that survive the next person who wants a convenient key.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT CLAIM ────────────────────────────────
 *
 * Nothing here presses a key. A table with no collision can still be wired to
 * nothing, be swallowed inside a field, or fire on a screen it does not belong
 * to — and all three of those are measured in a real browser by
 * `e2e/doc-actions.spec.ts`, because all three are properties of a live focus
 * model and a mounted document rather than of this array.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');

// The screens import their siblings by absolute browser paths (`/lib/…`),
// which Node cannot resolve on its own. The same hook, for the same reason and
// with the same one-line rule, as `test/ui/anchor-kind-vocabulary.test.ts`.
registerHooks({
  resolve: (specifier, context, nextResolve) => {
    if (specifier.startsWith('/')) {
      return { url: pathToFileURL(path.join(PUBLIC, specifier)).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

interface Binding { action: string; code: string; shift: boolean; show: string }

const browserModule = async <T>(...segments: string[]): Promise<T> =>
  (await import(pathToFileURL(path.join(PUBLIC, ...segments)).href)) as T;

const bindings = async (): Promise<Binding[]> =>
  (await browserModule<{ DOC_SHORTCUTS: Binding[] }>(
    'screens', 'conversations.js')).DOC_SHORTCUTS;

const table = async (language: 'en' | 'he'): Promise<Record<string, string>> =>
  (await browserModule<{ strings: Record<string, string> }>(
    'strings', `${language}.js`)).strings;

test('no two actions answer to the same keystroke', async () => {
  const shortcuts = await bindings();
  // A table that emptied would make every assertion in this file vacuous, and
  // an empty table is also a real regression: it is the keyboard route gone.
  assert.ok(shortcuts.length >= 5,
    `only ${shortcuts.length} binding(s); the item names the search box, the row's write and `
    + 'the four navigation jumps, so a collapse here is the route having been removed');
  const seen = new Map<string, string>();
  const clashes: string[] = [];
  for (const binding of shortcuts) {
    const stroke = `${binding.shift ? 'Shift+' : ''}${binding.code}`;
    const held = seen.get(stroke);
    if (held !== undefined) clashes.push(`${stroke}: ${held} and ${binding.action}`);
    seen.set(stroke, binding.action);
  }
  assert.deepEqual(clashes, [],
    'two actions share one keystroke. Nothing draws, nothing throws and one of them simply '
    + 'never fires — the screen cannot say which, and neither can the reader.');
});

test('every binding is a physical key, so a Hebrew layout keeps the shortcuts', async () => {
  const shortcuts = await bindings();
  // `KeyboardEvent.code` values for the keys this screen may use. A `key`
  // value ('m', 'n', '/') would not match, which is the whole point: the
  // pattern is what says "this is a position on the keyboard, not a letter".
  const physical = /^(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Slash|Period|Comma|Backslash|BracketLeft|BracketRight|Semicolon|Quote|Backquote|Minus|Equal)$/;
  const wrong = shortcuts.filter((b) => !physical.test(b.code))
    .map((b) => `${b.action}: ${b.code}`);
  assert.deepEqual(wrong, [],
    'a binding is not a KeyboardEvent.code. A table keyed on the CHARACTER binds these for a '
    + 'Latin keyboard and unbinds every one of them on the Hebrew layout half this archive is '
    + 'written on.');
});

test('Escape is not taken — it already means two things on this screen', async () => {
  const shortcuts = await bindings();
  const taken = shortcuts.filter((b) => b.code === 'Escape' || b.show.includes('Esc'))
    .map((b) => b.action);
  assert.deepEqual(taken, [],
    'Escape closes the rename box (confirm/5, with stopPropagation) and closes the item pane '
    + '(app.js). The item rules a third meaning unavailable, and this is the gate on that.');
});

test('every binding says what the reader should press', async () => {
  const shortcuts = await bindings();
  const silent = shortcuts.filter((b) => typeof b.show !== 'string' || b.show.trim() === '')
    .map((b) => b.action);
  assert.deepEqual(silent, [],
    'a binding with nothing to show cannot be drawn on the button it belongs to, and a '
    + 'keyboard route nobody can discover is the same defect as a right-click-only action — '
    + 'which is the item\'s own closing sentence.');
  // `shortcutOn` renders `show` through `conv.keys.on`, so a binding that
  // exists with no sentence to carry it is a control with a blank title.
  for (const language of ['en', 'he'] as const) {
    const strings = await table(language);
    assert.ok(typeof strings['conv.keys.on'] === 'string' && strings['conv.keys.on'] !== '',
      `conv.keys.on is missing from the ${language} table, so every shortcut title is blank `
      + 'in that language — or throws, because t() throws on a key it does not hold');
  }
});

test('a shift binding is a shift of a binding that exists, never a lone one', async () => {
  const shortcuts = await bindings();
  const codes = new Set(shortcuts.filter((b) => !b.shift).map((b) => b.code));
  const orphans = shortcuts.filter((b) => b.shift && !codes.has(b.code))
    .map((b) => `${b.action} (${b.show})`);
  assert.deepEqual(orphans, [],
    'a Shift binding whose unshifted key does nothing is a shortcut nobody discovers: the pair '
    + 'is how a reader who has learnt "N goes forward" guesses that Shift+N goes back.');
});
