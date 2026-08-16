import path from 'node:path';
import { globalLayerRefusal, updateItem } from '../../core/mutate.ts';
import {
  isSnapshot, largestFullTextBudget, readSnapshot, snapshotBudgetLine, snapshotCost,
} from '../../core/reference.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import { refuseUnknownFlag } from './format.ts';
import { confirmAction } from './review.ts';
import { positionals, registerCommand, type Emit } from './registry.ts';

/**
 * Re-takes a snapshot: reads `source_file` again and replaces the item's body
 * with what is there now.
 *
 * **Why this is a command of its own**, rather than a flag on `edit` or a
 * re-`add` that supersedes. Three routes were possible and two are worse:
 *
 *  - `mycontext edit <id> --refresh` would put a verb that computes its own
 *    new value into a command whose every other flag takes the value from the
 *    caller (`--body`, `--scope`, `--status`, …). `edit`'s gate is scaled to
 *    what a field does to injection; a refresh does not change a field's
 *    meaning at all, it re-synchronises content, so it wants a different
 *    preview (size before and after) and a different question.
 *  - A re-`add` that supersedes would mint a NEW id on every refresh, so a
 *    roadmap kept current for a year becomes a chain of retired items, every
 *    relation pointing at the reference goes stale at the first refresh, and
 *    `decay`/`status` counts fill with retirements that record nothing anyone
 *    decided. Supersede exists for a change of assertion; a refresh is the
 *    same assertion, re-copied.
 *
 * **It is not a way around the gate.** It writes through `updateItem`, the
 * same function `mycontext edit` and `review promote` write through, so every
 * rule that applies to a content change applies here: a global-layer item is
 * refused, and a non-human caller's refresh of a category set to
 * `agentEdits: "review"` is STAGED as a pending revision rather than applied.
 * This command passes `origin: 'human'` because it is a human-facing command;
 * the agent-facing route is the `refresh_item` MCP tool, which passes
 * `origin: 'agent'` and therefore stages wherever the policy says it must.
 */

const ALLOWED = ['yes'];
const USAGE = 'usage: mycontext refresh <id> [--yes]';

function cmdRefresh(ws: Workspace, args: string[], out: Emit, cwd: string): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }
  if (refuseUnknownFlag(args, ALLOWED, [], USAGE, out)) return 1;

  const [id, extra] = positionals(args, []);
  if (!id) { out(USAGE); return 1; }
  if (extra !== undefined) {
    out(`my_context: unexpected argument "${extra}" — refresh takes one id.\n${USAGE}`);
    return 1;
  }

  const { ctx, errors } = openMutateContext(ws);
  try {
    const item = ctx.store.get(id);
    if (!item) {
      out(`my_context: no item with id "${id}". Find it with \`mycontext list reference\` or ` +
          `\`mycontext search "..."\`.`);
      return 1;
    }
    // Checked here as well as inside `updateItem`, for the reason `supersede`
    // checks it here: a refusal must not arrive after a preview of something
    // that was never going to happen.
    if (item.layer !== 'project') { out(globalLayerRefusal(item.id)); return 1; }

    // The refusal that keeps `refresh` honest about what it is. An item with
    // a `source_anchor` came from INGEST: its body is an assertion someone
    // extracted from one section of a document, not a copy of it, so
    // overwriting that body with the file would destroy authored judgement
    // and call it a refresh.
    if (!isSnapshot(item)) {
      const why = item.sourceFile === null
        ? `${item.id} records no source file, so there is nothing to re-read. Only an item ` +
          `captured with \`mycontext add <category> "<title>" --file <path>\` holds a snapshot.`
        : item.sourceAnchor !== null
          ? `${item.id} was extracted from "${item.sourceFile}" § ${item.sourceAnchor} by ` +
            `ingest. Its body is an assertion somebody wrote from that section, not a copy of ` +
            `the file, so replacing it with the file's text would discard that work. When ` +
            `\`mycontext doctor\` reports source_drift on an ingested item, the route is to ` +
            `read the section and edit or supersede the item yourself.`
          : `${item.id} names "${item.sourceFile}" but records no source_checksum, so there is ` +
            `no captured state to compare against. Capture it again with --file.`;
      out(`my_context: ${item.id} is not a file snapshot and cannot be refreshed. ${why}`);
      return 1;
    }

    const repoRoot = path.dirname(ctx.root);
    // Resolved against the REPOSITORY ROOT, not the caller's cwd: the stored
    // `source_file` is repo-root-relative (that is what `readSnapshot` records
    // and what `doctor` resolves), so refreshing from a subdirectory must find
    // the same file `doctor` checks. `--file` on `add` resolves against cwd
    // instead, because there the path is one the user just typed.
    const snapshot = readSnapshot(repoRoot, repoRoot, item.sourceFile as string);

    if (snapshot.checksum === item.sourceChecksum) {
      out(`my_context: ${item.id} is already current — "${snapshot.sourceFile}" is unchanged ` +
          `since it was snapshotted (${snapshot.checksum}). Nothing was written.`);
      emitLoadErrors(errors, out);
      return 0;
    }

    const before = snapshotCost(item.body);
    const tier = Object.hasOwn(ws.config.categories, item.type)
      ? ws.config.categories[item.type].tier
      : 'normative';

    out('about to refresh:');
    out(`  item        ${item.id}`);
    out(`  type        ${item.type}`);
    out(`  source      ${snapshot.sourceFile}`);
    out(`  checksum    ${item.sourceChecksum} -> ${snapshot.checksum}`);
    out(`  size        ${before.lines} -> ${snapshot.cost.lines} line(s), ` +
        `~${before.tokens} -> ~${snapshot.cost.tokens} estimated tokens`);
    out(`  budget      ${snapshotBudgetLine(
      snapshot.cost, tier, largestFullTextBudget(ws.config.budgets),
    )}`);
    // Said plainly, because it is the one thing a refresh cannot undo and the
    // one thing a reader might assume it merges. The old snapshot is not
    // lost — the item file is in git — but this command does not keep it.
    out(`  the item's title, observations, relations, scope and tags are untouched; only the`);
    out(`  body is replaced, whole, by the file's current text.`);
    out('');

    if (!confirmAction(
      args, out, `Replace ${item.id}'s body with the current text of ${snapshot.sourceFile}?`,
    )) return 1;

    const result = updateItem(ctx, { id: item.id, body: snapshot.body, origin: 'human' });
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
  name: 'refresh',
  usage: 'refresh <id>',
  summary: 're-snapshot a reference from its source file, through the same gate',
  run: cmdRefresh,
});
