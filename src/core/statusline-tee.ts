import { readFileSync, renameSync, writeFileSync } from 'node:fs';
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
// reading the installed 2.1.233 binary, and no test here fails when Claude
// Code changes it. The states are ordered so that every unrecognised shape
// degrades to 'unknown', never to a number.

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
    const tmp = `${file}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify({ receivedAt, payload }));
    renameSync(tmp, file);
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
