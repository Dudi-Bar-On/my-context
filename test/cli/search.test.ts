/**
 * `mycontext search` — the CLI counterpart `query_items` did not have, and the
 * asymmetry §8 of both READMEs used to record as permanent.
 *
 * The load-bearing test in this file is the last one: `search` and
 * `query_items` are asserted to select the SAME items for the same filters,
 * because they run one predicate (`filterItems`, src/core/search.ts) rather
 * than two. Everything above it is this command's own surface — the refusals
 * that keep a mistyped filter from being answered with a plausible, empty,
 * wrong result.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { removeTree } from '../helpers/tmp.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-search-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

interface Plant {
  id: string;
  type?: string;
  title: string;
  body?: string;
  scope?: string[];
  tags?: string[];
  status?: string;
}

function plant(cwd: string, item: Plant): void {
  const type = item.type ?? 'constraint';
  const file = path.join(cwd, '.my_context', 'items', type, `${item.id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  const scope = item.scope?.length
    ? `scope:\n${item.scope.map((g) => `  - "${g}"`).join('\n')}\n`
    : '';
  const tags = item.tags?.length
    ? `tags:\n${item.tags.map((t) => `  - ${t}`).join('\n')}\n`
    : '';
  writeFileSync(
    file,
    `---\nid: ${item.id}\ntype: ${type}\ntitle: ${item.title}\n` +
    `status: ${item.status ?? 'active'}\n${scope}${tags}---\n\n` +
    `# ${item.title}\n\n${item.body ?? 'Body.'}\n`,
    'utf8',
  );
}

/** The corpus every test below searches. Deliberately mixed: one scoped item,
 * one unscoped one, two categories, a tag, and a phrase that appears only in a
 * body. */
function corpus(cwd: string): void {
  plant(cwd, {
    id: 'CONST-pool', title: 'Connection pool capped at 20',
    body: 'Because the database licence allows 25 and two services share it.',
    scope: ['src/db/**'], tags: ['database'],
  });
  plant(cwd, {
    id: 'CONST-everywhere', title: 'No secrets in source',
    body: 'Applies to every file in the repository.',
  });
  plant(cwd, {
    id: 'DEC-stripe', type: 'decision', title: 'Stripe for payments',
    body: 'Settlement timing matched the payout schedule.', tags: ['billing'],
  });
}

test('a bare phrase searches title and body', () => {
  const cwd = project();
  try {
    corpus(cwd);
    const { code, out } = run(['search', 'settlement timing'], cwd);
    assert.equal(code, 0);
    assert.match(out, /DEC-stripe/);
    assert.doesNotMatch(out, /CONST-pool/);
  } finally {
    removeTree(cwd);
  }
});

test('--text and a bare phrase are the same filter, and giving both is refused', () => {
  const cwd = project();
  try {
    corpus(cwd);
    const viaFlag = run(['search', '--text', 'settlement timing'], cwd);
    const viaPhrase = run(['search', 'settlement timing'], cwd);
    assert.equal(viaFlag.out, viaPhrase.out, 'the two spellings must produce identical output');

    // Both at once has no reading that honours both, so it is refused rather
    // than answered with whichever one the parser happens to reach first.
    const both = run(['search', 'pool', '--text', 'stripe'], cwd);
    assert.equal(both.code, 1);
    assert.match(both.out, /two spellings of the same filter/);
  } finally {
    removeTree(cwd);
  }
});

test('--path returns the unscoped items too, because they govern every file', () => {
  const cwd = project();
  try {
    corpus(cwd);
    const { code, out } = run(['search', '--path', 'src/db/pool.ts'], cwd);
    assert.equal(code, 0);
    assert.match(out, /CONST-pool/, 'the item whose scope matches');
    assert.match(out, /CONST-everywhere/,
      'an item with no scope is unrestricted and governs this path — omitting it hides ' +
      'exactly the broadest items in the corpus');
  } finally {
    removeTree(cwd);
  }
});

test('search with no filter is refused, not answered with the whole corpus', () => {
  const cwd = project();
  try {
    corpus(cwd);
    const { code, out } = run(['search'], cwd);
    assert.equal(code, 1);
    assert.match(out, /at least one filter/);
    assert.match(out, /mycontext list/, 'the command that does list everything is named');
    assert.doesNotMatch(out, /CONST-pool/, 'no rows are printed for a filterless search');
  } finally {
    removeTree(cwd);
  }
});

test('a category that does not exist is refused rather than answered with zero rows', () => {
  const cwd = project();
  try {
    corpus(cwd);
    const { code, out } = run(['search', '--type', 'constraintt'], cwd);
    assert.equal(code, 1);
    assert.match(out, /constraintt/);
    // Not vacuous: a real category with no match answers 0, and says so.
    const empty = run(['search', '--type', 'risk', '--text', 'nothing matches this'], cwd);
    assert.equal(empty.code, 0);
    assert.match(empty.out, /0 item\(s\) match/);
  } finally {
    removeTree(cwd);
  }
});

test('a status or relation outside the vocabulary is refused in the shared words', () => {
  const cwd = project();
  try {
    corpus(cwd);
    const status = run(['search', '--text', 'pool', '--status', 'retired'], cwd);
    assert.equal(status.code, 1);
    assert.match(status.out, /status/);
    const relation = run(['search', '--text', 'pool', '--relation', 'depends_on'], cwd);
    assert.equal(relation.code, 1);
    assert.match(relation.out, /relation/);
  } finally {
    removeTree(cwd);
  }
});

test('an unknown flag is refused rather than absorbed', () => {
  const cwd = project();
  try {
    corpus(cwd);
    const { code, out } = run(['search', '--txt', 'pool'], cwd);
    assert.equal(code, 1);
    assert.match(out, /--txt/);
  } finally {
    removeTree(cwd);
  }
});

test('a truncated result says so and names the cap that fired', () => {
  const cwd = project();
  try {
    corpus(cwd);
    const { code, out } = run(['search', '--type', 'constraint', '--limit', '1'], cwd);
    assert.equal(code, 0);
    assert.match(out, /2 item\(s\) match; 1 shown/);
    assert.match(out, /--limit 2/);
  } finally {
    removeTree(cwd);
  }
});

test('--json carries the match count, the cap and whether it fired', () => {
  const cwd = project();
  try {
    corpus(cwd);
    const { code, out } = run(['search', '--type', 'constraint', '--limit', '1', '--json'], cwd);
    assert.equal(code, 0);
    const doc = JSON.parse(out);
    assert.equal(doc.matched, 2);
    assert.equal(doc.count, 1);
    assert.equal(doc.truncated, true);
    assert.equal(doc.limit, 1);
  } finally {
    removeTree(cwd);
  }
});

/**
 * The three commands that name `mycontext search` in their "no item with id"
 * message used to name `mycontext query --text "..."` — a flag `query` has
 * never accepted and refuses as unknown. A message that teaches a refusal is
 * worse than one that teaches nothing, so the command each of them names is
 * RUN here rather than compared to a string.
 */
test('the id-not-found messages name a command the CLI actually accepts', () => {
  const cwd = project();
  try {
    corpus(cwd);
    for (const argv of [['edit', 'NOPE-x', '--title', 'x'], ['supersede', 'NOPE-x', '--by', 'CONST-pool'], ['refresh', 'NOPE-x']]) {
      const { out } = run(argv, cwd);
      const match = out.match(/`mycontext ([a-z-]+) "\.\.\."`/);
      assert.ok(match, `${argv[0]} no longer points at a lookup command:\n${out}`);
      const named = run([match![1], 'pool'], cwd);
      assert.doesNotMatch(
        named.out, /unknown command|unknown flag|unrecognized/,
        `${argv[0]} points at \`mycontext ${match![1]}\`, which the CLI refuses`,
      );
    }
  } finally {
    removeTree(cwd);
  }
});

/**
 * **The parity that matters.** For each of the filters both surfaces accept,
 * `mycontext search --json` and `query_items` must select the same items. They
 * do because there is one predicate; a reimplementation on either side — the
 * `matchesScope`-versus-glob distinction being the likeliest one to get wrong
 * twice — fails here.
 */
test('mycontext search and query_items select the same items for the same filters', () => {
  const cwd = project();
  try {
    corpus(cwd);
    const registry = createRegistry(cwd);
    const cases: Record<string, unknown>[] = [
      { text: 'pool' },
      { type: 'constraint' },
      { tag: 'database' },
      { path: 'src/db/pool.ts' },
      { status: 'active', type: 'decision' },
      { text: 'the' },
    ];
    for (const filters of cases) {
      const argv = ['search', '--json'];
      for (const [key, value] of Object.entries(filters)) argv.push(`--${key}`, String(value));
      const { code, out } = run(argv, cwd);
      assert.equal(code, 0, `search failed for ${JSON.stringify(filters)}: ${out}`);
      const cli = (JSON.parse(out).items as { id: string }[]).map((i) => i.id).sort();

      const tool = registry.call('query_items', { ...filters, limit: 500 });
      const fromTool = [...tool.matchAll(/^([A-Z][A-Za-z0-9-]*) ·/gm)].map((m) => m[1]).sort();

      assert.deepEqual(
        cli, fromTool,
        `\`mycontext search\` and \`query_items\` disagree for ${JSON.stringify(filters)} — ` +
        `they must run one predicate, not two`,
      );
      assert.ok(cli.length > 0, `${JSON.stringify(filters)} matched nothing on either surface`);
    }
  } finally {
    removeTree(cwd);
  }
});
