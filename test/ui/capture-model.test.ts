/**
 * `GET /api/capture` — the Capture screen's one read.
 *
 * Every fixture item below is created through the REAL CLI, for the reason
 * `test/ui/read-model-work.test.ts` and `test/ui/read-model-config.test.ts`
 * both give: the endpoint reads what is on disk, so a corpus a test invented
 * would be a corpus the product never wrote. The two deviations those files
 * established hold here too — `add` refuses without `--yes` when stdin is not
 * interactive, and cleanup is `removeTree`, the one owner of test
 * temp-directory removal (`test/no-bare-rmsync.test.ts` fails a bare
 * `rmSync`).
 *
 * The fixture is built so that **insertion order, id order and scope
 * specificity all disagree**. That is deliberate: `cap.nosim` forbids a
 * ranking, so a test whose expected order happens to equal its insertion order
 * cannot tell an id sort from no sort at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';
import { apiCapture, type CaptureBody } from '../../src/ui/capture-model.ts';

/**
 * Seven items, chosen so each covers one branch of the predicate and no other:
 *
 *  - `INV-prices-are-integer-cents`  scope EQUALS the candidate.
 *  - `RULE-use-posix-paths`          scope is BROADER — found by reading the
 *                                    candidate as a subject.
 *  - `CONST-invoice-api-errors`      scope is NARROWER — found only by reading
 *                                    the candidate as a pattern, the second
 *                                    direction `focusMatchesScope` adds.
 *  - `RULE-applies-everywhere`       NO scope: unrestricted, so it governs
 *                                    every candidate scope there is.
 *  - `RULE-docs-only`                scope disjoint — must never appear.
 *  - `ADR-chose-postgres`            in scope, RATIONALE tier — matches and
 *                                    does not govern.
 *  - `RULE-drafted-rule`             in scope, status `draft` — matches and
 *                                    does not govern.
 *
 * `invariant`, `rule`, `constraint` and `adr` are all members of BOTH profiles
 * (`core/categories.ts` · `  minimal: [` · ~547), so this fixture does not
 * depend on which one `init` picks.
 */
function workspace(): { dir: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-capture-'));
  const run = (args: string[]): void => {
    assert.equal(runCli(args, dir, () => {}), 0, `fixture command failed: ${args.join(' ')}`);
  };
  run(['init']);
  // Insertion order is deliberately NOT id order.
  run(['add', '--summary-omitted', 'rule', 'Use POSIX paths', '--scope', 'src/**', '--body', 'POSIX.', '--yes']);
  run(['add', '--summary-omitted', 'adr', 'Chose postgres', '--scope', 'src/billing/**', '--body', 'Because.', '--yes']);
  run(['add', '--summary-omitted', 'invariant', 'Prices are integer cents',
    '--scope', 'src/billing/**', '--body', 'Integers.', '--yes']);
  run(['add', '--summary-omitted', 'rule', 'Docs only', '--scope', 'docs/**', '--body', 'Docs.', '--yes']);
  run(['add', '--summary-omitted', 'constraint', 'Invoice api errors',
    '--scope', 'src/billing/api/**', '--body', 'Problem+json.', '--yes']);
  run(['add', '--summary-omitted', 'rule', 'Applies everywhere', '--body', 'Everywhere.', '--yes']);
  run(['add', '--summary-omitted', 'rule', 'Drafted rule', '--scope', 'src/billing/**', '--body', 'Draft.', '--yes']);
  run(['edit', 'RULE-drafted-rule', '--status', 'draft', '--yes']);
  return { dir, done: () => removeTree(dir) };
}

const ask = (dir: string, query: string): { status: number; body: unknown } => {
  const ws = resolveWorkspace(dir);
  return apiCapture(ws, new URL(`http://x/api/capture${query}`));
};

const ok = (dir: string, query: string): CaptureBody => {
  const result = ask(dir, query);
  assert.equal(result.status, 200, `expected 200 for ${query}, got ${JSON.stringify(result.body)}`);
  return result.body as CaptureBody;
};

test('the governing list is the scope match in BOTH directions, plus the unscoped', () => {
  const { dir, done } = workspace();
  try {
    const body = ok(dir, '?scope=src/billing/**');
    assert.deepEqual(body.governing.map((r) => r.id), [
      // Sorted by id, which is neither the insertion order above nor any
      // ordering by how closely a scope matches.
      'CONST-invoice-api-errors',   // narrower scope — the second direction
      'INV-prices-are-integer-cents', // equal scope
      'RULE-applies-everywhere',    // no scope at all — unrestricted
      'RULE-use-posix-paths',       // broader scope — the first direction
    ]);
    // `docs/**` is disjoint and is in none of them.
    assert.equal(body.governing.some((r) => r.id === 'RULE-docs-only'), false);
    assert.deepEqual(body.scope, ['src/billing/**']);
  } finally { done(); }
});

test('an item that matches the scope but does not govern is COUNTED, never listed', () => {
  const { dir, done } = workspace();
  try {
    const body = ok(dir, '?scope=src/billing/**');
    // The rationale-tier ADR and the draft: both are scoped `src/billing/**`
    // and neither governs anything.
    assert.equal(body.notGoverning, 2);
    assert.equal(body.governing.some((r) => r.id === 'ADR-chose-postgres'), false);
    assert.equal(body.governing.some((r) => r.id === 'RULE-drafted-rule'), false);

    // And the count is a DISCLOSURE, not a constant: promote the draft through
    // the real CLI and it moves from one side of the filter to the other.
    assert.equal(runCli(['edit', 'RULE-drafted-rule', '--status', 'active', '--yes'],
      dir, () => {}), 0);
    const after = ok(dir, '?scope=src/billing/**');
    assert.equal(after.notGoverning, 1);
    assert.equal(after.governing.some((r) => r.id === 'RULE-drafted-rule'), true);
  } finally { done(); }
});

test('an unscoped item governs a scope nothing else touches', () => {
  const { dir, done } = workspace();
  try {
    // `vendor/**` matches no item's declared scope. The only thing that comes
    // back is the item with NO scope, because a scope is a restriction and an
    // absent restriction is the widest setting there is — the same reading
    // `search --path` documents.
    const body = ok(dir, '?scope=vendor/**');
    assert.deepEqual(body.governing.map((r) => r.id), ['RULE-applies-everywhere']);
    assert.equal(body.notGoverning, 0);
  } finally { done(); }
});

test('each row carries the id, the category and the tier the card prints — and nothing else', () => {
  const { dir, done } = workspace();
  try {
    const body = ok(dir, '?scope=src/billing/**');
    const row = body.governing.find((r) => r.id === 'INV-prices-are-integer-cents');
    assert.ok(row, 'the exactly-scoped invariant must be in the list');
    // `cap.o1` is the string "invariant, normative": the category and the tier,
    // in that order, and those two words are the whole second cell.
    assert.equal(row!.type, 'invariant');
    assert.equal(row!.tier, 'normative');

    // **The two rules this endpoint is governed by, asserted as one key set.**
    // No `score` and no `phrase`: `cap.nosim` forbids a similarity or a ranking
    // reaching this screen, and `overlapScore` behind `POST /api/overlap` is
    // the metric that must not be conflated with this answer. No `title`: the
    // card draws an id and two words, and a served field no screen reads is
    // the open defect `TASK-rule-on-injectedline-title-a-served-field-no-screen-reads`
    // names. A field added without a mockup element to read it fails HERE.
    for (const r of body.governing) {
      assert.deepEqual(Object.keys(r).sort(), ['id', 'tier', 'type']);
    }
    assert.deepEqual(Object.keys(body).sort(), ['governing', 'notGoverning', 'scope']);
  } finally { done(); }
});

test('the comma form ORs the patterns, and the echo shows what survived the parse', () => {
  const { dir, done } = workspace();
  try {
    const body = ok(dir, '?scope=docs/**,src/billing/**');
    assert.equal(body.governing.some((r) => r.id === 'RULE-docs-only'), true);
    assert.equal(body.governing.some((r) => r.id === 'INV-prices-are-integer-cents'), true);
    assert.deepEqual(body.scope, ['docs/**', 'src/billing/**']);

    // Empty entries are dropped by the parse, so the parse is DISCLOSED: the
    // echo is two patterns where the request named four positions.
    const messy = ok(dir, '?scope=' + encodeURIComponent(' docs/** , , src/billing/** ,'));
    assert.deepEqual(messy.scope, ['docs/**', 'src/billing/**']);
  } finally { done(); }
});

test('a scope that restricts nothing is refused rather than answered as the whole corpus', () => {
  const { dir, done } = workspace();
  try {
    // `mycontext add` with no `--scope` is a legal capture, so a screen can
    // really send these. Answering them with every item in the project, under a
    // heading reading "Already governing", is the failure this refuses.
    for (const query of ['', '?scope=', '?scope=,', '?scope=%20%2C%20']) {
      const result = ask(dir, query);
      assert.equal(result.status, 400, `expected 400 for ${JSON.stringify(query)}`);
      assert.match((result.body as { error: string }).error, /scope=<glob>/);
    }
  } finally { done(); }
});

test('an unknown parameter and a repeated one are both refused', () => {
  const { dir, done } = workspace();
  try {
    const unknown = ask(dir, '?scope=src/**&type=rule');
    assert.equal(unknown.status, 400);
    assert.match((unknown.body as { error: string }).error, /unknown parameter "type"/);

    // `URLSearchParams.get` reads the FIRST value, so without this the second
    // pattern is discarded behind a 200 — on the one parameter that IS the
    // question.
    const repeated = ask(dir, '?scope=src/**&scope=docs/**');
    assert.equal(repeated.status, 400);
    assert.match((repeated.body as { error: string }).error, /more than once/);
  } finally { done(); }
});

test('a pattern cannot reach outside the workspace, because it never reaches a filesystem', () => {
  const { dir, done } = workspace();
  try {
    // Unlike `/api/glob`, this endpoint does not walk the repository at all:
    // the pattern is matched against item scope strings held in the index. So
    // a traversal pattern is not refused, it is simply a pattern that matches
    // no item — and the unscoped item still governs it, which is the correct
    // answer rather than a leak.
    const body = ok(dir, '?scope=' + encodeURIComponent('../../../etc/**'));
    assert.deepEqual(body.governing.map((r) => r.id), ['RULE-applies-everywhere']);
    assert.equal(body.notGoverning, 0);
  } finally { done(); }
});

test('off-workspace is a named 404, and a malformed request is still refused first', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-capture-nows-'));
  try {
    // No `init`: `resolveWorkspace` answers `projectRoot: null` and
    // `dbPath: ':memory:'`, and opening that throws `no such table:
    // schema_version` — which is what `/api/review-queue` still does here.
    const ws = resolveWorkspace(dir);
    assert.equal(ws.projectRoot, null, 'the fixture must really be outside a workspace');

    const absent = apiCapture(ws, new URL('http://x/api/capture?scope=src/**'));
    assert.equal(absent.status, 404);
    assert.deepEqual(absent.body, { error: 'no workspace here' });

    // A request that cannot be parsed is a 400 wherever it was sent — the
    // parse refusal is about the caller, the 404 is about the server.
    assert.equal(apiCapture(ws, new URL('http://x/api/capture')).status, 400);
    assert.equal(apiCapture(ws, new URL('http://x/api/capture?scope=a&nope=1')).status, 400);
  } finally { removeTree(dir); }
});

test('the answer changes with the corpus, not with a cached snapshot', () => {
  const { dir, done } = workspace();
  try {
    const before = ok(dir, '?scope=src/billing/**');
    assert.equal(before.governing.some((r) => r.id === 'STD-api-errors-use-problem-json'), false);
    // The mockup's second sample row, added for real.
    assert.equal(runCli(['add', '--summary-omitted', 'standard', 'Api errors use problem json',
      '--scope', 'src/billing/**', '--body', 'RFC 9457.', '--yes'], dir, () => {}), 0);
    const after = ok(dir, '?scope=src/billing/**');
    const row = after.governing.find((r) => r.id === 'STD-api-errors-use-problem-json');
    assert.ok(row, 'the newly captured standard must govern the scope it was captured into');
    // `cap.o2`: "standard, normative".
    assert.equal(row!.type, 'standard');
    assert.equal(row!.tier, 'normative');
  } finally { done(); }
});
