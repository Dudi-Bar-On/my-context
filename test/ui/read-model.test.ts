/**
 * The select/render/simulate read model, and the route table under it.
 *
 * Three properties are load-bearing here and each has its own group below.
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
 *    message.
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
import { select, tiersRun, type SelectContext } from '../../src/core/select.ts';
import { appendSeen, readSeen, seenFilePath, seenIds } from '../../src/core/seen-file.ts';
import type { Item } from '../../src/core/types.ts';
import {
  apiRender, apiSelect, apiSimulate, parseSelectQuery, withStores,
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

// --- 5 · the route table ----------------------------------------------------

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

// --- 6 · the read path writes nothing ---------------------------------------

/**
 * The runtime half of the no-writes rule, scoped to this task's three
 * endpoints. Task 14's static import-graph test proves the UI binds no write
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

test('a full sweep of select/render/simulate leaves the corpus byte-identical', () => {
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
