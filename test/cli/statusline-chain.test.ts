import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `mycontext statusline install` CHAINS rather than replaces (2026-08-27).
 *
 * The bridge is not the only thing that wants a status line. On the owner's
 * machine the `statusLine` entry is another plugin's script, and an install
 * that replaced it cost him that line — so the bridge now TEES first and then
 * DELEGATES to whatever `install` displaced, passing the same stdin payload
 * through and printing that command's stdout as the line.
 *
 * **Why this file redirects HOME before it imports anything**, exactly as
 * `test/cli/statusline.test.ts` does: `install --yes` saves the setting it
 * replaced under `Workspace.globalRoot`, which is `homedir()/.my-context`
 * resolved ONCE at module load. Without the redirect these tests would write
 * a backup into the developer's real global directory — and the delegation
 * this file exercises READS that backup, so the redirect is what makes every
 * assertion below about a fixture rather than about the developer's machine.
 * The spawned bridge runs inherit the environment, so they read the same
 * fake home.
 */
const home = mkdtempSync(path.join(tmpdir(), 'myctx-chain-home-'));
process.env.HOME = home;
process.env.USERPROFILE = home;
delete process.env.CLAUDE_CONFIG_DIR;

const { runCli } = await import('../../src/cli/index.ts');
const { readTee } = await import('../../src/core/statusline-tee.ts');
const { GLOBAL_DIR } = await import('../../src/core/workspace.ts');
const { DELEGATE_TIMEOUT_MS, runDelegate } =
  await import('../../src/cli/commands/statusline.ts');
const { delegateFor, looksLikeOurBridge, parseCommandString } =
  await import('../../src/cli/commands/statusline-install.ts');

const CLI = fileURLToPath(new URL('../../src/cli/index.ts', import.meta.url));

test('the fake home actually took effect — otherwise every install test below is vacuous', () => {
  assert.equal(GLOBAL_DIR, path.join(home, '.my-context'));
});

const SAVED_COPY = path.join(GLOBAL_DIR, 'statusline-replaced.json');

/**
 * There is exactly ONE saved copy per machine — that is the design, and it is
 * why the delegate is read from it rather than from a second store — so every
 * test in this file shares it. A test that asserts "nothing was saved" would
 * otherwise be reading the PREVIOUS test's backup, which is how a green
 * assertion comes to mean nothing at all.
 */
function project(): string {
  rmSync(SAVED_COPY, { force: true });
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-chain-'));
  runCli(['init'], dir, () => {});
  return dir;
}

function run(args: string[], cwd: string): { code: number; out: string } {
  const lines: string[] = [];
  const code = runCli(args, cwd, (s) => lines.push(s));
  return { code, out: lines.join('\n') };
}

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

/** Writes a delegate script into `dir` and returns the command string for it. */
function delegateScript(dir: string, name: string, body: string): string {
  const file = path.join(dir, name);
  writeFileSync(file, body, 'utf8');
  // `node <path>` with the REAL path, backslashes and all on win32: the owner's
  // machine is Windows and his displaced command is a path like this one, so a
  // parser that refused a backslash would refuse the only case that prompted
  // this feature. `process.execPath` is deliberately NOT used — it lives under
  // `C:\Program Files\` on this machine, and a space is exactly the ambiguity
  // the parser refuses to guess at.
  return `node ${file}`;
}

/** A delegate that proves it received the SAME payload on stdin. */
const ECHOES_STDIN =
  'import { readFileSync } from "node:fs";\n'
  + 'const p = JSON.parse(readFileSync(0, "utf8"));\n'
  + 'process.stdout.write(`THEIRS session=${p.session_id}\\n`);\n';

/** Runs the installed bridge the way Claude Code does: a fresh process, JSON on stdin. */
function bridge(
  dir: string,
  sessionId: string,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [CLI, 'statusline'], {
    cwd: dir, input: JSON.stringify(payload(sessionId, dir)), encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function settingsWith(dir: string, command: string | null): string {
  const file = path.join(dir, 'settings.json');
  const body = command === null
    ? { model: 'opus' }
    : { statusLine: { type: 'command', command }, model: 'opus' };
  writeFileSync(file, JSON.stringify(body, null, 2), 'utf8');
  return file;
}

/* -------------------------------------------------------------------- *
 * 1. The previous command is recorded, and is what gets delegated to.   *
 * -------------------------------------------------------------------- */

test('the bridge delegates to the command install displaced, with the same stdin payload', () => {
  const dir = project();
  try {
    const file = settingsWith(dir, delegateScript(dir, 'theirs.mjs', ECHOES_STDIN));
    const installed = run(['statusline', 'install', '--settings', file, '--yes'], dir);
    assert.equal(installed.code, 0, installed.out);

    const result = bridge(dir, 'sess-chain');
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout, /THEIRS session=sess-chain/,
      'the displaced command\'s stdout is the status line, and it saw the same payload',
    );
    assert.doesNotMatch(result.stdout, /ctx 23\.5%/, 'our own line replaced theirs');

    // The tee on the SUCCESS path, and this assertion is not decoration: with
    // it missing, moving `writeTee` to after the delegation passed every test
    // in this file. A delegate that WORKS returns early, so "tee first" is
    // unobservable from the failure cases alone — they fall through to a tee
    // that happens either way. This is the assertion that pins the ordering.
    const tee = readTee(path.join(dir, '.my_context'), 'sess-chain');
    assert.equal(
      (tee?.payload as { session_id?: string } | undefined)?.session_id, 'sess-chain',
      'the sample was not written: delegating to someone else\'s status line must never be '
      + 'the reason mycontext stops measuring',
    );
  } finally {
    removeTree(dir);
  }
});

/**
 * The same thing end to end, in the owner's own spelling: a quoted path with
 * forward slashes, which is what his `settings.json` actually holds. The unit
 * test above pins the parse; this pins that the parse is enough to keep his
 * status line running once the bridge is installed in front of it.
 */
test('the owner\'s quoted-path spelling chains end to end, not just in the parser', () => {
  const dir = project();
  try {
    const script = path.join(dir, 'theirs.mjs');
    writeFileSync(script, ECHOES_STDIN, 'utf8');
    const file = settingsWith(dir, `node "${script.replace(/\\/g, '/')}"`);
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);

    const result = bridge(dir, 'sess-quoted');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /THEIRS session=sess-quoted/);
    const tee = readTee(path.join(dir, '.my_context'), 'sess-quoted');
    assert.equal((tee?.payload as { session_id?: string } | undefined)?.session_id, 'sess-quoted');
  } finally {
    removeTree(dir);
  }
});

test('the delegate is read from the ONE saved copy uninstall restores from — not a second store', () => {
  const dir = project();
  try {
    const command = delegateScript(dir, 'theirs.mjs', ECHOES_STDIN);
    const file = settingsWith(dir, command);
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);

    const backup = JSON.parse(readFileSync(SAVED_COPY, 'utf8')) as { previous: { command: string } };
    assert.equal(backup.previous.command, command);

    const ws = { projectRoot: null, globalRoot: GLOBAL_DIR, dbPath: ':memory:', config: {} };
    assert.deepEqual(
      delegateFor(ws as never)?.argv, ['node', path.join(dir, 'theirs.mjs')],
      'the delegate must come from the install backup, parsed into argv',
    );
  } finally {
    removeTree(dir);
  }
});

test('with no previous status line there is nothing to delegate to: the bridge prints its own line', () => {
  const dir = project();
  try {
    const file = settingsWith(dir, null);
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);
    const result = bridge(dir, 'sess-none');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Opus 4\.5 \| ctx 23\.5% \(47\.0k\/200\.0k\)/);
  } finally {
    removeTree(dir);
  }
});

/* -------------------------------------------------------------------- *
 * 2. Delegation failure must not break the status line.                 *
 * 3. …and the tee has already happened when it does.                    *
 * -------------------------------------------------------------------- */

const FAILURES: { name: string; body: string | null }[] = [
  { name: 'exits non-zero', body: 'process.stdout.write("half a line\\n"); process.exit(3);\n' },
  { name: 'writes nothing at all', body: 'process.exit(0);\n' },
  { name: 'writes only whitespace', body: 'process.stdout.write("   \\n");\n' },
  { name: 'throws on the payload', body: 'throw new Error("boom");\n' },
  { name: 'is missing entirely', body: null },
];

for (const { name, body } of FAILURES) {
  test(`a delegate that ${name} still leaves a status line AND a tee`, () => {
    const dir = project();
    try {
      const command = body === null
        ? 'mycontext-no-such-delegate-exists-anywhere'
        : delegateScript(dir, 'broken.mjs', body);
      const file = settingsWith(dir, command);
      assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);

      const session = `sess-${name.replace(/[^a-z]+/gi, '-')}`;
      const result = bridge(dir, session);
      assert.equal(result.status, 0, result.stderr);
      assert.match(
        result.stdout, /Opus 4\.5 \| ctx 23\.5% \(47\.0k\/200\.0k\)/,
        'a failed delegate must fall back to our own line, never to a blank one',
      );
      assert.doesNotMatch(result.stdout, /half a line/, 'a non-zero exit\'s partial output was trusted');

      const tee = readTee(path.join(dir, '.my_context'), session);
      assert.equal(
        (tee?.payload as { session_id?: string } | undefined)?.session_id, session,
        'THE SAMPLE IS THE WHOLE POINT: it must already be on disk before the delegate is asked '
        + 'to do anything, so a delegate that fails cannot cost us the measurement',
      );
    } finally {
      removeTree(dir);
    }
  });
}

/* -------------------------------------------------------------------- *
 * 4. A bound on the delegate.                                           *
 * -------------------------------------------------------------------- */

test('a delegate that hangs is killed and reported as no line, rather than hanging the status line', () => {
  const dir = project();
  try {
    const file = path.join(dir, 'hangs.mjs');
    // Holds the process open and never writes: the shape a status line cannot
    // survive, and the reason the bound exists.
    writeFileSync(file, 'setInterval(() => {}, 1000);\n', 'utf8');
    const started = Date.now();
    const line = runDelegate([process.execPath, file], '{}', 250);
    const elapsed = Date.now() - started;
    assert.equal(line, null, 'a killed delegate produces no line, so the caller falls back');
    assert.ok(elapsed < 5000, `the bound was not enforced (took ${elapsed} ms)`);
  } finally {
    removeTree(dir);
  }
});

test('the delegate bound is far below the cadence Claude Code re-runs the line at', () => {
  assert.ok(DELEGATE_TIMEOUT_MS > 0);
  assert.ok(
    DELEGATE_TIMEOUT_MS <= 5_000,
    'a status line that can stall for seconds is a status line the user removes',
  );
});

/* -------------------------------------------------------------------- *
 * 5. No shell: a command STRING becomes argv, or it is refused.          *
 * -------------------------------------------------------------------- */

test('parseCommandString splits an unambiguous command into argv', () => {
  assert.deepEqual(parseCommandString('bash my-line.sh'), { ok: true, argv: ['bash', 'my-line.sh'] });
  assert.deepEqual(
    parseCommandString('  starship   prompt  '),
    { ok: true, argv: ['starship', 'prompt'] },
  );
  assert.deepEqual(
    parseCommandString('node C:\\Users\\me\\.claude\\gsd-statusline.js'),
    { ok: true, argv: ['node', 'C:\\Users\\me\\.claude\\gsd-statusline.js'] },
    'a Windows path separator is a literal character here — the case the feature exists for',
  );
  assert.deepEqual(
    parseCommandString('node line.js --format=long'),
    { ok: true, argv: ['node', 'line.js', '--format=long'] },
  );
});

/**
 * **The owner's real `statusLine`, measured on his machine 2026-08-27.**
 *
 * ```
 * "command": "node \"C:/Users/UserC/.claude/hooks/gsd-statusline.js\""
 * ```
 *
 * The path has no spaces and no metacharacters; the quotes are gratuitous, and
 * gratuitous quotes are what a hand-written or tool-generated `settings.json`
 * is full of. A parser that refused them refused the exact command this whole
 * feature exists to preserve — installing would have cost him his status line,
 * which is the defect, not a conservative default.
 */
test('a double-quoted run is ONE argv element, quotes stripped — the owner\'s real setting parses', () => {
  assert.deepEqual(
    parseCommandString('node "C:/Users/UserC/.claude/hooks/gsd-statusline.js"'),
    { ok: true, argv: ['node', 'C:/Users/UserC/.claude/hooks/gsd-statusline.js'] },
    'THE case this feature exists for: installing must cost the owner nothing',
  );
  assert.deepEqual(
    parseCommandString('"C:\\Program Files\\nodejs\\node.exe" line.js'),
    { ok: true, argv: ['C:\\Program Files\\nodejs\\node.exe', 'line.js'] },
    'whitespace inside a quoted run does not split — that is the entire reason quoting exists',
  );
  assert.deepEqual(
    parseCommandString('cmd "a b" c'),
    { ok: true, argv: ['cmd', 'a b', 'c'] },
    'quoted and bare runs mix, and each stays one element',
  );
  assert.deepEqual(
    parseCommandString('node "line one.js" --format=long'),
    { ok: true, argv: ['node', 'line one.js', '--format=long'] },
  );
});

test('parseCommandString REFUSES every shape whose meaning depends on a shell', () => {
  const ambiguous = [
    "bash -c 'echo hi'",                             // single quotes: cmd and sh disagree
    'node "unterminated.js',                         // a quote that never closes
    'node "$HOME/line.js"',                          // substitution, inside quotes
    'node "`date`.js"',                              // substitution, inside quotes
    'node "%USERPROFILE%/line.js"',                  // cmd.exe expands this INSIDE quotes
    'node "a\\" b"',                                 // an escape before the closing quote
    'node "a b"c',                                   // a quoted run joined to more text
    'node x"a b"',                                   // …and the same joint the other way round
    'line.js | tee out.txt',                         // a pipeline
    'a && b',                                        // an operator
    'a; b',                                          // a sequence
    'line.js > out.txt',                             // redirection
    'echo $HOME',                                    // substitution
    'echo `date`',                                   // substitution
    'echo %USERPROFILE%',                            // cmd.exe substitution
    'cat ~/line.txt',                                // tilde expansion
    'run *.js',                                      // a glob
    'node line.js\nrm -rf /',                        // a second line
    'node my\\ line.js',                             // an escaped space
    '',                                              // nothing at all
    '   ',
  ];
  for (const command of ambiguous) {
    const parsed = parseCommandString(command);
    assert.equal(parsed.ok, false, `parsed as argv rather than refused: ${JSON.stringify(command)}`);
    if (!parsed.ok) assert.ok(parsed.reason.length > 0, 'a refusal must say why');
  }
});

test('install says at install time that it cannot chain an unparseable command, and chains nothing', () => {
  const dir = project();
  try {
    const file = settingsWith(dir, "bash -c 'echo hi'");

    const preview = run(['statusline', 'install', '--settings', file], dir);
    assert.equal(preview.code, 0, preview.out);
    assert.match(preview.out, /cannot be chained|cannot chain/i, 'the refusal to chain must be stated');
    assert.match(preview.out, /replace/i, 'and it must say what --yes will do instead');
    assert.equal(existsSync(SAVED_COPY), false);

    const applied = run(['statusline', 'install', '--settings', file, '--yes'], dir);
    assert.equal(applied.code, 0, applied.out);
    const backup = JSON.parse(
      readFileSync(SAVED_COPY, 'utf8'),
    ) as { previous: { command: string } };
    assert.equal(backup.previous.command, "bash -c 'echo hi'", 'the saved copy must survive verbatim');

    const result = bridge(dir, 'sess-unparseable');
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout, /ctx 23\.5%/,
      'an unparseable command must never be run — the bridge prints its own line instead',
    );
  } finally {
    removeTree(dir);
  }
});

test('install PREVIEWS the exact argv it would delegate to, before any consent is given', () => {
  const dir = project();
  try {
    const file = settingsWith(dir, delegateScript(dir, 'theirs.mjs', ECHOES_STDIN));
    const { code, out } = run(['statusline', 'install', '--settings', file], dir);
    assert.equal(code, 0, out);
    assert.match(out, /delegate/i);
    assert.match(out, /theirs\.mjs/, 'the argv that will actually run must be shown');
  } finally {
    removeTree(dir);
  }
});

/* -------------------------------------------------------------------- *
 * 6. uninstall still restores exactly what was there.                   *
 * -------------------------------------------------------------------- */

test('chaining does not corrupt the saved copy: the round trip is still byte-identical', () => {
  const dir = project();
  try {
    const command = delegateScript(dir, 'theirs.mjs', ECHOES_STDIN);
    const file = path.join(dir, 'settings.json');
    const before = '{\n    "model": "opus",\n    "statusLine": {\n        "type": "command",\n'
      + `        "command": ${JSON.stringify(command)}\n    },\n    "verbose": true\n}`;
    writeFileSync(file, before, 'utf8');

    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);
    assert.match(bridge(dir, 'sess-round').stdout, /THEIRS/, 'the delegate never ran');

    const { code, out } = run(['statusline', 'uninstall', '--settings', file, '--yes'], dir);
    assert.equal(code, 0, out);
    assert.equal(readFileSync(file, 'utf8'), before, 'the user did not get their file back');
  } finally {
    removeTree(dir);
  }
});

/* -------------------------------------------------------------------- *
 * Re-runnable: install must never chain the bridge to itself.           *
 * -------------------------------------------------------------------- */

test('looksLikeOurBridge recognises the bridge under the spellings it can be written in', () => {
  assert.equal(looksLikeOurBridge(['mycontext', 'statusline']), true);
  assert.equal(looksLikeOurBridge(['mycontext.cmd', 'statusline']), true);
  assert.equal(looksLikeOurBridge(['node', CLI, 'statusline']), true);
  assert.equal(
    looksLikeOurBridge(['node', '/elsewhere/my-context/src/cli/index.ts', 'statusline']), true,
  );
  assert.equal(looksLikeOurBridge(['mycontext', 'status']), false);
  assert.equal(looksLikeOurBridge(['starship', 'prompt']), false);
  assert.equal(looksLikeOurBridge(['node', 'gsd-statusline.js']), false);
});

test('installing over a bridge spelled another way is REFUSED — it would delegate to itself forever', () => {
  const dir = project();
  try {
    const file = settingsWith(dir, `node ${CLI} statusline`);
    const before = readFileSync(file, 'utf8');
    const { code, out } = run(['statusline', 'install', '--settings', file, '--yes'], dir);
    assert.equal(code, 1, out);
    assert.match(out, /itself|already/i);
    assert.equal(readFileSync(file, 'utf8'), before, 'a self-chaining install was written anyway');
    assert.equal(existsSync(SAVED_COPY), false);
  } finally {
    removeTree(dir);
  }
});

test('a second install over our own entry stays a no-op, and the delegate stays the real one', () => {
  const dir = project();
  try {
    const command = delegateScript(dir, 'theirs.mjs', ECHOES_STDIN);
    const file = settingsWith(dir, command);
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);
    const second = run(['statusline', 'install', '--settings', file, '--yes'], dir);
    assert.equal(second.code, 0, second.out);
    assert.match(second.out, /already installed/i);

    const backup = JSON.parse(
      readFileSync(SAVED_COPY, 'utf8'),
    ) as { previous: { command: string } };
    assert.equal(backup.previous.command, command, 'the second install ate the real previous value');
    assert.match(bridge(dir, 'sess-twice').stdout, /THEIRS/);
  } finally {
    removeTree(dir);
  }
});
