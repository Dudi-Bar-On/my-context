import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { readGitInfo } from '../../src/ui/git-info.ts';

const HASH = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);

function repo(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-git-'));
}

/** A normal repository: .git is a directory, the ref is loose. */
function normalRepo(root: string, opts: { upstreamHash?: string | null } = {}): void {
  const git = path.join(root, '.git');
  mkdirSync(path.join(git, 'refs', 'heads'), { recursive: true });
  writeFileSync(path.join(git, 'HEAD'), 'ref: refs/heads/main\n');
  writeFileSync(path.join(git, 'refs', 'heads', 'main'), `${HASH}\n`);
  if (opts.upstreamHash !== undefined && opts.upstreamHash !== null) {
    mkdirSync(path.join(git, 'refs', 'remotes', 'origin'), { recursive: true });
    writeFileSync(path.join(git, 'refs', 'remotes', 'origin', 'main'), `${opts.upstreamHash}\n`);
  }
}

test('a repository with a loose ref and a matching upstream: in-sync', () => {
  const root = repo();
  try {
    normalRepo(root, { upstreamHash: HASH });
    assert.deepEqual(readGitInfo(root), {
      branch: 'main', commit: HASH, upstream: 'in-sync', detached: false,
    });
  } finally { removeTree(root); }
});

test('an upstream at a different commit: differs', () => {
  const root = repo();
  try {
    normalRepo(root, { upstreamHash: OTHER });
    assert.equal(readGitInfo(root)?.upstream, 'differs');
  } finally { removeTree(root); }
});

test('no remote ref at all: no-upstream', () => {
  const root = repo();
  try {
    normalRepo(root);
    assert.equal(readGitInfo(root)?.upstream, 'no-upstream');
  } finally { removeTree(root); }
});

test('a packed ref resolves when the loose file is absent, for both branch and upstream', () => {
  const root = repo();
  try {
    const git = path.join(root, '.git');
    mkdirSync(git, { recursive: true });
    writeFileSync(path.join(git, 'HEAD'), 'ref: refs/heads/main\n');
    writeFileSync(path.join(git, 'packed-refs'),
      '# pack-refs with: peeled fully-peeled sorted \n' +
      `${HASH} refs/heads/main\n` +
      `${HASH} refs/remotes/origin/main\n`);
    assert.deepEqual(readGitInfo(root), {
      branch: 'main', commit: HASH, upstream: 'in-sync', detached: false,
    });
  } finally { removeTree(root); }
});

test('a WORKTREE: .git is a FILE containing gitdir, refs live in the commondir', () => {
  const root = repo();
  try {
    // Layout: <root>/main-repo/.git (real), <root>/wt (worktree checkout).
    const mainGit = path.join(root, 'main-repo', '.git');
    const wtGitDir = path.join(mainGit, 'worktrees', 'wt');
    mkdirSync(path.join(mainGit, 'refs', 'heads'), { recursive: true });
    mkdirSync(wtGitDir, { recursive: true });
    writeFileSync(path.join(mainGit, 'HEAD'), 'ref: refs/heads/main\n');
    writeFileSync(path.join(mainGit, 'refs', 'heads', 'main'), `${OTHER}\n`);
    writeFileSync(path.join(mainGit, 'refs', 'heads', 'feature'), `${HASH}\n`);
    writeFileSync(path.join(wtGitDir, 'HEAD'), 'ref: refs/heads/feature\n');
    writeFileSync(path.join(wtGitDir, 'commondir'), '../..\n');

    const wt = path.join(root, 'wt');
    mkdirSync(wt, { recursive: true });
    writeFileSync(path.join(wt, '.git'), `gitdir: ${wtGitDir}\n`);

    assert.deepEqual(readGitInfo(wt), {
      branch: 'feature', commit: HASH, upstream: 'no-upstream', detached: false,
    });
  } finally { removeTree(root); }
});

test('a detached HEAD: branch null, the hash is the commit', () => {
  const root = repo();
  try {
    const git = path.join(root, '.git');
    mkdirSync(git, { recursive: true });
    writeFileSync(path.join(git, 'HEAD'), `${HASH}\n`);
    assert.deepEqual(readGitInfo(root), {
      branch: null, commit: HASH, upstream: 'no-upstream', detached: true,
    });
  } finally { removeTree(root); }
});

test('not a git repository: null, never a throw', () => {
  const root = repo();
  try {
    assert.equal(readGitInfo(root), null);
  } finally { removeTree(root); }
});

/*
 * The six below are not in the plan's list of seven. Each pins a branch of the
 * implementation those seven leave unexercised, and each was proved red
 * against a mutant of exactly that branch.
 */

test('a RELATIVE gitdir in the .git file resolves against the checkout root', () => {
  // `git worktree add --relative-paths` (git 2.48+) and every submodule write a
  // relative `gitdir:`. `path.resolve(repoRoot, …)` is what makes that work and
  // `path.resolve(…)` alone is what quietly breaks it, so the difference is
  // pinned by a test rather than asserted by a comment.
  const root = repo();
  try {
    const mainGit = path.join(root, 'main-repo', '.git');
    const wtGitDir = path.join(mainGit, 'worktrees', 'wt');
    mkdirSync(path.join(mainGit, 'refs', 'heads'), { recursive: true });
    mkdirSync(wtGitDir, { recursive: true });
    writeFileSync(path.join(mainGit, 'refs', 'heads', 'feature'), `${HASH}\n`);
    writeFileSync(path.join(wtGitDir, 'HEAD'), 'ref: refs/heads/feature\n');
    writeFileSync(path.join(wtGitDir, 'commondir'), '../..\n');

    const wt = path.join(root, 'wt');
    mkdirSync(wt, { recursive: true });
    writeFileSync(path.join(wt, '.git'), 'gitdir: ../main-repo/.git/worktrees/wt\n');

    assert.deepEqual(readGitInfo(wt), {
      branch: 'feature', commit: HASH, upstream: 'no-upstream', detached: false,
    });
  } finally { removeTree(root); }
});

test('a branch whose name contains a slash resolves through the nested ref path', () => {
  // The shape this repository is actually developed in: `v2/ui1-t4` is a
  // directory and a file under refs/heads, not one filename with a slash in it.
  const root = repo();
  try {
    const git = path.join(root, '.git');
    mkdirSync(path.join(git, 'refs', 'heads', 'v2'), { recursive: true });
    mkdirSync(path.join(git, 'refs', 'remotes', 'origin', 'v2'), { recursive: true });
    writeFileSync(path.join(git, 'HEAD'), 'ref: refs/heads/v2/ui1-t4\n');
    writeFileSync(path.join(git, 'refs', 'heads', 'v2', 'ui1-t4'), `${HASH}\n`);
    writeFileSync(path.join(git, 'refs', 'remotes', 'origin', 'v2', 'ui1-t4'), `${OTHER}\n`);
    assert.deepEqual(readGitInfo(root), {
      branch: 'v2/ui1-t4', commit: HASH, upstream: 'differs', detached: false,
    });
  } finally { removeTree(root); }
});

test('a .git file that is not a gitdir pointer: null, never a throw', () => {
  const root = repo();
  try {
    writeFileSync(path.join(root, '.git'), 'this is not a git link\n');
    assert.equal(readGitInfo(root), null);
  } finally { removeTree(root); }
});

test('a .git file pointing at a gitdir that is gone: null, never a half-filled GitInfo', () => {
  // The stale-worktree shape, which this repository can produce for itself:
  // remove a linked worktree's directory under `.git/worktrees/` and the
  // checkout's `.git` file still points at it. The pointer resolves, HEAD does
  // not — and the answer has to be "not a repository I can read", not a GitInfo
  // whose every field is empty, which the strip would render as a real state.
  const root = repo();
  try {
    writeFileSync(path.join(root, '.git'), `gitdir: ${path.join(root, 'gone', 'worktrees', 'wt')}\n`);
    assert.equal(readGitInfo(root), null);
  } finally { removeTree(root); }
});

test('a loose ref that is not a hash gives commit null, not its own contents', () => {
  // A loose ref may itself be symbolic (`ref: refs/heads/other`). This reader
  // does not follow one, and the branch of it that matters is that it reports
  // NOTHING rather than reporting the file's text as a commit — otherwise the
  // hash guard is decoration and the strip renders `@ ref: refs/hea…`.
  const root = repo();
  try {
    const git = path.join(root, '.git');
    mkdirSync(path.join(git, 'refs', 'heads'), { recursive: true });
    writeFileSync(path.join(git, 'HEAD'), 'ref: refs/heads/main\n');
    writeFileSync(path.join(git, 'refs', 'heads', 'main'), 'ref: refs/heads/other\n');
    assert.deepEqual(readGitInfo(root), {
      branch: 'main', commit: null, upstream: 'no-upstream', detached: false,
    });
  } finally { removeTree(root); }
});

test('a HEAD that is neither a branch ref nor a hash never reports a commit', () => {
  // Only the commit is asserted, and deliberately: the same hash guard on the
  // detached path is what stops junk reaching the strip. Whether such a HEAD
  // should be REPORTED as detached is an open question for the owner, so this
  // test does not pin an answer to it.
  const root = repo();
  try {
    const git = path.join(root, '.git');
    mkdirSync(git, { recursive: true });
    writeFileSync(path.join(git, 'HEAD'), 'not-a-hash\n');
    assert.equal(readGitInfo(root)?.commit, null);
  } finally { removeTree(root); }
});

/*
 * Owner rulings B2 and B3. The open question the test above declines to answer
 * is answered below (B3); B2 keeps `origin` and pins the cost of keeping it.
 */

test('a HEAD that is neither a branch ref nor a hash is unknown, and claims no detachment', () => {
  // B3. Every one of these used to answer `detached: true, commit: null` — a
  // user-visible claim about the repository ("detached HEAD") made where the
  // reader had established nothing except that HEAD said something it does not
  // understand. What it does know is that the local tip could not be read, and
  // `upstream: 'unknown'` (strip.unknownTip) is the existing state for exactly
  // that, so the answer is that and nothing more.
  for (const head of ['not-a-hash\n', 'ref: refs/tags/v1.0.2\n', '', `${'a'.repeat(20)}\n`]) {
    const root = repo();
    try {
      const git = path.join(root, '.git');
      mkdirSync(git, { recursive: true });
      writeFileSync(path.join(git, 'HEAD'), head);
      assert.deepEqual(readGitInfo(root), {
        branch: null, commit: null, upstream: 'unknown', detached: false,
      }, `HEAD = ${JSON.stringify(head)}`);
    } finally { removeTree(root); }
  }
});

test('the comparison target is ALWAYS origin/<branch>, even when the branch tracks another remote', () => {
  // B2, as behaviour rather than as a comment. This repository's reader cannot
  // see `branch.main.remote = fork` — that is `.git/config`, INI, rejected —
  // so a branch whose tip MATCHES its real upstream (fork/main) is reported as
  // `differs`, because an unrelated origin/main happened to exist and was
  // compared instead. The verdict carries nothing to mark it as a guess.
  //
  // This test asserts the wrong answer on purpose. It is the disclosure with
  // teeth: whoever changes the remote-resolution rule will land here, and
  // whoever reads it learns the limitation from the suite as well as from
  // `GitInfo.upstream`. `.git/config` is written into the fixture for the same
  // reason — to show what the reader is walking past.
  const root = repo();
  try {
    const git = path.join(root, '.git');
    mkdirSync(path.join(git, 'refs', 'heads'), { recursive: true });
    mkdirSync(path.join(git, 'refs', 'remotes', 'origin'), { recursive: true });
    mkdirSync(path.join(git, 'refs', 'remotes', 'fork'), { recursive: true });
    writeFileSync(path.join(git, 'HEAD'), 'ref: refs/heads/main\n');
    writeFileSync(path.join(git, 'refs', 'heads', 'main'), `${HASH}\n`);
    writeFileSync(path.join(git, 'refs', 'remotes', 'fork', 'main'), `${HASH}\n`);
    writeFileSync(path.join(git, 'refs', 'remotes', 'origin', 'main'), `${OTHER}\n`);
    writeFileSync(path.join(git, 'config'),
      '[branch "main"]\n\tremote = fork\n\tmerge = refs/heads/main\n');
    assert.deepEqual(readGitInfo(root), {
      branch: 'main', commit: HASH, upstream: 'differs', detached: false,
    });
  } finally { removeTree(root); }
});
