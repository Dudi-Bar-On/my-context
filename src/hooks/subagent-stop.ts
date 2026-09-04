import {
  closeSync, openSync, readFileSync, readSync, statSync,
} from 'node:fs';
import { recordAudit } from '../core/audit.ts';
import { isMainEntry } from '../core/paths.ts';
import { findProjectRoot } from '../core/workspace.ts';
import {
  capped, NOTE_MAX, observeAndRecord, type Observation, type ObservationSpec,
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
export function observeSubagentStop(input: HookInput): Observation | null {
  const agentId = input.agent_id;
  if (typeof agentId !== 'string' || agentId === '') return null;

  const type = typeof input.agent_type === 'string' && input.agent_type !== ''
    ? input.agent_type : '<absent>';

  return {
    note:
      `delivery=finished agent=${capped(agentId, 64)} type=${capped(type, 48)}; ` +
      'its seen file was left in place',
  };
}

export const SUBAGENT_STOP: ObservationSpec = {
  hook: 'SubagentStop',
  op: 'subagent-stop',
  observe: observeSubagentStop,
};

// ── `agent-step`: one row per tool call, backfilled once from the lane's own
// transcript (TASK-the-audit-stream-cannot-say-what-a-lane-was-doing-at-a-
// given) ─────────────────────────────────────────────────────────────────
//
// See `HOOK_OPS`'s own comment in `core/audit.ts` for the whole argument —
// why this is a `hook` op, why it joins on `agent_id` rather than the
// transcript's internal `agentId`, and why `at` is the transcript record's
// own timestamp. What follows is the bound and the extraction rule that
// comment promises.

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

/** The longest a plucked subject may be, before it joins the tool name and the agent id in `note`. */
const SUBJECT_MAX = 80;

/**
 * The one field of `tool_input` this code will ever put in a row, tried in
 * this order and stopping at the first STRING present.
 *
 * **Never the whole object.** `tool_input` carries file contents, command
 * output and prompt text — `HOOK_OPS`' comment on this op names the 5,207
 * rows this log already deleted once for exactly that shape of noise. Every
 * key here is chosen because it is normally SHORT and human-recognisable:
 * `description` is a tool's own one-line summary when it supplies one (the
 * `Agent` tool's, and increasingly `Bash`'s); the rest are the argument that
 * names WHAT a call acted on rather than what it did with it.
 *
 * A tool this list does not recognise — an MCP tool, a future built-in —
 * produces no match and falls through to `NO_SUBJECT`. That is the
 * `INSTR-read-the-design-record...`-mandated posture for a schema this
 * project does not own: skip what is not recognised, never guess at it.
 */
const SUBJECT_KEYS = [
  'description', 'file_path', 'notebook_path', 'command', 'pattern', 'query', 'url', 'path',
] as const;

const NO_SUBJECT = '<no subject>';

function subjectFor(toolInput: unknown): string {
  if (typeof toolInput !== 'object' || toolInput === null) return NO_SUBJECT;
  const obj = toolInput as Record<string, unknown>;
  for (const key of SUBJECT_KEYS) {
    const value = obj[key];
    if (typeof value === 'string' && value !== '') return value;
  }
  return NO_SUBJECT;
}

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

// Not `runObservationHook`: that shared runtime writes AT MOST ONE row per
// firing (`observe.ts`'s header states this as the whole point of sharing
// it), and this event now writes many. The `subagent-stop` row itself is
// still produced through the same `observeAndRecord` every other observation
// hook uses — nothing about ITS shape, gating or test coverage changes —
// and the transcript backfill runs alongside it, reading stdin once for both.
if (isMainEntry(import.meta.filename, process.argv[1])) {
  try {
    const { input, parseError } = parseHookInput(readStdin());
    if (parseError !== null) process.stderr.write(hookParseErrorLine(parseError));
    observeAndRecord(SUBAGENT_STOP, input, process.cwd());
    recordAgentSteps(input, process.cwd());
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
