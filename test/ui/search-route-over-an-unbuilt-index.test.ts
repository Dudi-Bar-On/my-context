// @basis TASK-nine-sites-report-a-measured-zero-for-something-they-could, INV-nothing-is-dropped-silently
/**
 * **`GET /api/conversations/search` — the route the search box actually calls —
 * may not answer "the archive does not contain this" over an index that holds
 * nothing.**
 *
 * Site M10 of `TASK-nine-sites-report-a-measured-zero-for-something-they-could`,
 * **reached through the route rather than through the function under it**, and
 * that distinction is the whole reason this file exists.
 *
 * The first repair of M10 put the coverage disclosure on `searchArchive`
 * (`core/conversation-search.ts`) and its unit test proved it there. But the
 * live search box does not call `searchArchive`: `apiConversationSearch`
 * (`ui/read-model-conversations.ts`) calls `searchArchiveTiered`, a separate
 * function with its own `TieredSearchResult` whose `searchable`/`note` pair was
 * populated only by the pre-existing short-query and all-exclusions checks. So
 * over an unbuilt or partially built prose index the screen still received
 * `searchable: true, note: null, hits: []` — the exact defect, on the exact
 * surface the item is about. A test one layer below the route could not see it.
 *
 * **The prose index is filled by `mycontext conversation rebuild`**, a CLI
 * write that nothing under `src/ui/` may perform, so an unbuilt index is not an
 * edge case — it is the state every workspace is in until somebody runs it.
 *
 * What is asserted here is the ROUTE's body: `searchable`, `note` and `hits`,
 * exactly as a browser receives them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
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

const text = (t: string): unknown[] => [{ type: 'text', text: t }];

const searchUrl = (q: string): URL =>
  new URL(`http://localhost/api/conversations/search?q=${encodeURIComponent(q)}`);

interface Box {
  ws: Workspace;
  write: (session: string, lines: unknown[]) => void;
  scan: () => void;
  fill: () => void;
  ask: (q: string) => ConversationSearchBody;
  dispose: () => void;
}

function box(): Box {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-searchroute-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-searchroute-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const dbPath = path.join(cwd, 'index.db');
  Store.open(dbPath).close();
  const prior = process.env['CLAUDE_CONFIG_DIR'];
  process.env['CLAUDE_CONFIG_DIR'] = home;
  // `projectRoot` is the `.my_context` DIRECTORY in a real workspace, the same
  // shape `test/ui/conversations-endpoint.test.ts` builds.
  mkdirSync(path.join(cwd, '.my_context'), { recursive: true });
  const ws = { projectRoot: path.join(cwd, '.my_context'), dbPath } as unknown as Workspace;
  return {
    ws,
    write: (session, lines) => writeFileSync(
      path.join(dir, `${session}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n') + '\n',
    ),
    scan: () => { rebuildConversations(dbPath, process.env, cwd); },
    fill: () => {
      const index = ConversationIndex.open(dbPath);
      try { buildSearchIndex(index); } finally { index.close(); }
    },
    ask: (q) => apiConversationSearch(ws, searchUrl(q)).body as ConversationSearchBody,
    dispose: () => {
      if (prior === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
      else process.env['CLAUDE_CONFIG_DIR'] = prior;
      removeTree(home);
      removeTree(cwd);
    },
  };
}

const said = (t: string, at: string): unknown => ({
  type: 'assistant', message: { role: 'assistant', content: text(t) }, timestamp: at,
});

test('the ROUTE says the prose index was never built, rather than answering for the archive', () => {
  const b = box();
  try {
    b.write('s-one', [said('the vanishing point sat below the window', '2026-09-10T09:00:00.000Z')]);
    b.scan();
    // Deliberately no `fill()`: the archive is walked, the prose index is not.

    const body = b.ask('vanishing point');
    assert.equal(body.hits.length, 0, 'nothing is indexed, so nothing can match — that part is right');
    assert.equal(
      body.searchable, false,
      'the search box asks THIS route, and an empty list with `searchable: true` is what the '
      + 'screen draws as "the archive does not contain this" — M10, reached through the route',
    );
    assert.ok(
      body.note !== null && /rebuild/.test(body.note),
      'INV-nothing-is-dropped-silently: the reader is told the index is unbuilt AND how to build it',
    );
  } finally { b.dispose(); }
});

test('the ROUTE says the index covers only part of the archive when it finds nothing', () => {
  const b = box();
  try {
    b.write('s-one', [said('the vanishing point sat below the window', '2026-09-10T09:00:00.000Z')]);
    b.scan();
    b.fill();
    // A second transcript lands after the index was built. The archive holds
    // two and the prose index holds one, so "nothing found" is a statement
    // about half of it.
    b.write('s-two', [said('the harbour was quiet all morning', '2026-09-11T09:00:00.000Z')]);
    b.scan();

    const body = b.ask('submarine');
    assert.equal(body.hits.length, 0);
    assert.equal(
      body.searchable, false,
      'the index covers 1 of 2 transcripts, so an empty answer here cannot claim the archive',
    );
    assert.ok(
      body.note !== null && /1 of the 2/.test(body.note),
      'and the note carries the coverage as a measured pair, never as a hedge',
    );
  } finally { b.dispose(); }
});

test('THE MEASURED ZERO SURVIVES: a complete index that really does not hold the phrase', () => {
  const b = box();
  try {
    b.write('s-one', [said('the vanishing point sat below the window', '2026-09-10T09:00:00.000Z')]);
    b.scan();
    b.fill();

    const body = b.ask('submarine');
    assert.equal(body.hits.length, 0);
    assert.equal(
      body.searchable, true,
      'every transcript the archive holds was indexed and searched and none carries the phrase. '
      + 'That is an ANSWER, and turning it into a refusal would be this defect inverted.',
    );
    assert.equal(body.note, null);
  } finally { b.dispose(); }
});

test('a hit is never held back to discuss coverage, and the route still serves it', () => {
  const b = box();
  try {
    b.write('s-one', [said('the vanishing point sat below the window', '2026-09-10T09:00:00.000Z')]);
    b.scan();
    b.fill();
    b.write('s-two', [said('the harbour was quiet all morning', '2026-09-11T09:00:00.000Z')]);
    b.scan();

    const body = b.ask('vanishing point');
    assert.equal(body.hits.length, 1, 'the phrase is in the indexed half and is found');
    assert.equal(body.searchable, true, 'an answer that found something is an answer');
    assert.equal(body.note, null);
  } finally { b.dispose(); }
});

test('an empty archive is not an unbuilt index — zero of zero is complete coverage', () => {
  const b = box();
  try {
    b.scan();
    const body = b.ask('vanishing point');
    assert.equal(body.hits.length, 0);
    assert.equal(
      body.searchable, true,
      'reporting a fresh workspace as unsearchable would invent a fault out of an empty archive',
    );
    assert.equal(body.note, null);
  } finally { b.dispose(); }
});

test('the pre-existing refusals are untouched — a short query still names the floor', () => {
  const b = box();
  try {
    b.write('s-one', [said('the user interface was measured', '2026-09-10T09:00:00.000Z')]);
    b.scan();
    b.fill();

    const body = b.ask('ui');
    assert.equal(body.searchable, false);
    assert.equal(body.hits.length, 0);
    assert.ok(
      body.note !== null && /3/.test(body.note),
      'the query-level refusal keeps its own sentence and is not replaced by a coverage note',
    );
  } finally { b.dispose(); }
});
