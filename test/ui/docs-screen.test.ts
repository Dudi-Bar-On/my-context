/**
 * **The Documentation screen's markdown-to-nodes half, tested in Node.**
 *
 * The limit is the one `test/ui/viewmodel.test.ts` states in its own header
 * and spec §6 states for the project: the DOM rendering in `app.js` and
 * `screens/*.js` has no test, because that would need a browser dependency
 * this project does not have. So `render()` is NOT exercised here — what is,
 * is every decision `screens/docs.js` makes that can be made without a
 * document: which element a block becomes, which runs are refused, and what
 * happens to input the subset does not understand.
 *
 * That half is testable at all because it takes its `doc` as an argument, the
 * same arrangement `lib/i18n.js`'s `t()` uses and for the same reason
 * (`src/ui/public/lib/i18n.js` · ``exists so `node --test` can pass a two-method stand-in; the browser`` · ~37).
 * Two factory methods are the entire DOM surface `markdownNodes` touches, so
 * two methods are all this file supplies.
 *
 * ── WHY THIS FILE REWRITES ONE IMPORT SPECIFIER, AND EXACTLY ONE ──────────
 *
 * `screens/docs.js` imports `'/screens/parts.js'` — a SERVER-ABSOLUTE
 * specifier, because the browser loads every screen from the UI server's own
 * root and that is the form the shell's `SCREENS` table uses. Node has no such
 * root: it resolves `/screens/parts.js` against the parent `file://` URL and
 * looks for `D:\screens\parts.js`, which does not exist. `viewmodel.test.ts`
 * never met this because `lib/`'s modules import nothing at all.
 *
 * So the module is read, that ONE specifier is replaced by the `file://` URL
 * of the very file it names, and the result is imported as a `data:` module.
 * Nothing else is transformed, and `substitutions` below asserts that the
 * rewrite happened — a renamed import, or a second one added later, fails this
 * file loudly instead of silently testing a module that no longer resolves.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const SCREENS = path.join(REPO, 'src', 'ui', 'public', 'screens');

/** The two-method stand-in's node. Deliberately NOT a DOM node: a field bag. */
interface FakeNode {
  tag: string;
  className: string;
  textContent: string;
  attrs: Record<string, string>;
  children: FakeNode[];
  append: (...kids: FakeNode[]) => void;
  setAttribute: (name: string, value: string) => void;
}

interface FakeDoc {
  createElement: (tag: string) => FakeNode;
  createTextNode: (text: string) => FakeNode;
}

interface DocsModule {
  markdownNodes: (src: unknown, doc: FakeDoc) => { nodes: FakeNode[]; refusals: string[] };
  render: (root: unknown, ctx: unknown) => Promise<void>;
}

function fakeDoc(): FakeDoc {
  const element = (tag: string): FakeNode => {
    const node: FakeNode = {
      tag,
      className: '',
      textContent: '',
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

/** `tag.class1.class2`, classes sorted — `e2e/screen-parity.spec.ts`' own form. */
function kind(node: FakeNode): string {
  const raw = node.className.trim();
  return raw === '' ? node.tag : `${node.tag}.${raw.split(/\s+/).sort().join('.')}`;
}

/** Every kind in a rendered tree, `#text` excluded, as a sorted array. */
function kindsOf(nodes: FakeNode[]): string[] {
  const seen = new Set<string>();
  const walk = (node: FakeNode): void => {
    if (node.tag !== '#text') seen.add(kind(node));
    for (const child of node.children) walk(child);
  };
  for (const node of nodes) walk(node);
  return [...seen].sort();
}

/**
 * The text a node carries. A node built by `append` holds its text in
 * children; one built by setting `textContent` holds it directly, and both
 * shapes occur — `make()` sets `textContent`, the block branches append.
 */
function textOf(node: FakeNode): string {
  return node.children.length > 0 ? node.children.map(textOf).join('') : node.textContent;
}

let substitutions = 0;

async function docsModule(): Promise<DocsModule> {
  const partsUrl = new URL(`file://${path.join(SCREENS, 'parts.js').replaceAll('\\', '/')}`).href;
  const source = readFileSync(path.join(SCREENS, 'docs.js'), 'utf8');
  const rewritten = source.replace("'/screens/parts.js'", JSON.stringify(partsUrl));
  substitutions = source === rewritten ? 0 : 1;
  const url = `data:text/javascript;base64,${Buffer.from(rewritten, 'utf8').toString('base64')}`;
  return (await import(url)) as DocsModule;
}

/** `markdownNodes(src)` against a fresh stand-in, which is most of this file. */
async function md(src: unknown): Promise<{ nodes: FakeNode[]; refusals: string[] }> {
  const { markdownNodes } = await docsModule();
  return markdownNodes(src, fakeDoc());
}

test('the module exports the screen and the renderer, and the one absolute import was rewritten', async () => {
  const mod = await docsModule();
  assert.equal(substitutions, 1,
    "docs.js no longer imports '/screens/parts.js' by that exact specifier — this file's rewrite " +
    'is now testing an unrewritten module, or a second server-absolute import has been added.');
  assert.equal(typeof mod.render, 'function', 'the screen contract is `export render(root, ctx)`');
  assert.equal(typeof mod.markdownNodes, 'function');
});

test('each block form becomes the element the mockup renderer names', async () => {
  const { nodes, refusals } = await md('# One\n\na paragraph\n\n- a\n- b\n\n* c');
  assert.deepEqual(nodes.map((n) => n.tag), ['h2', 'p', 'ul', 'ul']);
  // Both bullet markers, because the mockup accepts both: `/^[-*]\s/`.
  assert.deepEqual(nodes[2]!.children.map((n) => n.tag), ['li', 'li']);
  assert.deepEqual(nodes[3]!.children.map((n) => n.tag), ['li']);
  assert.deepEqual(nodes.map(textOf), ['One', 'a paragraph', 'ab', 'c']);
  assert.deepEqual(refusals, []);
});

/**
 * The heading shift is `h{min(level + 1, 4)}` — the mockup's own arithmetic —
 * and it is the reason `.md h1` in `styles.css` styles a tag this renderer can
 * never produce, while `h4` (what `###` becomes, and what the mockup's own
 * sample markdown produces) has no `.md` rule at all. Pinned here so the
 * mismatch is a measured fact in this task's report rather than a reading of
 * two files.
 */
test('heading levels shift by one, so ### is an h4 and no h1 is reachable', async () => {
  const { nodes } = await md('# a\n\n## b\n\n### c');
  assert.deepEqual(nodes.map((n) => n.tag), ['h2', 'h3', 'h4']);
});

test('a fenced block is text, and both the fence and its language tag are stripped', async () => {
  const plain = await md('```\nmycontext add constraint "…"\n```');
  assert.equal(plain.nodes[0]!.tag, 'pre');
  assert.equal(textOf(plain.nodes[0]!), 'mycontext add constraint "…"\n');

  const tagged = await md('```js\nconst x = 1;\n```');
  assert.equal(textOf(tagged.nodes[0]!), 'const x = 1;\n');

  // No inline pass runs inside a fence: a backtick or a bracket in a
  // transcript stays exactly what was written.
  const literal = await md('```\n[not](a-link) and **not** bold and `not` mono\n```');
  assert.deepEqual(kindsOf(literal.nodes), ['pre']);
});

test('inline runs build the four node kinds the mockup names, and nothing else', async () => {
  const { nodes, refusals } = await md('see `always: true`, **pinned**, and [scope](#4) now');
  const para = nodes[0]!;
  assert.equal(para.tag, 'p');
  assert.deepEqual(para.children.map((n) => kind(n)),
    ['#text', 'span.m', '#text', 'b', '#text', 'a', '#text']);
  assert.equal(textOf(para), 'see always: true, pinned, and scope now');
  // The href is set as an ATTRIBUTE, never by assigning markup.
  assert.equal(para.children[5]!.attrs['href'], '#4');
  assert.deepEqual(refusals, []);
});

test('every safe URL form the mockup allows is kept, and it is exactly four', async () => {
  const { nodes, refusals } = await md('[a](https://x.test) [b](http://x.test) [c](#7) [d](./x.md) [e](/x.md)');
  const hrefs = nodes[0]!.children.filter((n) => n.tag === 'a').map((n) => n.attrs['href']);
  assert.deepEqual(hrefs, ['https://x.test', 'http://x.test', '#7', './x.md', '/x.md']);
  assert.deepEqual(refusals, []);
});

test('code spans win, so a link or a bold run inside backticks is never re-parsed', async () => {
  const { nodes, refusals } = await md('`[not](javascript:alert(1))` and `**not**`');
  assert.deepEqual(nodes[0]!.children.map((n) => kind(n)), ['span.m', '#text', 'span.m']);
  assert.equal(textOf(nodes[0]!.children[0]!), '[not](javascript:alert(1))');
  assert.deepEqual(refusals, [], 'a payload inside backticks is not a link, so it is not a refusal either');
});

test('raw HTML is refused as a block, and its source survives inside the pre', async () => {
  const { nodes, refusals } = await md('<script>alert(1)</script>');
  assert.deepEqual(refusals, ['raw HTML']);
  const wrap = nodes[0]!;
  assert.deepEqual(wrap.children.map((n) => kind(n)), ['span.refusal', 'pre']);
  assert.equal(textOf(wrap.children[0]!), 'raw HTML block refused');
  // Shown, not swallowed — the difference between a refusal and a drop.
  assert.equal(textOf(wrap.children[1]!), '<script>alert(1)</script>');

  // A comment opens with `<!` and is the same decision, not a special case.
  const comment = await md('<!-- hidden -->');
  assert.deepEqual(comment.refusals, ['raw HTML']);
});

test('an unknown URL scheme is refused inline and keeps its label', async () => {
  const { nodes, refusals } = await md('press [here](javascript:alert(1)) or [here](data:text/html,x)');
  assert.deepEqual(refusals, ['url scheme', 'url scheme']);
  const refused = nodes[0]!.children.filter((n) => n.className === 'refusal');
  assert.deepEqual(refused.map(textOf), ['here (link refused)', 'here (link refused)']);
  assert.equal(nodes[0]!.children.some((n) => n.tag === 'a'), false, 'no anchor is built for a refused scheme');
});

/**
 * **The one place this renderer deliberately does NOT match the mockup's
 * script**, and the reason is on the screen it draws: `dv.mdnote` says *"Raw
 * HTML, images and unknown URL schemes are refused and shown as refusals"*.
 * The mockup's own script refuses two of those three — its inline pattern
 * matches `[alt](url)` inside `![alt](url)` and leaves the `!` behind as text,
 * so an image renders as a LINK. A screen that claims a refusal it does not
 * perform is worse than either behaviour, so the sentence wins over the
 * script and this test is the record of that call.
 */
test('an image is refused, which is what dv.mdnote promises and the mockup script does not do', async () => {
  const { nodes, refusals } = await md('![a diagram](./x.png) follows');
  assert.deepEqual(refusals, ['image']);
  assert.deepEqual(nodes[0]!.children.map((n) => kind(n)), ['span.refusal', '#text']);
  assert.equal(textOf(nodes[0]!.children[0]!), 'a diagram (image refused)');
  assert.equal(nodes[0]!.children.some((n) => n.tag === 'a'), false, 'an image must not become a link');
});

/**
 * **What the subset does not understand.** Every one of these is real markdown
 * that the mockup's renderer has no branch for, so each falls through to the
 * paragraph branch with its own source intact. Nothing is dropped; nothing is
 * mangled into a shape it is not. The pipe tables matter most, because the
 * `scope` topic this screen actually serves contains two of them.
 */
test('input the subset does not understand falls through to a paragraph, verbatim', async () => {
  const unhandled = [
    '| Pattern | Matches |\n|---|---|\n| `src/**` | everything |', // a pipe table
    '> a block quote',
    '1. first\n2. second',                                          // an ordered list
    '---',                                                          // a horizontal rule
    'A setext heading\n================',
    '#### four hashes is past the subset',
  ];
  for (const source of unhandled) {
    const { nodes, refusals } = await md(source);
    assert.equal(nodes.length, 1, `expected one node for: ${JSON.stringify(source)}`);
    assert.equal(nodes[0]!.tag, 'p', `expected a paragraph for: ${JSON.stringify(source)}`);
    assert.deepEqual(refusals, [], 'an unhandled construct is not a refusal — dv.mdnote names three, and these are not them');
  }

  // The table's own text survives, pipes and all: a reader can still read it,
  // which is the whole difference between a fallback and a loss.
  const table = await md('| a | b |\n|---|---|\n| 1 | 2 |');
  assert.equal(textOf(table.nodes[0]!), '| a | b |\n|---|---|\n| 1 | 2 |');

  // An indented bullet is trimmed first, so it IS a bullet. Stated rather than
  // assumed: `block.trim()` runs before every test in the chain.
  const indented = await md('  - a\n  - b');
  assert.equal(indented.nodes[0]!.tag, 'ul');

  // Single-asterisk emphasis is not in the subset either, and the served
  // `scope` topic uses it: *everywhere* / *nowhere*. It reaches the screen as
  // literal asterisks, which is the paragraph branch working as designed and
  // still a thing the reader sees.
  const italic = await md('stops meaning *everywhere* and starts meaning *nowhere*');
  assert.deepEqual(kindsOf(italic.nodes), ['p']);
  assert.equal(textOf(italic.nodes[0]!), 'stops meaning *everywhere* and starts meaning *nowhere*');
});

/**
 * **"Code spans win" is a tie-break, not a priority — measured, because the
 * first draft of this test assumed otherwise and was wrong.** The alternation
 * puts code first so that a link or a bold run INSIDE backticks is not
 * re-parsed, and that holds only where both alternatives could start at the
 * same index. A regex still takes the LEFTMOST match, so `**`x`**` is a bold
 * run whose payload keeps its backticks as literal text — the monospace is
 * lost, and with it the `unicode-bidi:isolate` that `.m` carries.
 *
 * This is not hypothetical: the served `scope` topic writes exactly that
 * twice, in the bullet list under *"When an empty scope means something
 * else"*. Pinned here so the cost is a fact in this task's report rather than
 * a reading of the pattern.
 */
test('a code span inside a bold run loses its monospace — leftmost match, not code-first', async () => {
  const { nodes } = await md('**`required`** — an item must declare a glob');
  assert.deepEqual(nodes[0]!.children.map((n) => kind(n)), ['b', '#text']);
  assert.equal(textOf(nodes[0]!.children[0]!), '`required`', 'the backticks survive as text inside the <b>');
  assert.equal(textOf(nodes[0]!), '`required` — an item must declare a glob');

  // The tie-break itself, where both alternatives DO start at index 0: the
  // code span takes it, and the `**` inside stays literal.
  const tied = await md('`**x**` after');
  assert.deepEqual(tied.nodes[0]!.children.map((n) => kind(n)), ['span.m', '#text']);
  assert.equal(textOf(tied.nodes[0]!.children[0]!), '**x**');
});

test('CRLF is normalised, so a Windows document keeps its paragraphs', async () => {
  const { nodes } = await md('# One\r\n\r\nfirst\r\n\r\nsecond');
  assert.deepEqual(nodes.map((n) => n.tag), ['h2', 'p', 'p'],
    'without the normalisation `/\\n{2,}/` sees `\\r` between the newlines and never splits');
  assert.deepEqual(nodes.map(textOf), ['One', 'first', 'second']);
});

test('empty and whitespace-only input render nothing at all', async () => {
  for (const source of ['', '   ', '\n\n\n', '\t\n  \n']) {
    const { nodes, refusals } = await md(source);
    assert.deepEqual(nodes, [], `expected no nodes for ${JSON.stringify(source)}`);
    assert.deepEqual(refusals, []);
  }
});

/**
 * A body that arrived as something other than a string is a fact about the
 * endpoint, and `String()` puts it on the screen instead of blanking the card.
 * `INV-nothing-is-dropped-silently` applied to the renderer's own input.
 */
test('a non-string body is shown rather than swallowed', async () => {
  const nothing = await md(undefined);
  assert.equal(nothing.nodes.length, 1);
  assert.equal(textOf(nothing.nodes[0]!), 'undefined');

  const shape = await md({ markdown: 'x' });
  assert.equal(textOf(shape.nodes[0]!), '[object Object]');

  // `null` and a number are the same decision, not special cases.
  assert.equal(textOf((await md(null)).nodes[0]!), 'null');
  assert.equal(textOf((await md(0)).nodes[0]!), '0');
});

/**
 * **The document this screen actually serves, rendered, and the kinds it does
 * and does not produce.** `/api/help/scope` answers `helpTopic('scope', …)`,
 * which is `src/help/topics/scope.md` verbatim — checked by running
 * `mycontext help scope` and diffing it against the file on 2026-08-23, equal
 * after trimming the CLI's trailing newline.
 *
 * This is the evidence behind this task's gap report. The mockup's `#mdout`
 * renders a sample containing a fenced block, a link and a `###` heading; the
 * served document contains none of those, so `pre`, `a` and `h4` are absent
 * from the shipped screen — and it contains nothing refusable, so
 * `span.refusal` is absent too. Those four are the ledger entries, and this
 * assertion is what will fail the day the served document changes and one of
 * them appears.
 */
test('the served scope topic renders exactly these kinds, which is the gap report measured', async () => {
  const source = readFileSync(path.join(REPO, 'src', 'help', 'topics', 'scope.md'), 'utf8');
  const { nodes, refusals } = await md(source);
  assert.deepEqual(kindsOf(nodes), ['b', 'h2', 'h3', 'li', 'p', 'span.m', 'ul']);
  assert.deepEqual(refusals, [], 'the shipped scope topic carries no raw HTML, no image and no unsafe URL');

  // Two pipe tables, both landing in the paragraph branch. This is the number
  // in the report, counted rather than estimated.
  const tables = nodes.filter((n) => n.tag === 'p' && textOf(n).startsWith('|'));
  assert.equal(tables.length, 2);

  // One `#` and four `##`: the `.md` rules that DO apply on this screen.
  assert.equal(nodes.filter((n) => n.tag === 'h2').length, 1);
  assert.equal(nodes.filter((n) => n.tag === 'h3').length, 4);
  assert.equal(nodes.filter((n) => n.tag === 'h4').length, 0);
});

/**
 * The five Contents rows and the section the second card renders are one
 * table in the module, so the card title can never drift from the row it
 * points at. Read out of the source rather than exported: the screen's DOM
 * glue is the untested surface, and widening its exports to let a test look
 * at a constant would be this file changing the module to suit itself.
 */
test('the Contents ordinals are the mockup own five, and the rendered section is the fourth', async () => {
  const source = readFileSync(path.join(SCREENS, 'docs.js'), 'utf8');
  const ordinals = [...source.matchAll(/\{ ordinal: (\d+), key: '(dv\.t\d)' \}/g)]
    .map((m) => [Number(m[1]), m[2]] as [number, string]);
  assert.deepEqual(ordinals, [[1, 'dv.t1'], [2, 'dv.t2'], [3, 'dv.t3'], [4, 'dv.t4'], [7, 'dv.t7']],
    'the mockup jumps from 4 to 7, which is the point of addressing by heading ordinal');
  assert.match(source, /const RENDERED = \{ topic: 'scope', entry: CONTENTS\[3\] \}/,
    'the rendered section must be the Contents entry it names — CONTENTS[3] is `4 · Scope`');
});
