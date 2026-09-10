#!/usr/bin/env node
/**
 * **Backfill `Item.request` by EXTRACTION — never by reconstruction.**
 * D41 spec §16a, plan Task 18.
 *
 *     node scripts/backfill-requests.ts [<workspace root>]            # dry run + report
 *     node scripts/backfill-requests.ts [<workspace root>] --apply    # writes
 *     node scripts/backfill-requests.ts [<workspace root>] --clear    # the undo
 *     node scripts/backfill-requests.ts [<workspace root>] --clear --apply
 *
 * `<workspace root>` is the `.my_context` directory, defaulting to
 * `<cwd>/.my_context`. `--audit <dir>` and `--transcripts <dir>` point the two
 * read-only inputs elsewhere, which is what makes a rehearsal against a COPY of
 * the corpus possible: copy `items/` somewhere, run against the copy, diff.
 *
 * ── THE ONE RULE ───────────────────────────────────────────────────────────
 *
 * **The owner's words are FOUND or the field stays empty.** D37 indexes the
 * sessions, so the literal prompt exists on disk and can be located. Inventing
 * a plausible request from what an item says would be a paraphrase wearing
 * quotation marks, and it would be undetectable afterwards precisely because it
 * would read like a real request. The spec's instruction is not "fill what you
 * can" — it is *"if found a user prompt and it's reliable reconstruct otherwise
 * skip"*, and this script's default answer is skip.
 *
 * ── THE TRAP THIS SCRIPT IS SHAPED AROUND ──────────────────────────────────
 *
 * **A lane's DISPATCH BRIEF is stored as a `type: 'user'` record.** `plan:loop
 * seq:2` measured it on 2026-09-10: a naive sweep for "user prompts" finds
 * **1,453,700 characters of person-side text across 280 lane transcripts — 33x
 * the 44,006 characters the owner actually typed, and none of it his.** A brief
 * is the coordinator model's prose quoting items that are already in the
 * corpus; written into `request` it would read exactly like a request, and the
 * field's only value — that these are HIS words — would be gone with nothing
 * anywhere saying so.
 *
 * `loop/2` answered it in `src/review/input.ts` with a rule rather than a
 * filter: *"in a lane transcript, nobody typed anything, and every person-side
 * point is dropped"*, disclosing the count as `briefPoints`. **This script
 * applies the same rule one level up, structurally: only the files
 * `listTranscriptFiles` returns — the top-level session transcripts — are ever
 * opened for candidates.** `listSubagentFiles`' output is opened only to COUNT
 * what was excluded (`lanes` in the report), never to read a candidate from,
 * and the two walks are different functions so that no future edit can make one
 * feed the other by accident.
 *
 * ── "RELIABLE", DEFINED BEFORE THE SWEEP RAN ───────────────────────────────
 *
 * All five must hold. Each failure has its own name in the report, because a
 * coverage number nobody can interrogate is a number nobody can trust —
 * `state_unaudited`'s disclosure is the worked example.
 *
 *  **R1 · A person created it.** The audit log has a `mutation/create` record
 *  for the id with `origin: human`. An `origin: agent` item was not asked for
 *  in words by anybody, and spec §16a says such an item has no request and must
 *  not be given one. → `agent_origin`, `no_create_record`.
 *
 *  **R2 · A surviving transcript covers the moment.** Exactly one top-level
 *  session file has records both at-or-before and at-or-after the create
 *  timestamp. Two would mean two sessions were live and nothing says which one
 *  wrote the item. → `no_transcript`, `ambiguous_session`.
 *
 *  **R3 · The item QUOTES the prompt.** Among the owner's own turns in that
 *  session inside the `WINDOW_MS` ending at the create, the winner is the one
 *  whose longest run of text shared with the item's title-and-body is at least
 *  `MIN_PHRASE_CHARS` characters, and at least `MIN_PHRASE_MARGIN` characters
 *  longer than the runner-up's.
 *
 *  This is the whole of what makes an extraction an extraction. Adjacency is
 *  not evidence: "the last thing he typed before the write" is true of some
 *  prompt for every item ever created, including the 755 whose transcripts no
 *  longer exist. A contiguous 40-character run that appears in both his message
 *  and the item is not a coincidence — it is the item quoting him, which is
 *  what this corpus does constantly and on purpose. → `no_evidence`,
 *  `ambiguous_candidate`.
 *
 *  **R4 · Nothing synthetic.** The turn is `type: 'user'`, carries real text
 *  (`classifyTurn`), and `syntheticKind` (session-summary.ts) says it is not a
 *  task notification, a slash-command wrapper, a meta turn, a system reminder
 *  or a harness compaction summary — the same list the summariser drops,
 *  imported rather than copied. Embedded `<system-reminder>` blocks, which the
 *  harness appends INSIDE a real message, are cut out and counted.
 *
 *  **R5 · It survives the round trip.** `validateRequest` accepts it. A prompt
 *  carrying a `## ` line cannot be stored verbatim in a `## Request` section,
 *  and this script will not edit it to make it fit. → `unrenderable`.
 *
 * **Which message is THE request, when a request spans messages:** the winner,
 * plus any immediately preceding owner turns with no assistant turn between
 * them, joined in order with a blank line. That is one utterance the harness
 * happened to record as several records — he pressed enter twice — and it is
 * the only joining this script does. Two owner turns separated by an answer are
 * two asks, and only the one the item quotes is recorded.
 *
 * ── REVERSIBLE, AND THAT IS A PROPERTY OF THE FIELD, NOT OF THIS SCRIPT ────
 *
 * `--clear` removes every `## Request` section. It can restore the corpus
 * byte-for-byte because `request` is absent from `computeItemChecksum` and from
 * `ContentShape` (see both, and `Item.request`): the recorded checksum, the
 * summary and its basis are all untouched in both directions. This script also
 * refuses to write any file whose `renderItem(parseItem(file))` is not already
 * byte-identical to what is on disk — the guard
 * `restamp-summary-basis-lifecycle.ts` uses, for its reason: a migration asked
 * to add one section must not silently reformat a hand-authored file.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  classifyTurn, iterateTranscript, listSubagentFiles, listTranscriptFiles, transcriptDir,
  MAX_SCAN_BYTES,
} from '../src/core/conversation-index.ts';
import { parseItem, renderItem } from '../src/core/item.ts';
import { isMainEntry } from '../src/core/paths.ts';
import { writeItem } from '../src/core/rebuild.ts';
import { saidText, syntheticKind } from '../src/core/session-summary.ts';
import { validateRequest } from '../src/core/validate.ts';
import type { Item } from '../src/core/types.ts';

/* ========================================================================== *
 * THE THRESHOLDS, AND THE REASON FOR EACH NUMBER.
 * ========================================================================== */

/**
 * **How far back from the create the ask may be. Four hours.**
 *
 * An item is often written several turns after it was asked for — the spec says
 * so — and this owner's sessions run for hours, so a tight window would drop
 * correct matches silently, which is the failure that costs the most and shows
 * the least. It can afford to be generous because it is NOT what decides a
 * match: `MIN_PHRASE_CHARS` is. The window only bounds the search.
 */
const WINDOW_MS = 4 * 60 * 60 * 1000;

/**
 * **The shortest run of shared text that counts as the item quoting him. 40
 * characters.**
 *
 * Short enough that a single quoted clause qualifies; long enough that it
 * cannot happen by accident between two English texts about the same subject.
 * Forty characters is roughly seven words, and seven words in the same order
 * are not a coincidence — the shared boilerplate that WOULD recur ("this
 * project", "the owner ruled", an item id) is far shorter than that.
 */
const MIN_PHRASE_CHARS = 40;

/**
 * **How much the winner must beat the runner-up by. 10 characters.**
 *
 * Two candidate prompts sharing runs of 41 and 40 characters with one item is
 * an ambiguous mapping, and the spec's instruction for an ambiguous mapping is
 * to skip. A clear winner is one that quotes MORE, not one that quotes first.
 */
const MIN_PHRASE_MARGIN = 10;

/**
 * Longest common substring is O(n·m); a 90 KB prompt against a 40 KB body is
 * 3.6 billion cell comparisons. Both sides are capped — the head of each, since
 * an item quotes the ask and an ask states its subject early — and the cap is
 * disclosed rather than silent: a truncated comparison can only ever produce a
 * SHORTER shared run, so it can lose a match but never invent one.
 */
const COMPARE_CAP_CHARS = 20_000;

/** The harness's own name for a session's lane transcripts. Spelled once. */
const SUBAGENTS_DIR = 'subagents';

/* ========================================================================== *
 * THE SHAPES.
 * ========================================================================== */

/** Why an item was not filled. Every one of these is counted and printed. */
export type SkipWhy =
  | 'agent_origin'
  | 'no_create_record'
  | 'no_transcript'
  | 'ambiguous_session'
  | 'no_candidate'
  | 'no_evidence'
  | 'ambiguous_candidate'
  | 'unrenderable'
  | 'already_has_one';

/** One owner turn, after the structural filters and before the evidence test. */
export interface OwnerTurn {
  sessionId: string;
  /** 0-based record index in the transcript, so a match can be looked up. */
  index: number;
  at: number;
  text: string;
  /** True when an assistant turn came between this record and the previous one. */
  afterAnswer: boolean;
}

export interface Filled {
  id: string;
  request: string;
  sessionId: string;
  index: number;
  /** The longest run of text the item and the prompt share, verbatim. */
  phrase: string;
  /** How many records were joined as one utterance (1 = no joining). */
  joined: number;
  lagMs: number;
}

export interface Skipped {
  id: string;
  why: SkipWhy;
  /** The best evidence found, when there was any — so a skip can be argued with. */
  note?: string;
}

export interface LaneDisclosure {
  files: number;
  bytes: number;
  /** `type: 'user'` records carrying real text — every one a dispatch brief. */
  personRecords: number;
  personChars: number;
}

export interface Report {
  root: string;
  items: number;
  filled: Filled[];
  skipped: Skipped[];
  lanes: LaneDisclosure;
  sessions: { sessionId: string; prompts: number; from: string; to: string }[];
  /** `<system-reminder>` blocks cut out of otherwise-real owner turns. */
  remindersStripped: number;
  refused: string[];
}

/* ========================================================================== *
 * READING THE OWNER'S OWN TURNS — AND ONLY THOSE.
 * ========================================================================== */

/**
 * The harness appends `<system-reminder>` blocks INSIDE a real user message, as
 * extra text blocks in the same envelope. `syntheticKind` only reads the head
 * of the text, so a reminder appended to a genuine prompt is not caught there
 * and must be cut here.
 *
 * **Cutting it is not editing his words.** The block was inserted by the
 * harness into the same message; removing it leaves what the person typed and
 * nothing else. The count is disclosed in the report for the reason `loop/2`
 * discloses `briefPoints`: a removal this large that reported nothing would be
 * a silent drop wearing a fix's clothes.
 */
export function stripReminders(text: string): { text: string; stripped: number } {
  let stripped = 0;
  const out = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, () => {
    stripped += 1;
    return '';
  });
  return { text: out.trim(), stripped };
}

/**
 * Every turn the OWNER typed in one session transcript, in file order.
 *
 * The caller passes a session file — never a lane file. That separation is the
 * dispatch-brief filter, and it is structural: this function has no way to tell
 * the two apart, so it must never be handed the wrong one, and the only caller
 * that produces its argument list is `listTranscriptFiles`.
 */
export function ownerTurns(
  file: string, sessionId: string, cap = MAX_SCAN_BYTES,
): { turns: OwnerTurn[]; remindersStripped: number } {
  const turns: OwnerTurn[] = [];
  let remindersStripped = 0;
  let sawAnswer = true;

  for (const rec of iterateTranscript(file, { cap })) {
    const r = rec.record;
    if (r === null) continue;
    const message = r.message as { content?: unknown } | undefined;
    const content = message?.content;

    if (r.type === 'assistant') {
      if (classifyTurn('assistant', content) === 'answer') sawAnswer = true;
      continue;
    }
    if (r.type !== 'user') continue;
    if (classifyTurn('user', content) !== 'prompt') continue;

    const said = typeof content === 'string' ? content : saidText(content).text;
    // R4: the same list `session-summary.ts` drops, imported and not copied.
    if (syntheticKind(said, r.isMeta === true, r.isCompactSummary === true) !== null) continue;

    const cut = stripReminders(said);
    remindersStripped += cut.stripped;
    if (cut.text === '') continue;

    const at = Date.parse(String(r.timestamp ?? ''));
    if (Number.isNaN(at)) continue;

    turns.push({ sessionId, index: rec.index, at, text: cut.text, afterAnswer: sawAnswer });
    sawAnswer = false;
  }
  return { turns, remindersStripped };
}

/**
 * What the lane transcripts hold, measured and NOT used.
 *
 * This is the only place `listSubagentFiles` is called, and nothing it returns
 * reaches `ownerTurns`. The number exists so the report can say how large the
 * thing avoided actually was in THIS corpus, rather than citing `loop/2`'s
 * measurement of it and hoping the shape has not changed.
 */
export function measureLanes(dir: string): LaneDisclosure {
  const out: LaneDisclosure = { files: 0, bytes: 0, personRecords: 0, personChars: 0 };
  for (const lane of listSubagentFiles(dir)) {
    out.files += 1;
    out.bytes += lane.bytes;
    for (const rec of iterateTranscript(lane.file)) {
      const r = rec.record;
      if (r === null || r.type !== 'user') continue;
      const content = (r.message as { content?: unknown } | undefined)?.content;
      if (classifyTurn('user', content) !== 'prompt') continue;
      const said = typeof content === 'string' ? content : saidText(content).text;
      if (syntheticKind(said, r.isMeta === true, r.isCompactSummary === true) !== null) continue;
      out.personRecords += 1;
      out.personChars += said.length;
    }
  }
  return out;
}

/* ========================================================================== *
 * THE EVIDENCE TEST.
 * ========================================================================== */

/**
 * Whitespace-normalised, lower-cased text, with the ORIGINAL offset of every
 * kept character — so the phrase reported in the evidence can be quoted back
 * out of the real message rather than out of the normalised one.
 */
function normalise(text: string): { chars: string; from: number[] } {
  const chars: string[] = [];
  const from: number[] = [];
  let lastWasSpace = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (lastWasSpace) continue;
      chars.push(' ');
      from.push(i);
      lastWasSpace = true;
      continue;
    }
    chars.push(ch.toLowerCase());
    from.push(i);
    lastWasSpace = false;
  }
  while (chars.length > 0 && chars[chars.length - 1] === ' ') { chars.pop(); from.pop(); }
  return { chars: chars.join(''), from };
}

/**
 * **The longest run of text two strings share, after whitespace and case are
 * normalised away.** Rolling two-row dynamic programming, so memory is one row
 * rather than the whole table.
 *
 * Normalising first is not a loosening of the test — it is what stops a
 * re-wrapped quote (the item's body is hard-wrapped; his message is not) from
 * reading as no quote at all. What it must NOT do is let two different texts
 * look alike, and case plus whitespace cannot do that at 40 characters.
 */
export function longestSharedRun(a: string, b: string): string {
  const A = normalise(a.slice(0, COMPARE_CAP_CHARS));
  const B = normalise(b.slice(0, COMPARE_CAP_CHARS));
  const n = A.chars.length;
  const m = B.chars.length;
  if (n === 0 || m === 0) return '';

  let previous = new Uint32Array(m + 1);
  let current = new Uint32Array(m + 1);
  let best = 0;
  let bestEndA = 0;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      current[j] = A.chars[i - 1] === B.chars[j - 1] ? previous[j - 1] + 1 : 0;
      if (current[j] > best) { best = current[j]; bestEndA = i; }
    }
    const swap = previous; previous = current; current = swap;
    current.fill(0);
  }
  if (best === 0) return '';
  // Back out of the normalised string into the ORIGINAL one, so the evidence a
  // reader is shown is text that really appears in the message.
  const startOriginal = A.from[bestEndA - best];
  const endOriginal = A.from[bestEndA - 1];
  return a.slice(startOriginal, endOriginal + 1);
}

/* ========================================================================== *
 * THE AUDIT LOG — WHO CREATED WHAT, AND WHEN.
 * ========================================================================== */

export interface CreateRecord { at: number; origin: string }

/**
 * The `mutation/create` records, from the append-only JSONL rather than from
 * `audit.db`.
 *
 * The JSONL is authoritative and the database is a derived projection that is
 * safe to delete (`REQ-changes-are-timestamped-and-audited`), so reading the
 * text costs a few seconds and cannot contend with a live writer for a lock —
 * which matters here, because this script may be run while the owner's own
 * session is writing to that database.
 *
 * The FIRST create wins when an id appears twice: a re-created id is a
 * different item's history, and the request that produced the item is the one
 * that produced it the first time.
 */
export function readCreates(auditDir: string): Map<string, CreateRecord> {
  const out = new Map<string, CreateRecord>();
  let names: string[];
  try {
    names = readdirSync(auditDir).filter((n) => n.endsWith('.jsonl')).sort();
  } catch {
    return out;
  }
  for (const name of names) {
    let text: string;
    try {
      text = readFileSync(path.join(auditDir, name), 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      if (line === '' || !line.includes('"create"')) continue;
      let rec: Record<string, unknown>;
      try {
        rec = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (rec.op !== 'create' || rec.kind !== 'mutation') continue;
      const id = typeof rec.itemId === 'string' ? rec.itemId : null;
      const at = Date.parse(String(rec.at ?? ''));
      if (id === null || Number.isNaN(at)) continue;
      if (out.has(id)) continue;
      out.set(id, { at, origin: String(rec.origin ?? 'human') });
    }
  }
  return out;
}

/* ========================================================================== *
 * THE SWEEP.
 * ========================================================================== */

function walk(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

export interface SweepOptions {
  root: string;
  auditDir: string;
  transcripts: string;
  apply: boolean;
  clear: boolean;
  /** Skip the lane measurement — the one part that reads hundreds of MB. */
  skipLaneMeasurement?: boolean;
}

export function sweep(options: SweepOptions): Report {
  const { root, auditDir, transcripts, apply, clear } = options;
  const report: Report = {
    root,
    items: 0,
    filled: [],
    skipped: [],
    lanes: { files: 0, bytes: 0, personRecords: 0, personChars: 0 },
    sessions: [],
    remindersStripped: 0,
    refused: [],
  };

  const files = walk(path.join(root, 'items')).sort();
  report.items = files.length;

  /* ---- the undo, which needs none of the machinery below ---------------- */
  if (clear) {
    for (const file of files) {
      const rel = path.relative(root, file).split(path.sep).join('/');
      const raw = readFileSync(file, 'utf8');
      let item: Item;
      try {
        item = parseItem(raw, rel, 'project');
      } catch (err) {
        report.refused.push(`${rel}: unparseable — ${err instanceof Error ? err.message : err}`);
        continue;
      }
      if (item.request === undefined) continue;
      const cleared: Item = { ...item };
      delete cleared.request;
      if (apply) writeItem(root, cleared);
      report.filled.push({
        id: item.id, request: item.request, sessionId: '', index: -1, phrase: '', joined: 0,
        lagMs: 0,
      });
    }
    return report;
  }

  /* ---- the owner's own turns, and nothing else -------------------------- */
  const turnsBySession = new Map<string, OwnerTurn[]>();
  for (const t of listTranscriptFiles(transcripts)) {
    const { turns, remindersStripped } = ownerTurns(t.file, t.sessionId);
    report.remindersStripped += remindersStripped;
    if (turns.length === 0) continue;
    turnsBySession.set(t.sessionId, turns);
    report.sessions.push({
      sessionId: t.sessionId,
      prompts: turns.length,
      from: new Date(turns[0].at).toISOString(),
      to: new Date(turns[turns.length - 1].at).toISOString(),
    });
  }
  if (options.skipLaneMeasurement !== true) {
    for (const session of listTranscriptFiles(transcripts)) {
      // `subagentDir` (conversation-index.ts) is the product's own spelling of
      // this path, and it is deliberately NOT used: it derives the transcript
      // root from the environment, and this script's whole rehearsal story
      // depends on `--transcripts` pointing somewhere else. The one segment
      // that is the harness's own name is `SUBAGENTS_DIR`, spelled once.
      const lanes = measureLanes(path.join(transcripts, session.sessionId, SUBAGENTS_DIR));
      report.lanes.files += lanes.files;
      report.lanes.bytes += lanes.bytes;
      report.lanes.personRecords += lanes.personRecords;
      report.lanes.personChars += lanes.personChars;
    }
  }

  const creates = readCreates(auditDir);

  for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const raw = readFileSync(file, 'utf8');
    let item: Item;
    try {
      item = parseItem(raw, rel, 'project');
    } catch (err) {
      report.refused.push(`${rel}: unparseable — ${err instanceof Error ? err.message : err}`);
      continue;
    }

    // Never overwrite. A request already recorded was recorded by somebody who
    // was there; this script was not.
    if (item.request !== undefined) {
      report.skipped.push({ id: item.id, why: 'already_has_one' });
      continue;
    }

    // R1.
    const create = creates.get(item.id);
    if (create === undefined) {
      report.skipped.push({ id: item.id, why: 'no_create_record' });
      continue;
    }
    if (create.origin !== 'human') {
      report.skipped.push({ id: item.id, why: 'agent_origin', note: create.origin });
      continue;
    }

    // R2.
    const covering: string[] = [];
    for (const [sessionId, turns] of turnsBySession) {
      const first = turns[0].at;
      const last = turns[turns.length - 1].at;
      if (create.at >= first && create.at <= last + WINDOW_MS) covering.push(sessionId);
    }
    if (covering.length === 0) {
      report.skipped.push({
        id: item.id, why: 'no_transcript', note: new Date(create.at).toISOString(),
      });
      continue;
    }
    if (covering.length > 1) {
      report.skipped.push({ id: item.id, why: 'ambiguous_session', note: covering.join(' ') });
      continue;
    }

    const turns = turnsBySession.get(covering[0])!;
    const candidates = turns.filter((t) => t.at <= create.at && create.at - t.at <= WINDOW_MS);
    if (candidates.length === 0) {
      report.skipped.push({ id: item.id, why: 'no_candidate' });
      continue;
    }

    // R3. The evidence, over the item's own words.
    const itemText = `${item.title}\n${item.body}`;
    let best: { turn: OwnerTurn; phrase: string } | null = null;
    let runnerUp = 0;
    for (const turn of candidates) {
      const phrase = longestSharedRun(turn.text, itemText);
      if (best === null || phrase.length > best.phrase.length) {
        if (best !== null) runnerUp = Math.max(runnerUp, best.phrase.length);
        best = { turn, phrase };
      } else {
        runnerUp = Math.max(runnerUp, phrase.length);
      }
    }
    if (best === null || best.phrase.length < MIN_PHRASE_CHARS) {
      report.skipped.push({
        id: item.id,
        why: 'no_evidence',
        note: `${candidates.length} candidate(s), best run ${best?.phrase.length ?? 0} chars`,
      });
      continue;
    }
    if (best.phrase.length - runnerUp < MIN_PHRASE_MARGIN) {
      report.skipped.push({
        id: item.id,
        why: 'ambiguous_candidate',
        note: `best ${best.phrase.length} vs runner-up ${runnerUp} chars`,
      });
      continue;
    }

    // The one join this script does: an utterance the harness split.
    const parts = [best.turn];
    for (let i = turns.indexOf(best.turn) - 1; i >= 0; i--) {
      if (parts[0].afterAnswer) break;
      if (turns[i].at > best.turn.at) break;
      parts.unshift(turns[i]);
    }
    const request = parts.map((p) => p.text).join('\n\n').trim();

    // R5.
    try {
      validateRequest(request);
    } catch (err) {
      report.skipped.push({
        id: item.id, why: 'unrenderable', note: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    // The byte-identity guard: a migration asked to add one section must not
    // silently reformat a file somebody wrote by hand.
    if (renderItem(item) !== raw) {
      report.refused.push(`${rel}: does not round-trip byte-identically; not rewritten`);
      continue;
    }

    const filled: Item = { ...item, request };
    if (apply) writeItem(root, filled);
    report.filled.push({
      id: item.id,
      request,
      sessionId: best.turn.sessionId,
      index: best.turn.index,
      phrase: best.phrase,
      joined: parts.length,
      lagMs: create.at - best.turn.at,
    });
  }

  return report;
}

/* ========================================================================== *
 * THE REPORT — WHY, NOT ONLY HOW MANY.
 * ========================================================================== */

const WHY_MEANS: Record<SkipWhy, string> = {
  agent_origin: 'created by an agent or an ingest, so no person asked for it in words (spec §16a)',
  no_create_record: 'no mutation/create row in the audit log — the id predates the log or was renamed',
  no_transcript: 'no surviving session transcript covers the moment it was created',
  ambiguous_session: 'two sessions were live; nothing says which one wrote it',
  no_candidate: 'the transcript covers the moment but he typed nothing in the window before it',
  no_evidence: 'no candidate prompt shares a long enough run of text with the item — adjacency is not evidence',
  ambiguous_candidate: 'two prompts quote it about equally well, so the mapping is ambiguous',
  unrenderable: 'the prompt carries a Markdown heading and cannot be stored verbatim',
  already_has_one: 'a request is already recorded; this script never overwrites one',
};

export function renderReport(report: Report, apply: boolean, clear: boolean): string {
  const out: string[] = [];
  const mode = clear
    ? (apply ? 'CLEAR — APPLIED' : 'CLEAR — DRY RUN')
    : (apply ? 'BACKFILL — APPLIED' : 'BACKFILL — DRY RUN (pass --apply to write)');
  out.push(`root: ${report.root}`);
  out.push(`${report.items} item file(s); ${mode}`);
  out.push('');

  if (clear) {
    out.push(`  requests cleared: ${report.filled.length}`);
    for (const f of report.filled) out.push(`      ${f.id}`);
    if (report.refused.length > 0) {
      out.push(`  REFUSED — nothing written: ${report.refused.length}`);
      for (const line of report.refused) out.push(`      ${line}`);
    }
    return out.join('\n');
  }

  const eligible = report.items;
  const pct = eligible === 0 ? 0 : Math.round((report.filled.length / eligible) * 1000) / 10;
  out.push(`  FILLED: ${report.filled.length} of ${eligible} (${pct}%)`);
  out.push('');

  out.push('  WHAT WAS READ, AND WHAT WAS NOT');
  for (const s of report.sessions) {
    out.push(`      session ${s.sessionId}: ${s.prompts} owner turn(s), ${s.from} .. ${s.to}`);
  }
  out.push(
    `      lane transcripts EXCLUDED: ${report.lanes.files} file(s), `
    + `${(report.lanes.bytes / 1024 / 1024).toFixed(1)} MB, holding `
    + `${report.lanes.personRecords} "person-side" record(s) / `
    + `${report.lanes.personChars.toLocaleString('en-US')} characters — every one a DISPATCH `
    + 'BRIEF, none of it his (plan:loop seq:2). Not one was read as a candidate.',
  );
  out.push(`      <system-reminder> blocks cut from real turns: ${report.remindersStripped}`);
  out.push('');

  const byWhy = new Map<SkipWhy, Skipped[]>();
  for (const s of report.skipped) {
    const list = byWhy.get(s.why) ?? [];
    list.push(s);
    byWhy.set(s.why, list);
  }
  out.push(`  SKIPPED: ${report.skipped.length}, by reason —`);
  for (const why of Object.keys(WHY_MEANS) as SkipWhy[]) {
    const list = byWhy.get(why);
    if (list === undefined) continue;
    out.push(`      ${String(list.length).padStart(5)}  ${why}`);
    out.push(`             ${WHY_MEANS[why]}`);
  }
  out.push('');

  if (report.filled.length > 0) {
    out.push('  EVERY MATCH, WITH THE EVIDENCE THAT MADE IT ONE');
    for (const f of report.filled) {
      const lag = Math.round(f.lagMs / 1000);
      out.push(`      ${f.id}`);
      out.push(
        `          session ${f.sessionId} record ${f.index}, ${lag}s before the create`
        + `${f.joined > 1 ? `, ${f.joined} records joined as one utterance` : ''}`,
      );
      out.push(`          shared run (${f.phrase.length} chars): ${JSON.stringify(f.phrase)}`);
      out.push(`          request (${f.request.length} chars): ${JSON.stringify(
        f.request.length > 220 ? `${f.request.slice(0, 220)}…` : f.request,
      )}`);
    }
    out.push('');
  }

  const shared = new Map<string, number>();
  for (const f of report.filled) {
    const key = `${f.sessionId}#${f.index}`;
    shared.set(key, (shared.get(key) ?? 0) + 1);
  }
  const multi = [...shared.entries()].filter(([, n]) => n > 1);
  out.push(
    `  ONE PROMPT, SEVERAL ITEMS: ${multi.length} prompt(s) matched more than one item`
    + `${multi.length > 0 ? ` (${multi.map(([k, n]) => `${k}×${n}`).join(', ')})` : ''}. `
    + 'That is one ask that produced several items, not an error — it is disclosed because a '
    + 'reader must be able to see it rather than discover it.',
  );

  if (report.refused.length > 0) {
    out.push('');
    out.push(`  REFUSED — nothing written for these: ${report.refused.length}`);
    for (const line of report.refused) out.push(`      ${line}`);
  }
  return out.join('\n');
}

/* ========================================================================== *
 * THE ENTRY POINT.
 * ========================================================================== */

export function main(argv: string[], cwd: string, env: Record<string, string | undefined>): number {
  const apply = argv.includes('--apply');
  const clear = argv.includes('--clear');
  const flagValue = (name: string): string | null => {
    const i = argv.indexOf(name);
    return i === -1 || i + 1 >= argv.length ? null : argv[i + 1];
  };
  const consumed = new Set<string>();
  for (const name of ['--audit', '--transcripts', '--report']) {
    const v = flagValue(name);
    if (v !== null) { consumed.add(name); consumed.add(v); }
  }
  const positional = argv.filter((a) => !a.startsWith('--') && !consumed.has(a));
  const root = path.resolve(positional[0] ?? path.join(cwd, '.my_context'));
  const auditDir = path.resolve(flagValue('--audit') ?? path.join(root, '.audit'));
  const transcripts = path.resolve(flagValue('--transcripts') ?? transcriptDir(env, cwd));

  const report = sweep({ root, auditDir, transcripts, apply, clear });
  const text = renderReport(report, apply, clear);
  const to = flagValue('--report');
  if (to !== null) writeFileSync(path.resolve(to), `${text}\n`, 'utf8');
  console.log(text);
  return report.refused.length > 0 ? 1 : 0;
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  process.exit(main(process.argv.slice(2), process.cwd(), process.env));
}
