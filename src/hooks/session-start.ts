import path from 'node:path';
import { handoverBlock, readHandover } from '../core/handover.ts';
import { buildInjection } from '../core/inject.ts';
import { pruneSnapshots } from '../core/ledger.ts';
import { isMainEntry } from '../core/paths.ts';
import { SEEN_FILE_SUFFIX } from '../core/seen-file.ts';
import { findProjectRoot, hasGlobalCorpus, resolveWorkspace } from '../core/workspace.ts';
import { hookParseErrorLine, noWorkspaceLine, parseHookInput, readStdin } from './io.ts';

export interface SessionStartOptions {
  /** startup | clear | resume | compact | fork */
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

/**
 * The four `SessionStart` sources that arrive with an EMPTY context window.
 *
 * **`resume` is the one that is missing, and that is the whole of the rule.**
 * It is the only source that KEEPS the window it already had: a resumed session
 * still holds everything it was told, so handing it the handover again spends
 * the window the handover exists to protect, on text it already has. Every
 * other source — a fresh `startup`, a `/clear`, a `compact`, a `fork` — begins
 * with nothing, and "what the last session left for this one" is exactly what
 * nothing is missing.
 *
 * A Set of the four rather than `source !== 'resume'`, because the two differ on
 * a source this list has never heard of: an unknown or absent `source` gets
 * nothing here, which is the safe direction (the corpus block still arrives) and
 * the honest one — the platform added `fork` to this vocabulary once already
 * (see `HookInput.source`), and a mechanism that silently opts a brand-new
 * source in is claiming to know what that source means.
 */
const HANDOVER_SOURCES = new Set(['startup', 'clear', 'compact', 'fork']);

/**
 * The handover text to append to the injection, and `''` when there is none.
 *
 * **The three outcomes land on three different places, and the differences are
 * the point.** `read` goes to the caller, which appends it to stdout — the one
 * hook stream Claude Code puts into the model's context verbatim. `missing`
 * goes to stderr, which reaches the USER and never the model: a configured
 * handover that is not there is a broken agreement, and the silence is the
 * defect the whole feature exists to answer (`noWorkspaceLine` is the precedent
 * and the tone). `off` goes nowhere at all, because nothing was promised.
 *
 * **RAW TEXT, never an envelope.** `hooks/io.ts` deliberately excludes
 * `SessionStart` from `HookEventName`, so there is no envelope to build here;
 * wrapping this stream would deliver the JSON itself into the window instead of
 * the handover inside it.
 *
 * `resolveWorkspace` rather than the `findProjectRoot` above, because the
 * `handover` key lives in the config and only `resolveWorkspace` reads one — and
 * it is inside its own `try` because it THROWS on a `config.json` that is not
 * valid JSON. That must never cost the injection that is already built and
 * about to be written: a broken config is a reason to deliver no handover, not
 * a reason to deliver nothing (`INV-hooks-fail-open`).
 */
function handoverAppendix(cwd: string, source: string | undefined): string {
  if (!HANDOVER_SOURCES.has(source ?? '')) return '';
  try {
    const ws = resolveWorkspace(cwd);
    // No workspace, no config, so no handover could have been configured and
    // none can be missing. A session outside a corpus stays exactly as silent
    // as it is today.
    if (ws.projectRoot === null) return '';
    // `path.dirname`, and it is NOT cosmetic: `Workspace.projectRoot` is the
    // `.my_context` DIRECTORY, while `handover.path` is documented and validated
    // as repo-relative. Passing `projectRoot` straight through resolves
    // `reports/H.md` inside `.my_context/`, where a real handover never is — so
    // every configured handover in the world would report itself missing, and
    // the disclosure would be indistinguishable from a genuinely broken
    // agreement. `path.dirname(ws.projectRoot)` is the spelling five other call
    // sites already use for the repository root.
    const read = readHandover(path.dirname(ws.projectRoot), ws.config.handover);
    if (read.state === 'missing') {
      // The line is built by `handoverBlock` rather than written out here, so
      // that the missing case cannot be forgotten at the one call site that
      // would otherwise have to remember it — `core/handover.ts` says so where
      // it renders it.
      process.stderr.write(handoverBlock(read));
      return '';
    }
    return read.state === 'read' ? handoverBlock(read) : '';
  } catch {
    /* Never a reason to fail — or to shorten — a session start. */
    return '';
  }
}

/**
 * The SECOND prune trigger for `state/`, after `mycontext rebuild`'s.
 *
 * `state/` gains a file per session — and, with SubagentStart, one per
 * subagent, including the ones that touch no file tool — while `rebuild` was
 * its only sweeper: a project whose corpus is stable never rebuilds, so it
 * never prunes. The survey measured 15 files one day and 47 the next.
 *
 * **Why here, after the write to stdout.** The model already has its text, so
 * the sweep cannot delay the injection it follows; it is once per session
 * rather than once per tool call; and it is best-effort in a `try`/`catch`
 * that cannot change the exit code (`INV-hooks-fail-open` — a prune that
 * cannot run is not a reason to fail a session start). `pruneSnapshots` never
 * throws either, so the `catch` here only covers the path resolution.
 *
 * `findProjectRoot` rather than `resolveWorkspace`, deliberately: the latter
 * throws on a config.json that is not valid JSON, and a workspace whose config
 * is broken is still a workspace whose `state/` should be swept.
 *
 * **What this does not fix, stated rather than glossed:** a project whose
 * sessions never start still never prunes, and the retention is still 30 days
 * by mtime (`SNAPSHOT_MAX_AGE_MS`).
 */
function sweepStaleState(cwd: string): void {
  try {
    const root = findProjectRoot(cwd);
    if (root === null) return;
    let seenPruned = 0;
    const pruned = pruneSnapshots(root, undefined, (name) => {
      if (name.endsWith(SEEN_FILE_SUFFIX)) seenPruned++;
    });
    // Disclosed on stderr, and NOT in the injected block: the items a pruned
    // seen file affects are ones that will simply arrive again, and a note in
    // every session about routine housekeeping is how a reader learns to skim
    // the block. But it is disclosed — `INV-nothing-is-dropped-silently` —
    // because this is the one moment the consequence can be stated: at the next
    // injection a pruned seen file is indistinguishable from a fresh session.
    // A pruned snapshot or `.tmp-` leftover carries no such consequence, so the
    // line appears only when dedupe state went, and names both counts.
    if (seenPruned > 0) {
      process.stderr.write(
        `my_context: pruned ${pruned} stale file(s) from state/, ` +
        `${seenPruned} of them session dedupe file(s) — if one of those idle sessions ` +
        'resumes it will re-receive items it already saw (duplicates, never a miss)\n',
      );
    }
  } catch {
    /* Best-effort housekeeping. Never a reason to fail a session start. */
  }
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
    const cwd = input.cwd ?? process.cwd();
    // **A workspace that does not resolve is DISCLOSED, never silent**, and
    // this is the whole of the 2026-08-26 fix on this side.
    // `buildSessionStartOutput` returns '' both when there is NO CORPUS and
    // when there is one with nothing to say, and from outside those two were
    // indistinguishable for the entire life of this hook. See
    // `noWorkspaceLine` for the nine days that cost.
    //
    // **It does not weaken `INV-hooks-fail-open`, which names this exact case**
    // ("This holds for a missing workspace"). Stdout is still empty, the exit
    // code is still 0, and nothing is blocked — the invariant is about not
    // breaking the session, not about saying nothing while the product's one
    // promise quietly stops being kept.
    //
    // **NEITHER root, not merely no project root.** A global corpus with no
    // project beside it is a working setup that injects, and warning on it
    // would be crying wolf — which is how a real warning stops being read. The
    // first draft of this line checked only `findProjectRoot`, and the global
    // test beside it caught that within the hour.
    if (findProjectRoot(cwd) === null && !hasGlobalCorpus()) {
      process.stderr.write(noWorkspaceLine(cwd));
    }
    const corpus = buildSessionStartOutput(cwd, {
      source: input.source,
      sessionId: input.session_id,
      parseError,
    });
    // AFTER the corpus block, and appended here rather than inside
    // `buildInjection`: the corpus is what governs the project and comes first,
    // the handover is what one session left another. It is appended at the HOOK
    // rather than in `core/inject.ts` because `buildInjection` is shared
    // verbatim with the `load_context` MCP tool and SubagentStart — neither of
    // which is crossing a compaction boundary, and neither of which should
    // start delivering a handover because this hook needed one.
    const handover = handoverAppendix(cwd, input.source);
    const text = handover === '' ? corpus : `${corpus}${corpus === '' ? '' : '\n'}${handover}`;
    if (text) process.stdout.write(text);
    sweepStaleState(cwd);
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
