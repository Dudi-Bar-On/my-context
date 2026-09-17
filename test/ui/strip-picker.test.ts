// @basis TASK-the-status-bar-takes-a-ninth-of-the-window-and-the-only, INV-nothing-is-dropped-silently, DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn
/**
 * **THE STATUS BAR PICKER'S RULES — the half that is a decision rather than a
 * pixel.** `semantic/17`,
 * `TASK-the-status-bar-takes-a-ninth-of-the-window-and-the-only`.
 *
 * ── WHAT IS HERE, AND WHY EACH ONE IS A WAY THE FEATURE CAN SILENTLY DIE ──
 *
 * 1. **What a stored choice is.** `localStorage` is a string somebody else can
 *    write, an older build can have written, and a private window refuses to
 *    read at all. A value that reaches the bar unchecked is a preference
 *    nobody chose.
 * 2. **`null` is not `[]`.** "He has never opened the dialog" and "he opened it
 *    and turned nothing off" look alike and govern differently: the first
 *    keeps `STRIP_MAX_ROWS` as the ceiling it was written to be, the second
 *    lets what he ticked decide the row count. Collapsing them is how a cap
 *    silently overrides a selection.
 * 3. **Which pill answers to which name.** COST and CACHE are two names a
 *    reader reads as two fields and ONE `data-f` — the parity gates address a
 *    FACT and a reader addresses a LABEL — so a picker keyed on `data-f` alone
 *    could not offer him one without the other.
 * 4. **When a hidden field is entitled to come back.** This is the item's
 *    non-negotiable half: hiding means *"do not show me this while it is
 *    quiet"*, never *"never tell me"*, because a preference set once and
 *    forgotten is `INV-nothing-is-dropped-silently` arriving by the back door.
 *    And the honest other side of it — a field with NO notion of urgency
 *    cannot join that set, and is named rather than quietly included.
 *
 * ── WHAT IS NOT HERE ──────────────────────────────────────────────────────
 *
 * The dialog, the right-click, the drag, the RTL placement, the row count and
 * the pixels. Those are facts about a live layout and a live event loop and
 * `e2e/strip-picker.spec.ts` drives every one of them in both languages. Spec
 * §6's standing limit applies: a green run here verifies the rules, not the
 * bar.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const CHOICE = new URL('../../src/ui/public/lib/strip-choice.js', import.meta.url).href;

interface Entry {
  key: string; group: string; subject: string; label: string; urgency: string | null;
}
const {
  CHOICE_KEY, STRIP_PICK, isUrgent, neverForced, pickColumns, pickGroups, pickKeyOf,
  readChoice, writeChoice,
} = (await import(CHOICE)) as {
  CHOICE_KEY: string;
  STRIP_PICK: readonly Entry[];
  isUrgent: (el: unknown, urgency: string | null) => boolean;
  neverForced: () => string[];
  pickColumns: () => { subject: string; label: string;
    groups: { key: string; subject: string; entries: Entry[] }[] }[];
  pickGroups: () => { key: string; subject: string; label: string; entries: Entry[] }[];
  pickKeyOf: (el: unknown) => string | null;
  readChoice: (storage: unknown) => string[] | null;
  writeChoice: (storage: unknown, off: Iterable<string>) => void;
};

/** A store that answers one string, or throws the way a private window does. */
const store = (value: string | null) => ({
  getItem: () => value,
  setItem: () => {},
});
const throwing = {
  getItem() { throw new Error('site data blocked'); },
  setItem() { throw new Error('site data blocked'); },
};

/**
 * A pill, DOM-free. `pickKeyOf` and `isUrgent` touch exactly three things —
 * `dataset`, `classList.contains` and `querySelector` — which is what makes
 * them drivable here at all, and is the same seam `lib/panel.js` is split on.
 */
const pill = (
  { f, ulab, classes = [], u, inner = [] }:
  { f?: string; ulab?: string; classes?: string[]; u?: string; inner?: string[] },
) => ({
  dataset: { ...(f === undefined ? {} : { f }), ...(u === undefined ? {} : { u }) },
  classList: { contains: (c: string) => classes.includes(c) },
  querySelector: (sel: string) => {
    if (sel === ':scope > .ulab') return ulab === undefined ? null : { dataset: { k: ulab } };
    const wanted = sel.split(',').map((s) => s.trim().replace(/^\./, ''));
    return inner.some((c) => wanted.includes(c)) ? {} : null;
  },
});

describe('what a stored choice is', () => {
  it('is null when there is no store at all — the private-window case', () => {
    assert.equal(readChoice(null), null);
    assert.equal(readChoice(undefined), null);
  });

  it('is null when the read itself throws, and the throw does not escape', () => {
    assert.equal(readChoice(throwing), null);
  });

  it('is null for an empty or absent value', () => {
    assert.equal(readChoice(store(null)), null);
    assert.equal(readChoice(store('')), null);
  });

  it('is null for somebody else\'s value under this key', () => {
    assert.equal(readChoice(store('not json at all')), null);
    assert.equal(readChoice(store('"a string"')), null);
    assert.equal(readChoice(store('[1,2,3]')), null);
    assert.equal(readChoice(store('{"off":"cwd"}')), null);
  });

  it('drops names this build does not know rather than keeping them', () => {
    // A key left behind by a field that has since been renamed would hide
    // nothing and appear nowhere — a preference nobody can see or undo.
    assert.deepEqual(readChoice(store('{"off":["cwd","nosuchfield",7,null]}')), ['cwd']);
  });

  it('separates "never chosen" from "chose to hide nothing" — the row ceiling '
    + 'depends on exactly this', () => {
    assert.equal(readChoice(store(null)), null);
    assert.deepEqual(readChoice(store('{"off":[]}')), []);
  });

  it('writes under its own key and survives a store that refuses', () => {
    let wrote: [string, string] | null = null;
    writeChoice({ getItem: () => null, setItem: (k: string, v: string) => { wrote = [k, v]; } },
      ['cwd', 'clock']);
    assert.deepEqual(wrote, [CHOICE_KEY, '{"off":["cwd","clock"]}']);
    assert.doesNotThrow(() => writeChoice(throwing, ['cwd']));
    assert.doesNotThrow(() => writeChoice(null, ['cwd']));
  });
});

describe('which pill answers to which name', () => {
  it('takes the name the pill PRINTS where it prints one', () => {
    // The two halves of the cost group: one `data-f`, two names, and the
    // reader must be able to keep the spend and drop the cache share.
    assert.equal(pickKeyOf(pill({ f: 'cost-cache', ulab: 'strip.grp.cost' })), 'cost');
    assert.equal(pickKeyOf(pill({ f: 'cost-cache', ulab: 'strip.grp.cache' })), 'cache');
  });

  it('falls back to the field id where the pill prints no strip name', () => {
    // The injections pill labels itself `strip.inj`, which is a sentence and
    // not a strip NAME, so the field id is the handle.
    assert.equal(pickKeyOf(pill({ f: 'injections', ulab: 'strip.inj' })), 'injections');
    assert.equal(pickKeyOf(pill({ f: 'corpus-drift' })), 'corpus-drift');
  });

  it('answers null for something that is not a pill', () => {
    assert.equal(pickKeyOf(null), null);
    assert.equal(pickKeyOf(pill({})), null);
  });
});

describe('when a hidden field is entitled to come back', () => {
  it('never, for a field with no notion of urgency — even when it is loud', () => {
    // The honest half of the promise. `model` and `clock` have no threshold to
    // cross, so unticking one hides it for good and the dialog says so by name
    // rather than implying a return that cannot happen.
    assert.equal(isUrgent(pill({ f: 'model', classes: ['critical'] }), null), false);
  });

  it('at warning and critical, and NOT at safe, caution or ok', () => {
    // The threshold is not invented here: `warning` is where the strip itself
    // starts drawing an icon beside the value, and where the ask verdict
    // starts being drawn at all.
    assert.equal(isUrgent(pill({ classes: ['ufield', 'warning'] }), 'level'), true);
    assert.equal(isUrgent(pill({ classes: ['ufield', 'critical'] }), 'level'), true);
    assert.equal(isUrgent(pill({ classes: ['chip', 'warn'] }), 'level'), true);
    assert.equal(isUrgent(pill({ classes: ['chip', 'crit'] }), 'level'), true);
    assert.equal(isUrgent(pill({ classes: ['ufield', 'safe'] }), 'level'), false);
    assert.equal(isUrgent(pill({ classes: ['ufield', 'caution'] }), 'level'), false);
    assert.equal(isUrgent(pill({ classes: ['chip', 'ok'] }), 'level'), false);
  });

  it('when a CHILD of the pill carries the level, because several fields band '
    + 'the value and not the field', () => {
    assert.equal(isUrgent(pill({ classes: ['ufield'], inner: ['critical'] }), 'level'), true);
  });

  it('when the builder set data-u, which is how a disclosure with no band to '
    + 'carry it gets one', () => {
    // The doctor count above zero, an unavailable myctx share, an injection
    // figure nobody could count. None of the three is a LEVEL — a count of
    // findings is not a hue — so no sixth meaning is spent to mark them.
    assert.equal(isUrgent(pill({ f: 'doctor-notices', u: '1' }), 'level'), true);
  });

  it('always, for a field its own code draws only when there is something to '
    + 'disclose', () => {
    // The review queue is silent at zero, the ask verdict below its band, the
    // rate verdict while both windows are calm. Presence IS the disclosure.
    assert.equal(isUrgent(pill({ f: 'review-queue' }), 'presence'), true);
  });

  it('never, for a pill that is not there', () => {
    assert.equal(isUrgent(null, 'level'), false);
  });
});

describe('the table that declares all of it', () => {
  it('names every key exactly once', () => {
    const keys = STRIP_PICK.map((e) => e.key);
    assert.equal(new Set(keys).size, keys.length, 'a duplicate key is two rows for one name');
  });

  it('spends a label key that exists in BOTH string tables', () => {
    // A row with no label prints an id at a reader, in one language.
    const en = readFileSync(path.join(REPO, 'src/ui/public/strings/en.js'), 'utf8');
    const he = readFileSync(path.join(REPO, 'src/ui/public/strings/he.js'), 'utf8');
    for (const entry of STRIP_PICK) {
      assert.ok(en.includes(`'${entry.label}':`), `en.js has no ${entry.label}`);
      assert.ok(he.includes(`'${entry.label}':`), `he.js has no ${entry.label}`);
    }
  });

  it('spends a label key for every sentence the dialog itself prints', () => {
    const en = readFileSync(path.join(REPO, 'src/ui/public/strings/en.js'), 'utf8');
    const he = readFileSync(path.join(REPO, 'src/ui/public/strings/he.js'), 'utf8');
    for (const key of [
      'strip.pick.h', 'strip.pick.close', 'strip.pick.cost', 'strip.pick.clipped',
      'strip.pick.forced', 'strip.pick.canReturn', 'strip.pick.promise', 'strip.pick.never',
      'strip.pick.stored', 'strip.pick.reset', 'title.stripCanReturn',
      'strip.pick.identity', 'strip.pick.state',
    ]) {
      assert.ok(en.includes(`'${key}':`), `en.js has no ${key}`);
      assert.ok(he.includes(`'${key}':`), `he.js has no ${key}`);
    }
  });

  it('names no group the stylesheet does not paint', () => {
    // A group heading with no `.sgrp-` behind it is a heading over nothing.
    const css = readFileSync(path.join(REPO, 'src/ui/public/styles.css'), 'utf8');
    for (const group of new Set(STRIP_PICK.map((e) => e.group))) {
      assert.ok(css.includes(`.sgrp-${group}`), `styles.css declares no .sgrp-${group}`);
    }
  });

  it('names no key app.js cannot draw', () => {
    // A ghost row offers the reader a field that is not on the bar. Every key
    // is either a field id `app.js` writes, or a strip NAME it prints.
    const app = readFileSync(path.join(REPO, 'src/ui/public/app.js'), 'utf8');
    for (const entry of STRIP_PICK) {
      const asField = app.includes(`field: '${entry.key}'`)
        || app.includes(`dataset.f = '${entry.key}'`);
      const asName = app.includes(`'strip.grp.${entry.key}'`);
      assert.ok(asField || asName,
        `app.js draws neither a field nor a name called ${entry.key}`);
    }
  });

  it('groups in bar order, derived from the table rather than listed twice', () => {
    const groups = pickGroups().map((g) => g.key);
    assert.deepEqual(groups,
      ['repo', 'model', 'window', 'corpus', 'where', 'limits', 'session', 'cost', 'audit']);
    assert.equal(groups.length, new Set(groups).size);
  });

  it('names the fields that can never force themselves back, and every one of '
    + 'them really has no urgency rule', () => {
    // This list is PRINTED in the dialog. A name in it that could in fact
    // return would be the dialog promising silence it cannot keep — and a name
    // missing from it would be the opposite, a field the reader thinks is gone
    // for good reappearing.
    const named = neverForced();
    assert.ok(named.length > 0, 'a floor: an empty list would make this vacuous');
    for (const key of named) {
      assert.equal(STRIP_PICK.find((e) => e.key === key)?.urgency, null);
    }
    for (const entry of STRIP_PICK) {
      if (entry.urgency === null) assert.ok(named.includes(entry.key));
    }
  });

  it('declares only the three urgency answers, so a fourth cannot arrive '
    + 'unnoticed', () => {
    for (const entry of STRIP_PICK) {
      assert.ok([null, 'level', 'presence'].includes(entry.urgency),
        `${entry.key} declares ${String(entry.urgency)}`);
    }
  });

  it('puts every entry in one of the bar\'s two subjects, and leaves neither '
    + 'column empty', () => {
    // The dialog's two columns ARE `fitStrip`'s two subjects — the owner's
    // 2026-09-01 split — so a third value, or an empty side, would be a column
    // that says something false about the bar it configures.
    for (const entry of STRIP_PICK) {
      assert.ok(['identity', 'state'].includes(entry.subject),
        `${entry.key} is in subject ${String(entry.subject)}`);
    }
    const columns = pickColumns();
    assert.deepEqual(columns.map((c) => c.subject), ['identity', 'state']);
    for (const column of columns) {
      assert.ok(column.groups.length > 0, `the ${column.subject} column is empty`);
    }
    // And every group is in exactly ONE column: a group split across both
    // would draw its heading twice with half its fields under each.
    const placed = columns.flatMap((c) => c.groups.map((g) => g.key));
    assert.equal(placed.length, new Set(placed).size);
    assert.equal(placed.length, pickGroups().length);
  });
});
