import { checksum, makeId, normalizeForSlug } from '../core/slug.ts';
import {
  createItem, supersedeItem,
  type CreateInput, type MutationContext, type MutationResult,
} from '../core/mutate.ts';
import { CONTENT_HASH_KEY, INGEST_KEY_KEY } from '../core/trust.ts';
import type { Item } from '../core/types.ts';
import { validateCandidates, type Candidate, type ValidationIssue } from './schema.ts';
import { appliedRecordsFor, hasApplied, setApplied, type ApplyRecord, type IngestSession } from './session.ts';

/** Ordinal string compare: deterministic, unlike `Array.prototype.sort`'s
 * default coercion-to-string behavior would be for non-strings, and unlike
 * `localeCompare` (ICU/locale dependent, can return 0 for two DISTINCT
 * strings depending on the runtime's locale data) — the same rule
 * `select.ts`'s own `compareStrings` documents. `candidateHash` is written
 * into every ingested item's `extra.content_hash` frontmatter field and IS
 * the dedupe key across machines and CI runners (`windows-latest` and
 * `ubuntu-latest` do not ship the same ICU data), so this has to be the
 * plain `<`/`>` ordinal comparison every other identity-hashing function in
 * this codebase (`canonicalExtra`, mutate.ts) already uses, not a
 * locale-aware one. */
function compareOrdinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The dedupe key. Covers what the item *says*, deliberately excluding `quote`
 * and `scope`: re-quoting a different sentence for the same requirement is not
 * a material change, and re-scoping is an edit the user makes during review.
 * `tags` is excluded too, for the same "review-time edit, not a material
 * change" reason `scope` is — but unlike `scope`, a re-extraction that
 * changes only `tags` therefore dedupes against the existing item, and the
 * new tags are silently discarded rather than merged or applied: this
 * function decides identity, not what gets written, and `applyCandidates`
 * never revisits an item once `byHash` has matched it.
 */
export function candidateHash(c: Candidate): string {
  const flat = (s: string): string => s.trim().replace(/\s+/g, ' ');
  return checksum(JSON.stringify({
    type: c.type,
    title: flat(c.title),
    body: flat(c.body),
    severity: c.severity,
    observations: c.observations.map((o) => [o.category, flat(o.text)]),
    extra: Object.entries(c.extra).sort(([a], [b]) => compareOrdinal(a, b)),
  }));
}

/**
 * Identity of "the same item, re-extracted": same heading, same title SLUG.
 * Keyed on a hash of the UNTRUNCATED `normalizeForSlug` form of the title
 * (slug.ts) — deliberately neither the raw title nor `baseId`'s (truncated)
 * `slugify` output:
 *
 *  - Hashing the RAW title (an earlier version of this function) narrows
 *    identity to "case- and punctuation-EXACT title", which breaks the
 *    exact case this key exists to serve: a non-deterministic LLM
 *    re-running an UNCHANGED document routinely reproduces a reworded
 *    title — different trailing punctuation, different case — for what is
 *    still the same requirement. That no longer matched, so the reworded
 *    re-extraction minted a second live draft at the same anchor instead of
 *    superseding the first, which is worse than the truncation collision
 *    this function was written to fix.
 *  - Hashing `baseId` (`slugify`'s TRUNCATED output, the original version of
 *    this function) is the truncation-collision bug this function exists to
 *    fix: `slugify` truncates at 60 characters (`MAX_SLUG`, slug.ts), so two
 *    genuinely different candidates whose titles share a long common prefix
 *    (e.g. "...reaches internal admin endpoints" vs "...reaches internal
 *    public endpoints", both cut before the words that differ) can produce
 *    the exact same `baseId`, and matching on it would then treat the
 *    SECOND candidate as a re-extraction of the FIRST and supersede it —
 *    collapsing two distinct requirements into one, inside a single
 *    `applyCandidates` call, with no error.
 *
 * `normalizeForSlug` gives both: it tolerates case/punctuation (rule 2's
 * whole point) while never truncating, so two titles differing only past
 * character 60 keep DIFFERENT keys, and two titles differing only in case
 * or trailing punctuation keep the SAME key.
 */
export function ingestKey(anchor: string, baseId: string, title: string): string {
  const titleHash = checksum(normalizeForSlug(title));
  return `${anchor}::${baseId}::${titleHash}`;
}

export interface ApplyResult {
  anchor: string;
  created: string[];
  deduped: string[];
  superseded: { previous: string; next: string }[];
  issues: ValidationIssue[];
}

/**
 * `${baseId}-r2` -> `${baseId}-r3` -> ... — for a GENUINE revision only:
 * `applyCandidates` calls this exclusively when `byKey` already matched a
 * `previous` item sharing this exact `ingestKey` (same anchor, same
 * normalized title), so `baseId` is always already `taken` by the time this
 * runs (either by the chain's own root item, or — in the truncation-collision
 * case below — by an unrelated item that got there first). The `-rN` suffix
 * is reserved for this case specifically because it READS as "revision of":
 * using it for the unrelated-collision case (`nextCollisionId` below) would
 * make an id claim a lineage that does not exist.
 *
 * Never reuses an id already taken IN `taken` at the moment this is called —
 * which is only actually "never reuses a live id" when `taken` reflects
 * every process's writes, i.e. a single writer with a current index. Two
 * processes computing this concurrently from their own, equally
 * current-at-the-time `taken` sets can both legitimately compute the SAME
 * next id and both write it — see the concurrency note on `applyCandidates`
 * below; this function has no way to detect that on its own.
 */
function nextRevisionId(baseId: string, taken: Set<string>): string {
  for (let revision = 2; ; revision++) {
    const candidate = `${baseId}-r${revision}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * `baseId` -> `${baseId}-2` -> `${baseId}-3` — for two DISTINCT items whose
 * `makeId`/`slugify` output collides (the 60-character truncation this
 * module's `ingestKey` doc comment describes) even though neither is a
 * re-extraction of the other (no `ingestKey` match). Deliberately the SAME
 * suffix style `locateInFamily` (mutate.ts) already uses for its own
 * content-family disambiguation (`${base}-2`, not `${base}-r2`) — an id
 * that merely lost a naming coin-flip against an unrelated item must not
 * read as "revision 2 of" that item, which is what `-rN` would imply.
 */
function nextCollisionId(baseId: string, taken: Set<string>): string {
  if (!taken.has(baseId)) return baseId;
  for (let n = 2; ; n++) {
    const candidate = `${baseId}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * The one place ingestion writes. Everything it writes is `origin: 'ingest'`
 * and `status: 'draft'`, and the assertion below states that as an invariant
 * of this function rather than trusting the two literals to stay put: there is
 * no `caller` field on `MutationContext` to carry the intent, and
 * `trustedStatus` only covers the NORMATIVE tier, so a future edit that
 * dropped `status: 'draft'` would silently let an ingested lesson land
 * `active`. `createItem` returns the status it actually wrote on a genuine
 * create — but NOT on either of its two no-op paths (an anchored dedupe, or
 * an explicit id whose content already matches), where the returned status
 * is the EXISTING item's status, potentially set by a prior human edit. That
 * is not a gap for this call site specifically: `applyCandidates` only ever
 * reaches `createItem` after `byHash` has already ruled out a content match,
 * so the anchored-dedupe path can't fire here, and the explicit id it mints
 * (`nextRevisionId`) is never one already `taken`, so the explicit-id no-op
 * path can't fire either — but that is a property of the caller, not of
 * `createItem`'s return value, which is why this checks the outcome at all
 * rather than trusting the input.
 */
function assertDraft(result: MutationResult, id: string): void {
  if (result.status !== 'draft') {
    throw new Error(
      `my_context: ingest wrote ${id} as "${result.status}", not "draft". Ingestion never ` +
      `creates a governing item — this is a bug in applyCandidates, not a user error.`,
    );
  }
}

/**
 * Applies the extraction result for exactly ONE chunk of an ingest session.
 *
 * Concurrency note for callers: this function trusts the `session` object it
 * is given for that chunk's `chunks` entry (immutable — chunks are fixed at
 * session-open time, see `openIngestSession`) but does NOT trust — and does
 * not need — any snapshot of `pendingAnchors(session)` taken earlier: the
 * `ctx.store.all()` read four lines below is always fresh at call time, not
 * cached across calls. A caller that loops over multiple chunks (the CLI
 * ingest command, a later task) MUST still call
 * `pendingAnchors(loadSession(root, id))` — a fresh reload — immediately
 * before each iteration, not once before the loop: concurrent appends to the
 * session's append-only applied log (`session.ts`) make an earlier-computed
 * anchor list stale, and this function has no way to detect that on its
 * caller's behalf since it is only ever handed one anchor at a time. That
 * same caller should also call `saveSession` immediately after every
 * `applyCandidates` call, not batched at the end of a multi-chunk run — not
 * only for crash durability, but because a non-deterministic LLM re-run of
 * an UNCHANGED document routinely reproduces a reworded (not byte-identical)
 * extraction, which fails the `byHash` dedupe and takes the supersede
 * branch, retiring a live draft in favor of one from a document that never
 * changed; saving after each chunk is what lets a caller detect and skip an
 * anchor it already applied, instead of re-submitting it into a fresh
 * extraction call at all.
 *
 * Concurrency note this function does NOT protect against: two processes
 * calling `applyCandidates` for the SAME anchor of the SAME session at the
 * same time can both read `ctx.store.all()` before either has written,
 * compute the SAME `nextRevisionId`, and both call `createItem` with that
 * id — for candidates with DIFFERENT content, `createItem`'s explicit-id
 * handling does not throw a collision, because neither write's read
 * preceded the other's; whichever `persist()` (core/persist.ts) call lands second
 * silently overwrites the first process's file and index row, and BOTH
 * processes observe success. `applyCandidates` has no lock to prevent this;
 * a caller driving concurrent ingestion of the same anchor must serialize it
 * itself (spec work for a later task).
 */
export function applyCandidates(
  ctx: MutationContext, session: IngestSession, anchor: string, raw: unknown,
): ApplyResult {
  const chunk = session.chunks.find((c) => c.anchor === anchor);
  if (!chunk) {
    throw new Error(
      `my_context: ingest session ${session.id} has no chunk "${anchor}". ` +
      `Known anchors: ${session.chunks.map((c) => c.anchor).join(', ')}.`,
    );
  }

  const { valid, issues } = validateCandidates(raw, ctx.config, chunk);
  const result: ApplyResult = { anchor, created: [], deduped: [], superseded: [], issues };

  const everything = ctx.store.all();
  const takenIds = new Set(everything.map((i) => i.id));
  const fromSource = everything.filter((i) => i.sourceFile === session.sourceFile);

  const byHash = new Map<string, Item>();
  const byKey = new Map<string, Item>();
  for (const item of fromSource) {
    // Both key names come from `trust.ts`, which is also where they are
    // exempted from extra-field ownership (`unknownExtraFieldError`): they are
    // the product's own provenance, not fields any category declares, and one
    // list keeps the exemption and the writer below from drifting apart.
    const hash = item.extra[CONTENT_HASH_KEY];
    if (hash && !byHash.has(hash)) byHash.set(hash, item);
    const key = item.extra[INGEST_KEY_KEY];
    // The head of a supersession chain is the one that is not itself superseded.
    if (key && item.status !== 'superseded') byKey.set(key, item);
  }

  // `applied` is a plain object keyed by anchor, and anchors are `slugify`
  // output — which can spell `constructor`, `toString`, etc. Bracket access
  // (`session.applied[anchor]`) silently reads an INHERITED value for those
  // instead of `undefined`; `hasApplied`/`appliedRecordsFor` (session.ts) are
  // the one accessor every reader of an `applied` map must use — see that
  // module's own doc comment on why a second, local guard here would repeat
  // exactly the mistake it already documents being made twice.
  const before: ApplyRecord[] = appliedRecordsFor(session.applied, anchor);
  const records: ApplyRecord[] = [...before];
  const at = new Date().toISOString();

  for (const candidate of valid) {
    const hash = candidateHash(candidate);
    const prefix = ctx.config.categories[candidate.type].prefix;
    const baseId = makeId(prefix, candidate.title);
    const key = ingestKey(anchor, baseId, candidate.title);

    const identical = byHash.get(hash);
    if (identical) {
      result.deduped.push(identical.id);
      records.push({ candidateHash: hash, itemId: identical.id, action: 'deduped', at });
      continue;
    }

    const input: CreateInput = {
      type: candidate.type,
      title: candidate.title,
      body: candidate.body,
      // DEC-the-document-extraction-schema-gains-a-summary-field-so: the
      // extractor wrote this at extraction time, and `validateCandidates`
      // already refused any candidate that skipped it — so this is never
      // undefined here, and `createItem` stores it rather than `null`.
      summary: candidate.summary,
      status: 'draft',
      origin: 'ingest',
      severity: candidate.severity,
      always: false,
      scope: candidate.scope,
      tags: candidate.tags,
      sourceFile: session.sourceFile,
      sourceAnchor: anchor,
      sourceChecksum: chunk.checksum,
      extra: { ...candidate.extra, [CONTENT_HASH_KEY]: hash, [INGEST_KEY_KEY]: key },
      // `CandidateObservation` IS `Observation` (schema.ts), context included.
      observations: candidate.observations,
      relations: [],
    };

    // Read BEFORE the write, since the write replaces this key's head below
    // — and BEFORE minting an id, since which scheme mints the id depends on
    // whether this candidate is a genuine revision of `previous` or merely
    // an unrelated item whose `baseId` collides with one (see
    // `nextRevisionId` / `nextCollisionId`'s doc comments).
    const previous = byKey.get(key);

    // Written first in both branches: `supersedeItem` never creates anything —
    // `by` must already exist — so the replacement is minted here, at an
    // explicit id, and only then wired to its predecessor. The explicit id is
    // what lets a revision share its predecessor's anchor. `takenIds` is
    // updated the instant the id is chosen (not batched to the end of the
    // loop) so the NEXT candidate in this same batch never computes the same
    // id — without that update, two candidates whose `baseId`s collide (the
    // `ingestKey` doc comment above has the same example) would both resolve
    // to the same id and the second `createItem` call would throw "already
    // exists with different content", taking the whole batch down instead of
    // minting a sibling.
    input.id = previous ? nextRevisionId(baseId, takenIds) : nextCollisionId(baseId, takenIds);
    takenIds.add(input.id);
    const outcome = createItem(ctx, input);
    assertDraft(outcome, outcome.id);

    // The item as stored, for the two indexes below. `MutationResult` carries
    // ids and a message, not the item, so it is read back from the store —
    // which `createItem` has already upserted it into.
    const written = ctx.store.get(outcome.id) as Item;
    byHash.set(hash, written);
    byKey.set(key, written);

    if (previous) {
      try {
        supersedeItem(ctx, { id: previous.id, by: outcome.id, origin: 'ingest' });
      } catch (err) {
        // The trust model refusing to let ingestion retire a governing
        // normative item a human promoted (spec §7.1). Named, not thrown: a
        // partial batch keeps every success (spec §10). The replacement stays
        // as an unwired draft, which the review queue surfaces.
        result.issues.push({
          index: -1, title: candidate.title,
          message:
            `${outcome.id} was created, but ${previous.id} could not be superseded: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        });
        result.created.push(outcome.id);
        records.push({ candidateHash: hash, itemId: outcome.id, action: 'created', at });
        continue;
      }
      result.superseded.push({ previous: previous.id, next: outcome.id });
      records.push({ candidateHash: hash, itemId: outcome.id, action: 'superseded', previousId: previous.id, at });
      continue;
    }

    result.created.push(outcome.id);
    records.push({ candidateHash: hash, itemId: outcome.id, action: 'created', at });
  }

  // Every rejection this call produced becomes durable here, on BOTH exits
  // below, and `saveSession` writes them to `<id>.rejected.jsonl`.
  //
  // I-10: the mixed case — some candidates accepted, some rejected — used to
  // mark the anchor applied and leave nothing at all on disk to say a
  // rejection had happened. Nothing could then show it (`ingest-status` has no
  // source for it) and no resume could retry it, so a batch that half-failed
  // was indistinguishable from one that fully succeeded the moment the process
  // exited. The anchor still stays applied in that case, deliberately: the
  // accepted candidates really were written, and un-applying the anchor would
  // send the whole chunk back through extraction, where a reworded
  // re-extraction takes the supersede branch and retires the drafts this very
  // call just created (see this function's doc comment). So the successes keep
  // their applied record and the rejections get a record of their own, in a
  // file the resume decision does not read.
  //
  // The all-rejected case is unchanged and still leaves the anchor PENDING
  // (the ruling below): there, nothing was written, so resurfacing the chunk
  // costs nothing and losing it would lose everything. The two cases agree on
  // the principle — never lose a rejection, never re-extract work already
  // applied — and differ only in whether there is applied work to protect.
  for (const issue of result.issues) {
    session.rejected.push({
      anchor,
      at,
      index: issue.index,
      // `ValidationIssue.title` is `string | null | undefined` — a candidate
      // with no usable title at all rejects with null. Only a real string is
      // carried through, so the record's own `title` means what it says.
      ...(typeof issue.title === 'string' ? { title: issue.title } : {}),
      message: issue.message,
    });
  }

  // A chunk whose candidates were ALL rejected by validation (raw entirely
  // malformed, or every entry failed a check) must not be marked applied:
  // `records.length === before.length` means nothing new happened this call,
  // and `issues.length > 0` means there was a reason nothing happened worth
  // surfacing — the two together are indistinguishable from "no normative
  // content here" unless this anchor stays pending. Marking it applied
  // anyway would make `pendingAnchors` never resurface it, silently dropping
  // every rejected candidate for good — exactly what spec §10 forbids.
  // A chunk that legitimately yielded nothing (empty `raw`, no issues) is
  // still marked applied, same as before: `issues.length === 0` there, so
  // this condition is unaffected.
  const wroteNothingNew = records.length === before.length;
  if (wroteNothingNew && issues.length > 0 && !hasApplied(session.applied, anchor)) {
    return result;
  }
  // `setApplied`, not `session.applied[anchor] = records` — see its doc
  // comment (session.ts) for the `__proto__` hazard plain assignment carries
  // that this module's own history shows is worth guarding structurally
  // rather than reasoning about per call site.
  setApplied(session.applied, anchor, records);
  return result;
}
