import { renderItem } from '../../core/item.ts';
import { updateItem, type MutationContext, type UpdateInput } from '../../core/mutate.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext } from './context.ts';
import { flag, positionals, registerCommand, type Emit } from './registry.ts';

const USAGE = `usage: mycontext review [list] [--type <category>]
       mycontext review show <id>
       mycontext review promote <id> [--scope "a/**,b/**"] [--always] [--severity hard|soft]
       mycontext review discard <id>`;

function drafts(ctx: MutationContext, type: string | null): Item[] {
  return ctx.store.all()
    .filter((i) => i.status === 'draft')
    .filter((i) => type === null || i.type === type)
    .sort((a, b) => (a.type === b.type ? a.id.localeCompare(b.id) : a.type.localeCompare(b.type)));
}

/**
 * Resolves an id for `show`, `promote` and `discard` alike — deliberately NOT
 * filtered to drafts: `show` must work on any item, and `promote` owes a
 * non-draft a message naming its actual status rather than "no item with id".
 * Named for what it does; the draft check lives at the one call site that
 * wants it, below.
 */
function findItem(ctx: MutationContext, id: string, out: Emit): Item | null {
  const item = ctx.store.get(id);
  if (!item) {
    out(`my_context: no item with id "${id}". List the queue with \`mycontext review\`.`);
    return null;
  }
  return item;
}

function cmdReview(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  const valueFlags = ['type', 'scope', 'severity'];
  const [subcommand = 'list', id] = positionals(args, valueFlags);

  if (!['list', 'show', 'promote', 'discard'].includes(subcommand)) {
    out(`my_context: unknown review subcommand "${subcommand}".\n\n${USAGE}`);
    return 1;
  }

  const { ctx, errors } = openMutateContext(ws);
  try {
    if (subcommand === 'list') {
      const type = flag(args, 'type');
      const queue = drafts(ctx, type);
      if (queue.length === 0) {
        out(type
          ? `my_context: no drafts of type "${type}".`
          : 'my_context: no drafts pending review.');
        emitLoadErrors(errors, out);
        return errors.length ? 1 : 0;
      }
      for (const item of queue) {
        out(
          `${item.id.padEnd(44)}${item.type.padEnd(14)}${item.origin.padEnd(8)}` +
          `${(item.sourceFile ?? '-').padEnd(30)}${item.title}`,
        );
      }
      out('');
      out(`${queue.length} draft(s) pending. Promote with \`mycontext review promote <id>\`.`);
      emitLoadErrors(errors, out);
      return errors.length ? 1 : 0;
    }

    if (!id) { out(USAGE); return 1; }

    const item = findItem(ctx, id, out);
    if (!item) return 1;

    if (subcommand === 'show') {
      out(renderItem(item));
      if (item.sourceFile) {
        out('');
        out(`provenance: ${item.sourceFile} § ${item.sourceAnchor ?? '(no anchor)'} ` +
            `checksum ${item.sourceChecksum ?? '(none)'}`);
      }
      emitLoadErrors(errors, out);
      return errors.length ? 1 : 0;
    }

    if (item.status !== 'draft') {
      out(
        `my_context: ${item.id} is "${item.status}", not "draft". ` +
        `review only drafts; use \`mycontext show ${item.id}\` to inspect it.`,
      );
      return 1;
    }

    if (subcommand === 'discard') {
      // `origin: 'human'` is required, not decorative: updateItem refuses a
      // status change on a normative item from any non-human origin.
      updateItem(ctx, { id: item.id, status: 'deprecated', origin: 'human' });
      out(`my_context: ${item.id} is now deprecated. It is kept as a trail rather than deleted.`);
      emitLoadErrors(errors, out);
      return errors.length ? 1 : 0;
    }

    // `promote` is the trust boundary this whole draft mechanism exists to
    // gate — a human is about to make this item govern. Print id, type,
    // title, severity, scope and the body before acting, so a promotion by
    // id alone is never mistaken for a rule: the human sees what they are
    // approving, not just an identifier.
    out(`about to promote:`);
    out(`  id       ${item.id}`);
    out(`  type     ${item.type}`);
    out(`  title    ${item.title}`);
    out(`  severity ${item.severity}`);
    out(`  scope    ${item.scope.length ? item.scope.join(', ') : '(none)'}`);
    out('');
    out(item.body || '(no body)');
    out('');

    // Object.hasOwn: `ws.config.categories[item.type]` on a type of
    // "constructor" would otherwise resolve to Object.prototype.constructor
    // instead of reporting "not enabled" — the same prototype-pollution
    // hazard `resolveCategory`/`tierOf` in mutate.ts already guard.
    const category = Object.hasOwn(ws.config.categories, item.type)
      ? ws.config.categories[item.type]
      : undefined;
    if (!category?.enabled) {
      out(
        `my_context: category "${item.type}" is not enabled in this project, so ${item.id} ` +
        `would never be injected even as "active". Enable it in .my_context/config.json ` +
        `under categories.${item.type}.enabled, then promote.`,
      );
      return 1;
    }

    // `updateItem` takes ONE object, id included — there is no (ctx, id, patch)
    // overload — and `origin: 'human'` is what makes the status change legal.
    const patch: UpdateInput = { id: item.id, status: 'active', origin: 'human' };
    const scope = flag(args, 'scope');
    if (scope !== null) patch.scope = scope.split(',').map((s) => s.trim()).filter(Boolean);
    const severity = flag(args, 'severity');
    if (severity === 'hard' || severity === 'soft') patch.severity = severity;
    if (args.includes('--always')) patch.always = true;

    updateItem(ctx, patch);
    // MutationResult carries no `.item`; the written item comes back from the
    // store, which updateItem has already upserted the new scope into.
    const updated = ctx.store.get(item.id) as Item;
    const scoping = updated.scope.length
      ? `scope ${updated.scope.join(', ')}`
      : 'no scope — indexed and searchable, but never auto-injected';
    out(`my_context: ${item.id} is now active (${scoping}).`);
    emitLoadErrors(errors, out);
    return errors.length ? 1 : 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    ctx.store.close();
  }
}

registerCommand({
  name: 'review',
  usage: 'review [show|promote|discard]',
  summary: 'walk the draft queue and promote what should govern',
  run: cmdReview,
});
