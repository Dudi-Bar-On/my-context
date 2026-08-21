/**
 * `history.jsonl` — the half of the audit log that travels: mutations only,
 * projected onto a fixed key list, redacted, joined to the exported selection
 * and totally ordered.
 *
 * ## What travels, and what does not
 *
 * The local log records six kinds (`core/audit.ts` ·
 * `export type AuditKind = 'mutation' | 'injection' | 'hook' | 'focus' | 'access' | 'progress';`).
 * Exactly one of them describes the CORPUS; the other five describe a
 * MACHINE — which sessions saw what, which hook fired, which local file path
 * triggered it, what one terminal's focus was narrowed to. None of that is
 * knowledge about the domain and none of it is the receiver's business, so
 * the filter here is positive: `kind === 'mutation'`, and everything else is
 * absent because it was never selected rather than because someone remembered
 * to remove it.
 *
 * ## The projection is a key list, not a passthrough
 *
 * `AuditRecord` PERMITS `sessionId`, `hook`, `injected`, `tokens`, `spilled`,
 * `path` and `refusal` on any record. The two writers of mutation records
 * (`core/persist.ts`'s `auditMutation` and the discard settlement in
 * `core/revision.ts`) have no parameter for most of them, so today no mutation
 * record carries one — but "today no writer sets it" is a fact about writers,
 * and a field that becomes settable next year would start travelling with
 * nobody deciding that it should. So `projectMutation` builds an object
 * literal naming the eight keys that travel and reads nothing else. A field
 * added to `AuditRecord` is dropped by construction, which is also what makes
 * this module independent of the audit segment's own format version (plan
 * §6n.5, owned by the categories-and-runbooks plan): a new segment-level field
 * is projected away without an edit here.
 *
 * ## The join, and the second channel the join has to cover
 *
 * A record travels only when its `itemId` is one of the exported ids. Ids are
 * slugified titles (`core/slug.ts` · `export function makeId(prefix: string, title: string): string {`),
 * so a record naming a withheld item republishes that item's SUBJECT — which
 * is most of what a title is.
 *
 * `note` is the same channel by a different door, and this is the one place
 * this module departs from the plan's text — deliberately, and by applying the
 * plan's own rule rather than a new one. Three of the ten mutation ops write
 * ANOTHER ITEM'S ID into `note`:
 *
 *   - `supersede` — `core/mutate.ts` · ``{ fields: ['status', 'relations', 'validUntil'], note: `by ${replacement.id}` },``
 *   - `link` and `unlink` — `core/relations.ts` · ``fields: ['relations'], note: `${input.relation} ${input.to}`,``
 *
 * None of those notes contains `': '`, so the plan's redaction ("keep up to
 * the first colon-space", written for the discard note's free text) keeps them
 * WHOLE. A pack exporting one item of a superseded pair would then carry the
 * withheld item's id in plain text, one field away from the join that exists
 * to prevent exactly that. So the note is joined too: for those three ops it
 * travels only when the id it names is also carried, and otherwise the key is
 * omitted. The record still says that the item was superseded, linked or
 * unlinked, and by whom; what it stops saying is the name of an item the
 * receiver was not given.
 *
 * `NOTE_RULE` below is a TOTAL table over `MutationOp`, the same shape
 * `core/audit.ts`'s `KIND_OF` uses and for the same reason: an op added to the
 * vocabulary without a note rule is a type error here, not a note that leaks
 * because a default was permissive.
 *
 * ## Why the reader is looser than `core/audit.ts`'s, in exactly one respect
 *
 * `parseAudit` refuses a whole SEGMENT on the first unrecognised op. That is
 * right locally — an op this build cannot name in its own log means this build
 * wrote a record it cannot read back — and it is fatal on import, where the
 * pack was written by a build that is allowed to know more ops than this one.
 * `parseHistory` therefore supplies its own log spec whose validator accepts
 * any string `op`, and sorts the rows into two lists afterwards. Protocol,
 * JSON shape and torn-tail handling still come from the shared parser
 * (`core/jsonl-log.ts`), so the ONLY thing loosened is the vocabulary, and a
 * foreign protocol is still refused wholesale on line 1.
 *
 * The line between the two outcomes, stated once so neither drifts:
 *
 *   - **Refused, taking the file with it** — the row is not a log line at all:
 *     invalid JSON, not an object, a protocol this build does not read, or a
 *     missing/mistyped `at`, `kind` or `op`. An `at` that is not the one
 *     instant spelling is here too, because a history whose lines cannot be
 *     ordered against each other is not a history. There is no honest per-row
 *     recovery from any of these, and the shared parser already owns the
 *     decision (a torn final line excepted — that is what it exists for).
 *   - **Quarantined, one row at a time** — the row IS a log line, and its
 *     vocabulary or its field shape is something this build cannot act on: an
 *     op outside `MUTATION_OPS`, a `kind` other than `mutation`, a key outside
 *     the projection, a known key of the wrong type, an `origin` outside the
 *     closed three. Every one of these is version skew or a stranger's
 *     invention, and refusing a whole pack's history for one of them is the
 *     failure this module exists to prevent. A quarantined row is returned
 *     verbatim and counted — never dropped, and never applied.
 *
 * ## Determinism, and the comparator this module does NOT define
 *
 * The order is the tuple `(at, itemId ?? '', op, original position)`, compared
 * over UTF-8 bytes with the comparator `layout.ts` already defines for
 * artefact paths — imported under a name that says what it does to a string. A
 * second definition here is how two spellings of one rule get into a codebase,
 * and two implementations that disagree about order produce two `history.jsonl`
 * files with two digests for the same log.
 *
 * The fourth component is not compared: `Array.prototype.sort` and `toSorted`
 * are stable, and `exportableHistory` sorts an array that is already in segment
 * order, so equal keys keep their original relative positions by construction.
 *
 * **Where the UTF-8-versus-UTF-16 difference is actually reachable**, since a
 * comparator justified by an unreachable case is a comparator nobody will keep:
 * a locally produced record's three sort keys are all ASCII — `at` is
 * `toISOString()`, `op` is one of ten literals, and `itemId` passes
 * `core/vocabulary.ts` · `export const ID_GRAMMAR = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;`
 * at both the mint and the read boundary — and for ASCII every ordering agrees.
 * A STRANGER'S `history.jsonl` is where it bites: nothing validates an id
 * inside a log row against that grammar, so an incoming record can carry any
 * string at all, and `compareHistory` is exported for the surfaces that sort
 * those.
 *
 * ## Is there a set-level crossing here, of the kind `refuseArtefactPaths` covers?
 *
 * No, and the answer is written down rather than left as a silence, because
 * the sibling modules call that function at three separate crossings.
 * `refuseArtefactPaths` exists because a case collision is a property of a SET
 * of PATHS. This module never produces or consumes an artefact path: it is
 * handed a set of item IDS and joins with exact string equality, and it does
 * not know an item's `type`, so it could not build `items/<type>/<id>.md` even
 * if it wanted to. Two exported ids that differ only by case would collide as
 * PATHS — and that is caught where the paths are made, by `buildBundle`'s walk
 * and again by `buildManifest`, both of which hold the whole set. Synthesising
 * a path here to re-run their check would be a second spelling of a rule that
 * already has one, over a set this module does not own.
 *
 * ## What is NOT checked here, and why the absence is deliberate
 *
 *   - **A UTF-8 BOM, a stray CR, the trailing-newline rule.** `parseManifest`
 *     enforces its own byte layout because `manifest.json` is the one file no
 *     digest covers. This file IS covered by one, so byte-level mangling is
 *     detectable — and diagnosable — where the digest is checked. A second,
 *     weaker diagnosis here would be reachable only from its own test.
 *   - **An out-of-order file.** `parseManifest` refuses one, because an
 *     out-of-order manifest is a manifest a different implementation wrote and
 *     the archive's entry order is the same order. Nothing depends on this
 *     file's order the way the archive depends on the manifest's: a reader that
 *     wants the order sorts, quarantining a row breaks the sequence anyway, and
 *     refusing here would spend the whole pack on a property that costs a sort.
 *   - **A stranger's `note` is not re-redacted.** Redaction protects the
 *     EXPORTER, whose free text this build's writers produced. An arriving note
 *     is the author's own data; rewriting it would edit a stranger's history,
 *     and it lands quarantined under `.audit/imported/` rather than in the
 *     corpus.
 */
import { Buffer } from 'node:buffer';
import {
  filterAudit, MUTATION_OPS, readAudit,
  type AuditRecord, type MutationOp,
} from '../core/audit.ts';
import { parseJsonlLog, type JsonlLogSpec, type JsonlRow } from '../core/jsonl-log.ts';
import type { Origin } from '../core/types.ts';
import { comparePaths as compareUtf8, PACK_HISTORY_PROTOCOL } from './layout.ts';

/**
 * One line of `history.jsonl`.
 *
 * `protocol` is the literal rather than `string`, so no caller in this
 * repository can construct a record carrying another one — this file's protocol
 * is distinct from `AUDIT_PROTOCOL` by construction, which is what makes a
 * stray copy into `.audit/` refuse on line 1 instead of merging silently.
 */
export interface PackHistoryRecord {
  protocol: typeof PACK_HISTORY_PROTOCOL;
  at: string;
  kind: 'mutation';
  op: MutationOp;
  origin?: Origin;
  itemId?: string;
  fields?: string[];
  note?: string;
}

/** What one `history.jsonl` held: what this build can act on, and what it cannot. */
export interface HistoryRead {
  records: PackHistoryRecord[];
  /** Rows that are log lines this build could not validate. Verbatim, in file order. */
  unknown: JsonlRow[];
}

/**
 * The eight keys a history row may carry — the accept-list an ARRIVING row is
 * screened against.
 *
 * It does not drive the write order; `canonicalRecord`'s object literal does,
 * and this is written in the same order so a reader can compare the two at a
 * glance. Drift between them is caught in either direction: a key added here
 * and not there fails the quarantine case that sends `sessionId` through, and a
 * key added there and not here fails the case that asserts the rendered key
 * order.
 */
const RECORD_KEYS = [
  'protocol', 'at', 'kind', 'op', 'origin', 'itemId', 'fields', 'note',
] as const;

/**
 * `Origin`'s three members, as a table keyed BY the union rather than an array
 * of it.
 *
 * There are already two private copies of this list — `core/validate.ts` ·
 * `const ORIGINS: Origin[] = ['human', 'agent', 'ingest'];` and
 * `cli/commands/audit.ts` · `const ORIGINS: Origin[] = ['human', 'agent', 'ingest'];`
 * — and neither is exported, so a third was unavoidable without editing a
 * module this task does not own. It is a `Record<Origin, true>` and not an
 * `Origin[]` precisely because of that: a fourth member added to the union
 * fails to compile HERE, where the two arrays would keep compiling and quietly
 * start rejecting a member the type permits.
 *
 * It is checked at all because `Origin` is closed on purpose — §6m.5 refused an
 * `import` member — and a pack whose history rows carried one would put that
 * refused value in front of every surface that renders an imported record.
 */
const ORIGINS: Record<Origin, true> = { human: true, agent: true, ingest: true };

/** UTC with milliseconds — `toISOString()`, the spelling every record carries. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** What may be kept of one op's `note`. See the module comment. */
type NoteRule =
  /** The op writes no note. Anything found in the field is dropped. */
  | 'none'
  /** An opaque revision id, optionally followed by `': '` and free text. */
  | 'revision'
  /** `<verb> <itemId>` — travels only when that item travels too. */
  | 'item-ref';

/**
 * Every mutation op's note rule, verified against the writers rather than
 * remembered:
 *
 *   - `stage` — `core/mutate.ts` · `          note: result.revision.revisionId,`
 *   - `discard` — `core/revision.ts` · ``${pending.revisionId}: ${options.reason}``
 *   - `supersede` — `core/mutate.ts` · ``note: `by ${replacement.id}` },``
 *   - `link`/`unlink` — `core/relations.ts` · ``fields: ['relations'], note: `${input.relation} ${input.to}`,``
 *   - the other five reach `auditMutation` with no `extra.note` at all.
 *
 * A revision id is `REV-` plus twelve hex characters of a hash
 * (`core/revision.ts` · ``return `REV-${checksum(JSON.stringify([itemId, canonical(base), canonical(changes)])).slice(0, 12)}`;``),
 * so it names nothing a reader could recognise — which is why `stage` and
 * `discard` may keep theirs while the other three may not keep an item's id.
 *
 * `Record<MutationOp, NoteRule>` and not a partial map: an op added to
 * `MUTATION_OPS` stops this file compiling until someone decides what its note
 * does, instead of inheriting whichever branch a lookup miss happened to take.
 */
const NOTE_RULE: Record<MutationOp, NoteRule> = {
  create: 'none',
  update: 'none',
  promote: 'none',
  accept: 'none',
  refresh: 'none',
  stage: 'revision',
  discard: 'revision',
  supersede: 'item-ref',
  link: 'item-ref',
  unlink: 'item-ref',
};

function json(v: unknown): string {
  return JSON.stringify(v) ?? String(v);
}

/**
 * The note that may travel, or `undefined` for none at all.
 *
 * `carried` is optional and its absence is the SAFE direction: with no set to
 * check against, an `item-ref` note cannot be shown to name a carried item, so
 * it does not travel. A caller that forgets the argument under-reports; one
 * that could forget it and over-report would be a rule enforced only in the
 * caller that remembered to ask.
 */
function redactNote(
  op: MutationOp, note: string | undefined, carried: ReadonlySet<string> | undefined,
): string | undefined {
  if (note === undefined) return undefined;
  const rule = NOTE_RULE[op];
  if (rule === 'none') return undefined;
  if (rule === 'item-ref') {
    // The id is the last whitespace-separated token in both spellings (`by
    // <id>`; `<relation> <id>`, and every member of `RELATION_TYPES` is one
    // underscore-joined word). A note in neither shape names something this
    // build cannot account for, so it does not travel.
    const split = note.lastIndexOf(' ');
    if (split === -1) return undefined;
    return carried?.has(note.slice(split + 1)) === true ? note : undefined;
  }
  const cut = note.indexOf(': ');
  return cut === -1 ? note : note.slice(0, cut);
}

/**
 * What a record is made of, before the two constant keys are stamped on it.
 * `PackHistoryRecord` is assignable to it, so `renderHistory` re-canonicalises
 * through the same literal that built the record in the first place.
 */
interface RecordParts {
  at: string;
  op: MutationOp;
  origin?: Origin | undefined;
  itemId?: string | undefined;
  fields?: readonly string[] | undefined;
  note?: string | undefined;
}

/**
 * The ONE object literal that fixes the key order. Every record in this module
 * is built here, so the order cannot depend on which function assembled it, and
 * a key whose value is `undefined` is not written at all rather than written as
 * `undefined` — `Object.keys` must not see it either.
 */
function canonicalRecord(p: RecordParts): PackHistoryRecord {
  return {
    protocol: PACK_HISTORY_PROTOCOL,
    at: p.at,
    kind: 'mutation',
    op: p.op,
    ...(p.origin === undefined ? {} : { origin: p.origin }),
    ...(p.itemId === undefined ? {} : { itemId: p.itemId }),
    ...(p.fields === undefined ? {} : { fields: [...p.fields] }),
    ...(p.note === undefined ? {} : { note: p.note }),
  };
}

/**
 * One local `AuditRecord`, projected onto the eight travelling keys.
 *
 * `carried` is the exported id set, and it is what decides whether an
 * `item-ref` note may travel — see the module comment. Omitting it withholds
 * every such note.
 *
 * Refuses a record that is not a mutation, rather than stamping
 * `kind: 'mutation'` onto one: the `kind` field is in the format so the file
 * self-describes, and a projection that wrote it over an injection record
 * would make the artefact lie about what it holds.
 *
 * Refuses an `at` that is not the one instant spelling, rather than coercing
 * it. `recordAudit` stamps `new Date().toISOString()`, but `AuditInput` lets a
 * caller supply its own `at` and the audit reader checks only that it is a
 * string — so a hand-edited or hand-written segment reaches here. Passing one
 * through would write a line this build refuses to read back, and an exporter
 * that emits artefacts its own reader rejects is worse than one that stops.
 */
export function projectMutation(
  r: AuditRecord, carried?: ReadonlySet<string>,
): PackHistoryRecord {
  if (r.kind !== 'mutation' || !(MUTATION_OPS as readonly string[]).includes(r.op)) {
    throw new Error(
      `my_context: this audit record is kind ${json(r.kind)}, op ${json(r.op)}, and only a `
      + `mutation travels with a pack. Injections, hook actions, focus changes, refused requests `
      + `and step ticks describe the MACHINE that produced them — which sessions saw what, which `
      + `local file triggered a hook — and none of it is knowledge about the corpus. Nothing was `
      + `projected.`,
    );
  }
  // No `typeof r.at !== 'string'` clause: `INSTANT.test` coerces, so a
  // non-string fails it and is reported by the same sentence. A clause that
  // can never be the one to decide is a clause no test could notice was gone.
  if (!INSTANT.test(r.at) || new Date(r.at).toISOString() !== r.at) {
    throw new Error(
      `my_context: this audit record for ${json(r.itemId)} is stamped ${json(r.at)}, which is not `
      + `a UTC instant with milliseconds (YYYY-MM-DDTHH:MM:SS.sssZ, the spelling every record `
      + `carries). A pack's history is ordered by this field and read back by a stricter parser `
      + `than the one that let it through, so it is refused here rather than exported into a file `
      + `this build could not read. Nothing was projected.`,
    );
  }
  const op = r.op as MutationOp;
  return canonicalRecord({
    at: r.at,
    op,
    origin: r.origin,
    itemId: r.itemId,
    fields: r.fields,
    note: redactNote(op, r.note, carried),
  });
}

/**
 * The total order: `at`, then `itemId` (absent sorting as `''`, before every
 * id), then `op`, and then — by the stability of the sort rather than by a
 * comparison — the record's position in the concatenated segments.
 *
 * Exported so the writer, the importer and the tests share one definition
 * instead of three that agree until they do not.
 */
export function compareHistory(a: PackHistoryRecord, b: PackHistoryRecord): number {
  return compareUtf8(a.at, b.at)
    || compareUtf8(a.itemId ?? '', b.itemId ?? '')
    || compareUtf8(a.op, b.op);
}

/**
 * Every mutation in this workspace's log that names one of `itemIds`,
 * projected, redacted and ordered.
 *
 * Reads through `readAudit`, which reads EVERY segment — the live
 * `audit.jsonl` and every rotated one. Reading only the live file would make a
 * workspace that has ever crossed `AUDIT_MAX_BYTES` export a fraction of its
 * own history, silently, with the fraction depending on when the rotation
 * happened to fall. It also means whatever version handling the audit segment
 * format grows (plan §6n.5) is inherited here rather than duplicated.
 *
 * A mutation with no `itemId` is dropped with the rest: it names no item, so
 * no selection can carry it.
 */
export function exportableHistory(
  root: string, itemIds: ReadonlySet<string>,
): PackHistoryRecord[] {
  return filterAudit(readAudit(root), { kind: 'mutation' })
    .filter((r) => r.itemId !== undefined && itemIds.has(r.itemId))
    .map((r) => projectMutation(r, itemIds))
    .toSorted(compareHistory);
}

/**
 * The bytes of `history.jsonl`: one `JSON.stringify` per record, every line
 * newline-terminated including the last.
 *
 * It re-emits each record through `canonicalRecord` rather than serialising
 * the object it was handed, for the same reason `renderManifest` writes its own
 * literal: `JSON.stringify` follows insertion order, and the format may not
 * depend on the order a caller happened to assemble a record in.
 *
 * No validation: a `PackHistoryRecord` comes from `projectMutation` or from
 * `parseHistory`, and both refuse before they return one.
 */
export function renderHistory(records: readonly PackHistoryRecord[]): Buffer {
  let text = '';
  for (const record of records) text += `${JSON.stringify(canonicalRecord(record))}\n`;
  return Buffer.from(text, 'utf8');
}

/**
 * The shared JSONL spec, with the op vocabulary — and only the op vocabulary —
 * loosened. See the module comment for where the refuse/quarantine line falls.
 */
function specFor(file: string): JsonlLogSpec {
  return {
    file,
    protocol: PACK_HISTORY_PROTOCOL,
    validate: (row: JsonlRow): string | null => {
      if (typeof row.at !== 'string') return 'is missing or mistypes "at"';
      if (!INSTANT.test(row.at) || new Date(row.at).toISOString() !== row.at) {
        return `is stamped ${json(row.at)}, which is not a UTC instant with milliseconds `
          + '(YYYY-MM-DDTHH:MM:SS.sssZ)';
      }
      // Both are validated as STRINGS here and as vocabulary afterwards: a
      // row whose `op` this build has never heard of is version skew and is
      // quarantined one row at a time, while a row with no `op` at all is not
      // a log line and takes the file with it.
      if (typeof row.kind !== 'string') return 'is missing or mistypes "kind"';
      if (typeof row.op !== 'string') return 'is missing or mistypes "op"';
      return null;
    },
    refuse: (line: number, reason: string): Error => new Error(
      `my_context: the pack history at ${file} cannot be read — line ${line} ${reason}. `
      + `Refusing to read it: a line skipped here is a change to an item this pack claims to `
      + `carry, and a history that silently omits entries is worse than one that refuses to `
      + `answer. It is one JSON object per line, each with "protocol", "at", "kind" and "op". `
      + `An op or a kind this build does not know is NOT this error — those are kept aside and `
      + `counted, because a pack may be written by a newer build than the one reading it.`,
    ),
    // Required by `JsonlLogSpec` and not reached from this module: nothing
    // here opens a file — `parseHistory` is handed bytes a reader already
    // holds. It is written properly rather than stubbed, because the spec is
    // what a caller reaching for `readJsonlFile` would pass.
    unreadable: (err: unknown): Error => new Error(
      `my_context: could not read the pack history at ${file} `
      + `(${err instanceof Error ? err.message : String(err)}). This is not the same as "this `
      + `pack carries no history": the manifest lists the file, so it is there and something `
      + `stopped it being read. Investigate the underlying error before retrying.`,
    ),
  };
}

/**
 * One row this build can act on, or `null` for one it must quarantine.
 *
 * Every rejection here is version skew or a stranger's invention, never
 * damage — damage was refused by the shared parser one layer up.
 */
function acceptRow(row: JsonlRow): PackHistoryRecord | null {
  for (const key of Object.keys(row)) {
    if (!(RECORD_KEYS as readonly string[]).includes(key)) return null;
  }
  if (row.kind !== 'mutation') return null;
  if (!(MUTATION_OPS as readonly string[]).includes(row.op as string)) return null;
  if (row.origin !== undefined && !Object.hasOwn(ORIGINS, row.origin as string)) return null;
  if (row.itemId !== undefined && typeof row.itemId !== 'string') return null;
  if (row.note !== undefined && typeof row.note !== 'string') return null;
  if (row.fields !== undefined
    && !(Array.isArray(row.fields) && row.fields.every((f) => typeof f === 'string'))) {
    return null;
  }
  return canonicalRecord({
    at: row.at as string,
    op: row.op as MutationOp,
    origin: row.origin as Origin | undefined,
    itemId: row.itemId as string | undefined,
    fields: row.fields as string[] | undefined,
    note: row.note as string | undefined,
  });
}

/**
 * A `history.jsonl`'s bytes, read back into the records this build can act on
 * and the rows it cannot.
 *
 * Rows are returned in FILE order, not sorted: `compareHistory` is exported for
 * a caller that wants the order, and sorting here would silently reunite a
 * quarantined row's neighbours as if nothing had been set aside.
 */
export function parseHistory(bytes: Buffer, file: string): HistoryRead {
  const records: PackHistoryRecord[] = [];
  const unknown: JsonlRow[] = [];
  for (const row of parseJsonlLog(bytes.toString('utf8'), specFor(file))) {
    const record = acceptRow(row);
    if (record === null) unknown.push(row);
    else records.push(record);
  }
  return { records, unknown };
}
