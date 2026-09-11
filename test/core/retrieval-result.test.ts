// @basis TASK-reconstruct-a-subject-from-a-passage-you-copied-without-the,
// RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number,
// INV-nothing-is-dropped-silently
/**
 * **Results are files, and they cite** — `plan:recall seq:2`, Task 10 of
 * `docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md`, and §9 of
 * `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 *   1. **The result directory is GITIGNORED, and that is the privacy
 *      boundary.** Results hold conversation text, and the owner ruled that
 *      conversation files are gitignored *"so no sensitive data would be saved
 *      in git"*. The plan's own self-review calls this the boundary that
 *      cannot be got wrong, so it is asserted against the REAL `.gitignore`
 *      twice over: the rule is in the file, and `git check-ignore` — which
 *      reads every ignore source, not only the one this test happens to know
 *      about — agrees that a file under it is ignored.
 *   2. **Every claim carries a citation**, and a claim that does not is
 *      REPORTED rather than accepted. A result resting on what somebody once
 *      said in a conversation is exactly what this subsystem exists not to
 *      produce.
 *   3. **A citation that no longer resolves makes the result SAY it has
 *      aged**, rather than being silently wrong. And the third state is kept
 *      distinct from both: a citation nothing could check is `unchecked`, and
 *      `unchecked` is not `resolved` — `INV-nothing-is-dropped-silently`.
 *   4. **A file-and-line citation into `reports/` is refused**, because a
 *      report is prepended to and every line number in it moves on the next
 *      write. That is `RULE-a-citation-names-an-item-by-id-never-a-report-by-
 *      line-number` applied where a distilling subagent would most naturally
 *      break it.
 *   5. **The directory is indexed**, so the UI can list what has been asked
 *      before — §9's *ask once, build on it many times*.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  RETRIEVAL_DIR, renderResult, writeResult, readResult, listResults,
  validateResult, checkCitations, ignoresRetrievalDir, type RetrievalResult,
} from '../../src/core/retrieval/result.ts';

const REPO = process.cwd();

function result(overrides: Partial<RetrievalResult> = {}): RetrievalResult {
  return {
    id: '2026-09-11-anchors',
    at: '2026-09-11T05:00:00.000Z',
    mode: 'from-selection',
    query: { names: ['markAnchor'], terms: [] },
    missionPath: '.my_context/.retrieval/2026-09-11-anchors.mission.md',
    claims: [
      {
        text: 'Anchors were stored as a table rather than a column on conversations.',
        citations: [
          { kind: 'turn', sessionId: 'sess-a', agentId: null, byteOffset: 918_273 },
          { kind: 'file', file: 'src/core/anchors.ts', line: 1 },
        ],
      },
      {
        text: 'The position marker is a byte offset, not a character offset.',
        citations: [{ kind: 'commit', hash: 'c7bcaa1b' }],
      },
    ],
    ...overrides,
  };
}

test('the retrieval directory is gitignored, in the real .gitignore', () => {
  const gitignore = readFileSync(path.join(REPO, '.gitignore'), 'utf8');
  assert.equal(
    ignoresRetrievalDir(gitignore), true,
    `${RETRIEVAL_DIR} is not ignored by the repository's own .gitignore, and results hold `
    + 'conversation text',
  );
});

test('git itself agrees that a result file is ignored', () => {
  const probe = `${RETRIEVAL_DIR.split(path.sep).join('/')}/probe.result.md`;
  const run = spawnSync('git', ['check-ignore', '-q', '--no-index', probe], { cwd: REPO });
  assert.equal(
    run.status, 0,
    `git check-ignore says ${probe} is NOT ignored (status ${run.status}); the rule in `
    + '.gitignore may be present and still not cover the path',
  );
});

test('a claim with no citation is reported', () => {
  const findings = validateResult(result({
    claims: [{ text: 'somebody said the archive was fine', citations: [] }],
  }));
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.kind, 'uncited');
  assert.match(findings[0]?.detail ?? '', /somebody said the archive was fine/);
});

test('a fully cited result has nothing to report', () => {
  assert.deepEqual(validateResult(result()), []);
});

test('a file-and-line citation into reports/ is reported', () => {
  const findings = validateResult(result({
    claims: [{
      text: 'the handover says the lane finished',
      citations: [{ kind: 'file', file: 'reports/V2-HANDOVER.md', line: 41 }],
    }],
  }));
  assert.deepEqual(findings.map((finding) => finding.kind), ['report-line']);
});

test('a citation that still resolves does not make the result aged', () => {
  const report = checkCitations(REPO, result({
    claims: [{
      text: 'the anchors module exists',
      citations: [{ kind: 'file', file: 'src/core/anchors.ts', line: 1 }],
    }],
  }));
  assert.equal(report.aged, false);
  assert.equal(report.resolved, 1);
  assert.equal(report.unresolved, 0);
});

test('a citation that no longer resolves makes the result say it has aged', () => {
  const report = checkCitations(REPO, result({
    claims: [{
      text: 'it was decided in a file that has since been deleted',
      citations: [{ kind: 'file', file: 'src/core/no-such-module.ts', line: 12 }],
    }],
  }));
  assert.equal(report.aged, true);
  assert.equal(report.unresolved, 1);
  assert.match(report.findings[0]?.detail ?? '', /no-such-module\.ts/);
});

test('a citation past the end of a file that still exists is aged too', () => {
  const report = checkCitations(REPO, result({
    claims: [{
      text: 'a line that has since moved',
      citations: [{ kind: 'file', file: 'src/core/anchors.ts', line: 999_999 }],
    }],
  }));
  assert.equal(report.aged, true);
});

test('a citation nothing could check is unchecked, and unchecked is not resolved', () => {
  const report = checkCitations(REPO, result({
    claims: [{
      text: 'it was said in a turn',
      citations: [{ kind: 'turn', sessionId: 'sess-a', agentId: null, byteOffset: 918_273 }],
    }],
  }));
  assert.equal(report.unchecked, 1);
  assert.equal(report.resolved, 0);
  assert.equal(report.aged, false, 'a citation nobody could check has not been shown to have aged');
});

test('a supplied resolver is what checks a turn', () => {
  const asked: number[] = [];
  const report = checkCitations(
    REPO,
    result({
      claims: [{
        text: 'it was said in a turn',
        citations: [{ kind: 'turn', sessionId: 'sess-a', agentId: null, byteOffset: 918_273 }],
      }],
    }),
    { turn: (citation) => { asked.push(citation.byteOffset); return false; } },
  );
  assert.deepEqual(asked, [918_273]);
  assert.equal(report.aged, true);
});

test('a result survives a round trip through the file it is written to', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'mycontext-result-'));
  const written = writeResult(root, result());
  const read = readResult(written.path);
  assert.equal(read.id, '2026-09-11-anchors');
  assert.equal(read.at, '2026-09-11T05:00:00.000Z');
  assert.deepEqual(read.claims.map((claim) => claim.text), result().claims.map((c) => c.text));
  assert.deepEqual(read.claims[0]?.citations, result().claims[0]?.citations);
  assert.deepEqual(read.claims[1]?.citations, result().claims[1]?.citations);
});

test('a claim written without a citation reads back as uncited, not as absent', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'mycontext-result-'));
  const written = writeResult(root, result({
    claims: [{ text: 'a bare claim with nothing behind it', citations: [] }],
  }));
  const read = readResult(written.path);
  assert.equal(read.claims.length, 1);
  assert.deepEqual(read.claims[0]?.citations, []);
  assert.equal(validateResult(read)[0]?.kind, 'uncited');
});

test('the directory is indexed so the UI can list what was asked before', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'mycontext-result-'));
  writeResult(root, result());
  writeResult(root, result({ id: '2026-09-11-drift', at: '2026-09-11T06:00:00.000Z' }));
  mkdirSync(path.join(root, RETRIEVAL_DIR), { recursive: true });
  writeFileSync(
    path.join(root, RETRIEVAL_DIR, 'scratch.mission.md'), '# not a result', 'utf8',
  );

  const listed = listResults(root);
  assert.deepEqual(listed.map((entry) => entry.id), ['2026-09-11-drift', '2026-09-11-anchors']);
  assert.equal(listed[0]?.claims, 2);
  assert.ok(
    listed.every((entry) => entry.path.endsWith('.result.md')),
    'a mission is not a result and must not be listed as one',
  );
});

test('the rendered result names the mission it came from', () => {
  assert.ok(
    renderResult(result()).includes('2026-09-11-anchors.mission.md'),
    'a result that cannot be traced to its mission cannot be re-run',
  );
});
