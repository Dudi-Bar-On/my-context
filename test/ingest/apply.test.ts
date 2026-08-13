import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { applyCandidates, candidateHash } from '../../src/ingest/apply.ts';
import { loadSession, openIngestSession, pendingAnchors, saveSession } from '../../src/ingest/session.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { Store } from '../../src/core/store.ts';
import { updateItem, type MutationContext } from '../../src/core/mutate.ts';

const DOC = `# Password policy\n\nPasswords must be at least 12 characters.\nSessions expire after 30 minutes.\n`;

function fixture(): { ctx: MutationContext; root: string; cleanup: () => void } {
  const base = mkdtempSync(path.join(tmpdir(), 'myctx-apply-'));
  const root = path.join(base, '.my_context');
  mkdirSync(path.join(root, 'items'), { recursive: true });
  const store = Store.open(':memory:');
  const ctx: MutationContext = { root, store, config: resolveConfig({}) };
  return { ctx, root, cleanup: () => { store.close(); rmSync(base, { recursive: true, force: true }); } };
}

function candidate(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'requirement',
    title: 'Passwords are at least 12 characters',
    body: 'Enforced at registration and at password change.',
    quote: 'Passwords must be at least 12 characters.',
    ...over,
  };
}

test('a new candidate is created as a draft with full provenance', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  const result = applyCandidates(ctx, session, 'password-policy', [candidate()]);

  assert.deepEqual(result.issues, []);
  assert.equal(result.created.length, 1);

  const item = ctx.store.get(result.created[0]);
  assert.ok(item);
  assert.equal(item.status, 'draft');
  assert.equal(item.origin, 'ingest');
  assert.equal(item.sourceFile, 'docs/prd/auth.md');
  assert.equal(item.sourceAnchor, 'password-policy');
  assert.equal(item.sourceChecksum, session.chunks[0].checksum);
  cleanup();
});

test('nothing ingested is ever active', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  applyCandidates(ctx, session, 'password-policy', [
    candidate(),
    candidate({ title: 'Sessions expire after 30 minutes', quote: 'Sessions expire after 30 minutes.' }),
  ]);
  assert.equal(ctx.store.all().length, 2);
  assert.equal(ctx.store.all().every((i) => i.status === 'draft'), true);
  assert.equal(ctx.store.all().every((i) => i.origin === 'ingest'), true);
  cleanup();
});

test('a rationale-tier candidate is a draft too — the invariant is not just the tier rule', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  // `trustedStatus` only demotes on the NORMATIVE tier, so a lesson would land
  // `active` if applyCandidates ever stopped passing `status: 'draft'`. This is
  // the half of "nothing ingested is ever active" the trust model does not cover.
  applyCandidates(ctx, session, 'password-policy', [candidate({
    type: 'lesson', title: 'Short passwords caused the breach',
  })]);
  assert.equal(ctx.store.all()[0].status, 'draft');
  cleanup();
});

test('re-applying identical candidates dedupes rather than duplicating', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  const first = applyCandidates(ctx, session, 'password-policy', [candidate()]);
  const second = applyCandidates(ctx, session, 'password-policy', [candidate()]);

  assert.deepEqual(second.created, []);
  assert.deepEqual(second.deduped, first.created);
  assert.equal(ctx.store.all().length, 1);
  cleanup();
});

test('identical content from a DIFFERENT source file does not dedupe — dedupe is scoped per source file', () => {
  // Rule 1 is explicitly "anywhere in the SAME source file". Two unrelated
  // source documents that happen to share a sentence (a shared boilerplate
  // clause, a copied requirement) must not silently merge into one item
  // just because their content hash matches.
  const { ctx, root, cleanup } = fixture();
  const first = openIngestSession(root, 'docs/prd/auth.md', DOC);
  const firstResult = applyCandidates(ctx, first, 'password-policy', [candidate()]);

  const second = openIngestSession(root, 'docs/prd/other.md', DOC);
  const secondResult = applyCandidates(ctx, second, 'password-policy', [candidate()]);

  assert.equal(secondResult.deduped.length, 0);
  assert.equal(secondResult.created.length, 1);
  assert.notEqual(secondResult.created[0], firstResult.created[0]);
  assert.equal(ctx.store.all().length, 2);
  cleanup();
});

test('identical content under a different anchor still dedupes', () => {
  const { ctx, root, cleanup } = fixture();
  const doc = `${DOC}\n# Repeated\n\nPasswords must be at least 12 characters.\n`;
  const session = openIngestSession(root, 'docs/prd/auth.md', doc);
  applyCandidates(ctx, session, 'password-policy', [candidate()]);
  const again = applyCandidates(ctx, session, 'repeated', [candidate()]);

  assert.equal(again.deduped.length, 1);
  assert.equal(ctx.store.all().length, 1);
  cleanup();
});

test('a materially changed item supersedes its predecessor instead of duplicating', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  const first = applyCandidates(ctx, session, 'password-policy', [candidate()]);
  const changed = applyCandidates(ctx, session, 'password-policy', [
    candidate({ body: 'Enforced at registration, change, and by the password reset flow.' }),
  ]);

  assert.equal(changed.superseded.length, 1);
  assert.equal(changed.superseded[0].previous, first.created[0]);
  assert.notEqual(changed.superseded[0].next, first.created[0]);

  const previous = ctx.store.get(first.created[0]);
  const next = ctx.store.get(changed.superseded[0].next);
  assert.equal(previous?.status, 'superseded');
  assert.equal(next?.status, 'draft');
  assert.deepEqual(
    next?.relations.filter((r) => r.type === 'supersedes'),
    [{ type: 'supersedes', target: first.created[0] }],
  );
  cleanup();
});

test('a second material change chains to r3 without colliding', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  applyCandidates(ctx, session, 'password-policy', [candidate()]);
  applyCandidates(ctx, session, 'password-policy', [candidate({ body: 'Second wording.' })]);
  const third = applyCandidates(ctx, session, 'password-policy', [candidate({ body: 'Third wording.' })]);

  assert.equal(third.superseded.length, 1);
  assert.equal(new Set(ctx.store.all().map((i) => i.id)).size, 3);
  assert.equal(ctx.store.all().filter((i) => i.status === 'draft').length, 1);
  cleanup();
});

test('a bad candidate is reported while its good siblings are still written', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  const result = applyCandidates(ctx, session, 'password-policy', [
    candidate(),
    candidate({ type: 'nonsense', title: 'Bad one' }),
  ]);

  assert.equal(result.created.length, 1);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].title, 'Bad one');
  assert.equal(ctx.store.all().length, 1);
  cleanup();
});

test('applying records the outcome on the session, including an empty extraction', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  applyCandidates(ctx, session, 'password-policy', []);
  assert.deepEqual(session.applied['password-policy'], []);
  cleanup();
});

test('an unknown anchor fails loudly and lists the real anchors', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  assert.throws(
    () => applyCandidates(ctx, session, 'not-a-heading', [candidate()]),
    /not-a-heading[\s\S]*password-policy/,
  );
  cleanup();
});

test('a supersede the trust model refuses is reported as an issue, not a crash', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  const first = applyCandidates(ctx, session, 'password-policy', [candidate()]);

  // A human promoted the draft. `supersedeItem` refuses to let a non-human
  // caller retire a governing normative item — see spec §7.1 on revision.
  updateItem(ctx, { id: first.created[0], status: 'active', origin: 'human' });

  const changed = applyCandidates(ctx, session, 'password-policy', [
    candidate({ body: 'Enforced at registration, change, and by the password reset flow.' }),
  ]);

  assert.deepEqual(changed.superseded, []);
  assert.equal(changed.issues.length, 1);
  assert.match(changed.issues[0].message, /cannot supersede a governing normative item/);
  assert.equal(ctx.store.get(first.created[0])?.status, 'active', 'the promoted item is untouched');
  cleanup();
});

test('the eleventh revision chains correctly even though "-r10" sorts before "-r2" lexically', () => {
  // `Store.all()` orders by id ascending, and lexical order of "-r2" .. "-r11"
  // is NOT chronological order ("-r10" < "-r2" as strings). The call that
  // creates r11 is the first one where the two orders actually diverge (r2..r9
  // alone sort identically either way) — so this specifically exercises the
  // call where "last in id-sorted iteration order" and "the actual current
  // head" are two different items. The head of a supersession chain must be
  // picked by `item.status !== 'superseded'`, not by iteration/insertion
  // order into the Map, or this resolves the wrong predecessor and leaves two
  // live drafts instead of one.
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  let previousId = applyCandidates(ctx, session, 'password-policy', [candidate()]).created[0];
  for (let revision = 2; revision <= 11; revision++) {
    const step = applyCandidates(ctx, session, 'password-policy', [
      candidate({ body: `Wording ${revision}.` }),
    ]);
    assert.equal(step.superseded.length, 1);
    assert.equal(step.superseded[0].previous, previousId);
    previousId = step.superseded[0].next;
  }
  assert.equal(previousId, 'REQ-passwords-are-at-least-12-characters-r11');
  const draftCount = ctx.store.all().filter((i) => i.status === 'draft').length;
  assert.equal(draftCount, 1);
  assert.equal(ctx.store.get(previousId)?.status, 'draft');
  cleanup();
});

test('a caller that reloads the session before each chunk sees the other chunk already applied', () => {
  // Simulates the shape the future CLI apply loop must have: a fresh
  // `loadSession` immediately before each chunk, not one `pendingAnchors`
  // snapshot computed before the whole loop. `applyCandidates` itself only
  // ever sees one anchor at a time, so this pins the CONTRACT it relies on
  // its caller upholding — a stale snapshot would still list "auth" as
  // pending here even after it was applied and saved, and a loop trusting
  // that stale list would re-run extraction (and re-append) on it.
  const { ctx, root, cleanup } = fixture();
  const doc = `${DOC}\n# Second\n\nSessions expire after 30 minutes.\n`;
  const session = openIngestSession(root, 'docs/prd/auth.md', doc);
  saveSession(root, session);

  applyCandidates(ctx, session, 'password-policy', [candidate()]);
  saveSession(root, session);

  // Fresh reload — what a correctly-written loop does before its NEXT
  // iteration, instead of trusting `pendingAnchors(session)` computed once
  // up front.
  const reloaded = loadSession(root, session.id);
  assert.deepEqual(pendingAnchors(reloaded), ['second']);

  const second = applyCandidates(ctx, reloaded, 'second', [
    candidate({ title: 'Sessions expire after 30 minutes', quote: 'Sessions expire after 30 minutes.' }),
  ]);
  assert.equal(second.created.length, 1);
  assert.equal(ctx.store.all().length, 2);
  cleanup();
});

test('candidateHash ignores whitespace and the quote, but not wording', () => {
  const base = { type: 'requirement', title: 'A', body: 'B', quote: 'q', severity: 'soft' as const, scope: [], tags: [], observations: [], extra: {} };
  assert.equal(candidateHash(base), candidateHash({ ...base, title: '  A  ' }));
  // Re-quoting a different sentence for the same requirement is not a material
  // change — the hash deliberately excludes `quote`, and this pins that.
  assert.equal(candidateHash(base), candidateHash({ ...base, quote: 'a different quote' }));
  assert.notEqual(candidateHash(base), candidateHash({ ...base, body: 'C' }));
});
