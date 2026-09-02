/**
 * **THE TERMINAL STATUS LINE'S FIELDS MUST BE A SUBSET OF THE WEB STRIP'S.**
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 *
 * On 2026-09-01 neither surface was a superset of the other. The terminal drew
 * the model and its modes, the cost, the cache share, the headroom to the next
 * handover ask, the session name, the focus and the audit clock, and the web
 * strip drew none of them. The strip drew the item count, the corpus drift, the
 * doctor notices, the review queue, the injection count and the git upstream
 * verdict, and the terminal drew none of those.
 *
 * They diverged for one reason and it is not that anybody was careless: **each
 * bar was specified separately and nothing held them together.** That is this
 * project's single most repeated defect — a hand-kept list that must agree with
 * something derived — and it had been measured EIGHT times by the day this file
 * was written. The owner's ruling was that the strip becomes a superset ("do
 * not cut off what the bar has and terminal not, we can and want to show more
 * on the web status bar"), and a superset that nothing enforces is a superset
 * for exactly as long as nobody adds a field.
 *
 * ── WHAT IT ASSERTS, AND IN WHICH DIRECTION ────────────────────────────────
 *
 * ONE direction: `terminal ⊆ web`. A field the terminal draws and the strip
 * does not is the defect. A field the strip draws and the terminal does not is
 * LEGITIMATE and expected — the browser has room the terminal does not, and the
 * review queue is the standing example: it was refused for the terminal because
 * it needs `.index.db` opened, a second database, costing +32% of that bar's
 * per-message budget, and it is free on the web from `/api/status`. Same field,
 * different verdict, and the reason is the surface's cost model rather than the
 * field's worth. A bidirectional check would have forced that field OFF the web
 * to go green, which is parity by subtraction and is the opposite of the ruling.
 *
 * ── WHAT IT DOES NOT ASSERT, DELIBERATELY ──────────────────────────────────
 *
 * **Presentation.** The two surfaces are entitled to say one fact differently:
 * the browser gives the context figure a coloured background and a 16px 700
 * face, and a terminal cannot do either. What is compared is WHICH FACT is on
 * the bar, never how it is drawn. If this test ever starts failing because one
 * surface can do something the other cannot, the test is wrong.
 *
 * **State counts.** A block that explains why a field is missing carries the
 * SAME id as the field it qualifies — `myctx unavailable (…)` is the myctx
 * field in its absent state, not a field of its own, and the strip already
 * draws exactly that pairing as `strip.myctx` / `strip.myctxUnavailable`.
 * Otherwise the comparison would be about states, and the two surfaces have
 * different numbers of them for good reasons.
 *
 * ── HOW BOTH SETS ARE DERIVED, AND WHY NEITHER IS A LIST ───────────────────
 *
 * A hand-kept list of field names inside a parity test IS the defect the test
 * exists to catch, so there is none. `FIELD_ID` reads the same form out of both
 * files: a field id is written either as a `field: '<id>'` property or assigned
 * to `dataset.f`, and nowhere else. That form is not a convention this file
 * invented and hopes for — both files were restructured so it holds (see
 * `buildLines`' rate-window table and `drawIdentity`'s `keyed` options), and
 * the two cross-checks below are what make the scan trustworthy rather than
 * merely plausible:
 *
 *   1. **The terminal's byte set equals its RUNTIME set.** `buildLines` is
 *      executed over a fixture that fills every optional group, and the fields
 *      it actually emits are compared with the fields the file declares, IN
 *      BOTH DIRECTIONS. A field literal the fixture cannot reach fails; a
 *      field emitted from a literal the scan cannot see fails.
 *
 *   2. **Every segment the terminal emits carries a field.** An untagged block
 *      would be invisible to both of the above, which is precisely how a
 *      derivation quietly becomes a list again.
 *
 *   3. **Neither set may be empty or tiny.** A regex that stops matching turns
 *      a subset assertion into a tautology — every set contains the empty set —
 *      and that failure mode is silent. Both sets are floored.
 *
 * The fixture's own completeness is derived too: `PowerlineInput`'s property
 * names are read out of the source and every one of them must be non-empty in
 * the fixture. A field added to the terminal comes with an input to draw it
 * from, and the new property fails that check until the fixture is extended —
 * at which point the new field appears in the runtime set and this test fails
 * on the subset until the strip draws it. That is the chain, and its one known
 * gap is stated in the assertion itself: a field derived entirely from an
 * EXISTING input property does not force a fixture change, and is caught by
 * cross-check 1 only if the fixture happens to reach it.
 *
 * The web side is scanned from `app.js`'s bytes here, for speed, and DRIVEN in
 * `e2e/strip.spec.ts`, which collects `[data-f]` out of a real page across
 * every state it walks and asserts the same subset. This file is the fast gate;
 * that one is the one that proves the strip actually draws what it declares.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildLines, GIVE, NO_EXTRAS, type PowerlineInput, type Segment,
} from '../../src/cli/commands/statusline-powerline.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const TERMINAL = path.join(REPO, 'src', 'cli', 'commands', 'statusline-powerline.ts');
const STRIP = path.join(REPO, 'src', 'ui', 'public', 'app.js');

/**
 * The ONE form a field id may be written in, on either surface: a `field:`
 * property, or an assignment to `dataset.f`. One regex, applied identically to
 * a TypeScript module and a browser one — nothing here knows which file it is
 * reading, which is what stops it drifting into two rules.
 */
const FIELD_ID = /(?:\bfield: |\.dataset\.f = )'([a-z0-9-]+)'/g;

function declaredIn(file: string): Set<string> {
  return new Set([...readFileSync(file, 'utf8').matchAll(FIELD_ID)].map((m) => m[1]!));
}

/**
 * A payload with EVERY optional group present, so `buildLines` draws every
 * block it can draw.
 *
 * Deliberately not a realistic session: a realistic one is exactly what leaves
 * a field unreachable. The percentage sits below the warn band so the ask block
 * renders its headroom rather than `handover due`, which is the state with the
 * most in it; the crit state is reached by the second run below.
 */
const FULL: PowerlineInput = {
  ...NO_EXTRAS,
  model: 'Claude Opus 4.6',
  modes: { effort: 'high', thinking: true, fastMode: true, exceeds200k: true },
  project: 'test_mycontext_plugin',
  branch: 'campaign/my-context-test',
  sessionName: 'walk lane',
  focus: 'plan:walk seq:118',
  occupancy: { state: 'known', percent: 25.1, ageMs: 1000, usedTokens: Math.round((25.1) * 10_000), windowSize: 1_000_000 },
  threshold: 85,
  fiveHour: { usedPercent: 16, resetsAt: 1_800_000_000 },
  sevenDay: { usedPercent: 49, resetsAt: 1_800_000_000 },
  costUsd: 4.62,
  // NON-NULL, so the field it draws is actually reached: the fixture's whole
  // job is that every declared input produces a block the comparison can see.
  elapsedMs: 5_040_000,
  warmPercent: 91.4,
  myctx: { tokens: 6200, injections: 3, unrecorded: 0 },
  lastAudit: { state: 'known', op: 'subagent-stop', at: new Date().toISOString() },
  myctxNote: null,
  teeNote: null,
  // The ORDINARY directory case: the session is where it was launched, and the
  // corpus it resolves to is the launch directory's own. Both fields render
  // their quiet spelling here; `NOTED` below carries the alarm, so the two
  // fixtures between them reach every branch `corpusSegment` has.
  cwd: '/repo/test_mycontext_plugin',
  projectDir: '/repo/test_mycontext_plugin',
  corpus: {
    root: '/repo/test_mycontext_plugin/.my_context', overridden: false, nesting: null,
  },
};

/** The same payload with the two NOTES present instead of what they qualify. */
const NOTED: PowerlineInput = {
  ...FULL,
  myctx: null,
  myctxNote: 'the audit projection has not been built',
  teeNote: 'tee not written (unsafe session id)',
  // ── AND THE CORPUS ALARM, which is the state the field was added for.
  //
  // The session has moved into a subdirectory that holds a corpus of its own,
  // so the walk stopped early and every hook is writing somewhere the bar is
  // not reading. It rides this fixture rather than `FULL` for the reason the
  // two notes do: one payload cannot be in two states at once, and the pair is
  // what reaches both.
  cwd: '/repo/test_mycontext_plugin/my-context',
  corpus: {
    root: '/repo/test_mycontext_plugin/my-context/.my_context',
    overridden: false,
    nesting: {
      enclosing: '/repo/test_mycontext_plugin/.my_context', items: 44, enclosingItems: 759,
    },
  },
};

function emitted(input: PowerlineInput): Segment[] {
  // ALL THREE rows since the owner's three-row ruling of 2026-09-01. A group
  // left out here would make every field on it invisible to the parity scan,
  // which is the derivation quietly becoming a hand-kept list again.
  const { identity, window, account } = buildLines(input, Date.now());
  return [...identity, ...window, ...account];
}

const RENDERED: Segment[] = [...emitted(FULL), ...emitted(NOTED)];

test('every block the terminal emits carries a field id', () => {
  // An untagged block is invisible to both derivations below, which is exactly
  // how a derived set quietly becomes a hand-kept one. `ELLIPSIS_SEGMENT` is
  // the only untagged Segment in the file and `buildLines` never emits it — it
  // is the mark that says a field was DROPPED, which is not a field.
  const untagged = RENDERED.filter((s) => s.field === undefined).map((s) => s.text);
  assert.deepEqual(untagged, [], 'these blocks would be invisible to the parity comparison');
});

test('the terminal fixture reaches every field the terminal declares', () => {
  const declared = declaredIn(TERMINAL);
  const rendered = new Set(RENDERED.map((s) => s.field).filter((f) => f !== undefined));
  assert.deepEqual(
    [...declared].filter((f) => !rendered.has(f)).sort(), [],
    'declared in statusline-powerline.ts and never emitted by the fixture — extend `FULL`/'
      + '`NOTED` so the field is actually reached, or the subset check below cannot see it',
  );
  assert.deepEqual(
    [...rendered].filter((f) => !declared.has(f)).sort(), [],
    'emitted by buildLines and not visible to the byte scan — write the id as a `field:` '
      + "property or a `dataset.f` assignment, never as a bare positional argument",
  );
});

test('the fixture supplies every input the terminal declares', () => {
  // DERIVED from the interface, so a field added to the bar drags its input in
  // with it and fails here until the fixture is extended. The block comment on
  // this file states the one gap: a field derived entirely from an EXISTING
  // property does not force a fixture change.
  const src = readFileSync(TERMINAL, 'utf8');
  const open = src.indexOf('export interface PowerlineInput {');
  assert.ok(open !== -1, 'PowerlineInput must be declared in statusline-powerline.ts');
  const close = src.indexOf('\n}', open);
  assert.ok(close > open, 'PowerlineInput must be closed');
  const body = src.slice(open, close);
  const props = [...body.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*)(\?)?: /gm)].map((m) => m[1]!);
  assert.ok(props.length > 10, `PowerlineInput declared ${props.length} properties — the scan `
    + 'found too few to be reading the interface at all');
  // Across the fixture SET, not one of them: `myctxNote` and `teeNote` are the
  // reasons two other fields are absent, so a payload carrying them cannot also
  // carry what they explain. Two fixtures, and every property supplied by one
  // of them.
  const records = [FULL, NOTED].map((f) => f as unknown as Record<string, unknown>);
  const missing = props.filter((p) => records.every((r) => {
    const v = r[p];
    return v === undefined || v === null || v === '';
  }));
  assert.deepEqual(missing, [],
    'PowerlineInput declares these and the fixture leaves them empty, so whatever they draw is '
      + 'never reached by this comparison');
});

test('the terminal draws no field the web strip lacks', () => {
  const terminal = declaredIn(TERMINAL);
  const web = declaredIn(STRIP);

  // ── THE VACUITY FLOOR. Every set contains the empty set, so a regex that
  // stopped matching would make the assertion below pass while comparing
  // nothing at all — silently, and for as long as nobody looked. This is the
  // failure mode that made the mockup/app strip gap survive a month.
  assert.ok(terminal.size >= 10,
    `the terminal declared ${terminal.size} field ids — too few to be reading the file`);
  assert.ok(web.size >= 10,
    `the strip declared ${web.size} field ids — too few to be reading the file`);

  const missing = [...terminal].filter((f) => !web.has(f)).sort();
  assert.deepEqual(missing, [],
    'the terminal status line draws these fields and the web strip does not. The strip is a '
      + 'SUPERSET by the owner’s ruling, so the fix is to draw them there — never to '
      + 'drop them from the terminal, and never to relax this assertion.');
});

test('web-only fields are allowed, and there are some', () => {
  // Stated as an assertion rather than left implicit, so the direction of this
  // gate is impossible to misread later: the strip is a superset, and a run in
  // which the two sets were EQUAL would mean somebody had harmonised the web
  // down to the terminal to go green.
  const terminal = declaredIn(TERMINAL);
  const web = declaredIn(STRIP);
  const only = [...web].filter((f) => !terminal.has(f));
  assert.ok(only.length > 0,
    'the strip declares no field the terminal lacks. That is not parity, it is parity by '
      + 'subtraction — the browser has room the terminal does not, and the ruling was that '
      + 'it be used.');
});
