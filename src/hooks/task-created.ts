import { isMainEntry } from '../core/paths.ts';
import { runObservationHook } from './observe.ts';
import { TASK_CREATED } from './task-events.ts';

/**
 * The `TaskCreated` binary. The spec — and the whole argument for what these
 * two events do and deliberately do not do — is in `hooks/task-events.ts`,
 * which `TaskCompleted` shares.
 *
 * A file per event because `hooks.json` registers a COMMAND per event, and a
 * single binary switching on `hook_event_name` would put the choice of what ran
 * inside a payload this project has already learned not to trust for control
 * flow (`hooks/io.ts` · `parseHookInput` · the `{}` that looked like a real
 * payload). The manifest names the file; the file names the spec.
 */
if (isMainEntry(import.meta.filename, process.argv[1])) runObservationHook(TASK_CREATED);
