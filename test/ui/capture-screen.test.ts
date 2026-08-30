/**
 * The Capture screen's DECIDABLE half, tested in Node — and the line where that
 * half stops.
 *
 * Spec §6 names the DOM glue in `app.js` and `screens/*.js` as the untested
 * surface, and `test/ui/viewmodel.test.ts`'s own header says why: testing it
 * would need a browser dependency this project does not have. Nothing below
 * builds an element or stands in a `document`. What it does test is everything
 * `screens/capture.js` DECIDES before it touches one:
 *
 *   - that the scope the screen parses out of its input box is the same scope
 *     `/api/capture` parses out of the query string — asserted against the REAL
 *     endpoint over a REAL workspace, not against this file's idea of it, and
 *     in both directions: what the screen calls a question the endpoint
 *     answers, and what the screen calls empty the endpoint refuses;
 *   - that the composed `mycontext add` is the design of record's own `<code>`
 *     line byte for byte, is quoted by the ONE quoting implementation, and
 *     refuses a half-built capture rather than composing a weaker command;
 *   - that the second table cell is BUILT FROM THE ROW — the same two words
 *     `cap.o1` and `cap.o2` spell, produced without either key and without the
 *     word `normative` appearing anywhere in the module's code;
 *   - that the category picker reads `/api/config`'s `resolved` view and drops
 *     the categories the CLI would refuse;
 *   - that every string key the screen names is declared in BOTH tables with
 *     its slots supplied, that the two `cap.` keys it CANNOT place are exactly
 *     `cap.o1` and `cap.o2`, and that `notGoverning` is drawn nowhere;
 *   - that no translated string is assigned rather than appended (owner ruling
 *     A1), and that the classes and tags this screen invents are exactly the
 *     ones the report names and no others.
 *
 * ── HOW A BROWSER MODULE IS LOADED HERE, AND WHY NOT DIRECTLY ─────────────
 *
 * `test/ui/work-screen.test.ts`'s method, for its reasons. A screen imports its
 * dependencies by the specifiers the BROWSER resolves — `/lib/command.js`,
 * `/lib/palette-defs.js`, `/screens/parts.js` — and Node resolves a leading `/`
 * as a filesystem path from the drive root. So the module's own bytes are read,
 * its root-absolute specifiers are rewritten to `file://` URLs, and the result
 * is imported as a `data:` module. The rewrite is COUNTED and the result
 * re-checked for a surviving `/` specifier, because a rewrite that silently
 * missed one would import a different module graph than the browser runs —
 * which is the only way this file could pass while testing the wrong thing.
 *
 * No stand-in `document` is supplied, deliberately: supplying one would let
 * this file drift into testing the glue.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';
import { apiCapture, type CaptureBody } from '../../src/ui/capture-model.ts';
import { apiConfigGet } from '../../src/ui/read-model-config.ts';
import { allowedClasses } from '../helpers/shipped-classes.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const CAPTURE_JS = path.join(PUBLIC, 'screens', 'capture.js');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');

const source = readFileSync(CAPTURE_JS, 'utf8');

/**
 * The module's CODE, with every whole-line comment removed.
 *
 * The scans below ask what this module DOES — does it spell `normative`, does
 * it draw `notGoverning`, does it quote a value itself. Every one of those
 * words also appears in the header, in a citation explaining why the module
 * does not do the thing. Running those scans over the raw bytes would fail on
 * the explanation and pass on the offence, which is the wrong way round.
 */
const CODE = source.split('\n')
  .filter((line) => {
    const trimmed = line.trim();
    return trimmed !== '' && !trimmed.startsWith('*') && !trimmed.startsWith('//')
      && !trimmed.startsWith('/*');
  })
  .join('\n');

interface GoverningRow { id: string; type: string; tier: string }
interface FlagSpec { name: string; options?: string[]; boolean?: boolean; required?: boolean }
interface PaletteDef {
  name: string; kind: string; base: string[]; overlap?: boolean; boundary?: boolean;
  args: FlagSpec[]; flags: FlagSpec[];
}

/**
 * The screen's published interface. Hand-declared rather than inferred, so it
 * is an assertion in its own right: a module that drifts from it fails here
 * rather than in a browser nobody is watching.
 */
interface CaptureModule {
  ADD: PaletteDef;
  CAPTURE_DEBOUNCE_MS: number;
  scopePatterns: (raw: unknown) => string[];
  capturePath: (patterns: string[]) => string;
  categoryOptions: (config: unknown) => string[];
  severityOptions: () => string[];
  captureArgv: (values: Record<string, string | undefined>) => string[];
  captureCommand: (values: Record<string, string | undefined>) => string;
  rowCells: (row: GoverningRow) => { id: string; detail: string };
  render: (root: unknown, ctx: unknown) => Promise<void>;
}

interface DefsModule {
  PALETTE: PaletteDef[];
  commandFor: (def: PaletteDef, values: Record<string, unknown>) => string[];
}
interface CommandModule { composeCommand: (argv: string[]) => string }

/** `from '/lib/command.js'` — the browser's own specifier form. */
const ROOT_SPECIFIER = /(\bfrom\s+')\/([^']+)'/g;

const publicUrl = (relative: string): string =>
  pathToFileURL(path.join(PUBLIC, relative)).href;

async function captureModule(): Promise<CaptureModule> {
  let rewritten = 0;
  const text = source.replace(ROOT_SPECIFIER, (_all, head: string, spec: string) => {
    rewritten += 1;
    return `${head}${publicUrl(spec)}'`;
  });
  assert.equal(rewritten, 4,
    'expected capture.js to import four browser modules (/lib/command.js, '
    + `/lib/palette-defs.js, /screens/parts.js); the rewrite matched ${rewritten}. A specifier `
    + 'this pattern cannot see is a module Node would resolve from the drive root, and the import '
    + 'below would fail for a reason that reads like a missing file.');
  assert.ok(!/\bfrom\s+'\//.test(text),
    'a root-absolute specifier survived the rewrite — the module graph imported below would not '
    + 'be the one the browser runs');
  const encoded = Buffer.from(text, 'utf8').toString('base64');
  return (await import(`data:text/javascript;charset=utf-8;base64,${encoded}`)) as CaptureModule;
}

const defsModule = async (): Promise<DefsModule> =>
  (await import(publicUrl('lib/palette-defs.js'))) as DefsModule;
const commandModule = async (): Promise<CommandModule> =>
  (await import(publicUrl('lib/command.js'))) as CommandModule;

async function table(language: string): Promise<Record<string, string>> {
  const file = path.join(PUBLIC, 'strings', `${language}.js`);
  const mod = await import(pathToFileURL(file).href) as { strings: Record<string, string> };
  return mod.strings;
}

/** `<section data-p="capture">…</section>`, the design of record for this screen. */
function mockupSection(): string {
  const html = readFileSync(MOCKUP, 'utf8');
  const start = html.indexOf('<section data-p="capture"');
  assert.notEqual(start, -1, 'the mockup has no [data-p="capture"] section');
  const end = html.indexOf('</section>', start);
  assert.notEqual(end, -1, 'the capture section is never closed');
  return html.slice(start, end);
}

/**
 * A real workspace, built by the REAL CLI, for the reason
 * `test/ui/capture-model.test.ts` gives: the endpoints below read what is on
 * disk, so a corpus a test invented would be a corpus the product never wrote.
 *
 * One item, and it is not decoration: `init` alone writes no `.index.db`, and
 * `withStores` opens the index read-only, so `apiCapture` over a bare
 * workspace throws `unable to open database file` — measured, not assumed. The
 * questions this file asks the endpoints are about the PARSE and the CONFIG
 * rather than about which items came back, but they still have to reach a
 * corpus that exists. `--yes` is required because `add` refuses without it
 * when stdin is not interactive, the deviation `read-model-work.test.ts`
 * established.
 */
function workspace(): { dir: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-capscreen-'));
  assert.equal(runCli(['init'], dir, () => {}), 0, 'the fixture workspace must init');
  assert.equal(runCli(['add', 'rule', 'Use POSIX paths', '--scope', 'src/**',
    '--body', 'POSIX.', '--yes'], dir, () => {}), 0, 'the fixture item must be added');
  return { dir, done: () => removeTree(dir) };
}

/* -------------------------------------------------------------------------- *
 * The loader, before anything is trusted through it.
 * -------------------------------------------------------------------------- */

test('the screen loads, and exports the decidable surface this file tests', async () => {
  const mod = await captureModule();
  for (const name of ['scopePatterns', 'capturePath', 'categoryOptions', 'severityOptions',
    'captureCommand', 'rowCells', 'render']) {
    assert.equal(typeof (mod as unknown as Record<string, unknown>)[name], 'function',
      `capture.js must export ${name}() — the DOM half is the untested surface, so anything this `
      + 'screen decides has to be reachable from here');
  }
  assert.equal(typeof mod.CAPTURE_DEBOUNCE_MS, 'number');
});

test('ADD is the catalogue entry marked for THIS screen, not a shape spelled here', async () => {
  const { ADD } = await captureModule();
  const { PALETTE } = await defsModule();
  assert.ok(ADD, 'capture.js found no `add` entry in PALETTE — the whole composed half is dead');
  assert.equal(ADD, PALETTE.find((def) => def.name === 'add'),
    'ADD must BE the catalogue entry, not a copy of it: a copy is a second spelling of an argv '
    + 'shape that `test/ui/palette-lib.test.ts` probes the real parser to verify');
  // `overlap: true` is the catalogue's own marking for the overlap check, and
  // nothing else in the codebase reads it. If it disappears, the sentence in
  // this screen's header that cites it stops being true.
  assert.equal(ADD.overlap, true,
    'the `add` def no longer carries `overlap: true` — the marking that names this screen');
  assert.equal(ADD.boundary, true,
    '`add` is on the approval boundary; a def that stopped saying so would stop showing `--yes`');
});

/* -------------------------------------------------------------------------- *
 * The scope: the screen's parse against the endpoint's own.
 * -------------------------------------------------------------------------- */

test('the screen parses a scope exactly as /api/capture does — asked of the endpoint itself', async () => {
  const { scopePatterns } = await captureModule();
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    // The messy one is the point: four positions, two patterns. A test whose
    // inputs were all already tidy could not tell the two parses apart.
    for (const raw of [
      'src/billing/**',
      ' docs/** , , src/billing/** ,',
      'a/**,b/**',
      '  vendor/**  ',
      '../../../etc/**',
    ]) {
      const result = apiCapture(ws, new URL(`http://x/api/capture?scope=${encodeURIComponent(raw)}`));
      assert.equal(result.status, 200,
        `the endpoint refused ${JSON.stringify(raw)}: ${JSON.stringify(result.body)}`);
      assert.deepEqual((result.body as CaptureBody).scope, scopePatterns(raw),
        `the screen and the endpoint disagree about what ${JSON.stringify(raw)} means. The screen `
        + 'decides whether it holds a question at all from its own parse; a disagreement here is a '
        + 'card whose heading names a scope the answer below it is not about.');
    }
  } finally { done(); }
});

test('what the screen calls an empty scope is exactly what the endpoint refuses', async () => {
  const { scopePatterns, capturePath } = await captureModule();
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    for (const raw of ['', ' ', ',', ' , ', ',,,']) {
      assert.deepEqual(scopePatterns(raw), [],
        `the screen would send ${JSON.stringify(raw)} as a question`);
      const refused = apiCapture(ws, new URL(`http://x/api/capture?scope=${encodeURIComponent(raw)}`));
      assert.equal(refused.status, 400,
        `the endpoint answered ${JSON.stringify(raw)} rather than refusing it — the screen's `
        + 'silence on an empty box would then be hiding an answer');
      assert.match((refused.body as { error: string }).error, /scope=<glob>/);
    }
    // And the screen refuses to compose the request at all, rather than
    // sending one it knows will come back 400.
    assert.throws(() => capturePath([]), /empty scope/);
  } finally { done(); }
});

test('capturePath encodes the comma form once, and only once', async () => {
  const { capturePath } = await captureModule();
  assert.equal(capturePath(['a/**', 'b/**']), '/api/capture?scope=a%2F**%2Cb%2F**');
  assert.equal(capturePath(['src/billing/**']), '/api/capture?scope=src%2Fbilling%2F**');
  // A pattern carrying an `&` must not become a second parameter — the endpoint
  // refuses a repeated `scope` and would refuse an unknown one, so an unencoded
  // value turns a legal question into a 400.
  assert.equal(capturePath(['a&b/**']), '/api/capture?scope=a%26b%2F**');
});

/* -------------------------------------------------------------------------- *
 * The composed `mycontext add`.
 * -------------------------------------------------------------------------- */

test("captureCommand composes the design of record's own <code> line, byte for byte", async () => {
  const { captureCommand } = await captureModule();
  // Read out of the mockup rather than copied into this file. A copy would go
  // stale the moment the design of record changed its command and nothing
  // would say so.
  const code = /<code>([^<]+)<\/code>/.exec(mockupSection());
  assert.ok(code, 'the capture section draws no <code> command');
  assert.equal(
    captureCommand({ category: 'constraint', title: '…', scope: 'src/billing/**', severity: 'hard' }),
    code[1],
    'the four values the mockup shows must compose the line the mockup shows. A mismatch is '
    + 'either a catalogue whose flag order moved or a screen composing something else.');
});

test('captureCommand refuses a half-built capture rather than composing a weaker one', async () => {
  const { captureCommand } = await captureModule();
  // An `add` missing its category is not a shorter `add`; it is a command the
  // CLI rejects. `commandFor` throws and the screen honours the throw by
  // offering no copyable command at all.
  assert.throws(() => captureCommand({ title: 'x', scope: 'src/**' }), /category/);
  assert.throws(() => captureCommand({ category: 'constraint', scope: 'src/**' }), /title/);
  // An OPTIONAL flag left empty composes nothing at all, rather than an empty
  // value: `--severity` with no value is a different command.
  assert.equal(captureCommand({ category: 'constraint', title: 'x' }), 'mycontext add constraint x');
});

test('the composed --scope is the scope the overlap check was asked about, not the keystrokes', async () => {
  const { captureCommand, scopePatterns } = await captureModule();
  const patterns = scopePatterns(' docs/** , , src/billing/** ,');
  assert.equal(
    captureCommand({ category: 'constraint', title: '…', scope: patterns.join(',') }),
    'mycontext add constraint "…" --scope "docs/**,src/billing/**"',
    'composing the raw box contents would hand over a command whose scope is not the scope the '
    + 'card above it just reported on');
});

test('captureCommand quotes through the one quoting implementation, never a second', async () => {
  const { captureCommand, ADD } = await captureModule();
  const { commandFor } = await defsModule();
  const { composeCommand } = await commandModule();
  // A value carrying spaces AND a quote — the two characters `quoteArg` escapes
  // — composed both ways. Equality is the proof of delegation: a second quoter
  // would have to reproduce `quoteArg`'s escaping exactly to pass this.
  const values = { category: 'constraint', title: 'the "quoted" way', scope: 'src/a b/**' };
  assert.equal(captureCommand(values), composeCommand(commandFor(ADD, values)));
  assert.equal(captureCommand(values),
    'mycontext add constraint "the \\"quoted\\" way" --scope "src/a b/**"');

  assert.ok(!CODE.includes('quoteArg'),
    'capture.js reaches for `quoteArg` directly — composition goes through `composeCommand`, '
    + 'which is the function `test/ui/palette-lib.test.ts` checks against the real parser');
  assert.ok(!/\\"/.test(CODE),
    'a backslash-escaped double quote in this module is the shape of a hand-rolled quoter, and '
    + 'the one thing the composed-and-copied design exists to prevent is an unchecked shell '
    + 'command reaching a clipboard');
});

test("severityOptions is read off the catalogue, not spelled in the screen", async () => {
  const { severityOptions, ADD } = await captureModule();
  const flag = ADD.flags.find((candidate) => candidate.name === 'severity');
  assert.ok(flag, 'the `add` def no longer advertises --severity');
  assert.deepEqual(severityOptions(), flag.options);
  assert.deepEqual(severityOptions(), ['hard', 'soft'],
    'the vocabulary moved; the picker follows it because it reads it');
  assert.ok(!CODE.includes("'hard'") && !CODE.includes("'soft'"),
    'the severity vocabulary is spelled in the screen — a copy of a closed list that '
    + '`test/ui/palette-lib.test.ts` probes the real argument parser to verify');
});

/* -------------------------------------------------------------------------- *
 * The two cells of a row, and the category picker.
 * -------------------------------------------------------------------------- */

test("a row's second cell is built from the row — and equals cap.o1 and cap.o2 exactly", async () => {
  const { rowCells } = await captureModule();
  const en = await table('en');
  // The mockup's two sample rows, produced WITHOUT either key. That the two
  // strings come out identical is the whole argument for building the cell
  // from data: the design of record's own English is what the data spells.
  assert.equal(
    rowCells({ id: 'INV-prices-are-integer-cents', type: 'invariant', tier: 'normative' }).detail,
    en['cap.o1']);
  assert.equal(
    rowCells({ id: 'STD-api-errors-use-problem-json', type: 'standard', tier: 'normative' }).detail,
    en['cap.o2']);
  assert.equal(rowCells({ id: 'INV-x', type: 'invariant', tier: 'normative' }).id, 'INV-x');
});

test('the tier is READ from the row, so a widened filter renders itself', async () => {
  const { rowCells } = await captureModule();
  // `injection()` refuses anything not normative today, so every row's tier is
  // `normative`. A screen that printed the word would keep printing it the day
  // the owner widened the filter; this one would follow the data.
  assert.equal(rowCells({ id: 'ADR-x', type: 'adr', tier: 'rationale' }).detail, 'adr, rationale');
  assert.ok(!CODE.includes('normative'),
    'the word `normative` appears in this screen\'s code. It is a property of the corpus, read '
    + 'off `row.tier`; a screen that spells it is asserting something it never read.');
});

test('the category picker reads /api/config\'s resolved view and drops what the CLI refuses', async () => {
  const { categoryOptions } = await captureModule();
  const { dir, done } = workspace();
  try {
    const answer = apiConfigGet(resolveWorkspace(dir), new URL('http://x/api/config'));
    assert.equal(answer.status, 200);
    const names = categoryOptions(answer.body);
    // A scan that finds nothing reads exactly like a clean picker.
    assert.ok(names.length >= 5,
      `the real config yielded ${names.length} category names; a fresh workspace has more than `
      + 'that, so the reader is broken rather than the corpus empty');
    assert.ok(names.includes('constraint'),
      'the category the mockup composes is not offerable — the picker is reading the wrong field');
  } finally { done(); }
});

test('categoryOptions honours `enabled`, the `resolved` wrapper, and a config that did not load', async () => {
  const { categoryOptions } = await captureModule();
  assert.deepEqual(
    categoryOptions({ resolved: { categories: [
      { name: 'rule', enabled: true }, { name: 'lesson', enabled: false },
    ] } }),
    ['rule'],
    'a disabled category cannot receive an item, so offering it composes a command the CLI '
    + 'refuses');
  // The wrapper is load-bearing: `/api/config` answers `{ path, exists, raw,
  // parseError, resolveError, resolved, meta }`, and a reader that took
  // `body.categories` would silently offer nothing at all.
  assert.deepEqual(categoryOptions({ categories: [{ name: 'rule', enabled: true }] }), []);
  assert.deepEqual(categoryOptions({ resolved: null }), []);
  assert.deepEqual(categoryOptions(null), []);
});

/* -------------------------------------------------------------------------- *
 * The one control — and the one screen that keeps Copy alone by DECISION.
 * -------------------------------------------------------------------------- */

/**
 * **`captureArgv` is the argv and `captureCommand` is what it composes to.**
 * The Copy-and-Execute control takes an argv; a string cannot be executed, and
 * a screen carrying both as independent values is the drift a confirm exists to
 * prevent.
 */
test('captureCommand is exactly what captureArgv composes to, refusals included', async () => {
  const { captureArgv, captureCommand } = await captureModule();
  const command = await import(pathToFileURL(path.join(PUBLIC, 'lib', 'command.js')).href) as {
    composeCommand: (argv: string[]) => string;
  };
  const values = { category: 'rule', title: 'two words', scope: 'src/**' };
  assert.equal(command.composeCommand(captureArgv(values)), captureCommand(values));
  assert.equal(captureArgv(values)[0], 'mycontext',
    'Copy hands a shell what a HUMAN types, and that includes the program name');
  // A half-built capture is refused one layer down, and the refusal must reach
  // the caller from either entry point.
  assert.throws(() => captureArgv({ title: 'no category' }), /required/);
  assert.throws(() => captureCommand({ title: 'no category' }), /required/);
});

/**
 * **THE DECISION THIS BLOCK RESERVED HAS BEEN TAKEN — 2026-08-27 — AND BOTH
 * HALVES ARE INVERTED HERE RATHER THAN DELETED.**
 *
 * What stood here recorded that Capture was the one screen keeping Copy alone
 * for a command the catalogue DOES have. `add` is in the catalogue, so every
 * other screen's rule would have it pass `id: 'add'` and gain Execute. What
 * stopped it was `cap.warn` — *"This is a write. Run it in your own shell."* —
 * a sentence of the DESIGN OF RECORD, drawn in the mockup's capture section and
 * false the moment a button beside it runs the command. Choosing between them
 * changed what the mockup draws, so it was the owner's call, and it was
 * reported rather than taken.
 *
 * Two things then happened. `plan:execute seq:5b` deleted the browser's
 * `COMMAND_EFFECTS` table and moved the derivation to the server, so the reason
 * waiting was free — that an Execute button here could only mint a nonce and
 * decline — stopped being true. And the owner ruled
 * (`DEC-cap-warn-is-dropped-and-capture-gains-execute-the-other`): drop the
 * sentence, offer Execute.
 *
 * So the sentence is gone from the screen, from BOTH string tables, from the
 * mockup, and from both stylesheets along with `p.cmdnote` — which had exactly
 * one author on either side — and `p.cmdnote` has left `KNOWN_GAPS.capture` in
 * `screen-parity.spec.ts`, shortening that ledger.
 *
 * The test below is what keeps the reversal loud in the other direction: a
 * `cap.warn` restored beside a running button, or an `id` quietly dropped back
 * to `null`, fails here with the reason attached.
 */
test('Capture offers Execute and draws no shell warning — the decision, pinned in both halves',
  async () => {
    const defs = await import(pathToFileURL(path.join(PUBLIC, 'lib', 'palette-defs.js')).href) as {
      PALETTE: { name: string; boundary?: boolean }[];
    };
    const en = await import(pathToFileURL(path.join(PUBLIC, 'strings', 'en.js')).href) as {
      strings: Record<string, string>;
    };
    const he = await import(pathToFileURL(path.join(PUBLIC, 'strings', 'he.js')).href) as {
      strings: Record<string, string>;
    };

    // The half that says the control can now do what it offers.
    assert.equal(defs.PALETTE.find((def) => def.name === 'add')?.boundary, true,
      'add still changes what governs this project, so it keeps the STRONGER confirm — Execute '
      + 'here is not a downgrade of the gate, it is the gate being reachable');
    assert.ok(CODE.includes("id: 'add'"),
      'Capture must pass the catalogue id: without one, commandActions appends Copy and returns '
      + 'before Execute is ever constructed, which is the state seq:6c existed to end');

    // The half that is the decision itself.
    assert.ok(!CODE.includes("cap.warn"),
      '"This is a write. Run it in your own shell." must not be drawn beside a button that runs '
      + 'it — that is the whole reason this screen waited');
    assert.equal(en.strings['cap.warn'], undefined,
      'and the key is retired, not merely unused: a string left in the table is a sentence the '
      + 'next screen can pick up without re-taking this decision');
    assert.equal(he.strings['cap.warn'], undefined,
      'in BOTH tables — a key surviving in one is how the two come to disagree');
  });

/**
 * **One control, not a tenth copy button.** The confirm is the security
 * boundary and nine hand-rolled spellings of it would be nine chances to get it
 * wrong — and this screen adopts the control even though its half of it is Copy
 * alone, because the copy behaviour is the same behaviour and one spelling of
 * it is the whole point.
 */
test('the screen adopts the shared control and keeps no copy button of its own', () => {
  assert.ok(CODE.includes("from '/lib/command-actions.js'"),
    'the screen does not import the shared Copy-and-Execute control');
  assert.ok(!/navigator\.clipboard/.test(CODE),
    'the screen still talks to the clipboard itself — Copy lives in lib/command-actions.js now');
});

/* -------------------------------------------------------------------------- *
 * The screen against the two string tables and against the mockup.
 * -------------------------------------------------------------------------- */

/** Every key `capture.js` names, by the two shapes a screen can name one in. */
function keysNamed(): { key: string; args: string | null }[] {
  const out: { key: string; args: string | null }[] = [];
  for (const m of source.matchAll(/ctx\.t(?:Flat)?\('([^']+)'/g)) {
    const after = source.slice((m.index ?? 0) + m[0].length);
    const open = after.indexOf('{');
    const close = after.indexOf(')');
    out.push({ key: m[1]!, args: open !== -1 && (close === -1 || open < close) ? after : null });
  }
  for (const m of source.matchAll(/screenHead\(ctx, root, '([^']+)', '([^']+)', '([^']+)'\)/g)) {
    for (const key of [m[1]!, m[2]!, m[3]!]) out.push({ key, args: null });
  }
  return out;
}

test('every string key the Capture screen names is declared in both tables, with its slots supplied', async () => {
  const en = await table('en');
  const he = await table('he');
  const used = keysNamed();

  // A scanner that finds nothing reads exactly like a clean file.
  // FIVE since seq:6c, not six: `cap.warn` was removed with the sentence it
  // carried, so the screen genuinely names one fewer. The floor moves with the
  // screen rather than being loosened to a range — a floor that drifts down on
  // its own stops being a guard against the scan collapsing.
  assert.ok(used.length >= 5,
    `the scan found ${used.length} key(s) in capture.js; the screen names five. A collapse means `
    + 'the patterns stopped matching, not that the screen stopped naming keys.');
  assert.ok(!used.some((u) => u.key === 'btn.copy'),
    'the screen words its own Copy button again; Copy is lib/command-actions.js\' word now, and '
    + 'two screens wording one button is how they come to disagree about it');

  // The grammar has ONE parser and this is it. Eight files used to carry a
  // private scanner instead, all of them predating emphasis, and every one
  // read `{b:` as a substitution named `b:...` the day emphasis landed.
  const { slots: slotsOf } = await import(
    new URL('../../src/ui/public/lib/i18n.js', import.meta.url).href
  ) as { slots: (template: string) => string[] };

  for (const { key, args } of used) {
    assert.ok(key in en, `capture.js names ${key}, missing from the English table`);
    assert.ok(key in he, `capture.js names ${key}, missing from the Hebrew table`);
    // Both tables, not only English: `t()` throws on a substitution the caller
    // did not pass, and it throws in whichever language the reader chose.
    for (const template of [en[key]!, he[key]!]) {
      for (const slot of slotsOf(template)) {
        assert.ok(args !== null && args.includes(`${slot}:`),
          `${key} declares a {${slot}} slot that the call site does not supply — t() throws and `
          + 'the screen blanks');
      }
    }
  }
});

test('the two cap. keys this screen cannot place are exactly cap.o1 and cap.o2', async () => {
  const en = await table('en');
  const declared = Object.keys(en).filter((key) => key.startsWith('cap.')).sort();
  const named = new Set(keysNamed().map((u) => u.key));
  // EIGHT since 2026-08-30. It was 8 from the day this screen was written,
  // went to 7 when `plan:execute seq:6c` retired `cap.warn` (Capture offers
  // Execute, so "run it in your own shell" is false and the key is gone from
  // BOTH tables rather than left declared and unused), and is 8 again now that
  // `cap.notgov` words `notGoverning` — the count this screen was serving and
  // could not label while it believed a key the mockup does not declare would
  // fail `strings-parity`. It does not, and has not since 2026-08-26.
  assert.equal(declared.length, 8,
    `the English table declares ${declared.length} cap. key(s); it has been 8 since cap.notgov `
    + 'landed. A new one is a new sentence on this screen and needs placing.');
  // The other direction of the same fact. `strings-parity` proves the two
  // tables agree with the mockup's `data-t` set; it cannot prove the screen
  // ever draws one.
  assert.deepEqual(declared.filter((key) => !named.has(key)), ['cap.o1', 'cap.o2'],
    'cap.o1 and cap.o2 are the two SAMPLE rows\' second cells — "invariant, normative" and '
    + '"standard, normative" — and a corpus has whatever categories its config declares. A '
    + 'lookup that translated those two and left the rest in English would be worse than the '
    + 'untranslated cell this screen ships. Any OTHER unplaced cap. key is a sentence of the '
    + 'design of record that silently does not render.');
});

test('notGoverning is served AND drawn, through cap.notgov and nothing else', async () => {
  // `/api/capture` counts the scope-matched items the governing filter removed
  // and serves the number precisely because dropping them silently is what
  // `INV-nothing-is-dropped-silently` forbids.
  //
  // **This test used to assert the OPPOSITE, and said so in its own words:**
  // *"the day a key arrives, THIS is the test that goes red and says so."* It
  // did. `cap.notgov` landed on 2026-08-30, once the reason for the absence —
  // "`strings-parity.test.ts` fails in both directions" — was read against the
  // gate instead of quoted from memory. It fails in ONE direction, and has
  // since 2026-08-26.
  assert.ok(CODE.includes('notGoverning'),
    'notGoverning no longer reaches the DOM. It is served, it is a fact about the answer this '
    + 'screen just drew, and dropping it silently is the thing the endpoint carries it to stop');
  assert.ok(CODE.includes("ctx.t('cap.notgov'"),
    'the count is drawn without cap.notgov — a bare digit with no label is not a fact, and an '
    + 'English sentence invented at the call site is not translated');
  const en = await table('en');
  assert.ok('cap.notgov' in en, 'cap.notgov is drawn and not declared');
});

test('no translated string is assigned — t() returns nodes and they are appended (ruling A1)', () => {
  // `t()` returns Node[]. Assigning one to `textContent` renders `[object
  // Object]`; assigning `tFlat()` to `innerHTML` would destroy the `.m` spans
  // that carry the direction isolation, which is the mockup's own standing
  // rule. Neither is reachable by any other test: this module's DOM half is
  // never evaluated.
  assert.ok(!/textContent\s*=\s*ctx\.t/.test(source),
    'a translated value is assigned to textContent');
  assert.ok(!/innerHTML/.test(source), 'innerHTML has no legitimate use in a screen module');
  assert.ok(/\.append\(\.\.\.ctx\.t\(/.test(source),
    'the screen appends no translated nodes at all — the scan above is checking nothing');
});

test('the screen invents exactly one class the mockup\'s capture section does not draw', () => {
  const section = mockupSection();
  const drawn = new Set<string>();
  for (const m of section.matchAll(/class="([^"]+)"/g)) {
    for (const token of m[1]!.trim().split(/\s+/)) drawn.add(token);
  }
  assert.ok(drawn.size >= 9, `the mockup scan found ${drawn.size} class token(s) — too few to be `
    + 'the capture section, so the extraction is broken rather than the screen clean');

  const written: string[] = [];
  for (const m of CODE.matchAll(/\bel\('[a-z0-9]+',\s*'([^']*)'/g)) written.push(m[1]!);
  // SEVEN since seq:6c: `cmdnote` went with `cap.warn`, and it had exactly one
  // author in this file and one rule in each stylesheet, so nothing else lost a
  // class when it left.
  assert.ok(written.length >= 7,
    `the capture.js scan found ${written.length} class string(s); the screen writes at least seven`);

  // The ONE deliberate invention, named here so a second one cannot arrive
  // quietly. `.globin` is the Composer's glob input, and a scope pattern is the
  // same kind of value typed into the same kind of box — but the mockup's
  // capture section has no input at all, so this belongs in the KNOWN_GAPS
  // ledger in the direction that names what this screen draws and the design of
  // record does not.
  const INVENTED = new Set(['globin']);
  // `allowed` is the mockup's classes UNION what styles.css styles — see
  // test/helpers/shipped-classes.ts. The app is what gets built now, so a new
  // class with a real rule is ordinary development; a typo has no rule
  // anywhere and still lands in `offenders`. `INVENTED` stays because it
  // records a DECISION about this screen rather than a styling fact.
  const allowed = allowedClasses(drawn);
  const offenders: string[] = [];
  for (const value of written) {
    for (const token of value.trim().split(/\s+/)) {
      if (!allowed.has(token) && !INVENTED.has(token)) offenders.push(token);
    }
  }
  assert.deepEqual(offenders, [],
    'capture.js writes these classes, which <section data-p="capture"> never uses and this file '
    + 'does not name as deliberate. A class the design of record does not draw is either a typo '
    + 'or a decision the owner has not taken.');

  // And the allowlist may not go stale: a class named as invented and then not
  // written is a note about a screen that no longer exists.
  const tokens = new Set(written.flatMap((value) => value.trim().split(/\s+/)));
  for (const invented of INVENTED) {
    assert.ok(tokens.has(invented), `${invented} is allowed for and never written`);
  }

  // The composite the card turns on, pinned as a whole attribute value rather
  // than as two loose tokens: a `div` that took `card` and `pane` separately
  // would satisfy the token check above and draw the wrong thing.
  assert.ok(section.includes('class="card pane"'),
    'the mockup no longer draws class="card pane" — the design of record moved');
  assert.ok(written.includes('card pane'), 'capture.js no longer writes the "card pane" pair');
});

test('the screen invents exactly four TAGS the mockup\'s capture section does not draw', () => {
  const section = mockupSection();
  const drawn = new Set<string>();
  for (const m of section.matchAll(/<([a-z0-9]+)[\s>]/g)) drawn.add(m[1]!);
  assert.ok(drawn.has('table') && drawn.has('code') && drawn.has('button'),
    'the mockup tag scan missed elements the capture section certainly has — it is broken');

  const built = new Set<string>();
  for (const m of CODE.matchAll(/\bel\('([a-z0-9]+)'/g)) built.add(m[1]!);
  for (const m of CODE.matchAll(/document\.createElement\('([a-z0-9]+)'\)/g)) built.add(m[1]!);
  assert.ok(built.size >= 10,
    `the capture.js tag scan found ${built.size} tag(s) — too few to be this screen`);

  // The four controls the mockup does not have, and the reason is in the
  // module's header: the design of record draws a scope, a category, a title
  // and a severity as SAMPLE VALUES, and a running screen has to get them from
  // somewhere. The router cannot carry them and no endpoint serves them.
  const INVENTED = new Set(['label', 'input', 'select', 'option']);
  assert.deepEqual([...built].filter((tag) => !drawn.has(tag) && !INVENTED.has(tag)).sort(), [],
    'capture.js builds these element kinds, which <section data-p="capture"> never draws and '
    + 'this file does not name as deliberate');
  for (const invented of INVENTED) {
    assert.ok(built.has(invented), `${invented} is allowed for and never built`);
  }
});

test('the mockup\'s <b> inside cap.nosim cannot be rebuilt, and the string table is why', async () => {
  const en = await table('en');
  const he = await table('he');
  // The section draws `<b>scope matches</b>`. Neither table carries markup and
  // `t()` builds only `{m:…}`, `{mv:…}` and `{name}` runs, so there is no bold
  // run for a screen to append. `preview.carried` loses a `<b>` pair the same
  // way. It belongs in KNOWN_GAPS as `b`, and the cause is one layer down.
  assert.ok(mockupSection().includes('<b>scope matches</b>'),
    'the mockup no longer emphasises "scope matches" — this gap may have closed');
  for (const template of [en['cap.nosim']!, he['cap.nosim']!]) {
    assert.ok(!template.includes('<b>'),
      'cap.nosim now carries markup, which t() would render as literal text — the gap did not '
      + 'close, it moved');
  }
});
