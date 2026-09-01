/**
 * Tasks 4 and 5 of web-UI plan 2 — search, the glob tester and the overlap
 * hint. Split from `read-model-work.test.ts`, which holds Task 3's revision
 * and draft queues: the two tasks were built on separate branches and each
 * brought its own `workspace()` fixture, one building items through
 * `createItem` and one building files on disk. Keeping both files keeps both
 * fixtures, unedited, rather than folding two different setups into one name.
 */
/**
 * The Work read model: `/api/search`, `/api/glob` and `/api/overlap`.
 *
 * Three properties are load-bearing here.
 *
 * 1. **`/api/search` IS `filterItems`.** The predicate behind `query_items`
 *    and `mycontext search` gets a third caller, not a fourth spelling — so
 *    the `path` filter goes through `matchesScope` and an UNSCOPED item still
 *    matches a path, which is the one behaviour a hand-written server-side
 *    filter has already got wrong once in this project.
 * 2. **Nothing is dropped silently.** An unknown parameter, a status or
 *    relation outside its closed vocabulary, a category this config does not
 *    declare, a non-positive limit, a missing glob pattern — every one is a
 *    refusal that names what was wrong, and truncation is REPORTED rather
 *    than being the difference between two 200s that look alike.
 * 3. **The vocabularies are the originals, not copies.** `STATUSES` and
 *    `RELATION_TYPES` are imported from the modules that own them and the
 *    refusal wording is asserted against those same lists, so a copy cannot
 *    be introduced here and stay green.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { apiGlob, apiOverlap, apiSearch, overlapScore } from '../../src/ui/read-model-work.ts';
import type { Item } from '../../src/core/types.ts';
import { STATUSES } from '../../src/core/validate.ts';
import { RELATION_TYPES } from '../../src/core/vocabulary.ts'; // imports nothing; safe for the server too

// No mirror-pinning test: there is no mirror. `test/core/vocabulary-graph.test.ts`
// asserts the property that made mirrors necessary -- that reading a vocabulary
// reaches no mutating function -- so the server imports the originals.

/**
 * A real workspace built through the real CLI (plan 1's fixture pattern).
 *
 * **Every exit code is checked**, for the reason `server-e2e.test.ts`'s
 * `project()` records: a fixture that half-built itself turns these tests into
 * assertions over an empty corpus. That is not hypothetical here — the plan's
 * own version of this helper called `add` without `--yes` (refused outright:
 * stdin is not interactive) and passed `--always` to `add`, which has no such
 * option. Both failures were silent, and the corpus they left behind had no
 * items and no `.index.db` at all.
 *
 * `always` is therefore set the way the CLI actually offers it — `edit
 * --always=true`, exactly as `project()` does.
 */
function workspace(): { dir: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-work-'));
  const run = (args: string[]): void => {
    assert.equal(runCli(args, dir, () => {}), 0, `fixture command failed: ${args.join(' ')}`);
  };
  run(['init']);
  run(['add', 'rule', 'Always use POSIX paths', '--scope', 'src/**', '--body', 'Use POSIX.', '--yes']);
  run(['add', 'rule', 'Pin me', '--body', 'Pinned body.', '--yes']);
  run(['edit', 'RULE-pin-me', '--always=true', '--yes']);
  return { dir, done: () => removeTree(dir) };
}

test('/api/search filters through filterItems and reports truncation', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const byText = apiSearch(ws, new URL('http://x/api/search?text=POSIX'));
    assert.equal(byText.status, 200);
    const body = byText.body as { items: { id: string; phrase: string }[]; total: number; truncated: boolean };
    assert.equal(body.total, 1);
    assert.equal(body.truncated, false);
    assert.equal(typeof body.items[0].phrase, 'string');

    // path goes through matchesScope, so the UNSCOPED pinned rule matches too:
    const byPath = apiSearch(ws, new URL('http://x/api/search?path=src/a.ts'));
    assert.equal((byPath.body as { total: number }).total, 2);

    const limited = apiSearch(ws, new URL('http://x/api/search?path=src/a.ts&limit=1'));
    const lim = limited.body as { items: unknown[]; total: number; truncated: boolean };
    assert.equal(lim.items.length, 1);
    assert.equal(lim.total, 2);
    assert.equal(lim.truncated, true);
  } finally { done(); }
});

test('/api/search refuses: no filter, bad enums, unknown category, unknown params, bad limit', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    for (const bad of [
      '',                       // no filter at all — "everything" is `list`, refused as the CLI refuses it
      'status=nope&text=x',     // invalid status
      'relation=nope&text=x',   // invalid relation
      'type=nope',              // unknown category under this config
      'text=x&sesion=1',        // unknown parameter
      'text=x&limit=0',         // limit must be a positive integer
      'text=x&limit=abc',
    ]) {
      const result = apiSearch(ws, new URL(`http://x/api/search?${bad}`));
      assert.equal(result.status, 400, bad);
    }

    // The refusals quote the ORIGINALS. A copied vocabulary could drift from
    // these lists silently; asserted against the imported ones, it cannot.
    const status = apiSearch(ws, new URL('http://x/api/search?status=nope&text=x'));
    assert.ok((status.body as { error: string }).error.includes(STATUSES.join(', ')));
    const relation = apiSearch(ws, new URL('http://x/api/search?relation=nope&text=x'));
    assert.ok((relation.body as { error: string }).error.includes(RELATION_TYPES.join(', ')));
  } finally { done(); }
});

test('/api/glob matches files with matchesAnyGlob and reports the real total', () => {
  const { dir, done } = workspace();
  try {
    mkdirSync(path.join(dir, 'src'), { recursive: true });
    writeFileSync(path.join(dir, 'src', 'a.ts'), '');
    writeFileSync(path.join(dir, 'src', 'b.ts'), '');
    writeFileSync(path.join(dir, 'top.md'), '');
    const ws = resolveWorkspace(dir);
    const result = apiGlob(ws, new URL('http://x/api/glob?pattern=src/**'));
    assert.equal(result.status, 200);
    const body = result.body as { patterns: string[]; total: number; sample: string[] };
    assert.deepEqual(body.patterns, ['src/**']);
    assert.equal(body.total, 2);
    assert.ok(body.sample.includes('src/a.ts') && body.sample.includes('src/b.ts'));
    assert.ok(!body.sample.includes('top.md'));

    assert.equal(apiGlob(ws, new URL('http://x/api/glob')).status, 400);           // pattern required
    assert.equal(apiGlob(ws, new URL('http://x/api/glob?pattern=')).status, 400);  // empty refused
    assert.equal(apiGlob(ws, new URL('http://x/api/glob?pattern=src/**&x=1')).status, 400);
  } finally { done(); }
});

/**
 * A pattern arrives from a caller, so "can one escape the workspace" has to be
 * answered rather than assumed. It cannot, and the reason is structural rather
 * than a validation step: the pattern never reaches the filesystem.
 * `listRepoFiles` walks from the repo root and emits root-relative POSIX paths
 * only, so every subject offered to `matchesAnyGlob` is already inside the
 * root, and a pattern that normalizes to `../…` or to an absolute path matches
 * none of them. A sibling directory whose NAME merely starts with the root's
 * is covered too, for the reason `ui/static.ts` records for its own
 * containment check — it is never walked, so it can never be matched.
 *
 * This test is what stops a later edit from turning the walk into a
 * pattern-driven filesystem read without anything noticing.
 */
test('/api/glob cannot be steered outside the repository root', () => {
  const { dir, done } = workspace();
  // A SIBLING whose name merely STARTS WITH the root's — the case a bare
  // `startsWith` containment check passes and `ui/static.ts` is careful about.
  const sibling = `${dir}-sibling`;
  try {
    mkdirSync(sibling, { recursive: true });
    writeFileSync(path.join(sibling, 'secret.txt'), 'not yours');
    mkdirSync(path.join(dir, 'src'), { recursive: true });
    writeFileSync(path.join(dir, 'src', 'a.ts'), '');
    const ws = resolveWorkspace(dir);
    for (const pattern of [
      '../**', '../../**', 'src/../../**',
      `../${path.basename(sibling)}/**`,
      `${path.basename(dir)}-sibling/**`,
      '/**', '**/secret.txt', 'secret.txt',
    ]) {
      const result = apiGlob(ws, new URL(`http://x/api/glob?pattern=${encodeURIComponent(pattern)}`));
      assert.equal(result.status, 200, pattern);
      const body = result.body as { total: number; sample: string[] };
      assert.ok(!body.sample.some((f) => f.includes('secret.txt')), `${pattern} reached outside the root`);
      assert.ok(!body.sample.some((f) => f.startsWith('..')), `${pattern} emitted a path above the root`);
    }
    // …and the walk itself still works, so the assertions above are not
    // passing merely because nothing was ever matched.
    const inside = apiGlob(ws, new URL('http://x/api/glob?pattern=src/**'));
    assert.equal((inside.body as { total: number }).total, 1);
  } finally { done(); removeTree(sibling); }
});

// --- Capture-time overlap ---------------------------------------------------

test('overlapScore is high for near-duplicates, low for unrelated text, and deterministic', () => {
  // A full `Item`, annotated rather than asserted `as const`: the plan's
  // version was `as const`, which makes every array readonly and so assignable
  // to nothing that takes an `Item`, and it omitted `steps` entirely.
  const posix: Item = {
    id: 'RULE-p', type: 'rule', title: 'Always use POSIX paths', status: 'active',
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'c', extra: {},
    body: 'Use POSIX paths in every module.', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/RULE-p.md',
  };
  const near = overlapScore({ title: 'Use POSIX paths always', body: 'POSIX paths in every module.' }, posix);
  const far = overlapScore({ title: 'Rotate the signing key quarterly', body: 'Key rotation cadence.' }, posix);
  assert.ok(near > 0.5, `near-duplicate scored ${near}`);
  assert.ok(far < 0.2, `unrelated scored ${far}`);
  assert.equal(near, overlapScore({ title: 'Use POSIX paths always', body: 'POSIX paths in every module.' }, posix));

  // A short draft that is a SUBSET of a long item still surfaces — the reason
  // containment is in the formula beside jaccard rather than jaccard alone.
  const subset = overlapScore({ title: 'POSIX paths', body: '' }, posix);
  assert.ok(subset >= 0.2, `a contained draft scored ${subset}`);
  // Nothing to compare is 0, not NaN: an empty draft must not rank first.
  assert.equal(overlapScore({ title: '', body: '' }, posix), 0);
});

test('/api/overlap returns scored candidates and refuses a malformed body', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const url = new URL('http://x/api/overlap');
    const result = apiOverlap(ws, url, { title: 'Always use POSIX paths', body: 'Use POSIX.' });
    assert.equal(result.status, 200);
    const candidates = (result.body as { candidates: { id: string; score: number }[] }).candidates;
    assert.ok(candidates.length >= 1);
    assert.equal(typeof candidates[0].score, 'number');
    // Highest first:
    for (let i = 1; i < candidates.length; i++) {
      assert.ok(candidates[i - 1].score >= candidates[i].score);
    }

    assert.equal(apiOverlap(ws, url, { body: 'no title' }).status, 400);
    assert.equal(apiOverlap(ws, url, 'not an object').status, 400);
    assert.equal(apiOverlap(ws, url, undefined).status, 400);
  } finally { done(); }
});
