import { isMainEntry } from '../core/paths.ts';
import { createSession, serveStdio } from './protocol.ts';
import { createRegistry } from './tools.ts';

/**
 * Where to look for `.my_context`. Claude Code sets CLAUDE_PROJECT_DIR for
 * plugin processes; process.cwd() is the fallback when the server is launched
 * by hand, which is also how the tests drive it.
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
  // Any throw here must not print to stdout — stderr only, per the stdio
  // transport rules. A dead server is recoverable; a corrupt stream is not.
  try {
    serveStdio(process.stdin, process.stdout, createSession(createRegistry(cwd)));
    process.stdin.resume();
  } catch (err) {
    process.stderr.write(
      `my_context: MCP server failed to start: ` +
      `${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exitCode = 1;
  }
}
