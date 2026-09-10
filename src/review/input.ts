/**
 * **What the pass reads, and the guarantee that it read the whole of it** —
 * `plan:loop seq:2`, design §3.
 *
 * ── THE ASSIGNMENT, AND WHICH HALF IS LOAD-BEARING ─────────────────────────
 *
 * The pass reads *what actually happened*, not a recent window. §3a's evidence
 * is that distilled skills scored **-2.44pp** while raw trajectory retrieval
 * beat them on every metric (arXiv:2605.24117) — a "lossy abstraction
 * bottleneck" — and that safety-rule recall measured **53% after one
 * compaction and 10% after five** (arXiv:2608.22752) while the FILE lost
 * nothing.
 *
 * **The load-bearing half is not "read a lot". It is that a partial read says
 * so.** A pass that samples is a pass that can be wrong in a way nobody can
 * see, and this project has already paid for that three times over: a
 * transcript walk that stopped early, a fold whose disclosure could never
 * fire, a check that reported zero because its derivation was broken. So every
 * value this module returns carries `whole` and `skipped`, `wholenessLine`
 * writes the sentence, and `runPass` puts that sentence at the TOP of its
 * report rather than in a footnote.
 *
 * ── READ WHOLE, SEND INCREMENTALLY ─────────────────────────────────────────
 *
 * §3a: *"always read the whole file, send only what is new since the last
 * pass."* `sinceByte` bounds what is RETURNED, never what is scanned, and the
 * distinction is visible in the result: `records` counts everything walked
 * while `points` holds only the new stretch. A caller that reads `points.length
 * === 0` and concludes the file was not read is reading the wrong field, which
 * is why `records` and `readBytes` are both there.
 *
 * ── WHAT IT COSTS, MEASURED ON THE OWNER'S OWN CORPUS, 2026-09-10 ──────────
 *
 *     the session transcript      86,732,337 bytes    36,268 records   1,297 ms
 *     280 subagent transcripts   727,894,069 bytes   115,454 records   4,041 ms
 *     ------------------------------------------------------------------------
 *     the whole of it            814,626,406 bytes   151,722 records   ~5.3 s
 *
 * **Two things in that table contradict the design and both are worth having
 * on the record.** §3b says *"478 task transcripts totalling 91 MB, against 61
 * MB for the session itself"*. Measured today it is **280 files and 694 MiB**,
 * against 82.7 MiB for the session — the count is smaller and the volume is
 * **7.6x larger**, so the subagents are not a supplement to the session file,
 * they are **8.4x the whole of it**. And §3b says *"the archive indexes 2
 * files and sees none of them"*; `listSubagentFiles` and `subagentDir`
 * (`core/conversation-index.ts`) landed with `plan:archive` and index them, so
 * this module CONSUMES that rather than extending the scanner as §3b planned.
 *
 * **The third contradiction is the location.** §3b says the subagent
 * transcripts *"are in `Temp` and will be deleted"*. They are not: they are in
 * `<transcriptDir>/<sessionId>/subagents/`, beside the session file, under
 * `CLAUDE_CONFIG_DIR` or `~/.claude`. The option below is therefore named
 * `subagentDir` and not the plan's `taskDir`, because a name that points at
 * the wrong directory is the kind of thing a later phase implements against.
 *
 * ── THE FOURTH CONTRADICTION, AND IT IS THE DANGEROUS ONE ─────────────────
 *
 * §3b's argument for reading lane transcripts is that *"the session file holds
 * each lane's REPORT; the subagent transcripts hold their REASONING — which is
 * where the corrections happened."* **Measured, what surfaces first is neither:
 * it is the lane's BRIEF.**
 *
 * In a subagent transcript the dispatch prompt is a `type: 'user'` record, so
 * `session-summary.ts` labels it `person` — correctly, by its own rules, which
 * were written for a session file where `user` really does mean the owner. Its
 * stage 3 strips the synthetic person-side text it knows about (task
 * notifications, slash wrappers, meta, system reminders, the harness's own
 * compaction summaries); a dispatch brief is none of those and walks straight
 * in. And a person's turn is admitted on ANY cue at all (`ADMIT_SCORE_PERSON`
 * is 1 against the model's 3) with 40% of the cap reserved for it
 * (`PERSON_RESERVE`), both of which exist so the owner's 44 KB is not drowned
 * by the model's 1.39 MB.
 *
 * **Measured over all 280 lane transcripts, 2026-09-10: 1,927 person-side
 * points against 1,165 model-side, from 1,453,700 characters of "person" text
 * — 33x the 44,006 characters the owner actually typed in the session those
 * lanes belong to.** In one lane, five of the top six points were record 0:
 * one brief, split into paragraphs, five times.
 *
 * **And none of it is his.** A brief is the parent model's text quoting items
 * that are already in the corpus. Feeding it to a loop whose job is to propose
 * new items is the corpus proposing its own rules back to itself, with the
 * owner's label on them — the purest form of the fidelity loss §4 cites
 * (arXiv:2605.12978) and a straight defeat of §3c's independence requirement,
 * because a rule quoted into ten briefs would look like ten confirmations.
 *
 * **So: in a lane transcript, nobody typed anything, and every person-side
 * point is dropped.** There is no human in a lane. Every `type: 'user'` record
 * there is the dispatch prompt, a tool result (already dropped for having no
 * text) or a system reminder (already dropped at stage 3). The count of what
 * this removes is carried on the result as `briefPoints` and printed by
 * `wholenessLine`, because a filter this large that reported nothing would be
 * the silent drop wearing a fix's clothes.
 *
 * **`session-summary.ts` is deliberately NOT changed.** Its labelling is right
 * for the file it was written for, and this is the second consumer discovering
 * that the two need different cuts of one walk — which is the same disagreement
 * that module already records about `classifyTurn`, resolved the same way.
 *
 * ── AND THE FLOOR THAT EVERY NUMBER HERE IS ────────────────────────────────
 *
 * `plan:loop seq:1` established it and it applies unchanged: the log records
 * INJECTION, never reading or reliance. This module reads transcripts, which
 * records what was SAID — not what was understood, not what was acted on, and
 * not the parts of a lane's reasoning that never reached its transcript.
 * Everything downstream is a floor.
 */
import {
  MAX_SCAN_BYTES, iterateTranscript, listSubagentFiles, type TranscriptCursor,
} from '../core/conversation-index.ts';
import {
  snapshotBytes, summariseTranscript, type PointCategory,
} from '../core/session-summary.ts';

/**
 * The aggregate ceiling on one pass's read.
 *
 * **4 GiB, which is ~5.3x what the owner's corpus needs today and ~28 s at the
 * 147 MB/s measured above.** The number is chosen so that it does NOT bite on
 * real work — a budget that routinely truncates is a budget that turns every
 * report into a partial one — while still bounding a directory that has grown
 * in a way nobody expected. The pass is detached and nobody waits on it, so
 * the cost of a generous ceiling is disk time in a background process; the
 * cost of a mean one is a conclusion drawn from a sample.
 *
 * **It is a ceiling on BYTES READ, not on wall time**, deliberately: bytes are
 * the thing the result can report and a reader can check against the file
 * sizes on disk. A time budget would truncate differently on every machine and
 * leave a report nobody could reproduce.
 */
export const PASS_SCAN_BUDGET_BYTES = 4 * 1024 * 1024 * 1024;

/** Why a source was not read whole. Every value is disclosed, never inferred. */
export type SkipWhy =
  /** The per-file cap (`MAX_SCAN_BYTES`) stopped the read mid-file. */
  | 'cap'
  /** The aggregate budget was already spent when this file came up. */
  | 'budget'
  /** The file could not be opened, or the read stopped short of its size. */
  | 'unreadable'
  /** `includeSubagents: false`. Read by nobody's mistake — but still not read. */
  | 'excluded'
  /** `sinceByte` is past the file's end: it was replaced, not appended to. */
  | 'shrank';

/** One source that was not read whole, and exactly how short it fell. */
export interface SkippedSource {
  file: string;
  why: SkipWhy;
  /** The file's size on disk at the moment of the pass. */
  bytes: number;
  /** What was actually read from it. `0` when it was never opened. */
  readBytes: number;
}

/**
 * One thing the reader found, reduced to what this phase needs.
 *
 * `source` is not optional and never inferred: design §5c's relevance gate
 * (phase 3) refuses a proposal whose evidence does not touch its target, and
 * it can only do that if every point still knows which file it came out of.
 * The upstream bug that gate exists for — content from an unrelated research
 * task written into an existing skill — is a point that lost its provenance.
 */
export interface Point {
  category: PointCategory;
  who: 'person' | 'model';
  /** Absolute path of the transcript this came from. */
  source: string;
  /** 0-based record index WITHIN that file — the archive UI's own handle. */
  recordIndex: number;
  at: string | null;
  text: string;
}

/** What one pass read, what it returns, and what it could not reach. */
export interface PassInput {
  /** Only the NEW stretch. See the header: `sinceByte` bounds this, not the scan. */
  points: Point[];
  /**
   * The session transcript offset this pass is pinned to — `snapshotBytes` at
   * the moment the read began, so two passes with the same `readTo` over the
   * same file produce the same input. The next pass's `sinceByte`.
   */
  readTo: number;
  /** Every file read WHOLE, in read order. A skipped file is not in here. */
  sources: string[];
  /** `false` when anything at all was not read whole. Never inferred. */
  whole: boolean;
  skipped: SkippedSource[];
  /** Bytes actually read across every source. */
  readBytes: number;
  /** Records walked across every source — including the ones before `sinceByte`. */
  records: number;
  /** Lines that would not parse. One line costs one, never its neighbours. */
  unreadable: number;
  /**
   * Points dropped from lane transcripts because nobody typed them — see
   * `readOne`. **Counted rather than merely filtered**: this is the largest
   * single drop this module makes, it was measured at 1,927 points against
   * 1,165 kept, and a filter of that size that reported nothing would be the
   * silent drop wearing a fix's clothes.
   */
  briefPoints: number;
  /** Wall time of the read, so a budget can be tuned against something real. */
  ms: number;
}

export interface GatherOptions {
  /** The session's own transcript. */
  transcript: string;
  /** Return only points after this byte. Must be a line start (a prior `readTo`). */
  sinceByte: number;
  includeSubagents: boolean;
  /**
   * `<transcriptDir>/<sessionId>/subagents` — `subagentDir` in
   * `core/conversation-index.ts`. `null` when the caller could not resolve one,
   * which is a state and not a fault: two of the four sessions in this
   * project's own directory dispatched no lanes at all.
   */
  subagentDir: string | null;
  /** Aggregate ceiling. Injected for tests; production passes none. */
  budgetBytes?: number;
  /** Per-file ceiling. Injected for tests; production is `MAX_SCAN_BYTES`. */
  capBytes?: number;
  /** Most points per source. Bounds what is RETURNED, never what is read. */
  maxPointsPerSource?: number;
}

/**
 * The record index at a byte offset, walked through the SHARED iterator.
 *
 * **`iterateTranscript` and not a second walk**, which is the rule this whole
 * feature is built under: a second scanner over the same JSONL drifts from the
 * first, and that is the failure this project spent 2026-09-07 measuring. The
 * cost is re-reading the prefix — 1.3 s on the owner's 86.7 MB file — paid in
 * a detached child that nobody is waiting on.
 *
 * `byte` must be the first byte of a line, which is what a previous `readTo`
 * always is (`snapshotBytes` of an append-only file that ends in a newline).
 * `iterateTranscript` documents what an offset landing inside a record costs:
 * one `unreadable` and then correct records after the next newline — visibly
 * wrong rather than quietly shifted.
 */
function recordIndexAt(file: string, byte: number): number {
  if (byte <= 0) return 0;
  let seen = 0;
  for (const _step of iterateTranscript(file, { cap: byte })) seen += 1;
  return seen;
}

/**
 * Read one transcript whole and turn it into points, disclosing any shortfall.
 *
 * `fromIndex` is where the RETURNED points start; the scan always begins at
 * byte 0. `summariseTranscript`'s `range: { kind: 'record' }` is what makes
 * those two different, and its `coverage.droppedOutOfRange` is what proves the
 * prefix was walked rather than skipped.
 */
function readOne(
  file: string, bytes: number, fromIndex: number, cap: number, maxPoints: number,
  lane: boolean,
): {
  points: Point[]; readBytes: number; records: number; unreadable: number;
  short: SkipWhy | null; briefDropped: number;
} {
  const upToBytes = Math.min(bytes, cap);
  const summary = summariseTranscript(file, {
    upToBytes,
    range: { kind: 'record', index: fromIndex },
    // A lane's quota is asked for DOUBLE and then halved by the filter below,
    // because the reader reserves 40% of any cap for the person's own words
    // (`PERSON_RESERVE`) and in a lane every one of those slots is the brief.
    // Asking for the plain cap and filtering afterwards would silently give
    // each lane 60% of the budget it was configured with.
    maxPoints: lane ? maxPoints * 2 : maxPoints,
  });
  let kept = summary.points;
  let briefDropped = 0;
  if (lane) {
    const before = kept.length;
    kept = kept.filter((point) => point.speaker === 'model').slice(0, maxPoints);
    briefDropped = before - kept.length;
  }
  const points: Point[] = kept.map((point) => ({
    category: point.category,
    who: point.speaker,
    source: file,
    recordIndex: point.recordIndex,
    at: point.at,
    text: point.text,
  }));
  // Two different shortfalls, and they must not be collapsed: `cap` is a bound
  // this build chose and can raise, while `unreadable` is a file that did not
  // give up what it holds. A reader who cannot tell them apart cannot tell a
  // configuration problem from a broken transcript.
  const short: SkipWhy | null =
    bytes > cap ? 'cap'
      : summary.coverage.readBytes < upToBytes ? 'unreadable'
        : null;
  return {
    points,
    readBytes: summary.coverage.readBytes,
    records: summary.coverage.records,
    unreadable: summary.coverage.unreadable,
    short,
    briefDropped,
  };
}

/**
 * Gather everything this pass may look at.
 *
 * ── THE ORDER IS PART OF THE GUARANTEE ─────────────────────────────────────
 *
 *  1. **The session transcript, always, and before the budget is consulted.**
 *     It is the spine, it is the only file `readTo` is about, and a pass whose
 *     budget was spent before it reached the session file would be a pass
 *     about nothing while reporting a large `readBytes`.
 *  2. **Subagents, NEWEST FIRST.** If the budget bites it drops the oldest,
 *     which is the least likely to be about the work in hand — and the result
 *     names every one it dropped, with the bytes, so "the budget bit" is never
 *     a thing a reader has to infer from a small number.
 *
 * ── THE HAZARD IN THE SUBAGENT TRANSCRIPTS, WHICH IS NOT SIZE ──────────────
 *
 * §3b: the session file holds each lane's REPORT; the subagent transcripts
 * hold its REASONING, which is where the corrections happened. **And it is
 * also where the false starts and the abandoned hypotheses are.** Capturing
 * *"a lane believed X"* as a lesson records a mistake as knowledge — the
 * transcript contains both the failure and the recovery and only the recovery
 * is true. §12's fifth anti-learning rule applies DOUBLY here, `rubric.ts`
 * enforces the first half of it (an unresolved failure does not fire), and
 * phase 3 owns the rest. Nothing in this file decides what is true; it decides
 * what is READ, and it says what it could not reach.
 */
export function gather(options: GatherOptions): PassInput {
  const started = Date.now();
  const cap = options.capBytes ?? MAX_SCAN_BYTES;
  const budget = options.budgetBytes ?? PASS_SCAN_BUDGET_BYTES;
  const maxPoints = options.maxPointsPerSource ?? 60;

  const points: Point[] = [];
  const sources: string[] = [];
  const skipped: SkippedSource[] = [];
  let readBytes = 0;
  let records = 0;
  let unreadable = 0;
  let briefPoints = 0;

  const readTo = snapshotBytes(options.transcript);

  // A transcript that is not there at all. `snapshotBytes` answers 0 for a
  // pruned session and for a path that never existed, and the two are the same
  // fact from this module's side: there is nothing to read and the result must
  // SAY so rather than report an empty pass.
  if (readTo === 0) {
    skipped.push({ file: options.transcript, why: 'unreadable', bytes: 0, readBytes: 0 });
  } else if (options.sinceByte > readTo) {
    // The file is SHORTER than where the last pass stopped, so it was replaced
    // rather than appended to. Returning nothing is right — the caller's
    // offset is meaningless against this file — but returning nothing SILENTLY
    // would read as "a quiet stretch" forever.
    skipped.push({
      file: options.transcript, why: 'shrank', bytes: readTo, readBytes: 0,
    });
  } else {
    const fromIndex = recordIndexAt(options.transcript, options.sinceByte);
    const one = readOne(options.transcript, readTo, fromIndex, cap, maxPoints, false);
    points.push(...one.points);
    readBytes += one.readBytes;
    records += one.records;
    unreadable += one.unreadable;
    briefPoints += one.briefDropped;
    if (one.short === null) sources.push(options.transcript);
    else {
      skipped.push({
        file: options.transcript, why: one.short, bytes: readTo, readBytes: one.readBytes,
      });
    }
  }

  const lanes = options.subagentDir === null ? [] : listSubagentFiles(options.subagentDir);
  if (!options.includeSubagents) {
    // NOT read, and said. A pass configured to ignore the lanes is a pass that
    // read 10% of the evidence on this corpus (82.7 MiB of 776.8 MiB measured
    // 2026-09-10), and a report that called that "whole" would be the exact
    // overstatement this module exists to prevent.
    for (const lane of lanes) {
      skipped.push({ file: lane.file, why: 'excluded', bytes: lane.bytes, readBytes: 0 });
    }
  } else {
    const newestFirst = [...lanes].sort((a, b) => b.mtimeMs - a.mtimeMs);
    for (const lane of newestFirst) {
      if (readBytes + Math.min(lane.bytes, cap) > budget) {
        skipped.push({ file: lane.file, why: 'budget', bytes: lane.bytes, readBytes: 0 });
        continue;
      }
      // A lane's transcript is FINISHED when the lane returns, so there is no
      // incremental offset to keep for it: it is read from record 0 every
      // pass. Bounding what is SENT from a lane already seen belongs to phase
      // 3, which is the phase that has something to send.
      const one = readOne(lane.file, lane.bytes, 0, cap, maxPoints, true);
      points.push(...one.points);
      readBytes += one.readBytes;
      records += one.records;
      unreadable += one.unreadable;
      briefPoints += one.briefDropped;
      if (one.short === null) sources.push(lane.file);
      else {
        skipped.push({
          file: lane.file, why: one.short, bytes: lane.bytes, readBytes: one.readBytes,
        });
      }
    }
  }

  return {
    points,
    readTo,
    sources,
    whole: skipped.length === 0,
    skipped,
    readBytes,
    records,
    unreadable,
    briefPoints,
    ms: Date.now() - started,
  };
}

/** How a skip reads in one clause. */
const WHY_SAYS: Record<SkipWhy, string> = {
  cap: `stopped at the ${MAX_SCAN_BYTES}-byte per-file cap`,
  budget: 'never opened — the pass budget was already spent',
  unreadable: 'could not be read to its end',
  excluded: 'not read — includeSubagents is off',
  shrank: 'replaced rather than appended to, so the offset from the last pass means nothing',
};

/**
 * **The sentence a reader sees.** One line, and it is the first thing
 * `runPass` writes into its report.
 *
 * There is no quiet form of this. A whole read says it read whole and how
 * much; a partial read leads with the word NOT and names every file it could
 * not reach. `plan:loop seq:1` and D33 both shipped their own version of this
 * sentence after finding cases their checks could not rank into view, and the
 * discipline is the same one: **disclose the unmeasured set rather than
 * reporting it as clean.**
 */
export function wholenessLine(input: PassInput): string {
  const scale = `${input.sources.length} source(s), ${input.readBytes} byte(s), ` +
    `${input.records} record(s) in ${input.ms}ms`;
  const briefs = input.briefPoints === 0 ? ''
    : `; ${input.briefPoints} point(s) dropped from lane transcripts as dispatch briefs ` +
      '(nobody typed them — see input.ts)';
  if (input.whole) {
    return `read WHOLE: ${scale}` +
      (input.unreadable === 0 ? '' : ` (${input.unreadable} line(s) would not parse)`) + briefs;
  }
  const named = input.skipped
    .map((s) => `${s.file} (${s.bytes} byte(s), read ${s.readBytes}) — ${WHY_SAYS[s.why]}`)
    .join('; ');
  return (
    `NOT read whole: ${scale}, and ${input.skipped.length} source(s) were not read whole — ` +
    `${named}${briefs}. Every count below is a FLOOR, and nothing here may be reported as a ` +
    'conclusion drawn from the whole session.'
  );
}

/**
 * A cursor a caller can inspect after a walk it drove itself.
 *
 * Re-exported rather than re-declared so that a consumer of this module never
 * has a second opinion about what `scannedBytes` means.
 */
export type { TranscriptCursor };
