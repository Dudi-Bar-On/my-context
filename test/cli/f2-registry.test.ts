import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { removeTree } from '../helpers/tmp.ts';
import { firstCell } from '../helpers/table.ts';

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
 * `status` moved into the `COMMANDS` registry in Task 15 (`src/cli/commands/status.ts`)
 * and so is now iterated by the loop below like every other registered
 * command — but it is deliberately in `ALLOWED_NONZERO`, alongside `doctor`:
 * both commands' whole job is reporting corpus health, and the plan's F2
 * rule (see the doc comment above) explicitly carves out exactly this pair
 * to exit non-zero on an unrelated load error. `status`'s own F2 case —
 * "a corrupt item file is reported and exits 1, exactly as Plan 1 required" —
 * is covered directly in `test/cli/status.test.ts` and
 * `test/cli/cli.test.ts`'s `status surfaces a rebuild error for a corrupt
 * item and exits non-zero`.
 */
const ALLOWED_NONZERO = new Set([
  'doctor', 'status',
  // `init` is registered (Wave 5 moved the last builtins into the registry)
  // but cannot be exercised by this harness: every setup runs inside a
  // workspace `project()` already initialized, and a second `init` there
  // exits 1 by design ("already exists"). It also never opens the index —
  // there is no corpus yet when it succeeds — so there is no F2 behaviour to
  // pin. Its own refusals are covered in test/cli/cli.test.ts and
  // registry.test.ts.
  'init',
]);

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
  const match = firstCell('[0-9a-f]{8}').exec(out);
  assert.ok(match, `no staged key found in output:\n${out}`);
  return match[1];
}

function lessonId(out: string): string {
  const match = /LESSON-[a-z0-9-]+/.exec(out);
  assert.ok(match, `no lesson id found in output:\n${out}`);
  return match[0];
}

function constraintId(out: string): string {
  const match = /CONST-[a-z0-9-]+/.exec(out);
  assert.ok(match, `no constraint id found in output:\n${out}`);
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
/**
 * Commands whose SETUP plants an unrelated corrupt item but whose SUCCESS
 * PATH never opens `openMutateContext`/rebuilds the index at all, so there is
 * no `errors` array for them to report in the first place: `ingest` and
 * `ingest-status` only read/write session files on disk (never `items`),
 * `lesson-discard` only rewrites the staging file, and `audit` reads only the
 * append-only audit log under `.my_context/.audit/` — which is not derived
 * from the corpus at all, so a corrupt item file cannot make its answer wrong
 * and there is nothing for it to disclose. That independence is the point of
 * the log's shape, not an oversight: `mycontext rebuild` and `Store.open`'s
 * self-heal both destroy index state, and neither can touch this one. Asserting the corrupt
 * file's name appears in their output would be asserting something these
 * commands were never in a position to do, not exercising F2. Every OTHER
 * command below is expected to both exit 0 AND report the corrupt file,
 * because every other one does call `rebuild` on its success path (verified
 * by reading each command's source, not assumed).
 */
const DOES_NOT_REBUILD = new Set([
  'audit', 'ingest', 'ingest-status', 'lesson-discard',
  // `help` and `examples` render documentation from the resolved config and
  // the built-in topics; neither ever opens the item index, so a corrupt
  // item file cannot reach their output. Registered since Wave 5, covered
  // here since Wave 5.
  'help', 'examples',
]);

const SETUPS: Record<string, (cwd: string) => string[]> = {
  // The former switch builtins, registered like everything else since Wave 5
  // and therefore covered here like everything else. Each already reported
  // load errors and exited 0 before the migration (`emitLoadErrors` after a
  // successful run — see the F2 comments in src/cli/index.ts); what this adds
  // is the guard that a later change cannot silently regress that.
  add: (cwd) => {
    plantUnrelatedCorruptItem(cwd);
    return ['constraint', 'An item captured despite the F2 corrupt file', '--yes'];
  },

  list: (cwd) => {
    run(['add', 'constraint', 'A listed item for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [];
  },

  show: (cwd) => {
    const added = run(['add', 'constraint', 'An item to show for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [constraintId(added.out)];
  },

  rebuild: (cwd) => {
    run(['add', 'constraint', 'An indexed item for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [];
  },

  help: (cwd) => {
    plantUnrelatedCorruptItem(cwd);
    return ['scope'];
  },

  examples: (cwd) => {
    plantUnrelatedCorruptItem(cwd);
    return ['constraint'];
  },

  audit: (cwd) => {
    // A workspace with real audit records in it, not an empty log: the empty
    // branch and the listing branch are separate paths through `cmdAudit`, and
    // an empty setup would only ever exercise the first — exactly the hole
    // `decay`'s entry below records.
    //
    // `audit` never opens the item index at all (the audit log is not derived
    // from the corpus), so the corrupt item cannot affect its answer. That is
    // the point of planting one: this guard is about a command exiting 0 on a
    // load error that has nothing to do with it, and here the independence is
    // total rather than incidental.
    run(['add', 'constraint', 'An item whose creation is audited', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [];
  },
  decay: (cwd) => {
    // A scoped item, not an empty corpus: `decay`'s empty-corpus branch and
    // its full-report branch return through two SEPARATE code paths (see
    // task-13-report.md's F2 finding) — an empty setup here would only ever
    // exercise the first one and could pass even with the second one broken.
    run(['add', 'constraint', 'A scoped item for the F2 guard', '--yes'], cwd);
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

  repair: (cwd) => {
    // A real re-stamp, not an empty run: the checksum of a genuine item is
    // corrupted so `repair --yes` exercises its WRITE path (the one that could
    // plausibly want to fail on a bad corpus) rather than its "nothing to do"
    // early return. `--yes` because stdin is not interactive under `node
    // --test`; `confirmAction` refuses without it by design.
    const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-f2.md');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(
      file,
      '---\nid: CONST-f2\ntype: constraint\ntitle: A\nstatus: active\n' +
      'checksum: deadbeefdeadbeef\n---\n\n# A\n\nBody.\n',
      'utf8',
    );
    plantUnrelatedCorruptItem(cwd);
    return ['--yes'];
  },

  supersede: (cwd) => {
    // Two real, ACTIVE items — `add --yes` passes `origin: 'human'`, so both
    // land active and the retirement exercises the write path a human
    // actually uses, not a draft-only shortcut. `--yes` on the command
    // itself because stdin is not interactive under `node --test` and
    // `confirmAction` refuses without it by design.
    const old = run(['add', 'constraint', 'The old constraint for the F2 guard', '--yes'], cwd);
    const next = run(['add', 'constraint', 'The new constraint for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [constraintId(old.out), '--by', constraintId(next.out), '--yes'];
  },

  edit: (cwd) => {
    // A real, ACTIVE governing item — `add --yes` passes `origin: 'human'` —
    // so the edit exercises the gated write path a human actually uses rather
    // than the ungated draft one. `--yes` on the command itself because stdin
    // is not interactive under `node --test` and `confirmAction` refuses
    // without it by design.
    run(['add', 'constraint', 'A constraint to edit for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return ['CONST-a-constraint-to-edit-for-the-f2-guard', '--body', 'A new body.', '--yes'];
  },

  // `pin`, `unpin`, `harden` and `soften` are `edit` under a shorter name
  // (src/cli/commands/edit.ts), so F2 reaches them through the same
  // `openMutateContext` call. They are set up separately anyway rather than
  // allowlisted as aliases: each one is a real registry entry with its own
  // argv rewrite in front of `cmdEdit`, and a rewrite that dropped the id or
  // stopped at its own usage line would never reach F2 at all — which is
  // exactly the "registered without this guard" case this file exists to
  // catch. Each starts from the value the command MOVES AWAY from, so every
  // one of the four exercises a real write rather than the "nothing to
  // change" branch.
  pin: (cwd) => {
    const added = run(['add', 'constraint', 'A constraint to pin for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [constraintId(added.out), '--yes'];
  },

  unpin: (cwd) => {
    const added = run(['add', 'constraint', 'A constraint to unpin for the F2 guard', '--yes'], cwd);
    const id = constraintId(added.out);
    // `add` cannot set `always`, so the pin it is about to remove is put there
    // through the command that can.
    run(['pin', id, '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [id, '--yes'];
  },

  harden: (cwd) => {
    const added = run(['add', 'constraint', 'A constraint to harden for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [constraintId(added.out), '--yes'];
  },

  soften: (cwd) => {
    const added = run(
      ['add', 'constraint', 'A constraint to soften for the F2 guard', '--severity', 'hard', '--yes'],
      cwd,
    );
    plantUnrelatedCorruptItem(cwd);
    return [constraintId(added.out), '--yes'];
  },

  // A real snapshot that has genuinely drifted, so `refresh --yes` exercises
  // its WRITE path rather than the "already current, nothing was written"
  // early return — the same reason `repair` above corrupts a checksum first.
  refresh: (cwd) => {
    writeFileSync(path.join(cwd, 'f2-roadmap.md'), '# Roadmap\n\n## Q3\n\n- one\n', 'utf8');
    run(['add', 'reference', 'A roadmap for the F2 guard', '--file', 'f2-roadmap.md'], cwd);
    writeFileSync(path.join(cwd, 'f2-roadmap.md'), '# Roadmap\n\n## Q3\n\n- one\n- two\n', 'utf8');
    plantUnrelatedCorruptItem(cwd);
    return ['REF-a-roadmap-for-the-f2-guard', '--yes'];
  },

  // A corpus with something in it AND a filter that matches it, so the
  // command reaches its row-printing path rather than its "0 item(s) match"
  // one — and, before either, gets past the refusal that a filterless
  // `search` earns, which would exit 1 without ever opening the corpus.
  search: (cwd) => {
    run(['add', 'constraint', 'A scoped item for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return ['--text', 'scoped item'];
  },

  // A real todo, so the bare `todo` invocation reaches its table-printing
  // path rather than its "no todo items" one. Both paths end in
  // `emitLoadErrors`, and this picks the one a user is actually on.
  todo: (cwd) => {
    run(['add', 'todo', 'A jotted-down thing for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [];
  },

  // A focus already set, so the bare `focus` invocation takes its reporting
  // path — which rebuilds through `openMutateContext` to ask `select` what the
  // focus hides — rather than the "no focus is set" early return, which opens
  // nothing and would pass this test for the wrong reason.
  focus: (cwd) => {
    run(['add', 'constraint', 'A constraint for the F2 guard', '--tags', 'f2', '--yes'], cwd);
    run(['focus', 'f2'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [];
  },

  query: (cwd) => {
    run(['add', 'constraint', 'A scoped item for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return ['SELECT id FROM items'];
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
      // The rule is "reports AND exits 0", not just the exit code — a
      // command that reaches openMutateContext/rebuild but discards the
      // returned errors (never calling emitLoadErrors) satisfies only the
      // exit-code half and would still pass a guard that checked only
      // `code`. Task 14's `query` command did exactly that: it exited 0 but
      // printed nothing about the corrupt file, and this loop's own
      // assert.equal(code, 0) alone could not have caught it. The corrupt
      // file's relative path is what `emitLoadErrors` always prints (see
      // context.ts), so its presence in `out` is the actual F2 signal — for
      // the commands that rebuild at all (see DOES_NOT_REBUILD above).
      if (!DOES_NOT_REBUILD.has(name)) {
        assert.match(
          out, /CONST-broken\.md/,
          `"${name}" exited 0 but never reported the unrelated corpus load error — the rule is ` +
          `"reports AND exits 0", not just the exit code. Output:\n${out}`,
        );
      }
    } finally {
      removeTree(cwd);
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
