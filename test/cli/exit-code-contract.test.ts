// @basis CONST-the-cli-exit-code-contract, TASK-nothing-found-exits-0-in-six-commands-and-1-in-three-the, TASK-two-commands-exit-zero-for-work-that-was-entirely-refused, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **The exit code is an API, and this is the file that holds it to a written
 * contract rather than to nine habits.**
 *
 * ── WHAT WAS MEASURED, AND WHAT THE DEFECT ACTUALLY WAS ───────────────────
 *
 * "Nothing found" exited 0 in six commands and 1 in three. That split is
 * DEFENSIBLE — an empty result is not a failure, a missing target is — and the
 * item that filed it said the real defect twice over:
 *
 *   1. it was broken, in `rules list`, which exited 1 because a FILE was
 *      unreadable while the same damage to a corpus item is a warning at exit
 *      0 in the same binary; and
 *   2. **it was written down nowhere**, so there was nothing for a new command
 *      to be checked against and nothing a script author could read.
 *
 * The second is the one this file exists for. `CONST-the-cli-exit-code-
 * contract` states eight rules; `mycontext help cli` prints them where a
 * caller reads them; and the assertions below are the measurement of each.
 * **A contract that lives only in a test is the same defect in a new place**,
 * which is why the first test here is about the documents and not the binary.
 *
 * ── HOW THE EXIT CODES ARE READ ───────────────────────────────────────────
 *
 * Both ways, deliberately. `runCli` returns the command's own number directly
 * and is what the sweeps use, because one spawn of this binary costs about a
 * second and a 20-command sweep of spawns would time out rather than answer.
 * The claims stated AS exit codes in the item — the two that were 0 for work
 * that never happened — are additionally spawned, and read off
 * `spawnSync(...).status`, which is the number a caller's shell reports. See
 * `test/helpers/spawn-cli.ts` for why the difference is not pedantry.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { RULES_DIR_ENV } from '../../src/rules/deliver.ts';
import { entriesDir } from '../../src/rules/store.ts';
import { spawnCli } from '../helpers/spawn-cli.ts';
import { removeTree } from '../helpers/tmp.ts';

const CONTRACT = 'CONST-the-cli-exit-code-contract';

function workspace(prefix: string): string {
  const cwd = mkdtempSync(path.join(tmpdir(), prefix));
  assert.equal(runCli(['init'], cwd, () => {}), 0, 'the probe workspace did not initialize');
  return cwd;
}

function run(argv: string[], cwd: string): { code: number; out: string } {
  const lines: string[] = [];
  const code = runCli(argv, cwd, (s) => lines.push(s));
  return { code, out: lines.join('\n') };
}

/* ══ RULE 0 — THE CONTRACT IS WRITTEN WHERE A CALLER READS IT ═════════════ */

/**
 * **The assertion the item is actually about.** Both halves of the defect it
 * filed were repairs to code; the half it called the real one was that nothing
 * stated the rule. So the contract is required to exist in the corpus AND to
 * be printed by the command a script author runs — `mycontext help cli` — and
 * the rules it states are required to be the ones this file measures.
 */
test('the contract is a corpus item and `mycontext help cli` prints it', () => {
  const cwd = workspace('myctx-exit-doc-');
  try {
    // In THIS repository's own corpus, which is what dogfooding means here:
    // the item governs this project or it governs nothing.
    const repo = path.resolve(import.meta.dirname, '..', '..');
    const shown = run(['show', CONTRACT], repo);
    assert.equal(shown.code, 0, `${CONTRACT} is not in this project's corpus, so nothing states the rule`);
    assert.match(shown.out, /type: constraint/);
    assert.match(shown.out, /status: active/);

    // And on the surface a caller reaches. The SERVED output is what is
    // asserted, not the file: a section that exists in `src/help/topics/cli.md`
    // and never reaches a terminal is a document nobody reads, which is the
    // defect this item filed rather than a fix for it.
    const served = run(['help', 'cli'], cwd);
    assert.equal(served.code, 0, '`mycontext help cli` does not render at all');
    for (const [needle, why] of [
      [CONTRACT, 'the topic does not cite the item, so a reader cannot get from one to the other'],
      ['Exit codes', 'the topic has no exit-code section at all'],
      ['empty result is a result', 'rule 2 — the one the split was about — is not stated'],
      ['entirely refused', 'rule 4 — the two commands that exited 0 for refused work — is not stated'],
      ['disclosed, not failed', 'rule 5 — the damaged read — is not stated, and it is the broken one'],
    ] as [string, string][]) {
      assert.ok(served.out.includes(needle), `${why} — \`mycontext help cli\` does not say it`);
    }
  } finally { removeTree(cwd); }
});

/* ══ RULE 2 — AN EMPTY RESULT IS A RESULT ═════════════════════════════════ */

/**
 * The six-and-three split, measured as one table in one fresh workspace, so
 * the reader of a failure sees which side moved.
 *
 * Each row is a command whose answer here is genuinely "none", not one that
 * happens to exit 0 for another reason: the workspace was created a moment
 * ago and holds nothing at all.
 */
const EMPTY_RESULT: string[][] = [
  ['list'], ['search', 'zzz-nothing-matches-this'], ['query', 'SELECT id FROM items WHERE 0'],
  ['todo'], ['ready'], ['review'], ['audit'], ['decay'], ['status'],
  ['procedure', 'list'], ['pack', 'list'], ['session', 'list'], ['conversation', 'list'],
  ['ingest-status'], ['rules', 'list'], ['focus', '--show'], ['carry', '--show'],
];

test('every command whose answer is "none" exits 0 and says so', () => {
  const cwd = workspace('myctx-exit-empty-');
  try {
    const wrong: string[] = [];
    const silent: string[] = [];
    for (const argv of EMPTY_RESULT) {
      const { code, out } = run(argv, cwd);
      if (code !== 0) { wrong.push(`${argv.join(' ')}: exited ${code}`); continue; }
      // The other half of rule 2, and the reason it is one rule: an empty
      // answer printed as zero lines is indistinguishable from a command that
      // crashed before printing, which is the defect `0 item(s)` was added for.
      if (out.trim() === '') silent.push(argv.join(' '));
    }
    assert.deepEqual(
      wrong, [],
      'a command reported failure for finding nothing. An empty filter is a true answer to the '
      + `question that was asked — ${CONTRACT}, rule 2.`,
    );
    assert.deepEqual(
      silent, [],
      'a command answered "none" with no output at all, which a caller cannot tell from a '
      + 'command that died before printing.',
    );
  } finally { removeTree(cwd); }
});

/* ══ RULE 3 — A TARGET YOU NAMED THAT IS NOT THERE ════════════════════════ */

/**
 * The other side of the split, and it is asserted in the same file on purpose:
 * rules 2 and 3 are one decision read twice, and a repair that flattened
 * either into the other would pass one of these tests and fail the other.
 */
const ABSENT_TARGET: string[][] = [
  ['show', 'NO-SUCH-ITEM'],
  ['rules', 'show', 'NO-SUCH-ENTRY'],
  ['carry', 'NO-SUCH-ITEM'],
  ['refresh', 'NO-SUCH-ITEM'],
  ['supersede', 'NO-SUCH-ITEM', '--by', 'ALSO-NO-SUCH-ITEM'],
];

test('every command handed a target that is not there exits 1', () => {
  const cwd = workspace('myctx-exit-absent-');
  try {
    const wrong: string[] = [];
    for (const argv of ABSENT_TARGET) {
      const { code } = run(argv, cwd);
      if (code !== 1) wrong.push(`${argv.join(' ')}: exited ${code}`);
    }
    assert.deepEqual(
      wrong, [],
      'a command reported success for a target it could not find. The difference from rule 2 is '
      + `whose expectation was wrong — ${CONTRACT}, rule 3.`,
    );
  } finally { removeTree(cwd); }
});

/* ══ RULE 4 — ENTIRELY REFUSED IS A FAILURE, PARTLY REFUSED IS NOT ════════ */

const DOC = '# Password policy\n\nPasswords must be at least 12 characters.\n';

function ingestProject(): { cwd: string; session: string } {
  const cwd = workspace('myctx-exit-ingest-');
  mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  writeFileSync(path.join(cwd, 'docs', 'prd.md'), DOC, 'utf8');
  const opened = run(['ingest', 'docs/prd.md'], cwd);
  assert.equal(opened.code, 0, 'the ingest session was not opened');
  const match = /ING-[a-z0-9-]+/.exec(opened.out);
  assert.ok(match, `no session id in:\n${opened.out}`);
  return { cwd, session: match[0] };
}

/** One candidate the validator accepts. */
function good(): unknown {
  return {
    type: 'requirement', title: 'Passwords are at least 12 characters',
    body: 'Enforced at registration.',
    summary: 'A rule that passwords must be long enough to resist guessing.',
    quote: 'Passwords must be at least 12 characters.',
  };
}

/** One candidate the validator refuses — the category does not exist. */
function bad(title: string): unknown {
  return {
    type: 'nonsense-not-a-category', title, body: 'b',
    quote: 'Passwords must be at least 12 characters.',
  };
}

test('`ingest-apply` exits 1 when every candidate was rejected, and 0 when one landed', () => {
  const { cwd, session } = ingestProject();
  try {
    writeFileSync(path.join(cwd, 'all-bad.json'), JSON.stringify([bad('A'), bad('B')]), 'utf8');
    const refused = run(['ingest-apply', session, '--anchor', 'password-policy', '--file', 'all-bad.json'], cwd);
    assert.equal(
      refused.code, 1,
      'every candidate was rejected and the command reported success. A script that reads '
      + `nothing but the status was told the chunk had been applied — ${CONTRACT}, rule 4.`,
    );
    assert.match(refused.out, /created 0/, 'the fixture did not actually reject everything');
    assert.match(refused.out, /2 candidates rejected/);

    // THE ANTI-VACUITY HALF, and it is the half that makes rule 4 a rule
    // rather than "ingest-apply fails more now": the same command, the same
    // anchor, one good candidate beside the bad ones, still exits 0 and names
    // what it refused. Without this a repair that failed on ANY rejection
    // would pass the assertion above.
    writeFileSync(path.join(cwd, 'mixed.json'), JSON.stringify([good(), bad('C')]), 'utf8');
    const partial = run(['ingest-apply', session, '--anchor', 'password-policy', '--file', 'mixed.json'], cwd);
    assert.equal(
      partial.code, 0,
      'a partial apply reported failure. The items that were created really are in the corpus, '
      + 'and telling a caller nothing happened is the same lie in the other direction.',
    );
    assert.match(partial.out, /created 1/);
    assert.match(partial.out, /1 candidate rejected/);
  } finally { removeTree(cwd); }
});

/**
 * The pack fixture is built by RUNNING `mycontext export --as-pack` rather
 * than by assembling an artefact by hand. Two reasons, and the second is the
 * one that matters: a hand-built bundle is a second spelling of the artefact
 * format, and this test is not about the format; and an exported pack is what
 * a real caller imports, so the exit code measured is the one a real caller
 * sees.
 */
function packFixture(): { source: string; target: string; id: string } {
  const scratch = mkdtempSync(path.join(tmpdir(), 'myctx-exit-pack-'));
  const author = path.join(scratch, 'author');
  const target = path.join(scratch, 'target');
  mkdirSync(author); mkdirSync(target);
  assert.equal(runCli(['init'], author, () => {}), 0);
  assert.equal(runCli([
    'add', 'rule', 'never log secrets', '--body', 'Do not log secrets.',
    '--summary', 'Secrets must not reach the log.', '--yes',
  ], author, () => {}), 0);
  const source = path.join(scratch, 'pack');
  assert.equal(runCli([
    'export', '--out', source, '--as-pack', '--pack-name', 'probe', '--pack-version', '1.0.0',
  ], author, () => {}), 0, 'the pack was not exported');
  assert.equal(runCli(['init'], target, () => {}), 0);
  return { source, target, id: 'RULE-never-log-secrets' };
}

test('`pack import` exits 1 when nothing landed, and 0 when the same pack lands', () => {
  const { source, target, id } = packFixture();
  const scratch = path.dirname(source);
  try {
    // The green half FIRST, so the red below cannot be a fixture that never
    // worked: the very same pack, into the very same workspace, lands.
    const landed = run(['pack', 'import', source, '--yes'], target);
    assert.equal(landed.code, 0, 'the fixture pack does not import at all, so nothing below means anything');
    assert.match(landed.out, /imported 1 item\(s\)/);

    // Now make the one id the pack carries into a CHANGED item, so a second
    // import has nothing it can write: `imported` is empty and the id is left
    // exactly as it is.
    assert.equal(runCli([
      'edit', id, '--body', 'Something else entirely.',
      '--summary', 'A changed rule about logging.', '--yes',
    ], target, () => {}), 0, 'the item was not changed, so the second import would simply land again');

    const refused = spawnCli(['pack', 'import', source, '--yes'], target);
    assert.equal(
      refused.status, 1,
      'every id the pack carries was left exactly as it is and the command reported success. '
      + `That is the exit code a caller's shell reads — ${CONTRACT}, rule 4.`,
    );
    assert.match(
      refused.stdout, /changed item\(s\) were left exactly as they are/,
      'the outcome report no longer names what was left alone, so the exit code is the only '
      + 'signal and a reader cannot act on it',
    );
  } finally { removeTree(scratch); }
});

/* ══ RULE 5 — A DAMAGED READ IS DISCLOSED, NOT FAILED ═════════════════════ */

/**
 * **The break the item names, asserted on BOTH sides of it.**
 *
 * The same damage — a file in a store that cannot be parsed — was answered two
 * ways by one binary: a corpus item was a warning at exit 0, and a rule store
 * entry failed `rules list` outright. The repair moved `rules list` to 0, and
 * these two assertions are what stop a later repair from moving either one
 * back: they are the same claim about two stores, and if they ever disagree
 * again one of them reddens.
 *
 * `rules verify` is asserted in the same test, at 1, over the SAME damaged
 * store. That is what makes the 0 above a contract rather than a shrug: the
 * question "is this store intact" still has a command that answers it, and it
 * still answers non-zero.
 */
test('an unreadable file is named at exit 0 — in the corpus and in the rule store alike', () => {
  const cwd = workspace('myctx-exit-damage-');
  const store = mkdtempSync(path.join(tmpdir(), 'myctx-exit-store-'));
  const before = process.env[RULES_DIR_ENV];
  try {
    /* ── the corpus half ── */
    mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
    writeFileSync(
      path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-broken.md'),
      'no frontmatter here\n', 'utf8',
    );
    const listed = run(['list'], cwd);
    assert.equal(
      listed.code, 0,
      `a corpus item that cannot be parsed failed \`list\` — ${CONTRACT}, rule 5`,
    );
    assert.match(
      listed.out, /my_context: error {2}items\/constraint\/CONST-broken\.md/,
      'the unreadable item was not NAMED, which would make exit 0 a silent drop rather than a '
      + 'disclosure (INV-nothing-is-dropped-silently)',
    );

    /* ── the rule-store half, over a scratch COPY of the shipped store ── */
    cpSync(entriesDir(), store, { recursive: true });
    assert.notEqual(
      path.resolve(store), path.resolve(entriesDir()),
      'the scratch store IS the package store, so the damage below would be planted in the '
      + 'shipped files rather than in a copy',
    );
    writeFileSync(path.join(store, 'planted.md'), 'no frontmatter at all\n', 'utf8');
    process.env[RULES_DIR_ENV] = store;

    const rules = run(['rules', 'list'], cwd);
    assert.equal(
      rules.code, 0,
      'a rule store entry that cannot be read failed `rules list`, while the same damage to a '
      + `corpus item is a warning at exit 0 in the same binary — ${CONTRACT}, rule 5. That split `
      + 'is the defect this test exists for.',
    );
    assert.match(rules.out, /could not be read \(1\)/, 'the refused entry was not named');
    assert.match(rules.out, /planted\.md/);
    assert.match(
      rules.out, /mycontext rules verify/,
      'the reader is not told which command answers the question `list` just declined to answer',
    );

    // And the exception, over the identical damage: the command whose job IS
    // the question still fails. Without this, rule 5 would have removed the
    // only way to learn the store is damaged.
    const verify = run(['rules', 'verify'], cwd);
    assert.equal(
      verify.code, 1,
      '`rules verify` exited 0 over a store carrying a file nobody shipped. Rule 5 makes `list` '
      + 'lenient precisely BECAUSE `verify` is not, and with both lenient the damage is invisible.',
    );
  } finally {
    if (before === undefined) delete process.env[RULES_DIR_ENV];
    else process.env[RULES_DIR_ENV] = before;
    removeTree(store);
    removeTree(cwd);
  }
});

/* ══ RULE 7 — `--json` CHANGES THE FORMAT, NEVER THE CODE ═════════════════ */

/**
 * One assertion, over the two commands this lane moved, because a repair that
 * set an exit code in the text branch and forgot the `--json` branch is the
 * single most likely way rule 7 breaks — both commands have two returns.
 */
test('the `--json` channel reports the same exit code as the human one', () => {
  const { source, target, id } = packFixture();
  const scratch = path.dirname(source);
  try {
    assert.equal(run(['pack', 'import', source, '--yes'], target).code, 0);
    assert.equal(runCli([
      'edit', id, '--body', 'Something else entirely.',
      '--summary', 'A changed rule about logging.', '--yes',
    ], target, () => {}), 0);

    const asJson = run(['pack', 'import', source, '--yes', '--json'], target);
    assert.equal(
      asJson.code, 1,
      'the same import that exits 1 for a person exits 0 for a program. Two channels, one run, '
      + `two answers — ${CONTRACT}, rule 7.`,
    );
    JSON.parse(asJson.out);
  } finally { removeTree(scratch); }
});

/* ══ THE FILE THE CONTRACT NAMES ITSELF IN ════════════════════════════════ */

/**
 * The comments in the source cite `CONST-the-cli-exit-code-contract` by id at
 * each of the four places an exit code was changed. A citation that resolves
 * to nothing is worse than none — it is the shape
 * `RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number` exists
 * to stop being an unverifiable claim — so the citations are checked against
 * the corpus rather than trusted.
 */
test('every source comment that cites the contract cites an id that resolves', () => {
  const repo = path.resolve(import.meta.dirname, '..', '..');
  const cited = [
    'src/cli/commands/ingest.ts',
    'src/cli/commands/pack.ts',
    'src/cli/commands/rules.ts',
  ];
  for (const rel of cited) {
    const text = readFileSync(path.join(repo, ...rel.split('/')), 'utf8');
    assert.ok(
      text.includes(CONTRACT),
      `${rel} changed an exit code and does not name the contract it now follows`,
    );
  }
  assert.equal(
    run(['show', CONTRACT], repo).code, 0,
    'the id those three modules cite does not resolve in this corpus',
  );
});
