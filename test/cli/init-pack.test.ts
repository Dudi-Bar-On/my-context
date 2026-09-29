/**
 * `mycontext init --pack <path>` — founding a corpus from somebody else's
 * artefact, in one command.
 *
 * **What is only true at THIS seam, and is therefore what this file asserts.**
 * What an import does to a corpus belongs to `test/pack/import.test.ts`, the
 * buckets to `collide.test.ts`, and the two gates of `mycontext pack import`
 * to `test/cli/pack-import.test.ts`. Re-asserting any of those here would be a
 * second copy of a decision that already has an owner. Four things have no
 * other owner:
 *
 *  1. **`init` is dispatched before the workspace is resolved and receives no
 *     workspace at all.** It is the one bare command, so `--pack` cannot reach
 *     for a resolved config: it builds its own, and resolves the workspace
 *     only once the directory it just wrote exists.
 *  2. **`init` refuses every argument, and now accepts exactly one.** The
 *     refusal has to keep refusing everything else — `--global`, whose hint is
 *     the reason the hint table exists, and `--overwrite-changed`, which
 *     cannot mean anything on a corpus that does not exist yet.
 *  3. **A bad pack leaves NO `.my_context` behind.** `planImport` is pure, so
 *     everything it refuses is refused before a directory is created; a
 *     failure after that point removes the tree it made. This command's
 *     success line says "initialized", and this codebase does not print that
 *     for a half-built workspace.
 *  4. **One implementation behind both surfaces**, asserted rather than
 *     stated: the same artefact through `init --pack` and through `init` plus
 *     `pack import` produces one corpus, compared item by item.
 *
 * There is no confirmation on this path and no second gate, and both absences
 * are asserted here rather than only argued in the source. The user named the
 * pack on the command line of a command that CREATES a corpus, so there is
 * nothing yet to protect; and the `changed` bucket is empty by construction,
 * because a plan computed against a corpus that does not exist buckets every
 * arriving item `new`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { parseItem, renderItem, computeItemChecksum } from '../../src/core/item.ts';
import type { Item } from '../../src/core/types.ts';
import { writeBundleDirectory } from '../../src/pack/dir-writer.ts';
import {
  comparePaths, CONFIG_NAME, HISTORY_NAME, MANIFEST_NAME, PACK_HISTORY_PROTOCOL,
  type ExportFile,
} from '../../src/pack/layout.ts';
import { buildManifest, renderManifest, type ManifestMeta } from '../../src/pack/manifest.ts';
import { removeTree } from '../helpers/tmp.ts';

const PACK_NAME = 'acme-security';
const PACK_VERSION = '2026-08 rev 3';
/** One instant for every stamp in this file, so nothing here reads a clock. */
const FIXED_NOW = Date.parse('2026-08-20T09:12:44.031Z');

const STANDARD_ID = 'STD-commit-messages';
const LESSON_ID = 'LESSON-retry-with-backoff';

const scratch: string[] = [];

test.after(() => {
  for (const dir of scratch) removeTree(dir);
});

function scratchDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

/** Wrapping is a layout decision; a phrase assertion must not depend on it. */
function flat(out: string): string {
  return out.replace(/\s+/g, ' ');
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += `${s}\n`; });
  return { code, out };
}

/** A directory with no workspace in it and none above it. */
function empty(): string {
  return scratchDir('myctx-initpack-');
}

/** `.my_context` for a workspace directory. */
function rootOf(cwd: string): string {
  return path.join(cwd, '.my_context');
}

/** Every item file in a workspace, parsed, in id order. */
function itemsOf(cwd: string): Item[] {
  const dir = path.join(rootOf(cwd), 'items');
  if (!existsSync(dir)) return [];
  const out: Item[] = [];
  for (const entry of readdirSync(dir, { recursive: true })) {
    const relative = String(entry).replaceAll('\\', '/');
    if (!relative.endsWith('.md')) continue;
    const full = path.join(dir, relative);
    if (!statSync(full).isFile()) continue;
    out.push(parseItem(readFileSync(full, 'utf8'), `items/${relative}`, 'project'));
  }
  return out.toSorted((a, b) => comparePaths(a.id, b.id));
}

/** The workspace's `config.json`, as it is on disk. */
function rawConfigOf(cwd: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(rootOf(cwd), CONFIG_NAME), 'utf8'));
}

/** An item with its recorded checksum recomputed over its own content. */
function stamped(it: Item): Item {
  return { ...it, checksum: computeItemChecksum({ ...it, checksum: '' }) };
}

function itemFile(it: Item): ExportFile {
  return { path: it.filePath, bytes: Buffer.from(renderItem(it), 'utf8') };
}

function jsonFile(name: string, document: unknown): ExportFile {
  return { path: name, bytes: Buffer.from(`${JSON.stringify(document, null, 2)}\n`, 'utf8') };
}

function historyFile(rows: readonly unknown[]): ExportFile {
  return {
    path: HISTORY_NAME,
    bytes: Buffer.from(rows.map((r) => `${JSON.stringify(r)}\n`).join(''), 'utf8'),
  };
}

/** One complete `Item`, overridden field by field at each call site. */
function item(over: Partial<Item> = {}): Item {
  const base: Item = {
    id: STANDARD_ID,
    type: 'standard',
    title: 'Commit messages',
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
    validFrom: null,
    validUntil: null,
    checksum: '',
    extra: {},
    body: 'Write commit messages in the imperative.',
    steps: [],
    observations: [],
    relations: [],
    layer: 'project',
    filePath: '',
    ...over,
  };
  return stamped({ ...base, filePath: over.filePath ?? `items/${base.type}/${base.id}.md` });
}

/** Two mutation records, so the report has a history count to state. */
function packHistory(): unknown[] {
  return [STANDARD_ID, LESSON_ID].map((itemId, i) => ({
    protocol: PACK_HISTORY_PROTOCOL,
    at: new Date(Date.UTC(2026, 0, 2, 9, 0, i)).toISOString(),
    kind: 'mutation',
    op: 'create',
    origin: 'human',
    itemId,
  }));
}

const PACK_CATEGORIES = {
  rule: { enabled: true, prefix: 'RULE', scopePolicy: 'global' },
  lesson: { enabled: true, prefix: 'LESSON', scopePolicy: 'global' },
  standard: { enabled: true, prefix: 'STD', scopePolicy: 'global' },
};

interface PackShape {
  items?: Item[];
  categories?: Record<string, unknown>;
  history?: readonly unknown[];
  meta?: Partial<ManifestMeta>;
}

/** Writes one artefact directory and returns its path. */
function artefact(shape: PackShape = {}): string {
  const files: ExportFile[] = [
    ...(shape.items ?? []).map(itemFile),
    jsonFile(CONFIG_NAME, { categories: shape.categories ?? PACK_CATEGORIES }),
    historyFile(shape.history ?? packHistory()),
  ];
  const meta: ManifestMeta = {
    kind: 'pack', name: PACK_NAME, version: PACK_VERSION, now: FIXED_NOW, ...shape.meta,
  };
  const all = [...files, { path: MANIFEST_NAME, bytes: renderManifest(buildManifest(files, meta)) }]
    .toSorted((a, b) => comparePaths(a.path, b.path));
  const dir = path.join(scratchDir('myctx-initpacksrc-'), 'pack');
  writeBundleDirectory({ files: all }, dir);
  return dir;
}

/** The two items every good pack in this file carries. */
function newItems(): Item[] {
  return [
    item(),
    item({
      id: LESSON_ID, type: 'lesson', title: 'Retry with backoff',
      body: 'Retry with backoff.', tags: ['retry'],
    }),
  ];
}

function goodPack(): string {
  return artefact({ items: newItems() });
}

/* -------------------------------------------------------------------------- *
 * The argument surface — one flag accepted, everything else still refused
 * -------------------------------------------------------------------------- */

test('init still refuses every argument except --pack, and --global still gets its hint', () => {
  for (const args of [
    ['init', '--global'],
    ['init', '--nonsense-flag', 'zzz'],
    ['init', '../elsewhere'],
    ['init', '--global=true'],
    ['init', '--yes'],
  ]) {
    const cwd = empty();
    const { code, out } = run(args, cwd);
    assert.equal(code, 1, `\`${args.join(' ')}\` must not exit 0:\n${out}`);
    assert.equal(
      existsSync(rootOf(cwd)), false,
      `\`${args.join(' ')}\` created a workspace it said it refused to create`,
    );
    assert.doesNotMatch(out, /initialized/);
  }

  // The refusal names the one flag it does accept, or a user who mistyped
  // `--pack` learns only that they were wrong and never that they were close.
  assert.match(run(['init', '--nonsense-flag'], empty()).out, /--pack/);

  // ...and `--global` still earns the sentence naming where the global layer
  // actually is. That hint is the reason the hint table exists at all.
  const global = run(['init', '--global'], empty());
  assert.match(global.out, /no command creates one or writes to one/i);
});

test('--pack with no value is refused, and nothing is created', () => {
  for (const args of [['init', '--pack'], ['init', '--pack='], ['init', '--pack', '']]) {
    const cwd = empty();
    const { code, out } = run(args, cwd);
    assert.equal(code, 1, `\`${args.join(' ')}\` must not exit 0:\n${out}`);
    assert.match(out, /--pack/);
    assert.equal(existsSync(rootOf(cwd)), false, `\`${args.join(' ')}\` created a workspace`);
    assert.doesNotMatch(out, /initialized/);
  }
});

test('--overwrite-changed is refused on init, with a hint naming pack import', () => {
  // It cannot mean anything here — a corpus that does not exist has nothing to
  // overwrite — and accepting a flag that does nothing is the silent swallow
  // every other refusal in this file exists to stop.
  const cwd = empty();
  const { code, out } = run(['init', '--pack', goodPack(), '--overwrite-changed'], cwd);

  assert.equal(code, 1, out);
  assert.match(flat(out), /mycontext pack import/);
  assert.equal(existsSync(rootOf(cwd)), false);
  assert.doesNotMatch(out, /initialized/);
});

/* -------------------------------------------------------------------------- *
 * Nothing half-built, on any refusing path
 * -------------------------------------------------------------------------- */

test('a bad pack refuses and leaves NO .my_context behind', () => {
  const cwd = empty();
  // §6n.1: a pack may DEFINE a category and may never RE-TIER one that already
  // resolves here. `rule` is in the standard profile, so this is the refusal.
  const retierPack = artefact({
    items: newItems(),
    categories: { ...PACK_CATEGORIES, rule: { enabled: true, tier: 'rationale' } },
  });

  const { code, out } = run(['init', '--pack', retierPack], cwd);

  assert.equal(code, 1, out);
  assert.equal(existsSync(rootOf(cwd)), false);
  assert.equal(out.includes('initialized'), false);
  assert.match(out, /tier/);
});

// @basis TASK-release-phase-3-the-defects
/**
 * **Ruling C (2026-09-21): a full export is an archive to copy back, not
 * something this product imports.** Before task 3.11's phase 3 review this
 * refusal was reached by accident — a full export carries no pack name, and
 * `init --pack` caught THAT and pointed the reader at `mycontext init`
 * followed by `mycontext pack import <path> --name <text>`, the exact
 * `--name` override this same ruling closed on `pack import`'s own door the
 * same day. So the remedy `init --pack` printed led straight to a SECOND
 * refusal rather than the workspace it promised. `FULL_EXPORT_REFUSAL`
 * (`src/pack/import.ts`) is the one sentence every door a full export can
 * reach shares; this asserts `init --pack` says it too, completed with
 * "Nothing was created" — `init`'s own vocabulary — rather than the closed
 * workaround.
 */
test('a full export is refused with the shared ruling-C sentence, not the closed --name workaround', () => {
  const cwd = empty();
  const exported = artefact({ items: newItems(), meta: { kind: 'export', name: null, version: null } });

  const { code, out } = run(['init', '--pack', exported], cwd);

  assert.equal(code, 1, out);
  assert.match(flat(out), /a full export is an archive to copy back/);
  assert.match(flat(out), /mycontext export --as-pack/);
  assert.match(flat(out), /Nothing was created/);
  // The closed workaround must be gone, not merely joined by the new sentence.
  assert.doesNotMatch(flat(out), /mycontext pack import <path> --name/);
  assert.equal(existsSync(rootOf(cwd)), false);
});

// @basis TASK-a-pack-import-can-throw-after-overwriting-config-and, INV-nothing-is-dropped-silently
/**
 * An item whose category nothing declares is refused BEFORE the directory
 * exists — and this test used to pin the opposite.
 *
 * It was written when `planImport` did not type-check items against the config,
 * so this artefact reached `createItem` from inside the apply loop and failed
 * mid-apply, after `items/`, `config.json` and `.gitignore` were all on disk.
 * Its comment said so in as many words: *"the one failure that cannot be
 * refused by the pure half"*. That sentence described a defect
 * (`TASK-a-pack-import-can-throw-after-overwriting-config-and`) rather than a
 * property, and task 4.8 closed it: an item's type and its `extra` are both
 * knowable from the artefact and the catalogue alone, with no corpus and no
 * write, so `preflightCreates` (src/pack/import.ts) asks both in the pure half.
 *
 * **The wording assertion stays, and stays load-bearing.** The pre-flight
 * re-voices `resolveCategory`'s refusal through the same `enumError` helper
 * rather than composing a second sentence for one rule, so "You passed
 * <type>" is still what a person reads — and this line is what notices if the
 * two ever drift apart. What moved is WHEN it is printed, and that is what the
 * two assertions below it now pin: nothing on disk, and none of the
 * partial-write disclosure, which is the sentence a late failure prints and an
 * early one must not.
 *
 * The late path has its own test, immediately below.
 */
test('an item of an undeclared category is refused before the directory is created', () => {
  const cwd = empty();
  const undeclared = artefact({
    items: [item({ id: 'THREAT-token-replay', type: 'threat_model', title: 'Token replay' })],
    categories: {},
    history: [],
  });

  const { code, out } = run(['init', '--pack', undeclared], cwd);

  assert.equal(code, 1, out);
  assert.equal(
    existsSync(rootOf(cwd)), false,
    'a workspace that could not be founded must not be left half-built — the failure is the '
    + 'whole outcome, and "initialized" is not printed for a corpus that is not there',
  );
  assert.equal(out.includes('initialized'), false);
  assert.match(flat(out), /You passed "threat_model"/);
  // The refusal names the item it is about, which `createItem`'s own sentence
  // never did — it knew the type and not which file carried it.
  assert.match(flat(out), /"THREAT-token-replay" —/);
  // ...and it is the PLAN's refusal, not the apply's: nothing was written, so
  // none of the partial-write disclosure appears.
  assert.match(flat(out), /nothing was imported and nothing was written/);
  assert.doesNotMatch(flat(out), /WAS changed/);
  assert.doesNotMatch(flat(out), /WRITTEN: config\.json/);
});

// @basis TASK-a-pack-import-can-throw-after-overwriting-config-and, INV-nothing-is-dropped-silently
/**
 * A failure `planImport` genuinely cannot pre-flight, and the one sentence
 * `init --pack` must NOT print.
 *
 * `applyImport`'s partial-write disclosure ends with a route out — `pack list`
 * names the pack, `review promote --all --pack` reaches the drafts that landed
 * — because on `mycontext pack import` that is true: the workspace was there
 * before and whatever landed is in it afterwards. On THIS surface it is false.
 * `cmdInit` removes the whole tree it had just created, so both commands would
 * name a corpus that is no longer on disk, printed one line above init's own
 * accurate "nothing was created". Two sentences, one of them wrong, is the
 * defect `INV-nothing-is-dropped-silently` is written against in the other
 * direction; the caller therefore tells `applyImport` that it does not keep
 * what landed, and the route is printed only where there is one.
 *
 * What the disclosure still says on both surfaces is what was written and what
 * was not. That is the invariant, and it is not conditional on anything.
 *
 * The fixture is a pack DEFINING a category with `scopePolicy: "required"` and
 * an item of it carrying no scope glob: `refusePackConfig` permits every part
 * of that, and the refusal comes from `createItem` after the merged config has
 * been written — which is what makes this the late path and not a second copy
 * of the test above.
 */
test('a late failure prints what was written, and NOT a route into a workspace being removed', () => {
  const cwd = empty();
  const unscoped = artefact({
    // File order is what the reader hands over, so `items/lesson/…` is created
    // and `items/playbook/…` is the one that refuses — a genuine prefix, which
    // is the state this disclosure exists to describe.
    items: [
      item({
        id: LESSON_ID, type: 'lesson', title: 'Retry with backoff',
        body: 'Retry with backoff.',
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
    history: [],
  });

  const { code, out } = run(['init', '--pack', unscoped], cwd);

  assert.equal(code, 1, out);
  assert.equal(existsSync(rootOf(cwd)), false, 'the tree init created must be removed');
  assert.equal(out.includes('initialized'), false);
  // It IS the late path: the refusal is `createItem`'s, reached only from
  // `applyImport`, and the disclosure says the config was adopted.
  assert.match(flat(out), /scopePolicy "required"/);
  assert.match(flat(out), /WRITTEN: config\.json/);
  // ...and it names what landed and what did not, on this surface too.
  assert.match(flat(out), new RegExp(`1 of 2 new item\\(s\\) were created as drafts \\("${LESSON_ID}"\\)`));
  assert.match(flat(out), /NOT WRITTEN: 1 item\(s\) the pack carries \("PLAY-run-the-drill"\)/);
  // The route out is the sentence that would be false here, so it is absent —
  // and init's own tail is the one sentence about what is on disk.
  assert.doesNotMatch(flat(out), /WHERE TO GO/);
  assert.doesNotMatch(flat(out), /pack list/);
  assert.doesNotMatch(flat(out), /review promote --all --pack/);
  // Nor the headline that would contradict the tail one line below it.
  assert.doesNotMatch(flat(out), /WAS changed/);
  assert.match(flat(out), /nothing was created/i);
});

/* -------------------------------------------------------------------------- *
 * What a good pack founds
 * -------------------------------------------------------------------------- */

test('a good pack founds a corpus whose every item is a draft', () => {
  const cwd = empty();
  const { code, out } = run(['init', '--pack', goodPack()], cwd);

  assert.equal(code, 0, out);
  assert.match(out, /initialized/);
  // The report prints, so the user can see what arrived, and the outcome
  // points at the one act that makes a forty-item queue tractable.
  assert.match(out, new RegExp(`pack: ${PACK_NAME}`));
  assert.match(flat(out), new RegExp(`review promote --all --pack ${PACK_NAME}`));

  const items = itemsOf(cwd);
  assert.deepEqual(items.map((i) => i.id), [LESSON_ID, STANDARD_ID].toSorted(comparePaths));
  assert.equal(items.every((i) => i.status === 'draft'), true, 'an item did not land a draft');
});

test('a pack that DEFINES a category founds a corpus that can resolve its own config', () => {
  // §6n.1's whole point, at the surface where it matters most: `init --pack`
  // is the path with no existing vocabulary to fall back on, so a config
  // written after the creates would refuse every item as an unknown type.
  const cwd = empty();
  const vocabPack = artefact({
    items: [item({ id: 'THREAT-token-replay', type: 'threat_model', title: 'Token replay' })],
    categories: {
      threat_model: {
        enabled: true, tier: 'normative', prefix: 'THREAT',
        description: 'A modelled attack and what stops it',
      },
    },
    history: [],
  });

  const { code, out } = run(['init', '--pack', vocabPack], cwd);

  assert.equal(code, 0, out);
  assert.doesNotThrow(() => resolveConfig(rawConfigOf(cwd)));
  const items = itemsOf(cwd);
  assert.deepEqual(items.map((i) => i.type), ['threat_model']);
  assert.equal(items.every((i) => i.status === 'draft'), true);
});

test('the config is the init default MERGED with the pack, so budgets survive', () => {
  const cwd = empty();
  assert.equal(run(['init', '--pack', goodPack()], cwd).code, 0);

  const raw = rawConfigOf(cwd) as {
    profile?: string; budgets?: unknown; categories: Record<string, { enabled?: boolean }>;
  };
  assert.equal(raw.profile, 'standard');
  assert.equal(Object.hasOwn(raw, 'budgets'), true, 'the init default `budgets` did not survive');
  assert.equal(raw.categories.rule.enabled, true);
});

test('the same pack through init --pack and through pack import produces the same corpus', () => {
  // The "one implementation behind both surfaces" claim, asserted rather than
  // stated: two workspaces, two commands, one deepEqual over the parsed items.
  const source = goodPack();
  const fromInit = empty();
  const fromImport = empty();

  assert.equal(run(['init', '--pack', source], fromInit).code, 0);
  assert.equal(run(['init'], fromImport).code, 0);
  const imported = run(['pack', 'import', source, '--yes'], fromImport);
  assert.equal(imported.code, 0, imported.out);

  assert.deepEqual(itemsOf(fromInit), itemsOf(fromImport));
  // ...and the same vocabulary, which is the other half of what an import is.
  assert.deepEqual(rawConfigOf(fromInit), rawConfigOf(fromImport));
});

test('--pack still works inside a directory whose ANCESTOR workspace has a corrupt config', () => {
  // The reason `init` is the one bare command, exercised rather than restated:
  // `resolveWorkspace` throws on a config.json it cannot parse, so an `init`
  // dispatched after it would trade "create the workspace here" for an error
  // about a file the user may not know exists. `--pack` does resolve a
  // workspace — but only AFTER writing its own `.my_context`, which is then
  // the nearest one, so the broken ancestor is never read.
  const parent = empty();
  assert.equal(run(['init'], parent).code, 0);
  writeFileSync(path.join(rootOf(parent), CONFIG_NAME), '{ not json at all', 'utf8');
  const child = path.join(parent, 'nested');
  mkdirSync(child, { recursive: true });

  const { code, out } = run(['init', '--pack', goodPack()], child);

  assert.equal(code, 0, out);
  assert.equal(itemsOf(child).length, 2);
  assert.doesNotMatch(out, /not valid JSON/);
});

test('an ancestor-workspace shadowing warning still prints, before the pack report', () => {
  const parent = empty();
  assert.equal(run(['init'], parent).code, 0);
  const child = path.join(parent, 'nested');
  mkdirSync(child, { recursive: true });

  const { code, out } = run(['init', '--pack', goodPack()], child);

  assert.equal(code, 0, out);
  const warning = out.indexOf('an existing workspace was found at');
  const report = out.indexOf(`pack: ${PACK_NAME}`);
  assert.ok(warning >= 0, `the shadowing warning did not print:\n${out}`);
  assert.ok(
    report > warning,
    `the shadowing warning must come first — which workspace the pack landed in is the fact `
    + `the report is about:\n${out}`,
  );
});
