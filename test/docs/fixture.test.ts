import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { materializeDocFixture } from '../../scripts/doc-fixture.ts';
import { runCli } from '../../src/cli/index.ts';
import { Store } from '../../src/core/store.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

function materialize(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-docfix-'));
  materializeDocFixture(dir);
  return dir;
}

/** Read back through the index the materializer just built, not off disk. */
function rows(dir: string): Item[] {
  const store = Store.open(path.join(dir, '.my_context', '.index.db'));
  try {
    return store.all();
  } finally {
    store.close();
  }
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

test('the doc fixture materializes and indexes', () => {
  const dir = materialize();
  try {
    const indexed = rows(dir);

    assert.ok(indexed.length >= 8, `expected a demonstrative corpus, got ${indexed.length}`);
    assert.ok(indexed.some((r) => r.always), 'needs a pinned item');
    assert.ok(indexed.some((r) => r.status === 'draft'), 'needs a draft for the review example');
    assert.ok(indexed.some((r) => r.status === 'superseded'), 'needs a superseded item');
  } finally {
    removeTree(dir);
  }
});

/**
 * The corpus the documentation plan requires. Asserted on the MATERIALIZED
 * copy rather than by reading the committed Markdown, because what the
 * examples will show is whatever survives a rebuild — an item that parses but
 * fails to index would still be present on disk and absent from every command.
 *
 * Each row is one thing a documentation section has to be able to show. A
 * fixture that quietly loses one of them does not fail loudly on its own: the
 * example block simply renders a smaller table, and the prose around it goes
 * on describing a feature the reader can no longer see demonstrated.
 */
test('the corpus demonstrates every case the documentation shows', () => {
  const dir = materialize();
  try {
    const indexed = rows(dir);
    const byId = new Map(indexed.map((r) => [r.id, r]));

    const scoped = indexed.filter((r) => r.status === 'active' && r.scope.length > 0);
    assert.ok(scoped.length > 0, 'needs an active scoped item for the JIT example');

    const unscoped = indexed.filter((r) =>
      r.status === 'active' && !r.always && r.scope.length === 0);
    assert.ok(unscoped.length > 0, 'needs an unscoped item to show index-only behaviour');

    // Both tiers, by category rather than by a tier column: `items` has no
    // tier of its own — the tier is a property of the CONFIGURED category.
    assert.ok(indexed.some((r) => ['constraint', 'invariant', 'rule', 'requirement', 'standard']
      .includes(r.type)), 'needs a normative item');
    assert.ok(indexed.some((r) => ['decision', 'lesson', 'adr'].includes(r.type)),
      'needs a rationale item');

    // The retirement example is only an example if both ends of it are here.
    const retired = indexed.find((r) => r.status === 'superseded');
    assert.ok(retired, 'needs a superseded item');
    const file = readFileSync(
      path.join(dir, '.my_context', 'items', retired.type, `${retired.id}.md`), 'utf8');
    const replacement = /superseded_by \[\[([^\]]+)\]\]/.exec(file)?.[1];
    assert.ok(replacement, `${retired.id} records no superseded_by relation`);
    assert.ok(byId.has(replacement),
      `${retired.id} is superseded by ${replacement}, which is not in the corpus`);
  } finally {
    removeTree(dir);
  }
});

/**
 * Every command whose output the documentation pastes, executed against the
 * materialized fixture. This is the assertion that a fixture *containing* a
 * draft is not the same as a fixture whose `review list` shows one: the
 * review queue, the decay report and the status counts each apply their own
 * filters, and an item can satisfy all of the above and still never appear.
 *
 * `doctor` is held to zero findings, exit code included. Every example block
 * in the documentation is produced from this workspace, so a fixture that
 * warns about its own dead scope globs would teach the reader that a warning
 * is the normal state of a healthy corpus.
 */
test('the reporting commands show the fixture as the documentation describes it', () => {
  const dir = materialize();
  try {
    const doctor = run(['doctor'], dir);
    assert.equal(doctor.code, 0, doctor.out);
    assert.match(doctor.out, /0 error\(s\), 0 warning\(s\), 0 note\(s\)/, doctor.out);

    const list = run(['list'], dir);
    assert.equal(list.code, 0, list.out);
    assert.match(list.out, /CONST-postgres-pool-capped-at-20/, list.out);

    const review = run(['review', 'list'], dir);
    assert.equal(review.code, 0, review.out);
    assert.match(review.out, /RULE-cache-keys-include-tenant-id/, review.out);
    assert.match(review.out, /1 draft\(s\) pending/, review.out);

    const status = run(['status'], dir);
    assert.equal(status.code, 0, status.out);
    assert.match(status.out, /1 draft\(s\) pending review/, status.out);

    const decay = run(['decay'], dir);
    assert.equal(decay.code, 0, decay.out);
    assert.match(decay.out, /REQ-checkout-completes-in-two-steps/, decay.out);

    const show = run(['show', 'CONST-postgres-pool-capped-at-20'], dir);
    assert.equal(show.code, 0, show.out);
    assert.match(show.out, /always: true/, show.out);
  } finally {
    removeTree(dir);
  }
});

/**
 * `.index.db` is disposable by design (INV-markdown-is-the-source-of-truth),
 * so a committed one would drift from the Markdown that defines it. The
 * fixture ships the `.gitignore` `mycontext init` wrote, and this fails if a
 * later edit drops it — at which point the first `git add` after a
 * materialize-in-place would commit the binary without anyone noticing.
 */
test('the committed fixture git-ignores its own index', () => {
  const fixture = new URL('../fixtures/docs-workspace/.my_context/.gitignore', import.meta.url);
  const lines = readFileSync(fixture, 'utf8').split('\n').map((l) => l.trim());
  assert.ok(lines.includes('.index.db'), lines.join(' | '));
});
