/**
 * `mycontext focus`, over a real workspace.
 *
 * The cases that matter most are the ones where a plausible implementation
 * would be silently wrong: a preview that writes, a `--clear` that also sets, a
 * report that disagrees with what the next injection would actually do, and a
 * `severity: hard` item that a narrowing removes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readAudit } from '../../src/core/audit.ts';
import { focusPath, readFocus } from '../../src/core/focus.ts';
import { buildInjection } from '../../src/core/inject.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

interface Project { cwd: string; root: string; dispose(): void }

function project(): Project {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-focus-cli-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  return { cwd, root: resolveWorkspace(cwd).projectRoot!, dispose: () => removeTree(cwd) };
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += `${s}\n`; });
  return { code, out };
}

/** Two soft rules on different tags, plus one hard invariant on neither. */
function seed(cwd: string): void {
  run(['add', '--summary-omitted', 'rule', 'Charge in integer cents', '--tags', 'billing', '--yes'], cwd);
  run(['add', '--summary-omitted', 'rule', 'Rotate the session token hourly', '--tags', 'auth', '--yes'], cwd);
  run(['add', '--summary-omitted', 'invariant', 'Hooks fail open', '--tags', 'hooks', '--severity', 'hard', '--yes'], cwd);
}

test('with no focus set, the command says so rather than printing an empty report', () => {
  const p = project();
  try {
    const { code, out } = run(['focus'], p.cwd);
    assert.equal(code, 0);
    assert.match(out, /^my_context: no focus is set — every eligible item is injectable\.$/m);
  } finally {
    p.dispose();
  }
});

test('setting a focus writes it, reports what it hides, and audits the change', () => {
  const p = project();
  try {
    seed(p.cwd);
    const { code, out } = run(['focus', 'billing', '--yes'], p.cwd);
    assert.equal(code, 0);
    assert.match(out, /^focus: tags: billing$/m);
    assert.match(out, /hidden by focus/);
    assert.match(out, /RULE-rotate-the-session-token-hourly/);
    assert.equal(readFocus(p.root).focus?.tags[0], 'billing');

    const records = readAudit(p.root).filter((r) => r.kind === 'focus');
    assert.deepEqual(records.map((r) => [r.op, r.origin, r.note]), [
      ['focus-set', 'human', 'tags: billing'],
    ]);
  } finally {
    p.dispose();
  }
});

/**
 * The hard exemption, through the command a user actually runs — and the
 * negative half beside it, because a build in which focus hid nothing at all
 * would satisfy "the invariant is still visible" perfectly.
 */
test('a severity:hard item survives a focus that excludes it, and the soft one does not', () => {
  const p = project();
  try {
    seed(p.cwd);
    const { out } = run(['focus', 'billing', '--yes'], p.cwd);
    assert.match(out, /severity:hard item\(s\) do not match this focus and are injected anyway/);
    assert.match(out, /^ {2}INV-hooks-fail-open$/m);
    const hiddenSection = out.slice(out.indexOf('hidden by focus'), out.indexOf('0 load-bearing'));
    assert.match(hiddenSection, /RULE-rotate-the-session-token-hourly/);
    assert.doesNotMatch(hiddenSection, /INV-hooks-fail-open/);
  } finally {
    p.dispose();
  }
});

/**
 * **The preview and the injection are the same computation.** This is the
 * assertion that would fail the moment a second predicate appeared: it takes
 * the ids the preview called hidden and checks that a real injection, built by
 * `buildInjection` through the hook path, contains none of them.
 */
test('what the preview says is hidden is what the next injection actually omits', () => {
  const p = project();
  try {
    seed(p.cwd);
    run(['focus', 'billing', '--yes'], p.cwd);
    const injected = buildInjection(p.cwd, { event: 'session-start', sessionId: 'sess-focus' });
    assert.match(injected, /RULE-charge-in-integer-cents/);
    assert.doesNotMatch(injected, /RULE-rotate-the-session-token-hourly/);
    assert.match(injected, /_Focus is active \(tags: billing\)\. 1 item\(s\) hidden by focus/);
  } finally {
    p.dispose();
  }
});

test('--preview reports and writes nothing at all', () => {
  const p = project();
  try {
    seed(p.cwd);
    const { code, out } = run(['focus', 'billing', '--preview'], p.cwd);
    assert.equal(code, 0);
    assert.match(out, /^my_context: preview only — nothing was changed\.$/m);
    assert.match(out, /^Apply it by running the same command without --preview\.$/m);
    assert.equal(existsSync(focusPath(p.root)), false);
    assert.deepEqual(readAudit(p.root).filter((r) => r.kind === 'focus'), []);
  } finally {
    p.dispose();
  }
});

test('--clear removes the focus and records it; clearing nothing says so and records nothing', () => {
  const p = project();
  try {
    seed(p.cwd);
    assert.match(run(['focus', '--clear', '--yes'], p.cwd).out, /there was no focus to clear/);
    assert.deepEqual(readAudit(p.root).filter((r) => r.kind === 'focus'), []);

    run(['focus', 'billing', '--yes'], p.cwd);
    const { code, out } = run(['focus', '--clear', '--yes'], p.cwd);
    assert.equal(code, 0);
    assert.match(out, /focus cleared\. Every eligible item is injectable again\./);
    assert.equal(existsSync(focusPath(p.root)), false);
    assert.deepEqual(
      readAudit(p.root).filter((r) => r.kind === 'focus').map((r) => r.op),
      ['focus-set', 'focus-clear'],
    );
  } finally {
    p.dispose();
  }
});

/**
 * Refused, not resolved. "Clear then set" and "clear, ignoring the tag" are
 * both readings of `--clear --tag x`, and honouring either drops an instruction
 * the caller typed — the failure this project keeps finding.
 */
test('--clear alongside axes is refused, and changes nothing', () => {
  const p = project();
  try {
    seed(p.cwd);
    run(['focus', 'billing', '--yes'], p.cwd);
    const { code, out } = run(['focus', 'auth', '--clear'], p.cwd);
    assert.equal(code, 1);
    assert.match(out, /--clear takes no axes/);
    assert.equal(readFocus(p.root).focus?.tags[0], 'billing', 'the existing focus must survive a refusal');
  } finally {
    p.dispose();
  }
});

test('a damaged focus file is reported by the command and exits 1', () => {
  const p = project();
  try {
    mkdirSync(path.join(p.root, 'state'), { recursive: true });
    writeFileSync(focusPath(p.root), 'not json at all', 'utf8');
    const { code, out } = run(['focus'], p.cwd);
    assert.equal(code, 1);
    assert.match(out, /so NO focus is in effect and nothing is hidden/);
  } finally {
    p.dispose();
  }
});

test('--relations prints the classification, both classes and the default', () => {
  const p = project();
  try {
    const { code, out } = run(['focus', '--relations'], p.cwd);
    assert.equal(code, 0);
    assert.match(out, /^ {2}blocks {2,}load-bearing$/m);
    assert.match(out, /^ {2}derived_from {2,}referential$/m);
    assert.match(out, /An unlisted relation type counts as load-bearing\./);
  } finally {
    p.dispose();
  }
});

test('--json returns the report as data, including every hidden id', () => {
  const p = project();
  try {
    seed(p.cwd);
    // `--yes` is what keeps this stream PARSEABLE, and that is the half worth
    // stating: `confirmAction` prints its question through the same `out` the
    // report goes to, so the confirmation and `--json` are only compatible
    // because answering it in the argv means nothing is printed. Without it and
    // off a TTY the command refuses in prose and exits 1 — nothing to parse,
    // by design. The remaining gap is a person on a TTY who asks for `--json`
    // and does not pass `--yes`: they get the prompt line ahead of the
    // document. Recorded rather than fixed, because the fix is a second output
    // stream and this command has one.
    const { out } = run(['focus', 'billing', '--json', '--yes'], p.cwd);
    const report = JSON.parse(out) as { hidden: string[]; exemptHard: string[]; universe: string };
    assert.deepEqual(report.hidden, ['RULE-rotate-the-session-token-hourly']);
    assert.deepEqual(report.exemptHard, ['INV-hooks-fail-open']);
    assert.equal(report.universe, 'corpus');
  } finally {
    p.dispose();
  }
});

test('an unknown flag is refused with the usage, not accepted and ignored', () => {
  const p = project();
  try {
    const { code, out } = run(['focus', '--domain', 'billing'], p.cwd);
    assert.equal(code, 1);
    assert.match(out, /unknown option "--domain"/);
  } finally {
    p.dispose();
  }
});

/**
 * Focus changes injection and nothing else. A "narrowing" that also narrowed
 * `list` would be a corpus filter wearing a focus's name, and the item a user
 * hid from a session would become one they could no longer find.
 */
test('a hidden item is still listed, shown and searchable', () => {
  const p = project();
  try {
    seed(p.cwd);
    run(['focus', 'billing', '--yes'], p.cwd);
    assert.match(run(['list'], p.cwd).out, /RULE-rotate-the-session-token-hourly/);
    assert.match(run(['show', 'RULE-rotate-the-session-token-hourly'], p.cwd).out, /Rotate the session token/);
    assert.match(run(['search', '--tag', 'auth'], p.cwd).out, /RULE-rotate-the-session-token-hourly/);
  } finally {
    p.dispose();
  }
});

/* ══ THE APPROVAL BOUNDARY, SPLIT BY FORM ════════════════════════════════
 *
 * Owner ruling, 2026-09-04, under
 * `DEC-the-focus-dialog-earns-execute-by-putting-focus-on-the`: **writes take
 * the boundary, the read does not.** `mycontext focus` now accepts `--yes`,
 * which is what puts it on the derived approval boundary at all
 * (`test/helpers/approval-boundary.ts` probes the real parser for it) — but
 * only two of its five forms answer a confirmation with it, and the other
 * three refuse it by name.
 *
 * Both halves are driven here, and BOTH are the test. A suite that only proved
 * the writes are gated would pass just as happily over a command that had put
 * a confirmation in front of `--show`, which is the exact thing the ruling
 * forbids: in the owner's words, asking "are you sure you want to report
 * something?".
 *
 * `runCli` is called with stdin as this process has it, which under
 * `node --test` is not a TTY — so `confirmAction`'s no-terminal branch is the
 * one these cases meet, and "refused without --yes" is measured rather than
 * assumed from a prompt nobody can answer.
 */

/** The three forms that report. Each must refuse `--yes`, by name. */
const READ_FORMS: [string, string[]][] = [
  ['--show', ['focus', '--show', '--yes']],
  ['--relations', ['focus', '--relations', '--yes']],
  ['--preview', ['focus', 'billing', '--preview', '--yes']],
];

test('the reporting forms refuse --yes rather than accepting a confirmation for nothing', () => {
  const p = project();
  try {
    seed(p.cwd);
    for (const [form, argv] of READ_FORMS) {
      const { code, out } = run(argv, p.cwd);
      assert.equal(code, 1, `\`mycontext ${argv.join(' ')}\` must refuse`);
      assert.match(
        out, new RegExp(`--yes means nothing on \`mycontext focus ${form}\``),
        `${form} must name the flag it is refusing, not fail for some other reason`,
      );
      // And it changed nothing while refusing — the point of refusing early.
      assert.deepEqual(readAudit(p.root).filter((r) => r.kind === 'focus'), []);
    }
    // The same three forms WITHOUT the flag are untouched: no prompt, no
    // refusal, no gate. This is the half the ruling is actually about.
    for (const argv of [['focus', '--show'], ['focus', '--relations'],
      ['focus', 'billing', '--preview']]) {
      assert.equal(run(argv, p.cwd).code, 0, `\`mycontext ${argv.join(' ')}\` must still report`);
    }
    assert.deepEqual(readAudit(p.root).filter((r) => r.kind === 'focus'), []);
  } finally {
    p.dispose();
  }
});

test('the two writing forms refuse without --yes, and write nothing while refusing', () => {
  const p = project();
  try {
    seed(p.cwd);
    const set = run(['focus', 'billing'], p.cwd);
    assert.equal(set.code, 1);
    assert.match(set.out, /refusing without confirmation/);
    assert.equal(existsSync(focusPath(p.root)), false, 'a refused set must write no focus file');

    // With the flag, the same line writes — so the refusal above is the GATE
    // and not a command that has simply stopped working.
    assert.equal(run(['focus', 'billing', '--yes'], p.cwd).code, 0);
    assert.equal(readFocus(p.root).focus?.tags[0], 'billing');

    const clear = run(['focus', '--clear'], p.cwd);
    assert.equal(clear.code, 1);
    assert.match(clear.out, /refusing without confirmation/);
    assert.equal(
      readFocus(p.root).focus?.tags[0], 'billing',
      'a refused --clear must leave the standing focus exactly where it was',
    );
    assert.equal(run(['focus', '--clear', '--yes'], p.cwd).code, 0);
    assert.equal(existsSync(focusPath(p.root)), false);
  } finally {
    p.dispose();
  }
});

/**
 * **The confirm names the COST, and that half is NOT driven here — said plainly
 * rather than left to be assumed from a green file.**
 *
 * Focus discloses and allows (plan decision Q2), so the question `confirmAction`
 * asks before a set is built from the same `FocusReport` `--preview` prints —
 * "N item(s) stay in focus and M are hidden from every later session" — computed
 * before anything is written and never re-derived.
 *
 * It is only ever PRINTED on the TTY branch: with `--yes` the question is
 * answered in the argv and never shown, and off a TTY `confirmAction` refuses
 * without asking. `runCli` takes no `isTTY`/`readLine` — `confirmAction` accepts
 * both as parameters, but nothing threads them through the command dispatch —
 * so there is no way to reach that branch from here without a real pty. The
 * wording is therefore unmeasured, and a change that broke it would be caught by
 * nobody. Threading the two parameters through `runCli` is the fix, and it is a
 * signature change across the dispatch that belongs to whoever owns it.
 */

/**
 * **The refusal carries the preview, which is what makes it worth refusing.**
 *
 * Every other boundary command works this way, and `commands/refresh.md` tells
 * the model so in as many words: run it WITHOUT `--yes`, print the preview it
 * produces, hand it back, and treat exit 1 as the expected outcome rather than
 * a failure. A gate whose whole refusal is "rerun with --yes" gives a reader
 * nothing to decide with — and focus is the command whose design is
 * disclose-and-allow, so it is the last one that should ask blind.
 *
 * Both write forms, because they disclose different things: the set names what
 * it would hide, and `--clear` names what is in force and would stop being.
 */
test('a refused write prints what it would have done, so the refusal is worth reading', () => {
  const p = project();
  try {
    seed(p.cwd);
    const set = run(['focus', 'billing'], p.cwd);
    assert.equal(set.code, 1);
    assert.match(set.out, /this focus is NOT set yet — here is what it would do/);
    // 2 in focus, not 1: the hard invariant is exempt and injected anyway, and
    // the preview says so on its own line below. That IS the disclosure this
    // whole shape exists for — a refusal quoting only "1 hidden" would let a
    // reader believe a narrowing they had not been shown the cost of.
    assert.match(set.out, /2 item\(s\) in focus, 1 hidden by focus/);
    assert.match(set.out, /1 severity:hard item\(s\) do not match this focus/);
    assert.match(set.out, /^ {2}RULE-rotate-the-session-token-hourly$/m,
      'the ids it would hide, not merely the count');
    assert.match(set.out, /refusing without confirmation/);
    assert.equal(existsSync(focusPath(p.root)), false);

    run(['focus', 'billing', '--yes'], p.cwd);
    const clear = run(['focus', '--clear'], p.cwd);
    assert.equal(clear.code, 1);
    assert.match(clear.out, /the focus in force is tags: billing/);

    // And with `--yes` the preamble is GONE — the question was answered in the
    // argv, so there is nothing to preview for and the report prints once.
    const applied = run(['focus', '--clear', '--yes'], p.cwd);
    assert.equal(applied.code, 0);
    assert.doesNotMatch(applied.out, /the focus in force is/);
  } finally {
    p.dispose();
  }
});

/**
 * **`--json` stays ONE document, in every branch that can produce one.**
 *
 * `confirmAction` prints its refusal as prose through the same `out` the report
 * goes to, so the preview above is suppressed under `--json`: two documents and
 * a sentence on one stream leaves a parser with nothing. Asserted rather than
 * commented, because the failure is silent — the command still exits 1 and the
 * caller still gets output.
 */
test('--json never emits a document beside the refusal prose', () => {
  const p = project();
  try {
    seed(p.cwd);
    const refused = run(['focus', 'billing', '--json'], p.cwd);
    assert.equal(refused.code, 1);
    assert.doesNotMatch(refused.out, /^\{/m, 'a refused --json run emits no partial document');
    assert.match(refused.out, /refusing without confirmation/);

    const applied = run(['focus', 'billing', '--json', '--yes'], p.cwd);
    assert.equal(applied.code, 0);
    JSON.parse(applied.out);
  } finally {
    p.dispose();
  }
});
