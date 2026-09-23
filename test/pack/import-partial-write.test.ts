// @basis TASK-a-pack-import-can-throw-after-overwriting-config-and, INV-nothing-is-dropped-silently, STD-error-message-conventions, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * The half-applied import: what happens when an item the pack carries cannot
 * be written, and the failure is discovered AFTER `config.json` has been
 * overwritten and an arbitrary prefix of the pack has already landed.
 *
 * Four properties, none of which can be read off the module:
 *
 *  1. **A pack this workspace cannot create in full is refused by the PLAN.**
 *     `createItem` refuses an `extra` key the item's own category does not
 *     declare (`unknownExtraFieldError`, core/trust.ts), and that refusal used
 *     to arrive from inside `applyImport`'s create loop — after the merged
 *     config had been written and after every earlier item had been created.
 *     The fixture puts the offending field on the THIRD item on purpose: a
 *     pre-flight that only checked the first one would pass it.
 *  2. **Nothing is written by that refusal.** Asserted by comparing the whole
 *     workspace tree byte for byte before and after — `config.json` included,
 *     which is the file the old order changed first and the one a reader would
 *     never think to check after a message saying nothing was imported.
 *  3. **An approved overwrite gets the same pre-flight, and gets it before the
 *     config write.** `planImport` cannot do this one: it is never told the
 *     approval, and refusing an overwrite nobody approved would refuse an
 *     import that was about to succeed. So it happens at the top of
 *     `applyImport`, which is the first place the approval exists.
 *  4. **When a write DOES fail after the config write, the refusal says what
 *     was written and what was not, and the wreckage is reachable.** The
 *     `scopePolicy: "required"` fixture is a failure the pre-flight cannot
 *     see from the plan alone, so it exercises the tail: `config.json` is
 *     whole (the merged document, never a partial file), the ids that landed
 *     are named, the ids that did not are named, and an import record is filed
 *     so `pack list` names the pack and `review promote --all --pack` can
 *     reach the drafts that DID land.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { computeItemChecksum, renderItem } from '../../src/core/item.ts';
import { createItem } from '../../src/core/mutate.ts';
import type { Item } from '../../src/core/types.ts';
import { applyImport, planImport } from '../../src/pack/import.ts';
import { writeBundleDirectory } from '../../src/pack/dir-writer.ts';
import { readImportRecords } from '../../src/pack/imported-audit.ts';
import {
  comparePaths, CONFIG_NAME, HISTORY_NAME, MANIFEST_NAME, type ExportFile,
} from '../../src/pack/layout.ts';
import { buildManifest, renderManifest, type ManifestMeta } from '../../src/pack/manifest.ts';
import { readArtefact } from '../../src/pack/reader.ts';
import { removeTree } from '../helpers/tmp.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';

const PACK_NAME = 'acme-security';
const PACK_VERSION = '2026-08 rev 3';
const FIXED_NOW = Date.parse('2026-08-20T09:12:44.031Z');

const boxes: Sandbox[] = [];
const scratch: string[] = [];

test.after(() => {
  for (const box of boxes) box.dispose();
  for (const dir of scratch) removeTree(dir);
});

function workspace(rawConfig?: Record<string, unknown>): Sandbox {
  const box = sandbox(rawConfig);
  boxes.push(box);
  return box;
}

function scratchDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-imp-part-'));
  scratch.push(dir);
  return dir;
}

// ---------------------------------------------------------------------------
// A stranger's artefact
// ---------------------------------------------------------------------------

function item(over: Partial<Item> = {}): Item {
  const base: Item = {
    id: 'RULE-a',
    type: 'rule',
    title: 'A rule',
    status: 'active',
    severity: 'soft',
    always: false,
    continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {},
    scope: [],
    tags: [],
    origin: 'human',
    sourceFile: null,
    sourceAnchor: null,
    sourceChecksum: null,
    validFrom: '2026-01-02',
    validUntil: null,
    checksum: '',
    extra: {},
    body: 'the body',
    steps: [],
    observations: [],
    relations: [],
    layer: 'project',
    filePath: 'items/rule/RULE-a.md',
    ...over,
  };
  return {
    ...base,
    filePath: over.filePath ?? `items/${base.type}/${base.id}.md`,
    checksum: computeItemChecksum(base),
  };
}

function itemFile(it: Item): ExportFile {
  return { path: it.filePath, bytes: Buffer.from(renderItem(it), 'utf8') };
}

function jsonFile(name: string, document: unknown): ExportFile {
  return { path: name, bytes: Buffer.from(`${JSON.stringify(document, null, 2)}\n`, 'utf8') };
}

function historyFile(rows: readonly unknown[]): ExportFile {
  const text = rows.map((r) => `${JSON.stringify(r)}\n`).join('');
  return { path: HISTORY_NAME, bytes: Buffer.from(text, 'utf8') };
}

const PACK_CATEGORIES = {
  rule: { enabled: true, prefix: 'RULE', scopePolicy: 'global' },
  lesson: { enabled: true, prefix: 'LESSON', scopePolicy: 'global' },
  standard: { enabled: true, prefix: 'STD', scopePolicy: 'global' },
};

const RULE_ID = 'RULE-never-log-a-token';
const LESSON_ID = 'LESSON-retry-backoff';
const STANDARD_ID = 'STD-commit-messages';

/**
 * The three items, in the order the reader hands them over — which is file
 * order, so `items/lesson/…` comes first and `items/standard/…` last. The
 * offending item in the fixtures below is therefore genuinely the LAST one,
 * with two creates ahead of it that a failing apply would already have made.
 */
function packItems(): Item[] {
  return [
    item({ id: RULE_ID, type: 'rule', title: 'Never log a token', body: 'Never log a token.' }),
    item({
      id: LESSON_ID, type: 'lesson', title: 'Retry with backoff',
      body: 'Retry with backoff.', tags: ['retry'],
    }),
    item({
      id: STANDARD_ID, type: 'standard', title: 'Commit messages',
      body: 'Write commit messages in the imperative.',
    }),
  ];
}

interface ArtefactShape {
  items?: Item[];
  categories?: Record<string, unknown>;
  history?: readonly unknown[];
  meta?: Partial<ManifestMeta>;
}

function artefact(shape: ArtefactShape = {}): string {
  const files: ExportFile[] = [
    ...(shape.items ?? packItems()).map(itemFile),
    jsonFile(CONFIG_NAME, { categories: shape.categories ?? PACK_CATEGORIES }),
    historyFile(shape.history ?? []),
  ];
  const meta: ManifestMeta = {
    kind: 'pack', name: PACK_NAME, version: PACK_VERSION, now: FIXED_NOW, ...shape.meta,
  };
  const all = [...files, { path: MANIFEST_NAME, bytes: renderManifest(buildManifest(files, meta)) }]
    .toSorted((a, b) => comparePaths(a.path, b.path));
  const dir = path.join(scratchDir(), 'pack');
  writeBundleDirectory({ files: all }, dir);
  return dir;
}

function against(box: Sandbox): {
  existing: (id: string) => Item | null; rawConfig: unknown; local: typeof box.ctx.config;
} {
  return {
    existing: (id: string): Item | null => box.ctx.store.get(id),
    rawConfig: JSON.parse(readFileSync(path.join(box.root, CONFIG_NAME), 'utf8')) as unknown,
    local: box.ctx.config,
  };
}

function plan(box: Sandbox, source: string) {
  return planImport(readArtefact(source), against(box));
}

function options(source: string, over: { overwriteApproved?: boolean } = {}) {
  return {
    name: PACK_NAME, source, origin: source, now: FIXED_NOW, overwriteApproved: false, ...over,
  };
}

/** Every file under `root`, path and bytes, so "wrote nothing" is checkable. */
function snapshotTree(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true })
      .toSorted((a, b) => comparePaths(a.name, b.name));
    for (const entry of entries) {
      const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute, relative);
      else out.push(`${relative} ${readFileSync(absolute).toString('base64')}`);
    }
  };
  walk(root, '');
  return out;
}

function configText(box: Sandbox): string {
  return readFileSync(path.join(box.root, CONFIG_NAME), 'utf8');
}

function messageOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  return assert.fail('expected a refusal, and nothing was thrown');
}

// ---------------------------------------------------------------------------
// 1 & 2. Refused before anything is written
// ---------------------------------------------------------------------------

test('an item whose category does not declare its extra field is refused by the PLAN', () => {
  // `standard` declares no extra fields at all; `directive` is declared by
  // `rule`. `createItem` refuses this, and it used to refuse it from inside
  // the apply loop, with `config.json` already overwritten and the two items
  // ahead of this one already created.
  const box = workspace();
  const source = artefact({
    items: packItems().map((it) => (it.id !== STANDARD_ID ? it
      : item({ ...it, extra: { directive: 'do' } }))),
  });

  const message = messageOf(() => plan(box, source));

  // The item, by id, and the field, by name — the two things a person needs
  // to open the right file and delete the right line.
  assert.match(message, new RegExp(STANDARD_ID), message);
  assert.match(message, /directive/, message);
  assert.match(message, /nothing was written/i, message);
});

test('the refused pack leaves the workspace byte-identical — config.json included', () => {
  const box = workspace();
  const source = artefact({
    items: packItems().map((it) => (it.id !== STANDARD_ID ? it
      : item({ ...it, extra: { directive: 'do' } }))),
  });

  const before = snapshotTree(box.root);
  const configBefore = configText(box);

  assert.throws(() => applyImport(box.ctx, plan(box, source), options(source)));

  assert.deepEqual(snapshotTree(box.root), before, 'the workspace tree moved');
  assert.equal(configText(box), configBefore, 'config.json was rewritten by a refused import');
  // Not one of the two items ahead of the offending one landed.
  assert.equal(box.ctx.store.all().length, 0);
  assert.equal(box.ctx.store.get(RULE_ID), null);
  assert.equal(box.ctx.store.get(LESSON_ID), null);
});

test('an APPROVED overwrite carrying an undeclared extra field refuses before the config write', () => {
  // `planImport` cannot catch this one — it is never told the approval — so
  // the pre-flight has to happen at the top of `applyImport`, which is the
  // first place the answer exists and still before any write.
  const box = workspace();
  createItem(box.ctx, {
    id: STANDARD_ID, type: 'standard', title: 'Commit messages',
    body: 'An older sentence about commit messages.', status: 'active', origin: 'human',
  });
  const source = artefact({
    items: packItems().map((it) => (it.id !== STANDARD_ID ? it
      : item({ ...it, extra: { directive: 'do' } , body: 'Write commit messages in the imperative.' }))),
  });
  const planned = plan(box, source);
  assert.equal(planned.buckets.changed.length, 1, 'the fixture must produce one changed entry');
  assert.equal(planned.buckets.changed[0].overwritable, true, 'and it must be overwritable');

  const configBefore = configText(box);
  const message = messageOf(() => applyImport(box.ctx, planned, options(source, {
    overwriteApproved: true,
  })));

  assert.match(message, new RegExp(STANDARD_ID), message);
  assert.match(message, /directive/, message);
  assert.equal(configText(box), configBefore, 'config.json was rewritten by a refused import');
  assert.equal(box.ctx.store.get(RULE_ID), null, 'a new item landed under a refused import');
  assert.equal(box.ctx.store.get(LESSON_ID), null, 'a new item landed under a refused import');
});

// ---------------------------------------------------------------------------
// 4. When a write DOES fail after the config write
// ---------------------------------------------------------------------------

/**
 * A pack that DEFINES a category with `scopePolicy: "required"` and carries an
 * item of it with no scope glob. `refusePackConfig` permits all of this — a
 * pack may declare a category this build has never heard of, and `scopePolicy`
 * is one of the keys it may set — and the refusal comes from `createItem`,
 * after the merged config has been written and adopted. It is the shape the
 * plan cannot pre-flight without reimplementing every rule `createItem` holds,
 * so it is the case the disclosure exists for.
 */
function unscopedArtefact(): string {
  return artefact({
    items: [
      item({ id: RULE_ID, type: 'rule', title: 'Never log a token', body: 'Never log a token.' }),
      item({
        id: LESSON_ID, type: 'lesson', title: 'Retry with backoff', body: 'Retry with backoff.',
      }),
      item({
        id: 'PLAY-run-the-drill', type: 'playbook', title: 'Run the drill',
        body: 'Run the drill quarterly.',
      }),
    ],
    categories: {
      ...PACK_CATEGORIES,
      playbook: {
        enabled: true, prefix: 'PLAY', tier: 'normative', scopePolicy: 'required',
        description: 'A rehearsed response to a named incident',
      },
    },
  });
}

test('a failure after the config write says what WAS written and what was not', () => {
  const box = workspace();
  const source = unscopedArtefact();

  const message = messageOf(() => applyImport(box.ctx, plan(box, source), options(source)));

  // It must not read as though nothing happened.
  assert.doesNotMatch(message, /nothing was imported/i, message);
  assert.match(message, /config\.json/, message);
  // The item that DID land is named, and so is the one that did not.
  assert.match(message, new RegExp(LESSON_ID), message);
  assert.match(message, new RegExp(RULE_ID), message);
  // And the reason the write failed is still in the message, not swallowed.
  assert.match(message, /scopePolicy/, message);
});

test('the config left behind is whole — the merged document, never a partial file', () => {
  const box = workspace();
  const source = unscopedArtefact();
  const planned = plan(box, source);

  assert.throws(() => applyImport(box.ctx, planned, options(source)));

  const text = configText(box);
  // Parses at all: a truncated write is the failure this is written against.
  const parsed = JSON.parse(text) as unknown;
  assert.deepEqual(parsed, planned.config.document, 'config.json is neither the old nor the new');
  assert.equal(text, `${JSON.stringify(planned.config.document, null, 2)}\n`);
  // And no temp file was left beside it.
  const stray = readdirSync(box.root).filter((n) => n.startsWith(`${CONFIG_NAME}.`));
  assert.deepEqual(stray, [], `a temp config was left behind: ${stray.join(', ')}`);
});

test('the half-applied pack is filed, so pack list names it and promote can reach the drafts', () => {
  const box = workspace();
  const source = unscopedArtefact();

  assert.throws(() => applyImport(box.ctx, plan(box, source), options(source)));

  const records = readImportRecords(box.root);
  assert.equal(records.length, 1, 'the partial import is invisible to `pack list`');
  assert.equal(records[0].pack, PACK_NAME);
  // The membership list is what `review promote --all --pack` reads, so it has
  // to name the draft that actually landed and nothing that did not.
  assert.deepEqual(records[0].items, [LESSON_ID]);
  assert.equal(box.ctx.store.get(LESSON_ID)?.status, 'draft');
});
