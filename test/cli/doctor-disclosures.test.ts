/**
 * **A NOTE A CHECK MAKES ABOUT ITSELF IS NOT A ROW OF WORK — and this file is
 * the owner's acceptance test for that.**
 *
 * Owner, 2026-09-03, having asked for the three self-describing lines to be
 * dealt with: *"after you complete handling them, the test should be that they
 * will not be listed anymore at doctor list"*. The standing objection behind it
 * is older and broader — *"the main problem is that even the user has no tools
 * to solve them"* — and the rule above `interface Finding` (src/doctor/checks.ts)
 * already answers half of it: what a check cannot judge is disclosed once and
 * never per item. **What was left is that the disclosure was still COUNTED and
 * LISTED.** A row that says "nothing is owed" is still a row he has to read and
 * dismiss.
 *
 * `Finding.about` marks one, `partitionFindings` routes it, and `emitDisclosures`
 * prints it under its own heading after the summary.
 *
 * ── THE TWO HALVES THAT MUST BOTH HOLD ────────────────────────────────────
 *
 * A change that hid everything would satisfy "zero findings" and destroy the
 * product, so every test below that asserts a disclosure LEAVES the count is
 * paired with one asserting a real finding on the same corpus STAYS. The
 * end-to-end tests build one workspace carrying both at once, out of one check,
 * so the two cannot be measured against different corpora.
 *
 * ── WHY THE MARKER IS ASSEMBLED AND NEVER WRITTEN OUT ─────────────────────
 *
 * `checkCitationForm` refuses to print the `historical-citation` spelling in its
 * own messages, because a real marker written into a source file is read as one
 * by the gate that walks the repository. The same refusal applies here: this
 * file writes the marker by concatenation so no line of it is a specimen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import {
  disclosureAbout, exitCode, isDisclosure, partitionFindings, summarize,
} from '../../src/cli/commands/doctor.ts';
import { REMEDY, type Finding } from '../../src/doctor/checks.ts';
import { removeTree } from '../helpers/tmp.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-doc-disc-'));
  runCli(['init'], cwd, () => {});
  mkdirSync(path.join(cwd, 'src', 'db'), { recursive: true });
  writeFileSync(path.join(cwd, 'src', 'db', 'writer.ts'), 'export const x = 1;\n');
  return cwd;
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = project();
  try { fn(cwd); } finally { removeTree(cwd); }
}

function writeItem(cwd: string, id: string, body: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'task', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    `---\nid: ${id}\ntype: task\ntitle: ${id}\nstatus: active\n---\n\n# ${id}\n\n${body}\n`,
    'utf8',
  );
}

/** The marker, assembled — see the header. */
const MARKER = `<!-- ${'historical'}-citation: quoted so it can be named as stale -->`;

/**
 * A pointer `checkCitationForm` reports, and one it excuses, in one body.
 *
 * **Both bodies close on an ordinary sentence**, and that is not decoration:
 * `checkBodyTruncation` reports `body_ends_unfinished` on a body ending in
 * `-->`, so a fixture ending on the marker would differ from its control by a
 * finding as well as by the disclosure — and the pair of runs below is worth
 * nothing unless the disclosure is the only difference between them.
 */
const DEFECT_LINE = 'See `src/db/writer.ts:12` for the writer.';
const SPECIMEN_LINE = `The old note said \`src/db/writer.ts:34\`. ${MARKER}`;
const CLOSE = 'Nothing else is recorded here.';
const BODY_PLAIN = `${DEFECT_LINE}\n\n${CLOSE}\n`;
const BODY_NOTED = `${DEFECT_LINE}\n\n${SPECIMEN_LINE}\n\n${CLOSE}\n`;

const NOTE: Finding = {
  level: 'info', code: 'state_audit_coverage', about: 'state_unaudited',
  message: 'nothing is owed on this line.', remedy: REMEDY.NOTHING,
};
const REAL: Finding = {
  level: 'info', code: 'state_unaudited', item: 'TASK-a',
  message: 'a question a person can answer.', remedy: REMEDY.ACK,
};

// ── The marker, read off a Finding ──────────────────────────────────────────

test('a disclosure is recognised by `about`, and the empty string is not one', () => {
  assert.equal(disclosureAbout(NOTE), 'state_unaudited');
  assert.equal(isDisclosure(NOTE), true);
  assert.equal(disclosureAbout(REAL), undefined);
  assert.equal(isDisclosure(REAL), false);
  // `''` is a disclosure with no check to draw it under — worse than not being
  // one, because the screen keys the note by this value and would file it under
  // an empty heading. Both spellings of absence answer the same thing.
  assert.equal(isDisclosure({ ...NOTE, about: '' }), false,
    'an empty `about` is a call site that meant to name a check and named nothing');
});

test('partitionFindings splits the run and drops neither half', () => {
  const { findings, disclosures } = partitionFindings([REAL, NOTE, REAL]);
  assert.deepEqual(findings, [REAL, REAL]);
  assert.deepEqual(disclosures, [NOTE]);
  // `INV-nothing-is-dropped-silently`: the two halves are the whole run. A
  // partition that lost one is the failure this whole change must not become.
  assert.equal(findings.length + disclosures.length, 3);
});

// ── The count, and the exit code it feeds ───────────────────────────────────

test('summarize counts findings and never a disclosure — at every level', () => {
  assert.deepEqual(summarize([REAL, NOTE]), { errors: 0, warnings: 0, infos: 1 },
    'the note must not be counted, and the finding beside it must still be');
  assert.deepEqual(
    summarize([
      { ...NOTE, level: 'error' }, { ...NOTE, level: 'warn' }, { ...NOTE, level: 'info' },
    ]),
    { errors: 0, warnings: 0, infos: 0 },
    'the filter is on `about` and not on the level, so a disclosure emitted at any level '
    + 'stays out of the numbers a reader treats as a worklist');
});

/**
 * **The exit code has never moved for a disclosure and must not start.**
 *
 * `exitCode` reads `counts.errors`, so this is really a test that `summarize`
 * subtracts BEFORE it is asked — which is the safe direction and is why the
 * filter lives inside `summarize` rather than only at the call site. The
 * error-level case is deliberately unreachable today (a disclosure states what
 * a check could not measure, which is never a corpus defect); it is pinned
 * anyway, because "unreachable" is a property of the checks that exist and this
 * arithmetic outlives them.
 */
test('a disclosure cannot move the exit code, whatever level it is emitted at', () => {
  assert.equal(exitCode(summarize([NOTE]), 0), 0);
  assert.equal(exitCode(summarize([{ ...NOTE, level: 'error' }]), 0), 0,
    'a note has never failed a build');
  assert.equal(exitCode(summarize([{ ...NOTE, level: 'error' }, { ...REAL, level: 'error' }]), 0), 1,
    'and it does not shield a real error standing beside it either');
  assert.equal(exitCode(summarize([NOTE]), 1), 1, 'a load error still decides on its own');
});

// ── The whole command, over a corpus carrying both at once ──────────────────

/**
 * One item, one check, two lines: a bare pointer that `citation_form` reports
 * and a bare pointer excused by a marker, which makes `citation_form_excused`
 * — a disclosure carrying `about: 'citation_form'` — fire in the same run.
 *
 * **This is the acceptance test.** The finding lists and is counted; the
 * disclosure lists nowhere as a row, is counted nowhere, and every character of
 * it still prints under its own heading.
 */
test('the finding still lists and still counts; the disclosure beside it does neither', () => {
  withProject((cwd) => {
    writeItem(cwd, 'TASK-a', BODY_NOTED);
    const { code, out } = run(['doctor'], cwd);

    // THE REAL FINDING. A row, under its code's group heading, naming its item.
    assert.match(out, /^citation_form \(1\)/m,
      'a genuine defect must still be a row — an implementation that hides everything passes '
      + 'the letter of "zero findings" and defeats the product');
    assert.match(out, /TASK-a: 1 citation\(s\) point by line number/);

    // THE DISCLOSURE. Not a group heading, so not a row.
    assert.equal(/^citation_form_excused \(/m.test(out), false,
      'a note about a check must not be drawn as a group of findings');

    // ...and its text is all still there, under its own heading, naming the
    // check it is about. `RULE-say-what-your-check-cannot-see-when-you-report-it-green`
    // requires the text; `INV-nothing-is-dropped-silently` forbids losing it.
    assert.match(out, /citation_form_excused — about the `citation_form` check/);
    assert.match(out, /1 bare pointer\(s\) across 1 item\(s\) are excused as SPECIMENS/);
    assert.match(out, /notes about the checks themselves/);

    // THE COUNT. `summary_absent` rides along on any hand-written item, so the
    // assertion is on the DIFFERENCE the disclosure makes rather than on a
    // total: the note is not in `finding(s)`, and the citation_form row is.
    const total = /across (\d+) finding\(s\)/.exec(out);
    assert.notEqual(total, null);
    const listed = (out.match(/^[a-z_]+ \(\d+\)  \[/gm) ?? [])
      .map((h) => Number(/\((\d+)\)/.exec(h)![1]))
      .reduce((a, b) => a + b, 0);
    assert.equal(Number(total![1]), listed,
      'the summary total is exactly the number of rows drawn above it — the invariant '
      + '`the summary total matches the number of individually printed findings` already '
      + 'holds, and a note counted but not drawn would break it');
    assert.equal(code, 0);
  });
});

/**
 * **The disclosure changes NOTHING about the run except its own line.** Two
 * corpora identical but for the excused specimen: same exit code, same finding
 * count, same rows. Without this, "the count went down" could as easily be the
 * marker suppressing a real finding.
 */
test('adding a disclosure to a corpus moves no count and no exit code', () => {
  withProject((cwd) => {
    writeItem(cwd, 'TASK-a', BODY_PLAIN);
    const plain = run(['doctor'], cwd);
    writeItem(cwd, 'TASK-a', BODY_NOTED);
    const noted = run(['doctor'], cwd);

    assert.equal(plain.code, noted.code, 'a disclosure has never moved the exit code');
    const count = (out: string): string => /doctor: (.*?) finding\(s\)/.exec(out)![1]!;
    assert.equal(count(plain.out), count(noted.out),
      'the summary line is character for character the same; the note is not in it');
    assert.equal(/citation_form_excused/.test(plain.out), false);
    assert.match(noted.out, /citation_form_excused/);
  });
});

test('doctor --quiet is still exactly one line, and the note is not on it', () => {
  withProject((cwd) => {
    writeItem(cwd, 'TASK-a', BODY_NOTED);
    const { out } = run(['doctor', '--quiet'], cwd);
    const lines = out.trim().split('\n').filter((l) => !l.startsWith('my_context: '));
    assert.equal(lines.length, 1, '`doctor --quiet prints only the summary line` still holds');
    assert.equal(/citation_form_excused/.test(lines[0]!), false);
  });
});

test('doctor --full prints the note after the summary, not among the stanzas', () => {
  withProject((cwd) => {
    writeItem(cwd, 'TASK-a', BODY_NOTED);
    const { out } = run(['doctor', '--full'], cwd);
    const summaryAt = out.indexOf('my_context doctor: ');
    const noteAt = out.indexOf('citation_form_excused');
    assert.ok(summaryAt >= 0 && noteAt > summaryAt,
      'a fact that is real, printed and NOT a finding goes after the count — the place and '
      + 'the reason `emitCliPathFinding` established one field over');
    assert.match(out, /^info {2}citation_form$/m,
      'and the real finding still gets its stanza in the shape you grep and paste');
  });
});

/**
 * **The machine-readable document takes the same split, under its own key.**
 * `cliOnPath` made this choice first and for the identical reason: a consumer
 * gating CI on `findings.length` must not be handed a note, and a consumer that
 * wants the note must not have to parse prose for it.
 */
test('doctor --json: counts and findings exclude the note; `disclosures` carries it whole', () => {
  withProject((cwd) => {
    writeItem(cwd, 'TASK-a', BODY_NOTED);
    const { code, out } = run(['doctor', '--json'], cwd);
    const doc = JSON.parse(out) as {
      counts: { errors: number; warnings: number; infos: number };
      totalErrors: number; exitCode: number;
      findings: Finding[]; disclosures: Finding[];
    };
    assert.equal(doc.findings.some((f) => f.code === 'citation_form_excused'), false);
    assert.equal(doc.findings.some((f) => f.code === 'citation_form'), true,
      'the real finding is still served, still in the array a consumer reads');
    assert.equal(doc.disclosures.length, 1);
    assert.equal(doc.disclosures[0]!.about, 'citation_form');
    assert.match(doc.disclosures[0]!.message, /excused as SPECIMENS/);
    assert.equal(doc.exitCode, code, 'the document and the process still agree');
    assert.equal(doc.totalErrors > 0, doc.exitCode === 1);
  });
});

test('doctor --json always carries `disclosures`, as [] when there are none', () => {
  withProject((cwd) => {
    writeItem(cwd, 'TASK-a', BODY_PLAIN);
    const { out } = run(['doctor', '--json'], cwd);
    const doc = JSON.parse(out) as { disclosures?: Finding[] };
    assert.deepEqual(doc.disclosures, [],
      '"checked, none" must be distinguishable from a field an older build never populated');
  });
});
