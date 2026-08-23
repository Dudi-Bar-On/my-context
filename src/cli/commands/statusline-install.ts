import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
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

  if (!hasFlag(args, 'yes')) {
    out('');
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
  out(
    'Installed. Claude Code will run `mycontext statusline` on every assistant message; the web ' +
    'UI can now show the real context number for a session — as of its last response, and only ' +
    'while this bridge stays installed. `mycontext statusline uninstall --yes` restores the ' +
    'setting shown above.',
  );
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
