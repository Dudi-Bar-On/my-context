import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { readAudit } from '../../src/core/audit.ts';
import { snapshotPath } from '../../src/core/ledger.ts';
import { appendSeen } from '../../src/core/seen-file.ts';
import { writeTee } from '../../src/core/statusline-tee.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { recordPostCompact } from '../../src/hooks/post-compact.ts';
import { buildRestoreSnapshot } from '../../src/hooks/pre-compact.ts';
import type { HookInput } from '../../src/hooks/io.ts';
import { removeTree } from '../helpers/tmp.ts';

// --- What this file pins, and why it exists ---------------------------------
//
// Spec §4.4. The owner asked for a handover at 98% occupancy; the standing
// concern is that Claude Code's own auto-compaction fires BELOW 98 on current
// builds, which would make 98 a threshold nothing ever reaches. This file does
// not argue the number — it pins the MEASUREMENT that settles it: every
// `pre-compact` row says what fired the compaction (`auto` vs `manual`) and how
// full the window was when it did. After a handful of automatic compactions the
// corpus holds the real number and nobody has to guess.
//
// The assertions therefore care about three things and nothing else: the
// trigger travels verbatim, an unmeasured occupancy is `null` and never `0`,
// and nothing the hook already did changed.

/**
 * Every sandbox this file makes, removed once at the end.
 *
 * `test/core/context-occupancy.test.ts`'s pattern rather than
 * `pre-compact.test.ts`'s per-test `removeTree`: the roots here are built
 * INSIDE `preCompactRow`, so a per-test cleanup would need every test to hold
 * a path it never created.
 */
const roots: string[] = [];
after(() => { for (const root of roots) removeTree(root); });

/** A `context_window` block in the shape Claude Code actually sends. */
function sampleAt(percent: number, window = 200_000): Record<string, unknown> {
  return {
    context_window: {
      context_window_size: window,
      current_usage: {
        input_tokens: (window * percent) / 100,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        // On the wire, and deliberately non-zero: it must NOT reach the total.
        output_tokens: 1_234,
      },
    },
  };
}

interface RowOptions {
  /** Omitted from the payload entirely when absent — the `<absent>` case. */
  trigger?: string;
  /** The occupancy the status-line bridge has recorded for this session. */
  percent?: number;
  /** `false` installs no `.statusline/` at all — the `no-bridge` case. */
  bridge?: boolean;
  /** Writes the sample for a DIFFERENT session — the `no-sample` case. */
  otherSessionOnly?: boolean;
  /** Ids to put in the seen file, so the row has real snapshot work to report. */
  seen?: string[];
  /** Squat on the snapshot path so the write fails and the failure row is written. */
  breakSnapshot?: boolean;
}

interface Row {
  /** Verbatim as recorded — `'auto'`, `'manual'` or `'<absent>'`. */
  trigger: string;
  /** The percentage recorded, or `null` for an occupancy that was not measured. */
  occupancyPercent: number | null;
  note: string;
  itemIds: string[] | null;
}

/**
 * Reads the two values back out of the recorded row.
 *
 * They are read as FIELDS. They were parsed out of `note` when this file was
 * written, because `AuditRecord` declared neither, and every assertion below was
 * deliberately written against the VALUE rather than the string so that the day
 * they became real fields only this one function would change. That day was the
 * same day: `trigger` and `occupancyPercent` landed on `AuditRecord` once the
 * `execution` kind's work freed that file, and this is the function that moved.
 *
 * A MISSING field is `undefined` and must not be read as "not measured" —
 * `occupancyPercent: null` is the hook saying it looked and could not, which is
 * a different fact. The sentinels below keep the two apart so that a hook which
 * silently stopped recording cannot pass these tests.
 */
function readRow(record: { trigger?: string; occupancyPercent?: number | null }): {
  trigger: string;
  occupancyPercent: number | null;
} {
  return {
    trigger: record.trigger ?? '<no trigger recorded>',
    occupancyPercent: record.occupancyPercent === undefined
      ? Number.NaN
      : record.occupancyPercent,
  };
}

/** Runs `PreCompact` in a fresh workspace and returns the row it recorded. */
function preCompactRow(options: RowOptions): Row {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-precompact-occ-'));
  roots.push(cwd);
  runCli(['init'], cwd, () => {});
  const ws = resolveWorkspace(cwd);
  const root = ws.projectRoot!;

  for (const id of options.seen ?? []) {
    appendSeen(root, 's1', [{ id, tier: 'jit', at: 'T0' }]);
  }

  // Written through `writeTee`, the real writer, so the file name and the
  // `{ receivedAt, payload }` envelope stay `statusline-tee.ts`'s to decide.
  if (options.bridge !== false && options.percent !== undefined) {
    const session = options.otherSessionOnly === true ? 'some-other-session' : 's1';
    const result = writeTee(root, { session_id: session, ...sampleAt(options.percent) });
    assert.deepEqual(result, { written: true }, 'the status-line fixture was not written');
  }

  // A directory squatting on the snapshot's own path makes the rename fail on
  // every platform — the permanent form of the transient NTFS EPERM
  // `pre-compact.test.ts` already exercises.
  if (options.breakSnapshot === true) {
    mkdirSync(snapshotPath(root, 's1'), { recursive: true });
  }

  const payload: HookInput = { session_id: 's1', hook_event_name: 'PreCompact', cwd };
  if (options.trigger !== undefined) payload.trigger = options.trigger;

  let result: { path: string; itemIds: string[] } | null;
  const realWrite = process.stderr.write;
  // The snapshot-failure path writes one line to stderr by design; swallowing
  // it keeps the test output readable without touching the disclosure itself,
  // which `pre-compact.test.ts` already asserts on.
  process.stderr.write = (() => true) as typeof process.stderr.write;
  try {
    result = buildRestoreSnapshot(payload, cwd);
  } finally {
    process.stderr.write = realWrite;
  }

  const record = readAudit(root)
    .filter((r) => r.op === 'pre-compact' && r.sessionId === 's1').at(-1);
  assert.ok(record, 'PreCompact recorded no audit row at all');
  const note = record.note ?? '';
  return { ...readRow(record), note, itemIds: result?.itemIds ?? null };
}

test('the pre-compact row carries the trigger, verbatim, and absent stays absent', () => {
  assert.equal(preCompactRow({ trigger: 'auto' }).trigger, 'auto');
  assert.equal(preCompactRow({ trigger: 'manual' }).trigger, 'manual');
  assert.equal(preCompactRow({}).trigger, '<absent>');
});

/**
 * One spelling for "we were not told", across both halves of the pair. A second
 * spelling is a second thing for a reader of the log to learn, and these two
 * rows are read together precisely because `pre-compact` and `post-compact`
 * open and close one compaction.
 */
test('the absent spelling is the one post-compact already uses, not a second one', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-precompact-occ-'));
  roots.push(cwd);
  runCli(['init'], cwd, () => {});
  const fromPostCompact = recordPostCompact({ session_id: 's1', cwd }, cwd);
  assert.ok(fromPostCompact, 'PostCompact recorded nothing to compare against');
  assert.equal(preCompactRow({}).trigger, fromPostCompact.trigger);
});

test('the row carries the occupancy when it is measurable', () => {
  const row = preCompactRow({ trigger: 'auto', percent: 92.7 });
  assert.notEqual(row.occupancyPercent, null);
  assert.equal(Math.round(row.occupancyPercent! * 10), 927);
});

/**
 * `STD-absent-vs-zero`, on the field where the wrong reading is the plausible
 * one: `0` here says "the window was empty when the platform compacted", which
 * is the opposite of "nobody measured" and would poison the very number §4.4
 * exists to establish. Two unmeasurable reasons are checked because each takes
 * a different path out of `readOccupancy`.
 */
test('an unmeasurable occupancy is null, never zero and never a guess', () => {
  const noBridge = preCompactRow({ trigger: 'auto', bridge: false });
  assert.equal(noBridge.occupancyPercent, null);

  const noSample = preCompactRow({ trigger: 'auto', percent: 50, otherSessionOnly: true });
  assert.equal(noSample.occupancyPercent, null);

  for (const row of [noBridge, noSample]) {
    // The FIELD is `null` — asserted above — and the note says which of the
    // three reasons it was. Not merely absent: a reader who finds neither the
    // field nor a reason cannot tell this row from one written before the value
    // existed, which is the failure `STD-absent-vs-zero` names.
    assert.match(row.note, /occupancy unmeasurable \((no-bridge|no-sample|unknown-shape)\)/u);
    assert.doesNotMatch(row.note, /occupancy 0/u);
  }
});

/**
 * The percentage is rounded for the human reading the log; the two integers
 * beside it are what it was computed from, so nothing is lost and anyone can
 * recompute it at any precision. A row carrying only a rounded number would be
 * a measurement this project could not re-derive.
 */
test('the exact token counts travel beside the rounded percentage', () => {
  const row = preCompactRow({ trigger: 'auto', percent: 92.7 });
  assert.match(row.note, /185400/u);
  assert.match(row.note, /200000/u);
});

/** Each unmeasurable reason is named, because the three have three fixes. */
test('an unmeasurable occupancy says WHICH reason, not just that there is one', () => {
  assert.match(preCompactRow({ trigger: 'auto', bridge: false }).note, /no-bridge/u);
  assert.match(
    preCompactRow({ trigger: 'auto', percent: 50, otherSessionOnly: true }).note, /no-sample/u);
});

/**
 * The measurement is the whole point of this task, and a lost snapshot is
 * exactly the compaction whose occupancy someone will want to know afterwards.
 * The failure row is a `pre-compact` row too, so it carries the pair as well.
 */
test('a snapshot that could not be written still records what the compaction fired at', () => {
  const row = preCompactRow({
    trigger: 'auto', percent: 92.7, seen: ['CONST-a'], breakSnapshot: true,
  });
  assert.equal(row.itemIds, null);
  assert.match(row.note, /SNAPSHOT WRITE FAILED/u);
  assert.equal(row.trigger, 'auto');
  assert.equal(Math.round(row.occupancyPercent! * 10), 927);
});

/**
 * The hook runs at the worst possible moment for a bug, and everything it did
 * before this task is load-bearing. Reading two values must not have cost the
 * snapshot, its ids, or a single word of what the row already said.
 */
test('nothing the hook already recorded or wrote changed', () => {
  const row = preCompactRow({ trigger: 'auto', percent: 92.7, seen: ['CONST-a'] });
  assert.deepEqual(row.itemIds, ['CONST-a']);
  assert.match(row.note, /1 from the seen file/u);
  assert.match(row.note, /0 cited in the transcript/u);
  assert.match(row.note, /1 captured/u);
});
