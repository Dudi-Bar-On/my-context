#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { COMMAND_FLAGS } from '../core/command-flags.ts';
import { resolveConfig, scopePolicyFor, type Config } from '../core/config.ts';
import { summaryStalenessNote } from '../core/content-hash.ts';
import { renderItem } from '../core/item.ts';
import { alwaysInjection, scopeCell } from '../core/render-item.ts';
import { createItem, type CreateInput, type MutationContext } from '../core/mutate.ts';
import { scopeRequirementError } from '../core/trust.ts';
import {
  normalizeSteps, normalizeSummary, validateExplicitId, validateIdPrefix,
  validateObservationCategory, validateRelationTarget, validateSummary,
  validateValidFrom, SEVERITIES,
} from '../core/validate.ts';
import type { Observation, Severity } from '../core/types.ts';
import { isMainEntry } from '../core/paths.ts';
import { pruneSnapshots } from '../core/ledger.ts';
import {
  largestFullTextBudget, readSnapshot, snapshotBudgetLine, snapshotSizeLine,
} from '../core/reference.ts';
import { openRebuiltStore } from '../core/open-store.ts';
import type { LoadError } from '../core/rebuild.ts';
import type { Store } from '../core/store.ts';
import {
  DIR_NAME, GLOBAL_DIR, findProjectRoot, repositoryRoot, resolveWorkspace, type Workspace,
} from '../core/workspace.ts';
import {
  HELP_TOPICS, docLocale, exampleItem, exampleItemShort, helpTopic, updatableSurface,
} from '../help/index.ts';
import { enumError } from '../core/teach.ts';
import { renderCollisionReport } from '../pack/collide.ts';
import {
  applyImport, planImport, type ImportOutcome, type ImportPlan,
} from '../pack/import.ts';
import { readArtefact } from '../pack/reader.ts';
import './commands/index.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './commands/context.ts';
import { outcomeLines, reportOf } from './commands/pack.ts';
import {
  DETAIL_USAGE, col, detailLevel, emitJson, paragraph, records, refuseUnknownFlag, table,
  unknownFlag, wantsJson,
} from './commands/format.ts';
import {
  COMMANDS, boolFlag, csv, dedupe, extraFlag, flag, flagOccurrences, interleavedOccurrences,
  positionals, registerCommand, repeatedFlagError,
  type CommandDef, type FlagOccurrence,
} from './commands/registry.ts';
import {
  summaryAtCreateRefusal, summaryOmittedRefusal, summaryRequiredAtCreate,
} from '../core/summary-gate.ts';
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

/**
 * The one flag `init` accepts, and it takes a value.
 *
 * Lifted to `core/command-flags.ts` by plan:builder seq:1b, along with `add`'s,
 * `list`'s and `examples`' — this module is the one `test/ui/no-writes.test.ts`
 * bans from `src/ui/`, so a spec declared here is a spec a read surface cannot
 * import at any price. Bound back under its old name so that
 * `refusedInitArguments` below reads exactly as it did.
 */
const { values: INIT_VALUE_FLAGS } = COMMAND_FLAGS.init;

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
  /** ...and resolved, which is the other half of the import's key. */
  origin: string;
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
  const origin = path.resolve(cwd, source);
  const artefact = readArtefact(origin);
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
  return { plan, name: plan.pack, source, origin };
}

/** What one `init --pack` did, in the shapes the printing below wants. */
interface AppliedPack {
  /** The name the pack was filed under, carried so the outcome can say it. */
  name: string;
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
 *
 * **The report is printed BEFORE the write, and that is not an arbitrary
 * choice.** It is `pack import`'s report, rendered by `collide.ts` in the
 * future tense throughout — "these are what would be imported", "will be
 * filed", "will be quarantined" — because on that surface it is what a human
 * is shown before answering. Printed afterwards it would say "will be
 * quarantined" two lines above an outcome saying "were set aside": one fact,
 * two tenses, one of them wrong. Printing it first costs nothing here (there
 * is no question to ask) and keeps every sentence true.
 */
function applyPack(cwd: string, planned: PlannedPack, out: Emit): AppliedPack {
  const { ctx, errors } = openMutateContext(resolveWorkspace(cwd));
  try {
    const report = reportOf(planned.plan, planned.name, null, false, [], errors);
    for (const line of renderCollisionReport(report)) out(line);
    const outcome = applyImport(ctx, planned.plan, {
      name: planned.name, source: planned.source, origin: planned.origin,
      now: Date.now(), overwriteApproved: false,
    });
    return { name: planned.name, outcome, errors };
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
 *   6. resolve the workspace, open a mutation context, print the collision
 *      report — before the write, in the future tense it is written in — and
 *      `applyImport`;
 *   7. print the initialized line, then the pointer at the bulk promote. The
 *      order a reader sees is the plan's: shadowing warning, report,
 *      initialized, outcome;
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
    if (planned) applied = applyPack(cwd, planned, out);
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

  out(`my_context: initialized ${root}`);
  if (applied) {
    outcomeLines(out, applied.name, applied.outcome);
    emitLoadErrors(applied.errors, out);
  }
  return 0;
}

/**
 * `add`'s complete flag surface, printed by every refusal this command makes.
 *
 * **`[--always]`, and not `[--always[=false]]` — the spelling `edit` uses.**
 * Two reasons, and they point the same way.
 *
 * The first is meaning. On `edit`, `--always=false` is a REAL operand: it is
 * the only way to unpin, so the usage line has to offer it or the command has
 * a capability nothing advertises (`mycontext unpin` is that same edit under a
 * shorter name). On `add` there is nothing to unpin — a capture is not pinned
 * until something says so (`always: input.always ?? false`, mutate.ts) — so
 * `--always=false` says exactly what leaving the flag out says, and a usage
 * line that offered it would be offering a way to ask for the default. It is
 * still ACCEPTED, through the same `boolFlag` `edit` reads: refusing it would
 * make one word an error on one command and an unpin on the other, which is
 * the disagreement this flag must not create. Not offered, not refused.
 *
 * The second is mechanical, and it is why the choice is not merely tasteful:
 * `ADD_FLAG_SUMMARY` below reduces this string with `/\[([^\]]+)\]/g`, whose
 * character class stops at the FIRST `]`. A nested `[--always[=false]]` yields
 * the token `--always[=false` in `mycontext help`'s banner. The derived banner
 * exists so the two cannot drift; a spelling that breaks the derivation would
 * buy the drift back for one bracket pair.
 */
const ADD_USAGE =
  'usage: mycontext add <category> <title> [--body <text>|--file <path>] [--note <text>] ' +
  '[--observation kind=text] [--step <text>] [--summary <text>|--summary-omitted] ' +
  '[--scope "a/**,b/**"] [--tags "a,b"] [--severity hard|soft] [--always] ' +
  '[--valid-from YYYY-MM-DD] [--original-id <id>] [--extra key=value] [--yes]';

/**
 * The flag list in `add`'s one-line entry in `mycontext help`, DERIVED from
 * `ADD_USAGE` rather than typed a second time.
 *
 * It was typed a second time, and the two disagreed: the banner still read
 * `(--body|--file --summary --scope --tags --severity --yes)` after
 * `--observation`, `--step`, `--valid-from` and `--extra` had all shipped, so
 * the first place anybody looks was the one place that had not been updated —
 * the same failure the comment on `summary` below was written to prevent, one
 * level down. A derived list cannot drift: adding a flag to `ADD_USAGE` (which
 * every refusal in this command already interpolates) adds it here too.
 *
 * The reduction is deliberately literal. Each `[...]` group after `<title>` is
 * split on `|` into alternatives, and an alternative contributes its leading
 * token when that token is a flag — so `[--severity hard|soft]` yields
 * `--severity` alone (`soft` is a value, not a flag) while
 * `[--body <text>|--file <path>]` yields both. Values are dropped, because the
 * banner column has room for names and `mycontext add` with no arguments
 * prints `ADD_USAGE` itself for the rest.
 */
const ADD_FLAG_SUMMARY = Array.from(ADD_USAGE.matchAll(/\[([^\]]+)\]/g))
  .map((m) => m[1].split('|')
    .map((alt) => alt.trim().split(/\s+/)[0])
    .filter((token) => token.startsWith('--'))
    .join('|'))
  .filter((group) => group !== '')
  .join(' ');

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

/**
 * `mycontext add`'s flag surface, in the form `unknownFlag` and `positionals`
 * want — lifted to `core/command-flags.ts` by plan:builder seq:1b and bound
 * back under both of its old names, so the two call sites below are unmoved.
 *
 * `ADD_FLAGS = [...ADD_VALUE_FLAGS, 'yes']` is now said there rather than
 * here, and it is still said once: `allowed` is derived from `values` in the
 * map, not typed out beside it.
 */
const { allowed: ADD_FLAGS, values: ADD_VALUE_FLAGS } = COMMAND_FLAGS.add;

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
 * One fixed category, and it stays one now that `--observation kind=text`
 * exists beside it. The two are not redundant: `--note "..."` is the spelling
 * a human typing at a shell reaches for, and it cannot get the kind wrong. The
 * four-field observation record (category, text, tags, context) still has
 * round-trip constraints on every field (`validateObservationCategory`,
 * `validateObservationTags`, `validateObservationText`); `--observation`
 * carries the first two, and `create_item` remains the route for TAGS and
 * CONTEXT, which is what the unknown-flag message now says instead of claiming
 * the whole record is unreachable.
 */
const NOTE_CATEGORY = 'note';

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
  // `repositoryRoot(cwd)` and NOT `path.dirname(root)`: this bounds a path the
  // USER typed, so it must be the repository they are standing in. The two are
  // the same value unless `CORPUS_DIR_ENV` has pointed the corpus elsewhere, and
  // then the corpus's parent is a directory the user has never heard of — which
  // is exactly how a file inside the repository came to be refused as outside
  // it, naming a temp directory as the repository, on 2026-08-27.
  const snapshot = readSnapshot(repositoryRoot(cwd) ?? path.dirname(root), cwd, target);
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
  return flagOccurrences(args, name).map((occurrence) => checkedValue(occurrence, name));
}

/**
 * The two checks above, for ONE occurrence — split out so the observation
 * reader below can apply them to `--note` and `--observation` from a single
 * ordered scan rather than restating them.
 */
function checkedValue(occurrence: FlagOccurrence, name: string): string {
  const long = `--${name}`;
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
}

/**
 * `--note` and `--observation`, read TOGETHER and in command-line order.
 *
 * **The shape, and why it is `kind=text` rather than anything else.** The
 * command already has a repeatable value flag whose value is one whole argv
 * token and is deliberately not comma-split (`--note`, `--step`), and it
 * already has a repeatable flag that carries two fields in one token by
 * splitting on the FIRST `=` (`--extra key=value`, whose parser and refusal
 * live in registry.ts and are shared with `edit`). An observation is two
 * fields, so it takes the second idiom, and the value is taken whole after
 * that first `=` — commas, further `=`, backticks, brackets and apostrophes
 * all reach the item untouched, because the shell has already delimited the
 * token and nothing here splits it again. A repeatable flag also beats a file
 * or stdin here: `add` reads no structured input from either today (`--file`
 * is a body snapshot, not a record format), and both would have made the
 * observation's shape a second file format to specify, parse and refuse.
 *
 * **Read in one scan, because the ORDER of the two flags is the item.**
 * `## Observations` is a list and `renderItem` writes it in array order, so
 * `--note a --observation limit=b --note c` has to land as `a, b, c`; two
 * independent `flagOccurrences` scans would produce `a, c, b` and report
 * success. `interleavedOccurrences` is what makes the relative order readable
 * at all — see its doc comment.
 *
 * **The KIND is checked against the parser, not against a list kept here.**
 * `validateObservationCategory` (validate.ts) delegates to
 * `isValidObservationCategory` (item.ts), which runs the `OBSERVATION` regex
 * the reader actually uses and additionally requires the kind to equal its own
 * lowercased form — because `parseObservations` lowercases whatever it
 * captures. There is deliberately no enumerated vocabulary of kinds anywhere
 * in this product, and this command does not invent the first one: a closed
 * list here would refuse `[supersession]`, which `supersedeItem` itself writes,
 * and every kind a corpus being imported already carries. What is refused is
 * what the FORMAT cannot store, which is the same question every other guard
 * in `validate.ts` answers.
 */
const OBSERVATION_FLAGS = ['note', 'observation'];

function addObservations(args: string[]): Observation[] {
  return interleavedOccurrences(args, OBSERVATION_FLAGS).map((occurrence) => {
    const value = checkedValue(occurrence, occurrence.name);
    if (occurrence.name === 'note') {
      return { category: NOTE_CATEGORY, text: value, tags: [], context: null };
    }
    const eq = value.indexOf('=');
    if (eq <= 0) {
      throw new Error(
        `my_context: --observation takes kind=text (got ${JSON.stringify(value)}). The kind is ` +
        `the word the observation is filed under and is written as "[kind]" on its own line in ` +
        `the item — \`--observation limit="Pool size must never exceed 20"\`. The text is taken ` +
        `whole after the first "=", commas and further "=" included, and the flag may be ` +
        `repeated. Use --note "<text>" for a plain "[${NOTE_CATEGORY}]" one.\n${ADD_USAGE}`,
      );
    }
    const category = value.slice(0, eq);
    validateObservationCategory(category, "--observation's kind");
    return { category, text: value.slice(eq + 1), tags: [], context: null };
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
 * CLI as "captures the title only". An observation's CATEGORY and TEXT are
 * expressible now — `--note` for `[note]`, `--observation kind=text` for any
 * other kind — which is what makes an existing item re-creatable here at all;
 * an observation's `tags` and `context`, and `relations`, are still not, and
 * the unknown-flag message names `create_item` for exactly those.
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
        `--note adds a "[${NOTE_CATEGORY}]" observation and --observation kind=text adds one ` +
        `under any other kind; both may be repeated and keep command-line order. An ` +
        `observation's tags or context, and relations, have no flag spelling — capture those ` +
        `with the create_item tool on the mycontext MCP server. ` +
        // Steps used to be on that list by implication: this message named
        // `create_item` as the route for everything `add` cannot express, and
        // `add` could not express a step at all. It can now, so the sentence
        // that was true when it was written has to stop claiming more than the
        // command does. The observation KIND and `valid_from` joined steps in
        // that correction, and for the same reason: an item that cannot be
        // re-created faithfully through any write path is the defect, not the
        // migration's problem.
        `A procedure's steps are no longer among them, and neither is an observation's kind, ` +
        `an item's valid_from, the id an existing item is carried across with (--original-id), ` +
        `nor its pin (--always).\n${STEP_HELP}`,
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
    // One plain sentence saying what the item is, for a reader who does not
    // know this codebase — see `Item.summary` and `SUMMARY_MAX_CHARS`
    // (validate.ts). `scalarFlag`, not `addValues`: a second `--summary` is a
    // repeat of a single-valued field and is refused by `repeatedFlagError`
    // rather than silently keeping one of the two.
    const summary = scalarFlag(args, 'summary');
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
    // Validated HERE as well as inside `createItem`, which is where it is
    // enforced for every surface, for the ordering `--severity` and `--step`
    // are validated early for: without it a human is shown "create this item
    // that governs the project?" and told only AFTER answering that the
    // summary was over the bound. The duplication is of the CALL, not of the
    // rule — `normalizeSummary`/`validateSummary` (validate.ts) own the
    // wording and the bound, and the normalized value is deliberately
    // discarded here because `createItem` re-derives it through the same
    // functions.
    if (summary !== null) {
      validateSummary(normalizeSummary(summary));
      input.summary = summary;
    }
    // **The summary gate, on the human half of its creation surface.**
    //
    // `boolFlag`, like `--always` and `--yes`'s neighbours on `edit`, so
    // `--summary-omitted=false` is the same as not passing it and the flag
    // cannot be given as true and false at once.
    //
    // It sits HERE — after `--summary` is read and validated, before
    // `addSnapshot`, before the scope refusal and before the normative
    // confirmation — for the ordering `--severity`, `--step` and
    // `scopeRequirementError` are all checked early for: a human must not be
    // shown "create this item that governs the project?" and told only after
    // answering that the capture was never going to land. It is deliberately
    // NOT inside `createItem`; see `summaryRequiredAtCreate` for why the gate
    // belongs at the authored surfaces and nowhere else.
    if (boolFlag(args, 'summary-omitted') === true) input.summaryOmitted = true;
    // The contradiction first, so a capture passing both spellings is told
    // about it rather than being waved through by the summary it carries —
    // the order `cmdEdit` puts `summaryUnchangedRefusal` in, for its reason.
    const omittedRefusal = summaryOmittedRefusal(input, 'add');
    if (omittedRefusal) throw new Error(omittedRefusal);
    if (summaryRequiredAtCreate(input)) {
      throw new Error(summaryAtCreateRefusal(input, 'add'));
    }
    // Every occurrence of BOTH observation flags, in command-line order, so
    // `--note a --observation limit=b --note c` records three observations in
    // that order rather than keeping the first and dropping the second — the
    // silent-drop failure `addValues` exists to close for every other
    // repeatable flag here, and the silent-REORDER failure two separate scans
    // would introduce. Not comma-split, unlike `--scope`/`--tags`: an
    // observation is a sentence, and sentences contain commas. See
    // `addObservations` for the `kind=text` shape and for why the kind is
    // checked against the parser rather than against a list.
    const observations = addObservations(args);
    if (observations.length > 0) input.observations = observations;
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
    // `--valid-from`, and it is a REAL field rather than an `--extra` key:
    // `valid_from` is reserved (`RESERVED_FRONTMATTER_KEYS`, validate.ts)
    // because an `extra` of that name would overwrite the item's own on disk
    // unvalidated, so `--extra valid_from=...` was refused and stays refused.
    // Validated HERE as well as inside `createItem`, which is where it is
    // enforced for every surface — the duplication is of the CALL, not of the
    // rule (`validateValidFrom` owns the wording and the shape) — for the
    // ordering `--severity` and `--step` are validated early for: a human must
    // not be asked to approve a governing capture and told only afterwards
    // that the date was never storable.
    const validFrom = scalarFlag(args, 'valid-from');
    if (validFrom !== null) {
      validateValidFrom(validFrom, '--valid-from');
      input.validFrom = validFrom;
    }
    // **`--original-id`: the last field of an existing item no write path
    // could carry.** `--observation` and `--valid-from` closed the others; the
    // id was left, and it is the one that cannot be worked around afterwards.
    // `add` derives an id from the TITLE (`makeId`, slug.ts), and 36 of the 44
    // items in the corpus being merged in have ids that do not derive from
    // theirs — `STD-error-message-conventions` is titled "Error messages are
    // prefixed once and name the file once". Re-creating one without its id
    // renames it, and an id is a public name: it is the key of every relation,
    // every audit row, and every `STD-…` citation written into a source
    // comment. `STD-error-message-conventions` was re-captured on 2026-09-03
    // and landed as `STD-error-messages-are-prefixed-once-and-name-the-file-once`;
    // its six citation sites in `src/` and `test/` have resolved to nothing
    // ever since. That is the defect this flag exists for, already paid once.
    //
    // **THE NAME.** `--id` is the obvious spelling and it is the wrong one.
    // Every other value flag here names its argument — `--body`, `--summary`,
    // `--valid-from` — and so does this one; what `--id` would additionally
    // say is that `mycontext add` offers a general way to NAME items, which it
    // does not and must not: an id derived from the title is the only thing
    // that keeps ids honest about what they name, and a corpus where every
    // capture picks its own would lose that in a week. `--original-id` names
    // the same argument and carries its own precondition in the word
    // "original": an item being captured for the first time has no original
    // id, so the flag reads as false on the invocation it should not be on.
    //
    // **THE NAME IS ALSO THE GATE, and no second one is added.** This is a
    // create, not a boundary-crossing act, and `add` already has exactly one
    // gate: `--yes`, which is the APPROVAL boundary and fires on a normative
    // category whether or not this flag is present. Making `--original-id`
    // demand it too would change what that token means — a rationale-tier
    // `lesson` carried across would start requiring the approval `add` asks
    // for only when an item governs the project at once — and a gate that
    // fires for two unrelated reasons is a gate a reader stops reading. What
    // is wanted is that this cannot be reached casually, and the product
    // already answers that with a spelling rather than a prompt:
    // `--summary-omitted` is "never a default and no short spelling", for the
    // same reason. This flag is spelled the same way, and, unlike that one, a
    // value it does not like is refused outright rather than merely recorded.
    //
    // **THE REFUSALS ARE FOUR, AND THE FOURTH IS NOT HERE.** Shape (an id is
    // a file name), relation-target safety, and the category prefix are all
    // checked below, before the confirmation. A COLLISION — an id an item
    // here already holds — is refused by `createItem` and only by
    // `createItem`: it returns the existing item as a no-op duplicate when the
    // content hashes match and throws `occupiedError` when they do not, and
    // its guarantee is the exclusive write, not the lookup. A check added
    // here would have to read `ctx.store`, which is a snapshot and stale by
    // construction — the second, weaker answer to a question the write already
    // answers exactly — and it would buy only the ordering, at the price of a
    // second wording of "already exists" to drift from the first. This path
    // cannot get around that refusal because it has no write of its own:
    // `createItem` below is the only one `add` performs.
    //
    // **NOT ON `edit`, and that is a rule rather than an omission.**
    // `UpdateInput` has no `id` and must not grow one: every relation,
    // citation and audit record points AT an id, so an id that can change
    // after creation breaks all of them at once and leaves a correct-looking
    // audit trail of having done so. Renaming an item is `supersede`, which
    // mints a new item and wires the old one to it, and that is the whole
    // supported answer.
    //
    // **Validated HERE as well as inside `createItem`** — the duplication is
    // of the CALL and not of the rule, the discipline `--severity`,
    // `--valid-from` and `--step` each get — so that a human is not shown
    // "create this item that governs the project?" and told only after
    // answering that the id was never writable. Both guards, in
    // `createItem`'s own order: `validateRelationTarget` because an id becomes
    // a relation target the moment anything supersedes this item, and
    // `validateExplicitId` because it also becomes a FILE NAME, which the
    // first says nothing about.
    const originalId = scalarFlag(args, 'original-id');
    if (originalId !== null) {
      validateRelationTarget(originalId, '--original-id');
      validateExplicitId(originalId, '--original-id');
      input.id = originalId;
    }
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
    // **`--always`: the last field in the verbatim list that `add` could not
    // say.** `--observation`, `--valid-from` and `--original-id` closed the
    // others; 7 of the 44 items in `.my_context.nested-44/` carry
    // `always: true`, and until now every one of them had to be captured
    // unpinned and pinned by a second command — two audit records for one
    // intent, and a window in which the item exists NOT doing the thing it
    // exists to do. `CreateInput.always` already existed; only the spelling
    // was missing.
    //
    // Beside `--severity` rather than beside `--original-id`, because these
    // two are the pair: they are the fields that govern only on the normative
    // tier, they are refused together by `inertFieldError`, and `review
    // promote` and `edit` both handle them in this order. A reader who finds
    // one here should find the other.
    //
    // **`boolFlag`, the same reader `edit` uses on this word**, and that is
    // the whole of the spelling argument (see `ADD_USAGE`): `--always=false`
    // resolves to `false` and is dropped here, so it means "not pinned" on
    // both commands. Read by PRESENCE instead — `args.includes('--always')` —
    // it would mean "pinned" here and "unpinned" there, one word with two
    // opposite readings, which is the trap `boolFlag` was written to close for
    // `--yes=false`. Only `true` is carried into the input: `false` is the
    // default a capture already has, and writing it would be an assertion
    // where the user made none.
    //
    // **NO GATE OF ITS OWN, and the reason is stronger than `--original-id`'s
    // was.** That flag argued no second gate because `add` has exactly one and
    // it means approval. Here the argument is arithmetic: `always: true` is
    // refused outright on the rationale tier (below, and in `createItem`), so
    // every capture this flag can actually land on is a NORMATIVE one — and a
    // normative capture is already behind `--yes`. Adding a gate would add a
    // second prompt to an act that has one, and it would fire on exactly the
    // set the first already covers. What the gate DOES owe is honesty: it is
    // asked to approve the most expensive thing a capture can ask for, so the
    // preview below names the pin and prices it. An approval that does not say
    // the item will be delivered in every session is an approval of something
    // else.
    if (boolFlag(args, 'always') === true) input.always = true;

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
      // The third `--original-id` refusal, and the one that needs the resolved
      // config: an id must begin with the prefix of the category it is being
      // filed under. It waits for `resolved` and is still before the normative
      // preview, so the ordering the two checks above buy is unbroken. Enforced
      // at THIS surface only — `validateIdPrefix` (validate.ts) argues why
      // `createItem` must go on accepting an id whose prefix belongs to
      // somebody else's catalogue.
      if (originalId !== null) {
        validateIdPrefix(originalId, resolved.prefix, category, '--original-id');
      }
    }
    // **`--always` on a RATIONALE-tier category is refused, and it is refused
    // by `createItem` alone — deliberately, where `--severity`, `--step`,
    // `--valid-from`, `--original-id` and `scopeRequirementError` all get a
    // duplicated call here.** Those duplicate the CALL (never the rule) to buy
    // ORDERING: without them a human is shown "create this item that governs
    // this project?" and told only after answering that the capture was never
    // going to land. That purchase is not available here, because the two
    // conditions are DISJOINT: `inertFieldError` fires only on the rationale
    // tier and the confirmation below fires only on the normative one, so the
    // refusal this flag can earn can never arrive after a prompt. A call here
    // would buy nothing and cost a second wording of the same refusal to drift
    // from `createItem`'s — the reasoning `--original-id` records for the
    // collision it also leaves to the write.
    //
    // The refusal itself is `inertFieldError` (core/trust.ts), reached through
    // `createItem` at surface `'capture'`: `always: true` asks for the pinned
    // tier, which selection admits only normative items to (`select.ts` reads
    // `isNormative` before it ever looks at `always`), so on a `lesson` it
    // would be stored and then govern nothing. It says "Nothing was written."
    // and names both remedies — retier the category, or capture the item under
    // a normative one — exactly as the same function refuses `--severity hard`
    // on a `decision`. Pinned by `test/cli/add-always.test.ts`, so a later
    // change that stops routing this through `createItem` is caught here
    // rather than by an item quietly stored inert.
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
      // **The extra sentence a PIN earns, and the reason `--always` needs no
      // gate of its own: this line is what the existing gate is approving.**
      // `alwaysInjection` (render-item.ts) owns the phrase, so this preview
      // cannot drift from `review promote`'s, which states the same fact about
      // the same field at the other place a human decides it.
      //
      // It PRICES the pin as well as naming it, which the `--file` sentence
      // above does not have to: `always` has the largest injection footprint
      // of any field, and the pinned tier is ONE shared budget rather than a
      // per-item allowance, so this capture spends something every other
      // pinned item in the workspace is also spending. An item that does not
      // fit is simply not delivered, and the only place that is ever said is
      // the session-start hook's stderr (`pinnedSpillLine`, hooks/io.ts) —
      // later, to whoever happens to be reading it. It has already happened
      // here: 7 of 23 pinned items failed to reach a session at ~17,237
      // estimated tokens against a budget of 16,000. The person approving this
      // capture is the person spending that budget, so they get the figure
      // before they answer rather than a word that sounds free.
      if (input.always === true) {
        out(
          `  and ${alwaysInjection(resolved.tier).phrase}. The pinned tier is ONE budget ` +
          `(${ws.config.budgets.pinned} estimated tokens) shared by every pinned item here, ` +
          `so an item that no longer fits is not injected at all and only the session-start ` +
          `hook says so. \`mycontext unpin <id>\` is the way back.`,
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

/**
 * `list` takes the detail levels and nothing else.
 *
 * It had no constant at all until plan:builder seq:1b — the list was an
 * argument expression at the `refuseUnknownFlag` call below, which is the same
 * defect as a module-private constant one step earlier: a spec with no name is
 * a spec nothing can import, and a UI that wanted to know what `mycontext
 * list` takes had to read this line and copy it.
 */
const { allowed: LIST_FLAGS } = COMMAND_FLAGS.list;

function cmdList(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;

  // The same silent swallow `cmdAdd` was fixed for, and — until this round —
  // the only reporting command that had it, while the README claimed all six
  // did. The shared helper now lives in format.ts beside `DETAIL_USAGE`; see
  // `unknownFlag`'s doc comment there for the reasoning, which was written
  // here first.
  if (refuseUnknownFlag(args, LIST_FLAGS, [], LIST_USAGE, out)) return 1;

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
  // **The one place a reader of an item meets its summary, so it is the one
  // place staleness has to be said.**
  //
  // `renderItem` prints `summary:` and `summary_of:` as the two frontmatter
  // lines they are, and a reader cannot hash the item in their head — so
  // without this line a summary that stopped describing the item looks
  // identical to one that still does. That is the failure the basis exists to
  // prevent, appearing on the surface that matters most: a summary is the most
  // quotable thing an item has and this is where it gets quoted from.
  //
  // Printed AFTER the item and never in place of it: nothing is withheld and
  // nothing is redacted, exactly as a spilled item is named rather than hidden.
  const staleness = summaryStalenessNote(item);
  if (staleness !== null) { out(''); for (const line of paragraph(staleness)) out(line); }
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

/** `--short`, and it is the whole flag surface. Lifted with `list`'s, above. */
const { allowed: EXAMPLES_FLAGS } = COMMAND_FLAGS.examples;

function cmdExamples(ws: Workspace, args: string[], out: Emit): number {
  // Refused before anything is printed — see `unknownFlag` (format.ts). This
  // command took `args[0]` and ignored everything after it, so `mycontext
  // examples rule --shrot` printed the full item and exited 0: the reader
  // asked for the short form, was handed the long one, and was told nothing.
  if (refuseUnknownFlag(args, EXAMPLES_FLAGS, [], EXAMPLES_USAGE, out)) return 1;

  const type = args.find((a) => !a.startsWith('--'));
  if (!type) { out(EXAMPLES_USAGE); return 1; }
  const short = args.includes('--short');
  try {
    // The specimen answers "what does one look like"; the surface answers
    // "and what may I change on it, by which command" — the question nothing
    // in this product answered until now, so that five of its rules were each
    // learned by trying something and reading the refusal.
    //
    // `exampleItem` is left EXACTLY as it was, ending in its own newline, and
    // the surface is printed after it rather than inside it: its contract is
    // "a complete, correct item, rendered exactly as it is stored", three
    // tests parse its output back into an `Item`, and `mycontext_examples`
    // hands it to a model to copy. The `--short` form stays four to six lines
    // for the reason its own doc comment gives — it is the form both READMEs
    // print once per category.
    out(short
      ? exampleItemShort(type, ws.config)
      : `${exampleItem(type, ws.config)}\n${updatableSurface(type, ws.config)}`);
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
  // is what let the CLI look title-only for three plans. It is DERIVED from
  // `ADD_USAGE` (see `ADD_FLAG_SUMMARY`) rather than restated, because a
  // hand-kept second copy is exactly how this line came to omit
  // `--observation` and `--valid-from` after both had shipped.
  summary: `create an item (${ADD_FLAG_SUMMARY})`,
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
  summary: 'an example item, and what may be changed on one (--short: the item alone)',
  run: (ws, args, out) => cmdExamples(ws, args, out),
});

if (isMainEntry(import.meta.filename, process.argv[1])) {
  process.exitCode = runCli(process.argv.slice(2), process.cwd(), (s) => console.log(s));
}
