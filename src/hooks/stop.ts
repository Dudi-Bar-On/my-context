import { handoverThresholdPercent } from '../core/config.ts';
import {
  occupancyStandDownLine, readOccupancy, type UnmeasurableWhy,
} from '../core/context-occupancy.ts';
import {
  askStep, checkHandoverAsk, handoverConfigAt, readLatch, workspaceConfigAt, writeLatch,
  type AskLatch, type HandoverAskVerdict,
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
 *  2. **At most once per WHOLE PERCENT of occupancy**, latched on disk before
 *     the ask is returned. A blind repeat arrives after the model has just
 *     written the handover, and then again next turn, and the turn after: a
 *     per-turn hook that repeats is not a verbose feature, it is a session that
 *     cannot finish. This is the most expensive bug the design can ship and the
 *     latch is the only thing standing between it and the product.
 *
 *     `seq:9` raised the bound from one ask to two and paid for the raise with
 *     a measurement rather than an argument. `seq:12` REPLACED the count with a
 *     percentage step, on the owner's instruction of 2026-09-06 and on this
 *     corpus's own measurements: two asks and then silence left the handover
 *     describing the window as it was at 85% while it filled to 99.9% over the
 *     next two hours and thirty-nine minutes. The bound is still a bound — the
 *     same whole percent is never asked at twice, and a window can produce at
 *     most `100 - threshold` asks — but what earns the next one is ten thousand
 *     tokens of new work rather than a turn having passed. `askStep` carries
 *     the argument and the instruction verbatim.
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
 * The ask that follows one the model was measured to have IGNORED.
 *
 * It exists at all only because the earlier one can be shown to have failed:
 * `checkHandoverAsk` compared the handover's mtime against the moment that ask
 * went out and found the file untouched. Repeating an ask you cannot verify is
 * nagging; repeating one you have measured as unanswered is the mechanism
 * working.
 *
 * **It NAMES the ask it follows, and that is a requirement rather than a
 * courtesy.** A paragraph that reads identically to the last one is
 * indistinguishable from a hook that lost its latch, which is the most
 * expensive bug this design can ship — so the text has to say, in the model's
 * own context, that this is a repeat and why.
 *
 * **What it no longer says is *the last time*, and that is `seq:12`.** It said
 * so because `MAX_ASKS` was 2 and it was true; with the bound now a percentage
 * step it would be a lie, and a deadline a model discovers was false is worth
 * less than no deadline at all. The urgency it carried is carried instead by
 * the fact that is still true on every one of these turns: this turn is the one
 * you have, because the next percent may be the compaction.
 */
function repeatAskText(
  handoverPath: string, percent: number, previousAskedAt: string | null,
): string {
  return (
    `The context window is ${percent.toFixed(1)}% full and ${handoverPath} has NOT been ` +
    'written since you were asked to update it' +
    (previousAskedAt === null ? '' : ` at ${previousAskedAt}`) +
    '. Update it NOW: what you were doing, what you decided and why, and what the next ' +
    'session must do first. You have this turn. Nothing else carries across.'
  );
}

/**
 * The ask at a percent the window has GROWN into, when the handover was in fact
 * brought up to date last time.
 *
 * This is the paragraph `seq:12` exists to deliver and the one the old design
 * could not: the handover is not missing, it is BEHIND — it describes the
 * window as it stood a percent ago, and a percent of a 1M window is roughly ten
 * thousand tokens of work it does not mention.
 *
 * **It says the file was written and it still asks**, in that order, because
 * the alternative reads as a hook that forgot. A model told to update a
 * document it knows it just wrote will reasonably conclude the mechanism is
 * broken and start ignoring it, and an instruction a model has learned to
 * ignore is worse than one that never arrives.
 */
function stepAskText(
  handoverPath: string, percent: number, step: number, lastPercent: number | null,
  verified: boolean,
): string {
  // `step`, never `percent.toFixed(0)`: rounding would report 86.7% as having
  // passed 87, which is a percent the window has not reached and a number the
  // latch does not hold. The whole percent is `askStep`'s to decide and it is
  // passed in rather than recomputed here, so the paragraph and the latch can
  // never disagree about which step this ask belongs to.
  return (
    `The context window is ${percent.toFixed(1)}% full — it has passed ${step}%, and ` +
    `${handoverPath} was last asked for` +
    (lastPercent === null ? '' : ` at ${lastPercent}%`) + '. ' +
    (verified
      ? 'You updated it then, so it is now a whole percent behind: '
      : 'Whether it was updated then could not be verified: ') +
    'everything you have done since is not in it. Bring it up to date NOW — what you were ' +
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
 *  5. **No PROGRESS since the last ask.** The whole percent this occupancy
 *     falls in is the one already asked at, and the threshold has not been
 *     lowered — so there is nothing new to ask about. A pure comparison against
 *     two numbers the latch already carries, and it is what keeps the ordinary
 *     post-ask turn at one latch read and no filesystem work at all.
 *  6. **Which ask this is.** Only turns that are ABOUT to ask get here, so the
 *     `stat` runs at most once per whole percent rather than once per turn.
 *     `checkHandoverAsk` compares the handover's mtime against `askedAt` — see
 *     `core/handover-ask.ts` — and its verdict chooses the paragraph, never
 *     whether to speak: `ignored` names the ask that went unanswered,
 *     `acted-on` says the file is a percent behind, and `unverifiable` says
 *     neither, because an accusation nothing supports is the same defect as a
 *     guarantee nothing supports.
 *
 * ── WHAT `seq:12` CHANGED, AND WHAT IT DID NOT ─────────────────────────────
 *
 * `seq:9` made the latch mean *asked and NOT YET SATISFIED*, and `satisfied`
 * then silenced the mechanism for the rest of the window. That is the defect
 * the owner ruled on: measured on this corpus, an ask answered at 85.1% was
 * followed by two hours and thirty-nine minutes in which the window filled to
 * 99.9% and nothing asked again, and the audit row for all of it said
 * `acted-on`. **`acted-on` proves ordering, not currency.**
 *
 * So the suppression is now `askedAtPercent` and it lasts exactly one whole
 * percent. What did NOT change: an ask that was answered is never repeated
 * about the SAME state — that was `MAX_ASKS`'s real argument and gate 5 keeps
 * it — and a window still cannot produce more asks than there are percentage
 * points between the threshold and 100.
 *
 * **The threshold rule survives intact.** Lowering `thresholdPercent`
 * mid-session is a user saying *ask me sooner than that*, and it re-arms even
 * inside a percent already asked at. Raising it is not a request for anything
 * and re-arms nothing. That asymmetry is computed BEFORE gate 5 so that a user
 * who moves the target is answered on the turn they move it.
 *
 * Never throws: every filesystem call below is already wrapped, and
 * `readOccupancy` is documented as never throwing. That matters here more than
 * on most paths — `ObservationSpec.observe` says a builder that relies on
 * `observeAndRecord`'s catch has given up its own disclosure, and this builder
 * has a disclosure.
 */
function handoverAsk(
  input: HookInput, root: string,
): {
  percent: number;
  text: string;
  /** The verdict on the ask this one follows, or `null` for a window's first. */
  previous: HandoverAskVerdict | null;
  /** When the ask this one follows went out, or `null` for a window's first. */
  previousAskedAt: string | null;
} | null {
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

  // The whole percent this reading belongs to, clamped at 100 and `null` for a
  // reading that is not a number — see `askStep`, which carries the owner's
  // instruction and the reason a non-finite reading must never read as "not yet
  // asked at this step".
  const step = askStep(occupancy.percent);
  if (step === null) return null;

  const latch = readLatch(root, sessionId);

  // Lowering is an instruction; raising is not. Unchanged from seq:6, and it is
  // deliberately computed BEFORE the progress gate so that a user who moves the
  // target is answered on the turn they move it, inside a percent already asked
  // at.
  const lowered = latch.askedAtThreshold !== null && threshold < latch.askedAtThreshold;

  // THE BOUND, and it is the whole of seq:12. A percent already asked at is the
  // same state, and asking twice about the same state teaches nothing — which
  // is what `MAX_ASKS` was really defending. A percent the window has GROWN
  // into is new work, and it is what earns the next ask.
  //
  // First, and before any filesystem work beyond the latch itself: this is the
  // gate that runs on every turn of a full window, so it is two comparisons
  // against numbers already in hand and never a `stat`.
  if (latch.askedAtPercent !== null && step <= latch.askedAtPercent && !lowered) return null;

  // Gate 6. Reached only on a turn that is about to ask, so the comparison
  // costs one inode read per whole percent rather than one per turn. The
  // verdict chooses the PARAGRAPH and never whether to speak — the ask has
  // already been earned by progress, and a window that grew a percent is a
  // window whose handover is behind whatever the last ask came to.
  const previous: HandoverAskVerdict | null = latch.askedAt === null
    ? null
    : checkHandoverAsk(root, handover, sessionId).verdict;

  // Recorded even though the ask below is about to supersede it. It is the only
  // durable record that the ask made at `latch.askedAt` was answered, and if
  // the write below fails it is the state the next turn reads — which is the
  // same reason `seq:9` wrote it here and did not gate on the write.
  if (previous === 'acted-on') writeLatch(root, sessionId, { ...latch, satisfied: true });

  // Latched BEFORE the ask is returned, never after. The caller writes the
  // envelope and the audit row afterwards and either of those can fail; if the
  // latch were taken last, a failure between here and there would leave the
  // session armed and the model asked, which is the loop.
  //
  // `satisfied` is `false` for the ask now going out, because a new ask is a
  // new thing to satisfy. `askedAt` is stamped here — the same instant the ask
  // becomes real — so that no write that happened BEFORE this moment can be
  // mistaken for a response to it, and `askedAtPercent` is the percent that
  // has now been spoken for.
  const next: AskLatch = {
    ...latch,
    askedAtThreshold: threshold,
    askedAtPercent: step,
    askedAt: new Date().toISOString(),
    asks: latch.asks + 1,
    satisfied: false,
  };
  if (!writeLatch(root, sessionId, next)) return null;

  return {
    percent: occupancy.percent,
    previous,
    previousAskedAt: latch.askedAt,
    text: askParagraph(handover.path, occupancy.percent, step, latch, previous),
  };
}

/**
 * Which of the three paragraphs this ask is, and it is decided by the verdict
 * on the ask before it rather than by a counter.
 *
 * The first ask of a window says what the mechanism has always said. After
 * that, the model is told the truth about the document it is being asked to
 * write again — untouched, a percent behind, or in a state that could not be
 * read — because an instruction that ignores what the model knows it just did
 * is one it learns to ignore back.
 *
 * `off` and `not-asked` cannot reach here (the handover is configured and
 * `askedAt` was non-null), and they fall to the first paragraph rather than to
 * a `default` that would read as a fourth case nobody wrote.
 */
function askParagraph(
  handoverPath: string, percent: number, step: number, latch: AskLatch,
  previous: HandoverAskVerdict | null,
): string {
  if (previous === 'ignored') return repeatAskText(handoverPath, percent, latch.askedAt);
  if (previous === 'acted-on' || previous === 'unverifiable') {
    return stepAskText(
      handoverPath, percent, step, latch.askedAtPercent, previous === 'acted-on',
    );
  }
  return askText(handoverPath, percent);
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
 * that makes the log unreadable. What is left is the events a human would want
 * to find later: a server being put back, a server being REPLACED because it
 * was serving code older than the disk, and the mechanism giving up.
 *
 * **A restart gets its own clause and not the spawn's** (2026-09-02). The two
 * describe opposite situations — nothing was answering, versus something was
 * answering and was wrong — and a row that reported them alike would be a
 * restart nobody could explain afterwards. The clause names the reason in the
 * same breath as the act, so the log line is readable without the state file
 * beside it.
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
  if (upkeep.did === 'restarted') {
    return `; the UI server on port ${upkeep.port} reported its own code stale, so it was `
      + 'stopped and started again';
  }
  if (upkeep.did === 'stood-down') {
    const after = upkeep.why === 'stale'
      ? `${upkeep.failures} restarts that left it still serving stale code`
      : `${upkeep.failures} failed spawns`;
    return `; the UI server upkeep stood down after ${after}`;
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
  //
  // A repeat says so IN THE ROW, not only in the model's context. An ask that
  // was ignored and an ask that was acted on have to be distinguishable in the
  // log without reading the handover — that is `seq:9`'s DONE WHEN — and with
  // `seq:12` a window now carries up to fifteen asks instead of two, so the row
  // has to say WHICH ask each verdict belongs to as well. `askVerdictClause`
  // names the previous ask by its own timestamp for exactly that: without it,
  // "the previous ask went unanswered" in a run of fifteen rows would be a
  // sentence no reader could attach to anything.
  return ask === null
    ? { note: base }
    : {
        note: `${base}; asked${ask.previous === null ? '' : ' AGAIN'} for a handover update at ` +
          `${ask.percent.toFixed(1)}% occupancy` +
          askVerdictClause(ask.previous, ask.previousAskedAt),
        context: ask.text,
      };
}

/**
 * What the row says about the ask this one FOLLOWS, or `''` for a window's
 * first ask, which follows nothing.
 *
 * Three verdicts can reach it and they are kept apart on the row for the reason
 * `HandoverAskVerdict` keeps them apart at all: `ignored` is an accusation,
 * `acted-on` is the mechanism working, and `unverifiable` is a comparison that
 * could not be made. Collapsing the third into the first would put an
 * accusation in the log that nothing supports.
 */
function askVerdictClause(
  previous: HandoverAskVerdict | null, previousAskedAt: string | null,
): string {
  if (previous === null) return '';
  const which = previousAskedAt === null ? 'the previous ask' : `the ask at ${previousAskedAt}`;
  if (previous === 'ignored') return ` — ${which} went unanswered`;
  if (previous === 'acted-on') {
    return ` — ${which} was acted on, and the window has grown a whole percent since`;
  }
  if (previous === 'unverifiable') {
    return ` — whether ${which} was acted on could not be determined`;
  }
  return '';
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
      process.stderr.write(upkeepStandDownLine(upkeep.failures, root, upkeep.why));
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
