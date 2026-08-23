import { isMainEntry } from '../core/paths.ts';
import { capped, runObservationHook, type Observation, type ObservationSpec } from './observe.ts';
import type { HookInput } from './io.ts';

/**
 * The event `hooks seq:21` calls *"the natural home for init and doctor"* — and
 * the one place in this round where that sentence is deliberately not acted on.
 *
 * ── THE STOPPING POINT, NAMED ──────────────────────────────────────────────
 *
 * `Setup` fires with `trigger: "init" | "maintenance"` (build 2.1.239, byte
 * 303341033) and carries an `additionalContext` envelope (byte 303349590). A
 * hook here could create `.my_context/`, write a starter config, run the doctor
 * checks and report them into the session — and on `trigger: init` it would do
 * that on a directory the user has not asked my_context to manage yet.
 *
 * **That is the whole of `hooks seq:22`**, which is BLOCKED on the owner:
 * *make mycontext autonomous from the first second… what must ship as a
 * default and what genuinely requires the user*. Its own constraints answer
 * this instance before the survey even runs — *`.my_context/config.json` is the
 * user's to make: the plugin may propose, never edit*, and
 * *`INV-nothing-is-dropped-silently` — a default that quietly does something is
 * worse than no default*. A `Setup` hook that created a workspace would be a
 * default that quietly does something, decided by the wrong party, in the
 * commit that was supposed to register an event.
 *
 * So this hook is REGISTERED, its payload is reachable, and it does exactly one
 * thing: it records that the event fired, in workspaces that already exist. On
 * a directory with no workspace it records nothing, because there is nowhere to
 * record and because creating somewhere is the decision it is declining to
 * make. `test/hooks/observation-hooks.test.ts` asserts that emptiness by name,
 * so the day someone rules on `seq:22` the test that has to change says why it
 * was there.
 *
 * **`maintenance` is the more interesting half and is equally untouched.** It
 * is where `mycontext doctor` belongs — the checks for a stale index, an
 * oversized audit log, orphaned seen files — and running diagnostics is far
 * less invasive than creating a workspace. It is still not run: `doctor` writes
 * its findings somewhere, and deciding where a periodic health report goes
 * (stdout into the session? the log? nowhere until asked?) is the same
 * unanswered question one notch down.
 *
 * **No matcher.** The matcher on this event is tested against `trigger` (build
 * 2.1.239, byte 317139714: `case"Setup":a=n.trigger;break;`). Naming both
 * declared values would be correct today and silently skip a third the day one
 * is added — the `fork` defect exactly — and this hook wants both, so it names
 * neither.
 */

/** The `trigger` values build 2.1.239's schema accepts, in its order. */
export const SETUP_TRIGGERS = ['init', 'maintenance'] as const;

export function observeSetup(input: HookInput): Observation | null {
  const trigger = typeof input.trigger === 'string' && input.trigger !== ''
    ? input.trigger : '<absent>';
  const unknown = !(SETUP_TRIGGERS as readonly string[]).includes(trigger);

  return {
    note:
      `trigger=${capped(trigger, 32)}` +
      (unknown ? ` (not one of ${SETUP_TRIGGERS.join(', ')})` : '') +
      '; nothing was initialised and no checks were run — what a fresh install should do ' +
      'on its own is the owner\'s ruling (hooks seq:22)',
  };
}

export const SETUP: ObservationSpec = {
  hook: 'Setup',
  op: 'setup',
  observe: observeSetup,
};

if (isMainEntry(import.meta.filename, process.argv[1])) runObservationHook(SETUP);
