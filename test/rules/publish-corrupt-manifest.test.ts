// @basis TASK-a-corrupt-manifest-makes-the-next-publish-erase-the-store, INV-nothing-is-dropped-silently, TASK-release-phase-4-silent-failures-and-disclosures
/**
 * **A CORRUPT MANIFEST MUST STOP THE NEXT PUBLISH, NOT BE OVERWRITTEN BY IT.**
 *
 * `TASK-a-corrupt-manifest-makes-the-next-publish-erase-the-store`, recovering
 * a finding report 3 of the silent-failures review raised in prose and never
 * turned into a row:
 *
 * > *`src/rules/manifest.ts:165, 550, 626` would erase the store changelog on
 * > the next publish after a corrupt manifest.*
 *
 * ── WHY THE ERASURE IS INVISIBLE WITHOUT THIS FILE ────────────────────────
 *
 * Every read of the manifest on the publish path was wrapped in a `catch` that
 * answered **"then there is no manifest"**: `planPublish` diffed against an
 * empty `entries` list, so all sixteen entries read as `added`; `publishStore`
 * read `{ version: 0, changelog: [] }` as the previous state, so the store went
 * back to version 1 carrying one changelog row. Five published versions of
 * history were replaced with a guess, and the run reported `ok: true`.
 *
 * That catch is right for exactly one case — **there is no manifest file** —
 * and wrong for every other, which is the distinction the fix draws:
 * `readManifestIfPresent` answers `null` for absent and throws
 * `ManifestUnreadableError` for present-and-unreadable.
 *
 * ── WHAT COUNTS AS CORRUPT, ASSERTED FOUR WAYS ────────────────────────────
 *
 * 1. bytes that are not JSON at all;
 * 2. JSON with the entry list missing — the field the reader cannot do without;
 * 3. JSON whose `store` block is present and malformed, which is the one that
 *    erased silently rather than throwing: `[row, ...'oops']` spreads a string
 *    into characters and writes them as the changelog;
 * 4. a manifest whose checksums cannot be compared with the entries at all,
 *    because it declares a digest this reader does not compute. Nothing is
 *    unreadable there — every row simply reads as `changed`, and the publish
 *    would cut a version claiming sixteen edits nobody made.
 *
 * Each is asserted on the manifest's BYTES before and after, because a function
 * that returns `ok: false` has proved only that it declined — the same shape
 * `test/rules/publish.test.ts` uses for the unconfirmed publish.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  MANIFEST_FILE, planPublish, publishStore, readManifest, writeManifest,
} from '../../src/rules/manifest.ts';
import { entriesDir } from '../../src/rules/store.ts';
import { saveFromForm } from '../../src/ui/maintenance/screens/form.ts';
import { removeTree } from '../helpers/tmp.ts';

const manifestBytes = (dir: string): string =>
  readFileSync(path.join(dir, MANIFEST_FILE), 'utf8');

/**
 * A store copy that carries the shipped store's real history — five published
 * versions — plus one unpublished entry, so a publish has something to do and
 * something to lose.
 */
function withHistory(fn: (dir: string) => void): void {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-corrupt-manifest-'));
  cpSync(entriesDir(), dir, { recursive: true });
  writeManifest(dir);
  const before = readManifest(dir).store;
  assert.ok(
    before !== undefined && before.changelog.length > 1,
    'the fixture store carries no changelog worth losing, so nothing below measures an erasure',
  );
  const answer = saveFromForm(dir, {
    id: 'probe-corrupt-manifest-fact',
    kind: 'fact',
    tier: 'developer',
    title: 'a probe fact written by the corrupt-manifest test',
    truth: 'a publish that cannot read the manifest refuses before it writes anything',
    breaks: 'nothing — this entry is a fixture',
    example: 'written by test/rules/publish-corrupt-manifest.test.ts',
    check: 'none - a fixture has nothing to measure',
    body: 'A body, so the file is more than frontmatter.',
  });
  assert.equal(answer.ok, true, `the probe entry would not save: ${JSON.stringify(answer)}`);
  try { fn(dir); } finally { removeTree(dir); }
}

/** Plant `text` as the manifest and return exactly the bytes planted. */
function corrupt(dir: string, text: string): string {
  writeFileSync(path.join(dir, MANIFEST_FILE), text, 'utf8');
  return text;
}

/**
 * The whole assertion, made once per shape: the plan refuses and names the
 * file, the publish declines, and the manifest is byte-for-byte what was
 * planted.
 */
function assertRefusesAndWritesNothing(dir: string, planted: string, shape: string): string {
  const plan = planPublish(dir);
  assert.ok(
    plan.refusal !== null,
    `${shape}: planPublish offered to publish over a manifest nothing could read`,
  );
  assert.ok(
    plan.refusal.includes(MANIFEST_FILE),
    `${shape}: the refusal never names the file that is wrong — ${plan.refusal}`,
  );
  const answer = publishStore(dir, { confirm: true, note: 'over a corrupt manifest' });
  assert.equal(answer.ok, false, `${shape}: publishStore went ahead over a corrupt manifest`);
  assert.equal(
    manifestBytes(dir), planted,
    `${shape}: the publish rewrote the manifest it had just refused to read`,
  );
  return plan.refusal;
}

/* ══ 1. BYTES THAT ARE NOT JSON ════════════════════════════════════════════ */

test('a publish over a manifest that is not JSON refuses and leaves it byte-identical', () => {
  withHistory((dir) => {
    const planted = corrupt(dir, '{ this is not json');
    const refusal = assertRefusesAndWritesNothing(dir, planted, 'unparseable JSON');
    assert.match(
      refusal, /could not be read/,
      `the refusal does not say the manifest could not be read — ${refusal}`,
    );
  });
});

/* ══ 2. JSON WITH THE ENTRY LIST MISSING ═══════════════════════════════════ */

test('a publish over a manifest with no entry list refuses and leaves it byte-identical', () => {
  withHistory((dir) => {
    const store = readManifest(dir).store;
    const planted = corrupt(dir, `${JSON.stringify(
      { version: 1, algorithm: 'sha256', store }, null, 2,
    )}\n`);
    assertRefusesAndWritesNothing(dir, planted, 'no entry list');
  });
});

/* ══ 3. A MALFORMED `store` BLOCK — THE ONE THAT ERASED WITHOUT THROWING ═══ */

test('a publish over a manifest whose changelog is not a list refuses rather than spreading it', () => {
  withHistory((dir) => {
    const manifest = readManifest(dir) as unknown as { store: Record<string, unknown> };
    manifest.store.changelog = 'oops';
    const planted = corrupt(dir, `${JSON.stringify(manifest, null, 2)}\n`);
    assertRefusesAndWritesNothing(dir, planted, 'changelog is not a list');
  });
});

/* ══ 4. CHECKSUMS THAT CANNOT BE COMPARED WITH THE ENTRIES ═════════════════ */

test('a publish over a manifest sealed with a digest this reader does not compute refuses', () => {
  withHistory((dir) => {
    const manifest = readManifest(dir);
    manifest.algorithm = 'sha1';
    for (const row of manifest.entries) {
      if (row.checksum !== undefined) row.checksum = row.checksum.slice(0, 40);
    }
    const planted = corrupt(dir, `${JSON.stringify(manifest, null, 2)}\n`);
    const refusal = assertRefusesAndWritesNothing(dir, planted, 'foreign digest');
    assert.match(
      refusal, /sha1/,
      `the refusal does not name the digest the manifest declares — ${refusal}`,
    );
  });
});

/* ══ 5. THE CONTROL — AN INTACT MANIFEST STILL PUBLISHES, HISTORY AND ALL ══ */

test('an intact manifest still publishes, and the changelog it had is carried forward', () => {
  withHistory((dir) => {
    const before = readManifest(dir).store;
    assert.ok(before !== undefined, 'the fixture lost its store block before the control ran');
    assert.equal(planPublish(dir).refusal, null, 'an intact manifest was refused');
    const answer = publishStore(dir, { confirm: true, note: 'the probe entry' });
    assert.equal(answer.ok, true, `an intact store would not publish: ${JSON.stringify(answer)}`);
    const after = readManifest(dir).store;
    assert.ok(after !== undefined, 'the publish dropped the store block');
    assert.equal(after.version, before.version + 1, 'the store version did not advance by one');
    assert.equal(
      after.changelog.length, before.changelog.length + 1,
      'the changelog did not grow by exactly the one row this publish cut',
    );
    assert.deepEqual(
      after.changelog.slice(1), before.changelog,
      'the history under the new row is not the history that was there',
    );
  });
});

/* ══ 6. AND A MISSING MANIFEST IS STILL THE FIRST PUBLISH, NOT A REFUSAL ═══ */

test('a store with no manifest at all is a first publish, not a corrupt one', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-no-manifest-'));
  try {
    cpSync(entriesDir(), dir, { recursive: true });
    writeFileSync(path.join(dir, 'unrelated.txt'), 'not an entry', 'utf8');
    rmSync(path.join(dir, MANIFEST_FILE));
    const plan = planPublish(dir);
    assert.equal(
      plan.refusal, null,
      `a directory with no manifest was refused as corrupt — ${plan.refusal}`,
    );
    assert.equal(plan.fromVersion, 0, 'a store with no manifest reported a published version');
    assert.ok(plan.changes.length > 0, 'a first publish found nothing to publish');
  } finally { removeTree(dir); }
});
