import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { Ledger } from '../../src/core/ledger.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { reviewQueueDrafts } from '../../src/cli/commands/status.ts';
import { SESSION_PROTOCOL } from '../../src/ingest/session.ts';
import { sandbox } from '../helpers/workspace.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-status-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

/** Every test runs inside this so a FAILING assertion still cleans up its
 * temp project — a bare `rmSync` at the end of the test body only runs when
 * every assertion above it passed, and a failing test leaks its directory.
 * Same pattern as `test/cli/review.test.ts`'s `withProject`. */
function withProject(fn: (cwd: string) => void): void {
  const cwd = project();
  try {
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

function draft(cwd: string, id: string, type: string): void {
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---\nid: ${id}\ntype: ${type}\ntitle: ${id}\nstatus: draft\norigin: ingest\n---\n\n# ${id}\n\nBody.\n`, 'utf8');
}

function openLedger(cwd: string): Ledger {
  return Ledger.open(resolveWorkspace(cwd).dbPath);
}

test('the counts from Plan 1 are unchanged', () => {
  withProject((cwd) => {
    run(['add', 'constraint', 'Pool cap', '--yes'], cwd);
    run(['add', 'lesson', 'Migrations need locks'], cwd);
    const { code, out } = run(['status'], cwd);
    assert.equal(code, 0);
    assert.match(out, /constraint\s+1/);
    assert.match(out, /lesson\s+1/);
    assert.match(out, /active\s+2/);
  });
});

test('the review queue is surfaced with the command that walks it', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement');
    draft(cwd, 'REQ-b', 'requirement');
    const { out } = run(['status'], cwd);
    assert.match(out, /2 draft\(s\) pending review/);
    assert.match(out, /mycontext review/);
  });
});

test('a clean corpus says the queue is empty rather than omitting the section', () => {
  withProject((cwd) => {
    run(['add', 'constraint', 'Pool cap', '--yes'], cwd);
    assert.match(run(['status'], cwd).out, /0 draft\(s\) pending review/);
  });
});

/**
 * Review-round fix: `status.ts:66` used to count every draft in
 * `ctx.store.all()` — the merged project+global corpus — while
 * `mycontext review` deliberately excludes global-layer drafts (they can
 * never be promoted or discarded from a project; see `review.ts`'s
 * `drafts()`). `status` now delegates to the same `drafts()` function
 * instead of re-deriving the filter, via the exported `reviewQueueDrafts`.
 * Pinned here the same way `review.test.ts` pins `drafts()` itself: direct
 * `sandbox()` upserts, never touching the real `~/.my-context` that a true
 * end-to-end reproduction would require.
 */
test('reviewQueueDrafts excludes a global-layer draft, exactly as review() does', () => {
  const s = sandbox();
  try {
    s.ctx.store.upsert({
      id: 'CONST-global-draft', type: 'constraint', title: 'Global draft', status: 'draft',
      severity: 'soft', always: false, scope: [], tags: [], origin: 'ingest',
      sourceFile: null, sourceAnchor: null, sourceChecksum: null,
      validFrom: null, validUntil: null, checksum: '', extra: {},
      body: '', observations: [], relations: [], layer: 'global',
      filePath: 'items/constraint/CONST-global-draft.md',
    });
    s.ctx.store.upsert({
      id: 'CONST-project-draft', type: 'constraint', title: 'Project draft', status: 'draft',
      severity: 'soft', always: false, scope: [], tags: [], origin: 'ingest',
      sourceFile: null, sourceAnchor: null, sourceChecksum: null,
      validFrom: null, validUntil: null, checksum: '', extra: {},
      body: '', observations: [], relations: [], layer: 'project',
      filePath: 'items/constraint/CONST-project-draft.md',
    });
    const queue = reviewQueueDrafts(s.ctx);
    assert.deepEqual(queue.map((i) => i.id), ['CONST-project-draft']);
  } finally {
    s.dispose();
  }
});

test('unfinished ingest sessions are listed with their progress', () => {
  withProject((cwd) => {
    mkdirSync(path.join(cwd, 'docs'), { recursive: true });
    writeFileSync(path.join(cwd, 'docs', 'prd.md'), '# A\n\nOne.\n\n# B\n\nTwo.\n', 'utf8');
    run(['ingest', 'docs/prd.md'], cwd);
    const { out } = run(['status'], cwd);
    assert.match(out, /ingest/);
    assert.match(out, /docs\/prd\.md\s+0\/2/);
  });
});

/**
 * `status --json`'s session array is filtered to sessions with pending
 * anchors, while `ingest-status --json` emits every session. Naming both
 * `ingest` would be one key over two different populations, with nothing in
 * either document saying so — a consumer reading `status --json`'s `ingest`
 * would silently under-report. The key carries the filter instead, and this
 * pins BOTH halves: the name, and the filter the name claims.
 */
test('status --json names its session array for the filtered population it holds', () => {
  withProject((cwd) => {
    mkdirSync(path.join(cwd, 'docs'), { recursive: true });
    writeFileSync(path.join(cwd, 'docs', 'prd.md'), '# A\n\nOne.\n\n# B\n\nTwo.\n', 'utf8');
    const finished = /ING-[a-z0-9-]+/.exec(run(['ingest', 'docs/prd.md'], cwd).out)![0];
    writeFileSync(path.join(cwd, 'c.json'), JSON.stringify([]), 'utf8');
    for (const anchor of ['a', 'b']) {
      run(['ingest-apply', finished, '--anchor', anchor, '--file', 'c.json'], cwd);
    }

    const parsed = JSON.parse(run(['status', '--json'], cwd).out) as Record<string, unknown>;
    assert.ok('unfinishedIngest' in parsed, `expected an unfinishedIngest key: ${Object.keys(parsed).join(', ')}`);
    assert.equal('ingest' in parsed, false, 'a bare `ingest` key would claim every session');
    // The name is only honest because the array really is filtered: the
    // fully-applied session above must be absent from it.
    assert.deepEqual(parsed.unfinishedIngest, []);
    // …and `ingest-status --json`, the unfiltered surface, still has it.
    const all = JSON.parse(run(['ingest-status', '--json'], cwd).out) as { id: string }[];
    assert.deepEqual(all.map((s) => s.id), [finished]);
  });
});

test('a fully-applied ingest session is not listed as unfinished', () => {
  withProject((cwd) => {
    mkdirSync(path.join(cwd, 'docs'), { recursive: true });
    writeFileSync(path.join(cwd, 'docs', 'prd.md'), '# Only section\n\nSome text.\n', 'utf8');
    const ingested = run(['ingest', 'docs/prd.md'], cwd);
    const session = /ING-[a-z0-9-]+/.exec(ingested.out)![0];
    writeFileSync(path.join(cwd, 'c.json'), JSON.stringify([]), 'utf8');
    run(['ingest-apply', session, '--anchor', 'only-section', '--file', 'c.json'], cwd);

    const { out } = run(['status'], cwd);
    assert.doesNotMatch(out, /unfinished session/);
  });
});

/**
 * Review-round mutation gap: `const done = session.chunks.length -
 * pendingAnchors(session).length` was only ever exercised at 0/2 (nothing
 * applied) or fully-done (filtered out entirely) — a mutant that pinned
 * `done` at a constant survived. A two-chunk document with exactly one
 * chunk applied is the only case that tells "computed" apart from "constant".
 */
test('a partially-applied ingest session shows the real fraction, not a constant', () => {
  withProject((cwd) => {
    mkdirSync(path.join(cwd, 'docs'), { recursive: true });
    writeFileSync(path.join(cwd, 'docs', 'prd.md'), '# A\n\nOne.\n\n# B\n\nTwo.\n', 'utf8');
    const ingested = run(['ingest', 'docs/prd.md'], cwd);
    const session = /ING-[a-z0-9-]+/.exec(ingested.out)![0];
    writeFileSync(path.join(cwd, 'c.json'), JSON.stringify([]), 'utf8');
    run(['ingest-apply', session, '--anchor', 'a', '--file', 'c.json'], cwd);

    const { out } = run(['status'], cwd);
    assert.match(out, /docs\/prd\.md\s+1\/2/);
  });
});

test('pending rule approvals are surfaced, with the candidate detail row', () => {
  withProject((cwd) => {
    const lesson = run(['lesson', 'Migrations deadlock during peak traffic'], cwd);
    const id = /LESSON-[a-z0-9-]+/.exec(lesson.out)![0];
    writeFileSync(path.join(cwd, 'r.json'),
      JSON.stringify([{ title: 'Run migrations off-peak', directive: 'do', body: 'b' }]), 'utf8');
    run(['lesson-stage', id, '--file', 'r.json'], cwd);

    const { out } = run(['status'], cwd);
    assert.match(out, /1 rule candidate\(s\) awaiting approval/);
    assert.match(out, /lesson-accept/);
    // The detail row itself — a mutant that deletes the per-candidate loop
    // still passes the summary-count assertion above.
    assert.match(out, /Run migrations off-peak/);
    assert.match(out, new RegExp(id));
  });
});

test('an accepted rule candidate does not keep counting as awaiting approval', () => {
  withProject((cwd) => {
    const lesson = run(['lesson', 'Migrations deadlock during peak traffic'], cwd);
    const id = /LESSON-[a-z0-9-]+/.exec(lesson.out)![0];
    writeFileSync(path.join(cwd, 'r.json'), JSON.stringify([
      { title: 'Run migrations off-peak', directive: 'do', body: 'b' },
      { title: 'Never run migrations at peak', directive: 'dont', body: 'b' },
    ]), 'utf8');
    const staged = run(['lesson-stage', id, '--file', 'r.json'], cwd);
    const keys = [...staged.out.matchAll(/^\s{2}([0-9a-f]{8})\s/gm)].map((m) => m[1]);
    run(['lesson-accept', id, keys[0]], cwd);

    const { out } = run(['status'], cwd);
    // One candidate was accepted (now a real rule) and one is still pending —
    // the accepted one must not still be reported as awaiting approval.
    assert.match(out, /1 rule candidate\(s\) awaiting approval/);
  });
});

test('the doctor summary appears as a single line', () => {
  withProject((cwd) => {
    const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-a.md');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `---\nid: CONST-a\ntype: constraint\ntitle: A\nstatus: active\nscope:\n  - "src/gone/**"\n---\n\n# A\n\nBody.\n`, 'utf8');

    const { out } = run(['status'], cwd);
    assert.match(out, /health:.*0 error\(s\).*warning\(s\)/);
    assert.match(out, /mycontext doctor/);
  });
});

test('health checks the repository root, not the .my_context directory itself', () => {
  withProject((cwd) => {
    mkdirSync(path.join(cwd, 'src', 'real'), { recursive: true });
    writeFileSync(path.join(cwd, 'src', 'real', 'foo.ts'), '// real file\n', 'utf8');
    const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-a.md');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(
      file,
      `---\nid: CONST-a\ntype: constraint\ntitle: A\nstatus: active\nscope:\n  - "src/real/**"\n---\n\n# A\n\nBody.\n`,
      'utf8',
    );

    const { out } = run(['status'], cwd);
    // The scope glob matches a real file relative to the repository root
    // (cwd), one level above `.my_context`. If `repoRoot` were ever passed as
    // `ws.projectRoot` (the `.my_context` directory) instead, this glob would
    // wrongly be reported dead — the wrong-root class of bug this pins.
    assert.match(out, /health: 0 error\(s\), 0 warning\(s\)/);
  });
});

/**
 * Review-round fix: `runChecks` used to run while `ctx.store` was still
 * open, so `checkIndexFreshness`'s stat of `ws.dbPath` saw the mtime from
 * the LAST close (before this invocation's own rebuild checkpointed the
 * WAL) — a false `index_stale` warning on the very first `status` run after
 * any edit, gone the moment `mycontext doctor` (which the health line
 * itself points at) is run next in a fresh process.
 *
 * The item file is rewritten (bumping its mtime to "now") AFTER the `add`
 * command's own process has already exited and checkpointed the index at an
 * earlier "now" — mirroring an external edit (hand edit, `git checkout`,
 * another tool) landing between two separate `mycontext` invocations. This
 * does NOT set the mtime artificially into the future: doing that would
 * make the index genuinely, unavoidably stale (the FIX's own checkpoint,
 * which lands at real wall-clock "now", could never catch up to a
 * timestamp ahead of it either) and would no longer distinguish the fix
 * from the bug it fixes.
 */
test('the health line does not falsely flag staleness the index\'s own rebuild just resolved', () => {
  withProject((cwd) => {
    run(['add', 'constraint', 'Pool cap', '--yes'], cwd);
    const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-pool-cap.md');
    // Bump the mtime to real wall-clock "now" — later than the `add`
    // process's own checkpoint, which happened at whatever "now" was a
    // moment ago when that separate process exited.
    const now = new Date();
    utimesSync(file, now, now);

    const { out } = run(['status'], cwd);
    assert.match(out, /health: 0 error\(s\), 0 warning\(s\), 0 note\(s\)/);
  });
});

test('status reports origin so agent-authored volume is visible', () => {
  withProject((cwd) => {
    run(['add', 'constraint', 'Pool cap', '--yes'], cwd);
    draft(cwd, 'REQ-a', 'requirement');
    const { out } = run(['status'], cwd);
    assert.match(out, /by origin/);
    assert.match(out, /human\s+1/);
    assert.match(out, /ingest\s+1/);
  });
});

test('status degrades gracefully when the ledger holds nothing', () => {
  withProject((cwd) => {
    run(['add', 'constraint', 'Pool cap', '--yes'], cwd);
    const { code, out } = run(['status'], cwd);
    assert.equal(code, 0);
    assert.match(out, /no sessions recorded|0 session/);
  });
});

/**
 * Review-round gap: no test anywhere drove `status` with a POPULATED
 * ledger, so the entire non-zero-sessions branch of the usage line — the
 * branch a real user with real history sees — had zero coverage. A mutant
 * that hardcoded `decay.cold.length` to `0` passed the whole suite. This
 * records one session that injects nothing, so the scoped normative item
 * below is genuinely cold (not a mutant-indistinguishable zero).
 */
test('the usage line reports a real, non-zero cold count once the ledger has sessions', () => {
  withProject((cwd) => {
    const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-a.md');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `---\nid: CONST-a\ntype: constraint\ntitle: A\nstatus: active\nscope:\n  - "src/**"\n---\n\n# A\n\nBody.\n`, 'utf8');

    const ledger = openLedger(cwd);
    ledger.record('s1', 'ITEM-unrelated-does-not-exist', 'jit', new Date().toISOString());
    ledger.close();

    const { out } = run(['status'], cwd);
    assert.match(out, /1 session\(s\) recorded/);
    assert.match(out, /1 normative item\(s\) not injected/);
    // The ledger holds far fewer than the 20-session window: the hedge must
    // accompany the number, not just the raw "last 20 sessions" claim.
    assert.match(out, /only 1 session\(s\) recorded so far, so "cold" mostly means "new"/);
  });
});

/**
 * Found by running `status --full` against this repo's own corpus: it printed
 * "no sessions recorded yet" and then listed 25 items under a "cold id"
 * header, which reads as a decay list produced from a ledger that had
 * measured nothing at all.
 */
test('status --full lists no cold rows while the ledger is empty, and says why', () => {
  withProject((cwd) => {
    const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-a.md');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `---\nid: CONST-a\ntype: constraint\ntitle: A\nstatus: active\nscope:\n  - "src/**"\n---\n\n# A\n\nBody.\n`, 'utf8');

    const { out } = run(['status', '--full'], cwd);
    assert.match(out, /no sessions recorded yet/);
    // "injectable (scoped or pinned)", not "scoped": the cold list holds
    // pinned-but-unscoped items too, and naming them all "scoped" is the same
    // category error as decay printing a pinned item's scope as "(none)".
    assert.match(out, /1 injectable item\(s\) \(scoped or pinned\) have never been injected/);
    assert.match(out, /not "unused"/);
    assert.doesNotMatch(out, /^\s+CONST-a\s+constraint\s+A$/m, 'no cold row for an unmeasured item');
  });
});

test('status --full lists the cold rows once the ledger actually holds sessions', () => {
  withProject((cwd) => {
    const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-a.md');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `---\nid: CONST-a\ntype: constraint\ntitle: A\nstatus: active\nscope:\n  - "src/**"\n---\n\n# A\n\nBody.\n`, 'utf8');

    const ledger = openLedger(cwd);
    ledger.record('s1', 'ITEM-unrelated-does-not-exist', 'jit', new Date().toISOString());
    ledger.close();

    const { out } = run(['status', '--full'], cwd);
    assert.match(out, /cold — not auto-injected in the last 20 session\(s\); verify real use before acting/);
    assert.match(out, /^\s+CONST-a\s+constraint\s+A$/m);
  });
});

/** The sibling case: an item that WAS injected in a recorded session must
 * drop out of the cold count, proving the number tracks real ledger data
 * in both directions, not just "nonzero because something is unscoped". */
test('an item injected in a recorded session is not counted as cold', () => {
  withProject((cwd) => {
    const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-a.md');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `---\nid: CONST-a\ntype: constraint\ntitle: A\nstatus: active\nscope:\n  - "src/**"\n---\n\n# A\n\nBody.\n`, 'utf8');

    const ledger = openLedger(cwd);
    ledger.record('s1', 'CONST-a', 'jit', new Date().toISOString());
    ledger.close();

    const { out } = run(['status'], cwd);
    assert.match(out, /0 normative item\(s\) not injected/);
  });
});

test('an unscoped active normative item is called out by name-free count', () => {
  withProject((cwd) => {
    const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-a.md');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `---\nid: CONST-a\ntype: constraint\ntitle: A\nstatus: active\n---\n\n# A\n\nBody.\n`, 'utf8');

    const { out } = run(['status'], cwd);
    assert.match(out, /1 active normative item\(s\) carry no scope/);
  });
});

/**
 * Review-round note: Plan 1's `status` warned about EVERY unscoped active
 * item, regardless of category tier. This version's unscoped count comes
 * from `computeDecay`, which is deliberately scoped to `normative`-tier,
 * eligible items only (the same boundary `mycontext decay` itself uses) —
 * so an unscoped active item in a non-normative category (e.g. `lesson`,
 * tier `rationale`) no longer triggers this line at all. That is an
 * intentional narrowing inherited from Task 13's `computeDecay`, not a new
 * decision made here, but it IS a real behavior change from Plan 1 and
 * neither the old nor the new behavior had a test — this pins the new one
 * so a future change to the boundary is visible.
 */
test('an unscoped active item in a non-normative category is silent (inherited from computeDecay\'s tier scoping, not a bug)', () => {
  withProject((cwd) => {
    const file = path.join(cwd, '.my_context', 'items', 'lesson', 'LESSON-a.md');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `---\nid: LESSON-a\ntype: lesson\ntitle: A\nstatus: active\n---\n\n# A\n\nBody.\n`, 'utf8');

    const { out } = run(['status'], cwd);
    assert.doesNotMatch(out, /carry no scope/);
  });
});

/**
 * Review-round decision: `status`'s exit code reflects corpus LOAD errors
 * only, never a doctor-level `error` finding — deliberately narrower than
 * `doctor`'s own exit code, which fails on both. `checkSessionIdMismatch`
 * is the cheapest deterministic way to produce a real `error`-level finding
 * without corrupting an item file (which would instead trip the load-error
 * path this test needs to keep separate from).
 */
test('an error-level doctor finding is shown but does not fail status\'s own exit code — and the gap is stated on screen', () => {
  withProject((cwd) => {
    const ingestDir = path.join(cwd, '.my_context', '.ingest');
    mkdirSync(ingestDir, { recursive: true });
    writeFileSync(
      path.join(ingestDir, 'ING-mismatched.json'),
      JSON.stringify({ protocol: SESSION_PROTOCOL, id: 'ING-actually-different', chunks: [], applied: {} }),
      'utf8',
    );

    const { code, out } = run(['status'], cwd);
    assert.equal(code, 0, 'a doctor-level error must not fail status\'s own exit code');
    assert.match(out, /health: 1 error\(s\)/);
    assert.match(out, /status's own exit code does not reflect the 1 error\(s\) above/);
    assert.match(out, /mycontext doctor/);

    // And doctor itself DOES fail on the identical corpus, which is exactly
    // the asymmetry the on-screen note exists to explain.
    assert.equal(run(['doctor', '--quiet'], cwd).code, 1);
  });
});

test('a corrupt item file is reported and exits 1, exactly as Plan 1 required', () => {
  withProject((cwd) => {
    run(['add', 'constraint', 'Good item', '--yes'], cwd);
    mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
    writeFileSync(path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-broken.md'), 'no frontmatter here\n');

    const { code, out } = run(['status'], cwd);
    assert.equal(code, 1);
    assert.match(out, /constraint\s+1/, 'the good item is still counted');
    assert.match(out, /my_context: error\s+.*CONST-broken\.md/);
  });
});

test('status outside a workspace still explains how to create one', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-nostatus-'));
  try {
    const { code, out } = run(['status'], cwd);
    assert.equal(code, 1);
    assert.match(out, /mycontext init/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
