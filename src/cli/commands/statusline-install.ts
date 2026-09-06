import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUBCOMMAND_FLAGS } from '../../core/command-flags.ts';
import { normalizePosix } from '../../core/paths.ts';
import type { Workspace } from '../../core/workspace.ts';
import { refuseUnknownFlag } from './format.ts';
import { flag, hasFlag, type Emit } from './registry.ts';

// --- Installing the bridge (spec §4b: opt-in; §8: never clobber) ------------
//
// The binding rule: installing mycontext never touches a status line; asking
// for the bridge does, and only after the existing setting has been shown.
// `CommandFn` is synchronous and this CLI has no interactive prompt, so "ask"
// takes the project's own consent form: WITHOUT --yes this prints the existing
// setting and the exact replacement and exits having written nothing; --yes —
// the greppable consent token README §7 defines — applies it.
//
// The posture is `src/ui/read-model-config.ts`'s, one file over: *configuration
// changes are the user's to make*. That file answers by REFUSING to write at
// all and composing a command for the human to run. This one is that command,
// so it cannot refuse outright — but every writing path here is either shown
// first and consented to, or refused:
//
//   - a `statusLine` that is not ours is printed in full and replaced only on
//     an explicit `--yes` naming what it replaces;
//   - a second `install` over our own entry is a NO-OP, because overwriting
//     the saved copy with our own value is how an "uninstall" comes to leave a
//     `statusLine` pointing at a bridge that is no longer installed;
//   - `uninstall` REFUSES, on any flag, when the entry in the file is not
//     ours: writing our saved copy over a setting the user made after
//     installing is the same clobber, performed on the way out;
//   - a settings file that does not parse is never written, on any path.
//
// And the round trip is byte-clean: the whole file is saved, not just the
// value, so an uninstall gives back the user's indentation, key order and
// trailing newline exactly as they wrote them. A "reversible" install that
// silently reformats a document a human maintains has not reversed anything.

/**
 * The absolute path to THIS checkout's CLI entry, resolved from this module
 * rather than looked up — the same construction, and for the same reason, as
 * `src/ui/execute.ts` · `CLI_ENTRY`: what is on PATH is whatever the user last
 * installed, which may be a different version, a different checkout, or not
 * this project at all.
 *
 * POSIX separators (`INV-posix-normalized-paths`), which here is not only house
 * style: the command string is handed to a SHELL by Claude Code, and a
 * backslash inside double quotes is literal in `cmd.exe` but an escape
 * character in `sh`. Forward slashes are literal in both, and Node accepts them
 * as path separators on Windows.
 */
const OUR_CLI_ENTRY_NATIVE = fileURLToPath(new URL('../index.ts', import.meta.url));
const OUR_CLI_ENTRY = normalizePosix(OUR_CLI_ENTRY_NATIVE);

/**
 * The value installed, exactly (spec §4b).
 *
 * `refreshInterval` is per §4b's Compatibility note: Claude Code re-runs the
 * command on that cadence as well as per message, so the tee stays fresh while
 * a session idles and the UI's "as of" age does not drift for no reason.
 *
 * Exported so the test asserts against THIS value rather than a second copy of
 * it — a pasted literal is free to drift from the thing it is checking.
 *
 * ── WHY THIS IS NOT `mycontext statusline` (fixed 2026-08-27) ─────────────
 *
 * It was, and it never started. `package.json` declares
 * `bin: { mycontext: ./src/cli/index.ts }`, so that name exists on PATH only
 * after a global install or `npm link`; this plugin installs from a
 * local-directory marketplace, which does neither. Measured on the owner's
 * machine: `command -v mycontext` finds nothing, and `cmd.exe` answers
 * `'mycontext' is not recognized as an internal or external command`.
 *
 * That failure is worse than a wrong status line. Claude Code would run the
 * command, it would not resolve, and the bridge would never start — so the tee
 * never happens AND the delegate never runs. An install performed to PRESERVE
 * the user's status line would have destroyed it instead, silently, because a
 * status line that fails prints nothing.
 *
 * **Bare `node`, not `process.execPath`, and that is measured rather than
 * preferred.** Every entry in `hooks/hooks.json` invokes bare `node` and every
 * hook works on this machine, so `node` is demonstrably on the PATH Claude Code
 * spawns with — `hooks.json` is the precedent, and it is the surface that never
 * assumed a binary of ours. `process.execPath` would additionally freeze one
 * interpreter's location into a settings file and break the day it is upgraded
 * or moved.
 *
 * **An absolute path is CORRECT here, not a compromise.** This is written to
 * `~/.claude/settings.json` — USER settings, not a project's — where
 * `${CLAUDE_PROJECT_DIR}` means nothing. A per-machine settings file is exactly
 * where a per-machine absolute path belongs. What it costs is stated at install
 * time (`RELOCATION_NOTE`), because it is the user's machine and the tradeoff
 * is his to see.
 */
export const INSTALLED = {
  type: 'command',
  command: `node --disable-warning=ExperimentalWarning "${OUR_CLI_ENTRY}" statusline`,
  refreshInterval: 60,
};

/**
 * Every command string this project has ever installed as its status line.
 *
 * `INSTALLED.command` is first; the rest are SPELLINGS THIS COMMAND USED TO
 * WRITE, and they are kept for exactly one reason: a bridge installed by an
 * earlier build must still be recognised as OURS. Unrecognised, it would be
 * treated as somebody else's status line — chained to, which makes the bridge
 * delegate to the bridge once per assistant message — and `uninstall` would
 * refuse to clean it up, because refusing to overwrite a foreign setting is
 * what `uninstall` is for.
 *
 * Nothing is ever removed from this list. It only grows.
 */
const OUR_COMMANDS: readonly string[] = [
  INSTALLED.command,
  // Pre-2026-08-27. Never started: `mycontext` is not on PATH for a
  // local-directory plugin install. See `INSTALLED` above.
  'mycontext statusline',
];

/**
 * The cost of the absolute path in `INSTALLED.command`, said where the preview
 * speaks rather than in a document nobody opens.
 *
 * It is a real limitation and it is stated in the same breath as the value it
 * belongs to (`STD-guarantee-claims-carry-their-condition-in-the-same-sentence`):
 * the entry names THIS directory, and a settings file outlives a checkout.
 */
const RELOCATION_NOTE =
  'That command names this checkout by absolute path, which is what a per-machine settings ' +
  'file is for — but it stops working if this repository is moved, renamed or deleted, and a ' +
  'status line that cannot start prints nothing at all rather than an error. If you move it, ' +
  'run `mycontext statusline uninstall --yes` from the OLD location first (or from the new one, ' +
  'which restores the same saved copy) and install again.';

// Both subcommands are handed the identical record, which is why the lifted
// entry (`core/command-flags.ts` · `SUBCOMMAND_FLAGS`) writes it twice and this
// module reads one of the two. `install` rather than `uninstall` for no reason
// beyond alphabetical order; the test that probes the lift asserts they agree.
const { allowed: FLAGS, values: VALUE_FLAGS } = SUBCOMMAND_FLAGS['statusline']['install'];

const USAGE =
  'usage: mycontext statusline install   [--settings <path>] [--yes]\n' +
  '       mycontext statusline uninstall [--settings <path>] [--yes]\n' +
  '  --settings  the settings.json to read and write (default: Claude Code\'s own)\n' +
  '  --yes       apply the change printed above; without it nothing is written';

/**
 * Where Claude Code reads settings: `CLAUDE_CONFIG_DIR`, else `~/.claude`.
 *
 * Both are Claude Code's own, not this project's invention — `CLAUDE_CONFIG_DIR`
 * is honoured by the binary itself, which is why an installer that ignored it
 * would write a file the user's Claude Code never reads and then report
 * success. An empty value is treated as unset, matching the way the binary
 * reads it: an exported-but-empty variable is not a directory.
 *
 * Takes the environment as an argument rather than reading `process.env`, so
 * both branches are testable without mutating the process.
 */
export function claudeSettingsPath(env: Record<string, string | undefined>): string {
  const dir = env.CLAUDE_CONFIG_DIR !== undefined && env.CLAUDE_CONFIG_DIR !== ''
    ? env.CLAUDE_CONFIG_DIR
    : path.join(homedir(), '.claude');
  return path.join(dir, 'settings.json');
}

function backupPath(ws: Workspace): string {
  return path.join(ws.globalRoot, 'statusline-replaced.json');
}

/**
 * The key one saved copy is filed under: the settings file it belongs to.
 *
 * ── WHY THE SAVED COPY IS KEYED AT ALL (fixed 2026-08-27) ─────────────────
 *
 * It used to be ONE object for the whole machine, and that had two costs that
 * were both real rather than theoretical:
 *
 *   - `--settings <path>` was not isolated. The command consulted global state
 *     about a settings file nobody had asked it about, so a user with two
 *     Claude Code profiles could not install into the second without taking
 *     the bridge out of the first.
 *   - A TEST's outcome depended on the developer's machine.
 *     `test/cli/f2-registry.test.ts` spawns `install --settings <temp>` and
 *     does not redirect HOME, so it went red exactly when the bridge happened
 *     to be installed in the developer's own `~/.claude/settings.json` — a
 *     failure with nothing to do with what that test asserts.
 *
 * Keyed, two installs are two entries and neither can reach the other's.
 *
 * **A map in ONE file, rather than one file per settings path.** Weighed
 * against it: a directory of backup files is more entries to reason about, to
 * clean up and to name (a settings path is not a filename), and it gives no
 * single place to answer "what is installed where" — which `uninstall` now
 * needs when it is run with no `--settings` and more than one profile exists.
 * One artefact, keyed inside, keeps both.
 *
 * **The key is a NATIVE resolved path, not a POSIX-normalized one**, which is
 * the one place this file departs from `INV-posix-normalized-paths`. That
 * invariant is about paths reaching the database or a glob comparison; this
 * key is only ever compared to `path.resolve(...)` of the same command's own
 * `--settings` argument, and normalizing on the way in while comparing against
 * a native path on the way out is how a key silently stops matching. The
 * entry's `settingsPath` field is native for the same reason and always was.
 *
 * **The residual, stated rather than papered over:** on Windows two spellings
 * of one path that differ only in case are two keys. Lower-casing would fix it
 * there and break it on Linux, where those are genuinely two files; the old
 * code compared `path.resolve` strings and had exactly the same residual.
 */
function backupKey(settingsPath: string): string {
  return path.resolve(settingsPath);
}

/**
 * What `install` saved for ONE settings file, so `uninstall` can put it back.
 * Filed under `backupKey(settingsPath)`; `settingsPath` is kept in the entry
 * as well as in the key, and is the field that decides — see `readSaved`.
 *
 * `previous` is the `statusLine` VALUE that was replaced (`null` when the key
 * was absent) and is what the spec names. `previousText` and `installedText`
 * are the whole file on either side of the write, and they are what makes the
 * undo byte-exact: `previous` alone can only rebuild the key, and rebuilding
 * the key means re-serializing the document around it.
 *
 * `installedText` is also the check that the undo is SAFE. If the file no
 * longer matches what this command wrote, something else has edited it since,
 * and restoring `previousText` wholesale would throw that edit away — so the
 * restore falls back to the key alone and says which one it did.
 */
interface Backup {
  replacedAt: string;
  settingsPath: string;
  previous: unknown;
  /** The file before the install, or `null` when there was no file. */
  previousText: string | null;
  /** Exactly what the install wrote. */
  installedText: string;
}

/** Every saved copy on this machine, filed under `backupKey(settingsPath)`. */
type SavedCopies = Record<string, Backup>;

/**
 * One value read as a `Backup`, or `null` when it is not one.
 *
 * `settingsPath` and `installedText` are the two fields nothing works without:
 * the first says which file the copy belongs to and the second is how the undo
 * knows it is safe. The rest degrade to their absent forms rather than
 * rejecting the entry, exactly as they did before the keying — an entry
 * written by a build that had one fewer field is still an entry.
 */
function asBackup(value: unknown): Backup | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const parsed = value as Partial<Backup>;
  if (typeof parsed.settingsPath !== 'string' || typeof parsed.installedText !== 'string') {
    return null;
  }
  return {
    replacedAt: typeof parsed.replacedAt === 'string' ? parsed.replacedAt : '',
    settingsPath: parsed.settingsPath,
    previous: parsed.previous ?? null,
    previousText: typeof parsed.previousText === 'string' ? parsed.previousText : null,
    installedText: parsed.installedText,
  };
}

/**
 * Every saved copy, from EITHER shape the file has ever held.
 *
 * ── THE MIGRATION, AND WHY IT IS READ-SIDE ONLY ───────────────────────────
 *
 * A file in the LEGACY shape — one bare `Backup` object, no key above it —
 * exists on real machines right now and holds a real previous status line.
 * Losing it is the one unrecoverable outcome of this change, so it is read
 * rather than converted: the legacy object becomes an entry keyed by its own
 * `settingsPath`, which makes an `uninstall` immediately after an upgrade work
 * with no migration having run at all. The first WRITE then persists the map,
 * carrying the legacy entry across field for field.
 *
 * **The two shapes are told apart by `asBackup` on the top level**, and that
 * discrimination is sound rather than lucky: a map's keys are absolute
 * settings paths, so a map can never itself carry a string `settingsPath` and
 * a string `installedText` at its top level. A legacy object always does —
 * `asBackup` requires exactly the two fields nothing works without.
 *
 * **Keys are re-derived from each entry's own `settingsPath`, not trusted as
 * stored.** A key and the entry under it are two spellings of one fact, and
 * the day they disagree — a hand edit, a file copied between machines — the
 * entry itself is the one that decides what gets restored where. Deriving
 * makes the disagreement impossible instead of arbitrating it later.
 *
 * Unreadable, not an object, or an entry that is not a backup all degrade the
 * way the single-object version degraded: to "nothing saved" for whatever
 * cannot be read, and `uninstall` then removes our key rather than restoring
 * anything, inventing no previous value. What the keying adds is that the
 * degradation is now per entry — one corrupted profile does not cost a healthy
 * one its saved copy.
 */
function readSaved(ws: Workspace): SavedCopies {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(backupPath(ws), 'utf8'));
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

  const legacy = asBackup(parsed);
  if (legacy !== null) return { [backupKey(legacy.settingsPath)]: legacy };

  const saved: SavedCopies = {};
  for (const value of Object.values(parsed as Record<string, unknown>)) {
    const entry = asBackup(value);
    if (entry !== null) saved[backupKey(entry.settingsPath)] = entry;
  }
  return saved;
}

/**
 * The map back to disk — or the file removed, when the last entry has gone.
 *
 * An empty map and no file mean the same thing, so only one of them may be
 * written. Leaving `{}` behind would make "is anything installed" two
 * questions instead of one, and would mean an uninstall no longer undoes the
 * install that created the file — the same reasoning that has `uninstall`
 * remove a settings file its install created.
 */
function writeSaved(ws: Workspace, saved: SavedCopies): void {
  if (Object.keys(saved).length === 0) {
    rmSync(backupPath(ws), { force: true });
    return;
  }
  mkdirSync(ws.globalRoot, { recursive: true });
  writeFileSync(backupPath(ws), `${JSON.stringify(saved, null, 2)}\n`, 'utf8');
}

/**
 * Whether a `statusLine` value is a bridge THIS COMMAND WROTE.
 *
 * By IDENTITY against `OUR_COMMANDS`, never by parsing. The string this command
 * writes now contains spaces and quotes, and a predicate that had to parse it
 * would inherit every refusal `parseCommandString` makes — a value we composed
 * ourselves, unrecognised because our own parser is conservative about strings
 * from elsewhere. We know exactly what we write; comparing to it is the whole
 * check.
 *
 * Narrow on purpose. `uninstall` refuses on the negative of this, so widening
 * it is widening what this command will overwrite. Bridges we did NOT write —
 * another checkout's — are a different question, answered by
 * `commandLooksLikeOurBridge`, and answered with a refusal rather than a write.
 */
function isOurs(value: unknown): boolean {
  const command = commandStringOf(value);
  return command !== null && OUR_COMMANDS.includes(command);
}

// --- Chaining, not replacing (2026-08-27) -----------------------------------
//
// The install replaced a `statusLine` and the user lost the one he had — on his
// machine another plugin's script. So the bridge now DELEGATES: it tees the
// payload (that is the whole reason this command exists), then runs the command
// this install displaced with the SAME stdin and prints its stdout as the line.
//
// Everything the delegation needs comes off the SAME saved copy `uninstall`
// restores from — the entry for that settings file, since the keying of
// 2026-08-27 (see `backupKey`). There is deliberately no second store: a
// "which command do we chain to" file beside a "which command do we restore"
// file is two answers to one question, and the day they disagree the user gets
// someone else's status line back. Keying the one store did not weaken that;
// see `delegateEntry` for the question it did raise and how it is answered
// without adding a store.
//
// The saved value is a COMMAND STRING out of a settings file, and the bridge
// runs argv arrays with no shell. Everything below is about that gap, and it is
// closed by REFUSING rather than by guessing — see `parseCommandString`.

export type ParsedCommand =
  | { ok: true; argv: string[] }
  | { ok: false; reason: string };

/**
 * Characters whose meaning is a SHELL'S, not a filename's, in a BARE run.
 *
 * `'` groups differently in `cmd.exe` and `sh` and so is never accepted, `` ` ``
 * and `$` substitute, `|&;` chain, `<>` redirect, `()` and `{}` group, `*?[]`
 * glob, `%` is cmd.exe's variable syntax and `!` is history expansion. Any of
 * them means the run was written for an interpreter this command does not have
 * and will not emulate, so it is not argv and must not be pretended into one.
 *
 * `"` is absent from this set and handled separately — see `QUOTED_RUN_ONLY`.
 * A bare run may not CONTAIN one either (`a"b` is a joint, not a token), which
 * the tokenizer enforces by position rather than by this test.
 */
const SHELL_METACHARACTER = /['`$|&;<>(){}[\]*?!%\r\n]/;

/**
 * What may never appear inside a double-quoted run.
 *
 * The claim this rests on, and it is checkable rather than a feel for what
 * shells do: **a double-quoted run is literal in POSIX `sh` and in `cmd.exe`
 * alike, provided its interior holds none of these and no backslash sits
 * immediately before `$`, a backtick, `"`, `\` or the end of the run.**
 * `sh` still expands `$` and `` ` `` inside double quotes and still honours a
 * backslash before one of those four; `cmd.exe` still expands `%VAR%` inside
 * them. Strip those cases out and every remaining character — spaces, `*`,
 * `|`, `;`, `~`, `(` — is exactly itself in both, which is the whole reason
 * quoting exists.
 *
 * `%` is in this set although the rule as first written did not name it,
 * because leaving it out would have made the claim above FALSE on Windows —
 * the platform this feature was written for. Refusing more than the rule
 * requires is always available; claiming a literal reading that a real shell
 * disagrees with is not.
 */
const QUOTED_RUN_ONLY = /[$`%\r\n]/;

/**
 * A backslash that reads as an ESCAPE rather than as a path separator: one
 * before whitespace, a quote, another backslash, or the end of the run.
 *
 * This is where a literal reading is chosen over refusal, and it is chosen for
 * a reason. On win32 `\` is the path separator, so refusing it outright would
 * refuse `node C:\Users\me\.claude\gsd-statusline.js` — the exact command that
 * prompted this feature. A backslash before an ordinary character is therefore
 * taken literally, which is what every Windows shell does with it and what
 * `execFile` needs. The shapes above are the ones where a POSIX shell would
 * have CHANGED the run — joining two words, dropping the character, ending a
 * quote early — and a literal reading there would run something the user never
 * wrote, so those refuse.
 *
 * Applied to a quoted run's interior as well as to a bare one: it is ONE rule,
 * not two, which is what lets the quoted case be a widening of the literal set
 * rather than the beginning of an interpreter.
 *
 * **The residual, and it is real, and it now covers quoted runs too.** On a
 * POSIX machine `a\b` most likely was an escape, and we pass `a\b` where bash
 * would have passed `ab`; inside quotes, `"a\b"` is literal in `sh` and we
 * agree, but `"a\b"` in a string a Windows tool wrote is a path and we agree
 * there too — the two readings coincide, and where they would not, the escape
 * shapes above refuse. What makes the whole literal reading acceptable is not
 * that it is always right: it is that `install` PRINTS the argv it would
 * delegate to, so the reading is SHOWN to the person who wrote the string and
 * consented to with `--yes`, never inferred behind them. That preview is the
 * safeguard this rule rests on; remove it and the widening is no longer
 * justified.
 */
const BACKSLASH_AS_ESCAPE = /\\(?=[\s"'\\]|$)/;

/**
 * A settings-file command string, as argv — or a refusal saying why not.
 *
 * **Why this refuses rather than tries harder.** The alternative to a parser
 * is `shell: true`, and that is not a shortcut, it is a different program: it
 * would take a string out of a JSON file the user (or another installer)
 * writes and hand it to `cmd.exe`/`sh` with everything that implies, on a code
 * path that runs on every assistant message. The alternative to REFUSING is a
 * fuller parser — quote handling, escapes, word splitting — which is exactly
 * "guess at shell semantics", and the guess is wrong on the machine whose
 * shell we guessed wrong about. A refusal costs the user the chaining and
 * SAYS SO at install time; a wrong guess runs a command nobody wrote.
 */
export function parseCommandString(command: string): ParsedCommand {
  if (command.trim() === '') return { ok: false, reason: 'it is empty' };

  const argv: string[] = [];
  let i = 0;
  while (i < command.length) {
    const char = command[i] as string;
    if (char === ' ' || char === '\t') {
      i++;
      continue;
    }

    if (char === '"') {
      // A QUOTED RUN. Whitespace inside it does not split — that is the entire
      // reason quoting exists, and refusing it was costing the common case: a
      // hand-written or tool-generated `settings.json` quotes paths whether or
      // not they need it.
      const end = command.indexOf('"', i + 1);
      if (end === -1) {
        return { ok: false, reason: 'it opens a double quote that is never closed' };
      }
      const inner = command.slice(i + 1, end);
      const meta = QUOTED_RUN_ONLY.exec(inner);
      if (meta !== null) {
        return {
          ok: false,
          reason:
            `a quoted part of it contains ${JSON.stringify(meta[0])}, which a shell still ` +
            'interprets INSIDE double quotes',
        };
      }
      if (BACKSLASH_AS_ESCAPE.test(inner)) {
        return {
          ok: false,
          reason:
            'a quoted part of it ends in a backslash, or holds one before a quote — which ' +
            'reads as an escape, and then the run this parser found is not the run the shell ' +
            'would have found',
        };
      }
      const next = command[end + 1];
      // A quoted run must BE a whole argument. `--opt="a b"` and `"a b"c`
      // concatenate in a shell, and concatenation is interpretation: the rule
      // widened here is "a fully-quoted run is literal", and this is where
      // that rule stops.
      if (next !== undefined && next !== ' ' && next !== '\t') {
        return {
          ok: false,
          reason:
            'a quoted part of it is joined to more text, which only a shell knows how to ' +
            'concatenate — quote the whole argument or none of it',
        };
      }
      argv.push(inner);
      i = end + 1;
      continue;
    }

    // A BARE RUN: up to the next whitespace, and nothing a shell would touch.
    let end = i;
    while (end < command.length && command[end] !== ' ' && command[end] !== '\t') end++;
    const token = command.slice(i, end);
    const meta = SHELL_METACHARACTER.exec(token);
    if (meta !== null) {
      return {
        ok: false,
        reason:
          `it contains ${JSON.stringify(meta[0])}, which only a shell can interpret — this ` +
          'command runs argv arrays, never a shell string',
      };
    }
    if (token.includes('"')) {
      return {
        ok: false,
        reason:
          'it opens a double quote in the middle of a word, which only a shell knows how to ' +
          'join — quote the whole argument or none of it',
      };
    }
    if (BACKSLASH_AS_ESCAPE.test(token)) {
      return {
        ok: false,
        reason:
          'it contains a backslash that reads as an escape rather than as a path separator, ' +
          'and the two mean different things to different shells',
      };
    }
    // Checked at the START of a run only: `~` and `#` are expansion and comment
    // there, and `C:\PROGRA~1\…` — a real Windows short path — has a tilde in
    // the middle of one. Not checked inside quotes at all, where both are
    // literal in `sh` and in `cmd.exe`.
    if (token.startsWith('~')) {
      return { ok: false, reason: 'it begins a word with "~", which is a shell expansion' };
    }
    if (token.startsWith('#')) {
      return { ok: false, reason: 'it contains a "#" comment' };
    }
    argv.push(token);
    i = end;
  }

  // Reachable from `""` alone, which trims to non-empty and tokenizes to one
  // empty argument — a command name that names nothing.
  if (argv.length === 0 || argv[0] === '') {
    return { ok: false, reason: 'it names no command to run' };
  }
  return { ok: true, argv };
}

function stem(token: string): string {
  return path.basename(token).replace(/\.[^.]+$/, '').toLowerCase();
}

/**
 * Whether an argv is THIS bridge, under any spelling it can be written in.
 *
 * `isOurs` answers a narrower question — "is this the exact object we wrote" —
 * and it has to stay narrow, because it is what `uninstall` refuses on. This
 * one exists for the failure `isOurs` cannot see: a `statusLine` reading
 * `node …/src/cli/index.ts statusline` is the bridge, is not the string we
 * install, and chaining to it would make the bridge delegate to the bridge on
 * every assistant message until something runs out. So `install` refuses it,
 * and `delegateFor` refuses it a second time at run time — the saved copy may
 * predate this check, and an infinite delegation is not a thing to be one
 * check away from.
 *
 * Deliberately a SHAPE match rather than only a path comparison: the user may
 * have `mycontext` on PATH from a different checkout, and that checkout's
 * bridge would loop just as happily as this one's.
 */
export function looksLikeOurBridge(argv: string[]): boolean {
  if (!argv.includes('statusline')) return false;
  return argv.some((token) => {
    if (stem(token) === 'mycontext') return true;
    const posix = token.replace(/\\/g, '/').toLowerCase();
    if (posix === OUR_CLI_ENTRY.toLowerCase()) return true;
    // Any checkout's entry file, not just this one's: see above.
    return /(^|\/)src\/cli\/index\.(ts|js|mjs|cjs)$/.test(posix);
  });
}

/**
 * The same question asked of a command STRING, which is the form it is always
 * really asked in.
 *
 * The split is deliberately LENIENT — whitespace, then quotes trimmed off the
 * ends — and it is nothing like `parseCommandString`. It may only ever cause a
 * REFUSAL, never an execution, so over-inclusiveness is the safe direction and
 * a shape this project will not run is still a shape it must be able to
 * recognise. Routing detection through the strict parser instead would be a
 * defect with a specific consequence: every string that parser refuses becomes
 * invisible to detection, and an undetected bridge is one that gets chained to
 * itself once per assistant message. The string this command writes today has
 * quotes and spaces in it, so that is not hypothetical.
 */
export function commandLooksLikeOurBridge(command: string): boolean {
  const tokens = command
    .split(/\s+/)
    .map((token) => token.replace(/^["']+/, '').replace(/["']+$/, ''))
    .filter((token) => token !== '');
  return looksLikeOurBridge(tokens);
}

/** The `command` string of a `statusLine` value, when it has one. */
function commandStringOf(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const command = (value as { command?: unknown }).command;
  return typeof command === 'string' ? command : null;
}

/** What the bridge will run after teeing, and the string it came from. */
export interface Delegate {
  argv: string[];
  /** The settings-file string this argv was parsed out of, for disclosure. */
  command: string;
}

/**
 * The command `install` displaced, ready to run — or `null` when there is
 * nothing safe to run.
 *
 * `null` covers every "do not chain" case in one answer, because the caller's
 * response to all of them is identical and correct: print our own line. No
 * backup, a backup for a settings file with no `statusLine` in it, a value
 * that is not a command entry, a string this command will not parse, and the
 * bridge itself all arrive here as `null`.
 */
/**
 * WHICH saved copy the running bridge should chain to.
 *
 * The question the keying created, and it has to be answered somewhere: the
 * bridge is not told which settings file started it — Claude Code hands it a
 * payload, not a provenance — so the choice is made on the only evidence
 * available, in this order.
 *
 *   1. The entry for the settings file Claude Code itself reads. If the bridge
 *      is running at all, that is overwhelmingly the file that started it.
 *   2. Otherwise the single entry, when there is exactly one. That is every
 *      ordinary machine, and every test that installs into a temp file.
 *   3. Otherwise the most recent install, ties broken by insertion order — the
 *      best available guess, and it is only reachable on a machine with two
 *      profiles neither of which is the one Claude Code is reading.
 *
 * **The alternative was weighed and rejected: putting the settings path into
 * the installed COMMAND**, so the bridge could be told rather than infer. That
 * writes a second copy of that path into a file the user maintains, where it
 * can drift from the saved copy's own `settingsPath` — and the day they
 * disagree the user gets someone else's status line back. One answer to one
 * question is the rule this whole feature is built on (see the chaining note
 * above); a guess that costs at most a courtesy line is cheaper than a second
 * store that can lie.
 */
function delegateEntry(ws: Workspace): Backup | null {
  const saved = readSaved(ws);
  const entries = Object.values(saved);
  if (entries.length === 0) return null;
  const claudeReads = saved[backupKey(claudeSettingsPath(process.env))];
  if (claudeReads !== undefined) return claudeReads;
  if (entries.length === 1) return entries[0] as Backup;
  // `>=` rather than `>`: two installs can land in the same millisecond, and
  // then insertion order — which is install order — is the tie-break.
  return entries.reduce((best, entry) => (entry.replacedAt >= best.replacedAt ? entry : best));
}

export function delegateFor(ws: Workspace): Delegate | null {
  const saved = delegateEntry(ws);
  if (saved === null) return null;
  const command = commandStringOf(saved.previous);
  if (command === null) return null;
  // Asked of the STRING first, and of the argv again below. Two checks because
  // a saved copy can predate either of them, and because an infinite
  // delegation is not a thing to be one check away from.
  if (commandLooksLikeOurBridge(command)) return null;
  const parsed = parseCommandString(command);
  if (!parsed.ok) return null;
  if (looksLikeOurBridge(parsed.argv)) return null;
  return { argv: parsed.argv, command };
}

type ReadResult =
  | { ok: true; text: string | null; value: Record<string, unknown> }
  | { ok: false };

/**
 * The settings file, as bytes AND as an object.
 *
 * A file that does not exist is `text: null` with an empty object — a user who
 * never configured Claude Code, which is a state to install into rather than
 * an error. A file that exists and does not parse as a JSON OBJECT is refused
 * whole: it is a document someone maintains, this command cannot tell a typo
 * from a format it does not know, and overwriting it would destroy the only
 * copy. An array parses as JSON and is not a settings file, so it is refused
 * by the same sentence.
 */
function readSettings(file: string, out: Emit): ReadResult {
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return { ok: true, text: null, value: {} };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return { ok: true, text: raw, value: parsed as Record<string, unknown> };
  } catch {
    out(
      `my_context: ${file} exists but could not be parsed as a JSON object. Refusing to touch ` +
      `it — fix the file first. Nothing was written.`,
    );
    return { ok: false };
  }
}

function writeText(file: string, text: string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text, 'utf8');
}

/** The serialization this command uses when it composes a file rather than restoring one. */
function serialize(value: Record<string, unknown>): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function describe(value: unknown): string {
  return value === undefined ? '(none)' : JSON.stringify(value);
}

export function cmdStatuslineInstall(ws: Workspace, args: string[], out: Emit): number {
  if (refuseUnknownFlag(args, FLAGS, VALUE_FLAGS, USAGE, out)) return 1;
  const given = flag(args, 'settings');
  if (given === null && args.includes('--settings')) {
    out(`my_context: --settings takes a path.\n${USAGE}`);
    return 1;
  }
  const file = path.resolve(given ?? claudeSettingsPath(process.env));

  const settings = readSettings(file, out);
  if (!settings.ok) return 1;
  const current = settings.value.statusLine;

  // Already ours: write NOTHING, and above all do not re-save the backup.
  // Saving our own value as "the previous setting" is precisely how an
  // uninstall comes to restore `mycontext statusline` over `mycontext
  // statusline` — a dangling entry pointing at a bridge the user has just
  // removed, which is worse than never offering to remove it.
  if (isOurs(current)) {
    out(`Settings file:      ${file}`);
    out(`Current statusLine: ${describe(current)}`);
    out('');
    out(
      'Already installed — nothing was written. The saved copy of the setting this replaced is ' +
      'left exactly as it is, so `mycontext statusline uninstall --yes` still restores the ' +
      'value you had before the first install.',
    );
    // Ours, but a spelling this build no longer writes — and the one it
    // replaced does not START (see `INSTALLED`). "Already installed" read on
    // its own would tell that user everything is fine while his status line is
    // dead, which is the failure this whole fix is about, restated as a
    // reassuring message.
    if (commandStringOf(current) !== INSTALLED.command) {
      out('');
      out(
        'That entry is this bridge, in the form an earlier version installed. It names ' +
        '`mycontext` on PATH — a name this plugin does not put there when it is installed from ' +
        'a local directory, so Claude Code cannot run it and the bridge never starts: no ' +
        'sample, and no delegation to whatever it replaced. To replace it with a form that ' +
        'does start, run\n' +
        `  mycontext statusline uninstall --settings ${file} --yes\n` +
        '  mycontext statusline install   --settings ' + file + ' --yes\n' +
        'in that order. The uninstall restores what you had before, and the install chains to ' +
        'it again.',
      );
    }
    return 0;
  }

  // Ours under a DIFFERENT spelling — `node …/src/cli/index.ts statusline`, or
  // a `mycontext` from another checkout. `isOurs` above cannot see it, and
  // chaining to it would make the bridge delegate to a bridge that delegates
  // to a bridge, once per assistant message. Refused rather than installed
  // without chaining: the user asked for the bridge and already has it, and
  // silently replacing one spelling of it with another would also destroy the
  // only record of what came before THAT install.
  const currentCommand = commandStringOf(current);
  const currentParsed = currentCommand === null ? null : parseCommandString(currentCommand);
  // Detection reads the STRING, never the parse: a bridge written in a form
  // this project will not RUN is still a bridge, and must not be chained to.
  if (currentCommand !== null && commandLooksLikeOurBridge(currentCommand)) {
    out(`Settings file:      ${file}`);
    out(`Current statusLine: ${describe(current)}`);
    out('');
    out(
      'my_context: that statusLine is already this bridge, written another way. Installing over ' +
      'it would chain the bridge to ITSELF — every assistant message would run a status line ' +
      'that runs a status line. Nothing was written. Remove or rewrite that entry yourself if ' +
      'you meant to change how the bridge is invoked.',
    );
    return 1;
  }

  // ── WHERE A GUARD USED TO BE, AND WHY IT NO LONGER HAS TO BE ────────────
  //
  // An install into a SECOND settings file was refused here, and the reasoning
  // was sound for the design it stood on: one saved copy per machine meant the
  // second install would overwrite the first's only record of what it replaced,
  // leaving that install with nothing to restore. Refusing was the only way to
  // keep the promise `uninstall` makes.
  //
  // The keying is what retires it, and this is the reasoning it preserves: a
  // saved copy is now filed under `backupKey(settingsPath)` (see there), so a
  // second install writes a second ENTRY and cannot reach the first one's.
  // Nothing about "the first install must keep something to restore" has been
  // given up — it is enforced by the store's shape instead of by a refusal,
  // which is why `--settings` is finally isolated: this command no longer
  // consults global state about a settings file it was not asked about.
  //
  // `test/cli/statusline.test.ts` holds the property directly ("two settings
  // files install independently…"), and it is what has to stay true.

  out(`Settings file:      ${file}`);
  out(`Current statusLine: ${describe(current)}`);
  out(`Would install:      ${JSON.stringify(INSTALLED)}`);
  // The chaining is DISCLOSED as argv, not as the string it came from. The
  // string is what the user wrote; the argv is what will actually be executed,
  // and the two can differ — a backslash read literally is the case that
  // prompted this line. Showing the string only would be showing the input to
  // a decision instead of the decision.
  out(
    `Would delegate to:  ${
      currentParsed === null ? '(nothing — there is no status line to chain to)'
      : currentParsed.ok ? JSON.stringify(currentParsed.argv)
      : `(nothing — ${currentParsed.reason})`
    }`,
  );

  // Said BEFORE consent, and said again on the way out below: this is the one
  // place where the install still costs the user the status line he had.
  const unchainable = currentParsed !== null && !currentParsed.ok
    ? 'That statusLine cannot be chained: ' + currentParsed.reason + '. This command runs a ' +
      'command as an argv array with no shell, so a string that needs one is not something it ' +
      'will run — guessing at what your shell would have done with it is how an installer ends ' +
      'up executing something nobody wrote. Installing anyway will REPLACE that status line ' +
      'rather than delegate to it; it is still saved, and `mycontext statusline uninstall --yes` ' +
      'still puts it back.'
    : null;

  if (!hasFlag(args, 'yes')) {
    out('');
    out(RELOCATION_NOTE);
    out('');
    if (unchainable !== null) {
      out(unchainable);
      out('');
    }
    out(
      'Nothing was written. Re-run with --yes to replace the setting shown above. The replaced ' +
      'value is saved — the whole file, not just the key — and `mycontext statusline uninstall ' +
      '--yes` puts it back byte for byte.',
    );
    return 0;
  }

  const installedText = serialize({ ...settings.value, statusLine: INSTALLED });
  // Read-modify-write of the WHOLE map, not an append: every other entry has
  // to come back out unchanged, and that includes an entry read out of the
  // legacy single-object shape — this is the write that migrates it.
  const saved = readSaved(ws);
  saved[backupKey(file)] = {
    replacedAt: new Date().toISOString(),
    settingsPath: file,
    previous: current ?? null,
    previousText: settings.text,
    installedText,
  };
  // The backup lands BEFORE the settings file. In the other order a crash
  // between the two writes leaves the user's setting replaced and no record of
  // what it was; in this one it leaves a saved copy of a file that was never
  // changed, and `uninstall` on that file finds no statusLine of ours and says
  // there is nothing to restore.
  writeSaved(ws, saved);
  writeText(file, installedText);

  out('');
  out(RELOCATION_NOTE);
  out('');
  if (unchainable !== null) {
    out(unchainable);
    out('');
  }
  out(
    'Installed. Claude Code will run `mycontext statusline` on every assistant message; the web ' +
    'UI can now show the real context number for a session — as of its last response, and only ' +
    'while this bridge stays installed. `mycontext statusline uninstall --yes` restores the ' +
    'setting shown above.',
  );
  if (currentParsed !== null && currentParsed.ok) {
    out(
      'Your previous status line is not gone: the bridge tees the sample first and then runs ' +
      `${JSON.stringify(currentParsed.argv)} with the same input, and prints ITS output as the ` +
      'line. If that command stops working the bridge falls back to its own line rather than ' +
      'leaving you without one.',
    );
  }
  return 0;
}

/**
 * Which settings file `uninstall` means when it was not told.
 *
 * `null` is a REFUSAL that has already been printed, not "use the default".
 *
 * The first two rules are what the single-object version did, restated for a
 * store that can hold several: prefer the file Claude Code actually reads,
 * otherwise the one saved copy there is. The third rule is new because the
 * ambiguity is new — with one saved copy there was never more than one file to
 * mean. Picking one of several would restore one profile's value into
 * whichever file was guessed at, and that is the same swap the keyed lookup
 * exists to prevent, performed one level up. So it is handed back to the
 * person who can resolve it, with the list they need to resolve it — which is
 * the disclosure a MAP in one file buys and a directory of backup files would
 * not have.
 */
function defaultUninstallTarget(saved: SavedCopies, out: Emit): string | null {
  const claudeReads = backupKey(claudeSettingsPath(process.env));
  if (saved[claudeReads] !== undefined) return claudeReads;
  const keys = Object.keys(saved);
  // No saved copy at all still resolves to Claude Code's own settings file:
  // there may be an entry of ours in it that nothing saved a copy for, and
  // removing that key is exactly what the no-saved-copy path below is for.
  if (keys.length <= 1) return keys[0] ?? claudeReads;
  out(
    'my_context: the bridge is installed in more than one settings file, and this command was ' +
    'not told which one to take it out of:\n' +
    keys.map((key) => `  ${key}`).join('\n') + '\n' +
    'Re-run with --settings naming one of them. Restoring one file\'s saved copy into another ' +
    'is not an undo, it is a swap, so nothing was written.',
  );
  return null;
}

export function cmdStatuslineUninstall(ws: Workspace, args: string[], out: Emit): number {
  if (refuseUnknownFlag(args, FLAGS, VALUE_FLAGS, USAGE, out)) return 1;
  const given = flag(args, 'settings');
  if (given === null && args.includes('--settings')) {
    out(`my_context: --settings takes a path.\n${USAGE}`);
    return 1;
  }

  const allSaved = readSaved(ws);
  const file = given !== null ? path.resolve(given) : defaultUninstallTarget(allSaved, out);
  if (file === null) return 1;
  // A saved copy is only usable for the file it was taken from. Restoring one
  // file's previous value into another is not an undo, it is a swap — which is
  // now a lookup rather than a comparison, because the store is keyed by the
  // very thing that had to be compared.
  const saved = allSaved[backupKey(file)] ?? null;

  const settings = readSettings(file, out);
  if (!settings.ok) return 1;
  const current = settings.value.statusLine;

  if (current !== undefined && !isOurs(current)) {
    out(
      `my_context: the statusLine in ${file} is not the mycontext bridge:\n` +
      `  ${JSON.stringify(current)}\n` +
      `Refusing to touch it. Configuration is yours to make, and replacing this with a value ` +
      `saved before you set it would be the same silent overwrite \`install\` refuses. Remove ` +
      `the line above yourself if you meant to.`,
    );
    return 1;
  }

  if (current === undefined) {
    out(`Settings file:      ${file}`);
    out('');
    out(
      'There is no mycontext status line in this file, so there is nothing to restore. Nothing ' +
      'was written.',
    );
    return 0;
  }

  // From here the entry IS ours, so the only question is how much of the file
  // to give back.
  const byteClean = saved !== null && settings.text === saved.installedText;
  const removesFile = byteClean && saved.previousText === null;
  const restoreTo = saved?.previous ?? null;

  out(`Settings file:      ${file}`);
  out(`Current statusLine: ${describe(current)}`);
  out(
    `Would restore:      ${
      removesFile ? '(remove the file — it did not exist before this install)'
      : restoreTo === null ? '(remove the statusLine key)'
      : JSON.stringify(restoreTo)
    }`,
  );
  if (!byteClean) {
    out('');
    out(
      saved === null
        ? 'No saved copy of the setting this replaced is available, so the statusLine key is ' +
          'removed rather than restored. Nothing is invented in its place.'
        : `${file} has changed since the install, so the whole file cannot be put back without ` +
          'discarding that change. Only the statusLine key is restored; the rest of the file is ' +
          'left as it is now.',
    );
  }

  if (!hasFlag(args, 'yes')) {
    out('');
    out('Nothing was written. Re-run with --yes to apply the restore shown above.');
    return 0;
  }

  if (removesFile) {
    rmSync(file, { force: true });
  } else if (byteClean) {
    // The whole file, exactly as the user wrote it: indentation, key order and
    // trailing newline included.
    writeText(file, saved.previousText as string);
  } else {
    const next = { ...settings.value };
    if (restoreTo === null) delete next.statusLine;
    else next.statusLine = restoreTo;
    writeText(file, serialize(next));
  }

  // THIS FILE'S saved copy has been spent, and only this file's. Leaving it
  // would let a later uninstall write a stale value over whatever the file
  // holds by then; removing the whole store instead would destroy another
  // profile's saved copy, which is the failure the keying exists to make
  // impossible — `writeSaved` drops the file only once the last entry goes.
  if (saved !== null) {
    const remaining = { ...allSaved };
    delete remaining[backupKey(file)];
    writeSaved(ws, remaining);
  }

  out('');
  out(
    'Restored. The web UI now shows only what mycontext injected, and says so (spec §7).',
  );
  return 0;
}
