/**
 * Spawned-process assertions for every route plan 2 registered: no token →
 * 401, a WRONG token → 403, the real token → not 401/403.
 *
 * WHAT THIS PROVES, and why it needs a whole file. `routes.ts` opens with a
 * property claim about the extension point plans 2 and 3 build on
 * (`routes.ts` · `route registers can bypass the security gate, which runs before dispatch` · ~6).
 * The dispatch order in `server.ts` is what makes it true — the gate runs
 * before `matchRoute`, so a route cannot opt out of it and cannot opt into it
 * either — and nothing in a route module can express an opinion about it. That
 * is exactly why it needs a test OUTSIDE the route modules: the property is
 * held by code none of them touch, so the way it breaks is a change to
 * `server.ts` that every read-model test in the suite stays green through.
 *
 * ── THE THREE WAYS A TEST LIKE THIS PASSES FOR THE WRONG REASON ────────────
 *
 * 1. **A GET probe against a POST route.** It 404s at `matchRoute` before ever
 *    reaching the handler — and a 404 is not a 401, so the tokenless half
 *    still "passes" while proving nothing about a route the gate never saw.
 *    That mistake was already caught once on `POST /api/overlap`, and
 *    `server-e2e.test.ts` records it beside its own Probe type. Closed here by
 *    making `method` part of every probe AND part of the coverage comparison
 *    below: this file compares `method path` pairs against the route table,
 *    where `server-e2e.test.ts`'s `templateMatches` compares paths only.
 *
 * 2. **A hand-maintained route list that silently stops covering the table.**
 *    Closed by `the probe list is exactly the route table plan 2 registers`
 *    below, which does not read a list from the plan — the plan predates two of
 *    these routes — but calls plan 2's two registration functions into an EMPTY
 *    table and demands set equality with the probes. A ninth route registered
 *    by either module fails that test by name, on the day it is added.
 *
 * 3. **Assertions that cannot distinguish the gate from the route table.** A
 *    single `status === 200` check reddens identically whether the gate refused
 *    an authorised request or the route was never registered. Both are checked,
 *    separately, with messages that say which happened.
 *
 * ── THE ORDER OF THE PASSES IS LOAD-BEARING ────────────────────────────────
 *
 * Authorised first, then the two refusing passes — never interleaved per
 * route. A refusal is the read surface's ONE write (owner ruling B4, plan 1
 * §0.6): it appends an audit record. None of plan 2's eight routes reads the
 * audit projection, so a refusal cannot change what they answer — measured, and
 * asserted at the end of the gate test rather than assumed, because that is a
 * fact about today's eight handlers and not a property anything enforces. A
 * ninth route that DID read the projection would answer 503 (`projectionState:
 * 'behind'`) after a refusal, the way plan 3's Watch and Ask routes do, and
 * would fail the closing assertion rather than reddening the whole file in a
 * way that reads as a gate failure.
 *
 * ── ALIVENESS, MEASURED ────────────────────────────────────────────────────
 *
 * A test that passes for the wrong reason is worse than no test at all for a
 * security property, so each assertion below was made to FAIL on purpose
 * against a deliberately broken tree before this file was committed. What
 * follows is a record of four runs, not a claim about what would happen. Every
 * edit was reverted; each red stops at its FIRST probe, so one route is named
 * rather than all eight.
 *
 *   - **The gate cut out** — `server.ts`'s `if (!gate.ok) { refuse(…); return; }`
 *     removed. Pass 2 fails: `GET /api/revisions without a token answered 200`,
 *     `200 !== 401`. This is the property this file exists for.
 *   - **The gate narrowed to header-PRESENCE** — the same line with
 *     `&& gate.check !== 'token-mismatch'` appended, so a wrong token passes.
 *     Passes 1 and 2 stay green — they cannot tell — and pass 3 fails:
 *     `GET /api/revisions answered 200 to a wrong token`, `200 !== 403`. Pass 3
 *     is the only assertion in the file that catches this, which is why it is
 *     here.
 *   - **`registerWorkRoutes();` commented out of `registerReadRoutes`** — the
 *     plan's own aliveness check. Pass 1 fails: `GET /api/revisions with the
 *     token answered 404`, `404 !== 200`. The coverage test stays GREEN, and
 *     deliberately: it asks the two route MODULES what they register, not what
 *     `server.ts` wires up. That second gap is held elsewhere — by
 *     `server-e2e.test.ts`'s `every registered read route is in the sweep`,
 *     which asks `registerReadRoutes()`, and by `no-writes.test.ts`, which
 *     fails on a `src/ui/` module nothing reaches from `server.ts`.
 *   - **A ninth route added to `registerWorkRoutes`** — the coverage test fails
 *     with the diff naming `GET /api/red-experiment`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { registerConfigRoutes } from '../../src/ui/read-model-config.ts';
import { registerWorkRoutes } from '../../src/ui/read-model-work.ts';
import { registeredRoutes } from '../../src/ui/routes.ts';
import { TOKEN_HEADER } from '../../src/ui/security.ts';
import { redeemNonce, startUiChild } from './helpers.ts';

/**
 * A probe: the registered template it claims to cover, the concrete target it
 * puts on the wire, and — always — the method.
 *
 * `route` and `target` are separate fields because they are separate claims.
 * `route` is compared against the route table; `target` carries the query
 * string the handler needs to run rather than bounce off a 400. They are
 * checked against each other below, so a probe cannot drift onto a path other
 * than the route it says it covers.
 *
 * `method` is not optional and has no default. A default is what turns a POST
 * route into a GET probe, and a GET probe against a POST route answers 404
 * before the handler — enough to satisfy a coverage count and to prove nothing
 * at all.
 */
type Probe =
  | { method: 'GET'; route: string; target: string }
  | { method: 'POST'; route: string; target: string; body: unknown };

/**
 * Every route plan 2 registered — the Work read model (Tasks 3-5) and the
 * Configure read model (Tasks 6-7).
 *
 * Bodies and query strings are chosen so each handler RUNS. A 400 from a
 * missing parameter is a response the gate let through, which is all this file
 * asks of it — but it is also a route that never reached its own code, and the
 * authorised pass asserts 200 precisely so that a probe cannot quietly decay
 * into "the gate let a bad request through".
 */
const PROBES: Probe[] = [
  { method: 'GET', route: '/api/revisions', target: '/api/revisions' },
  { method: 'GET', route: '/api/review-queue', target: '/api/review-queue' },
  // `text=` matches the fixture's own item: an empty result is still a 200, so
  // a probe that matches nothing would pass while exercising less.
  { method: 'GET', route: '/api/search', target: '/api/search?text=pinned' },
  // `pattern` is required — a bare `/api/glob` is a 400, and a 400 is not a
  // route that ran.
  { method: 'GET', route: '/api/glob', target: '/api/glob?pattern=src/**' },
  { method: 'GET', route: '/api/config', target: '/api/config' },
  {
    method: 'POST', route: '/api/overlap', target: '/api/overlap',
    body: { title: 'Pin me', body: 'Pinned body.' },
  },
  {
    method: 'POST', route: '/api/config/check', target: '/api/config/check',
    body: { candidate: { budgets: { jit: 100 } } },
  },
  // The preview takes the select grammar in the query string and the candidate
  // in the body, so it needs both to reach its own code.
  {
    method: 'POST', route: '/api/config/preview',
    target: '/api/config/preview?event=session-start&cold=1',
    body: { candidate: { categories: { rule: { scopePolicy: 'inert' } } } },
  },
];

const label = (probe: Probe): string => `${probe.method} ${probe.target}`;

/** One probe on the wire, carrying whatever headers the pass is testing with. */
function send(base: string, probe: Probe, headers: Record<string, string>): Promise<Response> {
  if (probe.method === 'GET') return fetch(`${base}${probe.target}`, { headers });
  return fetch(`${base}${probe.target}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(probe.body),
  });
}

/**
 * A real corpus, built through the real CLI, with every exit code checked — a
 * fixture that half-built itself turns the authorised pass into an assertion
 * over an empty workspace.
 *
 * `--yes` on both mutating commands: `add` and `edit` refuse to proceed when
 * stdin is not interactive, which is every test process. `always` is set by
 * `edit --always=true` and not by an `add` flag, because `add` has no such
 * option.
 */
function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-p2e2e-'));
  const run = (args: string[]): void => {
    assert.equal(runCli(args, dir, () => {}), 0, `fixture command failed: ${args.join(' ')}`);
  };
  run(['init']);
  run(['add', 'rule', 'Pin me', '--body', 'Pinned body, long enough to cost real tokens. '.repeat(10), '--yes']);
  run(['edit', 'RULE-pin-me', '--always=true', '--yes']);
  return dir;
}

/**
 * **The one way the gate test below can quietly stop meaning anything**, closed
 * — and closed against the CODE rather than against the plan, which was written
 * before two of these routes existed.
 *
 * This file never calls `registerReadRoutes()`, so the table starts empty in
 * this process and plan 2's two registration functions are the only things that
 * put anything in it. What comes back is therefore exactly plan 2's
 * contribution, derived rather than transcribed. The comparison is an EQUALITY
 * in both directions: a route added to either module without a probe fails
 * here, and so does a probe for a route that no longer exists.
 */
test('the probe list is exactly the route table plan 2 registers', () => {
  assert.deepEqual(registeredRoutes(), [],
    'something registered routes before this test ran, so the table below is no longer plan 2\'s '
    + 'contribution alone and the equality would be measuring the wrong set');

  registerWorkRoutes();
  registerConfigRoutes();

  const registered = registeredRoutes().map((r) => `${r.method} ${r.path}`).sort();
  const probed = PROBES.map((p) => `${p.method} ${p.route}`).sort();
  assert.deepEqual(probed, registered,
    'the probe list and plan 2\'s route table have diverged. A route registered by '
    + 'registerWorkRoutes or registerConfigRoutes without a probe here is a route nothing proves '
    + 'is behind the gate; a probe with no route is a probe that 404s and proves nothing either.');

  // A probe whose target drifted onto a different path would still satisfy the
  // equality above — it is the `route` field that is compared, and the `target`
  // field that is sent.
  for (const probe of PROBES) {
    assert.equal(new URL(probe.target, 'http://127.0.0.1').pathname, probe.route,
      `${label(probe)} is sent to a path other than the route it claims to cover`);
  }
});

test('every plan-2 route refuses a tokenless request and answers a tokened one', async () => {
  const cwd = project();
  try {
    const h = await startUiChild(cwd);
    try {
      const token = await redeemNonce(h.port, h.nonce);
      const base = `http://127.0.0.1:${h.port}`;

      // Pass 1, and it goes FIRST: no refusal has been recorded yet, so this is
      // the pass that is provably unaffected by the audit append a refusal
      // performs.
      for (const probe of PROBES) {
        const response = await send(base, probe, { [TOKEN_HEADER]: token });
        assert.ok(response.status !== 401 && response.status !== 403,
          `${label(probe)} carried the real token and the GATE still refused it (`
          + `${response.status}) — the token exchange or the gate is broken, not this route`);
        assert.equal(response.status, 200,
          `${label(probe)} with the token answered ${response.status}. A 404 here is a route that `
          + 'is not registered, not a gate failure; a 400 is a probe that never reached the handler');
        await response.arrayBuffer();   // drain, so the handler has certainly finished
      }

      // Pass 2: the property. 401 and not merely "not 200" — `token-missing` is
      // the one gate exit the handoff route is exempt from, and a registered
      // route must never share that exemption.
      for (const probe of PROBES) {
        const response = await send(base, probe, {});
        assert.equal(response.status, 401,
          `${label(probe)} without a token answered ${response.status}. This route is reachable `
          + 'without the token: registering a route bypassed the gate, which is the one thing '
          + 'routes.ts promises cannot happen');
        // Owner ruling A4: a refusal is a status line and nothing else. Checked
        // on the routes plan 2 added, because the property is that no refusing
        // exit has a body — not that the routes plan 1 added happen not to.
        assert.equal((await response.text()).length, 0,
          `${label(probe)} sent a body with its refusal`);
      }

      // Pass 3: a WRONG token, which is what tells "the gate validates the
      // token" apart from "the gate checks that a header is present". Without
      // it, a gate reduced to `headers[TOKEN_HEADER] !== undefined` passes
      // every assertion above.
      for (const probe of PROBES) {
        const response = await send(base, probe, { [TOKEN_HEADER]: 'f'.repeat(64) });
        assert.equal(response.status, 403,
          `${label(probe)} answered ${response.status} to a wrong token — a gate that only checks `
          + 'the header is PRESENT would pass every other assertion in this file');
        assert.equal((await response.text()).length, 0,
          `${label(probe)} sent a body with its refusal`);
      }

      // The ordering premise, asserted rather than assumed (see the header):
      // sixteen refusals have been recorded by now, and every one of them
      // appended an audit record. None of plan 2's routes reads the audit
      // projection, so all eight still answer 200. A route that DID read it
      // would answer 503 here — and this line is what would say so, instead of
      // the whole file reddening in a way that reads as a gate failure.
      for (const probe of PROBES) {
        const response = await send(base, probe, { [TOKEN_HEADER]: token });
        assert.equal(response.status, 200,
          `${label(probe)} answered ${response.status} once refusals had been audited. A 503 means `
          + 'this route reads the audit projection, which a refusal leaves behind its log — move '
          + 'it out of this file\'s authorised passes and give it the projection-state probe '
          + 'plan 3\'s Watch routes have');
        await response.arrayBuffer();
      }
    } finally { await h.stop(); }
  } finally { removeTree(cwd); }
});
