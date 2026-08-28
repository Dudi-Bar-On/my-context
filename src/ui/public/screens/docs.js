/**
 * `nav.read` — **Documentation**, `<section data-p="docs">` in the design of
 * record. A **Contents** card beside a card that renders one section, and the
 * markdown is turned into NODES — never into an HTML string.
 *
 * ── THE ONE THING THE DESIGN ASKS FOR THAT NOTHING SERVES ──────────────────
 *
 * `dv.sub` is a promise about a document: *"The repository's own README,
 * rendered here and addressed by heading ordinal."* The spec repeats it and
 * calls the mechanism the decision
 * (`docs/superpowers/specs/2026-08-16-web-ui-design.md` · `addressed by **heading ordinal** — so one integer gives both a deep link` · ~1327).
 *
 * **No endpoint serves the README.** The read server's whole route table is in
 * `registerReadRoutes`, and the only route that answers markdown at all is
 * `GET /api/help/:topic`, whose reachable set is four
 * (`src/ui/read-model.ts` · `export const UI_HELP_TOPICS: UiHelpTopic[] = ['categories', 'scope', 'capture', 'workflow'];` · ~1488).
 * `README.md` sits at the repository root, outside `src/ui/public/`, so the
 * static handler cannot reach it either — measured, not assumed: nothing under
 * `src/ui/` names it. This screen therefore renders a `mycontext help` topic,
 * and the divergence from `dv.sub` is this task's loudest report rather than a
 * fetch invented against a route that does not exist. It is not a new
 * discovery: plan 1 already recorded that this screen belongs to no plan
 * (`docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md` · `**Documentation and Tutorials belong to no plan and are not claimed here.**` · ~214),
 * which is why nothing was ever built to feed it.
 *
 * ── WHY §4, AND WHY THE CONTENTS CARD IS STILL THE MOCKUP'S OWN FIVE ───────
 *
 * The mockup's Contents card lists five sections by ordinal — 1, 2, 3, 4 and
 * 7 — under `dv.t1`…`dv.t4` and `dv.t7`, and every one of those five is a
 * declared key in both string tables. They are drawn here exactly where the
 * design of record draws them, unchanged, because a translated string that
 * exists for one list and is drawn nowhere is a key nobody can find again.
 *
 * Of those five, **exactly one names a topic this server can serve**: `dv.t4`
 * is *"Scope"*, and `scope` is one of the four in `UI_HELP_TOPICS`. So the
 * second card renders THAT one — `§4 — Scope` — and the two cards say the same
 * thing to a reader: the Contents lists five sections, and the section drawn
 * is the fourth. The mockup renders `§3` and its Contents is not interactive;
 * neither is this one, for the same reason — the design draws no control there
 * and `#/docs/4` is not a route this shell's `route()` can parse, so the "deep
 * link" half of `dv.sub` has nowhere to land. Reported, not invented.
 *
 * **The heading text comes from `tFlat('dv.t4')`, and that is the one place
 * this file reaches for the flat renderer.** `dv.rendered` is `§{ordinal} —
 * {heading}`, so `{heading}` is a SUBSTITUTION VALUE, and `t()` puts every
 * substitution into a `span.v` by setting `.textContent` on it — a text-only
 * sink by construction, which is exactly what `tFlat` is for. It is not being
 * used to fill an element; `t()` fills the element. The value has to be the
 * TRANSLATED heading rather than the served document's own `# Scope`, because
 * `dv.sub`'s other half is *"a language switch that lands on the same
 * section"* — the ordinal is what survives the switch, and the heading beside
 * it must follow the language or the claim is false on the Hebrew page. In
 * English the two agree exactly: the served document's first heading IS
 * `# Scope`.
 *
 * ── THE RENDERER, WHICH IS A SECURITY DECISION AS MUCH AS A RENDERING ONE ──
 *
 * `dv.mdnote` is the specification and it is drawn on the screen it describes:
 * *"Rendered by a hand-written subset renderer: no HTML string is ever
 * produced, so there is nothing to sanitise. Raw HTML, images and unknown URL
 * schemes are refused and shown as refusals, not silently dropped."*
 *
 * `markdownNodes` below is the mockup's own renderer, branch for branch
 * (`docs/design/web-ui-mockup.html` · `/* ── R1: a subset markdown renderer that never builds an HTML string ──────` · ~3196),
 * with two deliberate differences, both named here because neither is
 * decoration:
 *
 *   1. **Images are refused.** The mockup's own script does NOT refuse them:
 *      its inline pattern matches `[alt](url)` inside `![alt](url)` and leaves
 *      the `!` behind as text, so an image renders as a link with a stray
 *      exclamation mark. `dv.mdnote` — a string this screen draws — says
 *      images are refused. Where the mockup's SCRIPT and the mockup's own
 *      on-screen SENTENCE disagree, the sentence wins: a screen that claims a
 *      refusal it does not perform is worse than either behaviour. Flagged in
 *      this task's report.
 *   2. **`\r\n` is normalised to `\n` before the source is split into lines.**
 *      The repository pins `*.md text eol=lf` in `.gitattributes` and the topic
 *      files on disk carry zero `\r` (measured), so this changes nothing for
 *      what is served today — it is here for the corpus text this same
 *      renderer is now pointed at, on the platform this project is developed
 *      on.
 *
 * ── HOW WIDE THE SUBSET IS, AND WHY IT STOPS WHERE IT DOES ────────────────
 *
 * Widened 2026-08-28 under `DEC-markdown-is-served-from-a-manifest-rendered-by-
 * one-renderer`, whose rule for the width was *measure the corpus, do not guess
 * at it.* Three corpora were counted, because ONE renderer serves all three:
 * 644 item bodies under `.my_context/items`, the four `mycontext help` topics
 * this screen actually serves, and the 58 markdown documents under `reports/`
 * and `docs/` that the document route will serve next.
 *
 * **In, because the corpus uses it** (documents containing it, per corpus —
 * items / help / documents):
 *
 *   - **block quote** — 80 blocks / 12.5%, 25%, 39.7%. By VOLUME it is the
 *     headline: 2,885 quoted lines are 34.6% of every non-blank line in the
 *     item corpus, and 715 bare `>` lines inside them are precisely what put a
 *     `>` in the middle of the owner's sentence. Recursive, because 39 of those
 *     80 quotes hold a bullet list, 27 hold a heading and 10 hold an ordered
 *     list.
 *   - **ordered list** — 5.8%, 25%, 65.5%. **Nested lists** — 2.7%, 0%, 25.9%.
 *     **A list under a lead line** — 47 blocks, 0, 130 — a shape blank-line
 *     splitting cannot see at all.
 *   - **pipe table** — 0.5%, 75%, 56.9%. Rare in the items and unavoidable
 *     everywhere else: the `scope` topic on THIS screen has two.
 *   - **horizontal rule** — 0.3%, 0%, 89.7%. **`####`+ headings** — 0%, 0%,
 *     10.3%. **Indented code** — 2.5%, 0%, 6.9%, and it emits the `<pre>` the
 *     design already draws.
 *   - **`*emphasis*`** — 818 runs in the items, 74 in the help topics, 7,371 in
 *     the documents.
 *   - **setext headings** — **zero in all three**, both underline forms. Built
 *     only because the ruling names them in the floor, and said so here so the
 *     next reader does not mistake them for evidence of use.
 *
 * **Out, because the corpus does not use it, counted over all 706 documents:**
 * `_underscore emphasis_` 1 — and `_` is inside an identifier on nearly every
 * page, so a branch for it would corrupt real text to serve one run; task-list
 * checkboxes 2; reference links 4; footnotes 5; bare-URL autolinking 4;
 * strikethrough 1; hard line breaks 3; closed ATX (`## x ##`) 0; backslash
 * escapes — the matches are Windows paths, not escapes. Markdown **images** are
 * 0 in the items and 2 in the documents and stay REFUSED rather than rendered,
 * which is `dv.mdnote`'s own promise.
 *
 * **One shape is recognised and deliberately not honoured: table column
 * alignment.** `:--`/`--:` needs an inline `text-align` that `style-src 'self'`
 * forbids, and the design of record draws no alignment class. A table renders
 * as a table, start-aligned. Reported rather than silently dropped.
 *
 * **One inline cost, because it is a defect and not a limit.** "Code spans
 * win" is a TIE-BREAK, not a priority: a regex takes the leftmost match, so
 * `**`x`**` is a bold run whose payload keeps its backticks as literal text
 * and loses `.m` — and with `.m` goes the `unicode-bidi:isolate` that makes a
 * flag or a path read correctly inside RTL prose. The served `scope` topic
 * writes exactly that twice. Kept, because it is the mockup's own pattern and
 * changing the alternation would change what a code span protects; reported.
 *
 * **`.md` still styles an `h1` this renderer never emits, and `h4` now has a
 * rule.** The heading branch builds `h{min(level + 1, 4)}` — `#` becomes `h2`,
 * `##` becomes `h3`, `###` and everything deeper become `h4` — so
 * `.md h1,.md h2,.md h3` styles a tag that cannot appear. That half is left
 * alone (deleting a rule is a design change with no measurable gain); the half
 * that MATTERED is closed, because `h4` is what the served `scope` topic and
 * every document heading actually produce and nothing styled it. `.md h4` was
 * added to the mockup and to `styles.css` together, byte-identical, with
 * `test/ui/styles-parity.test.ts` extended to hold them so.
 *
 * **No `<bdi>`, and that is the R1 rule applied rather than skipped.** The
 * mockup's own comment on this CSS family says *"Corpus text sits in an inset
 * well with `<bdi>`; the product's own words are never inside one"*
 * (`docs/design/web-ui-mockup.html` · `rendered markdown. Corpus text sits in an inset well with <bdi>;` · ~648).
 * A `mycontext help` topic is the product's own words — it is the same prose
 * `mycontext help scope` prints on a terminal — so it is drawn bare, exactly
 * as `<div class="md" id="mdout">` is drawn bare in the design of record. The
 * well-and-`<bdi>` treatment belongs to the item detail pane, which has its
 * own key for saying so (`pane.well`), and to no part of this screen.
 *
 * **The refusal words are the renderer's own, and no key exists for them.**
 * `refusal`, `(link refused)` and the mockup's trailing `refused: …` summary
 * are hard-coded English (and hard-coded Hebrew) inside the mockup's script;
 * no `dv.*` key declares any of them, and declaring one would fail
 * `strings-parity` in the direction that names it. So the inline labels are
 * kept in the renderer's own words — the same treatment `errorNote` already
 * gives a server refusal
 * (`src/ui/public/screens/parts.js` · ``So nothing here is worded: the endpoint's own `error` text is shown as it`` · ~181)
 * — and the trailing summary line is NOT drawn: it is a second telling of
 * refusals already shown inline, and drawing it would put an untranslated
 * English sentence on the Hebrew page for no fact the reader does not have.
 * `markdownNodes` still RETURNS the list, so nothing is lost to a caller and
 * the test can assert on it. Reported as a missing key.
 */
import { el, errorNote, screenHead, spaced } from '/screens/parts.js';

/**
 * The mockup's Contents card, ordinal for ordinal and key for key. The
 * ordinals are literals rather than `index + 1` on purpose: the design of
 * record jumps from 4 to 7, which is the whole point of addressing a document
 * by heading ordinal instead of by list position.
 */
const CONTENTS = [
  { ordinal: 1, key: 'dv.t1' },
  { ordinal: 2, key: 'dv.t2' },
  { ordinal: 3, key: 'dv.t3' },
  { ordinal: 4, key: 'dv.t4' },
  { ordinal: 7, key: 'dv.t7' },
];

/**
 * The one Contents entry that names a reachable document. `ordinal` and `key`
 * are read out of `CONTENTS` rather than repeated, so the card's title can
 * never drift from the row it points at.
 */
const RENDERED = { topic: 'scope', entry: CONTENTS[3] };

/** The safe URL schemes, exactly the mockup's set: http(s), fragment, relative. */
const SAFE_HREF = /^(https?:|#|\.\/|\/)/;

/**
 * The five inline runs, in the mockup's own order with the image alternative
 * and single-asterisk emphasis added.
 *
 * **The order is a TIE-BREAK, not a priority, and saying so is the point.**
 * A regex takes the LEFTMOST match; the alternation only decides which branch
 * wins when two could start at the same index. So code first means a link or a
 * bold run written INSIDE backticks is not re-parsed — a backtick-wrapped
 * `**x**` is one `.m` run carrying its asterisks as text — and it does NOT
 * mean a code span inside a bold run survives:
 * `**`x`**` starts with `**`, so it is a `<b>` whose payload keeps its
 * backticks as text. Measured in `test/ui/docs-screen.test.ts`, both ways.
 *
 * The image alternative is what makes `![a](b)` a refusal rather than a link:
 * it starts one character earlier than the link alternative inside the same
 * text, so leftmost picks it. The mockup's own pattern has no such branch,
 * which is why its `!` is left behind as stray text — see this file's header.
 *
 * **`*emphasis*` is last, and its payload may not begin or end with a space.**
 * Order settles nothing between it and `**bold**`: a leftmost match at the
 * first `*` of `**x**` can only be the bold alternative, because the emphasis
 * one requires a non-asterisk immediately after its opener. The space rule is
 * what keeps a GLOB out — `src/* and lib/*` has a space after the first `*`, so
 * no run opens there, and `src/**` never closes. Measured across the three
 * corpora this renderer serves: 818 emphasis runs in the item corpus, 74 in
 * the four help topics, 7,371 in this repository's own documents, against zero
 * markdown images and one `_underscore_` run in all three combined.
 */
const INLINE = /(`[^`]+`)|(!\[[^\]]*\]\([^)]*\))|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*\s](?:[^*]*[^*\s])?\*)/g;

/**
 * The BLOCK openers, one constant each, because the scanner below tests a
 * single LINE against them in three different places — to open a block, to
 * stop a paragraph, and to stop a block quote's lazy continuation — and shared
 * constants are the only way those three can never disagree.
 */
const FENCE = /^\s*```/;
const ATX = /^#{1,6}\s/;
const QUOTE = /^\s*>/;
/** `---`, `***`, `___` alone on a line. Tested BEFORE `BULLET`, which `* * *` would match. */
const HRULE = /^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/;
/** A setext underline. `=` is level 1, `-` is level 2 — CommonMark's own split. */
const SETEXT = /^ {0,3}(={2,}|-{2,})\s*$/;
const BULLET = /^(\s*)[-*+][ \t]+/;
const ORDERED = /^(\s*)\d+[.)][ \t]+/;
const RAW_HTML = /^<[a-z!]/i;
const INDENTED = /^(    |\t)/;

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
 * is the difference between a refusal and a drop — `INV-nothing-is-dropped-silently`
 * is the invariant `dv.mdnote` is quoting.
 */
function refusalBlock(doc, label, source) {
  const wrap = doc.createElement('div');
  wrap.append(make(doc, 'span', 'refusal', label), make(doc, 'pre', null, source));
  return wrap;
}

/**
 * One line of markdown to nodes. `refusals` is an out-parameter, the mockup's
 * own arrangement: an inline refusal has to be both drawn where it happened
 * AND counted for the caller, and threading a second return value through the
 * block loop for it would say nothing extra.
 */
function inlineNodes(text, refusals, doc) {
  const out = [];
  let last = 0;
  INLINE.lastIndex = 0;
  for (let m = INLINE.exec(text); m !== null; m = INLINE.exec(text)) {
    if (m.index > last) out.push(doc.createTextNode(text.slice(last, m.index)));
    if (m[1] !== undefined) {
      // `.m` — monospace, `direction:ltr`, `unicode-bidi:isolate`. A path or a
      // flag inside RTL prose reads left-to-right or it reads wrong.
      out.push(make(doc, 'span', 'm', m[1].slice(1, -1)));
    } else if (m[2] !== undefined) {
      // An image. Refused per `dv.mdnote`, and the alt text is kept: it is the
      // only thing about the image the reader can be told without fetching it.
      const alt = m[2].slice(2, m[2].indexOf(']'));
      refusals.push('image');
      out.push(make(doc, 'span', 'refusal', `${alt} (image refused)`));
    } else if (m[3] !== undefined) {
      const cut = m[3].indexOf('](');
      const label = m[3].slice(1, cut);
      const href = m[3].slice(cut + 2, -1);
      if (SAFE_HREF.test(href)) {
        const anchor = make(doc, 'a', null, label);
        anchor.setAttribute('href', href);
        out.push(anchor);
      } else {
        // `javascript:`, `data:`, `mailto:` and everything else nobody
        // enumerated. The LABEL survives, so the reader knows a link was there
        // and what it claimed to be.
        refusals.push('url scheme');
        out.push(make(doc, 'span', 'refusal', `${label} (link refused)`));
      }
    } else if (m[4] !== undefined) {
      out.push(make(doc, 'b', null, m[4].slice(2, -2)));
    } else {
      out.push(make(doc, 'em', null, m[5].slice(1, -1)));
    }
    last = INLINE.lastIndex;
  }
  if (last < text.length) out.push(doc.createTextNode(text.slice(last)));
  return out;
}

/**
 * Does this line OPEN a block of its own? Used to stop a paragraph, to stop a
 * wrapped list item, and to stop a block quote's lazy continuation.
 *
 * `INDENTED` and `RAW_HTML` are deliberately absent, and both omissions are
 * CommonMark's own rules rather than shortcuts. Indented code cannot interrupt
 * a paragraph — the only reading that does not eat the second line of every
 * hanging-indent sentence in the corpus. Neither can a generic HTML tag, and
 * that one is measured: the `workflow` help topic wraps a sentence onto a line
 * beginning `<the answer>)`, which with `RAW_HTML` in this list was refused as
 * a raw HTML block, deleting half a paragraph the old block-splitting renderer
 * had shown correctly.
 */
function startsBlock(line) {
  return FENCE.test(line) || ATX.test(line) || QUOTE.test(line) || HRULE.test(line)
    || BULLET.test(line) || ORDERED.test(line);
}

/**
 * A GitHub pipe-table delimiter row — `|---|---|`, `|:--|--:|`, `---|---`.
 *
 * **Alignment is recognised and NOT carried onto the cells.** `style-src
 * 'self'` forbids the inline `text-align` a per-column alignment needs, and the
 * design of record draws no alignment class, so honouring it would be this file
 * inventing a shape the mockup does not have. A table still renders as a table,
 * start-aligned like every other in this product. Reported, not silently
 * dropped.
 */
function isTableDelimiter(line) {
  return line.includes('|') && line.includes('-') && /^[\s|:-]+$/.test(line);
}

/** `| a | b |` → `['a', 'b']`. The outer pipes are optional, as in GFM. */
function tableCells(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|')) row = row.slice(0, -1);
  return row.split('|').map((cell) => cell.trim());
}

/** The header row, its delimiter, and every `|`-bearing line after them. */
function tableNodes(lines, start, refusals, doc) {
  const table = doc.createElement('table');
  const head = doc.createElement('thead');
  const headRow = doc.createElement('tr');
  for (const cell of tableCells(lines[start])) {
    const th = doc.createElement('th');
    th.append(...inlineNodes(cell, refusals, doc));
    headRow.append(th);
  }
  head.append(headRow);
  const body = doc.createElement('tbody');
  let i = start + 2;
  for (; i < lines.length && lines[i].trim() !== '' && lines[i].includes('|'); i += 1) {
    const row = doc.createElement('tr');
    for (const cell of tableCells(lines[i])) {
      const td = doc.createElement('td');
      td.append(...inlineNodes(cell, refusals, doc));
      row.append(td);
    }
    body.append(row);
  }
  table.append(head, body);
  return [table, i];
}

/**
 * A list, and the index after it. `<ul>` or `<ol>` by the first marker; a
 * DEEPER marker opens a nested list on the item above it; a SHALLOWER one ends
 * this list and hands the line back to the caller.
 *
 * **A blank line ends the list**, rather than opening a loose one. That is what
 * the block-splitting renderer this replaces already did, it is what
 * `test/ui/docs-screen.test.ts` pins for `- a\n- b\n\n* c` — two lists, because
 * a changed marker after a blank line is how the corpus writes a second one —
 * and a loose list would need the `.md li p` rule the design of record does not
 * draw.
 */
function listNodes(lines, start, refusals, doc) {
  const opener = (line) => BULLET.exec(line) ?? ORDERED.exec(line);
  const indent = opener(lines[start])[1].length;
  const list = doc.createElement(ORDERED.test(lines[start]) ? 'ol' : 'ul');
  let item = null;
  let i = start;
  while (i < lines.length && lines[i].trim() !== '') {
    const marker = opener(lines[i]);
    if (marker === null || marker[1].length < indent) break;
    if (marker[1].length > indent) {
      // A nested list hangs off the item above it. With no item above it — a
      // block that opens already indented — the list itself is the only home,
      // which is the same reading `blocks()` gives an orphaned continuation.
      const [nested, next] = listNodes(lines, i, refusals, doc);
      (item ?? list).append(nested);
      i = next;
      continue;
    }
    item = doc.createElement('li');
    item.append(...inlineNodes(lines[i].slice(marker[0].length), refusals, doc));
    list.append(item);
    i += 1;
    // A wrapped item: a line that is neither blank, nor a marker, nor the start
    // of some other block. Joined with a space, because the newline it replaces
    // was never meant to be seen.
    while (i < lines.length && lines[i].trim() !== ''
      && opener(lines[i]) === null && !startsBlock(lines[i])) {
      item.append(doc.createTextNode(' '), ...inlineNodes(lines[i].trim(), refusals, doc));
      i += 1;
    }
  }
  return [list, i];
}

/**
 * **Lines → block nodes, and the whole of the renderer.** It recurses exactly
 * once per nesting level, through `<blockquote>` and through a nested list,
 * which is why a quote can hold a heading, a list or another quote without any
 * branch here knowing it is inside one.
 *
 * **It scans LINES rather than splitting on `/\n{2,}/`, and that change is the
 * defect more than any single branch is.** Blank-line splitting cannot see a
 * fenced block that contains a blank line — its closing fence lands in a
 * different block and both halves render as prose — and it cannot see a list
 * that follows a lead sentence with no blank line between them: 47 such blocks
 * in the item corpus, 130 in this repository's documents, every one of them
 * printing its own `-` markers inside a paragraph.
 */
function blocks(lines, refusals, doc) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i += 1; continue; }

    // A fence is TEXT, all of it, and it is scanned to its CLOSING fence rather
    // than to the next blank line: no inline pass runs inside, so a backtick or
    // a bracket in a transcript stays what it was written as.
    if (FENCE.test(line)) {
      const inner = [];
      i += 1;
      for (; i < lines.length && !FENCE.test(lines[i]); i += 1) inner.push(lines[i]);
      if (i < lines.length) i += 1;
      out.push(make(doc, 'pre', null, inner.length === 0 ? '' : `${inner.join('\n')}\n`));
      continue;
    }

    // An indented code block, and it is tested BEFORE raw HTML on purpose: the
    // one `<bash-input>` line in the item corpus sits inside a four-space
    // transcript, where it is a quoted terminal and not a document trying to
    // inject an element.
    if (INDENTED.test(line)) {
      const inner = [];
      while (i < lines.length && (INDENTED.test(lines[i]) || lines[i].trim() === '')) {
        if (lines[i].trim() === '') {
          let ahead = i;
          while (ahead < lines.length && lines[ahead].trim() === '') ahead += 1;
          if (ahead >= lines.length || !INDENTED.test(lines[ahead])) break;
          inner.push('');
          i = ahead;
          continue;
        }
        inner.push(lines[i].replace(INDENTED, ''));
        i += 1;
      }
      out.push(make(doc, 'pre', null, `${inner.join('\n')}\n`));
      continue;
    }

    // Raw HTML, unconditionally. `<!--` and `<script` are the same decision,
    // and both are shown rather than parsed.
    if (RAW_HTML.test(line)) {
      const inner = [];
      for (; i < lines.length && lines[i].trim() !== ''; i += 1) inner.push(lines[i]);
      refusals.push('raw HTML');
      out.push(refusalBlock(doc, 'raw HTML block refused', inner.join('\n')));
      continue;
    }

    // Before `BULLET`, which would otherwise open a list on `* * *`.
    if (HRULE.test(line)) {
      out.push(doc.createElement('hr'));
      i += 1;
      continue;
    }

    // `#` → h2 … `#####` → h4. The cap is the mockup's own `min(level + 1, 4)`;
    // what changed is the OPENER, from `#{1,3}` to `#{1,6}`, so that `####`
    // stops falling through to a paragraph printing its own hashes. Measured at
    // 24 blocks in 6 of this repository's documents, and zero in the items.
    if (ATX.test(line)) {
      const level = line.match(/^#+/)[0].length;
      const heading = doc.createElement(`h${Math.min(level + 1, 4)}`);
      heading.append(...inlineNodes(line.replace(/^#+\s*/, ''), refusals, doc));
      out.push(heading);
      i += 1;
      continue;
    }

    // A block quote, and the branch this task was filed for. The `>` and ONE
    // following space come off every line, and what is left goes back through
    // this same function — so the 39 quotes in the item corpus that hold a
    // bullet list, the 27 that hold a heading and the 10 that hold an ordered
    // list all render as what they are.
    //
    // The 715 bare `>` lines are what the owner was actually seeing: a blank
    // line INSIDE a quote, which blank-line splitting could not tell from the
    // end of one, so the marker landed mid-sentence as prose.
    if (QUOTE.test(line)) {
      const inner = [];
      while (i < lines.length && (QUOTE.test(lines[i])
        || (inner.length > 0 && lines[i].trim() !== '' && !startsBlock(lines[i])))) {
        inner.push(lines[i].replace(/^\s*>[ \t]?/, ''));
        i += 1;
      }
      const quote = doc.createElement('blockquote');
      quote.append(...blocks(inner, refusals, doc));
      out.push(quote);
      continue;
    }

    // A pipe table is recognised by its DELIMITER row, never by a `|` alone: a
    // sentence containing a pipe is prose, and the row under the header is the
    // only thing that says otherwise.
    if (line.includes('|') && i + 1 < lines.length && isTableDelimiter(lines[i + 1])) {
      const [table, next] = tableNodes(lines, i, refusals, doc);
      out.push(table);
      i = next;
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const [list, next] = listNodes(lines, i, refusals, doc);
      out.push(list);
      i = next;
      continue;
    }

    // A setext heading. Measured at ZERO across all three corpora — 641 item
    // bodies, 4 help topics, 58 documents, both underline forms — and built
    // anyway because the ruling names it in the floor. It is safe to build at
    // zero for the same reason it is worth little: a `-` underline directly
    // under prose never occurs, so the 624 standalone `---` rules, which all
    // sit after a blank line, cannot be taken for one.
    if (i + 1 < lines.length && SETEXT.test(lines[i + 1])) {
      const heading = doc.createElement(lines[i + 1].trim().startsWith('=') ? 'h2' : 'h3');
      heading.append(...inlineNodes(line.trim(), refusals, doc));
      out.push(heading);
      i += 2;
      continue;
    }

    const para = [];
    for (; i < lines.length && lines[i].trim() !== '' && !startsBlock(lines[i]); i += 1) {
      para.push(lines[i]);
    }
    const paragraph = doc.createElement('p');
    paragraph.append(...inlineNodes(para.join('\n'), refusals, doc));
    out.push(paragraph);
  }
  return out;
}

/**
 * Markdown → `{ nodes, refusals }`. **No HTML string is produced anywhere in
 * this function**, which is the whole of `dv.mdnote`'s security argument: a
 * renderer with no string stage has no sanitiser to get wrong.
 *
 * `doc` is injected for the same reason `lib/i18n.js`'s `t()` takes one — it
 * is the only thing here that touches the document, so `node --test` can pass
 * a two-method stand-in and this logic is testable without a browser
 * (`test/ui/docs-screen.test.ts`).
 *
 * `src` is coerced with `String()` rather than type-checked away: a body that
 * arrived as something other than a string is a fact about the endpoint, and
 * rendering its coercion puts that fact on the screen instead of blanking the
 * card.
 */
export function markdownNodes(src, doc) {
  const refusals = [];
  const nodes = blocks(String(src).replaceAll('\r\n', '\n').split('\n'), refusals, doc);
  return { nodes, refusals };
}

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'dv.h', 'dv.v', 'dv.sub');

  const two = el('div', 'two');
  root.append(two);

  // ── Contents ────────────────────────────────────────────────────────────
  const toc = el('div', 'card pane');
  const tocHead = el('h3');
  tocHead.append(...ctx.t('dv.toc'));
  // The mockup's `style="line-height:2"`, through CSSOM. The server sends
  // `style-src 'self'` with no `'unsafe-inline'`, so a `style` attribute is
  // forbidden here and is not in the mockup — the same trade `spaced()` makes.
  const list = el('div', 'small');
  list.style.setProperty('line-height', '2');
  for (const entry of CONTENTS) {
    const row = el('div');
    const label = el('span');
    label.append(...ctx.t(entry.key));
    // `<div>1 · <span …>` — the ordinal, U+00B7 between two spaces, then the
    // label. The mockup's own row, and the separator is a text node beside the
    // span rather than inside it: a translated element's children are replaced
    // wholesale from the string table, which knows nothing of a glyph someone
    // nested in one. Same arrangement, same reason, as `screenHead`'s ✅.
    row.append(`${entry.ordinal} · `, label);
    list.append(row);
  }
  const parity = el('p', 'small');
  parity.append(...ctx.t('dv.parity'));
  toc.append(tocHead, list, spaced(parity));

  // ── The rendered section ────────────────────────────────────────────────
  const card = el('div', 'card pane');
  const head = el('h3');
  head.append(...ctx.t('dv.rendered', {
    ordinal: RENDERED.entry.ordinal,
    heading: ctx.tFlat(RENDERED.entry.key),
  }));
  const md = el('div', 'md');
  md.id = 'mdout';
  const mdnote = el('p', 'small');
  mdnote.append(...ctx.t('dv.mdnote'));
  card.append(head, md, spaced(mdnote));

  // Both cards are in the DOM before the fetch, so the screen's composition is
  // the same shape whether the read answers, refuses or is still in flight —
  // and a refusal lands inside the card that would have held the prose,
  // instead of replacing the screen.
  two.append(toc, card);

  let body;
  try {
    body = await ctx.api(`/api/help/${encodeURIComponent(RENDERED.topic)}`);
  } catch (error) {
    // The endpoint's own words. `/api/help/:topic`'s 404 distinguishes "not a
    // topic at all" from "a `mycontext help` topic this screen does not join",
    // and that sentence is worth more than an empty `.md`.
    md.append(errorNote(error.message));
    return;
  }

  // `corpus` is fetched and NOT drawn, exactly as `learn.js` reports of
  // `markdown` on the other side of the same endpoint
  // (`src/ui/public/screens/learn.js` · ``**`markdown` is fetched and not drawn.**`` · ~70).
  // `<section data-p="docs">` has one card for prose and nowhere to put a
  // scoped/unscoped split; the join is the Learn screen's whole subject and
  // duplicating it here would put the same fact on two screens with nothing
  // holding them equal.
  md.append(...markdownNodes(body.markdown, document).nodes);
}
