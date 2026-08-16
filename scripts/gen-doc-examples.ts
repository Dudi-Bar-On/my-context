/**
 * The mechanism that makes every documented example true.
 *
 * A marked block in the Markdown names a command; this script runs that
 * command against the committed documentation fixture and writes the real
 * stdout into the block. `test/docs/examples.test.ts` re-runs the same
 * commands through the same code path and fails when a block no longer
 * matches, so the fix for a stale example is running `npm run gen:docs` —
 * never editing the pasted block to agree with the prose.
 *
 * ````markdown
 * <!-- example: list constraint --full -->
 * ```text
 * (generated)
 * ```
 * <!-- /example -->
 * ````
 *
 * The command is always executed as `node src/cli/index.ts <command>` from a
 * materialized copy of the fixture, so a documented command that does not
 * exist fails loudly rather than being pasted as prose nobody ran.
 *
 * The opening fence may be longer than three backticks, and the closing one
 * must then match it. Some commands PRINT a fenced block — `mycontext lesson`
 * and `mycontext ingest` both embed a ```` ```json ```` payload in their
 * request — and pasting that inside a three-backtick block ends the block
 * early: GitHub renders the remainder of the output as prose and swallows the
 * `</details>` after it. Nothing in the parse breaks, which is why this has to
 * be checked rather than noticed; `renderExamples` refuses to write a body
 * whose own fence would close its block, and says which fence to widen to.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalizeNearestExisting, isMainEntry } from '../src/core/paths.ts';
import { removeTree } from '../test/helpers/tmp.ts';
import { materializeDocFixture } from './doc-fixture.ts';

export interface Example {
  /** The command as written in the marker, without the `mycontext` prefix. */
  command: string;
  /** The block's current contents, newlines normalized to `\n`. */
  body: string;
  /** Offset of the first character of the block body in the source string. */
  start: number;
  /** Offset just past the last character of the block body. */
  end: number;
  /** The block's opening fence — three backticks or more, verbatim. */
  fence: string;
}

const REPO_ROOT = path.join(import.meta.dirname, '..');
const CLI = path.join(REPO_ROOT, 'src', 'cli', 'index.ts');
const CLOCK = path.join(import.meta.dirname, 'doc-clock.ts');

/**
 * The instant every documented command is generated at.
 *
 * A documented command that prints a date — `mycontext examples <category>`
 * renders an item's `valid_from`, which `createItem` stamps with the day it
 * ran — would otherwise write the generator's own today into the
 * documentation, and the drift test would fail at the next midnight with
 * nothing in the repository having changed. `scripts/doc-clock.ts` pins the
 * child's clock here and `scrubOutput` replaces this day with `<today>`, so
 * the block says what the field means instead of naming a day that is wrong
 * for every reader.
 *
 * Two properties are load-bearing:
 *
 * - It is a fixed absolute instant, so the generating and verifying machines
 *   agree regardless of their clocks, their timezones, or the day.
 * - It is not any date the committed fixture carries (asserted by
 *   `test/docs/examples.test.ts`), so substituting it cannot reach a real
 *   `valid_from` that belongs to the corpus and is meant to be shown.
 *
 * Midday UTC, and after every fixture date, so the day cannot roll over
 * mid-run and nothing computed against it reads as an item from the future.
 */
export const DOC_CLOCK = '2026-09-01T12:00:00.000Z';

/** The documents whose blocks `npm run gen:docs` fills. */
export const DOCUMENTS = ['README.md', path.join('docs', 'README.he.md')];

/** The token an absolute fixture path is replaced with. */
const WORKSPACE = '<workspace>';

/**
 * The token the pinned clock's day is replaced with.
 *
 * A placeholder rather than a date, and shaped like `<workspace>` for the
 * same reason: a `YYYY-MM-DD` field holding an angle-bracket token is plainly
 * not a value the command computed, and it says what the field actually
 * holds — the day the command was run — instead of naming one particular day
 * that is wrong for everyone who did not run it on 2026-09-01. A frozen real
 * date would be the defect `src/help/index.ts` was fixed for, moved into the
 * documentation: the one field in a rendered example a reader can check
 * against their own clock and find wrong.
 */
const TODAY = '<today>';

/**
 * The token the pinned clock's day-plus-365 is replaced with.
 *
 * `assumption` is the one category whose distinctive field names a FUTURE day:
 * `exampleItem` stamps `validate_by` with `aboutAYearFromNow()` so the
 * specimen shows a deadline the reader has not already missed. That is the
 * same class of machine fact as `valid_from` — it moves every time the
 * generator runs — and it is not caught by the `<today>` substitution, because
 * it is deliberately not today. Left alone, the `examples assumption --short`
 * block would be generated once, verified once, and then disagree with the
 * command on every later day.
 *
 * Derived from the pinned clock rather than from the real one, for the reason
 * `TODAY` is: the substituted day must be a value nothing in the fixture
 * carries, so anything printing it computed it from the run-time clock.
 * `test/docs/examples.test.ts` asserts both halves.
 */
const A_YEAR_OUT = '<a year from today>';

/** The `YYYY-MM-DD` 365 days after `clock` — what `aboutAYearFromNow` (help/index.ts)
 * computes when the child's clock is pinned there. Exported so a test can assert the
 * fixture does not carry it. */
export function yearOutDay(clock: string): string {
  const ms = Date.parse(clock);
  if (Number.isNaN(ms)) throw new Error(`my_context: not a parseable doc clock: ${clock}`);
  return new Date(ms + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * `\r?\n` throughout, because `.gitattributes` asks for LF but a working tree
 * checked out before it was added still has CRLF `.md` files — and a marker
 * regex anchored on bare `\n` finds NOTHING there. Silently finding nothing
 * is the worst available failure for a drift harness: the generator writes no
 * blocks and the test verifies no blocks, and both report success.
 */
const OPEN = /<!-- example: (.+?) -->\r?\n(`{3,})text\r?\n/g;

/**
 * Every marked example block, in document order.
 *
 * `body` is normalized to `\n` so it can be compared against a child
 * process's stdout on any checkout; `start` and `end` are raw offsets into
 * the string that was passed in, so `markdown.slice(0, start) + text +
 * markdown.slice(end)` replaces the block exactly.
 *
 * The closing fence is built from the opening one rather than being a
 * constant, so a four-backtick block is closed by four backticks and a bare
 * ```` ``` ```` line inside it is body, not a terminator. That is what lets a
 * block hold output which itself contains a fence.
 */
export function collectExamples(markdown: string): Example[] {
  const out: Example[] = [];
  OPEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OPEN.exec(markdown)) !== null) {
    const command = m[1].trim();
    const fence = m[2];
    const start = m.index + m[0].length;
    // Anchored on the exact fence, and on a line that holds nothing else —
    // a LONGER run of backticks does not match, because the character after
    // the fence must be the line ending.
    const CLOSE = new RegExp(`\\r?\\n${fence}\\r?\\n<!-- \\/example -->`, 'g');
    CLOSE.lastIndex = start;
    const close = CLOSE.exec(markdown);
    if (close === null) throw new Error(`my_context: unterminated example block: ${command}`);
    out.push({
      command,
      body: markdown.slice(start, close.index).replaceAll('\r\n', '\n'),
      start,
      end: close.index,
      fence,
    });
    // Resume after the block, so a `<!-- example:` inside one cannot open a
    // second, overlapping block.
    OPEN.lastIndex = close.index + close[0].length;
  }
  return out;
}

/**
 * Splits a marker into argv.
 *
 * Quoted runs are held together wherever they appear, so both
 * `add constraint "Postgres pool capped at 20"` and `--scope="src/**"` survive
 * as single arguments. The quotes themselves are removed, exactly as a shell
 * would remove them — a marker cannot pass a literal `"` through to the CLI.
 */
export function splitCommand(command: string): string[] {
  return tokenize(command).map(unquote);
}

/**
 * One shell-like token: a run of non-space characters, with quoted runs held
 * together wherever they appear. Shared by `splitCommand` and
 * `splitPipeline` so a `&&` INSIDE quotes — `add rule "Do X && Y"` — is one
 * token including its quotes and therefore never string-equal to the bare
 * `&&` separator.
 */
function tokenize(command: string): string[] {
  return command.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
}

function unquote(token: string): string {
  return token.replaceAll('"', '');
}

/**
 * Splits a marker into the sequence of commands it names, on a bare `&&`.
 *
 * Every example runs against its OWN materialized fixture
 * (`runExampleInFixture`), so nothing an earlier BLOCK did is visible to a
 * later one. That is deliberate and load-bearing — but it means a
 * walkthrough whose last step can only exist because of its earlier steps
 * (`review promote` on a draft that `ingest-apply` created; `show` on a rule
 * that `lesson-accept` created) cannot be spelled as one command per block.
 * A marker may therefore name several commands; they run in order in one
 * workspace, and the block shows the LAST one's output. The setup is real
 * execution, not committed state pretending to be it: nothing is pasted that
 * the preceding commands did not actually produce on this run.
 *
 * A marker with an empty stage (`list &&`, `&& list`, `a && && b`) throws
 * rather than silently running the non-empty half.
 */
export function splitPipeline(command: string): string[][] {
  const stages: string[][] = [];
  let current: string[] = [];
  for (const token of tokenize(command)) {
    if (token === '&&') {
      stages.push(current);
      current = [];
      continue;
    }
    current.push(unquote(token));
  }
  stages.push(current);

  if (stages.length > 1 && stages.some((s) => s.length === 0)) {
    throw new Error(`my_context: example marker has an empty command around "&&": ${command}`);
  }
  return stages;
}

/**
 * The environment a documented command is generated under.
 *
 * Five things are pinned, each because leaving it inherited makes the
 * generated block a fact about the machine — or the day — that ran the
 * generator:
 *
 * - `MYCONTEXT_DOC_CLOCK` is the instant `scripts/doc-clock.ts`, preloaded
 *   into the child by `runExample`, shifts the child's clock to. A command
 *   that stamps a date otherwise writes the generator's own today into the
 *   documentation, which is wrong for every reader by the next morning.
 *
 * - `HOME`/`USERPROFILE` are pointed at an empty directory. `GLOBAL_DIR` is
 *   `homedir()/.my-context` and every reporting command folds that layer in
 *   when it exists, so on a maintainer's own machine `list` would document
 *   their personal corpus alongside the fixture. `os.homedir()` reads `HOME`
 *   first and `USERPROFILE` on Windows, so both are set.
 * - `MYCONTEXT_UNICODE=1` forces box-drawing, which is what a reader in
 *   Windows Terminal, VS Code, macOS or Linux sees. Without it the rendering
 *   in a documented block would be a property of the terminal the generator
 *   happened to run in — including, on a Windows machine that sets no
 *   `TERM`/`WT_SESSION`/`TERM_PROGRAM`, the ASCII fallback.
 * - `TZ` is `UTC`. The pinned clock fixes the instant; the timezone is what
 *   turns an instant into a calendar day for any code that formats a local
 *   date, so leaving it inherited would let a generating machine east of the
 *   verifying one disagree about which day the pin names.
 * - `MYCONTEXT_WIDTH` is DELETED. The layout budget is a constant
 *   (`OUTPUT_WIDTH`, format.ts) precisely so a documented table is not a fact
 *   about anyone's window; a maintainer who exports the override for their own
 *   terminal would otherwise relayout every table in the documentation and the
 *   diff would look like a legitimate change.
 * - `MYCONTEXT_ASCII` is DELETED, not overridden. `supportsUnicode` gives
 *   ASCII precedence when both are set (deliberately — the safe rendering
 *   wins), so a maintainer who exports `MYCONTEXT_ASCII=1` for their own
 *   terminal would otherwise regenerate every table in the ASCII fallback
 *   and the diff would look like a legitimate change.
 */
function childEnv(home: string, clock: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MYCONTEXT_UNICODE: '1',
    HOME: home,
    USERPROFILE: home,
    TZ: 'UTC',
    MYCONTEXT_DOC_CLOCK: clock,
  };
  delete env.MYCONTEXT_ASCII;
  delete env.MYCONTEXT_WIDTH;
  return env;
}

/** The empty home directory `childEnv` points a generated command at. */
function emptyHome(cwd: string): string {
  const home = path.join(cwd, '.no-global-layer');
  mkdirSync(home, { recursive: true });
  return home;
}

/**
 * The `YYYY-MM-DD` a pinned instant renders as — the same shape and slice
 * `mutate.ts`'s `today()` writes into `valid_from`, and the form every date a
 * command prints is in.
 */
export function clockDay(clock: string): string {
  const ms = Date.parse(clock);
  if (Number.isNaN(ms)) throw new Error(`my_context: not a parseable doc clock: ${clock}`);
  return new Date(ms).toISOString().slice(0, 10);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Removes the parts of a command's output that are facts about this machine.
 *
 * The fixture lives under a fresh temp directory, so its absolute path is
 * different on every run and would otherwise be the one thing in the
 * documentation guaranteed to be wrong for the reader. Both the path as given
 * and its canonical form are scrubbed: on Windows `%TEMP%` differs from its
 * `realpath` in case and, under some profiles, in 8.3 spelling, and a command
 * that canonicalizes before printing would slip past a single-form scrub.
 * Path separators are then normalized to `/`, which is this project's
 * convention everywhere — but ONLY inside the run that follows a substituted
 * `<workspace>` token, never across the whole output. A blanket
 * backslash-to-slash pass corrupts every other meaning a backslash has, and
 * the documentation has one: an extraction request embeds a JSON block, and
 * JSON escapes `"` as `\"`. Normalizing that globally pasted `/"` into the
 * documentation — JSON that does not parse, in the one block whose whole
 * purpose is to be copied and answered.
 *
 * What it cannot scrub, it refuses to emit: any remaining occurrence of the
 * repository root, the temp root, or a bare drive letter throws, because a
 * machine-specific path pasted into a documentation block is exactly the
 * false-but-plausible content this harness exists to keep out.
 *
 * The clock is the same class of fact as the path, and gets the same
 * treatment. `clock`'s calendar day — the day `doc-clock.ts` pinned the
 * child at, not the day this ran — becomes `<today>`. Substituting the PINNED
 * day rather than the real one is what keeps the substitution off the
 * corpus's own dates: the fixture's items carry real `valid_from` values that
 * the documentation is supposed to show, and one of them could be today's
 * date on any given day, which would make a `show` block flip to a
 * placeholder for a day and back again. The pinned day is a value nothing in
 * the fixture holds, so anything printing it derived it from the run-time
 * clock.
 */
export function scrubOutput(stdout: string, cwd: string, clock: string = DOC_CLOCK): string {
  const flags = process.platform === 'win32' ? 'gi' : 'g';
  const roots = new Set<string>();
  for (const root of [cwd, canonicalizeNearestExisting(cwd)]) {
    roots.add(root);
    roots.add(root.replaceAll('\\', '/'));
  }

  let out = stdout;
  // Longest first: a shorter root that happens to prefix a longer one would
  // otherwise leave the remainder of the longer path behind.
  for (const root of [...roots].sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(escapeRegExp(root), flags), WORKSPACE);
  }
  // Only the tail of a substituted root, delimited by whitespace or a quote —
  // see the note on JSON escapes above.
  out = out.replace(new RegExp(`${WORKSPACE}[^\\s"'\`]*`, 'g'), (m) => m.replaceAll('\\', '/'));
  out = out.trimEnd();
  out = out.replaceAll(clockDay(clock), TODAY);
  out = out.replaceAll(yearOutDay(clock), A_YEAR_OUT);

  // Both spellings of each root, because `out` is no longer uniformly
  // POSIX: a leaked Windows path keeps its backslashes, and a needle
  // normalized to `/` would no longer find it.
  const leaks = [...new Set(
    [REPO_ROOT, canonicalizeNearestExisting(REPO_ROOT), tmpdir()]
      .flatMap((p) => [p, p.replaceAll('\\', '/')]),
  )].filter((p) => new RegExp(escapeRegExp(p), flags).test(out));
  if (/(?:^|[\s"'`(])[A-Za-z]:[\\/]/.test(out)) leaks.push('an absolute drive-letter path');
  if (leaks.length > 0) {
    throw new Error(
      `my_context: generated example output still contains a machine-specific path ` +
      `(${leaks.join(', ')}). It must not be written into the documentation — teach ` +
      `scrubOutput about it first.`,
    );
  }
  return out;
}

/**
 * Runs one command of an example against a materialized fixture at `cwd` and
 * returns its RAW stdout. A non-zero exit is an error, not an example: a
 * marker naming a command that does not exist has to fail the build rather
 * than paste a usage banner as if it were the answer. That applies to a
 * setup command in a `&&` sequence exactly as it does to the last one — a
 * walkthrough whose second step silently failed would paste a real,
 * plausible block showing none of what the prose says happened.
 */
function runOne(args: string[], cwd: string, clock: string): string {
  // A file URL, not a path: `--import` takes a specifier, and a Windows
  // absolute path is not one.
  const preload = pathToFileURL(CLOCK).href;
  try {
    return execFileSync(process.execPath, ['--import', preload, CLI, ...args], {
      cwd,
      encoding: 'utf8',
      env: childEnv(emptyHome(cwd), clock),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    throw new Error(
      `my_context: \`mycontext ${args.join(' ')}\` exited ${e.status ?? '?'} and cannot be ` +
      `documented.\nstdout:\n${e.stdout ?? ''}\nstderr:\n${e.stderr ?? ''}`,
    );
  }
}

/**
 * Runs a documented marker against a materialized fixture at `cwd` and
 * returns the scrubbed stdout of its LAST command. A marker naming several
 * commands separated by `&&` (see `splitPipeline`) runs them in order in that
 * one workspace, so a walkthrough step can build on the steps before it.
 *
 * The child is preloaded with `doc-clock.ts`, which pins its calendar day to
 * `clock`. `clock` is a parameter only so a test can re-run the documented
 * commands under a different day and assert the blocks do not move; every
 * caller that writes documentation uses `DOC_CLOCK`.
 */
export function runExample(command: string, cwd: string, clock: string = DOC_CLOCK): string {
  const stages = splitPipeline(command);
  if (stages.length === 1 && stages[0].length === 0) {
    throw new Error('my_context: empty example marker');
  }

  let stdout = '';
  for (const args of stages) stdout = runOne(args, cwd, clock);
  return scrubOutput(stdout, cwd, clock);
}

/**
 * Runs one documented command against its OWN materialized fixture.
 *
 * Every example gets a fresh corpus because some of them capture — the
 * documentation shows `mycontext add` — and a mutation would otherwise leak
 * into every block after it. Sharing one workspace would also make the
 * generator and the verification test disagree the moment they iterate in
 * different orders, which is precisely the drift this harness is here to
 * catch and would be undetectable from inside it.
 */
export function runExampleInFixture(command: string, clock: string = DOC_CLOCK): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-docex-'));
  try {
    materializeDocFixture(dir);
    return runExample(command, dir, clock);
  } finally {
    removeTree(dir);
  }
}

/**
 * Refuses a body that would close its own block.
 *
 * A fence line inside the body — `mycontext lesson` and `mycontext ingest`
 * both print a ```` ```json ```` payload, and CommonMark closes a fenced
 * block at the first line whose backtick run is at least as long as the
 * opener's — ends the code block early. Everything after it renders as prose
 * and any `</details>` around it is swallowed. The parse is unaffected
 * (`collectExamples` matches only a fence line followed by the closing
 * marker), so nothing else in this harness would notice: the block is written,
 * the drift test compares it happily, and only the rendered page is wrong.
 *
 * Throwing names the fence to widen to. Widening is the whole fix — the body
 * is real output and must not be edited to fit.
 */
export function assertFenceHolds(ex: Example, body: string): void {
  const closer = new RegExp(`^ {0,3}(\`{${ex.fence.length},})[ \t]*$`, 'm');
  const found = closer.exec(body);
  if (found === null) return;
  throw new Error(
    `my_context: the output of \`mycontext ${ex.command}\` contains a line of ` +
    `${found[1].length} backticks, which closes its ${ex.fence.length}-backtick example ` +
    `block early. Widen the block's opening AND closing fence to at least ` +
    `${found[1].length + 1} backticks.`,
  );
}

/**
 * Returns `markdown` with every example block replaced by what its command
 * actually prints. Blocks are executed in document order and spliced back in
 * reverse, so an earlier block's replacement cannot shift a later block's
 * offsets.
 */
export function renderExamples(markdown: string, clock: string = DOC_CLOCK): string {
  const examples = collectExamples(markdown);
  const rendered = examples.map((ex) => {
    const body = runExampleInFixture(ex.command, clock);
    assertFenceHolds(ex, body);
    return body;
  });
  let out = markdown;
  for (let i = examples.length - 1; i >= 0; i--) {
    const ex = examples[i];
    out = out.slice(0, ex.start) + rendered[i] + out.slice(ex.end);
  }
  return out;
}

/**
 * Rewrites every example block in `DOCUMENTS` under `root`, and returns one
 * log line per document.
 *
 * A document that does not exist yet is reported and skipped rather than
 * throwing: `docs/README.he.md` arrives several tasks after this script does,
 * and a generator that cannot run until then is a generator nobody runs.
 *
 * Files are normalized to LF on the way out, which is what `.gitattributes`
 * asks of `*.md` — a working tree checked out before that rule was added
 * still holds CRLF, and rewriting half a file with LF would produce mixed
 * endings inside one document.
 *
 * `root` is a parameter so a test can drive the whole path against documents
 * it wrote itself. Nothing but a test passes anything but the default: the
 * documents this generates are the repository's own.
 */
export function generateDocuments(root: string = REPO_ROOT): string[] {
  const log: string[] = [];
  for (const relative of DOCUMENTS) {
    const file = path.join(root, relative);
    if (!existsSync(file)) {
      log.push(`skipped    ${relative} (does not exist yet)`);
      continue;
    }
    const before = readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
    const count = collectExamples(before).length;
    const after = renderExamples(before);
    if (after !== before) writeFileSync(file, after, 'utf8');
    log.push(
      `${after === before ? 'unchanged' : 'rewrote  '}  ${relative} ` +
      `(${count} example block(s))`,
    );
  }
  return log;
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  for (const line of generateDocuments()) console.log(line);
}
