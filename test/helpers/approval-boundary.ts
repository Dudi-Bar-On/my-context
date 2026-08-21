/**
 * **The approval boundary, derived from the running program.**
 *
 * The set of commands that change what governs a project with no human in the
 * loop is stated on four surfaces: §7 of `README.md`, §7 of
 * `docs/README.he.md`, the recommended `permissions.deny` block both carry,
 * and `skills/mycontext/SKILL.md` — the one the MODEL reads, at every session
 * start. Each of those was hand-kept, and each went stale: the READMEs on the
 * day `inbox-promote` shipped, and the skill for longer than that, missing
 * `inbox-promote`, `refresh` and `review discard-revision` while
 * `commands/refresh.md` told the model the opposite ("it is on the deny list
 * this plugin's README recommends").
 *
 * This module is the one derivation the checkers for all four share. It lived
 * inside `test/docs/counts.test.ts` first; a second copy for the skill would
 * have been two lists again, one layer down, which is the defect it exists to
 * remove.
 *
 * **What makes a command a member, decided here rather than remembered.** The
 * working definition is: it changes what governs this project, and no human is
 * required to reach that write. The second half is what `--yes` is — a token
 * anything holding a shell can type — so the set is derived by asking the real
 * argument parser which commands accept `--yes`, then subtracting the names
 * that are not separate mechanisms and adding the one command whose gate is not
 * weak but ABSENT.
 *
 * The derivation is deliberately not tuned to reproduce what §7 already said.
 * Run against the nine-command text it replaced it named `refresh` as a tenth
 * member — `mycontext refresh <id> --yes` replaces a governing item's body with
 * the current text of the file that item snapshots, which is what `add --file`
 * on a normative category promises ("`mycontext refresh` takes a new snapshot
 * through this same gate", src/cli/index.ts) and which §7 never listed. It was
 * already on the deny list, which is how the omission stayed invisible: the
 * rules were right and the prose was not.
 */
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { NAMED_ENTRY_POINTS } from '../../src/cli/commands/edit.ts';
import { SUBCOMMANDS as PACK_SUBCOMMANDS } from '../../src/cli/commands/pack.ts';
import { SUBCOMMANDS as PROCEDURE_SUBCOMMANDS } from '../../src/cli/commands/procedure.ts';
import { SUBCOMMANDS as REVIEW_SUBCOMMANDS } from '../../src/cli/commands/review.ts';
import { SUBCOMMANDS as SESSION_SUBCOMMANDS } from '../../src/cli/commands/session.ts';
import { removeTree } from './tmp.ts';

/** A flag string no command accepts, used to prove the probe below can fail. */
export const SENTINEL = '--zzz-not-a-flag-any-command-accepts';

/**
 * Commands whose argument surface the `--yes` probe cannot reach, each with the
 * reason. This table exists because the probe's negative answer is worthless
 * without it: a command that refuses NOTHING would be silently classified as
 * "does not take --yes", and a checker that quietly answers for a case it never
 * tested is the exact defect this repository has now found five times.
 *
 * Every entry is re-checked below, so one that stops being true fails rather
 * than lingering, and a new command that validates no flags has to be named
 * here with a reason instead of falling through.
 */
export const NO_FLAG_PROBE: Record<string, string> = {
  help: 'takes a topic, not flags — it reads the sentinel as the topic and says so',
  init: 'creates a workspace and takes no flags at all',
  ingest: 'prints its usage for the missing <path> before any flag is looked at',
  'ingest-apply': 'prints its usage for the missing <session-id> first',
  'lesson-accept': 'prints its usage for the missing <LESSON-id> <key> first — and there is '
    + 'no --yes on it to find either way; see UNGATED below',
  'lesson-discard': 'prints its usage for the missing <LESSON-id> <key> first',
  'lesson-stage': 'prints its usage for the missing <LESSON-id> first',
  rebuild: 're-indexes what is on disk and takes no flags at all',
  show: 'takes an id, not flags — it reads the sentinel as the id and says so',
};

/**
 * The member the `--yes` probe cannot find, because there is nothing to find.
 *
 * `mycontext lesson-accept <lesson> <key>` creates an `active` rule — governing
 * this project — with no `--yes` and no prompt of any kind. It is a member a
 * fortiori: the probe looks for commands whose confirmation a human need not
 * answer, and this one has no confirmation to answer. §3's "From an incident to
 * a rule" says the same thing in prose ("There is no second command and no
 * `--yes` to withhold"), and §7 now says it where the gate is described.
 *
 * Naming it here is the one place this derivation is told something rather than
 * asking, so it is not taken on trust: `the ungated member … is real` in
 * `test/docs/counts.test.ts` runs the whole lesson → stage → accept flow with
 * no `--yes` and no terminal, and fails if the rule does not appear. If a gate
 * is ever added, that test goes red and this entry has to be revisited rather
 * than silently surviving.
 */
export const UNGATED: Record<string, string> = {
  'lesson-accept': 'creates an active rule with no --yes and no prompt at all (§3, §7)',
};

/**
 * In the table and on the deny list, deliberately outside the count.
 *
 * `review discard-revision` settles — terminally — a decision the revision
 * queue exists to reserve for a human, so it belongs on the deny list and in
 * the table. It changes nothing about what governs, which is why §7 says in the
 * row itself that it is not counted. Both halves are asserted in
 * `test/docs/counts.test.ts`: it must still take `--yes`, or this exemption is
 * about a command that no longer behaves the way the row describes, and it must
 * still be in the table.
 *
 * The skill's two sentences split on exactly this line, which is why both sets
 * below are exported rather than only one: the sentence that says these
 * commands "change what governs" carries `counted`, and the sentence that tells
 * the model never to run them carries `denyRequired`, which includes this
 * command and the four aliases.
 */
export const NOT_COUNTED = ['review discard-revision'];

/**
 * The commands whose SUBCOMMAND is the mechanism, expanded from each command's
 * own exported list rather than from a second copy written here.
 *
 * A permission rule is matched against the command string, and `--yes` is
 * accepted per subcommand: `mycontext review --yes` and `mycontext procedure
 * --yes` are both refused as unknown options, while `review promote --yes` and
 * `procedure activate --yes` write. A probe that asked only about the bare
 * verb would therefore answer "not gated" for a command that makes an item
 * govern this project, which is the silent hole this whole derivation exists
 * to close — it is how `review` came to be expanded in the first place, and
 * `procedure` is the second command of that shape.
 *
 * `pack` is the third, and it is the case that shows why this table cannot be
 * skipped rather than merely why it is convenient: `mycontext pack --yes` is
 * refused as an unknown subcommand before a flag is looked at, so a probe that
 * asked only about the bare verb would have classified the whole command as
 * unreachable — and `pack import --yes --overwrite-changed` replaces the text
 * of an item that is already governing here and drops it to `draft`.
 *
 * `session` is the fourth, and it is here for the OPPOSITE failure — the quiet
 * one. `mycontext session` defaults to `session list`, so the bare verb is
 * perfectly reachable and answers "not gated" without the probe ever touching
 * `session name`, the half that writes. That answer would be right today and
 * would stay unchanged on the day a writing subcommand grew a `--yes`, which is
 * the same silent hole as `pack`'s wearing the opposite disguise: there, the
 * verb refused everything and looked unreachable; here it accepts a read and
 * looks answered. Expanding it means both subcommands are probed by name.
 */
const SUBCOMMANDED: Record<string, readonly string[]> = {
  pack: PACK_SUBCOMMANDS,
  procedure: PROCEDURE_SUBCOMMANDS,
  review: REVIEW_SUBCOMMANDS,
  session: SESSION_SUBCOMMANDS,
};

/** Every command string a permission rule would be written against. */
export function commandStrings(): string[] {
  const top = [...COMMANDS.keys()].filter((name) => !Object.hasOwn(SUBCOMMANDED, name));
  const expanded = Object.entries(SUBCOMMANDED)
    .flatMap(([name, subs]) => subs.map((sub) => `${name} ${sub}`));
  return [...top, ...expanded].sort();
}

/**
 * Which command strings the real parser accepts `--yes` on.
 *
 * Probed rather than read out of a source file: the accepted-flag list is a
 * per-command array (`ALLOWED`, `NAMED_ALLOWED`, `SUBCOMMAND_FLAGS`, …) with no
 * single expression to import, and a grep for `'yes'` would find the word in
 * comments and in `--always=yes`. What the CLI does with `--yes` on its own
 * command line is the fact §7 is about, so that is what is asked.
 *
 * The sentinel is the anti-vacuity half. Without it, "did not complain about
 * --yes" is satisfied by every command that refuses earlier for an unrelated
 * reason, which on the first draft of this probe classified all but one command
 * as gated.
 */
export function gatedCommands(): Set<string> {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-boundary-'));
  try {
    assert.equal(runCli(['init'], dir, () => {}), 0, 'the probe workspace did not initialize');
    const run = (argv: string[]): string => {
      const lines: string[] = [];
      runCli(argv, dir, (s) => lines.push(s));
      return lines.join('\n');
    };
    const refuses = (text: string, flag: string): boolean =>
      text.includes(`unknown flag "${flag}"`) || text.includes(`unknown option "${flag}"`);

    const all = commandStrings();
    const gated = new Set<string>();
    const unreachable: string[] = [];
    for (const command of all) {
      const argv = command.split(' ');
      if (!refuses(run([...argv, SENTINEL]), SENTINEL)) { unreachable.push(command); continue; }
      if (!refuses(run([...argv, '--yes']), '--yes')) gated.add(command);
    }
    assert.deepEqual(
      unreachable.sort(), Object.keys(NO_FLAG_PROBE).sort(),
      'the set of commands whose flags this probe cannot reach has changed. Add the new one ' +
      'to NO_FLAG_PROBE with the reason, or drop the entry that is no longer true — do not ' +
      'let a command fall through unclassified, because the probe would answer "not gated" ' +
      'for it without ever having tested that.',
    );
    // Both directions, so a probe that answered the same way for everything —
    // the shape `check-retired.ts` shipped in — cannot pass here.
    assert.ok(gated.size > 0, 'the probe found no command that takes --yes; it is broken');
    assert.ok(
      gated.size < all.length - unreachable.length,
      'the probe found that EVERY reachable command takes --yes; it is broken',
    );
    return gated;
  } finally {
    removeTree(dir);
  }
}

/** What the derivation produces, in the shapes the checkers ask for. */
export interface ApprovalBoundary {
  /** Every command string the parser accepts `--yes` on, aliases included. */
  gated: Set<string>;
  /** `pin`/`unpin`/`harden`/`soften` — `edit` under a shorter name, from the registry. */
  aliases: string[];
  /** The gated mechanisms, plus the ungated one. What §7's table is about. */
  boundary: string[];
  /** Of those, the ones that change what governs — the number §7 states. */
  counted: string[];
  /**
   * Every command STRING that needs a rule of its own, which is `boundary`
   * plus the four aliases: a permission rule is matched against the string, so
   * `Bash(mycontext edit *)` does not match `mycontext pin …`. The skill's
   * "never run these" sentence carries the same set, for the same reason — an
   * agent told "never `edit`" is not thereby told "never `pin`".
   */
  denyRequired: string[];
}

let cached: ApprovalBoundary | undefined;

/**
 * The derivation, computed once per process.
 *
 * Memoized because the probe runs the real CLI against a throwaway workspace
 * roughly seventy times, and two test files now ask for it.
 */
export function approvalBoundary(): ApprovalBoundary {
  if (cached) return cached;
  const gated = gatedCommands();
  const aliases = NAMED_ENTRY_POINTS.map((entry) => entry.name);
  const boundary = [
    ...[...gated].filter((name) => !aliases.includes(name)),
    ...Object.keys(UNGATED),
  ].sort();
  cached = {
    gated,
    aliases,
    boundary,
    counted: boundary.filter((name) => !NOT_COUNTED.includes(name)),
    denyRequired: [...new Set([...boundary, ...aliases])].sort(),
  };
  return cached;
}
