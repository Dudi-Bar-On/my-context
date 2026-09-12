/**
 * **THE TWO RETRIEVAL WRITES THE SCREEN PERFORMS ITSELF** — owner ruling
 * 2026-09-12, *"Yes — screen stages it"*, under
 * `REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`.
 *
 * Destination one for a retrieval result — into THIS session — has always been
 * wholly on the screen: the text is marked, drawn, and the reader copies it.
 * Destination two — a FRESH window, spec §10a — ended until today in a
 * `mycontext restore --build --from-result …` the reader retyped into a
 * terminal, because staging writes a file and this server is proved write-free.
 *
 * The lane that built the screen refused to close its own item against that
 * requirement's deciding sentence: **a composed command a reader copies to a
 * terminal is not the UI having a capability — it is the UI describing one.**
 * The owner took its recommendation rather than a second mechanism: use the
 * SAME narrow no-writes exception `src/ui/anchor-write.ts` already has, one
 * exception and not two. This module is that shape, deliberately down to the
 * registration point and the test that bounds it.
 *
 * ── AND THE CLICK IS THE `'human'`, WHICH IS THE OTHER HALF OF THE RULING ──
 *
 * `approveStagedRestore` (`core/restore-stage.ts`) refuses every actor but
 * `'human'`, and its header says why: *"AND NEVER AUTOMATIC. An agent may
 * propose and may build. ONLY THE OWNER INJECTS."* The owner explicitly
 * accepted the condition that came with letting the screen stage — **a click
 * in his own browser counts as that `'human'`** — so `apiRetrievalApprove`
 * below is the one place in this product other than `cli/commands/restore.ts`
 * that passes it.
 *
 * What stops that being forgeable is not a promise, and it is not one thing:
 *
 *   - **THE SESSION TOKEN.** Every `/api` request carries it
 *     (`src/ui/security.ts`), and a browser only gets one by redeeming a nonce
 *     printed into the owner's own terminal. A process that never saw that
 *     terminal cannot reach any route here at all.
 *   - **THE CONFIRM NONCE, MINTED IN ONE PLACE.** `GET
 *     /api/retrieval/approve/confirm` is the ONLY line that calls `mint`, and
 *     it renders what he is approving. A page that never rendered the confirm
 *     cannot approve — the property `execute.ts` §3.3 already rests on, in the
 *     same store, for the same reason.
 *   - **THE BINDING IS OVER WHAT HE WAS SHOWN, NOT OVER THE KEY ALONE.** The
 *     nonce is bound to `[key, sha256(payload + reviewForm)]` computed from
 *     the record ON DISK, and the POST recomputes that digest from disk rather
 *     than accepting one. A staged record that changed between the confirm and
 *     the click fails the redeem, so "approve" cannot mean a different payload
 *     than the one that was read.
 *   - **AND IT IS ONE-SHOT.** `ExecutionNonceStore` deletes on ATTEMPT —
 *     spent, expired or mismatched — so a click is an authority for exactly
 *     one approval of exactly one record.
 *
 * §6.3 of the execute design says out loud what this does NOT claim: a
 * malicious page on this loopback origin, holding the token, could GET the
 * confirm and then POST. What is impossible is a SILENT approval — one nobody
 * was shown — and that is the property the ruling asked for.
 *
 * ── STAGING IS STILL NOT DELIVERY, AND THAT IS ASSERTED, NOT PROMISED ──────
 *
 * `stageRetrievalReturn` leaves a record in state `proposed`. The question
 * `core/inject.ts` asks at every session start — `approvedRestore(root)` — is
 * the ONLY route any payload has into a context window, and after staging it
 * must still answer nothing. `test/core/retrieval-return.test.ts` asserts that
 * of the core seam and `test/ui/retrieval-write-route.test.ts` asserts it of
 * THIS route, which is the one a page can reach.
 *
 * **And the clear is still his.** There is no verb for it anywhere in this
 * product, there is none here, and nothing on this surface delivers: step 7 is
 * `spendApprovedRestore`, whose one caller is the injection.
 *
 * ── THESE ROUTES ARE NOT IN `registerReadRoutes` ──────────────────────────
 *
 * `test/ui/server-e2e.test.ts` sweeps every route `registeredRoutes()` holds
 * after `registerReadRoutes()` and asserts the corpus is byte-identical
 * afterwards. A write route inside that set would either redden it or force
 * the sweep to grow a hole. So this registers from `startUiServer` beside
 * `registerExecuteRoutes` and `registerAnchorWriteRoutes`, which is the same
 * split for the same reason, and the read sweep keeps meaning what it says.
 *
 * ── WHAT BOUNDS THE EXCEPTION, EACH CHECKABLE RATHER THAN PROMISED ────────
 *
 *   - **IT IS THE SAME SEAM THE CLI USES.** `stageRetrievalReturn` is three
 *     lines over `stageRestoreSummary`, and `approveStagedRestore` is called
 *     with the same arguments `cli/commands/restore.ts` calls it with. D34's
 *     carrier is reused and no second one is grown, which is that ruling in
 *     its own words.
 *   - **WHAT MOVES IS `.staging/restore/`, AND NOTHING ELSE.** A staged
 *     restore is a JSON file in a gitignored directory. No corpus item, no
 *     `config.json`, no transcript, no result file —
 *     `test/ui/retrieval-write-route.test.ts` takes the byte snapshot that
 *     says so over a whole stage/confirm/approve round trip.
 *   - **NOTHING HERE COMPOSES A COMMAND OR STARTS A PROCESS.** There is no
 *     argv and no child. `execute.ts`' whole apparatus is one module over and
 *     is not reached from here.
 *   - **THE ACTOR IS FIXED BY THE ROUTE, NOT BY THE CALLER.** `'human'` is a
 *     literal at the one call site; no request field reaches it, so no body
 *     can approve as anything else — and there is no actor value that would
 *     make `approveStagedRestore` behave differently anyway, which is the
 *     point of it being a refusal rather than a switch.
 *   - **WHAT IS STAGED IS WHAT WAS SHOWN.** The marking comes from
 *     `markedReturnFor` in `read-model-retrieval.ts` — the same function the
 *     preview the reader just read came out of — rather than from a second
 *     marking built beside it.
 */
import { createHash } from 'node:crypto';
import path from 'node:path';

import { approveStagedRestore } from '../core/restore-stage.ts';
import { loadStagedRestore, type StagedRestore } from '../core/restore-staging.ts';
import { stageRetrievalReturn } from '../core/retrieval/return-stage.ts';
import { returnReviewForm, returnShortfalls } from '../core/retrieval/return.ts';
import { markedReturnFor } from './read-model-retrieval.ts';
import { ExecutionNonceStore } from './execute-nonce.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';
import type { Workspace } from '../core/workspace.ts';

/** The shape every handler answers a malformed body with. */
function badRequest(message: string): JsonResult {
  return { status: 400, body: { error: message } };
}

/**
 * The id the approval nonce is bound under.
 *
 * It is not a command and names no process — `ExecutionNonceStore` binds
 * `(id, argv)` and treats both as opaque, which is why the budgets write could
 * already reuse it without inventing a second store. The string is here so
 * that a nonce minted for an approval can never redeem against an execute, and
 * the reverse.
 */
const APPROVE_ID = 'retrieval-restore-approve';

/**
 * **The digest the nonce is bound to, computed from the record ON DISK.**
 *
 * Not from the request, and not carried through the browser: a value the
 * caller supplies and the server echoes back proves nothing about what the
 * caller read. Both sides of the pair compute it from `.staging/restore/<key>`
 * at the moment they run, so a record that changed between the confirm and the
 * click produces a different binding and the redeem refuses.
 *
 * Payload and form BOTH, with a separator that cannot appear in either: they
 * are the two artefacts D34 keeps two, and a digest over only the form would
 * miss a payload swapped underneath it.
 */
function shownDigest(record: StagedRestore): string {
  return createHash('sha256')
    .update(record.payload).update('\u0000').update(record.reviewForm)
    .digest('hex');
}

/** One field of a JSON body, as a string, or `null` when it is not one. */
function stringField(body: unknown, name: string): string | null {
  if (body === null || typeof body !== 'object') return null;
  const value = (body as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : null;
}

/**
 * The staging root, or the refusal for a server with no workspace under it.
 *
 * `ws.projectRoot` is the `.my_context` directory, which is what
 * `restoreStagingDir` joins `.staging/restore` onto — the same value
 * `cli/commands/restore.ts` passes, so the screen and the CLI stage into one
 * place rather than two.
 */
function rootOf(ws: Workspace): string | null {
  return ws.projectRoot;
}

const NO_WORKSPACE: JsonResult = {
  status: 400,
  body: {
    error: 'there is no my_context workspace here, so there is nowhere to stage a return. '
      + 'Run `mycontext init` in the project first.',
  },
};

/* ── POST /api/retrieval/stage ────────────────────────────────────────────── */

/** What the screen draws after a stage. */
export interface RetrievalStageBody {
  /** The key a person picks between when two are waiting. */
  key: string;
  /** Where the record landed, relative to the repository. */
  file: string;
  /**
   * **True only when the record was RE-READ off the disk and matched.** No
   * sentence about clearing may rest on anything else — `stageRestoreSummary`'s
   * own rule, and the reason it re-reads at all.
   */
  verified: boolean;
  reason: string | null;
  /** Bytes of payload read back. A number, so "it is on disk" is measurable. */
  payloadBytes: number;
  /** What he reads before approving. NOT the payload. */
  reviewForm: string;
  /** Every way this return is partial, in words. */
  shortfalls: string[];
  /** Which claims went in, and how many he left behind. */
  chosen: number[];
  left: number;
}

/**
 * **Stage the marked return for a fresh window — and leave a PROPOSAL.**
 *
 * The body is the same `{ id, claims }` the preview took, and it goes through
 * the same `markedReturnFor`, so the text that lands on disk is the text the
 * reader just read. Its refusals are that function's: an id naming no result
 * is a 404 that creates nothing, a claim number the result does not have is a
 * 400 that refuses rather than silently returning a shorter account.
 *
 * `verified: false` is reported and NOT thrown: a stage that could not be read
 * back is exactly the state the reader must be told about before he clears a
 * window, and a 500 would tell him something less specific.
 */
export function apiRetrievalStage(ws: Workspace, body: unknown): JsonResult {
  const root = rootOf(ws);
  if (root === null) return NO_WORKSPACE;

  const outcome = markedReturnFor(ws, body);
  if (!outcome.ok) return outcome.refusal;
  const { marked, relative } = outcome;

  const stage = stageRetrievalReturn(root, marked, relative);
  const answer: RetrievalStageBody = {
    key: stage.key,
    file: path.relative(path.dirname(root), stage.file).split(path.sep).join('/'),
    verified: stage.verified,
    reason: stage.reason,
    payloadBytes: stage.verification.payloadBytes,
    reviewForm: returnReviewForm(marked, relative),
    shortfalls: returnShortfalls(marked),
    chosen: marked.chosen,
    left: marked.left,
  };
  return { status: 200, body: answer };
}

/* ── GET /api/retrieval/approve/confirm ───────────────────────────────────── */

/** What the confirm renders, and the authority it mints for it. */
export interface RetrievalApproveConfirmBody {
  key: string;
  builtAt: string;
  /** What he is approving. The payload is deliberately not here — the form is what it is short for. */
  reviewForm: string;
  shortfalls: string[];
  payloadBytes: number;
  /** Bound to this key AND to the bytes of what is being shown. Single use. */
  nonce: string;
}

/**
 * **The one place a nonce is minted, and it renders the thing it authorises.**
 *
 * `execute.ts`' §3.3 property, in the same store: a page that never rendered
 * the confirm cannot approve. So the record is loaded FIRST and every refusal
 * happens before the mint — a confirm that cannot be shown leaves no live
 * authority behind it.
 */
export function apiRetrievalApproveConfirm(
  ws: Workspace, nonces: ExecutionNonceStore, url: URL,
): JsonResult {
  const root = rootOf(ws);
  if (root === null) return NO_WORKSPACE;
  const key = url.searchParams.get('key') ?? '';
  if (key.trim() === '') {
    return badRequest('key is required: it names which staged return is being approved.');
  }

  let record: StagedRestore | null;
  try {
    record = loadStagedRestore(root, key);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : String(err));
  }
  if (record === null) {
    return {
      status: 404,
      body: { error: `nothing is staged under "${key}".` },
    };
  }
  if (record.state === 'delivered') {
    return badRequest(
      `"${key}" was already delivered at ${record.deliveredAt}. A restore is one-shot; stage a `
      + 'new one rather than re-approving a spent record.',
    );
  }

  const answer: RetrievalApproveConfirmBody = {
    key: record.key,
    builtAt: record.builtAt,
    reviewForm: record.reviewForm,
    shortfalls: record.shortfalls,
    payloadBytes: Buffer.byteLength(record.payload, 'utf8'),
    nonce: nonces.mint(APPROVE_ID, [key, shownDigest(record)]),
  };
  return { status: 200, body: answer };
}

/* ── POST /api/retrieval/approve ──────────────────────────────────────────── */

/** What the approval decided, and the one field a screen may print. */
export interface RetrievalApproveBody {
  key: string;
  /**
   * **The sentence "it is safe to clear" rests on this and on nothing else.**
   * `approveStagedRestore` sets it only after re-reading the approved record
   * off the disk.
   */
  safeToClear: boolean;
  reason: string | null;
  payloadBytes: number;
  approvedAt: string | null;
}

/**
 * **The owner's click, spent as `approveStagedRestore`'s `'human'`.**
 *
 * `'human'` is a LITERAL here. No field of the body reaches that argument, so
 * there is no request that approves as anything else — the same shape
 * `cli/commands/carry.ts` uses at its one call site, and the reason
 * `restore-stage.ts` made the actor a refusal rather than a switch.
 *
 * The redeem happens BEFORE anything is loaded for the approval, and the
 * binding is recomputed from disk: a nonce that authorised a different key, or
 * the same key holding different bytes than the confirm rendered, is refused
 * with nothing written. A 403 rather than a 400 — the request is well formed
 * and is not authorised, which is a different thing from being malformed.
 */
export function apiRetrievalApprove(
  ws: Workspace, nonces: ExecutionNonceStore, body: unknown,
): JsonResult {
  const root = rootOf(ws);
  if (root === null) return NO_WORKSPACE;
  const key = stringField(body, 'key');
  if (key === null || key.trim() === '') {
    return badRequest('key is required: it names which staged return is being approved.');
  }
  // **A BETTER SENTENCE, NOT THE GATE.** An absent nonce is refused below
  // anyway — `redeem` finds no entry for `''` and answers false — and that was
  // measured rather than assumed: removing this branch left
  // `test/ui/retrieval-write-route.test.ts`' "no confirm, no approval" GREEN,
  // while neutering the `!bound` branch turns it red. It stays because a reader
  // whose page lost its confirm deserves to be told that, rather than the
  // "used, expired or changed" sentence below, which would be three guesses
  // and no answer.
  const nonce = stringField(body, 'nonce');
  if (nonce === null || nonce === '') {
    return {
      status: 403,
      body: {
        error: 'no confirmation was presented. An approval releases a payload into the next '
          + 'session, so it is authorised by the confirm this screen renders and by nothing else.',
      },
    };
  }

  let record: StagedRestore | null;
  try {
    record = loadStagedRestore(root, key);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : String(err));
  }
  // **The nonce is still spent when the record is gone.** `redeem` deletes on
  // attempt, and taking the 404 first would leave a live authority behind a
  // refusal — `handleConfirm`'s "no nonce is minted on a refusal", turned
  // around to the redeeming end.
  const bound = nonces.redeem(
    nonce, APPROVE_ID, [key, record === null ? '' : shownDigest(record)],
  );
  if (record === null) {
    return { status: 404, body: { error: `nothing is staged under "${key}".` } };
  }
  if (!bound) {
    return {
      status: 403,
      body: {
        error: 'that confirmation is not valid for this record any more — it has been used, it '
          + 'has expired, or what is staged under this key has changed since you read it. Open '
          + 'the approval again and read what is there now.',
      },
    };
  }

  const result = approveStagedRestore(root, key, 'human', record);
  const answer: RetrievalApproveBody = {
    key,
    safeToClear: result.safeToClear,
    reason: result.reason,
    payloadBytes: result.verification.payloadBytes,
    approvedAt: result.record?.approvedAt ?? null,
  };
  return { status: 200, body: answer };
}

/**
 * Registered from `startUiServer`, NEVER from `registerReadRoutes` — the
 * header says why, and `registerAnchorWriteRoutes` is the precedent it
 * follows.
 *
 * The nonce store is per SERVER and is closed over here, exactly as
 * `registerExecuteRoutes` takes its own: this one authorises a release into a
 * context window, and two servers in one test process must not authorise each
 * other's. The route registration itself is guarded, because the route table
 * is process-global and refuses a duplicate while the node suite starts
 * several servers in one process.
 */
let binding: ExecutionNonceStore | null = null;
let registered = false;

export function registerRetrievalWriteRoutes(nonces: ExecutionNonceStore): void {
  binding = nonces;
  if (registered) return;
  registered = true;
  const active = (): ExecutionNonceStore => {
    if (binding === null) throw new Error('mycontext ui: retrieval staging is not wired');
    return binding;
  };
  registerRoute('POST', '/api/retrieval/stage', {
    kind: 'json', handle: (ctx: ApiContext) => apiRetrievalStage(ctx.ws, ctx.body),
  });
  registerRoute('GET', '/api/retrieval/approve/confirm', {
    kind: 'json',
    handle: (ctx: ApiContext) => apiRetrievalApproveConfirm(ctx.ws, active(), ctx.url),
  });
  registerRoute('POST', '/api/retrieval/approve', {
    kind: 'json',
    handle: (ctx: ApiContext) => apiRetrievalApprove(ctx.ws, active(), ctx.body),
  });
}
