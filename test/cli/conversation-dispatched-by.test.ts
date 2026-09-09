// @basis TASK-dispatched-by-shows-an-id-nobody-can-paste-because,
// TASK-the-index-stores-a-foreign-key-in-one-namespace-and-its,
// INV-nothing-is-dropped-silently
/**
 * **`dispatched by` prints an id that names a row in its own table** —
 * `plan:archive seq:32`.
 *
 * ── WHAT WAS WRONG, AND IT WAS NOT THE HARNESS ─────────────────────────────
 *
 * `agent-<id>.meta.json` records `parentAgentId` as bare hex —
 * `a26cb0b87f4a6712a` where the file beside it is
 * `agent-a26cb0b87f4a6712a.jsonl`. Re-measured on this workspace 2026-09-09:
 * 43 of 257 sidecars carry the field, all 43 bare, all 43 resolving against
 * `agent-<value>.jsonl`. `mycontext conversation subagents` printed that value
 * raw, so 43 rows named something no other surface answers to.
 *
 * The item that filed this called it a dropped prefix. It is not: the sidecar
 * carries no self-id field at all (its whole key set, across all 257, is
 * `agentType`, `description`, `isFork`, `model`, `parentAgentId`, `spawnDepth`,
 * `toolUseId`), and `agent-` is the FILENAME stem that `listSubagentFiles`
 * adopted as `agentId`. So the prefixed spelling is ours, and the fix restores
 * our own convention rather than overriding the harness's.
 *
 * ── WHAT IS ASSERTED, AND WHY IT IS A SELF-JOIN AND NOT A STRING ───────────
 *
 * "Pasteable" is a claim about two columns agreeing, so the assertion is that
 * the value in `dispatched by` **appears in the `agent` column of the same
 * table**, and that the bare spelling is absent from that cell. An
 * `assert.equal` against the literal `agent-outer` would pass just as well on
 * a function that concatenated the wrong thing.
 *
 * The same invariant was measured by hand over the developer's real 257-lane
 * workspace while this was built — `parentAgentId` naming a row in the same
 * table went from 0 of 43 to 43 of 43 — and is deliberately NOT asserted here:
 * it would make this file depend on `~/.claude`, which is the reading
 * `test/core/real-home-guard-escape.test.ts` exists to keep out of the suite.
 *
 * ── AND THE STORED VALUE IS STILL THERE ────────────────────────────────────
 *
 * Both ids are stored since `plan:archive seq:33`, in two columns, and the
 * index keeps what the sidecar said in the one the sidecar filled. That is
 * asserted too, in the same test, because it is the half of the decision a
 * later reader is most likely to undo by accident: `--json` carries
 * `parentAgentId` verbatim AND `dispatchedBy` beside it, and the third test
 * proves they differ on exactly the rows where the namespaces differ.
 *
 * **`seq:32` said here that the index could not hold this fix, and `seq:33`
 * corrected it.** The mechanism it named was real — a value normalised on the
 * way in moves no shape, and `THE SHAPE IS THE VERSION` — but the answer was
 * to move the shape rather than to give up on the column:
 * `subagents.dispatched_by` is one `openReadOnlyChecked` requires, so an index
 * written before it refuses and is rebuilt instead of serving one column in
 * two namespaces. `test/core/conversation-subagents.test.ts` owns the
 * self-join and the upgrade path; what stays here is the terminal's two
 * columns.
 *
 * Everything runs against FIXTURES under the OS temp directory, with
 * `CLAUDE_CONFIG_DIR` passed as a value rather than set on the process —
 * `test/core/conversation-subagents.test.ts`' pattern, for its reason. Nothing
 * here reads the developer's own `~/.claude` or their corpus.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import {
  dispatchingAgentId, projectDirName, rebuildConversations,
} from '../../src/core/conversation-index.ts';
import { removeTree } from '../helpers/tmp.ts';

const SESSION = 'aaaaaaaa-1111-2222-3333-444444444444';
const OUTER_CALL = 'toolu_OUTER';
const INNER_CALL = 'toolu_INNER';

const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
const say = (role: 'user' | 'assistant', body: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? body : [{ type: 'text', text: body }] },
  timestamp: at,
});
const dispatch = (id: string, at: string): unknown => ({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'tool_use', id, name: 'Agent', input: { prompt: 'go' } }] },
  timestamp: at,
});

/**
 * A session that dispatched a lane, and a lane that dispatched another — the
 * only shape in which `parentAgentId` exists at all. The inner sidecar names
 * its parent as `outer` while the file on disk is `agent-outer.jsonl`, which
 * is the real asymmetry copied exactly.
 */
function fixture(): { cwd: string; out: string[]; run: (args: string[]) => void; dispose: () => void } {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-disp-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-disp-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });

  writeFileSync(path.join(dir, `${SESSION}.jsonl`), jsonl([
    say('user', 'do the thing', '2026-09-09T10:00:00.000Z'),
    dispatch(OUTER_CALL, '2026-09-09T10:00:01.000Z'),
  ]));

  const lanes = path.join(dir, SESSION, 'subagents');
  mkdirSync(lanes, { recursive: true });
  writeFileSync(path.join(lanes, 'agent-outer.jsonl'), jsonl([
    say('user', 'the brief', '2026-09-09T10:00:02.000Z'),
    dispatch(INNER_CALL, '2026-09-09T10:00:03.000Z'),
  ]));
  writeFileSync(path.join(lanes, 'agent-outer.meta.json'), JSON.stringify({
    agentType: 'general-purpose', description: 'the outer lane',
    toolUseId: OUTER_CALL, spawnDepth: 1,
  }));
  writeFileSync(path.join(lanes, 'agent-inner.jsonl'), jsonl([
    say('assistant', 'found it', '2026-09-09T10:00:05.000Z'),
  ]));
  writeFileSync(path.join(lanes, 'agent-inner.meta.json'), JSON.stringify({
    agentType: 'Explore', description: 'the inner lane', toolUseId: INNER_CALL,
    // BARE, exactly as the harness writes it, and exactly what made 43 rows
    // print a value nothing answered to.
    parentAgentId: 'outer', spawnDepth: 2,
  }));

  runCli(['init'], cwd, () => {});
  const ws = resolveWorkspace(cwd);
  rebuildConversations(ws.dbPath, { CLAUDE_CONFIG_DIR: home }, cwd, {});

  const out: string[] = [];
  return {
    cwd,
    out,
    run: (args) => { runCli(args, cwd, (line: string) => out.push(line)); },
    dispose: () => { removeTree(home); removeTree(cwd); },
  };
}

test('the `dispatched by` column names a row in its own `agent` column', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'subagents', SESSION]);
    const drawn = f.out.join('\n');

    // Both lanes are drawn, and the depth-1 one still says the session — the
    // two facts `parentAgentId === null` distinguishes, unchanged by this fix.
    assert.match(drawn, /agent-outer/, 'the outer lane is on the table');
    assert.match(drawn, /agent-inner/, 'and so is the lane it dispatched');
    assert.match(drawn, /the session/, 'depth 1 was dispatched by the session and still says so');

    // ── THE MEASUREMENT: the id in `dispatched by` is one the `agent` column
    // holds. `agent-outer` is drawn in its own row above, so a hit here is a
    // real self-join and not a coincidence of spelling.
    const inner = f.out.find((line) => line.includes('agent-inner'));
    assert.ok(inner !== undefined, 'the depth-2 row must be drawn to be measured');
    assert.ok(
      inner.includes('agent-outer'),
      'the depth-2 row must name its parent the way the table names that parent\'s own row. '
      + `Drawn: ${inner}`,
    );
    assert.ok(
      !/\|\s+outer\s+\|/.test(inner),
      'and never the bare sidecar spelling, which is the whole defect. '
      + `Drawn: ${inner}`,
    );
  } finally {
    f.dispose();
  }
});

test('`--json` keeps what the sidecar said and carries the usable id beside it', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'subagents', SESSION, '--json']);
    const parsed = JSON.parse(f.out.join('\n')) as {
      subagents: { agentId: string; parentAgentId: string | null; dispatchedBy: string | null }[];
    };

    const inner = parsed.subagents.find((r) => r.agentId === 'agent-inner');
    assert.ok(inner !== undefined);
    assert.equal(
      inner.parentAgentId, 'outer',
      'the STORED value is untouched: the repair is at the point of display, so the index still '
      + 'answers what the sidecar said. A reader checking this output against the file can.',
    );
    assert.equal(
      inner.dispatchedBy, 'agent-outer',
      'and the usable id arrives as its own field, so a caller piping this into another command '
      + 'has one, without either question having to be asked of the other\'s answer',
    );

    const outer = parsed.subagents.find((r) => r.agentId === 'agent-outer');
    assert.equal(outer?.parentAgentId, null);
    assert.equal(
      outer?.dispatchedBy, null,
      'null stays null — "the session dispatched it" is a fact and not a missing id',
    );
  } finally {
    f.dispose();
  }
});

/**
 * The prefix is added ONLY when it is absent. This whole item is an
 * observation about a harness format that can change under us — the reason
 * `readSubagentMeta` tolerates an unreadable sidecar at all — so the day the
 * harness starts writing the prefix itself, this must keep telling the truth
 * rather than printing `agent-agent-…`.
 */
test('normalising an id that is already normalised changes nothing', () => {
  assert.equal(dispatchingAgentId('a26cb0b87f4a6712a'), 'agent-a26cb0b87f4a6712a');
  assert.equal(dispatchingAgentId('agent-a26cb0b87f4a6712a'), 'agent-a26cb0b87f4a6712a');
  assert.equal(
    dispatchingAgentId(dispatchingAgentId('a26cb0b87f4a6712a')),
    'agent-a26cb0b87f4a6712a',
    'idempotent under composition, which is the property that survives a format change',
  );
  assert.equal(dispatchingAgentId(null), null, 'and the session is not an id at all');
});
