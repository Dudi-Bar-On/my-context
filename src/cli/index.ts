#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { resolveConfig, scopePolicyFor, type Config } from '../core/config.ts';
import { renderItem } from '../core/item.ts';
import { scopeCell } from '../core/render-item.ts';
import { createItem, type CreateInput, type MutationContext } from '../core/mutate.ts';
import { scopeRequirementError } from '../core/trust.ts';
import { normalizeSteps, SEVERITIES } from '../core/validate.ts';
import type { Severity } from '../core/types.ts';
import { isMainEntry } from '../core/paths.ts';
import { pruneSnapshots } from '../core/ledger.ts';
import {
  largestFullTextBudget, readSnapshot, snapshotBudgetLine, snapshotSizeLine,
} from '../core/reference.ts';
import { openRebuiltStore } from '../core/open-store.ts';
import type { LoadError } from '../core/rebuild.ts';
import type { Store } from '../core/store.ts';
import {
  DIR_NAME, GLOBAL_DIR, findProjectRoot, resolveWorkspace, type Workspace,
} from '../core/workspace.ts';
import { HELP_TOPICS, docLocale, exampleItem, exampleItemShort, helpTopic } from '../help/index.ts';
import { enumError } from '../core/teach.ts';
import { renderCollisionReport, type CollisionReport } from '../pack/collide.ts';
import {
  applyImport, planImport, type ImportOutcome, type ImportPlan,
} from '../pack/import.ts';
import { readArtefact } from '../pack/reader.ts';
import './commands/index.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './commands/context.ts';
import { outcomeLines, reportOf } from './commands/pack.ts';
import {
  DETAIL_FLAGS, DETAIL_USAGE, col, detailLevel, emitJson, records, refuseUnknownFlag, table,
  unknownFlag, wantsJson,
} from './commands/format.ts';
import {
  COMMANDS, csv, dedupe, extraFlag, flag, flagOccurrences, positionals, registerCommand,
  repeatedFlagError,
  type CommandDef,
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
/**
 * The banner's first block, in reading order rather than alphabetical: the
 * lifecycle a new user meets first (`init`, `add`, `list`, `show`,
 * `rebuild`), then the two self-teaching commands. Presentation only — every
 * name here is an ordinary `COMMANDS` registration (see the block at the
 * bottom of this file), dispatched through the same registry lookup as
 * everything else, and a name in this list that is NOT registered throws at
 * banner time rather than silently vanishing from it.
 */
const BUILTIN_ORDER = ['init', 'add', 'list', 'show', 'rebuild', 'help', 'examples'];

function usage(config: Config): string {
  const enabled = Object.values(config.categories)
    .filter((c) => c.enabled)
    .map((c) => c.name);
  const line = (c: CommandDef): string =>
    // `col`, not `padEnd`: several usage strings are now longer than the
    // column (every reporting command carries `[--full|--short|--summary]
    // [--json]`), and `padEnd` ran those straight into their summary with no
    // gap at all — the same collision `col` exists to prevent in the reports.
    `  ${col(c.usage, 30)}${c.summary}`;
  const builtin = BUILTIN_ORDER.map((name) => {
    const def = COMMANDS.get(name);
    // A throw, not a skip: silently omitting a de-registered builtin from
    // the banner would hide a working command — or advertise the hole only
    // to whoever diffs the banner.
    if (!def) throw new Error(`my_context: builtin "${name}" is not registered.`);
    return line(def);
  });
  const registered = [...COMMANDS.values()]
    .filter((c) => !BUILTIN_ORDER.includes(c.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(line)
    .join('\n');
  return `usage: mycontext <command> [args]

${builtin.join('\n')}
${registered}

categories: ${enabled.join(', ')}`;
}

function requireWorkspace(ws: Workspace, out: Emit): string | null {
  if (ws.projectRoot) return ws.projectRoot;
  out('my_context: no workspace here. Run `mycontext init` to create one.');
  return null;
}

/**
 * Opens the store and rebuilds the index from Markdown — the CLI's name for
 * `openRebuiltStore` (core/open-store.ts), which owns the sequence, the
 * close-on-throw leak guard, and the reason the rebuild errors are returned
 * rather than discarded. The CLI takes the default no-retry policy: a
 * command is a single shot a human can rerun — see `OpenStoreOptions`.
 */
export function openStore(ws: Workspace): { store: Store; loaded: number; errors: LoadError[] } {
  return openRebuiltStore(ws);
}

const INIT_USAGE = 'usage: mycontext init [--pack <path>]';

/** The one flag `init` accepts, and it takes a value. */
const INIT_VALUE_FLAGS = ['pack'];

/**
 * The `config.json` a bare `mycontext init` writes.
 *
 * Named because `--pack` needs the SAME document twice and cannot be allowed
 * to spell it a second time: it is what the pack's categories are merged over
 * (`mergePackConfig` starts from a clone of it), and it is what the merge is
 * resolved against so that §6n.1's "a pack may never re-tier a category that
 * already resolves here" is asked about the vocabulary this workspace is about
 * to have. Two spellings would drift, and the drift would show up as a pack
 * being refused — or accepted — for a category the file it lands in does not
 * actually carry.
 */
const INIT_CONFIG = { profile: 'standard', categories: {}, budgets: {} } as const;

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
 *
 * The two `--pack` brought with it are both about a gate that is ABSENT here
 * rather than merely unanswered, which is the sort of thing a user is entitled
 * to be told once rather than left to infer from silence. `--yes` has nothing
 * to answer: this command creates the corpus it is importing into, so there is
 * no state to lose and nothing yet to protect, and the gate that does apply is
 * the one every item still passes — everything lands `draft`.
 * `--overwrite-changed` cannot mean anything at all: a plan computed against a
 * corpus that does not exist buckets every arriving item `new`, so there is
 * nothing here an approval could reach. Both name the command where they DO
 * mean something, because "not here" without "there" is half an answer.
 */
const INIT_ARGUMENT_HINTS: Record<string, string> = {
  global:
    '--global: this command creates a PROJECT workspace in the directory it is run in, and ' +
    `there is no flag that changes that. The global layer is ${GLOBAL_DIR}, and no command ` +
    'creates one or writes to one: build an ordinary workspace somewhere else and move the ' +
    'directory it made into that path. See README, "The global layer — Creating one, today".',
  yes:
    '--yes: there is no confirmation on this command to answer. `init --pack` creates the ' +
    'corpus it imports into, so there is nothing yet to protect and no state to lose — and ' +
    'everything a pack brings in still lands `draft`, governing nothing until you promote it. ' +
    '`mycontext pack import <path> --yes` is the flag you want, on the surface that asks.',
  'overwrite-changed':
    '--overwrite-changed: nothing here can be overwritten. This command plans the pack against ' +
    'a corpus that does not exist yet, so every arriving item is new and the changed bucket is ' +
    'empty by construction. The flag belongs to `mycontext pack import <path> ' +
    '--overwrite-changed`, where there is something it could replace.',
};

/**
 * What `init` was given that it cannot act on — every argument that is not one
 * of `INIT_VALUE_FLAGS` or the value one of them consumes.
 *
 * It is `positionals` (registry.ts) with the answer inverted: that function
 * returns what is left after the flags, this one returns what is left after
 * the ACCEPTED flags, and both are needed because `init` is the one command
 * that refuses a bare positional as well as an unknown flag. The skipping rule
 * is copied from it token for token and has to stay identical: a path this
 * function read as a stray positional while `flag` read it as the pack would
 * be refused and honoured by the same command line.
 */
function refusedInitArguments(args: string[]): string[] {
  const refused: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const name = arg.startsWith('--') ? arg.slice(2).split('=')[0] : null;
    if (name !== null && INIT_VALUE_FLAGS.includes(name)) {
      if (!arg.includes('=')) i++;
      continue;
    }
    refused.push(arg);
  }
  return refused;
}

/**
 * The whole created tree, removed after a failure that came too late to refuse.
 *
 * Returns the errno code if it could not be removed, and `null` if it could,
 * because the caller has to SAY which of those happened: a workspace this
 * command decided not to found and could not delete is a partial one, and a
 * partial workspace nobody was told about is worse than no workspace at all.
 *
 * The retry budget is the one `test/helpers/tmp.ts` argues for at length: on
 * Windows a directory cannot be removed while any handle inside it is open,
 * SQLite releases `.index.db`/`-wal`/`-shm` asynchronously after `close()`,
 * and a bare `rmSync` fails with `EPERM` on that millisecond-scale window.
 */
function discardWorkspace(root: string): string | null {
  try {
    rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    return null;
  } catch (err) {
    return (err as NodeJS.ErrnoException)?.code ?? 'unknown';
  }
}

/** A read artefact, planned, and the name it will be filed under here. */
interface PlannedPack {
  plan: ImportPlan;
  name: string;
  /** The path as the caller typed it, recorded verbatim in the import record. */
  source: string;
}

/**
 * The pack, read and planned — before anything at all is created.
 *
 * `planImport` is pure, which is the whole reason this can run here: a bad
 * pack refuses with no `.my_context/` left behind, and this command's success
 * line says "initialized", which this codebase does not print for a half-built
 * workspace.
 *
 * It plans against a corpus that does not exist, so `existing` answers `null`
 * for every id — the spelling `Store.get` uses
 * (`core/store.ts` · `  get(id: string): Item | null {` · ~504), and the reason
 * `bucketise` puts every arriving item in `new` here. A predicate written
 * against `undefined` would be true for every lookup and the plan would offer
 * to import nothing.
 *
 * Throws rather than returning a message, so every refusal from here, from
 * `readArtefact` and from `planImport` reaches the caller by one route and is
 * printed by one line.
 */
function planPack(cwd: string, source: string): PlannedPack {
  const artefact = readArtefact(path.resolve(cwd, source));
  const plan = planImport(artefact, {
    existing: () => null,
    rawConfig: INIT_CONFIG,
    local: resolveConfig(INIT_CONFIG),
  });
  if (plan.pack === null || plan.pack === '') {
    throw new Error(
      `my_context: ${JSON.stringify(source)} is a full export and carries no pack name, so ` +
      'there is nothing to file its history and its membership list under. `init` has no ' +
      '--name to give it one, and a name invented on your behalf would be the one ' +
      '`mycontext pack list` shows you and nobody chose. Run `mycontext init` on its own and ' +
      'then `mycontext pack import <path> --name <text>`. Nothing was created.',
    );
  }
  return { plan, name: plan.pack, source };
}

/** What one `init --pack` did, in the shapes the printing below wants. */
interface AppliedPack {
  /** The name the pack was filed under, carried so the outcome can say it. */
  name: string;
  report: CollisionReport;
  outcome: ImportOutcome;
  errors: LoadError[];
}

/**
 * The import, into the workspace this command has just written.
 *
 * The workspace is resolved HERE rather than passed in, because there was
 * nothing to resolve when this command was dispatched: `init` is the one bare
 * command (`CommandDef.workspace`), and it is bare so that it can create a
 * workspace inside a directory whose ANCESTOR workspace has a corrupt
 * `config.json` — which `resolveWorkspace` throws on. By this point the
 * nearest `.my_context` is the one written a few lines above, carrying the
 * merged config, so this resolves it and no ancestor is consulted.
 *
 * **`overwriteApproved` is passed explicitly, and it is `false`.** It could be
 * defaulted and it is not: `applyImport` requires it so that the one call site
 * which may ever pass `true` is the one where a human answered a question, and
 * writing `false` here is what keeps that true when read rather than when
 * remembered. On this path it could not be anything else — the `changed`
 * bucket is empty by construction — but a default is a decision nobody has to
 * look at, and this one is worth looking at.
 */
function applyPack(cwd: string, planned: PlannedPack): AppliedPack {
  const { ctx, errors } = openMutateContext(resolveWorkspace(cwd));
  try {
    const outcome = applyImport(ctx, planned.plan, {
      name: planned.name, source: planned.source, now: Date.now(), overwriteApproved: false,
    });
    return {
      name: planned.name,
      report: reportOf(planned.plan, planned.name, outcome, false, [], errors),
      outcome,
      errors,
    };
  } finally {
    // Before the caller can remove the tree this database lives in: on Windows
    // an open handle is what makes `rmSync` fail, so the failure path depends
    // on this being a `finally` rather than a line after the return.
    ctx.store.close();
  }
}

/**
 * `mycontext init`, and `mycontext init --pack <path>`.
 *
 * It used to accept `argv` and never look at it — `runCli` called
 * `cmdInit(cwd, out)` — so every flag and every positional was swallowed
 * whole: `init --global`, `init --nonsense-flag zzz` and `init ../elsewhere`
 * all printed the same "initialized" line for the same project workspace in
 * the current directory. Refusing rather than absorbing is
 * INV-nothing-is-dropped-silently; the flag names are echoed back so the
 * refusal identifies which token it is about. `--pack` is now accepted INSIDE
 * that refusal, and the refusal keeps refusing everything else.
 *
 * ## The order, and it is the order the code forces
 *
 *   1. parse and refuse — `--pack` alone, with a value, and no positional;
 *   2. read and plan the pack, **before anything is created**, because
 *      `planImport` is pure and a bad pack must leave nothing behind;
 *   3. create `items/`;
 *   4. write `config.json`, which for a pack is the merge of its categories
 *      over `INIT_CONFIG` — the pack's contribution is a merge and not a
 *      replacement, so `profile` and `budgets` survive. **A sibling plan adds
 *      a `watchedDocs` write to `init`; the seam is here and the order is:
 *      pack config first, then `watchedDocs`;**
 *   5. write `.gitignore`;
 *   6. resolve the workspace, open a mutation context, `applyImport`;
 *   7. print — the shadowing warning if any, then the collision report, then
 *      the initialized line, then the pointer at the bulk promote;
 *   8. on any failure after step 3, remove the whole created tree and say what
 *      happened. "initialized" is not printed for a corpus that is not there.
 *
 * ## No confirmation on this path, recorded so it is not read as an inconsistency
 *
 * `mycontext pack import` is on the approval boundary and this is not. The
 * user named the pack on the command line of a command that CREATES a corpus,
 * so there is nothing yet to protect and no state to lose, and the gate that
 * matters is the one every item still passes: everything lands `draft` and
 * governs nothing until a human promotes it. There is no §6n.7 second gate
 * either, for a stronger reason than convenience — the `changed` bucket is
 * empty by construction, so there is nothing an approval could reach.
 */
function cmdInit(cwd: string, args: string[], out: Emit): number {
  const refused = refusedInitArguments(args);
  if (refused.length > 0) {
    out(
      `my_context: init takes one flag, --pack <path>, and ` +
      `${refused.map((a) => JSON.stringify(a)).join(', ')} ` +
      `${refused.length === 1 ? 'was' : 'were'} passed. Nothing was created — an argument this ` +
      `command cannot act on is refused rather than ignored.\n${INIT_USAGE}`,
    );
    const hints = refused
      // `--name`, `--name=value` and `-name` all reach the same hint; a bare
      // positional has none and is covered by the refusal above.
      .map((a) => INIT_ARGUMENT_HINTS[a.replace(/^-+/, '').split('=')[0]])
      .filter((hint): hint is string => hint !== undefined);
    for (const hint of [...new Set(hints)]) out(hint);
    return 1;
  }

  // `flag` throws on a repeated `--pack`, which `runCli`'s catch turns into a
  // one-line refusal — before anything is created, like every refusal here.
  const source = flag(args, 'pack');
  if (flagOccurrences(args, 'pack').length > 0 && (source === null || source === '')) {
    out(
      'my_context: --pack needs the path of the artefact to found this workspace from — a ' +
      'directory or a .zip file that already exists. There is no default: an import is a ' +
      "stranger's corpus arriving in yours, and the one thing nobody should have to guess is " +
      `which one. Nothing was created.\n${INIT_USAGE}`,
    );
    return 1;
  }

  const root = path.join(cwd, DIR_NAME);
  if (existsSync(root)) { out(`my_context: ${root} already exists.`); return 1; }

  let planned: PlannedPack | null = null;
  if (source !== null) {
    try {
      planned = planPack(cwd, source);
    } catch (err) {
      out(toCliMessage(err));
      return 1;
    }
  }

  const ancestor = findProjectRoot(cwd);
  if (ancestor) {
    out(
      `my_context: warning: an existing workspace was found at ${ancestor}. ` +
      `Its items will not be visible from ${root} once this workspace is created, ` +
      `because the nearer workspace shadows it.`,
    );
  }

  let applied: AppliedPack | null = null;
  try {
    mkdirSync(path.join(root, 'items'), { recursive: true });
    writeFileSync(
      path.join(root, 'config.json'),
      JSON.stringify(planned ? planned.plan.config.document : INIT_CONFIG, null, 2) + '\n',
    );
    writeFileSync(path.join(root, '.gitignore'), '.index.db\n.index.db-*\n');
    if (planned) applied = applyPack(cwd, planned);
  } catch (err) {
    // The failure first and on its own, then one sentence about what is on
    // disk now — which is the sentence a half-built workspace cannot say for
    // itself, and the reason this path prints two lines rather than one.
    out(toCliMessage(err));
    const stuck = discardWorkspace(root);
    out(stuck === null
      ? `my_context: nothing was created — ${root} was removed, so this directory is exactly ` +
        'as it was before the command ran.'
      : `my_context: ${root} was created before that failure and could not be removed ` +
        `(${stuck}). It is a PARTIAL workspace, not an initialized one — delete it yourself ` +
        'before running `mycontext init` again.');
    return 1;
  }

  if (applied) for (const line of renderCollisionReport(applied.report)) out(line);
  out(`my_context: initialized ${root}`);
  if (applied) {
    outcomeLines(out, applied.name, applied.outcome);
    emitLoadErrors(applied.errors, out);
  }
  return 0;
}

const ADD_USAGE =
  'usage: mycontext add <category> <title> [--body <text>|--file <path>] [--note <text>] ' +
  '[--step <text>] [--scope "a/**,b/**"] [--tags "a,b"] [--severity hard|soft] ' +
  '[--extra key=value] [--yes]';

/**
 * `--step`, in full, wherever `add`'s own help is printed.
 *
 * Kept OUT of `ADD_USAGE` because that string is interpolated into
 * single-line refusals (`--body needs a value. usage: ...`), and printed
 * beside it wherever a human is actually reading about this command.
 *
 * **All three sentences earn their place.** Naming the CATEGORY is the
 * capture-time half of §6o's mitigation: `--step` is where an author who
 * reached for the wrong one finds out, if they are going to find out at all —
 * steps are accepted on every category, so nothing downstream will tell them.
 * Naming the REPEAT is what stops `--step "a, b, c"`, since unlike
 * `--scope`/`--tags` this flag is not comma-split. And naming the LIMITATION
 * is cheaper than a user discovering it: steps are absent from `UpdateInput`
 * by design (§6m.3), so there is no `edit` that reaches them and no command
 * that ticks one — progress lives in the audit log, and the Markdown is the
 * only place a step's text can be corrected.
 */
const STEP_HELP =
  '--step <text> is for a `procedure` — an operation performed once and then finished; a ' +
  'repeatable one is a `runbook`, and it keeps its steps in the body. It may be repeated and ' +
  'keeps command-line order, and it is not comma-split: a step is a sentence. Steps cannot be ' +
  'edited or ticked afterwards through any command — correcting one means editing the Markdown ' +
  'and running `mycontext repair`.';

/** The value-taking flags of `mycontext add`, in the form `positionals` wants. */
const ADD_VALUE_FLAGS = ['body', 'file', 'note', 'step', 'scope', 'tags', 'severity', 'extra'];

/**
 * The observation category `--note` writes.
 *
 * `mycontext add` had no way to express an observation at all, and the
 * unknown-flag message said so, naming `create_item` as the only route. That
 * was liveable while every body was typed by the person capturing it — the
 * body and the observations are then the same act. It stopped being liveable
 * with `--file`: a snapshot's body is somebody else's text, so WHY the file is
 * in this corpus has nowhere to live except the title, and a title is one
 * sentence.
 *
 * **Two namespaces spell this word, and only one of them is here.** After the
 * v2 catalogue there is also an ITEM category named `note` (rationale tier,
 * ids `NOTE-...`), and this constant is an OBSERVATION category named `note` —
 * a line inside another item's `## Observations`. The parser cannot confuse
 * them: in `mycontext add note "..."` the word is `<category>`, the first
 * positional, and in `--note "..."` it is this observation's category. A
 * reader can, so both are named here (§0).
 *
 * One fixed category rather than a `--note category:text` mini-format. The
 * four-field observation record (category, text, tags, context) has
 * round-trip constraints on every field (`validateObservationCategory`,
 * `validateObservationTags`, `validateObservationText`), and a flat flag
 * spelling for all four is the second mini-format this command's own
 * unknown-flag message declines to invent. `note` carries the one field a
 * human typing at a shell actually wants, and `create_item` remains the route
 * for the rest — which is what the message now says instead of "not here".
 */
const NOTE_CATEGORY = 'note';
/** Every flag `mycontext add` accepts. Anything else is refused, not absorbed. */
const ADD_FLAGS = [...ADD_VALUE_FLAGS, 'yes'];

/**
 * `--file <path>`: the body is a SNAPSHOT of that file, and the item records
 * where it came from so `mycontext doctor` reports it when the two diverge.
 *
 * It is not restricted to the `reference` category, and that is a decision
 * rather than an omission. `source_file`/`source_checksum` are fields on every
 * item, `doctor`'s drift check is keyed on their shape and not on a category
 * name, and a project that has renamed `reference` or declared a custom
 * category for the same job would be refused by a name check for no reason
 * anything in the code could justify. What holds the trust boundary is the
 * TIER, not the flag: a snapshot captured into a normative category is a
 * normative capture, so it prints the same "governing this project at once"
 * preview and passes the same `--yes` gate as any other — with one extra line
 * naming the file, because "this body came from a file that can keep changing"
 * is the specific thing a human is being asked to approve.
 */
function addSnapshot(
  ws: Workspace, root: string, cwd: string, target: string, input: CreateInput, out: Emit,
): void {
  const snapshot = readSnapshot(path.dirname(root), cwd, target);
  input.body = snapshot.body;
  input.sourceFile = snapshot.sourceFile;
  input.sourceChecksum = snapshot.checksum;

  const tier = Object.hasOwn(ws.config.categories, input.type)
    ? ws.config.categories[input.type].tier
    : 'rationale';
  // Printed on EVERY capture, not only a large one. A snapshot is the one
  // body a user did not type and therefore did not measure, and "accepted
  // without comment" is the outcome this codebase does not permit for a cost
  // the reader meets later — see `snapshotCostLines`, which is also the one
  // place that knows the answer depends on the tier.
  out(`my_context: snapshotting ${snapshot.sourceFile} — ${snapshotSizeLine(snapshot.cost)}`);
  out(`my_context: ${snapshotBudgetLine(
    snapshot.cost, tier, largestFullTextBudget(ws.config.budgets),
  )}`);
}

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
 * (mutate.ts) and `tierOf` (trust.ts) document: a category named `constructor` would
 * otherwise resolve to `Object.prototype.constructor` and skip the gate.
 */
function cmdAdd(ws: Workspace, args: string[], out: Emit, cwd: string): number {
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
        `--note adds a "[${NOTE_CATEGORY}]" observation and may be repeated. An observation ` +
        `under any OTHER category, an observation's tags or context, and relations have no ` +
        `flag spelling — capture those with the create_item tool on the mycontext MCP server. ` +
        // Steps used to be on that list by implication: this message named
        // `create_item` as the route for everything `add` cannot express, and
        // `add` could not express a step at all. It can now, so the sentence
        // that was true when it was written has to stop claiming more than the
        // command does.
        `A procedure's steps are no longer among them.\n${STEP_HELP}`,
      );
      return 1;
    }

    const words = positionals(args, ADD_VALUE_FLAGS);
    const category = words[0];
    const title = words.slice(1).join(' ');
    // `add`'s own help, and the one place a user who has NOT mistyped a flag
    // reads what `--step` is for.
    if (!category || !title) { out(ADD_USAGE); out(STEP_HELP); return 1; }

    input = { type: category, title, origin: 'human' };
    const body = scalarFlag(args, 'body');
    const file = scalarFlag(args, 'file');
    const scope = listValues(args, 'scope');
    const tags = listValues(args, 'tags');
    const severity = scalarFlag(args, 'severity');
    // Refused rather than resolved by precedence. Both flags supply the body,
    // so honouring one would silently discard the other — and whichever way
    // the precedence fell, half the users who wrote both would get an item
    // whose body is not the text they named, reported as a success.
    if (body !== null && file !== null) {
      throw new Error(
        `my_context: --body and --file both supply the item's body, and this capture passed ` +
        `both. Nothing was created. Use --file to snapshot a file (the item records where it ` +
        `came from and \`mycontext doctor\` reports drift), or --body to write the text ` +
        `yourself (no source is recorded and nothing is checked).\n${ADD_USAGE}`,
      );
    }
    if (body !== null) input.body = body;
    // Every occurrence, in command-line order, so `--note a --note b` records
    // two observations rather than keeping the first and dropping the second
    // — the silent-drop failure `addValues` exists to close for every other
    // repeatable flag here. Not comma-split, unlike `--scope`/`--tags`: an
    // observation is a sentence, and sentences contain commas.
    const notes = addValues(args, 'note');
    if (notes.length > 0) {
      input.observations = notes.map((text) => ({
        category: NOTE_CATEGORY, text, tags: [], context: null,
      }));
    }
    // The same call `--note` uses, for the same reason and with the same two
    // guarantees: every occurrence in command-line ORDER — for a procedure the
    // order IS the knowledge, so a dropped or reordered step is a corrupted
    // item rather than a cosmetic loss — and no comma-splitting, because a
    // step is a sentence and sentences contain commas.
    //
    // Passed as TEXT. `createItem` sets `checked: false` on every entry and
    // this surface has no spelling for anything else, which is what makes "a
    // box is ticked only by a human editing the Markdown" a property of the
    // boundary rather than a promise about how the flag gets used. The text
    // itself is neither trimmed nor collapsed here or below: `parseSteps`
    // requires a step to re-render byte-identically, so `validateStepText`
    // refuses what would not survive instead of repairing it.
    const steps = addValues(args, 'step');
    // Validated HERE as well as inside `createItem`, which is where it is
    // actually enforced for every surface. The duplication is of the CALL, not
    // of the rule — one function (`normalizeSteps`, validate.ts) owns the
    // wording and the condition, and the returned array is deliberately
    // discarded — and it buys the ordering, the same thing `--severity` and
    // `scopeRequirementError` below buy with the same move: without it a human
    // is shown "create this item that governs the project?" and told only
    // AFTER answering that the step was never writable. It bites harder here
    // than anywhere else, because both categories that take steps are
    // normative, so every `--step` mistake would hit the prompt first.
    normalizeSteps(steps);
    if (steps.length > 0) input.steps = steps;
    if (scope !== null) input.scope = scope;
    if (tags !== null) input.tags = tags;
    // `--extra` on `add` as well as on `edit`, sharing ONE parser in
    // `registry.ts`. Its absence here was an asymmetry, not a policy: an item
    // whose category-specific fields are known at capture time had to be
    // created and then immediately edited, which is two audit records for one
    // intent and a window in which the item exists without the fields that
    // give it meaning. `createItem` already accepted `extra`; only the flag
    // was missing. Keys are validated by `createItem`'s own `validateExtra`,
    // so a reserved name is refused here exactly as it is on `edit`.
    const extra = extraFlag(args);
    if (extra !== null) input.extra = extra;
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

    // Before the scope refusal and before the normative gate, so that a
    // capture which cannot land is refused on the file's terms first (a
    // missing or oversized file is the likelier mistake, and its message is
    // the more useful one), and so the size disclosure is on screen when the
    // human is asked to approve a normative capture.
    if (file !== null) addSnapshot(ws, root, cwd, file, input, out);

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
      // The extra sentence a SNAPSHOT earns on a normative capture, and the
      // reason `--file` needs no category restriction of its own. What is
      // being approved is not only this text: it is a rule whose content is a
      // copy of a file, so whoever can edit that file can propose a change to
      // what governs — which lands as a staged revision for a human under
      // `agentEdits: "review"`, the default on this tier, and only then.
      if (file !== null) {
        out(
          `  this body is a snapshot of ${input.sourceFile}, not text written here. It does not ` +
          `update itself: \`mycontext doctor\` reports when the file has moved on, and ` +
          `\`mycontext refresh\` takes a new snapshot through this same gate.`,
        );
      }
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
  const result = openRebuiltStore(ws);
  result.store.close();
  out(`my_context: indexed ${result.loaded} item(s)`);

  // `state/` holds one restore snapshot per session and never prunes itself
  // otherwise; sweep entries older than the retention window (30 days — see
  // SNAPSHOT_MAX_AGE_MS) here so a project used daily doesn't accumulate
  // them without bound. Best-effort: pruneSnapshots never throws.
  let prunedSeen = 0;
  const pruned = pruneSnapshots(root, undefined, (name) => {
    if (name.endsWith('.seen.jsonl')) prunedSeen++;
  });
  if (pruned > 0) out(`my_context: pruned ${pruned} stale snapshot file(s) from state/`);
  // A pruned seen file is a >30-day-idle session's dedupe state: if that
  // session ever resumes, items it already received will be re-injected —
  // the accepted failure direction, but never a silent one. This line is the
  // only place the consequence can be disclosed; at the next injection a
  // pruned session is indistinguishable from a fresh one.
  if (prunedSeen > 0) {
    out(`my_context: ${prunedSeen} of those were session dedupe file(s); ` +
      'if one of those idle sessions resumes it will re-receive items it already saw ' +
      '(duplicates, never a miss)');
  }

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
    // `docLocale()` is the documentation harness's pin (MYCONTEXT_DOC_LOCALE),
    // not a user surface: the CLI speaks English, and only `gen-doc-examples`
    // sets this so `docs/README.he.md`'s generated block comes from the
    // topic's Hebrew source.
    out(helpTopic(topic, ws.config, docLocale()));
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
    const registered = command === undefined ? undefined : COMMANDS.get(command);

    // Bare commands run BEFORE `resolveWorkspace` — see `CommandDef.workspace`
    // in registry.ts: `init` must work from inside a directory whose ancestor
    // workspace has a corrupt config.json, which `resolveWorkspace` throws on.
    if (registered !== undefined && registered.workspace === 'none') {
      return registered.run(args, out, cwd);
    }

    const ws: Workspace = resolveWorkspace(cwd);

    // The banner's `categories:` line is a function of the resolved,
    // per-workspace config (see `usage()`), so it can only be built once the
    // workspace is known — which is also true for every other command, so
    // this does not short-circuit ahead of `resolveWorkspace`.
    if (!command || command === '--help') { out(usage(ws.config)); return command ? 0 : 1; }

    if (registered !== undefined) return registered.run(ws, args, out, cwd);
    out(`my_context: unknown command "${command}".\n\n${usage(ws.config)}`);
    return 1;
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }
}

/**
 * The seven builtins, registered like every other command. They were a
 * hardcoded dispatch `switch` (plus a pre-workspace `if` for `init`) checked
 * BEFORE the registry until Wave 5, which forced registry.ts to keep a
 * hand-maintained mirror of the switch (`SHADOWED_BY_SWITCH`) purely so a
 * registration could not create a command the banner advertises but the
 * switch shadows. With the switch gone there is exactly one dispatch path
 * and one place a command's usage line and summary live — its registration.
 *
 * Two details are load-bearing:
 *  - `init` is `workspace: 'none'` — see `CommandDef.workspace` (registry.ts)
 *    for why it must dispatch before `resolveWorkspace`.
 *  - `rebuild`'s runner drops `args` deliberately, as `cmdRebuild` always
 *    has: the command takes none, and this registration does not change what
 *    it accepts. Teaching it to refuse unknown flags like the reporting
 *    commands do is a behaviour change, not a migration, and belongs to its
 *    own task if wanted.
 */
registerCommand({
  name: 'init',
  usage: 'init [--pack <path>]',
  summary: 'create .my_context here (--pack: found it from an artefact, as drafts)',
  workspace: 'none',
  run: (args, out, cwd) => cmdInit(cwd, args, out),
});
registerCommand({
  name: 'add',
  usage: 'add <category> <title> [opts]',
  // The flag list is on the summary side because the usage column is 30
  // wide and `col` would otherwise push every other summary out of line —
  // but it is here rather than nowhere: a banner that stops at `<title>`
  // is what let the CLI look title-only for three plans.
  summary: 'create an item (--body|--file --scope --tags --severity --yes)',
  run: cmdAdd,
});
registerCommand({
  name: 'list',
  usage: `list [category] ${DETAIL_USAGE}`,
  summary: 'list items',
  run: (ws, args, out) => cmdList(ws, args, out),
});
registerCommand({
  name: 'show',
  usage: 'show <id>',
  summary: 'print an item',
  run: (ws, args, out) => cmdShow(ws, args, out),
});
registerCommand({
  name: 'rebuild',
  usage: 'rebuild',
  summary: 'rebuild the index from Markdown',
  run: (ws, _args, out) => cmdRebuild(ws, out),
});
registerCommand({
  name: 'help',
  usage: 'help [topic]',
  summary: `guidance: ${HELP_TOPICS.join(', ')}`,
  run: (ws, args, out) => cmdHelp(ws, args, out),
});
registerCommand({
  name: 'examples',
  usage: 'examples <category> [--short]',
  summary: 'print an example item (--short: the distinctive fields)',
  run: (ws, args, out) => cmdExamples(ws, args, out),
});

if (isMainEntry(import.meta.filename, process.argv[1])) {
  process.exitCode = runCli(process.argv.slice(2), process.cwd(), (s) => console.log(s));
}
