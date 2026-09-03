import type { ServerResponse } from 'node:http';
import { resolveCorpus } from '../core/corpus-identity.ts';
import { AUDIT_KINDS, type AuditKind, type AuditRecord } from '../core/audit.ts';
import {
  openProjectionReadOnlyChecked, queryProjection, topItems,
  ProjectionAbsentError, ProjectionStaleError, type SummaryRow,
} from '../core/audit-db.ts';
import { AuditTail } from '../core/audit-tail.ts';
import type { TailBacklog } from '../core/audit-tail.ts';
import {
  classifyContext, classifyRateLimits, distinctSessionName, modeFlags, payloadExtras, readTee,
  type ContextSample, type RateLimits,
} from '../core/statusline-tee.ts';
// **The handover verdict is READ here, never re-derived** (`plan:walk seq:118`).
// `checkHandoverAsk` is the one implementation of "was the ask acted on" — it
// compares the latch's `askedAt` against the handover file's mtime — and a
// second computation in the browser would be a second spelling of one
// question, which is how two facts come apart. So the SERVER answers and the
// strip renders what it is told. Only the non-writing half of that module is
// bound here; `writeLatch`, `resetAsksForWindow` and `discloseIgnoredAsk` are
// named as writers in `test/ui/no-writes.test.ts` and stay out of `src/ui/`.
import {
  contextEpochStart, newestAuditRow, shareOf, type LastAuditRead,
} from '../core/context-share.ts';
// **Focus is read from `state/focus.json`, never from the audit log.** Every
// `focus-set` row in the real log carries `sessionId: null` — measured on this
// repository's own log — so the log cannot answer "what is this session focused
// on" at all. `readFocus` never throws and never writes; the writers
// (`writeFocus`, `clearFocus`, `setFocus`, `unsetFocus`) stay out of `src/ui/`
// and are named as writers in `test/ui/no-writes.test.ts`.
import { describeFocus, isFocusActive, readFocus } from '../core/focus.ts';
import path from 'node:path';
import { checkHandoverAsk, type HandoverAskVerdict } from '../core/handover-ask.ts';
// The ONE place the 98 default is applied (`core/config.ts`). The occupancy
// bands the strip colours with are named against this number and are derived
// from it in the client, so it travels beside the sample rather than being
// re-spelled there — `plan:walk seq:117`: "Colour against
// `handoverThresholdPercent`, not a constant."
import { handoverThresholdPercent } from '../core/config.ts';
import type { Workspace } from '../core/workspace.ts';
import { badRequest, repeatedParams, unknownParams } from './read-model.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';
import { SECURITY_HEADERS } from './security.ts';

// --- Watch: the live view (spec §4 Watch, §5) -------------------------------
//
// Spills are the centre of this module, not a detail. A `spilled` entry is
// the ONLY record anywhere of an item that was selected and did not fit the
// budget — the ledger records deliveries only — so "why didn't Claude see
// this item" is answered here and nowhere else.
//
// **NOTHING HERE OPENS A LEDGER.** The activity pulse's series comes from the
// audit projection (owner ruling A2): `at` and `kind` are two generated
// columns of the same audit row, both indexed, so no join is required. The
// ledger has no kind at all, and its `(session_id, item_id, tier)` key
// collides repeat injections inside a session, so a series drawn from it
// undercounts by exactly those repeats — `Ledger.history()`'s own docblock
// says so (`core/ledger.ts` · `from it undercounts by exactly the repeats the key swallowed. Which stamp` · ~465).
//
// **NOTHING HERE WRITES, AND THAT COST THE PLAN'S OWN SHAPE.** The plan routed
// all three JSON endpoints through `openProjection` + `syncProjection`. Both
// write: `openProjection` calls `ensureLogDir`, creates the database when it
// is missing, sets `journal_mode = WAL`, runs twelve `CREATE … IF NOT EXISTS`
// on every open, and on any failure `rmSync`s the file and both sidecars;
// `syncProjection` inserts, and on `diverged` deletes every row first. The
// read-only door that arrived for exactly this caller is used instead
// (`core/audit-db.ts` · `export function openProjectionReadOnlyChecked(root: string): DatabaseSync {` · ~537),
// and its own docblock names `/api/watch/spills` as one of the routes the
// plan would otherwise have let delete and rebuild a database from a GET.
//
// **So a stale projection is REPORTED, never repaired** (owner ruling C1).
// `syncProjection` would fix it and fixing it is a write, so the three
// outcomes the door distinguishes by CLASS are carried through to the wire by
// `readProjection` below: a healthy current projection answers; one that was
// never built is the `absent` empty state, disclosed and answered with NO
// data rather than with zeroes; one that is behind or diverged, and anything
// damaged, is a 503 naming what is wrong and the command that ends it.
//
// Staleness rule (spec §5): every projection read here reports what it found;
// a projection that cannot vouch for the log is a refusal, never a quiet
// partial. The live stream reads the JSONL itself (`AuditTail`) and is exempt
// from that rule only because it never claims completeness — it is "what has
// landed since you connected", with `resync` disclosing any discontinuity.

export const STREAM_POLL_MS = 1000;

/**
 * The most history one stream will replay on open.
 *
 * The screen asks for `BOUND_CAP_LIST` — twenty, the list bound every other
 * bounded surface in this app already uses — and this is the ceiling above it,
 * not the number anyone should send. It is where a replay stops being an
 * opening context and becomes a scan of the log down a socket that is then held
 * open indefinitely; `/api/ask/audit` is the surface for a query, and it takes
 * `limit` up to 2000 because it answers and closes.
 */
const MAX_STREAM_BACKLOG = 500;

/**
 * Pure: `buckets` intervals of `bucketMs` ending at `now`, oldest first, each
 * carrying a total and a per-kind breakdown — the pulse's column height and
 * the shape of what is in it.
 *
 * Every kind in `AUDIT_KINDS` is present on every bucket, at zero. A key left
 * out where nothing happened would leave a reader unable to tell "no records
 * of that kind" from "this build does not know that kind" — design decision
 * 3's absence-is-not-zero rule, read in the other direction. There are SIX
 * (`core/audit.ts` · `export const AUDIT_KINDS: AuditKind[] = [` · ~339), taken
 * from the one declaration rather than respelled here.
 *
 * **What colour any of this is drawn in is NOT decided here and must not be.**
 * The seven kinds do not map cleanly onto the approved visual direction's four
 * meaning-hues; that is an open owner decision, and each new kind widens it. This function ships the data,
 * the buckets and the counts, and names no colour.
 */
export function recordVolume(
  rows: { at: string; kind: string }[], bucketMs: number, buckets: number, now: number,
): { start: string; total: number; byKind: Record<AuditKind, number> }[] {
  const begin = now - bucketMs * buckets;
  const out = Array.from({ length: buckets }, (_, i) => ({
    start: new Date(begin + i * bucketMs).toISOString(),
    total: 0,
    byKind: Object.fromEntries(AUDIT_KINDS.map((k) => [k, 0])) as Record<AuditKind, number>,
  }));
  for (const row of rows) {
    const t = Date.parse(row.at);
    // The window is `[begin, now]` and CLOSED at the top, which is a
    // one-character difference with a record in it: the caller stamps `at` and
    // then asks `Date.now()`, and the two land in the same millisecond often
    // enough to matter. A half-open window would drop exactly the newest
    // record — the one the pulse exists to show — and drop it in silence.
    if (Number.isNaN(t) || t < begin || t > now) continue;
    // Clamped, because the closing instant divides into index `buckets`.
    const bucket = out[Math.min(Math.floor((t - begin) / bucketMs), buckets - 1)]!;
    // A kind this build does not know still COUNTS toward the column height
    // and is simply absent from the breakdown: the pulse stays honest about
    // how much happened, and says nothing it cannot account for.
    bucket.total++;
    if (row.kind in bucket.byKind) bucket.byKind[row.kind as AuditKind]++;
  }
  return out;
}

function intParam(url: URL, name: string, min: number, max: number, fallback: number): number | null {
  const raw = url.searchParams.get(name);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/**
 * How the audit projection stood when this answer was read.
 *
 * `'fresh'` is the only state that produces data. `'absent'` is not one of
 * `ProjectionState`'s three: it means no projection file exists at all, which
 * is an empty state rather than a fault (`ProjectionAbsentError` carries its
 * own class so a reader tells it from damage without matching a message). The
 * stale states never reach a 200 — see `readProjection`.
 */
export type WatchProjectionState = 'fresh' | 'absent';

type ProjectionHandle = ReturnType<typeof openProjectionReadOnlyChecked>;

export type ProjectionRead<T> =
  | { ok: true; state: 'fresh'; value: T }
  | { ok: true; state: 'absent'; value: null }
  | { ok: false; refusal: JsonResult };

/** The command that ends every state below — named in the message, never performed here. */
const BUILD_IT = 'Run `mycontext audit` to build it; a read surface may not, because building it is a write.';

function refuseProjection(err: unknown): JsonResult {
  const detail = err instanceof Error ? err.message : String(err);
  if (err instanceof ProjectionStaleError) {
    return {
      status: 503,
      body: {
        error: `the audit projection is ${err.state} relative to its log, and this endpoint may `
          + `not catch it up: syncing is a write, and answering from it anyway would present a `
          + `partial history as a complete one. ${BUILD_IT} (${detail})`,
        projectionState: err.state,
      },
    };
  }
  return {
    status: 503,
    body: {
      error: `the audit projection could not be read: ${detail}. It is derived from the JSONL `
        + `log and holds nothing the log does not, so deleting it loses nothing. ${BUILD_IT}`,
      projectionState: null,
    },
  };
}

/**
 * One door onto the projection for every JSON endpoint that reads it, opened
 * READ-ONLY, checked, and closed — including when the read throws.
 *
 * The handle never outlives this call, which is what keeps the stream route's
 * "nothing holds a database handle open across a held-open response" true by
 * construction: the stream does not come through here at all.
 *
 * **Exported for `ask-model.ts`, which reads the same projection from
 * `/api/ask/audit` and `/api/ask/summary`.** The three outcomes are a POLICY —
 * fresh answers, absent is an empty state, everything else refuses — and a
 * second spelling of a policy is how two endpoints come to disagree about what
 * a missing database means. There is one spelling, and this is it.
 */
export function readProjection<T>(root: string, read: (db: ProjectionHandle) => T): ProjectionRead<T> {
  let db: ProjectionHandle;
  try {
    db = openProjectionReadOnlyChecked(root);
  } catch (err) {
    // The never-built empty state, and ONLY it. Everything else — behind,
    // diverged, truncated, corrupt, a shape this build does not read — is a
    // refusal, because reporting damage as "nothing here yet" is the same
    // silent drop as reporting a fresh workspace as damage.
    if (err instanceof ProjectionAbsentError) return { ok: true, state: 'absent', value: null };
    return { ok: false, refusal: refuseProjection(err) };
  }
  try {
    return { ok: true, state: 'fresh', value: read(db) };
  } catch (err) {
    return { ok: false, refusal: refuseProjection(err) };
  } finally {
    db.close();
  }
}

/**
 * The most columns this endpoint will draw. The mockup's pulse asks for 120;
 * the cap is where a request stops being a pulse and starts being a scan, and
 * it is what bounds the projection read below.
 */
const MAX_VOLUME_COLUMNS = 1440;

export function apiWatchVolume(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['minutes', 'bucket']) ?? repeatedParams(url);
  if (bad !== null) return badRequest(bad);
  const minutes = intParam(url, 'minutes', 1, 1440, 20);
  if (minutes === null) return badRequest('minutes must be an integer between 1 and 1440');
  const bucketSeconds = intParam(url, 'bucket', 1, 3600, 10);
  if (bucketSeconds === null) {
    return badRequest('bucket must be a whole number of seconds between 1 and 3600');
  }
  const seconds = minutes * 60;
  if (seconds % bucketSeconds !== 0) {
    return badRequest(
      `minutes=${minutes} does not divide into whole ${bucketSeconds}-second buckets. This ` +
      'endpoint refuses rather than rounding: a window quietly shortened to fit its buckets ' +
      'reports a span it did not measure.',
    );
  }
  const columns = seconds / bucketSeconds;
  if (columns > MAX_VOLUME_COLUMNS) {
    return badRequest(
      `minutes=${minutes} at bucket=${bucketSeconds}s is ${columns} columns; this endpoint draws ` +
      `at most ${MAX_VOLUME_COLUMNS}. It refuses rather than truncating, because a series silently ` +
      'shortened is a series that lies about its window.',
    );
  }
  const root = ws.projectRoot;
  if (root === null) return { status: 500, body: { error: 'no project workspace' } };

  const now = Date.now();
  const since = new Date(now - seconds * 1000).toISOString();
  // `since` becomes `at >= ?` — the predicate `idx_audit_at` exists to serve,
  // and the only thing bounding this read, which is why the column cap above
  // is a refusal rather than a slice. `at` and `kind` are two generated
  // columns of the SAME row, so nothing is joined here; `audit_item`, the
  // table that would need a join, answers a per-item question and not this one.
  const read = readProjection(root, (db) => queryProjection(db, { since }));
  if (!read.ok) return read.refusal;
  return {
    status: 200,
    body: {
      minutes,
      bucketSeconds,
      // An absent projection answers with NO columns, not with a row of
      // zeroes: 120 zero columns is a chart asserting that nothing happened,
      // over a log this endpoint has not read. The owner's zero-data view
      // renders the state named beside it — never an empty chart.
      buckets: read.value === null ? [] : recordVolume(read.value, bucketSeconds * 1000, columns, now),
      projectionState: read.state,
    },
  };
}


export interface WatchContextBody {
  session: string;
  /** `null` is the NO-SAMPLE state: no bridge installed, or this session was never sampled. */
  sample: {
    receivedAt: string; model: string | null; version: string | null; context: ContextSample;
  } | null;
  /** `null` whenever the projection could not answer — with `mycontextError` saying which state. */
  mycontext: { tokens: number; injections: number; unrecorded: number } | null;
  mycontextError: string | null;
  /**
   * **What became of this session's handover ask, and the threshold it was
   * asked against** (`plan:walk seq:118`, `seq:117`).
   *
   * SERVED, never re-derived. `core/handover-ask.ts` computes the verdict by
   * comparing the latch's `askedAt` with the handover file's mtime, and its own
   * header calls that comparison the whole feature: *the flag is not a claim,
   * it is a comparison*. A browser cannot make it — it can stat nothing — and a
   * second implementation of one question is how two spellings of a fact come
   * apart. So this endpoint carries the answer and the strip renders it.
   *
   * All five verdicts travel, including the two the reader most needs told
   * apart: `ignored` (asked, and the file was not written — the silence this
   * feature exists to end) and `off` (no `handover` key at all, so nothing was
   * ever promised). Collapsing `off` into `not-asked` would make the strip say
   * "the threshold has not been crossed" about a feature that has no threshold.
   *
   * `thresholdPercent` is `null` EXACTLY when the feature is off, and is
   * otherwise `handoverThresholdPercent(handover)` — the one place
   * `core/config.ts` applies its 98 default. The strip derives its occupancy
   * bands from this number; it may not carry a constant of its own, and with
   * the feature off there is no ask to name a band against.
   */
  handover: {
    verdict: HandoverAskVerdict;
    /** The handover path AS CONFIGURED, repo-relative, or `null` when the feature is off. */
    path: string | null;
    /** When the ask went out, ISO-8601, or `null` when none has. */
    askedAt: string | null;
    /** When the handover was last written, ISO-8601, or `null` when that is not known. */
    writtenAt: string | null;
    /** The threshold the ask fires at, or `null` when the feature is off. */
    thresholdPercent: number | null;
  };
  /**
   * **The account's own two rate-limit windows** (owner ruling 2026-08-31).
   *
   * The same stored payload the context figure comes from already carries
   * `rate_limits`, so this costs no new source, no new call and no new file
   * read: `readTee` opened the file one line above and `classifyRateLimits`
   * reads a second key out of the same object.
   *
   * Both windows are independently nullable and so is each `resetsAt`, and
   * every one of those nulls means NOT REPORTED rather than zero — see
   * `classifyRateLimits` for the three levels at which the payload can decline
   * to say. The client draws nothing for a null; a placeholder percentage would
   * be a claim about an account that nobody made.
   */
  rateLimits: RateLimits;
  /**
   * ── THE SEVEN FIELDS THAT MADE THIS STRIP A SUPERSET OF THE TERMINAL LINE
   * (2026-09-01). Every one of them was already drawn by `mycontext statusline`
   * and by no web surface at all, and they diverged for the reason this
   * project has now measured EIGHT times: two things that must agree, with
   * nothing holding them together. `test/ui/strip-parity.test.ts` holds them
   * together now, in the direction that matters — the terminal's field set
   * must be a SUBSET of the strip's, and web-only fields are legitimate.
   *
   * **NO NEW SOURCE AND ONE NEW READ.** `modes`, `sessionName`, `costUsd` and
   * `warmPercent` come off the payload `readTee` already opened, through the
   * same `payloadExtras` the terminal parses it with. `lastAudit` rides the
   * projection this handler already opens for the myctx share, on its own
   * `readProjection` so that a share that refuses cannot take the clock down
   * with it. `focus` is the one new read: a few hundred bytes of JSON, and
   * ENOENT — no focus — is the common case.
   */
  /** The non-default modes as one phrase, or `null` when the session has none. */
  modes: string | null;
  /** `session_name`, and only when it differs from the project name. */
  sessionName: string | null;
  /** `cost.total_cost_usd`. */
  costUsd: number | null;
  /**
   * `cost.total_duration_ms` — how long this session has been running.
   *
   * Served since 2026-09-01 so the strip can draw the `ELAPSED` field the
   * terminal already draws. It was the ONE field the terminal had and the
   * strip lacked, which `test/ui/strip-parity.test.ts` and
   * `e2e/strip.spec.ts` were both failing on: the ruling is that the strip is
   * a superset, so the fix is to serve it here rather than to stop drawing it
   * there.
   */
  elapsedMs: number | null;
  /** The share of this turn's input the cache served — DERIVED, never sent. */
  warmPercent: number | null;
  /**
   * What mycontext has in focus, already rendered to a phrase, or `null` for
   * no focus. `null` is a MEASURED absence here, not an unread one: the file
   * is read on every call and `readFocus` never throws.
   */
  focus: string | null;
  /** When the audit log last moved, in its three distinguished states. */
  lastAudit: LastAuditRead;
  /**
   * ── WHERE THE SESSION IS, AND WHICH CORPUS THAT GOT IT (2026-09-02).
   *
   * Three more fields the terminal bar draws and this strip did not, added the
   * day the owner asked for them on BOTH surfaces. `terminal ⊆ web` is the
   * standing ruling, so they are served here rather than drawn only there.
   *
   * **NO NEW READ FOR THE FIRST TWO.** `cwd` and `projectDir` come off the
   * payload `readTee` already opened, through the same `payloadExtras` the
   * terminal parses it with — one reader for an external schema.
   *
   * **AND ONE UPWARD WALK FOR THE THIRD**, which is `resolveCorpus`: a handful
   * of `existsSync` calls up the tree, no directory read and no parse in the
   * ordinary case. Its `nesting` block — the enclosing root and both item
   * counts — is populated ONLY when the walk stopped at a nested corpus, which
   * is the alarm; the two recursive `items/` counts are paid there and nowhere
   * else.
   */
  /** `cwd` — where the session is NOW, absolute. The one that moves. */
  cwd: string | null;
  /** `workspace.project_dir` — where it was LAUNCHED. The anchor; it does not move. */
  projectDir: string | null;
  /**
   * **WHICH CORPUS `cwd` RESOLVES TO — and whether that is the alarm.**
   *
   * Resolved from the SESSION'S `cwd` and not from `ws.projectRoot`, and the
   * difference is the whole field. This server resolved its own corpus from
   * wherever `mycontext ui` was run; the session's HOOKS resolve theirs by
   * walking up from wherever they are run. When those disagree, the bar is
   * reading one corpus while the session writes to another — which is the
   * failure the owner reported twice on 2026-09-02 and which nothing anywhere
   * named.
   *
   * `nesting` is `null` in the ordinary case and carries BOTH item counts in
   * the alarm one, because the outage this comes from was somebody reading
   * "44 items" as a sparse project rather than as A DIFFERENT CORPUS.
   * `core/corpus-identity.ts` makes that argument at length and is the one
   * resolver both surfaces call.
   *
   * `null` when the payload carried no `cwd` to walk up from — an unread
   * state, which the client names and never draws as "no corpus".
   */
  corpusRoot: {
    root: string | null;
    nesting: { enclosing: string; items: number; enclosingItems: number } | null;
  } | null;
}

/**
 * The §4b join: Claude Code's own context figure beside what this corpus
 * recorded injecting into the same session, keyed on `session_id`.
 *
 * **This endpoint owns never inventing a number.** Both halves are nullable
 * and each null carries its own reason: the client owns the wording, and a
 * missing measurement is a state rather than a zero. It answers 200 even when
 * both halves are absent, because "no bridge and no projection" is a thing to
 * render, not a fault to refuse.
 */
export function apiWatchContext(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['session']) ?? repeatedParams(url);
  if (bad !== null) return badRequest(bad);
  const session = url.searchParams.get('session');
  if (session === null || session === '') return badRequest('session is required');
  const root = ws.projectRoot;
  if (root === null) return { status: 500, body: { error: 'no project workspace' } }; // startUiServer refuses this earlier

  const tee = readTee(root, session);
  const sample = tee === null ? null : {
    receivedAt: tee.receivedAt,
    model: modelName(tee.payload),
    version: versionOf(tee.payload),
    context: classifyContext(tee.payload),
  };

  // **The same two bounds the terminal applies, out of the same module.**
  // The strip's own sentence is `'{tokens} of it from project knowledge'` —
  // "OF IT", of the context window whose fullness is drawn beside it — so an
  // unbounded lifetime sum makes that sentence false, and it was false by
  // 2.5x on this repository's own corpus. `contextEpochStart` bounds it to
  // what survived the last compaction and `shareOf` drops the
  // `subagent-start` records, which carry this session's id but were
  // delivered into other models' windows. Neither rule is spelled here:
  // `core/context-share.ts` owns both, and `mycontext statusline` runs the
  // same two, so the terminal and the browser cannot disagree about one
  // number again.
  const read = readProjection(root, (db) => {
    const epoch = contextEpochStart(db, session);
    return shareOf(queryProjection(db, {
      sessionId: session, kind: 'injection', ...(epoch === null ? {} : { since: epoch }),
    }));
  });
  let mycontext: { tokens: number; injections: number; unrecorded: number } | null = null;
  let mycontextError: string | null = null;
  if (!read.ok) {
    mycontextError = (read.refusal.body as { error: string }).error;
  } else if (read.value === null) {
    mycontextError = `no audit projection has been built for this corpus, so what mycontext put `
      + `in this session is unknown rather than zero. ${BUILD_IT}`;
  } else {
    mycontext = read.value;
  }
  // **The third half.** `checkHandoverAsk` never throws, for any filesystem
  // outcome — its own docstring is emphatic about that — so it needs no `try`
  // here and cannot cost this endpoint the two answers above. `ws.config
  // .handover` is `HandoverConfig | null`, and `null` is the feature-off case
  // the check itself reports as `off`.
  const handoverConfig = ws.config.handover;
  const ask = checkHandoverAsk(root, handoverConfig, session);
  const handover = {
    verdict: ask.verdict,
    path: ask.path,
    askedAt: ask.askedAt,
    writtenAt: ask.writtenAt,
    // The default is applied HERE and only here, by the function `config.ts`
    // names as its single site. `null` when the feature is off, because a
    // threshold for an ask that will never fire is a number with no meaning,
    // and the strip must not colour against one.
    thresholdPercent: handoverConfig === null ? null : handoverThresholdPercent(handoverConfig),
  };
  // Read off the payload `readTee` already opened, beside the context window
  // and never in place of it. `tee === null` is the no-sample state and answers
  // two absent windows, which is what "nobody told us" looks like here.
  const rateLimits = tee === null
    ? { fiveHour: null, sevenDay: null }
    : classifyRateLimits(tee.payload);
  // ── AND THE REST OF WHAT THE TERMINAL BAR READS OFF THE SAME BYTES. One
  // call to the one parser: a second reader for the browser would be a second
  // spelling of an EXTERNAL schema, which is this project's most-repeated
  // defect in the one place where the thing being agreed with is not ours.
  const extras = payloadExtras(tee === null ? null : tee.payload);
  const flags = modeFlags(extras.modes);
  // The project NAME, which is what `buildLines` compares a session name
  // against: `projectRoot` is the `.my_context` directory, so the name is its
  // parent's — the repository. One suppression rule, in `distinctSessionName`,
  // called by both bars.
  const project = path.basename(path.dirname(root));
  // **Its own `readProjection`, not the share's.** The share can refuse — a
  // projection behind its log is a refusal — and the audit clock is exactly
  // the field a reader wants when something else has just failed. A health
  // signal that goes dark whenever its neighbour does is not a health signal.
  //
  // Wrapped in an object so the two nulls stay apart: `value === null` is a
  // projection that was never built (`readProjection`'s own absent state) and
  // `value.row === null` is a projection that holds no rows. The first is "I
  // could not tell" and the second is a measurement, and this endpoint may not
  // collapse them any more than the terminal may.
  const clock = readProjection(root, (db) => ({ row: newestAuditRow(db) }));
  const lastAudit: LastAuditRead = !clock.ok || clock.value === null
    ? { state: 'unreadable' }
    : clock.value.row === null
      ? { state: 'empty' }
      : { state: 'known', op: clock.value.row.op, at: clock.value.row.at };
  // Read from the file and NOT from the log — see the import. `isFocusActive`
  // is the same gate the terminal applies, and a focus that could not be READ
  // is answered as no focus here for the reason it is there: this bar has no
  // room to say which, and `focusErrorNote` already tells the story on the
  // surface that does.
  // ── AND WHICH CORPUS THE SESSION'S OWN DIRECTORY RESOLVES TO. One resolver,
  // `core/corpus-identity.ts`', shared with `mycontext statusline` and with the
  // MCP provenance footer: two resolvers that could disagree about which
  // corpus is in play would be a particularly bad version of the defect this
  // field exists to expose. `overridden` is not served — it is a fact about
  // how the MCP server was told to resolve, and this bar has no room for it.
  //
  // Never a throw. A tree this cannot walk is not a reason to refuse an
  // endpoint that four other fields ride on.
  let corpusRoot: WatchContextBody['corpusRoot'] = null;
  try {
    if (extras.cwd !== null) {
      const resolved = resolveCorpus(extras.cwd);
      corpusRoot = { root: resolved.root, nesting: resolved.nesting };
    }
  } catch {
    corpusRoot = null;
  }

  const focusState = readFocus(root);
  const focus = isFocusActive(focusState.focus) ? describeFocus(focusState.focus) : null;
  const body: WatchContextBody = {
    session, sample, mycontext, mycontextError, handover, rateLimits,
    modes: flags.length === 0 ? null : flags.join(' · '),
    sessionName: distinctSessionName(extras.sessionName, project),
    costUsd: extras.costUsd,
    elapsedMs: extras.elapsedMs,
    warmPercent: extras.warmPercent,
    focus,
    lastAudit,
    cwd: extras.cwd,
    projectDir: extras.projectDir,
    corpusRoot,
  };
  return { status: 200, body };
}

function modelName(payload: unknown): string | null {
  const m = (payload as { model?: { display_name?: unknown; id?: unknown } } | null)?.model;
  if (typeof m?.display_name === 'string') return m.display_name;
  if (typeof m?.id === 'string') return m.id;
  return null;
}

function versionOf(payload: unknown): string | null {
  const v = (payload as { version?: unknown } | null)?.version;
  return typeof v === 'string' ? v : null;
}

/** How many newest injection records the spill list is drawn from — disclosed in the response. */
const SPILL_RECORD_WINDOW = 1000;

export interface Spill {
  at: string;
  sessionId: string | null;
  hook: string | null;
  path: string | null;
  id: string;
  tier: string;
  reason: string;
  /**
   * The PARENT record's token estimate; `null` means "not recorded" (a record
   * predating the `tokens` field), and the client renders it as that state —
   * never as zero.
   */
  tokens: number | null;
}

function flattenSpills(records: AuditRecord[], item: string | null): Spill[] {
  const spills: Spill[] = [];
  for (const record of records) {
    for (const s of record.spilled ?? []) {
      // `itemId` matches a record in any of three roles, so a record filtered
      // by `item` can still carry OTHER items' spills. Narrow again here, or
      // "why didn't Claude see RULE-c" answers with RULE-d.
      if (item !== null && s.id !== item) continue;
      spills.push({
        at: record.at,
        sessionId: record.sessionId ?? null,
        hook: record.hook ?? null,
        path: record.path ?? null,
        id: s.id,
        tier: s.tier,
        reason: s.reason,
        tokens: typeof record.tokens === 'number' ? record.tokens : null,
      });
    }
  }
  return spills;
}

export function apiWatchSpills(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['item', 'limit']) ?? repeatedParams(url);
  if (bad !== null) return badRequest(bad);
  const limit = intParam(url, 'limit', 1, 500, 50);
  if (limit === null) return badRequest('limit must be an integer between 1 and 500');
  const item = url.searchParams.get('item');
  const root = ws.projectRoot;
  if (root === null) return { status: 500, body: { error: 'no project workspace' } };

  const read = readProjection(root, (db) => ({
    records: queryProjection(db, {
      kind: 'injection',
      ...(item === null ? {} : { itemId: item }),
      limit: SPILL_RECORD_WINDOW,
    }),
    topSpilled: topItems(db, 'spilled', 10),
  }));
  if (!read.ok) return read.refusal;

  const spills = read.value === null ? [] : flattenSpills(read.value.records, item);
  const topSpilled: SummaryRow[] = read.value === null ? [] : read.value.topSpilled;
  return {
    status: 200,
    body: {
      spills: spills.slice(-limit),
      topSpilled,
      recordWindow: SPILL_RECORD_WINDOW,
      projectionState: read.state,
    },
  };
}

// --- The per-item delivery sparkline (mockup `#panespark`, `pane.hist`) -----
//
// Twelve weekly buckets for ONE item, for the item detail pane. The mockup's
// own note under the chart is the specification: *"Twelve weekly buckets from
// the audit projection, hatched where the item was spilled that week and grey
// where nothing was delivered. It is the cheapest possible answer to 'is this
// thing still alive', and the one history that belongs on every item rather
// than on a screen of its own."*
//
// **Why this is a route and not a field on `/api/item/:id`.** Two reasons, and
// the second is the one that matters. `read-model.ts` cannot import this
// module — `watch-model.ts` imports `read-model.ts` for `badRequest`, so the
// dependency runs one way and adding the field would invert it. And a
// projection that REFUSES must not take the pane down with it: the `<dl>` is
// served by the corpus and is always answerable, so a reader whose projection
// is behind still gets type, status, tier, scope, governs and file, and is
// told about the chart alone. Folding it into one response would make the
// whole pane share the weakest store it touches.
//
// **Two series, never one.** `weeks` is deliveries per bucket; `spillw` is
// which buckets held a spill. The mockup's own comment says why they cannot be
// merged: *"a quiet week and a rejected week must never look alike"*. A week
// with no delivery is grey, a week the item was SPILLED is hatched, and an
// item can be spilled in a week it was also delivered in.
//
// **`absent` is not zero, and the caller must keep them apart.** A never-built
// projection answers `state: 'absent'` with a null series, and the pane says
// so rather than drawing twelve grey bars — which would assert twelve measured
// quiet weeks over a log nothing has read
// (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`). A behind
// or damaged projection is a refusal, exactly as it is on every other read
// here: reported, never repaired.

/** Twelve buckets, oldest first — the window `pane.hist` names. */
const SPARK_WEEKS = 12;

/**
 * Bucket index for a record's timestamp, oldest-first, or `null` if it falls
 * outside the window.
 *
 * The arithmetic is in JS rather than SQL on purpose: SQLite's `julianday`
 * would do it, but the boundary then depends on the server's clock formatting
 * rather than on one explicit `now`, and this function is the only place a
 * week boundary is decided. `at` is ISO-8601 written by the audit log.
 */
function weekBucket(at: string, nowMs: number): number | null {
  const t = Date.parse(at);
  if (Number.isNaN(t)) return null;
  const weeksAgo = Math.floor((nowMs - t) / (7 * 24 * 60 * 60 * 1000));
  if (weeksAgo < 0 || weeksAgo >= SPARK_WEEKS) return null;
  return SPARK_WEEKS - 1 - weeksAgo;
}

export function apiItemHistory(ws: Workspace, url: URL, params: { id: string }): JsonResult {
  const bad = unknownParams(url, []) ?? repeatedParams(url);
  if (bad !== null) return badRequest(bad);
  if (params.id === '') return { status: 404, body: { error: 'no item named' } };
  const root = ws.projectRoot;
  if (root === null) return { status: 500, body: { error: 'no project workspace' } };

  const nowMs = Date.now();
  const since = new Date(nowMs - SPARK_WEEKS * 7 * 24 * 60 * 60 * 1000).toISOString();

  const read = readProjection(root, (db) => db.prepare(
    `SELECT a.at AS at, ai.role AS role
       FROM audit_item ai JOIN audit a ON a.seq = ai.seq
      WHERE ai.item_id = ? AND ai.role IN ('injected', 'spilled') AND a.at >= ?`,
  ).all(params.id, since) as { at: string; role: string }[]);
  if (!read.ok) return read.refusal;

  // `null` value is the ABSENT projection — no series, and the pane says so.
  if (read.value === null) {
    return { status: 200, body: { weeks: null, spillw: null, projectionState: read.state } };
  }

  const weeks: number[] = Array.from({ length: SPARK_WEEKS }, () => 0);
  const spilled = new Set<number>();
  for (const row of read.value) {
    const bucket = weekBucket(row.at, nowMs);
    if (bucket === null) continue;
    if (row.role === 'spilled') spilled.add(bucket);
    else weeks[bucket] = (weeks[bucket] ?? 0) + 1;
  }
  return {
    status: 200,
    body: { weeks, spillw: [...spilled].sort((a, b) => a - b), projectionState: read.state },
  };
}

// --- The spill ratio (mockup `#ratio`, `sim.ratio` / `sim.ration`) -----------
//
// The diverging bar on the simulator screen: delivered growing one way from
// the centre, spilled the other, per item, so the long red half NAMES which
// budget is too small. The mockup is the specification and it names its own
// source in the note under the chart — "The two numbers come from
// `audit_item.role` through `topItems` — already exported, already indexed,
// called twice" (`docs/design/web-ui-mockup.html`, the `sim.ration` note under
// `<div class="plate" id="ratio">`). No route exposed it, so the screen could
// not be drawn; this is that route, and it reads exactly what the note says
// rather than inventing a second aggregate beside `topItems`
// (`core/audit-db.ts` · `export function topItems(db: DatabaseSync, role: string | null, limit: number): SummaryRow[] {` · ~779).
//
// **`delivered` is the prose word and `injected` is the column value.** The
// role literal written into `audit_item` is `injected`
// (`core/audit-db.ts` · `insertItem.run(seq, entry.id, 'injected', entry.tier);` · ~215);
// every word the mockup puts in front of a reader for the same thing is
// *delivered*. The field takes the design's word, the query takes the
// database's, and neither is respelled to match the other.

/**
 * How many DISTINCT items each half of the ratio is tallied over.
 *
 * `topItems` groups by item, so this bounds the number of ROWS the aggregate
 * returns rather than the number of audit records behind them, and the group
 * is served from the index that exists for it
 * (`core/audit-db.ts` · `CREATE INDEX IF NOT EXISTS idx_audit_item_id ON audit_item(item_id, role);` · ~93).
 * A corpus with more distinct items in one role than this is possible, and
 * `truncated` is what says so out loud — see `spillRatio`, where the window is
 * the whole difference between a measured zero and an unmeasured one.
 */
const RATIO_ROLE_WINDOW = 1000;

/** One bar: an item, what was delivered for it, and what spilled. */
export interface RatioRow {
  id: string;
  /** Records that DELIVERED this item — `audit_item.role = 'injected'`. */
  delivered: number | null;
  /** Records that selected it and could not fit it — `audit_item.role = 'spilled'`. */
  spilled: number | null;
}

/**
 * Pure: the two role tallies merged into one row per item, ordered so the
 * longest red half is at the top, and cut to `limit`.
 *
 * **The row set is the UNION of the two tallies, not either one of them.** The
 * mockup's own chart draws an item with twelve deliveries and NO spills beside
 * one with three deliveries and forty-one spills; ranking by spills alone
 * would drop the first, and ranking by deliveries alone would drop the second.
 * Both belong to the question the chart asks.
 *
 * **A count missing from one tally is a zero only when that tally is
 * COMPLETE.** A tally that came back short of the window listed every item
 * holding that role, so an item absent from it truly holds the role zero
 * times. A tally that FILLED the window did not, and an item missing from it
 * has a count somewhere below the window's cutoff — which is unknown, not
 * zero. Drawing it as zero would put a full-length delivered bar's worth of
 * missing history on screen as an empty one, which is the same silent drop
 * `absent`-versus-zeroes refuses one level up. So it stays `null`, and
 * `truncated` says why.
 *
 * A `null` sorts BELOW a measured zero, deliberately: a magnitude nobody
 * measured cannot claim a rank in a chart ordered by magnitude.
 */
export function spillRatio(
  delivered: SummaryRow[], spilled: SummaryRow[], window: number, limit: number,
): { rows: RatioRow[]; truncated: boolean } {
  // `length === window` is read as "possibly more", not as "exactly this
  // many". The two are indistinguishable from here, and only one of them is
  // safe to assume.
  const deliveredComplete = delivered.length < window;
  const spilledComplete = spilled.length < window;

  const byId = new Map<string, RatioRow>();
  const tally = (rows: SummaryRow[], side: 'delivered' | 'spilled'): void => {
    for (const row of rows) {
      const existing = byId.get(row.label) ?? { id: row.label, delivered: null, spilled: null };
      existing[side] = row.count;
      byId.set(row.label, existing);
    }
  };
  tally(delivered, 'delivered');
  tally(spilled, 'spilled');

  for (const row of byId.values()) {
    if (row.delivered === null && deliveredComplete) row.delivered = 0;
    if (row.spilled === null && spilledComplete) row.spilled = 0;
  }

  const rank = (n: number | null): number => (n === null ? -1 : n);
  const rows = [...byId.values()].sort((a, b) => (
    rank(b.spilled) - rank(a.spilled)
    || rank(b.delivered) - rank(a.delivered)
    || a.id.localeCompare(b.id)
  ));
  return { rows: rows.slice(0, limit), truncated: !deliveredComplete || !spilledComplete };
}

/**
 * `GET /api/watch/ratio` — the spill-ratio bar's server half.
 *
 * `topItems` twice, through the READ-ONLY door, exactly as every other
 * projection read on this surface: `openProjectionReadOnlyChecked` creates
 * nothing, so a GET here does not bring `.audit/audit.db` into existence, and
 * `readProjection` — the one spelling of the policy, imported by `ask-model.ts`
 * as well — carries the three outcomes to the wire unchanged. Fresh answers;
 * never built is 200 with NO rows (a chart of zeroes asserts that nothing
 * spilled, over a log this endpoint has not read); behind, diverged or damaged
 * is a 503 naming the state and naming `mycontext audit`, because syncing is a
 * write.
 *
 * The default draws ten bars. The mockup draws six, and `/api/watch/spills`
 * already reports its top spilled ten; ten leaves the chart room without the
 * request becoming a scan, and the cap says where that line is.
 */
export function apiWatchRatio(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['limit']) ?? repeatedParams(url);
  if (bad !== null) return badRequest(bad);
  const limit = intParam(url, 'limit', 1, 100, 10);
  if (limit === null) return badRequest('limit must be an integer between 1 and 100');
  const root = ws.projectRoot;
  if (root === null) return { status: 500, body: { error: 'no project workspace' } };

  // Two reads, one handle, one open — the door is opened once and closed in
  // `readProjection`'s `finally`, including when either aggregate throws.
  const read = readProjection(root, (db) => ({
    delivered: topItems(db, 'injected', RATIO_ROLE_WINDOW),
    spilled: topItems(db, 'spilled', RATIO_ROLE_WINDOW),
  }));
  if (!read.ok) return read.refusal;

  const ratio: { rows: RatioRow[]; truncated: boolean } = read.value === null
    // An absent projection truncated nothing: there was nothing to truncate,
    // and `projectionState` is what says the difference.
    ? { rows: [], truncated: false }
    : spillRatio(read.value.delivered, read.value.spilled, RATIO_ROLE_WINDOW, limit);

  return {
    status: 200,
    body: {
      rows: ratio.rows,
      roleWindow: RATIO_ROLE_WINDOW,
      truncated: ratio.truncated,
      projectionState: read.state,
    },
  };
}

// --- The stream -------------------------------------------------------------

function sseSend(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * The live audit stream — **the route the idle rule was built for**. The
 * dispatch loop never `touch()`es a `kind: 'stream'` route, so a forgotten tab
 * holding this open still lets the idle exit fire (spec §2) — eight hours by
 * default today, and the number is `IDLE_MS` in `ui/idle.ts` rather than here.
 *
 * It reads the JSONL directly through `AuditTail` and opens no database at
 * all, which is what makes it safe to hold open: no write lock, no handle, and
 * nothing for a checkpoint to be waiting on.
 *
 * **`resync` is DISCLOSED, never swallowed.** `AuditTail.poll()` answers
 * `{ records: [], resync: true }` when the log diverged under it — a segment
 * that shrank or vanished, or a rotated segment it has never read, which is
 * the face a rotation actually shows (a rotation recreates `audit.jsonl` at
 * the same path, at a size that need not be smaller, so nothing shrinks). The
 * tail resets to the current EOFs rather than re-reading from zero, because
 * re-reading would show every record around the rotation twice in an audit
 * view. What was appended in the gap is therefore NOT on this stream, and that
 * is precisely why the event goes out: the screen refetches its backlog
 * through the query surface, which reads the projection and is immune to the
 * rename. A consumer that ignored the event would silently show a hole.
 *
 * **`backlog` is what the owner's "the audit stream is blank without records"
 * bought** (plan:walk seq:52). It is OPT-IN and defaults to `0`, so a caller
 * that asks for a tail still gets a tail — and gets the `hello` frame it always
 * got, because the `backlog` key appears ONLY when one was requested. Two
 * reasons, and the second outlives the first: a stream carrying no backlog
 * should say nothing about one, and `test/ui/server-e2e.test.ts` holds "not
 * what was already there" as a contract with a pinned read of this frame.
 *
 * **Why the backlog rides the `hello` frame rather than an event of its own.**
 * A `backlog` event would be a frame `lib/viewmodel.js`'s `describeStreamEvent`
 * cannot name, and by that module's own design an unnameable frame "must not
 * reach the feed as though it were audited history" — it would be dropped on
 * arrival. `hello` is already the stream's opening statement, already precedes
 * every `record` frame (which is exactly the ordering the screen's history/live
 * boundary depends on), and already carries the one other fact about how this
 * stream will behave. One frame, one boundary, no ordering left to get wrong.
 */
function streamHandler(ctx: ApiContext, res: ServerResponse): void {
  const bad = unknownParams(ctx.url, ['poll', 'backlog']) ?? repeatedParams(ctx.url);
  const poll = intParam(ctx.url, 'poll', 50, 10_000, STREAM_POLL_MS);
  const backlog = intParam(ctx.url, 'backlog', 0, MAX_STREAM_BACKLOG, 0);
  if (bad !== null || poll === null || backlog === null) {
    res.writeHead(400, { ...SECURITY_HEADERS, 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      error: bad
        ?? (poll === null
          ? 'poll must be an integer between 50 and 10000'
          : `backlog must be an integer between 0 and ${MAX_STREAM_BACKLOG}. It refuses rather `
            + 'than clamping, for the reason every other bound on this surface does: a replay '
            + 'quietly shortened to fit a ceiling is drawn under a sentence claiming the reader '
            + 'asked for that many.'),
    }));
    return;
  }
  const root = ctx.ws.projectRoot;
  if (root === null) {
    res.writeHead(500, { ...SECURITY_HEADERS, 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'no project workspace' }));
    return;
  }

  res.writeHead(200, {
    // The same four headers every other response carries (spec §2), from the
    // one object, so a new response path cannot quietly ship without them.
    ...SECURITY_HEADERS,
    'content-type': 'text/event-stream; charset=utf-8',
    // NO CORS headers, deliberately — their absence is the defence (spec §2).
  });
  // Constructed FIRST, because its captured EOFs are the boundary the backlog
  // is read backwards from and the live half is read forwards from. Nothing can
  // fall between the two, and nothing can appear in both.
  const tail = new AuditTail(root, { backlog });
  let opening: TailBacklog | null = null;
  if (backlog > 0) {
    try {
      opening = tail.backlog();
    } catch (err) {
      // A damaged audit line, found in the opening scan rather than in a poll.
      // Disclosed the same way and for the same reason: the log cannot be
      // trusted, the read contract refuses rather than skips, and the screen
      // renders the fault. Head is already written, so this cannot be a 503 —
      // which is why the tail defers this read out of its constructor.
      sseSend(res, 'fault', { error: err instanceof Error ? err.message : String(err) });
      res.end();
      return;
    }
  }
  sseSend(res, 'hello', opening === null ? { pollMs: poll } : { pollMs: poll, backlog: opening });

  // Unref'd: this timer must never be what keeps the process alive. The idle
  // monitor exits the server WITH this stream open (an open stream is not
  // activity — spec §2), and server.closeAllConnections() destroys the
  // socket, which fires 'close' below and clears the timer.
  const timer = setInterval(() => {
    let result;
    try {
      result = tail.poll();
    } catch (err) {
      // A damaged audit line: refuse loudly, on-stream, and end. The screen
      // renders the fault; it never reconnects on its own (spec §2).
      sseSend(res, 'fault', { error: err instanceof Error ? err.message : String(err) });
      res.end();
      return;
    }
    if (result.resync) sseSend(res, 'resync', {});
    for (const record of result.records) sseSend(res, 'record', record);
  }, poll);
  timer.unref();
  res.on('close', () => clearInterval(timer));
}

/**
 * Registered from inside `registerReadRoutes()`'s once-only guarded body, the
 * way `registerWorkRoutes()` is, and for the same two reasons: `startUiServer`
 * is called repeatedly in one process by `test/ui/server.test.ts`, so an
 * unguarded second registration would throw; and `server-e2e.test.ts`'s "every
 * registered read route is in the sweep" asks that function what the table
 * holds, so a route registered only on the server-start path would be
 * invisible to it.
 */
export function registerWatchRoutes(): void {
  const json = (fn: (ws: Workspace, url: URL) => JsonResult) =>
    ({ kind: 'json' as const, handle: (ctx: ApiContext) => fn(ctx.ws, ctx.url) });
  registerRoute('GET', '/api/watch/volume', json(apiWatchVolume));
  registerRoute('GET', '/api/watch/context', json(apiWatchContext));
  registerRoute('GET', '/api/watch/spills', json(apiWatchSpills));
  registerRoute('GET', '/api/watch/ratio', json(apiWatchRatio));
  registerRoute('GET', '/api/watch/stream', { kind: 'stream', handle: streamHandler });
  // Four segments against `/api/item/:id`'s three, so the two cannot collide —
  // the table matches on length first. It lives here rather than beside
  // `/api/item/:id` in `server.ts` because it reads the PROJECTION, and every
  // projection read in this product goes through this module's one door.
  registerRoute('GET', '/api/item/:id/history', {
    kind: 'json',
    handle: (ctx) => apiItemHistory(ctx.ws, ctx.url, { id: ctx.params['id'] ?? '' }),
  });
}
