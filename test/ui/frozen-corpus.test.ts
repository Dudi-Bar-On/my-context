// @basis TASK-two-browser-gates-are-red-before-any-lane-touches-them-and,
// TASK-the-audit-log-still-records-two-session-ids-that-never,
// TASK-forty-six-browser-failures-are-recorded-as-unknown-so-the,
// INSTR-testing-happens-against-the-current-corpus-and-an-exception
/**
 * **THE BROWSER SUITE'S FROZEN SNAPSHOT, ASSERTED RATHER THAN DESCRIBED.**
 *
 * `e2e/frozen-corpus.ts` is what stops a browser run from measuring a corpus
 * that is being written to while it measures — the session-start hook
 * appending seen lines, the run's own `access` records, a sibling lane
 * committing items. Its whole safety argument is two sentences that are easy
 * to write and easy to be wrong about:
 *
 *   1. the corpus half is a REAL COPY, so a write inside the snapshot cannot
 *      reach the live corpus, and
 *   2. the repository half is LINKS, so disposing the snapshot removes the
 *      links and not the repository they point at.
 *
 * Get (1) wrong — drop `dereference`, or link `.my_context` too — and the
 * suite writes to the project's own records. Get (2) wrong — copy instead of
 * link, or delete through the junction — and a teardown deletes `docs/`.
 * Neither is visible from reading a green browser run, so both are measured
 * here, on a throwaway corpus, in the node suite where a failure is cheap.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  SEEDED_SESSION, disposeFrozenCorpus, freezeCorpus, recordsASession,
} from '../../e2e/frozen-corpus.ts';
import { sandbox } from '../helpers/workspace.ts';

/**
 * A throwaway repository: a real corpus made by `init`, with a `docs/` tree
 * and a top-level file beside it — the two shapes `freezeCorpus` treats
 * differently.
 */
function repository(): { cwd: string; dispose: () => void } {
  const box = sandbox();
  mkdirSync(path.join(box.cwd, 'docs'), { recursive: true });
  writeFileSync(path.join(box.cwd, 'docs', 'chapter.md'), '# a chapter\n');
  writeFileSync(path.join(box.cwd, 'package.json'), '{ "name": "throwaway" }\n');
  // A session that has already been handed everything — the state that made
  // `app-layout.spec.ts` red on the owner's machine and green on a runner.
  mkdirSync(path.join(box.cwd, '.my_context', 'state'), { recursive: true });
  writeFileSync(
    path.join(box.cwd, '.my_context', 'state', 'a-session.seen.jsonl'),
    '{"id":"RULE-x","tier":"pinned"}\n',
  );
  return { cwd: box.cwd, dispose: () => box.dispose() };
}

test('the session state is NOT carried into the snapshot, so a run starts where a clean checkout does', () => {
  const repo = repository();
  const { workspace: frozen, box } = freezeCorpus(repo.cwd);
  try {
    // `.my_context/state/**` is gitignored end to end (`state/.gitignore` is a
    // bare `*`), so a fresh clone and every CI runner have none of it. A
    // snapshot that carried this machine's 753 latch files forward would have
    // frozen "everything has already been delivered", which is a fact about
    // the hour it was taken and is exactly what `rulings/114` calls
    // unattributable.
    assert.equal(
      existsSync(path.join(frozen, '.my_context', 'state', 'a-session.seen.jsonl')), false,
      'the snapshot carried a seen file, so the delivered preview it serves is this machine\'s',
    );
    // And the corpus itself did come across, so this is an exclusion rather
    // than a copy that silently did nothing.
    assert.equal(
      existsSync(path.join(frozen, '.my_context', 'config.json')), true,
      'nothing was copied at all — the filter excluded the corpus, not the state',
    );
    // The source keeps its own, untouched.
    assert.equal(
      existsSync(path.join(repo.cwd, '.my_context', 'state', 'a-session.seen.jsonl')), true,
      'freezing the corpus removed the live session state it was supposed to leave alone',
    );
  } finally {
    disposeFrozenCorpus(box);
    repo.dispose();
  }
});

test('the corpus half of a snapshot is real bytes, so a write in it cannot reach the live corpus', () => {
  const repo = repository();
  let made: { workspace: string; box: string } | null = null;
  try {
    made = freezeCorpus(repo.cwd);
    const frozen = made.workspace;
    // **The workspace keeps the repository's NAME**, because its basename is
    // what `#hdrrepo` draws and what `fitStrip` measures the bar against — a
    // longer one can buy the status bar a whole row.
    assert.equal(
      path.basename(frozen), path.basename(repo.cwd),
      'the sandbox renamed the repository, so the provenance bar and the strip say something '
      + 'a run without a sandbox would not',
    );
    const frozenConfig = path.join(frozen, '.my_context', 'config.json');
    assert.equal(
      lstatSync(frozenConfig).isSymbolicLink(), false,
      'the snapshot\'s corpus is a link, so the suite would be writing to the live corpus',
    );
    // The write a run makes is an `access` record and a seen line; a config
    // byte stands in for both and needs no product code to produce.
    writeFileSync(frozenConfig, '{ "written": "by the snapshot" }\n');
    assert.notEqual(
      readFileSync(path.join(repo.cwd, '.my_context', 'config.json'), 'utf8'),
      '{ "written": "by the snapshot" }\n',
      'a write inside the snapshot reached the source corpus',
    );
  } finally {
    if (made !== null) disposeFrozenCorpus(made.box);
    repo.dispose();
  }
});

test('the repository half is linked, and disposing the snapshot leaves the repository alone', () => {
  const repo = repository();
  const { workspace: frozen, box } = freezeCorpus(repo.cwd);
  // Linked, not copied: the Library screen resolves `docs/` through
  // `path.dirname(projectRoot)`, and a copy of `node_modules` per run is the
  // cost this design exists to refuse.
  assert.equal(
    readFileSync(path.join(frozen, 'docs', 'chapter.md'), 'utf8'), '# a chapter\n',
    'the snapshot cannot see the repository it was taken from',
  );
  assert.equal(
    lstatSync(path.join(frozen, 'docs')).isSymbolicLink(), true,
    'docs/ was copied rather than linked — the snapshot pays for bytes it does not own',
  );
  // A top-level FILE is copied, because Windows grants an unelevated process a
  // junction to a directory and not a link to a file.
  assert.equal(
    lstatSync(path.join(frozen, 'package.json')).isSymbolicLink(), false,
    'a top-level file was linked, which does not work on Windows',
  );

  disposeFrozenCorpus(box);
  assert.equal(existsSync(frozen), false, 'the snapshot survived its own disposal');
  assert.equal(
    existsSync(path.join(repo.cwd, 'docs', 'chapter.md')), true,
    'disposing the snapshot deleted THROUGH a junction and took the repository with it',
  );
  assert.equal(
    existsSync(path.join(repo.cwd, '.my_context', 'items')), true,
    'disposing the snapshot reached the source corpus',
  );
  repo.dispose();
});

/**
 * **A CORPUS THAT HAS RECORDED NO SESSION IS SEEDED — IN THE SNAPSHOT ONLY —
 * AND ONE THAT HAS IS LEFT EXACTLY AS IT WAS.** `SEEDED_SESSION` in
 * `e2e/frozen-corpus.ts` carries why: a hosted runner's corpus has no audit
 * history since task 4.15 closed the `npm test` leak that used to be one, and
 * every session-subject browser spec then measured the cold shell.
 */
test('a corpus with no recorded session is given one delivery in the snapshot, never in the source', () => {
  const repo = repository();
  assert.equal(recordsASession(path.join(repo.cwd, '.my_context')), false,
    'the throwaway corpus already records a session, so this measures nothing');
  const made = freezeCorpus(repo.cwd);
  try {
    assert.equal(made.seeded, true, 'a corpus with no session was not seeded');
    assert.equal(recordsASession(path.join(made.workspace, '.my_context')), true,
      'the seed reported success and the snapshot records no session');
    const log = readFileSync(
      path.join(made.workspace, '.my_context', '.audit', 'audit.jsonl'), 'utf8');
    assert.match(log, new RegExp(`"sessionId":"${SEEDED_SESSION}"`),
      'the delivery is not under the declared seed id, so a reader cannot tell it from a real one');
    // History, not state: the seed leaves no seen file behind.
    assert.equal(existsSync(path.join(made.workspace, '.my_context', 'state')), false,
      'the seed left session state in the snapshot');
    // And the source corpus is untouched.
    assert.equal(recordsASession(path.join(repo.cwd, '.my_context')), false,
      'seeding the snapshot wrote a delivery into the source corpus');
  } finally {
    disposeFrozenCorpus(made.box);
    repo.dispose();
  }
});

test('a corpus that already records a session is not seeded', () => {
  const repo = repository();
  const audit = path.join(repo.cwd, '.my_context', '.audit');
  mkdirSync(audit, { recursive: true });
  const real = '{"protocol":"my_context/audit@2","kind":"injection","op":"session-start",'
    + '"hook":"SessionStart","sessionId":"a-real-session","injected":[],"tokens":0,'
    + '"at":"2026-09-28T00:00:00.000Z"}\n';
  writeFileSync(path.join(audit, 'audit.jsonl'), real);
  const made = freezeCorpus(repo.cwd);
  try {
    assert.equal(made.seeded, false, 'a corpus with a real history was seeded anyway');
    const log = readFileSync(
      path.join(made.workspace, '.my_context', '.audit', 'audit.jsonl'), 'utf8');
    assert.doesNotMatch(log, new RegExp(SEEDED_SESSION),
      'the snapshot of a corpus with a real history carries a seeded delivery');
  } finally {
    disposeFrozenCorpus(made.box);
    repo.dispose();
  }
});
