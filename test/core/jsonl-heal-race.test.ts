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
 * @basis INV-nothing-is-dropped-silently
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { appendJsonlLine, healTornTail } from '../../src/core/jsonl-log.ts';
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

/** How many rounds the control may take to see one loss before giving up. */
const CONTROL_ROUNDS = 3;

const HERE = import.meta.dirname;
const RACER = path.join(HERE, '..', 'fixtures', 'jsonl-append-racer.ts');
const FORCE_STAT = path.join(HERE, '..', 'fixtures', 'force-stat-failure.ts');
const REAL_MODULE = path.join(HERE, '..', '..', 'src', 'core', 'jsonl-log.ts');

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

/**
 * **The detector, proved able to see a red in the same run.** The test above
 * asserts an ABSENCE under a storm, so its failure mode is a harness that
 * quietly stopped racing. This runs the same harness against a copy of the
 * module with the lock — and only the lock — removed, and requires it to lose
 * records. Two greens would mean the harness, not the fix, is what is measured.
 */
test('the same harness, with the heal lock removed, does lose records', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'heal-race-red-'));
  try {
    const source = readFileSync(REAL_MODULE, 'utf8');
    const broken = source.replace(
      /  let release: \(\) => void;[\s\S]*?\n  \} finally \{\n    release\(\);\n  \}\n/u,
      '  return healUnderLock(file);\n',
    );
    assert.notEqual(broken, source, 'the removal LANDED — the lock block was found and cut');
    assert.ok(!/acquireLock\(\{/u.test(broken), 'and nothing still takes the lock');

    // The module has exactly one relative import, so the copy is ONE file
    // rather than a shadow of `src/` — and the racer beside it imports it by a
    // relative name, because an absolute Windows path is not a legal ESM
    // specifier.
    const shadow = path.join(dir, 'jsonl-log-nolock.ts');
    const lockHref = pathToFileURL(path.join(HERE, '..', '..', 'src', 'core', 'lock.ts')).href;
    writeFileSync(shadow, broken.replace("'./lock.ts'", JSON.stringify(lockHref)), 'utf8');

    const racer = path.join(dir, 'racer-nolock.ts');
    writeFileSync(racer, readFileSync(RACER, 'utf8').replace(
      "'../../src/core/jsonl-log.ts'", "'./jsonl-log-nolock.ts'",
    ), 'utf8');

    // Bounded ROUNDS, not a bounded wait: a race is a race, and one round that
    // happens not to collide is not evidence that none can. Nothing here reads
    // a clock.
    let lost = 0;
    let ran = 0;
    for (let round = 0; round < CONTROL_ROUNDS && lost === 0; round++) {
      const file = seedTorn(path.join(dir, `round-${round}`));
      // eslint-disable-next-line no-await-in-loop -- rounds are sequential by design
      const out = await race(racer, path.join(dir, `round-${round}`), file);
      ran += out.appended;
      lost += out.missing.length;
    }
    assert.ok(ran > 0, 'the unlocked racers ran at all');
    assert.ok(
      lost > 0,
      `with the lock removed the harness must lose complete records; over ${CONTROL_ROUNDS} `
      + 'round(s) it lost none, so the test above is not what proves the fix',
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
