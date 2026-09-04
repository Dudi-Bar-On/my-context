// src/ui/public/lib/disclosure.js
//
// **The one circled question mark, built once.**
//
// `STD-a-screen-explains-itself-in-plain-words-and-depth-hides` (owner
// instruction, 2026-09-04): a screen's own text stays short, plain and
// structured; anything longer than that space affords sits behind a single
// disclosure convention — one icon, one interaction, one set of string keys —
// so a reader who learns it on one screen knows it on every screen. "A second
// shape for the same idea is the defect this exists to prevent."
//
// **The component already half existed.** `screens/coverage.js` hand-built
// `<details class="help"><summary>…</summary><div class="helpbox">…</div>
// </details>` once, for its pinned-items note; `screens/doctor.js` built the
// identical five lines twice more, and `screens/work.js` a fourth time. Four
// call sites, one shape, never factored — this file is that factoring, so a
// fifth screen calls one function instead of retyping the boilerplate a fifth
// time. `TASK-scope-coverage-summarises-first-and-shows-detail-on-demand`
// (seq:21) is its first caller; the four existing hand-built sites are not
// migrated here — this task's own scope is `lib/**`, `styles.css` and
// `strings/**`, not the screens that already work.
//
// ── WHY `<details>`/`<summary>`, AND WHY THAT IS THE WHOLE KEYBOARD STORY ──
//
// A native `<details>` element is reachable and operable with nothing added:
// `<summary>` is in the default Tab order and Enter or Space toggles `open`
// the same way a click does. "The `?` must work by keyboard, not only by
// pointer" is therefore satisfied by the CHOICE of element rather than by
// event-handler code this file would otherwise have to write and this file's
// own test would otherwise have to prove — there is no `addEventListener`
// anywhere below.
//
// ── WHAT IT MAY HOLD, AND WHAT IT MAY NOT ──────────────────────────────────
//
// The standard's own boundary, restated as an API rather than a rule someone
// has to remember at each call site: this factory takes a summary (the short
// sentence that STAYS on the page — callers draw that themselves, beside the
// `<details>`, never inside it) and a body (the longer plain-words disclosure).
// It has no parameter for jargon, because there is no such thing as
// call-site-supplied jargon — the body is exactly the nodes the caller passes,
// in the caller's own words, and this file forms no opinion on them beyond
// where they sit.
//
// ── THE EXAMPLE SLOT ────────────────────────────────────────────────────────
//
// The approved mockup (`reports/2026-09-04-scope-coverage-redesign-mockup.html`)
// draws a worked example — why pinned items are not repeated per folder,
// ending in a file that does not exist yet — inside its own `<div class="ex">`,
// labelled by a CSS `::before{content:"Example — "}`. That label is English
// with no Hebrew rule beside it in the mockup's report chrome, which this
// product may not ship: "Text built in script has no key and is permanently
// English on the Hebrew page" is the defect a whole lane cleared today and
// this file must not reopen it. So the label here is a real, keyed text node
// rather than generated CSS content — `th.example` ("Example" / "דוגמה"),
// already declared in both string tables for a table header and reused here
// rather than minted twice for the same one word.
//
// ── WHERE `el` COMES FROM ───────────────────────────────────────────────────
//
// `lib/command-actions.js` set the precedent this file follows: the one DOM
// builder already in this directory imports `el`/`errorNote` from
// `../screens/parts.js` rather than growing a second factory, on the
// reasoning that a second `el` is how two surfaces come to disagree about
// what an element looks like. This import is the same shape, relative, for
// the same reason it resolves identically in a browser, in Node from a file
// URL, and inside a `data:` module.
import { el } from '../screens/parts.js';

/**
 * The shared disclosure: `<details class="help"><summary>…</summary>
 * <div class="helpbox">…[<div class="ex">…</div>]</div></details>`.
 *
 * @param {{ t: (key: string, subs?: Record<string, unknown>) => Node[] }} ctx
 * @param {string} summaryKey - the string key for the summary's short label,
 *   drawn beside the `?` glyph `styles.css` already paints on every
 *   `details.help > summary`.
 * @param {(Node | string)[]} body - the longer, still-plain-words content,
 *   already built by the caller in whatever shape it needs (paragraphs,
 *   spans, a list of chips) — this file appends it and decides nothing about
 *   its wording.
 * @param {{
 *   summarySubs?: Record<string, unknown>,
 *   example?: (Node | string)[],
 * }} [options]
 *   `summarySubs` fills the summary key's own `{slots}`, exactly as
 *   `ctx.t(key, subs)` everywhere else in this product. `example`, when
 *   given, is appended as the mockup's own labelled example block — a
 *   concrete case "where an example earns its place", never a second
 *   paragraph of prose pretending to be one.
 * @returns {HTMLDetailsElement}
 */
export function helpDisclosure(ctx, summaryKey, body, options = {}) {
  const details = el('details', 'help');
  const summary = el('summary');
  summary.append(...ctx.t(summaryKey, options.summarySubs));
  const box = el('div', 'helpbox');
  box.append(...body);
  if (options.example !== undefined && options.example.length > 0) {
    const example = el('div', 'ex');
    const label = el('b', 'exlabel');
    label.append(...ctx.t('th.example'));
    example.append(label, ' — ', ...options.example);
    box.append(example);
  }
  details.append(summary, box);
  return details;
}
