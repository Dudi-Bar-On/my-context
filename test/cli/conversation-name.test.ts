// @basis TASK-the-archive-borrows-claude-code-own-session-name-and-never,
// INV-nothing-is-dropped-silently, STD-error-message-conventions
/**
 * **`mycontext conversation name` — the one name this project owns**,
 * `plan:archive seq:34`.
 *
 * The item recorded a silence rather than a feature: the spec of
 * `plan:archive seq:10` asked for the title to be *"taken from the
 * transcript's own `aiTitle` AND OVERRIDABLE for a session worth naming"* and
 * only the borrowing shipped. The item costed the reversal as *"a
 * `title_override` COLUMN beside `title`, one CLI subcommand, and the screen
 * preferring it"*.
 *
 * **The column is the half this file disproves**, and it is the whole reason
 * these tests exist rather than one that checks a string round-trips:
 *
 *   1. `a name survives the rebuild that would have overwritten a column` —
 *      `ConversationIndex.upsert` sets EVERY column from `excluded`, and the
 *      Stop hook runs `rebuildConversations` at the end of every assistant
 *      turn. A name in a column would have lived one turn.
 *   2. `a name survives the sweep that would have deleted the row it sat on` —
 *      `removeMissing` DROPS the conversations row when the harness prunes the
 *      transcript (`seq:11`'s ruling), and a column goes with the row.
 *
 * Both run the real command against a real temp workspace and a real temp
 * harness home, because both defects are in code the command calls rather than
 * in code it contains.
 *
 * The rest is what a person meets: the borrowed name is reported and never
 * rewritten, `--clear` needs nothing restored because nothing was overwritten,
 * a lane is refused BY NAME, and `forget` says how many names it dropped.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import {
  ConversationIndex, projectDirName, rebuildConversations,
} from '../../src/core/conversation-index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const SESSION = 'eeeeeeee-1111-2222-3333-666666666666';
const LANE = 'agent-name-lane-1';

const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
const say = (role: 'user' | 'assistant', body: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? body : [{ type: 'text', text: body }] },
  timestamp: at,
});
const TURN = [
  say('user', 'do the thing', '2026-09-10T10:00:00.000Z'),
  say('assistant', 'done', '2026-09-10T10:00:01.000Z'),
];

interface Fixture {
  cwd: string;
  dbPath: string;
  out: string[];
  run: (args: string[]) => number;
  drawn: () => string;
  transcript: string;
  /** One lane transcript under the session, with the sidecar the harness writes. */
  lane: () => void;
  /** The harness pruning the session's transcript, which is what `removeMissing` reacts to. */
  prune: () => void;
  rescan: () => void;
  dispose: () => void;
}

function fixture(): Fixture {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-name-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-name-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const transcript = path.join(dir, `${SESSION}.jsonl`);
  writeFileSync(transcript, jsonl(TURN));

  runCli(['init'], cwd, () => {});
  const ws = resolveWorkspace(cwd);
  const env = { ...process.env, CLAUDE_CONFIG_DIR: home };
  rebuildConversations(ws.dbPath, env, cwd, {});

  const priorHome = process.env['CLAUDE_CONFIG_DIR'];
  process.env['CLAUDE_CONFIG_DIR'] = home;

  const out: string[] = [];
  return {
    cwd,
    dbPath: ws.dbPath,
    out,
    run: (args) => runCli(args, cwd, (line: string) => out.push(line)),
    drawn: () => out.join('\n'),
    transcript,
    lane: () => {
      const under = path.join(dir, SESSION, 'subagents');
      mkdirSync(under, { recursive: true });
      writeFileSync(path.join(under, `${LANE}.jsonl`), jsonl(TURN));
      writeFileSync(path.join(under, `${LANE}.meta.json`), JSON.stringify({
        agentType: 'general-purpose', description: 'the lane its dispatcher named',
        toolUseId: 'toolu_name_lane', spawnDepth: 1,
      }));
      rebuildConversations(ws.dbPath, env, cwd, {});
    },
    prune: () => rmSync(transcript),
    rescan: () => { rebuildConversations(ws.dbPath, env, cwd, {}); },
    dispose: () => {
      if (priorHome === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
      else process.env['CLAUDE_CONFIG_DIR'] = priorHome;
      removeTree(home);
      removeTree(cwd);
    },
  };
}

/** The name as the index holds it, read through the same door the screen uses. */
function stored(dbPath: string, session: string): string | null {
  const index = ConversationIndex.openReadOnlyChecked(dbPath);
  try {
    return index.nameOf(session)?.name ?? null;
  } finally {
    index.close();
  }
}

test('a session is named, and the name is what the list draws', () => {
  const f = fixture();
  try {
    assert.equal(f.run(['conversation', 'name', SESSION, 'the archive lane']), 0, f.drawn());
    assert.equal(stored(f.dbPath, SESSION), 'the archive lane');
    f.out.length = 0;
    f.run(['conversation', 'list']);
    assert.match(f.drawn(), /the archive lane \(you\)/);
  } finally {
    f.dispose();
  }
});

/**
 * **THE MEASUREMENT THAT CHOSE THE STORE.** `upsert` writes every column of
 * `conversations` from `excluded`, and the Stop hook rebuilds at the end of
 * every assistant turn — so the `title_override` COLUMN the item sketched
 * would have been erased one turn after it was typed, silently, with no
 * failure anywhere for anybody to notice.
 *
 * `--full` is the strongest form of the same run: it declines the append path
 * and re-reads the transcript whole, which is the path that rewrites the most.
 */
test('a name survives the rebuild that would have overwritten a column', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'name', SESSION, 'kept across a rebuild']);
    f.rescan();
    assert.equal(stored(f.dbPath, SESSION), 'kept across a rebuild');
    f.out.length = 0;
    assert.equal(f.run(['conversation', 'rebuild', '--full']), 0, f.drawn());
    assert.equal(stored(f.dbPath, SESSION), 'kept across a rebuild');
  } finally {
    f.dispose();
  }
});

/**
 * **AND THE SECOND MEASUREMENT.** `removeMissing` drops the `conversations`
 * row when the harness prunes a transcript — `plan:archive seq:11`'s ruling,
 * which this test does not argue with: the session leaves the list. What must
 * not leave with it is the name, because nothing on disk can rebuild one. A
 * column would have gone with the row it sat on.
 *
 * The name is NOT a reason to keep the row alive — only a standing mark is
 * (`persisted`) — so the row is gone here and the name is still there,
 * waiting for a transcript that may come back.
 */
test('a name survives the sweep that would have deleted the row it sat on', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'name', SESSION, 'outlives its row']);
    f.prune();
    f.rescan();
    const index = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      assert.equal(index.get(SESSION), null, 'the pruned session kept its row');
      assert.equal(index.nameOf(SESSION)?.name, 'outlives its row');
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

/**
 * The harness's own file is REPORTED and never rewritten — the rule
 * `readSubagentMeta` states for the sidecar. Naming a session must therefore
 * leave the transcript byte for byte what it was, and this asserts the bytes
 * rather than the intention.
 */
test('naming a session writes nothing into the transcript', () => {
  const f = fixture();
  try {
    const before = readFileSync(f.transcript);
    f.run(['conversation', 'name', SESSION, 'not written to the file']);
    assert.deepEqual(readFileSync(f.transcript), before);
    assert.match(f.drawn(), /was not written to/);
  } finally {
    f.dispose();
  }
});

/**
 * `--clear` restores nothing, and says so, because nothing was overwritten.
 * That sentence is the feature: an override that had replaced the borrowed
 * title would owe the reader a restore step and a story about what happens if
 * it fails.
 */
test('--clear takes the name back and the borrowed one is simply there again', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'name', SESSION, 'temporary']);
    f.out.length = 0;
    assert.equal(f.run(['conversation', 'name', SESSION, '--clear']), 0, f.drawn());
    assert.match(f.drawn(), /Nothing was restored, because nothing was ever overwritten/);
    assert.equal(stored(f.dbPath, SESSION), null);
    f.out.length = 0;
    assert.equal(f.run(['conversation', 'name', SESSION, '--clear']), 0, f.drawn());
    assert.match(f.drawn(), /had no name here, so nothing changed/);
  } finally {
    f.dispose();
  }
});

/**
 * **A lane is refused BY NAME.** It already carries a name nobody borrowed —
 * the line its dispatcher typed — so there is no asymmetry here to fix, and a
 * second name would compete with a real one instead of replacing a borrowed
 * one. The refusal says which lane and how to reach the session that owns it,
 * because a refusal that is a dead end is a defect of its own.
 */
test('a helper agent cannot be named, and the refusal says why', () => {
  const f = fixture();
  try {
    f.lane();
    assert.equal(f.run(['conversation', 'name', LANE, 'not allowed']), 1, f.drawn());
    assert.match(f.drawn(), /is a helper agent, not a session/);
    assert.match(f.drawn(), /the lane its dispatcher named/);
    assert.equal(stored(f.dbPath, LANE), null);
  } finally {
    f.dispose();
  }
});

/** A name is one line. Refused by name rather than stripped, so nothing is stored quietly. */
test('a name with a newline in it is refused, and nothing is stored', () => {
  const f = fixture();
  try {
    assert.equal(f.run(['conversation', 'name', SESSION, 'two\nlines']), 1, f.drawn());
    assert.match(f.drawn(), /one line of text/);
    assert.equal(stored(f.dbPath, SESSION), null);
  } finally {
    f.dispose();
  }
});

/**
 * A bare `name` on a workspace where nobody has named anything is a MEASURED
 * zero and names itself as one — the archive is full of sessions, and what is
 * empty is the set this project has bothered to name. Two different nothings.
 */
test('a bare name on a workspace with no names says so, and how to give one', () => {
  const f = fixture();
  try {
    assert.equal(f.run(['conversation', 'name']), 0, f.drawn());
    assert.match(f.drawn(), /no session in this workspace has been given a name here/);
    assert.match(f.drawn(), /conversation name <session>/);
  } finally {
    f.dispose();
  }
});

/**
 * **`forget` drops the names and SAYS SO.** Every other thing that command
 * drops is a cache the transcripts on disk rebuild; a name is not — nothing on
 * disk ever held it. So the number is reported rather than swallowed,
 * `INV-nothing-is-dropped-silently`.
 */
test('forget reports the names it drops, because nothing on disk can rebuild one', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'name', SESSION, 'about to be forgotten']);
    f.out.length = 0;
    assert.equal(f.run(['conversation', 'forget', '--yes', '--json']), 0, f.drawn());
    const report = JSON.parse(f.drawn()) as { named: number; conversations: number };
    assert.equal(report.named, 1);
    assert.equal(report.conversations, 1);
  } finally {
    f.dispose();
  }
});
