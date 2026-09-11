// @basis TASK-reading-an-item-is-not-audited-so-nobody-can-tell-whether-an,
//         REQ-changes-are-timestamped-and-audited
/**
 * **Following an index line is recorded, so "was this item ever acted on" stops
 * being unmeasured.**
 *
 * Three measurements this week stopped at the same wall. The retirement lane
 * could not rank items by USE because the only signal available ranked them by
 * which door they came through. The pinned-set review wrote its own caveat —
 * *"delivered" is not "read"* — and trimmed on a proxy. The self-improvement
 * loop measured that injectable items the log has never delivered is 0 of 158,
 * so delivery discriminates nothing at all. Every item is delivered; nobody
 * knows which are ever FOLLOWED.
 *
 * This file pins the instrument that makes the difference visible: `show` on
 * the command line and `get_item` over MCP each append one `read` record naming
 * the item that was resolved and the surface it was resolved through, and that
 * record is tellable apart from an injection by its own kind.
 *
 * The owner ruling on the task is that the CLI and MCP surfaces record and the
 * UI read routes do NOT — the measured conflict is that `recordAudit` writes
 * inside `.my_context/`, which `test/ui/server-e2e.test.ts` snapshots, and that
 * `test/ui/no-writes.test.ts` holds an exact set of write bindings under
 * `src/ui/`. Nothing here reaches the UI.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  AUDIT_KINDS, AUDIT_OPS, auditLogPath, filterAudit, kindOf, parseAudit, readAudit,
  READ_OPS, recordAudit, recordItemRead,
  type AuditRecord,
} from '../../src/core/audit.ts';
import { runCli } from '../../src/cli/index.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

interface Project { cwd: string; root: string; id: string; dispose(): void }

/** A workspace holding exactly one item, whose id is the one every case reads. */
function project(): Project {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-item-read-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  assert.equal(
    runCli(['add', '--summary-omitted', 'rule', 'Never log customer email', '--yes'],
      cwd, () => {}),
    0,
  );
  const root = resolveWorkspace(cwd).projectRoot!;
  const created = readAudit(root).find((r) => r.op === 'create');
  assert.ok(created?.itemId, 'the add wrote a create record naming the new item');
  return { cwd, root, id: created.itemId, dispose: () => removeTree(cwd) };
}

/** Every read record in the log, which is the only kind these cases count. */
function reads(root: string): AuditRecord[] {
  return readAudit(root).filter((r) => r.kind === 'read');
}

// --- the vocabulary ---------------------------------------------------------

/**
 * `specFor`'s validator refuses an op it does not know and takes the whole
 * SEGMENT with it, so the registration has to land before anything writes one —
 * the same ordering `test/core/audit-new-ops.test.ts` pins for its two ops.
 */
test('item-read is registered, and it is the read kind rather than an access or injection op', () => {
  assert.ok(AUDIT_OPS.includes('item-read'), 'item-read is in the closed op list');
  assert.equal(kindOf('item-read'), 'read');
  assert.deepEqual([...READ_OPS], ['item-read']);
});

/**
 * APPENDED, never inserted. `AUDIT_KINDS`'s order is what the CLI's `--kind`
 * error and the MCP tool's enum show a reader, and `AUDIT_OPS` is the families
 * spread in sequence; a member slotted into the middle silently renumbers a
 * list users read.
 */
test('the read kind is appended to both vocabularies, moving no member before it', () => {
  assert.deepEqual(
    AUDIT_KINDS,
    ['mutation', 'injection', 'hook', 'focus', 'access', 'progress', 'execution', 'read'],
  );
  assert.equal(AUDIT_OPS.at(-1), 'item-read', 'item-read ends AUDIT_OPS');
});

test('a read record survives the validator that refuses an unregistered op', () => {
  const p = project();
  try {
    recordItemRead(p.root, p.id, 'cli');
    const raw = readFileSync(auditLogPath(p.root), 'utf8');
    // The refusal is caught rather than allowed to escape, so that "the
    // validator accepted it" is an ASSERTION that can go red at its own line.
    // Let through, an unregistered op throws out of `parseAudit` one line
    // above, and the claim this test exists to make would never be evaluated.
    let refusal: string | null = null;
    let parsed: AuditRecord[] = [];
    try {
      parsed = parseAudit(raw, auditLogPath(p.root));
    } catch (err) {
      refusal = err instanceof Error ? err.message : String(err);
    }
    assert.equal(refusal, null, 'the validator accepted the record rather than refusing the segment');
    const rows = parsed.filter((r) => r.op === 'item-read');
    assert.equal(rows.length, 1, 'the record read back');
    assert.equal(rows[0].kind, 'read');
  } finally { p.dispose(); }
});

// --- the two surfaces -------------------------------------------------------

test('mycontext show records one read, naming the resolved id and the cli surface', () => {
  const p = project();
  try {
    assert.equal(runCli(['show', p.id], p.cwd, () => {}), 0);
    const records = reads(p.root);
    assert.equal(records.length, 1, 'one read, from one show');
    assert.equal(records[0].itemId, p.id);
    assert.equal(records[0].surface, 'cli');
  } finally { p.dispose(); }
});

test('get_item records one read on the mcp surface', () => {
  const p = project();
  try {
    createRegistry(p.cwd).call('get_item', { id: p.id });
    const records = reads(p.root);
    assert.equal(records.length, 1, 'one read, from one get_item');
    assert.equal(records[0].itemId, p.id);
    assert.equal(records[0].surface, 'mcp');
  } finally { p.dispose(); }
});

/**
 * **The surface is a FIELD, not a sentence in `note`.** *Did an AGENT ever
 * follow an index line* is the premise the index tier rests on, and it is a
 * question asked across every row in the log by somebody who wants a count. A
 * fact worth querying does not go behind a regex over English — the same
 * argument `trigger`, `occupancyPercent` and `handoverState` already carry.
 *
 * And it is not `AuditRecord.origin`. That field means who made a MUTATION;
 * a lane running `mycontext show` from a shell is not a human and would be
 * recorded as one.
 */
test('the surface separates the two doors, and no read claims an origin it cannot know', () => {
  const p = project();
  try {
    assert.equal(runCli(['show', p.id], p.cwd, () => {}), 0);
    createRegistry(p.cwd).call('get_item', { id: p.id });
    const records = reads(p.root);
    assert.deepEqual(records.map((r) => r.surface), ['cli', 'mcp']);
    assert.equal(records.every((r) => r.origin === undefined), true,
      'origin means who made a mutation; a read is not one');
  } finally { p.dispose(); }
});

test('a show that resolves nothing records nothing — a miss is not a read', () => {
  const p = project();
  try {
    assert.notEqual(runCli(['show', 'RULE-there-is-no-such-item'], p.cwd, () => {}), 0);
    assert.equal(reads(p.root).length, 0, 'an unresolved id never answers "was item X read"');
  } finally { p.dispose(); }
});

// --- a read is not a delivery -----------------------------------------------

/**
 * The whole point of the instrument. If a read landed in `injection`,
 * `mycontext audit --kind injection` would over-report what a model was SHOWN
 * by counting what a reader PULLED, and the proxy the three stalled
 * measurements ran on would simply have been replaced by a worse one.
 */
test('a read is not a delivery: the two kinds select disjoint records', () => {
  const p = project();
  try {
    recordAudit(p.root, {
      kind: 'injection', op: 'session-start', hook: 'SessionStart', sessionId: 's-1',
      injected: [{ id: p.id, tier: 'index' }], tokens: 12,
    });
    assert.equal(runCli(['show', p.id], p.cwd, () => {}), 0);
    const all = readAudit(p.root);

    const delivered = filterAudit(all, { kind: 'injection' });
    const read = filterAudit(all, { kind: 'read' });
    assert.equal(delivered.length, 1);
    assert.equal(read.length, 1);
    assert.equal(read[0].injected, undefined, 'a read delivered nothing and claims nothing');
    assert.equal(read[0].tokens, undefined, 'a read spent no budget');
  } finally { p.dispose(); }
});

/**
 * **The join that makes the three stalled questions answerable.** Exposure is
 * already in the log — an injection record names each item and its tier — so a
 * reader compares reads against deliveries per item without a second store and
 * without a count kept by hand. Delivered-and-never-read is the signal that
 * did not exist: 0 of 158 items are undelivered, so delivery discriminates
 * nothing, and this is the column that does.
 */
test('reads join the exposure already in the log, per item, by id', () => {
  const p = project();
  try {
    const other = 'RULE-an-item-that-was-delivered-and-never-followed';
    recordAudit(p.root, {
      kind: 'injection', op: 'session-start', hook: 'SessionStart', sessionId: 's-1',
      injected: [{ id: p.id, tier: 'index' }, { id: other, tier: 'index' }], tokens: 24,
    });
    assert.equal(runCli(['show', p.id], p.cwd, () => {}), 0);
    const all = readAudit(p.root);

    const exposure = (id: string): number =>
      filterAudit(all, { itemId: id, kind: 'injection' }).length;
    const followed = (id: string): number =>
      filterAudit(all, { itemId: id, kind: 'read' }).length;

    assert.deepEqual([exposure(p.id), followed(p.id)], [1, 1]);
    assert.deepEqual([exposure(other), followed(other)], [1, 0],
      'delivered once, followed never — the measurement nobody could take');
  } finally { p.dispose(); }
});

/**
 * A COUNT, never a flag. "Was this item ever followed" and "is this item still
 * earning its pin" are different questions: the first is satisfied by one
 * record ever, the second needs reads to be countable against exposure over a
 * window, which a one-shot marker could not answer.
 */
test('every read is its own record, so a rate can be computed over a window', () => {
  const p = project();
  try {
    assert.equal(runCli(['show', p.id], p.cwd, () => {}), 0);
    assert.equal(runCli(['show', p.id], p.cwd, () => {}), 0);
    createRegistry(p.cwd).call('get_item', { id: p.id });
    assert.equal(reads(p.root).length, 3, 'three reads, three records');
  } finally { p.dispose(); }
});
