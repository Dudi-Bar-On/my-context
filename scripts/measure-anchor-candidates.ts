#!/usr/bin/env node
/**
 * **What ELSE in a transcript is worth marking automatically** — the
 * measurement `TASK-find-out-what-else-in-a-transcript-is-worth-marking`
 * (`anchors/11`) exists to produce, and its deliverable is a RECOMMENDATION
 * rather than a grammar.
 *
 *     node scripts/measure-anchor-candidates.ts            # the table
 *     node scripts/measure-anchor-candidates.ts --samples  # + quotable samples
 *     node scripts/measure-anchor-candidates.ts --cost     # + probe timings
 *
 * **IT READS AND WRITES NOTHING.** The archive index is opened with
 * `readOnly: true` through `node:sqlite` directly rather than through
 * `ConversationIndex.open`, which is a door that migrates and therefore
 * writes. Nothing here calls `markAnchor`, `buildSearchIndex` or
 * `markAutomaticAnchors`, and the shipped grammar is IMPORTED and called, not
 * copied — a second expression of `anchorsInTurn` would make the overlap column
 * a comparison against a lookalike.
 *
 * ── WHAT IS SCANNED, SAID EXACTLY, BECAUSE A COUNT IS A CLAIM ──────────────
 *
 * Every row of `conversation_prose` — one row per non-machinery turn of every
 * transcript the archive has read, sessions and lanes together. On the corpus
 * this was written against that is **10,836 spans / 12.87 MB of prose across
 * 454 sources**.
 *
 * **AND THE RECORD BEHIND EACH SPAN, which is new on 2026-09-15 and is what
 * made the scan cost real money.** The grammar no longer takes a span's `kind`;
 * it takes the transcript RECORD, because `classifyTurn`'s three words cannot
 * say who wrote a turn (`ownerTyped` in `core/anchor-pass.ts` carries the
 * measurement). So this reads every span's record at its own byte, exactly as
 * `markAutomaticAnchors` does — measured on the owner's archive: **5.5 s for
 * all 10,913, against 0.7 s for the 1,586 prompts alone.**
 *
 * It reads ALL of them rather than the prompts, deliberately. Reading only the
 * prompts would rest on *"a record carrying `origin` is always classified as a
 * prompt"* — which is true here, measured, 524 of 524 — and would make this
 * report agree with the grammar by ASSUMING what the grammar decides. Five
 * seconds is the price of the report not being a lookalike.
 *
 * **The span's `text` column IS the turn text the grammar sees.** `proseFrom`
 * stores `proseOf(record)` verbatim and untruncated, and `turnAt` — what
 * `markAutomaticAnchors` puts to `anchorsInTurn` — calls the same `proseOf` on
 * the same record. So counting over this table is not an approximation of
 * re-reading 123 MB of transcript; it is the same string, which is why no
 * candidate below needed a transcript walk at all.
 *
 * ── WHAT WOULD MAKE EVERY NUMBER HERE WRONG ───────────────────────────────
 *
 *  1. **A span the prose index has not read.** A candidate is counted over
 *     what the archive HAS, and a transcript whose row is behind its file
 *     contributes nothing. `--cost` prints `archiveFreshness`' answer so the
 *     size of that hole is visible rather than assumed.
 *  2. **Machinery is not here at all.** `classifyTurn` dropped it one layer
 *     down, so "% of all turns" below means % of turns that carry words, which
 *     is the population the existing grammars are also measured against.
 *  3. **A `kind='prompt'` span is not the same thing as the owner typing.**
 *     433 of this archive's 957 main-session prompts are `<task-notification>`
 *     blocks, skill loads, `/command` re-invocations, compaction summaries and
 *     local-command output — injected into the prompt slot by the harness.
 *     `ownerTyped` is the filter that removes them, and any candidate that
 *     claims to measure HIS words and skips it is measuring the harness'.
 *
 *     **IT IS THE SHIPPED ONE NOW.** This script carried its own `ownerTyped`
 *     — a list of ten text shapes — until 2026-09-15, and that list leaked
 *     twice in a 38-row sample. `core/anchor-pass.ts` now answers the question
 *     from the archive's own columns and this imports it, so the report and the
 *     grammar cannot come to disagree about whose words they are counting.
 */
import { DatabaseSync } from 'node:sqlite';
import { anchorsInTurn, laneReportAt, ownerTyped } from '../src/core/anchor-pass.ts';
import { ConversationIndex, iterateTranscript } from '../src/core/conversation-index.ts';
import { archiveFreshness } from '../src/core/conversation-search.ts';
import { isMainEntry } from '../src/core/paths.ts';
import { resolveWorkspace } from '../src/core/workspace.ts';

const out: string[] = [];
const say = (s = ''): void => { out.push(s); };
const flush = (): void => { process.stdout.write(out.join('\n') + '\n'); };

/** One turn as the prose index holds it — the same string `anchorsInTurn` gets. */
export interface Span {
  sourceKey: string;
  sessionId: string;
  agentId: string | null;
  byteOffset: number;
  kind: string;
  at: string | null;
  text: string;
  /**
   * **The transcript record this span came from**, filled by `readRecords`, or
   * `null` when the transcript is gone or the byte reads as nothing.
   *
   * It is what `ownerTyped` reads, and it is the whole reason this script now
   * touches the transcripts at all. `null` is the safe answer everywhere: a
   * span whose record could not be read is not counted as his.
   */
  record: Record<string, unknown> | null;
}

/* ══ 1. WHAT IS THE OWNER'S KEYBOARD, AND WHAT ONLY LOOKS LIKE IT ══════════ */

/**
 * ── THE TEN TEXT SHAPES THAT USED TO BE HERE, AND WHY THEY ARE NOT ────────
 *
 * `HARNESS_PROMPT` was a list of ten regexes — `^<task-notification`,
 * `^<system-reminder`, `^Base directory for this skill:`, and seven more — and
 * `ownerTyped` was "a main-session prompt matching none of them, in a session
 * with more than one prompt". It removed 388 of 948 spans and **it leaked
 * twice in a 38-row sample**: a `/command` body and a skill preamble that the
 * list had no shape for.
 *
 * `core/anchor-pass.ts` · `ownerTyped` replaced it on 2026-09-15 with three of
 * the archive's own columns, and it is IMPORTED above rather than re-expressed
 * here for this file's stated reason: a second copy of a predicate makes the
 * report agree with itself while disagreeing with the grammar.
 *
 * Two things the structural predicate gets for nothing, and both were separate
 * filters here before:
 *
 *   — **the headless runs.** Twelve one-prompt sessions in this archive are
 *     nightly runs of the product's own lesson pass. They were named by
 *     `conversations.prompts <= 1`; they carry `promptSource: 'sdk'` and NO
 *     `origin` at all, so the predicate refuses them without being told about
 *     them.
 *   — **the lane relays.** *"The user sent a new message while you were
 *     working: …"* is `origin.kind: 'human'` and the old list had no shape for
 *     it either. `isSidechain` and `isMeta` each refuse all 13.
 */

/* ══ 2. THE CANDIDATES ════════════════════════════════════════════════════ */

/**
 * A candidate grammar: something that either matches a turn or does not.
 *
 * `probe` is the contiguous substring a per-turn run would have to hand
 * `searchArchive` to find its candidates — `null` when the shape has no
 * contiguous substring at all, which is not a detail: a candidate with no
 * probe cannot use the prose index as an index and is a different proposition
 * from one that can. See section 5.
 */
export interface Candidate {
  id: string;
  what: string;
  probe: string[] | null;
  /** Owner-typed prompts only — the population the share is reported against. */
  ownerOnly?: boolean;
  match(span: Span): boolean;
}

/** The body lines of the longest fenced block in this text, and its info string. */
export function longestFence(text: string): { lines: number; info: string } | null {
  const lines = text.split('\n');
  let best: { lines: number; info: string } | null = null;
  let open: { info: string; at: number; ticks: string } | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    const fence = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(lines[i] ?? '');
    if (fence === null) continue;
    const ticks = fence[1] ?? '';
    const rest = (fence[2] ?? '').trim();
    if (open === null) { open = { info: rest, at: i, ticks: ticks[0] ?? '`' }; continue; }
    if (ticks[0] !== open.ticks) continue;
    if (rest !== '') continue;
    const body = i - open.at - 1;
    if (best === null || body > best.lines) best = { lines: body, info: open.info };
    open = null;
  }
  return best;
}

/** A repo-shaped path with an extension — `src/core/anchor-pass.ts`, `e2e/app.ts`. */
const REPO_PATH = /\b(?:src|test|e2e|scripts|hooks|docs|reports)\/[A-Za-z0-9_.@/-]+\.[a-z]{2,4}\b/;

/**
 * **A number with a unit** — the shape a measurement has and prose does not.
 *
 * `\b\d` and a unit from a closed list. `%` and `x` are included because this
 * archive states most of its results as percentages and multiples; a bare
 * integer is NOT a unit, which is the line between "266 ms" and "1".
 *
 * **The trailing guard is `(?![A-Za-z0-9])` and not `\b`, and that was a
 * defect the test caught rather than a preference.** `\b` after `%` asks for a
 * word character on the other side of a non-word character, which never
 * happens — so `4% of the budget` counted ZERO percentages and every
 * `measure-*` count in this report was low until
 * `test/scripts/anchor-candidates.test.ts` reddened on it.
 */
const NUMBER_UNIT =
  /\b\d[\d,]*(?:\.\d+)?\s?(?:ms|µs|s|m|h|B|KB|kB|MB|GB|MiB|GiB|%|x|×)(?![A-Za-z0-9])/g;

/** How many number-with-unit occurrences this text carries. */
export function unitCount(text: string): number {
  NUMBER_UNIT.lastIndex = 0;
  return (text.match(NUMBER_UNIT) ?? []).length;
}

/**
 * **The words he rules in.** Read off his own prompts, not from a thesaurus.
 *
 * Split into two strengths deliberately, because the whole question this task
 * asks is whether a keyword list beats the dumb baseline beside it
 * (`owner-long-400`), and a single blended list could not be asked that.
 */
const RULE_STRONG =
  /\b(?:always|never|nevver|must|unacceptable|not allowed|forbidden|from now on|i approve|i decide|the rule|this rule|a rule|standardi[sz]e)\b/i;
const RULE_MODAL = /\b(?:should|shouldn'?t|need to|needs to|i want|i expect|do not|don'?t|dont)\b/i;
const CORRECTION =
  /\b(?:wrong|incorrect|not correct|doesn'?t work|does not work|still (?:not|no|doesn'?t|don'?t|can'?t|could ?n'?t|the same|see|shows?)|broken|is a bug|another bug|why (?:still|do i|don'?t|can'?t|is|was|did)|you (?:said|told) me|did ?n'?t you)\b/i;

export const CANDIDATES: Candidate[] = [
  {
    id: 'fence-any',
    what: 'a fenced code block with at least one body line, any turn',
    probe: ['```'],
    match: (s) => (longestFence(s.text)?.lines ?? 0) >= 1,
  },
  {
    id: 'fence-5',
    what: 'a fenced block of 5+ body lines, any turn',
    probe: ['```'],
    match: (s) => (longestFence(s.text)?.lines ?? 0) >= 5,
  },
  {
    id: 'fence-12',
    what: 'a fenced block of 12+ body lines, any turn',
    probe: ['```'],
    match: (s) => (longestFence(s.text)?.lines ?? 0) >= 12,
  },
  {
    id: 'fence-25',
    what: 'a fenced block of 25+ body lines, any turn',
    probe: ['```'],
    match: (s) => (longestFence(s.text)?.lines ?? 0) >= 25,
  },
  {
    id: 'fence-path',
    what: 'a fenced block of 5+ lines whose info string or body names a repo path',
    probe: ['```'],
    match: (s) => {
      const fence = longestFence(s.text);
      if (fence === null || fence.lines < 5) return false;
      return REPO_PATH.test(fence.info) || REPO_PATH.test(s.text);
    },
  },
  {
    id: 'owner-rule-strong',
    what: 'HE typed it, and it carries always / never / must / the rule / i approve',
    probe: ['always', 'never', 'must', 'the rule'],
    ownerOnly: true,
    match: (s) => RULE_STRONG.test(s.text),
  },
  {
    id: 'owner-rule-modal',
    what: 'HE typed it, and it carries should / need to / i want / do not',
    probe: ['should', 'need to', 'i want', 'do not'],
    ownerOnly: true,
    match: (s) => RULE_MODAL.test(s.text),
  },
  {
    id: 'owner-rule-either',
    what: 'HE typed it, and it carries either list',
    probe: null,
    ownerOnly: true,
    match: (s) => RULE_STRONG.test(s.text) || RULE_MODAL.test(s.text),
  },
  {
    id: 'owner-correction',
    what: 'HE typed it, and it says something is wrong / still not working',
    probe: ['wrong', 'still', 'why'],
    ownerOnly: true,
    match: (s) => CORRECTION.test(s.text),
  },
  {
    id: 'owner-long-400',
    what: 'HE typed it and it is 400+ characters — THE DUMB BASELINE, no keywords',
    probe: null,
    ownerOnly: true,
    match: (s) => s.text.length >= 400,
  },
  {
    id: 'owner-long-250',
    what: 'HE typed it and it is 250+ characters',
    probe: null,
    ownerOnly: true,
    match: (s) => s.text.length >= 250,
  },
  {
    id: 'owner-strong-and-long',
    what: 'HE typed it, 250+ characters AND the strong list',
    probe: null,
    ownerOnly: true,
    match: (s) => s.text.length >= 250 && RULE_STRONG.test(s.text),
  },
  {
    id: 'measure-3units',
    what: '3+ numbers with units in one turn',
    probe: null,
    match: (s) => unitCount(s.text) >= 3,
  },
  {
    id: 'measure-6units',
    what: '6+ numbers with units in one turn',
    probe: null,
    match: (s) => unitCount(s.text) >= 6,
  },
  {
    id: 'commit',
    what: 'a git commit — the command or the trailer',
    probe: ['git commit', 'Co-Authored-By'],
    match: (s) => /\bgit commit\b/.test(s.text) || /Co-Authored-By:/.test(s.text),
  },
  {
    id: 'command-run',
    what: 'a shell fence — ```bash / ```sh / ```console',
    probe: ['```bash', '```sh', '```console'],
    match: (s) => /^\s{0,3}`{3,}\s*(bash|sh|shell|console|powershell|ps1)\b/m.test(s.text),
  },
];

/* ══ 3. THE SCAN ══════════════════════════════════════════════════════════ */

/**
 * **What each lane was sent to do, as the archive already records it.**
 *
 * `subagents.description` is written at dispatch by the harness. It matters to
 * this measurement for one reason: the structural candidate in section 5 needs
 * no LABEL grammar, because the label is this string.
 */
export function laneMissions(dbPath: string): Map<string, string> {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = db.prepare('SELECT agent_id, agent_type, description FROM subagents')
      .all() as Record<string, unknown>[];
    return new Map(rows.map((row) => [
      String(row.agent_id),
      row.description === null ? '' : `${String(row.agent_type ?? '?')} — ${String(row.description)}`,
    ]));
  } finally {
    db.close();
  }
}

/**
 * Sessions the archive holds that carry at most one prompt — a headless run.
 *
 * **No longer a filter, and kept because it is the number that PROVES the
 * filter is unnecessary.** `ownerTyped` refuses every one of these on
 * `origin` alone; the report prints both counts so that agreement is visible
 * rather than claimed.
 */
export function headlessSessions(dbPath: string): Set<string> {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = db.prepare('SELECT session_id FROM conversations WHERE prompts <= 1')
      .all() as Record<string, unknown>[];
    return new Set(rows.map((row) => String(row.session_id)));
  } finally {
    db.close();
  }
}

/** Every prose span the archive holds, read-only. */
export function readSpans(dbPath: string): Span[] {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = db.prepare(
      'SELECT source_key, session_id, agent_id, byte_offset, kind, at, text '
      + 'FROM conversation_prose',
    ).all() as Record<string, unknown>[];
    return rows.map((row) => ({
      sourceKey: String(row.source_key),
      sessionId: String(row.session_id),
      agentId: row.agent_id === null ? null : String(row.agent_id),
      byteOffset: Number(row.byte_offset),
      kind: String(row.kind),
      at: row.at === null ? null : String(row.at),
      text: String(row.text),
      record: null,
    }));
  } finally {
    db.close();
  }
}

/**
 * **Fill each span's `record` by reading it at its own byte** — one seek and
 * one line apiece, which is exactly what `turnAt` costs the real pass.
 *
 * Mutates in place rather than returning a copy: 10,913 spans each carrying a
 * whole transcript record is the largest thing this script holds, and a second
 * array of them for tidiness would double it for nothing.
 *
 * A source the archive no longer has a file for leaves its spans at `null`,
 * which `ownerTyped` reads as "not his" — the safe direction, and the same one
 * `markAutomaticAnchors` takes when a transcript is pruned.
 */
export function readRecords(dbPath: string, spans: Span[]): number {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  let read = 0;
  try {
    const files = new Map<string, string>();
    for (const row of db.prepare('SELECT session_id AS k, file FROM conversations').all() as
      Record<string, unknown>[]) files.set(String(row.k), String(row.file));
    for (const row of db.prepare('SELECT agent_id AS k, file FROM subagents').all() as
      Record<string, unknown>[]) files.set(String(row.k), String(row.file));
    for (const span of spans) {
      const file = files.get(span.agentId ?? span.sessionId);
      if (file === undefined) continue;
      for (const record of iterateTranscript(file, { startByte: span.byteOffset })) {
        span.record = record.record;
        if (record.record !== null) read += 1;
        break;
      }
    }
  } finally {
    db.close();
  }
  return read;
}

/** A span's identity, spelled the way `anchorIdFor` keys one. */
const keyOf = (s: Span): string => `${s.agentId ?? s.sessionId}:${s.byteOffset}`;

interface Row {
  id: string;
  what: string;
  marks: number;
  shareOfPopulation: string;
  shareOfAllTurns: string;
  overlapTable: number;
  overlapRuling: number;
  fresh: number;
  growth: string;
  probe: string;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function table(rows: Row[]): string[] {
  const head = ['candidate', 'marks', '%pop', '%turns', 'ov-tbl', 'ov-rul', 'NEW', 'growth', 'probe'];
  const body = rows.map((r) => [
    r.id, String(r.marks), r.shareOfPopulation, r.shareOfAllTurns,
    String(r.overlapTable), String(r.overlapRuling), String(r.fresh), r.growth, r.probe,
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
  const line = (cells: string[]): string =>
    '| ' + cells.map((c, i) => pad(c, widths[i])).join(' | ') + ' |';
  return [
    line(head),
    '|' + widths.map((w) => '-'.repeat(w + 2)).join('|') + '|',
    ...body.map(line),
  ];
}

function main(): number {
  const wantSamples = process.argv.includes('--samples');
  const wantCost = process.argv.includes('--cost');
  const dbPath = resolveWorkspace(process.cwd()).dbPath;

  const t0 = Date.now();
  const spans = readSpans(dbPath);
  const headless = headlessSessions(dbPath);
  const missions = laneMissions(dbPath);
  const scanMs = Date.now() - t0;

  const t1 = Date.now();
  const recordsRead = readRecords(dbPath, spans);
  const recordMs = Date.now() - t1;

  // **The lane's last answer, from the index's own `MAX`.** It is the shipped
  // query and the shipped predicate, for the same reason the grammar is
  // imported: a second expression of "which turn is the report" would make
  // section 5 a comparison against a lookalike.
  const index = ConversationIndex.openReadOnlyChecked(dbPath);
  const lastAnswers = (() => {
    try { return index.laneLastAnswers(); } finally { /* closed below */ }
  })();

  // The baseline: what the SHIPPED grammar says about the same spans. Imported
  // and called — never re-expressed here.
  const tabled = new Set<string>();
  const ruled = new Set<string>();
  const reported = new Set<string>();
  for (const span of spans) {
    // **EVERY KIND THE TURN CARRIES, not the first one** — a turn that is both
    // a table and a lane report is in BOTH sets after 2026-09-16, which is what
    // makes the overlap column below a measurement of the shipped pass rather
    // than of a precedence it no longer keeps.
    for (const finding of anchorsInTurn({
      record: span.record,
      laneReport: laneReportAt(index, lastAnswers, span.agentId, span.byteOffset, span.text),
    }, span.text)) {
      if (finding.kind === 'table') tabled.add(keyOf(span));
      else if (finding.kind === 'report') reported.add(keyOf(span));
      else ruled.add(keyOf(span));
    }
  }
  index.close();
  const marked = new Set([...tabled, ...ruled, ...reported]);

  const owners = spans.filter((s) => ownerTyped(s.record));
  const prompts = spans.filter((s) => s.kind === 'prompt');

  say('# what else is worth marking — measured on the real archive');
  say();
  const mainPrompts = spans.filter((s) => s.kind === 'prompt' && s.agentId === null).length;
  say(`scanned: ${spans.length} prose spans, `
    + `${(spans.reduce((n, s) => n + s.text.length, 0) / 1e6).toFixed(2)} MB of text, `
    + `${scanMs} ms`);
  say(`  and ${recordsRead} of their records, read at their own bytes, ${recordMs} ms`);
  say(`  of which prompts ${prompts.length}, answers ${spans.length - prompts.length}`);
  say(`  of which HE TYPED ${owners.length} `
    + `(main-session prompts ${mainPrompts}`
    + `, harness-injected ${mainPrompts - owners.length})`);
  // **The headless filter that is no longer needed, printed rather than
  // deleted.** If a future harness ever files a headless run as `origin.kind:
  // 'human'`, this line stops reading zero and says so.
  say(`  of those he typed, in a headless (<=1 prompt) session: `
    + `${owners.filter((s) => headless.has(s.sessionId)).length} `
    + `— the structural predicate refuses them without being told about them`);
  say();
  say(`the shipped grammar over the same spans: table ${tabled.size}, `
    + `ruling ${ruled.size}, report ${reported.size}, total ${marked.size}`);
  say();

  const rows: Row[] = [];
  for (const candidate of CANDIDATES) {
    const population = candidate.ownerOnly === true ? owners : spans;
    const hits = population.filter((s) => candidate.match(s));
    const keys = hits.map(keyOf);
    const ovT = keys.filter((k) => tabled.has(k)).length;
    const ovR = keys.filter((k) => ruled.has(k)).length;
    const fresh = keys.filter((k) => !marked.has(k)).length;
    rows.push({
      id: candidate.id,
      what: candidate.what,
      marks: hits.length,
      shareOfPopulation: `${((hits.length / population.length) * 100).toFixed(1)}%`,
      shareOfAllTurns: `${((hits.length / spans.length) * 100).toFixed(1)}%`,
      overlapTable: ovT,
      overlapRuling: ovR,
      fresh,
      growth: `+${((fresh / marked.size) * 100).toFixed(0)}%`,
      probe: candidate.probe === null ? 'NONE — full scan' : candidate.probe.join(' '),
    });
  }

  say('## the table');
  say();
  say('`marks` — turns this would mark. `%pop` — share of the population it is');
  say('measured against (owner-typed prompts for the `owner-*` rows, every span');
  say('otherwise). `%turns` — share of ALL 10,836 spans, the number the 40%');
  say('disqualification in the item is measured against. `ov-tbl` / `ov-rul` —');
  say('how many of those turns ALREADY carry a table or ruling mark. `NEW` — the');
  say('marks that would actually be added. `growth` — NEW against the 1,159 the');
  say('shipped grammar produces.');
  say();
  for (const line of table(rows)) say(line);
  say();
  for (const row of rows) say(`  ${pad(row.id, 22)} ${row.what}`);
  say();

  /* The first and last prose span of each lane — section 4 and section 5 both
     need it, and one computation is one thing to be wrong about. */
  const laneKeys = new Set(spans.filter((s) => s.agentId !== null).map((s) => s.agentId ?? ''));
  const firstOf = new Map<string, Span>();
  const lastOf = new Map<string, Span>();
  for (const span of spans) {
    if (span.agentId === null) continue;
    const a = span.agentId;
    const first = firstOf.get(a);
    if (first === undefined || span.byteOffset < first.byteOffset) firstOf.set(a, span);
    const last = lastOf.get(a);
    if (last === undefined || span.byteOffset > last.byteOffset) lastOf.set(a, span);
  }

  /* ── 4. THE `ruling` GRAMMAR, AND THE BLIND SPOT NOW CLOSED ────────────────── */
  say('## 4. what the shipped `ruling` grammar is actually marking');
  say();
  const ruledSpans = spans.filter((s) => ruled.has(keyOf(s)));
  const ruledOwner = ruledSpans.filter((s) => ownerTyped(s.record)).length;
  const ruledLane = ruledSpans.filter((s) => s.agentId !== null);
  const ruledDispatch = ruledLane.filter(
    (s) => firstOf.get(s.agentId ?? '')?.byteOffset === s.byteOffset,
  ).length;
  const ruledHarness = ruledSpans.length - ruledOwner - ruledLane.length;
  say(`  ruling marks: ${ruledSpans.length}`);
  say(`    he typed it:                  ${ruledOwner}`);
  say(`    a LANE's prompt:              ${ruledLane.length}`
    + `   — of which the lane's FIRST prose span, i.e. the dispatch: ${ruledDispatch}`);
  say(`    harness-injected prompt slot: ${ruledHarness}`);
  say();
  say('  **THE BOTTOM TWO LINES ARE THE REPAIR, AND A ZERO IS THE PASS.**');
  say('  Until 2026-09-15 these four read 377 / 0 / 324 / 53 — a `ruling` mark');
  say('  was documented as "something the OWNER GAVE" and marked NONE of his');
  say("  turns, because a lane dispatch (this plugin's own SubagentStart");
  say('  injection, every governing id among them) and a `<task-notification>`');
  say("  both reach a `kind === 'prompt'` guard: `classifyTurn` calls them");
  say('  prompts. That was the standard which killed the report grammar on');
  say('  2026-09-11 — *"it marks a turn that MENTIONS a report, not a report"* —');
  say('  turned on the rule grammar, and it failed.');
  say();
  say('  The detector is now `ownerTyped` over the RECORD, so the last two lines');
  say('  are structurally unreachable rather than merely small. If either ever');
  say('  reads non-zero again, the guard has been widened back to the text.');
  say();

  /* ── 5. STRUCTURAL, not a grammar: what `subagents` already knows ──────── */
  say('## 5. the structural candidate — dispatch REFUSED, report SHIPPED');
  say();
  const dispatches = [...firstOf.values()];
  const reports = [...lastOf.values()].filter((s) => s.kind === 'answer');
  say(`  lanes with prose:   ${laneKeys.size}`);
  say(`  dispatch turns:     ${dispatches.length} `
    + `(${((dispatches.length / spans.length) * 100).toFixed(1)}% of all turns, `
    + `${dispatches.filter((s) => !marked.has(keyOf(s))).length} of them unmarked today)`);
  say(`  report turns:       ${reports.length} `
    + `(${((reports.length / spans.length) * 100).toFixed(1)}% of all turns, `
    + `${reports.filter((s) => !marked.has(keyOf(s))).length} of them unmarked today)`);
  say(`  both together:      +${(((dispatches.filter((s) => !marked.has(keyOf(s))).length
    + reports.filter((s) => !marked.has(keyOf(s))).length) / marked.size) * 100).toFixed(0)}%`
    + ' on the 1,159 that stand today');
  say();
  const acks = reports.filter((s) => s.text.length < 400).length;
  const lens = reports.map((s) => s.text.length).sort((a, b) => a - b);
  say(`  a lane's last answer is ${lens[lens.length >> 1]} characters at the median; `
    + `${acks} of ${reports.length} are under 400`);
  say('    — those are a trailing "that background command finished, no action');
  say('      needed" rather than the report. A 400-character floor refuses');
  say(`      exactly those ${acks} and keeps ${reports.length - acks}. That is what the floor MEASURES;`);
  say('      whether the 417 read as reports is a judgement on a sample, and');
  say('      `--samples` prints one.');
  say();
  say('  **THE DISPATCH IS REFUSED AND THE REPORT SHIPPED**, owner ruling');
  say('  2026-09-15. The dispatch line above is kept because it is the SIZE OF');
  say('  THE NOISE that was being marked: those first spans are the injection');
  say('  block, and 296 of them wore a `ruling` mark until the detector changed.');
  say('  It is counted here, and marked nowhere.');
  say();
  say('  It needs NO probe and NO grammar: the last ANSWER span of a lane');
  say('  transcript is a `MAX` over `byte_offset` per `agent_id`, which is');
  say('  `ConversationIndex.laneLastAnswers`, and `subagents` already carries the');
  say('  row. Cost is one query, not eight — 16-18 ms median over these spans.');
  const described = reports.filter(
    (s) => (missions.get(s.agentId ?? '') ?? '') !== '',
  ).length;
  say('  **And the LABEL is already written**: `subagents.description` carries');
  say(`  the lane's mission for ${described} of these ${reports.length} — "general-purpose — E28`);
  say('  wire check-needs-cycles as a gate" — which is a name, not a header cell.');
  say();

  /* ── 6. PROBE COST ─────────────────────────────────────────────────────── */
  if (wantCost) {
    say('## 6. probe cost, measured against the two that still run');
    say();
    // **The hole in every count above, stated before the timings.** A candidate
    // is counted over what the archive HAS read; a source whose row is behind
    // its file contributed nothing to any number in this report.
    const index = ConversationIndex.openReadOnlyChecked(dbPath);
    const behind = (() => {
      try { return archiveFreshness(index); } finally { index.close(); }
    })();
    const bytes = behind.reduce((n, s) => n + (s.behind ?? 0), 0);
    say(`  sources whose row is BEHIND their file: ${behind.length}`
      + `, ${bytes.toLocaleString()} bytes unread`);
    say('  Every count above is blind to exactly those bytes.');
    say();
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const COLUMNS = 'SELECT session_id, agent_id, record_index, byte_offset, kind, at, '
        + "snippet(conversation_prose, 7, '[', ']', '…', 16) AS snip, "
        + 'bm25(conversation_prose) AS score FROM conversation_prose ';
      const TAIL = ' ORDER BY score ASC, session_id ASC, record_index ASC LIMIT 200 OFFSET 0';
      const whole = db.prepare(`${COLUMNS}WHERE conversation_prose MATCH ?${TAIL}`);

      // **The per-turn shape, which is the one the hook actually pays.** Four
      // windows over the busiest sources, each 20 KB back from where the
      // archive has read — a stand-in for "what a turn just appended", exactly
      // as `markAnchorsOnTurn` builds `only` from `search.read`/`readFrom`.
      const busiest = db.prepare(
        'SELECT key, bytes FROM prose_sources ORDER BY spans DESC LIMIT 4',
      ).all() as Record<string, unknown>[];
      const windowArgs = busiest.flatMap(
        (r) => [String(r.key), Math.max(0, Number(r.bytes) - 20_000)],
      );
      const scoped = db.prepare(
        `${COLUMNS}WHERE conversation_prose MATCH ? AND (`
        + busiest.map(() => '(source_key = ? AND byte_offset >= ?)').join(' OR ')
        + `)${TAIL}`,
      );

      /** The MEDIAN of nine runs of one query — the query itself is the caller's. */
      const time = (run: () => number): { ms: number; hits: number } => {
        let hits = 0;
        const times: number[] = [];
        for (let r = 0; r < 9; r += 1) {
          const t = process.hrtime.bigint();
          hits = run();
          times.push(Number(process.hrtime.bigint() - t) / 1e6);
        }
        times.sort((a, b) => a - b);
        return { ms: times[times.length >> 1] ?? 0, hits };
      };
      const quoted = (probe: string): string => `"${probe.replace(/"/g, '""')}"`;

      say('  probe                 unscoped (rebuild)      windowed (per turn)');
      const probes = [
        ...['|---', 'RULE-', 'DEC-'].map((p) => ['SHIPPED', p] as const),
        ...CANDIDATES.flatMap((c) => (c.probe ?? []).map((p) => [c.id, p] as const)),
      ];
      const done = new Set<string>();
      for (const [owner, probe] of probes) {
        if (done.has(probe)) continue;
        done.add(probe);
        const w = time(() => whole.all(quoted(probe)).length);
        const s = time(() => scoped.all(quoted(probe), ...windowArgs).length);
        say(`  ${pad(owner, 20)} ${pad(JSON.stringify(probe), 16)} `
          + `${w.ms.toFixed(1).padStart(6)} ms ${String(w.hits).padStart(4)} hits   `
          + `${s.ms.toFixed(1).padStart(6)} ms ${String(s.hits).padStart(3)} hits`);
      }
      say();
      say('  A probe costs what its trigram posting list costs: the MATCH runs');
      say('  before the window narrows it, so a common English word is the most');
      say('  expensive kind of probe there is and a rare literal is nearly free.');
    } finally {
      db.close();
    }
    say();
  }

  /* ── 7. SAMPLES HE CAN CHECK ───────────────────────────────────────────── */
  if (wantSamples) {
    say('## 7. samples — session, byte offset, and the first words');
    say();
    let seed = 20260915;
    const rand = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (const candidate of CANDIDATES) {
      const population = candidate.ownerOnly === true ? owners : spans;
      const hits = population.filter((s) => candidate.match(s) && !marked.has(keyOf(s)));
      say(`### ${candidate.id} — ${hits.length} unmarked matches, 8 at random`);
      const picked = [...hits].sort(() => rand() - 0.5).slice(0, 8);
      for (const s of picked) {
        say(`  ${s.sessionId}${s.agentId === null ? '' : ` / lane ${s.agentId}`} @ ${s.byteOffset}`);
        say(`    ${JSON.stringify(s.text.replace(/\s+/g, ' ').slice(0, 220))}`);
      }
      say();
    }

    // The structural candidate has no `Candidate` row because it is not a
    // grammar — it is a `max` over `byte_offset`. Its sample is printed here
    // in the same shape so it can be judged against the others.
    const laneSample = reports.filter((s) => !marked.has(keyOf(s)) && s.text.length >= 400);
    say(`### lane-report (STRUCTURAL) — ${laneSample.length} unmarked, 8 at random`);
    for (const s of [...laneSample].sort(() => rand() - 0.5).slice(0, 8)) {
      say(`  lane ${s.agentId} @ ${s.byteOffset}`);
      say(`    label would be: ${JSON.stringify(missions.get(s.agentId ?? '') ?? '(none)')}`);
      say(`    ${JSON.stringify(s.text.replace(/\s+/g, ' ').slice(0, 220))}`);
    }
    say();
  }

  flush();
  return 0;
}

/**
 * Guarded, because `test/scripts/anchor-candidates.test.ts` imports the
 * predicates from here rather than keeping a second copy of them — the defect
 * `CLAUDE.md` opens by describing, and a regex is exactly the kind of thing
 * that drifts between two copies.
 */
if (isMainEntry(import.meta.filename, process.argv[1])) process.exitCode = main();
