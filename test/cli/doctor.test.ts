import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { exitCode, summarize } from '../../src/cli/commands/doctor.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { chunkDocument } from '../../src/ingest/chunk.ts';
import { removeTree } from '../helpers/tmp.ts';

const DOC = `# Password policy\n\nPasswords must be at least 12 characters.\n`;

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-cli-doc-'));
  runCli(['init'], cwd, () => {});
  mkdirSync(path.join(cwd, 'src', 'db'), { recursive: true });
  writeFileSync(path.join(cwd, 'src', 'db', 'writer.ts'), 'export const x = 1;\n');
  return cwd;
}

/** Every test runs inside this so a failing assertion still cleans up its
 * temp project — matching test/cli/review.test.ts's `withProject` pattern. */
function withProject(fn: (cwd: string) => void): void {
  const cwd = project();
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

function writeItem(cwd: string, id: string, type: string, frontmatter: string): void {
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---\nid: ${id}\ntype: ${type}\ntitle: ${id}\nstatus: active\n${frontmatter}---\n\n# ${id}\n\nBody.\n`, 'utf8');
}

test('a clean workspace passes with exit 0', () => {
  withProject((cwd) => {
    writeItem(cwd, 'CONST-a', 'constraint', 'scope:\n  - "src/db/**"\n');
    const { code, out } = run(['doctor'], cwd);
    assert.equal(code, 0);
    assert.match(out, /0 error/);
  });
});

test('a dead scope glob is warned about but does not fail', () => {
  withProject((cwd) => {
    writeItem(cwd, 'CONST-a', 'constraint', 'scope:\n  - "src/legacy/**"\n');
    const { code, out } = run(['doctor'], cwd);
    assert.equal(code, 0, 'a warning must not break the build the day a directory is renamed');
    assert.match(out, /dead_scope/);
    assert.match(out, /src\/legacy/);
    assert.match(out, /1 warning/);
  });
});

test('a missing source document is an error and exits 1', () => {
  withProject((cwd) => {
    writeItem(cwd, 'REQ-a', 'requirement',
      'source_file: docs/gone.md\nsource_anchor: password-policy\nsource_checksum: abc123\n');
    const { code, out } = run(['doctor'], cwd);
    assert.equal(code, 1);
    assert.match(out, /source_missing/);
    assert.match(out, /docs\/gone\.md/);
  });
});

test('source drift is detected against the live document', () => {
  withProject((cwd) => {
    mkdirSync(path.join(cwd, 'docs'), { recursive: true });
    const chunk = chunkDocument(DOC)[0];
    writeFileSync(path.join(cwd, 'docs', 'prd.md'), DOC.replace('12', '16'), 'utf8');
    writeItem(cwd, 'REQ-a', 'requirement',
      `source_file: docs/prd.md\nsource_anchor: ${chunk.anchor}\nsource_checksum: "${chunk.checksum}"\n`);

    const { code, out } = run(['doctor'], cwd);
    assert.equal(code, 0, 'drift is a warning: it needs a human, not a broken build');
    assert.match(out, /source_drift/);
    assert.match(out, /REQ-a/);
  });
});

test('an orphan relation is reported with both ends', () => {
  withProject((cwd) => {
    const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-a.md');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `---\nid: CONST-a\ntype: constraint\ntitle: A\nstatus: active\n---\n\n# A\n\n## Relations\n- derived_from [[ADR-gone]]\n`, 'utf8');
    const { out } = run(['doctor'], cwd);
    assert.match(out, /orphan_relation/);
    assert.match(out, /ADR-gone/);
  });
});

test('findings are grouped by code so a hundred dead globs read as one problem', () => {
  withProject((cwd) => {
    for (let i = 0; i < 3; i++) writeItem(cwd, `CONST-${i}`, 'constraint', `scope:\n  - "src/gone${i}/**"\n`);
    const { out } = run(['doctor'], cwd);
    assert.equal((out.match(/^dead_scope/gm) ?? []).length, 1);
    assert.match(out, /dead_scope \(3\)/);
  });
});

test('doctor --quiet prints only the summary line', () => {
  withProject((cwd) => {
    writeItem(cwd, 'CONST-a', 'constraint', 'scope:\n  - "src/legacy/**"\n');
    const { code, out } = run(['doctor', '--quiet'], cwd);
    assert.equal(out.trim().split('\n').length, 1);
    assert.match(out, /1 warning/);
    // The quiet branch has its own `failed ? 1 : 0` return, separate from
    // the verbose branch's — a warn-only run must still exit 0 here too.
    assert.equal(code, 0);
  });
});

test('doctor --quiet still exits 1 on an error-level finding', () => {
  withProject((cwd) => {
    writeItem(cwd, 'REQ-a', 'requirement',
      'source_file: docs/gone.md\nsource_anchor: password-policy\nsource_checksum: abc123\n');
    const { code, out } = run(['doctor', '--quiet'], cwd);
    assert.equal(code, 1);
    assert.match(out, /1 error/);
  });
});

// A load error is a corpus-health signal doctor must surface even under
// --quiet — `--quiet` trims the per-finding detail, not the load errors.
test('doctor --quiet still reports an unrelated load error and exits 1', () => {
  withProject((cwd) => {
    mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
    writeFileSync(path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-broken.md'), 'no frontmatter here\n');
    const { code, out } = run(['doctor', '--quiet'], cwd);
    assert.equal(code, 1);
    assert.match(out, /CONST-broken\.md/);
  });
});

// `ORDER` exists specifically so an `error`-level group is never buried
// under a page of warnings — pin that ordering, not just that both appear.
test('grouped output lists error-level codes before warn-level codes', () => {
  withProject((cwd) => {
    writeItem(cwd, 'CONST-a', 'constraint', 'scope:\n  - "src/legacy/**"\n');
    writeItem(cwd, 'REQ-a', 'requirement',
      'source_file: docs/gone.md\nsource_anchor: password-policy\nsource_checksum: abc123\n');
    const { out } = run(['doctor'], cwd);
    const errorLine = out.indexOf('source_missing');
    const warnLine = out.indexOf('dead_scope');
    assert.ok(errorLine >= 0 && warnLine >= 0);
    assert.ok(errorLine < warnLine, 'source_missing (error) must be listed before dead_scope (warn)');
  });
});

// The `finding.item:` prefix is its own piece of the line, not merely text
// that happens to also appear in the message body.
test('a finding with an item id is prefixed with that id, not just mentioned in prose', () => {
  withProject((cwd) => {
    writeItem(cwd, 'CONST-a', 'constraint', 'scope:\n  - "src/legacy/**"\n');
    const { out } = run(['doctor'], cwd);
    assert.match(out, /^  CONST-a: scope glob/m);
  });
});

test('doctor outside a workspace explains how to make one', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-nodoc-'));
  try {
    const { code, out } = run(['doctor'], cwd);
    assert.equal(code, 1);
    assert.match(out, /mycontext init/);
  } finally {
    removeTree(cwd);
  }
});

// Exit-code discipline, pinned per level via the exported `exitCode`
// function directly: only an `error`-level finding (or an unrelated load
// error) fails the build. `warn` and `info` findings are surfaced but exit
// 0. (`index_missing`, the concrete info-level finding, can never actually
// reach the doctor CLI path: `openMutateContext` always creates/opens the
// index before `runChecks` runs, so the file it warns about missing already
// exists by the time the check runs. Testing the mapping directly, rather
// than fishing for a CLI scenario that produces a pure-info result, is what
// actually pins each level to its exit code.)
test('exit code mapping: info-only findings exit 0', () => {
  assert.equal(exitCode(summarize([{ level: 'info', code: 'index_missing', message: 'x' }]), 0), 0);
});

test('exit code mapping: warn-only findings exit 0', () => {
  assert.equal(exitCode(summarize([{ level: 'warn', code: 'dead_scope', message: 'x' }]), 0), 0);
});

test('exit code mapping: an error-level finding exits 1', () => {
  assert.equal(exitCode(summarize([{ level: 'error', code: 'source_missing', message: 'x' }]), 0), 1);
});

test('exit code mapping: mixed info+warn+error exits 1 (error dominates)', () => {
  assert.equal(exitCode(summarize([
    { level: 'info', code: 'index_missing', message: 'x' },
    { level: 'warn', code: 'dead_scope', message: 'x' },
    { level: 'error', code: 'source_missing', message: 'x' },
  ]), 0), 1);
});

test('exit code mapping: no findings but an unrelated load error still exits 1', () => {
  assert.equal(exitCode(summarize([]), 1), 1);
});

test('exit code is 0 with only warn-level findings (dead_scope)', () => {
  withProject((cwd) => {
    writeItem(cwd, 'CONST-a', 'constraint', 'scope:\n  - "src/legacy/**"\n');
    const { code } = run(['doctor'], cwd);
    assert.equal(code, 0);
  });
});

test('exit code is 1 with an error-level finding (source_missing)', () => {
  withProject((cwd) => {
    writeItem(cwd, 'REQ-a', 'requirement',
      'source_file: docs/gone.md\nsource_anchor: password-policy\nsource_checksum: abc123\n');
    const { code } = run(['doctor'], cwd);
    assert.equal(code, 1);
  });
});

test('a mix of warn and error findings still exits 1', () => {
  withProject((cwd) => {
    writeItem(cwd, 'CONST-a', 'constraint', 'scope:\n  - "src/legacy/**"\n');
    writeItem(cwd, 'REQ-a', 'requirement',
      'source_file: docs/gone.md\nsource_anchor: password-policy\nsource_checksum: abc123\n');
    const { code, out } = run(['doctor'], cwd);
    assert.equal(code, 1);
    assert.match(out, /dead_scope/);
    assert.match(out, /source_missing/);
  });
});

// `summarize().infos` — the third of its three fields — was never asserted
// anywhere, which let a mutant hardcoding it to 0 survive. Pin it directly.
test('summarize counts infos, not just errors and warnings', () => {
  const counts = summarize([
    { level: 'info', code: 'index_missing', message: 'x' },
    { level: 'info', code: 'index_missing', message: 'y' },
    { level: 'warn', code: 'dead_scope', message: 'z' },
  ]);
  assert.deepEqual(counts, { errors: 0, warnings: 1, infos: 2 });
});

/**
 * Runs `doctor` against an explicit `Workspace` object, bypassing
 * `resolveWorkspace`'s hardcoded `homedir()`-based `globalRoot` entirely —
 * `CommandDef.run(ws, args, out, cwd)` takes the workspace directly, so a
 * test can override just `globalRoot` with a tempdir and never touch the
 * real home directory. This is what lets the cross-layer item-feeding
 * decision in `doctor.ts` (`ctx.store.all()`, not a project-only filter)
 * actually be verified instead of merely asserted in a comment.
 */
function runWithWorkspace(cwd: string, globalRoot: string, args: string[] = []): { code: number; out: string } {
  const ws = { ...resolveWorkspace(cwd), globalRoot };
  let out = '';
  const def = COMMANDS.get('doctor')!;
  if (def.workspace === 'none') throw new Error('doctor must be a workspace command');
  const code = def.run(ws, args, (s) => { out += s + '\n'; }, cwd);
  return { code, out };
}

test('a relation to a real global-layer item is not an orphan (cross-layer control, present)', () => {
  withProject((cwd) => {
    const globalRoot = mkdtempSync(path.join(tmpdir(), 'myctx-global-'));
    try {
      mkdirSync(path.join(globalRoot, 'items', 'constraint'), { recursive: true });
      writeFileSync(
        path.join(globalRoot, 'config.json'),
        JSON.stringify({ profile: 'standard', categories: {}, budgets: {} }, null, 2) + '\n',
      );
      writeFileSync(
        path.join(globalRoot, 'items', 'constraint', 'CONST-global.md'),
        `---\nid: CONST-global\ntype: constraint\ntitle: Global\nstatus: active\n---\n\n# Global\n\nBody.\n`,
        'utf8',
      );
      const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-a.md');
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(
        file,
        `---\nid: CONST-a\ntype: constraint\ntitle: A\nstatus: active\n---\n\n# A\n\n## Relations\n- derived_from [[CONST-global]]\n`,
        'utf8',
      );

      const { code, out } = runWithWorkspace(cwd, globalRoot);
      assert.doesNotMatch(out, /orphan_relation/);
      assert.equal(code, 0);
    } finally {
      removeTree(globalRoot);
    }
  });
});

// The control for the test above: point globalRoot at a directory that does
// NOT contain CONST-global, so the same relation genuinely IS an orphan.
// Without this control, a mutant that always reports 0 findings would pass
// the "present" test above for the wrong reason.
test('the same relation IS an orphan when the global-layer item genuinely does not exist (cross-layer control, absent)', () => {
  withProject((cwd) => {
    const globalRoot = path.join(cwd, 'nonexistent-global-root');
    const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-a.md');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(
      file,
      `---\nid: CONST-a\ntype: constraint\ntitle: A\nstatus: active\n---\n\n# A\n\n## Relations\n- derived_from [[CONST-global]]\n`,
      'utf8',
    );

    const { code, out } = runWithWorkspace(cwd, globalRoot);
    assert.match(out, /orphan_relation/);
    assert.match(out, /CONST-global/);
    assert.equal(code, 0, 'orphan_relation is warn-level, not error-level');
  });
});

// Pin ordering within the same level, not just across levels — codes tie
// at warn, so they must sort alphabetically (dead_scope before source_drift).
test('within the same level, grouped codes are ordered alphabetically', () => {
  withProject((cwd) => {
    mkdirSync(path.join(cwd, 'docs'), { recursive: true });
    const chunk = chunkDocument(DOC)[0];
    writeFileSync(path.join(cwd, 'docs', 'prd.md'), DOC.replace('12', '16'), 'utf8');
    writeItem(cwd, 'REQ-a', 'requirement',
      `source_file: docs/prd.md\nsource_anchor: ${chunk.anchor}\nsource_checksum: "${chunk.checksum}"\n`);
    writeItem(cwd, 'CONST-a', 'constraint', 'scope:\n  - "src/legacy/**"\n');

    const { out } = run(['doctor'], cwd);
    const deadScopeLine = out.indexOf('dead_scope');
    const sourceDriftLine = out.indexOf('source_drift');
    assert.ok(deadScopeLine >= 0 && sourceDriftLine >= 0);
    assert.ok(deadScopeLine < sourceDriftLine, 'both are warn-level: "dead_scope" < "source_drift" alphabetically');
  });
});

// The summary line's total must reflect the actual finding count, not a
// value derived independently that could drift from what was printed above it.
test('the summary total matches the number of individually printed findings', () => {
  withProject((cwd) => {
    for (let i = 0; i < 3; i++) writeItem(cwd, `CONST-${i}`, 'constraint', `scope:\n  - "src/gone${i}/**"\n`);
    const { out } = run(['doctor'], cwd);
    assert.match(out, /across 3 finding\(s\)/);
  });
});

/* -------------------------------------------------------------------------- *
 * nested_corpus — the one variant the 2026-08-26 fixes do not cover.
 *
 * That day's failure was a working directory ABOVE the corpus: `findProjectRoot`
 * walked up, found nothing, and both injection tiers returned '' in silence for
 * nine days. The fixes cover it — the JIT tier resolves from the FILE, and a
 * missing workspace now discloses.
 *
 * This is the same failure with the cwd BELOW the corpus, and neither fix
 * reaches it: `findProjectRoot` stops at the FIRST `.my_context` it meets, and
 * resolving from the file finds that same nearest root. Nothing is missing, so
 * nothing warns — a session started one directory in simply gets a different
 * corpus. On this repository that is 44 items and zero tasks against 510 and
 * 361, which reads as a board that emptied itself.
 * -------------------------------------------------------------------------- */

test('a corpus nested inside the repository is reported, and the workspace\'s own is not', () => {
  withProject((cwd) => {
    // The workspace's own root must never be reported as shadowing itself.
    const clean = runWithWorkspace(cwd, mkdtempSync(path.join(tmpdir(), 'myctx-g-')));
    assert.equal(/nested_corpus/.test(clean.out), false,
      'the workspace reported ITSELF as a nested corpus');

    mkdirSync(path.join(cwd, 'vendored', 'plugin', '.my_context', 'items'), { recursive: true });
    const found = runWithWorkspace(cwd, mkdtempSync(path.join(tmpdir(), 'myctx-g-')));
    assert.match(found.out, /nested_corpus/,
      'a second .my_context below the repository root shadows every session started at or below '
      + 'it, and nothing else in this product would say so');
    assert.match(found.out, /vendored\/plugin\/\.my_context/,
      'the finding must name WHERE — a reader cannot cd out of a path they were not told');
  });
});

test('a corpus under a fixture directory is not reported — the check must stay readable', () => {
  withProject((cwd) => {
    // Measured on the real repository: the first draft returned four hits, one
    // real and three fixtures. A check whose true positives are outnumbered is
    // one people learn to scroll past.
    for (const dir of ['test', 'harness', '.demo-corpus']) {
      mkdirSync(path.join(cwd, dir, 'ws', '.my_context', 'items'), { recursive: true });
    }
    const out = runWithWorkspace(cwd, mkdtempSync(path.join(tmpdir(), 'myctx-g-'))).out;
    assert.equal(/nested_corpus/.test(out), false,
      'a corpus under test/, harness/ or .demo-corpus/ is a fixture, not a workspace anyone '
      + 'starts a session in');
  });
});
