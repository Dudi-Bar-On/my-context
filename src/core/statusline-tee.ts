import { readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ensureLogDir } from './jsonl-log.ts';

// --- The status line tee ----------------------------------------------------
//
// `mycontext statusline` (the §4b bridge) receives Claude Code's status-line
// JSON on stdin and tees it here, one file per session, so the web UI can
// join the real context number to what the audit log says mycontext injected
// — on `session_id`, the key the ledger and the audit records already use.
//
// The payload is stored WHOLE, verbatim, wrapped as { receivedAt, payload }.
// Shredding fields at write time is how an external schema that grows gets
// silently dropped (INV-nothing-is-dropped-silently); interpretation happens
// at read time, in `classifyContext`, the one tested spelling of §4b's three
// states. `receivedAt` is stamped by the bridge command and is what every
// "as of" age is computed from.
//
// EXTERNAL SCHEMA, marked as such (spec §4b): everything `classifyContext`
// knows about the payload — `context_window`, `current_usage` and its three
// input fields — is a claim about Claude Code's interface, established by
// reading the installed binary, and no test here fails when Claude Code
// changes it. First read on 2.1.233; RE-VERIFIED 2026-08-23 on the installed
// build 2.1.239 (GIT_SHA 9bf8e952…) — every field named above is still
// present and the builder is byte-identical to the 2.1.233 reading once the
// minifier's symbol names are normalised (TAw/wMo → pgA/HZo). The version is
// recorded because it dates the verification; it is not a claim that any
// other build behaves this way. The states are ordered so that every
// unrecognised shape degrades to 'unknown', never to a number.

export function statuslineDir(root: string): string {
  return path.join(root, '.statusline');
}

/**
 * A session id becomes a filename by REFUSAL, not by mangling: mangling two
 * distinct ids into one name would show one session's context as another's —
 * the exact failure keying by session exists to prevent. No leading dot, no
 * separators, ≤128 chars.
 */
export function sanitizeSessionId(id: string): string | null {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id) ? id : null;
}

export function teePath(root: string, sessionId: string): string | null {
  const safe = sanitizeSessionId(sessionId);
  return safe === null ? null : path.join(statuslineDir(root), `${safe}.json`);
}

/**
 * How old a `<session>.json.tmp-…` has to be before `sweepStaleTeeTemps` will
 * remove it.
 *
 * The only file this could wrongly delete is one a CONCURRENT writer is
 * between `writeFileSync` and `renameSync` on, so the gate has to sit far
 * above that window's real length. Measured on Windows/Node 24, 500 writes of
 * a real status-line payload: the WHOLE of `writeTee` runs p50 1.8 ms, p95
 * 3.0 ms, worst observed 15 ms — and the exposed window is a fraction of that,
 * being one `writeFileSync` of a few hundred bytes plus one rename syscall.
 * An hour is roughly a thousand times the worst case observed, which is the
 * margin an age gate standing between a live file and `rmSync` should have,
 * while still bounding a directory that gains at most one leftover per killed
 * process.
 *
 * Deliberately NOT the 30 days that
 * `core/ledger.ts` · `export const SNAPSHOT_MAX_AGE_MS` · ~780 gives
 * `state/`: that retention protects snapshots and seen-files, which are DATA a
 * later run may still need. A tee temp file is a discarded write that no
 * reader has ever opened — `readTee` only ever opens `<session>.json` — so
 * there is nothing on the other side of the trade to be generous towards.
 */
export const TEE_TMP_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * A temp file this module wrote: the sample's own name, then `.tmp-<pid>` and
 * optionally `-<counter>`.
 *
 * Anchored at the END rather than matching `.tmp-` anywhere in the name, which
 * is what `core/ledger.ts` · `|| entry.name.includes('.tmp-'))) continue;` · ~819
 * can afford on `state/` and this cannot: `sanitizeSessionId` accepts `.` and
 * `-`, so `run.tmp-3` is a legal session id whose real sample is named
 * `run.tmp-3.json`. A substring predicate would sweep a live session's sample
 * and the UI would show that session as never having reported.
 */
const TEE_TMP_NAME = /\.json\.tmp-\d+(?:-\d+)?$/;

/**
 * Removes tee temp files older than `maxAgeMs` from `<root>/.statusline`, and
 * returns how many went. **Never throws** — an unreadable directory, an
 * entry that cannot be stat'd and a removal that fails all degrade to "leave
 * it for the next sweep", the same way `pruneSnapshots` does, because this is
 * housekeeping and no sample is worth failing over.
 *
 * **Why this exists at all when `writeTee` now cleans up its own failures.**
 * The cleanup below covers every path where `writeTee` RETURNS. It cannot
 * cover the one where the process does not: a bridge process killed between
 * the write and the rename leaves a temp file no `catch` will ever run for.
 * That is a real shape here — `mycontext statusline` is a fresh process per
 * assistant message, on Claude Code's own timeout — and it is the only source
 * of new orphans left. Nothing else sweeps `.statusline/`: `pruneSnapshots`
 * walks `state/` only.
 *
 * A swept temp file is NOT disclosed to the caller, matching
 * `hooks/session-start.ts` · `leftover carries no such consequence, so the` · ~78:
 * nothing ever reads one, so removing it costs a reader nothing there is to
 * say. `INV-nothing-is-dropped-silently` is about dropping what someone would
 * otherwise have received.
 *
 * **What it costs, because `writeTee` calls it on Claude Code's per-message
 * path** (the addendum's §8.4 concern, and the reason ui3 task 4 ships a perf
 * test). One `readdirSync` plus one `statSync` per NAME THAT MATCHES — a
 * sample file costs only the regex, never a stat. Measured on Windows/Node 24
 * against `.statusline/` holding one leftover and: 1 sample p50 0.24 ms, 200
 * samples p50 0.41 ms, 1,000 p50 1.11 ms, 5,000 p50 4.37 ms, beside a
 * `writeTee` whose own p50 is 1.8 ms. Linear in directory size, and the
 * directory gains one file per session and has nothing that prunes THOSE —
 * so a workspace with thousands of sessions behind it pays milliseconds here.
 * That bound belongs to whoever prunes the samples, which nothing yet does.
 */
export function sweepStaleTeeTemps(root: string, maxAgeMs: number = TEE_TMP_MAX_AGE_MS): number {
  const dir = statuslineDir(root);
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }

  const cutoff = Date.now() - maxAgeMs;
  let swept = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !TEE_TMP_NAME.test(entry.name)) continue;
    const full = path.join(dir, entry.name);
    try {
      if (statSync(full).mtimeMs < cutoff) {
        rmSync(full, { force: true });
        swept++;
      }
    } catch {
      // Could not stat or remove this one entry — leave it for a later sweep.
    }
  }
  return swept;
}

/**
 * A per-process counter, so no two writes from this process can ever name the
 * same temp file.
 * `core/rebuild.ts` · `The temp name carries both the pid and a per-process counter` · ~373
 * gives the reason, and it is what makes the cleanup below provably safe: the
 * path being removed on the failure branch cannot be a file any other writer
 * — in this process or another — has created in the meantime.
 */
let writeCounter = 0;

export function writeTee(
  root: string,
  payload: unknown,
  receivedAt: string = new Date().toISOString(),
): { written: boolean; reason?: string } {
  const sid = (payload as { session_id?: unknown } | null)?.session_id;
  if (typeof sid !== 'string') {
    return { written: false, reason: 'the payload carries no string session_id' };
  }
  const file = teePath(root, sid);
  if (file === null) {
    return { written: false, reason: `session_id ${JSON.stringify(sid)} is not a safe filename — refusing rather than renaming it` };
  }
  try {
    ensureLogDir(statuslineDir(root));
    // Atomic: the UI reads this file while Claude Code rewrites it on every
    // response. A rename is whole-or-old; a plain overwrite can be read torn.
    const tmp = `${file}.tmp-${process.pid}-${writeCounter++}`;
    try {
      writeFileSync(tmp, JSON.stringify({ receivedAt, payload }));
      renameSync(tmp, file);
    } catch (err) {
      // **The cleanup is in the CATCH, not in a `finally`, and that is the
      // whole fix.** The atomic write is correct for the writer whose rename
      // lands; what leaked was the other one. On Windows `renameSync` is
      // `MoveFileEx`, and replacing a destination a reader holds open fails
      // EPERM outright rather than merely losing — `writeTee` then reports
      // `written: false`, the previous WHOLE sample stays on disk (the right
      // degradation; `receivedAt` is what exposes its age), and the temp file
      // this call had already written was left in `.statusline/` forever. One
      // per losing process, and the bridge is a fresh process per message.
      //
      // A `finally` is the obvious shape and is the wrong one: it would run
      // after a rename that SUCCEEDED, where `tmp` is a path this process no
      // longer owns. It happens to be harmless today only because the counter
      // above makes that path unique and `force: true` swallows ENOENT — a
      // safety that rests on two coincidences instead of on control flow. In
      // the `catch`, the removal is unreachable unless the rename threw, and a
      // rename that throws moved nothing.
      //
      // It also covers the earlier failure — a `writeFileSync` that ran out of
      // disk part-way leaves a partial temp file, and that is a leftover too.
      try { rmSync(tmp, { force: true }); } catch { /* best-effort: nothing reads a temp file */ }
      throw err;
    }
    // AFTER the sample is on disk, never before, so the reader gets its fresh
    // sample without waiting on housekeeping — the ordering, and the reason
    // for it, of
    // `hooks/session-start.ts` · `**Why here, after the write to stdout.** The model already has its text, so` · ~49.
    // What keeps this from deleting a temp file some OTHER writer is about to
    // rename is not the ordering but `TEE_TMP_MAX_AGE_MS`; see there.
    //
    // On the failure branch above there is deliberately no sweep: that writer
    // has already removed its own leftover, and a tee whose every write fails
    // is a broken statusline rather than a housekeeping problem.
    //
    // Wrapped even though `sweepStaleTeeTemps` never throws, for the reason
    // `sweepStaleState` wraps `pruneSnapshots`: the sample is ALREADY on disk
    // by this line, so a throw escaping here would be caught below and report
    // `written: false` for a write that succeeded — housekeeping lying about
    // the thing it was housekeeping for.
    try { sweepStaleTeeTemps(root); } catch { /* never a reason to fail a written sample */ }
    return { written: true };
  } catch (err) {
    return { written: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * `null` means "no sample": bridge not installed, session never sampled, an
 * unsafe id, or a file a killed process left unreadable. All of those must
 * render as the no-sample state, not crash a screen.
 */
export function readTee(root: string, sessionId: string): { receivedAt: string; payload: unknown } | null {
  const file = teePath(root, sessionId);
  if (file === null) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { receivedAt?: unknown; payload?: unknown };
    if (typeof parsed.receivedAt !== 'string' || parsed.payload === undefined) return null;
    return { receivedAt: parsed.receivedAt, payload: parsed.payload };
  } catch {
    return null;
  }
}

/**
 * §4b's three states, in one place:
 *  - 'unknown':        the payload has no usable `context_window` (older
 *                      Claude Code build, or a shape this code does not
 *                      recognise). An absent measurement is a state, not 0.
 *  - 'not-yet-known':  `current_usage` is null — after a compact, before the
 *                      next API call. Claude Code sends total_input_tokens: 0
 *                      here; the gate is `current_usage === null` and never
 *                      that 0 (§4b constraint 2).
 *  - 'known':          computed INPUT-ONLY — input + cache_creation +
 *                      cache_read over context_window_size — matching what
 *                      Claude Code itself displays (§4b constraint 3; the
 *                      binary's own total_input_tokens does this arithmetic).
 */
export type ContextState = 'unknown' | 'not-yet-known' | 'known';

export interface ContextSample {
  state: ContextState;
  usedTokens: number | null;
  windowSize: number | null;
  percent: number | null;
}

const UNKNOWN: ContextSample = { state: 'unknown', usedTokens: null, windowSize: null, percent: null };

export function classifyContext(payload: unknown): ContextSample {
  const cw = (payload as { context_window?: unknown } | null)?.context_window;
  if (cw === null || cw === undefined || typeof cw !== 'object') return UNKNOWN;
  const win = cw as { context_window_size?: unknown; current_usage?: unknown };
  const windowSize = typeof win.context_window_size === 'number' ? win.context_window_size : null;
  if (win.current_usage === null || win.current_usage === undefined) {
    return { state: 'not-yet-known', usedTokens: null, windowSize, percent: null };
  }
  if (typeof win.current_usage !== 'object') return UNKNOWN;
  const usage = win.current_usage as Record<string, unknown>;
  const num = (key: string): number | null => (typeof usage[key] === 'number' ? (usage[key] as number) : null);
  const input = num('input_tokens');
  const cacheCreation = num('cache_creation_input_tokens');
  const cacheRead = num('cache_read_input_tokens');
  if (input === null || cacheCreation === null || cacheRead === null) return UNKNOWN;
  const usedTokens = input + cacheCreation + cacheRead;
  const percent = windowSize !== null && windowSize > 0 ? (usedTokens / windowSize) * 100 : null;
  return { state: 'known', usedTokens, windowSize, percent };
}

/**
 * One of the account's rate-limit windows, or `null` for a window the payload
 * did not carry in a shape this code recognises.
 */
export interface RateWindow {
  /** `used_percentage`, verbatim. */
  usedPercent: number;
  /** `resets_at`, unix SECONDS — `null` when the payload carried none. */
  resetsAt: number | null;
}

export interface RateLimits {
  fiveHour: RateWindow | null;
  sevenDay: RateWindow | null;
}

/**
 * The account's five-hour and seven-day windows, out of the same stored payload
 * `classifyContext` reads — **EXTERNAL SCHEMA, marked as such**, exactly as the
 * `context_window` reading above is.
 *
 * `rate_limits: { five_hour: { used_percentage, resets_at }, seven_day: {…} }`
 * is Claude Code's shape, verified against real captured payloads on this
 * machine (`.my_context/.statusline/<session>.json`, 2026-08-31: five_hour 16%,
 * seven_day 50%). No test here fails when Claude Code changes it; every
 * unrecognised shape degrades to `null`, never to a number.
 *
 * **Absence is answered at three levels and every one of them is `null`, not
 * zero.** `rate_limits` is optional; a window inside it can be missing on its
 * own; and `used_percentage` can arrive as a shape this code will not read
 * (`'12'` as a string is a real observed case in the powerline lane's own
 * fixtures). A window nobody reported is not a window measured at 0%, and
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` asks for the
 * measured zero to be drawn — not for an unmeasured one to be invented.
 *
 * `resets_at` is kept separately nullable: a percentage with no reset time is
 * still worth drawing, and it is the caller's business whether to show a
 * countdown it was given no end for.
 */
export function classifyRateLimits(payload: unknown): RateLimits {
  const limits = (payload as { rate_limits?: unknown } | null)?.rate_limits;
  if (limits === null || limits === undefined || typeof limits !== 'object') {
    return { fiveHour: null, sevenDay: null };
  }
  const read = (key: string): RateWindow | null => {
    const raw = (limits as Record<string, unknown>)[key];
    if (raw === null || raw === undefined || typeof raw !== 'object') return null;
    const window = raw as Record<string, unknown>;
    const used = window['used_percentage'];
    if (typeof used !== 'number' || !Number.isFinite(used)) return null;
    const resets = window['resets_at'];
    return {
      usedPercent: used,
      resetsAt: typeof resets === 'number' && Number.isFinite(resets) ? resets : null,
    };
  };
  return { fiveHour: read('five_hour'), sevenDay: read('seven_day') };
}

/* == WHAT CLAUDE CODE'S PAYLOAD CARRIES BESIDE THE CONTEXT WINDOW ==========
 *
 * **Moved here from `cli/commands/statusline-powerline.ts` on 2026-09-01, and
 * the move is the point.** The web strip became a SUPERSET of the terminal
 * status line that day, which means the browser now draws the model's modes,
 * the cost and the cache share — every one of them read off the SAME stored
 * payload `classifyContext` and `classifyRateLimits` already read here.
 *
 * A second reader for the browser would have been a second spelling of an
 * EXTERNAL schema: this project's most-repeated defect, in the one place where
 * the thing being agreed with is not even ours. So the parse lives in the
 * module that owns the tee, both surfaces call it, and
 * `statusline-powerline.ts` re-exports it so its own callers are unchanged.
 */
/**
 * One rate-limit window, as Claude Code reports it.
 *
 * Both fields are separately optional because both are separately absent in
 * real payloads: `rate_limits` itself is optional, and a window inside it can
 * arrive with a percentage and no reset, or the reverse. `null` renders
 * nothing rather than a placeholder — a `?` in a block is a claim that
 * something is wrong, and an absent field is not a fault.
 */
export interface RateLimit {
  /** 0–100, as sent. */
  usedPercent: number | null;
  /** UNIX SECONDS, as sent — not milliseconds. Converted once, in `until`. */
  resetsAt: number | null;
}

/**
 * The model's non-default modes, folded into the model block.
 *
 * Every one of these renders ONLY when it is not the ordinary case, so a
 * ordinary session pays zero columns for the whole group. `null` is "the
 * payload did not say", which is treated exactly like the default: this bar
 * does not report the absence of a field, only the presence of a state.
 *
 * **`effort` carries an assumption and it is written down here rather than
 * left in the code.** `thinking`, `fast_mode` and `exceeds_200k_tokens` are
 * booleans whose default is plainly `false`. `effort.level` is a WORD, and
 * this file has no way to observe which word means "unchanged" — it is
 * `'medium'` on every payload read on this machine, so `'medium'` is treated
 * as the default and suppressed. If Claude Code's default moves, the symptom
 * is a block that is always there rather than one that is never there, which
 * is the harmless direction.
 */
export interface ModelModes {
  effort: string | null;
  thinking: boolean | null;
  fastMode: boolean | null;
  exceeds200k: boolean | null;
}

export const DEFAULT_EFFORT = 'medium';

/**
 * Everything this bar reads off Claude Code's payload beyond the model name.
 *
 * EXTERNAL SCHEMA, and read the way `core/statusline-tee.ts` reads one: every
 * field is optional at every level, every wrong type is an absence, and an
 * absence renders NOTHING rather than a placeholder. The set of fields was
 * confirmed present in this machine's own tee captures rather than taken from
 * documentation; `prompt_cache`, `pr`, `vim`, `agent` and `git_worktree` were
 * confirmed ABSENT and are deliberately not read, because a reader written
 * against a field nobody has seen is a reader nothing can test.
 */
export function payloadExtras(payload: unknown): {
  modes: ModelModes;
  fiveHour: RateLimit | null;
  sevenDay: RateLimit | null;
  costUsd: number | null;
  warmPercent: number | null;
  sessionName: string | null;
} {
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
  const obj = (v: unknown): Record<string, unknown> | null =>
    typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;

  const p = obj(payload) ?? {};
  const effortLevel = obj(p['effort'])?.['level'];
  const modes: ModelModes = {
    effort: typeof effortLevel === 'string' ? effortLevel : null,
    thinking: bool(obj(p['thinking'])?.['enabled']),
    fastMode: bool(p['fast_mode']),
    exceeds200k: bool(p['exceeds_200k_tokens']),
  };

  const window = (raw: unknown): RateLimit | null => {
    const w = obj(raw);
    if (w === null) return null;
    const usedPercent = num(w['used_percentage']);
    const resetsAt = num(w['resets_at']);
    return usedPercent === null && resetsAt === null ? null : { usedPercent, resetsAt };
  };
  const limits = obj(p['rate_limits']);

  const usage = obj(obj(p['context_window'])?.['current_usage']);
  const read = num(usage?.['cache_read_input_tokens']);
  const created = num(usage?.['cache_creation_input_tokens']);
  const fresh = num(usage?.['input_tokens']);
  // The denominator is the input total Claude Code itself displays, which is
  // also `classifyContext`'s numerator for the occupancy: one arithmetic, two
  // readers. A zero total is not 0% warm — it is nothing to divide.
  const total = (read ?? 0) + (created ?? 0) + (fresh ?? 0);
  const warmPercent =
    read === null || total <= 0 ? null : (read / total) * 100;

  return {
    modes,
    fiveHour: window(limits?.['five_hour']),
    sevenDay: window(limits?.['seven_day']),
    costUsd: num(obj(p['cost'])?.['total_cost_usd']),
    warmPercent,
    // Read here rather than beside the model, because it is a fact about the
    // SESSION and not about the model: two windows on one model and one repo
    // differ only by this.
    sessionName: typeof p['session_name'] === 'string' ? p['session_name'] : null,
  };
}

/**
 * **The modes worth drawing, in order, as WORDS.** Shared by both bars since
 * 2026-09-01: the terminal folds them into its model block and the web strip
 * draws them beside the model name, and which words count as "not the ordinary
 * case" is one judgement about an external payload rather than two.
 *
 * Every entry renders ONLY when it is not the ordinary case, so an ordinary
 * session pays nothing for the whole group. `null` is "the payload did not
 * say", treated exactly as the default: this reports the presence of a state,
 * never the absence of a field.
 *
 * Words and not glyphs. A bare mark carries meaning only to a reader who
 * already knows it, which is a hue's problem wearing a different hat.
 */
export function modeFlags(modes: ModelModes): string[] {
  const flags: string[] = [];
  if (modes.effort !== null && modes.effort !== '' && modes.effort !== DEFAULT_EFFORT) {
    flags.push(modes.effort);
  }
  if (modes.thinking === true) flags.push('think');
  if (modes.fastMode === true) flags.push('fast');
  if (modes.exceeds200k === true) flags.push('200k+');
  return flags;
}

/**
 * **The session name, but only when it tells two windows apart.**
 *
 * `null` when the payload sent none and when it merely restates the project:
 * a session called after its project repeats a block already on the bar, and
 * this field's whole job is distinguishing two windows whose model, project
 * and branch are identical — the ordinary case for anyone running more than
 * one.
 *
 * Compared trimmed and case-insensitively, because "My-Context" and
 * "my-context" are the same answer to "which window is this".
 *
 * Shared by both bars for the reason `modeFlags` is: two spellings of one
 * suppression rule is two bars that disagree about whether to draw a field.
 */
export function distinctSessionName(
  sessionName: string | null, project: string | null,
): string | null {
  const named = sessionName?.trim() ?? '';
  const owner = project?.trim() ?? '';
  if (named === '') return null;
  return named.toLowerCase() === owner.toLowerCase() ? null : named;
}
