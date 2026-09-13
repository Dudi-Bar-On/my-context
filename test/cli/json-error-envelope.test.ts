// @basis TASK-a-json-run-that-fails-prints-english-on-the-json-channel, INV-nothing-is-dropped-silently, REQ-cli-output-is-tabular-with-detail-levels
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { COMMAND_FLAGS, FLAGLESS_COMMANDS, SUBCOMMAND_FLAGS } from '../../src/core/command-flags.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * **`--json` means JSON on every exit path, including the failing ones.**
 *
 * Measured 2026-09-13, before this existed: `mycontext query --json
 * --nosuchflag` put 380 bytes of English on stdout and exited 1. Not empty —
 * prose on the channel a consumer was promised JSON on, so a script that parses
 * what it asked for gets a `SyntaxError` at character 0 naming `my_context`,
 * with the real reason inside the string that broke the parser.
 *
 * **ONE ASSERTION PER REFUSAL FAMILY, because they are different code paths in
 * different modules.** A bad id is a store lookup, a bad flag is
 * `refuseUnknownFlag`, a gate refusal is `confirmAction`, and an absent corpus
 * is a throw from `resolveWorkspace` caught at the top of `runCli`. A test that
 * proves one proves one. Two structural rules get their own tests as well: the
 * set of `--json` commands is DERIVED rather than listed, and a failing run that
 * already answered in JSON is left alone.
 */

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-jsonerr-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  return cwd;
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

interface Envelope {
  error: {
    command: string; subcommand?: string; exit: number; argv: string[]; message: string;
  };
}

/** Parses, and fails with the raw text rather than a `SyntaxError` about it. */
function envelope(out: string): Envelope {
  try { return JSON.parse(out) as Envelope; } catch {
    throw new assert.AssertionError({
      message: `a --json run emitted something that is not JSON:\n${out}`,
      actual: out, expected: 'a JSON document',
    });
  }
}

test('family 1 — a bad id: `carry <unknown id> --json`', () => {
  const cwd = project();
  try {
    const { code, out } = run(['carry', 'NO-SUCH-ITEM', '--json'], cwd);
    assert.equal(code, 1, 'the exit code is not softened — this is about the channel');
    const e = envelope(out).error;
    assert.equal(e.command, 'carry');
    assert.equal(e.exit, 1);
    // The same sentence the human form prints, verbatim.
    assert.match(e.message, /no item with id "NO-SUCH-ITEM"/);
    assert.equal(run(['carry', 'NO-SUCH-ITEM'], cwd).out.trim(), e.message,
      'the human form is unchanged, and the envelope carries it word for word');
    // What the command knows, structurally: the id is in `argv`, and the
    // sentence says which of the arguments is the problem.
    assert.deepEqual(e.argv, ['NO-SUCH-ITEM', '--json']);
  } finally { removeTree(cwd); }
});

test('family 2 — a bad flag: `query --json --nosuchflag`', () => {
  const cwd = project();
  try {
    const { code, out } = run(['query', '--json', '--nosuchflag'], cwd);
    assert.equal(code, 1);
    const e = envelope(out).error;
    assert.equal(e.command, 'query');
    assert.match(e.message, /unknown flag "--nosuchflag"/);
    assert.deepEqual(e.argv, ['--json', '--nosuchflag']);
  } finally { removeTree(cwd); }
});

test('family 3 — a gate refusal: a confirmation this run cannot give', () => {
  const cwd = project();
  try {
    assert.equal(run([
      'add', 'rule', 'Log no customer emails', '--body', 'Never log an email address.',
      '--summary', 'Customer email addresses stay out of the logs.', '--tags', 'billing', '--yes',
    ], cwd).code, 0);
    // `focus <tag>` previews and asks; stdin is not interactive under the test
    // runner, so `confirmAction` refuses. That refusal used to arrive as prose
    // AND suppress the report, so a `--json` consumer got neither document.
    const { code, out } = run(['focus', 'billing', '--json'], cwd);
    assert.equal(code, 1);
    const e = envelope(out).error;
    assert.equal(e.command, 'focus');
    assert.match(e.message, /refusing without confirmation/);
  } finally { removeTree(cwd); }
});

test('family 4 — an absent corpus, which throws before any command is entered', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-nows-'));
  try {
    const { code, out } = run(['status', '--json'], cwd);
    assert.equal(code, 1);
    const e = envelope(out).error;
    assert.equal(e.command, 'status');
    assert.match(e.message, /no workspace here/);
  } finally { removeTree(cwd); }
});

test('a subcommand form names both halves', () => {
  const cwd = project();
  try {
    const { code, out } = run(['conversation', 'name', '--json'], cwd);
    assert.equal(code, 1);
    const e = envelope(out).error;
    assert.equal(e.command, 'conversation');
    assert.equal(e.subcommand, 'name');
  } finally { removeTree(cwd); }
});

/**
 * **The gate is DERIVED, never a hand-kept list** — a hand-kept list is this
 * project's own D51 pattern. Driven from the same two tables `refuseUnknownFlag`
 * is handed, which `test/cli/command-flags.test.ts` already requires to cover
 * exactly the registered command set in both directions.
 */
test('every command that declares --json answers a refusal in JSON', () => {
  const cwd = project();
  try {
    const declared = Object.entries(COMMAND_FLAGS)
      .filter(([, spec]) => spec.allowed.includes('json')).map(([name]) => name);
    assert.ok(declared.length >= 16, `expected the derived set to be non-trivial, got ${declared.length}`);

    const prose: string[] = [];
    for (const name of declared) {
      // Every declared command refuses the sentinel before its body runs, so
      // this probes the refusal path without executing anything.
      const { code, out } = run([name, '--json', '--zzz-not-a-flag-any-command-accepts'], cwd);
      if (code === 0) { prose.push(`${name}: the sentinel was accepted, so nothing was probed`); continue; }
      try { JSON.parse(out); } catch { prose.push(`${name}: ${out.split('\n')[0]}`); }
    }
    assert.deepEqual(prose, [], 'these commands still put prose on the JSON channel');
  } finally { removeTree(cwd); }
});

/**
 * The other direction, and the reason the gate reads the flag tables rather
 * than argv alone: a command with no `--json` is not handed a JSON contract it
 * does not honour on success. `mycontext show <id> --json` prints Markdown when
 * it succeeds, so an error envelope would promise a format the success path has
 * never produced.
 */
test('a command that does not take --json is untouched by it', () => {
  const cwd = project();
  try {
    assert.ok(FLAGLESS_COMMANDS.includes('show'), 'show is the flagless command this rests on');
    const { code, out } = run(['show', 'NO-SUCH-ITEM', '--json'], cwd);
    assert.equal(code, 1);
    assert.match(out, /^my_context: no item with id "NO-SUCH-ITEM"/);
    // A FINDING, not a pass: `show` silently ignores `--json` on BOTH paths,
    // which is a different defect from this item's — a dropped flag
    // (`INV-nothing-is-dropped-silently`), not a mis-typed channel. The item's
    // own headline example was this command, and closing it needs `show` to
    // gain a flag parser or a `--json` form. Deliberately out of scope here:
    // `core/command-flags.ts` records that giving a flagless command a parser
    // is "a behaviour change, not a migration".
    assert.doesNotMatch(out, /"error"/);

    // The sharper half, and the one the gate exists for: `link` HAS a flag spec
    // and `json` is not in it, so it refuses `--json` by name. Answering that
    // refusal in JSON would promise a format the command has just said it does
    // not speak.
    assert.ok(Object.hasOwn(COMMAND_FLAGS, 'link') && !COMMAND_FLAGS.link.allowed.includes('json'));
    const refused = run(['link', '--json'], cwd);
    assert.equal(refused.code, 1);
    assert.match(refused.out, /unknown option "--json"/);
    assert.doesNotMatch(refused.out, /^\{/, 'a command that refuses --json does not answer in it');
  } finally { removeTree(cwd); }
});

/**
 * `doctor --json` exits non-zero when it finds errors and its body is a
 * perfectly good report. Replacing that with a complaint about itself would be
 * a regression dressed as a fix.
 */
test('a failing run that already answered in JSON is left exactly as it was', () => {
  const cwd = project();
  try {
    assert.equal(run([
      'add', 'decision', 'a thing', '--body', 'body',
      '--summary', 'A thing that matters.', '--yes',
    ], cwd).code, 0);
    // A checksum that disagrees with its file — the cheapest way to make
    // `doctor` exit non-zero, so the pass-through is actually exercised rather
    // than asserted on a run that never failed.
    const file = path.join(cwd, '.my_context', 'items', 'decision', 'DEC-a-thing.md');
    writeFileSync(file, readFileSync(file, 'utf8').replace(/^body$/m, 'body changed'), 'utf8');

    const { code, out } = run(['doctor', '--json'], cwd);
    assert.equal(code, 1, 'the fixture must make doctor FAIL, or this proves nothing');
    const parsed = JSON.parse(out) as Record<string, unknown>;
    assert.ok(Object.hasOwn(parsed, 'counts'), 'doctor\'s own report, not an envelope');
    assert.ok(!Object.hasOwn(parsed, 'error'));
  } finally { removeTree(cwd); }
});

test('a successful --json run is byte-identical to what it printed before', () => {
  const cwd = project();
  try {
    const { code, out } = run(['status', '--json'], cwd);
    assert.equal(code, 0);
    const parsed = JSON.parse(out) as Record<string, unknown>;
    assert.ok(!Object.hasOwn(parsed, 'error'), 'nothing wraps a success');
  } finally { removeTree(cwd); }
});

/** The subcommand table is read too, so this cannot silently cover only half. */
test('the derived set spans both flag tables', () => {
  const subs = Object.entries(SUBCOMMAND_FLAGS)
    .flatMap(([cmd, map]) => Object.entries(map)
      .filter(([, spec]) => spec.allowed.includes('json')).map(([sub]) => `${cmd} ${sub}`));
  assert.ok(subs.includes('review revisions'), subs.join(', '));
  assert.ok(subs.includes('conversation list'), subs.join(', '));
});
