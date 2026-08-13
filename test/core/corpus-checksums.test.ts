import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { computeItemChecksum, parseItem } from '../../src/core/item.ts';
import { loadLayer } from '../../src/core/rebuild.ts';

// This project's OWN `.my_context/` is real committed knowledge, not a test
// fixture — but that means nothing else guards it against the exact class of
// corruption `validateObservationText` (mutate.ts) refuses at the write
// boundary: content that was silently truncated on write, before the guard
// existed, leaving a stale-but-plausible checksum as the only evidence.
// `renderItem(parseItem(file)) === file` does NOT catch this — the file is
// internally self-consistent, round-tripping to itself byte for byte, even
// though it no longer matches what was actually written. Only the recorded
// checksum disagreeing with a fresh hash of the parsed content catches it.
//
// Located via import.meta.url (not process.cwd()) so this test is correct
// regardless of the directory `node --test` happens to be invoked from.
const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const MY_CONTEXT_ROOT = path.join(REPO_ROOT, '.my_context');

test('every item in this repo\'s own .my_context/ has a checksum that matches its content', () => {
  if (!existsSync(MY_CONTEXT_ROOT)) {
    // Nothing to guard in an environment that doesn't carry the corpus
    // (e.g. a packaged install with no dogfooded knowledge) — not a failure.
    return;
  }

  const errors: { file: string; message: string }[] = [];
  const items = loadLayer(MY_CONTEXT_ROOT, 'project', errors);

  const mismatches: string[] = [];
  for (const item of items) {
    if (!item.checksum) {
      mismatches.push(`${item.filePath}: no checksum recorded`);
      continue;
    }
    const expected = computeItemChecksum(item);
    if (expected !== item.checksum) {
      mismatches.push(
        `${item.filePath}: recorded ${item.checksum}, content hashes to ${expected}`,
      );
    }
  }

  assert.deepEqual(
    mismatches, [],
    `corpus checksum mismatch — these items were altered (or truncated on write) after their ` +
    `checksum was recorded:\n${mismatches.join('\n')}`,
  );
  assert.deepEqual(errors, [], `corpus load errors:\n${errors.map((e) => `${e.file}: ${e.message}`).join('\n')}`);
});

test('parsing this repo\'s .my_context/ items directly also surfaces the mismatch', () => {
  if (!existsSync(MY_CONTEXT_ROOT)) return;

  const target = path.join(
    MY_CONTEXT_ROOT, 'items', 'open_question', 'OPENQ-how-do-filters-respect-dependencies.md',
  );
  if (!existsSync(target)) return;

  const raw = readFileSync(target, 'utf8');
  const item = parseItem(raw, 'items/open_question/OPENQ-how-do-filters-respect-dependencies.md', 'project');
  const expected = computeItemChecksum(item);
  assert.equal(
    expected, item.checksum,
    `OPENQ-how-do-filters-respect-dependencies should have a checksum matching its (repaired) content`,
  );
});
