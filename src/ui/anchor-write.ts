/**
 * **THE FOUR ANCHOR WRITES THE SCREEN PERFORMS ITSELF** —
 * `REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`, owner
 * ruling 2026-09-12.
 *
 * His words: *"i want that everything relating to anchors will be available
 * through the ui, cli is ok, mcp too but they are not a substitution for the
 * ui capabilities"*, and *"you shouldn't limit me because you decided to use
 * the CLI and then you tell me that this is the way i need to use it —
 * unacceptable."*
 *
 * **A composed command a reader must copy into a terminal is not the UI having
 * the capability — it is the UI describing one.** Every route here exists
 * because the viewer used to describe a write instead of performing it.
 *
 * ── WHY THE NO-WRITES GATE TAKES AN EXCEPTION HERE, NARROWLY ──────────────
 *
 * The owner asked, on 2026-09-11, why a bookmark needed a confirm dialog and a
 * subprocess when an anchor never touches the session file, and the
 * measurement supported him: an anchor is a row in a rebuildable index and a
 * line in a gitignored document. It is not a corpus mutation, not a shell
 * command, and not something the deny rules were written about.
 *
 * So `test/ui/no-writes.test.ts` names this module's three write bindings in
 * `RULED_WRITES`, which is that file's own shape for a ruled write — the shape
 * `src/ui/execute.ts` already wears three times. The exception is HELD TO A
 * TEST rather than trusted: `test/ui/anchor-write-route.test.ts` asserts that
 * a whole anchor round trip through these routes leaves every byte of the
 * corpus alone EXCEPT the anchors document and the index, and that assertion
 * goes red the day one of them reaches anything else.
 *
 * Four properties bound the write, each checkable rather than promised:
 *
 *   - **IT IS THE SAME SEAM THE CLI USES.** `markAnchor`/`unmarkAnchor` are
 *     the doors, `withAnchorWrite` publishes `.my_context/.anchors.jsonl` in
 *     the transaction that moves the row, and the table is rebuilt from the
 *     file. None of the three creation paths grows a second store, because
 *     none of them can reach past that door — `index.putAnchor` refuses
 *     outside a transaction it recognises.
 *   - **NOTHING HERE COMPOSES A COMMAND OR STARTS A PROCESS.** There is no
 *     argv, no nonce, no child. The whole write is one row.
 *   - **THE SHAPE OF WHAT MAY BE WRITTEN IS FIXED HERE, NOT BY THE CALLER.**
 *     A hand-made anchor is `kind: 'note'`, `origin: 'owner'` — the caller
 *     cannot choose either, so no request can forge a row the automatic pass
 *     would then refuse to touch, or one wearing a kind this build has no word
 *     for.
 *   - **IT REFUSES A WORKSPACE NOBODY HAS SCANNED.** `ConversationIndex.open`
 *     creates the tables, and marking a bookmark is not a way to turn the
 *     archive on. The gate is `openReadOnlyChecked` first, exactly as
 *     `indexExists` in `cli/commands/conversation.ts` does it, and the answer
 *     is the never-indexed state rather than a new database.
 *
 * ── AND THESE ROUTES ARE NOT IN `registerReadRoutes` ──────────────────────
 *
 * `test/ui/server-e2e.test.ts` sweeps every route `registeredRoutes()` holds
 * after `registerReadRoutes()` and asserts the corpus is byte-identical
 * afterwards. A write route inside that set would either redden it or force
 * the sweep to grow a hole. So this registers from `startUiServer` beside
 * `registerExecuteRoutes`, which is the same split for the same reason, and
 * the read sweep keeps meaning exactly what it says.
 */
import { ConversationIndex, ConversationIndexIncompleteError, ConversationIndexUninitializedError }
  from '../core/conversation-index.ts';
import {
  AUTOMATIC_ANCHOR_KINDS, OWNER_ANCHOR_KINDS, isOwnerAnchorKind, laneNameOf, markAnchor,
  unmarkAnchor, type OwnerAnchorKind,
} from '../core/anchors.ts';
import {
  automaticAnchorsStanding, fileOf, markAutomaticAnchors, previewAutomaticAnchors,
} from '../core/anchor-pass.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';
import type { Workspace } from '../core/workspace.ts';

/**
 * The longest label this surface will store.
 *
 * A bookmark's label is a sentence a person types to recognise a point by, and
 * the CLI has never capped it. The cap is here because this door is reachable
 * from a page: a body is already capped at 64 KB by `readBody`, and a label
 * that filled it would be a bookmark nobody could read in a list. 500 is well
 * past the longest label in this workspace (the longest is a corpus id at 62).
 */
const LABEL_CAP = 500;

/**
 * The longest free-text detail this surface will store beside a label.
 *
 * `TASK-a-mark-you-make-yourself-cannot-say-what-kind-it-is-so-your`: the
 * label is the line that has to fit in a list, and this is the sentence that
 * did not fit — so it is capped far above `LABEL_CAP` and far below the 64 KB
 * `readBody` already allows. 2000 is several paragraphs and is not a limit he
 * will meet by writing what he meant.
 */
const NOTE_CAP = 2000;

/** The shape every handler answers a malformed body with. */
function badRequest(message: string): JsonResult {
  return { status: 400, body: { error: message } };
}

/**
 * **The owner's kind, from his own vocabulary, or a refusal naming it.**
 *
 * Three answers, and the third is the one that matters: `undefined` when the
 * request said nothing, the kind when it said something legal, and a
 * `JsonResult` when it said something this build has no word for.
 *
 * **The vocabulary is checked against `OWNER_ANCHOR_KINDS` and therefore
 * cannot reach `AUTOMATIC_ANCHOR_KINDS`** — the two are disjoint by
 * construction and `test/core/anchor-kinds.test.ts` holds them apart. That is
 * the whole of the item's constraint: giving him a kind must not give a
 * REQUEST a way to write `kind: 'table'`, because reconciliation would then
 * have a row wearing the automatic pass's own word for what it writes.
 */
function ownerKind(body: unknown, field = 'kind'): OwnerAnchorKind | undefined | JsonResult {
  if (body === null || typeof body !== 'object') return undefined;
  const raw = (body as Record<string, unknown>)[field];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'string' || !isOwnerAnchorKind(raw)) {
    return badRequest(
      `${field} must be one of ${OWNER_ANCHOR_KINDS.join(', ')}. The automatic pass writes `
      + `${AUTOMATIC_ANCHOR_KINDS.join(' and ')}, and a mark you make cannot wear one of those: `
      + 'the two vocabularies are kept apart so that reconciliation can never mistake a bookmark '
      + 'you made for one it made.',
    );
  }
  return raw;
}

/**
 * **The free-text detail, or a refusal** — and `null` is a REAL answer here,
 * distinct from the field being absent.
 *
 * `undefined` means the request said nothing about the note, which on a
 * relabel must carry the existing one over; `null` means he cleared it. A
 * surface that collapsed the two would erase a paragraph every time he fixed a
 * typo in a label, which is `INV-nothing-is-dropped-silently` in the direction
 * that costs the most.
 */
function noteField(body: unknown): string | null | undefined | JsonResult {
  if (body === null || typeof body !== 'object') return undefined;
  const raw = (body as Record<string, unknown>)['note'];
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string') {
    return badRequest('note must be a string, or null to clear it.');
  }
  if (raw.length > NOTE_CAP) {
    return badRequest(`note must be at most ${NOTE_CAP} characters.`);
  }
  return raw;
}

/** Whether a helper above answered with a refusal rather than a value. */
function isRefusal(value: unknown): value is JsonResult {
  return typeof value === 'object' && value !== null && 'status' in value;
}

/**
 * **THE NEVER-INDEXED ANSWER, and it is a state rather than a failure.**
 *
 * Returned as 200 with `indexed: false`, the same shape
 * `apiConversationAnchors` answers the read side with, so the screen has ONE
 * way of saying "there is no archive here yet" rather than one per verb.
 */
const NOT_INDEXED: JsonResult = {
  status: 200,
  body: {
    indexed: false,
    error: 'Nothing is indexed in this workspace yet, so there is nothing to mark. '
      + 'Run `mycontext conversation rebuild` first.',
  },
};

/**
 * A writable index, or `null` when the archive has never been built.
 *
 * **The read door is opened FIRST and closed again.** `ConversationIndex.open`
 * creates the tables, so calling it on a fresh workspace would turn the
 * archive on by way of a bookmark — the exact thing `indexExists`
 * (`cli/commands/conversation.ts`) refuses on the CLI side, refused here in
 * the same words and for the same reason. Two opens is the price; a surface
 * that cannot create the thing it writes into is what they buy.
 */
function openForWrite(ws: Workspace): ConversationIndex | null {
  try {
    ConversationIndex.openReadOnlyChecked(ws.dbPath).close();
  } catch (err) {
    if (err instanceof ConversationIndexUninitializedError
      || err instanceof ConversationIndexIncompleteError) return null;
    throw err;
  }
  return ConversationIndex.open(ws.dbPath);
}

/** One field of a JSON body, as a string, or `null` when it is not one. */
function stringField(body: unknown, name: string): string | null {
  if (body === null || typeof body !== 'object') return null;
  const value = (body as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : null;
}

/**
 * The row a write answers with — everything the screen draws about an anchor,
 * in the same field names `AnchorView` uses on the read side.
 *
 * It carries `sessionName` and `sessionTitle` because the screen names a
 * conversation by the name the reader gave it before the id, and a row that
 * came back without them would draw as a bare id until the next refresh — a
 * flicker that says the write half and the read half disagree when they do
 * not.
 */
export interface AnchorWriteView {
  id: string;
  sessionId: string;
  sessionName: string | null;
  sessionTitle: string | null;
  agentId: string | null;
  /**
   * **WHICH LANE was running when this point was marked**, in the name its
   * dispatcher typed — `"Lane N: rename cancel and hidden total"`.
   *
   * Derived by `laneNameOf` from `subagents.description` and stored nowhere:
   * the join was always available and nothing showed it. Read it BESIDE
   * `agentId`, which is what tells the three states apart — `agentId === null`
   * is the main session and not a missing lane, and that distinction is
   * `STD-a-measured-zero-is-drawn-and-named`, not a nicety. 386 of the owner's
   * 750 anchors carry a lane; the other 364 he and the main session made.
   */
  laneName: string | null;
  byteOffset: number;
  label: string;
  kind: string;
  origin: string;
  at: string;
  /** His free text beside the label, or `null`. Automatic anchors have none. */
  note: string | null;
}

function viewOf(index: ConversationIndex, id: string): AnchorWriteView | null {
  const row = index.anchorRow(id);
  if (row === null) return null;
  const name = index.names().find((n) => n.sessionId === row.sessionId)?.name ?? null;
  return {
    id: row.id,
    sessionId: row.sessionId,
    sessionName: name,
    sessionTitle: index.get(row.sessionId)?.title ?? null,
    agentId: row.agentId,
    laneName: laneNameOf(index, row.agentId),
    byteOffset: row.byteOffset,
    label: row.label,
    kind: row.kind,
    origin: row.origin,
    at: row.at,
    note: row.note,
  };
}

/**
 * `POST /api/conversations/anchors/mark` — **creation paths 2 and 3, and the
 * one a search hit takes.**
 *
 * The body is `{ sessionId, agentId, byteOffset, label, kind?, note? }`.
 *
 * ── `origin` IS STILL NOT ACCEPTED, AND THAT IS THE PROPERTY BEING KEPT ────
 *
 * `kind` and `note` were added 2026-09-15 under
 * `TASK-a-mark-you-make-yourself-cannot-say-what-kind-it-is-so-your` — his
 * question was *"does the user have the same input options so it will be
 * documented it is marked anchores?"* and the answer was no: a hand-made mark
 * was pinned to `kind: 'note'`, he could type a label and nothing else, and he
 * had made ONE mark in 750 while the pass recorded a kind, a byte, a session,
 * an agent and an instant for every one of its own.
 *
 * **What was NOT traded away is why the pinning existed.** `origin` is still
 * fixed to `'owner'` here and cannot be chosen, so no request can forge a row
 * the automatic pass is forbidden to read; and `kind` is checked against
 * `OWNER_ANCHOR_KINDS`, which is DISJOINT from `AUTOMATIC_ANCHOR_KINDS`, so no
 * request can write `kind: 'table'` either. The vocabulary he gained is his
 * own and reaches nothing the pass writes — `ownerKind` above says it in the
 * refusal itself.
 *
 * **The offset is verified against a transcript the archive actually holds**
 * before anything is written. Without that, a marked point in a session the
 * harness pruned would be an anchor that resolves to nothing, indistinguishable
 * on screen from a live one.
 */
export function apiAnchorMark(ws: Workspace, body: unknown): JsonResult {
  const sessionId = stringField(body, 'sessionId');
  if (sessionId === null || sessionId.trim() === '') {
    return badRequest('sessionId is required: an anchor is a point in one transcript.');
  }
  const rawAgent = body !== null && typeof body === 'object'
    ? (body as Record<string, unknown>)['agentId'] : undefined;
  if (rawAgent !== undefined && rawAgent !== null && typeof rawAgent !== 'string') {
    return badRequest('agentId must be a lane id, or null for the session\'s own transcript.');
  }
  const agentId = typeof rawAgent === 'string' && rawAgent !== '' ? rawAgent : null;

  const rawOffset = body !== null && typeof body === 'object'
    ? (body as Record<string, unknown>)['byteOffset'] : undefined;
  if (typeof rawOffset !== 'number' || !Number.isInteger(rawOffset) || rawOffset < 0) {
    return badRequest(
      'byteOffset must be a whole number of BYTES from the start of the transcript, never '
      + 'characters — this archive is half Hebrew and a character offset lands inside a record '
      + 'rather than at the start of one.',
    );
  }
  const label = stringField(body, 'label');
  if (label === null || label.trim() === '') {
    return badRequest(
      'label is required. A bookmark that says nothing about why it was kept is one you will '
      + 'not recognise when you come back.',
    );
  }
  if (label.length > LABEL_CAP) {
    return badRequest(`label must be at most ${LABEL_CAP} characters.`);
  }
  const kind = ownerKind(body);
  if (isRefusal(kind)) return kind;
  const note = noteField(body);
  if (isRefusal(note)) return note;

  const index = openForWrite(ws);
  if (index === null) return NOT_INDEXED;
  try {
    if (fileOf(index, sessionId, agentId) === null) {
      return {
        status: 404,
        body: {
          error: `The archive holds no transcript for "${sessionId}"`
            + `${agentId === null ? '' : ` / "${agentId}"`}. Run \`mycontext conversation `
            + 'rebuild\`, or open the conversation again — the list may have moved on.',
        },
      };
    }
    const row = markAnchor(index, {
      sessionId,
      agentId,
      byteOffset: rawOffset,
      label: label.trim(),
      // `'note'` is the default and not a pin: it is what every hand-made
      // anchor in this workspace already carries, so a reader who says nothing
      // gets exactly the row this route wrote before today.
      kind: kind ?? 'note',
      note: note ?? null,
    });
    return { status: 200, body: { indexed: true, anchor: viewOf(index, row.id) } };
  } finally {
    index.close();
  }
}

/**
 * `POST /api/conversations/anchors/relabel` — **capability 5.**
 *
 * The position is the id, so a relabel is `markAnchor` at the same point with
 * a new label. Two fields are carried over and one is deliberately not:
 *
 *   - `kind` and `at` are the anchor's own unless he says otherwise.
 *     Re-deriving either would reorder his list every time he fixed a typo.
 *     `kind` and `note` may now be GIVEN — this is the only edit path an
 *     anchor has, so a vocabulary he could set once and never correct would be
 *     half a capability. A given `kind` is checked against
 *     `OWNER_ANCHOR_KINDS` exactly as on `mark`.
 *
 *     **An ABSENT `note` carries the existing one over; an explicit `null`
 *     clears it.** Collapsing those two would erase a paragraph every time he
 *     fixed a typo in a label, which is `INV-nothing-is-dropped-silently` in
 *     the direction that costs the most.
 *   - `origin` becomes `'owner'`, ALWAYS, and that is the one behaviour here
 *     that is a decision rather than an arithmetic. A label a person typed onto
 *     an `origin: 'automatic'` row would be overwritten by the next automatic
 *     pass, which reads every row it owns back at its own byte and puts it to
 *     today's grammar — silently. `INV-nothing-is-dropped-silently` forbids
 *     that, and the pass never reads an `origin: 'owner'` row, so the moment he
 *     names a bookmark it becomes his. The screen SAYS so
 *     (`conv.anchors.relabelledOwn`) rather than letting him find out by the
 *     kind changing under him.
 */
export function apiAnchorRelabel(ws: Workspace, body: unknown): JsonResult {
  const id = stringField(body, 'id');
  if (id === null || id.trim() === '') return badRequest('id is required.');
  const label = stringField(body, 'label');
  if (label === null || label.trim() === '') {
    return badRequest('label is required — an empty label is a bookmark you cannot recognise.');
  }
  if (label.length > LABEL_CAP) {
    return badRequest(`label must be at most ${LABEL_CAP} characters.`);
  }
  const kind = ownerKind(body);
  if (isRefusal(kind)) return kind;
  const note = noteField(body);
  if (isRefusal(note)) return note;

  const index = openForWrite(ws);
  if (index === null) return NOT_INDEXED;
  try {
    const standing = index.anchorRow(id);
    if (standing === null) {
      return { status: 404, body: { error: `No anchor is held under the id "${id}".` } };
    }
    const wasAutomatic = standing.origin === 'automatic';
    const row = markAnchor(index, {
      sessionId: standing.sessionId,
      agentId: standing.agentId,
      byteOffset: standing.byteOffset,
      label: label.trim(),
      kind: kind ?? standing.kind,
      origin: 'owner',
      at: standing.at,
      note: note === undefined ? standing.note : note,
    });
    return {
      status: 200,
      body: { indexed: true, anchor: viewOf(index, row.id), tookOwnership: wasAutomatic },
    };
  } finally {
    index.close();
  }
}

/**
 * `POST /api/conversations/anchors/drop` — **capability 6.**
 *
 * `dropped: false` is an ANSWER and not a failure: the row was already gone,
 * which is what a second click on a stale list produces. Reporting it as a 404
 * would make an idempotent removal look like a broken one.
 */
export function apiAnchorDrop(ws: Workspace, body: unknown): JsonResult {
  const id = stringField(body, 'id');
  if (id === null || id.trim() === '') return badRequest('id is required.');
  const index = openForWrite(ws);
  if (index === null) return NOT_INDEXED;
  try {
    return { status: 200, body: { indexed: true, dropped: unmarkAnchor(index, id) } };
  } finally {
    index.close();
  }
}

/**
 * `POST /api/conversations/anchors/sweep` — **capability 7, and creation path
 * 2: the retroactive single run, started from the screen.**
 *
 * The owner, 2026-09-12: *"i need a trigger in the ui to initiate anchores
 * creations if can't do it automatically which you told me you can."* Both
 * halves of that are true at once — the pass IS automatic and produced 564 of
 * the 565 anchors in this workspace — and what was missing is that it could
 * only ever START from a terminal.
 *
 * **The whole report is returned, and the screen shows it**, because the pass
 * is a whole-archive walk measured at 8.6 s cold over 307 transcripts and a
 * button that runs a nine-second walk and says nothing is a button nobody
 * presses twice. `INV-nothing-is-dropped-silently` already requires the
 * disclosure: how many were newly marked, relabelled, and TAKEN BACK.
 *
 * It is safe to press twice, and that is why a button is honest here rather
 * than a confirm: the pass sweeps only what it owns, never reads an
 * `origin: 'owner'` row, and a second run immediately after a first reports 0
 * new, 0 taken back, 0 relabelled — idempotent in both directions, measured
 * 2026-09-11.
 *
 * ── `{ plan: true }` — THE FIRST PRESS IN A WORKSPACE THAT HAS NEVER HAD ONE
 *
 * Added 2026-09-16 under `TASK-a-user-who-installs-mycontext-mid-project-has-
 * conversations`. "Safe to press twice" stays true and is not what the first
 * press needs: measured that day on a foreign project's real archive, the
 * first press over a history that predates this plugin marks **1,213 points
 * in one act** — 907 tables, 275 lane reports, 31 rulings — and `anchors/9`
 * measured that 1,155 marks was already enough to make the rare kinds hard to
 * find. Reversible is not the same as expected.
 *
 * So the screen asks for a PLAN first and shows what is about to happen. The
 * body decides, and the DEFAULT IS UNCHANGED: `{}` still runs the pass in one
 * press, which is what every later press does and what every existing caller
 * sends. `firstRun` rides along so the screen can tell a bulk first press from
 * the ordinary one without asking a second question.
 */
export function apiAnchorSweep(ws: Workspace, body: unknown = null): JsonResult {
  const index = openForWrite(ws);
  if (index === null) return NOT_INDEXED;
  try {
    const wantsPlan = typeof body === 'object' && body !== null
      && (body as { plan?: unknown }).plan === true;
    // **THE COUNT IS TAKEN BEFORE THE PASS**, on both paths, because after it
    // has run the answer is always "not a first run" and the screen would
    // never be able to say what it had just done.
    const firstRun = automaticAnchorsStanding(index) === 0;
    const report = wantsPlan ? previewAutomaticAnchors(index) : markAutomaticAnchors(index);
    return { status: 200, body: { indexed: true, firstRun, report } };
  } finally {
    index.close();
  }
}

/**
 * Registered from `startUiServer`, NEVER from `registerReadRoutes` — the
 * header says why, and `registerExecuteRoutes` is the precedent it follows.
 *
 * Guarded, because the route table is process-global and refuses a duplicate:
 * the node suite starts several servers in one process, and the second one
 * must not throw on a table the first one filled.
 */
let registered = false;

export function registerAnchorWriteRoutes(): void {
  if (registered) return;
  registered = true;
  registerRoute('POST', '/api/conversations/anchors/mark', {
    kind: 'json', handle: (ctx: ApiContext) => apiAnchorMark(ctx.ws, ctx.body),
  });
  registerRoute('POST', '/api/conversations/anchors/relabel', {
    kind: 'json', handle: (ctx: ApiContext) => apiAnchorRelabel(ctx.ws, ctx.body),
  });
  registerRoute('POST', '/api/conversations/anchors/drop', {
    kind: 'json', handle: (ctx: ApiContext) => apiAnchorDrop(ctx.ws, ctx.body),
  });
  registerRoute('POST', '/api/conversations/anchors/sweep', {
    kind: 'json', handle: (ctx: ApiContext) => apiAnchorSweep(ctx.ws, ctx.body),
  });
}
