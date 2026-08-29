/**
 * `checkCitationForm` — the only thing that counts bare `file:line` pointers
 * where they are written.
 *
 * `scripts/verify-citations.ts` deliberately does not walk `.my_context/`: it
 * resolves citations BY FRAGMENT, and a tree whose citations carry no fragment
 * is out of scope until they do. That leaves the corpus with a form nothing can
 * check, and normalising it once does not keep it — agents and the owner write
 * `file:line` constantly. So the form is stated in a corpus `standard`, which
 * is read before the writing, and counted here, which is where the claim that
 * the writing changed can be checked rather than believed.
 *
 * Two properties are what make the check survive contact with a real corpus,
 * and both are tested below. It reports ONE finding per item, because "this
 * item's citations are unresolvable" is one fact per item and a per-pointer
 * report buries `doctor` under prose. And it ignores a pointer whose file this
 * repository does not have, because `file.ts:123` written to DESCRIBE the form
 * is far more common than a citation of a file named `file.ts` — a check that
 * reports the example as the fault it documents earns itself a permanent
 * finding nobody can ever clear.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkCitationForm } from '../../src/doctor/checks.ts';
import { parseItem } from '../../src/core/item.ts';
import type { Item, Layer } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

function withRepo(fn: (repoRoot: string) => void): void {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-cite-'));
  try {
    mkdirSync(path.join(root, 'src'), { recursive: true });
    writeFileSync(path.join(root, 'src', 'select.ts'), 'export function select() {}\n', 'utf8');
    fn(root);
  } finally {
    removeTree(root);
  }
}

function item(id: string, body: string, layer: Layer = 'project'): Item {
  const rel = `items/note/${id}.md`;
  const text = `---\nid: ${id}\ntype: note\ntitle: ${id}\nstatus: active\n---\n\n# ${id}\n\n${body}\n`;
  return parseItem(text, rel, layer);
}

test('an item with no bare pointer produces no finding', () => {
  withRepo((root) => {
    const one = item('NOTE-ok', 'The selector lives in `select.ts` and is worth reading.');
    assert.deepEqual(checkCitationForm(root, [one]), []);
  });
});

test('a citation already written in the form is not reported', () => {
  withRepo((root) => {
    // The form itself: file, verbatim fragment, optional hint. No `file:line`
    // token appears in it, which is the whole reason the check can be blunt.
    const one = item('NOTE-form', 'It is at `select.ts` · `export function select(` · ~1.');
    assert.deepEqual(checkCitationForm(root, [one]), []);
  });
});

test('a bare pointer to a file this repo HAS is one note naming the pointer and the form', () => {
  withRepo((root) => {
    const one = item('NOTE-bare', 'The selector is at `select.ts:1`, which is where to look.');
    const findings = checkCitationForm(root, [one]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.code, 'citation_form');
    assert.equal(findings[0]!.level, 'info');
    assert.equal(findings[0]!.item, 'NOTE-bare');
    assert.match(findings[0]!.message, /select\.ts:1/);
    assert.match(findings[0]!.message, /VERBATIM fragment/);
  });
});

test('a pointer whose file this repo does not have is an EXAMPLE, not a fault', () => {
  withRepo((root) => {
    const one = item('NOTE-example', 'Never write `file.ts:123`; nothing can check it.');
    assert.deepEqual(checkCitationForm(root, [one]), []);
  });
});

test('many pointers in one item are ONE finding, counted, with the first three shown', () => {
  withRepo((root) => {
    const one = item(
      'NOTE-many',
      'See `select.ts:1`, `select.ts:2`, `src/select.ts:3-9` and `select.ts:4,8`.',
    );
    const findings = checkCitationForm(root, [one]);
    assert.equal(findings.length, 1);
    assert.match(findings[0]!.message, /^4 citation\(s\)/);
    assert.match(findings[0]!.message, /select\.ts:1, select\.ts:2, src\/select\.ts:3-9, …/);
  });
});

test('two items with bare pointers are two findings, each naming its own item', () => {
  withRepo((root) => {
    const findings = checkCitationForm(root, [
      item('NOTE-a', 'at `select.ts:1`'),
      item('NOTE-b', 'also at `select.ts:2`'),
    ]);
    assert.deepEqual(findings.map((f) => f.item), ['NOTE-a', 'NOTE-b']);
  });
});

test('an item that is not this project’s is not this project’s to fix', () => {
  withRepo((root) => {
    assert.deepEqual(checkCitationForm(root, [item('NOTE-g', 'at `select.ts:1`', 'global')]), []);
  });
});
