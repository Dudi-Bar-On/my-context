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
 *
 * ── AN ABSENCE HAS A CAUSE, AND THE CAUSE IS A FIELD ───────────────────────
 *
 * Added 2026-08-31, after `consecutiveSpawnFailures: 3` with `stoodDown: true`
 * was read as a two-hour outage that had not happened. It had not happened
 * because those three spawns were refused by a port that was already serving —
 * and NOTHING in the state file could tell that apart from a server too broken
 * to start. `lastOutcome` is the field that now can, and `UpkeepOutcome` lists
 * what it may say and why each value earns a name. The precedent is
 * `readOccupancy`'s `UnmeasurableWhy`, chosen deliberately over a log line: this
 * path rides `Stop`, so a log here is a line on every assistant turn.
 *
 * ── A STAND-DOWN IS LEFT BY EVIDENCE, AND OTHERWISE BY A PERSON ────────────
 *
 * Ruled 2026-08-31, out of the same investigation. Until that day `stoodDown`
 * was written `true` and never written back, and its guard sat AHEAD of the
 * probe — so a stood-down workspace stopped probing, stopped writing and
 * stopped learning. A server that came back was never noticed, and the one
 * sentence saying a human was needed had been spoken on a single turn's stderr
 * in a session that was over. The feature was off and nothing said so.
 *
 * **The guard now gates the SPAWN alone.** A stood-down workspace keeps probing
 * on the same 60-second floor, keeps writing its state, and lifts the
 * stand-down the moment a server answers — `recordServerSeen` argues that at
 * length. The caution is untouched, because the caution was never about
 * probing: `MAX_CONSECUTIVE_SPAWN_FAILURES` is about not spawning into a
 * situation that keeps rejecting the spawn, and a probe is how the mechanism
 * finds out that the situation has ended. One connect per interval, no process,
 * no stderr.
 *
 * What did NOT change: the threshold, both intervals, the decision to stand
 * down at all, and the once-per-refusal disclosure. Deleting the state file
 * still works and is still what that disclosure names, because a stand-down
 * whose cause never resolves still needs a person.
 */
import { spawn, type SpawnOptions } from 'node:child_process';
import {
  existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { setTimeout as waitMs } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import type { Config } from './config.ts';
import {
  askServerFreshness, portAccepts, probeUiServer, type Freshness,
} from './ui-server-probe.ts';
import { readUiServerRecord } from './ui-server-record.ts';

/**
 * The host the upkeep's occupancy check aims at.
 *
 * Not configurable, and not a guess: `src/ui/server.ts` REFUSES to bind
 * anything but `127.0.0.1` (spec §2.1), and `startServer` below passes no
 * `--host` at all. So the address a spawn would try to bind is known exactly,
 * and asking whether that address already answers is a measurement rather than
 * an inference.
 */
const SPAWN_HOST = '127.0.0.1';

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
 *
 * The refusal is about SPAWNING and only about spawning. Since 2026-08-31 the
 * probe keeps running through it and a server that answers ends it — see
 * `recordServerSeen`. This number is unchanged by that, because nothing it
 * argues was ever an argument for looking less often.
 */
export const MAX_CONSECUTIVE_SPAWN_FAILURES = 3;

/**
 * How many times the confirmation asks whether the replacement is listening,
 * and how long it waits between asks.
 *
 * **This is the number that makes "never stop a server you cannot replace"
 * mean something.** Until 2026-09-11 `restartStaleServer` stopped a server,
 * started a replacement and returned — and `startServer` says in as many words
 * that a pid means libuv accepted the exec and nothing more. The only witness
 * was the NEXT probe, one turn or one minute later, and the only remedy was a
 * spawn five minutes after that, on a hook that only fires while somebody is
 * working. The owner was asleep.
 *
 * Twelve asks a hundred milliseconds apart is 1.2 seconds. **The upper bound is
 * set by the hook, not by the server**: `Stop` runs on a 3-second timeout the
 * platform genuinely waits on, and the probe (250ms cap) and the freshness
 * exchange are already inside it. The lower bound is set by the measurement in
 * `restartStaleServer`'s header — 368ms from the kill to the new server
 * answering, on this machine — so 1.2 seconds is that with room for a machine
 * under the load this whole defect was measured under.
 *
 * A refused connection on loopback returns at once, so the cost of the answer
 * being NO is the poll interval and nothing else; the 250ms connect cap is only
 * ever paid by a port that is filtered, which `127.0.0.1` is not.
 */
export const CONFIRM_ATTEMPTS = 12;
export const CONFIRM_POLL_MS = 100;

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
 *
 * `restarted` is the 2026-09-02 addition and it is a SEPARATE variant from
 * `spawned` rather than a flag on it. The two are opposite situations wearing
 * one word: `spawned` means nothing was answering and one was started;
 * `restarted` means a server WAS answering, said its own modules were behind
 * the disk, and was replaced. A log in which those read alike is a log in
 * which a restart is a restart nobody can explain later — which is the
 * 2026-08-31 defect one row up, and the reason `upkeepNote` in `hooks/stop.ts`
 * writes a different clause for each.
 *
 * `port-already-serving` is the 2026-08-31 addition and it is SILENT on stderr
 * by design — see `UpkeepOutcome`. Nothing is wrong in that case, and a
 * mechanism that speaks up to say nothing is wrong, on a path that rides every
 * assistant turn, is the chattiness this module has refused since it was
 * written. It is a field in the state file, not a line.
 */
export type Upkeep = (
  | {
    did: 'nothing';
    why:
      | 'off' | 'disabled' | 'too-soon' | 'alive' | 'stood-down'
      | 'port-already-serving' | 'stood-down-lifted' | 'replaced-elsewhere';
  }
  | { did: 'spawned'; port: number }
  | {
    did: 'restarted';
    port: number;
    /**
     * **Set, and set to `true`, exactly when the replacement was started and
     * nothing was listening on the port by the time the call gave up asking**
     * — `TASK-the-upkeep-stops-the-ui-server-before-it-knows-a-replacement`.
     * Absent when a socket answered, which is a MEASURED yes rather than an
     * assumed one.
     *
     * It rides on `restarted` rather than being a fifth `did` because the act
     * is the same act: a server was stopped and a replacement was started.
     * What differs is what is known about the result, and that is the whole
     * of this field. `stateWriteDiscarded` below is the precedent and the
     * argument is the same one.
     */
    replacementUnconfirmed?: true;
  }
  | { did: 'stood-down'; why: 'spawn' | 'stale'; failures: number }
) & {
  /**
   * **Set, and set to `true`, exactly when this call's state write was
   * discarded** — `plan:governance seq:4`. Absent otherwise, including on the
   * paths that attempt no write at all.
   *
   * It is a report of an event rather than a measurement of a quantity, which
   * is why absent is a complete answer here where
   * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` would
   * demand a number elsewhere: at most one write happens per call, so the fact
   * is binary, and every path that could have produced it goes through
   * `recorded`. The rate this is really about is recovered by COUNTING the
   * audit rows that carry the clause, which is a thing a person can do and the
   * temp-file litter it replaces was not.
   *
   * On a discarded write the act above still happened — a server really was
   * spawned or restarted — and only the RECORD of it was lost. That is why this
   * is a field beside the act and not a fifth `did`.
   */
  stateWriteDiscarded?: true;
};

/**
 * **What the last call concluded, written into the state file so that a reader
 * of the file can tell three opposite situations apart.** This is the whole of
 * the 2026-08-31 fix.
 *
 * The defect it repairs: `consecutiveSpawnFailures: 3` with `stoodDown: true`
 * read EXACTLY the same whether the configured port was already serving happily
 * or the server was broken and could not start. Those are opposite situations —
 * one needs no action at all, the other needs someone woken up — and on
 * 2026-08-31 a reader took the first for the second, reported a two-hour outage
 * that had not happened, and started a redundant second server. The counter was
 * not wrong. It was the only thing recorded, and a count cannot carry a cause.
 *
 * `readOccupancy`'s `UnmeasurableWhy` is the precedent and this is deliberately
 * the same shape: **an absence has a cause, and the cause is a field, not a log
 * line.** The upkeep path runs on every assistant turn, so a log is not
 * available to it; a field costs one already-happening write.
 *
 *  - `alive`               a server answered where the record said. Nothing to do.
 *  - `port-already-serving` no usable record, but the CONFIGURED port accepts a
 *                          connection. A spawn cannot succeed and does not need
 *                          to. **Not a failure**, and not counted as one.
 *  - `spawned`             a spawn was attempted. Never that one is running —
 *                          only the next probe learns that.
 *  - `spawn-failed`        a spawn was attempted, the next probe found no
 *                          server, AND the configured port was not answering
 *                          either. This is the genuine failure.
 *  - `restarted-stale`     a server ANSWERED, reported `staleCode: true` on its
 *                          own `/api/meta`, and was stopped and started again.
 *  - `restart-failed`      a restart was attempted and the server that answers
 *                          STILL reports stale code. The attempt did not take —
 *                          the opposite cause from `spawn-failed`, because here
 *                          something is very much serving the port.
 *  - `stood-down`          `spawn-failed` reached the threshold. No spawn will
 *                          be attempted; the probe keeps running.
 *  - `stood-down-stale`    `restart-failed` reached the threshold. Its own value
 *                          because the two stand-downs make opposite claims: one
 *                          says nothing would start, the other says something is
 *                          serving and will not be replaced. `upkeepStandDownLine`
 *                          says a different sentence for each, and a file that
 *                          recorded them alike would send a reader to look for an
 *                          outage that is not happening — the 2026-08-31 defect
 *                          exactly, reintroduced by a shared name.
 *  - `stood-down-lifted`   a server was SEEN while stood down, so the refusal
 *                          ended. Written on the one call that ends it.
 *  - `too-soon`            refused by policy — the spawn floor had not elapsed.
 *
 * `off` and `disabled` are absent on purpose and their absence is not a gap:
 * both return before anything is read or written, so a workspace in either
 * state has NO state file at all, which is itself unambiguous. Recording them
 * would mean writing a file to say that nothing was written.
 */
export type UpkeepOutcome =
  | 'alive'
  | 'port-already-serving'
  | 'spawned'
  | 'spawn-failed'
  | 'restarted-stale'
  | 'restart-failed'
  | 'stood-down'
  | 'stood-down-stale'
  | 'stood-down-lifted'
  | 'too-soon'
  /**
   * A stale server was stopped, a replacement was started TWICE, and nothing
   * was listening on the configured port by the time the call gave up asking.
   *
   * Its own value and not `restart-failed`, because the two are opposite
   * measurements and `UpkeepOutcome`'s whole argument is that a count cannot
   * carry a cause: `restart-failed` says something IS serving and still
   * reports itself stale, and this says NOTHING is serving at all. A reader
   * who cannot tell them apart cannot tell a page that is out of date from a
   * page that is not there.
   */
  | 'restart-unconfirmed'
  /**
   * The server the probe proved alive was no longer the recorded one by the
   * time the freshness answer came back, so this call stopped nothing.
   *
   * Somebody else — another session's `Stop` hook — replaced it inside the
   * three round trips of the credential exchange. Recorded rather than
   * silent, because a workspace whose log fills with this is a workspace
   * where several sessions are reaching for one port, which is a fact about
   * the machine that nothing else would report.
   */
  | 'replaced-elsewhere';

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
  /**
   * The occupancy check, injected for the same reason `spawnFn` is and one more
   * that is specific to it: the real one connects to `config.ui.port` on this
   * machine, and the suite's configured port is a REAL number a REAL server may
   * be sitting on. A unit test that reaches a live socket is a test whose answer
   * depends on what else the owner happens to be running — which is precisely
   * the kind of hidden coupling `test/core/real-home-guard.test.ts` exists over.
   */
  portAcceptsFn?: (host: string, port: number) => Promise<boolean>;
  /**
   * The freshness ask, injected for `portAcceptsFn`'s reason and one more: the
   * real one performs a THREE-REQUEST credential exchange against a live HTTP
   * server (`askServerFreshness`, `ui-server-probe.ts`), and a unit test has no
   * such server to answer it. Every existing test leaves it unset and gets
   * `unknown` from the real function against its own bare socket, which is the
   * same "leave it alone" answer it had before this seam existed.
   */
  freshnessFn?: (url: string) => Promise<Freshness>;
  /**
   * How a stale server is stopped. `process.kill` in production, and injected
   * here because a test's liveness record names `process.pid` — the suite's own
   * process. `stopServer` refuses that pid outright as well; a seam and a guard,
   * because signalling the wrong process is the one failure in this file that
   * cannot be undone by the next probe.
   */
  killFn?: (pid: number, signal: NodeJS.Signals) => void;
  /**
   * The pause between the confirmation's asks, injected so that no test in this
   * product's suite ever waits out a real one.
   *
   * The suite's standing rule is that not one test sleeps — an interval test
   * that waits for its own interval is a test that takes minutes and still
   * cannot say which side of a boundary it landed on. Every other clock in this
   * module is passed in as `now` for exactly that reason; this one cannot be,
   * because it is a wait rather than a comparison, so it is a seam instead.
   */
  sleepFn?: (ms: number) => Promise<unknown>;
  /**
   * Which launch shape `startServer` uses, injected for the reason
   * `src/ui/open.ts` injects the same value: the two command lines are a real
   * difference in behaviour and one machine has to be able to run both of them.
   *
   * Production passes nothing and gets `process.platform`. It is NOT a way to
   * ask for a shape — a Windows machine given `'linux'` here would spawn a
   * server whose parent never exits, which is the defect this seam exists to
   * hold a test against.
   */
  platform?: NodeJS.Platform;
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
  /**
   * WHY the mechanism stood down, or `null` when it has not.
   *
   * **The flag alone was not enough, and the file already said so about
   * everything else.** `upkeepStandDownLine` has spoken two different sentences
   * since 2026-08-31 because the two causes make opposite claims — one says
   * nothing would start, the other says something is serving and will not be
   * replaced — and `lastOutcome` records which one was last written. But
   * `lastOutcome` is overwritten by the very next call, and the FLAG outlives
   * it; so a workspace that stood down over a stale server, and whose server
   * then died, arrived at the cold spawn carrying a refusal whose reason no
   * longer existed, and declined to start anything. That is how a mechanism
   * built to keep a server up ends up being the reason there is none.
   *
   * The cause is therefore stored beside the flag and read where the flag is
   * acted on. `upkeepUiServer` voids a `stale` stand-down the moment it reaches
   * the cold path at all, because reaching it means nothing is serving, which
   * is the one fact that refusal claimed.
   */
  stoodDownWhy: 'spawn' | 'stale' | null;
  /**
   * When the FRESHNESS question was last put to a server that answered, or
   * `null` for a workspace that has never asked it.
   *
   * **A third clock, and it is a third clock for the reason the first two are
   * two.** It is not the probe's: the probe is a socket connect costing
   * microseconds, and this is a three-request credential exchange whose first
   * step — `POST /api/nonce` — writes a `nonce-minted` audit row every time it
   * runs, because a credential coming into existence is a security event
   * (`recordNonceMint`, `src/ui/security.ts`). Asking on every probe would put
   * sixty of those rows an hour into a corpus from which 5,207 rows of
   * per-message noise were once deleted for being noise.
   *
   * And it is not the spawn's, even though it is floored at the same
   * `SPAWN_INTERVAL_MS`: `lastSpawnAt` moves only when something is started, so
   * a healthy fresh server would leave it still and the ask would run every
   * minute anyway. The bound wanted is on the ASKING, so the clock has to move
   * whenever the question is put — which is what this field records, in both
   * directions of the answer.
   *
   * **The interval is `SPAWN_INTERVAL_MS` and it is reused rather than
   * invented**, because the bound has an argument already: there is no point
   * asking a question more often than the answer could be acted on, and a
   * restart is a spawn, so the answer can be acted on at most once every five
   * minutes. One credential exchange and one audit row per workspace per five
   * minutes is the whole standing cost of this feature.
   */
  lastFreshnessAt: number | null;
  /**
   * What the last call that wrote this file concluded, or `null` for a file
   * written by a build that predates the field.
   *
   * It needs no clock of its own: every path that sets it also sets
   * `lastProbeAt` to the same `now`, so the outcome's timestamp is the one
   * already on the line above it. A second timestamp would be a second thing to
   * keep in step and a second thing to be wrong.
   */
  lastOutcome: UpkeepOutcome | null;
}

const FRESH: UpkeepState = {
  lastProbeAt: null,
  lastSpawnAt: null,
  spawnPending: false,
  consecutiveSpawnFailures: 0,
  stoodDown: false,
  stoodDownWhy: null,
  lastFreshnessAt: null,
  lastOutcome: null,
};

/**
 * Read back by NAME rather than trusted, `readState`'s posture applied to the
 * one field that is a union: a state file written by a newer build, or edited
 * by hand, must not put a value into `lastOutcome` that no reader below
 * understands. Anything unrecognised degrades to `null`, which says "this file
 * does not record an outcome" — true, and the one answer that cannot mislead.
 */
const OUTCOMES: readonly UpkeepOutcome[] = [
  'alive', 'port-already-serving', 'spawned', 'spawn-failed',
  'restarted-stale', 'restart-failed', 'restart-unconfirmed', 'replaced-elsewhere',
  'stood-down', 'stood-down-stale', 'stood-down-lifted', 'too-soon',
];

/** `stoodDown`'s cause, read back by name for `OUTCOMES`' reason. */
const STAND_DOWN_CAUSES = ['spawn', 'stale'] as const;

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
 * Since 2026-08-31 it must also say **that the refusal can end without them**,
 * and that clause is not a courtesy. The mechanism keeps probing and lifts
 * itself when a server answers, so "will not try again" — which is what this
 * line used to say — became the kind of overstatement that has a person delete
 * a file they did not need to touch, or else stop trusting the sentence. The
 * accurate claim is narrower and is the one made below: it will not START one
 * on its own.
 *
 * A fourth was added on 2026-08-31: **the condition under which the claim
 * holds**, in the same sentence as the claim. "Could not be started" was read
 * once as an outage when the truth was a port already serving, and the clause
 * naming the occupancy check is what keeps the sentence from being read that
 * way again. It is not decoration — `upkeepUiServer` measures the configured
 * port before it counts any of these failures, so the clause is a report of
 * something checked rather than a reassurance.
 *
 * The file is named rather than described. `stoodDown` lives in per-workspace
 * state, so it outlives the session that set it — which is the safe direction
 * (a new session is not a human, and standing down again on the next session's
 * first turn would be the loop this avoids) but only while the way out is
 * written down here.
 */
export function upkeepStandDownLine(
  failures: number, root: string, why: 'spawn' | 'stale' = 'spawn',
): string {
  // **Two causes, two claims, and neither sentence may be said about the other
  // cause.** The 2026-08-31 defect was a reading that inferred an outage from a
  // count; a line saying "could not be started" about a server that is up and
  // serving stale code would force the same reading, this time in the product's
  // own words. The condition each claim holds under travels in the same sentence
  // as the claim, which is the standing rule here.
  const cause = why === 'stale'
    ? 'the web UI server was serving code older than the files on disk and could not be ' +
      `replaced ${failures} times in a row — it kept answering, and it kept reporting itself ` +
      'stale after every attempt, so the port is being served and it is the REPLACEMENT that ' +
      'failed'
    : `the web UI server could not be started ${failures} times in a row — the ` +
      'configured port was not answering on any of those attempts, so nothing was already ' +
      'serving there';
  return (
    `my_context: ${cause} — and the upkeep has stood down: it will not START one on its own ` +
    'again, though it keeps checking and will resume by itself if a server turns up on that ' +
    'port. To get one now, start it yourself with `mycontext ui`; to turn the upkeep off, ' +
    'remove `ui.port` from .my_context/config.json ' +
    `(\`ui.enabled: false\` does the same without unsetting the port). Delete ` +
    `${upkeepStatePath(root)} to make it start trying again without one. ` +
    'Nothing else about this turn changed.\n'
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
    stoodDownWhy: STAND_DOWN_CAUSES.find((known) => known === value['stoodDownWhy']) ?? null,
    lastFreshnessAt: num('lastFreshnessAt'),
    lastOutcome: OUTCOMES.find((known) => known === value['lastOutcome']) ?? null,
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
 *
 * ── WHAT `plan:governance seq:4` CHANGED, AND WHAT IT DELIBERATELY DID NOT ──
 *
 * **Not the discard.** The paragraph above is the design and it is still the
 * design: a lost write costs one extra spawn attempt and the floor is restored
 * by the next write that lands. Nothing here retries, blocks, throws or tells
 * the model.
 *
 * **What changed is that the failure stops being invisible**, which is the
 * whole of that item. Two things were wrong with the silence:
 *
 *  1. **The temp file was left behind.** MEASURED 2026-09-06: nine orphaned
 *     `ui-server-upkeep.json.tmp-<pid>` files, every pid dead, the oldest three
 *     days old, all 209-224 bytes — which is a COMPLETE state document, so what
 *     failed was the `renameSync` and not the write. (A rename over a target
 *     another process has open is the ordinary way that happens on Windows.)
 *     They are unlinked here now, on the one path that knows the temp's name.
 *  2. **Nothing counted them.** The answer is the return value: `false` travels
 *     to the caller, which is `upkeepUiServer`, which puts it in the `Upkeep`
 *     it returns, which `hooks/stop.ts` writes into the audit row it was
 *     already writing for that turn. No new file, no new write, and the log is
 *     where a RATE can be read — three a day is litter, three thousand is a
 *     floor that has stopped holding and a server being respawned far more
 *     often than once a minute, and until now those two looked identical from
 *     outside.
 *
 * **Why the count cannot live in the state file**, which is the obvious place
 * and is the wrong one: the file whose write just failed is the file that would
 * have to record it, and every process here writes it at most once — so a
 * counter kept in memory dies with the hook process that saw the failure, and a
 * counter kept in the file is a counter the failure prevented from being
 * written. The audit row is the nearest durable sink that is not the casualty.
 *
 * The unlink is itself wrapped and its own failure is discarded, for this
 * function's standing reason. A temp that cannot be removed is exactly the
 * litter that was there before, which is a state this code already survived.
 */
function writeState(root: string, state: UpkeepState): boolean {
  const target = upkeepStatePath(root);
  // Named OUTSIDE the `try`, because the failure path needs it: the whole point
  // is that a discarded write must not leave the file it half-finished behind.
  const tmp = `${target}.tmp-${process.pid}`;
  try {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    renameSync(tmp, target);
    return true;
  } catch {
    /* a clock that could not be written is one the next call re-derives */
    try {
      // `force` so the commonest failure — `mkdirSync` refusing, with no temp
      // ever created — is not itself an error to swallow twice.
      rmSync(tmp, { force: true });
    } catch { /* the litter this is here to prevent, and it was survivable */ }
    return false;
  }
}

/**
 * **One write, one result, and the result says whether the write landed** —
 * `plan:governance seq:4`.
 *
 * Every writing path in this module is the same two lines: record the state,
 * then return what the call amounted to. They are paired here so that no path
 * can report an outcome while quietly having failed to record it — which is
 * exactly what all of them did until 2026-09-07, and what made a discarded
 * write invisible even to the row being written about the same turn.
 *
 * `stateWriteDiscarded` is set only when the write was discarded, and its
 * absence is a MEASURED no rather than an unmeasured one: every result that
 * comes through here knows the answer, and the results that do not come through
 * here (`off`, `disabled`, the probe floor) attempted no write at all — an
 * absence they already carry unambiguously in `why`, exactly as `UpkeepOutcome`
 * argues for the state file's own missing values.
 */
function recorded(root: string, state: UpkeepState, result: Upkeep): Upkeep {
  return writeState(root, state) ? result : { ...result, stateWriteDiscarded: true };
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
 * server honours previously issued session digests out of `ui-sessions.json` —
 * re-measured over real HTTP on 2026-09-09, both the in-memory token and the
 * cookie, and the bound on it, at `restartStaleServer` below.
 *
 * The `'error'` listener is `src/ui/open.ts`'s measured lesson, not defensive
 * tidiness: a `ChildProcess` whose spawn failed emits `'error'` on a later tick,
 * and an `EventEmitter` with no `'error'` listener rethrows it as an uncaught
 * exception — which here would take down the hook the platform is waiting on.
 *
 * **`cwd` decides WHICH CORPUS the new server serves, and passing it is the
 * 2026-09-02 correction.** A UI server resolves its workspace from its working
 * directory, and a detached child inherits the hook's. That was harmless while
 * this function only ever put back a server that was ABSENT — there was no
 * previous corpus to disagree with. A restart has one, and measured on
 * 2026-09-02 the replacement came up serving a nested corpus of 44 items in
 * place of the 760-item one the server it replaced had been serving: every
 * answer correct, every answer about the wrong repository, and nothing on the
 * page saying so. `restartStaleServer` therefore passes the workspace out of
 * the liveness record — the directory the server being replaced named for
 * itself — and the cold path passes `undefined`, which is the inheritance it
 * always had.
 *
 * A recorded workspace that is no longer a directory is not passed: `spawn`
 * refuses an absent `cwd` outright, and refusing forever is worse than starting
 * a server somewhere the caller can at least see.
 *
 * Nothing is reported back, and a synchronous throw is swallowed, because
 * nothing this function could learn would be trustworthy: a `pid` says libuv
 * accepted the exec, not that a server bound the port. **The next probe is the
 * only witness**, and treating a throw differently from a silent death would be
 * two failure paths for one fact.
 */
/**
 * The argument vector, which is the same on both launch shapes below and is
 * therefore written once. `--no-open` and the CONFIGURED port are the two
 * things `startServer`'s header and the tests are actually about.
 */
function serverArgv(port: number): string[] {
  return [CLI_ENTRY, 'ui', '--port', String(port), '--no-open'];
}

/**
 * ── WHY `detached: true` IS NOT ENOUGH ON WINDOWS, MEASURED 2026-09-12 ──────
 *
 * `detached: true` + `unref()` answers ONE question — does the child survive a
 * parent that EXITS — and the answer is yes; that was measured on 2026-09-11
 * and is not re-opened here. It says nothing about the question that was
 * actually killing the owner's server, which is whether the child survives a
 * parent that is **killed**, and on this platform it does not.
 *
 * Claude Code 2.1.261 kills a hook that overruns its timeout by running, on
 * Windows, `taskkill.exe /PID <hook pid> /T /F` — read off the build itself
 * (the module exporting `ep`, whose Windows body is `P()`; the hook watchdog
 * `hWe.#S` calls `ep(pid, 'SIGTERM')` from its timeout). **`/T` terminates the
 * named process AND every live descendant of it**, and `detached` does not take
 * a Windows process out of its parent's descendant walk. Measured directly:
 * a child spawned exactly as the line below used to spawn one, from a parent
 * then killed with that exact command, died with it — `AFTER: hook alive=false
 * child alive=false`.
 *
 * That is the whole of the defect this branch exists for. On 2026-09-12 at
 * 00:10:27.167Z this function put a replacement up, `confirmListening` saw it
 * bind, and it was gone inside two seconds; the same firing wrote NO `stop`
 * audit row although `hooks/stop.ts` writes one on every firing, because the
 * hook never reached the line that writes it. One fact explains both: the
 * platform reaped the hook, and the reap took the server with it. Every server
 * that survived that night was started by hand, and a hand-started one is
 * exactly a server that is nobody's live descendant.
 *
 * ── THE SHAPE, AND WHY IT IS `cmd.exe` RATHER THAN A FLAG ──────────────────
 *
 * There is no Node option that breaks a Windows process out of its parent's
 * tree (`detached` sets the console, not the parentage), so the parentage is
 * broken by putting a process between us that EXITS AT ONCE:
 * `cmd.exe /d /s /c start "" /b <node> …`. `start` creates the server and
 * `cmd` returns within milliseconds, so by the time the timeout kill runs —
 * three seconds later, an eternity — the server's recorded parent is gone and
 * the walk from the hook's pid never reaches it. Measured with the same probe
 * that condemned the old shape: `AFTER: hook alive=false child alive=true`,
 * and `taskkill` reported no descendant at all.
 *
 * `""` is the window title `start` insists on before an executable path it
 * will quote, `/b` keeps it out of a new console window, `/d` and `/s` keep
 * `cmd` from running an AutoRun profile or re-parsing the quotes. `stdio:
 * 'ignore'` stays on the `cmd` we spawn and is inherited through `start`, so
 * the server still holds no pipe belonging to the hook — which matters for its
 * own reason: the platform waits on a hook whose stdio a grandchild is holding.
 *
 * **The non-Windows branch is left exactly as it was, and that is deliberate
 * rather than complete.** The POSIX reaper in the same build enumerates
 * descendants by ppid too, so the hole is very likely there as well — but no
 * POSIX machine was available to measure it on, and this file does not get to
 * carry a change nobody ran. It is named in the report rather than guessed at
 * here.
 *
 * Nothing is reported back, and a synchronous throw is swallowed, because
 * nothing this function could learn would be trustworthy: a `pid` says libuv
 * accepted the exec, not that a server bound the port. **The next probe is the
 * only witness**, and treating a throw differently from a silent death would be
 * two failure paths for one fact. That is unchanged by the breakaway, and one
 * degree more true of it: the pid we now hold is `cmd`'s, not the server's.
 */
function startServer(
  port: number,
  spawnFn: typeof spawn,
  cwd?: string,
  platform: NodeJS.Platform = process.platform,
): void {
  try {
    // Built once and then narrowed, so the two shapes cannot drift on the
    // three options that are not about the breakaway at all.
    const base: SpawnOptions = { detached: true, stdio: 'ignore' };
    if (cwd !== undefined && existsSync(cwd)) base.cwd = cwd;
    const child = platform === 'win32'
      ? spawnFn(
        process.env.COMSPEC ?? 'cmd.exe',
        ['/d', '/s', '/c', 'start', '""', '/b', process.execPath, ...serverArgv(port)],
        { ...base, windowsHide: true },
      )
      : spawnFn(process.execPath, serverArgv(port), base);
    child.on('error', () => { /* the next probe is the answer; see above */ });
    child.unref();
  } catch {
    /* recorded as an attempt either way, so the floor still holds */
  }
}

/**
 * End the server that answered, so its replacement can have the port.
 *
 * **`SIGTERM` and nothing cleverer.** The UI server installs no handler for it,
 * so the process ends at once and the listening socket goes with it — which is
 * what makes the spawn on the next line able to bind. There is no shutdown
 * endpoint to call instead, and adding one would be a second way to stop a
 * server for a mechanism that already has the pid its own probe just proved
 * alive.
 *
 * **It refuses this process's own pid, and that guard is not theoretical.** The
 * liveness record is a file any test may write, and `test/core/ui-server-upkeep
 * .test.ts` writes one naming `process.pid` — the suite's own process — because
 * until now nothing ever signalled what the record named. Every other mistake
 * in this file is undone by the next probe; this one would take down the
 * process the platform is waiting on, so it is refused here as well as injected
 * around in the tests.
 *
 * A failure is swallowed for `startServer`'s reason and one of its own: `ESRCH`
 * means the process is already gone, which is the goal state rather than an
 * error, and `EPERM` means it belongs to another user and no retry will change
 * that. **The next probe is the only witness** either way — if the old server
 * survives, it answers the next freshness ask still stale, and that is the
 * failure the counter is for.
 */
function stopServer(pid: number, killFn: (pid: number, signal: NodeJS.Signals) => void): void {
  if (pid === process.pid) return;
  try {
    killFn(pid, 'SIGTERM');
  } catch {
    /* already gone, or not ours to signal; the next probe settles which */
  }
}

/**
 * A server was SEEN — and if the mechanism had stood down, that is the evidence
 * that ends it.
 *
 * **One function for both ways of seeing one**, deliberately: `alive` (the
 * record's server answered) and `port-already-serving` (no usable record, but
 * the configured port answered) are two different proofs of the same fact, and
 * two copies of the lift would be two places for the lift to drift.
 *
 * ── A STALE SERVER DOES NOT REACH HERE, AND THAT IS THE 2026-09-02 RULING ──
 *
 * Since staleness became something this module acts on, "a server answered" is
 * no longer the same fact as "the situation ended". A server that answers and
 * reports its own modules behind the disk is EXACTLY the situation a stale
 * stand-down was declared over, so letting it through here would lift a refusal
 * on the strength of the thing the refusal was about — and the next call would
 * try again, fail again, count to three again, and lift again, forever. The
 * caller therefore routes a stale server to `restartStaleServer` and never
 * here; what reaches this function is a server that is fresh, or one whose
 * freshness could not be measured, and both of those are the old fact
 * unchanged.
 *
 * ── WHY A LIFT IS SAFE, WHICH IS NOT THE SAME AS SAYING IT IS HARMLESS ─────
 *
 * The stand-down was never caution about PROBING. It is caution about spawning
 * into a situation that keeps rejecting the spawn — `MAX_CONSECUTIVE_SPAWN_FAILURES`
 * argues exactly that and still does. A server that is answering is proof that
 * the situation ended, and it is proof obtained without starting anything. So
 * the refusal is left by EVIDENCE here, and by a person deleting the file, and
 * by nothing else. No timer, no attempt count, no "try once more in an hour".
 *
 * ── SILENT, AND THAT IS THE RULE RATHER THAN AN OVERSIGHT ──────────────────
 *
 * Nothing is written to stderr. The stand-down disclosure is said on exactly
 * one turn because a line that repeats every turn is a paragraph in front of
 * the owner for the rest of the session — and a LIFT is a smaller occasion than
 * that one, not a larger one: it reports that nothing is wrong any more.
 * `lastOutcome` carries it instead, which is the same trade this whole field
 * exists to make.
 *
 * ── WHY THE LIFT GETS ITS OWN OUTCOME, AND NOT `alive` ─────────────────────
 *
 * Because a flag that changes with nothing saying why is the defect this field
 * was added to fix, one level down. Without `stood-down-lifted`, the only trace
 * of a stand-down ending is `stoodDown` going quiet — and a reader who arrives
 * afterwards cannot tell a workspace that recovered from one that never had
 * trouble. Those are different histories and the difference is worth acting on:
 * a mechanism that failed three times and then recovered is a mechanism with
 * something intermittent behind it.
 *
 * What it does NOT record is WHICH proof lifted it, and that is not a gap: the
 * very next call, one probe interval later, writes `alive` or
 * `port-already-serving` and says so. `lastOutcome` answers "what did the last
 * call decide"; the lift is a decision, and it is decided once.
 */
function recordServerSeen(
  root: string, next: UpkeepState, seen: 'alive' | 'port-already-serving',
): Upkeep {
  const lifted = next.stoodDown;
  return recorded(root, {
    ...next,
    // The counter resets on a SUCCESSFUL PROBE, not on a successful spawn:
    // spawning proves nothing (see `Upkeep`), and a server that came back is
    // the only evidence that whatever was wrong is no longer wrong.
    spawnPending: false,
    consecutiveSpawnFailures: 0,
    stoodDown: false,
    stoodDownWhy: null,
    lastOutcome: lifted ? 'stood-down-lifted' : seen,
  }, { did: 'nothing', why: lifted ? 'stood-down-lifted' : seen });
}

/**
 * A server answered, said its own code was stale, and this is what is done
 * about it: **stop it and start the current one, under exactly the guards a
 * cold spawn passes.**
 *
 * ── WHY A RESTART IS SAFE HERE WITHOUT ASKING ANYBODY ──────────────────────
 *
 * `plan:upkeep seq:6` measured it: an already-open tab survives a restart,
 * because the new server reads `ui-sessions.json` before it binds and honours
 * the digests of tokens earlier runs issued. So the owner's tab reconnects on
 * its own, and a confirmation step would be a question with one answer asked on
 * a hook nobody is looking at. What they were losing before this branch existed
 * is a page served by code sixteen minutes behind the disk.
 *
 * ── RE-MEASURED 2026-09-09, BECAUSE THE OWNER LOST A CREDENTIAL ────────────
 *
 * `plan:live seq:22` was told to distrust the sentence above: the owner was
 * handed a fresh nonce on the morning of 2026-09-09, which would mean this
 * claim is false. **It is not false.** Two servers on one ephemeral port, the
 * second started after the first was killed, with the credential a page holds
 * while it is NOT reloaded:
 *
 *     header token (the in-memory one)   200 against server A, 200 against B
 *     mycontext_token cookie alone        200 against A,        200 against B
 *     GET /api/watch/stream               200 against A,        200 against B,
 *                                         and B answers with a `hello` frame
 *
 * So every credential survives, and the restart itself took 368 ms from the
 * kill to the new server answering. **"What the owner loses is nothing" was
 * the one word too many, and this is where it was wrong**: he loses the
 * held-open STREAM. `server.closeAllConnections()` on the way out sends a
 * clean FIN to every open response, which is exactly the `FIN_WAIT_2` /
 * `CLOSE_WAIT` pair `seq:22` caught on 58888, and nothing in the page put it
 * back — §2 forbade it. `app.js`'s `reopenLiveStream()` is what now does,
 * on a look tick rather than on a timer.
 *
 * ONE BOUND WORTH KNOWING RATHER THAN DISCOVERING. The digests are capped at
 * `SESSION_MAX` (64) and evicted oldest-first, and the store counts RESTARTS
 * rather than tabs. Sampled on this machine 2026-09-09 the file was FULL, and
 * its 64 digests spanned 63.5 hours — so the promise `SESSION_TTL_MS` makes is
 * thirty days and what a development week actually delivers is under three.
 * That is a real ceiling on "a tab survives a restart" and it is not this
 * function's to raise; it is recorded here because this is where the claim is
 * made.
 *
 * ── THE GUARDS ARE THE SPAWN'S GUARDS, IN THE SPAWN'S ORDER ────────────────
 *
 * A restart IS a spawn — a process is started against the configured port — so
 * every argument `SPAWN_INTERVAL_MS` and `MAX_CONSECUTIVE_SPAWN_FAILURES` make
 * applies unchanged, and they are applied in the same sequence
 * `upkeepUiServer` applies them in below: stand-down, then the judgement of the
 * outstanding attempt, then the spawn floor, then a process. Written as a
 * separate function rather than folded into that path because the two differ in
 * what they must do FIRST — this one has a server to stop — and a shared body
 * with a flag through it would be one reader's guess away from stopping a
 * server on the cold path.
 *
 * ── WHAT COUNTS AS A FAILED RESTART, AND WHY IT IS NOT `spawn-failed` ──────
 *
 * The cold path judges its outstanding spawn by "nothing is serving". That
 * judgement cannot be reached here: something IS serving — it just answered.
 * The evidence that a restart did not take is that the server answering STILL
 * reports itself stale, which is precisely the state this function is entered
 * in, so an attempt outstanding when we arrive is an attempt that failed. The
 * cause is the opposite of `spawn-failed`'s and it is recorded as its own
 * value, for the reason `port-already-serving` is: a count cannot carry a
 * cause, and two opposite situations that write the same file are how a reader
 * reported an outage that was not happening.
 *
 * The one way this can be pessimistic is worth naming rather than hiding: an
 * editor that saves a file in the seconds between the restart and the next
 * probe makes the NEW server stale too, and that reads here as a restart that
 * did not take. It costs one count out of three, the next quiet interval clears
 * it — `recordServerSeen` resets on any fresh answer — and the alternative,
 * believing a restart that plainly did not produce current code, is the failure
 * that has no floor at all.
 */
async function restartStaleServer(
  root: string,
  next: UpkeepState,
  port: number,
  server: { pid: number; workspace: string },
  now: number,
  deps: UpkeepDeps,
): Promise<Upkeep> {
  // The stand-down, first, exactly as below. A stale server that will not be
  // replaced is left alone and said so about; the probe and the ask keep
  // running, so a server that comes back FRESH still lifts this through
  // `recordServerSeen`.
  if (next.stoodDown) {
    return recorded(
      root, { ...next, lastOutcome: 'stood-down' }, { did: 'nothing', why: 'stood-down' });
  }

  if (next.spawnPending) {
    next.spawnPending = false;
    next.consecutiveSpawnFailures += 1;
    next.lastOutcome = 'restart-failed';
    if (next.consecutiveSpawnFailures >= MAX_CONSECUTIVE_SPAWN_FAILURES) {
      return recorded(
        root,
        { ...next, stoodDown: true, stoodDownWhy: 'stale', lastOutcome: 'stood-down-stale' },
        { did: 'stood-down', why: 'stale', failures: next.consecutiveSpawnFailures },
      );
    }
  }

  // The SPAWN floor, on the spawn's own clock. A stale server is a bad server
  // and it is still a server: replacing it every minute would be the process
  // storm this floor exists to prevent, bought for a page that is merely out of
  // date rather than absent.
  if (!due(next.lastSpawnAt, now, SPAWN_INTERVAL_MS)) {
    return recorded(
      root, { ...next, lastOutcome: 'too-soon' }, { did: 'nothing', why: 'too-soon' });
  }

  // ── IS THIS STILL THE SERVER THE PROBE PROVED? ────────────────────────────
  //
  // **The window is the freshness exchange, and it is three HTTP round trips
  // wide.** `liveness.pid` was read off the record before `askServerFreshness`
  // ran; by the time the answer comes back another session's `Stop` hook may
  // have stopped that server and started its own replacement, which records
  // itself. Signalling the pid we hold would then kill a server seconds after
  // it bound — a hook believing it was ending the stale one.
  //
  // The record is read again rather than re-probed: the question here is not
  // "is something listening" (the confirmation below asks that) but "is the
  // thing I am about to signal still the thing I decided about", and the record
  // is where that identity lives. One small file read.
  //
  // Declining is the whole response. Somebody else has just replaced this
  // server, so the work this call was going to do is already done; doing it
  // again is the churn, and the second kill is the damage.
  const stillRecorded = readUiServerRecord(deps.globalRoot);
  if (stillRecorded === null || stillRecorded.pid !== server.pid) {
    return recorded(
      root,
      { ...next, lastOutcome: 'replaced-elsewhere' },
      { did: 'nothing', why: 'replaced-elsewhere' },
    );
  }

  // Stop, then start. The old process holds the port, so a spawn without the
  // stop can only ever answer EADDRINUSE — the same measurement that put the
  // occupancy check below where it is.
  stopServer(server.pid, deps.killFn ?? process.kill);
  startServer(port, deps.spawnFn ?? spawn, server.workspace, deps.platform);

  // ── AND THEN FIND OUT, RATHER THAN ASSUMING ───────────────────────────────
  //
  // Everything above this line is what the function did before 2026-09-11, and
  // the line below is the fix. The two statements above give the owner's port
  // away and hand it to a process about which NOTHING is known: `startServer`
  // says so itself — a pid means libuv accepted the exec, and a detached child
  // that dies a second later throws nothing anywhere. Measured that night: five
  // replacements in thirty-nine minutes and, after the fifth, no server, no
  // record, and nothing due to look again for five minutes on a hook that only
  // fires while somebody is working.
  //
  // A second start before giving up, because the likeliest reason a replacement
  // does not bind is the socket just released not having finished releasing,
  // which is over in milliseconds, and this call is the cheapest place there
  // will ever be to try again — every other remedy is at least a probe interval
  // away and needs another session to exist.
  let listening = await confirmListening(port, deps);
  if (!listening) {
    startServer(port, deps.spawnFn ?? spawn, server.workspace, deps.platform);
    listening = await confirmListening(port, deps);
  }
  if (listening) {
    return recorded(
      root,
      { ...next, lastSpawnAt: now, spawnPending: true, lastOutcome: 'restarted-stale' },
      { did: 'restarted', port },
    );
  }

  // **`lastSpawnAt` is left where it was, and that is the point rather than an
  // omission.** The spawn floor's entire argument is that a stale server is
  // still a server and replacing one every minute is a storm bought for a page
  // that is merely out of date. That argument has just been measured false:
  // nothing is serving. Holding the floor here would make the mechanism wait
  // out five minutes over a hole it created itself, which is what left the
  // owner with a dead tab overnight. The probe floor still applies, so the next
  // attempt is a minute away and no sooner.
  return recorded(
    root,
    { ...next, spawnPending: true, lastOutcome: 'restart-unconfirmed' },
    { did: 'restarted', port, replacementUnconfirmed: true },
  );
}

/**
 * Ask, repeatedly and briefly, whether anything is listening where the
 * replacement was told to bind.
 *
 * Aimed at `config.ui.port` because that is the port `startServer` was passed,
 * and answered by the same occupancy check the cold path uses — one function
 * for "would a spawn be able to bind" and "did the spawn bind", because they
 * are the same measurement asked at two moments, and two implementations of it
 * would be two things that could disagree about what listening means.
 *
 * Never throws: `portAccepts` resolves a boolean for every outcome there is.
 */
async function confirmListening(port: number, deps: UpkeepDeps): Promise<boolean> {
  const accepts = deps.portAcceptsFn ?? portAccepts;
  const wait = deps.sleepFn ?? waitMs;
  for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt += 1) {
    // Asked BEFORE the first wait, so a replacement that is already up costs
    // one loopback connect and no delay at all — the ordinary case.
    if (await accepts(SPAWN_HOST, port)) return true;
    await wait(CONFIRM_POLL_MS);
  }
  return false;
}

/**
 * Probe, and put the server back if it is gone.
 *
 * **The guards are ordered by cost, cheapest first**, and the order is load
 * bearing rather than tidy: `off` and `disabled` are two field reads and they
 * come before anything touches a disk, so an unconfigured workspace pays
 * nothing and — asserted in the tests — leaves nothing behind. The probe floor
 * is one small state read. Only then a probe, only then the occupancy check,
 * only then the stand-down, only then the spawn floor, and only then a process.
 *
 * **`stood-down` is no longer among the guards at the top**, and that is the
 * second half of the 2026-08-31 ruling. It sits below the probe and below the
 * occupancy check, because it gates the SPAWN and nothing else: a workspace
 * that has given up on STARTING a server must still be able to NOTICE one.
 *
 * **The occupancy check sits between the probe and the failure judgement**, and
 * that position is the 2026-08-31 fix rather than an optimisation. See the
 * comment at the branch itself: a probe that finds no record cannot tell a dead
 * server from a live one whose record was lost, and judging a spawn failure
 * without asking is how three correct refusals were recorded as three failures.
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
  // NOTE: `stoodDown` is NOT read here. It gates the SPAWN, further down, and
  // gating the probe with it was the 2026-08-31 defect — see the header.
  if (!due(state.lastProbeAt, now, PROBE_FLOOR_MS)) return { did: 'nothing', why: 'too-soon' };

  const liveness = await probeUiServer(deps.globalRoot);
  const next: UpkeepState = { ...state, lastProbeAt: now };

  if (liveness.state === 'alive') {
    // ── IS WHAT ANSWERED STILL THE CODE ON DISK? ────────────────────────────
    //
    // **The defect this branch exists for, measured 2026-09-02**: the running
    // server started at 16:12:39, the last commit to its own modules landed at
    // 16:28:26 — sixteen minutes LATER — and this function, probing it every
    // minute, left it alone every time. `PROBE_FLOOR_MS` and
    // `SPAWN_INTERVAL_MS` govern whether to probe and whether to spawn when
    // nothing answers; neither of them, and nothing else here, ever asked
    // whether what answered was current.
    //
    // **The answer is fetched, never derived.** `src/ui/server.ts` already
    // serves `staleCode` on `/api/meta` from the one `CodeIdentity` that
    // process stamped at startup, and that same field is what raises the
    // code-skew banner in an open tab. Stamping a second identity here would be
    // two stamps that can disagree about what "stale" means — this repository's
    // most-repeated defect — so the server that answered is ASKED, over the
    // credential exchange `askServerFreshness` documents in full.
    //
    // **Floored on its own clock**, because the ask is not free: its first step
    // mints a credential and writes an audit row for it. See `lastFreshnessAt`
    // for why the floor is `SPAWN_INTERVAL_MS` and why it is a third clock
    // rather than either of the two above. The floor advances whenever the
    // question is PUT, not when it is answered a particular way — a server that
    // keeps answering `fresh` must not be asked every minute either.
    if (due(state.lastFreshnessAt, now, SPAWN_INTERVAL_MS)) {
      next.lastFreshnessAt = now;
      const ask = deps.freshnessFn ?? askServerFreshness;
      // `liveness.url` — the address the probe just PROVED answers, not one
      // rebuilt from `config.ui.port`. The record and the config can name
      // different ports (this module deliberately does not compare them), and
      // asking one server about another's code is worse than not asking.
      if (await ask(liveness.url) === 'stale') {
        return restartStaleServer(root, next, port, liveness, now, deps);
      }
      // `fresh` and `unknown` are one answer here, and `Freshness` says why: a
      // question that went unanswered is not evidence of a skew, and restarting
      // on it would buy a new outage to disclose an old one.
    }
    return recordServerSeen(root, next, 'alive');
  }

  // ── IS THE CONFIGURED PORT ALREADY SERVING? ────────────────────────────────
  //
  // **Before the failure is judged, not after**, and the order is the fix.
  //
  // The probe above answers one question — "is the server the RECORD names
  // still there" — and it has no answer at all when there is no record. A
  // server whose record write lost a race (`ui-server-record.ts` measured
  // exactly that on 2026-08-28: one transient EPERM during a restart, and the
  // record absent for the rest of that server's life) is alive, serving the
  // owner, and invisible to `probeUiServer` forever.
  //
  // Aimed at `config.ui.port` because that is the port `startServer` would try
  // to bind. If something answers there, the spawn's outcome is already known —
  // `EADDRINUSE`, measured — so attempting it buys a dead process, and counting
  // its death as a failure builds toward a stand-down that says a server could
  // not be started when the truth is that one is already running.
  //
  // The cost is one loopback connect, on a path that has just paid for another
  // one, at most once a minute. It is NOT paid by a workspace that has not
  // opted in (both returns above precede it) and not by a healthy one (the
  // `alive` return above precedes it too).
  //
  // A squatter that is not our server reaches here as well, and is answered the
  // same way on purpose: the recorded outcome says the PORT is occupied, which
  // is what was measured, and never that the server is healthy, which was not.
  //
  // Failures are reset by `recordServerSeen`, not merely left alone. Every one
  // of them was counted against a spawn that could not have succeeded, so
  // keeping them would be keeping a tally of a question nobody asked.
  const accepts = deps.portAcceptsFn ?? portAccepts;
  if (await accepts(SPAWN_HOST, port)) return recordServerSeen(root, next, 'port-already-serving');

  // ── THE STAND-DOWN, WHICH GATES THE SPAWN AND NOTHING ELSE ────────────────
  //
  // Reached only when nothing is serving — both proofs above have failed — so
  // this is the one place where standing down changes what happens next, and
  // what it changes is that no process is started. The probe has already run,
  // and its clock is about to be written, so the workspace keeps looking. That
  // is the whole of the recovery: the next call on which a server answers goes
  // through `recordServerSeen` above and lifts this.
  //
  // `did: 'nothing'` rather than `did: 'stood-down'`, unchanged: the caller
  // discloses on the latter, and it is emitted on exactly one call — the one
  // that gives up, below.
  // ── A STALE STAND-DOWN DOES NOT REACH THIS FAR, AND NEVER DID ────────────
  //
  // `stood-down-stale` means, in the product's own words, that *the port is
  // being served and it is the REPLACEMENT that failed*. Reaching this line
  // means both proofs above have just failed — the recorded server is gone and
  // the configured port answers nothing — so every claim that refusal rests on
  // has been measured false. Carrying it further would refuse to START a server
  // on the strength of having refused to REPLACE one, which is the mechanism
  // built to keep a server up becoming the reason there is none.
  //
  // The counter goes with it. Those failures were counted against restarts of a
  // server that no longer exists; keeping them would build toward a stand-down
  // over a situation that has ended. A `spawn` stand-down is untouched, because
  // its claim — that nothing would start here — is exactly the claim this line
  // is about to act on.
  if (next.stoodDown && next.stoodDownWhy === 'stale') {
    next.stoodDown = false;
    next.stoodDownWhy = null;
    next.consecutiveSpawnFailures = 0;
    next.spawnPending = false;
  }

  if (next.stoodDown) {
    return recorded(
      root, { ...next, lastOutcome: 'stood-down' }, { did: 'nothing', why: 'stood-down' });
  }

  // A spawn is judged HERE and nowhere else. `spawn` not throwing says only
  // that the process was created; a detached child that dies a second later
  // throws nothing at all, and that is exactly the failure this counter is for.
  //
  // Reaching this line means the configured port did NOT answer a moment ago,
  // so `spawn-failed` now carries a condition it did not carry before: the
  // spawn failed and nothing was in its way.
  if (next.spawnPending) {
    next.spawnPending = false;
    next.consecutiveSpawnFailures += 1;
    next.lastOutcome = 'spawn-failed';
    if (next.consecutiveSpawnFailures >= MAX_CONSECUTIVE_SPAWN_FAILURES) {
      return recorded(
        root,
        { ...next, stoodDown: true, stoodDownWhy: 'spawn', lastOutcome: 'stood-down' },
        { did: 'stood-down', why: 'spawn', failures: next.consecutiveSpawnFailures },
      );
    }
  }

  // The SPAWN floor, checked after the probe and against its own clock. This is
  // the branch that keeps a minute-by-minute probe from becoming a
  // minute-by-minute spawn, and it is the whole reason the two intervals are
  // two constants.
  if (!due(next.lastSpawnAt, now, SPAWN_INTERVAL_MS)) {
    // `too-soon` overwrites `spawn-failed` above rather than hiding it: the
    // failure it would hide is already counted in `consecutiveSpawnFailures`,
    // and `lastOutcome` answers "what did the LAST call decide", not "what is
    // the worst thing that has happened".
    return recorded(
      root, { ...next, lastOutcome: 'too-soon' }, { did: 'nothing', why: 'too-soon' });
  }

  startServer(port, deps.spawnFn ?? spawn, undefined, deps.platform);
  return recorded(
    root,
    { ...next, lastSpawnAt: now, spawnPending: true, lastOutcome: 'spawned' },
    { did: 'spawned', port },
  );
}
