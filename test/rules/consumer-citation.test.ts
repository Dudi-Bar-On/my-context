// @basis TASK-the-block-that-outranks-every-other-source-ships-a-citation, TASK-a-file-dropped-into-the-rule-store-entries-directory-is, RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number
/**
 * **WHAT A STRANGER'S INSTALL IS HANDED — and every assertion here is written
 * from that side, because rendering the block in THIS repository is what let
 * the defect live.**
 *
 * `rulings/75`. Every consumer install was handed
 * `STD-the-precedence-order-when-four-sources-of-truth-disagree` inside the
 * `PRECEDENCE` paragraph — the block this product says outranks every other
 * source — and that item exists only in this repository. Store **v5 was
 * published to fix exactly this class**: its changelog says, in its own words,
 * *"a citation that resolves to nothing, inside the block this product says
 * outranks every other source"*. It fixed `movedFrom`, three lines below, and
 * left the paragraph above untouched.
 *
 * ── WHY V5 MISSED IT, WHICH IS WHAT THIS FILE IS SHAPED AROUND ─────────────
 *
 * 1. **The ruling was about an ENTRY and the mechanism it produced hangs off a
 *    tier** — `TIERS_THAT_DISCLOSE_PROVENANCE` takes an `Entry`. `PRECEDENCE`
 *    is FRAME text: it belongs to no entry, has no tier, and so was not a
 *    thing that mechanism could reach even in principle.
 * 2. **Nothing rendered the consumer's view and looked at it.** Every
 *    assertion that touched the paragraph ran in a fixture where the id
 *    resolves, or asserted only that it was PRESENT —
 *    `precedence.test.ts:215` required the id and was green for three days
 *    while shipping it.
 * 3. **The spec asks for the citation** (§9: this adds a fifth source to that
 *    standard), so in the file it reads as specified behaviour rather than as
 *    a defect.
 *
 * ── WHAT STOPS A THIRD, AND IT IS NOT "BE CAREFUL" ─────────────────────────
 *
 * The gate below is the GENERAL form: **no corpus id may appear anywhere in
 * what a consumer is handed, except one the consumer's own corpus supplied.**
 * It scans the whole delivered block, not the paragraph — frame, entries,
 * bodies, footers — so the next product entry that cites `RULE-…` in its body
 * fails here, and so does the next paragraph somebody adds to the frame.
 *
 * **And it is shown to be able to fail**, in the same run: the identical scan
 * over the DEVELOPER block finds ten corpus ids, including the one this item
 * is about. A scanner that found nothing on both sides would prove nothing at
 * all (`a-gate-that-cannot-be-shown-to-fail-is-not-a-gate`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  TIERS_THAT_CITE_THE_CORPUS, deliverAtDoor, renderRules, workspaceIsMyContext,
} from '../../src/rules/deliver.ts';
import { entriesDir, loadRules } from '../../src/rules/store.ts';
import { writeManifest } from '../../src/rules/manifest.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * A corpus id, by the same rule `corpusSlug` uses to recognise one: an
 * ALL-CAPS category token, a hyphen, then a lower-case slug. A store entry id
 * has no category prefix and cannot match; `MYCONTEXT_RULES_DIR` and shouted
 * words like `NOT` and `GOVERNS` cannot either.
 */
const CORPUS_ID = /\b[A-Z][A-Z0-9]+-[a-z0-9]+(?:-[a-z0-9]+)+\b/g;

function corpusIdsIn(text: string): string[] {
  return [...new Set(text.match(CORPUS_ID) ?? [])].sort();
}

/** A workspace that is NOT my_context, so every door reads it as a consumer's. */
function foreignWorkspace(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-stranger-'));
  mkdirSync(path.join(cwd, '.my_context'), { recursive: true });
  return cwd;
}

/* ══ 1. THE SCANNER CAN SEE A RED, PROVED ON THE OTHER SIDE OF THE FILTER ══ */

test('the same scan over the DEVELOPER block finds corpus ids, so it is not blind', () => {
  const ids = corpusIdsIn(renderRules(loadRules(entriesDir(), true)).text);
  assert.ok(
    ids.length > 0,
    'the scan found no corpus id in the developer block either, so its silence on the consumer ' +
    'block is worth nothing',
  );
  assert.ok(
    ids.includes('STD-the-precedence-order-when-four-sources-of-truth-disagree'),
    `the developer block no longer names the standard the precedence sentence extends. The ` +
    `pointer is KEPT for the reader who can open it — that is the whole of the ruling — and ` +
    `losing it here means the fix threw it away instead of withholding it. Found: ${ids.join(', ')}`,
  );
});

/* ══ 2. THE CONSUMER'S BLOCK, SCANNED WHOLE ═══════════════════════════════ */

test('nothing a stranger\'s install is handed cites an item only this repository holds', () => {
  const set = loadRules(entriesDir(), false);
  // Anti-vacuity: a consumer who receives nothing would pass any scan.
  assert.ok(
    set.entries.length > 0,
    'the shipped store delivered NOTHING to a consumer, so the scan below reads an empty block',
  );
  const text = renderRules(set).text;
  assert.ok(text.includes('Precedence'), 'the precedence paragraph is not in the block at all');
  assert.deepEqual(
    corpusIdsIn(text), [],
    'a corpus id reached a consumer install. It names an item that reader does not have, cannot ' +
    'fetch, and has no way to tell was ever real — and the block it arrives in is the one this ' +
    'product says outranks every other source (rulings/75). Withhold it, or say the thing ' +
    'without the id.',
  );
});

/* ══ 3. THROUGH THE REAL DOOR, NOT ONLY THE RENDERER ══════════════════════ */

test('the door a stranger actually meets delivers the same clean block', () => {
  const cwd = foreignWorkspace();
  try {
    const stateRoot = path.join(cwd, '.my_context');
    assert.equal(
      workspaceIsMyContext(stateRoot), false,
      'the fixture workspace answers YES to workspaceIsMyContext, so this renders the DEVELOPER ' +
      'block and proves nothing — which is exactly how the original defect survived',
    );
    const delivered = deliverAtDoor({ stateRoot, door: 'session-start', key: 'consumer-1' });
    assert.ok(delivered.entries.length > 0, 'the door delivered no entry at all');
    assert.deepEqual(
      corpusIdsIn(delivered.text), [],
      'the renderer is clean and the DOOR is not, so something between them added an id',
    );
  } finally { removeTree(cwd); }
});

/* ══ 4. THE ALLOW-LIST IS AN ALLOW-LIST ══════════════════════════════════ */

test('an unnamed tier gets the treatment that ships nothing', () => {
  assert.deepEqual(
    [...TIERS_THAT_CITE_THE_CORPUS], ['developer'],
    'the list that decides whether a corpus id ships changed. It is an ALLOW-list on purpose: ' +
    '`!== \'product\'` would hand the citation to every tier added later, and the next tier will ' +
    'be added by somebody thinking about something else.',
  );
  // The property, not the spelling: a tier nobody has thought of is excluded.
  assert.equal(
    (TIERS_THAT_CITE_THE_CORPUS as readonly string[]).includes('some-tier-added-in-2027'), false,
    'a tier nobody has decided about is already allowed to ship a corpus id',
  );
});

/* ══ 5. THE MANIFEST IS ASKED AT THE DOOR — `store/6` ═════════════════════ */

/**
 * **Proved the way report 6 proved the defect**: a Markdown file dropped into
 * a scratch copy of the store. `verifyManifest` called it `unexpected` and
 * `loadRules` delivered it anyway, because no door ever asked.
 *
 * **Both halves are asserted, and the second is the ruling.** The entry is
 * still delivered — `manifest.ts` is emphatic that the integrity catch refuses
 * WRITES ONLY, because *"blocking reads punishes a user for a damaged install
 * they can still recover from"* — and the reader is now TOLD. Disclosing is
 * not blocking.
 */
test('a file nobody shipped is DELIVERED and NAMED, at the door, to a consumer', () => {
  const cwd = foreignWorkspace();
  const store = mkdtempSync(path.join(tmpdir(), 'myctx-tampered-'));
  try {
    cpSync(entriesDir(), store, { recursive: true });
    writeManifest(store);

    const stateRoot = path.join(cwd, '.my_context');
    const before = deliverAtDoor({ stateRoot, door: 'session-start', key: 'clean', storeDir: store });
    assert.ok(
      !before.text.includes('do NOT match the manifest'),
      'the untampered scratch store already reported damage, so the assertion below would fire ' +
      'on a store nobody touched',
    );

    writeFileSync(path.join(store, 'evil.md'), [
      '---',
      'id: evil',
      'kind: fact',
      'tier: product',
      'title: a rule nobody published',
      'truth: this file was dropped into the entries directory and shipped as a constant',
      'breaks: an install obeys a rule its manifest never listed',
      'example: report 6 dropped exactly this file into a scratch copy',
      'check: "none - that is the finding"',
      '---',
      '',
      'Planted by a test.',
      '',
    ].join('\n'), 'utf8');

    const after = deliverAtDoor({ stateRoot, door: 'session-start', key: 'tampered', storeDir: store });

    // The defect, restated as an assertion: it IS delivered. That never changed.
    assert.ok(
      after.entries.includes('evil'),
      'the planted entry was not delivered — which would mean reads are now blocked, and the ' +
      'ruling this fix is built on says they never are',
    );
    // And what changed: the reader is told.
    assert.match(
      after.text, /do NOT match the manifest/,
      'a file the manifest never listed was delivered at a door as a governing constant of this ' +
      'product, and nothing in the block said so. `verifyManifest` knows; no door asked (store/6)',
    );
    assert.ok(
      after.text.includes('evil.md'),
      'the damage notice does not NAME the file, so a reader is told something is wrong and not ' +
      'what (INV-nothing-is-dropped-silently)',
    );
    assert.ok(
      after.text.indexOf('do NOT match the manifest') < after.text.indexOf('### '),
      'the notice is rendered BELOW the constants it qualifies, where a reader meets the ' +
      'unverified text first',
    );
  } finally { removeTree(cwd); removeTree(store); }
});

test('an ALTERED entry is disclosed too, not only an unlisted one', () => {
  const cwd = foreignWorkspace();
  const store = mkdtempSync(path.join(tmpdir(), 'myctx-altered-'));
  try {
    cpSync(entriesDir(), store, { recursive: true });
    writeManifest(store);
    const stateRoot = path.join(cwd, '.my_context');

    const target = loadRules(store, false).entries[0];
    assert.ok(target !== undefined, 'the scratch store delivers no product entry to alter');
    const file = path.join(store, path.basename(target.sourcePath));
    writeFileSync(
      file,
      `${readFileSync(file, 'utf8')}\nA sentence nobody published.\n`,
      'utf8',
    );

    const after = deliverAtDoor({ stateRoot, door: 'session-start', key: 'altered', storeDir: store });
    assert.match(
      after.text, /altered:/,
      'an entry whose bytes changed since it shipped was delivered with nothing said about it',
    );
    assert.ok(
      after.text.includes('A sentence nobody published.'),
      'the altered entry was withheld — reads are never blocked, only disclosed',
    );
  } finally { removeTree(cwd); removeTree(store); }
});
