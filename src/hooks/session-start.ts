import { buildInjection } from '../core/inject.ts';
import { isMainEntry } from '../core/paths.ts';
import { hookParseErrorLine, parseHookInput, readStdin } from './io.ts';

export interface SessionStartOptions {
  /** startup | clear | resume | compact */
  source?: string;
  sessionId?: string;
  /**
   * `parseHookInput`'s reason when the payload could not be read. Passed
   * straight through to `buildInjection`, which renders it into the injected
   * block — see `hookParseErrorNote`. SessionStart is the only hook that
   * carries this, because it is the only one whose output the model reads.
   */
  parseError?: string | null;
}

/**
 * Build the text injected at SessionStart. Never throws — a knowledge base
 * that breaks a session is worse than one that says nothing — and a locked
 * index returns a one-line disclosure rather than '' (see `buildInjection`).
 *
 * The work lives in `core/inject.ts`, shared verbatim with the `load_context`
 * MCP tool (`/LoadMyContext`) — see the note on `InjectionEvent`. This hook is
 * the only caller that has a real `session_id` to record against.
 */
export function buildSessionStartOutput(
  cwd: string, options: SessionStartOptions = {},
): string {
  return buildInjection(cwd, {
    event: 'session-start',
    source: options.source,
    sessionId: options.sessionId,
    parseError: options.parseError,
  });
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  // No runtime safety timer here: buildSessionStartOutput is fully
  // synchronous, so a timer set before calling it can only ever fire during
  // the stdout drain that follows — where its sole reachable effect would be
  // truncating already-computed, already-safe injected context. The 500ms
  // session-start latency budget (see
  // test/perf/session-start-latency.perf.ts) is enforced by that
  // performance test, not by a runtime cutoff.
  try {
    // Disclosed on BOTH channels, because they reach different readers: the
    // stderr line is for the user watching the session (Claude Code surfaces
    // it), the in-block note is for the model, which reads the injection and
    // would otherwise take a complete-looking block at face value. Neither
    // can block anything — this hook writes text and exits 0 either way.
    const { input, parseError } = parseHookInput(readStdin());
    if (parseError !== null) process.stderr.write(hookParseErrorLine(parseError));
    const text = buildSessionStartOutput(input.cwd ?? process.cwd(), {
      source: input.source,
      sessionId: input.session_id,
      parseError,
    });
    if (text) process.stdout.write(text);
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
