/**
 * **The GitHub view, and the allow-list that makes it survivable.**
 *
 * `DEC-the-documentation-and-tutorials-screens-become-one-list-and`, owner
 * ruling 2026-09-05: *"use exactly the same renderer and viewing as it is
 * implemented in github, do not decide other way, if required ask me."*
 * `githubNodes` (`src/ui/public/lib/markdown.js`) is that renderer and
 * `src/ui/public/lib/sanitize.js` is GitHub's documented HTML allow-list,
 * transcribed. This file is the gate on both.
 *
 * ── WHAT IS MEASURABLE HERE, AND WHAT IS NOT ──────────────────────────────
 *
 * Both modules take their `doc` as an ARGUMENT — the same arrangement
 * `lib/i18n.js`'s `t()` uses and for the same reason — so the whole policy is
 * exercised against a two-method stand-in with no browser. What CANNOT be
 * measured here is how it looks; that is a browser's job and it was driven in
 * one before this file was written.
 *
 * ── THE FOUR THINGS THIS FILE HOLDS ───────────────────────────────────────
 *
 *   1. **The security properties, stated as tests rather than as comments.**
 *      This server sends no `Content-Security-Policy` — retired by owner
 *      decision on 2026-08-22, and `server-e2e.test.ts` asserts its ABSENCE —
 *      so `script-src 'self'` is not there to catch a mistake in the
 *      allow-list. Every guarantee is structural and every one is asserted
 *      below: no script element is ever built, no event-handler attribute is
 *      ever set, no `javascript:`/`data:`/`vbscript:` URL is ever set, and no
 *      `style`, `class` or `id` from a document ever reaches a node.
 *   2. **The one slug rule, held to one answer.** `headingSlug` exists in
 *      `test/helpers/markdown.ts` (calibrated against GitHub's own rendering
 *      of both READMEs) and, copied, in `lib/markdown.js`, because a browser
 *      module cannot import a TypeScript test helper under
 *      `CONST-node-24-no-build-step`. The copy is legitimate only if something
 *      forces the two to agree; that is the test below, run over every heading
 *      of every document the manifest serves.
 *   3. **GFM behaviour** — tables with GitHub's own `align` attribute, task
 *      lists, strikethrough, autolinks, linkified bare URLs.
 *   4. **The measurement the ruling was taken on.** 141 refusals on
 *      `README.md` and 457 on `docs/README.he.md` under the console renderer;
 *      one each under this one. Pinned as an INEQUALITY plus the exact
 *      residue, so the numbers stay meaningful as the documents change.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { headingSlug as helperSlug, headings as helperHeadings } from '../helpers/markdown.ts';
import { buildDocManifest } from '../../src/ui/read-model.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');

// The browser loads every module from the UI server's root, so `/lib/x.js` is
// the shipped specifier. Node has no such root; this points it at the same
// bytes rather than at a rewritten copy.
registerHooks({
  resolve: (specifier, context, nextResolve) => {
    if (specifier.startsWith('/')) {
      return { url: pathToFileURL(path.join(PUBLIC, specifier)).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

/* ══ THE TWO-METHOD STAND-IN ═══════════════════════════════════════════════
   Deliberately NOT a DOM node: a field bag with exactly the members
   `githubNodes` and `buildElement` touch. A fuller fake would invite tests
   this file has no business running. */

interface FakeNode {
  tag: string;
  className: string;
  textContent: string;
  id: string;
  attrs: Record<string, string>;
  children: FakeNode[];
  append: (...kids: FakeNode[]) => void;
  setAttribute: (name: string, value: string) => void;
}

interface FakeDoc {
  createElement: (tag: string) => FakeNode;
  createTextNode: (text: string) => FakeNode;
}

function fakeDoc(): FakeDoc {
  const element = (tag: string): FakeNode => {
    const node: FakeNode = {
      tag,
      className: '',
      textContent: '',
      id: '',
      attrs: {},
      children: [],
      append(...kids: FakeNode[]): void { node.children.push(...kids); },
      setAttribute(name: string, value: string): void { node.attrs[name] = value; },
    };
    return node;
  };
  return {
    createElement: element,
    createTextNode: (text: string): FakeNode => {
      const node = element('#text');
      node.textContent = text;
      return node;
    },
  };
}

interface Rendered {
  nodes: FakeNode[];
  refusals: string[];
  dropped: string[];
  headings: { level: number; text: string; slug: string }[];
}

/** The link context `githubNodes` cannot infer: the containing document's own
 *  directory, and the ids this server will actually serve. */
interface LinkWhere { base?: string; openable?: Set<string> | null }

interface RendererModule {
  githubNodes: (src: unknown, doc: FakeDoc, labelFor?: unknown, where?: LinkWhere) => Rendered;
  markdownNodes: (src: unknown, doc: FakeDoc) => { nodes: FakeNode[]; refusals: string[] };
  headingSlug: (text: string) => string;
  resolveDocPath: (base: string, target: string) => string | null;
  decideLink: (
    href: unknown,
    where?: { base?: string; openable?: Set<string> | null; slugs?: Set<string> | null },
  ) => { kind: string; href: string } | null;
}

interface SanitizeModule {
  safeUrl: (value: string) => boolean;
  attributeAllowed: (tag: string, name: string) => boolean;
  decodeEntities: (source: string) => string;
  htmlTokens: (source: string) => { kind: string; name?: string; text?: string }[];
  ALLOWED_TAGS: Set<string>;
  GLOBAL_ATTRS: Set<string>;
}

const renderer = async (): Promise<RendererModule> =>
  (await import(pathToFileURL(path.join(PUBLIC, 'lib', 'markdown.js')).href)) as RendererModule;
const sanitize = async (): Promise<SanitizeModule> =>
  (await import(pathToFileURL(path.join(PUBLIC, 'lib', 'sanitize.js')).href)) as SanitizeModule;

/** Every node in a rendered tree, flattened, text nodes included. */
function flatten(nodes: FakeNode[]): FakeNode[] {
  const out: FakeNode[] = [];
  const walk = (node: FakeNode): void => {
    out.push(node);
    for (const child of node.children) walk(child);
  };
  for (const node of nodes) walk(node);
  return out;
}

/** The tags a render produced, as a sorted unique list. */
const tagsOf = (nodes: FakeNode[]): string[] =>
  [...new Set(flatten(nodes).filter((n) => n.tag !== '#text').map((n) => n.tag))].sort();

/**
 * All the text a render produced, joined — what a reader would actually see.
 *
 * BOTH carriers, because the renderer uses both: a run of prose is a
 * `createTextNode` child, and a leaf built by `make(doc, tag, cls, text)` — a
 * refusal label, a `<code>` span, a `<pre>` — holds its words in its own
 * `textContent` with no children at all. Counting only `#text` nodes reads
 * every refusal as empty, which is the one thing this file most needs to see.
 */
const textOf = (nodes: FakeNode[]): string =>
  flatten(nodes)
    .filter((n) => n.tag === '#text' || n.children.length === 0)
    .map((n) => n.textContent)
    .join('');

const render = async (src: string, where?: LinkWhere): Promise<Rendered> =>
  (await renderer()).githubNodes(src, fakeDoc(), undefined, where);

/** The link context the DOCUMENT PAGE supplies for a real document: the whole
 *  served manifest as the openable set, and the document's own directory as
 *  the base a relative link resolves against. Built once per file. */
const MANIFEST = new Set(buildDocManifest(REPO).entries.map((e) => e.id));
const dirOf = (id: string): string => (id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '');
const whereFor = (id: string): LinkWhere => ({ base: dirOf(id), openable: MANIFEST });

/* ══ 1 — THE SECURITY PROPERTIES ═══════════════════════════════════════════ */

test('a <script> in a document is REFUSED by name — never built, never run', async () => {
  const out = await render('before\n\n<script>alert(1)</script>\n\nafter');
  assert.equal(tagsOf(out.nodes).includes('script'), false, 'no script element may exist');
  assert.ok(out.refusals.includes('tag:script'), `refusals were ${JSON.stringify(out.refusals)}`);
  // The refusal is DRAWN, not silent: `INV-nothing-is-dropped-silently`, and
  // it is the one place this renderer is deliberately louder than GitHub,
  // which unwraps an unknown element and says nothing.
  const refusal = flatten(out.nodes).find((n) => n.className === 'refusal');
  assert.notEqual(refusal, undefined);
  assert.match(textOf([refusal!]), /script/);
});

test('an inline event handler never reaches a node — the attribute allow-list is exact', async () => {
  const out = await render('<span onmouseover="alert(1)" dir="ltr">hi</span>');
  const span = flatten(out.nodes).find((n) => n.tag === 'span');
  assert.notEqual(span, undefined, 'the span itself is allow-listed and is built');
  assert.deepEqual(Object.keys(span!.attrs), ['dir'], 'only `dir` survives');
  assert.ok(out.dropped.includes('span@onmouseover'));
  // Every `on*` name, not just the one above: the guarantee is the allow-list
  // being exact, and a test of one handler would pass on a deny-list of one.
  const { attributeAllowed } = await sanitize();
  for (const name of ['onclick', 'onerror', 'onload', 'onfocus', 'onanimationend', 'onbeforeinput']) {
    assert.equal(attributeAllowed('span', name), false, name);
    assert.equal(attributeAllowed('a', name), false, name);
    assert.equal(attributeAllowed('img', name), false, name);
  }
});

test('style, class and id from a document never reach a node — GitHub allows none of them', async () => {
  const out = await render('<div style="position:fixed" class="refusal" id="mdout" dir="rtl">x</div>');
  const div = flatten(out.nodes).find((n) => n.tag === 'div');
  assert.deepEqual(Object.keys(div!.attrs), ['dir']);
  assert.equal(div!.className, '', 'a document may not forge this app\'s own classes');
  assert.equal(div!.id, '', 'a document may not collide with a minted heading anchor');
  assert.deepEqual(
    [...out.dropped].sort(), ['div@class', 'div@id', 'div@style'],
    'and each drop is counted, so the page can disclose it',
  );
});

test('an unsafe URL is refused in every carrier — markdown link, raw <a>, and <img>', async () => {
  const { safeUrl } = await sanitize();
  for (const bad of [
    'javascript:alert(1)', 'JavaScript:alert(1)', 'java\tscript:alert(1)',
    'java\nscript:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>x</script>',
    'vbscript:msgbox', 'file:///etc/passwd', 'jAvAsCrIpT:x',
  ]) {
    assert.equal(safeUrl(bad), false, `safeUrl(${JSON.stringify(bad)}) must be false`);
  }
  for (const good of [
    'https://example.com', 'http://x/y', 'mailto:a@b.c', '#anchor', '/abs/path',
    './rel.md', '../up.md', 'docs/tutorials/x.md', 'docs/a:b.md', '',
  ]) {
    assert.equal(safeUrl(good), true, `safeUrl(${JSON.stringify(good)}) must be true`);
  }

  const md = await render('[label](javascript:alert(1))');
  assert.equal(tagsOf(md.nodes).includes('a'), false);
  assert.ok(md.refusals.includes('url scheme'));
  assert.match(textOf(md.nodes), /label/, 'the LABEL survives — the reader is told a link was there');

  const raw = await render('<a href="javascript:alert(1)">label</a>');
  const anchor = flatten(raw.nodes).find((n) => n.tag === 'a');
  assert.equal(anchor!.attrs.href, undefined, 'the element is allowed; the href is not set');
  assert.ok(raw.dropped.includes('a@href'));

  const image = await render('![alt](javascript:alert(1))');
  assert.equal(tagsOf(image.nodes).includes('img'), false);
  assert.ok(image.refusals.includes('image src scheme'));
  assert.match(textOf(image.nodes), /alt/);
});

test('an entity-encoded scheme cannot slip past — what is checked is what is set', async () => {
  const { decodeEntities } = await sanitize();
  // Numeric references decode, so `&#106;avascript:` is checked as
  // `javascript:` and refused.
  assert.equal(decodeEntities('&#106;avascript&#58;alert(1)'), 'javascript:alert(1)');
  const numeric = await render('<a href="&#106;avascript&#58;alert(1)">x</a>');
  assert.equal(flatten(numeric.nodes).find((n) => n.tag === 'a')!.attrs.href, undefined);

  // A named reference this decoder does not carry stays LITERAL — in the value
  // that is checked and in the value that would be set, which are the same
  // string. `setAttribute` performs no entity decoding, so the browser sees
  // exactly what was checked: a relative URL with an ampersand in it.
  assert.equal(decodeEntities('javascript&colon;alert(1)'), 'javascript&colon;alert(1)');
  const named = await render('<a href="javascript&colon;alert(1)">x</a>');
  // It carries no colon at all once `&colon;` fails to decode, so it is a
  // RELATIVE URL with an ampersand in it — which the browser would have
  // resolved against `/doc.html` and answered 404 for. `decideLink` looks it up
  // in the served manifest, finds nothing, and refuses to draw an anchor:
  // under-decoding is still cosmetic and still cannot widen what is allowed,
  // and the dead link it used to leave behind is gone too.
  assert.equal(
    flatten(named.nodes).find((n) => n.tag === 'a')!.attrs.href, undefined,
    'under-decoding is cosmetic and can never widen what is allowed',
  );
  assert.match(textOf(named.nodes), /x/, 'and the label survives — nothing is dropped');
});

test('neither module builds markup from a string — no innerHTML, no eval, no DOMParser', () => {
  // The structural guarantee, asserted on the SOURCE, because it is a property
  // of how these files are written rather than of any one input. There is no
  // CSP behind them (`security.ts` retired it on 2026-08-22), so this is the
  // only guarantee there is.
  for (const file of ['lib/markdown.js', 'lib/sanitize.js', 'doc.js']) {
    const source = readFileSync(path.join(PUBLIC, ...file.split('/')), 'utf8');
    // Comments in these files discuss `innerHTML` at length; the ban is on the
    // CALL, so the pattern requires the assignment or the invocation.
    assert.doesNotMatch(source, /\.innerHTML\s*=/, `${file} assigns innerHTML`);
    assert.doesNotMatch(source, /\.outerHTML\s*=/, `${file} assigns outerHTML`);
    assert.doesNotMatch(source, /insertAdjacentHTML|document\.write|new Function|\beval\(/,
      `${file} reaches for a markup-from-string or code-from-string sink`);
    assert.doesNotMatch(source, /new DOMParser|createContextualFragment/,
      `${file} parses markup — nodes are built, never parsed`);
  }
});

test('a tag outside the allow-list is refused, not unwrapped — the ruling keeps the mechanism', async () => {
  const out = await render('the value is <name> here');
  assert.ok(out.refusals.includes('tag:name'));
  assert.equal(tagsOf(out.nodes).includes('name'), false);
  // GitHub's own sanitiser would drop the tag and keep going in silence. The
  // ruling: "The refusal MECHANISM stays for everything outside the allow-list
  // - INV-nothing-is-dropped-silently is why it exists."
  assert.match(textOf(out.nodes), /the value is/);
  assert.match(textOf(out.nodes), /here/);
});

/* ══ 2 — ONE SLUG RULE, TWO HOMES ══════════════════════════════════════════ */

test('headingSlug in the browser module and in test/helpers agree — one rule, not two', async () => {
  const { headingSlug } = await renderer();
  const cases = [
    'my_context', 'What it can do', '`categories.<name>.enabled`', 'The five tiers',
    'A heading — with punctuation!', 'תוכן העניינים', 'CamelCase And Spaces',
    '`--json` flag', 'a  b   c', 'Trailing  ', '  Leading', '', '###',
    'mixed עברית and English', 'hyphen-already-here', '100% done',
  ];
  const disagreed = cases.filter((c) => headingSlug(c) !== helperSlug(c));
  assert.deepEqual(disagreed, [], 'the copy has drifted from the rule it copied');
});

test('the two spellings agree on every heading of every document the manifest serves', async () => {
  const { headingSlug } = await renderer();
  const { entries } = buildDocManifest(REPO);
  assert.ok(entries.length > 100, `expected the wide glob to find documents, found ${entries.length}`);
  const disagreed: string[] = [];
  let compared = 0;
  for (const entry of entries) {
    let markdown: string;
    try {
      markdown = readFileSync(entry.absPath, 'utf8').replaceAll('\r\n', '\n');
    } catch { continue; }
    for (const heading of helperHeadings(markdown)) {
      compared += 1;
      if (headingSlug(heading.text) !== helperSlug(heading.text)) {
        disagreed.push(`${entry.id}: ${JSON.stringify(heading.text)}`);
      }
    }
  }
  assert.ok(compared > 1000, `expected thousands of headings to compare, compared ${compared}`);
  assert.deepEqual(disagreed.slice(0, 10), []);
});

test('a heading gets GitHub\'s anchor, and a repeat gets -1, -2 in document order', async () => {
  const out = await render('# Alpha\n\n## Alpha\n\n### Alpha\n\n#### `code` span\n');
  assert.deepEqual(out.headings.map((h) => h.slug), ['alpha', 'alpha-1', 'alpha-2', 'code-span']);
  const levels = flatten(out.nodes).filter((n) => /^h[1-6]$/.test(n.tag));
  assert.deepEqual(levels.map((n) => n.tag), ['h1', 'h2', 'h3', 'h4']);
  assert.deepEqual(levels.map((n) => n.id), ['alpha', 'alpha-1', 'alpha-2', 'code-span']);
});

test('headings run h1..h6 here, where the console renderer caps them at h4', async () => {
  const source = '# a\n\n## b\n\n### c\n\n#### d\n\n##### e\n\n###### f\n';
  const gh = await render(source);
  assert.deepEqual(
    flatten(gh.nodes).filter((n) => /^h[1-6]$/.test(n.tag)).map((n) => n.tag),
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  );
  // The console card still nests under its own `<h3>`; that is unchanged, and
  // the difference between the two policies is deliberate.
  const console_ = (await renderer()).markdownNodes(source, fakeDoc());
  assert.deepEqual(
    flatten(console_.nodes).filter((n) => /^h[1-6]$/.test(n.tag)).map((n) => n.tag),
    ['h2', 'h3', 'h4', 'h4', 'h4', 'h4'],
  );
});

/* ══ 3 — GFM ═══════════════════════════════════════════════════════════════ */

test('a GFM table carries GitHub\'s align attribute, not markdown-it\'s style', async () => {
  const out = await render('| a | b | c |\n|:--|:-:|--:|\n| 1 | 2 | 3 |\n');
  const cells = flatten(out.nodes).filter((n) => n.tag === 'th' || n.tag === 'td');
  assert.deepEqual(cells.map((c) => c.attrs.align), ['left', 'center', 'right', 'left', 'center', 'right']);
  // `style` is not in the allow-list, so markdown-it's own `text-align` would
  // have been stripped and the column would have rendered unaligned.
  assert.deepEqual(cells.filter((c) => c.attrs.style !== undefined), []);
  assert.deepEqual(tagsOf(out.nodes), ['table', 'tbody', 'td', 'th', 'thead', 'tr']);
});

test('a GFM task list becomes a disabled checkbox, ticked or not, and the marker leaves the text', async () => {
  const out = await render('- [ ] open\n- [x] done\n- plain\n');
  const items = flatten(out.nodes).filter((n) => n.tag === 'li');
  assert.deepEqual(items.map((i) => i.className), ['task-list-item', 'task-list-item', '']);
  const boxes = flatten(out.nodes).filter((n) => n.tag === 'input');
  assert.equal(boxes.length, 2);
  assert.deepEqual(boxes.map((b) => b.attrs.type), ['checkbox', 'checkbox']);
  // Disabled, always: a box a reader could tick would claim a state change
  // this page cannot make, and GitHub disables them outside its own editor.
  assert.deepEqual(boxes.map((b) => b.attrs.disabled), ['', '']);
  assert.deepEqual(boxes.map((b) => b.attrs.checked), [undefined, '']);
  assert.equal(textOf(out.nodes).includes('[ ]'), false, 'the marker is not left in the prose');
  assert.equal(textOf(out.nodes).includes('[x]'), false);
  assert.match(textOf(out.nodes), /open/);
});

test('strikethrough, underscore emphasis and autolinks render, and an identifier is left alone', async () => {
  const out = await render(
    '~~struck~~ and _emphasis_ and __strong__ and <https://example.com> and https://bare.example\n\n'
    + 'source_file and valid_from and my_context stay whole.\n',
  );
  const tags = tagsOf(out.nodes);
  assert.ok(tags.includes('del'), 'GFM strikethrough');
  assert.ok(tags.includes('em'), 'underscore emphasis, which the console renderer hands back as text');
  assert.ok(tags.includes('strong'));
  assert.equal(flatten(out.nodes).filter((n) => n.tag === 'a').length, 2, 'autolink and bare URL');
  // CommonMark's intraword rule is what makes `_` safe to honour on a corpus
  // full of `source_file` and `valid_from` — the measurement the console
  // renderer's own refusal was taken on.
  assert.match(textOf(out.nodes), /source_file and valid_from and my_context stay whole\./);
});

test('an HTML comment renders as nothing at all — the ruling names this one', async () => {
  const out = await render('before\n\n<!-- example: a marker -->\n\nafter\n');
  assert.equal(textOf(out.nodes).includes('example'), false);
  assert.equal(textOf(out.nodes).includes('<!--'), false);
  assert.deepEqual(out.refusals, [], 'a comment is not a refusal — GitHub renders it as nothing');
  assert.match(textOf(out.nodes), /before/);
  assert.match(textOf(out.nodes), /after/);
});

test('the bidi wrappers both READMEs are built from survive, and markdown inside them is still markdown', async () => {
  const out = await render('<div dir="rtl">\n\n# כותרת\n\ntext with <span dir="ltr">--json</span> inside\n\n</div>\n');
  const div = flatten(out.nodes).find((n) => n.tag === 'div');
  assert.equal(div!.attrs.dir, 'rtl');
  const heading = flatten([div!]).find((n) => n.tag === 'h1');
  assert.notEqual(heading, undefined, 'markdown inside a block-level wrapper is still parsed');
  const span = flatten(out.nodes).find((n) => n.tag === 'span');
  assert.equal(span!.attrs.dir, 'ltr');
  // The open tag and the close tag arrive as two SEPARATE `html_inline`
  // tokens with the run between them; a fragment-local element stack could
  // never join them, which is why the renderer's stack is shared.
  assert.equal(textOf([span!]), '--json');
  assert.deepEqual(out.refusals, []);
});

test('a fenced block becomes pre > code, and a mermaid fence becomes a committed drawing', async () => {
  const code = await render('```json\n{"a":1}\n```\n');
  const pre = flatten(code.nodes).find((n) => n.tag === 'pre');
  assert.equal(pre!.children[0]!.tag, 'code');
  assert.equal(pre!.children[0]!.textContent, '{"a":1}\n');
  assert.equal(pre!.children[0]!.attrs['data-lang'], 'json');

  const { DIAGRAMS } = await import(
    pathToFileURL(path.join(PUBLIC, 'lib', 'diagrams.js')).href) as { DIAGRAMS: Record<string, string> };
  const [source, file] = Object.entries(DIAGRAMS)[0]!;
  const drawn = await render(`\`\`\`mermaid\n${source}\`\`\`\n`);
  const figure = flatten(drawn.nodes).find((n) => n.tag === 'figure');
  assert.equal(figure!.className, 'mermaid', 'drawn, not printed — the ruling\'s own instruction');
  assert.equal(figure!.children[0]!.attrs.src, `/diagrams/${file}`);
});

/* ══ 4 — THE MEASUREMENT THE RULING WAS TAKEN ON ═══════════════════════════ */

test('both READMEs: the refusal noise collapses, and what is left is named', async () => {
  const { githubNodes, markdownNodes } = await renderer();
  const measured: Record<string, { before: number; after: number; left: string[] }> = {};
  for (const file of ['README.md', 'docs/README.he.md']) {
    const src = readFileSync(path.join(REPO, ...file.split('/')), 'utf8');
    const before = markdownNodes(src, fakeDoc()).refusals;
    const after = githubNodes(src, fakeDoc(), undefined, whereFor(file));
    // A `link target` refusal draws NOTHING on the page — the label renders as
    // ordinary text and the count goes to the footer. It is therefore not
    // "noise" in the sense this measurement is about, which is boxes in the
    // reader's way, and it is counted separately below.
    const boxes = after.refusals.filter((r) => r !== 'link target');
    measured[file] = { before: before.length, after: boxes.length, left: [...new Set(boxes)] };
  }

  // The numbers the ruling was taken on: 141 English, 457 Hebrew, of which 124
  // and 440 were raw-HTML blocks and 131/132 of the source's constructs were
  // invisible `<!-- … -->` markers. Asserted as a FLOOR rather than as those
  // exact figures — the documents are edited every day and a pinned count
  // would fail for the wrong reason — with the collapse itself pinned hard.
  assert.ok(measured['README.md']!.before >= 100,
    `README.md: expected the console renderer to still refuse ~141, got ${measured['README.md']!.before}`);
  assert.ok(measured['docs/README.he.md']!.before >= 400,
    `README.he.md: expected ~457, got ${measured['docs/README.he.md']!.before}`);

  for (const [file, m] of Object.entries(measured)) {
    assert.ok(m.after <= 5,
      `${file}: ${m.after} refusals under the GitHub view — expected the noise to be gone. `
      + `Left: ${JSON.stringify(m.left)}`);
    // And what is left is a REAL non-HTML tag in prose, not a construct GitHub
    // would have rendered. `<name>` is a placeholder both READMEs write
    // outside a code span.
    for (const kind of m.left) {
      assert.match(kind, /^tag:/, `${file}: unexpected refusal kind ${kind}`);
    }
  }
});

test('across every served document, nothing is dropped in silence and no attribute sink is opened', async () => {
  const { githubNodes } = await renderer();
  const { entries } = buildDocManifest(REPO);
  const droppedNames = new Set<string>();
  const refusalKinds = new Set<string>();
  let documents = 0;
  for (const entry of entries) {
    let markdown: string;
    try {
      markdown = readFileSync(entry.absPath, 'utf8').replaceAll('\r\n', '\n');
    } catch { continue; }
    documents += 1;
    const out = githubNodes(markdown, fakeDoc(), undefined, whereFor(entry.id));
    for (const r of out.refusals) refusalKinds.add(r);
    for (const d of out.dropped) droppedNames.add(d.split('@')[1]!);
    // Nothing anywhere in the corpus may produce a script element or an
    // event-handler attribute — the property, measured over real input rather
    // than over a fixture.
    const built = flatten(out.nodes);
    assert.deepEqual(built.filter((n) => n.tag === 'script'), [], `${entry.id} built a script element`);
    const handlers = built.flatMap((n) => Object.keys(n.attrs).filter((a) => a.startsWith('on')));
    assert.deepEqual(handlers, [], `${entry.id} set an event-handler attribute`);
  }
  assert.ok(documents > 100, `expected the manifest to serve documents, walked ${documents}`);
  // Every refusal kind that occurs across the whole repository, listed rather
  // than counted: a new kind appearing is a thing to look at, not a number to
  // update.
  for (const kind of refusalKinds) {
    assert.match(kind, /^(tag:|url scheme$|image src scheme$|link target$)/,
      `unexpected refusal kind: ${kind}`);
  }
});

/* ══ 5 — NEVER A DEAD LINK ═════════════════════════════════════════════════

   `DEC-the-document-page-wears-github-styling-lists-the-readmes-and`: *"if the
   documents are refering other documents get them too or do not support the
   link"*. A link either opens what it names or is not drawn as a link, and the
   property that makes that checkable is that NO ANCHOR SURVIVES A RENDER
   without a target this server can answer for.                              */

test('a relative path resolves against the CONTAINING document\'s directory, as GitHub resolves it', async () => {
  const { resolveDocPath } = await renderer();
  assert.equal(resolveDocPath('docs', 'TUTORIAL.md'), 'docs/TUTORIAL.md');
  assert.equal(resolveDocPath('docs', '../README.md'), 'README.md');
  assert.equal(resolveDocPath('docs', './ROADMAP.md'), 'docs/ROADMAP.md');
  assert.equal(resolveDocPath('', 'CHANGELOG.md'), 'CHANGELOG.md');
  // A leading `/` is REPOSITORY-root-relative, which is GitHub's reading of it
  // inside a rendered README — not the web server's reading.
  assert.equal(resolveDocPath('docs/tutorials', '/README.md'), 'README.md');
  assert.equal(resolveDocPath('docs/superpowers/specs', '../plans/a.md'),
    'docs/superpowers/plans/a.md');
  // Out of the repository is not a document, and says so rather than clamping
  // to the root — a clamp would turn `../../../etc/passwd` into a lookup that
  // could succeed.
  assert.equal(resolveDocPath('docs', '../../elsewhere.md'), null);
  assert.equal(resolveDocPath('', '..'), null);
});

test('every href lands in exactly one of the four outcomes, and the fourth is NOT a link', async () => {
  const { decideLink } = await renderer();
  const where = {
    base: 'docs',
    openable: new Set(['README.md', 'docs/README.he.md', 'docs/ROADMAP.md']),
    slugs: new Set(['installing-it']),
  };
  // 1 — a document this server can open.
  assert.deepEqual(decideLink('ROADMAP.md', where),
    { kind: 'document', href: '/doc.html?doc=docs%2FROADMAP.md' });
  assert.deepEqual(decideLink('../README.md', where),
    { kind: 'document', href: '/doc.html?doc=README.md' });
  // …carrying its fragment through, so a link INTO a heading of another
  // document still lands on that heading.
  assert.deepEqual(decideLink('../README.md#installing-it', where),
    { kind: 'document', href: '/doc.html?doc=README.md#installing-it' });
  // 2 — a heading this document actually minted.
  assert.deepEqual(decideLink('#installing-it', where),
    { kind: 'fragment', href: '#installing-it' });
  // 3 — an absolute address. It leaves this server, which is what the author
  // asked for.
  assert.deepEqual(decideLink('https://example.com/x', where),
    { kind: 'external', href: 'https://example.com/x' });
  assert.deepEqual(decideLink('mailto:a@b.c', where),
    { kind: 'external', href: 'mailto:a@b.c' });
  // 4 — NOT A LINK. A repository file the manifest does not carry, a file with
  // no extension, a path out of the repository, a heading this document does
  // not contain, and an empty href.
  for (const href of ['CHANGELOG.md', '../LICENSE', '../../outside.md', '#no-such-heading', '', '#']) {
    assert.equal(decideLink(href, where), null, `${JSON.stringify(href)} must not be drawn as a link`);
  }
  // With NO roster nothing relative can be checked, so nothing relative is
  // drawn. A renderer that cannot check must not promise.
  assert.equal(decideLink('ROADMAP.md', { base: 'docs' }), null);
});

test('an unopenable link keeps its TEXT and loses its anchor — neither dead nor dropped', async () => {
  const openable = new Set(['docs/ROADMAP.md']);
  const out = await render(
    'see [the roadmap](ROADMAP.md), the [licence](../LICENSE) and [the log](CHANGELOG.md)',
    { base: 'docs', openable },
  );
  const anchors = flatten(out.nodes).filter((n) => n.tag === 'a');
  assert.deepEqual(anchors.map((a) => a.attrs.href), ['/doc.html?doc=docs%2FROADMAP.md'],
    'exactly the one link that opens something is drawn as a link');
  // The other two are still READABLE — the sentence is intact.
  assert.match(textOf(out.nodes), /see the roadmap, the licence and the log/);
  assert.equal(out.refusals.filter((r) => r === 'link target').length, 2,
    'and both are counted, so the page can disclose them');
});

test('a raw <a href> is held to the same rule as a markdown link', async () => {
  const openable = new Set(['README.md']);
  const out = await render('<a href="README.md">one</a> <a href="MISSING.md">two</a>',
    { base: '', openable });
  const anchors = flatten(out.nodes).filter((n) => n.tag === 'a');
  assert.deepEqual(anchors.map((a) => a.attrs.href), ['/doc.html?doc=README.md', undefined],
    'the raw anchor that names nothing keeps no href — an <a> with no href is not a link');
  assert.match(textOf(out.nodes), /one/);
  assert.match(textOf(out.nodes), /two/);
});

test('a `#` link is a link only where the heading exists — including one further down the page', async () => {
  const out = await render('[up](#later) and [nowhere](#absent)\n\n## Later\n');
  const anchors = flatten(out.nodes).filter((n) => n.tag === 'a');
  assert.deepEqual(anchors.map((a) => a.attrs.href), ['#later'],
    'the forward reference resolves, because the anchors are minted before the walk draws a link');
  assert.equal(flatten(out.nodes).find((n) => n.tag === 'h2')!.id, 'later',
    'and the id a link was checked against is the id the heading actually received');
  assert.match(textOf(out.nodes), /up and nowhere/);
});

test('the two READMEs: the named case works, and no anchor anywhere opens nothing', async () => {
  const { githubNodes } = await renderer();
  for (const [file, other] of [
    ['README.md', 'docs/README.he.md'],
    ['docs/README.he.md', 'README.md'],
  ] as const) {
    const src = readFileSync(path.join(REPO, ...file.split('/')), 'utf8');
    const out = githubNodes(src, fakeDoc(), undefined, whereFor(file));
    const anchors = flatten(out.nodes).filter((n) => n.tag === 'a');
    const hrefs = anchors.map((a) => a.attrs.href ?? '');
    // THE CASE THE OWNER NAMED: README.md links to docs/README.he.md and it
    // must work. Asserted in both directions, because the mirror links back.
    assert.ok(hrefs.includes(`/doc.html?doc=${encodeURIComponent(other)}`),
      `${file} must carry a working link to ${other}; it carries ${JSON.stringify([...new Set(hrefs)].filter((h) => !h.startsWith('#')))}`);
    // And NOTHING is left that a browser would resolve against `/doc.html` and
    // 404 on: every anchor is a fragment, a `/doc.html?doc=` address, or an
    // absolute URL. This is the whole ruling, as one assertion.
    const dead = hrefs.filter((h) => !(h.startsWith('#') || h.startsWith('/doc.html?doc=')
      || /^[a-z][a-z0-9+.-]*:/i.test(h)));
    assert.deepEqual(dead, [], `${file} drew ${dead.length} link(s) that open nothing`);
  }
});
