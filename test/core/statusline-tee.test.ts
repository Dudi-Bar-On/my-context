import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync,
  utimesSync, writeFileSync,
} from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeTree } from '../helpers/tmp.ts';
import {
  sanitizeSessionId, statuslineDir, teePath, writeTee, readTee, classifyContext,
  classifyRateLimits, sweepStaleTeeTemps, TEE_TMP_MAX_AGE_MS,
} from '../../src/core/statusline-tee.ts';

/**
 * A payload in the shape Claude Code actually sends (see the plan's external-facts table).
 * Shape first read on 2.1.233; re-verified 2026-08-23 on the installed build 2.1.239, where
 * the real payload carries strictly more (`session_name`, `output_style`, `fast_mode`,
 * `thinking`, …). Extra fields are deliberately NOT added here: `writeTee` stores the payload
 * WHOLE and `classifyContext` reads only `context_window`, so a fixture that mirrored every
 * field would assert a schema this repository does not own. `version` is inert — nothing under
 * test reads it — and is set to the build this fixture was last checked against.
 */
function payload(contextWindow: unknown): Record<string, unknown> {
  return {
    session_id: 'sess-abc123',
    transcript_path: '/tmp/t.jsonl',
    cwd: '/repo',
    version: '2.1.239',
    model: { id: 'claude-opus-4-5', display_name: 'Opus 4.5' },
    workspace: { current_dir: '/repo', project_dir: '/repo' },
    cost: { total_cost_usd: 0.42 },
    ...(contextWindow === undefined ? {} : { context_window: contextWindow }),
  };
}

test('sanitizeSessionId refuses rather than mangles', () => {
  assert.equal(sanitizeSessionId('sess-abc123'), 'sess-abc123');
  assert.equal(sanitizeSessionId('a'.repeat(128)), 'a'.repeat(128));
  assert.equal(sanitizeSessionId('a'.repeat(129)), null);
  assert.equal(sanitizeSessionId('../escape'), null);
  assert.equal(sanitizeSessionId('.hidden'), null);
  assert.equal(sanitizeSessionId('has space'), null);
  assert.equal(sanitizeSessionId(''), null);
});

test('writeTee stores the payload WHOLE and readTee returns it', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-tee-'));
  try {
    const p = payload({ total_input_tokens: 5, context_window_size: 10, current_usage: null });
    const result = writeTee(root, p, '2026-08-16T10:00:00.000Z');
    assert.deepEqual(result, { written: true });
    const back = readTee(root, 'sess-abc123');
    assert.equal(back?.receivedAt, '2026-08-16T10:00:00.000Z');
    assert.deepEqual(back?.payload, p); // whole — nothing shredded at write time
    // The dir is gitignored like .audit is.
    assert.equal(readFileSync(path.join(statuslineDir(root), '.gitignore'), 'utf8').trim(), '*');
  } finally { removeTree(root); }
});

test('a payload without session_id, or with an unsafe one, is refused with the reason', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-tee-'));
  try {
    const noId = writeTee(root, { cwd: '/x' });
    assert.equal(noId.written, false);
    assert.match(noId.reason!, /session_id/);
    const badId = writeTee(root, { session_id: '../../etc/passwd' });
    assert.equal(badId.written, false);
    assert.equal(existsSync(statuslineDir(root)) && existsSync(path.join(root, '..', 'etc')), false);
  } finally { removeTree(root); }
});

test('readTee: no sample is null; a half-written sample is null, not a crash', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-tee-'));
  try {
    assert.equal(readTee(root, 'sess-abc123'), null);
    assert.equal(readTee(root, '../escape'), null);
    mkdirSync(statuslineDir(root), { recursive: true });
    writeFileSync(teePath(root, 'sess-abc123')!, '{"receivedAt": "2026');
    assert.equal(readTee(root, 'sess-abc123'), null);
  } finally { removeTree(root); }
});

// --- The losing writer's temp file ------------------------------------------
//
// `writeTee` is temp-then-rename, which is correct for the writer whose rename
// lands. These tests are about the OTHER one. On Windows `renameSync` is
// `MoveFileEx`, and replacing a destination something else holds open fails
// EPERM outright rather than merely losing — so the whole previous sample
// stays on disk (the right degradation, asserted below) and the temp file the
// loser had already written is what needs to go.
//
// **How the race is made deterministic rather than hoped for.** Nothing here
// depends on two writers landing in the same microsecond. The contended
// resource — an open handle on the destination — is PINNED for the entire
// window instead, so every writer inside that window loses, every time, on
// every scheduling. The multi-process half follows the shape of
// `test/core/session-names.test.ts` · `concurrent writes from separate processes lose no entry` · ~214.

const WRITER = fileURLToPath(new URL('../fixtures/statusline-tee-writer.ts', import.meta.url));

/** Every `<session>.json.tmp-…` currently sitting in `.statusline/`. */
function strays(root: string): string[] {
  return readdirSync(statuslineDir(root)).filter((n) => n.includes('.tmp-')).sort();
}

/** One child writer, racing on `root`'s tee for `sessionId`. Never rejects. */
function race(root: string, sessionId: string, marker: string):
Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['--disable-warning=ExperimentalWarning', WRITER, root, sessionId, marker],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = ''; let err = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { out += chunk; });
    child.stderr.on('data', (chunk: string) => { err += chunk; });
    child.on('close', (code) => resolve({ code: code ?? 1, out, err }));
  });
}

/**
 * Windows only, and skipped elsewhere with the reason rather than passing
 * vacuously: POSIX `rename` is indifferent to open handles, so there is no
 * such thing there as a rename that loses to a reader. The cross-platform
 * half of the property is the test above it, which fails the rename by a
 * cause every platform has.
 */
const WINDOWS_ONLY = process.platform === 'win32'
  ? false
  : 'rename-over-an-open-destination fails only on Windows (MoveFileEx); POSIX rename ignores handles';

test('a rename that fails strands NO temp file — the loser cleans up after itself', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-tee-'));
  try {
    // A directory standing where the sample file belongs makes `renameSync`
    // fail on every platform (measured: EPERM on Windows, ENOTEMPTY on
    // POSIX). WHY the rename failed is irrelevant to the cleanup — what this
    // pins is that the failing branch is the branch taken, on any box.
    mkdirSync(statuslineDir(root), { recursive: true });
    mkdirSync(teePath(root, 'sess-abc123')!);
    const result = writeTee(root, payload(null), '2026-08-16T10:00:00.000Z');
    assert.equal(result.written, false, 'the rename should have failed — this test has no lever left');
    assert.match(result.reason ?? '', /rename/, 'the reason must still name what failed');
    assert.deepEqual(strays(root), [], 'the temp file the failed write left behind was never removed');
  } finally { removeTree(root); }
});

test('a write that fails BEFORE the rename strands no temp file either', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-tee-'));
  try {
    // `JSON.stringify` of a circular payload throws — and it throws *before*
    // the temp file is opened, so this asserts the absence of a file that was
    // never created. It is here because it is the one failure mode that must
    // NOT be "cleaned up" by inventing a path: the cleanup has to be scoped
    // to a temp file this call actually wrote.
    const circular: Record<string, unknown> = { session_id: 'sess-abc123' };
    circular.self = circular;
    const result = writeTee(root, circular, '2026-08-16T10:00:00.000Z');
    assert.equal(result.written, false);
    assert.deepEqual(strays(root), []);
    assert.equal(existsSync(teePath(root, 'sess-abc123')!), false);
  } finally { removeTree(root); }
});

test('the filed Windows loser: a reader holds the sample open, the rename loses, the temp file still goes', { skip: WINDOWS_ONLY }, () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-tee-'));
  let fd: number | null = null;
  try {
    assert.deepEqual(writeTee(root, payload(null), 'FIRST'), { written: true });
    // A reader mid-read across the rename — the UI polling the tee is exactly
    // this. Measured on this box: an ordinary read handle is enough to make
    // MoveFileEx fail.
    fd = openSync(teePath(root, 'sess-abc123')!, 'r');

    const lost = writeTee(root, payload(null), 'SECOND');
    assert.equal(
      lost.written, false,
      'an open read handle no longer blocks the rename on this platform — this test\'s lever ' +
      'has stopped working, so the losing branch is no longer being exercised at all',
    );
    assert.match(lost.reason ?? '', /EPERM|EACCES|EBUSY/);

    // The degradation this defect deliberately did NOT change: the previous
    // WHOLE sample is what a reader still sees, never a torn one, and
    // `receivedAt` is what exposes its age.
    assert.equal(readTee(root, 'sess-abc123')?.receivedAt, 'FIRST');
    assert.deepEqual(strays(root), [], 'the loser stranded its temp file in .statusline/');
  } finally {
    if (fd !== null) closeSync(fd);
    removeTree(root);
  }
});

test('six processes race one session and leave one whole sample and zero temp files', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-tee-'));
  try {
    const markers = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'];
    const results = await Promise.all(markers.map((m) => race(root, 'sess-abc123', m)));
    for (const [i, r] of results.entries()) {
      assert.equal(r.code, 0, `writer ${markers[i]} threw: ${r.err}`);
    }
    // Whoever won, the invariant is the same on every platform: one whole
    // sample, parseable, carrying one of the six markers — and nothing else.
    const back = readTee(root, 'sess-abc123');
    assert.ok(back !== null, 'the racers left no readable sample at all');
    assert.ok(markers.includes(back.receivedAt), `receivedAt is ${JSON.stringify(back.receivedAt)}`);
    assert.deepEqual(strays(root), [], 'a racer stranded its temp file');
  } finally { removeTree(root); }
});

test('every racer loses at once (Windows, sample pinned open) and not one temp file survives', { skip: WINDOWS_ONLY }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-tee-'));
  let fd: number | null = null;
  try {
    assert.deepEqual(writeTee(root, payload(null), 'FIRST'), { written: true });
    // Pinned for the WHOLE window: six separate processes, no timing luck
    // required, every one of them takes the losing branch.
    fd = openSync(teePath(root, 'sess-abc123')!, 'r');

    const markers = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'];
    const results = await Promise.all(markers.map((m) => race(root, 'sess-abc123', m)));
    const parsed = results.map((r) => JSON.parse(r.out) as { written: boolean; reason?: string });
    for (const [i, r] of results.entries()) {
      assert.equal(r.code, 0, `writer ${markers[i]} threw: ${r.err}`);
      assert.equal(parsed[i].written, false, `writer ${markers[i]} was expected to lose the rename`);
      assert.match(parsed[i].reason ?? '', /EPERM|EACCES|EBUSY/);
    }
    assert.equal(readTee(root, 'sess-abc123')?.receivedAt, 'FIRST', 'the whole previous sample must survive');
    assert.deepEqual(strays(root), [], 'six losers stranded six temp files — this is the filed defect');
  } finally {
    if (fd !== null) closeSync(fd);
    removeTree(root);
  }
});

// --- The orphans already on disk --------------------------------------------

/** Backdate a path so an age gate can be tested without ever sleeping. */
function backdate(file: string, ageMs: number): void {
  const when = new Date(Date.now() - ageMs);
  utimesSync(file, when, when);
}

test('sweepStaleTeeTemps removes aged temp files ONLY — never a live one, never a sample', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-tee-'));
  try {
    const dir = statuslineDir(root);
    mkdirSync(dir, { recursive: true });
    const put = (name: string, ageMs?: number): void => {
      const full = path.join(dir, name);
      writeFileSync(full, '{}');
      if (ageMs !== undefined) backdate(full, ageMs);
    };
    const aged = TEE_TMP_MAX_AGE_MS + 60_000;
    put('sess-abc123.json.tmp-4242', aged);        // what the build WITHOUT the counter stranded
    put('sess-abc123.json.tmp-4242-7', aged);      // what this build would strand if killed mid-write
    put('sess-abc123.json.tmp-9999');              // a LIVE writer's temp, seconds old — must survive
    put('sess-abc123.json');                       // the sample itself
    // A session id may legitimately contain `.tmp-`: `sanitizeSessionId`
    // accepts `.` and `-`, so `run.tmp-3` is a real id and `run.tmp-3.json` is
    // its real sample. A predicate matching `.tmp-` anywhere in the name —
    // which is what `pruneSnapshots` uses on `state/` — would delete it.
    put('run.tmp-3.json', aged);

    assert.equal(sweepStaleTeeTemps(root), 2);
    assert.deepEqual(readdirSync(dir).sort(), [
      'run.tmp-3.json', 'sess-abc123.json', 'sess-abc123.json.tmp-9999',
    ]);
  } finally { removeTree(root); }
});

test('sweepStaleTeeTemps never throws: no directory, and a name it cannot stat', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-tee-'));
  try {
    assert.equal(sweepStaleTeeTemps(root), 0, 'a workspace with no .statusline/ sweeps nothing');
    const dir = statuslineDir(root);
    mkdirSync(dir, { recursive: true });
    // A DIRECTORY wearing a temp file's name is not a file and is left alone
    // rather than recursively removed.
    mkdirSync(path.join(dir, 'sess-abc123.json.tmp-1'));
    backdate(path.join(dir, 'sess-abc123.json.tmp-1'), TEE_TMP_MAX_AGE_MS + 60_000);
    assert.equal(sweepStaleTeeTemps(root), 0);
    assert.equal(existsSync(path.join(dir, 'sess-abc123.json.tmp-1')), true);
  } finally { removeTree(root); }
});

test('a successful write sweeps the orphans an earlier build left, and never a live temp', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-tee-'));
  try {
    const dir = statuslineDir(root);
    mkdirSync(dir, { recursive: true });
    const orphan = path.join(dir, 'sess-other.json.tmp-4242');
    writeFileSync(orphan, '{}');
    backdate(orphan, TEE_TMP_MAX_AGE_MS + 60_000);
    const live = path.join(dir, 'sess-other.json.tmp-9999');
    writeFileSync(live, '{}');

    assert.deepEqual(writeTee(root, payload(null), '2026-08-16T10:00:00.000Z'), { written: true });
    assert.equal(existsSync(orphan), false, 'the pre-existing orphan was never swept');
    assert.equal(existsSync(live), true, 'a concurrent writer\'s live temp file was destroyed');
    assert.equal(readTee(root, 'sess-abc123')?.receivedAt, '2026-08-16T10:00:00.000Z');
  } finally { removeTree(root); }
});

test('classifyContext: no context_window at all is UNKNOWN — an older Claude Code build', () => {
  assert.deepEqual(classifyContext(payload(undefined)), {
    state: 'unknown', usedTokens: null, windowSize: null, percent: null,
  });
  assert.equal(classifyContext(payload(null)).state, 'unknown');
  assert.equal(classifyContext(payload('junk')).state, 'unknown');
});

test('classifyContext: current_usage null is NOT-YET-KNOWN — never zero (post-compact state)', () => {
  // Claude Code sends total_input_tokens: 0 in this state (verified in the
  // binary: the `e?…:0` branch). Keying on that 0 would render the state as
  // zero — the lie-toward-reassurance §4b constraint 2 names. The gate is
  // current_usage === null and nothing else.
  const sample = classifyContext(payload({
    total_input_tokens: 0, total_output_tokens: 0,
    context_window_size: 200000, current_usage: null,
    used_percentage: null, remaining_percentage: null,
  }));
  assert.equal(sample.state, 'not-yet-known');
  assert.equal(sample.usedTokens, null);
  assert.equal(sample.windowSize, 200000);
  assert.equal(sample.percent, null);
});

test('classifyContext: KNOWN computes input-only from current_usage — the §4b constraint-3 formula', () => {
  const sample = classifyContext(payload({
    total_input_tokens: 47000, total_output_tokens: 9000,
    context_window_size: 200000,
    current_usage: {
      input_tokens: 1000, cache_creation_input_tokens: 6000,
      cache_read_input_tokens: 40000, output_tokens: 9000,
    },
    used_percentage: 23.5, remaining_percentage: 76.5,
  }));
  assert.equal(sample.state, 'known');
  assert.equal(sample.usedTokens, 47000);          // 1000 + 6000 + 40000 — output NOT folded in
  assert.equal(sample.windowSize, 200000);
  assert.equal(sample.percent, 23.5);
});

test('classifyContext: a current_usage missing its fields is UNKNOWN, not a guess', () => {
  const sample = classifyContext(payload({
    context_window_size: 200000, current_usage: { input_tokens: 5 },
  }));
  assert.equal(sample.state, 'unknown');
  assert.equal(sample.usedTokens, null);
});

/* ── THE ACCOUNT'S TWO RATE-LIMIT WINDOWS ────────────────────────────────────
 *
 * EXTERNAL SCHEMA, exactly as `classifyContext` above is: `rate_limits` is
 * Claude Code's, verified against a real captured payload on this machine
 * (2026-08-31 — `five_hour` 16%, `seven_day` 50%). Nothing here fails when
 * Claude Code changes it; every unrecognised shape degrades to `null`.
 *
 * **The direction that matters is absence.** A window nobody reported is not a
 * window measured at 0%, and a surface drawing a fabricated zero would be
 * making a claim about somebody's account that nothing supports — which is the
 * mirror of the blank `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-
 * thing-is` forbids, and just as wrong.
 */
test('classifyRateLimits reads both windows out of a real payload shape', () => {
  const at = 1788209400;
  const got = classifyRateLimits({
    context_window: null,
    rate_limits: {
      five_hour: { used_percentage: 16, resets_at: at },
      seven_day: { used_percentage: 50, resets_at: at + 144600 },
    },
  });
  assert.deepEqual(got, {
    fiveHour: { usedPercent: 16, resetsAt: at },
    sevenDay: { usedPercent: 50, resetsAt: at + 144600 },
  });
});

test('every shape that is not a reported percentage answers null, never zero', () => {
  const none = { fiveHour: null, sevenDay: null };
  assert.deepEqual(classifyRateLimits(undefined), none, 'no payload at all');
  assert.deepEqual(classifyRateLimits({}), none, 'a payload with no rate_limits — it is optional');
  assert.deepEqual(classifyRateLimits({ rate_limits: null }), none);
  assert.deepEqual(classifyRateLimits({ rate_limits: 'nope' }), none);
  assert.deepEqual(classifyRateLimits({ rate_limits: { five_hour: null } }), none,
    'one window present and null is still two absent windows');
  assert.deepEqual(
    classifyRateLimits({ rate_limits: { five_hour: { used_percentage: '16', resets_at: 1 } } }),
    none,
    'a percentage sent as a STRING is a shape this code does not read — and 16 is not what it '
    + 'means, because inventing a number from an unrecognised shape is how an external schema '
    + 'change becomes a wrong figure instead of a missing one',
  );
});

test('a window with no reset time keeps its percentage and loses only the countdown', () => {
  assert.deepEqual(
    classifyRateLimits({ rate_limits: { seven_day: { used_percentage: 49 } } }),
    { fiveHour: null, sevenDay: { usedPercent: 49, resetsAt: null } },
    'the figure is still worth drawing; the countdown is what cannot be guessed',
  );
});

test('one window reported and the other not is exactly that, and not two of either', () => {
  assert.deepEqual(
    classifyRateLimits({ rate_limits: { seven_day: { used_percentage: 50, resets_at: 5 } } }),
    { fiveHour: null, sevenDay: { usedPercent: 50, resetsAt: 5 } },
  );
});
