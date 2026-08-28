/**
 * **A report that caps its rows says what it dropped — at the DEFAULT cap,
 * not only when a human typed `--limit`.**
 *
 * Found by planning against the truncated list: `mycontext ready --summary`
 * said 124 ready, `mycontext ready` printed 50 rows and `mycontext ready
 * --json` returned 50, and nothing said anything about the 74 that were
 * dropped. Worse, the one "not listed above" sentence it DID print was about
 * the 12 HELD tasks — so a reader saw a disclosure, read it as *the*
 * disclosure, and took the list as complete. Two waves of work were planned
 * against it before anyone noticed.
 *
 * The existing suites cover `--limit 1`, where the cap is the reader's own
 * doing and hard to miss. These cover the default, where it is the tool's
 * doing and invisible — which is the case that actually went wrong, and the
 * case a regression would restore.
 *
 * The fix is NOT removing the cap: a 124-row table is not more usable than a
 * 50-row one. The defect is the silence, so that is what these assert.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

/** The default row cap `ready` and `todo` share. Not imported: a test that read
 * the constant would still pass if the constant and the disclosure drifted
 * apart, which is the whole failure mode. */
const DEFAULT_LIMIT = 50;
const MORE_THAN_THE_CAP = 62;

function run(args: string[], cwd: string): { code: number; out: string } {
  const lines: string[] = [];
  const code = runCli(args, cwd, (s) => lines.push(s));
  return { code, out: lines.join('\n') };
}

/** Wrapped prose collapsed to one line — see `todo.test.ts` for why. */
function prose(out: string): string {
  return out.replace(/\s+/g, ' ');
}

function json(out: string): Record<string, unknown> {
  return JSON.parse(out.slice(out.indexOf('{'))) as Record<string, unknown>;
}

const TASK_CATEGORY = {
  categories: {
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work, tracked to completion.',
      extraFields: ['plan', 'seq', 'state', 'priority', 'needs'],
    },
  },
};

function project(config: unknown = null): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-caps-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  if (config !== null) {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'), JSON.stringify(config, null, 2) + '\n',
    );
  }
  return cwd;
}

function writeItemFile(cwd: string, type: string, id: string, extra: string[] = []): void {
  const dir = path.join(cwd, '.my_context', 'items', type);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${id}.md`), [
    '---',
    `id: ${id}`,
    `type: ${type}`,
    `title: ${id}`,
    'status: active',
    'severity: soft',
    'always: false',
    'scope: []',
    'tags: []',
    'origin: human',
    ...extra,
    '---',
    '',
    `# ${id}`,
    '',
    'A body.',
    '',
  ].join('\n'), 'utf8');
}

// ── ready ───────────────────────────────────────────────────────────────────

test('ready says what the DEFAULT cap dropped, and says it before the held line', () => {
  const cwd = project(TASK_CATEGORY);
  try {
    for (let i = 1; i <= MORE_THAN_THE_CAP; i += 1) {
      writeItemFile(cwd, 'task', `TASK-w-${i}`, [
        'plan: "w"', `seq: "${i}"`, 'state: "todo"', 'priority: "1"',
      ]);
    }

    const { code, out } = run(['ready'], cwd);
    assert.equal(code, 0);
    assert.match(
      prose(out), new RegExp(`${MORE_THAN_THE_CAP} ready; ${DEFAULT_LIMIT} shown`),
      'the number dropped is the fact that changes what the reader does next',
    );
    assert.match(prose(out), new RegExp(`--limit ${MORE_THAN_THE_CAP}`), 'and the way to see them');
  } finally {
    removeTree(cwd);
  }
});

test('ready --json carries the total beside the rows, so a caller can tell', () => {
  const cwd = project(TASK_CATEGORY);
  try {
    for (let i = 1; i <= MORE_THAN_THE_CAP; i += 1) {
      writeItemFile(cwd, 'task', `TASK-w-${i}`, [
        'plan: "w"', `seq: "${i}"`, 'state: "todo"', 'priority: "1"',
      ]);
    }

    const doc = json(run(['ready', '--json'], cwd).out);
    assert.equal((doc.ready as unknown[]).length, DEFAULT_LIMIT);
    assert.equal(doc.count, DEFAULT_LIMIT);
    assert.equal(doc.readyTotal, MORE_THAN_THE_CAP);
    assert.equal(doc.truncated, true);
    assert.equal(doc.limit, DEFAULT_LIMIT);
  } finally {
    removeTree(cwd);
  }
});

test('ready under the cap says nothing about a cap that did not apply', () => {
  const cwd = project(TASK_CATEGORY);
  try {
    for (let i = 1; i <= 3; i += 1) {
      writeItemFile(cwd, 'task', `TASK-w-${i}`, [
        'plan: "w"', `seq: "${i}"`, 'state: "todo"', 'priority: "1"',
      ]);
    }
    const { out } = run(['ready'], cwd);
    assert.doesNotMatch(prose(out), /shown\./);
    assert.doesNotMatch(prose(out), /Raise the cap/);
    assert.equal(json(run(['ready', '--json'], cwd).out).truncated, false);
  } finally {
    removeTree(cwd);
  }
});

test('the held line and the truncation line are separate disclosures, both present', () => {
  // The specific trap: one "not listed above" sentence about HELD tasks read
  // as the whole disclosure, and the 74 dropped rows had none of their own.
  const cwd = project(TASK_CATEGORY);
  try {
    for (let i = 1; i <= MORE_THAN_THE_CAP; i += 1) {
      writeItemFile(cwd, 'task', `TASK-w-${i}`, [
        'plan: "w"', `seq: "${i}"`, 'state: "todo"', 'priority: "1"',
      ]);
    }
    writeItemFile(cwd, 'task', 'TASK-w-held', [
      'plan: "w"', 'seq: "99"', 'state: "blocked"', 'priority: "1"', 'needs: "w/absent"',
    ]);

    const out = prose(run(['ready'], cwd).out);
    assert.match(out, /ready; \d+ shown/, 'the rows the cap dropped');
    assert.match(out, /held and not listed above/, 'and, separately, the work that is not ready');
    assert.ok(
      out.indexOf('shown.') < out.indexOf('held and not listed above'),
      'the cap is disclosed first: the held line is the sentence that used to be mistaken for it',
    );
  } finally {
    removeTree(cwd);
  }
});

// ── todo ────────────────────────────────────────────────────────────────────

test('todo says what the DEFAULT cap dropped, and its --json carries the total', () => {
  const cwd = project();
  try {
    for (let i = 1; i <= MORE_THAN_THE_CAP; i += 1) writeItemFile(cwd, 'todo', `TODO-t-${i}`);

    const { out } = run(['todo'], cwd);
    assert.match(prose(out), new RegExp(`${MORE_THAN_THE_CAP} todo item\\(s\\); ${DEFAULT_LIMIT} shown`));
    assert.match(prose(out), new RegExp(`Raise the cap with --limit ${MORE_THAN_THE_CAP}`));

    const doc = json(run(['todo', '--json'], cwd).out);
    assert.equal((doc.items as unknown[]).length, DEFAULT_LIMIT);
    assert.equal(doc.matched, MORE_THAN_THE_CAP, 'the total the rows were taken from');
    assert.equal(doc.truncated, true);
    assert.equal(doc.limit, DEFAULT_LIMIT);
  } finally {
    removeTree(cwd);
  }
});

// ── decay ───────────────────────────────────────────────────────────────────

test('decay has no row cap at all, so there is nothing for it to disclose', () => {
  // `ready` was modelled on `todo` and `decay`. `todo` shares the cap and
  // discloses it; `decay` never had one, and this is what keeps that true —
  // a cap added here later without a disclosure would be the same defect a
  // third time.
  const cwd = project();
  try {
    for (let i = 1; i <= MORE_THAN_THE_CAP; i += 1) writeItemFile(cwd, 'rule', `RULE-r-${i}`);

    const refused = run(['decay', '--limit', '10'], cwd);
    assert.equal(refused.code, 1, 'no --limit means no cap to raise');
    assert.match(refused.out, /unknown option "--limit"|unknown flag "--limit"/);

    const doc = json(run(['decay', '--json'], cwd).out);
    const counts = doc.counts as Record<string, number>;
    const cold = doc.cold as unknown[];
    assert.equal(cold.length, counts.cold, 'every counted row is also a listed row');
    assert.ok(cold.length > DEFAULT_LIMIT, `${cold.length} cold rows, which is past any cap`);
  } finally {
    removeTree(cwd);
  }
});
