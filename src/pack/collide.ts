/**
 * What arriving items would do to the corpus that is already here: three
 * buckets, and the two renderings of them a person and a script each read.
 *
 * ## The three buckets, and the one predicate behind them
 *
 * An item is `new` when nothing local holds its id, `identical` when
 * something does and the content hashes agree, and `changed` when something
 * does and they do not. Every incoming item lands in exactly one, so the
 * three counts sum to the incoming count — that sum is
 * `INV-nothing-is-dropped-silently` in the only form a test can check without
 * knowing anything about the items, and it is asserted.
 *
 * The predicate is `itemContentHash`, unchanged and unwrapped, which is the
 * same one `createItem`'s dedupe runs. Reusing it is what makes a stranger's
 * hand-authored item and a parsed one bucket the same way: it excludes `id`,
 * `status` and `origin`, trims title and body, sorts `scope` and `tags` as
 * sets and canonicalises key order, so an item that arrives `draft` from a
 * corpus where it was `active` is `identical`, which is the truth about its
 * content. It shares that hash's 64-bit truncation, which is fine for a
 * REPORT — a false "identical" needs a deliberate collision — and is not fit
 * for the manifest, which is why the manifest uses the full digest.
 *
 * ## The `changed` bucket is a warning, not a notice
 *
 * §6n.7 requires that the user be told what will be overwritten, with enough
 * of the change to recognise it, before being asked a question whose answer
 * replaces their own writing. A pair of hashes is not that. So a `Changed`
 * carries `differs` — the field names that moved the hash — and it carries
 * `overwritable`/`blockedBy`, because `UpdateInput` has no route to four of
 * the eleven fields the hash composes and an item differing only in those
 * cannot be overwritten by any write path this plan owns. Naming such an item
 * as **not overwritable here** is the difference between a warning and a
 * promise that is quietly not kept for two of its items.
 *
 * All three are computed in `bucketise`, never in a renderer, because the
 * text report and the `--json` document must not disagree about which items
 * an approval covers.
 *
 * ## Two lists this module does not keep
 *
 * `differs` is derived from `canonicalContent` (`core/content-hash.ts` ·
 * `export function canonicalContent(v: ContentShape): ContentShape {` · ~93),
 * the very object the hash is taken over, so a field cannot appear in the
 * warning without having moved the hash and cannot move the hash without
 * appearing. `blockedBy` is derived from `UPDATE_FIELD_POLICY`
 * (`core/trust.ts` · `export const UPDATE_FIELD_POLICY = {` · ~456), whose
 * `satisfies` clause already fails to compile when `UpdateInput` grows a
 * field nobody classified — so the day `observations` gains a write path,
 * this module stops calling it a blocker without anyone editing this file.
 *
 * A hand-kept copy of either list would be a defect waiting to go stale in
 * the one place staleness is invisible: a warning that reads correctly and is
 * wrong.
 *
 * ## The fourth case, named in the report and not bucketed
 *
 * Ids are slugified titles and the creator allocates an id FAMILY — `base`,
 * `base-2`, `base-3` (`core/mutate.ts` · `function familyId(base: string, n: number): string {`
 * · ~160). Two corpora that each independently captured two items with the
 * same title will disagree about which one is `-2`. Nothing here resolves
 * that, and nothing should: which of two same-titled items is "the same item"
 * is a judgement about meaning. So a changed entry whose local family has
 * more than one member carries a NOTE in the text report — a sentence a human
 * reads before approving, not a rule the machine acts on.
 */
import { canonicalContent, itemContentHash } from '../core/content-hash.ts';
import { normalizeForSlug } from '../core/slug.ts';
import { GOVERNING_STATUS, UPDATE_FIELD_POLICY } from '../core/trust.ts';
import { col, paragraph } from '../cli/commands/format.ts';
import type { Item, Status } from '../core/types.ts';
import { comparePaths, IMPORTED_DIR, UNKNOWN_PACK_DIR, type ArtefactKind } from './layout.ts';
import type { ArtefactFormat } from './reader.ts';

/**
 * How much of a content hash the report shows. Eight hex characters is what
 * a person compares by eye; the bucket decision is taken on the whole digest,
 * so shortening here cannot change which bucket anything landed in.
 */
const SHORT_HASH = 8;

/** One incoming item whose id is already here, with different content. */
export interface Changed {
  incoming: Item;
  existing: Item;
  /** The local item's content hash, shortened for display. */
  existingHash: string;
  /** The arriving item's content hash, shortened for display. */
  incomingHash: string;
  /** Field names, in `canonicalContent`'s own composition order. */
  differs: string[];
  /** False when `blockedBy` is set. */
  overwritable: boolean;
  /** The first differing field with no write path, or `null`. */
  blockedBy: string | null;
  /**
   * True when the local corpus holds more than one member of this id's
   * family, so the two corpora may have allocated the family differently.
   * A note in the text report; deliberately not in the `--json` document,
   * which carries the facts a script can act on and this is not one.
   */
  familyCollision: boolean;
}

export interface Buckets {
  new: Item[];
  changed: Changed[];
  identical: Item[];
}

/** What the report says about the arriving artefact and what it would do. */
export interface CollisionReport {
  pack: string;
  version: string;
  kind: ArtefactKind;
  /** The path as the caller typed it. */
  source: string;
  format: ArtefactFormat;
  /**
   * What the manifest check found. On an artefact `readArtefact` returned,
   * the three lists are empty and `verified` equals `files` — it throws
   * otherwise — so the counts are what the report renders and the lists are
   * carried for a caller that wants to print what was checked.
   */
  manifest: {
    files: number;
    verified: number;
    missing: string[];
    extra: string[];
    mismatched: string[];
  };
  buckets: Buckets;
  config: { merged: string[]; refused: string[]; untouched: string[] };
  history: { records: number; quarantined: number };
  notCarried: { field: string; items: number; effect: string }[];
  refused: string[];
  /** False for a dry run or a declined confirmation, true after a write. */
  applied: boolean;
  /** Whether the §6n.7 second act was taken. Never inferred from `applied`. */
  overwriteApproved: boolean;
  /** The ids actually replaced. A subset of `buckets.changed`, often empty. */
  overwritten: string[];
  loadErrors: string[];
}

/**
 * The fields that moved the content hash, in the order the hash composes
 * them.
 *
 * Both items are projected through `canonicalContent` first, so the
 * comparison sees exactly what the hash saw: a `tags` array differing only in
 * order is sorted to the same value and does not appear, and a body differing
 * only in trailing whitespace is trimmed to the same value and does not
 * appear either. That is the property the warning depends on — every field
 * listed here moved the hash, and every field that moved it is listed.
 *
 * The spread is what widens the projection's named type to something
 * iterable, and it preserves key order, which IS the report's order.
 */
export function diffFields(a: Item, b: Item): string[] {
  const left: Record<string, unknown> = { ...canonicalContent(a) };
  const right: Record<string, unknown> = { ...canonicalContent(b) };
  return Object.keys(left)
    .filter((field) => JSON.stringify(left[field]) !== JSON.stringify(right[field]));
}

/**
 * True when `field` can be moved by an update at all.
 *
 * Read off `UPDATE_FIELD_POLICY` rather than listed: that table is the one
 * `UpdateInput` cannot grow a field without appearing in, so this answer
 * follows the write path instead of remembering it. Today it makes `type`,
 * `steps`, `observations` and `relations` blockers — the four fields the hash
 * composes that an update cannot reach.
 */
function hasWritePath(field: string): boolean {
  return Object.hasOwn(UPDATE_FIELD_POLICY, field);
}

/** `RULE-x-2` → `RULE-x`; every other id is its own family base. */
function familyBase(id: string): string {
  const suffixed = /^(.+)-(\d+)$/.exec(id);
  return suffixed === null ? id : suffixed[1];
}

/**
 * How many members of `id`'s family the local corpus holds.
 *
 * Counts upward from the base and stops at the first miss, which is exactly
 * how `locateInFamily` allocates (`core/mutate.ts` ·
 * `function locateInFamily(` · ~171) — the sequence is contiguous by
 * construction, so the first gap is the end of the family and the walk is
 * bounded by the family's own size.
 */
function familySize(id: string, existing: (id: string) => Item | null): number {
  const base = familyBase(id);
  let n = 1;
  while (existing(n === 1 ? base : `${base}-${n}`) !== null) n += 1;
  return n - 1;
}

/**
 * The three buckets, each sorted by id in UTF-8 byte order.
 *
 * Sorted HERE and not in the two renderers, so the text report and the JSON
 * document cannot present the same pack in two orders. `comparePaths` is the
 * one comparator this format uses everywhere else, and it is the reason
 * `RULE-B` precedes `RULE-a`: a case-folding comparator would order the two
 * renderings differently from the manifest and the archive.
 *
 * `existing` returns `null` for an id the corpus does not hold — the spelling
 * `Store.get` uses (`core/store.ts` · `  get(id: string): Item | null {` ·
 * ~483). A predicate written against `undefined` is never true here, so every
 * item would fall out of `new` and the report would offer to import nothing.
 */
export function bucketise(incoming: Item[], existing: (id: string) => Item | null): Buckets {
  const fresh: Item[] = [];
  const changed: Changed[] = [];
  const identical: Item[] = [];

  for (const item of incoming) {
    const here = existing(item.id);
    if (here === null) {
      fresh.push(item);
      continue;
    }
    const existingHash = itemContentHash(here);
    const incomingHash = itemContentHash(item);
    if (existingHash === incomingHash) {
      identical.push(item);
      continue;
    }
    const differs = diffFields(here, item);
    const blockedBy = differs.find((field) => !hasWritePath(field)) ?? null;
    changed.push({
      incoming: item,
      existing: here,
      existingHash: existingHash.slice(0, SHORT_HASH),
      incomingHash: incomingHash.slice(0, SHORT_HASH),
      differs,
      overwritable: blockedBy === null,
      blockedBy,
      familyCollision: familySize(item.id, existing) > 1,
    });
  }

  const byId = (a: Item, b: Item): number => comparePaths(a.id, b.id);
  return {
    new: fresh.toSorted(byId),
    changed: changed.toSorted((a, b) => comparePaths(a.incoming.id, b.incoming.id)),
    identical: identical.toSorted(byId),
  };
}

/**
 * `.audit/imported/acme-security/` — the directory this pack's history is
 * filed under.
 *
 * UNDER, not IN: one import's records sit in a directory below this one, named
 * for the artefact location they came from, so that a second pack calling
 * itself the same thing cannot land on the first one's
 * (`pack/imported-audit.ts` · `export function packDir(root: string, key: PackKey): string {` · ~176).
 * The report names the readable half, which is the half a person can find; the
 * leaf is a digest and naming it here would be a path nobody could read in a
 * sentence about where to look. The report is also rendered BEFORE the import
 * is applied and the plan has no key in it, which is the other reason this
 * stops where it does.
 */
function importedPath(pack: string): string {
  return `.audit/${IMPORTED_DIR}/${normalizeForSlug(pack)}/`;
}

/**
 * The id and type column widths, measured over ALL THREE buckets rather than
 * each in turn.
 *
 * Per-bucket widths would let the same report draw three slightly different
 * grids, and the eye reads that misalignment as meaning. The id column is
 * also what the detail lines under a changed entry are indented to, so one
 * width is what keeps those under their own entry.
 */
function widths(buckets: Buckets): { id: number; type: number } {
  const items = [
    ...buckets.new,
    ...buckets.changed.map((c) => c.incoming),
    ...buckets.identical,
  ];
  return {
    id: Math.max(20, ...items.map((i) => i.id.length + 2)),
    type: Math.max(10, ...items.map((i) => i.type.length + 2)),
  };
}

/** The one-line summary of each bucket, printed whether or not it is empty. */
const BUCKET_MEANING: readonly { name: 'new' | 'changed' | 'identical'; why: string }[] = [
  { name: 'new', why: 'do not exist here — these are what would be imported' },
  { name: 'changed', why: 'same id, different content — replaced only if you approve below' },
  { name: 'identical', why: 'same id, same content — nothing to do' },
];

/** What `blockedBy` means for the person deciding, in one sentence. */
function blockedSentence(field: string): string {
  return `NOT overwritable here — there is no write path for ${field} after creation, so this `
    + 'one is skipped whether or not you approve';
}

/**
 * The consequence lines for one changed item: what approving does to it.
 *
 * The demotion sentence is printed only for an item that is currently
 * governing, because it is the only one for which it is true — a `draft` item
 * has nothing to lose by being written as `draft` again, and telling it that
 * it stops governing would be a warning about nothing, which costs exactly
 * what a false warning always costs.
 *
 * The status half of "governing" is all this can check: the tier half needs a
 * resolved `Config` and a report is rendered from two items. Naming a
 * rationale-tier item's demotion is the harmless direction of that
 * imprecision — it is still true that the item drops to draft.
 */
function consequence(c: Changed): string[] {
  if (!c.overwritable) return [blockedSentence(c.blockedBy as string)];
  return GOVERNING_STATUS[c.existing.status]
    ? ['your version is replaced and drops to draft, so it stops governing until you '
      + 'promote it again']
    : ['your version is replaced and drops to draft'];
}

/** The lines of one bucket's section, `(none)` included. */
function section(
  name: string, rows: string[][], detail: (row: number) => string[],
  width: { id: number; type: number },
): string[] {
  const out = [`${name}:`];
  if (rows.length === 0) return [...out, '  (none)'];
  const titleWidth = Math.max(...rows.map((r) => r[2].length + 2));
  rows.forEach((row, i) => {
    const tail = row[3] === undefined ? row[2] : col(row[2], titleWidth) + row[3];
    out.push(`  ${col(row[0], width.id)}${col(row[1], width.type)}${tail}`.trimEnd());
    out.push(...detail(i));
  });
  return out;
}

/**
 * The report a person reads, one line per array entry.
 *
 * Section order is fixed and all three buckets appear, empty or not: a zero
 * is a fact, and a bucket that vanishes when it is empty is one a reader
 * cannot tell from a bucket that was never computed.
 *
 * Two sections are printed only when they carry something — the config
 * projection and the load errors — because the layout this renders is
 * specified without them and a report that prints `config: nothing` on every
 * import trains a reader to skip the line above it. Nothing is dropped by
 * that: they appear the moment they are non-empty.
 */
export function renderCollisionReport(report: CollisionReport): string[] {
  const lines: string[] = [
    `pack: ${report.pack}  (version ${JSON.stringify(report.version)})`,
    `source: ${report.source}  (${report.format}, ${report.manifest.files} file(s))`,
    `manifest: every file verified — ${report.manifest.verified} of ${report.manifest.files} `
      + 'digests match.',
    '          This proves the bytes arrived intact. It says nothing about who wrote them.',
    '',
  ];

  for (const bucket of BUCKET_MEANING) {
    const count = String(report.buckets[bucket.name].length);
    lines.push(`${bucket.name.padEnd(9)}${count.padStart(5)}   ${bucket.why}`);
  }
  lines.push('');

  const width = widths(report.buckets);
  const indent = ' '.repeat(2 + width.id);
  const none = (): string[] => [];

  lines.push(...section(
    'new',
    report.buckets.new.map((i) => [i.id, i.type, i.title]),
    none,
    width,
  ));
  lines.push(...section(
    'changed',
    report.buckets.changed.map((c) => [
      c.incoming.id, c.incoming.type, c.incoming.title, `[${c.existing.status} here]`,
    ]),
    (row) => {
      const c = report.buckets.changed[row];
      const detail = [
        `here ${c.existingHash}  incoming ${c.incomingHash}`,
        `differs in: ${c.differs.join(', ')}`,
        ...consequence(c),
      ];
      if (c.familyCollision) {
        detail.push('family collision — these two ids may name different things in the two '
          + 'corpora');
      }
      detail.push(`inspect with \`mycontext show ${c.incoming.id}\``);
      return detail.flatMap((text) => paragraph(text, indent));
    },
    width,
  ));
  lines.push(...section(
    'identical',
    report.buckets.identical.map((i) => [i.id, i.type, i.title]),
    none,
    width,
  ));
  lines.push('');

  const filed = `${report.history.records} mutation record(s) will be filed under `
    + importedPath(report.pack);
  lines.push(...paragraph(filed, 'history: ', undefined, '         '));
  if (report.history.quarantined > 0) {
    lines.push(...paragraph(
      `${report.history.quarantined} record(s) carry an op this build does not know and will be `
      + `quarantined under .audit/${IMPORTED_DIR}/${UNKNOWN_PACK_DIR}/ — counted here, nothing `
      + 'dropped.',
      '         ',
    ));
  }

  if (report.notCarried.length === 0) {
    lines.push('not carried: nothing — every field of every item travelled as it was written');
  } else {
    for (const [i, n] of report.notCarried.entries()) {
      lines.push(...paragraph(
        `${n.field} will be ${n.effect} on ${n.items} item(s)`,
        i === 0 ? 'not carried: ' : '             ',
        undefined,
        '             ',
      ));
    }
  }

  lines.push(`refused: ${report.refused.length}`);
  for (const r of report.refused) lines.push(...paragraph(r, '  '));

  if (report.config.merged.length + report.config.refused.length > 0) {
    lines.push(`config: merged ${report.config.merged.join(', ') || 'nothing'}`
      + `; refused ${report.config.refused.join(', ') || 'nothing'}`);
  }
  if (report.overwritten.length > 0) {
    lines.push(...paragraph(`overwritten: ${report.overwritten.join(', ')}`, ''));
  }
  if (report.loadErrors.length > 0) {
    lines.push(`load errors: ${report.loadErrors.length}`);
    for (const e of report.loadErrors) lines.push(...paragraph(e, '  '));
  }

  return lines;
}

/** The three fields every bucket entry carries, in one place. */
function brief(item: Item): { id: string; type: string; title: string } {
  return { id: item.id, type: item.type, title: item.title };
}

/**
 * The `--json` document: one object, fixed key order, load errors inside it
 * so that a failed import is still parseable by whatever was reading it.
 *
 * `applied`, `overwriteApproved` and `overwritten` are three separate
 * questions and are always present, `false`/`false`/`[]` on every path
 * including a dry run — the same rule the manifest follows, for the same
 * reason: a reader must never have to tell "absent" from "nothing happened".
 * `applied: true` with `overwritten: []` is the ordinary shape of an import
 * whose new items landed and whose changed items were left alone.
 */
export function collisionJson(report: CollisionReport): unknown {
  return {
    pack: report.pack,
    version: report.version,
    kind: report.kind,
    source: report.source,
    format: report.format,
    manifest: {
      files: report.manifest.files,
      verified: report.manifest.verified,
      missing: report.manifest.missing,
      extra: report.manifest.extra,
      mismatched: report.manifest.mismatched,
    },
    buckets: {
      new: report.buckets.new.map(brief),
      changed: report.buckets.changed.map((c) => ({
        ...brief(c.incoming),
        existingHash: c.existingHash,
        incomingHash: c.incomingHash,
        differs: c.differs,
        existingStatus: c.existing.status satisfies Status,
        overwritable: c.overwritable,
        blockedBy: c.blockedBy,
      })),
      identical: report.buckets.identical.map(brief),
    },
    config: {
      merged: report.config.merged,
      refused: report.config.refused,
      untouched: report.config.untouched,
    },
    history: { records: report.history.records, quarantined: report.history.quarantined },
    notCarried: report.notCarried.map((n) => ({
      field: n.field, items: n.items, effect: n.effect,
    })),
    refused: report.refused,
    applied: report.applied,
    overwriteApproved: report.overwriteApproved,
    overwritten: report.overwritten,
    loadErrors: report.loadErrors,
  };
}
