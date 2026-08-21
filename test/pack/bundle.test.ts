/**
 * `buildBundle` is the only thing that decides WHICH bytes leave this
 * workspace, so every test below is about a way bytes could leave that nobody
 * chose — or fail to leave with nobody told.
 *
 * Four of them are the ones worth reading twice:
 *
 *  1. **the file list is asserted whole, not sampled.** The plan's own test
 *     asserted the SET OF FIRST SEGMENTS, which is satisfied by an artefact
 *     carrying `items/rule/.hidden.md` beside every legitimate file. The
 *     assertion here is `deepEqual` over the complete path list, so a file
 *     that starts travelling fails this whether or not anyone thought of it.
 *  2. **the order is proved over UTF-8, not UTF-16.** Two item directories,
 *     `Ａ` (U+FF21) and `𝐀` (U+1D400), sort one way by JavaScript's default
 *     comparison and the other way by their UTF-8 bytes. The test asserts the
 *     UTF-8 answer AND that the naive answer differs, so a comparator swapped
 *     for `<` fails instead of coincidentally agreeing.
 *  3. **the pack projection is asserted by what the file SAYS.** The plan
 *     asserted `packItem.includes('source_file:') === false`, which no correct
 *     implementation can satisfy: `renderItem` writes every frontmatter key,
 *     and a cleared field renders as `source_file: null`. Its companion
 *     assertion — that a full export's item *does* contain `source_file:` —
 *     passes for a pack too, so the pair tested nothing at all. Here both
 *     halves assert the VALUE.
 *  4. **an exclusion names the flag that actually decided it.** An item
 *     failing two filters names both; an item failing one names one. A report
 *     that listed every flag the user typed would pass a one-filter test and
 *     fail this.
 *
 * **Refusals are asserted by their MESSAGE**, and specifically by the part of
 * it that only the guard under test can produce. `buildManifest` refuses the
 * same path set this module refuses, so a test that asserted only "it throws"
 * would stay green with this module's own check deleted; the assertions below
 * name the item, which is the sentence `buildManifest` has no way to write.
 *
 * **One gap is recorded rather than tested, because it is not this module's
 * to close.** The byte layout says a pack's `name` and `version` are
 * "screened by the Unicode screen", and `screenPackMeta` has no call site
 * anywhere in the export plan. Measured rather than assumed: `refusePackName`
 * returns `null` for a name holding U+202E RIGHT-TO-LEFT OVERRIDE, for one
 * holding U+200B ZERO WIDTH SPACE, and for one holding a Tags-block code
 * point — none of the three is a C0/C1 control, none changes under NFC, and
 * each costs one code point, so every rule that function has lets them
 * through. The call site is `refuseMeta` in `manifest.ts`, because that
 * one function guards the triple on the way out (`buildManifest`) and on the
 * way back in (`parseManifest`); wiring the screen into this module would
 * screen only the half of the traffic this module produces, and a stranger's
 * name arrives through the other half.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import {
  copyFileSync, mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { computeItemChecksum, parseItem, renderItem } from '../../src/core/item.ts';
import { createItem } from '../../src/core/mutate.ts';
import type { LoadError } from '../../src/core/rebuild.ts';
import { buildBundle, type BundleOptions } from '../../src/pack/bundle.ts';
import { comparePaths, refuseArtefactPaths } from '../../src/pack/layout.ts';
import { parseManifest, verifyManifest } from '../../src/pack/manifest.ts';
import { removeTree } from '../helpers/tmp.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';

/** A fixed instant, so `createdAt` is the only field a clock could move. */
const NOW = Date.UTC(2026, 7, 20, 12, 0, 0);

const EXPORT_OPTS: BundleOptions = {
  kind: 'export', name: null, version: null, filters: {}, history: true, now: NOW,
};

const PACK_OPTS: BundleOptions = {
  ...EXPORT_OPTS, kind: 'pack', name: 'acme security', version: '2026-08 rev 3',
};

/**
 * The corpus every test starts from: one item carrying all three provenance
 * fields, one carrying only `source_file`, one plain, one tagged and one
 * draft. The provenance split is what makes `droppedFields` a per-FIELD count
 * rather than a per-item one.
 */
function corpus(box: Sandbox): void {
  createItem(box.ctx, {
    type: 'rule', title: 'from a doc', body: 'B',
    sourceFile: 'docs/x.md', sourceAnchor: '## A', sourceChecksum: 'deadbeefdeadbeef',
  });
  createItem(box.ctx, {
    type: 'rule', title: 'half sourced', body: 'B', sourceFile: 'docs/y.md',
  });
  createItem(box.ctx, { type: 'standard', title: 'plain std', body: 'B', tags: ['ops'] });
  createItem(box.ctx, { type: 'lesson', title: 'a lesson', body: 'B', status: 'draft' });
}

function paths(bundle: { files: { path: string }[] }): string[] {
  return bundle.files.map((f) => f.path);
}

function text(bundle: { files: { path: string; bytes: Buffer }[] }, p: string): string {
  const found = bundle.files.find((f) => f.path === p);
  assert.ok(found !== undefined, `no ${p} in [${paths(bundle).join(', ')}]`);
  return found.bytes.toString('utf8');
}

function refusalOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  assert.fail('expected a refusal, got none');
}

/** Move an item's file, so `filePath` is something other than the mint path. */
function relocate(box: Sandbox, from: string, to: string): void {
  const target = path.join(box.root, ...to.split('/'));
  mkdirSync(path.dirname(target), { recursive: true });
  renameSync(path.join(box.root, ...from.split('/')), target);
}

// ---------------------------------------------------------------------------
// The walk, and what it has no way to widen
// ---------------------------------------------------------------------------

test('the artefact holds items, config, history and the manifest — and nothing else, '
  + 'whatever else is in the workspace', () => {
  const box = sandbox();
  try {
    corpus(box);
    // Every directory §5 says does not travel, created so the assertion is
    // about the walk rather than about the fixture being thin. A deny-list
    // that is accurate today ships `.revisions/` — the text of REJECTED
    // proposals — the first time someone adds a directory nobody remembered.
    for (const dir of ['.revisions', '.ingest', '.staging', 'state', '.audit/imported']) {
      mkdirSync(path.join(box.root, ...dir.split('/')), { recursive: true });
      writeFileSync(path.join(box.root, ...dir.split('/'), 'kept.json'), '{"secret":1}\n');
    }
    // The index and its two WAL companions: derived, rebuilt on arrival, and
    // three files a walk of the workspace root would otherwise pick up.
    for (const name of ['.index.db', '.index.db-wal', '.index.db-shm']) {
      writeFileSync(path.join(box.root, name), 'derived, and never knowledge\n');
    }
    // Inside `items/`, where a walk that trusted the directory would find them.
    writeFileSync(path.join(box.root, 'items', 'rule', 'notes.txt'), 'not an item\n');
    mkdirSync(path.join(box.root, 'items', 'rule', 'attachments'), { recursive: true });
    writeFileSync(path.join(box.root, 'items', 'rule', 'attachments', 'a.txt'), 'x\n');

    const bundle = buildBundle(box.root, box.ctx.config, EXPORT_OPTS);

    assert.deepEqual(paths(bundle), [
      'config.json',
      'history.jsonl',
      'items/lesson/LESSON-a-lesson.md',
      'items/rule/RULE-from-a-doc.md',
      'items/rule/RULE-half-sourced.md',
      'items/standard/STD-plain-std.md',
      'manifest.json',
    ]);
    // The same set, asked of the rule rather than of this list.
    assert.equal(refuseArtefactPaths(paths(bundle)), null);
  } finally { box.dispose(); }
});

test('the files are ordered by their UTF-8 bytes, which is not the order '
  + 'JavaScript compares strings in', () => {
  const box = sandbox();
  try {
    createItem(box.ctx, { type: 'rule', title: 'astral', body: 'B' });
    createItem(box.ctx, { type: 'rule', title: 'wide', body: 'B' });
    // U+1D400 is a surrogate pair beginning D835; U+FF21 is a lone BMP unit.
    // By UTF-16 code units D835 < FF21, so the astral name sorts FIRST. By
    // UTF-8 bytes F0 9D 90 80 > EF BC A1, so it sorts LAST. Two writers that
    // disagreed about this produce a ZIP whose entry order contradicts the
    // manifest it carries.
    relocate(box, 'items/rule/RULE-astral.md', 'items/\u{1D400}/RULE-astral.md');
    relocate(box, 'items/rule/RULE-wide.md', 'items/Ａ/RULE-wide.md');

    const got = paths(buildBundle(box.root, box.ctx.config, EXPORT_OPTS));
    assert.deepEqual(got, [
      'config.json',
      'history.jsonl',
      'items/Ａ/RULE-wide.md',
      'items/\u{1D400}/RULE-astral.md',
      'manifest.json',
    ]);
    // The comparison this order is NOT: asserted so the case above cannot be
    // passed by accident on a corpus where both answers agree.
    assert.deepEqual([...got].sort(), [
      'config.json',
      'history.jsonl',
      'items/\u{1D400}/RULE-astral.md',
      'items/Ａ/RULE-wide.md',
      'manifest.json',
    ]);
    assert.notDeepEqual(got, [...got].sort());
    // And it is the one comparator, not a second spelling of it.
    assert.deepEqual(got, [...got].toSorted(comparePaths));
  } finally { box.dispose(); }
});

test('an artefact path comes from the item\'s own file, not from a path rebuilt '
  + 'from its type and id', () => {
  const box = sandbox();
  try {
    createItem(box.ctx, { type: 'standard', title: 'filed elsewhere', body: 'B' });
    createItem(box.ctx, { type: 'rule', title: 'filed normally', body: 'B' });
    relocate(box, 'items/standard/STD-filed-elsewhere.md', 'items/adr/STD-filed-elsewhere.md');

    const bundle = buildBundle(box.root, box.ctx.config, EXPORT_OPTS);
    assert.ok(paths(bundle).includes('items/adr/STD-filed-elsewhere.md'));
    assert.equal(paths(bundle).includes('items/standard/STD-filed-elsewhere.md'), false);
    // The count is keyed by the item's TYPE, which is what a category means —
    // and it is sorted, which here is not the order the items loaded in.
    assert.deepEqual(Object.keys(bundle.report.byCategory), ['rule', 'standard']);
    assert.deepEqual(bundle.report.byCategory, { rule: 1, standard: 1 });
  } finally { box.dispose(); }
});

test('a category named "__proto__" is counted as a member, not installed as the '
  + 'report\'s prototype', () => {
  const box = sandbox();
  try {
    createItem(box.ctx, { type: 'rule', title: 'ordinary', body: 'B' });
    // Hand-authored, because no mint path produces this: `type` is fixed at
    // creation and nothing in `core/` validates it against a grammar, so an
    // item file says whatever it says. `loadLayer` reports the unknown
    // category and keeps the item — dropping it is the failure the integrity
    // check exists to surface. No `checksum` line, so nothing claims one.
    writeFileSync(
      path.join(box.root, 'items', 'rule', 'RULE-proto.md'),
      ['---', 'id: RULE-proto', 'type: __proto__', 'title: proto', 'status: active',
        'severity: soft', 'always: false', 'scope: []', 'tags: []', 'origin: human',
        '---', '', '# proto', '', 'B', ''].join('\n'),
    );

    const errors: LoadError[] = [];
    const report = buildBundle(box.root, box.ctx.config, EXPORT_OPTS, errors).report;
    assert.ok(errors.some((e) => e.message.includes('declares type "__proto__"')));
    // A plain `counts[key] = n` here walks the prototype chain: the entry
    // vanishes from `Object.keys` and from `JSON.stringify`, and a stranger's
    // number becomes the object's prototype. This project has hit that hazard
    // five separate times, in five different files.
    assert.deepEqual(Object.keys(report.byCategory).toSorted(), ['__proto__', 'rule']);
    assert.equal(Object.getPrototypeOf(report.byCategory), Object.prototype);
    assert.equal(JSON.parse(JSON.stringify(report.byCategory)).__proto__, 1);
    assert.equal(report.items, 2);
  } finally { box.dispose(); }
});

// ---------------------------------------------------------------------------
// The pack projection
// ---------------------------------------------------------------------------

test('a pack clears provenance, counts each field it cleared, and a full export keeps it', () => {
  const box = sandbox();
  try {
    corpus(box);
    const pack = buildBundle(box.root, box.ctx.config, PACK_OPTS);
    const packed = text(pack, 'items/rule/RULE-from-a-doc.md');
    // `renderItem` writes every frontmatter key, so a cleared field is
    // `source_file: null` and not an absent line. The VALUE is what leaked.
    assert.match(packed, /^source_file: null$/m);
    assert.match(packed, /^source_anchor: null$/m);
    assert.match(packed, /^source_checksum: null$/m);
    assert.equal(packed.includes('docs/x.md'), false);
    assert.equal(packed.includes('deadbeefdeadbeef'), false);

    const full = buildBundle(box.root, box.ctx.config, EXPORT_OPTS);
    const exported = text(full, 'items/rule/RULE-from-a-doc.md');
    assert.match(exported, /^source_file: docs\/x\.md$/m);
    assert.match(exported, /^source_anchor: "## A"$/m);
    assert.match(exported, /^source_checksum: deadbeefdeadbeef$/m);
    assert.deepEqual(full.report.droppedFields, []);

    // Per FIELD, not per item: two items carry `source_file`, one of them
    // carries all three. A count of items would say 2/2/2 or 1/1/1.
    assert.deepEqual(pack.report.droppedFields, [
      { field: 'source_file', items: 2 },
      { field: 'source_anchor', items: 1 },
      { field: 'source_checksum', items: 1 },
    ]);
  } finally { box.dispose(); }
});

test('clearing provenance leaves the recorded checksum valid, so an imported item '
  + 'does not arrive already reading as tampered-with', () => {
  const box = sandbox();
  try {
    corpus(box);
    const pack = buildBundle(box.root, box.ctx.config, PACK_OPTS);
    const full = buildBundle(box.root, box.ctx.config, EXPORT_OPTS);
    let checked = 0;
    for (const f of pack.files) {
      if (!f.path.startsWith('items/')) continue;
      const parsed = parseItem(f.bytes.toString('utf8'), f.path, 'project');
      // `computeItemChecksum` hashes thirteen fields and provenance is not
      // among them, so the value written by the workspace still verifies. Had
      // it covered them, every pack would land a corpus whose every item
      // reddens `mycontext doctor` on arrival.
      assert.equal(computeItemChecksum(parsed), parsed.checksum, f.path);
      assert.equal(
        parsed.checksum,
        parseItem(text(full, f.path), f.path, 'project').checksum,
        `${f.path}: the pack and the export disagree about the item's checksum`,
      );
      checked += 1;
    }
    assert.equal(checked, 4);
  } finally { box.dispose(); }
});

test('an item file round-trips: parse(render(item)) is byte-identical, for both kinds', () => {
  const box = sandbox();
  try {
    corpus(box);
    // INV-markdown-is-the-source-of-truth, applied to the wire format: if an
    // exported item does not parse back to what was exported, the corpus that
    // arrives is not the corpus that was sent.
    let checked = 0;
    for (const options of [EXPORT_OPTS, PACK_OPTS]) {
      for (const f of buildBundle(box.root, box.ctx.config, options).files) {
        if (!f.path.startsWith('items/')) continue;
        const written = f.bytes.toString('utf8');
        assert.equal(renderItem(parseItem(written, f.path, 'project')), written, f.path);
        checked += 1;
      }
    }
    assert.equal(checked, 8);
  } finally { box.dispose(); }
});

// ---------------------------------------------------------------------------
// The config projection
// ---------------------------------------------------------------------------

test('a pack config names exactly the categories that hold an item and carries nothing '
  + 'else; a full export carries the workspace', () => {
  const box = sandbox();
  try {
    corpus(box);
    const pack = JSON.parse(text(buildBundle(box.root, box.ctx.config, PACK_OPTS), 'config.json'));
    assert.deepEqual(Object.keys(pack), ['categories']);
    assert.deepEqual(Object.keys(pack.categories).toSorted(), ['lesson', 'rule', 'standard']);
    for (const entry of Object.values(pack.categories) as Record<string, unknown>[]) {
      assert.equal(entry.enabled, true);
      assert.equal(Object.hasOwn(entry, 'agentEdits'), false);
    }

    // The other branch, asserted rather than assumed: without it "a pack
    // carries no profile" would pass against an implementation that never
    // carries one for either kind.
    const full = JSON.parse(text(buildBundle(box.root, box.ctx.config, EXPORT_OPTS), 'config.json'));
    assert.equal(full.profile, 'standard');
    assert.ok(Object.hasOwn(full, 'budgets'));
    assert.ok(Object.hasOwn(full, 'watchedDocs'));
    assert.ok(Object.keys(full.categories).length > Object.keys(pack.categories).length);

    // The house spelling for every JSON file in an artefact.
    const bytes = text(buildBundle(box.root, box.ctx.config, PACK_OPTS), 'config.json');
    assert.equal(bytes, `${JSON.stringify(pack, null, 2)}\n`);
    assert.equal(bytes.includes('\r'), false);
  } finally { box.dispose(); }
});

// ---------------------------------------------------------------------------
// The selection, and the disclosure that comes with it
// ---------------------------------------------------------------------------

test('a filtered export excludes items and names the flag that excluded each one', () => {
  const box = sandbox();
  try {
    corpus(box);
    const bundle = buildBundle(box.root, box.ctx.config, {
      ...EXPORT_OPTS, filters: { type: 'rule', tag: 'ops' },
    });
    assert.equal(bundle.report.items, 0);
    // Each item names the flag or flags that actually decided it — never the
    // whole list of flags the user typed. `RULE-from-a-doc` passes `--type`
    // and fails `--tag`; `STD-plain-std` is the mirror image.
    assert.deepEqual(bundle.report.excluded, [
      { id: 'LESSON-a-lesson', reason: 'excluded by --type "rule" and --tag "ops"' },
      { id: 'RULE-from-a-doc', reason: 'excluded by --tag "ops"' },
      { id: 'RULE-half-sourced', reason: 'excluded by --tag "ops"' },
      { id: 'STD-plain-std', reason: 'excluded by --type "rule"' },
    ]);

    const one = buildBundle(box.root, box.ctx.config, {
      ...EXPORT_OPTS, filters: { type: 'rule' },
    });
    assert.equal(one.report.items, 2);
    assert.deepEqual(one.report.excluded.map((e) => e.id), ['LESSON-a-lesson', 'STD-plain-std']);
    assert.ok(one.report.excluded.every((e) => e.reason === 'excluded by --type "rule"'));

    // An unfiltered export excludes nothing and says so with an empty list,
    // not with an absent one.
    assert.deepEqual(buildBundle(box.root, box.ctx.config, EXPORT_OPTS).report.excluded, []);
  } finally { box.dispose(); }
});

test('a status filter is reported by its own flag, so the report cannot name '
  + 'the first flag it finds', () => {
  const box = sandbox();
  try {
    corpus(box);
    const bundle = buildBundle(box.root, box.ctx.config, {
      ...EXPORT_OPTS, filters: { status: 'draft' },
    });
    assert.deepEqual(bundle.report.excluded.map((e) => e.reason),
      Array(3).fill('excluded by --status "draft"'));
    assert.deepEqual(paths(bundle).filter((p) => p.startsWith('items/')),
      ['items/lesson/LESSON-a-lesson.md']);
  } finally { box.dispose(); }
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

test('history is joined to the selection, and withheld is not the same as empty', () => {
  const box = sandbox();
  try {
    corpus(box);
    const all = buildBundle(box.root, box.ctx.config, EXPORT_OPTS);
    assert.equal(all.report.historyRecords, 4);

    const filtered = buildBundle(box.root, box.ctx.config, {
      ...EXPORT_OPTS, filters: { type: 'lesson' },
    });
    assert.equal(filtered.report.historyRecords, 1);
    for (const line of text(filtered, 'history.jsonl').trimEnd().split('\n')) {
      assert.equal((JSON.parse(line) as { itemId: string }).itemId, 'LESSON-a-lesson');
    }

    // Withheld: the file is not there at all.
    const without = buildBundle(box.root, box.ctx.config, { ...EXPORT_OPTS, history: false });
    assert.equal(paths(without).includes('history.jsonl'), false);
    assert.equal(without.report.historyRecords, 0);

    // Travelled, and there was none: the file is there and is empty. A
    // receiver can tell the two apart, which is the whole point of writing an
    // empty file rather than omitting it.
    const empty = buildBundle(box.root, box.ctx.config, {
      ...EXPORT_OPTS, filters: { type: 'adr' },
    });
    assert.ok(paths(empty).includes('history.jsonl'));
    assert.equal(text(empty, 'history.jsonl'), '');
    assert.equal(empty.report.historyRecords, 0);
  } finally { box.dispose(); }
});

// ---------------------------------------------------------------------------
// The manifest
// ---------------------------------------------------------------------------

test('the manifest covers every file except itself, every digest resolves, and it is '
  + 'the last file by its own bytes', () => {
  const box = sandbox();
  try {
    corpus(box);
    const b = buildBundle(box.root, box.ctx.config, PACK_OPTS);

    assert.equal(paths(b).at(-1), 'manifest.json');
    assert.deepEqual(b.manifest.files.map((f) => f.path),
      paths(b).filter((p) => p !== 'manifest.json'));
    assert.equal(b.manifest.itemCount, 4);
    assert.equal(b.manifest.kind, 'pack');
    assert.equal(b.manifest.name, 'acme security');
    assert.equal(b.manifest.createdAt, new Date(NOW).toISOString());

    assert.deepEqual(verifyManifest(b.manifest, b.files.filter((f) => f.path !== 'manifest.json')),
      { missing: [], extra: [], mismatched: [] });
    // The same call WITHOUT the caller-side filter the plan shows: it is
    // redundant, because `verifyManifest` drops `manifest.json` itself.
    assert.deepEqual(verifyManifest(b.manifest, b.files),
      { missing: [], extra: [], mismatched: [] });

    // The bytes in `files` are the manifest in `manifest`, not a second
    // rendering that could disagree with it.
    assert.deepEqual(parseManifest(Buffer.from(text(b, 'manifest.json'), 'utf8')), b.manifest);

    // One tampered byte is the failure the digest exists to name.
    const tampered = b.files.map((f) => (f.path === 'config.json'
      ? { path: f.path, bytes: Buffer.from(`${f.bytes.toString('utf8')} `, 'utf8') }
      : f));
    assert.deepEqual(verifyManifest(b.manifest, tampered),
      { missing: [], extra: [], mismatched: ['config.json'] });
  } finally { box.dispose(); }
});

test('two builds of one corpus at one instant are byte-identical, and only the '
  + 'manifest moves when the clock does', () => {
  const box = sandbox();
  try {
    corpus(box);
    const a = buildBundle(box.root, box.ctx.config, PACK_OPTS);
    const b = buildBundle(box.root, box.ctx.config, PACK_OPTS);
    assert.deepEqual(a.files.map((f) => [f.path, f.bytes.toString('hex')]),
      b.files.map((f) => [f.path, f.bytes.toString('hex')]));

    const later = buildBundle(box.root, box.ctx.config, { ...PACK_OPTS, now: NOW + 1000 });
    const moved = later.files
      .filter((f, i) => !f.bytes.equals(a.files[i].bytes))
      .map((f) => f.path);
    assert.deepEqual(moved, ['manifest.json']);
  } finally { box.dispose(); }
});

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

test('an item stored somewhere the artefact format cannot carry is refused, '
  + 'and the refusal names the item rather than the string', () => {
  const box = sandbox();
  try {
    corpus(box);
    relocate(box, 'items/rule/RULE-from-a-doc.md', 'items/rule/2026/RULE-from-a-doc.md');
    const message = refusalOf(() => buildBundle(box.root, box.ctx.config, EXPORT_OPTS));
    assert.match(message, /this export's file set is not one artefact's worth/);
    assert.match(message, /items\/rule\/2026\/RULE-from-a-doc\.md/);
    assert.match(message, /is not "items\/<type>\/<file>\.md"/);
    // The clause `buildManifest` cannot write, because it holds paths and not
    // items. Without it, deleting this module's own set check would leave the
    // manifest builder to throw and nothing would notice.
    assert.match(message, /That path is where item "RULE-from-a-doc" is stored\./);
    assert.match(message, /Nothing was written\.$/);
  } finally { box.dispose(); }
});

test('a hidden item file is refused, and is not quietly skipped', () => {
  const box = sandbox();
  try {
    corpus(box);
    relocate(box, 'items/rule/RULE-half-sourced.md', 'items/rule/.RULE-half-sourced.md');
    const message = refusalOf(() => buildBundle(box.root, box.ctx.config, EXPORT_OPTS));
    assert.match(message, /beginning with "\."/);
    assert.match(message, /That path is where item "RULE-half-sourced" is stored\./);
  } finally { box.dispose(); }
});

test('two item files that are one file on Windows are refused as a SET — the '
  + 'per-path check cannot see it', { skip: caseFoldingSkip() }, () => {
  const box = sandbox();
  try {
    createItem(box.ctx, { type: 'rule', title: 'lower', body: 'B' });
    createItem(box.ctx, { type: 'rule', title: 'upper', body: 'B' });
    relocate(box, 'items/rule/RULE-upper.md', 'items/RULE/RULE-upper.md');

    const message = refusalOf(() => buildBundle(box.root, box.ctx.config, EXPORT_OPTS));
    assert.match(message, /this export's file set is not one artefact's worth/);
    assert.match(message, /differ only by case/);
    // Neither path is illegal on its own, so there is no item to attribute
    // it to — the refusal already names both directories.
    assert.equal(message.includes('That path is where item'), false);
  } finally { box.dispose(); }
});

test('a pack with no name, and an export that carries one, are both refused '
  + 'by the one check that also guards the way back in', () => {
  const box = sandbox();
  try {
    corpus(box);
    assert.match(
      refusalOf(() => buildBundle(box.root, box.ctx.config, { ...PACK_OPTS, name: null })),
      /this pack's name is null, which is not a string/,
    );
    assert.match(
      refusalOf(() => buildBundle(box.root, box.ctx.config, { ...PACK_OPTS, version: '  ' })),
      /this pack's version is "  ", which is only whitespace/,
    );
    assert.match(
      refusalOf(() => buildBundle(box.root, box.ctx.config,
        { ...EXPORT_OPTS, name: 'acme' })),
      /"kind" is "export" and it carries a name of "acme"/,
    );
    assert.match(
      refusalOf(() => buildBundle(box.root, box.ctx.config, { ...PACK_OPTS, now: Number.NaN })),
      /stamped from a clock reading null, which is not a time/,
    );
  } finally { box.dispose(); }
});

test('an item the loader could not read is reported to the caller, not absorbed', () => {
  const box = sandbox();
  try {
    corpus(box);
    // A duplicate id: `loadLayer` keeps the first file and skips the second.
    copyFileSync(
      path.join(box.root, 'items', 'rule', 'RULE-from-a-doc.md'),
      path.join(box.root, 'items', 'standard', 'RULE-from-a-doc.md'),
    );
    writeFileSync(path.join(box.root, 'items', 'rule', 'broken.md'), '# no frontmatter\n');

    const errors: LoadError[] = [];
    const bundle = buildBundle(box.root, box.ctx.config, EXPORT_OPTS, errors);

    assert.deepEqual(errors.map((e) => e.file).toSorted(),
      ['items/rule/broken.md', 'items/standard/RULE-from-a-doc.md']);
    assert.ok(errors.some((e) => e.message.includes('duplicate id "RULE-from-a-doc"')));
    assert.ok(errors.some((e) => e.message.includes('no --- frontmatter block found')));
    // Neither reached the artefact, and neither is in `excluded` — an item
    // that failed to parse has no id to name there, which is why the loader's
    // own channel is the one that has to be handed back.
    assert.equal(paths(bundle).includes('items/standard/RULE-from-a-doc.md'), false);
    assert.equal(paths(bundle).includes('items/rule/broken.md'), false);
    assert.deepEqual(bundle.report.excluded, []);
    assert.equal(bundle.report.items, 4);
  } finally { box.dispose(); }
});

/**
 * `''` to run, or a sentence to skip by.
 *
 * The set-level rule is about two names that are ONE file on a
 * case-insensitive filesystem, and on such a filesystem the fixture cannot be
 * built: `items/rule/` and `items/RULE/` are the same directory, so the second
 * `mkdir` is the first one. The test is not deleted, because it is the only
 * thing that separates `refuseArtefactPaths` from `refuseArtefactPath` and it
 * runs on every case-sensitive checkout.
 */
function caseFoldingSkip(): string | false {
  const probe = mkdtempSync(path.join(tmpdir(), 'myctx-pack-casefold-'));
  try {
    writeFileSync(path.join(probe, 'casefold'), 'x');
    try {
      readFileSync(path.join(probe, 'CASEFOLD'));
      return 'this filesystem folds case, so two colliding item paths cannot both exist';
    } catch {
      return false;
    }
  } finally { removeTree(probe); }
}
