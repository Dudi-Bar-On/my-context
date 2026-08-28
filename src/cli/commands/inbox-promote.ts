import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import type { ResolvedCategory } from '../../core/config.ts';
import { createItem, updateItem } from '../../core/mutate.ts';
import { globalLayerRefusal } from '../../core/persist.ts';
import { trustedStatus } from '../../core/trust.ts';
import type { Item, Status } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import { paragraph, refuseUnknownFlag } from './format.ts';
import { injection } from './injection.ts';
import { confirmAction } from './review.ts';
import { flag, positionals, registerCommand, type Emit } from './registry.ts';

/**
 * `mycontext inbox-promote` — the way out of the inbox.
 *
 * **Why the name is not `promote`.** `/mycontext:promote` already exists and
 * means `mycontext review promote`: moving a *draft* into governing. These
 * are different acts on different things — a draft is already the category it
 * will govern as, and what is missing is a human's approval; a `todo` or a
 * `note` is a capture whose category is the thing nobody has decided yet.
 * Two commands spelled `promote` meaning two things is the second-spelling
 * defect this repository has paid for repeatedly, so the noun §1.2 already
 * uses for the thing being left — the inbox — is in the name.
 *
 * **What it is, mechanically: one `createItem` and one `updateItem`.** There
 * is no new mutation primitive, no new status, and nothing added to
 * `trustedStatus`. That is the whole design, and it is what makes the trust
 * boundary hold here for free — see the `origin` field on the `createItem`
 * call, which is carried forward from the capture rather than restamped.
 *
 * **The origin item is retired, never deleted.** `status: 'deprecated'`, which
 * stamps `valid_until` through `stampValidUntil` like every other retirement,
 * leaves the file, its body, its observations and its relations on disk, and
 * keeps it searchable and counted — `mycontext todo --all` still lists a
 * promoted todo. Nothing in this product deletes an item.
 *
 * **Both writes are one human act.** The target is created FIRST and the
 * origin retired second, so the failure that can actually happen — the second
 * write throwing — leaves a target that exists and an origin that is still
 * live, which is a state the user can see and finish by hand. The reverse
 * order would leave a retired capture and no replacement, which is the same
 * accident with nothing to point at. When the second write does throw, the
 * message says the target landed and names the one command that finishes the
 * job; a half-completed promotion is never reported as either a success or a
 * clean failure.
 */

/**
 * The categories this command promotes OUT of, and the two it refuses to
 * promote INTO. One list, both directions, because they are the same fact:
 * these two are the inbox.
 */
const INBOX_TYPES = ['todo', 'note'];

/**
 * This command's flag surface, LIFTED to `core/command-flags.ts` so a read
 * surface can have it without reaching a module that writes. Nothing about
 * what is accepted changed; the reasoning is in that module's header.
 */
const { allowed: ALLOWED, values: VALUE_FLAGS } = COMMAND_FLAGS['inbox-promote'];

const USAGE =
  'usage: mycontext inbox-promote <todo or note id> --to <category> [--title <text>] [--yes]';

function say(out: Emit, text: string): void {
  for (const line of paragraph(text)) out(line);
}

/**
 * What the origin holds that does NOT travel, named rather than dropped.
 *
 * `INV-nothing-is-dropped-silently`. A promotion carries the title, the body
 * and the tags; it deliberately carries neither the scope, the extra fields
 * nor the observations, and each omission is a decision rather than an
 * oversight:
 *
 *  - **scope** decides what a normative item is injected on, so copying it
 *    across a tier change would silently decide reach on the user's behalf;
 *  - **extra fields belong to a category** (`unknownExtraFieldError`,
 *    mutate.ts), so the target category may not accept the origin's at all;
 *  - **observations** stay legible where they were written — the origin is
 *    not deleted and the target points back at it with `derived_from`.
 *
 * None of that is lost, and none of it is silent: the origin keeps all three
 * and this list says which ones it kept.
 */
function notCarried(origin: Item): string[] {
  const left: string[] = [];
  if (origin.scope.length > 0) left.push('its scope');
  if (Object.keys(origin.extra).length > 0) left.push('its category-specific fields');
  if (origin.observations.length > 0) left.push(`its ${origin.observations.length} observation(s)`);
  if (origin.sourceFile !== null) left.push('the source it was captured from');
  return left;
}

/**
 * The status the target will land in, worked out the same way `createItem`
 * works it out — `trustedStatus` itself, imported, never a second copy of its
 * rule — so the preview a human approves cannot disagree with what then
 * happens.
 */
function predictedStatus(origin: Item, category: ResolvedCategory): Status {
  return trustedStatus(origin.origin, category.tier, 'active');
}

function cmdInboxPromote(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  // Refused before the corpus is opened and before any preview or prompt, on
  // the same terms as `supersede` and `review`: a mistyped `--yse` that
  // silently became "no confirmation flag at all" turns a typo into a refusal
  // the operator works around by adding the flag they thought they had passed.
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, USAGE, out)) return 1;

  let id: string | undefined;
  let extra: string | undefined;
  let to: string | null;
  let titleFlag: string | null;
  try {
    [id, extra] = positionals(args, VALUE_FLAGS);
    to = flag(args, 'to');
    titleFlag = flag(args, 'title');
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }
  if (!id || to === null) { out(USAGE); return 1; }
  // The same refusal `supersede` gives a second positional, for the same
  // reason: `mycontext inbox-promote NOTE-x decision` reads like it ought to
  // work, and swallowing `decision` would promote into whatever `--to` said
  // while the operator believed they had named the target here.
  if (extra !== undefined) {
    out(`my_context: unexpected argument "${extra}" — the target category is named with ` +
        `--to, not as a second positional.\n${USAGE}`);
    return 1;
  }

  const { ctx, errors } = openMutateContext(ws);
  try {
    // Every refusal below runs BEFORE the preview is printed. A refusal
    // preceded by "about to promote" reads as a report of something that then
    // did not happen — the rule `supersede` states and this command inherits.
    const origin = ctx.store.get(id);
    if (!origin) {
      out(`my_context: no item with id "${id}". Find it with \`mycontext todo\` for a captured ` +
          `todo, or \`mycontext search "..."\` for anything else.`);
      return 1;
    }
    if (!INBOX_TYPES.includes(origin.type)) {
      // Refused BY NAME, the shape `cli/commands/lesson.ts` already uses: the
      // reader is told what the item actually is, not merely that it was not
      // what this command wanted.
      out(`my_context: ${origin.id} is a ${origin.type}, not a todo or a note. ` +
          `inbox-promote is the way out of the inbox; an item that is already the category ` +
          `it should be is changed with \`mycontext edit ${origin.id}\` and retired with ` +
          `\`mycontext supersede ${origin.id} --by <id>\`.`);
      return 1;
    }
    if (INBOX_TYPES.includes(to)) {
      out(`my_context: --to ${to} stays in the inbox, and a promotion that stays in the ` +
          `inbox is not one. Name the category this capture really is — ` +
          `\`mycontext help categories\` lists them with what each one means.`);
      return 1;
    }
    // BOTH writes land on the origin's layer (the retirement) and on the
    // project layer (the new item), so a global-layer origin is refused here
    // rather than after the preview. `globalLayerRefusal` (core/persist.ts)
    // rather than a local copy: this is the sentence `requireWritableItem`
    // throws and the one `mycontext edit` prints.
    if (origin.layer !== 'project') {
      out(globalLayerRefusal(origin.id));
      return 1;
    }

    const title = titleFlag ?? origin.title;
    if (title.trim() === '') {
      out('my_context: --title was given with no text. Leave it off to carry the capture\'s ' +
          `own title ("${origin.title}") forward, or give it one.`);
      return 1;
    }

    // Resolved the way `cmdAdd` resolves its own: an unknown or disabled
    // category is NOT refused here, so that the one message a user sees for it
    // is `resolveCategory`'s — `enumError` with the real catalogue, or the
    // "disabled in this project" sentence — raised once, inside `createItem`,
    // rather than restated here in a second wording that could drift from it.
    // Skipping the preview and the confirmation on that path is what keeps
    // "no refusal is preceded by a preview" true: nothing is written either
    // way, because `createItem` throws before it writes.
    const category: ResolvedCategory | undefined =
      Object.hasOwn(ws.config.categories, to) ? ws.config.categories[to] : undefined;

    if (category?.enabled) {
      const status = predictedStatus(origin, category);
      const after = injection(
        { type: to, status, always: false, continuity: false, scope: [] }, ws.config,
      );
      out('about to promote out of the inbox:');
      out(`  from        ${origin.id}`);
      out(`  type        ${origin.type}`);
      out(`  title       ${origin.title}`);
      out(`  status      ${origin.status} -> deprecated`);
      out(`  kept        the file, its body, its observations and its relations all stay, and`);
      out(`              it stays searchable and counted`);
      out('');
      out(`  to          a new ${to} (its id is allocated when it is written)`);
      out(`  title       ${title}`);
      // The origin field is carried, not restamped, and the preview says so
      // because it is the line that decides the status below. §1.3: "the trust
      // boundary applies unchanged on arrival — promotion is not laundering."
      out(`  origin      ${origin.origin} (carried from ${origin.id}, never restamped)`);
      out(`  status      ${status}`);
      out(`  governs     ${after.phrase}`);
      if (status === 'draft') {
        out(`              a human promotes it with \`mycontext review promote <new id>\``);
      }
      out(`  linked      the new item will carry "derived_from ${origin.id}"`);
      const left = notCarried(origin);
      if (left.length > 0) {
        out('');
        say(out, `${origin.id} keeps ${left.join(', ')}, and ` +
          `${left.length === 1 ? 'it does' : 'they do'} not travel to the new item. Nothing ` +
          `is deleted — the new item points back at ${origin.id}, which is where ` +
          `${left.length === 1 ? 'it stays' : 'they stay'} readable.`);
      }
      out('');

      if (!confirmAction(
        args, out,
        `Promote ${origin.id} ("${origin.title}") into a new ${to}?`,
      )) return 1;
    }

    // The target FIRST — see the file comment. Nothing about the origin has
    // moved yet at this point, so a refusal from `createItem` (an unknown or
    // disabled category, a `scopePolicy: "required"` target, a reserved extra
    // key) leaves the inbox exactly as it was.
    const created = createItem(ctx, {
      type: to,
      title,
      body: origin.body,
      tags: origin.tags,
      // §6i.5 rules the relation type, and the direction is on the NEW item
      // pointing back: `derived_from` on the target reads "DEC-x derived from
      // NOTE-y", which is the true sentence. The reverse edge would read
      // "NOTE-y derived from DEC-x", which is false.
      relations: [{ type: 'derived_from', target: origin.id }],
      // Carried forward, NOT set to 'human'. This is the whole of what makes
      // §1.3's "promotion is not laundering" true, and it needs no new code:
      // `trustedStatus` sees the agent origin, the target category is
      // normative, and the item lands `draft` exactly as an agent-authored
      // capture in that category would. A human's own note promoted into a
      // `rule` lands `active`, which is what `mycontext add rule` does from
      // the same terminal.
      origin: origin.origin,
    });
    // `createItem`'s own message, not a second one composed here: it already
    // states the real status and appends the standard explanation when the
    // trust boundary demoted the item to a draft (`mutate.ts`, the `suffix`
    // beside `trustedStatus`). Two sentences stating one status is how the
    // two drift.
    out(created.message);

    try {
      // `origin: 'human'` because this is the CLI (spec §7.1's "user, via
      // command" row) and because the retirement is the half of the act a
      // non-human caller is refused. It is NOT the origin carried above:
      // that one records who authored the CONTENT, this one records who
      // decided to retire the capture, and they are different questions.
      out(updateItem(ctx, { id: origin.id, status: 'deprecated', origin: 'human' }).message);
    } catch (err) {
      say(out, `${toCliMessage(err)}`);
      say(out, `my_context: ${created.id} exists and is not affected by that — the promotion ` +
        `is half done. ${origin.id} is still "${origin.status}". Finish it with ` +
        `\`mycontext edit ${origin.id} --status deprecated\`, which is the same write this ` +
        `command was making.`);
      return 1;
    }

    say(out, `my_context: ${created.id} carries "derived_from ${origin.id}", and ${origin.id} ` +
      `was retired rather than deleted — its file, body, observations and relations all stay, ` +
      `and \`mycontext show ${origin.id}\` still prints it.`);
    // F2 (see `openMutateContext`): both writes succeeded, so an unrelated
    // corpus load error is a warning and this exits 0.
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
  name: 'inbox-promote',
  usage: 'inbox-promote <id> --to <cat>',
  summary: 'a todo or note becomes a real item, linked back',
  run: (ws: Workspace, args: string[], out: Emit) => cmdInboxPromote(ws, args, out),
});
