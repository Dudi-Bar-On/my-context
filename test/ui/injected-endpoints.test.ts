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
 * ── AND ONE PLACE WHERE SOMETHING IS GENUINELY LOST ───────────────────────
 *
 * The last test is not about the disagreement. `readSeen` returns
 * `{ lines: [], error: null }` for a seen file that was read and held nothing
 * AND for a seen file that does not exist, because `readJsonlFile` swallows
 * ENOENT (`src/core/jsonl-log.ts` · `if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return [];`).
 * `apiInjected` passes that state on verbatim, so the two arrive at the browser
 * byte-identical.
 *
 * Those are the MEASURED ZERO and the UNMEASURED THING of
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`, and clause 2
 * of that standard is explicit that its scope reaches read models *"because
 * clause 2 cannot be honoured by a screen whose endpoint collapsed 'none' and
 * 'not measured' into the same empty array before it arrived."* This is that
 * collapse, and the consequence is a sentence: `screens/injected.js` draws
 * `inj.zeroLines` — *"This session was read and has received nothing yet"* —
 * over a session whose seen file was never read at all.
 *
 * The fix is one field on `InjectedBody` and is described where it belongs,
 * in `src/ui/read-model.ts`'s lane rather than this one. The last test pins the
 * collapse AS IT STANDS so that the day the field lands, this file fails and
 * says exactly which assertion to rewrite — the shrink-only-ledger discipline
 * `e2e/screen-parity.spec.ts` uses for the same reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
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
 * **Pinned as it stands, and the day this fails is the day it was fixed.**
 *
 * The three tests above are about two endpoints answering different questions
 * honestly. This one is about ONE endpoint answering two different questions
 * with the same bytes, which is the defect
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` names.
 *
 * The fix `src/ui/read-model.ts` needs — one field, and `readSeen` is where the
 * fact still exists to be carried:
 *
 *     export interface InjectedBody {
 *       lines: InjectedLine[];
 *       error: string | null;
 *       seen: 'read' | 'absent';   // ← the state ENOENT is currently spent on
 *     }
 *
 * With it, `screens/injected.js` draws `inj.zeroLines` for `read` and a new
 * key for `absent`, and stops telling a reader that a file nobody opened was
 * read and held nothing.
 */
test('an ABSENT seen file and an EMPTY one are one answer, though the disk tells them apart', () => {
  const f = fixture();
  try {
    // MEASURED ZERO: the file exists and holds no lines. Producible in the
    // wild — a crash during the first `appendJsonlLine` leaves a torn line
    // that `parseJsonlLog` heals away to nothing, and the file stays.
    const empty = seenFilePath(f.root, 's-empty');
    mkdirSync(path.dirname(empty), { recursive: true });
    writeFileSync(empty, '');
    assert.equal(existsSync(empty), true);

    // NOT MEASURED: no file was ever written for this session.
    assert.equal(existsSync(seenFilePath(f.root, 's-never')), false);

    const read = injectedFor(f.ws, 's-empty');
    const never = injectedFor(f.ws, 's-never');
    assert.deepEqual(read, { lines: [], error: null });
    assert.deepEqual(never, { lines: [], error: null });
    assert.deepEqual(JSON.parse(JSON.stringify(read)), JSON.parse(JSON.stringify(never)),
      'CURRENT BEHAVIOUR, and the defect: two different facts about the world reach the '
      + 'browser as identical bytes. When `InjectedBody` gains the field that tells them '
      + 'apart, this assertion is the one to invert — see the note above it');
    // The distinction is not unknowable; it is DISCARDED. Asserted here so the
    // finding cannot be read as "the filesystem could not say".
    assert.notEqual(existsSync(empty), existsSync(seenFilePath(f.root, 's-never')),
      'the fact survives on disk right up to the ENOENT branch that spends it');
  } finally { f.done(); }
});
