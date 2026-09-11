/**
 * **The READ half of session-restore staging — everything that only looks at
 * `.staging/restore/*.json`, in a module that imports nothing which writes.**
 *
 * `plan:restore seq:2`, design of record
 * `docs/superpowers/specs/2026-09-07-session-summary-restore-design.md` §3, §5
 * and §6. `plan:restore seq:1` built the READER that turns a transcript into a
 * summary (`core/session-summary.ts`); this is the half that puts one on disk
 * and lets the next injection find it.
 *
 * ── WHY THE READ HALF IS ITS OWN FILE ──────────────────────────────────────
 *
 * `src/lesson/staging.ts` is the pattern, and the item names it: *"the
 * `.staging/*.json` protocol already stages a decision a human has not taken
 * yet, with a reader that deliberately imports nothing which writes."* The
 * split is worth more here than it is there. The sequence this implements is
 *
 *     PROPOSE - BUILD - REVIEW - APPROVE - STAGE - CLEAR - DELIVER
 *
 * and step 6, CLEAR, is the owner's act and nobody else's. A module that can
 * only read cannot approve anything by accident, in a hook, or under a flag
 * somebody adds later without reading this comment — which is the argument
 * `core/retire.ts` makes for itself, in the same words and for the same
 * reason.
 *
 * `test/core/restore-stage.test.ts` walks this file's runtime import graph and
 * fails if a writer, or any project module at all, becomes reachable. The
 * boundary is enforced rather than asserted.
 *
 * ── WHY `.staging/restore/` AND NOT `.staging/` ────────────────────────────
 *
 * The DIRECTORY is shared with lesson staging; the FILES are one level down,
 * for a measured reason. `lesson/staging.ts`'s `readStagingDir` sweeps
 * `.staging/*.json` and reports every file whose `protocol` is not the lesson
 * one as SKIPPED, with a reason, on the Status screen and in `mycontext
 * status`. A restore record dropped straight into `.staging/` would therefore
 * be reported to the owner as a junk file the lesson sweep could not read — an
 * alarm about a file that is exactly where it belongs. That sweep's
 * `readdirSync` filters on `.json`, so a SUBDIRECTORY is invisible to it, and
 * the two protocols share the staging directory without either one having to
 * learn about the other. `test/core/restore-stage.test.ts` asserts that sweep
 * stays silent about a staged restore, so this stays true rather than being
 * remembered.
 *
 * ── VERIFICATION IS A RE-READ, NOT A RETURNED `true` ───────────────────────
 *
 * The item's one non-negotiable ordering: *"Step 5 must complete and be
 * verifiable on disk BEFORE the owner is told it is safe to clear — 'the clear
 * happens without the stage' is the one failure mode that loses the thing this
 * exists to save."* So `verifyStagedRestore` below takes the two artefacts the
 * caller BELIEVES it staged and compares them, byte for byte, against what
 * comes back off the disk. A caller that trusted its own successful write
 * would be asserting that a write returned, which is a different claim from
 * the one the owner is about to act on.
 *
 * There is deliberately no digest here and no `node:crypto`: an exact string
 * comparison is strictly stronger than a hash and keeps this file's import
 * list at two read-only modules, which is the property the test enforces.
 *
 * ── WHAT IS NOT HERE, AND WILL NOT BE ──────────────────────────────────────
 *
 * There is no `inject`, no `apply` and no `deliver` in this file or in
 * `core/restore-stage.ts`. A staged payload reaches a window only because
 * `core/inject.ts` reaches IN for it at the next injection; nothing in either
 * restore module can reach the injection. The dependency runs one way, and the
 * test asserts the direction rather than describing it.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import type { SummaryCoverage } from './session-summary.ts';

export const RESTORE_STAGING_PROTOCOL = 'my_context/session-restore@1';

/**
 * Where a staged restore is in the seven-step sequence.
 *
 *  - `proposed` — steps 1-3. An agent may build one and it costs nothing: it
 *    governs nothing, is delivered nowhere, and waits for a person.
 *  - `approved` — step 4, taken by the owner and by nobody else
 *    (`approveStagedRestore` refuses every other actor). ONLY this state is
 *    eligible for delivery.
 *  - `delivered` — step 7 has happened. One-shot, exactly as `mycontext carry`
 *    is one-shot: the mark is spent by the injection that read it.
 */
export type RestoreStagingState = 'proposed' | 'approved' | 'delivered';

/** What the build actually covered, carried beside the artefacts it produced. */
export interface StagedRestoreSource {
  /** The transcript this was built from. */
  file: string;
  /** The byte offset the run was pinned to — `seq:1`'s repeatability handle. */
  upToBytes: number;
  /** Records read within those bytes. */
  records: number;
  /** Points kept. */
  points: number;
}

/**
 * One staged restore: the two artefacts §5 requires, and the state above.
 *
 * **Two artefacts, not one** — design §5, and the item restates it: *"THE
 * REVIEW FORM IS NOT THE PAYLOAD. Two artefacts: the PAYLOAD, as long as it
 * needs to be, and the REVIEW FORM — numbered main subjects, one line each —
 * which is what he reads and approves."* Both are stored, because the owner
 * approves against the form and the window receives the payload; a record
 * holding only one of them would make one of those two acts guess.
 */
export interface StagedRestore {
  protocol: string;
  /** The filename stem. Stable handle for `mycontext restore --approve <key>`. */
  key: string;
  state: RestoreStagingState;
  builtAt: string;
  /** Set by the owner's approval, and by nothing else. */
  approvedAt: string | null;
  /** `'human'` or null. There is no other legal value; see `approveStagedRestore`. */
  approvedBy: 'human' | null;
  deliveredAt: string | null;
  /** The session the payload was delivered into, when the injection knew one. */
  deliveredTo: string | null;
  source: StagedRestoreSource;
  /** The loop guard's marker, carried so a reader can check it without rebuilding. */
  marker: string;
  /** What would be injected. As long as it needs to be — there is no cap. */
  payload: string;
  /** The numbered short form the owner reads and approves. */
  reviewForm: string;
  /**
   * Every way this build is PARTIAL, in words, itemised. Empty means complete.
   *
   * Design §5: *"A review form that reads as complete when it is partial is
   * worse than no review form."* This is that list, stored beside the form it
   * was rendered into, so a later reader of the record — the Status screen, an
   * audit — can answer "was this complete" without re-deriving it from the
   * coverage numbers and possibly disagreeing with the form the owner read.
   */
  shortfalls: string[];
  /** `seq:1`'s coverage block, stored whole. Nothing here is rounded. */
  coverage: SummaryCoverage;
}

export function restoreStagingDir(root: string): string {
  return path.join(root, '.staging', 'restore');
}

/**
 * A key becomes a filename, so it is checked at the one place this module
 * turns one into a path — `lesson/staging.ts`'s `stagingFile` draws the same
 * line for the same reason. No path separator can pass, so no key can read or
 * write outside `.staging/restore/`.
 */
const RESTORE_KEY_RE = /^[A-Za-z0-9._-]+$/;

/**
 * Exported because the WRITE half resolves the SAME path this resolves, and
 * the key check is the guard on the write as much as on the read. Two
 * spellings of "which file is this restore's" is how a write lands somewhere a
 * read never looks.
 */
export function restoreStagingFile(root: string, key: string): string {
  if (!RESTORE_KEY_RE.test(key)) {
    throw new Error(
      `my_context: "${key}" is not a valid staged-restore key — only letters, digits, ".", "_" ` +
      'and "-" are allowed, so it cannot safely be used as a staging file name.',
    );
  }
  return path.join(restoreStagingDir(root), `${key}.json`);
}

/** The shape guard both halves share, rather than two that can come to disagree. */
export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const STATES: RestoreStagingState[] = ['proposed', 'approved', 'delivered'];

/**
 * Reads `.staging/restore/<key>.json`.
 *
 * Returns `null` for exactly ONE case — the file does not exist — and THROWS
 * for a file that exists but cannot be trusted. That division is
 * `lesson/staging.ts`'s `loadStaging`, and it is here for the defect that
 * module records: collapsing the two into one `null` let a caller read a
 * corrupt file as "nothing here yet" and overwrite a decision a human had
 * already taken. The decision at stake here is the owner's approval, so the
 * cost of that mistake is higher, not lower.
 *
 * What this does NOT check is provenance. A hand-written record with the right
 * protocol and a matching key is indistinguishable from a real one and is
 * accepted. `.staging/` is unauthenticated working state; this checks the
 * SHAPE the rest of this module depends on and nothing about where the bytes
 * came from.
 */
export function loadStagedRestore(root: string, key: string): StagedRestore | null {
  const file = restoreStagingFile(root, key);
  if (!existsSync(file)) return null;

  const corrupt = (reason: string): Error => new Error(
    `my_context: the staged restore "${key}" cannot be trusted — ${reason}. Refusing to read or ` +
    'overwrite it, because it may record an approval the owner already gave. Inspect ' +
    `${file} and delete it if it is genuinely junk, then build again.`,
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw corrupt(`it is not valid JSON (${err instanceof Error ? err.message : String(err)})`);
  }
  if (!isObject(parsed)) {
    throw corrupt(
      `its top level is ${parsed === null ? 'null' : Array.isArray(parsed) ? 'an array' : `a ${typeof parsed}`}, not an object`,
    );
  }
  const record = parsed as unknown as StagedRestore;
  if (record.protocol !== RESTORE_STAGING_PROTOCOL) {
    throw corrupt(
      `its protocol is ${JSON.stringify(record.protocol)}, expected ` +
      `${JSON.stringify(RESTORE_STAGING_PROTOCOL)} (it may be from an incompatible version)`,
    );
  }
  // The filename and the record's own key must agree, for `loadStaging`'s
  // reason: a file literally named `<key>.json` whose CONTENTS name another
  // restore would let an approval be written under one name and read under
  // the other, leaving the record the caller asked about still unapproved
  // while the caller believed it had approved it.
  if (record.key !== key) {
    throw new Error(
      `my_context: the staged restore in ${file} names ${JSON.stringify(record.key)} internally, ` +
      'which is not the key its filename names. Refusing to trust it — it may have been copied ' +
      'from another staged restore or edited by hand.',
    );
  }
  if (!STATES.includes(record.state)) {
    throw corrupt(`its state is ${JSON.stringify(record.state)}, not one of ${STATES.join(', ')}`);
  }
  if (typeof record.payload !== 'string' || record.payload === '') {
    throw corrupt('it carries no payload, which is the whole thing it exists to hold');
  }
  if (typeof record.reviewForm !== 'string' || record.reviewForm === '') {
    throw corrupt('it carries no review form, and the owner approves against the form');
  }
  if (!Array.isArray(record.shortfalls)) {
    throw corrupt(
      `its "shortfalls" field is ${JSON.stringify(record.shortfalls)}, not an array — and an ` +
      'unreadable coverage account is exactly the state design §5 refuses',
    );
  }
  return record;
}

/** One `.staging/restore/*.json` this sweep would not read, and why, in words. */
export interface SkippedRestore {
  /** The bare filename, never an absolute path — this travels to a browser. */
  file: string;
  reason: string;
}

/**
 * **Every staged restore this directory holds, and every one that was NOT
 * read, with the reason.**
 *
 * `loadStagedRestore` refuses one named file and throws, because its caller
 * asked about that file. A sweep is asked about the DIRECTORY, and one junk
 * file must not make the others unlistable — so every refusal becomes a row
 * here instead and the caller decides how loudly to say it.
 * `INV-nothing-is-dropped-silently` is why the second half of the return value
 * exists at all: `lesson/staging.ts` records a status line reading *"3 staged
 * lessons"* over a directory of five files, and it was indistinguishable from
 * a correct one.
 *
 * A missing directory is not a skip and not an error: a project that has never
 * staged a restore has nothing to report.
 */
export function readRestoreStagingDir(
  root: string,
): { staged: StagedRestore[]; skipped: SkippedRestore[] } {
  const dir = restoreStagingDir(root);
  let names: string[];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.json'));
  } catch {
    return { staged: [], skipped: [] };
  }

  const staged: StagedRestore[] = [];
  const skipped: SkippedRestore[] = [];
  for (const name of names.sort()) {
    const key = name.slice(0, -'.json'.length);
    try {
      const one = loadStagedRestore(root, key);
      if (one !== null) staged.push(one);
    } catch (err) {
      skipped.push({ file: name, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return { staged, skipped };
}

/**
 * **The one record the next injection is allowed to deliver — and everything
 * this answer could not read.**
 *
 * `approved` and nothing else. A `proposed` record is a summary an agent built
 * and the owner has not acted on, and delivering one would be this feature
 * injecting on its own initiative — which the item forbids by name: *"AND
 * NEVER AUTOMATIC. An agent may propose and may build. ONLY THE OWNER
 * INJECTS."* A `delivered` one has been spent.
 *
 * The OLDEST approval wins when there is more than one, so a restore that has
 * been waiting is not starved by a newer build. It never throws: a corrupt
 * record costs the delivery, never the injection — `INV-hooks-fail-open`, the
 * same direction `spendCarryOnce` takes for the carry queue.
 *
 * **`skipped` is returned rather than swallowed, and that is not tidiness.**
 * This returned a bare `StagedRestore | null` for exactly one test run, and a
 * corrupt record read as "nothing was approved" — which is the same answer a
 * workspace with nothing staged gives. The owner in that state has just
 * cleared his window on the strength of an approval, and the one sentence he
 * needs is that the file did not survive. `INV-nothing-is-dropped-silently`
 * is the rule; the caller decides how loudly to say it.
 */
export function approvedRestore(
  root: string,
): { record: StagedRestore | null; skipped: SkippedRestore[] } {
  try {
    const { staged, skipped } = readRestoreStagingDir(root);
    const approved = staged.filter((s) => s.state === 'approved');
    approved.sort((a, b) => (a.approvedAt ?? '').localeCompare(b.approvedAt ?? ''));
    return { record: approved[0] ?? null, skipped };
  } catch (err) {
    return {
      record: null,
      skipped: [{ file: restoreStagingDir(root), reason: err instanceof Error ? err.message : String(err) }],
    };
  }
}

/** What a verification found. `ok` is the only thing a caller may act on. */
export interface RestoreVerification {
  ok: boolean;
  /** Present whenever `ok` is false. Why, in the words the owner will read. */
  reason: string | null;
  /** Bytes of payload actually read back off the disk. */
  payloadBytes: number;
}

/**
 * **Re-read the staged file and confirm it holds what the caller staged — the
 * check that stands between the stage and the clear.**
 *
 * The caller passes the two artefacts it BELIEVES are on disk and this
 * compares them, byte for byte, against what comes back. That is the whole
 * point, and the reason this takes an argument at all: a function that merely
 * re-read the file and reported that it parsed would be confirming that a file
 * exists, not that the summary the owner just read is the summary that will
 * survive his clear.
 *
 * Every failure is a REASON, never a throw: the caller's next act is to tell a
 * person it is NOT safe to clear, and it cannot do that from inside an
 * exception it did not expect.
 */
export function verifyStagedRestore(
  root: string, key: string, expected: { payload: string; reviewForm: string },
): RestoreVerification {
  let record: StagedRestore | null;
  try {
    record = loadStagedRestore(root, key);
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err), payloadBytes: 0 };
  }
  if (record === null) {
    return {
      ok: false,
      reason: `nothing is staged at ${restoreStagingFile(root, key)} — the write did not survive`,
      payloadBytes: 0,
    };
  }
  const payloadBytes = Buffer.byteLength(record.payload, 'utf8');
  if (record.payload !== expected.payload) {
    return {
      ok: false,
      reason:
        `the payload on disk is not the payload that was staged (${payloadBytes} bytes on disk, ` +
        `${Buffer.byteLength(expected.payload, 'utf8')} expected). Clearing now would lose the ` +
        'summary rather than restore it.',
      payloadBytes,
    };
  }
  if (record.reviewForm !== expected.reviewForm) {
    return {
      ok: false,
      reason:
        'the review form on disk is not the review form that was approved, so the payload on ' +
        'disk is not the one that was described to you.',
      payloadBytes,
    };
  }
  return { ok: true, reason: null, payloadBytes };
}
