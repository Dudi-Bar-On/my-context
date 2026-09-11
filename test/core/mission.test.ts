// @basis TASK-reconstruct-a-subject-from-a-passage-you-copied-without-the,
// RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number,
// INV-nothing-is-dropped-silently
/**
 * **The mission** — `plan:recall seq:2`, Task 9 of
 * `docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md`, and §8 of
 * `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * Retrieval does not answer from the archive. It writes a MISSION for a
 * subagent that reads in its own fresh window. So what is under test here is a
 * document, and the four things it must contain or must not.
 *
 *   1. **It names the material** — and by POINTER, so the subagent opens the
 *      transcript itself. The lane's transcript is deliberately named
 *      `agent-9.jsonl` while the lane is `lane-7`: a fixture whose file path
 *      spelled the lane id would let the lane assertion pass on the file
 *      assertion's evidence, which is the shape of vacuity this project has
 *      shipped before.
 *   2. **It names the verification duties**, and both of them: *against the
 *      codebase AND git*. The design's own reason is that a ruling can stand
 *      in the corpus while the code that implemented it was reverted weeks
 *      ago — git knows, the corpus does not. And the assertion is on `against
 *      git`, not on `git`: this file would mention git in passing whatever it
 *      said, so the weaker assertion would pass on a mission that named no
 *      duty at all.
 *   3. **It names the citation requirement.** The distilling subagent is
 *      itself a model and can be confidently wrong; every claim pointing at a
 *      turn, a commit, or a file and line is what makes the result verifiable
 *      rather than trusted.
 *   4. **It never carries the raw material inline.** The assertion is not
 *      vacuous, and the reason it is not is the shape of `MaterialPointer`: it
 *      CAN carry the words — the caller already holds them, straight out of
 *      `removeNoise` — and the mission writer is the thing that must refuse to
 *      print them. A request type with nowhere to put text would make this
 *      assertion pass on any implementation at all.
 *
 * ── AND THE RULE THAT MAKES THE REST SAFE ──────────────────────────────────
 *
 * **Nothing enters the owner's context without him choosing it** (§10, and the
 * plan's own Global Constraints: *it is asserted, not assumed*). The UI half
 * of that is Task 11's. The half that belongs here is the one `core/retire.ts`
 * demonstrates the shape of — **a module that cannot write cannot write by
 * accident** — so `the retrieval path cannot inject on its own` reads the
 * retrieval sources and asserts they reach none of the machinery that could:
 * no import of `core/inject.ts`, nothing from `src/hooks/`, and no mention of
 * the `additionalContext` field a hook answers with. And the other direction
 * too, because an injection path that imported retrieval would be the same
 * defect wearing the other hat.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  missionText, writeMission, type MissionRequest,
} from '../../src/core/retrieval/mission.ts';

/** A marker that could only appear in the mission if the raw words were copied in. */
const SECRET = 'ZEBRAFISH-CAROUSEL-9317 the owner pasted his production token here by mistake';

/** The repository the mission tells its subagent to verify against. */
const REPO = 'D:/Users/UserC/source/repos/my-context';

function request(overrides: Partial<MissionRequest> = {}): MissionRequest {
  return {
    id: '2026-09-11-anchors',
    mode: 'from-selection',
    at: '2026-09-11T04:00:00.000Z',
    repoRoot: REPO,
    resultPath: '.my_context/.retrieval/2026-09-11-anchors.result.md',
    query: { names: ['plan:archive seq:34', 'markAnchor'], terms: ['byte offset'] },
    pointers: [
      {
        sessionId: 'sess-a', agentId: null, file: 'C:/x/main-transcript.jsonl',
        recordIndex: 412, byteOffset: 918_273, stance: 'said', tool: null,
        at: '2026-09-10T21:00:00.000Z', text: SECRET,
      },
      {
        sessionId: 'sess-a', agentId: 'lane-7', file: 'C:/x/agent-9.jsonl',
        recordIndex: 9, byteOffset: 4_096, stance: 'deed', tool: 'Read',
        at: null, text: 'a second passage, also not for the mission',
      },
    ],
    anchors: ['sess-a:-:918273'],
    documents: ['docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md'],
    scope: { sessionId: 'sess-a', from: '2026-09-01', to: '2026-09-11' },
    ...overrides,
  };
}

test('the mission names the material by pointer', () => {
  const text = missionText(request());
  // **Asserted on the material ROWS, not on the whole document**, and the
  // first draft of this test was wrong for exactly that reason: the session id
  // and the byte offset also appear in the scope line and inside the anchor
  // id, so `text.includes('sess-a')` passed with the session removed from
  // every row. A removal proof caught it; the assertion now names the row.
  const rows = text.split('\n').filter((line) => /^\| \d+ \|/.test(line));
  assert.equal(rows.length, 2, 'one row per pointer, and no more');
  assert.ok((rows[0] ?? '').includes('sess-a'), 'the session is not in the material row');
  assert.ok((rows[0] ?? '').includes('918273'), 'the byte offset is not in the material row');
  assert.ok(
    (rows[1] ?? '').includes('C:/x/agent-9.jsonl'),
    'the lane transcript is not in the material row',
  );
  assert.ok((rows[1] ?? '').includes('lane-7'), 'the lane is not in the material row');
});

test('the mission names the verification duties, and both of them', () => {
  const text = missionText(request());
  assert.ok(
    text.toLowerCase().includes('against git'),
    'git is not named as something to verify AGAINST; mentioning git is not a duty',
  );
  assert.ok(text.includes('CODEBASE'), 'the codebase is not named as a source of truth');
  assert.ok(
    text.includes(`**Repository** \`${REPO}\``),
    'the repository to verify against is not stated as a field',
  );
});

test('the mission names the citation requirement', () => {
  const text = missionText(request());
  assert.match(text, /^## Every claim must CITE$/m);
  assert.ok(text.includes('- **a turn**'), 'a turn is not named as a citable record');
  assert.ok(text.includes('- **a commit**'), 'a commit is not named as a citable record');
  assert.ok(text.includes('- **a file and line**'), 'a file and line is not named');
});

test('the mission never carries the raw material inline', () => {
  const text = missionText(request());
  assert.ok(
    !text.includes(SECRET),
    'the words at a pointer reached the mission; the whole point is that the noise '
    + 'does not enter a context window',
  );
  assert.ok(
    !text.includes('ZEBRAFISH-CAROUSEL-9317'),
    'part of the raw material reached the mission',
  );
});

test('the mission says where the result must be written', () => {
  const text = missionText(request());
  assert.ok(
    text.includes('.my_context/.retrieval/2026-09-11-anchors.result.md'),
    'a subagent that is not told where to write cannot write a file instead of answering',
  );
});

test('the mission is dated', () => {
  // On the `Written` field, not on the document: the scope line also carries a
  // date, so the looser assertion passed with the stamp removed entirely.
  assert.match(
    missionText(request()), /^\*\*Written\*\* 2026-09-11 /m,
    'an undated mission cannot age',
  );
});

test('writeMission writes exactly one file, and it is the one it reports', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mycontext-mission-'));
  const written = writeMission(request({ dir }));
  assert.equal(path.dirname(written.path), dir);
  assert.deepEqual(readdirSync(dir), [path.basename(written.path)]);
  assert.equal(readFileSync(written.path, 'utf8'), written.text);
  assert.ok(!written.text.includes(SECRET), 'the file on disk carries the raw material');
});

test('the retrieval path cannot inject on its own', () => {
  const dir = path.join(process.cwd(), 'src', 'core', 'retrieval');
  const sources = readdirSync(dir).filter((name) => name.endsWith('.ts'));
  assert.ok(sources.length >= 4, `expected the retrieval modules, found ${sources.length}`);
  for (const name of sources) {
    const source = readFileSync(path.join(dir, name), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(
      !/from '[^']*inject\.ts'/.test(code),
      `${name} imports the injection builder; retrieval may not reach it`,
    );
    assert.ok(
      !/from '[^']*hooks\//.test(code),
      `${name} imports hook machinery; a hook is the thing that writes into a window`,
    );
    assert.ok(
      !code.includes('additionalContext'),
      `${name} names additionalContext, the field a hook answers a window with`,
    );
  }
});

test('no hook reaches the retrieval path', () => {
  const dir = path.join(process.cwd(), 'src', 'hooks');
  for (const name of readdirSync(dir).filter((file) => file.endsWith('.ts'))) {
    const source = readFileSync(path.join(dir, name), 'utf8');
    assert.ok(
      !source.includes('retrieval/'),
      `src/hooks/${name} reaches into retrieval; nothing on this path may run unasked`,
    );
  }
});
