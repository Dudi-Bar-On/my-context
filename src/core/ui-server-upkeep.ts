/**
 * Keeping the UI server up — the rule
 * `RULE-anything-you-start-for-a-human-to-look-at-must-outlive-the` turned into
 * a mechanism.
 *
 * The rule has been enforced by REMEMBERING since it was written, and
 * remembering failed: the owner reported the server not working three times,
 * and every time it was either dead or answering a spent nonce. This module is
 * what replaces the remembering.
 *
 * ── TWO INTERVALS, AND CONFLATING THEM IS THE DEFECT ────────────────────────
 *
 * The owner's requirement named one number — *"find the correct interval for
 * this test to not overload the system"* — and there are two, because two
 * different things are being bounded and they are bounded by different
 * arguments. `PROBE_FLOOR_MS` and `SPAWN_INTERVAL_MS` below each carry their
 * own derivation. What matters here is that they are separate constants with
 * separate clocks in state: one interval serving both would either probe as
 * rarely as it is safe to spawn (a mechanism that is never there when it is
 * wanted) or spawn as often as it is cheap to probe (the storm).
 *
 * ── OFF UNLESS CONFIGURED, AND THAT IS A SAFETY CALL ────────────────────────
 *
 * With `ui.port` absent this module reads nothing, probes nothing, spawns
 * nothing and — the part that is asserted — WRITES nothing. **A plugin that
 * spawns a background server on every machine it is installed on, because
 * somebody installed it, is not acceptable.** Setting `ui.port` is a positive
 * act, per workspace, and it is the opt-in; `ui.enabled: false` is the off
 * switch that turns it back off without unsetting the port. The two keys divide
 * cleanly: `ui.port` says WHERE, `ui.enabled` says WHETHER.
 *
 * A hook cannot use the CLI's default port of 0 either way. An ephemeral port
 * is a URL nobody can bookmark, and the whole point is a server that is there
 * when the owner looks.
 *
 * ── WHAT THIS MODULE DELIBERATELY DOES NOT DECIDE ──────────────────────────
 *
 * It does not compare the RECORD's port against the configured one. A record
 * naming some other port still counts as alive, and no second server is started
 * beside it. That is the safe direction on a machine where the record is
 * global: two workspaces with two different `ui.port` values would otherwise
 * spawn a server each, on every probe, forever — each one seeing the other's
 * record as "wrong" — which is the storm wearing a different hat. A server on
 * an unexpected port is a URL the owner has to be told once; two servers over
 * one corpus is a defect belonging to nobody.
 *
 * It does not restart a server that is listening but wedged, and it does not
 * touch `--idle-ms`. Spec §7 for both.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from './config.ts';
import { probeUiServer } from './ui-server-probe.ts';

/**
 * How often the PROBE may run.
 *
 * **Not derived from how long a server lives.** `src/ui/idle.ts` sets `IDLE_MS`
 * to eight hours, so a healthy server needs checking roughly never, and an
 * interval derived from that number would be an interval of hours — a mechanism
 * that is never there when it is wanted. It is derived instead from **how long
 * the owner would sit looking at a dead tab**: the probe rides `Stop`, which
 * already fires on every assistant turn, so the worst case between a server
 * dying and its restart is one turn or one minute, whichever is longer.
 *
 * The cost is not what sets it. A probe is one small file read plus one
 * loopback connect, measured in microseconds; a floor of a minute is bought
 * with nothing and would be affordable an order of magnitude lower. It is here
 * because a bound nobody can state is a bound nobody can defend.
 */
export const PROBE_FLOOR_MS = 60_000;

/**
 * How often a SPAWN may be attempted. A different number from the probe's, on
 * purpose.
 *
 * Probing is a socket connect; spawning is a process. **A hook that retries a
 * failing spawn every minute forever is the only path in this design that can
 * overload a machine**, and five minutes is what makes the pathological case —
 * a port permanently occupied by something else — cost twelve short-lived
 * processes an hour instead of sixty, while a genuine restart still lands well
 * inside the window in which the owner would look again.
 */
export const SPAWN_INTERVAL_MS = 5 * 60_000;

/**
 * After this many consecutive failed spawns, stand down and say so.
 *
 * **A refusal is a state to leave**: a mechanism that cannot start a server
 * needs a human, not another attempt. Three rather than one because a single
 * failure is indistinguishable from a race — a server mid-bind when the probe
 * ran — and three consecutive ones, five minutes apart, are not.
 */
export const MAX_CONSECUTIVE_SPAWN_FAILURES = 3;

/**
 * The CLI this module starts, resolved from its own location rather than from
 * `process.argv` or a `node_modules/.bin` lookup: the caller is a hook binary
 * whose `argv[1]` is the hook, and the plugin may be installed anywhere.
 * `src/cli/commands/statusline.ts` resolves its own entry the same way.
 */
export const CLI_ENTRY = fileURLToPath(new URL('../cli/index.ts', import.meta.url));

const STATE_FILE = 'ui-server-upkeep.json';

/**
 * What one call amounted to.
 *
 * `spawned` means an ATTEMPT was made — never that a server is now running.
 * Nothing in this process can know that: a detached child that dies a second
 * later exits after this function has returned, and the only thing that ever
 * learns the truth is the next probe. That is why the failure counter is
 * confirmed by a probe rather than incremented here, and why this variant is
 * not named `started`.
 *
 * `stood-down` is reported on exactly ONE call — the one that gives up — and
 * `{ did: 'nothing', why: 'stood-down' }` on every call after it. The caller
 * discloses on stderr, and a disclosure that repeats on every assistant turn is
 * a worse defect than the silence it replaced.
 */
export type Upkeep =
  | { did: 'nothing'; why: 'off' | 'disabled' | 'too-soon' | 'alive' | 'stood-down' }
  | { did: 'spawned'; port: number }
  | { did: 'stood-down'; failures: number };

/**
 * The two seams a test needs and production never passes.
 *
 * `globalRoot` because the liveness record lives in the real home otherwise,
 * and `test/core/real-home-guard.test.ts` exists because code once wrote there.
 * `spawnFn` because the real one would leave a UI server running on the machine
 * that ran the suite — `src/ui/open.ts` injects its spawn for the same reason,
 * and this is that decision applied a second time rather than a new one.
 */
export interface UpkeepDeps {
  globalRoot?: string;
  spawnFn?: typeof spawn;
}

/**
 * Both clocks and the failure counter, for ONE WORKSPACE.
 *
 * Per workspace and deliberately not per session, which is the opposite of the
 * handover latch two files over. The reason is the thing being protected: a
 * latch protects a MODEL from being asked twice, so it belongs to the session
 * that is asked, while these clocks protect a MACHINE from being spawned at,
 * and two concurrent sessions in one repository each holding their own
 * `lastSpawnAt` would put two servers on one port inside one 5-minute window —
 * which is precisely the floor's whole job. Shared state is what makes the
 * floor mean anything.
 */
interface UpkeepState {
  /** When the probe last ran, or `null` for a workspace that has never probed. */
  lastProbeAt: number | null;
  /** When a spawn was last attempted. */
  lastSpawnAt: number | null;
  /**
   * Whether a spawn is waiting to be judged. Set when one is attempted, cleared
   * by the next probe either way — `alive` clears it as a success, anything
   * else clears it as the failure that increments the counter below.
   */
  spawnPending: boolean;
  consecutiveSpawnFailures: number;
  stoodDown: boolean;
}

const FRESH: UpkeepState = {
  lastProbeAt: null,
  lastSpawnAt: null,
  spawnPending: false,
  consecutiveSpawnFailures: 0,
  stoodDown: false,
};

export function upkeepStatePath(root: string): string {
  return path.join(root, 'state', STATE_FILE);
}

/**
 * What the owner is told when the mechanism gives up, and it is the only thing
 * anyone ever sees from this module.
 *
 * Three things, and each earns its place: **what happened**, because a feature
 * that silently stops is a feature that will be reported as broken; **how to do
 * it by hand**, because the owner wanting the server is why any of this exists;
 * and **how to turn the mechanism off and how to let it try again**, because a
 * refusal that does not say how to leave it is a refusal nobody can act on.
 *
 * The file is named rather than described. `stoodDown` lives in per-workspace
 * state, so it outlives the session that set it — which is the safe direction
 * (a new session is not a human, and standing down again on the next session's
 * first turn would be the loop this avoids) but only while the way out is
 * written down here.
 */
export function upkeepStandDownLine(failures: number, root: string): string {
  return (
    `my_context: the web UI server could not be started ${failures} times in a row, so the ` +
    'upkeep has stood down and will not try again on its own. Start it yourself with ' +
    '`mycontext ui`, or remove `ui.port` from .my_context/config.json to turn the upkeep off ' +
    `(\`ui.enabled: false\` does the same without unsetting the port). Delete ` +
    `${upkeepStatePath(root)} to let it try again. Nothing else about this turn changed.\n`
  );
}

/**
 * The state as it stands, or `FRESH` for anything that cannot be read.
 *
 * Every field is checked by type rather than trusted, `ui-server-record.ts`'s
 * posture for its reason: a half-read state file is worse than no state file,
 * because the half that survives is a clock the mechanism would obey.
 */
function readState(root: string): UpkeepState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(upkeepStatePath(root), 'utf8'));
  } catch {
    return { ...FRESH };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...FRESH };
  const value = parsed as Record<string, unknown>;
  const num = (key: string): number | null => (
    typeof value[key] === 'number' && Number.isFinite(value[key]) ? value[key] as number : null
  );
  return {
    lastProbeAt: num('lastProbeAt'),
    lastSpawnAt: num('lastSpawnAt'),
    spawnPending: value.spawnPending === true,
    consecutiveSpawnFailures: num('consecutiveSpawnFailures') ?? 0,
    stoodDown: value.stoodDown === true,
  };
}

/**
 * Writes the state, atomically, and never throws.
 *
 * **Atomic where the handover latch beside it is not**, and the difference is
 * which direction a torn file fails in. A torn latch reads as "not yet asked"
 * and costs one duplicate ask; a torn file here reads as "never spawned" and
 * removes the spawn floor — on a hook that fires every turn, that is the storm.
 * The cost of the rename is one per probe, so at most one a minute.
 *
 * A failure is discarded because there is nobody to tell and nothing better to
 * do: the next call reads `FRESH`, which is one extra spawn attempt at worst,
 * still behind the floor as soon as one write succeeds.
 */
function writeState(root: string, state: UpkeepState): void {
  try {
    const target = upkeepStatePath(root);
    mkdirSync(path.dirname(target), { recursive: true });
    const tmp = `${target}.tmp-${process.pid}`;
    writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    renameSync(tmp, target);
  } catch {
    /* a clock that could not be written is one the next call re-derives */
  }
}

/**
 * Whether `interval` has passed since `last`.
 *
 * A NEGATIVE elapsed time counts as due. A stored timestamp in the future is
 * what a corrected clock, a daylight shift or a state file copied between
 * machines looks like, and waiting it out means waiting for a moment that has
 * already gone by — on a mechanism whose whole promise is bounded latency, that
 * is a silent stall of up to however far the clock moved.
 */
function due(last: number | null, now: number, interval: number): boolean {
  if (last === null) return true;
  const elapsed = now - last;
  return elapsed < 0 || elapsed >= interval;
}

/**
 * Start a detached UI server and forget about it.
 *
 * `detached: true` and `unref()` are not optional. `Stop` runs on a 3-second
 * timeout the platform genuinely waits on before ending the turn, and a child
 * holding the parent's event loop open turns every assistant turn into a
 * three-second pause — a hook nobody would keep installed.
 *
 * `--no-open` always, for the same reason at a different surface: a hook that
 * launches a browser window mid-turn is a hook nobody keeps installed either.
 * The owner's already-open tab survives the restart anyway, because the new
 * server honours previously issued session digests out of `ui-sessions.json`.
 *
 * The `'error'` listener is `src/ui/open.ts`'s measured lesson, not defensive
 * tidiness: a `ChildProcess` whose spawn failed emits `'error'` on a later tick,
 * and an `EventEmitter` with no `'error'` listener rethrows it as an uncaught
 * exception — which here would take down the hook the platform is waiting on.
 *
 * Nothing is reported back, and a synchronous throw is swallowed, because
 * nothing this function could learn would be trustworthy: a `pid` says libuv
 * accepted the exec, not that a server bound the port. **The next probe is the
 * only witness**, and treating a throw differently from a silent death would be
 * two failure paths for one fact.
 */
function startServer(port: number, spawnFn: typeof spawn): void {
  try {
    const child = spawnFn(
      process.execPath,
      [CLI_ENTRY, 'ui', '--port', String(port), '--no-open'],
      { detached: true, stdio: 'ignore' },
    );
    child.on('error', () => { /* the next probe is the answer; see above */ });
    child.unref();
  } catch {
    /* recorded as an attempt either way, so the floor still holds */
  }
}

/**
 * Probe, and put the server back if it is gone.
 *
 * **The guards are ordered by cost, cheapest first**, and the order is load
 * bearing rather than tidy: `off` and `disabled` are two field reads and they
 * come before anything touches a disk, so an unconfigured workspace pays
 * nothing and — asserted in the tests — leaves nothing behind. `stood-down`
 * and the probe floor are one small state read. Only then a probe, only then
 * the spawn floor, and only then a process.
 *
 * `now` is passed in rather than read, so every interval is testable at its
 * boundary without a test sleeping through one.
 *
 * Never throws: the caller is a hook the platform waits on, and every path
 * below is either pure or already wrapped.
 */
export async function upkeepUiServer(
  root: string,
  config: Config,
  now: number,
  deps: UpkeepDeps = {},
): Promise<Upkeep> {
  const port = config.ui.port;
  if (port === null) return { did: 'nothing', why: 'off' };
  if (!config.ui.enabled) return { did: 'nothing', why: 'disabled' };

  const state = readState(root);
  if (state.stoodDown) return { did: 'nothing', why: 'stood-down' };
  if (!due(state.lastProbeAt, now, PROBE_FLOOR_MS)) return { did: 'nothing', why: 'too-soon' };

  const liveness = await probeUiServer(deps.globalRoot);
  const next: UpkeepState = { ...state, lastProbeAt: now };

  if (liveness.state === 'alive') {
    // The counter resets on a SUCCESSFUL PROBE, not on a successful spawn:
    // spawning proves nothing (see `Upkeep`), and a server that came back is
    // the only evidence that whatever was wrong is no longer wrong.
    writeState(root, { ...next, spawnPending: false, consecutiveSpawnFailures: 0 });
    return { did: 'nothing', why: 'alive' };
  }

  // A spawn is judged HERE and nowhere else. `spawn` not throwing says only
  // that the process was created; a detached child that dies a second later
  // throws nothing at all, and that is exactly the failure this counter is for.
  if (next.spawnPending) {
    next.spawnPending = false;
    next.consecutiveSpawnFailures += 1;
    if (next.consecutiveSpawnFailures >= MAX_CONSECUTIVE_SPAWN_FAILURES) {
      writeState(root, { ...next, stoodDown: true });
      return { did: 'stood-down', failures: next.consecutiveSpawnFailures };
    }
  }

  // The SPAWN floor, checked after the probe and against its own clock. This is
  // the branch that keeps a minute-by-minute probe from becoming a
  // minute-by-minute spawn, and it is the whole reason the two intervals are
  // two constants.
  if (!due(next.lastSpawnAt, now, SPAWN_INTERVAL_MS)) {
    writeState(root, next);
    return { did: 'nothing', why: 'too-soon' };
  }

  startServer(port, deps.spawnFn ?? spawn);
  writeState(root, { ...next, lastSpawnAt: now, spawnPending: true });
  return { did: 'spawned', port };
}
