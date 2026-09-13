/**
 * **The observation point the CLI's stdout did not have** — `plan:swallow
 * seq:5`.
 *
 * ── WHAT WAS MEASURED, BEFORE ANY OF THIS EXISTED ──────────────────────────
 *
 * `mycontext list` writes 136,063 bytes. With the reader closed after the
 * first chunk it wrote 301 and **exited 0**. There was one `console.log` in
 * the binary, and Node's global console is built with `ignoreErrors: true`, so
 * a write that failed produced no return value a caller could read, no
 * exception, no event anybody was listening for, and no mark on the exit
 * code. `mycontext doctor --json > report.json` on a full disk therefore
 * truncates the file and tells its caller the run succeeded; every downstream
 * consumer treats a partial document as a complete one and the exit code
 * agrees with them.
 *
 * This is not a `catch` that is too wide. There was NOWHERE for the failure to
 * be seen, even in principle, until this file created somewhere.
 *
 * ── THE EXIT CODE IS THE DISCLOSURE, AND THAT IS DELIBERATE ────────────────
 *
 * `INV-nothing-is-dropped-silently` wants the failure said out loud, and the
 * hard question is WHERE. stdout is the channel that just failed, so it cannot
 * carry the news. stderr can — and for a broken pipe it should not, because
 * `mycontext list | head` is a correct thing for a person to type and a line
 * of complaint after every one of them is how a disclosure teaches its readers
 * to ignore it. So the two failures are answered differently:
 *
 *   - **EPIPE** — the reader went away, usually on purpose. Exit `141`
 *     (`128 + SIGPIPE`), which is what every other program in a pipeline
 *     answers and what a shell already knows how to read. No stderr line.
 *   - **Anything else** — a full disk, an I/O error, a file that cannot be
 *     extended. Exit `74` (`EX_IOERR`) AND a stderr line naming the errno and
 *     saying the output is incomplete, because nobody typed this on purpose
 *     and nobody is watching for it.
 *
 * Both replace a success code. A caller that only ever looked at `$?` — which
 * is every script — goes from being told the run succeeded to being told it
 * did not, and that is the whole repair.
 *
 * ── WHAT THIS STILL CANNOT SEE, SAID HERE RATHER THAN LEFT TO BE FOUND ─────
 *
 * `mycontext list >&-` (fd 1 closed outright) still exits 0. Node replaces an
 * unopenable fd 1 with a stream onto the null device before any user code
 * runs, so the writes succeed against nothing and there is no error anywhere
 * in the process to observe. That is above this file, not inside it. It is
 * recorded because the alternative is a future reader concluding from a green
 * suite that the case is covered.
 *
 * ── AND WHAT THE OBSERVATION POINT ACTUALLY IS ────────────────────────────
 *
 * Measured by removal, and worth knowing before anyone "simplifies" this.
 * There are TWO observation points and they are REDUNDANT: the `error`
 * listener on the stream, and the callback on each `write`. Removing either
 * one alone left every test in `test/cli/stdout-failure.test.ts` green —
 * putting `console.log` back as the binary's writer still exited 74 on a
 * read-only stdout, because Node re-emits the failure to every listener and
 * `ignoreErrors: true` only stops `Console` from re-throwing it. Removing BOTH
 * goes red, on four tests.
 *
 * That redundancy is kept deliberately and is not an accident to be tidied
 * away: each covers a case the other reaches only by an implementation detail
 * of `node:stream`, and this is a file whose entire subject is a failure that
 * had nowhere to be seen. But the honest statement is that NEITHER is
 * individually proved by the suite, and a future reader deleting one will get
 * a green run. Delete both and you are back where `plan:swallow seq:5`
 * started.
 */
import type { Emit } from './commands/registry.ts';

/** What the run should exit with, and what stderr should say about it. */
export interface StdoutOutcome {
  exitCode: number;
  /** `''` on the clean path. Ends in a newline when it is not empty. */
  note: string;
}

/** `128 + SIGPIPE`, the code a program in a pipeline answers when its reader leaves. */
export const EXIT_BROKEN_PIPE = 141;
/** `EX_IOERR` from `sysexits.h` — an output error that is not a broken pipe. */
export const EXIT_IO_ERROR = 74;

export interface StdoutSink {
  /** The `Emit` the command tree writes through, in place of `console.log`. */
  out: Emit;
  /**
   * Flush what is queued, then answer with the exit code the process should
   * carry and the sentence stderr should carry.
   *
   * Asynchronous because a pipe's failure arrives in a write callback, not as
   * a return value: settling synchronously would answer before the failure
   * exists and reproduce the defect one layer up.
   */
  settle(commandExit: number): Promise<StdoutOutcome>;
}

/**
 * Wrap a writable stream so a failed write is remembered rather than ignored.
 *
 * The stream is a parameter so a test can hand in one that fails on demand: a
 * full disk cannot be arranged in a unit test, and a gate that can only be
 * exercised by filling a volume is a gate nobody runs.
 */
export function stdoutSink(stream: NodeJS.WriteStream | NodeJS.WritableStream = process.stdout): StdoutSink {
  let failure: NodeJS.ErrnoException | null = null;
  const remember = (err: unknown): void => {
    if (failure === null) failure = err as NodeJS.ErrnoException;
  };
  // Both channels are listened to, not one. A pipe reports through the write
  // callback AND re-emits on the stream; a synchronous refusal throws instead.
  // Listening to only the one a given platform happened to use is how this
  // would rot into a second silent failure.
  stream.on('error', remember);

  const out: Emit = (s: string): void => {
    // **There is no "stop after the first failure" guard here, and that is a
    // measured decision rather than an omission.** One was written and then
    // removed: a Node `Writable` sets `state.errored` on the first write
    // failure and fast-fails every later `write` before `_write` ever runs, so
    // the guard could not be shown to change anything — with `autoDestroy`
    // both on and off. It was an assertion that could not go red, which is the
    // shape `plan:gates seq:1` is about, so it is gone. The first failure is
    // the one `remember` keeps either way, and that is what the note reports.
    try {
      stream.write(`${s}\n`, (err) => { if (err) remember(err); });
    } catch (err) {
      remember(err);
    }
  };

  const settle = (commandExit: number): Promise<StdoutOutcome> => new Promise((resolve) => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      if (failure === null) { resolve({ exitCode: commandExit, note: '' }); return; }
      if (failure.code === 'EPIPE') {
        resolve({ exitCode: EXIT_BROKEN_PIPE, note: '' });
        return;
      }
      resolve({
        exitCode: EXIT_IO_ERROR,
        note:
          `my_context: output was CUT SHORT — the write to stdout failed (${failure.code ?? 'unknown'}: ` +
          `${failure.message}). What was produced is INCOMPLETE, so do not read it as a whole ` +
          `document: a redirected run leaves a truncated file behind. Exit code ${EXIT_IO_ERROR}.\n`,
      });
    };
    // **Already broken: answer now.** There is nothing left to flush that could
    // change the answer, and a stream that has been destroyed by a `_write`
    // that threw may never call another write callback — waiting for one hung
    // the whole test file for sixty seconds before this line existed. A
    // reporter that deadlocks is a worse silence than the one being repaired.
    if (failure !== null) { finish(); return; }
    // Three ways the question can become answerable, and the first wins: the
    // flush lands, the stream errors, or the stream closes under us.
    stream.once('error', finish);
    stream.once('close', finish);
    // An empty write whose callback runs after everything queued before it has
    // been flushed — the only point at which "did it all land?" has an answer.
    try {
      stream.write('', (err) => { if (err) remember(err); finish(); });
    } catch (err) {
      remember(err);
      finish();
    }
  });

  return { out, settle };
}
