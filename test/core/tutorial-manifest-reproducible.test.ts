// @basis TASK-the-checked-in-tutorial-manifest-is-proved-to-be-what-the,
//         STD-documentation-is-regenerated-not-edited-to-match
/**
 * **The checked-in `docs/tutorials/manifest.json` is what the generator
 * derives** — `plan:tuts seq:9`.
 *
 * ── WHY THIS IS A SECOND FILE AND NOT A TEST IN `tutorial-manifest.test.ts` ──
 *
 * `test/core/tutorial-manifest.test.ts` globs the four surfaces INDEPENDENTLY
 * of the manifest and its header argues for exactly that independence: a stale
 * manifest must not be able to pass by agreeing with itself, so that file
 * deliberately does not import `scripts/build-tutorial-manifest.ts`.
 *
 * That argument is right and it is not this one. Independence FROM the
 * generator is not a proof that the generator still PRODUCES the file, and the
 * difference cost two days: `handover.ts` and `handover.md` arrived in the
 * checked-in roster in `bd249ec` (2026-09-06) WITHOUT arriving in the
 * generator's `CLUSTERS` table. The coverage tests passed on both — the
 * manifest claimed them, so the claim was satisfied. The only surface that
 * disagreed was `npm run gen:tutorials`, which threw on four names, and a
 * generator nobody runs reports nothing.
 *
 * So this file is DELIBERATELY THE COUPLED HALF. It imports the generator on
 * purpose, and its whole subject is reproducibility. The uncoupled coverage
 * tests stay uncoupled beside it; neither file can do the other's job.
 *
 * ── WHAT IS BEING DEFENDED, AND THE DIRECTION THAT COSTS ────────────────────
 *
 * `STD-documentation-is-regenerated-not-edited-to-match` is the standing rule
 * for this file. The failure it forbids is silent in the expensive direction: a
 * roster hand-edited to claim a surface no tutorial teaches is a FALSE COVERAGE
 * CLAIM, and the roster exists to prevent precisely that. A hand-edit that
 * REMOVES a claim is caught by the coverage tests next door; a hand-edit that
 * ADDS one is caught by nothing until this file.
 *
 * ── AND `deriveTutorialManifest` VALIDATES BEFORE IT RETURNS ────────────────
 *
 * It calls `validateCoverage` first, so a tree where `npm run gen:tutorials`
 * cannot run at all fails here by THROWING rather than by comparing unequal.
 * That is the same defect this item was filed for, reported at its own door.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { deriveTutorialManifest } from '../../scripts/build-tutorial-manifest.ts';
import { loadTutorialManifest, TUTORIAL_MANIFEST_PATH } from '../../src/core/tutorial-manifest.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

test('the checked-in roster is what the generator derives, entry for entry', () => {
  // Structural, not a string compare: this is the claim that the ROSTER — every
  // id, tier, and the four surface lists on each entry — is reproducible. The
  // byte-level claim is the test below, and they fail for different reasons.
  const derived = deriveTutorialManifest(REPO_ROOT);
  const checkedIn = loadTutorialManifest(REPO_ROOT);
  assert.deepEqual(
    checkedIn,
    derived,
    `${TUTORIAL_MANIFEST_PATH} is not what \`npm run gen:tutorials\` produces. The roster is `
    + 'GENERATED, never hand-edited: correct `CLUSTERS` in `scripts/build-tutorial-manifest.ts` '
    + 'and regenerate, rather than editing the manifest to agree.',
  );
});

test('the file on disk is byte-for-byte what the generator would write', () => {
  // Deep-equal normalises away everything the writer actually chose: key order,
  // the two-space indent, the trailing newline. A manifest reordered or
  // reformatted by hand is still a hand-edited manifest, and re-running the
  // generator would produce a diff nobody asked for — which is how a reader
  // learns to distrust `git status` on a generated file.
  const derived = deriveTutorialManifest(REPO_ROOT);
  const onDisk = readFileSync(path.join(REPO_ROOT, TUTORIAL_MANIFEST_PATH), 'utf8');
  assert.equal(
    onDisk,
    JSON.stringify(derived, null, 2) + '\n',
    `${TUTORIAL_MANIFEST_PATH} differs from the generator's own output byte for byte — `
    + 'run `npm run gen:tutorials` and commit what it writes.',
  );
});
