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
    ['../screens/parts.js', './command-actions.js', './command.js'],
    'the builder composes through the one quoting module and draws through the one '
    + 'Copy-and-Execute control; a fourth import here is a new coupling to argue for',
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
  const named = [...SOURCE.matchAll(/ctx\.t(?:Flat)?\('([^']+)'/g)].map((m) => m[1]!);
  assert.deepEqual([...new Set(named)].sort(), ['bld.incomplete', 'bld.noopts'],
    'the builder names a different set of keys than the two it is documented to own');
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
  assert.ok(/if \(missing\.length > 0\) \{/.test(body),
    'paintCommand no longer branches on the missing inputs');
  const branch = body.slice(body.indexOf('if (missing.length > 0)'));
  const returnAt = branch.indexOf('return null;');
  assert.ok(returnAt !== -1, 'the incomplete branch does not return');
  assert.ok(!branch.slice(0, returnAt).includes('commandActions'),
    'a Copy control is built on the path where the command does not exist');
  assert.ok(!branch.slice(0, returnAt).includes('composeCommand'),
    'a half-built command is composed on the path where commandFor would throw');
  // And the host is emptied first, so a control from the previous keystroke
  // cannot survive beside a command it no longer belongs to.
  assert.ok(body.indexOf('host.replaceChildren();') < body.indexOf('if (missing.length > 0)'),
    'paintCommand refills its host without emptying it');
});
