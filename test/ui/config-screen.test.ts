/**
 * **The Configure screen's decidable half, and the parity checks that keep the
 * undecidable half honest.**
 *
 * `src/ui/public/screens/config.js` is DOM glue, and DOM glue is the stated
 * untested surface (spec §6, and `test/ui/viewmodel.test.ts`'s own header: *"the
 * DOM rendering in `app.js` and `screens/*.js` has no test — that would need a
 * browser dependency this project does not have"*). That is not licence to test
 * nothing. Three things on this screen are decisions rather than pixels, and all
 * three are exported from the module and exercised here against the real bytes:
 *
 *   1. `budgetRows` — which budget is drawn as a PAIR and which as a lone
 *      number, and in what order the four rows come out.
 *   2. `jsonBlock` — the exact text the Copy button puts on the clipboard. It
 *      is pasted into `.my_context/config.json` by hand, so its indentation is
 *      a contract with a file, not a styling choice, and it is asserted against
 *      the design of record's own `<pre>` bytes below.
 *   3. `policyPositions` — which segbar position is pressed, and what happens
 *      when the resolved config has no such category.
 *
 * Plus two scans that no unit test of a pure function can replace: that the
 * screen names every `data-t` key its mockup section declares (a forgotten card
 * is a silent one), and that its CODE binds nothing that writes, runs or fetches
 * on its own.
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
}

const source = (): string => readFileSync(SCREEN, 'utf8');
const mockup = (): string => readFileSync(MOCKUP, 'utf8');

async function screen(): Promise<ConfigScreen> {
  let text = source();
  for (const [specifier, real] of [
    [PARTS, path.join(SCREENS, 'parts.js')],
    [CMD_ACTIONS, path.join(LIB, 'command-actions.js')],
    [VIEWMODEL, path.join(LIB, 'viewmodel.js')],
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
  const defaults = { pinned: 6000, jit: 6000, restored: 8000, index: 1200 };

  // `was` is the shipped default and is null when the file changes nothing:
  // "6000 → 8000" is a pair a reader can check, and "8000" on its own is the
  // whole truth when nothing moved. The mockup draws exactly this asymmetry —
  // one row of its four carries an arrow.
  assert.deepEqual(budgetRows({ pinned: 6000, jit: 8000, restored: 8000, index: 900 }, defaults), [
    { key: 'pinned', was: null, will: 6000 },
    { key: 'jit', was: 6000, will: 8000 },
    { key: 'restored', was: null, will: 8000 },
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
  // mockup's own order without this file, or that one, listing the four tiers.
  // Spread, because `Budgets` is an interface and an interface has no implicit
  // index signature; the spread's inferred type does, and the VALUES are the
  // real ones either way.
  const shipped: Record<string, number> = { ...DEFAULT_BUDGETS };
  assert.deepEqual(budgetRows(shipped, shipped).map((row) => row.key),
    ['pinned', 'jit', 'restored', 'index']);
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
 * REWRITTEN 2026-08-27 — task `plan:budget seq:5`,
 * `DEC-the-ui-writes-budgets-and-the-simulator-always-meant-to`. The OLD name
 * of this test, "binds nothing that writes, runs or fetches", is false of this
 * file as of that ruling: the Budgets card now calls `ctx.post('/api/execute'`
 * behind a confirm. **This test is NARROWED here, not widened** — the same
 * distinction `test/ui/no-writes.test.ts` draws for `execute.ts` itself. What
 * still holds, and still fails: no `fetch(`, no `innerHTML`, no `eval`, no
 * storage — this screen reaches the network through the SAME two contract
 * methods every other write-capable screen uses (`ctx.api`/`ctx.post`),
 * never a hand-rolled request, and it composes NO CLI command — no `<code>`
 * line, no `composeCommand` import, nothing `lib/command.js` would build —
 * which is the one property `cfg.nocmd` still asserts on screen.
 */
test('the screen reaches the network only through ctx.api/ctx.post, and composes no CLI command', async () => {
  const code = codeLines();

  // The confirm GET: the literal `/api/config` read, and the dynamic budgets
  // confirm — `ctx.api(confirmPath(...))` can never match a `ctx.api('...'`
  // regex, so it is asserted by substring instead, naming the exact call this
  // file makes rather than a shape a rewrite could satisfy by accident.
  assert.deepEqual([...code.matchAll(/ctx\.api\('([^']+)'/g)].map((m) => m[1]), ['/api/config']);
  assert.ok(code.includes('ctx.api(confirmPath('),
    'the budgets confirm must go through confirmPath, the same query shape /api/execute/confirm reads');

  // The ONE write: `ctx.post('/api/execute'`, and only that literal path — a
  // second POST target appearing here would mean a second write nobody ruled
  // in, which is exactly what `no-writes.test.ts`'s RULED_WRITES guards on the
  // server side.
  assert.deepEqual([...code.matchAll(/ctx\.post\('([^']+)'/g)].map((m) => m[1]), ['/api/execute']);

  // No CLI command is composed here, ever — the property `cfg.nocmd` states on
  // screen. `commandActions` and `command.js`'s `composeCommand` are what
  // every OTHER boundary control on this UI uses to draw a `<code>` line; this
  // screen imports neither, because a budget write has no argv to show.
  for (const banned of ['commandActions', 'composeCommand', "from '/lib/command.js'"]) {
    assert.equal(code.includes(banned), false, `screens/config.js names "${banned}" — it must not compose a command`);
  }

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
