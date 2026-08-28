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
    continuity: false,
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

test('an artefact that carries no pack name is refused, pointing at pack import --name', () => {
  // A full export has no name, and there is nothing here to file its history
  // and its membership list under. `init` takes no `--name`, so the honest
  // answer is the command that does — not a name invented on the user's behalf.
  const cwd = empty();
  const exported = artefact({ items: newItems(), meta: { kind: 'export', name: null, version: null } });

  const { code, out } = run(['init', '--pack', exported], cwd);

  assert.equal(code, 1, out);
  assert.match(flat(out), /mycontext pack import/);
  assert.match(flat(out), /--name/);
  assert.equal(existsSync(rootOf(cwd)), false);
});

test('a failure AFTER the directory exists leaves no half-built workspace, and says why', () => {
  // The one failure that cannot be refused by the pure half: an item whose
  // category nothing declares reaches `createItem`, which resolves the type
  // out of the config and refuses it. `planImport` does not type-check items
  // against the config, so this fails mid-apply — after `items/`,
  // `config.json` and `.gitignore` are all on disk.
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
  // The failure is `createItem`'s own category refusal, which is only
  // reachable from `applyImport` — i.e. AFTER the three writes. Matching it
  // is what keeps this test about the late path rather than passing on any
  // refusal at all.
  assert.match(flat(out), /You passed "threat_model"/);
  // ...and the second line, which is the one a half-built workspace could not
  // say for itself.
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
