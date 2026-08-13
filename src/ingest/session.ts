import {
  appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync,
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

function ensureDir(root: string): string {
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
  ensureDir(root);
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
  let raw: string;
  try {
    raw = readFileSync(appliedFile(root, id), 'utf8');
  } catch {
    return [];
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

function foldApplied(lines: AppliedLine[]): Record<string, ApplyRecord[]> {
  const applied: Record<string, ApplyRecord[]> = {};
  for (const { anchor, record } of lines) {
    if (!Object.prototype.hasOwnProperty.call(applied, anchor)) applied[anchor] = [];
    if (record !== null) applied[anchor].push(record);
  }
  return applied;
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
    const knownForAnchor = Object.prototype.hasOwnProperty.call(already, anchor);

    if (records.length === 0) {
      if (!knownForAnchor) lines.push(JSON.stringify({ anchor, record: null }));
      continue;
    }

    const seen = new Set((already[anchor] ?? []).map((r) => JSON.stringify(r)));
    for (const record of records) {
      const serialized = JSON.stringify(record);
      if (!seen.has(serialized)) {
        lines.push(JSON.stringify({ anchor, record }));
        seen.add(serialized); // do not append a within-batch duplicate twice
      }
    }
  }

  if (lines.length === 0) return;
  appendFileSync(file, lines.map((l) => `${l}\n`).join(''), 'utf8');
}

/** Persists `session`: the header (idempotently — see `writeHeader`) and any
 * `applied` entries not yet in the append-only log. Returns the header
 * file's path. */
export function saveSession(root: string, session: IngestSession): string {
  ensureDir(root);
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
  return sessionFile(root, session.id);
}

export function loadSession(root: string, id: string): IngestSession {
  const header = readHeader(root, id);
  const applied = foldApplied(readAppliedLines(root, id));
  return { ...header, applied };
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
        out.push({ ...parsed, applied });
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
        ensureDir(root);
        const applied = foldApplied(readAppliedLines(root, id));
        return { ...existing, applied };
      }
    } catch {
      // Fall through and rebuild it.
    }
  }

  ensureDir(root);
  return {
    protocol: SESSION_PROTOCOL,
    id,
    sourceFile: sourceFileRel,
    sourceChecksum: docChecksum,
    createdAt: new Date().toISOString(),
    chunks: chunkDocument(normalizeEol(text).trim()),
    applied: {},
  };
}

export function pendingAnchors(session: IngestSession): string[] {
  return session.chunks
    .filter((c) => !Object.prototype.hasOwnProperty.call(session.applied, c.anchor))
    .map((c) => c.anchor);
}
