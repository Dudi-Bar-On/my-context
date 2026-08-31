/**
 * `doctor`'s tag-projection check — the gate whose absence let a field and the
 * tag projected from it disagree on fifteen of this project's own task items
 * without a single line of output anywhere.
 *
 * Run through `runChecks`, not by calling `checkTagProjection` alone, because
 * being IN the list is half of what is being asserted: a check nobody
 * registered reports exactly as much as a check nobody wrote.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { exitCode, summarize } from '../../src/cli/commands/doctor.ts';
import type { CategoryUpdates } from '../../src/core/categories.ts';
import { resolveConfig, type Config } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';
import { runChecks, type Finding } from '../../src/doctor/checks.ts';
import { removeTree } from '../helpers/tmp.ts';

const STATE: CategoryUpdates = {
  state: {
    store: 'field',
    values: ['todo', 'doing', 'done', 'blocked'],
    projectsTo: 'state',
    command: 'mycontext edit <id> --state <value>',
    note: 'Where this task has got to. The `state:` tag is generated from it.',
  },
};

function config(updates: CategoryUpdates = STATE): Config {
  const resolved = resolveConfig({
    categories: {
      task: {
        tier: 'rationale',
        prefix: 'TASK',
        description: 'A unit of planned work, tracked to completion.',
        extraFields: ['plan', 'seq', 'state'],
      },
    },
  });
  resolved.categories.task.updates = updates;
  return resolved;
}

function task(id: string, tags: string[], extra: Record<string, string>): Item {
  return {
    id, type: 'task', title: id, status: 'active', severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null,
    scope: [], tags, origin: 'human', sourceFile: null, sourceAnchor: null,
    sourceChecksum: null, validFrom: null, validUntil: null, checksum: 'x', extra,
    body: '', steps: [], observations: [], relations: [], layer: 'project',
    filePath: `items/task/${id}.md`,
  };
}

/** Every projection finding `runChecks` produces for this corpus, and nothing else. */
function projectionFindings(items: Item[], cfg: Config): Finding[] {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-projection-doctor-'));
  try {
    return runChecks({
      root: path.join(dir, '.my_context'),
      repoRoot: dir,
      dbPath: path.join(dir, '.my_context', '.index.db'),
      items,
      config: cfg,
    }).filter((f) => f.code.startsWith('tag_projection'));
  } finally {
    removeTree(dir);
  }
}

/** The fifteen real disagreements, in miniature: one item per kind. */
const MIXED: Item[] = [
  task('TASK-stale', ['plan:categories', 'state:done'], { state: 'doing' }),
  task('TASK-duplicate', ['state:done', 'state:todo'], { state: 'done' }),
  task('TASK-absent', ['plan:categories'], { state: 'blocked' }),
  task('TASK-donee', ['state:donee'], { state: 'donee' }),
  task('TASK-unprojected', ['state:todo'], {}),
  task('TASK-agrees', ['plan:categories', 'state:todo'], { state: 'todo' }),
];

test('doctor reports every item whose field and projection disagree, and no others', () => {
  const findings = projectionFindings(MIXED, config());
  assert.deepEqual(
    findings.map((f) => [f.item, f.code, f.level]),
    [
      ['TASK-stale', 'tag_projection_drift', 'error'],
      ['TASK-duplicate', 'tag_projection_drift', 'error'],
      ['TASK-absent', 'tag_projection_drift', 'error'],
      ['TASK-donee', 'tag_projection_drift', 'error'],
      ['TASK-unprojected', 'tag_projection_unprojected', 'info'],
    ],
  );
});

/**
 * A doctor code carries exactly one level: the grouped report prints
 * `bucket[0].level` as the heading for the whole group (doctor.ts), so a code
 * whose findings disagree about their level labels its own output wrong.
 */
test('each projection code carries exactly one level', () => {
  const byCode = new Map<string, Set<string>>();
  for (const f of projectionFindings(MIXED, config())) {
    byCode.set(f.code, (byCode.get(f.code) ?? new Set()).add(f.level));
  }
  for (const [code, levels] of byCode) {
    assert.equal(levels.size, 1, `${code} reports ${[...levels].join(' and ')}`);
  }
});

/**
 * A disagreement makes a filter return the wrong set — silently, and in both
 * directions — so it fails the build. Not having been migrated yet does not:
 * eighty `task` items in this project's own corpus carried a projected tag and
 * no field on the day this shipped, and turning the whole corpus red for that
 * would make the exit code useless on the one day it matters.
 */
test('a drift fails doctor and an unmigrated item does not', () => {
  const drift = projectionFindings([MIXED[0]], config());
  assert.equal(exitCode(summarize(drift), 0), 1);

  const unmigrated = projectionFindings([task('TASK-u', ['state:todo'], {})], config());
  assert.equal(exitCode(summarize(unmigrated), 0), 0);
});

/** Each message has to say which value is where; a finding a person cannot act
 * on is a finding they will learn to skip. */
test('the drift message names the field value, the tag and the command that fixes it', () => {
  const [stale, duplicate, absent, donee] = projectionFindings(MIXED, config());

  assert.match(stale.message, /"state": "doing"/);
  assert.match(stale.message, /"state:done"/);
  assert.match(stale.message, /mycontext edit <id> --state <value>/);
  assert.match(stale.message, /update is not a legal operation on a tag/);

  assert.match(duplicate.message, /carries 2 tags under "state:"/);
  assert.match(duplicate.message, /silent third membership/);

  assert.match(absent.message, /invisible to `mycontext focus state:blocked`/);

  assert.match(donee.message, /outside the declared vocabulary/);
  assert.match(donee.message, /Declared values: todo, doing, done, blocked\./);
});

/**
 * The check costs a corpus nothing until somebody declares a projection, which
 * is the state every project that has not adopted one is in — including this
 * one, until plan:categories seq 14 makes `updates` authorable in config.json.
 */
test('a corpus whose categories declare no projection produces no finding at all', () => {
  assert.deepEqual(projectionFindings(MIXED, config({})), []);
});

/** A check that throws must never suppress the others — `runChecks` catches,
 * and this asserts nothing here is what it catches. */
test('the check does not throw on an item whose category is absent from config', () => {
  const orphan = { ...task('TASK-orphan', ['state:done'], { state: 'todo' }), type: 'gone' };
  assert.deepEqual(projectionFindings([orphan], config()), []);
});
