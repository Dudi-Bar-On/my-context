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
  ConversationIndex, type AnchorRow, iterateTranscript,
} from './conversation-index.ts';
import { proseOf } from './conversation-search.ts';

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
 * The id of the anchor at one point. Deterministic, and the reason marking the
 * same point twice is one row rather than two.
 *
 * The lane segment is `-` rather than empty for a session's own transcript, so
 * a session id and a lane id can never compose the same string.
 */
export function anchorIdFor(
  sessionId: string, agentId: string | null, byteOffset: number,
): string {
  return `${sessionId}:${agentId ?? '-'}:${byteOffset}`;
}

/**
 * Mark one point, or move the label on the one already there. A WRITE.
 *
 * Returns the row as it now stands, so a caller that needs the id — to resolve
 * it, to show it, to take it back — does not have to re-derive it.
 */
export function markAnchor(index: ConversationIndex, spec: AnchorSpec): AnchorRow {
  const agentId = spec.agentId ?? null;
  const row: AnchorRow = {
    id: anchorIdFor(spec.sessionId, agentId, spec.byteOffset),
    sessionId: spec.sessionId,
    agentId,
    byteOffset: spec.byteOffset,
    label: spec.label,
    kind: spec.kind ?? 'note',
    origin: spec.origin ?? 'owner',
    at: spec.at ?? new Date().toISOString(),
  };
  index.putAnchor(row);
  return row;
}

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

/** Take one anchor back. `false` when there was none — an answer, not a failure. */
export function unmarkAnchor(index: ConversationIndex, id: string): boolean {
  return index.dropAnchor(id);
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
