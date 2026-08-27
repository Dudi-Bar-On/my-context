/**
 * `GET /api/packs`, against real workspaces built by the real CLI.
 *
 * The fixture is a pack EXPORTED from one workspace and IMPORTED into another,
 * through `mycontext export --as-pack` and `mycontext pack import`, because
 * every fact this endpoint serves about a pack comes off an `import.json` that
 * only a real import writes. A hand-written record would test this module
 * against a file shape nothing produces.
 *
 * The properties these tests exist for, none of which can be read off the
 * module:
 *
 *  1. **The membership join is live.** A pack's row reports the statuses its
 *     items hold NOW, not the ones they had when it was imported — so
 *     promoting one member moves it between buckets, and an item that leaves
 *     the corpus is named rather than silently absent from the tally.
 *  2. **`carries` is the refuser's answer, verbatim.** Asserted by comparing
 *     against a direct `refusePackConfig` call rather than against a string
 *     spelled here, which is the only form of the assertion that stays true
 *     when the refusal is reworded.
 *  3. **Everything lands `draft` on BOTH routes** — the fact the mockup's
 *     `pk.trust` table contradicts. Asserted against the corpus as well as
 *     against the served constant, so the constant cannot drift away from what
 *     an import actually does without a test going red.
 *  4. **`readImportRecords`' silent skip is disclosed.** A directory under
 *     `.audit/imported/` with no `import.json` is invisible to `pack list`;
 *     here it is named. The quarantine directory is NOT, because it is not a
 *     pack that failed — it is where rows this build could not validate go.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { resolveWorkspace, type Workspace } from '../../src/core/workspace.ts';
import { refusePackConfig } from '../../src/pack/config-io.ts';
import { MANIFEST_MEANING } from '../../src/pack/manifest.ts';
import { apiPacks, type PacksBody } from '../../src/ui/packs-model.ts';
import { removeTree } from '../helpers/tmp.ts';

const PACK_NAME = 'acme security';
const PACK_VERSION = '2026-08 rev 3';
const RULE = 'RULE-never-log-customer-email';
const DECISION = 'DEC-use-problem-json';

const scratch: string[] = [];
test.after(() => { for (const dir of scratch) removeTree(dir); });

function tmp(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

/** The real CLI, refusing to be ignored: a fixture command that fails fails here. */
function run(cwd: string, args: string[]): void {
  const lines: string[] = [];
  const code = runCli(args, cwd, (line: string) => lines.push(line));
  assert.equal(code, 0, `fixture command failed: ${args.join(' ')}\n${lines.join('\n')}`);
}

/**
 * An author's workspace with two items in it, exported as a pack.
 *
 * Two categories on the two different tiers — `rule` is normative and
 * `decision` is rationale — because the "everything lands draft" property is
 * only interesting on the rationale one: a normative item would be demoted by
 * the trust layer whether or not the importer asked for `draft`.
 */
function packDirectory(): string {
  const author = tmp('myctx-packs-author-');
  const out = path.join(tmp('myctx-packs-artefact-'), 'pack1');
  run(author, ['init']);
  run(author, ['add', 'rule', 'Never log customer email', '--body', 'Redact it.', '--yes']);
  run(author, ['add', 'decision', 'Use problem json', '--body', 'Errors are problem+json.', '--yes']);
  run(author, ['export', '--out', out, '--as-pack', '--pack-name', PACK_NAME,
    '--pack-version', PACK_VERSION]);
  return out;
}

/**
 * A fresh workspace with an index.
 *
 * `init` alone does not create `.index.db` — nothing has been written yet — and
 * `withStores` opens the index READ-ONLY and refuses a database that is not
 * there. That is `read-model.ts`'s door and every endpoint on this server goes
 * through it, so the fixture builds the index rather than this module routing
 * around a rule its twenty siblings keep.
 */
function workspace(): string {
  const dir = tmp('myctx-packs-');
  run(dir, ['init']);
  run(dir, ['rebuild']);
  return dir;
}

/** ...with the pack above imported into it. */
function workspaceWithPack(): { dir: string; source: string } {
  const source = packDirectory();
  const dir = workspace();
  run(dir, ['pack', 'import', source, '--yes']);
  return { dir, source };
}

function packs(dir: string, query = ''): { status: number; body: PacksBody } {
  const result = apiPacks(resolveWorkspace(dir), new URL(`http://x/api/packs${query}`));
  return { status: result.status, body: result.body as PacksBody };
}

/* -------------------------------------------------------------------------- */

test('/api/packs on a workspace with no packs lists none and still answers the rules', () => {
  const { status, body } = packs(workspace());
  assert.equal(status, 200);
  assert.deepEqual(body.packs, []);
  // Nothing was skipped, and the response says so by carrying an empty list
  // rather than by omitting the field.
  assert.deepEqual(body.dropped, []);
  // The three prose halves are answers about the BUILD, not about the corpus,
  // so they are served whether or not a pack has ever been imported here.
  assert.equal(body.artefact.protocol, 'my_context/pack@1');
  assert.equal(body.artefact.manifest, 'manifest.json');
  assert.equal(body.carries.length, 6);
});

test('an imported pack is listed with its membership joined to the corpus', () => {
  const { dir, source } = workspaceWithPack();
  const { body } = packs(dir);
  assert.equal(body.packs.length, 1);
  const pack = body.packs[0];
  assert.equal(pack.name, PACK_NAME);
  assert.equal(pack.version, PACK_VERSION);
  assert.equal(pack.kind, 'pack');
  // The path as the importer typed it, recorded verbatim rather than resolved.
  assert.equal(pack.source, source);
  assert.match(pack.importedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(pack.items.total, 2);
  assert.deepEqual(pack.missing, []);
  assert.equal(pack.quarantined, 0);
  assert.equal(pack.historyRecords, 2);
  // The tally partitions the membership list: nothing counted twice, nothing
  // unaccounted for.
  const counted = Object.values(pack.items.byStatus).reduce((a, b) => a + b, 0);
  assert.equal(counted + pack.missing.length, pack.items.total);
});

test('everything a pack brought in landed draft — on both tiers, and on both routes', () => {
  const { dir } = workspaceWithPack();
  const { body } = packs(dir);
  // The corpus itself, which is the claim `pk.trustn` is really about: a
  // rationale item (`decision`) would NOT be demoted by the trust layer, so a
  // `draft` here is the importer asking for it rather than a side effect.
  assert.deepEqual(body.packs[0].items.byStatus, { draft: 2 });
  // ...and the served constant, which must not drift away from that.
  assert.equal(body.landing.packImport, 'draft');
  // `init --pack` runs the SAME `applyImport`, so it lands `draft` too. The
  // mockup's `pk.trust` table pairs this route with `pk.active`; this asserts
  // what the build does, and the disagreement is the owner's to rule on.
  assert.equal(body.landing.initPack, 'draft');
});

test('promoting a member moves it in byStatus, because the join is live', () => {
  const { dir } = workspaceWithPack();
  run(dir, ['review', 'promote', DECISION, '--yes']);
  const { body } = packs(dir);
  assert.deepEqual(body.packs[0].items.byStatus, { active: 1, draft: 1 });
  assert.equal(body.packs[0].items.total, 2);
});

test('a member that has left the corpus is NAMED, not quietly missing from the tally', () => {
  const { dir } = workspaceWithPack();
  unlinkSync(path.join(dir, '.my_context', 'items', 'rule', `${RULE}.md`));
  run(dir, ['rebuild']);
  const { body } = packs(dir);
  const pack = body.packs[0];
  assert.deepEqual(pack.missing, [RULE]);
  // `total` still counts it: the membership record is what it is, and shrinking
  // the total to match the index would hide the very fact `missing` reports.
  assert.equal(pack.items.total, 2);
  assert.deepEqual(pack.items.byStatus, { draft: 1 });
});

test('carries is refusePackConfig\'s own verdict, key by key and word for word', () => {
  const dir = workspace();
  const ws = resolveWorkspace(dir);
  const { body } = packs(dir);
  const rows = new Map(body.carries.map((r) => [r.key, r]));

  // The mockup's `pk.what` rows: category configuration travels, budgets and
  // watchedDocs never.
  assert.equal(rows.get('categories')?.travels, true);
  assert.deepEqual(rows.get('categories')?.refusals, []);
  for (const key of ['budgets', 'watchedDocs', 'profile', 'ui']) {
    assert.equal(rows.get(key)?.travels, false, `${key} must not travel in a pack`);
  }

  // The same wording, by construction rather than by agreement: compare against
  // the refuser itself. A reworded refusal changes both sides at once, which is
  // the whole reason the message is asked for rather than spelled here.
  for (const [key, row] of rows) {
    assert.deepEqual(row.refusals, refusePackConfig({ [key]: {} }, ws.config), key);
  }

  // The six keys are the loader's top-level set, not a subset somebody chose.
  // `handover` joined on 2026-08-27 and produced its row with no edit to
  // `packs-model.ts` at all, which is the property this assertion is for.
  assert.deepEqual(
    body.carries.map((r) => r.key).toSorted(),
    ['budgets', 'categories', 'handover', 'profile', 'ui', 'watchedDocs'],
  );
});

test('the manifest sentence is carried verbatim, both halves together', () => {
  const { body } = packs(workspace());
  assert.equal(body.artefact.meaning, MANIFEST_MEANING);
  // The condition half may never travel without the guarantee half; asserting
  // the whole constant above is what holds that, and this names why.
  assert.match(body.artefact.meaning, /says nothing about whether the author is trustworthy/);
});

test('a pack directory with no import.json is disclosed — the quarantine is not', () => {
  const { dir } = workspaceWithPack();
  const imported = path.join(dir, '.my_context', '.audit', 'imported');
  // An import that failed before its record was written leaves exactly this.
  mkdirSync(path.join(imported, 'half-imported'));
  // ...and this is where rows this build could not validate go. It is not a
  // pack and must never be reported as one.
  mkdirSync(path.join(imported, 'unknown'), { recursive: true });

  const { body } = packs(dir);
  assert.equal(body.dropped.length, 1);
  assert.equal(body.dropped[0].where, path.join(imported, 'half-imported'));
  assert.match(body.dropped[0].message, /carries no import\.json/);
  // The real pack is still listed, and is not itself reported as dropped.
  assert.equal(body.packs.length, 1);
  assert.equal(body.packs[0].name, PACK_NAME);
});

test('an unknown query parameter is refused rather than ignored', () => {
  const result = apiPacks(
    resolveWorkspace(workspace()), new URL('http://x/api/packs?path=../elsewhere'));
  assert.equal(result.status, 400);
  assert.match((result.body as { error: string }).error, /path/);
});

test('a workspace with no project answers 404, not an empty pack list', () => {
  // Built literally rather than resolved from a directory: `findProjectRoot`
  // walks UPWARD, so a temp directory under an ancestor that happens to hold a
  // `.my_context` would resolve to that workspace and this test would assert
  // nothing. The state under test is `projectRoot === null`, so that is the
  // state constructed.
  const ws: Workspace = {
    projectRoot: null,
    globalRoot: path.join(tmpdir(), 'myctx-nowhere'),
    dbPath: ':memory:',
    config: resolveConfig({}),
  };
  const result = apiPacks(ws, new URL('http://x/api/packs'));
  assert.equal(result.status, 404);
  assert.match((result.body as { error: string }).error, /no workspace here/);
});
