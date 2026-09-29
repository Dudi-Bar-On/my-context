// @basis TASK-nine-sites-report-a-measured-zero-for-something-they-could, INV-nothing-is-dropped-silently
/**
 * **ONE SESSION ANSWERED AND ANOTHER WAS NEVER SEARCHED, AND THE BODY SAID
 * NOTHING ABOUT THE SECOND.**
 *
 * Task 4.6c, gap 3 of three, and the case the reviewer found in round 1's own
 * repair. `apiConversationSearch` runs ONE search per session a `?name=`
 * narrowed to and merges the answers. Round 1 widened its refusal from `first`
 * to `answers.every((a) => !a.searchable)`, and that was right — returning on
 * the first would have thrown real hits away to report that the index is
 * behind. But it left the mixed case mute: with one session's answer
 * unsearchable and another's holding hits, the body says
 * `searchable: true, note: null` and **the empty session's coverage note is
 * nowhere in it**. The screen then draws the hits of one session as the answer
 * for both, which is `STD-a-measured-zero-is-drawn-and-named` in the direction
 * it names: a session nobody searched drawn as a session holding nothing.
 *
 * ── WHAT IS ADDED, AND WHAT IS DELIBERATELY NOT ───────────────────────────
 *
 * A PER-SESSION field beside the hits. The top-level `searchable`/`note` pair
 * is untouched, because a hit is still an answer and flipping the whole body to
 * a refusal over one blind session would be round 1's rejected design brought
 * back. `unsearched` is derived from the per-session answers this route already
 * holds — never a second measurement — and is `[]`, never absent, when every
 * session in scope answered.
 *
 * ── THE SURFACE ───────────────────────────────────────────────────────────
 *
 * The route's own body, as the browser receives it, plus a SOURCE-TEXT guard
 * over the one line of `screens/conversations.js` that draws it. That screen
 * imports the DOM at load and has no unit harness in this tree, and Playwright
 * is barred from this lane — so the branch is read as text and asserted to sit
 * ABOVE the measured-zero paragraph it exists to qualify, which is the device
 * `test/ui/secrets-over-an-unread-session.test.ts` and
 * `test/ui/conversation-follow-cadence.test.ts` already use on this same file.
 * **Stated plainly: no test here drives that screen in a browser.**
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  apiConversationSearch, type ConversationSearchBody,
} from '../../src/ui/read-model-conversations.ts';
import {
  ConversationIndex, projectDirName, rebuildConversations,
} from '../../src/core/conversation-index.ts';
import { buildSearchIndex } from '../../src/core/conversation-search.ts';
import { Store } from '../../src/core/store.ts';
import type { Workspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const ONE = 'sess-indexed-one';
const TWO = 'sess-unindexed-two';
/** The substring both names carry, so one `?name=` narrows to both sessions. */
const SHARED = 'harbour';

const said = (body: string, at: string): unknown => ({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'text', text: body }] },
  timestamp: at,
});

interface Box {
  write: (session: string, rows: unknown[]) => void;
  scan: () => void;
  fill: () => void;
  name: (session: string, name: string) => void;
  ask: (q: string, name?: string) => ConversationSearchBody;
  dispose: () => void;
}

function box(): Box {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-mixedcov-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-mixedcov-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const dbPath = path.join(cwd, 'index.db');
  Store.open(dbPath).close();
  const prior = process.env['CLAUDE_CONFIG_DIR'];
  process.env['CLAUDE_CONFIG_DIR'] = home;
  mkdirSync(path.join(cwd, '.my_context'), { recursive: true });
  const ws = { projectRoot: path.join(cwd, '.my_context'), dbPath } as unknown as Workspace;
  return {
    write: (session, rows) => writeFileSync(
      path.join(dir, `${session}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n',
    ),
    scan: () => { rebuildConversations(dbPath, process.env, cwd); },
    fill: () => {
      const index = ConversationIndex.open(dbPath);
      try { buildSearchIndex(index); } finally { index.close(); }
    },
    name: (session, name) => {
      const index = ConversationIndex.open(dbPath);
      try {
        index.setName({ sessionId: session, name, namedAt: '2026-09-12T09:00:00.000Z' });
      } finally { index.close(); }
    },
    ask: (q, name) => {
      const url = new URL(`http://localhost/api/conversations/search?q=${encodeURIComponent(q)}`);
      if (name !== undefined) url.searchParams.set('name', name);
      return apiConversationSearch(ws, url).body as ConversationSearchBody;
    },
    dispose: () => {
      if (prior === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
      else process.env['CLAUDE_CONFIG_DIR'] = prior;
      removeTree(home);
      removeTree(cwd);
    },
  };
}

/** The mixed archive: one session indexed, one scanned after the index was built. */
function mixed(b: Box): void {
  b.write(ONE, [said('the vanishing point sat below the window', '2026-09-10T09:00:00.000Z')]);
  b.scan();
  b.fill();
  b.write(TWO, [said('nothing here shares a word with the other', '2026-09-11T09:00:00.000Z')]);
  b.scan();
  b.name(ONE, `${SHARED} one`);
  b.name(TWO, `${SHARED} two`);
}

test('a session that was never searched is named in the body, beside the hits of one that was', () => {
  const b = box();
  try {
    mixed(b);

    const body = b.ask('vanishing point', SHARED);
    assert.equal(body.hits.length, 1, 'the indexed session holds the phrase and answers');
    assert.equal(
      body.searchable, true,
      'a hit is still an answer — the top-level pair stays as it is, and flipping it would be '
      + 'round 1\'s rejected design brought back',
    );
    assert.equal(body.note, null);
    assert.equal(
      body.unsearched.length, 1,
      'the OTHER session named by this `?name=` was searched over a prose index that does not '
      + 'hold it, and its empty answer was merged into the body as though it were a measurement. '
      + `Got: ${JSON.stringify(body.unsearched)}`,
    );
    assert.equal(
      body.unsearched[0]?.sessionId, TWO,
      'and it names WHICH session, because that is the whole thing the screen cannot say '
      + 'from a top-level sentence',
    );
    assert.equal(body.unsearched[0]?.sessionName, `${SHARED} two`,
      'by the name the reader narrowed with, not only by an id');
    assert.ok(
      /rebuild/.test(body.unsearched[0]?.note ?? ''),
      'carrying the search module\'s own sentence, which names the command that fills the index',
    );
  } finally { b.dispose(); }
});

test('THE MEASURED ZERO SURVIVES: every session searched answers with an empty list', () => {
  const b = box();
  try {
    b.write(ONE, [said('the vanishing point sat below the window', '2026-09-10T09:00:00.000Z')]);
    b.write(TWO, [said('nothing here shares a word with the other', '2026-09-11T09:00:00.000Z')]);
    b.scan();
    b.fill();
    b.name(ONE, `${SHARED} one`);
    b.name(TWO, `${SHARED} two`);

    const body = b.ask('vanishing point', SHARED);
    assert.equal(body.hits.length, 1);
    assert.equal(body.searchable, true);
    assert.deepEqual(
      body.unsearched, [],
      'the second session was indexed and searched and does not hold the phrase. That is an '
      + 'ANSWER, and reporting it as unsearched would invent a fault out of a complete index',
    );
  } finally { b.dispose(); }
});

test('an answer with no hits at all keeps its top-level refusal, and lists the sessions too', () => {
  const b = box();
  try {
    mixed(b);

    const body = b.ask('submarine', SHARED);
    assert.equal(body.hits.length, 0);
    assert.equal(
      body.searchable, false,
      'every answer was unsearchable, so the merged answer is not an answer — round 1\'s rule, '
      + 'untouched',
    );
    assert.ok(body.note !== null && /rebuild/.test(body.note));
    assert.deepEqual(
      body.unsearched.map((row) => row.sessionId).sort(), [ONE, TWO].sort(),
      'and the per-session field is populated on this path too, so a reader is never told '
      + 'WHICH sessions only by accident of which branch answered',
    );
  } finally { b.dispose(); }
});

test('an unscoped search reports the archive it could not read without inventing a session', () => {
  const b = box();
  try {
    b.write(ONE, [said('the vanishing point sat below the window', '2026-09-10T09:00:00.000Z')]);
    b.scan();
    // No `fill()`, and no `?name=`: one answer, over the whole archive.

    const body = b.ask('vanishing point');
    assert.equal(body.searchable, false);
    assert.equal(body.unsearched.length, 1);
    assert.equal(
      body.unsearched[0]?.sessionId, null,
      'an unscoped search is about the archive and not about one session, and naming a session '
      + 'it never narrowed to would be a fact this route does not hold',
    );
    assert.equal(body.unsearched[0]?.sessionName, null);
  } finally { b.dispose(); }
});

/* ── THE SCREEN HALF, READ AS TEXT ───────────────────────────────────────── */

test('the conversations screen draws the per-session note ABOVE the measured-zero line', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src', 'ui', 'public', 'screens', 'conversations.js'), 'utf8',
  );
  const draws = source.indexOf('body.unsearched');
  assert.ok(
    draws > 0,
    'a disclosure nothing reads is the defect one lane over: the route now says which session '
    + 'was not searched and `drawHits` must draw it',
  );
  const zero = source.indexOf('conv.arch.noMatch');
  assert.ok(zero > 0, 'the measured-zero line is still drawn');
  assert.ok(
    draws < zero,
    'it must sit ABOVE the line that says "no match", because it is what qualifies that line — '
    + 'drawn under it, a reader has already read the zero as an answer',
  );
});
