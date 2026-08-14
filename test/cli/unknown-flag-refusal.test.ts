import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { DETAIL_USAGE } from '../../src/cli/commands/format.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * README.md: "Every reporting command — `status`, `list`, `decay`,
 * `review list`, `doctor`, `ingest-status` — takes `--full`, `--short` … and
 * `--json`. An option none of them recognises is refused, not silently
 * ignored."
 *
 * That second sentence was false for five of the six. `unknownFlag` was called
 * from exactly two sites (`add` and `list`), so `status --ful`, `doctor --jso`,
 * `decay --bogus`, `review list --ful` and `ingest-status --ful` all exited 0
 * having printed the default rendering — the user asked for one thing, got
 * another, and was told nothing.
 *
 * This guard is REGISTRY-DRIVEN rather than a list of six names, for the same
 * reason `f2-registry.test.ts` is: a rule that lives in one prose sentence and
 * N hand-written call sites is exactly how this repository has repeatedly
 * shipped a claim only some of its commands satisfy. Any command whose own
 * usage string advertises the detail levels is required to refuse an option it
 * does not recognise, so a seventh reporting command cannot be added without
 * either the check or a deliberate change to this test.
 */

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-unkflag-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

/**
 * Registered commands that advertise the detail levels in their own usage
 * string — i.e. that claim to be reporting commands — plus the two the README
 * names that cannot be discovered that way:
 *
 * - `list` is still a hardcoded `case` in the dispatch switch rather than a
 *   registry entry (see `SHADOWED_BY_SWITCH`), so it is not in `COMMANDS`.
 * - `review`'s one-line registry usage is the SUBCOMMAND list; the detail
 *   flags live in the long `USAGE` block inside review.ts, because the usage
 *   column is 30 characters wide. `review` with no subcommand is `review
 *   list`, which is the reporting one.
 *
 * The discovery half is what makes this self-updating; the equality assertion
 * below is what stops the discovery half from silently matching nothing.
 */
const DISCOVERED = [...COMMANDS.values()]
  .filter((c) => c.usage.includes(DETAIL_USAGE))
  .map((c) => c.name)
  .sort();

const REPORTING = [...DISCOVERED, 'list', 'review'].sort();

test('the reporting commands this guard covers are the ones the README names', () => {
  assert.deepEqual(DISCOVERED, ['decay', 'doctor', 'ingest-status', 'status']);
  assert.deepEqual(REPORTING, ['decay', 'doctor', 'ingest-status', 'list', 'review', 'status']);
});

for (const name of REPORTING) {
  test(`${name} refuses an option it does not recognise`, () => {
    const cwd = project();
    try {
      const { code, out } = run([name, '--ful'], cwd);
      assert.equal(
        code, 1,
        `\`mycontext ${name} --ful\` exited ${code}: a typo'd detail flag that produces the ` +
        `default report is the wrong answer delivered confidently. Output:\n${out}`,
      );
      assert.match(out, /unknown option "--ful"/);
      assert.match(out, /usage: mycontext/, 'the refusal must say what the command does accept');
    } finally {
      removeTree(cwd);
    }
  });

  test(`${name} still accepts the flags it advertises`, () => {
    // The other half: a refusal that refuses everything is not a fix. Each
    // real flag must survive, or the check above is passing by breaking the
    // command.
    const cwd = project();
    try {
      for (const flag of ['--full', '--short', '--summary', '--json']) {
        const { code, out } = run([name, flag], cwd);
        assert.equal(code, 0, `\`mycontext ${name} ${flag}\` exited ${code}:\n${out}`);
        assert.doesNotMatch(out, /unknown option/);
      }
    } finally {
      removeTree(cwd);
    }
  });
}

test('doctor still accepts --quiet, which predates the detail levels', () => {
  const cwd = project();
  try {
    const { code, out } = run(['doctor', '--quiet'], cwd);
    assert.equal(code, 0, out);
    assert.doesNotMatch(out, /unknown option/);
  } finally {
    removeTree(cwd);
  }
});

test('decay still accepts --sessions with its value, and --all', () => {
  const cwd = project();
  try {
    for (const args of [['decay', '--sessions', '5'], ['decay', '--sessions=5'], ['decay', '--all']]) {
      const { code, out } = run(args, cwd);
      assert.equal(code, 0, `${args.join(' ')} exited ${code}:\n${out}`);
      assert.doesNotMatch(
        out, /unknown option/,
        'a value flag\'s VALUE must not be reported as an unknown option — that is the exact ' +
        'disagreement between this check and `positionals` the shared helper exists to prevent',
      );
    }
  } finally {
    removeTree(cwd);
  }
});

test('review list accepts --type with its value, and its mutating subcommands keep their own flags', () => {
  const cwd = project();
  try {
    const list = run(['review', 'list', '--type', 'requirement'], cwd);
    assert.equal(list.code, 0, list.out);
    assert.doesNotMatch(list.out, /unknown option/);

    // `promote`/`discard` are checked against their OWN flag sets, not a
    // union: a `--json` accepted on `promote` would be the same silent
    // swallow, on the subcommands that mutate.
    const promote = run(['review', 'promote', 'REQ-nope', '--json'], cwd);
    assert.equal(promote.code, 1);
    assert.match(promote.out, /unknown option "--json"/);

    const discard = run(['review', 'discard', 'REQ-nope', '--scope', 'a/**'], cwd);
    assert.equal(discard.code, 1);
    assert.match(discard.out, /unknown option "--scope"/);
  } finally {
    removeTree(cwd);
  }
});
