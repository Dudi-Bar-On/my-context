// @basis TASK-the-restore-tier-drops-snapshot-ids-with-no-disclosure-where, TASK-recordaudit-reports-whether-it-wrote-and-fourteen-of-sixteen
/**
 * **The fourth audit role is askable by name.**
 *
 * `core/audit-db.ts` files a restore disclosure as `audit_item.role =
 * 'disclosed'` rather than `'spilled'`, because an id the restore tier declined
 * to offer — superseded, on a disabled or rationale category, hidden by a
 * focus, already delivered, or gone from the corpus — never lost to a budget
 * and no budget would bring it back. That split landed with nothing able to ASK
 * for the new role: `AUDIT_ROLES` still held three words, so `mycontext audit
 * --role disclosed` was refused as a typo, and `/api/ask/summary` refused it
 * with a hand-copied list of the same three. A row written under a name no
 * surface accepts is `INV-nothing-is-dropped-silently` failing one step later
 * than usual — the record is on disk and unreachable.
 *
 * The third test is the DECISION about `/api/injection-history`, asserted
 * rather than left in a comment: that list is the preview screen's "when did
 * this really happen" column, and a disclosed id is not in the preview to be
 * matched against. It is excluded there and reachable here, which is the pair
 * that makes the exclusion a choice rather than a second drop.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { recordAudit } from '../../src/core/audit.ts';
import { AUDIT_ROLES } from '../../src/core/command-flags.ts';
import { apiAskSummary } from '../../src/ui/ask-model.ts';
import { apiInjectionHistory } from '../../src/ui/preview-history.ts';

/** The three ids the fixture files, one per role that can appear on a restore. */
const DELIVERED = 'RULE-delivered-one';
const SPILLED = 'RULE-spilled-one';
const DISCLOSED = 'RULE-disclosed-one';

/**
 * A workspace holding ONE restore record that names all three roles, and a
 * projection built the way a user builds one — by running `mycontext audit`,
 * the only caller entitled to write `.audit/audit.db`.
 */
function fixture(): { dir: string; root: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-role-disclosed-'));
  const quiet = (): void => {};
  assert.equal(runCli(['init'], dir, quiet), 0, 'fixture command failed: init');
  const root = path.join(dir, '.my_context');
  const written = recordAudit(root, {
    kind: 'injection',
    op: 'compact-restore',
    origin: 'agent',
    injected: [{ id: DELIVERED, tier: 'restore' }],
    spilled: [
      { id: SPILLED, tier: 'restore', reason: 'budget' },
      // The one the restore tier DISCLOSED: never priced, never offered.
      { id: DISCLOSED, tier: 'restore', reason: 'superseded', neverOffered: true },
    ],
  });
  assert.equal(written.written, true, `fixture could not write the audit record: ${written.error}`);
  assert.equal(runCli(['audit'], dir, quiet), 0, 'fixture command failed: audit (build projection)');
  return { dir, root, done: () => removeTree(dir) };
}

function url(pathname: string, qs = ''): URL {
  return new URL(`http://127.0.0.1:1${pathname}${qs === '' ? '' : `?${qs}`}`);
}

test('`disclosed` is in the one audit-role vocabulary, beside the three it joins', () => {
  assert.deepEqual([...AUDIT_ROLES], ['subject', 'injected', 'spilled', 'disclosed'],
    'the projection writes four roles; a vocabulary holding three refuses one of them by name');
});

test('`mycontext audit --items --role disclosed` returns the rows the projection filed as disclosed', () => {
  const { dir, done } = fixture();
  try {
    const lines: string[] = [];
    const code = runCli(['audit', '--items', '--role', 'disclosed'], dir, (s) => { lines.push(s); });
    const printed = lines.join('\n');
    assert.equal(code, 0,
      `--role disclosed was refused rather than answered; what it said was:\n${printed}`);
    assert.match(printed, new RegExp(DISCLOSED),
      `the disclosed id is the only row this filter has and it is not in the output:\n${printed}`);
    // And it is a FILTER, not a wider listing wearing one: the budget spill and
    // the delivery belong to other roles and must not ride along.
    assert.doesNotMatch(printed, new RegExp(SPILLED),
      `--role disclosed returned the budget spill too, so the filter is not applied:\n${printed}`);
    assert.doesNotMatch(printed, new RegExp(DELIVERED),
      `--role disclosed returned the delivery too, so the filter is not applied:\n${printed}`);
  } finally { done(); }
});

test('`mycontext audit --role spilled` no longer counts a disclosure as a budget loss', () => {
  const { dir, done } = fixture();
  try {
    const lines: string[] = [];
    assert.equal(runCli(['audit', '--items', '--role', 'spilled'], dir, (s) => { lines.push(s); }), 0);
    const printed = lines.join('\n');
    assert.match(printed, new RegExp(SPILLED));
    assert.doesNotMatch(printed, new RegExp(DISCLOSED),
      'a stale snapshot is being reported as a corpus under budget pressure');
  } finally { done(); }
});

test('/api/ask/summary?report=items&role=disclosed answers rather than refusing', () => {
  const { dir, done } = fixture();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiAskSummary(ws, url('/api/ask/summary', 'report=items&role=disclosed'));
    assert.equal(result.status, 200,
      `ask refused the role the projection writes: ${JSON.stringify(result.body)}`);
    const body = result.body as { rows: { label: string }[] };
    assert.deepEqual(body.rows.map((r) => r.label), [DISCLOSED],
      `the disclosed row is unreachable from ask: ${JSON.stringify(body.rows)}`);
  } finally { done(); }
});

test('/api/ask/summary still refuses a role the projection never writes', () => {
  const { dir, done } = fixture();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiAskSummary(ws, url('/api/ask/summary', 'report=items&role=disclosd'));
    assert.equal(result.status, 400,
      'a misspelt role must still be refused, or the vocabulary has stopped being one');
  } finally { done(); }
});

/**
 * **The decision, asserted.** `/api/injection-history` answers "when did this
 * item last REALLY get delivered, and when did it last REALLY spill" for the
 * rows the injection preview is drawing. A disclosed id was never offered to
 * that selection and will not appear in it, so there is no row for a timestamp
 * to sit beside; admitting it under a third role would need a screen label that
 * does not exist and would re-create exactly the misreading — a stale snapshot
 * shown as budget pressure — that the role split was made to end.
 *
 * It is excluded there and asked for here, by name, which is what keeps the
 * exclusion a stated choice instead of a second silent drop.
 */
test('/api/injection-history leaves the disclosed row out, and it stays reachable by role', () => {
  const { dir, done } = fixture();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiInjectionHistory(ws, url('/api/injection-history'));
    assert.equal(result.status, 200, JSON.stringify(result.body));
    const body = result.body as { rows: { id: string; role: string }[] };
    assert.deepEqual(new Set(body.rows.map((r) => r.id)), new Set([DELIVERED, SPILLED]),
      `the history list is meant to carry delivered and spilled only: ${JSON.stringify(body.rows)}`);
    assert.equal(body.rows.some((r) => r.role === 'disclosed'), false,
      'a disclosed id reached the preview\'s When column, where nothing draws it');
  } finally { done(); }
});
