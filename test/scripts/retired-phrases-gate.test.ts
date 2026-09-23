// @basis TASK-a-scanner-enumerates-what-it-will-skip-not-what-it-will-scan, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **The retired-phrase gate, held to the same rule as the NUL gate.**
 *
 * `TASK-a-scanner-enumerates-what-it-will-skip-not-what-it-will-scan` names
 * this script for its `ROOTS` list of three documentation directories: a
 * document under `reports/`, `docs/capabilities/`, or `README.md` itself could
 * declare a `<!-- retired-phrases -->` block and **nothing would ever read
 * it**. The declaration is an opt-in, so the failure is the worst shape there
 * is — an author asks for a gate, the gate answers nothing, and the silence is
 * indistinguishable from a pass.
 *
 * What is proved:
 *
 *   1. **Every tracked Markdown document is a candidate**, so an opt-in is
 *      honoured wherever it is written. Standing assertions over the four
 *      trees `ROOTS` could not reach.
 *   2. **The skip is declared and reasoned**: a non-Markdown file is the only
 *      thing left out, and it comes back carrying why.
 *   3. **It still goes red** — over a planted document, including the two
 *      exemptions that must survive (a §0 correction log, and the declaration
 *      block itself).
 *   4. **The summary names what was considered**, not only what declared. A
 *      count of declaring documents with no denominator cannot distinguish a
 *      healthy repository from a gate pointed at three directories.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  SKIP_REASON_NOT_MARKDOWN, candidates, hitsIn, summarise,
} from '../../scripts/check-retired.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'check-retired.ts');

test('every tracked Markdown document is a candidate, wherever it lives', () => {
  const { considered, skipped } = candidates(REPO);
  const set = new Set(considered);

  assert.ok(set.has('README.md'), 'README.md declares nothing today and must still be read');
  const has = (prefix: string): void => {
    assert.ok(considered.some((f) => f.startsWith(prefix)), `no document under ${prefix}`);
  };
  has('reports/');
  has('docs/capabilities/');
  has('docs/superpowers/plans/');
  has('.my_context/items/');

  assert.ok(considered.length > 1000, `only ${considered.length} document(s) considered`);
  assert.ok(considered.every((f) => f.endsWith('.md')), 'a non-Markdown file reached the walk');
  for (const s of skipped) {
    assert.equal(s.why, SKIP_REASON_NOT_MARKDOWN);
    assert.ok(!s.file.endsWith('.md'), `${s.file} is Markdown and was skipped anyway`);
  }
});

test('a retired phrase still standing in a body is reported', () => {
  const doc = [
    '# A plan',
    '',
    '<!-- retired-phrases',
    "ledger.seen(session) exactly as the hook does",
    '-->',
    '',
    '## 0. Corrections',
    '',
    '| Was | Now |',
    '| ledger.seen(session) exactly as the hook does | gone |',
    '',
    '## 1. The body',
    '',
    'Write `ledger.seen(session) exactly as the hook does`.',
  ].join('\n');
  const hits = hitsIn('docs/x.md', doc);
  assert.equal(hits.length, 1, 'exactly the body line, not the §0 row and not the declaration');
  assert.equal(hits[0]!.line, 14);
  assert.equal(hits[0]!.phrase, 'ledger.seen(session) exactly as the hook does');
});

test('a document with no declaration is read and contributes nothing', () => {
  assert.deepEqual(hitsIn('reports/x.md', '# Report\n\nNothing declared here.\n'), []);
});

test('the summary names what was considered, what declared, and what was skipped', () => {
  const line = summarise({
    considered: 1200, declaring: 8, phrases: 24, hits: 0,
    skipped: [{ file: 'src/a.ts', why: SKIP_REASON_NOT_MARKDOWN }],
  });
  assert.match(line, /1,?200/);
  assert.match(line, /8 /);
  assert.match(line, /24 /);
  assert.match(line, new RegExp(SKIP_REASON_NOT_MARKDOWN.split(' ')[0]));
});

test('the real script runs green over this repository and says what it considered', () => {
  const out = execFileSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  assert.match(out, /considered/);
  assert.match(out, /declare retired phrases/);
  assert.match(out, /every recorded correction is also applied/);
});
