import { isMainEntry } from '../core/paths.ts';
import {
  capped, repoRelative, runObservationHook, type Observation, type ObservationSpec,
} from './observe.ts';
import type { HookInput } from './io.ts';

/**
 * Claude Code's own settings changed mid-session — including, possibly, the
 * settings that decide whether these hooks run at all.
 *
 * **The correction this file exists to record.** `hooks seq:21` rules this
 * event in with the sentence *"config.json is the user's to edit and the
 * program learns about the edit at the next session start"*. That is a true
 * problem and this is NOT the event that solves it. The five sources build
 * 2.1.239 declares (byte 303345900) are:
 *
 *     M3b=["user_settings","project_settings","local_settings","policy_settings","skills"],
 *     O3b=…(_e({hook_event_name:kt("ConfigChange"),source:Or(M3b),file_path:L().optional()}))
 *
 * Not one of them is `.my_context/config.json`. `ConfigChange` fires for
 * Claude Code's settings files and for the skills directory, and it can never
 * see my_context's own config. The event that CAN see it is `FileChanged`,
 * which is why `hooks/file-changed.ts` watches `config.json` by name and says
 * so where it does.
 *
 * So what this event is actually for is the thing nobody asked for and everyone
 * needs: `settings.json` is where a user's own hook registrations live, and
 * `policy_settings` is where `disableAllHooks` and `allowManagedHooksOnly`
 * live — the two flags that make every hook in this plugin stop running
 * (build 2.1.239, `function HD(){return kd()||_3e()}` at byte 304292253). A
 * session in which my_context silently stopped working is exactly the session
 * `INV-nothing-is-dropped-silently` is about, and this row is the only thing
 * that would ever mark the moment.
 *
 * **It reads nothing and reloads nothing.** Not the changed file, not the
 * skills directory, not its own manifest. Reading a settings file to find out
 * whether we were disabled is a program checking on its own permissions, and
 * acting on the answer — re-registering, warning, re-injecting — is
 * `hooks seq:22`'s question about what ships enabled, which is BLOCKED on the
 * owner. The row records that the tier changed. Nothing follows from it here.
 *
 * **No matcher**, for `instructions-loaded.ts`'s reason: the matcher on this
 * event is tested against `source` (byte 317139714), and a matcher naming four
 * of the five sources would silently not run for the fifth.
 */

/** The `source` values build 2.1.239's schema accepts, in its order. */
export const CONFIG_SOURCES = [
  'user_settings', 'project_settings', 'local_settings', 'policy_settings', 'skills',
] as const;

export function observeConfigChange(input: HookInput, root: string): Observation | null {
  const source = typeof input.source === 'string' && input.source !== ''
    ? input.source : '<absent>';
  // Gated on the source rather than on `file_path`, which the schema marks
  // optional: a `skills` change carries no single file, and declining it would
  // drop the one source that can add or remove a whole instruction surface.
  if (source === '<absent>') return null;

  const rel = typeof input.file_path === 'string' && input.file_path !== ''
    ? repoRelative(root, input.file_path) : null;
  const unknown = !(CONFIG_SOURCES as readonly string[]).includes(source);

  return {
    ...(rel === null ? {} : { path: rel }),
    note:
      `source=${capped(source, 48)}` +
      (unknown ? ` — not one of ${CONFIG_SOURCES.join(', ')}, so this build of my_context ` +
        'does not know what this settings tier controls' : '') +
      '; nothing was read and nothing was reloaded',
  };
}

export const CONFIG_CHANGE: ObservationSpec = {
  hook: 'ConfigChange',
  op: 'config-change',
  observe: observeConfigChange,
};

if (isMainEntry(import.meta.filename, process.argv[1])) runObservationHook(CONFIG_CHANGE);
