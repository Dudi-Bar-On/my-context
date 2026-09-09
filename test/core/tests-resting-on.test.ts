// @basis TASK-superseding-an-item-asks-which-tests-rest-on-it-and-proves,
//        RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import {
  basisTokens, isTestScope, restingTestsLine, restingTestsSaid, testsRestingOn, tokenNames,
  TEST_TREES,
} from '../../src/core/tests-resting-on.ts';
import { createItem, supersedeItem } from '../../src/core/mutate.ts';
import { sandbox } from '../helpers/workspace.ts';

/**
 * `plan:contra seq:2` / contradiction-gate design §8.
 *
 * The half that is load-bearing is the PROOF, not the answer: §8's own words
 * are *"the answer is validated, not merely stored"*, and a named test that has
 * since been renamed or deleted *"becomes a doctor finding — and that is
 * precisely the finding that matters six months later"*. So the assertions that
 * matter most here are the `unresolved` ones, and the one that pins that this
 * can NEVER gate — §8 requires that sentence to be in the implementation *"or
 * the field will grow a gate within a month"*.
 *
 * Trees are planted under the OS temp directory rather than in `test/`, for
 * `check-basis.ts`' `--root` reason: the only other way to exercise a missing
 * test path is to leave a deliberately broken one in front of every other
 * lane's `npm test`.
 */
function plant(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'mycontext-resting-'));
  for (const [rel, text] of Object.entries(files)) {
    const full = path.join(root, ...rel.split('/'));
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, text, 'utf8');
  }
  return root;
}

test('the grammar: a header declaration yields its tokens, and a file with none yields null', () => {
  assert.deepEqual(basisTokens('// @basis RULE-a, RULE-b\n\nimport x;\n'), ['RULE-a', 'RULE-b']);
  assert.deepEqual(basisTokens('/**\n * @basis RULE-a\n */\n'), ['RULE-a']);
  assert.equal(basisTokens('import x;\n// @basis RULE-a\n'), null);
  // `none` comes back as a token rather than as a judgement: ruling on which
  // declarations are well formed stays in `scripts/check-basis.ts`, and a second
  // opinion about the grammar is the defect this module exists to avoid.
  assert.deepEqual(basisTokens('// @basis none - pure parser mechanics\n'), [
    'none', '-', 'pure', 'parser', 'mechanics',
  ]);
});

test('a token names an item exactly, or as a prefix at a segment boundary, and not otherwise', () => {
  assert.ok(tokenNames('RULE-a-thing', 'RULE-a-thing'));
  assert.ok(tokenNames('RULE-a-thing-', 'RULE-a-thing'), 'a trailing hyphen is a line wrap');
  assert.ok(tokenNames('RULE-a', 'RULE-a-thing'), 'shortened ids are how this corpus writes them');
  // NOT a bare substring match: `RULE-a-thi` must not name `RULE-a-thing`, or a
  // truncated token would silently claim a different item.
  assert.ok(!tokenNames('RULE-a-thi', 'RULE-a-thing'));
  assert.ok(!tokenNames('RULE-b', 'RULE-a-thing'));
});

test('a test declaring the id is found, and a helper declaring it is found too', () => {
  const root = plant({
    'test/core/one.test.ts': '// @basis RULE-the-old-ruling\n\nimport x;\n',
    'e2e/helper.ts': '// @basis RULE-the-old-ruling, RULE-other\n',
    'test/core/two.test.ts': '// @basis RULE-other\n',
    'test/core/three.test.ts': 'no declaration at all\n',
  });
  try {
    const found = testsRestingOn(root, 'RULE-the-old-ruling', []);
    assert.deepEqual(found.declaring.map((d) => d.file), ['e2e/helper.ts', 'test/core/one.test.ts']);
    assert.equal(found.walked, 4);
    assert.equal(found.truncated, false);
    // Real by construction: the file was read to find the declaration.
    assert.deepEqual(found.unresolved, []);
  } finally {
    removeTree(root);
  }
});

test('a declaration further down the file is NOT a declaration — only the header is read', () => {
  const root = plant({
    'test/core/one.test.ts': 'import x;\nconst s = `// @basis RULE-the-old-ruling`;\n',
  });
  try {
    assert.deepEqual(testsRestingOn(root, 'RULE-the-old-ruling', []).declaring, []);
  } finally {
    removeTree(root);
  }
});

test('THE PROOF: a recorded test path that matches no file is reported as unresolved', () => {
  const root = plant({ 'test/core/one.test.ts': '// @basis none - nothing\n' });
  try {
    const found = testsRestingOn(root, 'RULE-the-old-ruling', [
      { id: 'RULE-the-old-ruling', scope: ['test/core/one.test.ts', 'test/core/gone.test.ts'] },
      { id: 'RULE-the-new-ruling', scope: ['test/**', 'src/core/**'] },
    ]);
    assert.deepEqual(found.recorded.map((r) => [r.named, r.matches]), [
      ['test/core/one.test.ts', 1],
      ['test/core/gone.test.ts', 0],
      ['test/**', 1],
    ], 'a non-test scope glob is not a claim about a test and is not resolved here');
    assert.deepEqual(found.unresolved.map((r) => r.named), ['test/core/gone.test.ts']);
    // The renamed/deleted case is SAID, not only counted — §8's "the finding
    // that matters six months later".
    const said = restingTestsSaid('RULE-the-old-ruling', found);
    assert.match(said, /test\/core\/gone\.test\.ts.*MATCHES NO FILE — renamed or deleted/);
    assert.match(said, /worse than no answer/);
    assert.match(restingTestsLine(found), /1 of those MATCH NO FILE/);
  } finally {
    removeTree(root);
  }
});

test('a glob that matches nothing is unresolved too, not excused for being a glob', () => {
  const root = plant({ 'test/core/one.test.ts': 'x\n' });
  try {
    const found = testsRestingOn(root, 'RULE-x', [{ id: 'RULE-x', scope: ['e2e/**'] }]);
    assert.deepEqual(found.unresolved.map((r) => r.named), ['e2e/**']);
  } finally {
    removeTree(root);
  }
});

test('NOT MEASURED is not "none": a tree with no test files says so', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'mycontext-resting-empty-'));
  try {
    const found = testsRestingOn(root, 'RULE-x', [{ id: 'RULE-x', scope: ['test/**'] }]);
    assert.equal(found.walked, 0);
    const said = restingTestsSaid('RULE-x', found);
    assert.match(said, /NOT MEASURED/);
    assert.match(said, /not the same as nothing resting on it/);
    assert.doesNotMatch(said, /no test declares/);
    assert.match(restingTestsLine(found), /NOT MEASURED/);
  } finally {
    removeTree(root);
  }
});

test('THE SENTENCE §8 REQUIRES: the answer is a floor and never gates, said out loud', () => {
  const root = plant({ 'test/core/one.test.ts': '// @basis RULE-x\n' });
  try {
    const said = restingTestsSaid('RULE-x', testsRestingOn(root, 'RULE-x', []));
    // "Completeness can never be checked" — the clause that stops this growing
    // a gate, quoted from §8 in the product's own words.
    assert.match(said, /indistinguishable from "no tests affected"/);
    assert.match(said, /never gates and never fails a write/);
    // And the blind spot the checker's own output already states, so the number
    // is not read wider than it is.
    assert.match(said, /VERIFIES, never what it ASSUMES/);
  } finally {
    removeTree(root);
  }
});

test('END TO END: supersedeItem itself carries the answer, so every door into retirement does', () => {
  const s = sandbox();
  try {
    // Planted inside the sandbox's own repository root, which is what
    // `supersedeItem` derives from `ctx.root` — so this proves the wiring and
    // not only the module.
    mkdirSync(path.join(s.cwd, 'test', 'core'), { recursive: true });
    const old = createItem(s.ctx, {
      type: 'rule', title: 'the door is held open by every reader',
      scope: ['test/core/door.test.ts', 'test/core/gone.test.ts'],
    });
    writeFileSync(
      path.join(s.cwd, 'test', 'core', 'door.test.ts'), `// @basis ${old.id}\n`, 'utf8',
    );
    const next = createItem(s.ctx, { type: 'rule', title: 'nobody holds any door at all now' });
    const result = supersedeItem(s.ctx, { id: old.id, by: next.id });

    assert.match(result.message, new RegExp(`Which tests rest on ${old.id}`));
    assert.match(result.message, /declares @basis\s+test\/core\/door\.test\.ts/);
    // THE PROOF: the recorded path that is not there is named as such at the
    // moment of the write.
    assert.match(result.message, /test\/core\/gone\.test\.ts.*MATCHES NO FILE/);
    assert.match(result.message, /never gates and never fails a write/);
    // And it did not gate: the retirement happened.
    assert.equal(s.ctx.store.get(old.id)!.status, 'superseded');
  } finally {
    s.dispose();
  }
});

test('only the two test trees are treated as a claim about a test', () => {
  assert.deepEqual([...TEST_TREES], ['test', 'e2e']);
  assert.ok(isTestScope('test/core/x.test.ts'));
  assert.ok(isTestScope('e2e/**'));
  assert.ok(isTestScope('test'));
  assert.ok(!isTestScope('src/core/**'));
  assert.ok(!isTestScope('tests/**'), 'a near miss is not admitted — the rule names two trees');
});
