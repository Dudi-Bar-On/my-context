// @basis TASK-nine-sites-report-a-measured-zero-for-something-they-could, INV-nothing-is-dropped-silently
/**
 * **The secrets scan may not report "nothing matched" for a session it never
 * opened.**
 *
 * Site M6 of `TASK-nine-sites-report-a-measured-zero-for-something-they-could`
 * (report 3, `reports/2026-09-12-silent-failures-reviewed.md`), and the one the
 * item singles out:
 *
 * > A measured zero claimed over zero bytes read, **on the one screen in the
 * > product where being wrong has a cost outside the screen** — a reader
 * > deciding whether a transcript is safe to share.
 *
 * When the id names no row in the archive, `apiConversationSecrets` answered
 * `noSecrets(id, true, …)`: a complete, clean scan report with `indexed: true`,
 * `records: 0`, `candidates: []`. The screen skips its `indexed === false`
 * branch — the workspace IS indexed — and draws
 * *"None of the N shapes this looks for appears in this session. That is a
 * measured zero and NOT a promise."* Nothing was looked at.
 *
 * ── THE CONVENTION, NAMED ─────────────────────────────────────────────────
 *
 * This read model's existing shape: a nullable field whose `null` means *this
 * was measured*, documented against
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` — the same
 * one `matchedLanes`, `keptBytes` and `durationMs` already use on the row type
 * above. So `unscanned` is `null` on a real scan, never absent, and carries the
 * reason otherwise. Report 3 sized this as "one line each side"; the screen
 * half is `test/ui/library-screen.test.ts`' sibling below.
 *
 * **Every credential in the fixture is synthetic** and says `NOT-REAL` in its
 * own body, the same rule `test/ui/conversation-secrets-endpoint.test.ts`
 * states. Nothing is read out of the live corpus.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  apiConversationSecrets, type ConversationSecretsBody,
} from '../../src/ui/read-model-conversations.ts';
import { projectDirName, rebuildConversations } from '../../src/core/conversation-index.ts';
import { Store } from '../../src/core/store.ts';
import type { Workspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const SESSION = 'eeeeeeee-0000-1111-2222-888888888888';
const ABSENT = 'ffffffff-0000-0000-0000-000000000000';
const FAKE_KEY = 'sk-ant-api03-NOT-REAL-3333333333333333333333';

const at = (s: number): string => new Date(Date.UTC(2026, 8, 9, 15, 0, s)).toISOString();
const say = (who: 'user' | 'assistant', body: string, s: number): unknown => ({
  type: who,
  message: { role: who, content: who === 'user' ? body : [{ type: 'text', text: body }] },
  timestamp: at(s),
});

function box(lines: unknown[]): {
  scan: () => void;
  ask: (id?: string) => ConversationSecretsBody;
  dispose: () => void;
} {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-unread-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-unread-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const dbPath = path.join(cwd, 'index.db');
  Store.open(dbPath).close();
  const prior = process.env['CLAUDE_CONFIG_DIR'];
  process.env['CLAUDE_CONFIG_DIR'] = home;
  mkdirSync(path.join(cwd, '.my_context'), { recursive: true });
  const ws = { projectRoot: path.join(cwd, '.my_context'), dbPath } as unknown as Workspace;
  writeFileSync(
    path.join(dir, `${SESSION}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n') + '\n',
  );
  return {
    scan: () => { rebuildConversations(dbPath, process.env, cwd, {}); },
    ask: (id = SESSION) => apiConversationSecrets(
      ws, new URL(`http://x/api/conversations/${id}/secrets`), { id },
    ).body as ConversationSecretsBody,
    dispose: () => {
      if (prior === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
      else process.env['CLAUDE_CONFIG_DIR'] = prior;
      removeTree(home);
      removeTree(cwd);
    },
  };
}

test('a session the archive does not hold is UNSCANNED, and the body says so', () => {
  const b = box([say('user', `use ${FAKE_KEY} to call it`, 1)]);
  try {
    b.scan();
    const body = b.ask(ABSENT);
    assert.equal(body.indexed, true, 'the workspace IS indexed — that is why the screen skips its own branch');
    assert.equal(body.records, 0);
    assert.ok(
      typeof body.unscanned === 'string' && body.unscanned !== '',
      'zero candidates over zero bytes read must carry its reason, or the screen draws it as a '
      + 'measured zero — M6, on the one screen where being wrong has a cost outside the screen',
    );
    assert.match(
      body.unscanned, /archive/,
      'and the sentence must say what is actually true: this id names no row here',
    );
  } finally { b.dispose(); }
});

test('a workspace nobody has scanned is unscanned too, with its own reason', () => {
  const b = box([say('user', `use ${FAKE_KEY} to call it`, 1)]);
  try {
    const body = b.ask();
    assert.equal(body.indexed, false, 'the existing answer for this case is unchanged');
    assert.ok(typeof body.unscanned === 'string' && body.unscanned !== '');
  } finally { b.dispose(); }
});

test('a real scan reports null, never absent — "measured" is told from "this build does not say"', () => {
  const b = box([say('user', `use ${FAKE_KEY} to call it`, 1)]);
  try {
    b.scan();
    const body = b.ask();
    assert.equal(
      body.unscanned, null,
      'the session was read, so there is nothing to disclose — and `null` rather than a missing '
      + 'key is what lets a consumer tell that from a build that does not report it',
    );
    assert.ok(body.records > 0, 'the file WAS read');
    assert.ok(body.candidates.length > 0, 'and the synthetic key was proposed');
  } finally { b.dispose(); }
});

test('THE MEASURED ZERO SURVIVES: a session that was read and held nothing still says so', () => {
  const b = box([say('user', 'nothing interesting at all', 1)]);
  try {
    b.scan();
    const body = b.ask();
    assert.equal(
      body.unscanned, null,
      'this is the answer the whole screen is built around — the file was read, every shape was '
      + 'applied, and none matched. Turning it into a refusal would be the opposite defect.',
    );
    assert.equal(body.total, 0);
    assert.equal(body.records, 1, 'the file WAS read — that is what makes the zero measured');
  } finally { b.dispose(); }
});

/**
 * **The screen half of the "one line each side" report 3 sized.**
 *
 * `screens/conversations.js` is a browser ES module that imports the DOM at
 * load and has no unit harness in this tree (unlike `screens/library.js`,
 * which `test/ui/library-screen.test.ts` drives through `browserModule`). Its
 * behaviour is otherwise pinned by Playwright, which this lane may not run. So
 * the branch is read as TEXT, the way `test/ui/conversation-follow-cadence
 * .test.ts` reads `TIP_MS` from the same file for the same reason: if the
 * branch is ever reshaped, this fails LOUDLY rather than quietly matching
 * nothing.
 *
 * WHAT FAILS THIS TEST, which is the useful question: deleting the `unscanned`
 * branch, or moving it below the paragraph it exists to prevent. Either one
 * puts the screen back to drawing "that is a measured zero and NOT a promise"
 * over a session it never opened.
 */
test('the screen draws the reason BEFORE the measured-zero paragraph it replaces', () => {
  const source = readFileSync(
    path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public', 'screens', 'conversations.js'),
    'utf8',
  );
  const branch = source.indexOf("typeof body.unscanned === 'string'");
  assert.ok(
    branch !== -1,
    'screens/conversations.js no longer branches on `body.unscanned` — the read model discloses '
    + 'that nothing was read and the screen is back to drawing a clean session over it (M6)',
  );
  const measuredZero = source.indexOf('A MEASURED ZERO, AND NOT A PROMISE');
  assert.ok(measuredZero !== -1, 'the paragraph this branch guards has moved or been renamed');
  assert.ok(
    branch < measuredZero,
    'the disclosure must be reached FIRST: below it, the reader has already been told the '
    + 'session is clean by the time anything says it was never opened',
  );
});
