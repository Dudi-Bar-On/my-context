/**
 * `src/ui/proc-model.ts` — the Procedures read model, against real workspaces.
 *
 * Every fixture is built by the REAL CLI (`runCli`) or by the real write
 * functions, the pattern `test/ui/read-model-work.test.ts` established: a
 * procedure this file invented would prove that this file agrees with itself.
 * The two places a raw write is used instead of a command are named where they
 * happen and both are the shape `read-model-work.test.ts` uses — a `draft` can
 * only be produced by a non-human origin going through the `trustedStatus`
 * gate, and an UNREADABLE progress record can only be produced by writing one
 * the current build cannot parse.
 *
 * **What these tests deliberately do NOT do: start a server.** The handlers are
 * called as functions, exactly as `read-model-work.test.ts` and
 * `read-model-config.test.ts` call theirs. Whether the routes are reachable
 * over HTTP is `server-e2e.test.ts`'s question, and it cannot be answered until
 * `server.ts` wires them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { recordAudit } from '../../src/core/audit.ts';
import { createItem } from '../../src/core/mutate.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';
import {
  apiProcedure, apiProcedures,
  type Disclosure, type ProcedureBody, type ProceduresBody,
} from '../../src/ui/proc-model.ts';

const ID = 'PROC-rotate-the-webhook-secret';

function workspace(): { dir: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-proc-'));
  assert.equal(runCli(['init'], dir, () => {}), 0, 'fixture: init failed');
  return { dir, done: () => removeTree(dir) };
}

/** Three steps, through `mycontext add` — a human capture, so it lands active. */
function seed(dir: string): void {
  assert.equal(runCli(['add', '--summary-omitted', 'procedure', 'Rotate the webhook secret',
    '--body', 'Run this when the shared secret leaks.',
    '--step', 'Deploy the next secret beside the live one',
    '--step', 'Roll the endpoint secret',
    '--step', 'Promote and redeploy', '--yes'], dir, () => {}), 0, 'fixture: add failed');
}

const list = (dir: string): ProceduresBody =>
  apiProcedures(resolveWorkspace(dir), new URL('http://x/api/procedures')).body as ProceduresBody;

const detail = (dir: string, id: string): { status: number; body: unknown } =>
  apiProcedure(resolveWorkspace(dir), new URL('http://x/api/procedure'), { id });

const codes = (d: Disclosure[]): string[] => d.map((x) => x.code);

/**
 * **A freshly `init`ed workspace has no index file at all, and every read route
 * in this server throws on one.** Measured: `mycontext init` writes
 * `config.json`, `.gitignore` and `items/` and nothing else; `.index.db` is
 * created by the first command that opens a WRITABLE store. So
 * `Store.openReadOnlyChecked` — which `withStores` calls, and which is
 * deliberately read-only so the server cannot create or self-heal a database —
 * raises `unable to open database file`, and `server.ts` turns that into a 500.
 *
 * That is not this module's behaviour and not this module's to fix: it is
 * `ui/read-model.ts` · `export function withStores<T>(ws: Workspace, fn: (store: Store, ledger: Ledger | null) => T): T {` · ~229,
 * inherited identically by `/api/items`, `/api/status` and every other read.
 * It is asserted HERE rather than only mentioned in a report, so that the day
 * somebody gives that path an empty state this test fails and says so.
 *
 * Every fixture below therefore writes at least one item before reading.
 */
test('INHERITED: on a workspace no writing command has touched, the index is not there yet', () => {
  const { dir, done } = workspace();
  try {
    assert.throws(() => list(dir), /unable to open database file/);
  } finally { done(); }
});

test('a corpus with no procedures answers a list, not an absence — vocabulary and limit', () => {
  const { dir, done } = workspace();
  try {
    // A non-procedure item, so the index exists and the empty list is a fact
    // about procedures rather than about the database.
    assert.equal(runCli(['add', '--summary-omitted', 'rule', 'Always use POSIX paths', '--body', 'Use POSIX.',
      '--yes'], dir, () => {}), 0);
    const body = list(dir);
    assert.deepEqual(body.procedures, []);
    // The category is DECLARED and ENABLED here (the `standard` profile), so an
    // empty list means "no procedures captured" and the response says which.
    assert.deepEqual(body.category, { name: 'procedure', declared: true, enabled: true });
    // Five stages, in lifecycle order. The mockup's table draws four; a client
    // handed `abandoned` has to be able to tell it has no row for it.
    assert.deepEqual(body.stages,
      ['proposed', 'ready', 'active', 'done', 'abandoned']);
    // The workspace-scope limit rides on every answer, empty or not: it
    // qualifies what a progress number MEANS, which does not depend on there
    // being one yet.
    assert.deepEqual(codes(body.disclosures), ['progress-is-workspace-scoped']);
  } finally { done(); }
});

test('a captured procedure lists with its stage, its real injection verdict and 0 of 3', () => {
  const { dir, done } = workspace();
  try {
    seed(dir);
    const body = list(dir);
    assert.equal(body.procedures.length, 1);
    const p = body.procedures[0]!;
    assert.equal(p.id, ID);
    assert.equal(p.title, 'Rotate the webhook secret');
    // `add` stamps origin human, so it lands `active` — and `active` is the
    // one stage that injects.
    assert.equal(p.status, 'active');
    assert.equal(p.stage, 'active');
    assert.deepEqual(p.progress, { done: 0, total: 3, unreadable: 0 });
    // The verdict is the real function's, not a sentence this module composed:
    // an active, unscoped, normative item passes every item-level gate.
    assert.equal(p.injection.injected, true);
    assert.equal(p.injection.gate, 'passed');
  } finally { done(); }
});

test('the detail serves the steps, and the ticks are the AUDIT LOG\'s', () => {
  const { dir, done } = workspace();
  try {
    seed(dir);
    // Through the real commands: `activate` writes the `step-reset` anchor,
    // `step` appends one progress record and touches no item.
    assert.equal(runCli(['procedure', 'activate', ID, '--yes'], dir, () => {}), 0);
    const before = readFileSync(
      path.join(dir, '.my_context', 'items', 'procedure', `${ID}.md`), 'utf8');
    assert.equal(runCli(['procedure', 'step', ID, '2'], dir, () => {}), 0);

    const result = detail(dir, ID);
    assert.equal(result.status, 200);
    const p = (result.body as ProcedureBody).procedure;
    assert.deepEqual(p.steps, [
      { n: 1, text: 'Deploy the next secret beside the live one', checked: false },
      { n: 2, text: 'Roll the endpoint secret', checked: true },
      { n: 3, text: 'Promote and redeploy', checked: false },
    ]);
    assert.deepEqual(p.progress, { done: 1, total: 3, unreadable: 0 });

    // The half of `pr.md` a server can actually prove: "counted, never stored".
    // The file did not move, so the tick above exists only in the log.
    assert.equal(
      readFileSync(path.join(dir, '.my_context', 'items', 'procedure', `${ID}.md`), 'utf8'),
      before,
      'ticking a step rewrote the item file — progress must never enter items/');
    assert.deepEqual(codes(p.disclosures), ['progress-is-workspace-scoped']);
  } finally { done(); }
});

test('a step un-ticked and re-ticked is done — the replay is ordered, not tallied', () => {
  const { dir, done } = workspace();
  try {
    seed(dir);
    runCli(['procedure', 'activate', ID, '--yes'], dir, () => {});
    runCli(['procedure', 'step', ID, '1'], dir, () => {});
    runCli(['procedure', 'step', ID, '1', '--undo'], dir, () => {});
    runCli(['procedure', 'step', ID, '1'], dir, () => {});
    const p = (detail(dir, ID).body as ProcedureBody).procedure;
    assert.equal(p.steps[0]!.checked, true);
    assert.equal(p.progress.done, 1);
  } finally { done(); }
});

test('re-activating starts a clean run — the previous run\'s ticks are not inherited', () => {
  const { dir, done } = workspace();
  try {
    seed(dir);
    runCli(['procedure', 'activate', ID, '--yes'], dir, () => {});
    runCli(['procedure', 'step', ID, '1'], dir, () => {});
    runCli(['procedure', 'step', ID, '2'], dir, () => {});
    assert.equal((detail(dir, ID).body as ProcedureBody).procedure.progress.done, 2);
    runCli(['procedure', 'activate', ID, '--yes'], dir, () => {});
    const p = (detail(dir, ID).body as ProcedureBody).procedure;
    assert.equal(p.progress.done, 0, 'the step-reset anchor did not clear the previous run');
    assert.deepEqual(p.steps.map((s) => s.checked), [false, false, false]);
  } finally { done(); }
});

test('a finished procedure reads `done`; an abandoned one reads `abandoned`, not `done`', () => {
  const { dir, done } = workspace();
  try {
    seed(dir);
    runCli(['procedure', 'activate', ID, '--yes'], dir, () => {});
    runCli(['procedure', 'done', ID, '--yes'], dir, () => {});
    const finished = list(dir).procedures[0]!;
    assert.equal(finished.status, 'deprecated');
    assert.equal(finished.stage, 'done');
    // The status is served BESIDE the stage because the map is many-to-one:
    // `deprecated` and `validated` both read `done`, and a screen that only
    // ever saw the stage could not tell them apart.
    assert.equal(finished.injection.injected, false);

    // Abandoned is a different fact, and `superseded` is a member of
    // RETIRED_STATUSES with a stage of its own. The order of the tests in
    // `stageOf` is what keeps these two apart.
    seed(dir); // a second procedure to supersede this one with
    runCli(['add', '--summary-omitted', 'procedure', 'Rotate it the new way',
      '--step', 'Do the new thing', '--yes'], dir, () => {});
    runCli(['supersede', ID, '--by', 'PROC-rotate-it-the-new-way', '--yes'], dir, () => {});
    const abandoned = list(dir).procedures.find((p) => p.id === ID)!;
    assert.equal(abandoned.status, 'superseded');
    assert.equal(abandoned.stage, 'abandoned',
      'an abandoned procedure reported as done is the wrong answer this stage exists to prevent');
  } finally { done(); }
});

test('a `ready` procedure discloses that it reaches nothing — the mockup says "index line only"', () => {
  const { dir, done } = workspace();
  try {
    // A draft arrives the way real drafts do: a non-human origin through the
    // `trustedStatus` gate. `procedure` is normative, so an agent capture is
    // demoted to `draft`.
    const ws = resolveWorkspace(dir);
    const store = Store.open(ws.dbPath);
    try {
      const created = createItem({ root: ws.projectRoot!, store, config: ws.config }, {
        // `steps` on `CreateInput` is TEXT, never `Step[]`
        // (`core/mutate.ts` · `  steps?: string[];` · ~199): a step is created
        // unticked, because a tick is a progress record and not a field.
        type: 'procedure', title: 'Drain the queue', body: 'Proposed by an agent.',
        origin: 'agent', steps: ['Stop the writers'],
      });
      assert.equal(created.status, 'draft', 'the trustedStatus gate must have demoted it');
    } finally { store.close(); }

    const proposed = list(dir).procedures[0]!;
    assert.equal(proposed.stage, 'proposed', 'a draft with no ready tag is proposed');

    assert.equal(runCli(['edit', 'PROC-drain-the-queue', '--tags', 'ready', '--yes'],
      dir, () => {}), 0);
    const body = list(dir);
    const ready = body.procedures[0]!;
    assert.equal(ready.stage, 'ready');
    // The two facts served side by side, and they disagree with the mockup's
    // `pr.idx` ("index line only") in the same direction: the selector admits
    // `active` only, so a ready procedure is injected nowhere and named
    // nowhere. Nothing here edits the mockup; both facts are reported.
    assert.equal(ready.injection.injected, false);
    assert.ok(codes(body.disclosures).includes('ready-is-not-injected'));
    const said = body.disclosures.find((d) => d.code === 'ready-is-not-injected')!.message;
    assert.match(said, /not injected and not named in the index/);

    // And the detail carries it too — a client that fetched only the card must
    // not have to have read the list to learn it.
    const one = detail(dir, 'PROC-drain-the-queue');
    assert.ok(codes((one.body as ProcedureBody).procedure.disclosures)
      .includes('ready-is-not-injected'));
  } finally { done(); }
});

test('progress records this build cannot read are counted and named, never swallowed', () => {
  const { dir, done } = workspace();
  try {
    seed(dir);
    runCli(['procedure', 'activate', ID, '--yes'], dir, () => {});
    runCli(['procedure', 'step', ID, '1'], dir, () => {});
    // A record from a build that spelled the step differently. Written with
    // the real `recordAudit`, so the log is a log the product wrote — the note
    // is the only thing this build cannot parse.
    const written = recordAudit(path.join(dir, '.my_context'), {
      kind: 'progress', op: 'step-done', itemId: ID, origin: 'human', note: 'step two',
    });
    assert.equal(written.written, true, 'fixture: the progress record was not written');

    const p = (detail(dir, ID).body as ProcedureBody).procedure;
    assert.equal(p.progress.done, 1, 'an unreadable record must not be counted as done');
    assert.equal(p.progress.unreadable, 1, 'nor as absent');
    const said = p.disclosures.find((d) => d.code === 'unreadable-progress-records')!;
    assert.match(said.message, /counted in neither direction/);

    // The list says it too, and names WHICH procedure — a bare count on a
    // listing of many is a number a reader cannot act on.
    const body = list(dir);
    const listed = body.disclosures.find((d) => d.code === 'unreadable-progress-records')!;
    assert.match(listed.message, new RegExp(`${ID} \\(1\\)`));
  } finally { done(); }
});

test('a checkbox ticked in the Markdown is not progress, and the divergence is named', () => {
  const { dir, done } = workspace();
  try {
    seed(dir);
    // The second place `pr.md` says does not exist: `parseSteps` reads `- [x]`
    // into `Step.checked`, so a hand-edited file carries a tick the audit log
    // knows nothing about. Edited on disk and re-indexed through a real
    // command, so the store holds what the parser produced.
    const file = path.join(dir, '.my_context', 'items', 'procedure', `${ID}.md`);
    writeFileSync(file,
      readFileSync(file, 'utf8').replace('- [ ] Roll the endpoint secret',
        '- [x] Roll the endpoint secret'));
    assert.equal(runCli(['repair', '--yes'], dir, () => {}), 0, 'fixture: repair failed');

    const p = (detail(dir, ID).body as ProcedureBody).procedure;
    assert.equal(p.steps[1]!.checked, false,
      'the served tick must come from the audit log, never from the file');
    assert.equal(p.progress.done, 0);
    const said = p.disclosures.find((d) => d.code === 'file-ticks-are-not-progress');
    assert.ok(said, 'the file and the log disagree and the response did not say so');
    assert.match(said!.message, /ticks step\(s\) 2 that the audit log does not/);

    // And the other direction is NOT a divergence: once the log records the
    // same step, the two agree about the answer and the sentence goes away.
    // A disclosure that fired on every procedure in progress would be noise.
    runCli(['procedure', 'activate', ID, '--yes'], dir, () => {});
    runCli(['procedure', 'step', ID, '2'], dir, () => {});
    const after = (detail(dir, ID).body as ProcedureBody).procedure;
    assert.equal(after.steps[1]!.checked, true);
    assert.ok(!codes(after.disclosures).includes('file-ticks-are-not-progress'));
  } finally { done(); }
});

test('two 404s, because a typo and a category error send a client to two places', () => {
  const { dir, done } = workspace();
  try {
    seed(dir);
    runCli(['add', '--summary-omitted', 'runbook', 'Restore from backup', '--body', 'Repeatable.', '--yes'],
      dir, () => {});
    runCli(['add', '--summary-omitted', 'rule', 'Always use POSIX paths', '--body', 'Use POSIX.', '--yes'],
      dir, () => {});

    const missing = detail(dir, 'PROC-nothing-here');
    assert.equal(missing.status, 404);
    assert.match((missing.body as { error: string }).error, /no item with id/);

    // The near miss names itself AND points at where the two are told apart.
    const runbook = detail(dir, 'RUN-restore-from-backup');
    assert.equal(runbook.status, 404);
    const runbookError = (runbook.body as { error: string }).error;
    assert.match(runbookError, /is a runbook, not a procedure/);
    assert.match(runbookError, /mycontext help categories/);

    // Any other category gets the category fact and no boundary sentence: a
    // `rule` is not a near miss, and the paragraph would be noise on a refusal
    // nobody reached by confusing the pair.
    const rule = detail(dir, 'RULE-always-use-posix-paths');
    assert.equal(rule.status, 404);
    const ruleError = (rule.body as { error: string }).error;
    assert.match(ruleError, /is a rule, not a procedure/);
    assert.doesNotMatch(ruleError, /help categories/);
  } finally { done(); }
});

test('both routes refuse a parameter they do not act on', () => {
  const { dir, done } = workspace();
  try {
    seed(dir);
    const ws = resolveWorkspace(dir);
    const listed = apiProcedures(ws, new URL('http://x/api/procedures?stage=active'));
    assert.equal(listed.status, 400);
    assert.match((listed.body as { error: string }).error, /unknown parameter "stage"/);
    const one = apiProcedure(ws, new URL('http://x/api/procedure?full=1'), { id: ID });
    assert.equal(one.status, 400);
  } finally { done(); }
});

test('off a workspace both routes answer 404 rather than opening an index that is not there', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-proc-none-'));
  try {
    const ws = resolveWorkspace(dir);
    assert.equal(ws.projectRoot, null, 'fixture: this directory must not be a workspace');
    assert.equal(apiProcedures(ws, new URL('http://x/api/procedures')).status, 404);
    assert.equal(apiProcedure(ws, new URL('http://x/api/procedure'), { id: ID }).status, 404);
  } finally { removeTree(dir); }
});
