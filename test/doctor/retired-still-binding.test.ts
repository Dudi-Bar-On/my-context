// @basis TASK-retiring-an-item-also-stands-it-down-it-stops-being-pinned, INV-nothing-is-dropped-silently

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRetiredStillBinding } from '../../src/doctor/checks.ts';
import { STOOD_DOWN_STATUSES } from '../../src/core/select.ts';
import type { Item } from '../../src/core/types.ts';

/**
 * TASK-retiring-an-item-also-stands-it-down-it-stops-being-pinned: `supersedeItem`
 * now stands an item down in the same act that retires it, but that is
 * PROSPECTIVE. This check is the other half — the items retired before it
 * existed, which nothing else on any surface would name. Measured on this
 * repository's own corpus the day it was written: seven items, eight fields.
 *
 * The `validated` cases here are the recorded ruling, not incidental coverage:
 * `validated` is in `RETIRED_STATUSES` and is deliberately NOT in
 * `STOOD_DOWN_STATUSES`, because a human affirming an item must not make its
 * severity read as bookkeeping debt. If somebody widens the set, these two
 * assertions are what says the question was already answered.
 */

function base(over: Partial<Item> & { id: string; type: string }): Item {
  return {
    title: over.id, status: 'active', severity: 'soft', always: false,
    continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {},
    scope: [], tags: [], origin: 'human', sourceFile: null, sourceAnchor: null,
    sourceChecksum: null, validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'Body.', steps: [], observations: [], relations: [], layer: 'project',
    filePath: `items/${over.type}/${over.id}.md`,
    ...over,
  };
}

test('a retired item carrying neither field draws nothing', () => {
  const item = base({ id: 'RULE-a', type: 'rule', status: 'superseded' });
  assert.deepEqual(checkRetiredStillBinding([item]), []);
});

test('a LIVE item carrying both fields draws nothing — this check is about retirement', () => {
  const item = base({ id: 'RULE-a', type: 'rule', always: true, severity: 'hard' });
  assert.deepEqual(checkRetiredStillBinding([item]), []);
});

test('a superseded item still pinned is reported, at warn, naming the field', () => {
  const item = base({ id: 'RULE-a', type: 'rule', status: 'superseded', always: true });
  const findings = checkRetiredStillBinding([item]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, 'warn');
  assert.equal(findings[0].code, 'retired_still_binding');
  assert.equal(findings[0].item, 'RULE-a');
  assert.match(findings[0].message, /always: true/);
  // The severity half is NOT claimed — the item is `soft` and a finding that
  // named it would send a person to change a field that is already right.
  assert.doesNotMatch(findings[0].message, /severity/);
});

test('a deprecated item still hard is reported, and the pin is not claimed', () => {
  const item = base({ id: 'KNOWN-a', type: 'known_issue', status: 'deprecated', severity: 'hard' });
  const findings = checkRetiredStillBinding([item]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, 'retired_still_binding');
  assert.match(findings[0].message, /severity: "hard"/);
  assert.doesNotMatch(findings[0].message, /always/);
});

test('an item carrying both draws ONE finding that names both', () => {
  const item = base({
    id: 'RULE-a', type: 'rule', status: 'superseded', always: true, severity: 'hard',
  });
  const findings = checkRetiredStillBinding([item]);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /always: true/);
  assert.match(findings[0].message, /severity: "hard"/);
});

/**
 * The remedy is composed per item, so the command cannot set a field the item
 * does not carry — the reason `standDownFields` returns a list and not a
 * boolean. `values` is what `src/ui/execute-catalogue.ts` rebuilds the argv
 * from, so a stray `always: 'false'` here would draw a button that unpins an
 * item nobody said was pinned.
 */
test('the remedy names only the fields the item actually carries', () => {
  const both = checkRetiredStillBinding([base({
    id: 'RULE-a', type: 'rule', status: 'superseded', always: true, severity: 'hard',
  })])[0];
  assert.deepEqual(both.remedy, {
    route: 'run', command: 'edit',
    values: { id: 'RULE-a', always: 'false', severity: 'soft', yes: true },
  });

  const hardOnly = checkRetiredStillBinding([base({
    id: 'REQ-a', type: 'requirement', status: 'superseded', severity: 'hard',
  })])[0];
  assert.deepEqual(hardOnly.remedy, {
    route: 'run', command: 'edit', values: { id: 'REQ-a', severity: 'soft', yes: true },
  });
});

test('the message names both the command that fixes it and the one that rules on it', () => {
  const finding = checkRetiredStillBinding([base({
    id: 'RULE-a', type: 'rule', status: 'superseded', always: true, severity: 'hard',
  })])[0];
  assert.match(finding.message, /mycontext edit RULE-a --always=false --severity soft --yes/);
  assert.match(finding.message, /mycontext ack RULE-a retired_still_binding/);
});

// --- the `validated` ruling ----------------------------------------------

test('validated is NOT a stand-down status, even carrying both fields', () => {
  const item = base({
    id: 'CONST-a', type: 'constraint', status: 'validated', always: true, severity: 'hard',
  });
  assert.deepEqual(checkRetiredStillBinding([item]), []);
});

test('STOOD_DOWN_STATUSES holds exactly the two retirements, and not validated', () => {
  assert.deepEqual([...STOOD_DOWN_STATUSES].sort(), ['deprecated', 'superseded']);
});

test('a draft is not retired and is not reported', () => {
  const item = base({ id: 'RULE-a', type: 'rule', status: 'draft', severity: 'hard' });
  assert.deepEqual(checkRetiredStillBinding([item]), []);
});
