import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
 * The value installed, exactly (spec §4b).
 *
 * `refreshInterval` is per §4b's Compatibility note: Claude Code re-runs the
 * command on that cadence as well as per message, so the tee stays fresh while
 * a session idles and the UI's "as of" age does not drift for no reason.
 *
 * Exported so the test asserts against THIS value rather than a second copy of
 * it — a pasted literal is free to drift from the thing it is checking.
 */
export const INSTALLED = {
  type: 'command',
  command: 'mycontext statusline',
  refreshInterval: 60,
} as const;

/** The command string `INSTALLED` runs — the identity an entry is ours by. */
const OUR_COMMAND = INSTALLED.command;

const FLAGS = ['yes', 'settings'];
const VALUE_FLAGS = ['settings'];

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
 * What `install` saved, so `uninstall` can put it back.
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

function readBackup(ws: Workspace): Backup | null {
  try {
    const parsed = JSON.parse(readFileSync(backupPath(ws), 'utf8')) as Partial<Backup>;
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
  } catch {
    // No backup, or one this build cannot read. Both mean "nothing saved" —
    // and `uninstall` then removes our key rather than restoring anything,
    // which is the right degradation: it never invents a previous value.
    return null;
  }
}

/** Whether a `statusLine` value is the bridge this command installs. */
function isOurs(value: unknown): boolean {
  return typeof value === 'object' && value !== null
    && (value as { command?: unknown }).command === OUR_COMMAND;
}

// --- Chaining, not replacing (2026-08-27) -----------------------------------
//
// The install replaced a `statusLine` and the user lost the one he had — on his
// machine another plugin's script. So the bridge now DELEGATES: it tees the
// payload (that is the whole reason this command exists), then runs the command
// this install displaced with the SAME stdin and prints its stdout as the line.
//
// Everything the delegation needs comes off the ONE saved copy `uninstall`
// restores from. There is deliberately no second store: a "which command do we
// chain to" file beside a "which command do we restore" file is two answers to
// one question, and the day they disagree the user gets someone else's status
// line back.
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

/** The entry file this project's own CLI is. See `looksLikeOurBridge`. */
const OUR_CLI_ENTRY = fileURLToPath(new URL('../index.ts', import.meta.url));

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
    if (posix === OUR_CLI_ENTRY.replace(/\\/g, '/').toLowerCase()) return true;
    // Any checkout's entry file, not just this one's: see above.
    return /(^|\/)src\/cli\/index\.(ts|js|mjs|cjs)$/.test(posix);
  });
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
export function delegateFor(ws: Workspace): Delegate | null {
  const saved = readBackup(ws);
  if (saved === null) return null;
  const command = commandStringOf(saved.previous);
  if (command === null) return null;
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

/**
 * Whether a saved backup still describes the file it names.
 *
 * A backup whose settings file no longer carries our entry — the user removed
 * it by hand, or the file is gone — is spent, and standing on it would refuse
 * an install for the sake of a value nothing can be restored into.
 */
function backupIsLive(saved: Backup): boolean {
  try {
    const parsed = JSON.parse(readFileSync(saved.settingsPath, 'utf8')) as Record<string, unknown>;
    return isOurs(parsed.statusLine);
  } catch {
    return false;
  }
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
  if (currentParsed !== null && currentParsed.ok && looksLikeOurBridge(currentParsed.argv)) {
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

  // One saved copy exists, and it belongs to a different settings file that
  // still carries our entry. Installing here would overwrite it, and that
  // file's real previous value would be gone for good.
  const saved = readBackup(ws);
  if (saved !== null && path.resolve(saved.settingsPath) !== file && backupIsLive(saved)) {
    out(
      `my_context: the bridge is already installed in ${saved.settingsPath}, and the setting it ` +
      `replaced is saved in one place only. Installing into ${file} as well would overwrite that ` +
      `saved copy, leaving the first install with nothing to restore. Run\n` +
      `  mycontext statusline uninstall --settings ${saved.settingsPath} --yes\n` +
      `first. Nothing was written.`,
    );
    return 1;
  }

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
  const backup: Backup = {
    replacedAt: new Date().toISOString(),
    settingsPath: file,
    previous: current ?? null,
    previousText: settings.text,
    installedText,
  };
  mkdirSync(ws.globalRoot, { recursive: true });
  // The backup lands BEFORE the settings file. In the other order a crash
  // between the two writes leaves the user's setting replaced and no record of
  // what it was; in this one it leaves a saved copy of a file that was never
  // changed, which the liveness check above reads as spent.
  writeFileSync(backupPath(ws), `${JSON.stringify(backup, null, 2)}\n`, 'utf8');
  writeText(file, installedText);

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

export function cmdStatuslineUninstall(ws: Workspace, args: string[], out: Emit): number {
  if (refuseUnknownFlag(args, FLAGS, VALUE_FLAGS, USAGE, out)) return 1;
  const given = flag(args, 'settings');
  if (given === null && args.includes('--settings')) {
    out(`my_context: --settings takes a path.\n${USAGE}`);
    return 1;
  }

  const anySaved = readBackup(ws);
  const file = path.resolve(given ?? anySaved?.settingsPath ?? claudeSettingsPath(process.env));
  // A saved copy is only usable for the file it was taken from. Restoring one
  // file's previous value into another is not an undo, it is a swap.
  const saved = anySaved !== null && path.resolve(anySaved.settingsPath) === file ? anySaved : null;

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

  // The saved copy has been spent. Leaving it would let a later uninstall
  // write a stale value over whatever the file holds by then.
  if (saved !== null) rmSync(backupPath(ws), { force: true });

  out('');
  out(
    'Restored. The web UI now shows only what mycontext injected, and says so (spec §7).',
  );
  return 0;
}
