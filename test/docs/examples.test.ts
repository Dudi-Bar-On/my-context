import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  collectExamples, generateDocuments, renderExamples, runExample, runExampleInFixture,
  scrubOutput, splitCommand,
} from '../../scripts/gen-doc-examples.ts';
import { materializeDocFixture } from '../../scripts/doc-fixture.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO_ROOT = path.join(import.meta.dirname, '..', '..');
const CLI = path.join(REPO_ROOT, 'src', 'cli', 'index.ts');

function block(command: string, body: string): string {
  return `<!-- example: ${command} -->\n\`\`\`text\n${body}\n\`\`\`\n<!-- /example -->`;
}

function fixture(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-docex-'));
  materializeDocFixture(dir);
  return dir;
}

/** The CLI as a plain child process, with nothing about it neutralised. */
function bareCli(args: string[], cwd: string, env: NodeJS.ProcessEnv): string {
  return execFileSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env });
}

test('collectExamples finds marked blocks', () => {
  const md = ['intro', block('list constraint', 'OUTPUT'), 'outro'].join('\n');
  const found = collectExamples(md);
  assert.equal(found.length, 1);
  assert.equal(found[0].command, 'list constraint');
  assert.equal(found[0].body, 'OUTPUT');
});

test('the offsets replace exactly the block body and nothing else', () => {
  const md = ['a', block('list', 'OLD'), 'b', block('doctor', 'ALSO OLD'), 'c'].join('\n');
  const found = collectExamples(md);
  assert.deepEqual(found.map((e) => e.command), ['list', 'doctor']);

  let out = md;
  for (const ex of [...found].reverse()) {
    out = out.slice(0, ex.start) + 'NEW' + out.slice(ex.end);
  }
  assert.equal(out, ['a', block('list', 'NEW'), 'b', block('doctor', 'NEW'), 'c'].join('\n'));
});

/**
 * `.gitattributes` asks for LF, but a working tree checked out before that
 * rule was added still holds CRLF `.md` files — this one did. A marker regex
 * anchored on a bare `\n` finds nothing there, and finding nothing is the one
 * failure a drift harness cannot survive: the generator writes no blocks and
 * the test verifies no blocks, and both report success.
 */
test('a CRLF document is read, and its body compared, the same as an LF one', () => {
  const lf = ['intro', block('list', 'LINE ONE\nLINE TWO'), 'outro'].join('\n');
  const crlf = lf.replaceAll('\n', '\r\n');

  const found = collectExamples(crlf);
  assert.equal(found.length, 1, 'CRLF markers must still be found');
  assert.equal(found[0].command, 'list');
  assert.equal(found[0].body, 'LINE ONE\nLINE TWO', 'the body is normalized for comparison');
  assert.equal(crlf.slice(found[0].start, found[0].end), 'LINE ONE\r\nLINE TWO',
    'the offsets still address the raw text');
});

test('an unterminated block is an error, not a silently skipped one', () => {
  const md = 'intro\n<!-- example: list -->\n```text\nOUTPUT\n\noutro';
  assert.throws(() => collectExamples(md), /unterminated example block: list/);
});

test('a marker inside a block body cannot open an overlapping block', () => {
  const md = block('doctor', '<!-- example: list -->\n```text\nnested');
  const found = collectExamples(md);
  assert.deepEqual(found.map((e) => e.command), ['doctor']);
});

test('quoted arguments survive as single arguments', () => {
  assert.deepEqual(
    splitCommand('add constraint "Postgres pool capped at 20" --yes'),
    ['add', 'constraint', 'Postgres pool capped at 20', '--yes'],
  );
  assert.deepEqual(splitCommand('list --scope="src/**"'), ['list', '--scope=src/**']);
  assert.deepEqual(splitCommand('   '), []);
});

/**
 * The whole round trip on a document this test writes itself, so the harness
 * is exercised against real command output now rather than only after the
 * README is rewritten. It asserts the three properties the documentation
 * depends on: the block is filled with what the command actually prints,
 * regenerating an up-to-date document is a no-op, and a hand-edited block is
 * detected as stale.
 */
test('the round trip fills a block, is idempotent, and catches a hand edit', () => {
  const md = ['# Doc', '', block('list', ''), '', block('doctor', ''), ''].join('\n');

  const filled = renderExamples(md);
  const blocks = collectExamples(filled);
  assert.equal(blocks.length, 2);
  assert.match(blocks[0].body, /CONST-postgres-pool-capped-at-20/, blocks[0].body);
  assert.match(blocks[0].body, /^┌/m, 'the box rendering is forced regardless of terminal');
  assert.match(blocks[1].body, /0 error\(s\), 0 warning\(s\), 0 note\(s\)/, blocks[1].body);

  assert.equal(renderExamples(filled), filled, 'regenerating an up-to-date document changed it');

  const edited = filled.replace('CONST-postgres-pool-capped-at-20', 'CONST-something-else');
  assert.notEqual(edited, filled, 'the hand edit did not apply — the assertion below is vacuous');
  const stale = collectExamples(edited)[0];
  assert.notEqual(runExampleInFixture(stale.command), stale.body,
    'a hand-edited example block was not detected as stale');
});

/**
 * Each example gets its OWN materialized fixture, and this is what says so.
 *
 * The documentation shows capture — `mycontext add` is the first worked
 * example in the plan — and a capture run against a shared workspace would
 * leak into every block after it: the `list` below would silently grow a row
 * that depends on where in the document the `add` happens to sit. Worse, the
 * generator and the verifier would then have to iterate in the same order to
 * agree, and nothing inside either could detect the day they stopped.
 *
 * Regenerating twice is asserted for the same reason from the other side: a
 * second `add` against a corpus that already holds the item exits non-zero,
 * so a shared fixture fails the second run outright.
 */
test('a capturing example cannot leak into the examples after it', () => {
  const md = [
    '# Doc', '',
    block('add constraint "Docs isolation probe" --yes', ''), '',
    block('list', ''), '',
  ].join('\n');

  const filled = renderExamples(md);
  const [added, listed] = collectExamples(filled);
  assert.match(added.body, /created CONST-docs-isolation-probe/, added.body);
  assert.doesNotMatch(listed.body, /docs-isolation-probe/,
    'the `add` example mutated the corpus the `list` example was generated from');
  assert.equal(renderExamples(filled), filled, 'the second regeneration disagreed with the first');
});

/**
 * The drift check itself. Every example marked in `README.md` is re-executed
 * and diffed; when it fails the fix is `npm run gen:docs`, never editing the
 * pasted block to agree with the prose.
 *
 * There is deliberately no assertion here on HOW MANY examples the README
 * carries. The README is not rewritten until Tasks 5-7 of the documentation
 * plan, so a count floor asserted now would only duplicate the red window
 * `test/docs/inventory.test.ts` already owns for the same missing prose. It
 * follows that a green run of this test says the examples present are true,
 * not that the README has any.
 */
test('every documented example matches what the command actually prints', () => {
  const readme = readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
  for (const ex of collectExamples(readme)) {
    assert.equal(runExampleInFixture(ex.command), ex.body,
      `README example "${ex.command}" is stale — run \`npm run gen:docs\` to regenerate it`);
  }
});

/**
 * The hazard that would make a generated block a fact about the maintainer's
 * laptop rather than about mycontext: `GLOBAL_DIR` is `homedir()/.my-context`
 * and every reporting command folds that layer in when it exists. The machine
 * this was written on has none, so a broken neutralisation looks perfect here
 * and corrupts the next person's regeneration.
 *
 * Both halves are asserted. A global corpus is built through the shipped
 * surfaces and placed at a home directory a bare child is pointed at, and
 * that child DOES pick it up — which is what makes `HOME`/`USERPROFILE` the
 * lever and keeps the second half from being vacuous. `runExample` under the
 * same polluted `process.env` then produces output identical to the clean
 * baseline.
 */
test('a global layer on the generating machine cannot reach a documented example', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'myctx-global-'));
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-home-'));
  const clean = fixture();
  const polluted = fixture();
  const saved = { home: process.env.HOME, profile: process.env.USERPROFILE };
  try {
    // Built through `init` + `add` rather than hand-written, so its checksums
    // are the ones the runtime computes.
    bareCli(['init'], scratch, process.env);
    bareCli(['add', 'constraint', 'Global layer leaked into the docs', '--yes'],
      scratch, process.env);
    cpSync(path.join(scratch, '.my_context'), path.join(home, '.my-context'), { recursive: true });

    const baseline = runExample('list', clean);
    assert.doesNotMatch(baseline, /leaked-into-the-docs/, baseline);

    const leaked = bareCli(['list'], polluted, { ...process.env, HOME: home, USERPROFILE: home });
    assert.match(leaked, /CONST-global-layer-leaked-into-the-docs/,
      'a global layer no longer reaches the CLI through HOME/USERPROFILE, so this test can no ' +
      'longer prove that runExample neutralises anything — find what does control it');

    process.env.HOME = home;
    process.env.USERPROFILE = home;
    assert.equal(runExample('list', clean), baseline,
      'a global corpus on the generating machine changed a documented example');
  } finally {
    for (const [key, value] of [['HOME', saved.home], ['USERPROFILE', saved.profile]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    removeTree(clean);
    removeTree(polluted);
    removeTree(home);
    removeTree(scratch);
  }
});

/**
 * `supportsUnicode` gives `MYCONTEXT_ASCII` precedence over
 * `MYCONTEXT_UNICODE` on purpose — the safe rendering wins when a terminal
 * asks for both. So forcing `MYCONTEXT_UNICODE=1` is not enough on its own: a
 * maintainer who exports `MYCONTEXT_ASCII=1` for their own terminal would
 * regenerate every table in the fallback rendering, and the diff would read
 * as a legitimate change to the tables rather than a change of machine.
 */
test('MYCONTEXT_ASCII in the generating environment cannot change a documented table', () => {
  const dir = fixture();
  const saved = process.env.MYCONTEXT_ASCII;
  try {
    const baseline = runExample('list', dir);
    assert.match(baseline, /^┌/m, baseline);
    process.env.MYCONTEXT_ASCII = '1';
    assert.equal(runExample('list', dir), baseline);
  } finally {
    if (saved === undefined) delete process.env.MYCONTEXT_ASCII;
    else process.env.MYCONTEXT_ASCII = saved;
  }
});

/**
 * `runExample` writes an empty home directory into the workspace to
 * neutralise the global layer. The fixture's clean bill of health is itself
 * something the documentation shows, and `doctor` is the command that would
 * notice a stray directory.
 */
test('what runExample writes into the workspace does not show up in doctor', () => {
  const dir = fixture();
  try {
    assert.match(runExample('doctor', dir), /0 error\(s\), 0 warning\(s\), 0 note\(s\)/);
  } finally {
    removeTree(dir);
  }
});

test('a marker naming a command that does not exist fails loudly', () => {
  assert.throws(() => runExampleInFixture('no-such-command'),
    /exited 1 and cannot be documented/);
});

/**
 * A temp path pasted into the documentation is the one string guaranteed to
 * be wrong for every reader. `scrubOutput` replaces it, and refuses to emit
 * anything it could not.
 */
test('scrubOutput replaces the workspace path and normalizes separators', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-scrub-'));
  try {
    const text = `read ${path.join(dir, '.my_context', 'items', 'rule', 'a.md')} ok`;
    assert.equal(scrubOutput(text, dir), 'read <workspace>/.my_context/items/rule/a.md ok');
  } finally {
    removeTree(dir);
  }
});

test('scrubOutput refuses to emit a path it could not scrub', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-scrub-'));
  try {
    assert.throws(() => scrubOutput(`built from ${REPO_ROOT}`, dir), /machine-specific path/);
    assert.throws(() => scrubOutput(`somewhere under ${tmpdir()}`, dir), /machine-specific path/);
    assert.equal(scrubOutput('nothing machine-specific here', dir),
      'nothing machine-specific here');
  } finally {
    removeTree(dir);
  }
});

/**
 * `docs/README.he.md` does not exist until Task 8 of the documentation plan,
 * and a generator that throws until then is a generator nobody runs. Driven
 * against documents this test writes, so it can assert the file was actually
 * rewritten without touching the repository's own.
 */
test('the generator rewrites what exists and skips what does not', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-gendocs-'));
  try {
    const readme = path.join(root, 'README.md');
    writeFileSync(readme, `# Doc\n\n${block('doctor', 'STALE')}\n`, 'utf8');

    const first = generateDocuments(root);
    assert.match(first[0], /^rewrote {2}\s+README\.md \(1 example block\(s\)\)$/, first[0]);
    assert.match(first[1], /^skipped\s+docs[\\/]README\.he\.md \(does not exist yet\)$/, first[1]);
    assert.equal(existsSync(path.join(root, 'docs', 'README.he.md')), false,
      'the generator created a document it was supposed to skip');

    const rewritten = readFileSync(readme, 'utf8');
    assert.doesNotMatch(rewritten, /STALE/);
    assert.match(rewritten, /0 error\(s\), 0 warning\(s\), 0 note\(s\)/);
    assert.doesNotMatch(rewritten, /\r/, 'the rewritten document must be LF, per .gitattributes');

    assert.match(generateDocuments(root)[0], /^unchanged/);
    assert.equal(readFileSync(readme, 'utf8'), rewritten);

    // The Hebrew mirror, once it exists, is filled from the same fixture.
    mkdirSync(path.join(root, 'docs'), { recursive: true });
    writeFileSync(path.join(root, 'docs', 'README.he.md'),
      `# מסמך\n\n${block('doctor', '')}\n`, 'utf8');
    assert.match(generateDocuments(root)[1], /^rewrote/);
    assert.equal(
      collectExamples(readFileSync(path.join(root, 'docs', 'README.he.md'), 'utf8'))[0].body,
      collectExamples(rewritten)[0].body,
      'the same command produced different output in the two documents',
    );
  } finally {
    removeTree(root);
  }
});
