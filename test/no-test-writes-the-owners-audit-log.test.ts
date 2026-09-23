// @basis TASK-the-audit-log-still-records-two-session-ids-that-never, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUDIT_DIR_ENV, auditSegments, readAudit, recordAudit } from './../src/core/audit.ts';
import { buildSubagentStartOutput } from './../src/hooks/subagent-start.ts';
import { removeTree } from './helpers/tmp.ts';

/**
 * **Structural guard: a test writes no row into the OWNER's audit log.**
 *
 * `TASK-the-audit-log-still-records-two-session-ids-that-never`. The delivery
 * log already has this guard — the last test in
 * `test/rules/lane-still-gets-the-no-git-rule.test.ts` asserts against the
 * owner's own `.rules/delivered.jsonl` that running a real door adds nothing to
 * it. The audit log had no equivalent, and this file is it.
 *
 * ── WHAT WAS THERE, MEASURED 2026-09-23 ────────────────────────────────────
 *
 * `.my_context/.audit/` held **422 `subagent-start` records under the session
 * id `lane-still-gets-the-no-git-rule`** (agent `proof`) and 2 under `eyeball`.
 * No session ever had either id. They are two rows per run —
 * `delivery=attempted` and `delivery=complete` — of the
 * `buildSubagentStartOutput` call in that file, which must run against the REAL
 * repository and must not change: `workspaceIsMyContext` compares a workspace's
 * parent against `packageRoot()`, so the developer tier is in force in exactly
 * one directory on this machine and a throwaway workspace cannot stand in for
 * it. `mycontext audit` and the UI's watch screen read this stream, so those
 * ids showed a person lanes that never ran here.
 *
 * ── THE REMEDY IS A STATEMENT, NOT AN INFERENCE ────────────────────────────
 *
 * Owner ruling, 2026-09-23: **not** a `NODE_TEST_CONTEXT` fork on the core
 * side. `rules/delivered.ts` has one and it is right for that module, but
 * product code that detects it is under test and behaves differently is a
 * second, hidden mode nobody declared — and the next test that forgets the
 * convention writes the owner's log again with the product's blessing. The
 * redirect is `AUDIT_DIR_ENV` (`core/audit.ts` · `auditDir`), an environment
 * variable a caller sets out loud, in the same shape
 * `MYCONTEXT_UI_SESSIONS_DIR` and `MYCONTEXT_MIRROR_DIR` are already pinned
 * away from a developer's real directories. A caller that says nothing gets
 * the workspace's own `.audit/`, exactly as before.
 *
 * ── WHY THERE IS NO SCAN FOR "A TEST RESOLVES THE REPOSITORY" ──────────────
 *
 * It cannot be written honestly. **99 files under `test/` resolve the
 * repository root** and almost all do it to READ a source file, a fixture or
 * the corpus, which costs nothing and must keep working; the offending file
 * itself MUST resolve it. The offence is the WRITE, and it happens several
 * frames down inside `recordAudit` from a root the product derived itself with
 * `findProjectRoot`. So the scan below is keyed on the WRITE PATH — the one
 * product entry point that records an audit row against whatever workspace it
 * is pointed at — and everything else here is a measurement.
 *
 * ── WHY THE OFFENDING FILE IS NOT RUN AS A CHILD ───────────────────────────
 *
 * That was the first shape and it is a trap, measured here on 2026-09-23:
 * `node --test <file>` spawned from inside a test inherits `NODE_TEST_CONTEXT`,
 * and a child that sees it **runs nothing, prints nothing and exits 0** — a
 * deliberately failing fixture exits 0 that way and 1 without it. So the run
 * would be vacuously green. `test/core/real-home-guard.test.ts:190` already
 * knows this and `delete`s the variable from its child's environment; that
 * escape is not available here, because `rules/delivered.ts` · `isTestProcess`
 * routes the DELIVERY record on the same variable, so a child without it would
 * write into the owner's `delivered.jsonl` — trading one polluted log for the
 * other. The door is therefore run in process, and what covers the file is the
 * scan.
 *
 * ── THE THREE TESTS, AND WHY NONE IS REDUNDANT ─────────────────────────────
 *
 *  1. The door run in process with the redirect, asserting BOTH that the
 *     owner's segments did not grow AND that the two rows are in the box.
 *     "The owner's log did not grow" is also true of a record dropped on the
 *     floor, and a lost audit row is what `INV-nothing-is-dropped-silently`
 *     forbids — routed and silenced are different outcomes.
 *  2. The scan, so the next file to call that door is caught here rather than
 *     in the owner's log a month later.
 *  3. A workspace with NO override still gets its rows. Without it, a "fix"
 *     that switched the audit log off inside test processes would pass 1 and 2
 *     and blind every other test in this suite.
 */

/** The repository itself — this file sits directly under `test/`. */
const REPO = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PROJECT_ROOT = path.join(REPO, '.my_context');
const TEST_ROOT = fileURLToPath(new URL('.', import.meta.url));

/**
 * The synthetic session the offending call writes under. Held here as the one
 * spelling, because the door below and the count below have to mean the same
 * string or the assertion is about nothing.
 */
const SYNTHETIC = 'lane-still-gets-the-no-git-rule';

/**
 * How many records in the OWNER's log carry `sessionId`.
 *
 * Over `auditSegments`, not over `audit.jsonl` alone: the live file rotates at
 * 8 MiB and this repository has rotated five times, so a count of one file
 * would silently stop seeing the history it is counting. A missing directory is
 * a real, empty history and answers 0 — a fresh clone must not redden this.
 *
 * **One session id and not the whole file**, because the log is live: the
 * owner's UI server records a row for every item body it serves and other
 * lanes' runs append while this one runs, so a total-record count would be a
 * race rather than an assertion. Nothing but a test has ever written this id.
 */
function ownersRows(sessionId: string): number {
  // Asserted rather than assumed: every count below is meaningless if this
  // process is itself pointed somewhere else, and that is a mistake a future
  // preload could make silently.
  assert.equal(
    process.env[AUDIT_DIR_ENV] ?? '', '',
    `${AUDIT_DIR_ENV} is set in this process, so these counts are about a box and not about the `
    + 'owner\'s log',
  );
  const needle = `"sessionId":"${sessionId}"`;
  let n = 0;
  for (const file of auditSegments(PROJECT_ROOT)) {
    let raw: string;
    try { raw = readFileSync(file, 'utf8'); } catch { continue; }
    for (const line of raw.split('\n')) if (line.includes(needle)) n++;
  }
  return n;
}

test('the real subagent door runs against this repository and the OWNER\'s log does not grow', () => {
  const before = ownersRows(SYNTHETIC);

  const box = mkdtempSync(path.join(tmpdir(), 'myctx-audit-routed-'));
  const previous = process.env[AUDIT_DIR_ENV];
  // `<box>/.audit`, for the reason `core/audit.ts` · `AUDIT_DIR_ENV` gives:
  // `private-gitignore.ts` refuses to write the `*` .gitignore into a path
  // carrying no directory this product creates, and discloses the refusal.
  process.env[AUDIT_DIR_ENV] = path.join(box, '.audit');
  let raw: string;
  let routed: string[];
  try {
    raw = buildSubagentStartOutput(
      { session_id: SYNTHETIC, agent_id: 'proof', cwd: REPO }, REPO,
    );
    // The `root` is ignored while the override is set — which is the property
    // under test, so the rows are read back the way any caller reads them
    // rather than by opening the file path this test happens to know.
    routed = readAudit(box).filter((r) => r.sessionId === SYNTHETIC).map((r) => r.op);
  } finally {
    if (previous === undefined) delete process.env[AUDIT_DIR_ENV];
    else process.env[AUDIT_DIR_ENV] = previous;
    removeTree(box);
  }

  // The positive control, and it comes first: "the log did not grow" is a
  // vacuous sentence about a door that never ran.
  assert.notEqual(
    raw, '',
    'the SubagentStart hook produced nothing at all for this workspace, so both assertions below '
    + 'are statements about a door that did not run',
  );

  assert.deepEqual(
    routed, ['subagent-start', 'subagent-start'],
    `the door wrote ${routed.length} record(s) into the box it was told to use. Two are expected `
    + '— `delivery=attempted` before the selection and `delivery=complete` after it — and a count '
    + 'of 0 means the redirect SILENCED the record rather than moving it, which is the failure '
    + '`INV-nothing-is-dropped-silently` forbids and the one `recordAudit` fails open to avoid.',
  );

  const after = ownersRows(SYNTHETIC);
  assert.equal(
    after, before,
    `the door appended ${after - before} record(s) to ${path.join(PROJECT_ROOT, '.audit')} under `
    + `the session id "${SYNTHETIC}" although ${AUDIT_DIR_ENV} named somewhere else. No session `
    + 'ever had that id, and `mycontext audit` and the UI\'s watch screen read this stream, so it '
    + 'shows a person a lane that never ran here.',
  );
});

/**
 * `source` with every comment blanked, newlines kept — `no-bare-rmsync.test.ts`
 * · `blankComments`, and the same reason: without it this file's own header,
 * which names the door it is scanning for, is offender number one. The `:`
 * guard keeps a `https://` in a string from blanking the rest of its line.
 */
function blankComments(source: string): string {
  const out = source.split('');
  const blank = (from: number, to: number): void => {
    for (let i = from; i < to && i < out.length; i++) if (out[i] !== '\n') out[i] = ' ';
  };
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '/' && source[i + 1] === '/' && source[i - 1] !== ':') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      blank(i, stop);
      i = stop;
    } else if (source[i] === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(i, stop);
      i = stop - 1;
    }
  }
  return out.join('');
}

/**
 * Does `source` build a path to the repository ITSELF?
 *
 * Two spellings, which is every one this tree uses — and both are the path
 * EXPRESSION, never the `'../../src/…'` of an import specifier: six other test
 * files call the door legitimately against a workspace they made in `tmpdir()`,
 * and a pattern that matched their import lines would name all six.
 */
export function resolvesRepositoryRoot(source: string): boolean {
  return /path\.(resolve|join)\(\s*import\.meta\.dirname\s*,\s*'\.\.'\s*,\s*'\.\.'\s*\)/.test(source)
    || /new URL\(\s*'\.\.(\/\.\.)?'\s*,\s*import\.meta\.url\s*\)/.test(source);
}

/**
 * Does `source` run the subagent door against THIS repository without ever
 * naming the variable that says where its records go?
 *
 * **The door and not `recordAudit`.** Dozens of tests call `recordAudit`
 * directly, always against a workspace they made themselves, and that is
 * correct and must keep working. `buildSubagentStartOutput` is different: it
 * resolves its own root from a `cwd` with `findProjectRoot`, so the caller does
 * not choose the log it writes — which is exactly how 422 rows reached the
 * owner's.
 *
 * **And only when the file also builds a path to this repository.** The door is
 * harmless against a `tmpdir()` workspace and six files use it that way; what
 * made those 422 rows was the repository's own root reaching it.
 *
 * Naming the variable is what is required, not a particular way of setting it:
 * a scanner that insisted on one spelling of the assignment would be a style
 * check, and the fact that matters is that the file DECIDED where its records
 * go rather than never having thought about it.
 */
export function offends(source: string): boolean {
  const masked = blankComments(source);
  return masked.includes('buildSubagentStartOutput(')
    && resolvesRepositoryRoot(masked)
    && !masked.includes('AUDIT_DIR_ENV');
}

function testFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) testFiles(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

test('no test file runs the subagent door without saying where its records go', () => {
  const files = testFiles(TEST_ROOT);
  // The floor, derived from the tree rather than pinned: a walk that returned
  // nothing would report zero offenders and read as a clean bill of health.
  assert.ok(files.length > 0, `no .ts files were found under ${TEST_ROOT} — the walk is broken`);

  const offenders = files
    .filter((f) => offends(readFileSync(f, 'utf8')))
    .map((f) => path.relative(TEST_ROOT, f));

  assert.deepEqual(
    offenders, [],
    'these test files call `buildSubagentStartOutput`, which resolves its own root and therefore '
    + `its own audit log, without ever naming ${AUDIT_DIR_ENV}. Run against this repository that `
    + `writes into the owner's .my_context/.audit/ under whatever session id the test spelled. `
    + `Set ${AUDIT_DIR_ENV} to a mkdtemp box around the call and restore it afterwards, as `
    + 'test/rules/lane-still-gets-the-no-git-rule.test.ts does:\n' + offenders.join('\n'),
  );
});

test('the scanner finds a PLANTED offender and does not name what is legitimate', () => {
  // Without this, the empty list above is a claim about a scan nobody has seen
  // match — the exact hole `no-bare-rmsync.test.ts` was rewritten to close.
  const REPO_LINE = "const REPO = path.resolve(import.meta.dirname, '..', '..');\n";
  const URL_LINE = "const REPO = fileURLToPath(new URL('../..', import.meta.url));\n";
  const CALL = 'const raw = buildSubagentStartOutput(payload, REPO);\n';

  assert.equal(
    offends(REPO_LINE + CALL), true,
    'the scanner cannot see the shape that wrote 422 rows, so its empty result above means nothing',
  );
  assert.equal(
    offends(URL_LINE + CALL), true, 'the other spelling of the same path must be seen too',
  );
  assert.equal(
    offends(REPO_LINE + 'process.env[AUDIT_DIR_ENV] = box;\n' + CALL), false,
    'a file that names the variable is not an offender — that is the whole remedy',
  );
  assert.equal(
    offends(CALL), false,
    'the door against a workspace of the caller\'s own is legitimate, and six files in this tree '
    + 'do exactly that — a scanner that named them would be tuned away within a week',
  );
  assert.equal(
    offends(`import { x } from '../../src/hooks/subagent-start.ts';\n` + CALL), false,
    'an import specifier is not a path expression; matching one names every legitimate caller',
  );
  assert.equal(
    offends(REPO_LINE + '// ' + CALL), false,
    'a commented-out call is not a call; this file\'s own header would be offender number one',
  );
  assert.equal(
    offends(REPO_LINE + '/**\n * buildSubagentStartOutput(payload, REPO)\n */\n'), false,
    'the same, in a block comment',
  );
  assert.equal(
    offends(REPO_LINE + "const doc = 'https://example.test/x'; buildSubagentStartOutput(p, R);\n"),
    true,
    'a URL in a string blanked the real call that followed it on the same line',
  );
});

test('a workspace with NO override still gets its audit rows, so nothing above disables the log', () => {
  // The other half. A "fix" that stopped `recordAudit` writing anywhere inside
  // a test process would make everything above green and blind every test in
  // this suite that reads back what it just recorded. This is what says the
  // redirect is a redirect.
  assert.equal(process.env[AUDIT_DIR_ENV] ?? '', '', `${AUDIT_DIR_ENV} is set, so this is vacuous`);
  const box = mkdtempSync(path.join(tmpdir(), 'myctx-audit-default-'));
  try {
    const root = path.join(box, '.my_context');
    mkdirSync(root, { recursive: true });
    const result = recordAudit(root, {
      kind: 'injection',
      op: 'subagent-start',
      hook: 'SubagentStart',
      sessionId: 'throwaway-box',
      injected: [],
      tokens: 0,
      note: 'delivery=attempted agent=control',
    });
    assert.equal(result.written, true, `the audit append failed: ${result.error ?? 'no reason given'}`);
    assert.deepEqual(
      readAudit(root).map((r) => r.sessionId), ['throwaway-box'],
      'a workspace of its own did not get the row it recorded — the audit log is not being '
      + 'routed away from the owner, it is being switched off',
    );
  } finally {
    removeTree(box);
  }
});
