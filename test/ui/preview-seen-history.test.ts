/**
 * **The two facts the injection preview could not draw**, and the screen module
 * that draws them.
 *
 *  1. `/api/simulate`'s `seenFiltered` — the ids `select` removed at rung 5,
 *     the `seen` gate. Until 2026-08-29 that removal rode on no response at all,
 *     so the preview drew *Delivered N · Not delivered 0* with everything the
 *     gate had taken accounted for nowhere on the screen.
 *  2. `/api/injection-history` — when each item last really was delivered and
 *     last really did spill, out of the audit projection.
 *
 * ── WHAT THIS FILE CAN AND CANNOT PROVE, SAID FIRST ───────────────────────
 *
 * It proves the READ MODEL: what the two endpoints answer, over a real
 * workspace built by the real CLI, with a real seen file and real audit
 * records. It proves the SCREEN only structurally — that every string key
 * `preview.js` names is declared in both tables with its slots supplied, which
 * is the check every other screen in this product has and this one did not.
 *
 * It does NOT prove that the screen draws them. That is a browser fact and it
 * belongs in a browser: `e2e/preview-spilled.spec.ts` drives a warm session and
 * a cold one and compares what is on screen against what the endpoints answered.
 * The defect being closed here was invisible to every unit test in this
 * repository for exactly that reason — **every fixture in the suite is a cold
 * corpus**, and the cold answer is the one the screen was already asking for.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { recordAudit } from '../../src/core/audit.ts';
import { readFocus } from '../../src/core/focus.ts';
import { appendSeen, readSeen, seenIds } from '../../src/core/seen-file.ts';
import { Store } from '../../src/core/store.ts';
import { isNormative, select } from '../../src/core/select.ts';
import { resolveWorkspace, type Workspace } from '../../src/core/workspace.ts';
import { apiSimulate, seenFilteredIds } from '../../src/ui/read-model.ts';
import { apiInjectionHistory, HISTORY_ROW_CAP } from '../../src/ui/preview-history.ts';
import type { Item } from '../../src/core/types.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const url = (endpoint: string, qs = ''): URL =>
  new URL(`http://127.0.0.1:1/api/${endpoint}${qs === '' ? '' : `?${qs}`}`);

interface Fixture { dir: string; ws: Workspace; items: Item[]; done(): void }

/**
 * A workspace with FOUR normative items and one rationale one, built through
 * the real CLI — the same shape `read-model.test.ts`'s fixture takes, for the
 * same reason: a rationale item is the control that keeps `seenFiltered` from
 * passing while it means "anything in the seen file".
 */
function fixture(): Fixture {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-seen-'));
  const run = (args: string[]): void => {
    assert.equal(runCli(args, dir, () => {}), 0, `fixture command failed: ${args.join(' ')}`);
  };
  run(['init']);
  run(['add', 'rule', 'Always use POSIX paths', '--scope', 'src/**', '--tags', 'paths',
    '--body', 'Use POSIX separators everywhere. '.repeat(40), '--yes']);
  run(['add', 'rule', 'Never log the customer email', '--scope', 'src/**',
    '--body', 'Redact the address before it reaches a log sink. '.repeat(40), '--yes']);
  run(['add', 'rule', 'Pin me', '--body', 'Pinned body, long enough to cost real tokens. '
    .repeat(30), '--yes']);
  run(['edit', 'RULE-pin-me', '--always=true', '--yes']);
  run(['add', 'decision', 'We chose sqlite', '--body', 'Rationale body.', '--yes']);

  const ws = resolveWorkspace(dir);
  const store = Store.openReadOnlyChecked(ws.dbPath);
  const items = store.all();
  store.close();
  return { dir, ws, items, done: () => removeTree(dir) };
}

// --- 1 · seenFiltered is select()'s own rung-5 removal -----------------------

/**
 * **The identity that makes the field worth serving**, asserted as an identity
 * rather than as a number: for every item in the corpus, being named in
 * `seenFiltered` is exactly being in `injectable ∩ seen`.
 *
 * The right-hand side is computed here from `select`'s own exported predicates —
 * the same ones the read model imports — so this is not a second copy of the
 * rule agreeing with the first. What it catches is the read model DROPPING one
 * of the four steps: a `seenFiltered` that forgot `isNormative` would name the
 * rationale item, and one that forgot `isEligible` would name a retired one.
 */
test('seenFiltered is exactly the injectable items this session has already been given', () => {
  const f = fixture();
  try {
    const root = f.ws.projectRoot!;
    // A rule the session has been shown, and a DECISION it has also been
    // shown. The decision is rationale-tier, so it never reaches rung 5 at all
    // and must not appear — the control that stops this passing for "anything
    // in the seen file".
    appendSeen(root, 'sess-1', [
      { id: 'RULE-always-use-posix-paths', tier: 'jit', at: '2026-08-20T10:00:00.000Z' },
      { id: 'DEC-we-chose-sqlite', tier: 'jit', at: '2026-08-20T10:00:00.000Z' },
    ]);

    const body = apiSimulate(f.ws, url('simulate', 'event=session-start&session=sess-1')).body as
      { seenFiltered: string[] };
    assert.deepEqual(body.seenFiltered, ['RULE-always-use-posix-paths'],
      'the rule was already delivered and the decision is rationale-tier, so it never reaches '
      + 'the seen gate — a field that named it would be reporting the wrong gate');

    // The identity, over the whole corpus rather than over the one id above.
    const seen = new Set(seenIds(readSeen(root, 'sess-1')));
    const expected = f.items
      .filter((i) => i.status === 'active' && isNormative(i, f.ws.config) && seen.has(i.id))
      .map((i) => i.id);
    assert.deepEqual([...body.seenFiltered].sort(), expected.sort());
  } finally { f.done(); }
});

/**
 * **The behavioural half, and the one that catches drift.**
 *
 * The identity above is a claim about a set. This is a claim about `select`:
 * putting a delivered id into the seen set must move that item OUT of `full`
 * and INTO `seenFiltered`, together. If `select`'s prefix ever changes so that
 * the read model's four steps no longer reproduce `injectable`, the two sides
 * come apart here — an item still delivered while being reported as filtered,
 * or gone from the selection and named nowhere, which is the original defect.
 */
test('an id added to the seen set leaves the selection and arrives in seenFiltered, together', () => {
  const f = fixture();
  try {
    const root = f.ws.projectRoot!;
    const before = select(f.items, { event: 'session-start', focus: null }, f.ws.config);
    const victim = before.full[0]?.item.id;
    assert.ok(victim, 'the cold session start must deliver something, or this measures nothing');

    appendSeen(root, 'sess-2', [{ id: victim, tier: 'pinned', at: '2026-08-20T10:00:00.000Z' }]);
    const qs = 'event=session-start&session=sess-2';
    const body = apiSimulate(f.ws, url('simulate', qs)).body as
      { selection: { full: { item: { id: string } }[] }; seenFiltered: string[] };

    assert.ok(!body.selection.full.some((e) => e.item.id === victim),
      'the item the session has already been given must not be re-delivered');
    assert.ok(body.seenFiltered.includes(victim),
      'and it must be NAMED as removed — an item that leaves the selection and is reported '
      + 'nowhere is the accounting hole this field exists to close');
  } finally { f.done(); }
});

/**
 * `cold=1` is a brand-new window: it has been shown nothing, so the gate removes
 * nothing. A measured zero, and the screen's `preview.seen0` says so in those
 * words rather than leaving the reader to infer it from an absent list.
 */
test('a cold preview filters nothing at the seen gate, however full the seen files are', () => {
  const f = fixture();
  try {
    appendSeen(f.ws.projectRoot!, 'sess-3', [
      { id: 'RULE-pin-me', tier: 'pinned', at: '2026-08-20T10:00:00.000Z' },
    ]);
    const cold = apiSimulate(f.ws, url('simulate', 'event=session-start&cold=1')).body as
      { seenFiltered: string[] };
    assert.deepEqual(cold.seenFiltered, []);
    const warm = apiSimulate(f.ws, url('simulate', 'event=session-start&session=sess-3')).body as
      { seenFiltered: string[] };
    assert.deepEqual(warm.seenFiltered, ['RULE-pin-me'],
      'the same corpus, the same event, only the session parameter differing — if these two '
      + 'agreed the cold control on the screen would be answering the same question twice');
  } finally { f.done(); }
});

/** Focus narrows `injectable`, so it narrows what the seen gate can remove. */
test('a focus that hides an item removes it from seenFiltered — rung 3 runs before rung 5', () => {
  const f = fixture();
  try {
    const root = f.ws.projectRoot!;
    appendSeen(root, 'sess-4', [
      { id: 'RULE-always-use-posix-paths', tier: 'jit', at: '2026-08-20T10:00:00.000Z' },
      { id: 'RULE-never-log-the-customer-email', tier: 'jit', at: '2026-08-20T10:00:00.000Z' },
    ]);
    // `paths` is carried by the first rule only, so a focus on it hides the
    // second — unless the second is exempt, which a plain scoped rule is not.
    assert.equal(runCli(['focus', 'paths'], f.dir, () => {}), 0);
    const ws = resolveWorkspace(f.dir);
    assert.ok(readFocus(ws.projectRoot!).focus, 'the fixture must actually have set a focus');

    const focused = apiSimulate(ws, url('simulate', 'event=session-start&session=sess-4')).body as
      { seenFiltered: string[] };
    const unfocused = apiSimulate(
      ws, url('simulate', 'event=session-start&session=sess-4&focus=off'),
    ).body as { seenFiltered: string[] };

    assert.ok(unfocused.seenFiltered.length > focused.seenFiltered.length,
      'an item hidden by focus never reaches the seen gate, so it cannot be reported as '
      + 'removed there — the ladder\'s order, read off the two answers');
    assert.deepEqual(
      seenFilteredIds(f.items, { event: 'session-start', focus: null, seen: [
        'RULE-always-use-posix-paths', 'RULE-never-log-the-customer-email',
      ] }, ws.config).sort(),
      unfocused.seenFiltered.sort(),
      'and the exported helper is what the endpoint serves, not a parallel arithmetic',
    );
  } finally { f.done(); }
});

// --- 2 · /api/injection-history ---------------------------------------------

/**
 * **The endpoint answers per `(item, role, tier)`, and the tier is why.**
 *
 * The fixture writes two spills of ONE item under two different tiers, minutes
 * apart — the shape measured on this project's own audit database, where one
 * item last spilled from `jit` at 04:19 and from `pinned` at 04:33. A
 * tier-blind answer collapses those into one instant and a preview row about
 * the `jit` spill then reports an event that happened at `pinned`.
 */
test('/api/injection-history answers the last instant per item, role AND tier', () => {
  const f = fixture();
  try {
    const root = f.ws.projectRoot!;
    const inject = (at: string, injected: { id: string; tier: string }[],
      spilled: { id: string; tier: string }[]): void => {
      recordAudit(root, {
        kind: 'injection', op: 'session-start', at, sessionId: 'sess-h',
        injected, spilled,
      } as Parameters<typeof recordAudit>[1]);
    };
    inject('2026-08-20T10:00:00.000Z',
      [{ id: 'RULE-pin-me', tier: 'pinned' }],
      [{ id: 'RULE-never-log-the-customer-email', tier: 'jit' }]);
    inject('2026-08-21T10:00:00.000Z',
      [{ id: 'RULE-pin-me', tier: 'pinned' }],
      [{ id: 'RULE-never-log-the-customer-email', tier: 'pinned' }]);

    // The projection is built by the audit command; a read surface may not.
    assert.equal(runCli(['audit', '--limit', '1'], f.dir, () => {}), 0);

    const result = apiInjectionHistory(f.ws, url('injection-history'));
    assert.equal(result.status, 200);
    const body = result.body as {
      projectionState: string; rows: { id: string; role: string; tier: string; at: string }[];
      truncated: boolean; cap: number;
    };
    assert.equal(body.projectionState, 'fresh');
    assert.equal(body.truncated, false);
    assert.equal(body.cap, HISTORY_ROW_CAP);

    const at = (id: string, role: string, tier: string): string | undefined =>
      body.rows.find((r) => r.id === id && r.role === role && r.tier === tier)?.at;

    assert.equal(at('RULE-pin-me', 'injected', 'pinned'), '2026-08-21T10:00:00.000Z',
      'the LAST instant per triple, not the first');
    assert.equal(at('RULE-never-log-the-customer-email', 'spilled', 'jit'),
      '2026-08-20T10:00:00.000Z');
    assert.equal(at('RULE-never-log-the-customer-email', 'spilled', 'pinned'),
      '2026-08-21T10:00:00.000Z');
    assert.notEqual(
      at('RULE-never-log-the-customer-email', 'spilled', 'jit'),
      at('RULE-never-log-the-customer-email', 'spilled', 'pinned'),
      'one item, two tiers, two instants — a tier-blind answer would report one of them on '
      + 'a row about the other',
    );

    // `subject` is the projection's third role and it is deliberately absent:
    // "this record was ABOUT the item" is not "this item reached a window", and
    // an edit's timestamp under a column headed "last delivered" would be a
    // different fact drawn as this one.
    assert.deepEqual([...new Set(body.rows.map((r) => r.role))].sort(), ['injected', 'spilled']);
  } finally { f.done(); }
});

/**
 * **A projection that was never built is an EMPTY STATE, not a fault** — and it
 * arrives as `rows: null` rather than `rows: []`, because the screen must be
 * able to tell "no record exists to read" from "every item has never been
 * delivered". They are different sentences and only one of them is a claim
 * about the corpus.
 */
test('/api/injection-history reports an unbuilt projection as absent, and never as empty', () => {
  const f = fixture();
  try {
    const result = apiInjectionHistory(f.ws, url('injection-history'));
    assert.equal(result.status, 200);
    const body = result.body as { projectionState: string; rows: unknown };
    assert.equal(body.projectionState, 'absent');
    assert.equal(body.rows, null,
      'null, never []. An empty array would let the screen draw "never delivered" beside every '
      + 'row out of a file that does not exist');
  } finally { f.done(); }
});

test('/api/injection-history refuses a parameter it would otherwise ignore', () => {
  const f = fixture();
  try {
    const result = apiInjectionHistory(f.ws, url('injection-history', 'since=2026-01-01'));
    assert.equal(result.status, 400);
  } finally { f.done(); }
});

// --- 3 · the screen against the two string tables ---------------------------

const previewSource = readFileSync(path.join(PUBLIC, 'screens', 'preview.js'), 'utf8');

async function table(language: string): Promise<Record<string, string>> {
  const file = path.join(PUBLIC, 'strings', `${language}.js`);
  const mod = await import(pathToFileURL(file).href) as { strings: Record<string, string> };
  return mod.strings;
}

/**
 * Every key `preview.js` names, by the shapes this screen names one in.
 *
 * **Three shapes, and the third is why the other two are not enough.** This
 * screen picks a key by CONDITION in five places — `role === 'injected' ?
 * 'preview.lastinj' : 'preview.lastspill'`, the two `never…` keys, the warm/cold
 * button subtitle — and stores one in `historyNote.key` for the card note to
 * read later. `ctx.t('…'` cannot see any of them, and a scanner blind to a key
 * is a scanner that says the screen is clean about the one call it cannot check.
 *
 * So the third pattern is every string literal in the file that LOOKS like a
 * table key, with the following 400 characters taken as the argument window.
 * That window is generous on purpose: it must reach the `ctx.t(key, {…})` a few
 * lines below the ternary that chose the key, and being generous makes this
 * check weaker rather than wrong — it can miss a missing substitution, and it
 * cannot invent one.
 */
function keysNamed(): { key: string; args: string | null }[] {
  const out: { key: string; args: string | null }[] = [];
  for (const m of previewSource.matchAll(/ctx\.t(?:Flat)?\('([^']+)'/g)) {
    const after = previewSource.slice(m.index + m[0].length);
    const open = after.indexOf('{');
    const close = after.indexOf(')');
    out.push({ key: m[1]!, args: open !== -1 && (close === -1 || open < close) ? after : null });
  }
  for (const m of previewSource.matchAll(/screenHead\(ctx, root, '([^']+)', '([^']+)', '([^']+)'\)/g)) {
    for (const key of [m[1]!, m[2]!, m[3]!]) out.push({ key, args: null });
  }
  for (const m of previewSource.matchAll(/'((?:preview|sess|help|aria|list|index|tier)\.[A-Za-z0-9]+)'/g)) {
    out.push({ key: m[1]!, args: previewSource.slice(m.index, m.index + 400) });
  }
  return out;
}

/**
 * **This screen had no such test until 2026-08-29**, which is why it is here
 * and not only in the report. `t()` THROWS on a key it cannot find and throws
 * again on a slot the call site did not supply — in whichever language the
 * reader chose — so a mistyped key or a forgotten substitution blanks the
 * landing screen for Hebrew readers alone, and every gate stays green.
 */
test('every string key the Injection preview names is declared in both tables, with its slots supplied', async () => {
  const en = await table('en');
  const he = await table('he');
  const used = keysNamed();

  // A scanner that finds nothing reads exactly like a clean file.
  assert.ok(used.length >= 25,
    `the scan found ${used.length} key(s) in preview.js; the screen names far more than that. `
    + 'A collapse means the patterns stopped matching, not that the screen stopped naming keys.');

  const { slots: slotsOf } = await import(
    new URL('../../src/ui/public/lib/i18n.js', import.meta.url).href
  ) as { slots: (template: string) => string[] };

  for (const { key, args } of used) {
    assert.ok(key in en, `preview.js names ${key}, missing from the English table`);
    assert.ok(key in he, `preview.js names ${key}, missing from the Hebrew table`);
    for (const template of [en[key]!, he[key]!]) {
      for (const slot of slotsOf(template)) {
        assert.ok(args !== null && args.includes(`${slot}:`),
          `${key} declares a {${slot}} slot that the call site does not supply — t() throws and `
          + 'the screen blanks');
      }
    }
  }
});

/**
 * The other direction. A `preview.` sentence declared in the tables and placed
 * by nothing is a sentence of the design of record that silently does not
 * render — which is what `preview.spilln`'s empty-state neighbours were before
 * this change: the card had one note and three different emptinesses.
 */
test('every preview. key the English table declares is placed by the screen', async () => {
  const en = await table('en');
  const declared = Object.keys(en).filter((key) => key.startsWith('preview.')).sort();
  const named = new Set(keysNamed().map((u) => u.key));
  assert.deepEqual(declared.filter((key) => !named.has(key)), [],
    'these preview. keys are declared and drawn nowhere');
});

/**
 * **The cold question is reachable from the product.** The defect this whole
 * change closes was that it was not: `/api/select` has always required exactly
 * one of `session=<id>` or `cold=1`, and this file contained the string `cold`
 * ZERO times, so it could only ever ask the warm question.
 *
 * A source-level assertion, deliberately. The browser test drives the control
 * and reads the numbers; this one fails the moment the control is deleted or
 * quietly rewired back to a single question, which is a regression a screenshot
 * would not catch and `screen-parity` would not either.
 */
test('the preview can ask the cold question, and the warm default is not replaced by it', () => {
  assert.match(previewSource, /sessionMode === 'cold' \? 'cold' : ctx\.session\(\)/,
    'the query must be able to carry `cold`, through `selectQuery`\'s own sentinel');
  // **The warm default moved from a `let` inside `render()` to `PICKED`, and
  // this assertion moved with it rather than being deleted.** The property is
  // unchanged and is still exactly what is measured: the screen OPENS on the
  // warm question. What changed on 2026-08-29 is WHERE the initial value lives
  // — `plan:walk seq:64`: the mode, the event and the path were all `render()`
  // locals, so taking the live-refresh affordance reset all three and threw away
  // the reader state that `refresh: 'ask'` exists to protect. They are held at
  // module scope now, which is the lifetime `parts.js`'s `SIM_RANGE` already
  // uses for the simulator's slider.
  //
  // So it is asserted in two halves, because the two facts can now come apart:
  // the module-level seed is what the FIRST render opens on, and the `render()`
  // line is what every LATER render restores. A default of `'live'` that no
  // render read would be a default in name only.
  assert.match(previewSource, /const PICKED = \{ event: EVENTS\[0\], path: null, mode: 'live' \};/,
    'the reader\'s place must be held across render() AND must open on the warm question — '
    + 'the screen promises "exactly what Claude gets", and cold is a different question that '
    + 'must never be silently substituted');
  assert.match(previewSource, /let sessionMode = PICKED\.mode;/,
    'and every render must seed the mode from it, or a taken refresh silently returns the '
    + 'reader to warm — which is the defect `plan:walk seq:64` records');
  assert.equal(previewSource.includes("selectQuery(event, event === 'tool' ? chosenPath : null, sessionFor())"), true,
    'the one query builder reads the mode, so the two questions cannot come apart');
});
