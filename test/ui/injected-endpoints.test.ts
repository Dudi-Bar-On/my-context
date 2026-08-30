/**
 * **The two endpoints `Injected now` sits between, measured against each other
 * — because `TASK-injected-now-lands-on-the-one-session-that-has-no-lines-and`
 * reports them disagreeing and the answer is not the one that task assumed.**
 *
 * The screen draws `/api/session/:session/injected`. The picker above it draws
 * `/api/sessions`, and every row of that picker carries `itemCount`. A reader
 * therefore sees two numbers about one session, side by side, and the owner's
 * report is that they do not match: six against zero, on the session the screen
 * lands on.
 *
 * ── WHAT THE TWO FIELDS ACTUALLY ARE ──────────────────────────────────────
 *
 *   `/api/sessions` · `sessions[].itemCount`
 *       `COUNT(DISTINCT item_id)` over the LEDGER table, which is a projection
 *       `topUpLedger` replays out of `.audit/`. Unit: ITEMS. Vocabulary:
 *       `LedgerTier` — `pinned`, `jit`, `restored`.
 *
 *   `/api/session/:session/injected` · `lines[]`
 *       every line of the per-session SEEN FILE, in file order. Unit:
 *       DELIVERIES. Vocabulary: `SeenTier`, which is `LedgerTier` PLUS
 *       `continuity`.
 *
 * So they differ on THREE independent axes, and this file pins one test per
 * axis. **Neither endpoint is wrong on any of them.** They answer different
 * questions off different stores, and the screen's own `inj.note` already says
 * which store it read — *"Read from the seen file, not `Ledger.seen` — that is
 * a replayed projection nothing here updates, and it would show a different
 * number."* The tests below are what turns "would show a different number"
 * from a caveat into a measurement, so that a future change which quietly makes
 * one match the other fails here instead of shipping.
 *
 * ── AND ONE PLACE WHERE SOMETHING WAS GENUINELY LOST, NOW SERVED ──────────
 *
 * The last test is not about the disagreement. `readSeen` used to return
 * `{ lines: [], error: null }` for a seen file that was read and held nothing
 * AND for a seen file that does not exist, because `readJsonlFile` swallows
 * ENOENT (`src/core/jsonl-log.ts` · `if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {`).
 * `apiInjected` passed that state on verbatim, so the two arrived at the
 * browser byte-identical.
 *
 * Those are the MEASURED ZERO and the UNMEASURED THING of
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`, and clause 2
 * of that standard is explicit that its scope reaches read models *"because
 * clause 2 cannot be honoured by a screen whose endpoint collapsed 'none' and
 * 'not measured' into the same empty array before it arrived."* That was the
 * collapse, and the consequence was a sentence: `screens/injected.js` drew
 * `inj.zeroLines` — *"This session was read and has received nothing yet"* —
 * over a session whose seen file was never read at all.
 *
 * **`InjectedBody.seen` now carries the fact**, filled from `readSeen` — which
 * is where it still existed — through `readJsonlFileState`, and NOT from a
 * second `existsSync` beside the read. The last test is the inversion this file
 * was written to demand: the two cases now differ, and the difference is
 * produced by the REAL `SessionEnd` hook fed `{reason: 'clear'}` on stdin,
 * because that is how a live corpus reaches this state (seven of nineteen
 * sessions were in it) and a fixture that reproduced it by calling
 * `clearSeen` itself would be testing this file's idea of the product rather
 * than the product.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace, type Workspace } from '../../src/core/workspace.ts';
import { Ledger } from '../../src/core/ledger.ts';
import { appendSeen, seenFilePath } from '../../src/core/seen-file.ts';
import { clearWindowState } from '../../src/core/window-state.ts';
import {
  apiInjected, apiSessions, type InjectedBody, type SessionsBody,
} from '../../src/ui/read-model.ts';

interface Fixture { dir: string; ws: Workspace; root: string; done(): void }

/**
 * A real workspace with two real items, built through the real CLI — the same
 * arrangement `test/ui/read-model.test.ts`' fixture uses, cut down to what
 * these four tests need. Two items rather than one so that "distinct items" and
 * "deliveries" can differ by more than a repeat.
 *
 * **Nothing here opens a `Ledger`**, so each test below decides for itself what
 * the projection holds; a fixture that pre-seeded it would make the
 * not-projected case unreachable.
 */
function fixture(): Fixture {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-inj-ep-'));
  const run = (args: string[]): void => {
    assert.equal(runCli(args, dir, () => {}), 0, `fixture command failed: ${args.join(' ')}`);
  };
  run(['init']);
  run(['add', 'rule', 'Always use POSIX paths', '--scope', 'src/**', '--body',
    'Use POSIX separators everywhere.', '--yes']);
  run(['add', 'reference', 'Where the billing rework stands', '--body',
    'The tax table is next.', '--yes']);
  const ws = resolveWorkspace(dir);
  const root = ws.projectRoot!;
  assert.ok(root, 'the fixture must resolve a project root, or readSeen has nowhere to look');
  return { dir, ws, root, done: () => removeTree(dir) };
}

const HOOK_SESSION_END = path.join(
  import.meta.dirname, '..', '..', 'src', 'hooks', 'session-end.ts',
);

/**
 * The REAL `SessionEnd` hook, spawned as Claude Code spawns it: the binary,
 * `--disable-warning=ExperimentalWarning` for the type-stripping notice, the
 * payload as JSON on stdin, and the workspace as `cwd`.
 *
 * `spawnSync` and not the exported `buildSessionEndOutcome`, deliberately.
 * `INV-hooks-fail-open` makes this hook exit 0 whatever happens, so the only
 * honest way to know it did its work is to run the process the platform runs
 * and then look at the disk — which is the same thing `scripts/demo-corpus.ts`
 * does to put this state into the demo corpus, and what
 * `test/hooks/hook-binaries-e2e.test.ts` does for the hook's own behaviour.
 * Calling the function would skip the entry point, the stdin read and the
 * payload parse, which are three of the places this path can stop working.
 */
function runSessionEnd(cwd: string, payload: Record<string, unknown>): {
  code: number; stderr: string;
} {
  const run = spawnSync(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', HOOK_SESSION_END],
    { cwd, input: JSON.stringify(payload), encoding: 'utf8' },
  );
  return { code: run.status ?? -1, stderr: run.stderr ?? '' };
}

const url = (endpoint: string): URL => new URL(`http://127.0.0.1:1/api/${endpoint}`);

const injectedFor = (ws: Workspace, session: string): InjectedBody => {
  const result = apiInjected(ws, url(`session/${session}/injected`), { session });
  assert.equal(result.status, 200, 'every case here is a 200 with a state in it');
  return result.body as InjectedBody;
};

const summaryFor = (ws: Workspace, session: string): { itemCount: number } => {
  const body = apiSessions(ws, url('sessions')).body as SessionsBody;
  const row = body.sessions.find((s) => s.sessionId === session);
  assert.ok(row, `the picker must list ${session}, or the two numbers are not side by side`);
  return row;
};

/* ══ AXIS 1 · THE UNIT — items against deliveries ══════════════════════════ */

test('itemCount counts ITEMS and lines counts DELIVERIES, so a repeat makes them differ', () => {
  const f = fixture();
  try {
    // What one session looks like when an item is delivered twice — pinned at
    // the start of the window, restored after a compaction. `Ledger.record`'s
    // key is `(session_id, item_id, tier)`, so the ledger holds two ROWS and
    // one distinct item; the seen file holds two LINES, because the injection
    // happened twice and `injected.js`' header says so in as many words: "a
    // second delivery of an item is a second row".
    const ledger = Ledger.open(f.ws.dbPath);
    ledger.record('s-repeat', 'RULE-always-use-posix-paths', 'pinned', '2026-08-01T09:00:00.000Z');
    ledger.record('s-repeat', 'RULE-always-use-posix-paths', 'restored', '2026-08-01T11:00:00.000Z');
    ledger.close();
    appendSeen(f.root, 's-repeat', [
      { id: 'RULE-always-use-posix-paths', tier: 'pinned', at: '2026-08-01T09:00:00.000Z' },
      { id: 'RULE-always-use-posix-paths', tier: 'restored', at: '2026-08-01T11:00:00.000Z' },
    ]);

    const summary = summaryFor(f.ws, 's-repeat');
    const injected = injectedFor(f.ws, 's-repeat');
    assert.equal(summary.itemCount, 1, 'DISTINCT item ids: one item, delivered twice');
    assert.equal(injected.lines.length, 2, 'one row per DELIVERY, and there were two');
    assert.notEqual(summary.itemCount, injected.lines.length,
      'the two numbers a reader sees side by side disagree here, and both are right: '
      + 'they are counting different things over the same event');
    // The disagreement is entirely the unit. Compare like with like and it is
    // gone — which is what makes this axis a naming defect and not a data one.
    assert.equal(new Set(injected.lines.map((l) => l.id)).size, summary.itemCount,
      'distinct ids in the seen file equal itemCount: same events, one unit apart');
  } finally { f.done(); }
});

/* ══ AXIS 2 · THE VOCABULARY — a tier the ledger does not store ════════════ */

test('a continuity delivery is a line with no ledger row, because the ledger has no such tier', () => {
  const f = fixture();
  try {
    // `SeenTier = LedgerTier | 'continuity'`, and `src/core/seen-file.ts` says
    // why in its own words: "This file is the authority for continuity dedupe
    // and the ledger is not asked". So a session start that carries a
    // continuity item writes a seen line the ledger CANNOT hold — there is no
    // `continuity` member of `LedgerTier` to record it under.
    const ledger = Ledger.open(f.ws.dbPath);
    ledger.record('s-carry', 'RULE-always-use-posix-paths', 'pinned', '2026-08-02T09:00:00.000Z');
    ledger.close();
    appendSeen(f.root, 's-carry', [
      { id: 'RULE-always-use-posix-paths', tier: 'pinned', at: '2026-08-02T09:00:00.000Z' },
      { id: 'REF-where-the-billing-rework-stands', tier: 'continuity', at: '2026-08-02T09:00:01.000Z' },
    ]);

    const injected = injectedFor(f.ws, 's-carry');
    assert.deepEqual(injected.lines.map((l) => l.tier), ['pinned', 'continuity']);
    assert.equal(summaryFor(f.ws, 's-carry').itemCount, 1,
      'the ledger counts the pinned item and cannot count the continuity one');
    assert.equal(new Set(injected.lines.map((l) => l.id)).size, 2,
      'the seen file holds two distinct items, so matching the units does NOT close this gap');
    // This is the axis a reader is least equipped to guess at, because both
    // numbers are item counts and they still differ. It is the reason
    // `inj.note` cannot be reduced to "the ledger lags": the ledger is not
    // behind here, it is answering about a smaller vocabulary and always will.
  } finally { f.done(); }
});

/* ══ AXIS 3 · THE STORE — a window that was destroyed ══════════════════════ */

test('a cleared window keeps its ledger history and loses its seen file, which is the owner\'s case', () => {
  const f = fixture();
  try {
    const ledger = Ledger.open(f.ws.dbPath);
    ledger.record('s-cleared', 'RULE-always-use-posix-paths', 'pinned', '2026-08-03T09:00:00.000Z');
    ledger.record('s-cleared', 'REF-where-the-billing-rework-stands', 'jit', '2026-08-03T09:00:01.000Z');
    ledger.close();
    appendSeen(f.root, 's-cleared', [
      { id: 'RULE-always-use-posix-paths', tier: 'pinned', at: '2026-08-03T09:00:00.000Z' },
      { id: 'REF-where-the-billing-rework-stands', tier: 'jit', at: '2026-08-03T09:00:01.000Z' },
    ]);
    assert.equal(injectedFor(f.ws, 's-cleared').lines.length, 2,
      'non-vacuity: the session really did receive two things before the window was destroyed');

    // `/clear` destroys a context window. `hooks/session-end.ts` answers
    // `reason: 'clear'` with exactly this call, and it removes the seen file
    // and touches neither the ledger nor `.audit/` — deliberately, because the
    // injection HAPPENED and only the dedupe state is about a window that is
    // now gone.
    const note = clearWindowState(f.root, 's-cleared');
    assert.match(note, /cleared 1 seen file/, 'the fixture must actually destroy the window');
    assert.equal(existsSync(seenFilePath(f.root, 's-cleared')), false);

    const summary = summaryFor(f.ws, 's-cleared');
    const injected = injectedFor(f.ws, 's-cleared');
    assert.equal(summary.itemCount, 2, 'the ledger is the record, and the record is unchanged');
    assert.deepEqual(injected.lines, [], 'the live dedupe state is gone with the window');
    assert.equal(injected.error, null, 'and it is not an error — nothing failed');
    // THE OWNER'S REPORT, reproduced: `/api/sessions` says this session
    // received things and `/injected` says it received none, with no error to
    // explain the difference. Both are truthful about their own store.
    // `scripts/demo-corpus.ts` replays the real `SessionEnd` hook on
    // `demo-session-a3f9c1-20` so the same shape is reachable in a browser.
    assert.ok(summary.itemCount > 0 && injected.lines.length === 0);
  } finally { f.done(); }
});

/* ══ THE COLLAPSE, WHICH IS NOT A DISAGREEMENT ═════════════════════════════ */

/**
 * **The inversion. This assertion used to say the two were identical.**
 *
 * The three tests above are about two endpoints answering different questions
 * honestly. This one is about ONE endpoint that answered two different
 * questions with the same bytes, which is the defect
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` names, and
 * about the field that stopped it:
 *
 *     export interface InjectedBody {
 *       lines: InjectedLine[];
 *       error: string | null;
 *       seen: 'read' | 'absent';   // ← the state ENOENT used to be spent on
 *     }
 *
 * With it, `screens/injected.js` draws `inj.zeroLines` for `read` and
 * `inj.noSeenFile` for `absent`, and stops telling a reader that a file nobody
 * opened was read and held nothing.
 *
 * **The cleared half is produced by the REAL hook, on stdin.** `/clear` is the
 * producer that makes this state common — `SessionEnd` with `reason: 'clear'`
 * → `clearWindowState` → `clearSeen` — and `scripts/demo-corpus.ts` replays
 * exactly this payload against exactly this binary for the same reason. A test
 * that called `clearSeen` itself would prove the read model can distinguish two
 * states a test invented; this one proves it distinguishes the state the
 * PRODUCT produces. A `lines.length > 0` assertion before the clear is what
 * keeps the after-state from being vacuous.
 */
test('a cleared session answers "absent" and an empty one answers "read" — the real hook produces it', () => {
  const f = fixture();
  try {
    // ── THE CLEARED WINDOW ────────────────────────────────────────────────
    // A session that really received something, so its `absent` afterwards is
    // a REMOVAL and not an emptiness.
    appendSeen(f.root, 's-cleared-hook', [
      { id: 'RULE-always-use-posix-paths', tier: 'pinned', at: '2026-08-04T09:00:00.000Z' },
      { id: 'REF-where-the-billing-rework-stands', tier: 'jit', at: '2026-08-04T09:00:01.000Z' },
    ]);
    const before = injectedFor(f.ws, 's-cleared-hook');
    assert.equal(before.lines.length, 2, 'non-vacuity: there was something to lose');
    assert.equal(before.seen, 'read', 'and while the file is there, the read is a read');

    // The product's own path to this state, driven as Claude Code drives it:
    // the hook binary, the payload on stdin, nothing of `clearSeen` called from
    // here. Its own audit record and its ledger rows are left exactly where the
    // hook leaves them.
    const hook = runSessionEnd(f.dir, {
      hook_event_name: 'SessionEnd', session_id: 's-cleared-hook', reason: 'clear', cwd: f.dir,
    });
    assert.equal(hook.code, 0, `the SessionEnd hook must exit 0: ${hook.stderr}`);
    assert.equal(existsSync(seenFilePath(f.root, 's-cleared-hook')), false,
      'the fixture must actually destroy the window, or this test asserts nothing');

    // ── THE MEASURED ZERO ─────────────────────────────────────────────────
    // The file exists and holds no lines. Producible in the wild — a crash
    // during the first `appendJsonlLine` leaves a torn line that `parseJsonlLog`
    // heals away to nothing, and the file stays.
    const empty = seenFilePath(f.root, 's-empty');
    mkdirSync(path.dirname(empty), { recursive: true });
    writeFileSync(empty, '');
    assert.equal(existsSync(empty), true);

    const cleared = injectedFor(f.ws, 's-cleared-hook');
    const read = injectedFor(f.ws, 's-empty');

    // Both are still empty and neither is an error — that much was never the
    // defect, and the tiers above show why it must not become one: the
    // injection HAPPENED, and nothing failed when the window was destroyed.
    assert.deepEqual(cleared.lines, []);
    assert.deepEqual(read.lines, []);
    assert.equal(cleared.error, null);
    assert.equal(read.error, null);

    // THE POINT. Two different facts about the world, two different answers.
    assert.equal(cleared.seen, 'absent', 'no seen file was written or one was taken away');
    assert.equal(read.seen, 'read', 'a file was opened and it held nothing');
    assert.notDeepEqual(
      JSON.parse(JSON.stringify(cleared)), JSON.parse(JSON.stringify(read)),
      'the two states must reach the browser as DIFFERENT bytes — an assertion that the '
      + 'response is merely non-empty would pass on the defect this field was added to fix',
    );

    // A session nothing ever wrote for is `absent` too, and that is correct:
    // the field says whether a file was there, not why it was not. The screen
    // needs one sentence for both, because the audit log is where the
    // difference between them survives.
    assert.equal(existsSync(seenFilePath(f.root, 's-never')), false);
    assert.equal(injectedFor(f.ws, 's-never').seen, 'absent');
  } finally { f.done(); }
});

/**
 * **`read` is not "the read succeeded", and a client must not draw a zero off
 * it alone.** `absent` is spent on an observed ENOENT and on nothing else, so a
 * seen file that exists and cannot be trusted is `read` WITH an error — which
 * is what keeps `screens/injected.js`' rule intact: a refusal draws
 * `errorNote` and no zero sentence at all, and neither `inj.zeroLines` nor
 * `inj.noSeenFile` may appear beside it.
 */
test('an unreadable seen file is "read" with an error, never "absent"', () => {
  const f = fixture();
  try {
    const broken = seenFilePath(f.root, 's-broken');
    mkdirSync(path.dirname(broken), { recursive: true });
    // Newline-terminated, so it is corruption rather than a torn tail — the one
    // shape `parseJsonlLog` gives no tolerance at all.
    writeFileSync(broken, '{"protocol":"not-the-seen-protocol"}\n');

    const body = injectedFor(f.ws, 's-broken');
    assert.notEqual(body.error, null, 'the fixture must actually produce an unreadable file');
    assert.deepEqual(body.lines, [], 'no partial answer — dedupe is all-or-disclosed');
    assert.equal(body.seen, 'read',
      'a file that could not be trusted was still a file: calling it `absent` would tell the '
      + 'reader nothing was ever written here, which is a second false sentence');
  } finally { f.done(); }
});
