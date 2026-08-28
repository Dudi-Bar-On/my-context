/**
 * `liveWorkspace` — the workspace that re-reads `config.json` instead of
 * photographing it (`plan:live seq:8`).
 *
 * The defect this replaces was measured across two endpoints, and
 * `test/ui/live-config.test.ts` reproduces exactly that measurement. This file
 * is the layer under it: the same fact stated where the mechanism lives, plus
 * the two things an endpoint test cannot see — that a corrupt file at
 * CONSTRUCTION still throws, and that `now()` hands out a value nobody can
 * usefully write into.
 *
 * **No test here asserts a budget count.** `plan:live seq:9` landed a fifth,
 * `continuity`, whose default is in `DEFAULT_BUDGETS` and which is absent from
 * most `config.json` files; a test that spelled four would have been green the
 * day before it shipped and wrong the day after. Every expectation is composed
 * from `DEFAULT_BUDGETS` itself.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { DEFAULT_BUDGETS } from '../../src/core/config.ts';
import { liveWorkspace, resolveWorkspace } from '../../src/core/workspace.ts';

function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-live-ws-'));
  assert.equal(runCli(['init'], dir, () => {}), 0);
  return dir;
}

const configFile = (cwd: string): string => path.join(cwd, '.my_context', 'config.json');

/** An OUT-OF-BAND write: the terminal or the owner's editor, not the UI. */
function writeConfig(cwd: string, text: string): void {
  writeFileSync(configFile(cwd), text, 'utf8');
}

function withProject(body: (cwd: string) => void): void {
  const cwd = project();
  try {
    body(cwd);
  } finally {
    removeTree(cwd);
  }
}

test('now() reads config.json again — an out-of-band edit lands on the next call', () => {
  withProject((cwd) => {
    const live = liveWorkspace(cwd);
    assert.equal(live.now().ws.config.budgets.pinned, DEFAULT_BUDGETS.pinned);

    writeConfig(cwd, JSON.stringify({ budgets: { pinned: 9999 } }));

    const after = live.now();
    assert.equal(after.configError, null);
    assert.equal(after.ws.config.budgets.pinned, 9999);
    // Every OTHER budget still comes from the defaults, `continuity` included —
    // a partial `budgets` block is a merge, not a replacement.
    assert.deepEqual(after.ws.config.budgets, { ...DEFAULT_BUDGETS, pinned: 9999 });
  });
});

test('a category disabled out of band is disabled on the next call', () => {
  withProject((cwd) => {
    const live = liveWorkspace(cwd);
    assert.equal(live.now().ws.config.categories['constraint']?.enabled, true);

    writeConfig(cwd, JSON.stringify({ categories: { constraint: { enabled: false } } }));

    assert.equal(live.now().ws.config.categories['constraint']?.enabled, false);
  });
});

test('the corpus does not move: projectRoot, globalRoot and dbPath are fixed for the source', () => {
  withProject((cwd) => {
    const live = liveWorkspace(cwd);
    const first = live.now().ws;
    writeConfig(cwd, JSON.stringify({ budgets: { pinned: 9999 } }));
    const second = live.now().ws;

    assert.equal(second.projectRoot, first.projectRoot);
    assert.equal(second.globalRoot, first.globalRoot);
    assert.equal(second.dbPath, first.dbPath);
    assert.equal(first.projectRoot, path.join(cwd, '.my_context'));
  });
});

test('each call hands out a fresh value — writing into one cannot reach the next', () => {
  withProject((cwd) => {
    const live = liveWorkspace(cwd);
    const first = live.now().ws;
    assert.notEqual(first, live.now().ws, 'two calls must not share one Workspace object');

    // The shape of the patch this change removed from `ui/execute.ts`: a writer
    // keeping the in-memory config in step by hand. It now reaches nothing,
    // which is the property that stops a second one being added.
    first.config.budgets.pinned = 12345;
    assert.equal(live.now().ws.config.budgets.pinned, DEFAULT_BUDGETS.pinned);
  });
});

/* -------------------------------------------------------------------------- *
 * The file that no longer loads (R2). Decided: keep the last good config and
 * disclose it. Never throw from `now()`.
 * -------------------------------------------------------------------------- */

test('a corrupt config.json at CONSTRUCTION still throws — the server refuses to start', () => {
  withProject((cwd) => {
    writeConfig(cwd, '{ this is not json');
    assert.throws(() => liveWorkspace(cwd), /is not valid JSON/);
    // The same refusal `resolveWorkspace` gave before this change, unchanged.
    assert.throws(() => resolveWorkspace(cwd), /is not valid JSON/);
  });
});

test('a file that stops PARSING mid-session: last good config, and configError says why', () => {
  withProject((cwd) => {
    writeConfig(cwd, JSON.stringify({ budgets: { pinned: 9999 } }));
    const live = liveWorkspace(cwd);
    assert.equal(live.now().ws.config.budgets.pinned, 9999);

    writeConfig(cwd, '{ this is not json');

    const broken = live.now();
    assert.match(broken.configError ?? '', /is not valid JSON/);
    assert.match(broken.configError ?? '', /config\.json/);
    // The LAST GOOD one — 9999, not the defaults and not a throw.
    assert.equal(broken.ws.config.budgets.pinned, 9999);
    assert.deepEqual(broken.ws.config.budgets, { ...DEFAULT_BUDGETS, pinned: 9999 });
  });
});

test('a file that parses and does not LOAD carries the loader\'s own message', () => {
  withProject((cwd) => {
    const live = liveWorkspace(cwd);
    const good = live.now().ws.config;

    // Parses fine; `requireBudgets` refuses it by name.
    writeConfig(cwd, JSON.stringify({ budgets: { pinned: 'lots' } }));

    const broken = live.now();
    assert.notEqual(broken.configError, null);
    assert.match(broken.configError ?? '', /budgets/);
    assert.doesNotMatch(broken.configError ?? '', /is not valid JSON/,
      'a file that PARSES must not be reported as a parse failure');
    assert.deepEqual(broken.ws.config.budgets, good.budgets);
  });
});

test('repairing the file recovers without a restart', () => {
  withProject((cwd) => {
    const live = liveWorkspace(cwd);
    writeConfig(cwd, '{ this is not json');
    assert.notEqual(live.now().configError, null);

    writeConfig(cwd, JSON.stringify({ budgets: { pinned: 4242 } }));

    const fixed = live.now();
    assert.equal(fixed.configError, null);
    assert.equal(fixed.ws.config.budgets.pinned, 4242);
  });
});

test('the last good config advances — a broken file falls back to the newest one that loaded', () => {
  withProject((cwd) => {
    const live = liveWorkspace(cwd);
    writeConfig(cwd, JSON.stringify({ budgets: { pinned: 1111 } }));
    assert.equal(live.now().ws.config.budgets.pinned, 1111);
    writeConfig(cwd, JSON.stringify({ budgets: { pinned: 2222 } }));
    assert.equal(live.now().ws.config.budgets.pinned, 2222);

    writeConfig(cwd, '{ this is not json');

    // 2222, not 1111 and not the boot value: the fallback is the last config
    // that loaded, not the first.
    assert.equal(live.now().ws.config.budgets.pinned, 2222);
  });
});

test('an ABSENT config.json is pure defaults, not a failure', () => {
  withProject((cwd) => {
    const live = liveWorkspace(cwd);
    // `init` writes one; remove it the way a `git checkout` of a branch
    // without it would.
    const before = readFileSync(configFile(cwd), 'utf8');
    assert.notEqual(before, '');
    writeConfig(cwd, JSON.stringify({ budgets: { pinned: 9999 } }));
    assert.equal(live.now().ws.config.budgets.pinned, 9999);

    removeTree(configFile(cwd));

    const gone = live.now();
    assert.equal(gone.configError, null, 'no file is a state, not an error');
    assert.deepEqual(gone.ws.config.budgets, DEFAULT_BUDGETS);
  });
});
