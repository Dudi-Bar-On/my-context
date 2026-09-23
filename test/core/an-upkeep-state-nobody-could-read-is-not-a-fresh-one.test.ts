// @basis TASK-twenty-one-one-line-swallows-where-the-docstring-asserts, INV-nothing-is-dropped-silently, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`swallow/11` · m7, the second half: `readState` answered `{...FRESH}` for
 * a state file it could not read.**
 *
 * Its docstring argues the type check — *"a half-read state file is worse than
 * no state file, because the half that survives is a clock the mechanism would
 * obey"* — and that argument is about the SHAPE of a field. The CONFLATION it
 * does not argue is the one report 3 names: a file nobody has written and a
 * file that is there and will not parse produce the identical `FRESH`.
 *
 * ── WHAT THE CONFLATION COSTS HERE IS THE STAND-DOWN ──────────────────────
 *
 * `FRESH` is `stoodDown: false`, `consecutiveSpawnFailures: 0`,
 * `lastSpawnAt: null`. So a workspace that had stood the mechanism down — after
 * three failed spawns, which is the one brake this module has — walks back
 * through the cold path on the next probe, spawns again, and starts counting
 * from zero. While the file stays unreadable that repeats for the life of the
 * workspace, which is the spawn storm the whole module exists to prevent, with
 * the brake removed by a `catch` rather than by a decision.
 *
 * ── THE ACT IS UNCHANGED, AND THE DISCLOSURE ROUTE IS THE ONE ALREADY HERE ─
 *
 * Nothing here asks the upkeep to fail differently: a hook may not throw
 * (`INV-hooks-fail-open`) and re-deriving a clock is survivable. What it asks
 * is that the re-derivation stop being invisible, which is exactly the shape
 * `stateWriteDiscarded` already has — a field beside the act, carried into the
 * row `Stop` was writing anyway, and NAMED so the rate can be recovered by
 * counting rows. `plan:governance seq:4` made that argument; this reuses it
 * rather than opening a second channel.
 *
 * ── AND ABSENCE IS NOT FAILURE ────────────────────────────────────────────
 *
 * The last test is the control that keeps the clause worth reading: every
 * workspace that ever turns this feature on has no state file on its first
 * turn, and a "could not read" on that turn would make the sentence noise.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import type { ChildProcess, spawn } from 'node:child_process';
import { resolveConfig } from '../../src/core/config.ts';
import type { Config } from '../../src/core/config.ts';
import { upkeepStatePath, upkeepUiServer } from '../../src/core/ui-server-upkeep.ts';
import type { Upkeep } from '../../src/core/ui-server-upkeep.ts';
import { observeStop } from '../../src/hooks/stop.ts';
import { removeTree } from '../helpers/tmp.ts';

const NOW = 1_756_300_000_000;
/**
 * NOT 58888. That is the owner's own server's port, and a test that reached it
 * would be measuring his machine — `ui-server-upkeep.test.ts` says the same
 * thing at greater length about the same hazard. Nothing here opens a socket
 * anyway: `portAcceptsFn` is answered below.
 */
const PORT = 58231;
const CONFIGURED: Config = resolveConfig({ ui: { port: PORT } });

/** The occupancy check, answered without touching a socket. */
const NOTHING_ON_THE_PORT = async (): Promise<boolean> => false;

function sandbox(): { base: string; root: string; globalRoot: string } {
  const base = mkdtempSync(path.join(tmpdir(), 'upkeep-unread-'));
  const root = path.join(base, '.my_context');
  mkdirSync(path.join(root, 'state'), { recursive: true });
  return { base, root, globalRoot: path.join(base, 'global') };
}

/** A `spawn` stand-in that starts nothing and counts what it was asked for. */
function fakeSpawn(): { calls: number; fn: typeof spawn } {
  const fake = { calls: 0, fn: null as unknown as typeof spawn };
  fake.fn = (() => {
    fake.calls += 1;
    const child = new EventEmitter() as EventEmitter & { pid?: number; unref(): void };
    child.pid = 4242;
    child.unref = (): void => {};
    return child as unknown as ChildProcess;
  }) as unknown as typeof spawn;
  return fake;
}

test('an upkeep state file that will not parse is NAMED, not read as a fresh workspace', async () => {
  const sb = sandbox();
  try {
    // A file that EXISTS and cannot be used. Written by hand because the
    // subject is a file this process did not produce — a torn write, a rename
    // that landed half way, an editor that saved over it.
    writeFileSync(upkeepStatePath(sb.root), '{"stoodDown": true, "consecutiveSpaw', 'utf8');
    const spawner = fakeSpawn();

    const result = await upkeepUiServer(sb.root, CONFIGURED, NOW, {
      globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT,
    });

    // The ACT is unchanged and must stay unchanged: a hook that refused to keep
    // the server up because it could not read a clock would be a worse product
    // than one that re-derives it. What is added is that it says so.
    assert.equal(result.did, 'spawned');
    assert.equal(spawner.calls, 1, 'the spawn was skipped because a state file would not parse');
    assert.equal(
      typeof result.stateUnreadable, 'string',
      'the mechanism re-derived every clock and every failure count it has, from nothing, and ' +
      'the result says it read them',
    );
    assert.ok(
      (result.stateUnreadable ?? '').includes(upkeepStatePath(sb.root)),
      'the reason does not name the file, so nobody can go and look at it',
    );
  } finally { removeTree(sb.base); }
});

test('the reason reaches the row Stop was already writing', () => {
  // The item\'s third question — is the disclosure READ, in this same change.
  // A field no surface prints is the same silence one layer in.
  const sb = sandbox();
  try {
    const upkeep: Upkeep = {
      did: 'spawned',
      port: PORT,
      stateUnreadable:
        `the UI server upkeep could not read ${upkeepStatePath(sb.root)}, so every clock and ` +
        'failure count below was re-derived from nothing',
    };
    const note = observeStop(
      { session_id: 's-1', cwd: sb.base, hook_event_name: 'Stop', stop_hook_active: false },
      sb.root, upkeep,
    )?.note ?? '';
    assert.match(note, new RegExp(`started on port ${PORT}`, 'u'));
    assert.match(note, /could not read/u);
    assert.match(
      note, /ui-server-upkeep\.json/u,
      'the clause has to NAME the file: the rate is read by counting rows, and a sentence ' +
      'nobody can grep for is the invisibility this replaces',
    );

    // And the ordinary turn is untouched — a clause on every row is no clause.
    const ordinary = observeStop(
      { session_id: 's-1', cwd: sb.base, hook_event_name: 'Stop', stop_hook_active: false },
      sb.root, { did: 'spawned', port: PORT },
    )?.note ?? '';
    assert.doesNotMatch(ordinary, /could not read/u);
  } finally { removeTree(sb.base); }
});

test('a workspace with no state file at all reports nothing — absence is not failure', async () => {
  const sb = sandbox();
  try {
    const spawner = fakeSpawn();
    const result = await upkeepUiServer(sb.root, CONFIGURED, NOW, {
      globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT,
    });
    assert.deepEqual(
      result, { did: 'spawned', port: PORT },
      'the first turn of every workspace that ever turns this on reads no state file, and a ' +
      'field there would put the clause on every row in the world',
    );
  } finally { removeTree(sb.base); }
});
