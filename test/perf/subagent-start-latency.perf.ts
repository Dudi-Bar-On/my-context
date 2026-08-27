/**
 * Perf suite — see the header comment in `jit-latency.perf.ts` for why this
 * lives here (`.perf.ts`, not `.test.ts`) and runs only under
 * `npm run test:perf` (`--test-concurrency=1`).
 *
 * **What this file is for.** `SubagentStart` BLOCKS the dispatch it fires for
 * — measured: a 3,018 ms hook delayed the subagent's first tool call until it
 * returned — and nothing in the process bounds it. The stdin timer in
 * `subagent-start.ts` bounds a pipe that never closes and nothing else, so
 * once the payload is in hand the only thing that can end this hook is Claude
 * Code killing it at the `timeout` its `hooks.json` entry declares. Task 11
 * registers it at 5 seconds. That number is worth nothing as an assertion; it
 * is worth something only if the work it bounds is measured, which is what
 * this file does.
 *
 * **The 500 ms ceiling is SessionStart's, deliberately unchanged**
 * (`test/perf/session-start-latency.perf.ts` · `const CEILING_MS = perfCeiling(500);` · ~212,
 * via `test/helpers/perf.ts` · `export function perfCeiling(` · ~55), because
 * this event does the same selection over the same corpus: the pinned tier in
 * full plus the index, read from Markdown. It is not the JIT hook's 50 ms
 * per-tool-call budget — this runs once per dispatch, not once per tool call.
 *
 * **It measures the IN-PROCESS function, and the registered timeout covers
 * more than that.** `buildSubagentStartOutput` is called directly here; a cold
 * `node` start that has to type-strip the whole injection import graph, and
 * the stdin read before it, are both inside the 5 s the manifest declares and
 * outside every number below. Nothing here may be read as a claim about the
 * end-to-end hook. It bounds the part the product controls, which is the part
 * that can regress in a commit.
 *
 * **So the end-to-end number is recorded here rather than left to look
 * unknown, and it is recorded as UNASSERTED.** `node <binary>` with a real
 * payload on stdin, against this same 500-item corpus, on the same loaded
 * machine, eight consecutive runs: 338, 341, 342, 353, 357, 360, 379 and
 * 413 ms wall clock, each returning the same 8,305-byte envelope — roughly
 * 150 ms of cold start and type-stripping on top of the in-process cost below,
 * and an order of magnitude inside the registered 5,000 ms. Nothing in this
 * repository asserts that figure: measuring it in a test would time a `node`
 * start on whatever machine ran it, which is the flake this suite's own
 * helpers exist to avoid. It is a measurement, taken once, written down.
 *
 * **A fresh `agent_id` per iteration, and that is load-bearing.** The dedupe
 * key is `session_id::agent_id` (`hooks/io.ts` · `export function ledgerKey(` · ~208),
 * so a fixed agent would write one seen file on the first call and then
 * measure nineteen deduped near-empty deliveries — a number that would pass
 * while asserting nothing, the same trap the compact case in
 * `session-start-latency.perf.ts` documents. A new agent under one parent
 * session is also exactly the production shape: every dispatch is a birth,
 * with its own key and its own first seen-file append. The append is therefore
 * ON the timed path here, which is the honest shape — its worst case scales
 * with the number of delivered lines (`core/seen-file.ts` · `= 200 ms of backoff PER LINE` · ~81).
 *
 * **What this event does NOT do, so nobody reads the number as covering it:**
 * the subagent event skips the best-effort index refresh entirely
 * (`core/inject.ts` · `**THE SUBAGENT EVENT SKIPS THIS ENTIRELY**` · ~566), so
 * it opens no database and the contended-open worst case
 * (`core/store.ts` · `Worst case ~1.06s: two attempts` · ~122) is not on this
 * path at all. A held index write lock cannot slow this hook down.
 *
 * **The corpus here is 500 NORMATIVE items where the sibling file's first case
 * is 500 `lesson`s, and the difference is deliberate.** A `lesson` corpus
 * delivers nothing on this event — rationale categories are ineligible for
 * `selection.full` and absent from the index tier — so it would time a hook
 * that selected nothing, which is not the hook. This one renders 25 pinned
 * items, lists 500 normative ids in the index tier, records 525 refs in the
 * audit row and appends 25 seen lines. The assertion above the loop pins that
 * premise, because a selection that quietly went empty is fast and proves
 * nothing.
 *
 * Recorded baseline (2026-08-21, dev machine): p95 184.8, 200.9 and 243.4 ms
 * across three runs, against the unchanged 500 ms ceiling. Read these as
 * LOAD-INFLATED: the machine was running several worktrees' suites at once,
 * and the sibling file's idle-machine baseline for its own 500-item shape is
 * 45.6–46.3 ms (2026-08-16). What the loaded machine does still say, because
 * both were measured back to back in one process, is the comparison that
 * matters here: subagent-start 184.8 ms against session-start 212.4 ms on the
 * same corpus size at the same moment. This event is the CHEAPER of the two,
 * which is what skipping the index refresh predicts. Re-derive all of it on an
 * idle machine before reading any single number as a regression signal.
 *
 * **What the loaded machine also showed, recorded so the next reader does not
 * re-diagnose it.** Across five runs on that box this case went red twice
 * (3075.8 ms, 1368.1 ms) and green three times — and on two of the green runs
 * the UNTOUCHED SessionStart cases in the same process went red instead
 * (569.6, 561.4 and 513.1 ms against the same 500 ms ceiling), as did
 * `fallback-latency.perf.ts` against its own hard 300 ms. Which member of the
 * 500 ms family reddens is a coin toss on a loaded machine; that they move
 * together is the signature `test/helpers/perf.ts` records for the runner
 * rather than the code. The ceiling is NOT widened for it, for the reason that
 * file gives: a bound sized to absorb a busy dev box certifies nothing. The 3 s sample itself was reproduced outside
 * the suite and is a first-iteration effect on a busy box — 3087, 1305, 859,
 * 768, … decaying inside one 20-sample run, and a flat 374–396 ms across a
 * later run of the identical shape. The seen-file append's share was measured
 * the same way, by running this shape with and without a `session_id` (no id
 * means no dedupe key and no append): ~40 ms for 25 lines. Small, and on the
 * timed path deliberately.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { writeItem } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import type { Item } from '../../src/core/types.ts';
import type { HookInput } from '../../src/hooks/io.ts';
import { buildSubagentStartOutput } from '../../src/hooks/subagent-start.ts';
import { removeTree } from '../helpers/tmp.ts';
import { perfCeiling } from '../helpers/perf.ts';

const CORPUS_SIZE = 500;
/** How many of them are `always: true`, so the full tier and the seen-file append are non-empty. */
const PINNED = 25;
const WARMUP = 3;
const ITERATIONS = 20;
/** The parent's id, shared by every dispatch below exactly as it is in production. */
const PARENT = 'perf-subagent-parent';
// 500ms is the product budget; widened 10× on the GitHub Windows runner only
// (an 819ms breach was observed there on unchanged code, run 31674652091) —
// see test/helpers/perf.ts for what the widened ceiling certifies.
const CEILING_MS = perfCeiling(500);

/**
 * `type: 'constraint'`, never `lesson`: only NORMATIVE categories pass
 * `isNormative` and become eligible for `selection.full`, so a `lesson` corpus
 * would measure a selection that could never deliver anything however it was
 * pinned. The same reason `session-start-latency.perf.ts` gives for its
 * compact case.
 */
function constraintItem(i: number): Item {
  return {
    id: `CONST-${i}`, type: 'constraint', title: `Constraint number ${i}`, status: 'active',
    severity: 'soft', always: i < PINNED, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: '', extra: {},
    body: 'A body of roughly forty characters.', steps: [], observations: [], relations: [],
    layer: 'project', filePath: `items/constraint/CONST-${i}.md`,
  };
}

/** One dispatch's payload: the parent's session, a subagent of its own. */
function payload(cwd: string, agent: string): HookInput {
  return { hook_event_name: 'SubagentStart', session_id: PARENT, agent_id: agent, cwd };
}

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

test('SubagentStart stays under the 500ms p95 ceiling on a 500-item corpus', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-subagent-'));
  runCli(['init'], cwd, () => {});

  const ws = resolveWorkspace(cwd);
  // Written straight to disk (not through the CLI's `add`) so corpus setup is
  // a one-time cost rather than 500 CLI invocations — the hook itself still
  // does the real work: reading and parsing every file on every call.
  for (let i = 0; i < CORPUS_SIZE; i++) writeItem(ws.projectRoot!, constraintItem(i));

  // Warm-up: lazy module init and cold file-cache reads are real cost but a
  // one-time one — not what the per-call ceiling is meant to protect.
  let last = '';
  for (let i = 0; i < WARMUP; i++) last = buildSubagentStartOutput(payload(cwd, `warmup-${i}`), cwd);

  // The premise, because a hook that selected nothing is fast and proves
  // nothing: this corpus really does deliver both tiers on this event.
  assert.match(last, /CONST-0/, 'the pinned tier delivered nothing, so nothing was timed');
  assert.match(last, /SubagentStart/, 'the envelope was not built, so this timed a no-op');

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const input = payload(cwd, `run-${i}`);
    const started = process.hrtime.bigint();
    buildSubagentStartOutput(input, cwd);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }

  const measured = p95(samples);
  assert.ok(
    measured < CEILING_MS,
    `subagent-start p95 was ${measured.toFixed(1)}ms (max ${Math.max(...samples).toFixed(1)}ms)`,
  );

  removeTree(cwd);
});
