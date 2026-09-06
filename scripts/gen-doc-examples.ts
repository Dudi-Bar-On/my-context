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
import {
  collectExamples, splitCommand, splitPipeline, type Example,
} from '../src/core/doc-examples.ts';

/**
 * The parse half of this mechanism lives in `src/core/doc-examples.ts` and is
 * re-exported here, unchanged, so that every importer of this module — and
 * `test/docs/examples.test.ts` above all — is unmoved by the lift. It moved so
 * that a READ surface could reach it: this module binds `writeFileSync` and
 * `execFileSync`, which `test/ui/no-writes.test.ts` bans from `src/ui/`, and
 * the Library screen has to be able to name which committed block demonstrates
 * which command. See that module's header for the whole argument.
 */
export { collectExamples, splitCommand, splitPipeline, type Example };


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

/**
 * The documents whose blocks `npm run gen:docs` fills, each with the locale
 * its `markdown`-form blocks are generated under.
 *
 * The locale exists for one reason: the `<!-- example-md: help categories -->`
 * block is document BODY, not a fenced terminal transcript, and a Hebrew
 * document whose largest section is English prose is the defect this fixes.
 * The fenced ```` ```text ```` blocks are transcripts and stay English in both
 * documents — that is literally what the reader's terminal prints — which is
 * why the locale is applied by setting `MYCONTEXT_DOC_LOCALE` for the child
 * (read by `docLocale`, src/help/index.ts) rather than by translating output:
 * only `mycontext help` reads topic sources, so nothing else moves.
 */
export const DOCUMENTS: { relative: string; locale?: 'he' }[] = [
  { relative: 'README.md' },
  { relative: path.join('docs', 'README.he.md'), locale: 'he' },
];

/** The token an absolute fixture path is replaced with. */
const WORKSPACE = '<workspace>';

/**
 * The exact character length of every documented fixture's absolute path.
 *
 * The path's LENGTH is a machine fact exactly like its spelling. `wrap`
 * (format.ts) folds a paragraph around whatever the path measures at the time
 * it is printed, and only THEN does `scrubOutput` shorten it to `<workspace>` —
 * so two machines whose temp directories differ in length wrap the same
 * sentence at different words and disagree about the committed block. That is
 * not hypothetical: `review discard-revision --yes` names the revision log's
 * absolute path mid-paragraph, and the block generated on a Windows machine
 * (`C:\Users\<name>\AppData\Local\Temp\…`, ~53 chars) failed verification on
 * every Linux CI runner (`/tmp/…`, ~23 chars) from the day it was committed.
 *
 * So the workspace is not the mkdtemp directory itself but a padding child of
 * it, sized so the CANONICAL absolute path always measures exactly this many
 * characters. Canonical, because that is the spelling a command prints: on a
 * runner whose `%TEMP%` is an 8.3 short name (`C:\Users\RUNNER~1\…`), the
 * as-spelled length and the printed length differ.
 *
 * 80 rather than something snug: every observed temp root (Linux /tmp at ~23,
 * macOS /var/folders at ~50, Windows dev and CI profiles at ~53–59) fits with
 * room, while staying under `OUTPUT_WIDTH` (100) so the path is still one
 * unbroken token to `wrap` — a token longer than the budget would be the next
 * machine-dependent line break. A temp root too long to pad DOWN to this is
 * refused loudly below rather than generating blocks that only verify here.
 */
export const FIXTURE_PATH_LENGTH = 80;

/**
 * A directory under `base` whose canonical absolute path is exactly
 * `FIXTURE_PATH_LENGTH` characters long. Exported for its test; every
 * documented example runs in one of these.
 */
export function paddedFixtureDir(base: string): string {
  const root = canonicalizeNearestExisting(base);
  const width = FIXTURE_PATH_LENGTH - root.length - 1; // 1 for the separator
  if (width < 1) {
    throw new Error(
      `my_context: the temp directory ${root} is too long to pad to the pinned ` +
      `${FIXTURE_PATH_LENGTH}-character fixture path that keeps documented line wrapping ` +
      'machine-independent. Point TMPDIR/TEMP at a shorter path and regenerate.',
    );
  }
  const dir = path.join(root, 'w'.repeat(width));
  mkdirSync(dir, { recursive: true });
  return dir;
}

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
 * Turns a command's output into the same content as document-native Markdown.
 *
 * ONE transformation, and this is the whole of it: an ATX heading line
 * (`# …` through `###### …`) becomes a bold paragraph. Everything else — the
 * table, the bullets, the inline code — is already valid Markdown and is
 * copied through untouched, which is why a table that rendered as literal `|`
 * pipes inside a ```` ```text ```` fence renders as a table once the fence is
 * gone.
 *
 * **Why bold rather than a heading-level shift**, which was the obvious other
 * design. `mycontext help categories` emits 23 headings. Written into the
 * README as real headings — at any depth — they become 23 sections of the
 * document: `test/docs/parity.test.ts` compares the two languages' heading
 * DEPTH SEQUENCE, `test/docs/capabilities.test.ts` resolves anchors and walks
 * children against the same list, and the table of contents would owe every
 * one of them an entry. They are not sections of the README; they are the
 * tool's words, which is exactly why `headings()` excludes `#` lines inside
 * fenced blocks in the first place. Bold keeps the visual hierarchy a reader
 * needs and adds nothing to the document's outline — the heading count of both
 * documents is unchanged by this form.
 *
 * The transform is a pure function of the output and is applied on BOTH sides:
 * the generator writes `toDocumentMarkdown(stdout)` and the drift test
 * compares against `toDocumentMarkdown(stdout)`. So the block is still
 * verified output; what the framing sentence must say — and does, in both
 * documents — is that one named transformation stands between the block and
 * the terminal.
 */
export function toDocumentMarkdown(output: string): string {
  return output
    .split('\n')
    .map((line) => {
      const heading = /^ {0,3}(#{1,6}) +(.*?)\s*$/.exec(line);
      return heading === null || heading[2] === '' ? line : `**${heading[2]}**`;
    })
    .join('\n');
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
function childEnv(home: string, clock: string, locale?: 'he'): NodeJS.ProcessEnv {
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
  // Set per document, DELETED otherwise — inherited from a maintainer's shell
  // it would regenerate the English README's `help categories` block in
  // Hebrew, and the diff would look like a legitimate change.
  if (locale === undefined) delete env.MYCONTEXT_DOC_LOCALE;
  else env.MYCONTEXT_DOC_LOCALE = locale;
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
function runOne(args: string[], cwd: string, clock: string, locale?: 'he'): string {
  // A file URL, not a path: `--import` takes a specifier, and a Windows
  // absolute path is not one.
  const preload = pathToFileURL(CLOCK).href;
  try {
    return execFileSync(process.execPath, ['--import', preload, CLI, ...args], {
      cwd,
      encoding: 'utf8',
      env: childEnv(emptyHome(cwd), clock, locale),
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
export function runExample(
  command: string, cwd: string, clock: string = DOC_CLOCK, locale?: 'he',
): string {
  const stages = splitPipeline(command);
  if (stages.length === 1 && stages[0].length === 0) {
    throw new Error('my_context: empty example marker');
  }

  let stdout = '';
  for (const args of stages) stdout = runOne(args, cwd, clock, locale);
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
export function runExampleInFixture(
  command: string, clock: string = DOC_CLOCK, locale?: 'he',
): string {
  const base = mkdtempSync(path.join(tmpdir(), 'myctx-docex-'));
  try {
    // The padding child, not the mkdtemp directory: a documented block's line
    // wrapping is a function of the workspace path's LENGTH, and this is what
    // pins it — see FIXTURE_PATH_LENGTH.
    const dir = paddedFixtureDir(base);
    materializeDocFixture(dir);
    return runExample(command, dir, clock, locale);
  } finally {
    removeTree(base);
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
 * Refuses a Markdown-form body that would not survive being written unfenced.
 *
 * A ```` ```text ```` block is inert: whatever is inside it is shown, and the
 * only hazard is a fence that closes early (`assertFenceHolds`). An
 * `example-md` block is the opposite — its body IS document Markdown, so a
 * line in it participates in the page. Three things are refused, each because
 * it damages the document rather than the block:
 *
 * - **An example marker**, which would close this block early or open a
 *   nested one, and would then be spliced over on the next generation.
 * - **A surviving ATX heading.** The whole reason this form does not use a
 *   heading-level shift is that headings here become sections of the README
 *   and two documentation tests key on the heading sequence. If a command's
 *   output ever reaches this function with a heading intact,
 *   `toDocumentMarkdown` stopped doing its one job and the block would move
 *   the parity sequence in one language only.
 * - **An odd number of fence lines**, which leaves the block open and hides
 *   the rest of the document from every reader and every test that walks
 *   fences.
 */
export function assertMarkdownBlockHolds(ex: Example, body: string): void {
  if (/<!--\s*\/?\s*example/.test(body)) {
    throw new Error(
      `my_context: the output of \`mycontext ${ex.command}\` contains an example marker, ` +
      `which would close or nest its <!-- example-md --> block. Use a \`\`\`text block.`,
    );
  }
  const heading = /^ {0,3}#{1,6} .*$/m.exec(body);
  if (heading !== null) {
    throw new Error(
      `my_context: the Markdown-form output of \`mycontext ${ex.command}\` still contains the ` +
      `heading ${JSON.stringify(heading[0])}. A heading written into the document here becomes ` +
      `a section of the README, which test/docs/parity.test.ts and ` +
      `test/docs/capabilities.test.ts both key on — toDocumentMarkdown must fold it to bold.`,
    );
  }
  const fences = (body.match(/^ {0,3}`{3,}/gm) ?? []).length;
  if (fences % 2 !== 0) {
    throw new Error(
      `my_context: the output of \`mycontext ${ex.command}\` opens ${fences} code fence(s), ` +
      `an odd number, so an <!-- example-md --> block holding it would never close and would ` +
      `hide the rest of the document. Use a \`\`\`text block.`,
    );
  }
}

/**
 * What one example block's body should be: the command's real output, in the
 * form that block declares. The ONE place the two forms diverge, so the
 * generator and the drift test cannot disagree about what a block is supposed
 * to hold.
 */
export function exampleBody(ex: Example, clock: string = DOC_CLOCK, locale?: 'he'): string {
  const output = runExampleInFixture(ex.command, clock, locale);
  if (ex.kind === 'text') {
    assertFenceHolds(ex, output);
    return output;
  }
  const body = toDocumentMarkdown(output);
  assertMarkdownBlockHolds(ex, body);
  return body;
}

/**
 * Returns `markdown` with every example block replaced by what its command
 * actually prints. Blocks are executed in document order and spliced back in
 * reverse, so an earlier block's replacement cannot shift a later block's
 * offsets.
 */
export function renderExamples(
  markdown: string, clock: string = DOC_CLOCK, locale?: 'he',
): string {
  const examples = collectExamples(markdown);
  const rendered = examples.map((ex) => exampleBody(ex, clock, locale));
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
  for (const { relative, locale } of DOCUMENTS) {
    const file = path.join(root, relative);
    if (!existsSync(file)) {
      log.push(`skipped    ${relative} (does not exist yet)`);
      continue;
    }
    const before = readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
    const count = collectExamples(before).length;
    const after = renderExamples(before, DOC_CLOCK, locale);
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
