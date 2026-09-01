/**
 * **The Configure screen's decidable half, and the parity checks that keep the
 * undecidable half honest.**
 *
 * `src/ui/public/screens/config.js` is DOM glue, and DOM glue is the stated
 * untested surface (spec §6, and `test/ui/viewmodel.test.ts`'s own header: *"the
 * DOM rendering in `app.js` and `screens/*.js` has no test — that would need a
 * browser dependency this project does not have"*). That is not licence to test
 * nothing. SEVEN things on this screen are decisions rather than pixels, and all
 * seven are exported from the module and exercised here against the real bytes:
 *
 *   1. `budgetRows` — which budget is drawn as a PAIR and which as a lone
 *      number, and in what order the four rows come out.
 *   2. `jsonBlock` — the exact text the Copy button puts on the clipboard. It
 *      is pasted into `.my_context/config.json` by hand, so its indentation is
 *      a contract with a file, not a styling choice, and it is asserted against
 *      the design of record's own `<pre>` bytes below.
 *   3. `policyPositions` — which segbar position is pressed, and what happens
 *      when the resolved config has no such category.
 *   4. `categoryEntry` — that the composed block is an entry INSIDE the file's
 *      `categories` object and not a top-level key, which `plan:config seq:4`
 *      names as the acceptance test for the whole composer, and that it merges
 *      over the RAW entry rather than the resolved one.
 *   5. `valueDeltas` — which configuration values are drawn as a before→after
 *      row, and which are not a change at all.
 *   6. `blastReading` — the face a blast panel wears for a given preview, which
 *      is where "measured, not estimated" is decided.
 *   7. `verifyPlan` — the line each pane composes, built from the catalogue the
 *      SERVER rebuilds the argv from, so the two cannot disagree.
 *
 * Plus three scans that no unit test of a pure function can replace: that the
 * screen names every `data-t` key its mockup section declares (a forgotten card
 * is a silent one), that every key it names is declared in BOTH string tables
 * (this screen is now mostly app-only keys, which the mockup scan cannot see),
 * and that its CODE reaches the network only through the two contract methods
 * on the paths that are ruled in.
 *
 * ── WHAT MOVED ON 2026-08-29 ───────────────────────────────────────────────
 *
 * `plan:config seq:1`, `plan:walk seq:13` and `plan:walk seq:10` rewrote the
 * screen into four composer panes with a live preview behind each. Two clauses
 * of the old network test were true only of a screen that could neither preview
 * nor compose, and both are gone with their reasons recorded at the test itself:
 * this screen composes CLI command lines now, and it POSTs a candidate config to
 * a route that reads. What it still may not do is write anything but a budget,
 * and that is still asserted.
 *
 * ── HOW A TYPESCRIPT TEST IMPORTS A BROWSER SCREEN MODULE ──────────────────
 *
 * `test/ui/viewmodel.test.ts` imports `src/ui/public/lib/*.js` through a `file://`
 * URL, for reasons it states at length — `allowJs` is off, so a relative
 * specifier is TS7016, and a URL specifier is also the only form that survives a
 * Windows path. A SCREEN module cannot be imported that way as it stands: every
 * screen resolves its helpers through the server's own absolute route,
 * `'/screens/parts.js'`, which the browser resolves against the origin and Node
 * resolves against the filesystem root — where there is no `screens/` directory.
 *
 * So the module is read, that ONE specifier is rewritten to the real file URL,
 * and the result is imported as a `data:` module. The rewrite is asserted to
 * have found its target before it is used, so this never silently tests a
 * mutation of the file rather than the file: if the import line changes shape,
 * this fails loudly instead of importing something that is not the screen.
 *
 * The alternative — spelling the import `'./parts.js'` in the screen so Node can
 * resolve it — was rejected: eleven screens use the absolute form, and a twelfth
 * spelling one convention differently to suit its test is how two of them come
 * to disagree about it later. The test bends, the shipped code does not.
 *
 * **What this file therefore cannot see**, stated rather than left to be
 * discovered: `render()` is never called. Nothing here proves an element is
 * appended, ordered, or styled; the app-versus-mockup element comparison is
 * `e2e/screen-parity.spec.ts`'s job, and the screen's own report carries the
 * measured gap list it feeds.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_BUDGETS, SCOPE_POLICIES, resolveConfig } from '../../src/core/config.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const SCREENS = path.join(REPO, 'src', 'ui', 'public', 'screens');
const LIB = path.join(REPO, 'src', 'ui', 'public', 'lib');
const SCREEN = path.join(SCREENS, 'config.js');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');

/** The one specifier Node cannot resolve, and the exact bytes to rewrite. */
const PARTS = "'/screens/parts.js'";

/**
 * The two absolute specifiers the budgets Write control (task `plan:budget
 * seq:5`) added, rewritten the SAME way `PARTS` is — Node cannot resolve an
 * absolute `/lib/…` specifier any more than it can `/screens/…`, for the same
 * reason (the browser resolves it against the origin; Node has no `lib/` at
 * its filesystem root).
 */
const CMD_ACTIONS = "'/lib/command-actions.js'";
const VIEWMODEL = "'/lib/viewmodel.js'";
/**
 * The two the composer added on 2026-08-29 (`plan:walk seq:13`). A composed
 * command line on this screen goes through the SAME two modules every other
 * composed line in this UI goes through — `PALETTE`/`commandFor` and
 * `composeCommand` — and both are absolute specifiers for the same reason as
 * the three above.
 */
const COMMAND = "'/lib/command.js'";
const PALETTE_DEFS = "'/lib/palette-defs.js'";

/** This task's published interface — hand-declared, so drift fails here. */
interface ConfigScreen {
  SP_CATEGORY: string;
  budgetRows: (
    budgets: Record<string, number> | null,
    defaults: Record<string, number>,
  ) => { key: string; was: number | null; will: number }[];
  jsonBlock: (key: string, value: unknown) => string;
  policyPositions: (
    categories: { name: string; scopePolicy: string }[],
    policies: readonly string[],
    name: string,
  ) => { name: string; current: string; positions: { value: string; pressed: boolean }[] } | null;
  categoryEntry: (
    raw: unknown, name: string, changed: Record<string, unknown>,
  ) => Record<string, unknown>;
  valueDeltas: (
    before: Record<string, unknown>, after: Record<string, unknown>,
  ) => { path: string; was: string | null; will: string }[];
  blastReading: (preview: unknown) => {
    face: 'none' | 'starts' | 'fits' | 'edits' | 'stops' | 'spills';
    level: 'none' | 'warn' | 'crit';
    n: number; stops: number; becomes: number;
    dropped: number; added: number; edited: number; unchanged: number;
  };
  verifyPlan: (name: string, values?: Record<string, string>) => {
    id: string; values: Record<string, string>; argv: string[];
  };
  pastePlan: (
    file: { exists: boolean; raw: unknown },
    block: { key: string; value: unknown; entry?: string },
  ) => { where: string; anchor: string; last: string | null; text: string };
}

const source = (): string => readFileSync(SCREEN, 'utf8');
const mockup = (): string => readFileSync(MOCKUP, 'utf8');

async function screen(): Promise<ConfigScreen> {
  let text = source();
  for (const [specifier, real] of [
    [PARTS, path.join(SCREENS, 'parts.js')],
    [CMD_ACTIONS, path.join(LIB, 'command-actions.js')],
    [VIEWMODEL, path.join(LIB, 'viewmodel.js')],
    [COMMAND, path.join(LIB, 'command.js')],
    [PALETTE_DEFS, path.join(LIB, 'palette-defs.js')],
  ] as const) {
    assert.ok(text.includes(`from ${specifier};`),
      `screens/config.js no longer imports from ${specifier}; the rewrite below would import an `
      + 'unmodified module and fail on a specifier Node cannot resolve, so fix the rewrite rather '
      + 'than deleting this assertion.');
    text = text.replace(specifier, JSON.stringify(pathToFileURL(real).href));
  }
  return (await import(`data:text/javascript,${encodeURIComponent(text)}`)) as ConfigScreen;
}

/** `<section data-p="config">` … `</section>`, the design of record for this screen. */
function configSection(): string {
  const html = mockup();
  const start = html.indexOf('<section data-p="config"');
  assert.notEqual(start, -1, 'the mockup has no <section data-p="config">');
  const end = html.indexOf('</section>', start);
  assert.notEqual(end, -1, 'the config section is not closed');
  return html.slice(start, end);
}

/**
 * The screen's own source with comment lines removed.
 *
 * `lib/command.js` records the reason in its own header: *"a checker that scans
 * bytes is defeated by a comment that lists what it looks for"*. This screen's
 * header names `style="…"`, `fetch`, `POST /api/config/check` and `quoteArg`
 * while explaining why it uses none of them, and a scan that could not tell a
 * binding from a sentence about one would read that header as four offences.
 *
 * Line-level, not a JS parser: every comment in this file's subject is either a
 * `//` line or a `*`-continued block line. A trailing comment after code would
 * be missed, which is stated rather than hidden — it makes the scan narrower,
 * never wider, and a name smuggled into a trailing comment is still not a call.
 */
function codeLines(): string {
  return source()
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !(trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'));
    })
    .join('\n');
}

test('budgetRows draws a changed budget as a pair and an unchanged one as a number', async () => {
  const { budgetRows } = await screen();
  const defaults = { pinned: 6000, jit: 6000, restored: 8000, continuity: 2000, index: 1200 };

  // `was` is the shipped default and is null when the file changes nothing:
  // "6000 → 8000" is a pair a reader can check, and "8000" on its own is the
  // whole truth when nothing moved. The mockup draws exactly this asymmetry —
  // one row of its four carries an arrow.
  assert.deepEqual(budgetRows(
    { pinned: 6000, jit: 8000, restored: 8000, continuity: 2000, index: 900 }, defaults,
  ), [
    { key: 'pinned', was: null, will: 6000 },
    { key: 'jit', was: 6000, will: 8000 },
    { key: 'restored', was: null, will: 8000 },
    { key: 'continuity', was: null, will: 2000 },
    { key: 'index', was: 1200, will: 900 },
  ]);

  // A budget the endpoint did not carry falls back to the default and pairs
  // with nothing — an absent value is not a change — and a key that is not a
  // budget is not a row, however the response spelled it.
  assert.deepEqual(budgetRows({}, { jit: 6000 }), [{ key: 'jit', was: null, will: 6000 }]);
  assert.deepEqual(budgetRows({ mystery: 1 } as Record<string, number>, { jit: 6000 }),
    [{ key: 'jit', was: null, will: 6000 }]);
  assert.deepEqual(budgetRows(null, { jit: 6000 }), [{ key: 'jit', was: null, will: 6000 }]);

  // The ORDER is the defaults object's, and `meta.defaultBudgets` is
  // `DEFAULT_BUDGETS` passed through — so the table's rows come out in the
  // mockup's own order without this file, or that one, listing the five tiers.
  // Spread, because `Budgets` is an interface and an interface has no implicit
  // index signature; the spread's inferred type does, and the VALUES are the
  // real ones either way.
  const shipped: Record<string, number> = { ...DEFAULT_BUDGETS };
  assert.deepEqual(budgetRows(shipped, shipped).map((row) => row.key),
    ['pinned', 'jit', 'restored', 'continuity', 'index']);
});

test('jsonBlock composes the paste text at the design of record\'s own indentation', async () => {
  const { jsonBlock } = await screen();

  const budgets = jsonBlock('budgets', { pinned: 6000, jit: 8000 });
  assert.equal(budgets, '  "budgets": {\n    "pinned": 6000,\n    "jit": 8000\n  }');
  assert.equal(jsonBlock('watchedDocs', ['docs/adr/**', 'README.md']),
    '  "watchedDocs": [\n    "docs/adr/**",\n    "README.md"\n  ]');

  // **Against the mockup's bytes, not against a memory of them.** Both `<pre>`
  // blocks in `<section data-p="config">` open at two spaces and close at two,
  // because the block is pasted INTO an object — the composer's indentation is
  // a contract with `config.json`, and the design of record is where it is
  // written down.
  const section = configSection();
  assert.ok(section.includes(`<pre class="m">${budgets.split('\n')[0]}`),
    'the mockup opens its budgets block with a different line than jsonBlock composes');
  assert.ok(section.includes('<pre class="m">  "watchedDocs": ['),
    'the mockup opens its watchedDocs block with a different line than jsonBlock composes');
  assert.ok(section.includes('  }</pre>') && section.includes('  ]</pre>'),
    'the mockup closes its two blocks at some indentation other than two spaces');

  // An empty section is still a block, not a bare brace: a user with no
  // `watchedDocs` key yet gets something they can paste and fill in.
  assert.equal(jsonBlock('watchedDocs', []), '  "watchedDocs": []');
});

test('policyPositions presses the resolved policy, in the server\'s own order', async () => {
  const { policyPositions, SP_CATEGORY } = await screen();
  const categories = [
    { name: 'lesson', scopePolicy: 'required' },
    { name: 'rule', scopePolicy: 'global' },
  ];

  const bar = policyPositions(categories, SCOPE_POLICIES, 'lesson');
  assert.notEqual(bar, null);
  assert.equal(bar!.current, 'required');
  // Declaration order, never sorted: the CLI's refusals list the policies in
  // this order, so a bar that reordered them would teach a different vocabulary
  // from the one the refusal prints.
  assert.deepEqual(bar!.positions.map((p) => p.value), [...SCOPE_POLICIES]);
  // Exactly one pressed — an aria-pressed bar with two is a bar that lies.
  assert.deepEqual(bar!.positions.filter((p) => p.pressed).map((p) => p.value), ['required']);

  // No such category is null, and null is what stops the card being drawn at
  // all — a heading naming a category this config does not have would be the
  // screen asserting a setting that is not there.
  assert.equal(policyPositions(categories, SCOPE_POLICIES, 'nowhere'), null);
  assert.equal(policyPositions([], SCOPE_POLICIES, SP_CATEGORY), null);

  // The card's subject is the mockup's, and it is a real catalogue category
  // rather than a name chosen here: `resolveConfig({})` is the loader's own
  // answer for a workspace that configures nothing.
  assert.ok(configSection().includes(`categories.${SP_CATEGORY}.scopePolicy`),
    'the mockup no longer names this category in its scopePolicy card');
  assert.ok(SP_CATEGORY in resolveConfig({}).categories,
    `${SP_CATEGORY} is not a category the default catalogue resolves`);

  // The three positions the mockup's own script builds ARE the server's three
  // policies. Either side changing without the other is what this catches.
  assert.ok(mockup().includes("for(const v of ['global','required','inert'])"),
    'the mockup builds its scopePolicy bar from a different list than it used to');
  assert.deepEqual([...SCOPE_POLICIES], ['global', 'required', 'inert']);
});

test('the screen names every data-t key its mockup section declares', async () => {
  const section = configSection();
  const declared = new Set<string>();
  for (const m of section.matchAll(/data-t(?:-aria)?="([^"]+)"/g)) declared.add(m[1]!);
  // A scan that finds nothing reads exactly like a screen that draws everything.
  assert.ok(declared.size >= 15,
    `only ${declared.size} data-t key(s) found in <section data-p="config">; the pattern has `
    + 'stopped matching rather than the mockup having stopped keying its text.');

  const code = codeLines();
  const named = new Set<string>();
  for (const m of code.matchAll(/ctx\.t(?:Flat)?\('([^']+)'/g)) named.add(m[1]!);
  // `screenHead(ctx, root, titleKey, verdictKey, subKey)` carries three keys
  // that the pattern above cannot see — the same shape `viewmodel.test.ts`
  // handles, and for the same reason.
  for (const m of code.matchAll(/screenHead\(ctx, root, '([^']+)', '([^']+)', '([^']+)'/g)) {
    named.add(m[1]!);
    named.add(m[2]!);
    named.add(m[3]!);
  }

  // The mockup is the specification. A key it declares and the screen never
  // names is a piece of the design that silently did not get built — which is
  // precisely how a screen ships looking finished and measuring short.
  assert.deepEqual([...declared].filter((key) => !named.has(key)).sort(), [],
    'these keys are drawn by <section data-p="config"> and named nowhere in screens/config.js');
});

/**
 * REWRITTEN 2026-08-29 — `plan:walk seq:13`, `plan:walk seq:10`. Two of this
 * test's clauses were true of a screen that could neither preview nor compose,
 * and the owner's ruling ended both.
 *
 * **`composes no CLI command` is gone, and it was gone deliberately.** The
 * house pattern is settled and shipped on the Review queue: a control chooses
 * an outcome, the choice COMPOSES a command line the reader can see, and one
 * Execute runs it behind the approval boundary. Three of the four panes follow
 * it. What `cfg.nocmd` actually asserts is narrower and is still asserted
 * below: no `mycontext` command edits a BUDGET, so the Budgets pane composes
 * none — its outcome goes through `BUDGETS_ID`, and the pane spec that says so
 * is pinned here by its `command: null`.
 *
 * **The POST list grew by exactly one**, and it is a read: `/api/config/preview`
 * validates and previews and writes nothing — `read-model-config.ts` says so of
 * itself, and `test/ui/no-writes.test.ts` holds the server's import graph to it.
 * The verb is HTTP's, chosen because a candidate config does not fit in a query
 * string.
 *
 * What still holds, and still fails: no `fetch(`, no `innerHTML`, no `eval`, no
 * storage — this screen reaches the network through the SAME two contract
 * methods every other screen uses (`ctx.api`/`ctx.post`), never a hand-rolled
 * request.
 */
test('the screen reaches the network only through ctx.api/ctx.post, and only on ruled paths', async () => {
  const code = codeLines();

  // The confirm GET: the literal `/api/config` read, and the dynamic budgets
  // confirm — `ctx.api(confirmPath(...))` can never match a `ctx.api('...'`
  // regex, so it is asserted by substring instead, naming the exact call this
  // file makes rather than a shape a rewrite could satisfy by accident.
  assert.deepEqual([...code.matchAll(/ctx\.api\('([^']+)'/g)].map((m) => m[1]), ['/api/config']);
  assert.ok(code.includes('ctx.api(confirmPath('),
    'the budgets confirm must go through confirmPath, the same query shape /api/execute/confirm reads');

  // **The literal POST targets, and the list is short on purpose.** A path
  // appearing here that is not on this list would mean a second write nobody
  // ruled in, which is exactly what `no-writes.test.ts`'s RULED_WRITES guards
  // on the server side.
  //
  // `/api/config/check` JOINED it on 2026-09-01, and it is a READ: the verb is
  // HTTP's, chosen because a candidate config does not fit in a query string,
  // and `read-model-config.ts` says of itself that everything in it reads,
  // validates and previews and nothing writes. `plan:config seq:3`'s category
  // wizard is its one caller — `preview` answers what a change would DO and
  // `check` answers what the loader MAKES of it, returning the resolved config,
  // which is the answer a flow full of defaults needs and the one every other
  // pane already has from `GET /api/config`.
  //
  // `/api/execute` is still the ONE write on this screen, and it is still only
  // reachable through the budgets confirm above it.
  assert.deepEqual([...code.matchAll(/ctx\.post\('([^']+)'/g)].map((m) => m[1]),
    ['/api/execute', '/api/config/check']);

  // The preview POST, which is a READ. Its path is composed by `previewPath()`
  // — a template literal carrying the shared select grammar, so it cannot match
  // the literal-path regex above and is asserted by the call it makes.
  assert.ok(code.includes('ctx.post(previewPath()'),
    'the delta plate and the blast panels must go through POST /api/config/preview');
  assert.ok(code.includes("selectQuery('session-start', null, 'cold')"),
    'the preview query must be built by the shared select grammar, not spelled a second time');

  // The Budgets pane composes NO command line — the one property `cfg.nocmd`
  // still asserts on screen. Pinned on the pane's own spec rather than on the
  // absence of a string, so a later edit that gave it a line fails here.
  assert.match(code, /key: 'budgets',[^]*?\n {4}command: null,/,
    'the Budgets pane must compose no command line: no mycontext command edits or reports a '
    + 'budget, and a composed line there would be a receipt for a read the CLI cannot perform');

  // The browser-side counterpart of `test/ui/no-writes.test.ts`, which holds the
  // SERVER's import graph to the same rule. A hand-rolled request would void
  // the token this UI's own gate requires, and a markup sink would defeat the
  // CSP this server ships with no `'unsafe-inline'`.
  const forbidden = [
    'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write',
    'eval(', 'new Function', 'XMLHttpRequest', 'sendBeacon',
    'EventSource', 'import(', 'localStorage', 'sessionStorage', 'style="',
  ];
  assert.deepEqual(forbidden.filter((name) => code.includes(name)), [],
    'screens/config.js binds a name that can run, fetch or inject markup');
  // A raw `fetch(` call would carry no token and bypass `ctx.api`/`ctx.post`
  // entirely — `codeLines()` already stripped every comment line, so this
  // matches only executable code, never prose that mentions the word.
  assert.doesNotMatch(code, /\bfetch\(/, 'a raw fetch( call would carry no token and bypass ctx.api/ctx.post');

  // And the positive half: the copy path exists and is the clipboard, because
  // an assertion that only names absences passes on an empty file.
  assert.ok(code.includes('navigator.clipboard.writeText'),
    'the Copy button no longer reaches the clipboard');
});

/**
 * **A budget written here carries the simulator's range up with it** —
 * `REQ-configure-and-the-simulator-agree-on-the-budgets-whatever`, extended by
 * the owner on 2026-08-28 from the budget VALUE to the slider's RANGE: *"the
 * config screen should be synchronized with the simulator"*.
 *
 * A source assertion rather than a rendered one, and deliberately: the write
 * path this sits on ends in a single-use nonce and a real `POST /api/execute`,
 * which this file's stand-in document cannot supply, and the behaviour of
 * `raiseSimRange` itself is measured directly in `test/ui/bounded-list.test.ts`
 * beside the store it lives in. What is left for this file to hold is the WIRE
 * — that the loop applying `outcome.diff` to the fields applies it to the range
 * too — and that is a fact about this file's text.
 */
test('a budget write raises the simulator range for every field it changed', () => {
  const code = source();
  assert.match(code, /raiseSimRange,?\s/,
    "screens/config.js no longer imports raiseSimRange from '/screens/parts.js'. The range store "
    + 'is one definition read by three screens; a second copy of it here would be the drift the '
    + 'shared module exists to prevent.');
  // Inside the `outcome.diff` loop and nowhere else: the diff is the server's
  // own `BudgetFieldDiff[]`, so the range follows what the file NOW says rather
  // than what was typed into a field.
  const loop = /for \(const change of Array\.isArray\(outcome\?\.diff\)[^]*?\n {6}\}/.exec(code);
  assert.ok(loop !== null, 'the outcome.diff loop is no longer recognisable');
  assert.match(loop[0], /raiseSimRange\(key, Number\(change\.after\)\)/,
    'a budget written here can now exceed a range set on the simulator without carrying it up, '
    + 'which leaves the slider unable to reach the budget this screen just put in force');
});

/**
 * **`categoryEntry` is the acceptance test `plan:config seq:4` names**, in that
 * task's own words: *"the file already HAS a `categories` object, so the block
 * is an entry INSIDE it and not a top-level key. Getting that wrong produces
 * invalid JSON and a refusal that reads like the wizard was wrong."*
 *
 * Two properties, and the second is the one a composer gets wrong quietly. The
 * block nests. And it merges over the RAW entry, never the resolved one: a
 * resolved entry carries every field the catalogue supplied, so pasting one
 * back would freeze two dozen defaults into the user's file and silently opt
 * them out of every future catalogue change.
 */
test('categoryEntry composes an entry INSIDE categories, merged over the raw file', async () => {
  const { categoryEntry, jsonBlock } = await screen();

  const raw = {
    profile: 'standard',
    categories: {
      task: { tier: 'rationale', prefix: 'TASK', extraFields: ['plan', 'seq'] },
    },
  };

  // What the file said, plus what moved — `extraFields` survives untouched
  // because the reader never touched it, and `prefix` is not restated.
  assert.deepEqual(categoryEntry(raw, 'task', { tier: 'normative' }), {
    tier: 'normative', prefix: 'TASK', extraFields: ['plan', 'seq'],
  });

  // A category the raw file has never mentioned starts from nothing, and the
  // composed entry says only what was chosen. `lesson` resolves for every
  // config on the standard profile and appears in NO raw file here.
  assert.deepEqual(categoryEntry(raw, 'lesson', { scopePolicy: 'inert' }),
    { scopePolicy: 'inert' });

  // The nesting, as bytes. This is what a person pastes, and the shape it must
  // have: `"categories"` at two spaces, the entry NAME at four, its fields at
  // six. A top-level `"scopePolicy"` here is the invalid-JSON failure above.
  assert.equal(
    jsonBlock('categories', { lesson: categoryEntry(raw, 'lesson', { scopePolicy: 'inert' }) }),
    '  "categories": {\n    "lesson": {\n      "scopePolicy": "inert"\n    }\n  }',
  );

  // A raw file with no `categories` object at all, and one whose `categories`
  // is not an object, both compose from `{}` rather than throwing: this screen
  // exists to help a person out of a broken file, not to fail beside them.
  assert.deepEqual(categoryEntry({}, 'rule', { tier: 'normative' }), { tier: 'normative' });
  assert.deepEqual(categoryEntry({ categories: [] }, 'rule', { tier: 'normative' }),
    { tier: 'normative' });
  assert.deepEqual(categoryEntry(null, 'rule', { tier: 'normative' }), { tier: 'normative' });
});

/**
 * **`pastePlan` is the other half of that acceptance test, and the half that was
 * wrong until 2026-09-01.**
 *
 * `categoryEntry` above composes the right ENTRY. Nothing decided where the
 * entry went, so `composerPane` wrapped it in a top-level `"categories"` key
 * unconditionally — and both corpora this product is developed against already
 * have a populated `categories` object. `JSON.parse` does not refuse a
 * duplicate key: the LAST one wins. A reader following the screen's own
 * instruction would have silently dropped every other category override in
 * their file, which is precisely the task's *"a hand-off that is right for an
 * empty config and wrong for a populated one will be wrong for every real user,
 * because every real user has a populated one."*
 *
 * Six placements, and the sentence a pane draws is chosen by `where`. What is
 * asserted here is `where`, the ANCHOR the sentence names, and the indentation
 * of the bytes — four spaces for an entry, two for a top-level key — because
 * the indentation is a contract with a file rather than a styling choice.
 */
test('pastePlan puts a category entry INSIDE the object the file already has', async () => {
  const { pastePlan } = await screen();

  // The real shape: a file that already declares `categories`, holding
  // entries. This is `.demo-corpus` and this repository's own config alike.
  const populated = {
    exists: true,
    raw: { profile: 'standard', categories: { reference: {}, task: { prefix: 'TASK' } } },
  };

  // A category the object does not hold yet: an ENTRY, at four spaces, and
  // `last` names the entry it goes after so "after a comma" points at something
  // the reader can find in their own file.
  assert.deepEqual(pastePlan(populated, { key: 'categories', value: { tier: 'normative' }, entry: 'decision' }), {
    where: 'newentry',
    anchor: 'categories.decision',
    last: 'task',
    text: '    "decision": {\n      "tier": "normative"\n    }',
  });

  // One it DOES hold is a replacement, not an addition, and the sentence has to
  // say so — pasting a second `"task"` inside one object is the same
  // last-one-wins silence one level down.
  const held = pastePlan(populated, { key: 'categories', value: { prefix: 'JOB' }, entry: 'task' });
  assert.equal(held.where, 'replaceentry');
  assert.equal(held.anchor, 'categories.task');
  assert.equal(held.text, '    "task": {\n      "prefix": "JOB"\n    }');

  // An EMPTY `categories` object has no entry to go after, and the sentence for
  // it must not invent one.
  const empty = pastePlan({ exists: true, raw: { categories: {} } },
    { key: 'categories', value: { tier: 'normative' }, entry: 'decision' });
  assert.equal(empty.where, 'newentry0');
  assert.equal(empty.last, null);

  // A file with no `categories` key at all is the one branch where the top-level
  // form is right — and it is the branch the old code was written for.
  const bare = pastePlan({ exists: true, raw: { profile: 'standard' } },
    { key: 'categories', value: { tier: 'normative' }, entry: 'decision' });
  assert.equal(bare.where, 'newkey');
  assert.equal(bare.text,
    '  "categories": {\n    "decision": {\n      "tier": "normative"\n    }\n  }');

  // The three flat subjects: present is a replacement, absent is an addition,
  // and both are top-level blocks at two spaces.
  assert.equal(pastePlan(populated, { key: 'profile', value: 'minimal' }).where, 'replacekey');
  assert.equal(pastePlan(populated, { key: 'budgets', value: { jit: 8000 } }).where, 'newkey');
  assert.equal(pastePlan(populated, { key: 'budgets', value: { jit: 8000 } }).text,
    '  "budgets": {\n    "jit": 8000\n  }');
  // A key the file sets to `null` is DECLARED — the reader has to replace it,
  // not add a second one beside it.
  assert.equal(pastePlan({ exists: true, raw: { budgets: null } },
    { key: 'budgets', value: { jit: 8000 } }).where, 'replacekey');

  // No file at all: the block is a DOCUMENT, outer braces included, because a
  // fragment is not something a person can save as a new file.
  const fresh = pastePlan({ exists: false, raw: null },
    { key: 'categories', value: { tier: 'normative' }, entry: 'decision' });
  assert.equal(fresh.where, 'newfile');
  assert.equal(fresh.text,
    '{\n  "categories": {\n    "decision": {\n      "tier": "normative"\n    }\n  }\n}');

  // And the screen draws a sentence for every `where` this can return: a
  // placement with no sentence renders an empty step, which reads as a
  // hand-off that forgot to say where the block goes.
  const code = codeLines();
  for (const where of ['newfile', 'newkey', 'replacekey', 'newentry', 'newentry0', 'replaceentry']) {
    assert.ok(code.includes(`'cfg.pl.${where}'`),
      `pastePlan can return where: '${where}' and screens/config.js names no cfg.pl.${where}`);
  }
});

/**
 * `valueDeltas` reports what the FILE would say and nothing about the corpus.
 *
 * Compared as TEXT, because `4000` typed into a number field and `4000` read
 * out of JSON are the same edit and a strict comparison would draw a row for
 * neither having moved.
 */
test('valueDeltas draws a row only where a value moved, and pairs it with what it was', async () => {
  const { valueDeltas } = await screen();

  assert.deepEqual(
    valueDeltas({ 'budgets.jit': 6000, 'budgets.pinned': 6000 },
      { 'budgets.jit': 8000, 'budgets.pinned': 6000 }),
    [{ path: 'budgets.jit', was: '6000', will: '8000' }],
  );

  // The number a form hands back is a string; the value in force is a number.
  // A row here would be a change nobody made.
  assert.deepEqual(valueDeltas({ 'budgets.jit': 6000 }, { 'budgets.jit': '6000' }), []);

  // A path the file does not have yet pairs with NOTHING — `was: null` is what
  // draws the arrow alone, the mockup's own treatment for a value with no
  // previous half. It is not the same row as one that moved from a value.
  assert.deepEqual(valueDeltas({}, { 'categories.lesson.tier': 'normative' }),
    [{ path: 'categories.lesson.tier', was: null, will: 'normative' }]);

  assert.deepEqual(valueDeltas({ a: 1 }, {}), []);
});

/**
 * **`blastReading` is where "measured, not estimated" is decided**, and the
 * five faces are decided by the preview's own counts rather than by anything
 * this browser worked out.
 *
 * **Two destructive readings, ranked and never netted off.** `cfg.spn` says the
 * panel is *"how much of the corpus stops working if this value changes"*, and
 * two different answers are true of that sentence: an item that stops
 * GOVERNING, and an item that still governs and no longer FITS. Reading only
 * the first shipped a wrong panel — measured in a browser on 2026-08-29,
 * dropping `budgets.pinned` from 16,000 to 4,000 moved delivery from 25 items
 * to 9 and the panel said *"No change"*, because a budget never moves
 * `injection()`'s answer. The delivery clause below is what caught it, and it
 * is the assertion that would fail if someone removed it again.
 */
test('blastReading takes its face and its counts from the server, never from a guess', async () => {
  const { blastReading } = await screen();

  const answer = (spec: {
    becomes?: number; stops?: number; unchanged?: number;
    before?: number; after?: number; edited?: number;
  }): unknown => ({
    governing: {
      becomesInjected: Array.from({ length: spec.becomes ?? 0 }, (_, i) => ({ id: `A${i}` })),
      stopsBeingInjected: Array.from({ length: spec.stops ?? 0 }, (_, i) => ({ id: `B${i}` })),
      unchanged: spec.unchanged ?? 0,
    },
    agentEdits: spec.edited === undefined ? [] : [{
      category: 'rule',
      before: 'allow',
      after: 'review',
      items: Array.from({ length: spec.edited }, (_, i) => ({ id: `C${i}` })),
    }],
    selection: {
      before: { full: Array.from({ length: spec.before ?? 0 }, () => ({})) },
      after: { full: Array.from({ length: spec.after ?? 0 }, () => ({})) },
    },
  });

  // Nothing governs differently and nothing moved in or out of the selection:
  // a measured zero, drawn and named.
  const still = blastReading(answer({ unchanged: 681, before: 25, after: 25 }));
  assert.equal(still.face, 'none');
  assert.equal(still.level, 'none');
  assert.equal(still.n, 0);
  assert.equal(still.unchanged, 681);

  // An item stops governing: the strongest claim, and the headline number is
  // that count.
  const gone = blastReading(answer({ stops: 66, unchanged: 615, before: 25, after: 17 }));
  assert.equal(gone.face, 'stops');
  assert.equal(gone.level, 'crit');
  assert.equal(gone.n, 66);

  // Anything stopping is crit even where more items start than stop: the two
  // directions are not netted off, because an item that stops governing is a
  // rule that stops being enforced and no arrival makes up for it.
  assert.equal(blastReading(answer({ becomes: 9, stops: 1 })).face, 'stops');

  // **The clause a browser caught.** Nothing governs differently — a budget
  // never moves `injection()`'s answer — and sixteen items stop being
  // delivered. That is destructive, it is what `select` measured, and a panel
  // that called it "No change" was contradicting the three delta rows above it.
  const spilled = blastReading(answer({ unchanged: 710, before: 25, after: 9 }));
  assert.equal(spilled.face, 'spills');
  assert.equal(spilled.level, 'crit');
  assert.equal(spilled.n, 16);
  assert.equal(spilled.dropped, 16);

  // The two mirrors, which only add.
  const starts = blastReading(answer({ becomes: 4, unchanged: 677, before: 25, after: 25 }));
  assert.equal(starts.face, 'starts');
  assert.equal(starts.level, 'warn');
  assert.equal(starts.n, 4);

  // **The same defect a second time, and it was found the same way.**
  // `agentEdits` moves neither `injection()` nor `select()`, so an
  // `allow`→`review` change fires none of the four faces above it — and the
  // panel said "No change" over a measured list of thirty-eight items. This is
  // the assertion that fails if the fifth face is ever taken back out.
  const edited = blastReading(answer({ unchanged: 710, before: 25, after: 25, edited: 38 }));
  assert.equal(edited.face, 'edits');
  assert.equal(edited.level, 'warn');
  assert.equal(edited.n, 38);
  assert.equal(edited.edited, 38);
  // It ranks BELOW anything that changes what governs or what is delivered:
  // who may edit an item matters less than whether the item is in force.
  assert.equal(blastReading(answer({ stops: 1, edited: 38 })).face, 'stops');
  assert.equal(blastReading(answer({ before: 25, after: 9, edited: 38 })).face, 'spills');

  const fits = blastReading(answer({ unchanged: 710, before: 9, after: 25 }));
  assert.equal(fits.face, 'fits');
  assert.equal(fits.level, 'warn');
  assert.equal(fits.n, 16);
  assert.equal(fits.added, 16);

  // A malformed answer degrades to zeros AND to `none` together, so a panel
  // can never wear a crit face over "0 items".
  for (const broken of [undefined, null, {}, { governing: {} }, { governing: { unchanged: 'x' } }]) {
    const reading = blastReading(broken);
    assert.equal(reading.face, 'none');
    assert.equal(reading.level, 'none');
    assert.equal(reading.n, 0);
    assert.equal(reading.edited, 0);
    assert.equal(reading.unchanged, 0);
  }
});

/**
 * **The composed line goes through the catalogue, or it is not composed.**
 *
 * `screens/work.js`'s `revisionPlan` states the property this holds to: a
 * second spelling of a command whose flag set was verified against the real
 * argument parser exactly once is how the two come to disagree — and the
 * confirm's whole job is that the line a person read and the argv that runs are
 * the same thing.
 */
test('verifyPlan composes each pane line from the catalogue, and refuses an unknown name', async () => {
  const { verifyPlan } = await screen();

  // Profile: `mycontext status` prints `profile "<name>"` and the per-category
  // table the profile decides.
  assert.deepEqual(verifyPlan('status'),
    { id: 'status', values: {}, argv: ['mycontext', 'status'] });

  // Categories: the category the pane is showing, listed. The argument is the
  // catalogue's own `category` arg, so a name carrying a space is quoted by
  // `composeCommand` rather than by anything written here.
  assert.deepEqual(verifyPlan('list', { category: 'lesson' }),
    { id: 'list', values: { category: 'lesson' }, argv: ['mycontext', 'list', 'lesson'] });

  // Watched documents: the self-check.
  assert.deepEqual(verifyPlan('doctor'),
    { id: 'doctor', values: {}, argv: ['mycontext', 'doctor'] });

  // A name the catalogue does not declare THROWS rather than composing a line
  // from a literal array — the failure mode this function exists to prevent.
  assert.throws(() => verifyPlan('config set'), /command catalogue declares no "config set"/);

  // And every id this screen sends is one the SERVER's resolver can rebuild:
  // `execute-catalogue.ts` loads this very file, so a name absent from it is a
  // confirm that 400s at the boundary rather than a line that runs.
  for (const name of ['status', 'list', 'doctor']) {
    assert.ok(source().includes(`verifyPlan('${name}'`),
      `the screen no longer composes ${name}; this list and the panes disagree`);
  }
});

/**
 * **Every string key this screen names is declared in BOTH tables.**
 *
 * `strings-parity.test.ts` compares the two tables against each other and
 * against the design of record; neither direction can see a key a SCREEN names
 * and no table declares. That key throws at render time — in one language only
 * where the tables have drifted — which is the failure nobody sees until a
 * reader reports a blank screen. This screen gained twenty-eight app-only keys
 * on 2026-08-29 and none of them is in the mockup, so this is the only check
 * that covers them.
 */
test('every key screens/config.js names is declared in both string tables', async () => {
  const named = new Set<string>();
  const code = codeLines();
  for (const m of code.matchAll(/ctx\.t(?:Flat)?\('([^']+)'/g)) named.add(m[1]!);
  for (const m of code.matchAll(/screenHead\(ctx, root, '([^']+)', '([^']+)', '([^']+)'/g)) {
    named.add(m[1]!); named.add(m[2]!); named.add(m[3]!);
  }
  // The two face tables — `blastPanel`'s and `governanceRows`' — name their
  // keys as literals in an array rather than at a `ctx.t(` call site, because
  // WHICH key is drawn is the decision there. Collected by shape: a quoted key,
  // not a call.
  for (const m of code.matchAll(/'((?:cfg|aria|btn|exec|help|list|state)\.[A-Za-z0-9.]+)'/g)) {
    named.add(m[1]!);
  }
  assert.ok(named.size >= 30,
    `only ${named.size} key(s) found in screens/config.js — the patterns have stopped matching `
    + 'rather than the screen having stopped naming keys.');

  const tableUrl = (language: string): string =>
    new URL(`file://${path.join(REPO, 'src', 'ui', 'public', 'strings', `${language}.js`)
      .replaceAll('\\', '/')}`).href;
  const en = (await import(tableUrl('en'))) as { strings: Record<string, string> };
  const he = (await import(tableUrl('he'))) as { strings: Record<string, string> };

  assert.deepEqual([...named].filter((key) => !(key in en.strings)).sort(), [],
    'named by screens/config.js, missing from strings/en.js');
  assert.deepEqual([...named].filter((key) => !(key in he.strings)).sort(), [],
    'named by screens/config.js, missing from strings/he.js — this one is the silent half: '
    + 'the screen renders in English and throws in Hebrew');
});
