/**
 * `droppedBodyText` — the read-boundary half of the rule `validateBody`
 * (core/validate.ts) enforces at the write boundary.
 *
 * `validateBody` refuses a body a CALLER hands in that this format cannot
 * hold. It never sees a file a human edited by hand, and every write path
 * re-renders the whole item from the parsed form — so a `## ` section that is
 * not a field of an item is deleted by the next write, silently, with the
 * command reporting success. This corpus lost roughly two-thirds of two task
 * bodies that way (3,918 -> 1,272 bytes and 5,507 -> 1,535) in a commit that
 * hand-edited them and then ran `mycontext repair`.
 *
 * The measurement these tests exist to keep true: over this repository's own
 * 658 committed item files, `droppedBodyText` returns `null` for every one.
 * A detector that cried wolf on a healthy corpus would be turned off within a
 * day, so the negative cases below are as load-bearing as the positive ones.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { droppedBodyText, parseItem, renderItem } from '../../src/core/item.ts';

function file(body: string): string {
  return `---\nid: NOTE-x\ntype: note\ntitle: X\nstatus: active\n---\n\n# X\n\n${body}\n`;
}

/** What the next write would actually put on disk, for the tests that compare. */
function rewritten(text: string): string {
  return renderItem(parseItem(text, 'items/note/NOTE-x.md', 'project'));
}

test('a canonical item loses nothing', () => {
  assert.equal(droppedBodyText(file('Just prose.')), null);
});

test('an item with observations and relations loses nothing', () => {
  const text = file(
    'Prose.\n\n## Observations\n- [fact] something #tag (in the writer)\n\n' +
    '## Relations\n- constrains [[CONST-a]]\n',
  );
  assert.equal(droppedBodyText(text), null);
});

test('a "## " section that is not a field of an item is reported, with its first line and its size', () => {
  const text = file('Survives.\n\n## A section\n\nDeleted by the next write.\n');
  const loss = droppedBodyText(text);
  assert.ok(loss, 'the section is dropped by the parser, so it must be reported');
  assert.equal(loss.line, '## A section');
  assert.ok(loss.bytes > 0);

  // And the claim is not a guess: the rewrite really does not contain it.
  assert.doesNotMatch(rewritten(text), /Deleted by the next write/);
  assert.match(rewritten(text), /Survives\./);
});

test('the earlier of two same-named sections is reported — the parser keeps the last', () => {
  const text = file(
    'Prose.\n\n## Observations\n- [fact] first block\n\n## Observations\n- [fact] second block\n',
  );
  const loss = droppedBodyText(text);
  assert.ok(loss);
  assert.doesNotMatch(rewritten(text), /first block/);
  assert.match(rewritten(text), /second block/);
});

test('a second "# " line in the prose is reported, and the first is not', () => {
  // `renderItem` re-emits exactly one, from `title:`, so the leading one is
  // not a loss and any further one is.
  assert.equal(droppedBodyText(file('Prose only.')), null);
  const loss = droppedBodyText(file('Prose.\n\n# A second heading\n\nMore.'));
  assert.ok(loss);
  assert.equal(loss.line, '# A second heading');
});

test('a line inside "## Observations" that the section grammar does not match is reported', () => {
  // `parseObservations` skips it, which is the same deletion one line lower.
  const text = file('Prose.\n\n## Observations\n- [fact] kept\nthis line is not an observation\n');
  const loss = droppedBodyText(text);
  assert.ok(loss);
  assert.equal(loss.line, 'this line is not an observation');
  assert.doesNotMatch(rewritten(text), /this line is not an observation/);
});

test('blank lines are not called a loss — every canonical write moves them', () => {
  assert.equal(droppedBodyText(file('Prose.\n\n\n')), null);
  assert.equal(droppedBodyText(file('\n\nProse.')), null);
});

test('a quoted "> ## " heading is not a loss, which is what makes --file safe', () => {
  // `snapshotBody` (core/reference.ts) quotes every line of a snapshot for
  // exactly this reason: `> ## Q3` matches no heading pattern, so a Markdown
  // document that is nothing but headings round-trips unchanged.
  const text = file('> Intro.\n>\n> ## A heading\n>\n> Body after it.');
  assert.equal(droppedBodyText(text), null);
  assert.match(rewritten(text), /> Body after it\./);
});

test('a file with no frontmatter is not this function\'s complaint to make', () => {
  // `parseItem` refuses it with its own message; "no parsed text is lost" is
  // true of a file that never parses.
  assert.equal(droppedBodyText('just some text\n'), null);
});

test('CRLF text is judged the same as LF text', () => {
  const lf = file('Survives.\n\n## A section\n\nDeleted.\n');
  const crlf = lf.replace(/\n/g, '\r\n');
  assert.deepEqual(droppedBodyText(crlf), droppedBodyText(lf));
});
