import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../../src/core/config.ts';
import { parseItem } from '../../src/core/item.ts';
import { exampleItem } from '../../src/help/index.ts';

/**
 * `exampleItem` renders "a complete, correct item, exactly as it is stored".
 * Two of its dates were literals, so every `mycontext_examples` answer showed
 * the same fixed date no matter when it was asked — `valid_from` frozen at a
 * capture date `createItem` would never actually write, and an `assumption`
 * whose `validate_by` deadline drifts into the past and then illustrates
 * precisely the overdue state that field exists to warn about.
 *
 * The clock is MOCKED for the `valid_from` test rather than compared against
 * the real one, because the literal that was there (`2026-08-14`) is a real
 * date: on that one day a test against the real clock cannot tell the fix
 * from the bug. Under a mocked clock it can, on every day.
 */

const CONFIG = resolveConfig({});

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const DAY = 24 * 60 * 60 * 1000;

test('every example carries the day it was rendered as its valid_from', (t) => {
  // Deliberately not near any date literal that has ever been in this file.
  const now = Date.UTC(2031, 4, 17, 9, 0, 0);
  t.mock.timers.enable({ apis: ['Date'], now });

  for (const category of Object.values(CONFIG.categories)) {
    if (!category.enabled) continue;
    const item = parseItem(
      exampleItem(category.name, CONFIG), `items/${category.name}/x.md`, 'project',
    );
    assert.equal(item.validFrom, '2031-05-17', category.name);
  }
  mock.timers.reset();
});

/**
 * `validate_by` is evaluated when this module's seed table is built, i.e. at
 * process start, so a mocked clock cannot move it. The property asserted is
 * therefore the one that actually matters and that the old literal fails: the
 * deadline is roughly a year out, not a date a few months away that the
 * calendar will walk past. `2026-12-01` — the literal this replaced — is
 * inside 180 days of the date it was written, so it fails this on any day.
 */
test('the assumption example names a validate_by deadline roughly a year ahead', () => {
  const item = parseItem(exampleItem('assumption', CONFIG), 'items/assumption/x.md', 'project');
  const deadline = item.extra.validate_by;
  assert.ok(deadline, 'the assumption example still carries a validate_by');
  assert.ok(deadline > isoDay(Date.now() + 300 * DAY), `validate_by ${deadline} is too soon`);
  assert.ok(deadline < isoDay(Date.now() + 400 * DAY), `validate_by ${deadline} is implausibly far`);
});
