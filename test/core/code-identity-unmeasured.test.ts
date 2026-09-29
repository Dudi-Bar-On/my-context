// @basis TASK-an-install-whose-sources-cannot-be-walked-reports-its-code, STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is, INV-nothing-is-dropped-silently
/**
 * **An install whose sources cannot be walked has an UNMEASURED code identity,
 * and it says which directory and which error.**
 *
 * `TASK-an-install-whose-sources-cannot-be-walked-reports-its-code` (report 3,
 * `reports/2026-09-12-silent-failures-reviewed.md` m8; row 111 of
 * `reports/2026-09-13-the-consolidated-findings.md`). The item was filed
 * INFERRED and it asked for the handler to be read and the case reproduced
 * before anything was changed. Both were done, and the inference held:
 *
 *   - `src/ui/server.ts` serves `staleCode: ctx.code.isStale()` on `/api/ping`
 *     and on `/api/meta`, and nowhere else computes it.
 *   - `stampCodeIdentity` caught EVERY failure of its boot walk into a single
 *     `bootContent = null`, and `isStale()` opened with `if (bootContent ===
 *     null) return false;` — for the life of the process.
 *
 * So an install whose sources cannot be walked served `staleCode: false`, which
 * the page reads as the measured good state: `noteCodeSkew` in
 * `src/ui/public/app.js` CLEARS the banner on an explicit `false`, and
 * `freshnessOf` in `src/core/ui-server-probe.ts` maps `false` to `'fresh'`. The
 * one warning the product has for a server running code it can no longer answer
 * for was not merely unable to fire — it was actively being told everything was
 * current, by a walk that had never happened.
 *
 * **What this file pins is the measurement, not the surface.** The identity now
 * carries a third state — `unmeasured`, with the path and the errno — and
 * `freshness()` answers `'fresh' | 'stale' | 'unmeasured'` rather than a
 * boolean that has no way to say "cannot say". `isStale()` stays a boolean and
 * stays `false` in that state, because inventing a skew nobody measured is the
 * other half of the same defect; the assertions below fix that reading in place
 * so that a surface which reads the boolean alone is a visible omission rather
 * than a silent one.
 *
 * **Why two plants and not one.** ENOTDIR — a file where the directory should
 * be, the arrangement `test/core/audit.test.ts` uses — and ENOENT, a tree that
 * is simply not there. They reach `walk()` down different branches of
 * `readdirSync` and only the first would be caught by a check for existence, so
 * a fix that special-cased "missing" would pass one and fail the other.
 *
 * **Nothing here touches the repository's own `src/`.** Every tree is a
 * temporary one, for the reason `test/ui/code-skew.test.ts`'s header gives at
 * length: the fact under test is produced by breaking a source tree while
 * something reads it, and this suite runs many files at once over the real
 * checkout.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { stampCodeIdentity, type CodeScope } from '../../src/core/code-identity.ts';

/**
 * A minimal server-shaped tree: one entry module, one module it imports, one
 * asset. The same shape `test/ui/code-skew.test.ts` builds, kept local so that
 * breaking it cannot reach any other test's fixture.
 */
function codeTree(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-unmeasured-'));
  mkdirSync(path.join(root, 'ui', 'public', 'screens'), { recursive: true });
  writeFileSync(
    path.join(root, 'ui', 'server.ts'),
    "import { TRACKS } from './tracks.ts';\nexport const N = TRACKS;\n", 'utf8');
  writeFileSync(path.join(root, 'ui', 'tracks.ts'), 'export const TRACKS = 4;\n', 'utf8');
  writeFileSync(
    path.join(root, 'ui', 'public', 'screens', 'preview.js'),
    'export const TRACKS = 4;\n', 'utf8');
  return root;
}

const scopeOf = (root: string): CodeScope => ({
  entry: path.join(root, 'ui', 'server.ts'),
  assets: path.join(root, 'ui', 'public'),
});

/* -------------------------------------------------------------------------- *
 * The good state, first — so that every assertion below is a difference from a
 * reading this file itself takes, and not from one it assumes.
 * -------------------------------------------------------------------------- */

test('a tree that CAN be walked is measured, and says so', () => {
  const root = codeTree();
  try {
    const code = stampCodeIdentity(scopeOf(root));
    assert.equal(code.unmeasured, null, 'a walk that succeeded has no reason to give');
    assert.equal(code.freshness(), 'fresh');
    assert.equal(code.isStale(), false);
    assert.equal(code.files, 3, 'the import closure plus the assets');
  } finally { removeTree(root); }
});

/* -------------------------------------------------------------------------- *
 * The two ways a source tree stops being walkable.
 * -------------------------------------------------------------------------- */

test('a FILE where the asset directory should be is unmeasured, and names it', () => {
  const root = codeTree();
  try {
    // `codeTree` made `ui/public` a directory; this tree instead has a file at
    // that path, which is what an install unpacked wrong, or half-deleted,
    // looks like from `readdirSync`: ENOTDIR.
    const broken = mkdtempSync(path.join(tmpdir(), 'myctx-unmeasured-'));
    mkdirSync(path.join(broken, 'ui'), { recursive: true });
    writeFileSync(path.join(broken, 'ui', 'server.ts'), 'export const N = 4;\n', 'utf8');
    writeFileSync(path.join(broken, 'ui', 'public'), 'not a directory\n', 'utf8');
    try {
      const code = stampCodeIdentity(scopeOf(broken));
      assert.equal(code.freshness(), 'unmeasured',
        'a scope that was never walked is neither current nor stale');
      assert.notEqual(code.unmeasured, null, 'the answer carries the reason');
      assert.equal(code.unmeasured?.code, 'ENOTDIR', 'which error');
      assert.equal(code.unmeasured?.at, path.join(broken, 'ui', 'public'), 'which directory');
      assert.match(code.unmeasured?.reason ?? '', /ENOTDIR/);
      assert.ok((code.unmeasured?.reason ?? '').includes(path.join(broken, 'ui', 'public')),
        'the sentence a surface prints names the path, not just the errno');
      assert.equal(code.files, 0, 'nothing was counted, because nothing was walked');
    } finally { removeTree(broken); }
  } finally { removeTree(root); }
});

test('an asset directory that is not there at all is unmeasured, and names it', () => {
  const root = codeTree();
  try {
    const scope: CodeScope = {
      entry: path.join(root, 'ui', 'server.ts'),
      assets: path.join(root, 'ui', 'no-such-tree'),
    };
    const code = stampCodeIdentity(scope);
    assert.equal(code.freshness(), 'unmeasured');
    assert.equal(code.unmeasured?.code, 'ENOENT');
    assert.equal(code.unmeasured?.at, path.join(root, 'ui', 'no-such-tree'));
  } finally { removeTree(root); }
});

/* -------------------------------------------------------------------------- *
 * And what a comparison against an unmeasured identity may answer.
 * -------------------------------------------------------------------------- */

test('a comparison against an unmeasured identity never answers "current"', () => {
  const root = codeTree();
  try {
    const scope: CodeScope = {
      entry: path.join(root, 'ui', 'server.ts'),
      assets: path.join(root, 'ui', 'no-such-tree'),
    };
    const code = stampCodeIdentity(scope);
    assert.equal(code.freshness(), 'unmeasured');
    // Asked again, and again after the tree it could not walk APPEARS. There is
    // no boot stamp to compare against — nothing was ever read at start — so a
    // later walk cannot establish that this process is running the code in
    // front of it. Recovering to `fresh` here would be the original defect
    // arriving one minute late.
    assert.equal(code.freshness(), 'unmeasured', 'asking twice must not change the answer');
    mkdirSync(path.join(root, 'ui', 'no-such-tree'), { recursive: true });
    writeFileSync(path.join(root, 'ui', 'no-such-tree', 'a.js'), 'export const A = 1;\n', 'utf8');
    assert.equal(code.freshness(), 'unmeasured',
      'a scope that becomes walkable mid-life was still never stamped at boot');
    assert.notEqual(code.unmeasured, null, 'and the reason is still there to print');
  } finally { removeTree(root); }
});

test('the boolean stays false when unmeasured, so no skew is invented', () => {
  const root = codeTree();
  try {
    const code = stampCodeIdentity({
      entry: path.join(root, 'ui', 'server.ts'),
      assets: path.join(root, 'ui', 'no-such-tree'),
    });
    // `isStale()` has two values and the answer has three, so this boolean
    // CANNOT carry the disclosure — it answers the only value that invents
    // nothing. That is precisely why `freshness()` and `unmeasured` exist
    // beside it, and why a surface that reads `isStale()` alone still reports
    // an unwalkable install as current.
    assert.equal(code.isStale(), false);
    assert.equal(code.freshness(), 'unmeasured',
      'the fact the boolean cannot carry is carried, and a surface can read it');
  } finally { removeTree(root); }
});
