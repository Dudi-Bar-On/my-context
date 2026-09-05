import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isDerivedFixtureState, materializeDocFixture } from '../../scripts/doc-fixture.ts';
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

    // Scope restricts, so an unscoped item is the UNRESTRICTED case, not the
    // index-only one: section 4's just-in-time example shows unscoped items
    // arriving alongside the ones that named the file.
    const unscoped = indexed.filter((r) =>
      r.status === 'active' && !r.always && r.scope.length === 0);
    assert.ok(unscoped.length > 0, 'needs an unscoped item to show unrestricted behaviour');

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
 * The ingest walkthrough, end to end, exactly as a generated example runs it:
 * no stdin, every payload passed with `--file`, every command against one
 * materialized workspace.
 *
 * The session id is pinned. It is derived from the source path AND the
 * document's checksum (`makeSessionId`, src/ingest/session.ts), so editing a
 * word of `docs/prd.md` mints a different id — and every `ingest-apply`
 * marker in the documentation names that id literally. Without this
 * assertion the failure surfaces as a regenerated block that says "no such
 * session" in whichever document happened to be regenerated first.
 */
test('the ingest walkthrough runs against the fixture with --file alone', () => {
  const dir = materialize();
  try {
    const session = 'ING-docs-prd-md-dd2990c9-9e3efbae';

    const request = run(['ingest', 'docs/prd.md'], dir);
    assert.equal(request.code, 0, request.out);
    assert.match(request.out, new RegExp(`EXTRACTION REQUEST — docs/prd\\.md`), request.out);
    assert.match(request.out, new RegExp(`"session": "${session}"`), request.out);

    // One `--file` per chunk, in document order, which is the order a
    // resumed session hands them out in. The counts are pinned per anchor:
    // a candidate file the validator refuses still exits 0 and still reports
    // success for its siblings, so only the count says nothing was dropped.
    // The preamble chunk extracts NOTHING, which is a documented answer and
    // not a failure — `[]` is what honest narrative prose produces.
    const created: Record<string, number> = {
      'bookstore-api-prd': 0, 'catalogue-and-search': 2, 'checkout-and-payments': 3,
    };
    for (const [anchor, count] of Object.entries(created)) {
      const applied = run(
        ['ingest-apply', session, '--anchor', anchor, '--file', `docs/prd-candidates-${anchor}.json`],
        dir,
      );
      assert.equal(applied.code, 0, applied.out);
      assert.match(applied.out,
        new RegExp(`${anchor} — created ${count}, deduped 0, superseded 0\\.`), applied.out);
      assert.doesNotMatch(applied.out, /candidates? rejected —/, applied.out);
    }

    const review = run(['review', 'list'], dir);
    assert.equal(review.code, 0, review.out);
    for (const id of [
      'CONST-carts-expire-in-30-minutes', 'REQ-refunds-use-payment-intents',
      'NOGOAL-guest-checkout-is-excluded', 'INV-isbn-is-unique-per-tenant',
      'CONST-search-pages-hold-50-titles',
    ]) assert.match(review.out, new RegExp(id), review.out);

    const promoted = run(['review', 'promote', 'INV-isbn-is-unique-per-tenant', '--yes'], dir);
    assert.equal(promoted.code, 0, promoted.out);

    // The whole point of the drafts: nothing ingest wrote governs until this
    // ran, and the corpus is still healthy afterwards.
    //
    // Zero warnings, not five: DEC-the-document-extraction-schema-gains-a-
    // summary-field-so closed the gap this walkthrough used to demonstrate.
    // The candidate schema now REQUIRES a summary — written by the same
    // extractor that wrote title and body, while the source document was
    // still in view — so every one of these five items already carries one,
    // and `summary_absent` has nothing left to name here.
    const doctor = run(['doctor'], dir);
    assert.equal(doctor.code, 0, doctor.out);
    assert.match(doctor.out, /0 error\(s\), 0 warning\(s\), 0 note\(s\)/, doctor.out);
    assert.doesNotMatch(doctor.out, /summary_absent/, doctor.out);
  } finally {
    removeTree(dir);
  }
});

/**
 * The lesson → rule walkthrough, on the same terms. The staging key is a hash
 * of the candidate's own content (`candidateKey`, src/lesson/derive.ts), so a
 * reworded `docs/lesson-rule-candidates.json` renames the key that every
 * `lesson-accept` marker passes as an argument.
 */
test('the lesson walkthrough runs against the fixture with --file alone', () => {
  const dir = materialize();
  try {
    const lesson = 'LESSON-retry-storms-need-jitter';

    const derived = run(['lesson', lesson], dir);
    assert.equal(derived.code, 0, derived.out);
    assert.match(derived.out, /RULE DERIVATION REQUEST/, derived.out);

    const staged = run(
      ['lesson-stage', lesson, '--file', 'docs/lesson-rule-candidates.json'], dir);
    assert.equal(staged.code, 0, staged.out);
    assert.match(staged.out, /2 rule candidate\(s\) staged/, staged.out);
    assert.match(staged.out, /99eb0e3d/, staged.out);

    const accepted = run(['lesson-accept', lesson, '99eb0e3d'], dir);
    assert.equal(accepted.code, 0, accepted.out);
    assert.match(accepted.out, /created RULE-retries-add-jitter-to-backoff \(active\)/, accepted.out);

    const shown = run(['show', 'RULE-retries-add-jitter-to-backoff'], dir);
    assert.equal(shown.code, 0, shown.out);
    assert.match(shown.out, new RegExp(`derived_from \\[\\[${lesson}\\]\\]`), shown.out);
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
/**
 * The fixture now carries a source document and two candidate payloads, so
 * running `mycontext ingest` or `lesson-stage` inside
 * `test/fixtures/docs-workspace` is the obvious thing to do while writing a
 * walkthrough — and it leaves a session or a staging file behind. Copied into
 * an example's workspace, an already-applied session makes `mycontext ingest`
 * report a document with nothing left to extract: a plausible block that is a
 * fact about the maintainer's disk.
 */
test('derived state is never carried out of the fixture', () => {
  for (const skipped of ['.index.db', '.index.db-wal', '.index.db-shm', '.ingest', '.staging']) {
    assert.equal(isDerivedFixtureState(path.join('x', '.my_context', skipped)), true, skipped);
  }
  for (const kept of ['config.json', 'items', '.gitignore', '.revisions', 'prd.md']) {
    assert.equal(isDerivedFixtureState(path.join('x', '.my_context', kept)), false, kept);
  }
});

test('the committed fixture git-ignores its own index', () => {
  const fixture = new URL('../fixtures/docs-workspace/.my_context/.gitignore', import.meta.url);
  const lines = readFileSync(fixture, 'utf8').split('\n').map((l) => l.trim());
  assert.ok(lines.includes('.index.db'), lines.join(' | '));
});
