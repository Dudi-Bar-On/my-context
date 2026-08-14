import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';

/**
 * Registry-driven guard for the plan's F2 rule ("only `status`/`doctor` exit
 * non-zero on an unrelated corpus load error; every other command reports
 * and exits 0" — see `openMutateContext`'s doc comment in
 * `src/cli/commands/context.ts`). By the time task 13 shipped, FIVE separate
 * tasks in this plan had produced a command whose own reference brief got
 * this exact rule wrong — decay's brief among them (see task-13-report.md).
 * The rule lived only in a prose doc comment plus one hand-written
 * "unrelated corrupt item" test per command, and nothing stopped a sixth
 * command from re-deriving it wrong too, or a working command from
 * regressing silently.
 *
 * This test iterates the ACTUAL `COMMANDS` registry rather than a hardcoded
 * list of names, so it self-updates as commands are added, and plants one
 * unrelated corrupt item file before invoking each one through its own
 * legitimate success path. Two failure modes are both covered:
 *   - an existing registered command regresses back to failing on an
 *     unrelated load error (caught by the per-command `assert.equal(code, 0)`
 *     below);
 *   - a NEW command is registered without a corresponding entry in `SETUPS`
 *     (caught by the `assert.ok(setup, ...)` failing loudly, by name, rather
 *     than the command being silently skipped).
 *
 * `status` is not checked here: it is a hardcoded case in `src/cli/index.ts`'s
 * dispatch switch, not a `COMMANDS` registration (see registry.ts's
 * `SHADOWED_BY_SWITCH` comment) — its own F2 exemption is covered by
 * `test/cli/status.test.ts` (or equivalent), outside this registry's reach.
 */
const ALLOWED_NONZERO = new Set(['doctor']);

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-f2-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

/** Plants a corrupt, unrelated item file so `openMutateContext`'s rebuild
 * reports a load error that has nothing to do with the command under test —
 * the same fixture used across `test/cli/review.test.ts`, `lesson.test.ts`,
 * `ingest.test.ts`, and `decay.test.ts` for the identical F2 assertion on
 * their own commands. */
function plantUnrelatedCorruptItem(cwd: string): void {
  mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-broken.md'), 'no frontmatter here\n');
}

function stagedKey(out: string): string {
  const match = /^\s{2}([0-9a-f]{8})\s/m.exec(out);
  assert.ok(match, `no staged key found in output:\n${out}`);
  return match[1];
}

function lessonId(out: string): string {
  const match = /LESSON-[a-z0-9-]+/.exec(out);
  assert.ok(match, `no lesson id found in output:\n${out}`);
  return match[0];
}

function ingestSessionId(out: string): string {
  const match = /ING-[a-z0-9-]+/.exec(out);
  assert.ok(match, `no ingest session id found in output:\n${out}`);
  return match[0];
}

/**
 * Per-command setup that gets a fresh project to the point where the named
 * command can succeed at its own job — required because a command that
 * never gets past its OWN argument/precondition validation never reaches
 * `openMutateContext` at all, and a bare "exit 0" assertion on that would
 * pass for the wrong reason (a usage error, not F2). Each setup plants the
 * unrelated corrupt item itself, as its LAST step, so prep steps (which also
 * run through the CLI) are never themselves masked by the corrupt file.
 * Returns the args to pass to the command under test.
 */
const SETUPS: Record<string, (cwd: string) => string[]> = {
  decay: (cwd) => {
    // A scoped item, not an empty corpus: `decay`'s empty-corpus branch and
    // its full-report branch return through two SEPARATE code paths (see
    // task-13-report.md's F2 finding) — an empty setup here would only ever
    // exercise the first one and could pass even with the second one broken.
    run(['add', 'constraint', 'A scoped item for the F2 guard'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [];
  },

  'ingest-status': (cwd) => {
    plantUnrelatedCorruptItem(cwd);
    return [];
  },

  review: (cwd) => {
    plantUnrelatedCorruptItem(cwd);
    return [];
  },

  ingest: (cwd) => {
    mkdirSync(path.join(cwd, 'docs'), { recursive: true });
    writeFileSync(path.join(cwd, 'docs', 'note.md'), '# Topic\n\nSome text worth extracting.\n', 'utf8');
    plantUnrelatedCorruptItem(cwd);
    return ['docs/note.md'];
  },

  lesson: (cwd) => {
    plantUnrelatedCorruptItem(cwd);
    return ['A lesson learned for the F2 registry guard'];
  },

  'lesson-stage': (cwd) => {
    const created = run(['lesson', 'A lesson worth staging for the F2 guard'], cwd);
    const id = lessonId(created.out);
    writeFileSync(path.join(cwd, 'stage.json'), JSON.stringify([
      { title: 'A staged rule for the F2 guard', directive: 'do', body: 'b' },
    ]), 'utf8');
    plantUnrelatedCorruptItem(cwd);
    return [id, '--file', 'stage.json'];
  },

  'lesson-accept': (cwd) => {
    const created = run(['lesson', 'A lesson worth accepting for the F2 guard'], cwd);
    const id = lessonId(created.out);
    writeFileSync(path.join(cwd, 'stage.json'), JSON.stringify([
      { title: 'A rule to accept for the F2 guard', directive: 'do', body: 'b' },
    ]), 'utf8');
    const staged = run(['lesson-stage', id, '--file', 'stage.json'], cwd);
    const key = stagedKey(staged.out);
    plantUnrelatedCorruptItem(cwd);
    return [id, key];
  },

  'lesson-discard': (cwd) => {
    const created = run(['lesson', 'A lesson worth discarding for the F2 guard'], cwd);
    const id = lessonId(created.out);
    writeFileSync(path.join(cwd, 'stage.json'), JSON.stringify([
      { title: 'A rule to discard for the F2 guard', directive: 'do', body: 'b' },
    ]), 'utf8');
    const staged = run(['lesson-stage', id, '--file', 'stage.json'], cwd);
    const key = stagedKey(staged.out);
    plantUnrelatedCorruptItem(cwd);
    return [id, key];
  },

  'ingest-apply': (cwd) => {
    mkdirSync(path.join(cwd, 'docs'), { recursive: true });
    writeFileSync(
      path.join(cwd, 'docs', 'prd.md'),
      '# Password policy\n\nPasswords must be at least 12 characters.\n',
      'utf8',
    );
    const ingested = run(['ingest', 'docs/prd.md'], cwd);
    const id = ingestSessionId(ingested.out);
    writeFileSync(path.join(cwd, 'c.json'), JSON.stringify([{
      type: 'requirement',
      title: 'Passwords are at least 12 characters',
      body: 'Enforced at registration.',
      quote: 'Passwords must be at least 12 characters.',
    }]), 'utf8');
    plantUnrelatedCorruptItem(cwd);
    return [id, '--anchor', 'password-policy', '--file', 'c.json'];
  },
};

for (const name of COMMANDS.keys()) {
  if (ALLOWED_NONZERO.has(name)) continue;

  test(`F2: "${name}" reports an unrelated corpus load error but still exits 0`, () => {
    const setup = SETUPS[name];
    assert.ok(
      setup,
      `"${name}" is registered in COMMANDS but has no F2 setup in test/cli/f2-registry.test.ts. ` +
      `Add one (or add "${name}" to ALLOWED_NONZERO with a reason in a comment) — this failure exists ` +
      `specifically to catch a new command shipping without this guard.`,
    );
    const cwd = project();
    try {
      const args = setup(cwd);
      const { code, out } = run([name, ...args], cwd);
      assert.equal(code, 0, `"${name}" exited ${code} on an unrelated corpus load error. Output:\n${out}`);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
}

test('every command registered in COMMANDS is covered by this file (allowlisted or set up)', () => {
  const uncovered = [...COMMANDS.keys()].filter(
    (name) => !ALLOWED_NONZERO.has(name) && !Object.hasOwn(SETUPS, name),
  );
  assert.deepEqual(uncovered, [], 'registered commands with no F2 coverage in this file');
});

test('the registry actually has more than one command — this guard would be vacuous against an empty registry', () => {
  assert.ok(COMMANDS.size > 1, `expected several registered commands, found ${COMMANDS.size}`);
});
