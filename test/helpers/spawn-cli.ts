/**
 * **The CLI run as a PROCESS, so an exit code is read where a script reads it.**
 *
 * Every other CLI test in this repository calls `runCli` and reads the number
 * it returns, which is right for almost everything: it is the command's own
 * answer, taken directly, with no channel in between to lie about it.
 *
 * It is not enough for the one family of claims that is ABOUT the exit code.
 * `runCli`'s return value is assigned to `process.exitCode` by the entry
 * block in `src/cli/index.ts`, and that assignment has already been wrong
 * twice in this project's history — once when a repair moved it inside a
 * `.then` and overwrote `ui --nonce`'s own 1 with a 0, and once when a stdout
 * flush failure could only RAISE it afterwards. A test that reads the
 * function's return value cannot see either. So `CONST-the-cli-exit-code-
 * contract` is checked against `spawnSync(...).status` — the number the
 * operating system hands the caller.
 *
 * **`status`, never a shell.** A pipeline reports the exit of its LAST stage:
 * a Playwright run in this repository once reported 845 passed / 127 failed
 * with exit 1 while the shell printed 0, because the status travelled through
 * a pipe. Nothing here runs through a shell — `spawnSync` is handed the
 * executable and an argv array, `shell` is left off, and `status` is the
 * child's own code.
 *
 * `status` is `null` when the child was killed by a signal rather than
 * exiting; it is returned as it is rather than coerced to a number, so a
 * killed run fails an equality assertion instead of passing one.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

/** The CLI entry module, executed directly — there is no build step. */
export const CLI_ENTRY = path.resolve(import.meta.dirname, '../../src/cli/index.ts');

export interface SpawnedRun {
  /** The child's own exit code, or `null` when a signal ended it. */
  status: number | null;
  stdout: string;
  stderr: string;
  /** Bytes on stdout — the unit the `show --json` measurement is stated in. */
  bytes: number;
}

/**
 * Run `mycontext <argv>` in `cwd` as a real child process.
 *
 * `env` is merged over the parent's, so a caller that has to steer the process
 * (`MYCONTEXT_RULES_DIR`) can, and a caller that does not passes nothing and
 * inherits what the suite already set up.
 */
export function spawnCli(
  argv: string[], cwd: string, env: Record<string, string> = {},
): SpawnedRun {
  const run = spawnSync(process.execPath, [CLI_ENTRY, ...argv], {
    cwd, encoding: 'utf8', env: { ...process.env, ...env },
  });
  const stdout = run.stdout ?? '';
  return {
    status: run.status,
    stdout,
    stderr: run.stderr ?? '',
    bytes: Buffer.byteLength(stdout, 'utf8'),
  };
}
