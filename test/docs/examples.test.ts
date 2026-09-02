import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync, existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertFenceHolds, assertMarkdownBlockHolds, clockDay, collectExamples, DOC_CLOCK, exampleBody,
  FIXTURE_PATH_LENGTH, generateDocuments, paddedFixtureDir, renderExamples, runExample,
  runExampleInFixture, scrubOutput, splitCommand, splitPipeline, toDocumentMarkdown, yearOutDay,
} from '../../scripts/gen-doc-examples.ts';
import { canonicalizeNearestExisting } from '../../src/core/paths.ts';
import { materializeDocFixture } from '../../scripts/doc-fixture.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO_ROOT = path.join(import.meta.dirname, '..', '..');
const CLI = path.join(REPO_ROOT, 'src', 'cli', 'index.ts');

function block(command: string, body: string): string {
  return `<!-- example: ${command} -->\n\`\`\`text\n${body}\n\`\`\`\n<!-- /example -->`;
}

/** The unfenced form: the command's output as document-native Markdown. */
function mdBlock(command: string, body: string): string {
  return `<!-- example-md: ${command} -->\n${body}\n<!-- /example -->`;
}

function fixture(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-docex-'));
  materializeDocFixture(dir);
  return dir;
}

/** The CLI as a plain child process, with nothing about it neutralised. */
function bareCli(args: string[], cwd: string, env: NodeJS.ProcessEnv): string {
  return execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', CLI, ...args], { cwd, encoding: 'utf8', env });
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

/**
 * `mycontext lesson` and `mycontext ingest` both print a ```` ```json ````
 * payload, so their output cannot live in a three-backtick block: CommonMark
 * ends a fenced block at the first line whose backtick run is at least as long
 * as the opener's, and GitHub then renders the rest of the output as prose and
 * swallows the `</details>` around it. A wider fence is the fix, and it only
 * works if the closer is derived from the opener rather than being constant.
 */
test('a wider fence holds output that itself contains a fence', () => {
  const body = 'preamble\n\n```json\n{ "a": 1 }\n```';
  const md = `<!-- example: lesson X -->\n\`\`\`\`text\n${body}\n\`\`\`\`\n<!-- /example -->`;
  const found = collectExamples(md);
  assert.equal(found.length, 1);
  assert.equal(found[0].fence, '````');
  assert.equal(found[0].body, body, 'the inner ``` is body, not a terminator');
  assert.equal(md.slice(found[0].start, found[0].end), body);
});

/**
 * The failure this guards against is invisible from inside the harness: the
 * parse is unaffected (a bare fence line is only a terminator when the closing
 * marker follows it), the block is written, and the drift test compares it
 * happily. Only the rendered page is wrong.
 */
test('a body that would close its own block is refused, naming the fence to widen to', () => {
  const ex = collectExamples(block('lesson X', 'old'))[0];
  assert.equal(ex.fence, '```');
  assert.throws(
    () => assertFenceHolds(ex, 'preamble\n\n```json\n{ "a": 1 }\n```'),
    /contains a line of 3 backticks.*[Ww]iden.*at least 4 backticks/s,
  );
  // A longer run inside a wide fence is still refused, and asks for wider still.
  const wide = collectExamples(
    '<!-- example: lesson X -->\n````text\nold\n````\n<!-- /example -->')[0];
  assert.doesNotThrow(() => assertFenceHolds(wide, '```json\n{}\n```'));
  assert.throws(() => assertFenceHolds(wide, '`````\nx\n`````'), /at least 6 backticks/);
});

/**
 * The whole point of the wider fence: the block a reader sees must be one
 * block. Asserted against the real document rather than a synthetic one,
 * because the defect is a property of pairing a particular command's output
 * with a particular author's fence.
 */
test('every documented block in both READMEs survives its own output', () => {
  for (const relative of ['README.md', path.join('docs', 'README.he.md')]) {
    const md = readFileSync(path.join(REPO_ROOT, relative), 'utf8').replaceAll('\r\n', '\n');
    for (const ex of collectExamples(md)) {
      if (ex.kind === 'text') {
        assert.doesNotThrow(() => assertFenceHolds(ex, ex.body), `${relative}: ${ex.command}`);
      } else {
        assert.doesNotThrow(() => assertMarkdownBlockHolds(ex, ex.body),
          `${relative}: ${ex.command}`);
      }
    }
  }
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
 * A walkthrough needs its setup to have actually run. Every example gets its
 * own materialized fixture, so a block showing `review promote` on a draft
 * that `ingest-apply` created can only be true if both commands ran in the
 * same workspace — which is what a `&&` marker is for.
 */
test('a marker splits into the sequence of commands it names', () => {
  assert.deepEqual(splitPipeline('list'), [['list']]);
  assert.deepEqual(
    splitPipeline('ingest docs/prd.md && review list --summary'),
    [['ingest', 'docs/prd.md'], ['review', 'list', '--summary']],
  );
});

/**
 * `&&` inside a quoted argument is text an item's title may legitimately
 * contain. Splitting on it would run half a title as a command — which fails
 * loudly here, but would be a silently wrong split for any argument where
 * both halves happen to parse.
 */
test('a quoted && is an argument, not a separator', () => {
  assert.deepEqual(
    splitPipeline('add rule "Log the request && the response" --yes'),
    [['add', 'rule', 'Log the request && the response', '--yes']],
  );
});

test('a marker with an empty command around && is an error', () => {
  assert.throws(() => splitPipeline('list &&'), /empty command around "&&"/);
  assert.throws(() => splitPipeline('&& list'), /empty command around "&&"/);
  assert.throws(() => splitPipeline('list && && doctor'), /empty command around "&&"/);
});

test('a sequenced marker runs its commands in one workspace and shows the last', () => {
  const dir = fixture();
  try {
    const out = runExample(
      'add constraint "Uploads capped at 10 MB" --summary-omitted --yes '
      + '&& list constraint --summary', dir);
    assert.match(out, /2 item\(s\)/, out);
    assert.doesNotMatch(out, /created CONST-uploads-capped-at-10-mb/,
      'only the last command in the sequence is documented');
  } finally {
    removeTree(dir);
  }
});

/**
 * A setup command that failed would paste a real, plausible block showing
 * none of what the prose around it says happened — the one failure this
 * harness exists to prevent, moved from the last command to an earlier one.
 */
test('a failing setup command in a sequence fails the build', () => {
  assert.throws(() => runExampleInFixture('no-such-command && list'),
    /`mycontext no-such-command` exited 1 and cannot be documented/);
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
  for (const b of blocks) {
    assert.equal(b.body, b.body.trimEnd(),
      'a generated block ends in whitespace, which renders as a blank line inside the fence');
  }

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
    block('add constraint "Docs isolation probe" --summary-omitted --yes', ''), '',
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
 * The floor exists because the rest of this test is vacuous without it: a
 * README that lost every marker would pass a loop over zero examples while
 * reporting success, which is the one failure mode a drift harness cannot
 * survive. It is deliberately a floor and not an exact count — adding a
 * worked example must never be the thing that reddens the suite. The number
 * is below what the README carries today, so removing a couple is allowed and
 * gutting the section is not.
 */
test('every documented example matches what the command actually prints', () => {
  const readme = readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
  const examples = collectExamples(readme);
  assert.ok(examples.length >= 10,
    `README.md carries ${examples.length} worked example(s); at least 10 are expected. ` +
    'If examples were deliberately removed, lower this floor in the same commit and say ' +
    'why — do not delete the assertion.');
  // `exampleBody`, not `runExampleInFixture`: it is the ONE place the two
  // block forms diverge, so the generator and this check cannot disagree about
  // what a `markdown` block is supposed to hold. Comparing raw stdout here
  // would fail every `example-md` block forever and invite someone to "fix" it
  // by exempting them from the drift check entirely.
  for (const ex of examples) {
    assert.equal(exampleBody(ex), ex.body,
      `README example "${ex.command}" is stale — run \`npm run gen:docs\` to regenerate it`);
  }
});

/**
 * The Hebrew README's blocks, verified per kind — the check that did not
 * exist when the defect this guards against shipped.
 *
 * The two documents run the same commands in the same order
 * (`parity.test.ts`), and for a ```` ```text ```` block the same output is
 * the correct body in BOTH: those are fenced terminal transcripts, and the
 * reader's terminal prints English. So the transcripts are asserted equal to
 * the English document's, byte for byte, without re-running ~50 child
 * processes. The one `markdown`-form block is the opposite case — its body is
 * document PROSE, and English prose inside the Hebrew document is precisely
 * the defect that passed every structural check for months — so it is
 * re-executed under the document's locale and diffed, and asserted to
 * actually BE Hebrew, which pins the locale selection itself: a generator
 * that lost the `MYCONTEXT_DOC_LOCALE` pin would regenerate English and the
 * plain drift comparison would agree with it.
 */
test('the Hebrew README: transcripts match the English, the body block is Hebrew', () => {
  const en = collectExamples(
    readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8').replaceAll('\r\n', '\n'));
  const he = collectExamples(
    readFileSync(path.join(REPO_ROOT, 'docs', 'README.he.md'), 'utf8').replaceAll('\r\n', '\n'));
  assert.equal(he.length, en.length, 'parity.test.ts owns this failure; see it first');

  const HEBREW = /[֐-׿]/;
  let markdownBlocks = 0;
  for (const [i, ex] of he.entries()) {
    assert.equal(ex.command, en[i].command, 'parity.test.ts owns this failure; see it first');
    if (ex.kind === 'text') {
      assert.equal(ex.body, en[i].body,
        `the transcript "${ex.command}" differs between the documents — a transcript is what ` +
        `the terminal prints and the CLI speaks English, so the two must be identical. Run ` +
        `\`npm run gen:docs\`.`);
      continue;
    }
    markdownBlocks += 1;
    assert.match(ex.body, HEBREW,
      `the Hebrew README's "${ex.command}" block is document body, not a transcript, and it ` +
      `carries no Hebrew — the English output was written into the Hebrew document again`);
    assert.doesNotMatch(en[i].body, HEBREW,
      `the English README's "${ex.command}" block carries Hebrew — the locales are crossed`);
    assert.equal(exampleBody(ex, DOC_CLOCK, 'he'), ex.body,
      `Hebrew README example "${ex.command}" is stale — run \`npm run gen:docs\``);
  }
  assert.ok(markdownBlocks >= 1,
    'no markdown-form block found in the Hebrew README — the assertions above about locale ' +
    'selection checked nothing');
});

/**
 * The pin is per DOCUMENT, so it must be deleted when it is not set — the
 * same hazard as `MYCONTEXT_ASCII`: a maintainer who exports it for a manual
 * look at the Hebrew output would otherwise regenerate the English README's
 * `help categories` block in Hebrew, and the diff would read as a legitimate
 * change to the block rather than a change of machine.
 */
test('MYCONTEXT_DOC_LOCALE in the generating environment cannot change an English block', () => {
  const dir = fixture();
  const saved = process.env.MYCONTEXT_DOC_LOCALE;
  try {
    const baseline = runExample('help categories', dir);
    assert.doesNotMatch(baseline, /[֐-׿]/, baseline.slice(0, 200));
    process.env.MYCONTEXT_DOC_LOCALE = 'he';
    assert.equal(runExample('help categories', dir), baseline);
  } finally {
    if (saved === undefined) delete process.env.MYCONTEXT_DOC_LOCALE;
    else process.env.MYCONTEXT_DOC_LOCALE = saved;
    removeTree(dir);
  }
});

/**
 * The Markdown form is a TRANSFORM of real output, not an escape from being
 * checked — so the transform itself is pinned, in both directions.
 *
 * The risk the form introduces is precise: a block that is no longer
 * byte-identical to what the command printed is a block someone can edit and
 * call "the rendering". These four assertions say what the rule is (headings
 * fold to bold), that it is total (nothing else moves), that it is idempotent
 * (so a regenerated block is stable), and that it is not the identity (without
 * which every other assertion here is satisfied by doing nothing).
 */
test('toDocumentMarkdown folds headings to bold and changes nothing else', () => {
  const output = [
    '# Categories', '', 'Prose with `code` and a — dash.', '',
    '- **Normative** types govern future work.', '',
    '## What each type is for', '', '### `constraint`', '',
    '| type | tier |', '|---|---|', '| `rule` | normative |',
  ].join('\n');

  const rendered = toDocumentMarkdown(output);
  assert.equal(rendered, [
    '**Categories**', '', 'Prose with `code` and a — dash.', '',
    '- **Normative** types govern future work.', '',
    '**What each type is for**', '', '**`constraint`**', '',
    '| type | tier |', '|---|---|', '| `rule` | normative |',
  ].join('\n'));

  assert.notEqual(rendered, output, 'the transform did nothing — the assertion above is vacuous');
  assert.equal(toDocumentMarkdown(rendered), rendered, 'the transform is not idempotent, so a ' +
    'regenerated block would differ from the one it was generated from');
  assert.equal(rendered.split('\n').length, output.split('\n').length,
    'the transform is line-for-line; adding or dropping a line would move every offset');
});

/**
 * The three ways a body written without a fence damages the document rather
 * than merely looking wrong, each refused by name.
 *
 * A ```` ```text ```` block is inert — the worst it can do is close early. An
 * unfenced block's body IS the page, so a stray marker splices the block away
 * on the next generation, a surviving heading becomes a README section that
 * `parity.test.ts` and `capabilities.test.ts` both key on, and an unbalanced
 * fence hides everything after it from every reader and every test.
 */
test('a Markdown-form body that would damage the document is refused, by cause', () => {
  const ex = collectExamples(mdBlock('help categories', 'ok'))[0];
  assert.equal(ex.kind, 'markdown');
  assert.doesNotThrow(() => assertMarkdownBlockHolds(ex, 'plain **prose** and a | table |'));

  assert.throws(() => assertMarkdownBlockHolds(ex, 'a\n<!-- /example -->\nb'),
    /contains an example marker/);
  assert.throws(() => assertMarkdownBlockHolds(ex, 'a\n## Still a heading\nb'),
    /still contains the heading.*parity\.test\.ts/s);
  assert.throws(() => assertMarkdownBlockHolds(ex, 'a\n```json\n{}\nb'),
    /opens 1 code fence\(s\), an odd number/);
});

/**
 * The round trip on the new form, driven end to end against a real command,
 * and the property that makes it worth having: the block a reader sees is
 * Markdown, and it is still what the command printed.
 */
test('a markdown-form block round-trips through the generator and is caught when edited', () => {
  const md = ['# Doc', '', mdBlock('help categories', ''), ''].join('\n');

  const filled = renderExamples(md);
  const block = collectExamples(filled)[0];
  assert.equal(block.kind, 'markdown');
  assert.match(block.body, /^\| `constraint` \| normative \| `CONST-` \|/m,
    'the catalogue table is not in the block, so nothing here is about the table rendering');
  assert.match(block.body, /^\*\*Categories\*\*$/m, 'the leading heading was not folded to bold');
  assert.doesNotMatch(block.body, /^ {0,3}#{1,6} /m,
    'a heading survived into the document, where it would become a README section');

  assert.equal(renderExamples(filled), filled, 'regenerating an up-to-date document changed it');

  const edited = filled.replace('| `constraint` |', '| `constrainte` |');
  assert.notEqual(edited, filled, 'the hand edit did not apply — the assertion below is vacuous');
  const stale = collectExamples(edited)[0];
  assert.notEqual(exampleBody(stale), stale.body,
    'a hand-edited markdown example block was not detected as stale');
});

/**
 * The failure that used to be silent: a `<!-- example: … -->` marker with no
 * fence under it matched nothing, so the block was neither generated nor
 * verified and both reported success. With two marker forms that is a live
 * hazard — the `-md` suffix is one character.
 */
test('an example marker with no fence under it is an error, not a skipped block', () => {
  assert.throws(
    () => collectExamples('<!-- example: help categories -->\n# Categories\n<!-- /example -->'),
    /is not followed by a ```text fence.*example-md/s,
  );
});

/**
 * The clock is a machine-dependent value exactly like the fixture's path, and
 * this is the assertion that says so.
 *
 * `mycontext examples <category>` renders an item as it is stored, and
 * `createItem` stamps `valid_from` with the day it ran — so before the clock
 * was pinned, the block generated yesterday and the command run today
 * disagreed, and `npm test` went red at midnight with nothing in the
 * repository having changed. Both halves are asserted: the placeholder is
 * there, and the day this test runs is NOT, which is what the substitution
 * removed and what would come back if the pin were dropped.
 */
test('a documented example cannot carry the day it was generated', () => {
  const out = runExampleInFixture('examples rule');
  assert.match(out, /^valid_from: <today>$/m, out);

  const realToday = new Date().toISOString().slice(0, 10);
  assert.doesNotMatch(out, new RegExp(realToday),
    `the day this ran (${realToday}) reached a documented block — it will be stale tomorrow`);
  assert.doesNotMatch(out, new RegExp(clockDay(DOC_CLOCK)),
    'the pinned generation day reached a documented block unsubstituted');
});

/**
 * The other date a specimen carries, and the one the `<today>` substitution
 * cannot reach.
 *
 * `assumption` is the only category whose distinctive field names a FUTURE
 * day: `exampleItem` stamps `validate_by` with `aboutAYearFromNow()`, so the
 * specimen shows a deadline the reader has not already missed. That is the
 * same machine fact as `valid_from` — it moves every time the generator runs —
 * and it is deliberately not today, so `<today>` never touches it. Left alone,
 * the documented block would be generated once, verified once, and go stale on
 * every later day, which is the exact failure the clock pin was introduced for.
 *
 * Both halves, as for `<today>`: the placeholder is there, and neither the day
 * this test runs nor the pinned day-plus-365 survives into the block.
 */
test('a documented example cannot carry a deadline computed from the generating day', () => {
  const out = runExampleInFixture('examples assumption --short');
  assert.match(out, /^validate_by: <a year from today>$/m, out);

  for (const clock of [new Date().toISOString(), DOC_CLOCK]) {
    assert.doesNotMatch(out, new RegExp(yearOutDay(clock)),
      `the deadline computed from ${clockDay(clock)} reached a documented block`);
  }
});

/**
 * The scrub must not reach a date the fixture legitimately carries — the same
 * property `DOC_CLOCK` has, asserted for the day it substitutes 365 days out.
 */
test('the pinned day plus a year is not a date the fixture carries', () => {
  const day = yearOutDay(DOC_CLOCK);
  const items = path.join(REPO_ROOT, 'test', 'fixtures', 'docs-workspace', '.my_context', 'items');
  const found = globSync('**/*.md', { cwd: items })
    .filter((file) => readFileSync(path.join(items, file), 'utf8').includes(day));
  assert.deepEqual(found, [],
    `the documentation fixture carries ${day}, so substituting it would replace a real ` +
    'corpus date with a placeholder — move DOC_CLOCK');
});

/**
 * A leap day and a day four years out, generating the same bytes. Anything
 * derived from the clock at a granularity coarser than a millisecond — a
 * stamped date, a deadline a year ahead, an age in days — moves between these
 * three and is caught here rather than by a red suite on some later morning.
 */
test('the date-bearing example is identical on a leap day and four years out', () => {
  const baseline = runExampleInFixture('examples rule');
  for (const clock of ['2028-02-29T12:00:00.000Z', '2031-05-17T12:00:00.000Z']) {
    assert.equal(runExampleInFixture('examples rule', clock), baseline,
      `\`examples rule\` prints something different when generated on ${clockDay(clock)}`);
  }
});

/**
 * The whole README, re-verified under a different today. This is the property
 * the suite lost when it started failing on its own: a documented block must
 * be a fact about mycontext, not about the day someone ran the generator.
 *
 * It is a separate test from the drift check rather than a replacement for
 * it — that one verifies the blocks against the day they are actually
 * generated on, and this one verifies that the day does not matter.
 */
test('every documented example still matches when today is a different day', () => {
  const readme = readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
  const examples = collectExamples(readme);
  assert.ok(examples.length >= 10, `README.md carries ${examples.length} worked example(s)`);
  for (const ex of examples) {
    assert.equal(exampleBody(ex, '2027-10-06T12:00:00.000Z'), ex.body,
      `README example "${ex.command}" depends on the day it was generated`);
  }
});

/**
 * The preload refuses to be a no-op. If `doc-clock.ts` ever loaded without an
 * instant to pin — a renamed variable, a dropped `env` entry — the child would
 * run on the real clock, the generated block would be correct on the day it
 * was written and stale the next, and nothing else here would notice: the
 * generator and the drift test share the same code path and would agree with
 * each other all the way to the next midnight.
 */
test('the clock preload with nothing to pin the clock to fails loudly', () => {
  const clock = pathToFileURL(path.join(REPO_ROOT, 'scripts', 'doc-clock.ts')).href;
  const env = { ...process.env };
  delete env.MYCONTEXT_DOC_CLOCK;
  assert.throws(
    () => execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--import', clock, '-e', ''],
      { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] }),
    /preloaded without MYCONTEXT_DOC_CLOCK/,
  );
});

/**
 * The other side of the substitution: it must not reach a date that belongs
 * to the corpus. The fixture's items carry real `valid_from` values, the
 * documentation shows them, and they are what a reader is meant to see.
 *
 * Substituting the PINNED day rather than the real one is what makes that
 * safe, and it is only safe while no fixture item carries the pinned day —
 * so that is asserted directly, against the committed files. The second half
 * asserts the outcome from the other end: a fixture date really does survive
 * into a documented block.
 */
test('the pinned generation day is not a date the fixture carries', () => {
  const pinned = clockDay(DOC_CLOCK);
  const items = path.join(REPO_ROOT, 'test', 'fixtures', 'docs-workspace', '.my_context', 'items');
  const found: string[] = [];
  for (const file of globSync('**/*.md', { cwd: items })) {
    const text = readFileSync(path.join(items, file), 'utf8');
    if (text.includes(pinned)) found.push(file);
  }
  assert.deepEqual(found, [],
    `the documentation fixture carries the pinned generation day ${pinned}, so scrubbing it ` +
    'would replace a real corpus date with a placeholder — move DOC_CLOCK');

  const shown = runExampleInFixture('show CONST-postgres-pool-capped-at-20');
  assert.match(shown, /^valid_from: \d{4}-\d{2}-\d{2}$/m,
    "a committed item's own valid_from was substituted — the scrub is reaching the corpus");
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
    bareCli(['add', '--summary-omitted', 'constraint', 'Global layer leaked into the docs', '--yes'],
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
    removeTree(dir);
  }
});

/**
 * The other half of the rendering question: forcing `MYCONTEXT_UNICODE` has
 * to actually reach the child, and it has to win against an ambient
 * environment that would otherwise choose the fallback.
 *
 * `supportsUnicode` fails toward ASCII on Windows when it recognizes no
 * terminal — no `WT_SESSION`, `TERM_PROGRAM` or `TERM` — which is exactly the
 * environment a generator run from a scheduled task or a bare `cmd.exe` has.
 * Without the force, the documentation would then show every table in the
 * fallback rendering that its own prose describes as the legacy case.
 *
 * On POSIX `supportsUnicode` answers true regardless, so this assertion only
 * has teeth on Windows — which is this project's first-target platform and
 * the only one where the fallback can be reached by accident.
 */
test('a terminal that would choose the ascii fallback does not get to', () => {
  const dir = fixture();
  const stripped = ['WT_SESSION', 'TERM_PROGRAM', 'TERM'] as const;
  const saved = stripped.map((key) => [key, process.env[key]] as const);
  try {
    for (const key of stripped) delete process.env[key];
    const out = runExample('list', dir);
    assert.match(out, /^┌/m, out);
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    removeTree(dir);
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
 * The workspace path's LENGTH is a machine fact exactly like its spelling:
 * `wrap` (format.ts) folds a paragraph around the path as printed, and only
 * then does the scrub shorten it to `<workspace>` — so a block generated
 * under a 53-character Windows temp root wrapped differently from the same
 * command re-run under Linux CI's 23-character `/tmp`, and the README drift
 * test was red on every Linux run from the day the path-bearing block was
 * committed. `paddedFixtureDir` pins the length; this asserts the pin holds
 * whatever the temp root measures, and that a root too long to pad is refused
 * rather than silently generating blocks that only verify on one machine.
 *
 * Two temp roots of different lengths locally; the cross-MACHINE half of the
 * property is proven by CI, where the drift test below re-runs every committed
 * block on both a Windows and a Linux runner.
 */
test('every documented example runs at a workspace path of pinned length, whatever the temp root', () => {
  const shallow = mkdtempSync(path.join(tmpdir(), 'myctx-pad-'));
  const nest = path.join(tmpdir(), 'myctx-pad-nest', 'quite', 'a', 'lot', 'deeper');
  mkdirSync(nest, { recursive: true });
  const tooLong = path.join(tmpdir(), 'z'.repeat(FIXTURE_PATH_LENGTH));
  mkdirSync(tooLong, { recursive: true });
  try {
    for (const base of [shallow, nest]) {
      const dir = paddedFixtureDir(base);
      // Measured through realpath, not by construction — an existing directory
      // whose CANONICAL path is the pinned length is the property the wrapped
      // output depends on.
      assert.equal(canonicalizeNearestExisting(dir).length, FIXTURE_PATH_LENGTH,
        `paddedFixtureDir(${base}) came back at the wrong length: ${dir}`);
    }
    assert.throws(() => paddedFixtureDir(tooLong), /too long to pad/);
  } finally {
    removeTree(shallow);
    removeTree(path.join(tmpdir(), 'myctx-pad-nest'));
    removeTree(tooLong);
  }
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

/**
 * That `runExample` is actually wired to `scrubOutput`, asserted against a
 * command that really does print an absolute path.
 *
 * No command run against the documentation fixture prints one today, so
 * nothing else in this file would notice the scrub being dropped — and the
 * day a reporting command starts naming a file, every regenerated block would
 * carry the generator's temp directory into the documentation.
 */
test('runExample scrubs the workspace path out of what a command prints', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-init-'));
  try {
    const out = runExample('init', dir);
    assert.equal(out, 'my_context: initialized <workspace>/.my_context', out);
  } finally {
    removeTree(dir);
  }
});

/**
 * A backslash is a path separator only inside a path. The extraction request
 * `mycontext ingest` prints embeds a JSON block, and JSON escapes `"` as
 * `\"`; a blanket separator normalization rewrote those to `/"` and pasted
 * JSON that does not parse into the one block whose purpose is to be copied
 * and answered.
 */
test('scrubOutput leaves backslashes that are not path separators alone', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-scrub-'));
  try {
    assert.equal(scrubOutput('"description": "e.g. {\\"kind\\":\\"functional\\"}"', dir),
      '"description": "e.g. {\\"kind\\":\\"functional\\"}"');
    // Still normalized where it IS a separator: the tail of a scrubbed root.
    assert.equal(scrubOutput(`${path.join(dir, 'a', 'b.md')} and c\\"d`, dir),
      '<workspace>/a/b.md and c\\"d');
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
    // CRLF on purpose: that is how `README.md` sits in a working tree checked
    // out before `.gitattributes` asked for LF, which is how it sits in this
    // one. Splicing LF command output into it without normalizing the rest
    // would leave one document with two line endings.
    writeFileSync(readme, `# Doc\n\n${block('doctor', 'STALE')}\n`.replaceAll('\n', '\r\n'), 'utf8');

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
