// @basis TASK-reconstruct-a-subject-from-a-passage-you-copied-without-the,
// REQ-every-anchor-capability-is-reachable-from-the-screen-and-a,
// INV-nothing-is-dropped-silently
/**
 * **THE TEST THAT HOLDS THE SECOND NO-WRITES EXCEPTION** — owner ruling
 * 2026-09-12, *"Yes — screen stages it"*.
 *
 * `test/ui/no-writes.test.ts` names two more write bindings under `src/ui/` as
 * ruled in — `stageRetrievalReturn` and `approveStagedRestore`, both in
 * `src/ui/retrieval-write.ts`. That is the STATIC half: it proves which symbols
 * the directory binds and can say nothing at all about what a route DOES.
 *
 * This is the half that bounds the exception, and it is deliberately the same
 * shape `test/ui/anchor-write-route.test.ts` already wears — one exception, one
 * way of holding it, because the owner took the building lane's recommendation
 * to reuse the anchors' narrow exception rather than invent a second.
 *
 * ── THE FOUR CLAIMS, AND EACH IS ASSERTED RATHER THAN PROMISED ────────────
 *
 *   1. **STAGING IS NOT DELIVERY.** `approvedRestore` is the question
 *      `core/inject.ts` asks at every session start and is the ONLY route any
 *      payload has into a context window. After the stage route it must still
 *      answer nothing — and after the APPROVE route it must answer this record,
 *      or assertion one would pass on a build that staged nothing at all.
 *   2. **WHAT MOVES IS `.staging/restore/`.** Every byte of the corpus outside
 *      that directory is hashed before and after a whole stage/confirm/approve
 *      round trip, and the retrieval result the return was built from is INSIDE
 *      that snapshot: a route that rewrote what it read would go red here by
 *      name. So would one that touched a corpus item or `config.json`.
 *   3. **THE APPROVAL IS AUTHORISED BY A CONFIRM NOBODY ELSE CAN MINT.** No
 *      nonce, a made-up nonce, a spent nonce, a nonce minted for another key,
 *      and a record whose bytes changed after the confirm — five refusals, and
 *      after every one of them the record on disk is still `proposed`.
 *   4. **WHAT IS STAGED IS WHAT WAS SHOWN.** The preview route and the stage
 *      route are handed the same `{ id, claims }` and the payload that lands on
 *      disk is byte-identical to the text the reader read.
 *
 * ── AND THE OTHER DIRECTION, WHICH A SNAPSHOT ALONE WOULD MISS ────────────
 *
 * A route that wrote NOTHING would also leave the corpus identical outside
 * `.staging/`. So each write is also asserted to have happened, read back
 * through `core/restore-staging.ts` — the reader `core/inject.ts` itself uses,
 * which is the surface the ruling was given against.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { TOKEN_HEADER } from '../../src/ui/security.ts';
import type { RunningUiServer } from '../../src/ui/server.ts';
import { startSafeUiServer } from '../helpers/safe-ui-server.ts';
// Pins the session store out of the real `~/.my-context`; see the module.
import '../helpers/pin-sessions-dir.ts';
import { projectDirName } from '../../src/core/conversation-index.ts';
import {
  approvedRestore, loadStagedRestore, restoreStagingFile,
} from '../../src/core/restore-staging.ts';

const SESSION = 'sess-ui-recall';
const RESULT_ID = 'recall-0001';

/**
 * A planted result with three claims and no corpus id in any of them.
 *
 * Deliberately id-free: the marking's reversed/unknown sections are
 * `test/core/retrieval-return.test.ts`' and `e2e/retrieval.spec.ts`' subject,
 * and this file is about what the ROUTES touch. A claim naming an item would
 * make the payload depend on a corpus these assertions also hash.
 */
const RESULT = [
  `# Retrieval result — ${RESULT_ID}`,
  '',
  '**Written** 2026-09-11T08:00:00.000Z · **mode** `list-subjects`',
  '',
  '## What it found',
  '',
  '- The anchors table is keyed by session and byte offset. [file src/core/anchors.ts:12]',
  '- The search index is FTS5 over prose. [commit a50fc84]',
  `- The archive holds this fixture session. [turn ${SESSION}@0]`,
  '',
].join('\n');

const TURNS = [
  {
    type: 'user',
    message: { role: 'user', content: 'the anchors table is keyed by session and byte offset' },
    timestamp: '2026-09-10T09:00:00.000Z',
  },
  {
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text: 'שלום, כאן אין מזהה פריט' }] },
    timestamp: '2026-09-10T09:00:01.000Z',
  },
];

interface Harness {
  cwd: string;
  home: string;
  root: string;
  server: RunningUiServer;
  token: string;
}

async function tokenFor(server: RunningUiServer): Promise<string> {
  const nonce = new URL(server.urlWithNonce(10_000)).hash.slice(1);
  const response = await fetch(`http://127.0.0.1:${server.port}/api/handoff`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nonce }),
  });
  assert.equal(response.status, 200);
  return ((await response.json()) as { token: string }).token;
}

async function withServer(body: (h: Harness) => Promise<void>): Promise<void> {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-recallui-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-recallui-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, `${SESSION}.jsonl`),
    TURNS.map((r) => JSON.stringify(r)).join('\n') + '\n',
  );
  const previousHome = process.env['CLAUDE_CONFIG_DIR'];
  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0);
    runCli(['conversation', 'rebuild'], cwd, () => {});
    // One item, so the corpus this test hashes is not empty and the ruling
    // lookup the marking performs has a store to open.
    assert.equal(runCli([
      'add', 'invariant', 'Nothing is dropped silently',
      '--body', 'Every omission is disclosed where it happened.',
      '--summary', 'Anything left out is said out loud.', '--yes',
    ], cwd, () => {}), 0);
  } finally {
    process.chdir(previous);
  }
  mkdirSync(path.join(cwd, '.my_context', '.retrieval'), { recursive: true });
  writeFileSync(
    path.join(cwd, '.my_context', '.retrieval', `${RESULT_ID}.result.md`), RESULT, 'utf8',
  );

  const server = await startSafeUiServer({ cwd, idleMs: 60_000 });
  try {
    await body({
      cwd, home, root: path.join(cwd, '.my_context'), server, token: await tokenFor(server),
    });
  } finally {
    await server.close();
    if (previousHome === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
    else process.env['CLAUDE_CONFIG_DIR'] = previousHome;
    removeTree(cwd);
    removeTree(home);
  }
}

const post = (h: Harness, route: string, body: unknown): Promise<Response> =>
  fetch(`http://127.0.0.1:${h.server.port}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', [TOKEN_HEADER]: h.token },
    body: JSON.stringify(body),
  });

const get = (h: Harness, route: string): Promise<Response> =>
  fetch(`http://127.0.0.1:${h.server.port}${route}`, { headers: { [TOKEN_HEADER]: h.token } });

/** Stage the whole result, and answer the key it landed under. */
async function stage(h: Harness): Promise<{ key: string; payloadBytes: number; file: string }> {
  const answer = await post(h, '/api/retrieval/stage', { id: RESULT_ID, claims: [1, 2, 3] });
  assert.equal(answer.status, 200);
  const body = (await answer.json()) as {
    key: string; verified: boolean; reason: string | null; payloadBytes: number; file: string;
  };
  assert.ok(body.verified, `the stage must be verifiable on disk: ${body.reason ?? ''}`);
  return { key: body.key, payloadBytes: body.payloadBytes, file: body.file };
}

/** Open the confirm and take the nonce it mints. */
async function confirm(h: Harness, key: string): Promise<string> {
  const answer = await get(h, `/api/retrieval/approve/confirm?key=${encodeURIComponent(key)}`);
  assert.equal(answer.status, 200);
  return ((await answer.json()) as { nonce: string }).nonce;
}

/**
 * **What a retrieval write is ALLOWED to move**, named rather than a directory
 * being skipped.
 *
 * `.staging/restore/` is where D34's carrier puts a proposal, and it is
 * gitignored for the reason every staging directory here is. The `.index.db`
 * sidecars exist the moment a read-only handle opens the database
 * (`core/store.ts` records that measurement) and are named for that reason and
 * no other. Naming four things is what makes the assertion below say something:
 * a test that excluded `.my_context/` would pass over a route that rewrote
 * every item in the corpus.
 */
const mayMove = (name: string): boolean =>
  name === '.index.db-wal' || name === '.index.db-shm'
  || name === '.staging/restore' || name.startsWith('.staging/restore/');

function snapshot(root: string): Record<string, string> {
  const skip = mayMove;
  const out: Record<string, string> = {};
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir).sort()) {
      const full = path.join(dir, entry);
      const name = prefix === '' ? entry : `${prefix}/${entry}`;
      if (statSync(full).isDirectory()) {
        if (!skip(name)) walk(full, name);
        continue;
      }
      if (skip(name)) continue;
      out[name] = createHash('sha256').update(readFileSync(full)).digest('hex');
    }
  };
  walk(root, '');
  return out;
}

test('a whole stage/approve round trip moves .staging/restore and nothing else', async () => {
  await withServer(async (h) => {
    const before = snapshot(h.root);
    assert.ok(Object.keys(before).length > 0,
      'the fixture corpus is empty — this assertion would be measuring nothing');
    assert.ok(Object.keys(before).some((name) => name.startsWith('.retrieval/')),
      'the retrieval result is not inside the snapshot, so nothing here would notice a route '
      + 'that rewrote the file it read');

    const staged = await stage(h);
    const nonce = await confirm(h, staged.key);
    const approved = await post(h, '/api/retrieval/approve', { key: staged.key, nonce });
    assert.equal(approved.status, 200);
    assert.equal(((await approved.json()) as { safeToClear: boolean }).safeToClear, true);

    assert.deepEqual(snapshot(h.root), before,
      'a retrieval write changed something outside .staging/restore/. The whole of the exception '
      + 'test/ui/no-writes.test.ts grants src/ui/retrieval-write.ts is that staging a return puts '
      + 'ONE json file into a gitignored staging directory — never a corpus item, never the '
      + 'result it was built from, never config.json. If that has stopped being true the ruled '
      + 'write needs re-deciding, not this assertion loosening.');
  });
});

test('the session transcript is never touched by either route', async () => {
  await withServer(async (h) => {
    const file = path.join(h.home, 'projects', projectDirName(h.cwd), `${SESSION}.jsonl`);
    const was = createHash('sha256').update(readFileSync(file)).digest('hex');
    const wasSize = statSync(file).size;

    const staged = await stage(h);
    const nonce = await confirm(h, staged.key);
    assert.equal((await post(h, '/api/retrieval/approve', { key: staged.key, nonce })).status, 200);

    // Both the bytes and the size, because a rewrite that happened to be the
    // same length is the one a hash of a truncated read would miss.
    assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), was,
      'a retrieval route changed a session transcript');
    assert.equal(statSync(file).size, wasSize, 'the transcript changed length');
  });
});

test('staging leaves a PROPOSAL, and the injection still sees nothing', async () => {
  await withServer(async (h) => {
    assert.equal(approvedRestore(h.root).record, null, 'the fixture must start empty');

    const staged = await stage(h);
    const record = loadStagedRestore(h.root, staged.key);
    assert.ok(record !== null, 'the stage route wrote no record at all');
    assert.equal(record?.state, 'proposed', 'the route staged an APPROVAL, not a proposal');
    assert.equal(record?.approvedAt, null);
    assert.equal(record?.approvedBy, null);
    assert.ok(statSync(restoreStagingFile(h.root, staged.key)).size > 0);

    // **The assertion that matters.** `approvedRestore` is the question
    // `core/inject.ts` asks at a session start, and it is the only route a
    // staged payload has into a window. It must still answer nothing.
    assert.equal(approvedRestore(h.root).record, null,
      'a return staged FROM THE BROWSER was visible to the injection. Staging is not delivery: '
      + 'the release is his act and so is the clear.');
  });
});

test('approving from the browser is what makes it deliverable, and it is stamped human', async () => {
  await withServer(async (h) => {
    const staged = await stage(h);
    const nonce = await confirm(h, staged.key);
    const answer = await post(h, '/api/retrieval/approve', { key: staged.key, nonce });
    assert.equal(answer.status, 200);
    const body = (await answer.json()) as { safeToClear: boolean; reason: string | null };
    assert.equal(body.safeToClear, true, `the approval refused: ${body.reason ?? ''}`);

    // The OTHER direction of the assertion above: without this, a build that
    // staged nothing at all would pass "the injection still sees nothing".
    const seen = approvedRestore(h.root).record;
    assert.equal(seen?.key, staged.key,
      'the approved record is not the one the click approved, so nothing proves the approval '
      + 'reached the question the injection asks');
    assert.equal(seen?.state, 'approved');
    // **`'human'` is the ROUTE's, not the caller's** — the owner accepted that
    // a click in his own browser counts as the actor `approveStagedRestore`
    // insists on, and this is where that lands on disk.
    assert.equal(seen?.approvedBy, 'human',
      'the approval was not stamped human, so the actor came from somewhere other than the '
      + 'literal at the one call site');
  });
});

test('no confirm, no approval — and the record is untouched after every refusal', async () => {
  await withServer(async (h) => {
    const staged = await stage(h);

    const bare = await post(h, '/api/retrieval/approve', { key: staged.key });
    assert.equal(bare.status, 403, 'an approval with no nonce was not refused');

    const invented = await post(h, '/api/retrieval/approve',
      { key: staged.key, nonce: 'f'.repeat(32) });
    assert.equal(invented.status, 403, 'an approval with an invented nonce was not refused');

    assert.equal(loadStagedRestore(h.root, staged.key)?.state, 'proposed',
      'a refused approval changed the record anyway');
    assert.equal(approvedRestore(h.root).record, null,
      'a refused approval was still visible to the injection');
  });
});

test('a confirmation is single use, and a second press is refused', async () => {
  await withServer(async (h) => {
    const staged = await stage(h);
    const nonce = await confirm(h, staged.key);
    assert.equal((await post(h, '/api/retrieval/approve', { key: staged.key, nonce })).status, 200);

    const again = await post(h, '/api/retrieval/approve', { key: staged.key, nonce });
    assert.equal(again.status, 403,
      'the same confirmation approved twice. A nonce is spent on ATTEMPT, so a replayed click '
      + 'must be refused rather than re-approving a record.');
  });
});

/**
 * **The twin is byte-identical on purpose, and that is the whole assertion.**
 *
 * A second stage of a DIFFERENT claim set would be told apart by the digest
 * alone, so this test would stay green over a binding that had dropped the key
 * — measured, 2026-09-12, by removing `key` from `mint`/`redeem` and watching
 * it pass. The twin is therefore the same record under another key: the ONLY
 * thing that can refuse it is the key in the binding.
 */
test('a confirmation minted for one staged return does not approve another', async () => {
  await withServer(async (h) => {
    const first = await stage(h);
    const other = `${first.key}-twin`;
    writeFileSync(
      restoreStagingFile(h.root, other),
      readFileSync(restoreStagingFile(h.root, first.key), 'utf8')
        .replace(`"key": "${first.key}"`, `"key": "${other}"`),
      'utf8',
    );
    const twin = loadStagedRestore(h.root, other);
    assert.ok(twin !== null, 'the twin record did not load — nothing here is being told apart');
    assert.equal(twin?.payload, loadStagedRestore(h.root, first.key)?.payload,
      'the twin is not byte-identical, so the digest alone would refuse it and this assertion '
      + 'would not be about the key at all');

    const nonce = await confirm(h, first.key);
    const crossed = await post(h, '/api/retrieval/approve', { key: other, nonce });
    assert.equal(crossed.status, 403,
      'a confirmation rendered for one record approved a different one holding the same bytes. '
      + 'The nonce is bound to the KEY as well as to what was shown, or reading one confirm '
      + 'authorises every staged return that looks like it.');
    assert.equal(loadStagedRestore(h.root, other)?.state, 'proposed');
  });
});

test('a staged return that changed after the confirm cannot be approved as the one he read', async () => {
  await withServer(async (h) => {
    const staged = await stage(h);
    const nonce = await confirm(h, staged.key);

    // The record is rewritten underneath the open confirm — the shape a second
    // stage under the same key, or an edit, would produce. What he read is no
    // longer what is there.
    const file = restoreStagingFile(h.root, staged.key);
    const record = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    record['payload'] = 'something else entirely';
    writeFileSync(file, JSON.stringify(record, null, 2), 'utf8');

    const answer = await post(h, '/api/retrieval/approve', { key: staged.key, nonce });
    assert.equal(answer.status, 403,
      'a record that changed between the confirm and the click was approved anyway. The nonce '
      + 'binds the bytes, recomputed from DISK at both ends, so "approve" cannot come to mean a '
      + 'payload nobody read.');
    assert.equal(approvedRestore(h.root).record, null);
  });
});

test('what is staged is the text the preview showed, byte for byte', async () => {
  await withServer(async (h) => {
    const shown = await post(h, '/api/retrieval/return', { id: RESULT_ID, claims: [1, 3] });
    assert.equal(shown.status, 200);
    const preview = (await shown.json()) as { text: string; reviewForm: string };

    const answer = await post(h, '/api/retrieval/stage', { id: RESULT_ID, claims: [1, 3] });
    assert.equal(answer.status, 200);
    const key = ((await answer.json()) as { key: string }).key;

    // **The stamp is the one thing that legitimately differs**, because the two
    // requests happened milliseconds apart and `markReturn` dates what it marks
    // — that is the §10 requirement working, not a divergence. It is normalised
    // rather than the comparison being weakened to a substring: every other
    // byte, the heading, the portion sentence and every claim line included,
    // has to be identical.
    const undated = (text: string): string =>
      text.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '<stamp>');
    const record = loadStagedRestore(h.root, key);
    assert.equal(undated(record?.payload ?? ''), undated(preview.text),
      'the bytes staged for a fresh window are not the bytes the reader read. One marking, or '
      + 'the screen is showing him one thing and sending another.');
    // And the claim he left behind is still left behind on disk — the portion
    // is not re-derived on the staging side.
    assert.ok(record !== null && !record.payload.includes('FTS5'),
      'a claim the reader unticked came back in the staged payload');
  });
});

test('an id that names no result creates nothing and says so', async () => {
  await withServer(async (h) => {
    const answer = await post(h, '/api/retrieval/stage',
      { id: 'no-such-result-was-ever-written', claims: [1] });
    assert.equal(answer.status, 404,
      'staging an id nothing holds did not answer 404 — the case that most tempts a write into '
      + 'creating what it cannot find');
    assert.equal(approvedRestore(h.root).record, null);
    assert.equal(existsSync(path.join(h.root, '.staging', 'restore')), false,
      'a refused stage created the staging directory anyway — a read that builds what it cannot '
      + 'find is this server’s one rule broken');
  });
});

test('a confirm for a key nothing holds mints nothing and answers 404', async () => {
  await withServer(async (h) => {
    const answer = await get(h, '/api/retrieval/approve/confirm?key=restore-never-staged');
    assert.equal(answer.status, 404);
    const body = (await answer.json()) as Record<string, unknown>;
    assert.equal(body['nonce'], undefined,
      'a confirm that could not be shown minted an authority anyway — a live nonce behind a '
      + 'refusal is the one artefact that could make the refusal untrue');
  });
});
