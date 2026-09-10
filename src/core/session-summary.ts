/**
 * Reading a session's own transcript back into a short account of what was
 * decided, corrected, measured, asked and tried — `plan:restore seq:1`, and
 * the design of record is
 * `docs/superpowers/specs/2026-09-07-session-summary-restore-design.md` §4,
 * §6, §7 and §8.
 *
 * ── WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT ──────────────────────────
 *
 * This is the READER and the RECIPE. It builds a summary and a review form.
 * **It injects nothing, stages nothing, and writes nothing** — not to
 * `.my_context/`, not to `~/.claude/`, not to the transcript. Staging,
 * approval and delivery are `plan:restore seq:2` and need the owner's
 * approval to run at all (design §2, §3).
 *
 * It is also not a routine mechanism. Design §2: *"this is not a usual ongoing
 * behaviour but a solution for special cases when this is the last option to
 * restore important things that otherwise would be lost."* Nothing here is on
 * a timer and nothing here has a budget tier.
 *
 * ── THE FILTER PIPELINE, AND THE MEASUREMENT UNDER EACH STAGE ──────────────
 *
 * Re-measured on the owner's own transcript, 2026-09-08 — `595db3b1-….jsonl`,
 * **61,196,596 bytes and 26,673 records**, which is 9.9 MB and 1,916 records
 * larger than the 51.3 MB / 24,757 the spec quotes from the day before. The
 * file grows while you read it, which is what `snapshotBytes` is for.
 *
 *     stage                                   removed      remaining
 *     ------------------------------------------------------------------
 *     0  records in the file                        —         26,673
 *     1  no `message` object at all             16,659        10,014   (62.5%)
 *     2  no text — tool_use, tool_result,        7,649         2,365
 *        thinking-only
 *     3  text on the person's side that no         246         2,119
 *        person typed — task notifications,
 *        slash wrappers, meta, the harness's
 *        own compaction summaries
 *     4  our own injected summaries                  0         2,119   (§6)
 *
 * **Stage 1 is 62.5%, not the 64% the item states, and the difference is not
 * the point — the SHAPE of the test is.** The item and the spec both name the
 * types: `attachment`, `system`, `ai-title`, `file-history-snapshot`,
 * `last-prompt`, `mode`, `queue-operation`. Measured today the file carries
 * **seventeen** such types, and ten of them are not on that list:
 * `bridge-session`, `permission-mode`, `atis-latch`, `custom-title`,
 * `agent-name`, `frame-link`, `file-history-delta`,
 * `artifact-autoreact-ledger`, `cost-state`, `artifact-comment-monitor`.
 *
 * So **the filter is structural and never a list of names.** A whitelist of
 * record types written yesterday would already be wrong today, and would be
 * wrong SILENTLY — the new types would fall through into the semantic layer as
 * records with no content. Stage 1 asks the only question that stays true when
 * the harness adds a member: does this record carry a `message` object at all.
 *
 * ── STAGE 3, WHICH THE SPEC DOES NOT HAVE AND WHICH THE DATA DEMANDS ───────
 *
 * `classifyTurn` (`core/conversation-index.ts`) counts a `user` record with
 * string content as a PROMPT, and for the archive's purpose that is right: it
 * is a turn on the person's side of the exchange. It is not right here.
 * Measured on the same file: of the **525** records it calls prompts, **194
 * are `<task-notification>` blocks** the harness files under the user's side
 * when a background agent finishes, **24 are `isMeta`**, **23 are
 * slash-command wrappers**, and **5 are the harness's own compaction
 * carry-over summaries**.
 *
 * **279 turns in this session were typed by a person, and they total 44,006
 * characters** — 0.07% of a 61 MB file. That is the material this feature
 * exists to protect, and a recipe that treated all 525 as prompts would spend
 * 47% of its person-side budget on machinery.
 *
 * This is stated as a disagreement rather than a fix, because `classifyTurn`
 * is not wrong for the archive and must not be changed to suit this reader.
 * The two features need different cuts of the same data, and both cuts are
 * derived from one walk.
 *
 * ── WHY THIS DOES NOT REBUILD THE ARCHIVE'S SCANNER (design §8) ────────────
 *
 * *"A second scanner over the same JSONL would drift from the first."* Three
 * things keep that true here:
 *
 *   1. **File discovery is not repeated.** Callers reach a transcript through
 *      `transcriptDir` / `listTranscriptFiles`, so this reader and the archive
 *      can never disagree about which files exist or where they live.
 *   2. **Turn classification is not repeated.** `classifyTurn` is imported and
 *      recorded on every point, so the archive's measured definition of a
 *      prompt travels with the point. Stage 3 above NARROWS that answer; it
 *      does not replace it, and both values are carried.
 *   3. **The counts are cross-checked rather than trusted.**
 *      `crossCheckAgainstIndex` runs the archive's own `scanTranscript` over
 *      the same file and the same byte cap and returns the differences. A test
 *      asserts the list is empty. If this walk ever drifts from that one, a
 *      test goes red rather than two screens quietly disagreeing.
 *
 * What is NOT shared is the walk itself, and that is a real defect rather than
 * a choice: `scanTranscript` consumes records and returns only counts, and
 * `readWindow` (`ui/read-model-conversations.ts`) is private to the UI read
 * model and would drag the UI graph into core. **Neither exposes a seam that
 * yields records.** The repair is one record-iterator in
 * `conversation-index.ts` that all three consume; it belongs to the lane that
 * owns that file, which is why it is reported here and not done here.
 *
 * ── THE SNAPSHOT, AND WHY IT IS A PARAMETER ────────────────────────────────
 *
 * The transcript grows while the summary is being built — this one grew 9.9 MB
 * between the spec and this module. So every read takes `upToBytes` and every
 * result reports it. Two runs with the same `upToBytes` over the same file
 * produce the same summary, which is what makes a review meaningful: the owner
 * approves a summary of a stated input, not of "the file, whenever you looked".
 *
 * `(bytes, mtimeMs)` is the archive's freshness key and `snapshotBytes` reads
 * the same `stat`, so the offset a caller records here is the offset the
 * conversation index already stores.
 *
 * ── THE LOOP GUARD (design §6) ─────────────────────────────────────────────
 *
 * An injected summary lands in the transcript like everything else, so the
 * next summary would summarise it, and the compounding would be silent. The
 * marker is defined HERE, in the reader, before anything can inject — `seq:2`
 * imports it rather than inventing one. `SESSION_SUMMARY_MARKER` is carried by
 * every payload `renderPayload` builds, and `isMarkedSummary` drops any record
 * carrying it at stage 4. Retrofitting a marker after the first injection is
 * too late by definition, because the unmarked payload is already on disk.
 *
 * The harness's OWN compaction summaries (`isCompactSummary`) are dropped at
 * stage 3 for the same reason and counted separately, so a reader can tell our
 * loop guard firing from the harness's.
 */
import { closeSync, openSync, readSync, statSync } from 'node:fs';
import { classifyTurn } from './conversation-index.ts';

/**
 * The loop guard's sentinel, in this project's protocol-string form —
 * `CARRY_ONCE_PROTOCOL` (`core/ledger.ts`) is `mycontext-carry-once/1` and
 * this is its neighbour.
 *
 * The version suffix is not decoration. When the payload's shape changes, a
 * reader that only knows `/1` must still recognise a `/2` payload as ours and
 * skip it, which is why `isMarkedSummary` matches the stem and not the whole
 * string.
 */
export const SESSION_SUMMARY_MARKER = 'mycontext-session-summary/1';

/** The stem every version of the marker shares. Matched, not the full string. */
const MARKER_STEM = 'mycontext-session-summary/';

/**
 * Does this text carry a summary this feature produced?
 *
 * Deliberately a substring test on the STEM. A record holding the payload
 * carries the marker somewhere in it; a record holding a future `/2` payload
 * carries a different version of it; both are ours and both must be skipped.
 */
export function isMarkedSummary(text: string): boolean {
  return text.includes(MARKER_STEM);
}

/** Read granularity, matching `scanTranscript`'s. Bounds memory, not the read. */
const CHUNK_BYTES = 1024 * 1024;

/**
 * The snapshot offset for a repeatable run: the file's size right now.
 *
 * Returns 0 for a file that cannot be stat'ed, which summarises to an empty
 * summary that SAYS it read nothing rather than throwing — a pruned session is
 * a state this reports, not an error (design §8: a session never marked
 * persistent cannot be restored by this feature either).
 */
export function snapshotBytes(file: string): number {
  try {
    const stat = statSync(file);
    return stat.isFile() ? stat.size : 0;
  } catch {
    return 0;
  }
}

/** Where a summary starts. Design §4c's RANGE axis, as a closed set. */
export type SummaryRange =
  /** The whole file up to `upToBytes`. */
  | { kind: 'whole' }
  /**
   * From the Nth compaction boundary, 1-based, counting from the start.
   * A negative `nth` counts back from the end, so `-1` is the LAST one — the
   * emergency's usual shape: "everything since the window was last rebuilt".
   */
  | { kind: 'compaction'; nth: number }
  /** From the first record whose `timestamp` is at or after this ISO string. */
  | { kind: 'timestamp'; at: string }
  /** From this 0-based record index — the same index the archive's UI shows. */
  | { kind: 'record'; index: number };

/** Design §4b's five keep-categories. Nothing outside them becomes a point. */
export type PointCategory =
  | 'decision' | 'correction' | 'measurement' | 'question' | 'failure';

/** Every category, in the order the payload prints them. */
export const POINT_CATEGORIES: PointCategory[] = [
  'decision', 'correction', 'measurement', 'question', 'failure',
];

/** Design §4c's option set. Every axis is here and every one has a default. */
export interface SummaryOptions {
  /**
   * Read no further than this byte. Required in spirit; defaulted to the
   * file's size at the moment of the call so a caller that forgets still gets
   * a run that SAYS which offset it used.
   */
  upToBytes?: number;
  /** RANGE. Default: the whole file. */
  range?: SummaryRange;
  /**
   * SUBJECTS. Case-insensitive substrings; a record must contain at least one.
   * Empty means every subject, which is the default.
   */
  subjects?: string[];
  /**
   * DEPTH. `points` renders one line each; `points+reasoning` renders the
   * reason underneath. Both build the same points — depth is a RENDERING
   * choice, so the owner can deepen a summary without a second 61 MB read.
   */
  depth?: 'points' | 'points+reasoning';
  /**
   * INCLUDE CODE. Off by default per §4b: a summary quoting a file is a second
   * copy that goes stale. On when the lost thing IS code that exists nowhere
   * else. When off, fenced blocks are stripped from a record BEFORE it is
   * scored, so a paragraph cannot earn its place on words inside a code sample.
   */
  includeCode?: boolean;
  /**
   * Score the model's `thinking` blocks as well as its spoken answers.
   *
   * Off by default, and it is a close call stated rather than buried: thinking
   * is where reasons are often first written down, and it is 1,792 records —
   * 97% as many as the 1,840 spoken answers. But it is a draft, it contradicts
   * itself on purpose, and a reason that survived into the answer is the one
   * the person actually saw and agreed to. The axis exists so the choice can
   * be measured instead of argued.
   */
  includeThinking?: boolean;
  /** Most points to keep, highest-scoring first. */
  maxPoints?: number;
  /** Longest a rendered point may be, in characters, before it is cut. */
  maxPointChars?: number;
}

/** One numbered point. `recordIndex` is the citation, and it is not optional. */
export interface SummaryPoint {
  /** 1-based, assigned after ranking. The number the owner refers to. */
  n: number;
  category: PointCategory;
  /** 0-based record index in the transcript — the archive UI's own handle. */
  recordIndex: number;
  /** The record's own timestamp, or `null` where the harness wrote none. */
  at: string | null;
  /** `person` or `model`. Narrower than `turn`; see stage 3 in the header. */
  speaker: 'person' | 'model';
  /** `classifyTurn`'s answer for this record, carried so the two never drift. */
  turn: 'prompt' | 'answer' | 'machinery';
  /** The point itself. */
  text: string;
  /**
   * The sentence that gave the reason, when one was found beside the point.
   * Rendered only at `points+reasoning` depth. `null` is honest and common:
   * design §4b says the reason is what cannot be recovered from the code, so a
   * point with no reason is worth flagging rather than padding.
   */
  reason: string | null;
  /** What earned it its place. Readable, so a bad point can be diagnosed. */
  cues: string[];
  score: number;
}

/** One compaction boundary the walk passed. Design §4c's range anchor. */
export interface CompactionBoundary {
  recordIndex: number;
  at: string | null;
  /** The harness's own accounting, when it wrote any. */
  preTokens: number | null;
  postTokens: number | null;
  cumulativeDroppedTokens: number | null;
  trigger: string | null;
}

/**
 * What the read actually covered. Design §5: *"the review form must be honest
 * about coverage — how much of the session was read, what the filter dropped,
 * and where the recipe chose to skip. A review form that reads as complete
 * when it is partial is worse than no review form."*
 *
 * Every number here is printed in the review form. None is optional and none
 * is rounded.
 */
export interface SummaryCoverage {
  /** The file's size at the moment of the read. */
  fileBytes: number;
  /** The snapshot the run was pinned to. */
  upToBytes: number;
  /** Bytes actually read. Short of `upToBytes` only if the read failed. */
  readBytes: number;
  /** Records seen in those bytes. */
  records: number;
  /** Lines that would not parse. One line costs one, never its neighbours. */
  unreadable: number;
  /** Stage 1: records carrying no `message` object at all. */
  droppedNoMessage: number;
  /** Stage 2: a message with no words in it — tool calls and tool results. */
  droppedNoText: number;
  /** Stage 2, separately: thinking-only records, dropped unless asked for. */
  droppedThinking: number;
  /** Stage 3, itemised, because each item is a different kind of machinery. */
  droppedTaskNotification: number;
  droppedSlashCommand: number;
  droppedMeta: number;
  droppedSystemReminder: number;
  droppedHarnessCompactionSummary: number;
  /** Stage 4: records carrying our own marker. The loop guard's own count. */
  droppedOwnSummary: number;
  /** Records that survived every filter. */
  textRecords: number;
  /** Records outside the requested range. */
  droppedOutOfRange: number;
  /** Records the `subjects` filter removed. */
  droppedOffSubject: number;
  /** Paragraph-sized units scored. */
  candidates: number;
  /** Candidates that reached the admission threshold. */
  scored: number;
  /** Points removed as near-duplicates of a higher-scoring one. */
  droppedDuplicate: number;
  /** Points cut by `maxPoints`. The review form says this out loud. */
  droppedOverCap: number;
  /**
   * Person turns too short to be a point — "yes", "ok go ahead". Counted
   * because a person's typed turns are otherwise admitted on a much lower bar
   * (see `ADMIT_SCORE_PERSON`) and this is the only thing holding that bar up.
   */
  droppedTooShort: number;
  /** Characters of person-typed text in range. The 44 KB in the header. */
  personChars: number;
  /** Characters of model-spoken text in range. */
  modelChars: number;
  /**
   * How many points each category ADMITTED against how many the quota KEPT.
   *
   * This is the honesty §5 demands, in the one place it was most needed:
   * measured on the owner's own session, `measurement` admits 550 candidates
   * and `failure` admits 12. Without this row a reader sees a summary full of
   * numbers and cannot tell whether failures were absent or crowded out.
   */
  byCategory: Record<PointCategory, { admitted: number; kept: number }>;
  /** Points kept from each side of the exchange. */
  personPoints: number;
  modelPoints: number;
}

/** The whole result. `renderReviewForm` and `renderPayload` both read this. */
export interface SessionSummary {
  file: string;
  /** The options the run actually used, defaults resolved. */
  options: {
    upToBytes: number;
    range: SummaryRange;
    subjects: string[];
    depth: 'points' | 'points+reasoning';
    includeCode: boolean;
    includeThinking: boolean;
    maxPoints: number;
    maxPointChars: number;
  };
  coverage: SummaryCoverage;
  /** Every compaction boundary in the file, in file order. */
  compactions: CompactionBoundary[];
  /** The points, already numbered. */
  points: SummaryPoint[];
  /** The marker any payload built from this must carry. */
  marker: string;
}

/**
 * ── THE CUE SETS ───────────────────────────────────────────────────────────
 *
 * This is the hypothesis, and design §7 is explicit that it is settled by
 * running it rather than by arguing. What is written here is therefore the
 * CURRENT hypothesis, and this file is expected to change when the owner reads
 * the output and says what is missing.
 *
 * The shape is a weighted cue list per category rather than one fused regular
 * expression, for two reasons that are both about being able to fix it:
 *
 *   - **A point carries the cues that earned it** (`SummaryPoint.cues`), so a
 *     wrong point can be traced to the phrase that admitted it and that phrase
 *     can be dropped. A single fused pattern is unfalsifiable at the point of
 *     failure.
 *   - **Weights let a weak cue contribute without admitting alone.** "we
 *     decided" is a decision; "because" on its own is prose.
 *
 * Weights are integers because the threshold has to be readable. A cue worth 3
 * admits on its own; two 2s admit together; a lone 2 or 1 does not.
 */
interface Cue {
  /** Matched case-insensitively against the candidate text. */
  pattern: RegExp;
  weight: number;
  /** The name that appears in `SummaryPoint.cues`. */
  name: string;
}

/** A candidate reaching this is admitted. Two 2s reach it; one 2 does not. */
const ADMIT_SCORE = 3;

/**
 * The bar a PERSON's own words have to clear, and it is deliberately one third
 * of the model's.
 *
 * **This is a recipe change made by measurement, not by preference.** The
 * first run of this reader against the owner's session admitted 969 points and
 * **7 of them were his own words.** The cause is arithmetic rather than
 * scoring: he typed 44,006 characters and the model spoke 1,389,819 — thirty-
 * two times more — and the model spends much of that quoting him back, so his
 * sentence loses to the model's restatement of his sentence.
 *
 * That is exactly backwards for a feature whose subject is *his* session. And
 * the whole of his typed input is 44 KB, roughly 11,000 tokens — which design
 * §2 can afford outright, because this feature has no budget tier and *"takes
 * as much as it requires"*.
 *
 * So a person's turn is admitted on ANY cue at all. What holds the bar up
 * instead is `MIN_PERSON_CHARS`: "yes", "ok go ahead" and "continue" are turns
 * that carry nothing to restore.
 */
const ADMIT_SCORE_PERSON = 1;

/**
 * Shorter than this, a person's turn is an acknowledgement rather than a
 * point. Measured on the owner's session: turns under 40 characters are
 * "yes", "ok go ahead", "continue", "good morning" and "ok".
 */
const MIN_PERSON_CHARS = 40;

/**
 * The share of `maxPoints` reserved for the person's own words before the
 * model competes for anything.
 *
 * Without a reserve the model wins every slot on volume — see
 * `ADMIT_SCORE_PERSON`. With it, the review form the owner reads opens with
 * what HE said, which is the material a restore is most likely to be about.
 * Unused reserve is handed back, so a session where he typed little does not
 * print blank slots.
 */
const PERSON_RESERVE = 0.4;

const DECISION_CUES: Cue[] = [
  { name: 'owner-ruling', pattern: /\b(owner|his|her|their)\s+ruling\b/i, weight: 3 },
  { name: 'ruled', pattern: /\b(ruled|ruling)\b/i, weight: 2 },
  { name: 'decided', pattern: /\b(we|i|you)\s+(have\s+)?(decided|chose|choose|settled|agreed)\b/i, weight: 3 },
  { name: 'decision-noun', pattern: /\bthe\s+(decision|ruling|answer)\s+is\b/i, weight: 3 },
  { name: 'design-agreed', pattern: /\bdesign\s+agreed\b/i, weight: 3 },
  { name: 'go-with', pattern: /\b(go|going|went)\s+with\b/i, weight: 2 },
  { name: 'normative', pattern: /\b(must|shall)\s+(not\s+)?\w/i, weight: 1 },
  { name: 'imperative', pattern: /^\s*(do|use|keep|drop|retire|supersede|revert|adopt|prefer)\b/i, weight: 2 },
  { name: 'because', pattern: /\b(because|so that|the reason is|on the grounds that)\b/i, weight: 1 },
  { name: 'rather-than', pattern: /\brather than\b/i, weight: 1 },
];

const CORRECTION_CUES: Cue[] = [
  { name: 'i-was-wrong', pattern: /\bi\s+(was|am|got)\s+(wrong|mistaken|it wrong)\b/i, weight: 3 },
  { name: 'you-were-wrong', pattern: /\byou\s+(were|are|got)\s+(wrong|mistaken)\b/i, weight: 3 },
  { name: 'correction', pattern: /\bcorrect(ion|ing|ed)\b/i, weight: 2 },
  { name: 'not-true', pattern: /\b(that|this|it)\s+is\s+not\s+(true|right|correct)\b/i, weight: 3 },
  { name: 'turns-out', pattern: /\b(turns?|turned)\s+out\s+(not\s+)?to\b/i, weight: 2 },
  { name: 'in-fact', pattern: /\b(in fact|as it turns out),?\s/i, weight: 1 },
  { name: 'contradiction', pattern: /\bcontradict(s|ion|ed|ing)?\b/i, weight: 2 },
  { name: 'doc-was-wrong', pattern: /\b(the\s+)?(spec|design|item|plan|claim|figure|number)\b[^.]{0,60}\b(is|was|were)\s+(wrong|not|incorrect|stale)\b/i, weight: 3 },
  { name: 'my-mistake', pattern: /\b(my mistake|i apologi[sz]e|i had it backwards|i misread|i had assumed)\b/i, weight: 3 },
  { name: 'overturn', pattern: /\b(overturn(s|ed)?|reverse[sd]?|retract(s|ed)?|supersede[sd]?)\b/i, weight: 2 },
  { name: 'not-what-i-said', pattern: /\bnot what (i|you) (said|meant|asked)\b/i, weight: 3 },
];

/**
 * Measurement cues are deliberately the STINGIEST set, and that is a
 * correction rather than an opinion.
 *
 * The first run of this reader over the owner's session admitted 969 points,
 * of which **550 were measurements and 12 were failures** — in a recipe whose
 * own author called what-was-tried-and-failed *"the most expensive thing to
 * rediscover"*. The cause was that a grouped number and a unit were worth 2
 * each, so any paragraph containing "1,198" and "130ms" scored 4 and walked
 * in. This is engineering prose; almost every paragraph has numbers in it.
 *
 * Both are now worth 1, so a number alone never admits: a measurement has to
 * SAY it measured something, or count a countable noun.
 *
 * **There is no `timing` cue, and its absence is the point.** One was written
 * and a test removed it: `\d+\s?ms` is already inside `unit`, so "1,198 ms"
 * scored `grouped-number` + `unit` + `timing` = 3 and walked back in — the
 * same evidence counted three times. Overlapping cues are how a weighted set
 * silently becomes an unweighted one, and this is the shape to check for
 * before adding another.
 */
const MEASUREMENT_CUES: Cue[] = [
  { name: 'measured', pattern: /\bmeasured\b/i, weight: 3 },
  { name: 'counted', pattern: /\b(counted|the count is)\b/i, weight: 2 },
  { name: 'grouped-number', pattern: /\b\d{1,3}(,\d{3})+\b/, weight: 1 },
  { name: 'unit', pattern: /\b\d+(\.\d+)?\s?(bytes|kb|mb|gb|kib|mib|ms|%)\b/i, weight: 1 },
  { name: 'n-of-m', pattern: /\b\d[\d,]*\s+of\s+(the\s+)?\d[\d,]{2,}\b/i, weight: 3 },
  { name: 'countable', pattern: /\b\d[\d,]*\s+(records|rows|items|files|tests|lines|sessions|citations|fixtures|prompts|answers|tokens|commits)\b/i, weight: 3 },
];

const QUESTION_CUES: Cue[] = [
  { name: 'open-question', pattern: /\bopen question\b/i, weight: 3 },
  { name: 'waiting-on', pattern: /\b(waiting|waits|blocked)\s+on\b/i, weight: 3 },
  { name: 'needs-a-ruling', pattern: /\b(needs?|need|awaits?)\s+(your|his|the owner'?s?|a)\s+(approval|answer|ruling|decision|call|sign-?off)\b/i, weight: 3 },
  { name: 'unresolved', pattern: /\bunresolved\b/i, weight: 2 },
  { name: 'question-mark', pattern: /\?\s*$/, weight: 2 },
  { name: 'asking', pattern: /\b(should (i|we)|shall (i|we)|do you want|want me to|which of|your call)\b/i, weight: 2 },
  { name: 'not-decided', pattern: /\b(not (yet )?(decided|settled|answered)|still open|to be decided|undecided)\b/i, weight: 3 },
];

const FAILURE_CUES: Cue[] = [
  { name: 'tried-and-failed', pattern: /\b(tried|attempted)\b[^.]{0,60}\b(fail|failed|did not|didn'?t|no good|gave up)\b/i, weight: 3 },
  { name: 'does-not-work', pattern: /\b(does|did|do)\s?n[o']?t\s+work\b/i, weight: 3 },
  { name: 'abandoned', pattern: /\b(abandon(ed)?|gave up on|backed out|reverted)\b/i, weight: 2 },
  { name: 'failed', pattern: /\bfail(ed|s|ure|ing)\b/i, weight: 1 },
  { name: 'broke', pattern: /\b(broke|broken|regress(ed|ion))\b/i, weight: 1 },
  { name: 'wont-work', pattern: /\b(won'?t|will not|cannot|can'?t)\s+work\b/i, weight: 3 },
  { name: 'dead-end', pattern: /\b(dead end|blind alley|not viable|ruled out|does not survive)\b/i, weight: 3 },
  { name: 'earlier-attempt', pattern: /\b(the\s+)?(first|earlier|previous)\s+(attempt|approach|try|version)\b/i, weight: 2 },
];

const CUES: [PointCategory, Cue[]][] = [
  ['decision', DECISION_CUES],
  ['correction', CORRECTION_CUES],
  ['measurement', MEASUREMENT_CUES],
  ['question', QUESTION_CUES],
  ['failure', FAILURE_CUES],
];

/** A sentence that explains, for `points+reasoning`. Design §4b's "reason". */
const REASON_PATTERN =
  /\b(because|so that|the reason is|on the grounds that|which is why|rather than|otherwise)\b/i;

/**
 * Process narration — design §4b's fourth SKIP. *"Now I will read the file."*
 *
 * Checked before scoring rather than after, because narration is full of
 * imperative verbs and would otherwise score as decisions. Anchored to the
 * START of the candidate: a paragraph that BEGINS "Let me read" is narration;
 * one that mentions reading halfway through is not.
 */
const NARRATION_PATTERN =
  /^\s*(let me\b|now (i|let)\b|i'?ll (now |just )?(read|check|look|run|start|open|search|grep)\b|i'?m going to\b|next,? (i|let)\b|first,? let me\b|perfect[.!,]|great[.!,]|done[.!]|looking at\b|checking\b|reading\b|running\b|found it\b|got it\b)/i;

/** A fenced code block, stripped when `includeCode` is off. */
const FENCE_PATTERN = /```[\s\S]*?```/g;

/**
 * A candidate that is a shell line, an indented code block, or a Markdown
 * table. Alone it never earns a point, because §4b skips code and file
 * contents: they are on disk and a copy in a summary goes stale.
 *
 * The table arm was added after the first real run: five of the sixty points
 * it produced were fragments of Markdown tables — `| cost | verdict |` — which
 * are rendered tool output wearing prose clothing. A table row read back as a
 * numbered point says nothing, because its meaning was in its header.
 */
const CODE_HEAVY_PATTERN = /^[\s>]*[$#]\s|^\s{4,}\S|^\s*\|/;

/**
 * A table whose FIRST cell was consumed by the paragraph split, so the leading
 * pipe of `CODE_HEAVY_PATTERN` is gone. Four or more pipes in one candidate is
 * a table wherever it starts; prose reaches four pipes essentially never, and
 * the run that added this had one such fragment in sixty points.
 */
function looksLikeTable(text: string): boolean {
  let pipes = 0;
  for (const ch of text) if (ch === '|') pipes += 1;
  return pipes >= 4;
}

/**
 * Synthetic user turns — stage 3. Each returns its own name so the coverage
 * block can itemise them; a single boolean would report "246 dropped" and
 * leave nobody able to tell a task notification from a slash command.
 *
 * **Exported for `scripts/backfill-requests.ts`**, which asks the same
 * question for a different reason: this module drops a synthetic turn because
 * it is not worth summarising, and the backfill drops one because writing it
 * into an item's `request` field would put the harness's words in the owner's
 * mouth. A second copy of this list in that script could drift from this one,
 * and the drift would be invisible — a `<task-notification>` recorded as a
 * person's request reads exactly like a person's request.
 */
export function syntheticKind(text: string, isMeta: boolean, isCompactSummary: boolean):
| 'task-notification' | 'slash-command' | 'meta' | 'system-reminder'
| 'harness-compaction-summary' | null {
  if (isCompactSummary) return 'harness-compaction-summary';
  if (isMeta) return 'meta';
  const head = text.trimStart();
  if (head.startsWith('<task-notification>')) return 'task-notification';
  if (head.startsWith('<command-name>') || head.startsWith('<command-message>')
    || head.startsWith('<local-command-stdout>') || head.startsWith('<command-args>')) {
    return 'slash-command';
  }
  if (head.startsWith('<system-reminder>')) return 'system-reminder';
  if (head.startsWith('This session is being continued from a previous conversation')) {
    return 'harness-compaction-summary';
  }
  return null;
}

/**
 * Flatten one message's content to the words a PERSON or the MODEL said.
 *
 * Deliberately narrower than the UI read model's `renderContent`, and the
 * difference IS the recipe: `tool_result` text is not returned here at all,
 * because design §4b skips tool outputs as reproducible. `thinking` is
 * returned separately so the caller decides rather than the flattener.
 *
 * **Exported for `scripts/backfill-requests.ts`** alongside `syntheticKind`
 * above, and for the same reason: a second flattener would answer "what did
 * the person actually say" differently — most obviously about `tool_result`
 * blocks, which this one deliberately drops and a naive `JSON.stringify` of
 * the content array would sweep straight into a recorded request.
 */
export function saidText(content: unknown): { text: string; thinking: string } {
  if (typeof content === 'string') return { text: content, thinking: '' };
  if (!Array.isArray(content)) return { text: '', thinking: '' };
  const said: string[] = [];
  const thought: string[] = [];
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue;
    const b = block as { type?: unknown; text?: unknown; thinking?: unknown };
    if (b.type === 'text' && typeof b.text === 'string') said.push(b.text);
    else if (b.type === 'thinking' && typeof b.thinking === 'string') thought.push(b.thinking);
    // Every other block type — `tool_use`, `tool_result`, and whatever the
    // harness adds next — contributes no text ON PURPOSE. An unknown block
    // type is not an error here; it is content this recipe does not want.
  }
  return { text: said.join('\n\n'), thinking: thought.join('\n\n') };
}

/** One record after the structural filters, before the semantic one. */
interface Extract {
  recordIndex: number;
  at: string | null;
  speaker: 'person' | 'model';
  turn: 'prompt' | 'answer' | 'machinery';
  text: string;
}

/**
 * Split a record's text into paragraph-sized units, then oversized ones by
 * sentence.
 *
 * The unit matters: score a whole answer and one cue anywhere in 4,000
 * characters admits the lot, which is how a summary becomes a transcript. A
 * paragraph is the smallest unit that still carries a reason beside its claim.
 */
function candidatesOf(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n\s*\n/)) {
    const trimmed = para.trim();
    if (trimmed === '') continue;
    if (trimmed.length <= maxChars) { out.push(trimmed); continue; }
    // A long paragraph splits on sentence ends. A fragment still over the cap
    // is kept whole rather than cut mid-word: the RENDERER cuts and says it
    // cut, which is better than a scorer silently seeing half a sentence.
    let buffer = '';
    for (const piece of trimmed.split(/(?<=[.!?])\s+/)) {
      if (buffer !== '' && (buffer.length + piece.length) > maxChars) { out.push(buffer); buffer = ''; }
      buffer = buffer === '' ? piece : `${buffer} ${piece}`;
    }
    if (buffer !== '') out.push(buffer);
  }
  return out;
}

/**
 * Score one candidate against every category. Highest wins; ties keep order.
 *
 * `bar` is the admission threshold, which is `ADMIT_SCORE` for the model and
 * `ADMIT_SCORE_PERSON` for a person — see that constant for the measurement
 * that made the two different.
 */
export function scoreCandidate(
  text: string, bar: number = ADMIT_SCORE,
): { category: PointCategory; score: number; cues: string[] } | null {
  let best: { category: PointCategory; score: number; cues: string[] } | null = null;
  for (const [category, cues] of CUES) {
    let score = 0;
    const hit: string[] = [];
    for (const cue of cues) {
      if (cue.pattern.test(text)) { score += cue.weight; hit.push(cue.name); }
    }
    if (score >= bar && (best === null || score > best.score)) {
      best = { category, score, cues: hit };
    }
  }
  return best;
}

/**
 * The sentence in a candidate that gives a reason, if one does.
 *
 * A reason that is nearly the whole point is not a reason, it is the point
 * printed twice — and the real run found plenty. The owner's own turns often
 * carry no terminal punctuation at all, so the sentence split returns one
 * sentence and `points+reasoning` rendered a 300-character line followed by
 * the same 300 characters. `null` is the honest answer there.
 */
function reasonOf(text: string): string | null {
  const whole = text.trim();
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (!REASON_PATTERN.test(sentence)) continue;
    const trimmed = sentence.trim();
    if (trimmed.length >= whole.length * 0.9) return null;
    // And a reason that OPENS the point reads as an echo once both lines are
    // truncated to the same width, even though the strings differ. The real
    // run produced several. A reason has to be somewhere the eye has not
    // already been.
    if (whole.startsWith(trimmed)) return null;
    return trimmed;
  }
  return null;
}

/**
 * A normalised key for near-duplicate detection.
 *
 * This session repeats itself heavily — the same ruling is quoted in a plan, an
 * item, a lane brief and three answers. Without this the review form is one
 * sentence printed nine times and the owner reads nine lines to learn one
 * thing. Lowercased, punctuation stripped, first twelve words: long enough to
 * separate two different rulings, short enough to catch a requote with a
 * reworded lead-in.
 */
function dedupeKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w !== '').slice(0, 12).join(' ');
}

/**
 * Read one transcript and build the summary. **Reads only. Writes nothing.**
 *
 * One walk, in bounded chunks, under the archive scanner's tolerance rules
 * (`scanTranscript`'s header states three and this obeys the same three): a
 * line that will not parse costs one `unreadable` and never its neighbours; a
 * record whose `type` this build does not know is counted and otherwise
 * ignored; nothing is assumed about a key that has not been checked for.
 */
export function summariseTranscript(file: string, options: SummaryOptions = {}): SessionSummary {
  const fileBytes = snapshotBytes(file);
  const resolved: SessionSummary['options'] = {
    upToBytes: options.upToBytes ?? fileBytes,
    range: options.range ?? { kind: 'whole' },
    subjects: options.subjects ?? [],
    depth: options.depth ?? 'points',
    includeCode: options.includeCode ?? false,
    includeThinking: options.includeThinking ?? false,
    maxPoints: options.maxPoints ?? 60,
    maxPointChars: options.maxPointChars ?? 320,
  };

  const coverage: SummaryCoverage = {
    fileBytes,
    upToBytes: resolved.upToBytes,
    readBytes: 0,
    records: 0,
    unreadable: 0,
    droppedNoMessage: 0,
    droppedNoText: 0,
    droppedThinking: 0,
    droppedTaskNotification: 0,
    droppedSlashCommand: 0,
    droppedMeta: 0,
    droppedSystemReminder: 0,
    droppedHarnessCompactionSummary: 0,
    droppedOwnSummary: 0,
    textRecords: 0,
    droppedOutOfRange: 0,
    droppedOffSubject: 0,
    candidates: 0,
    scored: 0,
    droppedDuplicate: 0,
    droppedOverCap: 0,
    droppedTooShort: 0,
    personChars: 0,
    modelChars: 0,
    byCategory: {
      decision: { admitted: 0, kept: 0 },
      correction: { admitted: 0, kept: 0 },
      measurement: { admitted: 0, kept: 0 },
      question: { admitted: 0, kept: 0 },
      failure: { admitted: 0, kept: 0 },
    },
    personPoints: 0,
    modelPoints: 0,
  };

  const compactions: CompactionBoundary[] = [];
  const extracts: Extract[] = [];

  const take = (line: string): void => {
    if (line === '') return;
    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      coverage.unreadable += 1;
      return;
    }
    // `typeof [] === 'object'` and `[] !== null`, so a line holding a JSON
    // array passes both other checks and then reads every field as
    // `undefined` — a record counted as understood and contributing nothing,
    // which is the silent drop rather than the disclosed one
    // (`INV-nothing-is-dropped-silently`). The same guard `scanTranscript`
    // carries, for the same reason.
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
      coverage.unreadable += 1;
      return;
    }
    const row = record as {
      type?: unknown; timestamp?: unknown; message?: unknown; subtype?: unknown;
      isMeta?: unknown; isCompactSummary?: unknown; compactMetadata?: unknown;
    };
    const index = coverage.records;
    coverage.records += 1;
    const at = typeof row.timestamp === 'string' ? row.timestamp : null;

    // A compaction boundary is a `system` record carrying no `message`, so it
    // has to be read BEFORE stage 1 drops it. It is the one thing stage 1
    // would otherwise throw away that this feature needs: it is the anchor for
    // `range: { kind: 'compaction' }`.
    if (row.subtype === 'compact_boundary') {
      const meta = (typeof row.compactMetadata === 'object' && row.compactMetadata !== null
        ? row.compactMetadata : {}) as {
          preTokens?: unknown; postTokens?: unknown;
          cumulativeDroppedTokens?: unknown; trigger?: unknown;
        };
      compactions.push({
        recordIndex: index,
        at,
        preTokens: typeof meta.preTokens === 'number' ? meta.preTokens : null,
        postTokens: typeof meta.postTokens === 'number' ? meta.postTokens : null,
        cumulativeDroppedTokens: typeof meta.cumulativeDroppedTokens === 'number'
          ? meta.cumulativeDroppedTokens : null,
        trigger: typeof meta.trigger === 'string' ? meta.trigger : null,
      });
    }

    // ── STAGE 1: no `message` object. Structural, never a list of type names.
    const message = row.message;
    if (typeof message !== 'object' || message === null) {
      coverage.droppedNoMessage += 1;
      return;
    }
    const content = (message as { content?: unknown }).content;
    const turn = classifyTurn(row.type, content);
    const said = saidText(content);

    // ── STAGE 2: a message with no words in it.
    let text = said.text;
    if (text === '' && said.thinking !== '') {
      if (!resolved.includeThinking) { coverage.droppedThinking += 1; return; }
      text = said.thinking;
    } else if (text === '') {
      coverage.droppedNoText += 1;
      return;
    } else if (resolved.includeThinking && said.thinking !== '') {
      text = `${text}\n\n${said.thinking}`;
    }

    // ── STAGE 4 runs here, before stage 3, because it is the cheapest test and
    // the most important consequence: our own summary must never re-enter, on
    // either side of the exchange (design §6).
    if (isMarkedSummary(text)) { coverage.droppedOwnSummary += 1; return; }

    const speaker: 'person' | 'model' = row.type === 'user' ? 'person' : 'model';

    // ── STAGE 3: text on the person's side that no person typed.
    if (speaker === 'person') {
      const kind = syntheticKind(text, row.isMeta === true, row.isCompactSummary === true);
      if (kind === 'task-notification') { coverage.droppedTaskNotification += 1; return; }
      if (kind === 'slash-command') { coverage.droppedSlashCommand += 1; return; }
      if (kind === 'meta') { coverage.droppedMeta += 1; return; }
      if (kind === 'system-reminder') { coverage.droppedSystemReminder += 1; return; }
      if (kind === 'harness-compaction-summary') {
        coverage.droppedHarnessCompactionSummary += 1;
        return;
      }
    }

    coverage.textRecords += 1;
    extracts.push({ recordIndex: index, at, speaker, turn, text });
  };

  let fd: number;
  try {
    fd = openSync(file, 'r');
  } catch {
    // A transcript that cannot be opened is an empty summary that SAYS it read
    // nothing, never a throw. Design §8: a pruned session is a state this
    // feature reports, because a session never marked persistent cannot be
    // restored by it either.
    return {
      file, options: resolved, coverage, compactions, points: [],
      marker: SESSION_SUMMARY_MARKER,
    };
  }

  const buffer = Buffer.alloc(CHUNK_BYTES);
  let carry = '';
  try {
    while (coverage.readBytes < resolved.upToBytes) {
      const want = Math.min(CHUNK_BYTES, resolved.upToBytes - coverage.readBytes);
      const read = readSync(fd, buffer, 0, want, null);
      if (read <= 0) break;
      coverage.readBytes += read;
      const parts = (carry + buffer.toString('utf8', 0, read)).split('\n');
      carry = parts.pop() ?? '';
      for (const part of parts) take(part);
    }
    // The trailing fragment is a whole line only when the read reached the end
    // of the FILE. If the snapshot offset stopped us mid-record, parsing it
    // would turn the bound into a phantom `unreadable` — `scanTranscript`'s own
    // rule, which is why the comparison is against the file size and not
    // against `upToBytes`.
    if (coverage.readBytes >= fileBytes) take(carry);
  } catch {
    // A read that failed part-way keeps what it read. `readBytes` says how far
    // it got and the review form prints it beside `upToBytes`.
  } finally {
    try { closeSync(fd); } catch { /* nothing usable to close */ }
  }

  return finish(file, resolved, coverage, compactions, extracts);
}

/**
 * Where the range starts, as a record index.
 *
 * A `timestamp` that is after everything in the file returns
 * `Number.MAX_SAFE_INTEGER` — an EMPTY range that the coverage block reports
 * as "everything was out of range", rather than being silently widened back to
 * the whole file. A range that quietly means something other than what was
 * asked for is the failure this whole design is about.
 */
function rangeStart(
  range: SummaryRange, compactions: CompactionBoundary[], extracts: Extract[],
): number {
  if (range.kind === 'record') return Math.max(0, range.index);
  if (range.kind === 'timestamp') {
    for (const extract of extracts) {
      if (extract.at !== null && extract.at >= range.at) return extract.recordIndex;
    }
    return Number.MAX_SAFE_INTEGER;
  }
  if (range.kind === 'compaction') {
    if (compactions.length === 0) return 0;
    const nth = range.nth < 0 ? compactions.length + range.nth : range.nth - 1;
    const at = compactions[Math.min(Math.max(nth, 0), compactions.length - 1)];
    return at === undefined ? 0 : at.recordIndex;
  }
  return 0;
}

/**
 * Choose `cap` points from the admitted set — **by quota, never by one global
 * ranking**, and this is the single most consequential decision in the file.
 *
 * ── WHY A GLOBAL TOP-N IS WRONG HERE, MEASURED ─────────────────────────────
 *
 * The first run of this reader over the owner's own session admitted 969
 * points in these proportions:
 *
 *     measurement  550        decision  157        failure   12
 *     question     195        correction 55
 *
 * A global top-60 gave **45 slots to measurements and none at all to
 * corrections or failures** — the two categories design §4b singles out as
 * irreplaceable: *"a correction that is lost is a mistake that will be made
 * again"*, and what was tried and failed is *"the most expensive thing to
 * rediscover"*. The recipe names five things to keep, so a summary that keeps
 * one of them is not this recipe implemented, it is this recipe defeated by
 * its own scoring.
 *
 * The categories are not commensurable and pretending they are is the bug. A
 * quota says so.
 *
 * ── THE TWO PASSES ────────────────────────────────────────────────────────
 *
 *   1. **The person's reserve first.** Up to `PERSON_RESERVE` of the cap goes
 *      to what the owner typed, spread across categories the same way. See
 *      `ADMIT_SCORE_PERSON` for the measurement: 7 of 969 without it.
 *   2. **The rest by even category quota**, with whatever a thin category
 *      cannot use handed back to the categories that still have surplus. An
 *      even split alone would waste `failure`'s 12 slots when only 12 exist;
 *      redistribution is what keeps the cap meaningful.
 *
 * Within any bucket the order is by score, then by position in the file.
 */
function allocate<T extends { category: PointCategory; speaker: 'person' | 'model'; score: number; recordIndex: number }>(
  admitted: T[], cap: number,
): T[] {
  if (cap <= 0) return [];
  if (admitted.length <= cap) return [...admitted];

  const rank = (a: T, b: T): number => (b.score - a.score) || (a.recordIndex - b.recordIndex);
  const chosen: T[] = [];
  const taken = new Set<T>();

  /** Fill `budget` slots from `pool`, evenly across categories, redistributing. */
  const fill = (pool: T[], budget: number): number => {
    const queues = new Map<PointCategory, T[]>();
    for (const category of POINT_CATEGORIES) {
      queues.set(category, pool.filter((p) => p.category === category && !taken.has(p)).sort(rank));
    }
    let spent = 0;
    // Round-robin rather than a computed share: a category with nothing left is
    // simply skipped on its turn, so redistribution needs no second pass and no
    // arithmetic anybody has to check.
    let progress = true;
    while (spent < budget && progress) {
      progress = false;
      for (const category of POINT_CATEGORIES) {
        if (spent >= budget) break;
        const queue = queues.get(category);
        const next = queue?.shift();
        if (next === undefined) continue;
        chosen.push(next);
        taken.add(next);
        spent += 1;
        progress = true;
      }
    }
    return spent;
  };

  const reserve = Math.min(Math.floor(cap * PERSON_RESERVE), admitted.filter((p) => p.speaker === 'person').length);
  const usedByPerson = fill(admitted.filter((p) => p.speaker === 'person'), reserve);
  fill(admitted, cap - usedByPerson);
  return chosen;
}

/** Range, subjects, scoring, dedupe, quota, numbering. Split out to stay readable. */
function finish(
  file: string,
  options: SessionSummary['options'],
  coverage: SummaryCoverage,
  compactions: CompactionBoundary[],
  extracts: Extract[],
): SessionSummary {
  const start = rangeStart(options.range, compactions, extracts);
  const subjects = options.subjects.map((s) => s.toLowerCase()).filter((s) => s !== '');

  interface Scored extends SummaryPoint { key: string }
  const scored: Scored[] = [];

  for (const extract of extracts) {
    if (extract.recordIndex < start) { coverage.droppedOutOfRange += 1; continue; }
    if (extract.speaker === 'person') coverage.personChars += extract.text.length;
    else coverage.modelChars += extract.text.length;

    // Design §4b: code and file contents are already on disk and a copy goes
    // stale, so with `includeCode` off the fences come out BEFORE scoring —
    // otherwise a paragraph earns its place on words inside a code sample.
    const body = options.includeCode ? extract.text : extract.text.replace(FENCE_PATTERN, ' ');

    if (subjects.length > 0) {
      const lower = body.toLowerCase();
      if (!subjects.some((s) => lower.includes(s))) { coverage.droppedOffSubject += 1; continue; }
    }

    const person = extract.speaker === 'person';
    for (const candidate of candidatesOf(body, options.maxPointChars * 3)) {
      coverage.candidates += 1;
      if (NARRATION_PATTERN.test(candidate)) continue;
      if (!options.includeCode
        && (CODE_HEAVY_PATTERN.test(candidate) || looksLikeTable(candidate))) continue;
      if (person && candidate.length < MIN_PERSON_CHARS) {
        coverage.droppedTooShort += 1;
        continue;
      }
      const hit = scoreCandidate(candidate, person ? ADMIT_SCORE_PERSON : ADMIT_SCORE);
      if (hit === null) continue;
      coverage.scored += 1;
      scored.push({
        n: 0,
        category: hit.category,
        recordIndex: extract.recordIndex,
        at: extract.at,
        speaker: extract.speaker,
        turn: extract.turn,
        text: candidate,
        reason: reasonOf(candidate),
        cues: hit.cues,
        score: hit.score,
        key: dedupeKey(candidate),
      });
    }
  }

  scored.sort((a, b) => (b.score - a.score) || (a.recordIndex - b.recordIndex));

  const seen = new Set<string>();
  const admitted: Scored[] = [];
  for (const point of scored) {
    if (seen.has(point.key)) { coverage.droppedDuplicate += 1; continue; }
    seen.add(point.key);
    admitted.push(point);
  }
  for (const point of admitted) coverage.byCategory[point.category].admitted += 1;

  const kept = allocate(admitted, options.maxPoints);
  coverage.droppedOverCap = admitted.length - kept.length;
  for (const point of kept) {
    coverage.byCategory[point.category].kept += 1;
    if (point.speaker === 'person') coverage.personPoints += 1;
    else coverage.modelPoints += 1;
  }

  // Numbered in FILE order, not score order. The owner reads a session, and a
  // session has a direction; a list ordered by a score he cannot see reads as
  // arbitrary. The quota chose WHICH points; the file chooses their order.
  kept.sort((a, b) => a.recordIndex - b.recordIndex);
  const points: SummaryPoint[] = kept.map((p, i) => ({
    n: i + 1,
    category: p.category,
    recordIndex: p.recordIndex,
    at: p.at,
    speaker: p.speaker,
    turn: p.turn,
    text: p.text,
    reason: p.reason,
    cues: p.cues,
    score: p.score,
  }));

  return { file, options, coverage, compactions, points, marker: SESSION_SUMMARY_MARKER };
}

/** One point, flattened and cut to length, SAYING it was cut. */
function oneLine(text: string, cap: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= cap ? flat : `${flat.slice(0, cap - 1)}…`;
}

/** The range, in the words the option was given in. */
function describeRange(summary: SessionSummary): string {
  const r = summary.options.range;
  if (r.kind === 'whole') return 'the whole session';
  if (r.kind === 'record') return `from record ${r.index}`;
  if (r.kind === 'timestamp') return `from ${r.at}`;
  return r.nth < 0
    ? `from the last compaction (${summary.compactions.length} in the file)`
    : `from compaction ${r.nth} of ${summary.compactions.length}`;
}

/**
 * The SHORT form the owner reads and approves — design §5, and his words:
 * *"the summary content to be injected should be also shortened only for user
 * review in numbered points of the main subjects included."*
 *
 * It opens with COVERAGE rather than closing with it, because §5 says he is
 * approving a summary he has not read in full: how much was read and what was
 * dropped is the thing he needs first, not a footnote under the points.
 */
export function renderReviewForm(summary: SessionSummary): string {
  const c = summary.coverage;
  const out: string[] = [];
  const pct = (n: number): string =>
    (c.records === 0 ? '0%' : `${(n / c.records * 100).toFixed(1)}%`);
  const stage3 = c.droppedTaskNotification + c.droppedSlashCommand + c.droppedMeta
    + c.droppedSystemReminder + c.droppedHarnessCompactionSummary;

  out.push(`Session summary — review form  [${summary.marker}]`);
  out.push(`  ${summary.file}`);
  out.push('');
  out.push('COVERAGE — what was read, and what was dropped before anything was judged');
  out.push(`  file now                    ${c.fileBytes.toLocaleString()} bytes`);
  out.push(`  read up to                  ${c.upToBytes.toLocaleString()} bytes`
    + (c.upToBytes < c.fileBytes
      ? `   A SNAPSHOT — the file has grown ${(c.fileBytes - c.upToBytes).toLocaleString()} bytes since`
      : '   (the whole file)'));
  out.push(`  bytes actually read         ${c.readBytes.toLocaleString()}`
    + (c.readBytes < c.upToBytes ? '   THE READ STOPPED EARLY' : ''));
  out.push(`  records                     ${c.records.toLocaleString()}`
    + (c.unreadable > 0 ? `   (${c.unreadable} lines would not parse)` : ''));
  out.push(`  1  no message object       -${c.droppedNoMessage.toLocaleString()}   ${pct(c.droppedNoMessage)} of the file, on a structural test`);
  out.push(`  2  no words in the message -${c.droppedNoText.toLocaleString()}   tool calls and tool results`
    + (c.droppedThinking > 0 ? `; thinking -${c.droppedThinking.toLocaleString()}` : ''));
  out.push(`  3  not typed by a person   -${stage3.toLocaleString()}   task-notifications ${c.droppedTaskNotification}`
    + `, slash ${c.droppedSlashCommand}, meta ${c.droppedMeta}`
    + `, reminders ${c.droppedSystemReminder}`
    + `, harness compaction summaries ${c.droppedHarnessCompactionSummary}`);
  out.push(`  4  our own summaries       -${c.droppedOwnSummary.toLocaleString()}   the loop guard`);
  out.push(`  records with words          ${c.textRecords.toLocaleString()}`);
  if (c.droppedOutOfRange > 0) {
    out.push(`  outside the range          -${c.droppedOutOfRange.toLocaleString()}`);
  }
  if (c.droppedOffSubject > 0) {
    out.push(`  off the named subjects     -${c.droppedOffSubject.toLocaleString()}`);
  }
  out.push(`  words a person typed        ${c.personChars.toLocaleString()} chars`);
  out.push(`  words the model spoke       ${c.modelChars.toLocaleString()} chars`);
  out.push(`  candidates                  ${c.candidates.toLocaleString()} scored`
    + ` → ${c.scored.toLocaleString()} admitted`
    + ` → -${c.droppedDuplicate.toLocaleString()} duplicates`
    + (c.droppedTooShort > 0 ? ` → -${c.droppedTooShort.toLocaleString()} person turns too short` : '')
    + (c.droppedOverCap > 0
      ? ` → -${c.droppedOverCap.toLocaleString()} OVER THE CAP of ${summary.options.maxPoints}`
      : '')
    + ` → ${summary.points.length} kept`);
  out.push('');
  out.push('WHAT WAS AVAILABLE AGAINST WHAT WAS KEPT — the categories are not');
  out.push('commensurable, so the cap is a QUOTA and this is where it fell');
  for (const category of POINT_CATEGORIES) {
    const row = c.byCategory[category];
    out.push(`  ${category.padEnd(12)} ${String(row.kept).padStart(4)} kept of ${row.admitted.toLocaleString()} available`
      + (row.admitted > 0 && row.kept === 0 ? '   NOTHING KEPT — ask for more points or narrow the range' : ''));
  }
  out.push(`  by speaker    ${c.personPoints} the owner typed · ${c.modelPoints} the model spoke`);
  out.push('');
  out.push('OPTIONS USED');
  out.push(`  range: ${describeRange(summary)}`);
  out.push(`  subjects: ${summary.options.subjects.length === 0 ? 'all' : summary.options.subjects.join(', ')}`
    + `   depth: ${summary.options.depth}`
    + `   code: ${summary.options.includeCode ? 'INCLUDED' : 'skipped'}`
    + `   thinking: ${summary.options.includeThinking ? 'included' : 'skipped'}`);
  out.push('');
  if (summary.compactions.length > 0) {
    out.push(`COMPACTIONS THIS FILE HAS ALREADY SURVIVED — ${summary.compactions.length}`);
    for (const b of summary.compactions) {
      out.push(`  record ${String(b.recordIndex).padStart(6)}  ${b.at ?? 'no timestamp'}`
        + `  ${b.preTokens?.toLocaleString() ?? '?'} → ${b.postTokens?.toLocaleString() ?? '?'} tokens`
        + `  (dropped in total ${b.cumulativeDroppedTokens?.toLocaleString() ?? '?'})`);
    }
    out.push('');
  }
  out.push(`POINTS — ${summary.points.length}, in file order`);
  if (summary.points.length === 0) {
    out.push('  (none — nothing in range reached the admission threshold)');
  }
  for (const point of summary.points) {
    out.push(`  ${String(point.n).padStart(3)}. [${point.category}] `
      + `${point.speaker === 'person' ? 'OWNER' : 'agent'} @${point.recordIndex}  `
      + oneLine(point.text, 300));
    if (summary.options.depth === 'points+reasoning' && point.reason !== null) {
      out.push(`       reason: ${oneLine(point.reason, 240)}`);
    }
  }
  out.push('');
  out.push('WHAT THIS DELIBERATELY DOES NOT HOLD — design §4b');
  out.push('  tool outputs (reproducible by running the tool again), file contents'
    + (summary.options.includeCode ? ' EXCEPT code, which you asked for' : ' and code (already on disk)')
    + ', anything the corpus already injects on its own account, and process narration.');
  return out.join('\n');
}

/**
 * The PAYLOAD — what `seq:2` would stage and inject. Longer than the review
 * form, grouped by category, and it carries the marker on its FIRST line so
 * the loop guard can see it (design §6).
 *
 * **Building this writes nothing.** Returning a string is the whole of this
 * module's contribution to the injection half; staging it to disk is `seq:2`'s
 * work, and design §3 step 5 is explicit that the staging must complete and be
 * verifiable on disk before the owner is told it is safe to clear.
 */
export function renderPayload(summary: SessionSummary): string {
  const out: string[] = [];
  out.push(`[${summary.marker}] restored from this session's own transcript`);
  out.push(`source: ${summary.file} · up to byte ${summary.coverage.upToBytes.toLocaleString()}`
    + ` · ${summary.coverage.records.toLocaleString()} records`
    + ` · ${summary.points.length} points`);
  out.push('');
  out.push('This is a summary of a conversation whose window was cleared. It holds what was'
    + ' decided and why, what was corrected, what was measured, what is still open, and what'
    + ' was tried and failed. It deliberately holds no tool output and no file contents.');
  for (const category of POINT_CATEGORIES) {
    const inCategory = summary.points.filter((p) => p.category === category);
    if (inCategory.length === 0) continue;
    out.push('');
    out.push(`## ${category.toUpperCase()}`);
    for (const point of inCategory) {
      out.push(`${point.n}. ${oneLine(point.text, summary.options.maxPointChars)}`);
      if (summary.options.depth === 'points+reasoning' && point.reason !== null) {
        out.push(`   — ${oneLine(point.reason, summary.options.maxPointChars)}`);
      }
    }
  }
  return out.join('\n');
}

/** What the archive's scanner and this reader disagree about. Empty is the pass. */
export interface CrossCheck {
  field: string;
  archive: number;
  reader: number;
}

/**
 * Run the archive's own `scanTranscript` over the same file and the same byte
 * cap, and return every count the two walks disagree about.
 *
 * This is design §8 made testable. The walk itself cannot be shared today (see
 * the header), so the next best thing is that a divergence turns a test red on
 * the day it appears rather than showing up months later as two screens
 * quoting different numbers for the same session.
 *
 * `scanTranscript` is imported lazily so the comparison is opt-in: a summary
 * run must not pay for a second 61 MB walk unless somebody asked for the check.
 */
export async function crossCheckAgainstIndex(
  file: string, summary: SessionSummary,
): Promise<CrossCheck[]> {
  const { scanTranscript } = await import('./conversation-index.ts');
  const scan = scanTranscript(file, summary.coverage.upToBytes);
  const out: CrossCheck[] = [];
  if (scan.records !== summary.coverage.records) {
    out.push({ field: 'records', archive: scan.records, reader: summary.coverage.records });
  }
  if (scan.unreadable !== summary.coverage.unreadable) {
    out.push({ field: 'unreadable', archive: scan.unreadable, reader: summary.coverage.unreadable });
  }
  if (scan.scannedBytes !== summary.coverage.readBytes) {
    out.push({ field: 'scannedBytes', archive: scan.scannedBytes, reader: summary.coverage.readBytes });
  }
  return out;
}
