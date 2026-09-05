/**
 * **GitHub's sanitized HTML allow-list, and the only place raw markup becomes
 * DOM nodes.**
 *
 * ── WHY THIS FILE EXISTS AT ALL ───────────────────────────────────────────
 *
 * `DEC-the-documentation-and-tutorials-screens-become-one-list-and`, owner
 * ruling of 2026-09-05: *"use exactly the same renderer and viewing as it is
 * implemented in github, do not decide other way, if required ask me."* GitHub
 * admits a documented subset of raw HTML, and the two documents this project
 * calls "the base of the documentation system" are BUILT out of that subset —
 * `docs/README.he.md` carries 149 `<div dir="rtl">` wrappers, 1,665
 * `<span dir="ltr">` runs and 132 HTML comments, and `README.md` carries 131
 * comments. Rendered by the console's own refusing renderer
 * (`lib/markdown.js`, `html: false`) those produced 457 and 141 refusal boxes
 * respectively, with every unrefused inline tag printed at the reader as
 * literal `<span dir="ltr">` text. Matching GitHub is what removes that noise,
 * and the ruling says so in its own words.
 *
 * **The allow-list is what makes "match GitHub" survivable.** This server
 * sends no `Content-Security-Policy` (`security.ts` retired it on 2026-08-22
 * and `server-e2e.test.ts` asserts its ABSENCE), so `script-src 'self'` is not
 * there to catch a mistake made here. Every guarantee is therefore structural
 * and lives in this file:
 *
 *   1. **No `innerHTML`, ever, and no `DOMParser`.** Raw markup is scanned by
 *      `htmlTokens` below and turned into `createElement` / `createTextNode`
 *      calls. Nothing this module produces was ever an HTML string the browser
 *      parsed, so there is no parser differential between "what I checked" and
 *      "what the browser built" — the classic sanitiser hole.
 *   2. **No `eval`, no `Function`, no `setTimeout(string)`.** Grep this file.
 *   3. **Tags are an ALLOW-list** (`ALLOWED_TAGS`). A tag outside it is not
 *      unwrapped the way GitHub's own sanitiser unwraps it — it is REFUSED and
 *      named, because `INV-nothing-is-dropped-silently` is why the refusal
 *      mechanism exists and the ruling explicitly keeps it "for everything
 *      outside the allow-list".
 *   4. **Attributes are an ALLOW-list** (`GLOBAL_ATTRS` + `TAG_ATTRS`), taken
 *      from GitHub's own documented set. `on*` handlers cannot be reached by
 *      construction: they are not in the set, and the set is consulted by
 *      exact name. Neither `style`, `class` nor `id` is in it — GitHub does not
 *      allow them either, and `class` in particular would let a document forge
 *      this app's own `.refusal` and `.m` affordances.
 *   5. **URL-bearing attributes are scheme-checked against an allow-list**
 *      (`SAFE_SCHEMES`), never a deny-list. `javascript:`, `data:`, `vbscript:`
 *      and every scheme nobody enumerated all fail the same way.
 *   6. **The string that is checked is the string that is set.** Entity
 *      decoding happens in `decodeEntities` BEFORE the scheme check, and the
 *      decoded value is what `setAttribute` receives. An entity this decoder
 *      does not know stays literal in both the check and the attribute, so
 *      under-decoding is cosmetic and can never widen what is allowed —
 *      `href="javascript&colon;alert(1)"` set through `setAttribute` is a
 *      relative URL with an ampersand in it, not a script.
 *
 * ── WHERE THE LIST COMES FROM ─────────────────────────────────────────────
 *
 * GitHub renders Markdown with cmark-gfm and then sanitises with
 * `html-pipeline`'s `SanitizationFilter`, whose element and attribute
 * allow-lists are what GitHub's own "HTML elements you can use" documentation
 * describes. `ALLOWED_TAGS`, `GLOBAL_ATTRS`, `TAG_ATTRS`, `URL_ATTRS` and
 * `SAFE_SCHEMES` below are that set, transcribed. Three deliberate,
 * NAMED departures, each recorded rather than left for a reader to find:
 *
 *   - `<bdi>` is admitted alongside `<bdo>`. GitHub renders it today and this
 *     project ships a Hebrew document; an isolation element is the one piece
 *     of markup a bidirectional document most wants and it is inert.
 *   - `<video>`, `<audio>` and `<track>` are NOT admitted. They are GitHub
 *     extensions rather than part of the documented core, no document in this
 *     repository contains one (measured), and each is a media loader. A
 *     document that grows one gets a named refusal, which is the outcome this
 *     project prefers to a silent divergence.
 *   - A tag outside the list is REFUSED rather than unwrapped — rule 3 above,
 *     and the ruling's own instruction.
 */

/**
 * The elements GitHub admits. Transcribed from `html-pipeline`'s
 * `SanitizationFilter::ALLOWLIST`, plus `<bdi>`; see this file's header for
 * the three departures and why each was taken.
 */
export const ALLOWED_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8',
  'br', 'b', 'i', 'strong', 'em', 'a', 'pre', 'code', 'img', 'tt',
  'div', 'ins', 'del', 'sup', 'sub', 'p', 'ol', 'ul',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
  'blockquote', 'dl', 'dt', 'dd', 'kbd', 'q', 'samp', 'var', 'hr',
  'ruby', 'rt', 'rp', 'li', 's', 'strike', 'summary', 'details',
  'figure', 'figcaption', 'abbr', 'bdo', 'bdi', 'cite', 'dfn', 'mark',
  'small', 'span', 'time', 'wbr', 'input', 'picture', 'source',
]);

/**
 * Elements that carry no children — a closing tag for one of these is a stray
 * and is ignored, exactly as a browser ignores it.
 */
export const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'wbr', 'col', 'source']);

/**
 * The attributes GitHub admits on any element it admits — its `:all` set,
 * transcribed. Every one of them is inert: none names a handler, none carries
 * CSS, and the four that only mean anything on a `<form>` (`action`, `method`,
 * `enctype`, `accept-charset`) cannot reach one, because `form` is not in
 * `ALLOWED_TAGS`.
 *
 * **`style`, `class` and `id` are absent on purpose** and their absence is
 * load-bearing rather than incidental. GitHub omits all three; `class` would
 * let a document forge `.refusal` or `.m`, and `id` would let it collide with
 * the heading anchors the renderer mints.
 */
export const GLOBAL_ATTRS = new Set([
  'abbr', 'accept', 'accept-charset', 'accesskey', 'action', 'align', 'alt',
  'aria-describedby', 'aria-hidden', 'aria-label', 'aria-labelledby', 'axis',
  'border', 'cellpadding', 'cellspacing', 'char', 'charoff', 'charset', 'checked',
  'clear', 'cols', 'colspan', 'color', 'compact', 'coords', 'datetime', 'dir',
  'disabled', 'enctype', 'for', 'frame', 'headers', 'height', 'hreflang', 'hspace',
  'ismap', 'label', 'lang', 'maxlength', 'media', 'method', 'multiple', 'name',
  'nohref', 'noshade', 'nowrap', 'open', 'prompt', 'readonly', 'rel', 'rev', 'rows',
  'rowspan', 'rules', 'scope', 'selected', 'shape', 'size', 'span', 'start',
  'summary', 'tabindex', 'target', 'title', 'type', 'usemap', 'valign', 'value',
  'vspace', 'width', 'itemprop',
]);

/** The per-element additions to `GLOBAL_ATTRS`, GitHub's own table. */
export const TAG_ATTRS = {
  a: ['href'],
  img: ['src', 'longdesc'],
  div: ['itemscope', 'itemtype'],
  blockquote: ['cite'],
  del: ['cite'],
  ins: ['cite'],
  q: ['cite'],
  source: ['srcset'],
};

/**
 * The attributes whose VALUE is a URL, and which must therefore survive
 * `safeUrl` before they are set. Listed by name rather than by element, so an
 * element that grows one of them later cannot acquire an unchecked URL sink.
 */
export const URL_ATTRS = new Set([
  'href', 'src', 'cite', 'longdesc', 'action', 'srcset', 'usemap', 'itemtype', 'profile',
]);

/**
 * The schemes GitHub permits in a link, plus the two relative forms every
 * document uses. An ALLOW-list, never a deny-list: `DEC-markdown-is-served-
 * from-a-manifest-rendered-by-one-renderer`'s own argument — a deny-list
 * silently passes the scheme nobody thought of.
 */
export const SAFE_SCHEMES = new Set([
  'http', 'https', 'mailto', 'xmpp', 'irc', 'ircs', 'github-windows', 'github-mac',
]);

/**
 * The named character references this decoder knows. Deliberately SHORT.
 *
 * A named reference this map does not carry is left literal — in the value
 * that is CHECKED and in the value that is SET, which are the same string. So
 * the failure mode of an incomplete map is a visible `&hellip;` in a title
 * attribute, never a URL that passes the scheme check and then means something
 * else to the browser. See rule 6 in this file's header.
 */
const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  copy: '\u00a9', reg: '\u00ae', hellip: '\u2026', mdash: '\u2014', ndash: '\u2013',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d',
  times: '\u00d7', middot: '\u00b7', bull: '\u2022', deg: '\u00b0', trade: '\u2122',
  laquo: '\u00ab', raquo: '\u00bb', larr: '\u2190', rarr: '\u2192', harr: '\u2194',
  shy: '\u00ad', ensp: '\u2002', emsp: '\u2003', thinsp: '\u2009',
  lrm: '\u200e', rlm: '\u200f', zwj: '\u200d', zwnj: '\u200c',
};

/** A numeric or named character reference, decoded. See `NAMED_ENTITIES`. */
export function decodeEntities(source) {
  return String(source).replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);/g,
    (whole, body) => {
      if (body[0] === '#') {
        const code = body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
        // A code point outside Unicode, or a surrogate half, is not a
        // character — it is left as written rather than replaced by U+FFFD,
        // because a document that wrote it meant the text.
        if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
        if (code >= 0xd800 && code <= 0xdfff) return whole;
        return String.fromCodePoint(code);
      }
      const named = NAMED_ENTITIES[body];
      return named === undefined ? whole : named;
    });
}

/**
 * Whether a URL may be set.
 *
 * The probe strips every ASCII control character and space BEFORE looking for
 * a scheme, so `java\tscript:`, `java\nscript:` and ` javascript:` are all the
 * same string to this check. A colon that appears after the first `/`, `?` or
 * `#` is part of a path, not a scheme — `docs/a:b.md` is a relative link and
 * GitHub treats it as one.
 */
export function safeUrl(value) {
  const probe = String(value).replace(/[\u0000-\u0020\u007f]/g, '').toLowerCase();
  if (probe === '') return true;
  const colon = probe.indexOf(':');
  if (colon === -1) return true;
  const separator = probe.search(/[/?#]/);
  if (separator !== -1 && separator < colon) return true;
  return SAFE_SCHEMES.has(probe.slice(0, colon));
}

/** Whether `name` may be set on `tag`. Exact-match against two allow-lists. */
export function attributeAllowed(tag, name) {
  if (GLOBAL_ATTRS.has(name)) return true;
  const extra = TAG_ATTRS[tag];
  return extra !== undefined && extra.includes(name);
}

const ATTR_SCAN = /([^\s/>"'=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]*)))?/g;

/** One tag's attributes, as `[name, value]` pairs with entities decoded. */
export function parseAttributes(inside) {
  const pairs = [];
  ATTR_SCAN.lastIndex = 0;
  let match = ATTR_SCAN.exec(inside);
  while (match !== null) {
    const name = match[1].toLowerCase();
    // The `/` of a self-closing tag scans as a bare name; it is not one.
    if (name !== '/' && name !== '') {
      const raw = match[2] ?? match[3] ?? match[4] ?? '';
      pairs.push([name, decodeEntities(raw)]);
    }
    match = ATTR_SCAN.exec(inside);
  }
  return pairs;
}

/**
 * Raw markup → a flat token list.
 *
 * **A scanner and not a parser**: it reports what the source SAYS, and the
 * caller decides what is built. Quoted attribute values are honoured, so a `>`
 * inside `title="a > b"` does not end the tag; an unterminated tag at the end
 * of the source is text, which is what a browser does with it too.
 *
 * Token kinds: `text` (entities decoded), `tag`, `endtag`, `comment` (its
 * content is discarded — GitHub renders a comment as nothing at all, which the
 * ruling names explicitly), and `other` for a doctype or processing
 * instruction, which is discarded for the same reason.
 */
export function htmlTokens(source) {
  const out = [];
  const text = [];
  const flush = () => {
    if (text.length === 0) return;
    const joined = text.join('');
    text.length = 0;
    if (joined !== '') out.push({ kind: 'text', text: decodeEntities(joined) });
  };
  let i = 0;
  const src = String(source);
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt === -1) { text.push(src.slice(i)); break; }
    text.push(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      flush();
      out.push({ kind: 'comment' });
      i = end === -1 ? src.length : end + 3;
      continue;
    }
    if (src.startsWith('<!', lt) || src.startsWith('<?', lt)) {
      const end = src.indexOf('>', lt);
      flush();
      out.push({ kind: 'other' });
      i = end === -1 ? src.length : end + 1;
      continue;
    }
    const head = /^<(\/?)([A-Za-z][A-Za-z0-9:_.-]*)/.exec(src.slice(lt, lt + 64));
    if (head === null) { text.push('<'); i = lt + 1; continue; }
    let cursor = lt + head[0].length;
    let quote = null;
    let end = -1;
    for (; cursor < src.length; cursor += 1) {
      const ch = src[cursor];
      if (quote !== null) { if (ch === quote) quote = null; continue; }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === '>') { end = cursor; break; }
    }
    if (end === -1) { text.push(src.slice(lt)); break; }
    const inside = src.slice(lt + head[0].length, end);
    flush();
    const name = head[2].toLowerCase();
    if (head[1] === '/') {
      out.push({ kind: 'endtag', name });
    } else {
      out.push({
        kind: 'tag',
        name,
        attrs: parseAttributes(inside),
        selfClosing: /\/\s*$/.test(inside),
      });
    }
    i = end + 1;
  }
  flush();
  return out;
}

/**
 * An allowed tag → a real element with only its allowed attributes on it.
 *
 * Returns `{ node, dropped }` — `dropped` is the attribute names this call
 * refused, so a caller can DISCLOSE the count rather than drop them in
 * silence. It is a count and not a box per attribute on purpose: the Hebrew
 * README carries 1,665 `dir` attributes that are all admitted, and a page that
 * drew a warning for every attribute it did admit would be the noise the
 * ruling exists to remove.
 *
 * `doc` is injected for the reason `markdownNodes` injects it: this is the
 * only thing here that touches a document, so `node --test` can pass a
 * two-method stand-in and the whole allow-list is measurable without a
 * browser.
 */
export function buildElement(doc, tag, attrs) {
  const node = doc.createElement(tag);
  const dropped = [];
  for (const [name, value] of attrs) {
    if (!attributeAllowed(tag, name)) { dropped.push(name); continue; }
    if (URL_ATTRS.has(name) && !safeUrl(value)) { dropped.push(name); continue; }
    node.setAttribute(name, value);
  }
  // A checkbox a document supplied is never interactive: GitHub renders task
  // list checkboxes disabled outside its own editor, and an input a reader can
  // tick would claim a state change this page cannot make.
  if (tag === 'input') {
    node.setAttribute('type', 'checkbox');
    node.setAttribute('disabled', '');
  }
  return { node, dropped };
}
