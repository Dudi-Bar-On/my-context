import { stampCodeIdentity } from '../core/code-identity.ts';
import { isMainEntry } from '../core/paths.ts';
import { createSession, serveStdio } from './protocol.ts';
import { createRegistry } from './tools.ts';

/**
 * Where to look for `.my_context`. Claude Code is expected to set
 * CLAUDE_PROJECT_DIR for plugin processes, but that has not been confirmed
 * for the MCP server specifically (only a live `claude --plugin-dir` session
 * could confirm it, and none has been run against this server yet).
 * process.cwd() is the fallback either way — used when the server is
 * launched by hand, which is also how the tests drive it.
 */
export function resolveServerCwd(env: NodeJS.ProcessEnv, fallback: string): string {
  const configured = env.CLAUDE_PROJECT_DIR;
  return configured && configured !== '' ? configured : fallback;
}

// isMainEntry, not a bare `import.meta.filename === process.argv[1]`: the CLI
// and the SessionStart hook already learned (Plan 1) that a plain `===` silently
// no-ops under `npm link` on Windows, where the installed command is a symlink.
// Every entry point in this project uses the same guard for that reason.
if (isMainEntry(import.meta.filename, process.argv[1])) {
  const cwd = resolveServerCwd(process.env, process.cwd());
  /**
   * **What code this process is about to freeze** (`core/code-identity.ts`).
   *
   * This server loads its modules once, here, and answers from that copy for
   * the life of the session. On 2026-08-27 the copy went an hour behind disk
   * and reported `checksum mismatch` for 719 of 736 healthy items; nothing said
   * which process had produced the reading, or how old its code was. Stamped at
   * this moment rather than at module load so `startedAt` is a time the reader
   * can line up against the line their terminal printed.
   *
   * **The scope is DERIVED, and only `entry` is stated.** `import.meta.filename`
   * is this file naming ITSELF, so no path to the server is spelled anywhere;
   * `moduleGraph` walks the relative imports out of it transitively, which is
   * sound because `CONST-node-24-no-build-step` means every relative specifier
   * is a literal string in the source with an explicit extension and there is
   * no bundler, alias or loader hook in between. Everything this server can
   * answer a request from is reachable from here by import, and nothing else
   * is — so a lane editing the CLI's status line does not make this server
   * claim to be stale, which is the false positive that narrowed the UI's scope
   * to the same derivation. There is no `assets` half: this server serves no
   * files.
   */
  const code = stampCodeIdentity({ entry: import.meta.filename });
  // Any throw here must not print to stdout — stderr only, per the stdio
  // transport rules. A dead server is recoverable; a corrupt stream is not.
  try {
    serveStdio(process.stdin, process.stdout, createSession(createRegistry(cwd, code)));
    process.stdin.resume();
  } catch (err) {
    process.stderr.write(
      `my_context: MCP server failed to start: ` +
      `${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exitCode = 1;
  }
}
