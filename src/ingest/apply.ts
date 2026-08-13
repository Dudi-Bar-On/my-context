import { checksum, makeId } from '../core/slug.ts';
import {
  createItem, supersedeItem,
  type CreateInput, type MutationContext, type MutationResult,
} from '../core/mutate.ts';
import type { Item } from '../core/types.ts';
import { validateCandidates, type Candidate, type ValidationIssue } from './schema.ts';
import type { ApplyRecord, IngestSession } from './session.ts';

/**
 * The dedupe key. Covers what the item *says*, deliberately excluding `quote`
 * and `scope`: re-quoting a different sentence for the same requirement is not
 * a material change, and re-scoping is an edit the user makes during review.
 */
export function candidateHash(c: Candidate): string {
  const flat = (s: string): string => s.trim().replace(/\s+/g, ' ');
  return checksum(JSON.stringify({
    type: c.type,
    title: flat(c.title),
    body: flat(c.body),
    severity: c.severity,
    observations: c.observations.map((o) => [o.category, flat(o.text)]),
    extra: Object.entries(c.extra).sort(([a], [b]) => a.localeCompare(b)),
  }));
}

/** Identity of "the same item, re-extracted": same heading, same title slug. */
export function ingestKey(anchor: string, baseId: string): string {
  return `${anchor}::${baseId}`;
}

export interface ApplyResult {
  anchor: string;
  created: string[];
  deduped: string[];
  superseded: { previous: string; next: string }[];
  issues: ValidationIssue[];
}

/** CONST-a -> CONST-a-r2 -> CONST-a-r3. Never reuses a live id. */
function nextRevisionId(baseId: string, taken: Set<string>): string {
  if (!taken.has(baseId)) return baseId;
  for (let revision = 2; ; revision++) {
    const candidate = `${baseId}-r${revision}`;
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
 * `active`. `createItem` returns the status it actually wrote, so this checks
 * the outcome rather than the input.
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
 * not need — any snapshot of `session.applied` or `pendingAnchors(session)`
 * taken earlier: every dedupe/supersede decision below is made from a fresh
 * `ctx.store.all()` read at call time, not from anything cached across
 * calls. A caller that loops over multiple chunks (the CLI ingest command,
 * a later task) MUST still call `pendingAnchors(loadSession(root, id))` — a
 * fresh reload — immediately before each iteration, not once before the
 * loop: concurrent appends to the session's append-only applied log
 * (`session.ts`) make an earlier-computed anchor list stale, and this
 * function has no way to detect that on its caller's behalf since it is
 * only ever handed one anchor at a time.
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
    const hash = item.extra.content_hash;
    if (hash && !byHash.has(hash)) byHash.set(hash, item);
    const key = item.extra.ingest_key;
    // The head of a supersession chain is the one that is not itself superseded.
    if (key && item.status !== 'superseded') byKey.set(key, item);
  }

  const records: ApplyRecord[] = session.applied[anchor] ?? [];
  const at = new Date().toISOString();

  for (const candidate of valid) {
    const hash = candidateHash(candidate);
    const prefix = ctx.config.categories[candidate.type].prefix;
    const baseId = makeId(prefix, candidate.title);
    const key = ingestKey(anchor, baseId);

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
      status: 'draft',
      origin: 'ingest',
      severity: candidate.severity,
      always: false,
      scope: candidate.scope,
      tags: candidate.tags,
      sourceFile: session.sourceFile,
      sourceAnchor: anchor,
      sourceChecksum: chunk.checksum,
      extra: { ...candidate.extra, content_hash: hash, ingest_key: key },
      // `CandidateObservation` IS `Observation` (schema.ts), context included.
      observations: candidate.observations,
      relations: [],
    };

    // Read BEFORE the write, since the write replaces this key's head below.
    const previous = byKey.get(key);

    // Written first in both branches: `supersedeItem` never creates anything —
    // `by` must already exist — so the replacement is minted here, at an
    // explicit `-rN` id, and only then wired to its predecessor. The explicit
    // id is what lets a revision share its predecessor's anchor.
    input.id = nextRevisionId(baseId, takenIds);
    const outcome = createItem(ctx, input);
    assertDraft(outcome, outcome.id);
    takenIds.add(outcome.id);

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

  session.applied[anchor] = records;
  return result;
}
