import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHECKSUM_BASIS_VERSION, classifyChecksumMismatch, computeItemChecksum, formatChecksum,
  parseChecksumVersion,
} from '../../src/core/item.ts';
import type { Item } from '../../src/core/types.ts';

/**
 * **The basis-pinning fixture — every conditional key `computeItemChecksum`
 * can emit is populated, deliberately, so this pins the WHOLE shape and not
 * just the fields every item has.** `continuity: true`, a non-null
 * `summary`/`summaryOf`, a non-empty `summaryWas`, `acknowledged`, `steps`,
 * `observations`, `relations` and `extra` are each present for exactly the
 * reason `computeItemChecksum`'s own comments give for making them
 * conditional in the first place: an edit to any one of those keys — adding,
 * removing, renaming, or making it unconditional — must move THIS fixture's
 * checksum, or the golden value below would go on passing while silently
 * blind to a change in the very shape it exists to pin.
 *
 * Built by hand rather than via `parseItem`, so nothing about this test
 * depends on the parser also being correct — it exercises `computeItemChecksum`
 * alone, against a shape this file owns and never derives from disk.
 */
const FIXTURE: Item = {
  id: 'CONST-golden-basis-fixture',
  type: 'constraint',
  title: 'Golden checksum basis fixture',
  status: 'active',
  severity: 'hard',
  always: true,
  continuity: true,
  summary: 'A fixed sentence a golden checksum test pins forever.',
  summaryOf: 'deadbeefdeadbeef',
  summaryWas: [{ at: '2026-01-01', text: 'An earlier fixed sentence.' }],
  acknowledged: { some_finding_code: 'cafebabecafebabe' },
  scope: ['src/db/**'],
  tags: ['golden', 'fixture'],
  origin: 'human',
  sourceFile: null,
  sourceAnchor: null,
  sourceChecksum: null,
  validFrom: null,
  validUntil: null,
  checksum: '',
  extra: { kind: 'functional' },
  body: 'Fixed prose the golden checksum test hashes.',
  steps: [
    { text: 'Step one.', checked: false },
    { text: 'Step two.', checked: true },
  ],
  observations: [
    { category: 'limit', text: 'Fixed observation text.', tags: ['golden'], context: 'fixed context' },
  ],
  relations: [{ type: 'derived_from', target: 'ADR-golden-fixture' }],
  layer: 'project',
  filePath: 'items/constraint/CONST-golden-basis-fixture.md',
};

/**
 * The recorded golden value for `CHECKSUM_BASIS_VERSION === 1`, computed once
 * against `FIXTURE` above and pinned here. `formatChecksum(1, ...)` emits no
 * visible version tag (see that function's doc comment in item.ts), so this
 * is a bare hash rather than a `"1:..."`-prefixed string — exactly what every
 * item in every corpus captured under basis version 1 already carries.
 */
const GOLDEN_CHECKSUM_V1 = 'ee5407587ec23eee';

test(
  'the checksum basis is pinned: THE basis version changed, so this failed on purpose',
  () => {
    const actual = computeItemChecksum(FIXTURE);
    assert.equal(
      actual, GOLDEN_CHECKSUM_V1,
      `computeItemChecksum's basis has changed: it now hashes CHECKSUM_BASIS_VERSION ` +
      `${CHECKSUM_BASIS_VERSION}'s fixed fixture to "${actual}" instead of the recorded golden ` +
      `value "${GOLDEN_CHECKSUM_V1}". This is not a bug in the fixture or the test — it means the ` +
      `formula computeItemChecksum() runs over (item.ts) really did change. Do exactly this, in ` +
      `order: (1) bump CHECKSUM_BASIS_VERSION in src/core/item.ts to the next integer: (2) update ` +
      `GOLDEN_CHECKSUM_V1 above (rename it to match the new version) to "${actual}", the value this ` +
      `run just computed; (3) run \`mycontext repair\` against every real corpus this change ships ` +
      `to, to re-stamp its items in the new format. Skipping step (3) does not merely leave a few ` +
      `items stale — it SILENTLY invalidates every recorded checksum in every corpus in the world ` +
      `still on the old basis, exactly the incident this versioning scheme exists to make impossible ` +
      `to repeat: 719 of 736 items in one real corpus once went stale while sitting completely still, ` +
      `each one wrongly reporting that its own text may have been lost.`,
    );
  },
);

test('CHECKSUM_BASIS_VERSION is the version this golden value was recorded for', () => {
  // If this fails while the test above passes, the two have drifted apart —
  // fix this assertion's expected number to match GOLDEN_CHECKSUM_V1's own
  // name/comment, or re-derive GOLDEN_CHECKSUM_V1 as the failure message on
  // the test above explains.
  assert.equal(CHECKSUM_BASIS_VERSION, 1);
});

// ── classifying a mismatch: migration vs. the real alarm ────────────────────

test('a same-version disagreement classifies as an alteration (the real alarm)', () => {
  // FIXTURE's own recorded checksum ('') never matches its computed one, and
  // '' parses as version 1 (no "N:" prefix) — the same version this build
  // computes — so this is the "content actually changed" branch.
  assert.equal(classifyChecksumMismatch(FIXTURE.checksum), 'alteration');
  assert.equal(classifyChecksumMismatch('deadbeefdeadbeef'), 'alteration');
});

test('a different-version disagreement classifies as a migration', () => {
  assert.equal(classifyChecksumMismatch(formatChecksum(2, 'deadbeefdeadbeef')), 'migration');
  assert.equal(classifyChecksumMismatch(formatChecksum(99, 'deadbeefdeadbeef')), 'migration');
});

test('parseChecksumVersion + classifyChecksumMismatch agree on which version a recorded value carries', () => {
  const recorded = formatChecksum(3, 'cafebabecafebabe');
  assert.equal(parseChecksumVersion(recorded).version, 3);
  assert.notEqual(parseChecksumVersion(recorded).version, CHECKSUM_BASIS_VERSION);
  assert.equal(classifyChecksumMismatch(recorded), 'migration');
});
