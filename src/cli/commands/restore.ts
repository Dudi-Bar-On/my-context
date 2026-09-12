import path from 'node:path';

import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import { listTranscriptFiles, transcriptDir } from '../../core/conversation-index.ts';
import {
  approveStagedRestore, buildRestoreProposal, discardStagedRestore, stageRestoreSummary,
} from '../../core/restore-stage.ts';
import { readResult } from '../../core/retrieval/result.ts';
import {
  markReturn, returnReviewForm, type RulingLookup,
} from '../../core/retrieval/return.ts';
import { stageableReturn } from '../../core/retrieval/return-stage.ts';
import { Store } from '../../core/store.ts';
import { loadStagedRestore, readRestoreStagingDir } from '../../core/restore-staging.ts';
import type { SummaryOptions, SummaryRange } from '../../core/session-summary.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitJson, outputWidth, paragraph, refuseUnknownFlag, wantsJson } from './format.ts';
import { flag, hasFlag, positionals, registerCommand, type Emit } from './registry.ts';
import { confirmAction } from './review.ts';

/**
 * **`mycontext restore` — bring a summary of an earlier conversation back into
 * a window the owner is about to empty.** `plan:restore seq:2`, design of
 * record `docs/superpowers/specs/2026-09-07-session-summary-restore-design.md`
 * §3, §5 and §6.
 *
 * ── THE SEQUENCE, AND WHICH FORM IS WHICH STEP ─────────────────────────────
 *
 *     mycontext restore --build      steps 2 and 3: build, stage as PROPOSED,
 *                                    print the review form. AUTOMATIC — an
 *                                    agent may run it, it approves nothing and
 *                                    delivers nothing.
 *     mycontext restore --show       what is staged, and in what state.
 *     mycontext restore --approve K  steps 4 and 5: the OWNER's act. Re-reads
 *                                    the file off the disk, and only then says
 *                                    whether it is safe to clear.
 *     (the owner clears)             step 6. There is no command for this and
 *                                    there must not be one.
 *     (the next session start)       step 7. `core/inject.ts` delivers it, once.
 *
 * ── WHY THE SAFE-TO-CLEAR SENTENCE IS PRINTED WHERE IT IS ──────────────────
 *
 * It is printed by `--approve`, after `approveStagedRestore` has re-read the
 * staged file and compared it, byte for byte, against the artefacts this
 * command showed. The item's ordering is the whole feature: *"Step 5 must
 * complete and be verifiable on disk BEFORE the owner is told it is safe to
 * clear — 'the clear happens without the stage' is the one failure mode that
 * loses the thing this exists to save."* So the sentence rests on
 * `ApprovalResult.safeToClear` and on nothing else, and when that is false
 * this command says so in the same breath as the reason. Nothing here may
 * print an encouraging sentence about clearing on any other basis.
 *
 * ── NO SLASH COMMAND AND NO MCP TOOL, FOR `carry`'s REASON ─────────────────
 *
 * `src/plugin/parity.ts` carries both absences with their reasons.
 * `--approve` decides what the very next context window receives, out of a
 * verbatim record of an earlier conversation, and *"AND NEVER AUTOMATIC. An
 * agent may propose and may build. ONLY THE OWNER INJECTS."* is the item's own
 * sentence. `approveStagedRestore` refuses any actor but `'human'` and this
 * command passes that literal unconditionally — there is no `--agent` escape
 * hatch, exactly as `cli/commands/carry.ts` has none.
 *
 * `--build` is the half that IS automatic, and it is still on this command
 * rather than behind a tool: what it produces is a file in `.staging/`, which
 * is where this product already keeps decisions a human has not taken.
 */

const { allowed: ALLOWED, values: VALUE_FLAGS } = COMMAND_FLAGS.restore;

const USAGE = [
  'usage: mycontext restore --build [--session <file>] [--range <spec>] [--subject <text>]',
  '                        [--points <n>] [--reasoning] [--code]',
  '       mycontext restore --build --from-result <file> [--claims <1,3,7>] [--json]',
  '       mycontext restore --show [--json]',
  '       mycontext restore --approve <key> [--yes]',
  '       mycontext restore --discard <key> [--yes]',
  '',
  'Builds a summary of an earlier conversation from its own transcript, stages it',
  'to disk, and — once YOU approve it — delivers it into the next session that',
  'starts. Build first, read the numbered points, approve, THEN clear the window.',
].join('\n');

function say(out: Emit, text: string): void {
  for (const line of paragraph(text, '', outputWidth(), '  ')) out(line);
}

/**
 * `--range` in the words a person would type, into `seq:1`'s own option shape.
 *
 * `last-compaction` is spelled out rather than expressed as `-1` because that
 * is the emergency's usual shape — *everything since the window was last
 * rebuilt* — and a reader typing a negative number into a `--range` would be
 * guessing at a convention nothing told them about.
 */
function parseRange(spec: string): { range: SummaryRange } | { error: string } {
  if (spec === 'whole') return { range: { kind: 'whole' } };
  if (spec === 'last-compaction') return { range: { kind: 'compaction', nth: -1 } };
  const record = /^record:(\d+)$/.exec(spec);
  if (record) return { range: { kind: 'record', index: Number(record[1]) } };
  const compaction = /^compaction:(\d+)$/.exec(spec);
  if (compaction) return { range: { kind: 'compaction', nth: Number(compaction[1]) } };
  const at = /^since:(.+)$/.exec(spec);
  if (at) {
    const parsed = new Date(at[1]!);
    if (Number.isNaN(parsed.getTime())) {
      return { error: `"${at[1]}" is not a timestamp this can read. ISO-8601, e.g. 2026-09-07T10:00:00Z.` };
    }
    return { range: { kind: 'timestamp', at: parsed.toISOString() } };
  }
  return {
    error:
      `"${spec}" is not a range. It is one of: whole, last-compaction, compaction:<n>, ` +
      'record:<index>, since:<ISO timestamp>.',
  };
}

/**
 * The newest transcript this project has on disk, for a `--build` with no
 * `--session`.
 *
 * The repository root is DERIVED from the corpus — `ws.projectRoot` is the
 * `.my_context` directory, so its parent is the repository — rather than read
 * from `process.cwd()`. That is `cli/commands/conversation.ts`'s own
 * `workspaceCwd`, and it is the same derivation for the same measured reason:
 * its first draft took the process's cwd and, run from the repository against
 * a temp workspace, read THE DEVELOPER'S OWN transcripts. Here that would mean
 * summarising a stranger's conversation into this corpus's staging directory.
 */
function newestTranscript(root: string): string | null {
  const files = listTranscriptFiles(transcriptDir(process.env, path.dirname(root)));
  if (files.length === 0) return null;
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0]!.file;
}

/**
 * **Whether a ruling the result names still stands — read out of THIS corpus.**
 *
 * `markReturn` takes the lookup as an argument rather than opening a store
 * itself, which is `CitationResolvers`' shape in `retrieval/result.ts` and is
 * what keeps `retrieval/return.ts` free of a database handle. The read is
 * read-only and one statement wide: a corpus that cannot be opened answers
 * `null` for every id, which surfaces as *named, and not found* rather than as
 * a silent pass — `INV-nothing-is-dropped-silently`.
 */
function rulingLookup(ws: Workspace): RulingLookup {
  let byId: Map<string, { status: string; supersededBy: string | null }> | null = null;
  try {
    const store = Store.openReadOnlyChecked(ws.dbPath);
    try {
      byId = new Map(store.all().map((item) => [item.id, {
        status: item.status as string,
        supersededBy:
          item.relations.find((r) => r.type === 'superseded_by')?.target ?? null,
      }]));
    } finally { store.close(); }
  } catch {
    byId = null;
  }
  return (id: string) => {
    const row = byId?.get(id);
    return row === undefined ? null : { id, status: row.status, supersededBy: row.supersededBy };
  };
}

/** What a `--from-result` build produced, or `null` when it refused and said why. */
interface BuiltReturn {
  stage: ReturnType<typeof stageRestoreSummary>;
  reviewForm: string;
  shortfalls: string[];
  payload: string;
}

/**
 * **Read a retrieval result, mark what he chose, and stage it through D34's
 * carrier.** Spec §10a.
 *
 * The refusals are the interesting half. A result file that is not there names
 * the path it looked for; a claim number the file does not have refuses rather
 * than returning a shorter account, because the two ends disagreeing about how
 * many claims there are is exactly what a quietly-shorter answer would hide.
 * Both come out of `markReturn` and `readResult` as thrown messages, and are
 * printed rather than re-worded, so the CLI and the screen say the same thing.
 */
function buildFromResult(
  ws: Workspace, root: string, file: string, claims: string | null, out: Emit,
): BuiltReturn | null {
  let result;
  try {
    result = readResult(file);
  } catch (err) {
    out(
      `my_context: the retrieval result ${file} could not be read — `
      + `${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
  if (result.claims.length === 0) {
    out(
      `my_context: ${file} holds no claims, so there is nothing to return. A result with an `
      + 'empty `## What it found` is a subagent that found nothing, and staging it would put an '
      + 'empty record into a window you cleared to make room for it.',
    );
    return null;
  }

  let chosen: number[];
  if (claims === null) {
    chosen = result.claims.map((_claim, index) => index + 1);
  } else {
    chosen = [];
    for (const part of claims.split(',').map((piece) => piece.trim()).filter(Boolean)) {
      const n = Number(part);
      if (!Number.isInteger(n)) {
        out(`my_context: --claims takes claim numbers, and "${part}" is not one.

${USAGE}`);
        return null;
      }
      chosen.push(n);
    }
  }

  let marked;
  try {
    marked = markReturn(result, chosen, rulingLookup(ws));
  } catch (err) {
    out(`${err instanceof Error ? err.message : String(err)}`);
    return null;
  }

  const stageable = stageableReturn(marked, file);
  return {
    stage: stageRestoreSummary(root, stageable),
    reviewForm: returnReviewForm(marked, file),
    shortfalls: stageable.shortfalls,
    payload: marked.text,
  };
}

/**
 * **The build's own report, and the one sentence a reader acts on.**
 *
 * Shared by both builds — a transcript summary and a retrieval return —
 * because the thing that must not drift between them is *nothing is injected
 * yet*. Two copies of that sentence is the defect `CLAUDE.md` opens with, one
 * level down.
 */
function reportStage(
  stage: ReturnType<typeof stageRestoreSummary>,
  reviewForm: string, shortfalls: string[], payload: string, json: boolean, out: Emit,
): number {
  if (!stage.verified) {
    out(`my_context: it was built but NOT staged — ${stage.reason}`);
    say(out,
      'Do not clear your window. Nothing is on disk that a later session could read, so what '
      + 'was built exists only in this conversation.');
    return 1;
  }
  if (json) {
    emitJson(out, {
      key: stage.key, file: stage.file, verified: stage.verified, shortfalls,
      payloadBytes: Buffer.byteLength(payload, 'utf8'), reviewForm,
    });
    return 0;
  }
  out(reviewForm);
  out('');
  out(`my_context: staged as ${stage.key} (${stage.file}), and verified on disk.`);
  say(out,
    'NOTHING IS INJECTED YET, and nothing will be until you approve it: run `mycontext restore '
    + `--approve ${stage.key}\`. Read the form above first — the coverage headline says what `
    + 'this does not hold.');
  return 0;
}

function cmdRestore(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, USAGE, out)) return 1;

  const root = ws.projectRoot;
  const json = wantsJson(args);
  const build = hasFlag(args, 'build');
  const show = hasFlag(args, 'show');
  const approveKey = flag(args, 'approve');
  const discardKey = flag(args, 'discard');
  const rest = positionals(args, VALUE_FLAGS);

  const forms = [build, show, approveKey !== null, discardKey !== null].filter(Boolean).length;
  if (forms !== 1) {
    out(
      forms === 0
        ? `my_context: restore needs a form — one of --build, --show, --approve or --discard.\n\n${USAGE}`
        : `my_context: --build, --show, --approve and --discard name four different acts. Run ` +
          `one, then the next.\n${USAGE}`,
    );
    return 1;
  }
  if (rest.length > 0) {
    out(
      `my_context: restore takes no bare operand, and "${rest[0]}" was given. The key belongs to ` +
      `--approve or --discard.\n${USAGE}`,
    );
    return 1;
  }

  // ── mycontext restore --show ──────────────────────────────────────────────
  if (show) {
    const { staged, skipped } = readRestoreStagingDir(root);
    if (json) {
      emitJson(out, {
        staged: staged.map((s) => ({
          key: s.key, state: s.state, builtAt: s.builtAt, approvedAt: s.approvedAt,
          deliveredAt: s.deliveredAt, deliveredTo: s.deliveredTo,
          source: s.source, shortfalls: s.shortfalls,
          payloadBytes: Buffer.byteLength(s.payload, 'utf8'),
        })),
        skipped,
      });
      return 0;
    }
    if (staged.length === 0 && skipped.length === 0) {
      out('my_context: nothing is staged. `mycontext restore --build` builds one from a transcript.');
      return 0;
    }
    for (const s of staged) {
      out(`  ${s.key}  ${s.state.toUpperCase()}`);
      out(`    built ${s.builtAt} from ${s.source.file}`);
      out(`    ${s.source.records.toLocaleString()} records read, ${s.source.points} point(s), `
        + `${Buffer.byteLength(s.payload, 'utf8').toLocaleString()} bytes of payload`);
      out(`    coverage: ${s.shortfalls.length === 0 ? 'COMPLETE'
        : `PARTIAL — ${s.shortfalls.length} thing(s) it does not cover`}`);
      if (s.state === 'approved') {
        out(`    approved ${s.approvedAt} by ${s.approvedBy} — it will be delivered at the next `
          + 'session start, once, and then marked delivered.');
      }
      if (s.state === 'delivered') out(`    delivered ${s.deliveredAt} into ${s.deliveredTo ?? 'an unnamed session'}`);
    }
    // Never swallowed: a staged restore that cannot be read is indistinguishable
    // from one that was never staged, and the owner may be about to clear.
    for (const s of skipped) out(`  ${s.file}  COULD NOT BE READ — ${s.reason}`);
    return 0;
  }

  // ── mycontext restore --discard <key> ─────────────────────────────────────
  if (discardKey !== null) {
    let existing;
    try {
      existing = loadStagedRestore(root, discardKey);
    } catch (err) {
      // A record too corrupt to read is exactly one a person may want gone, so
      // the discard is offered rather than refused — it is the one act that is
      // safe on a file nothing can trust.
      say(out, `\`${discardKey}\` cannot be read (${err instanceof Error ? err.message : String(err)}).`);
      existing = null;
    }
    if (!hasFlag(args, 'yes') && !json && existing !== null) {
      say(out,
        `about to withdraw the staged restore ${discardKey} (${existing.state}, ` +
        `${Buffer.byteLength(existing.payload, 'utf8').toLocaleString()} bytes). It will not be ` +
        'delivered to any session, and the summary it holds is not recoverable from anywhere ' +
        'else — the transcript it was built from still is.');
    }
    if (!confirmAction(args, out, `Discard the staged restore ${discardKey}?`)) return 1;
    const { removed } = discardStagedRestore(root, discardKey);
    out(removed
      ? `my_context: ${discardKey} discarded.`
      : `my_context: ${discardKey} could not be removed.`);
    return removed ? 0 : 1;
  }

  // ── mycontext restore --approve <key> ─────────────────────────────────────
  if (approveKey !== null) {
    let record;
    try {
      record = loadStagedRestore(root, approveKey);
    } catch (err) {
      out(`my_context: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }
    if (record === null) {
      out(
        `my_context: nothing is staged under "${approveKey}". \`mycontext restore --show\` lists ` +
        'what is waiting.',
      );
      return 1;
    }

    // The form is printed BEFORE the confirmation, every time: design §5 says
    // he approves against a readable statement of what will happen, and this
    // is that statement. The payload is deliberately not printed — it is what
    // the form is short for.
    if (!hasFlag(args, 'yes') && !json) {
      out(record.reviewForm);
      out('');
      say(out,
        `about to approve ${record.key} for delivery at the next session start. Nothing is ` +
        'injected by this command: the summary is already on disk, and approving it is what ' +
        'lets the NEXT session read it. Approve first, then clear your window — in that order, ' +
        'because a clear destroys everything held only in this conversation.');
    }
    if (!confirmAction(args, out, `Approve ${record.key} for delivery at the next session start?`)) {
      return 1;
    }

    const result = approveStagedRestore(root, approveKey, 'human', record);
    if (!result.safeToClear) {
      out(`my_context: NOT SAFE TO CLEAR — ${result.reason}`);
      say(out,
        'Do not clear this window. What is on disk is not what you were shown, so clearing now ' +
        'would lose the summary rather than restore it. Build again with `mycontext restore ' +
        '--build`.');
      return 1;
    }
    out(`my_context: ${approveKey} approved and verified on disk (`
      + `${result.verification.payloadBytes.toLocaleString()} bytes re-read).`);
    say(out,
      'IT IS SAFE TO CLEAR. The summary is a file now, so it survives the clear; the next ' +
      'session that starts in this project receives it once, and the record is then marked ' +
      'delivered.');
    return 0;
  }

  // ── mycontext restore --build --from-result <file> ────────────────────────
  //
  // **The second destination, spec §10a, owner ruling 2026-09-11.** A
  // retrieval result is a payload of the same shape a session summary is, so
  // it rides THIS carrier rather than growing one beside it. Everything below
  // the stage is untouched and is reached by the same three forms a person
  // already knows: `--show`, `--approve`, and his own clear.
  const fromResult = flag(args, 'from-result');
  if (fromResult !== null) {
    const claims = flag(args, 'claims');
    const staged = buildFromResult(ws, root, fromResult, claims, out);
    if (staged === null) return 1;
    return reportStage(staged.stage, staged.reviewForm, staged.shortfalls,
      staged.payload, json, out);
  }
  if (flag(args, 'claims') !== null) {
    out(
      'my_context: --claims picks claims out of a RETRIEVAL RESULT and means nothing on its '
      + `own. Name the result with --from-result <file>.

${USAGE}`,
    );
    return 1;
  }

  // ── mycontext restore --build ─────────────────────────────────────────────
  const session = flag(args, 'session') ?? newestTranscript(root);
  if (session === null) {
    out(
      'my_context: no transcript found for this project, so there is nothing to summarise. ' +
      `Name one with --session <file>.\n\n${USAGE}`,
    );
    return 1;
  }

  const options: SummaryOptions = {};
  const rangeSpec = flag(args, 'range');
  if (rangeSpec !== null) {
    const parsed = parseRange(rangeSpec);
    if ('error' in parsed) {
      out(`my_context: ${parsed.error}\n\n${USAGE}`);
      return 1;
    }
    options.range = parsed.range;
  }
  const subject = flag(args, 'subject');
  if (subject !== null) options.subjects = subject.split(',').map((s) => s.trim()).filter(Boolean);
  const points = flag(args, 'points');
  if (points !== null) {
    const n = Number(points);
    if (!Number.isInteger(n) || n <= 0) {
      out(`my_context: --points takes a whole number above zero, and "${points}" was given.`);
      return 1;
    }
    options.maxPoints = n;
  }
  if (hasFlag(args, 'reasoning')) options.depth = 'points+reasoning';
  if (hasFlag(args, 'code')) options.includeCode = true;

  let proposal;
  try {
    proposal = buildRestoreProposal(session, options);
  } catch (err) {
    out(`my_context: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  const staged = stageRestoreSummary(root, proposal);
  if (!staged.verified) {
    out(`my_context: the summary was built but NOT staged — ${staged.reason}`);
    say(out,
      'Do not clear your window. Nothing is on disk that a later session could read, so the ' +
      'summary exists only in this conversation.');
    return 1;
  }

  if (json) {
    emitJson(out, {
      key: staged.key, file: staged.file, verified: staged.verified,
      shortfalls: proposal.shortfalls,
      payloadBytes: Buffer.byteLength(proposal.payload, 'utf8'),
      reviewForm: proposal.reviewForm,
    });
    return 0;
  }

  out(proposal.reviewForm);
  out('');
  out(`my_context: staged as ${staged.key} (${staged.file}), and verified on disk.`);
  say(out,
    'NOTHING IS INJECTED YET, and nothing will be until you approve it: run `mycontext restore ' +
    `--approve ${staged.key}\`. Read the numbered points above first — the coverage headline ` +
    'says what this summary does not hold.');
  return 0;
}

registerCommand({
  name: 'restore',
  usage: 'restore --build|--show|--approve <key>|--discard <key>',
  summary: 'summarise an earlier conversation, stage it to disk, and deliver it after you clear',
  run: cmdRestore,
});
