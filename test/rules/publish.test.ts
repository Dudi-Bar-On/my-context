// @basis TASK-the-maintenance-tool-crud-where-the-form-is-the-template-and
/**
 * **PUBLISHING SHOWS A DIFF AND ASKS, BECAUSE IT IS OUTWARD-FACING AND HARD TO
 * REVERSE.**
 *
 * D41 spec §12.2, `plan:store seq:3` Task 12:
 *
 * > *Shows a diff of what changes, and asks before it goes. Regenerates the
 * > integrity manifest (§13). Refuses when the production tier is over budget
 * > (§10).*
 *
 * The budget refusal is asserted next door in `budget.test.ts`, beside the
 * never-refuse it must not become. What is asserted here is the other three:
 * the diff, the question, and the two things that move when the answer is yes.
 *
 * ── WHY "DOES NOTHING UNTIL CONFIRMED" IS ASSERTED ON BYTES ────────────────
 *
 * An unconfirmed publish returning `ok: false` proves only that the FUNCTION
 * declined. What matters is that nothing on disk moved — so the manifest is
 * read before and after and compared byte for byte, which is the same shape
 * `test/ui/server-e2e.test.ts` uses to hold the read surface to zero writes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  MANIFEST_FILE, planPublish, publishStore, readManifest, verifyManifest, writeManifest,
} from '../../src/rules/manifest.ts';
import { entriesDir } from '../../src/rules/store.ts';
import { saveFromForm } from '../../src/ui/maintenance/screens/form.ts';
import { removeTree } from '../helpers/tmp.ts';

/** A store copy whose manifest describes it exactly — i.e. nothing unpublished. */
function withStore(fn: (dir: string) => void): void {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-publish-'));
  cpSync(entriesDir(), dir, { recursive: true });
  writeManifest(dir);
  try { fn(dir); } finally { removeTree(dir); }
}

/** One new entry, written the way the maintenance tool writes one. */
function addProbe(dir: string, id = 'probe-published-fact'): void {
  const answer = saveFromForm(dir, {
    id,
    kind: 'fact',
    tier: 'developer',
    title: 'a probe fact written by the publish test',
    truth: 'the publish step compares what is on disk against what was last published',
    breaks: 'nothing — this entry is a fixture',
    example: 'written by test/rules/publish.test.ts',
    check: 'none - a fixture has nothing to measure',
    body: 'A body, so the file is more than frontmatter.',
  });
  assert.equal(answer.ok, true, `the probe entry would not save: ${JSON.stringify(answer)}`);
}

const manifestBytes = (dir: string): string =>
  readFileSync(path.join(dir, MANIFEST_FILE), 'utf8');

/* ══ 1. A DIFF, AND NOTHING HAPPENS UNTIL IT IS CONFIRMED ══════════════════ */

test('publish shows what would change before anything changes', () => {
  withStore((dir) => {
    assert.deepEqual(
      planPublish(dir).changes, [],
      'a store with nothing unpublished reported changes, so the diff below means nothing',
    );
    addProbe(dir);
    const plan = planPublish(dir);
    assert.deepEqual(
      plan.changes.map((c) => [c.how, c.id]),
      [['added', 'probe-published-fact']],
      'the diff did not name the one entry that was added',
    );
  });
});

test('an unconfirmed publish changes not one byte on disk', () => {
  withStore((dir) => {
    addProbe(dir);
    const before = manifestBytes(dir);
    const answer = publishStore(dir, { confirm: false });

    assert.equal(answer.ok, false, 'publishing went ahead without being confirmed');
    assert.equal(
      manifestBytes(dir), before,
      'the manifest moved on an unconfirmed publish. "Asks before it goes" is about the store, ' +
      'not about the return value (spec §12.2).',
    );
  });
});

/* ══ 2. A CONFIRMED PUBLISH REGENERATES THE MANIFEST ═══════════════════════ */

test('publishing regenerates the manifest, and the new entry is in it', () => {
  withStore((dir) => {
    addProbe(dir);
    const answer = publishStore(dir, { confirm: true });
    assert.equal(answer.ok, true, `publishing failed: ${JSON.stringify(answer)}`);

    const rows = readManifest(dir).entries;
    const row = rows.find((e) => e.id === 'probe-published-fact');
    assert.ok(row !== undefined, 'the published manifest does not list the entry that was added');
    assert.equal(
      row.checksum,
      // The checksum a fresh regeneration of the same directory produces.
      (() => {
        const scratch = mkdtempSync(path.join(tmpdir(), 'myctx-publish-ref-'));
        try {
          cpSync(dir, scratch, { recursive: true });
          return writeManifest(scratch).entries.find((e) => e.id === 'probe-published-fact')?.checksum;
        } finally { removeTree(scratch); }
      })(),
      'the published checksum is not the checksum of what is on disk',
    );
    assert.deepEqual(
      verifyManifest(dir), { ok: true },
      'the store does not verify against the manifest publishing just wrote',
    );
    assert.deepEqual(
      planPublish(dir).changes, [],
      'the same change is still pending after it was published, so publishing did not consume it',
    );
  });
});

test('a removed entry is a change publishing reports and then records', () => {
  withStore((dir) => {
    addProbe(dir);
    assert.equal(publishStore(dir, { confirm: true }).ok, true);

    // Removal, as a person would do it: the file goes.
    const file = path.join(dir, 'probe-published-fact.md');
    removeTree(file);
    const plan = planPublish(dir);
    assert.deepEqual(
      plan.changes.map((c) => [c.how, c.id]),
      [['removed', 'probe-published-fact']],
      'deleting an entry produced no `removed` change',
    );
    assert.equal(publishStore(dir, { confirm: true }).ok, true);
    assert.equal(
      readManifest(dir).entries.some((e) => e.id === 'probe-published-fact'), false,
      'the regenerated manifest still lists an entry that is not there',
    );
  });
});

/* ══ 3. THE STORE'S OWN VERSION AND CHANGELOG MOVE ═════════════════════════ */

/**
 * Spec §12.1: the store is versioned independently of the product, *"so the
 * store carries its own version and its own changelog, and a store update is
 * an artifact a user's install can take on its own."*
 */
test('a publish moves the store version and writes a changelog row naming the change', () => {
  withStore((dir) => {
    const before = readManifest(dir).store?.version ?? 0;
    addProbe(dir);
    assert.equal(publishStore(dir, { confirm: true, note: 'the probe entry' }).ok, true);

    const after = readManifest(dir).store;
    assert.ok(after !== undefined, 'the manifest carries no store metadata at all');
    assert.equal(
      after.version, before + 1,
      'the store version did not move. A version that does not move cannot tell an install ' +
      'whether it already has this store.',
    );
    const row = after.changelog[0];
    assert.ok(row !== undefined, 'no changelog row was written');
    assert.equal(row.version, after.version);
    assert.deepEqual(
      row.added, ['probe-published-fact'],
      'the changelog row does not name what was added',
    );
    assert.equal(row.note, 'the probe entry');
  });
});

test('an unconfirmed publish moves no version', () => {
  withStore((dir) => {
    addProbe(dir);
    const before = readManifest(dir).store?.version ?? 0;
    publishStore(dir, { confirm: false });
    assert.equal(
      readManifest(dir).store?.version ?? 0, before,
      'the version moved on a publish nobody confirmed',
    );
  });
});

test('publishing nothing is refused, so a version never moves for no reason', () => {
  withStore((dir) => {
    const answer = publishStore(dir, { confirm: true });
    assert.equal(
      answer.ok, false,
      'a publish with no changes was accepted, which cuts a store version an install would ' +
      'download to find it already has it',
    );
  });
});
