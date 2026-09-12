// @basis TASK-lesson-accept-creates-a-rule-with-no-summary-so-the-accept, STD-a-summary-is-one-plain-sentence-for-someone-who-does-not, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **THE SUMMARY GATE ON `lesson-accept`, WHICH IS THE APPROVAL GATE.**
 *
 * Measured 2026-09-05 and re-measured 2026-09-12 before this file was written:
 * `mycontext lesson-accept <lesson> <key>` created an `active`, governing
 * `rule` carrying no summary and no recorded omission, and `mycontext doctor`
 * reported it as `summary_absent` in the very next run. It was the one creation
 * route in the product that produced an item `mycontext add` would have refused
 * — and the one where a summary matters most, because a candidate is DERIVED
 * rather than written, so until somebody types the sentence nobody has said in
 * their own words what the rule is.
 *
 * Every assertion below is about the CLI, because that is where the gate lives:
 * `acceptStagedRule` (lesson/derive.ts) is a shared road and is deliberately
 * ungated, exactly as `createItem` is — see `summaryRequiredAtCreate`'s own
 * comment in `core/summary-gate.ts`. `test/lesson/derive.test.ts` still calls it
 * directly with no summary and still passes, which is the fact rather than an
 * oversight: this file is what closes the reachable surface.
 *
 * **Throwaway workspaces, not this repository's corpus.** The subject is a
 * creation path, so every assertion has to CREATE something, and
 * `INSTR-testing-happens-against-the-current-corpus-and-an-exception` draws the
 * line at exactly that: a probe must not write items into the live corpus. Each
 * test mints a `mycontext init` workspace under the OS temp dir and removes it
 * in a `finally`, which is the pattern `test/cli/lesson.test.ts` beside this
 * file already uses.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';
import { firstCell } from '../helpers/table.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

/** A temp workspace removed even when an assertion above the cleanup fails —
 * the same reason `test/cli/lesson.test.ts` wraps rather than trailing an
 * `rmSync`. */
function withProject(fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-accept-summary-'));
  runCli(['init'], cwd, () => {});
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

const CANDIDATES = JSON.stringify([
  {
    title: 'Run schema migrations outside peak traffic hours',
    directive: 'do',
    body: 'An ACCESS EXCLUSIVE lock queues every write behind it.',
    scope: ['migrations/**'],
  },
  { title: 'Never deploy a migration on a Friday', directive: 'dont', body: 'Nobody is around to roll it back.' },
]);

function stage(cwd: string): { lessonId: string; keys: string[] } {
  const created = run(['lesson', 'Migrations deadlock when run during peak traffic'], cwd);
  const lessonId = /LESSON-[a-z0-9-]+/.exec(created.out)![0];
  writeFileSync(path.join(cwd, 'r.json'), CANDIDATES, 'utf8');
  const staged = run(['lesson-stage', lessonId, '--file', 'r.json'], cwd);
  const keys = [...staged.out.matchAll(firstCell('[0-9a-f]{8}', 'gm'))].map((m) => m[1]);
  assert.equal(keys.length, 2, `expected 2 staged keys, got:\n${staged.out}`);
  return { lessonId, keys };
}

/** The rule count as the CORPUS holds it, through `list --json` rather than by
 * counting text lines: the table carries a header and a rule above the data,
 * and arithmetic over lines drifts with the layout. */
function ruleCount(cwd: string): number {
  return (JSON.parse(run(['list', 'rule', '--json'], cwd).out) as { count: number }).count;
}

/** The staged candidate's state, read off the staging file — the record the
 * NEXT invocation of `lesson-accept` will consult, not the one this process
 * happens to hold. */
function stagedState(cwd: string, lessonId: string, key: string): string {
  const file = path.join(cwd, '.my_context', '.staging', `${lessonId}.json`);
  const staging = JSON.parse(readFileSync(file, 'utf8')) as
    { candidates: { key: string; state: string }[] };
  return staging.candidates.find((c) => c.key === key)!.state;
}

const SUMMARY =
  'A standing instruction to hold schema changes back to a quiet window, because the lock they '
  + 'take stalls every write behind them.';

/* ---------------------------------------------------------------------------
 * The refusal.
 * ------------------------------------------------------------------------- */

test('an accept carrying no summary is refused, and creates nothing', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { code, out } = run(['lesson-accept', lessonId, keys[0]], cwd);

    assert.equal(code, 1, `a summary-less accept must be refused, got:\n${out}`);
    assert.match(out, /this capture carries no summary/, out);
    assert.equal(ruleCount(cwd), 0, `nothing may exist after a refused accept:\n${out}`);
  });
});

/**
 * The half a "nothing was created" message cannot prove on its own: a refusal
 * that also CONSUMED the candidate would leave the user unable to retry, and
 * the state is written to disk by `acceptStagedRule`, which this path never
 * reaches.
 */
test('a refused accept leaves the candidate pending, so the same command works once the sentence is added', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const refused = run(['lesson-accept', lessonId, keys[0]], cwd);

    // First, because it is the assertion this test is FOR: a refusal that also
    // consumed the candidate would satisfy the exit code below and leave the
    // user unable to retry.
    assert.equal(stagedState(cwd, lessonId, keys[0]), 'pending', refused.out);
    assert.equal(refused.code, 1, refused.out);
    const retry = run(['lesson-accept', lessonId, keys[0], '--summary', SUMMARY], cwd);
    assert.equal(retry.code, 0, retry.out);
    assert.equal(stagedState(cwd, lessonId, keys[0]), 'accepted');
  });
});

/**
 * **Why the gate is on THIS command and not on staging.** The sentence has to
 * describe a body the writer has read, and this is the only moment they are
 * holding it — so the refusal prints the candidate rather than withholding it.
 * The body is asserted specifically, because title and directive are already in
 * the message for other reasons and a substring check against either of those
 * would pass with the preview block deleted.
 */
test('the refusal prints the candidate body, which is the text the summary has to describe', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { out } = run(['lesson-accept', lessonId, keys[0]], cwd);
    // Anchored to the refusal paragraph rather than matched against the whole
    // output: the SUCCESS path prints the same body line, so a bare substring
    // here would stay green with the gate deleted.
    const refusalAt = out.indexOf('this capture carries no summary');
    assert.notEqual(refusalAt, -1, `no refusal in:
${out}`);
    assert.match(
      out.slice(0, refusalAt),
      /body:\s+An ACCESS EXCLUSIVE lock queues every write behind it\./,
      out,
    );
  });
});

/**
 * The header must not claim a write that did not happen. `lesson-accept` opens
 * its preview with "about to create this rule", and printing that above a
 * refusal would be the message-asserting-something-untrue defect this
 * repository has already audited once on this exact line.
 */
test('the refusal does not print "about to create this rule"', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { out } = run(['lesson-accept', lessonId, keys[0]], cwd);
    assert.doesNotMatch(out, /about to create this rule/, out);
    // The header specifically. `Nothing was created.` also appears inside the
    // refusal paragraph, so a loose match would not be testing the branch.
    assert.match(out, /nothing was created — this candidate carries no summary/, out);
  });
});

/** The remedy names the command this caller can retype — their own lesson id
 * and their own key — rather than a shape to fill in. */
test('the refusal names the exact command to send again, with the lesson id and the key', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { out } = run(['lesson-accept', lessonId, keys[0]], cwd);
    assert.match(
      out,
      new RegExp(`mycontext lesson-accept ${lessonId} ${keys[0]} [^\\n]*--summary`),
      out,
    );
  });
});

/**
 * `--title` changes what the rule SAYS, so it changes what a summary of it
 * would say. The gate is built from the merged candidate, and the refusal must
 * quote the title about to be written rather than the staged one.
 */
test('the refusal quotes the EDITED title, not the staged one', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { out } = run(
      ['lesson-accept', lessonId, keys[0], '--title', 'Run migrations between 02:00 and 05:00 UTC'], cwd,
    );
    assert.match(out, /title:\s+Run migrations between 02:00 and 05:00 UTC/, out);
    assert.doesNotMatch(out, /title:\s+Run schema migrations outside peak traffic hours/, out);
  });
});

/**
 * Whitespace is not a summary. `normalizeSummary` stores `'   '` as `null`, so
 * accepting it here would mint exactly the item the gate exists to prevent
 * while reporting success — the reason `summaryRequiredAtCreate` normalises
 * before it compares rather than testing for `undefined`.
 */
test('a whitespace-only --summary is refused, not stored as a summary', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { code, out } = run(['lesson-accept', lessonId, keys[0], '--summary', '   '], cwd);
    assert.equal(code, 1, out);
    assert.equal(ruleCount(cwd), 0, out);
  });
});

/* ---------------------------------------------------------------------------
 * The two ways through.
 * ------------------------------------------------------------------------- */

/** Read off the Markdown file rather than off the command's own output line:
 * the file is what every later reader — injection, `show`, `doctor` — will
 * see, and a command that printed a summary and persisted none would satisfy an
 * output assertion completely. */
function ruleFile(cwd: string, id: string): string {
  return readFileSync(path.join(cwd, '.my_context', 'items', 'rule', `${id}.md`), 'utf8');
}

test('--summary creates the rule and the sentence is on disk, stamped against the content', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { code, out } = run(['lesson-accept', lessonId, keys[0], '--summary', SUMMARY], cwd);
    assert.equal(code, 0, out);

    const ruleId = /RULE-[a-z0-9-]+/.exec(out)![0];
    const file = ruleFile(cwd, ruleId);
    assert.ok(file.includes(`summary: ${SUMMARY}`), `the summary must be persisted:\n${file}`);
    // The STAMP, not only the sentence: a summary with no `summary_of` is
    // `unanchored`, which is a second defect wearing the fix's face.
    assert.match(file, /^summary_of: [0-9a-f]{16}$/m, file);
  });
});

test('the accepted rule with a summary is not reported as summary_absent', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const out = run(['lesson-accept', lessonId, keys[0], '--summary', SUMMARY], cwd).out;
    const ruleId = /RULE-[a-z0-9-]+/.exec(out)![0];

    const doctor = run(['doctor'], cwd).out;
    const absent = doctor.split('\n').filter((line) => line.includes(ruleId) && /has no summary/.test(line));
    assert.deepEqual(absent, [], `the rule this accept created is still summary_absent:\n${doctor}`);
  });
});

/**
 * The named opt-out, and the audit row is the half that makes it an ACT rather
 * than a shrug: an item minted with no summary is invisible to every summary
 * check by construction, so without the row "nobody wrote a summary" and
 * "nobody noticed there was no summary" are the same fact.
 */
test('--summary-omitted creates the rule with no summary and records the omission in the audit log', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { code, out } = run(['lesson-accept', lessonId, keys[0], '--summary-omitted'], cwd);
    assert.equal(code, 0, out);

    const ruleId = /RULE-[a-z0-9-]+/.exec(out)![0];
    assert.doesNotMatch(ruleFile(cwd, ruleId), /^summary: /m, ruleFile(cwd, ruleId));

    const audit = run(['audit', '--limit', '10'], cwd).out;
    const row = audit.split('\n').find((line) => line.includes(ruleId));
    assert.ok(row, `no audit row for ${ruleId}:\n${audit}`);
    assert.match(row, /summary-omitted/, `the omission must be recorded, not assumed:\n${audit}`);
  });
});

/* ---------------------------------------------------------------------------
 * The contradiction.
 * ------------------------------------------------------------------------- */

test('--summary beside --summary-omitted is refused, and nothing is created', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { code, out } = run(
      ['lesson-accept', lessonId, keys[0], '--summary', SUMMARY, '--summary-omitted'], cwd,
    );
    assert.equal(code, 1, out);
    assert.match(out, /say that a summary was written and that none was/, out);
    assert.equal(ruleCount(cwd), 0, out);
  });
});

/**
 * The contradiction is a fact about argv alone, so it is refused before the
 * candidate is printed: nothing about the rule would help a reader who said
 * both "here is the sentence" and "there is no sentence".
 */
test('the contradiction is refused without printing the candidate', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { out } = run(
      ['lesson-accept', lessonId, keys[0], '--summary', SUMMARY, '--summary-omitted'], cwd,
    );
    assert.doesNotMatch(out, /An ACCESS EXCLUSIVE lock queues every write behind it\./, out);
  });
});

/* ---------------------------------------------------------------------------
 * The parser, which the two new flags had to be taught about.
 * ------------------------------------------------------------------------- */

/**
 * `--summary` takes a value, so `positionals` has to step over it. Without that
 * the sentence is read as the `<key>` positional and the command refuses a key
 * that is really a summary — the silent-drop failure this command's flag spec
 * exists to close, wearing a different costume.
 */
test('--summary before the key does not swallow the key', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { code, out } = run(['lesson-accept', lessonId, '--summary', SUMMARY, keys[0]], cwd);
    assert.equal(code, 0, out);
    assert.match(out, /my_context: created RULE-/, out);
  });
});

/**
 * The mirror: `--summary-omitted` is a SWITCH, so `positionals` must NOT step
 * over the token after it. Listed as a value flag, this invocation would lose
 * the key.
 */
test('--summary-omitted before the key does not swallow the key', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { code, out } = run(['lesson-accept', lessonId, '--summary-omitted', keys[0]], cwd);
    assert.equal(code, 0, out);
    assert.match(out, /my_context: created RULE-/, out);
  });
});

/** Two different sentences is two different claims, and answering with one of
 * them drops the other while reporting success — `flag`'s rule, reaching this
 * command because the value is read through it. */
test('--summary given twice is refused rather than resolved to one of them', () => {
  withProject((cwd) => {
    const { lessonId, keys } = stage(cwd);
    const { code, out } = run(
      ['lesson-accept', lessonId, keys[0], '--summary', SUMMARY, '--summary', 'Something else entirely.'], cwd,
    );
    assert.equal(code, 1, out);
    assert.equal(ruleCount(cwd), 0, out);
  });
});

/** The command's own usage line must advertise the flag it now insists on — a
 * hint that omits a required flag is a hint the reader is refused for
 * following. */
test('the usage line advertises --summary and --summary-omitted', () => {
  withProject((cwd) => {
    const usage = run(['lesson-accept'], cwd).out;
    assert.match(usage, /--summary "<one plain sentence>"/, usage);
    assert.match(usage, /--summary-omitted/, usage);
  });
});

/** `lesson-stage` prints the accept command for the reader to run next, and it
 * is the line most likely to be copied. It has to carry the flag the accept
 * will refuse them for omitting. */
test('lesson-stage advertises --summary on the accept line it prints', () => {
  withProject((cwd) => {
    const created = run(['lesson', 'Migrations deadlock when run during peak traffic'], cwd);
    const lessonId = /LESSON-[a-z0-9-]+/.exec(created.out)![0];
    writeFileSync(path.join(cwd, 'r.json'), CANDIDATES, 'utf8');
    const staged = run(['lesson-stage', lessonId, '--file', 'r.json'], cwd);
    const acceptLine = staged.out.split('\n').find((l) => l.startsWith('Accept with:'));
    assert.ok(acceptLine, `no "Accept with:" line:\n${staged.out}`);
    assert.match(acceptLine, /--summary "<one plain sentence>"/, acceptLine);
  });
});
