// @basis TASK-a-corrupt-or-locked-archive-index-makes-every-retrieval,
// INV-nothing-is-dropped-silently,
// STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is
/**
 * **A RETRIEVAL MISSION MUST NEVER REPORT AN UNREADABLE ARCHIVE AS AN ARCHIVE
 * THAT HOLDS NOTHING** — `TASK-a-corrupt-or-locked-archive-index-makes-every-
 * retrieval`, recovered by the audit at `rulings/90` after the consolidation
 * dropped it.
 *
 * `composeMaterial` opened the conversation index inside a bare `catch {}` and
 * returned its `empty` material for everything the door could throw. Four
 * distinguishable states arrived as one:
 *
 *   1. nothing has ever been scanned here — `ConversationIndexUninitializedError`
 *   2. an index an older build wrote — `ConversationIndexIncompleteError`
 *   3. a file that is not a database — a truncated or corrupt `.index.db`
 *   4. a database this process cannot read right now — held by a writer, or
 *      denied by an ACL
 *
 * Only (1) and (2) are empty. (3) and (4) are faults, and the answer the
 * composer produced for them is **a claim about the archive**: a brief telling
 * a subagent that the conversation record bears nothing on the subject. A
 * reader who believes it stops looking, and nothing anywhere says the index was
 * never opened. That is `INV-nothing-is-dropped-silently` broken at the point
 * where it costs the most, and it is `STD-a-measured-zero-is-drawn-and-named`
 * exactly: the zero here was never measured.
 *
 * The sibling route `src/ui/read-model-conversations.ts` already answers the
 * same four states correctly — it narrows on `instanceof` and rethrows the
 * rest — so this was an inconsistency between two routes over one door, not an
 * unknown.
 *
 * ── WHAT IS ASSERTED, AND WHY IT IS FOUR TESTS AND NOT ONE ────────────────
 *
 * The control comes first, because every later assertion is worthless without
 * it: the fixture's archive really does hold the passage's name, and the
 * mission really does find it. Without that, "zero points" after the damage
 * would be a fact about the fixture rather than about the door.
 *
 * Then both faults, each planted for real rather than stubbed. And then both
 * empty states, because a repair that turned a fresh corpus into a 500 would
 * satisfy the first half and break every workspace on the day it is created —
 * the Incomplete case is every workspace in the world on upgrade day, and the
 * write path is the only thing that heals it.
 *
 * ── HOW THE TWO FAULTS ARE PLANTED ────────────────────────────────────────
 *
 * CORRUPT is `test/core/audit-projection.test.ts`' mechanism, unchanged: bytes
 * that are not a SQLite file, written over the index. It needs no privilege and
 * behaves identically on every platform.
 *
 * LOCKED is a second connection holding `PRAGMA locking_mode = exclusive` open
 * across a transaction — the file genuinely held by another writer, which is
 * the state a concurrent `mycontext conversation rebuild` puts it in and the
 * one a Windows share-mode denial produces from outside. It is used in
 * preference to an `icacls /deny`, which was measured here too and reaches the
 * same branch with `unable to open database file`, because a privilege the
 * environment may refuse would leave this assertion green over an unexercised
 * branch — the failure mode `test/core/rebuild-unwalkable-dir.test.ts` had to
 * write a probe for. A lock taken by this process cannot be refused.
 *
 * ── AND THE ASSERTION IS ON THE ANSWER'S KIND, NOT ON A STATUS CODE ───────
 *
 * A fault may reach the reader as a throw the server renders as a 500, or as a
 * refusal this read model composes itself. Both say it. What is refused is the
 * third answer — `200` with a brief and `points: 0` — so the tests assert that
 * an answer was NOT composed, and then that the sentence a reader gets names
 * the damage. Pinning the status here would pin an implementation detail the
 * screen lane may still move.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import {
  ConversationIndex, projectDirName, rebuildConversations,
} from '../../src/core/conversation-index.ts';
import { buildSearchIndex } from '../../src/core/conversation-search.ts';
import { apiRetrievalMission, type MissionComposeBody } from '../../src/ui/read-model-retrieval.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

const SESSION = 'unreadable-session-psi';
/** The name only this fixture's one turn carries. Nothing else in the tree says it. */
const ONLY_NAME = 'unreadableOnlySymbolFred';
const PASSAGE = `what did we decide about \`${ONLY_NAME}\``;

interface Fixture { cwd: string; home: string; dbPath: string }

/**
 * A workspace with one transcript in it. `scan: false` stops before
 * `rebuildConversations`, which is the not-yet-scanned empty state — a real
 * one, reached the way a real corpus reaches it, rather than a deleted file.
 */
function fixture(options: { scan?: boolean } = {}): Fixture {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-unreadable-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-unreadable-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });

  writeFileSync(path.join(dir, `${SESSION}.jsonl`), [
    {
      type: 'user',
      message: { role: 'user', content: `open ${ONLY_NAME} and tell me what it does` },
      timestamp: '2026-09-10T09:00:00.000Z',
    },
    {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{
          type: 'text',
          text: `${ONLY_NAME} was chosen after we weighed three options; that ruling stands`,
        }],
      },
      timestamp: '2026-09-10T09:00:01.000Z',
    },
  ].map((row) => JSON.stringify(row)).join('\n') + '\n');

  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0);
  } finally { process.chdir(previous); }

  const dbPath = path.join(cwd, '.my_context', '.index.db');
  if (options.scan !== false) {
    rebuildConversations(dbPath, process.env, cwd, {});
    const index = ConversationIndex.open(dbPath);
    try { buildSearchIndex(index, { full: true }); } finally { index.close(); }
  }
  return { cwd, home, dbPath };
}

function tidy(f: Fixture): void {
  delete process.env['CLAUDE_CONFIG_DIR'];
  removeTree(f.cwd);
  removeTree(f.home);
}

/** What the route did, in the three kinds a caller can tell apart. */
type Answer =
  | { kind: 'answered'; body: MissionComposeBody }
  | { kind: 'refused'; status: number; sentence: string }
  | { kind: 'threw'; sentence: string };

function mission(f: Fixture): Answer {
  const previous = process.cwd();
  process.chdir(f.cwd);
  try {
    const result = apiRetrievalMission(
      resolveWorkspace(f.cwd), { mode: 'from-selection', passage: PASSAGE },
    );
    if (result.status === 200) return { kind: 'answered', body: result.body as MissionComposeBody };
    const body = result.body as { error?: unknown };
    return { kind: 'refused', status: result.status, sentence: String(body.error ?? '') };
  } catch (err) {
    return { kind: 'threw', sentence: err instanceof Error ? err.message : String(err) };
  } finally { process.chdir(previous); }
}

/** The sentence a reader ends up with, whichever way the fault was reported. */
function sentenceOf(answer: Answer): string {
  assert.notEqual(answer.kind, 'answered',
    'the mission composed a brief over an index it could not open. That brief is a CLAIM '
    + 'ABOUT THE ARCHIVE — a subagent reading it is told the conversation record holds nothing '
    + 'on the subject — and it is the whole of what this item is about: '
    + JSON.stringify(answer.kind === 'answered'
      ? { points: answer.body.points, note: answer.body.query.note } : answer));
  return (answer as { sentence: string }).sentence;
}

/* ── 0. THE CONTROL ───────────────────────────────────────────────────────── */

test('the readable archive answers this passage, so a later zero would be a lie', () => {
  const f = fixture();
  try {
    const answer = mission(f);
    assert.equal(answer.kind, 'answered', JSON.stringify(answer));
    const body = (answer as { body: MissionComposeBody }).body;
    assert.ok(body.points > 0,
      'the fixture\'s own archive does not answer the passage, so every assertion below would '
      + 'be measuring the fixture rather than the door: ' + JSON.stringify(body.query));
  } finally { tidy(f); }
});

/* ── 1. CORRUPT ───────────────────────────────────────────────────────────── */

test('a corrupt archive index is reported, not answered as an archive holding nothing', () => {
  const f = fixture();
  try {
    writeFileSync(f.dbPath, 'this is not a SQLite database');

    const sentence = sentenceOf(mission(f));
    assert.match(sentence, /not a database|no database pages|database/i,
      `the fault was reported without saying what it was: ${sentence}`);
    assert.doesNotMatch(sentence, /nothing has been (scanned|indexed)/i,
      'damage was reported in the words of the empty state, which is the same confusion one '
      + `sentence further on: ${sentence}`);
  } finally { tidy(f); }
});

/* ── 2. LOCKED ────────────────────────────────────────────────────────────── */

test('an archive index held by another writer is reported, not answered as empty', () => {
  const f = fixture();
  // Opened before the try so the `finally` can always release it: a handle left
  // open on Windows PINS the file and `removeTree` would fail behind a failing
  // assertion, hiding the real one.
  const holder = new DatabaseSync(f.dbPath);
  try {
    holder.exec('PRAGMA locking_mode = exclusive');
    holder.exec('BEGIN EXCLUSIVE');
    holder.exec('CREATE TABLE IF NOT EXISTS lock_probe (a TEXT)');

    // PROVE THE LOCK LANDED before anything is concluded from it. A lock that
    // was asked for and does not bite would let the assertion below pass over
    // an unexercised branch.
    assert.throws(() => {
      const probe = ConversationIndex.openReadOnlyChecked(f.dbPath);
      probe.close();
    }, /lock|busy/i, 'the exclusive lock did not bite, so this test proves nothing');

    const sentence = sentenceOf(mission(f));
    assert.match(sentence, /lock|busy/i,
      `the fault was reported without saying what it was: ${sentence}`);
    assert.doesNotMatch(sentence, /nothing has been (scanned|indexed)/i,
      `a locked index was reported in the words of the empty state: ${sentence}`);
  } finally {
    try { holder.exec('ROLLBACK'); } catch { /* the transaction may not be open */ }
    holder.close();
    tidy(f);
  }
});

/* ── 3. THE EMPTY STATES STAY EMPTY ───────────────────────────────────────── */

test('a corpus nobody has scanned still composes a brief, because that is not damage', () => {
  const f = fixture({ scan: false });
  try {
    const answer = mission(f);
    assert.equal(answer.kind, 'answered',
      'a fresh workspace was reported as a fault. `mycontext init` writes no conversation '
      + 'tables, so this is the state EVERY corpus is in on the day it is created, and the '
      + `only thing that fills it is a write: ${JSON.stringify(answer)}`);
    assert.equal((answer as { body: MissionComposeBody }).body.points, 0);
  } finally { tidy(f); }
});

test('an index an older build wrote still composes a brief, because a rebuild fills it', () => {
  const f = fixture();
  try {
    // `persisted` is a conversation table this build reads; `conversations` is
    // left in place, which is what makes the door call this an upgrade rather
    // than damage (`ConversationIndexIncompleteError`). Reporting it as a fault
    // would stall every workspace on upgrade day.
    const db = new DatabaseSync(f.dbPath);
    try { db.exec('DROP TABLE persisted'); } finally { db.close(); }

    const answer = mission(f);
    assert.equal(answer.kind, 'answered',
      'an index missing a table a LATER build added was reported as damage. The automatic '
      + 'per-turn refresh is the only writer that would create it, and it gates on this same '
      + `door: ${JSON.stringify(answer)}`);
    assert.equal((answer as { body: MissionComposeBody }).body.points, 0);
  } finally { tidy(f); }
});
