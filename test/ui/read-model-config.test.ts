import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { resolveConfig, skippedKeyNotice } from '../../src/core/config.ts';
import { removeTree } from '../helpers/tmp.ts';
import { apiConfigGet, apiConfigCheck } from '../../src/ui/read-model-config.ts';

/**
 * A real workspace built through the real CLI — plan 1's fixture pattern, with
 * the two deviations `test/ui/read-model-work.test.ts` established by executing
 * the plan's own sketch: `add` refuses without `--yes` when stdin is not
 * interactive, and cleanup is `removeTree`, the one owner of test
 * temp-directory removal (a bare `rmSync` here is what
 * `test/no-bare-rmsync.test.ts` fails on).
 *
 * Exactly ONE item, and it is unscoped on purpose: Task 7's `scopePolicy`
 * preview counts the items that "become injectable nowhere" under `inert`, and
 * a fixture with a second unscoped rule would make that count say nothing.
 */
function workspace(): { dir: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-config-'));
  const run = (args: string[]): void => {
    assert.equal(runCli(args, dir, () => {}), 0, `fixture command failed: ${args.join(' ')}`);
  };
  run(['init']);
  run(['add', 'rule', 'Unscoped rule', '--body', 'Applies everywhere.', '--yes']);
  return { dir, done: () => removeTree(dir) };
}

test('/api/config reads the file fresh and reports resolved config and meta', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiConfigGet(ws, new URL('http://x/api/config'));
    assert.equal(result.status, 200);
    const body = result.body as {
      path: string; exists: boolean; parseError: string | null;
      resolved: { profile: string; categories: { name: string }[] } | null;
      meta: { profiles: string[]; agentEdits: string[]; scopePolicies: string[] };
    };
    assert.equal(body.parseError, null);
    assert.equal(body.exists, true);
    assert.equal(body.path, path.join(dir, '.my_context', 'config.json'));
    assert.equal(body.resolved?.profile, ws.config.profile);
    assert.deepEqual(body.meta.agentEdits, ['allow', 'review']);
    assert.deepEqual(body.meta.scopePolicies, ['global', 'required', 'inert']);

    // FRESH from disk: edit the file after the workspace was resolved, ask again.
    writeFileSync(path.join(dir, '.my_context', 'config.json'),
      JSON.stringify({ budgets: { jit: 123 } }));
    const again = apiConfigGet(ws, new URL('http://x/api/config'));
    assert.equal((again.body as { resolved: { budgets: { jit: number } } }).resolved.budgets.jit, 123);
  } finally { done(); }
});

test('/api/config reports unparseable JSON as a field, not a 500', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    writeFileSync(path.join(dir, '.my_context', 'config.json'), '{ not json');
    const result = apiConfigGet(ws, new URL('http://x/api/config'));
    assert.equal(result.status, 200);
    const body = result.body as { parseError: string | null; resolved: unknown };
    assert.ok(typeof body.parseError === 'string' && body.parseError.length > 0);
    assert.equal(body.resolved, null);
  } finally { done(); }
});

test('/api/config reports a resolveConfig refusal as a field, not a 500', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    writeFileSync(path.join(dir, '.my_context', 'config.json'),
      JSON.stringify({ profile: 'nope' }));
    const result = apiConfigGet(ws, new URL('http://x/api/config'));
    assert.equal(result.status, 200);
    const body = result.body as { resolveError: string | null; resolved: unknown; raw: unknown };
    assert.match(body.resolveError ?? '', /unknown profile/);
    assert.equal(body.resolved, null);
    // The unloadable file's own bytes still arrive: an editor that could not
    // see the text it must fix would have nothing to open.
    assert.deepEqual(body.raw, { profile: 'nope' });
  } finally { done(); }
});

test('/api/config/check surfaces resolveConfig refusals VERBATIM', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const url = new URL('http://x/api/config/check');

    const badProfile = apiConfigCheck(ws, url, { candidate: { profile: 'nope' } });
    assert.equal(badProfile.status, 200);
    const refusal = badProfile.body as { ok: boolean; error: string };
    assert.equal(refusal.ok, false);
    // The same wording, by construction: compare against the real throw.
    let expected = '';
    try { resolveConfig({ profile: 'nope' }); } catch (err) { expected = (err as Error).message; }
    assert.equal(refusal.error, expected);

    const badEnum = apiConfigCheck(ws, url, {
      candidate: { categories: { rule: { scopePolicy: 'everywhere' } } },
    });
    assert.equal((badEnum.body as { ok: boolean }).ok, false);

    const good = apiConfigCheck(ws, url, { candidate: { budgets: { jit: 100 } } });
    const okBody = good.body as { ok: boolean; dropped: unknown[] };
    assert.equal(okBody.ok, true);
    assert.deepEqual(okBody.dropped, []);
  } finally { done(); }
});

/**
 * Design decision 9's three loader silences, as the loader ACTUALLY behaves
 * now — which is not what this plan's Step 1 sketch assumed.
 *
 * Two of the three were closed in the loader itself: an invalid budget value is
 * refused by name (`config.ts` · `function requireBudgets(raw: unknown): Budgets {` · ~536)
 * and a non-string `watchedDocs` entry is refused rather than filtered
 * (`config.ts` · `function requireWatchedDocs(raw: unknown): string[] {` · ~582).
 * So they arrive as `ok: false` carrying the loader's wording, NOT as findings —
 * and this test asserts that, because a `dropped` entry for a case the loader
 * refuses would describe leniency the product no longer has.
 *
 * The third is a skip and a DISCLOSURE, not a silence: an unknown top-level key
 * is carried on the resolved config (`config.ts` · `  skippedKeys: string[];` · ~233)
 * and worded once by `skippedKeyNotice`. That is the whole of `dropped`.
 */
test('/api/config/check names the one thing the loader skips, and refuses the rest', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const url = new URL('http://x/api/config/check');

    const skipped = apiConfigCheck(ws, url, { candidate: { budgest: {}, budgets: { jit: 100 } } });
    const body = skipped.body as {
      ok: boolean;
      resolved: { skippedKeys: string[]; skippedNotice: string };
      dropped: { where: string; message: string }[];
    };
    assert.equal(body.ok, true); // a top-level key from a newer build must still load (R14.2)
    assert.deepEqual(body.dropped.map((d) => d.where), ['budgest']);
    assert.deepEqual(body.resolved.skippedKeys, ['budgest']);
    // The ONE wording, verbatim — `skippedKeyNotice` says a caller "cannot
    // invent a second phrasing for the same fact", so this module does not.
    const expected = skippedKeyNotice(resolveConfig({ budgest: {}, budgets: { jit: 100 } }));
    assert.equal(body.dropped[0].message, expected);
    assert.equal(body.resolved.skippedNotice, expected);

    // The two former silences are refusals now, and a refusal is not a finding.
    const badBudget = apiConfigCheck(ws, url, { candidate: { budgets: { jit: 'lots' } } });
    const budgetBody = badBudget.body as { ok: boolean; error: string };
    assert.equal(budgetBody.ok, false);
    assert.match(budgetBody.error, /budgets\.jit is "lots"/);

    const badWatched = apiConfigCheck(ws, url, { candidate: { watchedDocs: ['docs/**', 42] } });
    const watchedBody = badWatched.body as { ok: boolean; error: string };
    assert.equal(watchedBody.ok, false);
    assert.match(watchedBody.error, /watchedDocs contains 42/);
  } finally { done(); }
});

test('a malformed check body is refused', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const url = new URL('http://x/api/config/check');
    assert.equal(apiConfigCheck(ws, url, undefined).status, 400);
    assert.equal(apiConfigCheck(ws, url, { nocandidate: 1 }).status, 400);
  } finally { done(); }
});

test('an unknown query parameter is refused on both config routes', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    assert.equal(apiConfigGet(ws, new URL('http://x/api/config?profile=minimal')).status, 400);
    assert.equal(
      apiConfigCheck(ws, new URL('http://x/api/config/check?dry=1'), { candidate: {} }).status,
      400,
    );
  } finally { done(); }
});
