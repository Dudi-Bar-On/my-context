// @basis TASK-npm-test-goes-red-on-any-machine-whose-path-mycontext-points
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scrubForeignMycontextShims } from './hermetic-path.ts';
import { removeTree } from './tmp.ts';

/**
 * `scrubForeignMycontextShims` is exercised directly against a real PATH
 * string built from real files on disk — not against `process.env.PATH` —
 * the same reasoning `test/doctor/cli-on-path.test.ts` gives for reading real
 * shim files: a fake `readFile`/`realpath` would only prove the fake agrees
 * with itself, and `readShimTarget`/`samePath` are reused from
 * `src/doctor/cli-on-path.ts` unmodified, so this is checking the scrub's own
 * directory-filtering logic, not re-deriving shim resolution.
 */

function tmp(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-hermetic-path-'));
  return { dir, cleanup: () => removeTree(dir) };
}

function write(file: string, content: string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, 'utf8');
}

/**
 * Plants a real npm-generated-shaped shim at `binDir/mycontext` whose text
 * embeds `node_modules/mycontext/<relTarget>` — the marker `readShimTarget`
 * looks for — and creates the file it points at. Mirrors
 * `test/doctor/cli-on-path.test.ts`'s `writeShim`.
 */
function writeShim(binDir: string, relTarget: string, content: string): { targetPath: string } {
  const shimPath = path.join(binDir, 'mycontext');
  write(shimPath, `#!/bin/sh\nexec node "$(dirname "$0")/node_modules/mycontext/${relTarget}" "$@"\n`);
  const targetPath = path.join(binDir, 'node_modules', 'mycontext', ...relTarget.split('/'));
  write(targetPath, content);
  return { targetPath };
}

test('a shim pointing at a DIFFERENT checkout is scrubbed; untouched entries keep their order', () => {
  const { dir, cleanup } = tmp();
  try {
    const before1 = path.join(dir, 'before1');
    const npmBin = path.join(dir, 'npmbin');
    const before2 = path.join(dir, 'before2');
    mkdirSync(before1, { recursive: true });
    mkdirSync(before2, { recursive: true });

    // The planted shim resolves into a SEPARATE temp "checkout" — not the
    // one `ownCliEntry` below names — so it is the foreign case this scrub
    // exists to remove.
    writeShim(npmBin, 'src/cli/index.ts', 'a different checkout\n');
    const ownEntry = path.join(dir, 'own-checkout', 'src', 'cli', 'index.ts');
    write(ownEntry, 'this checkout\n');

    const pathValue = [before1, npmBin, before2].join(path.delimiter);
    const result = scrubForeignMycontextShims(pathValue, ownEntry);

    assert.equal(result, [before1, before2].join(path.delimiter));
  } finally {
    cleanup();
  }
});

test('a directory holding a foreign shim AND an unrelated tool is removed whole — the pinned tradeoff', () => {
  const { dir, cleanup } = tmp();
  try {
    const before = path.join(dir, 'before');
    const npmBin = path.join(dir, 'npmbin');
    const after = path.join(dir, 'after');
    mkdirSync(before, { recursive: true });
    mkdirSync(after, { recursive: true });

    // `npmBin` holds two things, the way a real npm global-prefix bin
    // directory can: the foreign `mycontext` shim this scrub exists to
    // remove, AND an unrelated tool that happens to sit right next to it.
    // `PATH` has no way to keep one and drop the other — see the header
    // comment's "tradeoff" paragraph — so this asserts the DECISION (the
    // whole directory goes) rather than leaving it to be noticed by accident
    // the next time someone changes this function.
    writeShim(npmBin, 'src/cli/index.ts', 'a different checkout\n');
    write(path.join(npmBin, 'npm.cmd'), '@ECHO off\r\nrem an unrelated tool sharing the directory\r\n');
    const ownEntry = path.join(dir, 'own-checkout', 'src', 'cli', 'index.ts');
    write(ownEntry, 'this checkout\n');

    const pathValue = [before, npmBin, after].join(path.delimiter);
    const result = scrubForeignMycontextShims(pathValue, ownEntry);

    assert.equal(result, [before, after].join(path.delimiter));
  } finally {
    cleanup();
  }
});

test('a shim pointing at THIS repository is kept, unchanged, in place', () => {
  const { dir, cleanup } = tmp();
  try {
    const before = path.join(dir, 'before');
    const npmBin = path.join(dir, 'npmbin');
    const after = path.join(dir, 'after');
    mkdirSync(before, { recursive: true });
    mkdirSync(after, { recursive: true });

    // The shim's target IS `ownCliEntry` this time — the healthy case
    // `checkCliOnPath` itself calls silent, and this scrub must leave alone.
    const { targetPath } = writeShim(npmBin, 'src/cli/index.ts', 'this checkout, too\n');

    const pathValue = [before, npmBin, after].join(path.delimiter);
    const result = scrubForeignMycontextShims(pathValue, targetPath);

    assert.equal(result, pathValue);
  } finally {
    cleanup();
  }
});
