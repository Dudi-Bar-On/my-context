/**
 * `healTornTail` truncated on a bound it measured before the scan, with no
 * lock — `plan:swallow seq:12`; and `isTorn` answered "not torn" for a file it
 * could not look at — `plan:swallow seq:11`, minor m5.
 *
 * THE ITEM SAID THE RACE WAS INFERRED AND NEVER PRODUCED, and that the first
 * step of the work was a concurrent-append harness. It produces. Measured
 * 2026-09-15 against the code as it stood, six processes appending 150 records
 * each to one torn log:
 *
 *   torn tail of 1 byte      → 32 of 900 complete records destroyed
 *   torn tail of 256 KB      →  6 of 900
 *   torn tail of 8 MB        → 94 of 900
 *
 * **The one-byte figure is the one that matters**, and it is recorded here
 * rather than asserted every run: it says the loss is not an artefact of a
 * fixture built to make the backwards scan slow, which is the shape a proof of
 * a race is most easily fooled by. What the tests below run on is a larger
 * tail, for a reason that is about the CONTROL rather than about the subject —
 * see `TORN_TAIL`.
 *
 * THE MECHANISM. A reads size S, scans backwards, finds the last newline at L.
 * B heals the same tear, truncates to L, and appends complete records. A then
 * truncates to L — now BEHIND B's records — and they are gone.
 *
 * WHAT IS ASSERTED, and what deliberately is not: that every record a racer
 * appended is still in the file. NOT a time, not a rate, not a number of
 * attempts. The harness is a storm on purpose; the assertion is about bytes.
 *
 * ── THE CONTROL, MADE DETERMINISTIC (2026-09-22) ────────────────────────────
 *
 * CI's Ubuntu job (run 35715432299) ran the control below over three rounds
 * and lost nothing: a small `appendFileSync` does not observably tear on that
 * platform inside the window six spawned processes could afford there, so the
 * storm never landed two healers on the same torn file at once — the control
 * went green for the wrong reason, a harness that stopped racing rather than a
 * lock that stopped mattering. THE MECHANISM does not need luck: it is stated
 * above ("A reads size S ... B heals the same tear ... A then truncates to L
 * — now BEHIND B's records"), and that is two healers each reading the same
 * stale cut before either writes — an ORDER, not a coincidence of timing. The
 * control now forces that order directly instead of hoping a scheduler
 * supplies it, and still asserts the one thing this file has always asserted:
 * a complete record, once written, does not disappear — with and without the
 * lock, so the difference IS the proof.
 *
 * @basis INV-nothing-is-dropped-silently,
 *   TASK-four-tests-are-red-on-ubuntu-and-green-on-windows-and-each
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  appendFileSync, closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, truncateSync,
  writeFileSync, writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { appendJsonlLine, healTornTail } from '../../src/core/jsonl-log.ts';
import { acquireLock } from '../../src/core/lock.ts';
import { removeTree } from '../helpers/tmp.ts';

const RACERS = 6;
const EACH = 150;
const SEEDED = 20;

/**
 * **One fixture for the subject and for its control, and it is sized for the
 * CONTROL.**
 *
 * The race reproduces at a one-byte tail (see the header) but not on every run
 * — at that size the unlocked window is a few syscalls wide, and under a full
 * suite the six racers are descheduled apart often enough that a round can
 * pass without a collision. That makes the RED control flaky, and a control
 * that sometimes cannot see a red is worth nothing: it is the only thing
 * standing between "the fix works" and "the harness stopped racing".
 *
 * A megabyte of torn tail widens the unlocked scan to a 64 KB-chunked read of
 * the whole tail, which no scheduler hides. The green test runs on the SAME
 * seed, so what it asserts is an absence at a fixture the control has just
 * shown is capable of producing the loss.
 */
const TORN_TAIL = 1024 * 1024;

const HERE = import.meta.dirname;
const RACER = path.join(HERE, '..', 'fixtures', 'jsonl-append-racer.ts');
const FORCE_STAT = path.join(HERE, '..', 'fixtures', 'force-stat-failure.ts');

/** A log of complete records with one unfinished byte after the last newline. */
function seedTorn(dir: string): string {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'log.jsonl');
  const complete = Array.from({ length: SEEDED }, (_, i) => JSON.stringify({ seeded: i })).join('\n');
  writeFileSync(file, `${complete}\n${'x'.repeat(TORN_TAIL)}`, 'utf8');
  return file;
}

/** Runs the storm against `racer` and reports which records did not survive. */
async function race(racer: string, dir: string, file: string): Promise<{
  seeded: number; missing: string[]; appended: number;
}> {
  const barrier = path.join(dir, 'GO');
  const kids = Array.from({ length: RACERS }, (_, k) => spawn(
    process.execPath,
    [racer, dir, file, `r${k}`, String(EACH), barrier],
    { stdio: ['ignore', 'ignore', 'ignore'] },
  ));
  // Every racer is already spinning on the barrier; this is what lets them go
  // together rather than in the order they were spawned.
  const open = setTimeout(() => writeFileSync(barrier, 'go'), 300);
  try {
    await Promise.all(kids.map((c) => new Promise((done) => c.on('exit', done))));
  } finally {
    clearTimeout(open);
  }

  const want = new Set<string>();
  for (let k = 0; k < RACERS; k++) for (let i = 0; i < EACH; i++) want.add(`r${k}:${i}`);
  let seeded = 0;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    if (raw.trim() === '') continue;
    let row: { seeded?: number; tag?: string; i?: number };
    try { row = JSON.parse(raw) as typeof row; } catch { continue; }
    if (row.seeded !== undefined) { seeded++; continue; }
    if (row.tag !== undefined) want.delete(`${row.tag}:${row.i}`);
  }
  return { seeded, missing: [...want].sort(), appended: RACERS * EACH - want.size };
}

test('six writers healing one torn log lose no complete record', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'heal-race-'));
  try {
    const file = seedTorn(dir);
    const out = await race(RACER, dir, file);

    // **The preconditions, asserted rather than assumed.** A green here is
    // worthless if the racers never ran or the seed was not torn, and both are
    // exactly the ways this proof could quietly stop carrying its own weight.
    assert.ok(out.appended > 0, 'the racers appended something — otherwise there is nothing to lose');
    assert.equal(out.seeded, SEEDED, 'the records already complete before the storm survived it');

    assert.deepEqual(
      out.missing, [],
      `${out.missing.length} of ${RACERS * EACH} complete records were truncated away`,
    );
  } finally {
    removeTree(dir);
  }
});

/** How much garbage a torn tail carries in the deterministic control below. Its
 * size carries none of `TORN_TAIL`'s reasoning above — that size is chosen so
 * a real scheduler cannot hide the race; this harness never asks a scheduler
 * for anything, so a few bytes prove the same point.
 */
const DET_TAIL = 24;

/**
 * A torn log built from two `writeSync` calls with a yield between them,
 * rather than one `writeFileSync` — the shape a writer actually killed
 * mid-append leaves, not merely a file that happens to lack a trailing
 * newline. What lands on disk is identical either way; this is about fidelity
 * to the failure this file is named for, not about the bytes.
 */
async function seedTornInterleaved(dir: string): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'log.jsonl');
  const complete = Array.from({ length: SEEDED }, (_, i) => JSON.stringify({ seeded: i })).join('\n');
  const fd = openSync(file, 'w');
  try {
    writeSync(fd, `${complete}\n`); // the records a killed writer left complete
    await new Promise((resolve) => { setImmediate(resolve); }); // the interrupt
    writeSync(fd, 'x'.repeat(DET_TAIL)); // the write that never got its closing '\n'
  } finally {
    closeSync(fd);
  }
  return file;
}

/**
 * The offset just past the file's last newline — the same one-sentence
 * contract `cutAfterLastNewline` (`src/core/jsonl-log.ts`) implements, read
 * back with `String.lastIndexOf` because this fixture is a handful of lines.
 * `cutAfterLastNewline`'s own chunked backward scan has its coverage below,
 * in "a heal says what it removed"; what THIS test needs is the CONTRACT, not
 * a reproduction of the scan.
 */
function cutPoint(file: string): number {
  return readFileSync(file, 'utf8').lastIndexOf('\n') + 1;
}

function healAndAppendRecord(file: string, cut: number, tag: string): void {
  truncateSync(file, cut);
  appendFileSync(file, `${JSON.stringify({ tag, i: 0 })}\n`, 'utf8');
}

function tagsIn(file: string): string[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => (JSON.parse(l) as { tag?: string }).tag)
    .filter((t): t is string => t !== undefined);
}

/**
 * **The detector, made deterministic.** The test above asserts an ABSENCE
 * under a storm; this one proves the storm's mechanism CAN destroy a record,
 * so that absence is a fact about the lock and not about a harness that
 * stopped racing. It no longer races real processes to get there — see the
 * module header for why that stopped being reliable on Ubuntu's Node/scheduler
 * — because the mechanism itself does not need luck to reproduce: the module
 * header's own doc comment on `cutAfterLastNewline` names it as two healers
 * each reading the SAME stale cut before either one writes. That is an ORDER
 * of operations, and this harness forces that order by calling the two
 * healers' steps itself rather than hoping two processes land in it together.
 *
 * `acquireLock` is the real, unmodified lock this project has exactly one
 * implementation of (`src/core/lock.ts`) — the same one `healTornTail` takes
 * — so "with the lock" here is not a stand-in, it is the primitive itself
 * serializing the two healers' critical sections.
 */
test('two healers racing on one torn log lose a record without the lock, '
  + 'and do not lose one with it', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'heal-race-det-'));
  try {
    // ---- WITHOUT the lock: both healers read the file's cut BEFORE either
    // one writes — the exact interleave the doc comment above names. Healer A
    // truncates-and-appends first; healer B then truncates to ITS stale cut,
    // which is now BEHIND A's just-written record, and takes it with it.
    const unlocked = await seedTornInterleaved(path.join(dir, 'unlocked'));
    const cutA = cutPoint(unlocked);
    const cutB = cutPoint(unlocked); // B's read, taken before A has written anything
    healAndAppendRecord(unlocked, cutA, 'a');
    healAndAppendRecord(unlocked, cutB, 'b');
    const unlockedTags = tagsIn(unlocked);
    assert.ok(
      !unlockedTags.includes('a'),
      `record "a" survived the unlocked interleave, so this harness does not reproduce the loss `
      + `the lock exists to prevent; tags on disk: ${unlockedTags.join(', ')}`,
    );
    assert.ok(unlockedTags.includes('b'), '"b" itself must still be there — the loss is A, not the file');

    // ---- WITH the lock: each healer's read-then-write is one critical
    // section, so B's read happens only after A has released — behind A's
    // write, not before it, the way the unlocked run above forced instead.
    const locked = await seedTornInterleaved(path.join(dir, 'locked'));
    const lockSpec = {
      file: `${locked}.heal.lock`, name: 'jsonl-heal',
      otherHolder: 'another actor in this test is healing the same log',
    };
    const releaseA = acquireLock(lockSpec);
    healAndAppendRecord(locked, cutPoint(locked), 'a');
    releaseA();
    const releaseB = acquireLock(lockSpec);
    healAndAppendRecord(locked, cutPoint(locked), 'b'); // reads the ALREADY-healed file: cuts nothing away
    releaseB();
    const lockedTags = tagsIn(locked);
    assert.deepEqual(
      lockedTags, ['a', 'b'],
      `both records must survive under the lock; got: ${lockedTags.join(', ')}`,
    );
  } finally {
    removeTree(dir);
  }
});

test('a heal says what it removed, and a log it looked at and found whole says so', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'heal-outcome-'));
  try {
    const file = path.join(dir, 'log.jsonl');
    writeFileSync(file, '{"a":1}\n{"b":2', 'utf8');
    assert.deepEqual(healTornTail(file), { healed: true, droppedBytes: 6 });
    assert.equal(readFileSync(file, 'utf8'), '{"a":1}\n');

    // A MEASURED nothing: it looked, and there was nothing to heal. Distinct
    // from the answer below, which is what the old code gave for both.
    assert.deepEqual(healTornTail(file), { healed: false, why: 'intact' });
    assert.deepEqual(healTornTail(path.join(dir, 'never-written.jsonl')), { healed: false, why: 'empty' });
  } finally {
    removeTree(dir);
  }
});

/**
 * **A platform limit, stated rather than faked.** `icacls /deny` does not bite
 * for this account; a directory in place of the log makes `statSync` SUCCEED
 * with size 0; a file used as a directory component answers `ENOENT` on
 * Windows, not `ENOTDIR`. There is no arrangement of the real filesystem that
 * reaches this branch here, so it is reached through
 * `test/fixtures/force-stat-failure.ts` — one patched call, in its own
 * process, the same device `test/fixtures/force-linksync-failure.ts` uses for
 * a `linkSync` this platform will not fail either.
 */
test('a log that could not be looked at is not reported as whole, and nothing is appended past it', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'heal-unreadable-'));
  try {
    const file = path.join(dir, 'log.jsonl');
    writeFileSync(file, '{"a":1}\n{"b":2', 'utf8');
    const out = spawnSync(process.execPath, [FORCE_STAT, file, 'EACCES', dir], { encoding: 'utf8' });
    assert.equal(out.status, 0, out.stderr);
    const [healLine, appendLine] = out.stdout.trim().split('\n');
    const heal = JSON.parse(healLine!) as { healed: boolean; why?: string; error?: string };

    assert.equal(heal.healed, false);
    assert.equal(heal.why, 'unreadable', 'not "intact" and not "empty" — nothing looked at the last byte');
    assert.match(String(heal.error), /EACCES/u, 'and the reason is carried, not just the refusal');

    // The append refuses rather than writing a record past a fragment it could
    // not reach: `readJsonlLog` would refuse that line, and every later one,
    // for good. `recordAudit`'s existing catch turns this into
    // `written: false` with the reason, which `auditFailureNote` already puts
    // in front of a person.
    const appended = JSON.parse(appendLine!) as { appended?: boolean; refused?: string };
    assert.equal(appended.appended, undefined, 'the record was NOT written past the fragment');
    assert.match(String(appended.refused), /could not be healed/u);

    // Untouched: the refusal cost the record, never the file.
    assert.equal(readFileSync(file, 'utf8'), '{"a":1}\n{"b":2');
  } finally {
    removeTree(dir);
  }
});

test('an ordinary append still heals and lands, so the refusal above is not the general case', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'heal-ordinary-'));
  try {
    const file = path.join(dir, 'log.jsonl');
    writeFileSync(file, '{"a":1}\n{"b":2', 'utf8');
    assert.deepEqual(appendJsonlLine(dir, file, { c: 3 }), { healed: true, droppedBytes: 6 });
    assert.equal(readFileSync(file, 'utf8'), '{"a":1}\n{"c":3}\n');
  } finally {
    removeTree(dir);
  }
});
