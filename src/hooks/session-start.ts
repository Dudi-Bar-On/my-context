import { buildInjection } from '../core/inject.ts';
import { isMainEntry } from '../core/paths.ts';
import { parseHookInput, readStdin } from './io.ts';

export interface SessionStartOptions {
  /** startup | clear | resume | compact */
  source?: string;
  sessionId?: string;
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
    const input = parseHookInput(readStdin());
    const text = buildSessionStartOutput(input.cwd ?? process.cwd(), {
      source: input.source,
      sessionId: input.session_id,
    });
    if (text) process.stdout.write(text);
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
