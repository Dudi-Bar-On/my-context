import { recordAudit } from '../core/audit.ts';
import {
  nestedCorpusComparison, nestedCorpusWaysOut, resolveCorpus,
} from '../core/corpus-identity.ts';
import { buildInjection } from '../core/inject.ts';
import { isMainEntry } from '../core/paths.ts';
import { CORPUS_DIR_ENV, DIR_NAME, findProjectRoot } from '../core/workspace.ts';
import {
  hookBlockDecision, hookContext, hookParseErrorLine, ledgerKey, parseHookInput, readStdinAsync,
  type HookInput,
} from './io.ts';

/**
 * The pinned tier plus the index, delivered into a subagent's empty context
 * window at the moment it is dispatched — framed with where it came from.
 *
 * A subagent starts with none of the parent's context. It inherits the
 * parent's `session_id` verbatim and is told apart only by `agent_id`
 * (`hooks/io.ts` · `ledgerKey`), and no `SessionStart` fires for it, so
 * without this hook every subagent in this project works with no knowledge of
 * the project's own constraints. Everything about what it receives is decided
 * in `core/inject.ts` under `event: 'subagent'`; this file decides the ORDER
 * of the two writes, the key it dedupes under, and the envelope.
 *
 * **What bounds this hook, stated exactly.** The stdin read is
 * `readStdinAsync` plus an unref'd 2s timer, copied from `post-tool-use.ts`,
 * and that pair bounds exactly ONE failure: a pipe the caller opened and never
 * closed. It does not bound the selection. `buildInjection` is synchronous
 * once it starts, and a timer cannot preempt synchronous work — the same fact
 * `post-tool-use.ts` records for the mirror case, where a synchronous
 * `readFileSync(0)` blocks the thread and no timer can fire against it. So
 * once the payload is in hand there is no in-process bound on this process at
 * all, and the only thing that can end it is Claude Code killing it at the
 * `"timeout"` its `hooks.json` entry declares. `SubagentStart` BLOCKS the
 * dispatch it fires for — measured: a 3,018 ms hook delayed the subagent's
 * first tool call until it returned — so that is a real cost paid on every
 * dispatch, and nothing in this file reduces it.
 *
 * **The audit record is written BEFORE the work, and the order is the point**
 * (spec §6n.3). A killed process writes nothing after the moment it dies, so a
 * record written after the selection would record every delivery that
 * succeeded and none that was killed — the one case the record exists for.
 * Writing it first turns a kill into evidence: one `subagent-start` row saying
 * `delivery=attempted agent=<id>` and no matching `delivery=complete` for that
 * agent. Both rows carry the PARENT's `session_id`, so
 * `mycontext audit --session <parent>` already shows the pair side by side.
 * Nothing here reads that pair back — §6n.3 asks for the evidence, not for a
 * report over it.
 *
 * The cost of pairing on a note rather than on a second op, named where it is
 * paid: anything COUNTING `subagent-start` rows counts each dispatch twice
 * unless it reads the note. That was the cheaper of the two — a
 * `subagent-start-attempt` op would be a third widening of a closed
 * vocabulary (`AUDIT_OPS`; `parseAudit` refuses a whole segment on an op it
 * does not know) whose downgrade cost is still being priced, and a second
 * spelling of one event.
 */

/**
 * The disclosure for a payload that arrived and named no subagent.
 *
 * `agent_id` is the only thing that distinguishes a subagent from its parent,
 * and it has been present on every measured `SubagentStart` payload. If it
 * ever stops being, this hook delivers nothing to any subagent, forever, and
 * the audit log cannot say so — by the rule directly below, a payload with no
 * agent is not a subagent that lost anything, so no attempt record is written
 * for it. That leaves stderr as the only channel, and the alternative to using
 * it is a product that silently stops doing the thing this hook exists for
 * (INV-nothing-is-dropped-silently).
 *
 * It fires only for a payload that actually arrived — an empty one is a run
 * with no stdin, which says nothing about the platform's payload shape.
 */
const NO_AGENT_LINE =
  'my_context: a SubagentStart payload arrived with no `agent_id`, so no knowledge was ' +
  'delivered to this subagent and no record was written for it. `agent_id` is the only field ' +
  'that distinguishes a subagent from its parent; without it the dedupe key would be the ' +
  "PARENT's, which would suppress the parent's own next injection. Nothing was blocked.\n";

/**
 * The disclosure the shared parse-error line does not carry.
 *
 * `hookParseErrorLine` names what an unreadable payload costs the hooks that
 * key on a session. What it costs HERE is different and larger: this subagent
 * runs with none of this project's recorded knowledge, and — since the attempt
 * record needs the `agent_id` that was in the payload that could not be read —
 * nothing in the audit log will say that it did.
 */
const LOST_DELIVERY_LINE =
  'my_context: the SubagentStart payload could not be read, so this subagent starts with none ' +
  'of this project\'s knowledge and no `subagent-start` record names it. Nothing was blocked.\n';

/**
 * **The refusal, and the reason a disclosure was not enough.**
 *
 * `core/corpus-identity.ts` has resolved and named this exact condition
 * correctly since 2026-08-27, and `core/inject.ts` puts `nestedCorpusNote` at
 * the top of the block a subagent reads. On 2026-09-02 a stray `cd` moved a
 * session's working directory into `my-context/` twice; every subagent
 * dispatched in those windows was told, at turn zero, in the first paragraph
 * of its own context, that it had been given a 44-item corpus with a 759-item
 * one above it — and every one of them carried on, as did the human
 * dispatching them. A disclosure that is read and ignored is not protection,
 * so this event stops disclosing and starts REFUSING.
 *
 * ── WHAT "REFUSE" HONESTLY MEANS ON THIS EVENT ──────────────────────────────
 *
 * **`SubagentStart` cannot stop the dispatch it fires for, and this function
 * does not pretend otherwise.** Read off build 2.1.258: the dispatcher consumes
 * each hook result with exactly three reads —
 *
 *     if(os.message&&…)                  In.push(os.message)
 *     if(os.blockingError&&…)            In.push(pOe("SubagentStart",os.blockingError,…))
 *     if(os.additionalContexts&&…)       $o.push(...os.additionalContexts)
 *
 * — and then falls through to build the agent. There is no `return`, no throw,
 * and `preventContinuation` (what `continue:false` produces) is never read at
 * that site, unlike `PostToolUse` and `UserPromptSubmit` where it ends the
 * loop. Emitting `continue:false` here would be a refusal the harness ignores,
 * which is the one thing worse than the disclosure it replaces.
 *
 * So what is refused is the only thing this hook actually controls, and both
 * halves are real:
 *
 *   1. **The injection is withheld.** No pinned tier, no index, nothing from
 *      the corpus nobody chose. That is the whole harm — an agent reasoning
 *      from another project's constraints — and it does not happen.
 *   2. **No audit row is written.** The attempt record would have gone to
 *      `findProjectRoot(cwd)`, i.e. into the NESTED log, which is the second
 *      half of the original defect: rows landing where the status bar and
 *      `mycontext audit` never look. Withholding it is not silence — this text
 *      goes to stderr and into the subagent's own context.
 *
 * and the refusal is then delivered as loudly as the event permits:
 * `hookBlockDecision` makes it a `blockingError`, which the dispatcher renders
 * into the subagent's opening messages as a `hook_non_blocking_error`
 * attachment — an ERROR, not the friendly `additionalContext` paragraph that
 * was already being ignored — and the same text goes to stderr, which Claude
 * Code surfaces to the person who dispatched. The one gap, named rather than
 * hidden: an `isolatedContext` subagent is pushed neither, and there stderr is
 * the only channel left.
 *
 * ── THE CONDITION, AND WHY THE ENV-VAR HALF IS NOT OPTIONAL ─────────────────
 *
 * Refuse when the walk stopped at a nested corpus AND no caller named a corpus
 * by hand. `resolveCorpus` already fuses those two — it skips the enclosing
 * walk entirely under an override, so `nesting !== null` IS "nested and not
 * overridden" — and that fusion is deliberate upstream, not a coincidence to
 * lean on quietly. An explicit `CORPUS_DIR_ENV` is a caller stating the choice
 * by name (`ui/execute-effect.ts` points it at a scratch copy on every
 * confirm); refusing a deliberate choice would break a working feature, and
 * alarming about one is precisely how a check teaches its reader to dismiss
 * it. So an override passes through untouched and gets the ordinary injection.
 *
 * **Nothing is auto-switched.** `corpus-identity.ts` argues it and the argument
 * holds here at full force: a process that silently switched to the enclosing
 * corpus on this signal would still be answering from a corpus nobody chose,
 * just a different one. Refuse, name both ways out, guess neither.
 *
 * `''` when there is nothing to refuse — the ordinary case — so callers stay a
 * single `if`, exactly like `focusErrorNote` and `hookParseErrorLine`.
 */
export function nestedCorpusRefusal(
  cwd: string,
  override: string | undefined = process.env[CORPUS_DIR_ENV],
): string {
  const resolution = resolveCorpus(cwd, override);
  if (resolution.root === null || resolution.nesting === null) return '';
  return [
    'my_context: REFUSED. This subagent was dispatched into a NESTED corpus that nobody chose, ' +
    'so nothing was injected.',
    nestedCorpusComparison(resolution),
    'The corpus is found by walking up from the working directory and stopping at the first ' +
    `\`${DIR_NAME}\`, so the directory this dispatch ran in is what picked it. Read the smaller ` +
    'number as A DIFFERENT CORPUS, not as a project with little recorded in it.',
    'Nothing in either corpus was blocked, changed or written to, and no `subagent-start` audit ' +
    'row was recorded — one would have landed in the nested log, where nothing that reads this ' +
    "project's log would ever see it. What was withheld is this hook's own injection: this " +
    "subagent starts with none of this project's recorded knowledge rather than with another " +
    "project's.",
    `Two ways forward, and this hook will not guess between them: ${nestedCorpusWaysOut(resolution)}` +
    `. An explicit ${CORPUS_DIR_ENV} is a stated choice and is never refused, so a caller that ` +
    'means the nested corpus says so and proceeds.',
    'This is not a veto. SubagentStart cannot stop the dispatch it fires for, so this arrives as ' +
    'a hook error and the agent runs anyway. If you are that agent: stop and report this rather ' +
    'than working from it — the previous version of this check only disclosed, and every agent ' +
    'that read the disclosure carried on.',
  ].join('\n');
}

/**
 * Runs one `SubagentStart`. Returns the envelope to write to stdout, or `''`.
 * Never throws.
 *
 * The three steps, in the order §6n.3 rules and the tests assert:
 *
 *  1. **`ledgerKey`, and the `agent_id` gate.** No `agent_id` means no
 *     injection and no record at all. `ledgerKey` returns the bare
 *     `session_id` when `agent_id` is absent, so injecting anyway would write
 *     the PARENT's seen file with items only a subagent received —
 *     suppressing the parent's own JIT tier and putting ids the parent's
 *     window never held into the PreCompact snapshot. Both are MISSES, and
 *     this path's accepted failure direction is re-delivery. An attempt record
 *     here would be worse than useless: it would claim a subagent lost context
 *     when none was ever owed any.
 *  1b. **The wrong-corpus gate**, between the two, and the position is the
 *     point. `nestedCorpusRefusal` returns non-empty only when the walk
 *     stopped at a nested corpus that no caller named, and a refusal returned
 *     here has provably written nothing: it is upstream of the attempt record,
 *     which would otherwise land in the nested log, and upstream of
 *     `buildInjection`, which is the only thing that reads the corpus at all.
 *     The refusal's own text makes both claims, so this ordering is what makes
 *     it true. Its header carries what "refuse" does and does not mean on an
 *     event that cannot abort the dispatch it fires for.
 *  2. **The attempt record**, scope and never content: no payload, no item
 *     text, no rendered block. `findProjectRoot` rather than
 *     `resolveWorkspace`, deliberately — see below.
 *  3. **Then the work.** `buildInjection` writes the matching
 *     `delivery=complete` record itself, unconditionally on this event, so a
 *     delivery that carried nothing is still distinguishable from a hook that
 *     was killed before it could carry anything.
 *
 * **Why step 2 resolves the root with `findProjectRoot`.**
 * `resolveWorkspace` THROWS on a `config.json` that is not valid JSON, and it
 * is the only call on this path that throws at all. Using it here would put
 * that throw BEFORE the attempt record, so the one failure that costs a
 * subagent its entire injection while saying nothing on any channel would also
 * leave no trace in the log. `findProjectRoot` walks for the directory and
 * reads no config, so the attempt record is written in strictly more cases
 * than the delivery is — which is the whole shape §6n.3 asks for. The
 * consequence, stated rather than implied: on an unparseable `config.json`
 * this hook leaves an attempt with no completion, exactly as a kill does. The
 * two are told apart by the process exiting normally, not by the log.
 *
 * There is no attempt record when no workspace can be found at all, and there
 * cannot be: the log lives inside the workspace.
 *
 * **A missing `session_id` is not a gate.** `ledgerKey` returns `null` for it,
 * which cannot collide with a parent's key, so there is nothing to corrupt.
 * The injection goes ahead with no dedupe key and `buildInjection` discloses
 * that in its note — one possible re-delivery, against a subagent that would
 * otherwise get nothing. Withholding would be the miss.
 */
export function buildSubagentStartOutput(input: HookInput, fallbackCwd: string): string {
  try {
    const agentId = input.agent_id;
    if (!agentId) return '';
    // `ledgerKey`, not a composite spelled here: `pre-tool-use.ts` looks in
    // the file this writes at the subagent's first tool call, and the two keys
    // must be the same string or that first tool call re-delivers everything
    // this hook just delivered. It is `null` only when the payload carried no
    // `session_id`; see the note above.
    const dedupeKey = ledgerKey(input);

    const cwd = input.cwd ?? fallbackCwd;

    // **Before the root is resolved for the audit record, and before anything
    // is read out of the corpus.** The refusal's own claim is that no row was
    // written and nothing was read, and a check placed after `recordAudit`
    // would have already written the row it says it did not — into the nested
    // log, which is the half of the defect that made the original silence hard
    // to see. See `nestedCorpusRefusal` for what "refuse" does and does not
    // mean on an event that cannot abort its own dispatch.
    const refusal = nestedCorpusRefusal(cwd);
    if (refusal !== '') return hookBlockDecision(refusal);

    const projectRoot = findProjectRoot(cwd);
    if (!projectRoot) return '';

    recordAudit(projectRoot, {
      kind: 'injection',
      op: 'subagent-start',
      hook: 'SubagentStart',
      // The PARENT's id, which is what a subagent's payload carries and what
      // groups this row with the completion record beside it.
      ...(input.session_id === undefined ? {} : { sessionId: input.session_id }),
      // Nothing has been delivered yet, and both fields say so explicitly
      // rather than by absence: `ledgerRows` replays `injected`, and a row
      // that omitted it would spell "delivered nothing" and "did not say" the
      // same way.
      injected: [],
      tokens: 0,
      note: `delivery=attempted agent=${agentId}`,
    });

    const text = buildInjection(cwd, {
      event: 'subagent',
      ...(input.session_id === undefined ? {} : { sessionId: input.session_id }),
      ...(dedupeKey === null ? {} : { dedupeKey }),
      agentId,
    });
    // The empty guard is this hook's, not the envelope builder's: an envelope
    // carrying an empty `additionalContext` is a hook that speaks on every
    // dispatch and says nothing.
    if (text === '') return '';
    return hookContext('SubagentStart', text);
  } catch {
    // INV-hooks-fail-open. A knowledge base that breaks a dispatch is worse
    // than one that says nothing.
    return '';
  }
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  // The unref'd timer, set BEFORE the await, exactly as `post-tool-use.ts`
  // sets it and for the same reason: `readStdinAsync` resolves on 'end' and
  // supplies no bound of its own, so a pipe that is never closed would keep
  // this process — and the subagent dispatch waiting on it — alive until
  // Claude Code killed it. It preempts nothing else: everything after the
  // await is synchronous, and this timer is the last thing that can run
  // before it.
  const timer = setTimeout(() => process.exit(0), 2000);
  timer.unref();

  readStdinAsync()
    .then((raw) => {
      const { input, parseError } = parseHookInput(raw);
      if (parseError !== null) {
        // Both lines, for the same reason `post-tool-use-failure.ts` writes
        // two: the shared one names what the payload cost every hook that
        // keys on a session, and the second names what it cost THIS one,
        // which is not on that list.
        process.stderr.write(hookParseErrorLine(parseError));
        process.stderr.write(LOST_DELIVERY_LINE);
      } else if (!input.agent_id && Object.keys(input as Record<string, unknown>).length > 0) {
        process.stderr.write(NO_AGENT_LINE);
      }
      // **The human's copy of the refusal**, and the only channel that reaches
      // them. `noWorkspaceLine` is the precedent for both: Claude Code
      // surfaces a hook's stderr to the USER, and the user is the one who can
      // `cd` back out or set the variable. The model's copy travels the other
      // way, in the envelope `buildSubagentStartOutput` returns.
      //
      // Recomputed rather than threaded out of the builder, deliberately. The
      // builder's contract is one string for stdout and every test in the file
      // reads it that way; the extra cost is one upward `existsSync` walk plus
      // two `items/` counts, paid only on a dispatch that is already refused,
      // which is not a path worth widening an API for. It is gated on
      // `agent_id` for the same reason the builder is: no agent, no dispatch
      // to refuse.
      if (input.agent_id) {
        const refusal = nestedCorpusRefusal(input.cwd ?? process.cwd());
        if (refusal !== '') process.stderr.write(refusal + '\n');
      }
      const line = buildSubagentStartOutput(input, process.cwd());
      if (line) process.stdout.write(line + '\n');
    })
    .catch(() => { /* fail open */ })
    .finally(() => { process.exitCode = 0; });
}
