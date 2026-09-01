/**
 * `mycontext pack import` and `mycontext pack list` — the command surface over
 * `planImport`/`applyImport`, and the two gates §6n.7 asks for.
 *
 * **What this file is for, and what it leaves to `test/pack/`.** What an
 * import DOES to a corpus is `test/pack/import.test.ts`'s subject, the buckets
 * are `collide.test.ts`'s and the artefact format is `reader.test.ts`'s.
 * Re-asserting any of those here would be a second copy of a decision that
 * already has an owner. What is only true at this seam is asserted here:
 *
 *  1. **The collision report prints before the confirmation, on every path** —
 *     including the non-interactive one, where the refusal would otherwise
 *     never say what it declined.
 *  2. **The two gates are separate acts, and `--yes` reaches only the first.**
 *     `confirmAction` returns true on `--yes` by design, which is exactly
 *     right for the import and exactly wrong for the overwrite: `--yes` is
 *     consent to the import the user described, not to replacing a rule they
 *     wrote. The assertion that holds that apart is `--yes` alone leaving
 *     every changed item byte-identical.
 *  3. **Declining the second gate is not an error and does not abort the
 *     first.** The new items still land; the changed ones are reported and
 *     skipped, which is §6n.7's own wording for what declining means.
 *  4. **Every id an approval would replace is named**, because a bare count is
 *     not a warning — it is a number a user cannot check anything against.
 *
 * The prompts are driven through `cmdPack` directly rather than through
 * `runCli`, because stdin is not a TTY under `node --test` and the ORDER of
 * the two questions is the property under test. `runCli` covers everything
 * the flags can reach on their own.
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
import { cmdPack } from '../../src/cli/commands/pack.ts';
import { computeItemChecksum, parseItem, renderItem } from '../../src/core/item.ts';
import type { Item } from '../../src/core/types.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { writeBundleDirectory } from '../../src/pack/dir-writer.ts';
import { importedDir } from '../../src/pack/imported-audit.ts';
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

const RULE_ID = 'RULE-never-log-customer-email';
const STANDARD_ID = 'STD-commit-messages';
const LESSON_ID = 'LESSON-retry-with-backoff';
const LOCAL_BODY = 'Do not log the customer email.';
const INCOMING_BODY = 'Never log the customer email, on any endpoint.';

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

/**
 * `mycontext pack …` with a TTY and scripted answers.
 *
 * The questions are collected off the output rather than out of a spy, so what
 * is asserted is what a person would have been asked, in the order they would
 * have been asked it.
 */
function driven(
  args: string[], cwd: string, answers: string[],
): { code: number; out: string; questions: string[] } {
  const lines: string[] = [];
  const pending = [...answers];
  const code = cmdPack(
    resolveWorkspace(cwd), args, (s) => lines.push(s), cwd,
    true,
    () => pending.shift() ?? '',
  );
  const out = lines.join('\n');
  return { code, out, questions: lines.filter((l) => l.includes('[y/N]')) };
}

/** Which gate a question belongs to, by what it asks about. */
function gateOf(question: string): string {
  return /overwrite/i.test(question) ? 'overwrite' : 'import';
}

/**
 * A workspace holding one ACTIVE governing rule — the item a pack collides
 * with, and the one a `--yes` alone must leave exactly as it is.
 */
function project(): string {
  const cwd = scratchDir('myctx-packcli-');
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  assert.equal(
    runCli(
      ['add', 'rule', 'Never log customer email', '--body', LOCAL_BODY, '--yes'],
      cwd, () => {},
    ),
    0,
  );
  return cwd;
}

/** Every item file in a workspace, parsed. */
function itemsOf(cwd: string): Item[] {
  const dir = path.join(cwd, '.my_context', 'items');
  if (!existsSync(dir)) return [];
  const out: Item[] = [];
  for (const entry of readdirSync(dir, { recursive: true })) {
    const relative = String(entry).replaceAll('\\', '/');
    if (!relative.endsWith('.md')) continue;
    const full = path.join(dir, relative);
    if (!statSync(full).isFile()) continue;
    out.push(parseItem(readFileSync(full, 'utf8'), `items/${relative}`, 'project'));
  }
  return out;
}

function itemOf(cwd: string, id: string): Item {
  const found = itemsOf(cwd).find((i) => i.id === id);
  assert.ok(found, `${id} is not in the corpus at ${cwd}`);
  return found;
}

/** `.my_context` for a workspace directory. */
function rootOf(cwd: string): string {
  return path.join(cwd, '.my_context');
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
  const dir = path.join(scratchDir('myctx-packsrc-'), 'pack');
  writeBundleDirectory({ files: all }, dir);
  return dir;
}

/** The two items no local corpus here holds. */
function newItems(): Item[] {
  return [
    item(),
    item({
      id: LESSON_ID, type: 'lesson', title: 'Retry with backoff',
      body: 'Retry with backoff.', tags: ['retry'],
    }),
  ];
}

/**
 * A pack that collides with the workspace's own rule in `body` alone.
 *
 * The colliding item is built FROM the local file rather than beside it, so
 * the only field that can differ is the one this test is about — a fixture
 * that also drifted in `severity` would be testing a different bucket entry
 * and would still pass.
 */
function collidingPack(cwd: string): string {
  const local = itemOf(cwd, RULE_ID);
  return artefact({ items: [...newItems(), stamped({ ...local, body: INCOMING_BODY })] });
}

/** The same fixture every F2 test in this suite plants. */
function plantUnrelatedCorruptItem(cwd: string): void {
  mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
  writeFileSync(
    path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-broken.md'),
    'no frontmatter here\n',
  );
}

/* -------------------------------------------------------------------------- *
 * The argument surface
 * -------------------------------------------------------------------------- */

test('an unknown subcommand is refused with the usage block', () => {
  const cwd = project();
  const { code, out } = run(['pack', 'inport', artefact({ items: newItems() })], cwd);

  assert.equal(code, 1);
  assert.match(out, /unknown pack subcommand "inport"/);
  assert.match(out, /usage: mycontext pack import <path>/);
  assert.match(out, /mycontext pack list/);
  assert.equal(existsSync(importedDir(rootOf(cwd))), false);
});

test('a flag legal on import is refused on list — including --overwrite-changed', () => {
  const cwd = project();
  // Per-subcommand tables, not one union: a `--yes` on `list` is meaningless
  // and accepting it is the silent swallow the unknown-flag check exists to
  // stop.
  for (const flag of ['--yes', '--dry-run', '--overwrite-changed', '--name']) {
    const { code, out } = run(['pack', 'list', flag], cwd);
    assert.equal(code, 1, `\`pack list ${flag}\` exited ${code}:\n${out}`);
    assert.match(out, new RegExp(`unknown option "${flag}"`));
  }
  // The other half: a refusal that refuses everything is not a fix.
  assert.equal(run(['pack', 'list', '--json'], cwd).code, 0);
});

test('pack import refuses a path it was not given, before anything is read', () => {
  const cwd = project();
  const { code, out } = run(['pack', 'import'], cwd);

  assert.equal(code, 1);
  assert.match(out, /usage: mycontext pack import <path>/);
  assert.equal(existsSync(importedDir(rootOf(cwd))), false);
});

/* -------------------------------------------------------------------------- *
 * The report, and the first gate
 * -------------------------------------------------------------------------- */

test('the collision report prints before the confirmation, and on the non-interactive path too', () => {
  const cwd = project();
  const { code, out } = run(['pack', 'import', collidingPack(cwd)], cwd);

  assert.equal(code, 1);
  const report = out.indexOf(`pack: ${PACK_NAME}`);
  const declined = out.indexOf('refusing without confirmation');
  assert.ok(report >= 0, `the collision report did not print:\n${out}`);
  assert.ok(
    declined > report,
    'the refusal must come after the report — a non-interactive refusal that never says what '
    + `it declined is the whole reason the report prints regardless of --yes:\n${out}`,
  );
});

test('declining the FIRST confirmation writes nothing at all', () => {
  const cwd = project();
  const before = itemsOf(cwd).map((i) => i.id).sort();

  const declined = driven(['import', collidingPack(cwd)], cwd, ['n']);

  assert.equal(declined.code, 1);
  assert.equal(declined.questions.length, 1, declined.out);
  assert.deepEqual(itemsOf(cwd).map((i) => i.id).sort(), before);
  assert.equal(existsSync(importedDir(rootOf(cwd))), false);
});

test('--dry-run prints the report and writes nothing, and the json says applied: false', () => {
  const cwd = project();
  const source = collidingPack(cwd);
  const before = itemsOf(cwd).map((i) => i.id).sort();

  const text = run(['pack', 'import', source, '--dry-run'], cwd);
  assert.equal(text.code, 0);
  assert.match(text.out, new RegExp(`pack: ${PACK_NAME}`));
  assert.deepEqual(itemsOf(cwd).map((i) => i.id).sort(), before);
  assert.equal(existsSync(importedDir(rootOf(cwd))), false);

  const json = run(['pack', 'import', source, '--dry-run', '--json'], cwd);
  assert.equal(json.code, 0);
  const document = JSON.parse(json.out) as { applied: boolean; overwriteApproved: boolean };
  assert.equal(document.applied, false);
  assert.equal(document.overwriteApproved, false);
  assert.deepEqual(itemsOf(cwd).map((i) => i.id).sort(), before);
});

test('a successful import lands every item draft and points at the bulk promote', () => {
  const cwd = project();
  const { code, out } = run(['pack', 'import', artefact({ items: newItems() }), '--yes'], cwd);

  assert.equal(code, 0, out);
  assert.match(flat(out), new RegExp(`review promote --all --pack ${PACK_NAME}`));
  for (const id of [STANDARD_ID, LESSON_ID]) {
    assert.equal(itemOf(cwd, id).status, 'draft', `${id} did not land a draft`);
  }
});

/* -------------------------------------------------------------------------- *
 * §6n.7: the second gate
 * -------------------------------------------------------------------------- */

test('the overwrite prompt is asked only after the import prompt, and only when changed is non-empty', () => {
  // Two packs, one with a changed bucket and one without: the second must ask
  // exactly one question. A prompt that appears when there is nothing to
  // approve trains the reflex the gate depends on.
  const noChanges = project();
  const withChanges = project();

  const clean = driven(['import', artefact({ items: newItems() })], noChanges, ['y']);
  const collide = driven(['import', collidingPack(withChanges)], withChanges, ['y', 'y']);

  assert.equal(clean.code, 0, clean.out);
  assert.equal(collide.code, 0, collide.out);
  assert.equal(clean.questions.length, 1, clean.questions.join('\n'));
  assert.deepEqual(collide.questions.map(gateOf), ['import', 'overwrite']);
});

test('--yes alone imports the new items and leaves every changed item untouched', () => {
  // §6n.7: approval is explicit and SEPARATE from choosing the pack, and
  // --yes is consent to the import the user described, not to replacing a
  // rule they wrote. This is the assertion the flag design exists to make.
  const cwd = project();
  const before = itemOf(cwd, RULE_ID);

  const { code, out } = run(['pack', 'import', collidingPack(cwd), '--yes'], cwd);

  assert.equal(code, 0, out);
  assert.deepEqual(itemOf(cwd, RULE_ID), before);
  assert.match(out, /left exactly as they are/);
  for (const id of [STANDARD_ID, LESSON_ID]) assert.equal(itemOf(cwd, id).status, 'draft');

  const fresh = project();
  const json = run(['pack', 'import', collidingPack(fresh), '--yes', '--json'], fresh);
  assert.equal(json.code, 0, json.out);
  const document = JSON.parse(json.out) as { overwriteApproved: boolean; overwritten: string[] };
  assert.equal(document.overwriteApproved, false);
  assert.deepEqual(document.overwritten, []);
});

test('--yes --overwrite-changed replaces the changed items and says which', () => {
  const cwd = project();

  const { code, out } = run(
    ['pack', 'import', collidingPack(cwd), '--yes', '--overwrite-changed'], cwd,
  );

  assert.equal(code, 0, out);
  assert.equal(itemOf(cwd, RULE_ID).body.trim(), INCOMING_BODY);
  assert.match(flat(out), /overwrote 1 item/);
  assert.match(flat(out), new RegExp(`mycontext audit --item ${RULE_ID}`));
  // §6m.5 still holding: an overwritten item is a draft, not a governing item
  // whose text a stranger just replaced.
  assert.equal(itemOf(cwd, RULE_ID).status, 'draft');
});

test('declining ONLY the overwrite still imports the new items', () => {
  // §6n.7: declining leaves the changed items reported and skipped. It does
  // not abandon the import the user already confirmed.
  const cwd = project();
  const before = itemOf(cwd, RULE_ID);

  const { code, out, questions } = driven(['import', collidingPack(cwd)], cwd, ['y', 'n']);

  assert.equal(code, 0, out);
  assert.deepEqual(questions.map(gateOf), ['import', 'overwrite']);
  for (const id of [STANDARD_ID, LESSON_ID]) assert.equal(itemOf(cwd, id).status, 'draft');
  assert.deepEqual(itemOf(cwd, RULE_ID), before);
  assert.match(out, /left exactly as they are/);
});

test('the printed warning names every id it would overwrite, and no bare count stands alone', () => {
  const cwd = project();
  const { out } = run(['pack', 'import', collidingPack(cwd), '--dry-run'], cwd);

  for (const id of [RULE_ID]) assert.ok(out.includes(id), `${id} is not named:\n${out}`);
  assert.doesNotMatch(out, /items will be replaced\.?$/m);
});

test('--overwrite-changed on a pack with no changed items is accepted and does nothing', () => {
  // Refusing it would make the flag unusable in a script that imports the
  // same pack repeatedly — the case §6d's "updating means importing again"
  // is entirely about.
  const cwd = project();
  const source = artefact({ items: newItems() });

  const { code, out } = run(
    ['pack', 'import', source, '--yes', '--overwrite-changed', '--json'], cwd,
  );

  assert.equal(code, 0, out);
  assert.deepEqual((JSON.parse(out) as { overwritten: string[] }).overwritten, []);
});

/* -------------------------------------------------------------------------- *
 * §6n.1, and what `pack list` remembers
 * -------------------------------------------------------------------------- */

test('importing a pack that RETIERS an existing category refuses and says why, nothing written', () => {
  const cwd = project();
  const before = itemsOf(cwd).map((i) => i.id).sort();
  const retier = artefact({
    items: newItems(),
    categories: { ...PACK_CATEGORIES, rule: { enabled: true, tier: 'rationale' } },
  });

  const { code, out } = run(['pack', 'import', retier, '--yes'], cwd);

  assert.equal(code, 1);
  assert.match(out, /tier/);
  assert.deepEqual(itemsOf(cwd).map((i) => i.id).sort(), before);
  assert.equal(existsSync(importedDir(rootOf(cwd))), false);
});

test('importing a pack that DEFINES a category succeeds, and pack list shows it', () => {
  const cwd = project();
  const source = artefact({
    items: [item({ id: 'THREAT-token-replay', type: 'threat_model', title: 'Token replay' })],
    categories: {
      threat_model: {
        enabled: true, tier: 'normative', prefix: 'THREAT',
        description: 'A modelled attack and what stops it',
      },
    },
    history: [],
  });

  const imported = run(['pack', 'import', source, '--yes'], cwd);
  assert.equal(imported.code, 0, imported.out);
  assert.equal(itemOf(cwd, 'THREAT-token-replay').type, 'threat_model');

  const listed = run(['pack', 'list'], cwd);
  assert.equal(listed.code, 0, listed.out);
  assert.match(listed.out, new RegExp(PACK_NAME));
});

test('pack list names every pack imported here, with its version and item count', () => {
  const cwd = project();
  assert.match(run(['pack', 'list'], cwd).out, /no packs/i);

  assert.equal(run(['pack', 'import', artefact({ items: newItems() }), '--yes'], cwd).code, 0);

  const { code, out } = run(['pack', 'list'], cwd);
  assert.equal(code, 0, out);
  assert.match(out, new RegExp(PACK_NAME));
  assert.match(out, new RegExp(PACK_VERSION.replace(/\s/g, '\\s')));

  const json = run(['pack', 'list', '--json'], cwd);
  // The document carries the record as it was written — the membership list
  // included, because that is what a script promoting a pack's drafts reads.
  const document = JSON.parse(json.out) as {
    packs: { pack: string; version: string; items: string[] }[];
  };
  assert.deepEqual(
    document.packs.map((p) => [p.pack, p.version, p.items.length]),
    [[PACK_NAME, PACK_VERSION, 2]],
  );
  assert.deepEqual(document.packs[0].items.toSorted(), [LESSON_ID, STANDARD_ID].toSorted());
});

/**
 * The plan's own test, and for a long time it could not be written as it is
 * worded here.
 *
 * An import used to be filed under the pack's NAME alone, so a second pack
 * calling itself `acme-security` wrote its `import.json` over the first one's:
 * one row in `pack list`, one membership list, and the earlier one gone with
 * nobody told. `--name` was the only thing that kept two apart, so this test
 * had to pass `--name acme-security-b` and assert something narrower than what
 * it says. An import is now keyed on the name AND the artefact location this
 * workspace read it from, so the sentence and the assertions are the same
 * thing again: neither import here passes `--name`.
 *
 * `--name` still exists and still keeps two packs apart BY NAME, which is a
 * different job — it is what a receiver reaches for when it wants to tell them
 * apart in a list rather than merely have both of them kept. Its own gates have
 * their own tests below.
 */
test('two imports of packs with the same name are kept apart, and list shows both', () => {
  const cwd = project();
  const first = artefact({ items: newItems() });
  const second = artefact({
    items: [item({ id: 'STD-branch-names', title: 'Branch names', body: 'Name branches well.' })],
  });

  const one = run(['pack', 'import', first, '--yes'], cwd);
  assert.equal(one.code, 0, one.out);
  // The first import's next step is the plain form: this name names one record.
  assert.match(flat(one.out), /review promote --all --pack acme-security`,/);

  const two = run(['pack', 'import', second, '--yes'], cwd);
  assert.equal(two.code, 0, two.out);
  // The second one's is not, and it says why: `--pack` alone would now be
  // refused, and a next step the same build refuses is worse than none.
  assert.match(flat(two.out), /--pack acme-security --source /);
  assert.match(flat(two.out), /calls itself "acme-security" too/);
  // ...and the command it prints is on ONE line, because it is meant to be
  // copied: a next step wrapped in half is a next step that does not run.
  const copyable = two.out.split('\n').filter((l) => l.includes('review promote --all'));
  assert.equal(copyable.length, 1, two.out);
  assert.ok(
    copyable[0].trimEnd().endsWith(second),
    `the printed command does not end in the source it names: ${copyable[0]}`,
  );

  const json = run(['pack', 'list', '--json'], cwd);
  const document = JSON.parse(json.out) as {
    packs: { pack: string; source: string; items: string[] }[];
  };
  assert.deepEqual(document.packs.map((p) => p.pack), [PACK_NAME, PACK_NAME]);
  // Two records, two sources, two membership lists: the second import did not
  // land on top of the first one's record, which is the whole of "kept apart".
  assert.equal(new Set(document.packs.map((p) => p.source)).size, 2);
  // As a SET: two records under one name are ordered by the directory their
  // origin names, which is a digest and therefore not import order. The row a
  // reader tells them apart by is `imported`, which the table prints.
  assert.deepEqual(
    document.packs.map((p) => p.items.toSorted().join(' ')).toSorted(),
    [[LESSON_ID, STANDARD_ID].toSorted().join(' '), 'STD-branch-names'].toSorted(),
  );
  // ...and the table a person reads shows both rows, not one.
  const listed = run(['pack', 'list'], cwd);
  assert.match(listed.out, /2 pack\(s\) imported here/);

  // The SAME artefact again is the same import, not a third row: it updates
  // the record it already has. Re-import must not become duplication.
  assert.equal(run(['pack', 'import', second, '--yes'], cwd).code, 0);
  const again = JSON.parse(run(['pack', 'list', '--json'], cwd).out) as { packs: unknown[] };
  assert.equal(again.packs.length, 2, 're-importing one pack filed a second record for it');
});

test('a second pack of the same name leaves the first one\'s directory alone', () => {
  const cwd = project();
  assert.equal(run(['pack', 'import', artefact({ items: newItems() }), '--yes'], cwd).code, 0);
  const dir = path.join(importedDir(rootOf(cwd)), 'acme-security');
  const firstLeaf = readdirSync(dir).filter((e) => e !== '.gitignore');
  assert.equal(firstLeaf.length, 1, 'one import, one directory under the name');

  assert.equal(run(['pack', 'import', artefact({
    items: [item({ id: 'STD-branch-names', title: 'Branch names', body: 'Name branches well.' })],
  }), '--yes'], cwd).code, 0);

  const both = readdirSync(dir).filter((e) => e !== '.gitignore');
  assert.equal(both.length, 2, 'the second import did not take a directory of its own');
  assert.ok(both.includes(firstLeaf[0]), 'the first import\'s directory was renamed or removed');
  // The two histories are two files, so no reader has to tell one stranger's
  // mutation log from another's inside a single one.
  for (const leaf of both) {
    const history = readFileSync(path.join(dir, leaf, HISTORY_NAME), 'utf8').trim().split('\n');
    assert.equal(history.length, 2, `${leaf} holds a history that is not its own`);
  }
});

/* -------------------------------------------------------------------------- *
 * The --name override, which is a name a stranger's artefact suggested and an
 * operator retyped — and which reaches a terminal
 * -------------------------------------------------------------------------- */

/**
 * `--name` is the one pack name no guard used to see.
 *
 * `planImport` screens the MANIFEST's name and version (`pack/import.ts` step
 * 3) and `parseManifest` puts the manifest's name through `refusePackName`
 * before that. `--name` replaces the screened value AFTER both have run, and
 * the replacement is what every surface then prints: the collision report's
 * `pack:` line, the confirmation question, the outcome sentence, the
 * `.audit/imported/<slug>/import.json` record and `pack list`.
 *
 * Measured before this gate existed, and both exited 0:
 *
 *   --name "acme<U+202E>drowssap-ytiruces"  printed verbatim into `pack:`,
 *       into the outcome line and into the `pack list` table, and written
 *       verbatim into `import.json`;
 *   --name "acme-security\nmy_context: 12 item(s) promoted and now govern."
 *       forged a whole second line of the report, which then read as one of
 *       this product's own outcome sentences.
 *
 * So the assertions here are about the DOOR, not about the two guards, which
 * have their own tests: `test/pack/screen.test.ts` owns the screened table and
 * `test/pack/manifest.test.ts` owns `refusePackName`'s rules. What is only
 * true at this seam is that the override is put through both of them, that it
 * is put through them BEFORE anything is written or printed, and that the
 * refusal does not carry the attack into the sentence complaining about it.
 */
const RLO = '‮';

/** Nothing landed: no items, no membership record, no pack directory. */
function nothingImported(cwd: string): void {
  assert.deepEqual(
    itemsOf(cwd).map((i) => i.id), [RULE_ID],
    'the import was refused, so the corpus must still hold only its own rule',
  );
  const imported = importedDir(rootOf(cwd));
  const filed = existsSync(imported)
    ? readdirSync(imported).filter((e) => e !== '.gitignore')
    : [];
  assert.deepEqual(filed, [], 'a refused import filed a pack directory');
}

test('--name carrying U+202E is refused, and the refusal does not carry the override', () => {
  const cwd = project();
  const hostile = `acme${RLO}drowssap-ytiruces`;

  const { code, out } = run(
    ['pack', 'import', artefact({ items: newItems() }), '--yes', '--name', hostile], cwd,
  );

  assert.equal(code, 1, out);
  // The screen's own words, so the reason is the screen's and not a second
  // sentence written here that could disagree with it.
  assert.match(out, /U\+202E/);
  assert.match(flat(out), /the pack name/);
  assert.match(out, /--name/);
  // The whole point: a refusal that interpolated the value would be reordered
  // by the very control it is complaining about.
  assert.equal(
    out.includes(RLO), false,
    `the refusal printed U+202E itself: ${JSON.stringify(out)}`,
  );
  nothingImported(cwd);
});

test('--name carrying an embedded newline is refused, and forges no second line', () => {
  const cwd = project();
  const forged = 'my_context: 12 item(s) promoted and now govern.';
  const hostile = `acme-security\n${forged}`;

  const { code, out } = run(
    ['pack', 'import', artefact({ items: newItems() }), '--yes', '--name', hostile], cwd,
  );

  assert.equal(code, 1, out);
  // `refusePackName`'s rule, in its own words: the name is printed as ONE line.
  assert.match(out, /control character/);
  assert.match(out, /--name/);
  // The forged sentence must never stand as a line of its own. It may appear
  // escaped inside a quoted value — that is the value being named — but a raw
  // newline here is the forgery itself.
  assert.equal(
    out.split('\n').some((line) => line.trim() === forged), false,
    `the refusal forged the line it was refusing: ${JSON.stringify(out)}`,
  );
  nothingImported(cwd);
});

test('the --name gate runs before the preview, so --dry-run refuses it too', () => {
  const cwd = project();
  const { code, out } = run(
    ['pack', 'import', artefact({ items: newItems() }), '--dry-run', '--name', `x${RLO}y`], cwd,
  );

  assert.equal(code, 1, out);
  assert.match(out, /U\+202E/);
  // Nothing about the pack was printed: the report names the pack on its first
  // line, and that line would have printed the override.
  assert.equal(out.includes('manifest: every file verified'), false, out);
  nothingImported(cwd);
});

test('a --name refusal names a bounded number of findings and says how many it did not', () => {
  const cwd = project();
  // A name that is nothing but overrides. The screen reports EVERY screened
  // code point by design, so an uncapped refusal would print one line per
  // character at a reader who needed one — the shape `REFUSAL_VALUE_MAX`
  // (src/ui/security.ts) settled for a value, applied to a list.
  const { code, out } = run(
    ['pack', 'import', artefact({ items: newItems() }), '--yes', '--name', RLO.repeat(500)], cwd,
  );

  assert.equal(code, 1, out);
  assert.ok(
    out.split('\n').length < 40,
    `500 screened code points printed ${out.split('\n').length} lines of refusal`,
  );
  // Visibly truncated: a reader must not mistake what is shown for the whole.
  assert.match(flat(out), /\bmore\b/);
  assert.equal(out.includes(RLO), false, `the refusal printed U+202E itself`);
  nothingImported(cwd);
});

test('a --name refusal quotes no unbounded value, and marks the cut visibly', () => {
  const cwd = project();
  // Measured before the bound existed: `refusePackName` quotes the value it
  // refuses, and its whitespace rules fire BEFORE its code-point limit does —
  // so this name printed a 10,489-character refusal with the value in it
  // twice, and 50,000 characters printed 100,231.
  const { code, out } = run(
    ['pack', 'import', artefact({ items: newItems() }), '--yes', '--name', `${'z'.repeat(5000)} `],
    cwd,
  );

  assert.equal(code, 1, out);
  assert.ok(
    out.length < 2000,
    `the refusal echoed an unbounded value: ${out.length} characters`,
  );
  // The cap is on the VALUE, not on the message: `refuseOpaqueMeta` puts the
  // value first and says what is wrong with it AFTER, so a message-width cut
  // would keep the five thousand characters and throw the reason away.
  assert.match(flat(out), /leading or trailing whitespace/);
  // Visibly cut, so what is shown cannot be read as the whole of what arrived.
  assert.match(out, /…/);
  nothingImported(cwd);
});

test('--name "" is refused as an empty name, not misreported as a full export', () => {
  const cwd = project();
  const { code, out } = run(
    ['pack', 'import', artefact({ items: newItems() }), '--yes', '--name', ''], cwd,
  );

  assert.equal(code, 1, out);
  // The artefact IS a pack and carries a name; the flag is what is empty.
  assert.match(flat(out), /is empty/);
  nothingImported(cwd);
});

test('the same gate guards --name on the full-export path, which cannot go without one', () => {
  const cwd = project();
  // A whole-workspace export carries no name, so `--name` is not an override
  // here but the only name there is — and it is the one nothing screened.
  const source = artefact({
    items: newItems(), meta: { kind: 'export', name: null, version: null },
  });

  const { code, out } = run(['pack', 'import', source, '--yes', '--name', `a${RLO}b`], cwd);

  assert.equal(code, 1, out);
  assert.match(out, /U\+202E/);
  assert.equal(out.includes(RLO), false, `the refusal printed U+202E itself`);
  nothingImported(cwd);
});

test('a legal --name still names the pack everywhere it is printed', () => {
  const cwd = project();
  const { code, out } = run(
    ['pack', 'import', artefact({ items: newItems() }), '--yes', '--name', 'acme-security-b'], cwd,
  );

  assert.equal(code, 0, out);
  assert.match(out, /acme-security-b/);
  const json = run(['pack', 'list', '--json'], cwd);
  const document = JSON.parse(json.out) as { packs: { pack: string }[] };
  assert.deepEqual(document.packs.map((p) => p.pack), ['acme-security-b']);
});

/* -------------------------------------------------------------------------- *
 * F2, and the one-document rule
 * -------------------------------------------------------------------------- */

test('--json is one parseable document with load errors inside it', () => {
  const cwd = project();
  const source = artefact({ items: newItems() });
  plantUnrelatedCorruptItem(cwd);

  const { code, out } = run(['pack', 'import', source, '--yes', '--json'], cwd);

  // F2: an import that did its job exits 0 on an unrelated corpus load error,
  // and the error is reported INSIDE the document so the output stays one
  // parseable thing exactly when something is wrong.
  assert.equal(code, 0, out);
  const document = JSON.parse(out) as { applied: boolean; loadErrors: string[] };
  assert.equal(document.applied, true);
  assert.ok(
    document.loadErrors.some((e) => e.includes('CONST-broken.md')),
    `the unrelated load error is not in the document: ${JSON.stringify(document.loadErrors)}`,
  );
});
