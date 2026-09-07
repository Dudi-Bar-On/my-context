/**
 * **THE BUILDER — `src/ui/public/lib/builder.js`, the one set of command inputs
 * every command site in this UI draws.**
 *
 * `TASK-one-builder-component-rendered-from-a-catalogue-entry` (plan:builder
 * seq:5) and `TASK-draw-the-builder-once-in-the-mockup-as-the-pattern-every`
 * (plan:walk seq:20) are one piece of work. This file holds the four clauses
 * they name, and it holds them where the component is rather than where a
 * screen happens to call it — which is the point of there being a component:
 * `test/ui/capture-screen.test.ts` and `test/ui/palette-screen.test.ts` each
 * scan THEIR OWN screen's bytes, so a rule that lives in `lib/` is invisible to
 * both and would otherwise be asserted nowhere at all.
 *
 * ── WHAT IS DERIVED HERE, AND WHY THAT MATTERS FOR ONE FIELD IN PARTICULAR ─
 *
 * `spec.format` is the FORMAT a free-text field carries into its placeholder —
 * owner instruction 2026-08-24, *"a grayed out hint in the fields as
 * placeholder before user enter values"*. It is the one thing this component
 * renders that nothing else can check: `commandFor` never reads it,
 * `src/ui/execute-catalogue.ts` never reads it, so a wrong format composes
 * nothing and runs nothing. It MISINFORMS, silently, in the one place a reader
 * looks to find out what shape a value takes.
 *
 * So it is derived from the CLI, the way every other claim in the catalogue is
 * (`test/ui/palette-lib.test.ts`): a throwaway workspace, the real command run
 * with no arguments, and the usage block it prints scanned for the format
 * string. A format the command does not document fails here.
 *
 * ── WHAT THIS FILE CANNOT DO ──────────────────────────────────────────────
 *
 * It cannot render. `controlFor` builds real DOM and there is no document in
 * `node --test`; the browser half is `e2e/composer-suggest.spec.ts`,
 * `e2e/config-composer.spec.ts` and the screenshots taken under this task. What
 * is checked below is everything the module answers WITHOUT a document, plus
 * the two properties that are about its bytes: which keys it names, and that it
 * is the only place a `.cmd` row and a Copy control are built.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const BUILDER_JS = path.join(PUBLIC, 'lib', 'builder.js');
const SOURCE = readFileSync(BUILDER_JS, 'utf8');

interface ArgSpec {
  name: string;
  input?: string;
  source?: string;
  options?: string[];
  required?: boolean;
  boolean?: boolean;
  format?: string;
}
interface PaletteDef { name: string; base: string[]; args: ArgSpec[]; flags: ArgSpec[] }

interface BuilderModule {
  ABSENT: string;
  controlSpecs: (def: PaletteDef) => ArgSpec[];
  missingRequired: (defOrSpecs: PaletteDef | ArgSpec[], values: Record<string, unknown>) => string[];
  pickerOptions: (spec: ArgSpec, sources: Record<string, { value: string; label: string }[]>)
    => { value: string; label: string }[] | null;
  suggestListId: (name: string) => string;
  formatOf: (spec: ArgSpec) => string | null;
  UNSCOPED_GLOB: string;
  valueOf: (control: { value?: string; checked?: boolean }, spec: ArgSpec) => unknown;
  readValues: (controls: Map<string, { control: { value?: string; checked?: boolean }; spec: ArgSpec }>)
    => Record<string, unknown>;
}

const publicUrl = (relative: string): string =>
  pathToFileURL(path.join(PUBLIC, relative)).href;

const builder = async (): Promise<BuilderModule> =>
  (await import(publicUrl('lib/builder.js'))) as BuilderModule;
const defs = async (): Promise<{ PALETTE: PaletteDef[] }> =>
  (await import(publicUrl('lib/palette-defs.js'))) as { PALETTE: PaletteDef[] };

async function table(language: string): Promise<Record<string, string>> {
  const file = path.join(PUBLIC, 'strings', `${language}.js`);
  const mod = await import(pathToFileURL(file).href) as { strings: Record<string, string> };
  return mod.strings;
}

/* -------------------------------------------------------------------------- *
 * The module's shape: relative specifiers, and the one command area.
 * -------------------------------------------------------------------------- */

/**
 * A `lib/` module is loaded by the browser from `/lib/…` and by Node from a
 * file URL, and a ROOT-ABSOLUTE specifier works in the first and not the
 * second. `lib/command-actions.js` and `lib/viewmodel.js` already use relative
 * specifiers for exactly this reason, and this test is what keeps a later edit
 * from writing `/lib/command.js` here and breaking every screen test that
 * imports this module transitively.
 */
test('the builder imports relatively, the way a lib module must', () => {
  const specifiers = [...SOURCE.matchAll(/from '([^']+)'/g)].map((m) => m[1]!);
  assert.ok(specifiers.length > 0, 'the builder imports nothing — the scan is on the wrong file');
  assert.deepEqual(
    specifiers.filter((s) => s.startsWith('/')), [],
    'a root-absolute specifier in lib/ resolves against the drive root under Node',
  );
  assert.deepEqual(
    specifiers.sort(),
    ['../screens/parts.js', './command-actions.js', './command.js', './disclosure.js'],
    'the builder composes through the one quoting module and draws through the one '
    + 'Copy-and-Execute control; a fifth import here is a new coupling to argue for',
  );
});

/**
 * **ONE command area in the product, and this is it.** The whole of what
 * plan:builder seq:5 asks for is that a command site stops inventing its own
 * row of inputs, and the measurable half of that is that no SCREEN builds a
 * `.cmd` row or reaches the Copy control directly any more.
 *
 * Screens outside the builder's population are named rather than exempted: they
 * compose a command from data they already hold and draw no form at all, which
 * is a different job from the one this component does. The list is what stops
 * this test passing vacuously the day somebody adds a twelfth hand-rolled one.
 */
test('the two form-drawing screens draw their command area through the builder', () => {
  const screens = path.join(PUBLIC, 'screens');
  for (const name of ['capture.js', 'palette.js']) {
    const code = readFileSync(path.join(screens, name), 'utf8');
    assert.ok(code.includes("from '/lib/builder.js'"), `${name} does not import the builder`);
    assert.ok(/paintCommand\(/.test(code), `${name} does not paint its command area with it`);
    assert.ok(!code.includes("from '/lib/command-actions.js'"),
      `${name} reaches the Copy-and-Execute control directly as well as through the builder`);
    assert.ok(!/el\('div', 'cmd'\)/.test(code),
      `${name} still builds its own .cmd row`);
  }
  // And the builder is where those two things actually happen.
  assert.ok(/el\('div', 'cmd'\)/.test(SOURCE), 'the builder builds no .cmd row');
  assert.ok(/commandActions\(/.test(SOURCE), 'the builder draws no Copy-and-Execute control');
});

/* -------------------------------------------------------------------------- *
 * The strings the component names — the check no screen test can make.
 * -------------------------------------------------------------------------- */

test('every string key the builder names is declared in both tables', async () => {
  const named = [
    ...[...SOURCE.matchAll(/ctx\.t(?:Flat)?\('([^']+)'/g)].map((m) => m[1]!),
    // **A KEY HANDED TO `helpDisclosure` IS A KEY THIS MODULE NAMES.** The
    // scan above reads `ctx.t(…)` call sites and would have missed the
    // disclosure's summary entirely — `lib/disclosure.js` is what calls `t()`
    // with it, so the key would be asserted in neither file. Found by this
    // test failing on `bld.help` the first time it was run against seq 8.
    ...[...SOURCE.matchAll(/helpDisclosure\(ctx, '([^']+)'/g)].map((m) => m[1]!),
  ];
  assert.deepEqual([...new Set(named)].sort(), [
    // seq 5 — the two the component started with.
    'bld.incomplete', 'bld.noopts',
    // seq 6 — the CLI's own verdict, and the field it names.
    'bld.checked', 'bld.checking', 'bld.refused', 'bld.refusedhere', 'bld.uncheckable',
    // seq 8 — the connectives of the "what is legal" disclosure. Its CONTENT is
    // the server's; these are the words between the facts.
    'bld.help', 'bld.helpnone', 'bld.hformat', 'bld.hgroup', 'bld.hone', 'bld.hopen',
    'bld.hshape', 'bld.hsource', 'bld.hswitch',
    // seq 17 — the chosen value, read back under its own box.
    'bld.picked',
  ].sort(),
  'the builder names a different set of keys than the ones it is documented to own');
  const en = await table('en');
  const he = await table('he');
  for (const key of named) {
    assert.ok(key in en, `${key} is drawn and missing from en.js`);
    assert.ok(key in he, `${key} is drawn and missing from he.js`);
  }
  // `pal.incomplete` was this sentence when only the Composer said it. A key
  // left behind in the tables is a sentence the next screen can pick up without
  // re-taking the decision that moved it — the same reason `cap.warn` had to be
  // deleted rather than merely stopped being used.
  assert.equal(en['pal.incomplete'], undefined,
    'pal.incomplete survives in en.js after moving to bld.incomplete');
  assert.equal(he['pal.incomplete'], undefined,
    'pal.incomplete survives in he.js after moving to bld.incomplete');
  // `bld.noopts` names the field it is about, and it must do so as an ISOLATED
  // machine value: a CLI argument name inside a Hebrew sentence reorders around
  // its punctuation without it.
  assert.ok(en['bld.noopts']!.includes('{mv:field}'), 'bld.noopts does not isolate the field name');
  assert.ok(he['bld.noopts']!.includes('{mv:field}'), 'the Hebrew bld.noopts drops the isolation');
});

/* -------------------------------------------------------------------------- *
 * Clause 1: a closed vocabulary is a select, and an empty one is disabled.
 * -------------------------------------------------------------------------- */

test('pickerOptions decides which fields are a select at all', async () => {
  const { pickerOptions } = await builder();
  const sources = { categories: [{ value: 'rule', label: 'rule' }], drafts: [] };
  assert.deepEqual(pickerOptions({ name: 'category', source: 'categories' }, sources),
    [{ value: 'rule', label: 'rule' }]);
  assert.deepEqual(pickerOptions({ name: 'severity', options: ['hard', 'soft'] }, sources),
    [{ value: 'hard', label: 'hard' }, { value: 'soft', label: 'soft' }]);
  // A source the screen has nothing for is an EMPTY list, not "no picker" —
  // which is the distinction the disabled state is built on. `null` would draw
  // a free-text box for a field with a closed vocabulary.
  assert.deepEqual(pickerOptions({ name: 'id', source: 'drafts' }, sources), []);
  assert.deepEqual(pickerOptions({ name: 'id', source: 'nothing-fills-this' }, sources), []);
  assert.equal(pickerOptions({ name: 'title', input: 'text' }, sources), null);
  assert.equal(pickerOptions({ name: 'yes', boolean: true }, sources), null);
});

/**
 * The disabled state and its sentence are one decision, so the two conditions
 * must be the same condition. `emptyPickerNote` is asserted through the same
 * predicate `controlFor` disables on, because a picker disabled with no
 * sentence beside it is the silent refusal this component exists to replace.
 */
test('the disabled picker and its sentence answer to one condition', () => {
  assert.ok(/select\.disabled = picker\.length === 0;/.test(SOURCE),
    'controlFor no longer disables a picker with an empty vocabulary');
  assert.ok(/if \(picker === null \|\| picker\.length > 0\) return null;/.test(SOURCE),
    'emptyPickerNote no longer speaks for exactly the pickers controlFor disables');
  // A `suggest` box is exempt and the exemption is deliberate: its whole ruling
  // (owner D11, 2026-09-06) is that the box takes a value the list cannot know,
  // so disabling it would remove the escape hatch that is the reason it is a
  // box rather than a `<select>`.
  assert.ok(/if \(spec\.input === 'suggest'\) return null;/.test(SOURCE),
    'emptyPickerNote has stopped exempting a suggest box');
});

/* -------------------------------------------------------------------------- *
 * Clause 2: free text carries its FORMAT as a placeholder — derived.
 * -------------------------------------------------------------------------- */

test('formatOf answers only for a field that has a format, and never for a switch', async () => {
  const { formatOf } = await builder();
  assert.equal(formatOf({ name: 'extra', input: 'text', format: 'key=value' }), 'key=value');
  assert.equal(formatOf({ name: 'title', input: 'text' }), null);
  assert.equal(formatOf({ name: 'title', input: 'text', format: '' }), null);
  // A checkbox has no box to hint at. Declaring a format on one would be a
  // catalogue mistake, and this is the refusal rather than the mistake.
  assert.equal(formatOf({ name: 'yes', boolean: true, format: 'nonsense' }), null);
});

test('the placeholder is set from the format and never over a value', () => {
  assert.ok(/if \(format !== null && control\.value === ''\) control\.setAttribute\('placeholder', format\);/
    .test(SOURCE),
    'the builder sets a placeholder over a seeded value — a placeholder a reader can never '
    + 'see is a hint that is not there, and one drawn over a value is not a thing browsers draw');
});

/** A throwaway workspace and a `run` that never throws out of a test. */
function workspace(): { run: (argv: string[]) => string; dispose: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-builder-'));
  assert.equal(runCli(['init'], dir, () => {}), 0, 'the probe workspace did not initialize');
  const run = (argv: string[]): string => {
    const lines: string[] = [];
    try {
      runCli(argv, dir, (s) => lines.push(s));
    } catch (err) {
      lines.push(`THREW: ${(err as Error).message}`);
    }
    return lines.join('\n');
  };
  return { run, dispose: () => removeTree(dir) };
}

/**
 * **EVERY DECLARED FORMAT IS THE COMMAND'S OWN SPELLING OF IT.**
 *
 * The command is run with no arguments, which is what makes it print its usage
 * block, and the format string must appear there. That is the whole guarantee
 * this field has: nothing else reads it, so nothing else can catch it being
 * wrong.
 *
 * Anti-vacuity in two directions. The count must be a real one — a catalogue
 * that declared no formats at all would pass a loop over nothing — and the
 * probe must be able to FAIL, which the deliberate miss at the end proves
 * against the same usage text every real assertion reads.
 */
test('every format the catalogue declares appears in that command\'s own usage', async () => {
  const { PALETTE } = await defs();
  const ws = workspace();
  try {
    const declared = PALETTE.flatMap((def) =>
      [...def.args, ...def.flags]
        .filter((spec) => typeof spec.format === 'string')
        .map((spec) => ({ def, spec })));
    assert.ok(declared.length >= 12,
      `only ${declared.length} formats declared; the derivation below would be near-vacuous`);

    // One run per COMMAND, not per field: the usage block is the same text.
    //
    // The command is run BARE and again with a flag no command accepts, and
    // both outputs are read. Neither alone is enough: `mycontext add` with no
    // arguments prints its usage, while `mycontext focus` with none is a
    // perfectly good invocation that reports the focus in force and prints no
    // usage at all. `palette-lib.test.ts` uses the same sentinel against the
    // same parser for the same reason.
    const SENTINEL = '--zzz-not-a-flag-any-command-accepts';
    const usage = new Map<string, string>();
    const usageFor = (def: PaletteDef): string => {
      const key = def.base.join(' ');
      if (!usage.has(key)) {
        const rest = def.base.slice(1);
        usage.set(key, `${ws.run(rest)}
${ws.run([...rest, SENTINEL])}`);
      }
      return usage.get(key)!;
    };

    const wrong: string[] = [];
    for (const { def, spec } of declared) {
      if (!usageFor(def).includes(spec.format!)) {
        wrong.push(`${def.name} ${spec.name} -> ${spec.format}`);
      }
    }
    assert.deepEqual(wrong, [],
      'a declared format is not documented by the command it belongs to. The placeholder is the '
      + 'only thing this UI tells a reader about the SHAPE of a value, and a wrong one misinforms '
      + 'silently — nothing composes it and nothing runs it.');

    // The probe can fail: the same text, a format the command does not print.
    const sample = usageFor(PALETTE.find((d) => d.name === 'add')!);
    assert.ok(sample.length > 0, 'the usage probe returned nothing at all');
    assert.ok(!sample.includes('DD/MM/YYYY'),
      'the usage probe matches a format the command never documents');
  } finally {
    ws.dispose();
  }
});

/* -------------------------------------------------------------------------- *
 * Clause 3: a required field that is empty is visibly required.
 * -------------------------------------------------------------------------- */

test('missingRequired names the empty required inputs, from a def or from a spec list', async () => {
  const { missingRequired, controlSpecs } = await builder();
  const { PALETTE } = await defs();
  const add = PALETTE.find((d) => d.name === 'add')!;
  assert.deepEqual(missingRequired(add, {}), ['category', 'title']);
  assert.deepEqual(missingRequired(add, { category: 'rule' }), ['title']);
  assert.deepEqual(missingRequired(add, { category: 'rule', title: '' }), ['title']);
  assert.deepEqual(missingRequired(add, { category: 'rule', title: 'x' }), []);
  // The list form is what lets a screen require a field the catalogue does not
  // — Capture's `--scope`, optional to `mycontext add` and the whole question
  // on that screen.
  const specs = controlSpecs(add)
    .filter((s) => ['category', 'title', 'scope'].includes(s.name))
    .map((s) => ({ ...s, required: true }));
  assert.deepEqual(missingRequired(specs, { category: 'rule', title: 'x' }), ['scope']);
  assert.deepEqual(missingRequired(specs, { category: 'rule', title: 'x', scope: 'a/**' }), []);
});

/**
 * The mark is set on EVERY paint including the negative one. An attribute that
 * is only ever added is an attribute that never comes off once a reader fills
 * the box, which is worse than no mark: it says a correct field is wrong.
 */
test('markRequired writes the attribute in both directions', () => {
  assert.ok(/entry\.control\.setAttribute\('aria-invalid', String\(empty\.has\(name\)\)\);/
    .test(SOURCE),
    'markRequired no longer writes aria-invalid="false" for a required field that is filled');
});

/**
 * **And the attribute is now something a sighted reader can see**, which it was
 * not until this task: both screens set it and `styles.css` had no rule for it
 * at all, so the whole of "visibly required" was invisible.
 */
test('styles.css paints the empty-required mark', () => {
  const css = readFileSync(path.join(PUBLIC, 'styles.css'), 'utf8');
  assert.ok(/input\[aria-invalid="true"\]/.test(css),
    'aria-invalid is set by the builder and painted by nothing');
  assert.ok(/\[dir="rtl"\] input\[aria-invalid="true"\]/.test(css),
    'the inset mark does not flip side in RTL — an inset shadow has no logical spelling');
  assert.ok(/::placeholder\{color:currentColor;opacity:\.6\}/.test(css),
    'the format hint is not grayed — owner instruction 2026-08-24. It follows the box\'s own '
    + 'ink because this product draws free-text boxes on two different grounds, and a fixed '
    + 'token is legible on one of them and washed out on the other.');
});

/* -------------------------------------------------------------------------- *
 * Clause 4: the state of the Copy control while the command is incomplete.
 * -------------------------------------------------------------------------- */

/**
 * `commandFor` throws rather than composing a half-built command, so there is
 * no `.cmd` row and nothing to copy. What walk/20 asks is that the pattern
 * DRAW what that looks like rather than leaving each screen to decide — Capture
 * hid the row and said nothing, the Composer drew a sentence, and those were
 * two answers to one question.
 */
test('paintCommand draws the sentence instead of the row, and never both', () => {
  const body = SOURCE.slice(SOURCE.indexOf('export function paintCommand'));
  // The question is asked ONCE, as `composed === null`, and `missing` plus a
  // null argv are the two spellings that reach it — Capture passes both,
  // because `commandFor` throwing and `missingRequired` answering are the same
  // fact asked with and without the throw.
  assert.ok(/const composed = missing\.length > 0 \|\| !Array\.isArray\(argv\)/.test(body),
    'paintCommand no longer branches on the missing inputs');
  assert.ok(/if \(composed === null\) \{/.test(body), 'the incomplete branch is gone');
  const branch = body.slice(body.indexOf('if (composed === null)'));
  const returnAt = branch.indexOf('return null;');
  assert.ok(returnAt !== -1, 'the incomplete branch does not return');
  assert.ok(!branch.slice(0, returnAt).includes('commandActions'),
    'a Copy control is built on the path where the command does not exist');
  // And the host is emptied first, so a control from the previous keystroke
  // cannot survive beside a command it no longer belongs to.
  assert.ok(body.indexOf('host.replaceChildren();') < body.indexOf('if (composed === null)'),
    'paintCommand refills its host without emptying it');
});

/**
 * **AND THE ONE THING IT MUST NOT EMPTY**, added 2026-09-07 after a browser
 * found it: a host holding an OPEN confirm or an execution outcome.
 *
 * Until seq 6 every repaint here was caused by the reader's own keystroke, so
 * emptying could take nothing away that the keystroke had not already
 * invalidated. The check's verdict is the first repaint nobody asked for, and
 * it lands about `CHECK_DEBOUNCE_MS` after the last edit — exactly the window
 * in which a person fills the last field and presses Execute. `commandActions`
 * renders its confirm INLINE in this host, so `replaceChildren` deleted the
 * confirmation out from under them. Seven of `e2e/execute.spec.ts`'s tests
 * failed on it, and all seven passed again when the verdict was prevented from
 * landing mid-run.
 */
test('paintCommand leaves an open confirm standing when the line has not changed', () => {
  const body = SOURCE.slice(SOURCE.indexOf('export function paintCommand'));
  const guard = body.slice(0, body.indexOf('host.replaceChildren();'));
  assert.ok(guard.includes('.confirm:not([hidden]), .execresult:not([hidden])'),
    'the redraw guard does not look for an OPEN confirm — both nodes exist from the start and '
    + 'are `hidden` until they have something to say, so their PRESENCE proves nothing');
  assert.ok(guard.includes('standing.dataset.cmdkey === composed'),
    'the guard keeps a control built for a DIFFERENT line — `dataset.cmdkey` is '
    + 'commandActions\' own identity for a control and must be what decides');
  assert.ok(/!refused/.test(guard),
    'a line the CLI would refuse keeps its Execute button because a confirm was open over it');
});

/* -------------------------------------------------------------------------- *
 * plan:builder seq:6 — copy is refused until the command passes, and the
 * refusal is readable.
 * -------------------------------------------------------------------------- */

/**
 * **THE VERDICT SOURCE, DRIVEN.** `commandChecker` needs no document — it is a
 * state machine over one POST — so unlike everything else seq 6 added it can be
 * exercised here rather than only in a browser. `plan:builder seq:11` (D12)
 * declares this task a prerequisite and will assert the four states by name;
 * this is what makes them assertable without a page.
 *
 * The `ctx` below is a two-line fake and that is deliberate: what is under test
 * is WHEN the checker asks and WHICH answer it keeps, not what the endpoint
 * decides. `test/ui/command-check.test.ts` owns the second question and drives
 * the real argument parser to answer it.
 */
interface FakeCtx { post: (path: string, body: unknown) => Promise<unknown> }
interface Verdict { state: string; error?: string; flag?: string | null }
interface Checker { verdictFor: (argv: unknown) => Verdict | null; stop: () => void }
interface CheckerModule {
  commandChecker: (ctx: FakeCtx, onSettled: () => void) => Checker;
  CHECK_PENDING: string; CHECK_PASSED: string; CHECK_REFUSED: string; CHECK_UNREADABLE: string;
}
const checkerModule = async (): Promise<CheckerModule> =>
  (await import(publicUrl('lib/builder.js'))) as unknown as CheckerModule;

/** A promise that resolves the first time `onSettled` fires. */
function settledGate(): { promise: Promise<void>; fire: () => void } {
  let fire = (): void => {};
  const promise = new Promise<void>((resolve) => { fire = () => resolve(); });
  return { promise, fire };
}

test('the checker holds the line pending, then keeps the verdict for that exact argv', async () => {
  const { commandChecker, CHECK_PENDING, CHECK_PASSED } = await checkerModule();
  const asked: { path: string; body: unknown }[] = [];
  const done = settledGate();
  const checker = commandChecker({
    post: async (path, body) => {
      asked.push({ path, body });
      return { ok: true, command: 'pin', unchecked: ['arity'] };
    },
  }, done.fire);
  const argv = ['mycontext', 'pin', 'ITEM-x'];
  assert.equal(checker.verdictFor(argv)!.state, CHECK_PENDING,
    'a line nobody has asked about is PENDING — and pending holds the Copy control, because '
    + '"not yet" and "no" are both "not passed"');
  // `assert.equal` on the LENGTH and not `deepEqual(asked, [])`: node's
  // `deepStrictEqual` is declared `asserts actual is T`, so comparing against a
  // literal `[]` narrows `asked` to `never[]` for the rest of the function and
  // every read below it stops typechecking.
  assert.equal(asked.length, 0,
    'the checker asked before its debounce elapsed, so every keystroke is a round trip');
  await done.promise;
  assert.equal(asked.length, 1, 'one settled line, one request');
  assert.equal(asked[0]!.path, '/api/command/check');
  assert.deepEqual((asked[0]!.body as { argv: string[] }).argv, argv,
    'the checker sends something other than the composed argv, leading `mycontext` included — '
    + 'the endpoint requires the whole line and refuses the arguments alone');
  assert.equal(checker.verdictFor(argv)!.state, CHECK_PASSED);
  // Re-reading a settled line must not ask again: `recompose()` runs on every
  // keystroke and `paintCommand` reads the verdict on every paint.
  checker.verdictFor(argv);
  checker.verdictFor(argv);
  assert.equal(asked.length, 1, 'a settled line is asked about again on every paint');
  checker.stop();
});

test('a refusal keeps the CLI own words and the flag it names; a failed read does not', async () => {
  const { commandChecker, CHECK_REFUSED, CHECK_UNREADABLE } = await checkerModule();
  const no = settledGate();
  const refusing = commandChecker({
    post: async () => ({
      ok: false, command: 'ack', code: 'unknown-option', flag: 'finding',
      error: 'my_context: unknown option "--finding".',
    }),
  }, no.fire);
  refusing.verdictFor(['mycontext', 'ack', 'x']);
  await no.promise;
  const verdict = refusing.verdictFor(['mycontext', 'ack', 'x'])!;
  assert.equal(verdict.state, CHECK_REFUSED);
  // The CLI's sentence, unedited. A second wording composed for the browser
  // would waste what this project has spent on the first — seq 4's argument.
  assert.equal(verdict.error, 'my_context: unknown option "--finding".');
  // The flag is what makes "next to the field that caused it" DETERMINABLE
  // rather than guessed: it is the key `controls` is built under.
  assert.equal(verdict.flag, 'finding');
  refusing.stop();

  const oops = settledGate();
  const broken = commandChecker({
    post: async () => { throw new Error('the server refused this read'); },
  }, oops.fire);
  broken.verdictFor(['mycontext', 'pin', 'x']);
  await oops.promise;
  const failed = broken.verdictFor(['mycontext', 'pin', 'x'])!;
  assert.equal(failed.state, CHECK_UNREADABLE,
    'a check that could not be MADE is reported as a refusal of the line — which would refuse '
    + 'a reader their own composed command for this app own failure, with no unblocking '
    + 'condition they could act on');
  assert.equal(failed.error, 'the server refused this read');
  broken.stop();
});

test('an answer overtaken by a keystroke is dropped rather than painted', async () => {
  const { commandChecker, CHECK_PENDING } = await checkerModule();
  let settles = 0;
  const checker = commandChecker({
    post: async (_path, body) => ({ ok: true, command: (body as { argv: string[] }).argv[1] }),
  }, () => { settles += 1; });
  checker.verdictFor(['mycontext', 'pin', 'a']);
  // Before the debounce elapses the form moves on, so the first line is never
  // sent at all and the second is the only question asked.
  checker.verdictFor(['mycontext', 'pin', 'ab']);
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(settles, 1, 'two round trips for one settled line');
  assert.equal(checker.verdictFor(['mycontext', 'pin', 'a'])!.state, CHECK_PENDING,
    'the verdict for the newer line was handed back for the older one');
  checker.stop();
});

/**
 * **A REFUSED LINE GETS NO `.cmdactions` AT ALL, EXECUTE INCLUDED.**
 *
 * `copyBlocked` disables Copy alone and is right to: that flag is about a SAFE
 * line spelled dangerously (`$(…)` substitutes in a shell and is an ordinary
 * literal to `execFile`). A verdict of "the CLI would refuse this" is a
 * different fact, and an Execute button beside it would offer a control whose
 * only possible outcome is the same refusal from further away.
 */
test('the refused branch draws the line, the reason, and neither control', () => {
  const body = SOURCE.slice(SOURCE.indexOf('export function paintCommand'));
  assert.ok(body.includes('check.state === CHECK_REFUSED'),
    'paintCommand no longer branches on the CLI own verdict');
  const at = body.indexOf('if (refused) {');
  assert.ok(at !== -1, 'the refused branch is gone');
  const branch = body.slice(at, body.indexOf('return null;', at));
  assert.ok(branch.includes("ctx.t('bld.refused')"), 'the refusal is drawn without its sentence');
  assert.ok(branch.includes('foreignRun(check.error)'),
    'the CLI own words are drawn without dir="auto" — an English refusal inside a Hebrew '
    + 'paragraph lays its full stop at the wrong end, measured on this product on 2026-09-07');
  assert.ok(!branch.includes('commandActions'),
    'a Copy or Execute control is built for a line the parser says the CLI would refuse');
  // And the composed line itself is still on screen above it: a reader owed a
  // reason is owed the line the reason is about.
  assert.ok(body.indexOf("el('div', 'cmd')") < at,
    'the refusal is drawn instead of the composed line rather than under it');
});

/**
 * The endpoint own header asks for this in as many words: *"a checker that
 * answers `ok: true` without saying what it looked at invites the caller to
 * read it as 'this command will do what the form says' … an over-read `true`
 * is worse than a refusal."*
 */
test('a passed line still says what the check could not cover', async () => {
  const en = await table('en');
  assert.match(en['bld.checked']!, /VALUE/,
    'bld.checked no longer names the thing the parser cannot decide, so a green Copy button '
    + 'reads as a promise about the whole command');
});

/* -------------------------------------------------------------------------- *
 * plan:builder seq:8 — what is legal, without leaving the screen.
 * -------------------------------------------------------------------------- */

/**
 * **NOT A THIRD DESCRIPTION.** The item binding warning is that a description
 * of these commands written in the browser is *"precisely the drift this plan
 * is about"*. So the disclosure CONTENT must come off the wire, and the module
 * must contain no command name, no flag name and no note.
 *
 * Checked as the absence of the one thing that would betray it: a string
 * literal inside `commandHelp` that is neither a `bld.` key nor an element
 * name. Everything else it draws is `help.what`, `view.values`, `view.format`,
 * `view.example`, `view.note` and `worked.command` — every one a field of
 * `GET /api/cli-help/command/:id`.
 */
test('the help disclosure spells no command, flag or note of its own', () => {
  const from = SOURCE.indexOf('export function commandHelp');
  assert.ok(from !== -1, 'commandHelp is gone');
  const end = SOURCE.indexOf('\n}', SOURCE.indexOf('return helpDisclosure(ctx, \'bld.help\', body, { example })', from));
  // **Comments are stripped before the scan, and the first run of this test is
  // why.** A prose apostrophe — "the CLI's own words" — opens a quote as far as
  // a regex is concerned, so scanning the raw slice reported half the
  // function's own reasoning as string literals. What is under test is what the
  // function BUILDS, not what it explains.
  const body = SOURCE.slice(from, end)
    .split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
  // Element names, the `typeof` it compares against, and PUNCTUATION: the em
  // dash between a field's name and what it takes, the space before a note, the
  // comma that joins a vocabulary, and the empty string every "has it got one"
  // test compares to. None of them says anything about a command.
  const allowed = new Set(['p', 'b', 'aside', 'code', 'm', 'string', ' — ', ' ', ', ', '']);
  const literals = [...body.matchAll(/'([^']*)'/g)].map((m) => m[1]!)
    .filter((s) => !s.startsWith('bld.') && !allowed.has(s));
  assert.deepEqual(literals, [],
    'commandHelp carries a string that is neither a string-table key nor an element name — '
    + 'which is how a third description of these commands starts');
  for (const field of [
    'help.what', 'help.flags', 'help.subcommands', 'help.worked',
    'view?.values', 'view?.source', 'view?.format', 'view?.example', 'view?.note',
    'view?.takesValue', 'view?.group', 'worked.command',
  ]) {
    assert.ok(SOURCE.includes(field),
      `${field} is no longer read — the disclosure has stopped rendering part of the record`);
  }
});

/**
 * Both command sites ask for the SAME record and neither builds a help card of
 * its own. The Library `screens/cli-help.js` renders that endpoint at full
 * length; what must not happen is a third renderer with a fourth wording.
 */
test('both command sites draw their help through the builder, off one endpoint', () => {
  const screens = path.join(PUBLIC, 'screens');
  for (const name of ['capture.js', 'palette.js']) {
    const code = readFileSync(path.join(screens, name), 'utf8');
    assert.ok(/commandHelp\(/.test(code), `${name} draws no "what is legal" disclosure`);
    assert.ok(/\/api\/cli-help\/command\//.test(code),
      `${name} fills its disclosure from something other than the command-help endpoint`);
    assert.ok(!/helpDisclosure\(/.test(code),
      `${name} builds a help disclosure of its own beside the builder one`);
  }
});

/* -------------------------------------------------------------------------- *
 * plan:builder seq:17 — the chosen value, read back at full width.
 * -------------------------------------------------------------------------- */

/**
 * **THE BOX IS NOT WIDENED**, and that is the owner ruling of 2026-09-07 rather
 * than a preference. This screen has been broken twice by a control wider than
 * its column — a 942-option `<select>` at 3,902px and a 600-character example
 * line at 1,325px of overflow — so a later edit that "fixes" the id box by
 * widening it undoes the ruling silently. The cap is asserted here rather than
 * only argued in a comment.
 */
test('the echo is a full-width paragraph and the suggest box keeps its cap', () => {
  const css = readFileSync(path.join(PUBLIC, 'styles.css'), 'utf8');
  assert.match(css, /\.card \.suggin\{inline-size:min\(320px,100%\);min-inline-size:0\}/,
    'the suggest box was widened — the owner ruled that the value is echoed UNDER the control '
    + 'instead, because a 615px box on a card that also holds a two-column form is the third '
    + 'attempt at a defect this screen has already been broken by twice');
  assert.match(css, /\.sugecho\{[^}]*inline-size:100%/, 'the echo is not full width');
  assert.match(css, /\.sugecho\{[^}]*overflow-wrap:anywhere/,
    'a 67-character id in the echo can push the card wider instead of wrapping');
  // `--ink` and not `--dim`: this is the value itself, among notes ABOUT it.
  assert.match(css, /\.sugecho\{[^}]*color:var\(--ink\)/,
    'the echo is drawn in the dim register the notes around it use, so the answer reads as '
    + 'quieter than the questions it sits between');
});

/**
 * The echo carries the id as `{mv:…}` — mono, LTR and bidi-ISOLATED — because
 * an id inside a Hebrew paragraph reorders around its own punctuation
 * otherwise, and the TITLE beside it in a `<bdi>`, because a title is corpus
 * text whose language this app did not choose.
 */
test('the echo isolates the id and infers the direction of the title', async () => {
  const en = await table('en');
  const he = await table('he');
  assert.ok(en['bld.picked']!.includes('{mv:value}'), 'bld.picked does not isolate the value');
  assert.ok(he['bld.picked']!.includes('{mv:value}'), 'the Hebrew bld.picked drops the isolation');
  const from = SOURCE.indexOf('export function paintEcho');
  const body = SOURCE.slice(from, SOURCE.indexOf('\n}', from));
  assert.ok(body.includes("createElement('bdi')"),
    'the item title is appended without a <bdi>, so a Hebrew title renders inside an LTR run');
  assert.ok(/node\.hidden = true/.test(body),
    'an empty box still draws an echo — a paragraph reading "Chosen:" with nothing after it');
});

/**
 * **A GLOB OF `**` IS NO SCOPE, and this is the unit half of a defect that was
 * only visible by running the command.**
 *
 * `screens/palette.js` seeds the glob tester with `EVERY_FILE` so the screen
 * arrives showing a lit tree, and until 2026-09-07 that seeded value flowed
 * into `--scope` on every entry that carries a glob field. Measured by
 * executing every runnable write (`plan:builder seq:11`), TWO of them could not
 * be run from the screen's own opening state at all, and both refusals are the
 * CLI being right:
 *
 *     mycontext focus --clear --scope "**"      → "--clear takes no axes"
 *     mycontext lesson-accept <id> <key> --scope "**"
 *                                               → "scope glob \"**\" matches the
 *                                                  whole repository, which is
 *                                                  what omitting scope already
 *                                                  does"
 *
 * The second refusal is also the ARGUMENT for the rule: the product itself says
 * a bare `**` and an omitted `--scope` mean the same thing, so `valueOf` reads
 * it as the omission. The browser half is `e2e/composer-write-execute.spec.ts`,
 * which puts the box back to `**` before `focus --clear` and could not reach
 * `Run it` without this.
 */
test('a glob control holding the universal pattern composes no value at all', async () => {
  const { UNSCOPED_GLOB, valueOf, readValues } = await builder();
  const glob: ArgSpec = { name: 'scope', input: 'glob' };
  const text: ArgSpec = { name: 'title', input: 'text' };

  assert.equal(UNSCOPED_GLOB, '**', 'the constant the tester opens on has moved');
  assert.equal(valueOf({ value: UNSCOPED_GLOB }, glob), undefined,
    'the seeded universal pattern must read as no scope');
  assert.equal(valueOf({ value: `  ${UNSCOPED_GLOB}  ` }, glob), undefined,
    'and so must the same pattern with the whitespace a reader leaves around it');
  assert.equal(valueOf({ value: 'src/ui/**' }, glob), 'src/ui/**',
    'a REAL glob is still a value — the rule must not swallow the field');
  assert.equal(valueOf({ value: UNSCOPED_GLOB }, text), UNSCOPED_GLOB,
    'the rule is about `input: "glob"` only; a text box holding "**" is a value');

  const controls = new Map([
    ['scope', { control: { value: UNSCOPED_GLOB }, spec: glob }],
    ['title', { control: { value: 'Two words' }, spec: text }],
  ]);
  assert.deepEqual(readValues(controls), { title: 'Two words' },
    'the bag the browser composes from AND sends to /api/execute must agree, so the rule '
    + 'belongs in the one place a form is read');
});

/**
 * The screen re-exports the builder's constant rather than spelling `'**'` a
 * second time. Two copies of this string would let the tester open on one
 * pattern while `valueOf` treated a different one as the omission, which is the
 * silent half of the defect above.
 */
test('the palette screen takes its universal pattern FROM the builder', async () => {
  const screenSource = readFileSync(path.join(PUBLIC, 'screens', 'palette.js'), 'utf8');
  assert.match(screenSource, /export const EVERY_FILE = UNSCOPED_GLOB;/,
    'EVERY_FILE is spelled independently again — the tester\'s seed and the pattern `valueOf` '
    + 'reads as "no scope" must be one string');
  assert.match(screenSource, /UNSCOPED_GLOB,?\s*\n?\s*\}\s*from\s*'\/lib\/builder\.js'/,
    'and it must be imported from the builder rather than redeclared');
});
