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
import { after } from 'node:test';
import { removeTree } from '../helpers/tmp.ts';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  missionText, writeMission, type MissionRequest,
} from '../../src/core/retrieval/mission.ts';
import { resultContract } from '../../src/core/retrieval/result.ts';

/** Every temporary root this file makes, removed when it is done. */
const madeDirs: string[] = [];
after(() => { for (const dir of madeDirs) removeTree(dir); });

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
  // Removed when the file is done: this left one directory in `%TEMP%` per
  // run, and 214 of them had accumulated across this lane's runs before
  // anybody counted. A leak nobody is told about is how 9.59 GB of them were
  // cleaned off this machine the day before.
  const dir = mkdtempSync(path.join(tmpdir(), 'mycontext-mission-'));
  madeDirs.push(dir);
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

/* ── Task 12: ROUNDS COMPOSE ─────────────────────────────────────────────── */

/**
 * **A first round returns a subject LIST; a second goes into one of them** —
 * Task 12 step 1, and §4's *"Rounds compose. A first round may return a list of
 * subjects; the owner picks one; a second round extracts what he actually
 * wants from it."*
 *
 * The two rounds are asserted to be DIFFERENT INSTRUCTIONS rather than the
 * same mission with a subject appended, because the failure this guards is a
 * second round that lists subjects again — which reads as working, returns a
 * file, and answers nothing he asked.
 */
test('a first round asks for a list of subjects and names no subject of its own', () => {
  const text = missionText(request({ mode: 'list-subjects', round: undefined }));
  assert.match(text, /^## What to return$/m, 'a round must say what shape its answer takes');
  const section = sectionOf(text, 'What to return');
  assert.match(section, /list of SUBJECTS/, 'round 1 of list-subjects must ask for the list');
  assert.ok(
    !/^## Round 2/m.test(text),
    'a first round announced itself as a second one',
  );
});

test('a second round names the subject he chose and the result it came out of', () => {
  const text = missionText(request({
    mode: 'list-subjects',
    round: { n: 2, subject: 'the anchors table', from: '.my_context/.retrieval/r1.result.md' },
  }));
  const section = sectionOf(text, 'Round 2 — the subject he chose');
  // **On the two BULLET LINES, not on the section.** A removal proof caught
  // the looser form: the section's opening paragraph also names the subject,
  // so deleting the `- the subject:` line left `assert.match(section, …)`
  // green. That is the commonest false-green in this repository — asserting a
  // substring some other part of the same output also carries — so both facts
  // are now asserted on the line that is supposed to carry them.
  const bullets = section.split(String.fromCharCode(10))
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith('- '));
  assert.equal(bullets.length, 2, 'round 2 states the subject and where it was listed');
  assert.match(bullets[0] ?? '', /^- the subject: `the anchors table`$/,
    'the subject line does not carry the subject');
  assert.match(bullets[1] ?? '', /^- listed in: `[^`]*r1\.result\.md`$/,
    'the provenance line does not carry the result it came out of');
  assert.match(
    sectionOf(text, 'What to return'),
    /do not list subjects again/i,
    'a second round must be told not to answer with another list',
  );
});

test('the mission tells the subagent the SHAPE the result file must take', () => {
  // The seam the item named: `MissionRequest` carried no field naming the
  // result file's shape, so a subagent was told where to write and not how.
  const text = missionText(request({ resultShape: resultContract() }));
  const section = sectionOf(text, 'Where to write it');
  assert.match(section, /^- /m, 'the contract reached the mission as nothing at all');
  assert.match(section, /\[commit /, 'the citation bracket form is not in the contract');
  assert.match(section, /## What it found/, 'the section the parser reads back is not named');

  // And a mission built without one still works — the field is optional
  // because Task 9 shipped without it and nothing may break on its absence.
  assert.ok(!/\[commit /.test(sectionOf(missionText(request()), 'Where to write it')));
});

/** One `##` section's body. The same split `sectionsOf` makes in `return.ts`. */
function sectionOf(text: string, heading: string): string {
  const lines = text.split(/\r?\n/);
  const at = lines.indexOf(`## ${heading}`);
  if (at === -1) return '';
  const rest = lines.slice(at + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}
