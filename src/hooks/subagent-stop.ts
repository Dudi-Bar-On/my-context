import {
  closeSync, openSync, readFileSync, readSync, statSync,
} from 'node:fs';
import { recordAudit } from '../core/audit.ts';
import { isMainEntry } from '../core/paths.ts';
import { findProjectRoot } from '../core/workspace.ts';
import {
  capped, NOTE_MAX, observeAndRecord, subjectFor, SUBJECT_MAX,
  type Observation, type ObservationSpec,
} from './observe.ts';
import { hookParseErrorLine, parseHookInput, readStdin, type HookInput } from './io.ts';

/**
 * The end of the dispatch `SubagentStart` opened.
 *
 * `hooks/subagent-start.ts` writes two rows per dispatch on purpose: an
 * `injection` row saying `delivery=attempted agent=<id>` BEFORE the selection,
 * and the completion row `buildInjection` writes after it, so that a hook
 * killed at its `hooks.json` timeout leaves an attempt with no completion and
 * the kill becomes evidence rather than silence. What that pair could never say
 * is whether the SUBAGENT then finished. A dispatch that started, received its
 * knowledge, and was killed or abandoned looks in the log exactly like one that
 * ran to the end. This row is the difference, and all three carry the PARENT's
 * `session_id`, so `mycontext audit --session <parent>` already shows them
 * together.
 *
 * **`agent_id` is the gate, for `subagent-start.ts`'s reason turned around.**
 * There it is the gate because injecting under a bare `session_id` would write
 * the parent's dedupe state. Here nothing is written but a row, and a row that
 * cannot name the agent cannot be paired with the two that opened the dispatch
 * — which is the only thing it is for. So a payload with no `agent_id` records
 * nothing.
 *
 * ── WHAT IT DOES NOT DO, AND THIS ONE IS A REAL COST ───────────────────────
 *
 * **It does not clear the subagent's delivery state.** Every dispatch writes a
 * seen file keyed `<session_id>::<agent_id>` (`hooks/io.ts` · `ledgerKey`), a
 * subagent's `agent_id` is minted per dispatch, and those files are only ever
 * removed by `SessionEnd(reason: clear)` on the parent — through
 * `clearWindowState`, which takes the siblings with it — or by the 30-day
 * sweep. A long parent session that dispatches many subagents therefore
 * accumulates one file per dispatch until it ends. This event is where that
 * would be fixed, and it is not fixed here: pruning is a change to the dedupe
 * state, which `hooks/post-compact.ts` already declined to make for the same
 * reason and left to the owner. The event is registered and the id is in the
 * log, so the size of the problem can now be read rather than argued about.
 *
 * **It fills no `additionalContext`.** The event has one (build 2.1.239, byte
 * 303352663) and the platform describes it as feedback delivered to the model.
 * A subagent that has stopped has no more turns; the parent does, and speaking
 * into the parent's context because a subagent ended is a product decision
 * nobody has made.
 *
 * **No matcher.** The matcher on this event is tested against `agent_type`
 * (build 2.1.239, byte 317139714), which is an open set — every agent type a
 * user or plugin defines — so any matcher at all would silently skip the types
 * it did not enumerate. `SubagentStart` is registered the same way, and the
 * clear probe measured both silent on a prompt that dispatched nothing, which
 * is a measured silence rather than an assumed one
 * (`reports/probes/2026-08-20-clear-and-prompt-hooks.md` §3c).
 */
/**
 * **`type=<absent>` is not a missing value — it names a DIFFERENT KIND of firing.**
 *
 * Measured on 2026-09-04 (`TASK-the-step-backfill-produces-nothing-for-ninety-eight-percent`):
 * on the live corpus, 96%+ of `SubagentStop` firings carry no `agent_type`, and — decisively —
 * NONE of those ids ever gets a `subagents/agent-<id>.jsonl` transcript file written for it,
 * while every `agent_type`-carrying firing does (0 of 100 retained transcripts matched a
 * `type=<absent>` id; all 100 matched a typed one). A live, isolated probe (a throwaway
 * `claude -p` session under a custom `--settings`, touching nothing in this repo) confirms an
 * ordinary Task-tool dispatch — flat or nested — always carries `agent_type` and always gets a
 * working transcript; `recordAgentSteps` backfills it correctly when it does (traced against a
 * real 1.7 MB transcript: 82/82 tool_use blocks recovered).
 *
 * Reading the platform's own build (2.1.260, static): `SubagentStop` and the top-level `Stop`
 * event are emitted by ONE shared generator, keyed only on whether the current turn's context
 * carries an `agentId` — `agent_type:k??""`, where `k` is whatever `.agentType` that context
 * object happens to hold. At least five call sites reuse it, including a `"loop_tick"` turn and
 * an interrupted-query cleanup path, none of them a Task-tool dispatch. So a `SubagentStop`
 * firing with no `agent_type` is not this project's own dispatch losing its label — it is the
 * platform's shared "a turn carrying an agent id ended" signal, firing for something that was
 * never a named lane and never got a transcript to back-fill from. `recordAgentSteps` returning
 * zero rows for it is therefore CORRECT, not a parsing failure — but a bare `type=<absent>` does
 * not say that, and a reader (or a screen drawing "0 steps") cannot tell it apart from a real
 * lane that simply did nothing. This note says it explicitly, so nobody has to re-derive it a
 * fifth time.
 *
 * **Since 2026-09-04 the two cases also write two different OPS**
 * (`TASK-a-third-of-the-audit-feed-is-stop-rows-for-things-that-were`,
 * hooks/34). The note above already told them apart in PROSE; on the owner's
 * own screen every `type=<absent>` firing still drew as an empty, unopenable
 * lane, because the watch screen's lane grouping joins on the OP
 * (`ui/public/screens/watch.js`'s `LANE_OPS`), not on the note's text. A
 * typed firing keeps writing `subagent-stop`, unchanged. An untyped one now
 * writes `subagent-stop-untyped` — still recorded, still carrying the exact
 * same explanatory note, just no longer eligible to be grouped as a lane.
 * See `HOOK_OPS`'s own comment in `core/audit.ts` for the three options this
 * task weighed and why this one won.
 */
export function observeSubagentStop(input: HookInput): Observation | null {
  const agentId = input.agent_id;
  if (typeof agentId !== 'string' || agentId === '') return null;

  const hasType = typeof input.agent_type === 'string' && input.agent_type !== '';
  const type = hasType ? input.agent_type! : '<absent>';
  const typeNote = hasType
    ? ''
    : ' (no agent_type on this firing — not a named lane; no step backfill will be attempted)';

  return {
    note:
      `delivery=finished agent=${capped(agentId, 64)} type=${capped(type, 48)}${typeNote}; ` +
      'its seen file was left in place',
    ...(hasType ? {} : { op: 'subagent-stop-untyped' }),
  };
}

export const SUBAGENT_STOP: ObservationSpec = {
  hook: 'SubagentStop',
  op: 'subagent-stop',
  observe: observeSubagentStop,
};

// ── `agent-step`: one row per tool call ─────────────────────────────────────
//
// See `HOOK_OPS`'s own comment in `core/audit.ts` for the whole argument —
// why this is a `hook` op, why it joins on `agent_id` rather than the
// transcript's internal `agentId`, and why `at` is the transcript record's
// own timestamp when there is one. What follows is the bound and the
// extraction rule that comment promises.
//
// **NO LONGER CALLED FROM THIS HOOK'S MAIN ENTRY**
// (TASK-a-lane-step-is-recorded-as-it-happens-because-the-hook, hooks/33).
//
// A probe on 2026-09-04 (`reports/probes/2026-09-04-live-steps-and-the-stop-
// event-that-is-not-a-lane.md`) measured that `PostToolUse` fires live, per
// tool call, minutes before `SubagentStop` — and that its payload already
// carries `agent_id`/`agent_type`. `hooks/post-tool-use.ts`'s
// `agentStepNote` now writes this SAME `agent-step` shape from THAT firing,
// in real time, for every widened-matcher tool call inside a lane.
//
// **The duplication decision, stated once, here: the live writer is the
// ONLY writer.** The alternative this task named — "the backfill stops when
// live rows exist" — was rejected after checking its actual cost: the only
// way to know whether live rows already exist for an agent id is to read
// the audit log back (`core/audit.ts`'s `readAudit` has no bounded/indexed
// lookup by agent id), which means every `SubagentStop` firing — including
// the ~97% that are not real lanes at all, see `observeSubagentStop` above —
// would pay a full-log read against this hook's 3-second budget, to save a
// write this project's own probe already proved does not happen. A
// read-before-write race is also a second failure mode
// (`INV-hooks-fail-open`) this hook did not have before. Reconciling on read
// was ruled out for the same reason it is ruled out everywhere else in this
// task: that logic lives in `core/render.ts`/`core/select.ts`/`src/ui/**`,
// none of which this task owns.
//
// `recordAgentSteps` and `transcriptSteps` are kept, exported, and still
// fully covered by `test/hooks/subagent-stop-steps.test.ts` — they are
// correct, tested pure functions, callable directly (a future manual
// recovery path, or a fallback a later ruling could re-wire) — they are
// simply no longer invoked automatically, so a real `SubagentStop` firing no
// longer produces a second copy of a step `post-tool-use.ts` already wrote
// live. See this task's own report for the measurement that proves no
// duplication follows from this.

/**
 * The most of a transcript this hook will ever read: 8 MiB, the same
 * magnitude `core/audit.ts` already trusts for a synchronous read inside a
 * hook — it is `AUDIT_MAX_BYTES`, the size the audit log itself rotates at.
 * Measured transcripts on this project run up to ~6 MiB for one lane, so 8
 * MiB is headroom over the ordinary case and a real ceiling on the pathological
 * one: `SubagentStop`'s own `hooks.json` timeout is 3 SECONDS, and a read
 * with no bound at all would let one runaway transcript threaten every
 * dispatch that follows it.
 *
 * **When the file is larger, the TAIL is read, not the head.** The bound has
 * to drop something, and the tail is the more informative half for what this
 * op exists to answer: `SubagentStop` fires at the END of a lane, so the most
 * recent activity is the activity closest to why the hook is running at all.
 * The cut is aligned to the next newline (see `readTranscriptTail`), so a
 * record split by the cut is one skippable fragment rather than a byte
 * offset that corrupts every line after it.
 */
export const MAX_TRANSCRIPT_READ_BYTES = 8 * 1024 * 1024;

/**
 * The most rows one `SubagentStop` firing will ever write. `recordAudit`
 * appends with its own `stat`+`open`+`read`+`close`+`appendFileSync` per
 * call (`core/jsonl-log.ts`), so the row COUNT — not just the bytes read — is
 * what bounds this hook's wall-clock cost against its 3-second timeout. The
 * task that asked for this op measured ~150 rows for one ordinary lane;
 * 1,000 is headroom over that, not a target, and is expected to never bind in
 * practice.
 */
export const MAX_STEP_ROWS = 1000;

/**
 * The transcript's bytes, bounded to `MAX_TRANSCRIPT_READ_BYTES` and aligned
 * to a line boundary. `''` for an absent, empty, or unreadable file — every
 * one of those is "nothing to record", never a throw (`INV-hooks-fail-open`).
 */
function readTranscriptTail(file: string): string {
  let size: number;
  try {
    size = statSync(file).size;
  } catch {
    return ''; // absent, or otherwise unreadable — record nothing
  }
  if (size === 0) return '';
  if (size <= MAX_TRANSCRIPT_READ_BYTES) {
    try {
      return readFileSync(file, 'utf8');
    } catch {
      return '';
    }
  }
  // Larger than the bound: read only the final MAX_TRANSCRIPT_READ_BYTES
  // bytes, then drop everything up to and including the first newline in
  // that window — the partial record the cut may have landed inside. What
  // remains starts on a real line boundary.
  let fd: number;
  try {
    fd = openSync(file, 'r');
  } catch {
    return '';
  }
  try {
    const start = size - MAX_TRANSCRIPT_READ_BYTES;
    const buf = Buffer.alloc(size - start);
    readSync(fd, buf, 0, buf.length, start);
    const text = buf.toString('utf8');
    const firstNewline = text.indexOf('\n');
    return firstNewline === -1 ? '' : text.slice(firstNewline + 1);
  } catch {
    return '';
  } finally {
    closeSync(fd);
  }
}

/** One row this op will write: the note, and the transcript's own timestamp when it had one. */
export interface AgentStep {
  at?: string;
  note: string;
}

/**
 * Every `tool_use` block in `transcriptPath`, turned into one step each — the
 * whole of what `agent-step` writes, kept separable from `recordAudit` so a
 * test can assert on the parsed shape without a workspace.
 *
 * **The three failure modes this task named, each handled here.** An absent
 * or empty file returns `[]` (`readTranscriptTail`). A line that is not valid
 * JSON, is not an object, or has no `message.content` array is SKIPPED — one
 * bad line costs one row, never the rows around it, and never a throw. A
 * `content` block whose `type` is not `tool_use` (text, thinking, a tool
 * result) is skipped the same way; this function does not attempt to
 * enumerate every block type the harness may send, because that schema
 * belongs to the harness and can change without notice.
 *
 * Order is preserved: lines are walked top to bottom, blocks within one
 * line left to right, and the caller appends in the order returned — which
 * is also the order `recordAudit` writes them in, since each row is a
 * separate synchronous append.
 */
export function transcriptSteps(transcriptPath: string, agentId: string): AgentStep[] {
  const raw = readTranscriptTail(transcriptPath);
  if (raw === '') return [];

  const out: AgentStep[] = [];
  for (const line of raw.split('\n')) {
    if (out.length >= MAX_STEP_ROWS) break;
    if (line.trim() === '') continue;

    let row: unknown;
    try {
      row = JSON.parse(line);
    } catch {
      continue; // a malformed line — skip it, its neighbours still record
    }
    if (typeof row !== 'object' || row === null) continue;

    const message = (row as Record<string, unknown>).message;
    const content = typeof message === 'object' && message !== null
      ? (message as Record<string, unknown>).content
      : undefined;
    if (!Array.isArray(content)) continue; // an unrecognised or content-less record shape

    const timestamp = (row as Record<string, unknown>).timestamp;
    const at = typeof timestamp === 'string' && timestamp !== '' ? timestamp : undefined;

    for (const block of content) {
      if (out.length >= MAX_STEP_ROWS) break;
      if (typeof block !== 'object' || block === null) continue;
      if ((block as Record<string, unknown>).type !== 'tool_use') continue;

      const name = (block as Record<string, unknown>).name;
      const tool = typeof name === 'string' && name !== '' ? name : '<absent>';
      const subject = capped(subjectFor((block as Record<string, unknown>).input), SUBJECT_MAX);
      const note = capped(`${tool}: ${subject} agent=${agentId}`, NOTE_MAX);

      out.push(at === undefined ? { note } : { at, note });
    }
  }
  return out;
}

/**
 * Backfills `agent-step` rows for one `SubagentStop` firing. Never throws
 * (`INV-hooks-fail-open`); a session ending is the one moment this hook must
 * not delay or break.
 *
 * **Gated on `agent_id`, before anything is read**, for `observeSubagentStop`'s
 * own reason: a row that cannot name the agent cannot be paired with the
 * dispatch and stop rows either side of it, so a payload with none records
 * nothing here either. Gated on `agent_transcript_path` next — no path, no
 * source. `findProjectRoot` (not `resolveWorkspace`) for the reason every
 * other hook on this file's neighbours give at their own resolution: it does
 * not throw on a broken `config.json`, so a broken config costs this backfill
 * rather than the whole hook.
 */
export function recordAgentSteps(input: HookInput, fallbackCwd: string): void {
  try {
    const agentId = input.agent_id;
    if (!agentId) return;
    const transcriptPath = input.agent_transcript_path;
    if (!transcriptPath) return;

    const cwd = input.cwd ?? fallbackCwd;
    const root = findProjectRoot(cwd);
    if (!root) return;

    const steps = transcriptSteps(transcriptPath, agentId);
    for (const step of steps) {
      recordAudit(root, {
        kind: 'hook',
        op: 'agent-step',
        hook: 'SubagentStop',
        ...(input.session_id === undefined ? {} : { sessionId: input.session_id }),
        ...(step.at === undefined ? {} : { at: step.at }),
        note: step.note,
      });
    }
  } catch {
    // INV-hooks-fail-open. A knowledge base that breaks a session is worse
    // than one that says nothing.
  }
}

// Not `runObservationHook`: `SUBAGENT_STOP`'s own `subagent-stop` row is
// still produced through the same `observeAndRecord` every other observation
// hook uses — nothing about ITS shape, gating or test coverage changes.
//
// `recordAgentSteps` is deliberately NOT called here any more — see the
// duplication-decision comment above `MAX_TRANSCRIPT_READ_BYTES`. Calling it
// here today would write a second `agent-step` row for every step
// `post-tool-use.ts`'s live `agentStepNote` already wrote for this same
// lane while it ran.
if (isMainEntry(import.meta.filename, process.argv[1])) {
  try {
    const { input, parseError } = parseHookInput(readStdin());
    if (parseError !== null) process.stderr.write(hookParseErrorLine(parseError));
    observeAndRecord(SUBAGENT_STOP, input, process.cwd());
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
