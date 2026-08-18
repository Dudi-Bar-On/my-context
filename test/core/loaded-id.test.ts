/**
 * The id grammar, applied at the READ boundary.
 *
 * `validateExplicitId` has always guarded the mint path. Nothing guarded the
 * path ids arrive on: `parseItem` took `id` from frontmatter verbatim, so a
 * file written straight into `.my_context/items/` carried whatever it said —
 * and that id is interpolated into commands the CLI invites a human to run.
 *
 * The demonstration that motivated this, on 1.0.1: an item whose id was
 * `DEC-$(echo SUBSTITUTED)` made `mycontext supersede` print
 * "promote it with `mycontext review promote DEC-$(echo SUBSTITUTED)`",
 * and the substitution runs in the user's own shell, where the deny rules —
 * which govern the agent's Bash tool — do not apply.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseItem } from '../../src/core/item.ts';
import { validateExplicitId, validateLoadedId } from '../../src/core/validate.ts';

function file(id: string): string {
  return [
    '---',
    `id: ${id}`,
    'type: decision',
    'title: a title',
    'status: active',
    '---',
    '',
    'body',
    '',
  ].join('\n');
}

function accepts(fn: (s: string, w: string) => void, id: string): boolean {
  try {
    fn(id, 'x');
    return true;
  } catch {
    return false;
  }
}

/**
 * **The round-trip property**, in the shape `INV-a-validator-that-gates-writes-must-be-a-complete`
 * asks for: a number, not an argument.
 *
 * A read-boundary check that refused an id the write boundary mints would make
 * `createItem` produce a file that can never be loaded again — the same
 * half-applied state the invariant exists to prevent, arriving from the other
 * direction. The two validators must therefore accept exactly the same set.
 *
 * They share `ID_GRAMMAR`, so this holds by construction; it is asserted
 * because "by construction" is what stops being true when someone tightens one
 * of them.
 */
test('the read boundary and the mint boundary accept exactly the same ids', () => {
  const candidates = [
    // shapes this project mints
    'DEC-the-new-way', 'RULE-x', 'INV-prices-are-integer-cents', 'REF-v2-handover',
    'CONST-a-b-c', 'KNOWN-1-0-1-something', 'A', 'a', '0', 'Z9',
    // legacy shapes `validateExplicitId`'s comment is careful to keep loading
    'UPPER_CASE_ID', 'has.dots.in.it', 'mixed_Case-9.0', 'a_b.c-d',
    // shapes that are dangerous, meaningless, or both
    'DEC-$(echo X)', 'DEC-`whoami`', 'has space', 'has\ttab', 'semi;colon',
    'pipe|char', 'amp&and', 'gt>redirect', 'quote"d', "quote'd", 'star*',
    '../../../evil', 'a/b', 'a\\b', '..', 'a..b', '-leading-dash', '.leading-dot',
    '_leading-underscore', '', ' ', 'unicode-א', 'newline\nin-id',
  ];

  const disagreements = candidates.filter(
    (id) => accepts(validateExplicitId, id) !== accepts(validateLoadedId, id),
  );

  assert.deepEqual(disagreements, [], 'an id accepted by one boundary and refused by the other');
});

test('every id this project mints survives the read boundary', () => {
  const minted = ['DEC-the-new-way', 'INV-prices-are-integer-cents', 'REF-a-b', 'RULE-x9'];
  for (const id of minted) assert.doesNotThrow(() => validateLoadedId(id, 'f.md'));
});

test('an id carrying a shell substitution is refused, and the message says why', () => {
  assert.throws(
    () => parseItem(file('DEC-$(echo SUBSTITUTED)'), 'items/decision/x.md', 'project'),
    (err: Error) => {
      assert.match(err.message, /not a usable id/);
      // The reader is told the consequence, not just the rule.
      assert.match(err.message, /printed inside commands/);
      // And which file, since the corpus keeps loading around it.
      assert.match(err.message, /items\/decision\/x\.md/);
      return true;
    },
  );
});

test('a backtick id is refused', () => {
  assert.throws(() => parseItem(file('DEC-`whoami`'), 'f.md', 'project'), /not a usable id/);
});

test('a path-separator id is refused — it would also write outside the workspace', () => {
  assert.throws(() => parseItem(file('../../../evil'), 'f.md', 'project'), /not a usable id/);
  assert.throws(() => parseItem(file('a/b'), 'f.md', 'project'), /not a usable id/);
});

test('".." anywhere is refused, not only as a whole segment', () => {
  assert.throws(() => parseItem(file('a..b'), 'f.md', 'project'), /not a usable id/);
});

/**
 * The other half of the change, and the one that decides whether it is safe to
 * ship as a PATCH: an id that is merely UNUSUAL must still load. The comment
 * above `ID_GRAMMAR` declines a stricter rule precisely so a hand-authored or
 * older corpus keeps working, and this asserts that reasoning survived.
 */
test('uppercase, underscore and dot ids still load', () => {
  for (const id of ['UPPER_CASE_ID', 'has.dots.in.it', 'mixed_Case-9.0']) {
    const item = parseItem(file(id), 'f.md', 'project');
    assert.equal(item.id, id);
  }
});

test('a normal id loads unchanged', () => {
  const item = parseItem(file('DEC-the-new-way'), 'items/decision/DEC-the-new-way.md', 'project');
  assert.equal(item.id, 'DEC-the-new-way');
  assert.equal(item.title, 'a title');
});
