import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import { linkItems, RELATION_TYPES } from '../../core/relations.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import { refuseUnknownFlag } from './format.ts';
import { positionals, registerCommand, type Emit } from './registry.ts';

/**
 * `mycontext link <from> <relation> <to>` — the CLI spelling `link_items` had
 * and the terminal did not (owner instruction, 2026-09-04: "support relation
 * using the cli too").
 *
 * **Why a command of its own rather than a flag on `edit`.** `edit --unlink`
 * already removes a relation, under `edit`'s own gate, because removing one
 * CAN weaken what a governing item asserts — the same reason a scope change
 * previews there. Adding one cannot: `linkItems` (core/relations.ts) crosses
 * no trust boundary on the way in, which is exactly why `LinkInput` carries no
 * `origin` at all and why the `link_items` MCP tool needs none either. A flag
 * folded onto `edit` would put a write with no gate behind a command whose
 * entire other surface previews and confirms, which teaches the wrong lesson
 * about what an edge does. `unlink` living on `edit` and `link` living here is
 * therefore not the asymmetry it looks like — the two writes have different
 * blast radii and this is that difference, spelled as two places to type.
 *
 * **No `--yes`, and that is a decision, not an omission.** The approval
 * boundary this project enforces is DERIVED from which commands the real
 * parser accepts `--yes` on (`test/helpers/approval-boundary.ts`), never
 * declared — so the honest way to keep `link` off it is to give it no `--yes`
 * to find, the same way `lesson` (a rationale-tier write with no gate of its
 * own) has none. An added edge cannot change what governs a project on its
 * own — nothing here flips a `status`, widens a `scope`, or sets `always` —
 * which is the same fact `TOOL_PARITY`'s `link_items` row and the palette's
 * `boundary: false` marking already record for the tool. A command that
 * performed a genuinely different act (writing `supersedes`, say) would need
 * a different answer; this one does not.
 *
 * **The vocabulary is read, never restated.** `RELATION_TYPES` (core/vocabulary.ts)
 * is the same list `link_items`' schema enum uses, so a caller who gets the
 * relation wrong is shown the one list this project keeps.
 *
 * **What it refuses is exactly what `linkItems` refuses**, because this
 * command is a thin CLI wrapper over it and adds no rule of its own: a
 * self-link, `supersedes`/`superseded_by` (which assert a lifecycle change —
 * use `mycontext supersede`), and a name outside `RELATION_TYPES`. A duplicate
 * edge is not an error — `linkItems` reports it and writes nothing, the same
 * answer it gives an agent through the tool.
 */
const { allowed: ALLOWED, values: VALUE_FLAGS } = COMMAND_FLAGS.link;
const USAGE = 'usage: mycontext link <from> <relation> <to>';

function cmdLink(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, USAGE, out)) return 1;

  const [from, relation, to, extra] = positionals(args, []);
  if (!from || !relation || !to) {
    out(`${USAGE}\nRelation vocabulary: ${RELATION_TYPES.join(', ')}.`);
    return 1;
  }
  if (extra !== undefined) {
    out(
      `my_context: unexpected argument "${extra}" — link takes exactly three: ` +
      `<from> <relation> <to>.\n${USAGE}`,
    );
    return 1;
  }

  const { ctx, errors } = openMutateContext(ws);
  try {
    const result = linkItems(ctx, { from, to, relation });
    out(result.message);
    emitLoadErrors(errors, out);
    return 0;
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  } finally {
    ctx.store.close();
  }
}

registerCommand({
  name: 'link',
  usage: 'link <from> <relation> <to>',
  summary: 'record a relation from one item to another — see mycontext edit --unlink to remove one',
  run: cmdLink,
});
