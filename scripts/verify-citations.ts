#!/usr/bin/env node
/**
 * **Citations resolve, or this exits 1.**
 *
 * The three web-UI plans went stale silently. Their base commits are not
 * ancestors of `master`, 186 `file:line` citations drifted with them, and the
 * first two sampled were off by 136 and 42 lines — landing mid-comment in
 * unrelated code. Nothing noticed, because nothing was checking.
 *
 * `INV-nothing-is-dropped-silently` is this project's rule for exactly that
 * shape. A citation that quietly stops resolving is that invariant's own
 * failure, one layer up in the documentation. So the citation form carries a
 * VERBATIM source fragment, and this script resolves every one of them.
 *
 * The form (`2026-08-18-v2-decisions.md` §2):
 *
 *     `select.ts` · `export function select(` · ~460
 *      ^ file       ^ verbatim fragment          ^ hint, allowed to be stale
 *
 * The fragment is the identity; the line is a convenience. A refactor that
 * moves code updates the hint (`--fix`) and stays green. A change that
 * deletes or rewrites the cited code turns the citation red — which is the
 * failure you actually want surfaced, and the one a line number cannot
 * distinguish from a harmless shift.
 *
 * **THE ONE EXCEPTION: a document that quotes the past on purpose.**
 *
 * A plan's §0 correction log and its §7 survey quote the PRE-change text
 * verbatim — `test('there are 21 categories', …)` against a catalogue that has
 * since gone to 24. Re-anchoring those to the post-change text would make the
 * survey false and contradict the correction log printed beside it. But to a
 * fragment resolver they are indistinguishable from a stale pointer, so every
 * plan that surveys prior state reddens this gate permanently — and a gate
 * that is always red stops being read, which is the same failure this script
 * exists to prevent one layer down.
 *
 * So a citation may declare itself a historical quotation:
 *
 *     | Both READMEs' counts | `README.md` · `holds **21** categories` · ~3789 <!-- historical-citation: §7 quotes the pre-24 text; Task 2 changes it --> |
 *
 * **The marker's scope is the LINE it sits on, and nothing wider.** A section-
 * or document-level fence would be four edits instead of sixteen, and it is
 * the wrong trade twice over. Its blast radius grows in silence — a task
 * appended below the fence goes unchecked and nothing says so — and, worse, it
 * can never go stale: a section holding forty citations of which three are
 * historical keeps the marker "used" forever, so the day those three stop
 * being historical, nothing notices. At line scope, rule 1 below has teeth.
 *
 * **A marker is not a suppressor. Three rules keep it from becoming one:**
 *
 *   1. **It must excuse something.** A marker on a line whose citations all
 *      resolve — or on a line carrying no citation at all — is itself an error
 *      and fails the run. You cannot pre-arm one against a future break, and
 *      one left behind after the quoted text comes back turns red rather than
 *      hiding the next drift underneath itself.
 *   2. **It must be well formed.** Missing reason, missing colon, unterminated
 *      or misspelled is reported as a fault AND leaves its citations judged as
 *      normal — a mangled marker fails twice rather than swallowing once.
 *   3. **It excuses a missing FRAGMENT only** — never a missing file, never an
 *      ambiguous one. The fragment is the historical claim. A path that
 *      resolves nowhere is indistinguishable from a typo, and history is not
 *      an excuse a typo gets to borrow.
 *
 * There is deliberately no `--fix` for markers, and never should be: a flag
 * that writes suppressions is the blanket suppressor, automated.
 *
 * **THE SECOND FAULT: a separator this script could not read.**
 *
 * `CITATION` joins the three parts with `[ \t]*·[ \t]*` — spaces and tabs, and
 * no newline. A citation already written in the checked form but WRAPPED
 * across two source lines therefore matches nothing. It is not BROKEN. It is
 * invisible: never counted, never resolved, reported nowhere — which is worse
 * than the failure the form was built to end, because it wears the form's own
 * clothes. Twenty-two were found by hand on 2026-08-21, and ten of them came
 * back MOVED the instant the gate could see them.
 *
 * So a `·` that `CITATION` did NOT consume, standing where a citation
 * separator stands, is a fault. There is no third reading of it in this
 * corpus: it is a wrapped citation or a malformed one, and both are things
 * the author believes are checked and are not. Four shapes, all of them real:
 *
 *     `core/search.ts` ·                     ← the fragment is on the next line
 *     `core/inject.ts` · `this selection is  ← the fragment is cut mid-span
 *     `check-retired.ts` · `// watching …` · ← the `~100` is on the next line
 *     · ~8 lists `clear` as a `source` value ← the hint left behind by the above
 *
 * A `·` used as ordinary punctuation is untouched, and the discrimination is
 * not a heuristic: `Profiles: `minimal` (8) · `standard` (17)` has no cited
 * FILE on its left, ``Citations are `file` · `fragment` · `~line``` names no
 * extension, and `**Roadmap:** `docs/ROADMAP.md` · **Reviews:** …` does cite a
 * file but is followed by prose rather than by a fragment or a line ending —
 * the one place a wrapped citation can put its other half.
 *
 * **THE THIRD TREE: source, where most of the citations actually are.**
 *
 * This walked `docs/` and nothing else, which left every citation written in a
 * comment ungated — on 2026-08-23, 248 of them across 67 files, an eighteenth
 * of the corpus, checked by nobody. A comment that names the code it leans on
 * makes exactly the claim a plan makes and rots exactly the same way; the first
 * run over source found six already quoting code that had been rewritten, two
 * of them the same deleted sentence about how a session token is held.
 *
 * Source is read differently in one respect, and only one. In Markdown a
 * citation split over two lines is a fault, because Markdown could have held it
 * on one. In source it is the house style — comments wrap near 80 columns and a
 * fragment that is a whole function signature cannot share a line with its file
 * and its hint. Thirty-nine wrapped on the day this landed. So a run of comment
 * lines is joined into one logical line before anything reads it (see
 * `Segment`), which is what the author wrote and how a reader reads it.
 * Scanning source line-at-a-time instead measured 203 citations rather than
 * 241 — thirty-eight invisible, not broken — and raised seventy extra faults
 * against a style the whole tree uses on purpose.
 *
 * **THE FOURTH TREE: the browser, which every UI change touches and no gate
 * could see.**
 *
 * On 2026-08-29 the walk still meant `src`, `test`, `scripts` and `.ts`. Two
 * whole surfaces fell outside it — `src/ui/public/**` (thirty-five hand-written
 * ES modules: `app.js`, every screen, `lib/live-invalidation.js`) and `e2e/`
 * (the thirty-four-file browser suite). A gate whose blind spot is every file a
 * UI change touches passes most confidently where it checks least, and it was
 * found the only way that ever gets found: a task edited two files inside it,
 * noticed the gate had nothing to say, and resolved its citations by hand.
 *
 * Widening it is two lines (`SOURCE_ROOTS`, `isSourceFile`) and a third that is
 * not optional. Run as those two alone, the widening reported 18 broken
 * citations and 52 faults — and 45 of the 52 were not drift at all. They were
 * citations to `web-ui-mockup.html` and `styles.css`, which `CITATION` could
 * not name and `CITED_FILE_AT_END` therefore called nothing: the form's own gap
 * (`plan:rulings seq:47`), which the browser tree hits hardest because the
 * mockup IS its design of record. Teaching both regexes those two extensions
 * (`CITED_EXT`) turns 40 invisible strings into read citations and drops the
 * fault count from 56 to 17 across the whole run. Shipping the walk without it
 * would have handed four other agents 45 findings that were this script's fault.
 *
 * Measured, before and after, on the same tree:
 *
 *     walk            files    citations   broken   faults
 *     src/test/.ts      537         1420        5        4
 *     + e2e + .js       614         1577       23       56   ← 45 are `.html`
 *     + .html/.css      614         1617       23       17
 *
 * All 40 remaining failures are in source, all in files this change does not
 * own, and every one is REPORTED and not gated — the same tier `src/` has sat
 * in since 2026-08-23, for the same reason, which is written out at `gated`
 * below. The alternative was a gate that went red on 40 pre-existing faults in
 * four other people's files on the night they were editing them; a gate like
 * that is a wall, and the first thing that happens to a wall is that someone
 * routes around it. The teeth still arrive the same way: repair the 40, flip
 * `--strict-source`.
 *
 * **AND THE TREE THIS DELIBERATELY DOES NOT WALK: `.my_context/items/`.**
 *
 * The standing request (`plan:walk seq:30`) is that this gate scan the corpus,
 * on the reasoning that items are where the project keeps its reasoning and a
 * stale citation there misleads for longer than one in a comment. The reasoning
 * is right and the measurement says the gate is the wrong instrument for it:
 *
 *     658 item files
 *       1 citation in this script's form
 *     165 bare `file.ts:123` pointers   (145 in range, 4 past EOF, 9 unresolvable, 7 ambiguous)
 *     340 backticked bare filenames     (298 resolve, 38 do not — mostly outer-repo reports)
 *
 * Pointed at the corpus today this walks 658 files and checks ONE claim. That
 * is not coverage, it is the appearance of coverage, and this script's whole
 * argument is that the appearance is worse than the absence.
 *
 * The corpus does not speak this form; it speaks `file:line`. Teaching this
 * script `file:line` is the one option that must not be taken — a bare line
 * number carries no fragment, so the check can only prove the line EXISTS, and
 * it proved that for 161 of 165 pointers while proving nothing about what any
 * of them say. Four detections out of 165, and a green gate over a form the
 * task that requested this scan calls a trap in its own words: a plausible
 * wrong number sends a reader somewhere real.
 *
 * So the corpus is normalised to this form, or it is not gated. That is a
 * corpus-side change — 165 pointers across 63 items, plus the writer that has
 * to stop emitting `file:line` — and it belongs to whoever owns
 * `.my_context/items/`, not to this file. The rule this script settles by is
 * unchanged and now stated: **it walks what it can resolve BY FRAGMENT.** A
 * tree whose citations carry no fragment is out of scope until they do.
 *
 * Zero dependencies, no build step, erasable syntax only — the same
 * constraints as `src/`.
 *
 * Usage:
 *   node scripts/verify-citations.ts            check, exit 1 on any miss
 *   node scripts/verify-citations.ts --fix      also rewrite stale ~line hints
 *   node scripts/verify-citations.ts --json     machine-readable report
 *   node scripts/verify-citations.ts --strict-source
 *                                               also FAIL on source findings,
 *                                               which are reported either way
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');

/** Documents whose citations are checked. Everything under these, recursively. */
const DOC_ROOTS = ['docs/superpowers/specs', 'docs/superpowers/plans', 'docs/design'];

/**
 * Source trees whose comment citations are checked. Walked on every run and
 * reported on every run; gated only under `--strict-source`.
 *
 * `e2e` joined them on 2026-08-29. It is the browser suite, thirty-four spec
 * files, and it was outside every root this script knew. See `isSourceFile`
 * for the other half of that blind spot and for what the two of them cost.
 */
const SOURCE_ROOTS = ['src', 'test', 'scripts', 'e2e'];

/**
 * **The gate's own specimens, which it must not report as defects.**
 *
 * This script's header documents the citation form by writing citations, and
 * documents the malformed shapes by writing malformed ones — a fragment cut
 * mid-span, a hint orphaned on its own line, a marker excusing a `README.md`
 * count. Its two tests then do the same on purpose, thirteen markers' worth in
 * one and twenty-one unreadable separators in the other, because that is what a
 * test of a malformed citation IS. Walked like ordinary source, these three
 * files reported forty-six faults against text that is doing its job.
 *
 * A specimen cannot be told from a defect by inspection — that is what makes it
 * a good specimen — so the list is EXACT PATHS. Not a glob, which would swallow
 * the next real test file to appear beside them; not a suppression comment,
 * which would let any file opt itself out and turn this exemption into the
 * blanket suppressor the marker rules exist to prevent. Three paths, named, and
 * `citations-in-source.test.ts` plants a defect in a file OUTSIDE the list and
 * proves it is still reported.
 */
const SOURCE_EXEMPT = new Set([
  'scripts/verify-citations.ts',
  'test/scripts/verify-citations.test.ts',
  'test/scripts/citations-in-source.test.ts',
]);

/** Where a bare `select.ts` may be resolved from, in priority order. */
const SEARCH_ROOTS = ['src', 'test', 'scripts', 'docs', '.'];

/**
 * **The extensions a CITED file may carry, written once.**
 *
 * `CITATION` and `CITED_FILE_AT_END` must agree on this exactly. They are the
 * two halves of one judgement — "is the thing left of this separator a cited
 * file?" — and when they disagreed, the disagreement did not read as a bug. A
 * `.html` citation was not matched by the first, so its trailing `· ~1967` fell
 * to the second, which also did not recognise `.html` and therefore called it
 * nothing at all. Forty-five citations to `web-ui-mockup.html` and `styles.css`
 * were invisible on 2026-08-29 for that reason: never counted, never resolved,
 * never reported. One list, referenced twice, is what makes that impossible.
 *
 * `.html` and `.css` are here because the design of record for the web UI is a
 * single mockup HTML file and one stylesheet, and the browser modules cite them
 * the way `src/` cites `select.ts` — by file, fragment and hint. Being unable
 * to name them did not stop anyone citing them; it stopped the gate reading it.
 *
 * Note the asymmetry, which is deliberate: a file may be CITED in these
 * formats without being WALKED for citations of its own. See `SOURCE_ROOTS`.
 */
const CITED_EXT = 'ts|js|mjs|cjs|md|json|html|css';

/**
 * `` `file` · `fragment` · ~line ``, where the fragment may itself contain
 * backticks and is then written as a ``double-backtick span``. The `~line` is
 * optional: a citation may carry the fragment alone.
 */
const CITATION = new RegExp(
  `\`([^\`\\n]+?\\.(?:${CITED_EXT}))\`[ \\t]*·[ \\t]*(?:\`\`(.+?)\`\`|\`((?:\\\\.|[^\`\\n\\\\])+?)\`)(?:[ \\t]*·[ \\t]*~(\\d+))?`,
  'g',
);

/**
 * `<!-- historical-citation: why -->`, matched a line at a time because one
 * line is the marker's entire scope.
 *
 * TWO regexes rather than one, and that is the point of them. `OPEN` finds
 * anything that was TRYING to be a marker; `FULL` decides whether it managed
 * it. A single strict pattern would let `<!-- historical-citations: … -->` or
 * a marker whose `-->` wrapped onto the next line fall through as "no marker
 * here", leaving the author staring at a citation they believe they excused
 * and a checker that never mentions the thing they wrote.
 */
const MARKER_OPEN = /<!--[ \t]*historical-citation/g;
const MARKER_FULL = /^<!--[ \t]*historical-citation[ \t]*:[ \t]*(\S.*?)[ \t]*-->/;

/** The separator `CITATION` looks for, on its own, so the leftovers can be found. */
const SEPARATOR = '·';

/**
 * A cited FILE sitting at the end of the text to the left of a separator —
 * the same `` `name.ts` `` shape `CITATION` opens with, anchored. This, and
 * not "a backtick", is what tells a citation apart from prose that happens to
 * punctuate with `·`.
 */
const CITED_FILE_AT_END = new RegExp(`\`[^\`\\n]+?\\.(?:${CITED_EXT})\`$`);

/** A `~460` line hint at the start of the text to the right of a separator. */
const HINT_AT_START = /^~\d/;

interface Citation {
  doc: string;
  docLine: number;
  file: string;
  fragment: string;
  hint: number | null;
  raw: string;
  /**
   * The citation spans more than one physical line — legal in source, where a
   * comment run is joined before it is read. `raw` is then the JOINED text and
   * appears nowhere in the file, which is why `--fix` may not rewrite it.
   */
  wrapped: boolean;
}

/** A well-formed `<!-- historical-citation: … -->`, and the line it governs. */
interface Marker {
  doc: string;
  docLine: number;
  reason: string;
}

/**
 * Something this script refuses to pass over in silence, and why. Every fault
 * fails the run. Nothing here is a warning.
 *
 * `MARKER` — a marker that is not doing its job: either suppressing something
 * it should not, or claiming to suppress something that does not exist. Both
 * are the failure the marker was added to avoid.
 *
 * `UNREAD` — a `·` standing where a citation separator stands that `CITATION`
 * did not consume: a wrapped or malformed citation, which is the failure the
 * citation form was added to avoid.
 *
 * One list, one counter, one exit code. A second reporting channel would be a
 * second place to stop reading.
 */
interface Fault {
  doc: string;
  docLine: number;
  label: 'MARKER' | 'UNREAD';
  raw: string;
  why: string;
}

type Verdict =
  | { kind: 'ok'; at: number }
  | { kind: 'moved'; at: number }
  | { kind: 'ambiguous'; at: number; count: number }
  | { kind: 'no-file' }
  | { kind: 'no-match' }
  | { kind: 'historical'; reason: string };

function walk(dir: string, out: string[], accept: (name: string) => boolean): string[] {
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
    if (s.isDirectory()) walk(full, out, accept);
    else if (accept(entry)) out.push(full);
  }
  return out;
}

const isMarkdown = (name: string): boolean => name.endsWith('.md');

/**
 * **A source file is not only a `.ts` file, and pretending otherwise hid 164
 * citations.**
 *
 * This accepted `.ts` and nothing else, which put the entire browser tree —
 * `src/ui/public/**`, thirty-five hand-written ES modules, every screen and
 * `app.js` and `lib/live-invalidation.js` — outside a gate that walked the
 * directory they live in. The irony was on the record before it was measured:
 * `live-invalidation.js` exists BECAUSE a hand-kept list of what to refresh
 * drifts, and its own citations were held to nothing.
 *
 * A `.js` module in this project is not build output and never can be — there
 * is no build step (`CONST-node-24-no-build-step`), so every `.js` file here is
 * a file a person wrote and a file a person cites from. `.d.ts` is excluded
 * because it is generated and cites nothing.
 *
 * `.html` and `.css` are deliberately NOT walked, and this is not an oversight
 * left for later. Measured the day this landed: the three such files in the
 * tree carry two citations between them and both resolve. The one file with any
 * content, `docs/design/web-ui-mockup.html`, sits under a GATED doc root, and
 * the comment-run join that lets a citation wrap (see `Segment`) knows the
 * slash-star and double-slash forms but not `<!-- -->`, so a wrapped citation
 * there would be read as a fault it is not. Two green citations are not worth
 * a walk that can only be
 * wrong; when the mockup starts carrying real citation weight, add it with the
 * HTML comment form and not before.
 */
const isSourceFile = (name: string): boolean =>
  /\.(?:ts|js|mjs|cjs)$/.test(name) && !name.endsWith('.d.ts');

/**
 * A citation names `select.ts`, not `src/core/select.ts`, because the short
 * form survives a directory move and reads better in a table. Resolution is
 * therefore a suffix match, and an AMBIGUOUS suffix is an error rather than a
 * guess — two files named `index.ts` must not silently resolve to whichever
 * the walk reached first.
 */
const fileIndex = new Map<string, string[]>();

function indexFiles(): void {
  const push = (rel: string) => {
    const norm = rel.split(path.sep).join('/');
    for (const key of suffixKeys(norm)) {
      const list = fileIndex.get(key);
      if (list) list.push(norm);
      else fileIndex.set(key, [norm]);
    }
  };
  const walkAll = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === '.my_context') continue;
      const full = path.join(dir, entry);
      let s;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) walkAll(full);
      else push(path.relative(REPO, full));
    }
  };
  walkAll(REPO);
}

/** `src/core/select.ts` → ['select.ts', 'core/select.ts', 'src/core/select.ts'] */
function suffixKeys(rel: string): string[] {
  const parts = rel.split('/');
  const keys: string[] = [];
  for (let i = parts.length - 1; i >= 0; i--) keys.push(parts.slice(i).join('/'));
  return keys;
}

function resolveFile(cited: string): string[] {
  const direct = path.join(REPO, cited);
  try {
    if (statSync(direct).isFile()) return [cited];
  } catch {
    /* fall through to the suffix index */
  }
  const hits = fileIndex.get(cited) ?? [];
  if (hits.length <= 1) return hits;
  // Prefer the earliest SEARCH_ROOT, so `select.ts` resolves to src/ over a
  // same-named fixture in test/. Ties beyond that stay ambiguous on purpose.
  const ranked = hits.slice().sort((a, b) => rank(a) - rank(b));
  const best = rank(ranked[0]!);
  const tied = ranked.filter((h) => rank(h) === best);
  return tied.length === 1 ? [ranked[0]!] : tied;
}

function rank(rel: string): number {
  for (let i = 0; i < SEARCH_ROOTS.length; i++) {
    const root = SEARCH_ROOTS[i]!;
    if (root === '.' || rel.startsWith(`${root}/`)) return i;
  }
  return SEARCH_ROOTS.length;
}

/**
 * Markdown escapes `|` inside a table cell. The fragment is compared against
 * SOURCE, so the escape has to come off first — otherwise every citation in a
 * table whose fragment contains a union type is a false negative.
 */
function unescapeFragment(fragment: string): string {
  return fragment.replace(/\\\|/g, '|').replace(/\\`/g, '`');
}

function findFragment(fileRel: string, fragment: string): number[] {
  let text: string;
  try {
    text = readFileSync(path.join(REPO, fileRel), 'utf8');
  } catch {
    return [];
  }
  const needle = unescapeFragment(fragment).trim();
  if (needle.length === 0) return [];
  const lines = text.split(/\r?\n/);
  const hits: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.includes(needle)) hits.push(i + 1);
  }
  return hits;
}

/**
 * **In source, the unit a citation lives on is the comment, not the line.**
 *
 * `docs/` calls a wrapped citation a fault and tells the author to join it onto
 * one line, and in Markdown that costs nothing. In source it is not a defect at
 * all — it is the house style. Every comment in this tree wraps near 80
 * columns, and a citation whose fragment is a whole function signature cannot
 * fit beside its file and its hint. Thirty-eight of them wrap today. Demanding
 * they be joined would mean 200-column comment lines everywhere, and a gate
 * that asks for that gets turned off.
 *
 * So a run of consecutive comment lines is joined into ONE logical line before
 * anything looks at it, with the comment markers taken off and a single space
 * where each newline was — which is what the author wrote and how a reader
 * reads it. `pieces` remembers where each physical line's text landed, so a
 * citation still reports the line it starts on.
 *
 * The UNREAD fault survives this intact, and is sharper for it: after joining,
 * a `·` still standing alone is one the author mangled, not one the wrapper
 * moved.
 */
interface Piece {
  /** Offset in the joined text where this physical line's payload begins. */
  at: number;
  /** 1-based physical line number. */
  line: number;
}

interface Segment {
  text: string;
  pieces: Piece[];
}

/** `//`, `/*`, `/**` or a continuation `*`, plus the one blank that follows. */
const COMMENT_PREFIX = /^[ \t]*(?:\/\/+|\/\*+|\*+(?!\/))[ \t]?/;

/** The star-slash closing a block comment at the end of a comment line. */
const COMMENT_CLOSE = /[ \t]*\*+\/[ \t]*$/;

function commentPayload(line: string): string | null {
  const m = COMMENT_PREFIX.exec(line);
  if (m === null) return null;
  return line.slice(m[0]!.length).replace(COMMENT_CLOSE, '');
}

function segmentsOf(lines: string[], joinComments: boolean): Segment[] {
  const segs: Segment[] = [];
  const plain = (i: number): Segment => ({ text: lines[i]!, pieces: [{ at: 0, line: i + 1 }] });
  if (!joinComments) {
    for (let i = 0; i < lines.length; i++) segs.push(plain(i));
    return segs;
  }
  let i = 0;
  while (i < lines.length) {
    const payload = commentPayload(lines[i]!);
    if (payload === null) {
      segs.push(plain(i));
      i++;
      continue;
    }
    let text = payload;
    const pieces: Piece[] = [{ at: 0, line: i + 1 }];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const next = commentPayload(lines[j]!);
      if (next === null) break;
      pieces.push({ at: text.length + 1, line: j + 1 });
      text = `${text} ${next}`;
    }
    segs.push({ text, pieces });
    i = j;
  }
  return segs;
}

/** The physical line an offset in a joined segment came from. */
function lineAt(seg: Segment, offset: number): number {
  let line = seg.pieces[0]!.line;
  for (const p of seg.pieces) {
    if (p.at > offset) break;
    line = p.line;
  }
  return line;
}

interface DocScan {
  citations: Citation[];
  markers: Marker[];
  faults: Fault[];
}

/**
 * Every `<!-- historical-citation … -->` on one line, sorted into the ones
 * this script will honour and the ones it refuses to.
 *
 * A SECOND marker on a line is a fault rather than a redundancy. One marker
 * already covers the whole line, so a second can only mean its author thought
 * markers attach to individual citations — and someone who believes that will
 * eventually leave one attached to nothing, which is the habit rule 1 exists
 * to break.
 */
function scanMarkers(doc: string, seg: Segment, out: DocScan): void {
  const line = seg.text;
  MARKER_OPEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  let honoured = 0;
  while ((m = MARKER_OPEN.exec(line)) !== null) {
    const docLine = lineAt(seg, m.index);
    const rest = line.slice(m.index);
    const full = MARKER_FULL.exec(rest);
    if (full === null) {
      // `MARKER_OPEN` has already advanced `lastIndex` past its own match, so
      // the loop makes progress without touching it here.
      out.faults.push({
        doc,
        docLine,
        label: 'MARKER',
        raw: rest.slice(0, 72),
        why: 'malformed — the form is `<!-- historical-citation: why -->`, closed on one line, with a reason',
      });
      continue;
    }
    honoured++;
    if (honoured > 1) {
      out.faults.push({
        doc,
        docLine,
        label: 'MARKER',
        raw: full[0]!,
        why: 'a second marker on one line — one marker already covers every citation on the line',
      });
    } else {
      out.markers.push({ doc, docLine, reason: full[1]! });
    }
    MARKER_OPEN.lastIndex = m.index + full[0]!.length;
  }
}

/**
 * Why a `·` that `CITATION` walked past cannot be ordinary punctuation, or
 * `null` if it can.
 *
 * `left` is everything before the separator with trailing blanks removed;
 * `right` is everything after it with leading blanks removed. A wrapped
 * citation is exactly the case where ONE of the three parts is here and the
 * next part is not — because it is on the next line, where `[ \t]*·[ \t]*`
 * cannot follow it.
 */
function diagnoseSeparator(left: string, right: string): string | null {
  if (CITED_FILE_AT_END.test(left) && (right.length === 0 || right.startsWith('`'))) {
    return right.length === 0
      ? 'a cited file, then a separator, then the end of the line — the fragment is on the next line, ' +
          'where the gate cannot follow it. Join the citation onto one line.'
      : 'a cited file, then a separator, then a code span the citation form did not match — the fragment ' +
          'is cut across two lines. Join the citation onto one line.';
  }
  if (HINT_AT_START.test(right)) {
    return 'a `~line` hint that no citation on this line claimed — its file and fragment are on the line ' +
      'above, so the citation was read without its hint and this text is dead. Join it onto one line.';
  }
  if (right.length === 0 && left.endsWith('`')) {
    return 'a separator closing the line straight after a code span — whatever it separates is on the next ' +
      'line, where the gate cannot follow it. Join the citation onto one line.';
  }
  if (left.length === 0 && right.startsWith('`')) {
    return 'a separator opening the line straight before a code span — whatever it separates is on the ' +
      'previous line, where the gate cannot follow it. Join the citation onto one line.';
  }
  return null;
}

/**
 * Every `·` on one line that `CITATION` did not consume, judged.
 *
 * `spans` are the half-open ranges the citation matches occupied. A separator
 * inside one of them was read and is not this function's business; a separator
 * outside all of them was read by nobody, and INV-nothing-is-dropped-silently
 * is the rule that says an unread thing standing in a citation's place has to
 * be said out loud rather than skipped.
 */
function scanSeparators(
  doc: string,
  seg: Segment,
  spans: Array<[number, number]>,
  out: DocScan,
): void {
  const line = seg.text;
  for (let i = line.indexOf(SEPARATOR); i !== -1; i = line.indexOf(SEPARATOR, i + 1)) {
    if (spans.some(([start, end]) => i >= start && i < end)) continue;
    const left = line.slice(0, i).replace(/[ \t]+$/, '');
    const right = line.slice(i + 1).replace(/^[ \t]+/, '');
    const why = diagnoseSeparator(left, right);
    if (why === null) continue;
    out.faults.push({
      doc,
      docLine: lineAt(seg, i),
      label: 'UNREAD',
      raw: `${left.length > 40 ? `…${left.slice(-40)}` : left} ${SEPARATOR} ${right.slice(0, 40)}`.trim(),
      why,
    });
  }
}

function collect(doc: string, joinComments: boolean): DocScan {
  const text = readFileSync(doc, 'utf8');
  const rel = path.relative(REPO, doc).split(path.sep).join('/');
  const out: DocScan = { citations: [], markers: [], faults: [] };
  for (const seg of segmentsOf(text.split(/\r?\n/), joinComments)) {
    const line = seg.text;
    CITATION.lastIndex = 0;
    let m: RegExpExecArray | null;
    const spans: Array<[number, number]> = [];
    while ((m = CITATION.exec(line)) !== null) {
      const start = m.index;
      const end = start + m[0]!.length;
      spans.push([start, end]);
      const docLine = lineAt(seg, start);
      out.citations.push({
        doc: rel,
        docLine,
        file: m[1]!,
        fragment: m[2] ?? m[3]!,
        hint: m[4] ? Number(m[4]) : null,
        raw: m[0]!,
        wrapped: docLine !== lineAt(seg, end - 1),
      });
    }
    scanSeparators(rel, seg, spans, out);
    scanMarkers(rel, seg, out);
  }
  return out;
}

function judge(c: Citation): Verdict {
  const resolved = resolveFile(c.file);
  if (resolved.length === 0) return { kind: 'no-file' };
  if (resolved.length > 1) {
    const hits = findFragment(resolved[0]!, c.fragment);
    return { kind: 'ambiguous', at: hits[0] ?? 0, count: resolved.length };
  }
  const hits = findFragment(resolved[0]!, c.fragment);
  if (hits.length === 0) return { kind: 'no-match' };
  const at = c.hint !== null && hits.includes(c.hint) ? c.hint : hits[0]!;
  if (c.hint === null || c.hint === at) return { kind: 'ok', at };
  return { kind: 'moved', at };
}

function main(): number {
  const argv = process.argv.slice(2);
  const fix = argv.includes('--fix');
  const asJson = argv.includes('--json');
  const strictSource = argv.includes('--strict-source');

  indexFiles();

  const docs: string[] = [];
  for (const root of DOC_ROOTS) walk(path.join(REPO, root), docs, isMarkdown);
  docs.sort();

  const rel = (full: string): string => path.relative(REPO, full).split(path.sep).join('/');

  const found: string[] = [];
  for (const root of SOURCE_ROOTS) walk(path.join(REPO, root), found, isSourceFile);
  const sources = found.filter((f) => !SOURCE_EXEMPT.has(rel(f))).sort();
  const sourceFiles = new Set(sources.map(rel));

  const rows: Array<{ c: Citation; v: Verdict }> = [];
  const markers: Marker[] = [];
  const faults: Fault[] = [];
  for (const file of [...docs, ...sources]) {
    // Only source is joined: in Markdown a wrapped citation is a fault, and
    // joining it would hide the very thing the UNREAD check exists to say.
    const scan = collect(file, sourceFiles.has(rel(file)));
    for (const c of scan.citations) rows.push({ c, v: judge(c) });
    markers.push(...scan.markers);
    faults.push(...scan.faults);
  }
  const fromSource = (doc: string): boolean => sourceFiles.has(doc);

  // Markers are applied AFTER judging, never instead of it, so a marked
  // citation is still resolved against the tree and can still come back green
  // on its own. `no-match` is the only verdict a marker may convert — see
  // rule 3 in the contract at the top of this file.
  const at = (doc: string, line: number): string => `${doc}:${line}`;
  const byLine = new Map<string, Marker>();
  for (const mk of markers) byLine.set(at(mk.doc, mk.docLine), mk);
  const excused = new Map<string, number>();
  for (const r of rows) {
    if (r.v.kind !== 'no-match') continue;
    const mk = byLine.get(at(r.c.doc, r.c.docLine));
    if (mk === undefined) continue;
    r.v = { kind: 'historical', reason: mk.reason };
    const key = at(mk.doc, mk.docLine);
    excused.set(key, (excused.get(key) ?? 0) + 1);
  }

  // Rule 1, and the whole reason the marker is line-scoped: a marker that
  // excused nothing is reported and fails. It cannot be pre-armed against a
  // break that has not happened, and it cannot outlive the break it was
  // written for.
  for (const mk of markers) {
    if ((excused.get(at(mk.doc, mk.docLine)) ?? 0) > 0) continue;
    faults.push({
      doc: mk.doc,
      docLine: mk.docLine,
      label: 'MARKER',
      raw: `<!-- historical-citation: ${mk.reason} -->`,
      why:
        'excuses nothing on this line — every citation here resolves, the line carries none at all, ' +
        'or the failure is a missing FILE rather than a missing fragment',
    });
  }
  faults.sort((a, b) => (a.doc === b.doc ? a.docLine - b.docLine : a.doc < b.doc ? -1 : 1));

  const broken = rows.filter((r) => r.v.kind === 'no-file' || r.v.kind === 'no-match');
  const moved = rows.filter((r) => r.v.kind === 'moved');
  const ambiguous = rows.filter((r) => r.v.kind === 'ambiguous');
  const historical = rows.filter((r) => r.v.kind === 'historical');

  /**
   * **What sets the exit code, and the one thing that does not yet.**
   *
   * `docs/` is unchanged: a broken or ambiguous citation, or any fault, fails.
   * A MOVED hint never has — the fragment resolved, which is the claim.
   *
   * Source is REPORTED on every run and GATED only under `--strict-source`.
   * The day the walk landed it found six broken citations and three faults it
   * was not that task's business to repair — they sit in `src/` and `test/`
   * files other work owns. Failing on them would have handed everyone else a
   * red gate they did not break and could not clear, and the first thing that
   * happens to such a gate is that someone stops running it. So the numbers go
   * on the screen now, where they can be counted and argued with, and the
   * teeth arrive with the repair: fix them, flip this one expression to
   * `true`, delete this paragraph.
   *
   * Widening the walk to the browser tree and `e2e/` on 2026-08-29 raised that
   * debt from 9 to 40, and did not change the argument by one word — the extra
   * 31 are in four other agents' files, the same files those agents were
   * editing that night. It DID change what the flip is worth: a
   * `--strict-source` that covers `src/ui/public/**` is a gate over every file
   * a UI change touches, which is the surface that has drifted hardest and
   * silently. The debt is larger and so is the prize.
   *
   * `--strict-source` is not decoration — it is how the repair proves itself,
   * and it is the whole of the change needed to flip.
   */
  const gated = (doc: string): boolean => strictSource || !fromSource(doc);
  const failing =
    broken.filter((r) => gated(r.c.doc)).length +
    ambiguous.filter((r) => gated(r.c.doc)).length +
    faults.filter((f) => gated(f.doc)).length;
  const ungated =
    broken.filter((r) => !gated(r.c.doc)).length +
    ambiguous.filter((r) => !gated(r.c.doc)).length +
    faults.filter((f) => !gated(f.doc)).length;

  if (asJson) {
    process.stdout.write(
      `${JSON.stringify(
        {
          checked: rows.length,
          documents: docs.length,
          // Files WALKED, not files that turned out to carry a citation — the
          // human summary counts the latter, and one number named for the other
          // is how a walk that quietly stopped covering half the tree hides.
          sourceFilesWalked: sources.length,
          strictSource,
          ungatedFailures: ungated,
          broken: broken.map((r) => ({ ...r.c, source: fromSource(r.c.doc), verdict: r.v })),
          moved: moved.map((r) => ({ ...r.c, source: fromSource(r.c.doc), verdict: r.v })),
          ambiguous: ambiguous.map((r) => ({ ...r.c, source: fromSource(r.c.doc), verdict: r.v })),
          historical: historical.map((r) => ({ ...r.c, source: fromSource(r.c.doc), verdict: r.v })),
          faults: faults.map((f) => ({ ...f, source: fromSource(f.doc) })),
        },
        null,
        2,
      )}\n`,
    );
    return failing > 0 ? 1 : 0;
  }

  // A wrapped citation's `raw` is the JOINED text, which appears nowhere in the
  // file. Rewriting by string replace would either miss it or, worse, hit some
  // other occurrence. `--fix` says so and leaves it to a human.
  const unfixable = moved.filter((r) => r.c.wrapped);
  const fixable = moved.filter((r) => !r.c.wrapped);
  if (fix && unfixable.length > 0) {
    for (const r of unfixable) {
      process.stdout.write(
        `skipped ${r.c.doc}:${r.c.docLine}  ${r.c.file}  ` +
          'the citation wraps across lines — update the ~line hint by hand\n',
      );
    }
  }
  if (fix && fixable.length > 0) {
    const byDoc = new Map<string, Array<{ c: Citation; v: Verdict }>>();
    for (const r of fixable) {
      const list = byDoc.get(r.c.doc);
      if (list) list.push(r);
      else byDoc.set(r.c.doc, [r]);
    }
    for (const [doc, items] of byDoc) {
      const full = path.join(REPO, doc);
      let text = readFileSync(full, 'utf8');
      for (const r of items) {
        if (r.v.kind !== 'moved') continue;
        const replaced = r.c.raw.replace(/~\d+$/, `~${r.v.at}`);
        text = text.replace(r.c.raw, replaced);
      }
      writeFileSync(full, text);
      process.stdout.write(`fixed  ${doc}  (${items.length} hint${items.length === 1 ? '' : 's'})\n`);
    }
  }

  for (const r of broken) {
    const why = r.v.kind === 'no-file' ? 'no such file' : 'fragment not found';
    process.stdout.write(
      `BROKEN ${r.c.doc}:${r.c.docLine}\n` +
        `       ${r.c.file} · ${r.c.fragment}\n` +
        `       ${why}\n`,
    );
  }
  for (const r of ambiguous) {
    if (r.v.kind !== 'ambiguous') continue;
    process.stdout.write(
      `AMBIG  ${r.c.doc}:${r.c.docLine}\n` +
        `       "${r.c.file}" matches ${r.v.count} files — cite more of the path\n`,
    );
  }
  for (const f of faults) {
    process.stdout.write(
      `${f.label} ${f.doc}:${f.docLine}\n` + `       ${f.raw}\n` + `       ${f.why}\n`,
    );
  }
  // Printed on every run, `--fix` included. An excused citation is a citation
  // this script decided not to check, and INV-nothing-is-dropped-silently is
  // the rule that says the decision has to be visible where a person reads it.
  for (const r of historical) {
    if (r.v.kind !== 'historical') continue;
    process.stdout.write(
      `HIST   ${r.c.doc}:${r.c.docLine}  ${r.c.file}  quoted as it was — ${r.v.reason}\n`,
    );
  }
  if (!fix) {
    for (const r of moved) {
      if (r.v.kind !== 'moved') continue;
      process.stdout.write(
        `MOVED  ${r.c.doc}:${r.c.docLine}  ${r.c.file}  ~${r.c.hint} → ~${r.v.at}\n`,
      );
    }
  }

  // Two trees, two lines. One combined total would let a source regression hide
  // inside a four-figure documentation count, which is the arithmetic version
  // of the silence this whole script exists to end.
  const line = (label: string, subset: Array<{ c: Citation; v: Verdict }>): string => {
    const b = subset.filter((r) => r.v.kind === 'no-file' || r.v.kind === 'no-match').length;
    const mv = subset.filter((r) => r.v.kind === 'moved').length;
    const am = subset.filter((r) => r.v.kind === 'ambiguous').length;
    const hi = subset.filter((r) => r.v.kind === 'historical').length;
    return (
      `${subset.length} citation(s) in ${label}: ` +
      `${subset.length - b - mv - am - hi} ok, ${mv} moved, ${am} ambiguous, ` +
      `${hi} historical, ${b} broken\n`
    );
  };
  const docRows = rows.filter((r) => !fromSource(r.c.doc));
  const srcRows = rows.filter((r) => fromSource(r.c.doc));
  const srcFilesSeen = new Set(srcRows.map((r) => r.c.doc)).size;
  process.stdout.write(
    `\n${line(`${docs.length} document(s)`, docRows)}` +
      `${line(`${srcFilesSeen} source file(s)`, srcRows)}` +
      `${markers.length} marker(s), ${faults.length} fault(s)\n`,
  );
  if (broken.length === 0 && ambiguous.length === 0 && moved.length === 0 && faults.length === 0) {
    process.stdout.write(
      historical.length === 0
        ? 'every citation resolves.\n'
        : `every citation resolves, or says in writing that it quotes the past (${historical.length}).\n`,
    );
  }
  // The one thing this script must never do is let a reader mistake a printed
  // failure for a checked one. If source failures were reported and the run
  // still exits 0, it says so in the same breath, with the flag that changes it.
  if (ungated > 0) {
    process.stdout.write(
      `\n${ungated} source failure(s) above are REPORTED, not gated — they do not set the ` +
        `exit code${failing > 0 ? ', which is 1 for the documentation failures above' : ' and this run exits 0'}.\n` +
        'Run with --strict-source to gate them; that flag is the whole of the flip.\n',
    );
  }
  // A moved hint is not a failure — the fragment resolved, which is the claim.
  // `--fix` refreshes the hint; CI does not need to. A marker fault IS a
  // failure: it is the only thing standing between this exception and a
  // blanket suppressor.
  return failing > 0 ? 1 : 0;
}

process.exit(main());
