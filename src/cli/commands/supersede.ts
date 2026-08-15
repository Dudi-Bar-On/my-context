import { globalLayerRefusal, supersedeItem, type MutationContext } from '../../core/mutate.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext } from './context.ts';
import { refuseUnknownFlag } from './format.ts';
import { injection } from './injection.ts';
import { confirmAction } from './review.ts';
import { flag, positionals, registerCommand, type Emit } from './registry.ts';

/**
 * Retiring an item is the one lifecycle move that had no human route at all.
 * `supersedeItem` existed, but its only caller was the `supersede_item` MCP
 * tool, which refuses a non-human origin retiring a governing normative item
 * — correctly, since that is a human decision. The human it deferred to then
 * had no command to make it with: `review promote`/`discard` act on drafts
 * only, `update_item` refuses a status change on a governing item, and the
 * remaining route (hand-edit the file, then `repair --yes`) is the one the
 * README calls out as leaving no evidence it happened.
 *
 * `origin: 'human'` below is what makes this command the answer to that
 * refusal rather than a second copy of it.
 */

/** The flags this command accepts, and the value-taking subset. */
const ALLOWED = ['by', 'reason', 'yes'];
const VALUE_FLAGS = ['by', 'reason'];

const USAGE = `usage: mycontext supersede <retired id> --by <replacement id> [--reason <text>] [--yes]`;

/** Resolves an id, reporting the same way `review`'s lookup does. */
function findItem(ctx: MutationContext, id: string, label: string, out: Emit): Item | null {
  const item = ctx.store.get(id);
  if (!item) {
    out(`my_context: no item with id "${id}" (${label}). Find it with \`mycontext list\` or ` +
        `\`mycontext query --text "..."\`.`);
    return null;
  }
  return item;
}

function cmdSupersede(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  // Refused before the corpus is opened and before any preview or prompt, on
  // the same terms as `review` — a `--yse` that silently became "no
  // confirmation flag at all" would turn a typo into a refusal the operator
  // then works around by adding the flag they thought they had passed.
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, USAGE, out)) return 1;

  const [id, extra] = positionals(args, VALUE_FLAGS);
  const by = flag(args, 'by');
  if (!id || !by) { out(USAGE); return 1; }
  // A second positional is a mistake worth naming: `mycontext supersede A B`
  // reads like it ought to work, and silently ignoring `B` would retire `A`
  // in favour of whatever `--by` said — or print the usage banner while the
  // operator believed they had named both sides.
  if (extra !== undefined) {
    out(`my_context: unexpected argument "${extra}" — the replacement is named with ` +
        `--by, not as a second positional.\n${USAGE}`);
    return 1;
  }

  const { ctx, errors } = openMutateContext(ws);
  try {
    // Every refusal below runs BEFORE the preview is printed: a refusal must
    // never be preceded by "about to supersede", which reads as a report of
    // something that then did not happen.
    if (id === by) {
      out(`my_context: ${id} cannot supersede itself.`);
      return 1;
    }

    const retired = findItem(ctx, id, 'the item being retired', out);
    if (!retired) return 1;
    const replacement = findItem(ctx, by, 'the replacement, --by', out);
    if (!replacement) return 1;

    // BOTH sides are written (`superseded_by` on the retiree, `supersedes` on
    // the replacement), so both have to be project-layer. Checked here rather
    // than left to `supersedeItem`'s own `requireWritableItem` only so the
    // refusal lands before the preview.
    for (const item of [retired, replacement]) {
      if (item.layer !== 'project') {
        // `globalLayerRefusal` (mutate.ts) rather than a local copy: this is
        // the same sentence `requireWritableItem` throws and the same one
        // `mycontext edit` prints, and three hand-kept copies of one refusal
        // is how the scope wording came to have four spellings.
        out(globalLayerRefusal(item.id));
        return 1;
      }
    }

    const retiredInjection = injection(retired, ws.config);
    const replacementInjection = injection(replacement, ws.config);

    out('about to supersede:');
    out(`  retiring    ${retired.id}`);
    out(`  type        ${retired.type}`);
    out(`  title       ${retired.title}`);
    out(`  status      ${retired.status} -> superseded`);
    out(`  today       ${retiredInjection.phrase}`);
    out(`  after       not injected (status "superseded"); the file, its body, its observations`);
    out(`              and its relations all stay, and it stays searchable`);
    out('');
    out(`  replaced by ${replacement.id}`);
    out(`  type        ${replacement.type}`);
    out(`  title       ${replacement.title}`);
    out(`  status      ${replacement.status}`);
    // What actually governs after this is the whole point of the approval,
    // and it is NOT implied by the retirement: superseding an injected item
    // in favour of a draft, or of an item in a disabled or rationale
    // category, leaves nothing governing in its place. The preview says so in
    // those words rather than leaving the human to infer it from a status
    // column.
    out(`  governs     ${replacementInjection.phrase}`);
    if (!replacementInjection.injected) {
      out(`              nothing will govern in ${retired.id}'s place until that changes` +
          `${replacement.status === 'draft'
            ? ` — promote it with \`mycontext review promote ${replacement.id}\``
            : ''}`);
    }
    out('');

    if (!confirmAction(
      args, out,
      `Supersede ${retired.id} ("${retired.title}") with ${replacement.id}?`,
    )) return 1;

    // `origin: 'human'` is required, not decorative: `supersedeItem` refuses
    // any non-human caller retiring a governing normative item, which is the
    // case this command exists to serve.
    const reason = flag(args, 'reason');
    const result = supersedeItem(ctx, {
      id: retired.id,
      by: replacement.id,
      ...(reason === null ? {} : { reason }),
      origin: 'human',
    });
    out(result.message);
    out(`my_context: ${retired.id} now carries "superseded_by ${replacement.id}", and ` +
        `${replacement.id} carries "supersedes ${retired.id}".`);
    // F2 (see `openMutateContext`): the write above succeeded, so an
    // unrelated corpus load error is a warning and this exits 0.
    emitLoadErrors(errors, out);
    return 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    ctx.store.close();
  }
}

registerCommand({
  name: 'supersede',
  usage: 'supersede <id> --by <id>',
  summary: 'retire an item in favour of a replacement, both directions recorded',
  run: cmdSupersede,
});
