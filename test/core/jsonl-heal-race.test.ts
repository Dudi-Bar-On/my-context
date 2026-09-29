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
 * **AND IT DOES THIS THROUGH THE REAL FUNCTIONS, not a copy of them.** The
 * first version of this fix regex-spliced a COPY of `jsonl-log.ts` with the
 * lock block cut out and raced that copy in child processes — a copy that
 * cannot notice when the ORIGINAL stops calling `acquireLock`. `HealSeams`
 * (`src/core/jsonl-log.ts`) is the seam that replaces it: an injectable
 * acquirer and an observation point, both defaulting to production
 * behaviour, in the shape `execute.ts`'s `CommandRunner` already uses for the
 * same problem. Every test below calls the real, exported
 * `healTornTail`/`appendJsonlLine`.
 *
 * @basis INV-nothing-is-dropped-silently,
 *   TASK-four-tests-are-red-on-ubuntu-and-green-on-windows-and-each
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeFileSync, writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { appendJsonlLine, healTornTail, type HealSeams } from '../../src/core/jsonl-log.ts';
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

function tagsIn(file: string): string[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => (JSON.parse(l) as { tag?: string }).tag)
    .filter((t): t is string => t !== undefined);
}

/** A no-op acquirer: "acquired" instantly, excludes nobody, releases as no-op. */
const noLock: NonNullable<HealSeams['acquireLock']> = () => () => {};

/**
 * **The detector, made deterministic AND made to run the real code.** The
 * test above asserts an ABSENCE under a storm, so its failure mode is a
 * harness that quietly stopped racing — measured on CI's Ubuntu job (run
 * 35715432299): three rounds, real processes, real `appendJsonlLine`, zero
 * losses, because a small `appendFileSync` did not observably tear inside the
 * window six spawned processes could afford there. This proves the SAME
 * mechanism can destroy a record without needing that luck, and it does so by
 * calling `healTornTail`/`appendJsonlLine` themselves — the functions this
 * file exists to protect — through the seam those functions now take
 * (`HealSeams`, `src/core/jsonl-log.ts`), not a copy of them.
 *
 * The prior shape here regex-spliced a COPY of the module with the lock block
 * cut out and raced that copy in child processes: a copy cannot notice when
 * the ORIGINAL stops calling `acquireLock`, so a regression that silently
 * dropped the `acquireLock(...)` call from `healTornTail` would have left
 * every test in this file green. Both arms below run the real,
 * `src/core/jsonl-log.ts`-exported `appendJsonlLine`.
 */
test('two healers racing on one torn log, through the real appendJsonlLine, '
  + 'lose a record without the lock', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'heal-race-det-'));
  try {
    const unlockedDir = path.join(dir, 'unlocked');
    const unlocked = await seedTornInterleaved(unlockedDir);
    // Healer A's own call to `healTornTail` finds the tear, computes its cut,
    // and — at `beforeTruncate`, the exact window between that read and its
    // truncate (`cutAfterLastNewline`'s own doc comment: "A reads size S ...
    // B heals the same tear ... A then truncates to L") — healer B runs a
    // COMPLETE, real, nested `appendJsonlLine` call of its own: reads the
    // SAME still-torn file, heals it, and appends its record. Control then
    // returns to A, which truncates to ITS OWN (now stale) cut — taking B's
    // just-appended record with it — and appends its own.
    appendJsonlLine(unlockedDir, unlocked, { tag: 'a', i: 0 }, {
      acquireLock: noLock,
      beforeTruncate: () => {
        appendJsonlLine(unlockedDir, unlocked, { tag: 'b', i: 0 }, { acquireLock: noLock });
      },
    });
    const tags = tagsIn(unlocked);
    assert.ok(
      !tags.includes('b'),
      `record "b" survived the unlocked interleave, so this harness does not reproduce the loss `
      + `the lock exists to prevent; tags on disk: ${tags.join(', ') || '(none)'}`,
    );
    assert.ok(tags.includes('a'), '"a" itself must still be there — the loss is B, not the whole file');
  } finally {
    removeTree(dir);
  }
});

/**
 * **The regression this file could not previously catch.** Nothing above
 * proves `healTornTail` still TAKES the lock by default — a version that
 * silently stopped calling `acquireLock` would pass every other test here,
 * because every other test either supplies its own acquirer or never tears a
 * file at all. This one does neither: it calls `appendJsonlLine` with NO
 * seam overrides — the real default path every production caller takes — and
 * observes, from `beforeTruncate`, that the real lock FILE actually exists on
 * disk at the one moment it is supposed to: after `acquireLock` succeeded and
 * before the truncate it was taken to guard. That is a direct, immediate
 * check of the wiring, not an inference from timing.
 *
 * **Removal proof (recorded here, not left in the code):** with the internal
 * `acquire(...)` call in `healTornTail` (`src/core/jsonl-log.ts`) temporarily
 * replaced by a stub that returns `() => {}` without creating a lock file,
 * this test goes red — `sawLockFile` reads `false` and the first assertion
 * below fails. Restored immediately after. See the task report for the
 * captured output.
 */
test('healTornTail actually takes the real lock by default, and releases it '
  + 'after', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'heal-race-lock-'));
  try {
    const lockedDir = path.join(dir, 'locked');
    const locked = seedTorn(lockedDir);
    const lockFile = `${locked}.heal.lock`;
    let sawLockFile: boolean | null = null;
    appendJsonlLine(lockedDir, locked, { tag: 'a', i: 0 }, {
      beforeTruncate: () => { sawLockFile = existsSync(lockFile); },
    });
    assert.equal(
      sawLockFile, true,
      'the real lock file was not present during the critical section — healTornTail is not '
      + 'really taking the lock it claims to by default',
    );
    assert.equal(existsSync(lockFile), false, 'the lock must be released again once the heal ends');
    assert.deepEqual(tagsIn(locked), ['a']);

    // An ordinary second append, still under the real default lock, lands
    // cleanly on the now-healed file — the "no loss, with the lock" half.
    appendJsonlLine(lockedDir, locked, { tag: 'b', i: 0 });
    assert.deepEqual(tagsIn(locked), ['a', 'b']);
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
