import { readSync } from 'node:fs';
import { renderItem } from '../../core/item.ts';
import { updateItem, type MutationContext, type UpdateInput } from '../../core/mutate.ts';
import { inertFieldError } from '../../core/trust.ts';
import { SEVERITIES } from '../../core/validate.ts';
import {
  changedFields, discardRevision, missingItemRefusal, pendingRevisionCounts, pendingRevisionLine,
  pendingRevisions, pickPendingRevision, promoteRevision, revisionHistory, staleRefusal,
  type PendingRevision,
} from '../../core/revision.ts';
import type { LoadError } from '../../core/rebuild.ts';
import { reviewQueue } from '../../core/select.ts';
import { enumError, unknownIdError } from '../../core/teach.ts';
import type { Item, Severity } from '../../core/types.ts';
import { scopePolicyFor } from '../../core/config.ts';
import {
  alwaysInjection, emptyScopeInjection, RATIONALE_NOT_INJECTED, scopeField,
} from '../../core/render-item.ts';
import type { Workspace } from '../../core/workspace.ts';
import { readImportRecords, type ImportRecord } from '../../pack/imported-audit.ts';
import { emitLoadErrors, openMutateContext } from './context.ts';
import {
  DETAIL_FLAGS, DETAIL_USAGE, detailLevel, emitJson, paragraph, records, refuseUnknownFlag, table,
  wantsJson,
} from './format.ts';
import {
  flag, flagOccurrences, hasFlag, listFlag, positionals, registerCommand, type Emit,
} from './registry.ts';
import { fieldDiff, renderRevision, renderSettled } from './revision-view.ts';

/**
 * The subcommands this command accepts — the single source for the whitelist
 * that refuses anything else, for the long `USAGE` block below, and for the
 * one-line `usage` string `mycontext --help` prints. Those were three
 * hand-maintained spellings and the shortest of them had already drifted: it
 * listed `show|promote|discard` and omitted `list`, which is not only accepted
 * but is the DEFAULT — so `--help` documented a bare `mycontext review` as
 * invalid while `mycontext review` itself printed the queue.
 */
export const SUBCOMMANDS = [
  'list', 'show', 'promote', 'discard', 'revisions', 'promote-revision', 'discard-revision',
] as const;

/**
 * The three revision subcommands are spelled out rather than folded into
 * `promote`/`discard`, and that is the answer to the one genuinely ambiguous
 * case this command now has: **a normative draft can carry both a draft-queue
 * entry and a pending revision at the same time** (Task 5 applies `agentEdits`
 * with no draft exemption, so an agent may propose a body change to a draft
 * that is itself waiting to be promoted). For such an item `mycontext review
 * promote <id>` and `mycontext review promote-revision <id>` are two different
 * acts on two different queues — one makes the draft govern its CURRENT text,
 * the other rewrites that text — and a single verb would have to guess which
 * the human meant. Guessing is not available here: promoting a draft when the
 * human meant to apply an agent's rewrite (or the reverse) is a wrong write to
 * the corpus, performed under a confirmation the human gave for the other
 * thing.
 *
 * The two are also cross-referenced rather than merely distinct: `promote` and
 * `discard` name any pending revision on the item they are about, and say
 * plainly that promoting the draft does not apply it.
 */
const REVISION_SUBCOMMANDS = ['revisions', 'promote-revision', 'discard-revision'];

/**
 * The flags each subcommand accepts, and the value-taking subset. Per
 * subcommand rather than one union, because the union is what makes an
 * unknown-flag check worthless here: `--json` on `promote` and `--yes` on
 * `list` are both meaningless, and accepting them would leave exactly the
 * silent swallow `unknownFlag` (format.ts) exists to stop, on the command
 * whose non-list subcommands MUTATE. `review list` is the one the README
 * counts among the six reporting commands; the other three get the same
 * treatment because there is no reason for them not to.
 */
const REVIEW_FLAGS: Record<string, { allowed: string[]; values: string[] }> = {
  list: { allowed: [...DETAIL_FLAGS, 'type'], values: ['type'] },
  show: { allowed: [], values: [] },
  promote: {
    allowed: ['scope', 'severity', 'always', 'yes', 'all', 'pack'],
    values: ['scope', 'severity', 'pack'],
  },
  discard: { allowed: ['yes'], values: [] },
  revisions: { allowed: [...DETAIL_FLAGS], values: [] },
  'promote-revision': { allowed: ['revision', 'force', 'yes'], values: ['revision'] },
  'discard-revision': { allowed: ['revision', 'reason', 'yes'], values: ['revision', 'reason'] },
};

const USAGE = `usage: mycontext review [list] [--type <category>] ${DETAIL_USAGE}
       mycontext review show <id>
       mycontext review promote <id> [--scope "a/**,b/**"] [--always] [--severity hard|soft] [--yes]
       mycontext review promote --all --pack <name> [--yes]
             (every draft that pack imported, in one confirmation — no per-item flags)
       mycontext review discard <id> [--yes]
       mycontext review revisions [<id>] ${DETAIL_USAGE}
       mycontext review promote-revision <id> [--revision REV-...] [--force] [--yes]
       mycontext review discard-revision <id> [--revision REV-...] [--reason "..."] [--yes]`;

/**
 * This command's view of the queue: `core/select`'s `reviewQueue` (the one
 * definition — including the layer filter and why it is part of the
 * definition, see its doc comment), ordered for a human reading a table.
 * The filter itself is deliberately NOT re-derived here: four surfaces each
 * had their own copy and they disagreed.
 */
export function drafts(ctx: MutationContext, type: string | null): Item[] {
  return reviewQueue(ctx.store.all(), type)
    .sort((a, b) => (a.type === b.type ? a.id.localeCompare(b.id) : a.type.localeCompare(b.type)));
}

/**
 * This command's SECOND queue: every content change an agent proposed against
 * a governing item under `agentEdits: "review"`, oldest first, exactly as
 * `pendingRevisions` (core/revision.ts) defines it.
 *
 * A thin pass-through on purpose, and exported for the same reason `drafts` is:
 * `status` counts this queue and points the user at this command, so it must
 * count the queue this command walks rather than re-deriving a filter that can
 * drift from it. Four surfaces each keeping their own copy of the draft filter
 * is how they came to disagree.
 */
export function revisionQueue(ctx: MutationContext): PendingRevision[] {
  return pendingRevisions(ctx);
}

/**
 * The count spelling and the human sentence — re-exported, not re-defined.
 * Both moved to `core/revision.ts` when the same queue started being reported
 * to AGENTS (`get_item`, `query_items`, `list_drafts`, the session injection),
 * because none of those may import a CLI command to learn how to count. This
 * command and `status` keep importing them from here, where they were first
 * written; see the definitions for why the numbers have exactly one source.
 */
export { pendingRevisionCounts, pendingRevisionLine };

/** `out` for a sentence rather than a line, wrapped to the layout budget —
 * the same helper `status` and `decay` use, for the same reason: a 180-column
 * explanation is rewrapped by the terminal at its own width with no indent,
 * which makes a hedge look like the start of the next section. */
function say(out: Emit, text: string, prefix = ''): void {
  for (const line of paragraph(text, prefix)) out(line);
}

/** What `review list --full` shows in a draft's `revisions` field. */
function draftRevisionField(revs: PendingRevision[], itemId: string): string {
  const mine = revs.filter((r) => r.itemId === itemId);
  if (mine.length === 0) return 'none pending';
  return `${mine.length} pending (${mine.map((r) => r.revisionId).join(', ')}) — promoting this ` +
    'draft does NOT apply them';
}

/**
 * The revision queue as `review list` reports it: the shared count sentence,
 * plus the overlap this command's two queues can genuinely have.
 *
 * A normative DRAFT can carry a pending revision (Task 5 applies `agentEdits`
 * to every item, with no draft exemption), so the same id can appear in both
 * queues at once meaning two different things. Naming that here — beside the
 * table where the reader is looking at the draft — is what keeps
 * `review promote <id>` from reading as "apply everything waiting on this id".
 */
function emitRevisionQueue(revs: PendingRevision[], queue: Item[], out: Emit): void {
  if (revs.length === 0) return;
  out('');
  say(out, pendingRevisionLine(revs));
  const both = queue.filter((i) => revs.some((r) => r.itemId === i.id));
  if (both.length > 0) {
    say(
      out,
      `${both.length} draft(s) in the queue above also carry a pending revision ` +
      `(${both.map((i) => i.id).join(', ')}). The two are separate acts: ` +
      '`mycontext review promote <id>` makes the draft govern its CURRENT text and applies no ' +
      'revision, and `mycontext review promote-revision <id>` rewrites that text without ' +
      'promoting the draft.',
      '  ',
    );
  }
}

/**
 * What `review promote` and `review discard` say about the OTHER queue.
 *
 * The same id can carry a draft-queue entry and a pending revision at once —
 * Task 5 applies `agentEdits` to every item with no draft exemption, so an
 * agent may propose a body change to a draft that is itself waiting to be
 * promoted. Neither of those two commands touches the revision, and a human
 * promoting the draft is entitled to know that the agent's proposed text is
 * not what they are approving.
 *
 * Emitted from the two call sites immediately before their previews and
 * prompts, deliberately NOT from one shared place higher up: every refusal on
 * this command (draft status, layer, category, severity, inert fields) runs
 * before any output, and a note printed above a refusal reads as the start of
 * an operation that is about to be refused.
 */
function emitDraftRevisionNote(
  ctx: MutationContext, item: Item, subcommand: string, out: Emit,
): void {
  const mine = revisionQueue(ctx).filter((r) => r.itemId === item.id);
  if (mine.length === 0) return;
  const one = mine.length === 1;
  say(
    out,
    `note: ${item.id} also has ${mine.length} pending revision(s) ` +
    `(${mine.map((r) => r.revisionId).join(', ')}) proposing new content for it. ` +
    `\`mycontext review ${subcommand} ${item.id}\` neither applies nor discards ` +
    `${one ? 'it' : 'them'} — this item keeps its current text either way. Read ` +
    `${one ? 'it' : 'them'} with \`mycontext review revisions ${item.id}\`.`,
  );
  out('');
}

/* ---------------------------------------------------------------------------
 * `mycontext review promote --all --pack <name>` — the other half of
 * "everything lands draft".
 * ------------------------------------------------------------------------- */

/**
 * Why a bulk promote exists at all, and why it is shaped like this.
 *
 * A forty-item pack produces a forty-item review queue on an empty project,
 * and a queue that size is bulk-approved unread — which is a WORSE outcome
 * than no gate, not a better one. What that argument supports is making bulk
 * review tractable, not skipping the gate. So the bulk act exists, it is one
 * human confirmation, and it is taken **after** the corpus is visible rather
 * than before — which is why there is deliberately no `--promote-all` on the
 * import itself (§6m.5).
 *
 * Every rule here is a refusal, and each closes a way the act could quietly
 * mean more than the human meant:
 *
 *  - **`--all` requires `--pack`.** There is no unbounded bulk promote: the
 *    licence granted is for the corpus a human just chose to import, not for
 *    every draft in the workspace.
 *  - **`--pack` without `--all` is refused**, rather than accepted and
 *    ignored. It is the flag that names a whole membership list; accepting it
 *    where nothing reads it is the silent swallow `unknownFlag` exists to stop.
 *  - **`--scope`, `--severity` and `--always` are refused with `--all`.** They
 *    are per-item decisions, and applying one of them to forty items is a bulk
 *    edit wearing a promotion's clothes.
 *  - **An id positional is refused with `--all`**: the two name different
 *    promotions, and honouring either would honour it against a command line
 *    that asked for the other.
 *
 * Each item is promoted by the same single `updateItem` call the one-item path
 * uses, with `origin: 'human'` — which is the only thing that evidences a
 * human did it, and the only thing that makes the status change legal on a
 * normative item.
 *
 * **The queue definition is not widened.** Eligibility is `reviewQueue`'s, via
 * `drafts` above, asked once and intersected with the membership list; the
 * category check is the same one the one-item path makes. Nothing here
 * re-derives what a draft is — four surfaces each kept their own copy of that
 * filter once and they disagreed.
 */

/** The skip reason for a member whose file is gone, spelled once. */
const MISSING_MEMBER = 'no longer present';

/**
 * Why one pack member is not promoted, or `null` when nothing stops it.
 *
 * **Everything skipped is named**, because a bulk operation that reports only
 * its successes is the exact shape of a silent drop. Four reasons, in the
 * order the underlying facts stop being true rather than in the order they are
 * cheap to test: an item that is gone cannot have a layer, an item outside the
 * project layer is read-only here whatever its status, a settled item is not
 * in the queue, and a category nobody enabled would never inject the result.
 *
 * `inQueue` is `reviewQueue`'s answer, handed in rather than recomputed — the
 * point of this function is to EXPLAIN that answer for one id, never to be a
 * second opinion about it. `categoryEnabled` is the same `Object.hasOwn` check
 * the one-item promote makes, for the same prototype-pollution reason.
 *
 * Exported for the one branch no artefact can reach: an import creates in the
 * project layer, so a pack member is never global, and standing up a fake
 * `HOME` to exercise one sentence would cost a whole test file (see
 * `test/cli/edit-global-layer.test.ts` for why).
 */
export function promoteAllSkipReason(
  item: Item | null, inQueue: boolean, categoryEnabled: boolean,
): string | null {
  if (item === null) return MISSING_MEMBER;
  if (item.layer !== 'project') {
    return 'belongs to the global layer, which is read-only from this project';
  }
  if (!inQueue) return `already ${item.status}`;
  if (!categoryEnabled) {
    return `category "${item.type}" is not enabled here, so it would never be injected`;
  }
  return null;
}

/** `rule 6   standard 4   constraint 2` — what the count above it is made of. */
function typeBreakdown(items: readonly Item[]): string {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
  return [...counts.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([type, n]) => `${type} ${n}`)
    .join('   ');
}

/**
 * The membership sentence, and the one thing this command cannot repair.
 *
 * `writeImportRecord` files `<packDir>/import.json` and `packDir` slugs the
 * pack's OWN name, so a second pack calling itself the same thing REPLACES the
 * first one's record — and that record is the membership list read here. By
 * the time this command runs the earlier list is gone; there is nothing to
 * reconstruct it from, and inventing one from the corpus would be guessing
 * which drafts a stranger's pack brought in.
 *
 * What is available is refusing to be quiet about it. The record is named by
 * the two facts that identify WHICH import it is — where it came from and
 * when — so a user with two packs of one name can see which one they are
 * promoting, and the replacement rule is stated rather than left to be
 * discovered. The direction the collision fails in is the safe one: a
 * membership list that has narrowed leaves the earlier pack's items in the
 * queue to be promoted one at a time, where one that had widened would promote
 * items nobody chose. `mycontext pack import --name <text>` is how a receiver
 * avoids the collision in the first place, and its own refusal says so.
 */
function membershipLine(out: Emit, record: ImportRecord): void {
  say(out,
    `this is the membership list \`mycontext pack list\` shows for ` +
    `${JSON.stringify(record.pack)}: ${record.items.length} item(s), imported ` +
    `${record.importedAt} from ${record.source}. A pack imported again under this name ` +
    'REPLACES that record, so what --all promotes is the most recent import\'s membership — ' +
    'anything an earlier pack of the same name brought in is not in it, and stays in the queue ' +
    'to be promoted one at a time.');
}

/**
 * `mycontext review promote --all --pack <name>`.
 *
 * Reached whenever either flag is present, so that every refusal above belongs
 * to this command rather than being reported as a missing id by the one-item
 * path — a bulk promote refused for "no id" would be refused for the one thing
 * it is not missing.
 */
function cmdPromoteAll(
  ws: Workspace, ctx: MutationContext, args: string[], id: string | null,
  errors: LoadError[], out: Emit,
): number {
  const all = hasFlag(args, 'all');
  const pack = flag(args, 'pack');

  if (!all) {
    say(out,
      'my_context: --pack names the pack whose drafts --all promotes, and means nothing on its ' +
      'own — a promotion of one item is named by its id. Nothing was promoted. Pass ' +
      '`--all --pack <name>` for the whole pack, or drop --pack and name the draft you mean.');
    return 1;
  }
  if (pack === null || pack === '') {
    say(out,
      'my_context: --all needs --pack <name>. There is no unbounded bulk promote here: the ' +
      'licence a bulk act can be given is for the corpus a human just chose to import, not for ' +
      'every draft in this workspace, which is why this is refused rather than defaulted. ' +
      '`mycontext pack list` names every pack imported here.');
    return 1;
  }
  if (id !== null) {
    say(out,
      `my_context: --all promotes a whole pack and ${id} names one draft, so this command line ` +
      'asks for two different promotions. Nothing was promoted. Drop --all to promote ' +
      `${id} alone, or drop the id to promote everything --pack names.`);
    return 1;
  }
  // Every occurrence, not just a resolved value: `--always=false` and an empty
  // `--scope=` were typed too, and a flag that was typed and changed nothing is
  // reported rather than swallowed.
  const perItem = ['scope', 'severity', 'always']
    .filter((name) => flagOccurrences(args, name).length > 0);
  if (perItem.length > 0) {
    say(out,
      `my_context: ${perItem.map((n) => `--${n}`).join(', ')} ` +
      `${perItem.length === 1 ? 'is refused' : 'are refused'} with --all. ` +
      'Each is a per-item decision, and applying one of them to every draft a pack imported is ' +
      'a bulk edit wearing a promotion\'s clothes — a field nobody chose per item, set on items ' +
      'nobody looked at one at a time. Nothing was promoted. Promote the pack, then edit the ' +
      'items that need it.');
    return 1;
  }

  const known = readImportRecords(ctx.root);
  const record = known.find((r) => r.pack === pack);
  if (!record) {
    say(out,
      `my_context: no pack named ${JSON.stringify(pack)} has been imported into this workspace, ` +
      'so there is no membership list to promote. ' + (known.length === 0
        ? '`mycontext pack list` says the same; `mycontext pack import <path>` reads one in.'
        : `Imported here: ${known.map((r) => JSON.stringify(r.pack)).join(', ')}. ` +
          '`mycontext pack list` shows each with its version, its size and where it came from.'));
    return 1;
  }

  // ONE call to the queue, for every member. `drafts` is `reviewQueue` ordered
  // for a human; membership is intersected with it rather than the filter being
  // re-derived here.
  const queue = new Set(drafts(ctx, null).map((i) => i.id));
  const promotable: Item[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const memberId of record.items) {
    const item = ctx.store.get(memberId);
    // `Object.hasOwn` for `resolveCategory`'s reason: a category named
    // `constructor` would otherwise resolve to Object.prototype.constructor.
    const enabled = item !== null
      && Object.hasOwn(ws.config.categories, item.type)
      && ws.config.categories[item.type].enabled;
    const reason = promoteAllSkipReason(item, queue.has(memberId), enabled);
    if (item === null || reason !== null) {
      skipped.push({ id: memberId, reason: reason ?? MISSING_MEMBER });
      continue;
    }
    promotable.push(item);
  }

  // The preview, printed before the gate and regardless of `--yes`:
  // `confirmAction` only asks its question on a TTY, so without this the
  // non-interactive refusal would never say what it declined.
  if (promotable.length > 0) {
    say(out,
      `about to promote ${promotable.length} draft(s) imported from pack ` +
      `${JSON.stringify(record.pack)} — every one becomes active and starts governing this ` +
      'project.');
    out(`  ${typeBreakdown(promotable)}`);
  }
  if (skipped.length > 0) {
    if (promotable.length > 0) out('');
    say(out,
      `skipping ${skipped.length} of the ${record.items.length} item(s) this pack imported:`);
    const width = Math.max(...skipped.map((s) => s.id.length));
    // A hanging indent, so a wrapped reason cannot be read as the next id's.
    const hang = `  ${' '.repeat(width + 2)}`;
    for (const s of skipped) {
      for (const line of paragraph(`${s.id.padEnd(width)}  ${s.reason}`, '  ', undefined, hang)) {
        out(line);
      }
    }
  }
  out('');
  membershipLine(out, record);

  if (promotable.length === 0) {
    say(out,
      `my_context: nothing to promote — not one of the ${record.items.length} item(s) pack ` +
      `${JSON.stringify(record.pack)} imported is a draft in this project's review queue. Every ` +
      'one is named above with its reason. Nothing was written.');
    emitLoadErrors(errors, out);
    return 0;
  }

  // The same disclosure the one-item path makes, once for the set: a human
  // promoting these is entitled to know that an agent's proposed text is not
  // what they are approving.
  // Asked ONCE for the set, not once per member: `pendingRevisions` reads the
  // revision log, and a forty-item pack would otherwise read it forty times.
  const revs = revisionQueue(ctx);
  const proposed = promotable.filter((i) => revs.some((r) => r.itemId === i.id));
  if (proposed.length > 0) {
    out('');
    say(out,
      `note: ${proposed.length} of these also carry a pending revision ` +
      `(${proposed.map((i) => i.id).join(', ')}) proposing new content. This promotion neither ` +
      'applies nor discards them — each item starts governing the text it has NOW. Read them ' +
      'with `mycontext review revisions`.');
  }

  out('');
  if (!confirmAction(
    args, out,
    `Promote ${promotable.length} draft(s) from ${JSON.stringify(record.pack)} to active? ` +
    'Every one starts governing this project.',
  )) return 1;

  const promoted: string[] = [];
  try {
    for (const item of promotable) {
      // The one-item path's call, unchanged: `origin: 'human'` is what makes
      // the status change legal, and it is true — a human answered one prompt
      // ago, for this set.
      updateItem(ctx, { id: item.id, status: 'active', origin: 'human' });
      promoted.push(item.id);
    }
  } catch (err) {
    // There is no transaction here. The partial state is NAMED rather than
    // left for the user to discover from a queue that shrank by an amount
    // nobody reported.
    out(err instanceof Error ? err.message : String(err));
    say(out,
      `${promoted.length} of the ${promotable.length} item(s) had already been promoted and are ` +
      `active${promoted.length === 0 ? '' : ` — ${promoted.join(', ')}`}. The rest are still ` +
      'drafts, and running this again promotes them.');
    emitLoadErrors(errors, out);
    return 1;
  }

  say(out,
    `my_context: ${promoted.length} item(s) from pack ${JSON.stringify(record.pack)} are now ` +
    `active — ${promoted.join(', ')}. Nothing else in the review queue was touched.`);
  emitLoadErrors(errors, out);
  return 0;
}

/**
 * `mycontext review revisions [<id>]` — the second queue, as diffs.
 *
 * With an id it narrows to one item and additionally lists that item's SETTLED
 * revisions, which is what makes `discardRevision`'s "the proposal is not
 * deleted" claim something a user can act on: the discard message names this
 * command, and `--full` prints the discarded text itself.
 *
 * The workspace-wide count sentence is printed either way, id or no id. A
 * narrowed view that reported only its own subset would be a fourth number for
 * this queue that disagrees with the other three by design, which is precisely
 * the confusion the single count spelling exists to prevent.
 */
function cmdRevisions(
  ctx: MutationContext, args: string[], id: string | null, errors: LoadError[], out: Emit,
): number {
  // An id this workspace has never heard of is REFUSED, before any queue is
  // reported. `review revisions TYPO-does-not-exist` used to exit 0 saying
  // "no revision is pending for TYPO-does-not-exist" and then "0 pending
  // revision(s) on 0 item(s) — nothing is waiting for a human here" — two
  // sentences that are individually parseable as true and together assert the
  // queue was checked for an item that does not exist. That is the
  // silent-empty-answer class Wave 1 closed for `mycontext list`, reintroduced
  // on a surface that additionally states the falsehood out loud rather than
  // merely staying quiet.
  //
  // The existence test is deliberately NOT `ctx.store.get(id)` alone. A
  // revision outlives its item — `decorate` (revision.ts) has an `itemMissing`
  // branch precisely for a proposal whose item was deleted underneath it, and
  // `missingItemRefusal` is the message for it — so an id with revision
  // history and no item is a real, answerable question and must not be refused
  // as a typo. Only an id that is in neither place is unknown.
  //
  // `unknownIdError` (teach.ts) rather than a fourth wording: it is the
  // spelling `requireItem` (mcp/tools.ts), `updateItem` and
  // `pickPendingRevision` already give an unknown id, and it carries the
  // closest match, which is the whole value of the answer on a typo.
  if (id !== null && !ctx.store.get(id) && revisionHistory(ctx, id).length === 0) {
    out(unknownIdError(id, ctx.store.all().map((i) => i.id)));
    // Reported even on the refusal path — the command failed at its own job,
    // so the exit code is 1, but the load error is never swallowed.
    emitLoadErrors(errors, out);
    return 1;
  }

  const all = revisionQueue(ctx);
  const detail = detailLevel(args);
  const shown = id === null ? all : all.filter((r) => r.itemId === id);
  const settled = id === null
    ? []
    : revisionHistory(ctx, id).filter((r) => r.state !== 'pending');

  if (wantsJson(args)) {
    emitJson(out, {
      ...(id === null ? {} : { itemId: id }),
      pendingRevisions: pendingRevisionCounts(all),
      revisions: shown.map((r) => ({
        revisionId: r.revisionId, itemId: r.itemId, origin: r.origin, stagedAt: r.stagedAt,
        changes: r.changes, base: r.base, current: r.current,
        changedSince: r.changedSince, stale: r.stale, itemMissing: r.itemMissing,
      })),
      settled: settled.map((r) => ({
        revisionId: r.revisionId, state: r.state, settledAt: r.settledAt, reason: r.reason,
        origin: r.origin, stagedAt: r.stagedAt, changes: r.changes, base: r.base,
      })),
      loadErrors: errors.map((e) => ({ file: e.file, message: e.message })),
    });
    return 0;
  }

  if (shown.length === 0) {
    out(id === null
      ? 'my_context: no revisions pending. Nothing has been proposed against a governing item.'
      : `my_context: no revision is pending for ${id}.`);
  } else if (detail === 'summary') {
    // `--summary` drops the diffs, never the queue: the count sentence below
    // is printed at every level.
  } else {
    for (const [i, rev] of shown.entries()) {
      if (i > 0) out('');
      const alsoPending = all.filter(
        (r) => r.itemId === rev.itemId && r.revisionId !== rev.revisionId,
      );
      for (const line of renderRevision(rev, { detail, alsoPending })) out(line);
    }
    out('');
  }

  if (settled.length > 0 && detail !== 'summary') {
    say(out, `${settled.length} settled revision(s) for ${id} — kept in full, never deleted` +
      (detail === 'full' ? ':' : ' (`--full` prints what each one proposed):'));
    for (const rev of settled) for (const line of renderSettled(rev, { detail })) out(line);
    out('');
  }

  // Unconditional, empty queue included: `pendingRevisionLine` owns both
  // wordings, so the count template is typed in exactly one place.
  say(out, pendingRevisionLine(all));
  emitLoadErrors(errors, out);
  return 0;
}

/**
 * `mycontext review promote-revision <id>` — a human applies an agent's
 * proposal.
 *
 * The preview is the whole point of the command: it prints the DIFF, at
 * `--full` detail, before the confirmation, so what is being approved is a
 * change to text rather than a revision id. `review promote`'s preview earned
 * the criticism that it omitted `always`; a diff that showed part of what is
 * changing would be the same defect, so `renderRevision` elides nothing.
 *
 * `--force` is the only way to promote a STALE revision, and it exists behind
 * two things, not one: this confirmation, and a second block showing the
 * human's intervening text that the promotion destroys. `promoteRevision` in
 * the store enforces neither — it is a library function whose doc comment says
 * the caller wiring it to a command is expected to show the human what they
 * are overwriting first. This is that caller.
 */
function cmdPromoteRevision(
  ctx: MutationContext, args: string[], id: string, errors: LoadError[], out: Emit,
): number {
  const revisionId = flag(args, 'revision') ?? undefined;
  const force = hasFlag(args, 'force');
  // Throws, with `pickPendingRevision`'s own wording, when this item has no
  // pending revision or none by that id — the same selection the promotion
  // itself performs, so the diff shown below is the change that will land.
  const pending = pickPendingRevision(ctx, id, revisionId, 'promote');
  const alsoPending = revisionQueue(ctx).filter(
    (r) => r.itemId === id && r.revisionId !== pending.revisionId,
  );

  // Both refusals precede the preview and the prompt. A human shown what a
  // promotion will do, asked to approve it, and only then told it was never
  // going to land is the ordering defect `review promote` was already fixed
  // for; and these are the store's own sentences, not second wordings.
  if (pending.itemMissing) { say(out, missingItemRefusal(ctx, id, pending)); return 1; }
  if (pending.stale && !force) {
    say(out, staleRefusal(id, pending));
    // The discard command is composed with `--revision` whenever OTHER
    // revisions are pending on this item, because the bare form is refused
    // there — a command a refusal tells the user to type must itself run.
    const named = alsoPending.length === 0 ? '' : ` --revision ${pending.revisionId}`;
    say(out, `Read it with \`mycontext review revisions ${id} --full\`, discard it with ` +
      `\`mycontext review discard-revision ${id}${named}\`, or pass --force to overwrite the ` +
      'newer text deliberately — which will show you exactly what it destroys before it asks.');
    return 1;
  }

  out('about to promote a staged revision:');
  for (const line of renderRevision(pending, { detail: 'full', alsoPending })) out(line);
  out('');
  // "the text this item has now", not "governs now": this command reaches
  // rationale items too, whenever a user sets `agentEdits: "review"` on one of
  // their categories, and a `lesson` governs nothing by the definition this
  // project gives the word. The legend's job is to say which side of the diff
  // is which, and that job needs no claim about injection.
  say(out, '`-` is the text this item has now and `+` is what the revision proposes; the ' +
    'promotion replaces the first with the second.');

  if (pending.stale) {
    out('');
    say(out, `--force: this revision is STALE. A human changed ${pending.changedSince.join(', ')} ` +
      'after it was staged, and promoting it DESTROYS that newer text. Here it is, so you are ' +
      'not approving a hash: `-` is what the item said when the revision was written, `+` is ' +
      'what a human has since made it say — and `+` is what will be lost.');
    for (const field of pending.changedSince) {
      for (const line of fieldDiff(field, pending.base[field], pending.current[field])) out(line);
    }
    out('');
  } else if (force) {
    // Never silently swallowed: a flag that was typed and changed nothing is
    // reported, per INV-nothing-is-dropped-silently.
    say(out, 'note: --force was passed, but this revision is not stale — nothing is being ' +
      'overwritten and the flag changed nothing.');
  }

  if (!confirmAction(
    args, out,
    pending.stale
      ? `Promote ${pending.revisionId} and OVERWRITE the newer ${pending.changedSince.join(', ')} ` +
        `on ${id}?`
      : `Promote ${pending.revisionId} — apply it to ${id}?`,
  )) return 1;

  const result = promoteRevision(ctx, id, { revisionId: pending.revisionId, force });
  say(out, result.message);
  emitLoadErrors(errors, out);
  return 0;
}

/**
 * `mycontext review discard-revision <id>` — a human rejects a proposal.
 *
 * The diff is printed before the confirmation here too: a rejection is a
 * decision about a change, and the store makes it final for this exact
 * proposal against this exact text (`stageRevision` refuses to re-stage a
 * settled proposal), so approving one by id would be the same defect as
 * approving a promotion by id.
 */
function cmdDiscardRevision(
  ctx: MutationContext, args: string[], id: string, errors: LoadError[], out: Emit,
): number {
  const revisionId = flag(args, 'revision') ?? undefined;
  const reason = flag(args, 'reason') ?? undefined;
  const pending = pickPendingRevision(ctx, id, revisionId, 'discard');

  out('about to discard a staged revision:');
  for (const line of renderRevision(pending, { detail: 'full' })) out(line);
  out('');
  say(out, `${id} is unchanged either way — discarding rejects the proposal, it does not touch ` +
    'the item.');

  if (!confirmAction(
    args, out, `Discard ${pending.revisionId} for ${id}? The proposed ` +
    `${changedFields(pending.changes).join(', ')} will not be applied.`,
  )) return 1;

  const result = discardRevision(ctx, id, { revisionId: pending.revisionId, reason });
  say(out, result.message);
  emitLoadErrors(errors, out);
  return 0;
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

/**
 * Reads one line synchronously from fd 0, byte by byte. Node has no built-in
 * synchronous line reader and this module must stay dependency-free.
 * `EAGAIN` is retried rather than treated as end-of-input: a TTY's fd 0 can
 * be opened non-blocking depending on how the parent process spawned this
 * one, and silently treating that as "no answer" would refuse every prompt
 * on such a terminal regardless of what the human typed.
 *
 * Exported so a command whose gate needs wording of its OWN can prompt with
 * this reader rather than growing a second copy of the loop — see
 * `approveOverwrite` in `cli/commands/pack.ts`, which cannot borrow
 * `confirmAction` because declining that gate is not an error and does not
 * abort what it was asked about.
 */
export function readLineSync(): string {
  const buf = Buffer.alloc(1);
  let line = '';
  for (;;) {
    let n: number;
    try {
      n = readSync(0, buf, 0, 1, null);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EAGAIN') continue;
      break;
    }
    if (n === 0) break;
    const ch = buf.toString('utf8');
    if (ch === '\n') break;
    line += ch;
  }
  return line.replace(/\r$/, '');
}

/**
 * The confirmation gate for `promote` and `discard` (Task 10 review ruling).
 * This command replaced an awkward manual `status:` edit with an ergonomic,
 * bare, one-word verb — without an explicit confirmation step ahead of the
 * write, the promotion boundary would be exactly as strong as the harness's
 * Bash allowlist and no stronger, and the human-in-the-loop assumption this
 * whole draft mechanism rests on would be nowhere visible: the printed
 * preview is output, not a gate, and scrolls past in captured stdout nobody
 * necessarily reads.
 *
 * This is deliberately NOT a security boundary: a caller that can already
 * run `mycontext` can pass `--yes`. What it buys is an explicit, greppable
 * act that shows up in a transcript instead of a bare verb that reads as
 * self-authorizing.
 *
 * `isTTY`/`readLine` default to the real process but are accepted as
 * parameters so this can be unit-tested without a real pty.
 */
export function confirmAction(
  args: string[],
  out: Emit,
  question: string,
  isTTY: boolean = Boolean(process.stdin.isTTY),
  readLine: () => string = readLineSync,
): boolean {
  if (hasFlag(args, 'yes')) return true;
  if (!isTTY) {
    out(
      'my_context: refusing without confirmation — stdin is not interactive. ' +
      'Rerun with --yes to confirm, or run this from an interactive terminal.',
    );
    return false;
  }
  out(`${question} [y/N] `);
  const answer = readLine().trim().toLowerCase();
  if (answer === 'y' || answer === 'yes') return true;
  out('my_context: not confirmed. Nothing changed.');
  return false;
}

function cmdReview(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  const valueFlags = ['type', 'scope', 'severity', 'revision', 'reason', 'pack'];
  const [subcommand = 'list', id] = positionals(args, valueFlags);

  if (!(SUBCOMMANDS as readonly string[]).includes(subcommand)) {
    out(`my_context: unknown review subcommand "${subcommand}".\n\n${USAGE}`);
    return 1;
  }

  // Refused before the corpus is opened and before any preview or prompt —
  // see `unknownFlag` (format.ts) and `REVIEW_FLAGS` above. `review list
  // --ful` used to print the queue at the default detail and exit 0.
  const { allowed, values } = REVIEW_FLAGS[subcommand];
  if (refuseUnknownFlag(args, allowed, values, USAGE, out)) return 1;

  const { ctx, errors } = openMutateContext(ws);
  try {
    if (subcommand === 'list') {
      const type = flag(args, 'type');
      const queue = drafts(ctx, type);
      const detail = detailLevel(args);
      // The second queue, reported on EVERY path through `list` — including
      // the empty-draft-queue one, which otherwise says "no drafts pending
      // review" to a workspace that has proposals waiting, and the `--summary`
      // one, where a shorter report may drop rows but never a whole queue.
      // `--type` deliberately does not filter it: it selects a category of
      // DRAFT, and silently narrowing a different queue by it would make this
      // number disagree with the same number in `status`.
      const revs = revisionQueue(ctx);

      if (wantsJson(args)) {
        // The queue is what a reviewer scripts against — "show me every
        // ingest-origin draft from this document" — so it carries the fields
        // no column has room for, load errors included (inside the document,
        // so it stays parseable).
        emitJson(out, {
          drafts: queue.map((i) => ({
            id: i.id, type: i.type, title: i.title, origin: i.origin, severity: i.severity,
            always: i.always, scope: i.scope, tags: i.tags,
            sourceFile: i.sourceFile, sourceAnchor: i.sourceAnchor, body: i.body,
          })),
          count: queue.length,
          // The same two numbers `pendingRevisionCounts` gives every other
          // surface, under the same key on `review revisions --json` and
          // `status --json`. A script reading one of the three reads all three.
          pendingRevisions: pendingRevisionCounts(revs),
          loadErrors: errors.map((e) => ({ file: e.file, message: e.message })),
        });
        return 0;
      }

      if (queue.length && detail === 'summary') {
        out(`${queue.length} draft(s) pending. Promote with \`mycontext review promote <id>\`.`);
        emitRevisionQueue(revs, queue, out);
        emitLoadErrors(errors, out);
        return 0;
      }

      if (queue.length === 0) {
        out(type
          ? `my_context: no drafts of type "${type}".`
          : 'my_context: no drafts pending review.');
        emitRevisionQueue(revs, queue, out);
        // F2 (context.ts's doc comment on openMutateContext): `list` did what
        // it was asked — reported the (empty) queue — so an unrelated corpus
        // load error is a warning, not a failure. Only `status`/`doctor`
        // exit non-zero on one; every command that did its job exits 0,
        // including this one and — critically — `promote` and `discard`
        // below, which perform a real, persisted write before this point.
        emitLoadErrors(errors, out);
        return 0;
      }
      // Headers and fitted widths, replacing four hardcoded `padEnd` calls
      // whose 44-char id column collided on this repo's real ids (63 chars).
      //
      // `always` is a column at BOTH detail levels, not just `--full`: it is
      // the field with the largest injection footprint (pinned tier, injected
      // in full at every session start regardless of scope) and a draft can
      // already carry it — `guardedChange` (core/trust.ts) only fires on an item
      // that already governs, and a draft governs nothing, so an agent can set
      // it on its own draft. A reviewer who never sees the column cannot know
      // that promoting this entry pins it.
      //
      // `--full` is a stanza per draft, not a wider table — the same shape
      // `list --full` and `decay --full` render, for the same arithmetic
      // (`records`, format.ts). A table can never be narrower than the sum of
      // its columns' longest tokens, and an id is one token: eight columns
      // beside a maximum-length id (a six-character category prefix plus
      // `slugify`'s sixty-character ceiling) measured 210 columns, so the
      // level that shows the MOST about a draft was the one level a reviewer
      // could not read. As a record view the id is a heading on its own line
      // and every other field is labelled beneath it, so the width depends on
      // the id only through that one heading line, which even a
      // maximum-length id fills to just 67 of the 100 columns. Same fields,
      // same order, nothing dropped.
      const lines = detail === 'full'
        // `revisions` is a field here and a summary line below the table at the
        // scanning levels, for the width reason the whole `--full` shape
        // exists: a record view has room to say WHICH revision is pending on
        // this draft, and a table does not.
        ? records(
          ['id', 'type', 'origin', 'severity', 'always', 'scope', 'source', 'revisions', 'title'],
          queue.map((i) => [
            i.id, i.type, i.origin, i.severity, i.always ? 'yes' : 'no',
            // `always` has its own column here, so this is the scope alone —
            // but the EMPTY case is the shared spelling, not a local `-`.
            scopeField(i.scope, scopePolicyFor(ws.config, i.type)),
            i.sourceFile ?? '-', draftRevisionField(revs, i.id), i.title,
          ]),
        )
        // `title` stays at the scanning level here, unlike `list` and `decay`.
        // Those two dropped it because the id and the title are one fact in
        // the two widest columns and together put those reports at 192 and 170
        // columns against a 100-column budget (`OUTPUT_WIDTH`, format.ts). This
        // table's other columns are narrow enums, so on the ids a real queue
        // holds it fits the budget with the title in place. It does not fit at
        // every id: on the widest id this project can mint (a six-character
        // category prefix plus `slugify`'s sixty-character ceiling) this table
        // measures 112 columns with the `title` column deleted outright, so
        // dropping the title would not rescue that case either — it is a limit
        // on id length, not on this column set. `--full` above avoids
        // it entirely by not being a table. The duplication argument alone
        // never justified removing a column — the width did — and a reviewer
        // deciding whether to open a draft reads the words, not the slug.
        : table(
          ['id', 'type', 'origin', 'always', 'source', 'title'],
          queue.map((i) => [
            i.id, i.type, i.origin, i.always ? 'yes' : 'no', i.sourceFile ?? '-', i.title,
          ]),
        );
      for (const line of lines) out(line);
      out('');
      out(`${queue.length} draft(s) pending. Promote with \`mycontext review promote <id>\`.`);
      emitRevisionQueue(revs, queue, out);
      emitLoadErrors(errors, out);
      return 0;
    }

    if (subcommand === 'revisions') return cmdRevisions(ctx, args, id ?? null, errors, out);

    if (REVISION_SUBCOMMANDS.includes(subcommand)) {
      if (!id) { out(USAGE); return 1; }
      return subcommand === 'promote-revision'
        ? cmdPromoteRevision(ctx, args, id, errors, out)
        : cmdDiscardRevision(ctx, args, id, errors, out);
    }

    // Before the missing-id refusal, because the bulk form has no id by
    // design: `review promote --all --pack x` answered with the usage block
    // would be refused for the one thing it is not missing. Entered whenever
    // either flag is PRESENT — `--pack` typed alone reaches its own refusal
    // here rather than being consumed as a value flag and forgotten.
    if (subcommand === 'promote'
      && (hasFlag(args, 'all') || flagOccurrences(args, 'pack').length > 0)) {
      return cmdPromoteAll(ws, ctx, args, id ?? null, errors, out);
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
      return 0;
    }

    // Every remaining check below (draft status, layer, category, severity)
    // runs BEFORE anything is printed or confirmed — a refusal must never be
    // preceded by "about to promote", and a refusal on a global-layer item
    // must arrive before any preview, not after one.
    if (item.status !== 'draft') {
      out(
        `my_context: ${item.id} is "${item.status}", not "draft". ` +
        `review only drafts; use \`mycontext show ${item.id}\` to inspect it.`,
      );
      return 1;
    }

    if (item.layer !== 'project') {
      out(
        `my_context: ${item.id} belongs to the global layer and cannot be promoted or discarded ` +
        `from this project — global items are read-only here. See mycontext_help("categories").`,
      );
      return 1;
    }

    if (subcommand === 'discard') {
      emitDraftRevisionNote(ctx, item, subcommand, out);
      if (!confirmAction(
        args, out,
        `Discard ${item.id} (${item.type}: "${item.title}") — sets status to deprecated?`,
      )) return 1;
      // `origin: 'human'` is required, not decorative: updateItem refuses a
      // status change on a normative item from any non-human origin.
      updateItem(ctx, { id: item.id, status: 'deprecated', origin: 'human' });
      out(`my_context: ${item.id} is now deprecated. It is kept as a trail rather than deleted.`);
      emitLoadErrors(errors, out);
      return 0;
    }

    // promote — Object.hasOwn: `ws.config.categories[item.type]` on a type
    // of "constructor" would otherwise resolve to Object.prototype.constructor
    // instead of reporting "not enabled" — the same prototype-pollution
    // hazard `resolveCategory` (mutate.ts) and `tierOf` (trust.ts) already guard against.
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

    // Validated up front, before the preview or the confirmation prompt: a
    // garbled --severity must refuse loudly, not be silently discarded while
    // the rest of the promotion proceeds as if nothing was asked for it.
    const severity = flag(args, 'severity');
    if (severity !== null && !(SEVERITIES as string[]).includes(severity)) {
      // `enumError` and `SEVERITIES` (mutate.ts) rather than a hand-written
      // sentence: `create_item`, `update_item` and `mycontext add --severity`
      // all refuse a bad severity in exactly these words, and a fourth
      // wording here would be a second vocabulary for one enum.
      out(enumError('severity', severity, SEVERITIES, 'capture'));
      return 1;
    }

    // The patch is assembled BEFORE the preview so the preview can show the
    // values this promotion will actually write, rather than the draft's
    // stored ones — `--scope`, `--severity` and `--always` all override. No
    // write happens here; `updateItem` is still called only after the
    // confirmation below.
    //
    // `updateItem` takes ONE object, id included — there is no (ctx, id, patch)
    // overload — and `origin: 'human'` is what makes the status change legal.
    const patch: UpdateInput = { id: item.id, status: 'active', origin: 'human' };
    // `listFlag`, not `flag`: `--scope a/** --scope b/**` used to promote with
    // `a/**` alone and report success, the same first-occurrence-wins drop
    // `mycontext add --scope` was fixed for. It unions every occurrence and
    // still splits each on commas, so both spellings compose.
    const scope = listFlag(args, 'scope');
    if (scope !== null) patch.scope = scope;
    if (severity !== null) patch.severity = severity as Severity;
    // `hasFlag`, not `args.includes('--always')`: the latter misses the
    // `--always=true` form that every other flag in this CLI accepts (see
    // registry.ts's `flag`/`hasFlag`). Note it can only ever SET `always`:
    // there is no `--no-always`, so a draft that already carries `always:
    // true` stays pinned whether or not the flag is passed.
    const alwaysFromFlag = hasFlag(args, 'always');
    if (alwaysFromFlag) patch.always = true;

    const willBeAlways = patch.always ?? item.always;
    const willBeScope = patch.scope ?? item.scope;

    // Spec §3: `always` and `severity` govern only on the normative tier, so
    // asking for either on a rationale draft is a silent drop through a
    // different door. Its own call rather than leaving it to `updateItem`
    // below, purely for ORDERING — the refusal must precede the preview and
    // the confirmation prompt, or a human is shown what the promotion will do
    // and asked to approve it, and only then told it was never going to land.
    // `cmdAdd`'s `scopeRequirementError` call is the same pattern: one
    // function (`inertFieldError`, mutate.ts) owns the rule and the wording;
    // this duplicates the CALL, not the rule.
    //
    // Gated on the FLAG being typed, which is deliberately stricter than
    // `updateItem`'s own condition (`input.always === true && !item.always`)
    // and is the one place the two rules differ on purpose. `updateItem`
    // tolerates an unchanged value because its callers are programs echoing
    // back a field they just read; nothing echoes here — every flag on this
    // command was typed by a human, so `--always` is an assertion even when
    // the draft already carries the flag, and accepting it silently would be
    // the drop this task exists to close. Verified by execution: without
    // this, `review promote <rationale draft> --always` on a draft that
    // already stored `always: true` printed the preview and promoted.
    //
    // It strands nothing: promoting the same draft WITHOUT the flag works,
    // and that case — where the human asserted nothing — is told the truth by
    // the preview instead of being refused.
    if (alwaysFromFlag) {
      const refusal = inertFieldError(category, 'always', 'edit');
      if (refusal) { out(refusal); return 1; }
    }
    if (severity === 'hard') {
      const refusal = inertFieldError(category, 'severity', 'edit');
      if (refusal) { out(refusal); return 1; }
    }
    // What `always: true` actually means for THIS item's tier. Shared with
    // nothing else today, but it is the one place the two answers are written
    // down — see `alwaysInjection` (render-item.ts) for why they cannot share
    // a sentence.
    const pin = alwaysInjection(category.tier);

    // `promote` is the trust boundary this whole draft mechanism exists to
    // gate — a human is about to make this item govern. Print id, type,
    // title, severity, always, scope and the body before acting, and before
    // asking for confirmation, so a promotion by id alone is never mistaken
    // for a rule: the human sees what they are approving, not just an
    // identifier.
    //
    // `always` is on this list because it has the largest injection footprint
    // of any field — it puts the item in the pinned tier, injected in full at
    // every session start regardless of scope — and it can arrive without the
    // human ever typing it: a draft can already carry `always: true` (nothing
    // guards that, since `guardedChange` in core/trust.ts only fires on an item
    // that already governs, and a draft governs nothing), so an agent can pin
    // its own draft. Without this line the human promoting it never sees it.
    emitDraftRevisionNote(ctx, item, subcommand, out);

    out('about to promote:');
    out(`  id       ${item.id}`);
    out(`  type     ${item.type}`);
    out(`  title    ${item.title}`);
    out(`  severity ${patch.severity ?? item.severity}`);
    out(`  always   ${willBeAlways ? 'yes' : 'no'}${willBeAlways
      ? ` (${item.always ? 'carried by the draft itself' : 'from --always'}) — ${pin.phrase}`
      : ''}`);
    out(`  scope    ${scopeField(willBeScope, scopePolicyFor(ws.config, item.type), ', ')}`);
    out('');
    out(item.body || '(no body)');
    out('');

    if (!confirmAction(args, out, `Promote ${item.id} to active?`)) return 1;

    updateItem(ctx, patch);
    // MutationResult carries no `.item`; the written item comes back from the
    // store, which updateItem has already upserted the new scope into.
    const updated = ctx.store.get(item.id) as Item;
    // `always` items are admitted to the pinned tier with NO scope check
    // (select.ts's `fitToBudget(fresh.filter((i) => i.always), ...)`), so the
    // pinned wording must win over the scope wording below: an unscoped
    // `always` item arrives at every session start, not merely on a file
    // operation.
    //
    // The two pinned wordings are not interchangeable: `--always` can only
    // ever set the flag, never clear it, so an item can be pinned here
    // WITHOUT the human having typed anything. Saying "via --always" in that
    // case would assert an act the human did not perform — the reason
    // `item.always` (the draft's own stored flag, read before the write) is
    // the discriminator rather than `updated.always`, which is true either way.
    // Tier FIRST, mirroring `select`'s own order (`eligible.filter(isNormative)`
    // before anything reads `always` or `scope`) and `mycontext supersede`'s
    // preview, which was written this way from the start. Every branch below
    // this line promises an injection, and not one of them is true on the
    // rationale tier — so a rationale draft promoted while carrying
    // `always: true` used to be reported as "pinned … injected at every
    // session start" for an item that is injected nowhere.
    const scoping = category.tier !== 'normative'
      ? RATIONALE_NOT_INJECTED
      : updated.always
      ? (item.always
        ? 'pinned — the draft itself carried `always: true`; injected at every session start ' +
          'regardless of scope'
        : 'pinned via --always — injected at every session start regardless of scope')
      : updated.scope.length
        ? `scope ${updated.scope.join(', ')} — injected when work touches those paths`
        // What an empty scope means for injection is per-category config, not
        // a constant — `emptyScopeInjection` (render-item.ts) is the one
        // definition, shared with `mycontext supersede`'s preview. Under
        // `scopePolicy: "inert"` this line used to promise an injection that
        // will never happen.
        : emptyScopeInjection(scopePolicyFor(ws.config, item.type)).phrase;
    out(`my_context: ${item.id} is now active (${scoping}).`);
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
  name: 'review',
  // Derived from SUBCOMMANDS, not restated: see its comment. `list` is the
  // default, hence the brackets and its position first.
  //
  // Seven names make this `--help` row 149 columns, which is wide for a row
  // meant to be scanned beside twenty others — and it stays, because the
  // alternative was tried and is worse. Naming no subcommand here (`review
  // [<subcommand>]`) drops `list` out of `--help` altogether, and "the short
  // spelling omits the DEFAULT subcommand, so `mycontext review` reads as
  // invalid" is the exact defect this derivation was introduced to fix. The
  // test that catches that is `every subcommand review accepts is named in
  // both spellings of its usage`, and it caught this attempt.
  usage: `review [${SUBCOMMANDS.join('|')}] [<id>]`,
  // Both queues, because as of Task 6 this command walks two: drafts waiting
  // to govern, and revisions proposing new text for items that already do.
  summary: 'walk the draft and revision queues and settle what should govern',
  run: cmdReview,
});
