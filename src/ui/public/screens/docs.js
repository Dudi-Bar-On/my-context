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
 *   2. **`\r\n` is normalised to `\n` before blocks are split.** The block
 *      splitter is `/\n{2,}/`, and a CRLF document has a `\r` between the two
 *      newlines, so every paragraph in it would collapse into one. The
 *      repository pins `*.md text eol=lf` in `.gitattributes` and the topic
 *      files on disk carry zero `\r` (measured), so this changes nothing for
 *      what is served today — it is here for the corpus text this same
 *      renderer will be pointed at, on the platform this project is developed
 *      on.
 *
 * **What falls through, because the subset does not know it:** pipe tables,
 * block quotes, ordered lists, horizontal rules, setext headings and `####`+
 * headings all become paragraphs carrying their own source; single-asterisk
 * emphasis (`*everywhere*`) reaches the screen as literal asterisks. The
 * served `scope` document has TWO pipe tables and three such emphasis runs —
 * counted, not estimated (`test/ui/docs-screen.test.ts`) — and they render
 * as paragraphs full of pipes and asterisks. That is the mockup's own
 * fallback branch and it is drawn here rather than replaced, because refusing
 * a construct `dv.mdnote` does not name, or inventing a `<table>` branch the
 * design of record has no CSS rule for (`.md` styles `h1`/`h2`/`h3`, `p`,
 * `ul` and `pre` and nothing else), would both be this file deciding
 * something the owner has not. Reported.
 *
 * **One inline cost, because it is a defect and not a limit.** "Code spans
 * win" is a TIE-BREAK, not a priority: a regex takes the leftmost match, so
 * `**`x`**` is a bold run whose payload keeps its backticks as literal text
 * and loses `.m` — and with `.m` goes the `unicode-bidi:isolate` that makes a
 * flag or a path read correctly inside RTL prose. The served `scope` topic
 * writes exactly that twice. Kept, because it is the mockup's own pattern and
 * changing the alternation would change what a code span protects; reported.
 *
 * **`.md` styles `h1` and this renderer never emits one.** The mockup's
 * heading branch builds `h{min(level+1, 4)}` — `#` becomes `h2`, `##` becomes
 * `h3`, `###` becomes `h4`. `.md h1,.md h2,.md h3` therefore styles a tag that
 * cannot appear and leaves `h4` — which the mockup's own sample markdown
 * produces from `### The five tiers` — with no rule at all. Carried across
 * unchanged, since `styles.css` is held byte-identical to the mockup and this
 * file may not touch either. Reported.
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
 * The four inline runs, in the mockup's own order with the image alternative
 * added.
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
 */
const INLINE = /(`[^`]+`)|(!\[[^\]]*\]\([^)]*\))|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)/g;

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
 *
 * **`.refusal` is not in `styles.css`.** The mockup declares it beside `.well`
 * and `.welllabel`, immediately below the `.md` family; the repaint that
 * carried `.md` across carried none of those three — checked, not assumed:
 * `styles.css` matches `^\.md\{` and matches no `^\.refusal\{`, `^\.well\{`
 * or `^\.welllabel\{` — and this file may not edit either stylesheet. It is
 * still emitted — the class is the design's own name for the thing, and an
 * unstyled refusal that says so beats a styled one that does not exist. The
 * `<pre>` beside it IS styled, by `.md pre`. Reported.
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
    } else {
      out.push(make(doc, 'b', null, m[4].slice(2, -2)));
    }
    last = INLINE.lastIndex;
  }
  if (last < text.length) out.push(doc.createTextNode(text.slice(last)));
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
  const nodes = [];
  const refusals = [];
  for (const block of String(src).replaceAll('\r\n', '\n').split(/\n{2,}/)) {
    const b = block.trim();
    if (!b) continue;

    // Raw HTML, first and unconditionally. `<!--` and `<script` are the same
    // decision, and both are shown rather than parsed.
    if (/^<[a-z!]/i.test(b)) {
      refusals.push('raw HTML');
      nodes.push(refusalBlock(doc, 'raw HTML block refused', b));
      continue;
    }

    // A fenced block is TEXT, all of it: no inline pass runs inside it, so a
    // backtick or a bracket in a transcript stays what it was written as.
    if (b.startsWith('```')) {
      nodes.push(make(doc, 'pre', null, b.replace(/^```[a-z]*\n?/, '').replace(/```$/, '')));
      continue;
    }

    // `#` → h2, `##` → h3, `###` → h4. Four or more hashes match nothing here
    // and fall through to the paragraph branch, hashes and all — the mockup's
    // behaviour, kept so the subset's edge is visible instead of guessed at.
    if (/^#{1,3}\s/.test(b)) {
      const level = b.match(/^#+/)[0].length;
      const heading = doc.createElement(`h${Math.min(level + 1, 4)}`);
      heading.append(...inlineNodes(b.replace(/^#+\s*/, ''), refusals, doc));
      nodes.push(heading);
      continue;
    }

    // Every line of the block is an item. A block whose FIRST line is a bullet
    // is a list; a continuation line that is not a bullet keeps its own text,
    // which is what the mockup does and is why `replace` is not anchored to a
    // match that must exist.
    if (/^[-*]\s/.test(b)) {
      const list = doc.createElement('ul');
      for (const line of b.split('\n')) {
        const item = doc.createElement('li');
        item.append(...inlineNodes(line.replace(/^[-*]\s*/, ''), refusals, doc));
        list.append(item);
      }
      nodes.push(list);
      continue;
    }

    const para = doc.createElement('p');
    para.append(...inlineNodes(b, refusals, doc));
    nodes.push(para);
  }
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
