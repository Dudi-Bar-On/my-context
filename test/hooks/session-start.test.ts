import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

function sandbox(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-hook-'));
}

function pin(cwd: string, id: string, title: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: constraint
title: ${title}
status: active
severity: hard
always: true
---

# ${title}

Body text.
`);
}

/**
 * **This test asserted the defect, and that is worth saying plainly.**
 *
 * "With no workspace the hook outputs nothing" was true, was intended, and was
 * the shape of a failure that cost nine days on 2026-08-26: a session ran from
 * 08-17 to 08-26 with its working directory outside the corpus, and the corpus
 * reached the model exactly never. Its own audit records stop on 08-19 — 44 of
 * them across three days, then nothing, on the very repository the corpus
 * governs. Same session id, same plugin, same code; only the launch directory
 * changed, and no surface anywhere reported it.
 *
 * The assertion below is unchanged and still right: STDOUT stays empty, because
 * a plugin that announces itself inside every unrelated project a person opens
 * is its own defect. What was missing is the other channel, and the test beside
 * this one now pins it.
 */
test('with no workspace the hook writes nothing to STDOUT — the model is not told', () => {
  const cwd = sandbox();
  assert.equal(buildSessionStartOutput(cwd), '');
  removeTree(cwd);
});

test('with no workspace the hook says so on STDERR, and still exits 0', () => {
  const cwd = sandbox();
  const hook = fileURLToPath(new URL('../../src/hooks/session-start.ts', import.meta.url));
  const run = spawnSync(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', hook],
    { input: JSON.stringify({ session_id: 's1', source: 'startup', cwd }), encoding: 'utf8' },
  );

  assert.equal(run.status, 0,
    'INV-hooks-fail-open: a missing workspace may never fail a session start');
  assert.equal(run.stdout, '',
    'stdout stays empty — the plugin does not announce itself inside unrelated projects');
  assert.match(run.stderr, /no corpus found from/,
    'a workspace that does not resolve must be DISCLOSED. Silence here is indistinguishable '
    + 'from a corpus with nothing to say, and that ambiguity ran for nine days without one '
    + 'surface reporting it — there is no audit log to write to when there is no workspace, so '
    + 'stderr is the only channel left.');
  assert.match(run.stderr, /start Claude Code in the project directory/,
    'the line must name the fix, not merely the symptom — the reader who sees it is the only '
    + 'one who can act on it');

  removeTree(cwd);
});

test('pinned items appear in the output', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  const out = buildSessionStartOutput(cwd);
  assert.match(out, /CONST-pool/);
  assert.match(out, /Pool capped at 20/);
  removeTree(cwd);
});

test('non-pinned items appear only in the index', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  runCli(['add', 'lesson', 'Migrations need locks'], cwd, () => {});
  const out = buildSessionStartOutput(cwd);
  assert.match(out, /1 lesson/);
  assert.equal(/Migrations need locks/.test(out), false);
  removeTree(cwd);
});

test('a corrupt config yields empty output rather than throwing', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  writeFileSync(path.join(cwd, '.my_context', 'config.json'), '{ not json');
  assert.equal(buildSessionStartOutput(cwd), '');
  removeTree(cwd);
});

// The latency-ceiling test that used to live here moved to
// test/perf/session-start-latency.perf.ts: a single wall-clock sample
// compared to a hard ceiling inside node --test's default *concurrent*
// runner measured scheduler contention, not the code (~674ms against a
// 500ms ceiling under load from the other ~280 tests in this suite, passing
// comfortably run alone). The perf file replaces it with a many-iteration
// p95 run serially via `npm run test:perf`. See that file's header comment.

test('a corrupt/unreadable database yields empty output rather than throwing', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  writeFileSync(path.join(cwd, '.my_context', '.index.db'), 'not a sqlite database');
  assert.equal(buildSessionStartOutput(cwd), '');
  removeTree(cwd);
});

test('a malformed item file does not prevent output for the rest of the corpus', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  const badFile = path.join(cwd, '.my_context', 'items', 'constraint', 'broken.md');
  writeFileSync(badFile, 'not frontmatter at all, just text');
  const out = buildSessionStartOutput(cwd);
  assert.match(out, /CONST-pool/);
  removeTree(cwd);
});

/**
 * `rebuild` returns `LoadError[]` and this hook used to discard it — the
 * exact defect Task 7 fixed for the MCP surface, still present in the sibling
 * caller of the same function, on the product's highest-traffic path. A
 * broken item file simply vanished from injection with no signal anywhere.
 */
test('a malformed item file is reported in the session-start output, not swallowed', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  writeFileSync(
    path.join(cwd, '.my_context', 'items', 'constraint', 'broken.md'),
    'not frontmatter at all, just text',
  );
  const out = buildSessionStartOutput(cwd);
  assert.match(out, /could not be read during rebuild/);
  assert.match(out, /broken\.md/);
  // One concise line, not one per file: it shares the session-start budget.
  assert.equal(out.split('\n').filter((l) => /could not be read/.test(l)).length, 1);
  removeTree(cwd);
});

test('a clean corpus gets no load-error line at all', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  assert.equal(/could not be read during rebuild/.test(buildSessionStartOutput(cwd)), false);
  removeTree(cwd);
});

test('the load-error line still appears when nothing at all was selected', () => {
  // The signal must not depend on there being something to inject: an empty
  // corpus whose only item file is broken is precisely when it matters most.
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
  writeFileSync(
    path.join(cwd, '.my_context', 'items', 'constraint', 'broken.md'),
    'not frontmatter at all, just text',
  );
  assert.match(buildSessionStartOutput(cwd), /could not be read during rebuild/);
  removeTree(cwd);
});

// --- The second prune trigger -----------------------------------------------
//
// `state/` held 15 files when the v2 survey ran and 47 a day later, 45 of them
// subagent siblings for one session id, and `mycontext rebuild` was its only
// sweeper: a project whose corpus is stable never rebuilds, so it never prunes,
// while every session start adds a file.
//
// The sweep lives in the ENTRY GUARD rather than in `buildSessionStartOutput`,
// so these three tests run the binary as a real OS process — an in-process
// caller of the builder cannot reach it, and that is deliberate: the sweep
// happens after the injection has already been written to stdout, so it can
// never delay the text the model is waiting on. stderr is the channel for the
// same reason the disclosure exists at all: what went is said (
// `INV-nothing-is-dropped-silently`), but a note about routine housekeeping in
// every session's injected block is how a reader learns to skim the block.

const SESSION_START_BIN =
  fileURLToPath(new URL('../../src/hooks/session-start.ts', import.meta.url));

/** Comfortably past `SNAPSHOT_MAX_AGE_MS` (30 days), so the cutoff is not a near thing. */
const STALE_AGE_MS = 40 * 24 * 60 * 60 * 1000;

interface HookRun { status: number | null; stdout: string; stderr: string }

/**
 * `node src/hooks/session-start.ts` over real stdio, with `HOME` pointed at an
 * empty directory so the global layer cannot contribute items (the same guard
 * `test/docs/injection.test.ts`'s runner uses).
 */
function runSessionStartProcess(cwd: string, payload: Record<string, unknown>): HookRun {
  const home = path.join(cwd, '.no-global-layer');
  mkdirSync(home, { recursive: true });
  const result = spawnSync(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', SESSION_START_BIN],
    {
      cwd,
      input: JSON.stringify({ cwd, ...payload }),
      encoding: 'utf8',
      env: { ...process.env, HOME: home, USERPROFILE: home },
    },
  );
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** A `state/` entry with a chosen mtime — age is judged by mtime, not by content. */
function stateFile(cwd: string, name: string, ageMs: number): string {
  const file = path.join(cwd, '.my_context', 'state', name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, '');
  const when = (Date.now() - ageMs) / 1000;
  utimesSync(file, when, when);
  return file;
}

test('SessionStart sweeps a stale seen file and leaves one inside the window alone', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  const stale = stateFile(cwd, 'idle-session.seen.jsonl', STALE_AGE_MS);
  const fresh = stateFile(cwd, 'live-session.seen.jsonl', 0);

  const run = runSessionStartProcess(cwd, { source: 'startup', session_id: 'sweeper' });

  assert.equal(run.status, 0);
  assert.equal(existsSync(stale), false, 'the 40-day-old seen file survived the sweep');
  assert.equal(existsSync(fresh), true, 'the sweep took a seen file inside the retention window');
  removeTree(cwd);
});

test('the sweep names the seen files it took, on stderr and not in the injected block', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  stateFile(cwd, 'idle-one.seen.jsonl', STALE_AGE_MS);
  stateFile(cwd, 'idle-two.seen.jsonl', STALE_AGE_MS);
  stateFile(cwd, 'idle-three.restore.json', STALE_AGE_MS);

  const run = runSessionStartProcess(cwd, { source: 'startup', session_id: 'sweeper' });

  // Both counts: what went in total, and how many of those were dedupe state —
  // the removal whose consequence a reader can still act on.
  assert.match(run.stderr, /pruned 3 stale file\(s\) from state\//);
  assert.match(run.stderr, /2 of them session dedupe file\(s\)/);
  assert.equal(run.stderr.split('\n').filter((l) => /pruned/.test(l)).length, 1,
    'the sweep disclosure is one line, not one per file');
  // The model reads stdout. Housekeeping is not context.
  assert.match(run.stdout, /CONST-pool/);
  assert.equal(/pruned/.test(run.stdout), false, 'the sweep leaked into the injected block');
  removeTree(cwd);
});

test('a session that sweeps no dedupe state says nothing about pruning', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  stateFile(cwd, 'live-session.seen.jsonl', 0);

  const run = runSessionStartProcess(cwd, { source: 'startup', session_id: 'sweeper' });

  assert.equal(run.status, 0);
  assert.equal(/pruned/.test(run.stderr), false, `unexpected stderr: ${run.stderr}`);
  removeTree(cwd);
});

/**
 * **The global layer was unreachable in exactly the situation it exists for.**
 *
 * `buildInjection` opened with `if (!ws.projectRoot) return ''` from 2026-08-13
 * until 2026-08-26. `rebuildRoots` a few lines below it has always known how to
 * load `~/.my-context`, and nothing ever reached it without a PROJECT corpus
 * beside it — so a person whose knowledge lives only in the global layer got
 * nothing, everywhere, silently. Found while fixing the nine-day cwd defect;
 * same branch, one step further along.
 *
 * **`USERPROFILE`/`HOME` are overridden for the child, never for this process.**
 * `GLOBAL_DIR` is computed from `homedir()` at import time, so the only honest
 * way to exercise it is a child with a different home — and
 * `test/helpers/real-home-guard.ts` exists because this project has already had
 * to stop code touching a real one.
 */
test('a global corpus injects even when there is no project workspace at all', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-fake-home-'));
  const nowhere = mkdtempSync(path.join(tmpdir(), 'myctx-no-project-'));
  try {
    const dir = path.join(home, '.my-context', 'items', 'constraint');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(home, '.my-context', 'config.json'),
      `${JSON.stringify({ profile: 'standard', categories: {}, budgets: {} }, null, 2)}\n`);
    writeFileSync(path.join(dir, 'CONST-global-only.md'),
      '---\nid: CONST-global-only\ntype: constraint\ntitle: Global only\nstatus: active\n'
      + 'severity: hard\nalways: true\n---\n\n# Global only\n\nThis lives in the global layer.\n');

    const hook = fileURLToPath(new URL('../../src/hooks/session-start.ts', import.meta.url));
    const run = spawnSync(
      process.execPath,
      ['--disable-warning=ExperimentalWarning', hook],
      {
        input: JSON.stringify({ session_id: 'g1', source: 'startup', cwd: nowhere }),
        encoding: 'utf8',
        env: { ...process.env, USERPROFILE: home, HOME: home },
      },
    );

    assert.equal(run.status, 0, 'INV-hooks-fail-open');
    assert.match(run.stdout, /CONST-global-only/,
      'a global corpus with no project beside it injected nothing. That is the situation the '
      + 'global layer exists for, and it was gated behind a project root for thirteen days.');
    assert.doesNotMatch(run.stderr, /no corpus found/,
      'the no-workspace disclosure must not fire when a global corpus WAS found — crying wolf '
      + 'on a working setup is how a real warning stops being read');
  } finally {
    removeTree(nowhere);
    removeTree(home);
  }
});
