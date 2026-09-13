// @basis TASK-the-noise-filter-and-the-subject-vocabulary-are-built-tested,
// INV-nothing-is-dropped-silently,
// RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number
/**
 * **WHAT THE BRIEF IS MADE OF, NOW THAT TASKS 7 AND 8 REACH IT** —
 * `plan:recall seq:7`, 2026-09-13.
 *
 * `src/core/retrieval/subjects.ts` and `src/core/retrieval/noise.ts` were built
 * and proved on 2026-09-11 and then imported by NOTHING but their own tests for
 * two days, while `read-model-retrieval.ts` composed every mission this product
 * ships without either of them. Two of the four modes could not succeed at all:
 * `list-subjects` and `list-anchors` declare `needsText: false`, correctly hide
 * the passage box, and then had exactly one way to find material — names out of
 * a passage there was none of.
 *
 * Their own unit tests stayed green throughout, and they still are. That is the
 * shape this file exists to close: a module can be correct and unreachable, and
 * `test/core/noise.test.ts` cannot tell the difference. **Every assertion below
 * is over the COMPOSER**, so an implementation that stops calling either module
 * goes red here rather than staying green over there.
 *
 * ── THE THREE THINGS PROVED, AND THE ONE DELIBERATELY NOT ─────────────────
 *
 *   1. **A lane hit names the LANE's transcript.** Found while wiring: a
 *      `ProseHit` carries a session id and a lane id, and the file was resolved
 *      from the session id alone — so a lane's byte offset was handed out
 *      against the session's file. Measured on the real archive 2026-09-13:
 *      58 of 60 pointers in a `from-selection` brief were lane hits, and the
 *      session file at one of their offsets holds a different record. This is
 *      a SEPARATE defect from the two modes above and is proved separately.
 *   2. **A turn every 8-gram of which has already been seen is not named
 *      twice.** §6's repeat rule, reaching a mission for the first time.
 *   3. **The two textless modes find their own material** — anchors out of the
 *      anchors table, subjects out of the documents.
 *
 * NOT PROVED HERE: that the noise filter improves a brief on the REAL archive.
 * That is a measurement, not an assertion, and it was taken before anything was
 * wired — 8 of 25 points on one real passage, all eight the same injected
 * harness notification at eight offsets. It lives in `withoutNoise`' header
 * with its numbers, where the next reader of that function will meet it.
 *
 * ── AND THE FIXTURE IS ARRANGED SO NO ASSERTION CAN PASS ON A NEIGHBOUR ───
 *
 * Every distinctive string appears in exactly one place. The lane's turn and
 * the session's turn carry DIFFERENT names, so an assertion about which file a
 * lane hit points at cannot pass on the session's row; the repeated turn's text
 * shares no word with the turn that must survive it; and the document heading
 * the subject vocabulary must find appears in no transcript this fixture writes
 * except the one turn that is supposed to match it. That is the failure mode
 * `d6f09ce4` caught three times in one lane — `sess-a` was inside the session
 * id, the path, the scope line and the anchor id at once — and the fixture is
 * built against it rather than against a memory of it.
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
import { markAnchor } from '../../src/core/anchors.ts';
import { apiRetrievalMission, type MissionComposeBody } from '../../src/ui/read-model-retrieval.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

const SESSION = 'compose-session-zeta';
const LANE = 'agent-composelanekappa';
const OTHER_LANE = 'agent-composelaneomicron';

/** The name ONLY the lane's turn carries. Nothing else in this fixture says it. */
const LANE_ONLY_NAME = 'laneOnlySymbolQuux';
/** The name ONLY the session's own turn carries. */
const SESSION_ONLY_NAME = 'sessionOnlySymbolThud';
/** The name the twice-written turn carries, and the once-written turn beside it. */
const REPEATED_NAME = 'repeatedSymbolGarply';
/** The heading a document gives, matched out of the transcript by the vocabulary. */
const DOCUMENT_HEADING = 'Wobbly telemetry gate';

const say = (role: 'user' | 'assistant', body: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? body : [{ type: 'text', text: body }] },
  timestamp: at,
});

/**
 * The turn the repeat rule must drop, written twice at two offsets.
 *
 * Long enough to carry several 8-grams, and every one of its words is absent
 * from the turn that must survive it: a repeat rule dropping the wrong turn
 * would be invisible if the two shared a phrase.
 */
const DUPLICATE_BODY =
  `${REPEATED_NAME}: automated background event notice, repeated verbatim by the harness, `
  + 'carrying no statement and no decision whatsoever in it';

const SURVIVOR_BODY =
  `${REPEATED_NAME} was chosen after we weighed three options; that ruling stands today`;

interface Fixture { cwd: string; home: string; dbPath: string }

function fixture(options: { documents?: boolean } = {}): Fixture {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-compose-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-compose-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });

  writeFileSync(path.join(dir, `${SESSION}.jsonl`), [
    say('user', `open ${SESSION_ONLY_NAME} and tell me what it does`, '2026-09-10T09:00:00.000Z'),
    say('assistant', DUPLICATE_BODY, '2026-09-10T09:00:01.000Z'),
    say('assistant', SURVIVOR_BODY, '2026-09-10T09:00:02.000Z'),
    say('assistant', DUPLICATE_BODY, '2026-09-10T09:00:03.000Z'),
    say('assistant',
      `the ${DOCUMENT_HEADING} came up again in review`, '2026-09-10T09:00:04.000Z'),
  ].map((r) => JSON.stringify(r)).join('\n') + '\n');

  const under = path.join(dir, SESSION, 'subagents');
  mkdirSync(under, { recursive: true });
  writeFileSync(path.join(under, `${LANE}.jsonl`), [
    say('assistant',
      `the lane reports ${LANE_ONLY_NAME} is where the work landed`,
      '2026-09-10T09:30:00.000Z'),
  ].map((r) => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync(path.join(under, `${LANE}.meta.json`), JSON.stringify({
    agentType: 'general-purpose', description: 'the compose lane',
    toolUseId: 'toolu_compose_lane', spawnDepth: 1,
  }));

  // **A SECOND LANE, ADDED BECAUSE A REMOVAL PROOF STAYED GREEN WITHOUT IT.**
  // With one lane in the archive, `agent_id = ?` and `agent_id IS NOT NULL`
  // return the same row, so the scope assertion below passed on a build that
  // ignored the argument entirely — the fixture's SHAPE was carrying the proof
  // rather than its subject. Its turn deliberately carries none of the names
  // above, so it changes no other count than the total.
  writeFileSync(path.join(under, `${OTHER_LANE}.jsonl`), [
    say('assistant', 'an unrelated lane finished and had nothing to add',
      '2026-09-10T09:45:00.000Z'),
  ].map((r) => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync(path.join(under, `${OTHER_LANE}.meta.json`), JSON.stringify({
    agentType: 'general-purpose', description: 'the other compose lane',
    toolUseId: 'toolu_compose_other', spawnDepth: 1,
  }));

  if (options.documents === true) {
    const docs = path.join(cwd, 'docs');
    mkdirSync(docs, { recursive: true });
    writeFileSync(path.join(docs, 'telemetry.md'),
      `# A document nobody quotes\n\n## ${DOCUMENT_HEADING}\n\nWhat it decides.\n`);
  }

  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0);
  } finally { process.chdir(previous); }
  const dbPath = path.join(cwd, '.my_context', '.index.db');
  rebuildConversations(dbPath, process.env, cwd, {});
  const index = ConversationIndex.open(dbPath);
  try { buildSearchIndex(index, { full: true }); } finally { index.close(); }
  return { cwd, home, dbPath };
}

function tidy(f: Fixture): void {
  delete process.env['CLAUDE_CONFIG_DIR'];
  removeTree(f.cwd);
  removeTree(f.home);
}

function compose(f: Fixture, body: Record<string, unknown>): MissionComposeBody {
  const previous = process.cwd();
  process.chdir(f.cwd);
  let result;
  try {
    result = apiRetrievalMission(resolveWorkspace(f.cwd), body);
  } finally { process.chdir(previous); }
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body as MissionComposeBody;
}

/** The rows of the material table, which is where every pointer assertion belongs. */
function materialRows(text: string): string[] {
  const section = text.split('## The material')[1] ?? '';
  return section.split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| # |')
      && !line.startsWith('| --- |'));
}

/* ── 1. THE LANE FILE ─────────────────────────────────────────────────────── */

test('a lane hit names the LANE transcript, and a session hit names the session', () => {
  const f = fixture();
  try {
    const lane = compose(f, { mode: 'from-selection', passage: `\`${LANE_ONLY_NAME}\`` });
    const laneRows = materialRows(lane.text);
    assert.equal(laneRows.length, 1,
      `only the lane's own turn carries ${LANE_ONLY_NAME}, so one row is the whole of what `
      + `this search can find: ${JSON.stringify(laneRows)}`);

    // **Asserted on the ROW, not on the whole mission text.** The lane id is
    // also inside the session directory's path and inside the lane column, so
    // `text.includes(LANE)` would pass with the transcript column left wrong —
    // which is exactly the three-in-one finding `d6f09ce4` recorded.
    const cells = (laneRows[0] as string).split(' | ');
    const transcript = (cells[cells.length - 1] as string).replace(/ \|$/, '');
    assert.ok(transcript.endsWith(`${LANE}.jsonl`),
      'a lane hit was handed a transcript that is not the lane\'s. Its byte offset is an offset '
      + `into the LANE's file, so the subagent would seek that far into another file entirely: `
      + `${transcript}`);
    assert.ok(!transcript.endsWith(`${SESSION}.jsonl`),
      'the lane hit points at the session transcript — the defect itself, stated in the '
      + 'direction that cannot pass by accident');

    const own = compose(f, { mode: 'from-selection', passage: `\`${SESSION_ONLY_NAME}\`` });
    const ownRows = materialRows(own.text);
    assert.equal(ownRows.length, 1);
    const ownCells = (ownRows[0] as string).split(' | ');
    const ownTranscript = (ownCells[ownCells.length - 1] as string).replace(/ \|$/, '');
    assert.ok(ownTranscript.endsWith(`${SESSION}.jsonl`),
      'a turn in the session\'s OWN transcript was sent somewhere else. The other direction is '
      + 'asserted because a resolver that always answered "the lane" would pass assertion one '
      + 'and be just as wrong.');
  } finally { tidy(f); }
});

/* ── 2. THE NOISE FILTER ──────────────────────────────────────────────────── */

test('a turn every 8-gram of which was already seen is not named a second time', () => {
  const f = fixture();
  try {
    const body = compose(f, { mode: 'from-selection', passage: `\`${REPEATED_NAME}\`` });

    // Three turns carry the name; two of them are byte-identical.
    assert.equal(body.noise.seen, 3,
      'the search no longer finds all three turns carrying the name, so the count below would '
      + 'be measuring the search rather than the filter');
    assert.equal(body.noise.repeat, 1,
      '§6\'s repeat rule removed a number of turns other than one. Two of the three are the '
      + 'same words at two offsets, and the rule drops a turn only when EVERY gram of it has '
      + 'been seen — so exactly one is the arithmetic, not a threshold');
    assert.equal(body.points, 2,
      'the brief still names the duplicate. That is the whole of what Task 8 buys: a subagent '
      + 'told to open three points reads the same words at two of them');

    // **The SURVIVING turn is the one that said something**, asserted on the
    // rows: a filter that kept two duplicates and dropped the ruling would pass
    // a bare count.
    const rows = materialRows(body.text);
    assert.equal(rows.length, 2);
    const offsets = rows.map((row) => Number(row.split(' | ')[4]));
    assert.equal(new Set(offsets).size, 2,
      'two rows at one offset is one point written twice');

    const index = ConversationIndex.openReadOnlyChecked(f.dbPath);
    let survivorOffset = -1;
    try {
      for (const span of index.proseSpans({}, 50)) {
        if (span.text === SURVIVOR_BODY) survivorOffset = span.byteOffset;
      }
    } finally { index.close(); }
    assert.notEqual(survivorOffset, -1, 'the fixture no longer holds the surviving turn');
    assert.ok(offsets.includes(survivorOffset),
      'the turn that carried the RULING was dropped and a duplicate kept. The repeat rule is '
      + 'order-sensitive by design — first occurrence wins — so this is the assertion that '
      + 'says which occurrence that is');
  } finally { tidy(f); }
});

test('every point the search found is in exactly one column of the noise report', () => {
  const f = fixture();
  try {
    const body = compose(f, { mode: 'from-selection', passage: `\`${REPEATED_NAME}\`` });
    const removed = body.noise.work + body.noise.tool + body.noise.repeat + body.noise.empty;
    assert.equal(body.points + removed, body.noise.seen,
      'a point was found, is not named, and is in no removal column — '
      + 'INV-nothing-is-dropped-silently, and the arithmetic is the only thing that can catch '
      + `it: ${JSON.stringify(body.noise)} against ${body.points} named`);
  } finally { tidy(f); }
});

test('the machinery columns are zero here, and that is a finding rather than a pass', () => {
  const f = fixture();
  try {
    const body = compose(f, { mode: 'from-selection', passage: `\`${REPEATED_NAME}\`` });
    // **THIS ASSERTION IS EXPECTED TO STAY GREEN UNDER REMOVAL, AND IS KEPT
    // FOR WHAT THAT SAYS.** `conversation-search.ts` · `proseFrom` indexes a
    // span only when `classifyTurn` calls it a prompt or an answer, and
    // `noise.ts` · `stanceOf` derives `said` from that same `classifyTurn` — so
    // no point a search can produce is ever `work` or a non-prose `deed`, and
    // deleting the whole filter would leave these two at zero. Measured on the
    // real archive over three passages: 0, 0 and 0 in both columns, across 99
    // points. It is written down so the next reader is not misled into thinking
    // wiring `removeNoise` bought a machinery filter here; it bought the repeat
    // rule, and the machinery filter was already applied one layer down.
    assert.equal(body.noise.work, 0);
    assert.equal(body.noise.tool, 0);
  } finally { tidy(f); }
});

/* ── 2b. AND THE VOCABULARY REACHES THE PASSAGE MODES ─────────────────────── */

test('a passage naming no identifier is matched on the documents own words', () => {
  const f = fixture({ documents: true });
  try {
    const body = compose(f, {
      mode: 'free-text',
      // Not one backtick, not one path, not one item id — `queryFromPassage`
      // refuses this outright without a vocabulary, and refusing is correct:
      // a word-bag matched 32% against this archive where names matched 68%.
      passage: `it was the ${DOCUMENT_HEADING} we kept coming back to`,
    });
    assert.equal(body.query.matchable, true,
      'the passage carries a name a DOCUMENT gave, and `queryFromPassage` has taken a '
      + 'vocabulary since Task 6 with every caller passing none — which is why its own refusal '
      + 'note ends "and no term from the vocabulary it was given", a clause that could not '
      + `become true. Got: ${body.query.note}`);
    assert.deepEqual(body.query.terms, [DOCUMENT_HEADING]);
    assert.deepEqual(body.query.names, [],
      'a NAME was extracted, so the assertion above may be passing on the identifier path '
      + 'rather than on the vocabulary');

    // **AND THE TERMS ARE SEARCHED, not merely printed.** This is the half a
    // measurement caught and no assertion did: matchable went true, the brief
    // named three terms, and the material table stayed empty — the same "open
    // it at these points" with no points that `pointersFor` was written to
    // close, reappearing inside its own repair.
    assert.ok(body.points > 0,
      'the brief says what it is looking for and then tells the subagent to open nothing');
    assert.equal(materialRows(body.text).length, body.points);
  } finally { tidy(f); }
});

/* ── 3. THE TWO MODES THAT HAVE NO PASSAGE ────────────────────────────────── */

test('list-anchors finds the fixed points with no passage at all', () => {
  const f = fixture();
  try {
    const before = compose(f, { mode: 'list-anchors' });
    assert.equal(before.anchors, 0);
    assert.equal(before.query.matchable, false,
      'a workspace with no anchors must say so, rather than claiming a query it does not have');
    assert.ok((before.query.note ?? '').includes('no anchors'),
      'the empty answer must name what is empty. "Paste something that names things" was the '
      + 'note this mode used to give, and it is advice about a passage the mode does not take');

    const index = ConversationIndex.open(f.dbPath);
    let marked: string;
    try {
      const span = index.proseSpans({ agentId: LANE }, 10)[0];
      assert.notEqual(span, undefined, 'the fixture no longer holds a lane turn to mark');
      marked = markAnchor(index, {
        sessionId: span!.sessionId, agentId: span!.agentId,
        byteOffset: span!.byteOffset, label: LANE_ONLY_NAME, kind: 'ruling', origin: 'owner',
      }).id;
    } finally { index.close(); }

    const after = compose(f, { mode: 'list-anchors' });
    assert.equal(after.anchors, 1,
      'the anchor the workspace holds did not reach the brief. This is the defect the item was '
      + 'filed on: 684 anchors rendered on the screen and 0 in the mission composed beside them');
    assert.equal(after.points, 1,
      'the brief names the anchor and then tells the subagent to open nothing — the empty '
      + 'material table `pointersFor` was written to close, reappearing one mode over');

    // Asserted on the anchors SECTION and on the material ROW separately: the
    // anchor id contains the lane id and the byte offset, so a `text.includes`
    // over the whole mission would pass on the id alone with the table empty.
    const anchorSection = after.text.split('## Anchors he chose')[1]?.split('\n## ')[0] ?? '';
    assert.ok(anchorSection.includes(marked),
      `the anchors section does not name the anchor: ${anchorSection}`);
    assert.equal(materialRows(after.text).length, 1);
    assert.deepEqual(after.query.terms, [LANE_ONLY_NAME],
      'the fixed points\' own labels are what this mode queries with, and the brief must show '
      + 'them where the other modes show names');
  } finally { tidy(f); }
});

test('a brief that carries only the newest anchors says that it is a window', () => {
  const f = fixture();
  try {
    // **A FEW ANCHORS FIRST: the caveat must be absent when there is no
    // window.** A sentence printed on every brief is a sentence a reader stops
    // reading, so both directions are asserted and neither is the default.
    const index = ConversationIndex.open(f.dbPath);
    try {
      for (const span of index.proseSpans({}, 100)) {
        markAnchor(index, {
          sessionId: span.sessionId, agentId: span.agentId, byteOffset: span.byteOffset,
          label: `mark-${span.byteOffset}`, kind: 'note', origin: 'owner',
        });
      }
    } finally { index.close(); }

    const few = compose(f, { mode: 'list-anchors' });
    assert.equal(few.anchorsInScope, 7);
    assert.equal(few.anchors, 7,
      'below the cap the window IS the whole set, so these two must agree — stated so the '
      + 'absence asserted next is known to be about the sentence and not about a truncation');
    const fewSection = few.text.split('## Anchors he chose')[1]?.split('\n## ')[0] ?? '';
    assert.ok(!fewSection.includes('most recent of'),
      'the brief claims to be a window when it carries everything in scope: '
      + `${fewSection.slice(0, 200)}`);

    // **NOW PAST THE CAP, AND THE COUNT IS TAKEN ON A REAL TRUNCATION.** The
    // extra anchors sit at byte offsets the transcript does not reach, which is
    // deliberate and costs nothing here: this assertion is about how many were
    // IN SCOPE before the bound, and an anchor is a row in a table whether or
    // not a record still stands at its offset. Sixty-five, because the bound is
    // sixty — a fixture that cannot cross it cannot prove anything about it,
    // and the first draft of this test could not: with seven anchors, counting
    // before the cap and counting after it give the same seven, so BOTH
    // removal proofs came back green.
    const more = ConversationIndex.open(f.dbPath);
    try {
      for (let n = 0; n < 58; n += 1) {
        markAnchor(more, {
          sessionId: SESSION, agentId: null, byteOffset: 1_000_000 + n,
          label: `beyond-${n}`, kind: 'note', origin: 'owner',
        });
      }
    } finally { more.close(); }

    const windowed = compose(f, { mode: 'list-anchors' });
    assert.equal(windowed.anchorsInScope, 65,
      'the count is being taken AFTER the bound, so a bounded brief reports its own bound as '
      + `the size of the archive: ${windowed.anchorsInScope}`);
    assert.equal(windowed.anchors, 60,
      'the brief carries something other than the cap, so the numbers below would be about '
      + 'a different bound than POINTER_CAP');
    const windowedSection = windowed.text.split('## Anchors he chose')[1]?.split('\n## ')[0] ?? '';
    assert.ok(windowedSection.includes('the 60 most recent of 65 in scope'),
      'a brief carrying 60 of 65 fixed points does not say so, so a reader who does not find '
      + 'his own concludes it was never marked — INV-nothing-is-dropped-silently, in the form '
      + `this feature can break it: ${windowedSection.slice(0, 300)}`);
  } finally { tidy(f); }
});

test('an anchor pointer prints a dash for a record ordinal it does not have', () => {
  const f = fixture();
  try {
    const index = ConversationIndex.open(f.dbPath);
    try {
      const span = index.proseSpans({ agentId: LANE }, 10)[0];
      markAnchor(index, {
        sessionId: span!.sessionId, agentId: span!.agentId,
        byteOffset: span!.byteOffset, label: LANE_ONLY_NAME, kind: 'ruling', origin: 'owner',
      });
    } finally { index.close(); }

    const row = materialRows(compose(f, { mode: 'list-anchors' }).text)[0] as string;
    const ordinal = row.split(' | ')[3];
    assert.equal(ordinal, '—',
      '§7 gives an anchor a byte offset and no record index, so the ordinal is not known. '
      + `Printing ${ordinal} would be a citation to a record nobody looked up — a fabricated `
      + 'field is a silent drop wearing a value');
  } finally { tidy(f); }
});

test('list-subjects reads what was worked on out of the documents', () => {
  const f = fixture({ documents: true });
  try {
    const body = compose(f, { mode: 'list-subjects' });
    assert.notEqual(body.subjects, null, 'the mode returned no subject pass at all');
    assert.equal(body.subjects!.derived, true,
      'the vendored tokeniser did not load, so the vocabulary below is empty for a reason '
      + 'that has nothing to do with the archive');
    assert.equal(body.subjects!.documentsRead, 1,
      'the document under docs/ was not read, so any subject found came from somewhere else');
    assert.ok(body.query.terms.includes(DOCUMENT_HEADING),
      `the heading the document gives is not among the subjects: ${JSON.stringify(body.query.terms)}`);
    assert.ok(body.subjects!.documents.includes('docs/telemetry.md'),
      'a subject reached the brief without the document it came from. §8 is why that matters: '
      + 'a subject handed over without a citation is a claim the subagent cannot check');

    // **AND THE CITATION HAS TO BE IN THE MISSION, not only in the compose
    // body.** Added after a removal proof: blanking the `documents` the request
    // is built from left the assertion above GREEN, because it reads the pass
    // rather than the brief — the subagent would have been handed a subject
    // list with no document behind it and no test would have said so. That is
    // the same class as the fixture findings `d6f09ce4` recorded: an assertion
    // one field short of the thing it is about.
    const cited = body.text.split('## The documents that name this subject')[1]
      ?.split('\n## ')[0] ?? '';
    assert.ok(cited.includes('docs/telemetry.md'),
      `the mission names no document behind its subjects: ${JSON.stringify(cited)}`);
    assert.ok(body.points > 0,
      'the subjects were named and the brief then told the subagent to open nothing');
  } finally { tidy(f); }
});

test('list-subjects says the documents named nothing rather than showing an empty list', () => {
  const f = fixture();
  try {
    const body = compose(f, { mode: 'list-subjects' });
    assert.deepEqual(body.query.terms, []);
    assert.equal(body.query.matchable, false);
    assert.ok((body.query.note ?? '').includes('docs/'),
      'a workspace with no documents gets a note about something else, so the reader is told '
      + 'to fix the wrong thing. INV-nothing-is-dropped-silently: an empty answer names what '
      + `was empty. Got: ${body.query.note}`);
  } finally { tidy(f); }
});

test('proseSpans answers newest-first and narrows to one lane', () => {
  const f = fixture();
  try {
    const index = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      const all = index.proseSpans({}, 100);
      assert.equal(all.length, 7,
        'the fixture writes five session turns and two lane turns, and every one of them is a '
        + 'prompt or an answer — a different count means this is measuring the scan');

      const stamps = all.map((span) => span.at ?? '');
      assert.deepEqual(stamps, [...stamps].sort().reverse(),
        '`list-subjects` asks what has been worked on LATELY, so a bounded window is only an '
        + 'answer if it is the newest end of the archive. Out of order, the limit silently '
        + `returns an arbitrary slice: ${JSON.stringify(stamps)}`);

      const lane = index.proseSpans({ agentId: LANE }, 100);
      assert.equal(lane.length, 1);
      assert.equal(lane[0]!.text, `the lane reports ${LANE_ONLY_NAME} is where the work landed`,
        'the lane scope returned something other than the lane\'s only turn');

      const own = index.proseSpans({ agentId: null }, 100);
      assert.equal(own.length, 5,
        '`agentId: null` must mean the session\'s OWN transcript and not "any lane". Both '
        + 'directions are asserted because they are different SQL — `IS NULL` against `= ?` — '
        + 'and a filter that answered "any lane" for null would leave the assertion above '
        + 'untouched');
    } finally { index.close(); }
  } finally { tidy(f); }
});

/* ── 4. AND THE GUARANTEE THE WHOLE FEATURE RESTS ON ──────────────────────── */

test('the words at a point are carried to the composer and never into the mission', () => {
  const f = fixture();
  try {
    const body = compose(f, { mode: 'from-selection', passage: `\`${REPEATED_NAME}\`` });
    assert.ok(body.points > 0, 'nothing was found, so the assertion below has nothing to fail on');

    // `withoutNoise` now fills `MaterialPointer.text` from `removeNoise`'s own
    // output — the field `mission.ts`' header says exists PRECISELY so that
    // this can fail. Before 2026-09-13 no production caller filled it, so
    // `test/core/mission.test.ts`' version of this assertion ran against
    // pointers that carried no text at all and no implementation could fail it.
    assert.ok(!body.text.includes(SURVIVOR_BODY),
      'the raw material is inside the mission. That is the one rule the rest of retrieval '
      + 'rests on: the noise is not to enter a context window, including the subagent\'s by '
      + 'way of this document');
    assert.ok(!body.text.includes(DUPLICATE_BODY),
      'the removed turn\'s words are in the mission, which would make the filter a rendering '
      + 'choice rather than a removal');
  } finally { tidy(f); }
});
