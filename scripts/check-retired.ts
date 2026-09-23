#!/usr/bin/env node
/**
 * **A correction recorded in §0 must also be applied in the body.**
 *
 * The re-verification pass of 2026-08-18 wrote a §0 into each web-UI plan
 * recording every fact that no longer held — and left the task bodies saying
 * the old thing. Plan 1's §0 stated that the Ledger had left the hook's path;
 * four passages downstream still instructed an implementer to write
 * `seen: ledger.seen(session)` "exactly as the hook does", with the stale
 * citation attached. §0 also recorded that the landing screen is the injection
 * preview; `route()` twenty tasks later still defaulted to `status`.
 *
 * §8.1 step 3 asks for both halves — *"delete every fact that no longer holds,
 * and record what replaced it"* — and only the recording half is visible when
 * you re-read §0. The deleting half is invisible by construction: nothing about
 * a correct §0 tells you the body disagrees with it. That is the same shape as
 * `RULE-quote-the-test-glob` (a green run over half a suite) and as a citation
 * that silently stops resolving. It needs a checker, not more discipline.
 *
 * THE CONTRACT. A document may declare retired phrases in an HTML comment:
 *
 *     <!-- retired-phrases
 *     ledger.seen(session) exactly as the hook does
 *     || 'status'
 *     -->
 *
 * Every listed phrase must appear NOWHERE in that document below its §0
 * section. §0 itself is exempt, because its whole job is to quote the retired
 * text in a `Was` column — a checker that failed on §0 would force the
 * correction log to stop naming what it corrected.
 *
 * Run by `npm run check:retired`, and by both workflows.
 *
 * ── WHERE IT LOOKS, AND WHY THAT CHANGED ───────────────────────────────────
 *
 * **It used to enumerate what it would SCAN**: `ROOTS` named three directories
 * under `docs/`, and a document anywhere else — `reports/`, `README.md`,
 * `docs/capabilities/`, a corpus item — could declare a `<!-- retired-phrases
 * -->` block and nothing would ever read it. That is the worst shape a gate
 * can have, because the contract here is an OPT-IN: an author writes the
 * declaration in order to be checked, and the answer was silence that is
 * indistinguishable from a pass.
 *
 * `TASK-a-scanner-enumerates-what-it-will-skip-not-what-it-will-scan` names
 * this file for exactly that. So the population is now every Markdown document
 * GIT TRACKS, and the only thing left out is a file that is not Markdown —
 * declared in `SKIP_REASON_NOT_MARKDOWN`, counted, and printed, because the
 * contract is an HTML comment inside a Markdown document and nothing else can
 * carry one. A document that declares nothing still costs one read and
 * contributes nothing, which is the correct price for never having to ask
 * where the checker is allowed to look.
 *
 * `test/scripts/retired-phrases-gate.test.ts` holds the walk to the four trees
 * `ROOTS` could not reach, and still plants a violation to prove it goes red.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isMainEntry } from '../src/core/paths.ts';
import { skipLines, walkTracked, type Skip } from './tracked-walk.ts';

const REPO = path.resolve(import.meta.dirname, '..');

const BLOCK = /<!--\s*retired-phrases\s*\n([\s\S]*?)-->/;

export interface Hit { doc: string; line: number; phrase: string; text: string }
export type { Skip };

/** The one reason a tracked file is not considered, stated so it can be printed. */
export const SKIP_REASON_NOT_MARKDOWN =
  'not Markdown — the contract is an HTML comment inside a Markdown document';

/**
 * Every tracked Markdown document, and every tracked file that is not one,
 * with the reason it was left out.
 *
 * Fails CLOSED. `git ls-files` failing throws rather than yielding an empty
 * list: "0 documents checked, every correction applied" is the sentence this
 * gate must never be able to print while blind.
 */
export function candidates(root: string): { considered: string[]; skipped: Skip[] } {
  const walk = walkTracked(
    root, (file) => (file.endsWith(`.md`) ? null : SKIP_REASON_NOT_MARKDOWN),
  );
  return { considered: walk.scanned, skipped: walk.skipped };
}

/**
 * The line index at which §0 ends — the next `## ` heading after it. Documents
 * with no §0 are checked whole, which is right: a retired phrase declared
 * without a correction log to quote it has nowhere legitimate to appear.
 */
export function bodyStart(lines: string[]): number {
  const zero = lines.findIndex((l) => /^## 0\./.test(l));
  if (zero === -1) return 0;
  for (let i = zero + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i]!)) return i;
  }
  return lines.length;
}

/**
 * The retired phrases still standing in one document's body, and the count of
 * phrases it declared. A document that declares nothing returns no hits — it
 * is read, and it contributes nothing, which is not the same as not being
 * looked at.
 */
export function hitsIn(rel: string, text: string): Hit[] {
  const m = BLOCK.exec(text);
  if (m === null) return [];

  const phrases = m[1]!.split(/\r?\n/).map((p) => p.trim()).filter((p) => p !== '');
  const lines = text.split(/\r?\n/);
  const from = bodyStart(lines);

  // The declaration block is not a violation of its own rule, so its LINE
  // RANGE is skipped. An earlier version tested each line against `BLOCK`
  // after wrapping it in the comment delimiters -- a template that matches
  // for EVERY possible line, so the checker skipped the whole document and
  // could not fail. It was caught by reintroducing a real retired phrase and
  // watching it pass: a checker is not verified until it has been made red.
  const blockStart = lines.findIndex((l) => l.includes('<!-- retired-phrases'));
  let blockEnd = blockStart;
  if (blockStart !== -1) {
    for (let i = blockStart; i < lines.length; i++) {
      if (lines[i]!.includes('-->')) { blockEnd = i; break; }
    }
  }

  const hits: Hit[] = [];
  for (let i = from; i < lines.length; i++) {
    if (blockStart !== -1 && i >= blockStart && i <= blockEnd) continue;
    const line = lines[i]!;
    for (const phrase of phrases) {
      if (line.includes(phrase)) hits.push({ doc: rel, line: i + 1, phrase, text: line.trim() });
    }
  }
  return hits;
}

/** How many phrases a document declares; 0 when it declares no block. */
export function declaredIn(text: string): number {
  const m = BLOCK.exec(text);
  if (m === null) return 0;
  return m[1]!.split(/\r?\n/).map((p) => p.trim()).filter((p) => p !== '').length;
}

export interface Tally {
  considered: number; declaring: number; phrases: number; hits: number; skipped: Skip[];
}

/**
 * What was read, what declared, what was skipped and why.
 *
 * `STD-a-measured-zero-is-drawn-and-named`. The old summary counted only the
 * documents that DECLARED — a number with no denominator, which reads the same
 * whether the walk covered the repository or three directories of it.
 */
export function summarise(t: Tally): string {
  const n = (v: number): string => v.toLocaleString('en-US');
  return [
    `${n(t.considered)} tracked Markdown document(s) considered: ${n(t.declaring)} declare `
    + `retired phrases, ${n(t.phrases)} phrase(s) in all, ${n(t.hits)} still present in a body.`,
    ...skipLines(t.skipped),
  ].join('\n');
}

function main(): number {
  const argv = process.argv.slice(2);
  const quiet = argv.includes('--quiet');

  const { considered, skipped } = candidates(REPO);
  considered.sort();

  const hits: Hit[] = [];
  let declared = 0;
  let checked = 0;

  for (const rel of considered) {
    const text = readFileSync(path.join(REPO, rel), 'utf8');
    const phrases = declaredIn(text);
    if (phrases === 0) continue;
    checked++;
    declared += phrases;
    hits.push(...hitsIn(rel, text));
  }

  for (const h of hits) {
    process.stdout.write(
      `RETIRED ${h.doc}:${h.line}\n` +
      `        phrase: ${h.phrase}\n` +
      `        line:   ${h.text.slice(0, 110)}\n`,
    );
  }

  if (!quiet || hits.length > 0) {
    process.stdout.write(`\n${summarise({
      considered: considered.length,
      declaring: checked,
      phrases: declared,
      hits: hits.length,
      skipped,
    })}\n`);
    if (hits.length === 0) {
      process.stdout.write('every recorded correction is also applied.\n');
    } else {
      process.stdout.write(
        'A §0 row records what changed; the body has to stop saying the old thing.\n' +
        'See VERSIONING-adjacent reasoning in scripts/check-retired.ts.\n',
      );
    }
  }
  return hits.length > 0 ? 1 : 0;
}

if (isMainEntry(import.meta.filename, process.argv[1])) process.exit(main());
