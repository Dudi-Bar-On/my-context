import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { row } from '../helpers/table.ts';

/**
 * A throwaway HOME, installed BEFORE any `src/` module is imported.
 *
 * `core/workspace.ts` computes `GLOBAL_DIR = homedir()/.my-context` once, at
 * import time, and two of the four surfaces exercised below (`load_context`
 * via `buildInjection`, and the MCP `list_drafts`) resolve their own workspace
 * from a bare `cwd` — there is no `Workspace` object to override on the way
 * in. So the global layer has to be real, and it has to live under a home this
 * test owns rather than the developer's actual `~/.my-context`.
 *
 * The dynamic imports below are what make that ordering hold: a static
 * `import` is hoisted above these two assignments and would capture the real
 * home directory. `node --test` runs each test FILE in its own process, so the
 * override cannot leak into another file's tests.
 */
const HOME = mkdtempSync(path.join(tmpdir(), 'myctx-home-'));
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
const GLOBAL_ROOT = path.join(HOME, '.my-context');
process.on('exit', () => { removeTree(HOME); });

const { runCli } = await import('../../src/cli/index.ts');
const { buildInjection } = await import('../../src/core/inject.ts');
const { createRegistry } = await import('../../src/mcp/tools.ts');
const { mergeLayers, reviewQueue, select } = await import('../../src/core/select.ts');
const { resolveConfig } = await import('../../src/core/config.ts');
type Item = import('../../src/core/types.ts').Item;

function itemFile(root: string, id: string, type: string, frontmatter: string): void {
  const file = path.join(root, 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: ${type}
title: Title of ${id}
${frontmatter}---

# Title of ${id}

Body text.
`, 'utf8');
}

/**
 * One fixture corpus for all four surfaces: two project-layer drafts (one of
 * them pinned), one project-layer active item, and — the case the whole
 * finding is about — one GLOBAL-layer draft, which belongs to no project's
 * review queue because it can never be promoted or discarded from here.
 */
function fixture(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-queue-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  const project = path.join(cwd, '.my_context');

  itemFile(project, 'REQ-project-draft', 'requirement',
    'status: draft\nseverity: soft\nalways: false\norigin: ingest\n');
  itemFile(project, 'CONST-project-pinned-draft', 'constraint',
    'status: draft\nseverity: hard\nalways: true\norigin: ingest\n');
  itemFile(project, 'CONST-project-active', 'constraint',
    'status: active\nseverity: hard\nalways: false\norigin: human\nscope:\n  - src/**\n');

  mkdirSync(GLOBAL_ROOT, { recursive: true });
  writeFileSync(
    path.join(GLOBAL_ROOT, 'config.json'),
    JSON.stringify({ profile: 'standard', categories: {}, budgets: {} }, null, 2) + '\n',
  );
  itemFile(GLOBAL_ROOT, 'REQ-global-draft', 'requirement',
    'status: draft\nseverity: soft\nalways: false\norigin: human\n');

  return cwd;
}

function withFixture(fn: (cwd: string) => void): void {
  const cwd = fixture();
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
    removeTree(GLOBAL_ROOT);
  }
}

/**
 * THE structural test for C3.
 *
 * Four surfaces answer "how many drafts are pending review" — the SessionStart
 * banner / `load_context` (core/select's `buildIndex`), the MCP `list_drafts`
 * tool, `mycontext review`, and `mycontext status` — and each of them used to
 * derive the filter itself. Three omitted the layer check, so the banner and
 * the MCP queue counted a global-layer draft that `review promote` then
 * refuses with exit 1, and `status --full` printed `draft 6` twelve lines
 * above `review queue: 5 draft(s) pending`.
 *
 * This drives all four REAL surfaces against one corpus and requires the same
 * answer from each, so a call site that stops using `reviewQueue` and
 * re-derives the filter fails here regardless of which one it is. It is
 * deliberately not a test of `reviewQueue`'s own behaviour — that is below,
 * and on its own it would prove nothing about the call sites.
 */
test('all four draft-count surfaces agree, and none of them counts a global-layer draft', () => {
  withFixture((cwd) => {
    // Fixture integrity FIRST: if the corpus ever stops containing a
    // global-layer draft, every assertion below still passes while testing
    // nothing at all. `status --json`'s raw `byStatus` tally is the corpus
    // itself, straight out of the store.
    const statusJson = JSON.parse(run(['status', '--json'], cwd).out) as {
      items: { byStatus: Record<string, number> };
      reviewQueue: { drafts: number; always: number; globalLayerDrafts: number };
    };
    assert.equal(statusJson.items.byStatus.draft, 3, 'fixture must hold 3 drafts across both layers');
    assert.equal(statusJson.reviewQueue.globalLayerDrafts, 1, 'fixture must hold a global-layer draft');

    // Surface 1 — the always-loaded banner (core/select's buildIndex, via the
    // same buildInjection the SessionStart hook and load_context both use).
    const injected = buildInjection(cwd, { event: 'manual' });
    const banner = /(\d+) drafts pending review/.exec(injected);
    assert.notEqual(banner, null, `expected a draft count in the injection:\n${injected}`);
    const bannerCount = Number(banner![1]);

    // Surface 2 — the MCP tool the agent is told is the review queue.
    const listed = createRegistry(cwd).call('list_drafts', {});
    const listedIds = listed.split('\n').map((l) => l.split(' · ')[0]);
    const mcpCount = listedIds.length;

    // Surface 3 — `mycontext review`.
    const reviewJson = JSON.parse(run(['review', '--json'], cwd).out) as { count: number };

    // Surface 4 — `mycontext status`.
    const statusCount = statusJson.reviewQueue.drafts;

    assert.deepEqual(
      { banner: bannerCount, mcp: mcpCount, review: reviewJson.count, status: statusCount },
      { banner: 2, mcp: 2, review: 2, status: 2 },
      'every surface must report the project-layer draft queue, and only that',
    );
    // Not just the count: the global draft must not be OFFERED either, since
    // acting on it is what fails.
    assert.equal(listedIds.includes('REQ-global-draft'), false, listed);
    assert.doesNotMatch(run(['review'], cwd).out, /REQ-global-draft/);
  });
});

/**
 * The control for the test above. Without it, a mutant that dropped
 * `status === 'draft'` (counting every project item instead) or that returned
 * an empty queue could still make all four surfaces "agree".
 */
test('the queue is the project-layer drafts themselves, not merely a number four surfaces share', () => {
  withFixture((cwd) => {
    const listed = createRegistry(cwd).call('list_drafts', {});
    for (const id of ['REQ-project-draft', 'CONST-project-pinned-draft']) {
      assert.match(listed, new RegExp(id));
      assert.match(run(['review'], cwd).out, new RegExp(id));
    }
    // The active project item is not a draft and must appear in neither.
    assert.doesNotMatch(listed, /CONST-project-active/);
    assert.doesNotMatch(run(['review'], cwd).out, /CONST-project-active/);
  });
});

/**
 * `status --full` prints a raw `by status` tally (both layers) and, twelve
 * lines later, the review queue (project layer only). Both numbers are
 * correct; the pair is unreadable without the reason for the difference, so
 * `status` names it. This pins the annotation, not the tally.
 */
test('status names the gap between its raw draft tally and the review queue', () => {
  withFixture((cwd) => {
    const { out } = run(['status', '--full'], cwd);
    assert.match(out, row('draft', '3'));
    assert.match(out, /review queue: 2 draft\(s\) pending review/);
    assert.match(out, /1 further draft\(s\) are in the global layer and are NOT in this queue/);
    assert.match(out, /"by status" tally above counts all 3/);
  });
});

test('status says nothing about global-layer drafts when there are none', () => {
  withFixture((cwd) => {
    removeTree(GLOBAL_ROOT);
    const { out } = run(['status', '--full'], cwd);
    assert.match(out, /review queue: 2 draft\(s\) pending review/);
    assert.doesNotMatch(out, /global layer/);
  });
});

/**
 * `always` has the largest injection footprint of any field and a draft can
 * arrive already carrying it, so the count of pinned drafts is surfaced where
 * the human is pointed at the queue (I3).
 */
test('status counts the drafts that would be pinned on promotion', () => {
  withFixture((cwd) => {
    assert.match(
      run(['status'], cwd).out,
      /1 of them carry `always: true` — promoting one pins it into every session start/,
    );
    const parsed = JSON.parse(run(['status', '--json'], cwd).out) as {
      reviewQueue: { always: number };
    };
    assert.equal(parsed.reviewQueue.always, 1);
  });
});

// --- `reviewQueue` itself ---

const CONFIG = resolveConfig({});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A', status: 'active',
    severity: 'soft', always: false, continuity: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: '', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

test('reviewQueue keeps project-layer drafts and nothing else', () => {
  const queue = reviewQueue([
    item({ id: 'REQ-p', status: 'draft' }),
    item({ id: 'REQ-g', status: 'draft', layer: 'global' }),
    item({ id: 'REQ-active' }),
    item({ id: 'REQ-deprecated', status: 'deprecated' }),
  ]);
  assert.deepEqual(queue.map((i) => i.id), ['REQ-p']);
});

test('reviewQueue filters by type when asked, and does not when not', () => {
  const items = [
    item({ id: 'REQ-p', type: 'requirement', status: 'draft' }),
    item({ id: 'CONST-p', type: 'constraint', status: 'draft' }),
  ];
  assert.deepEqual(reviewQueue(items, 'requirement').map((i) => i.id), ['REQ-p']);
  assert.deepEqual(reviewQueue(items, null).map((i) => i.id), ['REQ-p', 'CONST-p']);
});

/**
 * The ruling on `merged` vs unmerged input, made checkable.
 *
 * `buildIndex` calls `reviewQueue` on a post-`mergeLayers` array; `review` and
 * `list_drafts` call it on `store.all()`, unmerged. That is only safe because
 * `mergeLayers` drops an entry solely when another entry shares its id, and
 * keeps the PROJECT copy when it does — so it can never remove a
 * project-layer draft that the raw array had. Both directions of the
 * collision are covered here, including the one where the project copy is
 * NOT a draft (so the merged corpus must also count zero).
 */
test('reviewQueue gives the same answer on merged and unmerged input', () => {
  const corpora: Item[][] = [
    [
      item({ id: 'REQ-x', status: 'draft', layer: 'global' }),
      item({ id: 'REQ-x', status: 'draft', layer: 'project' }),
    ],
    [
      item({ id: 'REQ-x', status: 'draft', layer: 'project' }),
      item({ id: 'REQ-x', status: 'draft', layer: 'global' }),
    ],
    [
      item({ id: 'REQ-x', status: 'draft', layer: 'global' }),
      item({ id: 'REQ-x', status: 'active', layer: 'project' }),
    ],
    [
      item({ id: 'REQ-g', status: 'draft', layer: 'global' }),
      item({ id: 'REQ-p', status: 'draft', layer: 'project' }),
      item({ id: 'CONST-p', status: 'active', layer: 'project' }),
    ],
  ];
  for (const corpus of corpora) {
    assert.deepEqual(
      reviewQueue(mergeLayers(corpus)).map((i) => i.id),
      reviewQueue(corpus).map((i) => i.id),
      JSON.stringify(corpus.map((i) => [i.id, i.layer, i.status])),
    );
  }
});

test('select reports the queue, not every draft, in its index summary', () => {
  const sel = select([
    item({ id: 'REQ-p', status: 'draft' }),
    item({ id: 'REQ-g', status: 'draft', layer: 'global' }),
  ], { event: 'session-start' }, CONFIG);
  assert.equal(sel.index.drafts, 1);
});

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}
