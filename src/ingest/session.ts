import {
  appendFileSync, closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync,
  renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { retryOnTransientFsError } from '../core/rebuild.ts';
import { checksum, slugify } from '../core/slug.ts';
import { chunkDocument, normalizeEol, sourceChecksum, type Chunk } from './chunk.ts';

export const SESSION_PROTOCOL = 'my_context/ingest-session@1';

export interface ApplyRecord {
  candidateHash: string;
  itemId: string;
  action: 'created' | 'deduped' | 'superseded';
  previousId?: string;
  at: string;
}

/**
 * One rejected candidate, durably recorded in `<id>.rejected.jsonl`.
 *
 * Separate from the applied log on purpose. `AppliedLine` has exactly two
 * meanings — "this anchor produced this record" and "this anchor was
 * processed and produced nothing" — and `foldApplied` turns the mere presence
 * of a line for an anchor into "applied", which is the resume decision.
 * Adding a rejection to that file, in any shape carrying an `anchor`, would
 * therefore mark the anchor applied as a side effect of recording that
 * something FAILED. A second file cannot do that: nothing in the resume path
 * reads it.
 */
export interface RejectionRecord {
  anchor: string;
  at: string;
  /** `ValidationIssue.index` — the candidate's position in the submitted array,
   * or -1 for an issue not tied to one entry (a failed supersession). */
  index: number;
  title?: string;
  message: string;
}

export interface IngestSession {
  protocol: string;
  id: string;
  /** POSIX, repo-relative — enforced by `makeSessionId`, not merely documented. */
  sourceFile: string;
  /** Checksum of the whole document, not of a chunk. */
  sourceChecksum: string;
  createdAt: string;
  chunks: Chunk[];
  /** Keyed by chunk anchor. Presence of the key means "applied", even when empty. */
  applied: Record<string, ApplyRecord[]>;
  /**
   * Every candidate this session has ever had rejected, oldest first, across
   * all anchors and all processes. Append-only and never pruned by a later
   * success: a resubmitted, corrected candidate adds an accepted record to the
   * applied log, it does not erase the history of the rejected one.
   */
  rejected: RejectionRecord[];
}

/**
 * What actually lives in `<id>.json` on disk. Deliberately excludes `applied`:
 * that field is mutable working state (grows one apply at a time, potentially
 * from concurrent processes), while everything else here is fixed forever at
 * the moment a session is opened. Splitting the two means the header file
 * never needs to be read-modify-written after its first save, and `applied`
 * lives instead in an append-only log (`<id>.applied.jsonl`) that concurrent
 * writers can each append to without racing each other's data out of
 * existence. See `saveSession` / `appendAppliedDiff` for the write side and
 * `foldApplied` for the read side.
 */
interface SessionHeader {
  protocol: string;
  id: string;
  sourceFile: string;
  sourceChecksum: string;
  createdAt: string;
  chunks: Chunk[];
}

/** One entry in `<id>.applied.jsonl`. `record: null` marks "this anchor was
 * processed and yielded zero extractions" — a chunk can be legitimately done
 * without ever producing an `ApplyRecord`, and an append-only log needs an
 * explicit way to say that, since "no line for this anchor" already means
 * "not yet done". */
interface AppliedLine {
  anchor: string;
  record: ApplyRecord | null;
}

export function ingestDir(root: string): string {
  return path.join(root, '.ingest');
}

/**
 * `sourceFileRel` is required to be POSIX-style and repo-relative (forward
 * slashes only). This isn't just documentation: a Windows-style path with
 * backslashes would slugify differently from the same logical path written
 * with forward slashes, so the same file could silently get two different
 * session ids depending on which platform's path separator a caller (CLI,
 * MCP tool) happened to hand in — one more way `windows-latest` vs
 * `ubuntu-latest` CI could disagree without either being "wrong". Refusing
 * up front is cheaper than debugging a platform-dependent session id.
 */
function assertPosixRelative(sourceFileRel: string): void {
  if (sourceFileRel.includes('\\')) {
    throw new Error(
      `my_context: sourceFile must be a POSIX-style, repo-relative path (forward slashes only); ` +
      `got "${sourceFileRel}".`,
    );
  }
}

/**
 * The id is derived from BOTH the source path and the document content, not
 * content alone: `slugify` collapses any run of non-alphanumeric characters
 * to a single hyphen (and truncates long slugs), so two genuinely different
 * paths — e.g. "docs/prd/auth.md" and "docs/prd-auth.md" — can slugify to
 * the exact same string. With identical content (a template, boilerplate, or
 * an empty doc — all realistic), slug-only ids for those two files would
 * collide, and the second file's session would silently resume, and then
 * overwrite on disk, the first file's session. Folding in a checksum of the
 * *whole* path (not just its slugified form) makes that collision require an
 * actual hash collision, not merely a slugify collision. The path checksum
 * is not sufficient on its own to close this (see the `sourceFile` check in
 * `openIngestSession`'s resume condition, which is the other half).
 */
export function makeSessionId(sourceFileRel: string, docChecksum: string): string {
  assertPosixRelative(sourceFileRel);
  const pathHash = checksum(sourceFileRel).slice(0, 8);
  return `ING-${slugify(sourceFileRel)}-${pathHash}-${docChecksum.slice(0, 8)}`;
}

/**
 * Session ids are used directly as filesystem path components below. They
 * are meant to only ever come from `makeSessionId`, which only ever emits
 * `[A-Za-z0-9-]`, but `loadSession`/`saveSession` accept an `id` from *any*
 * caller — a later task wires this to a CLI argument and an MCP tool
 * parameter, both user/model controlled — so trusting the producer instead
 * of validating at the consumer would make `../../etc/whatever` a path
 * traversal the moment either of those lands. Reject anything outside this
 * charset before it ever reaches `path.join`.
 *
 * Deliberately a *reject*, not a `sanitizeSessionId`-style mangle
 * (`src/core/ledger.ts`, used for hook-supplied session ids): that function
 * exists to make an arbitrary string into *some* usable filename, which is
 * right for a hook session id that must always resolve to a snapshot.
 * Every legitimate ingest session id is machine-produced by `makeSessionId`
 * with an exact expected shape, so mangling a bad one here would silently
 * resolve a caller's bug to a *different, valid-looking* session instead of
 * surfacing the bug — the wrong failure mode for something meant to be
 * looked up by an id the caller already has. Do not "unify" these two
 * functions; they solve different problems.
 */
const SAFE_ID = /^[A-Za-z0-9-]+$/;

function assertSafeId(id: string): void {
  if (!SAFE_ID.test(id)) {
    throw new Error(
      `my_context: invalid ingest session id "${id}" — expected letters, digits and hyphens only.`,
    );
  }
}

function sessionFile(root: string, id: string): string {
  assertSafeId(id);
  return path.join(ingestDir(root), `${id}.json`);
}

function appliedFile(root: string, id: string): string {
  assertSafeId(id);
  return path.join(ingestDir(root), `${id}.applied.jsonl`);
}

function rejectedFile(root: string, id: string): string {
  assertSafeId(id);
  return path.join(ingestDir(root), `${id}.rejected.jsonl`);
}

/**
 * Creates `.ingest/` and (re)writes its `*` .gitignore. Exported because
 * `src/ingest/lock.ts` creates the SAME directory for the apply lock and used
 * to do it with a bare `mkdirSync`, so a workspace whose first ingest command
 * was an apply offered `apply.lock` (and every later session file) to git.
 * One function rather than a second copy of the same two lines: this project
 * has repeatedly found a guard re-derived at a second call site to be the
 * place it goes missing. `writeSnapshot` (src/core/ledger.ts) writes the same
 * `*` .gitignore for the same reason, for the ledger's own directory.
 */
export function ensureIngestDir(root: string): string {
  const dir = ingestDir(root);
  mkdirSync(dir, { recursive: true });
  // Rewritten unconditionally (not "only if absent") so an emptied or
  // hand-edited .gitignore self-heals on the next open/save, the same way
  // `writeSnapshot` (src/core/ledger.ts) treats its own working-state
  // .gitignore. Cheap: one small, deterministic write every call.
  writeFileSync(path.join(dir, '.gitignore'), '*\n', 'utf8');
  return dir;
}

/**
 * Temp file + rename, so a reader never observes a torn/partial write. The
 * rename goes through `retryOnTransientFsError` (src/core/rebuild.ts): this
 * is a same-directory rename over an existing destination on every
 * resume-and-save cycle (the header is rewritten idempotently on every
 * `saveSession` call, see below), which is exactly the `MoveFileEx` hazard
 * that helper exists for on Windows — another process (virus scanner, search
 * indexer) can transiently hold the destination open.
 *
 * The temp name deliberately carries only the pid, not an added per-process
 * counter (contrast `writeItem` in rebuild.ts, which has one): `saveSession`
 * is fully synchronous end-to-end (`writeFileSync` then `renameSync`, no
 * `await` between them), so no interleaving between two calls in the same
 * process is possible regardless of the temp name, and a fixed, predictable
 * name is what let this be tested directly — see
 * "a stale/garbage temp file from a previous crash does not survive or
 * corrupt the next save" in the test file, which pre-creates the exact temp
 * path a crash would have left behind and asserts `saveSession` cleans up
 * after it. A counter would make that path unpredictable from a test without
 * exposing an internal naming function, for a race this call shape cannot
 * hit.
 *
 * No `fsync` is called before the rename: the guarantee here is "no reader
 * ever sees a half-written file", not "durable across a hard power loss".
 */
function writeHeader(root: string, header: SessionHeader): void {
  ensureIngestDir(root);
  const target = sessionFile(root, header.id);
  const tmp = `${target}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, JSON.stringify(header, null, 2) + '\n', 'utf8');
    retryOnTransientFsError(() => renameSync(tmp, target));
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
}

function readHeader(root: string, id: string): SessionHeader {
  const file = sessionFile(root, id);
  if (!existsSync(file)) {
    throw new Error(
      `my_context: no ingest session "${id}" under ${ingestDir(root)}. ` +
      `Run \`mycontext ingest <path>\` to start one, or \`mycontext ingest-status\` to list them.`,
    );
  }
  const raw = readFileSync(file, 'utf8');
  try {
    return JSON.parse(raw) as SessionHeader;
  } catch (err) {
    // Sessions are working state, not knowledge (see ingestDir's .gitignore):
    // deleting a corrupt one and starting over is always a safe suggestion,
    // unlike a corrupt knowledge file, which must never be silently proposed
    // for deletion.
    throw new Error(
      `my_context: ingest session "${id}" at ${file} is corrupt (invalid JSON: ` +
      `${err instanceof Error ? err.message : String(err)}). Delete the file and re-run ` +
      `\`mycontext ingest\` to start a fresh session.`,
    );
  }
}

/** Tolerant of a truncated final line (a crash mid-`appendFileSync` can leave
 * one): skipped, not fatal, so one bad line can never take down the whole
 * apply history. */
function readAppliedLines(root: string, id: string): AppliedLine[] {
  const file = appliedFile(root, id); // validates id; lets its own error propagate untouched
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    // Anything other than "the log doesn't exist yet" (EACCES, a lock, a
    // read error) is NOT the same as "no work done yet" — treating it that
    // way would make the whole document silently re-extract. Surface it.
    throw new Error(
      `my_context: could not read the applied-log for ingest session "${id}" at ${file} ` +
      `(${err instanceof Error ? err.message : String(err)}). This is different from "no work ` +
      `done yet" — resuming now would silently re-extract everything already applied. ` +
      `Investigate the underlying error before retrying.`,
    );
  }

  const out: AppliedLine[] = [];
  for (const line of raw.split('\n')) {
    if (line.trim() === '') continue;
    try {
      const parsed = JSON.parse(line) as Partial<AppliedLine>;
      if (typeof parsed.anchor === 'string') {
        out.push({ anchor: parsed.anchor, record: parsed.record ?? null });
      }
    } catch {
      // A truncated or corrupt line — most likely the tail end of a crash
      // mid-append. Skip it; every line before it is still trustworthy.
    }
  }
  return out;
}

/**
 * Reads `<id>.rejected.jsonl`. Same tolerance for a truncated final line as
 * `readAppliedLines`, and the same refusal to treat an unreadable file as an
 * empty one: a rejection log that cannot be read is the trace of work that
 * failed, and reporting "nothing was rejected" for it would recreate exactly
 * the invisibility this file exists to end.
 */
export function readRejections(root: string, id: string): RejectionRecord[] {
  const file = rejectedFile(root, id); // validates id; lets its own error propagate untouched
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    throw new Error(
      `my_context: could not read the rejection log for ingest session "${id}" at ${file} ` +
      `(${err instanceof Error ? err.message : String(err)}). This is different from "nothing ` +
      `was rejected". Investigate the underlying error before retrying.`,
    );
  }

  const out: RejectionRecord[] = [];
  for (const line of raw.split('\n')) {
    if (line.trim() === '') continue;
    try {
      const parsed = JSON.parse(line) as Partial<RejectionRecord>;
      if (typeof parsed.anchor === 'string' && typeof parsed.message === 'string') {
        out.push({
          anchor: parsed.anchor,
          at: typeof parsed.at === 'string' ? parsed.at : '',
          index: typeof parsed.index === 'number' ? parsed.index : -1,
          ...(typeof parsed.title === 'string' ? { title: parsed.title } : {}),
          message: parsed.message,
        });
      }
    } catch {
      // As above: a truncated tail line is skipped, never fatal.
    }
  }
  return out;
}

/**
 * Fixed key order, so the on-disk line and the in-memory record serialize
 * identically. `JSON.stringify` follows insertion order, and a record read
 * back by `readRejections` is built in a different order from one an
 * `applyCandidates` caller pushed — comparing raw `JSON.stringify` output
 * would then call two identical records different and append a duplicate line
 * on every save.
 */
function serializeRejection(r: RejectionRecord): string {
  return JSON.stringify({
    anchor: r.anchor,
    at: r.at,
    index: r.index,
    ...(r.title === undefined ? {} : { title: r.title }),
    message: r.message,
  });
}

/** Every rejection recorded against one anchor, oldest first. */
export function rejectionsForAnchor(session: IngestSession, anchor: string): RejectionRecord[] {
  return session.rejected.filter((r) => r.anchor === anchor);
}

/**
 * The rejection-log sibling of `appendAppliedDiff`: appends whatever is in
 * `session.rejected` that is not already on disk, one JSON line each, through
 * the same `appendToLog` that heals a crash-truncated final line.
 *
 * Deduped by exact serialized equality against the current file, so saving
 * twice from one in-memory session never doubles a line. The honest limit of
 * that: two IDENTICAL rejections of the same candidate at the same `at`
 * timestamp collapse into one line. `at` comes from `applyCandidates`' single
 * per-call timestamp, so that means "the same candidate rejected twice within
 * one apply call" — the count is then wrong by one, the fact is not lost.
 */
function appendRejectedDiff(root: string, session: IngestSession): void {
  if (session.rejected.length === 0) return;
  const already = new Set(readRejections(root, session.id).map(serializeRejection));
  const lines: string[] = [];
  for (const rejection of session.rejected) {
    const serialized = serializeRejection(rejection);
    if (already.has(serialized)) continue;
    already.add(serialized);
    lines.push(serialized);
  }
  if (lines.length === 0) return;
  appendToLog(rejectedFile(root, session.id), lines);
}

function foldApplied(lines: AppliedLine[]): Record<string, ApplyRecord[]> {
  const applied: Record<string, ApplyRecord[]> = {};
  for (const { anchor, record } of lines) {
    // `setApplied`, not `applied[anchor] = []` — see that function's doc
    // comment (below) for why plain bracket assignment corrupts the
    // object's prototype for an anchor spelled "__proto__". An anchor read
    // out of a hand-edited or foreign `.applied.jsonl` line is untrusted
    // the same way any parsed JSON is, even though no anchor `slugify`
    // itself can currently produce would collide with it.
    if (!hasApplied(applied, anchor)) setApplied(applied, anchor, []);
    if (record !== null) appliedRecordsFor(applied, anchor).push(record);
  }
  return applied;
}

/**
 * The one accessor every reader of an `applied` map must use.
 * `Record<string, ApplyRecord[]>` is a plain object, and anchors are
 * `slugify` output — which can spell any `Object.prototype` member's name
 * (`constructor`, `toString`, `valueOf`, …). Bracket access alone
 * (`applied[anchor]`) reads back an *inherited* value for those, not
 * `undefined` and not an own array, so anything that branches on
 * `applied[anchor] === undefined` or defaults with `applied[anchor] ?? []`
 * is silently wrong for exactly the anchors this project's own documents
 * are certain to eventually produce. This mistake was made and fixed once in
 * this file (`pendingAnchors`) and then reintroduced twenty lines away in
 * `appendAppliedDiff`, in the same round that fixed the first one — proof
 * that a guard repeated per call site is not a property of the module. Every
 * access now goes through here instead.
 *
 * Exported: `applyCandidates` (`src/ingest/apply.ts`) reads `session.applied`
 * too, and is exactly the kind of second caller this hazard was reintroduced
 * for once already — a private copy in that file would be the same mistake a
 * third time, in a third place. This is the one place either module is
 * allowed to read an `applied` map by anchor.
 */
export function hasApplied(applied: Record<string, ApplyRecord[]>, anchor: string): boolean {
  return Object.prototype.hasOwnProperty.call(applied, anchor);
}

export function appliedRecordsFor(applied: Record<string, ApplyRecord[]>, anchor: string): ApplyRecord[] {
  return hasApplied(applied, anchor) ? applied[anchor] : [];
}

/**
 * The write-side sibling of `hasApplied`/`appliedRecordsFor` — every writer
 * of an `applied` map must use this instead of `applied[anchor] = records`.
 * Plain bracket assignment is safe for every anchor EXCEPT one: `__proto__`
 * is not an ordinary data property on a plain object's prototype chain, it's
 * an accessor (getter/setter) inherited from `Object.prototype`, so
 * `applied['__proto__'] = records` does not create an own `'__proto__'`
 * property at all — it invokes the inherited SETTER, which reassigns the
 * object's actual prototype to `records`, corrupting every future lookup on
 * `applied` (including `hasApplied`'s own `hasOwnProperty.call`, which lives
 * on the prototype this would have just replaced). No anchor `slugify`
 * (slug.ts) can currently produce this — its `[^a-z0-9]+` replace collapses
 * every underscore to a hyphen, so `"__proto__"` slugifies to `"proto"`, and
 * the one hardcoded non-slugified anchor (`"_preamble"`, chunk.ts) isn't it
 * either — but that is a property of today's callers, not of this data
 * structure, and is exactly the kind of reasoning this module's own history
 * shows does not survive being left implicit at each write site (see
 * `appendAppliedDiff`'s doc comment above). `Object.defineProperty` always
 * creates/redefines an OWN data property for the given key, `__proto__`
 * included, so it is used here instead of assignment.
 */
export function setApplied(applied: Record<string, ApplyRecord[]>, anchor: string, records: ApplyRecord[]): void {
  Object.defineProperty(applied, anchor, {
    value: records, writable: true, enumerable: true, configurable: true,
  });
}

/**
 * Appends whatever is in `session.applied` that is not already on disk, one
 * JSON line per new record (plus one sentinel line per anchor that is
 * "applied, zero records"). Diffed against the current log, not blindly
 * appended, so calling `saveSession` twice with the same in-memory state
 * (e.g. a retry) never duplicates a line.
 *
 * This is intentionally NOT a read-modify-write of the whole log: each
 * accepted line is one `appendFileSync` call, which does not interleave with
 * a concurrent process's own append on either POSIX or Windows for writes
 * this small. Two processes racing to apply *different* chunks of the same
 * session both keep their record; the old design (rewrite the whole
 * `<id>.json` including `applied`) made the second writer silently erase the
 * first writer's `applied` entry — the same failure shape as the
 * schema-initialisation race that duplicated rows in 18 of 20 fresh
 * workspaces, since a re-resumed session sees the "lost" chunk as pending
 * again and re-extracts it.
 */
function appendAppliedDiff(root: string, session: IngestSession): void {
  const already = foldApplied(readAppliedLines(root, session.id));
  const file = appliedFile(root, session.id);
  const lines: string[] = [];

  for (const anchor of Object.keys(session.applied)) {
    const records = session.applied[anchor];
    const knownForAnchor = hasApplied(already, anchor);

    if (records.length === 0) {
      if (!knownForAnchor) lines.push(JSON.stringify({ anchor, record: null }));
      continue;
    }

    const seen = new Set(appliedRecordsFor(already, anchor).map((r) => JSON.stringify(r)));
    for (const record of records) {
      const serialized = JSON.stringify(record);
      if (!seen.has(serialized)) {
        lines.push(JSON.stringify({ anchor, record }));
        seen.add(serialized); // do not append a within-batch duplicate twice
      }
    }
  }

  if (lines.length === 0) return;
  appendToLog(file, lines);
}

/**
 * Appends `lines` (each without its own trailing newline) to `file`, healing
 * a truncated final line first if one is found. A crash mid-`appendFileSync`
 * can leave a partial JSON fragment with no trailing newline; appending
 * straight onto it would concatenate the new line onto the fragment into one
 * longer unparseable line, and `readAppliedLines` would then skip the whole
 * thing — silently losing the record this call is trying to write, which is
 * exactly the *recovery* save after the crash. That is the one case an
 * append-only log exists to survive, so this checks for it on every write:
 * one single-byte read of the log's last byte (not a full read of a
 * potentially large log), and only when the file already exists and is
 * non-empty.
 */
function appendToLog(file: string, lines: string[]): void {
  let prefix = '';
  try {
    const { size } = statSync(file);
    if (size > 0) {
      const fd = openSync(file, 'r');
      try {
        const buf = Buffer.alloc(1);
        readSync(fd, buf, 0, 1, size - 1);
        if (buf[0] !== 0x0a) prefix = '\n'; // 0x0a === '\n'
      } finally {
        closeSync(fd);
      }
    }
  } catch {
    // File doesn't exist yet — nothing to heal; appendFileSync below creates it.
  }
  appendFileSync(file, prefix + lines.map((l) => `${l}\n`).join(''), 'utf8');
}

/** Persists `session`: the header (idempotently — see `writeHeader`), any
 * `applied` entries not yet in the append-only log, and any `rejected`
 * entries not yet in the rejection log. Returns the header file's path. */
export function saveSession(root: string, session: IngestSession): string {
  ensureIngestDir(root);
  const header: SessionHeader = {
    protocol: session.protocol,
    id: session.id,
    sourceFile: session.sourceFile,
    sourceChecksum: session.sourceChecksum,
    createdAt: session.createdAt,
    chunks: session.chunks,
  };
  writeHeader(root, header);
  appendAppliedDiff(root, session);
  appendRejectedDiff(root, session);
  return sessionFile(root, session.id);
}

export function loadSession(root: string, id: string): IngestSession {
  const header = readHeader(root, id);
  const applied = foldApplied(readAppliedLines(root, id));
  return { ...header, applied, rejected: readRejections(root, id) };
}

export function listSessions(root: string): IngestSession[] {
  const dir = ingestDir(root);
  let names: string[];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }

  const out: IngestSession[] = [];
  for (const name of names) {
    try {
      const parsed = JSON.parse(readFileSync(path.join(dir, name), 'utf8')) as SessionHeader;
      if (parsed.protocol === SESSION_PROTOCOL) {
        const applied = foldApplied(readAppliedLines(root, parsed.id));
        out.push({ ...parsed, applied, rejected: readRejections(root, parsed.id) });
      }
    } catch {
      // A corrupt session file is working state, not knowledge. Skip it.
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Open, or resume, the session for this exact document content. The
 * invariant this relies on: **same `sourceChecksum` implies the same
 * chunking**, which is what makes it safe to trust a resumed session's
 * stored `chunks` without re-chunking. That invariant holds because
 * `openIngestSession` chunks the exact same normalized-and-trimmed string
 * that `sourceChecksum` hashes (`normalizeEol(text).trim()`) — not the raw
 * `text`. Chunking the raw text instead would break it: `sourceChecksum`
 * trims, `chunkDocument` alone does not, so e.g. a single leading space
 * before the first heading leaves the checksum (and therefore the id)
 * unchanged while turning that heading into ordinary preamble text —
 * exactly the "anchor persists, now naming different content" hazard
 * `Chunk.anchor`'s doc comment warns about, reached here via the trim
 * mismatch rather than an edit to the heading itself.
 *
 * Resuming additionally requires the stored `sourceFile` to match, not just
 * `sourceChecksum` and `protocol`: `makeSessionId` already makes an id
 * collision between two different paths require an actual hash collision
 * (see its doc comment), but this is the second, cheap half of closing that
 * class of bug — if a header is ever found whose `sourceFile` doesn't match
 * anyway, that is corruption, not a legitimate resume.
 *
 * **The header is not the authority on what has been applied.** When the
 * header cannot be trusted — unparseable bytes, a `protocol` this build does
 * not recognise (any future `SESSION_PROTOCOL` bump reaches this branch for
 * every existing session), or a `sourceFile`/`sourceChecksum` that disagrees
 * with the document in hand — this function rebuilds the header but RECOVERS
 * the applied log, which is a separate append-only file keyed off the
 * filename by deliberate design (Task 3's ruling; the `checkSessionIdMismatch`
 * doctor check documents the same keying). Discarding it instead, which is
 * what this used to do, made `mycontext ingest` re-emit a chunk that
 * `mycontext ingest-status` — reading the very same log — reported as applied:
 * two commands contradicting each other about one file. The cost is not a
 * wasted LLM call. A reworded re-extraction of an unchanged document fails the
 * `byHash` dedupe and takes `applyCandidates`' supersede branch, minting a
 * revision that retires the live draft; a discarded applied log therefore
 * churns the corpus silently, and a protocol bump would do it to every
 * in-flight session at once.
 *
 * Recovery is only safe because the id pins the content: the id embeds a
 * checksum of this exact document, so every anchor in the log under this id
 * came from chunking this same text. That is checked rather than assumed —
 * if the log names an anchor the freshly-computed chunks do not have, the two
 * artifacts genuinely disagree about what document this is (a hand-edited log,
 * a truncated-hash id collision, or a future build whose chunker changed), and
 * this function REFUSES instead of guessing. Silently re-extracting is the one
 * outcome that is never acceptable, and silently trusting a log from some
 * other document is no better; a human is told exactly which anchors do not
 * line up and what to do about it.
 */
export function openIngestSession(root: string, sourceFileRel: string, text: string): IngestSession {
  assertPosixRelative(sourceFileRel);
  const docChecksum = sourceChecksum(text);
  const id = makeSessionId(sourceFileRel, docChecksum);

  const file = sessionFile(root, id);
  if (existsSync(file)) {
    try {
      const existing = JSON.parse(readFileSync(file, 'utf8')) as SessionHeader;
      if (
        existing.protocol === SESSION_PROTOCOL
        && existing.sourceChecksum === docChecksum
        && existing.sourceFile === sourceFileRel
      ) {
        ensureIngestDir(root);
        const applied = foldApplied(readAppliedLines(root, id));
        return { ...existing, applied, rejected: readRejections(root, id) };
      }
    } catch {
      // Fall through and rebuild the header — see the recovery block below,
      // which is reached identically for an unparseable header and for a
      // parseable one that disagrees with the document.
    }
  }

  ensureIngestDir(root);
  const chunks = chunkDocument(normalizeEol(text).trim());
  const applied = foldApplied(readAppliedLines(root, id));
  const anchors = new Set(chunks.map((c) => c.anchor));
  const orphaned = Object.keys(applied).filter((a) => !anchors.has(a));
  if (orphaned.length > 0) {
    throw new Error(
      `my_context: ingest session "${id}" has an applied log recording anchor(s) ` +
      `${orphaned.map((a) => `"${a}"`).join(', ')} that do not exist in ${sourceFileRel} ` +
      `(known anchors: ${chunks.map((c) => c.anchor).join(', ')}), and its header ` +
      `at ${file} could not be used. The log and the document disagree about what this ` +
      `session is, so neither resuming nor re-extracting is safe — re-extracting would ` +
      `re-apply chunks already applied and can retire live drafts. Inspect ` +
      `${appliedFile(root, id)}; move it aside to start this document over from scratch.`,
    );
  }

  return {
    protocol: SESSION_PROTOCOL,
    id,
    sourceFile: sourceFileRel,
    sourceChecksum: docChecksum,
    createdAt: new Date().toISOString(),
    chunks,
    applied,
    rejected: readRejections(root, id),
  };
}

export function pendingAnchors(session: IngestSession): string[] {
  return session.chunks
    .filter((c) => !hasApplied(session.applied, c.anchor))
    .map((c) => c.anchor);
}
