import path from 'node:path';
import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import { computeDecay } from '../../core/decay.ts';
import { Ledger, type Usage } from '../../core/ledger.ts';
import { topUpLedger } from '../../core/ledger-replay.ts';
import type { MutationContext } from '../../core/mutate.ts';
import type { Item } from '../../core/types.ts';
import { VERSION } from '../../core/version.ts';
import type { Workspace } from '../../core/workspace.ts';
import { runChecks } from '../../doctor/checks.ts';
import { listSessions, pendingAnchors } from '../../ingest/session.ts';
import { listStaging } from '../../lesson/derive.ts';
import { summarize } from './doctor.ts';
import type { PendingRevision } from '../../core/revision.ts';
import {
  drafts, pendingRevisionCounts, pendingRevisionLine, revisionQueue,
} from './review.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import {
  DETAIL_USAGE, detailLevel, emitJson, paragraph, refuseUnknownFlag, table,
  wantsJson, type Detail,
} from './format.ts';
import { registerCommand, type Emit } from './registry.ts';

/**
 * This command's flag surface, LIFTED to `core/command-flags.ts` so a read
 * surface can have it without reaching a module that writes. Nothing about
 * what is accepted changed; the reasoning is in that module's header.
 */
const { allowed: ALLOWED, values: VALUE_FLAGS } = COMMAND_FLAGS.status;

const DECAY_WINDOW = 20;

/**
 * `out` for a sentence rather than for a line: wrapped to the layout budget,
 * with `prefix` on every line rather than only the first.
 *
 * This report is mostly prose — hedges, notes and the reasons a number might
 * mislead — and each piece of it was one `out` call however long the sentence
 * came out. The `usage:` line ran to 178 characters against this repo's own
 * corpus, so the terminal rewrapped it at its own width with no indent, which
 * is how a hedge ends up looking like the start of the next section.
 */
function say(out: Emit, text: string, prefix = ''): void {
  for (const line of paragraph(text, prefix)) out(line);
}

/**
 * The one sentence `--json` must carry alongside the cold count, for the same
 * reason the text report carries it: the ledger records INJECTION, not USE, so
 * a consumer ranking items by "cold" is reading a number that cannot tell a
 * brand-new item from an abandoned one. See `mycontext decay` for the full
 * report and its own hedging language.
 */
const USAGE_CAVEAT =
  'cold means not auto-injected in the window — the ledger records injection, not reading or ' +
  'reliance, so a new item and an item read via `show` or `get_item` look identical here.';

function tally(items: Item[], key: (i: Item) => string): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts].sort((a, b) => a[0].localeCompare(b[0]));
}

/**
 * The review queue, exactly as `mycontext review` itself defines it —
 * project-layer drafts only. Delegates to `drafts` (review.ts), which in turn
 * delegates to `core/select`'s `reviewQueue`, instead of re-deriving the
 * filter: a merged project+global corpus otherwise makes `status` count a
 * global-layer draft that the queue deliberately excludes (a global draft can
 * never be promoted or discarded from this project), so the two commands would
 * disagree about the very queue `status` points the user at. Exported so its
 * correctness can be pinned directly with `sandbox()` in tests, without
 * writing under the real `~/.my-context`.
 */
export function reviewQueueDrafts(ctx: MutationContext): Item[] {
  return drafts(ctx, null);
}

interface LedgerView {
  usage: Usage[];
  recentlyUsed: string[];
  sessionsRecorded: number;
}

/** A report must never crash on a ledger Plan 2 has not populated yet. */
function readLedger(root: string, dbPath: string): LedgerView {
  let ledger: Ledger | null = null;
  try {
    ledger = Ledger.open(dbPath);
    // The ledger is a projection of the audit log (see ledger-replay.ts);
    // hooks stopped writing it directly, so aggregate readers catch it up
    // first. Best-effort: an unreadable log must not take down status — the
    // answer is then computed from the projection as-is, which is the
    // pre-existing behaviour. Know what that degradation looks like: an
    // unreadable audit TREE is indistinguishable from an empty log
    // (`auditSegments` swallows the readdir error), so this catch rarely
    // even fires — the top-up quietly applies nothing and the report
    // under-counts. NOTHING surfaces that today; no doctor check exists
    // for audit-log readability (review I-2 corrected an earlier claim
    // here that one did).
    try { topUpLedger(root, ledger); } catch { /* aggregate from what is there */ }
    const recent = ledger.recentSessions(DECAY_WINDOW);
    return {
      usage: ledger.allUsage(),
      recentlyUsed: ledger.itemsUsedIn(recent),
      sessionsRecorded: ledger.sessionCount(),
    };
  } catch {
    return { usage: [], recentlyUsed: [], sessionsRecorded: 0 };
  } finally {
    try { ledger?.close(); } catch { /* nothing to close */ }
  }
}

function cmdStatus(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  // Refused before any work is done — see `unknownFlag` (format.ts).
  // `mycontext status --ful` used to print the whole default report and exit
  // 0, which is the wrong report delivered confidently.
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, `usage: mycontext status ${DETAIL_USAGE}`, out)) {
    return 1;
  }

  let detail: Detail;
  let json: boolean;
  try {
    detail = detailLevel(args);
    json = wantsJson(args);
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }

  const { ctx, errors } = openMutateContext(ws);
  let items: Item[];
  let queue: Item[];
  let revisions: PendingRevision[];
  try {
    items = ctx.store.all();
    queue = reviewQueueDrafts(ctx);
    // Read here, while the context is still open, and through `review`'s own
    // accessor rather than a second call to the store — the same delegation
    // and the same reason as `reviewQueueDrafts` above. A revision log that
    // cannot be read THROWS (see `readLog`); reporting "no revisions pending"
    // for a log this command failed to read would hide every proposal in the
    // workspace behind a health report, which is the one report that must not
    // do that.
    revisions = revisionQueue(ctx);
  } catch (err) {
    ctx.store.close();
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }

  // Close the writable connection now, BEFORE `runChecks`' own
  // `checkIndexFreshness` (which stats `ws.dbPath`'s mtime) and before the
  // ledger read below re-opens the same file. SQLite (WAL mode) only
  // checkpoints its write-ahead log back into the main database file on
  // close, so on the very first `status` run after an item was edited
  // on disk, checking the file's mtime through a connection that is STILL
  // OPEN sees only the last checkpoint — before this invocation's own
  // rebuild — and wrongly reports the index as stale, a staleness that
  // running `doctor` immediately after (as the health line's own text
  // suggests) will not reproduce, because doctor's second, fresh open sees
  // the checkpoint this close performs. Same ordering `cmdQuery` already
  // relies on (see its comment on why closing the writer first matters).
  ctx.store.close();

  const queueCount = queue.length;
  // The `by status` tally below is a RAW corpus tally (every item this project
  // can see, both layers), while the review queue is project-layer drafts
  // only. Both numbers are correct and they answer different questions, but a
  // reader who sees `draft 6` above `review queue: 5 draft(s) pending` has no
  // way to tell that from a bug — so the difference is named rather than left
  // to be inferred. Kept as an annotation, NOT reconciled by filtering the
  // tally: the tally's job is to say what is in the corpus, and hiding a
  // global-layer draft from it would make the drafts disappear from every
  // surface at once.
  const globalLayerDrafts = items.filter((i) => i.status === 'draft').length - queueCount;
  // `always` is the field with the largest injection footprint — it puts an
  // item in the pinned tier, injected in full at every session start
  // regardless of scope — and a draft can already carry it (nothing stops an
  // agent setting it on its own draft; `guardedChange` in core/trust.ts only fires
  // for items that already govern, and a draft governs nothing). So the count
  // is surfaced here, where the human is being pointed at the queue.
  const alwaysInQueue = queue.filter((i) => i.always).length;

  try {
    const sessions = listSessions(ws.projectRoot).filter((s) => pendingAnchors(s).length > 0);
    const pendingRules = listStaging(ws.projectRoot)
      .flatMap((s) => s.candidates.filter((c) => c.state === 'pending').map((c) => ({ lesson: s.lessonId, candidate: c })));

    // The ledger records INJECTION, not USE — a new item that has simply
    // never come up in the last DECAY_WINDOW sessions looks identical here
    // to one an engineer actively read and decided not to act on. "cold"
    // below is deliberately not phrased as a superseding recommendation; see
    // `mycontext decay` for the full report and its own hedging language.
    const ledger = readLedger(ws.projectRoot, ws.dbPath);
    const decay = computeDecay({
      items, config: ws.config,
      usage: ledger.usage,
      recentlyUsed: ledger.recentlyUsed,
      window: DECAY_WINDOW,
      sessionsRecorded: ledger.sessionsRecorded,
    });

    const findings = runChecks({
      root: ws.projectRoot,
      repoRoot: path.dirname(ws.projectRoot),
      dbPath: ws.dbPath,
      items,
      config: ws.config,
    });
    const counts = summarize(findings);

    if (json) {
      // Load errors are a FIELD of the document, not a trailing text line:
      // `--json` exists to be piped, and per F2/INV-nothing-is-dropped-
      // silently they must still be reported — carrying them inside the
      // document does both, where a trailing text line after the JSON does
      // the second at the cost of the first. Every `--json` reporting surface
      // spells it this way; `test/cli/json-load-errors.test.ts` holds them to
      // it. `errors.length ? 1 : 0` below is unchanged, so a script may also
      // just read the exit code.
      emitJson(out, {
        // First field, and present at every detail level: it is the one thing
        // in this document that describes the PROGRAM rather than the corpus,
        // and the thing a bug report is worthless without. `status` is the
        // command that already answers "what is going on here", so it is where
        // "and what am I running" belongs — rather than a `--version` flag,
        // which would be a twelfth surface to document and refuse flags on.
        version: VERSION,
        profile: ws.config.profile,
        items: {
          total: items.length,
          byCategory: Object.fromEntries(tally(items, (i) => i.type)),
          byStatus: Object.fromEntries(tally(items, (i) => i.status)),
          byOrigin: Object.fromEntries(tally(items, (i) => i.origin)),
        },
        // `drafts` here is the QUEUE (project layer only) and will differ from
        // `items.byStatus.draft` (raw, both layers) by exactly
        // `globalLayerDrafts` — spelled out as its own field so a script does
        // not have to guess why the two disagree. `always` is the subset of
        // the queue that would be pinned into every session start on promotion.
        reviewQueue: { drafts: queueCount, always: alwaysInQueue, globalLayerDrafts },
        // The SECOND queue this command points at, counted in the one spelling
        // `review` uses (`pendingRevisionCounts` in core/revision.ts): revisions, not
        // items carrying one, with the item count beside it because an item
        // can carry more than one and a lone number cannot say which it is.
        // Same key and same shape in `review list --json` and
        // `review revisions --json`; a script reading one reads all three.
        pendingRevisions: pendingRevisionCounts(revisions),
        // Hierarchical, and this is the surface where it survives: a session
        // holds per-anchor progress that no flat column can carry.
        //
        // `unfinishedIngest`, not `ingest`: this array is filtered to sessions
        // with pending anchors (see `sessions` above), while `ingest-status
        // --json` emits every session. Two documents using one key name for
        // two different populations is a silent-wrongness trap — a consumer
        // reading `ingest` here would under-report and never know. The name
        // carries the filter, so it cannot be missed the way a sibling
        // `filter: "unfinished"` field can. The text report already says
        // "unfinished session(s)" in words; this is the same statement, made
        // in the surface that is actually parsed.
        unfinishedIngest: sessions.map((s) => ({
          id: s.id,
          sourceFile: s.sourceFile,
          chunks: s.chunks.length,
          applied: s.chunks.length - pendingAnchors(s).length,
          pendingAnchors: pendingAnchors(s),
        })),
        stagedRules: pendingRules.map((e) => ({
          lesson: e.lesson, key: e.candidate.key, title: e.candidate.candidate.title,
        })),
        usage: {
          sessionsRecorded: ledger.sessionsRecorded,
          window: DECAY_WINDOW,
          cold: decay.cold.length,
          // Overlaps `cold` — a breadth view, not a bucket. See
          // `DecayReport.unrestricted`.
          unrestricted: decay.unrestricted.length,
          caveat: USAGE_CAVEAT,
        },
        health: counts,
        // `health` is the FINDINGS tally and nothing else, which is not what
        // this command's exit code is derived from — that is `loadErrorCount`
        // alone (see the note by the text `health:` line below). A document
        // saying `health.errors: 0` beside `exitCode: 1` is the same
        // read-clean-next-to-a-failure trap `doctor --json` was fixed for, so
        // the number the exit code actually comes from travels beside it and
        // the mapping is reported rather than left to be re-derived:
        // `exitCode === 1` iff `loadErrorCount > 0`.
        loadErrorCount: errors.length,
        exitCode: errors.length ? 1 : 0,
        loadErrors: errors.map((e) => ({ file: e.file, message: e.message })),
      });
      return errors.length ? 1 : 0;
    }

    // The version rides on the headline rather than getting a line of its own:
    // `--summary` drops rows, and a user asked "what are you running?" must be
    // able to answer from the shortest report this command has. See the note on
    // the `version` field in the `--json` document above.
    out(`my_context ${VERSION}: ${items.length} item(s), profile "${ws.config.profile}"`);

    if (detail !== 'summary') {
      for (const [heading, key] of [
        ['by category', (i: Item) => i.type],
        ['by status', (i: Item) => i.status],
        ['by origin', (i: Item) => i.origin],
      ] as const) {
        out('');
        out(heading);
        for (const row of table(
          [heading.replace('by ', ''), 'items'],
          tally(items, key).map(([name, n]) => [name, String(n)]),
          { indent: '  ' },
        )) out(row);
      }
    }

    out('');
    say(out, `review queue: ${queueCount} draft(s) pending review — walk it with \`mycontext review\`.`);
    if (globalLayerDrafts > 0) {
      say(out, (
        `${globalLayerDrafts} further draft(s) are in the global layer and are NOT in this queue — ` +
        'they cannot be promoted or discarded from this project. ' +
        (detail === 'summary'
          ? ''
          : `The "by status" tally above counts all ${queueCount + globalLayerDrafts}.`)
      ).trimEnd(), '  ');
    }
    if (alwaysInQueue > 0) {
      say(
        out,
        `${alwaysInQueue} of them carry \`always: true\` — promoting one pins it into every ` +
        'session start, in full, regardless of scope.',
        '  ',
      );
    }

    // The second review queue, in `review`'s own sentence rather than a
    // wording of this command's own — `status` and `review` disagreeing about
    // a queue length is a defect that shipped five times in one plan, and the
    // only structural defence is that neither of them owns the sentence.
    // Printed at every detail level, `--summary` included, for the same reason
    // the draft queue is: a shorter report may drop rows, never a queue.
    if (revisions.length > 0) {
      out('');
      say(out, pendingRevisionLine(revisions));
    }

    if (sessions.length) {
      out('');
      say(out, `ingest: ${sessions.length} unfinished session(s) — continue with \`mycontext ingest <path>\`.`);
      if (detail !== 'summary') {
        for (const row of table(
          ['source', 'applied', 'session'],
          sessions.map((s) => [
            s.sourceFile, `${s.chunks.length - pendingAnchors(s).length}/${s.chunks.length}`, s.id,
          ]),
          { indent: '  ' },
        )) out(row);
        // Per-anchor detail is a level below the row it belongs to; only
        // `--full` (or `--json`) shows it, because a flat table cannot.
        if (detail === 'full') {
          for (const session of sessions) {
            say(out, `${session.id} pending: ${pendingAnchors(session).join(', ')}`, '  ');
          }
        }
      }
    }

    if (pendingRules.length) {
      out('');
      say(
        out,
        `${pendingRules.length} rule candidate(s) awaiting approval. ` +
        `Nothing generated is active until you accept it — \`mycontext lesson-accept <lesson> <key>\`.`,
      );
      if (detail !== 'summary') {
        for (const row of table(
          ['key', 'lesson', 'title'],
          pendingRules.map((e) => [e.candidate.key, e.lesson, e.candidate.candidate.title]),
          { indent: '  ' },
        )) out(row);
      }
    }

    out('');
    say(
      out,
      ledger.sessionsRecorded === 0
        ? 'usage: no sessions recorded yet — decay reporting starts once items begin to be injected.'
        : `usage: ${ledger.sessionsRecorded} session(s) recorded. ` +
          `${decay.cold.length} normative item(s) not injected in the last ${DECAY_WINDOW} session(s) ` +
          `— not evidence they are unused, only that they were not selected. See \`mycontext decay\`.`,
    );
    // Same hedge `mycontext decay` itself prints, and for the same reason:
    // "the last 20 sessions" means nothing on a ledger that has only
    // recorded a handful — a brand-new item is indistinguishable from an
    // abandoned one until the window has actually filled up. Printed at every
    // detail level, `--summary` included: a shorter report may drop rows,
    // never the reason its own headline number might mislead.
    if (ledger.sessionsRecorded > 0 && ledger.sessionsRecorded < DECAY_WINDOW) {
      say(out, `(only ${ledger.sessionsRecorded} session(s) recorded so far, so "cold" mostly means "new")`, '  ');
    }
    // A cost line, not a finding. Scope is a restriction, so an item with none
    // applies to every file — it is the most injected kind of item there is,
    // not an unreachable one. This line used to say the opposite.
    if (decay.unrestricted.length) {
      say(out, `${decay.unrestricted.length} active normative item(s) carry no scope, so they apply ` +
        `to every file and compete for the jit budget on every file operation.`, '  ');
    }
    // Rows only when the ledger has something to say. Found by running this
    // against this repo's own corpus: with an EMPTY ledger, `--full` printed
    // "no sessions recorded yet" and then 25 rows of "cold id" directly
    // underneath — every scoped item, listed as if it had decayed, one line
    // after the report said it had measured nothing. That is Task 13's defect
    // (a list that reads as a recommendation the data cannot support) and
    // Task 15's (a number asserted over a ledger that does not hold it), in
    // the section that was supposed to have learned from both.
    if (detail === 'full' && decay.cold.length) {
      out('');
      if (ledger.sessionsRecorded === 0) {
        say(
          out,
          // "injectable" covers the whole cold list, and now that is every
          // active normative item: scoped ones on their globs, unscoped ones
          // everywhere, pinned ones at session start. Naming a subset here
          // ("scoped", "scoped or pinned") has been wrong twice already.
          `${decay.cold.length} injectable item(s) have never been injected — ` +
          `with no sessions recorded, that means "not measured yet", not "unused". Nothing to act on.`,
          '  ',
        );
      } else {
        say(out, `cold — not auto-injected in the last ${DECAY_WINDOW} session(s); verify real use before acting:`, '  ');
        for (const row of table(
          // No `title`: the id is a slug of it, and this table is a pointer
          // into `mycontext decay` and `mycontext show`, not a reading list.
          ['id', 'type'],
          decay.cold.map((r) => [r.id, r.type]),
          { indent: '  ' },
        )) out(row);
      }
    }

    out('');
    say(
      out,
      `health: ${counts.errors} error(s), ${counts.warnings} warning(s), ${counts.infos} note(s) — ` +
      `details from \`mycontext doctor\`.`,
    );
    // Explicit design decision, not an oversight: `status`'s own exit code
    // reflects corpus LOAD errors only (the F2 rule — see `emitLoadErrors`
    // below), never these doctor-level findings, even an `error`-level one.
    // `doctor` itself DOES fail its exit code on an error-level finding
    // (see `exitCode` in doctor.ts); `status` deliberately does not, because
    // its exit-code contract is pinned to Plan 1's original corrupt-item
    // case and is one of only two commands allowed to fail CI on it at all
    // (see f2-registry.test.ts's `ALLOWED_NONZERO`) — widening that contract
    // to "any doctor-level error" would be a silent, untested change to
    // what a CI pipeline calling `status` can rely on. Surfaced on screen
    // instead, so the gap between the number shown and the exit code
    // returned is never a surprise: a nonzero doctor-level error count here
    // will NOT fail this command, or a CI job gating on it — run
    // `mycontext doctor` directly for that.
    if (counts.errors > 0) {
      say(
        out,
        `note: status's own exit code does not reflect the ${counts.errors} error(s) above — only ` +
        `an unrelated corpus load error fails this command. Run \`mycontext doctor\` if you need a ` +
        `command that fails on them.`,
        '  ',
      );
    }
    // The other direction of the same gap, and the one that reads WORSE in a
    // CI log tail: with no findings at all, the line above says
    // `health: 0 error(s), 0 warning(s), 0 note(s)` — which reads clean — and
    // this command then exits 1 because an item could not be parsed. `doctor`
    // was fixed for exactly this by folding the load errors into the number
    // it prints; `status` cannot fold them into `health:`, because that line
    // is the FINDINGS tally and its exit code comes from the load errors
    // alone, so the two counts are named separately instead. Either way the
    // number a human reads and the number a machine reads are both on screen.
    // The errors themselves are listed by `emitLoadErrors` below.
    if (errors.length > 0) {
      say(
        out,
        `note: the health line counts \`doctor\` findings only. ${errors.length} corpus load ` +
        `error(s) — listed below — are separate from it, and they are what makes this command ` +
        `exit 1.`,
        '  ',
      );
    }

    // Every count above was computed over a corpus that is missing whatever
    // could not be read. Plan 1's `status surfaces a rebuild error for a
    // corrupt item and exits non-zero` is what this satisfies, unchanged.
    emitLoadErrors(errors, out);
    return errors.length ? 1 : 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

registerCommand({
  name: 'status',
  usage: `status ${DETAIL_USAGE}`,
  summary: 'counts, review queue, ingest progress, decay and health',
  run: cmdStatus,
});
