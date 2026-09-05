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
import {
  ALLOWED_TAGS, buildElement, htmlTokens, VOID_TAGS,
} from './sanitize.js';

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

/* ══════════════════════════════════════════════════════════════════════════
   THE GITHUB VIEW — a second POLICY over the same tokeniser, not a second
   renderer.

   ── WHY THERE ARE TWO POLICIES AND ONLY ONE MODULE ────────────────────────

   `markdownNodes` above renders CORPUS ITEM TEXT: bodies written by agents and
   by ingest, drawn inside the console, on a server that sends no
   Content-Security-Policy. It refuses raw HTML outright, and that refusal is
   the only thing standing between an agent-authored body and the page.
   `githubNodes` below renders REPOSITORY DOCUMENTS on their own page, and its
   policy is GitHub's, because the owner ruled on 2026-09-05 that it must be:
   "use exactly the same renderer and viewing as it is implemented in github,
   do not decide other way, if required ask me."

   Two policies, one file, one tokeniser table, one set of node helpers — the
   shape `DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer` asks
   for when it says "two call sites are fine; two implementations are the
   defect". The raw-HTML allow-list itself is `lib/sanitize.js`, split out
   because it is security-critical, holds no markdown, and deserves to be read
   and tested on its own.

   ── WHAT "LIKE GITHUB" IS AND IS NOT ──────────────────────────────────────

   BYTE-IDENTICAL PARITY IS IMPOSSIBLE AND IS NOT CLAIMED. GitHub renders with
   cmark-gfm, a C implementation; this renders with the vendored markdown-it.
   The ruling says so itself. What is matched is BEHAVIOUR:

     - GFM: tables (with GitHub's own `align` attribute rather than
       markdown-it's `style="text-align:…"`, which the allow-list strips
       anyway), task lists, strikethrough, autolinks, linkified bare URLs.
     - GitHub's sanitized HTML allow-list — `lib/sanitize.js`.
     - HTML comments render as nothing at all, which the ruling names.
     - Heading anchors by `headingSlug` below, the rule `test/helpers/
       markdown.ts` calibrated against GitHub's own rendering of both READMEs.
       One rule with two homes, held equal by `test/ui/github-render.test.ts`;
       `slugAnchor` in `read-model.ts` is a THIRD spelling and differs, which
       is already recorded as a defect rather than fixed here.
     - Headings are `h1`…`h6`, not the `min(level+1, 4)` the console card uses:
       this is a whole page, with no card heading above it to nest under.
     - Mermaid fences are DRAWN from the committed SVGs `scripts/gen-diagrams
       .ts` produces — the ruling's own instruction, through the same
       `diagramNode` the console renderer uses.

   ── WHAT STILL REFUSES, AND WHY THAT IS NOT A DEPARTURE ───────────────────

   GitHub's sanitiser UNWRAPS an element outside its allow-list: the tag goes,
   the text stays, and nothing tells the reader. This renderer REFUSES it by
   name instead. That is the ruling's own instruction — "The refusal MECHANISM
   stays for everything outside the allow-list - INV-nothing-is-dropped-
   silently is why it exists" — and it is the one place where this project's
   invariant is deliberately louder than GitHub.

   An ATTRIBUTE outside the allow-list is COUNTED, not boxed. `docs/README.he
   .md` carries 1,665 `dir` attributes that are all admitted; a page drawing a
   warning per attribute would be the noise this change exists to remove. The
   count comes back so the page can disclose it in one sentence.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The tokeniser for the GitHub view. `html: true` is the whole difference from
 * `PARSER` above, and it is safe here for exactly one reason: every
 * `html_block` and `html_inline` token it produces goes through
 * `lib/sanitize.js`'s allow-list before a node exists. `linkify` is ON because
 * GitHub linkifies a bare URL and this is a GitHub view; `typographer` stays
 * off, because GitHub does not smarten quotes either.
 */
const GITHUB_PARSER = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
  breaks: false,
});
GITHUB_PARSER.validateLink = () => true;

/**
 * **The anchor GitHub gives a heading — the rule, not a second rule.**
 *
 * Copied from `test/helpers/markdown.ts`'s `headingSlug`, whose own header
 * records that it was calibrated against GitHub's markdown API over both
 * READMEs: with it, all 119 in-document anchors of `README.md` and all 118 of
 * `docs/README.he.md` resolve. It is COPIED rather than imported because that
 * helper is TypeScript under `test/` and this file is loaded by a browser with
 * no build step (`CONST-node-24-no-build-step`) — the same bind `read-model.ts`
 * records for its own fence rule. What keeps a copy from going quietly wrong
 * is a gate, not a comment: `test/ui/github-render.test.ts` imports BOTH and
 * asserts they agree on every heading of every document the manifest serves.
 *
 * Tag-stripping happens outside code spans only, which is the subtle half:
 * both READMEs carry `categories.<name>.enabled` as a heading, `<name>` is
 * literal text inside a code span, and its anchor is `categoriesnameenabled`.
 */
export function headingSlug(text) {
  const flattened = String(text)
    .split(/(`[^`]*`)/)
    .map((part) => (
      part.length > 1 && part.startsWith('`') && part.endsWith('`')
        ? part.slice(1, -1)
        : part.replace(/<[^>]*>/g, '')
    ))
    .join('');
  return flattened
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_ -]/gu, '')
    .trim()
    .replace(/ /g, '-');
}

/* ── NEVER A DEAD LINK ─────────────────────────────────────────────────────

   `DEC-the-document-page-wears-github-styling-lists-the-readmes-and`, owner
   ruling of 2026-09-05, in his own words: *"if the documents are refering
   other documents get them too or do not support the link"*.

   So a link inside a rendered document either OPENS what it names, or it is
   NOT DRAWN AS A LINK — the label stays as plain text. There is no third
   option where an anchor is drawn and clicking it does nothing, and until this
   change that third option was the common case: `README.md`'s twelve
   references to sibling files were emitted as `<a href="CHANGELOG.md">`, which
   the browser resolved against `/doc.html` and the static server answered 404
   for. A drawn link that 404s is the exact thing the ruling forbids.

   FOUR OUTCOMES, and every href lands in exactly one:

     1. **A document this server can open** → `/doc.html?doc=<id>`, carrying
        the original fragment. Relative paths resolve against the CONTAINING
        document's directory, the way GitHub resolves them, so `TUTORIAL.md`
        inside `docs/README.he.md` means `docs/TUTORIAL.md` and `../README.md`
        means `README.md`.
     2. **An in-document fragment that names a heading this document actually
        minted** → kept as written.
     3. **An absolute URL** (`https:`, `mailto:`, and the rest of
        `SAFE_SCHEMES`) → kept as written. It leaves this server, which is
        what the author asked for; whether the far end answers is not
        something this renderer can know or should pretend to.
     4. **Everything else** — `LICENSE` (no extension, so not a document),
        `CHANGELOG.md` (a repository file the manifest does not carry), a
        `../..` that climbs out of the repository, a fragment naming no
        heading, an empty href → NOT A LINK. The label is drawn as plain text
        and the count is disclosed in the page's footer, so nothing is dropped
        silently (`INV-nothing-is-dropped-silently`) and nothing is promised
        that cannot be delivered.

   THE OPENABLE SET IS SUPPLIED, NEVER GUESSED. `githubNodes` is handed the
   manifest `GET /api/doc` serves — the same 190 ids that endpoint will accept
   — so "can this open" is answered by the server's own roster and not by a
   pattern that looks like a path. With no roster supplied (the default, and
   what `node --test` gets) NO relative link resolves, which is the safe
   direction: a renderer that cannot check cannot promise. */

/**
 * A repo-relative path, resolved the way GitHub resolves a link inside a file.
 *
 * `base` is the containing document's DIRECTORY (`''` for the repository
 * root). A leading `/` is repository-root-relative — that is GitHub's reading
 * of it inside a rendered README, not the web server's. `..` above the root
 * returns `null`, because a path outside the repository is not a document.
 *
 * Exported and pure so the resolution is measurable without a browser and
 * without a document.
 */
export function resolveDocPath(base, target) {
  const rooted = String(target).startsWith('/');
  const joined = rooted
    ? String(target).slice(1)
    : `${String(base) === '' ? '' : `${String(base)}/`}${String(target)}`;
  const out = [];
  for (const part of joined.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.length === 0 ? null : out.join('/');
}

/**
 * Every ASCII control character and the space, as `lib/sanitize.js`'s `safeUrl`
 * strips them — `java\tscript:` and ` https:` must read as the schemes they
 * are. Built with `new RegExp` from an escaped source string rather than
 * written as a literal, so no control byte is ever committed INTO this file:
 * a source line carrying a raw NUL is unreadable in a diff and unsearchable by
 * grep, which is how a character class stops meaning what its author thought.
 */
const CONTROL_OR_SPACE = new RegExp('[\\u0000-\\u0020\\u007f]', 'g');

/** Whether a URL names a scheme. The same reading `safeUrl` uses: a colon
 *  after the first `/` or `?` is part of a path, not a scheme. */
function hasScheme(value) {
  const probe = String(value).replace(CONTROL_OR_SPACE, '').toLowerCase();
  const colon = probe.indexOf(':');
  if (colon === -1) return false;
  const separator = probe.search(/[/?]/);
  return separator === -1 || separator > colon;
}

/** A percent-encoded path, decoded — and left exactly as written when it is
 *  not valid encoding, because a `%` a document meant literally is text. */
function decodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * One href → how it is drawn, or `null` for "not a link".
 *
 * `where` carries the three things the decision needs and cannot infer:
 * `base` (the containing document's directory), `openable` (a `Set` of the
 * document ids this server will serve, or `null` for "none can be checked")
 * and `slugs` (the heading anchors THIS document minted).
 *
 * Returns `{ kind, href }` — `kind` is `'document'`, `'fragment'` or
 * `'external'` and exists so a caller can tell an internal hop from a
 * departure without re-parsing the URL.
 */
export function decideLink(href, where = {}) {
  const { base = '', openable = null, slugs = null } = where;
  const raw = String(href ?? '').trim();
  if (raw === '') return null;
  const hash = raw.indexOf('#');
  const target = hash === -1 ? raw : raw.slice(0, hash);
  const fragment = hash === -1 ? '' : raw.slice(hash);
  if (target === '') {
    // An in-document jump. It is a link only if the heading it names exists —
    // an anchor that scrolls nowhere is the dead link this ruling is about,
    // and the slugs are known because this renderer minted them.
    const slug = decodePath(fragment.slice(1));
    if (slug === '' || slugs === null || !slugs.has(slug)) return null;
    return { kind: 'fragment', href: fragment };
  }
  if (hasScheme(target)) return { kind: 'external', href: raw };
  if (openable === null) return null;
  const id = resolveDocPath(base, decodePath(target));
  if (id === null || !openable.has(id)) return null;
  return { kind: 'document', href: `/doc.html?doc=${encodeURIComponent(id)}${fragment}` };
}

/**
 * Every heading anchor a document mints, in document order.
 *
 * A PREPASS, for the reason `taskItems` is one: the walk needs the WHOLE set
 * before it draws the first link — a `#later-heading` reference near the top
 * of a README points at a heading a thousand lines further down — and running
 * the disambiguation counter twice would be two implementations of one rule.
 * The walk consumes this list in order, so the id a heading receives and the
 * id a link is checked against are the same string by construction.
 */
function headingSlugs(tokens) {
  const seen = new Map();
  const out = [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i].type !== 'heading_open') continue;
    const source = tokens[i + 1] !== undefined && tokens[i + 1].type === 'inline'
      ? tokens[i + 1].content : '';
    const base = headingSlug(source);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    out.push(count === 0 ? base : `${base}-${count}`);
  }
  return out;
}

/** The English wording for the two refusal labels this view adds, so a caller
 *  with no string table — `node --test` — draws a sentence and not a key. */
const ENGLISH_GITHUB_REFUSAL = (key, subs = {}) => {
  if (key === 'gh.tagRefused') return `<${String(subs.tag)}> (tag refused)`;
  if (key === 'gh.urlRefused') return `${String(subs.label)} (link refused)`;
  return ENGLISH_REFUSAL(key, subs);
};

/** `[ ]` / `[x]` at the head of a list item — GFM's task-list marker. */
const TASK_MARKER = /^\[([ xX])\][ \t]+/;

/**
 * The inline tokens that open a task-list item, mapped to whether the box is
 * ticked. A PREPASS rather than a look-behind during the walk: the marker is a
 * property of the item's FIRST inline run, and deciding it once up front keeps
 * the walk itself free of list bookkeeping.
 */
function taskItems(tokens) {
  const marked = new Map();
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i].type !== 'list_item_open') continue;
    // The first inline run of the item, before any nested block opens one of
    // its own. `paragraph_open` may be hidden (a tight list) or not.
    for (let j = i + 1; j < tokens.length; j += 1) {
      const t = tokens[j];
      if (t.type === 'inline') {
        const m = TASK_MARKER.exec(t.content);
        if (m !== null) marked.set(t, m[1] !== ' ');
        break;
      }
      if (t.type !== 'paragraph_open') break;
    }
  }
  return marked;
}

/**
 * markdown-it puts table alignment in a `style` attribute; GitHub puts it in
 * `align`, which is in the allow-list and which browsers honour natively.
 * Translating here is what makes a right-aligned column right-aligned on a
 * page whose sanitiser — correctly — admits no `style` at all.
 */
function alignOf(token) {
  for (const pair of token.attrs ?? []) {
    if (pair[0] !== 'style') continue;
    const m = /text-align:\s*(left|center|right)/.exec(pair[1]);
    if (m !== null) return m[1];
  }
  return null;
}

/**
 * Markdown → `{ nodes, refusals, dropped, headings }`, GitHub's way.
 *
 * **No HTML string is produced anywhere in this function or anything it
 * calls.** Every node is `createElement` / `createTextNode` / `setAttribute`,
 * and every raw tag and attribute passed `lib/sanitize.js`'s allow-list first.
 *
 * `refusals` is what was refused AND drawn as such; `dropped` is the attribute
 * names silently outside the allow-list, counted for disclosure; `headings` is
 * `{ level, text, slug }` in document order, which is what a table of contents
 * is built from without parsing the document twice.
 *
 * `doc` is injected for the reason `markdownNodes` injects it: it is the only
 * thing here that touches a document, so the whole policy is measurable under
 * `node --test` with a two-method stand-in and no browser.
 *
 * `where` is the link context — `{ base, openable }`, the containing
 * document's directory and the `Set` of ids this server will serve. It is the
 * ONE input that cannot be derived from the markdown, and omitting it is not a
 * silent downgrade: with no roster, no relative link resolves and every one of
 * them is drawn as plain text and counted. See "NEVER A DEAD LINK" above.
 */
export function githubNodes(src, doc, labelFor = ENGLISH_GITHUB_REFUSAL, where = {}) {
  const tokens = GITHUB_PARSER.parse(String(src).replaceAll('\r\n', '\n'), {});
  const tasks = taskItems(tokens);
  const refusals = [];
  const dropped = [];
  const headings = [];
  // The anchors this document mints, known BEFORE the first link is drawn so a
  // reference to a heading further down can be checked against it.
  const minted = headingSlugs(tokens);
  let mintedAt = 0;
  const links = {
    base: where.base ?? '',
    openable: where.openable ?? null,
    slugs: new Set(minted.filter((slug) => slug !== '')),
  };
  const out = [];
  // Every frame records WHO opened it. A markdown close pops down to the
  // nearest markdown frame, discarding any raw tag left open inside it — which
  // is what a browser does with `<p>a <b>b</p>` — and a raw close tag pops down
  // to its own matching frame and never past a markdown one.
  const stack = [];
  const top = () => (stack.length === 0 ? null : stack[stack.length - 1]);
  const emit = (node) => {
    const frame = top();
    if (frame === null) out.push(node); else frame.node.append(node);
  };
  const text = (value) => { if (value !== '') emit(doc.createTextNode(value)); };
  const openMd = (tag) => {
    const node = make(doc, tag, null, null);
    emit(node);
    stack.push({ node, name: tag, kind: 'md' });
    return node;
  };
  const closeMd = () => {
    while (stack.length > 0 && stack[stack.length - 1].kind !== 'md') stack.pop();
    stack.pop();
  };

  /**
   * One raw-HTML fragment, block or inline, against the SHARED stack.
   *
   * Shared on purpose: `<span dir="ltr">` and its `</span>` arrive as two
   * separate `html_inline` tokens with the run between them, and a
   * fragment-local stack could never join them. The Hebrew README is built out
   * of 1,665 of exactly that pair.
   */
  const rawInto = (source) => {
    for (const tok of htmlTokens(source)) {
      if (tok.kind === 'text') { text(tok.text); continue; }
      // A comment renders as nothing at all, and a doctype the same. The ruling
      // names the first explicitly; 131 of `README.md`'s 141 refusal boxes were
      // comments.
      if (tok.kind === 'comment' || tok.kind === 'other') continue;
      if (tok.kind === 'endtag') {
        if (VOID_TAGS.has(tok.name)) continue;
        for (let at = stack.length - 1; at >= 0; at -= 1) {
          if (stack[at].kind === 'html' && stack[at].name === tok.name) {
            stack.length = at;
            break;
          }
        }
        continue;
      }
      if (!ALLOWED_TAGS.has(tok.name)) {
        refusals.push(`tag:${tok.name}`);
        emit(make(doc, 'span', 'refusal', labelFor('gh.tagRefused', { tag: tok.name })));
        continue;
      }
      // A raw `<a href="…">` is held to the SAME link policy as a markdown
      // one. Without this the rule would have a hole exactly the width of the
      // Hebrew mirror's raw-HTML style: `[x](y)` checked, `<a href="y">x</a>`
      // not, and a dead link is dead whichever grammar wrote it. The attribute
      // is rewritten to what the policy decided, or removed — an `<a>` with no
      // `href` is not a link to a browser, so the label survives as text and
      // nothing is drawn that cannot be followed.
      const attrs = tok.name !== 'a' ? tok.attrs : tok.attrs.map((pair) => {
        if (pair[0] !== 'href') return pair;
        const decided = decideLink(pair[1], links);
        return decided === null ? null : ['href', decided.href];
      }).filter((pair) => pair !== null);
      if (tok.name === 'a' && attrs.length < tok.attrs.length) refusals.push('link target');
      const built = buildElement(doc, tok.name, attrs);
      for (const name of built.dropped) dropped.push(`${tok.name}@${name}`);
      emit(built.node);
      if (!VOID_TAGS.has(tok.name) && !tok.selfClosing) {
        stack.push({ node: built.node, name: tok.name, kind: 'html' });
      }
    }
  };

  /**
   * Whether each open markdown link actually put a frame on the stack.
   *
   * A link whose target cannot be opened draws NO anchor — but its label still
   * has to render, and its `link_close` still arrives. So the opener pushes
   * `false` here instead of a frame, and the closer pops one element of the
   * corresponding kind. Skipping the whole run instead would delete the label,
   * which is the other half of what the ruling forbids.
   */
  const linkFrames = [];

  /** One `inline` token's children, against the same shared stack. */
  const inlineRun = (token) => {
    const children = token.children ?? [];
    const ticked = tasks.get(token);
    let skipMarker = ticked !== undefined;
    if (skipMarker) {
      // GFM's own markup for a task item, and disabled: a box a reader could
      // tick would claim a state change this page cannot make, and GitHub
      // disables them outside its own editor too.
      const box = make(doc, 'input', null, null);
      box.setAttribute('type', 'checkbox');
      box.setAttribute('disabled', '');
      if (ticked) box.setAttribute('checked', '');
      emit(box);
      text(' ');
    }
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      switch (child.type) {
        case 'text': {
          let value = child.content;
          if (skipMarker) { value = value.replace(TASK_MARKER, ''); skipMarker = false; }
          text(value);
          break;
        }
        // GitHub does not turn a single newline into a `<br>` either; it emits
        // the newline and the browser collapses it.
        case 'softbreak':
          text('\n');
          break;
        case 'hardbreak':
          emit(make(doc, 'br', null, null));
          break;
        case 'code_inline':
          emit(make(doc, 'code', null, child.content));
          break;
        // Underscore emphasis and strikethrough RENDER here, where
        // `markdownNodes` above hands them back as text. That is not a change
        // of mind about the corpus: CommonMark's intraword rule means
        // `source_file` and `valid_from` are never emphasis to this tokeniser,
        // and GitHub renders both constructs.
        case 'em_open': openMd('em'); break;
        case 'strong_open': openMd('strong'); break;
        case 's_open': openMd('del'); break;
        case 'em_close':
        case 'strong_close':
        case 's_close':
          closeMd();
          break;
        case 'link_open': {
          const decided = decideLink(attr(child, 'href'), links);
          if (decided === null) {
            // Nothing this page can open: not a document in the manifest, not
            // a heading this document minted, not an absolute address. So NO
            // anchor is drawn — the label renders as ordinary text and the
            // count is disclosed. `INV-nothing-is-dropped-silently` is served
            // by the count; the ruling is served by the absent anchor.
            refusals.push('link target');
            linkFrames.push(false);
            break;
          }
          const built = buildElement(doc, 'a', [['href', decided.href]]);
          if (built.dropped.length > 0) {
            // The scheme is outside the allow-list. The LABEL survives, so the
            // reader is told a link was there and what it claimed to be —
            // `INV-nothing-is-dropped-silently`, and the same shape the console
            // renderer has always used. This is a SECURITY refusal and keeps
            // its box: `javascript:` in a document is worth naming, where an
            // ordinary unopenable path is not.
            let depth = 1;
            let end = i + 1;
            for (; end < children.length && depth > 0; end += 1) {
              if (children[end].type === 'link_open') depth += 1;
              if (children[end].type === 'link_close') depth -= 1;
            }
            refusals.push('url scheme');
            emit(make(doc, 'span', 'refusal',
              labelFor('gh.urlRefused', { label: plainText(children.slice(i + 1, end - 1)) })));
            i = end - 1;
            break;
          }
          const title = attr(child, 'title');
          if (title !== '') built.node.setAttribute('title', title);
          emit(built.node);
          stack.push({ node: built.node, name: 'a', kind: 'md' });
          linkFrames.push(true);
          break;
        }
        case 'link_close':
          if (linkFrames.pop() === true) closeMd();
          break;
        case 'image': {
          // GitHub RENDERS images; it serves them through its own camo proxy,
          // which this server has no equivalent of. The residual difference is
          // named in this change's report rather than papered over here.
          const built = buildElement(doc, 'img', [
            ['src', attr(child, 'src')],
            ['alt', child.content],
            ['title', attr(child, 'title')],
          ]);
          if (built.dropped.includes('src')) {
            refusals.push('image src scheme');
            emit(make(doc, 'span', 'refusal', labelFor('dv.imgRefused', { alt: child.content })));
            break;
          }
          emit(built.node);
          break;
        }
        case 'html_inline':
          rawInto(child.content);
          break;
        default:
          text(child.content ?? '');
          break;
      }
    }
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    switch (token.type) {
      case 'heading_open': {
        const level = Number(token.tag.slice(1));
        const node = openMd(`h${level}`);
        const source = tokens[i + 1] !== undefined && tokens[i + 1].type === 'inline'
          ? tokens[i + 1].content : '';
        // The prepass minted this, in this order — so the id a heading gets and
        // the id a `#…` link was checked against are the same string by
        // construction rather than by two copies of the counter agreeing.
        const slug = minted[mintedAt] ?? '';
        mintedAt += 1;
        if (slug !== '') node.id = slug;
        headings.push({ level, text: source, slug });
        break;
      }
      case 'paragraph_open':
        if (!token.hidden) openMd('p');
        break;
      case 'paragraph_close':
        if (!token.hidden) closeMd();
        break;
      case 'inline':
        inlineRun(token);
        break;
      case 'bullet_list_open': openMd('ul'); break;
      case 'ordered_list_open': {
        const list = openMd('ol');
        const start = attr(token, 'start');
        if (start !== '') list.setAttribute('start', start);
        break;
      }
      case 'list_item_open': {
        const item = openMd('li');
        // The item is a task item when its first inline run carries the marker;
        // `taskItems` decided that before the walk began.
        for (let j = i + 1; j < tokens.length; j += 1) {
          if (tokens[j].type === 'inline') {
            if (tasks.has(tokens[j])) item.className = 'task-list-item';
            break;
          }
          if (tokens[j].type !== 'paragraph_open') break;
        }
        break;
      }
      case 'blockquote_open': openMd('blockquote'); break;
      case 'table_open': openMd('table'); break;
      case 'thead_open': openMd('thead'); break;
      case 'tbody_open': openMd('tbody'); break;
      case 'tr_open': openMd('tr'); break;
      case 'th_open':
      case 'td_open': {
        const cell = openMd(token.type === 'th_open' ? 'th' : 'td');
        const align = alignOf(token);
        if (align !== null) cell.setAttribute('align', align);
        break;
      }
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
        closeMd();
        break;
      case 'hr':
        emit(make(doc, 'hr', null, null));
        break;
      case 'fence': {
        const info = String(token.info ?? '').trim().split(/\s+/)[0];
        if (info === 'mermaid') { emit(diagramNode(doc, token.content)); break; }
        const pre = make(doc, 'pre', null, null);
        const code = make(doc, 'code', null, token.content);
        // The fence's own info string, as DATA rather than as a class: this
        // page highlights nothing, and a `language-x` class would promise it
        // did.
        if (info !== '') code.setAttribute('data-lang', info);
        pre.append(code);
        emit(pre);
        break;
      }
      case 'code_block': {
        const pre = make(doc, 'pre', null, null);
        pre.append(make(doc, 'code', null, token.content));
        emit(pre);
        break;
      }
      case 'html_block':
        rawInto(token.content);
        break;
      default:
        // A block token nobody enumerated. Shown with its own source rather
        // than dropped.
        if (token.nesting === 0 && (token.content ?? '') !== '') {
          const pre = make(doc, 'pre', null, null);
          pre.append(make(doc, 'code', null, token.content));
          emit(pre);
        }
        break;
    }
  }

  return { nodes: out, refusals, dropped, headings };
}
