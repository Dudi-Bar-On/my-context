/**
 * **The one markdown renderer, and the only place a document becomes nodes.**
 *
 * `markdownNodes(src, doc, labelFor)` → `{ nodes, refusals }`. Same name, same
 * signature, same return shape it has had since it was written; what changed on
 * 2026-09-05 is WHERE it lives and WHAT tokenises for it.
 *
 * ── WHY IT MOVED OUT OF `screens/docs.js` ─────────────────────────────────
 *
 * It was imported by `app.js` (the item detail pane), `screens/tut.js` (the
 * tutorial reader) and used in-module by `screens/docs.js` — a shared renderer
 * living inside one screen, so two of its three callers reached across a screen
 * boundary to get it. `DEC-markdown-is-served-from-a-manifest-rendered-by-one-
 * renderer` already said *"two call sites are fine; two implementations are the
 * defect"*; this is that decision finishing its sentence. Callers changed one
 * import line and nothing else.
 *
 * ── WHY A VENDORED TOKENISER, AND NOT A THIRD HAND-WRITTEN SCANNER ────────
 *
 * `DEC-markdown-it-is-vendored-as-the-tokeniser-and-the-drawings`, owner ruling
 * of 2026-09-05, taken on measurement rather than on preference. What stood
 * here was a hand-written block/inline scanner whose fence rule was
 * `/^\s*```/` — a boolean toggled on every line starting with three backticks.
 * Both READMEs use CommonMark's VARIABLE-LENGTH fences (four four-backtick
 * blocks and two five-backtick ones, wrapping six nested three-backtick lines,
 * because the READMEs quote markdown at themselves), so the parity flipped and
 * the rest of each document was swallowed. Measured over the real files with
 * the repository's own two-method fake document:
 *
 *                             before        after (this file)
 *     README inside a <pre>   84%           see docs/superpowers/specs/
 *     tables surviving        0 of 29       2026-09-05-documentation-tooling-
 *     headings surviving      37 of ~100    research.md for the method, and
 *     largest single <pre>    45,244 chars  the task report for the numbers
 *
 * That regex was the THIRD copy of a rule already fixed twice the same day —
 * in `src/ui/read-model.ts`'s `docHeadings`, and before that in
 * `test/helpers/markdown.ts`, whose own header warns that "a second copy of a
 * subtle rule is how the first copy goes quietly wrong". Patching it a third
 * time was measured too and reaches 30% / 17 of 29 tables: real, and half a
 * fix. The library is adopted to END the bug class, not to patch its third
 * instance.
 *
 * ── WHAT IS AND IS NOT DELEGATED ──────────────────────────────────────────
 *
 * markdown-it is a TOKENISER here and nothing else. `md.parse()` is called,
 * `md.render()` never is: no HTML string is produced anywhere in this file,
 * which is `dv.mdnote`'s whole security argument — a renderer with no string
 * stage has no sanitiser to get wrong. Every node is `createElement` and
 * `textContent`.
 *
 * The three refusals the screen PROMISES are ours, not the library's:
 *
 *   1. **Raw HTML is refused.** `html: false`, so markdown-it emits no
 *      `html_block` or `html_inline` token at all; a block that opens with a
 *      tag arrives as an ordinary paragraph and `RAW_HTML` below turns it into
 *      a labelled refusal carrying its own source. This is the ruling's
 *      instruction, restated so it is not weakened by a later edit that thinks
 *      `html: true` plus an allow-list would render the Hebrew mirror better.
 *      It would; it is also not what was ruled.
 *   2. **Unknown URL schemes are refused.** `md.validateLink` is replaced by
 *      `() => true` **on purpose**: markdown-it's own check is a DENY-list
 *      (`javascript:`, `vbscript:`, `file:`, `data:`) that silently turns a
 *      rejected link back into plain text, which is a DROP and not a refusal.
 *      Letting every link through as a token and applying `SAFE_HREF` — an
 *      ALLOW-list, and the same four forms as before — is both stricter and
 *      visible: the reader is told a link was there and what it claimed to be.
 *   3. **Images are refused**, alt text kept, exactly as before.
 *
 * ── THREE CONSTRUCTS THE LIBRARY UNDERSTANDS AND THIS FILE DELIBERATELY
 *    HANDS BACK AS TEXT ───────────────────────────────────────────────────
 *
 * `_underscore emphasis_`, `__underscore strong__` and `~~strikethrough~~`.
 * markdown-it parses all three; the corpus was measured and contains ONE
 * underscore run and ONE strikethrough across 706 documents, while `_` sits
 * inside an identifier (`source_file`, `valid_from`) on nearly every page.
 * Honouring them would corrupt real text to serve two runs. The token's own
 * `markup` says which spelling produced it, so the branch is exact rather than
 * a guess, and the markers are re-emitted as text so nothing is dropped.
 *
 * ── DIAGRAMS ──────────────────────────────────────────────────────────────
 *
 * A ```` ```mermaid ```` fence becomes a `<figure class="mermaid">` holding an
 * `<img>` pointed at a COMMITTED SVG. mermaid itself is a devDependency that
 * never ships (`scripts/gen-diagrams.ts` draws them ahead of time;
 * `test/ui/diagram-gate.test.ts` goes red when a drawing and its source
 * disagree) — vendoring mermaid to draw in the browser was priced at 3.57 MB,
 * 96% of the whole cost, and rejected. A fence with no drawing on file falls
 * back to the `<pre>` any other fence would have produced: nothing is dropped
 * and nothing is invented.
 */
import MarkdownIt from './vendor/markdown-it.esm.min.js';
import { DIAGRAMS } from './diagrams.js';

/** The safe URL schemes, exactly the set this renderer has always allowed. */
const SAFE_HREF = /^(https?:|#|\.\/|\/)/;

/**
 * A block that OPENS with a tag. `</div>` is included and `<[a-z!]` alone was
 * not: the Hebrew mirror closes 149 `<div dir="rtl">` wrappers, and a closing
 * tag printed as prose is a raw HTML block that was neither drawn nor refused
 * — the one outcome `INV-nothing-is-dropped-silently` and `dv.mdnote` agree is
 * wrong. A tag can still not INTERRUPT a paragraph (markdown-it's own rule,
 * and CommonMark's), so the `<the answer>)` line in the `workflow` help topic
 * is prose here exactly as it was before.
 */
const RAW_HTML = /^<\/?[a-z!]/i;

/** Where `scripts/gen-diagrams.ts` writes, as the browser addresses it. */
const DIAGRAM_BASE = '/diagrams/';

/**
 * The tokeniser, configured once. `html: false` is the ruling; `linkify` and
 * `typographer` are off because neither is wanted and both add surprises to a
 * corpus full of paths and flags. `validateLink` is opened up so that THIS
 * file decides which links live — see the header.
 */
const PARSER = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
  breaks: false,
});
PARSER.validateLink = () => true;

/** `el()`'s job, but against an injected `doc` — this half must run in Node. */
function make(doc, tag, cls, text) {
  const node = doc.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

/**
 * A refused BLOCK: the label as a `.refusal`, and the block's own source in a
 * `<pre>` beneath it. The source is shown rather than swallowed because that
 * is the difference between a refusal and a drop.
 */
function refusalBlock(doc, label, source) {
  const wrap = doc.createElement('div');
  wrap.append(make(doc, 'span', 'refusal', label), make(doc, 'pre', null, source));
  return wrap;
}

/** One attribute off a markdown-it token, or `''`. */
function attr(token, name) {
  for (const pair of token.attrs ?? []) if (pair[0] === name) return pair[1];
  return '';
}

/** The plain text a run of inline tokens carries — a refusal's label. */
function plainText(tokens) {
  return tokens.map((t) => (t.type === 'code_inline' || t.type === 'text' ? t.content : '')).join('');
}

/**
 * The markers a construct outside the subset is handed back as. `null` means
 * the construct IS in the subset and gets a real element.
 */
function literalMarkup(token) {
  if (token.type === 's_open' || token.type === 's_close') return token.markup;
  if (token.markup === '_' || token.markup === '__') return token.markup;
  return null;
}

/**
 * One `inline` token's children onto `parent`.
 *
 * `refusals` is an out-parameter, the arrangement this renderer has always
 * used: an inline refusal has to be both drawn where it happened AND counted
 * for the caller.
 *
 * The stack is what makes emphasis nesting free. A code span inside a bold run
 * is a real `span.m` inside a real `<b>` — which matters beyond looks, because
 * `.m` carries the `unicode-bidi: isolate` that keeps a path or a `--flag`
 * from reordering mid-sentence on the Hebrew page. A construct handed back as
 * text pushes its parent again, so its payload lands in the same element and
 * the markers sit around it.
 */
function inlineInto(parent, tokens, refusals, doc, labelFor) {
  const stack = [parent];
  const top = () => stack[stack.length - 1];
  const add = (node) => { top().append(node); };
  const text = (value) => { if (value !== '') add(doc.createTextNode(value)); };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    switch (token.type) {
      case 'text':
        text(token.content);
        break;
      // A newline the author wrote. The paragraph's lines are joined by it,
      // which is what the line-scanning renderer this replaces also did.
      case 'softbreak':
      case 'hardbreak':
        text('\n');
        break;
      // `.m` — monospace, `direction:ltr`, `unicode-bidi:isolate`.
      case 'code_inline':
        add(make(doc, 'span', 'm', token.content));
        break;
      case 'strong_open':
      case 'em_open': {
        const literal = literalMarkup(token);
        if (literal !== null) { text(literal); stack.push(top()); break; }
        const node = make(doc, token.type === 'strong_open' ? 'b' : 'em', null, null);
        add(node);
        stack.push(node);
        break;
      }
      case 'strong_close':
      case 'em_close': {
        const literal = literalMarkup(token);
        stack.pop();
        if (literal !== null) text(literal);
        break;
      }
      // Strikethrough: one occurrence in 706 documents, handed back verbatim.
      case 's_open':
        text(token.markup);
        stack.push(top());
        break;
      case 's_close':
        stack.pop();
        text(token.markup);
        break;
      case 'link_open': {
        const href = attr(token, 'href');
        // The matching close, so a refused link's LABEL can be read off the
        // tokens it wraps and then skipped whole.
        let depth = 1;
        let end = i + 1;
        for (; end < tokens.length && depth > 0; end += 1) {
          if (tokens[end].type === 'link_open') depth += 1;
          if (tokens[end].type === 'link_close') depth -= 1;
        }
        const inner = tokens.slice(i + 1, end - 1);
        if (SAFE_HREF.test(href)) {
          const anchor = make(doc, 'a', null, null);
          anchor.setAttribute('href', href);
          add(anchor);
          inlineInto(anchor, inner, refusals, doc, labelFor);
        } else {
          // `javascript:`, `data:`, `mailto:` and everything else nobody
          // enumerated. The LABEL survives, so the reader knows a link was
          // there and what it claimed to be.
          refusals.push('url scheme');
          add(make(doc, 'span', 'refusal', labelFor('dv.linkRefused', { label: plainText(inner) })));
        }
        i = end - 1;
        break;
      }
      case 'link_close':
        break;
      // An image. Refused per `dv.mdnote`, and the alt text is kept: it is the
      // only thing about the image the reader can be told without fetching it.
      case 'image':
        refusals.push('image');
        add(make(doc, 'span', 'refusal', labelFor('dv.imgRefused', { alt: token.content })));
        break;
      default:
        // Every remaining inline token carries its source in `content`, so an
        // unhandled one is shown rather than dropped.
        text(token.content ?? '');
        break;
    }
  }
}

/**
 * A ```` ```mermaid ```` fence. The drawing is a file `scripts/gen-diagrams.ts`
 * produced and a test keeps in step; with no file on record the fence renders
 * as the `<pre>` any other fence would have produced.
 */
function diagramNode(doc, source) {
  const file = DIAGRAMS[source];
  if (file === undefined) return make(doc, 'pre', null, source);
  const figure = make(doc, 'figure', 'mermaid', null);
  const image = make(doc, 'img', null, null);
  image.setAttribute('src', `${DIAGRAM_BASE}${file}`);
  // The document's own words, not the product's, so this is not a keyed
  // string: `flowchart TB`, `stateDiagram-v2` — what the diagram declares
  // itself to be.
  image.setAttribute('alt', source.split('\n')[0].trim());
  figure.append(image);
  return figure;
}

/**
 * The block walk. markdown-it's block tokens are a FLAT array with `nesting`
 * on the openers and closers, so one element stack reproduces the tree — and
 * a blockquote holding a heading, a list holding a list, and a table cell
 * running the inline pass all fall out of it rather than each needing a
 * branch.
 */
function blockNodes(tokens, refusals, doc, labelFor) {
  const out = [];
  const stack = [];
  const emit = (node) => {
    if (stack.length === 0) out.push(node); else stack[stack.length - 1].append(node);
  };
  const open = (tag, cls) => { const node = make(doc, tag, cls, null); emit(node); stack.push(node); };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    switch (token.type) {
      // `#` → h2 … `######` → h4, the arithmetic this renderer has always
      // used. `.md h1` therefore styles a tag it cannot emit, which is
      // recorded in `styles.css` and left alone.
      case 'heading_open':
        open(`h${Math.min(Number(token.tag.slice(1)) + 1, 4)}`, null);
        break;
      case 'paragraph_open': {
        // A tight list hides its paragraphs; its inline content belongs to the
        // `<li>` directly, which is what makes `textOf(li)` the item's words
        // and nothing else.
        if (token.hidden) break;
        // Raw HTML, refused as a block. The paragraph's own `content` is its
        // source, so the refusal carries exactly what was written.
        const inline = tokens[i + 1];
        if (inline !== undefined && inline.type === 'inline' && RAW_HTML.test(inline.content)) {
          refusals.push('raw HTML');
          emit(refusalBlock(doc, labelFor('dv.htmlRefused', {}), inline.content));
          i += 2;
          break;
        }
        open('p', null);
        break;
      }
      case 'paragraph_close':
        if (!token.hidden) stack.pop();
        break;
      case 'inline':
        inlineInto(stack[stack.length - 1], token.children ?? [], refusals, doc, labelFor);
        break;
      case 'bullet_list_open': open('ul', null); break;
      case 'ordered_list_open': open('ol', null); break;
      case 'list_item_open': open('li', null); break;
      case 'blockquote_open': open('blockquote', null); break;
      case 'table_open': open('table', null); break;
      case 'thead_open': open('thead', null); break;
      case 'tbody_open': open('tbody', null); break;
      case 'tr_open': open('tr', null); break;
      // Alignment is recognised by the tokeniser and NOT carried onto the
      // cell: `style-src 'self'` forbids the inline `text-align` it needs and
      // the design of record draws no alignment class. A table renders as a
      // table, start-aligned.
      case 'th_open': open('th', null); break;
      case 'td_open': open('td', null); break;
      case 'heading_close':
      case 'bullet_list_close':
      case 'ordered_list_close':
      case 'list_item_close':
      case 'blockquote_close':
      case 'table_close':
      case 'thead_close':
      case 'tbody_close':
      case 'tr_close':
      case 'th_close':
      case 'td_close':
        stack.pop();
        break;
      case 'hr':
        emit(make(doc, 'hr', null, null));
        break;
      case 'fence':
        emit(String(token.info ?? '').trim().split(/\s+/)[0] === 'mermaid'
          ? diagramNode(doc, token.content)
          : make(doc, 'pre', null, token.content));
        break;
      case 'code_block':
        emit(make(doc, 'pre', null, token.content));
        break;
      // `html: false` means neither of these can be produced. They are handled
      // anyway, as refusals, so that a later edit to the parser options cannot
      // turn raw markup into rendered markup by omission.
      case 'html_block':
        refusals.push('raw HTML');
        emit(refusalBlock(doc, labelFor('dv.htmlRefused', {}), token.content));
        break;
      default:
        // A block token nobody enumerated. Shown with its own source rather
        // than dropped, and its opener's children still land somewhere.
        if (token.nesting === 0 && (token.content ?? '') !== '') {
          emit(make(doc, 'pre', null, token.content));
        }
        break;
    }
  }
  return out;
}

/**
 * The labeller of last resort: the three refusal sentences as `en.js` declares
 * them, spelled once here so a caller with no string table — `node --test`
 * passing a two-method `doc` — draws exactly what shipped before the keys
 * existed, rather than a key name or a blank.
 */
const ENGLISH_REFUSAL = (key, subs = {}) => {
  if (key === 'dv.imgRefused') return `${subs.alt} (image refused)`;
  if (key === 'dv.linkRefused') return `${subs.label} (link refused)`;
  return 'raw HTML block refused';
};

/**
 * Markdown → `{ nodes, refusals }`. **No HTML string is produced anywhere in
 * this function.**
 *
 * `doc` is injected for the same reason `lib/i18n.js`'s `t()` takes one — it
 * is the only thing here that touches the document, so `node --test` can pass
 * a two-method stand-in and this logic is testable without a browser.
 *
 * `src` is coerced with `String()` rather than type-checked away: a body that
 * arrived as something other than a string is a fact about the endpoint, and
 * rendering its coercion puts that fact on the screen instead of blanking the
 * card.
 */
export function markdownNodes(src, doc, labelFor = ENGLISH_REFUSAL) {
  const refusals = [];
  const nodes = blockNodes(
    PARSER.parse(String(src).replaceAll('\r\n', '\n'), {}), refusals, doc, labelFor);
  return { nodes, refusals };
}

/**
 * Every ```` ```mermaid ```` fence in a document, in document order, as the
 * tokeniser sees it.
 *
 * `scripts/gen-diagrams.ts` and `test/ui/diagram-gate.test.ts` both ask THIS
 * function which diagrams a README contains, so the drawing that is generated
 * and the fence that is rendered are identified by one parser and one rule.
 * A second fence scanner in the generator is the exact defect this whole
 * change exists to retire.
 */
export function mermaidBlocks(src) {
  return PARSER.parse(String(src).replaceAll('\r\n', '\n'), {})
    .filter((t) => t.type === 'fence' && String(t.info ?? '').trim().split(/\s+/)[0] === 'mermaid')
    .map((t) => t.content);
}
