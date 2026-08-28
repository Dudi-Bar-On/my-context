/**
 * `checkBodyTruncation` — the only thing in the tool that can find an item
 * whose text is about to be deleted, or has been.
 *
 * Before it, nothing reported either state. A hand-edited file with a `## `
 * section looks like a complete item that simply says less; the next write
 * re-renders it without the section and reports success; and after
 * `mycontext repair` the checksum agrees with the shortened content, so even
 * the stale-checksum signal is gone. Two task bodies in this repository's own
 * corpus were caught only because a later edit's anchor was missing and
 * somebody went looking for why.
 *
 * The two codes are deliberately different levels, and the tests say why:
 * `body_truncation` is a MEASUREMENT of a file that exists, so it is an error;
 * `body_ends_unfinished` is a GUESS about text that is already gone, so it is
 * a note and its message says exactly how little it proves.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkBodyTruncation } from '../../src/doctor/checks.ts';
import { parseItem } from '../../src/core/item.ts';
import type { Item, Layer } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

function withRoot(fn: (root: string) => void): void {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-trunc-'));
  try {
    fn(root);
  } finally {
    removeTree(root);
  }
}

/** Writes an item file under `root` and returns the parsed item, as `rebuild` would. */
function item(root: string, id: string, body: string, layer: Layer = 'project'): Item {
  const rel = `items/note/${id}.md`;
  const text = `---\nid: ${id}\ntype: note\ntitle: ${id}\nstatus: active\n---\n\n# ${id}\n\n${body}\n`;
  const file = path.join(root, ...rel.split('/'));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text, 'utf8');
  return parseItem(text, rel, layer);
}

test('a healthy item produces no finding at all', () => {
  withRoot((root) => {
    const one = item(root, 'NOTE-ok', 'A finished sentence.');
    assert.deepEqual(checkBodyTruncation(root, [one]), []);
  });
});

test('a "## " section that no future write keeps is an ERROR that names the line and the size', () => {
  withRoot((root) => {
    const one = item(root, 'NOTE-cut', 'Survives.\n\n## The measurement\n\nAbout to be deleted.');
    const findings = checkBodyTruncation(root, [one]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].code, 'body_truncation');
    assert.equal(findings[0].level, 'error');
    assert.equal(findings[0].item, 'NOTE-cut');
    assert.match(findings[0].message, /## The measurement/);
    assert.match(findings[0].message, /\d+ line\(s\) \(\d+ bytes\)/);
    // The message is a route, not a diagnosis: both ways out are named.
    assert.match(findings[0].message, /\*\*Name\*\*/);
    assert.match(findings[0].message, /## Observations/);
  });
});

test('one finding per item — a measurement is not diluted with a guess beside it', () => {
  withRoot((root) => {
    const one = item(root, 'NOTE-both', 'Ends mid-sentence\n\n## A section\n\nGone.');
    const findings = checkBodyTruncation(root, [one]);
    assert.deepEqual(findings.map((f) => f.code), ['body_truncation']);
  });
});

test('a body that stops mid-sentence is a NOTE, and the note says what it cannot see', () => {
  withRoot((root) => {
    const one = item(root, 'NOTE-unfinished', 'The prose just stops here and then');
    const findings = checkBodyTruncation(root, [one]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].code, 'body_ends_unfinished');
    assert.equal(findings[0].level, 'info', 'a heuristic may not fail anybody\'s build');
    assert.match(findings[0].message, /heuristic/);
    assert.match(
      findings[0].message, /land(ed)? after a full stop leaves none at all/,
      'the limit of the guess is stated, which is the whole point of this pair of defects',
    );
  });
});

test('a body ending on a colon whose list is not there is the same note', () => {
  withRoot((root) => {
    const one = item(root, 'NOTE-colon', 'The three reasons are:');
    assert.deepEqual(checkBodyTruncation(root, [one]).map((f) => f.code), ['body_ends_unfinished']);
  });
});

test('an ordinary finished body is not guessed at', () => {
  withRoot((root) => {
    // 655 of 656 bodies in this repository's corpus end with a full stop, and
    // the check finds none of them. A detector that fired on ordinary prose
    // would be switched off within a day.
    for (const body of ['Ends with a full stop.', 'Ends with a question?', 'Ends in `code`.', 'A list item.']) {
      const one = item(root, 'NOTE-fine', body);
      assert.deepEqual(checkBodyTruncation(root, [one]), [], JSON.stringify(body));
    }
  });
});

test('an empty body is left alone — a title-only lesson is a real shape', () => {
  withRoot((root) => {
    const one = item(root, 'NOTE-empty', '');
    assert.deepEqual(checkBodyTruncation(root, [one]), []);
  });
});

test('a global-layer item is not judged against the project root', () => {
  withRoot((root) => {
    // `item.filePath` is relative to its OWN layer's root, so resolving a
    // global item against this one would read the wrong file or none at all.
    const one = item(root, 'NOTE-global', 'Survives.\n\n## A section\n\nGone.', 'global');
    assert.deepEqual(checkBodyTruncation(root, [one]), []);
  });
});

test('an unreadable file is loadLayer\'s report to make, not this check\'s', () => {
  withRoot((root) => {
    const text = '---\nid: NOTE-gone\ntype: note\ntitle: G\nstatus: active\n---\n\n# G\n\nBody.\n';
    const ghost = parseItem(text, 'items/note/NOTE-gone.md', 'project');
    assert.deepEqual(checkBodyTruncation(root, [ghost]), []);
  });
});
