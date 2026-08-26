/**
 * The Export / import screen's DECIDABLE half, tested in Node — and the line
 * where that half stops.
 *
 * Spec §6 names the DOM glue in `app.js` and `screens/*.js` as the untested
 * surface, and `test/ui/viewmodel.test.ts`'s own header says why: testing it
 * would need a browser dependency this project does not have. Nothing below
 * builds an element or stands in a `document`. What it does test is everything
 * `screens/port.js` DECIDES before it touches one:
 *
 *   - that the three lookup tables COVER what `/api/port` really serves and
 *     nothing more — checked against a live `apiPort` response over a real
 *     workspace, not against a copy of the endpoint's constants;
 *   - that the rung the endpoint marks `built: false` is drawn and badged
 *     rather than dropped, and that an id the design of record has no row for
 *     is refused prose rather than handed a neighbour's;
 *   - that the audit vocabulary on screen is the RESPONSE's partition of it,
 *     which is asserted twice — once by comparing the chips to `AUDIT_KINDS`,
 *     and once by proving no kind name is transcribed into the module at all;
 *   - that the composed export line is the served argv and is one argument
 *     shorter than the mockup's own `<code>`, which is read out of the mockup
 *     rather than copied into this file;
 *   - that every string key the screen names is declared in BOTH tables, and
 *     every `port.` key the English table declares is placed by the screen;
 *   - that no translated string is assigned rather than appended (ruling A1),
 *     and that no class is invented that `<section data-p="port">` does not
 *     use.
 *
 * ── WHY THE FIXTURE RUNS THE REAL CLI ─────────────────────────────────────
 *
 * `apiPort` 404s outside a workspace, so a response needs one to exist. It is
 * built by the real CLI exactly as `test/ui/port-model.test.ts` builds its
 * own — `add` refuses without `--yes` when stdin is not interactive — and torn
 * down with `removeTree`, because a bare `rmSync` here is what
 * `test/no-bare-rmsync.test.ts` fails on. It is built ONCE and shared: every
 * test below reads and none writes, and four `mycontext init` runs to answer
 * the same constant response is four seconds nobody gets back.
 *
 * The point of paying for it is that this file never writes down what the
 * endpoint serves. A test that compared `RUNGS` to a hand-typed
 * `['dir','bundle','zip']` would pass on the day the endpoint grew a fourth
 * rung and the screen did not — which is the entire failure the coverage
 * assertions exist to prevent.
 *
 * ── HOW A BROWSER MODULE IS LOADED HERE, AND WHY NOT DIRECTLY ─────────────
 *
 * A screen imports its dependencies by the specifiers the BROWSER resolves —
 * `/lib/command.js`, `/screens/parts.js` — which are root-absolute URL paths,
 * and Node resolves a leading `/` as a filesystem path from the drive root. So
 * the module's own bytes are read, its two root-absolute specifiers are
 * rewritten to `file://` URLs, and the result is imported as a `data:` module.
 * The rewrite is COUNTED and the result re-checked for a surviving `/`
 * specifier, because a rewrite that silently missed one would import a
 * different module graph than the browser runs — the only way this file could
 * pass while testing the wrong thing. Transcribed from
 * `test/ui/work-screen.test.ts`, which settled the technique.
 *
 * Neither dependency touches the DOM at module scope, so no stand-in
 * `document` is needed to import the screen. One is deliberately NOT supplied:
 * supplying one would let this file drift into testing the glue.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { AUDIT_KINDS } from '../../src/core/audit.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { apiPort, type PortBody } from '../../src/ui/port-model.ts';
import { removeTree } from '../helpers/tmp.ts';
import { allowedClasses } from '../helpers/shipped-classes.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const PORT_JS = path.join(PUBLIC, 'screens', 'port.js');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');

const portSource = readFileSync(PORT_JS, 'utf8');

/**
 * The same file with its comments removed — the bytes the browser acts on.
 *
 * Needed for exactly one assertion, and needed there because port.js cites
 * other modules' lines VERBATIM, `config.js`'s PROPOSED badge among them. A
 * scan of the whole file for that badge finds two and reports the screen
 * drawing one twice, which is a failure with nothing behind it. Every other
 * scan below runs over `portSource`, because a citation that mentioned
 * `innerHTML` or an audit kind's name would be a thing worth failing on.
 */
const portCode = portSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/* -------------------------------------------------------------------------- *
 * The fixture, and the response it makes possible.
 * -------------------------------------------------------------------------- */

let fixtureDir: string | null = null;

function workspace(): string {
  if (fixtureDir === null) {
    const dir = mkdtempSync(path.join(tmpdir(), 'myctx-port-screen-'));
    const run = (args: string[]): void => {
      assert.equal(runCli(args, dir, () => {}), 0, `fixture command failed: ${args.join(' ')}`);
    };
    run(['init']);
    run(['add', 'rule', 'Always use POSIX paths',
      '--scope', 'src/**', '--body', 'Use POSIX.', '--yes']);
    fixtureDir = dir;
  }
  return fixtureDir;
}

after(() => { if (fixtureDir !== null) removeTree(fixtureDir); });

/** What the screen will actually be handed, from the endpoint that hands it. */
function served(): PortBody {
  const result = apiPort(resolveWorkspace(workspace()), new URL('http://x/api/port'));
  assert.equal(result.status, 200, 'the fixture workspace did not answer /api/port');
  return result.body as PortBody;
}

/* -------------------------------------------------------------------------- *
 * The module under test, loaded the way the browser would resolve it.
 * -------------------------------------------------------------------------- */

interface ChipSpec { cls: string; glyph: string; key: string }
interface Rung { nameKey: string | null; label: string | null; noteKey: string | null }
interface RungView extends Rung { id: string; badge: boolean }
interface KindChip { kind: string; cls: string; glyph: string }

/**
 * The screen's published interface. Hand-declared rather than inferred, so it
 * is an assertion in its own right: a module that drifts from it fails here
 * rather than in a browser nobody is watching.
 */
interface PortModule {
  VERDICT_CHIP: Record<string, ChipSpec>;
  RUNGS: Record<string, Rung>;
  BUCKET_CHIP: Record<string, ChipSpec>;
  rungView: (format: { id?: string; built?: boolean }) => RungView;
  bucketView: (name: string) => ChipSpec | null;
  auditChips: (history: { carries?: unknown; withheld?: unknown } | undefined) => KindChip[];
  exportCommand: (body: unknown) => string;
  render: (root: unknown, ctx: unknown) => Promise<void>;
}

/** `from '/lib/command.js'` — the browser's own specifier form. */
const ROOT_SPECIFIER = /(\bfrom\s+')\/([^']+)'/g;

async function portModule(): Promise<PortModule> {
  let rewritten = 0;
  const text = portSource.replace(ROOT_SPECIFIER, (_all, head: string, spec: string) => {
    rewritten += 1;
    return `${head}${pathToFileURL(path.join(PUBLIC, spec)).href}'`;
  });
  assert.equal(rewritten, 2,
    'expected port.js to import two browser modules (/lib/command.js, /screens/parts.js); the '
    + `rewrite matched ${rewritten}. A specifier this pattern cannot see is a module Node would `
    + 'resolve from the drive root, and the import below would fail for a reason that reads like '
    + 'a missing file.');
  assert.ok(!/\bfrom\s+'\//.test(text),
    'a root-absolute specifier survived the rewrite — the module graph imported below would not '
    + 'be the one the browser runs');
  const encoded = Buffer.from(text, 'utf8').toString('base64');
  return (await import(`data:text/javascript;charset=utf-8;base64,${encoded}`)) as PortModule;
}

/** `<section data-p="port">…</section>`, the design of record for this screen. */
function mockupSection(): string {
  const html = readFileSync(MOCKUP, 'utf8');
  const start = html.indexOf('<section data-p="port"');
  assert.notEqual(start, -1, 'the mockup has no [data-p="port"] section');
  const end = html.indexOf('</section>', start);
  assert.notEqual(end, -1, 'the port section is never closed');
  return html.slice(start, end);
}

/* -------------------------------------------------------------------------- *
 * Coverage: the three tables against what the endpoint really serves.
 * -------------------------------------------------------------------------- */

test('every verdict, rung and bucket /api/port serves has exactly one rendering here', async () => {
  const { VERDICT_CHIP, RUNGS, BUCKET_CHIP } = await portModule();
  const body = served();

  // BOTH directions, three times over. A served name with no entry is a row
  // the screen would draw blank or drop; an entry with no served name is dead
  // markup that nothing can reach, and the second is how a lookup table comes
  // to disagree with the endpoint without any test noticing.
  const verdicts = [...new Set(body.travels.map((row) => row.verdict))].toSorted();
  assert.deepEqual(Object.keys(VERDICT_CHIP).toSorted(), verdicts,
    'VERDICT_CHIP and the verdicts /api/port computes have diverged');

  assert.deepEqual(Object.keys(RUNGS).toSorted(), body.formats.map((f) => f.id).toSorted(),
    'RUNGS and the format ladder /api/port serves have diverged');

  assert.deepEqual(Object.keys(BUCKET_CHIP).toSorted(), [...body.buckets].toSorted(),
    'BUCKET_CHIP and the buckets /api/port serves have diverged');

  // Every chip names a key, and no two rows of one table wear the same word:
  // three buckets sharing a label is a table that says nothing.
  const keys = [...Object.values(VERDICT_CHIP), ...Object.values(BUCKET_CHIP)].map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length, 'two chips are drawn with the same string key');
});

/* -------------------------------------------------------------------------- *
 * The rung that is drawn and is not built.
 * -------------------------------------------------------------------------- */

test('the unbuilt rung is drawn and badged, never dropped and never silently offered', async () => {
  const { rungView } = await portModule();
  const body = served();

  const unbuilt = body.formats.filter((format) => !format.built);
  assert.deepEqual(unbuilt.map((f) => f.id), ['bundle'],
    'the ladder this screen was written against has one unbuilt rung, and it is `bundle`');

  const view = rungView(unbuilt[0]!);
  assert.equal(view.badge, true,
    'the rung /api/port marks built:false is drawn with no badge — the screen is offering a '
    + 'format --format refuses');
  // Drawn, not dropped: it keeps the mockup's own name and the sentence both
  // string tables still ship for it.
  assert.equal(view.label, 'git bundle');
  assert.equal(view.noteKey, 'port.f2n');

  for (const format of body.formats.filter((f) => f.built)) {
    assert.equal(rungView(format).badge, false,
      `${format.id} ships and is badged PROPOSED — the app's rule is that a built feature drops `
      + 'the badge');
  }

  // Nothing on the ladder loses its sentence. A rung drawn with no prose is a
  // row the reader cannot act on, which is the drop this badge exists to avoid.
  for (const format of body.formats) {
    assert.notEqual(rungView(format).noteKey, null, `${format.id} is drawn with no note`);
  }
});

test('the bundle rung wears the mockup\'s own literal, read out of the mockup', async () => {
  const { RUNGS } = await portModule();
  // Read out of the design of record rather than copied into this file. A copy
  // would go stale the moment the mockup renamed the rung and nothing would
  // say so — the defect the citation form exists to end, one layer down.
  const section = mockupSection();
  const literal = /<b class="m">([^<]+)<\/b>/.exec(section);
  assert.ok(literal, 'the port section no longer draws a literal <b class="m"> name');
  assert.equal(RUNGS.bundle!.label, literal[1]);
  assert.equal(RUNGS.bundle!.nameKey, null,
    'the middle rung has no name key in either string table — the mockup writes it as a literal '
    + 'because a command name is not translated');

  // The other two are the opposite shape, and the mockup says so with data-t.
  for (const id of ['dir', 'zip']) {
    assert.notEqual(RUNGS[id]!.nameKey, null, `${id} is described in prose and needs its key`);
    assert.equal(RUNGS[id]!.label, null, `${id} carries a literal name the mockup does not draw`);
    assert.ok(section.includes(`data-t="${RUNGS[id]!.nameKey}"`),
      `the mockup no longer names ${RUNGS[id]!.nameKey} — the design of record moved`);
  }
});

test('rungView refuses to describe a rung the design of record has no row for', async () => {
  const { rungView, RUNGS } = await portModule();
  // A third artefact format fails the endpoint's own compile-time check before
  // it could ever be served, so this branch should be unreachable. "Should be
  // unreachable" is not a reason to fall back to a neighbouring rung, which is
  // how a screen comes to describe `tar` as "canonical. Readable, diffable".
  const view = rungView({ id: 'tar', built: true });
  assert.equal(view.label, 'tar', 'an unknown rung loses its own name');
  assert.equal(view.nameKey, null);
  assert.equal(view.noteKey, null,
    'an unknown rung was handed prose written for a different format');
  assert.notEqual(view.noteKey, RUNGS.dir!.noteKey);
  assert.equal(view.badge, false);

  // A response that omitted the flag is not a licence to call a shipped format
  // unbuilt: badging one is the worse of the two mistakes.
  assert.equal(rungView({ id: 'dir' }).badge, false);
});

test('bucketView returns null rather than a neighbouring bucket\'s chip', async () => {
  const { bucketView, BUCKET_CHIP } = await portModule();
  for (const [name, spec] of Object.entries(BUCKET_CHIP)) {
    assert.deepEqual(bucketView(name), spec);
  }
  assert.equal(bucketView('quarantined'), null,
    'a fourth bucket was given a chip meant for one of the three');
});

/* -------------------------------------------------------------------------- *
 * The audit vocabulary — the fact `port.hist` got wrong twice.
 * -------------------------------------------------------------------------- */

test('auditChips is the RESPONSE\'s partition of the audit vocabulary, hue and all', async () => {
  const { auditChips } = await portModule();
  const body = served();
  const chips = auditChips(body.history);

  // Together the chips are exactly the vocabulary — no kind lost between the
  // response and the screen, and none invented on the way.
  assert.deepEqual(chips.map((c) => c.kind).toSorted(), [...AUDIT_KINDS].toSorted());
  assert.deepEqual(
    chips.filter((c) => c.cls === 'chip ok').map((c) => c.kind), body.history.carries,
    'what carries is not drawn with the travels hue, in the endpoint\'s own order');
  assert.deepEqual(
    chips.filter((c) => c.cls === 'chip warn').map((c) => c.kind), body.history.withheld,
    'what is withheld is not drawn with the withheld hue, in the endpoint\'s own order');

  // The number `port.hist` asserted as three until 2026-08-23 and asserts as
  // five today. The chips are the only place on this screen where it is
  // MEASURED rather than written, so the day a seventh kind lands the screen
  // grows a chip and the sentence does not.
  assert.equal(chips.length, AUDIT_KINDS.length);
  assert.equal(chips.filter((c) => c.cls === 'chip warn').length, 5);

  // A response with nothing in it draws nothing, rather than throwing on a
  // screen whose other two cards are fine.
  assert.deepEqual(auditChips(undefined), []);
  assert.deepEqual(auditChips({ carries: null, withheld: 'mutation' }), []);
});

test('no audit kind is transcribed into the screen — the list can only come from the wire', async () => {
  // The assertion that makes the one above mean something. `auditChips` could
  // satisfy every check there and still be a hand-written list that happens to
  // agree with this build; it cannot if no kind's name appears in the file.
  // Quoted forms only, so this stays true of prose in the comments — but the
  // module deliberately never quotes one, in a comment or anywhere else.
  for (const kind of AUDIT_KINDS) {
    assert.ok(!portSource.includes(`'${kind}'`) && !portSource.includes(`"${kind}"`),
      `port.js writes the audit kind "${kind}" as a literal. The withheld list is served — `
      + 'derived from AUDIT_KINDS at request time so it cannot go stale - and a copy here is '
      + 'the drift /api/port was built to end.');
  }
});

/* -------------------------------------------------------------------------- *
 * The one composed line, and the argument it does not supply.
 * -------------------------------------------------------------------------- */

test('exportCommand composes the served argv and appends no destination', async () => {
  const { exportCommand } = await portModule();
  const body = served();
  const composed = exportCommand(body);

  assert.equal(composed, 'mycontext export --out');
  assert.deepEqual(body.command.argv, ['mycontext', 'export', '--out'],
    'the endpoint stopped serving an incomplete argv, and this screen composes what it is sent');

  // Against the design of record, read out of it. The mockup's block shows a
  // complete line with a dated path; that path is an ILLUSTRATION, and a
  // server that invented one would hand the reader a command that looks ready
  // and writes somewhere they did not choose.
  const code = /<code>([^<]+)<\/code>/.exec(mockupSection());
  assert.ok(code, 'the port section draws no <code> command');
  assert.ok(code[1]!.startsWith(`${composed} `),
    `the composed line is not the mockup's own command minus its destination: ${code[1]}`);
  assert.equal(code[1]!.split(' ').length, body.command.argv.length + 1,
    'the composed line is short by something other than exactly one argument');
  assert.notEqual(composed, code[1],
    'the screen composes the mockup\'s illustrative destination as though it were data');

  // `--out`, not `--to`. The mockup wrote `--to` until 2026-08-23 and the
  // parser refuses it as an unknown flag.
  assert.ok(composed.includes('--out') && !composed.includes('--to'));
});

test('exportCommand refuses rather than assembling a line of its own', async () => {
  const { exportCommand } = await portModule();
  for (const body of [undefined, {}, { command: {} }, { command: { argv: [] } },
    { command: { argv: 'mycontext export --out' } }]) {
    assert.throws(() => exportCommand(body), /command\.argv/,
      `a body with no usable argv composed a line anyway: ${JSON.stringify(body)}`);
  }

  // Through the ONE place quoting lives. Nothing in today's argv needs a
  // quote; that is not the point. A second implementation written for a
  // three-token line is how the two come to disagree the day one carries a
  // path with a space — which is the day this command is completed.
  assert.equal(
    exportCommand({ command: { argv: ['mycontext', 'export', '--out', '../shared dir'] } }),
    'mycontext export --out "../shared dir"');
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
 * Every key `port.js` names. The screen names them in three shapes — a direct
 * `ctx.t('port.h')`, a `key:` field inside a chip table, and a `for` over a
 * literal array of column heads — so the scan is for the key SHAPE rather than
 * for one call form, which is the only pattern all three share.
 */
function keysNamed(): string[] {
  return [...portSource.matchAll(/'((?:port|th|btn)\.[A-Za-z0-9]+)'/g)].map((m) => m[1]!);
}

test('every string key the port screen names is declared in both tables, with its slots supplied', async () => {
  const en = await table('en');
  const he = await table('he');
  const used = keysNamed();

  // A scanner that finds nothing reads exactly like a clean file.
  assert.ok(new Set(used).size >= 21,
    `the scan found ${new Set(used).size} distinct key(s) in port.js; the screen names the `
    + 'eighteen `port.` keys plus `th.bucket`, `th.example` and `btn.copy`. A collapse means the '
    + 'pattern stopped matching, not that the screen stopped naming keys.');

  // The grammar has ONE parser and this is it. Eight files used to carry a
  // private scanner instead, all of them predating emphasis, and every one
  // read `{b:` as a substitution named `b:...` the day emphasis landed.
  const { slots: slotsOf } = await import(
    new URL('../../src/ui/public/lib/i18n.js', import.meta.url).href
  ) as { slots: (template: string) => string[] };

  for (const key of used) {
    assert.ok(key in en, `port.js names ${key}, missing from the English table`);
    assert.ok(key in he, `port.js names ${key}, missing from the Hebrew table`);
    // Both tables, not only English: `t()` throws on a substitution the caller
    // did not pass, and it throws in whichever language the reader chose.
    // Every key this screen places is a bare sentence today; a slot added to
    // one, in either language, is a screen that blanks until a call site
    // supplies it.
    for (const template of [en[key]!, he[key]!]) {
      assert.deepEqual(slotsOf(template), [],
        `${key} declares a slot that this screen's call sites do not supply — t() throws and the `
        + 'screen blanks');
    }
  }
});

test('every port. key the English table declares is placed by the screen', async () => {
  const en = await table('en');
  const declared = Object.keys(en).filter((key) => key.startsWith('port.')).sort();
  const named = new Set(keysNamed());
  // The other direction of the same fact. `strings-parity` proves the two
  // tables agree with the mockup's `data-t` set; it cannot prove the screen
  // ever draws one. A key declared for this screen and placed nowhere is a
  // sentence of the design of record that silently does not render.
  assert.deepEqual(declared.filter((key) => !named.has(key)), [],
    'these port. keys are declared and drawn nowhere');
  assert.equal(declared.length, 18,
    `the English table declares ${declared.length} port. key(s); it has been 18 since this screen `
    + 'was written. A new one is a new sentence on this screen and needs placing.');
});

test('no translated string is assigned — t() returns nodes and they are appended (ruling A1)', async () => {
  // `t()` returns Node[]. Assigning one to `textContent` renders `[object
  // Object]`; assigning `tFlat()` to `innerHTML` would destroy the `.m` spans
  // that carry the direction isolation, which is the mockup's own standing
  // rule. Neither is reachable by any other test: this module's DOM half is
  // never evaluated.
  assert.ok(!/textContent\s*=\s*ctx\.t/.test(portSource),
    'a translated value is assigned to textContent');
  assert.ok(!/innerHTML/.test(portSource), 'innerHTML has no legitimate use in a screen module');
  assert.ok(/\.append\(\.\.\.ctx\.t\(/.test(portSource),
    'the screen appends no translated nodes at all — the scan above is checking nothing');
});

test('the screen invents no class the mockup\'s own port section does not use', async () => {
  const section = mockupSection();
  const drawn = new Set<string>();
  for (const m of section.matchAll(/class="([^"]+)"/g)) {
    for (const token of m[1]!.trim().split(/\s+/)) drawn.add(token);
  }
  assert.ok(drawn.size >= 12, `the mockup scan found ${drawn.size} class token(s) — too few to be `
    + 'the port section, so the extraction is broken rather than the screen clean');

  // Two shapes: the class argument of `el(...)`, and the `cls:` field of the
  // three chip tables — where every chip class on this screen actually lives.
  const written: string[] = [];
  for (const m of portSource.matchAll(/\bel\('[a-z0-9]+',\s*'([^']*)'/g)) written.push(m[1]!);
  for (const m of portSource.matchAll(/\bcls:\s*'([^']*)'/g)) written.push(m[1]!);
  assert.ok(written.length >= 12,
    `the port.js scan found ${written.length} class string(s); the screen writes at least twelve`);

  for (const value of written) {
  const allowed = allowedClasses(drawn);
    for (const token of value.trim().split(/\s+/)) {
      // `allowed`, not `drawn`: the mockup's classes UNION what styles.css
      // actually styles. See test/helpers/shipped-classes.ts — the app is what
      // gets built now, so a NEW class with a real rule is ordinary development;
      // a typo still has no rule anywhere and still fails here.
      assert.ok(allowed.has(token),
        `port.js writes class "${token}", which <section data-p="port"> never uses. A class the `
        + 'design of record does not draw is either a typo or a decision the owner has not taken.');
    }
  }

  // The composites the screen turns on, pinned as whole attribute values
  // rather than as loose tokens: a chip that took `chip` without `warn` would
  // satisfy the token check above and draw an unreadable label on a dark panel.
  for (const composite of ['card pane', 'chip ok', 'chip warn', 'chip gov']) {
    assert.ok(section.includes(`class="${composite}"`),
      `the mockup no longer draws class="${composite}" — the design of record moved`);
    assert.ok(written.includes(composite),
      `port.js no longer writes the "${composite}" pair the mockup draws`);
  }
});

test('the head keeps the mockup\'s shape and moves its PROPOSED badge to the unbuilt rung', async () => {
  // The design of record still badges the whole screen, and that is deliberate
  // — the owner's ruling of 2026-08-23 keeps the mockup as the historical
  // record of what was proposed when it was drawn. If this stops being true,
  // the reasoning in port.js's header is about a file that changed.
  assert.ok(mockupSection().includes('<span class="verdict"><span class="prop">PROPOSED</span>'),
    'the mockup no longer badges the port section — the accepted divergence this screen relies '
    + 'on has become something else');

  // The app draws the badge exactly once, and not in the head: `mycontext
  // export` ships and `port.sub` says so, so the screen-level badge is dropped
  // and the one thing that really is named-and-not-real keeps it.
  //
  // Counted over the CODE and not the file: port.js cites `config.js`'s own
  // badge line verbatim, and a scan that counted citations would report two
  // badges where the screen draws one — a red with nothing behind it, which
  // this project has already learned is the most expensive kind.
  const badges = [...portCode.matchAll(/el\('span',\s*'prop'/g)];
  assert.equal(badges.length, 1,
    `port.js draws ${badges.length} PROPOSED badge(s); it draws exactly one, on the unbuilt rung`);

  const head = portCode.indexOf('function portHead');
  assert.notEqual(head, -1, 'portHead is gone — the head is drawn somewhere this test cannot see');
  const headEnd = portCode.indexOf('\n}', head);
  assert.ok(headEnd > head);
  assert.ok(!portCode.slice(head, headEnd).includes('prop'),
    'the screen head badges itself PROPOSED over a subtitle that says the feature is built');
  // The rest of the head is the mockup's, `screenHead`'s shape without the
  // verdict key neither string table declares.
  for (const cls of ['phd', 'verdict', 'psub']) {
    assert.ok(portCode.slice(head, headEnd).includes(`'${cls}'`),
      `the head no longer draws .${cls}, which every screen in the design of record opens with`);
  }

  // And the one badge is on the rung, which is the whole of the ruling this
  // screen took: the badge was MOVED, not deleted.
  const rung = portCode.indexOf('function rungRow');
  assert.notEqual(rung, -1, 'rungRow is gone — the ladder is drawn somewhere this test cannot see');
  const rungEnd = portCode.indexOf('\n}', rung);
  assert.ok(portCode.slice(rung, rungEnd).includes("el('span', 'prop', 'PROPOSED')"),
    'the unbuilt rung no longer carries the badge — a format --format refuses is being offered '
    + 'as though it shipped');
});
