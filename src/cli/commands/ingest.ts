import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import { relPosix, toPosix } from '../../core/paths.ts';
import { applyCandidates } from '../../ingest/apply.ts';
import { acquireApplyLock } from '../../ingest/lock.ts';
import { buildExtractionRequest, nextRequest, renderExtractionRequest } from '../../ingest/request.ts';
import {
  listSessions, loadSession, openIngestSession, pendingAnchors, rejectionsForAnchor, saveSession,
} from '../../ingest/session.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, readPayload, toCliMessage } from './context.ts';
import {
  DETAIL_USAGE, detailLevel, emitJson, refuseUnknownFlag, table, wantsJson,
  type Detail,
} from './format.ts';
import { flag, hasFlag, positionals, registerCommand, type Emit } from './registry.ts';

/**
 * This command's flag surface, LIFTED to `core/command-flags.ts` so a read
 * surface can have it without reaching a module that writes. Nothing about
 * what is accepted changed; the reasoning is in that module's header.
 */
const INGEST_STATUS = COMMAND_FLAGS['ingest-status'];

/** The repo root is the parent of `.my_context`. Source paths are relative to it. */
function repoRoot(ws: Workspace): string {
  return path.dirname(ws.projectRoot as string);
}

function requireWorkspace(ws: Workspace, out: Emit): boolean {
  if (ws.projectRoot) return true;
  out('my_context: no workspace here. Run `mycontext init` to create one.');
  return false;
}

// The ingest-apply lock itself (`acquireApplyLock`) lives in
// `src/ingest/lock.ts`, shared verbatim with the MCP `ingest_document`
// tool's second phase (src/mcp/tools/ingest.ts) — see that module's doc
// comment for the hazard it closes and why the lock is workspace-scoped, not
// per-session or per-anchor.

function cmdIngest(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;

  const [target] = positionals(args, ['anchor']);
  if (!target) {
    out('usage: mycontext ingest <path> [--anchor <anchor>]');
    return 1;
  }

  const repo = repoRoot(ws);
  const absolute = path.resolve(repo, toPosix(target));
  let stat;
  try {
    stat = statSync(absolute);
  } catch (err) {
    // ENOENT — genuinely absent — gets the friendly, expected message.
    // Anything else (EACCES, ELOOP from a symlink cycle, ...) is a REAL
    // problem this process could not even inspect, and "no such file" would
    // be actively misleading — it implies "create it and retry", which does
    // not fix a permissions or symlink problem.
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      out(`my_context: no such file "${toPosix(target)}" (looked in ${repo}).`);
    } else {
      out(toCliMessage(err));
    }
    return 1;
  }
  if (!stat.isFile()) {
    out(`my_context: "${toPosix(target)}" is not a file (looked in ${repo}).`);
    return 1;
  }

  // `CommandFn`'s contract (registry.ts) is "never throws" — everything past
  // the file check above (session bookkeeping, a bad file encoding, a
  // permissions error on the write side) is caught here rather than left to
  // propagate, so a command bug never surfaces as a raw stack trace.
  try {
    const rel = relPosix(repo, absolute);
    const session = openIngestSession(ws.projectRoot as string, rel, readFileSync(absolute, 'utf8'));
    saveSession(ws.projectRoot as string, session);

    const anchor = flag(args, 'anchor');
    if (anchor) {
      const chunk = session.chunks.find((c) => c.anchor === anchor);
      if (!chunk) {
        out(
          `my_context: session ${session.id} has no chunk "${anchor}". ` +
          `Known anchors: ${session.chunks.map((c) => c.anchor).join(', ')}.`,
        );
        return 1;
      }
      out(renderExtractionRequest(buildExtractionRequest(session, chunk, ws.config)));
      return 0;
    }

    const request = nextRequest(session, ws.config);
    if (!request) {
      out(
        `my_context: session ${session.id} for ${rel} has every chunk applied ` +
        `(${session.chunks.length}/${session.chunks.length}). ` +
        `Review what it produced with \`mycontext review\`.`,
      );
      return 0;
    }

    out(renderExtractionRequest(request));
    return 0;
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }
}

function cmdIngestApply(ws: Workspace, args: string[], out: Emit, cwd: string): number {
  if (!requireWorkspace(ws, out)) return 1;

  const [id] = positionals(args, ['anchor', 'file']);
  const anchor = flag(args, 'anchor');
  const usage = 'usage: mycontext ingest-apply <session-id> --anchor <anchor> (--file <path> | --stdin)';
  if (!id || !anchor) {
    out(usage);
    return 1;
  }
  // `readPayload` (context.ts) reads fd 0 whenever `--file` is absent — with
  // NEITHER flag given, that blocks forever on an interactive terminal
  // instead of ever reaching a usage message. Required explicitly here,
  // rather than left implicit in readPayload, so a plain `mycontext
  // ingest-apply <id> --anchor <a>` fails fast with usage instead of hanging.
  if (!flag(args, 'file') && !hasFlag(args, 'stdin')) {
    out(usage);
    return 1;
  }

  const root = ws.projectRoot as string;
  let payload: unknown;
  let session;
  try {
    session = loadSession(root, id);
    payload = readPayload(args, cwd);
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }

  // Serialize the whole workspace — see the module-level comment above
  // `acquireApplyLock` for why per-anchor is not enough and the hazard this
  // closes.
  let release: () => void;
  try {
    release = acquireApplyLock(root);
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }

  // `CommandFn`'s contract (registry.ts) is "never throws" — this outer
  // try/catch makes that true here too, rather than relying on `runCli`'s
  // top-level catch to convert an escaped exception (e.g. `openMutateContext`
  // throwing before `errors` even exists) into a message.
  try {
    const { ctx, errors } = openMutateContext(ws);
    try {
      const result = applyCandidates(ctx, session, anchor, payload);
      // Immediately after applyCandidates, not batched — see applyCandidates'
      // own doc comment (src/ingest/apply.ts). Not merely for crash
      // durability: without this, a reworded re-extraction of an unchanged
      // document (the normal case for a non-deterministic LLM) takes the
      // supersede branch on a LATER call and mints a spurious revision that
      // retires a still-current draft, because the caller had no on-disk
      // record yet that this exact chunk had already been applied.
      saveSession(root, session);

      out(
        `my_context: ${anchor} — created ${result.created.length}, ` +
        `deduped ${result.deduped.length}, superseded ${result.superseded.length}.`,
      );
      for (const created of result.created) out(`  created     ${created}`);
      for (const deduped of result.deduped) out(`  unchanged   ${deduped}`);
      for (const pair of result.superseded) out(`  superseded  ${pair.previous} -> ${pair.next}`);

      // I-4: this block and the MCP `ingest_document` tool's `phaseTwo`
      // (src/mcp/tools/ingest.ts) must teach the SAME next action for the
      // same event — a rejection. The two used to differ only in whether
      // the next chunk's request appeared alongside the rejection report,
      // which was already the wrong kind of difference; measured directly,
      // they differed WORSE than that: this command's old wording ("every
      // valid sibling above was still written") reads as terminal, then
      // immediately printed ~40 lines instructing the agent to call
      // `ingest_document`/`ingest-apply` for the NEXT anchor — actively
      // steering away from the rejects instead of towards fixing them. Gating
      // the next-chunk request on `result.issues.length === 0`, the same
      // condition `phaseTwo` gates on, is what makes "fix and resubmit
      // against THIS anchor" the one next action on both surfaces whenever
      // there is anything to fix.
      if (result.issues.length) {
        out('');
        const noun = result.issues.length === 1 ? 'candidate' : 'candidates';
        out(
          `${result.issues.length} ${noun} rejected — fix and resubmit ONLY these, against the SAME ` +
          `session ${session.id} and anchor ${anchor}, before doing anything else:`,
        );
        for (const issue of result.issues) {
          out(`  [${issue.index}] ${issue.title ?? '(untitled)'}: ${issue.message}`);
        }
        out('');
        out(
          `Do not request the next chunk yet. Run \`mycontext ingest-apply ${session.id} --anchor ${anchor}\` ` +
          `again with corrected candidates for just the rejected entries above.`,
        );
      } else {
        const remaining = pendingAnchors(session);
        out('');
        if (remaining.length === 0) {
          out(
            `my_context: every chunk of ${session.sourceFile} is applied. ` +
            `Promote what you want with \`mycontext review\`.`,
          );
        } else {
          const request = nextRequest(session, ws.config);
          if (request) out(renderExtractionRequest(request));
        }
      }
      // F2 (see the comment in cmdAdd, src/cli/index.ts): ingest-apply did
      // what it was asked — it applied the candidates it could and reported
      // exactly what happened to the rest — so an UNRELATED load error
      // elsewhere in the corpus is a warning, not a failure. Only `status`
      // and `doctor` exit non-zero on one; every command in this plan that
      // did its job, including this one, exits 0.
      emitLoadErrors(errors, out);
      return 0;
    } catch (err) {
      out(toCliMessage(err));
      return 1;
    } finally {
      ctx.store.close();
    }
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  } finally {
    release();
  }
}

function cmdIngestStatus(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;

  // See `unknownFlag` (format.ts). This one is only a reporting command, so
  // the detail flags are its whole surface.
  if (refuseUnknownFlag(
    args, INGEST_STATUS.allowed, INGEST_STATUS.values,
    `usage: mycontext ingest-status ${DETAIL_USAGE}`, out,
  )) return 1;

  let detail: Detail;
  let json: boolean;
  try {
    detail = detailLevel(args);
    json = wantsJson(args);
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }

  const sessions = listSessions(ws.projectRoot as string);

  // An ingest session is genuinely hierarchical — a row per session, a list of
  // anchors under it, each either applied or pending — so `--json` is the only
  // faithful rendering and `--full` is the closest the text table gets.
  if (json) {
    emitJson(out, sessions.map((session) => ({
      id: session.id,
      sourceFile: session.sourceFile,
      chunks: session.chunks.length,
      applied: session.chunks.length - pendingAnchors(session).length,
      rejected: session.rejected.length,
      anchors: session.chunks.map((chunk) => ({
        anchor: chunk.anchor,
        applied: !pendingAnchors(session).includes(chunk.anchor),
        // Durable per-anchor rejections. Without these, a MIXED batch — some
        // candidates written, some refused — reported `applied: true` and
        // nothing anywhere said anything had been refused, so the only record
        // was the transcript of the call that did it.
        rejected: rejectionsForAnchor(session, chunk.anchor).map((r) => ({
          index: r.index, title: r.title ?? null, message: r.message, at: r.at,
        })),
      })),
    })));
    return 0;
  }

  if (sessions.length === 0) {
    out('my_context: no ingest sessions. Start one with `mycontext ingest <path>`.');
    return 0;
  }

  const rejectedTotal = sessions.reduce((n, s) => n + s.rejected.length, 0);

  if (detail === 'summary') {
    const unfinished = sessions.filter((s) => pendingAnchors(s).length > 0).length;
    // The rejection count rides on `--summary` too. A shorter report may drop
    // rows; it must never drop the fact that candidates were refused, or
    // `--summary` becomes the level at which the corpus looks complete.
    const refused = rejectedTotal
      ? ` ${rejectedTotal} candidate(s) rejected — see \`mycontext ingest-status --full\`.`
      : '';
    out(`my_context: ${sessions.length} ingest session(s), ${unfinished} unfinished.${refused}`);
    return 0;
  }

  for (const line of table(
    ['session', 'source', 'applied', 'rejected'],
    sessions.map((s) => [
      s.id, s.sourceFile,
      `${s.chunks.length - pendingAnchors(s).length}/${s.chunks.length}`,
      String(s.rejected.length),
    ]),
  )) out(line);

  if (rejectedTotal && detail !== 'full') {
    out('');
    out(
      `${rejectedTotal} candidate(s) were rejected and not written. ` +
      `\`mycontext ingest-status --full\` names them.`,
    );
  }

  if (detail === 'full') {
    for (const session of sessions) {
      const pending = pendingAnchors(session);
      out('');
      out(`${session.id}  ${session.sourceFile}`);
      for (const chunk of session.chunks) {
        out(`  ${pending.includes(chunk.anchor) ? 'pending' : 'applied'}  ${chunk.anchor}`);
        // Printed under the anchor they belong to, because "applied" and
        // "something here was refused" are both true of a mixed batch and the
        // anchor line alone cannot say the second. An anchor can be `applied`
        // and still carry rejections — that is the case this exists for.
        for (const r of rejectionsForAnchor(session, chunk.anchor)) {
          const which = r.index >= 0 ? `candidate ${r.index}` : 'batch';
          out(`    rejected  ${which}${r.title ? ` "${r.title}"` : ''}: ${r.message}`);
        }
      }
    }
  }
  return 0;
}

registerCommand({
  name: 'ingest',
  usage: 'ingest <path>',
  summary: 'emit an extraction request for a document (you are the extractor)',
  run: cmdIngest,
});

registerCommand({
  name: 'ingest-apply',
  usage: 'ingest-apply <id> --anchor <a>',
  summary: 'apply extracted candidates as drafts',
  run: cmdIngestApply,
});

registerCommand({
  name: 'ingest-status',
  usage: `ingest-status ${DETAIL_USAGE}`,
  summary: 'list ingest sessions and their progress',
  run: cmdIngestStatus,
});
