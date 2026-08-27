import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  AUDIT_KINDS, AUDIT_OPS, EXECUTION_OPS, filterAudit, kindOf, MUTATION_OPS, readAudit,
  recordAudit,
  type AuditInput, type AuditRecord,
} from '../../src/core/audit.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * The same box `test/core/audit.test.ts` uses, spelled the same way on purpose.
 *
 * A second, cleverer harness here would be a second definition of "what a
 * written record looks like when it is read back", and the two would drift —
 * which is the one thing a test for an APPEND-then-READ round trip must not do.
 */
function box(): { root: string; dispose(): void } {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-audit-exec-'));
  return { root, dispose: () => removeTree(root) };
}

/**
 * Writes one record and reads it back OFF DISK, rather than asserting against
 * the object handed to `recordAudit`.
 *
 * That round trip is the assertion. `readAudit` runs `specFor`'s validator on
 * every line and refuses the whole segment on an unregistered `kind` or `op`,
 * so a record that survives this helper has proved that `execution`/`execute`
 * are registered in the vocabulary — not merely that a TypeScript type admits
 * them, which is erased before any of this runs.
 */
function recordAndRead(input: AuditInput): AuditRecord {
  const b = box();
  try {
    const result = recordAudit(b.root, input);
    assert.equal(result.written, true, result.error);
    const records = readAudit(b.root);
    assert.equal(records.length, 1, 'one append is one record');
    return records[0];
  } finally {
    b.dispose();
  }
}

/**
 * `command` is optional on `AuditRecord` — every other kind of record has none —
 * so a test that reads it needs to narrow it. A thrown miss names the field, so
 * a record written without one fails as "carries no command" rather than as a
 * property access on `undefined` three lines later.
 */
function commandOf(row: AuditRecord): NonNullable<AuditRecord['command']> {
  if (row.command === undefined) throw new Error('the record carries no `command`');
  return row.command;
}

test('execute is its own kind, and kindOf says so', () => {
  assert.equal(kindOf('execute'), 'execution');
  assert.equal(kindOf('execute-done'), 'execution');
  // The PAIR, in order. `execute` is written before the run and `execute-done`
  // after it, and the order here is the order `AUDIT_OPS` spreads them in —
  // which is what the CLI's `--op` listing and the MCP enum show a reader.
  assert.deepEqual([...EXECUTION_OPS], ['execute', 'execute-done']);
});

/**
 * **An `execute` row with no `execute-done` beside it is a run that never
 * returned**, and that is a fact the old single-row design could not express at
 * all: one row still reading `exitCode: null` was indistinguishable from a run
 * whose completion write had merely failed.
 *
 * It is a pair for the reason `pre-compact`/`post-compact` and `subagent-start`
 * are pairs — the log is append-only, so a two-phase fact is written as two
 * rows. The alternative was amending the first row in place, which meant
 * rewriting a whole file every hook appends to without a lock; see
 * `EXECUTION_OPS` in `core/audit.ts`.
 */
test('a run is TWO rows: execute before it, execute-done after, joined by at and id', () => {
  const b = box();
  try {
    const at = '2026-08-27T09:00:00.000Z';
    const argv = ['rebuild'];
    // Exactly what the route writes, in the order it writes it.
    recordAudit(b.root, {
      at, kind: 'execution', op: 'execute',
      command: { id: 'rebuild', argv, exitCode: null, durationMs: 0 },
    });
    recordAudit(b.root, {
      at, kind: 'execution', op: 'execute-done',
      command: { id: 'rebuild', argv, exitCode: 0, durationMs: 37 },
    });

    const rows = filterAudit(readAudit(b.root), { kind: 'execution' });
    assert.equal(rows.length, 2, 'one run is two rows');
    assert.deepEqual(rows.map((r) => r.op), ['execute', 'execute-done'],
      'the attempt is recorded before the completion, never after it');

    // The correlation a reader actually uses. No run id was invented; `at` and
    // `command.id` are equal across the pair and that is the whole join.
    assert.equal(rows[0].at, rows[1].at);
    assert.equal(commandOf(rows[0]).id, commandOf(rows[1]).id);

    // The first row PROVES the record preceded the run: it cannot carry an exit
    // code, because at the instant it was written nothing had exited.
    assert.equal(commandOf(rows[0]).exitCode, null);
    assert.equal(commandOf(rows[0]).durationMs, 0);

    // The second carries what actually happened.
    assert.equal(commandOf(rows[1]).exitCode, 0);
    assert.equal(commandOf(rows[1]).durationMs, 37);
  } finally {
    b.dispose();
  }
});

/**
 * The register is closed — `specFor`'s validator refuses an unregistered op and
 * takes the whole SEGMENT with it — so `execute-done` is unwritable until it is
 * registered. Appended after `execute`, moving nothing before it.
 */
test('execute-done joins the closed register, appended after execute', () => {
  assert.ok(AUDIT_OPS.includes('execute-done'), 'the op is registered');
  assert.equal(AUDIT_OPS[AUDIT_OPS.length - 1], 'execute-done');
  assert.equal(AUDIT_OPS[AUDIT_OPS.length - 2], 'execute');
  assert.equal(new Set(AUDIT_OPS).size, AUDIT_OPS.length);
  // Registration is not the same as writability: this proves a build that
  // WRITES an `execute-done` can also READ it back.
  const row = recordAndRead({
    kind: 'execution',
    op: 'execute-done',
    command: { id: 'doctor', argv: ['doctor'], exitCode: 1, durationMs: 90 },
  });
  assert.equal(row.op, 'execute-done');
  assert.equal(row.kind, 'execution');
});

/**
 * A lone `execute` row is the one shape the pair exists to make readable. This
 * asserts it stays readable rather than being repaired, defaulted or hidden:
 * the run never returned, and the log says exactly that.
 */
test('an execute row with no execute-done beside it reads as a run that never returned', () => {
  const b = box();
  try {
    recordAudit(b.root, {
      at: '2026-08-27T09:00:00.000Z',
      kind: 'execution',
      op: 'execute',
      command: { id: 'doctor', argv: ['doctor'], exitCode: null, durationMs: 0 },
    });
    const rows = filterAudit(readAudit(b.root), { kind: 'execution' });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].op, 'execute');
    assert.equal(rows.some((r) => r.op === 'execute-done'), false);
    // `null`, not 0. A reader that defaulted this would report "it worked" for
    // a run nobody watched end.
    assert.equal(commandOf(rows[0]).exitCode, null);
    assert.ok('exitCode' in commandOf(rows[0]));
  } finally {
    b.dispose();
  }
});

/**
 * The register is closed: `specFor`'s validator refuses a `kind` absent from
 * `AUDIT_KINDS` and an `op` absent from `AUDIT_OPS`, and it takes the whole
 * SEGMENT with it. Declaring the type without registering the values would ship
 * a build that writes records it then refuses to read.
 */
test('execution joins the closed register as the seventh kind, appended not inserted', () => {
  assert.ok(AUDIT_KINDS.includes('execution'), 'the kind is registered');
  assert.ok(AUDIT_OPS.includes('execute'), 'the op is registered');
  assert.equal(AUDIT_KINDS[AUDIT_KINDS.length - 1], 'execution',
    'appended last, so no existing kind moved position in any enum a reader is shown');
  assert.equal(new Set(AUDIT_KINDS).size, AUDIT_KINDS.length);
  assert.equal(new Set(AUDIT_OPS).size, AUDIT_OPS.length);
});

test('the record carries the id, the resolved argv and the exit code', () => {
  const row = recordAndRead({
    kind: 'execution',
    op: 'execute',
    command: { id: 'pin', argv: ['pin', 'A'], exitCode: 0, durationMs: 12 },
  });
  const command = commandOf(row);
  assert.equal(command.id, 'pin');
  assert.deepEqual(command.argv, ['pin', 'A']);
  assert.equal(command.exitCode, 0);
  assert.equal(command.durationMs, 12);
  assert.equal(row.kind, 'execution');
});

/**
 * `STD-absent-vs-zero` on the one field where the wrong reading is the
 * dangerous one. A killed or unfinished run has NO exit code; zero is the claim
 * that it succeeded. The two must survive the JSON round trip as different
 * values, and `null` is what survives it — `undefined` would be dropped by
 * `JSON.stringify` and read back as "the field was never written".
 */
test('a run that has not finished records a null exit code, never a zero', () => {
  const row = recordAndRead({
    kind: 'execution',
    op: 'execute',
    command: { id: 'pin', argv: ['pin', 'A'], exitCode: null, durationMs: 0 },
  });
  const command = commandOf(row);
  assert.equal(command.exitCode, null);
  assert.notEqual(command.exitCode, 0);
  assert.ok('exitCode' in command, 'null is RECORDED, not omitted — absent would mean unknown');
});

/**
 * The whole reason this is a seventh kind rather than a `mutation`. Every
 * existing reader of `mutation` reads `itemId` and `fields`; a run is not about
 * one item and may be about none.
 */
test('an execution row is NOT a mutation, so no mutation reader picks it up', () => {
  const b = box();
  try {
    recordAudit(b.root, {
      kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-x',
    });
    recordAudit(b.root, {
      kind: 'execution',
      op: 'execute',
      command: { id: 'doctor', argv: ['doctor'], exitCode: 0, durationMs: 4 },
    });

    const mutations = filterAudit(readAudit(b.root), { kind: 'mutation' });
    assert.equal(mutations.some((r) => r.op === 'execute'), false);
    assert.equal(mutations.length, 1);

    const executions = filterAudit(readAudit(b.root), { kind: 'execution' });
    assert.equal(executions.length, 1);
    assert.equal(executions[0].op, 'execute');
    // A run is about no item, so it answers no item question. `--item RULE-x`
    // must not sweep up the run that happened to be recorded beside it.
    assert.equal(filterAudit(readAudit(b.root), { itemId: 'RULE-x' }).length, 1);
  } finally {
    b.dispose();
  }
});

test('execute is not a member of any other op family', () => {
  assert.ok(!(MUTATION_OPS as readonly string[]).includes('execute'));
  for (const op of EXECUTION_OPS) assert.equal(kindOf(op), 'execution');
});

/**
 * `command` is SCOPE, not content — the same rule `injected` follows, for the
 * same reason. The argv is what RAN; the output of the run is not recorded in
 * any form. This asserts the shape a record actually has on disk, because "we
 * decided not to log stdout" is a comment and this is the thing that fails if a
 * later hand adds one.
 */
test('the command is scope, not content — no stdout, no stderr, no output field', () => {
  const row = recordAndRead({
    kind: 'execution',
    op: 'execute',
    command: { id: 'doctor', argv: ['doctor'], exitCode: 1, durationMs: 90 },
  });
  assert.deepEqual(Object.keys(commandOf(row)).sort(), ['argv', 'durationMs', 'exitCode', 'id']);
  const raw = JSON.stringify(row);
  for (const forbidden of ['stdout', 'stderr', 'output']) {
    assert.equal(raw.includes(forbidden), false, `an execution record must not carry ${forbidden}`);
  }
});
