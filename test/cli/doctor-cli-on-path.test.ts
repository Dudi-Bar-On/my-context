import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `cmdDoctor` wires `checkCliOnPath()` in with the REAL platform lookup —
 * see `checkCliOnPath`'s own unit tests (`test/doctor/cli-on-path.test.ts`)
 * for the three states plus "cannot tell", each exercised with an injected
 * `lookup` so none of THOSE tests depend on this machine's PATH. There is no
 * seam to inject a fake lookup through `runCli`, by design — `cmdDoctor`
 * calls the real one, on purpose, the same way it calls the real `accessSync`
 * for `checkPermissions`. So these tests do not assert WHICH of the three
 * states this machine is in; they assert the WIRING is internally consistent
 * whichever state it turns out to be, which is true on every machine this
 * runs on, linked or not.
 */

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-cli-doc-cli-'));
  runCli(['init'], cwd, () => {});
  mkdirSync(path.join(cwd, 'src', 'db'), { recursive: true });
  writeFileSync(path.join(cwd, 'src', 'db', 'writer.ts'), 'export const x = 1;\n');
  return cwd;
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = project();
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

test('doctor --json always carries a cliOnPath field, null when clean', () => {
  withProject((cwd) => {
    const { out } = run(['doctor', '--json'], cwd);
    const doc = JSON.parse(out) as {
      cliOnPath: { level: string; code: string; message: string } | null;
      counts: { errors: number; warnings: number; infos: number };
      totalErrors: number;
      exitCode: number;
    };
    assert.ok('cliOnPath' in doc, 'the field must be present even when there is nothing to report');
    if (doc.cliOnPath === null) return;
    assert.ok(['error', 'warn', 'info'].includes(doc.cliOnPath.level), doc.cliOnPath.level);
    assert.equal(typeof doc.cliOnPath.code, 'string');
    assert.equal(typeof doc.cliOnPath.message, 'string');
  });
});

test('doctor --json: cliOnPath never inflates counts or totalErrors — it is a separate channel', () => {
  // Regardless of what this machine's PATH says, `counts`/`totalErrors` are
  // the FINDINGS tally alone: a clean corpus with nothing else wrong reports
  // 0 warnings and 0 infos here even if `cliOnPath` is itself a warn or an
  // info. Only an ERROR-level `cliOnPath` may move `exitCode`.
  withProject((cwd) => {
    const { out } = run(['doctor', '--json'], cwd);
    const doc = JSON.parse(out) as {
      cliOnPath: { level: string } | null;
      counts: { errors: number; warnings: number; infos: number };
      totalErrors: number;
      exitCode: number;
    };
    assert.equal(doc.counts.errors, 0);
    assert.equal(doc.counts.warnings, 0);
    assert.equal(doc.counts.infos, 0);
    assert.equal(doc.totalErrors, 0);
    const cliIsError = doc.cliOnPath?.level === 'error';
    assert.equal(doc.exitCode, cliIsError ? 1 : 0);
  });
});

test('doctor (grouped, default): a clean corpus\'s summary counts are exactly 0/0/0 whatever cliOnPath says', () => {
  // This is the assertion `test/docs/fixture.test.ts` and
  // `test/docs/examples.test.ts` already make about a clean fixture's
  // `doctor` output — pinned here again, specifically BECAUSE this task
  // added an environment-dependent check, so a regression that folds it back
  // into `findings`/`counts` (and reintroduces the exact coupling those
  // tests were written to rule out) fails here first, with the reason named.
  withProject((cwd) => {
    const { code, out } = run(['doctor'], cwd);
    assert.match(out, /0 error\(s\), 0 warning\(s\), 0 note\(s\) across 0 finding\(s\)\./);
    // The ONLY way this exits nonzero on an otherwise-clean corpus is an
    // error-level cliOnPath, and that is exactly what the summary text says
    // if it happened — never a silent "0 error(s)" beside a failing exit.
    if (code !== 0) assert.match(out, /mycontext resolves to a DIFFERENT CLI on PATH/);
  });
});

test('doctor --quiet: still exactly one line, whatever cliOnPath says', () => {
  withProject((cwd) => {
    const { out } = run(['doctor', '--quiet'], cwd);
    assert.equal(out.trim().split('\n').length, 1, out);
  });
});
