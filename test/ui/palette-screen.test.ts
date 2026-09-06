/**
 * The Composer screen's decidable half, tested in Node.
 *
 * **The limit is the plan's, stated rather than papered over** (spec §6, and
 * `test/ui/viewmodel.test.ts`' own header): the DOM rendering in
 * `screens/*.js` has no test — that needs a browser this project does not
 * depend on. So `render()` is not called here and nothing below asserts a
 * pixel. What IS decidable is everything `render()` asks before it touches the
 * document: which argv element blocks a copy, which controls a def offers,
 * which picker list fills them, and which files a glob pattern lights. Those
 * are exported from `screens/palette.js` for exactly this reason, and a green
 * run here verifies them and nothing more.
 *
 * Two more used to be on that list — "what running a read means, and which rows
 * a read's answer holds", which were `readTarget` and `resultRows`. Both were
 * the Run button and both are gone (2026-09-07,
 * `DEC-run-is-removed-execute-is-the-only-way-to-run-what-the`); the block
 * where their tests stood says what replaced them.
 *
 * ── HOW A NODE TEST IMPORTS A BROWSER SCREEN MODULE ───────────────────────
 *
 * `test/ui/palette-lib.test.ts` and `viewmodel.test.ts` load `lib/*.js` by
 * `file://` URL: a plain relative specifier runs green under `node --test` and
 * fails `npm run typecheck` with TS7016, because `allowJs` is off and
 * `tsconfig.json`'s `include` is `.ts` only
 * (`test/ui/palette-lib.test.ts` · `A URL specifier is what lets this` · ~13).
 * That trick alone is not enough HERE, and the difference is the whole reason
 * this loader is three lines longer than theirs.
 *
 * A screen module is not a leaf. `screens/palette.js` imports `/lib/command.js`,
 * `/lib/palette-defs.js` and `/screens/parts.js` — SERVER-ABSOLUTE specifiers,
 * which is what the browser resolves and what `ui/static.ts` serves. Node
 * resolves `/lib/command.js` against the filesystem root and fails. Rewriting
 * the file to use relative specifiers instead is not an option: the browser is
 * the customer, `import '/lib/command.js'` is what it must contain, and a test
 * that required the source to be written for the test would be the test
 * shaping the product.
 *
 * So the specifiers are rewritten IN MEMORY to absolute `file://` URLs and the
 * result is imported as a `data:` module. Every byte of logic is the shipped
 * byte; only the three specifier prefixes differ, and `importedSpecifiers`
 * below asserts that the rewrite actually found something, so a future rename
 * of `lib/` fails here rather than silently testing a module that imports
 * nothing. A `data:` URL rather than a temp file because thirteen other agents
 * share this checkout and a temp file is a shared resource; a data module can
 * only carry absolute specifiers, which is precisely what the rewrite produces.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { matchesAnyGlob } from '../../src/core/paths.ts';
import { UI_HELP_TOPICS } from '../../src/ui/read-model.ts';

const PUBLIC = path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public');

/** `src/ui/public/x/y.js` as the `file://` URL Node can resolve. */
const publicUrl = (rel: string): string =>
  new URL(`file://${path.join(PUBLIC, rel).replaceAll('\\', '/')}`).href;

/** The server-absolute specifiers a browser module under `public/` may carry. */
const SPECIFIER = /(['"])\/(lib|screens)\//g;

function importedSpecifiers(source: string): string[] {
  return [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]!);
}

/**
 * The two declared shapes: the module's own exports, and the catalogue entries
 * it reasons over. Hand-written rather than inferred, so this file states the
 * screen's published interface and a drift fails here instead of at a call
 * site in a module nobody type-checks. `PaletteDef` is deliberately looser
 * than `palette-defs.js`' real entries — a value bag is `Record<string,
 * unknown>` — because a test that had to know the exact value union could not
 * pass it a wrong one.
 */
interface ArgSpec {
  name: string;
  required?: boolean;
  boolean?: boolean;
  joined?: boolean;
  source?: string;
  options?: string[];
  input?: string;
  /**
   * The field whose value narrows THIS field's suggestion list — owner ruling
   * D11, 2026-09-06. One entry has it: `ack`'s `finding`, narrowed by the `id`
   * beside it, because `cmdAck` takes the codes doctor reports on that item as
   * the vocabulary and refuses every other.
   */
  dependsOn?: string;
}
interface PaletteDef {
  name: string;
  kind: 'read' | 'write';
  base: string[];
  args: ArgSpec[];
  flags: ArgSpec[];
  overlap?: boolean;
  boundary?: boolean;
  ungated?: boolean;
  /**
   * Whether the server will RUN it — owner ruling D2, 2026-09-06, and since
   * 2026-09-07 the ONLY licence there is. `screen` and `endpoint` stood beside
   * it here; they were the second run target and are removed from the catalogue
   * entirely. `test/ui/palette-lib.test.ts` owns keeping them out.
   */
  runnable?: boolean;
}
interface Option {
  value: string; label: string; revision?: string;
  /** What a `<datalist>` row shows beside the value — owner ruling D11. */
  hint?: string;
  /** The item a `finding` row belongs to, which is what `dependsOn` filters on. */
  item?: string;
}
interface Sources {
  items: Option[]; categories: Option[]; drafts: Option[];
  revisions: Option[]; topics: Option[];
  /** Served by `/api/meta` and `/api/items` — owner ruling D10, 2026-09-06. */
  statuses: Option[]; relations: Option[];
  [source: string]: Option[];
}
interface ScreenModule {
  EVERY_FILE: string;
  SHELL_ACTIVE: RegExp;
  shellUnsafe: (value: unknown) => boolean;
  argvChips: (argv: string[]) => { value: string; unsafe: boolean }[];
  copyBlocked: (argv: string[]) => boolean;
  controlSpecs: (def: PaletteDef) => ArgSpec[];
  offeredFlagNames: (def: PaletteDef) => string[];
  missingRequired: (def: PaletteDef, values: Record<string, unknown>) => string[];
  pickerOptions: (spec: ArgSpec, sources: Sources) => Option[] | null;
  /** The same list, narrowed by whatever `spec.dependsOn` names — D11. */
  narrowedOptions: (spec: ArgSpec, sources: Sources, values: Record<string, unknown>)
    => Option[] | null;
  findingOptions: (body: unknown) => Option[];
  packOptions: (body: unknown) => Option[];
  suggestListId: (name: string) => string;
  sourceLists: (bodies: Record<string, unknown>) => Sources;
  revisionFor: (sources: Sources, itemId: string | undefined) => string | null;
  // `readTarget` and `resultRows` were exported here until 2026-09-07. Both
  // belonged to the Run button and went with it —
  // `DEC-run-is-removed-execute-is-the-only-way-to-run-what-the`.
  globRows: (files: string[], matched: string[]) => { path: string; hit: boolean }[];
  /** The `--tags` box, which is a LIST and therefore not a picker source. */
  tagsInValue: (value: unknown) => string[];
  joinTags: (tags: string[]) => string;
  withTag: (value: string, tag: string, on: boolean) => string;
  projectedAside: (vocabulary: unknown) => { prefixes: string; cmds: string } | null;
  render: unknown;
}
interface DefsModule { PALETTE: PaletteDef[]; commandFor: (def: PaletteDef, values: Record<string, unknown>) => string[] }
interface CommandModule { quoteArg: (value: string) => string; composeCommand: (argv: string[]) => string }

const SOURCE = readFileSync(path.join(PUBLIC, 'screens', 'palette.js'), 'utf8');

async function screen(): Promise<ScreenModule> {
  const rewritten = SOURCE.replace(SPECIFIER, (_m, quote: string, dir: string) =>
    `${quote}${publicUrl(dir)}/`);
  const url = `data:text/javascript;charset=utf-8;base64,${Buffer.from(rewritten, 'utf8').toString('base64')}`;
  return (await import(url)) as ScreenModule;
}

const defs = async (): Promise<DefsModule> =>
  (await import(publicUrl('lib/palette-defs.js'))) as DefsModule;
const command = async (): Promise<CommandModule> =>
  (await import(publicUrl('lib/command.js'))) as CommandModule;

/* ── the loader itself, before anything is trusted through it ────────────── */

test('the screen imports server-absolute specifiers, and the rewrite finds them', () => {
  const specifiers = importedSpecifiers(SOURCE);
  assert.ok(specifiers.length > 0, 'palette.js must import something — an empty import list means the scan is looking at the wrong file');
  const absolute = specifiers.filter((s) => s.startsWith('/'));
  assert.deepEqual(
    absolute.sort(),
    ['/lib/command-actions.js', '/lib/command.js', '/lib/palette-defs.js', '/screens/parts.js'],
    'the browser resolves these against the server root and ui/static.ts serves them; a relative ' +
    'specifier here would mean the module was reshaped for this test');
  // `/lib/command-actions.js` joined on 2026-08-27, when the Composer adopted the shared
  // Copy-and-Execute control. Its OWN imports are relative (`./command.js`, `./viewmodel.js`,
  // `../screens/parts.js`) and that is not an inconsistency: a module this test imports
  // through a `data:` URL can resolve a relative specifier and cannot resolve a root-absolute
  // one, so the shared library uses the form that works in a browser, in Node from a file URL,
  // and here. `lib/viewmodel.js` already does the same, for the same reason.
  // The rewrite must consume every one of them, or the data: import below
  // fails for a reason that reads as a missing file rather than a stale regex.
  const rewritten = SOURCE.replace(SPECIFIER, (_m, quote: string, dir: string) => `${quote}${publicUrl(dir)}/`);
  assert.deepEqual(importedSpecifiers(rewritten).filter((s) => s.startsWith('/')), []);
});

/* ── the copy refusal: pal.block's condition, and why quoting is not it ──── */

test('shellUnsafe catches every form a double-quoted word still expands', async () => {
  const { shellUnsafe } = await screen();
  for (const live of ['$(id)', '`id`', '${HOME}', '$HOME/keys', 'cost in $USD']) {
    assert.equal(shellUnsafe(live), true, `${live} is still live inside double quotes`);
  }
  for (const inert of ['RULE-x', 'src/**', 'a/**,b/**', 'two words', 'say "hi"', 'back\\slash', '50%']) {
    assert.equal(shellUnsafe(inert), false, `${inert} is inert once quoted`);
  }
  assert.equal(shellUnsafe(undefined), false);
  assert.equal(shellUnsafe(true), false);
});

/**
 * The reason the refusal exists at all, asserted against the real quoter
 * rather than described. `quoteArg` escapes `\` and `"` and nothing else, so
 * the substitution survives its output verbatim — which is exactly what
 * `pal.block` tells the reader ("double-quoting does not neutralise $(…)").
 * If a future `quoteArg` learned to escape `$`, this test would go red and the
 * screen's whole blocking branch would need rethinking rather than keeping a
 * refusal nobody needs any more.
 */
test('quoting is not a defence: the composed string still carries the substitution', async () => {
  const { composeCommand } = await command();
  const { copyBlocked } = await screen();
  const argv = ['mycontext', 'add', 'rule', 'the $(echo X) way'];
  const composed = composeCommand(argv);
  assert.match(composed, /\$\(echo X\)/, 'the substitution survives quoteArg intact');
  assert.equal(copyBlocked(argv), true, 'so the copy is refused instead');
});

test('argvChips marks exactly the offending element, and copyBlocked follows it', async () => {
  const { argvChips, copyBlocked } = await screen();
  const argv = ['mycontext', 'add', 'constraint', 'the $(echo X) way', '--scope', 'src/**'];
  assert.deepEqual(argvChips(argv).map((c) => c.unsafe), [false, false, false, true, false, false]);
  assert.deepEqual(argvChips(argv).map((c) => c.value), argv);
  assert.equal(copyBlocked(argv), true);
  assert.equal(copyBlocked(['mycontext', 'add', 'constraint', 'the plain way', '--scope', 'src/**']), false);
});

/**
 * The whole catalogue, composed with plausible values, must not trip the
 * refusal. A blocker that fired on ordinary corpus text would teach the reader
 * to ignore it, which is worse than not having one — the same failure mode
 * `screen-parity.spec.ts` names about a ledger tuned green.
 */
test('no ordinary composition is blocked', async () => {
  const { PALETTE, commandFor } = await defs();
  const { copyBlocked } = await screen();
  const values: Record<string, unknown> = {
    id: 'RULE-round-half-even', by: 'RULE-round-half-nine', key: 'k1',
    category: 'constraint', title: 'Prices are integer cents', body: 'Never floats.',
    scope: 'src/billing/**,test/billing/**', tags: 'billing,money', severity: 'hard',
    always: 'false', status: 'active', extra: 'a=b', note: 'from the ledger',
    step: 'run the migration', file: 'docs/README.md', reason: 'superseded by policy',
    revision: 'REV-8c21', topic: 'scope', text: 'integer cents', type: 'constraint',
    tag: 'billing', path: 'src/billing/prices.ts', relation: 'refines', limit: '50',
    directive: 'do', yes: true, force: true,
    // `ack <id> <code>` — a doctor finding code, which is the one argument in
    // this catalogue whose plausible value is neither an item id nor prose. The
    // POSITIONAL is keyed `finding`, because `--code` is a flag on the same
    // command and one values bag cannot hold two fields of one name; both are
    // filled here so the composition this sweep tests is the whole entry.
    finding: 'body_disagrees_with_meta', code: 'body_disagrees_with_meta', clear: true,
    // `init --pack <path>`, which arrived with the entry on 2026-09-06. It is
    // the only value in this bag that is a PATH rather than corpus text, and it
    // is the mockup's own example rather than an invention: the point of the
    // sweep is that ordinary values do not trip the shell-substitution refusal,
    // and `../packs/regulated-industry` is what a reader of that card copies.
    pack: '../packs/regulated-industry',
  };
  const blocked = PALETTE.filter((def) => copyBlocked(commandFor(def, values))).map((d) => d.name);
  assert.deepEqual(blocked, []);
});

/* ── what the screen may offer: the catalogue, and never more ───────────── */

/**
 * **The seq:10p ruling, pinned one layer out from the catalogue.**
 *
 * `review promote --all --pack <name>` is a real flag pair the CLI accepts and
 * `palette-defs.js` deliberately does not advertise, because turning a whole
 * pack's unreviewed drafts into one checkbox moves promotion closer to one
 * click than the CLI puts it. `FLAGS_NOT_OFFERED` in `palette-lib.test.ts`
 * holds that reason against the CATALOGUE. This holds it against the SCREEN:
 * the controls drawn are exactly the def's own `args` and `flags`, in that
 * order, so there is no second door — no free-text flag box, no "promote all"
 * convenience — through which the withheld pair could return.
 */
test('the controls a def offers are exactly its catalogue entry, args before flags', async () => {
  const { PALETTE } = await defs();
  const { controlSpecs, offeredFlagNames } = await screen();
  for (const def of PALETTE) {
    assert.deepEqual(controlSpecs(def).map((s) => s.name),
      [...def.args.map((a) => a.name), ...def.flags.map((f) => f.name)],
      `${def.name}: the form must draw the catalogue's controls, in composition order`);
  }
  // **The withheld pair is `--all` and `--pack` ON A PROMOTION**, and the scan
  // has to say so now that a second, unrelated `--pack` exists.
  // `init --pack <path>` is the path of an artefact to found a NEW workspace
  // from — no promotion, no queue, nothing bulk about it — and it arrived in the
  // catalogue on 2026-09-06 with `runnable: false`, so it is not even a control
  // that runs. Excluding it by name rather than by loosening the endsWith test:
  // a flag named here is a decision on the record, and the next `--pack` to
  // appear will have to be argued the same way instead of arriving under an
  // exemption somebody widened once.
  const NOT_THE_BULK_PAIR = ['init --pack'];
  const widened = PALETTE
    .flatMap((def) => offeredFlagNames(def).map((flag) => `${def.name} --${flag}`))
    .filter((entry) => entry.endsWith(' --all') || entry.endsWith(' --pack'))
    .filter((entry) => !NOT_THE_BULK_PAIR.includes(entry));
  assert.deepEqual(widened, [],
    'bulk promotion is an owner ruling (plan:ui2 seq:10p), not a control this screen adds');
  // The exemption is re-verified, so one that stops being true fails here rather
  // than quietly excusing a flag that HAS become the bulk pair.
  const offered = PALETTE.flatMap((def) => offeredFlagNames(def).map((f) => `${def.name} --${f}`));
  assert.deepEqual(NOT_THE_BULK_PAIR.filter((entry) => !offered.includes(entry)), [],
    'an exempted flag is no longer offered at all. Drop the row rather than leaving a written '
    + 'reason for something that is not there.');
});

test('missingRequired names the empty required inputs and nothing else', async () => {
  const { PALETTE } = await defs();
  const { missingRequired } = await screen();
  const add = PALETTE.find((d) => d.name === 'add')!;
  assert.deepEqual(missingRequired(add, {}), ['category', 'title']);
  assert.deepEqual(missingRequired(add, { category: 'rule' }), ['title']);
  // Empty string is absent, not a value — the same reading `commandFor` takes.
  assert.deepEqual(missingRequired(add, { category: 'rule', title: '' }), ['title']);
  assert.deepEqual(missingRequired(add, { category: 'rule', title: 'x', scope: '' }), []);
  // An optional flag is never required, however unset.
  const supersede = PALETTE.find((d) => d.name === 'supersede')!;
  assert.deepEqual(missingRequired(supersede, {}), ['id', 'by']);
});

/**
 * `missingRequired` and `commandFor` must agree about what is composable, or
 * the screen would offer a Copy button for a command the composer refuses (or
 * withhold one for a command it would have built). Derived over the whole
 * catalogue with every value absent, so a def that grows a required flag is
 * covered the day it lands.
 */
test('missingRequired is empty exactly when commandFor composes', async () => {
  const { PALETTE, commandFor } = await defs();
  const { missingRequired } = await screen();
  for (const def of PALETTE) {
    const composes = ((): boolean => {
      try { commandFor(def, {}); return true; } catch { return false; }
    })();
    assert.equal(missingRequired(def, {}).length === 0, composes,
      `${def.name}: the form's completeness test disagrees with the composer's`);
  }
});

/* ── the pickers, and that every source a def names can be filled ────────── */

test('pickerOptions is a list for a source or a vocabulary, and null otherwise', async () => {
  const { PALETTE } = await defs();
  const { pickerOptions, sourceLists } = await screen();
  const sources = sourceLists({ items: { items: [{ id: 'RULE-x', title: 'X' }] } });
  assert.deepEqual(pickerOptions({ name: 'id', source: 'items' }, sources),
    [{ value: 'RULE-x', label: 'RULE-x — X' }]);
  assert.deepEqual(pickerOptions({ name: 'severity', options: ['hard', 'soft'] }, sources),
    [{ value: 'hard', label: 'hard' }, { value: 'soft', label: 'soft' }]);
  assert.equal(pickerOptions({ name: 'title', input: 'text' }, sources), null);
  assert.equal(pickerOptions({ name: 'yes', boolean: true }, sources), null);
  // A source the bodies did not fill is an EMPTY picker, never a crash and
  // never a free-text box that would accept anything.
  assert.deepEqual(pickerOptions({ name: 'id', source: 'drafts' }, sources), []);

  // Derived: every source name in the catalogue must be one this screen fills.
  const named = new Set(PALETTE.flatMap((def) =>
    [...def.args, ...def.flags].map((s) => s.source).filter((s): s is string => typeof s === 'string')));
  const unfillable = [...named].filter((s) => !Object.hasOwn(sources, s)).sort();
  assert.deepEqual(unfillable, [],
    'a def naming a source the screen cannot build would draw a permanently empty picker');
});

/* ── D11: the three fields that got a suggestion list, and the one that did not ── */

test('findingOptions keeps what ack can rule on and drops what it cannot', async () => {
  const { findingOptions } = await screen();
  const options = findingOptions({
    findings: [
      { level: 'warn', code: 'citation_form', message: 'm', item: 'RULE-a' },
      // A repeat of one (item, code) pair is ONE acknowledgement, not two.
      { level: 'warn', code: 'citation_form', message: 'another message', item: 'RULE-a' },
      // Acknowledged is a MARK and not a filter: `--clear` needs this code.
      { level: 'error', code: 'task_unverified', message: 'm', item: 'RULE-a', acknowledged: true },
      { level: 'info', code: 'summary_absent', message: 'm', item: 'DEC-b' },
      // A NOTE ABOUT A CHECK. `ack` has nothing to record against one.
      { level: 'info', code: 'state_audit_coverage', message: 'm', about: 'state_unaudited' },
      // No item — a finding about the workspace, which `ack <id>` cannot name.
      { level: 'warn', code: 'index_stale', message: 'm' },
    ],
  });
  assert.deepEqual(options, [
    { value: 'citation_form', label: 'citation_form · warn', hint: 'warn', item: 'RULE-a' },
    { value: 'task_unverified', label: 'task_unverified · error', hint: 'error', item: 'RULE-a' },
    { value: 'summary_absent', label: 'summary_absent · info', hint: 'info', item: 'DEC-b' },
  ]);
  // A body that did not arrive is an empty list, never a throw: the box takes
  // whatever is typed into it either way.
  for (const body of [null, undefined, {}, { findings: 'no' }]) {
    assert.deepEqual(findingOptions(body), []);
  }
});

test('narrowedOptions offers only the codes doctor reports on the chosen item', async () => {
  const { narrowedOptions, findingOptions, sourceLists } = await screen();
  const sources = sourceLists({});
  sources['findings'] = findingOptions({
    findings: [
      { level: 'warn', code: 'citation_form', message: 'm', item: 'RULE-a' },
      { level: 'error', code: 'task_unverified', message: 'm', item: 'RULE-a' },
      { level: 'info', code: 'summary_absent', message: 'm', item: 'DEC-b' },
    ],
  });
  const spec: ArgSpec = {
    name: 'finding', input: 'suggest', source: 'findings', dependsOn: 'id', required: true,
  };
  assert.deepEqual(narrowedOptions(spec, sources, { id: 'RULE-a' })?.map((o) => o.value),
    ['citation_form', 'task_unverified']);
  assert.deepEqual(narrowedOptions(spec, sources, { id: 'DEC-b' })?.map((o) => o.value),
    ['summary_absent']);
  // An item doctor reports nothing on offers nothing — and `ack` would refuse
  // every code in the corpus for it, so an unnarrowed list would be worse.
  assert.deepEqual(narrowedOptions(spec, sources, { id: 'RULE-clean' }), []);
  // NOT YET NARROWED IS EMPTY, NOT EVERYTHING. Offering all three before an id
  // is chosen would offer two the command will refuse whichever id follows.
  assert.deepEqual(narrowedOptions(spec, sources, {}), []);
  assert.deepEqual(narrowedOptions(spec, sources, { id: '' }), []);
  // A spec with no dependency is untouched, so this is a narrowing and not a
  // second picker rule.
  assert.deepEqual(
    narrowedOptions({ name: 'severity', options: ['hard', 'soft'] }, sources, {}),
    [{ value: 'hard', label: 'hard' }, { value: 'soft', label: 'soft' }]);
  assert.equal(narrowedOptions({ name: 'title', input: 'text' }, sources, {}), null);
});

test('packOptions offers the paths imports were typed as, once each', async () => {
  const { packOptions } = await screen();
  assert.deepEqual(packOptions({
    packs: [
      { name: 'regulated', source: '../packs/regulated-industry' },
      // Two membership records can name one path — one suggestion, not two.
      { name: 'regulated', source: '../packs/regulated-industry' },
      { name: '', source: '/srv/packs/other.zip' },
      // `--pack` takes a PATH; a record with none has nothing to suggest.
      { name: 'nameless' },
    ],
  }), [
    {
      value: '../packs/regulated-industry',
      label: '../packs/regulated-industry · regulated',
      hint: 'regulated',
    },
    { value: '/srv/packs/other.zip', label: '/srv/packs/other.zip', hint: '' },
  ]);
  // Measured on this repository 2026-09-06: `/api/packs` answers `packs: []`
  // here. An empty suggestion list is the box that was there before, which is
  // why this field could gain one without a ruling about the empty case.
  for (const body of [null, undefined, {}, { packs: [] }]) {
    assert.deepEqual(packOptions(body), []);
  }
});

test('every suggest field names a source this screen fills, and its own list id', async () => {
  const { PALETTE } = await defs();
  const { sourceLists, suggestListId } = await screen();
  const sources = sourceLists({});
  const suggests = PALETTE.flatMap((def) =>
    [...def.args, ...def.flags]
      .filter((spec) => spec.input === 'suggest')
      .map((spec) => ({ def: def.name, spec })));
  // The three D11 fields, or as many of them as have landed. `key` on
  // `lesson-accept`/`lesson-discard` is deliberately NOT here: nothing serves a
  // staged lesson, because `listStaging` lives in `lesson/derive.ts` which
  // value-imports `createItem` from `core/mutate.ts` — the boundary
  // `src/ui/read-model.ts` already refused `st.staged` over.
  assert.deepEqual(suggests.map((s) => `${s.def} ${s.spec.name}`),
    ['ack finding', 'init pack']);
  for (const { def, spec } of suggests) {
    assert.equal(typeof spec.source, 'string', `${def} ${spec.name} has no source`);
    assert.ok(Object.hasOwn(sources, spec.source!),
      `${def} ${spec.name} names a source this screen cannot build`);
    // A dependency must name a field of the SAME def, or it can never be met.
    if (spec.dependsOn !== undefined) {
      const entry = PALETTE.find((d) => d.name === def)!;
      const siblings = [...entry.args, ...entry.flags].map((s) => s.name);
      assert.ok(siblings.includes(spec.dependsOn),
        `${def} ${spec.name} depends on ${spec.dependsOn}, which the def does not offer`);
    }
  }
  assert.equal(suggestListId('finding'), 'sugg-finding');
});

test('sourceLists builds the five lists and drops what cannot receive an item', async () => {
  const { sourceLists } = await screen();
  const sources = sourceLists({
    items: { items: [{ id: 'RULE-b', title: 'B' }, { id: 'INV-a', title: 'A' }] },
    config: {
      resolved: {
        categories: [
          { name: 'constraint', enabled: true },
          { name: 'open_question', enabled: false },
        ],
      },
    },
    queue: { drafts: [{ id: 'DRAFT-1', title: 'a lesson' }] },
    revisions: { revisions: [{ itemId: 'RULE-b', revisionId: 'REV-8c21' }] },
  });
  assert.deepEqual(sources.items.map((o) => o.label), ['RULE-b — B', 'INV-a — A']);
  // A disabled category cannot receive an item, so offering it would compose a
  // command the CLI refuses.
  assert.deepEqual(sources.categories, [{ value: 'constraint', label: 'constraint' }]);
  assert.deepEqual(sources.drafts, [{ value: 'DRAFT-1', label: 'DRAFT-1 — a lesson' }]);
  assert.deepEqual(sources.revisions,
    [{ value: 'RULE-b', label: 'RULE-b · REV-8c21', revision: 'REV-8c21' }]);
});

/**
 * `/api/config` really answers `resolved: null` when the file cannot be parsed
 * or resolved (`src/ui/read-model-config.ts` · `  let resolved: unknown = null;` · ~176),
 * and a composer that threw on it would take the whole screen down for a
 * config typo. Every list degrades to empty; none becomes undefined.
 */
test('sourceLists survives an unresolvable config and absent bodies', async () => {
  const { sourceLists } = await screen();
  for (const bodies of [{}, { config: { resolved: null } }, { config: {} }, { items: {} }]) {
    const sources = sourceLists(bodies);
    for (const key of ['items', 'categories', 'drafts', 'revisions']) {
      assert.deepEqual(sources[key], [], `${key} must degrade to an empty picker`);
    }
  }
});

/**
 * **THE THREE CLOSED VOCABULARIES ARE NO LONGER SPELLED IN THE BROWSER, AND
 * THIS IS THE TEST THAT USED TO SAY THEY WERE.**
 *
 * It read `sourceLists({}).topics` and compared it against `UI_HELP_TOPICS`,
 * and it passed for as long as it existed while being wrong: `UI_HELP_TOPICS`
 * is the four topics the LEARN SCREEN renders a corpus join for, and
 * `mycontext help` has accepted SEVEN since `cli`, `tools` and `slash` landed.
 * A copy checked against the wrong original is a copy nothing was checking.
 *
 * So `screens/palette.js` spells nothing now — `/api/meta` serves `helpTopics`
 * (`core/teach.ts`) and `statuses` (`core/validate.ts`), `/api/items` serves
 * `relationTypes` (`searchableRelationTypes`) — and what is decidable here is
 * that the screen carries the served list THROUGH, in the server's own order,
 * and degrades to an empty picker rather than to a fallback of its own.
 * `test/ui/read-model.test.ts` and `test/ui/server.test.ts` hold the endpoints
 * against the declaring modules, which is where that comparison belongs.
 */
test('the three served vocabularies are carried through in the server\'s order', async () => {
  const { sourceLists } = await screen();
  const sources = sourceLists({
    meta: { helpTopics: ['categories', 'cli', 'slash'], statuses: ['active', 'superseded'] },
    items: { items: [], relationTypes: ['derived_from', 'superseded_by'] },
  });
  assert.deepEqual(sources.topics, [
    { value: 'categories', label: 'categories' },
    { value: 'cli', label: 'cli' },
    { value: 'slash', label: 'slash' },
  ]);
  assert.deepEqual(sources.statuses.map((o) => o.value), ['active', 'superseded']);
  assert.deepEqual(sources.relations.map((o) => o.value), ['derived_from', 'superseded_by']);
});

/**
 * A body that did not arrive must leave an EMPTY picker rather than a plausible
 * one. `UI_HELP_TOPICS` is imported here for exactly one purpose now: to state
 * that the screen no longer answers with it — a spelled fallback would be the
 * copy this change removed, reintroduced as a default.
 */
test('a vocabulary the server did not send is an empty picker, never a fallback', async () => {
  const { sourceLists } = await screen();
  for (const bodies of [{}, { meta: null }, { meta: {} }, { items: {} }]) {
    const sources = sourceLists(bodies);
    for (const key of ['topics', 'statuses', 'relations']) {
      assert.deepEqual(sources[key], [], `${key} must degrade to an empty picker`);
    }
  }
  assert.notDeepEqual(sourceLists({}).topics.map((o) => o.value), [...UI_HELP_TOPICS]);
});

/* ── the `--tags` box: a LIST, and the picker that writes into it ─────────── */

/**
 * **`--tags` takes MANY values, and that is why it is not a `source`.**
 *
 * Every picker above emits one value into a `<select>`. A control that composed
 * `--tags v2` where the reader ticked three would be a regression wearing a
 * convenience's clothes — the task that ordered this picker says so in those
 * words — so the box stays and the checkboxes are derived from it.
 */
test('the tag box round-trips a list, joined with no space', async () => {
  const { tagsInValue, joinTags, withTag } = await screen();

  assert.deepEqual(tagsInValue('v2,ui, composer '), ['v2', 'ui', 'composer']);
  // The states a half-typed line passes through: an empty box, a trailing
  // comma, a doubled one. None of them may compose an empty argument.
  assert.deepEqual(tagsInValue(''), []);
  assert.deepEqual(tagsInValue(undefined), []);
  assert.deepEqual(tagsInValue('v2,,ui,'), ['v2', 'ui']);

  // No space after the comma, deliberately: a space would push the value out of
  // `quoteArg`'s safe set and quote the whole line for no gain.
  assert.equal(joinTags(['v2', 'ui']), 'v2,ui');
  assert.ok(!joinTags(['v2', 'ui']).includes(' '));
  // Ticking a tag the reader already typed must not compose it twice.
  assert.equal(joinTags(['v2', 'ui', 'v2']), 'v2,ui');

  // Added at the END and removed IN PLACE — the reader's own order survives.
  assert.equal(withTag('v2,ui', 'composer', true), 'v2,ui,composer');
  assert.equal(withTag('v2,ui,composer', 'ui', false), 'v2,composer');
  assert.equal(withTag('', 'v2', true), 'v2');
  assert.equal(withTag('v2', 'v2', false), '');
  // Unticking something the box never held is a no-op, not a rewrite.
  assert.equal(withTag('v2,ui', 'gone', false), 'v2,ui');
});

/**
 * **The projected half of `/api/tags` is NAMED, never offered.**
 *
 * The focus dialog offers both halves, because a focus is a READ and filtering
 * on `plan:builder` is a perfectly good question. `--tags` is a WRITE, and
 * `handWrittenProjectionError` (core/tag-projection.ts) makes `mycontext edit
 * <id> --tags plan:builder` a refusal that names the command which does work.
 * A checkbox composing that would be a control whose only outcome is an error.
 *
 * So the aside exists exactly when there is something to say, and `null`
 * otherwise — an empty sentence under an empty list is the "blank is a failure"
 * defect this project has a standard about.
 */
test('projectedAside names the prefixes and their commands, or nothing', async () => {
  const { projectedAside } = await screen();
  assert.equal(projectedAside(null), null);
  assert.equal(projectedAside({ free: [], projected: [] }), null);
  assert.deepEqual(
    projectedAside({
      projected: [
        { prefix: 'plan', commands: ['mycontext edit <id> --plan <value>'], options: [] },
        { prefix: 'state', commands: ['mycontext edit <id> --state <value>'], options: [] },
      ],
    }),
    {
      prefixes: 'plan: state:',
      cmds: 'mycontext edit <id> --plan <value> · mycontext edit <id> --state <value>',
    },
  );
  // A command declared by two prefixes is named once: the sentence lists what a
  // reader would type, and typing it twice is not two facts.
  assert.deepEqual(
    projectedAside({
      projected: [
        { prefix: 'plan', commands: ['mycontext edit <id> --plan <value>'] },
        { prefix: 'seq', commands: ['mycontext edit <id> --plan <value>'] },
      ],
    })?.cmds,
    'mycontext edit <id> --plan <value>',
  );
});

/**
 * The catalogue and the screen have to agree about which field is the LIST.
 * Derived from `PALETTE` rather than named here, so a third `--tags` field
 * added later is covered without an edit — and so a field that stops being
 * `input: 'tags'` fails here rather than silently losing its picker.
 */
test('every tags field the catalogue declares is the list-shaped control', async () => {
  const { PALETTE } = await defs();
  const tagFields = PALETTE.flatMap((def) =>
    [...def.args, ...def.flags].filter((spec) => spec.name === 'tags'));
  assert.ok(tagFields.length > 0, 'the catalogue must still offer --tags somewhere');
  for (const spec of tagFields) {
    assert.equal(spec.input, 'tags',
      '--tags takes a comma-separated LIST; a source picker would emit one value');
    assert.equal(spec.source, undefined);
    assert.equal(spec.options, undefined);
  }
  // And `pickerOptions` must still refuse it a `<select>`, which is the
  // mechanism rather than the intention.
  const { pickerOptions, sourceLists } = await screen();
  for (const spec of tagFields) {
    assert.equal(pickerOptions(spec, sourceLists({})), null);
  }
});

test('revisionFor names the revision behind a picked item, or null', async () => {
  const { sourceLists, revisionFor } = await screen();
  const sources = sourceLists({ revisions: { revisions: [{ itemId: 'RULE-b', revisionId: 'REV-8c21' }] } });
  assert.equal(revisionFor(sources, 'RULE-b'), 'REV-8c21');
  assert.equal(revisionFor(sources, 'RULE-nothing'), null);
  assert.equal(revisionFor(sources, undefined), null);
});

/* -- reads execute, writes never do: THERE IS NOTHING LEFT TO SPLIT ------- *

 * Four tests stood here and all four are gone as of 2026-09-07.
 *
 * Three of them exercised `readTarget(def, values)` — "no write has a run
 * target, and every read that runs has exactly one", "a read fetches the
 * endpoint that serves it, or navigates to the screen that renders it", and
 * "an all-absent search still composes a path, for the endpoint to refuse".
 * The fourth pinned `resultRows`, which turned the answered body into rows.
 * Both functions were the Composer's Run button, removed by owner ruling
 * (`DEC-run-is-removed-execute-is-the-only-way-to-run-what-the`).
 *
 * **The RULE those tests defended did not go with them, and it is not orphaned.**
 * It was spec §2 — a write is composed and copied, never run from this page —
 * expressed as a shape: `readTarget` had no branch that could hand a write
 * anywhere to go. That rule now lives on `runnable`, which is a single licence
 * checked in two places: `test/ui/palette-lib.test.ts` ("no entry carries a
 * second way to run", plus the boundary and `--yes` derivations) and
 * `test/ui/execute-catalogue.test.ts`, which is the SERVER's copy and the one
 * that actually refuses. One verb, one licence, one thing to prove per entry
 * instead of two plus their agreement.
 *
 * Nothing MOVED here, and that is a finding rather than an omission: the
 * structured result table Run drew had no test of its own anywhere in this
 * suite — not its rows, not its caption, and not the id cell `builder/13`
 * made clickable. The id gesture that survives is the TEXT one, and it is
 * tested where it lives: `test/ui/command-actions.test.ts` pins `idRuns`
 * against a real index and `button.idrun`'s metrics, and `e2e/item-pane
 * .spec.ts` drives the pane it opens.
 */

/* ── the glob tester ─────────────────────────────────────────────────────── */

test('globRows lights by membership and invents no row', async () => {
  const { globRows } = await screen();
  const files = ['src/a.ts', 'src/b.ts', 'test/a.test.ts'];
  assert.deepEqual(globRows(files, ['src/b.ts']), [
    { path: 'src/a.ts', hit: false },
    { path: 'src/b.ts', hit: true },
    { path: 'test/a.test.ts', hit: false },
  ]);
  // The tree is the file list's order, not the match list's, and a match the
  // universe does not carry adds nothing: `/api/glob` caps its sample at 200,
  // so the two lists genuinely can disagree on a large repository.
  assert.deepEqual(globRows(files, ['zzz/not-listed.ts']).filter((r) => r.hit), []);
  assert.deepEqual(globRows([], ['src/a.ts']), []);
  assert.deepEqual(globRows(files, []).map((r) => r.hit), [false, false, false]);
});

/**
 * The tester opens on a pattern, and the pattern must be the one that means
 * "every file the walk reached" TO THE MATCHER THAT WILL ANSWER IT — not to
 * this file's idea of globbing. `/api/glob` matches through `matchesAnyGlob`,
 * so that is what is asked here, over paths of every depth the walk emits.
 */
test('the tester\'s opening pattern matches every file, per the real matcher', async () => {
  const { EVERY_FILE } = await screen();
  for (const file of ['README.md', 'src/a.ts', 'src/billing/tax/vat.ts', 'a/b/c/d/e/f.json']) {
    assert.equal(matchesAnyGlob(file, [EVERY_FILE]), true, `${EVERY_FILE} must catch ${file}`);
  }
});
