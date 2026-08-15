import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { applyCandidates, candidateHash, ingestKey } from '../../src/ingest/apply.ts';
import {
  loadSession, openIngestSession, pendingAnchors, saveSession, SESSION_PROTOCOL,
  type IngestSession,
} from '../../src/ingest/session.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { Store } from '../../src/core/store.ts';
import { createItem, updateItem, type MutationContext } from '../../src/core/mutate.ts';
import { checksum } from '../../src/core/slug.ts';
import { removeTree } from '../helpers/tmp.ts';

const DOC = `# Password policy\n\nPasswords must be at least 12 characters.\nSessions expire after 30 minutes.\n`;

function fixture(): { ctx: MutationContext; root: string; cleanup: () => void } {
  const base = mkdtempSync(path.join(tmpdir(), 'myctx-apply-'));
  const root = path.join(base, '.my_context');
  mkdirSync(path.join(root, 'items'), { recursive: true });
  const store = Store.open(':memory:');
  const ctx: MutationContext = { root, store, config: resolveConfig({}) };
  return { ctx, root, cleanup: () => { store.close(); removeTree(base); } };
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

test('candidateHash is sensitive to severity — a soft-to-hard change is a material change', () => {
  const base = { type: 'requirement', title: 'A', body: 'B', quote: 'q', severity: 'soft' as const, scope: [], tags: [], observations: [], extra: {} };
  assert.notEqual(candidateHash(base), candidateHash({ ...base, severity: 'hard' as const }));
});

test('candidateHash sorts extra keys ordinally, not via localeCompare (locale-dependent, cross-runtime unsafe)', () => {
  // "Zebra" sorts BEFORE "apple" ordinally (0x5A < 0x61) but AFTER it under a
  // typical locale-aware compare (case-insensitive alphabetical order). This
  // is written into every ingested item's `extra.content_hash` — a locale-
  // dependent sort would make the same candidate hash differently on
  // `windows-latest` vs `ubuntu-latest` if their ICU data ever disagreed.
  const base = {
    type: 'requirement', title: 'A', body: 'B', quote: 'q', severity: 'soft' as const,
    scope: [], tags: [], observations: [],
    extra: { Zebra: '1', apple: '2' },
  };
  const reordered = { ...base, extra: { apple: '2', Zebra: '1' } };
  assert.equal(candidateHash(base), candidateHash(reordered), 'input order must not matter');

  const expectedOrdinalOrder = checksum(JSON.stringify({
    type: base.type, title: base.title, body: base.body, severity: base.severity,
    observations: [], extra: [['Zebra', '1'], ['apple', '2']],
  }));
  assert.equal(candidateHash(base), expectedOrdinalOrder);
});

test('a candidate whose extraction anchor slugifies to "constructor" does not crash the batch — bare bracket access on the applied map is forbidden', () => {
  // `session.applied` is a plain object keyed by slugified anchors, which can
  // spell any Object.prototype member's name. Before this was fixed,
  // `session.applied[anchor] ?? []` at the top of applyCandidates read back
  // the INHERITED `Object.prototype.constructor` function (truthy, so `??`
  // never kicked in) instead of `undefined`, and the first `records.push(...)`
  // then threw `TypeError: records.push is not a function` — AFTER
  // `createItem` had already durably written the item and its Markdown file.
  const { ctx, root, cleanup } = fixture();
  const doc = '# Constructor\n\nAll passwords must be salted before hashing.\n';
  const session = openIngestSession(root, 'docs/prd/auth.md', doc);
  assert.equal(session.chunks[0].anchor, 'constructor');

  const result = applyCandidates(ctx, session, 'constructor', [candidate({
    title: 'Passwords are salted before hashing',
    body: 'Prevents rainbow-table attacks against the credential store.',
    quote: 'All passwords must be salted before hashing.',
  })]);

  assert.equal(result.created.length, 1);
  assert.ok(ctx.store.get(result.created[0]));
  // The apply record for this call must actually exist and be readable back
  // — not just "didn't throw". `hasApplied`/`appliedRecordsFor` (session.ts)
  // are the safe accessor; a raw `session.applied.constructor` read here
  // would independently hit the exact same prototype hazard this test guards.
  assert.equal(pendingAnchors(session).includes('constructor'), false);
  cleanup();
});

test('a chunk whose candidates are ALL rejected by validation stays pending, not permanently applied', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  const result = applyCandidates(ctx, session, 'password-policy', [
    candidate({ type: 'nonsense', title: 'Bad one' }),
  ]);

  assert.equal(result.created.length, 0);
  assert.equal(result.issues.length, 1);
  // The anchor must still be pending: nothing was created, and there was a
  // reason nothing was created worth resurfacing. Marking it applied would
  // make `pendingAnchors` never list it again, silently dropping the
  // rejected candidate for good.
  assert.equal(pendingAnchors(session).includes('password-policy'), true);

  // Re-submitting a GOOD candidate for the same still-pending anchor must
  // still work normally.
  const retry = applyCandidates(ctx, session, 'password-policy', [candidate()]);
  assert.equal(retry.created.length, 1);
  assert.equal(pendingAnchors(session).includes('password-policy'), false);
  cleanup();
});

test('an anchor already legitimately applied stays applied even if a later re-run yields only rejects', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  applyCandidates(ctx, session, 'password-policy', [candidate()]);
  assert.equal(pendingAnchors(session).includes('password-policy'), false);

  applyCandidates(ctx, session, 'password-policy', [candidate({ type: 'nonsense', title: 'Bad one' })]);
  // Still applied — this anchor already has real applied records from the
  // first call; a batch of only-rejects on a re-run must not un-apply it.
  assert.equal(pendingAnchors(session).includes('password-policy'), false);
  cleanup();
});

test('two candidates in one batch whose titles collide only after 60-character slug truncation do not collapse into a supersession', () => {
  // "...reaches internal admin endpoints..." and "...reaches internal public
  // endpoints..." share a 57-character common prefix, so `slugify` (which
  // truncates at 60 chars) produces the exact same `baseId` for both. Before
  // `ingestKey` folded in a hash of the full title, both would resolve to
  // the same ingest key and the second would silently retire the first as
  // if it were a re-extraction of it — collapsing two distinct requirements
  // from the same document into one.
  const { ctx, root, cleanup } = fixture();
  const prefix = 'Reject any unauthenticated request that reaches internal ';
  const t1 = `${prefix}admin endpoints without a valid session token`;
  const t2 = `${prefix}public endpoints without a valid session token`;
  const doc = `# Access control\n\n${t1}\n\n${t2}\n`;
  const session = openIngestSession(root, 'docs/prd/auth.md', doc);

  const result = applyCandidates(ctx, session, 'access-control', [
    candidate({ title: t1, quote: t1, body: 'Admin surface.' }),
    candidate({ title: t2, quote: t2, body: 'Public surface.' }),
  ]);

  assert.deepEqual(result.issues, []);
  assert.equal(result.created.length, 2, 'both are distinct items, not one create + one supersede');
  assert.equal(result.superseded.length, 0);
  assert.notEqual(result.created[0], result.created[1]);
  assert.equal(ctx.store.all().length, 2);

  // N2: the id that lost the naming coin-flip must NOT read as "revision 2
  // of" the first item — it is not a revision, it's an unrelated item that
  // merely collided on a truncated slug. `-rN` is reserved for genuine
  // revisions (an `ingestKey` match); this must use the same non-revision
  // suffix `locateInFamily` (mutate.ts) already uses for its own family
  // disambiguation.
  const second = ctx.store.get(result.created[1])!;
  assert.match(second.id, /-2$/);
  assert.doesNotMatch(second.id, /-r2$/);
  assert.deepEqual(second.relations.filter((r) => r.type === 'supersedes'), []);
  cleanup();
});

test('ingestKey folds in the anchor — the same title at a different anchor is a different key', () => {
  const a = ingestKey('anchor-one', 'REQ-x', 'Some title');
  const b = ingestKey('anchor-two', 'REQ-x', 'Some title');
  assert.notEqual(a, b);
});

test('ingestKey tolerates case and trailing punctuation — a reworded title is still "the same item"', () => {
  const a = ingestKey('anchor', 'REQ-x', 'Passwords are at least 12 characters');
  const b = ingestKey('anchor', 'REQ-x', 'Passwords are at least 12 characters.');
  const c = ingestKey('anchor', 'REQ-x', 'Passwords Are At Least 12 Characters');
  assert.equal(a, b);
  assert.equal(a, c);
});

test('a reworded re-extraction of an unchanged document (trailing punctuation) supersedes rather than duplicating', () => {
  // The I3 scenario: a non-deterministic LLM re-running an UNCHANGED
  // document reproduces a reworded title. This must still chain as a
  // revision, not mint a second live draft competing at the same anchor.
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  const first = applyCandidates(ctx, session, 'password-policy', [candidate()]);
  const reworded = applyCandidates(ctx, session, 'password-policy', [
    candidate({
      title: 'Passwords are at least 12 characters.', // trailing period added
      body: 'Enforced at registration, at password change, and at reset.',
    }),
  ]);

  assert.equal(reworded.superseded.length, 1);
  assert.equal(reworded.superseded[0].previous, first.created[0]);
  const drafts = ctx.store.all().filter((i) => i.status === 'draft');
  assert.equal(drafts.length, 1, 'exactly one live draft, not two competing ones');
  cleanup();
});

test('a reworded re-extraction of an unchanged document (case only) supersedes rather than duplicating', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  const first = applyCandidates(ctx, session, 'password-policy', [candidate()]);
  const reworded = applyCandidates(ctx, session, 'password-policy', [
    candidate({
      title: 'Passwords Are At Least 12 Characters', // case only
      body: 'Enforced at registration, at password change, and at reset.',
    }),
  ]);

  assert.equal(reworded.superseded.length, 1);
  assert.equal(reworded.superseded[0].previous, first.created[0]);
  const drafts = ctx.store.all().filter((i) => i.status === 'draft');
  assert.equal(drafts.length, 1, 'exactly one live draft, not two competing ones');
  cleanup();
});

test('the same title with a changed body at a DIFFERENT anchor creates a new item, not a supersession', () => {
  // Rule 2 requires the SAME anchor. A different anchor sharing the same
  // title must not be treated as "the same item, re-extracted".
  const { ctx, root, cleanup } = fixture();
  const doc =
    `# Password policy\n\nPasswords must be at least 12 characters.\n\n` +
    `# Password policy redux\n\nPasswords must be at least 12 characters.\n`;
  const session = openIngestSession(root, 'docs/prd/auth.md', doc);

  const first = applyCandidates(ctx, session, 'password-policy', [candidate()]);
  const second = applyCandidates(ctx, session, 'password-policy-redux', [
    candidate({ body: 'A differently-worded rationale for the very same rule.' }),
  ]);

  assert.equal(second.created.length, 1);
  assert.equal(second.superseded.length, 0);
  assert.notEqual(second.created[0], first.created[0]);
  assert.equal(ctx.store.all().length, 2);
  assert.equal(ctx.store.get(first.created[0])?.status, 'draft', 'the first item was not retired');
  cleanup();
});

test('the applied log records "deduped", not "created", for a deduped candidate', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  const first = applyCandidates(ctx, session, 'password-policy', [candidate()]);
  applyCandidates(ctx, session, 'password-policy', [candidate()]);

  const records = session.applied['password-policy'];
  assert.equal(records.length, 2);
  assert.equal(records[0].action, 'created');
  assert.equal(records[0].itemId, first.created[0]);
  assert.equal(records[1].action, 'deduped');
  assert.equal(records[1].itemId, first.created[0]);
  cleanup();
});

test('the applied log records one entry per outcome — created, superseded, and deduped are each captured with their real fields', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);

  const created = applyCandidates(ctx, session, 'password-policy', [candidate()]);
  const superseded = applyCandidates(ctx, session, 'password-policy', [
    candidate({ body: 'Reworded rationale.' }),
  ]);
  applyCandidates(ctx, session, 'password-policy', [candidate({ body: 'Reworded rationale.' })]); // dedupes against the r2

  const records = session.applied['password-policy'];
  assert.equal(records.length, 3, 'one ApplyRecord per applyCandidates call in this test');

  assert.equal(records[0].action, 'created');
  assert.equal(records[0].itemId, created.created[0]);
  assert.equal(records[0].previousId, undefined);

  assert.equal(records[1].action, 'superseded');
  assert.equal(records[1].itemId, superseded.superseded[0].next);
  assert.equal(records[1].previousId, created.created[0]);

  assert.equal(records[2].action, 'deduped');
  assert.equal(records[2].itemId, superseded.superseded[0].next);

  for (const r of records) {
    assert.equal(typeof r.candidateHash, 'string');
    assert.ok(r.candidateHash.length > 0);
    assert.equal(typeof r.at, 'string');
  }
  cleanup();
});

test('an anchor literally "__proto__" writes an own applied-map entry, not the object\'s prototype', () => {
  // No real document can produce this anchor — `slugify` collapses every
  // underscore run to a single hyphen, so `"__proto__"` slugifies to
  // `"proto"`, and the one hardcoded non-slugified anchor is `"_preamble"`,
  // not this. Constructed directly (bypassing openIngestSession's normal
  // chunking) to stress the write path structurally anyway: plain bracket
  // assignment (`applied[anchor] = records`) does NOT create an own
  // '__proto__' property — it invokes the inherited setter and reassigns
  // the object's actual prototype, corrupting every future lookup. This is
  // the write-side sibling of the "constructor" read-side regression test
  // above; `setApplied` (session.ts) is the guard.
  const { ctx, root, cleanup } = fixture();
  const session: IngestSession = {
    protocol: SESSION_PROTOCOL,
    id: 'ING-test-00000000-00000000',
    sourceFile: 'docs/prd/auth.md',
    sourceChecksum: 'deadbeefdeadbeef',
    createdAt: new Date().toISOString(),
    chunks: [{
      index: 0, anchor: '__proto__', heading: null,
      text: 'All passwords must be salted before hashing.',
      checksum: 'deadbeefdeadbeef',
    }],
    applied: {},
    rejected: [],
  };

  const result = applyCandidates(ctx, session, '__proto__', [candidate({
    title: 'Passwords are salted before hashing',
    body: 'Prevents rainbow-table attacks against the credential store.',
    quote: 'All passwords must be salted before hashing.',
  })]);

  assert.equal(result.created.length, 1);
  assert.equal(Object.getPrototypeOf(session.applied), Object.prototype, "session.applied's prototype must be untouched");
  assert.equal(pendingAnchors(session).includes('__proto__'), false);
  cleanup();
});

test('two items sharing a (hash-collided) content_hash dedupe deterministically to the first by id order', () => {
  // Under normal operation exactly one item per source file ever holds a
  // given `content_hash` — dedupe itself prevents a second one existing.
  // This directly forces the adversarial case (e.g. index corruption, or a
  // true SHA-256-truncation collision) to pin that `byHash`'s "first wins"
  // policy, built from `ctx.store.all()`'s id-ascending order, is
  // deterministic and not an accident of Map insertion order.
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  const probe = {
    type: 'requirement', title: 'Passwords are at least 12 characters',
    body: 'Enforced at registration and at password change.',
    quote: 'Passwords must be at least 12 characters.',
    severity: 'soft' as const, scope: [], tags: [], observations: [], extra: {},
  };
  const sharedHash = candidateHash(probe);

  createItem(ctx, {
    type: 'requirement', title: 'A first item', id: 'REQ-aaa-first', origin: 'ingest', status: 'draft',
    sourceFile: 'docs/prd/auth.md', sourceAnchor: 'password-policy',
    extra: { content_hash: sharedHash, ingest_key: 'other-key-1' },
  });
  createItem(ctx, {
    type: 'requirement', title: 'A second item', id: 'REQ-zzz-second', origin: 'ingest', status: 'draft',
    sourceFile: 'docs/prd/auth.md', sourceAnchor: 'password-policy',
    extra: { content_hash: sharedHash, ingest_key: 'other-key-2' },
  });

  const result = applyCandidates(ctx, session, 'password-policy', [probe]);
  assert.deepEqual(result.deduped, ['REQ-aaa-first']);
  cleanup();
});

/**
 * `scopePolicy: "required"` at the third capture surface spec §4b names.
 *
 * The refusal arrives as a per-candidate REJECTION rather than a throw, which
 * is the property under test: a batch keeps every success (spec §10), so one
 * unscoped candidate must not take down the scoped one beside it. Recorded in
 * `issues`, which the session persists to `<id>.rejected.jsonl`, so nothing is
 * dropped silently either.
 */
test('under scopePolicy required an unscoped candidate is rejected and the batch survives', () => {
  const { ctx, root, cleanup } = fixture();
  ctx.config = resolveConfig({ categories: { requirement: { scopePolicy: 'required' } } });
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);

  const result = applyCandidates(ctx, session, 'password-policy', [
    candidate(),
    candidate({
      title: 'Sessions expire after 30 minutes',
      quote: 'Sessions expire after 30 minutes.',
      scope: ['src/auth/**'],
    }),
  ]);

  assert.equal(result.created.length, 1, 'the scoped candidate still lands');
  assert.match(ctx.store.get(result.created[0])!.title, /Sessions expire/);
  assert.equal(result.issues.length, 1);
  assert.match(result.issues[0].message, /scopePolicy "required"/);
  cleanup();
});
