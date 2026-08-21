import type { ResolvedCategory } from '../../core/config.ts';
import type { LoadError } from '../../core/rebuild.ts';
import { filterItems } from '../../core/search.ts';
import { RETIRED_STATUSES } from '../../core/select.ts';
import type { Item, Tier } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import {
  DETAIL_FLAGS, DETAIL_USAGE, type Detail, detailLevel, emitJson, paragraph, records,
  refuseUnknownFlag, table, wantsJson,
} from './format.ts';
import { flag, hasFlag, registerCommand, type Emit } from './registry.ts';

/**
 * `mycontext todo` — the inbox, listed on a surface of its own.
 *
 * **Why a command rather than a widened review queue (§6m).** `reviewQueue`
 * (core/select.ts) is `status === 'draft' && layer === 'project'`, and it is
 * the single definition four surfaces read. Widening it to admit todos would
 * have required either a second predicate beside it — this project's
 * most-repeated defect — or teaching the queue about tiers, and neither buys
 * the thing that was wanted. `trustedStatus` does not force a rationale
 * capture to `draft` (that is the whole point of the tier `todo` lives on),
 * so a todo does not arrive in `draft` and could not appear in that queue
 * however it were widened. The two lists also answer different questions: an
 * inbox answers *"what did I jot down"*, the review queue answers *"what am I
 * being asked to let govern"*. Nothing in this file writes, and nothing in it
 * changes what `mycontext review` shows — `test/cli/todo.test.ts` asserts the
 * second half against the queue itself rather than against a sentence.
 *
 * **`search --type todo` already answered this question, and still does.**
 * This command is not a new predicate: it calls the same `filterItems`
 * (core/search.ts) that `mycontext search` and the `query_items` tool call,
 * with `type` pinned. What it adds over `search --type todo` is the two
 * disclosures below — the tier consequence and the hidden-item count — which
 * are the facts a reader of a to-do list will otherwise get wrong.
 *
 * **The disclosures carry their conditions, and are read from config rather
 * than asserted.** "A todo is never injected" is true of the tier `todo`
 * ships on, not of the word `todo`: `resolveConfig` lets a project retier any
 * category, `select` honours it, and an unconditional guarantee here would
 * become a false sentence in the one workspace where it mattered. So the tier
 * is looked up and the paragraph follows it — including the inverse, when a
 * project has retiered `todo` to `normative` and these items really are
 * governing.
 */

const VALUE_FLAGS = ['tag', 'limit'];
const ALLOWED = [...VALUE_FLAGS, 'all', ...DETAIL_FLAGS];

const USAGE = `usage: mycontext todo [--tag <tag>] [--all] [--limit <n>] ${DETAIL_USAGE}

The inbox: everything captured as \`todo\`, newest ideas and oldest alike, in id order.
Retired todos (superseded, deprecated, validated) are hidden and counted; --all shows
them. This is not the review queue — see the note the command prints.`;

/** The row cap, and the reason there is one is `search`'s: this prints a table
 * to a terminal, and a hundred-item inbox is not an answer. A truncation is
 * always reported. */
const DEFAULT_LIMIT = 50;

const HEADERS = ['id', 'status', 'tags', 'title'];
const FULL_HEADERS = ['id', 'status', 'origin', 'layer', 'tags', 'title'];

function say(out: Emit, text: string): void {
  for (const line of paragraph(text)) out(line);
}

function cells(item: Item, detail: Detail): string[] {
  const tags = item.tags.join(', ');
  return detail === 'full'
    ? [item.id, item.status, item.origin, item.layer, tags, item.title]
    : [item.id, item.status, tags, item.title];
}

/**
 * What the tier means for the items on this list, in the words a reader needs
 * and with the condition attached.
 *
 * `tier` is resolved, never assumed — see the file comment. The rationale
 * branch says "not named in the session index" precisely: `buildIndex`
 * (core/select.ts) enumerates normative items by id and title and reduces
 * every rationale type to a bare count, so an agent sees the digit in
 * "3 todo" and no id, no title, and no body.
 */
function tierParagraphs(tier: Tier): string[] {
  if (tier === 'rationale') {
    return [
      '`todo` is on the rationale tier, which is what makes it an inbox: a todo is never ' +
      'injected into a session in full, and the session index reduces the whole category to a ' +
      'bare count rather than naming any of these items. Nothing forces a capture to `draft` ' +
      'either, so a todo does not enter the review queue — `mycontext review` asks what should ' +
      'govern this project, and this list is not part of that question.',
      'The way out of the inbox is to capture the thing under the category it really is ' +
      '(`mycontext add <category> "<title>"`) and then `mycontext supersede <todo id> --by ' +
      '<new id>`, which retires the todo and records the replacement in both directions. ' +
      'Nothing here is ever deleted.',
    ];
  }
  return [
    '`todo` has been retiered to the normative tier in this project\'s config, so none of the ' +
    'above holds here: an active todo IS injected in full, IS named in the session index, and ' +
    'an agent-authored one lands `draft` for human review like any other normative capture — ' +
    'which means it appears in `mycontext review` as well as here. `mycontext help categories` ' +
    'prints the resolved tier of every category.',
  ];
}

function cmdTodo(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  // Refused before anything is opened, listed or disclosed. Two lessons paid
  // for in this CLI already: `lesson` accepted no flags at all, so
  // `positionals` swallowed a mistyped `--agnet` in silence; and `cmdAdd`
  // printed its whole confirmation preview and only then refused a bad
  // `--step`, so the reader had already answered a prompt about a command
  // that was never going to run. A gate belongs above the output, not after
  // it.
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, USAGE, out)) return 1;

  let detail: Detail;
  let json: boolean;
  let all: boolean;
  let tag: string | null;
  let limit: number;
  try {
    detail = detailLevel(args);
    json = wantsJson(args);
    // `hasFlag`, so `--all=false` means false and `--all=maybe` is refused
    // rather than resolved to either answer — see `boolFlag` (registry.ts).
    all = hasFlag(args, 'all');
    tag = flag(args, 'tag');
    const rawLimit = flag(args, 'limit');
    if (rawLimit === null) {
      limit = DEFAULT_LIMIT;
    } else {
      limit = Number(rawLimit);
      if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit <= 0) {
        say(out, `my_context: --limit takes a positive whole number ` +
          `(got ${JSON.stringify(rawLimit)}).`);
        return 1;
      }
    }
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }

  // `Object.hasOwn`, not a bare index, for the prototype hazard `resolveCategory`
  // and `tierOf` (core/mutate.ts, core/trust.ts) both document. A `todo` absent
  // from config altogether fails CLOSED to `normative`, exactly as `tierOf`
  // does: the honest inverse disclosure is the safe one to print when the
  // category that would have justified the guarantee has gone missing.
  const category: ResolvedCategory | null =
    Object.hasOwn(ws.config.categories, 'todo') ? ws.config.categories.todo : null;
  const tier: Tier = category?.tier ?? 'normative';

  const { ctx, errors } = openMutateContext(ws);
  const corpus = ctx.store.all();
  ctx.store.close();

  // One predicate, not a second copy — see the file comment. `layer` is
  // deliberately not filtered: a global-layer todo is still one of yours to
  // read, and unlike the review queue there is no write at the end of this
  // list for the layer to make impossible.
  //
  // No sort, for the reason `search` gives: the order is `store.all()`'s
  // `ORDER BY id`, and a `localeCompare` pass on top of it would be a second
  // ordering rule that agrees with SQLite's collation on this repo's ids and
  // would silently disagree on a mixed-case one — two surfaces listing the
  // same corpus in two orders, which is the drift this file exists not to add.
  const matched: Item[] = filterItems(corpus, { type: 'todo', tag }, ws.config);
  const retired = matched.filter((i) => RETIRED_STATUSES.has(i.status));
  const kept = all ? matched : matched.filter((i) => !RETIRED_STATUSES.has(i.status));
  const shown = kept.slice(0, limit);
  const truncated = kept.length > shown.length;
  const retiredHidden = all ? 0 : retired.length;

  if (json) {
    emitJson(out, {
      items: shown.map((i) => ({
        id: i.id, status: i.status, title: i.title, origin: i.origin, layer: i.layer,
        tags: i.tags, sourceFile: i.sourceFile, filePath: i.filePath,
      })),
      count: shown.length,
      matched: kept.length,
      retiredHidden,
      truncated,
      limit,
      tag,
      all,
      tier,
      // The consequence, not just the tier name, so a machine reader does not
      // have to re-derive the one fact the prose exists to state.
      injected: tier === 'normative',
      categoryEnabled: category?.enabled ?? false,
      loadErrors: errors.map((e: LoadError) => ({ file: e.file, message: e.message })),
    });
    return 0;
  }

  /**
   * The paragraphs that follow the list at every detail level, in one place so
   * the empty inbox and the full one disclose the same facts.
   *
   * Blank-line separated, because they are separate claims: run together they
   * read as one wall in which the hidden-item count — the only line that is
   * about this run rather than about the category — is the easiest to miss.
   */
  const disclose = (): void => {
    const blocks: string[] = [];
    if (truncated) {
      blocks.push(`${kept.length} todo item(s); ${shown.length} shown. Raise the cap with ` +
        `--limit ${kept.length}, or narrow it with --tag.`);
    }
    if (retiredHidden > 0) {
      // Hidden is fine; unmentioned is not. The count is disclosed even when
      // it is the only thing there is to say — an inbox that prints "no todo
      // items" while holding four deprecated ones is the silent-empty-answer
      // failure `list` and `search` were both fixed for.
      blocks.push(`${retiredHidden} retired (superseded/deprecated/validated) and not shown — ` +
        '`mycontext todo --all` lists them too.');
    }
    if (category !== null && !category.enabled) {
      blocks.push('The `todo` category is disabled in this project\'s config, so ' +
        '`mycontext add todo` will refuse. Disabling is not deletion: whatever was captured ' +
        'before it was switched off is still on disk, still indexed, and still listed here.');
    }
    blocks.push(...tierParagraphs(tier));
    for (const [i, text] of blocks.entries()) {
      if (i > 0) out('');
      say(out, text);
    }
  };

  if (detail === 'summary') {
    const counts = new Map<string, number>();
    for (const item of kept) counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
    for (const line of table(
      ['status', 'items'],
      [...counts].sort((a, b) => a[0].localeCompare(b[0])).map(([status, n]) => [status, String(n)]),
    )) out(line);
    if (kept.length) out('');
    out(`${kept.length} todo item(s)`);
    out('');
    disclose();
    emitLoadErrors(errors, out);
    return 0;
  }

  if (shown.length === 0) {
    // Said out loud, with the next move — never zero lines. An empty inbox is
    // not an error, so this exits 0.
    out(tag === null
      ? 'my_context: no todo items.'
      : `my_context: no todo items tagged "${tag}".`);
    out('');
    say(out, 'Capture one the moment it occurs to you: `mycontext add todo "<what to do>"`. ' +
      'It takes no category decision and no review.');
    out('');
    disclose();
    emitLoadErrors(errors, out);
    return 0;
  }

  const rendered = detail === 'full'
    ? records(FULL_HEADERS, shown.map((i) => cells(i, detail)))
    : table(HEADERS, shown.map((i) => cells(i, detail)));
  for (const line of rendered) out(line);
  out('');
  disclose();

  // F2: this command did what it was asked, so an unrelated corpus load error
  // is a warning and not a failure — the rule `search`, `list` and `decay`
  // already follow, and the reason `emitLoadErrors` is called on every path.
  emitLoadErrors(errors, out);
  return 0;
}

registerCommand({
  name: 'todo',
  usage: `todo [--tag <t>] [--all] [--limit <n>] ${DETAIL_USAGE}`,
  summary: 'the inbox: what you jotted down, and what it is not',
  run: (ws, args, out) => cmdTodo(ws, args, out),
});
