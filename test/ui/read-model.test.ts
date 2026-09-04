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
 * 3. **The three ledger outcomes stay apart.** A not-projected corpus is an
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
 *    `not-projected` is a fact about the PROJECTION, and one test produces an
 *    injection that really happened in order to say so.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync, mkdtempSync, readdirSync, readFileSync, utimesSync, writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { injection } from '../../src/cli/commands/injection.ts';
import { scopePolicyFor } from '../../src/core/config.ts';
import { summaryState } from '../../src/core/content-hash.ts';
import { resolveWorkspace, type Workspace } from '../../src/core/workspace.ts';
import { Store } from '../../src/core/store.ts';
import { Ledger, LedgerUninitializedError } from '../../src/core/ledger.ts';
import { isLoadBearing, readFocus } from '../../src/core/focus.ts';
import { RELATION_TYPES } from '../../src/core/vocabulary.ts';
import { recordAudit } from '../../src/core/audit.ts';
import { resolveCarry } from '../../src/core/continuity.ts';
import { computeDecay } from '../../src/core/decay.ts';
import { topUpLedger } from '../../src/core/ledger-replay.ts';
import {
  reviewQueue, select, tiersRun, type SelectContext, type Selection, type Spill,
} from '../../src/core/select.ts';
import { appendSeen, readSeen, seenFilePath, seenIds } from '../../src/core/seen-file.ts';
import { setSessionName } from '../../src/core/session-names.ts';
import { writeTee } from '../../src/core/statusline-tee.ts';
import type { Item, Relation } from '../../src/core/types.ts';
import { VERSION } from '../../src/core/version.ts';
import { listRepoFiles, runChecks, type Finding } from '../../src/doctor/checks.ts';
import { commandList, helpTopic, HELP_TOPICS } from '../../src/help/index.ts';
import { stageIn } from '../helpers/revisions.ts';
import {
  alreadyDeliveredIds, apiCoverage, apiDecay, apiDoctor, apiGraph, apiHelp, apiInjected, apiItem,
  apiItems, apiRender, apiSelect, apiSessions, apiSimulate, apiSimulateSweep, apiStatus,
  coverageFiles, COVERAGE_FILE_LIMIT, DECAY_WINDOW_DEFAULT, GRAPH_NODE_CAP, parseSelectQuery,
  SESSIONS_LIMIT, UI_HELP_TOPICS, withStores,
  type CoverageBody, type DecayBody, type DoctorBody, type GraphBody, type HelpBody,
  type InjectedBody, type ItemBody, type ItemsBody, type SessionsBody, type StatusBody,
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
  run(['add', '--summary-omitted', 'rule', 'Always use POSIX paths', '--scope', 'src/**', '--tags', 'paths',
    '--body', 'Use POSIX separators everywhere. '.repeat(40), '--yes']);
  run(['add', '--summary-omitted', 'rule', 'Never log the customer email', '--scope', 'src/**',
    '--body', 'Redact the address before it reaches a log sink. '.repeat(40), '--yes']);
  run(['add', '--summary-omitted', 'rule', 'Pin me', '--body', 'Pinned body, long enough to cost real tokens. '
    .repeat(30), '--yes']);
  run(['edit', 'RULE-pin-me', '--always=true', '--yes']);
  run(['add', '--summary-omitted', 'decision', 'We chose sqlite', '--body', 'Rationale body.', '--yes']);

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
    // `--yes` since 2026-09-04: setting a focus is one of the two forms on the
    // approval boundary (`DEC-the-focus-dialog-earns-execute-by-putting-focus-
    // on-the`), and `confirmAction` refuses off a TTY. The exit code is
    // asserted, and the `assert.ok(active)` below is the second guard — without
    // the flag this fixture set no focus at all and the rest of the test would
    // have compared two unfocused selections and passed.
    assert.equal(runCli(['focus', 'paths', '--yes'], f.dir, () => {}), 0);
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
 * The cross-session carry, on the endpoint whose whole value is that it is the
 * same answer the hook gets.
 *
 * `IndexSummary.carried` is served for free ONLY once the context that produces
 * it is passed. `parseSelectQuery` reads four narrowing inputs — path, restore,
 * seen and focus — and the carry is the fifth. Without it this endpoint answers
 * `carried: null` for every request forever, `/api/render` returns bytes that
 * are missing both the markers and the disclosure the hook injects, and the
 * screen's promise ("see exactly what Claude gets") is false in the one place
 * `INV-nothing-is-dropped-silently` is load-bearing: an item arriving from a
 * session you cannot see is the same defect as one dropped silently, pointed
 * the other way.
 *
 * Read the way the hook reads it — `core/inject.ts` ·
 * `const carried = !manual && (subagent || !compacting)` · ~476 — which means
 * `session-start` and nothing else.
 */
test('/api/select carries the cross-session carry, so the UI reads the shape the CLI renders', () => {
  const f = fixture();
  try {
    const root = f.ws.projectRoot as string;
    assert.equal(appendSeen(root, 'sess-previous', [
      { id: 'RULE-always-use-posix-paths', tier: 'jit', at: '2026-08-20T09:00:00.000Z' },
    ]).written, true);
    assert.equal(setSessionName(root, 'sess-previous', 'auth-refactor').written, true);

    const cold = apiSelect(f.ws, url('select', 'event=session-start&cold=1'));
    assert.equal(cold.status, 200);
    const carried = (cold.body as Selection).index.carried;
    assert.ok(carried,
      '/api/select answered carried: null while a hook starting a session at this instant ' +
      'would carry — the browser cannot render a field the endpoint never fills');
    assert.equal(carried.label, 'auth-refactor');
    assert.equal(carried.shown, 1);

    // Whole-answer equality against the hook's own resolution, not a spot check
    // on one field: the endpoint must be incapable of having its own opinion.
    assert.deepEqual(
      json(cold.body),
      json(select(f.items, {
        event: 'session-start', focus: null, carried: resolveCarry(root, null),
      }, f.ws.config)),
    );

    // And the rendered bytes carry the disclosure, because `/api/render` is
    // documented as the literal bytes a hook would inject.
    const rendered = apiRender(f.ws, url('render', 'event=session-start&cold=1'));
    assert.match((rendered.body as { text: string }).text, /carried from session `auth-refactor`/);
    assert.match((rendered.body as { text: string }).text, / · carried$/m);
  } finally { f.done(); }
});

test('/api/select carries on session-start only — a compaction and a manual load never do', () => {
  const f = fixture();
  try {
    const root = f.ws.projectRoot as string;
    appendSeen(root, 'sess-previous', [
      { id: 'RULE-always-use-posix-paths', tier: 'jit', at: '2026-08-20T09:00:00.000Z' },
    ]);
    // A compaction is the same window continuing and the restore tier is
    // already re-delivering what it held; a manual load has no session id to
    // exclude as "yourself". The hook carries on neither, so neither does this.
    for (const qs of ['event=compact&cold=1', 'event=manual&cold=1']) {
      assert.equal((apiSelect(f.ws, url('select', qs)).body as Selection).index.carried, null, qs);
    }
    assert.ok(
      (apiSelect(f.ws, url('select', 'event=session-start&cold=1')).body as Selection).index.carried,
      'the fixture must carry on SOME event, or the three assertions above pass vacuously',
    );
  } finally { f.done(); }
});

test('/api/select?session=<id> never carries from the session it is previewing', () => {
  const f = fixture();
  try {
    const root = f.ws.projectRoot as string;
    appendSeen(root, 'sess-mine', [
      { id: 'RULE-always-use-posix-paths', tier: 'jit', at: '2026-08-20T09:00:00.000Z' },
    ]);

    // The only session on disk is the one being previewed. Carrying from
    // yourself is a no-op that reports success, and reporting it is the
    // failure — the same exclusion a live resume makes.
    assert.equal(
      (apiSelect(f.ws, url('select', 'event=session-start&session=sess-mine')).body as Selection)
        .index.carried,
      null,
    );

    // With an older session beside it, the preview carries from THAT one.
    appendSeen(root, 'sess-other', [
      { id: 'RULE-never-log-the-customer-email', tier: 'jit', at: '2026-08-19T09:00:00.000Z' },
    ]);
    const withOther = apiSelect(f.ws, url('select', 'event=session-start&session=sess-mine'));
    assert.equal(
      (withOther.body as Selection).index.carried?.sessionId, 'sess-other',
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
      ['event=session-start&cold=1', ['pinned', 'continuity', 'index']],
      ['event=manual&cold=1', ['pinned', 'continuity', 'index']],
      ['event=compact&cold=1', ['pinned', 'continuity', 'restored', 'index']],
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

// --- 3b · alreadyDeliveredIds / spillDelivered (plan:budget seq:9) ---------

/**
 * `alreadyDeliveredIds` in isolation: a pure join over synthetic `Spill[]` and
 * `SelectContext` values, no fixture and no server. `seen` and
 * `continuityDelivered` are the two sources the docstring names, each
 * exercised on its own so a future edit that drops one of them fails here
 * rather than only in the harder-to-read endpoint test below.
 */
test('alreadyDeliveredIds marks a spilled id delivered when seen OR continuityDelivered has it, and only those', () => {
  const spilled: Spill[] = [
    { id: 'RULE-a', tier: 'pinned', reason: 'x' },
    { id: 'RULE-b', tier: 'index', reason: 'x' },
    { id: 'RULE-c', tier: 'continuity', reason: 'x' },
  ];
  // Neither source set: nothing can be already-delivered, and the function
  // must not fabricate a claim from the ids alone.
  assert.deepEqual(alreadyDeliveredIds(spilled, { event: 'session-start' }), []);

  // `seen` alone.
  assert.deepEqual(
    alreadyDeliveredIds(spilled, { event: 'session-start', seen: ['RULE-a'] }),
    ['RULE-a'],
  );
  // `continuityDelivered` alone — the OTHER channel, and `RULE-a` staying out
  // proves this is not silently falling back to `seen`.
  assert.deepEqual(
    alreadyDeliveredIds(spilled, { event: 'session-start', continuityDelivered: ['RULE-c'] }),
    ['RULE-c'],
  );
  // Both at once, sorted — membership is a union, and the order is not the
  // input order (`RULE-c` precedes `RULE-a` there).
  assert.deepEqual(
    alreadyDeliveredIds(spilled, {
      event: 'session-start', seen: ['RULE-a'], continuityDelivered: ['RULE-c'],
    }),
    ['RULE-a', 'RULE-c'],
  );
  // An id in `seen`/`continuityDelivered` that never spilled contributes
  // nothing: this answers "which SPILLED ids are already held", not "what is
  // in `seen`" restated.
  assert.deepEqual(
    alreadyDeliveredIds(spilled, { event: 'session-start', seen: ['RULE-not-spilled'] }),
    [],
  );
});

/**
 * The endpoint, over a REAL index-tier spill — the one case (with `continuity`)
 * where a spilled id can legitimately be `seen`, per `alreadyDeliveredIds`'s
 * own docstring: `pinned`/`restored`/`jit` draw from `fresh` and can never
 * spill a `seen` id by construction, so this deliberately does not test those
 * three — a passing assertion there would prove nothing `select.ts` does not
 * already guarantee structurally.
 *
 * `RULE-always-use-posix-paths` is marked delivered through a real seen-file
 * append (what the hook writes), `RULE-never-log-the-customer-email` is not,
 * and an `index=1` override starves the index tier so BOTH spill — the two
 * genuinely different answers this join must tell apart.
 */
test('/api/simulate\'s spillDelivered names the spilled ids the seen file already holds, and only those', () => {
  const f = fixture();
  try {
    const root = f.ws.projectRoot as string;
    assert.equal(appendSeen(root, 'sess-1', [
      { id: 'RULE-always-use-posix-paths', tier: 'jit', at: '2026-08-20T10:00:00.000Z' },
    ]).written, true);

    const warm = apiSimulate(f.ws, url('simulate', 'event=session-start&session=sess-1&index=1'));
    assert.equal(warm.status, 200);
    const warmBody = warm.body as {
      selection: { spilled: { id: string; tier: string }[] };
      spillDelivered: string[];
    };
    const indexSpills = warmBody.selection.spilled.filter((s) => s.tier === 'index').map((s) => s.id);
    assert.deepEqual(
      indexSpills.sort(),
      ['RULE-always-use-posix-paths', 'RULE-never-log-the-customer-email'],
      'the fixture must actually starve the index tier for both candidates, or this test proves nothing',
    );
    assert.deepEqual(warmBody.spillDelivered, ['RULE-always-use-posix-paths'],
      'only the id the seen file records should read as already delivered');

    // The cold reading of the SAME starved index: nothing has been shown to a
    // brand-new window, so nothing spilled can be already-held — every id
    // reads GENUINELY ABSENT, by construction.
    const cold = apiSimulate(f.ws, url('simulate', 'event=session-start&cold=1&index=1'));
    const coldBody = cold.body as { spillDelivered: string[] };
    assert.deepEqual(coldBody.spillDelivered, []);
  } finally { f.done(); }
});

test('tiersRun is select()\'s own dispatch, not a copy of it', () => {
  // If `select` stops running a tier, this must stop naming it — which is why
  // `select` consumes `tiersRun` rather than restating the conditions.
  assert.deepEqual(tiersRun({ event: 'session-start' }), ['pinned', 'continuity', 'index']);
  assert.deepEqual(tiersRun({ event: 'compact' }), ['pinned', 'continuity', 'restored', 'index']);
  assert.deepEqual(tiersRun({ event: 'manual' }), ['pinned', 'continuity', 'index']);
  // Never on a tool event: continuity is the opposite of narrow, and a tool
  // event is narrow by construction — that is what the jit tier is for.
  assert.ok(!tiersRun({ event: 'tool', path: 'src/a.ts' }).includes('continuity'));
  assert.deepEqual(tiersRun({ event: 'tool', path: 'src/a.ts' }), ['jit']);
  // A tool event with no usable path reaches NO tier: the jit tier has
  // nothing to match scopes against and the bounded index is not a
  // per-tool-call cost.
  assert.deepEqual(tiersRun({ event: 'tool' }), []);
  assert.deepEqual(tiersRun({ event: 'tool', path: '' }), []);
});

// --- 3b · the sweep (`plan:walk seq:7`) -------------------------------------

test('/api/simulate/sweep refuses an unknown or missing tier', () => {
  const f = fixture();
  try {
    for (const qs of [
      'event=session-start&cold=1',
      'event=session-start&cold=1&tier=index',
      'event=session-start&cold=1&tier=nope',
    ]) {
      const result = apiSimulateSweep(f.ws, url('simulate/sweep', qs));
      assert.equal(result.status, 400, qs);
    }
  } finally { f.done(); }
});

test('/api/simulate/sweep answers absent-not-empty for a tier this event never reaches', () => {
  const f = fixture();
  try {
    // `jit` never runs on `session-start` — see `tiersRun`.
    const result = apiSimulateSweep(f.ws, url('simulate/sweep', 'event=session-start&cold=1&tier=jit'));
    assert.equal(result.status, 200);
    const body = result.body as {
      tier: string; tiersRun: string[]; candidateCount: number; truncated: boolean; rungs: unknown[];
    };
    assert.deepEqual(body.rungs, []);
    assert.equal(body.candidateCount, 0);
    assert.equal(body.truncated, false);
    assert.ok(!body.tiersRun.includes('jit'));
  } finally { f.done(); }
});

test('/api/simulate/sweep prices the one pinned candidate the fixture has', () => {
  const f = fixture();
  try {
    const result = apiSimulateSweep(f.ws, url('simulate/sweep', 'event=session-start&cold=1&tier=pinned'));
    assert.equal(result.status, 200);
    const body = result.body as {
      tier: string; tiersRun: string[]; candidateCount: number; truncated: boolean;
      rungs: { threshold: number; count: number; evicted: string[] }[];
    };
    assert.equal(body.tier, 'pinned');
    assert.ok(body.tiersRun.includes('pinned'));
    assert.equal(body.candidateCount, 1, 'the fixture pins exactly RULE-pin-me');
    assert.equal(body.truncated, false);
    // One candidate produces two rungs: budget 0 (nothing fits — always
    // kept, since there is no previous rung to compare it to) and the
    // candidate's own cost (it admits, and nowhere lower). Nothing is ever
    // evicted with only one candidate in play.
    assert.equal(body.rungs.length, 2);
    assert.deepEqual(body.rungs[0], { threshold: 0, count: 0, evicted: [] });
    assert.equal(body.rungs[1].count, 1);
    assert.deepEqual(body.rungs[1].evicted, []);
    assert.ok(body.rungs[1].threshold > 0);

    // The rung's own threshold really is the admission point: the selector,
    // re-run directly, agrees it admits nothing one token below it and
    // everything at or above it — proving the endpoint calls the real
    // selector rather than inventing the number.
    const below = select(
      f.items, { event: 'session-start' },
      { ...f.ws.config, budgets: { ...f.ws.config.budgets, pinned: body.rungs[1].threshold - 1 } },
    );
    assert.equal(below.full.filter((e) => e.tier === 'pinned').length, 0);
    const at = select(
      f.items, { event: 'session-start' },
      { ...f.ws.config, budgets: { ...f.ws.config.budgets, pinned: body.rungs[1].threshold } },
    );
    assert.equal(at.full.filter((e) => e.tier === 'pinned').length, 1);
  } finally { f.done(); }
});

/**
 * A dedicated corpus for the property no single-candidate fixture can show:
 * *"more budget, fewer items"* (`sim.evict`). Three pinned items, ids sorting
 * `aaa` < `bbb` < `ccc` (`byPriority`'s tie-break, `core/select.ts`), so the
 * selector always tries them in that order — big first. At a budget that
 * fits the two small items together but not the big one, both admit. Raise
 * the budget to the big item's own cost and it evicts BOTH — the exact
 * reversal the mockup's own demo thresholds show (4,520 → 5 items, 5,820 → 3
 * items).
 */
function evictionFixture(): Fixture {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-rm-sweep-'));
  const run = (args: string[]): void => {
    assert.equal(runCli(args, dir, () => {}), 0, `fixture command failed: ${args.join(' ')}`);
  };
  run(['init']);
  run(['add', '--summary-omitted', 'rule', 'AAA big pinned item', '--body', 'Big body text. '.repeat(400), '--yes']);
  run(['edit', 'RULE-aaa-big-pinned-item', '--always=true', '--yes']);
  run(['add', '--summary-omitted', 'rule', 'BBB medium pinned item', '--body', 'Medium body text. '.repeat(15), '--yes']);
  run(['edit', 'RULE-bbb-medium-pinned-item', '--always=true', '--yes']);
  run(['add', '--summary-omitted', 'rule', 'CCC small pinned item', '--body', 'Tiny body.', '--yes']);
  run(['edit', 'RULE-ccc-small-pinned-item', '--always=true', '--yes']);
  const ws = resolveWorkspace(dir);
  const store = Store.openReadOnlyChecked(ws.dbPath);
  const items = store.all();
  store.close();
  return { dir, ws, items, done: () => removeTree(dir) };
}

test('/api/simulate/sweep finds the eviction rung and names the evicted ids', () => {
  const f = evictionFixture();
  try {
    const result = apiSimulateSweep(f.ws, url('simulate/sweep', 'event=session-start&cold=1&tier=pinned'));
    assert.equal(result.status, 200);
    const body = result.body as {
      candidateCount: number; truncated: boolean;
      rungs: { threshold: number; count: number; evicted: string[] }[];
    };
    assert.equal(body.candidateCount, 3);
    assert.equal(body.truncated, false);

    // Thresholds strictly increase — the ladder is sorted, never re-sorted by
    // the client.
    for (let i = 1; i < body.rungs.length; i++) {
      assert.ok(body.rungs[i].threshold > body.rungs[i - 1].threshold, 'thresholds are sorted');
    }

    const fall = body.rungs.find((r, i) => i > 0 && r.count < body.rungs[i - 1].count);
    assert.ok(fall, `expected a rung where the count falls; got ${JSON.stringify(body.rungs)}`);
    assert.ok(fall!.evicted.length >= 1, 'the falling rung names what it evicted');
    assert.ok(
      fall!.evicted.includes('RULE-bbb-medium-pinned-item')
        || fall!.evicted.includes('RULE-ccc-small-pinned-item'),
      'the big item evicts the small ones it crowds out',
    );

    // Every rung's count is independently confirmed against a direct
    // `select()` call at that exact threshold — the sweep never invents a
    // count between two of its own probes.
    for (const rung of body.rungs) {
      const check = select(
        f.items, { event: 'session-start' },
        { ...f.ws.config, budgets: { ...f.ws.config.budgets, pinned: rung.threshold } },
      );
      assert.equal(
        check.full.filter((e) => e.tier === 'pinned').length, rung.count,
        `rung at ${rung.threshold} disagrees with a direct select() call`,
      );
    }

    // The last rung admits all three, and nothing beyond it changes anything
    // — the natural ceiling `sliderMaxFor`'s replacement reads.
    const last = body.rungs[body.rungs.length - 1];
    assert.equal(last.count, 3);
  } finally { f.done(); }
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
      'a not-projected corpus is an empty STATE, not a fault and not a refusal');
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
          'damage must not wear the not-projected class — the class IS the distinction',
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
 *    not-projected STATE, told from damage by CLASS. `{ default: null,
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
test('/api/sessions tells a not-projected corpus from an initialised, empty ledger', () => {
  const f = fixture();
  try {
    const fresh = apiSessions(f.ws, url('sessions', '')).body as SessionsBody;
    assert.equal(fresh.ledger, 'not-projected',
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

/**
 * **The default is the most recent SAMPLED session, not the most recent one.**
 *
 * Pinned because the two were the same thing until 2026-09-01, and the day they
 * came apart it cost the owner their whole status bar. Diagnostic hook probes
 * left three synthetic sessions as the three most recent injections; the bar
 * opened on one of them, that session had never been sampled, and every field
 * on it read "not read" — the same thing a bar reading nothing at all reads.
 *
 * The fixture below is that shape reduced to two rows: `s-probe` is newer and
 * has no sample, `s-real` is older and has one. `s-probe` must not be chosen,
 * and it must still be LISTED — this changes which row is selected, never which
 * rows exist.
 */
test('/api/sessions prefers the most recent session that has a statusline sample', () => {
  const f = fixture();
  try {
    const ledger = Ledger.open(f.ws.dbPath);
    ledger.record('s-real', 'RULE-pin-me', 'jit', '2026-08-01T10:00:00.000Z');
    ledger.record('s-probe', 'RULE-pin-me', 'jit', '2026-08-02T10:00:00.000Z');
    ledger.close();

    // Ordering first, so a failure below is about the CHOICE and not about a
    // fixture that never made `s-probe` the most recent session at all.
    const before = apiSessions(f.ws, url('sessions', '')).body as SessionsBody;
    assert.equal(before.default, 's-probe',
      'with no sample anywhere the old behaviour stands: the most recent injection wins');

    assert.equal(
      writeTee(f.ws.projectRoot!, { session_id: 's-real', model: { display_name: 'Opus' } }).written,
      true, 'the sample must reach .statusline/ or this test proves nothing',
    );

    const after = apiSessions(f.ws, url('sessions', '')).body as SessionsBody;
    assert.equal(after.default, 's-real',
      'the sampled session is the one somebody was working in; the unsampled newer one is not');
    assert.deepEqual(after.sessions.map((s) => s.sessionId), ['s-probe', 's-real'],
      'the LIST is untouched — this changes which row is selected, never which rows exist');
    assert.ok(after.sessions.some((s) => s.sessionId === after.default),
      'a default the picker does not list is a picker with no selected row');
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
test('/api/session/:session/injected reads the SEEN FILE, joins nothing, keeps vanished items', () => {
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
    assert.equal(body.seen, 'read', 'there is a seen file here and it was read');
    assert.deepEqual(body.lines.map((l) => [l.id, l.tier, l.at]), [
      [item.id, 'pinned', '2026-08-01T09:14:02.000Z'],
      ['RULE-gone', 'jit', '2026-08-01T09:22:41.000Z'],
      [item.id, 'jit', '2026-08-01T09:31:07.000Z'],
    ], 'one row per delivery, in file order, nothing deduped, sorted, grouped or dropped');
    // Two assertions stood here on `.title`: that line 0 carried the item's
    // current title, and that `RULE-gone` carried `null` rather than losing its
    // row. The FIELD was cut on 2026-08-26 (plan:ui1 seq:17f) — verified dead,
    // no reader in `src/ui/public/`, `src/mcp/` or `src/cli/`, and it cost a
    // full `store.all()` and a `JSON.parse` per item per request. What those
    // assertions were really protecting is the vanished item's ROW, and the
    // `deepEqual` above still measures it: `RULE-gone` is line 1 of three,
    // because the injection happened whether or not the corpus still holds it.
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
    // ...and it is not a MEASURED zero either. `seen` is the field that says
    // so: no file was opened here, so a client must not draw "this session was
    // read and has received nothing yet" over it
    // (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`).
    assert.equal(body.seen, 'absent',
      'the ENOENT the read observed reaches the client instead of being spent on an empty array');
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
    assert.equal(body.seen, 'read',
      'a file that exists and cannot be trusted is not an absent one: `absent` is spent on an '
      + 'observed ENOENT and nothing else, and `error` is what this state is disclosed by');
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

test('/api/session/:session/injected serves a not-projected corpus, and takes no parameters', () => {
  const f = fixture();
  try {
    // No ledger tables at all: the endpoint reads none, so the null state
    // costs it nothing — a fresh corpus answers 200 with an honest empty file.
    // `seen: 'absent'` is part of that honesty and is asserted in the WHOLE-body
    // shape deliberately: this is the one place the response's exact field set
    // is pinned, so a field added or dropped without a decision fails here.
    const result = apiInjected(f.ws, url('session/s1/injected', ''), { session: 's1' });
    assert.equal(result.status, 200);
    const body = result.body as InjectedBody;
    // The whole shape, still pinned: `spills` is new (`plan:budget seq:13`,
    // `TASK-the-already-in-context-split-only-appears-under-a-hand`) and its
    // own error is asserted by pattern rather than by exact string, because the
    // no-audit-projection message is `readSessionInjectionRecords`' wording and
    // this test is not the place that pins it — `injected-endpoints.test.ts` is.
    assert.deepEqual({ ...body, spills: { ...body.spills, error: null } }, {
      lines: [], error: null, seen: 'absent',
      spills: { alreadyInContext: [], genuinelyAbsent: [], error: null },
    });
    assert.match(String(body.spills.error), /mycontext audit/,
      'a corpus with no `.audit/db` at all is UNMEASURED, not the zero the shape above stands in for');
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
 * The not-projected corpus is the sharpest fixture available: the ledger
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
    // ledger tables, so a not-projected corpus that still reports the empty
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
    //
    // ── THE THREE LEVELS COUNT ONLY WHAT IS STILL OPEN, SINCE 2026-09-01.
    //
    // Owner: *"still the counter near the Doctor menu item is not refreshed
    // when something is handled."* Diagnosed before changing anything: the rail
    // IS subscribed and `mycontext ack` DOES write a `mutation`, so the refill
    // was firing and recomputing the same number — because this tally counted
    // findings a person had already ruled on. A badge says how much is WAITING,
    // and an acknowledged finding is not waiting for anyone.
    //
    // `acknowledged` is served beside them so nothing is dropped silently, and
    // the four numbers are asserted to SUM to what the checker returned — the
    // property that stops the split from losing a finding between the two.
    const findings = checksFor(ws, items);
    assert.deepEqual(body.health, {
      errors: findings.filter((x) => x.level === 'error' && x.acknowledged !== true).length,
      warnings: findings.filter((x) => x.level === 'warn' && x.acknowledged !== true).length,
      infos: findings.filter((x) => x.level === 'info' && x.acknowledged !== true).length,
      acknowledged: findings.filter((x) => x.acknowledged === true).length,
    });
    assert.equal(
      body.health.errors + body.health.warnings + body.health.infos + body.health.acknowledged,
      findings.length,
      'every finding the checker returned is in exactly one of the four numbers: a split that '
      + 'lost one would make the badge quietly under-report, which is the defect this whole '
      + 'change is against',
    );
    assert.deepEqual(body.health, { errors: 1, warnings: 7, infos: 1, acknowledged: 0 },
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
    // `summary_absent` on every item is the honest tail of this fixture: it
    // captures through `mycontext add --summary-omitted`, which is the named
    // opt-out, and doctor names exactly the items nothing else can reach.
    assert.deepEqual(findings.map((x) => [x.level, x.code, x.item ?? null]), [
      ['error', 'source_missing', 'RULE-a-captured-rule'],
      ['warn', 'dead_scope', 'RULE-always-use-posix-paths'],
      ['warn', 'dead_scope', 'RULE-never-log-the-customer-email'],
      ['info', 'scope_policy_required', null],
      ['warn', 'summary_absent', 'DEC-we-chose-sqlite'],
      ['warn', 'summary_absent', 'RULE-a-captured-rule'],
      ['warn', 'summary_absent', 'RULE-always-use-posix-paths'],
      ['warn', 'summary_absent', 'RULE-never-log-the-customer-email'],
      ['warn', 'summary_absent', 'RULE-pin-me'],
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

test('/api/decay tells a not-projected corpus from an initialised, empty ledger', () => {
  const f = fixture();
  try {
    const fresh = apiDecay(f.ws, url('decay', '')).body as DecayBody;
    assert.equal(fresh.ledger, 'not-projected');
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
 * **`not-projected` is a fact about the PROJECTION, not about injection.**
 *
 * The ledger table is a projection of the audit log and the only thing that
 * writes it is `topUpLedger`, which `status`, `decay` and `audit
 * replay-ledger` call and nothing else does — the hook stopped writing it when
 * dedupe state moved to the seen file. So a corpus that has been injected into
 * and never had an aggregate CLI reader run against it has NO ledger tables,
 * and every endpoint carrying `LedgerPresence` calls it `not-projected`.
 *
 * This test does not assert that the state is right. It records what the name
 * currently means, by producing an injection that really happened, on disk, in
 * the log the replayer reads — and then showing the read surface answering
 * "never" about it, one `topUpLedger` away from the truth.
 */
test('"not-projected" is a fact about the PROJECTION, not about injection', () => {
  const f = fixture();
  try {
    const root = f.ws.projectRoot!;
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 'sess-real', hook: 'PreToolUse',
      injected: [{ id: 'RULE-pin-me', tier: 'jit' }],
    });

    const body = apiDecay(f.ws, url('decay', '')).body as DecayBody;
    assert.equal(body.ledger, 'not-projected',
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

// --- 7 · coverage, graph, items and corpus-joined help ----------------------

/**
 * Repository files, written OUTSIDE `.my_context/` — which is the only place
 * `listRepoFiles` will look at all (`SKIP_DIRS` excludes the workspace, so a
 * fixture that writes only items produces a coverage map with no files in it
 * and every assertion below passes vacuously).
 */
function repoFiles(dir: string, files: string[]): void {
  for (const file of files) {
    const full = path.join(dir, ...file.split('/'));
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, `// ${file}\n`);
  }
}

/**
 * The coverage fixture: `fixture()` plus the two items that make the rule
 * composition falsifiable, and three repository files to colour.
 *
 * - **an unscoped, non-`always`, active rule.** `matchesScope` returns true
 *   for it on EVERY path (an empty scope is unrestricted under the default
 *   `global` policy), while `matchesAnyGlob(path, [])` returns false on every
 *   path. It is the whole difference between the rule and the defect
 *   `select.ts` documents by name, and without it the two are one answer.
 * - **a draft rule scoped to `src/**`** — `matchesScope` says yes and
 *   `injection().injected` says no, so it is the item that fails if the
 *   `injection()` half is dropped.
 */
function coverageFixture(): { f: Fixture; ws: Workspace; repoRoot: string } {
  const f = fixture();
  const run = (args: string[]): void => {
    assert.equal(runCli(args, f.dir, () => {}), 0, `fixture command failed: ${args.join(' ')}`);
  };
  run(['add', '--summary-omitted', 'rule', 'Unscoped rule', '--body', 'No scope at all, and not pinned.', '--yes']);
  run(['add', '--summary-omitted', 'rule', 'Draft rule', '--scope', 'src/**', '--body', 'Not promoted yet.', '--yes']);
  run(['edit', 'RULE-draft-rule', '--status', 'draft', '--yes']);
  repoFiles(f.dir, ['src/a.ts', 'src/deep/b.ts', 'top.md']);
  return { f, ws: resolveWorkspace(f.dir), repoRoot: f.dir };
}

test('/api/coverage colours a file through matchesScope AND injection(), never a bare glob', () => {
  const { f, ws, repoRoot } = coverageFixture();
  try {
    const result = apiCoverage(ws, url('coverage', ''));
    assert.equal(result.status, 200);
    const body = result.body as CoverageBody;

    // The file list is `listRepoFiles`' own answer, not a second walk.
    assert.deepEqual(body.files.map((entry) => entry.path), listRepoFiles(repoRoot),
      'the coverage map walks the repository through listRepoFiles and nothing else');
    assert.deepEqual(body.files.map((entry) => entry.path), ['src/a.ts', 'src/deep/b.ts', 'top.md'],
      'non-vacuity: the walk must actually have found the three files the fixture wrote');

    const governs = (file: string): string[] =>
      [...body.files.find((entry) => entry.path === file)!.governs].sort();

    // `src/**` matches both src files and neither matches `top.md`; the
    // UNSCOPED rule matches all three, which is exactly what a bare
    // `matchesAnyGlob(path, item.scope)` would get wrong on every one of them.
    assert.deepEqual(governs('src/a.ts'), [
      'RULE-always-use-posix-paths', 'RULE-never-log-the-customer-email', 'RULE-unscoped-rule',
    ]);
    assert.deepEqual(governs('src/deep/b.ts'), [
      'RULE-always-use-posix-paths', 'RULE-never-log-the-customer-email', 'RULE-unscoped-rule',
    ]);
    assert.deepEqual(governs('top.md'), ['RULE-unscoped-rule'],
      'an unscoped item is UNRESTRICTED, so it governs a path no glob in the corpus names');

    // Pinned is path-independent and hoisted out of the tree entirely.
    assert.deepEqual(body.pinned, ['RULE-pin-me']);
    for (const entry of body.files) {
      assert.ok(!entry.governs.includes('RULE-pin-me'),
        'an always item governs sessions, not paths — colouring it per-path is the defect ' +
        'cov.pinhelp records');
    }

    // The two items `matchesScope` alone would colour and `injection()` refuses.
    for (const id of ['DEC-we-chose-sqlite', 'RULE-draft-rule']) {
      for (const entry of body.files) {
        assert.ok(!entry.governs.includes(id), `${id} must colour nothing (${entry.path})`);
      }
      assert.equal(body.items.find((i) => i.id === id)?.injected, false, id);
    }
    assert.equal(
      body.items.find((i) => i.id === 'RULE-draft-rule')?.phrase,
      'not injected (status "draft")',
      'the phrase is injection()\'s own, so this screen and `mycontext edit` say one thing',
    );

    // The same two items, as CODES. Their phrases differ only in English, so
    // a screen asking "why does this colour nothing" had to match on prose —
    // and the two answers are not even the same rung.
    assert.deepEqual(
      ['RULE-draft-rule', 'DEC-we-chose-sqlite'].map(
        (id) => body.items.find((i) => i.id === id)?.gate),
      ['eligible', 'tier'],
      'rung 1 and rung 2, in a word each — the answer the ladder itself gives',
    );

    // Every item is listed, injected or not — the screen needs the ones that
    // colour nothing in order to say WHY a directory is a gap.
    const indexed = withStores(ws, (store) => store.all());
    assert.deepEqual(body.items.map((i) => i.id).sort(), [
      'DEC-we-chose-sqlite', 'RULE-always-use-posix-paths', 'RULE-draft-rule',
      'RULE-never-log-the-customer-email', 'RULE-pin-me', 'RULE-unscoped-rule',
    ]);
    for (const summary of body.items) {
      const item = indexed.find((i) => i.id === summary.id)!;
      assert.deepEqual(
        { injected: summary.injected, phrase: summary.phrase, gate: summary.gate },
        injection(item, ws.config),
        `${summary.id}: the verdict is injection()'s, composed rather than restated`,
      );
    }
    assert.equal(body.truncated, false);
  } finally { f.done(); }
});

/**
 * `truncated` at the bound, proved where it is affordable to prove it.
 *
 * `apiCoverage` walks with `COVERAGE_FILE_LIMIT` (20,000), and building a
 * repository that overflows it costs ~19 seconds of file creation on the
 * machine this was written on — measured, not guessed. So the decision lives
 * in `coverageFiles`, whose bound is a parameter, and the endpoint's own
 * wiring is proved by composition in the test above (`truncated: false` over a
 * three-file corpus) rather than at 20,000 files. **Stated rather than
 * implied: no test here drives `apiCoverage` itself past its bound.**
 */
test('coverageFiles stops at its bound and DISCLOSES that it stopped', () => {
  const f = fixture();
  try {
    repoFiles(f.dir, ['a.ts', 'b.ts', 'c.ts', 'd.ts']);
    assert.deepEqual(coverageFiles(f.dir, 10), {
      files: ['a.ts', 'b.ts', 'c.ts', 'd.ts'], truncated: false,
    });
    assert.deepEqual(coverageFiles(f.dir, 2), { files: ['a.ts', 'b.ts'], truncated: true });
    // The boundary a bare `files.length >= LIMIT` gets wrong: a repository
    // holding EXACTLY the bound was walked to the end, and reporting it as
    // truncated draws a "not examined" segment over a directory that was.
    assert.deepEqual(coverageFiles(f.dir, 4), {
      files: ['a.ts', 'b.ts', 'c.ts', 'd.ts'], truncated: false,
    });
    assert.equal(COVERAGE_FILE_LIMIT, 20_000);
  } finally { f.done(); }
});

/**
 * **`/api/coverage` at its real bound.** `truncated` is the whole of what this
 * response can say about a walk that stopped, and a disclosure field nothing
 * ever drives past its threshold is a disclosure nobody has seen work.
 *
 * The cost is stated because it is the reason this is one test and not a
 * pattern: 20,001 empty files take ~5s to create and ~2.5s to remove
 * (measured on win32 while writing this). `coverageFiles` above carries the
 * same logic with an injectable bound and is exercised at 2, 4 and 10 — this
 * one exists because the endpoint's own wiring is what a client reads, and a
 * `truncated: false` written straight into the body passes every cheap test
 * in this file.
 *
 * **One fixture, two requests, and the second one is why the cost went up.**
 * The paged request below is the ONLY producer of `page.uncounted` — the
 * "could not be counted" state exists exactly when the walk stopped, so no
 * cheap fixture can reach it — and it pays for a second walk of the same
 * 20,001 files (this test now runs ~2× its former wall time). The alternative
 * was a walk bound injected into `apiCoverage` for the tests' benefit, which
 * buys speed by making the handler's signature answer to a test rather than to
 * a caller. Reusing the fixture that already exists is the smaller change.
 */
test('/api/coverage discloses a walk that stopped at COVERAGE_FILE_LIMIT', () => {
  const f = fixture();
  try {
    for (let i = 0; i <= COVERAGE_FILE_LIMIT; i++) {
      if (i % 2000 === 0) mkdirSync(path.join(f.dir, 'bulk', `d${i / 2000}`), { recursive: true });
      writeFileSync(path.join(f.dir, 'bulk', `d${Math.floor(i / 2000)}`, `f${i}`), '');
    }
    const body = apiCoverage(resolveWorkspace(f.dir), url('coverage', '')).body as CoverageBody;
    assert.equal(body.files.length, COVERAGE_FILE_LIMIT,
      'the walk is bounded, and the response carries the bound\'s worth of paths');
    assert.equal(body.truncated, true,
      'the map is PARTIAL and says so — a coverage tree that drew this as complete would ' +
      'report every unwalked directory as a gap, which `gaps.note` rules out by name');
    // And what it still cannot say, asserted as the gap it is: nothing in this
    // response names WHICH paths the walk did not reach, so the tree's third
    // magnitude segment and the gaps table's "vendor/ — not examined" cannot
    // be drawn from it. Recorded here so Task 18 does not infer them.
    assert.ok(!Object.hasOwn(body, 'notExamined'),
      'no per-path not-examined data exists yet; see coverageFiles');

    // **The third state, on the one fixture that can produce it.** A page over
    // a walk that stopped cannot report how many paths it left out, because
    // nobody counted the repository: `matched.length` here is a count over the
    // 20,000 paths the walk reached, and serving it as the total would present
    // a lower bound as a measurement. So `omitted` is `null` and `uncounted`
    // NAMES the walk that could not answer — never a `0`, which would say the
    // page holds everything.
    const paged = apiCoverage(resolveWorkspace(f.dir), url('coverage', 'limit=5'))
      .body as CoverageBody;
    assert.equal(paged.files.length, 5);
    assert.equal(paged.page?.omitted, null,
      'a total nobody could take is not a zero — INV-nothing-is-dropped-silently');
    assert.match(paged.page?.uncounted ?? '', /listRepoFiles/,
      'the disclosure names WHICH store could not answer, not merely that one could not');
    assert.equal(paged.page?.more, true);
    assert.equal(paged.truncated, true,
      '`truncated` still says the WALK stopped, unchanged, for the frozen screens that read it');
  } finally { f.done(); }
});

/**
 * **The parameterless answer is the SAME BYTES it was before this endpoint
 * could page, and this is the comparison that says so.**
 *
 * Four screens call `ctx.api('/api/coverage')` with no query string —
 * `screens/coverage.js`, `screens/gaps.js`, `screens/preview.js` and
 * `screens/simulate.js` — and all four are frozen. A field appearing in that
 * body is a change to a response four un-updatable readers parse, so the
 * parameters are OPT-IN and the default is untouched.
 *
 * The digest is the PRE-CHANGE body's, taken by running `apiCoverage` over
 * this fixture from the working tree as it stood before the parameters
 * existed. Printing the NEW body and pasting its digest back would assert only
 * that the code is what it is. Both halves are pinned, because they fail
 * differently: the key list catches an added or reordered field with a
 * readable message, and the digest catches a changed VALUE the key list cannot
 * see.
 *
 * ── RE-BASED ONCE, 2026-09-01, AND ONLY THE DIGEST ────────────────────────
 *
 * `plan:walk seq:119` phase 3 put `summary` and `summaryState` on
 * `ItemSummary`, the ONE item shape this endpoint and `/api/items` share —
 * `apiCoverage` "serves the superset rather than a second near-copy of it",
 * and splitting the two to keep a digest still would have created exactly the
 * two-spellings-of-one-row defect that comment refuses. So the bytes moved on
 * purpose, and the digest below is the post-change body's.
 *
 * **A re-pinned digest asserts only that the code is what it is, which is why
 * it is no longer the only assertion here.** `PRE_SUMMARY_ITEM_KEYS` is what
 * the frozen screens actually read, pinned by NAME: the change that had to stay
 * impossible is a field DISAPPEARING from an item, and a digest could never
 * tell that apart from a field arriving. Adding a key is invisible to a JS
 * reader of these entries; removing one is what breaks four screens.
 *
 * The next change to these bytes gets the same treatment: state what moved
 * them, or leave them alone.
 */
const PRE_SUMMARY_ITEM_KEYS = [
  'always', 'gate', 'id', 'injected', 'phrase', 'scope', 'status', 'title', 'type',
];
test('/api/coverage answers the pre-paging bytes when no parameter is given', () => {
  const { f, ws } = coverageFixture();
  try {
    const body = apiCoverage(ws, url('coverage', '')).body as CoverageBody;
    assert.deepEqual(Object.keys(body), ['files', 'pinned', 'items', 'truncated'],
      'the four keys the frozen screens read, in the order they were served in');
    assert.ok(!Object.hasOwn(body, 'page'),
      'the disclosure block is opt-in: a caller that asked for no page is told about no page, ' +
      'because a key appearing unasked changes the answer four frozen screens parse');
    for (const entry of body.items) {
      const keys = Object.keys(entry);
      assert.deepEqual(PRE_SUMMARY_ITEM_KEYS.filter((k) => !keys.includes(k)), [],
        'an item entry lost a field the four frozen screens read. A field ARRIVING here is ' +
        'invisible to them; a field leaving is what breaks them, and the digest below cannot ' +
        'tell the two apart');
    }
    // ── MOVED 2026-09-01, AND THIS IS THE REASON THE HEADER ABOVE DEMANDS.
    //
    // `ItemSummary` gained `relations` — an item's relation DEGREE, counting
    // both directions — and `relationKinds`, the distinct types that touch it,
    // so the Relations picker can stop offering the 702 items in this project's
    // own corpus that would draw a single node alone, and can re-test that
    // against the reader's type filter (two owner rulings, same day). Only
    // `/api/items` walks the whole store, so only `/api/items` can count them;
    // `apiCoverage` emits the same summary shape and therefore carries both as
    // `null`, which is the fields' own spelling of "not measured here" and never
    // a zero or an empty set it did not take.
    //
    // A key ARRIVING is invisible to the four frozen screens — the assertion
    // above is what holds the line that matters, that no key LEFT — and this
    // digest is re-pinned rather than relaxed.
    assert.equal(
      createHash('sha256').update(JSON.stringify(body)).digest('hex'),
      '04f02c3f6c77574e814b2b11061d81b54f92cde5767c785272742506415e2b50',
      'the bytes /api/coverage answers moved, and the only recorded reason for that is the ' +
      'summary fields of 2026-09-01. Re-pin this only with the reason written above it',
    );
  } finally { f.done(); }
});

/**
 * **A page, and what it left out — the three states, told apart.**
 *
 * `limit + 1` is the probe `corpusSelect` settled on
 * (`ui/ask-model.ts` · `export function corpusSelect(f: CorpusFilter): { sql: string; params: (string | number)[] } {` · ~111),
 * asserted at both sides of a bound of 2 for the reason `coverageFiles` is:
 * `files.length >= limit` cannot tell an answer holding EXACTLY the page from
 * one holding more, so it reports a complete answer as a partial one.
 *
 * `omitted` is the count `plan:ui1 seq:17e` asks the endpoint to carry — *"a
 * truncated list must SAY it is truncated and how many were left out"* — and
 * it counts every matching path this answer does not hold, the ones `offset`
 * skipped included. `more` is a different fact and is not derivable from it:
 * with an offset in play a page can leave two out and still be the last page.
 */
test('/api/coverage pages with limit and offset, and says how many paths it left out', () => {
  const { f, ws } = coverageFixture();
  try {
    const whole = apiCoverage(ws, url('coverage', '')).body as CoverageBody;
    assert.deepEqual(whole.files.map((e) => e.path), ['src/a.ts', 'src/deep/b.ts', 'top.md'],
      'non-vacuity: three walked files, so a limit of 2 has something to leave out');

    const first = apiCoverage(ws, url('coverage', 'limit=2')).body as CoverageBody;
    assert.deepEqual(first.files, whole.files.slice(0, 2),
      'a page is a WINDOW on the one answer — the same rows carrying the same governs, ' +
      'never a second composition of the same question');
    assert.deepEqual(first.page, {
      path: null, limit: 2, offset: 0, more: true, omitted: 1, uncounted: null,
    });

    const second = apiCoverage(ws, url('coverage', 'limit=2&offset=2')).body as CoverageBody;
    assert.deepEqual(second.files, whole.files.slice(2));
    assert.deepEqual(second.page, {
      path: null, limit: 2, offset: 2, more: false, omitted: 2, uncounted: null,
    }, 'the last page: two paths left out behind the offset, and none past it');

    // The boundary a bare `files.length >= limit` gets wrong. An answer holding
    // EXACTLY the page was served in full, and `more: true` here would send a
    // picker after a page that does not exist.
    const exact = apiCoverage(ws, url('coverage', 'limit=3')).body as CoverageBody;
    assert.deepEqual(exact.files, whole.files);
    assert.deepEqual(exact.page, {
      path: null, limit: 3, offset: 0, more: false, omitted: 0, uncounted: null,
    }, 'this is everything: nothing past the page, nothing behind the offset, nothing uncounted');

    // An offset past the end is an empty PAGE and not an empty ANSWER: three
    // paths matched and this response carries none of them, which is exactly
    // what `omitted` says.
    const past = apiCoverage(ws, url('coverage', 'offset=9')).body as CoverageBody;
    assert.deepEqual(past.files, []);
    assert.deepEqual(past.page, {
      path: null, limit: null, offset: 9, more: false, omitted: 3, uncounted: null,
    });

    // Paging windows the FILE list and nothing else: `pinned` and `items` are
    // corpus-wide answers, and a screen whose item list shrank with the tree
    // would lose the items it needs to say why a directory is a gap.
    for (const body of [first, second, exact, past]) {
      assert.deepEqual(body.pinned, whole.pinned);
      assert.deepEqual(body.items, whole.items);
      assert.equal(body.truncated, false);
    }
  } finally { f.done(); }
});

/**
 * **The search half.** The picker's problem is 614 options with no way to find
 * one (`plan:ui1 seq:17e`), and a cap alone answers half of it: a capped list
 * that cannot be searched hides the file the reader came for.
 *
 * A SUBSTRING, not a glob. `/api/glob` already owns the glob question
 * (`ui/read-model-work.ts` · `export function apiGlob(ws: Workspace, url: URL): JsonResult {` · ~239)
 * and answers it with `matchesAnyGlob`; a second glob implementation reachable
 * from a different parameter is how two surfaces come to disagree about what
 * `src/**` means.
 */
test('/api/coverage?path= filters the walk, and the disclosure counts the matches', () => {
  const { f, ws } = coverageFixture();
  try {
    const src = apiCoverage(ws, url('coverage', 'path=src/')).body as CoverageBody;
    assert.deepEqual(src.files.map((e) => e.path), ['src/a.ts', 'src/deep/b.ts']);
    assert.deepEqual(src.page, {
      path: 'src/', limit: null, offset: 0, more: false, omitted: 0, uncounted: null,
    }, 'an uncapped filtered answer holds every match, and says it left nothing out');

    // Case-insensitive, because a picker is typed into and a reader who types
    // `SRC` is not asking a different question.
    const shouty = apiCoverage(ws, url('coverage', 'path=SRC/')).body as CoverageBody;
    assert.deepEqual(shouty.files, src.files);

    // Filter and cap together — the shape the picker actually needs.
    const capped = apiCoverage(ws, url('coverage', 'path=src/&limit=1')).body as CoverageBody;
    assert.deepEqual(capped.files.map((e) => e.path), ['src/a.ts']);
    assert.deepEqual(capped.page, {
      path: 'src/', limit: 1, offset: 0, more: true, omitted: 1, uncounted: null,
    });

    // Nothing matched is a real answer with a real zero: the walk ran, the
    // count was taken, and it came to nothing. That is NOT the uncounted
    // state, and `uncounted: null` is what keeps the two apart.
    const none = apiCoverage(ws, url('coverage', 'path=vendor')).body as CoverageBody;
    assert.deepEqual(none.files, []);
    assert.deepEqual(none.page, {
      path: 'vendor', limit: null, offset: 0, more: false, omitted: 0, uncounted: null,
    });

    // The filter narrows the FILE list and never the corpus.
    const whole = apiCoverage(ws, url('coverage', '')).body as CoverageBody;
    assert.deepEqual(none.items, whole.items);
    assert.deepEqual(none.pinned, whole.pinned);
  } finally { f.done(); }
});

/**
 * Every parameter this endpoint cannot act on is refused BY NAME
 * (INV-nothing-is-dropped-silently). Digits only, for the reason `/api/decay`
 * and `/api/graph` are digits only: `Number('')` is `0` and `Number(' 2 ')` is
 * `2`, so a caller who sent a stray space would be answered about a page they
 * never asked for.
 */
test('/api/coverage refuses a page it cannot act on, and names what it accepts', () => {
  const { f, ws } = coverageFixture();
  try {
    for (const [qs, pattern] of [
      ['limit=0', /limit must be written in digits/],
      ['limit=-1', /limit must be written in digits/],
      ['limit=1.5', /limit must be written in digits/],
      ['limit=%202', /limit must be written in digits/],
      ['limit=1e1', /limit must be written in digits/],
      ['limit=20001', /limit must be written in digits/],
      ['limit=', /limit must be written in digits/],
      ['offset=-1', /offset must be written in digits/],
      ['offset=x', /offset must be written in digits/],
      ['offset=20001', /offset must be written in digits/],
      ['path=', /path=<substring> must not be empty/],
      ['path=%20%20', /path=<substring> must not be empty/],
      ['limit=1&limit=2', /parameter "limit" was given more than once/],
      ['sort=title', /unknown parameter "sort"/],
    ] as const) {
      const refused = apiCoverage(ws, url('coverage', qs));
      assert.equal(refused.status, 400, `coverage?${qs} must be refused`);
      assert.match((refused.body as { error: string }).error, pattern, `coverage?${qs}`);
    }
    // And the refusal NAMES the three it does take, so a caller learns the
    // shape from the error rather than from the source.
    assert.match(
      (apiCoverage(ws, url('coverage', 'sort=title')).body as { error: string }).error,
      /this endpoint accepts: path, limit, offset/,
    );
  } finally { f.done(); }
});

test('/api/items, /api/item and /api/help accept no parameters, and say so', () => {
  const f = fixture();
  try {
    for (const result of [
      apiItems(f.ws, url('items', 'sort=title')),
      apiHelp(f.ws, url('help/scope', 'lang=he'), { topic: 'scope' }),
      apiItem(f.ws, url('item/RULE-pin-me', 'full=1'), { id: 'RULE-pin-me' }),
    ]) {
      assert.equal(result.status, 400);
      assert.match((result.body as { error: string }).error, /this endpoint accepts no parameters/);
    }
  } finally { f.done(); }
});

/**
 * Relations, written straight into the index — the way `enrich` above writes a
 * `source_missing` item, and for the same reason: the subject is the
 * traversal, not the capture path. `linkItems` takes a `MutationContext` (the
 * write surface this module may not touch) and refuses a target that is not in
 * the corpus, so it cannot produce the dangling edge this endpoint exists to
 * make visible.
 */
function relate(f: Fixture, edges: { from: string; type: string; to: string }[]): Workspace {
  const writable = Store.open(f.ws.dbPath);
  try {
    const byId = new Map(writable.all().map((i) => [i.id, i]));
    const grouped = new Map<string, Relation[]>();
    for (const edge of edges) {
      grouped.set(edge.from, [...grouped.get(edge.from) ?? [], { type: edge.type, target: edge.to }]);
    }
    for (const [id, relations] of grouped) {
      const item = byId.get(id);
      assert.ok(item, `relate(): ${id} is not in the fixture`);
      writable.upsert({ ...item, relations });
    }
  } finally { writable.close(); }
  return resolveWorkspace(f.dir);
}

const A = 'RULE-always-use-posix-paths';
const B = 'RULE-never-log-the-customer-email';
const C = 'RULE-pin-me';
const D = 'DEC-we-chose-sqlite';

test('/api/graph walks both directions, keeps dangling edges, and classifies severity', () => {
  const f = fixture();
  try {
    const ws = relate(f, [
      { from: A, type: 'constrains', to: B },            // outgoing, load-bearing
      { from: A, type: 'relates_to', to: 'RULE-ghost' }, // outgoing, dangling, referential
      { from: C, type: 'depends_on', to: A },            // INCOMING — the direction a one-way walk loses
      { from: D, type: 'relates_to', to: C },            // reachable at radius 2 only
    ]);

    const one = apiGraph(ws, url('graph', `focus=${A}&radius=1`));
    assert.equal(one.status, 200);
    const body = one.body as GraphBody;
    assert.equal(body.focus, A);
    // Neighbours are ordered by relation type then id, so the whole answer is
    // pinned rather than sampled: a re-ordering is a different drawing.
    assert.deepEqual(body.nodes, [
      { id: A, title: 'Always use POSIX paths', type: 'rule', status: 'active', missing: false },
      { id: B, title: 'Never log the customer email', type: 'rule', status: 'active', missing: false },
      { id: C, title: 'Pin me', type: 'rule', status: 'active', missing: false },
      { id: 'RULE-ghost', title: null, type: null, status: null, missing: true },
    ]);
    assert.deepEqual(body.edges, [
      { from: A, to: B, type: 'constrains', dangling: false, loadBearing: true },
      { from: C, to: A, type: 'depends_on', dangling: false, loadBearing: true },
      { from: A, to: 'RULE-ghost', type: 'relates_to', dangling: true, loadBearing: false },
    ]);
    assert.equal(body.omitted, 0);
    // `isLoadBearing` is the classifier, called HERE rather than re-listed in
    // the browser: a dangling `relates_to` is noise and a dangling
    // `constrains` is an alarm, and only this side knows which is which.
    for (const edge of body.edges) {
      assert.equal(edge.loadBearing, isLoadBearing(edge.type), edge.type);
    }
    assert.ok(body.edges.some((e) => e.dangling && !e.loadBearing),
      'non-vacuity: the fixture must hold a dangling REFERENTIAL edge, or the two line styles ' +
      'the legend distinguishes are one style here');
    assert.ok(body.edges.some((e) => !e.dangling && e.loadBearing));

    const two = apiGraph(ws, url('graph', `focus=${A}&radius=2`)).body as GraphBody;
    assert.deepEqual(two.nodes.map((n) => n.id), [A, B, C, 'RULE-ghost', D],
      'radius 2 reaches D through C, and only at radius 2');
    assert.deepEqual(two.edges.at(-1),
      { from: D, to: C, type: 'relates_to', dangling: false, loadBearing: false });
    assert.equal(two.omitted, 0);

    // An omitted radius is 1 — the graph the screen opens with — and that is
    // asserted against a corpus where 1 and 2 are demonstrably different
    // answers, or the default is untestable.
    assert.deepEqual(apiGraph(ws, url('graph', `focus=${A}`)).body, body,
      'radius defaults to 1');
    assert.notDeepEqual(json(body), json(two),
      'non-vacuity: radius 2 must be a different graph, or the default proves nothing');
  } finally { f.done(); }
});

/**
 * **THE FILTER OFFERS WHAT THE CORPUS HOLDS, not only what may be WRITTEN.**
 *
 * `RELATION_TYPES` is a write gate: `superseded_by` is deliberately absent so it
 * cannot be forged through `linkItems`, and only `supersedeItem` may write one.
 * That omission is load-bearing and is asserted below rather than assumed.
 *
 * Serving that gate as the graph's DISPLAY vocabulary conflated two different
 * lists. The screen filters with `kept.has(edge.type)` over the types served, so
 * an edge whose type is never offered can never be in the kept set: it is
 * permanently undrawable, counted as hidden in every state of the filter, with no
 * control that brings it back.
 *
 * Nine items in the dogfooding corpus carry one, and the owner reported the
 * symptom on `OPENQ-how-does-the-ui-reach-a-model-and-what-leaves-the-machine`,
 * whose ONLY relation is `superseded_by` — so it answered "no relation of the
 * types you kept" whatever the reader kept. Nothing tested this, which is how a
 * whole relation type stayed invisible.
 */
test('/api/graph serves a relation type the write gate excludes but the corpus holds', () => {
  const f = fixture();
  try {
    const ws = relate(f, [{ from: A, type: 'superseded_by', to: B }]);
    const body = apiGraph(ws, url('graph', `focus=${A}&radius=1`)).body as GraphBody;

    assert.ok(!RELATION_TYPES.includes('superseded_by'),
      'non-vacuity: this test says nothing unless the write gate really does exclude it');
    assert.ok(body.edges.some((e) => e.type === 'superseded_by'),
      'non-vacuity: the fixture must actually carry the edge');

    assert.ok(body.relationTypes.includes('superseded_by'),
      'an edge of a type the filter never offers can never be kept, and is therefore '
      + 'undrawable in every state of the filter');
    assert.deepEqual(body.relationTypes.slice(0, RELATION_TYPES.length), [...RELATION_TYPES],
      'the closed vocabulary leads, in its authored order — the filter buttons do not '
      + 'reshuffle because a corpus grew an edge');
    assert.deepEqual(body.relationTypes, [...new Set(body.relationTypes)],
      'a type offered twice would draw two buttons for one filter');
  } finally { f.done(); }
});

/**
 * **Two edges whose ends concatenate to the same string are two edges.**
 *
 * The de-duplication key has to hold three parts, and a bare concatenation
 * makes `(RULE-a, -x-y)` and `(RULE-a-x, -y)` one key — so the second edge is
 * dropped, silently, from a graph whose whole job is to show what points at
 * what. It is reachable with ordinary ids: two items whose ids share a prefix
 * (`mycontext add rule "A"` and `"A x"`), and two DANGLING targets, which are
 * free text an author typed and not ids this product minted.
 */
test('/api/graph tells two edges apart when their ends concatenate to one string', () => {
  const f = fixture();
  try {
    const run = (args: string[]): void => {
      assert.equal(runCli(args, f.dir, () => {}), 0, `fixture command failed: ${args.join(' ')}`);
    };
    run(['add', '--summary-omitted', 'rule', 'A', '--body', 'The shorter id.', '--yes']);
    run(['add', '--summary-omitted', 'rule', 'A x', '--body', 'The id that extends it.', '--yes']);
    const ws = relate(f, [
      { from: 'RULE-a', type: 'depends_on', to: 'RULE-a-x' },
      { from: 'RULE-a', type: 'relates_to', to: '-x-y' },
      { from: 'RULE-a-x', type: 'relates_to', to: '-y' },
    ]);
    // 'RULE-a' + '-x-y' and 'RULE-a-x' + '-y' are both 'RULE-a-x-y'.
    assert.equal('RULE-a' + '-x-y', 'RULE-a-x' + '-y',
      'non-vacuity: if these stop concatenating alike the fixture proves nothing');

    const body = apiGraph(ws, url('graph', 'focus=RULE-a&radius=2')).body as GraphBody;
    assert.deepEqual(body.edges, [
      { from: 'RULE-a', to: 'RULE-a-x', type: 'depends_on', dangling: false, loadBearing: true },
      { from: 'RULE-a', to: '-x-y', type: 'relates_to', dangling: true, loadBearing: false },
      { from: 'RULE-a-x', to: '-y', type: 'relates_to', dangling: true, loadBearing: false },
    ]);
  } finally { f.done(); }
});

test('/api/graph caps the node set and counts the NODES it left out, not the edges', () => {
  const f = fixture();
  try {
    const ghosts = Array.from({ length: 70 }, (_, i) => `GHOST-${String(i).padStart(3, '0')}`);
    const ws = relate(f, [
      // Written in REVERSE id order, so "sorted by type then id" and "the
      // order the relations happen to be stored in" are different answers —
      // a sort that only compares the type is stable and would keep this one.
      ...[...ghosts].reverse().map((to) => ({ from: C, type: 'relates_to', to })),
      // A SECOND edge to a ghost the cap already excluded, of a type that
      // sorts AFTER `relates_to` so it is met once the cap is full. An
      // `omitted` that counts edge encounters reports 12 here; the field the
      // spec fixes counts nodes, and there are 11.
      { from: C, type: 'unblocks', to: 'GHOST-069' },
    ]);

    const body = apiGraph(ws, url('graph', `focus=${C}&radius=1`)).body as GraphBody;
    assert.equal(GRAPH_NODE_CAP, 60);
    assert.equal(body.nodes.length, GRAPH_NODE_CAP);
    assert.equal(body.omitted, 11,
      'omitted counts NODES past the cap: 70 ghosts, 59 kept beside the focus, 11 left out — ' +
      'and GHOST-069 is one node however many edges reach it');
    assert.equal(body.edges.length, GRAPH_NODE_CAP - 1,
      'an edge to a node the cap dropped is dropped with it; the count is what discloses that');
    assert.deepEqual(body.nodes.map((n) => n.id), [C, ...ghosts.slice(0, GRAPH_NODE_CAP - 1)],
      'which nodes survive the cap is deterministic, not whichever the walk reached first');
    assert.ok(!body.nodes.some((n) => n.id === 'GHOST-069'));
  } finally { f.done(); }
});

test('/api/graph refuses an unknown focus, a radius it would coerce, and a repeated parameter', () => {
  const f = fixture();
  try {
    assert.equal(apiGraph(f.ws, url('graph', 'focus=NOPE&radius=1')).status, 404);
    assert.equal(apiGraph(f.ws, url('graph', `focus=${A}&radius=3`)).status, 400);
    assert.equal(apiGraph(f.ws, url('graph', `focus=${A}&radius=0`)).status, 400);
    assert.equal(apiGraph(f.ws, url('graph', 'radius=1')).status, 400);
    assert.equal(apiGraph(f.ws, url('graph', 'focus=&radius=1')).status, 400);
    assert.equal(apiGraph(f.ws, url('graph', `focus=${A}&depth=1`)).status, 400);
    // Six spellings `Number()` accepts, each of which would answer about a
    // radius nobody wrote — the defect `/api/simulate` and `/api/decay`
    // already refuse budgets and windows on.
    for (const raw of ['%201%20', '1e0', '0x1', '%2B1', '1.0', '']) {
      const result = apiGraph(f.ws, url('graph', `focus=${A}&radius=${raw}`));
      assert.equal(result.status, 400, `radius=${raw}`);
      assert.match((result.body as { error: string }).error, /radius/);
    }
    // Given twice, the second value would be silently discarded.
    const repeated = apiGraph(f.ws, url('graph', `focus=${A}&focus=${B}`));
    assert.equal(repeated.status, 400);
    assert.match((repeated.body as { error: string }).error, /more than once/);
    // An omitted radius is the ego graph's own default, not a refusal.
    assert.equal(apiGraph(f.ws, url('graph', `focus=${A}`)).status, 200);
  } finally { f.done(); }
});

test('/api/items carries every item with the injection verdict, sorted by id', () => {
  const f = fixture();
  try {
    const body = apiItems(f.ws, url('items', '')).body as ItemsBody;
    assert.deepEqual(body.items.map((i) => i.id), [A, B, C, D].sort(),
      'sorted by id, which is what makes it a stable link target for every screen');
    for (const summary of body.items) {
      const item = f.items.find((i) => i.id === summary.id)!;
      assert.deepEqual(summary, {
        // `relations` is the item's DEGREE, counting relations in both
        // directions, and it arrived on 2026-09-01 so the Relations picker can
        // stop offering items that would draw a single node alone. Zero for
        // every item here because this fixture declares no relations at all —
        // which is the case that matters for the picker, since it is the one
        // that gets filtered out. That the count also includes INBOUND
        // relations is not provable from this fixture and is asserted in the
        // browser instead (four items in the live corpus have no outgoing
        // relations and a non-zero degree); a fixture that declares a relation
        // would be the stronger home for it.
        relations: 0,
        // …and WHICH types touch it, distinct and sorted, for the picker's live
        // test against the relation-type filter (owner ruling, same day): an
        // item whose every relation is of a type the reader turned off is as
        // empty, to them, as one with no relations. Empty here because this
        // fixture declares none.
        relationKinds: [],
        id: item.id, type: item.type, title: item.title, status: item.status,
        always: item.always, scope: item.scope,
        injected: injection(item, f.ws.config).injected,
        phrase: injection(item, f.ws.config).phrase,
        gate: injection(item, f.ws.config).gate,
        // The summary and the VERDICT on it, together — `plan:walk seq:119`
        // phase 3. They travel as a pair because the one thing a summary
        // display may not do is present a stale sentence as a current one, and
        // `summaryOf` is a checksum no client can evaluate. This fixture's four
        // items carry no summary, so both fields read the absent case: `null`
        // and `absent`, which `summaryState` keeps in step by construction.
        summary: item.summary,
        summaryState: summaryState(item),
      });
    }
    // Non-vacuity for the pair above: `deepEqual` against a value taken from the
    // same item would pass if BOTH sides were wrong the same way, so the absent
    // case is asserted outright.
    assert.deepEqual(body.items.map((i) => i.summaryState), ['absent', 'absent', 'absent', 'absent'],
      'no fixture item has a summary, so every row must say so — never a missing field');
    // Non-vacuity: the four rows must not be four copies of one verdict.
    assert.equal(new Set(body.items.map((i) => i.phrase)).size, 3,
      'pinned, scoped and rationale are three phrases; the two src/** rules share the third');
    // The gate collapses the two injected shapes and keeps the refusal apart:
    // three rows cleared the ladder, and the rationale one binds at rung 2.
    assert.deepEqual(body.items.filter((i) => i.gate !== 'passed').map((i) => i.gate), ['tier'],
      'only the rationale row fails a gate, and the gate it fails is the tier gate');
  } finally { f.done(); }
});

/**
 * **A summary the item has outgrown is SERVED, and served as stale.**
 *
 * This is the assertion the whole summary carry exists for. `/api/item/:id` has
 * carried `summary` and `summaryOf` since the field existed — they are fields on
 * `Item`, and this endpoint serves the whole item — so a pane could always have
 * DRAWN the sentence. What it could never do is say whether the sentence was
 * still true: `summaryOf` is a checksum over the item's canonicalised summarised
 * content, and a client holding it has nothing to compare it against.
 *
 * So the endpoints answer the VERDICT, and both of them answer it, because a
 * summary described as current on one screen and stale on the next is the drift
 * this repository keeps finding. Three states are exercised here and the middle
 * one is the point: absent, current, and current-then-stale after an edit that
 * moves the body out from under the sentence.
 */
test('both item endpoints report a stale summary as stale, never as current', () => {
  const f = fixture();
  const run = (args: string[]): void => {
    assert.equal(runCli(args, f.dir, () => {}), 0, `command failed: ${args.join(' ')}`);
  };
  try {
    const id = 'RULE-always-use-posix-paths';
    const stateOf = (): { one: string; list: string } => ({
      one: (apiItem(f.ws, url('item', ''), { id }).body as ItemBody).summaryState,
      list: (apiItems(f.ws, url('items', '')).body as ItemsBody)
        .items.find((i) => i.id === id)!.summaryState,
    });

    assert.deepEqual(stateOf(), { one: 'absent', list: 'absent' },
      'an item with no summary is ABSENT on both endpoints — never an empty string, which a '
      + 'screen would draw as a blank line under the title');

    run(['edit', id, '--summary', 'Paths are written one way so a glob can match them.', '--yes']);
    assert.deepEqual(stateOf(), { one: 'current', list: 'current' },
      '`stampSummary` writes the text and the basis together, so a summary is CURRENT the '
      + 'instant it is written — a summary born stale would make the state useless');
    assert.equal(
      (apiItem(f.ws, url('item', ''), { id }).body as ItemBody).item.summary,
      'Paths are written one way so a glob can match them.',
      'the sentence itself is on the wire, not merely a verdict about it',
    );

    // The body moves and the summary does not. Nothing refreshes the basis on
    // its own — that is the whole mechanism — so the two stop agreeing.
    //
    // Reached by a HAND EDIT rather than by `mycontext edit --body`, and the
    // change of route is the owner's summary-follows-body ruling: that command
    // now REFUSES a body change that carries no summary, so the only way a
    // summary can still go stale is a file edited outside the tool — which
    // markdown-as-source-of-truth explicitly permits and which is exactly the
    // case these endpoints have to be able to report. `repair --yes` re-stamps
    // the checksum the hand edit invalidated, so what is served afterwards is
    // an item that is clean in every respect EXCEPT the sentence on it.
    const file = path.join(f.dir, '.my_context', 'items', 'rule', `${id}.md`);
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replaceAll(
        'Use POSIX separators everywhere.', 'A completely different claim about something else.',
      ),
    );
    run(['repair', '--yes']);
    assert.deepEqual(stateOf(), { one: 'stale', list: 'stale' },
      'the content moved under the sentence and both endpoints must say so. A value that was '
      + 'true once, served as though it were true now, is the defect this field exists to stop');

    // And the sentence is still THERE. Nothing here is dropped silently: a
    // stale summary is drawn as stale, never withheld.
    assert.equal(
      (apiItem(f.ws, url('item', ''), { id }).body as ItemBody).item.summary,
      'Paths are written one way so a glob can match them.',
      'a stale summary is still served — INV-nothing-is-dropped-silently. It is DISCLOSED as '
      + 'stale, not hidden',
    );
  } finally { f.done(); }
});

test('/api/item/:id joins the injection phrase to the ledger usage; unknown id is 404', () => {
  const f = fixture();
  try {
    const writable = Ledger.open(f.ws.dbPath);
    writable.record('sess-1', C, 'pinned', '2026-08-19T10:00:00.000Z');
    writable.record('sess-2', C, 'pinned', '2026-08-20T10:00:00.000Z');
    writable.close();

    const result = apiItem(f.ws, url(`item/${C}`, ''), { id: C });
    assert.equal(result.status, 200);
    const body = result.body as ItemBody;
    assert.deepEqual(json(body.item), json(f.items.find((i) => i.id === C)!),
      'the item is carried whole — the pane draws six fields of it and links a seventh');
    assert.deepEqual(body.injection, {
      phrase: 'PINNED — injected in full at every session start, regardless of scope',
      injected: true,
      gate: 'passed',
    });
    assert.equal(body.ledger, 'ready');
    assert.deepEqual(body.usage,
      { itemId: C, useCount: 2, lastUsed: '2026-08-20T10:00:00.000Z' });

    // An item nothing has injected, in a corpus whose ledger EXISTS: a
    // measured zero, and a different fact from the one the test below pins.
    const unused = apiItem(f.ws, url(`item/${A}`, ''), { id: A }).body as ItemBody;
    assert.deepEqual(unused.usage, { itemId: A, useCount: 0, lastUsed: null });

    // Three items, three verdicts. One item's answer cannot tell `injection()`
    // from a literal — a pane that printed "PINNED" over a rationale-tier
    // decision would be asserting a property the selector does not have.
    assert.deepEqual(unused.injection,
      { phrase: 'injected when work touches src/**', injected: true, gate: 'passed' });
    const rationale = apiItem(f.ws, url(`item/${D}`, ''), { id: D }).body as ItemBody;
    assert.deepEqual(rationale.injection, injection(f.items.find((i) => i.id === D)!, f.ws.config));
    assert.equal(rationale.injection.injected, false);
    // The pane is where a ladder drawn for ONE item reads its binding rung.
    assert.equal(rationale.injection.gate, 'tier',
      'a decision reaches the index line and no further — rung 2, said in a word');
    assert.equal(new Set([body.injection.phrase, unused.injection.phrase,
      rationale.injection.phrase]).size, 3, 'non-vacuity: three different phrases');

    assert.equal(apiItem(f.ws, url('item/NOPE', ''), { id: 'NOPE' }).status, 404);
    assert.equal(apiItem(f.ws, url('item/', ''), { id: '' }).status, 404);
  } finally { f.done(); }
});

test('/api/item/:id reports a not-projected ledger as a STATE, never as a usage of zero', () => {
  const f = fixture();
  try {
    const body = apiItem(f.ws, url(`item/${C}`, ''), { id: C }).body as ItemBody;
    assert.equal(body.ledger, 'not-projected');
    assert.equal(body.usage, null,
      'a useCount of 0 would claim a count was taken; there is no ledger table to count in');
    // The item half of the same response is unaffected: the pane's six fields
    // are corpus facts and do not depend on the projection at all.
    assert.equal(body.item.id, C);
    assert.equal(body.injection.injected, true);
  } finally { f.done(); }
});

test('/api/help/:topic joins the four topics to THIS corpus', () => {
  const f = fixture();
  try {
    const run = (args: string[]): void => {
      assert.equal(runCli(args, f.dir, () => {}), 0, `fixture command failed: ${args.join(' ')}`);
    };
    run(['add', '--summary-omitted', 'rule', 'Unscoped rule', '--body', 'No scope at all.', '--yes']);
    run(['edit', B, '--status', 'draft', '--yes']);
    stageIn(f.dir, C, { title: 'Pin me, revised' });
    stageIn(f.dir, C, { body: 'A second proposal, against the same item.' });

    // Doctored until the two config-derived joins have something to be wrong
    // about. A corpus on this project's defaults cannot tell `scopePolicyFor`
    // from the literal `'global'`, and cannot tell "enabled categories with no
    // items" from "categories with no items" — every built-in is enabled.
    // Both edits are made AFTER the captures above, because `required` is a
    // refusal at capture time and would have refused the unscoped rule.
    const configPath = path.join(f.ws.projectRoot!, 'config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    config.categories = {
      rule: { scopePolicy: 'required' },
      constraint: { enabled: false },
    };
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    const ws = resolveWorkspace(f.dir);

    const scope = apiHelp(ws, url('help/scope', ''), { topic: 'scope' });
    assert.equal(scope.status, 200);
    const scopeBody = scope.body as HelpBody;
    assert.equal(scopeBody.topic, 'scope');
    assert.equal(scopeBody.markdown, helpTopic('scope', ws.config),
      'the markdown is helpTopic\'s, not a second rendering of the same file');
    assert.ok(scopeBody.markdown.length > 0);
    const corpus = scopeBody.corpus as {
      scoped: { id: string; title: string; scope: string[] }[];
      unscoped: { id: string; title: string; policy: string }[];
    };
    assert.deepEqual(corpus.scoped.map((i) => i.id), [A, B],
      'both src/** rules are scoped — a draft is still an item that declares a scope');
    assert.deepEqual(corpus.scoped[0].scope, ['src/**']);
    assert.deepEqual(corpus.unscoped.map((i) => i.id), [C, D, 'RULE-unscoped-rule'].sort());
    for (const entry of corpus.unscoped) {
      const type = entry.id.startsWith('DEC-') ? 'decision' : 'rule';
      assert.equal(entry.policy, scopePolicyFor(ws.config, type),
        'what an empty scope MEANS is per-category config, stated per item under THIS config');
      assert.ok(['global', 'required', 'inert'].includes(entry.policy));
    }
    assert.deepEqual(new Set(corpus.unscoped.map((u) => u.policy)), new Set(['required', 'global']),
      'non-vacuity: two policies in one answer, so no single literal can stand in for the lookup');

    const categories = apiHelp(ws, url('help/categories', ''), { topic: 'categories' });
    const cats = (categories.body as HelpBody).corpus as
      { counts: Record<string, number>; empty: string[] };
    assert.equal(cats.counts.rule, 4, 'the three fixture rules plus the unscoped one');
    assert.equal(cats.counts.decision, 1);
    assert.ok(!Object.hasOwn(cats.counts, 'constraint'));
    assert.ok(cats.empty.includes('invariant'), 'an enabled category holding nothing IS a gap');
    assert.ok(!cats.empty.includes('rule'), 'a category holding items is not a gap');
    assert.ok(!cats.empty.includes('constraint'),
      'a DISABLED category holding nothing is not a gap — nothing can be captured into it, so ' +
      'reporting it would be a permanent row nobody can clear');

    const workflow = apiHelp(ws, url('help/workflow', ''), { topic: 'workflow' });
    assert.deepEqual((workflow.body as HelpBody).corpus,
      { drafts: 1, pendingRevisions: { revisions: 2, items: 1 } },
      'two proposals against ONE item — the two numbers cannot be swapped unnoticed');

    const capture = apiHelp(ws, url('help/capture', ''), { topic: 'capture' });
    const recent = ((capture.body as HelpBody).corpus as
      { recent: { id: string; title: string; mtime: string }[] }).recent;
    assert.equal(recent.length, 5, 'five most recent, out of the six project items');
    for (const entry of recent) assert.match(entry.mtime, /^\d{4}-\d{2}-\d{2}T/);
  } finally { f.done(); }
});

test('/api/help capture is ordered by file mtime, capped at five, and project-layer only', () => {
  const f = fixture();
  try {
    // Distinct, KNOWN mtimes: without them "five most recent" cannot be told
    // from "the first five by id", which is all the fixture's four
    // same-millisecond files would assert.
    const run = (args: string[]): void => {
      assert.equal(runCli(args, f.dir, () => {}), 0, `fixture command failed: ${args.join(' ')}`);
    };
    run(['add', '--summary-omitted', 'rule', 'Sixth rule', '--body', 'Sixth.', '--yes']);
    run(['add', '--summary-omitted', 'rule', 'Seventh rule', '--body', 'Seventh.', '--yes']);

    const ws = resolveWorkspace(f.dir);
    const all = withStores(ws, (store) => store.all());
    assert.equal(all.length, 6);
    // Oldest first in id order, so the expected answer is the REVERSE of the
    // order every other endpoint here returns items in — a `recent` that
    // forgot to sort would come back in exactly the wrong order.
    const ordered = [...all].sort((a, b) => (a.id < b.id ? -1 : 1));
    ordered.forEach((item, index) => {
      const when = Date.UTC(2026, 0, 1 + index) / 1000;
      utimesSync(path.join(ws.projectRoot!, item.filePath), when, when);
    });

    // A GLOBAL-layer item whose filePath resolves, under the PROJECT root, to
    // a different item's file. Without the layer filter it is included
    // carrying that file's date — a wrong answer produced silently, which is
    // the failure the filter exists for rather than the missing-file one the
    // try/catch already covers.
    //
    // It borrows the NEWEST file and an id that sorts first, so an unfiltered
    // answer puts it at the head of the list rather than off the end of the
    // five: a twin carrying the oldest date would be dropped by the cap and
    // the filter would never be exercised.
    const writable = Store.open(ws.dbPath);
    writable.upsert({
      ...ordered.at(-1)!, id: 'AAA-global-twin', title: 'Global twin', layer: 'global',
    });
    writable.close();

    const corpus = (apiHelp(resolveWorkspace(f.dir), url('help/capture', ''), { topic: 'capture' })
      .body as HelpBody).corpus as { recent: { id: string; mtime: string }[] };
    assert.deepEqual(corpus.recent.map((r) => r.id),
      [...ordered].reverse().slice(0, 5).map((i) => i.id));
    assert.ok(!corpus.recent.some((r) => r.id === 'AAA-global-twin'),
      'a global-layer item\'s filePath is relative to the GLOBAL root; statting it under the ' +
      'project root prints another item\'s date beside its title');
    assert.equal(corpus.recent[0].mtime, new Date(Date.UTC(2026, 0, 6)).toISOString());
  } finally { f.done(); }
});

/**
 * **This screen serves the mockup's four topics, and refuses the rest by
 * saying which four they are.**
 *
 * The served list is keyed off the MOCKUP (`ln.sub`: *"The four help topics,
 * each linked to the items in this corpus that demonstrate it"*), not off
 * `src/help/`, which has more and gains more over time. A fifth row on that
 * screen is a mockup change; serving a topic the screen has no row for would
 * be inventing one.
 *
 * **And one topic could not be served even with a row.** `helpTopic('cli', …)`
 * is generated from the CLI's command registry, populated by side effect when
 * `src/cli/index.ts` loads. The UI server never loads it — and must not: that
 * module reaches `mutate.ts`, so serving that one topic would put the whole
 * write surface into the read server's runtime import graph and fail Task 14.
 * The mechanism is exercised below against an empty registry rather than
 * asserted in prose, because in THIS process the registry is populated (the
 * fixture drives `runCli`) and the endpoint's refusal would otherwise look
 * like a rule with nothing behind it.
 */
test('/api/help serves the mockup\'s four topics and refuses the rest by naming them', () => {
  const f = fixture();
  try {
    assert.deepEqual(UI_HELP_TOPICS, ['categories', 'scope', 'capture', 'workflow']);
    for (const topic of UI_HELP_TOPICS) {
      assert.ok((HELP_TOPICS as string[]).includes(topic),
        `${topic} must be a real help topic — this screen may not invent one`);
    }

    // Every topic `mycontext help` has and this screen does not is refused,
    // and the refusal names what IS served: a client can then tell "no such
    // topic" from "not on this screen", which is the whole of the disclosure.
    const unserved = (HELP_TOPICS as string[]).filter(
      (topic) => !(UI_HELP_TOPICS as string[]).includes(topic),
    );
    assert.ok(unserved.length > 0, 'non-vacuity: mycontext help has topics this screen does not');
    for (const topic of unserved) {
      const refused = apiHelp(f.ws, url(`help/${topic}`, ''), { topic });
      assert.equal(refused.status, 404, topic);
      const error = (refused.body as { error: string }).error;
      assert.match(error, new RegExp(`mycontext help\` topic`), topic);
      for (const served of UI_HELP_TOPICS) assert.match(error, new RegExp(served), topic);
    }
    assert.ok(unserved.includes('cli'));
    // The mechanism behind `cli` in particular: an empty registry is exactly
    // what a process that never loaded the CLI has, and `commandList` refuses
    // it rather than printing a complete-looking command section naming no
    // commands. That refusal is why `cli` could not be served here even if
    // the Learn screen grew a row for it.
    assert.throws(() => commandList(new Map()), /never loaded the CLI/);

    const unknown = apiHelp(f.ws, url('help/nope', ''), { topic: 'nope' });
    assert.equal(unknown.status, 404);
    const error = (unknown.body as { error: string }).error;
    assert.match(error, /no help topic "nope"/);
    for (const topic of UI_HELP_TOPICS) {
      assert.match(error, new RegExp(topic),
        'the refusal lists what IS served, or a client cannot recover from it');
    }
  } finally { f.done(); }
});

/**
 * The byte-identity claim, extended to the five endpoints this task adds — and
 * to the first one that walks the repository for its own answer rather than
 * through `runChecks` (`/api/coverage`), and the first that stats an item file
 * (`/api/help/capture`).
 *
 * The same condition as every sweep above applies unchanged: this corpus, in
 * this state, after these calls. And the same measured exception — a read-only
 * open of a WAL database CREATES `.index.db-shm` and `.index.db-wal` — is
 * measured here rather than written down, so the assertion says the same true
 * thing on both CI platforms.
 */
test('a sweep of coverage, graph, items and help leaves the whole repository byte-identical', () => {
  const { f } = coverageFixture();
  try {
    const withLedger = Ledger.open(f.ws.dbPath);
    withLedger.record('sess-1', C, 'pinned', '2026-08-20T10:00:00.000Z');
    withLedger.close();
    const ws = relate(f, [
      { from: A, type: 'constrains', to: B },
      { from: A, type: 'relates_to', to: 'RULE-ghost' },
    ]);

    const before = snapshot(f.dir);
    assert.ok(before.size > 0, 'the snapshot must actually see the repository');
    const added = (later: Map<string, string>): string[] =>
      [...later.keys()].filter((file) => !before.has(file)).sort();

    // What the ENGINE costs, measured: one read-only open, nothing else.
    Store.openReadOnlyChecked(ws.dbPath).close();
    const sidecars = added(snapshot(f.dir));
    assert.ok(sidecars.every((file) => /\.index\.db-(shm|wal)$/.test(file)),
      `a bare read-only open created something that is not an index sidecar: ${sidecars.join(', ')}`);

    const coverage = apiCoverage(ws, url('coverage', '')).body as CoverageBody;
    assert.ok(coverage.files.length > 0, 'non-vacuity: the repository walk really ran');
    for (const radius of ['1', '2']) {
      assert.equal(apiGraph(ws, url('graph', `focus=${A}&radius=${radius}`)).status, 200);
    }
    const items = apiItems(ws, url('items', '')).body as ItemsBody;
    for (const item of items.items) {
      const one = apiItem(ws, url(`item/${item.id}`, ''), { id: item.id });
      assert.equal(one.status, 200);
      assert.equal((one.body as ItemBody).ledger, 'ready', 'non-vacuity: the ledger was queried');
    }
    for (const topic of UI_HELP_TOPICS) {
      assert.equal(apiHelp(ws, url(`help/${topic}`, ''), { topic }).status, 200, topic);
    }

    const after = snapshot(f.dir);
    assert.deepEqual(added(after), sidecars,
      'the endpoints may create exactly what a bare read-only open creates, and nothing else');
    assert.deepEqual([...before.keys()].filter((file) => !after.has(file)), [],
      'a read removes nothing');
    for (const [file, digest] of before) {
      assert.equal(after.get(file), digest, `${file} must be byte-identical after a read sweep`);
    }
  } finally { f.done(); }
});
