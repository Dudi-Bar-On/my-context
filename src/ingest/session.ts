import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { slugify } from '../core/slug.ts';
import { chunkDocument, sourceChecksum, type Chunk } from './chunk.ts';

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
  /** POSIX, repo-relative. */
  sourceFile: string;
  /** Checksum of the whole document, not of a chunk. */
  sourceChecksum: string;
  createdAt: string;
  chunks: Chunk[];
  /** Keyed by chunk anchor. Presence of the key means "applied", even when empty. */
  applied: Record<string, ApplyRecord[]>;
}

export function ingestDir(root: string): string {
  return path.join(root, '.ingest');
}

export function makeSessionId(sourceFileRel: string, docChecksum: string): string {
  return `ING-${slugify(sourceFileRel)}-${docChecksum.slice(0, 8)}`;
}

function sessionFile(root: string, id: string): string {
  return path.join(ingestDir(root), `${id}.json`);
}

function ensureDir(root: string): string {
  const dir = ingestDir(root);
  mkdirSync(dir, { recursive: true });
  const ignore = path.join(dir, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n', 'utf8');
  return dir;
}

/** Temp file + rename, so a crash mid-write never leaves a truncated session. */
export function saveSession(root: string, session: IngestSession): string {
  ensureDir(root);
  const target = sessionFile(root, session.id);
  const tmp = `${target}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, JSON.stringify(session, null, 2) + '\n', 'utf8');
    renameSync(tmp, target);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
  return target;
}

export function loadSession(root: string, id: string): IngestSession {
  const file = sessionFile(root, id);
  if (!existsSync(file)) {
    throw new Error(
      `my_context: no ingest session "${id}" under ${ingestDir(root)}. ` +
      `Run \`mycontext ingest <path>\` to start one, or \`mycontext ingest-status\` to list them.`,
    );
  }
  return JSON.parse(readFileSync(file, 'utf8')) as IngestSession;
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
      const parsed = JSON.parse(readFileSync(path.join(dir, name), 'utf8')) as IngestSession;
      if (parsed.protocol === SESSION_PROTOCOL) out.push(parsed);
    } catch {
      // A corrupt session file is working state, not knowledge. Skip it.
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Open, or resume, the session for this exact document content. The id is
 * derived from the content, so an unchanged source always resumes and an
 * edited source always starts fresh without destroying the earlier record.
 */
export function openIngestSession(root: string, sourceFileRel: string, text: string): IngestSession {
  const docChecksum = sourceChecksum(text);
  const id = makeSessionId(sourceFileRel, docChecksum);

  const file = sessionFile(root, id);
  if (existsSync(file)) {
    try {
      const existing = JSON.parse(readFileSync(file, 'utf8')) as IngestSession;
      if (existing.protocol === SESSION_PROTOCOL && existing.sourceChecksum === docChecksum) {
        ensureDir(root);
        return existing;
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
    chunks: chunkDocument(text),
    applied: {},
  };
}

export function pendingAnchors(session: IngestSession): string[] {
  return session.chunks
    .filter((c) => !Object.prototype.hasOwnProperty.call(session.applied, c.anchor))
    .map((c) => c.anchor);
}
