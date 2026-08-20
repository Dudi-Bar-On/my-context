import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseItem, renderItem } from '../../src/core/item.ts';
import { validateBody } from '../../src/core/validate.ts';
import {
  isSnapshot, largestFullTextBudget, readSnapshot, snapshotBody, snapshotBudgetLine,
  snapshotChecksum, snapshotSource, snapshotText, SNAPSHOT_MAX_BYTES,
} from '../../src/core/reference.ts';
import { checksum } from '../../src/core/slug.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * The snapshot format, which is the part of `reference` that could go wrong
 * silently.
 *
 * An item's body is the prose BEFORE its first `## ` section (`splitSections`,
 * item.ts). A Markdown roadmap is nothing but headings, so storing one raw
 * would either be refused at the write boundary or — if `validateBody` were
 * ever relaxed — lose everything from the first heading onward on the next
 * `persist`, with no error. `snapshotBody` quotes the file to close that, and
 * the tests below are what stop the quoting being removed as decoration.
 */

function scratch(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-ref-'));
}

/** A file with every shape that breaks a raw body: `#`, `##`, blanks, `---`. */
const HOSTILE = [
  '# Billing roadmap',
  '',
  '## Q3',
  '',
  '- usage-based pricing',
  '',
  '---',
  '',
  '## Observations',
  '',
  '- [not] a real observation',
].join('\n');

test('a raw Markdown file is refused as a body — which is why the quoting exists', () => {
  // Not vacuous, and the whole justification for `snapshotBody`: if this ever
  // stops throwing, the format changed and the quoting should be revisited
  // rather than kept out of habit.
  assert.throws(() => validateBody(HOSTILE), /starts with a Markdown/);
});

test('the quoted body survives validateBody and the render/parse round trip', () => {
  const body = snapshotBody(snapshotText(HOSTILE));
  validateBody(body);

  const item: Item = {
    id: 'REF-x', type: 'reference', title: 'X', status: 'active', severity: 'soft',
    always: false, scope: [], tags: [], origin: 'human',
    sourceFile: 'docs/x.md', sourceAnchor: null, sourceChecksum: snapshotChecksum(HOSTILE),
    validFrom: '2026-08-16', validUntil: null, checksum: '', extra: {},
    body, steps: [], observations: [], relations: [], layer: 'project', filePath: 'items/reference/REF-x.md',
  };

  const reparsed = parseItem(renderItem(item), item.filePath, 'project');
  assert.equal(reparsed.body, body, 'the snapshot did not round-trip through Markdown');
  assert.deepEqual(reparsed.observations, [],
    'a "## Observations" line INSIDE the snapshot must not become a section of the item');
  assert.equal(snapshotSource(reparsed.body), snapshotText(HOSTILE),
    'the file could not be recovered from the item that came back off disk');
});

test('snapshotSource is the exact inverse of snapshotBody', () => {
  for (const text of [HOSTILE, 'one line', '', 'a\n\nb', '   leading space kept']) {
    const normalized = snapshotText(text);
    assert.equal(snapshotSource(snapshotBody(normalized)), normalized, JSON.stringify(text));
  }
});

test('the recorded checksum is over the FILE, never over the quoted form', () => {
  // A reader who checksums the file by hand has to get the number the item
  // carries. Checksumming the stored body instead would be invisible until
  // someone tried it.
  assert.equal(snapshotChecksum(HOSTILE), checksum(snapshotText(HOSTILE)));
  assert.notEqual(snapshotChecksum(HOSTILE), checksum(snapshotBody(snapshotText(HOSTILE))));
});

test('isSnapshot separates a snapshot from an ingested item and from a plain one', () => {
  const base = { sourceFile: 'docs/x.md', sourceAnchor: null, sourceChecksum: 'abc' };
  assert.equal(isSnapshot(base as Item), true);
  assert.equal(isSnapshot({ ...base, sourceAnchor: 'q3' } as Item), false,
    'an ingested item holds an extraction, not a copy, and must not be refreshable');
  assert.equal(isSnapshot({ ...base, sourceChecksum: null } as Item), false);
  assert.equal(isSnapshot({ ...base, sourceFile: null } as Item), false);
});

test('readSnapshot records a repo-relative path, the file text, and the quoted body', () => {
  const root = scratch();
  try {
    mkdirSync(path.join(root, 'docs'));
    writeFileSync(path.join(root, 'docs', 'r.md'), `${HOSTILE}\n`, 'utf8');
    const snap = readSnapshot(root, path.join(root, 'docs'), 'r.md');
    assert.equal(snap.sourceFile, 'docs/r.md', 'the path is stored relative to the REPO root');
    assert.equal(snap.text, snapshotText(HOSTILE));
    assert.equal(snap.body, snapshotBody(snapshotText(HOSTILE)));
    assert.equal(snap.checksum, snapshotChecksum(HOSTILE));
    // Measured over the BODY: the `> ` prefixes are injected too, so charging
    // for the file alone would understate what the item costs.
    assert.ok(snap.cost.tokens > Math.ceil(snapshotText(HOSTILE).length / 4));
  } finally {
    removeTree(root);
  }
});

test('every refusal names the file and creates nothing', () => {
  const root = scratch();
  try {
    assert.throws(() => readSnapshot(root, root, 'nope.md'), /could not be read/);

    mkdirSync(path.join(root, 'adir'));
    assert.throws(() => readSnapshot(root, root, 'adir'), /is a directory/);

    writeFileSync(path.join(root, 'empty.md'), '   \n\n', 'utf8');
    assert.throws(() => readSnapshot(root, root, 'empty.md'), /is empty/);

    writeFileSync(path.join(root, 'bin.dat'), Buffer.from([0x61, 0x00, 0x62]));
    assert.throws(() => readSnapshot(root, root, 'bin.dat'), /NUL bytes/);

    writeFileSync(path.join(root, 'big.md'), 'x'.repeat(SNAPSHOT_MAX_BYTES + 1), 'utf8');
    assert.throws(() => readSnapshot(root, root, 'big.md'), /over the \d+-byte limit/);

    // Outside the repository: refused whether or not something is there,
    // because `doctor` would never be able to verify it.
    const outside = scratch();
    try {
      writeFileSync(path.join(outside, 'o.md'), 'content\n', 'utf8');
      assert.throws(() => readSnapshot(root, root, path.join(outside, 'o.md')),
        /outside this repository/);
    } finally {
      removeTree(outside);
    }
  } finally {
    removeTree(root);
  }
});

test('a file exactly at the limit is accepted — the refusal is above it, not at it', () => {
  const root = scratch();
  try {
    writeFileSync(path.join(root, 'edge.md'), 'x'.repeat(SNAPSHOT_MAX_BYTES), 'utf8');
    assert.equal(readSnapshot(root, root, 'edge.md').cost.bytes > 0, true);
  } finally {
    removeTree(root);
  }
});

test('largestFullTextBudget ignores the index budget, which pays for one-liners', () => {
  assert.equal(largestFullTextBudget({ pinned: 10, jit: 20, restored: 30, index: 9999 }), 30);
});

test('the budget line refuses to claim a cost the rationale tier does not have', () => {
  const cost = { bytes: 100_000, lines: 4000, tokens: 25_000 };
  const rationale = snapshotBudgetLine(cost, 'rationale', 8000);
  assert.match(rationale, /never injected in full and costs the injection budget nothing/);
  // And it does not stop there: retiering is the user's call, and what it
  // costs is the sentence this project is not allowed to soften.
  assert.match(rationale, /changes what governs this project/);

  const overBudget = snapshotBudgetLine(cost, 'normative', 8000);
  assert.match(overBudget, /can never be injected in full/);
  assert.match(overBudget, /spill/);

  const withinBudget = snapshotBudgetLine({ ...cost, tokens: 100 }, 'normative', 8000);
  assert.doesNotMatch(withinBudget, /can never be injected in full/);
  assert.match(withinBudget, /competes for the injection budget/);
});
