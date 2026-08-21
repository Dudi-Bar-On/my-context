import { recordAudit, type AuditWriteResult } from '../core/audit.ts';
import { isMainEntry } from '../core/paths.ts';
import { resolveWorkspace } from '../core/workspace.ts';
import { hookParseErrorLine, parseHookInput, readStdin, type HookInput } from './io.ts';

/**
 * One audit row per failed tool call — the empirical check on a fail-open
 * policy whose cost is invisible by design (plan Task 7).
 *
 * `INV-hooks-fail-open` means every hook here returns '' or `null` on every
 * error path and blocks nothing. That is the right policy and it has one
 * property nobody can see from inside it: a hook that swallows a failure
 * cannot say how often it swallowed one. This event is the other end of that —
 * it fires when a TOOL failed, and it writes the one durable trace the product
 * keeps of a failed call. Counting is the whole feature; there is no injection
 * and nothing reaches the model.
 *
 * **Unverified, and treated as such.** No probe has established that Claude
 * Code fires `PostToolUseFailure` at all, or what its payload calls the failure
 * reason. Nothing below depends on either: if the event never fires, nothing is
 * written and nothing breaks; if the reason lives under a key this file does
 * not know, the note omits the clause and still records the failure. Every read
 * of the payload is defensive — a value is used only when it arrived and only
 * when it is the type it would have to be.
 *
 * **Synchronous stdin is correct here.** `readFileSync(0)` blocks the thread
 * and no in-process timer can preempt it, which is why `post-tool-use.ts`
 * reads asynchronously: it has an envelope the model waits for. This hook
 * writes nothing to stdout, so a stalled read costs the process and nothing
 * else, and the bound that matters is `hooks.json`'s `"timeout": 5` — Claude
 * Code killing it. The three synchronous hooks are the precedent.
 */

/**
 * The payload keys this hook will accept a failure reason from, in order.
 *
 * A guess, and labelled as one. Nothing measured says the reason is called
 * `error` rather than `message` or nothing at all, so this is a short list of
 * plausible spellings read as *whatever arrived*, never a shape this hook
 * asserts the payload has. When none of them holds a non-empty string the note
 * simply carries no reason — an absent clause, not an invented one.
 *
 * `tool_input` is deliberately NOT on this list and must never join it: the
 * input is the tool's CONTENT (a file's new text, a command line), and the
 * audit log records scope. That is the same rule every injection record
 * follows, and `test/hooks/post-tool-use-failure.test.ts` executes it.
 */
const REASON_KEYS = ['error', 'tool_error', 'failure_reason', 'reason', 'message'];

/**
 * Objects a reason may be nested one level inside. `error` appears here as well
 * as above because it can plausibly arrive as either a string or an
 * `{ message }` — the direct pass rejects the object, this one looks inside it.
 */
const REASON_CONTAINERS = ['tool_response', 'tool_result', 'error'];

/**
 * How much of a payload-supplied reason reaches the note.
 *
 * The same 200 as `io.ts`'s private `oneLine`, for the same reason: the string
 * is caller-controlled, and a disclosure that scrolls a terminal or bloats
 * every row of an append-only log discloses less than one that fits. It is not
 * shared with that function because `io.ts` is another task's surface in this
 * plan (Task 5) and this hook must not be the edit that reaches into it; if
 * both ever want one helper, exporting `oneLine` is the one-line change.
 */
const REASON_MAX = 200;

/** A payload value as one capped line, or `null` when it is not usable text. */
function flatten(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const flat = value.replace(/\s+/gu, ' ').trim();
  if (flat === '') return null;
  return flat.length > REASON_MAX ? `${flat.slice(0, REASON_MAX - 3)}...` : flat;
}

/** The first usable reason the payload offers, or `null` when it offers none. */
function reasonFrom(input: HookInput): string | null {
  const bag = input as Record<string, unknown>;
  for (const key of REASON_KEYS) {
    const direct = flatten(bag[key]);
    if (direct !== null) return direct;
  }
  for (const container of REASON_CONTAINERS) {
    const nested = bag[container];
    if (typeof nested !== 'object' || nested === null || Array.isArray(nested)) continue;
    for (const key of REASON_KEYS) {
      const inner = flatten((nested as Record<string, unknown>)[key]);
      if (inner !== null) return inner;
    }
  }
  return null;
}

/**
 * Records one failed tool call. Returns what the append did, or `null` when
 * there was nothing to record. Never throws.
 *
 * The `null`s are two different statements and both are deliberate:
 *
 *  - **An empty payload is not evidence of a failure.** `parseHookInput`
 *    returns `{}` for an unreadable payload AND for an interactive run with no
 *    stdin at all, so a row written from `{}` would be an event this hook
 *    invented — a degradation counter that counts its own invocations is worse
 *    than no counter. The payload loss is disclosed on stderr by the entry
 *    guard below instead.
 *  - **No workspace means nowhere legitimate to record.** `recordAudit`
 *    creates the directory it writes to, so recording against a resolved-from-
 *    nothing root would scatter `.audit/` trees; and `resolveWorkspace` THROWS
 *    on an unparseable `config.json`, which is the one call here that can, and
 *    which the outer catch turns into the same `null`.
 *
 * A missing `session_id` is NOT one of them: unlike `PreCompact`, whose
 * snapshot has nowhere to go without a session key, this row has somewhere to
 * go, and a counter that drops the failures it cannot attribute counts the
 * wrong thing.
 */
export function recordToolFailure(
  input: HookInput, fallbackCwd: string,
): AuditWriteResult | null {
  try {
    if (Object.keys(input as Record<string, unknown>).length === 0) return null;

    const ws = resolveWorkspace(input.cwd ?? fallbackCwd);
    if (!ws.projectRoot) return null;

    const tool = flatten(input.tool_name);
    const reason = reasonFrom(input);
    // NOT `flatten`: a session id is compared, never read. `mycontext audit
    // --session <id>` matches on equality, so a capped or whitespace-collapsed
    // id would produce a row that exists and cannot be found — a silent drop
    // wearing the shape of a record. Only "is it a usable string" is checked.
    const sessionId = typeof input.session_id === 'string' && input.session_id.trim() !== ''
      ? input.session_id
      : null;

    const result = recordAudit(ws.projectRoot, {
      kind: 'hook',
      op: 'post-tool-use-failure',
      hook: 'PostToolUseFailure',
      ...(sessionId === null ? {} : { sessionId }),
      // Nothing was delivered, and `injected: []` says so explicitly rather
      // than by absence: `ledgerRows` replays this field, and a hook record
      // that omitted it would leave "delivered nothing" and "did not say"
      // spelled the same way.
      injected: [],
      // Scope, not content: which tool, and the reason ONLY when the payload
      // handed one over. Never the tool input, never a file's text.
      note: `${tool ?? 'unknown tool'} failed${reason === null ? '' : `: ${reason}`}`,
    });

    // The log is this hook's only output, so a failed append is the whole
    // event lost — `INV-nothing-is-dropped-silently` — and it cannot be
    // disclosed IN the log, which is the thing that just failed. stderr is the
    // only channel left, and it is the same one `pre-compact.ts` uses for the
    // same class of loss. Exit stays 0 either way; the tool call already
    // failed and a hook must not add to that.
    if (!result.written) {
      process.stderr.write(
        `my_context: the PostToolUseFailure audit record could not be written ` +
        `(${result.error}); this failed tool call is missing from ` +
        `\`mycontext audit --op post-tool-use-failure\`, so the degradation count is low by ` +
        `at least one. Nothing was blocked.\n`,
      );
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * The disclosure the shared line does not carry.
 *
 * `hookParseErrorLine` names what an unreadable payload costs the OTHER hooks —
 * the compaction restore, the JIT tier, the snapshot — because those are the
 * features a user later finds missing. None of them is what was lost here, and
 * this hook has no injected block to put a note in, so the second channel the
 * other hooks use does not exist. One extra line is the whole of it: the
 * failure that fired this process is not in the log, and the count built from
 * that log is low by at least one.
 */
const LOST_RECORD_LINE =
  'my_context: the PostToolUseFailure payload could not be read, so this failed tool call was ' +
  'NOT recorded — `mycontext audit --op post-tool-use-failure` is missing a row and the ' +
  'degradation count built from it is low by at least one.\n';

if (isMainEntry(import.meta.filename, process.argv[1])) {
  // No runtime safety timer: `recordToolFailure` is fully synchronous, so an
  // unref'd `setTimeout` set before it can only fire after it already
  // returned. The real bound is `hooks.json`'s 5s kill.
  try {
    const { input, parseError } = parseHookInput(readStdin());
    if (parseError !== null) {
      process.stderr.write(hookParseErrorLine(parseError));
      process.stderr.write(LOST_RECORD_LINE);
    }
    // Called unconditionally, and safe to be: `parseHookInput` returns `{}` on
    // BOTH of its error paths, and `recordToolFailure` records nothing from an
    // empty payload. One rule, in one place, tested at the function level —
    // rather than a second guard here that could drift from it.
    recordToolFailure(input, process.cwd());
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
