import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { retryOnTransientFsError } from './rebuild.ts';
import {
  appendJsonlLine, readJsonlFileState, type JsonlFileState, type JsonlLogSpec,
} from './jsonl-log.ts';
import { sanitizeSessionId, type LedgerTier } from './ledger.ts';

// --- The per-session seen file ----------------------------------------------
//
// Session dedupe state, off the database: one `{id, tier, at}` line per
// delivery, appended by the hook that delivered and read back by the next
// hook in the same session. The append is the audit log's own machinery
// (appendJsonlLine / healTornTail — 0.55 ms p95 measured, flat in file size)
// and physically cannot take SQLite's write lock, which is the entire point:
// the 16,881 ms Store.open stall under a held write lock [P4] existed only
// because the hook had a reason to open writable, and this file removes the
// reason.
//
// Failure direction, decided here and relied on by every caller: an
// unreadable seen file means "inject WITHOUT dedupe and disclose" — a
// re-injection, never a miss. readSeen therefore NEVER throws; it returns
// `error` for the caller to disclose. appendSeen never throws either: a
// failed append costs one future re-injection, which is the accepted
// direction, and the audit log (written first) still holds the delivery.

export const SEEN_PROTOCOL = 'mycontext-seen/1';

/**
 * The tiers a seen line may carry: the three `core/ledger.ts` stores, plus
 * `continuity`.
 *
 * **A union of its own rather than a fourth member of `LedgerTier`.** The
 * SQLite ledger is a replayed projection with insert-or-ignore semantics
 * (`Ledger.record`) and a single refresh path hard-coded to `'restored'`; a
 * continuity line's `at` is an identity marker like a restored one's, so it
 * would need the refresh and not the ignore. This file is the authority for
 * continuity dedupe and the ledger is not asked, so the type says exactly that
 * rather than implying the ledger stores a tier it does not.
 */
export type SeenTier = LedgerTier | 'continuity';

export interface SeenLine {
  id: string;
  tier: SeenTier;
  at: string;
}

/**
 * Whether this session HAD a seen file, re-exported under its own name so a
 * caller reads one spelling of the fact from the module that produced it.
 * `jsonl-log.ts` holds the definition and the reasoning; the values are
 * `'read'` and `'absent'`.
 */
export type { JsonlFileState } from './jsonl-log.ts';

export interface SeenState {
  lines: SeenLine[];
  error: string | null;
  /**
   * `absent` when there was NO seen file, `read` when there was one.
   *
   * **The two states `lines: []` alone cannot separate, and they are different
   * events.** An empty-but-present file is a session that was measured and has
   * received nothing. An absent one is a session nothing measured: either it
   * was never injected into, or — the case that made this field necessary — a
   * `/clear` destroyed its window and `clearSeen` REMOVED the file while the
   * ledger and the audit log kept every delivery, deliberately, because the
   * injection did happen. `pruneSnapshots`' 30-day sweep produces the same
   * shape. Seven of nineteen sessions in the live corpus were in it when this
   * field was added, and the surface that drew them said "this session was read
   * and has received nothing yet" about a file nobody opened
   * (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`, clause 2,
   * whose scope reaches read models for exactly this reason).
   *
   * **`read` whenever `error !== null`, and that is not a claim that the read
   * succeeded.** `absent` is spent only on an observed ENOENT
   * (`readJsonlFileState`); every other failure got PAST the existence check —
   * a refused line was read whole, and an unreadable file was found and could
   * not be opened. Neither is "there was no file", so neither may be drawn as
   * one, and `error` is the field that says what went wrong. A caller drawing a
   * zero must consult `error` first: an unreadable seen file is not a zero of
   * any kind.
   */
  file: JsonlFileState;
}

const TIERS = new Set<string>(['pinned', 'jit', 'restored', 'continuity']);

/**
 * The one spelling of the seen file's suffix. `clearSeen` sweeps `state/` for
 * it by name, and `state/` also holds `*.restore.json` snapshots and
 * `*.tmp-*` leftovers a clear must not touch — so the suffix is a constant
 * rather than a literal repeated at the two ends of that agreement.
 */
export const SEEN_FILE_SUFFIX = '.seen.jsonl';

export function seenFilePath(root: string, key: string): string {
  return path.join(root, 'state', `${sanitizeSessionId(key)}${SEEN_FILE_SUFFIX}`);
}

/** The one spelling of "what went wrong", shared by every never-throws path here. */
function reason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function specFor(file: string): JsonlLogSpec {
  return {
    file,
    protocol: SEEN_PROTOCOL,
    validate: (row) => {
      if (typeof row.id !== 'string' || row.id === '') return 'has no usable "id"';
      if (typeof row.tier !== 'string' || !TIERS.has(row.tier)) return 'has no usable "tier"';
      if (typeof row.at !== 'string' || row.at === '') return 'has no usable "at"';
      return null;
    },
    refuse: (line, reason) => new Error(
      `my_context: seen file line ${line} ${reason}. Session dedupe cannot be trusted from ` +
      'this file; the session will inject without dedupe (disclosed) rather than guess.',
    ),
    unreadable: (err) => new Error(
      `my_context: seen file could not be read: ${
        err instanceof Error ? err.message : String(err)}`,
    ),
  };
}

/**
 * Retry attempts per appended line, passed to `retryOnTransientFsError`
 * (which sleeps 20·(attempt+1) ms between attempts): a worst case of
 * 10·5·4 = 200 ms of backoff PER LINE. Unlike `SNAPSHOT_RENAME_ATTEMPTS`
 * this guards a hot path where the worst case scales with the number of
 * items delivered — every line can exhaust its backoff and still succeed —
 * so it deliberately keeps the default hot-path impatience rather than the
 * snapshot's compaction-time patience. Two tests in `seen-file.test.ts`
 * pin two different things: a static band pins this constant's VALUE, and a
 * measured-backoff test (read-only file, transient EPERM/EACCES) pins that
 * appendSeen's EFFECTIVE retry behaviour matches it — so a drifted constant,
 * a drifted `retryOnTransientFsError` default, or a changed backoff formula
 * each redden the suite before the append can drift toward the 10 s hook
 * kill (`hooks.json`).
 */
export const SEEN_APPEND_ATTEMPTS = 5;

/** Never throws. A failed append is one future re-injection, disclosed by the audit trail. */
export function appendSeen(
  root: string, key: string, lines: SeenLine[],
): { written: boolean; error: string | null } {
  if (lines.length === 0) return { written: true, error: null };
  try {
    const file = seenFilePath(root, key);
    const dir = path.dirname(file);
    for (const line of lines) {
      // The same transient-EPERM guard the snapshot rename and writeItem use:
      // a scanner holding the file open for a moment must cost a retry, not
      // a lost dedupe record (design §6 risk 4).
      retryOnTransientFsError(() => appendJsonlLine(dir, file, {
        protocol: SEEN_PROTOCOL, id: line.id, tier: line.tier, at: line.at,
      }), SEEN_APPEND_ATTEMPTS);
    }
    return { written: true, error: null };
  } catch (err) {
    return { written: false, error: reason(err) };
  }
}

/**
 * Never throws. `error !== null` means the file exists but cannot be trusted;
 * the caller injects without dedupe and DISCLOSES (the re-injection is the
 * accepted direction — a suppression built on a guessed-at seen set is not).
 * `lines` is empty whenever `error` is set: no partial answers.
 */
export function readSeen(root: string, key: string): SeenState {
  try {
    // `readJsonlFileState`, not `readJsonlFile`: the second drops the one fact
    // that separates "this session received nothing" from "this session has no
    // seen file", and there is no honest way to recover it afterwards — an
    // `existsSync` here would be a SECOND reading of the disk, taken a moment
    // later, free to disagree with the read it is describing. See `SeenState.file`.
    const read = readJsonlFileState(specFor(seenFilePath(root, key)));
    return {
      lines: read.rows.map((r) => ({
        id: r.id as string, tier: r.tier as SeenTier, at: r.at as string,
      })),
      error: null,
      file: read.state,
    };
  } catch (err) {
    // A throw got past the ENOENT branch, so a file was there — `SeenState.file`
    // says what `read` does and does not mean on this path.
    return { lines: [], error: reason(err), file: 'read' };
  }
}

/** Unique ids across all tiers, sorted — the `Ledger.seen` shape. */
export function seenIds(state: SeenState): string[] {
  return [...new Set(state.lines.map((l) => l.id))].sort();
}

/**
 * Ids whose LAST `restored` line carries `at === capturedAt`. Last-line-wins
 * per (id, tier) reproduces `Ledger.recordRestored`'s ON CONFLICT refresh:
 * the marker moves to whichever compaction most recently restored the item,
 * so it keeps matching a repeat firing of the SAME compaction and stops
 * matching an older generation (see the long comment on recordRestored).
 */
export function restoredFor(state: SeenState, capturedAt: string): Set<string> {
  return deliveredFor(state, 'restored', capturedAt);
}

/**
 * The identity-marker comparison itself, shared by `restoredFor` above and
 * `continuityFor` below rather than written out twice. Last-line-wins per
 * (id, tier), then equality on the marker: two spellings of one rule is how a
 * rule drifts, and this one decides whether an item is re-delivered.
 */
function deliveredFor(state: SeenState, tier: SeenTier, marker: string): Set<string> {
  const last = new Map<string, string>();
  for (const line of state.lines) {
    if (line.tier === tier) last.set(line.id, line.at);
  }
  const out = new Set<string>();
  for (const [id, at] of last) if (at === marker) out.add(id);
  return out;
}

/**
 * The marker a continuity line carries on every event that is NOT a
 * compaction — a constant, and a constant on purpose.
 *
 * A session start opens a context window and every later non-compact event in
 * that session is inside the same window, so the marker that identifies it must
 * be STABLE for the session's whole life. An instant would never match itself
 * again and the tier would re-deliver on every event; the session's own id is
 * already the seen FILE's name, so a constant inside that file says exactly as
 * much as repeating the id would.
 */
export const CONTINUITY_WINDOW_SESSION = 'session';

/**
 * Continuity ids already delivered INTO ONE CONTEXT WINDOW, keyed on that
 * window and never on id alone — the two cases that look identical and are not:
 *
 *  - **Within one window** — already delivered, so do not send it again. This
 *    is what the ledger answers directly, and it is the owner's own point.
 *  - **After a compaction** — the window was REBUILT, so whatever it "already
 *    holds" is gone. The marker for a compaction is that compaction's own
 *    snapshot `capturedAt`, which no earlier line can carry, so the item is
 *    re-delivered even though this file has seen it. Getting this backwards
 *    fails in the worse direction: a session that starts over with nothing,
 *    which is the exact failure the continuity tier exists to prevent.
 *
 * Callers pass `CONTINUITY_WINDOW_SESSION` for a session start or a manual
 * load, and `snapshot.capturedAt` for a compaction. A compaction with NO
 * snapshot has no window identity at all; its caller passes no marker and
 * re-delivers, which is the safe direction this whole module takes everywhere
 * (see the header: an unreadable seen file means inject WITHOUT dedupe).
 */
export function continuityFor(state: SeenState, window: string): Set<string> {
  return deliveredFor(state, 'continuity', window);
}

// --- Clearing a session's dedupe state --------------------------------------
//
// The removal primitive `state/` has never had. Everything else in this
// directory appends: `appendSeen` here, `writeSnapshot` in `ledger.ts`, and a
// 30-day mtime sweep behind a manual `mycontext rebuild` is the only path
// that has ever taken anything out. A window the user destroyed (`/clear`)
// leaves its dedupe state behind, so the next injection into the now-empty
// window suppresses everything the destroyed one had already been shown.
//
// WHAT IS RECORDED, AND WHERE — INV-nothing-is-dropped-silently.
// `clearSeen` writes NO audit record of its own, and that is a decision, not
// an omission. The event that triggers a clear already writes one record
// (`inject.ts` puts `source=clear` into its note), and a second row for one
// event is the second-spelling defect this project has paid for repeatedly.
// So the disclosure obligation travels with the return value instead, in a
// shape that makes silence hard rather than merely discouraged:
//
//   - `ClearSeenReport` is TOTAL. Nothing removed, siblings not swept,
//     `state/` not listable, and a file that would not go each have their own
//     field, so no outcome collapses into "it worked".
//   - `describeClearSeen` turns any report into one non-empty sentence, so a
//     caller cannot accidentally disclose NOTHING — it has to delete a call
//     rather than forget to invent a phrase.
//
// A caller that removes more than the seen files (the restore snapshot at
// `snapshotPath`, say) appends its own clause to that sentence; this module
// speaks only for what it removed.
//
// A FAILED DELETE OVER-INJECTS, WHICH IS THE SAFE DIRECTION — the same
// direction the whole module already takes (see the header: an unreadable
// seen file means "inject WITHOUT dedupe and disclose"). Leaving state that
// suppresses everything is the defect this exists to fix; costing a live
// subagent one re-injection is not.

/**
 * Retry attempts per removed file, passed to `retryOnTransientFsError` (which
 * sleeps 20·(attempt+1) ms between attempts, so k attempts back off for at
 * most 10·k·(k−1) ms per file). A scanner holding a handle open for a moment
 * must cost a retry, not a lost clear — the same Windows reason `appendSeen`
 * retries.
 *
 * It is deliberately IMPATIENT where `SEEN_APPEND_ATTEMPTS` is merely
 * hot-path patient, because the two worst cases scale with different things.
 * An append's scales with one delivery, ~10 lines. A clear's scales with the
 * SIZE OF `state/`: measured 2026-08-21, one session id owned 45 sibling
 * files in one workspace and 20 in another, and §0 of the hooks plan records
 * that a growth measurement taken once is a lower bound, not a rate. At the
 * append's 5 attempts (200 ms per stuck file) a 46-file clear that met a
 * sweeping indexer would back off for 9.2 s inside a `SessionStart` whose
 * `hooks.json` kill is 10 s — and a killed `SessionStart` injects nothing at
 * all, which is a latency failure `INV-hooks-fail-open` explicitly does not
 * cover. At 2 attempts the same clear costs 0.92 s, and 200 files — over 4×
 * the measured count — cost 4 s. Pinned by a band test in
 * `test/core/seen-clear.test.ts`.
 */
export const SEEN_CLEAR_ATTEMPTS = 2;

export interface ClearSeenReport {
  /**
   * File names removed, relative to `state/`. Empty means nothing was there:
   * a file that did not exist is NOT reported as removed, so "cleared
   * nothing" and "cleared" stay distinguishable at the caller.
   */
  removed: string[];
  /** One entry per file that existed and could not be removed. */
  failed: { file: string; reason: string }[];
  /**
   * false when the `session::agent` siblings could not be identified from the
   * parent id — see `siblingPrefix` — or when `state/` could not be listed.
   * The caller must disclose it.
   */
  sweptSiblings: boolean;
  /**
   * Non-null only for the second of those two causes: the sweep was possible
   * in principle and the directory listing itself failed. `sweepError !== null`
   * implies `sweptSiblings === false`, and the two causes need different
   * sentences — "these files cannot be identified from this id" is a fact
   * about the id, "state/ could not be listed" is a fact about the disk.
   */
  sweepError: string | null;
}

/**
 * The exact filename prefix every `${sessionId}::agent` sibling carries, or
 * `null` when this id's siblings cannot be identified from it at all.
 *
 * Derived by ASKING `sanitizeSessionId` rather than by restating its rules.
 * The rules are: a canonical id passes through byte-stable, anything else is
 * folded to `<base>-<12 hex>` with the base truncated at 96 characters, so
 * `sid::agent` becomes `sid__agent-<digest>` — but only while `sid` survives
 * the fold and `sid.length + 2` still fits inside the truncation. Restating
 * that as a literal `96` here would be a second spelling of one constant, and
 * the obvious restatement is wrong: the hooks plan's Task 6 prescribes
 * `sessionId.length <= 96`, and at 95 and 96 the composite truncates to
 * `sid_` and `sid` — no `__` at all — so a sweep that could find nothing
 * would have reported itself as done. Probing the sanitizer cannot drift
 * from it.
 *
 * The probe's answer holds for EVERY agent id, not only the probe's own: once
 * `${sid}__` survives the fold with the empty agent, a longer agent only adds
 * characters after it.
 *
 * WHAT THE PREFIX DOES AND DOES NOT EXCLUDE. `${sid}__` is anchored, so a
 * different session whose id merely BEGINS with this one is safe: clearing
 * `sess-1` cannot touch `sess-10`'s files, which is the whole reason the
 * match is not on the sanitized stem alone. It is not injective, though — a
 * session whose id is literally `sess-1__x` owns `sess-1__x.seen.jsonl`,
 * which this prefix matches. That collateral costs that session one
 * re-injection, which is this module's accepted direction; the opposite
 * anchor (recomputing each candidate's digest) would MISS real siblings
 * whenever an agent id contains a folded character, and a missed sibling
 * suppresses.
 */
function siblingPrefix(sessionId: string): string | null {
  if (sessionId === '') return null;
  const prefix = `${sessionId}__`;
  return sanitizeSessionId(`${sessionId}::`).startsWith(prefix) ? prefix : null;
}

/**
 * Removes a session's seen file and its `session::agent` siblings. Returns
 * what it did; **never throws for any filesystem outcome** — a file that
 * cannot be removed is one entry in `failed`, an unlistable `state/` is
 * `sweepError`, and a missing `state/` is an empty report.
 *
 * It removes seen files ONLY. The restore snapshot beside them
 * (`snapshotPath`) belongs to whoever decided the window is gone, because
 * that decision is about a context window, not about dedupe state.
 *
 * `root` is the `.my_context` directory.
 */
export function clearSeen(root: string, sessionId: string): ClearSeenReport {
  const dir = path.join(root, 'state');
  const parent = path.basename(seenFilePath(root, sessionId));
  const targets = [parent];

  const prefix = siblingPrefix(sessionId);
  let sweptSiblings = prefix !== null;
  let sweepError: string | null = null;
  if (prefix !== null) {
    try {
      const siblings = readdirSync(dir).filter(
        (name) => name !== parent && name.startsWith(prefix) && name.endsWith(SEEN_FILE_SUFFIX),
      );
      // Sorted so the report reads the same on every filesystem, and so a
      // caller quoting `removed` quotes a reproducible list. This line cannot
      // be killed by a test on NTFS, which returns `readdirSync` already
      // sorted whatever the creation order — the fixture in
      // `seen-clear.test.ts` creates the siblings in reverse order so it
      // bites on a filesystem that returns creation or hash order instead.
      targets.push(...siblings.sort());
    } catch (err) {
      // A missing `state/` is not a failed sweep — there are no siblings to
      // find and the sweep is vacuously complete. Anything else means we
      // could not look, which the caller has to say differently.
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        sweptSiblings = false;
        sweepError = reason(err);
      }
    }
  }

  const removed: string[] = [];
  const failed: { file: string; reason: string }[] = [];
  for (const name of targets) {
    try {
      // `rmSync` WITHOUT `force: true`, deliberately. `force` suppresses
      // exactly one thing — ENOENT — which is the one outcome this report
      // must keep separate from success: with it, clearing a session that
      // never wrote anything would report every target as removed and the
      // caller would disclose a clear that never happened. Nothing here
      // removes a directory tree, so `removeTree`'s options do not apply;
      // the transient-EPERM budget is `SEEN_CLEAR_ATTEMPTS`.
      retryOnTransientFsError(() => rmSync(path.join(dir, name)), SEEN_CLEAR_ATTEMPTS);
      removed.push(name);
    } catch (err) {
      // Nothing was there: not a removal, and not a failure either.
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') continue;
      failed.push({ file: name, reason: reason(err) });
    }
  }

  return { removed, failed, sweptSiblings, sweepError };
}

function sweepLeftReason(report: ClearSeenReport): string {
  return report.sweepError === null
    ? 'subagent dedupe files could not be identified from this session id and were left'
    : `state/ could not be listed (${report.sweepError}), so subagent dedupe files were left`;
}

/**
 * One sentence describing what a `clearSeen` call actually did, for the
 * record its caller is already writing. **Never empty**, including for the
 * report where nothing was removed — "the clear cleared nothing" is the
 * outcome most easily lost, and losing it is how a caller ends up claiming a
 * clear it never performed.
 *
 * Scope, not content: file COUNTS and the first failure's reason, never a
 * session id, a path or an item. A caller that also removed something else
 * appends its own clause.
 */
export function describeClearSeen(report: ClearSeenReport): string {
  const parts: string[] = [
    report.removed.length === 0
      ? 'cleared no seen file (none existed for this session id)'
      : `cleared ${report.removed.length} seen file(s)`,
  ];
  if (!report.sweptSiblings) parts.push(sweepLeftReason(report));
  if (report.failed.length > 0) {
    const more = report.failed.length > 1 ? ` +${report.failed.length - 1} more` : '';
    parts.push(
      `${report.failed.length} seen file(s) could not be removed ` +
      `(${report.failed[0].reason}${more}); items already delivered may be suppressed`,
    );
  }
  return parts.join('; ');
}
