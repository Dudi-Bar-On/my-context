import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `mycontext statusline` — the §4b bridge (ui3 tasks 4 and 5).
 *
 * **Why this file redirects HOME before it imports anything.**
 * `statusline install --yes` saves the setting it replaced under
 * `Workspace.globalRoot`, which is `path.join(homedir(), '.my-context')`
 * resolved ONCE at module load (`src/core/workspace.ts`). A test that ran
 * `install --yes` without moving `homedir()` first would write a backup file
 * into the developer's real global directory — the exact offence
 * `test/helpers/real-home-guard.ts` was written for after two fixture files
 * left there turned 134 unrelated tests red. So this file does what
 * `test/cli/edit-global-layer.test.ts` and `supersede-global-layer.test.ts`
 * do: point `HOME`/`USERPROFILE` at a temp directory at the TOP of the file,
 * `await import()` the module graph only afterwards, and assert the redirect
 * took effect before anything depends on it.
 *
 * The redirect also reaches the SPAWNED runs below, which inherit the
 * environment — so a child process that installs writes its backup into the
 * same fake home.
 */
const home = mkdtempSync(path.join(tmpdir(), 'myctx-sl-home-'));
process.env.HOME = home;
process.env.USERPROFILE = home;
// A test that left this set from the ambient environment would be asserting
// against the developer's own Claude Code configuration directory.
delete process.env.CLAUDE_CONFIG_DIR;

const { runCli } = await import('../../src/cli/index.ts');
const { recordAudit } = await import('../../src/core/audit.ts');
const { classifyContext, readTee } = await import('../../src/core/statusline-tee.ts');
const { GLOBAL_DIR, resolveWorkspace } = await import('../../src/core/workspace.ts');
const { myctxShare, myctxShareByRow, statusLineText } =
  await import('../../src/cli/commands/statusline.ts');
const { openProjection, queryProjection, syncProjection } =
  await import('../../src/core/audit-db.ts');
const { INSTALLED, claudeSettingsPath } = await import('../../src/cli/commands/statusline-install.ts');

const CLI = fileURLToPath(new URL('../../src/cli/index.ts', import.meta.url));

test('the fake home actually took effect — otherwise every install test below is vacuous', () => {
  assert.equal(GLOBAL_DIR, path.join(home, '.my-context'));
});

/* -------------------------------------------------------------------- *
 * Task 4: the bridge command.                                          *
 * -------------------------------------------------------------------- */

function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-sl-'));
  runCli(['init'], dir, () => {});
  return dir;
}

function run(args: string[], cwd: string): { code: number; out: string } {
  const lines: string[] = [];
  const code = runCli(args, cwd, (s) => lines.push(s));
  return { code, out: lines.join('\n') };
}

/**
 * Claude Code's status-line payload, shaped as build 2.1.239 sends it.
 *
 * `projectDir` is a real directory rather than the spec's illustrative
 * `/repo`: the command resolves the workspace from what the PAYLOAD says (see
 * `cmdStatusline`), so a payload naming a directory that does not exist is
 * the "no project workspace" row, and a test that used it could never see a
 * tee written at all.
 */
function payload(sessionId: string, projectDir: string): Record<string, unknown> {
  return {
    session_id: sessionId,
    cwd: projectDir,
    version: '2.1.239',
    model: { id: 'claude-opus-4-5', display_name: 'Opus 4.5' },
    workspace: { current_dir: projectDir, project_dir: projectDir },
    context_window: {
      total_input_tokens: 47000, total_output_tokens: 9000, context_window_size: 200000,
      current_usage: {
        input_tokens: 1000, cache_creation_input_tokens: 6000,
        cache_read_input_tokens: 40000, output_tokens: 9000,
      },
      used_percentage: 23.5, remaining_percentage: 76.5,
    },
  };
}

test('statusLineText renders each state without ever inventing a number', () => {
  const known = classifyContext(payload('s', '/repo'));
  assert.equal(
    statusLineText(known, 'Opus 4.5', { tokens: 6200, injections: 3, unrecorded: 0 }, null),
    'Opus 4.5 | ctx 23.5% (47.0k/200.0k) | myctx 6.2k of it (3 injections)',
  );
  assert.equal(
    statusLineText(known, 'Opus 4.5', { tokens: 6200, injections: 3, unrecorded: 2 }, null),
    'Opus 4.5 | ctx 23.5% (47.0k/200.0k) | myctx ≥6.2k of it (3 injections, 2 not recorded)',
  );
  assert.equal(
    statusLineText(
      { state: 'not-yet-known', usedTokens: null, windowSize: 200000, percent: null },
      'Opus 4.5', null, null,
    ),
    'Opus 4.5 | ctx not yet known (no API call since the last compact)',
  );
  assert.equal(
    statusLineText(
      { state: 'unknown', usedTokens: null, windowSize: null, percent: null },
      null, null, 'projection sync failed',
    ),
    'ctx unknown (this Claude Code sends no context_window) | myctx unavailable (projection sync failed)',
  );
  // The no-workspace row: no tee, no myctx half, nothing invented.
  assert.equal(
    statusLineText(known, 'Opus 4.5', null, null),
    'Opus 4.5 | ctx 23.5% (47.0k/200.0k)',
  );
});

/**
 * A tee that did not land is disclosed even when the myctx half is fine.
 *
 * The obvious shape — one note field, rendered only when `myctx` is null —
 * drops this on the floor: `writeTee` refuses an unsafe `session_id` while
 * `myctxShare` answers for that same id perfectly well, so the line would
 * show a confident myctx figure and never mention that the web UI is getting
 * no sample at all. That is `INV-nothing-is-dropped-silently` on the one
 * surface whose whole job is disclosure.
 */
test('a tee that did not land is disclosed beside a myctx share that did', () => {
  const known = classifyContext(payload('s', '/repo'));
  assert.equal(
    statusLineText(known, 'Opus 4.5', { tokens: 6200, injections: 3, unrecorded: 0 }, null,
      'tee not written (disk full)'),
    'Opus 4.5 | ctx 23.5% (47.0k/200.0k) | myctx 6.2k of it (3 injections) | tee not written (disk full)',
  );
});

test('myctxShare sums recorded tokens and COUNTS absences — never defaults them to zero', () => {
  const dir = project();
  const root = path.join(dir, '.my_context');
  try {
    recordAudit(root, {
      kind: 'injection', op: 'session-start', sessionId: 's1', hook: 'SessionStart',
      injected: [{ id: 'RULE-a', tier: 'pinned' }], tokens: 4000,
    });
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/a.ts',
      injected: [{ id: 'RULE-b', tier: 'jit' }], tokens: 2200,
    });
    // A record written before the `tokens` field existed: counted, never summed as zero.
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/b.ts',
      injected: [{ id: 'RULE-c', tier: 'jit' }],
    });
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 'OTHER', hook: 'PreToolUse', path: 'src/c.ts',
      injected: [{ id: 'RULE-d', tier: 'jit' }], tokens: 999,
    });
    assert.deepEqual(myctxShare(root, 's1'), { tokens: 6200, injections: 3, unrecorded: 1 });
    assert.deepEqual(myctxShare(root, 'never-seen'), { tokens: 0, injections: 0, unrecorded: 0 });
  } finally {
    removeTree(dir);
  }
});

/**
 * **The pin on the one rule `myctxShare` spells twice.**
 *
 * The share is computed as a SQL aggregate because the record-by-record
 * version measured p95 71.8 ms over 5,000 injection records on a per-message
 * path (`test/perf/statusline-latency.perf.ts`). The FILTER is not respelled —
 * `filterSelect` is nested verbatim — but "a `tokens` that is not a number is
 * an absence, counted rather than zeroed" now exists in SQL as well as in
 * JavaScript, and two spellings of one rule is the drift this project keeps
 * finding. So both are run over the same corpus and required to agree, the way
 * `test/core/audit-projection.test.ts` holds `filterSelect` to `filterAudit`.
 *
 * The corpus exercises every shape the two could disagree about: a recorded
 * count, a record with no `tokens` key at all, an explicit JSON `null`, a
 * string where a number belongs, a zero (which `IS NOT NULL` and a falsy check
 * disagree about), another session's record, and a non-injection record.
 */
test('the SQL share and the record-by-record share give the same answer', () => {
  const dir = project();
  const root = path.join(dir, '.my_context');
  try {
    const inject = (extra: Record<string, unknown>): void => {
      recordAudit(root, {
        kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/a.ts',
        injected: [{ id: 'RULE-a', tier: 'jit' }],
        ...extra,
      } as Parameters<typeof recordAudit>[1]);
    };
    inject({ tokens: 4000 });
    inject({});                       // the field never existed
    inject({ tokens: null });         // present, explicitly no number
    inject({ tokens: '2200' });       // a string where a number belongs
    inject({ tokens: 0 });            // a real zero: recorded, and it is not an absence
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 'OTHER', hook: 'PreToolUse', path: 'src/c.ts',
      injected: [{ id: 'RULE-d', tier: 'jit' }], tokens: 999,
    });
    recordAudit(root, {
      kind: 'mutation', op: 'create', sessionId: 's1', itemId: 'CONST-x', origin: 'human',
    });

    const db = openProjection(root);
    let byRow;
    try {
      syncProjection(root, db);
      byRow = myctxShareByRow(queryProjection(db, { sessionId: 's1', kind: 'injection' }));
    } finally {
      db.close();
    }
    assert.deepEqual(byRow, { tokens: 4000, injections: 5, unrecorded: 3 });
    assert.deepEqual(myctxShare(root, 's1'), byRow);
  } finally {
    removeTree(dir);
  }
});

test('the command tees the payload keyed by session and prints the line (spawned, real stdin)', () => {
  const dir = project();
  try {
    const result = spawnSync(process.execPath, [CLI, 'statusline'], {
      cwd: dir, input: JSON.stringify(payload('sess-e2e', dir)), encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Opus 4\.5 \| ctx 23\.5% \(47\.0k\/200\.0k\)/);
    const tee = readTee(path.join(dir, '.my_context'), 'sess-e2e');
    assert.equal((tee?.payload as { session_id?: string } | undefined)?.session_id, 'sess-e2e');
  } finally {
    removeTree(dir);
  }
});

test('unparseable stdin prints a diagnosis line and exits 0 — a status line must not crash-loop', () => {
  const dir = project();
  try {
    const result = spawnSync(process.execPath, [CLI, 'statusline'], {
      cwd: dir, input: 'not json', encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /unreadable status payload/);
  } finally {
    removeTree(dir);
  }
});

test('run bare with no stdin, it explains itself and exits 1', () => {
  const dir = project();
  try {
    const result = spawnSync(process.execPath, [CLI, 'statusline'], {
      cwd: dir, input: '', encoding: 'utf8',
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /status-line JSON on stdin/);
  } finally {
    removeTree(dir);
  }
});

/**
 * The in-process guard, and it is not a nicety: `readFileSync(0)` BLOCKS
 * until stdin reaches EOF, and a `node --test` child's stdin is a pipe that
 * nothing ever closes — measured, on this machine, by running a one-line test
 * that reads fd 0 and watching it sit there until the runner was killed.
 * `test/docs/inventory.test.ts` runs every command the usage banner
 * advertises, bare and IN PROCESS, so a `statusline` that reached for stdin
 * there would not fail the suite: it would hang it, with no output naming the
 * cause. The command therefore reads stdin only when this process was
 * launched AS the CLI, which is the only time fd 0 is its to consume.
 */
test('called as a library rather than as the CLI, it never reaches for stdin', () => {
  const dir = project();
  try {
    const { code, out } = run(['statusline'], dir);
    assert.equal(code, 1);
    assert.match(out, /status-line JSON on stdin/);
  } finally {
    removeTree(dir);
  }
});

/**
 * The bare verb takes no flags, and `--yes` is one of them.
 *
 * This is what keeps `statusline` out of §7's approval boundary
 * (`test/helpers/approval-boundary.ts`): that derivation probes every
 * registered command with a sentinel flag and then with `--yes`, and a
 * command that swallows either would be classified wrongly — unreachable in
 * the first case, "changes what governs this project" in the second.
 * `statusline install --yes` writes a Claude Code setting; it changes nothing
 * about what governs this project, so the bare verb must refuse both.
 */
test('the bare verb refuses an unknown flag, and refuses --yes among them', () => {
  const dir = project();
  try {
    const sentinel = run(['statusline', '--zzz-not-a-flag-any-command-accepts'], dir);
    assert.equal(sentinel.code, 1);
    assert.match(sentinel.out, /unknown option "--zzz-not-a-flag-any-command-accepts"/);
    const yes = run(['statusline', '--yes'], dir);
    assert.equal(yes.code, 1);
    assert.match(yes.out, /unknown option "--yes"/);
    assert.match(yes.out, /statusline install/, 'the refusal must point at the subcommand that does take it');
  } finally {
    removeTree(dir);
  }
});

test('an unknown subcommand is refused by name rather than read as a payload', () => {
  const dir = project();
  try {
    const { code, out } = run(['statusline', 'enable'], dir);
    assert.equal(code, 1);
    assert.match(out, /unknown subcommand "enable"/);
  } finally {
    removeTree(dir);
  }
});

/* -------------------------------------------------------------------- *
 * Task 5: install / uninstall.                                          *
 * -------------------------------------------------------------------- */

test('claudeSettingsPath honours CLAUDE_CONFIG_DIR and falls back to ~/.claude', () => {
  assert.equal(claudeSettingsPath({ CLAUDE_CONFIG_DIR: '/cfg' }), path.join('/cfg', 'settings.json'));
  assert.equal(claudeSettingsPath({ CLAUDE_CONFIG_DIR: '' }), path.join(home, '.claude', 'settings.json'));
  assert.ok(claudeSettingsPath({}).endsWith(path.join('.claude', 'settings.json')));
});

function settingsFixture(dir: string, body: unknown): string {
  const file = path.join(dir, 'settings.json');
  // No trailing newline, two-space indent: one particular shape of a file the
  // user wrote, so the round-trip test below has something to be identical to.
  writeFileSync(file, JSON.stringify(body, null, 2), 'utf8');
  return file;
}

const FOREIGN = { type: 'command', command: 'bash my-line.sh' };

test('install without --yes prints both settings and WRITES NOTHING', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, { statusLine: FOREIGN, model: 'opus' });
    const before = readFileSync(file, 'utf8');
    const { code, out } = run(['statusline', 'install', '--settings', file], dir);
    assert.equal(code, 0);
    assert.match(out, /bash my-line\.sh/, 'the existing setting must be shown');
    assert.match(out, /mycontext statusline/, 'the replacement must be shown');
    assert.match(out, /--yes/, 'the refusal must say how to consent');
    assert.equal(readFileSync(file, 'utf8'), before, 'the settings file was written');
    assert.equal(existsSync(path.join(GLOBAL_DIR, 'statusline-replaced.json')), false);
  } finally {
    removeTree(dir);
  }
});

test('install --yes writes the setting, preserves every other key, and saves the previous value', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, { statusLine: FOREIGN, model: 'opus' });
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);

    const after = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    assert.deepEqual(after.statusLine, INSTALLED);
    assert.equal(after.model, 'opus', 'an unrelated key was lost');

    const ws = resolveWorkspace(dir);
    const backup = JSON.parse(
      readFileSync(path.join(ws.globalRoot, 'statusline-replaced.json'), 'utf8'),
    ) as { previous: unknown; settingsPath: string };
    assert.deepEqual(backup.previous, FOREIGN);
    assert.equal(backup.settingsPath, file);

    assert.equal(run(['statusline', 'uninstall', '--settings', file, '--yes'], dir).code, 0);
    const restored = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    assert.deepEqual(restored.statusLine, FOREIGN);
  } finally {
    removeTree(dir);
  }
});

/**
 * **Uninstall must actually undo install — to the byte.**
 *
 * Restoring the KEY is not the same as restoring the FILE. A settings file is
 * a document a human edits: its indentation, its key order and whether it
 * ends in a newline are that human's, and a "reversible" install that hands
 * back a re-serialized file has silently rewritten every one of them. The
 * comparison below is therefore on the bytes, not on the parsed object, and
 * it is the assertion this whole feature is judged by.
 */
test('the install → uninstall round trip leaves the settings file byte-identical', () => {
  const dir = project();
  try {
    const file = path.join(dir, 'settings.json');
    // Deliberately not what this command would write: four-space indent, our
    // key in the middle rather than first, and no trailing newline.
    const before = '{\n    "model": "opus",\n    "statusLine": {\n        "type": "command",\n'
      + '        "command": "bash my-line.sh"\n    },\n    "verbose": true\n}';
    writeFileSync(file, before, 'utf8');

    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);
    assert.notEqual(readFileSync(file, 'utf8'), before, 'install did not write anything');

    const { code, out } = run(['statusline', 'uninstall', '--settings', file, '--yes'], dir);
    assert.equal(code, 0, out);
    assert.equal(
      readFileSync(file, 'utf8'), before,
      'uninstall restored the statusLine key but not the file: the user\'s indentation, key '
      + 'order or trailing newline did not survive the round trip',
    );
  } finally {
    removeTree(dir);
  }
});

test('install --yes on a settings file with NO statusLine records previous: null; uninstall removes the key', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, { model: 'opus' });
    const before = readFileSync(file, 'utf8');
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);

    const backup = JSON.parse(
      readFileSync(path.join(GLOBAL_DIR, 'statusline-replaced.json'), 'utf8'),
    ) as { previous: unknown };
    assert.equal(backup.previous, null);

    assert.equal(run(['statusline', 'uninstall', '--settings', file, '--yes'], dir).code, 0);
    const restored = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    assert.equal('statusLine' in restored, false);
    assert.equal(restored.model, 'opus');
    assert.equal(readFileSync(file, 'utf8'), before, 'the round trip was not byte-clean');
  } finally {
    removeTree(dir);
  }
});

test('a missing settings file installs into a fresh one, and uninstall takes the whole file back out', () => {
  const dir = project();
  try {
    const file = path.join(dir, 'nested', 'settings.json');
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);
    const after = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    assert.deepEqual(after.statusLine, INSTALLED);

    const { code, out } = run(['statusline', 'uninstall', '--settings', file, '--yes'], dir);
    assert.equal(code, 0, out);
    assert.equal(
      existsSync(file), false,
      'install created this file; leaving an otherwise-empty settings file behind is not the '
      + 'inverse of creating one',
    );
    assert.match(out, /did not exist/, 'removing a file must be announced, never done quietly');
  } finally {
    removeTree(dir);
  }
});

test('an unparseable settings file is refused untouched — never clobbered', () => {
  const dir = project();
  try {
    const file = path.join(dir, 'settings.json');
    writeFileSync(file, '{ not json', 'utf8');
    const { code, out } = run(['statusline', 'install', '--settings', file, '--yes'], dir);
    assert.equal(code, 1);
    assert.match(out, /could not be parsed/);
    assert.equal(readFileSync(file, 'utf8'), '{ not json');
  } finally {
    removeTree(dir);
  }
});

test('a settings file holding a JSON array is refused too — "an object" is the requirement', () => {
  const dir = project();
  try {
    const file = path.join(dir, 'settings.json');
    writeFileSync(file, '[1, 2, 3]', 'utf8');
    const { code, out } = run(['statusline', 'install', '--settings', file, '--yes'], dir);
    assert.equal(code, 1);
    assert.match(out, /could not be parsed/);
    assert.equal(readFileSync(file, 'utf8'), '[1, 2, 3]');
  } finally {
    removeTree(dir);
  }
});

/**
 * **The dangling-entry defect, in the one shape that produces it.**
 *
 * `install --yes` run twice would, on the obvious implementation, save `{our
 * own value}` as "the previous setting" — and the user's real one is then
 * gone for good. `uninstall --yes` afterwards restores `mycontext
 * statusline`, i.e. it removes nothing: a `statusLine` entry pointing at a
 * bridge the user has just uninstalled. A half-removal that leaves a dangling
 * entry is worse than offering no uninstall at all, so the second install is
 * a no-op that says so.
 */
test('installing twice does not overwrite the saved previous value with our own', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, { statusLine: FOREIGN });
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);
    const second = run(['statusline', 'install', '--settings', file, '--yes'], dir);
    assert.equal(second.code, 0, second.out);
    assert.match(second.out, /already installed/i);

    const backup = JSON.parse(
      readFileSync(path.join(GLOBAL_DIR, 'statusline-replaced.json'), 'utf8'),
    ) as { previous: unknown };
    assert.deepEqual(backup.previous, FOREIGN, 'the second install ate the real previous value');

    assert.equal(run(['statusline', 'uninstall', '--settings', file, '--yes'], dir).code, 0);
    const restored = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    assert.deepEqual(restored.statusLine, FOREIGN);
  } finally {
    removeTree(dir);
  }
});

/**
 * The other half of "configuration is the user's to make": a `statusLine`
 * that is not ours is not ours to restore over. Between install and uninstall
 * the user may have pointed Claude Code at something else entirely — and
 * writing our saved backup over THAT would be the silent clobber this command
 * refuses on the way in, performed on the way out.
 */
test('uninstall refuses when the statusLine in the file is no longer ours, and names what is there', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, { statusLine: FOREIGN });
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);

    const theirs = { type: 'command', command: 'starship prompt' };
    writeFileSync(file, JSON.stringify({ statusLine: theirs }, null, 2), 'utf8');
    const before = readFileSync(file, 'utf8');

    const { code, out } = run(['statusline', 'uninstall', '--settings', file, '--yes'], dir);
    assert.equal(code, 1);
    assert.match(out, /starship prompt/, 'the refusal must say what is there');
    assert.equal(readFileSync(file, 'utf8'), before, 'a foreign statusLine was overwritten');
  } finally {
    removeTree(dir);
  }
});

test('uninstall without --yes prints what it would restore and writes nothing', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, { statusLine: FOREIGN });
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);
    const installed = readFileSync(file, 'utf8');

    const { code, out } = run(['statusline', 'uninstall', '--settings', file], dir);
    assert.equal(code, 0);
    assert.match(out, /bash my-line\.sh/);
    assert.match(out, /--yes/);
    assert.equal(readFileSync(file, 'utf8'), installed);
  } finally {
    removeTree(dir);
  }
});

test('uninstall with nothing installed says so and writes nothing', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, { model: 'opus' });
    const before = readFileSync(file, 'utf8');
    const { code, out } = run(['statusline', 'uninstall', '--settings', file, '--yes'], dir);
    assert.equal(code, 0, out);
    assert.match(out, /no mycontext status line/i);
    assert.equal(readFileSync(file, 'utf8'), before);
  } finally {
    removeTree(dir);
  }
});

test('install and uninstall refuse a flag neither of them takes', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, {});
    for (const verb of ['install', 'uninstall']) {
      const { code, out } = run(['statusline', verb, '--settings', file, '--forse'], dir);
      assert.equal(code, 1, out);
      assert.match(out, /unknown option "--forse"/);
    }
  } finally {
    removeTree(dir);
  }
});

test('--settings with no value is refused rather than resolved to the real one', () => {
  const dir = project();
  try {
    const { code, out } = run(['statusline', 'install', '--settings'], dir);
    assert.equal(code, 1, out);
    assert.match(out, /--settings/);
  } finally {
    removeTree(dir);
  }
});
