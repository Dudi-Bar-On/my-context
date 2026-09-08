// @basis TASK-inline-code-in-a-conversation-gets-a-font-change-and-nothing,
// CONST-zero-runtime-dependencies,
// INV-nothing-is-dropped-silently
/**
 * **The hand-written tokeniser, and the seam it hangs on.**
 *
 * `src/ui/public/lib/highlight.js` exists because `CONST-zero-runtime-
 * dependencies` prices a vendored highlighter at nine pinned files and 49,091
 * bytes to colour 25 fenced blocks — the measurement is in that file's header,
 * and `lib/ansi.js` is the precedent for taking the other side of it. A
 * hand-written scanner has one failure mode a vendored one has already
 * survived, so the first assertion below is the one that matters:
 *
 *     **the text comes out exactly as it went in**
 *
 * A highlighter that drops a character or invents one is worse than no
 * highlighter, because the reader cannot see it happen — `INV-nothing-is-
 * dropped-silently` in the one place where the loss would be invisible. Every
 * language is held to it, over real fences taken from the owner's own
 * transcript and over the adversarial strings a regex scanner actually breaks
 * on: an unterminated string, a lone backtick, a `/*` with no closer.
 *
 * ── THE FIXTURES ARE REAL, AND ARE COMMITTED RATHER THAN READ ─────────────
 *
 * `TAGGED` below is eight of the twenty-five language-tagged fences measured on
 * the owner's session on 2026-09-09 — a TypeScript declaration, a `mycontext`
 * command line, the corpus's own YAML front matter, a Playwright fixture with
 * generics in it, an audit row, a `SELECT`, a two-line diff. They are copied in
 * rather than read out of `~/.claude`, so this file measures the same bytes on
 * every machine and reads nothing that exists on one.
 *
 * ── WHAT THIS FILE DELIBERATELY DOES NOT ASSERT ───────────────────────────
 *
 * It does not assert that a given token is "correctly" coloured in a
 * linguistic sense, because the tokeniser makes no such claim: its rule lists
 * are deliberately short and an unlisted keyword renders in the reader's own
 * ink. What is asserted is what the file promises — that the classes it emits
 * are the ones it declares, that a rule fires where its own comment says it
 * does, and that nothing else changes.
 *
 * The two-method `doc` is the arrangement `test/ui/markdown-renderer.test.ts`
 * and `lib/ansi.js` both use: the module's only contact with a document is
 * `createElement` and `createTextNode`, so the whole of it is measurable here
 * without a browser. The BROWSER half — that these classes reach the screen as
 * colour, in both languages, without disturbing the LTR island a `<pre>` is —
 * is `e2e/code-colour.spec.ts`, because a class that no rule matches would pass
 * every assertion in this file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');

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

function textOf(node: FakeNode): string {
  return node.children.length > 0 ? node.children.map(textOf).join('') : node.textContent;
}

function served(specifier: string): string {
  return pathToFileURL(path.join(PUBLIC, ...specifier.slice(1).split('/'))).href;
}

interface HighlightModule {
  languageFor: (info: unknown) => string | null;
  highlightNodes: (source: string, lang: string | null, doc: FakeDoc) => FakeNode[];
  LANGUAGES: string[];
}

interface RendererModule {
  markdownNodes: (src: unknown, doc: FakeDoc) => { nodes: FakeNode[]; refusals: string[] };
}

async function highlighter(): Promise<HighlightModule> {
  return (await import(served('/lib/highlight.js'))) as HighlightModule;
}

async function md(src: string): Promise<FakeNode[]> {
  const { markdownNodes } = (await import(served('/lib/markdown.js'))) as RendererModule;
  return markdownNodes(src, fakeDoc()).nodes;
}

/** The class every token in `nodes` wears, `#text` runs excluded. */
function classesOf(nodes: FakeNode[]): string[] {
  return nodes.filter((n) => n.tag !== '#text').map((n) => n.className);
}

/** The text carried by every span wearing `cls`. */
function tokens(nodes: FakeNode[], cls: string): string[] {
  return nodes.filter((n) => n.className === cls).map((n) => n.textContent);
}

/**
 * Eight of the twenty-five language-tagged fences on the owner's transcript,
 * 2026-09-09, verbatim. `[tag, source]`.
 */
const TAGGED: Array<[string, string]> = [
  ['ts', 'const withChecksum: Item = { ...item, checksum: computeItemChecksum(item) };'],
  ['bash', 'tail -n 6 .my_context/.audit/audit.jsonl | cut -c1-60'],
  ['bash', 'mycontext config categories.task.extraFields --unset progress,last_change --yes'],
  ['yaml', 'tags:\n  - "plan:hooks"\n  - "seq:16"\n  - "state:todo"'],
  ['js', 'if (typeof record.tokens === \'number\') tokens += record.tokens;'],
  ['js', 'export const test = base.extend<{ app: App }>({\n  app: async ({ page }, use) => {\n    harness = await startUiChild(CORPUS);   // spawns a whole UI server'],
  ['json', '{"kind":"mutation","op":"update","itemId":"TASK-the-e2e-app-fixture",\n "fields":["extra.state","tags"],"at":"2026-09-04T07:46:37.211Z"}'],
  ['sql', "SELECT seq FROM audit WHERE kind = 'injection' AND session_id = ? AND op IN (…)"],
  ['diff', '- Its plan, sequence, state and progress live in extra fields\n+ Its plan, sequence and state live in extra fields'],
];

/**
 * Input a regex scanner actually breaks on, rather than input that looks
 * dangerous. Each of these has a rule in `highlight.js` that COULD run off the
 * end of the source or match nothing and refuse to advance.
 */
const ADVERSARIAL = [
  '',
  '`',
  '"unterminated',
  "'",
  '/* never closed',
  '//',
  '#',
  '--',
  '$',
  '${',
  '\n\n\n',
  '[2m not an escape sequence to this file [22m',
  'שלום `path` שלום',
  '0x',
  '.',
  '- ',
  'a'.repeat(4000),
];

test('the seam reads the info string and nothing else', async () => {
  const { languageFor } = await highlighter();
  assert.equal(languageFor('js'), 'js');
  assert.equal(languageFor('JavaScript'), 'js');
  assert.equal(languageFor('sh'), 'bash');
  assert.equal(languageFor('yml'), 'yaml');
  assert.equal(languageFor('patch'), 'diff');
  // The first word only: ```js title=x is a real spelling.
  assert.equal(languageFor('  ts   title=one.ts '), 'ts');
  // The two `null`s a caller must be able to tell apart by looking at `info`.
  assert.equal(languageFor(''), null, 'a fence that declared nothing');
  assert.equal(languageFor('python'), null, 'a fence that declared something unhandled');
  assert.equal(languageFor(undefined), null);
  assert.equal(languageFor(null), null);
});

test('every canonical language has a tokeniser, and every alias lands on one', async () => {
  const { languageFor, highlightNodes, LANGUAGES } = await highlighter();
  for (const lang of LANGUAGES) {
    assert.equal(languageFor(lang), lang, `${lang} is its own alias`);
    const nodes = highlightNodes('x', lang, fakeDoc());
    assert.ok(nodes.length > 0, `${lang} produced no nodes`);
  }
});

test('THE INVARIANT: the text comes out exactly as it went in', async () => {
  const { languageFor, highlightNodes, LANGUAGES } = await highlighter();
  for (const [tag, source] of TAGGED) {
    const lang = languageFor(tag);
    assert.notEqual(lang, null, `${tag} should have a tokeniser`);
    const out = highlightNodes(source, lang, fakeDoc()).map(textOf).join('');
    assert.equal(out, source, `${tag} fence was not reproduced byte for byte`);
  }
  // And every language against every adversarial string, which is where a
  // scanner loses a character rather than where it looks like it might.
  for (const lang of LANGUAGES) {
    for (const source of ADVERSARIAL) {
      const out = highlightNodes(source, lang, fakeDoc()).map(textOf).join('');
      assert.equal(out, source, `${lang} lost or invented text on ${JSON.stringify(source)}`);
    }
  }
});

test('a language nobody wrote a tokeniser for renders as one plain text node', async () => {
  const { highlightNodes } = await highlighter();
  const nodes = highlightNodes('print("hello")', 'python', fakeDoc());
  assert.deepEqual(nodes.map((n) => n.tag), ['#text']);
  assert.equal(textOf(nodes[0]!), 'print("hello")');
});

test('a token is a class and never an inline colour', async () => {
  const { languageFor, highlightNodes } = await highlighter();
  for (const [tag, source] of TAGGED) {
    for (const node of highlightNodes(source, languageFor(tag), fakeDoc())) {
      assert.deepEqual(node.attrs, {}, 'a token span set an attribute');
      if (node.tag === '#text') continue;
      assert.equal(node.tag, 'span');
      assert.match(node.className, /^tvh-[a-z]+$/,
        `${node.className} is outside the declared vocabulary`);
    }
  }
});

test('javascript: comments, strings, keywords, calls and dotted members', async () => {
  const { highlightNodes } = await highlighter();
  const nodes = highlightNodes(
    'const n = 42; // why\nif (typeof record.tokens === \'number\') startUiChild(CORPUS);',
    'js', fakeDoc());
  assert.deepEqual(tokens(nodes, 'tvh-c'), ['// why']);
  assert.deepEqual(tokens(nodes, 'tvh-s'), ["'number'"]);
  assert.deepEqual(tokens(nodes, 'tvh-n'), ['42']);
  assert.deepEqual(tokens(nodes, 'tvh-k'), ['const', 'if', 'typeof']);
  // `record` is plain, `tokens` is the member — the dotted rule runs before the
  // Capitalised and call rules for exactly this reason.
  assert.deepEqual(tokens(nodes, 'tvh-p'), ['tokens']);
  assert.deepEqual(tokens(nodes, 'tvh-f'), ['startUiChild']);
  assert.deepEqual(tokens(nodes, 'tvh-t'), ['CORPUS']);
});

test('typescript is javascript plus its own keywords, and nothing else', async () => {
  const { highlightNodes } = await highlighter();
  const src = 'interface App { readonly port: number }';
  const asTs = tokens(highlightNodes(src, 'ts', fakeDoc()), 'tvh-k');
  const asJs = tokens(highlightNodes(src, 'js', fakeDoc()), 'tvh-k');
  assert.deepEqual(asTs, ['interface', 'readonly', 'number']);
  assert.deepEqual(asJs, [], 'none of the three is a JavaScript keyword');
  // Everything else is identical, which is what "js plus a list" means.
  assert.deepEqual(
    tokens(highlightNodes(src, 'ts', fakeDoc()), 'tvh-t'),
    tokens(highlightNodes(src, 'js', fakeDoc()), 'tvh-t'));
});

test('shell colours the command position, its flags and its variables', async () => {
  const { highlightNodes } = await highlighter();
  const nodes = highlightNodes(
    '# a note\nmycontext config categories.task.extraFields --unset progress --yes\n'
    + 'tail -n 6 .my_context/.audit/audit.jsonl | cut -c1-60\n'
    + 'node ${CLAUDE_PLUGIN_ROOT}/src/mcp/server.ts',
    'bash', fakeDoc());
  assert.deepEqual(tokens(nodes, 'tvh-c'), ['# a note']);
  // The verb of each pipeline stage, and only the verb.
  assert.deepEqual(tokens(nodes, 'tvh-f'), ['mycontext', 'tail', 'cut', 'node']);
  assert.deepEqual(tokens(nodes, 'tvh-a'), ['--unset', '--yes', '-n', '-c1-60']);
  assert.deepEqual(tokens(nodes, 'tvh-v'), ['${CLAUDE_PLUGIN_ROOT}']);
  // NO number rule in shell, on purpose: `--port 58888`, `-c1-60` and
  // `markdown-it@15.0.1` are not literals, and colouring the digits inside
  // them would be the wrong claim on nearly every line of this corpus.
  assert.deepEqual(tokens(nodes, 'tvh-n'), []);
});

test('json separates a key from a string, which is the whole of reading one', async () => {
  const { highlightNodes } = await highlighter();
  const nodes = highlightNodes(
    '{"kind":"mutation","enabled":true,"everyNToolCalls":15}', 'json', fakeDoc());
  assert.deepEqual(tokens(nodes, 'tvh-p'), ['"kind"', '"enabled"', '"everyNToolCalls"']);
  assert.deepEqual(tokens(nodes, 'tvh-s'), ['"mutation"']);
  assert.deepEqual(tokens(nodes, 'tvh-l'), ['true']);
  assert.deepEqual(tokens(nodes, 'tvh-n'), ['15']);
});

test('yaml reads a key without reading its value as a second one', async () => {
  const { highlightNodes } = await highlighter();
  const nodes = highlightNodes(
    'plan: hooks          # extra, undeclared\n'
    + 'seq: "16"\n'
    + 'source: "my-context/docs/plans/x.md#task-16"\n'
    + 'tags:\n  - "plan:hooks"',
    'yaml', fakeDoc());
  assert.deepEqual(tokens(nodes, 'tvh-p'), ['plan', 'seq', 'source', 'tags']);
  assert.deepEqual(tokens(nodes, 'tvh-c'), ['# extra, undeclared']);
  // The `#` inside a quoted value is NOT a comment: the string rule wins the
  // position, and a `#` that is not preceded by whitespace never starts one.
  assert.deepEqual(tokens(nodes, 'tvh-s'),
    ['"16"', '"my-context/docs/plans/x.md#task-16"', '"plan:hooks"']);
});

test('sql keywords are case-insensitive and a table name is not one', async () => {
  const { highlightNodes } = await highlighter();
  const nodes = highlightNodes(
    "select seq from audit where kind = 'injection' -- a note", 'sql', fakeDoc());
  assert.deepEqual(tokens(nodes, 'tvh-k'), ['select', 'from', 'where']);
  assert.deepEqual(tokens(nodes, 'tvh-s'), ["'injection'"]);
  assert.deepEqual(tokens(nodes, 'tvh-c'), ['-- a note']);
});

test('a diff colours lines, and a file header is not a removal', async () => {
  const { highlightNodes } = await highlighter();
  const nodes = highlightNodes(
    '--- a/one.ts\n+++ b/one.ts\n@@ -1 +1 @@\n-was\n+is\n unchanged\n', 'diff', fakeDoc());
  assert.deepEqual(tokens(nodes, 'tvh-meta'),
    ['--- a/one.ts\n', '+++ b/one.ts\n', '@@ -1 +1 @@\n']);
  assert.deepEqual(tokens(nodes, 'tvh-del'), ['-was\n']);
  assert.deepEqual(tokens(nodes, 'tvh-add'), ['+is\n']);
  assert.deepEqual(nodes.filter((n) => n.tag === '#text').map(textOf), [' unchanged\n']);
});

/* ══ THE RENDERER'S SIDE OF THE SEAM ══════════════════════════════════════ */

test('a fence that declares a language carries it and its tokens', async () => {
  const nodes = await md('```js\nconst a = 1;\n```');
  assert.deepEqual(nodes.map((n) => n.tag), ['pre']);
  assert.equal(nodes[0]!.attrs['data-lang'], 'js');
  assert.ok(classesOf(nodes[0]!.children).includes('tvh-k'));
  assert.equal(textOf(nodes[0]!), 'const a = 1;\n');
});

test('a fence that declares an unhandled language is labelled and left plain', async () => {
  const nodes = await md('```python\nprint(1)\n```');
  // The label is drawn — the reader is told what it said — and no token span
  // exists, so nothing claims to have been understood.
  assert.equal(nodes[0]!.attrs['data-lang'], 'python');
  assert.deepEqual(classesOf(nodes[0]!.children), []);
  assert.equal(textOf(nodes[0]!), 'print(1)\n');
});

test('a fence that declares nothing is byte for byte the <pre> it always was', async () => {
  const nodes = await md('```\nbody_disagrees_with_meta (34)  [info]\n```');
  assert.deepEqual(nodes.map((n) => n.tag), ['pre']);
  assert.equal(nodes[0]!.className, '');
  assert.deepEqual(nodes[0]!.attrs, {}, 'no data-lang, so no label and no signal');
  assert.deepEqual(nodes[0]!.children, [], 'textContent, not appended children');
  assert.equal(textOf(nodes[0]!), 'body_disagrees_with_meta (34)  [info]\n');
});

test('an indented code block declares nothing and is treated as such', async () => {
  const nodes = await md('    an indented block\n');
  assert.deepEqual(nodes.map((n) => n.tag), ['pre']);
  assert.deepEqual(nodes[0]!.attrs, {});
});

test('a mermaid fence is still a diagram and not a coloured block', async () => {
  const nodes = await md('```mermaid\nflowchart TB\n  a --> b\n```');
  // No drawing on file for this source, so it falls back to a plain <pre> —
  // and crucially NOT to a `data-lang="mermaid"` label, because the mermaid
  // branch is taken before the fence branch.
  assert.deepEqual(nodes[0]!.attrs, {});
});

test('the label is what the AUTHOR wrote, not what it was coloured as', async () => {
  const nodes = await md('```sh\nls\n```');
  assert.equal(nodes[0]!.attrs['data-lang'], 'sh', 'the fence said sh, so the label says sh');
  assert.ok(classesOf(nodes[0]!.children).includes('tvh-f'), 'and it is coloured as bash');
});

test('a fence inside a list still gets the treatment, because the walk is one', async () => {
  const nodes = await md('- an item\n\n  ```json\n  {"a":1}\n  ```\n');
  const pre: FakeNode[] = [];
  const walk = (n: FakeNode): void => {
    if (n.tag === 'pre') pre.push(n);
    for (const kid of n.children) walk(kid);
  };
  for (const n of nodes) walk(n);
  assert.equal(pre.length, 1);
  assert.equal(pre[0]!.attrs['data-lang'], 'json');
});
