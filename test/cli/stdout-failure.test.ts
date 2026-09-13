// @basis TASK-the-cli-cannot-observe-a-failed-write-to-stdout-so-a, INV-nothing-is-dropped-silently
//
// **MEASURED BEFORE THE REPAIR.** `mycontext list` writes 136,063 bytes. With
// the reader closed after the first chunk it delivered 301 and exited 0; with
// fd 1 closed outright it delivered nothing and exited 0. There was one
// `console.log` in the binary and Node's global console is built with
// `ignoreErrors: true`, so there was no return value, no throw, no event and
// no mark on the exit code — nowhere for the failure to be seen at all.
//
// FOUR PROPOSITIONS, split because each can regress alone:
//
//   1. **The clean path is unchanged.** Same bytes, same exit code. A repair
//      that made every successful run exit 141 would satisfy everything below.
//   2. **A broken pipe reaches the exit code.** 141, the code a shell already
//      knows how to read, and NO stderr line — `mycontext list | head` is a
//      correct thing to type and a complaint after each one is how a
//      disclosure trains its readers to skip it.
//   3. **Any other write failure is loud.** Exit 74 (`EX_IOERR`) and a stderr
//      sentence carrying the errno and the word INCOMPLETE. This is the
//      `> report.json` case the item is named for — a full disk — and it is
//      driven through `stdoutSink` over a stream that fails on demand,
//      because a gate that can only be exercised by filling a volume is a
//      gate nobody ever runs.
//   4. **The failure is not answered before it exists.** `settle` resolves
//      after the flush. Asking synchronously would return "clean" for a pipe
//      whose error arrives in a write callback — the same defect one layer up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { Console } from 'node:console';
import { closeSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { Writable } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import { EXIT_BROKEN_PIPE, EXIT_IO_ERROR, stdoutSink } from '../../src/cli/stdout.ts';
import { removeTree } from '../helpers/tmp.ts';

const CLI = path.join(import.meta.dirname, '..', '..', 'src', 'cli', 'index.ts');

interface Run { code: number | null; bytes: number; stderr: string }

/**
 * stderr minus Node's own `ExperimentalWarning` about `node:sqlite`, which
 * every run of this binary emits and which is `plan:cliscript`'s to remove,
 * not this item's. Filtered rather than tolerated with a loose `match` so that
 * a REAL line appearing on the quiet path still reddens these tests.
 */
function ours(stderr: string): string {
  return stderr
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '' && !/ExperimentalWarning|trace-warnings/.test(l))
    .join(' | ');
}

/** Run the real binary; optionally destroy the read end after the first chunk. */
function runCli(args: string[], closeReaderEarly: boolean): Promise<Run> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let bytes = 0;
    let stderr = '';
    let closed = false;
    child.stdout.on('data', (c: Buffer) => {
      bytes += c.length;
      if (closeReaderEarly && !closed) { closed = true; child.stdout.destroy(); }
    });
    child.stdout.on('error', () => { /* destroying the reader is the point */ });
    child.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8'); });
    child.on('exit', (code) => resolve({ code, bytes, stderr }));
  });
}

/**
 * A stream that accepts `acceptBytes` and then fails every write.
 *
 * `attempts` counts every write REACHING the stream, not every write that
 * landed. The difference is load-bearing: an earlier version of this file
 * counted bytes only, so "writing stops at the first failure" was satisfied by
 * a stream that kept being written to and kept refusing — the assertion could
 * not tell the two apart and stayed green when the guard was removed.
 */
function failingAfter(acceptBytes: number, code: string): Writable & { written: number; attempts: number } {
  let written = 0;
  let attempts = 0;
  const s = new Writable({
    // `autoDestroy: false` so the stream keeps ACCEPTING writes after it has
    // refused one. Node's default destroys on a write error, which would make
    // "writing stops at the first failure" true of Node rather than of the
    // code under test — a fixture carrying the proof instead of its subject.
    autoDestroy: false,
    write(chunk: Buffer | string, _enc, cb) {
      attempts += 1;
      const n = Buffer.byteLength(chunk as Buffer);
      if (written + n > acceptBytes) {
        const err: NodeJS.ErrnoException = new Error(`${code}: simulated`);
        err.code = code;
        cb(err);
        return;
      }
      written += n;
      cb();
    },
  }) as Writable & { written: number; attempts: number };
  Object.defineProperty(s, 'written', { get: () => written });
  Object.defineProperty(s, 'attempts', { get: () => attempts });
  return s;
}

/** A stream that throws from `write` itself — what a file-backed stdout does. */
function throwsSynchronously(code: string): Writable {
  return new Writable({
    write() {
      const err: NodeJS.ErrnoException = new Error(`${code}: simulated`);
      err.code = code;
      throw err;
    },
  });
}

test('the clean path is byte-identical and still exits 0', async () => {
  const run = await runCli(['list'], false);
  assert.equal(run.code, 0, 'a successful run is untouched by any of this');
  assert.ok(run.bytes > 100_000, `the fixture must be big enough to be cut short; got ${run.bytes}`);
  assert.equal(ours(run.stderr), '', 'and says nothing of its own on stderr, so a real note is never background noise');
});

test('a reader that goes away cuts the output short and the exit code says so', async () => {
  const whole = await runCli(['list'], false);
  const cut = await runCli(['list'], true);

  // PROVE THE TRUNCATION LANDED before believing anything about the exit code:
  // a run that happened to deliver everything would make the assertion below
  // a claim about the clean path wearing a broken pipe's name.
  assert.ok(
    cut.bytes < whole.bytes,
    `the reader must actually have been cut off: whole=${whole.bytes} cut=${cut.bytes}`,
  );
  assert.equal(
    cut.code, EXIT_BROKEN_PIPE,
    'this exited 0 before the repair — a script could not tell a truncated run from a complete one',
  );
  assert.equal(
    ours(cut.stderr), '',
    'and a broken pipe stays quiet: `mycontext list | head` is correct usage, and the exit code '
    + 'is the channel a script reads anyway',
  );
});

test('a redirected run whose file cannot be written exits 74 and says so — the `> report.json` case', () => {
  // THE ITEM'S HEADLINE, END TO END and with no full disk required: stdout is
  // a real file opened READ-ONLY, so every write to fd 1 fails the way a full
  // disk fails — synchronously, on a file-backed stdout, which is the shape
  // `console.log`'s `ignoreErrors: true` drops on the floor. Before the repair
  // this run exited 0 with an empty `report.json` beside it.
  const dir = mkdtempSync(path.join(os.tmpdir(), 'myctx-stdout-'));
  try {
    const report = path.join(dir, 'report.json');
    writeFileSync(report, '');
    const fd = openSync(report, 'r');
    try {
      const run = spawnSync(process.execPath, [CLI, 'list'], { stdio: ['ignore', fd, 'pipe'] });
      // PROVE THE FIXTURE BITES: a file that received the whole document would
      // make every assertion below a claim about the clean path.
      assert.equal(readFileSync(report).length, 0, 'nothing reached the file, which is the premise');
      assert.equal(
        run.status, EXIT_IO_ERROR,
        'a script reading only $? was told this succeeded, and read a truncated document as a whole one',
      );
      assert.match(ours(String(run.stderr)), /CUT SHORT/);
      assert.match(ours(String(run.stderr)), /INCOMPLETE/);
      assert.match(ours(String(run.stderr)), /EBADF|EACCES|EPERM|ENOSPC/, 'the errno reaches the reader');
    } finally {
      closeSync(fd);
    }
  } finally {
    removeTree(dir);
  }
});

test('a write failure that is not a broken pipe exits 74 and says INCOMPLETE on stderr', async () => {
  const stream = failingAfter(40, 'ENOSPC');
  const sink = stdoutSink(stream);
  sink.out('the first line fits');
  sink.out('this one does not, and every line after it is dropped');
  sink.out('dropped too');

  const outcome = await sink.settle(0);
  assert.equal(outcome.exitCode, EXIT_IO_ERROR, 'the command said 0; the output says otherwise and wins');
  assert.match(outcome.note, /CUT SHORT/, 'the reader is told the output is not whole');
  assert.match(outcome.note, /ENOSPC/, 'and the errno reaches them — "failed" alone names no repair');
  assert.match(outcome.note, /INCOMPLETE/);
  assert.equal(
    stream.attempts, 2,
    'one line landed and one was refused; the third never reached the stream because Node '
    + 'fast-fails an errored Writable. Asserted as a fact about the fixture, NOT as a claim '
    + 'about a guard in `stdout.ts` — a guard was written there, could not be made to change '
    + 'this number with `autoDestroy` either way, and was removed for exactly that reason',
  );
});

test('a write that throws is observed too, which is the case `console.log` provably cannot see', async () => {
  // THE ITEM'S HEADLINE CASE. A redirected stdout is file-backed, and Node
  // writes to it synchronously — a full disk THROWS rather than emitting an
  // error event. `Console` with `ignoreErrors: true`, which is how the global
  // `console` this binary used to write through is constructed, catches that
  // throw and drops it: there is no return value, no event and no trace.
  const swallowed = throwsSynchronously('ENOSPC');
  const ignoring = new Console({ stdout: swallowed, ignoreErrors: true });
  let consoleThrew = false;
  try { ignoring.log('a line that cannot be written'); } catch { consoleThrew = true; }
  assert.equal(
    consoleThrew, false,
    'the premise, asserted rather than assumed: this is the writer that made the failure invisible',
  );

  const sink = stdoutSink(throwsSynchronously('ENOSPC'));
  sink.out('a line that cannot be written');
  const outcome = await sink.settle(0);
  assert.equal(outcome.exitCode, EXIT_IO_ERROR, 'and this is the writer that sees it');
  assert.match(outcome.note, /ENOSPC/);
});

test('a clean stream settles to the command exit code, whatever it was', async () => {
  const stream = failingAfter(1_000_000, 'ENOSPC');
  const sink = stdoutSink(stream);
  sink.out('a line');
  assert.deepEqual(await sink.settle(0), { exitCode: 0, note: '' });

  const second = stdoutSink(failingAfter(1_000_000, 'ENOSPC'));
  second.out('a line');
  assert.deepEqual(
    await second.settle(3), { exitCode: 3, note: '' },
    'a command that failed for its own reasons keeps its own code — the sink adds nothing',
  );
});

test('settle waits for the flush rather than answering before the failure exists', async () => {
  // A stream whose failure arrives on a later tick, which is what a pipe does.
  let settled = false;
  const late = new Writable({
    write(_chunk, _enc, cb) {
      setTimeout(() => {
        const err: NodeJS.ErrnoException = new Error('EIO: simulated');
        err.code = 'EIO';
        cb(err);
      }, 10);
    },
  });
  const sink = stdoutSink(late);
  sink.out('a line whose failure has not happened yet');
  const pending = sink.settle(0).then((o) => { settled = true; return o; });
  assert.equal(settled, false, 'it must not have answered already');
  const outcome = await pending;
  assert.equal(
    outcome.exitCode, EXIT_IO_ERROR,
    'a synchronous answer would have reported the clean path and rebuilt the defect one layer up',
  );
  assert.match(outcome.note, /EIO/);
});
