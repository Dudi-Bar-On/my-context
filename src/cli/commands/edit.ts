import { scopePolicyFor } from '../../core/config.ts';
import { normalizePosix } from '../../core/paths.ts';
import {
  globalLayerRefusal, inertFieldError, scopeRequirementError, SEVERITIES, STATUSES, updateItem,
  type MutationContext, type UpdateInput,
} from '../../core/mutate.ts';
import { scopeField } from '../../core/render-item.ts';
import { pendingRevisions, type PendingRevision } from '../../core/revision.ts';
import { enumError } from '../../core/teach.ts';
import type { Item, Severity, Status, Tier } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext } from './context.ts';
import { paragraph, refuseUnknownFlag } from './format.ts';
import { injection } from './injection.ts';
import { confirmAction } from './review.ts';
import { fieldDiff } from './revision-view.ts';
import {
  boolFlag, flag, listFlag, positionals, registerCommand, type Emit,
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

/** The flags this command accepts, and the value-taking subset. `always` and
 * `yes` are switches (`--always=false` unpins — see `boolFlag`). */
const ALLOWED = ['title', 'body', 'scope', 'tags', 'severity', 'always', 'status', 'yes'];
const VALUE_FLAGS = ['title', 'body', 'scope', 'tags', 'severity', 'status'];

const USAGE =
  `usage: mycontext edit <id> [--title "<text>"] [--body "<text>"] [--scope "a/**,b/**"]
                        [--tags "a,b"] [--severity hard|soft] [--always[=false]]
                        [--status active|draft|deprecated|validated] [--yes]`;

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
  title: 'content', body: 'content', tags: 'content',
  scope: 'reach', always: 'reach',
  severity: 'force', status: 'force',
};

/** One field this edit would actually change, with both of its values. */
interface FieldChange {
  field: string;
  klass: FieldClass;
  /** The current and proposed values, already rendered for the preview. */
  before: string;
  after: string;
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
function afterShape(item: Item, patch: UpdateInput): Pick<Item, 'type' | 'status' | 'always' | 'scope'> {
  return {
    type: item.type,
    status: patch.status ?? item.status,
    always: patch.always ?? item.always,
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
  if (patch.title !== undefined && patch.title !== item.title) add('title', item.title, patch.title);
  if (patch.body !== undefined && patch.body !== item.body) add('body', item.body, patch.body);
  if (patch.tags !== undefined && !sameSet(patch.tags, item.tags)) {
    add('tags', item.tags.join(', ') || '(no tags)', patch.tags.join(', ') || '(no tags)');
  }
  if (patch.scope !== undefined) {
    const next = patch.scope.map((g) => normalizePosix(g));
    if (!sameSet(next, item.scope)) add('scope', scopeLabel(item.scope), scopeLabel(next));
  }
  if (patch.always !== undefined && patch.always !== item.always) {
    add('always', item.always ? 'yes' : 'no', patch.always ? 'yes' : 'no');
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
    `\`mycontext review promote-revision ${item.id}\` will then refuse ` +
    `${some ? 'it' : 'them'} without --force, which overwrites what you are about to write. ` +
    `Nothing is lost either way — read ${some ? 'it' : 'them'} with ` +
    `\`mycontext review revisions ${item.id} --full\` before or after this.`;
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
 * The width is 8 because `severity` is the longest label this command prints
 * and a label wider than the column does not pad — it runs one space into the
 * value and puts that one line out of alignment with every other, which is how
 * a reader loses the column while scanning a preview.
 */
function labelled(out: Emit, label: string, text: string): void {
  const width = 8;
  for (const line of paragraph(text, `  ${label.padEnd(width)}  `, undefined, ' '.repeat(width + 4))) {
    out(line);
  }
}

function cmdEdit(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  // Refused before the corpus is opened and before any preview or prompt, on
  // the same terms as `review` and `supersede`: a `--sever` that silently
  // became "no severity flag at all" would edit the item without the change
  // the operator typed and report success.
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, USAGE, out)) return 1;

  const [id, extra] = positionals(args, VALUE_FLAGS);
  if (!id) { out(USAGE); return 1; }
  // `mycontext edit ID "new title"` reads like it ought to work; silently
  // ignoring the second positional would report a successful edit that changed
  // nothing the operator asked for.
  if (extra !== undefined) {
    say(out, `my_context: unexpected argument "${extra}" — every field is named with a flag ` +
      `(--title, --body, …), not given as a positional.`);
    out(USAGE);
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
    const status = flag(args, 'status');
    const always = boolFlag(args, 'always');

    if (title !== null) patch.title = title.trim();
    if (body !== null) patch.body = body;
    if (scope !== null) patch.scope = scope;
    if (tags !== null) patch.tags = tags;
    if (always !== null) patch.always = always;
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

    if (Object.keys(patch).length <= 2) {
      say(out, 'my_context: nothing to edit — no field was named.');
      out(USAGE);
      return 1;
    }

    const item = ctx.store.get(id);
    if (!item) {
      say(out, `my_context: no item with id "${id}". Find it with \`mycontext list\` or ` +
        `\`mycontext query --text "..."\`.`);
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

    const scopeLabel = (globs: string[]): string =>
      scopeField(globs, scopePolicyFor(ws.config, item.type), ', ');
    const changes = changesOf(item, patch, scopeLabel);

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
        if (change.klass === 'content') {
          for (const line of fieldDiff(
            change.field as 'title' | 'body' | 'tags',
            change.field === 'tags' ? change.before.split(', ') : change.before,
            change.field === 'tags' ? change.after.split(', ') : change.after,
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

    const result = updateItem(ctx, patch);
    say(out, result.message);
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
  usage: 'edit <id> [--title|--body|--scope|--tags|--severity|--always|--status]',
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
interface NamedEntryPoint {
  name: string;
  /** The `edit` flag this command IS, spelled as argv. */
  sets: string;
  summary: string;
  /** What the flag does, for the usage line. */
  effect: string;
}

const NAMED_ENTRY_POINTS: NamedEntryPoint[] = [
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
 */
const NAMED_ALLOWED = ['yes'];

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
  if (refuseUnknownFlag(args, NAMED_ALLOWED, [], usage, out)) return 1;

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
