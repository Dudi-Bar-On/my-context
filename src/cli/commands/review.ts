import { readSync } from 'node:fs';
import { renderItem } from '../../core/item.ts';
import { SEVERITIES, updateItem, type MutationContext, type UpdateInput } from '../../core/mutate.ts';
import { reviewQueue } from '../../core/select.ts';
import { enumError } from '../../core/teach.ts';
import type { Item, Severity } from '../../core/types.ts';
import { scopePolicyFor } from '../../core/config.ts';
import { emptyScopeInjection, scopeField } from '../../core/render-item.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext } from './context.ts';
import {
  DETAIL_FLAGS, DETAIL_USAGE, detailLevel, emitJson, records, refuseUnknownFlag, table, wantsJson,
} from './format.ts';
import { flag, hasFlag, listFlag, positionals, registerCommand, type Emit } from './registry.ts';

/**
 * The subcommands this command accepts — the single source for the whitelist
 * that refuses anything else, for the long `USAGE` block below, and for the
 * one-line `usage` string `mycontext --help` prints. Those were three
 * hand-maintained spellings and the shortest of them had already drifted: it
 * listed `show|promote|discard` and omitted `list`, which is not only accepted
 * but is the DEFAULT — so `--help` documented a bare `mycontext review` as
 * invalid while `mycontext review` itself printed the queue.
 */
export const SUBCOMMANDS = ['list', 'show', 'promote', 'discard'] as const;

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
  promote: { allowed: ['scope', 'severity', 'always', 'yes'], values: ['scope', 'severity'] },
  discard: { allowed: ['yes'], values: [] },
};

const USAGE = `usage: mycontext review [list] [--type <category>] ${DETAIL_USAGE}
       mycontext review show <id>
       mycontext review promote <id> [--scope "a/**,b/**"] [--always] [--severity hard|soft] [--yes]
       mycontext review discard <id> [--yes]`;

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
 */
function readLineSync(): string {
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

  const valueFlags = ['type', 'scope', 'severity'];
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
          loadErrors: errors.map((e) => ({ file: e.file, message: e.message })),
        });
        return 0;
      }

      if (queue.length && detail === 'summary') {
        out(`${queue.length} draft(s) pending. Promote with \`mycontext review promote <id>\`.`);
        emitLoadErrors(errors, out);
        return 0;
      }

      if (queue.length === 0) {
        out(type
          ? `my_context: no drafts of type "${type}".`
          : 'my_context: no drafts pending review.');
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
      // already carry it — `guardedChange` (mutate.ts) only fires on an item
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
        ? records(
          ['id', 'type', 'origin', 'severity', 'always', 'scope', 'source', 'title'],
          queue.map((i) => [
            i.id, i.type, i.origin, i.severity, i.always ? 'yes' : 'no',
            // `always` has its own column here, so this is the scope alone —
            // but the EMPTY case is the shared spelling, not a local `-`.
            scopeField(i.scope, scopePolicyFor(ws.config, i.type)),
            i.sourceFile ?? '-', i.title,
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
      emitLoadErrors(errors, out);
      return 0;
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
    // hazard `resolveCategory`/`tierOf` in mutate.ts already guard against.
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
    // guards that, since `guardedChange` in mutate.ts only fires on an item
    // that already governs, and a draft governs nothing), so an agent can pin
    // its own draft. Without this line the human promoting it never sees it.
    out('about to promote:');
    out(`  id       ${item.id}`);
    out(`  type     ${item.type}`);
    out(`  title    ${item.title}`);
    out(`  severity ${patch.severity ?? item.severity}`);
    out(`  always   ${willBeAlways ? 'yes' : 'no'}${willBeAlways
      ? ` (${item.always ? 'carried by the draft itself' : 'from --always'}) — pinned: ` +
        'injected in full at every session start, regardless of scope'
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
    const scoping = updated.always
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
  usage: `review [${SUBCOMMANDS.join('|')}] [<id>]`,
  summary: 'walk the draft queue and promote what should govern',
  run: cmdReview,
});
