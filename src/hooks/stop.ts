import { handoverAskMuted, handoverThresholdPercent } from '../core/config.ts';
import {
  ConversationIndex, ConversationIndexIncompleteError, rebuildConversations,
  type RebuildReport,
} from '../core/conversation-index.ts';
import { advanceMirrors, type MirrorReport } from '../core/conversation-mirror.ts';
import { reconcileAnchors, type AnchorReconcile } from '../core/anchor-file.ts';
import {
  occupancyStandDownLine, readOccupancy, type UnmeasurableWhy,
} from '../core/context-occupancy.ts';
import {
  askBand, askPlan, checkHandoverAsk, compositionDirective, handoverConfigAt, readLatch,
  workspaceConfigAt, writeLatch,
  type AskLatch, type HandoverAskVerdict,
} from '../core/handover-ask.ts';
import { isMainEntry } from '../core/paths.ts';
import {
  upkeepStandDownLine, upkeepUiServer, type Upkeep, type UpkeepDeps,
} from '../core/ui-server-upkeep.ts';
import { findProjectRoot } from '../core/workspace.ts';
import { reviewNote, reviewTrigger, type TriggerVerdict } from '../review/trigger.ts';
import path from 'node:path';
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
 * ── AND IT NOW CARRIES A SECOND UPKEEP, WHICH IS NOT A THIRD PURPOSE ──────
 *
 * `stopConversationRefresh` (`plan:archive seq:14`) brings the conversation
 * index up to date with the transcript on disk, once per turn, beside the
 * UI-server upkeep that was already here. It is the SAME KIND of thing as that
 * one: work nobody types, done at the only boundary that fires once per
 * exchange, reported in the note and never in the envelope. It is emphatically
 * not `Stop` gaining a second thing to SAY —
 * `DEC-stop-speaks-once-and-only-to-raise-the-handover` is untouched, and the
 * only place a refresh appears is the audit row.
 *
 * Why here at all: `rebuildConversations` had exactly one caller, a person
 * typing a command, so the archive screen served whatever that last manual run
 * had left. Measured 2026-09-08, it had left an index over a day and
 * 11,231,042 bytes behind the owner's own live session. The function's own
 * header carries the three sites that were refused and why.
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
 *  2b. **The ask is MUTED** — `thresholdPercent: "never"`, `plan:handover
 *     seq:11`. A third state of the threshold rather than a switch beside it,
 *     and it silences THIS gate only: the handover is still delivered, and a
 *     person can still ask for one on demand. It sits with gate 2 because it
 *     buys gate 2's two properties — no further file reads, and nothing said on
 *     stderr about a mechanism the user has switched off.
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

  // ── GATE 2b: THE ASK IS MUTED — `plan:handover seq:11` ────────────────────
  //
  // `thresholdPercent: "never"`, and this is the one place in the product that
  // acts on it. It sits with gate 2 rather than beside the threshold comparison
  // below for gate 2's own reasons, both of which apply unchanged: a workspace
  // that has muted the ask does no occupancy read, writes no latch and — the
  // half that would otherwise be a defect — never writes the stand-down line,
  // which asks the user to go and install a status-line bridge for a mechanism
  // they have just switched off.
  //
  // **What is NOT gated here, and it is the constraint the whole third state is
  // shaped around.** The DELIVERY is untouched: the continuity tier still hands
  // the marked section to a new session, because nothing in that path reads a
  // threshold. And the ON-DEMAND ask is untouched: `askHandoverNow` does not
  // call `handoverAskMuted` and must not, so a person who muted the automatic
  // ask can still type `mycontext handover ask` and get exactly the ask they
  // asked for. That asymmetry is the item's load-bearing sentence — a person
  // asking explicitly is not the thing being muted — and it only holds while
  // this gate lives in `Stop` rather than in `core/handover-ask.ts`.
  if (handoverAskMuted(handover)) return null;

  const occupancy = readOccupancy(root, sessionId);
  if (occupancy.state !== 'known') {
    standDownOnce(root, sessionId, occupancy.why);
    return null;
  }

  // Through the resolver, never `handover.thresholdPercent` directly: absent
  // means the user never chose one, and 98 is what an unchosen threshold means
  // (`core/config.ts` argues both halves where they are declared).
  const threshold = handoverThresholdPercent(handover);
  // `null` is the MUTE and nothing else, and gate 2b above has already returned
  // on it. This line is the compiler being shown that rather than a second gate:
  // `handoverThresholdPercent` answers `number | null` precisely so that no
  // caller can compare a threshold that does not exist with `<`, and a hook that
  // silently fell back to 98 here would ask a user who wrote `"never"`.
  if (threshold === null) return null;
  if (occupancy.percent < threshold) return null;

  // The BAND this reading belongs to, clamped at 100 and `null` for a reading
  // that is not a number — `plan:handover seq:19`, and `askBand` carries the
  // owner's ruling, the measurement behind it, and the reason a non-finite
  // reading must never read as "not yet asked at this step".
  //
  // `askBand` and not `askStep`, and the two are deliberately still separate.
  // A band is an OCCASION TO ASK; a step is WHICH WHOLE PERCENT THIS IS, and the
  // second is what `handoverLag`, the strip and the browser twin in
  // `ui/public/lib/viewmodel.js` subtract to say how far behind the standing
  // handover is. Every band is itself a whole percent, so the latch still holds
  // one and everything that only compares steps for equality — `readLatch`'s
  // normalisation, `lastRecordedAsk`, the audit row — is untouched.
  const step = askBand(occupancy.percent);
  if (step === null) return null;

  // What KIND of block this ask wants and who composes it — `seq:19`'s second
  // half. Computed here, beside the band it is derived from, so the paragraph
  // and the schedule cannot disagree about which ask this is.
  const plan = askPlan(occupancy.percent, threshold);

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
    // The paragraph says WHY this turn is being interrupted; the directive says
    // what the interruption is asking for and who writes it. They are appended
    // rather than woven together because they answer to different rulings — the
    // three paragraphs are `seq:12`'s and are chosen by the verdict on the last
    // ask, the directive is `seq:19`'s and is chosen by where in the schedule
    // this ask sits. A `null` plan cannot happen on this line (the band above is
    // non-null, so `askPlan` over the same reading is too) and is still handled:
    // an ask that loses its directive is worth less than one, never nothing.
    text: askParagraph(handover.path, occupancy.percent, step, latch, previous)
      + (plan === null ? '' : compositionDirective(plan)),
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
  return actClause(upkeep) + discardedWriteClause(upkeep);
}

/** What the upkeep DID, or `''` — the clause `upkeepNote` has always written. */
function actClause(upkeep: Upkeep): string {
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

/**
 * **A state write the upkeep threw away, said out loud once** —
 * `plan:governance seq:4`.
 *
 * The discard is deliberate and stays deliberate: `writeState` explains why a
 * lost clock costs one extra spawn attempt and nothing more. What that item
 * disputed is that it was INVISIBLE — nothing counted it, and the only trace
 * was an orphaned temp file in a gitignored directory nobody reads. Nine of
 * them accumulated over three days without anyone noticing, and the reason that
 * matters is the RATE: three a day is a healthy mechanism, three thousand is a
 * spawn floor that has stopped holding, and from outside the two looked
 * identical.
 *
 * **It appends even when `actClause` is empty**, which is the ordinary case: the
 * turns where a write is discarded are overwhelmingly `alive` and `too-soon`
 * turns, and a clause that only rode along with a spawn would miss almost all of
 * them. That is a departure from `upkeepNote`'s rule that only what HAPPENED is
 * reported, and it is within the rule rather than against it — a failed write is
 * something that happened, it is rare (three rows a day on the measurement
 * above), and if it ever stops being rare that is the alarm this exists to ring.
 *
 * The file is NAMED so that the sentence can be counted mechanically: the rate
 * is recovered by counting the rows that carry it, which is what nothing could
 * do while the only record was a file count.
 */
function discardedWriteClause(upkeep: Upkeep): string {
  if (upkeep.stateWriteDiscarded !== true) return '';
  return '; the UI server upkeep could not record its own state this turn — the write to '
    + 'state/ui-server-upkeep.json was discarded by design, so the next call re-derives its '
    + 'clocks and may spawn one more time than the floor would have allowed';
}

export function observeStop(
  input: HookInput, root: string, upkeep: Upkeep | null = null,
  refresh: ConversationRefresh | null = null,
  review: TriggerVerdict | null = null,
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
    upkeepNote(upkeep) + refreshNote(refresh) + reviewClause(review);

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
export function stopSpec(
  upkeep: Upkeep | null, refresh: ConversationRefresh | null = null,
  review: TriggerVerdict | null = null,
): ObservationSpec {
  return {
    hook: 'Stop',
    op: 'stop',
    observe: (input, root) => observeStop(input, root, upkeep, refresh, review),
  };
}

/**
 * The review trigger's clause, prefixed for the row — `''` when the subsystem
 * is off, which today is every workspace.
 *
 * A separate function from `reviewNote` because the SEPARATOR belongs to this
 * row's grammar and not to the trigger: `reviewNote` is also read by
 * `PreCompact`, whose row is built differently, and a `; ` baked into the
 * trigger would put a stray semicolon there.
 */
function reviewClause(decision: TriggerVerdict | null): string {
  const note = reviewNote(decision);
  return note === '' ? '' : `; ${note}`;
}

export const STOP: ObservationSpec = stopSpec(null);

/**
 * How long this hook will wait for another writer to let go of `.index.db`
 * before giving up on the refresh for this turn.
 *
 * **Not the CLI's three seconds**, and the difference is the whole reason the
 * option exists. `runStopHook` runs inside a timeout the platform enforces, and
 * the upkeep beside it already spends up to 250 ms on a probe; a refresh that
 * blocked three seconds on a lock would turn a contended index into a hook that
 * misses its window on every turn. 300 ms is long enough to outlast the write
 * this actually contends with — another `Stop` in a sibling session, whose own
 * transaction is a handful of upserts — and short enough that losing the race
 * costs a turn's latency rather than the turn.
 *
 * **Losing it costs nothing that is not recovered.** The transcript is
 * append-only and the index records where it stopped, so a refresh skipped now
 * is a slightly longer tail read next turn. That is the property that makes
 * "give up quickly" the right answer here and would make it the wrong answer
 * for a write that had to land.
 */
export const REFRESH_BUSY_TIMEOUT_MS = 300;

/**
 * **Bring the conversation index up to date with the transcript on disk, once
 * per assistant turn** — `plan:archive seq:14`.
 *
 * ── WHY THIS HOOK, AND WHAT WAS REJECTED TO GET HERE ───────────────────────
 *
 * Until this landed, `rebuildConversations` had exactly ONE caller: `mycontext
 * conversation rebuild`, typed by a person. The archive screen serves the
 * INDEX and not the file, so it showed whatever that last manual run had left.
 * Measured 2026-09-08: the index said the owner's session ended
 * `2026-09-07T00:50` while the transcript was 65,046,326 bytes and had been
 * written that minute — **11,231,042 bytes and over a day behind**, with
 * `plan:restore` and the self-improvement loop reading the same rows.
 *
 * Four sites were available and three were refused:
 *
 *   - **On opening the screen.** It is the obvious one and it is the one the
 *     project cannot have. `ConversationIndex.open` creates tables, which is a
 *     write; `test/ui/no-writes.test.ts` holds the write bindings under
 *     `src/ui/` to an EXACT set of one, and `test/ui/server-e2e.test.ts`
 *     asserts a served read changes not one byte of the corpus. Both would go
 *     red, and both are right to.
 *   - **The UI-server upkeep** (`core/ui-server-upkeep.ts`), which already
 *     rides this same hook. Refused on SCOPE: that pass reads nothing, probes
 *     nothing and writes nothing unless `ui.port` is set, and that opt-in is a
 *     deliberate safety call about spawning a server. The conversation index is
 *     read by `plan:restore` and by the loop with the web UI switched off
 *     entirely, so gating its freshness on a server's opt-in would leave the
 *     loop learning from a stale transcript in exactly the configuration where
 *     nobody is looking at a screen that could say so.
 *   - **`SessionEnd`.** It cannot fix the defect that was reported. The stale
 *     session was the owner's OWN, still running, which is the one session a
 *     hook at the end of a session never reaches. It would leave the live row
 *     — the only one anybody reads while working — permanently the most stale
 *     row in the archive.
 *
 * `Stop` is what is left, and it is not a residue: it is the one boundary in
 * this product that fires once per exchange in the parent session, it already
 * resolves the workspace and its config here, and one turn is the interval at
 * which "how far behind is the screen" stops being a question anybody asks.
 *
 * ── WHY IT IS AFFORDABLE, WHICH IS A MEASUREMENT AND NOT A HOPE ────────────
 *
 * `rebuildConversations` skips a file whose size and mtime match its row after
 * one `stat` — 0.449 ms for this project's whole transcript directory — and
 * reads only the APPENDED TAIL of one that has grown. So the cost is
 * proportional to what the turn actually wrote, which is a few kilobytes,
 * rather than to the 65 MB the file holds. There is no clock file and no floor
 * beside it, deliberately: a floor would be a second mechanism to explain, and
 * the work here is already bounded by the thing it is a function of.
 *
 * ── THE ONE GATE, AND WHY IT IS NOT "IF THERE IS A WORKSPACE" ──────────────
 *
 * It refreshes an index that ALREADY EXISTS and never creates one.
 * `openReadOnlyChecked` is the door that answers that without writing, and its
 * `ConversationIndexUninitializedError` is the exact "nobody has ever scanned
 * here" state. A hook that built the index on first use would silently opt
 * every workspace with this plugin installed into indexing its transcripts,
 * which is a decision belonging to a person and to a different item — and it
 * would also make a damaged index something a background hook quietly
 * rewrites, which `openReadOnlyChecked` refuses on purpose.
 *
 * Subagents decline for `stopUpkeep`'s reason, quoted rather than re-argued: a
 * fan-out of ten finishing at once is ten writers reaching for one SQLite file
 * inside one second, and `agent_id` is the only discriminator on the payload.
 *
 * Never throws (`INV-hooks-fail-open`). A refresh that failed is a turn whose
 * tail is read next turn instead.
 */
/**
 * What one turn's refresh did — the index scan, and the mirrors beside it.
 *
 * One value rather than two returns because they are one turn's worth of
 * upkeep and `refreshNote` writes one clause about it. `mirror` is `null` when
 * the mirror pass itself failed, which is a different fact from a pass that
 * found nothing to do (`marked: 0`) and must not read as one —
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`.
 */
export type ConversationRefresh = RebuildReport & {
  mirror?: MirrorReport | null;
  /**
   * What the anchors reconciliation did, or `null` when it failed — the same
   * distinction `mirror` draws, and for the same reason: a pass that found
   * nothing to do is not a pass that could not run.
   */
  anchors?: AnchorReconcile | null;
};

export function stopConversationRefresh(input: HookInput): ConversationRefresh | null {
  try {
    if (input.agent_id !== undefined) return null;
    const root = findProjectRoot(input.cwd ?? process.cwd());
    if (root === null) return null;
    const dbPath = path.join(root, '.index.db');

    // The gate. `openReadOnlyChecked` creates nothing, migrates nothing and
    // repairs nothing, so this asks "has anybody scanned here" without
    // becoming the answer to it.
    //
    // ── AND "A SCHEMA BEHIND" COUNTS AS EXISTING. THIS IS THE MIGRATION ────
    //
    // `ConversationIndexIncompleteError` is an index that HAS `conversations`
    // and lacks a table a later build added — every workspace in the world,
    // the moment `plan:archive seq:12` ships. It is the answer "yes, somebody
    // has scanned here", so it passes the gate, and `rebuildConversations`
    // then opens for WRITE and its `CREATE TABLE IF NOT EXISTS` fills the gap
    // on the next assistant turn.
    //
    // **This is not the gate being weakened; it is the gate being able to tell
    // its two cases apart.** The refusal stays exactly as loud for a genuinely
    // damaged index — an index holding `subagents` and no `conversations` is
    // still an `Error` and still declines here — and `Uninitialized` still
    // declines, so a workspace nobody has ever scanned is still never opted in
    // by a background hook. What changed is that "old" stopped being reported
    // as "damaged".
    //
    // **Measured cost of NOT doing this, on the owner's own running server,
    // 2026-09-08:** the sessions list drew no files and printed the refusal
    // verbatim, and there was no way out but a command the reader had to
    // already know. Worse, the path was self-sealing: this gate caught the
    // throw and returned `null`, so the automatic refresh stopped for good —
    // and the automatic refresh is the only thing that would have created the
    // missing table. An index frozen at the byte it reached on upgrade day is
    // precisely the defect `plan:archive seq:14` exists to end.
    //
    // The alternative — migrating on the READ open — is not available and that
    // is deliberate rather than awkward: `openReadOnlyChecked` may not write,
    // `test/ui/no-writes.test.ts` holds the UI's write bindings to an exact
    // set, and a read surface that repaired its own cache is the read-only
    // guarantee failing where a new feature most wants it to. So the repair
    // belongs to a writer, and this hook is the only writer that runs by
    // itself.
    try {
      ConversationIndex.openReadOnlyChecked(dbPath).close();
    } catch (err) {
      if (!(err instanceof ConversationIndexIncompleteError)) return null;
    }

    const report = rebuildConversations(dbPath, process.env, path.dirname(root), {
      busyTimeoutMs: REFRESH_BUSY_TIMEOUT_MS,
    });
    // ── THE MIRRORS, ON THE SAME TURN AND FOR THE SAME REASON ────────────
    //
    // `plan:archive seq:4`. The owner's ruling is that a session marked to be
    // kept must be kept CURRENT — *"EVERY CHANGE IN A SESSION FILE SHOULD ALSO
    // BE WRITTEN TO ITS PERSISTENT EXTERNAL FILE IN ORDER NOT TO LOSE
    // CONTENT."* A mark is worthless if nothing acts on it, and this is the
    // only writer in this product that runs by itself.
    //
    // **It is affordable for the reason the refresh above is**: a transcript
    // only appends, so a marked session costs one `stat` when it has not
    // moved and a write of the SAME delta the scan has just read when it has.
    // A workspace with no marks costs one query of an empty table.
    //
    // AFTER the refresh, never inside it: `rebuildConversations` writes only
    // through `node:sqlite` and `test/ui/no-writes.test.ts` names it in
    // `WRITES_WITHOUT_FS` on exactly that basis, so the filesystem write is a
    // separate module composed here.
    //
    // Its own `try`, because the two failures are different: a refresh that
    // threw has left the index behind by one turn and the next turn fixes it,
    // while a mirror that threw must not cost the refresh its report.
    let mirror: MirrorReport | null = null;
    try {
      mirror = advanceMirrors(dbPath, process.env, path.dirname(root), {
        busyTimeoutMs: REFRESH_BUSY_TIMEOUT_MS,
      });
    } catch {
      mirror = null;
    }

    // ── THE ANCHORS, AND WHY THEY ARE RECONCILED HERE ────────────────────
    //
    // `plan:recall seq:6`, owner ruling *"file as truth, go with it"*. The
    // `anchors` table is the one thing in `.index.db` that no rebuild can
    // re-derive; `.my_context/.anchors.jsonl` is the durable copy and the
    // table is rebuilt from it.
    //
    // **This hook is the only writer that runs by itself**, which is what the
    // adoption needs: a corpus whose table holds bookmarks and whose file does
    // not exist yet — every corpus in the world the moment this ships, his 565
    // included — is written into one HERE, without him running anything. On
    // every later turn this is the re-derive, so an index deleted between two
    // turns comes back whole on the next one.
    //
    // Composed after the refresh and in its own `try`, for both of
    // `advanceMirrors`' reasons: `rebuildConversations` writes only through
    // `node:sqlite` and must stay that way, and a failure here must not cost
    // the refresh its report. A reconciliation that threw leaves the file
    // exactly as it was — it is renamed into place or not at all — and the
    // next turn tries again.
    let anchors: AnchorReconcile | null = null;
    try {
      const index = ConversationIndex.open(dbPath, REFRESH_BUSY_TIMEOUT_MS);
      try {
        anchors = reconcileAnchors(index);
      } finally {
        index.close();
      }
    } catch {
      anchors = null;
    }
    return { ...report, mirror, anchors };
  } catch {
    return null;
  }
}

/**
 * What the conversation refresh contributes to the audit row, and it is `''`
 * on the overwhelming majority of turns.
 *
 * **Only when the index actually MOVED.** `upkeepNote`'s rule, for
 * `upkeepNote`'s reason: `Stop` fires on every assistant turn, and a clause
 * that appended on every one would put a per-turn "still up to date" report
 * into the one log line that says where an exchange ended. A tail that was
 * read, a transcript re-read whole, and a row dropped because its file is gone
 * are all things a person would want to find later; "nothing had changed" is
 * not.
 *
 * The BYTES are named and not only the count, because the number is the whole
 * argument for doing this per turn at all: a row that says `read 43,118 bytes`
 * is a row that shows the append-only path working, and a run of rows saying
 * `read 65,046,326 bytes` would be the same mechanism having quietly fallen
 * back to whole re-reads on every turn — which is a defect nothing else would
 * report.
 */
export function refreshNote(report: ConversationRefresh | null): string {
  if (report === null) return '';
  // **The lanes count as movement.** They have to be in this sum and not only
  // in the clause below: a turn in which the session's own transcript was
  // unchanged while two lanes ran and finished is a turn on which something
  // genuinely happened, and gating on the session's numbers alone would report
  // it as "nothing had changed". Caught by the test below rather than by
  // reading, which is why the assertion for it names this sentence.
  const agentsMoved = report.subagents.scanned + report.subagents.appended
    + report.subagents.removed;
  // **The mirrors count as movement too, on the same rule** (`plan:archive
  // seq:4`). A turn that copied bytes out of the harness's directory on the
  // owner's standing instruction is a turn a person would want to find later;
  // "every mirror was already current" is not. `marked > 0` alone is NOT
  // movement, for that exact reason.
  const mirror = report.mirror ?? null;
  const mirrorMoved = mirror === null ? 0
    : mirror.advanced + mirror.orphaned.length + mirror.broken.length + mirror.cleared.length;
  const moved = report.appended + report.scanned + report.removed + agentsMoved + mirrorMoved;
  if (moved === 0) return '';
  const parts: string[] = [];
  if (report.appended > 0) {
    parts.push(`${report.appended} transcript(s) had grown and only the appended tail was read`);
  }
  if (report.scanned > 0) parts.push(`${report.scanned} transcript(s) were read whole`);
  if (report.removed > 0) parts.push(`${report.removed} indexed session(s) no longer on disk`);
  // The lanes, on the same rule and for the same reason (`plan:archive
  // seq:12`). A subagent transcript is FINISHED when its lane returns, so in
  // the steady state this clause is absent and its appearance means lanes ran
  // during that turn — which is the fact a reader is looking for. Their bytes
  // are named separately from the session's because they are a separate
  // budget: 615.3 MB across 253 lanes here against 65 MB of session, so one
  // total would hide which of the two a slow turn paid for.
  const agents = report.subagents;
  if (agentsMoved > 0) {
    const lanes: string[] = [];
    if (agents.scanned > 0) lanes.push(`${agents.scanned} subagent transcript(s) read whole`);
    if (agents.appended > 0) {
      lanes.push(`${agents.appended} subagent transcript(s) had grown and only the tail was read`);
    }
    if (agents.removed > 0) lanes.push(`${agents.removed} indexed subagent(s) no longer on disk`);
    if (agents.unlinked > 0) {
      lanes.push(
        `${agents.unlinked} with no readable .meta.json, so nothing links them to the turn that ` +
        'dispatched them',
      );
    }
    parts.push(`${lanes.join(', ')} (${agents.bytesRead} byte(s))`);
  }
  if (mirror !== null && mirrorMoved > 0) {
    const kept: string[] = [];
    if (mirror.advanced > 0) {
      kept.push(
        `${mirror.advanced} kept copy(s) took ${mirror.bytesWritten} new byte(s)`,
      );
    }
    if (mirror.orphaned.length > 0) {
      kept.push(
        `${mirror.orphaned.length} session(s) are now read from their copy because the ` +
        'transcript is gone',
      );
    }
    if (mirror.broken.length > 0) {
      kept.push(`${mirror.broken.length} copy(s) can no longer keep up`);
    }
    if (mirror.cleared.length > 0) {
      kept.push(`${mirror.cleared.length} mark(s) dropped because the copy is gone`);
    }
    // **The choice kept up with the append** (`plan:archive seq:46`). It is a
    // separate clause from the copy's own because it is a separate promise: a
    // redacted copy that quietly stopped being projected would put a value the
    // owner ticked back into the file on the very next turn, and nothing else
    // in this row would look any different.
    if (mirror.redacted.length > 0) {
      kept.push(
        `${mirror.redacted.length} redacted copy(s) took ${mirror.redactedBytesWritten} new ` +
        'byte(s), so values chosen earlier are still faked in what was appended',
      );
    }
    parts.push(kept.join(', '));
  }
  return `; the conversation index was refreshed — ${parts.join(', ')}, `
    + `${report.bytesRead} byte(s) in ${report.ms}ms`;
}

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
    // AFTER the upkeep and BEFORE the row. After, because the upkeep's probe
    // has a 250 ms cap of its own and a synchronous file read in front of it
    // would spend that budget before the socket was ever opened. Before,
    // because the row is where a refresh becomes visible at all — `stdout`
    // leaves no trace, and a refresh nothing recorded is the invisibility this
    // whole item is about, wearing a different hat.
    const refresh = stopConversationRefresh(input);
    // LAST of the three, and never awaited. `reviewTrigger` is synchronous, it
    // spawns a detached and unref'ed child, and it returns — see its header for
    // why the rubric is NOT run here. It is last so that its own `stat` sees a
    // transcript the refresh above has already brought the index level with.
    const review = reviewTrigger(input, 'Stop');
    const { stdout } = observeAndRecord(stopSpec(upkeep, refresh, review), input, process.cwd());
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
