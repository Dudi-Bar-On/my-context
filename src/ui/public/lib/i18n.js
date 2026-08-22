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

// The three run markers, exactly as Task 1 transcribes them from the
// mockup's grammar block. `mv` is listed before `m`, as the mockup's own
// `SLOT` pattern lists it: the longer marker is tried first, so `{mv:branch}`
// is read as the monospace VALUE slot and never as an `{m:…}` literal. The
// payload cannot contain `}` — the same limit the mockup's own `slots()` has,
// stated here rather than discovered later.
const RUN = /\{(?:(mv|m):)?([^}]*)\}/g;

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
  const out = [];
  let last = 0;
  RUN.lastIndex = 0;
  for (let m = RUN.exec(template); m !== null; m = RUN.exec(template)) {
    if (m.index > last) out.push(doc.createTextNode(template.slice(last, m.index)));
    const marker = m[1];
    const payload = m[2];
    if (marker === 'm') out.push(run('m', payload));                // a literal
    else if (marker === 'mv') out.push(run('m v', value(payload))); // a value, same treatment
    else out.push(run('v', value(payload)));                        // a value, isolated, not mono
    last = RUN.lastIndex;
  }
  if (last < template.length) out.push(doc.createTextNode(template.slice(last)));
  return out;
}

/** The two methods `t()` uses. Enough for `tFlat`, and enough for a test. */
const FLAT_DOC = {
  createTextNode: (text) => ({ textContent: text }),
  createElement: () => ({ className: '', textContent: '' }),
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

/** `<html lang dir>` follows the language (spec §3). */
export function applyLanguage(documentEl, table) {
  documentEl.setAttribute('lang', table.lang);
  documentEl.setAttribute('dir', table.dir);
}
