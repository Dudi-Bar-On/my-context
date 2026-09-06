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
import { SUBCOMMANDS as CONVERSATION_SUBCOMMANDS } from '../../src/cli/commands/conversation.ts';
import { SUBCOMMANDS as PACK_SUBCOMMANDS } from '../../src/cli/commands/pack.ts';
import { SUBCOMMANDS as PROCEDURE_SUBCOMMANDS } from '../../src/cli/commands/procedure.ts';
import { SUBCOMMANDS as REVIEW_SUBCOMMANDS } from '../../src/cli/commands/review.ts';
import { SUBCOMMANDS as SESSION_SUBCOMMANDS } from '../../src/cli/commands/session.ts';
import { SUBCOMMANDS as STATUSLINE_SUBCOMMANDS } from '../../src/cli/commands/statusline.ts';
import { removeTree } from './tmp.ts';

/** A flag string no command accepts, used to prove the probe below can fail. */
export const SENTINEL = '--zzz-not-a-flag-any-command-accepts';

/** A positional no command has as a subcommand — see `subcommandedByParser`. */
export const NOT_A_SUBCOMMAND = 'zzz-not-a-subcommand-any-command-has';

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
  init: 'refuses every argument in one sentence of its own — it takes exactly one flag, '
    + '--pack <path>, and says so rather than reporting an unknown option. There is no --yes '
    + 'on it to find either way: `init --pack` creates the corpus it imports into, so there is '
    + 'nothing yet to protect, and everything a pack brings in still lands `draft`',
  rebuild: 're-indexes what is on disk and takes no flags at all',
  show: 'takes an id, not flags — it reads the sentinel as the id and says so',
};

/**
 * **This table used to have nine rows, and the five that left are worth
 * naming here rather than only in a diff.**
 *
 * `ingest`, `ingest-apply`, `lesson-stage`, `lesson-accept` and
 * `lesson-discard` were excused because each printed its usage for a missing
 * POSITIONAL before any flag was looked at — so the probe could not reach
 * their flag surface, and its silence about them was recorded rather than
 * mistaken for an answer. That was the honest thing to do about a hole, and
 * it was still a hole: the reason those commands failed on the positional
 * first is that they validated no flags AT ALL, so the probe was not being
 * blocked by an ordering accident, it was being blocked by the absence of the
 * very thing it measures. `lesson-accept` sat in that gap while creating
 * ACTIVE rules from four command-line overrides it silently dropped if
 * misspelt.
 *
 * plan:builder seq:1c gave all five parsers, against sets in
 * `core/command-flags.ts`, and this probe now reaches them: it confirms, by
 * running them, that none takes `--yes` — which is what `UNGATED` below
 * asserts about `lesson-accept` in prose, and which nothing could check while
 * the excuse stood.
 */

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
 * Takes `--yes`, and is NOT on the approval boundary — with the reason.
 *
 * `gated` is a fact about the argument parser: these command strings accept
 * `--yes`, and §7's flag table says so, because a reader who types the flag
 * needs to know where it works. The BOUNDARY is a narrower claim — "changes
 * what governs this project with no human in the loop" — and the two are not
 * the same set. `statusline install --yes` writes `statusLine` into Claude
 * Code's own `settings.json` and saves the command it displaced; it puts no
 * text in front of a model, creates no item, and promotes nothing. Neither
 * does `uninstall`, which puts the saved copy back.
 *
 * This record is why deriving `boundary` as "everything gated" was safe until
 * now and is not any more: the day the probe started expanding `statusline`,
 * "gated" and "on the boundary" stopped coinciding, and folding these two into
 * §7's table would have put a Claude Code settings edit in the list of things
 * that change what governs this corpus — and onto the deny list the skill
 * reads — which is a false claim in a document whose value is that it is
 * exact. The alternative, leaving them out of `gated` too, would have put the
 * blind spot back where it was found.
 *
 * Every entry is re-verified in `approvalBoundary()`: one that stops taking
 * `--yes` fails rather than lingering as an excuse for a command that no
 * longer exists in that shape.
 */
export const OUTSIDE_BOUNDARY: Record<string, string> = {
  'statusline install': 'writes Claude Code\'s own settings.json (the statusLine entry) and '
    + 'saves the command it displaced. It changes nothing about what governs this project — '
    + 'see test/cli/statusline.test.ts, which states the same ruling where the bare verb '
    + 'refuses --yes',
  'statusline uninstall': 'restores the saved statusLine entry in that same settings.json; '
    + 'the other half of install, and off the boundary for the same reason',
};

/**
 * The commands whose SUBCOMMAND is the mechanism — DERIVED from the registry
 * and from the running parser, not listed here.
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
 *
 * `statusline` is the fifth, and it is the one that proves this table could
 * not stay a LIST. The four above were written down on the day four commands
 * had subcommands; `statusline install --yes` and `statusline uninstall --yes`
 * shipped afterwards, the list did not grow, and so the probe asked about the
 * bare verb — which refuses `--yes` — and answered "not gated" for a command
 * string that takes it. Nothing was wrong by this module's own contract, which
 * is the whole defect: a checker whose entire job is to enumerate the approval
 * boundary had a blind spot with no failing test in it, because the thing it
 * could not see was the thing it was never told to look at. So the set below
 * is asked for rather than remembered, twice over.
 *
 * ── HOW THE SET IS DERIVED, AND WHY IT TAKES TWO QUESTIONS ─────────────────
 *
 * 1. **What each command ADVERTISES**, read off the registry: a `usage` line
 *    whose first token after the command name is an alternation of bare words
 *    — `pack [import|list] [<path>]` — is a command dispatched by subcommand,
 *    and the alternation names them. Three of the five build that line from
 *    their own `SUBCOMMANDS` constant already, so for them this is the
 *    executable list read through one indirection.
 * 2. **What each command DISPATCHES**, asked of the running parser: every
 *    registered command is handed a bogus subcommand and the sentinel flag on
 *    one command line, and the ones that answer with a subcommand refusal are
 *    the subcommanded ones. The sentinel is what makes that safe to run
 *    against every command in the registry rather than a chosen few — a
 *    command that is NOT subcommanded refuses the unknown flag and does no
 *    work, which is why `mycontext ui zzz --sentinel` prints a refusal instead
 *    of starting a web server.
 *
 * Neither question alone is enough, and they fail differently. (1) alone
 * trusts a hand-written usage string: `procedure`'s and `statusline`'s are
 * typed out, and one that lost a subcommand would silently shrink this set
 * back into a blind spot. (2) alone can say WHICH commands are subcommanded
 * but not what the subcommands are CALLED, and enumerating those by probing is
 * not possible — there is nothing to enumerate over. Asserted against each
 * other, a usage line that stops matching the dispatch is red, and so is a
 * sixth subcommanded command arriving with nothing said about it.
 *
 * What is still NOT covered, stated rather than left to be discovered: a
 * command that dispatches on a subcommand, advertises it in some other shape
 * (`foo <sub>`), AND refuses an unknown one in words no other command uses,
 * would be missed by both halves at once. The refusal wording is the thin
 * part — every one of the five says "unknown … subcommand" today, and
 * `subcommandedByParser` matches exactly that.
 */

/** `[a|b|c]` — an alternation of bare words, as the first thing a usage says. */
const SUBCOMMAND_GROUP = /^\[([a-z][\w-]*(?:\|[a-z][\w-]*)+)\]$/;

/**
 * The five commands' own exported lists, pinned against what their registry
 * `usage` advertises.
 *
 * This is NOT the set — the set is derived below, and a sixth subcommanded
 * command joins it without this record being touched. What this buys is the
 * one thing the derivation cannot ask for: that the advertised subcommand
 * NAMES are the ones the command dispatches on. `subcommandedFromUsage`
 * requires the keys here to be exactly the derived set, so a new member cannot
 * arrive un-pinned; it has to export its list and be named here, with the
 * failure saying so.
 */
const DECLARED_SUBCOMMANDS: Record<string, readonly string[]> = {
  conversation: CONVERSATION_SUBCOMMANDS,
  pack: PACK_SUBCOMMANDS,
  procedure: PROCEDURE_SUBCOMMANDS,
  review: REVIEW_SUBCOMMANDS,
  session: SESSION_SUBCOMMANDS,
  statusline: STATUSLINE_SUBCOMMANDS,
};

/** Question 1: the subcommanded set as the registry's usage lines state it. */
export function subcommandedFromUsage(): Record<string, readonly string[]> {
  const derived: Record<string, readonly string[]> = {};
  for (const def of COMMANDS.values()) {
    const rest = def.usage.startsWith(def.name)
      ? def.usage.slice(def.name.length).trim()
      : def.usage.trim();
    const group = SUBCOMMAND_GROUP.exec(rest.split(/\s+/)[0] ?? '');
    if (group !== null) derived[def.name] = group[1].split('|');
  }
  assert.ok(
    Object.keys(derived).length > 0,
    'no registered command advertises subcommands. Either the registry is empty in this ' +
    'process or SUBCOMMAND_GROUP no longer matches the usage lines — both would classify ' +
    'every subcommand-only flag as unreachable, in silence.',
  );
  assert.deepEqual(
    Object.keys(derived).sort(), Object.keys(DECLARED_SUBCOMMANDS).sort(),
    'the set of commands whose usage advertises subcommands has changed. Export that ' +
    'command\'s SUBCOMMANDS and name it in DECLARED_SUBCOMMANDS — the probe below reaches a ' +
    'flag only on a command STRING it knows, so an unexpanded subcommanded command can carry ' +
    'a `--yes` that nothing measures. That is how `statusline install --yes` went unseen.',
  );
  for (const [name, subs] of Object.entries(derived)) {
    assert.deepEqual(
      [...subs], [...DECLARED_SUBCOMMANDS[name]],
      `${name}'s usage line advertises [${subs.join('|')}] and it dispatches on ` +
      `[${DECLARED_SUBCOMMANDS[name].join('|')}]. A subcommand that is dispatched and not ` +
      `advertised is one this derivation never probes.`,
    );
  }
  return derived;
}

/** How all five refuse a subcommand they do not have. */
const SUBCOMMAND_REFUSAL = /\bunknown (?:[a-z-]+ )?subcommand\b/;

/**
 * Question 2: which commands the PARSER dispatches by subcommand.
 *
 * Takes the probe's `run` rather than opening a second workspace, so this
 * costs one extra invocation per registered command inside the run the
 * derivation already pays for.
 */
export function subcommandedByParser(run: (argv: string[]) => string): string[] {
  return [...COMMANDS.keys()]
    .filter((name) => SUBCOMMAND_REFUSAL.test(run([name, NOT_A_SUBCOMMAND, SENTINEL])))
    .sort();
}

/** Every command string a permission rule would be written against. */
export function commandStrings(): string[] {
  const subcommanded = subcommandedFromUsage();
  const top = [...COMMANDS.keys()].filter((name) => !Object.hasOwn(subcommanded, name));
  const expanded = Object.entries(subcommanded)
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
 *
 * ── THE `--yes` QUESTION IS ASKED WITHOUT ANSWERING IT ─────────────────────
 *
 * `--yes` is passed with the SENTINEL AFTER IT, never on its own. Both flags
 * are read by the same left-to-right walk (`unknownFlag`, cli/commands/format.ts),
 * which reports the FIRST name it does not recognize — so a command that does
 * not take `--yes` still names `--yes`, and one that does takes it and then
 * refuses the sentinel. Either way the command stops at flag validation and
 * the classification is unchanged, which was checked against the set the bare
 * form produced before this was adopted.
 *
 * It matters because a bare `--yes` does not ask whether the gate exists — it
 * ANSWERS it, and the command then does the thing. That was survivable only
 * for as long as every gated command happened to fail on a missing positional
 * first, and expanding `statusline` ended it: `statusline install` needs no
 * argument, so probing it with a bare `--yes` INSTALLED the mycontext status
 * line into the developer's own `~/.claude/settings.json` and saved the
 * displaced command under `~/.my-context/`, on a machine where the suite was
 * merely being run. `test/helpers/real-home-guard.ts` caught the write, which
 * is the only reason it was not shipped. A probe whose job is to enumerate the
 * approval boundary must not cross it.
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

    // Question 2 of the derivation above, asked here because this is where a
    // workspace and a `run` already exist. Both directions: a subcommanded
    // command whose usage does not advertise its subcommands would never be
    // expanded (the blind spot), and a command expanded on the strength of a
    // usage line it does not honour would be probed as command strings the
    // parser has never heard of.
    assert.deepEqual(
      subcommandedByParser(run), Object.keys(subcommandedFromUsage()).sort(),
      'the commands the PARSER dispatches by subcommand and the ones whose registry usage ' +
      'ADVERTISES subcommands are not the same set. Whichever is right, the ones only the ' +
      'parser knows are commands this probe would never expand — and a subcommand-only ' +
      '`--yes` on one of them is an approval-boundary flag nothing measures.',
    );

    const all = commandStrings();
    const gated = new Set<string>();
    const unreachable: string[] = [];
    for (const command of all) {
      const argv = command.split(' ');
      if (!refuses(run([...argv, SENTINEL]), SENTINEL)) { unreachable.push(command); continue; }
      // `--yes` FIRST and the sentinel behind it: see the header. The command
      // refuses one of the two and runs nothing either way.
      if (!refuses(run([...argv, '--yes', SENTINEL]), '--yes')) gated.add(command);
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
  // Re-verified rather than trusted: an entry excusing a command that no
  // longer takes `--yes` is an excuse for something that is not there, and it
  // would go on quietly keeping a real member out of §7 if that name were
  // later reused.
  const stale = Object.keys(OUTSIDE_BOUNDARY).filter((name) => !gated.has(name)).sort();
  assert.deepEqual(
    stale, [],
    'a command string named in OUTSIDE_BOUNDARY no longer takes `--yes`. Drop the entry — ' +
    'while it stands, it subtracts a name from the boundary on the strength of a reason ' +
    'about a command line that no longer exists.',
  );
  const boundary = [
    ...[...gated].filter(
      (name) => !aliases.includes(name) && !Object.hasOwn(OUTSIDE_BOUNDARY, name),
    ),
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
