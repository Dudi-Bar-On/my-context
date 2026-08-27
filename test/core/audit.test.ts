import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendFileSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  AUDIT_KINDS, AUDIT_MAX_BYTES, AUDIT_OPS, AUDIT_PROTOCOL, AUDIT_PROTOCOLS_READ, auditDir,
  auditLogPath, auditSegments, auditSize, EXECUTION_OPS, filterAudit, kindOf, ledgerRows,
  MUTATION_OPS, PROGRESS_OPS, readAudit, recordAudit,
  type AuditRecord,
} from '../../src/core/audit.ts';
import { removeTree } from '../helpers/tmp.ts';

function box(): { root: string; dispose(): void } {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-audit-'));
  return { root, dispose: () => removeTree(root) };
}

function lines(root: string): string[] {
  return readFileSync(auditLogPath(root), 'utf8').split('\n').filter((l) => l !== '');
}

test('an absent log is an empty history, and is not confused with a broken one', () => {
  const b = box();
  assert.deepEqual(readAudit(b.root), []);
  assert.deepEqual(auditSegments(b.root), []);
  assert.deepEqual(auditSize(b.root), { files: [], bytes: 0 });
  b.dispose();
});

test('a record is one JSON line, stamped with the protocol and a UTC instant', () => {
  const b = box();
  const result = recordAudit(b.root, {
    kind: 'mutation', op: 'create', origin: 'agent', itemId: 'RULE-x',
  });
  assert.equal(result.written, true);
  assert.equal(result.error, undefined);

  assert.equal(lines(b.root).length, 1);
  const [record] = readAudit(b.root);
  assert.equal(record.protocol, AUDIT_PROTOCOL);
  assert.equal(record.op, 'create');
  assert.equal(record.origin, 'agent');
  assert.equal(record.itemId, 'RULE-x');
  // UTC, never local — items and logs travel between machines.
  assert.match(record.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  b.dispose();
});

test('the log directory is gitignored, so the log never travels with the corpus', () => {
  const b = box();
  recordAudit(b.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-x' });
  assert.equal(readFileSync(path.join(auditDir(b.root), '.gitignore'), 'utf8'), '*\n');
  b.dispose();
});

test('an emptied .gitignore self-heals on the next append', () => {
  const b = box();
  recordAudit(b.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'A-a' });
  writeFileSync(path.join(auditDir(b.root), '.gitignore'), '', 'utf8');
  recordAudit(b.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'A-b' });
  assert.equal(readFileSync(path.join(auditDir(b.root), '.gitignore'), 'utf8'), '*\n');
  b.dispose();
});

test('an injection records the SCOPE — ids and tiers — and never the injected text', () => {
  const b = box();
  const secret = 'THE BODY TEXT OF A GOVERNING RULE THAT MUST NOT BE COPIED INTO THE LOG';
  recordAudit(b.root, {
    kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/db/writer.ts',
    injected: [{ id: 'RULE-a', tier: 'jit' }],
    spilled: [{ id: 'RULE-b', tier: 'jit', reason: 'budget exceeded (900 > 800 estimated tokens)' }],
  });

  const raw = readFileSync(auditLogPath(b.root), 'utf8');
  assert.equal(raw.includes(secret), false, 'the log must never carry injected text');

  const [record] = readAudit(b.root);
  assert.deepEqual(record.injected, [{ id: 'RULE-a', tier: 'jit' }]);
  assert.equal(record.spilled?.[0].id, 'RULE-b');
  assert.match(record.spilled![0].reason, /budget exceeded/);
  b.dispose();
});

test('a torn FINAL line is tolerated — that is what a killed writer leaves', () => {
  const b = box();
  recordAudit(b.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'A-a' });
  const file = auditLogPath(b.root);
  appendFileSync(file, '{"protocol":"my_context/audit@1","at":"2026-01', 'utf8');

  assert.equal(readAudit(b.root).length, 1);

  // …and the next append heals it rather than leaving a permanent middle line.
  recordAudit(b.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'A-b' });
  const after = readAudit(b.root);
  assert.deepEqual(after.map((r) => r.itemId), ['A-a', 'A-b']);
  assert.equal(lines(b.root).length, 2);
  b.dispose();
});

test('a damaged EARLIER line is refused — an audit trail may not silently omit entries', () => {
  const b = box();
  recordAudit(b.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'A-a' });
  recordAudit(b.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'A-b' });

  const file = auditLogPath(b.root);
  const rows = readFileSync(file, 'utf8').split('\n');
  rows[0] = '{not json';
  writeFileSync(file, rows.join('\n'), 'utf8');

  assert.throws(() => readAudit(b.root), (err: Error) => {
    assert.match(err.message, /cannot be trusted/);
    assert.match(err.message, /line 1/);
    // The refusal must say WHY skipping is not an option here.
    assert.match(err.message, /silently omits entries/);
    return true;
  });
  b.dispose();
});

test('an unrecognised protocol is refused rather than read as an empty history', () => {
  const b = box();
  mkdirSync(auditDir(b.root), { recursive: true });
  writeFileSync(
    auditLogPath(b.root),
    JSON.stringify({ protocol: 'my_context/audit@99', at: 'x', kind: 'mutation', op: 'create' }) + '\n',
    'utf8',
  );
  assert.throws(() => readAudit(b.root), /expected "my_context\/audit@1"/);
  b.dispose();
});

test('a protocol mismatch on the FINAL line is refused too — skew is not a torn write', () => {
  const b = box();
  recordAudit(b.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'A-a' });
  // `@3` rather than `@2`: this build READS `@2` since the `progress` kind
  // landed, so the old literal would have stopped exercising a mismatch at all.
  appendFileSync(
    auditLogPath(b.root),
    JSON.stringify({ protocol: 'my_context/audit@3', at: 'x', kind: 'mutation', op: 'create' }),
    'utf8',
  );
  assert.throws(() => readAudit(b.root), /my_context\/audit@3/);
  b.dispose();
});

// --- the format version, and what an older reader is told (plan §6n.5) ------

test('the write value is @2, and both @1 and @2 are read', () => {
  assert.equal(AUDIT_PROTOCOL, 'my_context/audit@2');
  assert.deepEqual([...AUDIT_PROTOCOLS_READ], ['my_context/audit@1', 'my_context/audit@2']);
  assert.ok(AUDIT_PROTOCOLS_READ.includes(AUDIT_PROTOCOL), 'a build must read what it writes');
});

test('a v1 log still reads after the bump — every kind v1 knew', () => {
  const b = box();
  mkdirSync(auditDir(b.root), { recursive: true });
  const v1 = [
    { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-a' },
    { kind: 'injection', op: 'session-start', sessionId: 's-1', hook: 'SessionStart' },
    { kind: 'hook', op: 'deny' },
    { kind: 'focus', op: 'focus-set', note: 'type=rule' },
    { kind: 'access', op: 'ui-refused' },
  ].map((r, i) => JSON.stringify({
    protocol: 'my_context/audit@1', at: `2026-08-1${i}T00:00:00.000Z`, ...r,
  })).join('\n');
  writeFileSync(auditLogPath(b.root), `${v1}\n`, 'utf8');

  const records = readAudit(b.root);
  assert.equal(records.length, 5);
  // v1 knew five kinds. `progress` and `execution` arrived after it, so the
  // fixture cannot supply them and the expectation says which two and why
  // rather than shrinking to a count.
  assert.deepEqual(
    records.map((r) => r.kind),
    AUDIT_KINDS.filter((k) => k !== 'progress' && k !== 'execution'),
  );
  // Read, not rewritten: the lines on disk still declare @1.
  assert.match(readFileSync(auditLogPath(b.root), 'utf8'), /my_context\/audit@1/);
  b.dispose();
});

test('a v2 log carrying progress records reads', () => {
  const b = box();
  mkdirSync(auditDir(b.root), { recursive: true });
  const v2 = PROGRESS_OPS.map((op, i) => JSON.stringify({
    protocol: 'my_context/audit@2', at: `2026-08-2${i}T00:00:00.000Z`,
    kind: 'progress', op, origin: 'human', itemId: 'PROC-x', note: 'step 1',
  })).join('\n');
  writeFileSync(auditLogPath(b.root), `${v2}\n`, 'utf8');

  const records = readAudit(b.root);
  assert.deepEqual(records.map((r) => r.op), [...PROGRESS_OPS]);
  assert.deepEqual(new Set(records.map((r) => r.kind)), new Set(['progress']));
  b.dispose();
});

test('an unknown FUTURE protocol is refused as version skew, naming no op', () => {
  const b = box();
  mkdirSync(auditDir(b.root), { recursive: true });
  writeFileSync(
    auditLogPath(b.root),
    JSON.stringify({
      protocol: 'my_context/audit@3', at: '2026-09-01T00:00:00.000Z',
      kind: 'telepathy', op: 'mind-read',
    }) + '\n',
    'utf8',
  );
  assert.throws(() => readAudit(b.root), (err: Error) => {
    // The version is the sentence a reader gets…
    assert.match(err.message, /protocol/);
    assert.match(err.message, /my_context\/audit@3/);
    // …and blaming the op is precisely the diagnosis §6n.5 exists to stop.
    assert.doesNotMatch(err.message, /is not one of/);
    assert.doesNotMatch(err.message, /mind-read/);
    assert.doesNotMatch(err.message, /telepathy/);
    return true;
  });
  b.dispose();
});

test('the protocol is checked BEFORE kind and op, so skew never reads as a bad vocabulary', () => {
  const b = box();
  mkdirSync(auditDir(b.root), { recursive: true });
  // A line that is wrong twice over: an unknown protocol AND an unknown op.
  writeFileSync(
    auditLogPath(b.root),
    JSON.stringify({
      protocol: 'my_context/audit@9', at: '2026-09-01T00:00:00.000Z',
      kind: 'mutation', op: 'teleport',
    }) + '\n',
    'utf8',
  );
  assert.throws(() => readAudit(b.root), (err: Error) => {
    assert.match(err.message, /my_context\/audit@9/);
    assert.doesNotMatch(err.message, /teleport/);
    return true;
  });
  b.dispose();
});

test('an unknown op is refused by name, so a vocabulary change cannot pass unnoticed', () => {
  const b = box();
  recordAudit(b.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'A-a' });
  appendFileSync(
    auditLogPath(b.root),
    JSON.stringify({
      protocol: AUDIT_PROTOCOL, at: '2026-08-16T00:00:00.000Z', kind: 'mutation', op: 'teleport',
    }) + '\n',
    'utf8',
  );
  assert.throws(() => readAudit(b.root), /declares op "teleport"/);
  b.dispose();
});

test('a whole-file torn write heals to an empty log rather than wedging it', () => {
  const b = box();
  mkdirSync(auditDir(b.root), { recursive: true });
  writeFileSync(auditLogPath(b.root), '{"protocol":"my_cont', 'utf8');
  assert.deepEqual(readAudit(b.root), []);
  recordAudit(b.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'A-a' });
  assert.deepEqual(readAudit(b.root).map((r) => r.itemId), ['A-a']);
  b.dispose();
});

test('a torn tail longer than one read chunk is still healed', () => {
  const b = box();
  recordAudit(b.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'A-a' });
  // Bigger than the 64 KiB backward-scan chunk, so the scan has to loop.
  appendFileSync(auditLogPath(b.root), 'x'.repeat(200 * 1024), 'utf8');
  recordAudit(b.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'A-b' });
  assert.deepEqual(readAudit(b.root).map((r) => r.itemId), ['A-a', 'A-b']);
  b.dispose();
});

test('recordAudit reports a write failure rather than throwing or swallowing it', () => {
  const b = box();
  // A FILE where the directory must be: `mkdirSync` then fails with ENOTDIR /
  // EEXIST on every platform, which is a write failure this must survive.
  writeFileSync(auditDir(b.root), 'not a directory', 'utf8');
  const result = recordAudit(b.root, {
    kind: 'mutation', op: 'create', origin: 'human', itemId: 'A-a',
  });
  assert.equal(result.written, false);
  assert.equal(typeof result.error, 'string');
  assert.notEqual(result.error, '');
  b.dispose();
});

test('the live log rotates at the size cap, and no record is lost across the boundary', () => {
  const b = box();
  recordAudit(b.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'BEFORE-a' });

  // Grow the live log past the cap without rewriting the record already in it.
  const file = auditLogPath(b.root);
  const filler = JSON.stringify({
    protocol: AUDIT_PROTOCOL, at: '2026-08-16T00:00:00.000Z', kind: 'hook', op: 'deny',
  }) + '\n';
  let size = statSync(file).size;
  while (size < AUDIT_MAX_BYTES) {
    appendFileSync(file, filler.repeat(2000), 'utf8');
    size = statSync(file).size;
  }

  recordAudit(b.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'AFTER-a' });

  const segments = auditSegments(b.root);
  assert.equal(segments.length, 2, 'one rotated segment plus the live log');
  assert.equal(segments[segments.length - 1], auditLogPath(b.root));
  // The live log is small again — that is what rotation is for.
  assert.ok(statSync(auditLogPath(b.root)).size < AUDIT_MAX_BYTES);

  // Nothing was deleted: both records are still readable, oldest first.
  const ids = readAudit(b.root).map((r) => r.itemId).filter((id) => id !== undefined);
  assert.deepEqual(ids, ['BEFORE-a', 'AFTER-a']);
  b.dispose();
});

test('every op has exactly one kind, and the vocabulary has no duplicates', () => {
  assert.equal(new Set(AUDIT_OPS).size, AUDIT_OPS.length);
  for (const op of AUDIT_OPS) assert.ok(kindOf(op), `${op} has no kind`);
  for (const op of MUTATION_OPS) assert.equal(kindOf(op), 'mutation');
});

test('every progress op is classified progress, and none is a mutation', () => {
  for (const op of PROGRESS_OPS) assert.equal(kindOf(op), 'progress');
  for (const op of PROGRESS_OPS) assert.ok(!(MUTATION_OPS as readonly string[]).includes(op));
});

/**
 * The register is closed and ORDERED, and both halves matter: a kind absent
 * from `AUDIT_KINDS` is refused by `specFor`'s validator on every line, and the
 * order is what the CLI's and MCP's enum listings show a reader.
 */
test('the kind register is APPEND-ONLY — progress sixth, execution seventh, nothing moved', () => {
  assert.deepEqual(
    AUDIT_KINDS,
    ['mutation', 'injection', 'hook', 'focus', 'access', 'progress', 'execution'],
  );
  assert.equal(new Set(AUDIT_KINDS).size, AUDIT_KINDS.length);
  assert.equal(new Set(AUDIT_OPS.map(kindOf)).size, AUDIT_KINDS.length,
    'every registered kind is reachable from some op');
});

/**
 * The classifications that were here before `subagent-start` and
 * `post-tool-use-failure` were, asserted one by one rather than as a loop over
 * the same table the product uses. A table that classified `refresh` as
 * `injection` would pass every totality check above it.
 *
 * The table grows by exactly the ops each task adds and nothing is ever removed
 * from it, so every op this module has EVER registered stays pinned to the kind
 * it was born with — `progress` added the three `step-*` rows below to the
 * twenty it inherited, the hooks round added two more to those twenty-three,
 * `session-end` made twenty-six, and `post-compact` makes twenty-seven.
 */
test('no pre-existing op changed kind', () => {
  const before: Record<string, string> = {
    create: 'mutation', update: 'mutation', stage: 'mutation', promote: 'mutation',
    discard: 'mutation', supersede: 'mutation', accept: 'mutation', refresh: 'mutation',
    link: 'mutation', unlink: 'mutation',
    'session-start': 'injection', 'compact-restore': 'injection', jit: 'injection',
    manual: 'injection',
    'pre-compact': 'hook', 'post-tool-use': 'hook', deny: 'hook',
    'focus-set': 'focus', 'focus-clear': 'focus',
    'ui-refused': 'access',
    'step-done': 'progress', 'step-undone': 'progress', 'step-reset': 'progress',
    'subagent-start': 'injection', 'post-tool-use-failure': 'hook',
    'session-end': 'hook',
  };
  for (const [op, kind] of Object.entries(before)) {
    assert.equal(kindOf(op as (typeof AUDIT_OPS)[number]), kind, `${op} changed kind`);
  }
  // …and the vocabulary grew by exactly the ops the rounds since have added, in
  // the position their family puts them: `post-compact` ends the PostCompact
  // round's hook ops, and the ten behind it are the observation events
  // (hooks plan seq:21 and seq:2b), appended as one block in the order the
  // manifest registers them. Every one of THOSE is a `hook` — they inject
  // nothing — which is the half of this test that matters: a new op that
  // arrived as an `injection` would make `mycontext audit --kind injection`
  // over-report what models were shown.
  //
  // `execute` (2026-08-27) is the one addition that is NOT a hook, and it is
  // excluded by name rather than by relaxing the loop: it is the web UI
  // running a catalogue command, which is neither an injection nor a hook
  // firing, and folding it into either family would make that family's
  // filter over-report exactly the way the paragraph above describes.
  assert.deepEqual(
    AUDIT_OPS.filter((op) => !(op in before)),
    ['post-compact',
      'file-changed', 'instructions-loaded', 'config-change', 'permission-denied',
      'subagent-stop', 'stop', 'setup', 'task-created', 'task-completed', 'prompt-expansion',
      'execute', 'execute-done'],
  );
  // The execution PAIR, and it is a pair because the log cannot be amended:
  // `execute` is appended before the process starts and `execute-done` after it
  // returns. An `execute` row with no `execute-done` beside it is a run that
  // never came back — the same attempted/complete shape `pre-compact` and
  // `subagent-start` already use, for the same reason.
  for (const op of EXECUTION_OPS) assert.equal(kindOf(op), 'execution');
  for (const op of AUDIT_OPS.filter((o) => !(o in before) && !EXECUTION_OPS.includes(o as never))) {
    assert.equal(kindOf(op), 'hook', `${op} joined a family that claims something it did not do`);
  }
});

// --- filtering --------------------------------------------------------------

function rec(over: Partial<AuditRecord>): AuditRecord {
  return {
    protocol: AUDIT_PROTOCOL, at: '2026-08-16T12:00:00.000Z',
    kind: 'mutation', op: 'create', ...over,
  } as AuditRecord;
}

test('filters compose, and a time range is inclusive at the start and exclusive at the end', () => {
  const records = [
    rec({ at: '2026-08-14T00:00:00.000Z', itemId: 'A-a', origin: 'human' }),
    rec({ at: '2026-08-15T00:00:00.000Z', itemId: 'A-b', origin: 'agent' }),
    rec({ at: '2026-08-16T00:00:00.000Z', itemId: 'A-c', origin: 'agent' }),
  ];
  assert.deepEqual(
    filterAudit(records, { since: '2026-08-15T00:00:00.000Z' }).map((r) => r.itemId),
    ['A-b', 'A-c'],
  );
  assert.deepEqual(
    filterAudit(records, { until: '2026-08-15T00:00:00.000Z' }).map((r) => r.itemId),
    ['A-a'],
  );
  assert.deepEqual(
    filterAudit(records, { origin: 'agent', since: '2026-08-16T00:00:00.000Z' })
      .map((r) => r.itemId),
    ['A-c'],
  );
});

test('--limit keeps the NEWEST n, and applies after every other filter', () => {
  const records = [
    rec({ at: '2026-08-14T00:00:00.000Z', itemId: 'A-a' }),
    rec({ at: '2026-08-15T00:00:00.000Z', itemId: 'A-b', op: 'update' }),
    rec({ at: '2026-08-16T00:00:00.000Z', itemId: 'A-c' }),
  ];
  assert.deepEqual(filterAudit(records, { limit: 2 }).map((r) => r.itemId), ['A-b', 'A-c']);
  // The op filter selects two; the limit then takes the newer of those two —
  // not the newest record overall.
  assert.deepEqual(
    filterAudit(records, { op: 'create', limit: 1 }).map((r) => r.itemId), ['A-c'],
  );
});

test('an item filter matches an injection that DELIVERED it and one that SPILLED it', () => {
  const records = [
    rec({ kind: 'injection', op: 'jit', itemId: undefined, injected: [{ id: 'RULE-a', tier: 'jit' }] }),
    rec({
      kind: 'injection', op: 'jit', itemId: undefined,
      injected: [], spilled: [{ id: 'RULE-b', tier: 'jit', reason: 'budget exceeded' }],
    }),
    rec({ kind: 'mutation', op: 'update', itemId: 'RULE-a' }),
  ];
  assert.equal(filterAudit(records, { itemId: 'RULE-a' }).length, 2);
  assert.equal(filterAudit(records, { itemId: 'RULE-b' }).length, 1);
  assert.equal(filterAudit(records, { itemId: 'RULE-zzz' }).length, 0);
});

// --- the ledger is derived, and rebuildable from here -----------------------

test('ledgerRows replays every injection that carried a session, and nothing else', () => {
  const records = [
    rec({
      kind: 'injection', op: 'session-start', sessionId: 's1', at: '2026-08-16T10:00:00.000Z',
      injected: [{ id: 'RULE-a', tier: 'pinned' }, { id: 'RULE-b', tier: 'pinned' }],
    }),
    // A manual load has no trustworthy session id, so it contributes no row —
    // exactly as it contributes none to the live ledger today.
    rec({ kind: 'injection', op: 'manual', injected: [{ id: 'RULE-c', tier: 'pinned' }] }),
    // A hook action that injected nothing is not a ledger row either.
    rec({
      kind: 'hook', op: 'pre-compact', sessionId: 's1',
      injected: [{ id: 'RULE-a', tier: 'snapshot' }],
    }),
    rec({ kind: 'mutation', op: 'update', itemId: 'RULE-a' }),
  ];
  assert.deepEqual(ledgerRows(records), [
    { sessionId: 's1', itemId: 'RULE-a', tier: 'pinned', at: '2026-08-16T10:00:00.000Z' },
    { sessionId: 's1', itemId: 'RULE-b', tier: 'pinned', at: '2026-08-16T10:00:00.000Z' },
  ]);
});

test('an index line is in the log but is NOT a ledger row — it was never delivered', () => {
  // The audit log records session-start index LINES at `tier: 'index'`, because
  // they are text the model saw. `Ledger` stores only the three DELIVERY tiers.
  // Replaying an index line as a ledger row would make a rebuilt ledger claim a
  // full-text injection that never happened — and `seen`, which the selector
  // consults on the hot path, would then suppress an item nobody had been shown.
  const records = [rec({
    kind: 'injection', op: 'session-start', sessionId: 's1', at: '2026-08-16T10:00:00.000Z',
    injected: [
      { id: 'RULE-delivered', tier: 'pinned' },
      { id: 'RULE-listed-only', tier: 'index' },
    ],
  })];
  assert.deepEqual(ledgerRows(records), [
    { sessionId: 's1', itemId: 'RULE-delivered', tier: 'pinned', at: '2026-08-16T10:00:00.000Z' },
  ]);
});

test('a snapshot entry is not a ledger row either — PreCompact delivers nothing', () => {
  const records = [rec({
    kind: 'injection', op: 'session-start', sessionId: 's1', at: '2026-08-16T10:00:00.000Z',
    injected: [{ id: 'RULE-a', tier: 'snapshot' }, { id: 'RULE-b', tier: 'jit' }],
  })];
  assert.deepEqual(ledgerRows(records).map((r) => r.itemId), ['RULE-b']);
});

test('a restored entry replays its own compaction marker, not the record wall clock', () => {
  const records = [rec({
    kind: 'injection', op: 'compact-restore', sessionId: 's1', at: '2026-08-16T10:00:05.000Z',
    injected: [
      { id: 'RULE-a', tier: 'pinned' },
      { id: 'RULE-b', tier: 'restored', at: '2026-08-16T09:59:00.000Z' },
    ],
  })];
  assert.deepEqual(ledgerRows(records), [
    { sessionId: 's1', itemId: 'RULE-a', tier: 'pinned', at: '2026-08-16T10:00:05.000Z' },
    // The snapshot's own capturedAt — the identity marker restore idempotency
    // compares for EQUALITY. Replaying the wall clock instead would silently
    // break the restore this replay exists to preserve.
    { sessionId: 's1', itemId: 'RULE-b', tier: 'restored', at: '2026-08-16T09:59:00.000Z' },
  ]);
});
