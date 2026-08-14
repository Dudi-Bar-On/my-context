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
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
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
}

const REPO_ROOT = path.join(import.meta.dirname, '..');
const CLI = path.join(REPO_ROOT, 'src', 'cli', 'index.ts');

/** The documents whose blocks `npm run gen:docs` fills. */
export const DOCUMENTS = ['README.md', path.join('docs', 'README.he.md')];

/** The token an absolute fixture path is replaced with. */
const WORKSPACE = '<workspace>';

/**
 * `\r?\n` throughout, because `.gitattributes` asks for LF but a working tree
 * checked out before it was added still has CRLF `.md` files — and a marker
 * regex anchored on bare `\n` finds NOTHING there. Silently finding nothing
 * is the worst available failure for a drift harness: the generator writes no
 * blocks and the test verifies no blocks, and both report success.
 */
const OPEN = /<!-- example: (.+?) -->\r?\n```text\r?\n/g;
const CLOSE = /\r?\n```\r?\n<!-- \/example -->/g;

/**
 * Every marked example block, in document order.
 *
 * `body` is normalized to `\n` so it can be compared against a child
 * process's stdout on any checkout; `start` and `end` are raw offsets into
 * the string that was passed in, so `markdown.slice(0, start) + text +
 * markdown.slice(end)` replaces the block exactly.
 */
export function collectExamples(markdown: string): Example[] {
  const out: Example[] = [];
  OPEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OPEN.exec(markdown)) !== null) {
    const command = m[1].trim();
    const start = m.index + m[0].length;
    CLOSE.lastIndex = start;
    const close = CLOSE.exec(markdown);
    if (close === null) throw new Error(`my_context: unterminated example block: ${command}`);
    out.push({
      command,
      body: markdown.slice(start, close.index).replaceAll('\r\n', '\n'),
      start,
      end: close.index,
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
  return (command.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []).map((a) => a.replaceAll('"', ''));
}

/**
 * The environment a documented command is generated under.
 *
 * Three things are pinned, each because leaving it inherited makes the
 * generated block a fact about the machine that ran the generator:
 *
 * - `HOME`/`USERPROFILE` are pointed at an empty directory. `GLOBAL_DIR` is
 *   `homedir()/.my-context` and every reporting command folds that layer in
 *   when it exists, so on a maintainer's own machine `list` would document
 *   their personal corpus alongside the fixture. `os.homedir()` reads `HOME`
 *   first and `USERPROFILE` on Windows, so both are set.
 * - `MYCONTEXT_UNICODE=1` forces box-drawing. The documentation shows what a
 *   reader in Windows Terminal, VS Code, macOS or Linux sees; the ASCII
 *   fallback is described in prose rather than pasted, and forcing it here
 *   makes the block independent of the terminal that generated it.
 * - `MYCONTEXT_ASCII` is DELETED, not overridden. `supportsUnicode` gives
 *   ASCII precedence when both are set (deliberately — the safe rendering
 *   wins), so a maintainer who exports `MYCONTEXT_ASCII=1` for their own
 *   terminal would otherwise regenerate every table in the ASCII fallback
 *   and the diff would look like a legitimate change.
 */
function childEnv(home: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv =
    { ...process.env, MYCONTEXT_UNICODE: '1', HOME: home, USERPROFILE: home };
  delete env.MYCONTEXT_ASCII;
  return env;
}

/** The empty home directory `childEnv` points a generated command at. */
function emptyHome(cwd: string): string {
  const home = path.join(cwd, '.no-global-layer');
  mkdirSync(home, { recursive: true });
  return home;
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
 * convention everywhere.
 *
 * What it cannot scrub, it refuses to emit: any remaining occurrence of the
 * repository root, the temp root, or a bare drive letter throws, because a
 * machine-specific path pasted into a documentation block is exactly the
 * false-but-plausible content this harness exists to keep out.
 */
export function scrubOutput(stdout: string, cwd: string): string {
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
  out = out.replaceAll('\\', '/').trimEnd();

  const leaks = [REPO_ROOT, canonicalizeNearestExisting(REPO_ROOT), tmpdir()]
    .map((p) => p.replaceAll('\\', '/'))
    .filter((p) => new RegExp(escapeRegExp(p), flags).test(out));
  if (/(?:^|[\s"'`(])[A-Za-z]:\//.test(out)) leaks.push('an absolute drive-letter path');
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
 * Runs one documented command against a materialized fixture at `cwd` and
 * returns its scrubbed stdout. A non-zero exit is an error, not an example:
 * a marker naming a command that does not exist has to fail the build rather
 * than paste a usage banner as if it were the answer.
 */
export function runExample(command: string, cwd: string): string {
  const args = splitCommand(command);
  if (args.length === 0) throw new Error('my_context: empty example marker');

  let stdout: string;
  try {
    stdout = execFileSync(process.execPath, [CLI, ...args], {
      cwd, encoding: 'utf8', env: childEnv(emptyHome(cwd)), stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    throw new Error(
      `my_context: \`mycontext ${command}\` exited ${e.status ?? '?'} and cannot be documented.\n` +
      `stdout:\n${e.stdout ?? ''}\nstderr:\n${e.stderr ?? ''}`,
    );
  }
  return scrubOutput(stdout, cwd);
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
export function runExampleInFixture(command: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-docex-'));
  try {
    materializeDocFixture(dir);
    return runExample(command, dir);
  } finally {
    removeTree(dir);
  }
}

/**
 * Returns `markdown` with every example block replaced by what its command
 * actually prints. Blocks are executed in document order and spliced back in
 * reverse, so an earlier block's replacement cannot shift a later block's
 * offsets.
 */
export function renderExamples(markdown: string): string {
  const examples = collectExamples(markdown);
  const rendered = examples.map((ex) => runExampleInFixture(ex.command));
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
