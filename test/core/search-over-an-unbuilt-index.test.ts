// @basis TASK-nine-sites-report-a-measured-zero-for-something-they-could, INV-nothing-is-dropped-silently
/**
 * **`searchArchive` may not answer "the archive does not contain this" over an
 * index that holds nothing.**
 *
 * Site M10 of `TASK-nine-sites-report-a-measured-zero-for-something-they-could`
 * (report 3, `reports/2026-09-12-silent-failures-reviewed.md`):
 *
 * > `SearchResult` carries `searchable`/`note` precisely so an empty list
 * > cannot be mistaken for an answer, and that machinery is used for exactly
 * > one case: a query under three characters. The file's own header admits
 * > *"until a caller runs it the table is EMPTY rather than stale, and an empty
 * > table answers nothing rather than answering wrongly"* — and then answers
 * > `searchable: true, note: null, hits: []`.
 *
 * A retrieval mission finds no pointers and presents that as "the archive holds
 * no material about this". The prose index is filled by
 * `mycontext conversation rebuild`, a CLI write that nothing under `src/ui/`
 * may perform, so a browser or an agent reaching a workspace where nobody has
 * run it is not an edge case — it is the state every workspace starts in.
 *
 * **Where the answer is printed — and this file's first version got that
 * wrong, which is worth keeping rather than quietly correcting.** It claimed
 * "both consumers already draw it", naming `apiConversationSearch`. They do
 * not, and neither does what it named:
 *
 *  - `apiConversationSearch` (`ui/read-model-conversations.ts`) — the route the
 *    live search box calls — does not call `searchArchive` at all. It calls
 *    `searchArchiveTiered`, a separate function with its own result type, and
 *    a disclosure on THIS function never reached the screen.
 *    `test/ui/search-route-over-an-unbuilt-index.test.ts` is where that is
 *    proved now, through the route, and it is the test that matters for M10.
 *  - `read-model-retrieval.ts`'s `pointersFor` reads `.hits` and drops the
 *    rest, so the sentence in its header describes an intention rather than
 *    the code. Its body has its own `query.matchable`/`query.note` pair to
 *    carry this, and wiring it there is that surface's to do.
 *
 * What IS true of `searchable`/`note` is that it is the convention this module
 * already owns — it exists so an empty list cannot be mistaken for an answer,
 * and it was being used for exactly one case. Nothing new is invented here;
 * what was missing was reaching the callers.
 *
 * ── THE COST, STATED, BECAUSE IT IS ON A HOT PATH ─────────────────────────
 *
 * The coverage question is asked ONLY when the hit list is empty. `searchArchive`
 * is called per probe by the per-turn anchor pass (`core/anchor-pass.ts`), and
 * a search that FOUND something needs no disclosure — the confusion this fixes
 * exists exactly when the answer is "nothing".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ConversationIndex, projectDirName, rebuildConversations,
} from '../../src/core/conversation-index.ts';
import { buildSearchIndex, searchArchive } from '../../src/core/conversation-search.ts';
import { Store } from '../../src/core/store.ts';
import { removeTree } from '../helpers/tmp.ts';

const SESSION = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const OTHER = 'ffffffff-1111-2222-3333-444444444444';

const say = (role: 'user' | 'assistant', text: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? text : [{ type: 'text', text }] },
  timestamp: at,
  cwd: '/w',
  gitBranch: 'master',
});

function fixture(): {
  env: Record<string, string | undefined>;
  cwd: string;
  dbPath: string;
  session: (session: string, rows: unknown[]) => void;
  dispose: () => void;
} {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-unbuilt-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-unbuilt-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const dbPath = path.join(cwd, 'index.db');
  Store.open(dbPath).close();
  return {
    env: { CLAUDE_CONFIG_DIR: home },
    cwd,
    dbPath,
    session: (session, rows) => writeFileSync(
      path.join(dir, `${session}.jsonl`),
      rows.map((r) => JSON.stringify(r)).join('\n') + '\n',
    ),
    dispose: () => { removeTree(home); removeTree(cwd); },
  };
}

/** The archive walked, and the prose index left exactly as `build` leaves it. */
function archive(f: ReturnType<typeof fixture>, build: boolean): ConversationIndex {
  rebuildConversations(f.dbPath, f.env, f.cwd, {});
  const index = ConversationIndex.open(f.dbPath);
  if (build) buildSearchIndex(index);
  return index;
}

test('an archive whose prose index was never built answers UNSEARCHABLE, not "not here"', () => {
  const f = fixture();
  try {
    f.session(SESSION, [say('assistant', 'the periscope is raised', '2026-09-01T10:00:00.000Z')]);
    const index = archive(f, false);
    try {
      const found = searchArchive(index, 'periscope');
      assert.equal(found.hits.length, 0, 'nothing is indexed, so nothing can match — that part is right');
      assert.equal(
        found.searchable, false,
        'an empty hit list over an index holding NOTHING is not an answer about the archive, and '
        + '`searchable` is the field this type carries so the two cannot be confused',
      );
      assert.ok(
        found.note !== null && /rebuild/.test(found.note),
        'INV-nothing-is-dropped-silently: the reader must be told the index is unbuilt AND how to '
        + 'build it, or the disclosure is a shrug',
      );
    } finally { index.close(); }
  } finally { f.dispose(); }
});

test('an index that covers only PART of the archive says so when it finds nothing', () => {
  const f = fixture();
  try {
    f.session(SESSION, [say('assistant', 'the periscope is raised', '2026-09-01T10:00:00.000Z')]);
    const index = archive(f, true);
    try {
      // A second session lands after the index was built. The archive now holds
      // two transcripts and the prose index holds one, so "nothing found" is a
      // statement about half of it.
      f.session(OTHER, [say('assistant', 'the harbour is quiet', '2026-09-02T10:00:00.000Z')]);
      index.close();
    } catch { /* fall through to the reopen below */ }
    const reopened = archive(f, false);
    try {
      const found = searchArchive(reopened, 'submarine');
      assert.equal(found.hits.length, 0);
      assert.equal(
        found.searchable, false,
        'the index covers 1 of 2 transcripts, so an empty answer cannot claim the archive',
      );
      assert.ok(found.note !== null && /1 of 2|1 of the 2/.test(found.note),
        'and the note carries the coverage as a measured pair, never as a hedge');
    } finally { reopened.close(); }
  } finally { f.dispose(); }
});

test('a fully indexed archive that really does not hold the phrase still answers plainly', () => {
  const f = fixture();
  try {
    f.session(SESSION, [say('assistant', 'the periscope is raised', '2026-09-01T10:00:00.000Z')]);
    const index = archive(f, true);
    try {
      const found = searchArchive(index, 'submarine');
      assert.equal(found.hits.length, 0);
      assert.equal(
        found.searchable, true,
        'THE MEASURED ZERO, which must survive the repair: every transcript the archive holds was '
        + 'indexed and searched, and none of them carries the phrase. That is an answer.',
      );
      assert.equal(found.note, null);
    } finally { index.close(); }
  } finally { f.dispose(); }
});

test('an empty archive is not an unbuilt index — there was nothing to index', () => {
  const f = fixture();
  try {
    const index = archive(f, false);
    try {
      const found = searchArchive(index, 'periscope');
      assert.equal(found.hits.length, 0);
      assert.equal(
        found.searchable, true,
        'zero transcripts indexed out of zero transcripts held is COMPLETE coverage of an empty '
        + 'archive; reporting it as unsearchable would invent a fault out of an empty workspace',
      );
      assert.equal(found.note, null);
    } finally { index.close(); }
  } finally { f.dispose(); }
});

test('a hit is never held back to discuss coverage', () => {
  const f = fixture();
  try {
    f.session(SESSION, [say('assistant', 'the periscope is raised', '2026-09-01T10:00:00.000Z')]);
    const index = archive(f, true);
    try {
      f.session(OTHER, [say('assistant', 'the harbour is quiet', '2026-09-02T10:00:00.000Z')]);
      index.close();
    } catch { /* fall through */ }
    const reopened = archive(f, false);
    try {
      const found = searchArchive(reopened, 'periscope');
      assert.equal(found.hits.length, 1, 'the phrase is in the indexed half and is found');
      assert.equal(found.searchable, true, 'an answer that found something is an answer');
      assert.equal(found.note, null);
    } finally { reopened.close(); }
  } finally { f.dispose(); }
});
