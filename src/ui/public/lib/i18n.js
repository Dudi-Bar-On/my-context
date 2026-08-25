// src/ui/public/lib/i18n.js
// The one and only string renderer for the shell and every screen. A plain
// browser ES module: no types, no imports, no build step —
// `test/ui/viewmodel.test.ts` imports this file directly by a `file://` URL
// specifier and passes it a two-method stand-in `doc`, which is all `t()`
// ever touches on the document.

export function pickLanguage(stored, navigatorLang) {
  if (stored === 'en' || stored === 'he') return stored;
  return String(navigatorLang || '').toLowerCase().startsWith('he') ? 'he' : 'en';
}

// The run markers, as Task 1 transcribes them from the mockup's grammar block,
// plus the two EMPHASIS markers added 2026-08-25.
//
//   {m:text}    a monospace literal          -> <span class="m">
//   {mv:name}   a monospace value            -> <span class="m v">
//   {name}      a value, isolated not mono   -> <span class="v">
//   {b:runs}    bold                         -> <b>
//   {i:runs}    italic                       -> <i>
//
// `mv` is listed before `m` for the reason the mockup's own `SLOT` pattern
// lists it that way: the longer marker is tried first, so `{mv:branch}` is
// read as the monospace VALUE slot and never as an `{m:…}` literal.
//
// **The emphasis markers NEST and the other three do not, which is why this
// stopped being one regex.** The design of record wraps slots inside emphasis
// in five places — `<b>"<span class="v">3</span> of <span class="v">5</span>"
// is counted, never stored</b>` is the plainest — and a payload matched as
// `[^}]*` cannot contain the `}` that closes an inner run. So `{m:}` and
// `{mv:}` keep the old rule exactly, ending at the FIRST `}`, and only `{b:}`
// and `{i:}` scan for the MATCHING one and recurse into what they enclose.
const MARKER = /^\{(mv|m|b|i):/;

/** The `}` that closes the run opening at `open`, or -1. Emphasis only. */
function closer(template, open, end) {
  let depth = 0;
  for (let i = open; i < end; i++) {
    if (template[i] === '{') depth += 1;
    else if (template[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * One pass over `template[from, to)`, building nodes.
 *
 * Recursive for `{b:}` and `{i:}` and flat for everything else, which is the
 * whole of the difference between the two kinds of marker.
 */
function scan(template, from, to, ctx) {
  const out = [];
  let text = '';
  const flush = () => {
    if (text !== '') { out.push(ctx.doc.createTextNode(text)); text = ''; }
  };
  let i = from;
  while (i < to) {
    if (template[i] !== '{') { text += template[i]; i += 1; continue; }
    const marked = MARKER.exec(template.slice(i, to));
    // A bare `{name}` value slot: unchanged, and it ends at the first `}`.
    if (marked === null) {
      const close = template.indexOf('}', i);
      if (close === -1 || close >= to) { text += template[i]; i += 1; continue; }
      flush();
      out.push(ctx.run('v', ctx.value(template.slice(i + 1, close))));
      i = close + 1;
      continue;
    }
    const marker = marked[1];
    const open = i + marked[0].length;
    if (marker === 'm' || marker === 'mv') {
      const close = template.indexOf('}', open);
      if (close === -1 || close >= to) { text += template[i]; i += 1; continue; }
      flush();
      const payload = template.slice(open, close);
      out.push(marker === 'm' ? ctx.run('m', payload) : ctx.run('m v', ctx.value(payload)));
      i = close + 1;
      continue;
    }
    const close = closer(template, i, to);
    if (close === -1) { text += template[i]; i += 1; continue; }
    flush();
    const el = ctx.doc.createElement(marker);
    el.append(...scan(template, open, close, ctx));
    out.push(el);
    i = close + 1;
  }
  flush();
  return out;
}

/**
 * A translated string, AS NODES. Never as a string. (Owner ruling A1, §0.6.)
 *
 * A string cannot carry an element, and ALL THREE markers build one: `{m:…}`
 * and `{mv:name}` are monospace and bidi-isolated, and a plain `{name}` is
 * bidi-isolated as well — `span.v`, the isolation without the monospace,
 * which is what the mockup's `slotNode` builds (§0.7). Its header comment
 * records what a string-returning renderer costs — assigning a captured
 * translation with `textContent` "flattens just as thoroughly … the seven
 * `data-t` elements holding `.m` spans lost them on the first toggle and
 * never got them back", leaving "English isolated and Hebrew not, exactly
 * backwards". So this returns Node[] for EVERY key, marked or not, and
 * callers append:
 *
 *     heading.append(...t(strings, 'preview.h'));
 *
 * `doc` exists so `node --test` can pass a two-method stand-in; the browser
 * never passes it, and nothing else in this module touches the DOM.
 *
 * TWO ways to fail loudly, both deliberate. A missing KEY throws, so a
 * screen naming an undeclared key fails in development instead of rendering
 * blank. A missing SUBSTITUTION throws too: leaving `{n}` in place puts
 * braces on the screen, which is the same defect wearing a different marker
 * — and it is exactly what the old `\w`-based pattern did to every `{mv:…}`
 * run, silently.
 */
export function t(strings, key, subs = {}, doc = globalThis.document) {
  const template = strings[key];
  if (template === undefined) throw new Error(`missing string key: ${key}`);
  const value = (name) => {
    if (!Object.prototype.hasOwnProperty.call(subs, name)) {
      throw new Error(`missing substitution {${name}} for string key: ${key}`);
    }
    return String(subs[name]);
  };
  // `m` is monospace + direction:ltr + unicode-bidi:isolate; `v` is the
  // isolation alone. These are the mockup's `slotNode` classes, exactly.
  const run = (className, text) => {
    const el = doc.createElement('span');
    el.className = className;
    el.textContent = text;
    return el;
  };
  return scan(template, 0, template.length, { doc, run, value });
}

/**
 * The methods `t()` uses. Enough for `tFlat`, and enough for a test.
 *
 * `append` and the `textContent` accessor pair exist because emphasis NESTS:
 * a `{b:}` run holds child nodes rather than a string, and a stand-in whose
 * `textContent` were a plain field would flatten to the empty string it was
 * constructed with and silently drop every word inside the bold. That is the
 * `aria-label` on eighteen screens, so it is worth eight lines.
 */
const FLAT_DOC = {
  createTextNode: (text) => ({ textContent: text }),
  createElement: () => {
    const kids = [];
    return {
      className: '',
      append: (...ns) => { kids.push(...ns); },
      get textContent() { return kids.map((n) => n.textContent).join(''); },
      set textContent(v) { kids.length = 0; kids.push({ textContent: v }); },
    };
  },
};

/**
 * The same three markers, parsed the same way, and then FLATTENED to a
 * string.
 *
 * **The flattening is deliberate, and saying so is the reason this is a
 * separate function rather than a shrug at a call site.** An `aria-label`, a
 * `title` and an `<option>` label are attributes or text-only sinks: they
 * cannot hold an element, so the isolation an `{m:…}`, `{mv:…}` or a plain
 * `{name}` run carries CANNOT survive there, whatever the renderer does. On
 * screen the same flattening is the defect the mockup records as shipped; in
 * an attribute it is the only thing an attribute can hold.
 *
 * A caller reaching for this to fill an ELEMENT is the bug. Use `t()` there.
 */
export function tFlat(strings, key, subs = {}) {
  return t(strings, key, subs, FLAT_DOC).map((n) => n.textContent).join('');
}

/**
 * The substitution names a template REQUIRES -- what a caller must supply.
 *
 * Exported because eight test files had each grown their own copy of this
 * scanner, every one of them the same `\{(?:(mv|m):)?([^}]*)\}` that predates
 * emphasis. The moment `{b:}` and `{i:}` landed, all eight read `{b:` as a
 * substitution named `b:...` and demanded the caller supply it -- eighteen
 * failures, none of which was a defect in the code under test. A grammar with
 * nine parsers has eight chances to disagree with itself.
 *
 * It reuses `scan`, deliberately, rather than describing the grammar a second
 * time: a `value` that records instead of substituting, and a `doc` that
 * builds nothing. Emphasis recurses, so a slot nested inside a `{b:}` run is
 * collected exactly as one at the top level is.
 */
export function slots(template) {
  const names = [];
  const empty = { textContent: '' };
  scan(template, 0, template.length, {
    doc: { createTextNode: () => empty, createElement: () => ({ append: () => {} }) },
    run: () => empty,
    value: (name) => { names.push(name); return ''; },
  });
  return names;
}

/** `<html lang dir>` follows the language (spec §3). */
export function applyLanguage(documentEl, table) {
  documentEl.setAttribute('lang', table.lang);
  documentEl.setAttribute('dir', table.dir);
}
