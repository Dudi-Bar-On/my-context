import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { HandoverConfig } from './config.ts';

// --- The handover, read and bounded -----------------------------------------
//
// A compaction is the one moment a session loses everything it has not written
// down. This project has kept a handover file for exactly that since 2026-08-19
// and NOTHING HAS EVER READ IT — searched across every `.ts`, `.js`, `.mjs`,
// `.json`, `.yml`, `.sh` and `.ps1` in both repositories on 2026-08-27. It has
// survived every boundary so far because somebody remembered, which is not a
// mechanism; it is the shape
// `LESSON-a-requirement-given-in-conversation-and-never-captured-is-a` names.
//
// This module is the reading half and nothing else. It does not write, edit or
// reformat the document — a hook that edits the file a human maintains is the
// `config.json` deny rule with the sign flipped. It does not judge staleness
// either: it reports what it read, and whether what it read is old enough to
// mislead is a judgement belonging to whoever is looking at it.
//
// WHO DELIVERS WHAT IT RETURNS, because the split is not obvious and is not a
// preference. `PostCompact` cannot: build 2.1.239 declares no
// `hookSpecificOutput` variant for that event, so its stdout becomes a
// user-facing banner appended to the compaction message and the model never
// sees a byte — `hooks/post-compact.ts` records the reading that established
// it. `SessionStart`'s stdout IS appended to context verbatim, which is why
// `hooks/io.ts` excludes it from the envelope union. So `PostCompact` resolves
// and records, and `SessionStart` delivers.

/**
 * Four characters to a token, the same estimate the selector charges its
 * budgets with (`estimateTokens`, `select.ts`).
 *
 * Deliberately the same crude number rather than a better one: a handover block
 * and an injected item compete for one window, and two different estimators
 * would make the two budgets incomparable in a way nothing would ever surface.
 * Being wrong in the same direction is worth more here than being closer.
 */
const CHARS_PER_TOKEN = 4;

export type HandoverRead =
  /** No `handover` key. Nothing was promised, so nothing is said. */
  | { state: 'off' }
  /** A key that names a file that is not there. THE LOUD CASE. */
  | { state: 'missing'; path: string }
  | {
      state: 'read';
      path: string;
      text: string;
      deliveredLines: number;
      totalLines: number;
      /** Which of the two rules below chose the text. */
      source: 'marker' | 'head';
    };

/**
 * ATX headings only. Setext (`===` underlines) is not matched, and that is a
 * choice rather than an oversight: a marked section is something an author
 * writes ON PURPOSE for the next session, every handover in this project spells
 * its headings with `#`, and matching a second grammar would mean a line of
 * ordinary prose followed by a row of dashes could silently become the section
 * that governs a compaction.
 */
const HEADING = /^(#{1,6})\s+(.*)$/;

export function readHandover(projectRoot: string, config: HandoverConfig | null): HandoverRead {
  if (config === null) return { state: 'off' };

  const abs = path.resolve(projectRoot, config.path);
  let raw: string;
  try {
    // `isFile()` rather than `existsSync`: a DIRECTORY at the configured path is
    // a misconfiguration, and reporting it as missing is the accurate reading —
    // there is no handover there either way, and `readFileSync` on a directory
    // throws a different error on every platform.
    if (!statSync(abs).isFile()) return { state: 'missing', path: config.path };
    raw = readFileSync(abs, 'utf8');
  } catch {
    return { state: 'missing', path: config.path };
  }

  const lines = raw.split(/\r?\n/);
  const budgetChars = config.budgetTokens * CHARS_PER_TOKEN;

  const start = lines.findIndex((line) => {
    const heading = HEADING.exec(line);
    return heading !== null && heading[2]!.trimStart().startsWith(config.marker);
  });

  if (start !== -1) {
    // The section runs to the next heading at the SAME LEVEL OR HIGHER. A
    // deeper heading is part of what the author marked — a `####` detail under a
    // `###` instruction belongs to the instruction — and cutting at any heading
    // would silently drop the half of a section that explains the other half.
    const level = HEADING.exec(lines[start]!)![1]!.length;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i += 1) {
      const heading = HEADING.exec(lines[i]!);
      if (heading !== null && heading[1]!.length <= level) { end = i; break; }
    }
    const kept = capToBudget(lines.slice(start, end), budgetChars);
    return {
      state: 'read',
      path: config.path,
      text: kept.join('\n'),
      deliveredLines: kept.length,
      totalLines: lines.length,
      source: 'marker',
    };
  }

  const head = capToSection(lines, budgetChars);
  return {
    state: 'read',
    path: config.path,
    text: head.join('\n'),
    deliveredLines: head.length,
    totalLines: lines.length,
    source: 'head',
  };
}

/**
 * Whole lines until the budget is spent, and never part of one.
 *
 * A handover is prose a person wrote, so a cut inside a sentence produces text
 * that reads as complete and is not — the failure this whole module exists to
 * prevent, reintroduced one layer down. The first line is always kept even when
 * it alone exceeds the budget: a block with no text at all would say a handover
 * was delivered when nothing was.
 */
function capToBudget(lines: string[], budgetChars: number): string[] {
  const kept: string[] = [];
  let spent = 0;
  for (const line of lines) {
    if (spent + line.length + 1 > budgetChars && kept.length > 0) break;
    kept.push(line);
    spent += line.length + 1;
  }
  return kept;
}

/**
 * As `capToBudget`, then back up to the last heading, so an unmarked handover
 * is cut at a section boundary rather than mid-argument.
 *
 * Only when something was actually dropped: a file that fits whole keeps its
 * last section, and backing up unconditionally would throw away the end of a
 * short handover for no reason at all. If there is no heading to back up to —
 * a handover with one heading, or none — the budgeted lines stand, because a
 * boundary that does not exist cannot be found and returning nothing is worse
 * than returning a paragraph.
 */
function capToSection(lines: string[], budgetChars: number): string[] {
  const kept = capToBudget(lines, budgetChars);
  if (kept.length === lines.length) return kept;
  for (let i = kept.length - 1; i > 0; i -= 1) {
    if (HEADING.test(kept[i]!)) return kept.slice(0, i);
  }
  return kept;
}

/**
 * The block as the model receives it, or `''` when there is nothing to say.
 *
 * IT DECLARES WHAT IT LEFT BEHIND, and that is a hard requirement rather than a
 * courtesy: `REQ-every-list-and-table-declares-what-leaves-it-and-when-and`
 * governs every list and table in this product, and a truncated document is the
 * same act — a block that quietly delivers 40 lines of 1,435 claims to be the
 * handover and is not. The count is lines rather than tokens because lines are
 * what a reader can go and check.
 *
 * A MISSING handover renders too, and loudly. This block never reaches the
 * model — the caller writes it to stderr — but it is built here so that the
 * missing case cannot be forgotten at the one call site that would have to
 * remember it. The silence is the defect: a configured handover that is not
 * there means the agreement broke, and nine days were lost in August 2026 to a
 * mechanism that found nothing and said nothing about it.
 */
export function handoverBlock(read: HandoverRead): string {
  if (read.state === 'off') return '';
  if (read.state === 'missing') {
    return 'my_context: handover.path is `' + read.path + '` and there is no file there. '
      + 'Nothing was carried across this boundary — either the file moved or the key is wrong.\n';
  }
  const held = read.totalLines - read.deliveredLines;
  const where = read.source === 'marker' ? 'the marked section' : 'the head';
  return '## handover — what the last session left for this one\n\n'
    + read.text + '\n\n'
    + `_${read.deliveredLines} of ${read.totalLines} lines, from ${where} of \`${read.path}\`. `
    + (held === 0
      ? 'That is the whole file._\n'
      : `${held} lines are NOT here; read the file for them._\n`);
}
