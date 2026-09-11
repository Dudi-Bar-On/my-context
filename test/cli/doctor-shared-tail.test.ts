// @basis TASK-one-doctor-message-does-two-jobs-so-58000-characters-of-the, INV-nothing-is-dropped-silently
/**
 * **THE TERMINAL DRAWS THE SHARED EXPLANATION ONCE PER CODE GROUP — the half
 * nobody noticed while the screen looked correct.**
 *
 * `TASK-one-doctor-message-does-two-jobs-so-58000-characters-of-the`, re-cut by
 * the owner on 2026-09-07 (plan:walk seq:140, option A): the cut is already
 * proven on `src/ui/public/screens/doctor.js`; *"what is missing is the second
 * reader. The terminal currently gets none of it."* Measured on this
 * repository's own corpus before the change: `mycontext doctor` printed 64,351
 * characters, and one 945-character paragraph accounted for most of it.
 *
 * ── THE TWO HALVES THAT MUST BOTH HOLD ────────────────────────────────────
 *
 * A change that simply printed less would satisfy "fewer characters" and
 * destroy the report, so the lead assertion here is not the saving. It is the
 * one the screen's own tests lead with: **what a finding stops printing is
 * exactly what the note prints once** — the halves join back to the producer's
 * message, nothing deleted, only moved. The saving is asserted underneath it,
 * because a join that holds while nothing moved would be vacuous.
 *
 * ── WHY `--full` IS ASSERTED UNCHANGED ────────────────────────────────────
 *
 * `--full` is documented in `cmdDoctor` as *"the shape to grep, sort or paste
 * into an issue, where the grouped view below is the one to read"*, and its
 * stanzas are sorted by level and code rather than grouped by one. A stanza
 * pasted into an issue alone must carry the whole message, so the cut is not
 * made there — and that is a decision, so it is pinned rather than left to be
 * rediscovered as a bug.
 *
 * ── THE REAL CORPUS, READ ONLY ────────────────────────────────────────────
 *
 * The last two tests read this repository's own `.my_context/` through
 * `loadLayer` and `runChecks` — no store is opened, nothing is rebuilt and
 * nothing is written. They are here because the item names two SENTENCES that
 * must survive the move, by their words, and those sentences exist only in the
 * real `citation_form` findings.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { runChecks } from '../../src/doctor/checks.ts';
import { sharedTail } from '../../src/doctor/shared-tail.ts';
import { loadLayer } from '../../src/core/rebuild.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const MY_CONTEXT_ROOT = path.join(REPO, '.my_context');

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function writeItem(cwd: string, id: string, type: string, frontmatter: string): void {
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    `---\nid: ${id}\ntype: ${type}\ntitle: ${id}\nstatus: active\n${frontmatter}---\n\n# ${id}\n\nBody.\n`,
    'utf8',
  );
}

/**
 * Three items with three dead globs — three REAL `dead_scope` findings from the
 * real check, each naming its own glob and then repeating one long explanation.
 * The repetition is produced by the checker, not typed here, which is what
 * makes this the shape the item is about rather than a fixture of it.
 */
function withDeadScopes(count: number, fn: (cwd: string, globs: string[]) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-doc-tail-'));
  try {
    runCli(['init'], cwd, () => {});
    const globs = Array.from({ length: count }, (_, i) => `src/gone-${i}/**`);
    globs.forEach((glob, i) => {
      writeItem(cwd, `CONST-dead-${i}`, 'constraint', `summary: A summary sentence for this one.\nscope:\n  - "${glob}"\n`);
    });
    fn(cwd, globs);
  } finally {
    removeTree(cwd);
  }
}

function withThreeDeadScopes(fn: (cwd: string, globs: string[]) => void): void {
  withDeadScopes(3, fn);
}

/** The messages the real check produces for that workspace, in group order. */
function deadScopeMessages(cwd: string): string[] {
  const root = path.join(cwd, '.my_context');
  const findings = runChecks({
    root,
    repoRoot: cwd,
    dbPath: path.join(root, 'index.db'),
    items: loadLayer(root, 'project', []),
    config: resolveConfig({}),
  });
  return findings.filter((f) => f.code === 'dead_scope').map((f) => f.message);
}

/**
 * Terminal output is REFLOWED — `paragraph` rewraps every message to the layout
 * budget — so byte-for-byte joining is already surrendered to wrapping, on both
 * halves equally. Whitespace is normalised on both sides of the comparison and
 * nothing else is; a lost word, a reordered clause or an edited character still
 * fails.
 */
function flat(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * One code's block of the grouped report — its heading line, its findings, and
 * its shared note. Headings start at column 0 and everything belonging to a
 * group is indented under one, so the block ends at the next unindented line.
 *
 * Isolating it is what makes the measurement below a measurement of THIS code:
 * adding items to a workspace adds findings of other codes too
 * (`summary_unanchored`, `contradiction_pair`), and counting the whole report
 * would price those in as if they were the repeat.
 */
function groupBlock(out: string, code: string): string {
  const lines = out.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`${code} (`));
  assert.notEqual(start, -1, `no ${code} group in this report:\n${out}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l !== '' && !l.startsWith(' '));
  return lines.slice(start, end === -1 ? undefined : start + 1 + end).join('\n');
}

/** How many times `needle` occurs in `haystack`. */
function occurrences(haystack: string, needle: string): number {
  let n = 0;
  let at = haystack.indexOf(needle);
  while (at !== -1) { n += 1; at = haystack.indexOf(needle, at + 1); }
  return n;
}

test('the shared explanation is printed ONCE for the whole code group, not once per finding', () => {
  withThreeDeadScopes((cwd) => {
    const messages = deadScopeMessages(cwd);
    assert.equal(messages.length, 3, 'three dead globs must make three findings');
    const tail = sharedTail(messages);
    assert.ok(tail.length > 100,
      `three real dead_scope messages share only ${tail.length} characters — the checker got `
      + 'terse or the suffix search broke, and this test would assert nothing either way');

    const { out } = run(['doctor'], cwd);
    assert.equal(occurrences(flat(out), flat(tail)), 1,
      'the terminal is still printing the shared paragraph once per finding. This is the whole '
      + 'defect the item was re-cut down to: the screen collapses it and the terminal did not.');
  });
});

test("a finding's own half plus the shared note is the producer's message, nothing deleted", () => {
  withThreeDeadScopes((cwd, globs) => {
    const messages = deadScopeMessages(cwd);
    const tail = sharedTail(messages);
    const { out } = run(['doctor'], cwd);
    const flattened = flat(out);

    for (const message of messages) {
      const own = message.slice(0, message.length - tail.length);
      assert.ok(flat(own) !== '', 'a finding was left with nothing of its own to say');
      assert.ok(flattened.includes(flat(own)),
        `the terminal no longer prints what is true of this finding alone: ${JSON.stringify(flat(own).slice(0, 80))}`);
      assert.ok(!flattened.includes(flat(own) + ' ' + flat(tail)),
        "this finding's line still runs straight into the shared paragraph — nothing was moved "
        + 'out of it at all');
      assert.equal(flat(own) + ' ' + flat(tail), flat(message),
        'the terminal shortened the WORDS and lost some of the FACTS — what a finding stops '
        + 'printing must be exactly what the note prints once');
    }
    // The half that DIFFERS stays on the finding's own line: each still names
    // its own glob, which is the whole finding.
    for (const glob of globs) {
      assert.ok(flattened.includes(glob), `the finding lost the glob it is about: ${glob}`);
    }
  });
});

test('the note says which code it is the rest of, and how many findings share it', () => {
  withThreeDeadScopes((cwd) => {
    const { out } = run(['doctor'], cwd);
    const flattened = flat(out);
    assert.ok(/dead_scope — the rest of the note, the same on all 3 finding\(s\)/.test(flattened),
      'the shared paragraph is printed with no heading saying whose it is and how many findings '
      + `it answers for, so a reader meets an orphan paragraph:\n${out}`);
  });
});

/**
 * **What "once per code group, not once per finding" costs, as a number.**
 *
 * The same corpus twice, three dead globs and then six, and the question is
 * what the extra three findings ADD to the report. Repeating the paragraph, a
 * finding costs its whole message; drawing it once, a finding costs only the
 * words that are true of it alone and the shared paragraph is already paid for.
 *
 * So the growth per added finding is measured against the length of the repeat
 * itself. That is the comparison the item is about, and it is a bound rather
 * than an exact figure because wrapping moves the exact figure without making
 * it truer.
 */
test('a fourth, fifth and sixth finding of one code cost their own words, not the paragraph again',
  () => {
    let three = 0;
    let six = 0;
    let tail = '';
    withDeadScopes(3, (cwd) => {
      tail = sharedTail(deadScopeMessages(cwd));
      three = groupBlock(run(['doctor'], cwd).out, 'dead_scope').length;
    });
    withDeadScopes(6, (cwd) => {
      assert.equal(deadScopeMessages(cwd).length, 6, 'six dead globs must make six findings');
      six = groupBlock(run(['doctor'], cwd).out, 'dead_scope').length;
    });
    assert.ok(tail.length > 100, `the repeat is only ${tail.length} characters — nothing to measure`);
    const perFinding = (six - three) / 3;
    assert.ok(perFinding < tail.length,
      `each additional finding added ${Math.round(perFinding)} characters to the report and the `
      + `shared paragraph is ${tail.length} — the paragraph is still being printed per finding`);
  });

test('--full is deliberately untouched: a stanza pasted alone still carries the whole message', () => {
  withThreeDeadScopes((cwd) => {
    const messages = deadScopeMessages(cwd);
    const tail = sharedTail(messages);
    const { out } = run(['doctor', '--full'], cwd);
    assert.equal(occurrences(flat(out), flat(tail)), messages.length,
      '--full is the shape to grep, sort and paste into an issue, and its stanzas are not grouped '
      + 'by code. Cutting the tail there hands somebody an issue with half a sentence in it.');
  });
});

/**
 * **The two sentences the item names as the argument, not decoration** — in the
 * terminal's real output, printed ONCE and still whole.
 *
 * They are quoted here by their own words because the item quotes them by their
 * own words: a paraphrase of either is exactly the loss this assertion exists to
 * catch, and a structural check ("the tail is non-empty") would not see it.
 *
 * `citation_form` is the code the item was filed about, so this workspace
 * reproduces it from the real check: three items citing a real file by line
 * number and carrying no fragment. Nothing about the sentences is written here
 * except the sentences.
 */
const LINE_NUMBER_SENTENCE =
  'A line number proves only that the line exists; it cannot say whether the code it named is '
  + 'still there, and a plausible wrong number sends a reader somewhere real.';
const WHY_NOT_SPELLED_OUT =
  'a real citation in this string would be read as one, and a mangled example is exactly what '
  + 'the gate exists to catch';

test('the two sentences the item names survive the move: printed once, word for word', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-doc-cite-'));
  try {
    runCli(['init'], cwd, () => {});
    mkdirSync(path.join(cwd, 'src'), { recursive: true });
    writeFileSync(path.join(cwd, 'src', 'a.ts'), 'export const x = 1;\n', 'utf8');
    for (const n of [1, 2, 3]) {
      const id = `CONST-cite-${n}`;
      const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file,
        `---\nid: ${id}\ntype: constraint\ntitle: ${id}\nstatus: active\n`
        + `summary: A plain summary sentence for this one.\n---\n\n# ${id}\n\n`
        + `See src/a.ts:1${n} for the detail.\n`, 'utf8');
    }
    const { out } = run(['doctor'], cwd);
    const flattened = flat(out);
    assert.ok(/citation_form \(3\)/.test(flattened),
      `this workspace no longer produces three citation_form findings, so nothing below is being `
      + `measured:\n${out}`);

    assert.equal(occurrences(flattened, flat(LINE_NUMBER_SENTENCE)), 1,
      'the sentence about what a line number proves is not printed exactly once. The item names '
      + 'it as the argument, not decoration: losing it is a failure, and repeating it per finding '
      + 'is the defect.');
    assert.equal(occurrences(flattened, flat(WHY_NOT_SPELLED_OUT)), 1,
      'the sentence saying why the form is not spelled out inside the message is not printed '
      + 'exactly once — and it is the reason the message is shaped the way it is.');
  } finally {
    removeTree(cwd);
  }
});

/**
 * The measurement the item asks for *"in as many words"*, taken on the real
 * corpus rather than on a fixture, and asserted as a floor so it cannot quietly
 * become zero. It reads no findings the report does not print: it is the same
 * `runChecks` the command runs, over the same corpus.
 */
test('on this repository\'s own corpus the collapse saves tens of thousands of characters', () => {
  if (!existsSync(MY_CONTEXT_ROOT)) return;
  const findings = runChecks({
    root: MY_CONTEXT_ROOT,
    repoRoot: REPO,
    dbPath: path.join(MY_CONTEXT_ROOT, 'index.db'),
    items: loadLayer(MY_CONTEXT_ROOT, 'project', []),
    config: resolveConfig({}),
  });
  const groups = new Map<string, string[]>();
  for (const f of findings) {
    const bucket = groups.get(f.code) ?? [];
    bucket.push(f.message);
    groups.set(f.code, bucket);
  }
  let saved = 0;
  for (const messages of groups.values()) {
    const tail = sharedTail(messages);
    if (tail !== '') saved += tail.length * (messages.length - 1);
  }
  // 12,083 on 2026-09-11, across nine code groups. The item's own figure was
  // 58,000, measured 2026-08-31 when `citation_form` alone had 61 findings and
  // this corpus has since been repaired down to eight — so the floor is set
  // well under today's reading rather than at it, and it is a floor on the
  // REPEAT, which is the thing that must not quietly become zero.
  assert.ok(saved > 5_000,
    `the repeat on this corpus is only ${saved} characters (12,083 when this was written, and `
    + '58,000 when the item was filed). A small number here means the grouping stopped finding '
    + 'it, not that the prose got shorter.');
});
