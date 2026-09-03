import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { recordAudit } from '../../src/core/audit.ts';
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
  // exits 1 by design ("already exists"), which is the refusal this loop
  // would read as an F2 failure. Its own refusals are covered in
  // test/cli/cli.test.ts and registry.test.ts.
  //
  // `init --pack` DOES open the index — it opens a mutation context on the
  // workspace it has just written — but it can have no F2 behaviour to pin
  // either, and for a stronger reason than the harness: the corpus it
  // rebuilds is the one it created a line earlier, so an unrelated corrupt
  // item file cannot exist in it. A load error there would be an item this
  // very command wrote, which is not "unrelated" and is not what F2 is about.
  // test/cli/init-pack.test.ts covers what a failure mid-import leaves behind.
  'init',
  // `ui` is registered but cannot be exercised by this harness either, and for
  // a reason that is not about exit codes at all: it starts a server that
  // OUTLIVES the call. Running it in this loop would leave a listening socket
  // in the test process, and `node --test` does not exit while one is open —
  // the failure would be a hung suite, not a red assertion. It also has no F2
  // behaviour to pin: `cmdUi` never opens the index, so there is no rebuild in
  // this call whose load errors it could report or swallow. Its own refusals —
  // every one of which lands synchronously, before a socket is bound — are
  // covered in test/ui/open.test.ts.
  'ui',
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
  // `session` reads the same append-only audit log `audit` does, plus
  // `state/` — the seen files and the session-name store. It never opens the
  // item index, so a corrupt item file cannot reach its answer and there is
  // nothing for it to disclose, exactly as for `audit`.
  'session',
  // `help` and `examples` render documentation from the resolved config and
  // the built-in topics; neither ever opens the item index, so a corrupt
  // item file cannot reach their output. Registered since Wave 5, covered
  // here since Wave 5.
  'help', 'examples',
  // `statusline` never opens the item index on any of its paths. The bridge
  // reads a payload, writes a tee file and queries the AUDIT projection — the
  // same append-only log `audit` reads, which is not derived from the corpus —
  // and `install`/`uninstall` only read and write a Claude Code settings file.
  // A corrupt item file cannot reach any of those answers, so there is nothing
  // for it to disclose (verified by reading the command, not assumed).
  'statusline',
]);

const SETUPS: Record<string, (cwd: string) => string[]> = {
  // The former switch builtins, registered like everything else since Wave 5
  // and therefore covered here like everything else. Each already reported
  // load errors and exited 0 before the migration (`emitLoadErrors` after a
  // successful run — see the F2 comments in src/cli/index.ts); what this adds
  // is the guard that a later change cannot silently regress that.
  add: (cwd) => {
    plantUnrelatedCorruptItem(cwd);
    return ['--summary-omitted', 'constraint', 'An item captured despite the F2 corrupt file', '--yes'];
  },

  list: (cwd) => {
    run(['add', '--summary-omitted', 'constraint', 'A listed item for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [];
  },

  // `--list` is `ack`'s read-only success path: it runs the same `runChecks`
  // the write path does and prints what is reported on the item, so the F2
  // question — does an unrelated unparseable file make this command exit
  // non-zero — is asked of exactly the code that would answer it wrong. The
  // write path is not used here on purpose: it needs a finding to exist on the
  // item, which is a different test's business (`ack` refuses a code doctor
  // does not report), and F2 is about the load error and nothing else.
  ack: (cwd) => {
    const added = run(['add', '--summary-omitted', 'constraint', 'An item to ack for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [constraintId(added.out), '--list'];
  },

  show: (cwd) => {
    const added = run(['add', '--summary-omitted', 'constraint', 'An item to show for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [constraintId(added.out)];
  },

  rebuild: (cwd) => {
    run(['add', '--summary-omitted', 'constraint', 'An indexed item for the F2 guard', '--yes'], cwd);
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

  // `install` with no --yes is this command's success path that neither reads
  // stdin nor writes anything: it prints the current setting and the
  // replacement and returns 0. The bare verb cannot be used here — it reads
  // Claude Code's payload from stdin, which nothing in this process is going
  // to send, and `--settings` keeps the probe off the developer's own
  // Claude Code configuration.
  statusline: (cwd) => {
    plantUnrelatedCorruptItem(cwd);
    return ['install', '--settings', path.join(cwd, 'settings.json')];
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
    run(['add', '--summary-omitted', 'constraint', 'An item whose creation is audited', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [];
  },
  decay: (cwd) => {
    // A scoped item, not an empty corpus: `decay`'s empty-corpus branch and
    // its full-report branch return through two SEPARATE code paths (see
    // task-13-report.md's F2 finding) — an empty setup here would only ever
    // exercise the first one and could pass even with the second one broken.
    run(['add', '--summary-omitted', 'constraint', 'A scoped item for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [];
  },

  'ingest-status': (cwd) => {
    plantUnrelatedCorruptItem(cwd);
    return [];
  },

  // A category that plans work AND a task on it, so the command reaches its
  // TABLE branch rather than the "no category in this project declares plan,
  // seq and state" disclosure — two separate paths through `cmdReady`, and an
  // empty setup would only ever exercise the one a real project never sees.
  // The category has to be written into config directly because `task` is not
  // a shipped one, and the item has to be written as a file because
  // `mycontext add` cannot set an extra field.
  ready: (cwd) => {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify({
        categories: {
          task: {
            tier: 'rationale', prefix: 'TASK', description: 'A unit of planned work.',
            extraFields: ['plan', 'seq', 'state', 'priority', 'needs'],
          },
        },
      }, null, 2) + '\n',
    );
    mkdirSync(path.join(cwd, '.my_context', 'items', 'task'), { recursive: true });
    writeFileSync(
      path.join(cwd, '.my_context', 'items', 'task', 'TASK-f2.md'),
      '---\nid: TASK-f2\ntype: task\ntitle: a ready task for the F2 guard\nstatus: active\n'
      + 'severity: soft\nalways: false\nscope: []\ntags: []\norigin: human\n'
      + 'plan: "f2"\nseq: "1"\nstate: "todo"\npriority: "1"\n---\n\n'
      + '# a ready task for the F2 guard\n',
      'utf8',
    );
    plantUnrelatedCorruptItem(cwd);
    return [];
  },

  // A real corpus and a real destination, not `--dry-run`: the dry run and
  // the write are two paths through `cmdExport`, and the one that could
  // plausibly want to fail on a bad corpus is the one that writes. The
  // destination is a relative path so it lands inside `cwd` and is swept with
  // it — `export` resolves `--out` against the directory the command was run
  // in, which is what makes that true.
  export: (cwd) => {
    run(['add', '--summary-omitted', 'constraint', 'An item worth exporting for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return ['--out', 'f2-artefact'];
  },

  // A real import, not `pack list`: the listing reads `.audit/imported/` and
  // never opens the item index, so it has no load errors to report — while
  // `pack import` is the half that goes through `openMutateContext`, which is
  // the F2 seam. The artefact is written by this workspace's own `export
  // --as-pack`, so every item arrives `identical` and nothing is created; what
  // is under test is that the import runs to completion and discloses the
  // corrupt file, not what it wrote. `--yes` because stdin is not interactive
  // under `node --test` and `confirmAction` refuses without it by design.
  pack: (cwd) => {
    run(['add', '--summary-omitted', 'constraint', 'An item worth packing for the F2 guard', '--yes'], cwd);
    run([
      'export', '--out', 'f2-pack', '--as-pack',
      '--pack-name', 'f2-guard', '--pack-version', '1',
    ], cwd);
    plantUnrelatedCorruptItem(cwd);
    return ['import', 'f2-pack', '--yes'];
  },

  review: (cwd) => {
    plantUnrelatedCorruptItem(cwd);
    return [];
  },

  session: (cwd) => {
    // A workspace with a real session in the log, not an empty one: the
    // "no sessions" branch and the table branch are separate paths through
    // `cmdList`, and an empty setup would only ever exercise the first —
    // the hole `decay`'s entry below records.
    //
    // Written through `recordAudit` rather than through the CLI because no
    // CLI command is handed a session id: `mycontext add` records a mutation
    // with none, and a session only appears in this log when a HOOK writes
    // one. That is the same fact `core/focus.ts` conceded and the reason
    // `mycontext session name` takes an explicit id.
    recordAudit(path.join(cwd, '.my_context'), {
      kind: 'injection', op: 'session-start', sessionId: 'sess-f2-guard',
      hook: 'SessionStart', injected: [{ id: 'CONST-anything', tier: 'pinned' }],
    });
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
    const old = run(['add', '--summary-omitted', 'constraint', 'The old constraint for the F2 guard', '--yes'], cwd);
    const next = run(['add', '--summary-omitted', 'constraint', 'The new constraint for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [constraintId(old.out), '--by', constraintId(next.out), '--yes'];
  },

  edit: (cwd) => {
    // A real, ACTIVE governing item — `add --yes` passes `origin: 'human'` —
    // so the edit exercises the gated write path a human actually uses rather
    // than the ungated draft one. `--yes` on the command itself because stdin
    // is not interactive under `node --test` and `confirmAction` refuses
    // without it by design.
    run(['add', '--summary-omitted', 'constraint', 'A constraint to edit for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return ['CONST-a-constraint-to-edit-for-the-f2-guard', '--body', 'A new body.',
      '--summary-unchanged', '--yes'];
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
    const added = run(['add', '--summary-omitted', 'constraint', 'A constraint to pin for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [constraintId(added.out), '--yes'];
  },

  unpin: (cwd) => {
    const added = run(['add', '--summary-omitted', 'constraint', 'A constraint to unpin for the F2 guard', '--yes'], cwd);
    const id = constraintId(added.out);
    // `add` cannot set `always`, so the pin it is about to remove is put there
    // through the command that can.
    run(['pin', id, '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [id, '--yes'];
  },

  harden: (cwd) => {
    const added = run(['add', '--summary-omitted', 'constraint', 'A constraint to harden for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [constraintId(added.out), '--yes'];
  },

  soften: (cwd) => {
    const added = run(
      ['add', '--summary-omitted', 'constraint', 'A constraint to soften for the F2 guard', '--severity', 'hard', '--yes'],
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
    run(['add', '--summary-omitted', 'reference', 'A roadmap for the F2 guard', '--file', 'f2-roadmap.md'], cwd);
    writeFileSync(path.join(cwd, 'f2-roadmap.md'), '# Roadmap\n\n## Q3\n\n- one\n- two\n', 'utf8');
    plantUnrelatedCorruptItem(cwd);
    return ['REF-a-roadmap-for-the-f2-guard', '--yes'];
  },

  // A corpus with something in it AND a filter that matches it, so the
  // command reaches its row-printing path rather than its "0 item(s) match"
  // one — and, before either, gets past the refusal that a filterless
  // `search` earns, which would exit 1 without ever opening the corpus.
  search: (cwd) => {
    run(['add', '--summary-omitted', 'constraint', 'A scoped item for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return ['--text', 'scoped item'];
  },

  // A real todo, so the bare `todo` invocation reaches its table-printing
  // path rather than its "no todo items" one. Both paths end in
  // `emitLoadErrors`, and this picks the one a user is actually on.
  todo: (cwd) => {
    run(['add', '--summary-omitted', 'todo', 'A jotted-down thing for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [];
  },

  // A real capture in the inbox and a real target category, so the promotion
  // reaches BOTH of its writes and then `emitLoadErrors` — rather than one of
  // the refusals in front of them, every one of which exits 1 and would fail
  // this guard for a reason that has nothing to do with F2.
  'inbox-promote': (cwd) => {
    run(['add', '--summary-omitted', 'note', 'A jotted note for the F2 guard', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return ['NOTE-a-jotted-note-for-the-f2-guard', '--to', 'decision', '--yes'];
  },

  // A focus already set, so the bare `focus` invocation takes its reporting
  // path — which rebuilds through `openMutateContext` to ask `select` what the
  // focus hides — rather than the "no focus is set" early return, which opens
  // nothing and would pass this test for the wrong reason.
  focus: (cwd) => {
    run(['add', '--summary-omitted', 'constraint', 'A constraint for the F2 guard', '--tags', 'f2', '--yes'], cwd);
    // `--yes` since 2026-09-04: setting a focus is one of the two forms on the
    // approval boundary, and `confirmAction` refuses off a TTY. Without it this
    // setup silently set no focus and the bare `focus` below took the "no focus
    // is set" early return — the exact wrong-reason pass the note above warns
    // about, which is how this line was found.
    run(['focus', 'f2', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return [];
  },

  procedure: (cwd) => {
    // A real procedure, not an empty corpus: `cmdList`'s "no procedures"
    // branch and its grouped-rows branch return through two separate paths,
    // and an empty setup would only ever exercise the first — the same hole
    // `decay`'s entry above records.
    //
    // `procedure list` reads the corpus from MARKDOWN rather than through the
    // index (see `corpus` in src/cli/commands/procedure.ts), which is what
    // keeps `procedure step` free of the index write lock. It still collects
    // and reports `loadLayer`'s per-file errors, so the F2 signal is the same
    // one every other command gives.
    run(['add', '--summary-omitted', 'procedure', 'Backfill the F2 guard', '--step', 'Do the one thing', '--yes'], cwd);
    plantUnrelatedCorruptItem(cwd);
    return ['list'];
  },

  query: (cwd) => {
    run(['add', '--summary-omitted', 'constraint', 'A scoped item for the F2 guard', '--yes'], cwd);
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
