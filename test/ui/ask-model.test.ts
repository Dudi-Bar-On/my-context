import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { Store } from '../../src/core/store.ts';
import { recordAudit } from '../../src/core/audit.ts';
import { auditDbPath } from '../../src/core/audit-db.ts';
import { corpusSelect, apiAskCorpus, apiAskAudit, apiAskSummary } from '../../src/ui/ask-model.ts';

/**
 * Ask's server half: the corpus query builder, the audit query builder and the
 * three predefined reports.
 *
 * **The projection is built by the PRODUCT, never by the endpoint** — the same
 * rule `test/ui/watch-model.test.ts` states, for the same reason. Every fixture
 * below that expects audit answers runs `mycontext audit`, the one caller
 * entitled to write `.audit/audit.db`. The endpoints open it through
 * `openProjectionReadOnlyChecked`, which creates nothing and repairs nothing,
 * so a fixture that forgot to build one does not get one built behind its back:
 * it gets the `absent` empty state, and there is a test for that below.
 *
 * Cleanup is `removeTree`, the one owner of test temp-directory removal; a
 * bare `rmSync` here is what `test/no-bare-rmsync.test.ts` fails on.
 */
function workspace(): { dir: string; root: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ask-'));
  const quiet = (): void => {};
  assert.equal(runCli(['init'], dir, quiet), 0, 'fixture command failed: init');
  // `--yes` on both rules, and on the `edit` that pins one. A rule is a
  // governing item, so `add` refuses to create one without confirmation when
  // stdin is not interactive — which it never is under the test runner. The
  // plan's fixture omitted it and would have created no rules at all, then
  // asserted over the two it did not create.
  assert.equal(
    runCli(['add', 'rule', 'Scoped rule', '--scope', 'src/**', '--body', 'B.', '--yes'], dir, quiet),
    0, 'fixture command failed: add scoped rule',
  );
  assert.equal(
    runCli(['add', 'rule', 'Pinned rule', '--body', 'B.', '--yes'], dir, quiet),
    0, 'fixture command failed: add pinned rule',
  );
  assert.equal(runCli(['add', 'decision', 'A decision', '--body', 'B.'], dir, quiet), 0,
    'fixture command failed: add decision');
  // `always` has no `add` flag — it is a governing change and only `edit`
  // expresses it, with its own confirmation.
  assert.equal(runCli(['edit', 'RULE-pinned-rule', '--always', '--yes'], dir, quiet), 0,
    'fixture command failed: edit --always');
  return { dir, root: path.join(dir, '.my_context'), done: () => removeTree(dir) };
}

/** Build the audit projection the way a user does — the write path this surface may not take. */
function buildProjection(dir: string): void {
  assert.equal(runCli(['audit'], dir, () => {}), 0, 'fixture command failed: audit');
}

function url(pathname: string, qs = ''): URL {
  return new URL(`http://127.0.0.1:1${pathname}${qs === '' ? '' : `?${qs}`}`);
}

test('Store.raw binds parameters, and the default keeps every existing caller working', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const store = Store.openReadOnly(ws.dbPath);
    try {
      const rows = store.raw('SELECT id FROM items WHERE type = ? ORDER BY id', ['decision']);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!['id'], 'DEC-a-decision');
      // A value that would be SQL if it were interpolated is a value when it
      // is bound. This is the whole reason the parameter exists.
      assert.deepEqual(store.raw('SELECT id FROM items WHERE type = ?', ["' OR 1=1 --"]), []);
      // The no-parameter form is untouched: `query.ts` and
      // `Store.openReadOnlyChecked` both still call it with one argument.
      assert.equal(store.raw('SELECT id FROM items ORDER BY id').length, 3);
    } finally {
      store.close();
    }
  } finally { done(); }
});

test('corpusSelect builds the SQL it claims, with the +1 truncation probe', () => {
  const { sql, params } = corpusSelect({ type: 'rule', scoped: true, titleContains: 'Sco', limit: 10 });
  assert.match(sql, /WHERE type = \?/);
  assert.match(sql, /has_scope = 1/);
  assert.match(sql, /title LIKE \? ESCAPE '\\'/);
  assert.match(sql, /LIMIT \?$/);
  assert.deepEqual(params, ['rule', '%Sco%', 11]);
});

test('corpusSelect binds every user value and interpolates only the two it validated', () => {
  // `always` and `scoped` are the only values that reach the SQL text, and
  // they reach it as `0` or `1` after the endpoint has refused everything
  // else. Every value a user can spell — the type, the status, the layer, the
  // title fragment, the limit — is a bind parameter.
  const { sql, params } = corpusSelect({
    type: "rule'; DROP TABLE items; --", status: 'active', layer: 'project',
    always: false, titleContains: '100%_of_it', limit: 5,
  });
  assert.doesNotMatch(sql, /DROP TABLE/);
  assert.match(sql, /always = 0/);
  assert.deepEqual(params, [
    "rule'; DROP TABLE items; --", 'active', 'project', '%100\\%\\_of\\_it%', 6,
  ]);
});

test('/api/ask/corpus runs the shown SQL and reports truncation honestly', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const all = apiAskCorpus(ws, url('/api/ask/corpus'));
    assert.equal(all.status, 200);
    const body = all.body as {
      rows: { id: string }[]; sql: string; params: unknown[]; truncated: boolean;
    };
    assert.equal(body.rows.length, 3);
    assert.equal(body.truncated, false);
    assert.match(body.sql, /FROM items/);
    // The promise the screen makes: the SQL on display is the SQL that ran,
    // with these parameters and no others.
    assert.deepEqual(body.params, [101]);

    const capped = apiAskCorpus(ws, url('/api/ask/corpus', 'limit=2')).body as
      { rows: unknown[]; truncated: boolean };
    assert.equal(capped.rows.length, 2);
    assert.equal(capped.truncated, true);

    const filtered = apiAskCorpus(ws, url('/api/ask/corpus', 'type=rule&scoped=1')).body as
      { rows: { id: string }[] };
    assert.deepEqual(filtered.rows.map((r) => r.id), ['RULE-scoped-rule']);

    const pinned = apiAskCorpus(ws, url('/api/ask/corpus', 'always=1')).body as
      { rows: { id: string }[] };
    assert.deepEqual(pinned.rows.map((r) => r.id), ['RULE-pinned-rule']);

    const titled = apiAskCorpus(ws, url('/api/ask/corpus', 'title=Sco')).body as
      { rows: { id: string }[] };
    assert.deepEqual(titled.rows.map((r) => r.id), ['RULE-scoped-rule']);

    assert.equal(apiAskCorpus(ws, url('/api/ask/corpus', 'status=nonsense')).status, 400);
    assert.equal(apiAskCorpus(ws, url('/api/ask/corpus', 'layer=nonsense')).status, 400);
    assert.equal(apiAskCorpus(ws, url('/api/ask/corpus', 'sesion=typo')).status, 400);
    assert.equal(apiAskCorpus(ws, url('/api/ask/corpus', 'always=maybe')).status, 400);
    assert.equal(apiAskCorpus(ws, url('/api/ask/corpus', 'limit=0')).status, 400);
    assert.equal(apiAskCorpus(ws, url('/api/ask/corpus', 'type=rule&type=decision')).status, 400);
  } finally { done(); }
});

test('/api/ask/corpus escapes a LIKE wildcard instead of widening the question', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    // `%` unescaped would match every title. Escaped, it matches none of
    // them — which is the honest answer to "titles containing a per-cent sign".
    const body = apiAskCorpus(ws, url('/api/ask/corpus', 'title=%')).body as { rows: unknown[] };
    assert.deepEqual(body.rows, []);
  } finally { done(); }
});

test('/api/ask/audit answers from the read-only projection, shows its SQL, and validates every filter', () => {
  const { dir, root, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'a.ts',
      injected: [{ id: 'RULE-a', tier: 'jit' }],
      spilled: [{ id: 'RULE-b', tier: 'jit', reason: 'budget exceeded' }], tokens: 40,
    });
    recordAudit(root, { kind: 'focus', op: 'focus-set', origin: 'agent', note: 'scope=src/**' });
    buildProjection(dir);

    const result = apiAskAudit(ws, url('/api/ask/audit', 'kind=injection&session=s1'));
    assert.equal(result.status, 200);
    const body = result.body as {
      records: { op: string }[]; sql: string; params: unknown[]; projectionState: string;
    };
    assert.deepEqual(body.records.map((r) => r.op), ['jit']);
    assert.match(body.sql, /SELECT json\(rec\)/);
    assert.deepEqual(body.params, ['injection', 's1', 200]);
    // `projectionState`, NOT `projectionStateBeforeSync`: nothing syncs here,
    // so the old name would assert a property this code does not have.
    assert.equal(body.projectionState, 'fresh');

    // The spill filter: item=RULE-b matches the record that SPILLED it.
    const spilled = apiAskAudit(ws, url('/api/ask/audit', 'item=RULE-b')).body as
      { records: unknown[] };
    assert.equal(spilled.records.length, 1);

    const focused = apiAskAudit(ws, url('/api/ask/audit', 'origin=agent')).body as
      { records: { op: string }[] };
    assert.deepEqual(focused.records.map((r) => r.op), ['focus-set']);

    assert.equal(apiAskAudit(ws, url('/api/ask/audit', 'kind=nonsense')).status, 400);
    assert.equal(apiAskAudit(ws, url('/api/ask/audit', 'op=nonsense')).status, 400);
    assert.equal(apiAskAudit(ws, url('/api/ask/audit', 'origin=nonsense')).status, 400);
    assert.equal(apiAskAudit(ws, url('/api/ask/audit', 'since=not-a-date')).status, 400);
    assert.equal(apiAskAudit(ws, url('/api/ask/audit', 'limit=99999')).status, 400);
    assert.equal(apiAskAudit(ws, url('/api/ask/audit', 'bogus=1')).status, 400);
    assert.equal(apiAskAudit(ws, url('/api/ask/audit', 'kind=focus&kind=hook')).status, 400);
  } finally { done(); }
});

test('/api/ask/audit: a projection nobody has built is the empty state, and stays unbuilt', () => {
  const { dir, root, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse',
      injected: [{ id: 'RULE-a', tier: 'jit' }],
    });
    // No `mycontext audit` here: the endpoint must NOT build one for itself.
    const result = apiAskAudit(ws, url('/api/ask/audit'));
    assert.equal(result.status, 200);
    const body = result.body as { records: unknown[]; sql: string; projectionState: string };
    assert.equal(body.projectionState, 'absent');
    assert.deepEqual(body.records, [],
      'an absent projection answers with NO records — never with a zero it did not measure');
    assert.match(body.sql, /SELECT json\(rec\)/, 'the builder still shows what it would run');

    const summary = apiAskSummary(ws, url('/api/ask/summary', 'report=ops'));
    assert.equal(summary.status, 200);
    assert.deepEqual(summary.body, { report: 'ops', rows: [], projectionState: 'absent' });

    assert.equal(existsSync(auditDbPath(path.join(dir, '.my_context'))), false,
      'a GET created the audit projection — the read surface wrote to the corpus');
  } finally { done(); }
});

test('/api/ask/audit: a projection behind its log refuses rather than answering short', () => {
  const { dir, root, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    recordAudit(root, { kind: 'focus', op: 'focus-set', sessionId: 's1', note: 'src/**' });
    buildProjection(dir);
    // A record the projection has not consumed. A read may not sync it in —
    // syncing is a write — so the only honest answer is to say so.
    recordAudit(root, { kind: 'focus', op: 'focus-clear', sessionId: 's1' });

    const result = apiAskAudit(ws, url('/api/ask/audit'));
    assert.equal(result.status, 503);
    const body = result.body as { error: string; projectionState: string };
    assert.equal(body.projectionState, 'behind');
    assert.match(body.error, /mycontext audit/);

    const summary = apiAskSummary(ws, url('/api/ask/summary', 'report=sessions'));
    assert.equal(summary.status, 503);
    assert.equal((summary.body as { projectionState: string }).projectionState, 'behind');
  } finally { done(); }
});

test('/api/ask/summary serves the three predefined reports', () => {
  const { dir, root, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'a.ts',
      injected: [{ id: 'RULE-a', tier: 'jit' }],
      spilled: [{ id: 'RULE-b', tier: 'jit', reason: 'budget exceeded' }],
    });
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'b.ts',
      injected: [{ id: 'RULE-a', tier: 'jit' }],
    });
    buildProjection(dir);

    const ops = apiAskSummary(ws, url('/api/ask/summary', 'report=ops')).body as
      { rows: { label: string; count: number; last: string | null }[]; projectionState: string };
    // NOT `rows[0]`, which the plan's sample asserted was `jit`: the fixture's
    // own three `add` calls and one `edit` are audited too, so `create` leads
    // this report. The report covers the WHOLE log, which is the point of it.
    const jit = ops.rows.find((r) => r.label === 'jit');
    assert.deepEqual(jit, { label: 'jit', count: 2, last: jit?.last ?? null });
    assert.equal(ops.rows.find((r) => r.label === 'create')?.count, 3);
    assert.equal(ops.projectionState, 'fresh');

    const spilledTop = apiAskSummary(ws, url('/api/ask/summary', 'report=items&role=spilled')).body as
      { rows: { label: string }[] };
    assert.deepEqual(spilledTop.rows.map((r) => r.label), ['RULE-b']);

    const injectedTop = apiAskSummary(ws, url('/api/ask/summary', 'report=items&role=injected')).body as
      { rows: { label: string; count: number }[] };
    assert.deepEqual(injectedTop.rows.map((r) => r.label), ['RULE-a']);
    assert.equal(injectedTop.rows[0]!.count, 2);

    // No role is every role at once — including the `subject` rows the
    // fixture's own mutations wrote. A different question, not a default.
    const anyRole = apiAskSummary(ws, url('/api/ask/summary', 'report=items')).body as
      { rows: { label: string }[] };
    const labels = anyRole.rows.map((r) => r.label);
    for (const id of ['RULE-a', 'RULE-b', 'RULE-scoped-rule', 'DEC-a-decision']) {
      assert.ok(labels.includes(id), `report=items with no role dropped ${id}: ${labels.join(', ')}`);
    }

    const sessions = apiAskSummary(ws, url('/api/ask/summary', 'report=sessions')).body as
      { rows: { label: string }[] };
    assert.deepEqual(sessions.rows.map((r) => r.label), ['s1']);

    assert.equal(apiAskSummary(ws, url('/api/ask/summary', 'report=nonsense')).status, 400);
    assert.equal(apiAskSummary(ws, url('/api/ask/summary')).status, 400);
    assert.equal(apiAskSummary(ws, url('/api/ask/summary', 'report=items&role=nonsense')).status, 400);
    // role only with items
    assert.equal(apiAskSummary(ws, url('/api/ask/summary', 'report=ops&role=spilled')).status, 400);
    assert.equal(apiAskSummary(ws, url('/api/ask/summary', 'report=ops&limit=0')).status, 400);
    assert.equal(apiAskSummary(ws, url('/api/ask/summary', 'report=ops&bogus=1')).status, 400);
  } finally { done(); }
});
