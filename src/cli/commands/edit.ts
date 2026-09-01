import type { UpdatableName } from '../../core/categories.ts';
import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import { EDIT_FLAGS, declaredEditFlags, isEditFlag } from '../../core/edit-flags.ts';
import { scopePolicyFor, type Config } from '../../core/config.ts';
import { normalizePosix } from '../../core/paths.ts';
import { updateItem, type MutationContext, type UpdateInput } from '../../core/mutate.ts';
import { globalLayerRefusal } from '../../core/persist.ts';
import {
  missingRelationRefusal, retirementEdgeRefusal, unlinkItems,
} from '../../core/relations.ts';
import {
  handWrittenProjectionError, projectFieldUpdate, updatableFor, updatesFor,
} from '../../core/tag-projection.ts';
import {
  summaryReaffirmed, summaryRequired, summaryRequiredRefusal, summaryUnchangedRefusal,
} from '../../core/summary-gate.ts';
import { summaryState } from '../../core/content-hash.ts';
import { inertFieldError, scopeRequirementError } from '../../core/trust.ts';
import {
  SEVERITIES, STATUSES, normalizeSummary, updatableValueError, validateExtra, validateSummary,
} from '../../core/validate.ts';
import { scopeField } from '../../core/render-item.ts';
import { extraFlag } from './registry.ts';
import {
  pendingRevisions, type PendingRevision, type RevisionField, type RevisionValue,
} from '../../core/revision.ts';
import { enumError } from '../../core/teach.ts';
import type { Item, Severity, Status, Tier } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext } from './context.ts';
import { paragraph, refuseUnknownFlag } from './format.ts';
import { injection } from './injection.ts';
import { confirmAction } from './review.ts';
import { fieldDiff } from './revision-view.ts';
import {
  boolFlag, flag, flagOccurrences, listFlag, positionals, registerCommand, type Emit,
} from './registry.ts';

/**
 * `mycontext edit` — the human route to changing an item, which this project
 * did not have.
 *
 * `update_item` is the model's tool and refuses a governing item's
 * scope/always/severity/status outright, correctly: those are human decisions.
 * The human it deferred to then had no command to make them with. The only
 * remaining route was to hand-edit the Markdown and run `mycontext repair` —
 * which the plugin's own `PreToolUse` hook blocks the model from taking, which
 * leaves no record that it happened, and which a recorded requirement says the
 * documentation must never instruct. `origin: 'human'` at the `updateItem`
 * call below is what makes this command the answer to that refusal rather than
 * a second copy of it.
 *
 * **The gate scales with what the edit can actually do (spec §2).** A single
 * confirmation for every case would be wrong twice over: ceremony on changes
 * that cannot matter, and no ceremony on the ones that can.
 *
 *   | case                                     | gate                       |
 *   |------------------------------------------|----------------------------|
 *   | rationale item, content                   | none                       |
 *   | rationale item, `always`/`severity` up    | refused (spec §3)          |
 *   | normative draft, anything that leaves it a draft | none — nothing governs before or after |
 *   | normative draft → `active`/`validated`    | preview showing what governs before AND after, then confirm |
 *   | normative active/validated, content       | preview, then confirm      |
 *   | normative active/validated, reach/force   | preview showing what governs before AND after, then confirm |
 *
 * `FIELD_CLASS` says which field is in which class, and `gateFor` is the one
 * place those rows are decided — including the fourth, which is the row this
 * command was missing: the gate is computed from the state the edit RESULTS in
 * as well as the one it starts from.
 */

/** The flags this command accepts, and the value-taking subset. `always`,
 * `continuity` and `yes` are switches (`--always=false` unpins — see
 * `boolFlag`; `--continuity=false` takes an item off the continuity tier the
 * same way). */
/**
 * This command's own eleven, and the seven of them that take a value — moved
 * to `core/edit-flags.ts` by plan:builder seq:2b and bound back here.
 *
 * `edit` is still the one command with no static entry in `COMMAND_FLAGS`, and
 * the reason is unchanged: its ACCEPTED set is these plus whatever flags this
 * project's categories declare, which no static record can state. What moved is
 * the RESOLUTION — `editFlagSurface(config)` — so that a read surface can be
 * told what this workspace accepts without importing a module that writes.
 */
const { allowed: ALLOWED, values: VALUE_FLAGS } = EDIT_FLAGS;

const USAGE =
  `usage: mycontext edit <id> [--title "<text>"] [--body "<text>"] [--summary "<text>"]
                        [--summary-unchanged] [--scope "a/**,b/**"]
                        [--tags "a,b"] [--severity hard|soft] [--always[=false]]
                        [--continuity[=false]]
                        [--status active|draft|deprecated|validated]
                        [--extra key=value] [--unlink <relation> <target>] [--yes]`;

/* -------------------------------------------------------------------------- *
 * What may be changed, READ off the declaration rather than spelled here.
 *
 * REQ-…-the-cli-refusals-read-the-declaration: five rules of this command were
 * each learned by trying something and reading the refusal — `--severity hard`
 * being refused on the rationale tier, `always` having two spellings, `--tags`
 * replacing the whole list, `source_file` having no command at all, and `state`
 * on a task being a TAG rather than a field. Every one of them is now declared
 * (`TIER_UPDATES` and `CategoryDef.updates`, categories.ts; `updates` in
 * config.json, config.ts), so the refusals below are COMPOSED from that
 * declaration. Guidance and behaviour cannot disagree if there is only one of
 * them, and a category added tomorrow cannot leave a refusal behind.
 * -------------------------------------------------------------------------- */

/**
 * `isEditFlag` and `declaredFlags` moved to `core/edit-flags.ts` with
 * plan:builder seq:2b, and `declaredEditFlags` is the same function under the
 * name it needed once it was not inside `edit`. Their reasoning moved with
 * them; what stayed is every refusal that reads a declaration, below.
 */

/** The usage block with the declared flags appended, so a person reads them
 * BEFORE the attempt rather than out of the refusal that follows one. */
function usageFor(declared: string[]): string {
  if (declared.length === 0) return USAGE;
  // The same 24 columns the three continuation lines of `USAGE` are written
  // to: a derived line indented to anything else reads as a different block.
  const indent = ' '.repeat(24);
  return [USAGE, ...paragraph(declared.map((n) => `[--${n} <value>]`).join(' '), indent)].join('\n');
}

/**
 * A declared flag typed at an item whose category does not declare it.
 *
 * Every clause is read off the declaration — which category owns the name, and
 * what this one declares of its own — for the reason the block comment above
 * gives, and it is shaped like `unknownExtraFieldError` (trust.ts) because it
 * answers the same question one field further out: not "is this value legal"
 * but "is this name yours at all".
 */
function undeclaredFlagError(config: Config, type: string, name: string): string {
  const owners = Object.values(config.categories)
    .filter((c) => {
      const decl = updatableFor(config, c.name, name);
      return decl !== null && isEditFlag(name, decl);
    })
    .map((c) => c.name)
    .sort();
  const own = Object.hasOwn(config.categories, type)
    ? Object.keys(config.categories[type].updates)
    : [];
  const declares = own.length > 0
    ? `A "${type}" declares its own: ${own.join(', ')}.`
    : `A "${type}" declares no names of its own — what may be changed on one is exactly what ` +
      `its tier declares.`;
  const elsewhere = owners.length > 0
    ? ` "--${name}" is declared by ${owners.join(', ')}.`
    : '';
  return (
    `my_context: "--${name}" is not something a "${type}" declares, so it would be stored on ` +
    `an item whose category never promises it and read back by nothing. ${declares}${elsewhere} ` +
    `Nothing was changed. Run \`mycontext examples ${type}\` for everything this category ` +
    `declares, and the command each one is changed with. See mycontext_help("categories").`
  );
}

/**
 * The three classes spec §2 decomposes an edit into, and the whole reason this
 * command is not one gate.
 *
 *  - **content** changes what the agent is told, or told about.
 *  - **reach** decides which files activate the item.
 *  - **force** decides how strongly it binds, and whether it binds at all.
 *
 * `status` is FORCE rather than a class of its own: on a normative item it is
 * what decides whether the item is injected at all, which is the strongest
 * version of what `severity` does weakly.
 */
type FieldClass = 'content' | 'reach' | 'force';

const FIELD_CLASS: Record<string, FieldClass> = {
  // `summary` is CONTENT, not reach and not force: it changes what a reader is
  // TOLD about the item and nothing about whether, where or how strongly the
  // item is injected — `renderItemBlock` and `renderIndexLine` do not emit it
  // at all. So it is previewed as a diff and gated exactly as a title or a
  // body is, which is also what `UPDATE_FIELD_POLICY` (trust.ts) classifies it
  // as; the two tables agree because they are answering the same question.
  title: 'content', body: 'content', summary: 'content', tags: 'content', extra: 'content',
  // `summary_of` is the STAMP, and it is CONTENT for the same reason `summary`
  // is: moving it is what takes the STALE marker off the sentence, and that
  // marker is part of what a reader is told about the item — arguably the most
  // load-bearing part, since it is the difference between a sentence that may
  // be quoted and one that may not. It is here rather than absent because a
  // re-affirmation moves it while moving no other field (`changesOf`), and a
  // field class is what `gateFor` reads: filing it as reach or force would
  // print the "what governs before and after" block over a change that governs
  // nothing.
  summary_of: 'content',
  // `relations` is REACH, and the classification is the whole gate on
  // `--unlink`. Removing a `blocks` or a `constrains` from a governing item
  // takes away part of what that item asserts about the rest of the corpus,
  // which weakens it the way emptying its scope does — and `guardedChange`
  // refuses to let an agent make that change at all. Filing it under `content`
  // would have made the removal ungated on exactly the items where it does the
  // most, which is the mistake `gateFor` was rewritten to stop making.
  relations: 'reach',
  scope: 'reach', always: 'reach',
  // REACH, like `always` and `scope`: it decides whether the item reaches a
  // session at all, and taking it off the continuity tier is exactly the
  // silent narrowing `gateFor` exists to gate.
  continuity: 'reach',
  severity: 'force', status: 'force',
};

/** One field this edit would actually change, with both of its values. */
interface FieldChange {
  field: string;
  klass: FieldClass;
  /** The current and proposed values, already rendered for the "x -> y" line
   * a reach or force field gets. */
  before: string;
  after: string;
  /**
   * The same two values UNRENDERED, for the content fields, which are shown as
   * a diff instead. `fieldDiff` (revision-view.ts) is the one renderer of "this
   * text becomes that text" in this CLI and it takes the values themselves —
   * handing it re-parsed display strings is how a tags diff came to be built by
   * splitting a comma-joined label back apart.
   */
  from?: RevisionValue;
  to?: RevisionValue;
}

/**
 * The item as this edit would leave it, for the fields `injection` reads.
 *
 * Built rather than predicted: the "after" line of the preview asks
 * `injection` the identical question about this shape that it asks about the
 * stored item, so the two phrases are produced by one function and cannot
 * disagree about what "injected" means. Anything else would be a second,
 * hand-written model of `select`'s order — which is exactly the mistake
 * `injection`'s own doc comment records.
 */
function afterShape(
  item: Item, patch: UpdateInput,
): Pick<Item, 'type' | 'status' | 'always' | 'continuity' | 'scope'> {
  return {
    type: item.type,
    status: patch.status ?? item.status,
    always: patch.always ?? item.always,
    continuity: patch.continuity ?? item.continuity,
    // `normalizePosix` because `updateItem` normalizes on the way in: the
    // preview must show the globs that will be WRITTEN, not the ones typed.
    scope: patch.scope === undefined ? item.scope : patch.scope.map((g) => normalizePosix(g)),
  };
}

/** Order-insensitive equality for the two fields that are sets rather than
 * sequences — the same rule `sameStringSet` applies in mutate.ts and
 * `sameValue` in revision.ts, so a reordering is not a change at any of them. */
function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const [sa, sb] = [[...a].sort(), [...b].sort()];
  return sa.every((v, i) => v === sb[i]);
}

/**
 * Which fields this edit would actually CHANGE, and how each one reads.
 *
 * An echo is not a change — the same rule `guardedChange` and `contentChange`
 * (mutate.ts) apply — and here it decides whether a human is asked to confirm
 * anything at all. `mycontext edit <id> --severity soft` on an item that is
 * already soft must not print a preview of a change and ask for approval of
 * it; there is nothing to approve.
 */
function changesOf(item: Item, patch: UpdateInput, scopeLabel: (globs: string[]) => string): FieldChange[] {
  const changes: FieldChange[] = [];
  const add = (field: string, before: string, after: string): void => {
    changes.push({ field, klass: FIELD_CLASS[field], before, after });
  };
  const addContent = (field: string, from: RevisionValue, to: RevisionValue): void => {
    changes.push({ field, klass: FIELD_CLASS[field], before: '', after: '', from, to });
  };
  if (patch.title !== undefined && patch.title !== item.title) {
    addContent('title', item.title, patch.title);
  }
  if (patch.body !== undefined && patch.body !== item.body) addContent('body', item.body, patch.body);
  // `item.summary ?? ''` on the "before" side, and `''` is what `--summary=`
  // puts on the "after" side: absence is spelled as the empty string wherever
  // a summary is compared or diffed (`RevisionChanges.summary`), and
  // `valueLines` renders that as `(no summary)` rather than as a blank line.
  // So both directions preview honestly — adding one to an item that has none,
  // and removing the one it has.
  if (patch.summary !== undefined && patch.summary !== (item.summary ?? '')) {
    addContent('summary', item.summary ?? '', patch.summary);
  }
  // **The RE-AFFIRMATION, and it is the change this function used to miss.**
  //
  // Every case above asks "does this edit leave a FIELD OF THE ITEM reading
  // differently?" — and for the summary the answer is no when the sentence is
  // passed back verbatim. But the write still moves `summary_of`, which is what
  // takes a stale summary back to current, so "nothing to change" below was a
  // false report of a real change and the one honest way to clear a still-true
  // stale summary was closed by it. See `summaryReaffirmed` (summary-gate.ts):
  // it is exclusive with the diff above, because a summary is either the stored
  // one or new text.
  //
  // Rendered as a labelled line rather than as a diff, because a diff of a
  // sentence against itself shows the reader nothing and would suggest a
  // rewrite that is not happening. The line says what actually moves: the
  // basis, from whatever `mycontext show` and `doctor` have been calling it, to
  // a re-affirmation of the sentence already on the item.
  if (summaryReaffirmed(item, patch)) {
    add('summary_of', summaryState(item), 're-affirmed, and the sentence is unchanged');
  }
  if (patch.tags !== undefined && !sameSet(patch.tags, item.tags)) {
    addContent('tags', item.tags, patch.tags);
  }
  // Narrowed to the keys that actually MOVE, matching `contentChange`
  // (mutate.ts) and `normalizeChanges` (revision.ts), which narrow identically:
  // `updateItem` merges `extra`, so a key passed at the value it already has is
  // not a change and must not put a human in front of a confirmation prompt.
  // `Object.hasOwn`, not a bare index, for the prototype-safety reason
  // `validateExtra` documents.
  if (patch.extra !== undefined) {
    const moved = Object.keys(patch.extra)
      .filter((key) => patch.extra![key] !== (Object.hasOwn(item.extra, key) ? item.extra[key] : undefined))
      .sort();
    if (moved.length > 0) {
      const before: Record<string, string> = {};
      const after: Record<string, string> = {};
      for (const key of moved) {
        if (Object.hasOwn(item.extra, key)) before[key] = item.extra[key];
        after[key] = patch.extra[key];
      }
      addContent('extra', before, after);
    }
  }
  if (patch.scope !== undefined) {
    const next = patch.scope.map((g) => normalizePosix(g));
    if (!sameSet(next, item.scope)) add('scope', scopeLabel(item.scope), scopeLabel(next));
  }
  if (patch.always !== undefined && patch.always !== item.always) {
    add('always', item.always ? 'yes' : 'no', patch.always ? 'yes' : 'no');
  }
  if (patch.continuity !== undefined && patch.continuity !== item.continuity) {
    add('continuity', item.continuity ? 'yes' : 'no', patch.continuity ? 'yes' : 'no');
  }
  if (patch.severity !== undefined && patch.severity !== item.severity) {
    add('severity', item.severity, patch.severity);
  }
  if (patch.status !== undefined && patch.status !== item.status) {
    add('status', item.status, patch.status);
  }
  return changes;
}

/**
 * The gate, and the single place spec §2's table is decided.
 *
 * **It is computed from the state this edit RESULTS IN as well as the one it
 * starts from, and that pairing is the whole point.** `governs` is
 * `governsNormatively`'s predicate (mutate.ts) spelled at this surface:
 * normative tier, and `active` or `validated`.
 *
 * It used to read the item's current status alone, which made a draft ungated
 * in every field — including the one that ENDS the draft. `mycontext edit RULE-x
 * --always --severity hard --title "…"` followed by `mycontext edit RULE-x
 * --status active` produced a pinned, hard, actively governing item in two
 * commands with no preview and no confirmation token anywhere, while `review
 * promote` exists precisely to make that crossing deliberate and greppable.
 * Ruling R1 — the gate scales with what the edit can do — held only for items
 * that already governed, which is backwards: the edit that starts the governing
 * is the one that does the most.
 *
 * Either side is enough, and both are needed. The resulting state catches the
 * promotion; the starting state catches the opposite crossing, where a human
 * takes a governing item OUT — `--status deprecated`, an unpin, a narrowed
 * scope — which is the change a reader most needs to see and which leaves the
 * item governing nothing afterwards.
 *
 * A draft edit that does NOT end the draft stays ungated, and so does every
 * rationale item on any status: neither governs before or after, so there is
 * nothing for a human to approve. This is not ceremony added to the draft row —
 * it is that row applied to the right item.
 *
 * `reach` is true when any changing field is reach or force, and it is what
 * separates the table's last two rows: both confirm, but only that one owes
 * the human what governs BEFORE and AFTER.
 */
function gateFor(tier: Tier, status: Status, nextStatus: Status, changes: FieldChange[]):
{ confirm: boolean; reach: boolean } {
  const governs = (s: Status): boolean =>
    tier === 'normative' && (s === 'active' || s === 'validated');
  const governing = governs(status) || governs(nextStatus);
  return {
    confirm: governing,
    reach: governing && changes.some((c) => c.klass !== 'content'),
  };
}

/**
 * What a human is told about the agent proposals queued on the item they are
 * editing, BEFORE they are asked to confirm.
 *
 * This case became reachable the moment this command existed: Task 4 makes a
 * revision STALE when a human moves the very fields it proposes to rewrite,
 * and `review promote-revision` then refuses it without `--force`. Letting
 * that happen silently would be an agent's proposal invalidated by a command
 * that never mentioned it — the outcome spec §4 names as the wrong one.
 *
 * It names the revisions either way, and says which of them this edit
 * collides with: staleness is per FIELD (`decorate`, revision.ts, compares
 * only the fields a revision itself rewrites), so a body proposal is untouched
 * by an edit to the title and saying otherwise would be a warning about
 * nothing.
 */
function revisionNote(revs: PendingRevision[], item: Item, changes: FieldChange[]): string | null {
  const mine = revs.filter((r) => r.itemId === item.id);
  if (mine.length === 0) return null;
  const touched = new Set(changes.map((c) => c.field));
  const collide = mine.filter((r) => Object.keys(r.changes).some((f) => touched.has(f)));
  const one = mine.length === 1;
  const head =
    `note: ${item.id} carries ${mine.length} pending revision(s) ` +
    `(${mine.map((r) => r.revisionId).join(', ')}) — content an agent proposed and no human has ` +
    `settled. This edit neither applies nor discards ${one ? 'it' : 'them'}.`;
  if (collide.length === 0) {
    return `${head} None of ${one ? 'it' : 'them'} proposes a field this edit changes, so ` +
      `${one ? 'it stays' : 'they stay'} promotable as ${one ? 'it is' : 'they are'}. Read ` +
      `${one ? 'it' : 'them'} with \`mycontext review revisions ${item.id} --full\`.`;
  }
  const some = collide.length === 1;
  return `${head} ${collide.length} of ${one ? 'it' : 'them'} ` +
    `(${collide.map((r) => r.revisionId).join(', ')}) proposes new text for a field this edit ` +
    `changes, so this edit makes ${some ? 'it' : 'them'} STALE: ` +
    // `--revision` is composed whenever the item holds more than one pending
    // revision, because the bare form is refused there: with several pending,
    // settlement requires the human to name the one they reviewed.
    `\`mycontext review promote-revision ${item.id}${one ? '' : ' --revision <REV-...>'}\` ` +
    `will then refuse ${some ? 'it' : 'them'} without --force, which overwrites what you ` +
    `are about to write. ` +
    `Nothing is lost either way — read ${some ? 'it' : 'them'} with ` +
    `\`mycontext review revisions ${item.id} --full\` before or after this.`;
}

/** One `--unlink <relation> <target>` pair. */
interface Unlink { relation: string; target: string }

/**
 * `--unlink <relation> <target>`, repeatable — pulled OUT of argv before
 * anything else parses it, and returned alongside the argv that is left.
 *
 * It takes two values, and every other flag in this CLI takes zero or one. The
 * shared parser encodes that: `positionals` and `flagOccurrences` skip exactly
 * ONE token after a bare value flag, and they have to agree with each other
 * about the same argv or one of them is silently reading a value as a
 * positional. Teaching both of them a two-value form would be a change to
 * every command's parse for the sake of one flag on one command. Removing the
 * three tokens here instead leaves the rest of `edit`'s parsing looking at an
 * argv with no two-value flag in it at all, which is the shape the shared
 * helpers are correct for.
 *
 * `--unlink=blocks` is deliberately not accepted: the `=` form carries one
 * value, and a spelling that could only ever name half of a pair would fail
 * further in, on the missing target, rather than here on the form. Throwing
 * (rather than returning an error) matches every other parse failure on this
 * command — `cmdEdit`'s own `catch` turns it into one line and exit 1.
 */
function takeUnlinks(args: string[]): { rest: string[]; unlinks: Unlink[] } {
  const rest: string[] = [];
  const unlinks: Unlink[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--unlink=')) {
      throw new Error(
        `my_context: --unlink names a relation AND its target, as two words: ` +
        `\`--unlink <relation> <target>\`. The \`--unlink=…\` form can only carry one of them.`,
      );
    }
    if (args[i] !== '--unlink') { rest.push(args[i]); continue; }
    const relation = args[i + 1];
    const target = args[i + 2];
    if (relation === undefined || target === undefined
      || relation.startsWith('--') || target.startsWith('--')) {
      throw new Error(
        `my_context: --unlink takes two words, the relation and the item it points at — ` +
        `for example \`--unlink blocks REQ-payments-are-idempotent\`. Run ` +
        `\`mycontext show <id>\` to see the relations an item carries.`,
      );
    }
    unlinks.push({ relation, target });
    i += 2;
  }
  return { rest, unlinks };
}

/** `out` for a sentence rather than a line, wrapped to the layout budget —
 * the same helper `review`, `status` and `decay` use. */
function say(out: Emit, text: string, prefix = ''): void {
  for (const line of paragraph(text, prefix)) out(line);
}

/**
 * A labelled preview line, wrapped with a hanging indent so a long phrase
 * cannot be read as the start of the next field.
 *
 * The width is 9 because `relations` is the longest label this command prints
 * and a label wider than the column does not pad — it runs one space into the
 * value and puts that one line out of alignment with every other, which is how
 * a reader loses the column while scanning a preview. It was 8, sized to
 * `severity`, until `--unlink` added a longer one; `test/cli/edit.test.ts`
 * pins the arithmetic to `LABELS` rather than to the number, so the next label
 * that outgrows the column fails the test instead of quietly bending the
 * preview.
 */
export const PREVIEW_LABELS = [
  'id', 'type', 'title', 'status', 'today', 'after', 'relations',
  'scope', 'always', 'continuity', 'severity',
];

function labelled(out: Emit, label: string, text: string): void {
  const width = Math.max(...PREVIEW_LABELS.map((l) => l.length));
  for (const line of paragraph(text, `  ${label.padEnd(width)}  `, undefined, ' '.repeat(width + 4))) {
    out(line);
  }
}

function cmdEdit(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  // `--unlink <relation> <target>` comes out of argv first — see
  // `takeUnlinks`. Everything after this line, including `refuseUnknownFlag`
  // and `positionals`, sees an argv with no two-value flag in it, which is the
  // shape those shared helpers are correct for. A malformed `--unlink` throws
  // and is reported here rather than in the `try` below, because it is a parse
  // failure and nothing has been opened yet.
  let unlinks: Unlink[];
  try {
    ({ rest: args, unlinks } = takeUnlinks(args));
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }

  // The accepted surface is the built-in one PLUS whatever this project's
  // categories declare a `mycontext edit` flag for — see `declaredFlags`. Read
  // once and threaded through `refuseUnknownFlag`, `positionals` and every
  // usage line below, so those three cannot disagree about which token is a
  // flag's value and which is the id.
  const declared = declaredEditFlags(ws.config);
  const allowed = declared.length === 0 ? ALLOWED : [...ALLOWED, ...declared];
  const valueFlags = declared.length === 0 ? VALUE_FLAGS : [...VALUE_FLAGS, ...declared];
  const usage = usageFor(declared);

  // Refused before the corpus is opened and before any preview or prompt, on
  // the same terms as `review` and `supersede`: a `--sever` that silently
  // became "no severity flag at all" would edit the item without the change
  // the operator typed and report success.
  if (refuseUnknownFlag(args, allowed, valueFlags, usage, out)) return 1;

  const [id, extra] = positionals(args, valueFlags);
  if (!id) { out(usage); return 1; }
  // `mycontext edit ID "new title"` reads like it ought to work; silently
  // ignoring the second positional would report a successful edit that changed
  // nothing the operator asked for.
  if (extra !== undefined) {
    say(out, `my_context: unexpected argument "${extra}" — every field is named with a flag ` +
      `(--title, --body, …), not given as a positional.`);
    out(usage);
    return 1;
  }

  const { ctx, errors } = openMutateContext(ws);
  try {
    // The patch, assembled before anything is read from the corpus so a
    // malformed flag value is refused on its own terms. `listFlag`, not
    // `flag`, for the two list fields: `--scope a/** --scope b/**` must union
    // rather than keep the first, the drop `mycontext add --scope` was fixed
    // for. Absent (`null`) and empty (`--scope=`) are different instructions —
    // the second one clears the field — so only `null` is skipped.
    const patch: UpdateInput = { id, origin: 'human' };
    const title = flag(args, 'title');
    const body = flag(args, 'body');
    const scope = listFlag(args, 'scope');
    const tags = listFlag(args, 'tags');
    const severity = flag(args, 'severity');
    const summary = flag(args, 'summary');
    const status = flag(args, 'status');
    const always = boolFlag(args, 'always');
    const continuity = boolFlag(args, 'continuity');
    // The escape hatch (`UpdateInput.summaryUnchanged`). `boolFlag`, like
    // `--always` and `--continuity`, so `--summary-unchanged=false` is the same
    // "no" as leaving it off and a repeat with two different values is refused
    // in `boolFlag`'s own words. Only `true` is carried into the patch: `false`
    // asserts nothing, and putting it there would make the "nothing to edit"
    // count below treat a decline as a field.
    const summaryUnchanged = boolFlag(args, 'summary-unchanged');
    const extraFields = extraFlag(args);
    // The declared flags, read with the same `flag` helper as everything else
    // so a repeat is refused in `repeatedFlagError`'s words rather than in a
    // second wording of its own.
    const declaredValues: Record<string, string> = {};
    for (const name of declared) {
      const value = flag(args, name);
      if (value !== null) declaredValues[name] = value;
    }

    // One field, two spellings, two values. Refused rather than resolved by
    // precedence, for `boolFlag`'s reason at `--always` given as both true and
    // false: there is no reading of that which honours both, and honouring
    // either would drop the other while reporting success. An ECHO — the same
    // value through both spellings — is not a conflict and is left alone.
    for (const [name, value] of Object.entries(declaredValues)) {
      if (extraFields === null || !Object.hasOwn(extraFields, name)) continue;
      if (extraFields[name] === value) continue;
      say(out, `my_context: "${name}" was given twice, as \`--${name} ${value}\` and as ` +
        `\`--extra ${name}=${extraFields[name]}\`, with two different values. There is no ` +
        `reading of that which honours both. Nothing was changed — pass it once.`);
      return 1;
    }

    if (extraFields !== null || Object.keys(declaredValues).length > 0) {
      // The two spellings land in ONE map, because they are one field: a
      // declared flag is `--extra <name>=<value>` under the name its category
      // gave it, so everything downstream — `validateExtra`, the projection,
      // `changesOf`'s diff, `updateItem`'s merge — sees one patch and cannot
      // treat the two spellings differently.
      //
      // Validated HERE, before the preview, on the same terms as `--severity`
      // and `--status` below: `updateItem` would refuse an unstorable value
      // anyway, but from inside the write — after a human had been shown what
      // the edit would do and asked to approve it. `validateExtra` owns the
      // wording, so this surface cannot drift from `create_item`'s.
      const fields = { ...extraFields, ...declaredValues };
      validateExtra(fields);
      patch.extra = fields;
    }
    if (title !== null) patch.title = title.trim();
    if (body !== null) patch.body = body;
    // `--summary=` (empty) is the CLEAR and is deliberately not skipped here:
    // absent (`null`) and empty are different instructions, exactly as they
    // are for `--scope`. Validated before the preview and before the gate, on
    // the same terms as `--severity` and `--status` below — `updateItem` would
    // refuse an over-long summary anyway, but only after a human had been
    // shown what the edit would do and asked to approve it.
    if (summary !== null) {
      const normalized = normalizeSummary(summary);
      try {
        validateSummary(normalized);
      } catch (err) {
        say(out, err instanceof Error ? err.message : String(err));
        return 1;
      }
      patch.summary = normalized;
    }
    if (summaryUnchanged === true) patch.summaryUnchanged = true;
    if (scope !== null) patch.scope = scope;
    if (tags !== null) patch.tags = tags;
    if (always !== null) patch.always = always;
    if (continuity !== null) patch.continuity = continuity;
    if (severity !== null) {
      if (!(SEVERITIES as string[]).includes(severity)) {
        // `enumError` and `SEVERITIES` (mutate.ts): `create_item`,
        // `update_item`, `mycontext add --severity` and `review promote
        // --severity` all refuse a bad severity in exactly these words.
        say(out, enumError('severity', severity, SEVERITIES, 'capture'));
        return 1;
      }
      patch.severity = severity as Severity;
    }
    if (status !== null) {
      if (!(STATUSES as string[]).includes(status)) {
        say(out, enumError('status', status, STATUSES, 'workflow'));
        return 1;
      }
      // `superseded` is refused, and this is the one status this command does
      // not set. Retirement in this system names its replacement in both
      // directions — `supersede_item` writes `superseded_by` on the retiree
      // and `supersedes` on the replacement — and the README states plainly
      // that "retirement without a successor is not offered". A bare `--status
      // superseded` here would produce exactly that: an item marked as
      // replaced by nothing, with no edge for a reader to follow back. The
      // command that does it properly is named rather than the door merely
      // shut.
      if (status === 'superseded') {
        say(out, `my_context: "superseded" is not set through \`mycontext edit\` — a retirement ` +
          `names its replacement, and both items record the relation. Use \`mycontext supersede ` +
          `${id} --by <replacement id>\`. To retire an item with no replacement, ` +
          `\`--status deprecated\` is the status that means exactly that.`);
        return 1;
      }
      patch.status = status as Status;
    }

    if (Object.keys(patch).length <= 2 && unlinks.length === 0) {
      say(out, 'my_context: nothing to edit — no field was named.');
      out(USAGE);
      return 1;
    }

    const item = ctx.store.get(id);
    if (!item) {
      say(out, `my_context: no item with id "${id}". Find it with \`mycontext list\` or ` +
        `\`mycontext search "..."\`.`);
      return 1;
    }

    // Every refusal below runs BEFORE the preview: a refusal must never be
    // preceded by "about to edit", which reads as a report of something that
    // then did not happen.
    if (item.layer !== 'project') {
      // The store's own sentence (`globalLayerRefusal`, mutate.ts), which
      // `updateItem` would throw anyway — checked here purely for that
      // ordering.
      say(out, globalLayerRefusal(item.id));
      return 1;
    }

    // `Object.hasOwn` for the prototype-pollution reason `tierOf` documents; a
    // type absent from config has no category to read, and `tierOf` fails
    // CLOSED to `normative` for it — so an item whose category was removed
    // from config is gated, not waved through.
    const category = Object.hasOwn(ws.config.categories, item.type)
      ? ws.config.categories[item.type]
      : undefined;
    const tier: Tier = category?.tier ?? 'normative';

    if (category !== undefined) {
      // Spec §3, and gated on the FLAG being typed rather than on the value
      // moving — deliberately stricter than `updateItem`'s own condition, and
      // the same divergence `review promote` takes, for the same reason:
      // `updateItem` tolerates an unchanged value because its callers are
      // programs echoing back a field they just read, and nothing echoes on a
      // CLI. Every flag here was typed by a human, so `--always` is an
      // assertion even on an item that already carries it, and accepting it
      // silently would be the drop this refusal exists to close.
      //
      // Only the GOVERNING values are refused (`--always` true, `--severity
      // hard`), which is `inertFieldError`'s own rule: `--always=false` and
      // `--severity soft` assert nothing about the pinned tier, and clearing a
      // stored-but-inert `always: true` off a rationale item is a legitimate
      // cleanup that must stay available. `scope` is deliberately NOT here —
      // see `inertFieldError`, which records why it is accepted on the
      // rationale tier while the other two are not.
      if (patch.always === true) {
        const refusal = inertFieldError(category, 'always', 'edit');
        if (refusal) { say(out, refusal); return 1; }
      }
      if (patch.severity === 'hard') {
        const refusal = inertFieldError(category, 'severity', 'edit');
        if (refusal) { say(out, refusal); return 1; }
      }
      // The edit half of `scopePolicy: "required"` (Task 2). `updateItem`
      // enforces it too and this command inherits that; it is called here for
      // the ordering above, on the identical condition — the item actually
      // HAS globs and this edit would clear them — so a caller who never had
      // any is not refused for a no-op.
      if (patch.scope !== undefined && patch.scope.length === 0 && item.scope.length > 0) {
        const refusal = scopeRequirementError(category, patch.scope, 'edit');
        if (refusal) { say(out, refusal); return 1; }
      }
    }

    // --- what this item's category declares (see the block comment above) ---
    //
    // Everything from here to the projection is refused BEFORE the preview,
    // for the reason stated at `item.layer`: a refusal must never be preceded
    // by "about to edit", which reads as a report of something that then did
    // not happen — and every sentence below ends in "Nothing was changed",
    // which is only true from here.

    // Step 1 of the seam (`src/core/tag-projection.ts`): a hand-written
    // projected tag is refused, and it is refused BEFORE the field edit below
    // is honoured. `--tags state:done --state doing` has two readings, and
    // honouring either drops the other in silence — the same rule
    // `--clear --tag` is already refused under (focus.ts).
    if (tags !== null) {
      const refusal = handWrittenProjectionError(ws.config, item.type, tags);
      if (refusal) { say(out, refusal); return 1; }
    }

    // A declared flag is accepted by the parse because SOME category declares
    // it; whether THIS one does is a question only the loaded item can answer.
    for (const name of Object.keys(declaredValues)) {
      const decl = updatableFor(ws.config, item.type, name);
      if (decl !== null && isEditFlag(name, decl)) continue;
      say(out, undeclaredFlagError(ws.config, item.type, name));
      return 1;
    }

    // The three fields this command spells itself that carry a closed
    // vocabulary, checked a second time against what the item's own category
    // declares. The first check (against `SEVERITIES`/`STATUSES`, above) is the
    // grammar and runs before the item is known; this one is the CATEGORY's
    // narrowing, which is the whole reason `updates` is authorable in
    // config.json — a project declaring `updates.status.values` gets a refusal
    // that agrees with what `mycontext help categories` prints for it, without
    // this file learning that the narrowing exists.
    //
    // `inertFieldError` above keeps precedence on the two cases it covers:
    // `--severity hard` and `--always true` on the rationale tier are also
    // outside the declared vocabulary there, and its sentence says the part the
    // vocabulary cannot — that the value would be stored and then do nothing,
    // and that retiering the category is the remedy.
    const vocabularies: [string, string][] = [];
    if (patch.severity !== undefined) vocabularies.push(['severity', patch.severity]);
    if (patch.status !== undefined) vocabularies.push(['status', patch.status]);
    if (patch.always !== undefined) vocabularies.push(['always', String(patch.always)]);
    if (patch.continuity !== undefined) {
      vocabularies.push(['continuity', String(patch.continuity)]);
    }
    for (const [name, value] of vocabularies) {
      const decl = updatableFor(ws.config, item.type, name);
      if (decl === null) continue;
      const refusal = updatableValueError(name, value, decl);
      if (refusal) { say(out, refusal); return 1; }
    }

    // Step 2 of the seam: the field moves and the tag projected from it is
    // rewritten onto the SAME patch, so the diff a human approves shows both
    // halves of the change rather than showing the field and performing the
    // tag.
    //
    // The item is handed to `projectFieldUpdate` with `--tags`' replacement
    // list already applied, so `--tags v2,ui --state done` reconciles onto the
    // list the caller asked for instead of onto the one being replaced. Passing
    // the stored tags would silently discard the `--tags` half.
    //
    // `projected.tags` is the WHOLE replacement list and is assigned outright —
    // `updateItem` does `item.tags = input.tags`, so merging it again would
    // duplicate every tag. Caught rather than left to the handler at the bottom
    // of this function, purely so the refusal is wrapped to the layout budget
    // like every other refusal this command prints; the ordering is the same
    // one `validateExtra` already has.
    if (patch.extra !== undefined) {
      try {
        const projected = projectFieldUpdate(
          ws.config,
          { type: item.type, tags: patch.tags ?? item.tags, extra: item.extra },
          patch.extra,
        );
        patch.extra = { ...patch.extra, ...projected.extra };
        if (projected.tags !== undefined) patch.tags = projected.tags;
      } catch (err) {
        say(out, err instanceof Error ? err.message : String(err));
        return 1;
      }
    }

    // The two `--unlink` refusals, here rather than inside `unlinkItems`, and
    // for the ordering the comment above `item.layer` states: a refusal must
    // never arrive after "about to edit" and a confirmation prompt. Both
    // sentences are `mutate.ts`'s own (`retirementEdgeRefusal`,
    // `missingRelationRefusal`), so this surface cannot drift from the store's.
    for (const { relation, target } of unlinks) {
      const refusal = retirementEdgeRefusal(relation)
        ?? missingRelationRefusal(item, relation, target);
      if (refusal) { say(out, refusal); return 1; }
    }

    // **The summary gate**, and it is the LAST refusal because it is the only
    // one that has to see the patch as it will finally be written: the tag
    // projection above can add an `extra` key the caller never typed, and
    // `extra` is summarised content. Asking before that would let a projected
    // field move the basis behind the gate's back.
    //
    // Placed before the preview like every refusal above it, for the reason
    // stated at `item.layer`: a refusal must never be preceded by "about to
    // edit", and both sentences below end in "nothing was changed".
    //
    // The hatch's own refusals go FIRST, so a call that passes `--summary` and
    // `--summary-unchanged` together is told about the contradiction rather
    // than being waved through by the summary it carries.
    const hatchRefusal = summaryUnchangedRefusal(item, patch, 'edit');
    if (hatchRefusal) { say(out, hatchRefusal); return 1; }
    if (summaryRequired(item, patch)) {
      say(out, summaryRequiredRefusal(item, 'edit'));
      return 1;
    }

    const scopeLabel = (globs: string[]): string =>
      scopeField(globs, scopePolicyFor(ws.config, item.type), ', ');
    const changes = changesOf(item, patch, scopeLabel);
    // Appended after `changesOf` rather than computed inside it: every field
    // that function reads comes off `UpdateInput`, which has no relations, and
    // a relation removal is already known to be a real change by the time it
    // gets here — the "no such relation" case was refused two lines up.
    for (const { relation, target } of unlinks) {
      changes.push({
        field: 'relations', klass: FIELD_CLASS.relations,
        before: `${relation} ${target}`, after: 'removed',
      });
    }

    if (changes.length === 0) {
      // Nothing is dropped silently, and nothing is confirmed for nothing: a
      // human who asked for a value the item already has is told so rather
      // than shown a preview of an empty change or a bare "updated".
      say(out, `my_context: nothing to change — ${item.id} already has the ` +
        `${Object.keys(patch).filter((k) => k !== 'id' && k !== 'origin').join(', ')} ` +
        `you passed. Nothing was written.`);
      emitLoadErrors(errors, out);
      return 0;
    }

    const gate = gateFor(tier, item.status, patch.status ?? item.status, changes);
    const revs = pendingRevisions(ctx);
    const staleBefore = new Set(revs.filter((r) => r.stale).map((r) => r.revisionId));

    if (gate.confirm) {
      const today = injection(item, ws.config);
      out('about to edit:');
      labelled(out, 'id', item.id);
      labelled(out, 'type', item.type);
      labelled(out, 'title', item.title);
      labelled(out, 'status', item.status);
      labelled(out, 'today', today.phrase);
      out('');
      out('changing:');
      for (const change of changes) {
        // Content is shown as the same line diff `mycontext review` prints for
        // a pending revision (`fieldDiff`, revision-view.ts) — one rendering
        // of "this text becomes that text", never a truncated one. Reach and
        // force are single values, so a diff of them would be three lines
        // saying what one says.
        //
        // The branch reads `from` rather than `klass`, and the two used to be
        // the same test: `addContent` is the only producer of a diffable pair
        // and it is the only producer of a content change — until
        // `summary_of`, which is content that moves no text and has no pair to
        // diff. Keying on the pair itself asks the question the renderer
        // actually has ("is there a before-and-after text here?") instead of a
        // proxy for it, and every change built by `addContent` still takes the
        // first branch exactly as before.
        if (change.from !== undefined) {
          for (const line of fieldDiff(
            change.field as RevisionField, change.from, change.to,
          )) out(line);
        } else {
          labelled(out, change.field, `${change.before} -> ${change.after}`);
        }
      }
      out('');
      if (gate.reach) {
        // Spec §2's last row: a change to reach or force owes the human what
        // governs BEFORE and AFTER, not a field name. Printed even when the
        // two agree — `--severity hard` moves force without moving what is
        // injected — because "this does not change what is injected" is the
        // answer a human approving a severity change needs, and silence does
        // not say it.
        const after = injection(afterShape(item, patch), ws.config);
        labelled(out, 'after', after.phrase);
        // The crossing itself, in one sentence, when this edit changes WHETHER
        // the item is injected rather than only where. Both directions are
        // named: taking a governing item out is the cost a human most needs to
        // see, and putting one in is the same fact in the direction that adds
        // an instruction to sessions that did not have it.
        if (today.injected !== after.injected) {
          say(
            out,
            today.injected
              ? `this edit takes ${item.id} out of injection — it reaches sessions today and ` +
                'will reach none afterwards.'
              : `this edit puts ${item.id} into injection — it reaches no session today and ` +
                'will reach them afterwards.',
            '  ',
          );
        }
        out('');
      }
      const note = revisionNote(revs, item, changes);
      if (note !== null) { say(out, note); out(''); }

      // The question names the item and points at the preview rather than
      // restating it. `confirmAction` appends ` [y/N] ` to whatever it is
      // given and does not wrap, so a question carrying the title and the
      // field list would be the one line of this command's output that cannot
      // fit the layout budget at a maximum-length id — and it would be
      // restating, on that line, what the six lines above it just showed.
      if (!confirmAction(args, out, `Apply this edit to ${item.id}?`)) return 1;
    } else {
      // Ungated, and still not silent: an edit that invalidates an agent's
      // proposal has to say so whether or not a human was asked to confirm
      // anything. A normative DRAFT can carry a pending revision (Task 5
      // applies `agentEdits` with no draft exemption), so this is reachable
      // on exactly the path with no prompt to carry the warning.
      const note = revisionNote(revs, item, changes);
      if (note !== null) { say(out, note); out(''); }
    }

    // The relation removals go FIRST, and the order is deliberate. Each one is
    // a separate `persist`, so a run that stopped halfway would leave the item
    // partly written either way — but `updateItem` is the call that can refuse
    // (the guards, the staging policy, `scopePolicy`), and a refusal after the
    // unlinks had been written would report failure on an edit that had already
    // removed edges. Unlinks are refused above, before anything is opened, so
    // by this point they cannot fail on their own terms.
    for (const { relation, target } of unlinks) {
      const removed = unlinkItems(ctx, { from: item.id, to: target, relation });
      say(out, removed.message);
    }

    // `<= 2` is `id` and `origin`, the two keys every patch carries: an
    // `--unlink`-only invocation has no field to update, and calling
    // `updateItem` with an empty patch would write a revision of nothing and
    // print "updated" for an edit that changed no field.
    if (Object.keys(patch).length > 2) {
      const result = updateItem(ctx, patch);
      say(out, result.message);
    }
    // What ACTUALLY became stale, read back from the store after the write
    // rather than predicted before it. The note above says what this edit is
    // expected to do; this says what it did, and the two are computed from
    // different sides of the write on purpose — a prediction that turned out
    // wrong would otherwise be the last thing a user was told.
    const nowStale = pendingRevisions(ctx)
      .filter((r) => r.itemId === item.id && r.stale && !staleBefore.has(r.revisionId));
    if (nowStale.length > 0) {
      say(out, `my_context: ${nowStale.length} pending revision(s) on ${item.id} ` +
        `(${nowStale.map((r) => r.revisionId).join(', ')}) ${nowStale.length === 1 ? 'is' : 'are'} ` +
        `now STALE — this edit changed the text ${nowStale.length === 1 ? 'it proposes' : 'they propose'} ` +
        `to rewrite. Nothing was discarded: read ${nowStale.length === 1 ? 'it' : 'them'} with ` +
        `\`mycontext review revisions ${item.id} --full\`.`);
    }
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
  name: 'edit',
  usage: 'edit <id> [--title|--body|--summary|--scope|--tags|--severity|--always|--continuity|--status|--extra]',
  summary: 'change an item, with a gate that scales to what the change can do',
  run: cmdEdit,
});

/* -------------------------------------------------------------------------- *
 * The named entry points: `pin`, `unpin`, `harden`, `soften`.
 * -------------------------------------------------------------------------- */

/**
 * Four commands that are `edit` under a shorter name — spec §6's other half.
 *
 * **Why they exist at all**, given that `edit` already does each of them: the
 * command list is the picker. Autocomplete filters as you type, which is
 * already why this CLI has 17 `add-<type>` slash commands rather than one
 * taking a category argument. `pin` is two of the three or four things a
 * person does to an item constantly; typing `--always=true` correctly, on a
 * switch whose `--always true` spelling is a positional error, is not.
 *
 * **Why they rewrite argv rather than parse it**, which is the whole of the
 * implementation below: everything that makes `edit` correct lives inside
 * `cmdEdit` and nowhere else — the gate (`gateFor`), the preview and its
 * before/after injection lines, Task 3's inert-field refusals, the layer
 * refusal, `scopePolicy`, the pending-revision notes on both the gated and the
 * ungated paths, and the F2 load-error rule. A second parse would be a second
 * copy of every one of those decisions, and the four commands would then agree
 * with `edit` only for as long as nobody edited either. Rewriting argv makes
 * "same preview, same gate, same result" structural rather than promised, and
 * it is what lets the agreement test in `test/cli/edit.test.ts` compare STDOUT
 * byte for byte instead of comparing two renderings that merely look alike.
 */
export interface NamedEntryPoint {
  name: string;
  /** The `edit` flag this command IS, spelled as argv. */
  sets: string;
  summary: string;
  /** What the flag does, for the usage line. */
  effect: string;
}

/**
 * Exported because `src/plugin/commands.ts` generates one slash command per
 * entry — the second spelling of these four, and generated from this list so
 * there is only ever one. A fifth named form added here gets its slash command
 * for free; a fifth added there without touching this list has no CLI behind
 * it, which the drift test in `test/plugin/commands.test.ts` fails on.
 */
export const NAMED_ENTRY_POINTS: NamedEntryPoint[] = [
  {
    name: 'pin', sets: '--always=true',
    summary: 'inject an item at every session start (edit --always=true)',
    effect: 'sets `always`, so the item is injected in full at every session start',
  },
  {
    name: 'unpin', sets: '--always=false',
    summary: 'stop injecting an item at every session start (edit --always=false)',
    effect: 'clears `always`, so the item is injected only where its scope matches',
  },
  {
    name: 'harden', sets: '--severity=hard',
    summary: 'make a normative item binding (edit --severity=hard)',
    effect: 'sets `severity` to hard, which is what decides whether CI fails on a violation',
  },
  {
    name: 'soften', sets: '--severity=soft',
    summary: 'make a normative item advisory (edit --severity=soft)',
    effect: 'sets `severity` to soft, so the item advises rather than binds',
  },
];

/**
 * What a named entry point accepts beyond the id, and the answer is: `--yes`,
 * and nothing else.
 *
 * `--yes` has to be here — these commands inherit `edit`'s confirmation gate,
 * and a gate with no way to answer it would make them unusable in exactly the
 * non-interactive case `--yes` exists for, as well as breaking the agreement
 * with `edit` at the one place it matters most.
 *
 * Every OTHER field is refused rather than forwarded, and that is a decision
 * rather than an omission. `pin <id> --severity hard` would be two edits under
 * a name that describes one of them, previewed and confirmed as a single
 * action — and the moment these commands take a field they do not own they
 * stop being entry points onto `edit` and become a second, smaller `edit` with
 * its own argument surface to keep in step. `edit` is the command that takes
 * more than one field, and the refusal below names it.
 *
 * LIFTED to `core/command-flags.ts`, and looked up PER ENTRY rather than once
 * for the four: they are four commands to the registry, to the approval
 * boundary and to anything reading that map, and one shared array would make
 * "which commands take `--yes`" unanswerable by reading it. The four entries
 * there say the same thing today; the day one of them stops, this is already
 * asking the right question.
 */

/**
 * The usage block, wrapped to the layout budget here rather than by the
 * caller: `refuseUnknownFlag` prints whatever string it is given as one `out`
 * call, so a usage line long enough to overflow would do so unwrapped — and
 * these two sentences are longer than the id they sit beside.
 */
function namedUsage(entry: NamedEntryPoint): string {
  return [
    `usage: mycontext ${entry.name} <id> [--yes]`,
    ...paragraph(
      `${entry.name} is \`mycontext edit <id> ${entry.sets}\` — it ${entry.effect}. To change ` +
      `any other field, or more than one, use \`mycontext edit <id>\`.`,
      '  ',
    ),
  ].join('\n');
}

/**
 * `<name> <id> [--yes]` → `edit <id> <the flag> [--yes]`, run by `cmdEdit`.
 *
 * The three refusals here are the ones that must NOT reach `cmdEdit`, because
 * `cmdEdit` would answer them in `edit`'s vocabulary: an unknown flag, a
 * missing id and a second positional all print a usage line, and the usage
 * line a `pin` user needs is `pin`'s. Everything past this point is `edit`'s,
 * unaltered — including its own usage line, which is unreachable from here
 * precisely because these three cases are settled first (`cmdEdit` prints it
 * on a missing id, a second positional and "no field was named", and this
 * function rules out all three before calling it).
 */
function runNamed(entry: NamedEntryPoint, ws: Workspace, args: string[], out: Emit): number {
  const usage = namedUsage(entry);
  // No value-taking flags: `--yes` is a switch, so nothing here consumes the
  // token after it, and `positionals` below is given the same empty list so
  // the two cannot disagree about which token is the id.
  const { allowed, values } = COMMAND_FLAGS[entry.name];
  if (refuseUnknownFlag(args, allowed, values, usage, out)) return 1;

  const [id, extra] = positionals(args, []);
  if (!id) { out(usage); return 1; }
  if (extra !== undefined) {
    say(out, `my_context: unexpected argument "${extra}" — \`mycontext ${entry.name}\` takes one ` +
      `id and nothing else.`);
    out(usage);
    return 1;
  }

  // Only the flags survive the rewrite: every positional has been accounted
  // for above, and `--yes` (in either spelling) is passed through verbatim so
  // `--yes=false` still declines exactly as it does on `edit`.
  const passthrough = args.filter((arg) => arg.startsWith('--'));
  return cmdEdit(ws, [id, entry.sets, ...passthrough], out);
}

for (const entry of NAMED_ENTRY_POINTS) {
  registerCommand({
    name: entry.name,
    usage: `${entry.name} <id> [--yes]`,
    summary: entry.summary,
    run: (ws, args, out) => runNamed(entry, ws, args, out),
  });
}
