/**
 * Refuse a swallow: a failure this codebase catches and then says NOTHING
 * about, and a write result a producer returns and the call site drops.
 *
 *   npm run check:swallows
 *
 * ── WHY IT EXISTS, AND WHY IT IS LATE ──────────────────────────────────────
 *
 * `reports/2026-09-12-silent-failures-reviewed.md` proposed a gate twice — once
 * for its pattern P1 (the swallowed `catch`) and once for P2 (the error channel
 * built, documented, and dropped at the call site). The consolidation that
 * followed carried every INSTANCE forward and the gate nowhere, and both
 * proposals were recovered as items a month later:
 * `TASK-the-gate-for-the-swallow-class-was-proposed-twice-and-built` and
 * `TASK-d70-closed-all-five-instances-and-never-built-the-gate-the`. Their
 * shared argument is the reason this file is not optional: **when the last
 * instance closes, the subject reads finished, and the only thing that made the
 * class findable — a whole-codebase review — will not run again.**
 *
 * ── WHAT IT DETECTS, PRECISELY ─────────────────────────────────────────────
 *
 * The subject is SILENCE, not `catch`. That distinction is the whole design.
 * This tree holds 625 `catch` sites and 195 of them do nothing but carry a
 * written argument; `core/line-walk.ts` records a state and rethrows,
 * `core/jsonl-log.ts` memoises one, and every one of those is a swallow this
 * project decided to keep. A gate that reddened on `catch` would be switched
 * off within the day — which is, almost exactly, how the first two proposals
 * for this gate died. So three classes, each one a place where NOTHING IS SAID
 * ANYWHERE:
 *
 *   1. `empty-catch`   — a `catch` block holding no statement AND no comment.
 *      Unconditional: there is no argument to find, because the two characters
 *      it would take to write one were not typed. 195 sites in this tree
 *      already pay that cost.
 *   2. `mute-handler`  — a rejection handler that does nothing, in every
 *      spelling this gate can resolve: `.catch(() => {})`, `=> null`,
 *      `=> undefined`, `=> void 0`, `.catch(function () {})`, the second
 *      argument of `.then(useIt, …)`, and `.catch(noop)` where THIS FILE
 *      declares `noop` as an empty function — WITH no comment attached to it,
 *      to the statement it belongs to, or to the function that contains it.
 *      `ui/public/app.js`'s heartbeat and `ui/public/doc.js`'s roster are both
 *      mute handlers with the argument in the docblock above, and both are
 *      correct; `attachedArgument` below is how a reader finds that argument
 *      and therefore how this gate does.
 *   3. `unread-result` — a call to one of the six producers in `PRODUCERS`
 *      whose returned `{ written, error }` / `boolean` goes nowhere. It fails
 *      CLOSED and takes no comment as an argument, because the item says so in
 *      as many words: *"It must fail CLOSED on an unrecognised call site, per
 *      `rulings/85`."* Four spellings of the same discard, because reading it
 *      as "called as a statement" alone let the other three through:
 *        · a bare statement — `recordAudit(root, input);`, `void bumpCounter(…)`
 *        · bound to `_`, or to a name never read again in the enclosing block
 *        · computed in expression position by a statement that keeps nothing —
 *          `ok && f()`, `ok ? f() : 0`, `case 1: f();`
 *      A NAME IS NOT ENOUGH: the call counts only when the file imports it from
 *      the producer's module or IS that module, so an unrelated local
 *      `writeState` is not reported as somebody else's defect.
 *
 * ── WHAT IT CANNOT SEE, WHICH IS MORE THAN WHAT IT CAN ─────────────────────
 *
 * `RULE-say-what-your-check-cannot-see-when-you-report-it-green`. Every line
 * below is printed on every run, green or red, so a reader never mistakes this
 * gate's silence for the codebase's honesty:
 *
 *   - **The argued case that licenses the unargued class** — report 3's P1, and
 *     the largest part of the subject. A `catch` whose comment justifies
 *     `ENOENT` and whose code swallows `EACCES`, `EPERM`, `ELOOP` and `EIO` is
 *     INVISIBLE here: the comment is present, so this gate reads an argument.
 *     Measured in that report: of 203 `readFileSync` calls, 15 discriminate on
 *     `.code` and 145 do not. Closing that needs a judgement per site, which is
 *     what the twelve D66 items were.
 *   - **A docstring the code contradicts.** `ledger.ts`'s *"and says so"* above
 *     an `error: null`, `corpus-drift.ts`'s *"`false` is a MEASUREMENT"* — the
 *     defect is the disagreement between two texts, and no scanner reads intent.
 *   - **A default returned from a path that could not look** — `[]`, `0`,
 *     `false`, `{ ...FRESH }`. `STD-a-measured-zero-is-drawn-and-named` governs
 *     it; 137 `catch { return <literal>; }` sites exist here and most are
 *     correct. Gating that shape would be an accusation, not a measurement.
 *   - **A seventh producer.** `PRODUCERS` names the six from report 3's own
 *     table so the gate does not re-derive them. A function that starts
 *     returning a write flag tomorrow is not in it, and nothing here notices.
 *   - **`recordDecline`'s losses before this release.** It returned `void` when
 *     the review was written — the channel did not exist — so a caller could not
 *     have read it. It returns `DeclineWriteResult` now and is gated like the
 *     rest.
 *   - **A lossy wrapper.** `lesson/staging.ts`'s `listStaging` is
 *     `return readStagingDir(root).staging;` — textually a READ, and it throws
 *     the `skipped` reasons away. Chaining is bound; losing what you bound is
 *     the next gate, not this one.
 *   - **THE ARGUMENT IS COUNTED, NOT READ.** `attachedArgument` accepts ANY
 *     comment in the swallow's statement or in the block above it or above its
 *     function. It is wide on purpose — this codebase writes the argument above
 *     the statement, and a narrower walk would redden `app.js`'s heartbeat,
 *     which is correct code — and wide is a cost: an unrelated remark two lines
 *     up licenses a real mute handler. This gate can tell nothing-was-said from
 *     something-was-said. It cannot tell either from something-RELEVANT-was-said.
 *   - **A bound result that is still unread**, past the two cases above: pushed
 *     into an array, passed as an argument, read only on a branch that cannot
 *     run. A scope-accurate answer needs a real binder; this has a lexer.
 *   - **An aliased or re-exported producer**, and a `noop` imported rather than
 *     declared here. Name resolution stops at a direct named import.
 *   - **ASI.** A call at the head of a line after a line that ended without a
 *     semicolon is a statement, and this gate reads the character before it —
 *     which is not a `;`.
 *
 * Every one of those is in `BLIND_SPOTS` and printed on every run. The list a
 * reader trusts has to be the true one.
 *
 * ── THE POPULATION, AND WHY NOTHING IS EXCLUDED BY HAND ────────────────────
 *
 * `TASK-a-scanner-enumerates-what-it-will-skip-not-what-it-will-scan`
 * (rulings/85): a scanner enumerates what it will SKIP, not what it will scan,
 * and an allow-list of directories somebody keeps by hand is the defect.
 *
 * So: every file git tracks is looked at, through `scripts/tracked-walk.ts` —
 * the one walk every scanner in this directory uses, rather than a fifth
 * hand-copied `git ls-files`. Files that are not JavaScript or TypeScript hold
 * no `catch` for this gate to read and are counted out under one printed
 * reason. Exactly one tree is SKIPPED outright — `src/ui/public/lib/vendor/`,
 * taken from `check-vendor.ts`'s own `VENDOR_DIR` rather than spelled again
 * here — because `check:vendor` refuses any edit to a vendored file, so a
 * finding there could be closed only by breaking another gate. It holds two
 * empty catches and one mute handler today, and that count is printed.
 *
 * What GATES is what this package SHIPS, read at run time from
 * `package.json:files` — includes and `!` exclusions both — because a swallow
 * in shipped code is a failure hidden from a user, and because reading the ship
 * list means a directory added to it tomorrow is gated the day it is added
 * rather than the day someone remembers this file. Everything else — `test/`,
 * `e2e/`, `scripts/`, `harness/` — is SCANNED AND PRINTED and does not fail the
 * run: a fixture's reader is the assertion two lines below it, which fails on
 * its own. That is a stated limit, not a claim those trees are clean; the
 * findings are on screen, under their own heading, on every run. (It is one
 * step's output rather than a step of its own for the reason argued above
 * `check:cited-items` in `ci.yml`: a never-gating check on its own line prints
 * into a green log and manufactures the appearance of coverage.)
 *
 * `test/scripts/swallow-gate.test.ts` plants every class in a throwaway
 * repository and asserts the exit code and the printed line, the way every
 * other checker here is proved.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainEntry } from '../src/core/paths.ts';
import { VENDOR_DIR } from './check-vendor.ts';
import { type Walk, walkSummary, walkTracked } from './tracked-walk.ts';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The extensions that can hold a `catch`. Everything else is counted and named. */
export const SOURCE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.ts', '.mts', '.cts', '.tsx', '.js', '.mjs', '.cjs', '.jsx',
]);

export const CLASS_EMPTY_CATCH = 'empty-catch';
export const CLASS_MUTE_HANDLER = 'mute-handler';
export const CLASS_UNREAD_RESULT = 'unread-result';

/** The one tree removed from the scan, with the reason printed on every run. */
export const SKIP_VENDOR =
  `vendored third-party code under ${VENDOR_DIR}/ — \`check:vendor\` refuses any edit to it, `
  + 'so a finding here could be closed only by breaking another gate';

/** Why a tracked file is not read: it cannot hold a `catch` in the first place. */
export const SKIP_NOT_SOURCE =
  'not JavaScript or TypeScript — there is no `catch` and no rejection handler in it to read';

export interface Producer {
  /**
   * The module that declares it, as a path suffix. A call counts only when the
   * file IMPORTS the name from a path ending here, or IS that module — because
   * `\bwriteState\s*\(` on its own flags any unrelated local helper of the same
   * name, and a gate that reports someone else's function is a gate people
   * learn to disbelieve.
   */
  module: string;
  /** What the caller is holding when it drops the answer. */
  lost: string;
}

/**
 * The six producers of report 3's P2 table. Named here so the gate does not
 * have to re-derive them, and so a reader of a red line learns what was lost
 * rather than only that something was.
 */
export const PRODUCERS: ReadonlyMap<string, Producer> = new Map([
  ['recordAudit', {
    module: 'core/audit.ts',
    lost: 'returns `AuditWriteResult` and never throws — `{ written, error }` is the only way to '
      + 'learn the audit row is not on disk',
  }],
  ['recordDelivery', {
    module: 'rules/delivered.ts',
    lost: 'returns whether the delivery row was appended; its own docblock says "the caller '
      + 'discloses, this module does not"',
  }],
  ['bumpCounter', {
    module: 'core/review-counter.ts',
    lost: 'returns `CounterWrite` carrying `written`, "which is why `written` exists"',
  }],
  ['writeState', {
    module: 'core/ui-server-upkeep.ts',
    lost: 'returns `false` so the upkeep rate can record a state it could not write',
  }],
  ['recordDecline', {
    module: 'review/declined.ts',
    lost: 'returns `DeclineWriteResult`; `declineDraft` deletes a draft on its silence',
  }],
  ['readStagingDir', {
    module: 'lesson/staging.ts',
    lost: 'returns `skipped` with a reason per file it could not read',
  }],
]);

export interface Finding {
  file: string;
  line: number;
  cls: string;
  /** The producer whose answer was dropped; `''` for the two catch classes. */
  producer: string;
  /** The offending source line, trimmed. */
  code: string;
  /** What was lost, in a sentence. */
  why: string;
}

export interface ShipRoots { include: string[]; exclude: string[] }

// ── the lexer ──────────────────────────────────────────────────────────────

const BACKSLASH = String.fromCharCode(92);

export interface Lexed {
  /**
   * The source with the CONTENT of every comment and string blanked to spaces,
   * byte for byte and newline for newline, so an offset into it is an offset
   * into the original. Brace and paren matching happens here, where a `}` in a
   * string or a `/* ` in a URL cannot lie about the structure.
   */
  masked: string;
  /** Where the comments were, so "is there an argument here" is answerable. */
  comments: { start: number; end: number }[];
}

/** Blank comments and string bodies, keeping every offset. */
export function lex(src: string): Lexed {
  const out = src.split('');
  const comments: { start: number; end: number }[] = [];
  const n = src.length;
  let i = 0;
  let prev = '';
  const blank = (from: number, to: number): void => {
    for (let k = from; k < to && k < n; k += 1) if (out[k] !== '\n') out[k] = ' ';
  };
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      let j = i + 2;
      while (j < n && src[j] !== '\n') j += 1;
      comments.push({ start: i, end: j });
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '/' && d === '*') {
      let j = i + 2;
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j += 1;
      const end = Math.min(j + 2, n);
      comments.push({ start: i, end });
      blank(i, end);
      i = end;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n) {
        if (src[j] === BACKSLASH) { j += 2; continue; }
        if (src[j] === c || src[j] === '\n') break;
        j += 1;
      }
      blank(i + 1, j);
      i = j + 1;
      prev = c;
      continue;
    }
    if (c === '`') {
      // Only the literal parts are blanked. A `${…}` interpolation is real code
      // and may hold anything, including a call this gate is looking for.
      let j = i + 1;
      let depth = 0;
      while (j < n) {
        if (src[j] === BACKSLASH) { j += 2; continue; }
        if (depth === 0 && src[j] === '$' && src[j + 1] === '{') { depth += 1; j += 2; continue; }
        if (depth > 0) {
          if (src[j] === '{') depth += 1;
          else if (src[j] === '}') depth -= 1;
          j += 1;
          continue;
        }
        if (src[j] === '`') break;
        if (src[j] !== '\n') out[j] = ' ';
        j += 1;
      }
      i = j + 1;
      prev = '`';
      continue;
    }
    if (c === '/' && (prev === '' || '(,=:[!&|?{};+-*%~^<>'.includes(prev))) {
      let j = i + 1;
      let inClass = false;
      while (j < n) {
        if (src[j] === BACKSLASH) { j += 2; continue; }
        if (src[j] === '[') inClass = true;
        else if (src[j] === ']') inClass = false;
        else if (src[j] === '/' && !inClass) break;
        else if (src[j] === '\n') break;
        j += 1;
      }
      blank(i + 1, j);
      i = j + 1;
      prev = '/';
      continue;
    }
    if (!/\s/.test(c)) prev = c;
    i += 1;
  }
  return { masked: out.join(''), comments };
}

function lineAt(src: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < src.length; i += 1) if (src[i] === '\n') line += 1;
  return line;
}

function lineText(src: string, offset: number): string {
  const from = src.lastIndexOf('\n', offset) + 1;
  const to = src.indexOf('\n', offset);
  return src.slice(from, to === -1 ? src.length : to).trim();
}

function matchClose(masked: string, open: number, o: string, c: string): number {
  let depth = 0;
  for (let k = open; k < masked.length; k += 1) {
    if (masked[k] === o) depth += 1;
    else if (masked[k] === c) { depth -= 1; if (depth === 0) return k; }
  }
  return -1;
}

/**
 * Where the statement containing `at` begins: walk left with brackets balanced,
 * stopping at the first `;` or the opening bracket of the block or call that
 * encloses it. This is how a reader finds the statement, and therefore where
 * its attached comment would be.
 */
function statementStart(masked: string, at: number): number {
  let depth = 0;
  for (let i = at - 1; i >= 0; i -= 1) {
    const c = masked[i];
    if (c === ')' || c === ']' || c === '}') depth += 1;
    else if (c === '(' || c === '[' || c === '{') {
      if (depth === 0) return i + 1;
      depth -= 1;
    } else if (c === ';' && depth === 0) return i + 1;
  }
  return 0;
}

function inComment(comments: readonly { start: number; end: number }[], at: number): boolean {
  return comments.some((c) => at >= c.start && at < c.end);
}

/**
 * Whether an argument is written where a reader would look for it: inside the
 * swallow itself, trailing on its line, in the comment block above the
 * statement it belongs to, or above the function that contains that statement.
 *
 * Two hops is what the real shapes need and no more: `app.js`'s heartbeat puts
 * it above the function, `doc.js`'s roster above the statement. Anything
 * further away is not an argument a reader would find either.
 */
function attachedArgument(lexed: Lexed, from: number, to: number): boolean {
  const { masked, comments } = lexed;
  if (comments.some((c) => c.start >= from && c.start < to)) return true;
  // Trailing, on the same line, after the swallow.
  const eol = masked.indexOf('\n', to);
  if (comments.some((c) => c.start >= to && c.start < (eol === -1 ? masked.length : eol))) {
    return true;
  }
  let start = statementStart(masked, from);
  for (let hop = 0; hop < 2; hop += 1) {
    if (comments.some((c) => c.start >= start && c.start < from)) return true;
    let i = start - 1;
    while (i >= 0) {
      if (inComment(comments, i)) return true;
      if (!/\s/.test(masked[i])) break;
      i -= 1;
    }
    if (i < 0) return false;
    // The statement opens a block — hop over its header to the function or the
    // `if` above it, which is where this codebase writes the argument.
    if (masked[i] === '{' || masked[i] === ')') {
      start = statementStart(masked, i);
      continue;
    }
    return false;
  }
  return false;
}

// ── class 1: a catch that holds no statement and no comment ────────────────

export function emptyCatches(file: string, src: string, pre?: Lexed): Finding[] {
  const lexed = pre ?? lex(src);
  const { masked } = lexed;
  const findings: Finding[] = [];
  const re = /\bcatch\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    let j = m.index + 5;
    while (j < masked.length && /\s/.test(masked[j])) j += 1;
    if (masked[j] === '(') {
      const close = matchClose(masked, j, '(', ')');
      if (close === -1) continue;
      j = close + 1;
      while (j < masked.length && /\s/.test(masked[j])) j += 1;
    }
    if (masked[j] !== '{') continue;
    const end = matchClose(masked, j, '{', '}');
    if (end === -1) continue;
    if (src.slice(j + 1, end).trim() !== '') continue;
    findings.push({
      file,
      line: lineAt(src, m.index),
      cls: CLASS_EMPTY_CATCH,
      producer: '',
      code: lineText(src, m.index),
      why: 'this catch holds no statement and no comment: the failure is caught and nothing, '
        + 'anywhere, records that it happened. Write what it costs in the body — 195 catch '
        + 'blocks in this tree do exactly that and none of them trips this gate.',
    });
  }
  return findings;
}

// ── class 2: a rejection handler with an empty body and no argument ────────

const MUTE_BODY = /^(undefined|null|void\s+0)$/;

/** The top-level commas of an argument list, so `.then(a, b)` can be split. */
function topLevelCommas(masked: string, from: number, to: number): number[] {
  const at: number[] = [];
  let depth = 0;
  for (let i = from; i < to; i += 1) {
    const c = masked[i];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (c === ',' && depth === 0) at.push(i);
  }
  return at;
}

/**
 * Is this identifier declared IN THIS FILE as a function that does nothing?
 *
 * `p.catch(noop)` is the same silence as `p.catch(() => {})` and reads as
 * deliberate, which is worse. Resolution stops at the file boundary: a `noop`
 * imported from elsewhere is a stated blind spot rather than a guess.
 */
function localNoop(masked: string, src: string, name: string): boolean {
  const decl = new RegExp(
    `\\b(?:const|let|var)\\s+${name}\\s*(?::[^=]*)?=\\s*(?:async\\s*)?`
    + `(?:\\([^()]*\\)|[A-Za-z_$][\\w$]*)\\s*=>\\s*\\{|`
    + `\\b(?:const|let|var)\\s+${name}\\s*(?::[^=]*)?=\\s*(?:async\\s+)?function\\b[^(]*\\([^()]*\\)\\s*\\{|`
    + `\\bfunction\\s+${name}\\s*\\([^()]*\\)\\s*\\{`,
  );
  const m = decl.exec(masked);
  if (m === null) return false;
  const open = masked.indexOf('{', m.index + m[0].length - 1);
  if (open === -1) return false;
  const close = matchClose(masked, open, '{', '}');
  return close !== -1 && src.slice(open + 1, close).trim() === '';
}

/**
 * A handler argument that does nothing and says nothing, in every spelling this
 * gate can resolve: an arrow with an empty block or a bare `undefined`/`null`/
 * `void 0`, a `function () {}` expression, and an identifier this file declares
 * as an empty function.
 *
 * Returns the offset just past the handler, or `-1` when it is not mute.
 */
function muteArgument(masked: string, src: string, from: number, to: number): number {
  const text = masked.slice(from, to);
  const lead = text.length - text.trimStart().length;
  const arrow = /^(\s*(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*=>\s*)/.exec(text);
  if (arrow !== null) {
    const bodyStart = from + arrow[1].length;
    const body = masked.slice(bodyStart, to).trim();
    if (body.startsWith('{')) {
      const open = masked.indexOf('{', bodyStart);
      const close = matchClose(masked, open, '{', '}');
      if (close === -1) return -1;
      return src.slice(open + 1, close).trim() === '' ? close + 1 : -1;
    }
    return MUTE_BODY.test(body) ? to : -1;
  }
  // `function () {}` and `function named() {}` — the same silence, older spelling.
  if (/^\s*(?:async\s+)?function\b/.test(text)) {
    const open = masked.indexOf('{', from);
    if (open === -1 || open > to) return -1;
    const close = matchClose(masked, open, '{', '}');
    if (close === -1 || close > to) return -1;
    return src.slice(open + 1, close).trim() === '' ? close + 1 : -1;
  }
  // A bare identifier — mute only when this file declares it as an empty function.
  const bare = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(text);
  if (bare !== null && localNoop(masked, src, bare[1])) return from + lead + bare[1].length;
  return -1;
}

export function mutedHandlers(file: string, src: string, pre?: Lexed): Finding[] {
  const lexed = pre ?? lex(src);
  const { masked } = lexed;
  const findings: Finding[] = [];
  // `.then(onFulfilled, onRejected)` carries a rejection handler too, and it is
  // the spelling that reads as "handled" hardest — the first argument does real
  // work two lines above the one that does none.
  const re = /\.(catch|then)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    const open = masked.indexOf('(', m.index);
    const close = matchClose(masked, open, '(', ')');
    if (close === -1) continue;
    let from = open + 1;
    if (m[1] === 'then') {
      const commas = topLevelCommas(masked, open + 1, close);
      if (commas.length === 0) continue;
      from = commas[0] + 1;
    }
    const end = muteArgument(masked, src, from, close);
    if (end === -1) continue;
    if (attachedArgument(lexed, m.index, end)) continue;
    findings.push({
      file,
      line: lineAt(src, m.index),
      cls: CLASS_MUTE_HANDLER,
      producer: '',
      code: lineText(src, m.index),
      why: 'a rejection handler that does nothing, with no comment on it, on its statement or on '
        + 'the function around it. The promise failed and no surface carries a word about it.',
    });
  }
  return findings;
}

// ── class 3: a producer's write result dropped at the call site ────────────

const STATEMENT_HEAD = /(^|[;{}])\s*$/;
const HEADER_KEYWORD = /\b(if|while|for|switch)\s*$/;
/** `&&`, `||`, `??`, either arm of a `?:`, and `case X:` — all in expression position. */
const EXPRESSION_SLOT = /(&&|\|\||\?\?|\?|:)\s*$/;
/** A statement head that keeps the value by construction. */
const KEEPS_VALUE = /^\s*(return|throw|yield|export|import)\b/;

/** One classified call of a producer: where it is, and whether the answer survives. */
export interface CallSite {
  file: string;
  line: number;
  producer: string;
  code: string;
  /** Why the answer is gone, or `''` when this gate can see it being kept. */
  dropped: string;
}

/**
 * Whether `name` is the producer rather than an unrelated local of the same
 * name: this file imports it from the producer's module, or IS that module.
 *
 * An alias (`import { recordAudit as rec }`) and a re-export are not resolved —
 * both are named in the blind-spot list rather than guessed at.
 */
function resolvesToProducer(src: string, file: string, name: string, module: string): boolean {
  if (file.endsWith(module)) return true;
  // Read from the RAW source, not the masked copy: masking blanks the inside of
  // every string, and the module specifier this has to read IS a string.
  const imports = src.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]*)['"]/g);
  for (const im of imports) {
    if (im[1] !== undefined) continue;
    if (!im[3].endsWith(module)) continue;
    if (new RegExp(`(^|[,{\\s])${name}\\s*(,|$|\\s)`).test(im[2])) return true;
  }
  return false;
}

/** The innermost `{ … }` around `at`, as a half-open range. */
function enclosingBlock(masked: string, at: number): { start: number; end: number } {
  let depth = 0;
  for (let i = at - 1; i >= 0; i -= 1) {
    if (masked[i] === '}') depth += 1;
    else if (masked[i] === '{') {
      if (depth === 0) {
        const end = matchClose(masked, i, '{', '}');
        return { start: i + 1, end: end === -1 ? masked.length : end };
      }
      depth -= 1;
    }
  }
  return { start: 0, end: masked.length };
}

/** Does `name` appear again between `from` and `to`? */
function readAgain(masked: string, name: string, from: number, to: number): boolean {
  return new RegExp(`\\b${name}\\b`).test(masked.slice(from, Math.max(from, to)));
}

/** A `:` at the top level of a parameter list — the mark of a typed signature. */
function hasTopLevelColon(params: string): boolean {
  let depth = 0;
  for (const c of params) {
    if (c === '(' || c === '[' || c === '{' || c === '<') depth += 1;
    else if (c === ')' || c === ']' || c === '}' || c === '>') depth -= 1;
    else if (c === ':' && depth === 0) return true;
  }
  return false;
}

/** Are all brackets opened in `text` also closed in it? */
function selfContained(text: string): boolean {
  let depth = 0;
  for (const c of text) {
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') { depth -= 1; if (depth < 0) return false; }
  }
  return depth === 0;
}

/**
 * Every call of a producer in this file, each one classified as kept or
 * dropped. `unreadResults` is this filtered to the dropped ones; the whole list
 * exists so a test can prove the tier still SEES the producers rather than
 * passing by not looking.
 */
export function producerCallSites(file: string, src: string, pre?: Lexed): CallSite[] {
  const { masked } = pre ?? lex(src);
  const sites: CallSite[] = [];
  for (const [name, producer] of PRODUCERS) {
    if (!resolvesToProducer(src, file, name, producer.module)) continue;
    const re = new RegExp(`\\b${name}\\s*\\(`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(masked)) !== null) {
      const open = masked.indexOf('(', m.index);
      const close = matchClose(masked, open, '(', ')');
      if (close === -1) continue;
      // A declaration, not a call: a body follows, or a return type does AND the
      // parameter list is a SIGNATURE — empty, or carrying a top-level `:`.
      //
      // That second half is not fussiness. `)` followed by `:` was read as a
      // return-type annotation on its own, and it silently ate
      // `ok ? recordAudit(root, input) : 0` — the ternary's colon looks exactly
      // like a signature's, and that shape is one of the discards this tier was
      // widened to catch.
      let after = close + 1;
      while (after < masked.length && /\s/.test(masked[after])) after += 1;
      const params = masked.slice(open + 1, close);
      if (masked[after] === '{') continue;
      if (masked[after] === ':' && (params.trim() === '' || hasTopLevelColon(params))) continue;
      const raw = masked.slice(0, m.index);
      if (/\b(function|class)\s*\*?\s*$/.test(raw)) continue;
      // A method of the same name on some object. `\.` covers `?.` too, and must
      // NOT be widened to `[.?]`: that ate `ok ? f() : 0` and `x ?? f()`, which
      // are two of the expression slots this tier exists to catch.
      if (/\.\s*$/.test(raw)) continue;
      // `await` and `void` change nothing about whether the answer is kept —
      // `void` least of all: it is the explicit spelling of throwing it away.
      const before = raw.replace(/\b(await|void)\s*$/, '');
      const stmt = masked.slice(statementStart(masked, m.index), m.index);
      const topLevel = selfContained(stmt);

      let dropped = '';
      if (
        STATEMENT_HEAD.test(before)
        || /\b(else|do|try)\s*$/.test(before)
        || (/\)\s*$/.test(before) && headerCall(masked, before.trimEnd().length - 1))
      ) {
        dropped = 'called as a statement, so the answer goes nowhere';
      } else if (topLevel && !KEEPS_VALUE.test(stmt) && EXPRESSION_SLOT.test(stmt.trimEnd())) {
        // `ok && f()`, `ok ? f() : 0`, `case 1: f()` — an expression statement
        // whose value is computed and then dropped exactly as a statement's is.
        dropped = 'in expression position inside a statement that keeps nothing — `&&`, `?:` or '
          + '`case` discards the answer as surely as a bare call does';
      } else {
        const bind = /(?:^|[;{}])\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=\s*(?:await\s+)?$/
          .exec(stmt);
        if (bind !== null) {
          const bound = bind[1];
          const block = enclosingBlock(masked, m.index);
          if (bound.startsWith('_')) {
            dropped = `bound to \`${bound}\`, which is this codebase's spelling of "I am not `
              + 'reading this"';
          } else if (!readAgain(masked, bound, close + 1, block.end)) {
            dropped = `bound to \`${bound}\` and \`${bound}\` is never read again in the block — `
              + 'a binding is not a reader';
          }
        }
      }
      sites.push({
        file, line: lineAt(src, m.index), producer: name, code: lineText(src, m.index), dropped,
      });
    }
  }
  return sites.toSorted((a, b) => a.line - b.line);
}

export function unreadResults(file: string, src: string, pre?: Lexed): Finding[] {
  return producerCallSites(file, src, pre)
    .filter((s) => s.dropped !== '')
    .map((s) => ({
      file: s.file,
      line: s.line,
      cls: CLASS_UNREAD_RESULT,
      producer: s.producer,
      code: s.code,
      why: `\`${s.producer}\` ${PRODUCERS.get(s.producer)!.lost}. Here it is ${s.dropped}. Bind `
        + 'it and disclose — the obligation is handed across this boundary in prose, and this is '
        + 'the only thing that enforces the handoff.',
    }));
}

/** Is the `)` at `at` the close of an `if`/`while`/`for` header? */
function headerCall(masked: string, at: number): boolean {
  let depth = 0;
  for (let i = at; i >= 0; i -= 1) {
    if (masked[i] === ')') depth += 1;
    else if (masked[i] === '(') {
      depth -= 1;
      if (depth === 0) return HEADER_KEYWORD.test(masked.slice(Math.max(0, i - 12), i));
    }
  }
  return false;
}

// ── the population ─────────────────────────────────────────────────────────

/**
 * The two reasons this gate declines to read a tracked file, or `null` to read
 * it — the signature `scripts/tracked-walk.ts` takes, so this gate is not the
 * fifth hand-copied `git ls-files` that module exists to remove.
 */
export function skipReason(file: string): string | null {
  if (under(file, `${VENDOR_DIR}/`)) return SKIP_VENDOR;
  if (!SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase())) return SKIP_NOT_SOURCE;
  return null;
}

/**
 * Every tracked file that can hold a `catch`, and every one declined with why.
 *
 * Fails CLOSED through `walkTracked`: `git ls-files` answering nothing THROWS
 * rather than reporting a clean scan of a tree it never read
 * (`INV-nothing-is-dropped-silently`).
 */
export function sources(root: string): Walk {
  return walkTracked(root, skipReason);
}

/** What `package.json` says this package ships, includes and `!` exclusions both. */
export function shippedRoots(root: string): ShipRoots {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    files?: unknown;
  };
  const files = Array.isArray(pkg.files) ? pkg.files.filter((f) => typeof f === 'string') : [];
  if (files.length === 0) {
    throw new Error(
      `${root}/package.json declares no \`files\`, so this gate cannot tell shipped code from `
      + 'anything else. It refuses rather than gating nothing.',
    );
  }
  return {
    include: files.filter((f) => !f.startsWith('!')),
    exclude: files.filter((f) => f.startsWith('!')).map((f) => f.slice(1)),
  };
}

function under(file: string, root: string): boolean {
  return root.endsWith('/') ? file.startsWith(root) : file === root || file.startsWith(`${root}/`);
}

/**
 * Split what was scanned into what fails the run and what is reported only.
 *
 * What is not read at all is `skipReason`'s business and `walkTracked`'s
 * result; this is the second cut, and it is about CONSEQUENCE rather than
 * coverage — everything here was read.
 */
export function partition(
  files: readonly string[], roots: ShipRoots,
): { gated: string[]; reported: string[] } {
  const gated: string[] = [];
  const reported: string[] = [];
  for (const file of files) {
    const ships = roots.include.some((r) => under(file, r))
      && !roots.exclude.some((r) => under(file, r));
    (ships ? gated : reported).push(file);
  }
  return { gated, reported };
}

export function findingsIn(root: string, files: readonly string[]): Finding[] {
  const found: Finding[] = [];
  for (const file of files) {
    let src: string;
    try {
      src = readFileSync(path.join(root, file), 'utf8');
    } catch {
      // A tracked path this gate could not read is not a pass. Same rule as
      // every other checker here: the only silent outcome permitted is a file
      // that was actually read and found clean.
      found.push({
        file, line: 0, cls: 'unreadable', producer: '', code: '',
        why: 'this gate could not read the file, so it has no opinion about what is in it',
      });
      continue;
    }
    // Lexed ONCE per file and handed to all three classes. It was three times,
    // which is three passes over every byte of 1,213 files for one answer.
    const lexed = lex(src);
    found.push(
      ...emptyCatches(file, src, lexed),
      ...mutedHandlers(file, src, lexed),
      ...unreadResults(file, src, lexed),
    );
  }
  return found;
}

/** What was scanned, what only reported, and what skipped with why — every run. */
export function summarise(
  walk: Walk, gated: readonly string[], reported: readonly string[],
): string {
  return [
    walkSummary(
      `${walk.scanned.length + walk.skipped.length} tracked file(s), ${walk.scanned.length} of `
      + `them a source this gate can read: ${gated.length} gated (shipped, per `
      + `package.json:files), ${reported.length} scanned and reported only.`,
      walk,
    ),
    '  reported only: test/, e2e/, scripts/, harness/ and anything else outside the ship list — '
    + 'counted above, never gating. A stated limit, not a clean bill.',
  ].join('\n');
}

const BLIND_SPOTS = [
  'a catch whose comment argues ENOENT and whose code swallows every errno — the comment is '
  + 'present, so this gate reads an argument (203 readFileSync calls, 15 discriminate)',
  'a docstring the code contradicts: the defect is between two texts, and no scanner reads intent',
  'a benign default returned from a path that could not look — `[]`, `0`, `false` — 137 sites, '
  + 'most of them correct',
  'a seventh producer: PRODUCERS holds the six report 3 named, and nothing notices a new one',
  '`listStaging`, which binds `readStagingDir(root).staging` and drops the reasons with it',
  'THE ARGUMENT IS NOT READ, ONLY COUNTED. `attachedArgument` accepts ANY comment inside the '
  + "swallow's statement or in the block above it or above its function — so an unrelated remark "
  + 'two lines up licenses a real mute handler. It is wide on purpose (this codebase writes the '
  + 'argument above the statement, not in the handler) and wide is a cost: the gate can tell '
  + 'nothing-was-said from something-was-said, never something-relevant-was-said',
  'a producer result that IS bound and still unread past the cheap cases: pushed into an array, '
  + 'passed as an argument, bound to a name read only on a branch that cannot run. `_`, an '
  + 'unused binding, `&&`/`?:` and `case` are caught; a scope-accurate answer needs a real '
  + 'binder and this gate has a lexer',
  'a producer reached under an alias (`import { recordAudit as rec }`), through a re-export, or '
  + 'off an object — name resolution stops at a direct named import from the producer module',
  'a no-op handler declared in another file: `p.catch(noop)` is caught when this file declares '
  + '`noop` empty, and missed when it is imported',
  'a call at the head of a line after a line with no semicolon — ASI makes it a statement and '
  + 'this gate reads the character before it, which is not a `;`',
];

function print(findings: readonly Finding[], heading: string): void {
  if (findings.length === 0) return;
  console.log(`\n${heading}`);
  for (const f of findings) {
    const who = f.producer === '' ? '' : `  ${f.producer}`;
    console.log(`  ${f.cls.padEnd(14)} ${f.file}:${f.line}${who}`);
    if (f.code !== '') console.log(`      ${f.code}`);
    console.log(`      ${f.why}`);
  }
}

/**
 * The ungated trees, COUNTED by tree and class rather than listed line by line.
 *
 * Deliberate, and the reason is a ruling this repository already made: 7d10c14d
 * refused `check:cited-items` a CI step of its own because "a never-gating check
 * there prints 224 lines into a green log and manufactures the appearance of
 * coverage". Listing 270 fixture swallows under a gate that will never fail on
 * them is the same act. A count per tree per class cannot be mistaken for a
 * verdict, moves when the trees move, and fits in a log a person reads.
 */
export function countUngated(findings: readonly Finding[]): string {
  if (findings.length === 0) {
    return 'nothing outside the ship list either — every tracked source was read and is clean.';
  }
  const byTree = new Map<string, Map<string, { sites: number; files: Set<string> }>>();
  for (const f of findings) {
    const tree = `${f.file.split('/')[0]}/`;
    const classes = byTree.get(tree) ?? new Map();
    byTree.set(tree, classes);
    const row = classes.get(f.cls) ?? { sites: 0, files: new Set<string>() };
    row.sites += 1;
    row.files.add(f.file);
    classes.set(f.cls, row);
  }
  const lines = ['outside the ship list — scanned, counted, and NOT gated:'];
  for (const [tree, classes] of [...byTree].toSorted((a, b) => a[0].localeCompare(b[0]))) {
    const parts = [...classes]
      .toSorted((a, b) => b[1].sites - a[1].sites)
      .map(([cls, row]) => `${row.sites} ${cls} in ${row.files.size} file(s)`);
    lines.push(`  ${tree.padEnd(10)} ${parts.join(', ')}`);
  }
  lines.push(
    "  Not a clean bill and not a gate. A fixture's reader is the assertion two lines below it, "
    + 'which fails on its own; these counts are here so the trees cannot drift unwatched. Run '
    + '`node scripts/check-swallows.ts` against a copy with the tree in package.json:files to '
    + 'see them line by line.',
  );
  return lines.join('\n');
}

function main(root: string): number {
  const walk = sources(root);
  const { gated, reported } = partition(walk.scanned, shippedRoots(root));

  const shipped = findingsIn(root, gated);
  const elsewhere = findingsIn(root, reported);

  console.log('');
  print(shipped, 'SWALLOWED, in code this package ships:');

  console.log(`\n${countUngated(elsewhere)}`);
  console.log(`\n${summarise(walk, gated, reported)}`);
  console.log('\nwhat this gate cannot see, and says so rather than reporting it green:');
  for (const spot of BLIND_SPOTS) console.log(`  · ${spot}`);

  if (shipped.length === 0) {
    console.log(
      `\nno empty catch, no mute rejection handler and no dropped write result in ${gated.length} `
      + 'shipped source file(s).',
    );
    return 0;
  }
  console.log(
    `\n${shipped.length} swallow(s) in shipped code. Each one is a failure a user is not told `
    + 'about; see the sentence under each line for what was lost.',
  );
  return 1;
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  process.exit(main(process.argv[2] === undefined ? HERE : path.resolve(process.argv[2])));
}
