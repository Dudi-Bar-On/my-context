/**
 * The web UI's session store: the digests of tokens this installation has
 * issued, so that A TAB THAT WAS OPEN WHEN THE SERVER RESTARTED KEEPS WORKING.
 *
 * ── WHAT THIS FIXES ────────────────────────────────────────────────────────
 *
 * The token was minted per process and kept only in memory
 * (`src/ui/security.ts` · `minted per invocation, held in memory on both sides and nowhere else` · ~28). <!-- historical-citation: the OLD text of that comment; THIS module is what changed it, and security.ts now quotes the sentence inside the paragraph explaining the change — so an unmarked citation resolves to a line reading "Before that, this sentence read …" and cites the history as if it were the claim -->
 *
 * A restarted server therefore recognised no credential an open tab held, and a
 * page can only earn a new one by redeeming a nonce PRINTED IN THE TERMINAL. So
 * a reload answered 403, the server expired the stale cookie, and every refresh
 * after that answered 401 — forever. Measured over real HTTP on 2026-08-23,
 * after three earlier fixes that each addressed a different layer of the same
 * symptom.
 *
 * The banner shipped the day before told the reader to refresh. Refresh cannot
 * mint a credential, so that was a promise the protocol could not keep. This
 * module is what makes it keepable.
 *
 * ── A DIGEST, NEVER THE TOKEN ──────────────────────────────────────────────
 *
 * What is written here is `sha256(token)`. The browser's cookie holds the
 * secret; disk holds something nobody can present. **This is the difference
 * between a hiding place and a fix**, and on this project's own platform it is
 * the whole ballgame: `mode: 0o600` is not honoured on win32 — measured, a file
 * written 0600 lands 666 — so a plain token file would be a live credential
 * readable by anything running as the user. A digest file is not a credential
 * at all, which is why no permission mode is attempted here and none is needed.
 *
 * It also answers the question the owner asked, which was whether SQLite would
 * make the secret less reachable. It would not: `store.ts` deletes the index
 * outright on a schema change — `rmSync(dbPath)`, `-wal`, `-shm` — so a
 * credential kept there dies at the next `mycontext rebuild`, and a `.db` file
 * is the same bytes on the same disk as a `.json` one. Storing a digest removes
 * the reason to hide anything.
 *
 * ── WHY IT LIVES OUTSIDE EVERY CORPUS ──────────────────────────────────────
 *
 * Under the global root, not under `.my_context/`, for two reasons that are
 * both load-bearing rather than tidy:
 *
 *   - `test/ui/server-e2e.test.ts` snapshots every byte under the workspace and
 *     asserts the read surface changes none of them. A file appearing inside
 *     the corpus would fail that, and it SHOULD — the assertion is right.
 *   - A file inside `.my_context/` is a file that can be committed. This corpus
 *     tracks everything in there except `.index.db`.
 *
 * `MYCONTEXT_UI_SESSIONS_DIR` overrides the location, and the test suite pins
 * it to a temporary directory. That is not decoration: a fixture leaking into
 * the developer's real `~/.my-context/` turned 134 unrelated tests red on
 * 2026-08-22 with a message pointing nowhere near the cause.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ───────────────────────────────────────
 *
 * It does not widen who may OBTAIN a token. A nonce is still the only way to
 * earn one, still one-shot, still redeemed at most once. This changes only
 * which already-issued credentials a later process will still honour, and for
 * how long. Nothing here is reachable from a request handler.
 *
 * Neither function throws. Both report what happened, the way `recordAudit`
 * does, because a UI that cannot write its session file must still start — and
 * because a store that failed silently would reintroduce exactly the lockout it
 * exists to prevent, with no way to find out why.
 */
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GLOBAL_DIR } from './workspace.ts';

/** The file, inside `sessionsDir()`. */
const SESSIONS_FILE = 'ui-sessions.json';

/**
 * Thirty days. The cookie is a SESSION cookie — no `Max-Age`, no `Expires` —
 * so the browser drops it when it closes, and this window only ever governs a
 * tab that has stayed open. Thirty days is generous for that and still bounded,
 * which matters because every retained digest is a credential a returning tab
 * may still present.
 */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;

/**
 * Eight. A cap as well as a window, because the window alone is unbounded in
 * the case that actually happens: restarting the server twenty times in an
 * afternoon would otherwise accumulate twenty live digests. Eight covers the
 * handful of tabs a person genuinely has open across restarts; the ninth
 * restart retires the oldest, and the tab holding it is asked to re-open the
 * printed link.
 */
export const SESSION_MAX = 8;

/** The current schema. A file declaring anything else is not read. */
const VERSION = 1;

/** Sixty-four lowercase hex characters, and nothing else, in both directions. */
const DIGEST = /^[0-9a-f]{64}$/;

interface SessionRecord {
  digest: string;
  /** Epoch ms. A number so pruning needs no date parsing. */
  issued: number;
}

/** The directory holding the store — overridable, and read per call so a test may set it late. */
export function sessionsDir(): string {
  const override = process.env['MYCONTEXT_UI_SESSIONS_DIR'];
  return override !== undefined && override !== '' ? override : GLOBAL_DIR;
}

/** The store's absolute path. */
export function sessionsPath(): string {
  return path.join(sessionsDir(), SESSIONS_FILE);
}

/** A record is well formed or it is not read; a half-parsed one is worse than none. */
function isRecord(value: unknown): value is SessionRecord {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  const digest = r['digest'];
  const issued = r['issued'];
  return typeof digest === 'string' && DIGEST.test(digest)
    && typeof issued === 'number' && Number.isFinite(issued);
}

function readRecords(): { records: SessionRecord[]; error: string | null } {
  let raw: string;
  try {
    raw = readFileSync(sessionsPath(), 'utf8');
  } catch {
    // No file is the ordinary first run, and is not an error to report.
    return { records: [], error: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      records: [],
      error: `${sessionsPath()} is not valid JSON (${err instanceof Error ? err.message : String(err)}). `
        + `It holds only digests of tokens already issued, so deleting it costs nothing beyond `
        + `asking any still-open tab to re-open the printed link.`,
    };
  }
  if (typeof parsed !== 'object' || parsed === null) return { records: [], error: null };
  const doc = parsed as Record<string, unknown>;
  // A future version is not guessed at. Reading it as if it were this one is
  // how a store silently starts honouring the wrong thing.
  if (doc['version'] !== VERSION) {
    return {
      records: [],
      error: doc['version'] === undefined ? null
        : `${sessionsPath()} declares version ${JSON.stringify(doc['version'])}, and this build `
          + `writes version ${VERSION}. Nothing was read from it.`,
    };
  }
  const sessions = doc['sessions'];
  if (!Array.isArray(sessions)) return { records: [], error: null };
  return { records: sessions.filter(isRecord), error: null };
}

/** Newest first, expired dropped, capped. The one place the retention rules apply. */
function prune(records: readonly SessionRecord[], now: number): SessionRecord[] {
  return records
    .filter((r) => now - r.issued < SESSION_TTL_MS)
    .toSorted((a, b) => b.issued - a.issued)
    .slice(0, SESSION_MAX);
}

/**
 * The digests a returning tab may still present, newest first.
 *
 * `error` is non-null only when a file EXISTS and could not be used. A missing
 * store is the ordinary first run and reports nothing.
 */
export function loadSessionDigests(now: number = Date.now()): {
  digests: string[]; error: string | null;
} {
  const { records, error } = readRecords();
  return { digests: prune(records, now).map((r) => r.digest), error };
}

/**
 * Append one digest and rewrite the store.
 *
 * Written to a temporary name and renamed, so a crash midway leaves the
 * previous store intact rather than a truncated one — the same shape
 * `rebuild.ts` uses, for the same reason: this file is read at the start of
 * every `mycontext ui`, and a half-written one would lock out every open tab at
 * once, which is the failure this module exists to prevent.
 */
export function recordSessionDigest(digest: string, now: number = Date.now()): {
  written: boolean; error: string | null;
} {
  if (!DIGEST.test(digest)) {
    return {
      written: false,
      error: `not a digest: the session store holds the sha256 hex of an issued token and never `
        + `the token itself, so a value that is not 64 lowercase hex characters is refused rather `
        + `than written. Nothing was written.`,
    };
  }
  const { records } = readRecords();
  const kept = prune([{ digest, issued: now }, ...records.filter((r) => r.digest !== digest)], now);
  const body = `${JSON.stringify({ version: VERSION, sessions: kept }, null, 2)}\n`;
  const target = sessionsPath();
  const tmp = `${target}.tmp`;
  try {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(tmp, body, 'utf8');
    renameSync(tmp, target);
    return { written: true, error: null };
  } catch (err) {
    try { rmSync(tmp, { force: true }); } catch { /* best-effort cleanup */ }
    return {
      written: false,
      error: `could not write ${target} (${err instanceof Error ? err.message : String(err)}). `
        + `The server still runs; a tab opened now will stop working when the server restarts.`,
    };
  }
}
