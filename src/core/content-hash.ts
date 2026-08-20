/**
 * Content identity: the one definition of "is this the same item content",
 * shared by `createItem`'s dedupe, the id-family walk, and the ingest
 * idempotency key. Split out of `mutate.ts` in Wave 5 — hashing what an item
 * ASSERTS is a separate responsibility from writing it.
 */
import { normalizePosix } from './paths.ts';
import { checksum } from './slug.ts';
import { normalizeEol } from './text.ts';
import type { Item, Observation, Relation, Severity, Step } from './types.ts';
import type { CreateInput } from './mutate.ts';

interface ContentShape {
  type: string;
  title: string;
  body: string;
  steps: Step[];
  severity: Severity;
  always: boolean;
  scope: string[];
  tags: string[];
  observations: Observation[];
  relations: Relation[];
  extra: Record<string, string>;
}

/** Fixed key order so a freshly-authored observation and one recovered by
 * `parseItem` (whose keys come out in `parseItem`'s own order) hash the same. */
function canonicalObservation(o: Observation): Observation {
  return { category: o.category, text: o.text, tags: o.tags, context: o.context };
}

/** Fixed key order, for the reason `canonicalObservation` gives. */
function canonicalStep(s: Step): Step {
  return { text: s.text, checked: s.checked };
}

function canonicalRelation(r: Relation): Relation {
  return { type: r.type, target: r.target };
}

function canonicalExtra(extra: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(extra).sort()) out[key] = extra[key];
  return out;
}

/**
 * Identity of an item's *content*. `ContentShape` is the whole of it, so the
 * eleven `Item` fields absent from that interface are all excluded: `id`,
 * `status`, `origin`, provenance (`sourceFile`/`sourceAnchor`/
 * `sourceChecksum`), lifecycle dates (`validFrom`/`validUntil`), the
 * `checksum` itself, and the storage location (`layer`/`filePath`). None of
 * them change what the item *asserts*. `severity` and
 * `always` ARE included: they are normative content, not bookkeeping —
 * `computeItemChecksum` (item.ts) agrees, it hashes both too — so
 * re-capturing the same title as `severity: 'hard'` after `'soft'` must
 * not be silently swallowed as an unchanged duplicate.
 *
 * `scope` and `tags` are unordered sets, so they are sorted before hashing.
 * `steps`, `observations` and `relations` are ORDERED — they render to
 * Markdown in the sequence given (see `renderItem` in item.ts), and for a
 * procedure the order IS the knowledge — so their order is preserved as
 * given, but each entry is rebuilt with a fixed key order
 * (`canonicalStep`/`canonicalObservation`/`canonicalRelation`) so that
 * JSON.stringify does
 * not make key order part of identity: a payload the model just sent and
 * the same content recovered by `parseItem` must hash identically even
 * though the two objects were built with their keys in different orders.
 * `extra`'s keys are sorted for the same reason.
 */
function hashContent(v: ContentShape): string {
  return checksum(JSON.stringify({
    type: v.type,
    title: v.title.trim(),
    body: v.body.trim(),
    // UNCONDITIONAL, unlike `computeItemChecksum`'s key, and the difference
    // is that this hash is never persisted: it is recomputed on both sides
    // of every `createItem` dedupe, so there is nothing recorded anywhere
    // for a new key to invalidate. Omitting it would make two procedures
    // that differ only in their steps dedupe onto each other — the second
    // one reported as a duplicate of the first and never written.
    steps: v.steps.map(canonicalStep),
    severity: v.severity,
    always: v.always,
    scope: [...v.scope].sort(),
    tags: [...v.tags].sort(),
    observations: v.observations.map(canonicalObservation),
    relations: v.relations.map(canonicalRelation),
    extra: canonicalExtra(v.extra),
  }));
}

export function contentHash(input: CreateInput): string {
  return hashContent({
    type: input.type,
    title: input.title,
    // Normalized here, not just at storage time (and not only by the one
    // caller that remembers to pre-normalize): the hash and the stored
    // item must see the same value, or a body containing a lone `\r`
    // (CRLF, or a bare old-Mac line ending) would hash differently from
    // the LF-normalized text `parseItem` reads back, and `createItem`
    // could dedupe or fail to dedupe inconsistently with what disk holds.
    body: normalizeEol(input.body ?? ''),
    // `CreateInput` carries no steps: they reach an item only by being
    // written into the Markdown today. When a write surface for them exists,
    // this becomes `input.steps ?? []` and nothing else here changes.
    steps: [],
    severity: input.severity ?? 'soft',
    always: input.always ?? false,
    // Normalized here, not just at storage time: the hash and the stored
    // item must see the same value, or the same call made twice with
    // `scope: ['src\\db\\**']` on Windows would hash differently from what
    // ends up on disk and create a spurious second item.
    scope: (input.scope ?? []).map((g) => normalizePosix(g)),
    tags: input.tags ?? [],
    observations: input.observations ?? [],
    relations: input.relations ?? [],
    extra: input.extra ?? {},
  });
}

export function itemContentHash(item: Item): string {
  return hashContent(item);
}
