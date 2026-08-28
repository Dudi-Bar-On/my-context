import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { appendUnprojected } from '../helpers/unprojected-audit.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { Store } from '../../src/core/store.ts';
import { auditLogPath, recordAudit } from '../../src/core/audit.ts';
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
    //
    // Appended around `recordAudit`, which projects what it appends now
    // (`core/audit-db.ts` · `export function keepProjectionCurrent(`) and so
    // no longer leaves this state behind. The state itself is unchanged and so
    // is the rule about it; `test/helpers/unprojected-audit.ts` lists the four
    // ways a real corpus still reaches it.
    appendUnprojected(root, { kind: 'focus', op: 'focus-clear', sessionId: 's1' });

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

// --- report=tasks: the fourth report, and the join it is made of ------------
//
// **The claim this report exists to answer is that `items.updated_at` is NOT a
// change time**, and these tests measure it rather than repeating it. The index
// is rebuilt whole from Markdown on every write path, so every row carries one
// identical rebuild stamp — asserted below over the fixture, and true of the
// real corpus too (368 items, ONE distinct `updated_at`, measured 2026-08-23).
// The per-item change time lives in the audit log's `mutation` records, which
// is a DIFFERENT STORE behind a different door, so this report joins the two.

/**
 * A corpus with the project-defined `task` category enabled, five tasks, and a
 * mutation history to join to.
 *
 * **Separate from `workspace()` rather than folded into it**: three tests above
 * assert exact row counts over that corpus, and a fixture that grows under them
 * measures something nobody asked for.
 *
 * `task` is NOT in any stock profile — it is defined in `config.json`, which is
 * why `init` alone cannot add one and why the config is patched here exactly as
 * `scripts/demo-corpus.ts` patches it. A test that invented a different shape
 * of task would pass against a category the product does not have.
 */
function taskWorkspace(): { dir: string; root: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ask-tasks-'));
  const quiet = (): void => {};
  const run = (args: string[]): void => {
    assert.equal(runCli(args, dir, quiet), 0, `fixture command failed: ${args.join(' ')}`);
  };
  run(['init']);
  const configPath = path.join(dir, '.my_context', 'config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  config['categories'] = {
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work, tracked to completion.',
      extraFields: ['plan', 'seq', 'state', 'progress', 'source', 'last_change', 'priority'],
    },
  };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  run(['add', 'task', 'Wire the retry budget', '--body', 'B.',
    '--tags', 'plan:alpha,seq:1,state:done', '--yes']);
  // **A `state` FIELD that disagrees with the `state:` TAG.** Measured on the
  // real corpus 2026-08-23: 293 tasks, all 293 carry the tag, 213 also carry
  // the field, and FIFTEEN of those disagree. Reconciling them is
  // `plan:categories seq:18`, not this report; what this report owes is to say
  // which one it read, and this row is what pins that answer.
  run(['add', 'task', 'Backfill the invoice ids', '--body', 'B.',
    '--tags', 'plan:alpha,seq:2,state:doing', '--extra', 'state=todo', '--yes']);
  // `seq:10` sorts AFTER `seq:2` here and BEFORE it under a string compare.
  run(['add', 'task', 'Split the settlement job', '--body', 'B.',
    '--tags', 'plan:alpha,seq:10,state:todo', '--yes']);
  run(['add', 'task', 'Retire the webhook path', '--body', 'B.',
    '--tags', 'plan:beta,seq:1,state:blocked', '--yes']);
  // No tags at all: plan, seq and progress are NULL — the corpus does not say,
  // which is not the same fact as any particular value.
  run(['add', 'task', 'An untagged task', '--body', 'B.', '--yes']);
  // A non-task with a mutation history of its own. It must not reach the report.
  run(['add', 'decision', 'A decision', '--body', 'B.']);
  return { dir, root: path.join(dir, '.my_context'), done: () => removeTree(dir) };
}

/**
 * Two later records for one task, at stamps the test KNOWS.
 *
 * The year is 2099 on purpose: `add` stamps its `create` with `Date.now()`, so
 * a fixture that wrote its updates at a plausible date would be asserting
 * `MAX(at)` against a race with the clock. A stamp no `create` can outrank
 * makes the newest record a value this test states rather than recomputes.
 */
function laterUpdates(root: string, itemId: string): void {
  recordAudit(root, {
    kind: 'mutation', op: 'update', origin: 'human', itemId, fields: ['body'],
    at: '2099-03-01T00:00:00.000Z',
  });
  recordAudit(root, {
    kind: 'mutation', op: 'refresh', origin: 'agent', itemId, fields: ['tags'],
    at: '2099-03-02T00:00:00.000Z',
  });
}

test('/api/ask/summary?report=tasks joins the index to the audit log for a REAL change time', () => {
  const { dir, root, done } = taskWorkspace();
  try {
    const ws = resolveWorkspace(dir);
    laterUpdates(root, 'TASK-wire-the-retry-budget');
    buildProjection(dir);

    // **The premise, measured on this very corpus before anything is asserted
    // about the report.** `items.updated_at` records when the INDEX ROW was
    // written, which is not when the item changed. On a corpus where every read
    // path rebuilds the index whole it collapses to a single value — measured
    // 2026-08-23, all 368 items of the real corpus and all 29 of the demo
    // corpus carry ONE distinct `updated_at` — and here, where six `add` calls
    // wrote the rows in turn, it is a second-granularity write clock spanning
    // the few seconds this fixture took to build.
    //
    // Either way it is the same defect, and the assertion is written as the
    // defect rather than as the coincidence: the whole corpus is stamped inside
    // one minute, so this column cannot separate two items whose real change
    // times are DECADES apart. Asserting one distinct value here instead would
    // pass or fail on whether the fixture straddled a second boundary — which
    // it does, roughly one run in six.
    const store = Store.openReadOnly(ws.dbPath);
    let stamps: Record<string, unknown>[];
    try {
      stamps = store.raw('SELECT DISTINCT updated_at FROM items');
    } finally { store.close(); }
    const written = stamps.map((r) => Date.parse(`${String(r['updated_at']).replace(' ', 'T')}Z`));
    const indexSpread = Math.max(...written) - Math.min(...written);
    assert.ok(indexSpread < 60_000,
      `every index row was stamped within a minute (spread ${indexSpread}ms), yet the items they `
      + 'describe were changed 73 years apart — which is the whole reason this report exists');

    const result = apiAskSummary(ws, url('/api/ask/summary', 'report=tasks'));
    assert.equal(result.status, 200);
    const body = result.body as {
      report: string; truncated: boolean; sql: string; params: unknown[];
      projectionState: string;
      rows: {
        label: string; title: string; plan: string | null; seq: string | null;
        state: string | null; status: string; count: number | null;
        lastOp: string | null; last: string | null;
      }[];
    };
    assert.equal(body.report, 'tasks');
    assert.equal(body.projectionState, 'fresh');
    assert.equal(body.truncated, false);

    // Plan, then seq NUMERICALLY, then the tasks the corpus says nothing about.
    assert.deepEqual(body.rows.map((r) => r.label), [
      'TASK-wire-the-retry-budget',
      'TASK-backfill-the-invoice-ids',
      'TASK-split-the-settlement-job',
      'TASK-retire-the-webhook-path',
      'TASK-an-untagged-task',
    ], 'the decision leaked into a report about tasks, or seq sorted as text');

    const first = body.rows[0]!;
    assert.equal(first.title, 'Wire the retry budget');
    assert.equal(first.plan, 'alpha');
    assert.equal(first.seq, '1');
    assert.equal(first.state, 'done');
    assert.equal(first.status, 'active');
    // One `create` from `add`, plus the two appended above.
    assert.equal(first.count, 3);
    assert.equal(first.lastOp, 'refresh');
    assert.equal(first.last, '2099-03-02T00:00:00.000Z');

    // **The whole point, stated as an assertion.** Two tasks the index stamped
    // within a minute of each other are separated here by 73 years, because the
    // change time came from the OTHER STORE. The gap is compared against the
    // index spread measured above: a report that had quietly fallen back to
    // `updated_at` would collapse this to at most that minute.
    const second = body.rows[1]!;
    const realGap = Date.parse(String(first.last)) - Date.parse(String(second.last));
    const A_YEAR = 365 * 24 * 60 * 60 * 1000;
    assert.ok(realGap > A_YEAR,
      `the two change times are ${realGap}ms apart where the index separates the same two rows by `
      + `${indexSpread}ms — a report that had quietly fallen back to \`updated_at\` would show `
      + 'the second number, and this asserts it is showing the first');
    assert.equal(second.count, 1);
    assert.equal(second.lastOp, 'create');
    assert.match(String(second.last), /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/,
      'the change time is an audit stamp, not the YYYY-MM-DD HH:MM:SS rebuild stamp');

    // The `state:` TAG is what `state` reports. This row carries a `state`
    // FIELD saying `todo` and a tag saying `doing`; the tag is on 293 of 293
    // tasks and the field on 213, so the tag is the only one that answers for
    // every task. Which is canonical is `plan:categories seq:18`, not this.
    assert.equal(second.state, 'doing');

    const untagged = body.rows[4]!;
    assert.equal(untagged.plan, null);
    assert.equal(untagged.seq, null);
    assert.equal(untagged.state, null, 'an absent progress tag became a value nobody wrote');

    // The SQL the screen would show is the SQL that ran — BOTH halves of the
    // join, because a report showing one would explain half of its own answer.
    assert.match(body.sql, /FROM items/);
    assert.match(body.sql, /FROM audit/);
    assert.deepEqual(body.params, ['task', 21]);
  } finally { done(); }
});

test('/api/ask/summary?report=tasks discloses its cap with the same limit + 1 probe', () => {
  const { dir, done } = taskWorkspace();
  try {
    const ws = resolveWorkspace(dir);
    buildProjection(dir);

    const capped = apiAskSummary(ws, url('/api/ask/summary', 'report=tasks&limit=2')).body as
      { rows: unknown[]; truncated: boolean; params: unknown[] };
    assert.equal(capped.rows.length, 2, 'the probe row was returned instead of dropped');
    assert.equal(capped.truncated, true);
    assert.deepEqual(capped.params, ['task', 3], 'the cap is bound as limit + 1, never as limit');

    // Exactly as many tasks as the cap is NOT truncated: the probe fires on the
    // row after the last one asked for, which is the difference between "there
    // were this many" and "there were more and you are not seeing them".
    const exact = apiAskSummary(ws, url('/api/ask/summary', 'report=tasks&limit=5')).body as
      { rows: unknown[]; truncated: boolean };
    assert.equal(exact.rows.length, 5);
    assert.equal(exact.truncated, false);
  } finally { done(); }
});

test('/api/ask/summary?report=tasks: a projection nobody built is NULL columns, never zeroes', () => {
  const { dir, done } = taskWorkspace();
  try {
    const ws = resolveWorkspace(dir);
    // No `mycontext audit`: the endpoint must not build one for itself.
    const result = apiAskSummary(ws, url('/api/ask/summary', 'report=tasks'));
    assert.equal(result.status, 200);
    const body = result.body as {
      projectionState: string; sql: string;
      rows: { label: string; state: string | null; count: number | null; last: string | null }[];
    };
    assert.equal(body.projectionState, 'absent');
    // The corpus half still answers — the index knows these five tasks exist,
    // and dropping them because a SECOND store was silent would throw away the
    // half of the report that could be measured.
    assert.equal(body.rows.length, 5);
    assert.equal(body.rows[0]!.state, 'done');
    for (const row of body.rows) {
      assert.equal(row.count, null, `${row.label}: a count the audit store never answered`);
      assert.equal(row.last, null);
    }
    // A statement that did not run is not shown as one that did.
    assert.doesNotMatch(body.sql, /FROM audit/);
    assert.equal(existsSync(auditDbPath(path.join(dir, '.my_context'))), false,
      'a GET created the audit projection — the read surface wrote to the corpus');
  } finally { done(); }
});

test('/api/ask/summary?report=tasks: a fresh projection with no record is a MEASURED zero', () => {
  const { dir, root, done } = taskWorkspace();
  try {
    const ws = resolveWorkspace(dir);
    // The log emptied before it was ever projected — what a rotated-away or
    // truncated segment leaves behind. The projection is then FRESH and holds
    // no mutation for these items, which is a zero this endpoint measured and
    // is a different fact from the `absent` nulls above.
    writeFileSync(auditLogPath(root), '');
    buildProjection(dir);

    const body = apiAskSummary(ws, url('/api/ask/summary', 'report=tasks')).body as {
      projectionState: string;
      rows: { count: number | null; lastOp: string | null; last: string | null }[];
    };
    assert.equal(body.projectionState, 'fresh');
    assert.equal(body.rows.length, 5);
    for (const row of body.rows) {
      assert.equal(row.count, 0, 'a projection that answered "none" was reported as silence');
      assert.equal(row.lastOp, null);
      assert.equal(row.last, null);
    }
  } finally { done(); }
});

test('/api/ask/summary?report=tasks: a stale projection is refused, exactly as report=ops is', () => {
  const { dir, root, done } = taskWorkspace();
  try {
    const ws = resolveWorkspace(dir);
    buildProjection(dir);
    // One record the projection has not consumed. It USED to be routine on the
    // read surface — a 401 writes an `access` record, so one unauthenticated
    // request staled the projection the next read then refused to answer from.
    // That is fixed at the writer, not here: the record is now projected as it
    // is appended. The state is still reachable and still refused, so it is
    // still tested, and `test/helpers/unprojected-audit.ts` says how.
    appendUnprojected(root, { kind: 'focus', op: 'focus-clear', origin: 'agent' });

    const ops = apiAskSummary(ws, url('/api/ask/summary', 'report=ops'));
    const tasks = apiAskSummary(ws, url('/api/ask/summary', 'report=tasks'));
    assert.equal(tasks.status, 503);
    assert.equal(tasks.status, ops.status, 'the fourth report refuses differently from the first');
    const body = tasks.body as { error: string; projectionState: string };
    assert.equal(body.projectionState, 'behind');
    assert.match(body.error, /mycontext audit/);
  } finally { done(); }
});

test('/api/ask/summary?report=tasks validates its parameters like the other three', () => {
  const { dir, done } = taskWorkspace();
  try {
    const ws = resolveWorkspace(dir);
    buildProjection(dir);
    // `role` is a property of `report=items` and is REFUSED here rather than
    // ignored: accepted and dropped, it would answer a different question from
    // the one on screen and report it as the same one.
    assert.equal(apiAskSummary(ws, url('/api/ask/summary', 'report=tasks&role=spilled')).status, 400);
    assert.equal(apiAskSummary(ws, url('/api/ask/summary', 'report=tasks&limit=0')).status, 400);
    assert.equal(apiAskSummary(ws, url('/api/ask/summary', 'report=tasks&limit=201')).status, 400);
    assert.equal(apiAskSummary(ws, url('/api/ask/summary', 'report=tasks&bogus=1')).status, 400);
    assert.equal(apiAskSummary(ws, url('/api/ask/summary', 'report=task')).status, 400);
    const named = apiAskSummary(ws, url('/api/ask/summary', 'report=task')).body as { error: string };
    assert.match(named.error, /tasks/, 'the refusal does not name the fourth report it now serves');
  } finally { done(); }
});
