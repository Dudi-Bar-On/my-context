/**
 * The one import implementation, from both directions: a plan that writes
 * nothing and an apply that writes once.
 *
 * The properties these tests exist for, because none of them can be read off
 * the module:
 *
 *  1. **Everything lands `draft`, on BOTH tiers.** A normative item would be
 *     demoted by the trust layer anyway; a rationale one would not, which is
 *     why the importer asks for `draft` explicitly rather than leaning on
 *     `trustedStatus`. Both are in the fixture, and a rationale item arriving
 *     `active` is the case that catches a missing `status` argument.
 *  2. **The approval is a parameter of `applyImport` and cannot reach
 *     `planImport`.** §6n.7 requires the approval to be a separate act from
 *     choosing the pack; the type system is where that is held, and the tests
 *     that approve one say so at the call site so a reader can see it.
 *  3. **Planning writes NOTHING.** Asserted by comparing the whole workspace
 *     tree byte for byte before and after, twice — once against a pack of new
 *     items and once against a pack full of changed ones, because the second
 *     is the case where a plan that wrote would be describing a corpus it had
 *     already altered.
 *  4. **The four outcome lists partition the pack.** `imported`,
 *     `overwritten`, `overwriteSkipped` and `overwriteBlocked` account for
 *     every id in the artefact, exactly once each — `INV-nothing-is-dropped-
 *     silently` in the one form a test can check without knowing the items.
 *
 * The artefacts are built here rather than exported from a second workspace:
 * these tests are about what an importer does with a stranger's bytes, and a
 * fixture that could only be produced by this build's own exporter would be
 * unable to express the three shapes that matter most — a retiering config, an
 * item carrying `valid_until`, and a history row whose op this build has never
 * heard of.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readAudit } from '../../src/core/audit.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { computeItemChecksum, renderItem } from '../../src/core/item.ts';
import { updateItem } from '../../src/core/mutate.ts';
import type { Item, Origin } from '../../src/core/types.ts';
import { applyImport, planImport } from '../../src/pack/import.ts';
import { writeBundleDirectory } from '../../src/pack/dir-writer.ts';
import { readImportRecords, readQuarantine } from '../../src/pack/imported-audit.ts';
import {
  comparePaths, CONFIG_NAME, HISTORY_NAME, MANIFEST_NAME, PACK_HISTORY_PROTOCOL,
  type ExportFile,
} from '../../src/pack/layout.ts';
import { buildManifest, renderManifest, type ManifestMeta } from '../../src/pack/manifest.ts';
import { readArtefact } from '../../src/pack/reader.ts';
import { removeTree } from '../helpers/tmp.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';

const PACK_NAME = 'acme-security';
const PACK_VERSION = '2026-08 rev 3';
/** One instant for every stamp in these tests, so nothing reads a clock. */
const FIXED_NOW = Date.parse('2026-08-20T09:12:44.031Z');

const boxes: Sandbox[] = [];
const scratch: string[] = [];

test.after(() => {
  for (const box of boxes) box.dispose();
  for (const dir of scratch) removeTree(dir);
});

/** A workspace with an in-memory index, disposed when the file finishes. */
function workspace(rawConfig?: Record<string, unknown>): Sandbox {
  const box = sandbox(rawConfig);
  boxes.push(box);
  return box;
}

/** A throwaway directory, removed by `removeTree` and never by `rmSync`. */
function scratchDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-imp-'));
  scratch.push(dir);
  return dir;
}

// ---------------------------------------------------------------------------
// Building a stranger's artefact
// ---------------------------------------------------------------------------

/** One complete `Item`, overridden field by field at each call site. */
function item(over: Partial<Item> = {}): Item {
  const base: Item = {
    id: 'RULE-a',
    type: 'rule',
    title: 'A rule',
    status: 'active',
    severity: 'soft',
    always: false,
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

/** The two-space JSON both writers use, so a fixture matches what ships. */
function jsonFile(name: string, document: unknown): ExportFile {
  return { path: name, bytes: Buffer.from(`${JSON.stringify(document, null, 2)}\n`, 'utf8') };
}

function historyFile(rows: readonly unknown[]): ExportFile {
  const text = rows.map((r) => `${JSON.stringify(r)}\n`).join('');
  return { path: HISTORY_NAME, bytes: Buffer.from(text, 'utf8') };
}

/** The three built-in categories the standard fixture's items belong to. */
const PACK_CATEGORIES = {
  rule: { enabled: true, prefix: 'RULE', scopePolicy: 'global' },
  lesson: { enabled: true, prefix: 'LESSON', scopePolicy: 'global' },
  standard: { enabled: true, prefix: 'STD', scopePolicy: 'global' },
};

const RULE_ID = 'RULE-never-log-a-token';
const LESSON_ID = 'LESSON-retry-backoff';
const STANDARD_ID = 'STD-commit-messages';

/**
 * The three items every fixture starts from: one normative, one rationale,
 * one normative-and-overwritable. All three arrive `active`.
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

/**
 * Forty-one history rows, two of which carry an op this build has never heard
 * of — the version-skew shape the quarantine exists for.
 */
function packHistory(): unknown[] {
  const rows: unknown[] = [];
  const ids = [RULE_ID, LESSON_ID, STANDARD_ID];
  for (let i = 0; i < 39; i += 1) {
    rows.push({
      protocol: PACK_HISTORY_PROTOCOL,
      at: new Date(Date.UTC(2026, 0, 2, 9, 0, i)).toISOString(),
      kind: 'mutation',
      op: 'create',
      origin: 'human',
      itemId: ids[i % ids.length],
    });
  }
  for (let i = 0; i < 2; i += 1) {
    rows.push({
      protocol: PACK_HISTORY_PROTOCOL,
      at: new Date(Date.UTC(2026, 0, 2, 10, 0, i)).toISOString(),
      kind: 'mutation',
      op: 'annotate',
      origin: 'human',
      itemId: ids[i],
    });
  }
  return rows;
}

interface ArtefactShape {
  items?: Item[];
  categories?: Record<string, unknown>;
  history?: readonly unknown[];
  meta?: Partial<ManifestMeta>;
}

/**
 * Writes one artefact directory and returns its path.
 *
 * The manifest is built by `buildManifest` over the same bytes that are
 * written, so every fixture verifies — a fixture that did not would be testing
 * `readArtefact`'s refusal instead of anything here.
 */
function artefact(shape: ArtefactShape = {}): string {
  const files: ExportFile[] = [
    ...(shape.items ?? packItems()).map(itemFile),
    jsonFile(CONFIG_NAME, { categories: shape.categories ?? PACK_CATEGORIES }),
    historyFile(shape.history ?? packHistory()),
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

// ---------------------------------------------------------------------------
// Planning and applying
// ---------------------------------------------------------------------------

/** What `planImport` is planned against: the corpus, and both configs. */
function against(box: Sandbox): {
  existing: (id: string) => Item | null; rawConfig: unknown; local: typeof box.ctx.config;
} {
  return {
    existing: (id: string): Item | null => box.ctx.store.get(id),
    rawConfig: JSON.parse(readFileSync(path.join(box.root, 'config.json'), 'utf8')) as unknown,
    local: box.ctx.config,
  };
}

function plan(box: Sandbox, source: string) {
  return planImport(readArtefact(source), against(box));
}

/**
 * The shared options. `overwriteApproved` is present and FALSE here, not
 * absent and defaulted: the field is required by the type so that no call site
 * can overwrite by omission, and the tests that approve one say so at the
 * call, where a reader can see it.
 */
function options(source: string, over: { overwriteApproved?: boolean } = {}) {
  return {
    name: PACK_NAME, source, now: FIXED_NOW, overwriteApproved: false, ...over,
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

// ---------------------------------------------------------------------------
// What an import lands
// ---------------------------------------------------------------------------

test('every imported item lands draft, on BOTH tiers', () => {
  // A normative `rule` and a rationale `lesson`, both arriving `status:
  // active`. The normative one would be demoted by the trust layer anyway; the
  // rationale one would NOT, which is why the importer asks for draft
  // explicitly.
  const box = workspace();
  const source = artefact();
  const outcome = applyImport(box.ctx, plan(box, source), options(source));

  assert.equal(outcome.imported.length, 3);
  for (const id of outcome.imported) {
    const stored = box.ctx.store.get(id);
    assert.ok(stored !== null, id);
    assert.equal(stored.status, 'draft', id);
  }
  assert.equal(box.ctx.store.get(LESSON_ID)?.type, 'lesson', 'the rationale half of the pair');
});

test('imported items carry origin ingest — no fourth origin is invented', () => {
  const box = workspace();
  const source = artefact();
  const outcome = applyImport(box.ctx, plan(box, source), options(source));

  for (const id of outcome.imported) assert.equal(box.ctx.store.get(id)?.origin, 'ingest');

  // The union is still closed, checked where a list cannot go stale: adding a
  // fourth member to `Origin` fails this file's typecheck rather than leaving
  // a retyped array quietly agreeing with itself.
  const ORIGINS = ['human', 'agent', 'ingest'] as const satisfies readonly Origin[];
  type Assert<T extends true> = T;
  type _OriginIsClosed = Assert<[Origin] extends [(typeof ORIGINS)[number]] ? true : false>;
  assert.deepEqual([...ORIGINS], ['human', 'agent', 'ingest']);
});

test('incoming ids are preserved verbatim, so the bucket rule means something on re-import', () => {
  const box = workspace();
  const source = artefact();
  const outcome = applyImport(box.ctx, plan(box, source), options(source));

  assert.deepEqual(outcome.imported.toSorted(comparePaths),
    [LESSON_ID, RULE_ID, STANDARD_ID].toSorted(comparePaths));
  for (const id of outcome.imported) assert.equal(box.ctx.store.get(id)?.id, id);
});

test('re-importing the same pack is a no-op and reports every item as identical', () => {
  const box = workspace();
  const source = artefact();
  const first = plan(box, source);
  applyImport(box.ctx, first, options(source));

  const second = plan(box, source);

  assert.equal(second.buckets.new.length, 0);
  assert.equal(second.buckets.changed.length, 0);
  assert.equal(second.buckets.identical.length, first.buckets.new.length);
});

// ---------------------------------------------------------------------------
// §6n.7: the overwrite, and the four things it may not do without
// ---------------------------------------------------------------------------

/** One imported corpus whose `STD-commit-messages` has been edited locally. */
function edited(box: Sandbox, source: string): string {
  applyImport(box.ctx, plan(box, source), options(source));
  updateItem(box.ctx, { id: STANDARD_ID, body: 'my own wording', origin: 'human' });
  return STANDARD_ID;
}

test('WITHOUT approval a changed item is byte-identical afterwards', () => {
  // Edit one imported item locally, then re-import with no approval. This is
  // the declining path §6n.7 keeps, not the withdrawn design: the difference
  // is that the user was asked.
  const box = workspace();
  const source = artefact();
  const id = edited(box, source);
  const before = box.ctx.store.get(id);

  const outcome = applyImport(box.ctx, plan(box, source), options(source));

  assert.deepEqual(box.ctx.store.get(id), before);
  assert.deepEqual(outcome.overwritten, []);
  assert.deepEqual(outcome.overwriteSkipped, [id]);
});

test('WITH approval a changed item takes the pack\'s content', () => {
  const box = workspace();
  const source = artefact();
  const id = edited(box, source);

  const outcome = applyImport(
    box.ctx, plan(box, source), options(source, { overwriteApproved: true }),
  );

  assert.deepEqual(outcome.overwritten, [id]);
  assert.equal(box.ctx.store.get(id)?.body, 'Write commit messages in the imperative.');
});

test('an overwritten item lands draft, so it stops governing until it is promoted', () => {
  // The local item was `active`. §6m.5 is undisturbed by §6n.7, and the
  // alternative — leaving it active — would let pack content govern with no
  // review at all, which is the outcome the draft rule exists to prevent.
  const box = workspace();
  const source = artefact();
  applyImport(box.ctx, plan(box, source), options(source));
  updateItem(box.ctx, { id: STANDARD_ID, status: 'active', origin: 'human' });
  updateItem(box.ctx, { id: STANDARD_ID, body: 'my own wording', origin: 'human' });
  assert.equal(box.ctx.store.get(STANDARD_ID)?.status, 'active', 'the fixture must be governing');

  applyImport(box.ctx, plan(box, source), options(source, { overwriteApproved: true }));

  assert.equal(box.ctx.store.get(STANDARD_ID)?.status, 'draft');
});

/** How many `update` records the log already holds for `id`. */
function updateRecords(root: string, id: string) {
  return readAudit(root).filter((r) => r.op === 'update' && r.itemId === id);
}

test('every overwrite writes ONE update mutation record naming the moved fields', () => {
  const box = workspace();
  const source = artefact();
  const id = edited(box, source);
  // The local edit that made this item `changed` wrote a record of its own, so
  // the count is taken as a DELTA. Asserting the absolute total would be
  // asserting how the fixture reached its state.
  const before = updateRecords(box.root, id).length;

  applyImport(box.ctx, plan(box, source), options(source, { overwriteApproved: true }));

  const records = updateRecords(box.root, id);
  assert.equal(records.length - before, 1, 'one record, for one overwrite');
  const record = records[records.length - 1];
  assert.equal(record.origin, 'human');
  assert.ok(record.fields?.includes('body'), JSON.stringify(record.fields));
});

test('the overwrite is attributable and dated in the log — what §6n.7 can actually ask for', () => {
  // NOT "the prior content is recoverable from the log": a mutation record
  // carries the NAMES of the fields that moved and never their values
  // (`core/persist.ts` · `export function movedFields(before: AuditedSnapshot, item: Item): string[] {` · ~162),
  // so nothing in `.audit/` can reconstruct the body that was replaced. The
  // recoverable-from-git half of §0 item 7 is the true half, and this asserts
  // the half the log itself supports: which item, which fields, by whom, when.
  const box = workspace();
  const source = artefact();
  applyImport(box.ctx, plan(box, source), options(source));
  updateItem(box.ctx, { id: STANDARD_ID, status: 'active', origin: 'human' });
  updateItem(box.ctx, { id: STANDARD_ID, body: 'my own wording', origin: 'human' });
  const before = box.ctx.store.get(STANDARD_ID)?.body;

  applyImport(box.ctx, plan(box, source), options(source, { overwriteApproved: true }));

  const records = updateRecords(box.root, STANDARD_ID);
  const record = records[records.length - 1];
  assert.equal(record.kind, 'mutation');
  assert.ok(record.at.endsWith('Z'), record.at);
  // Both moves, in one record: the content the pack replaced and the demotion
  // that stops it governing until a human promotes it again.
  assert.deepEqual(record.fields?.toSorted(comparePaths), ['body', 'status']);
  assert.notEqual(
    box.ctx.store.get(STANDARD_ID)?.body, before, 'the overwrite really did move the body',
  );
});

test('an item blocked on observations is never attempted, even WITH approval', () => {
  const box = workspace();
  const source = artefact();
  applyImport(box.ctx, plan(box, source), options(source));

  // The same three items, one of which now carries an observation the local
  // copy does not. `UpdateInput` has no route to `observations`, so no write
  // path this plan owns can apply it.
  const blocked = artefact({
    items: packItems().map((it) => (it.id !== LESSON_ID ? it : item({
      ...it,
      observations: [{ category: 'evidence', text: 'seen in production', tags: [], context: null }],
    }))),
  });
  const before = box.ctx.store.get(LESSON_ID);

  const outcome = applyImport(
    box.ctx, plan(box, blocked), options(blocked, { overwriteApproved: true }),
  );

  assert.deepEqual(outcome.overwritten, []);
  assert.deepEqual(outcome.overwriteBlocked, [LESSON_ID]);
  assert.deepEqual(box.ctx.store.get(LESSON_ID), before);
});

test('imported, overwritten, skipped and blocked account for every id in the pack', () => {
  const box = workspace();
  const first = artefact();
  applyImport(box.ctx, plan(box, first), options(first));
  updateItem(box.ctx, { id: STANDARD_ID, body: 'my own wording', origin: 'human' });

  // Four shapes in one artefact: one new, one identical, one changed and
  // overwritable, one changed and blocked.
  const source = artefact({
    items: [
      ...packItems().map((it) => (it.id !== LESSON_ID ? it : item({
        ...it,
        observations: [{ category: 'evidence', text: 'seen', tags: [], context: null }],
      }))),
      item({ id: 'RULE-pin-your-actions', title: 'Pin your actions', body: 'Pin them.' }),
    ],
  });
  const planned = plan(box, source);

  const outcome = applyImport(
    box.ctx, planned, options(source, { overwriteApproved: true }),
  );

  const seen = [
    ...outcome.imported, ...outcome.overwritten,
    ...outcome.overwriteSkipped, ...outcome.overwriteBlocked,
  ];
  assert.equal(new Set(seen).size, seen.length, 'no id is counted twice');
  assert.deepEqual(seen.toSorted(comparePaths), planned.allIds.toSorted(comparePaths));
});

// ---------------------------------------------------------------------------
// §6n.1: what a pack may and may not say about a category
// ---------------------------------------------------------------------------

test('a pack setting a tier on a category that EXISTS here is refused, nothing written', () => {
  const box = workspace();
  const retier = artefact({
    categories: { ...PACK_CATEGORIES, rule: { enabled: true, tier: 'rationale' } },
  });

  assert.throws(() => plan(box, retier), /boundary/);
  assert.equal(box.ctx.store.all().length, 0);
});

test('a pack DEFINING a category imports, and its items land under the new type — §6n.1', () => {
  // The half §6m.4 refused. The category arrives with tier and description,
  // resolveConfig accepts it, and the items are real items of a real type.
  const box = workspace();
  const source = artefact({
    items: [item({ id: 'THREAT-token-replay', type: 'threat_model', title: 'Token replay' })],
    categories: {
      threat_model: {
        enabled: true, tier: 'normative', prefix: 'THREAT',
        description: 'A modelled attack and what stops it',
      },
    },
  });

  const outcome = applyImport(box.ctx, plan(box, source), options(source));

  assert.ok(outcome.imported.length > 0);
  assert.equal(box.ctx.store.get(outcome.imported[0])?.type, 'threat_model');
  const raw = JSON.parse(readFileSync(path.join(box.root, CONFIG_NAME), 'utf8')) as unknown;
  assert.equal(resolveConfig(raw).categories.threat_model.tier, 'normative');
});

// ---------------------------------------------------------------------------
// What does not travel, and what is counted
// ---------------------------------------------------------------------------

test('an item carrying valid_until is refused, and the refusal names the ids', () => {
  const box = workspace();
  const bounded = artefact({
    items: packItems().map((it) => (it.id !== RULE_ID ? it : item({ ...it, validUntil: '2026-03-01' }))),
  });

  assert.throws(() => plan(box, bounded), /valid_until/);
  assert.throws(() => plan(box, bounded), new RegExp(RULE_ID));
  assert.equal(box.ctx.store.all().length, 0);
});

test('valid_from is re-stamped and the plan says so before anything is written', () => {
  const box = workspace();
  const source = artefact();

  const planned = plan(box, source);

  assert.ok(
    planned.notCarried.some((n) => n.field === 'valid_from' && n.items === 3),
    JSON.stringify(planned.notCarried),
  );
});

test('budgets and watchedDocs survive an import untouched', () => {
  const box = workspace({
    profile: 'standard',
    categories: {},
    budgets: { pinned: 4321, jit: 6000, restored: 8000, index: 1200 },
    watchedDocs: ['docs/**/*.md'],
  });
  const configPath = path.join(box.root, CONFIG_NAME);
  const source = artefact();
  const before = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;

  applyImport(box.ctx, plan(box, source), options(source));

  const after = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  assert.deepEqual(after.budgets, before.budgets);
  assert.deepEqual(after.watchedDocs, before.watchedDocs);
});

test('an unknown audit op is quarantined and counted, and the rest of the history lands', () => {
  const box = workspace();
  const source = artefact();

  const outcome = applyImport(box.ctx, plan(box, source), options(source));

  assert.equal(outcome.quarantined, 2);
  assert.equal(outcome.historyRecords, 39);
  assert.equal(readQuarantine(box.root).length, 2);
  // The fixture's two alien rows are the LAST two of forty-one, so the batch
  // index and the line number cannot be mistaken for each other: a report that
  // said 1 and 2 would send a reader to two rows this build read without
  // complaint.
  assert.deepEqual(readQuarantine(box.root).map((r) => r.line), [40, 41]);
});

test('the quarantined line is the line of the artefact a person would open', () => {
  // Checked against the FILE and not against a second number this build
  // computed: line N of the `history.jsonl` still sitting in the artefact is
  // the row that was set aside, byte for byte.
  const box = workspace();
  const source = artefact();

  applyImport(box.ctx, plan(box, source), options(source));

  const fileLines = readFileSync(path.join(source, HISTORY_NAME), 'utf8').split('\n');
  assert.equal(fileLines.length, 42, 'forty-one rows, each newline-terminated');
  const wrapped = readQuarantine(box.root);
  assert.equal(wrapped.length, 2);
  for (const row of wrapped) {
    assert.notEqual(row.line, null, 'a row that came out of a file has a line in it');
    assert.equal(fileLines[(row.line ?? 0) - 1], JSON.stringify(row.record));
    assert.match(fileLines[(row.line ?? 0) - 1], /"op":"annotate"/);
  }
});

// ---------------------------------------------------------------------------
// The plan writes nothing
// ---------------------------------------------------------------------------

test('planImport writes nothing at all — asserted by comparing the tree before and after', () => {
  const box = workspace();
  const source = artefact();
  const before = snapshotTree(box.root);

  plan(box, source);

  assert.deepEqual(snapshotTree(box.root), before);
});

test('planImport still writes nothing when the pack is full of changed items', () => {
  // The approval is asked AFTER the plan is rendered, so the plan is what the
  // user reads before deciding. If planning could write, the warning would be
  // describing a corpus it had already altered.
  const box = workspace();
  const source = artefact();
  applyImport(box.ctx, plan(box, source), options(source));
  for (const id of [RULE_ID, LESSON_ID, STANDARD_ID]) {
    updateItem(box.ctx, { id, body: `my own wording for ${id}`, origin: 'human' });
  }
  const changedPlan = plan(box, source);
  assert.equal(changedPlan.buckets.changed.length, 3, 'the fixture must be all changed');
  const before = snapshotTree(box.root);

  plan(box, source);

  assert.deepEqual(snapshotTree(box.root), before);
});

// ---------------------------------------------------------------------------
// The import record
// ---------------------------------------------------------------------------

test('the membership list in the import record is exactly what was created, overwrites included', () => {
  const box = workspace();
  const first = artefact();
  applyImport(box.ctx, plan(box, first), options(first));
  updateItem(box.ctx, { id: STANDARD_ID, body: 'my own wording', origin: 'human' });

  const source = artefact({
    items: [...packItems(), item({ id: 'RULE-pin-your-actions', title: 'Pin', body: 'Pin them.' })],
  });
  const outcome = applyImport(
    box.ctx, plan(box, source), options(source, { overwriteApproved: true }),
  );

  const [record] = readImportRecords(box.root);
  assert.equal(record.pack, PACK_NAME);
  assert.equal(record.version, PACK_VERSION);
  assert.deepEqual(
    record.items,
    [...outcome.imported, ...outcome.overwritten].toSorted(comparePaths),
  );
  assert.ok(record.items.includes(STANDARD_ID), 'an overwritten id is a pack member');
  assert.equal(record.historyRecords, 39);
  assert.equal(record.quarantined, 2);
});
