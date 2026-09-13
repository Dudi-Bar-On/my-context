// @basis TASK-statusline-install-turns-an-unreadable-settings-file-into-an, INV-nothing-is-dropped-silently
/**
 * **`statusline install` must not turn a settings file it cannot READ into one
 * that was never THERE.**
 *
 * ── WHAT WAS REPRODUCED, AND HOW ──────────────────────────────────────────
 *
 * The item this file rests on was filed `inferred — reproduce first`: the
 * mechanism was traced in the source and the trigger was never made to happen.
 * It was made to happen on 2026-09-13, on Windows 11, at a throwaway path. A
 * second process held the settings file open with `FileShare::Write` — what an
 * editor, a sync client or an indexer does, and which still permits WRITERS —
 * and `readFileSync` threw `EBUSY` while `writeFileSync` succeeded. The install
 * printed `Current statusLine: (none)`, printed `Installed.`, exited 0, and
 * left a file holding the `statusLine` key alone: `permissions`, `hooks`,
 * `env`, `model` and `mcpServers` gone, with `previousText: null` saved so
 * `uninstall` had nothing to put back. That run is reproduced below, gated on
 * win32 because the lock is; `EISDIR` carries the same assertions everywhere.
 *
 * ── WHY THE TWO PROOFS ARE KEPT APART ─────────────────────────────────────
 *
 * There are two defects, not one, and fixing either alone still loses the file:
 *
 *   A. **The read collapsed UNREADABLE into ABSENT.** `readSettings` caught
 *      every errno and answered `{ ok: true, text: null, value: {} }`, so the
 *      install serialised `{ ...{}, statusLine }` over the whole document.
 *   B. **`previousText: null` is an INSTRUCTION, not a missing field.**
 *      `uninstall`'s `removesFile` reads it as *"this install created the file,
 *      so undoing the install deletes it"* and calls `rmSync`. A `null` written
 *      about a file that existed does not merely fail to restore — it
 *      authorises a delete.
 *
 * So `A` is proved against `readSettings` and `B` against `absenceIsUnproven`,
 * each with a removal proof that reddens on its OWN half and stays green on the
 * other. The end-to-end assertions at the bottom rest on both and say so.
 *
 * ── WHY HOME IS REDIRECTED AT THE TOP ─────────────────────────────────────
 *
 * `install --yes` files its saved copy under `Workspace.globalRoot`, which is
 * `path.join(homedir(), '.my-context')` resolved ONCE at module load. Running
 * these tests without moving `homedir()` first writes into the developer's real
 * global directory — which this lane did, once, while reproducing the defect,
 * and had to undo by hand. `test/cli/statusline.test.ts` carries the longer
 * version of this note.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';

const home = mkdtempSync(path.join(tmpdir(), 'myctx-slur-home-'));
process.env.HOME = home;
process.env.USERPROFILE = home;
delete process.env.CLAUDE_CONFIG_DIR;

const { runCli } = await import('../../src/cli/index.ts');
const { GLOBAL_DIR } = await import('../../src/core/workspace.ts');
const { absenceIsUnproven, readSettings } =
  await import('../../src/cli/commands/statusline-install.ts');

test('the fake home took effect — otherwise every install assertion below is vacuous', () => {
  assert.equal(GLOBAL_DIR, path.join(home, '.my-context'));
});

/** A settings file with the five things a user would actually lose. */
const REAL_SETTINGS = `${JSON.stringify({
  permissions: { allow: ['Bash(git status)'], deny: ['Bash(rm -rf /)'] },
  hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo hi' }] }] },
  env: { SOME_PATH: 'D:/keys' },
  model: 'opus',
  mcpServers: { demo: { command: 'node', args: ['x.js'] } },
}, null, 2)}\n`;

function sandbox(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-slur-'));
  assert.equal(runCli(['init'], dir, () => {}), 0);
  return dir;
}

/** The saved-copy store, as it is on disk, or `null` when there is none. */
function savedCopies(): Record<string, { previousText: string | null }> | null {
  const file = path.join(GLOBAL_DIR, 'statusline-replaced.json');
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, { previousText: string | null }>;
}

/* ══════════════════════════════════════════════════════════════════════ *
 * PROOF A — the READ tells "not there" apart from "could not be read".   *
 *                                                                        *
 * Removal proof: restore the bare `} catch { return { ok: true, text:    *
 * null, value: {} }; }` in `readSettings` and A1 reddens. `absenceIs-    *
 * Unproven` is untouched by it, and B1–B3 stay green — which is the      *
 * whole reason the two live apart.                                       *
 * ══════════════════════════════════════════════════════════════════════ */

test('A1 · a settings file that exists and cannot be read is REFUSED, not read as absent', (t) => {
  const dir = sandbox();
  t.after(() => removeTree(dir));
  // Unreadable for a reason other than absence, on every platform: a directory
  // where a file is expected. `readFileSync` throws `EISDIR`; `statSync`
  // succeeds, so the path demonstrably EXISTS. That pairing is the defect's
  // whole shape — something is there, and the command cannot see it.
  const settings = path.join(dir, 'settings.json');
  mkdirSync(settings);

  const out: string[] = [];
  const result = readSettings(settings, (s) => out.push(s));

  assert.equal(result.ok, false, 'an unreadable settings file must be refused');
  const said = out.join('\n');
  assert.match(said, /could not be read/, 'the refusal names what went wrong');
  assert.match(said, /EISDIR/, 'and names the errno, so the user can act on it');
  assert.match(said, /Nothing was written/, "the parse branch's own promise, kept here too");
});

test('A2 · a settings file that is genuinely ABSENT is still a state to install into', (t) => {
  const dir = sandbox();
  t.after(() => removeTree(dir));
  const settings = path.join(dir, 'does-not-exist', 'settings.json');

  const out: string[] = [];
  const result = readSettings(settings, (s) => out.push(s));

  // The narrowing must not have become a refusal to install on a fresh
  // machine, which is the one case the original docstring argued for.
  assert.equal(result.ok, true);
  assert.deepEqual(result, { ok: true, text: null, value: {} });
  assert.deepEqual(out, [], 'nothing is disclosed about a file that was never there');
});

/* ══════════════════════════════════════════════════════════════════════ *
 * PROOF B — `previousText: null` is never claimed about a file that was  *
 * there.                                                                 *
 *                                                                        *
 * Removal proof, RUN rather than asserted (2026-09-13): make                *
 * `absenceIsUnproven` return `false` and B1 reddens while A1/A2 stay green.  *
 * The end-to-end test below stays GREEN on that removal — and that is a      *
 * FINDING, not a pass: with the narrowed read in place the guard is not      *
 * reached through this command's normal path. It earns its keep on the       *
 * removals that matter, measured the same day: with `readSettings` widened   *
 * back AND this guard removed the end-to-end test reddens and the fixture's  *
 * settings file is destroyed; with either half alone it is green and the     *
 * file survives. Neither fix is redundant; each is sufficient.               *
 * ══════════════════════════════════════════════════════════════════════ */

test('B1 · a file that is THERE but unread makes `previousText: null` an unproven claim', (t) => {
  const dir = sandbox();
  t.after(() => removeTree(dir));
  const present = path.join(dir, 'settings.json');
  mkdirSync(present); // exists; `statSync` succeeds; bytes unavailable

  assert.equal(absenceIsUnproven(present, null), true);
});

test('B2 · a path that is genuinely absent proves absence, so the install proceeds', (t) => {
  const dir = sandbox();
  t.after(() => removeTree(dir));

  assert.equal(absenceIsUnproven(path.join(dir, 'nope.json'), null), false);
});

test('B3 · bytes in hand are their own proof — the guard does not fire on a normal install', (t) => {
  const dir = sandbox();
  t.after(() => removeTree(dir));
  const settings = path.join(dir, 'settings.json');
  writeFileSync(settings, REAL_SETTINGS, 'utf8');

  assert.equal(absenceIsUnproven(settings, REAL_SETTINGS), false);
});

test('B4 · `previousText: null` is what tells uninstall it may DELETE the file', (t) => {
  // This is why B1 matters, and it is asserted rather than asserted-about: the
  // `null` is not an absent field, it is a live instruction. A test that only
  // checked "the backup is empty" would be describing the symptom.
  const dir = sandbox();
  t.after(() => removeTree(dir));
  const settings = path.join(dir, 'settings.json'); // genuinely absent

  assert.equal(runCli(['statusline', 'install', '--settings', settings, '--yes'], dir, () => {}), 0);
  const saved = savedCopies();
  assert.ok(saved !== null, 'the install filed a saved copy');
  assert.equal(saved[path.resolve(settings)]?.previousText, null,
    'absent at install time is recorded as `null`');
  assert.equal(existsSync(settings), true, 'and the install created the file');

  assert.equal(runCli(['statusline', 'uninstall', '--settings', settings, '--yes'], dir, () => {}), 0);
  assert.equal(existsSync(settings), false,
    '`previousText: null` authorises `rmSync` — which is what makes a wrong `null` unrecoverable');
});

/* ══════════════════════════════════════════════════════════════════════ *
 * END TO END — rests on BOTH proofs above.                               *
 * ══════════════════════════════════════════════════════════════════════ */

test('an unreadable settings file survives the install, and no saved copy is invented', (t) => {
  const dir = sandbox();
  t.after(() => removeTree(dir));
  const settings = path.join(dir, 'settings.json');
  mkdirSync(settings);
  const before = savedCopies();

  const out: string[] = [];
  const code = runCli(['statusline', 'install', '--settings', settings, '--yes'], dir,
    (s) => out.push(s));

  assert.equal(code, 1, 'the install refuses rather than reporting success');
  // The OUTCOME, not one fix's wording. Either half of the fix refuses here
  // and they refuse in different sentences; asserting A's phrasing would make
  // this a test of `readSettings` wearing the end-to-end test's name — and it
  // did, until the removal proof on 2026-09-13 showed it reddening while the
  // fixture's file was in fact saved, by the other half, one line later.
  assert.match(out.join('\n'), /Nothing was written/,
    "the promise both refusals make, and the one the user acts on");
  assert.deepEqual(savedCopies(), before,
    'no entry is filed for a file this command never managed to read');
});

/* ══════════════════════════════════════════════════════════════════════ *
 * THE REPRODUCTION ITSELF — win32 only, because the lock is.             *
 * ══════════════════════════════════════════════════════════════════════ */

const LOCKER = `param([string]$Target)
$fs = [System.IO.File]::Open($Target, [System.IO.FileMode]::Open, ` +
  `[System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::Write)
Write-Output "LOCKED"
Start-Sleep -Seconds 45
$fs.Close()
`;

test('the Windows trigger, reproduced: a file held by another process is not overwritten',
  { skip: process.platform !== 'win32' ? 'the lock is a win32 sharing mode' : false },
  async (t) => {
    const dir = sandbox();
    const settings = path.join(dir, 'settings.json');
    writeFileSync(settings, REAL_SETTINGS, 'utf8');
    const script = path.join(dir, 'hold.ps1');
    writeFileSync(script, LOCKER, 'utf8');

    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Target', settings],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
    // Killed in `after`, not at the end of the body: a failed assertion must
    // not leave a PowerShell process holding a file for 45 seconds.
    t.after(() => { child.kill(); removeTree(dir); });

    const locked = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 20_000);
      child.stdout.on('data', (d: Buffer) => {
        if (String(d).includes('LOCKED')) { clearTimeout(timer); resolve(true); }
      });
      child.on('exit', () => { clearTimeout(timer); resolve(false); });
    });
    if (!locked) { t.skip('powershell could not take the lock on this machine'); return; }

    // The precondition IS the finding, so it is asserted rather than assumed:
    // the file is readable by nobody and writable by anybody.
    assert.throws(() => readFileSync(settings, 'utf8'), /EBUSY|EACCES|EPERM/);

    const out: string[] = [];
    const code = runCli(['statusline', 'install', '--settings', settings, '--yes'], dir,
      (s) => out.push(s));

    assert.equal(code, 1, 'the install refuses instead of reporting `Installed.`');
    assert.doesNotMatch(out.join('\n'), /Current statusLine: \(none\)/,
      'and never describes a file it could not read as having no status line');

    child.kill();
    await new Promise((r) => setTimeout(r, 1_500));
    assert.equal(readFileSync(settings, 'utf8'), REAL_SETTINGS,
      "the user's permissions, hooks, env, model and MCP servers are still there");
  });
