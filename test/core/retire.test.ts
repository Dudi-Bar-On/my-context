// @basis TASK-retire-on-evidence-and-bound-the-corpus
/**
 * **What this rests on.**
 *
 * The item above says retirement is proposed on measured contribution, never
 * on the calendar; that `origin: 'human'` is never touched under any path; and
 * that ignoring is not declining, so nothing here may propose a deletion. Every
 * assertion below is about one of those three claims.
 *
 * The fixtures are hand-built items and a hand-built contribution map, for the
 * reason `test/core/contribution.test.ts` gives about its own: `retire.ts`
 * touches no filesystem, so a temp workspace would only add a way for this file
 * to fail for a reason that is not about the rule.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RETIREABLE_ORIGIN, RETIREMENT_RULE, WHY_NO_RULE, ageDays, candidates,
  type RetirementRule,
} from '../../src/core/retire.ts';
import type { Contribution } from '../../src/core/contribution.ts';
import type { Item } from '../../src/core/types.ts';

const NOW = Date.parse('2026-09-11T00:00:00.000Z');
const LONG_AGO = '2026-07-01';
const YESTERDAY = '2026-09-10';

/**
 * A rule with its derivation, because the type has no other form. The two
 * thresholds are the plan's own worked example and are NOT a claim about this
 * corpus — `RETIREMENT_RULE` is `null` and the last test in this file is why.
 */
const RULE: RetirementRule = {
  maxDelivered: 0,
  minAgeDays: 30,
  derivedOn: '2026-09-11',
  derivedIn: 'test/core/retire.test.ts — a fixture, not a derivation',
};

function item(id: string, origin: string, validFrom: string | null = LONG_AGO): Item {
  return {
    id, origin, validFrom, type: 'rule', status: 'active', always: false,
  } as unknown as Item;
}

function delivered(id: string, n: number): Map<string, Contribution> {
  return new Map([[id, {
    id, delivered: n, spilled: 0, tiers: [], firstAt: null, lastAt: null,
  }]]);
}

test('a human-authored item is never a candidate, however cold', () => {
  const items = [item('RULE-h', 'human')];
  assert.deepEqual(
    candidates(items, new Map(), RULE, NOW), [],
    'the loop may never retire what a person wrote',
  );
});

test('agent- and ingest-authored items are not candidates either', () => {
  // The guard is one origin admitted, not one origin excluded. An `agent` item
  // was captured by a person driving an MCP tool and an `ingest` item came from
  // a document somebody chose to import; both are judgements, and only
  // `review` is not.
  const items = [item('RULE-a', 'agent'), item('RULE-i', 'ingest')];
  assert.deepEqual(candidates(items, new Map(), RULE, NOW), []);
  assert.equal(RETIREABLE_ORIGIN, 'review');
});

test('a review item delivered zero times and older than the window is a candidate', () => {
  const out = candidates([item('LESSON-a', 'review')], new Map(), RULE, NOW);
  assert.equal(out.length, 1);
  assert.match(out[0]!.why, /never delivered/i, 'the reason travels with the candidate');
  assert.match(
    out[0]!.why, /2026-09-11/,
    'and it names the day the threshold was derived, so a list is readable without the report',
  );
  assert.equal(out[0]!.ageDays, 72);
});

test('a young review item is NOT a candidate — it has not been tested, not failed', () => {
  assert.deepEqual(
    candidates([item('LESSON-b', 'review', YESTERDAY)], new Map(), RULE, NOW), [],
    'calendar age cannot make an item a candidate, and it is the only thing that can spare one',
  );
});

test('an undated review item is not a candidate, because its age cannot be judged', () => {
  // `null` is not zero and is not "old enough". An item this rule cannot date
  // is one it cannot say has had its chance.
  assert.deepEqual(candidates([item('LESSON-c', 'review', null)], new Map(), RULE, NOW), []);
  assert.equal(ageDays(item('LESSON-c', 'review', null), NOW), null);
});

test('a review item delivered more than the rule allows is not a candidate', () => {
  const out = candidates([item('LESSON-d', 'review')], delivered('LESSON-d', 1), RULE, NOW);
  assert.deepEqual(out, [], 'the threshold is a threshold, not a decoration on an age check');
});

test('a candidate proposes deprecation and never deletion', () => {
  const out = candidates([item('LESSON-e', 'review')], new Map(), RULE, NOW);
  assert.equal(
    out[0]!.action, 'deprecate',
    'ignoring is the absence of judgement; only judgement earns deletion, and this module is the '
    + 'absence of judgement by construction',
  );
});

test('candidates come least-delivered first, so the strongest case is at the top', () => {
  const items = [item('LESSON-x', 'review'), item('LESSON-y', 'review')];
  const got = new Map([...delivered('LESSON-y', 1), ...delivered('LESSON-x', 4)]);
  assert.deepEqual(
    candidates(items, got, { ...RULE, maxDelivered: 5 }, NOW).map((c) => c.id),
    ['LESSON-y', 'LESSON-x'],
    'the count orders the list, not the order the items arrived in',
  );
});

test('equal counts fall back to the id, so the order cannot depend on load order', () => {
  const items = [item('LESSON-y', 'review'), item('LESSON-x', 'review')];
  assert.deepEqual(
    candidates(items, new Map(), RULE, NOW).map((c) => c.id), ['LESSON-x', 'LESSON-y'],
  );
});

test('this build ships NO rule, and says in numbers why not', () => {
  // The one assertion that makes every test above hypothetical, and it is the
  // point of the phase: `candidates` cannot be reached without a rule, and
  // there is no rule to reach it with.
  assert.equal(
    RETIREMENT_RULE, null,
    'a threshold copied from a paper is the failure mode this phase exists to prevent, and a '
    + 'default is how one arrives',
  );
  assert.ok(WHY_NO_RULE.length >= 3, 'the refusal is itemised, not a shrug');
  assert.ok(
    WHY_NO_RULE.every((line) => /\d/.test(line)),
    'every reason carries the number that refused',
  );
});

test('nothing in this module can write: it imports no store, no fs and no mutation', async () => {
  // The boundary §13 states — *the owner promotes, always* — held by
  // construction rather than by a flag somebody can add later. A retirement is
  // a stand-down that reaches every future session, so the module that names
  // one has no verb at all.
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../../src/core/retire.ts', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^import .*? from '(.+?)';$/gm)].map((m) => m[1]!);
  assert.deepEqual(
    imports.filter((m) => !m.startsWith('./')), [],
    'a module that reaches node:fs, node:sqlite or anything outside core/ could retire something',
  );
  assert.deepEqual(
    imports.filter((m) => /mutate|store|persist|audit-db/.test(m)), [],
    'and one that reaches a write path could do it without asking',
  );
  assert.deepEqual(imports.slice().sort(), ['./audit.ts', './contribution.ts', './types.ts']);
});
