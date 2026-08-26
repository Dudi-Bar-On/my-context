/**
 * The Template packs screen's DECIDABLE half, tested in Node — and the one
 * piece of its DOM half that is NOT allowed to be untested.
 *
 * Spec §6 names the glue in `app.js` and `screens/*.js` as the untested
 * surface, and `test/ui/work-screen.test.ts` keeps to that line strictly:
 * *"One is deliberately NOT supplied: supplying one would let this file drift
 * into testing the glue."* This file keeps the same line with ONE stated
 * exception, and the exception is the reason the screen exists in the shape it
 * does.
 *
 * **`packs[].name` is untrusted text.** `pack import --name` overrides the
 * manifest name AFTER `planImport` has screened it and nothing re-checks, so a
 * name carrying U+202E RIGHT-TO-LEFT OVERRIDE, or an embedded newline, is
 * written into `import.json` verbatim and served verbatim
 * (`src/ui/packs-model.ts` · `accepted. The screen this feeds must treat `name` as untrusted text.` · ~288).
 * The screen's whole answer to that is one element choice, and an element
 * choice with no assertion behind it is a comment. So `isolated()` takes its
 * `doc` as an argument — the arrangement `lib/i18n.js`'s `t()` uses, *"so
 * `node --test` can pass a two-method stand-in"* — and the tests below build
 * the real node from a hostile string and read the tag and the class off it.
 * Break either anchor and this file goes red.
 *
 * Everything else here is decidable without a document:
 *
 *   - `carriesRows` — five served config keys become five rows plus the
 *     mockup's static one. The task left this open ("`carries[]` serves FIVE
 *     config keys; the mockup drew two") and a filter is exactly the silent
 *     drop this project bans, so a filter is now a red test rather than a
 *     paragraph in a report;
 *   - `packRows` — every field the endpoint serves about a pack becomes a row,
 *     including the three the string tables have no key for (`missing`,
 *     `quarantined`, and `historyRecords` beside them), and including a
 *     `kind: 'export'` row, which is NOT filtered out of a list headed
 *     "Template packs";
 *   - `importCommand` — pinned to the design of record's own `<code>` line,
 *     read out of the mockup rather than copied into this file;
 *   - that every string key the screen names is declared in BOTH tables, that
 *     the two `pk.` keys it deliberately does not place are exactly the two it
 *     says it does not place, that no translated string is assigned rather
 *     than appended (ruling A1), and that no class is invented that the
 *     mockup's own section does not draw.
 *
 * ── HOW A BROWSER MODULE IS LOADED HERE ───────────────────────────────────
 *
 * `screens/packs.js` imports by the specifiers the BROWSER resolves —
 * `/lib/command.js` and `/screens/parts.js` — which Node resolves from the
 * drive root. So the module's bytes are read, both root-absolute specifiers are
 * rewritten to `file://` URLs, and the result is imported as a `data:` module.
 * The rewrite is COUNTED and the result re-checked for a surviving `/`
 * specifier, because a rewrite that silently missed one would import a
 * different module graph than the browser runs — the only way this file could
 * pass while testing the wrong thing. Transcribed from `work-screen.test.ts`,
 * which states the argument in full.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { allowedClasses } from '../helpers/shipped-classes.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const PACKS_JS = path.join(PUBLIC, 'screens', 'packs.js');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');

const packsSource = readFileSync(PACKS_JS, 'utf8');

/**
 * `packs.js` with its comment lines removed, for the scans that must not read
 * one.
 *
 * Line-based and not a comment parser, deliberately: this module writes
 * `key: 'items/**'`, and a stripper that honoured `/*` inside a string literal
 * would swallow the rest of the file from there. Every comment in this project's
 * screen modules is either a `//` line or a JSDoc block whose continuation
 * lines begin `*`, so dropping lines that START with one of those three
 * markers removes all of them and nothing else. `packsSource` is used only by the loader above,
 * where the prose is part of what is checked.
 */
const packsCode = packsSource
  .split(/\r?\n/)
  .filter((line) => !/^\s*(\/\*|\*|\/\/)/.test(line))
  .join('\n');

/** The two methods `isolated()` touches. Deliberately not a DOM node: a bag. */
interface FakeNode {
  tag: string;
  className: string;
  textContent: string;
}

interface FakeDoc {
  createElement: (tag: string) => FakeNode;
}

function fakeDoc(): FakeDoc {
  return {
    createElement: (tag: string): FakeNode => ({ tag, className: '', textContent: '' }),
  };
}

interface CarriesRow { key: string; travels: boolean; refusals: string[] }
interface CarriesView { key: string; labelKey: string | null; measured: boolean; travels: boolean }
interface PackRowView { label: string; text?: string; count?: number; ids?: string[] }

interface PacksModule {
  isolated: (text: unknown, doc: FakeDoc) => FakeNode;
  carriesRows: (carries: CarriesRow[]) => CarriesView[];
  packRows: (pack: unknown) => PackRowView[];
  importCommand: () => string;
  IMPORT_ARGV: string[];
  render: (root: unknown, ctx: unknown) => Promise<void>;
}

/** `from '/lib/command.js'` — the browser's own specifier form. */
const ROOT_SPECIFIER = /(\bfrom\s+')\/([^']+)'/g;

async function packsModule(): Promise<PacksModule> {
  let rewritten = 0;
  const text = packsSource.replace(ROOT_SPECIFIER, (_all, head: string, spec: string) => {
    rewritten += 1;
    return `${head}${pathToFileURL(path.join(PUBLIC, spec)).href}'`;
  });
  assert.equal(rewritten, 2,
    `expected packs.js to import two browser modules (/lib/command.js, /screens/parts.js); the `
    + `rewrite matched ${rewritten}. A specifier this pattern cannot see is a module Node would `
    + 'resolve from the drive root, and the import below would fail for a reason that reads like '
    + 'a missing file.');
  assert.ok(!/\bfrom\s+'\//.test(text),
    'a root-absolute specifier survived the rewrite — the module graph imported below would not '
    + 'be the one the browser runs');
  const encoded = Buffer.from(text, 'utf8').toString('base64');
  return (await import(`data:text/javascript;charset=utf-8;base64,${encoded}`)) as PacksModule;
}

/** `<section data-p="packs">…</section>`, the design of record for this screen. */
function mockupSection(): string {
  const html = readFileSync(MOCKUP, 'utf8');
  const start = html.indexOf('<section data-p="packs"');
  assert.notEqual(start, -1, 'the mockup has no [data-p="packs"] section');
  const end = html.indexOf('</section>', start);
  assert.notEqual(end, -1, 'the packs section is never closed');
  return html.slice(start, end);
}

/* -------------------------------------------------------------------------- *
 * The untrusted pack name. The one DOM decision this file does test.
 * -------------------------------------------------------------------------- */

/** U+202E, and the newline `refusePackName` refuses on the manifest path. */
const RLO_NAME = 'acme‮gnp.exe';
const NEWLINE_NAME = 'acme\nimported: 40 items';

test('a pack name carrying U+202E is rendered inside a bidi-isolated run', async () => {
  const { isolated } = await packsModule();
  const node = isolated(RLO_NAME, fakeDoc());

  // TWO anchors, asserted separately, because each one alone contains the
  // override and the point of having both is that one may be lost without the
  // containment going with it. A `<span class="m">` still isolates; a
  // `<bdi>` with no class still isolates; a `<span>` with neither does not,
  // and the row, the card and the page reorder around a hostile name.
  assert.equal(node.tag, 'bdi',
    'the pack name is not wrapped in a <bdi>. `bdi` carries unicode-bidi:isolate from the HTML '
    + 'user-agent stylesheet AND from styles.css, and it is the isolation that survives a class '
    + 'being renamed or dropped.');
  assert.ok(node.className.split(/\s+/).includes('m'),
    'the pack name run does not carry `.m`, which is `direction:ltr; unicode-bidi:isolate` — the '
    + 'declaration that pins the run\'s BASE direction so a leading control character cannot '
    + 'decide it');

  // Verbatim, and that is deliberate: the read model refuses to screen on the
  // read path because a finding there "could only refuse to serve one, which
  // hides a pack instead of naming a bad name". A name the reader cannot see
  // is a name they cannot pass to `review promote --all --pack`.
  assert.equal(node.textContent, RLO_NAME,
    'the name was altered on the way to the screen; isolation is the treatment, not sanitisation');
});

test('a pack name carrying a newline is isolated too, and is not split into two lines', async () => {
  const { isolated } = await packsModule();
  const node = isolated(NEWLINE_NAME, fakeDoc());
  assert.equal(node.tag, 'bdi');
  assert.ok(node.className.split(/\s+/).includes('m'));
  assert.equal(node.textContent, NEWLINE_NAME);
  // The forged second line `refusePackName` describes cannot exist here: the
  // newline is inside an element no rule gives `white-space:pre`, so HTML
  // collapses it to a space. Asserted as the text arriving WHOLE — a screen
  // that had split it on the newline would be printing the forgery.
  assert.ok(node.textContent.includes('\n'),
    'the newline was stripped rather than rendered; the treatment is isolation, not repair');
});

test('a name that is not a string still renders visibly rather than blanking the cell', async () => {
  const { isolated } = await packsModule();
  assert.equal(isolated(undefined, fakeDoc()).textContent, 'undefined');
});

test('the untrusted name reaches no renderer other than isolated()', () => {
  // The module-level guard behind the two tests above: they prove `isolated`
  // isolates, and this proves the name has nowhere else to go. `mono()`,
  // `el(…, name)` or a bare textContent would each render the name in a run
  // that is either not isolated or not the one measured here.
  const uses = [...packsCode.matchAll(/pack\.name/g)];
  assert.ok(uses.length >= 1, 'packs.js never reads pack.name — this guard is checking nothing');
  for (const use of uses) {
    const before = packsCode.slice(Math.max(0, use.index - 12), use.index);
    assert.ok(before.endsWith('isolated('),
      `pack.name is rendered by something other than isolated() at offset ${use.index}: `
      + `…${before}pack.name…`);
  }
  // And nothing else builds a `bdi`, so `isolated` is the only door.
  const bdis = [...packsCode.matchAll(/createElement\('bdi'\)|el\('bdi'/g)];
  assert.equal(bdis.length, 1,
    'more than one place in packs.js builds a <bdi>; the isolation now has two spellings free to '
    + 'disagree');
});

/* -------------------------------------------------------------------------- *
 * carriesRows — five served keys, five rows.
 * -------------------------------------------------------------------------- */

/** What `/api/packs` serves for `carries`, in the shape `carriesFor` builds. */
const FIVE_KEYS: CarriesRow[] = [
  { key: 'profile', travels: false, refusals: ['a profile is a fact about your machine'] },
  { key: 'categories', travels: true, refusals: [] },
  { key: 'budgets', travels: false, refusals: ['Budgets decide how much of YOUR corpus reaches'] },
  { key: 'watchedDocs', travels: false, refusals: ['watchedDocs names paths in YOUR repository'] },
  { key: 'ui', travels: false, refusals: ['ui is a preference'] },
];

test('carriesRows draws one row per served key — all five, not the two the mockup drew', async () => {
  const { carriesRows } = await packsModule();
  const rows = carriesRows(FIVE_KEYS);

  assert.deepEqual(rows.map((r) => r.key),
    ['items/**', 'profile', 'categories', 'budgets', 'watchedDocs', 'ui'],
    'the pk.what table dropped or reordered a served key. Filtering to the rows the mockup had '
    + 'already thought of is the silent drop this project bans, arriving through a screen instead '
    + 'of through a file.');
  // The order is the SERVED order and not a sort: `carriesFor` returns the
  // loader's own key order, and a screen that sorted it would be answering a
  // question about the config with an answer about the alphabet.
  assert.deepEqual(rows.slice(1).map((r) => r.key), FIVE_KEYS.map((r) => r.key));
});

test('carriesRows carries the verdict through, and marks the one row nobody measured', async () => {
  const { carriesRows } = await packsModule();
  const rows = carriesRows(FIVE_KEYS);
  const byKey = new Map(rows.map((r) => [r.key, r]));

  assert.equal(byKey.get('categories')?.travels, true);
  for (const key of ['profile', 'budgets', 'watchedDocs', 'ui']) {
    assert.equal(byKey.get(key)?.travels, false, `${key} must not be drawn as travelling`);
  }
  // `items/**` is the mockup's own row and no endpoint answers it — the read
  // model refuses to serve it on purpose. Drawn because the design of record
  // draws it; flagged because it is the only unmeasured row on the card.
  assert.equal(byKey.get('items/**')?.measured, false);
  for (const row of rows.slice(1)) assert.equal(row.measured, true, row.key);
});

test('carriesRows keeps the mockup\'s own labelling split, which is not uniform', async () => {
  const { carriesRows } = await packsModule();
  const byKey = new Map(carriesRows(FIVE_KEYS).map((r) => [r.key, r]));
  const section = mockupSection();

  // One row of the four the mockup drew carries a translated label; the other
  // three are the config key itself in a `.m` cell, in both languages. Read
  // out of the design of record rather than asserted from memory.
  assert.ok(section.includes('data-t="pk.cats"'),
    'the mockup no longer translates the categories row — the design of record moved');
  assert.ok(section.includes('<td class="m">watchedDocs</td>'),
    'the mockup no longer draws watchedDocs as a bare key cell — the design of record moved');
  assert.equal(byKey.get('categories')?.labelKey, 'pk.cats');
  for (const key of ['profile', 'budgets', 'watchedDocs', 'ui', 'items/**']) {
    assert.equal(byKey.get(key)?.labelKey, null,
      `${key} is being drawn through a string key; the mockup draws the key itself`);
  }
});

/* -------------------------------------------------------------------------- *
 * packRows — every served field, including the three with no string key.
 * -------------------------------------------------------------------------- */

const PACK = {
  name: RLO_NAME,
  version: '2026-08 rev 3',
  kind: 'pack',
  source: '../packs/regulated-industry',
  importedAt: '2026-08-23T09:26:05.001Z',
  manifestFiles: 12,
  items: { total: 12, byStatus: { draft: 9, active: 2 } },
  missing: ['RULE-never-log-customer-email'],
  historyRecords: 12,
  quarantined: 3,
};

test('packRows draws every field the endpoint serves about a pack', async () => {
  const { packRows } = await packsModule();
  const labels = packRows(PACK).map((r) => r.label);

  // Spelled out rather than counted: a count passes when one field is swapped
  // for another, and the three that matter most here — `missing`,
  // `quarantined` and the per-status buckets — are exactly the ones no string
  // table has a key for and nothing else on the screen would miss.
  assert.deepEqual(labels, [
    'kind', 'version', 'source', 'importedAt', 'manifestFiles', 'items.total',
    'items.byStatus.active', 'items.byStatus.draft',
    'missing', 'historyRecords', 'quarantined',
  ]);
  // `name` is the card's heading and must not also be a row: a second place
  // the untrusted string is rendered is a second place to get it wrong.
  assert.ok(!labels.includes('name'));
});

test('packRows expands byStatus in a stable order and carries the missing ids, not just a count', async () => {
  const { packRows } = await packsModule();
  const byLabel = new Map(packRows(PACK).map((r) => [r.label, r]));

  assert.equal(byLabel.get('items.byStatus.draft')?.count, 9);
  assert.equal(byLabel.get('items.byStatus.active')?.count, 2);
  // Sorted, because `Object.keys` follows insertion order over item ids — the
  // table would reorder itself when an unrelated item changed status.
  const statuses = packRows(PACK).map((r) => r.label).filter((l) => l.startsWith('items.byStatus.'));
  assert.deepEqual(statuses, [...statuses].toSorted());

  // Named and not merely counted, which is the endpoint's own ruling about
  // this field: "a bare count cannot be checked against".
  assert.equal(byLabel.get('missing')?.count, 1);
  assert.deepEqual(byLabel.get('missing')?.ids, ['RULE-never-log-customer-email']);
  assert.equal(byLabel.get('quarantined')?.count, 3);
});

test('a zero row is still a row — a field that vanishes at zero cannot be told from one that never existed', async () => {
  const { packRows } = await packsModule();
  const empty = { ...PACK, items: { total: 0, byStatus: {} }, missing: [], historyRecords: 0, quarantined: 0 };
  const labels = packRows(empty).map((r) => r.label);
  assert.deepEqual(labels, [
    'kind', 'version', 'source', 'importedAt', 'manifestFiles', 'items.total',
    'missing', 'historyRecords', 'quarantined',
  ]);
  // No status bucket, because the endpoint serves only the statuses present:
  // "a zero invented for the other four would be this module deciding which
  // statuses a screen should draw".
  assert.ok(!labels.some((l) => l.startsWith('items.byStatus.')));
});

test('a kind:"export" row is drawn, labelled, and not filtered out of a list headed Template packs', async () => {
  const { packRows } = await packsModule();
  // An export imported under `--name` is a member of this list. Hiding it
  // would be a filter with no disclosure, which is the read model's own
  // ruling; drawing `kind` is what keeps it from being MISread as a pack.
  const view = packRows({ ...PACK, kind: 'export', version: '' });
  const byLabel = new Map(view.map((r) => [r.label, r]));
  assert.equal(byLabel.get('kind')?.text, 'export');
  // `''` is what an export imported under `--name` carries for a version, and
  // it must survive as itself: the screen draws the design of record's em dash
  // for it, which is a different fact from a missing row.
  assert.equal(byLabel.get('version')?.text, '');
  assert.ok(!/\.filter\(/.test(packsCode),
    'packs.js filters something. Every row /api/packs sends is a row this screen draws.');
  // **A DISCLOSED CAP IS NOT A FILTER, and that distinction is this assertion's
  // whole subject.** Until 2026-08-26 this pinned "no cap, no paging, no
  // filter" and matched the literal `for (const pack of body.packs)
  // root.append(packCard(pack));` — which was right when the alternative was a
  // silent truncation, and wrong once
  // `REQ-every-list-and-table-declares-what-leaves-it-and-when-and-says`
  // existed: an unbounded stack is not honest, it is merely unbounded.
  //
  // What has to stay pinned is that nothing is hidden WITHOUT SAYING SO. So the
  // whole membership must still reach the renderer — `body.packs` entire, no
  // guard, no `continue`, no slice at the call site — and the only thing
  // allowed to hold rows back is `boundedList`, which cannot do it silently:
  // it draws the sentence and the control in the same breath as the cut.
  assert.ok(
    /boundedList\(ctx, stack, body\.packs, \(pack\) => packCard\(pack\),/.test(packsCode),
    'the render path is no longer boundedList over the WHOLE served array. A guard, a `continue` '
    + 'or a hand-rolled slice here would hide a `kind: "export"` record imported under `--name` '
    + 'with nothing on screen to say it happened.');
  assert.ok(/order: 'recent', take: 'last'/.test(packsCode),
    'the pack stack no longer declares its order. A pack import is a record — `.audit/imported/` '
    + 'stamps each one — and a truncation whose ordering is unstated is a sample presented as a '
    + 'summary.');
});

/* -------------------------------------------------------------------------- *
 * The one composed command.
 * -------------------------------------------------------------------------- */

test('importCommand composes the design of record\'s own line, byte for byte', async () => {
  const { importCommand } = await packsModule();
  // Read out of the mockup rather than copied into this file: a copy would go
  // stale the moment the design of record changed its command and nothing
  // would say so.
  const code = /<code>([^<]+)<\/code>/.exec(mockupSection());
  assert.ok(code, 'the packs section draws no <code> command');
  assert.equal(importCommand(), code[1]);
});

test('importCommand goes through the one quoting implementation', async () => {
  const { IMPORT_ARGV } = await packsModule();
  assert.equal(IMPORT_ARGV[0], 'mycontext');
  assert.ok(packsCode.includes('composeCommand(IMPORT_ARGV)'),
    'the command is assembled by something other than lib/command.js — the ONE place quoting '
    + 'lives');
});

/* -------------------------------------------------------------------------- *
 * The screen against the two string tables and against the mockup.
 * -------------------------------------------------------------------------- */

async function table(language: string): Promise<Record<string, string>> {
  const file = path.join(PUBLIC, 'strings', `${language}.js`);
  const mod = await import(pathToFileURL(file).href) as { strings: Record<string, string> };
  return mod.strings;
}

/**
 * Every key `packs.js` names.
 *
 * Not a `ctx.t('…')` pattern: this screen names three of its keys through
 * arrays and one through a ternary, and a pattern that could not see those
 * would report a clean file. So every single-quoted literal is collected and
 * intersected with the English table — a scan that cannot miss a spelling,
 * at the cost of also catching a literal that happens to be a key, which is
 * a false POSITIVE and therefore safe in this direction.
 */
function keysNamed(en: Record<string, string>): string[] {
  const found = new Set<string>();
  for (const m of packsCode.matchAll(/'([^'\n]+)'/g)) {
    if (Object.hasOwn(en, m[1])) found.add(m[1]);
  }
  return [...found].sort();
}

test('every string key the packs screen names is declared in both tables, and needs no substitution', async () => {
  const en = await table('en');
  const he = await table('he');
  const used = keysNamed(en);

  // A scanner that finds nothing reads exactly like a clean file.
  assert.ok(used.length >= 18,
    `the scan found ${used.length} key(s) in packs.js; the screen names eighteen of the twenty `
    + '`pk.` keys plus port.yes and btn.copy. A collapse means the pattern stopped matching, not '
    + 'that the screen stopped naming keys.');

  // The grammar has ONE parser and this is it. Eight files used to carry a
  // private scanner instead, all of them predating emphasis, and every one
  // read `{b:` as a substitution named `b:...` the day emphasis landed.
  const { slots: slotsOf } = await import(
    new URL('../../src/ui/public/lib/i18n.js', import.meta.url).href
  ) as { slots: (template: string) => string[] };

  for (const key of used) {
    assert.ok(Object.hasOwn(he, key), `packs.js names ${key}, missing from the Hebrew table`);
    // Both tables, not only English: `t()` throws on a substitution the caller
    // did not pass, and it throws in whichever language the reader chose. This
    // screen passes NO substitutions at all, so a slot appearing in either
    // template blanks the screen for that reader.
    for (const template of [en[key], he[key]]) {
      assert.deepEqual(slotsOf(template), [],
        `${key} declares a value slot and no call site on this screen supplies one — t() throws `
        + 'and the screen blanks');
    }
  }
  assert.ok(!/ctx\.t\([^)]*,\s*\{/.test(packsCode),
    'a call site now passes substitutions; the slot assertion above no longer covers it');
});

test('the two pk. keys this screen does not place are exactly the two it says it does not place', async () => {
  const en = await table('en');
  const declared = Object.keys(en).filter((key) => key.startsWith('pk.')).sort();
  const named = new Set(keysNamed(en));

  assert.equal(declared.length, 20,
    `the English table declares ${declared.length} pk. key(s); it has been 20 since this screen `
    + 'was written. A new one is a new sentence on this screen and needs placing.');
  // `pk.active` and `pk.draft` are label-copies of a value `/api/packs` now
  // answers (`landing.initPack` / `landing.packImport`). The chip prints the
  // SERVED word, so the day the build stops landing everything draft the
  // screen says so — where a translated key would go on saying "draft".
  // Pinned as a SET: placing one, or quietly dropping a third, fails here.
  assert.deepEqual(declared.filter((key) => !named.has(key)), ['pk.active', 'pk.draft'],
    'the set of pk. keys drawn nowhere changed. Either a sentence of the design of record has '
    + 'silently stopped rendering, or the landing chip went back to printing a translated word '
    + 'instead of the measurement.');
  assert.ok(packsCode.includes('landing.initPack') && packsCode.includes('landing.packImport'),
    'the trust table no longer reads `landing` from the response');
});

test('no translated string is assigned — t() returns nodes and they are appended (ruling A1)', () => {
  // `t()` returns Node[]. Assigning one to `textContent` renders `[object
  // Object]`; assigning `tFlat()` to `innerHTML` would destroy the `.m` spans
  // that carry the direction isolation — which on THIS screen is also the
  // security treatment. Neither is reachable by any other test: this module's
  // DOM half is never evaluated.
  assert.ok(!/textContent\s*=\s*ctx\.t/.test(packsCode),
    'a translated value is assigned to textContent');
  assert.ok(!/innerHTML/.test(packsCode), 'innerHTML has no legitimate use in a screen module');
  assert.ok(/\.append\(\.\.\.ctx\.t\(/.test(packsCode),
    'the screen appends no translated nodes at all — the scan above is checking nothing');
  assert.ok(!/tFlat/.test(packsCode),
    'this screen has no attribute sink to fill; tFlat here would be a translated string flattened '
    + 'into an element, which is the bug ruling A1 names');
});

test('the screen invents no class the mockup\'s own packs section does not draw', () => {
  const section = mockupSection();
  const drawn = new Set<string>();
  for (const m of section.matchAll(/class="([^"]+)"/g)) {
    for (const token of m[1].trim().split(/\s+/)) drawn.add(token);
  }
  assert.ok(drawn.size >= 10, `the mockup scan found ${drawn.size} class token(s) — too few to be `
    + 'the packs section, so the extraction is broken rather than the screen clean');

  const written: string[] = [];
  for (const m of packsCode.matchAll(/\bel\('[a-z0-9]+',\s*'([^']*)'/g)) written.push(m[1]);
  for (const m of packsCode.matchAll(/\bchip\('([^']*)'/g)) written.push(m[1]);
  for (const m of packsCode.matchAll(/className = '([^']*)'/g)) written.push(m[1]);
  assert.ok(written.length >= 12,
    `the packs.js scan found ${written.length} class string(s); the screen writes at least twelve`);

  for (const value of written) {
  const allowed = allowedClasses(drawn);
    for (const token of value.trim().split(/\s+/)) {
      // `allowed`, not `drawn`: the mockup's classes UNION what styles.css
      // actually styles. See test/helpers/shipped-classes.ts — the app is what
      // gets built now, so a NEW class with a real rule is ordinary development;
      // a typo still has no rule anywhere and still fails here.
      assert.ok(allowed.has(token),
        `packs.js writes class "${token}", which <section data-p="packs"> never uses. A class the `
        + 'design of record does not draw is either a typo or a decision the owner has not taken.');
    }
  }
  // The pairs the screen turns on, pinned as whole attribute values rather
  // than as loose tokens: a chip that took `chip` without `warn` would satisfy
  // the token check above and draw the wrong thing.
  for (const composite of ['card pane', 'chip ok', 'chip warn']) {
    assert.ok(section.includes(`class="${composite}"`),
      `the mockup no longer draws class="${composite}" — the design of record moved`);
    assert.ok(written.includes(composite),
      `packs.js no longer writes the "${composite}" pair the mockup draws`);
  }
});

test('the kinds this screen adds beyond the mockup come from parts.js and are enumerated', () => {
  // The screen draws five element kinds `<section data-p="packs">` has none of
  // — `bdi.m` (the untrusted name), `p.small.spill` (a `dropped[]` entry in the
  // server's own words) and `span.idfull.m` with its two halves `span.idkind`
  // and `span.idslug` (a `missing` id). Four of the five arrive through an
  // import from `parts.js` and the fifth is `isolated()`'s own, so the
  // import list is where they are pinned: reaching for `linkId` or `tierChip`
  // adds a kind to the KNOWN_GAPS ledger's other column and must not happen
  // silently.
  // The specifier match tolerates a WRAPPED import list — the list outgrew one
  // line when `boundedList` joined it, and a regex that silently stops matching
  // is a pin that has stopped pinning rather than a failure anyone would see.
  const imports = /import \{([^}]+)\} from '\/screens\/parts\.js'/.exec(packsCode);
  assert.ok(imports, 'packs.js no longer imports from parts.js by the browser\'s own specifier');
  assert.deepEqual(
    imports[1].split(',').map((s) => s.trim()).filter((s) => s !== '').sort(),
    ['BOUND_CAP_TABLE', 'boundedList', 'el', 'errorNote', 'idFull', 'mono', 'num', 'spaced']);
  // `linkId` in particular is the wrong helper here and its absence is a
  // decision: a `missing` id names an item that is NOT in the corpus, so a
  // button opening the detail pane for it would open a pane on nothing.
  assert.ok(!/\blinkId\b/.test(packsCode),
    'a missing item id is being drawn as a clickable id; there is no item behind it to open');
});

test('a refusal is drawn instead of the body, never beside an empty one', () => {
  // The rule status.js, doctor.js and work.js all keep. Every card on this
  // screen is fed by the response, so an explainer standing beside a failed
  // read would report the good fact and bury the bad one. Checked at the
  // source, because the DOM half is not evaluated here: the catch block must
  // append the note and RETURN before any card is built.
  const guard = /catch \(error\) \{[\s\S]*?errorNote\([\s\S]*?\n {4}return;\n {2}\}/.exec(packsCode);
  assert.ok(guard,
    'the /api/packs catch block no longer draws errorNote and returns; the screen would fall '
    + 'through and draw its cards beside a refusal');
});
