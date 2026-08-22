/**
 * `mycontext review promote --all --pack <name>` — the other half of
 * "everything lands draft".
 *
 * **What this file is for.** A forty-item pack produces a forty-item review
 * queue on an empty project, and a queue that size is bulk-approved unread —
 * which is a worse outcome than no gate, not a better one. What that argument
 * supports is making bulk review tractable, not skipping the gate, so the bulk
 * act exists, it is ONE human confirmation, and it is taken **after** the
 * corpus is visible rather than before. Every assertion here is about one of
 * the four properties that makes it that rather than a `--promote-all` on the
 * import:
 *
 *  1. **The licence is bounded.** `--all` is refused without `--pack`, so there
 *     is no unbounded bulk promote; the licence granted is for the corpus a
 *     human just chose to import, not for every draft in the workspace. A
 *     locally authored draft in the same queue must come out of this untouched.
 *  2. **Nothing is edited on the way through.** `--scope`, `--severity` and
 *     `--always` are per-item decisions, and applying one of them to forty
 *     items is a bulk edit wearing a promotion's clothes. Each is refused, as
 *     is an id positional.
 *  3. **Everything skipped is named.** A bulk operation that reports only its
 *     successes is the exact shape of a silent drop, so the four skip reasons
 *     are each counted and listed, and the two counts sum to the membership.
 *  4. **The preview precedes the gate on every path**, `--yes` and the
 *     non-interactive refusal included — otherwise a refusal never says what it
 *     declined.
 *
 * What this file leaves alone: what an import DOES (`test/pack/import.test.ts`),
 * the membership record's own format (`test/pack/imported-audit.test.ts`) and
 * what `review promote <id>` does one at a time (`test/cli/review.test.ts`).
 * The one thing only true at this seam is that the bulk path promotes through
 * the SAME queue definition and the same single call, which the last two tests
 * here assert directly rather than by inspection.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import {
  existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { promoteAllSkipReason } from '../../src/cli/commands/review.ts';
import { readAudit } from '../../src/core/audit.ts';
import { computeItemChecksum, parseItem, renderItem } from '../../src/core/item.ts';
import { reviewQueue } from '../../src/core/select.ts';
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
/** One instant for every stamp here, so nothing in this file reads a clock. */
const FIXED_NOW = Date.parse('2026-08-20T09:12:44.031Z');

const RULE_A = 'RULE-never-log-customer-email';
const RULE_B = 'RULE-rotate-tokens-quarterly';
const STD_C = 'STD-commit-messages';
const CONST_D = 'CONST-one-writer-per-index';
const LESSON_E = 'LESSON-retry-with-backoff';
/** A draft this workspace wrote itself. The licence is for the pack, not the queue. */
const LOCAL_DRAFT = 'REQ-local-and-not-from-any-pack';

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

/** `.my_context` for a workspace directory. */
function rootOf(cwd: string): string {
  return path.join(cwd, '.my_context');
}

/** Every item file in a workspace, parsed — the corpus as it is on disk. */
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
  return out;
}

function itemOf(cwd: string, id: string): Item {
  const found = itemsOf(cwd).find((i) => i.id === id);
  assert.ok(found, `${id} is not in the corpus at ${cwd}`);
  return found;
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
    id: RULE_A,
    type: 'rule',
    title: 'Never log customer email',
    status: 'active',
    severity: 'soft',
    always: false,
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
    body: 'Never log the customer email, on any endpoint.',
    steps: [],
    observations: [],
    relations: [],
    layer: 'project',
    filePath: '',
    ...over,
  };
  return stamped({ ...base, filePath: over.filePath ?? `items/${base.type}/${base.id}.md` });
}

/** One mutation record, so the artefact carries a history at all. */
function packHistory(): unknown[] {
  return [{
    protocol: PACK_HISTORY_PROTOCOL,
    at: new Date(FIXED_NOW).toISOString(),
    kind: 'mutation',
    op: 'create',
    origin: 'human',
    itemId: RULE_A,
  }];
}

const PACK_CATEGORIES = {
  rule: { enabled: true, prefix: 'RULE', scopePolicy: 'global' },
  standard: { enabled: true, prefix: 'STD', scopePolicy: 'global' },
  constraint: { enabled: true, prefix: 'CONST', scopePolicy: 'global' },
  lesson: { enabled: true, prefix: 'LESSON', scopePolicy: 'global' },
};

/** The five items this pack carries — two rules, and one of three other types. */
function packItems(): Item[] {
  return [
    item(),
    item({ id: RULE_B, title: 'Rotate tokens quarterly', body: 'Rotate every token quarterly.' }),
    item({
      id: STD_C, type: 'standard', title: 'Commit messages',
      body: 'Write commit messages in the imperative.',
    }),
    item({
      id: CONST_D, type: 'constraint', title: 'One writer per index',
      body: 'Exactly one process writes the index.',
    }),
    item({
      id: LESSON_E, type: 'lesson', title: 'Retry with backoff',
      body: 'Retry with backoff.',
    }),
  ];
}

/** Writes one artefact directory and returns its path. */
function artefact(items: Item[], meta: Partial<ManifestMeta> = {}): string {
  const files: ExportFile[] = [
    ...items.map(itemFile),
    jsonFile(CONFIG_NAME, { categories: PACK_CATEGORIES }),
    historyFile(packHistory()),
  ];
  const full: ManifestMeta = {
    kind: 'pack', name: PACK_NAME, version: PACK_VERSION, now: FIXED_NOW, ...meta,
  };
  const all = [...files, { path: MANIFEST_NAME, bytes: renderManifest(buildManifest(files, full)) }]
    .toSorted((a, b) => comparePaths(a.path, b.path));
  const dir = path.join(scratchDir('myctx-promoteall-src-'), 'pack');
  writeBundleDirectory({ files: all }, dir);
  return dir;
}

/**
 * A workspace that has imported the five-item pack and also holds one draft of
 * its own — the item that proves the licence is for the pack rather than for
 * the queue.
 */
function imported(items: Item[] = packItems(), meta: Partial<ManifestMeta> = {}): string {
  const cwd = scratchDir('myctx-promoteall-');
  assert.equal(runCli(['init'], cwd, () => {}), 0, 'the fixture workspace did not initialize');
  // Written as a file rather than captured with `mycontext add`: `add` on a
  // normative category creates an ACTIVE item behind its own gate, and what is
  // wanted here is a locally authored DRAFT sitting in the same queue as the
  // pack's — the entry the bulk act must not touch.
  const local = item({
    id: LOCAL_DRAFT, type: 'requirement', title: 'Local and not from any pack',
    status: 'draft', body: 'Ours, and nobody\'s pack brought it.',
  });
  const file = path.join(rootOf(cwd), 'items', 'requirement', `${LOCAL_DRAFT}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, renderItem(local), 'utf8');
  assert.equal(
    runCli(['pack', 'import', artefact(items, meta), '--yes'], cwd, () => {}), 0,
    'the fixture import failed',
  );
  return cwd;
}

/** The status of one item on disk, or `null` when its file is gone. */
function statusOf(cwd: string, id: string): string | null {
  return itemsOf(cwd).find((i) => i.id === id)?.status ?? null;
}

/* -------------------------------------------------------------------------- *
 * The argument surface — four refusals, each of which is the rule
 * -------------------------------------------------------------------------- */

test('--all without --pack is refused', () => {
  const cwd = imported();
  const { code, out } = run(['review', 'promote', '--all', '--yes'], cwd);

  assert.equal(code, 1);
  assert.match(flat(out), /--all needs --pack/);
  // The reason, not just the refusal: there is no unbounded bulk promote.
  assert.match(flat(out), /every draft in this workspace|unbounded/i);
  assert.match(out, /mycontext pack list/);
  // Nothing moved — the local draft included.
  assert.equal(statusOf(cwd, LOCAL_DRAFT), 'draft');
  assert.equal(statusOf(cwd, RULE_A), 'draft');
});

test('--pack without --all is refused rather than accepted and ignored', () => {
  const cwd = imported();
  const { code, out } = run(['review', 'promote', RULE_A, '--pack', PACK_NAME, '--yes'], cwd);

  assert.equal(code, 1);
  assert.match(flat(out), /--pack names the pack whose drafts --all promotes/);
  assert.match(flat(out), /means nothing on its own/);
  assert.equal(statusOf(cwd, RULE_A), 'draft');
});

test('--pack naming no imported pack is refused and points at pack list', () => {
  const cwd = imported();
  const { code, out } = run(['review', 'promote', '--all', '--pack', 'acme', '--yes'], cwd);

  assert.equal(code, 1);
  assert.match(out, /"acme"/);
  assert.match(out, /mycontext pack list/);
  // The names that ARE here, so the refusal is answerable rather than merely correct.
  assert.match(out, new RegExp(PACK_NAME));
  assert.equal(statusOf(cwd, RULE_A), 'draft');
});

test('--scope, --severity, --always and an id positional are each refused with --all', () => {
  const cwd = imported();
  const bulk = ['review', 'promote', '--all', '--pack', PACK_NAME, '--yes'];

  for (const extra of [
    ['--scope', 'src/**'],
    ['--severity', 'hard'],
    ['--always'],
  ]) {
    const { code, out } = run([...bulk, ...extra], cwd);
    assert.equal(code, 1, `${extra[0]} was accepted with --all:\n${out}`);
    assert.match(out, new RegExp(extra[0].replace('--', '--')), out);
    // The reason each is refused, which is the same reason for all three.
    assert.match(flat(out), /per-item decision/i, out);
    assert.equal(statusOf(cwd, RULE_A), 'draft', `${extra[0]} promoted something`);
  }

  const withId = run(
    ['review', 'promote', RULE_A, '--all', '--pack', PACK_NAME, '--yes'], cwd,
  );
  assert.equal(withId.code, 1);
  assert.match(flat(withId.out), new RegExp(RULE_A));
  assert.equal(statusOf(cwd, RULE_A), 'draft');
});

/* -------------------------------------------------------------------------- *
 * The preview, the gate, and what declining means
 * -------------------------------------------------------------------------- */

test('the preview prints before the gate, on the non-interactive path too', () => {
  const cwd = imported();
  // No `--yes`, and `node --test` gives this process no TTY, so `confirmAction`
  // refuses. The preview must still have been printed, or the refusal never
  // says what it declined.
  const { code, out } = run(['review', 'promote', '--all', '--pack', PACK_NAME], cwd);

  assert.equal(code, 1);
  const gate = out.indexOf('refusing without confirmation');
  assert.notEqual(gate, -1, `the gate never refused:\n${out}`);
  const preview = out.slice(0, gate);
  assert.match(flat(preview), /about to promote 5 draft\(s\) imported from pack "acme-security"/);
  assert.match(flat(preview), /becomes active and starts governing this project/);
  // The per-category breakdown, so five is not just a number.
  assert.match(preview, /rule\s+2/);
  assert.match(preview, /standard\s+1/);
  assert.equal(statusOf(cwd, RULE_A), 'draft');
});

test('declining leaves every item a draft', () => {
  const cwd = imported();
  const before = itemsOf(cwd).map((i) => `${i.id}:${i.status}`).sort();
  const { code, out } = run(['review', 'promote', '--all', '--pack', PACK_NAME], cwd);

  assert.equal(code, 1);
  assert.match(out, /refusing without confirmation/);
  assert.deepEqual(itemsOf(cwd).map((i) => `${i.id}:${i.status}`).sort(), before);
});

test('confirming promotes exactly the pack\'s drafts and nothing else in the queue', () => {
  const cwd = imported();
  const { code, out } = run(['review', 'promote', '--all', '--pack', PACK_NAME, '--yes'], cwd);

  assert.equal(code, 0, out);
  for (const id of [RULE_A, RULE_B, STD_C, CONST_D, LESSON_E]) {
    assert.equal(statusOf(cwd, id), 'active', `${id} did not promote:\n${out}`);
  }
  // A locally authored draft in the same workspace must be untouched — the
  // licence is for the pack, not for the queue.
  assert.equal(statusOf(cwd, LOCAL_DRAFT), 'draft', out);
  assert.match(flat(out), /5 item\(s\) from pack "acme-security" are now active/);
});

/* -------------------------------------------------------------------------- *
 * Everything skipped is named
 * -------------------------------------------------------------------------- */

test('every skipped item is named with its reason, and the counts sum', () => {
  const cwd = imported();

  // 1. Settled already: promoted one at a time before the bulk act.
  assert.equal(run(['review', 'promote', RULE_B, '--yes'], cwd).code, 0);
  // 2. A category this project does not enable. The item stays in the corpus
  //    and in the queue; it simply would never be injected as "active".
  const configFile = path.join(rootOf(cwd), 'config.json');
  const config = JSON.parse(readFileSync(configFile, 'utf8')) as {
    categories: Record<string, { enabled?: boolean }>;
  };
  config.categories.standard.enabled = false;
  writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  // 3. Gone from the corpus entirely.
  assert.equal(itemOf(cwd, CONST_D).id, CONST_D, 'the fixture never imported the constraint');
  rmSync(path.join(rootOf(cwd), 'items', 'constraint', `${CONST_D}.md`));

  const { code, out } = run(['review', 'promote', '--all', '--pack', PACK_NAME, '--yes'], cwd);
  assert.equal(code, 0, out);

  const one = flat(out);
  assert.match(one, /about to promote 2 draft\(s\) imported from pack "acme-security"/);
  assert.match(one, /skipping 3 of the 5 item\(s\) this pack imported/);
  // 2 promoted + 3 skipped = the 5 the membership record holds.
  assert.match(one, new RegExp(`${RULE_B} already active`));
  assert.match(one, new RegExp(`${STD_C} category "standard" is not enabled here`));
  assert.match(one, new RegExp(`${CONST_D} no longer present`));

  assert.equal(statusOf(cwd, RULE_A), 'active');
  assert.equal(statusOf(cwd, LESSON_E), 'active');
  assert.equal(statusOf(cwd, STD_C), 'draft');
});

/**
 * The fourth skip reason, which no artefact can reach.
 *
 * An import creates in the PROJECT layer, so a pack member is never global —
 * but `promoteAllSkipReason` is asked about whatever `store.get` returns, and
 * the global layer is read-only from a project (`review promote <id>` refuses
 * it in its own sentence). Exercising the branch here rather than standing up
 * a fake `HOME` for one string is the trade `test/cli/edit-global-layer.test.ts`
 * pays a whole file for; what matters is that the branch is not a guess.
 */
test('a member outside the project layer is skipped, and says so', () => {
  const global = { ...item({ id: RULE_A }), layer: 'global' as const };
  assert.match(
    promoteAllSkipReason(global, false, true) ?? '',
    /global layer/,
  );
  // …and the other four answers, so the ordering of the branches is pinned.
  assert.equal(promoteAllSkipReason(null, false, true), 'no longer present');
  assert.match(
    promoteAllSkipReason({ ...item({ id: RULE_A }), status: 'active' }, false, true) ?? '',
    /already active/,
  );
  assert.match(
    promoteAllSkipReason(item({ id: RULE_A, status: 'draft' }), true, false) ?? '',
    /category "rule" is not enabled here/,
  );
  assert.equal(promoteAllSkipReason(item({ id: RULE_A, status: 'draft' }), true, true), null);
});

/* -------------------------------------------------------------------------- *
 * The two properties that make this the same act, done many times
 * -------------------------------------------------------------------------- */

test('each promotion writes an audit record with origin human', () => {
  const cwd = imported();
  assert.equal(run(['review', 'promote', '--all', '--pack', PACK_NAME, '--yes'], cwd).code, 0);

  const promoted = new Set([RULE_A, RULE_B, STD_C, CONST_D, LESSON_E]);
  const updates = readAudit(rootOf(cwd)).filter(
    (r) => r.kind === 'mutation' && r.op === 'update' && promoted.has(r.itemId ?? ''),
  );
  assert.deepEqual(
    updates.map((r) => r.itemId).toSorted(), [...promoted].toSorted(),
    'the bulk promote did not audit one update per item',
  );
  for (const record of updates) {
    assert.equal(
      record.origin, 'human',
      `${record.itemId} was promoted with origin ${record.origin} — origin: 'human' is the ` +
      'only thing that evidences a human did it, and the only thing that makes the status ' +
      'change legal',
    );
    assert.ok(record.fields?.includes('status'), `${record.itemId} recorded no status change`);
  }
});

test('the review queue definition is not widened — reviewQueue still means one thing', () => {
  const cwd = imported();
  const before = reviewQueue(itemsOf(cwd)).map((i) => i.id).toSorted();
  // Every pack member plus the local draft: six drafts, one definition.
  assert.deepEqual(
    before, [RULE_A, RULE_B, STD_C, CONST_D, LESSON_E, LOCAL_DRAFT].toSorted(),
  );

  const { out } = run(['review', 'promote', '--all', '--pack', PACK_NAME, '--yes'], cwd);
  // The command's own view of what it could promote, taken off its preview.
  const counted = /about to promote (\d+) draft\(s\)/.exec(flat(out));
  assert.ok(counted, `no preview count in:\n${out}`);
  assert.equal(Number(counted[1]), before.length - 1, 'the command saw a different queue');

  const after = reviewQueue(itemsOf(cwd)).map((i) => i.id).toSorted();
  assert.deepEqual(
    after, [LOCAL_DRAFT],
    'the queue after the bulk act is not the queue before it minus the pack — either the ' +
    'command promoted something outside the pack, or it left a member behind',
  );
});

/* -------------------------------------------------------------------------- *
 * Two packs that call themselves the same thing
 * -------------------------------------------------------------------------- */

/**
 * `writeImportRecord` files `<packDir>/import.json`, and `packDir` slugs the
 * pack's OWN name — so a second pack calling itself the same thing replaces
 * the first one's record, and that record is the membership list this command
 * reads. The behaviour is not something this command can repair after the
 * fact: the earlier list is gone by the time it runs. What it can do — and
 * what this pins — is refuse to be silent about it, by naming the record it is
 * about (its source and the instant it was imported) in the preview, and by
 * saying plainly that a re-import under one name replaces the list.
 *
 * The items the FIRST pack brought in are still drafts in the queue afterwards.
 * That is the safe direction: a membership list that has narrowed leaves items
 * to be promoted one at a time, where one that had widened would promote items
 * a human never chose.
 */
test('a second pack under the same name replaces the record, and the preview says so', () => {
  const cwd = imported([item(), item({ id: RULE_B, title: 'Rotate tokens quarterly' })]);
  assert.equal(statusOf(cwd, RULE_B), 'draft');

  // A DIFFERENT pack, same name, disjoint membership.
  const second = artefact([item({
    id: STD_C, type: 'standard', title: 'Commit messages',
    body: 'Write commit messages in the imperative.',
  })]);
  assert.equal(run(['pack', 'import', second, '--yes'], cwd).code, 0);

  const { code, out } = run(['review', 'promote', '--all', '--pack', PACK_NAME, '--yes'], cwd);
  assert.equal(code, 0, out);

  const one = flat(out);
  // The membership is the SECOND import's, and the preview names which import
  // that is rather than leaving the user to infer it from a count.
  assert.match(one, /about to promote 1 draft\(s\) imported from pack "acme-security"/);
  assert.match(one, new RegExp(second.replaceAll('\\', '\\\\').replaceAll('.', '\\.')));
  assert.match(one, /replaces that record|replaces this record/i);

  assert.equal(statusOf(cwd, STD_C), 'active');
  // The first pack's items are not promoted by a list that no longer holds
  // them — they stay in the queue, which is where a human can still see them.
  assert.equal(statusOf(cwd, RULE_A), 'draft');
  assert.equal(statusOf(cwd, RULE_B), 'draft');
});
