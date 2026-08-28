/**
 * `src/core/command-flags.ts` — each command's FLAG SPEC, lifted out of the
 * module that executes it.
 *
 * **Why the specs had to move rather than be called where they are.**
 * `test/ui/no-writes.test.ts` bans `src/cli/index.ts` from `src/ui/`, and not
 * as tidiness: that module registers the entire mutating command surface as an
 * import side effect — `cli/commands/index.ts` is a column of bare side-effect
 * imports, one per command module — so merely reaching it puts every writing
 * command in the process. A read surface that wants to know what `--severity`
 * is may not get there. The specs were module-private inside command modules
 * that import `updateItem`, so there was nothing to import even if the graph
 * had allowed it — the same shape, and the same fix, as `stageOf`/`STAGES`/
 * `READY_TAG` in `core/procedure-stage.ts`.
 *
 * **This file is a MOVE, and these tests are what make that checkable.** The
 * shape lifted is the one the codebase already had — `{ allowed, values }`,
 * the exact record `PACK_FLAGS`, `PROCEDURE_FLAGS`, `REVIEW_FLAGS` and
 * `SESSION_FLAGS` are written in — not a richer declaration. A spec that
 * declared legal values, placeholders and examples is what
 * `REQ-every-command-the-ui-offers-is-built-checked-before-it-can` asks for
 * next, and inventing it here would have made this diff stop reading as a move.
 *
 * ── THE TWO ASSERTIONS, AND WHY NEITHER ALONE IS ENOUGH ────────────────────
 *
 * 1. **Every lifted spec is probed against the REAL parser.** A hand-copied
 *    list that agrees with nothing is the defect being removed, so the values
 *    are checked by running the actual CLI: every flag the spec advertises is
 *    ACCEPTED, and a sentinel no command takes is REFUSED. This is the probe
 *    `test/ui/palette-lib.test.ts` and `test/helpers/approval-boundary.ts`
 *    already use, for the same reason.
 *
 * 2. **The command module no longer declares its own.** Comparing values alone
 *    would pass on the state this lift exists to end — two spellings that
 *    happen to agree today. So the source of each command module is read and a
 *    re-declared `ALLOWED`/`VALUE_FLAGS` fails.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { COMMAND_FLAGS, DETAIL_FLAGS } from '../../src/core/command-flags.ts';
import { removeTree } from '../helpers/tmp.ts';

const SRC = path.resolve(import.meta.dirname, '../../src');

/**
 * Which module each lifted command's spec used to live in. The map is the
 * subject of assertion 2 — a command listed here whose module still declares a
 * spec of its own has not actually been lifted.
 */
const LIFTED_FROM: Record<string, string> = {
  audit: 'cli/commands/audit.ts',
  decay: 'cli/commands/decay.ts',
  doctor: 'cli/commands/doctor.ts',
  export: 'cli/commands/export.ts',
  focus: 'cli/commands/focus.ts',
  'inbox-promote': 'cli/commands/inbox-promote.ts',
  'ingest-status': 'cli/commands/ingest.ts',
  lesson: 'cli/commands/lesson.ts',
  query: 'cli/commands/query.ts',
  refresh: 'cli/commands/refresh.ts',
  repair: 'cli/commands/repair.ts',
  search: 'cli/commands/search.ts',
  status: 'cli/commands/status.ts',
  supersede: 'cli/commands/supersede.ts',
  todo: 'cli/commands/todo.ts',
  ui: 'cli/commands/ui.ts',
  pin: 'cli/commands/edit.ts',
  unpin: 'cli/commands/edit.ts',
  harden: 'cli/commands/edit.ts',
  soften: 'cli/commands/edit.ts',
};

/**
 * Specs that were never lifted, because the command was written after this
 * module existed and declared its flags here from the start.
 *
 * A separate record rather than a row in `LIFTED_FROM`, because the two make
 * different claims and only one of them is checkable. `LIFTED_FROM` says "a
 * copy used to live there and is gone", which the OLD_SPELLINGS test below
 * verifies; a command born here has no old spelling to have removed, and
 * listing it as lifted would be an unverifiable claim in the one table whose
 * whole job is to be verifiable. It still has to be named somewhere, so a spec
 * cannot arrive with nothing said about it — which is what the assertion below
 * enforces across both records.
 */
const BORN_HERE: Record<string, string> = {
  ready: 'cli/commands/ready.ts — written after the lift, so its spec has never lived '
    + 'anywhere else.',
};

test('every lifted spec says which module it left, and no spec arrives unaccounted for', () => {
  assert.deepEqual(
    Object.keys(COMMAND_FLAGS).sort(),
    [...Object.keys(LIFTED_FROM), ...Object.keys(BORN_HERE)].sort(),
    'COMMAND_FLAGS and the record of where each spec came from disagree. A spec added without ' +
    'saying which module it left — or that it was born here — is a spec nobody can check the ' +
    'removal of.',
  );
  // The two records are disjoint, or a name could be excused by whichever one
  // the reader happened to look at.
  const both = Object.keys(BORN_HERE).filter((n) => Object.hasOwn(LIFTED_FROM, n));
  assert.deepEqual(both, [], 'a spec cannot both have been lifted and have been born here');
});

test('`values` is always a subset of `allowed` — a value flag nobody accepts cannot exist', () => {
  for (const [name, spec] of Object.entries(COMMAND_FLAGS)) {
    const stray = spec.values.filter((v) => !spec.allowed.includes(v));
    assert.deepEqual(
      stray, [],
      `${name}: --${stray.join(', --')} takes a value and is not accepted. ` +
      '`unknownFlag` and `positionals` would then disagree about which token is a value.',
    );
  }
});

test('DETAIL_FLAGS still reaches its old home, so every importer of it is unmoved', async () => {
  const format = await import('../../src/cli/commands/format.ts');
  assert.equal(
    format.DETAIL_FLAGS, DETAIL_FLAGS,
    'the same ARRAY, not a copy — a copy is a second spelling waiting to drift, which is ' +
    'exactly what this move exists to remove.',
  );
});

// ─── assertion 1: the lifted values, against the real parser ────────────────

const SENTINEL = '--zzz-not-a-flag-any-command-accepts';
const refuses = (text: string, flag: string): boolean =>
  text.includes(`unknown flag "${flag}"`) || text.includes(`unknown option "${flag}"`);

/**
 * **THE SENTINEL GOES IN EVERY PROBE, AND THE FLAG IS ALWAYS JOINED.** Both
 * halves of that are load-bearing and neither is stylistic.
 *
 * `runCli([name, '--flag'])` — the obvious probe, and the one
 * `palette-lib.test.ts` can afford because it only ever probes WRITE commands —
 * runs the command when the flag is accepted. Here that is not affordable:
 * `mycontext ui --no-open` binds a socket and serves until it idles out, and
 * `export` and `repair` do work on the probe workspace. So every probe carries
 * the sentinel too: the unknown-flag check reports the FIRST name it does not
 * recognise, so an accepted `--flag` is followed by a refusal on the sentinel
 * and the command body is never entered.
 *
 * Joined (`--flag=x`) rather than bare, because a bare VALUE flag would eat
 * the sentinel as its value and the command would run after all — which is the
 * exact hang this probe was written the second time to avoid. `=x` is never
 * read: the refusal happens before any command looks at a value, so a flag
 * that would reject `x` is not being asked about `x`.
 */
test('every lifted flag is one the real CLI accepts, and a sentinel is refused', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-flags-'));
  try {
    assert.equal(runCli(['init'], dir, () => {}), 0, 'the probe workspace did not initialize');
    const run = (argv: string[]): string => {
      const lines: string[] = [];
      try { runCli(argv, dir, (s) => lines.push(s)); }
      catch (err) { lines.push(`THREW: ${(err as Error).message}`); }
      return lines.join('\n');
    };

    const problems: string[] = [];
    for (const [name, spec] of Object.entries(COMMAND_FLAGS)) {
      if (!refuses(run([name, SENTINEL]), SENTINEL)) {
        problems.push(`${name}: does not refuse the sentinel, so this probe cannot read it`);
        continue;
      }
      for (const flag of spec.allowed) {
        const answer = run([name, `--${flag}=x`, SENTINEL]);
        if (refuses(answer, `--${flag}`)) {
          problems.push(`${name}: the lifted spec advertises --${flag}, which the CLI refuses`);
        } else if (!refuses(answer, SENTINEL)) {
          // Neither name was refused, so the command got past its own check and
          // this probe has proved nothing about `--flag`. A silent pass here is
          // exactly the shape of test this project treats as worthless.
          problems.push(`${name}: --${flag} probe reached neither refusal — unreadable`);
        }
      }
    }
    assert.deepEqual(
      problems, [],
      'a lifted spec and the real parser disagree. The spec is what the command itself now ' +
      'parses with, so a disagreement here means the move changed behaviour.',
    );
  } finally { removeTree(dir); }
});

// ─── assertion 2: no command module keeps a second spelling ─────────────────

/**
 * The names each module used for its own spec, so that "the copy is gone" is
 * checked against the spelling that was actually there rather than against a
 * general-purpose guess.
 *
 * `edit.ts` is the one entry whose list is NOT `ALLOWED`/`VALUE_FLAGS`: those
 * two are `edit`'s own and they STAY — see the test below, which asserts that
 * they are still there. Only `NAMED_ALLOWED`, the four named entry points'
 * spec, left this file.
 */
const OLD_SPELLINGS: Record<string, RegExp[]> = {
  'cli/commands/audit.ts': [/^const VALUE_FLAGS\b/m, /^const OWN_FLAGS\b/m],
  'cli/commands/decay.ts': [/^const ALLOWED\b/m, /^const VALUE_FLAGS\b/m],
  'cli/commands/doctor.ts': [/^const ALLOWED\b/m, /^const VALUE_FLAGS\b/m],
  'cli/commands/export.ts': [/^const ALLOWED\b/m, /^const VALUE_FLAGS\b/m],
  'cli/commands/focus.ts': [/^const ALLOWED\b/m, /^const VALUE_FLAGS\b/m],
  'cli/commands/inbox-promote.ts': [/^const ALLOWED\b/m, /^const VALUE_FLAGS\b/m],
  'cli/commands/ingest.ts': [/^const ALLOWED\b/m, /^const VALUE_FLAGS\b/m],
  'cli/commands/lesson.ts': [/^const ALLOWED\b/m, /^const VALUE_FLAGS\b/m],
  'cli/commands/query.ts': [/^const QUERY_FLAGS\b/m, /^const QUERY_VALUE_FLAGS\b/m],
  'cli/commands/refresh.ts': [/^const ALLOWED\b/m, /^const VALUE_FLAGS\b/m],
  'cli/commands/repair.ts': [/^const REPAIR_FLAGS\b/m],
  'cli/commands/search.ts': [/^const ALLOWED\b/m, /^const VALUE_FLAGS\b/m],
  'cli/commands/status.ts': [/^const ALLOWED\b/m, /^const VALUE_FLAGS\b/m],
  'cli/commands/supersede.ts': [/^const ALLOWED\b/m, /^const VALUE_FLAGS\b/m],
  'cli/commands/todo.ts': [/^const ALLOWED\b/m, /^const VALUE_FLAGS\b/m],
  'cli/commands/ui.ts': [/^const UI_FLAGS\b/m, /^const UI_VALUE_FLAGS\b/m],
  'cli/commands/edit.ts': [/^const NAMED_ALLOWED\b/m],
};

test('no lifted command module declares a flag spec of its own any more', () => {
  const problems: string[] = [];
  assert.deepEqual(
    Object.keys(OLD_SPELLINGS).sort(), [...new Set(Object.values(LIFTED_FROM))].sort(),
    'a module was lifted from without recording what its spec used to be called, so the ' +
    'removal of the copy is unchecked in it.',
  );
  for (const [rel, spellings] of Object.entries(OLD_SPELLINGS)) {
    const text = readFileSync(path.join(SRC, ...rel.split('/')), 'utf8');
    if (!/from '(\.\.\/)+core\/command-flags\.ts';/.test(text)) {
      problems.push(`${rel} does not import core/command-flags.ts`);
    }
    for (const decl of spellings) {
      if (decl.test(text)) problems.push(`${rel} still declares ${String(decl)}`);
    }
  }
  assert.deepEqual(
    problems, [],
    'a command module kept its own spelling of a spec that was lifted. Two lists that agree ' +
    'today is the state this lift exists to end, so the check is on the source and not the ' +
    'values.',
  );
});

/**
 * **`edit` DID NOT MOVE, and this is the assertion that says so out loud.**
 *
 * Its accepted set is not a constant: `[...ALLOWED, ...declaredFlags(ws.config)]`,
 * where the second half is whatever flags THIS project's categories declare a
 * `mycontext edit` spelling for. There is no static entry that could be true —
 * a read surface can only have `edit`'s flag surface by naming the workspace
 * it is asking about, and that is a design decision this move deliberately did
 * not take. `--unlink <relation> <target>` is the second reason: it takes two
 * operands and is stripped out of argv by `takeUnlinks` before any shared
 * helper sees it, so `{ allowed, values }` cannot describe it either.
 *
 * Asserted rather than written in a comment, because the day somebody makes
 * `edit`'s surface static this test is what tells them the note above is now
 * out of date.
 */
test('edit keeps its own spec, because its accepted set is per-workspace', () => {
  const text = readFileSync(path.join(SRC, 'cli', 'commands', 'edit.ts'), 'utf8');
  assert.match(text, /^const ALLOWED\b/m, 'edit\'s own spec left the module — if it is static now, lift it and delete this test');
  assert.match(text, /^const VALUE_FLAGS\b/m);
  assert.match(
    text, /declaredFlags\(ws\.config\)/,
    'the per-workspace half of edit\'s accepted set is what makes it unliftable. If this call ' +
    'is gone the reason is gone with it.',
  );
  assert.equal(
    Object.hasOwn(COMMAND_FLAGS, 'edit'), false,
    'a static spec for `edit` cannot be right: it would be missing every flag this project\'s ' +
    'own categories declare, and a builder over it would compose a command the CLI refuses.',
  );
});

/**
 * The four named entry points are generated from one list, and each is a
 * COMMAND. `runNamed` looks its spec up by `entry.name`, so a fifth named form
 * added to `NAMED_ENTRY_POINTS` without an entry here would index `undefined`
 * and refuse every flag including `--yes`.
 */
test('every named entry point has a spec of its own in the map', async () => {
  const { NAMED_ENTRY_POINTS } = await import('../../src/cli/commands/edit.ts');
  const missing = NAMED_ENTRY_POINTS
    .map((e) => e.name)
    .filter((n) => !Object.hasOwn(COMMAND_FLAGS, n));
  assert.deepEqual(
    missing, [],
    `${missing.join(', ')} is a named entry point with no flag spec. \`runNamed\` reads ` +
    'COMMAND_FLAGS[entry.name], so the command would refuse --yes and be unusable ' +
    'non-interactively — the one case the four exist for.',
  );
});
