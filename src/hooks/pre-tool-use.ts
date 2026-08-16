import path from 'node:path';
import { recordAudit, type SpilledRef } from '../core/audit.ts';
import { focusErrorNote, readFocus } from '../core/focus.ts';
import { Ledger } from '../core/ledger.ts';
import {
  canonicalizeNearestExisting, isMainEntry, managedSplit, matchesAnyGlob, relPosix, toPosix,
} from '../core/paths.ts';
import { renderSelection } from '../core/render.ts';
import { injectableTypes, select } from '../core/select.ts';
import { Store } from '../core/store.ts';
import { resolveWorkspace } from '../core/workspace.ts';
import {
  ledgerKey, parseHookInput, preToolUseContext, preToolUseDeny, readStdin, type HookInput,
} from './io.ts';

const FILE_PATH_KEYS = ['file_path', 'path', 'notebook_path'];

export function extractFilePath(input: HookInput): string | null {
  const toolInput = input.tool_input;
  if (typeof toolInput !== 'object' || toolInput === null) return null;
  for (const key of FILE_PATH_KEYS) {
    const value = (toolInput as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return null;
}

/**
 * `canonicalizeNearestExisting` behind a guard that returns the path
 * unchanged if it somehow throws.
 *
 * That function is total for string input by construction (see its comment),
 * so this catch is not expected to be reachable — it is here because the
 * alternative is an escaping throw on the one hook that must reach a verdict,
 * and because `denyReason` is called from `runPreToolUse` where a throw is
 * already caught and turned into ALLOW. Returning the input keeps the
 * decision on the raw spelling, which is exactly the check that ran before
 * canonicalization existed: a failure here can only give up the spellings
 * canonicalization added, never one the segment regex already covers.
 */
function canonicalize(absNative: string): string {
  try {
    return canonicalizeNearestExisting(absNative);
  } catch {
    return absNative;
  }
}

/**
 * The one deliberate exception to fail-open. The reason must name a usable
 * alternative: it reaches the model at the exact moment it is wrong, which is
 * the cheapest possible moment to correct it.
 *
 * That alternative is the `create_item` MCP tool, deliberately NOT the
 * `mycontext add` CLI command this used to advertise. `cmdAdd` now routes
 * through `mutate.ts`'s `createItem` too, so it is no longer a bypass of the
 * trust model — but it is still a human-facing CLI command, not something an
 * agent invokes from a hook-driven session, so it remains the wrong
 * alternative to point an agent at here regardless.
 *
 * **Raw spelling OR canonical spelling — the `??` is a union, not a
 * replacement, and swapping it for canonical-only opens a hole.** If
 * `.my_context` is itself a symlink or an NTFS junction pointing somewhere
 * outside the repo, canonicalizing `<repo>/.my_context/items/x.md` yields
 * `<target>/items/x.md`, which crosses no managed segment at all. Verified by
 * execution on this machine with a junction: the canonical path came back as
 * `…\probe3\real\items`, i.e. a canonical-only check would have ALLOWED a
 * write that the string check denies today. Checking the raw spelling first
 * also means the common deny costs no syscall, and that every spelling closed
 * before this function learned to canonicalize stays closed.
 *
 * The canonical check is a widening in the other direction too, and that is
 * intended: a symlink or junction that points INTO `.my_context` is another
 * name for the managed directory, so a write through it is a write into the
 * corpus and is now denied. Verified by execution, not assumed.
 */
export function denyReason(absNative: string): string | null {
  const split = managedSplit(toPosix(absNative)) ?? managedSplit(toPosix(canonicalize(absNative)));
  if (!split) return null;
  const { rel } = split;

  if (matchesAnyGlob(rel, ['items/**'])) {
    return 'my_context: `.my_context/items/` is managed by my_context. Writing the file ' +
      'directly leaves the SQLite index and the item checksum stale, and bypasses the ' +
      'review boundary that keeps agent-authored normative items out of injection. ' +
      'Create items with the `create_item` MCP tool, and read them with `get_item` ' +
      'or `query_items`.';
  }

  // Ahead of the `state/**` arm below, because that arm's reason — "derived
  // from the Markdown, run `mycontext rebuild`" — is FALSE of this one file.
  // The focus is authored state, not a projection of anything: no rebuild
  // regenerates it, and a message telling a reader otherwise would be this
  // project's own worst failure mode written into a hook.
  if (rel === 'state/focus.json') {
    return 'my_context: `.my_context/state/focus.json` is the session focus, and it decides ' +
      'what my_context injects. No rebuild regenerates it — editing it by hand can narrow ' +
      'every future injection with nothing recorded about who did it. Set it with ' +
      '`mycontext focus <tag>`, inspect it with `mycontext focus --show`, and remove it with ' +
      '`mycontext focus --clear`; the `focus_context` MCP tool does the same.';
  }

  if (matchesAnyGlob(rel, ['.index.db*', 'state/**'])) {
    return `my_context: \`.my_context/${rel}\` is generated state, not source. It is derived ` +
      'from the Markdown in `.my_context/items/` — run `mycontext rebuild` to ' +
      'regenerate it instead of editing it.';
  }

  return `my_context: \`.my_context/${rel}\` is managed by my_context and must not be written ` +
    'directly. Use the `create_item` MCP tool to create an item, `query_items` and ' +
    '`get_item` to read, and `mycontext rebuild` to refresh the index. Configuration ' +
    'changes to `.my_context/config.json` are the user\'s to make — ask, do not edit.';
}

/**
 * Single indexed SQLite read, no rebuild, no LLM, no network (spec §6.5).
 * Returns '' — never throws — so a corrupt index means "no items today"
 * rather than a blocked edit.
 */
export function buildJitOutput(input: HookInput, cwd: string, filePath: string): string {
  let store: Store | null = null;
  let ledger: Ledger | null = null;
  try {
    const sessionId = input.session_id;
    if (!sessionId) return '';
    // A subagent shares the parent's `session_id` but not its context window,
    // so the DEDUPE key carries `agent_id` when present — see `ledgerKey`.
    // The audit record below keeps the raw `sessionId` (the session is what
    // an audit reader looks up) and names the subagent in its note instead.
    const dedupeKey = ledgerKey(input)!;

    const ws = resolveWorkspace(cwd);
    if (!ws.projectRoot) return '';

    // projectRoot is the `.my_context` directory; scope globs are repo-relative.
    const repoRoot = path.dirname(ws.projectRoot);
    const abs = path.resolve(cwd, filePath);
    // On win32, `path.relative` returns an ABSOLUTE path (not a `..`-prefixed
    // one) when the two paths resolve to different drives/roots — e.g. repo
    // on C:, target on D: or a UNC share. Left unchecked, that absolute
    // string would flow into `matchesScope` and a `**`-scoped item would
    // match a file that is nowhere near the repo. `path.isAbsolute` on the
    // native `path.relative` result (before POSIX conversion) catches this;
    // `relPosix` itself only re-derives the same relative string.
    if (path.isAbsolute(path.relative(repoRoot, abs))) return '';
    const target = relPosix(repoRoot, abs);
    if (target === '' || target === '..' || target.startsWith('../')) return '';

    // Store MUST be opened before Ledger: Store.open's corruption self-heal
    // (delete-and-recreate on a genuinely unreadable file) is the only
    // reason a corrupt .index.db is survivable for Ledger.open, which has no
    // self-heal of its own. See the comment on Ledger.open.
    store = Store.open(ws.dbPath);
    ledger = Ledger.open(ws.dbPath);

    // The focus, on the hot path: one `readFileSync` of a few hundred bytes,
    // and an ENOENT — the answer in every workspace with no focus set — before
    // any of it. Measured p95 0.027ms with no focus and 0.046ms with one, over
    // 200 iterations on a 5,000-item corpus, against a 50ms ceiling and a JIT
    // hit path of ~10-23ms; the audit append beside it costs 0.55ms and was
    // accepted. See `test/perf/focus-latency.perf.ts`, which takes those
    // numbers rather than asserting them.
    //
    // **The candidate set below is pre-filtered to injectable types, so the
    // focus report `select` builds here counts only what a tool event could
    // have delivered.** That is why `FocusReport.universe` exists and why the
    // rendered note on this path says "that apply to this file": a JIT
    // disclosure counting the whole corpus would name items this event was
    // never going to show.
    const focusState = readFocus(ws.projectRoot);

    const selection = select(
      store.activeInjectable(injectableTypes(ws.config)),
      { event: 'tool', path: target, seen: ledger.seen(dedupeKey), focus: focusState.focus },
      ws.config,
    );
    // A focus that hid something on THIS path is itself a reason to speak, even
    // when nothing survived to inject: silence would read as "no rules apply to
    // this file", which is exactly the false impression focus must never
    // create. Same for a focus file that could not be read.
    const focusSpeaks = (selection.focus !== null && selection.focus.hidden.length > 0)
      || focusState.error !== null;
    if (selection.full.length === 0 && selection.spilled.length === 0 && !focusSpeaks) return '';

    // Render before recording: rendering reads/walks item data and can in
    // principle throw. If it did after the ledger write, the outer catch
    // would return '' while the item was already marked seen — a silent,
    // permanent drop for the rest of the session. Rendering first bounds
    // that risk to the render step itself.
    //
    // The ledger write gets its OWN try/catch, separate from the outer one:
    // it is not inside the same try as the render above, so a `recordMany`
    // failure (e.g. SQLITE_BUSY from a concurrent `rebuild` holding the WAL
    // lock past `busy_timeout`) can never fall through to the outer catch
    // and discard `text`, which has already been computed and is safe to
    // return regardless. The only failure mode this leaves reachable is a
    // duplicate injection later in the session (safe) rather than a lost one
    // (not safe) — the render succeeding is what the injection actually
    // depends on; the record is bookkeeping for future dedupe.
    const focusError = focusErrorNote(focusState.error);
    const text = renderSelection(selection) + (focusError ? `\n${focusError}\n` : '');
    // The audit record, before the ledger and independent of it: the ledger
    // lives in the disposable `.index.db`, so it is not a durable answer to
    // "what did this session see". Measured at 0.5ms p95 and flat in the size
    // of the log (see `test/perf/audit-latency.perf.ts`), against a 50ms
    // ceiling and a JIT hit path of ~11-22ms — about 1% more per tool call,
    // which is what made always-on the right choice rather than a setting.
    //
    // `recordAudit` never throws, so this needs no guard of its own and can
    // never reach the outer catch and discard an already-rendered injection.
    // Ids and tiers only — never the rendered text.
    const noteParts: string[] = [];
    if (input.agent_id) {
      noteParts.push(`subagent ${input.agent_id}${input.agent_type ? ` (${input.agent_type})` : ''}`);
    }
    if (selection.focus !== null) {
      noteParts.push(
        `focus hid ${selection.focus.hidden.length} on this path, ` +
        `${selection.focus.dangling.length} load-bearing relation(s) dangling`,
      );
    }
    recordAudit(ws.projectRoot, {
      kind: 'injection',
      op: 'jit',
      sessionId,
      hook: 'PreToolUse',
      path: target,
      injected: selection.full.map((e) => ({ id: e.item.id, tier: e.tier })),
      ...(selection.spilled.length === 0 ? {} : {
        spilled: selection.spilled.map((s): SpilledRef => ({
          id: s.id, tier: s.tier, reason: s.reason,
        })),
      }),
      // Counts, not ids — the same reason the session-start record carries
      // them: a log showing an injection of two items and nothing about the
      // five a focus removed answers "what did this session see" with a true
      // list and a false impression. A subagent's delivery is named as such:
      // without it, two deliveries of one item under one sessionId read as a
      // dedupe failure rather than as two context windows.
      ...(noteParts.length === 0 ? {} : { note: noteParts.join('; ') }),
    });
    try {
      ledger.recordMany(dedupeKey, selection.full.map((e) => e.item.id), 'jit');
    } catch {
      // A failed record must never cost the already-rendered injection.
    }
    return text;
  } catch {
    return '';
  } finally {
    try { store?.close(); } catch { /* fail open */ }
    try { ledger?.close(); } catch { /* fail open */ }
  }
}

/** Returns the JSON to print on stdout, or '' for "no opinion". */
export function runPreToolUse(raw: string, fallbackCwd: string): string {
  try {
    const input = parseHookInput(raw);
    const cwd = input.cwd ?? fallbackCwd;
    const filePath = extractFilePath(input);
    if (!filePath) return '';

    if (/Edit|Write/.test(input.tool_name ?? '')) {
      const abs = path.resolve(cwd, filePath);
      const reason = denyReason(abs);
      if (reason) {
        // The one hook action that CHANGES what a tool call does, so it is the
        // one that most needs to be in the log: an agent blocked from writing
        // into `.my_context/` that then tells the user something else happened
        // is exactly what an audit trail is for.
        //
        // Recorded against the workspace resolved from `cwd`, NOT against the
        // `.my_context` directory the path names. Those are usually the same
        // and when they differ the difference matters: the denied path is
        // attacker-controlled, and `recordAudit` creates the directory it
        // writes to, so keying off the path would let a `Write` to
        // `/anywhere/.my_context/x` create a `.audit/` tree at an arbitrary
        // location. `denied.rel` still records WHICH managed path was refused,
        // so nothing about the event is lost. No workspace at `cwd` means
        // there is nowhere legitimate to record, and the deny still stands.
        const denied = managedSplit(toPosix(abs)) ?? managedSplit(toPosix(canonicalize(abs)));
        const home = resolveWorkspace(cwd).projectRoot;
        if (home) {
          // `recordAudit` never throws; a failure here cannot cost the deny.
          recordAudit(home, {
            kind: 'hook',
            op: 'deny',
            hook: 'PreToolUse',
            ...(input.session_id === undefined ? {} : { sessionId: input.session_id }),
            ...(denied === null ? {} : { path: denied.rel }),
            note: `${input.tool_name ?? 'unknown tool'} refused`,
          });
        }
        return preToolUseDeny(reason);
      }
    }

    const text = buildJitOutput(input, cwd, filePath);
    return text ? preToolUseContext(text) : '';
  } catch {
    return '';
  }
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  // No runtime safety timer here: runPreToolUse is fully synchronous, so a
  // timer set before calling it can only ever fire after that call already
  // returned — an unref'd setTimeout cannot preempt a synchronous
  // readFileSync/JSON.parse in between. The real bound is the `hooks.json`
  // timeout (10s); the latency budget is enforced by the performance test
  // in Task 10, not by a runtime cutoff.
  try {
    const output = runPreToolUse(readStdin(), process.cwd());
    if (output) process.stdout.write(output);
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
