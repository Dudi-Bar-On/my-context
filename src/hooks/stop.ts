import { handoverThresholdPercent } from '../core/config.ts';
import {
  occupancyStandDownLine, readOccupancy, type UnmeasurableWhy,
} from '../core/context-occupancy.ts';
import {
  checkHandoverAsk, handoverConfigAt, MAX_ASKS, readLatch, workspaceConfigAt, writeLatch,
  type AskLatch,
} from '../core/handover-ask.ts';
import { isMainEntry } from '../core/paths.ts';
import {
  upkeepStandDownLine, upkeepUiServer, type Upkeep, type UpkeepDeps,
} from '../core/ui-server-upkeep.ts';
import { findProjectRoot } from '../core/workspace.ts';
import { observeAndRecord, type Observation, type ObservationSpec } from './observe.ts';
import {
  hookParseErrorLine, parseHookInput, readStdin, type HookInput,
} from './io.ts';

/**
 * The end of an assistant turn — the only boundary in the audit log that is not
 * a tool call, a mutation or a session edge.
 *
 * Everything else in the log happens at a moment nobody chose: a `PreToolUse`
 * row lands because a model reached for a file, a `jit` row lands because that
 * file matched a scope. Reading a session back, there is nothing that says
 * *here is where one exchange ended and the next began*. `Stop` is that line,
 * and it is why this is the one observation hook whose row is written on the
 * ordinary path rather than only when something notable happened.
 *
 * **The cost is stated rather than assumed: one row per turn, and one process
 * spawn per turn.** Turns are two orders of magnitude rarer than tool calls —
 * this project's own log held 957 records across weeks of use — so the volume
 * is small, but it is not nothing and it is the highest-frequency of the ten.
 * `test/perf/observation-latency.perf.ts` records what the spawn costs.
 *
 * ── THE CAPTURE NUDGE, AND WHY IT IS STILL WHERE IT WAS ────────────────────
 *
 * `hooks seq:21` observes that the capture nudge is *"arguably"* better here
 * than on `PostToolUse`, and the argument is a good one: `PostToolUse` fires
 * per edit, so a model that edits a watched document five times in one turn is
 * asked five times to capture what it decided, and it is asked in the middle of
 * work rather than at the end of it. `Stop`'s `additionalContext` exists
 * exactly for this — the platform's own description reads *"non-error feedback
 * delivered to the model; the conversation continues so the model can act on
 * it"* (build 2.1.239, byte 303352370).
 *
 * **It is STILL not moved, and "arguably" is still the reason.** Moving it
 * changes what this product asks a model to do and when, on every turn of every
 * session, and it changes it in a direction nothing has measured: a nudge at
 * the end of a turn arrives when the model has already written its answer,
 * which may be exactly too late to be acted on, or exactly right. That is a
 * product ruling and `hooks seq:21` did not make one — it named the argument.
 * So `hooks/post-tool-use.ts` remains untouched, and that question remains the
 * owner's, reported with the measurement attached rather than answered by a
 * commit.
 *
 * ── WHAT THIS HOOK DOES SAY, AND HOW NARROWLY ──────────────────────────────
 *
 * The envelope above was empty from the day the ten observation hooks landed
 * until 2026-08-27, and it was empty on purpose: an event that can speak on
 * every assistant turn is a product decision, not a capability question, and
 * nobody had taken it.
 *
 * **The owner's occupancy requirement is that decision arriving.** *"Use the
 * most suitable hooks to measure the context window percentage occupacity, if
 * 98 or greater update the handover file"* (2026-08-27). A hook cannot write a
 * handover — only the model can — so the mechanism is not *update the file*, it
 * is *ask the model to, at the last moment where it still can*, and `Stop` is
 * the one registered per-turn event whose output the model receives. The ruling
 * is recorded as `DEC-stop-speaks-once-and-only-to-raise-the-handover` and it
 * is narrow in three directions, all three of which are enforced below and
 * pinned in `test/hooks/stop-handover-ask.test.ts`:
 *
 *  1. **One purpose.** `Stop` speaks to raise the handover at the threshold and
 *     for nothing else. The emptiness stands for every other use, and a second
 *     use needs its own decision — `observe.ts`'s `SPEAKS` map is the gate that
 *     keeps the other five unfilled envelopes unfillable by accident.
 *  2. **At most TWICE per session**, latched on disk before the ask is
 *     returned. A blind second ask arrives after the model has just written the
 *     handover, and then again next turn, and the turn after: a per-turn hook
 *     that repeats is not a verbose feature, it is a session that cannot
 *     finish. This is the most expensive bug the design can ship and the latch
 *     is the only thing standing between it and the product.
 *
 *     `seq:9` raised the bound from one to two and paid for the raise with a
 *     measurement rather than an argument: the second ask is delivered ONLY
 *     when `checkHandoverAsk` has compared the handover's mtime against the
 *     first ask and found the file untouched, and it names the first ask when
 *     it goes. There is no third under any circumstances — the audit row is the
 *     accountability story for the ones that went unanswered.
 *  3. **It never blocks and it never guesses.** The whole path is one config
 *     read, one small tee read, one small latch read and pure comparisons. No
 *     transcript scan, no directory walk, no spawn — spec §5 — because the
 *     platform genuinely waits on this hook before ending the turn. And with no
 *     status-line bridge there is no percentage: the mechanism stands down and
 *     says so once, rather than inventing one (`STD-absent-vs-zero`, and
 *     `core/context-occupancy.ts` on why there is no transcript fallback).
 *
 * **No matcher, and none is possible.** `Stop` is absent from the matcher-query
 * switch entirely (build 2.1.239, byte 317139714 — it falls to `default:break`,
 * leaving the query `undefined`), and `let d=(a?s.filter(…):s)` runs every
 * entry when the query is undefined. So a matcher on this event would be
 * ignored, not honoured: dead configuration that reads as a filter.
 *
 * **The timeout is the one that genuinely bites.** The platform waits for this
 * hook before ending the turn, which is a user staring at a prompt, so
 * `hooks.json` declares the tightest timeout of the ten.
 */

/**
 * The per-session latch, the workspace config read and the comparison that
 * verifies an ask all live in `core/handover-ask.ts` now.
 *
 * They were written here, because `Stop` was the only hook that had them.
 * `plan:handover seq:9` gave `PreCompact` and `SessionEnd` the same check —
 * the two other events that destroy a context window — and a latch three hooks
 * read is a core concern, not a per-turn hook detail two other hooks import a
 * hook to reach. That module carries the arguments for the file format, the
 * session-id spelling, the write-before-you-speak rule and the mtime
 * comparison; nothing about any of them changed in the move.
 *
 * **The config is still read TWICE per turn and that is still deliberate.**
 * `runStopHook` below needs `ui` before `observeAndRecord` runs, and
 * `handoverAsk` needs `handover` from inside it; sharing one read would mean
 * threading a `Config` through `ObservationSpec.observe`, which is
 * `observe.ts`'s shape and belongs to the nine other hooks as much as to this
 * one. Two reads of one small JSON file is the cheaper of the two costs, and it
 * is paid on a hook that already reads it.
 */

/**
 * What the model is told, and it is the entire product surface of this feature:
 * the only thing anyone ever sees from R2 is this paragraph.
 *
 * Three things, and each earns its place. **The measurement**, because an
 * instruction with no number behind it is one a model can reasonably weigh
 * against what it was already doing. **The file**, because "update the
 * handover" is not actionable without knowing which document that is. **The
 * deadline**, because the whole point is that this turn is the last one — after
 * the compaction there is no session left to ask.
 *
 * It says what to write, too, and in the order a next session needs it: what
 * was being done, what was decided and why, what comes first. A handover that
 * records only the state and not the reasoning is the failure this project has
 * a lesson about.
 */
function askText(handoverPath: string, percent: number): string {
  return (
    `The context window is ${percent.toFixed(1)}% full. Update ${handoverPath} NOW, before ` +
    'the compaction: what you were doing, what you decided and why, and what the next ' +
    'session must do first. You have this turn. Nothing else carries across.'
  );
}

/**
 * The SECOND ask, and the last one there will ever be.
 *
 * It exists at all only because the first one can be shown to have failed:
 * `checkHandoverAsk` compared the handover's mtime against the moment the first
 * ask went out and found the file untouched. Repeating an ask you cannot verify
 * is nagging; repeating one you have measured as unanswered is the mechanism
 * working.
 *
 * **It NAMES the first ask, and that is a requirement rather than a courtesy.**
 * A second paragraph that reads identically to the first is indistinguishable
 * from a hook that lost its latch, which is the most expensive bug this design
 * can ship — so the text has to say, in the model's own context, that this is a
 * repeat and why. Saying *the last time* is the other half: an instruction that
 * might come again is one a model can reasonably defer.
 */
function repeatAskText(
  handoverPath: string, percent: number, firstAskedAt: string | null,
): string {
  return (
    `The context window is ${percent.toFixed(1)}% full and ${handoverPath} has NOT been ` +
    'written since you were asked to update it' +
    (firstAskedAt === null ? '' : ` at ${firstAskedAt}`) +
    '. This is the second and LAST time you will be asked. Update it NOW: what you were ' +
    'doing, what you decided and why, and what the next session must do first. You have ' +
    'this turn. Nothing else carries across.'
  );
}

/**
 * Says the mechanism is standing down, at most once per session.
 *
 * Once, because `Stop` fires on every assistant turn: a line that repeats is a
 * paragraph in front of the user on every turn for the whole session, which
 * would be a worse defect than the silence it replaces (`io.ts`'s
 * `ParsedHookInput` makes the same argument about interactive runs).
 *
 * The latch is written BEFORE the line, and the line is skipped when the write
 * fails, for `writeLatch`'s reason: a disclosure that cannot record having been
 * made is a disclosure that will be made again on every turn.
 */
function standDownOnce(root: string, sessionId: string, why: UnmeasurableWhy): void {
  const latch = readLatch(root, sessionId);
  if (latch.stoodDown) return;
  if (!writeLatch(root, sessionId, { ...latch, stoodDown: true })) return;
  process.stderr.write(occupancyStandDownLine(why));
}

/**
 * The ask, or `null` — which is the answer on all but at most one turn of a
 * session, and on every turn of most sessions.
 *
 * The gates are ordered by cost and by what they promise, not arbitrarily:
 *
 *  1. **No session id**, so nothing can be latched. Asking without a latch is
 *     asking on every turn; the ask is not worth that.
 *  2. **No `handover` key**, which means the whole feature is off. Checked
 *     BEFORE the occupancy read, so an unconfigured workspace does no extra
 *     file reads at all — and so that it stays silent on stderr too: a
 *     mechanism nobody configured promised nothing, so it has nothing to
 *     disclose and no business asking anyone to install a status-line bridge.
 *  3. **No measurement.** Stand down, once, and never guess.
 *  4. **Below the threshold.** `>=`, so an exact crossing counts; a threshold
 *     nobody can land on is a threshold with an off-by-one in it.
 *  5. **The budget of asks is spent.** `MAX_ASKS`, and it is checked before
 *     anything is stat'ed: a session that has been asked twice does no work at
 *     all on any later turn.
 *  6. **The last ask was answered.** The latch says so outright once a
 *     verification has come back `acted-on`, so the ordinary post-ask turn
 *     costs one latch read and nothing else.
 *  7. **The last ask has not been answered YET, and cannot be shown to have
 *     failed.** `checkHandoverAsk` compares the handover's mtime against
 *     `askedAt` — see `core/handover-ask.ts`. `unverifiable` is silence: an
 *     accusation nothing supports is the same defect as a guarantee nothing
 *     supports.
 *
 * ── WHAT `seq:9` CHANGED, AND WHAT IT DID NOT ──────────────────────────────
 *
 * The latch used to mean *asked*. It now means *asked and NOT YET SATISFIED*,
 * which is the whole of `DEC-the-ask-and-the-writing-are-two-turns-apart-so-a-
 * flag-is`: an ask that can be shown to have been ignored may be repeated,
 * because repeating it is only dangerous when you cannot tell. It is still
 * bounded, and the bound is what makes it safe — `MAX_ASKS` is 2, the second
 * ask NAMES the first, and there is no third.
 *
 * **The threshold rule survives intact and is now the only re-arm that is not
 * about failure.** Lowering `thresholdPercent` mid-session is a user saying
 * *ask me sooner than that*, and it re-arms even a satisfied latch — inside the
 * budget. Raising it is not a request for anything and re-arms nothing.
 *
 * Never throws: every filesystem call below is already wrapped, and
 * `readOccupancy` is documented as never throwing. That matters here more than
 * on most paths — `ObservationSpec.observe` says a builder that relies on
 * `observeAndRecord`'s catch has given up its own disclosure, and this builder
 * has a disclosure.
 */
function handoverAsk(
  input: HookInput, root: string,
): { percent: number; text: string; repeat: boolean } | null {
  const sessionId = input.session_id;
  if (typeof sessionId !== 'string' || sessionId === '') return null;

  const handover = handoverConfigAt(root);
  if (handover === null) return null;

  const occupancy = readOccupancy(root, sessionId);
  if (occupancy.state !== 'known') {
    standDownOnce(root, sessionId, occupancy.why);
    return null;
  }

  // Through the resolver, never `handover.thresholdPercent` directly: absent
  // means the user never chose one, and 98 is what an unchosen threshold means
  // (`core/config.ts` argues both halves where they are declared).
  const threshold = handoverThresholdPercent(handover);
  if (occupancy.percent < threshold) return null;

  const latch = readLatch(root, sessionId);
  // The bound, first, and before any filesystem work beyond the latch itself.
  // A session that has spent its two asks is finished with this mechanism and
  // must not pay a `stat` per turn to keep discovering that.
  if (latch.asks >= MAX_ASKS) return null;

  let base: AskLatch = latch;
  let repeat = false;
  if (latch.askedAtThreshold !== null) {
    // Lowering is an instruction; raising is not. Unchanged from seq:6, and it
    // is deliberately computed BEFORE the verification so that a satisfied
    // latch can still be re-armed by a user who moved the target.
    const lowered = threshold < latch.askedAtThreshold;
    if (latch.satisfied) {
      if (!lowered) return null;
    } else {
      const check = checkHandoverAsk(root, handover, sessionId);
      if (check.verdict === 'acted-on') {
        // Written even though nothing is asked on this turn: it is what makes
        // every later turn of this session cost one latch read instead of a
        // latch read and a `stat`. A failed write costs a repeat of this same
        // check next turn, which is why it is not gated on.
        base = { ...latch, satisfied: true };
        writeLatch(root, sessionId, base);
        if (!lowered) return null;
      } else if (check.verdict !== 'ignored') {
        // `unverifiable`. Silence — see the gate list above.
        return null;
      } else {
        repeat = true;
      }
    }
  }

  // Latched BEFORE the ask is returned, never after. The caller writes the
  // envelope and the audit row afterwards and either of those can fail; if the
  // latch were taken last, a failure between here and there would leave the
  // session armed and the model asked, which is the loop.
  //
  // `satisfied` goes back to `false` because a new ask is a new thing to
  // satisfy, and `askedAt` is stamped here — the same instant the ask becomes
  // real — so that no write that happened BEFORE this moment can be mistaken
  // for a response to it.
  const next: AskLatch = {
    ...base,
    askedAtThreshold: threshold,
    askedAt: new Date().toISOString(),
    asks: base.asks + 1,
    satisfied: false,
  };
  if (!writeLatch(root, sessionId, next)) return null;

  return {
    percent: occupancy.percent,
    repeat,
    text: repeat
      ? repeatAskText(handover.path, occupancy.percent, latch.askedAt)
      : askText(handover.path, occupancy.percent),
  };
}

/**
 * What the UI-server upkeep contributes to the audit row, and it is `''` on all
 * but a handful of turns.
 *
 * **Only when something HAPPENED.** `off`, `disabled`, `too-soon` and `alive`
 * add nothing at all: `Stop` fires on every assistant turn, so a clause that
 * appends on every one of them would put a per-minute liveness report in the
 * one log line that says where an exchange ended — and `observe.ts`'s header
 * has already ruled that a record-only hook which records everything is a hook
 * that makes the log unreadable. What is left is the two events a human would
 * want to find later: a server being put back, and the mechanism giving up.
 *
 * It goes in the NOTE and never in `context`. `Stop`'s envelope was opened for
 * exactly one purpose under
 * `DEC-stop-speaks-once-and-only-to-raise-the-handover`, and a second feature
 * writing into it would be that ruling widened by a commit nobody reviewed as
 * one. The log is where "what was done" belongs anyway; the model has no action
 * to take about a server it did not start.
 */
export function upkeepNote(upkeep: Upkeep | null): string {
  if (upkeep === null) return '';
  if (upkeep.did === 'spawned') {
    return `; no UI server was answering, so one was started on port ${upkeep.port}`;
  }
  if (upkeep.did === 'stood-down') {
    return `; the UI server upkeep stood down after ${upkeep.failures} failed spawns`;
  }
  return '';
}

export function observeStop(
  input: HookInput, root: string, upkeep: Upkeep | null = null,
): Observation | null {
  // `stop_hook_active` is the platform's re-entrancy guard: true when this turn
  // is continuing BECAUSE a stop hook asked it to. Nothing here ever asks — the
  // handover ask below is `additionalContext`, which the platform describes as
  // *non-error feedback* and which does not continue the turn — so a `true` in
  // this project's log still means some OTHER hook did.
  const active = input.stop_hook_active === true;
  const base =
    `stop_hook_active=${active ? 'true' : 'false'}; the assistant turn ended` +
    (active ? ', continuing because another stop hook asked it to' : '') +
    upkeepNote(upkeep);

  const ask = handoverAsk(input, root);

  // The note is how the log says this happened at all: stdout leaves no trace,
  // so without this a session that was asked and one that was not are
  // indistinguishable afterwards — and the percentage is what makes the row
  // answer the question §4.4 exists to settle.
  // A repeat says so IN THE ROW, not only in the model's context. An ask that
  // was ignored and an ask that was acted on have to be distinguishable in the
  // log without reading the handover — that is the whole of `seq:9`'s DONE
  // WHEN — and this row is where `Stop` can say it: the second ask exists only
  // because the first was measured to have failed.
  return ask === null
    ? { note: base }
    : {
        note: `${base}; asked${ask.repeat ? ' a SECOND time' : ''} for a handover update at ` +
          `${ask.percent.toFixed(1)}% occupancy` +
          (ask.repeat ? ' — the first ask went unanswered and this is the last one' : ''),
        context: ask.text,
      };
}

/**
 * The spec, with an upkeep result already in hand.
 *
 * **The upkeep is asynchronous and `ObservationSpec.observe` is not**, which is
 * the whole reason this builder exists. A probe is a TCP connect; a note is
 * written synchronously by `observeAndRecord`. Three ways out were available
 * and two were worse: making `observe` async changes the shape all ten
 * observation hooks share, for one of them; and letting the upkeep run
 * unawaited would put its outcome in NO row, since the process is already
 * exiting by the time it settles. Binding the answer into the spec keeps
 * `observe.ts` untouched, keeps the row at one per turn, and keeps the upkeep's
 * result in the row it belongs to.
 *
 * `null` is what every other caller passes, which is why `STOP` below is still
 * the same object it always was to every test that imports it.
 */
export function stopSpec(upkeep: Upkeep | null): ObservationSpec {
  return {
    hook: 'Stop',
    op: 'stop',
    observe: (input, root) => observeStop(input, root, upkeep),
  };
}

export const STOP: ObservationSpec = stopSpec(null);

/**
 * Run the UI-server upkeep for this turn, or decline — which is the answer in
 * every workspace that has not opted in.
 *
 * Three declines, and each is its own kind of nothing:
 *
 *  1. **A subagent.** Spec §7: parent sessions only, the restriction
 *     `PostCompact` already keeps. A fan-out of ten subagents finishing at once
 *     is ten hooks reaching for one port inside one second, and the floors in
 *     `ui-server-upkeep.ts` are a file on disk rather than a lock — they bound a
 *     sequence of turns, not a stampede. `agent_id` is the only subagent
 *     discriminator on the payload (`io.ts` measured it).
 *  2. **No workspace**, so there is nowhere for the clocks to live and no
 *     config to have opted in.
 *  3. **A config that will not parse.** A user who mistyped a comma has turned
 *     this feature off, not broken their session.
 *
 * `deps` and `now` are injected for tests and passed by nothing in production —
 * `ui-server-upkeep.ts` argues both where they are declared.
 *
 * Never throws (`INV-hooks-fail-open`). The stand-down disclosure is written
 * here rather than returned because `upkeepUiServer` reports `stood-down` on
 * exactly one call, which makes writing it on that call the same "say it once"
 * the occupancy stand-down achieves with a latch.
 */
export async function stopUpkeep(
  input: HookInput, deps: UpkeepDeps = {}, now: number = Date.now(),
): Promise<Upkeep | null> {
  try {
    if (input.agent_id !== undefined) return null;
    const root = findProjectRoot(input.cwd ?? process.cwd());
    if (root === null) return null;
    const config = workspaceConfigAt(root);
    if (config === null) return null;

    const upkeep = await upkeepUiServer(root, config, now, deps);
    if (upkeep.did === 'stood-down') {
      process.stderr.write(upkeepStandDownLine(upkeep.failures, root));
    }
    return upkeep;
  } catch {
    return null;
  }
}

/**
 * The whole binary: the upkeep, then the observation.
 *
 * **`runObservationHook`'s body, with one `await` in front of it**, and the
 * duplication is the point rather than an oversight. That helper exists because
 * the ten observation hooks make the SAME decisions about the reader, the timer
 * and the envelope — its header says so — and this hook now makes a different
 * one: it has an asynchronous step that must complete before the row is
 * written. The six older binaries are each unfolded for the same class of
 * reason. What is NOT duplicated is the part that matters: the parse
 * disclosure, the recording and the envelope all still run through
 * `observeAndRecord`, so there is still exactly one implementation of them.
 *
 * The upkeep runs FIRST because its outcome has to reach the note, and the
 * whole of it — a state read, a small file read and one loopback connect — is
 * bounded well inside the 3-second timeout the platform genuinely waits on
 * here. `probeUiServer` carries its own 250ms cap, and the spawn is detached
 * and unref'd so it cannot hold this process open.
 *
 * `process.cwd()` is the fallback for `input.cwd` in both halves, so the upkeep
 * and the audit row cannot resolve to two different workspaces.
 */
export async function runStopHook(): Promise<void> {
  try {
    const { input, parseError } = parseHookInput(readStdin());
    if (parseError !== null) process.stderr.write(hookParseErrorLine(parseError));
    const upkeep = await stopUpkeep(input);
    const { stdout } = observeAndRecord(stopSpec(upkeep), input, process.cwd());
    // Guarded rather than written unconditionally: this is `''` on all but at
    // most one turn of a session, and an unconditional `write('')` on a closed
    // or absent stdout is a throw on a path whose whole job is not to have one.
    if (stdout !== '') process.stdout.write(stdout);
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}

if (isMainEntry(import.meta.filename, process.argv[1])) void runStopHook();
