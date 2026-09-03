/**
 * The Composer screen's decidable half, tested in Node.
 *
 * **The limit is the plan's, stated rather than papered over** (spec §6, and
 * `test/ui/viewmodel.test.ts`' own header): the DOM rendering in
 * `screens/*.js` has no test — that needs a browser this project does not
 * depend on. So `render()` is not called here and nothing below asserts a
 * pixel. What IS decidable is everything `render()` asks before it touches the
 * document: which argv element blocks a copy, which controls a def offers,
 * which picker list fills them, what running a read means, and which rows a
 * read's answer holds. Those are exported from `screens/palette.js` for
 * exactly this reason, and a green run here verifies them and nothing more.
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
 * than `palette-defs.js`' real entries — `endpoint` takes a value bag and the
 * bag is `Record<string, unknown>` — because a test that had to know the exact
 * value union could not pass it a wrong one.
 */
interface ArgSpec {
  name: string;
  required?: boolean;
  boolean?: boolean;
  joined?: boolean;
  source?: string;
  options?: string[];
  input?: string;
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
  screen?: string;
  endpoint?: (values: Record<string, string>) => string;
}
interface Option { value: string; label: string; revision?: string }
interface Sources {
  items: Option[]; categories: Option[]; drafts: Option[];
  revisions: Option[]; topics: Option[];
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
  sourceLists: (bodies: Record<string, unknown>) => Sources;
  revisionFor: (sources: Sources, itemId: string | undefined) => string | null;
  readTarget: (def: PaletteDef, values: Record<string, string>)
    => { kind: 'fetch'; path: string } | { kind: 'navigate'; hash: string } | null;
  resultRows: (body: unknown) => { rows: { id: string }[]; total: number; truncated: boolean };
  globRows: (files: string[], matched: string[]) => { path: string; hit: boolean }[];
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
    // this catalogue whose plausible value is neither an item id nor prose.
    code: 'body_disagrees_with_meta', clear: true,
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
  const widened = PALETTE
    .flatMap((def) => offeredFlagNames(def).map((flag) => `${def.name} --${flag}`))
    .filter((entry) => entry.endsWith(' --all') || entry.endsWith(' --pack'));
  assert.deepEqual(widened, [],
    'bulk promotion is an owner ruling (plan:ui2 seq:10p), not a control this screen adds');
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
 * or resolved (`src/ui/read-model-config.ts` · `  let resolved: unknown = null;` · ~141),
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
 * The four help topics are a closed vocabulary the SERVER owns. Spelling them
 * in a browser module is a copy, and a copy that drifts hands the user
 * `mycontext help <topic>` for a topic the endpoint refuses — so the copy is
 * derived against the original here rather than trusted.
 */
test('the help topics offered are the server\'s own four, in its order', async () => {
  const { sourceLists } = await screen();
  assert.deepEqual(sourceLists({}).topics.map((o) => o.value), [...UI_HELP_TOPICS]);
});

test('revisionFor names the revision behind a picked item, or null', async () => {
  const { sourceLists, revisionFor } = await screen();
  const sources = sourceLists({ revisions: { revisions: [{ itemId: 'RULE-b', revisionId: 'REV-8c21' }] } });
  assert.equal(revisionFor(sources, 'RULE-b'), 'REV-8c21');
  assert.equal(revisionFor(sources, 'RULE-nothing'), null);
  assert.equal(revisionFor(sources, undefined), null);
});

/* ── reads execute, writes never do ─────────────────────────────────────── */

/**
 * **Spec §2 as a shape rather than as a check.** `readTarget` has no branch
 * that could hand a write anywhere to go: a write returns `null`, and the only
 * thing the screen does with a composed write is show it and copy it. Derived
 * over the whole catalogue, so a def that changed kind is caught here.
 */
test('no write has a run target, and every read has exactly one', async () => {
  const { PALETTE } = await defs();
  const { readTarget } = await screen();
  const values = { id: 'RULE-x', category: 'rule', topic: 'scope', text: 'cents' };
  for (const def of PALETTE) {
    const target = readTarget(def, values);
    if (def.kind === 'write') {
      assert.equal(target, null, `${def.name} is a write — it is composed and copied, never run`);
      continue;
    }
    assert.notEqual(target, null, `${def.name} is a read with nothing to run`);
    assert.ok(target!.kind === 'fetch' || target!.kind === 'navigate');
  }
});

test('a read fetches the endpoint that serves it, or navigates to the screen that renders it', async () => {
  const { PALETTE } = await defs();
  const { readTarget } = await screen();
  const find = (name: string): PaletteDef => PALETTE.find((d) => d.name === name)!;
  assert.deepEqual(readTarget(find('status'), {}), { kind: 'navigate', hash: '#/status' });
  assert.deepEqual(readTarget(find('list'), {}), { kind: 'fetch', path: '/api/items' });
  assert.deepEqual(readTarget(find('show'), { id: 'RULE-x' }),
    { kind: 'fetch', path: '/api/item/RULE-x' });
  // An id with a character a URL would eat is encoded by the catalogue, not
  // pasted — the endpoint reads one path segment and must receive one.
  assert.deepEqual(readTarget(find('show'), { id: 'RULE-a/b' }),
    { kind: 'fetch', path: '/api/item/RULE-a%2Fb' });
  assert.deepEqual(readTarget(find('search'), { text: 'integer cents', limit: '10' }),
    { kind: 'fetch', path: '/api/search?text=integer+cents&limit=10' });
  // `help` carries a screen and no endpoint: the answer is already rendered.
  assert.deepEqual(readTarget(find('help'), { topic: 'scope' }), { kind: 'navigate', hash: '#/learn' });
});

/**
 * An all-absent `search` composes a legal command and an ILLEGAL query, and
 * the screen fetches it anyway on purpose: `apiSearch` refuses it in words
 * that name the right question (`src/ui/read-model-work.ts` · `'at least one filter is required — an all-absent filter matches the whole corpus, ' +` · ~185),
 * and `errorNote` shows the server's own sentence. Re-deciding that here would
 * be a second opinion about a rule the endpoint already owns — and the browser
 * has no string key of its own to say it with.
 */
test('an all-absent search still composes a path, for the endpoint to refuse', async () => {
  const { PALETTE } = await defs();
  const { readTarget } = await screen();
  assert.deepEqual(readTarget(PALETTE.find((d) => d.name === 'search')!, {}),
    { kind: 'fetch', path: '/api/search?' });
});

test('resultRows reads both answered shapes and carries the endpoint\'s own total', async () => {
  const { resultRows } = await screen();
  assert.deepEqual(
    resultRows({ items: [{ id: 'a' }, { id: 'b' }], total: 275, truncated: true }),
    { rows: [{ id: 'a' }, { id: 'b' }], total: 275, truncated: true });
  // `/api/items` sends no `total`; the rows are the whole answer.
  assert.deepEqual(resultRows({ items: [{ id: 'a' }] }),
    { rows: [{ id: 'a' }], total: 1, truncated: false });
  assert.deepEqual(resultRows({ item: { id: 'RULE-x' }, injection: {} }),
    { rows: [{ id: 'RULE-x' }], total: 1, truncated: false });
  // Empty is a real answer and is not a truncation.
  assert.deepEqual(resultRows({ items: [], total: 0, truncated: false }),
    { rows: [], total: 0, truncated: false });
  for (const junk of [null, undefined, 42, 'items', { ok: true }, { item: null }]) {
    assert.deepEqual(resultRows(junk), { rows: [], total: 0, truncated: false });
  }
});

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
