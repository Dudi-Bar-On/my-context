/**
 * `history.jsonl` is the audit log with four things done to it — filtered to
 * mutations, projected onto a fixed key list, redacted, and joined to the
 * items that actually travel — and every one of the four is a way a pack can
 * carry something nobody decided to send.
 *
 * Three of the tests below are the ones worth reading twice:
 *
 *  1. **the per-machine half is projected away** — asserted over the exact key
 *     SET, not by looking for the fields we thought of, so a field added to
 *     `AuditRecord` next year fails this rather than travelling.
 *  2. **a note naming another item travels only when that item travels** —
 *     `supersede`, `link` and `unlink` write another item's id into `note`,
 *     none of those notes contains `': '`, and the plan's redaction rule
 *     therefore keeps them whole. This case is driven through the REAL
 *     writers, not a fixture, because a fixture would only prove that the
 *     rule matches the shape this file imagined.
 *  3. **a foreign protocol is refused wholesale** — the loosening this module
 *     makes is the op vocabulary and nothing else.
 *
 * **Refusals are asserted by their MESSAGE.** Every malformed row below breaks
 * exactly one rule, and each assertion names the field its own guard reports,
 * because three of the parser's four refusals share the phrase "is missing or
 * mistypes" and a test that matched only that would stay green with any one of
 * them deleted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  AUDIT_PROTOCOL, auditDir, auditLogPath, MUTATION_OPS, recordAudit,
  type AuditRecord,
} from '../../src/core/audit.ts';
import { createItem, supersedeItem } from '../../src/core/mutate.ts';
import { linkItems } from '../../src/core/relations.ts';
import { PACK_HISTORY_PROTOCOL } from '../../src/pack/layout.ts';
import {
  compareHistory, exportableHistory, parseHistory, projectMutation, renderHistory,
  type PackHistoryRecord,
} from '../../src/pack/history.ts';
import { sandbox } from '../helpers/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const AT = '2026-08-01T00:00:00.000Z';

function rec(over: Partial<AuditRecord> = {}): AuditRecord {
  return {
    protocol: AUDIT_PROTOCOL,
    at: AT,
    kind: 'mutation',
    op: 'create',
    origin: 'human',
    itemId: 'RULE-a',
    ...over,
  };
}

/** A bare directory: `recordAudit` needs no workspace, only a root to write under. */
function box(): { root: string; dispose(): void } {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-pack-history-'));
  return { root, dispose: () => removeTree(root) };
}

function lines(records: readonly PackHistoryRecord[]): Record<string, unknown>[] {
  const text = renderHistory(records).toString('utf8');
  if (text === '') return [];
  return text.slice(0, -1).split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
}

/** One raw JSONL file's bytes, from rows written exactly as given. */
function jsonl(...rows: Record<string, unknown>[]): Buffer {
  return Buffer.from(rows.map((r) => `${JSON.stringify(r)}\n`).join(''), 'utf8');
}

function strangerRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    protocol: PACK_HISTORY_PROTOCOL, at: AT, kind: 'mutation', op: 'create',
    origin: 'human', itemId: 'RULE-a', ...over,
  };
}

function refusalOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  return assert.fail('nothing was refused');
}

// ---------------------------------------------------------------------------
// The projection
// ---------------------------------------------------------------------------

test('the per-machine half is projected away, not passed through', () => {
  // Every optional field `AuditRecord` permits on a record, set at once. None
  // of them is a parameter of either mutation-record writer today, which is
  // exactly why the projection is a key list rather than a passthrough: "no
  // writer sets it" is a fact about writers, not about the type.
  const p = projectMutation(rec({
    sessionId: 'abc',
    path: 'src/db/writer.ts',
    hook: 'PreToolUse',
    tokens: 12,
    injected: [{ id: 'RULE-secret', tier: 'normative' }],
    spilled: [{ id: 'RULE-other', tier: 'normative', reason: 'budget' }],
    refusal: {
      check: 'host', status: 403, method: 'GET', route: '/api/items', host: 'evil', origin: null,
    },
  }));
  assert.deepEqual(Object.keys(p), ['protocol', 'at', 'kind', 'op', 'origin', 'itemId']);
  assert.equal(p.protocol, PACK_HISTORY_PROTOCOL);
});

test('the projection copies `fields` rather than aliasing the log record\'s own array', () => {
  const source = rec({ fields: ['body', 'tags'] });
  const p = projectMutation(source);
  assert.deepEqual(p.fields, ['body', 'tags']);
  assert.notEqual(p.fields, source.fields, 'a caller editing the projection would edit the log record');
});

test('the key order is part of the format, in the bytes a receiver gets', () => {
  const p = projectMutation(rec({
    op: 'discard', fields: ['body'], note: 'REV-abc123def456', origin: 'agent',
  }));
  assert.deepEqual(
    Object.keys(lines([p])[0] as Record<string, unknown>),
    ['protocol', 'at', 'kind', 'op', 'origin', 'itemId', 'fields', 'note'],
  );
});

test('a discard note keeps the revision id and drops the free text after the first colon-space', () => {
  assert.equal(projectMutation(rec({ op: 'discard', note: 'REV-7: it named a customer' })).note, 'REV-7');
  assert.equal(projectMutation(rec({ op: 'discard', note: 'REV-7' })).note, 'REV-7');
  // The FIRST colon-space, so a reason that itself contains one keeps nothing.
  assert.equal(
    projectMutation(rec({ op: 'stage', note: 'REV-7: acme: the login flow' })).note,
    'REV-7',
  );
});

test('no op carries free text past the first colon-space, whatever its note rule', () => {
  for (const op of MUTATION_OPS) {
    const note = projectMutation(rec({ op, note: 'REV-1: the customer is Acme Holdings' })).note;
    assert.equal(
      note === undefined || !note.includes('Acme'), true,
      `${op} carried the free half of its note: ${String(note)}`,
    );
  }
});

test('the five ops that write no note never carry one, even when the log holds one', () => {
  // `create`, `update`, `promote`, `accept` and `refresh` all reach
  // `auditMutation` with no `extra.note`, so a note on one of these records
  // came from somewhere this build does not account for and does not travel.
  for (const op of ['create', 'update', 'promote', 'accept', 'refresh'] as const) {
    assert.equal(projectMutation(rec({ op, note: 'RULE-withheld' })).note, undefined, op);
  }
});

test('a note naming another item travels only when that item travels', () => {
  // These three notes carry an id and contain no colon-space, so the plan's
  // redaction alone keeps them whole — one field away from the join that
  // exists because an id is a slugified title.
  const cases: [AuditRecord['op'], string][] = [
    ['supersede', 'by RULE-b'],
    ['link', 'refines RULE-b'],
    ['unlink', 'refines RULE-b'],
  ];
  for (const [op, note] of cases) {
    assert.equal(
      projectMutation(rec({ op, note }), new Set(['RULE-a'])).note, undefined,
      `${op} republished the withheld RULE-b`,
    );
    assert.equal(
      projectMutation(rec({ op, note }), new Set(['RULE-a', 'RULE-b'])).note, note,
      `${op} dropped a note naming an item that does travel`,
    );
  }
});

test('with no selection at all, an item-ref note is withheld rather than passed through', () => {
  // The absent argument is the SAFE direction: a caller that forgets it
  // under-reports, where the other default would leak.
  assert.equal(projectMutation(rec({ op: 'supersede', note: 'by RULE-b' })).note, undefined);
});

test('an item-ref note in neither writer\'s shape does not travel, carried id or not', () => {
  // `by <id>` and `<relation> <id>` are the only two shapes these three ops
  // write. A note with no space at all names something this build cannot
  // account for, so it is withheld even when the whole string is a carried id.
  assert.equal(
    projectMutation(rec({ op: 'supersede', note: 'RULE-b' }), new Set(['RULE-a', 'RULE-b'])).note,
    undefined,
  );
});

test('the ten mutation ops are the ten this module has checked a note rule for', () => {
  // `NOTE_RULE` is a total `Record<MutationOp, …>`, so an eleventh op will not
  // compile until someone gives it a rule — but nothing makes them read the
  // new op's WRITER first. This reddens when the vocabulary moves, which is
  // the moment to go and look at what that writer puts in `note`.
  assert.deepEqual([...MUTATION_OPS].toSorted(), [
    'accept', 'create', 'discard', 'link', 'promote', 'refresh',
    'stage', 'supersede', 'unlink', 'update',
  ]);
});

test('a record that is not a mutation is refused, never stamped as one', () => {
  // Projecting an injection would put `kind: "mutation"` on a record that is
  // not one, and `kind` is in the format so the file self-describes.
  const message = refusalOf(() => projectMutation(rec({
    kind: 'injection', op: 'session-start', sessionId: 's1',
  })));
  assert.match(message, /only a mutation travels with a pack/);
  assert.match(message, /"session-start"/);
  // The guard has two halves and each needs a case that ONLY it can catch,
  // or one of them can be deleted with the suite still green. `parseAudit`
  // validates `kind` and `op` against their vocabularies independently and
  // never against `KIND_OF`, so a hand-edited segment can carry either
  // mismatch.
  assert.match(
    refusalOf(() => projectMutation(rec({ op: 'jit' }))),
    /only a mutation travels with a pack/,
    'a mutation kind carrying an injection op',
  );
  assert.match(
    refusalOf(() => projectMutation(rec({ kind: 'progress', op: 'create' }))),
    /only a mutation travels with a pack/,
    'a progress kind carrying a mutation op',
  );
});

test('an `at` that is not the one instant spelling is refused rather than coerced', () => {
  // `AuditInput` lets a caller supply its own `at` and the audit reader checks
  // only that it is a string, so a hand-written segment reaches here — and
  // exporting it would write a line `parseHistory` refuses to read back.
  for (const at of ['2026-08-01', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00.000+01:00', '2026-02-30T00:00:00.000Z']) {
    assert.match(
      refusalOf(() => projectMutation(rec({ at }))),
      /is not a UTC instant with milliseconds/,
      at,
    );
  }
  assert.equal(projectMutation(rec({ at: '2026-08-01T00:00:00.000Z' })).at, AT);
});

// ---------------------------------------------------------------------------
// The order
// ---------------------------------------------------------------------------

test('the order is total: equal timestamps fall back to itemId, then op, then original position', () => {
  const projected = [
    rec({ at: AT, itemId: 'B', op: 'update' }),
    rec({ at: AT, itemId: 'A', op: 'update' }),
    rec({ at: AT, itemId: 'A', op: 'create' }),
    rec({ at: '2026-07-31T23:59:59.999Z', itemId: 'Z', op: 'create' }),
  ].map((r) => projectMutation(r));
  assert.deepEqual(
    lines(projected.toSorted(compareHistory)).map((r) => `${String(r.at)}|${String(r.itemId)}:${String(r.op)}`),
    [
      `2026-07-31T23:59:59.999Z|Z:create`,
      `${AT}|A:create`,
      `${AT}|A:update`,
      `${AT}|B:update`,
    ],
  );
});

test('records equal in all three keys keep the order the log had them in', () => {
  // The fourth component of the order is the record's position in the
  // concatenated segments, and it is carried by the stability of the sort
  // rather than by a comparison — so two runs over one log produce one file.
  const projected = [
    projectMutation(rec({ op: 'update', fields: ['body'] })),
    projectMutation(rec({ op: 'update', fields: ['tags'] })),
    projectMutation(rec({ op: 'update', fields: ['scope'] })),
  ];
  assert.deepEqual(
    projected.toSorted(compareHistory).map((r) => r.fields?.[0]),
    ['body', 'tags', 'scope'],
  );
});

test('a record with no itemId sorts before every id at the same instant', () => {
  const named = projectMutation(rec({ itemId: 'A' }));
  const anonymous = projectMutation(rec({ itemId: undefined }));
  assert.equal(anonymous.itemId, undefined);
  assert.deepEqual(
    [named, anonymous].toSorted(compareHistory).map((r) => r.itemId),
    [undefined, 'A'],
  );
});

test('the sort is over UTF-8 bytes, not UTF-16 code units', () => {
  // U+1D400 encodes F0 9D 90 80 and U+FF21 encodes EF BC A1, so by BYTES the
  // astral id sorts AFTER, while the default comparison — over UTF-16 code
  // units — puts the surrogate pair (D835) first. Reachable through an
  // arriving history: `ID_GRAMMAR` guards ids where ITEMS are minted and read,
  // and nothing applies it to an id inside a log row.
  const astral = parseHistory(jsonl(
    strangerRow({ itemId: '\u{1D400}' }),
    strangerRow({ itemId: 'Ａ' }),
  ), 'history.jsonl').records;
  assert.deepEqual(
    astral.toSorted(compareHistory).map((r) => r.itemId),
    ['Ａ', '\u{1D400}'],
  );
  assert.deepEqual(
    astral.map((r) => r.itemId ?? '').toSorted(),
    ['\u{1D400}', 'Ａ'],
    'the default sort is expected to disagree — if it does not, this case proves nothing',
  );
});

// ---------------------------------------------------------------------------
// The bytes
// ---------------------------------------------------------------------------

test('every line is newline-terminated, including the last, and no records is no bytes', () => {
  const text = renderHistory([projectMutation(rec()), projectMutation(rec({ op: 'update' }))])
    .toString('utf8');
  assert.equal(text.endsWith('}\n'), true);
  assert.equal(text.split('\n').length, 3);
  assert.equal(text.includes('\r'), false);
  assert.equal(text.includes('\n\n'), false);
  assert.equal(renderHistory([]).length, 0);
});

test('rendering re-canonicalises, so a record assembled in another order is the same bytes', () => {
  // `JSON.stringify` follows insertion order, and the format may not depend on
  // the order a caller happened to build a record in — the digest in the
  // manifest is over these bytes.
  const canonical = projectMutation(rec({ op: 'discard', fields: ['body'], note: 'REV-7' }));
  const reordered: PackHistoryRecord = {
    note: 'REV-7',
    fields: ['body'],
    itemId: 'RULE-a',
    origin: 'human',
    op: 'discard',
    kind: 'mutation',
    at: AT,
    protocol: PACK_HISTORY_PROTOCOL,
  };
  assert.deepEqual(renderHistory([reordered]), renderHistory([canonical]));
  assert.deepEqual(renderHistory([canonical]), renderHistory([canonical]));
});

test('rendered bytes parse back into the same records', () => {
  const written = [
    projectMutation(rec({ op: 'discard', note: 'REV-7: dropped', fields: ['body', 'tags'] })),
    projectMutation(rec({ op: 'supersede', note: 'by RULE-b' }), new Set(['RULE-a', 'RULE-b'])),
    projectMutation(rec({ itemId: undefined, origin: undefined })),
  ];
  const read = parseHistory(renderHistory(written), 'history.jsonl');
  assert.deepEqual(read.unknown, []);
  assert.deepEqual(read.records, written);
  assert.deepEqual(renderHistory(read.records), renderHistory(written));
});

// ---------------------------------------------------------------------------
// Reading a stranger's file
// ---------------------------------------------------------------------------

test('parseHistory quarantines an unknown op instead of refusing the whole file', () => {
  const { records, unknown } = parseHistory(jsonl(
    strangerRow(),
    strangerRow({ at: '2026-08-02T00:00:00.000Z', op: 'annotate', itemId: 'RULE-b' }),
  ), 'history.jsonl');
  assert.equal(records.length, 1);
  assert.equal(records[0]?.itemId, 'RULE-a');
  assert.equal(unknown.length, 1);
  assert.equal(unknown[0]?.row.op, 'annotate');
  // Verbatim, so whoever quarantines it writes down what actually arrived.
  assert.equal(unknown[0]?.row.itemId, 'RULE-b');
  assert.equal(unknown[0]?.line, 2, 'the line of the file, which here is also the second row');
});

test('a quarantined row carries its line in the FILE, not its place in the batch', () => {
  // Thirty-nine rows this build reads without complaint — and two blank lines
  // — stand between the top of the file and the row that is set aside, so the
  // two numbers cannot be confused: the row is the FIRST one quarantined and
  // the FORTIETH one read, and it is on line 42.
  const good: Record<string, unknown>[] = [];
  for (let i = 0; i < 39; i += 1) good.push(strangerRow({ itemId: `RULE-${i}` }));
  const alien = strangerRow({ op: 'annotate' });
  const text = `\n${good.map((r) => `${JSON.stringify(r)}\n`).join('')}\n${JSON.stringify(alien)}\n`;

  const { records, unknown } = parseHistory(Buffer.from(text, 'utf8'), 'history.jsonl');

  assert.equal(records.length, 39);
  assert.equal(unknown.length, 1);
  assert.equal(unknown[0]?.line, 42);
  // Checked the way a person checks it: open the file, go to that line.
  assert.equal(text.split('\n')[41], JSON.stringify(alien));
});

test('a row this build cannot act on is quarantined one row at a time, never dropped', () => {
  const cases: [string, Record<string, unknown>][] = [
    // A kind this build does not act on, carrying an op it DOES know — so the
    // `kind` clause is the only one that can catch it. `kind: 'progress',
    // op: 'step-done'` would be caught by the op check too, and the kind check
    // could then be deleted with this case still green.
    ['a kind outside this format', strangerRow({ kind: 'progress' })],
    ['a key outside the projection', strangerRow({ sessionId: 'abc' })],
    ['an origin outside the closed three', strangerRow({ origin: 'import' })],
    ['a mistyped fields', strangerRow({ fields: 'body' })],
    ['a fields holding a non-string', strangerRow({ fields: ['body', 7] })],
    ['a mistyped itemId', strangerRow({ itemId: 42 })],
    ['a mistyped note', strangerRow({ op: 'discard', note: { text: 'x' } })],
  ];
  for (const [why, row] of cases) {
    const { records, unknown } = parseHistory(jsonl(strangerRow(), row), 'history.jsonl');
    assert.equal(records.length, 1, why);
    assert.equal(unknown.length, 1, why);
    assert.deepEqual(unknown[0]?.row, row, why);
    assert.equal(unknown[0]?.line, 2, why);
  }
});

test('a foreign protocol is refused wholesale — the loosening is the op vocabulary only', () => {
  for (const protocol of ['someone/else@1', AUDIT_PROTOCOL, 'my_context/audit@1']) {
    assert.match(
      refusalOf(() => parseHistory(jsonl(strangerRow({ protocol })), 'history.jsonl')),
      /declares protocol/,
      protocol,
    );
  }
  // The mirror of the same rule: this file's protocol is not the audit log's,
  // so a stray copy either way is refused rather than silently merged.
  assert.notEqual(PACK_HISTORY_PROTOCOL, AUDIT_PROTOCOL);
});

test('a row that is not a log line at all takes the file with it, and the message names which rule', () => {
  const cases: [Record<string, unknown>, RegExp][] = [
    [{ protocol: PACK_HISTORY_PROTOCOL, kind: 'mutation', op: 'create' }, /is missing or mistypes "at"/],
    [strangerRow({ at: '2026-08-01' }), /is stamped "2026-08-01", which is not a UTC instant/],
    [strangerRow({ at: '2026-02-30T00:00:00.000Z' }), /is not a UTC instant with milliseconds/],
    [{ protocol: PACK_HISTORY_PROTOCOL, at: AT, op: 'create' }, /is missing or mistypes "kind"/],
    [{ protocol: PACK_HISTORY_PROTOCOL, at: AT, kind: 'mutation' }, /is missing or mistypes "op"/],
    [strangerRow({ op: 7 }), /is missing or mistypes "op"/],
  ];
  for (const [row, expected] of cases) {
    const message = refusalOf(() => parseHistory(jsonl(row), 'a-pack/history.jsonl'));
    assert.match(message, expected, JSON.stringify(row));
    assert.match(message, /the pack history at a-pack\/history\.jsonl cannot be read — line 1/);
    // The refusal must say that an unknown op is NOT this error, or a reader
    // sent here by version skew goes looking for corruption.
    assert.match(message, /kept aside and counted/);
  }
});

test('a torn final line is tolerated; a damaged line anywhere else is not', () => {
  const good = JSON.stringify(strangerRow());
  const torn = parseHistory(Buffer.from(`${good}\n{"protocol":"my_c`, 'utf8'), 'history.jsonl');
  assert.equal(torn.records.length, 1);
  assert.equal(torn.unknown.length, 0);
  // A row set aside BEFORE a torn tail still knows its own line. The tail is
  // the one row the shared parser drops and it is always the last, so dropping
  // it cannot shift anything that came before it.
  const alien = JSON.stringify(strangerRow({ op: 'annotate' }));
  const both = parseHistory(
    Buffer.from(`${good}\n${alien}\n{"protocol":"my_c`, 'utf8'), 'history.jsonl',
  );
  assert.equal(both.records.length, 1);
  assert.deepEqual(both.unknown.map((u) => u.line), [2]);
  assert.match(
    refusalOf(() => parseHistory(Buffer.from(`{"broken\n${good}\n`, 'utf8'), 'history.jsonl')),
    /line 1 is not valid JSON/,
  );
});

// ---------------------------------------------------------------------------
// A real workspace's log
// ---------------------------------------------------------------------------

test('history is joined to the selection: a record naming a withheld item does not travel', () => {
  const b = box();
  try {
    // Written out of order on purpose: the log is append-only and a caller
    // may supply its own `at`, so the file's order is not the artefact's.
    recordAudit(b.root, {
      kind: 'mutation', op: 'update', origin: 'agent', itemId: 'RULE-a',
      at: '2026-08-03T00:00:00.000Z', fields: ['body'],
    });
    recordAudit(b.root, {
      kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-a', at: AT,
    });
    recordAudit(b.root, {
      kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-b',
      at: '2026-08-02T00:00:00.000Z',
    });
    // A mutation naming no item at all: no selection can carry it.
    recordAudit(b.root, {
      kind: 'mutation', op: 'create', origin: 'human', at: '2026-08-04T00:00:00.000Z',
    });

    const kept = exportableHistory(b.root, new Set(['RULE-a']));
    assert.deepEqual(kept.map((r) => `${r.at}:${r.op}`), [`${AT}:create`, '2026-08-03T00:00:00.000Z:update']);
    assert.deepEqual([...new Set(kept.map((r) => r.itemId))], ['RULE-a']);
    assert.deepEqual(exportableHistory(b.root, new Set()), []);
  } finally { b.dispose(); }
});

test('injections, hook actions, focus, access and progress records never travel', () => {
  const b = box();
  try {
    const secret = 'THE BODY TEXT OF A GOVERNING RULE';
    recordAudit(b.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-a' });
    recordAudit(b.root, {
      kind: 'injection', op: 'session-start', sessionId: 's1', hook: 'SessionStart',
      injected: [{ id: 'RULE-a', tier: 'normative' }], tokens: 12, note: secret,
    });
    recordAudit(b.root, { kind: 'hook', op: 'post-tool-use', sessionId: 's1', path: 'src/x.ts' });
    recordAudit(b.root, { kind: 'focus', op: 'focus-set', origin: 'agent', note: 'scope=src' });
    recordAudit(b.root, { kind: 'progress', op: 'step-done', origin: 'human', itemId: 'RULE-a', note: 'step 3' });

    const kept = exportableHistory(b.root, new Set(['RULE-a']));
    assert.deepEqual(kept.filter((r) => r.kind !== 'mutation'), []);
    assert.deepEqual(kept.map((r) => r.op), ['create']);
    assert.equal(renderHistory(kept).toString('utf8').includes(secret), false);
    assert.equal(renderHistory(kept).toString('utf8').includes('step 3'), false);
  } finally { b.dispose(); }
});

test('every segment travels, not only the live log', () => {
  const b = box();
  try {
    // A rotated segment holds the oldest records, and a workspace that has
    // ever crossed AUDIT_MAX_BYTES has several. Reading only `audit.jsonl`
    // would export a fraction of a corpus's history with nothing saying so.
    mkdirSync(auditDir(b.root), { recursive: true });
    writeFileSync(
      path.join(auditDir(b.root), 'audit.20260801T000000000Z-1.jsonl'),
      `${JSON.stringify({
        protocol: AUDIT_PROTOCOL, at: AT, kind: 'mutation', op: 'create',
        origin: 'human', itemId: 'RULE-a',
      })}\n`,
      'utf8',
    );
    recordAudit(b.root, {
      kind: 'mutation', op: 'update', origin: 'human', itemId: 'RULE-a',
      at: '2026-08-02T00:00:00.000Z', fields: ['body'],
    });
    assert.equal(auditLogPath(b.root).endsWith('audit.jsonl'), true);

    assert.deepEqual(
      exportableHistory(b.root, new Set(['RULE-a'])).map((r) => r.op),
      ['create', 'update'],
    );
  } finally { b.dispose(); }
});

test('the real supersede and link writers put an id in `note`, and it is joined too', () => {
  // Driven through the writers rather than a fixture: the whole point of this
  // rule is that the note's SHAPE comes from `core/mutate.ts` and
  // `core/relations.ts`, so a fixture would only confirm what this file
  // imagined about them.
  const b = sandbox();
  try {
    const a = createItem(b.ctx, { type: 'rule', title: 'Alpha rule', body: 'A.', origin: 'human' });
    const c = createItem(b.ctx, { type: 'rule', title: 'Gamma rule', body: 'C.', origin: 'human' });
    linkItems(b.ctx, { from: a.id, to: c.id, relation: 'refines', origin: 'human' });
    supersedeItem(b.ctx, { id: a.id, by: c.id, origin: 'human' });

    const whole = exportableHistory(b.root, new Set([a.id, c.id]));
    assert.deepEqual(
      whole.filter((r) => r.op === 'link' || r.op === 'supersede').map((r) => r.note),
      [`refines ${c.id}`, `by ${c.id}`],
      'a note naming an item that travels is not the one to withhold',
    );

    const half = exportableHistory(b.root, new Set([a.id]));
    const halfText = renderHistory(half).toString('utf8');
    assert.equal(half.some((r) => r.op === 'link'), true, 'the link record itself still travels');
    assert.equal(half.some((r) => r.op === 'supersede'), true);
    assert.deepEqual(
      half.filter((r) => r.note !== undefined), [],
      'a note naming the withheld item travelled',
    );
    assert.equal(halfText.includes(c.id), false, `${c.id} was republished by a note`);
  } finally { b.dispose(); }
});
