/**
 * **How many tool calls have gone by since anybody last looked at this
 * session** — the cheapest half of the self-improvement loop's trigger,
 * `plan:loop seq:2`, design
 * `docs/superpowers/specs/2026-09-08-self-improvement-loop-design.md` §2.
 *
 * ── WHAT THIS DECIDES, AND WHAT IT DELIBERATELY DOES NOT ───────────────────
 *
 * It decides **when to CONSIDER looking**, and nothing else. The design is
 * explicit that a fixed counter is measured *inferior* to a rubric-gated
 * trigger — +6.3 points on BrowseComp at 30-70% lower token cost
 * (arXiv:2606.23525) — because a fixed threshold "pays no heed to trajectory
 * structure" and fires mid-derivation. So this counts, `review/rubric.ts`
 * decides, and `fires` is what the ration is measured against.
 *
 * ── WHY IT IS A FILE AND NOT A NUMBER IN MEMORY ────────────────────────────
 *
 * Every hook here is a PROCESS. `PostToolUse` is spawned once per tool call
 * and exits; there is no resident thing to hold a count. The file is the only
 * place a count can survive between two spawns, and this is the same answer
 * `ui-server-upkeep.ts` reached for its clocks and for the same reason.
 *
 * ── THE THREE PROPERTIES THAT MATTER, EACH PINNED BY A TEST ────────────────
 *
 *  1. **It cannot break the hook it lives in** (`INV-hooks-fail-open`). A
 *     missing file, a corrupt file, an unwritable directory: every one of them
 *     reads as zero and none of them throws. A knowledge base that breaks a
 *     session is worse than one that says nothing, and this is the highest
 *     frequency write in the product — once per tool call.
 *  2. **A new session starts its own count AND its own fire budget.** Without
 *     the second half, a session inheriting `fires: 3` from the last one would
 *     be a loop that never fires again, silently, forever.
 *  3. **A discarded write is DISCLOSED, never swallowed** — `written` on the
 *     returned value, `INV-nothing-is-dropped-silently`. `ui-server-upkeep.ts`
 *     learned this the expensive way: nine orphaned temp files, three days
 *     old, and nothing anywhere counted them. The difference between "three a
 *     day" and "three thousand a day" is the difference between litter and a
 *     ration that has stopped holding, and from outside they looked identical.
 *
 * ── AND THE HONEST LIMIT ───────────────────────────────────────────────────
 *
 * **A count of tool calls is not a count of sessions, and a lost write is a
 * missed firing nothing reports.** `written: false` says the write went
 * nowhere, but only to the caller that made it; if the state directory is
 * unwritable for the whole session, this counter reads zero forever and the
 * pass never fires. That failure is silent to the USER by construction —
 * there is nowhere on the `PostToolUse` path to say it — so `hooks/stop.ts`
 * puts its own verdict in the audit row it was already writing, which is the
 * one durable sink that is not the casualty.
 */
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** The file's name under `<stateRoot>/state/`. */
const COUNTER_FILE = 'review-counter.json';

/**
 * Where the count lives: `<corpusRoot>/state/review-counter.json`.
 *
 * `stateRoot` is `findProjectRoot`'s answer — the `.my_context` directory
 * itself — which is what `upkeepStatePath` takes and what every hook on this
 * path already has in hand. Exported so a test names the file the way the
 * code does rather than re-spelling the path and drifting from it.
 */
export function reviewCounterPath(stateRoot: string): string {
  return path.join(stateRoot, 'state', COUNTER_FILE);
}

/**
 * The count, the ration, and whose session both belong to.
 *
 * `sessionId` is `null` for a state nobody has written, which is the honest
 * answer and not a sentinel session — `STD-absent-vs-zero`. A count with no
 * session attached cannot be compared against the session in hand, so it is
 * continued rather than trusted as another session's.
 */
export interface CounterState {
  calls: number;
  fires: number;
  sessionId: string | null;
}

/**
 * A `CounterState` plus whether the write that produced it actually landed.
 *
 * Two types rather than one optional field, because `readCounter` never writes
 * and must not carry a field a caller could read as "the read failed". The
 * mutating calls return this; the read returns the state.
 */
export interface CounterWrite extends CounterState {
  /** `false` when the state on disk does not match the value returned. */
  written: boolean;
}

const FRESH: CounterState = { calls: 0, fires: 0, sessionId: null };

/**
 * The state as it stands, or zeros for anything that cannot be read.
 *
 * Every field is checked by TYPE rather than trusted — `readState`'s posture
 * in `ui-server-upkeep.ts`, for its reason: a half-read state file is worse
 * than no state file, because the half that survives is a ration the trigger
 * would obey. A `fires` that arrived as the string `"9"` compares truthily
 * against a numeric cap under one reading and falsily under another.
 *
 * **Never throws.** This is called from `PostToolUse`.
 */
export function readCounter(stateRoot: string): CounterState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(reviewCounterPath(stateRoot), 'utf8'));
  } catch {
    return { ...FRESH };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...FRESH };
  const value = parsed as Record<string, unknown>;
  const count = (key: string): number => {
    const raw = value[key];
    return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0;
  };
  const id = value['sessionId'];
  return {
    calls: count('calls'),
    fires: count('fires'),
    sessionId: typeof id === 'string' && id !== '' ? id : null,
  };
}

/**
 * Write the state atomically, and never throw.
 *
 * **This is `writeState` from `core/ui-server-upkeep.ts`, copied deliberately
 * rather than shared** — this phase's plan says to read that file first and
 * copy its shape rather than invent a second write pattern. What is copied is
 * the whole of it, including the part that is easy to leave out: the temp file
 * is named OUTSIDE the `try`, because the failure path is what unlinks it.
 * Nine orphaned `ui-server-upkeep.json.tmp-<pid>` files were measured on this
 * machine on 2026-09-06 — every one a COMPLETE document, so what failed was
 * the rename and not the write, which is the ordinary shape of a rename over a
 * file another process has open on Windows.
 *
 * Sharing it instead would mean a generic writer in a third module that both
 * import, and that module would need the one thing neither caller has: an
 * opinion about what a failed write costs. `ui-server-upkeep` discards and
 * re-derives a clock; this discards and loses a count that nothing re-derives.
 */
function writeCounter(stateRoot: string, state: CounterState): boolean {
  const target = reviewCounterPath(stateRoot);
  // Named OUTSIDE the `try`, because the failure path needs it: a discarded
  // write must not leave the file it half-finished behind.
  const tmp = `${target}.tmp-${process.pid}`;
  try {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    renameSync(tmp, target);
    return true;
  } catch {
    try {
      // `force` so the commonest failure — `mkdirSync` refusing, with no temp
      // ever created — is not itself an error to swallow twice.
      rmSync(tmp, { force: true });
    } catch { /* the litter this is here to prevent, and it was survivable */ }
    return false;
  }
}

/**
 * The state this session should continue from: the stored one when the id
 * matches, a fresh one when it does not.
 *
 * `undefined` for `sessionId` — a payload that carried none — continues
 * whatever is stored. That is the lenient direction on purpose: the
 * alternative resets the count on every firing that happened to arrive without
 * an id, which makes the threshold unreachable rather than merely imprecise.
 */
function forSession(stored: CounterState, sessionId: string | undefined): CounterState {
  if (sessionId === undefined || sessionId === '') return { ...stored };
  if (stored.sessionId === sessionId) return { ...stored };
  return { calls: 0, fires: 0, sessionId };
}

/** The id to store, preferring the one the payload carried. */
function idFor(base: CounterState, sessionId: string | undefined): string | null {
  if (base.sessionId !== null) return base.sessionId;
  return sessionId !== undefined && sessionId !== '' ? sessionId : null;
}

/**
 * One more tool call. Returns the count INCLUDING this one.
 *
 * The returned value is correct for this call even when the write was
 * discarded, which is why `written` exists: the caller that just counted knows
 * what it counted, and only the NEXT process is affected by the loss.
 */
export function bumpCounter(stateRoot: string, sessionId: string | undefined): CounterWrite {
  const base = forSession(readCounter(stateRoot), sessionId);
  const next: CounterState = {
    calls: base.calls + 1,
    fires: base.fires,
    sessionId: idFor(base, sessionId),
  };
  return { ...next, written: writeCounter(stateRoot, next) };
}

/**
 * The pass fired: zero the calls, spend one of the session's fires.
 *
 * **`fires` is incremented HERE and not where the child is spawned**, and the
 * ordering is a guard rather than an accident: a spawn that failed has still
 * spent its ration. Counting the fire only on a successful spawn turns a
 * machine that cannot spawn into one that retries on every subsequent
 * threshold crossing for the rest of the session — the flooding failure the
 * design measures upstream (thirteen firings from one session) reached by the
 * one path nobody tests.
 */
export function resetCounter(stateRoot: string, sessionId: string | undefined): CounterWrite {
  const base = forSession(readCounter(stateRoot), sessionId);
  const next: CounterState = {
    calls: 0,
    fires: base.fires + 1,
    sessionId: idFor(base, sessionId),
  };
  return { ...next, written: writeCounter(stateRoot, next) };
}
