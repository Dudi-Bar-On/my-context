/**
 * **`GET /api/flags` — what every command accepts, and what may be put in each
 * flag, for THIS workspace (plan:builder seq:2b).**
 *
 * Twenty-nine of the thirty commands with a flag spec can be answered from a
 * static file, and `lib/palette-defs.js` is that file. `edit` cannot: its
 * accepted set is `[...EDIT_FLAGS.allowed, ...declaredEditFlags(config)]`,
 * computed per workspace from the flags this project's categories declare a
 * `mycontext edit` spelling for. A project declaring `state` on `task` accepts
 * `--state`; a project that does not, does not. There is no static entry that
 * is TRUE — only one that happens to be true here — so a builder driven by the
 * catalogue alone composes an `edit` command line that this CLI may refuse.
 *
 * That is why this route exists, and it is worth saying that it is the
 * requirement working rather than a gap in it: the owner asked that syntax be
 * enforced by the selections a person makes, and the one command whose syntax
 * is defined BY THE USER is the one that needs the server to say what it is.
 *
 * ── WHY IT SERVES ALL OF THEM AND NOT ONLY `edit` ─────────────────────────
 *
 * The static half could stay in the browser and only `edit` be fetched. It is
 * served here too, from `COMMAND_FLAGS` and `FLAG_DECLARATIONS`, because a
 * builder that reads two shapes from two places is a builder with two code
 * paths, and the one that runs least is the one that breaks. A screen asks this
 * route what a command takes and gets the same record whichever command it
 * named — `edit`'s simply had to be computed.
 *
 * It also closes a smaller hole in the same direction. `palette-defs.js` is a
 * hand-kept list, checked against the parser by `test/ui/palette-lib.test.ts`
 * but still hand-kept; what this route answers is READ OUT of the specs the
 * commands themselves parse with, so a flag added to a command reaches a screen
 * without anybody editing a catalogue.
 *
 * ── IT READS, AND THAT IS ALL IT CAN DO ────────────────────────────────────
 *
 * `core/command-flags.ts` and `core/edit-flags.ts` import no write symbol —
 * that is the property those modules exist to have, and
 * `test/ui/no-writes.test.ts` is the gate on it. This module adds nothing but a
 * route: no store is opened, no file is written, and the config it reads is the
 * one `ApiContext` already resolved for every other endpoint.
 */
import { COMMAND_FLAGS, FLAG_DECLARATIONS, type FlagDeclarations } from '../core/command-flags.ts';
import { UNLINK_ARITY, editFlagSurface } from '../core/edit-flags.ts';
import type { Workspace } from '../core/workspace.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';

/** One command's whole answer: what argv it accepts, and what each flag means. */
export interface CommandFlagView {
  /** Every flag name accepted, `--` stripped. */
  allowed: string[];
  /** The subset that consumes the next token. */
  values: string[];
  /** What each flag in `allowed` means and what may be put in it. */
  flags: FlagDeclarations;
  /**
   * Present, and non-empty, only on a command whose surface this workspace
   * added to. It is the difference between "this is what commands take" and
   * "this is what YOUR project's commands take", and a builder that renders it
   * tells a user why a flag they read about elsewhere is not on their screen.
   */
  declared?: string[];
}

/**
 * The whole flag surface, keyed by command name.
 *
 * `edit` is a key like any other, which is the point: the caller does not have
 * to know which command is the per-workspace one, and the day a second command
 * grows a declared flag this route answers for it without a new shape.
 */
export function apiFlags(ws: Workspace): JsonResult {
  const commands: Record<string, CommandFlagView> = {};
  for (const [name, spec] of Object.entries(COMMAND_FLAGS)) {
    commands[name] = {
      allowed: spec.allowed,
      values: spec.values,
      flags: FLAG_DECLARATIONS[name],
    };
  }
  const edit = editFlagSurface(ws.config);
  commands['edit'] = {
    allowed: edit.allowed, values: edit.values, flags: edit.flags, declared: edit.declared,
  };
  return {
    status: 200,
    body: {
      commands,
      /**
       * `--unlink` takes two operands and no `{ allowed, values }` record can
       * say so, so the arity travels beside the table rather than being left
       * for a builder to discover by composing a broken command line.
       */
      unlinkArity: UNLINK_ARITY,
    },
  };
}

/** Registered from `registerReadRoutes`, for the two reasons its comment gives. */
export function registerFlagRoutes(): void {
  registerRoute('GET', '/api/flags', {
    kind: 'json', handle: (ctx: ApiContext) => apiFlags(ctx.ws),
  });
}
