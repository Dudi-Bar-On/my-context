import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { MutationContext } from '../../core/mutate.ts';
import { relPosix, toPosix } from '../../core/paths.ts';
import { applyCandidates } from '../../ingest/apply.ts';
import { acquireApplyLock } from '../../ingest/lock.ts';
import { nextRequest, renderExtractionRequest } from '../../ingest/request.ts';
import { CANDIDATE_SCHEMA } from '../../ingest/schema.ts';
import { loadSession, openIngestSession, pendingAnchors, saveSession } from '../../ingest/session.ts';

/**
 * The repo root is the parent of `.my_context`; `ctx.root` IS `.my_context`.
 * Source paths in a session are relative to the repo root, so every path in
 * and out of this module goes through here rather than through `process.cwd()`.
 */
function repoRoot(ctx: MutationContext): string {
  return path.dirname(ctx.root);
}

function phaseOne(ctx: MutationContext, rawPath: string): string {
  const repo = repoRoot(ctx);
  const absolute = path.resolve(repo, toPosix(rawPath));
  if (!existsSync(absolute)) {
    throw new Error(`my_context: no such file "${toPosix(rawPath)}" (looked in ${repo}).`);
  }

  const session = openIngestSession(ctx.root, relPosix(repo, absolute), readFileSync(absolute, 'utf8'));
  saveSession(ctx.root, session);

  const request = nextRequest(session, ctx.config);
  if (!request) {
    return (
      `my_context: every chunk of ${session.sourceFile} has already been applied ` +
      `(session ${session.id}). The drafts are waiting in the review queue — list them with list_drafts.`
    );
  }
  return renderExtractionRequest(request);
}

/**
 * Serializes the read-decide-write-record critical section
 * (`loadSession`/`applyCandidates`/`saveSession`) with the same
 * `acquireApplyLock` the CLI's `ingest-apply` command uses
 * (src/cli/commands/ingest.ts) — one lock implementation
 * (src/ingest/lock.ts), two entry points into the same workspace-wide
 * hazard. See that module's doc comment for why the lock is scoped to the
 * whole workspace rather than this session or anchor.
 *
 * Rejections and the next chunk's request are DELIBERATELY MUTUALLY
 * EXCLUSIVE in the returned text: when `result.issues` is non-empty, this
 * function returns ONLY the rejection report — it does not also advertise
 * the next pending anchor's extraction request in the same response. A
 * response carrying both, with nothing saying which to act on first, invites
 * the caller to move on to the next chunk while candidates are still
 * outstanding for this one; the rejected candidates would not be lost (they
 * can still be resubmitted against THIS anchor on a later call — applying
 * again after an anchor is already marked done still works, see
 * `applyCandidates`), but nothing would ever prompt the caller to actually
 * do that. Emitting one instruction per response removes the ambiguity:
 * fix-and-resubmit-against-this-anchor is always the very next thing to do
 * whenever it applies, never a parallel option alongside starting the next
 * chunk.
 */
function phaseTwo(
  ctx: MutationContext, sessionId: string, anchor: string, candidates: unknown,
): string {
  // `loadSession` throws a teaching message naming the id and the directory;
  // the registry turns a throw into the tool's error, so it is not caught here.
  const session = loadSession(ctx.root, sessionId);

  const release = acquireApplyLock(ctx.root);
  let result;
  try {
    result = applyCandidates(ctx, session, anchor, candidates);
    // Immediately after applyCandidates, not batched — see applyCandidates's
    // own doc comment (src/ingest/apply.ts): without this, a reworded
    // re-extraction of an unchanged document mints a spurious revision that
    // retires a still-current draft.
    saveSession(ctx.root, session);
  } finally {
    release();
  }

  const lines = [
    `my_context: ${session.sourceFile} § ${anchor} — created ${result.created.length}, ` +
    `deduped ${result.deduped.length}, superseded ${result.superseded.length}. ` +
    `All new items are status "draft" and govern nothing until promoted.`,
  ];
  for (const id of result.created) lines.push(`  created     ${id}`);
  for (const id of result.deduped) lines.push(`  unchanged   ${id}`);
  for (const pair of result.superseded) lines.push(`  superseded  ${pair.previous} -> ${pair.next}`);

  if (result.issues.length) {
    lines.push(
      '',
      `${result.issues.length} candidate(s) rejected — fix and resubmit ONLY these, against the SAME ` +
      `session "${session.id}" and anchor "${anchor}", before doing anything else:`,
    );
    for (const issue of result.issues) {
      lines.push(`  [${issue.index}] ${issue.title ?? '(untitled)'}: ${issue.message}`);
    }
    lines.push(
      '',
      `Do not request the next chunk yet. Call ingest_document again with session "${session.id}", ` +
      `anchor "${anchor}", and corrected candidates for just the rejected entries above.`,
    );
    return lines.join('\n');
  }

  if (pendingAnchors(session).length === 0) {
    lines.push('', `Every chunk of ${session.sourceFile} is applied. Stop calling ingest_document for this document.`);
    return lines.join('\n');
  }

  const request = nextRequest(session, ctx.config);
  if (request) lines.push('', renderExtractionRequest(request));
  return lines.join('\n');
}

/**
 * `candidates` reuses the extraction schema verbatim, so the shape advertised
 * in `tools/list` and the shape embedded in every extraction request cannot
 * drift. No `origin` field: `applyCandidates` decides that, and an argument the
 * model could set would make the trust boundary advisory.
 */
export const INGEST_DOCUMENT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Call 1 only. Repo-relative POSIX path of the document to ingest, e.g. "docs/prd/auth.md".',
    },
    session: {
      type: 'string',
      description: 'Call 2 only. The session id from the extraction request, e.g. "ING-docs-prd-auth-md-9f2a1b3c".',
    },
    anchor: {
      type: 'string',
      description: 'Call 2 only. The chunk anchor from the extraction request you are answering.',
    },
    candidates: {
      description: 'Call 2 only. The array of extracted items, matching the schema supplied in the request. Use [] when the chunk establishes nothing normative.',
      ...CANDIDATE_SCHEMA,
    },
  },
  required: [],
};

export function runIngestDocument(ctx: MutationContext, args: Record<string, unknown>): string {
  const sourcePath = typeof args.path === 'string' ? args.path : null;
  const session = typeof args.session === 'string' ? args.session : null;

  if (session) {
    const anchor = typeof args.anchor === 'string' ? args.anchor : null;
    if (!anchor) {
      throw new Error(
        'my_context: "anchor" is required alongside "session". It is the anchor named in the ' +
        'extraction request you are answering.',
      );
    }
    if (args.candidates === undefined) {
      throw new Error(
        'my_context: "candidates" is required alongside "session". Pass [] if the chunk ' +
        'establishes nothing normative.',
      );
    }
    return phaseTwo(ctx, session, anchor, args.candidates);
  }

  if (sourcePath) return phaseOne(ctx, sourcePath);

  throw new Error(
    'my_context: ingest_document takes two calls. First call it with "path" to receive an ' +
    'extraction request. Then call it again with "session", "anchor" and "candidates" to submit ' +
    'what you extracted. You passed neither "path" nor "session".',
  );
}
