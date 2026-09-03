import path from 'node:path';
import { recordAudit, type SpilledRef } from '../core/audit.ts';
import { focusErrorNote, readFocus } from '../core/focus.ts';
import {
  canonicalizeNearestExisting, isMainEntry, managedSplit, matchesAnyGlob, relPosix, toPosix,
} from '../core/paths.ts';
import {
  activeInjectableFromItems, FALLBACK_NOTE, loadCorpusItems,
} from '../core/markdown-fallback.ts';
import { loadErrorNote, type LoadError } from '../core/rebuild.ts';
import { renderSelection } from '../core/render.ts';
import { appendSeen, readSeen, seenIds } from '../core/seen-file.ts';
import { injectableTypes, select } from '../core/select.ts';
import { Store } from '../core/store.ts';
import type { Item } from '../core/types.ts';
import { resolveWorkspace } from '../core/workspace.ts';
import {
  hookParseErrorLine, ledgerKey, parseHookInput, preToolUseContext, preToolUseDeny, readStdin,
  type HookInput,
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

// ---------------------------------------------------------------------------
// WHY THERE IS NO BASH ARM HERE, AND WHAT WAS LEARNED BUILDING THE ONE THAT
// WAS REMOVED.
//
// On 2026-09-03 this file grew a fifth arm: `Bash` was added to the
// `PreToolUse` matcher in `hooks.json` and the hook analyzed the command TEXT,
// refusing redirections, file-writing commands, in-place edits and scripted
// writes whose target spelled out a managed path. It was removed the same day.
// The owner ruled against the instrument, not against the goal, in his words:
//
//   "bash in general should allow writes, you should look for a way to make
//    the agent not to abuse it and bypass the app mechanisms that are always
//    the first preferred way of doing things relating the app itself"
//
// So the shell is NOT fenced off. The product's own commands remain the way
// the corpus changes, and going around them is to be made VISIBLE — by
// `mycontext doctor`, by the checksum, by the audit log — rather than
// refused at the shell. `KNOWN-the-config-deny-hook-covers-edit-and-write-not-
// bash` is therefore true again and stays true by design, not by oversight.
//
// **THE MEASUREMENT THAT MOTIVATED THE ATTEMPT IS STILL VALID.** 27 task items
// in this corpus carry `state: done` with a `create` audit record and no
// `state` mutation ever recorded. They were written straight into the Markdown
// through the shell. The gap is real; only the remedy was wrong.
//
// **WHAT A SHELL-LEVEL DETECTOR CANNOT SEE.** This is the evidence for why
// blocking was the wrong instrument, and it should not have to be
// rediscovered. A `Bash` payload carries a STRING, not a path. There is no
// shell here to ask, and a shell command is not a decidable object. Every item
// below was established by construction or by execution while the arm existed:
//
//  - **A path from a variable or a substitution.** `D=.my_context; echo x >
//    $D/items/y.md` performs no expansion in a hook, so the managed segment
//    never appears in the text that is scanned. Same for `$(…)` and backticks.
//  - **A spelling that shares no characters with the directory name.** The
//    file-edit arms canonicalize (`canonicalizeNearestExisting`) and so they
//    see through 8.3 short names, junctions and symlinks. A command-text
//    pre-filter is a literal string test: `MY_CON~1/items/task/TASK-x.md` was
//    verified ALLOWED by the arm that existed, and no amount of tightening
//    fixes that without resolving every path-ish run in every command, which
//    is a filesystem syscall per token on the hot path of every Bash call.
//  - **A write performed by a program whose source is not in the command.**
//    `./tool.sh`, `make`, `npm run x`, `python script.py` — the command names
//    the program, and the write lives in a file the hook never opens.
//  - **Subcommand-shaped writes.** `git checkout -- .my_context/items/x.md`,
//    `git restore`, `git apply`, `git stash pop`, `tar -x`, `unzip -d` all
//    write managed paths without any of the write constructs a text scan
//    recognizes. Judging them by subcommand is guesswork, and the arm
//    deliberately left them out rather than present guesswork as knowledge.
//  - **Reconstruction and deliberate evasion.** base64, `printf`, character
//    arithmetic. An agent that can run a shell can write any file the user
//    can. That is not a bug in the detector; it is the boundary of the class.
//
// The consequence, stated plainly because a future reader will be tempted
// again: a Bash text check can catch the honest and the careless case, and can
// never catch the determined one. A guard that cannot be complete but reads as
// complete is worse than no guard — it turns "refused" into false proof that
// the directory is sealed, and it costs legitimate shell work in exchange.
// Visibility after the fact (an audit record, a failing checksum, a doctor
// finding) has neither property: it is complete over outcomes rather than over
// syntax, and it never blocks anything.
//
// Two ancillary findings from the removed arm are worth keeping, since both
// were bugs found by measurement rather than by reading:
//  - A POSIX tokenizer drops `\` before an ordinary character, which turns
//    `C:\repo\.my_context\items\x.md` into `C:repo.my_contextitemsx.md` and
//    names no managed segment at all. Any future Windows-path text analysis in
//    this codebase must keep that backslash.
//  - A combined in-place-flag pattern `/^--?(?:in-?place|[a-hj-z]*i)/` matches
//    `--silent`, because the short-flag branch finds an `i` inside a long
//    flag's name. `sed --silent -e p <item>` is a READ. Long flags must be
//    matched whole; only a short bundle may be scanned for a letter.
// ---------------------------------------------------------------------------

/**
 * Single indexed SQLite read, no rebuild, no LLM, no network (spec §6.5).
 * Returns '' — never throws — so a corrupt index means "no items today"
 * rather than a blocked edit.
 */
export function buildJitOutput(input: HookInput, cwd: string, filePath: string): string {
  let store: Store | null = null;
  try {
    const sessionId = input.session_id;
    if (!sessionId) return '';
    // A subagent shares the parent's `session_id` but not its context window,
    // so the DEDUPE key carries `agent_id` when present — see `ledgerKey`.
    // The audit record below keeps the raw `sessionId` (the session is what
    // an audit reader looks up) and names the subagent in its note instead.
    const dedupeKey = ledgerKey(input)!;

    // **THE WORKSPACE IS THE FILE'S, NOT THE SESSION'S `cwd`.**
    //
    // This resolved from `cwd` from 2026-08-13, when this tier was written,
    // until 2026-08-26, when the cost was finally measured: a session started
    // in a home directory spent NINE DAYS editing a governed repository on
    // another drive and received the corpus exactly never. `findProjectRoot`
    // walks UP from what it is given; from a home directory it reaches the
    // filesystem root and returns null, and the guard below returned ''.
    //
    // Nothing said so. Exit 0, empty output, and no audit record — because with
    // no workspace there is nowhere to write one. The failure was
    // indistinguishable from success at every observable point, which is how it
    // survived nine days and was found by the owner asking a question rather
    // than by any check in this repository.
    //
    // **`cwd` was never the right authority for this tier.** Its promise is
    // "you are about to touch THIS FILE; here is what governs it", and what
    // governs a file is the workspace the FILE lives in. `cwd` answers a
    // different question — what governs the directory the terminal happened to
    // be in — and the two coincide only by convention, which is exactly the
    // kind of assumption this project has been bitten by before.
    //
    // Resolving from the file makes the whole class SELF-HEALING rather than
    // merely visible: wherever the session was started, touching a governed
    // file delivers that file's rules. It is also strictly narrower, not wider
    // — a file in no workspace still injects nothing, which
    // `pre-tool-use-jit.test.ts` pins so this cannot become a licence to guess.
    const abs = path.resolve(cwd, filePath);
    const ws = resolveWorkspace(path.dirname(abs));
    if (!ws.projectRoot) return '';

    // projectRoot is the `.my_context` directory; scope globs are repo-relative.
    const repoRoot = path.dirname(ws.projectRoot);
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

    // Read-only, no busy_timeout, no DDL: 0 failures in 18,300 contended
    // trials, worst case 17.2 ms [P6/P6b], vs 16,881 ms for the writable
    // open under a held lock [P4]. The Ledger is gone from this path
    // entirely: session dedupe state lives in the per-session seen file, so
    // this hook has no reason left to write SQLite (an unreadable seen file
    // means "inject WITHOUT dedupe and disclose" — a re-injection, never a
    // miss; readSeen never throws). Every way this open can fail — absent
    // file, stale schema, corruption — fails FAST (≤ ms [P2e, review I2]),
    // and the catch is the Markdown fallback: the corpus IS the atomically-
    // published snapshot (writeItem's exclusive-create + rename), so a
    // failed read serves from the truth instead
    // (INV-markdown-is-the-source-of-truth as a runtime property).
    let candidates: Item[];
    let fallbackReason: string | null = null;
    // An item file the fallback could not parse is a dropped item — a MISS
    // vector relative to the DB path, which still serves the row it indexed
    // while the file was healthy. The errors are collected and disclosed
    // (inline below, where the model reads mid-task, and in the audit
    // note), never discarded (review I-3, INV-nothing-is-dropped-silently).
    const fallbackErrors: LoadError[] = [];
    try {
      store = Store.openReadOnlyChecked(ws.dbPath);
      candidates = store.activeInjectable(injectableTypes(ws.config));
    } catch (err) {
      fallbackReason = err instanceof Error ? err.message : String(err);
      candidates = activeInjectableFromItems(loadCorpusItems(ws, fallbackErrors), ws.config);
    }
    // The connection (when the open succeeded) is closed by the function's
    // own finally, exactly as before the fallback existed.
    const seenState = readSeen(ws.projectRoot, dedupeKey);

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
      candidates,
      { event: 'tool', path: target,
        seen: seenState.error === null ? seenIds(seenState) : [],
        focus: focusState.focus },
      ws.config,
    );
    // A focus that hid something on THIS path is itself a reason to speak, even
    // when nothing survived to inject: silence would read as "no rules apply to
    // this file", which is exactly the false impression focus must never
    // create. Same for a focus file that could not be read.
    const focusSpeaks = (selection.focus !== null && selection.focus.hidden.length > 0)
      || focusState.error !== null;
    // A dropped item file is ALSO a reason to speak, even with nothing
    // selected: the dropped file could be exactly the item that applied
    // here, and silence would read as "no rules apply to this file" — the
    // false impression an empty CLEAN fallback selection genuinely earns
    // but a degraded one does not.
    if (selection.full.length === 0 && selection.spilled.length === 0 && !focusSpeaks
      && fallbackErrors.length === 0) return '';

    // Render before recording: rendering reads/walks item data and can in
    // principle throw. If it did after the seen-file append, the outer catch
    // would return '' while the item was already marked seen — a silent,
    // permanent drop for the rest of the session. Rendering first bounds
    // that risk to the render step itself. The append (below, after the
    // audit record) never throws, so it can never fall through to the outer
    // catch and discard `text` either — the render succeeding is what the
    // injection actually depends on; the record is bookkeeping for future
    // dedupe, and its worst failure is a duplicate later in the session
    // (safe), never a lost injection (not safe).
    const focusError = focusErrorNote(focusState.error);
    // The inline half of the fallback disclosure rides with the injection
    // itself — the model reads the injected block mid-task, not the audit.
    const text = renderSelection(selection)
      + (focusError ? `\n${focusError}\n` : '')
      + (fallbackReason !== null ? `\n${FALLBACK_NOTE}\n` : '')
      // The dropped-file disclosure, in the block the model reads — the
      // same line buildInjection uses, shared via loadErrorNote ('' when
      // nothing was dropped).
      + loadErrorNote(fallbackErrors);
    // The audit record, before the seen-file append and independent of it:
    // the audit trail is the durable answer to "what did this session see";
    // the seen file is only the dedupe state derived beside it. Measured at
    // 0.5ms p95 and flat in the size
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
    if (seenState.error !== null) {
      noteParts.push('seen file unreadable; injected without dedupe');
    }
    if (fallbackReason !== null) {
      noteParts.push(`served from markdown fallback: ${fallbackReason}`);
    }
    if (fallbackErrors.length > 0) {
      noteParts.push(
        `${fallbackErrors.length} item file(s) dropped by the fallback ` +
        `(first: ${fallbackErrors[0].file})`,
      );
    }
    recordAudit(ws.projectRoot, {
      kind: 'injection',
      op: 'jit',
      sessionId,
      hook: 'PreToolUse',
      path: target,
      injected: selection.full.map((e) => ({ id: e.item.id, tier: e.tier })),
      // `Selection.tokens`, verbatim — the estimate the budget was spent
      // against, computed at selection time; see the field's doc in audit.ts.
      tokens: selection.tokens,
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
    // The dedupe record: an append to the per-session seen file — 0.55 ms
    // measured for the identical machinery (audit-latency.perf.ts) — never
    // SQLite. appendSeen never throws; a failed append is one future
    // re-injection, the accepted direction, and the audit record above
    // already holds the delivery durably.
    appendSeen(ws.projectRoot, dedupeKey, selection.full.map((e) => ({
      id: e.item.id, tier: 'jit' as const, at: new Date().toISOString(),
    })));
    return text;
  } catch {
    return '';
  } finally {
    try { store?.close(); } catch { /* fail open */ }
  }
}

/**
 * The audit record for a refusal.
 *
 * The one hook action that CHANGES what a tool call does, so it is the one
 * that most needs to be in the log: an agent blocked from writing into
 * `.my_context/` that then tells the user something else happened is exactly
 * what an audit trail is for.
 *
 * Recorded against the workspace resolved from `cwd`, NOT against the
 * `.my_context` directory the path names. Those are usually the same and when
 * they differ the difference matters: the denied path is attacker-controlled,
 * and `recordAudit` creates the directory it writes to, so keying off the path
 * would let a `Write` to `/anywhere/.my_context/x` create a `.audit/` tree at
 * an arbitrary location. `denied.rel` still records WHICH managed path was
 * refused, so nothing about the event is lost. No workspace at `cwd` means
 * there is nowhere legitimate to record, and the deny still stands.
 */
function recordDeny(input: HookInput, cwd: string, abs: string): void {
  const home = resolveWorkspace(cwd).projectRoot;
  if (!home) return;
  const denied = managedSplit(toPosix(abs)) ?? managedSplit(toPosix(canonicalize(abs)));
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

/** Returns the JSON to print on stdout, or '' for "no opinion". */
export function runPreToolUse(raw: string, fallbackCwd: string): string {
  try {
    // The disclosure lives here, not in the entry guard below, for the same
    // reason `buildRestoreSnapshot` writes its own stderr line: the failure
    // is known here, and a second parse in the caller just to learn it again
    // is the "second spelling" this codebase keeps paying for. It is inside
    // the try, so even an EPIPE on stderr degrades to `''` (allow) rather
    // than to a blocked tool call — `INV-hooks-fail-open` is unchanged.
    //
    // PreToolUse has no channel of its own to the model here: a malformed
    // payload yields no `file_path`, so there is nothing to attach an
    // `additionalContext` block to. stderr is the whole disclosure.
    const { input, parseError } = parseHookInput(raw);
    if (parseError !== null) process.stderr.write(hookParseErrorLine(parseError));
    const cwd = input.cwd ?? fallbackCwd;

    const filePath = extractFilePath(input);
    if (!filePath) return '';

    if (/Edit|Write/.test(input.tool_name ?? '')) {
      const abs = path.resolve(cwd, filePath);
      const reason = denyReason(abs);
      if (reason) {
        recordDeny(input, cwd, abs);
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
