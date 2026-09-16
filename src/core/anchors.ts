/**
 * **Anchors** — `plan:recall seq:1`, Task 3 of
 * `docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md`, and §7 of
 * `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * An anchor is a fixed point the owner can steer back to — the thing he lost.
 * It carries an id, a timestamp, the session, a byte offset into that
 * session's transcript, and a label.
 *
 * The table it lives in is declared in `conversation-index.ts`, and the header
 * there carries the two reasons this is a TABLE and not a column on
 * `conversations`, and the reason the position is in BYTES. They are not
 * restated here.
 *
 * ── THE ID IS DERIVED FROM THE POSITION, AND THAT IS LOAD-BEARING ──────────
 *
 * Anchors are set two ways (§7): the owner marks one, and things that are
 * anchors by nature — a table, a report, a ruling he gave — are marked without
 * him asking. The automatic half runs over transcripts that are re-read on
 * every refresh, so an id derived from the clock or from a counter would file
 * a fresh copy of the same bookmark every turn, and the list he keeps would
 * fill with duplicates of one point. An id that answers *where* makes marking
 * idempotent by construction rather than by every writer remembering.
 *
 * ── RESOLVING ONE IS A SEEK, NOT A WALK ────────────────────────────────────
 *
 * `resolveAnchor` opens the transcript AT the offset and reads the line that
 * starts there — one chunk, whatever the size of the file. It deliberately
 * does not report the record's ORDINAL: that is a second position which could
 * disagree with the first, and the document surfaces that need an ordinal
 * already walk the file once and keep an outline
 * (`ui/read-model-conversation-document.ts`).
 */
import {
  ConversationIndex, anchorIdBeside, anchorIdFor, type AnchorRow, iterateTranscript,
} from './conversation-index.ts';
import { proseOf } from './conversation-search.ts';
import { withAnchorWrite } from './anchor-file.ts';

/**
 * **The kinds the automatic pass is allowed to write**, and the set every other
 * kind must stay out of.
 *
 * It is here rather than in `anchor-pass.ts` because the disjointness below is
 * a fact about the two sets TOGETHER, and a fact split across two modules is
 * one nothing can assert in one place. `anchor-pass.ts` imports it and types
 * its findings by it, so a third automatic grammar cannot be added without
 * this list growing with it.
 *
 * ── `'report'` IS BACK, AND IT IS NOT THE ONE HE WITHDREW ──────────────────
 *
 * The word was spent once and taken back. Until 2026-09-11 a `report` was a
 * DATED PATH under `reports/` matched out of a turn's text, and he ruled it
 * out in those terms: *"it marks a turn that MENTIONS a report, not a report"*.
 * That grammar is still gone and `anchor-pass.ts` still carries the note where
 * its regex used to be.
 *
 * What re-takes the word is the opposite shape, and that is the whole reason
 * the owner ruled it in on 2026-09-15 after reading `anchors/11`'s counts: a
 * lane's FINAL ANSWER, found STRUCTURALLY from `subagents` and the prose index
 * rather than by any text match, labelled with the lane's own mission. The mark
 * is ON the report. Nothing about it can fire on a turn that merely names one,
 * because no text is consulted to decide it.
 */
export const AUTOMATIC_ANCHOR_KINDS = ['table', 'ruling', 'report'] as const;

export type AutomaticAnchorKind = (typeof AUTOMATIC_ANCHOR_KINDS)[number];

/**
 * **THE OWNER'S OWN VOCABULARY** —
 * `TASK-a-mark-you-make-yourself-cannot-say-what-kind-it-is-so-your`, owner
 * ruling 2026-09-15. His question was *"does the user have the same input
 * options so it will be documented it is marked anchores?"* and the answer was
 * no: a hand-made mark was forced to `kind: 'note'` and he could type a label
 * and nothing else. He had made ONE mark in 750.
 *
 * ── WHY IT IS A LIST AND NOT FREE TEXT, WHICH IS THE ONE CONSTRAINT ────────
 *
 * The item's ruling: *"Any owner kind must sit OUTSIDE the automatic set
 * (table, ruling) so reconciliation cannot confuse the two."* A free-text kind
 * could be typed as `table`, and the row would then be an `origin: 'owner'`
 * anchor wearing the automatic pass's own word for what it writes — readable
 * as either by anything that ever comes to read `kind` without `origin` beside
 * it. A closed list is the only version of that guarantee something can check,
 * and `test/core/anchor-kinds.test.ts` checks it.
 *
 * **`origin` is still the thing that PROTECTS the row**, and that has not
 * moved: the pass skips every `origin: 'owner'` anchor whatever kind it
 * carries, which is why a relabel may keep an automatic row's `'table'` on a
 * row that has become his. The disjointness is a second guarantee beside that
 * one, not a replacement for it.
 *
 * ── WHY THESE SIX ─────────────────────────────────────────────────────────
 *
 * They are the things this archive shows him marking: `'note'` first because
 * it is what every existing hand-made anchor already carries and a vocabulary
 * that invalidated his one mark would be a poor way to give him more of them.
 */
export const OWNER_ANCHOR_KINDS = [
  'note', 'decision', 'question', 'defect', 'evidence', 'todo',
] as const;

export type OwnerAnchorKind = (typeof OWNER_ANCHOR_KINDS)[number];

/** Whether a string is one of the kinds the owner may choose. */
export function isOwnerAnchorKind(kind: string): kind is OwnerAnchorKind {
  return (OWNER_ANCHOR_KINDS as readonly string[]).includes(kind);
}

/** What `markAnchor` is told. Everything but the position and the label has a default. */
export interface AnchorSpec {
  sessionId: string;
  /** The lane this points into, or `null`/omitted for the session's own transcript. */
  agentId?: string | null;
  /** Bytes from the start of that transcript. Never characters. */
  byteOffset: number;
  label: string;
  /** What kind of thing it is. Defaults to `'note'` — something a person chose. */
  kind?: string;
  /** `'owner'` when he marked it, `'automatic'` when it was marked for him. */
  origin?: 'owner' | 'automatic';
  /** When it was marked. Defaults to now. */
  at?: string;
  /**
   * The owner's free text beside the label. Defaults to `null`, which is what
   * every automatic anchor carries.
   *
   * An empty or whitespace-only detail is stored as `null` rather than as
   * `''`: two spellings of "nothing" in one column is the defect
   * `subagents.dispatched_by` was repaired for, and a caller that trimmed in
   * one surface and not another would put both in this one.
   */
  note?: string | null;
  /**
   * **`true` when this mark SHARES its turn with a mark of another kind and is
   * not the one holding the point's bare id** —
   * `TASK-a-turn-that-is-both-a-table-and-a-lane-report-is-one-thing`.
   *
   * A turn that is both a table and a lane report carries BOTH marks, by owner
   * ruling of 2026-09-16, and two rows at one byte is one row on the key
   * `anchorIdFor` derives. `anchorIdBeside` is the second slot and this is the
   * flag that reaches it; `conversation-index.ts` carries the argument for a
   * suffixed second id rather than a kind segment on every id, and it is not
   * restated here.
   *
   * **It is a boolean and not the kind**, because the kind is already on the
   * spec: a second field holding the same string is a second thing to disagree
   * with the first, which is the defect this project keeps paying for.
   * `markAnchor` reads the kind off the row it is building.
   */
  beside?: boolean;
}

/** One anchor resolved against the transcript it points into. */
export interface ResolvedAnchor {
  anchor: AnchorRow;
  /** The transcript the offset is into. */
  file: string;
  /**
   * The record that starts at the offset, or `null` when nothing there parses
   * — which is what a CHARACTER offset produces, because it lands inside a
   * record rather than at the start of one.
   */
  record: Record<string, unknown> | null;
  /** The record's words, or `null` when there is no record to read them from. */
  text: string | null;
}

/**
 * The id of the anchor at one point — the derivation this file's header argues
 * for, re-exported from where it is defined.
 *
 * It MOVED to `conversation-index.ts` (`plan:recall seq:6`) and is re-exported
 * rather than copied, because a second spelling of an id rule is the
 * one-fact-recorded-twice defect this project has already paid for. The move
 * was forced by the same read-only guarantee that put the anchors FILE in its
 * own module: this one can now write, and a viewer deriving an id must not
 * have to load a module that writes to do it.
 */
export { anchorIdFor } from './conversation-index.ts';

/**
 * **The id of the SECOND mark at a point** — re-exported from where it is
 * defined, for `anchorIdFor`'s reason one line up and for no other.
 *
 * A turn that is both a table and a lane report carries both marks
 * (`TASK-a-turn-that-is-both-a-table-and-a-lane-report-is-one-thing`), and the
 * viewer must be able to name the second row without loading a module that can
 * write one. The argument for the id shape is in `conversation-index.ts`.
 */
export { anchorIdBeside } from './conversation-index.ts';

/**
 * Mark one point, or move the label on the one already there. A WRITE.
 *
 * Returns the row as it now stands, so a caller that needs the id — to resolve
 * it, to show it, to take it back — does not have to re-derive it.
 *
 * **This is the door, and it is the door because the write has two halves.**
 * `plan:recall seq:6`: the anchors document is the truth and the table is
 * rebuilt from it, so `withAnchorWrite` publishes the document in the same
 * transaction that moves the row. A caller that reached past this to
 * `index.putAnchor` would put a bookmark in a table that the next
 * reconciliation deletes — which is why that path refuses inside a transaction
 * it does not recognise, rather than quietly succeeding.
 */
export function markAnchor(index: ConversationIndex, spec: AnchorSpec): AnchorRow {
  const agentId = spec.agentId ?? null;
  const note = spec.note ?? null;
  const kind = spec.kind ?? 'note';
  const row: AnchorRow = {
    // **The point's own id, unless this mark is the SECOND at the point** —
    // `AnchorSpec.beside`, and the whole argument for the two spellings is in
    // `anchorIdBeside`'s header rather than here.
    id: spec.beside === true
      ? anchorIdBeside(spec.sessionId, agentId, spec.byteOffset, kind)
      : anchorIdFor(spec.sessionId, agentId, spec.byteOffset),
    sessionId: spec.sessionId,
    agentId,
    byteOffset: spec.byteOffset,
    label: spec.label,
    kind,
    origin: spec.origin ?? 'owner',
    at: spec.at ?? new Date().toISOString(),
    // The trim is HERE and not in each caller, for `AnchorSpec.note`'s stated
    // reason: a column holding both `''` and `null` for "no detail" is two
    // namespaces in one place, which is what a caller-by-caller rule produces.
    note: note === null || note.trim() === '' ? null : note,
  };
  withAnchorWrite(index, () => index.putAnchor(row));
  return row;
}

/**
 * Which lane marked an anchor, in the lane's own dispatched name — the
 * derivation `TASK-a-table-mark-is-labelled-with-one-word-from-its-header-and-a`
 * asks for, re-exported from where it is defined.
 *
 * **It lives in `conversation-index.ts` for `anchorIdFor`'s reason, exactly**:
 * the read-only viewer must be able to name the lane behind a bookmark without
 * loading a module that can write one, and `test/ui/no-writes.test.ts` walks
 * the import graph to make sure it cannot. This module exports `markAnchor`;
 * a read model importing it for the lane name would spend the whole guarantee
 * on a convenience import. Every writer still reaches it where it always was.
 */
export { laneNameOf } from './conversation-index.ts';

/**
 * One session's anchors — its own transcript's and its lanes' — in the order
 * they appear in the conversation.
 *
 * A session's lanes are INCLUDED rather than a separate call, because the
 * archive is mostly lanes and a reader asking "what did I mark in that
 * session" is not asking a question about which file the words landed in.
 */
export function anchorsFor(index: ConversationIndex, sessionId: string): AnchorRow[] {
  return index.anchorRows(sessionId);
}

/** Every anchor in the archive, newest first. */
export function allAnchors(index: ConversationIndex): AnchorRow[] {
  return index.anchorRows(null);
}

/**
 * Anchors whose LABEL contains a term.
 *
 * This searches the labels and not the conversation — the two are different
 * questions and `searchArchive` is the other one. A label is the part the
 * owner wrote, and an anchor list he can search is the part §11 asks Phase 1
 * to carry beside search itself.
 */
export function searchAnchors(index: ConversationIndex, query: string): AnchorRow[] {
  const trimmed = query.trim();
  if (trimmed === '') return [];
  return index.matchAnchors(trimmed);
}

/**
 * Take one anchor back. `false` when there was none — an answer, not a failure.
 *
 * The door, for `markAnchor`'s reason: the removal has to reach the document
 * too, and the existence check runs INSIDE the write so that it is asked of a
 * table already brought up to the file rather than of a stale one.
 */
export function unmarkAnchor(index: ConversationIndex, id: string): boolean {
  return withAnchorWrite(index, () => index.dropAnchor(id));
}

/**
 * Read the record an anchor points at.
 *
 * `null` means **the transcript is not in the archive** — a session the
 * harness pruned, or a lane whose row has gone. The anchor itself survives
 * that (it is a table for exactly this reason) and simply waits, so this
 * reports a state rather than a failure.
 *
 * A resolved anchor whose `record` is `null` is the OTHER state and is kept
 * distinct from it: the file is there and the offset does not land on the
 * start of a record. That is what a character offset produces on this corpus,
 * and it is the failure mode worth naming, because an offset that lands
 * mid-record reads as unreadable rather than throwing.
 */
export function resolveAnchor(index: ConversationIndex, id: string): ResolvedAnchor | null {
  const anchor = index.anchorRow(id);
  if (anchor === null) return null;
  const file = anchor.agentId === null
    ? index.get(anchor.sessionId)?.file ?? null
    : index.getSubagent(anchor.agentId)?.file ?? null;
  if (file === null) return null;

  // The generator's `finally` closes the descriptor when the loop breaks, so
  // this reads one chunk however large the transcript is.
  for (const record of iterateTranscript(file, { startByte: anchor.byteOffset })) {
    if (record.record === null) return { anchor, file, record: null, text: null };
    return { anchor, file, record: record.record, text: proseAt(record.record) };
  }
  return { anchor, file, record: null, text: null };
}

/**
 * The words of the record an anchor landed on.
 *
 * Deliberately the same reading `conversation-search.ts` does — it is imported
 * rather than re-derived so that the text an anchor shows and the text the
 * search matched cannot come to differ.
 */
function proseAt(record: Record<string, unknown>): string | null {
  const text = proseOf(record);
  return text === '' ? null : text;
}
