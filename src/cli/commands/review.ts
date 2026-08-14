import { readSync } from 'node:fs';
import { renderItem } from '../../core/item.ts';
import { updateItem, type MutationContext, type UpdateInput } from '../../core/mutate.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext } from './context.ts';
import { DETAIL_USAGE, detailLevel, emitJson, table, wantsJson } from './format.ts';
import { flag, hasFlag, positionals, registerCommand, type Emit } from './registry.ts';

const USAGE = `usage: mycontext review [list] [--type <category>] ${DETAIL_USAGE}
       mycontext review show <id>
       mycontext review promote <id> [--scope "a/**,b/**"] [--always] [--severity hard|soft] [--yes]
       mycontext review discard <id> [--yes]`;

export function drafts(ctx: MutationContext, type: string | null): Item[] {
  return ctx.store.all()
    .filter((i) => i.status === 'draft')
    // A global-layer draft can never be promoted or discarded FROM THIS
    // PROJECT — `updateItem`'s `requireWritableItem` refuses any write to a
    // non-project-layer item — so listing one here is its own silent-
    // wrongness trap (spec §10): a caller works down the queue in the order
    // given and hits a refusal on an entry the queue itself offered as
    // actionable. Excluded from the listing entirely, not merely flagged.
    .filter((i) => i.layer === 'project')
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

  if (!['list', 'show', 'promote', 'discard'].includes(subcommand)) {
    out(`my_context: unknown review subcommand "${subcommand}".\n\n${USAGE}`);
    return 1;
  }

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
      const lines = detail === 'full'
        ? table(
          ['id', 'type', 'origin', 'severity', 'scope', 'source', 'title'],
          queue.map((i) => [
            i.id, i.type, i.origin, i.severity,
            i.scope.length ? i.scope.join(' ') : '-',
            i.sourceFile ?? '-', i.title,
          ]),
        )
        : table(
          ['id', 'type', 'origin', 'source', 'title'],
          queue.map((i) => [i.id, i.type, i.origin, i.sourceFile ?? '-', i.title]),
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
    if (severity !== null && severity !== 'hard' && severity !== 'soft') {
      out(`my_context: --severity must be "hard" or "soft" (got ${JSON.stringify(severity)}).`);
      return 1;
    }

    // `promote` is the trust boundary this whole draft mechanism exists to
    // gate — a human is about to make this item govern. Print id, type,
    // title, severity, scope and the body before acting, and before asking
    // for confirmation, so a promotion by id alone is never mistaken for a
    // rule: the human sees what they are approving, not just an identifier.
    out('about to promote:');
    out(`  id       ${item.id}`);
    out(`  type     ${item.type}`);
    out(`  title    ${item.title}`);
    out(`  severity ${item.severity}`);
    out(`  scope    ${item.scope.length ? item.scope.join(', ') : '(none)'}`);
    out('');
    out(item.body || '(no body)');
    out('');

    if (!confirmAction(args, out, `Promote ${item.id} to active?`)) return 1;

    // `updateItem` takes ONE object, id included — there is no (ctx, id, patch)
    // overload — and `origin: 'human'` is what makes the status change legal.
    const patch: UpdateInput = { id: item.id, status: 'active', origin: 'human' };
    const scope = flag(args, 'scope');
    if (scope !== null) patch.scope = scope.split(',').map((s) => s.trim()).filter(Boolean);
    if (severity !== null) patch.severity = severity;
    // `hasFlag`, not `args.includes('--always')`: the latter misses the
    // `--always=true` form that every other flag in this CLI accepts (see
    // registry.ts's `flag`/`hasFlag`).
    if (hasFlag(args, 'always')) patch.always = true;

    updateItem(ctx, patch);
    // MutationResult carries no `.item`; the written item comes back from the
    // store, which updateItem has already upserted the new scope into.
    const updated = ctx.store.get(item.id) as Item;
    // `always` items are admitted to the pinned tier with NO scope check
    // (select.ts's `fitToBudget(fresh.filter((i) => i.always), ...)`) — an
    // unscoped `--always` item is very much auto-injected, at every session
    // start, so the "never auto-injected" wording below must not apply to it.
    const scoping = updated.always
      ? 'pinned via --always — injected at every session start regardless of scope'
      : updated.scope.length
        ? `scope ${updated.scope.join(', ')}`
        : 'no scope — indexed and searchable, but never auto-injected';
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
  usage: 'review [show|promote|discard]',
  summary: 'walk the draft queue and promote what should govern',
  run: cmdReview,
});
