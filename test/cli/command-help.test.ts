// @basis TASK-asking-a-command-for-help-exits-1-on-all-38-commands-that, CONST-the-cli-exit-code-contract, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`mycontext <command> --help` prints that command's help and exits 0.**
 *
 * ── WHAT WAS MEASURED, AND WITH WHAT ───────────────────────────────────────
 *
 * 2026-09-14, by spawning the real binary once per registered command and
 * reading `spawnSync(...).status`: **47 of the 48 registered commands exited 1
 * on `--help`.** 41 of them printed the right usage block behind the line
 * `my_context: unknown option "--help".`; the other six were refused about
 * something else entirely (`show` → `no item with id "--help"`, `pack` →
 * `unknown pack subcommand ""`, `help` → the topic enum, `init` and `repair`
 * and `query` → their own wordings). The forty-eighth, `rebuild`, exited 0 and
 * swallowed the flag without a word.
 *
 * The item was filed as "all 38 commands that take flags", which was the count
 * of ONE of those wordings on the day it was written. **This file states no
 * number**, because a number in a test is the hand-kept figure this repository
 * keeps finding stale: the sweep below is driven by `COMMANDS` and covers
 * whatever is registered on the day it runs.
 *
 * ── THE FOUR WAYS THIS COULD PASS WITHOUT MEANING ANYTHING ─────────────────
 *
 * Each has its own assertion, because each fails differently:
 *
 *   1. **Everything exits 0 anyway.** The sweep would be vacuous on a binary
 *      that never fails. `the detector can see a red` probes the same commands
 *      with a sentinel flag and requires a non-zero from every one that has a
 *      parser — in the SAME run, so a green sweep is only ever read beside a
 *      red the same fixture produced.
 *   2. **The banner is printed for everything.** Exit 0 with the whole CLI
 *      usage would satisfy a code-only assertion while answering nothing. The
 *      sweep requires the first line to be THIS command's registry usage.
 *   3. **The page is empty.** A `--help` that prints a usage line and no flags
 *      is a page nobody can use. The flag rows are compared against
 *      `COMMAND_FLAGS` in both directions.
 *   4. **`--help` is read where it is a VALUE.** `mycontext audit --item
 *      --help` is a mistyped item id, not a request for help, and answering it
 *      with a help page would be the dropped-token defect in a new place.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { asksForHelp } from '../../src/cli/command-help.ts';
import { COMMAND_FLAGS, SUBCOMMAND_FLAGS } from '../../src/core/command-flags.ts';
import { spawnCli } from '../helpers/spawn-cli.ts';
import { removeTree } from '../helpers/tmp.ts';

/** A flag no command accepts — the red this run has to be able to see. */
const SENTINEL = '--zzz-not-a-flag-any-command-accepts';

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-cmdhelp-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0, 'the probe workspace did not initialize');
  return cwd;
}

function run(argv: string[], cwd: string): { code: number; out: string } {
  const lines: string[] = [];
  const code = runCli(argv, cwd, (s) => lines.push(s));
  return { code, out: lines.join('\n') };
}

/* ══ 1. EVERY REGISTERED COMMAND, AND THE RED BESIDE THE GREEN ════════════ */

/**
 * In-process rather than spawned, and the reason is arithmetic: one spawn of
 * this binary costs about a second on the reference machine, and 48 of them
 * would be 48 seconds against a 60-second timeout — a sweep that would go red
 * for being slow rather than for being wrong. `runCli` returns the command's
 * own code directly, with no channel in between; the process-level claim that
 * `runCli`'s number actually reaches the operating system is made separately
 * and deliberately below.
 */
test('every registered command answers --help at exit 0, and the detector can see a red', () => {
  const cwd = project();
  try {
    const names = [...COMMANDS.keys()].sort();
    assert.ok(names.length >= 40, `the registry sweep found only ${names.length} commands`);

    const wrongCode: string[] = [];
    const wrongPage: string[] = [];
    for (const name of names) {
      const { code, out } = run([name, '--help'], cwd);
      if (code !== 0) { wrongCode.push(`${name}: exited ${code}`); continue; }
      // Ways 2 and 3 of the four above, in one line: the page must open with
      // the command's OWN usage, taken off its registration rather than
      // written here — a banner, or another command's page, fails this.
      const expected = `usage: mycontext ${COMMANDS.get(name)?.usage ?? ''}`;
      if (!out.startsWith(expected)) wrongPage.push(`${name}: began ${JSON.stringify(out.slice(0, 60))}`);
    }
    assert.deepEqual(
      wrongCode, [],
      'a command still reports failure for being asked how to use it. Every wrapper, Makefile '
      + 'and agent that checks the status of --help concludes that command does not exist.',
    );
    assert.deepEqual(
      wrongPage, [],
      'a command answered --help at exit 0 with something that is not its own usage line. '
      + 'Exit 0 over the wrong page is the same defect with the status fixed.',
    );

    // ANTI-VACUITY, in the same run and over the same fixture: if this binary
    // simply exited 0 for everything, the sweep above would be worthless. Only
    // commands with a parser are required to redden — `rebuild` swallows an
    // unknown flag by design (`FLAGLESS_DISPOSITION`, command-flags.test.ts),
    // and requiring a refusal from it would be asserting a behaviour change
    // nobody made.
    const parsers = names.filter(
      (n) => Object.hasOwn(COMMAND_FLAGS, n) || Object.hasOwn(SUBCOMMAND_FLAGS, n),
    );
    const blind = parsers.filter((n) => run([n, SENTINEL], cwd).code === 0);
    assert.deepEqual(
      blind, [],
      'these commands exited 0 for a flag no command accepts, so the sweep above proved '
      + 'nothing about them: it cannot tell a fixed --help from a binary that never fails.',
    );
  } finally { removeTree(cwd); }
});

/* ══ 2. THE NUMBER THE OPERATING SYSTEM SEES ══════════════════════════════ */

/**
 * **Five commands, one per SHAPE, run as real processes.**
 *
 * `runCli` returning 0 is not the claim a script cares about — the claim is
 * that 0 reaches the caller. The entry block in `src/cli/index.ts` assigns
 * `process.exitCode` and a later stdout verdict may raise it, and both of
 * those have been wrong before (see `test/helpers/spawn-cli.ts`). So the shape
 * of every dispatch path is spawned once: a flat spec, a subcommanded command,
 * the per-workspace one, the flagless one, and the bare one that runs before
 * the workspace is resolved at all.
 */
test('--help exits 0 as a PROCESS, on one command of every dispatch shape', () => {
  const cwd = project();
  try {
    const shapes: [string, string][] = [
      ['add', 'a flat spec in COMMAND_FLAGS'],
      ['pack', 'a subcommanded command'],
      ['edit', 'the per-workspace surface'],
      ['rebuild', 'flagless, and it used to swallow the token'],
      ['init', 'workspace: none — dispatched before resolveWorkspace'],
    ];
    for (const [name, why] of shapes) {
      const spawned = spawnCli([name, '--help'], cwd);
      assert.equal(
        spawned.status, 0,
        `\`mycontext ${name} --help\` left the process at ${spawned.status} (${why}). This is `
        + 'read from spawnSync().status, so it is the number a caller\'s shell reports.',
      );
      assert.match(
        spawned.stdout, new RegExp(`^usage: mycontext ${name}\\b`),
        `\`mycontext ${name} --help\` printed something other than its own usage`,
      );
    }
  } finally { removeTree(cwd); }
});

/* ══ 3. THE PAGE IS THE COMMAND'S REAL FLAG SURFACE ═══════════════════════ */

/**
 * Way 3 of the four, checked in both directions and DERIVED: a flag the page
 * omits is a flag a reader cannot find, and a flag the page invents composes a
 * command line the CLI refuses. The expected set is `COMMAND_FLAGS` itself —
 * the table `refuseUnknownFlag` is handed — so this cannot be satisfied by a
 * second list kept in step by hand.
 */
test('the page lists exactly the flags the parser accepts, for every flat spec', () => {
  const cwd = project();
  try {
    const problems: string[] = [];
    for (const [name, spec] of Object.entries(COMMAND_FLAGS)) {
      if (!COMMANDS.has(name)) continue;
      const { out } = run([name, '--help'], cwd);
      for (const flag of spec.allowed) {
        if (!new RegExp(`^\\s+--${flag}(\\s|$)`, 'm').test(out)) {
          problems.push(`${name}: --${flag} is accepted and the page does not list it`);
        }
      }
      const listed = [...out.matchAll(/^ {2}--([a-z][a-z-]*)/gm)].map((m) => m[1]);
      for (const flag of new Set(listed)) {
        if (!spec.allowed.includes(flag)) {
          problems.push(`${name}: the page lists --${flag} and the command refuses it`);
        }
      }
    }
    assert.deepEqual(
      problems, [],
      'the help page and the parser disagree about what a command takes. Both directions are '
      + 'failures and they fail differently: a missing row is help a reader cannot find, and an '
      + 'invented row composes a command line the CLI rejects.',
    );
  } finally { removeTree(cwd); }
});

/* ══ 4. A `--help` IN A VALUE SLOT IS A VALUE ═════════════════════════════ */

/**
 * Way 4. `asksForHelp` walks argv with the identical value-flag skip
 * `unknownFlag` and `positionals` use, and the unit assertions below are what
 * hold the three walks together — a disagreement between them is how a flag
 * comes to be honoured by one gate and missed by another.
 */
test('--help sitting in another flag\'s value slot is a value, not a request for help', () => {
  assert.equal(asksForHelp(['--help']), true, 'a bare --help is a request for help');
  assert.equal(asksForHelp(['--help=anything']), true, 'the NAME is what was typed');
  assert.equal(asksForHelp(['ID', '--json', '--help'], []), true);
  assert.equal(
    asksForHelp(['--item', '--help'], ['item']), false,
    '--help was the VALUE of --item: a mistyped id, and answering it with a help page would be '
    + 'a second gate disagreeing with the parser about one argv',
  );
  assert.equal(
    asksForHelp(['--item=x', '--help'], ['item']), true,
    '--item=x carries its own value, so it consumes no following token',
  );
  assert.equal(asksForHelp([], []), false);

  // And end to end, because a unit answer about `asksForHelp` is not an answer
  // about the boundary that calls it: `audit --item --help` must still be the
  // audit report, not a help page.
  const cwd = project();
  try {
    const { code, out } = run(['audit', '--item', '--help'], cwd);
    assert.equal(code, 0, 'the audit report over an id that matches nothing is an empty result');
    assert.doesNotMatch(
      out, /^usage: mycontext audit/,
      'a --help read out of a value slot printed the help page, which means the boundary and '
      + 'the parser now disagree about which token is a value',
    );
  } finally { removeTree(cwd); }
});

/* ══ 5. HELP SURVIVES A CORPUS IT CANNOT OPEN ═════════════════════════════ */

/**
 * Help is the one answer that must not depend on the corpus being readable —
 * a caller asking how to use a command is very often a caller whose last
 * command failed. `init --help` in a bare directory exercises exactly that:
 * no workspace exists, `resolveWorkspace` would throw, and the page is still
 * printed at exit 0.
 */
test('--help answers outside a workspace, where every other command refuses', () => {
  const bare = mkdtempSync(path.join(tmpdir(), 'myctx-nohelp-'));
  try {
    const helped = run(['init', '--help'], bare);
    assert.equal(helped.code, 0);
    assert.match(helped.out, /^usage: mycontext init \[--pack <path>\]/);

    // The contrast that makes the line above mean something: a command that is
    // not asking for help still fails here, so exit 0 was about `--help` and
    // not about this directory being a place where everything succeeds.
    assert.equal(
      run(['list'], bare).code, 1,
      'a bare directory answered `list` at 0, so the assertion above proved nothing',
    );
  } finally { removeTree(bare); }
});
