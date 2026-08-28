/**
 * **`add --file` and `edit --body` answer to ONE check, and neither loses text.**
 *
 * The defect this pins was three surfaces disagreeing about the same input:
 * `edit --body` refused a body containing a `## ` heading and said exactly what
 * would be lost, while `add --file` accepted the identical shape, printed a
 * byte count, and stored a prefix without a word.
 *
 * Both halves are asserted here, because the fix has two halves that could
 * each rot on their own:
 *
 *  - the REFUSAL is one function (`validateBody`, core/validate.ts) reached by
 *    every write path, so `add --body` and `edit --body` produce the same
 *    sentence rather than two spellings of the rule that can drift apart;
 *  - `--file` does not need the refusal, because `snapshotBody`
 *    (core/reference.ts) quotes every line of a snapshot — `> ## Q3` matches
 *    no heading pattern — so the file round-trips whole. That is a real answer
 *    to the same problem and not an exemption from it, and the test that keeps
 *    it honest is the round trip, not the absence of an error.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { droppedBodyText, parseItem } from '../../src/core/item.ts';
import { snapshotSource } from '../../src/core/reference.ts';
import { removeTree } from '../helpers/tmp.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-addfile-'));
  runCli(['init'], cwd, () => {});
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

/** A document that is mostly headings — the realistic `--file` input. */
const DOCUMENT = [
  'A roadmap, which is what people actually snapshot.',
  '',
  '## Q3',
  '',
  'Ship the thing. Two thirds of this document lives below a heading.',
  '',
  '## Q4',
  '',
  '- and a list',
  '- of items',
  '',
  '# A top-level heading too',
  '',
  'The last paragraph.',
].join('\n');

test('add --body and edit --body refuse a "## " heading with the SAME sentence — one check, not two', () => {
  withProject((cwd) => {
    const body = 'Prose.\n\n## A heading\n\nMore.';
    assert.equal(run(['add', 'note', 'anchor', '--body', 'Plain.', '--yes'], cwd).code, 0);

    const added = run(['add', 'note', 'refused', '--body', body, '--yes'], cwd);
    const edited = run(['edit', 'NOTE-anchor', '--body', body, '--yes'], cwd);

    assert.equal(added.code, 1);
    assert.equal(edited.code, 1);
    assert.equal(
      added.out.trim(), edited.out.trim(),
      'two spellings of the same rule drift apart; one function cannot',
    );
    assert.match(added.out, /would be lost the next time the item is read back from disk/);
  });
});

test('add --file stores a heading-heavy file WHOLE, and the item recovers it byte for byte', () => {
  withProject((cwd) => {
    writeFileSync(path.join(cwd, 'roadmap.md'), DOCUMENT + '\n', 'utf8');
    const { code } = run(['add', 'note', 'roadmap', '--file', 'roadmap.md', '--yes'], cwd);
    assert.equal(code, 0);

    const rel = path.join('.my_context', 'items', 'note', 'NOTE-roadmap.md');
    const text = readFileSync(path.join(cwd, rel), 'utf8');
    const item = parseItem(text, 'items/note/NOTE-roadmap.md', 'project');

    assert.equal(snapshotSource(item.body), DOCUMENT, 'every line of the source survives');
    assert.match(item.body, /^> ## Q3$/m, 'and it survives by being quoted, which is why');
    assert.equal(droppedBodyText(text), null, 'nothing here is waiting to be deleted by the next write');
  });
});

test('the byte count add --file prints is the count it STORED, not one it dropped two thirds of', () => {
  // The original report: `snapshotting … 3299 bytes` printed over an item that
  // held 1,272 of them. The figure now describes the body that was written.
  withProject((cwd) => {
    writeFileSync(path.join(cwd, 'roadmap.md'), DOCUMENT + '\n', 'utf8');
    const { out } = run(['add', 'note', 'roadmap', '--file', 'roadmap.md', '--yes'], cwd);

    const printed = /(\d+) bytes/.exec(out);
    assert.ok(printed, 'the snapshot line must state a size at all');

    const item = parseItem(
      readFileSync(path.join(cwd, '.my_context', 'items', 'note', 'NOTE-roadmap.md'), 'utf8'),
      'items/note/NOTE-roadmap.md', 'project',
    );
    assert.equal(Number(printed[1]), Buffer.byteLength(item.body, 'utf8'));
  });
});

test('a --file snapshot survives a repair without losing a line', () => {
  // `repair` re-renders from the parsed form, which is where the two lost task
  // bodies went. A quoted snapshot must come back byte-identical.
  withProject((cwd) => {
    writeFileSync(path.join(cwd, 'roadmap.md'), DOCUMENT + '\n', 'utf8');
    assert.equal(run(['add', 'note', 'roadmap', '--file', 'roadmap.md', '--yes'], cwd).code, 0);

    const file = path.join(cwd, '.my_context', 'items', 'note', 'NOTE-roadmap.md');
    const before = readFileSync(file, 'utf8');
    writeFileSync(file, before.replace(/^checksum: .*$/m, 'checksum: deadbeefdeadbeef'), 'utf8');

    assert.equal(run(['repair', '--yes'], cwd).code, 0, 'nothing here needs holding back');
    assert.equal(readFileSync(file, 'utf8'), before);
  });
});
