// src/ui/public/lib/strip-choice.js
//
// **WHAT IS ON THE STATUS BAR IS THE READER'S TO CHOOSE, AND HIDING IS NOT
// SILENCING.** `semantic/17`,
// `TASK-the-status-bar-takes-a-ninth-of-the-window-and-the-only`.
//
// The owner, 2026-09-17, having declined a flat `STRIP_MAX_ROWS` change:
// *"a status bar customization dialog that would allow the user to check which
// elements to show … the viewer will dynamically extend it size down according
// to the status bar occupied lines but not by defining MAX ROWS — by setting up
// the status bar structure and content"*.
//
// ── WHY A SEPARATE MODULE AND NOT MORE OF `app.js` ────────────────────────
//
// `app.js` imports `/lib/bootstrap.js` by an absolute browser specifier, so no
// node test can import it at all. Everything below is a RULE rather than a
// pixel — what a stored choice is, what happens when the store lies, which
// pill answers to which name, and when a hidden field is entitled to force
// itself back — and every one of those is a way this feature can silently stop
// working. `lib/panel.js` is split on the same seam for the same reason, and
// `test/ui/panel.test.ts` is the precedent for how it is driven.
//
// ── THE ONE RULE THAT IS NOT NEGOTIABLE ──────────────────────────────────
//
// The strip carries DISCLOSURES and not only facts: `91 doctor notices`, `no
// handover ask yet — first at 90%`, `room left`, `injections this context`.
// A preference set once and forgotten becomes silence later, which is
// `INV-nothing-is-dropped-silently` arriving by the back door rather than the
// front. **So hiding means "do not show me this while it is quiet", never
// "never tell me".** A hidden field FORCES ITSELF BACK when it becomes urgent,
// and it returns marked, so that a return never reads as a field the reader
// thought he had switched off misbehaving.
//
// **And a field with no notion of urgency cannot join that set.** Saying so is
// the honest answer, not a gap: `URGENCY` below is `null` for thirteen of the
// thirty entries and the dialog prints that list under its own heading.

/** The one key shape this module owns. Per browser, per origin. */
export const CHOICE_KEY = 'mycontext.strip.fields';

/**
 * The prefix a strip NAME carries in the string tables.
 *
 * Every pill on the bar prints its own name in white caps (`.ulab`) or takes
 * the name of the group it is alone in (`.slab`), and every one of those names
 * is a `strip.grp.*` key. That is what makes a name a usable handle: it is
 * exactly what the reader sees, it is already translated into both languages,
 * and it separates COST from CACHE — two names the reader reads as two fields
 * which share ONE `data-f`, because the parity gates address a FACT and the
 * reader addresses a LABEL.
 */
export const GRP_PREFIX = 'strip.grp.';

/**
 * **WHICH NAME THIS PILL ANSWERS TO.**
 *
 * The pill's own printed name where it has one, and its field id where it does
 * not. Two pills that print one name — the model and its modes — are one
 * entry, which is right: MODEL is one thing to a reader.
 *
 * Takes anything with `dataset` and `querySelector`, so it is drivable without
 * a browser.
 */
export function pickKeyOf(el) {
  if (el === null || el === undefined) return null;
  const lab = typeof el.querySelector === 'function' ? el.querySelector(':scope > .ulab') : null;
  const key = lab?.dataset?.k;
  if (typeof key === 'string' && key.startsWith(GRP_PREFIX)) {
    const name = key.slice(GRP_PREFIX.length);
    if (name !== '') return name;
  }
  const field = el.dataset?.f;
  return typeof field === 'string' && field !== '' ? field : null;
}

/**
 * **THE LOUD CLASSES, AND THE THRESHOLD IS THE STRIP'S OWN.**
 *
 * `bandUsage` paints `safe` / `caution` / `warning` / `critical` from
 * `usageLevelOf`; a `.chip` paints `ok` / `warn` / `crit` from whichever
 * function computed its state. **Nothing here invents a threshold.** The field
 * is urgent exactly when the code that already computes its value has decided
 * it is loud — which is the item's requirement in its own words, *"derive each
 * threshold from the code that already computes the value"*.
 *
 * **`caution` and `ok` are NOT loud, deliberately.** `caution` is the first
 * colour a rising figure takes and it is where this bar spends gold; forcing
 * every hidden field back at gold would make the preference worthless at the
 * ordinary middle of a session. `warning` is where the strip itself starts
 * drawing an ICON beside the value (`LEVEL_ICON`, `safe` draws none) and where
 * `askVerdictChip` starts drawing at all, so it is the bar's own existing line
 * between "rising" and "look at this".
 */
export const LOUD = ['warning', 'critical', 'warn', 'crit'];

/**
 * **IS THIS PILL LOUD RIGHT NOW?**
 *
 *   `'level'`    — loud when the value's own code banded it loud, or when the
 *                  builder set `data-u` because the field has a disclosure
 *                  with no band to carry it (the doctor count above zero, an
 *                  unavailable myctx share, an uncounted injection figure).
 *   `'presence'` — loud whenever it is drawn at all, because the field's own
 *                  code draws it only when there is something to disclose:
 *                  the review queue is silent at zero, the ask verdict is
 *                  silent below its band, the rate verdict is silent while
 *                  both windows are calm.
 *   `null`       — **no notion of urgency exists.** Hidden means hidden, and
 *                  the dialog says so by name.
 */
export function isUrgent(el, urgency) {
  if (el === null || el === undefined) return false;
  if (urgency !== 'level' && urgency !== 'presence') return false;
  if (el.dataset?.u === '1') return true;
  if (urgency === 'presence') return true;
  const own = el.classList;
  if (own !== undefined && LOUD.some((c) => own.contains(c))) return true;
  if (typeof el.querySelector !== 'function') return false;
  return el.querySelector(LOUD.map((c) => `.${c}`).join(',')) !== null;
}

/**
 * **EVERY NAME THE BAR CAN PRINT, IN THE ORDER THE BAR PRINTS THEM.**
 *
 * `group` is the `.sgrp-` the pill sits in, so the dialog reads like the thing
 * it configures. `label` is the string key for the row; where the pill prints
 * its own name that IS the key the bar uses, and where it prints none (a chip,
 * a verdict, a door) the dialog spends a `strip.pick.*` key rather than an id.
 *
 * **This table is a declaration and a declaration can go stale, so two proofs
 * hold it.** `test/ui/strip-picker.test.ts` fails on an entry whose label is
 * missing from either string table, and `e2e/strip-picker.spec.ts` collects
 * every `[data-f]` the live bar draws across the states its fixtures reach and
 * fails on one this table does not name. The second is the one that matters:
 * a field added next month appears on the bar, and the dialog gains a row for
 * it or the gate reddens by name. Its one known gap is the gap
 * `e2e/strip-fields.spec.ts` already states about itself — a field whose only
 * state no fixture reaches is invisible to a driven census.
 */
const I = 'identity';
const S = 'state';

export const STRIP_PICK = [
  // ── LINE 1 — IDENTITY, what does not change while the session runs. The repo
  //    group lives in the HEADER since `plan:walk seq:114` and is identity all
  //    the same, which is why it shares this column rather than getting a third.
  { key: 'project', group: 'repo', subject: I, label: 'strip.pick.project', urgency: null },
  { key: 'branch', group: 'repo', subject: I, label: 'strip.pick.branch', urgency: null },
  { key: 'upstream', group: 'repo', subject: I, label: 'strip.pick.upstream', urgency: 'level' },
  { key: 'model', group: 'model', subject: I, label: 'strip.grp.model', urgency: null },
  {
    key: 'sessionName', group: 'window', subject: I,
    label: 'strip.grp.sessionName', urgency: null,
  },
  {
    key: 'sessionSize', group: 'window', subject: I,
    label: 'strip.grp.sessionSize', urgency: null,
  },
  { key: 'lanes', group: 'window', subject: I, label: 'strip.grp.lanes', urgency: null },
  { key: 'focus', group: 'window', subject: I, label: 'strip.grp.focus', urgency: null },
  { key: 'items', group: 'corpus', subject: I, label: 'strip.pick.items', urgency: null },
  {
    key: 'corpus-drift', group: 'corpus', subject: I,
    label: 'strip.pick.corpusDrift', urgency: 'level',
  },
  {
    key: 'config-error', group: 'corpus', subject: I,
    label: 'strip.pick.configError', urgency: 'level',
  },
  {
    key: 'doctor-notices', group: 'corpus', subject: I,
    label: 'strip.pick.doctorNotices', urgency: 'level',
  },
  {
    key: 'review-queue', group: 'corpus', subject: I,
    label: 'strip.pick.reviewQueue', urgency: 'presence',
  },
  { key: 'cwd', group: 'where', subject: I, label: 'strip.grp.cwd', urgency: null },
  {
    key: 'corpusRoot', group: 'where', subject: I,
    label: 'strip.grp.corpusRoot', urgency: 'level',
  },
  { key: 'rate5', group: 'limits', subject: I, label: 'strip.grp.rate5', urgency: 'level' },
  { key: 'rate7', group: 'limits', subject: I, label: 'strip.grp.rate7', urgency: 'level' },
  {
    key: 'rate-verdict', group: 'limits', subject: I,
    label: 'strip.pick.rateVerdict', urgency: 'presence',
  },
  // ── LINE 2 — STATE, everything that moves.
  { key: 'window', group: 'session', subject: S, label: 'strip.grp.window', urgency: 'level' },
  { key: 'myctx', group: 'session', subject: S, label: 'strip.grp.myctx', urgency: 'level' },
  { key: 'fill', group: 'session', subject: S, label: 'strip.pick.fill', urgency: 'level' },
  { key: 'ask', group: 'session', subject: S, label: 'strip.grp.ask', urgency: 'level' },
  {
    key: 'ask-verdict', group: 'session', subject: S,
    label: 'strip.pick.askVerdict', urgency: 'presence',
  },
  {
    key: 'handover-verdict', group: 'session', subject: S,
    label: 'strip.pick.handoverVerdict', urgency: 'level',
  },
  { key: 'cost', group: 'cost', subject: S, label: 'strip.grp.cost', urgency: null },
  { key: 'cache', group: 'cost', subject: S, label: 'strip.grp.cache', urgency: null },
  { key: 'elapsed', group: 'cost', subject: S, label: 'strip.grp.elapsed', urgency: null },
  {
    key: 'injections', group: 'audit', subject: S,
    label: 'strip.pick.injections', urgency: 'level',
  },
  {
    key: 'last-audit', group: 'audit', subject: S,
    label: 'strip.pick.lastAudit', urgency: 'level',
  },
  { key: 'clock', group: 'audit', subject: S, label: 'strip.grp.clock', urgency: null },
];

/**
 * The groups, in bar order, each with its own heading key — derived from the
 * table above rather than listed a second time, because a second list is this
 * project's most repeated defect and a nine-line one is no exception.
 */
export function pickGroups() {
  const out = [];
  for (const entry of STRIP_PICK) {
    let group = out.find((g) => g.key === entry.group);
    if (group === undefined) {
      group = {
        key: entry.group, subject: entry.subject,
        label: `${GRP_PREFIX}${entry.group}`, entries: [],
      };
      out.push(group);
    }
    group.entries.push(entry);
  }
  return out;
}

/**
 * **THE TWO COLUMNS, AND THEY ARE THE BAR'S OWN SPLIT.**
 *
 * Owner, 2026-09-17, looking at a first draft that stacked thirty checkboxes in
 * one column: *"it's very long as a list you can layout the content more
 * inteligently, use the width too"*.
 *
 * It is not an arbitrary two-up flow, and the difference is the whole point.
 * The bar is built from exactly two subjects — IDENTITY, what does not change
 * while the session runs, and STATE, everything that moves (owner ruling
 * 2026-09-01) — and `fitStrip` allocates rows BETWEEN them, giving each extra
 * row to whichever is being cut more. Side by side, the columns say that
 * without a sentence, and a reader can see which subject his ticking is buying
 * rows back from. Structure carrying information rather than structure as
 * decoration.
 *
 * Derived from the table, so a group cannot appear in the wrong column without
 * the table saying so — and `e2e/strip-picker.spec.ts` reads the row each group
 * actually lands in on the bar and fails on a disagreement.
 */
export function pickColumns() {
  const groups = pickGroups();
  return ['identity', 'state'].map((subject) => ({
    subject,
    label: `strip.pick.${subject}`,
    groups: groups.filter((g) => g.subject === subject),
  }));
}

/** `urgency === null`, by name — what the dialog prints under its own heading. */
export function neverForced() {
  return STRIP_PICK.filter((e) => e.urgency === null).map((e) => e.key);
}

/**
 * `globalThis.localStorage`, or `null`.
 *
 * **Reading the property itself can throw**, before any method is called on
 * it — a sandboxed frame, or a browser set to block site data. The same guard,
 * for the same reason, as `lib/panel.js` and `lib/pane-resize.js`, whose header
 * spells it out: a convenience may not take the product down with it.
 */
export function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * **THE STORED CHOICE, OR `null` FOR ANYTHING THAT IS NOT ONE.**
 *
 * `null` and an empty array are DIFFERENT and the difference governs the row
 * ceiling: `null` is "this reader has never opened the dialog", where
 * `STRIP_MAX_ROWS` still applies as the fallback it was written to be, and
 * `[]` is "he opened it and turned nothing off", where what he ticked wins and
 * the bar may take the rows it needs.
 *
 * Every shape a store can lie in is refused rather than repaired: somebody
 * else's value under this key, half a write, an array of numbers, an array of
 * names that are not names. A store edited by hand, corrupted, or written by
 * an older build must not be able to reach the bar at all.
 */
export function readChoice(storage) {
  if (storage === null || storage === undefined) return null;
  let raw;
  try {
    raw = storage.getItem(CHOICE_KEY);
  } catch {
    // Private mode, blocked site data, a quota error on read in some engines.
    return null;
  }
  if (typeof raw !== 'string' || raw === '') return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const { off } = parsed;
  if (!Array.isArray(off)) return null;
  const known = new Set(STRIP_PICK.map((e) => e.key));
  // **A NAME THIS BUILD DOES NOT KNOW IS DROPPED, NOT KEPT.** A key left in
  // the store by a field that has since been renamed or removed would hide
  // nothing and appear nowhere, which is a preference nobody can see or undo.
  return off.filter((k) => typeof k === 'string' && known.has(k));
}

/**
 * **FORGET THE CHOICE, WHICH IS NOT THE SAME AS CHOOSING NOTHING.**
 *
 * `Show everything again` has to restore the bar the reader had BEFORE he ever
 * opened this dialog, and writing `{off: []}` does not: an empty selection is
 * still a selection, so `stripRowCap` would go on letting the bar take every
 * row its content measurably needs. Measured on this corpus at 1280px: the
 * default bar is four rows and 99px, and the same fields with an empty
 * SELECTION are five rows and 124px. Same fields, taller bar, and the reader
 * pressed a control that says the opposite.
 *
 * So the key is removed and `readChoice` answers `null` again. It is the same
 * distinction the two values already carry everywhere else in this module, one
 * control along.
 */
export function clearChoice(storage) {
  if (storage === null || storage === undefined) return;
  try {
    storage.removeItem(CHOICE_KEY);
  } catch { /* see readChoice(): a convenience may not break the product */ }
}

/** Write it, and say nothing if the store refuses. Same reasoning as above. */
export function writeChoice(storage, off) {
  if (storage === null || storage === undefined) return;
  try {
    storage.setItem(CHOICE_KEY, JSON.stringify({ off: [...off] }));
  } catch { /* see readChoice(): a convenience may not break the product */ }
}
