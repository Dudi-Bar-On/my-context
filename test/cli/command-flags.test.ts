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
 * **The lift is a MOVE, and these tests are what make that checkable.** The
 * shape lifted is the one the codebase already had — `{ allowed, values }`,
 * the exact record `PACK_FLAGS`, `PROCEDURE_FLAGS`, `REVIEW_FLAGS` and
 * `SESSION_FLAGS` are written in — not a richer declaration. A spec that
 * declares legal values, placeholders and examples is what
 * `REQ-every-command-the-ui-offers-is-built-checked-before-it-can` asks for,
 * and it arrived as a SECOND table (`FLAG_DECLARATIONS`, plan:builder seq:2)
 * over the same key space rather than as a change to this one. The tests for
 * it are in their own section at the foot of this file, and the first of them
 * is what ties the two tables together: they must cover exactly the same
 * flags, in both directions.
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
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import {
  ARTEFACT_FORMATS, AUDIT_ROLES, COMMAND_FLAGS, DETAIL_FLAGS, FLAG_DECLARATIONS,
  RULE_DIRECTIVES,
} from '../../src/core/command-flags.ts';
import { AUDIT_KINDS, AUDIT_OPS } from '../../src/core/audit.ts';
import { LINK_DIRECTIONS } from '../../src/core/search.ts';
import { ORIGINS, SEVERITIES, STATUSES } from '../../src/core/validate.ts';
import { RELATION_TYPES } from '../../src/core/vocabulary.ts';
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
  // plan:builder seq:1b — the four out of the entry module itself, which is
  // the one module `test/ui/no-writes.test.ts` bans from `src/ui/`. Two of
  // them (`add`, `init`) had constants to move; `list` and `examples` had
  // their flag lists written as arguments at the `refuseUnknownFlag` call, so
  // for those the "old spelling" below is the call and not a declaration.
  add: 'cli/index.ts',
  list: 'cli/index.ts',
  examples: 'cli/index.ts',
  init: 'cli/index.ts',
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
  ack: 'cli/commands/ack.ts — the command itself is newer than this module (owner ruling '
    + '2026-08-27, doctor findings become acknowledgeable), so its spec was authored here '
    + 'and has never lived anywhere else.',
  config: 'cli/commands/config.ts — the command itself is newer than this module (rulings/20 '
    + 'widened, shipped 2026-09-04), so its spec was authored here and has never lived '
    + 'anywhere else.',
  carry: 'cli/commands/carry.ts — the command itself is newer than this module (owner ruling '
    + '2026-09-04, a one-shot carry spent at the next injection), so its spec was authored '
    + 'here and has never lived anywhere else.',
};

/**
 * Specs that were WRITTEN here, for commands that already existed and had none.
 *
 * The third record, and the one that makes a claim the other two do not: these
 * five commands VALIDATED NO FLAGS, so their accepted set was not moved from
 * anywhere and was not declared with the command either — it was read out of
 * every `flag`/`hasFlag`/`listFlag` call each one reaches and then written
 * down. That is a behaviour change (plan:builder seq:1c), not a lift, and the
 * distinction has to survive in the record: `LIFTED_FROM` would assert a copy
 * was removed from a module that never had one, and `BORN_HERE` would claim
 * the command is newer than this module, which is the opposite of true.
 *
 * The reason each one earns is the risk it carried, because that is what a
 * later reader has to weigh if one of these refusals turns out to break a
 * caller nobody enumerated.
 */
const WRITTEN_HERE: Record<string, string> = {
  ingest: 'read `--anchor` inline and refused nothing; a typo in it was dropped and the '
    + 'whole document ingested instead of the one anchor asked for.',
  'ingest-apply': 'read `--anchor` and `--file` inline, and `--stdin` was never read at all — '
    + '`readPayload` falls back to fd 0. A misspelt `--file` therefore did not fail: it '
    + 'silently waited on stdin.',
  'lesson-stage': 'same payload pair as ingest-apply, same silent fallback to fd 0.',
  'lesson-accept': 'read four overrides that each change the text of a rule about to govern '
    + 'this repository, and dropped any of them that was misspelt while reporting success.',
  'lesson-discard': 'took no flags and said nothing about the ones it was handed.',
};

const PROVENANCE: Record<string, string>[] = [LIFTED_FROM, BORN_HERE, WRITTEN_HERE];

test('every lifted spec says which module it left, and no spec arrives unaccounted for', () => {
  assert.deepEqual(
    Object.keys(COMMAND_FLAGS).sort(),
    PROVENANCE.flatMap((record) => Object.keys(record)).sort(),
    'COMMAND_FLAGS and the record of where each spec came from disagree. A spec added without ' +
    'saying which module it left — or that it was born here, or that it was written here for a ' +
    'command that had none — is a spec nobody can check the removal of.',
  );
  // The three records are disjoint, or a name could be excused by whichever
  // one the reader happened to look at. Counting is enough and is the check
  // that cannot miss a pair: the assertion above already fixes the union.
  const names = PROVENANCE.flatMap((record) => Object.keys(record));
  assert.equal(
    new Set(names).size, names.length,
    'a spec is named in two provenance records at once, and they make incompatible claims: ' +
    'lifted says a copy was removed, born-here says the command is newer than this module, ' +
    'and written-here says the command had no spec at all.',
  );
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
 * **Commands that refuse in words of their own, and how they NAME what they
 * refused.**
 *
 * The probe below asks one question — "did this command line stop at flag
 * validation, and on WHICH name" — and it read the answer out of the two
 * sentences `unknownFlag` produces. That was every lifted command until
 * plan:builder seq:1b, and it stops being every one here.
 *
 * `init` is the command that also refuses a bare POSITIONAL, so it cannot use
 * `refuseUnknownFlag` at all: `refusedInitArguments` walks argv for everything
 * that is neither an accepted flag nor a value one of them consumed, and the
 * refusal quotes those arguments back with `JSON.stringify`. Same question,
 * different words — so this record supplies the words rather than excusing the
 * command from the question, which is the difference between this and
 * `approval-boundary.ts`'s `NO_FLAG_PROBE`. Nothing here is skipped: `init`'s
 * `--pack` is proved accepted and the sentinel proved refused, exactly as
 * every other spec's flags are.
 *
 * The quoting is what makes it exact rather than approximate. `INIT_USAGE`
 * prints the bare text `--pack <path>` in the same refusal, so a substring
 * search for `--pack` would find it whether the flag was accepted or not; the
 * quotes `JSON.stringify` adds are only ever around an argument the command
 * REFUSED, which is the fact being asked about.
 *
 * Every entry is re-verified below: one whose command has since adopted the
 * shared refusal fails, rather than going on reading a second wording that
 * nothing produces any more.
 */
const OWN_REFUSAL: Record<string, { why: string; quote: (arg: string) => string }> = {
  init: {
    why: 'refuses every argument it cannot act on — unknown flags AND bare positionals — in '
      + 'one sentence of its own, quoting them back, rather than reporting an unknown option',
    quote: (arg) => JSON.stringify(arg),
  },
};

/** Did `command` refuse `arg`, in whichever words that command refuses in? */
const refusedBy = (command: string, text: string, arg: string): boolean => {
  const own = OWN_REFUSAL[command];
  return own === undefined ? refuses(text, arg) : text.includes(own.quote(arg));
};

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
    // A command excused into OWN_REFUSAL that has since adopted the shared
    // wording would be read through a second matcher nothing produces, which is
    // the stale-excuse shape this repository keeps finding. Checked first, so
    // the failure names the record rather than the command.
    for (const name of Object.keys(OWN_REFUSAL)) {
      if (!Object.hasOwn(COMMAND_FLAGS, name)) {
        problems.push(`${name}: named in OWN_REFUSAL and has no spec here to probe`);
      } else if (refuses(run([name, SENTINEL]), SENTINEL)) {
        problems.push(
          `${name}: refuses in the shared words after all — drop its OWN_REFUSAL entry, ` +
          'which is now a second reading of a sentence the command no longer prints',
        );
      }
    }
    for (const [name, spec] of Object.entries(COMMAND_FLAGS)) {
      if (!refusedBy(name, run([name, SENTINEL]), SENTINEL)) {
        problems.push(`${name}: does not refuse the sentinel, so this probe cannot read it`);
        continue;
      }
      for (const flag of spec.allowed) {
        const answer = run([name, `--${flag}=x`, SENTINEL]);
        if (refusedBy(name, answer, `--${flag}`)) {
          problems.push(`${name}: the lifted spec advertises --${flag}, which the CLI refuses`);
        } else if (!refusedBy(name, answer, SENTINEL)) {
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
  /**
   * The entry module. `ADD_FLAGS`, `ADD_VALUE_FLAGS` and `INIT_VALUE_FLAGS`
   * were declarations and are checked as declarations — the destructuring that
   * binds those same names back out of `COMMAND_FLAGS` reads
   * `const { allowed: ADD_FLAGS`, which none of these patterns match, and that
   * is deliberate: the name staying is what keeps the diff a move, while the
   * VALUES having one home is the whole point.
   *
   * The last two are not declarations because `list` and `examples` never had
   * one. Their accepted sets were literal arguments at the call that refused
   * against them, so the copy to prove gone is that call, spelled as it was.
   */
  'cli/index.ts': [
    /^const ADD_FLAGS\b/m,
    /^const ADD_VALUE_FLAGS\b/m,
    /^const INIT_VALUE_FLAGS\b/m,
    /refuseUnknownFlag\(args, DETAIL_FLAGS, \[\], LIST_USAGE/,
    /refuseUnknownFlag\(args, \['short'\], \[\], EXAMPLES_USAGE/,
  ],
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
test('edit keeps no static spec, because its accepted set is per-workspace', () => {
  const text = readFileSync(path.join(SRC, 'cli', 'commands', 'edit.ts'), 'utf8');
  assert.equal(
    Object.hasOwn(COMMAND_FLAGS, 'edit'), false,
    'a static spec for `edit` cannot be right: it would be missing every flag this project\'s ' +
    'own categories declare, and a builder over it would compose a command the CLI refuses.',
  );
  assert.match(
    text, /declaredEditFlags\(ws\.config\)/,
    'the per-workspace half of edit\'s accepted set is what makes it unliftable. If this call ' +
    'is gone the reason is gone with it.',
  );
  // The base and the resolution moved to `core/edit-flags.ts` with
  // plan:builder seq:2b, so that a READ surface can compute the surface
  // without importing a module that writes; the command binds them back.
  //
  // Checked as an ABSENT declaration rather than a present import, for the
  // reason `OLD_SPELLINGS` above gives: two lists that agree today is the
  // state this module exists to end, and here only one of them would be the
  // one `GET /api/flags` serves.
  assert.doesNotMatch(
    text, /^const ALLOWED = \[/m,
    'edit.ts declares its own accepted list again. The endpoint resolves the surface from ' +
    '`EDIT_FLAGS`, so a second list here is one no builder would ever see.',
  );
  assert.doesNotMatch(text, /^const VALUE_FLAGS = \[/m);
  assert.match(
    text, /from '(\.\.\/)+core\/edit-flags\.ts';/,
    'edit.ts no longer imports the module that resolves its own surface',
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

/**
 * **The header's census, derived — because a count in a comment goes stale.**
 *
 * The paragraph above `FlagSpec` used to open "over the 38 commands `COMMANDS`
 * registers", and 38 was wrong in both directions at once: the registry holds
 * 32 when only `cli/commands/index.ts` has been imported, and 39 once
 * `cli/index.ts` has, because seven commands are registered in the entry
 * module itself. Both READMEs said 39 and were right; the source comment
 * beside the map was the one thing nobody could check. That is the same
 * hand-kept-number drift this project has now measured in the citations, in
 * the wave map, in the README's audit-kind tables and — the reason this test
 * exists at all — in the approval-boundary probe's subcommanded list, which
 * was written when four commands had subcommands and stayed four after a
 * fifth shipped.
 *
 * Two things are asserted, and the second is the one that matters:
 *
 *   1. **The figures.** Every number in the header is read out of the comment
 *      and compared with the registry, this map, and a count of
 *      `registerCommand` calls in `cli/index.ts`.
 *   2. **The inventory.** The header names every command whose spec is NOT
 *      here, in prose, and those names plus `COMMAND_FLAGS`' keys must be
 *      exactly the registered set — no overlap, nothing left over. A count can
 *      be right while the enumeration is short; this is what makes a command
 *      that arrives and is never mentioned fail here rather than silently
 *      falling outside the paragraph that claims to account for all of them.
 */
test('the flag-spec header counts and names every registered command', () => {
  const source = readFileSync(path.join(SRC, 'core', 'command-flags.ts'), 'utf8');
  const header = source.slice(0, source.indexOf('*/'));
  assert.ok(header.includes('MEASURED'), 'the header block comment was not found');

  const number = (pattern: RegExp, what: string): number => {
    const found = pattern.exec(header);
    assert.ok(found, `the header no longer states ${what}. If the wording changed, update the ` +
      'pattern; do not delete the assertion — the number it watches was wrong for six days.');
    return Number(found[1]);
  };

  const total = number(/over the \*\*(\d+)\*\* commands/, 'how many commands the CLI dispatches');
  const bySideEffect = number(/(\d+) registered by/, 'how many `cli/commands/index.ts` registers');
  const inEntry = number(/(\d+) more registered in/, 'how many `cli/index.ts` registers');
  const rows = [...header.matchAll(/^ \* +\| *(\d+) \|/gm)].map((m) => Number(m[1]));
  const here = number(/\*\*(\d+)\*\* of the (\d+) are here/, 'how many specs are in this map');
  const separable = number(/\*\*\d+\*\* of the (\d+) are here/, 'how many specs are separable');

  assert.equal(total, COMMANDS.size, 'the header states a command count the registry disagrees with');
  assert.equal(
    inEntry, (readFileSync(path.join(SRC, 'cli', 'index.ts'), 'utf8').match(/registerCommand\(/g) ?? []).length,
    'the header states how many commands `cli/index.ts` registers, and it registers a ' +
    'different number. That split is the whole reason the old figure was wrong.',
  );
  assert.equal(bySideEffect + inEntry, total, 'the header\'s two halves do not add up to its own total');
  assert.equal(rows.length, 4, 'the header\'s census table no longer has four rows');
  assert.equal(rows.reduce((a, b) => a + b, 0), total, `the census table sums to ${rows.reduce((a, b) => a + b, 0)}, not ${total}`);
  assert.equal(rows[0], separable, 'the census table and the sentence below it disagree about the separable count');
  assert.equal(here, Object.keys(COMMAND_FLAGS).length, 'the header states how many specs are here, and a different number is here');

  // The inventory. Only backticked names that ARE registered commands count,
  // so the prose may go on naming modules, constants and flags freely.
  const named = new Set(
    [...header.matchAll(/`([a-z][a-z-]*)`/g)].map((m) => m[1]).filter((n) => COMMANDS.has(n)),
  );
  const overlap = [...named].filter((n) => Object.hasOwn(COMMAND_FLAGS, n)).sort();
  assert.deepEqual(
    overlap, [],
    'the header names a command as absent whose spec is in COMMAND_FLAGS. One of the two is ' +
    'lying, and the header is the half a reader believes without checking.',
  );
  const unaccounted = [...COMMANDS.keys()]
    .filter((n) => !named.has(n) && !Object.hasOwn(COMMAND_FLAGS, n)).sort();
  assert.deepEqual(
    unaccounted, [],
    `${unaccounted.join(', ')} is registered, has no spec here, and the header does not say ` +
    'why. Add it to the map or name it in the header — a command that is in neither is one ' +
    'the paragraph claiming to account for all of them silently missed.',
  );
});

// ─── plan:builder seq:2 — what a flag MEANS, and what may be put in it ──────

/**
 * **The declaration layer, and why every assertion below is about a different
 * way for it to be worthless.**
 *
 * `FLAG_DECLARATIONS` exists to be the ONE description of a flag that the
 * select, the placeholder, the help text and the refusal all read. Each of
 * those four consumers can be broken separately:
 *
 *   - a flag with no declaration renders as a bare text box with no hint,
 *     which is the state the owner described on 2026-08-24 — a user who "does
 *     not know what is the correct format what is legal and what is not";
 *   - a declaration for a flag the command REFUSES renders a control that
 *     composes a command line the CLI will reject;
 *   - a value-taking flag with neither a vocabulary nor a format is a text box
 *     again, wearing a description;
 *   - and a vocabulary COPIED rather than imported is the drift this whole plan
 *     exists to end. That last one is the assertion to read first: it is
 *     checked by IDENTITY, because equal contents is precisely the state that
 *     goes stale without anything failing.
 */

/**
 * Every closed vocabulary a declaration is allowed to name, by the constant it
 * must BE — not a list of legal contents, a list of legal ARRAYS.
 *
 * Seven are imported from the module that enforces them. Three are exported by
 * `core/command-flags.ts` itself and imported BY the module that enforces
 * them, because they had been module-private beside their own parser: a closed
 * list next to the operation that checks it is reachable only by importing the
 * operation, which for `cli/commands/audit.ts` and `cli/commands/export.ts`
 * means a read surface cannot have it at all.
 *
 * `ORIGINS` is in the first group and was in the second an hour earlier, which
 * is worth a sentence: `cli/commands/audit.ts` kept its own copy of the three
 * `Origin` values while `core/validate.ts` enforced the same three on every
 * created item. The duplication was already WRITTEN DOWN as a fact in a
 * 2026-08-20 plan document — "enforced twice", citing both — and no test had
 * ever objected.
 */
const KNOWN_VOCABULARIES: Record<string, readonly string[]> = {
  SEVERITIES, STATUSES, AUDIT_KINDS, AUDIT_OPS, RELATION_TYPES, DETAIL_FLAGS,
  ORIGINS, AUDIT_ROLES, ARTEFACT_FORMATS, RULE_DIRECTIVES, LINK_DIRECTIONS,
};

test('every flag of every command is declared, and nothing else is', () => {
  assert.deepEqual(
    Object.keys(FLAG_DECLARATIONS).sort(), Object.keys(COMMAND_FLAGS).sort(),
    'a command has a flag spec and no declaration record, or the other way round.',
  );
  const problems: string[] = [];
  for (const [name, spec] of Object.entries(COMMAND_FLAGS)) {
    const declared = Object.keys(FLAG_DECLARATIONS[name]);
    for (const flag of spec.allowed) {
      if (!declared.includes(flag)) problems.push(`${name}: --${flag} is accepted and undeclared`);
    }
    for (const flag of declared) {
      if (!spec.allowed.includes(flag)) {
        problems.push(`${name}: --${flag} is declared and the command refuses it`);
      }
    }
  }
  assert.deepEqual(
    problems, [],
    'BOTH directions matter and they fail differently: an undeclared flag renders as a bare ' +
    'text box with no hint, and a declared flag the command refuses renders a control that ' +
    'composes a command line the CLI rejects.',
  );
});

test('a flag that takes a value declares its legal values OR its format and an example', () => {
  const problems: string[] = [];
  for (const [name, spec] of Object.entries(COMMAND_FLAGS)) {
    for (const [flag, decl] of Object.entries(FLAG_DECLARATIONS[name])) {
      const takesValue = spec.values.includes(flag);
      const hasVocabulary = decl.values !== undefined;
      const hasFormat = decl.format !== undefined && decl.example !== undefined;
      if (takesValue && !hasVocabulary && !hasFormat) {
        problems.push(
          `${name}: --${flag} takes a value and declares neither a vocabulary nor a format ` +
          'with an example, so there is nothing to put in the select or the placeholder',
        );
      }
      if (hasVocabulary && decl.format !== undefined) {
        problems.push(
          `${name}: --${flag} declares both a closed vocabulary and a format. One flag, one ` +
          'answer: a vocabulary IS the placeholder, and two answers is how they disagree',
        );
      }
      if (decl.format !== undefined && decl.example === undefined) {
        problems.push(`${name}: --${flag} declares a format and no example of it`);
      }
      if (!takesValue && (hasVocabulary || decl.format !== undefined)) {
        problems.push(
          `${name}: --${flag} is BARE — it consumes no token — and declares a value shape. ` +
          'A switch has no value to have a shape',
        );
      }
      if (decl.note.trim() === '') {
        problems.push(`${name}: --${flag} has an empty note, so it cannot be rendered at all`);
      }
    }
  }
  assert.deepEqual(problems, [], 'a declaration that cannot drive a control is not a declaration');
});

/**
 * **The anti-copy gate, and it is checked by IDENTITY.**
 *
 * `deepEqual` against a list of legal contents would pass on the day somebody
 * writes `values: ['hard', 'soft']` beside `SEVERITIES` — two spellings that
 * agree today, which is the exact state this repository has now measured going
 * stale four times. So the assertion is `===`: a declared vocabulary must be
 * the array the parser itself checks against, reached by import.
 */
test('every declared vocabulary IS a constant the parser enforces, not a copy of one', () => {
  const known = Object.values(KNOWN_VOCABULARIES);
  const problems: string[] = [];
  for (const [name, flags] of Object.entries(FLAG_DECLARATIONS)) {
    for (const [flag, decl] of Object.entries(flags)) {
      if (decl.values === undefined) continue;
      if (!known.some((vocabulary) => vocabulary === decl.values)) {
        problems.push(
          `${name}: --${flag} declares a vocabulary that is not one of the enforced constants ` +
          `(${Object.keys(KNOWN_VOCABULARIES).join(', ')}). Declare it once, in the module that ` +
          'refuses against it or in command-flags.ts itself, and import it here',
        );
      }
    }
  }
  assert.deepEqual(problems, [], 'a hand-written vocabulary is the drift this plan exists to end');
});

/**
 * The four vocabularies that MOVED into `core/command-flags.ts`, checked at the
 * far end — in the module that enforces each one, and against the spelling it
 * used to keep there.
 *
 * The same shape as `OLD_SPELLINGS` above and for the same reason: comparing
 * VALUES would pass on two lists that happen to agree, which is the state the
 * move exists to end. `--origin` and `--role` are additionally checked against
 * the running CLI below, where their real vocabulary is visible from outside.
 */
const MOVED_VOCABULARIES: Record<string, RegExp[]> = {
  'cli/commands/audit.ts': [/^const ORIGINS\b/m, /^const AUDIT_ROLES\b/m],
  'cli/commands/export.ts': [/^const FORMATS: readonly ArtefactFormat\[\] = \['dir', 'zip'\];$/m],
  'lesson/derive.ts': [/enum: \['do', 'dont'\]/],
};

test('no module keeps its own spelling of a vocabulary that moved to the declarations', () => {
  const problems: string[] = [];
  for (const [rel, spellings] of Object.entries(MOVED_VOCABULARIES)) {
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
    'a vocabulary is declared in two places again. The select would be built from one and the ' +
    'refusal made against the other, which is how a UI comes to offer a value the CLI rejects.',
  );
});

/**
 * **And the vocabularies are real: the running CLI is asked what it enforces.**
 *
 * Identity proves the declaration and the refusal read one array. It does not
 * prove that array is the one the command actually CHECKS — a flag can be
 * declared with a vocabulary nothing enforces, which is exactly what `--role`
 * was before `AUDIT_ROLES` existed: `--role subjekt` counted nothing and said
 * nothing. So the refusal is parsed and compared member for member.
 *
 * Only READ-ONLY commands are probed, and the limit is stated rather than left
 * to be discovered. `audit` and `search` answer a question and write nothing,
 * so a probe that gets past flag validation costs a table nobody reads. The
 * same probe on `add --severity` would create an item and on `export --format`
 * a directory, so `SEVERITIES` and `ARTEFACT_FORMATS` are covered by identity
 * alone — `SEVERITIES` reaches the same `enumError` through `validateCreate`,
 * and `ARTEFACT_FORMATS` through `export`'s own refusal.
 */
const LIVE_PROBE: { argv: string[]; flags: string[] }[] = [
  { argv: ['audit'], flags: ['kind', 'op', 'origin', 'role'] },
  { argv: ['search', 'anything'], flags: ['status', 'relation'] },
];

test('a declared vocabulary is the one the running CLI enforces, member for member', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-vocab-'));
  try {
    assert.equal(runCli(['init'], dir, () => {}), 0, 'the probe workspace did not initialize');
    const run = (argv: string[]): string => {
      const lines: string[] = [];
      try { runCli(argv, dir, (s) => lines.push(s)); }
      catch (err) { lines.push(`THREW: ${(err as Error).message}`); }
      // `enumError`'s sentence is wrapped by the paragraph renderer on some
      // commands and not on others, so the line breaks are collapsed before
      // anything is read out of it.
      return lines.join(' ').replace(/\s+/g, ' ');
    };
    const BOGUS = 'zzz-not-a-legal-value';
    const problems: string[] = [];
    for (const { argv, flags } of LIVE_PROBE) {
      for (const flag of flags) {
        const declared = FLAG_DECLARATIONS[argv[0]][flag]?.values;
        assert.ok(declared, `${argv[0]} --${flag} is live-probed and declares no vocabulary`);
        const refusal = run([...argv, `--${flag}=${BOGUS}`]);
        const said = new RegExp(`"${flag}" must be one of: ([^.]+)\\. You passed "${BOGUS}"`)
          .exec(refusal);
        if (said === null) {
          problems.push(
            `${argv[0]}: --${flag}=${BOGUS} was not refused with the vocabulary. The declaration ` +
            `offers ${declared.length} values that nothing checks. Got: ${refusal.slice(0, 200)}`,
          );
          continue;
        }
        const enforced = said[1].split(', ');
        if (JSON.stringify(enforced) !== JSON.stringify([...declared])) {
          problems.push(
            `${argv[0]}: --${flag} declares [${[...declared].join(', ')}] and the CLI enforces ` +
            `[${enforced.join(', ')}]`,
          );
        }
      }
    }
    assert.deepEqual(
      problems, [],
      'a declared vocabulary and the vocabulary the command enforces are not the same set. A ' +
      'select built from this declaration would offer a value the CLI refuses, or hide one it ' +
      'takes.',
    );
  } finally { removeTree(dir); }
});
