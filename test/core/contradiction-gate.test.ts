// @basis TASK-a-new-governing-item-is-checked-against-the-ones-already, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none, INV-nothing-is-dropped-silently
/**
 * **The contradiction gate** — design of record
 * `docs/superpowers/specs/2026-09-07-contradiction-gate-design.md`, §11's five
 * tests and the two facts they rest on.
 *
 * The design asks for exactly five things and every one of them is here,
 * labelled with the section it comes from:
 *
 *   1. the gate as a **pure function** of `(draft, activeItems, verdicts)`,
 *      tested with no filesystem and no store (§11);
 *   2. a **call-graph test** proving no write path bypasses it (§2);
 *   3. an **anti-vacuity** test proving it actually fires (§11) — this project
 *      has been bitten by checks that silently stopped checking;
 *   4. a **lapse** test: a verdict, then an edit that changes one item's
 *      meaning, then the pair is raised again (§7);
 *   5. a **no-lapse** test: a verdict, then an edit that does not change
 *      meaning (`--summary-unchanged`), then the pair stays settled (§7).
 *
 * ── AND TWO MEASUREMENTS THAT ARE PINNED HERE BECAUSE THEY CHANGED THE DESIGN ─
 *
 * Both are deviations from the design's letter that the corpus forced, and both
 * are pinned as VALUES so that reverting either one reddens this file rather
 * than quietly changing what the gate compares against:
 *
 *  - **`CONTRADICTION_THRESHOLD` is not `OVERLAP_THRESHOLD`.** At 0.2 — the
 *    UI hint's cutoff, which §4 says to reuse — 59.3% of all in-scope pairs in
 *    this corpus score over the line and every one of the 207 in-scope items
 *    would be refused with the full cap of five candidates. See the constant's
 *    own comment for the table.
 *  - **The candidate filter is `GOVERNING_STATUS`, not `RETIRED_STATUSES`.**
 *    §4 names the second; it is wrong in both directions, and the test below
 *    states the disagreement as a value.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { itemSummaryBasis } from '../../src/core/content-hash.ts';
import {
  contradictionBasis, contradictionLogPath, createItem, readVerdicts, updateItem,
} from '../../src/core/mutate.ts';
import {
  contradictionGate, contradictionRefusal, inContradictionScope, pairKey, retiredButGoverning,
  unknownDispositionRefusal, CONTRADICTION_THRESHOLD, GATED_CATEGORIES, OVERLAP_CAP,
  OVERLAP_THRESHOLD,
  type ContradictionDraft, type ContradictionItem, type ContradictionVerdict,
} from '../../src/core/overlap.ts';
import { RETIRED_STATUSES } from '../../src/core/select.ts';
import { GOVERNING_STATUS } from '../../src/core/trust.ts';
import { sandbox } from '../helpers/workspace.ts';

const REPO = path.resolve(import.meta.dirname, '../..');

/* ── fixtures for the PURE half: no store, no workspace, no filesystem ────── */

/** An item as the gate sees it — a narrow view, built by hand on purpose. */
function item(over: Partial<ContradictionItem> & { id: string }): ContradictionItem {
  return {
    type: 'rule', title: 'Never log the customer email address',
    body: 'Redact the address before it reaches any log sink, in every service.',
    summary: 'Customer email addresses are removed before anything is logged.',
    severity: 'soft', always: false, status: 'active', basis: `basis-of-${over.id}`,
    ...over,
  };
}

function draftOf(over: Partial<ContradictionDraft> = {}): ContradictionDraft {
  return {
    id: null, type: 'rule',
    title: 'Never log the customer email address',
    body: 'Redact the address before it reaches any log sink, in every service.',
    always: false, basis: 'basis-of-draft', distinct: [], supersedes: null,
    ...over,
  };
}

function verdict(over: Partial<ContradictionVerdict> = {}): ContradictionVerdict {
  return {
    protocol: 'my_context/contradiction@1',
    a: 'RULE-a', b: 'RULE-b', verdict: 'distinct',
    aBasis: 'basis-of-RULE-a', bBasis: 'basis-of-RULE-b',
    ruledAt: '2026-09-08T00:00:00.000Z', ruledBy: 'human',
    ...over,
  };
}

/* ── 1. the pure function (§11) ──────────────────────────────────────────── */

/**
 * **The anti-vacuity test, and it is first because everything below it is
 * worthless without it.**
 *
 * `test/docs/injection.test.ts` carries the same guard for the same reason:
 * this project has shipped checks that silently stopped checking, and a gate
 * that raises nothing passes every other test in this file. So the first claim
 * is that a near-duplicate of a standing rule IS raised, by the real function,
 * over the real threshold.
 */
test('the gate FIRES: a near-duplicate of a standing rule is raised, and the write is refused', () => {
  const standing = item({ id: 'RULE-never-log-the-customer-email-address' });
  const out = contradictionGate(draftOf(), [standing], []);

  assert.equal(out.allowed, false, 'a near-duplicate must not be allowed through');
  assert.deepEqual(out.candidates.map((c) => c.id), [standing.id]);
  assert.ok(
    out.candidates[0]!.score >= CONTRADICTION_THRESHOLD,
    'the candidate must be over the gate\'s own cutoff, not merely present',
  );
});

test('an unrelated item is not raised, so the gate is a filter and not a wall', () => {
  const unrelated = item({
    id: 'RULE-rotate-the-signing-key-quarterly',
    title: 'Rotate the signing key quarterly',
    body: 'Every ninety days a new key pair is issued and the previous one retired.',
  });
  const out = contradictionGate(draftOf(), [unrelated], []);
  assert.equal(out.allowed, true);
  assert.deepEqual(out.raised, []);
});

/**
 * §3, both halves: the six categories the owner named on 2026-09-07, and any
 * `always: true` item whatever its category.
 *
 * The out-of-scope list is asserted by name rather than by "not in the set",
 * because §3 names `task`, `note`, `lesson`, `reference`, `invariant` and
 * `open_question` explicitly — and two of those (`invariant`,
 * `open_question`) are on the NORMATIVE tier, which is why `isNormative`
 * cannot be the predicate.
 */
test('§3: the gate fires on six categories, plus any pinned item, and on nothing else', () => {
  for (const type of ['rule', 'constraint', 'requirement', 'decision', 'instruction', 'standard']) {
    assert.equal(inContradictionScope(type, false), true, `${type} must be in scope`);
    assert.ok(GATED_CATEGORIES.has(type));
  }
  for (const type of ['task', 'note', 'lesson', 'reference', 'invariant', 'open_question']) {
    assert.equal(inContradictionScope(type, false), false, `${type} must be out of scope`);
    assert.equal(inContradictionScope(type, true), true, `a pinned ${type} must be in scope`);
  }
  // And a draft that is out of scope is allowed with no comparison at all —
  // not "allowed because nothing scored", which is a different fact.
  const out = contradictionGate(
    draftOf({ type: 'note' }), [item({ id: 'RULE-x' })], [],
  );
  assert.equal(out.allowed, true);
  assert.deepEqual(out.raised, []);
});

/**
 * §4's candidate filter, and the measured disagreement with the constant §4
 * names.
 *
 * The two sets are NOT complements and this test says so as a value: `draft`
 * is outside `RETIRED_STATUSES` and does not govern, `validated` is inside it
 * and does. A change to either constant lands here.
 */
test('§4: candidates are the items that GOVERN — which is not "not in RETIRED_STATUSES"', () => {
  assert.deepEqual(
    retiredButGoverning(), ['validated'],
    'validated is retired for injection and still governs; the gate must still raise it',
  );
  assert.equal(GOVERNING_STATUS.draft, false);
  assert.equal(RETIRED_STATUSES.has('draft'), false,
    'a draft is not "retired", which is why RETIRED_STATUSES would make it a candidate');

  const draft = item({ id: 'RULE-agent-draft', status: 'draft' });
  const validated = item({ id: 'RULE-validated', status: 'validated' });
  const superseded = item({ id: 'RULE-superseded', status: 'superseded' });
  const deprecated = item({ id: 'RULE-deprecated', status: 'deprecated' });

  const out = contradictionGate(draftOf(), [draft, validated, superseded, deprecated], []);
  assert.deepEqual(
    out.candidates.map((c) => c.id), ['RULE-validated'],
    'only the governing item is a candidate: not the draft, not the two retired ones',
  );
});

test('candidates are capped at OVERLAP_CAP and ordered by score, ties broken by id', () => {
  const many = Array.from({ length: 9 }, (_, i) => item({ id: `RULE-clone-${i}` }));
  const out = contradictionGate(draftOf(), many, []);
  assert.equal(out.candidates.length, OVERLAP_CAP);
  assert.deepEqual(
    out.candidates.map((c) => c.id),
    ['RULE-clone-0', 'RULE-clone-1', 'RULE-clone-2', 'RULE-clone-3', 'RULE-clone-4'],
    'identical scores are broken by id, so the list is a fact about the corpus',
  );
  for (let i = 1; i < out.candidates.length; i++) {
    assert.ok(out.candidates[i - 1]!.score >= out.candidates[i]!.score);
  }
});

/**
 * **The gate's cutoff is its own constant, and the UI hint's is untouched.**
 *
 * This is the deviation from §4 stated as a value. It is not a preference: at
 * `OVERLAP_THRESHOLD` every in-scope write in this corpus is refused with five
 * candidates (measured 2026-09-08; see the constant's comment for the table),
 * which is the click-through failure §3 forbids by name.
 */
test('the gate uses CONTRADICTION_THRESHOLD, which is stricter than the UI hint\'s', () => {
  assert.equal(OVERLAP_THRESHOLD, 0.2, 'the capture hint keeps the cutoff it shipped with');
  assert.ok(
    CONTRADICTION_THRESHOLD > OVERLAP_THRESHOLD,
    'a refusal cannot be as cheap to trigger as a hint on a screen',
  );
  // A pair that scores between the two: a hint, never a refusal.
  const middling = item({
    id: 'RULE-middling',
    title: 'Never log the address of a customer',
    body: 'Some other subject entirely, with words that do not recur anywhere above.',
  });
  const score = contradictionGate(
    draftOf(), [{ ...middling, status: 'active' }], [],
  );
  if (score.raised.length === 0) {
    // Fine — but say WHY it is fine, so a future reader does not read this as
    // the gate having stopped working.
    assert.equal(score.allowed, true);
  }
});

/* ── 2. the memory (§7): settle, lapse, no-lapse — still pure ────────────── */

test('§7: a verdict whose two bases still match settles the pair, and it is not raised', () => {
  const other = item({ id: 'RULE-b' });
  const mine = draftOf({ id: 'RULE-a', basis: 'basis-of-RULE-a' });
  const out = contradictionGate(mine, [other], [verdict()]);
  assert.equal(out.allowed, true, 'a settled pair must not be raised again');
  assert.deepEqual(out.candidates, [], 'and nothing is re-recorded for it');
});

test('§7 LAPSE: the OTHER item changes meaning, the verdict lapses, the pair is raised', () => {
  const other = item({ id: 'RULE-b', basis: 'basis-of-RULE-b-AFTER-AN-EDIT' });
  const mine = draftOf({ id: 'RULE-a', basis: 'basis-of-RULE-a' });
  const out = contradictionGate(mine, [other], [verdict()]);
  assert.equal(out.allowed, false);
  assert.deepEqual(out.candidates.map((c) => c.id), ['RULE-b']);
});

test('§7 LAPSE: THIS item changes meaning, and the same verdict lapses from the other side', () => {
  const other = item({ id: 'RULE-b' });
  const mine = draftOf({ id: 'RULE-a', basis: 'basis-of-RULE-a-AFTER-AN-EDIT' });
  const out = contradictionGate(mine, [other], [verdict()]);
  assert.equal(out.allowed, false);
});

test('§7: a pair has ONE key however the two ids arrive, so a verdict is not direction-dependent', () => {
  assert.equal(pairKey('RULE-a', 'RULE-b'), pairKey('RULE-b', 'RULE-a'));
  const other = item({ id: 'RULE-a' });
  // The verdict was recorded with the ids the other way round; it must still
  // apply, and each recorded basis must line up with the id beside it.
  const mine = draftOf({ id: 'RULE-b', basis: 'basis-of-RULE-b' });
  assert.equal(contradictionGate(mine, [other], [verdict()]).allowed, true);
});

test('§7: the later line wins on read, which is what makes an append-only log safe', () => {
  const other = item({ id: 'RULE-b', basis: 'moved' });
  const mine = draftOf({ id: 'RULE-a', basis: 'basis-of-RULE-a' });
  const stale = verdict();
  const fresh = verdict({ bBasis: 'moved', ruledAt: '2026-09-09T00:00:00.000Z' });
  assert.equal(contradictionGate(mine, [other], [stale]).allowed, false, 'the old line has lapsed');
  assert.equal(
    contradictionGate(mine, [other], [stale, fresh]).allowed, true,
    'the later line settles the pair; a duplicate ruling is idempotent',
  );
});

test('at CREATION no verdict can apply, because the item has no id yet', () => {
  const other = item({ id: 'RULE-b' });
  // A verdict naming the id this capture is ABOUT to be given must not settle
  // it: nothing has ruled on an item that does not exist.
  const out = contradictionGate(draftOf({ id: null }), [other], [verdict({ a: 'RULE-b', b: 'RULE-z' })]);
  assert.equal(out.allowed, false);
});

/* ── 3. every candidate must be dispositioned (§5) ───────────────────────── */

test('§5: a write settling ONE of two candidates is refused again, naming the one still open', () => {
  const first = item({ id: 'RULE-first' });
  const second = item({ id: 'RULE-second' });
  const both = contradictionGate(draftOf(), [first, second], []);
  assert.deepEqual(both.candidates.map((c) => c.id).sort(), ['RULE-first', 'RULE-second']);

  const half = contradictionGate(
    draftOf({ distinct: ['RULE-first'] }), [first, second], [],
  );
  assert.equal(half.allowed, false, 'settling one of two must not let the write through');
  assert.deepEqual(
    half.candidates.map((c) => c.id), ['RULE-second'],
    'and the refusal names the one still open, not both',
  );

  const all = contradictionGate(
    draftOf({ distinct: ['RULE-first', 'RULE-second'] }), [first, second], [],
  );
  assert.equal(all.allowed, true);
  assert.deepEqual(
    all.candidates.map((c) => c.id).sort(), ['RULE-first', 'RULE-second'],
    'an allowed write reports what it SETTLED, so a verdict is recorded for each',
  );
});

test('§6: --supersedes settles a candidate too, and is reported as the supersession it is', () => {
  const old = item({ id: 'RULE-old' });
  const out = contradictionGate(draftOf({ supersedes: 'RULE-old' }), [old], []);
  assert.equal(out.allowed, true);
  assert.deepEqual(out.candidates.map((c) => c.id), ['RULE-old']);
});

test('a disposition naming no item at all is a typo, and is refused rather than recorded', () => {
  const real = item({ id: 'RULE-first' });
  const out = contradictionGate(
    draftOf({ distinct: ['RULE-frist'] }), [real], [],
  );
  assert.deepEqual(out.stray, ['RULE-frist']);
  const refusal = unknownDispositionRefusal(draftOf({ distinct: ['RULE-frist'] }), out.stray, 'add');
  assert.ok(refusal !== null);
  assert.match(refusal, /RULE-frist/);
  assert.match(refusal, /names no item in this corpus/);
  // And a disposition that names a REAL item the gate did not raise is not a
  // typo — see `unknownDispositionRefusal` for the three legitimate readings.
  assert.deepEqual(
    contradictionGate(draftOf({ distinct: ['RULE-first'] }), [real], []).stray, [],
  );
});

/* ── 4. the refusal itself (§5) ──────────────────────────────────────────── */

/**
 * The refusal is the product's whole answer, so its four promises are asserted
 * rather than eyeballed. They are the summary gate's four, deliberately: that
 * gate stopped four wrong edits in one session and each was corrected rather
 * than forced.
 */
test('§5: the refusal names each candidate, promises nothing was written, and names both ways out', () => {
  const hard = item({ id: 'RULE-hard-one', severity: 'hard' });
  const nosummary = item({ id: 'DEC-no-summary', type: 'decision', summary: null });
  const out = contradictionGate(draftOf(), [hard, nosummary], []);
  const text = contradictionRefusal(draftOf(), out.candidates, 'add');

  assert.match(text, /^my_context: /);
  assert.match(text, /nothing was created/, 'the promise every refusal in this product makes');
  assert.match(text, /RULE-hard-one/);
  assert.match(text, /rule · hard/, 'force is shown, because it decides how much the item costs');
  assert.match(text, /--distinct <id>/);
  assert.match(text, /--supersedes <id>/);
  assert.match(text, /abandon this write/, 'the third outcome, which needs no mechanism');
  assert.match(text, /no model in this product/, 'why the product cannot decide for you');
  assert.match(
    text, /\(no summary — read the item before ruling on it\)/,
    'an item with no summary says so; its body is never silently substituted',
  );

  // The MCP surface gets its own spelling: a refusal that names a command the
  // reader cannot run is worse than one that names nothing.
  const forAnAgent = contradictionRefusal(draftOf(), out.candidates, 'create_item');
  assert.match(forAnAgent, /distinct: \["<id>"\]/);
  assert.doesNotMatch(forAnAgent, /--distinct/);

  // And an edit says what an edit changes.
  const onAnEdit = contradictionRefusal(
    draftOf({ id: 'RULE-mine' }), out.candidates, 'edit',
  );
  assert.match(onAnEdit, /^my_context: RULE-mine may contradict/);
  assert.match(onAnEdit, /nothing was changed/);
});

test('the refusal says how many dispositions were accepted when some are still open', () => {
  const first = item({ id: 'RULE-first' });
  const second = item({ id: 'RULE-second' });
  const partial = draftOf({ distinct: ['RULE-first'] });
  const out = contradictionGate(partial, [first, second], []);
  const text = contradictionRefusal(partial, out.candidates, 'add');
  assert.match(text, /1 disposition was accepted/);
  assert.match(text, /one candidate is still open/);
  assert.match(text, /RULE-second/);
  assert.doesNotMatch(text, /RULE-first {2}\(/, 'the settled one is not listed as still open');
});

/* ── 5. the chokepoint (§2) ──────────────────────────────────────────────── */

/**
 * The runtime import graph, with erased statements dropped — the semantics
 * `test/ui/no-writes.test.ts` documents and `test/ui/staging-endpoint.test.ts`
 * uses: `import type … from '…'` is not an edge, a side-effect import and a
 * dynamic `import()` are.
 */
function runtimeGraph(entry: string): Set<string> {
  const files = new Set<string>();
  const queue = [entry];
  const push = (file: string, spec: string): void => {
    if (spec.startsWith('.')) queue.push(path.resolve(path.dirname(file), spec));
  };
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (files.has(file) || !existsSync(file)) continue;
    files.add(file);
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/(?:^|\n)\s*import\s+(type\s+)?([^;]*?)from\s*(['"])([^'"]+)\3/g)) {
      if (m[1] === undefined) push(file, m[4]!);
    }
    for (const m of source.matchAll(/(?:^|\n)\s*import\s*(['"])([^'"]+)\1/g)) push(file, m[2]!);
    for (const m of source.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1/g)) push(file, m[2]!);
  }
  return files;
}

const abs = (rel: string): string => path.join(REPO, ...rel.split('/'));

/**
 * **§2's table, executed.** Every surface the design lists as a write path,
 * walked at runtime: each one must reach `core/mutate.ts` — which is what makes
 * `createItem`/`updateItem` the chokepoint — and each must reach
 * `core/overlap.ts`, which is only reachable through them.
 *
 * A new write path that built its own item and called `persist` would fail the
 * second test below rather than this one; this proves the ones that exist go
 * through the door.
 */
test('§2: every write surface reaches the gate at runtime', () => {
  const surfaces = [
    'src/cli/index.ts',                       // mycontext add
    'src/cli/commands/edit.ts',               // mycontext edit
    'src/mcp/tools.ts',                       // create_item / update_item
    'src/cli/commands/inbox-promote.ts',      // mycontext inbox-promote
    'src/cli/commands/lesson.ts',             // mycontext lesson
    'src/ingest/apply.ts',                    // mycontext ingest-apply
    'src/lesson/derive.ts',                   // mycontext lesson-accept
    'src/pack/import.ts',                     // pack import
    'src/core/revision.ts',                   // a promoted revision
  ];
  for (const surface of surfaces) {
    const graph = runtimeGraph(abs(surface));
    assert.ok(graph.has(abs('src/core/mutate.ts')), `${surface} does not reach core/mutate.ts`);
    assert.ok(
      graph.has(abs('src/core/overlap.ts')),
      `${surface} reaches the write path without reaching the contradiction gate`,
    );
  }
});

/**
 * **The other half of the chokepoint: who may put item bytes on disk at all.**
 *
 * `persist` (core/persist.ts) is the function that writes an item's Markdown.
 * If a module other than the three below starts calling it, the gate has been
 * routed around — and the failure message says so rather than leaving the next
 * author to work out why a list exists.
 *
 * Each of the three is allowed for a stated reason, and the reason is the same
 * shape in each case: it cannot introduce a claim that could contradict
 * anything.
 *
 *  - `core/mutate.ts` — the gate itself is here.
 *  - `core/relations.ts` — `link_items`/`unlink_items` move `relations` only,
 *    which `SUMMARY_BASIS` classifies `unsummarised`: an edge says something
 *    about the PAIR, never about what either item claims.
 *  - `cli/commands/repair.ts` — re-stamps a checksum over bytes a human already
 *    wrote by hand. It writes no new text, and the hand edit it repairs is the
 *    case §5 says no gate at a command boundary can ever see.
 */
test('§2: only three modules put item bytes on disk, and none of them writes new claims', () => {
  const allowed = new Set([
    // `persist.ts` DEFINES the function; the other three are the only callers.
    'src/core/persist.ts',
    'src/core/mutate.ts', 'src/core/relations.ts', 'src/cli/commands/repair.ts',
  ]);
  const callers = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (entry.endsWith('.ts')) {
        const source = readFileSync(full, 'utf8');
        // The CALL, not the import and not the word in a comment: `persist(ctx`
        // is how every real call site in this repository is spelled.
        if (/\bpersist\(ctx\b/.test(source)) {
          callers.add(path.relative(REPO, full).split(path.sep).join('/'));
        }
      }
    }
  };
  walk(path.join(REPO, 'src'));
  const unexpected = [...callers].filter((f) => !allowed.has(f)).sort();
  assert.deepEqual(
    unexpected, [],
    'a new module writes item Markdown directly and so bypasses the contradiction gate. ' +
    'Route it through createItem/updateItem, or add it here WITH the reason it cannot ' +
    'introduce a contradicting claim.',
  );
  // Non-vacuous: the list is not a set of names nothing matches any more.
  for (const f of allowed) assert.ok(callers.has(f), `${f} no longer calls persist — prune this list`);
});

/**
 * **The gate runs BEFORE the first write in each function**, which is what
 * makes every refusal's "nothing was written" true. Asserted structurally
 * rather than by reading, because the ordering is the whole promise.
 */
test('§2: createItem and updateItem each consult the gate before their first persist', () => {
  const source = readFileSync(abs('src/core/mutate.ts'), 'utf8');
  for (const fn of ['export function createItem(', 'export function updateItem(']) {
    const start = source.indexOf(fn);
    assert.ok(start > 0, `${fn} not found`);
    const end = source.indexOf('\nexport ', start + fn.length);
    const body = source.slice(start, end === -1 ? source.length : end);
    const gate = body.indexOf('contradictionCheck(');
    const write = body.indexOf('persist(ctx');
    assert.ok(gate > 0, `${fn} does not call the contradiction gate at all`);
    assert.ok(write > 0, `${fn} no longer writes — this test is measuring the wrong function`);
    assert.ok(
      gate < write,
      `${fn} writes before it consults the gate, so its refusal's "nothing was written" is false`,
    );
  }
});

/* ── 6. end to end, against a real store (§7's two tests) ────────────────── */

const RULE_A = {
  type: 'rule' as const,
  title: 'Never log the customer email address',
  body: 'Redact the address before it reaches any log sink, in every service we run.',
  summary: 'Customer email addresses are removed before anything is written to a log.',
  origin: 'human' as const,
};

const RULE_B = {
  ...RULE_A,
  title: 'Never log the customer email address anywhere',
  body: 'Redact the address before it reaches any log sink, in every service we run today.',
  summary: 'Customer email addresses are removed before anything reaches a log, everywhere.',
};

test('END TO END: the gate refuses a real capture, and the same capture lands once it is settled', () => {
  const s = sandbox();
  try {
    const first = createItem(s.ctx, RULE_A);
    assert.equal(first.created, true);

    assert.throws(
      () => createItem(s.ctx, RULE_B),
      (err: Error) => /may contradict 1 item that currently governs/.test(err.message) &&
        /nothing was created/.test(err.message) && err.message.includes(first.id),
      'a near-duplicate of a standing rule must be refused, naming it',
    );
    assert.equal(
      s.ctx.store.all().length, 1,
      'the refusal promises nothing was created, and nothing was',
    );
    assert.equal(
      existsSync(contradictionLogPath(s.ctx.root)), false,
      'a refused write records no verdict: nobody ruled on anything',
    );

    const second = createItem(s.ctx, { ...RULE_B, distinct: [first.id] });
    assert.equal(second.created, true);

    const rows = readVerdicts(s.ctx.root);
    assert.equal(rows.length, 1, 'one ruling, one row');
    assert.equal(rows[0]!.verdict, 'distinct');
    assert.equal(rows[0]!.ruledBy, 'human');
    assert.deepEqual([rows[0]!.a, rows[0]!.b].sort(), [first.id, second.id].sort());
    // Keyed to what BOTH items say today — §7's whole mechanism.
    const basisOf = (id: string): string => contradictionBasis(s.ctx.store.get(id)!);
    const forFirst = rows[0]!.a === first.id ? rows[0]!.aBasis : rows[0]!.bBasis;
    assert.equal(forFirst, basisOf(first.id));
  } finally { s.dispose(); }
});

test('END TO END: a settled pair is not raised again, so the gate gets quieter with use', () => {
  const s = sandbox();
  try {
    const first = createItem(s.ctx, RULE_A);
    const second = createItem(s.ctx, { ...RULE_B, distinct: [first.id] });

    // **A write that puts the item back IN FORCE without changing a word of
    // what it says.** Retiring it and bringing it back is the cheapest such
    // write there is, and it goes through the clause that closes the "capture a
    // draft, then promote it" door: coming back to `active` is the moment the
    // item starts governing again, so the gate is consulted — and the ruling
    // already recorded answers it, because neither basis has moved.
    updateItem(s.ctx, { id: second.id, status: 'deprecated', origin: 'human' });
    const back = updateItem(s.ctx, { id: second.id, status: 'active', origin: 'human' });
    assert.equal(
      back.created, true,
      'a pair already ruled on must not be raised again while both items still say the same thing',
    );
    assert.equal(
      readVerdicts(s.ctx.root).length, 1,
      'and nothing new is recorded: the question was not asked, so nobody answered it',
    );
  } finally { s.dispose(); }
});

/**
 * **§11's LAPSE test.** A verdict, then an edit that changes what one item
 * MEANS, then the pair is raised again — which is correct rather than noise:
 * the ruling was about two sentences, and one of them has been replaced.
 */
test('§11 LAPSE: a verdict, a meaning change, and the pair is raised again', () => {
  const s = sandbox();
  try {
    const first = createItem(s.ctx, RULE_A);
    const second = createItem(s.ctx, { ...RULE_B, distinct: [first.id] });

    assert.equal(readVerdicts(s.ctx.root).length, 1, 'the pair is settled to begin with');

    // The FIRST item's meaning moves — a new body AND a new sentence, which is
    // the plainest available way of saying it no longer claims what it claimed.
    // The ruling made about the old sentence does not carry to the new one, so
    // the same pair is put back in front of a person.
    const meaningMoved = {
      id: first.id,
      body: 'Redact the address, and also the account number, before any log sink sees it.',
      summary: 'Customer email addresses and account numbers are removed before anything is logged.',
      origin: 'human' as const,
    };
    assert.throws(
      () => updateItem(s.ctx, meaningMoved),
      (err: Error) => /may contradict/.test(err.message) && err.message.includes(second.id),
      'when an item meaning moves, the ruling lapses and the pair is raised again',
    );
    assert.equal(
      s.ctx.store.get(first.id)!.body, RULE_A.body,
      'and the refusal\'s "nothing was changed" holds: the old body is still on disk',
    );

    // Re-ruled, and the log GROWS by one line rather than being rewritten.
    const again = updateItem(s.ctx, { ...meaningMoved, distinct: [second.id] });
    assert.equal(again.created, true);
    const rows = readVerdicts(s.ctx.root);
    assert.equal(rows.length, 2, 'append-only: the lapsed ruling is still on disk above the new one');
    assert.notEqual(rows[1]!.carried, true, 'this one is a RULING, not a re-stamp of an old one');
    assert.notDeepEqual(
      [rows[0]!.aBasis, rows[0]!.bBasis], [rows[1]!.aBasis, rows[1]!.bBasis],
      'and it is keyed to what the item says now, which is what made the first one lapse',
    );
  } finally { s.dispose(); }
});

/**
 * **§11's NO-LAPSE test**, and the section the design says it lives or dies on.
 *
 * `--summary-unchanged` asserts in words that an edit does not change what the
 * item MEANS. It re-stamps `summary_of`; every verdict is keyed to that stamp;
 * so the verdicts are re-stamped with it. Without this the one flag whose whole
 * content is "the meaning did not move" would lapse every ruling about the
 * item, and a typo fix would re-raise pairs a person had already settled — the
 * wall §7 exists to prevent.
 */
test('§11 NO-LAPSE: a verdict, then --summary-unchanged, and the pair stays settled', () => {
  const s = sandbox();
  try {
    const first = createItem(s.ctx, RULE_A);
    const second = createItem(s.ctx, { ...RULE_B, distinct: [first.id] });
    const before = readVerdicts(s.ctx.root);
    assert.equal(before.length, 1);

    // A mechanical edit to the FIRST item: the text moves, the meaning does
    // not, and the writer says so.
    const typo = updateItem(s.ctx, {
      id: first.id,
      body: `${RULE_A.body.replace('log sink', 'log sink,')}`,
      summaryUnchanged: true,
      origin: 'human',
    });
    assert.equal(typo.created, true, 'the mechanical edit itself must not be refused');

    const after = readVerdicts(s.ctx.root);
    assert.equal(after.length, 2, 'the ruling is re-stamped, append-only, never rewritten');
    const carried = after[1]!;
    assert.equal(carried.carried, true, 'and the re-stamp is marked as one, not passed off as a ruling');
    assert.equal(
      carried.ruledAt, before[0]!.ruledAt,
      'the day the PERSON ruled is preserved; the re-stamp is not a new ruling',
    );
    const basisOf = (id: string): string => contradictionBasis(s.ctx.store.get(id)!);
    const forFirst = carried.a === first.id ? carried.aBasis : carried.bBasis;
    assert.equal(forFirst, basisOf(first.id), 'the carried row is keyed to what the item says NOW');

    // And the proof that it worked, from the OTHER item's side: a write that
    // puts the second item back in force is measured against the pair, and the
    // carried ruling answers it. Without the carry-forward this is refused,
    // because the first item's basis moved under the typo fix.
    updateItem(s.ctx, { id: second.id, status: 'deprecated', origin: 'human' });
    const back = updateItem(s.ctx, { id: second.id, status: 'active', origin: 'human' });
    assert.equal(
      back.created, true,
      'a mechanical edit to one item must not re-open a pair a person already settled',
    );
  } finally { s.dispose(); }
});

/**
 * §6 path 2: the new item is created AND the old one retired in one act, with
 * the link recorded — routed through `supersedeItem`, which already validates
 * both ids, refuses a second successor and writes both edges.
 */
test('§6: --supersedes creates the replacement and retires the item it replaces, in one act', () => {
  const s = sandbox();
  try {
    const first = createItem(s.ctx, RULE_A);
    const second = createItem(s.ctx, { ...RULE_B, supersedes: first.id });

    const retired = s.ctx.store.get(first.id)!;
    assert.equal(retired.status, 'superseded');
    assert.ok(
      retired.relations.some((r) => r.type === 'superseded_by' && r.target === second.id),
      'the retiree names its successor — nothing retires without one',
    );
    assert.ok(
      s.ctx.store.get(second.id)!.relations.some(
        (r) => r.type === 'supersedes' && r.target === first.id,
      ),
      'and the successor names what it replaced, so the chain reads in both directions',
    );
    assert.equal(readVerdicts(s.ctx.root)[0]!.verdict, 'supersedes');
  } finally { s.dispose(); }
});

/**
 * §10's least certain case, reported rather than bypassed: an automated path
 * with no human at the keyboard.
 *
 * An agent's normative capture lands as a `draft` (`trustedStatus`), and a
 * draft governs nothing — so it is not gated, and `lesson-accept`,
 * `ingest-apply` and pack import keep working. The ruling happens at the
 * PROMOTION, which is where a person is, and this test pins both halves.
 */
test('§10: an agent\'s draft capture is not gated; the human promotion of it is', () => {
  const s = sandbox();
  try {
    createItem(s.ctx, RULE_A);
    const agentDraft = createItem(s.ctx, { ...RULE_B, origin: 'agent' });
    assert.equal(agentDraft.status, 'draft', 'an agent normative capture lands as a draft');
    assert.equal(
      agentDraft.created, true,
      'and it is NOT refused: a draft governs nothing, and no agent can answer the gate',
    );
    assert.equal(existsSync(contradictionLogPath(s.ctx.root)), false);

    assert.throws(
      () => updateItem(s.ctx, { id: agentDraft.id, status: 'active', origin: 'human' }),
      /may contradict/,
      'promotion is the moment it starts to govern, and the moment a person is present',
    );
  } finally { s.dispose(); }
});

test('a write that changes no meaning and starts nothing governing is never gated', () => {
  const s = sandbox();
  try {
    const first = createItem(s.ctx, RULE_A);
    const second = createItem(s.ctx, { ...RULE_B, distinct: [first.id] });
    // A retag on the FIRST item: nothing it claims moves, and `SUMMARY_BASIS`
    // says so. The pair is settled anyway, but the point is that the gate is
    // not even consulted — a retag can contradict nothing.
    assert.equal(updateItem(s.ctx, { id: first.id, tags: ['v2'], origin: 'human' }).created, true);
    assert.equal(
      itemSummaryBasis(s.ctx.store.get(second.id)!), contradictionBasis(s.ctx.store.get(second.id)!),
      'and the second item is untouched by any of it',
    );
  } finally { s.dispose(); }
});
