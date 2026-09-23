// @basis TASK-nine-sites-report-a-measured-zero-for-something-they-could, INV-nothing-is-dropped-silently
/**
 * **A MISSION BRIEF MAY NOT PRESENT AN EMPTY MATERIAL TABLE AS "THE ARCHIVE
 * HOLDS NOTHING ABOUT THIS" OVER AN INDEX THAT HOLDS NOTHING.**
 *
 * Task 4.6c, gap 2 of three, and the reviewer's own words against
 * `ui/read-model-retrieval.ts:~373` (task 4.6 report, §G4):
 *
 * > `pointersFor` reads `.hits` and drops everything else. Its retrieval body
 * > already has the pair for this — `query: { …, matchable, note }` — which is
 * > the shape task 4.3's surface carries, so duplicating `searchArchive`'s
 * > sentence into a new field there would be a second convention for one
 * > condition. Also worth naming because it is a live wrong claim in the tree:
 * > that function's own header says *"`searchArchive` says so rather than
 * > answering 'nothing found'"*. True of `searchArchive`; false of this caller,
 * > which drops the note.
 *
 * The prose index `pointersFor` searches is filled by `mycontext conversation
 * rebuild`, a CLI write nothing under `src/ui/` may perform — `composeMaterial`
 * opens the index with `openReadOnlyChecked` and says so in its own header — so
 * a browser composing a mission over an unbuilt index is not an edge case. It
 * is the state every workspace is in until somebody types the rebuild, and the
 * brief it produced told a subagent, in `mission.ts`' own words, that *these
 * are the points* and then named none.
 *
 * ── THE SURFACE ───────────────────────────────────────────────────────────
 *
 * `POST /api/retrieval/compose`'s BODY, exactly as the browser receives it —
 * `apiRetrievalMission`, not `pointersFor`. Round 1 of task 4.6 proved a
 * coverage disclosure on the function and the route used a different one; the
 * lesson it wrote down is *assert through the surface the item names*.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
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

/** The one name this fixture's archive carries, and nothing else says it. */
const NAME = 'harbourGateSymbolQuux';
/** A name nothing in the archive carries, for the measured-zero boundary. */
const ABSENT = 'vanishingPointSymbolThud';

const said = (body: string, at: string): unknown => ({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'text', text: body }] },
  timestamp: at,
});

interface Box {
  cwd: string;
  write: (session: string, rows: unknown[]) => void;
  scan: () => void;
  fill: () => void;
  compose: (passage: string) => MissionComposeBody;
  dispose: () => void;
}

function box(): Box {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-retrcov-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-retrcov-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const prior = process.env['CLAUDE_CONFIG_DIR'];
  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try { assert.equal(runCli(['init'], cwd, () => {}), 0); } finally { process.chdir(previous); }
  const dbPath = path.join(cwd, '.my_context', '.index.db');
  return {
    cwd,
    write: (session, rows) => writeFileSync(
      path.join(dir, `${session}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n',
    ),
    scan: () => { rebuildConversations(dbPath, process.env, cwd, {}); },
    fill: () => {
      const index = ConversationIndex.open(dbPath);
      try { buildSearchIndex(index, { full: true }); } finally { index.close(); }
    },
    compose: (passage) => {
      const at = process.cwd();
      process.chdir(cwd);
      let result;
      try {
        result = apiRetrievalMission(resolveWorkspace(cwd), { mode: 'free-text', passage });
      } finally { process.chdir(at); }
      assert.equal(result.status, 200, JSON.stringify(result.body));
      return result.body as MissionComposeBody;
    },
    dispose: () => {
      if (prior === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
      else process.env['CLAUDE_CONFIG_DIR'] = prior;
      removeTree(home);
      removeTree(cwd);
    },
  };
}

test('a mission composed over an unbuilt prose index says so, in the brief the browser gets', () => {
  const b = box();
  try {
    b.write('s-one', [said(`the ${NAME} was where the work landed`, '2026-09-10T09:00:00.000Z')]);
    b.scan();
    // Deliberately no `fill()`: the archive is walked, the prose index is not.

    const body = b.compose(`we talked about \`${NAME}\` yesterday`);
    assert.equal(body.points, 0, 'nothing is indexed, so nothing can be pointed at');
    assert.equal(
      typeof body.query.note, 'string',
      'the brief named a subject and then told the helper to open nothing, with no sentence '
      + 'anywhere saying the index was never built — an empty material table reads as "the '
      + 'archive holds no material about this", which is a claim about the ARCHIVE',
    );
    assert.ok(
      body.query.note !== null && /rebuild/.test(body.query.note),
      'and the reason is actionable — it names the command that fills the index',
    );
    assert.equal(
      body.query.matchable, true,
      'the passage DID name something matchable, and saying otherwise would send `mission.ts` '
      + 'down its "the passage named nothing the archive could be queried with" branch — one '
      + 'wrong sentence traded for another',
    );
    assert.deepEqual(body.query.names, [NAME], 'and the name it matched on is still named');
  } finally { b.dispose(); }
});

test('a partly built index says which part it read, when it finds nothing there', () => {
  const b = box();
  try {
    b.write('s-one', [said(`the ${NAME} was where the work landed`, '2026-09-10T09:00:00.000Z')]);
    b.scan();
    b.fill();
    // A second transcript lands after the index was built.
    b.write('s-two', [said('the harbour was quiet all morning', '2026-09-11T09:00:00.000Z')]);
    b.scan();

    const body = b.compose(`what came of \`${ABSENT}\``);
    assert.equal(body.points, 0);
    assert.ok(
      body.query.note !== null && /1 of the 2/.test(body.query.note),
      'the index covers one of the two transcripts, so an empty table cannot claim the archive '
      + '— and the coverage is a measured pair, never a hedge',
    );
  } finally { b.dispose(); }
});

test('THE MEASURED ZERO SURVIVES: a complete index that really holds no such name', () => {
  const b = box();
  try {
    b.write('s-one', [said(`the ${NAME} was where the work landed`, '2026-09-10T09:00:00.000Z')]);
    b.scan();
    b.fill();

    const body = b.compose(`what came of \`${ABSENT}\``);
    assert.equal(body.points, 0);
    assert.equal(
      body.query.note, null,
      'every transcript the archive holds was indexed and searched and none carries the name. '
      + 'That is an ANSWER, and turning it into a refusal would be this defect inverted',
    );
    assert.equal(body.query.matchable, true);
  } finally { b.dispose(); }
});

test('a point found is an answer — coverage is not discussed over material that exists', () => {
  const b = box();
  try {
    b.write('s-one', [said(`the ${NAME} was where the work landed`, '2026-09-10T09:00:00.000Z')]);
    b.scan();
    b.fill();
    b.write('s-two', [said('the harbour was quiet all morning', '2026-09-11T09:00:00.000Z')]);
    b.scan();

    const body = b.compose(`we talked about \`${NAME}\` yesterday`);
    assert.ok(body.points > 0, 'the name is in the indexed half and is pointed at');
    assert.equal(
      body.query.note, null,
      'this is `apiConversationSearch`\'s own rule, reused rather than re-decided: the refusal '
      + 'is reported when the MERGED answer is empty, because holding material back to discuss '
      + 'coverage would be the same class of drop pointed the other way',
    );
  } finally { b.dispose(); }
});

test('the query-level refusal keeps its own sentence — a passage that names nothing', () => {
  const b = box();
  try {
    b.write('s-one', [said(`the ${NAME} was where the work landed`, '2026-09-10T09:00:00.000Z')]);
    b.scan();
    // Unbuilt on purpose: the two refusals must not be able to overwrite each
    // other, and the passage's own is the one that is TRUE here — nothing was
    // matched on, so no coverage question was ever asked.

    const body = b.compose('it was the thing we kept coming back to all week');
    assert.equal(body.query.matchable, false);
    assert.ok(
      body.query.note !== null && /word-bag/.test(body.query.note),
      'a passage carrying nothing to match on is answered by `queryFromPassage`, and a '
      + 'coverage note must not replace it',
    );
  } finally { b.dispose(); }
});

/**
 * **AND THE BRIEF ITSELF, WHICH IS THE ONE READER THAT CANNOT ASK THE SCREEN.**
 *
 * Review finding against 369bb4c2: `apiRetrievalMission` builds
 * `MissionRequest.query` as `{ names, terms }` and **dropped `note` on the way
 * in**, so the disclosure reached `body.query` — which the screen draws — and
 * never reached `body.text`, which is what a dispatched subagent is handed and
 * what `writeMission` writes to disk. That reader has no screen, no second
 * request and no way to ask; the brief is the whole of what it knows. An empty
 * material table with no sentence beside it is read there as *the archive holds
 * nothing about this*, and the subagent reports exactly that.
 *
 * It is the same shape as the defect this whole item is about, one layer along:
 * a disclosure proved on the surface one reader is on and absent from the
 * surface the other is on.
 */
test('the mission text a subagent is handed carries the coverage note too', () => {
  const b = box();
  try {
    b.write('s-one', [said(`the ${NAME} was where the work landed`, '2026-09-10T09:00:00.000Z')]);
    b.scan();

    const body = b.compose(`we talked about \`${NAME}\` yesterday`);
    assert.equal(body.points, 0);
    assert.ok(
      body.query.note !== null && body.text.includes(body.query.note),
      'the screen was told and the SUBAGENT was not, although the subagent is the reader that '
      + 'cannot ask a second question. The brief says "open it at these points", names none, '
      + `and explains nothing. Got:\n${body.text}`,
    );
    assert.match(
      body.text, /## What you are looking for/,
      'and it sits in the section that answers exactly that question',
    );
    assert.ok(
      body.text.includes(`\`${NAME}\``),
      'the names are still named — the coverage note is beside them, never instead of them',
    );
  } finally { b.dispose(); }
});

test('a complete index writes no coverage line into the brief at all', () => {
  const b = box();
  try {
    b.write('s-one', [said(`the ${NAME} was where the work landed`, '2026-09-10T09:00:00.000Z')]);
    b.scan();
    b.fill();

    const body = b.compose(`what came of \`${ABSENT}\``);
    assert.equal(body.points, 0);
    assert.doesNotMatch(
      body.text, /\*\*Coverage\*\*/,
      'a measured zero is a measured zero: a coverage line on a complete index would teach the '
      + 'subagent to discount every empty answer it is ever handed',
    );
  } finally { b.dispose(); }
});
