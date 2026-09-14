// @basis TASK-seven-gates-cannot-be-shown-to-go-red-and-one-of-them-has-no, INV-nothing-is-dropped-silently, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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
const ITEMS_ROOT = path.join(MY_CONTEXT_ROOT, 'items');

/* ── THE THREE SILENT EXITS THIS FILE USED TO HAVE, AND WHY THEY ARE GONE ────
 *
 * This file guards the ONE corruption class nothing else catches, and until
 * now it could report green three different ways without examining a byte:
 *
 *  1. `if (!existsSync(MY_CONTEXT_ROOT)) return;` — argued as "a packaged
 *     install with no dogfooded knowledge". That environment does not exist
 *     for this file: `package.json`'s `files` list is `src/`, `commands/`,
 *     `skills/`, `hooks/`, `.claude-plugin/` and `.mcp.json`, so `test/` is
 *     never published and this test never runs anywhere but in this tree. An
 *     escape hatch for an unreachable case is indistinguishable from the
 *     vacuous pass it looks like, so the absence of the corpus is now a
 *     FAILURE that names what it could not find.
 *  2. **No floor on `items`.** `loadLayer` returning `[]` — a moved directory,
 *     a changed layer name, a parser that started throwing every file into
 *     `errors` — made both `deepEqual`s green over the whole corpus
 *     unexamined. The count is derived from the tree on every run and never
 *     pinned: what is asserted is that files were found AND that an item was
 *     produced for each of them.
 *  3. **A pinned literal filename in the second test**, guarded by
 *     `if (!existsSync(target)) return;`. Renaming or retiring that one item —
 *     routine work in this corpus — silently deleted the test. It now walks
 *     every item file there is.
 */

/** Every `*.md` under `dir`, recursively, as corpus-root-relative POSIX paths. */
function mdUnder(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) mdUnder(full, out);
    else if (entry.name.endsWith('.md')) out.push(path.relative(MY_CONTEXT_ROOT, full).split(path.sep).join('/'));
  }
  return out;
}

/**
 * Every file `loadLayer` will walk: `items/` AND `.drafts/`.
 *
 * Both, because the loader loads both — measured, and it is the reason the
 * floor below compares SETS rather than counts: reading only `items/` made
 * 1,239 files answer 1,246 items, which looks like a defect and is the seven
 * drafts this corpus is carrying.
 */
function corpusFiles(): string[] {
  return [...mdUnder(ITEMS_ROOT), ...mdUnder(path.join(MY_CONTEXT_ROOT, '.drafts'))].sort();
}

test('every item in this repo\'s own .my_context/ has a checksum that matches its content', () => {
  assert.ok(
    existsSync(MY_CONTEXT_ROOT),
    `${MY_CONTEXT_ROOT} is not there. This file does not ship — package.json's \`files\` list `
    + 'excludes `test/` — so there is no environment in which this test legitimately has no '
    + 'corpus to read. Nothing was checked, which is not the same as nothing being wrong.',
  );

  const files = corpusFiles();
  assert.ok(files.length > 0, `no item files under ${ITEMS_ROOT}: the walk found nothing to check`);

  const errors: { file: string; message: string }[] = [];
  const items = loadLayer(MY_CONTEXT_ROOT, 'project', errors);
  // The floor, and it is the FILE SET rather than a number written here: a
  // loader that returned [] over a thousand real files passed both assertions
  // below, and a loader that dropped half of them would have passed a bare
  // `items.length > 0` too. Named files, so the failure says WHICH.
  const seen = new Set([...items.map((i) => i.filePath), ...errors.map((e) => e.file)]);
  const unexamined = files.filter((f) => !seen.has(f));
  assert.deepEqual(
    unexamined, [],
    `${files.length} corpus file(s) are on disk and ${unexamined.length} of them came back from `
    + 'loadLayer as neither an item nor a load error. Every file must come back as one or the '
    + `other, or this test is checking a subset it cannot name:\n${unexamined.join('\n')}`,
  );

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
  // The point of the second pass is that it does NOT go through `loadLayer`:
  // a defect in the loader's own checksum handling would hide from the test
  // above and not from this one. It used to make that point about exactly one
  // item, named by a literal filename that routine work renames.
  const files = corpusFiles();
  assert.ok(files.length > 0, `no item files under ${ITEMS_ROOT}: this pass examined nothing`);

  const mismatches: string[] = [];
  let checked = 0;
  for (const rel of files) {
    const item = parseItem(readFileSync(path.join(MY_CONTEXT_ROOT, rel), 'utf8'), rel, 'project');
    checked++;
    const expected = computeItemChecksum(item);
    if (expected !== item.checksum) mismatches.push(`${rel}: recorded ${item.checksum}, parses to ${expected}`);
  }
  assert.equal(checked, files.length, 'a file was skipped without being reported');
  assert.deepEqual(
    mismatches, [],
    `parsed directly (not through loadLayer), these items do not hash to their recorded `
    + `checksum:\n${mismatches.join('\n')}`,
  );
});
