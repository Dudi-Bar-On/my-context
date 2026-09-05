/**
 * **The Library screen and the standalone document page it opens** —
 * `DEC-the-documentation-and-tutorials-screens-become-one-list-and`, owner
 * ruling 2026-09-05, which replaced `screens/docs.js` and `screens/tut.js`
 * with one console page and one page in a new tab.
 *
 * The limit is the one every screen test in this directory states: `render()`
 * touches a real document, and this project carries no browser dependency for
 * `node --test`. So what is measured here is every decision the two modules
 * make that does NOT need a document — the addresses they write and read, the
 * roster they build, the strings they name — and the browser half was driven
 * in Playwright against the running server before this file was written.
 *
 * ── THE THREE OWNER INSTRUCTIONS, AS ASSERTIONS ───────────────────────────
 *
 *   2. *"do not display the full path file names but what they contain title"*
 *      — every row's own label is `entry.title`, and no path is drawn beside
 *      it. Held below by rendering the screen against a stand-in whose entries
 *      carry a path that would be unmistakable if it leaked.
 *   3. *"change the style of the links in the new page either use a button or
 *      other way becase the link style is not looking good"* — every entry is
 *      the `.row` primitive with `.docrow` on it, and `styles.css` is asserted
 *      to remove the underline. A class name is a weak proxy for a look, and
 *      it is the strongest one a test without a browser has; the screenshot is
 *      in this change's report.
 *
 * The first instruction — GitHub's renderer — is `test/ui/github-render.test
 * .ts`, which is where the allow-list and the GFM behaviour are held.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');

registerHooks({
  resolve: (specifier, context, nextResolve) => {
    if (specifier.startsWith('/')) {
      return { url: pathToFileURL(path.join(PUBLIC, specifier)).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const browserModule = async <T>(...segments: string[]): Promise<T> =>
  (await import(pathToFileURL(path.join(PUBLIC, ...segments)).href)) as T;

interface LibraryModule {
  render: (root: unknown, ctx: unknown) => Promise<void>;
  docHref: (kind: string, id: string, lang: string) => string;
}
interface DocPageModule {
  docAddress: (search: string) => { kind: string | null; id: string | null; lang: string };
  endpointFor: (address: { kind: string | null; id: string | null; lang: string }) => string | null;
  baseDirFor: (
    address: { kind: string | null; id: string | null; lang: string },
    ids: Set<string> | null,
  ) => string;
}

const library = (): Promise<LibraryModule> => browserModule<LibraryModule>('screens', 'library.js');
const table = (lang: string): Promise<{ strings: Record<string, string> }> =>
  browserModule<{ strings: Record<string, string> }>('strings', `${lang}.js`);

/**
 * `doc.js` runs `main()` on import — it is a PAGE, not a library — and `main()`
 * reaches for `localStorage`, `location` and `document`. Its two pure exports
 * are what this file needs, so the module's own bytes are read and the
 * bottom-of-file invocation is removed, the same "rewrite exactly what is
 * named and assert the rewrite happened" bargain `test/ui/pane-route.test.ts`
 * makes with `app.js`.
 */
async function docPage(): Promise<DocPageModule> {
  const source = readFileSync(path.join(PUBLIC, 'doc.js'), 'utf8');
  const at = source.indexOf('\nmain().catch(');
  assert.notEqual(at, -1, 'doc.js no longer invokes main() at the bottom — this rewrite is stale');
  const inert = source.slice(0, at)
    .replaceAll("from '/lib/i18n.js'", `from ${JSON.stringify(pathToFileURL(path.join(PUBLIC, 'lib', 'i18n.js')).href)}`)
    .replaceAll("from '/lib/markdown.js'", `from ${JSON.stringify(pathToFileURL(path.join(PUBLIC, 'lib', 'markdown.js')).href)}`);
  assert.doesNotMatch(inert, /from '\//, 'a server-absolute specifier survived the rewrite');
  return await import(`data:text/javascript,${encodeURIComponent(inert)}`) as DocPageModule;
}

/* ══ THE ADDRESS ═══════════════════════════════════════════════════════════ */

test('the document address is a QUERY, so the fragment stays the document\'s', async () => {
  const { docHref } = await library();
  // A document id is a repo-relative path and carries `/`; it is percent-
  // encoded into the query value, and the fragment is left entirely free so
  // `#the-five-tiers` lands on a heading exactly as it does on GitHub.
  assert.equal(docHref('doc', 'docs/README.he.md', 'he'),
    '/doc.html?doc=docs%2FREADME.he.md&lang=he');
  assert.equal(docHref('doc', 'README.md', 'en'), '/doc.html?doc=README.md');
  assert.equal(docHref('tut', 'narrowing-a-session-focus', 'en'),
    '/doc.html?tut=narrowing-a-session-focus');
  assert.equal(docHref('tut', 'x', 'he'), '/doc.html?tut=x&lang=he');
  assert.equal(docHref('doc', 'a b&c=d.md', 'en'), '/doc.html?doc=a%20b%26c%3Dd.md',
    'an id that carries the query grammar cannot escape its own value');
  assert.doesNotMatch(docHref('doc', 'README.md', 'en'), /#/, 'the fragment is never written here');
});

test('the document page reads exactly what the screen wrote, and refuses everything else', async () => {
  const { docAddress, endpointFor } = await docPage();
  const { docHref } = await library();

  const doc = docAddress(new URL(docHref('doc', 'docs/README.he.md', 'he'), 'http://x').search);
  assert.deepEqual(doc, { kind: 'doc', id: 'docs/README.he.md', lang: 'he' });
  assert.equal(endpointFor(doc), '/api/doc/docs%2FREADME.he.md');

  const tut = docAddress(new URL(docHref('tut', 'a/b', 'he'), 'http://x').search);
  assert.deepEqual(tut, { kind: 'tut', id: 'a/b', lang: 'he' });
  assert.equal(endpointFor(tut), '/api/tutorials/a%2Fb?lang=he');

  // An address naming neither is a refusal that names what IS served, and — the
  // property that matters — it causes NO request: `endpointFor` has nothing to
  // return for it.
  for (const search of ['', '?', '?doc=', '?tut=', '?lang=he', '?nonsense=1']) {
    const parsed = docAddress(search);
    assert.equal(parsed.kind, null, `${JSON.stringify(search)} must name nothing`);
    assert.equal(endpointFor(parsed), null);
  }
  // `lang` is a closed set of two, not a value passed through to the server.
  assert.equal(docAddress('?tut=x&lang=fr').lang, 'en');
  assert.equal(docAddress('?tut=x&lang=he').lang, 'he');
});

test('a relative link resolves against the containing document\'s own directory', async () => {
  const { baseDirFor } = await docPage();
  // A `?doc=` id IS the repo-relative path, so its dirname is the base.
  assert.equal(baseDirFor({ kind: 'doc', id: 'docs/README.he.md', lang: 'he' }, null), 'docs');
  assert.equal(baseDirFor({ kind: 'doc', id: 'README.md', lang: 'en' }, null), '');
  assert.equal(
    baseDirFor({ kind: 'doc', id: 'docs/superpowers/specs/a.md', lang: 'en' }, null),
    'docs/superpowers/specs');
  // A `?tut=` id is a FEATURE KEY and not a path, so the file is found in the
  // roster rather than assumed to live anywhere in particular.
  const roster = new Set(['docs/tutorials/narrowing-a-session-focus.md',
    'docs/tutorials/narrowing-a-session-focus.he.md', 'README.md']);
  assert.equal(baseDirFor({ kind: 'tut', id: 'narrowing-a-session-focus', lang: 'en' }, roster),
    'docs/tutorials');
  assert.equal(baseDirFor({ kind: 'tut', id: 'narrowing-a-session-focus', lang: 'he' }, roster),
    'docs/tutorials');
  // A tutorial the roster does not carry, and a roster that failed to read,
  // both fall to the repository root — which resolves nothing that is not
  // rooted there, rather than guessing a directory.
  assert.equal(baseDirFor({ kind: 'tut', id: 'never-written', lang: 'en' }, roster), '');
  assert.equal(baseDirFor({ kind: 'tut', id: 'narrowing-a-session-focus', lang: 'en' }, null), '');
});

/* ══ THE PAGE WEARS GITHUB'S STYLING, NOT THIS PRODUCT'S ═══════════════════

   `DEC-the-document-page-wears-github-styling-lists-the-readmes-and`: a page
   *"without the style of mycontext"* that *"should look exactly as it is
   displayed in github"*. Asserted on the page's own bytes, which is where the
   decision actually lives.                                                  */

test('doc.html loads github-markdown-css and NOT this product\'s stylesheet', async () => {
  const html = readFileSync(path.join(PUBLIC, 'doc.html'), 'utf8');
  assert.equal(html.includes('href="/styles.css"'), false,
    'the console\'s own palette, type scale and link colour must not reach a document page');
  assert.match(html, /<link rel="stylesheet" href="\/lib\/vendor\/github-markdown-light\.css">/,
    'the stylesheet GitHub itself publishes for a rendered Markdown body');
  // The class contract is the package's own, read off its README: "add a
  // `markdown-body` class to the container of your rendered Markdown".
  assert.match(html, /<article class="markdown-body ghdoc" id="doc">/);
  // And the doctype the same README's Troubleshooting section names as the fix
  // for the quirks mode that renders table fonts wrong.
  assert.match(html, /^<!doctype html>/);
  // LIGHT, and the page's own ground is light too — the correction of
  // 2026-09-05: "now it looks correct just the background is dark and i want it
  // light". A light document floating on a dark page is the defect this holds
  // against, so the ground the chrome paints is asserted, not just the sheet.
  assert.equal(html.includes('github-markdown-dark'), false,
    'the dark variant was corrected away; a leftover reference would load two sheets');
  assert.match(html, /html,body\{[^}]*background:#ffffff/);
  assert.match(html, /:root\{color-scheme:light\}/);
  for (const dark of ['#0d1117', '#f0f6fc', '#9198a1', '#3d444d', '#4493f8']) {
    assert.equal(html.includes(dark), false, `${dark} is a dark-palette colour left on a light page`);
  }
});

test('the vendored stylesheet is pinned, offline, and scoped to markdown-body', async () => {
  const dir = path.join(PUBLIC, 'lib', 'vendor');
  const css = readFileSync(path.join(dir, 'github-markdown-light.css'), 'utf8');
  const manifest = readFileSync(path.join(dir, 'VENDOR.md'), 'utf8');
  assert.match(manifest, /\| `github-markdown-light\.css` \| `github-markdown-css` \| 5\.9\.0 \|/,
    'a vendored file carries a version and a digest, or nobody can tell what it is');
  assert.match(css, /^\/\*light \*\//,
    'the LIGHT variant — the package stamps which theme it generated at the top of the file');
  // Offline, which is what `CONST-zero-runtime-dependencies` buys: the only
  // `url()` in the file is an inline data: URI for GitHub's link octicon.
  const urls = [...css.matchAll(/url\(\s*["']?([^"')]{0,16})/g)].map((m) => m[1]!);
  assert.ok(urls.length > 0, 'the sheet does carry a url(), so this scan is scanning something');
  assert.deepEqual(urls.filter((u) => !u.startsWith('data:')), [],
    'a vendored stylesheet may not fetch anything at render time');
  assert.equal(/@import|@font-face/.test(css), false);
  // Every rule is scoped, so nothing it carries can reach the console.
  const selectors = [...css.matchAll(/^([^@{}/\s][^{}]*)\{/gm)].map((m) => m[1]!.trim());
  assert.ok(selectors.length > 100, `expected the sheet's rules, found ${selectors.length}`);
  assert.deepEqual(selectors.filter((s) => !s.includes('markdown-body')), []);
});

/* ══ THE ROSTER, AND THE TWO PRESENTATION RULINGS ══════════════════════════ */

/** A stand-in element with the members `screens/parts.js`, `lib/i18n.js` and
 *  this screen touch, and no more. */
interface FakeNode {
  tag: string; className: string; textContent: string; href: string; target: string; rel: string;
  type: string; title: string; value: string;
  dataset: Record<string, string>; attrs: Record<string, string>; children: FakeNode[];
  style: { setProperty: (name: string, value: string) => void };
  append: (...nodes: (FakeNode | string)[]) => void;
  replaceChildren: (...nodes: FakeNode[]) => void;
  setAttribute: (name: string, value: string) => void;
  addEventListener: () => void;
}

function element(tag: string): FakeNode {
  const node: FakeNode = {
    tag,
    className: '',
    textContent: '',
    href: '',
    target: '',
    rel: '',
    type: '',
    title: '',
    value: '',
    dataset: {},
    attrs: {},
    // `spaced()` in `parts.js` sets its margin through the CSSOM rather than a
    // `style` attribute — the narrow path that module's own header names ("no
    // innerHTML, and no `style` attribute"). So the stand-in needs the one
    // method that path uses, and recording it is what lets a test see it.
    style: { setProperty(name: string, value: string): void { node.attrs[`style:${name}`] = value; } },
    children: [],
    append(...nodes): void {
      for (const n of nodes) node.children.push(typeof n === 'string' ? textNode(n) : n);
    },
    replaceChildren(...nodes): void { node.children.length = 0; node.append(...nodes); },
    setAttribute(name, value): void { node.attrs[name] = value; },
    addEventListener(): void { /* the filter is a reading aid; nothing here types */ },
  };
  return node;
}
function textNode(text: string): FakeNode {
  const node = element('#text');
  node.textContent = text;
  return node;
}

const flat = (nodes: FakeNode[]): FakeNode[] => {
  const out: FakeNode[] = [];
  const walk = (n: FakeNode): void => { out.push(n); for (const c of n.children) walk(c); };
  for (const n of nodes) walk(n);
  return out;
};
const textOf = (node: FakeNode): string =>
  flat([node]).filter((n) => n.children.length === 0).map((n) => n.textContent).join('');

/**
 * The roster both endpoints answer.
 *
 * `injection-tiers` is here for two jobs at once: its path would be
 * unmistakable if the screen ever drew one, and it stands for the 188
 * documents the manifest carries and the LIST does not show
 * (`DEC-the-document-page-wears-github-styling-lists-the-readmes-and`). It must
 * be COUNTED by `lib.only` and drawn by nothing.
 */
const DOCUMENTS = [
  { id: 'README.md', title: 'my_context', language: 'en', hasHebrewMirror: true, headings: [] },
  { id: 'docs/README.he.md', title: 'my_context בעברית', language: 'he', hasHebrewMirror: true, headings: [] },
  { id: 'docs/tutorials/injection-tiers.md', title: 'How injection tiers decide what arrives', language: 'en', hasHebrewMirror: false, headings: [] },
];
const TUTORIALS = [
  { id: 'capturing-an-item', title: 'Capture what you just decided', tier: 'basic', en: 'done', he: 'done' },
  { id: 'narrowing-a-session-focus', title: 'Narrow what gets injected', tier: 'advanced', en: 'done', he: 'todo' },
  { id: 'never-written', title: 'A tutorial nobody has written', tier: 'advanced', en: 'unmeasured', he: 'unmeasured' },
];

async function paint(lang: 'en' | 'he'): Promise<FakeNode> {
  const { render } = await library();
  const { strings } = await table(lang);
  // `createElementNS` is the THIRD method, and only one caller needs it:
  // `openIcon()` in `parts.js` builds the mockup's `<svg><use href="#i-open">`
  // in the SVG namespace, which is what tells a reader a row leaves for another
  // tab. It is given the same field bag — the namespace is the browser's
  // business, not this test's.
  const doc = {
    createElement: element,
    createTextNode: textNode,
    createElementNS: (_ns: string, tag: string) => element(tag),
  };
  const i18n = await browserModule<{
    t: (s: Record<string, string>, k: string, subs?: Record<string, unknown>, d?: unknown) => FakeNode[];
    tFlat: (s: Record<string, string>, k: string, subs?: Record<string, unknown>) => string;
  }>('lib', 'i18n.js');
  const ctx = {
    lang,
    t: (key: string, subs?: Record<string, unknown>) => i18n.t(strings, key, subs ?? {}, doc),
    tFlat: (key: string, subs?: Record<string, unknown>) => i18n.tFlat(strings, key, subs ?? {}),
    api: async (url: string) => {
      if (url === '/api/tutorials') {
        return { tutorials: TUTORIALS, heRollup: { done: 1, total: 3 } };
      }
      if (url === '/api/doc') return { documents: DOCUMENTS, truncated: false };
      throw new Error(`unexpected read: ${url}`);
    },
  };
  const root = element('main');
  // `el()` in `parts.js` calls `document.createElement`, so the stand-in has to
  // be the global one for the duration of the paint. Restored immediately —
  // each test file is its own process, but a leaked global is still a leak.
  const realDocument = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = doc;
  try {
    await render(root, ctx);
  } finally {
    (globalThis as { document?: unknown }).document = realDocument;
  }
  return root;
}

test('INSTRUCTION 2 — every entry is named by its TITLE, and no path is drawn anywhere', async () => {
  const root = await paint('en');
  const rows = flat([root]).filter((n) => n.className.includes('docrow'));
  assert.equal(rows.length, 4, '3 tutorials + this surface\'s README');
  const labels = rows.map((r) => textOf(flat([r]).find((n) => n.className === 'docname')!));
  assert.deepEqual(labels, [
    'Capture what you just decided',
    'Narrow what gets injected',
    'A tutorial nobody has written',
    'my_context',
  ]);
  // And the path appears nowhere on the screen — not as a label, not in a
  // `title` tooltip, not in a small monospace span beside the title, which is
  // what the screen this replaces drew.
  const everything = flat([root]);
  const leaked = everything.filter((n) =>
    textOf(n).includes('docs/tutorials/injection-tiers.md')
    || n.title.includes('injection-tiers')
    || Object.values(n.attrs).some((v) => v.includes('injection-tiers')));
  assert.deepEqual(leaked.map((n) => n.tag), [], 'a document path reached the screen');
});

test('INSTRUCTION 3 — an entry is the .row primitive, not an ordinary link', async () => {
  const root = await paint('en');
  const rows = flat([root]).filter((n) => n.className.includes('docrow'));
  for (const row of rows) {
    assert.match(row.className, /(^|\s)row(\s|$)/,
      'an entry must carry the mockup\'s own actionable-row primitive');
  }
  // The underline is what the owner objected to, and it is removed in the
  // stylesheet rather than by an inline style — this app sets no `style`
  // attributes (`screens/parts.js`'s own rule).
  const css = readFileSync(path.join(PUBLIC, 'styles.css'), 'utf8');
  assert.match(css, /\.docrow\{[^}]*text-decoration:none/,
    '.docrow must remove the underline that the owner rejected');
  assert.match(css, /\.card\[data-role="nav"\] \.docrow\{/,
    'and it takes its accent from the card-role system rather than a third vocabulary');
});

test('a row opens a NEW TAB, and one with nothing to open is not a link at all', async () => {
  const root = await paint('en');
  const live = flat([root]).filter((n) => n.tag === 'a' && n.className.includes('docrow'));
  assert.equal(live.length, 3, 'the unmeasured tutorial is not among them');
  for (const row of live) {
    assert.equal(row.target, '_blank', 'the ruling: "opens a RENDERED page in a new browser tab"');
    assert.equal(row.rel, 'noopener');
    assert.match(row.href, /^\/doc\.html\?/);
  }
  const dead = flat([root]).filter((n) => n.className.includes('dead'));
  assert.equal(dead.length, 1);
  assert.equal(dead[0]!.tag, 'div', 'a link to a document that does not exist promises a read '
    + 'and answers a refusal — so it is drawn, and it is not a link');
  assert.match(textOf(dead[0]!), /A tutorial nobody has written/);
});

test('Hebrew is asked for only where a Hebrew file is MEASURED to exist', async () => {
  const root = await paint('he');
  const hrefs = flat([root]).filter((n) => n.tag === 'a' && n.className.includes('docrow'))
    .map((n) => n.href);
  // `capturing-an-item` is `he: 'done'` — a Hebrew file exists.
  assert.ok(hrefs.some((h) => h === '/doc.html?tut=capturing-an-item&lang=he'));
  // `narrowing-a-session-focus` is `he: 'todo'`, which `apiTutorials` uses BOTH
  // for "written and incomplete" and for "no Hebrew file at all". The screen
  // this replaces read `todo` as "exists" and took the endpoint's 404; here it
  // opens the English, and the document page labels it as English.
  assert.ok(hrefs.some((h) => h === '/doc.html?tut=narrowing-a-session-focus'));
  assert.equal(hrefs.some((h) => h.includes('narrowing-a-session-focus&lang=he')), false);
  // A document written in Hebrew opens as Hebrew whatever the interface is.
  assert.ok(hrefs.some((h) => h === '/doc.html?doc=docs%2FREADME.he.md&lang=he'));
});

test('the measured EN/HE state is beside every entry — the ruling asks for it by name', async () => {
  const root = await paint('en');
  const rows = flat([root]).filter((n) => n.className.includes('docrow'));
  for (const row of rows) {
    const marks = flat([row]).find((n) => n.className === 'docmarks');
    assert.notEqual(marks, undefined, 'every row carries its language marks');
    assert.ok(marks!.children.length > 0, `${textOf(row)} drew no state at all`);
  }
  // And the measured ZERO is drawn as a sentence rather than left to be counted
  // off the chips — `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-
  // thing-is`.
  assert.match(textOf(root), /Hebrew: 1 of 3 written/);
});

/* ══ THE LIST IS THE READMES AND THE TUTORIALS ═════════════════════════════

   `DEC-the-document-page-wears-github-styling-lists-the-readmes-and`, owner
   ruling of 2026-09-05 after this screen was found carrying 190 rows: *"the
   two READMEs and the tutorials — what a reader reads — not 166 internal
   specs, plans and reports"*, and *"English console offers README.md; Hebrew
   console offers docs/README.he.md. Each surface offers its own document."*  */

test('the Documents card offers THIS surface\'s README, and only it', async () => {
  const english = flat([await paint('en')])
    .filter((n) => n.tag === 'a' && n.className.includes('docrow'))
    .map((n) => n.href).filter((h) => h.startsWith('/doc.html?doc='));
  assert.deepEqual(english, ['/doc.html?doc=README.md'],
    'the English console offers README.md — not the Hebrew mirror, and not a language switch');

  const hebrew = flat([await paint('he')])
    .filter((n) => n.tag === 'a' && n.className.includes('docrow'))
    .map((n) => n.href).filter((h) => h.startsWith('/doc.html?doc='));
  assert.deepEqual(hebrew, ['/doc.html?doc=docs%2FREADME.he.md&lang=he'],
    'the Hebrew console offers docs/README.he.md — its own document, not a translated wrapper');
});

test('the documents NOT listed are counted on the screen, never silently dropped', async () => {
  const root = await paint('en');
  // The internal document in the roster is drawn by nothing…
  const everything = flat([root]);
  assert.deepEqual(
    everything.filter((n) => textOf(n).includes('How injection tiers decide what arrives')).map((n) => n.tag),
    [],
    'an internal working document reached the list',
  );
  // …and is COUNTED, which is the difference between unlisted and dropped
  // (`INV-nothing-is-dropped-silently`). Two of the three roster entries are
  // not this surface's README.
  assert.match(textOf(root), /The other 2 Markdown documents in this repository/);
  assert.match(textOf(root), /a link from one document to another still opens them in the viewer/,
    'and the screen says the viewer still reaches them, which is why unlisting costs nothing');
});

/* ══ THE STRINGS ═══════════════════════════════════════════════════════════ */

test('every string key these two modules name is declared in both tables, with its slots supplied', async () => {
  const en = await table('en');
  const he = await table('he');
  const named = new Set<string>();
  for (const file of [['screens', 'library.js'], ['doc.js']]) {
    const source = readFileSync(path.join(PUBLIC, ...file), 'utf8');
    for (const m of source.matchAll(/\bt(?:Flat)?\(\s*'([a-zA-Z][\w.]*)'/g)) named.add(m[1]!);
  }
  // The two labels the RENDERER names on this page's behalf: they are passed
  // to `githubNodes` as `tFlat` and never spelled at a call site here.
  named.add('gh.tagRefused');
  named.add('gh.urlRefused');
  named.add('dv.imgRefused');

  assert.ok(named.size >= 20, `expected the two modules to name many keys, found ${named.size}`);
  const missing: string[] = [];
  for (const key of [...named].sort()) {
    if (!(key in en.strings)) missing.push(`en:${key}`);
    if (!(key in he.strings)) missing.push(`he:${key}`);
  }
  assert.deepEqual(missing, []);
});

test('the new sentences carry the same slots in both languages, and no unkeyed English ships', async () => {
  const en = await table('en');
  const he = await table('he');
  // `slots()` is the grammar's ONE parser, and `lib/i18n.js` exports it
  // precisely because eight test files had each grown their own copy and all
  // eight read a `{b:…}` run as a substitution. Imported by URL because the
  // string modules are browser JS, outside `tsconfig.json`'s include.
  const { slots } = await browserModule<{ slots: (t: string) => string[] }>('lib', 'i18n.js');
  const mine = Object.keys(en.strings).filter((k) => k.startsWith('lib.') || k.startsWith('gh.')
    || k === 's.library');
  assert.ok(mine.length >= 18, `expected the new keys to exist, found ${mine.length}`);
  const mismatched: string[] = [];
  for (const key of mine) {
    const a = [...slots(en.strings[key]!)].sort();
    const b = [...slots(he.strings[key]!)].sort();
    if (JSON.stringify(a) !== JSON.stringify(b)) mismatched.push(`${key}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  }
  assert.deepEqual(mismatched, []);

  // No authored English in the markup either: `doc.html`'s text nodes are
  // empty and filled from the tables, the rule the whole shell follows.
  const html = readFileSync(path.join(PUBLIC, 'doc.html'), 'utf8');
  const body = html.slice(html.indexOf('<body'));
  const authored = [...body.matchAll(/>([^<>{}]*[A-Za-z]{3,}[^<>{}]*)</g)]
    .map((m) => m[1]!.trim())
    .filter((s) => s !== '' && !s.startsWith('//'));
  assert.deepEqual(authored, [], 'doc.html must author no English text — every string is keyed');
});

/* ══ THE RETIREMENT ════════════════════════════════════════════════════════ */

test('the two screens this replaces are GONE, and their addresses land on the Library', () => {
  for (const retired of ['docs.js', 'tut.js']) {
    assert.throws(
      () => readFileSync(path.join(PUBLIC, 'screens', retired), 'utf8'),
      `src/ui/public/screens/${retired} still exists — the ruling replaced both screens, and an `
      + 'unreachable screen module is exactly what the rail\'s PROPOSED badge exists to make visible',
    );
  }
  const app = readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
  assert.doesNotMatch(app, /import\('\/screens\/(docs|tut)\.js'\)/);
  assert.match(app, /import\('\/screens\/library\.js'\)/);
  assert.match(app, /\['nav\.read', \['library', 'learn'\]\]/);
  // A reader who still holds `#/docs`, `#/docs/<id>/<anchor>` or `#/tut/<id>`
  // — a bookmark, a link in a report — is sent to the Library rather than
  // falling through to the injection preview.
  assert.match(app, /RETIRED_TO_LIBRARY = new Set\(\['docs', 'tut'\]\)/);
  assert.match(app, /RETIRED_TO_LIBRARY\.has\(askedRaw\) \? 'library' : askedRaw/);
});
