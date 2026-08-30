/**
 * **The way THROUGH a bounded list** — `boundedList`'s paging control.
 *
 * `REQ-a-bounded-list-gives-the-reader-a-way-to-reach-what-it-held`, from the
 * owner on 2026-08-27: *"we defined that we are listing a limited number of
 * records, that works but i could not find a button or a different control that
 * let the user get the next or the previous batch of records"*. Declaring the
 * bound was necessary and it was never sufficient — a list that says "20 of
 * 2,076" and offers no way to reach the other 2,056 has told the truth and left
 * the reader stuck.
 *
 * ── WHY THIS FILE TESTS DOM GLUE, WHICH IS THE STATED UNTESTED SURFACE ────
 *
 * `screens/parts.js`' own header names itself untested glue, and it is right
 * about `el`, `mono` and `tierChip`: nothing there can be DECIDED. The paging
 * control is not that. **Which rows a page holds is a decision**, it is
 * different for the two `take` modes, and getting it backwards on a `take:
 * 'last'` list silently shows the WRONG END of an append-only log under a
 * sentence promising the other one. That is the same class of defect the slice
 * comment in `boundedList` already exists to prevent — "a sample presented as a
 * summary" — and a comment is not a gate.
 *
 * The decision therefore lives in two exported PURE functions, `pageWindow` and
 * `pageStep`, which need no document at all; the tests below drive those
 * directly. The remaining tests drive the real `boundedList` against a stand-in
 * document, because four of the requirement's five conditions are statements
 * about what is DRAWN — a list holding back nothing must draw no control, the
 * line must say where the reader is, the move must be announced, and the
 * controls must be operable from a keyboard.
 *
 * **The decision was not moved to `lib/viewmodel.js`, where this project
 * usually puts decidable things.** That file is held by another agent for the
 * duration of this task, and splitting one twelve-line window calculation
 * across two files to satisfy a filing convention would put the slice and the
 * sentence that describes it in different modules — which is exactly how they
 * come to disagree. Recorded here rather than left for someone to wonder about.
 *
 * ── THE STAND-IN DOCUMENT ─────────────────────────────────────────────────
 *
 * `test/ui/pane-route.test.ts`' factory, cut down to what `boundedList` and
 * `lib/i18n.js`'s `t()` actually touch, plus `disabled` and `focus()` — the two
 * `boundedList` gained with this control and nothing else in the product uses.
 * Deliberately no more: a fuller fake invites assertions this file has no
 * business making.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const PARTS = new URL('../../src/ui/public/screens/parts.js', import.meta.url).href;
const I18N = new URL('../../src/ui/public/lib/i18n.js', import.meta.url).href;
const EN = new URL('../../src/ui/public/strings/en.js', import.meta.url).href;
const HE = new URL('../../src/ui/public/strings/he.js', import.meta.url).href;

/* ══ THE STAND-IN DOCUMENT ═══════════════════════════════════════════════ */

interface FakeNode {
  tag: string;
  className: string;
  textContent: string;
  type: string;
  hidden: boolean;
  disabled: boolean;
  children: FakeNode[];
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  listeners: Record<string, (() => void)[]>;
  style: { setProperty: (name: string, value: string) => void };
  append: (...nodes: (FakeNode | string)[]) => void;
  replaceChildren: (...nodes: (FakeNode | string)[]) => void;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  addEventListener: (type: string, fn: () => void) => void;
  focus: () => void;
}

interface FakeDoc {
  createElement: (tag: string) => FakeNode;
  createTextNode: (text: string) => FakeNode;
  /** Every `focus()` call, newest last. Focus is a behaviour, so it is recorded. */
  focusLog: FakeNode[];
}

function fakeDoc(): FakeDoc {
  const focusLog: FakeNode[] = [];
  const createElement = (tag: string): FakeNode => {
    const node: FakeNode = {
      tag,
      className: '',
      textContent: '',
      type: '',
      hidden: false,
      disabled: false,
      children: [],
      dataset: {},
      attributes: {},
      listeners: {},
      style: { setProperty: (): void => {} },
      append: (...nodes: (FakeNode | string)[]): void => {
        for (const child of nodes) {
          node.children.push(typeof child === 'string' ? createTextNode(child) : child);
        }
      },
      replaceChildren: (...nodes: (FakeNode | string)[]): void => {
        node.children.length = 0;
        node.append(...nodes);
      },
      setAttribute: (name: string, value: string): void => { node.attributes[name] = value; },
      getAttribute: (name: string): string | null => node.attributes[name] ?? null,
      addEventListener: (type: string, fn: () => void): void => {
        (node.listeners[type] ??= []).push(fn);
      },
      focus: (): void => { focusLog.push(node); },
    };
    return node;
  };
  const createTextNode = (text: string): FakeNode => {
    const node = createElement('#text');
    node.textContent = text;
    return node;
  };
  return { createElement, createTextNode, focusLog };
}

/** The rendered text of a node and everything under it. */
function text(node: FakeNode): string {
  if (node.children.length === 0) return node.textContent;
  return node.children.map(text).join('');
}

/** Fire every `click` listener, which is what Enter and Space fire too. */
function click(node: FakeNode): void {
  for (const fn of node.listeners['click'] ?? []) fn();
}

/** Every descendant, document order, text nodes excluded. */
function descendants(root: FakeNode): FakeNode[] {
  const out: FakeNode[] = [];
  for (const child of root.children) {
    if (child.tag === '#text') continue;
    out.push(child, ...descendants(child));
  }
  return out;
}

/* ══ THE MODULES ═════════════════════════════════════════════════════════ */

interface Spec {
  cap: number;
  order?: 'recent' | 'admitted' | 'considered';
  take?: 'last';
  displayOnly?: boolean;
}

interface PartsModule {
  BOUND_CAP_LIST: number;
  BOUND_CAP_TABLE: number;
  pageWindow: (total: number, cap: number, page: number, take?: string)
  => { start: number; end: number; page: number; pages: number; before: number; after: number };
  pageStep: (page: number, pages: number, take: string | undefined, direction: string)
  => number | null;
  boundedList: (
    ctx: unknown, host: unknown, items: unknown[],
    draw: (item: unknown, i: number) => unknown, spec: Spec,
  ) => FakeNode;
  errorNote: (message: unknown, ctx?: unknown) => FakeNode;
}

type Strings = Record<string, string>;
type Renderer = (strings: Strings, key: string, subs: Record<string, unknown>, doc: unknown)
=> unknown[];

/**
 * `parts.js` with a stand-in document installed globally.
 *
 * `el()` reads the bare global `document` at CALL time rather than at import
 * time, so one import serves every test and the global is set per call. The
 * module is imported once by Node's own cache either way; pretending otherwise
 * with a `data:` URL per test would only hide that.
 */
async function parts(doc: FakeDoc): Promise<PartsModule> {
  (globalThis as Record<string, unknown>)['document'] = doc;
  return (await import(PARTS)) as unknown as PartsModule;
}

/** A `ctx` with the one method `boundedList` uses, over a real string table. */
async function context(doc: FakeDoc, language: 'en' | 'he' = 'en'): Promise<{
  t: (key: string, subs?: Record<string, unknown>) => unknown[];
}> {
  const { t } = (await import(I18N)) as unknown as { t: Renderer };
  const { strings } = (await import(language === 'en' ? EN : HE)) as unknown as
    { strings: Strings };
  return { t: (key, subs = {}) => t(strings, key, subs, doc) };
}

/** `n` rows, each one a `<div>` carrying its own ordinal so a slice is legible. */
function rows(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `row-${i + 1}`);
}

/** Build a bound line over `items`, and hand back everything a test reads. */
async function render(items: string[], spec: Spec, language: 'en' | 'he' = 'en'): Promise<{
  doc: FakeDoc;
  host: FakeNode;
  bound: FakeNode;
  line: FakeNode;
  buttons: FakeNode[];
  shown: () => string[];
}> {
  const doc = fakeDoc();
  const { boundedList } = await parts(doc);
  const ctx = await context(doc, language);
  const host = doc.createElement('div');
  const bound = boundedList(ctx, host, items, (item) => {
    const row = doc.createElement('div');
    row.textContent = String(item);
    return row;
  }, spec);
  const line = bound.children.find((c) => c.tag === 'p');
  assert.ok(line !== undefined, 'the bound line is still a <p>; every test below reads it');
  return {
    doc,
    host,
    bound,
    line,
    buttons: bound.children.filter((c) => c.tag === 'button'),
    shown: (): string[] => host.children.map((c) => c.textContent),
  };
}

/** The paging button whose `data-step` says which way it goes. */
function stepButton(bound: FakeNode, step: 'prev' | 'next'): FakeNode | undefined {
  return descendants(bound).find((n) => n.tag === 'button' && n.dataset['step'] === step);
}

/* ══ THE DECISION, WITH NO DOCUMENT ANYWHERE NEAR IT ═════════════════════ */

test('pageWindow walks a take-first list from its head, and its last page is the remainder', async () => {
  const { pageWindow } = await parts(fakeDoc());
  // 47 items, cap 20 — the preview's own shape (`BOUND_CAP_LIST`).
  assert.deepEqual(pageWindow(47, 20, 0, undefined),
    { start: 0, end: 20, page: 0, pages: 3, before: 0, after: 27 });
  assert.deepEqual(pageWindow(47, 20, 1, undefined),
    { start: 20, end: 40, page: 1, pages: 3, before: 20, after: 7 });
  assert.deepEqual(pageWindow(47, 20, 2, undefined),
    { start: 40, end: 47, page: 2, pages: 3, before: 40, after: 0 });
});

test('pageWindow walks a take-last list from its TAIL, and its last page is the OLDEST remainder', async () => {
  const { pageWindow } = await parts(fakeDoc());
  // The whole of the `take: 'last'` ruling in one assertion: page 0 is the END
  // of an append-only log, and the SHORT page is at the old end, not the new
  // one. A window that put the remainder at the tail would drop the four
  // newest revisions off the opening page of the review queue.
  assert.deepEqual(pageWindow(47, 20, 0, 'last'),
    { start: 27, end: 47, page: 0, pages: 3, before: 27, after: 0 });
  assert.deepEqual(pageWindow(47, 20, 1, 'last'),
    { start: 7, end: 27, page: 1, pages: 3, before: 7, after: 20 });
  assert.deepEqual(pageWindow(47, 20, 2, 'last'),
    { start: 0, end: 7, page: 2, pages: 3, before: 0, after: 40 });
});

test('pageWindow clamps rather than inventing a page nobody can be on', async () => {
  const { pageWindow } = await parts(fakeDoc());
  assert.deepEqual(pageWindow(12, 20, 0, undefined),
    { start: 0, end: 12, page: 0, pages: 1, before: 0, after: 0 });
  assert.equal(pageWindow(47, 20, 9, undefined).page, 2);
  assert.equal(pageWindow(47, 20, -3, 'last').page, 0);
  // An EMPTY list is one page of nothing, never zero pages: `STD-a-measured-
  // zero-is-drawn` governs the empty end, and a `pages: 0` would make every
  // step below return null for a reason no reader could see.
  assert.deepEqual(pageWindow(0, 20, 0, undefined),
    { start: 0, end: 0, page: 0, pages: 1, before: 0, after: 0 });
});

test('a step is a direction in the LIST, and take-last reverses the page index', async () => {
  const { pageStep } = await parts(fakeDoc());
  // "Next" always means HIGHER row numbers and "Previous" always means lower
  // ones, in both modes. That is one vocabulary for the reader; the page INDEX
  // is what has to flip, because a take-last list counts its pages from the
  // end. Reverse this and "Previous" on the review queue shows the wrong end
  // of an append-only log while the sentence beside it reads correctly.
  assert.equal(pageStep(0, 3, undefined, 'next'), 1);
  assert.equal(pageStep(1, 3, undefined, 'prev'), 0);
  assert.equal(pageStep(0, 3, undefined, 'prev'), null, 'nothing sits before the first page');
  assert.equal(pageStep(2, 3, undefined, 'next'), null, 'nothing sits after the last page');

  assert.equal(pageStep(0, 3, 'last', 'prev'), 1, 'PREVIOUS on an append-only log means OLDER');
  assert.equal(pageStep(1, 3, 'last', 'next'), 0, 'NEXT on an append-only log means NEWER');
  assert.equal(pageStep(0, 3, 'last', 'next'), null, 'page 0 already holds the newest rows');
  assert.equal(pageStep(2, 3, 'last', 'prev'), null, 'the last page already holds the oldest');
});

/* ══ CONDITION 3 — A LIST HOLDING BACK NOTHING DRAWS NO CONTROL ══════════ */

test('a list that holds back nothing draws no paging control at all', async () => {
  const { bound, line, shown } = await render(rows(12), { cap: 20, order: 'admitted' });
  assert.deepEqual(shown(), rows(12), 'all twelve are drawn');
  assert.equal(text(line), 'Showing all 12.');
  // Not `hidden`, and not `disabled` — ABSENT. "An inert control is the same
  // lie as a blank screen" is the requirement's own wording, and a hidden
  // button is still a node an assertion can find and a reader cannot.
  assert.equal(stepButton(bound, 'prev'), undefined);
  assert.equal(stepButton(bound, 'next'), undefined);
});

test('an empty list draws no paging control either, and still says so', async () => {
  const { bound, line } = await render([], { cap: 20, order: 'admitted' });
  assert.equal(text(line), 'Showing all 0.');
  assert.equal(stepButton(bound, 'prev'), undefined);
  assert.equal(stepButton(bound, 'next'), undefined);
});

/* ══ CONDITIONS 1 AND 2 — FORWARD AND BACK, AND WHERE YOU ARE ═══════════ */

test('a capped take-first list opens on its head with Previous refused', async () => {
  const { bound, line, shown } = await render(rows(47), { cap: 20, order: 'admitted' });
  assert.deepEqual(shown(), rows(20));
  // The opening sentence is UNCHANGED. "Showing the first 20 of 47, in the
  // order the selector admitted them" is already a position, and it carries
  // the ORDER ruling that the row-numbered sentence has to shorten.
  assert.equal(text(line), 'Showing the first 20 of 47, in the order the selector admitted them.');
  const prev = stepButton(bound, 'prev');
  const next = stepButton(bound, 'next');
  assert.ok(prev !== undefined && next !== undefined, 'a capped list draws both controls');
  assert.equal(prev.disabled, true, 'nothing sits before the first page');
  assert.equal(next.disabled, false);
});

/**
 * The THIRD order, added 2026-08-28 with the preview's spilled-items list.
 *
 * It exists because both older sentences say something FALSE under a list of
 * items that did not arrive: `admitted` puts the one word that card exists to
 * contradict under every row of it, and `recent` claims a time a computation
 * never happened at. What is true of a spill is the order the selector
 * CONSIDERED it in, which is also load-bearing — first-fit admits greedily, so
 * that order is what decides which item spills.
 *
 * Both states are asserted, opening page and paged, because `rowsKeyFor` is a
 * second table and a third order added to one and not the other reads as an
 * admitted list the moment the reader presses Next.
 */
test('a considered list says considered — on its opening page and on a later one', async () => {
  const { bound, line } = await render(rows(47), { cap: 20, order: 'considered' });
  assert.equal(
    text(line), 'Showing the first 20 of 47, in the order the selector considered them.',
    'these rows were not admitted — that is the whole subject of the card that draws them',
  );
  click(stepButton(bound, 'next')!);
  assert.equal(
    text(line), 'Rows 21–40 of 47, in the order the selector considered them. '
    + '20 before this page, 7 after it.',
  );
});

test('Next says WHERE the reader is, on both sides, the way /api/coverage reports a page', async () => {
  const { bound, line, shown } = await render(rows(47), { cap: 20, order: 'admitted' });
  click(stepButton(bound, 'next')!);

  assert.deepEqual(shown(), rows(40).slice(20), 'rows 21 through 40, in their original order');
  // Condition 2: *"20 of 2,076" is a fact; "rows 21-40 of 2,076" is a
  // position.* And the second sentence is `/api/coverage`'s own reading —
  // `omitted` there "counts every matching path this answer does not carry —
  // the ones `offset` skipped as well as the ones past `limit`" — reported on
  // BOTH sides so the two surfaces are not two different ideas.
  assert.match(text(line), /Rows 21–40 of 47/);
  assert.match(text(line), /20 before this page, 7 after it\./);
});

test('Next then Previous returns the reader to the rows they left', async () => {
  const { bound, line, shown } = await render(rows(47), { cap: 20, order: 'admitted' });
  const next = stepButton(bound, 'next')!;
  const prev = stepButton(bound, 'prev')!;

  click(next);
  click(next);
  assert.deepEqual(shown(), rows(47).slice(40), 'the last page is the seven-row remainder');
  assert.match(text(line), /Rows 41–47 of 47/);
  assert.equal(next.disabled, true, 'nothing sits after the last page');

  click(prev);
  assert.deepEqual(shown(), rows(40).slice(20));
  click(prev);
  assert.deepEqual(shown(), rows(20), 'a reader who stepped past what they wanted got back');
  assert.equal(text(line), 'Showing the first 20 of 47, in the order the selector admitted them.');
});

/* ══ take: 'last' — PREVIOUS MEANS OLDER ════════════════════════════════ */

test('a take-last list opens on its NEWEST rows with Next refused', async () => {
  const { bound, line, shown } = await render(rows(120), { cap: 50, order: 'recent', take: 'last' });
  assert.deepEqual(shown(), rows(120).slice(70), 'the last fifty, in the log\'s own order');
  assert.equal(text(line), 'Showing the 50 most recent of 120.');
  assert.equal(stepButton(bound, 'next')!.disabled, true, 'page 0 already holds the newest');
  assert.equal(stepButton(bound, 'prev')!.disabled, false);
});

test('on a take-last list PREVIOUS shows OLDER rows, and the sentence agrees with the slice', async () => {
  const { bound, line, shown } = await render(rows(120), { cap: 50, order: 'recent', take: 'last' });
  const prev = stepButton(bound, 'prev')!;
  const next = stepButton(bound, 'next')!;

  // **THE ONE THAT CATCHES THE DIRECTION BEING REVERSED.** `packs`, `work` and
  // `injected` all read append-only logs, so the rows BEFORE the opening page
  // are the OLDER ones. A control that answered "previous" with a higher slice
  // would show the wrong end of the log under a sentence naming the right one
  // — a sample presented as a summary, which is the defect `boundedList`'s own
  // slice comment exists to prevent.
  click(prev);
  assert.deepEqual(shown(), rows(70).slice(20), 'rows 21-70: the fifty older than the opening page');
  assert.match(text(line), /Rows 21–70 of 120/);
  assert.match(text(line), /20 before this page, 50 after it\./);
  assert.equal(next.disabled, false, 'there are newer rows to go back to now');

  click(prev);
  assert.deepEqual(shown(), rows(20), 'the OLDEST page is the short one, at the head of the log');
  assert.match(text(line), /Rows 1–20 of 120/);
  assert.equal(prev.disabled, true, 'nothing is older than the head of the log');

  click(next);
  assert.deepEqual(shown(), rows(70).slice(20), 'Next walks back towards the newest');
  click(next);
  assert.deepEqual(shown(), rows(120).slice(70));
  assert.equal(text(line), 'Showing the 50 most recent of 120.');
});

/* ══ THE ONE THING NOT TO LOSE — displayOnly ════════════════════════════ */

test('a display cap keeps saying it is a display cap on EVERY page', async () => {
  const { bound, line } = await render(rows(47),
    { cap: 20, order: 'admitted', displayOnly: true });

  const promise = 'A display limit. All 47 were in the injection — none were dropped.';
  assert.ok(text(line).endsWith(promise), `the opening page carries it: ${text(line)}`);

  // The reason `displayOnly` exists is that "showing 20 of 47" would otherwise
  // read as "you were given 20" on the one screen whose promise is *exactly
  // what Claude gets*. "Rows 21-40 of 47" reads that way just as readily —
  // more so, because a page number is what a reader has learned means "the
  // rest is elsewhere". Moving through a DISPLAY cap is not moving through
  // what was delivered, and the sentence has to keep saying so.
  const next = stepButton(bound, 'next')!;
  click(next);
  assert.match(text(line), /Rows 21–40 of 47/);
  assert.ok(text(line).endsWith(promise), `page 2 carries it too: ${text(line)}`);
  click(next);
  assert.ok(text(line).endsWith(promise), `the last page carries it too: ${text(line)}`);
});

test('a list that is NOT a display cap never claims to be one', async () => {
  const { bound, line } = await render(rows(120), { cap: 50, order: 'recent', take: 'last' });
  click(stepButton(bound, 'prev')!);
  assert.ok(!text(line).includes('display limit'),
    'the injected, packs and work lists ARE bounded selections of a record; saying "none were '
    + 'dropped" there would be the opposite lie');
});

/* ══ CONDITION 4 — KEYBOARD, AND THE ANNOUNCEMENT ═══════════════════════ */

test('the bound line is a polite live region, so a move is announced to a reader who cannot see it', async () => {
  const { line } = await render(rows(47), { cap: 20, order: 'admitted' });
  // The line ALREADY says where the reader is and is rewritten wholesale on
  // every move, so it is the announcement — a second visually-hidden region
  // would say the same words twice and need a CSS rule this task may not add.
  assert.equal(line.getAttribute('aria-live'), 'polite');
});

test('the controls are real buttons of type=button, which is the whole of keyboard support', async () => {
  const { bound } = await render(rows(47), { cap: 20, order: 'admitted' });
  for (const step of ['prev', 'next'] as const) {
    const b = stepButton(bound, step)!;
    assert.equal(b.tag, 'button', `${step} must be a real button — Enter and Space come free`);
    assert.equal(b.type, 'button',
      `${step} must not be a submit button; every one of these lists can sit inside a form`);
  }
});

test('a control that goes inert hands its focus to the one that is still live', async () => {
  const { bound, doc } = await render(rows(47), { cap: 20, order: 'admitted' });
  const next = stepButton(bound, 'next')!;
  const prev = stepButton(bound, 'prev')!;

  click(next);
  click(next);
  // `disabled` was chosen over `aria-disabled` because a disabled button is
  // honestly out of the tab order and needs no handler that quietly does
  // nothing. What that costs is FOCUS: a keyboard reader pressing Enter until
  // the last page loses it to the document. Weighed against `aria-disabled`,
  // which keeps focus but leaves a focusable control that answers nothing —
  // the inert control the requirement names. So the button hands focus on.
  assert.equal(next.disabled, true);
  assert.equal(doc.focusLog.at(-1), prev,
    'focus was dropped on the floor when Next went inert; a keyboard reader is left nowhere');

  click(prev);
  click(prev);
  assert.equal(prev.disabled, true);
  assert.equal(doc.focusLog.at(-1), next);
});

/* ══ SHOW ALL STILL WORKS, AND PAGING GETS OUT OF ITS WAY ═══════════════ */

test('Show all draws everything and withdraws the paging controls while it does', async () => {
  const { bound, line, shown } = await render(rows(47), { cap: 20, order: 'admitted' });
  const showAll = bound.children.find((c) => c.tag === 'button' && c.dataset['step'] === undefined);
  assert.ok(showAll !== undefined, 'the existing Show all control is still there');
  assert.equal(text(showAll), 'Show all 47');

  click(showAll);
  assert.deepEqual(shown(), rows(47));
  assert.equal(text(line), 'Showing all 47.');
  // A page control beside a list showing everything says there is somewhere
  // else to be, and there is not.
  assert.equal(stepButton(bound, 'prev')!.hidden, true);
  assert.equal(stepButton(bound, 'next')!.hidden, true);

  click(showAll);
  assert.deepEqual(shown(), rows(20), 'Show fewer returns the reader to the page they were on');
  assert.equal(stepButton(bound, 'next')!.hidden, false);
});

test('Show fewer returns to the page the reader was on, not to the first one', async () => {
  const { bound, shown } = await render(rows(47), { cap: 20, order: 'admitted' });
  click(stepButton(bound, 'next')!);
  const showAll = bound.children.find((c) => c.tag === 'button' && c.dataset['step'] === undefined)!;
  click(showAll);
  assert.deepEqual(shown(), rows(47));
  click(showAll);
  // Sending the reader back to page 1 would be a move they did not ask for,
  // and the announcement would tell them about it — which is worse than not
  // moving at all.
  assert.deepEqual(shown(), rows(40).slice(20));
});

/* ══ BOTH LANGUAGES DRAW IT ═════════════════════════════════════════════ */

test('the Hebrew table draws the same control with no key left in English', async () => {
  const { bound, line } = await render(rows(47), { cap: 20, order: 'admitted' }, 'he');
  click(stepButton(bound, 'next')!);
  const said = text(line);
  assert.match(said, /שורות/, 'the Hebrew position sentence rendered');
  assert.match(said, /21–40/);
  assert.ok(!/[A-Za-z]/.test(said.replace(/[‎‏]/g, '')),
    `a Latin run survived in the Hebrew bound line, which means a key fell back: ${said}`);
  for (const step of ['prev', 'next'] as const) {
    const label = text(stepButton(bound, step)!);
    assert.ok(label.trim() !== '' && !/[A-Za-z]/.test(label),
      `the Hebrew ${step} control is untranslated: ${JSON.stringify(label)}`);
  }
});

/* ══ THE SIMULATOR'S RANGE STORE ═════════════════════════════════════════
   `TASK-the-slider-s-range-has-its-own-control-and-raising-a-budget` put one
   number in this module because three screens have to agree about it: the
   simulator sets it (`sliderMaxFor`'s fourth term), Configure raises it when a
   budget write goes past it, and the injection preview draws its ribbon to it.

   It is checked HERE, beside `boundedList`, for the reason this file exists at
   all — `screens/parts.js` calls itself untested glue, and these three
   functions are not glue: they are the arithmetic of a shared decision, and a
   wrong answer from any of them is a wrong bound on a control or a ribbon drawn
   to a scale nobody set. No document is needed for any of it. ══ */

interface RangeStore {
  simRangeFor: (tier: string) => number | null;
  setSimRange: (tier: string, max: number | null) => void;
  raiseSimRange: (tier: string, atLeast: number) => void;
}

/** The store, plus a clean slate: the module is a singleton, as it is in a page. */
async function store(tier: string): Promise<RangeStore> {
  const parts = (await import(PARTS)) as unknown as RangeStore;
  parts.setSimRange(tier, null);
  return parts;
}

test('an unset range is null, and null is not zero', async () => {
  const { simRangeFor } = await store('range-a');
  // `null` means "the simulator's derived default is in force", which is a
  // different fact from "the range is nothing" — the same distinction
  // `screens/simulate.js` draws between `rungs === null` and `rungs === []`.
  assert.equal(simRangeFor('range-a'), null);
});

test('only a positive integer is a range — everything else reads as unset', async () => {
  const parts = await store('range-b');
  for (const bad of [0, -3, 1.5, Number.NaN, null]) {
    parts.setSimRange('range-b', bad as number | null);
    assert.equal(parts.simRangeFor('range-b'), null, `${String(bad)} was accepted as a range`);
  }
  parts.setSimRange('range-b', 40_000);
  assert.equal(parts.simRangeFor('range-b'), 40_000);
});

test('raiseSimRange only ever raises, and never invents a range nobody set', async () => {
  const parts = await store('range-c');

  // Nothing set: nothing to raise. The simulator's derived bound already
  // carries the budget in force as one of its own terms, so writing here would
  // invent a decision the reader never made.
  parts.raiseSimRange('range-c', 9_000);
  assert.equal(parts.simRangeFor('range-c'), null);

  parts.setSimRange('range-c', 10_000);

  // A budget written on Configure ABOVE the range carries the range up with it:
  // "raising a budget past the limit raises the limit", performed from the
  // other screen. This is what keeps the two from ever disagreeing about what
  // the slider can reach.
  parts.raiseSimRange('range-c', 25_000);
  assert.equal(parts.simRangeFor('range-c'), 25_000);

  // A budget LOWERED leaves the range where the reader put it. Narrowing
  // somebody's chosen range because a number moved underneath them is the
  // "maximum that silently moves while you drag" the design refuses.
  parts.raiseSimRange('range-c', 400);
  assert.equal(parts.simRangeFor('range-c'), 25_000);

  parts.setSimRange('range-c', null);
});


/* ══ THE REFUSAL NOTE ════════════════════════════════════════════════════ *
 *
 * `errorNote` is the ONE renderer every server refusal on every screen in this
 * UI passes through, and until 2026-08-30 it drew the endpoint's English with
 * no word of its own around it — so a reader in Hebrew met English at the exact
 * moment something had gone wrong. The reason recorded in the function's own
 * docstring was that a key the design of record does not declare fails
 * `test/ui/strings-parity.test.ts`; that direction was dropped on 2026-08-26
 * and the paragraph outlived it by three days on fifteen modules.
 *
 * Both halves are asserted here, because the fix is worth nothing if either
 * fails: the FRAME must change language, and the MESSAGE inside it must not.
 */

test('errorNote wraps the message in err.note, and the message survives verbatim', async () => {
  const doc = fakeDoc();
  const { errorNote } = await parts(doc);
  const ctx = await context(doc);

  const note = errorNote('the index is out of date', ctx);
  assert.equal(note.tag, 'p');
  assert.equal(note.className, 'small spill', 'the refusal is still .spill (--crit)');
  assert.match(text(note), /^Refused\./, 'the frame is the product own word');
  assert.ok(
    text(note).includes('the index is out of date'),
    'the endpoint own sentence must reach the page unedited — the frame says it is '
    + 'untranslated precisely so that it can be',
  );
});

test('the frame changes language and the message does not — which is the whole point', async () => {
  const doc = fakeDoc();
  const { errorNote } = await parts(doc);

  const english = text(errorNote('boom', await context(doc, 'en')));
  const hebrew = text(errorNote('boom', await context(doc, 'he')));

  assert.notEqual(hebrew, english, 'the refusal frame did not change language');
  assert.ok(/[֐-׿]/.test(hebrew), 'the Hebrew frame drew no Hebrew');
  assert.ok(!/[֐-׿]/.test(english), 'the English frame drew Hebrew');
  for (const rendered of [english, hebrew]) {
    assert.ok(rendered.includes('boom'), 'the message must be identical in both languages');
  }
});

/**
 * **The fallback, and why it is not a second wording.**
 *
 * `ctx` defaults to `globalThis.myctx`, which the shell publishes and
 * `node --test` does not. With no shell there is no table to draw from, so the
 * message is drawn BARE — exactly what shipped before the key existed, which is
 * never worse than it. Asserted so that a caller which loses its context
 * degrades to the old behaviour instead of to a thrown key lookup on a screen
 * that is already reporting a failure.
 */
test('with no ctx at all the message is drawn bare rather than throwing', async () => {
  const doc = fakeDoc();
  const { errorNote } = await parts(doc);
  assert.equal(text(errorNote('bare', undefined)), 'bare');
  assert.equal(text(errorNote(null, undefined)), '', 'a null message is empty, not "null"');
});
