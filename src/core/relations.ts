/**
 * The relation vocabulary and the two operations over it — `linkItems` and
 * `unlinkItems` — plus the refusals both surfaces (`link_items`, `mycontext
 * edit --unlink`) share. Split out of `mutate.ts` in Wave 5: an edge
 * crosses no trust boundary on the way IN (see `LinkInput.origin`), so the
 * relation operations never touch the create/update/supersede machinery —
 * only the shared write plumbing in `persist.ts`.
 */
import { auditMutation, persist, requireWritableItem } from './persist.ts';
import { enumError } from './teach.ts';
import { validateRelationTarget } from './validate.ts';
import type { Item, Origin } from './types.ts';
import type { MutationContext, MutationResult } from './mutate.ts';

/**
 * The relation vocabulary. Closed deliberately: an open vocabulary produces
 * `derives_from`, `derivedFrom` and `derived-from` in one corpus, and then no
 * query finds all three.
 */
export const RELATION_TYPES = [
  'derived_from', 'constrains', 'supersedes', 'blocks',
  'mitigates', 'refines', 'relates_to', 'links_to',
];

/**
 * The back-reference `supersedeItem` writes onto the item it RETIRES, the
 * mirror of the `supersedes` edge it writes onto the replacement. The
 * project's own `STD-answered-questions-are-superseded` requires it by name:
 * an answered open_question is set to `superseded` AND carries a
 * `superseded_by` pointer to whatever answered it, so a reader who opens the
 * question finds the answer without having to search the corpus for whichever
 * item happens to point back at it.
 *
 * Deliberately NOT a member of `RELATION_TYPES`, and that omission is the
 * guard, not an oversight. `RELATION_TYPES` is the whole gate on `linkItems`,
 * which is agent-reachable through the `link_items` MCP tool and has no
 * `origin` at all — `LinkInput` carries none, because adding a relation was
 * defined as crossing no trust boundary. Listing `superseded_by` there would
 * hand any agent a way to stamp "this item has been retired in favour of that
 * one" onto a still-`active` governing item, with none of the lifecycle
 * changes that would make the claim true — the same forgery the `supersedes`
 * refusal below already blocks, re-opened through the opposite-facing edge.
 * `linkItems` refuses this string by name, immediately below, so the refusal
 * survives even if someone later widens the enum.
 */
export const SUPERSEDED_BY = 'superseded_by';

export interface LinkInput {
  from: string;
  to: string;
  relation: string;
  /**
   * Who is linking. **Not a gate, and deliberately so** — adding an edge
   * crosses no trust boundary (an added edge cannot change what governs),
   * which is why this interface had no origin at all until Phase 5, and
   * nothing below branches on it.
   *
   * It is here because the audit log records WHO for every mutation, and
   * "unknown" is not an acceptable answer for the two operations an agent can
   * reach through `link_items`. Defaults to `'human'`, matching every other
   * input in this module: the CLI is the user (spec §7.1), and the MCP tool
   * passes `'agent'` explicitly.
   */
  origin?: Origin;
}

export function linkItems(ctx: MutationContext, input: LinkInput): MutationResult {
  // Both retirement edges are refused BEFORE the `RELATION_TYPES` check, not
  // after it, so the refusal survives someone widening the enum: adding
  // `superseded_by` to that list is the one wrong fix this area invites, and
  // the enum is `linkItems`' only other gate.
  //
  // Neither can be forged here. `supersedes` is in the vocabulary because it
  // is part of the file format (spec §3.2) and `supersedeItem` writes it;
  // `superseded_by` is deliberately not (see `SUPERSEDED_BY`). Writing either
  // through `linkItems` would assert a supersession with none of the
  // lifecycle side effects — `status`, `validUntil` on the retiree — that
  // make the assertion true, leaving the file and the item's actual state
  // contradicting each other.
  //
  // The remedy names BOTH orderings rather than one ready-made command. A
  // relation is stored on the item named by `from`, so this call means "from
  // supersedes to"; mechanically inverting that into `supersede_item(id: to,
  // by: from)` was verified to retire the wrong item in the case this
  // vocabulary exists for — an agent recording that it had answered an open
  // question wrote `from: <question>, to: <answer>`, and following the
  // printed remedy retired the ANSWER and left the question standing.
  // Whichever way round the caller meant it, they have to read a sentence
  // naming the item that gets retired before they can copy a command.
  if (input.relation === 'supersedes' || input.relation === SUPERSEDED_BY) {
    throw new Error(
      `my_context: "${input.relation}" cannot be added with link_items — it asserts a lifecycle ` +
      `change, not just a relation, and link_items never touches status. supersede_item writes ` +
      `both directions itself ("supersedes" on the replacement, "${SUPERSEDED_BY}" on the item ` +
      `it retires). Name the item being RETIRED as its "id": if that is ${input.from} — it was ` +
      `answered or replaced by ${input.to} — use ` +
      `supersede_item(id: "${input.from}", by: "${input.to}"); if it is ${input.to}, use ` +
      `supersede_item(id: "${input.to}", by: "${input.from}"). A human retires a governing ` +
      `normative item with \`mycontext supersede <retired id> --by <replacement id>\`; an agent ` +
      `cannot, either way. See mycontext_help("workflow").`,
    );
  }
  if (!RELATION_TYPES.includes(input.relation)) {
    throw new Error(enumError('relation', input.relation, RELATION_TYPES, 'workflow'));
  }
  if (input.from === input.to) {
    throw new Error(`my_context: ${input.from} cannot link to itself.`);
  }
  validateRelationTarget(input.to, '"to"');

  const from = requireWritableItem(ctx, input.from);
  const target = ctx.store.get(input.to);

  if (from.relations.some((r) => r.type === input.relation && r.target === input.to)) {
    return {
      id: from.id,
      created: false,
      status: from.status,
      filePath: from.filePath,
      message: `my_context: ${from.id} already ${input.relation} ${input.to}.`,
    };
  }

  from.relations.push({ type: input.relation, target: input.to });
  persist(ctx, from);
  const audited = auditMutation(ctx, 'link', input.origin ?? 'human', from.id, {
    fields: ['relations'], note: `${input.relation} ${input.to}`,
  });

  // Unresolved links are permitted by design (spec §3.2) and resolve on the
  // next sync, so this is a note rather than an error.
  const note = target
    ? ''
    : ` Note: ${input.to} does not exist yet; the link resolves when it is created.`;

  return {
    id: from.id,
    created: true,
    status: from.status,
    filePath: from.filePath,
    message: `my_context: ${from.id} ${input.relation} ${input.to}.${note}${audited}`,
  };
}

/**
 * `unlinkItems` — the first supported way to REMOVE a relation, and the mirror
 * of `linkItems` in vocabulary but not in reach.
 *
 * **Why it exists.** Nothing removed a relation before this. `link_items` only
 * adds, `updateItem` has no `relations` field, and hand-editing the Markdown is
 * the route the plugin's own `PreToolUse` hook blocks and this project's
 * documentation is not allowed to instruct. The case that surfaced it: retiring
 * a requirement left a `depends_on` on a still-active item pointing at a
 * superseded one, and there was no supported way to clear it.
 *
 * **Why there is no `unlink_items` tool.** Adding a relation crosses no trust
 * boundary — that is why `LinkInput` carries no `origin` — because an added
 * edge cannot change what governs. Removing one can: a `blocks` edge on a
 * governing item is part of what that item asserts, and taking it off weakens
 * the item the way emptying its scope does, which is exactly the change
 * `guardedChange` refuses to let an agent make outright. The usual answer to
 * that — stage it as a revision for a human — is not available either:
 * `RevisionChanges` has no relation field and `UPDATE_FIELD_POLICY` classifies
 * `UpdateInput`, which has none. So the honest choices were "refuse" and "let
 * an agent do it unreviewed", and this is the first. The human route is
 * `mycontext edit <id> --unlink <relation> <target>`, which runs under `edit`'s
 * own gate: on a governing normative item it previews and confirms, exactly as
 * a scope change does.
 *
 * **The vocabulary is deliberately NOT checked here, and that is the one place
 * this is not `linkItems` reversed.** `RELATION_TYPES` is a closure rule on
 * what may be WRITTEN, so that one corpus does not end up with `derives_from`,
 * `derivedFrom` and `derived-from`. It says nothing about what may be removed,
 * and applying it here would make the edges you most need to clean up — the
 * ones from outside the vocabulary, put there by a hand edit or by an older
 * version — the only ones with no route out. What IS required is that the
 * relation actually be on the item: an unlink that matched nothing and reported
 * success would be the silent no-op this project rules out.
 *
 * **Both retirement edges are refused by name, before anything else**, for the
 * mirror of the reason `linkItems` refuses them — and the refusal is spelled
 * out here rather than shared, because the two are refusing different acts.
 * `supersedeItem` writes `supersedes` on the replacement and `superseded_by` on
 * the retiree *together with* the lifecycle change (`status`, `validUntil`) that
 * makes the claim true. Removing either half leaves an item marked `superseded`
 * with nothing recording what replaced it — "retirement without a successor",
 * which the README states plainly is not offered — and destroys the route a
 * reader follows from a retired item to the one that answers it. Placed ahead
 * of every other check so it survives someone widening `RELATION_TYPES`, the
 * one wrong fix this area invites.
 */
/**
 * "This edge is not just a relation" — the refusal, or null when the relation
 * is an ordinary one.
 *
 * Exported for the ordering reason `globalLayerRefusal` documents: `mycontext
 * edit --unlink` prints a preview and asks a human to confirm before it
 * writes, and a refusal thrown from inside the write would land AFTER the
 * preview — a person shown what a command will do, asked to approve it, and
 * only then told it was never going to happen. One wording, two call sites,
 * so the surfaces cannot drift.
 */
export function retirementEdgeRefusal(relation: string): string | null {
  if (relation !== 'supersedes' && relation !== SUPERSEDED_BY) return null;
  return (
    `my_context: "${relation}" cannot be removed — it is not just a relation. ` +
    `A supersession is written together with the lifecycle change that makes it true ` +
    `("supersedes" on the replacement, "${SUPERSEDED_BY}" on the item it retires, plus that ` +
    `item's status and validUntil). Removing the edge would leave an item marked as retired ` +
    `with nothing recording what replaced it — retirement without a successor, which this ` +
    `system does not offer — and would break the route a reader follows from a retired item ` +
    `to the one that answers it. If the retirement itself was wrong, change the retired ` +
    `item's status with \`mycontext edit <id> --status active\`, which previews what starts ` +
    `governing again before it writes. See mycontext_help("workflow").`
  );
}

/**
 * "That relation is not on this item" — the refusal, or null when it is.
 *
 * An unlink that matched nothing and reported success would be the
 * accepted-and-ignored failure `INV-nothing-is-dropped-silently` rules out, so
 * the remedy is the list of what the item actually carries. Exported beside
 * `retirementEdgeRefusal` and for the same ordering reason.
 */
export function missingRelationRefusal(item: Item, relation: string, target: string): string | null {
  if (item.relations.some((r) => r.type === relation && r.target === target)) return null;
  const carried = item.relations.length === 0
    ? 'it carries none at all'
    : `it carries ${item.relations.map((r) => `${r.type} ${r.target}`).join(', ')}`;
  return (
    `my_context: ${item.id} has no "${relation}" relation to ${target} — ${carried}. ` +
    `Nothing was written.`
  );
}

export function unlinkItems(ctx: MutationContext, input: LinkInput): MutationResult {
  const forged = retirementEdgeRefusal(input.relation);
  if (forged) throw new Error(forged);

  const from = requireWritableItem(ctx, input.from);
  const missing = missingRelationRefusal(from, input.relation, input.to);
  if (missing) throw new Error(missing);

  const kept = from.relations.filter(
    (r) => !(r.type === input.relation && r.target === input.to),
  );
  from.relations = kept;
  persist(ctx, from);
  const audited = auditMutation(ctx, 'unlink', input.origin ?? 'human', from.id, {
    fields: ['relations'], note: `${input.relation} ${input.to}`,
  });

  return {
    id: from.id,
    created: false,
    status: from.status,
    filePath: from.filePath,
    message: `my_context: ${from.id} no longer ${input.relation} ${input.to}.${audited}`,
  };
}
