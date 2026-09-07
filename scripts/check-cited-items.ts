#!/usr/bin/env node
/**
 * **A citation proves the CODE is real. Nothing proved the ITEM still governs.**
 *
 *     npm run check:cited-items
 *
 * `scripts/verify-citations.ts` resolves `` `file` · `fragment` · ~line `` and
 * answers one direction of the question: does this pointer still land on real
 * code? The inverse was never asked. A comment in `e2e/app.ts` naming
 * `DEC-the-ui-is-developed-against-a-simulated-corpus-until-the` as *"the
 * owner's standing ruling"* read as current for weeks after he had superseded
 * it with `INSTR-testing-happens-against-the-current-corpus-and-an-exception`,
 * and a session reasoned from it for hours before the product refused a second
 * supersession and the truth surfaced. Every gate was green the whole time.
 *
 * The obvious remedy — retire harder, drop retired items out of the corpus —
 * was measured and is the wrong way round. The item was NEVER INJECTED (zero
 * mentions in that session's `SessionStart` output); injection already filters
 * retired items through `RETIRED_STATUSES` (`core/select.ts`); the carrier was
 * a LIVE COMMENT in a source file. Deleting the item would have left that
 * comment citing something that no longer exists — less recoverable, not more.
 * The corpus behaved correctly and the source did not, so the check belongs
 * over the source.
 *
 * ── REPORTED, NEVER GATED, AND THAT IS THE LOAD-BEARING DECISION ────────────
 *
 * Owner ruling 2026-09-07, in
 * `TASK-code-and-tests-that-speak-with-a-retired-item-s-authority`: *"A comment
 * citing a retired decision is OFTEN CORRECT AS HISTORY — 'this was ruled X,
 * then superseded by Y' is exactly the reasoning this codebase keeps in its
 * comments on purpose. A gate that forced thirty-one edits would delete history
 * to go green."*
 *
 * So no finding here ever sets the exit code, and there is deliberately **no
 * `--strict` flag to flip.** That absence is the difference between this and
 * `verify-citations.ts`'s ungated source tier: there, the ungated numbers are a
 * debt waiting for a repair that turns the flag on; here they are a class of
 * finding that is frequently CORRECT AS IT STANDS, and a flag would invite
 * somebody to gate it later without re-reading the ruling.
 *
 * **The OUTPUT is the product.** What failed on 2026-09-07 was a reader
 * believing a live-sounding comment, so what this must do is put the retirement
 * and its SUCCESSOR in front of that reader without them having to look
 * anything up. Three consequences, and each is a design decision rather than a
 * formatting choice:
 *
 *   - **Findings are grouped by cited ITEM, not by file.** The successor is the
 *     sentence a reader actually needs; printed once at the head of a block it
 *     is read, and repeated beside 56 sites it is skipped.
 *   - **The successor chain is followed to the end** (`successorChain`). One of
 *     the sixteen findings on the day this landed pointed at a successor that
 *     is ITSELF superseded, so a reader who followed one hop landed on another
 *     retired item and had no way to know.
 *   - **A site that already says so is marked as such** (`DISCLOSURE`).
 *     Thirty-five of the 56 sites are comments — the shape that caused the
 *     defect — and only six of those tell the reader the ruling moved. That
 *     split is the finding; the raw count is not.
 *
 * The one non-zero exit is "nothing was checked" — no workspace, an empty
 * corpus, or an empty walk. That is not a finding; it is this script reporting
 * that it did not run, which this project has now been bitten by in six other
 * shapes. `check-handover.ts` draws the same line in the same place.
 *
 * ── WHY THIS IS A SCRIPT AND NOT A MODE OF `verify-citations.ts` ────────────
 *
 * That was the first candidate, and its own header rules it out twice, in
 * writing. Its settled rule is that **it walks what it can resolve BY
 * FRAGMENT**, which is why it refuses `.my_context/items/` and the handover:
 * *"The corpus does not speak this form; it speaks `file:line`."* An item id is
 * neither — it is the project's own pointer vocabulary, resolved against the
 * corpus rather than against a quotation. That header names the instrument for
 * exactly this: *"100 `plan/seq` lane references and 63 item ids, which resolve
 * against the corpus rather than against a fragment. Those are checked by
 * `scripts/check-handover.ts`, which is the instrument this notation is not."*
 *
 * This is that instrument, pointed at the source tree instead of at one
 * document — so the id-reading half is IMPORTED from `check-handover.ts`
 * (`ITEM_ID`, `readCorpus`, `resolveId`) rather than written a second time.
 * `resolveId` in particular carries a measurement this file must not re-take:
 * not every `CAPS-lowercase` string is an id (`UI-side`, `MCP-only`,
 * `SVG-blind`, `NUL-byte`), and the rule telling them apart was derived from
 * this corpus rather than guessed. It also resolves a SHORTENED id by
 * unambiguous prefix, which matters more here than it did there: NINE of the 56
 * sites found on the day this landed write the id shortened or broken at one of
 * its own hyphens — `CONST-live` standing for
 * `CONST-live-pass-probe-of-the-agent-normative-trust-boundary`, which is
 * itself deprecated with no successor recorded, which is why the example below
 * quotes it — and an exact-match scan misses every one of them. That is a sixth
 * of the findings, and it is why the ad-hoc measurement this task was filed
 * from counted 32 where this counts 36 distinct file/item pairs.
 *
 * A doctor check was the second candidate and is the closer call.
 * `checkCitationForm` already walks repo files and reports at `info`, which
 * never moves doctor's exit code, so "never gated" would have been satisfied
 * there too. It is not the home because a doctor finding is a claim about the
 * CORPUS, keyed to an item, that a person is expected to settle or acknowledge
 * — and these findings are frequently correct as they stand, with nothing to
 * settle. Sixteen permanent unclearable rows in the worklist the owner reads is
 * the wall this project keeps refusing to build.
 *
 * ── WHAT IS DERIVED RATHER THAN RESTATED ────────────────────────────────────
 *
 * `check-dependency-budget.ts` parses its enumeration out of the constraint
 * that owns it instead of copying the list, and says why: *"two lists that must
 * be edited together are two lists that will disagree."* The same instinct
 * applies here, and the enumeration in question is which statuses count as
 * retired.
 *
 * It is NOT written out here. `RETIRED_STATUSES` (`core/select.ts`) is the set
 * INJECTION itself filters on, so this check and the injector cannot disagree
 * about what "retired" means — and if they ever could, the injector would be
 * hiding an item this script still called live, which is the 2026-09-07 defect
 * running backwards.
 *
 * **A measured zero, drawn and named** (`STD-a-measured-zero-is-drawn-and-named`):
 * that set holds three statuses and this corpus uses two. Zero items are
 * `validated` today, so re-measuring through the real constant instead of the
 * ad-hoc `superseded|deprecated` the task was filed from changes nothing NOW —
 * and is still the right dependency, because the day a `validated` item appears
 * nobody will remember to come back here.
 *
 * The successor is derived too, from the `superseded_by` relation
 * `supersedeItem` writes on the retired item — the only route the corpus has
 * from a retired item back to what replaced it, capped at one by
 * `existingSuccessorRefusal` precisely so that "what replaced this?" has one
 * answer. A `deprecated` item may legitimately have none: five of the sixteen
 * findings have no successor at all, which is 17 of the 56 sites pointing at a
 * ruling with nowhere to go next, and this says so rather than leaving a blank.
 *
 * ── WHAT IT CANNOT SEE, SAID PLAINLY SO THE RESULT IS NOT READ WIDER ────────
 *
 * **A test can rest on a retired ruling WITHOUT CITING IT, and nothing here
 * will ever find it.** A comment names its authority; a fixture just encodes
 * it. The measured case is `budget/16`, whose change reds 49 tests across 14
 * files with not one logic failure among them: every one is a fixture written
 * when a non-`always` governing item could not reach a full-text tier, and no
 * citation anywhere connects any of them to the ruling that changed it. That is
 * not a scanning problem with a cleverer scanner behind it — the premise is not
 * written down anywhere to be scanned. It is findable at RULING time, by the
 * successor naming the tests whose premise it changes, and the argument is in
 * `TASK-code-and-tests-that-speak-with-a-retired-item-s-authority` and in
 * `OPENQ-does-the-pinned-tier-spend-its-spare-room-on-governing-items`.
 *
 * Naming the blind spot here rather than only in the corpus is deliberate: a
 * reader who runs this and sees a small number must not conclude that little
 * code rests on retired rulings. They have seen the cited half.
 *
 * **AND A SECOND MEASUREMENT, REFUSED AS A FINDING.** An id-shaped string that
 * answers to NO item is the same class of claim — code naming a ruling that is
 * not there — and it is not reported by default. Measured 2026-09-07: 2,155 of
 * them, against 1,415 that resolve. Almost every one is a test fixture inventing
 * an id (`RULE-never-log-customer-email`, `DEC-nobody-has-ruled-on-this-one`,
 * `CONST-the-pool-is-capped-at-20-connections`), which is what a corpus test
 * MUST do, and nothing distinguishes an invented id from a deleted one by
 * inspection. Two thousand findings nobody is asked to repair is a wall, and the
 * first thing that happens to a wall is that someone routes around it, taking
 * the sixteen real findings with them. `--unresolved` prints them for whoever
 * wants to read them; nothing counts them.
 *
 * ── RUNNING IT ──────────────────────────────────────────────────────────────
 *
 *     npm run check:cited-items
 *     node scripts/check-cited-items.ts --json
 *     node scripts/check-cited-items.ts --quiet       # the summary only
 *     node scripts/check-cited-items.ts --unresolved  # also the id-shaped
 *                                                     # strings nothing answers to
 *
 * Exit 0 whenever the walk ran, findings or not.
 *
 * Zero dependencies, no build step, erasable syntax only — the same constraints
 * as `src/`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { loadLayer, type LoadError } from '../src/core/rebuild.ts';
import { isMainEntry } from '../src/core/paths.ts';
import { resolveWorkspace } from '../src/core/workspace.ts';
import { RETIRED_STATUSES } from '../src/core/select.ts';
import { SUPERSEDED_BY } from '../src/core/relations.ts';
import { ITEM_ID, readCorpus, resolveId, type Corpus } from './check-handover.ts';
import type { Item } from '../src/core/types.ts';

const REPO = path.resolve(import.meta.dirname, '..');

/**
 * The trees walked: the four `verify-citations.ts` names in its `SOURCE_ROOTS`,
 * and the four the task's own `scope` lists. Restated rather than imported
 * because that script runs `process.exit(main())` at module load and therefore
 * cannot be imported at all.
 */
export const SOURCE_ROOTS = ['src', 'test', 'scripts', 'e2e'];

/**
 * A file a person wrote and cites from. `.js` is not build output in this
 * repository and never can be — there is no build step
 * (`CONST-node-24-no-build-step`) — so `src/ui/public/**`, thirty-five
 * hand-written ES modules, is source like everything else. `.d.ts` is generated
 * and cites nothing.
 */
export const isSourceFile = (name: string): boolean =>
  /\.(?:ts|js|mjs|cjs)$/.test(name) && !name.endsWith('.d.ts');

/** `//`, `/*`, `/**` or a continuation `*`, plus the one blank that follows. */
const COMMENT_PREFIX = /^[ \t]*(?:\/\/+|\/\*+|\*+(?!\/))[ \t]?/;

/** The star-slash closing a block comment at the end of a comment line. */
const COMMENT_CLOSE = /[ \t]*\*+\/[ \t]*$/;

/**
 * **The words that make a comment disclose its own citation's retirement.**
 *
 * Deliberately small and deliberately about STATUS rather than about tone. It
 * is asked of the citation's own PARAGRAPH (see `paragraphAround`) and it
 * decides nothing except a four-character tag beside a site that is printed
 * either way — a heuristic may annotate a finding here, and may never suppress
 * one.
 *
 * **It is asked of the PROSE, with every item id removed first**, and that is
 * not a refinement — it is the difference between working and not. Ids are
 * slugged titles, and this corpus contains
 * `TASK-learn-cross-links-a-superseded-item-and-a-closed-task-and`: a paragraph
 * that merely NAMES it would have matched "supersed" out of the id itself and
 * declared a citation disclosed by a word nobody wrote about it. The bug was
 * found by a planted test whose fake id happened to contain "reversed", which
 * is how it would eventually have been found in the tree. `checkCitationForm`
 * makes the same move for the same reason, reading a line with its marker's own
 * text stripped out.
 */
const DISCLOSURE = /\b(supersed|retired|deprecat|no longer|reversed|overruled|obsolete|replaced by)/i;

/** Where in the file an id was written, which is the whole of what it claims. */
export type Where = 'comment' | 'code';

/** One place in one file that names an item id. */
export interface Site {
  /** Repo-relative, POSIX. */
  file: string;
  line: number;
  /** Exactly as written, which may be a shortened or line-wrapped id. */
  raw: string;
  where: Where;
  /**
   * The comment paragraph around it already says the ruling moved. Always
   * `false` for a `code` site: a string literal makes no claim to disclose.
   */
  disclosed: boolean;
  /** The line itself, trimmed, so the report can be read without opening it. */
  text: string;
}

/** A retired item that source still names, and everywhere it is named. */
export interface Finding {
  id: string;
  status: string;
  title: string;
  /**
   * `superseded_by` followed to the end, excluding `id` itself. Empty when the
   * corpus records no successor; longer than one when the successor is itself
   * retired.
   */
  chain: Array<{ id: string; status: string; title: string; summary: string | null }>;
  /** `valid_until`, when the retirement stamped one. */
  validUntil: string | null;
  sites: Site[];
}

export interface Report {
  filesWalked: number;
  /** Every id occurrence that resolved to a real item. */
  citations: number;
  /** Distinct items named by source. */
  citedItems: number;
  /** Every item in the corpus whose status is in `RETIRED_STATUSES`. */
  retiredItems: number;
  /** Occurrences naming a retired item. */
  retiredCitations: number;
  findings: Finding[];
  /** Ids that look like ids and answer to nothing — printed only on request. */
  unresolved: Array<{ file: string; line: number; raw: string; why: string }>;
}

/**
 * Every source file under `dir`. Exported so the test's anti-vacuity pass walks
 * the SAME tree this does — a test that reimplemented the walk could agree with
 * itself about a tree neither of them covers.
 */
export function walkSources(dir: string, out: string[]): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = path.join(dir, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) walkSources(full, out);
    else if (isSourceFile(entry)) out.push(full);
  }
  return out;
}

const rel = (full: string): string => path.relative(REPO, full).split(path.sep).join('/');

function commentPayload(line: string): string | null {
  const m = COMMENT_PREFIX.exec(line);
  if (m === null) return null;
  return line.slice(m[0]!.length).replace(COMMENT_CLOSE, '');
}

/**
 * **The comment PARAGRAPH around line `n`, which is the author's own unit.**
 *
 * Neither the line nor the whole comment run, and both alternatives were
 * measured on the 36 comment sites of 2026-09-07:
 *
 *     window                  reads as disclosed   longest window
 *     the line, ±3            6                    7 lines
 *     the whole comment run   11                   180 lines
 *     the paragraph           7                    22 lines
 *
 * The run is the unit `verify-citations.ts` joins on, correctly, because a
 * citation's three parts wrap and a hint on the next line is still that
 * citation's hint. It is the wrong unit for a CLAIM: this codebase writes
 * 180-line docblocks, and the word "superseded" a hundred lines away in a
 * different argument does not tell a reader that THIS ruling moved. The run
 * window marked `src/ui/public/screens/learn.js` disclosed on that basis and
 * it was reading a different paragraph entirely.
 *
 * Every such docblock is paragraphed, with a bare `*` between paragraphs, so
 * the paragraph is a real structure in the tree rather than a window size
 * chosen to make a number look good. A non-comment line ends a paragraph the
 * same way a blank comment line does.
 */
export function paragraphAround(lines: string[], n: number): string {
  const blank = (i: number): boolean => {
    const p = commentPayload(lines[i]!);
    return p === null || p.trim() === '';
  };
  let a = n;
  let b = n;
  while (a > 0 && !blank(a - 1)) a--;
  while (b < lines.length - 1 && !blank(b + 1)) b++;
  return lines
    .slice(a, b + 1)
    .map((l) => commentPayload(l) ?? '')
    .join(' ');
}

/**
 * **The successor, followed to the end rather than one hop.**
 *
 * `supersedeItem` writes both directions — `supersedes` on the replacement,
 * `superseded_by` on the item it retires — and `existingSuccessorRefusal` caps
 * the back edge at one so that "what replaced this?" has exactly one answer.
 * Reading the back edge is therefore reading the corpus's own record.
 *
 * **One hop is not enough, measured.** `OPENQ-how-do-filters-respect-dependencies`
 * is superseded by `DEC-focus-discloses-and-allows-rather-than-refusing-to-hide`,
 * which is ITSELF superseded by
 * `DEC-a-focus-may-not-hide-a-pinned-item-focushides-exempts-always`. Ten source
 * sites cite the first. A report naming only the first hop would send every one
 * of those readers to a second retired item and give them no reason to doubt
 * it, which is the defect this whole script exists to end, reproduced by the
 * script itself.
 *
 * `seen` is not defensive decoration. The cap is one back-edge per item, not
 * one per corpus, so a cycle is expressible in the files even though no command
 * writes one — and an unguarded walk over a hand-edited corpus would hang here
 * rather than report.
 */
export function successorChain(item: Item, byId: Map<string, Item>): Item[] {
  const chain: Item[] = [];
  const seen = new Set<string>([item.id]);
  let cursor: Item | undefined = item;
  while (cursor !== undefined) {
    const edge = cursor.relations.find((r) => r.type === SUPERSEDED_BY);
    if (edge === undefined || seen.has(edge.target)) break;
    seen.add(edge.target);
    const next = byId.get(edge.target);
    if (next === undefined) break;
    chain.push(next);
    cursor = RETIRED_STATUSES.has(next.status) ? next : undefined;
  }
  return chain;
}

interface Hit {
  file: string;
  line: number;
  raw: string;
  id: string | null;
  why: string | null;
  where: Where;
  disclosed: boolean;
  text: string;
}

/**
 * Every item id written in `text`, with the physical line it sits on.
 *
 * Line at a time, and not joined the way `verify-citations.ts` joins comment
 * runs. An id is one unbroken word, so the wrap that hides a `·` separator
 * cannot cut an id except at one of its own hyphens — and a hyphen-broken id is
 * exactly what `resolveId`'s prefix rule already resolves. Joining would buy
 * nothing and would cost the true line number of every finding.
 */
export function scanFile(text: string, file: string, corpus: Corpus): Hit[] {
  const out: Hit[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    let where: Where | null = null;
    for (const m of line.matchAll(ITEM_ID)) {
      const raw = `${m[1]!}-${m[2]!}`;
      const r = resolveId(corpus, raw);
      if (r.skip) continue;
      // Computed once per LINE and only for a line that turned out to carry an
      // id: `paragraphAround` walks outward and most lines carry nothing.
      if (where === null) where = COMMENT_PREFIX.test(line) ? 'comment' : 'code';
      out.push({
        file,
        line: i + 1,
        raw,
        id: r.id,
        why: r.why,
        where,
        disclosed: false,
        text: line.trim(),
      });
    }
  }
  return out;
}

export function build(files: string[], corpus: Corpus, items: Item[]): Report {
  const byId = corpus.byId;
  const retired = items.filter((i) => RETIRED_STATUSES.has(i.status));
  const hits = new Map<string, Site[]>();
  const cited = new Set<string>();
  const unresolved: Array<{ file: string; line: number; raw: string; why: string }> = [];
  let citations = 0;
  let retiredCitations = 0;

  for (const full of files) {
    const file = rel(full);
    let text: string;
    try {
      text = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (const found of scanFile(text, file, corpus)) {
      if (found.id === null) {
        if (found.why !== null) {
          unresolved.push({ file: found.file, line: found.line, raw: found.raw, why: found.why });
        }
        continue;
      }
      citations++;
      cited.add(found.id);
      const item = byId.get(found.id)!;
      if (!RETIRED_STATUSES.has(item.status)) continue;
      retiredCitations++;
      // Disclosure is asked only where it can be answered, and only of the
      // sites that will be printed — a string literal discloses nothing, and
      // the paragraph walk is the one expensive step here.
      const paragraph = found.where === 'comment' ? paragraphAround(lines, found.line - 1) : '';
      const chain = successorChain(item, byId);
      const site: Site = {
        file: found.file,
        line: found.line,
        raw: found.raw,
        where: found.where,
        // Two separate readings of one paragraph, and they must not be merged.
        // The VOCABULARY is asked of the prose with every id stripped out (see
        // `DISCLOSURE`); the SUCCESSOR is asked of the paragraph as written,
        // because naming the successor is itself the disclosure.
        disclosed:
          found.where === 'comment' &&
          (DISCLOSURE.test(paragraph.replace(ITEM_ID, ' ')) ||
            chain.some((c) => paragraph.includes(c.id))),
        text: found.text,
      };
      const list = hits.get(found.id);
      if (list) list.push(site);
      else hits.set(found.id, [site]);
    }
  }

  const findings: Finding[] = [];
  for (const [id, sites] of hits) {
    const item = byId.get(id)!;
    findings.push({
      id,
      status: item.status,
      title: item.title,
      chain: successorChain(item, byId).map((c) => ({
        id: c.id,
        status: c.status,
        title: c.title,
        summary: c.summary,
      })),
      validUntil: item.validUntil,
      // Comments first: they are the shape that makes an authority claim, and
      // the shape that caused the defect. Within each, undisclosed first.
      sites: sites.sort(
        (a, b) =>
          Number(a.where === 'code') - Number(b.where === 'code') ||
          Number(a.disclosed) - Number(b.disclosed) ||
          (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1),
      ),
    });
  }
  findings.sort(
    (a, b) =>
      liveSites(b).length - liveSites(a).length ||
      b.sites.length - a.sites.length ||
      (a.id < b.id ? -1 : 1),
  );

  return {
    filesWalked: files.length,
    citations,
    citedItems: cited.size,
    retiredItems: retired.length,
    retiredCitations,
    findings,
    unresolved,
  };
}

/** The sites that read as a live ruling: a comment, saying nothing about the retirement. */
export function liveSites(f: Finding): Site[] {
  return f.sites.filter((s) => s.where === 'comment' && !s.disclosed);
}

export function render(report: Report, showUnresolved: boolean): string {
  const out: string[] = [];
  for (const f of report.findings) {
    const live = liveSites(f).length;
    out.push(`RETIRED ${f.id}`);
    out.push(
      `        ${f.status}${f.validUntil === null ? '' : ` since ${f.validUntil}`} — ${f.title}`,
    );
    if (f.chain.length === 0) {
      out.push('        NO SUCCESSOR RECORDED — the corpus holds no `superseded_by` edge from it,');
      out.push('        so a reader who follows this citation has nowhere to go next.');
    } else {
      let indent = '        superseded by ';
      for (const c of f.chain) {
        out.push(`${indent}${c.id}${RETIRED_STATUSES.has(c.status) ? `  [${c.status} TOO]` : ''}`);
        indent = '        ↳ then by      ';
      }
      const last = f.chain[f.chain.length - 1]!;
      const says = last.summary ?? last.title;
      if (says !== '') out.push(`        which says: ${says}`);
    }
    out.push(
      `        ${f.sites.length} site(s): ${live} comment(s) that read as a live ruling, ` +
        `${f.sites.filter((s) => s.where === 'comment' && s.disclosed).length} that say the ruling moved, ` +
        `${f.sites.filter((s) => s.where === 'code').length} in code rather than in prose`,
    );
    for (const s of f.sites) {
      const tag =
        s.where === 'code' ? 'code  ' : s.disclosed ? 'says  ' : 'LIVE  ';
      out.push(`        ${tag}${s.file}:${s.line}${s.raw === f.id ? '' : `  (written "${s.raw}")`}`);
      out.push(`              ${s.text.slice(0, 100)}`);
    }
    out.push('');
  }
  if (showUnresolved) {
    for (const u of report.unresolved) {
      out.push(`UNKNOWN ${u.file}:${u.line}  ${u.raw} — ${u.why}`);
    }
    if (report.unresolved.length > 0) out.push('');
  }
  return out.join('\n');
}

export function summary(report: Report, showUnresolved: boolean): string {
  const all = report.findings.flatMap((f) => f.sites);
  const live = report.findings.flatMap((f) => liveSites(f));
  const out: string[] = [];
  out.push(
    `${report.citations} item citation(s) across ${report.filesWalked} source file(s), naming ` +
      `${report.citedItems} distinct item(s) · ${report.retiredItems} of the corpus's items are retired`,
  );
  if (report.findings.length === 0) {
    out.push('no source file speaks with a retired item\'s authority.');
  } else {
    out.push(
      `${all.length} citation(s) in ${new Set(all.map((s) => s.file)).size} file(s) name ` +
        `${report.findings.length} retired item(s): ${live.length} are comments that read as a ` +
        `live ruling, ${all.filter((s) => s.where === 'comment').length - live.length} say the ` +
        `ruling moved, ${all.filter((s) => s.where === 'code').length} are code rather than prose.`,
    );
    out.push(
      `${report.findings.filter((f) => f.chain.length === 0).length} of those item(s) record no ` +
        'successor at all, and ' +
        `${report.findings.filter((f) => f.chain.length > 1).length} were superseded by something ` +
        'that has since been superseded in turn.',
    );
    out.push('');
    out.push(
      'REPORTED, NEVER GATED. This run exits 0 and no flag changes that. A comment citing a ' +
        'retired decision is often CORRECT AS HISTORY — "this was ruled X, then superseded by Y" ' +
        'is reasoning this codebase keeps on purpose — so the repair is almost never to delete a ' +
        'citation. It is to make the LIVE lines above say what is printed over them: name the ' +
        'successor where the reader is, so nobody has to look it up to find out the ruling moved.',
    );
  }
  if (!showUnresolved && report.unresolved.length > 0) {
    out.push('');
    out.push(
      `${report.unresolved.length} id-shaped string(s) answer to no item. Almost every one is a ` +
        'test fixture inventing an id, which a corpus test must do, and nothing tells an invented ' +
        'id from a deleted one by inspection — so they are neither counted above nor reported. ' +
        '--unresolved prints them.',
    );
  }
  out.push('');
  out.push(
    'BLIND SPOT, stated so this number is not read wider than it is: a test can rest on a retired ' +
      'ruling WITHOUT CITING IT. A comment names its authority; a fixture just encodes it, and ' +
      'nothing here can see that — see budget/16 and ' +
      'TASK-code-and-tests-that-speak-with-a-retired-item-s-authority.',
  );
  return out.join('\n');
}

function main(): number {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const quiet = argv.includes('--quiet');
  const showUnresolved = argv.includes('--unresolved');
  const write = (s: string): void => {
    process.stdout.write(`${s}\n`);
  };

  const ws = resolveWorkspace(process.cwd());
  if (ws.projectRoot === null) {
    write(
      'my_context: no workspace here — nothing was checked, which is not the same as nothing ' +
        'being wrong. Run this from a directory inside the project.',
    );
    return 1;
  }
  const errors: LoadError[] = [];
  const items = loadLayer(ws.projectRoot, 'project', errors, ws.config);
  // The vacuous pass, refused the way every other check here refuses it: a
  // corpus with nothing in it resolves nothing, reports nothing, and reads as
  // success. This and the empty walk below are the ONLY non-zero exits, and
  // neither is a finding.
  if (items.length === 0) {
    write(
      `my_context: no items under ${ws.projectRoot} — nothing was checked, which is not the ` +
        'same as nothing being wrong. Run this from the repository root.',
    );
    return 1;
  }
  const corpus = readCorpus(items, ws.config);

  const files: string[] = [];
  for (const root of SOURCE_ROOTS) walkSources(path.join(REPO, root), files);
  files.sort();
  if (files.length === 0) {
    write(
      `my_context: no source files under ${SOURCE_ROOTS.join(', ')} — nothing was checked, ` +
        'which is not the same as nothing being wrong.',
    );
    return 1;
  }

  const report = build(files, corpus, items);

  if (asJson) {
    write(
      JSON.stringify(
        { ...report, loadErrors: errors.map((e) => ({ file: e.file, message: e.message })) },
        null,
        2,
      ),
    );
    return 0;
  }
  if (!quiet) {
    const body = render(report, showUnresolved);
    if (body !== '') process.stdout.write(`${body}\n`);
  }
  write(summary(report, showUnresolved));
  for (const e of errors) write(`load error: ${e.file}: ${e.message}`);
  return 0;
}

if (isMainEntry(import.meta.filename, process.argv[1])) process.exit(main());
