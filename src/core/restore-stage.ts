/**
 * **The WRITE half of session-restore staging: build a summary, put it on
 * disk, and let the owner — only the owner — release it to the next
 * injection.** `plan:restore seq:2`, design of record
 * `docs/superpowers/specs/2026-09-07-session-summary-restore-design.md` §3, §5
 * and §6.
 *
 * ── THE SEQUENCE, AND WHICH FUNCTION IS WHICH STEP ─────────────────────────
 *
 *   1 PROPOSE   a person or an agent says: this window has lost something the
 *               transcript still holds. No code; it is a sentence.
 *   2 BUILD     `buildRestoreProposal` — AUTOMATIC, needs no approval, writes
 *               nothing. It reads a transcript through `seq:1`'s reader and
 *               renders the two artefacts §5 requires.
 *   3 REVIEW    the owner reads `renderStagedReviewForm`'s output: numbered
 *               main subjects, one line each, under a coverage headline that
 *               cannot read as complete when the build was partial.
 *   4 APPROVE   `approveStagedRestore` — the owner, and `'human'` is checked
 *               rather than documented. Nothing is injected yet.
 *   5 STAGE     `stageRestoreSummary` writes the record and then RE-READS it
 *               through `core/restore-staging.ts` before reporting success.
 *   6 CLEAR     THE OWNER clears the window. There is no code for this step
 *               and there must never be one; see below.
 *   7 DELIVER   `spendApprovedRestore`, called by `core/inject.ts` at the next
 *               injection and by nothing else.
 *
 * ── WHY THE STAGE COMES BEFORE THE CLEAR, IN THE ITEM'S OWN WORDS ──────────
 *
 * *"A clear destroys everything held only in the conversation, so the summary
 * must be a FILE before the clear, never a message. Step 5 must complete and
 * be verifiable on disk BEFORE the owner is told it is safe to clear — 'the
 * clear happens without the stage' is the one failure mode that loses the
 * thing this exists to save."*
 *
 * That is why `approveStagedRestore` returns `safeToClear` rather than a bare
 * exit code, and why the flag comes from `verifyStagedRestore` — a re-read
 * that compares the bytes on disk against the artefacts the caller believes it
 * staged. A successful write is not evidence; a successful read of what was
 * written is. Everything a caller prints to the owner about clearing must rest
 * on that field and on nothing else.
 *
 * ── WHAT IS REUSED, BECAUSE THE ITEM SAYS SO AND IT IS NOT OPTIONAL ────────
 *
 *  - **The `.staging/*.json` protocol** (`src/lesson/staging.ts`) — a decision
 *    a human has not taken yet, held in a file, with a reader that imports
 *    nothing which writes. `core/restore-staging.ts` is that reader, and its
 *    header says why restores sit one directory deeper.
 *  - **`mycontext carry`'s one-shot spend** (`core/ledger.ts` ·
 *    `spendCarryOnce`) — steps 5 and 7. `spendApprovedRestore` below is the
 *    same contract in the same words: read and mark spent in one call, called
 *    once per injection, never throwing, because a broken queue must cost the
 *    carry and never the injection. What it could NOT reuse is the carry
 *    QUEUE itself: `state/carry-once.json` holds item ids, `core/select.ts`
 *    resolves each one to a corpus item and renders it as a front-of-queue
 *    INDEX LINE, and a session summary is not an item and has no id. The
 *    ledger's own header refuses that repurposing in as many words — *"the
 *    session-scoped carry has no field for and must not be repurposed to
 *    hold"* — so the shape is reused and the file is not.
 *  - **The SessionStart / compact-restore path** (`core/inject.ts`) — step 7's
 *    carrier. `spendApprovedRestore` has one caller and it is that module.
 *
 * ── NO BUDGET MANAGEMENT. OWNER RULING, EXPLICIT ───────────────────────────
 *
 * *"It takes as much as it requires, because this is not ongoing behaviour but
 * the last option for restoring things that would otherwise be lost. The
 * existing tiers budget a RECURRING cost; this has none."* So there is no cap,
 * no tier and no trim anywhere in this module or on the delivery path in
 * `core/inject.ts`, and `test/core/restore-stage.test.ts` pushes 400 KB
 * through the round trip to keep it that way. `maxPoints` is the RECIPE's
 * option from `seq:1` — how many points the owner asked for — and is not a
 * budget: it is chosen by the person building, disclosed as a shortfall when
 * it bites, and never applied by this module on its own initiative.
 *
 * ── AND THERE IS NO CLEAR VERB, ON PURPOSE ─────────────────────────────────
 *
 * Step 6 is the owner's act. Nothing here clears a window, and nothing here
 * can reach the injection: `core/inject.ts` imports THIS module, never the
 * reverse. `test/core/restore-stage.test.ts` asserts that direction, the way
 * `test/core/retire.test.ts` asserts `core/retire.ts`' inability to write.
 */
import {
  RESTORE_STAGING_PROTOCOL, loadStagedRestore, restoreStagingDir, restoreStagingFile,
  verifyStagedRestore,
  type RestoreVerification, type StagedRestore, type StagedRestoreSource,
} from './restore-staging.ts';
import { writeStagedRestore } from './restore-store.ts';
import {
  POINT_CATEGORIES, renderPayload, renderReviewForm, summariseTranscript,
  type SessionSummary, type SummaryCoverage, type SummaryOptions,
} from './session-summary.ts';

/* ── step 2: BUILD ────────────────────────────────────────────────────────── */

/** The two artefacts, and the summary they were rendered from. */
export interface RestoreProposal {
  /** What would be injected. As long as it needs to be. */
  payload: string;
  /** The numbered short form the owner reads and approves. */
  reviewForm: string;
  /** Every way this build is partial, itemised. Empty means complete. */
  shortfalls: string[];
  /** `seq:1`'s whole answer, so nothing downstream re-derives a number. */
  summary: SessionSummary;
}

/**
 * **Step 2. Automatic, needs no approval, and writes nothing.**
 *
 * The item is explicit that building is free — *"an agent may propose and may
 * build"* — and this function is what makes that safe to say: it returns a
 * string pair and touches no file. Everything that can put a byte on disk is
 * below this line, in functions a person calls.
 */
export function buildRestoreProposal(
  file: string, options: SummaryOptions = {},
): RestoreProposal {
  const summary = summariseTranscript(file, options);
  return {
    payload: renderPayload(summary),
    reviewForm: renderStagedReviewForm(summary),
    shortfalls: coverageShortfalls(summary),
    summary,
  };
}

/* ── step 3: REVIEW, and the honesty §5 demands of the form ───────────────── */

/**
 * **Every way this build is PARTIAL, in words. An empty list means complete.**
 *
 * Design §5, and it is a requirement on the form's CONTENT rather than on a
 * flag: *"he is approving a summary he has not read in full, so the review
 * form must be honest about COVERAGE — how much was read, what the filter
 * dropped, where the recipe skipped. A review form that reads as complete when
 * it is partial is worse than none."*
 *
 * `seq:1`'s `renderReviewForm` already prints every coverage NUMBER, and it
 * prints them well. What it cannot do is answer the one question the owner
 * actually has in front of him at step 3 — *is this the whole thing?* — which
 * a reader can only reach by comparing a dozen figures against each other and
 * knowing which comparisons matter. This function makes that answer explicit,
 * and `renderStagedReviewForm` puts it at the top.
 *
 * **Each entry opens with a distinct word**, because the list is the evidence:
 * a form that said "partial" once and then hid four different shortfalls
 * behind one sentence would be the same defect one level down. The test
 * asserts the count of distinct opening words for exactly that reason.
 *
 * What is NOT a shortfall: the mechanical filter (stages 1-4 of the recipe).
 * Dropping records that carry no message object, or carry no words, or carry
 * our own marker, is the recipe working — not coverage lost — and calling it
 * a shortfall would make every possible build partial, which would make the
 * word mean nothing.
 */
export function coverageShortfalls(summary: SessionSummary): string[] {
  const c = summary.coverage;
  const out: string[] = [];

  if (c.upToBytes < c.fileBytes) {
    out.push(
      `SNAPSHOT: the read was pinned at ${c.upToBytes.toLocaleString()} bytes and the file is ` +
      `${c.fileBytes.toLocaleString()} — ${(c.fileBytes - c.upToBytes).toLocaleString()} bytes ` +
      'at the end of the session were never read.',
    );
  }
  if (c.readBytes < c.upToBytes) {
    out.push(
      `TRUNCATED: the read stopped at ${c.readBytes.toLocaleString()} of the ` +
      `${c.upToBytes.toLocaleString()} bytes it was asked for.`,
    );
  }
  if (c.unreadable > 0) {
    out.push(`UNPARSEABLE: ${c.unreadable} line(s) in the transcript could not be read at all.`);
  }
  if (summary.options.range.kind !== 'whole' || c.droppedOutOfRange > 0) {
    out.push(
      `RANGE: ${c.droppedOutOfRange.toLocaleString()} record(s) with words in them fall outside ` +
      'the range that was asked for, and were never considered.',
    );
  }
  if (summary.options.subjects.length > 0 || c.droppedOffSubject > 0) {
    out.push(
      `SUBJECTS: ${c.droppedOffSubject.toLocaleString()} record(s) were dropped for not ` +
      `mentioning ${summary.options.subjects.join(', ') || 'the named subjects'}.`,
    );
  }
  if (c.droppedOverCap > 0) {
    out.push(
      `CAP: ${c.droppedOverCap.toLocaleString()} point(s) reached the admission threshold and ` +
      `were cut because ${summary.options.maxPoints} were asked for.`,
    );
  }
  for (const category of POINT_CATEGORIES) {
    const row = c.byCategory[category];
    if (row.admitted > 0 && row.kept === 0) {
      out.push(
        `EMPTY: ${row.admitted.toLocaleString()} ${category}(s) were found and NONE was kept — ` +
        'this summary says nothing about a category the session had something to say about.',
      );
    }
  }
  return out;
}

/**
 * **The review form the owner reads at step 3: `seq:1`'s form under a coverage
 * headline it cannot contradict.**
 *
 * The headline is one of exactly two lines, and the itemised shortfalls follow
 * it. `seq:1`'s form is appended below, unchanged and not reimplemented — the
 * numbers, the quota table and the compaction list are already right there,
 * and a second rendering of them is the duplication this project spent a day
 * measuring.
 */
export function renderStagedReviewForm(summary: SessionSummary): string {
  const shortfalls = coverageShortfalls(summary);
  const out: string[] = [];
  if (shortfalls.length === 0) {
    out.push('COVERAGE: COMPLETE — the whole file was read, nothing was filtered by range or');
    out.push('subject, and no point that qualified was cut.');
  } else {
    out.push(`COVERAGE: PARTIAL — ${shortfalls.length} thing(s) this summary does not cover.`);
    out.push('You are approving a summary you have not read in full, so they are listed first:');
    out.push('');
    for (const shortfall of shortfalls) out.push(`  - ${shortfall}`);
  }
  out.push('');
  out.push(renderReviewForm(summary));
  return out.join('\n');
}

/* ── step 5: STAGE ────────────────────────────────────────────────────────── */

/** What the stage did, and whether the file it wrote could be read back. */
export interface StageResult {
  key: string;
  file: string;
  /**
   * True ONLY when the record was re-read off the disk and matched. No caller
   * may tell the owner anything about clearing on any other basis.
   */
  verified: boolean;
  /** Present whenever `verified` is false. */
  reason: string | null;
  verification: RestoreVerification;
}

/**
 * A key that reads as a time, because that is what a person picks between when
 * two are staged. Colons are not legal in a Windows filename and the key
 * becomes one, so the ISO stamp is flattened rather than trusted.
 */
function keyFor(now: Date): string {
  return `restore-${now.toISOString().replace(/[:.]/g, '-')}`;
}

/**
 * **What `stageRestoreSummary` actually needs — so a SECOND kind of payload
 * can use this carrier instead of growing one of its own.**
 *
 * `plan:recall seq:2`, spec §10a, owner ruling 2026-09-11: a retrieval result
 * may be placed into a FRESH window, and *"IT REUSES D34's CARRIER AND MUST
 * NOT GROW A SECOND ONE."* Everything below step 5 — the re-read that proves
 * the file survived, the owner's `'human'` approval, the clear that is his act
 * alone, the one-shot spend and the loop guard — is what that ruling is
 * protecting, and none of it may be re-implemented beside this file.
 *
 * The obstacle was a TYPE and nothing else: `RestoreProposal.summary` is a
 * `SessionSummary`, which is transcript-shaped down to `speaker` and `cues`,
 * and a retrieval result has none of that. `stageRestoreSummary` never read
 * those fields — it reads four facts off the summary and stores them — so the
 * fix is to name the four rather than to fabricate thirty. **Nothing is
 * widened at the STAGING end**: the record written is byte-for-byte the shape
 * it always was, `RestoreProposal` satisfies this interface through
 * `stageableProposal` below, and every existing caller is untouched.
 *
 * Fabricating a `SessionSummary` was the alternative and is refused for this
 * project's usual reason: thirty transcript-shaped counters set to zero would
 * read, on the Status screen and in `restore --show`, as a transcript that was
 * read and yielded nothing — which is precisely the `STD-a-measured-zero-is-
 * drawn-and-named` confusion, manufactured on purpose.
 */
export interface StageableRestore {
  /** What would be injected. As long as it needs to be. */
  payload: string;
  /** The short form the owner reads and approves. NOT the payload. */
  reviewForm: string;
  /** Every way this is PARTIAL, in words. Empty means complete. */
  shortfalls: string[];
  /** What it was built from, as `restore --show` prints it. */
  source: StagedRestoreSource;
  /** The loop guard's marker the payload carries. */
  marker: string;
  /** `seq:1`'s coverage block. A payload with no transcript behind it says so. */
  coverage: SummaryCoverage;
}

/** A built proposal, in the shape the stage reads. The only lossy step is the one nothing reads. */
export function stageableProposal(proposal: RestoreProposal): StageableRestore {
  return {
    payload: proposal.payload,
    reviewForm: proposal.reviewForm,
    shortfalls: proposal.shortfalls,
    source: {
      file: proposal.summary.file,
      upToBytes: proposal.summary.coverage.upToBytes,
      records: proposal.summary.coverage.records,
      points: proposal.summary.points.length,
    },
    marker: proposal.summary.marker,
    coverage: proposal.summary.coverage,
  };
}

/** True for the shape `buildRestoreProposal` returns, false for a bare stageable. */
function isProposal(value: RestoreProposal | StageableRestore): value is RestoreProposal {
  return (value as RestoreProposal).summary !== undefined;
}

/**
 * **Step 5. Write the record, then READ IT BACK and compare.**
 *
 * The re-read is the whole function. A write that returns is not a summary
 * that survives a clear, and this is the only place the difference can be
 * caught — after this returns, the next thing that happens is the owner
 * destroying the window the summary is currently living in.
 *
 * `state` is `proposed`: staging is not approving. An agent may call this, and
 * what it leaves behind governs nothing and is delivered nowhere until
 * `approveStagedRestore` has been called by a person.
 */
export function stageRestoreSummary(
  root: string, proposal: RestoreProposal | StageableRestore, now: Date = new Date(),
): StageResult {
  const staging = isProposal(proposal) ? stageableProposal(proposal) : proposal;
  const key = keyFor(now);
  const file = restoreStagingFile(root, key);
  const record: StagedRestore = {
    protocol: RESTORE_STAGING_PROTOCOL,
    key,
    state: 'proposed',
    builtAt: now.toISOString(),
    approvedAt: null,
    approvedBy: null,
    deliveredAt: null,
    deliveredTo: null,
    source: staging.source,
    marker: staging.marker,
    payload: staging.payload,
    reviewForm: staging.reviewForm,
    shortfalls: staging.shortfalls,
    coverage: staging.coverage,
  };

  try {
    writeStagedRestore(root, record);
  } catch (err) {
    const reason = `the staged restore could not be written (${
      err instanceof Error ? err.message : String(err)}), so nothing is on disk and clearing ` +
      'would lose the summary.';
    return {
      key, file, verified: false, reason,
      verification: { ok: false, reason, payloadBytes: 0 },
    };
  }

  const verification = verifyStagedRestore(root, key, staging);
  return { key, file, verified: verification.ok, reason: verification.reason, verification };
}

/* ── step 4: APPROVE — the owner's act, and the answer he acts on ─────────── */

/** What the approval decided, and the one field a caller may print. */
export interface ApprovalResult {
  /**
   * **The sentence "it is safe to clear" rests on this and on nothing else.**
   * True only when the record was re-read off the disk after the approval and
   * still held the artefacts the owner approved.
   */
  safeToClear: boolean;
  reason: string | null;
  verification: RestoreVerification;
  /** The record as it now stands on disk, or null when the approval refused. */
  record: StagedRestore | null;
}

/**
 * **Step 4, and it is the owner's — `'human'` is CHECKED, not documented.**
 *
 * The item: *"AND NEVER AUTOMATIC. An agent may propose and may build. ONLY
 * THE OWNER INJECTS."* `core/mutate.ts`'s `acknowledgeFinding` refuses every
 * origin but `human` for the same reason and in the same shape, and
 * `cli/commands/carry.ts` stamps `'human'` unconditionally at its one call
 * site. There is no `--agent` escape hatch here and no MCP tool for it.
 *
 * **The verification happens AFTER the state is written, not before.** That
 * ordering is the point: what the owner is told is safe to clear is the file
 * as it stands at the moment he is told — approved, on disk, re-read — and not
 * the file as it was a moment earlier. A verification taken before the write
 * would be describing a record that no longer exists.
 */
export function approveStagedRestore(
  root: string, key: string, actor: 'human',
  expected: { payload: string; reviewForm: string },
  now: Date = new Date(),
): ApprovalResult {
  const refuse = (reason: string): ApprovalResult => ({
    safeToClear: false, reason, verification: { ok: false, reason, payloadBytes: 0 }, record: null,
  });

  if (actor !== 'human') {
    return refuse(
      'only the owner approves a restore. An agent may propose one and may build one; releasing ' +
      'it into a context window is his act, and this refusal is the whole of what keeps it his.',
    );
  }

  let record: StagedRestore | null;
  try {
    record = loadStagedRestore(root, key);
  } catch (err) {
    return refuse(err instanceof Error ? err.message : String(err));
  }
  if (record === null) {
    return refuse(
      `nothing is staged under "${key}". \`mycontext restore --show\` lists what is waiting.`,
    );
  }
  if (record.state === 'delivered') {
    return refuse(
      `"${key}" was already delivered at ${record.deliveredAt}. A restore is one-shot; build a ` +
      'new one rather than re-approving a spent record.',
    );
  }

  const approved: StagedRestore = {
    ...record, state: 'approved', approvedAt: now.toISOString(), approvedBy: 'human',
  };
  try {
    writeStagedRestore(root, approved);
  } catch (err) {
    return refuse(
      `the approval could not be written (${err instanceof Error ? err.message : String(err)}), ` +
      'so the staged restore is still unapproved and will not be delivered.',
    );
  }

  // ── THE VERIFICATION, AND IT IS AFTER THE WRITE, ONCE, DELIBERATELY ───────
  //
  // The item's ruling: *"the thing that tells him it is safe must itself
  // re-read the file and confirm it, not trust that a write returned."* So
  // this is the only verification in this function, and it reads the file as
  // it stands at the moment the answer is given — approved, on disk, whole.
  //
  // **There was a check BEFORE the write for one afternoon, and removing it is
  // what made the assertion testable.** With both, every test that could reach
  // this one was caught by the earlier one instead: breaking THIS line left the
  // suite green, which is the shape of assertion this project has been burned
  // by twice. A pre-check also bought nothing the post-check does not — a file
  // that changed under the reader fails both, and only the post-check also
  // covers a write that returned and did not land.
  const after = verifyStagedRestore(root, key, expected);
  if (!after.ok) {
    // **Roll back, or the refusal leaves behind exactly what it refused.** The
    // record on disk now says `approved`, so `approvedRestore` would hand it to
    // the next session start — a summary the owner was told it is NOT safe to
    // clear for, delivered anyway. Putting the state back is what makes
    // "not safe to clear" true of the workspace and not only of the sentence.
    let rollback: string = '';
    try {
      writeStagedRestore(root, { ...record, state: 'proposed' });
    } catch (err) {
      rollback =
        ' WORSE: the approval could not be undone either (' +
        `${err instanceof Error ? err.message : String(err)}), so a record marked approved is ` +
        `still on disk. Run \`mycontext restore --discard ${key}\` before you clear anything.`;
    }
    return {
      safeToClear: false,
      reason: `${after.reason}${rollback}`,
      verification: after,
      record: null,
    };
  }
  return {
    safeToClear: true, reason: null, verification: after,
    record: loadStagedRestore(root, key),
  };
}

/**
 * Re-exported so a caller that drives the whole sequence needs one import, and
 * so the two acts a person takes on a staged restore — approving it and
 * withdrawing it — are reached by the same name from the same place. The
 * implementations live in `core/restore-store.ts`, which is the module the
 * injection loads; see its header for why that separation is load-bearing.
 */
export { discardStagedRestore } from './restore-store.ts';

/** Where `restoreStagingDir` puts things, re-exported so callers need one import. */
export { restoreStagingDir };
