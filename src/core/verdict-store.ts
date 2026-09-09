/**
 * **The contradiction verdict log, READ half.**
 *
 * Every ruling about a PAIR of items — `distinct` or `supersedes`, keyed to
 * both items' summary bases — is appended to
 * `.my_context/.verdicts/contradiction.jsonl` by `core/mutate.ts`
 * (contradiction-gate design §7). Two callers now READ it and only one writes
 * it:
 *
 *  - the **gate**, in `core/mutate.ts`, so a pair a person already settled is
 *    not raised again on the next write; and
 *  - the **drain**, `checkCorpusContradictions` in `doctor/checks.ts`
 *    (`plan:contra seq:3`), so a pair a person already settled is not reported
 *    again by the sweep either.
 *
 * **That second reader is the whole reason this module exists.** `seq:3` says
 * it in as many words: *"a pair already ruled distinct must not be reported
 * here either, and a verdict that has lapsed because one item changed meaning
 * SHOULD be. Otherwise the drain and the gate would disagree about the same
 * pair, which is the failure this whole subject exists to prevent."* One log,
 * one read contract, one `contradictionBasis` — so the two halves cannot come
 * to different answers about the same row.
 *
 * `doctor/checks.ts` is in the UI server's runtime import graph (through
 * `ui/read-model.ts`, for `/api/doctor`), so it must reach the log through a
 * module that reads and never writes. `appendVerdict` therefore stays in
 * `core/mutate.ts`, beside the write it belongs to, and is deliberately NOT
 * moved here: a module a read surface imports must not be the module that
 * knows how to append.
 */
import path from 'node:path';
import { itemSummaryBasis } from './content-hash.ts';
import { readJsonlFile, type JsonlLogSpec } from './jsonl-log.ts';
import {
  CONTRADICTION_PROTOCOL,
  type ContradictionDisposition, type ContradictionVerdict,
} from './overlap.ts';
import type { Item, Origin } from './types.ts';

/**
 * **What an item's meaning hashes to, for the purpose of remembering a ruling
 * about it.**
 *
 * `summary_of` is the field the product already maintains for exactly this
 * question — it is what `summary_stale` compares against and what the summary
 * gate fires on — so §7 keys verdicts to it. It has one hole, and the fallback
 * is the fix rather than a second mechanism:
 *
 * `stampSummary` writes `summaryOf: null` for an item with no summary, and
 * `null` never moves. A verdict keyed to it could therefore never lapse, and a
 * pair involving an unsummarised item would be silenced permanently by one
 * ruling — the exact failure §7 exists to prevent, arriving through the field
 * §7 chose. So an unsummarised item is keyed to its LIVE summarised-content
 * hash, which is the same value `summary_of` would hold if it had one. The
 * consequence is stated rather than hidden: on such an item the verdict lapses
 * on any content edit, including a mechanical one, because there is no summary
 * for `--summary-unchanged` to leave standing and so nothing to carry forward.
 */
export function contradictionBasis(item: Item): string {
  return item.summaryOf ?? itemSummaryBasis(item);
}

/** `.my_context/.verdicts/` — the audit log's shape, and its `.gitignore`. */
export function verdictsDir(root: string): string {
  return path.join(root, '.verdicts');
}

export function contradictionLogPath(root: string): string {
  return path.join(verdictsDir(root), 'contradiction.jsonl');
}

/**
 * The log's read contract, and it is the audit log's, for the reason §7 gives:
 * append-only survived concurrent writers on this project where a
 * read-modify-write destroyed 1–21 rows per run.
 *
 * A damaged line THROWS rather than being skipped. "This log cannot be read"
 * and "nothing has been ruled" are opposite facts, and answering the first
 * with the second would re-raise every settled pair in the corpus at once —
 * which is the wall §7 exists to prevent, reached by a silent read.
 */
function verdictSpec(root: string): JsonlLogSpec {
  const file = contradictionLogPath(root);
  return {
    file,
    protocol: CONTRADICTION_PROTOCOL,
    validate: (row) => {
      if (typeof row.a !== 'string' || row.a === '') return 'has no usable "a"';
      if (typeof row.b !== 'string' || row.b === '') return 'has no usable "b"';
      if (row.verdict !== 'distinct' && row.verdict !== 'supersedes') {
        return 'has no usable "verdict"';
      }
      if (typeof row.aBasis !== 'string' || row.aBasis === '') return 'has no usable "aBasis"';
      if (typeof row.bBasis !== 'string' || row.bBasis === '') return 'has no usable "bBasis"';
      if (typeof row.ruledAt !== 'string' || row.ruledAt === '') return 'has no usable "ruledAt"';
      return null;
    },
    refuse: (line, reason) => new Error(
      `my_context: contradiction verdict log line ${line} ${reason} (${file}). Every ruling ` +
      `about a pair of items is recorded there, so a line that cannot be read is a ruling ` +
      `that cannot be honoured — and skipping it would re-open a pair somebody already ` +
      `settled. Nothing was written. Repair or remove the line, then retry.`,
    ),
    unreadable: (err) => new Error(
      `my_context: the contradiction verdict log could not be read (${file}): ${
        err instanceof Error ? err.message : String(err)}. "Cannot read" is not "nothing was ` +
        `ruled", so nothing was written.`,
    ),
  };
}

export function readVerdicts(root: string): ContradictionVerdict[] {
  return readJsonlFile(verdictSpec(root)).map((row) => ({
    protocol: String(row.protocol),
    a: String(row.a),
    b: String(row.b),
    verdict: row.verdict as ContradictionDisposition,
    aBasis: String(row.aBasis),
    bBasis: String(row.bBasis),
    ruledAt: String(row.ruledAt),
    ruledBy: (row.ruledBy ?? 'human') as Origin,
    ...(row.carried === true ? { carried: true } : {}),
  }));
}
