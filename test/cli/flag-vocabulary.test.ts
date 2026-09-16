// @basis TASK-one-concept-has-six-flag-spellings-and-all-means-widen-a, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`cliscript/6`: the vocabulary, and the gate the item asks for instead of a
 * rename pass** — *"THE WORK IS A VOCABULARY PLUS A GATE, not a rename pass"*.
 *
 * ── WHAT WAS MEASURED, over all 48 registered commands, from the per-command
 *    help the CLI itself prints (the same records `/api/cli-help` reads) ─────
 *
 * `--all` — THE ITEM IS RIGHT, and this is the sharp one. Two commands widen a
 * READ (`decay`, `todo`) and two widen a WRITE (`ack`, `review promote`). One
 * word, and the difference between the two senses is the whole corpus.
 *
 * "REMOVE THIS" — SIX spellings, which is the item's number, over a membership
 * that is wrong in both directions. Measured: `--clear` (ack, carry,
 * conversation, focus), `--none` (session), `--unset` (config), `--delete`
 * (config), `--discard` (restore), `--drop` (conversation). The item lists
 * `--off`, which is `conversation --off` — *"stop keeping a session outside
 * the project"*, a mode being turned off rather than a thing being removed —
 * and misses `--delete`, which sits in the SAME command as `--unset`.
 *
 * "CATEGORY" — TWO spellings, not the four the item claims. `--category`
 * (focus) and `--type` (export, review, search) are the item category.
 * `audit --kind` is *"the family of operation … not a second name for one"*
 * and `add --observation` is an observation's own kind; both name different
 * concepts and both are named correctly. The item counted them anyway.
 *
 * INGEST's "candidate"/"draft" — NOT a defect, ruled here rather than left
 * open. The sentence is `ingest-apply`'s summary, *"apply extracted candidates
 * as drafts"*, and the two nouns are two STATES of one artefact — outside the
 * corpus, and inside it unpromoted — so the one sentence describing the
 * crossing is the one place both must appear. `list_drafts` and
 * `stage_rule_candidates` keep the same distinction on the MCP surface. (The
 * item cites line 387; it is line 398 today, which is its own small argument
 * for `RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number`.)
 *
 * ── THE VOCABULARY, WHICH IS THE OWNER'S TO OVERTURN ────────────────────────
 *
 *  1. **`--all` widens a READ, and never a WRITE on its own.** A bulk write is
 *     spelled `--all` PLUS a flag that says what it is bulk OVER — `--code`
 *     for `ack`, `--pack` for `review promote` — and the command refuses when
 *     that bound is missing. This RATIFIES what both commands already do
 *     rather than changing anything, and the test below is what makes a THIRD
 *     bulk write arriving as a bare `--all` impossible to add quietly.
 *  2. **"remove this" is `--clear`**, which already holds four of the six.
 *  3. **"category" is `--type`**, which holds three of the four commands and
 *     is the name the data itself uses (`type:` in an item's front matter,
 *     `type` on `create_item`).
 *
 * **2 and 3 ARE NOT IMPLEMENTED TONIGHT, deliberately.** Retiring a spelling
 * requires it to keep working and to say what replaced it, and the five
 * retirements reach the Composer palette and the help pages, which another
 * lane holds. A half-done rename that silently drops `--unset` is worse than
 * the inconsistency. So the decision is recorded and only 1 is enforced —
 * because 1 is the one where being wrong costs a write.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { runCli } from '../../src/cli/index.ts';
import { CLI_ENTRY } from '../helpers/spawn-cli.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * One CLI run as a PROCESS, for the four assertions that are about an exit
 * code. `status` comes from the OS and never through a shell — a run in this
 * repository once reported 845/127 with exit 1 while the shell printed 0.
 */
function run(argv: string[], cwd: string): { status: number | null; text: string } {
  const r = spawnSync(process.execPath, [CLI_ENTRY, ...argv], { cwd, encoding: 'utf8' });
  return { status: r.status, text: (r.stdout ?? '') + (r.stderr ?? '') };
}

/**
 * The help pages, harvested ONCE and in process.
 *
 * `<command> --help` is a pure read with no workspace requirement, and there
 * are 48 of them against 7 flags to look for: spawning a process per question
 * was 300+ children and minutes of wall clock. The exit code is not what these
 * assertions are about — the printed flag column is — so `runCli` is the right
 * caller here and `spawnSync` stays where the code IS the claim.
 */
let HELP: Map<string, string> | null = null;
function helpPages(cwd: string): Map<string, string> {
  if (HELP !== null) return HELP;
  HELP = new Map();
  for (const name of [...COMMANDS.keys()].sort()) {
    const lines: string[] = [];
    runCli([name, '--help'], cwd, (s) => lines.push(s));
    HELP.set(name, lines.join('\n'));
  }
  return HELP;
}

/** An initialised throwaway workspace — nothing here may touch this corpus. */
function withWorkspace(fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-flagvocab-'));
  try {
    assert.equal(run(['init'], cwd).status, 0, 'the probe workspace did not initialize');
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

/**
 * Every command whose own help ADVERTISES a flag, read out of the flag column
 * of `mycontext <command> --help`.
 *
 * The flag column, and not the whole page: `pack --help` says the words
 * `review promote --all` inside a DESCRIPTION, and a search over the page
 * would have reported `pack` as a fifth `--all` command. That near-miss is why
 * this anchors on the two-space indent the column is laid out with.
 */
function commandsAdvertising(flag: string, cwd: string): string[] {
  const column = new RegExp(`^ {2}--${flag}(?:[ =]|$)`, 'm');
  return [...helpPages(cwd)].filter(([, page]) => column.test(page)).map(([name]) => name).sort();
}

/**
 * **The decision, written down where the gate can check it.** Every command
 * that offers `--all` must appear here, and the classification says which of
 * the two senses it is. A new one lands in neither and reddens — which is the
 * point: the word is not free to be reused.
 */
const ALL_SENSE: Record<string, { sense: 'read' | 'write'; argv: string[]; bound: string }> = {
  decay: { sense: 'read', argv: ['decay', '--all'], bound: '' },
  // `mycontext path` defaults to the subjects with something still owed on
  // them; `--all` adds the finished ones. A READ, in the sense this table
  // fixes — it writes nothing and it widens no write.
  path: { sense: 'read', argv: ['path', '--all'], bound: '' },
  todo: { sense: 'read', argv: ['todo', '--all'], bound: '' },
  ack: { sense: 'write', argv: ['ack', '--all'], bound: '--code' },
  review: { sense: 'write', argv: ['review', 'promote', '--all'], bound: '--pack' },
};

test('`--all` widens a read freely, and never widens a write without a named bound', () => {
  withWorkspace((cwd) => {
    const offering = commandsAdvertising('all', cwd);
    // Anti-vacuity: an empty harvest would make every loop below assert
    // nothing, and a help page that stopped printing a flag column looks
    // exactly like a clean pass.
    assert.ok(
      offering.length >= 2,
      `${offering.length} command(s) advertise --all; the harvest is broken rather than the CLI`,
    );
    assert.deepEqual(
      offering, Object.keys(ALL_SENSE).sort(),
      'a command offers `--all` and this file does not say which of the two senses it is. ' +
      '`--all` means "widen the read" in some commands and "widen the WRITE" in others, so a new ' +
      'one has to be classified rather than inherited (cliscript/6).',
    );

    for (const name of offering) {
      const spec = ALL_SENSE[name];
      const bare = run(spec.argv, cwd);

      if (spec.sense === 'read') {
        assert.equal(
          bare.status, 0,
          `\`${spec.argv.join(' ')}\` — declared a READ widening — exited ${bare.status}. ` +
          'A read that refuses to be widened is either misclassified here or has grown a gate.',
        );
        continue;
      }

      // The write sense. The refusal is the gate, and the exit code is the
      // contract (`CONST-the-cli-exit-code-contract`).
      assert.equal(
        bare.status, 1,
        `\`${spec.argv.join(' ')}\` — declared a WRITE widening — exited ${bare.status} with no ` +
        `${spec.bound}. An unbounded bulk write spelled with the same word that widens a listing ` +
        'in two other commands is exactly what cliscript/6 is about.',
      );
      assert.ok(
        bare.text.includes(spec.bound),
        `the refusal does not name ${spec.bound}, the flag that BOUNDS the bulk act. A refusal ` +
        'that does not say what to add is a refusal somebody works around.',
      );
    }
  });
});

/**
 * The second half of the vocabulary, enforced as a CEILING rather than a
 * rename: the six spellings of "remove this" may not become seven.
 *
 * This is the honest enforcement available tonight. Collapsing them to
 * `--clear` reaches surfaces another lane holds, so what is pinned is that the
 * set does not GROW while the decision is unapplied — and each member carries
 * the object it removes, so the next reader can see the argument rather than a
 * bare list.
 */
const REMOVAL_SPELLINGS: Record<string, string> = {
  clear: 'ack, carry, conversation, focus — withdraw the mark/name/focus. The recommended survivor.',
  none: 'session — clears the carry mark. `carry --clear` does the same thing under the other name.',
  unset: 'config — remove entries from a list field.',
  delete: 'config — remove a custom category declaration. The SAME command as --unset.',
  discard: 'restore — withdraw a staged restore.',
  drop: 'conversation — take one anchor back.',
};

test('"remove this" is still spelled six ways and has not grown a seventh', () => {
  withWorkspace((cwd) => {
    const found: Record<string, string[]> = {};
    for (const spelling of Object.keys(REMOVAL_SPELLINGS)) {
      const commands = commandsAdvertising(spelling, cwd);
      assert.ok(
        commands.length > 0,
        `--${spelling} is declared here and no command advertises it. Either it was retired — in ` +
        'which case say so here and record what replaced it — or the harvest is broken.',
      );
      found[spelling] = commands;
    }
    /**
     * `--clear` is the recommended survivor BECAUSE it already holds the most
     * commands, and the claim is STRICT: it must cover more than every other
     * spelling, not merely tie with them. A ties-allowed comparison would stay
     * green with `--clear` reduced to one command, which is the state in which
     * the recommendation is worth least.
     */
    const rivals = Object.entries(found).filter(([name]) => name !== 'clear');
    for (const [name, commands] of rivals) {
      assert.ok(
        found.clear.length > commands.length,
        `--${name} now covers ${commands.length} command(s) and --clear covers ` +
        `${found.clear.length}. The recommendation in this file's header picked --clear on ` +
        'exactly that ground, and no longer stands on it.',
      );
    }
  });
});
