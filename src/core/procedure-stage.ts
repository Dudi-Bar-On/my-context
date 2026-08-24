/**
 * **The procedure lifecycle vocabulary, in one place, with no write surface.**
 *
 * `procedure` is the one category that has a lifecycle, and these three names
 * are the whole of it: the five STAGES, the `ready` TAG that separates two of
 * them, and the `status` (+ tag) → stage map. They lived in
 * `cli/commands/procedure.ts`, all three module-private, and that module
 * imports `updateItem` at its third line because `activate` and `done` mutate.
 *
 * So the Procedures read model (`ui/proc-model.ts`) could not import them —
 * not because of a naming choice but because `test/ui/no-writes.test.ts` bans
 * `src/cli/index.ts` from `src/ui/`, and reaching a command module drags the
 * whole mutating command surface in as an import side effect. It re-spelled
 * all three instead, citing the original beside each, and named that as a
 * defect it was creating rather than a preference. A closed vocabulary written
 * down twice will disagree eventually, and the disagreement would have been
 * between a CLI and a screen showing the same lifecycle.
 *
 * This module is the fix, and it is the same shape `vocabulary.ts` took for
 * `RELATION_TYPES` after that list had lived beside `linkItems` twice: reading
 * a vocabulary must not require a module that can write. What it imports is
 * `RETIRED_STATUSES` and a type, and `test/core/procedure-stage.test.ts`
 * asserts that its graph reaches no mutating function — so the read model may
 * have the lifecycle without the write surface it used to sit beside.
 *
 * The stages, mapped onto what ships — nothing was added to `Status` for this,
 * and the full table with the command for each transition stays in
 * `cli/commands/procedure.ts`, which is where the transitions live.
 */
import { RETIRED_STATUSES } from './select.ts';
import type { Item } from './types.ts';

/**
 * The tag that marks a draft procedure as ready to run.
 *
 * A tag rather than a status, because §2.1 forbids building on "index line
 * only" until that is decided and a sixth status would be exactly that
 * decision taken quietly. What it costs is that a `ready` procedure reaches no
 * session at all, and `list` discloses that rather than leaving it to be
 * discovered.
 */
export const READY_TAG = 'ready';

/**
 * The lifecycle stage of one procedure, in the order the CLI's own table names
 * them.
 *
 * **THERE ARE FIVE, AND THE MOCKUP'S TABLE HAS FOUR ROWS.** `pr.states` is
 * *"Four states, and exactly one of them injects"* and the table draws
 * `proposed`, `ready`, `active`, `done`. The fifth is not an invention: `pr.aband`
 * is on the same screen and says *"Abandoned rather than finished is
 * `superseded`"*, so the screen knows the state exists and has no row for it.
 * Serving four and folding `superseded` into `done` would report an abandoned
 * procedure as a finished one — the exact silent-wrong-answer this lifecycle
 * exists to prevent. **Which row the mockup grows is the owner's.**
 */
export const STAGES = ['proposed', 'ready', 'active', 'done', 'abandoned'] as const;
export type Stage = (typeof STAGES)[number];

/**
 * `status` (+ one tag) → stage.
 *
 * DERIVED from `RETIRED_STATUSES` (core/select.ts) rather than listing the
 * retired statuses again here: that set is what makes a finished procedure
 * appear in the session's `N retired` line instead of vanishing from every
 * tally, and a second hand-kept copy of it would be a defect waiting to go
 * stale the first time the set moves. `superseded` is tested first because it
 * is a member of that set with a stage of its own — abandoned is not done.
 */
export function stageOf(item: Item): Stage {
  if (item.status === 'superseded') return 'abandoned';
  if (RETIRED_STATUSES.has(item.status)) return 'done';
  if (item.status === 'active') return 'active';
  return item.tags.includes(READY_TAG) ? 'ready' : 'proposed';
}
