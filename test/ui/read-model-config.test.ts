import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { resolveConfig, skippedKeyNotice } from '../../src/core/config.ts';
import { removeTree } from '../helpers/tmp.ts';
import { apiConfigGet, apiConfigCheck, apiConfigPreview } from '../../src/ui/read-model-config.ts';

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
 * refused by name (`config.ts` · `function requireBudgets(raw: unknown): Budgets {` · ~1004)
 * and a non-string `watchedDocs` entry is refused rather than filtered
 * (`config.ts` · `function requireWatchedDocs(raw: unknown): string[] {` · ~1050).
 * So they arrive as `ok: false` carrying the loader's wording, NOT as findings —
 * and this test asserts that, because a `dropped` entry for a case the loader
 * refuses would describe leniency the product no longer has.
 *
 * The third is a skip and a DISCLOSURE, not a silence: an unknown top-level key
 * is carried on the resolved config (`config.ts` · `  skippedKeys: string[];` · ~352)
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

/**
 * Task 7: the preview.
 *
 * `PREVIEW` spells the select grammar as a query string because that is where
 * the preview takes it from — the same parser `/api/select` uses, so the
 * budget half below is answered for the session the reader has selected rather
 * than for an invented one.
 */
const PREVIEW = (qs: string): URL => new URL(`http://x/api/config/preview?${qs}`);

test('scopePolicy inert names the unscoped items that become injectable nowhere', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiConfigPreview(ws, PREVIEW('event=session-start&cold=1'), {
      candidate: { categories: { rule: { scopePolicy: 'inert' } } },
    });
    assert.equal(result.status, 200);
    const body = result.body as {
      scopePolicy: { category: string; before: string; after: string; unscopedItems: { id: string }[] }[];
      governing: { stopsBeingInjected: { id: string; gateAfter: string }[] };
    };
    const rulePolicy = body.scopePolicy.find((p) => p.category === 'rule');
    assert.ok(rulePolicy);
    assert.deepEqual([rulePolicy.before, rulePolicy.after], ['global', 'inert']);
    assert.equal(rulePolicy.unscopedItems.length, 1); // the 'Unscoped rule' fixture item
    // And the governing diff agrees: injection() under inert refuses the unscoped rule.
    const stopped = body.governing.stopsBeingInjected.find(
      (i) => i.id === rulePolicy.unscopedItems[0].id);
    assert.ok(stopped);
    // WHICH gate the candidate config closes, as a code rather than as prose:
    // rung 4, the scope gate — under `inert` an unscoped item is matched by
    // no path at all, which is `matchesScope` refusing it everywhere.
    assert.equal(stopped.gateAfter, 'scope');
  } finally { done(); }
});

test('disabling a category shows the governing-set diff, not a warning', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiConfigPreview(ws, PREVIEW('event=session-start&cold=1'), {
      candidate: { categories: { rule: { enabled: false } } },
    });
    const body = result.body as {
      governing: {
        stopsBeingInjected: { phraseBefore: string; phraseAfter: string; gateAfter: string }[];
        becomesInjected: unknown[];
      };
    };
    assert.ok(body.governing.stopsBeingInjected.length >= 1);
    assert.equal(body.governing.becomesInjected.length, 0);
    // The phrases are `injection()`'s, not this module's: a preview that
    // worded the verdict itself would be a second spelling of one fact.
    assert.match(body.governing.stopsBeingInjected[0].phraseAfter, /is disabled in this project/);
    // And the rung, which the sentence alone cannot be asked for: 1, the
    // eligibility gate. Same branch of `injection()` writes both halves — a
    // disabled category and an inert scopePolicy differ by a WORD here, where
    // in English they differ by two unrelated sentences.
    assert.equal(body.governing.stopsBeingInjected[0].gateAfter, 'eligible');
  } finally { done(); }
});

test('agentEdits allow names the items an agent could rewrite from tomorrow', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiConfigPreview(ws, PREVIEW('event=session-start&cold=1'), {
      candidate: { categories: { rule: { agentEdits: 'allow' } } },
    });
    const body = result.body as {
      agentEdits: { category: string; before: string; after: string; items: { id: string }[] }[];
      governing: { becomesInjected: unknown[]; stopsBeingInjected: unknown[] };
    };
    const change = body.agentEdits.find((c) => c.category === 'rule');
    assert.ok(change);
    assert.deepEqual([change.before, change.after], ['review', 'allow']);
    assert.ok(change.items.length >= 1);
    // agentEdits moves who may write an item, never whether it is injected.
    assert.deepEqual(body.governing.becomesInjected, []);
    assert.deepEqual(body.governing.stopsBeingInjected, []);
  } finally { done(); }
});

test('a budgets change runs the real selector under both configs', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    // `--always` is NOT an `add` option (the same plan-fixture correction
    // `test/ui/read-model-work.test.ts` records); it is set afterwards by
    // `edit --always=true`, which is how a pinned item really comes to exist.
    assert.equal(runCli(
      ['add', 'rule', 'Pinned', '--body', 'A pinned body long enough to cost tokens.', '--yes'],
      dir, () => {}), 0);
    assert.equal(runCli(['edit', 'RULE-pinned', '--always=true', '--yes'], dir, () => {}), 0);

    const result = apiConfigPreview(ws, PREVIEW('event=session-start&cold=1'), {
      candidate: { budgets: { pinned: 1 } },
    });
    const body = result.body as {
      selection: { before: { full: unknown[]; spilled: unknown[] }; after: { full: unknown[]; spilled: unknown[] } };
    };
    assert.ok(body.selection.before.full.length >= 1);
    assert.equal(body.selection.after.full.length, 0);    // nothing fits a 1-token pinned budget
    assert.ok(body.selection.after.spilled.length >= 1);  // what starts spilling, named
  } finally { done(); }
});

test('an unloadable candidate is 400 with resolveConfig wording; bad query grammar is 400', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const bad = apiConfigPreview(ws, PREVIEW('event=session-start&cold=1'), {
      candidate: { profile: 'nope' },
    });
    assert.equal(bad.status, 400);
    assert.match((bad.body as { error: string }).error, /unknown profile/);

    assert.equal(apiConfigPreview(ws, PREVIEW('event=tool&cold=1'), { candidate: {} }).status, 400); // tool without path
    assert.equal(apiConfigPreview(ws, PREVIEW(''), { candidate: {} }).status, 400);                  // no event
    // A malformed BODY is refused too, and it is a different refusal from an
    // unloadable candidate: "I could not read what you sent" is not "your
    // config is invalid".
    const noBody = apiConfigPreview(ws, PREVIEW('event=session-start&cold=1'), undefined);
    assert.equal(noBody.status, 400);
    assert.match((noBody.body as { error: string }).error, /takes a JSON body/);
  } finally { done(); }
});

test('an identical candidate is an all-empty diff — every item counted as unchanged', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiConfigPreview(ws, PREVIEW('event=session-start&cold=1'), {
      // What `mycontext init` writes, so the candidate resolves to the config
      // already in force. A preview that reported a change here would be
      // reporting its own noise.
      candidate: { profile: 'standard', categories: {}, budgets: {} },
    });
    const body = result.body as {
      governing: { becomesInjected: unknown[]; stopsBeingInjected: unknown[]; unchanged: number };
      agentEdits: unknown[];
      scopePolicy: unknown[];
      selection: { before: { tokens: number }; after: { tokens: number } };
    };
    assert.deepEqual(body.governing.becomesInjected, []);
    assert.deepEqual(body.governing.stopsBeingInjected, []);
    assert.equal(body.governing.unchanged, 1); // the whole fixture corpus
    assert.deepEqual(body.agentEdits, []);
    assert.deepEqual(body.scopePolicy, []);
    assert.equal(body.selection.after.tokens, body.selection.before.tokens);
  } finally { done(); }
});
