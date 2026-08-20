/**
 * The select/render/simulate/sessions/injected/status/doctor/decay read model,
 * and the route table under it.
 *
 * Five properties are load-bearing here and each has its own group below.
 *
 * 1. **`/api/select` IS `select()`.** Not "agrees with", not "close enough":
 *    the same JSON, over a matrix of events, paths, focus states and seen
 *    sets. The screen's promise is "see exactly what Claude gets", and the
 *    only way to keep it is to make the endpoint incapable of having its own
 *    opinion.
 * 2. **Nothing is dropped silently.** An unknown parameter, a parameter given
 *    twice, a `path` on an event that ignores it, a budget written as `''` —
 *    every one is a refusal that names the parameter, never a 200 answering a
 *    question nobody asked.
 * 3. **The three ledger outcomes stay apart.** A never-injected corpus is an
 *    empty STATE (`ledger === null`), damage is a fault that propagates, and
 *    a healthy corpus is a `Ledger`. Told apart by CLASS, never by matching a
 *    message — and, from `/api/sessions` on, the state survives the trip into
 *    the response body instead of collapsing into `null` and `[]` there.
 * 4. **Live delivery is read from the per-session seen file.** The Ledger left
 *    the hook's path, so every read that claims to show what a context window
 *    ACTUALLY received reads the file the hook appends to — including the
 *    unreadable-file state, which `/api/session/:session/injected` discloses
 *    rather than serving as "nothing was injected".
 * 5. **A read model COMPOSES; it does not re-derive.** `/api/status`,
 *    `/api/doctor` and `/api/decay` are `reviewQueue`, `runChecks` and
 *    `computeDecay`, and each is asserted by making the same call in the test
 *    and comparing whole — so an endpoint that grew an arithmetic of its own
 *    fails, rather than merely disagreeing with a number written twice. The
 *    fixture is doctored until every field has something to be wrong about,
 *    because a tally of zeroes cannot tell a composition from a constant. And
 *    what the ledger projection can and cannot say travels with them:
 *    `never-injected` is a fact about the PROJECTION, and one test produces an
 *    injection that really happened in order to say so.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace, type Workspace } from '../../src/core/workspace.ts';
import { Store } from '../../src/core/store.ts';
import { Ledger, LedgerUninitializedError } from '../../src/core/ledger.ts';
import { readFocus } from '../../src/core/focus.ts';
import { recordAudit } from '../../src/core/audit.ts';
import { computeDecay } from '../../src/core/decay.ts';
import { topUpLedger } from '../../src/core/ledger-replay.ts';
import { reviewQueue, select, tiersRun, type SelectContext } from '../../src/core/select.ts';
import { appendSeen, readSeen, seenFilePath, seenIds } from '../../src/core/seen-file.ts';
import type { Item } from '../../src/core/types.ts';
import { VERSION } from '../../src/core/version.ts';
import { runChecks, type Finding } from '../../src/doctor/checks.ts';
import { stageIn } from '../helpers/revisions.ts';
import {
  apiDecay, apiDoctor, apiInjected, apiRender, apiSelect, apiSessions, apiSimulate, apiStatus,
  DECAY_WINDOW_DEFAULT, parseSelectQuery, SESSIONS_LIMIT, withStores,
  type DecayBody, type DoctorBody, type InjectedBody, type SessionsBody, type StatusBody,
} from '../../src/ui/read-model.ts';
import { matchRoute, registerRoute } from '../../src/ui/routes.ts';

interface Fixture { dir: string; ws: Workspace; items: Item[]; done(): void }

/**
 * A real workspace with real items, built through the real CLI.
 *
 * Four items, chosen so every assertion below is non-vacuous: one pinned rule
 * (the `pinned` tier has something to admit and something to spill under a
 * tightened budget), two `src/**` rules with long bodies (so removing one via
 * the seen file demonstrably changes the `tool` answer), one tagged rule (so a
 * focus narrows to a strict subset), and one rationale-tier decision (so the
 * index summary counts something the full-text tiers never touch).
 *
 * **Nothing here opens a `Ledger`.** That is a property the empty-ledger tests
 * depend on, and it is asserted rather than assumed.
 */
function fixture(): Fixture {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-rm-'));
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
  assert.equal(items.length, 4, 'the fixture must build exactly the four items it describes');
  assert.ok(
    items.find((i) => i.id === 'RULE-pin-me')?.always,
    '`edit --always=true` must have pinned RULE-pin-me, or the pinned tier has no candidate',
  );
  return { dir, ws, items, done: () => removeTree(dir) };
}

const url = (endpoint: string, qs: string): URL => new URL(`http://127.0.0.1:1/api/${endpoint}?${qs}`);

const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

// --- 1 · /api/select is select() -------------------------------------------

test('/api/select equals select() as JSON, for a matrix of events, paths and restores', () => {
  const f = fixture();
  try {
    const matrix: { qs: string; ctx: SelectContext }[] = [
      { qs: 'event=session-start&cold=1', ctx: { event: 'session-start' } },
      { qs: 'event=manual&cold=1', ctx: { event: 'manual' } },
      { qs: 'event=tool&path=src/a.ts&cold=1', ctx: { event: 'tool', path: 'src/a.ts' } },
      { qs: 'event=tool&path=docs/a.md&cold=1', ctx: { event: 'tool', path: 'docs/a.md' } },
      {
        qs: 'event=compact&cold=1&restore=RULE-always-use-posix-paths,RULE-pin-me',
        ctx: {
          event: 'compact',
          restore: ['RULE-always-use-posix-paths', 'RULE-pin-me'],
        },
      },
    ];
    for (const { qs, ctx } of matrix) {
      const result = apiSelect(f.ws, url('select', qs));
      assert.equal(result.status, 200, qs);
      assert.deepEqual(
        json(result.body),
        json(select(f.items, { ...ctx, focus: null }, f.ws.config)),
        qs,
      );
    }
    // Non-vacuity: the matrix must not be five copies of one answer.
    const answers = matrix.map((m) => JSON.stringify(json(apiSelect(f.ws, url('select', m.qs)).body)));
    assert.equal(new Set(answers).size, matrix.length - 1,
      'the tool matrix rows differ from each other; only the two tool paths coincide here');
  } finally { f.done(); }
});

test('/api/select passes the focus the hook would pass, and focus=off asks a different question', () => {
  const f = fixture();
  try {
    assert.equal(runCli(['focus', 'paths'], f.dir, () => {}), 0);
    const ws = resolveWorkspace(f.dir);
    const active = readFocus(ws.projectRoot!).focus;
    assert.ok(active, 'the fixture must actually have set a focus');

    const withFocus = apiSelect(ws, url('select', 'event=session-start&cold=1'));
    assert.deepEqual(
      json(withFocus.body),
      json(select(f.items, { event: 'session-start', focus: active }, ws.config)),
      'omitting focus must preview WITH the active focus, exactly as the hook does',
    );
    assert.ok(
      (withFocus.body as { focus: unknown }).focus !== null,
      'Selection.focus carries the disclosure when a focus is active',
    );

    const off = apiSelect(ws, url('select', 'event=session-start&cold=1&focus=off'));
    assert.deepEqual(
      json(off.body),
      json(select(f.items, { event: 'session-start', focus: null }, ws.config)),
      'focus=off must preview with no narrowing at all',
    );
    assert.notDeepEqual(
      json(off.body), json(withFocus.body),
      'focus=off is a DIFFERENT question; if these coincide the fixture proves nothing',
    );
  } finally { f.done(); }
});

test('/api/select reads the per-session SEEN FILE, and the seen answer differs from the cold one', () => {
  const f = fixture();
  try {
    const root = f.ws.projectRoot!;
    // A real seen-file append — what the hook writes and what the next hook
    // reads. A ledger row would NOT do: the Ledger left that path entirely
    // and `Ledger.seen` is a replayed projection nothing in the UI updates.
    const written = appendSeen(root, 'sess-1', [
      { id: 'RULE-always-use-posix-paths', tier: 'jit', at: '2026-08-20T10:00:00.000Z' },
    ]);
    assert.equal(written.written, true, 'the fixture must actually write the seen file');

    const qs = 'event=tool&path=src/a.ts&session=sess-1';
    const seenResult = apiSelect(f.ws, url('select', qs));
    assert.equal(seenResult.status, 200);
    assert.deepEqual(
      json(seenResult.body),
      json(select(f.items, {
        event: 'tool',
        path: 'src/a.ts',
        seen: seenIds(readSeen(root, 'sess-1')),
        focus: readFocus(root).focus,
      }, f.ws.config)),
    );

    const cold = apiSelect(f.ws, url('select', 'event=tool&path=src/a.ts&cold=1'));
    assert.notDeepEqual(
      json(seenResult.body), json(cold.body),
      'an already-injected item must be absent from the seen preview and present in the cold one',
    );
    const seenIdsInFull = (r: unknown): string[] =>
      (r as { full: { item: { id: string } }[] }).full.map((e) => e.item.id);
    assert.ok(
      seenIdsInFull(cold.body).includes('RULE-always-use-posix-paths'),
      'the cold answer still delivers the item the seen file records',
    );
    assert.ok(
      !seenIdsInFull(seenResult.body).includes('RULE-always-use-posix-paths'),
      'the seen answer must not re-deliver it',
    );
  } finally { f.done(); }
});

/**
 * The hook's rule for a seen file it cannot trust: inject WITHOUT dedupe and
 * disclose (`readSeen` never throws; `pre-tool-use.ts` passes `[]` and speaks).
 * This endpoint reproduces the first half exactly.
 *
 * **The second half — the disclosure — has no surface on this response, and
 * that is an OPEN QUESTION for the owner rather than a decision taken here.**
 * Design decision 7 pins `/api/select` to `select()`'s serialization and
 * nothing else, and the mockup has no string for the state anywhere a preview
 * reader would see it. `parseSelectQuery` reads the error and carries it; no
 * endpoint in this task renders it. This test pins the behaviour that exists
 * so a future decision changes a red test rather than passing unnoticed.
 */
test('an unreadable seen file previews WITHOUT dedupe — and this endpoint does not yet disclose it', () => {
  const f = fixture();
  try {
    const root = f.ws.projectRoot!;
    const brokenPath = seenFilePath(root, 'sess-broken');
    mkdirSync(path.dirname(brokenPath), { recursive: true });
    writeFileSync(brokenPath, '{"protocol":"not-the-seen-protocol"}\n');
    const state = readSeen(root, 'sess-broken');
    assert.ok(state.error !== null, 'the fixture must actually produce an unreadable seen file');

    const parsed = parseSelectQuery(f.ws, url('select', 'event=tool&path=src/a.ts&session=sess-broken'));
    assert.ok(!('error' in parsed));
    assert.equal(parsed.parsed.seenUnreadable, state.error,
      'the parse carries SeenState.error verbatim, so a disclosure needs no second read');

    const broken = apiSelect(f.ws, url('select', 'event=tool&path=src/a.ts&session=sess-broken'));
    assert.equal(broken.status, 200, 'a damaged seen file costs the dedupe, never the preview');
    assert.deepEqual(
      json(broken.body),
      json(apiSelect(f.ws, url('select', 'event=tool&path=src/a.ts&cold=1')).body),
      'the un-deduped preview IS the cold answer — which is exactly why the state needs saying',
    );
  } finally { f.done(); }
});

// --- 2 · nothing is dropped silently ---------------------------------------

test('unknown, missing, repeated and contradictory parameters are refused, never dropped', () => {
  const f = fixture();
  try {
    const cases: [string, RegExp][] = [
      ['event=tool&path=x&cold=1&sesion=typo', /unknown parameter "sesion"/],
      ['event=nope&cold=1', /event must be one of/],
      ['event=tool&cold=1', /event=tool requires path/],
      ['event=tool&path=&cold=1', /event=tool requires path/],
      ['event=session-start&path=x&cold=1', /path is only meaningful with event=tool/],
      ['event=session-start', /exactly one of session/],
      ['event=session-start&session=s&cold=1', /exactly one of session/],
      ['event=session-start&cold=yes', /cold takes exactly the value 1/],
      ['event=session-start&session=', /session=<id> needs an id/],
      ['event=session-start&cold=1&focus=paths', /focus takes exactly the value off/],
      ['event=tool&path=x&cold=1&restore=RULE-a', /restore is only meaningful with event=compact/],
      ['event=session-start&event=manual&cold=1', /parameter "event" was given more than once/],
      ['event=session-start&cold=1&cold=1', /parameter "cold" was given more than once/],
    ];
    for (const [bad, expected] of cases) {
      for (const [name, endpoint] of
        [['select', apiSelect], ['render', apiRender], ['simulate', apiSimulate]] as const) {
        const result = endpoint(f.ws, url(name, bad));
        assert.equal(result.status, 400, `${name}?${bad}`);
        const error = (result.body as { error?: string }).error;
        assert.equal(typeof error, 'string', `${name}?${bad}`);
        assert.match(error!, expected, `${name}?${bad}`);
      }
    }
  } finally { f.done(); }
});

test('a budget override that is not digits is refused rather than coerced', () => {
  const f = fixture();
  try {
    for (const bad of ['pinned=', 'pinned=-1', 'pinned=1.5', 'pinned=x', 'jit= 2', 'index=1e3']) {
      const result = apiSimulate(f.ws, url('simulate', `event=session-start&cold=1&${bad}`));
      assert.equal(result.status, 400, bad);
      assert.match((result.body as { error: string }).error, /must be a non-negative integer/, bad);
    }
    // And the budget keys are only accepted where they mean something.
    for (const endpoint of [apiSelect, apiRender]) {
      const result = endpoint(f.ws, url('select', 'event=session-start&cold=1&pinned=1'));
      assert.equal(result.status, 400);
      assert.match((result.body as { error: string }).error, /unknown parameter "pinned"/);
    }
  } finally { f.done(); }
});

// --- 3 · render and simulate ------------------------------------------------

test('/api/render returns the rendered selection text', () => {
  const f = fixture();
  try {
    const result = apiRender(f.ws, url('render', 'event=session-start&cold=1'));
    assert.equal(result.status, 200);
    const text = (result.body as { text: string }).text;
    assert.match(text, /Pin me/, "the pinned rule's block is in the injected text");
    assert.match(text, /## my_context/);
  } finally { f.done(); }
});

test('/api/simulate applies budget overrides and prices every full and spilled id', () => {
  const f = fixture();
  try {
    const tight = apiSimulate(f.ws, url('simulate', 'event=session-start&cold=1&pinned=1'));
    assert.equal(tight.status, 200);
    const body = tight.body as {
      selection: { full: { item: { id: string } }[]; spilled: { id: string }[] };
      budgets: { pinned: number; jit: number };
      costs: { id: string; tokens: number }[];
      tiersRun: string[];
    };
    assert.equal(body.budgets.pinned, 1, 'the override replaces the configured budget');
    assert.equal(body.budgets.jit, f.ws.config.budgets.jit, 'and only the budget named');
    assert.equal(body.selection.full.length, 0, 'nothing fits a 1-token pinned budget');
    assert.ok(body.selection.spilled.length >= 1);

    const priced = new Set(body.costs.map((c) => c.id));
    for (const s of body.selection.spilled) {
      assert.ok(priced.has(s.id), `every spilled id is priced: ${s.id}`);
    }
    for (const e of body.selection.full) assert.ok(priced.has(e.item.id));
    for (const c of body.costs) {
      assert.ok(Number.isInteger(c.tokens) && c.tokens > 0, `${c.id} costs a positive integer`);
    }

    // Roomy budgets admit what the tight one spilled — the same call, priced
    // the same way, so the difference is the budget and nothing else.
    const roomy = apiSimulate(f.ws, url('simulate', 'event=session-start&cold=1'));
    const roomyBody = roomy.body as typeof body;
    assert.ok(roomyBody.selection.full.some((e) => e.item.id === 'RULE-pin-me'));
    const tightCost = body.costs.find((c) => c.id === 'RULE-pin-me')!.tokens;
    const roomyCost = roomyBody.costs.find((c) => c.id === 'RULE-pin-me')!.tokens;
    assert.equal(tightCost, roomyCost, 'itemCost does not depend on whether the item fitted');
  } finally { f.done(); }
});

/**
 * `tiersRun` is on the response because `Selection` cannot carry the fact: a
 * tier that ran with no candidates is indistinguishable from one that never
 * ran, and the ribbon draws those two differently on purpose. The expectations
 * below are the mockup's own `EVENT_TIERS` table (`web-ui-mockup.html`), which
 * is what the client would otherwise re-derive.
 */
test('/api/simulate names the tiers this event actually reaches', () => {
  const f = fixture();
  try {
    const cases: [string, string[]][] = [
      ['event=session-start&cold=1', ['pinned', 'index']],
      ['event=manual&cold=1', ['pinned', 'index']],
      ['event=compact&cold=1', ['pinned', 'restored', 'index']],
      ['event=tool&path=src/a.ts&cold=1', ['jit']],
    ];
    for (const [qs, expected] of cases) {
      const result = apiSimulate(f.ws, url('simulate', qs));
      assert.equal(result.status, 200, qs);
      assert.deepEqual((result.body as { tiersRun: string[] }).tiersRun, expected, qs);
    }
    // A tier that runs and delivers nothing still says it ran: with every
    // pinned candidate spilled, `full` is empty and `pinned` is still listed.
    const starved = apiSimulate(f.ws, url('simulate', 'event=manual&cold=1&pinned=0'));
    const starvedBody = starved.body as { selection: { full: unknown[] }; tiersRun: string[] };
    assert.equal(starvedBody.selection.full.length, 0);
    assert.ok(starvedBody.tiersRun.includes('pinned'),
      'an empty track and an absent tier are different facts');
  } finally { f.done(); }
});

test('tiersRun is select()\'s own dispatch, not a copy of it', () => {
  // If `select` stops running a tier, this must stop naming it — which is why
  // `select` consumes `tiersRun` rather than restating the conditions.
  assert.deepEqual(tiersRun({ event: 'session-start' }), ['pinned', 'index']);
  assert.deepEqual(tiersRun({ event: 'compact' }), ['pinned', 'restored', 'index']);
  assert.deepEqual(tiersRun({ event: 'manual' }), ['pinned', 'index']);
  assert.deepEqual(tiersRun({ event: 'tool', path: 'src/a.ts' }), ['jit']);
  // A tool event with no usable path reaches NO tier: the jit tier has
  // nothing to match scopes against and the bounded index is not a
  // per-tool-call cost.
  assert.deepEqual(tiersRun({ event: 'tool' }), []);
  assert.deepEqual(tiersRun({ event: 'tool', path: '' }), []);
});

// --- 4 · the three ledger outcomes ------------------------------------------

test('a corpus nothing has ever injected into yields ledger === null, and still serves', () => {
  const f = fixture();
  try {
    const observed = withStores(f.ws, (store, ledger) => {
      assert.ok(store.all().length === 4, 'the store half is open and answering');
      return ledger;
    });
    assert.equal(observed, null,
      'a never-injected corpus is an empty STATE, not a fault and not a refusal');
    // The endpoints are unaffected: nothing in this task reads the ledger, and
    // a fresh corpus must not be a 500.
    assert.equal(apiSelect(f.ws, url('select', 'event=session-start&cold=1')).status, 200);
    assert.equal(apiRender(f.ws, url('render', 'event=session-start&cold=1')).status, 200);
    assert.equal(apiSimulate(f.ws, url('simulate', 'event=session-start&cold=1')).status, 200);
  } finally { f.done(); }
});

test('once something has been injected, the same call yields a real Ledger', () => {
  const f = fixture();
  try {
    // `Ledger.open` is the write that creates the tables — the one thing the
    // read path never does, performed here by the test standing in for a hook.
    const writable = Ledger.open(f.ws.dbPath);
    writable.record('sess-1', 'RULE-pin-me', 'pinned');
    writable.close();

    const isLedger = withStores(f.ws, (_store, ledger) => ledger instanceof Ledger);
    assert.equal(isLedger, true,
      'an initialized ledger must arrive as a Ledger, not as the empty state');
  } finally { f.done(); }
});

test('half a ledger is damage and propagates — it is never reported as the empty state', () => {
  const f = fixture();
  try {
    Ledger.open(f.ws.dbPath).close();
    const db = new DatabaseSync(f.ws.dbPath);
    db.exec('DROP TABLE ledger_source;');
    db.close();

    assert.throws(
      () => withStores(f.ws, (_store, ledger) => ledger),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(
          !(err instanceof LedgerUninitializedError),
          'damage must not wear the never-injected class — the class IS the distinction',
        );
        assert.match(err.message, /ledger_source/);
        return true;
      },
    );
  } finally { f.done(); }
});

test('a truncated database propagates too, rather than reading as an empty ledger', () => {
  const f = fixture();
  try {
    // A zero-length file is a VALID empty SQLite database, so "no ledger
    // tables" cannot be allowed to mean "nothing was ever injected" here.
    // The Store's own check refuses it first, which is the point of opening
    // the Store before the Ledger: `schema_version` is what says this file is
    // a my_context index at all.
    writeFileSync(f.ws.dbPath, '');
    assert.throws(
      () => withStores(f.ws, (_store, ledger) => ledger),
      (err: unknown) => err instanceof Error && !(err instanceof LedgerUninitializedError),
    );
  } finally { f.done(); }
});

test('withStores closes both handles, on the happy path and on a throw', () => {
  const f = fixture();
  try {
    Ledger.open(f.ws.dbPath).close();
    let captured: { store: Store; ledger: Ledger | null } | null = null;
    withStores(f.ws, (store, ledger) => { captured = { store, ledger }; return null; });
    const kept = captured as unknown as { store: Store; ledger: Ledger | null };
    assert.throws(() => kept.store.all(), 'the store handle is closed when withStores returns');

    let escaped: { store: Store } | null = null;
    assert.throws(() => withStores(f.ws, (store) => {
      escaped = { store };
      throw new Error('the handler failed');
    }), /the handler failed/);
    assert.throws(() => (escaped as unknown as { store: Store }).store.all(),
      'a throwing handler still closes the handles');
  } finally { f.done(); }
});

// --- 5 · /api/sessions ------------------------------------------------------

/**
 * The session selector's contract — spec §3 items 1–4. Plan 3 consumes it by
 * name ("the session selector contract (`/api/sessions`)"), so its shape is
 * pinned here rather than left to the first screen that draws it.
 *
 * **Two facts the plan's `{ default, sessions }` body could not hold apart,
 * and both are states this endpoint is HANDED rather than states it invents.**
 *
 *  - `withStores` gives the ledger as `Ledger | null`, and the null is the
 *    never-injected STATE, told from damage by CLASS. `{ default: null,
 *    sessions: [] }` is also exactly what an initialised ledger holding no
 *    rows produces, so the two would reach the client indistinguishable. The
 *    owner ruled that both RENDER as the mockup's zero-data view; rendering
 *    the same is not being the same, and a read model that cannot tell them
 *    apart has collapsed a state that was handed to it intact.
 *  - `sessionSummaries(limit)` truncates — *"Sessions past the window are
 *    simply absent, with nothing in the result to say so; a caller that needs
 *    to know how many exist asks `sessionCount()`"* (`ledger.ts`). This IS
 *    that caller. A body listing 20 of 57 with nothing naming the 57 is
 *    `INV-nothing-is-dropped-silently`'s own failure one layer up.
 *
 * Neither field is a user-visible string and neither invents a screen: what a
 * client DRAWS for them is the mockup's business, and the mockup is silent —
 * recorded as an open question, not answered here.
 */
test('/api/sessions tells a never-injected corpus from an initialised, empty ledger', () => {
  const f = fixture();
  try {
    const fresh = apiSessions(f.ws, url('sessions', '')).body as SessionsBody;
    assert.equal(fresh.ledger, 'never-injected',
      'the state withStores told apart by CLASS has to survive the trip into the body');
    assert.equal(fresh.default, null);
    assert.deepEqual(fresh.sessions, []);
    assert.equal(fresh.sessionCount, null,
      'a corpus with no ledger tables has no session TOTAL either — 0 would claim a count was read');

    // `Ledger.open` is the write that creates the tables — the one thing the
    // read path never does, performed here by the test standing in for a hook
    // that opened the ledger and recorded nothing.
    Ledger.open(f.ws.dbPath).close();
    const empty = apiSessions(f.ws, url('sessions', '')).body as SessionsBody;
    assert.equal(empty.ledger, 'ready');
    assert.equal(empty.sessionCount, 0);
    assert.deepEqual(empty.sessions, []);
    assert.equal(empty.default, null);

    assert.notDeepEqual(json(fresh), json(empty),
      'the two states may render alike and must not BE alike: collapsing them here is the drop');
  } finally { f.done(); }
});

test('/api/sessions defaults to the most recent session and lists the summaries verbatim', () => {
  const f = fixture();
  try {
    const ledger = Ledger.open(f.ws.dbPath);
    ledger.record('s-old', 'RULE-pin-me', 'jit', '2026-08-01T10:00:00.000Z');
    ledger.record('s-new', 'RULE-pin-me', 'jit', '2026-08-02T10:00:00.000Z');
    ledger.record('s-new', 'RULE-always-use-posix-paths', 'jit', '2026-08-02T10:00:01.000Z');
    const expected = ledger.sessionSummaries(SESSIONS_LIMIT);
    ledger.close();

    const result = apiSessions(f.ws, url('sessions', ''));
    assert.equal(result.status, 200);
    const body = result.body as SessionsBody;
    assert.equal(body.ledger, 'ready');
    assert.equal(body.default, 's-new', 'spec §3 item 1: `recentSessions(1)[0]`, most recent first');
    assert.deepEqual(body.sessions.map((s) => s.sessionId), ['s-new', 's-old']);
    // `sessionSummaries` verbatim, never re-shaped field by field: the `name`
    // the owner ruled onto `SessionSummary` (rulings seq 10, a separate task)
    // then arrives at the picker without this endpoint being edited at all.
    assert.deepEqual(json(body.sessions), json(expected),
      'sessionSummaries verbatim: a re-shaping here is where a later field goes missing');
    assert.equal(body.sessions[0].itemCount, 2, 'the summaries carry real counts, not zeros');
    assert.equal(body.sessionCount, 2);
    // The default is chosen by `recentSessions` and the list by
    // `sessionSummaries` — two queries whose agreement `ledger.ts` pins. This
    // asserts it again at the endpoint, because a default pointing at a
    // session the picker does not list is a picker with no selected row.
    assert.equal(body.default, body.sessions[0].sessionId);
  } finally { f.done(); }
});

test('/api/sessions lists at most SESSIONS_LIMIT and DISCLOSES the total when it truncates', () => {
  const f = fixture();
  try {
    assert.equal(SESSIONS_LIMIT, 20, 'spec §3 item 2 fixes the picker window at twenty sessions');
    const ledger = Ledger.open(f.ws.dbPath);
    const total = SESSIONS_LIMIT + 3;
    for (let i = 0; i < total; i++) {
      const n = String(i).padStart(2, '0');
      ledger.record(`s-${n}`, 'RULE-pin-me', 'jit', `2026-08-01T10:00:${n}.000Z`);
    }
    ledger.close();

    const body = apiSessions(f.ws, url('sessions', '')).body as SessionsBody;
    assert.equal(body.sessions.length, SESSIONS_LIMIT);
    assert.equal(body.default, 's-22', 'the most recent session is still the default');
    assert.ok(!body.sessions.some((s) => s.sessionId === 's-00'),
      'the three oldest sessions are outside the window');
    assert.equal(body.sessionCount, total,
      'the total counts every session, not the ones that fitted in the window');
    assert.ok(body.sessionCount !== null && body.sessionCount > body.sessions.length,
      'the total is what SAYS the list was truncated; without it the drop is silent');
  } finally { f.done(); }
});

test('/api/sessions accepts no parameters, and says so rather than answering anyway', () => {
  const f = fixture();
  try {
    const refused = apiSessions(f.ws, url('sessions', 'session=s1'));
    assert.equal(refused.status, 400,
      'a parameter this endpoint does not act on is refused, never accepted and ignored');
    const { error } = refused.body as { error: string };
    assert.match(error, /unknown parameter "session"/);
    assert.match(error, /accepts no parameters/,
      'the refusal names what this endpoint takes; an empty list rendered as ": " named nothing');
  } finally { f.done(); }
});

// --- 6 · /api/session/:session/injected -------------------------------------

/**
 * **The seen file, and not the ledger.** The screen states its own source
 * twice — *"from the per-session seen file — the parent thread's, keyed as the
 * hook keys it"* (`inj.sub`) and *"Read from the seen file, not `Ledger.seen`
 * — that is a replayed projection nothing here updates, and it would show a
 * different number"* (`inj.note`). `Ledger.entries` is that same projection
 * read one session at a time, so the note rules it out on its own reasoning.
 *
 * The three columns the screen draws — `th.item`, `th.tier`, `th.when` — are
 * exactly `SeenLine`'s three fields, so nothing is synthesised.
 */
test('/api/session/:session/injected reads the SEEN FILE, joins titles, keeps vanished items', () => {
  const f = fixture();
  try {
    const root = f.ws.projectRoot!;
    const item = f.items.find((i) => i.id === 'RULE-pin-me')!;
    const written = appendSeen(root, 's1', [
      { id: item.id, tier: 'pinned', at: '2026-08-01T09:14:02.000Z' },
      { id: 'RULE-gone', tier: 'jit', at: '2026-08-01T09:22:41.000Z' },
      { id: item.id, tier: 'jit', at: '2026-08-01T09:31:07.000Z' },
    ]);
    assert.equal(written.written, true, 'the fixture must actually write the seen file');

    const result = apiInjected(f.ws, url('session/s1/injected', ''), { session: 's1' });
    assert.equal(result.status, 200);
    const body = result.body as InjectedBody;
    assert.equal(body.error, null);
    // Three columns off the file, in the file's own order, one row per
    // DELIVERY. `seenIds` — the shape `/api/select` needs — would have
    // deduped and sorted these three lines into two ids, which is the right
    // answer to a different question.
    assert.deepEqual(body.lines.map((l) => [l.id, l.tier, l.at]), [
      [item.id, 'pinned', '2026-08-01T09:14:02.000Z'],
      ['RULE-gone', 'jit', '2026-08-01T09:22:41.000Z'],
      [item.id, 'jit', '2026-08-01T09:31:07.000Z'],
    ], 'one row per delivery, in file order, nothing deduped, sorted, grouped or dropped');
    assert.equal(body.lines[0].title, item.title);
    assert.equal(body.lines[1].title, null,
      'null, not dropped: an injection of a since-deleted item still happened');
  } finally { f.done(); }
});

test('/api/session/:session/injected does NOT answer from the ledger', () => {
  const f = fixture();
  try {
    // A ledger row and NO seen file: the replayed projection says one thing,
    // the live dedupe state says nothing. The screen shows the live state.
    const writable = Ledger.open(f.ws.dbPath);
    writable.record('s2', 'RULE-pin-me', 'jit', '2026-08-01T10:00:00.000Z');
    writable.close();
    const reader = Ledger.openReadOnlyChecked(f.ws.dbPath);
    assert.equal(reader.entries('s2').length, 1,
      'non-vacuity: the projection really does hold a row this endpoint declines to read');
    reader.close();

    const body = apiInjected(f.ws, url('session/s2/injected', ''), { session: 's2' })
      .body as InjectedBody;
    assert.deepEqual(body.lines, [],
      'the live dedupe state is what this screen shows, and it holds nothing for this session');
    assert.equal(body.error, null, 'an absent seen file is empty-and-readable, not an error');
  } finally { f.done(); }
});

/**
 * `readSeen` never throws: it returns `error` for the caller to disclose, and
 * `lines` is empty whenever it is set (no partial answers). This endpoint is
 * the ONE surface in plan 1 that passes that string on — `/api/select` reads
 * the same state and has nowhere to put it (§ the `parseSelectQuery` note).
 */
test('an unreadable seen file is disclosed, never rendered as "nothing was injected"', () => {
  const f = fixture();
  try {
    const root = f.ws.projectRoot!;
    const broken = seenFilePath(root, 's3');
    mkdirSync(path.dirname(broken), { recursive: true });
    // Newline-terminated, so it is corruption rather than a torn tail — the
    // one shape `parseJsonlLog` gives no tolerance at all.
    writeFileSync(broken, '{"protocol":"not-the-seen-protocol"}\n');
    const state = readSeen(root, 's3');
    assert.ok(state.error !== null, 'the fixture must actually produce an unreadable seen file');

    const body = apiInjected(f.ws, url('session/s3/injected', ''), { session: 's3' })
      .body as InjectedBody;
    assert.equal(body.error, state.error, 'SeenState.error verbatim, not a message of our own');
    assert.notEqual(body.error, '');
    assert.deepEqual(body.lines, [],
      'empty LINES beside a non-null error is a different fact from an empty answer');
  } finally { f.done(); }
});

/**
 * *"Previews are of the parent thread. A subagent has its own dedupe key and
 * its deliveries are not folded in here"* (`sess.parent`). `ledgerKey` gives a
 * subagent `session_id::agent_id` and the parent the bare id, so `:session` is
 * the bare id and this endpoint reads one file.
 *
 * **What this test does NOT decide:** whether a subagent's deliveries are
 * reachable through this endpoint at all. Passing its composite key would read
 * its file, but nothing OFFERS that key — the picker lists ledger session ids,
 * which are the bare ones — and the mockup does not answer it. Open question.
 */
test('a subagent\'s deliveries are not folded into the parent thread\'s answer', () => {
  const f = fixture();
  try {
    const root = f.ws.projectRoot!;
    appendSeen(root, 's4', [
      { id: 'RULE-pin-me', tier: 'pinned', at: '2026-08-01T09:00:00.000Z' },
    ]);
    appendSeen(root, 's4::agent-7', [
      { id: 'RULE-never-log-customer-email', tier: 'jit', at: '2026-08-01T09:00:01.000Z' },
    ]);
    assert.notEqual(seenFilePath(root, 's4'), seenFilePath(root, 's4::agent-7'),
      'the two keys must be two files, or this test is asserting nothing');

    const body = apiInjected(f.ws, url('session/s4/injected', ''), { session: 's4' })
      .body as InjectedBody;
    assert.deepEqual(body.lines.map((l) => l.id), ['RULE-pin-me'],
      'the parent thread received one item; the subagent key is a different context window');
  } finally { f.done(); }
});

test('/api/session/:session/injected serves a never-injected corpus, and takes no parameters', () => {
  const f = fixture();
  try {
    // No ledger tables at all: the endpoint reads none, so the null state
    // costs it nothing — a fresh corpus answers 200 with an honest empty file.
    const result = apiInjected(f.ws, url('session/s1/injected', ''), { session: 's1' });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { lines: [], error: null });
    assert.equal(withStores(f.ws, (_store, ledger) => ledger), null,
      'and reading it did not create the ledger tables');

    const refused = apiInjected(f.ws, url('session/s1/injected', 'session=s2'), { session: 's1' });
    assert.equal(refused.status, 400,
      'the session is the PATH segment; a query one would answer a second, unasked question');
    assert.match((refused.body as { error: string }).error, /unknown parameter "session"/);

    // The `:session` segment is the whole question this endpoint answers, so
    // an empty one is refused rather than answered about a fabricated key.
    const blank = apiInjected(f.ws, url('session//injected', ''), { session: '' });
    assert.equal(blank.status, 400,
      'an empty :session must be refused, not folded into an unknown-<digest> filename');
    assert.match((blank.body as { error: string }).error, /session/);
  } finally { f.done(); }
});

// --- 7 · the route table ----------------------------------------------------

const stub = { kind: 'json', handle: () => ({ status: 200, body: {} }) } as const;

test('registerRoute refuses a duplicate and matchRoute extracts :params', () => {
  registerRoute('GET', '/api/test-dup/:id', stub);
  assert.throws(() => registerRoute('GET', '/api/test-dup/:id', stub), /already registered/);
  // The parameter's NAME is private to the handler, so this is the same route
  // wearing a different label — registering it would create a handler no
  // request could ever reach.
  assert.throws(() => registerRoute('GET', '/api/test-dup/:name', stub), /already registered/);

  const match = matchRoute('GET', '/api/test-dup/RULE-x');
  assert.ok(match);
  assert.deepEqual(match.params, { id: 'RULE-x' });
  assert.equal(matchRoute('POST', '/api/test-dup/RULE-x'), null, 'the method is part of the route');
  assert.equal(matchRoute('GET', '/api/test-dup'), null, 'a shorter path is a different route');
  assert.equal(matchRoute('GET', '/api/test-dup/a/b'), null, 'and so is a longer one');
});

test('a :param value is percent-decoded once', () => {
  registerRoute('GET', '/api/test-decode/:id', stub);
  assert.deepEqual(matchRoute('GET', '/api/test-decode/a%2Fb')?.params, { id: 'a/b' });
});

test('the most specific route wins, whatever order the routes were registered in', () => {
  // `:id` first: a linear "first registered wins" scan would make the literal
  // route below unreachable, which is a registration dropped in silence.
  registerRoute('GET', '/api/test-spec/:id', { kind: 'json', handle: () => ({ status: 200, body: 'param' }) });
  registerRoute('GET', '/api/test-spec/count', { kind: 'json', handle: () => ({ status: 200, body: 'literal' }) });
  const literal = matchRoute('GET', '/api/test-spec/count');
  assert.ok(literal && literal.handler.kind === 'json');
  assert.equal((literal.handler.handle({} as never) as { body: unknown }).body, 'literal');
  const param = matchRoute('GET', '/api/test-spec/RULE-x');
  assert.ok(param && param.handler.kind === 'json');
  assert.equal((param.handler.handle({} as never) as { body: unknown }).body, 'param');
  assert.deepEqual(param.params, { id: 'RULE-x' });

  // Leftmost literal decides when two routes are specific in different places.
  registerRoute('GET', '/api/test-lex/:x/c', { kind: 'json', handle: () => ({ status: 200, body: 'right' }) });
  registerRoute('GET', '/api/test-lex/b/:y', { kind: 'json', handle: () => ({ status: 200, body: 'left' }) });
  const lex = matchRoute('GET', '/api/test-lex/b/c');
  assert.ok(lex && lex.handler.kind === 'json');
  assert.equal((lex.handler.handle({} as never) as { body: unknown }).body, 'left');
});

// --- 8 · the read path writes nothing ---------------------------------------

/**
 * The runtime half of the no-writes rule, scoped to the five endpoints this
 * file covers. Task 14's static import-graph test proves the UI binds no write
 * symbol; Task 13's spawned-process E2E proves it over every route through
 * real HTTP. Neither subsumes this one's narrow claim and this one does not
 * subsume either of theirs: a static walk cannot see a read that writes
 * INTERNALLY — `Store.open`'s corruption self-heal is exactly that class, and
 * is why `withStores` opens both handles through read-only doors — and Task 13
 * does not exist yet.
 *
 * **What this proves, with its condition in the same sentence:** that THIS
 * corpus, in THIS state, is byte-identical after THIS matrix of calls. A route
 * that writes only on a corpus state the fixture does not contain is outside
 * it, and it may not be quoted as ruling that out.
 *
 * The never-injected corpus is the sharpest fixture available: the ledger
 * tables are the thing a careless read path creates, `Ledger.open` creates
 * them on every call, and their absence afterwards is checkable rather than
 * argued.
 */
function snapshot(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.set(path.relative(dir, full), createHash('sha256').update(readFileSync(full)).digest('hex'));
    }
  };
  walk(dir);
  return out;
}

test('a full sweep of every endpoint here leaves the corpus byte-identical', () => {
  const f = fixture();
  try {
    const root = f.ws.projectRoot!;
    appendSeen(root, 'sess-1', [
      { id: 'RULE-pin-me', tier: 'pinned', at: '2026-08-20T10:00:00.000Z' },
    ]);
    const before = snapshot(root);
    assert.ok(before.size > 0, 'the snapshot must actually see the corpus');

    const queries = [
      'event=session-start&cold=1',
      'event=session-start&session=sess-1',
      'event=session-start&cold=1&focus=off',
      'event=manual&cold=1',
      'event=compact&cold=1&restore=RULE-pin-me',
      'event=tool&path=src/a.ts&cold=1',
      'event=tool&path=src/a.ts&session=sess-1',
    ];
    for (const qs of queries) {
      for (const [name, endpoint] of
        [['select', apiSelect], ['render', apiRender], ['simulate', apiSimulate]] as const) {
        assert.equal(endpoint(f.ws, url(name, qs)).status, 200, `${name}?${qs}`);
      }
      assert.equal(apiSimulate(f.ws, url('simulate', `${qs}&pinned=0&jit=1&restored=2&index=3`)).status, 200);
    }
    // The two session endpoints take no query at all, so they are swept once
    // each rather than per query. `injected` is swept against a session with
    // a seen file AND one without: an absent file is the state a read path
    // would be tempted to "initialise", and it must stay absent.
    assert.equal(apiSessions(f.ws, url('sessions', '')).status, 200);
    for (const session of ['sess-1', 'sess-never-seen']) {
      assert.equal(
        apiInjected(f.ws, url(`session/${session}/injected`, ''), { session }).status, 200,
      );
    }

    const after = snapshot(root);
    assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort(),
      'no file may be created or removed by a read');
    for (const [file, digest] of before) {
      assert.equal(after.get(file), digest, `${file} must be byte-identical after a read sweep`);
    }
    // And the one write a careless read path makes: `Ledger.open` creates the
    // ledger tables, so a never-injected corpus that still reports the empty
    // state afterwards proves no handler took that door.
    assert.equal(withStores(f.ws, (_store, ledger) => ledger), null,
      'the read sweep must not have created the ledger tables');
  } finally { f.done(); }
});

/**
 * The sweep above cannot cover the one thing `/api/sessions` does that no
 * earlier endpoint did — **execute queries against a real ledger** — because
 * its fixture deliberately has no ledger at all. So the same claim is made
 * once more over a corpus that HAS one, with the same condition attached:
 * this corpus, this state, these calls.
 *
 * **And this fixture is where the sweep above's silence shows up.** Opening a
 * WAL-mode database READ-ONLY makes SQLite build the WAL index, and creating
 * that index CREATES FILES: measured on win32, a CLI-built corpus has neither
 * `.index.db-shm` nor `.index.db-wal`, one `Store.openReadOnlyChecked` has
 * both, and only a WRITABLE close removes them again. The sweep above never
 * sees it because `fixture()` itself opens the store read-only, so the
 * sidecars already exist by the time it snapshots; this test writes through
 * the ledger first, whose close removes them, and the next read puts them
 * back. No corpus byte moves and the index itself is untouched — but two
 * files APPEAR under `.my_context/` on a pure read path, which is a different
 * claim from "nothing changed" and **Task 13's runtime byte-identical sweep
 * has to expect it.**
 *
 * The exact set is measured here rather than written down, because the
 * assertion has to say the same true thing on both CI platforms: a bare
 * read-only open is opened and closed first, and the endpoints must then
 * create EXACTLY what it created and nothing besides.
 */
test('reading a corpus that HAS a ledger moves no byte — and names what SQLite creates', () => {
  const f = fixture();
  try {
    const root = f.ws.projectRoot!;
    const writable = Ledger.open(f.ws.dbPath);
    writable.record('sess-1', 'RULE-pin-me', 'pinned', '2026-08-20T10:00:00.000Z');
    writable.record('sess-2', 'RULE-pin-me', 'jit', '2026-08-20T11:00:00.000Z');
    writable.close();
    appendSeen(root, 'sess-1', [
      { id: 'RULE-pin-me', tier: 'pinned', at: '2026-08-20T10:00:00.000Z' },
    ]);

    const before = snapshot(root);
    const added = (later: Map<string, string>): string[] =>
      [...later.keys()].filter((file) => !before.has(file)).sort();

    // What the ENGINE costs, measured: one read-only open, nothing else.
    Store.openReadOnlyChecked(f.ws.dbPath).close();
    const sidecars = added(snapshot(root));
    assert.ok(sidecars.every((file) => file.startsWith('.index.db-')),
      `a bare read-only open created something that is not an index sidecar: ${sidecars.join(', ')}`);

    const sessions = apiSessions(f.ws, url('sessions', '')).body as SessionsBody;
    assert.equal(sessions.sessionCount, 2, 'non-vacuity: the ledger really was queried');
    for (const session of ['sess-1', 'sess-2']) {
      assert.equal(
        apiInjected(f.ws, url(`session/${session}/injected`, ''), { session }).status, 200,
      );
    }
    const after = snapshot(root);
    assert.deepEqual(added(after), sidecars,
      'the endpoints may create exactly what a bare read-only open creates, and nothing else');
    assert.deepEqual([...before.keys()].filter((file) => !after.has(file)), [],
      'a read removes nothing');
    for (const [file, digest] of before) {
      assert.equal(after.get(file), digest, `${file} must be byte-identical after a read sweep`);
    }
  } finally { f.done(); }
});

// --- 6 · status, doctor and decay -------------------------------------------

/**
 * The tally `status --json` emits and this endpoint repeats, computed here
 * from the items the test can see — so the assertion is that the endpoint
 * counted the corpus, not that it agrees with a number written twice.
 */
function tallyOf(items: Item[], key: (i: Item) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

const checksFor = (ws: Workspace, items: Item[]): Finding[] => runChecks({
  root: ws.projectRoot!,
  repoRoot: path.dirname(ws.projectRoot!),
  dbPath: ws.dbPath,
  items,
  config: ws.config,
});

/**
 * The fixture, doctored until **every field of `/api/status` has something to
 * be wrong about**. A four-item corpus with two dead scopes exercises one
 * warning and nothing else: a `health` of `{ errors: 0, warnings: 2, infos: 0 }`
 * cannot tell a composed count from a hard-coded zero on two of its three
 * fields, `pendingRevisions` cannot tell one from `{ 0, 0 }` at all, and a
 * `profile` of `standard` cannot tell one from the default written as a
 * literal. Each mutation below survived until the corresponding fact existed.
 *
 *  - **a non-default profile** — `minimal`, so `ws.config.profile` is a value
 *    no literal in the endpoint would guess;
 *  - **two pending revisions on ONE item**, so `revisions` and `items` are 2
 *    and 1 and cannot be swapped unnoticed;
 *  - **an `error`-level finding** — an item whose captured source document is
 *    not there (`source_missing`), written into the index rather than through
 *    a capture command, because the point is the finding and not the capture;
 *  - **an `info`-level finding that names NO item** —
 *    `categories.rule.scopePolicy: "required"` over a scopeless rule. `Finding.item`
 *    is optional, `/api/doctor` promises to carry it optional, and a corpus
 *    where every finding names an item cannot hold it to that.
 */
function enrich(f: Fixture): { ws: Workspace; items: Item[] } {
  const root = f.ws.projectRoot!;
  // Two proposals against ONE item — `stageRevision` queues the second behind
  // the first rather than replacing it, which is the whole reason
  // `pendingRevisionCounts` reports both numbers.
  stageIn(f.dir, 'RULE-pin-me', { title: 'Pin me, revised' });
  stageIn(f.dir, 'RULE-pin-me', { body: 'A second proposal, against the same item.' });

  const configPath = path.join(root, 'config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  config.profile = 'minimal';
  config.categories = { rule: { scopePolicy: 'required' } };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  const writable = Store.open(f.ws.dbPath);
  writable.upsert({
    ...f.items.find((i) => i.id === 'RULE-pin-me')!,
    id: 'RULE-a-captured-rule', title: 'A captured rule', always: false,
    sourceFile: 'docs/gone.md', sourceAnchor: null, sourceChecksum: 'deadbeef',
    filePath: 'items/rule-a-captured-rule.md',
  });
  writable.close();

  // Re-resolved, because the config on disk is not the one the fixture read.
  const ws = resolveWorkspace(f.dir);
  return { ws, items: withStores(ws, (store) => store.all()) };
}

test('/api/status is `status --json`\'s document, composed from the same functions', () => {
  const f = fixture();
  try {
    const { ws, items } = enrich(f);
    const result = apiStatus(ws, url('status', ''));
    assert.equal(result.status, 200);
    const body = result.body as StatusBody;

    assert.equal(body.version, VERSION, 'the version is the one this build reports, not a literal');
    assert.equal(body.profile, ws.config.profile);
    assert.equal(body.profile, 'minimal', 'non-vacuity: not the default a literal would guess');
    assert.equal(body.items.total, items.length);
    assert.deepEqual(body.items.byCategory, tallyOf(items, (i) => i.type));
    assert.deepEqual(body.items.byStatus, tallyOf(items, (i) => i.status));
    assert.deepEqual(body.items.byOrigin, tallyOf(items, (i) => i.origin));
    // Non-vacuity: five active, human-origin items across two categories, so
    // every tally above has something in it to get wrong.
    assert.deepEqual(body.items.byCategory, { rule: 4, decision: 1 });
    assert.deepEqual(body.items.byStatus, { active: 5 });
    assert.deepEqual(body.items.byOrigin, { human: 5 });

    // Two proposals, one item — `revisions` is the unit of decision and
    // `items` is beside it because a lone number cannot say which it is.
    assert.deepEqual(body.pendingRevisions, { revisions: 2, items: 1 });

    // `health` is a LEVEL TALLY of the same findings `/api/doctor` serves
    // whole. Computed here from `runChecks` itself rather than restated: the
    // claim is composition, and a hard-coded `2` would pass just as well if
    // the endpoint stopped calling the checker at all.
    const findings = checksFor(ws, items);
    assert.deepEqual(body.health, {
      errors: findings.filter((x) => x.level === 'error').length,
      warnings: findings.filter((x) => x.level === 'warn').length,
      infos: findings.filter((x) => x.level === 'info').length,
    });
    assert.deepEqual(body.health, { errors: 1, warnings: 2, infos: 1 },
      'all three levels are non-zero, so no field of the tally can be a hard-coded 0');
    assert.equal(
      body.health.errors + body.health.warnings + body.health.infos, findings.length,
      'every finding lands in exactly one level — a tally that drops one is the defect',
    );
  } finally { f.done(); }
});

test('/api/status counts the project-layer QUEUE, and names its gap from the raw tally', () => {
  const f = fixture();
  try {
    // A rationale-tier item takes `--status draft` ungated, so the fixture
    // grows a real review queue without going near the trust gate.
    assert.equal(
      runCli(['edit', 'DEC-we-chose-sqlite', '--status', 'draft', '--yes'], f.dir, () => {}), 0,
    );
    // And a GLOBAL-layer draft, written straight into the index rather than
    // into `~/.my-context`: the whole point of `globalLayerDrafts` is that the
    // two populations differ, and a fixture where they coincide cannot tell a
    // computed difference from a hard-coded `0`. The real global root is not
    // a test's to write in, and this item never needs a file — it exists to be
    // counted by two functions that disagree about it.
    const writable = Store.open(f.ws.dbPath);
    writable.upsert({
      ...f.items.find((i) => i.id === 'RULE-pin-me')!,
      id: 'RULE-a-global-draft', title: 'A global draft', status: 'draft',
      layer: 'global', always: false, filePath: 'items/rule-a-global-draft.md',
    });
    writable.close();

    const items = withStores(f.ws, (store) => store.all());
    const queue = reviewQueue(items);
    assert.deepEqual(queue.map((i) => i.id), ['DEC-we-chose-sqlite'],
      'the queue is project-layer drafts only — the global one is deliberately not in it');

    const body = apiStatus(f.ws, url('status', '')).body as StatusBody;
    assert.equal(body.reviewQueue.drafts, queue.length);
    assert.equal(body.reviewQueue.drafts, 1);
    assert.equal(body.reviewQueue.always, queue.filter((i) => i.always).length);
    // The raw tally and the queue answer different questions, and the third
    // field is exactly their difference — never a filtered tally that hides a
    // global-layer draft from every surface at once.
    assert.equal(body.items.byStatus.draft, 2, 'the raw tally counts BOTH drafts, both layers');
    assert.equal(
      body.reviewQueue.globalLayerDrafts,
      items.filter((i) => i.status === 'draft').length - queue.length,
    );
    assert.equal(body.reviewQueue.globalLayerDrafts, 1,
      'the gap between the two numbers is reported, not reconciled away');
  } finally { f.done(); }
});

test('/api/status and /api/doctor accept no parameters, and say so rather than answering', () => {
  const f = fixture();
  try {
    for (const [name, endpoint] of [['status', apiStatus], ['doctor', apiDoctor]] as const) {
      for (const qs of ['window=5', 'json=1', 'level=error']) {
        const refused = endpoint(f.ws, url(name, qs));
        assert.equal(refused.status, 400, `${name}?${qs}`);
        assert.match((refused.body as { error: string }).error, /accepts no parameters/);
      }
      assert.equal(endpoint(f.ws, url(name, '')).status, 200);
    }
  } finally { f.done(); }
});

test('/api/doctor is runChecks verbatim — unfiltered, ungrouped, unsorted', () => {
  const f = fixture();
  try {
    const { ws, items } = enrich(f);
    // The endpoint runs FIRST so both calls see the same repository: a
    // read-only open leaves `.index.db-shm`/`-wal` behind, and `runChecks`
    // walks the tree. Ordering it this way makes the comparison about the
    // findings rather than about which call created a sidecar.
    const result = apiDoctor(ws, url('doctor', ''));
    assert.equal(result.status, 200);
    const { findings } = result.body as DoctorBody;
    assert.deepEqual(findings, checksFor(ws, items),
      'the array is carried, not reshaped: same order, same objects, same optional `item`');

    // Non-vacuity, and the shape of the screen's three groups: all three
    // levels present, four findings under three codes, in `runChecks`' own
    // order — neither grouped by code nor sorted by level here.
    assert.deepEqual(findings.map((x) => [x.level, x.code, x.item ?? null]), [
      ['error', 'source_missing', 'RULE-a-captured-rule'],
      ['warn', 'dead_scope', 'RULE-always-use-posix-paths'],
      ['warn', 'dead_scope', 'RULE-never-log-the-customer-email'],
      ['info', 'scope_policy_required', null],
    ]);
    for (const finding of findings) {
      assert.ok(['error', 'warn', 'info'].includes(finding.level));
      assert.equal(typeof finding.code, 'string');
      assert.equal(typeof finding.message, 'string');
    }
    // `item` is OPTIONAL on `Finding` and stays optional — a `null` invented
    // here would put an empty cell in the screen's item column where the
    // mockup draws an em dash for the finding that names none. The
    // `scope_policy_required` row above is the one that holds this to it.
    assert.ok(findings.every((x) => x.item === undefined || typeof x.item === 'string'));
    assert.ok(
      findings.some((x) => !Object.hasOwn(x, 'item')),
      'non-vacuity: a corpus where every finding names an item cannot test the optional case',
    );
  } finally { f.done(); }
});

test('/api/decay is computeDecay over the ledger, with history() verbatim beside it', () => {
  const f = fixture();
  try {
    const writable = Ledger.open(f.ws.dbPath);
    writable.record('sess-old', 'RULE-always-use-posix-paths', 'jit', '2026-08-01T10:00:00.000Z');
    writable.record('sess-new', 'RULE-pin-me', 'pinned', '2026-08-20T10:00:00.000Z');
    writable.close();

    const result = apiDecay(f.ws, url('decay', ''));
    assert.equal(result.status, 200);
    const body = result.body as DecayBody;
    assert.equal(body.ledger, 'ready');

    const expected = withStores(f.ws, (store, ledger) => ({
      report: computeDecay({
        items: store.all(),
        config: f.ws.config,
        usage: ledger!.allUsage(),
        recentlyUsed: ledger!.itemsUsedIn(ledger!.recentSessions(DECAY_WINDOW_DEFAULT)),
        window: DECAY_WINDOW_DEFAULT,
        sessionsRecorded: ledger!.sessionCount(),
      }),
      series: ledger!.history(),
    }));
    assert.deepEqual(json(body.report), json(expected.report));
    assert.deepEqual(json(body.series), json(expected.series));

    // Non-vacuity, and the four comb states this response really does serve.
    const report = body.report!;
    assert.equal(report.window, DECAY_WINDOW_DEFAULT);
    assert.equal(report.sessionsRecorded, 2);
    assert.deepEqual(report.warm.map((r) => r.id).sort(),
      ['RULE-always-use-posix-paths', 'RULE-pin-me'],
      'both sessions are inside a window of 20, so both injected items are warm');
    // `decision` is a RATIONALE-tier category, so it is not measured at all —
    // decay partitions the eligible NORMATIVE set, and the fourth item is
    // absent from every bucket rather than counted cold.
    assert.deepEqual(report.cold.map((r) => r.id), ['RULE-never-log-the-customer-email']);
    assert.equal(report.cold[0].useCount, 0,
      '`useCount === 0` IS the comb\'s "never injected" state — no join to /api/items needed');
    assert.deepEqual(report.unrestricted.map((r) => r.id), ['RULE-pin-me'],
      'the one item with no scope, carried as a breadth view over cold ∪ warm');
    assert.ok(report.unrestricted[0].always,
      '`DecayRow.always` is the pinned half of `dec.badpin`, on the row already');

    assert.deepEqual(body.series.map((e) => [e.sessionId, e.itemId, e.tier]), [
      ['sess-old', 'RULE-always-use-posix-paths', 'jit'],
      ['sess-new', 'RULE-pin-me', 'pinned'],
    ], 'history() is ordered by (injected_at, session_id, item_id) and nothing is filtered');

    // A narrower window is a different question and the report says which one
    // it answered — the two figures `#deccaveat` is built from.
    const narrow = apiDecay(f.ws, url('decay', 'window=1')).body as DecayBody;
    assert.equal(narrow.report!.window, 1);
    assert.equal(narrow.report!.sessionsRecorded, 2);
    assert.deepEqual(narrow.report!.warm.map((r) => r.id), ['RULE-pin-me'],
      'a window of one session leaves only the most recent session\'s items warm');
  } finally { f.done(); }
});

test('/api/decay refuses a window it would otherwise coerce, and one given twice', () => {
  const f = fixture();
  try {
    // Every one of these is a value `Number(raw)` accepts and answers about —
    // a different window from the one the caller wrote, or none at all.
    for (const qs of [
      'window=0', 'window=-1', 'window=abc', 'window=', 'window=%202%20',
      'window=1e3', 'window=0x10', 'window=+5', 'window=2.0', 'window=20.5',
    ]) {
      const refused = apiDecay(f.ws, url('decay', qs));
      assert.equal(refused.status, 400, qs);
      assert.match((refused.body as { error: string }).error, /window must be a positive integer/);
    }
    const unknown = apiDecay(f.ws, url('decay', 'windw=5'));
    assert.equal(unknown.status, 400);
    assert.match((unknown.body as { error: string }).error, /unknown parameter "windw"/);

    const twice = apiDecay(f.ws, url('decay', 'window=5&window=9'));
    assert.equal(twice.status, 400, 'the first value would be read and the second dropped');
    assert.match((twice.body as { error: string }).error, /given more than once/);

    assert.equal(apiDecay(f.ws, url('decay', 'window=1')).status, 200);
    assert.equal(apiDecay(f.ws, url('decay', '')).status, 200);
  } finally { f.done(); }
});

test('/api/decay tells a never-injected corpus from an initialised, empty ledger', () => {
  const f = fixture();
  try {
    const fresh = apiDecay(f.ws, url('decay', '')).body as DecayBody;
    assert.equal(fresh.ledger, 'never-injected');
    assert.equal(fresh.report, null,
      'a report of zeroes would list every eligible normative item as cold, and ring ' +
      '`dec.badpin` around every pinned one, from a measurement that never happened');
    assert.deepEqual(fresh.series, []);

    // The ledger tables now exist and hold nothing: the same JSON everywhere
    // except the one field whose whole job is to tell the two apart.
    Ledger.open(f.ws.dbPath).close();
    const empty = apiDecay(f.ws, url('decay', '')).body as DecayBody;
    assert.equal(empty.ledger, 'ready');
    assert.notEqual(empty.report, null, 'an initialised ledger HAS been counted — 0 is a reading');
    assert.equal(empty.report!.sessionsRecorded, 0);
    assert.equal(empty.report!.warm.length, 0);
    assert.deepEqual(empty.report!.cold.map((r) => r.id).sort(), [
      'RULE-always-use-posix-paths', 'RULE-never-log-the-customer-email', 'RULE-pin-me',
    ], 'nothing is warm, so every eligible normative item is cold — a measured answer');
    assert.deepEqual(empty.series, []);
  } finally { f.done(); }
});

/**
 * **`never-injected` is a fact about the PROJECTION, not about injection.**
 *
 * The ledger table is a projection of the audit log and the only thing that
 * writes it is `topUpLedger`, which `status`, `decay` and `audit
 * replay-ledger` call and nothing else does — the hook stopped writing it when
 * dedupe state moved to the seen file. So a corpus that has been injected into
 * and never had an aggregate CLI reader run against it has NO ledger tables,
 * and every endpoint carrying `LedgerPresence` calls it `never-injected`.
 *
 * This test does not assert that the state is right. It records what the name
 * currently means, by producing an injection that really happened, on disk, in
 * the log the replayer reads — and then showing the read surface answering
 * "never" about it, one `topUpLedger` away from the truth.
 */
test('"never-injected" is a fact about the PROJECTION, not about injection', () => {
  const f = fixture();
  try {
    const root = f.ws.projectRoot!;
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 'sess-real', hook: 'PreToolUse',
      injected: [{ id: 'RULE-pin-me', tier: 'jit' }],
    });

    const body = apiDecay(f.ws, url('decay', '')).body as DecayBody;
    assert.equal(body.ledger, 'never-injected',
      'an injection that HAPPENED, and the read surface says the corpus has never had one');
    assert.equal(body.report, null);
    assert.deepEqual(body.series, []);

    // And the fact was one write away the whole time — which is what makes the
    // answer above stale rather than false, and why this is reported rather
    // than repaired on a read path.
    const ledger = Ledger.open(f.ws.dbPath);
    try {
      assert.equal(topUpLedger(root, ledger).applied, 1);
      assert.deepEqual(ledger.history().map((e) => [e.sessionId, e.itemId]),
        [['sess-real', 'RULE-pin-me']]);
    } finally { ledger.close(); }
  } finally { f.done(); }
});

/**
 * The byte-identity claim, extended to the three endpoints that read OUTSIDE
 * `.my_context` for the first time: `runChecks` walks the repository (source
 * drift, dead scopes, permissions), so this snapshot is taken over the whole
 * fixture directory rather than over the workspace alone.
 *
 * The same condition as the two sweeps above applies unchanged: this corpus,
 * in this state, after these calls. And the same measured exception — a
 * read-only open of a WAL database CREATES `.index.db-shm` and `.index.db-wal`
 * — is measured here rather than written down, because the assertion has to
 * say the same true thing on both CI platforms.
 */
test('a sweep of status, doctor and decay leaves the whole repository byte-identical', () => {
  const f = fixture();
  try {
    // A corpus WITH a ledger, so `/api/decay` really executes its queries;
    // the writable close is also what removes the sidecars, so the
    // measurement below starts from the state a CLI leaves behind.
    const writable = Ledger.open(f.ws.dbPath);
    writable.record('sess-1', 'RULE-pin-me', 'pinned', '2026-08-20T10:00:00.000Z');
    writable.close();

    const before = snapshot(f.dir);
    assert.ok(before.size > 0, 'the snapshot must actually see the repository');
    const added = (later: Map<string, string>): string[] =>
      [...later.keys()].filter((file) => !before.has(file)).sort();

    // What the ENGINE costs, measured: one read-only open, nothing else.
    Store.openReadOnlyChecked(f.ws.dbPath).close();
    const sidecars = added(snapshot(f.dir));
    assert.ok(
      sidecars.every((file) => /\.index\.db-(shm|wal)$/.test(file)),
      `a bare read-only open created something that is not an index sidecar: ${sidecars.join(', ')}`,
    );

    assert.equal(apiStatus(f.ws, url('status', '')).status, 200);
    assert.equal(apiDoctor(f.ws, url('doctor', '')).status, 200);
    for (const qs of ['', 'window=1', 'window=1000']) {
      const body = apiDecay(f.ws, url('decay', qs)).body as DecayBody;
      assert.equal(body.ledger, 'ready', 'non-vacuity: the ledger really was queried');
    }

    const after = snapshot(f.dir);
    assert.deepEqual(added(after), sidecars,
      'the endpoints may create exactly what a bare read-only open creates, and nothing else');
    assert.deepEqual([...before.keys()].filter((file) => !after.has(file)), [],
      'a read removes nothing');
    for (const [file, digest] of before) {
      assert.equal(after.get(file), digest, `${file} must be byte-identical after a read sweep`);
    }
    // `/api/decay` reads the projection as it stands: no `topUpLedger`, and so
    // no new ledger row, from any number of reads.
    assert.equal(withStores(f.ws, (_store, ledger) => ledger!.history().length), 1);
  } finally { f.done(); }
});
