/**
 * **The one function on the return path that WRITES, kept where the read
 * surface cannot reach it.** `plan:recall seq:2` Task 11 step 4a, spec §10a.
 *
 * `retrieval/return.ts` is pure and stays pure. This module is what the CLI
 * calls, and nothing under `src/ui/` imports it: `test/ui/no-writes.test.ts`
 * walks the server's whole reachable graph and found the previous arrangement
 * — one file holding both halves — reaching `core/restore-stage.ts`' staging
 * writer from a read-only route. The separation is therefore a measurement
 * rather than a preference, and it is the one `core/restore-staging.ts` and
 * `core/restore-store.ts` already make one directory up.
 *
 * **It stages. It does not deliver.** The record it leaves is `proposed`;
 * `approveStagedRestore` is the owner's act and refuses any actor but
 * `'human'`; the clear of the window is his and has no verb anywhere in this
 * product. `test/core/retrieval-return.test.ts` asserts that inability the way
 * `driftCheck` asserts its own — by asking `approvedRestore`, the question
 * `core/inject.ts` puts at every session start, and requiring it to still
 * answer nothing.
 *
 * **And it reuses D34's carrier rather than growing a second one**, which is
 * the ruling in its own words. Staging before the clear, the re-read that
 * proves the file survived, the refusal to manage a budget and the loop guard
 * are all properties of `stageRestoreSummary`, argued and tested there.
 */
import {
  stageRestoreSummary, type StageResult, type StageableRestore,
} from '../restore-stage.ts';
import { SESSION_SUMMARY_MARKER } from '../summary-marker.ts';
import type { SummaryCoverage } from '../session-summary.ts';
import { returnReviewForm, returnShortfalls, type MarkedReturn } from './return.ts';

/**
 * **A coverage block for a payload that was never built from a transcript.**
 *
 * Every counter is zero and every zero is TRUE: no transcript was read, so no
 * record was seen and none was dropped. It is written out rather than faked
 * from a summary because `StagedRestore.coverage` is typed by `seq:1`'s block
 * and a reader of the staged record must not be handed a number that describes
 * a read that never happened — `STD-a-measured-zero-is-drawn-and-named`, which
 * is exactly the distinction between *nothing was there* and *nothing was
 * looked at*. `StagedRestoreSource.file` carries the result file, which is
 * where that reader should look instead, and `restore --show` prints it.
 */
const NO_TRANSCRIPT_COVERAGE: SummaryCoverage = {
  fileBytes: 0, upToBytes: 0, readBytes: 0, records: 0, unreadable: 0,
  droppedNoMessage: 0, droppedNoText: 0, droppedThinking: 0,
  droppedTaskNotification: 0, droppedSlashCommand: 0, droppedMeta: 0,
  droppedSystemReminder: 0, droppedHarnessCompactionSummary: 0, droppedOwnSummary: 0,
  textRecords: 0, droppedOutOfRange: 0, droppedOffSubject: 0,
  candidates: 0, scored: 0, droppedDuplicate: 0, droppedOverCap: 0, droppedTooShort: 0,
  personChars: 0, modelChars: 0,
  byCategory: {
    decision: { admitted: 0, kept: 0 },
    correction: { admitted: 0, kept: 0 },
    measurement: { admitted: 0, kept: 0 },
    question: { admitted: 0, kept: 0 },
    failure: { admitted: 0, kept: 0 },
  },
  personPoints: 0, modelPoints: 0,
};

/** The marked return, in the shape D34's carrier stages. */
export function stageableReturn(marked: MarkedReturn, resultPath: string): StageableRestore {
  return {
    payload: marked.text,
    reviewForm: returnReviewForm(marked, resultPath),
    shortfalls: returnShortfalls(marked),
    source: {
      file: resultPath,
      upToBytes: Buffer.byteLength(marked.text, 'utf8'),
      records: marked.chosen.length + marked.left,
      points: marked.chosen.length,
    },
    marker: SESSION_SUMMARY_MARKER,
    coverage: NO_TRANSCRIPT_COVERAGE,
  };
}

/**
 * **Stage a marked return for a FRESH window — D34's carrier, called, not
 * copied.**
 *
 * Spec §10a. This function is three lines on purpose: staging before the
 * clear, the re-read that proves the file survived, the refusal to manage a
 * budget and the loop guard are all properties of
 * `core/restore-stage.ts` · `stageRestoreSummary`, already argued and already
 * tested there, and the ruling that added this destination said in as many
 * words that it *"MUST NOT GROW A SECOND ONE"*.
 *
 * **It stages. It does not deliver.** The record it leaves is `proposed`;
 * `approveStagedRestore` is the owner's act and refuses any actor but
 * `'human'`; the clear of the window is his and has no verb anywhere in this
 * product. `test/core/retrieval-return.test.ts` asserts the inability the way
 * `driftCheck` asserts its own: by asking `approvedRestore` — the question the
 * injection asks — and requiring it to still answer nothing.
 */
export function stageRetrievalReturn(
  root: string, marked: MarkedReturn, resultPath: string, now: Date = new Date(),
): StageResult {
  return stageRestoreSummary(root, stageableReturn(marked, resultPath), now);
}
