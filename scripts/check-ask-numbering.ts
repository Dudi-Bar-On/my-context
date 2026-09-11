#!/usr/bin/env node
/**
 * **`detective:ask-numbering` — the first seed entry's check, run over the real
 * conversation archive.**
 *
 * D41 spec §4 and `plan:store seq:4` Task 14. The entry it enforces is
 * `src/rules/entries/numbered-options-on-a-question-put-to-the-owner.md`: *a
 * question put to the owner carries numbered options and one marked
 * recommendation.*
 *
 * ── WHY THIS IS DETECTIVE AND NOT PREVENTIVE ───────────────────────────────
 *
 * Spec §4 draws the distinction and argues it is not cosmetic: `preventive`
 * refuses before the fact and is available only where we own the write path;
 * `detective` reports after the fact from the archive, and it is the ONLY kind
 * available for a rule about the assistant's own output. Nothing gates what
 * the assistant writes — there is no hook between deciding to ask a question
 * and the owner reading it — so a single-kind `check` field would have forced
 * this entry to declare `none`, and that would have been false. The standard
 * is measurable; it is only unpreventable.
 *
 * ── THE TRIGGER, AND WHY IT IS THE CLOSING PARAGRAPH ───────────────────────
 *
 * A standard names the ACT it governs (spec §5). The act is *putting a
 * decision to the owner*, and the detector for it has to be narrow enough that
 * the number it produces means something. Measured over this workspace's real
 * archive on 2026-09-11, the obvious alternatives are all worse:
 *
 *     "the turn contains a numbered list"    131 turns, mostly explanations
 *                                            that happen to enumerate
 *     "the turn contains a ? anywhere"       matches tables, shell output and
 *                                            quoted logs
 *     "the turn ENDS with ?"                 56 turns — misses every ask that
 *                                            closes on a recommendation
 *
 * The turn's LAST paragraph is where the ask actually lives, and it is
 * mechanical enough that a reader can re-derive the population by hand. It is
 * a FLOOR and this module says so in its own output: an ask buried mid-turn is
 * not counted, so every rate here is the standard's best case.
 *
 * ── AND WHY ONLY THE OWNER'S OWN TRANSCRIPTS ───────────────────────────────
 *
 * A lane never addresses the owner. Counting lane transcripts would put 304
 * files of agent-to-agent prose into a population about how HE is asked, which
 * is the trap D36b measured on the request backfill: a lane's dispatch brief
 * is stored as a `type:'user'` record, and a naive sweep found 33× more
 * person-side text than the owner ever typed, none of it his. So `ownerTurns`
 * reads session transcripts only, and `Turn.agentId` is carried so that a
 * caller which widens the scope has to say so.
 */
import {
  classifyTurn, iterateTranscript, listTranscriptFiles, transcriptDir,
} from '../src/core/conversation-index.ts';
import { proseOf } from '../src/core/conversation-search.ts';

/** One assistant turn, addressed to whoever was reading it. */
export interface Turn {
  sessionId: string;
  /** `null` for the session's own transcript — the only place the owner reads. */
  agentId: string | null;
  /** 0-based position in the transcript, so a violation can be opened. */
  recordIndex: number;
  at: string | null;
  text: string;
}

/**
 * One option offered to the owner, as the turn wrote it.
 *
 * `number` is what he would answer with — the whole point of the standard is
 * that *"1 is ok"* resolves to something he can see rather than to an order he
 * inferred.
 */
export interface Option {
  number: number;
  /** The line, verbatim. A recommendation marker is looked for in here. */
  line: string;
}

export type Why =
  /** No option was enumerated at all, in any form. */
  | 'unnumbered'
  /** Enumerated, but not in the shape the standard names (`1 —`). */
  | 'wrong_enumerator'
  /** Zero marked recommendations, or more than one. */
  | 'not_exactly_one_recommendation'
  /** Exactly one, but it is not option 1. */
  | 'recommendation_not_first';

export interface Verdict {
  /** The trigger fired: this turn's closing paragraph puts a question to him. */
  asked: boolean;
  /** Option lines in the shape the standard names — `1 —`, `2 —`. */
  numbered: number;
  /** Option lines under ANY enumerator (`1.`, `1)`, `1 —`). Always >= `numbered`. */
  enumerated: number;
  /** Which option numbers carry a recommendation marker. */
  recommended: number[];
  /** The standard held: numbered, exactly one marked recommendation, and it first. */
  held: boolean;
  /** Why it did not hold. `null` when it did, or when the trigger never fired. */
  why: Why | null;
}

export interface Violation {
  turn: Turn;
  why: Why;
  /** The closing paragraph, so a reader sees the ask rather than the whole turn. */
  asked: string;
  verdict: Verdict;
}

export interface Report {
  /** Assistant turns looked at. */
  examined: number;
  /** Of those, questions put to the owner — the standard's trigger. */
  asked: number;
  /** Of the asks, how many enumerated their options AT ALL. */
  enumerated: number;
  /** Of the asks, how many used the shape the standard names. */
  numbered: number;
  /** Of the asks, how many marked exactly one recommendation. */
  recommended: number;
  /** Of the asks, how many held the WHOLE standard. */
  held: number;
  violations: Violation[];
}

/**
 * The standard's own shape: a number, then an em or en dash, then the option.
 *
 * Bold is tolerated around the number because the archive writes `**1**` when
 * the option is emphasised, and refusing that would be measuring markdown
 * rather than the standard. An en dash is tolerated beside the em dash for the
 * reason `schema.ts`'s `parseCheck` tolerates one: these entries are copied out
 * of prose the owner writes, and punctuation is not the thing under test.
 */
const STANDARD = /^[ \t]{0,3}(?:\*\*|__)?(\d{1,2})(?:\*\*|__)?[ \t]*[—–][ \t]+\S/;

/** Any enumerator at all — the looser measure, reported beside the strict one. */
const ENUMERATED = /^[ \t]{0,3}(?:\*\*|__)?(\d{1,2})(?:\*\*|__)?[ \t]*[.)\]:—–][ \t]+\S/;

/**
 * A marked recommendation.
 *
 * The archive's own vocabulary, read before this was written: *"My
 * recommendation: close `rulings/20` as done"*, *"I'd take the first"*,
 * *"(I'd retitle.)"*. All three are the assistant saying which way it would
 * go, and a check that recognised only the word "recommend" would score this
 * project's commonest form as unmarked.
 */
const RECOMMENDED = /\brecommend(?:ed|ation|ations|s)?\b|\bI(?:'|’)?d\b|\bI would\b/i;

/** The last non-empty block of a turn — where an ask actually lives. */
export function closingParagraph(text: string): string {
  const blocks = text.trimEnd().split(/\r?\n[ \t]*\r?\n/).filter((b) => b.trim() !== '');
  return blocks.length === 0 ? '' : blocks[blocks.length - 1].trim();
}

/**
 * The options a turn offers, as the longest run ascending from 1.
 *
 * An ascending run is what makes this an OPTION SET rather than a list of
 * lines that start with digits — a table of measurements, a changelog or a
 * quoted diff will all match the line pattern, and none of them counts from 1
 * upwards without a gap.
 */
export function optionsIn(text: string, pattern: RegExp): Option[] {
  const best: Option[] = [];
  let run: Option[] = [];
  let expect = 1;
  for (const line of text.split(/\r?\n/)) {
    const match = pattern.exec(line);
    if (match === null) continue;
    const number = Number(match[1]);
    if (number === expect) {
      run.push({ number, line });
      expect += 1;
    } else if (number === 1) {
      run = [{ number, line }];
      expect = 2;
    } else {
      run = [];
      expect = 1;
      continue;
    }
    if (run.length > best.length) { best.length = 0; best.push(...run); }
  }
  return best;
}

/** Judge one turn against the standard. */
export function inspect(text: string): Verdict {
  const asked = closingParagraph(text).includes('?');
  const numbered = optionsIn(text, STANDARD);
  const enumerated = optionsIn(text, ENUMERATED);
  // The recommendation is looked for on the options the turn ACTUALLY drew,
  // which is `enumerated` when the enumerator is wrong — otherwise a turn that
  // numbered with `1.` would be reported as having no recommendation as well
  // as the wrong enumerator, and one mistake would read as two.
  const options = numbered.length >= 2 ? numbered : enumerated;
  const recommended = options.filter((o) => RECOMMENDED.test(o.line)).map((o) => o.number);

  const verdict: Verdict = {
    asked,
    numbered: numbered.length >= 2 ? numbered.length : 0,
    enumerated: enumerated.length >= 2 ? enumerated.length : 0,
    recommended,
    held: false,
    why: null,
  };
  if (!asked) return verdict;
  if (verdict.enumerated === 0) { verdict.why = 'unnumbered'; return verdict; }
  if (verdict.numbered === 0) { verdict.why = 'wrong_enumerator'; return verdict; }
  if (recommended.length !== 1) { verdict.why = 'not_exactly_one_recommendation'; return verdict; }
  if (recommended[0] !== 1) { verdict.why = 'recommendation_not_first'; return verdict; }
  verdict.held = true;
  return verdict;
}

/** Run the check over a population of turns. */
export function checkAskNumbering(turns: Iterable<Turn>): Report {
  const report: Report = {
    examined: 0, asked: 0, enumerated: 0, numbered: 0, recommended: 0, held: 0, violations: [],
  };
  for (const turn of turns) {
    report.examined += 1;
    const verdict = inspect(turn.text);
    if (!verdict.asked) continue;
    report.asked += 1;
    if (verdict.enumerated > 0) report.enumerated += 1;
    if (verdict.numbered > 0) report.numbered += 1;
    if (verdict.recommended.length === 1) report.recommended += 1;
    if (verdict.held) { report.held += 1; continue; }
    report.violations.push({
      turn,
      why: verdict.why ?? 'unnumbered',
      asked: closingParagraph(turn.text),
      verdict,
    });
  }
  return report;
}

/**
 * Every assistant turn in the owner's OWN session transcripts.
 *
 * It reads the transcripts through the archive's own readers —
 * `iterateTranscript`, `classifyTurn`, `proseOf` — rather than through the
 * FTS5 prose index, and that is a choice rather than an omission.
 * `buildSearchIndex` answers "which records contain this phrase"; this check
 * needs the OPPOSITE, every record in order, so that the ones the standard
 * governs can be counted against the ones it does not. An index would add a
 * build step whose staleness could only make the number wrong, and the number
 * is the deliverable.
 */
export function* ownerTurns(
  env: Record<string, string | undefined>, cwd: string,
): Generator<Turn> {
  const dir = transcriptDir(env, cwd);
  for (const file of listTranscriptFiles(dir)) {
    for (const record of iterateTranscript(file.file, {})) {
      if (record.record === null) continue;
      const message = (record.record.message as { content?: unknown } | undefined)?.content;
      if (classifyTurn(record.record.type, message) !== 'answer') continue;
      const text = proseOf(record.record);
      if (text.trim() === '') continue;
      const at = record.record.timestamp;
      yield {
        sessionId: file.sessionId,
        agentId: null,
        recordIndex: record.index,
        at: typeof at === 'string' && at !== '' ? at : null,
        text,
      };
    }
  }
}

/** Render the report the way the owner reads a measurement: the number first. */
export function render(report: Report): string {
  const rate = (n: number): string =>
    report.asked === 0 ? 'n/a' : `${((n / report.asked) * 100).toFixed(1)}%`;
  const lines = [
    `detective:ask-numbering — over ${report.examined} assistant turns in this archive`,
    '',
    `  ${report.asked} questions put to the owner (the standard's trigger)`,
    `  ${report.numbered} numbered their options as \`1 —\` — ${rate(report.numbered)}`,
    `  ${report.enumerated} enumerated them at all — ${rate(report.enumerated)}`,
    `  ${report.recommended} marked exactly one recommendation — ${rate(report.recommended)}`,
    `  ${report.held} HELD THE STANDARD — ${rate(report.held)}`,
    '',
    'Every figure is a FLOOR. The trigger is the closing paragraph, so an ask buried',
    'mid-turn is not counted, and only the session transcripts are read — a lane never',
    'addresses the owner.',
    '',
  ];
  const byWhy = new Map<string, number>();
  for (const v of report.violations) byWhy.set(v.why, (byWhy.get(v.why) ?? 0) + 1);
  for (const [why, n] of [...byWhy].sort((a, b) => b[1] - a[1])) lines.push(`  ${why}: ${n}`);
  return lines.join('\n');
}

function main(argv: string[]): number {
  const report = checkAskNumbering(ownerTurns(process.env, process.cwd()));
  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({
      examined: report.examined,
      asked: report.asked,
      enumerated: report.enumerated,
      numbered: report.numbered,
      recommended: report.recommended,
      held: report.held,
    }, null, 2)}\n`);
    return 0;
  }
  process.stdout.write(`${render(report)}\n`);
  if (argv.includes('--list')) {
    const many = Number(argv[argv.indexOf('--list') + 1] ?? 20);
    for (const v of report.violations.slice(0, Number.isFinite(many) ? many : 20)) {
      process.stdout.write(`\n  ${v.turn.sessionId}#${v.turn.recordIndex} [${v.why}]\n` +
        `    ${v.asked.replace(/\s+/g, ' ').slice(0, 160)}\n`);
    }
  }
  // **Reporting is the whole job; a non-zero exit is not.** A detective check
  // that failed a gate would turn the archive's own history into a build
  // failure nobody can fix — the violations are already written.
  return 0;
}

if (import.meta.filename === process.argv[1]) process.exit(main(process.argv.slice(2)));
