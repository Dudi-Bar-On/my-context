#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { scopePolicyFor, type Config } from '../core/config.ts';
import { renderItem } from '../core/item.ts';
import { scopeCell } from '../core/render-item.ts';
import {
  createItem, scopeRequirementError, SEVERITIES, type CreateInput, type MutationContext,
} from '../core/mutate.ts';
import type { Severity } from '../core/types.ts';
import { isMainEntry } from '../core/paths.ts';
import { pruneSnapshots } from '../core/ledger.ts';
import { rebuild, type LoadError } from '../core/rebuild.ts';
import { Store } from '../core/store.ts';
import {
  DIR_NAME, GLOBAL_DIR, findProjectRoot, resolveWorkspace, type Workspace,
} from '../core/workspace.ts';
import { HELP_TOPICS, exampleItem, exampleItemShort, helpTopic } from '../help/index.ts';
import { enumError } from '../core/teach.ts';
import './commands/index.ts';
import { emitLoadErrors, toCliMessage } from './commands/context.ts';
import {
  DETAIL_FLAGS, DETAIL_USAGE, col, detailLevel, emitJson, records, refuseUnknownFlag, table,
  unknownFlag, wantsJson,
} from './commands/format.ts';
import {
  COMMANDS, csv, dedupe, flagOccurrences, positionals, repeatedFlagError,
} from './commands/registry.ts';
import { confirmAction } from './commands/review.ts';

type Emit = (s: string) => void;

/**
 * The `categories:` line has to list only what `mycontext add` will actually
 * accept, and that is the *resolved*, per-workspace config rather than
 * `CATEGORIES` (the built-in catalog): a project on the `minimal` profile
 * enables eight of the twenty, and any project can switch one off with
 * `categories.<name>.enabled` or declare one the catalogue has never heard
 * of. `resolveCategory` refuses a disabled name, so a banner built from the
 * static catalog would advertise captures that then fail. Same source
 * `mycontext_help("categories")` already renders its table from.
 */
// Every line of the shipped block below is retained verbatim, `help` and
// `examples` included: they are still real `case` arms, and dropping them
// from usage would hide two working commands. Only Task 15 removes a line
// here, when `status` genuinely moves into the registry.
function usage(config: Config): string {
  const enabled = Object.values(config.categories)
    .filter((c) => c.enabled)
    .map((c) => c.name);
  const registered = [...COMMANDS.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    // `col`, not `padEnd`: several usage strings are now longer than the
    // column (every reporting command carries `[--full|--short|--summary]
    // [--json]`), and `padEnd` ran those straight into their summary with no
    // gap at all — the same collision `col` exists to prevent in the reports.
    .map((c) => `  ${col(c.usage, 30)}${c.summary}`)
    .join('\n');
  const builtin: [string, string][] = [
    ['init', 'create .my_context in the current directory'],
    // The flag list is on the summary side because the usage column is 30
    // wide and `col` would otherwise push every other summary out of line —
    // but it is here rather than nowhere: a banner that stops at `<title>`
    // is what let the CLI look title-only for three plans.
    ['add <category> <title> [opts]', 'create an item (--body --scope --tags --severity --yes)'],
    [`list [category] ${DETAIL_USAGE}`, 'list items'],
    ['show <id>', 'print an item'],
    ['rebuild', 'rebuild the index from Markdown'],
    ['help [topic]', `guidance: ${HELP_TOPICS.join(', ')}`],
    ['examples <category> [--short]', 'print an example item (--short: the distinctive fields)'],
  ];
  return `usage: mycontext <command> [args]

${builtin.map(([u, s]) => `  ${col(u, 30)}${s}`).join('\n')}
${registered}

categories: ${enabled.join(', ')}`;
}

function requireWorkspace(ws: Workspace, out: Emit): string | null {
  if (ws.projectRoot) return ws.projectRoot;
  out('my_context: no workspace here. Run `mycontext init` to create one.');
  return null;
}

/** The `{ project, global }` roots rebuild() expects, derived once per workspace. */
function rebuildRoots(ws: Workspace): { project?: string; global?: string } {
  return {
    project: ws.projectRoot ?? undefined,
    global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
  };
}

/**
 * Opens the store and rebuilds the index from Markdown. The rebuild errors
 * are returned, never discarded: a corrupt item file must not let a caller
 * report success while silently dropping authored knowledge. If the rebuild
 * itself throws (as opposed to recording a per-file LoadError), the store is
 * closed before the exception propagates so no handle leaks.
 */
export function openStore(ws: Workspace): { store: Store; errors: LoadError[] } {
  const store = Store.open(ws.dbPath);
  try {
    const result = rebuild(store, rebuildRoots(ws), ws.config);
    return { store, errors: result.errors };
  } catch (err) {
    store.close();
    throw err;
  }
}

const INIT_USAGE = 'usage: mycontext init   (it takes no arguments)';

/**
 * The extra sentence one refused argument earns, keyed by the flag name — the
 * same shape `ARGUMENT_HINTS` (mcp/tools.ts) uses, and for the same reason:
 * the difference between "no" and "here".
 *
 * `--global` is the one this exists for. It is the sharpest
 * accepted-and-ignored case the audit found: `mycontext init --global` printed
 * `initialized …\.my_context` and created a PROJECT layer, so a user who asked
 * for the global corpus got a project one under a message that named neither
 * the flag nor the discrepancy. It cannot be honoured here either — the global
 * layer is a directory nothing creates (README, "Creating one, today") — so
 * the refusal names the documented route instead of inventing a second one.
 */
const INIT_ARGUMENT_HINTS: Record<string, string> = {
  global:
    '--global: this command creates a PROJECT workspace in the directory it is run in, and ' +
    `there is no flag that changes that. The global layer is ${GLOBAL_DIR}, and no command ` +
    'creates one or writes to one: build an ordinary workspace somewhere else and move the ' +
    'directory it made into that path. See README, "The global layer — Creating one, today".',
};

/**
 * `mycontext init` takes no arguments, and now says so.
 *
 * It used to accept `argv` and never look at it — `runCli` called
 * `cmdInit(cwd, out)` — so every flag and every positional was swallowed
 * whole: `init --global`, `init --nonsense-flag zzz` and `init ../elsewhere`
 * all printed the same "initialized" line for the same project workspace in
 * the current directory. Refusing rather than absorbing is
 * INV-nothing-is-dropped-silently; the flag names are echoed back so the
 * refusal identifies which token it is about.
 */
function cmdInit(cwd: string, args: string[], out: Emit): number {
  if (args.length > 0) {
    out(
      `my_context: init takes no arguments, and ${args.map((a) => JSON.stringify(a)).join(', ')} ` +
      `${args.length === 1 ? 'was' : 'were'} passed. Nothing was created — an argument this ` +
      `command cannot act on is refused rather than ignored.\n${INIT_USAGE}`,
    );
    const hints = args
      // `--name`, `--name=value` and `-name` all reach the same hint; a bare
      // positional has none and is covered by the refusal above.
      .map((a) => INIT_ARGUMENT_HINTS[a.replace(/^-+/, '').split('=')[0]])
      .filter((hint): hint is string => hint !== undefined);
    for (const hint of [...new Set(hints)]) out(hint);
    return 1;
  }

  const root = path.join(cwd, DIR_NAME);
  if (existsSync(root)) { out(`my_context: ${root} already exists.`); return 1; }

  const ancestor = findProjectRoot(cwd);
  if (ancestor) {
    out(
      `my_context: warning: an existing workspace was found at ${ancestor}. ` +
      `Its items will not be visible from ${root} once this workspace is created, ` +
      `because the nearer workspace shadows it.`,
    );
  }

  mkdirSync(path.join(root, 'items'), { recursive: true });
  writeFileSync(
    path.join(root, 'config.json'),
    JSON.stringify({ profile: 'standard', categories: {}, budgets: {} }, null, 2) + '\n',
  );
  writeFileSync(path.join(root, '.gitignore'), '.index.db\n.index.db-*\n');
  out(`my_context: initialized ${root}`);
  return 0;
}

const ADD_USAGE =
  'usage: mycontext add <category> <title> [--body <text>] [--scope "a/**,b/**"] ' +
  '[--tags "a,b"] [--severity hard|soft] [--yes]';

/** The value-taking flags of `mycontext add`, in the form `positionals` wants. */
const ADD_VALUE_FLAGS = ['body', 'scope', 'tags', 'severity'];
/** Every flag `mycontext add` accepts. Anything else is refused, not absorbed. */
const ADD_FLAGS = [...ADD_VALUE_FLAGS, 'yes'];

/**
 * Every occurrence of `--name`, each checked for the two ways a bare value
 * flag loses its value silently. `flagOccurrences` answers `{value: null}` for
 * "`--body` with nothing after it", and it hands back the NEXT OPTION as the
 * value of a bare `--body`; both drop or corrupt authored content while the
 * command still reports success, which is the class of defect this whole
 * command is being fixed for. Only the bare `--name value` form can hit
 * either: `--name=` is a deliberate empty value and `--name=x` is
 * unambiguous, so the `bare` flag on each occurrence decides.
 *
 * The occurrences come from the shared scanner rather than a second scan of
 * argv, so this cannot disagree with `positionals` about which token is a
 * value.
 */
function addValues(args: string[], name: string): string[] {
  const long = `--${name}`;
  return flagOccurrences(args, name).map((occurrence) => {
    if (!occurrence.bare) return occurrence.value ?? '';
    if (occurrence.value === null) {
      throw new Error(`my_context: ${long} needs a value. ${ADD_USAGE}`);
    }
    if (occurrence.value.startsWith('--')) {
      throw new Error(
        `my_context: ${long} was followed by ${JSON.stringify(occurrence.value)}, which is ` +
        `another option, not a value. Write ${long}="..." if the value really begins with ` +
        `"--". ${ADD_USAGE}`,
      );
    }
    return occurrence.value;
  });
}

/** `--body`/`--severity`: one value, or a refusal — see `flag` in registry.ts. */
function scalarFlag(args: string[], name: string): string | null {
  const values = addValues(args, name);
  if (values.length > 1) throw repeatedFlagError(name, values);
  return values[0] ?? null;
}

/**
 * `--scope`/`--tags`: every occurrence, comma-split and concatenated — see
 * `listFlag` in registry.ts, whose behaviour this reproduces on top of the
 * per-occurrence checks above rather than duplicating the collection rule.
 */
function listValues(args: string[], name: string): string[] | null {
  const values = addValues(args, name);
  if (values.length === 0) return null;
  return dedupe(values.flatMap(csv));
}

/**
 * F3 fix: this used to hardcode `origin: 'human'`/`status: 'active'` and
 * call `writeItem` directly, bypassing `mutate.ts` entirely — and with it
 * the trust model, idempotency/id-family dedup, `extra`-key validation, enum
 * validation, and the `validateBody`/`validateObservationText` round-trip
 * guards. Routing through `createItem` closes all of that in one place
 * instead of a second, divergent copy of it living here. `origin: 'human'`
 * is still passed explicitly — `mycontext add` is a human-facing CLI
 * command, and `trustedStatus` demotes every non-`human` origin, so a
 * human's item still lands `active`, same as before.
 *
 * `--body`/`--scope`/`--tags` are plumbed straight through to `createItem`,
 * which already took all three. Without them the only human route to a real
 * item (one with a reason and a scope) was hand-editing the Markdown — which
 * is what the write-deny hook exists to stop — so every generated slash
 * command had to route through the MCP `create_item` tool and disclaim the
 * CLI as "captures the title only". `observations` and `relations` are still
 * not expressible here: an observation is a four-field record (category,
 * text, tags, context) with round-trip constraints of its own, and no flat
 * flag spelling expresses it without inventing a second mini-format. The
 * unknown-flag message names `create_item` for that reason.
 *
 * The `--yes` gate on a normative category is `review promote`'s gate, for
 * `review promote`'s reason (see `confirmAction`'s doc comment, which this
 * imports rather than restates): `mycontext add rule "..."` writes an item
 * that governs this repository the moment it lands, with no draft step in
 * between, so the act should be as explicit as promoting one. It is NOT a
 * security boundary — anything that can run `mycontext` can pass `--yes` —
 * and no message here says otherwise; what it buys is that a governing item
 * cannot come into existence without an explicit, greppable token in the
 * transcript that created it. Rationale-tier categories are ungated: nothing
 * in that tier is auto-injected. The tier is read from the RESOLVED config
 * (`ws.config.categories`), not the built-in catalog, so a per-project tier
 * override is covered — the same source `trustedStatus`'s callers read it
 * from. `Object.hasOwn` guards the prototype-pollution hazard `resolveCategory`
 * and `tierOf` (mutate.ts) document: a category named `constructor` would
 * otherwise resolve to `Object.prototype.constructor` and skip the gate.
 */
function cmdAdd(ws: Workspace, args: string[], out: Emit): number {
  const root = requireWorkspace(ws, out);
  if (!root) return 1;

  let input: CreateInput;
  try {
    // `unknownFlag` (format.ts) carries the general reasoning. What is
    // specific to `add`, and is why this was the first command to get the
    // check: `add` used to build its title from `args.slice(1).join(' ')`, so
    // `add rule "Never log secrets" --body "..."` created a rule literally
    // titled `Never log secrets --body ...` and reported success — and that
    // was the documented fallback invocation, i.e. the shape most likely to
    // produce it. The message below names `create_item` because observations
    // and relations genuinely have no flag spelling here.
    const unknown = unknownFlag(args, ADD_FLAGS, ADD_VALUE_FLAGS);
    if (unknown !== null) {
      out(
        `my_context: unknown option "--${unknown}".\n${ADD_USAGE}\n` +
        `Observations and relations cannot be given on the command line — capture those with ` +
        `the create_item tool on the mycontext MCP server.`,
      );
      return 1;
    }

    const words = positionals(args, ADD_VALUE_FLAGS);
    const category = words[0];
    const title = words.slice(1).join(' ');
    if (!category || !title) { out(ADD_USAGE); return 1; }

    input = { type: category, title, origin: 'human' };
    const body = scalarFlag(args, 'body');
    const scope = listValues(args, 'scope');
    const tags = listValues(args, 'tags');
    const severity = scalarFlag(args, 'severity');
    if (body !== null) input.body = body;
    if (scope !== null) input.scope = scope;
    if (tags !== null) input.tags = tags;
    // Validated here rather than left to `createItem`'s `validateEnums`, for
    // the reason `review promote` validates its own `--severity` up front: a
    // garbled value must refuse before the normative preview and confirmation
    // prompt below, not after a human has already been asked to approve a
    // capture that was never going to land. The message and the vocabulary are
    // `validateEnums`' own — `SEVERITIES` and `enumError` are imported, not
    // restated — so this surface cannot drift from `create_item`'s.
    if (severity !== null) {
      if (!(SEVERITIES as string[]).includes(severity)) {
        throw new Error(enumError('severity', severity, SEVERITIES, 'capture'));
      }
      input.severity = severity as Severity;
    }

    const resolved = Object.hasOwn(ws.config.categories, category)
      ? ws.config.categories[category]
      : undefined;
    // `scopePolicy: "required"` is refused HERE as well as inside
    // `createItem`, which is where it is actually enforced for every surface.
    // The duplication is of the CALL, not of the rule — one function
    // (`scopeRequirementError`, mutate.ts) owns the wording and the
    // condition — and it buys the ordering: without it a human would be asked
    // "create this item that governs the project?" and only then told the
    // capture was never going to land.
    if (resolved) {
      const refusal = scopeRequirementError(resolved, input.scope);
      if (refusal) throw new Error(refusal);
    }
    if (resolved?.enabled && resolved.tier === 'normative') {
      // Printed before the gate and regardless of `--yes`, the way `review
      // promote` prints its preview: `confirmAction` only asks its question
      // on a TTY, so without this line the non-interactive refusal ("stdin is
      // not interactive") would never say WHICH capture it declined — and the
      // non-interactive path is the one a hook or a script takes.
      out(`about to create ${category} "${title}" — active, and governing this project at once.`);
      if (!confirmAction(
        args, out,
        `Create ${category} "${title}" as an active item that governs this project?`,
      )) return 1;
    }
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }

  const { store, errors } = openStore(ws);
  try {
    const ctx: MutationContext = { root, store, config: ws.config };
    const result = createItem(ctx, input);
    out(result.message);
    // F2: `add` did what it was asked — the item exists on disk and in the
    // index. A load error elsewhere in the corpus is still reported (never
    // silenced — INV-nothing-is-dropped-silently), but it does not turn a
    // successful command into a failure. Only `status` and `doctor`, whose
    // whole job is reporting corpus health, exit non-zero on it.
    emitLoadErrors(errors, out);
    return 0;
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  } finally {
    store.close();
  }
}

const LIST_USAGE = `usage: mycontext list [category] ${DETAIL_USAGE}`;

function cmdList(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;

  // The same silent swallow `cmdAdd` was fixed for, and — until this round —
  // the only reporting command that had it, while the README claimed all six
  // did. The shared helper now lives in format.ts beside `DETAIL_USAGE`; see
  // `unknownFlag`'s doc comment there for the reasoning, which was written
  // here first.
  if (refuseUnknownFlag(args, DETAIL_FLAGS, [], LIST_USAGE, out)) return 1;

  let detail;
  let json: boolean;
  try {
    detail = detailLevel(args);
    json = wantsJson(args);
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }

  const { store, errors } = openStore(ws);
  // `positionals`, not `args[0]`: `mycontext list --json requirement` would
  // otherwise filter on the literal string "--json" and list nothing, which
  // is the silent-empty-answer failure rather than an error.
  const filter = positionals(args, [])[0];
  const all = store.all();
  store.close();

  // The same silent-empty-answer failure the `positionals` note above
  // describes, reached by the other route: `mycontext list constraintt`
  // printed nothing at all and exited 0, which a reader cannot tell apart
  // from "you have no constraints". `add` has refused a misspelled category
  // with a closest-match suggestion since it was written; this reuses that
  // message (`enumError`, the same helper `resolveCategory` in mutate.ts
  // calls) rather than growing a second, drifting copy.
  //
  // Two things this deliberately does NOT refuse, because refusing either
  // would be a new silent drop — the one failure mode
  // INV-nothing-is-dropped-silently rules out:
  //
  //  - a category that exists but is DISABLED. Disabling is non-destructive
  //    by design: `resolveCategory` stops NEW items being created, but the
  //    items captured before the category was turned off are still on disk
  //    and still indexed, and `list <that category>` is how you find them.
  //    So the allowed set below is every category in the resolved config,
  //    enabled or not — not `add`'s enabled-only set.
  //  - a type that is absent from config altogether but PRESENT in the
  //    corpus (a category renamed or deleted after items were captured;
  //    `loadLayer` in rebuild.ts indexes such items on purpose, precisely so
  //    they can still be found). Those items must stay reachable by name.
  //
  // `Object.hasOwn`, not a bare `in`/index: a positional of `constructor`
  // would otherwise resolve through `Object.prototype` and be accepted as a
  // real category — the same hazard `resolveCategory` and `tierOf`
  // (mutate.ts) document.
  if (filter !== undefined) {
    const configured = Object.hasOwn(ws.config.categories, filter);
    const inCorpus = all.some((item) => item.type === filter);
    if (!configured && !inCorpus) {
      out(enumError('category', filter, Object.keys(ws.config.categories).sort(), 'categories'));
      // Reported even on the refusal path — `list` failed at its own job, so
      // the exit code is 1 (F2 governs UNRELATED load errors, not a usage
      // error of the command itself), but the load error is never swallowed.
      emitLoadErrors(errors, out);
      return 1;
    }
  }

  const items = all.filter((item) => !filter || item.type === filter);

  if (json) {
    emitJson(out, {
      items: items.map((i) => ({
        id: i.id, type: i.type, status: i.status, title: i.title, origin: i.origin,
        layer: i.layer, severity: i.severity, always: i.always, scope: i.scope, tags: i.tags,
        sourceFile: i.sourceFile, filePath: i.filePath,
      })),
      count: items.length,
      loadErrors: errors.map((e) => ({ file: e.file, message: e.message })),
    });
    return 0;
  }

  if (detail === 'summary') {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
    for (const line of table(
      ['type', 'items'],
      [...counts].sort((a, b) => a[0].localeCompare(b[0])).map(([type, n]) => [type, String(n)]),
    )) out(line);
    if (items.length) out('');
    out(`${items.length} item(s)`);
    emitLoadErrors(errors, out);
    return 0;
  }

  // An empty result at a row-printing detail level used to be zero lines of
  // output — indistinguishable from a command that had crashed before
  // printing, and the very thing that made a misspelled category invisible.
  // The refusal above now covers the typo; this covers the real, valid,
  // genuinely-empty case, which must still say so out loud. `--summary`
  // already prints its own `N item(s)` line below.
  if (items.length === 0) {
    out('0 item(s)');
    emitLoadErrors(errors, out);
    return 0;
  }

  // `--full` is a stanza per item, not a seventh column bolted onto the table:
  // see `records` (format.ts) for the arithmetic that rules the table out at
  // this level. Same fields, same order, nothing dropped.
  const lines = detail === 'full'
    ? records(
      ['id', 'type', 'status', 'origin', 'layer', 'scope', 'title'],
      items.map((i) => [
        i.id, i.type, i.status, i.origin, i.layer,
        // `scopeCell`, not an inlined ternary: this printed `-` for an empty
        // scope while `decay --full` printed something else for the same field
        // of the same item. See `SCOPE_UNRESTRICTED` (core/render-item.ts).
        scopeCell(i, scopePolicyFor(ws.config, i.type)),
        i.title,
      ]),
    )
    // No `title` column at the scanning levels: an id is a slug of the title
    // (`makeId`, slug.ts), so the two widest columns in this table carried one
    // fact between them — `CONST-node-24-no-build-step` beside "Node 24 or
    // newer, and no build step" — and together they made the default report
    // 192 columns on this repository's own corpus. The title is still the
    // whole of `show`, and `--full` above still prints it in full.
    //
    // Nothing takes its place. At a 64-character id the 100-column budget
    // (`OUTPUT_WIDTH`, format.ts) has about thirty columns left for every
    // other field, and `id`/`type`/`status` already spend them: adding
    // `origin` puts the table back over the budget (106), `scope` far past it,
    // `severity` asserts hard-or-soft on rationale items where it means
    // nothing, and `layer` is `project` for every item in a project that has
    // no global layer. All five remain on `--full` and `--json`, which are the
    // levels that exist to carry them.
    : table(['id', 'type', 'status'], items.map((i) => [i.id, i.type, i.status]));
  for (const line of lines) out(line);

  // F2: see the comment in cmdAdd — `list` succeeded at listing, so a load
  // error elsewhere is a warning, not a failure.
  emitLoadErrors(errors, out);
  return 0;
}

function cmdShow(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;
  const id = args[0];
  if (!id) { out('usage: mycontext show <id>'); return 1; }

  const { store, errors } = openStore(ws);
  const item = store.get(id);
  store.close();
  if (!item) {
    out(`my_context: no item with id "${id}".`);
    emitLoadErrors(errors, out);
    return 1;
  }
  out(renderItem(item));
  // F2: `show` found and printed the item it was asked for; an unrelated
  // load error is a warning, not a failure — see the comment in cmdAdd.
  emitLoadErrors(errors, out);
  return 0;
}

function cmdRebuild(ws: Workspace, out: Emit): number {
  const root = requireWorkspace(ws, out);
  if (!root) return 1;
  const store = Store.open(ws.dbPath);
  let result;
  try {
    result = rebuild(store, rebuildRoots(ws), ws.config);
  } finally {
    store.close();
  }
  out(`my_context: indexed ${result.loaded} item(s)`);

  // `state/` holds one restore snapshot per session and never prunes itself
  // otherwise; sweep entries older than the retention window (30 days — see
  // SNAPSHOT_MAX_AGE_MS) here so a project used daily doesn't accumulate
  // them without bound. Best-effort: pruneSnapshots never throws.
  const pruned = pruneSnapshots(root);
  if (pruned > 0) out(`my_context: pruned ${pruned} stale snapshot file(s) from state/`);

  // F2: `rebuild` did its job — it indexed everything it could parse — so
  // an unparseable item elsewhere is a warning, not a failure; see the
  // comment in cmdAdd. `status`/`doctor` remain the commands that fail their
  // exit code on a load error.
  emitLoadErrors(result.errors, out);
  return 0;
}

function cmdHelp(ws: Workspace, args: string[], out: Emit): number {
  const topic = args[0];
  if (!topic) {
    out(usage(ws.config));
    out('');
    out(`help topics: ${HELP_TOPICS.join(', ')}`);
    out('  e.g. mycontext help scope');
    return 0;
  }
  try {
    out(helpTopic(topic, ws.config));
    return 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

const EXAMPLES_USAGE = 'usage: mycontext examples <category> [--short]';

function cmdExamples(ws: Workspace, args: string[], out: Emit): number {
  // Refused before anything is printed — see `unknownFlag` (format.ts). This
  // command took `args[0]` and ignored everything after it, so `mycontext
  // examples rule --shrot` printed the full item and exited 0: the reader
  // asked for the short form, was handed the long one, and was told nothing.
  if (refuseUnknownFlag(args, ['short'], [], EXAMPLES_USAGE, out)) return 1;

  const type = args.find((a) => !a.startsWith('--'));
  if (!type) { out(EXAMPLES_USAGE); return 1; }
  const short = args.includes('--short');
  try {
    out(short ? exampleItemShort(type, ws.config) : exampleItem(type, ws.config));
    return 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

export function runCli(argv: string[], cwd: string, out: Emit): number {
  const [command, ...args] = argv;

  try {
    if (command === 'init') return cmdInit(cwd, args, out);

    const ws: Workspace = resolveWorkspace(cwd);

    // The banner's `categories:` line is a function of the resolved,
    // per-workspace config (see `usage()`), so it can only be built once the
    // workspace is known — which is also true for every other command, so
    // this no longer needs to short-circuit ahead of `resolveWorkspace`.
    if (!command || command === '--help') { out(usage(ws.config)); return command ? 0 : 1; }

    switch (command) {
      case 'add':     return cmdAdd(ws, args, out);
      case 'list':    return cmdList(ws, args, out);
      case 'show':    return cmdShow(ws, args, out);
      case 'rebuild': return cmdRebuild(ws, out);
      case 'help':     return cmdHelp(ws, args, out);
      case 'examples': return cmdExamples(ws, args, out);
      default: {
        const registered = COMMANDS.get(command);
        if (registered) return registered.run(ws, args, out, cwd);
        out(`my_context: unknown command "${command}".\n\n${usage(ws.config)}`);
        return 1;
      }
    }
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  process.exitCode = runCli(process.argv.slice(2), process.cwd(), (s) => console.log(s));
}
