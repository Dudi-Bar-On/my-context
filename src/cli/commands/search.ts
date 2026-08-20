import { scopePolicyFor } from '../../core/config.ts';
import type { LoadError } from '../../core/rebuild.ts';
import { RELATION_TYPES } from '../../core/vocabulary.ts';
import { STATUSES } from '../../core/validate.ts';
import { scopeCell } from '../../core/render-item.ts';
import { anyFilterSet, filterItems, type ItemFilters } from '../../core/search.ts';
import { enumError } from '../../core/teach.ts';
import type { Item, Status } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import {
  DETAIL_FLAGS, DETAIL_USAGE, detailLevel, emitJson, paragraph, records, refuseUnknownFlag,
  table, wantsJson,
} from './format.ts';
import { flag, positionals, registerCommand, type Emit } from './registry.ts';

/**
 * `mycontext search` — the CLI counterpart `query_items` did not have.
 *
 * Until Phase 4 this was the project's one *named* surface asymmetry: the
 * model could filter the corpus by text, tag, path or relation through
 * `query_items`, `/mycontext:search` called that tool, and a person at a
 * terminal had no command that did it. `mycontext list <category>` filters by
 * one field and `mycontext query "SELECT …"` requires SQL; neither is "find
 * the items that mention the connection pool". The owner's requirement —
 * anything the model can do through a tool, the user can do through a command
 * — had exactly one counterexample, and this is it closed rather than
 * recorded as an exception.
 *
 * **The predicate is not reimplemented here.** `filterItems`
 * (src/core/search.ts) is the one copy, called by this command and by the
 * tool. Only the rendering differs, and it differs on purpose: the tool
 * answers a model with one line per item, this answers a person with the same
 * table `mycontext list` prints, at the same detail levels, so the two reports
 * a user reads side by side line up.
 *
 * A previously false sentence this closes: `mycontext edit` used to tell a
 * user who mistyped an id to "find it with `mycontext query --text "…"`" — a
 * flag `query` has never accepted and would refuse as unknown. The command
 * that message described is the one below.
 */

const VALUE_FLAGS = ['text', 'type', 'tag', 'path', 'status', 'relation', 'limit'];
const ALLOWED = [...VALUE_FLAGS, ...DETAIL_FLAGS];

const USAGE = `usage: mycontext search "<words>" ${DETAIL_USAGE}
       mycontext search [--text "<words>"] [--type <category>] [--tag <tag>]
                        [--path <file>] [--status <status>] [--relation <type>]
                        [--limit <n>] ${DETAIL_USAGE}

A bare positional is the --text filter, so \`mycontext search "connection pool"\` and
\`mycontext search --text "connection pool"\` are the same search. Filters are AND-ed;
--text matches a substring of the title, body, any observation or any extra value,
      case-insensitively. --path asks what
governs a file and therefore returns the UNSCOPED items too, because an item with no
scope applies everywhere.

At least one filter is required. To list the whole corpus, that is \`mycontext list\`.`;

/** The default row cap, and the reason there is one: this prints a table to a
 * terminal, and a corpus-wide `--text e` is not an answer. `--limit` raises
 * it, and a truncation is always reported — never silent. */
const DEFAULT_LIMIT = 50;

function say(out: Emit, text: string): void {
  for (const line of paragraph(text)) out(line);
}

function cmdSearch(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, USAGE, out)) return 1;

  let detail;
  let json: boolean;
  let filters: ItemFilters;
  let limit: number;
  try {
    detail = detailLevel(args);
    json = wantsJson(args);

    const positional = positionals(args, VALUE_FLAGS);
    if (positional.length > 1) {
      say(out, `my_context: unexpected argument "${positional[1]}" — search takes at most one ` +
        `bare phrase (the --text filter); every other filter is named with a flag.`);
      out(USAGE);
      return 1;
    }
    const text = flag(args, 'text');
    if (text !== null && positional.length === 1) {
      // Two spellings of one filter, both given. Honouring either would drop
      // the other without saying so, which is the one failure mode this
      // project rules out.
      say(out, `my_context: the phrase "${positional[0]}" and --text ${JSON.stringify(text)} are ` +
        `two spellings of the same filter, and there is no reading that honours both. Pass one.`);
      return 1;
    }

    const status = flag(args, 'status');
    if (status !== null && !(STATUSES as readonly string[]).includes(status)) {
      say(out, enumError('status', status, [...STATUSES], 'workflow'));
      return 1;
    }
    const relation = flag(args, 'relation');
    if (relation !== null && !RELATION_TYPES.includes(relation)) {
      say(out, enumError('relation', relation, RELATION_TYPES, 'workflow'));
      return 1;
    }

    filters = {
      text: text ?? positional[0] ?? null,
      type: flag(args, 'type'),
      tag: flag(args, 'tag'),
      path: flag(args, 'path'),
      status: (status as Status | null),
      relation,
    };

    const rawLimit = flag(args, 'limit');
    if (rawLimit === null) {
      limit = DEFAULT_LIMIT;
    } else {
      limit = Number(rawLimit);
      if (!Number.isFinite(limit) || limit <= 0 || !Number.isInteger(limit)) {
        say(out, `my_context: --limit takes a positive whole number (got ${JSON.stringify(rawLimit)}).`);
        return 1;
      }
    }
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }

  if (!anyFilterSet(filters)) {
    // Not answered with the whole corpus. `search` with no filter is almost
    // always a half-typed command, and printing every item in reply looks
    // like a successful search that found everything.
    say(out, 'my_context: search needs at least one filter. To list the whole corpus, ' +
      'run `mycontext list`.');
    out(USAGE);
    return 1;
  }

  const { ctx, errors } = openMutateContext(ws);
  const all = ctx.store.all();
  ctx.store.close();

  // A type filter that names no category and matches no stored item is a typo,
  // and answering it with "0 item(s)" is indistinguishable from "you have
  // none" — the silent-empty-answer failure `mycontext list` was fixed for.
  // `Object.hasOwn` for the prototype-safety reason `cmdList` documents.
  if (filters.type) {
    const configured = Object.hasOwn(ws.config.categories, filters.type);
    const inCorpus = all.some((item: Item) => item.type === filters.type);
    if (!configured && !inCorpus) {
      say(out, enumError('category', filters.type, Object.keys(ws.config.categories).sort(), 'categories'));
      emitLoadErrors(errors, out);
      return 1;
    }
  }

  const hits = filterItems(all, filters, ws.config);
  const shown = hits.slice(0, limit);
  const truncated = hits.length > shown.length;

  if (json) {
    emitJson(out, {
      items: shown.map((i) => ({
        id: i.id, type: i.type, status: i.status, title: i.title, origin: i.origin,
        layer: i.layer, severity: i.severity, always: i.always, scope: i.scope, tags: i.tags,
        sourceFile: i.sourceFile, filePath: i.filePath,
      })),
      count: shown.length,
      matched: hits.length,
      truncated,
      limit,
      loadErrors: errors.map((e: LoadError) => ({ file: e.file, message: e.message })),
    });
    return 0;
  }

  if (detail === 'summary') {
    const counts = new Map<string, number>();
    for (const item of hits) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
    for (const line of table(
      ['type', 'items'],
      [...counts].sort((a, b) => a[0].localeCompare(b[0])).map(([type, n]) => [type, String(n)]),
    )) out(line);
    if (hits.length) out('');
    out(`${hits.length} item(s) match`);
    emitLoadErrors(errors, out);
    return 0;
  }

  if (hits.length === 0) {
    // Said out loud, and with the next move, rather than printed as zero
    // lines: an empty search that looks like a crash is how a user concludes
    // their corpus is empty when their filter was wrong.
    out('0 item(s) match');
    say(out, 'Widen it: drop a filter, try a shorter phrase, or run `mycontext list` to see ' +
      'what is there.');
    emitLoadErrors(errors, out);
    return 0;
  }

  const lines = detail === 'full'
    ? records(
      ['id', 'type', 'status', 'origin', 'layer', 'scope', 'title'],
      shown.map((i) => [
        i.id, i.type, i.status, i.origin, i.layer,
        scopeCell(i, scopePolicyFor(ws.config, i.type)),
        i.title,
      ]),
    )
    // The same three columns `mycontext list` prints at this level, for the
    // reason recorded there: an id is a slug of the title, so a title column
    // beside it spends the widest column in the table on a fact the reader
    // already has.
    : table(['id', 'type', 'status'], shown.map((i) => [i.id, i.type, i.status]));
  for (const line of lines) out(line);

  if (truncated) {
    out('');
    say(out, `${hits.length} item(s) match; ${shown.length} shown. Raise the cap with ` +
      `--limit ${hits.length}, or narrow the search.`);
  }

  // F2: `search` did its job, so an unrelated corpus load error is a warning.
  emitLoadErrors(errors, out);
  return 0;
}

registerCommand({
  name: 'search',
  usage: `search "<words>" [--type|--tag|--path|--status|--relation|--limit] ${DETAIL_USAGE}`,
  summary: 'find items by text, type, tag, path or relation',
  run: cmdSearch,
});
