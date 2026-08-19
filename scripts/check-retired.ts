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
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');
const ROOTS = ['docs/superpowers/plans', 'docs/superpowers/specs', 'docs/design'];

const BLOCK = /<!--\s*retired-phrases\s*\n([\s\S]*?)-->/;

interface Hit { doc: string; line: number; phrase: string; text: string }

function markdownFiles(dir: string, out: string[]): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) markdownFiles(full, out);
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

/**
 * The line index at which §0 ends — the next `## ` heading after it. Documents
 * with no §0 are checked whole, which is right: a retired phrase declared
 * without a correction log to quote it has nowhere legitimate to appear.
 */
function bodyStart(lines: string[]): number {
  const zero = lines.findIndex((l) => /^## 0\./.test(l));
  if (zero === -1) return 0;
  for (let i = zero + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i]!)) return i;
  }
  return lines.length;
}

function main(): number {
  const argv = process.argv.slice(2);
  const quiet = argv.includes('--quiet');

  const docs: string[] = [];
  for (const root of ROOTS) markdownFiles(path.join(REPO, root), docs);
  docs.sort();

  const hits: Hit[] = [];
  let declared = 0;
  let checked = 0;

  for (const doc of docs) {
    const text = readFileSync(doc, 'utf8');
    const m = BLOCK.exec(text);
    if (m === null) continue;
    checked++;

    const phrases = m[1]!.split(/\r?\n/).map((p) => p.trim()).filter((p) => p !== '');
    declared += phrases.length;

    const lines = text.split(/\r?\n/);
    const from = bodyStart(lines);
    const rel = path.relative(REPO, doc).split(path.sep).join('/');

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

    for (let i = from; i < lines.length; i++) {
      if (blockStart !== -1 && i >= blockStart && i <= blockEnd) continue;
      const line = lines[i]!;
      for (const phrase of phrases) {
        if (line.includes(phrase)) hits.push({ doc: rel, line: i + 1, phrase, text: line.trim() });
      }
    }
  }

  for (const h of hits) {
    process.stdout.write(
      `RETIRED ${h.doc}:${h.line}\n` +
      `        phrase: ${h.phrase}\n` +
      `        line:   ${h.text.slice(0, 110)}\n`,
    );
  }

  if (!quiet || hits.length > 0) {
    process.stdout.write(
      `\n${declared} retired phrase(s) declared across ${checked} document(s): ` +
      `${hits.length} still present in a body.\n`,
    );
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

process.exit(main());
