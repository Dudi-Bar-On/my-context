import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../../src/core/config.ts';
import { checkTaskNeeds, runChecks } from '../../src/doctor/checks.ts';
import type { Item } from '../../src/core/types.ts';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';

/**
 * **The findings that turn `needs` from a field into a gate.**
 *
 * The case this file exists for is `blocked_needs_met`: `plan:walk seq:8`
 * carried "Blocked on plan:walk seq:7" in prose, `seq:7` landed and went
 * green, and `seq:8` sat at `state: blocked` until a human noticed by hand.
 * Nothing could have noticed — five tasks said `blocked` and not one said by
 * what. That test is the one to break first if this file is ever refactored.
 */

const CONFIG = resolveConfig({
  categories: {
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work, tracked to completion.',
      extraFields: ['plan', 'seq', 'state', 'priority', 'needs'],
    },
  },
});

/** The same category WITHOUT `needs` declared — the state this project's own
 * corpus is in while the config declaration waits on another lane. The checks
 * must fire identically; only the remedy sentence changes. */
const CONFIG_WITHOUT_NEEDS = resolveConfig({
  categories: {
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work, tracked to completion.',
      extraFields: ['plan', 'seq', 'state', 'priority'],
    },
  },
});

let n = 0;
function task(extra: Record<string, string>, over: Partial<Item> = {}): Item {
  n++;
  return {
    id: `TASK-${extra.plan ?? 'p'}-${extra.seq ?? String(n)}`, type: 'task', title: `T${n}`,
    status: 'active', severity: 'soft', always: false, continuity: false,
    scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra,
    body: '', steps: [], observations: [], relations: [],
    layer: 'project', filePath: `items/task/TASK-${n}.md`,
    ...over,
  };
}

test('a blocked task whose needs are all done is reported — the seq:8 case', () => {
  const seq8 = task({ plan: 'walk', seq: '8', state: 'blocked', needs: 'walk/7' });
  const findings = checkTaskNeeds([task({ plan: 'walk', seq: '7', state: 'done' }), seq8], CONFIG);

  const met = findings.filter((f) => f.code === 'blocked_needs_met');
  assert.equal(met.length, 1, `expected exactly one blocked_needs_met, got ${findings.length} findings`);
  assert.equal(met[0].item, seq8.id);
  assert.equal(met[0].level, 'warn');
  // The finding has to NAME what landed, or a reader cannot check it without
  // re-deriving the thing the finding exists to derive for them.
  assert.match(met[0].message, /walk\/7/);
  assert.match(met[0].message, /should have moved and did not/);
});

test('a blocked task whose needs are ALL done fires; one with any pending need does not', () => {
  // The anti-vacuity half: the same corpus, one state changed, and the
  // finding must disappear. A check that fired either way would pass the
  // test above while saying nothing.
  const seq8 = task({ plan: 'walk', seq: '8', state: 'blocked', needs: 'walk/7, port/6' });
  const corpus = (portState: string): Item[] => [
    task({ plan: 'walk', seq: '7', state: 'done' }),
    task({ plan: 'port', seq: '6', state: portState }),
    seq8,
  ];
  assert.equal(
    checkTaskNeeds(corpus('done'), CONFIG).filter((f) => f.code === 'blocked_needs_met').length, 1,
  );
  assert.equal(
    checkTaskNeeds(corpus('todo'), CONFIG).filter((f) => f.code === 'blocked_needs_met').length, 0,
  );
});

test('a task that is not blocked is never reported as a cleared blocker', () => {
  const findings = checkTaskNeeds([
    task({ plan: 'walk', seq: '7', state: 'done' }),
    task({ plan: 'walk', seq: '8', state: 'todo', needs: 'walk/7' }),
  ], CONFIG);
  assert.deepEqual(findings.map((f) => f.code), []);
});

test('a blocked task with no needs is a blocker with no target', () => {
  const orphan = task({ plan: 'walk', seq: '1h', state: 'blocked' });
  const findings = checkTaskNeeds([orphan], CONFIG);
  assert.deepEqual(findings.map((f) => [f.code, f.item, f.level]),
    [['blocked_without_needs', orphan.id, 'warn']]);
  // It must say what to do when the blocker is NOT a task — the two real
  // cases in this corpus are an owner decision and an open question, neither
  // of which this field can hold.
  assert.match(findings[0].message, /a person, a decision or an answer/);
});

test('the remedy names the config declaration only while the field is undeclared', () => {
  const orphan = task({ plan: 'walk', seq: '1h', state: 'blocked' });
  const declared = checkTaskNeeds([orphan], CONFIG)[0].message;
  const undeclared = checkTaskNeeds([orphan], CONFIG_WITHOUT_NEEDS)[0].message;

  assert.match(declared, /mycontext edit .* --extra needs=/);
  assert.doesNotMatch(declared, /extraFields/);
  // Printing `--extra needs=…` at a reader whose category does not declare the
  // field costs them an attempt at a command `unknownExtraFieldError` refuses
  // by name.
  assert.match(undeclared, /categories\.task\.extraFields/);
  assert.match(undeclared, /refused by name/);
});

test('a blocked task with a pending need is not reported at all — it is simply blocked', () => {
  const findings = checkTaskNeeds([
    task({ plan: 'walk', seq: '7', state: 'todo' }),
    task({ plan: 'walk', seq: '8', state: 'blocked', needs: 'walk/7' }),
  ], CONFIG);
  assert.deepEqual(findings.map((f) => f.code), []);
});

test('an unresolvable reference is an INFO note, never an error — and never blocks', () => {
  // The ruling: shape, not existence. `the/45` is the reference the regex
  // migration harvested out of the middle of a sentence; a plan written
  // before its tasks exist produces the identical reading, and no machine can
  // tell them apart.
  const forward = task({ plan: 'walk', seq: '3', state: 'todo', needs: 'the/45' });
  const findings = checkTaskNeeds([forward], CONFIG);
  assert.deepEqual(findings.map((f) => [f.code, f.level]), [['needs_unresolved', 'info']]);
  assert.match(findings[0].message, /NOT a defect on its own/);
});

test('a malformed entry is a warning that quotes what was written', () => {
  const broken = task({ plan: 'walk', seq: '4', state: 'todo', needs: 'walk/7, seq:8' });
  const findings = checkTaskNeeds([task({ plan: 'walk', seq: '7', state: 'done' }), broken], CONFIG);
  assert.deepEqual(findings.map((f) => [f.code, f.level]), [['needs_malformed', 'warn']]);
  assert.match(findings[0].message, /"seq:8"/);
  // The good half of the same field is not reported as broken.
  assert.doesNotMatch(findings[0].message, /"walk\/7"/);
});

test('a blocked task whose ONLY needs entry is malformed reports the malformation, not "names nothing"', () => {
  // Both would be true sentences; only one is actionable. Reporting "names
  // nothing" at an author who did name something, in a spelling that does not
  // parse, sends them to write the field they already wrote.
  const broken = task({ plan: 'walk', seq: '5', state: 'blocked', needs: 'seq:8' });
  const codes = checkTaskNeeds([broken], CONFIG).map((f) => f.code);
  assert.deepEqual(codes, ['needs_malformed']);
});

test('nothing is reported in a project whose categories do not plan work', () => {
  // `task` is a CUSTOM category. A check keyed on the NAME would go silent in
  // a project that calls the same idea `story`; one keyed on nothing at all
  // would fire on every `constraint` in every corpus that ships.
  const plain = resolveConfig({});
  const items = [{ ...task({ plan: 'walk', seq: '8', state: 'blocked' }), type: 'constraint' }];
  assert.deepEqual(checkTaskNeeds(items, plain), []);
});

test('runChecks includes the needs findings, so `mycontext doctor` reports them', () => {
  // The check has to be WIRED IN, not merely exported: a check nobody calls
  // is a function with tests and no effect.
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'myctx-needs-'));
  try {
    const root = path.join(repoRoot, '.my_context');
    mkdirSync(path.join(root, 'items', 'task'), { recursive: true });
    writeFileSync(path.join(root, 'index.db'), '');
    const findings = runChecks({
      root,
      repoRoot,
      dbPath: path.join(root, 'index.db'),
      items: [
        task({ plan: 'walk', seq: '7', state: 'done' }),
        task({ plan: 'walk', seq: '8', state: 'blocked', needs: 'walk/7' }),
      ],
      config: CONFIG,
    });
    assert.ok(
      findings.some((f) => f.code === 'blocked_needs_met'),
      `runChecks did not report the cleared blocker; codes: ${findings.map((f) => f.code).join(', ')}`,
    );
    assert.equal(findings.some((f) => f.code === 'check_failed'), false);
  } finally {
    removeTree(repoRoot);
  }
});
