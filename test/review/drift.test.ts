// @basis TASK-notice-the-drift-while-it-is-happening-quietly-and-off-by,
// INV-nothing-is-dropped-silently
/**
 * **Noticing drift** — `plan:recall seq:3`, Task 13 of
 * `docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md`, and §14 of
 * `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * ── WHAT IS ACTUALLY UNDER TEST, AND WHY IN THIS ORDER ─────────────────────
 *
 *  1. **OFF BY DEFAULT, and it is the feature's safety property rather than a
 *     config nicety.** Telling the owner he has drifted when he has not is
 *     worse than silence. So the first two tests are a PAIR: a workspace that
 *     never heard of the key gets `null` for an input that, with the key set,
 *     is a warning. Without the second, the first would pass on a `driftCheck`
 *     that returned `null` for everything — which is the vacuity this project
 *     keeps finding, and `plan:archive seq:9` is the precedent where
 *     off-by-default was enforced in three places and stated in none.
 *  2. **The anchor.** Drift is a comparison between two texts the owner
 *     produced — the anchor he fixed, and the stretch that followed. With no
 *     anchor there is no verdict, because the alternative is a guess at intent
 *     and a guess that resolves is worse than silence.
 *  3. **The rubric is `loop/2`'s**, asserted by comparing the sentence drift
 *     reports to the one `worthAPass` produces for the same points. A fork
 *     would drift from it in a week; this test is what makes forking visible.
 *  4. **Nothing calls it.** The item says the owner may decide he no longer
 *     wants this once finding his way back is cheap, so it must not be
 *     load-bearing for anything and must not sit in a path that runs whether
 *     he wants it or not. The scan has a POSITIVE CONTROL — a planted importer
 *     in a temp directory — because an absence assertion with a broken scanner
 *     is green forever.
 *
 * ── ON THE FIXTURES ────────────────────────────────────────────────────────
 *
 * The anchor names `src/core/retrieval/mission.ts` and
 * `INV-nothing-is-dropped-silently`. The drifted stretch names
 * `src/ui/public/screens/watch.js` and `renderLaneStrip` and shares NOT ONE
 * character-run with either, so no assertion here can pass on a substring that
 * another field of the verdict happens to contain. The assertions are on the
 * verdict's STRUCTURE — `shared`, `anchorNames`, `anchor.id`, `rubric.fire` —
 * and the one assertion on prose is on `because`, which is a different field
 * from the `anchor.label` it is asserted to quote.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findProjectRoot } from '../../src/core/workspace.ts';
import { worthAPass, type RubricPoint } from '../../src/review/rubric.ts';
import {
  DEFAULT_DRIFT, DRIFT_CONFIG_KEY, anchorForStretch, driftCheck, driftConfigAt, noticeDrift,
  type DriftAnchor, type DriftStretch,
} from '../../src/review/drift.ts';
import type { AnchorRow } from '../../src/core/conversation-index.ts';

/** The point the owner fixed. Its names are what the stretch is judged against. */
const ANCHOR: DriftAnchor = {
  id: 'sess-a:-:40960',
  label: 'the retrieval mission',
  // The path ENDS a sentence, deliberately and against the first draft of this
  // file, which wrote a comma there. Measured 2026-09-11: `from-selection.ts`
  // admits `.` as a path character and not `,`, so the comma form yields the
  // path clean and `normalise` has nothing to do — the assertion on
  // `anchorNames` below passed with the whole of it removed. The full stop is
  // the ordinary way a name appears in a label somebody wrote, and it is what
  // makes that assertion, and the one on `shared`, rest on something.
  text:
    'A mission carries pointers into src/core/retrieval/mission.ts. It never carries '
    + 'passages. INV-nothing-is-dropped-silently.',
  at: '2026-09-11T01:00:00.000Z',
  byteOffset: 40960,
};

/** The two names the anchor carries, normalised as `drift.ts` normalises them. */
const ANCHOR_NAMES = ['inv-nothing-is-dropped-silently', 'src/core/retrieval/mission.ts'];

/** A stretch that shares nothing with the anchor. This is the drift. */
const AWAY =
  'rewrote src/ui/public/screens/watch.js so the lane strip redraws; renderLaneStrip '
  + 'now takes a budget';

/** A stretch still on the anchor's subject. */
const NEAR = 'the mission writer in src/core/retrieval/mission.ts still refuses to print the passage';

/** Points that make a stretch worth looking at at all — `rubric.ts`'s FIRES_ALONE. */
const WORTH: RubricPoint[] = [
  { category: 'decision', who: 'person' },
  { category: 'measurement', who: 'model' },
];

/** Points the rubric declines: measurement is its most abundant category and fires on nothing. */
const NOT_WORTH: RubricPoint[] = [
  { category: 'measurement', who: 'model' },
  { category: 'question', who: 'person' },
];

function stretch(text: string, points: RubricPoint[] = WORTH): DriftStretch {
  return { text, points, turns: 15, startByte: 61440 };
}

/**
 * A corpus root — the `.my_context` directory, which is what `findProjectRoot`
 * returns and therefore what `driftConfigAt` is given in production.
 *
 * `config` as a string is written verbatim, so a test can hand it a file that
 * is not JSON at all.
 */
function corpus(config?: unknown): string {
  const root = path.join(mkdtempSync(path.join(tmpdir(), 'drift-')), '.my_context');
  mkdirSync(root, { recursive: true });
  if (config !== undefined) {
    writeFileSync(
      path.join(root, 'config.json'),
      typeof config === 'string' ? config : JSON.stringify(config, null, 2),
    );
  }
  return root;
}

/* ─────────────────── 1. it must be able to be wrong quietly ─────────────── */

test('off by default: a workspace that never heard of the key gets no verdict at all', () => {
  const root = corpus({ ui: { enabled: true } });

  assert.equal(driftCheck({ corpusRoot: root, anchor: ANCHOR, stretch: stretch(AWAY) }), null);
  assert.deepEqual(driftConfigAt(root), { enabled: false });
});

test('off by default: the very same stretch IS a warning once it is switched on', () => {
  // The positive control for the test above. Same anchor, same stretch, same
  // points — the only difference is the key, so `null` above is the switch and
  // not a `driftCheck` that answers `null` to everything.
  const root = corpus({ [DRIFT_CONFIG_KEY]: { enabled: true } });

  const verdict = driftCheck({ corpusRoot: root, anchor: ANCHOR, stretch: stretch(AWAY) });

  assert.notEqual(verdict, null);
  assert.equal(verdict?.drifted, true);
});

test("off by default: this project's own corpus has not turned it on", () => {
  // Dogfooding — the current corpus, not a fixture. `.my_context/config.json`
  // is the owner's and this asserts what it says today: nothing has quietly
  // switched on a thing that can be wrong out loud.
  const root = findProjectRoot(process.cwd());
  assert.notEqual(root, null);

  assert.equal(DEFAULT_DRIFT.enabled, false);
  assert.deepEqual(driftConfigAt(root as string), { enabled: false });
});

test('a config that cannot be read leaves it off rather than on', () => {
  // Both directions of unreadable, and both must fail towards silence.
  const broken = corpus('{ "drift": { "enabled": true,,, }');
  const wrongType = corpus({ [DRIFT_CONFIG_KEY]: { enabled: 'true' } });

  assert.deepEqual(driftConfigAt(broken), { enabled: false });
  assert.deepEqual(driftConfigAt(wrongType), { enabled: false });
  assert.equal(driftCheck({ corpusRoot: wrongType, anchor: ANCHOR, stretch: stretch(AWAY) }), null);
});

/* ───────────────── 2. against an anchor, never against a guess ──────────── */

test("drift is judged against the anchor's names, and the reason quotes the anchor", () => {
  const verdict = noticeDrift(ANCHOR, stretch(AWAY));

  assert.equal(verdict.drifted, true);
  assert.equal(verdict.anchor?.id, 'sess-a:-:40960');
  assert.deepEqual(verdict.anchorNames, ANCHOR_NAMES);
  assert.deepEqual(verdict.shared, []);
  assert.ok(
    verdict.because.includes('the retrieval mission'),
    `the reason must name the anchor it judged against, and said: ${verdict.because}`,
  );
});

test("a stretch still naming the anchor's subject is not drift", () => {
  const verdict = noticeDrift(ANCHOR, stretch(NEAR));

  assert.equal(verdict.drifted, false);
  assert.deepEqual(verdict.shared, ['src/core/retrieval/mission.ts']);
});

test('with no anchor there is no verdict about what he meant', () => {
  const verdict = noticeDrift(null, stretch(AWAY));

  assert.equal(verdict.drifted, false);
  assert.equal(verdict.anchor, null);
  assert.deepEqual(verdict.anchorNames, []);
  assert.ok(
    verdict.because.includes('nothing to judge against'),
    `a missing anchor must be stated, and said: ${verdict.because}`,
  );
});

test('an anchor with nothing to match on is silence, not a warning', () => {
  const vague: DriftAnchor = { ...ANCHOR, label: 'we talked it over', text: 'and agreed on it' };

  const verdict = noticeDrift(vague, stretch(AWAY));

  assert.equal(verdict.drifted, false);
  assert.deepEqual(verdict.anchorNames, []);
});

test('a stretch with nothing to match on is silence, not a warning', () => {
  const verdict = noticeDrift(ANCHOR, stretch('we talked it over and agreed it was fine'));

  assert.equal(verdict.drifted, false);
  assert.deepEqual(verdict.stretchNames, []);
});

/* ──────────────── 3. loop/2's machinery, asked a different question ─────── */

test("the rubric that gates it is loop/2's, word for word, not a second one", () => {
  const verdict = noticeDrift(ANCHOR, stretch(AWAY, NOT_WORTH));

  // Declined, even though the names share nothing: a stretch the rubric would
  // not have looked at is not a stretch to warn about.
  assert.equal(verdict.drifted, false);
  assert.equal(verdict.rubric.fire, false);
  // And the sentence is the rubric's own. A fork would produce a different one.
  assert.equal(verdict.rubric.because, worthAPass(NOT_WORTH).because);
  assert.ok(
    verdict.because.includes(worthAPass(NOT_WORTH).because),
    `the refusal must carry the rubric's reason, and said: ${verdict.because}`,
  );
});

test('the anchor in force is the last one at or before the stretch, and a lane\'s is not one', () => {
  const rows: AnchorRow[] = [
    row('sess-a', null, 1024, 'the first plan'),
    row('sess-a', null, 40960, 'the retrieval mission'),
    // A lane's offset is into a DIFFERENT file, so it is a different ruler and
    // cannot be compared with the session's own byte positions.
    row('sess-a', 'lane-7', 51200, 'what the lane was told'),
    // Set after the stretch began: it cannot be what the stretch departed from.
    row('sess-a', null, 90112, 'the thing he marked afterwards'),
  ];

  const chosen = anchorForStretch(rows, 61440);

  assert.equal(chosen?.byteOffset, 40960);
  assert.equal(chosen?.label, 'the retrieval mission');
  assert.equal(anchorForStretch(rows, 512), null);
});

/* ──────────────── 4. it is not wired into anything that runs ────────────── */

test('nothing in the product calls it, so it cannot warn on a path he did not choose', () => {
  const planted = mkdtempSync(path.join(tmpdir(), 'drift-scan-'));
  writeFileSync(
    path.join(planted, 'hook.ts'),
    "import { driftCheck } from '../review/drift.ts';\nexport { driftCheck };\n",
  );

  // The positive control: the scanner CAN see an importer. Without this, the
  // assertion below is green on a scanner that reads nothing.
  assert.deepEqual(importersOf(planted), ['hook.ts']);

  assert.deepEqual(importersOf(path.join(process.cwd(), 'src')), []);
});

/* ─────────────────────────────── helpers ───────────────────────────────── */

function row(sessionId: string, agentId: string | null, byteOffset: number, label: string): AnchorRow {
  return {
    id: `${sessionId}:${agentId ?? '-'}:${byteOffset}`,
    sessionId, agentId, byteOffset, label,
    kind: 'note', origin: 'owner', at: '2026-09-11T01:00:00.000Z',
  };
}

/**
 * Every source under `dir` that reaches `review/drift.ts`, relative to `dir`.
 *
 * The module itself is excluded by name: its own header names its own path,
 * and a scan that counted that would report the file as its own importer.
 */
function importersOf(dir: string): string[] {
  const found: string[] = [];
  const walk = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(ts|js|mjs)$/.test(entry.name)) continue;
      const relative = path.relative(dir, full).split(path.sep).join('/');
      if (relative === 'review/drift.ts') continue;
      if (/from\s+'[^']*review\/drift\.ts'/.test(readFileSync(full, 'utf8'))) found.push(relative);
    }
  };
  walk(dir);
  return found.sort();
}
